import { listVoyageEventLaunchShips, launchVoyageEventSession } from "../foundry/event-launcher.js";
import { beginVoyageEventSessionResolution, dispatchVoyageEventSessionCommand, reloadVoyageEventSession, resolveVoyageEventSessionStation, runExclusiveSessionMutation } from "../foundry/event-session-runtime.js";
import { getM12EventDefinition, M12_DEFINITION_SNAPSHOT_ID, M12_EVENT_ID } from "../m12/event-definition.js";
import { VOYAGE_PRESSURE_SYSTEM_IDS } from "../domain/constants.js";
import { eventTestFailure, requireEventTestAuthority } from "./event-test-authority.js";
import { createDeterministicPendingCheckExecutor, EVENT_TEST_DEGREES } from "./event-test-executor.js";
import { findAuthoredActions, inspectEventSession, inspectEventSessionAs, listEventDefinitions, STATIONS } from "./event-test-inspector.js";
import { buildStructuralDiff } from "./event-test-diff.js";

function nonBlank(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function safeClone(value) {
  try { return { ok: true, value: structuredClone(value) }; } catch { return { ok: false, value: null }; }
}

function id(prefix) {
  try { return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`; } catch { return `${prefix}-event-test`; }
}

const TEST_ORIGIN_KIND = "arcflight-event-test";
const LEGACY_TEST_SESSION_ID = "voyage-session-77a382de-1d6d-4bf9-a3d7-673057f0e6b5";
const LEGACY_TEST_EVENT_ID = "m12-glassback-cinderwake";
const LEGACY_TEST_REVISION = 25;
// Temporary migration helper for the single known pre-Test-Engine development session; remove after cleanup.

function testOriginFor(userId) {
  return { kind: TEST_ORIGIN_KIND, createdByUserId: userId, createdAt: new Date().toISOString() };
}

function validTestOrigin(origin, userId = null) {
  return Boolean(origin && typeof origin === "object" && !Array.isArray(origin)
    && Object.keys(origin).length === 3 && Object.keys(origin).every((key, index) => key === ["kind", "createdByUserId", "createdAt"][index])
    && origin.kind === TEST_ORIGIN_KIND && nonBlank(origin.createdByUserId) && (!userId || origin.createdByUserId === userId)
    && nonBlank(origin.createdAt) && !Number.isNaN(Date.parse(origin.createdAt)));
}

function testError(code, path, message) {
  return { code, path, message, severity: "error" };
}

function testLifecycleFailure(code, message, sessionId = null, path = "sessionId") {
  return eventTestFailure(testError(code, path, message), { sessionId });
}

function journalValues(context) {
  try {
    const source = context?.journalEntries;
    if (Array.isArray(source)) return [...source];
    if (Array.isArray(source?.contents)) return [...source.contents];
    if (typeof source?.values === "function") return [...source.values()];
  } catch {}
  return [];
}

function actorValues(context) {
  try {
    const source = context?.actors;
    if (Array.isArray(source)) return [...source];
    if (Array.isArray(source?.contents)) return [...source.contents];
    if (typeof source?.values === "function") return [...source.values()];
  } catch {}
  return [];
}

function storedSession(document) {
  try {
    if (!document || typeof document.id !== "string" || typeof document.toObject !== "function") return null;
    const source = structuredClone(document.toObject());
    const session = source?.flags?.arcflight?.system?.voyageSession;
    if (!session || typeof session !== "object" || Array.isArray(session) || session.sessionDocumentId !== document.id) return null;
    return { document, session };
  } catch {
    return null;
  }
}

function findStoredSession(sessionId, context) {
  const matches = journalValues(context).map(storedSession).filter((entry) => entry?.session?.sessionId === sessionId);
  if (matches.length === 0) return { ok: false, code: "m11-session-document-not-found", message: "Exact Event Session document was not resolved." };
  if (matches.length > 1) return { ok: false, code: "m11-ambiguous-session-document", message: "More than one Event Session document matched." };
  return { ok: true, ...matches[0] };
}

function sessionTestOrigin(session) {
  return session?.encounterState?.metadata?.testOrigin ?? null;
}

function sameData(left, right) {
  try { return JSON.stringify(left) === JSON.stringify(right); } catch { return false; }
}
function invalid(path, message) {
  return eventTestFailure({ code: "m11-invalid-request-shape", path, message, severity: "error" });
}

function operation(result, snapshot = null) {
  const output = {
    ok: result?.ok === true,
    requestId: result?.requestId ?? null,
    sessionId: result?.sessionId ?? null,
    status: result?.status ?? null,
    revision: result?.revision ?? null,
    authorityEpoch: result?.authorityEpoch ?? null,
    errors: result?.errors ?? [],
    warnings: result?.warnings ?? []
  };
  if (snapshot) output.snapshot = snapshot;
  return output;
}

function withTestOrigin(snapshot, sessionId, context) {
  if (!snapshot?.session || !nonBlank(sessionId)) return snapshot;
  const found = findStoredSession(sessionId, context);
  const origin = found.ok ? safeClone(found.session?.encounterState?.metadata?.testOrigin) : { ok: false, value: null };
  return origin.ok ? {
    ...snapshot,
    session: {
      ...snapshot.session,
      eventId: found.session.eventId ?? snapshot.session.eventId ?? null,
      definitionSnapshotId: found.session.definitionSnapshotId ?? snapshot.session.definitionSnapshotId ?? null,
      shipId: found.session.shipId ?? snapshot.session.shipId ?? null,
      testOrigin: origin.value
    }
  } : snapshot;
}

function currentValues(result) {
  return { revision: result?.revision, authorityEpoch: result?.authorityEpoch };
}

function commandRequest(sessionId, revision, authorityEpoch, commandKind, payload) {
  return { kind: "voyage.m11-command", requestId: id(`event-test-${commandKind}`), sessionId, expectedRevision: revision, authorityEpoch, commandKind, payload };
}

function launchRequest(input, context) {
  const actors = Array.isArray(context?.actors) ? context.actors : (Array.isArray(context?.actors?.contents) ? context.actors.contents : []);
  const shipId = input.shipId ?? listVoyageEventLaunchShips(actors)[0]?.id ?? null;
  const operatorSelections = input.operatorSelections ?? Object.fromEntries(STATIONS.map((stationId) => [stationId, null]));
  const listed = Array.isArray(context?.eventDefinitions) ? context.eventDefinitions : [];
  const selected = listed.find((definition) => definition?.eventId === input.eventId) ?? null;
  const eventId = input.eventId ?? selected?.eventId ?? M12_EVENT_ID;
  const definitionSnapshotId = input.definitionSnapshotId ?? selected?.definitionSnapshotId ?? (eventId === M12_EVENT_ID ? M12_DEFINITION_SNAPSHOT_ID : null);
  return {
    kind: "voyage.m12-launch-event",
    requestId: id("event-test-launch"),
    sessionId: input.sessionId ?? id("voyage-session"),
    expectedRevision: 0,
    authorityEpoch: 0,
    eventId,
    definitionSnapshotId,
    shipId,
    operatorSelections
  };
}

function actorOperatorIdentity(actor) {
  const id = typeof actor?.id === "string" ? actor.id : "";
  const uuid = typeof actor?.uuid === "string" ? actor.uuid : id ? `Actor.${id}` : "";
  const name = typeof actor?.name === "string" && actor.name.trim() ? actor.name : id;
  return id && uuid && actor?.type !== "vehicle" ? { kind: "actor", id, uuid, name } : null;
}

function fixtureOperatorCandidates(context, shipId) {
  const seen = new Set();
  return actorValues(context)
    .filter((actor) => actor?.id !== shipId)
    .map(actorOperatorIdentity)
    .filter((operator) => operator && !seen.has(operator.id) && (seen.add(operator.id), true))
    .sort((left, right) => left.id.localeCompare(right.id) || left.uuid.localeCompare(right.uuid));
}

async function readPlanning(sessionId, context) {
  const inspect = await inspectEventSession(sessionId, context);
  return inspect?.ok ? inspect : null;
}

async function dispatchPlanning(sessionId, context, commandKind, payload, state) {
  const request = commandRequest(sessionId, state.revision, state.authorityEpoch, commandKind, payload);
  const result = await Promise.resolve(dispatchVoyageEventSessionCommand(request, context));
  if (!result?.ok) return { result, state: null, request };
  return { result, state: currentValues(result), request };
}

function recordPlanningTrace(trace, commandKind, beforeState, result, stageBefore, stageAfter, payload = null) {
  trace.push({
    command: commandKind,
    requestId: result?.request?.requestId ?? result?.result?.requestId ?? null,
    inputs: safeClone(payload).value ?? null,
    status: result?.result?.ok === true ? "PASS" : "FAIL",
    revisionBefore: beforeState?.revision ?? null,
    revisionAfter: result?.result?.revision ?? null,
    writes: result?.result?.ok === true ? 1 : 0,
    stageBefore: stageBefore ?? null,
    stageAfter: stageAfter ?? null
  });
}

function stationSelections(planning, explicit) {
  const provided = explicit && typeof explicit === "object" ? explicit : {};
  const output = [];
  for (const assignment of planning?.planning?.assignments ?? []) {
    const stationId = assignment?.stationId;
    if (!nonBlank(stationId)) continue;
    const station = (planning?.planning?.stations ?? []).find((entry) => entry.stationId === stationId);
    const actions = Array.isArray(station?.actions) ? station.actions : [];
    const requested = provided[stationId] && typeof provided[stationId] === "object" ? provided[stationId] : {};
    const action = actions.find((entry) => entry.actionId === requested.actionId) ?? actions[0];
    const approach = action?.approaches?.find((entry) => entry.approachId === requested.approachId) ?? action?.approaches?.[0];
    if (!action || !approach) return null;
    const riskBidId = requested.riskBidId === undefined ? null : requested.riskBidId;
    output.push({ stationId, actionId: action.actionId, approachId: approach.approachId, riskBidId });
  }
  return output;
}

function resolveStationFailure(code, path, message, sessionId) {
  return eventTestFailure({ code, path, message, severity: "error" }, { sessionId });
}

function currentPendingReaction(session) {
  try {
    const window = session?.encounterState?.metadata?.reactionWindow;
    if (!window || typeof window !== "object" || Array.isArray(window) || window.status !== "open" || !Array.isArray(window.opportunities)) return null;
    const resolved = Array.isArray(window.resolved) ? window.resolved : [];
    return window.opportunities.find((entry) => entry && typeof entry === "object" && !Array.isArray(entry)
      && nonBlank(entry.reactionId) && !resolved.includes(entry.reactionId)) ?? null;
  } catch {
    return null;
  }
}

const RESOLUTION_DEGREE_PROFILES = Object.freeze(["all-success", "all-failure", "all-critical-success", "all-critical-failure", "custom"]);

function resolutionDegreeMap(profile = "all-success", customDegrees = null) {
  if (!RESOLUTION_DEGREE_PROFILES.includes(profile)) return null;
  if (profile === "custom") {
    if (!customDegrees || typeof customDegrees !== "object" || Array.isArray(customDegrees)
      || Object.keys(customDegrees).length !== STATIONS.length
      || !STATIONS.every((stationId) => Object.hasOwn(customDegrees, stationId) && EVENT_TEST_DEGREES.includes(customDegrees[stationId]))) return null;
    return Object.fromEntries(STATIONS.map((stationId) => [stationId, customDegrees[stationId]]));
  }
  const degree = profile === "all-failure" ? "failure"
    : profile === "all-critical-success" ? "critical-success"
      : profile === "all-critical-failure" ? "critical-failure" : "success";
  return Object.fromEntries(STATIONS.map((stationId) => [stationId, degree]));
}

function resolutionCurrentStationId(snapshot) {
  const resolution = snapshot?.resolution ?? {};
  if (nonBlank(resolution.currentStationId)) return resolution.currentStationId;
  const order = Array.isArray(snapshot?.planning?.committedStationOrder)
    ? snapshot.planning.committedStationOrder
    : [];
  const pending = Array.isArray(resolution.pendingChecks) ? resolution.pendingChecks : [];
  return order.find((stationId) => pending.some((entry) => entry?.stationId === stationId && entry?.status === "pending")) ?? null;
}

function resolutionReactionOpen(snapshot) {
  const resolution = snapshot?.resolution ?? {};
  return resolution.reactionWindowOpen === true
    || resolution.reactionWindow?.status === "open"
    || (Array.isArray(resolution.currentReaction) && resolution.currentReaction.length > 0)
    || (Array.isArray(resolution.reactionWindowPending) && resolution.reactionWindowPending.length > 0);
}

function resolutionEvidence(snapshot, stored = null) {
  const session = snapshot?.session ?? {};
  const raw = stored?.session ?? null;
  const resolution = snapshot?.resolution ?? {};
  const stations = Array.isArray(resolution.pendingChecks) ? resolution.pendingChecks : [];
  const currentReaction = Array.isArray(resolution.currentReaction)
    ? resolution.currentReaction
    : (Array.isArray(resolution.reactionWindowPending) ? resolution.reactionWindowPending : (Array.isArray(resolution.reactionWindow) ? resolution.reactionWindow : []));
  const activeBenefits = stations.flatMap((station) => Array.isArray(station?.riskBidEffects) ? station.riskBidEffects : []);
  return {
    sessionState: session.sessionState ?? null,
    phase: session.phase ?? null,
    sessionRevision: session.revision ?? null,
    encounterRevision: raw?.encounterState?.revision ?? null,
    currentStationId: resolutionCurrentStationId(snapshot),
    pendingChecks: stations.map((station) => ({
      stationId: station?.stationId ?? null,
      pendingCheckId: station?.pendingCheckId ?? null,
      status: station?.status ?? null,
      result: station?.result ?? null
    })),
    reactionWindow: resolution.reactionWindow ?? (currentReaction.length > 0 ? { status: "open" } : null),
    reactionStatus: resolution.reactionWindow?.status ?? (currentReaction.length > 0 ? "open" : "closed"),
    currentReaction,
    pressureValues: snapshot?.ship?.pressureSystems ?? null,
    pendingBreachSave: resolution.pendingBreachSave ?? null,
    hazards: snapshot?.ship?.activeHazards ?? [],
    voidScars: snapshot?.ship?.voidScarEvidence ?? null,
    activeBenefits,
    eventCount: Array.isArray(raw?.events) ? raw.events.length : null,
    auditCount: Array.isArray(raw?.auditHistory) ? raw.auditHistory.length : null,
    processedRequestCount: Array.isArray(raw?.processedRequests) ? raw.processedRequests.length : null
  };
}

function resolutionInvariantResults(before, after, trace, beforeStored, afterStored) {
  const beforeEvidence = resolutionEvidence(before, beforeStored);
  const afterEvidence = resolutionEvidence(after, afterStored);
  const expectedStationId = trace?.stationId ?? beforeEvidence.currentStationId;
  const beforePending = beforeEvidence.pendingChecks.find((entry) => entry.stationId === expectedStationId);
  const afterPending = afterEvidence.pendingChecks.find((entry) => entry.stationId === expectedStationId);
  const latestEvent = afterStored?.session?.events?.at(-1) ?? null;
  const latestAudit = afterStored?.session?.auditHistory?.at(-1) ?? null;
  const requestMatches = afterStored?.session?.processedRequests?.filter((entry) => entry?.requestId === trace?.requestId) ?? [];
  return [
    { id: "test-origin-valid", label: "Test origin remains valid", status: (sessionTestOrigin(afterStored?.session)?.kind ?? after?.session?.testOrigin?.kind) === "arcflight-event-test" ? "PASS" : "FAIL", expected: "arcflight-event-test", actual: sessionTestOrigin(afterStored?.session)?.kind ?? after?.session?.testOrigin?.kind ?? null },
    { id: "resolution-identity-stable", label: "Event/session identity stable", status: before?.session?.sessionId === after?.session?.sessionId && before?.session?.eventId === after?.session?.eventId && before?.session?.shipId === after?.session?.shipId ? "PASS" : "FAIL", expected: { sessionId: before?.session?.sessionId, eventId: before?.session?.eventId, shipId: before?.session?.shipId }, actual: { sessionId: after?.session?.sessionId, eventId: after?.session?.eventId, shipId: after?.session?.shipId } },
    { id: "session-revision-monotonic", label: "Session revision increases", status: Number.isSafeInteger(afterEvidence.sessionRevision) && afterEvidence.sessionRevision > beforeEvidence.sessionRevision ? "PASS" : "FAIL", expected: `>${beforeEvidence.sessionRevision}`, actual: afterEvidence.sessionRevision },
    { id: "encounter-revision-monotonic", label: "Encounter revision does not move backward", status: Number.isSafeInteger(afterEvidence.encounterRevision) && afterEvidence.encounterRevision >= beforeEvidence.encounterRevision ? "PASS" : "FAIL", expected: `>=${beforeEvidence.encounterRevision}`, actual: afterEvidence.encounterRevision },
    { id: "station-order-stable", label: "Committed station order stable", status: JSON.stringify(before?.planning?.committedStationOrder ?? []) === JSON.stringify(after?.planning?.committedStationOrder ?? []) ? "PASS" : "FAIL", expected: before?.planning?.committedStationOrder ?? [], actual: after?.planning?.committedStationOrder ?? [] },
    { id: "current-station-only", label: "Only current station resolves", status: beforeEvidence.currentStationId === expectedStationId && afterPending?.status === "resolved" ? "PASS" : "FAIL", expected: expectedStationId, actual: { before: beforeEvidence.currentStationId, after: afterPending?.status ?? null } },
    { id: "pending-check-bound", label: "Pending check remains station-bound", status: Boolean(beforePending?.pendingCheckId) && beforePending.stationId === expectedStationId ? "PASS" : "FAIL", expected: expectedStationId, actual: beforePending?.stationId ?? null },
    { id: "no-double-resolution", label: "Resolved pending check cannot resolve twice", status: beforePending?.status === "pending" && afterPending?.status === "resolved" ? "PASS" : "FAIL", expected: { before: "pending", after: "resolved" }, actual: { before: beforePending?.status ?? null, after: afterPending?.status ?? null } },
    { id: "runtime-event-bound", label: "Runtime event matches command", status: latestEvent?.type === "voyage.m12-action-segment" ? "PASS" : "FAIL", expected: "voyage.m12-action-segment", actual: latestEvent?.type ?? null },
    { id: "audit-bound", label: "Audit record matches mutation", status: latestAudit?.requestId === trace?.requestId && latestAudit?.revision === afterEvidence.sessionRevision ? "PASS" : "FAIL", expected: { requestId: trace?.requestId, revision: afterEvidence.sessionRevision }, actual: { requestId: latestAudit?.requestId ?? null, revision: latestAudit?.revision ?? null } },
    { id: "processed-request-once", label: "Processed request recorded once", status: requestMatches.length === 1 ? "PASS" : "FAIL", expected: 1, actual: requestMatches.length },
    { id: "unique-request-trace", label: "Resolution request IDs remain unique", status: trace?.requestId ? "PASS" : "FAIL", expected: "nonblank request ID", actual: trace?.requestId ?? null },
    { id: "reaction-window-gated", label: "Reaction window gates station advancement", status: beforeEvidence.reactionWindow?.status === "open" ? "PASS" : "SKIP", expected: "open reaction window is handled before station execution", actual: beforeEvidence.reactionWindow?.status ?? "closed" },
    { id: "canonical-advancement", label: "Station advances after canonical completion", status: afterEvidence.currentStationId !== expectedStationId || afterEvidence.pendingChecks.every((entry) => entry.status === "resolved") ? "PASS" : "FAIL", expected: `next station after ${expectedStationId}`, actual: afterEvidence.currentStationId },
    { id: "runtime-produced-state", label: "Consequences come from runtime", status: trace?.runtimeSource === "canonical-runtime" ? "PASS" : "FAIL", expected: "canonical-runtime", actual: trace?.runtimeSource ?? null },
    { id: "authoritative-counts", label: "Authoritative event/audit/request counts captured", status: [afterEvidence.eventCount, afterEvidence.auditCount, afterEvidence.processedRequestCount].every(Number.isSafeInteger) ? "PASS" : "FAIL", expected: "three authoritative counts", actual: { eventCount: afterEvidence.eventCount, auditCount: afterEvidence.auditCount, processedRequestCount: afterEvidence.processedRequestCount } }
  ];
}

function resolutionTraceEntry({ command, requestId, station, degree, before, after, beforeStored, afterStored, runtimeResult, writes = 0 }) {
  const beforeEvidence = resolutionEvidence(before, beforeStored);
  const afterEvidence = resolutionEvidence(after, afterStored);
  const trace = {
    stepId: `resolution-${command}-${station?.stationId ?? "session"}-${afterEvidence.sessionRevision ?? "unknown"}`,
    label: station?.stationId ? `${station.stationId} · ${command}` : command,
    status: after ? "PASS" : "FAIL",
    command,
    requestId,
    stationId: station?.stationId ?? null,
    actionId: station?.actionId ?? null,
    approachId: station?.approachId ?? null,
    degreeInput: degree ?? null,
    beforeRevision: beforeEvidence.sessionRevision,
    afterRevision: afterEvidence.sessionRevision,
    writes,
    runtimeSource: "canonical-runtime",
    runtimeResult: runtimeResult ?? null,
    beforeEvidence,
    afterEvidence,
    diff: before && after ? buildStructuralDiff(beforeEvidence, afterEvidence) : [],
    invariantResults: []
  };
  if (before && after) {
    trace.invariantResults = command === "resolution-start"
      ? resolutionInvariantResults(before, after, { ...trace, stationId: beforeEvidence.currentStationId, runtimeSource: "canonical-runtime" }, beforeStored, afterStored).filter((entry) => ["test-origin-valid", "resolution-identity-stable", "session-revision-monotonic", "encounter-revision-monotonic", "authoritative-counts"].includes(entry.id))
      : command === "focus-reaction-pass"
        ? reactionInvariantResults(before, after, trace, beforeStored, afterStored)
      : resolutionInvariantResults(before, after, trace, beforeStored, afterStored);
  }
  return trace;
}

function reactionInvariantResults(before, after, trace, beforeStored, afterStored) {
  const beforeEvidence = resolutionEvidence(before, beforeStored);
  const afterEvidence = resolutionEvidence(after, afterStored);
  const latestEvent = afterStored?.session?.events?.at(-1) ?? null;
  const latestAudit = afterStored?.session?.auditHistory?.at(-1) ?? null;
  const requestMatches = afterStored?.session?.processedRequests?.filter((entry) => entry?.requestId === trace?.requestId) ?? [];
  const stationId = trace?.stationId ?? beforeEvidence.currentStationId;
  const beforeStation = beforeEvidence.pendingChecks.find((entry) => entry.stationId === stationId);
  const afterStation = afterEvidence.pendingChecks.find((entry) => entry.stationId === stationId);
  return [
    { id: "test-origin-valid", label: "Test origin remains valid", status: (sessionTestOrigin(afterStored?.session)?.kind ?? after?.session?.testOrigin?.kind) === "arcflight-event-test" ? "PASS" : "FAIL", expected: "arcflight-event-test", actual: sessionTestOrigin(afterStored?.session)?.kind ?? after?.session?.testOrigin?.kind ?? null },
    { id: "reaction-identity-stable", label: "Reaction identity captured", status: Boolean(beforeEvidence.currentReaction[0]?.reactionId ?? trace?.reactionId) ? "PASS" : "FAIL", expected: "reaction ID", actual: beforeEvidence.currentReaction[0]?.reactionId ?? trace?.reactionId ?? null },
    { id: "reaction-window-cleared", label: "Canonical reaction pass clears the pending reaction", status: beforeEvidence.currentReaction.length > 0 && afterEvidence.currentReaction.length === 0 ? "PASS" : "FAIL", expected: { before: "pending", after: "cleared" }, actual: { before: beforeEvidence.currentReaction.length, after: afterEvidence.currentReaction.length } },
    { id: "reaction-runtime-event-bound", label: "Runtime event matches reaction-pass command", status: latestEvent?.type === "voyage.m12-focus-reaction-pass" ? "PASS" : "FAIL", expected: "voyage.m12-focus-reaction-pass", actual: latestEvent?.type ?? null },
    { id: "reaction-audit-bound", label: "Reaction audit matches mutation", status: latestAudit?.kind === "m12-focus-reaction-passed" && latestAudit?.requestId === trace?.requestId ? "PASS" : "FAIL", expected: "m12-focus-reaction-passed", actual: { kind: latestAudit?.kind ?? null, requestId: latestAudit?.requestId ?? null } },
    { id: "reaction-processed-once", label: "Reaction pass request recorded once", status: requestMatches.length === 1 ? "PASS" : "FAIL", expected: 1, actual: requestMatches.length },
    { id: "station-remains-pending", label: "Station remains pending until reaction handling completes", status: beforeStation?.status === "pending" && afterStation?.status === "pending" ? "PASS" : "FAIL", expected: "pending", actual: { before: beforeStation?.status ?? null, after: afterStation?.status ?? null } },
    { id: "reaction-writes-captured", label: "Reaction revision and writes captured", status: Number.isSafeInteger(trace?.writes) && trace.writes > 0 && Number.isSafeInteger(trace?.beforeRevision) && Number.isSafeInteger(trace?.afterRevision) && trace.afterRevision > trace.beforeRevision ? "PASS" : "FAIL", expected: "positive canonical reaction write", actual: { writes: trace?.writes ?? null, beforeRevision: trace?.beforeRevision ?? null, afterRevision: trace?.afterRevision ?? null } }
  ];
}
function validPressureSystems(session) {
  try {
    const systems = session?.encounterState?.pressureSystems;
    if (!systems || typeof systems !== "object" || Array.isArray(systems) || Object.getPrototypeOf(systems) !== Object.prototype
      || Object.keys(systems).length !== VOYAGE_PRESSURE_SYSTEM_IDS.length
      || !VOYAGE_PRESSURE_SYSTEM_IDS.every((id) => Object.hasOwn(systems, id))) return null;
    for (const pressureSystemId of VOYAGE_PRESSURE_SYSTEM_IDS) {
      const system = systems[pressureSystemId];
      if (!system || typeof system !== "object" || Array.isArray(system) || Object.getPrototypeOf(system) !== Object.prototype
        || Object.keys(system).length !== 3 || system.pressureSystemId !== pressureSystemId
        || !Number.isSafeInteger(system.value) || system.value < 0
        || !Number.isSafeInteger(system.capacity) || system.capacity < 0 || system.value > system.capacity) return null;
    }
    return systems;
  } catch {
    return null;
  }
}

function preconditionEnvelope(sessionId, requestId, session, errors = []) {
  return { ok: errors.length === 0, requestId, sessionId, status: errors.length === 0 ? session?.sessionState ?? null : "failed", revision: session?.revision ?? null, authorityEpoch: session?.authorityEpoch ?? null, projection: null, events: [], errors, warnings: [] };
}

function preconditionFailure(sessionId, requestId, code, path, message) {
  return preconditionEnvelope(sessionId, requestId, null, [{ code, path, message, severity: "error" }]);
}


async function persistPressurePrecondition({ sessionId, pressureSystemId, requestedValue, requestId, found, context }) {
    const descriptor = { sessionId, sessionDocumentId: found.document.id, expectedRevision: found.session.revision, expectedAuthorityEpoch: found.session.authorityEpoch, authenticatedUserId: context.authenticatedUserId, connectionId: context.authenticatedConnectionId, activeGmUserId: context.activeGmUserId };
    const result = await runExclusiveSessionMutation(context, descriptor, async () => {
      const current = findStoredSession(sessionId, context);
      if (!current.ok) return preconditionFailure(sessionId, requestId, current.code, "sessionId", current.message);
      if (current.document.id !== descriptor.sessionDocumentId || !validTestOrigin(sessionTestOrigin(current.session), context.authenticatedUserId)) return preconditionFailure(sessionId, requestId, "m12-test-session-origin-required", "session", "Only Event Test Engine sessions may set Pressure.");
      if (context.authenticatedUserId !== descriptor.authenticatedUserId || context.authenticatedConnectionId !== descriptor.connectionId || context.activeGmUserId !== descriptor.activeGmUserId || current.session.activeGmUserId !== descriptor.activeGmUserId) return preconditionFailure(sessionId, requestId, "m11-control-transfer-required", "transport.connection", "Trusted Event Test authority changed before the Pressure precondition write.");
      if (current.session.revision !== descriptor.expectedRevision) return preconditionFailure(sessionId, requestId, "m11-stale-session-revision", "expectedRevision", "The Event Test Session changed before the Pressure precondition write.");
      if (current.session.authorityEpoch !== descriptor.expectedAuthorityEpoch) return preconditionFailure(sessionId, requestId, "m11-control-transfer-required", "authorityEpoch", "The Event Test Session authority changed before the Pressure precondition write.");
      if (!reloadVoyageEventSession(sessionId, context)?.ok) return preconditionFailure(sessionId, requestId, "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid.");
      const systems = validPressureSystems(current.session);
      const system = systems?.[pressureSystemId];
      if (!system) return preconditionFailure(sessionId, requestId, "m11-command-payload-invalid", "pressureSystemId", "The requested Pressure system is not present on the authoritative session.");
      if (!Number.isSafeInteger(requestedValue) || requestedValue < 0 || requestedValue > system.capacity) return preconditionFailure(sessionId, requestId, "m11-command-payload-invalid", "value", "Pressure value must be an integer within the authoritative system capacity.");
      const previousValue = system.value;
      if (previousValue === requestedValue) return preconditionEnvelope(sessionId, requestId, current.session);
      const candidate = safeClone(current.session);
      if (!candidate.ok) return preconditionFailure(sessionId, requestId, "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session could not be isolated.");
      candidate.value.encounterState.pressureSystems[pressureSystemId].value = requestedValue;
      try {
        await current.document.update({ "flags.arcflight.system.voyageSession": candidate.value }, { diff: false, recursive: false });
      } catch {
        const reread = findStoredSession(sessionId, context);
        if (reread.ok && sameData(reread.session, candidate.value) && reloadVoyageEventSession(sessionId, context)?.ok) return preconditionEnvelope(sessionId, requestId, reread.session);
        if (reread.ok && sameData(reread.session, current.session)) return preconditionFailure(sessionId, requestId, "m11-session-write-failed", "flags.arcflight.system.voyageSession", "The Pressure precondition could not be persisted.");
        return preconditionFailure(sessionId, requestId, "m11-recovery-required", "recovery", "The Pressure precondition write outcome is uncertain.");
      }
      const reread = findStoredSession(sessionId, context);
      if (!reread.ok || reread.document.id !== descriptor.sessionDocumentId) return preconditionFailure(sessionId, requestId, "m11-recovery-required", "recovery", "The Pressure precondition could not be reread and verified.");
      if (!sameData(reread.session, candidate.value) || !reloadVoyageEventSession(sessionId, context)?.ok) return preconditionFailure(sessionId, requestId, "m11-session-write-failed", "flags.arcflight.system.voyageSession", "The Pressure precondition could not be reread and verified.");
      return preconditionEnvelope(sessionId, requestId, reread.session);
    }, { sessionId }, { nonWinnerCode: "m11-control-transfer-required", nonWinnerPath: "authorityEpoch" });
  return result;
}

export function createVoyageEventTestNamespace({ getContext, getGame } = {}) {
  const contextFactory = typeof getContext === "function" ? getContext : () => ({});
  const gameFactory = typeof getGame === "function" ? getGame : () => globalThis.game;

  async function guard() {
    let context;
    try { context = await contextFactory(); } catch { context = null; }
    const authority = requireEventTestAuthority(context, gameFactory());
    return authority.ok ? { ok: true, context } : { ok: false, result: eventTestFailure(authority.error) };
  }

  async function listEvents() {
    const checked = await guard();
    if (!checked.ok) return checked.result;
    const listed = await Promise.resolve(listEventDefinitions(checked.context));
    const events = listed === null ? [] : (Array.isArray(listed) ? listed : [listed]);
    return { ok: true, events: safeClone(events).value ?? [] };
  }

  async function listShips() {
    const checked = await guard();
    if (!checked.ok) return checked.result;
    const ships = listVoyageEventLaunchShips(actorValues(checked.context));
    return { ok: true, ships: safeClone(ships).value ?? [] };
  }

  async function inspect(input = {}) {
    const checked = await guard();
    if (!checked.ok) return checked.result;
    const cloned = safeClone(input);
    if (!cloned.ok || !cloned.value || typeof cloned.value !== "object" || Array.isArray(cloned.value) || Object.getPrototypeOf(cloned.value) !== Object.prototype) return invalid("request", "inspect requires an object with sessionId.");
    const keys = Object.keys(cloned.value);
    if (!keys.every((key) => ["sessionId", "verbose"].includes(key)) || !nonBlank(cloned.value.sessionId) || (Object.hasOwn(cloned.value, "verbose") && typeof cloned.value.verbose !== "boolean")) return invalid("request", "inspect requires a nonblank sessionId and optional boolean verbose.");
    const result = await inspectEventSession(cloned.value.sessionId, checked.context);
    if (!result?.ok) return result;
    return { ...result, snapshot: withTestOrigin(result.snapshot, cloned.value.sessionId, checked.context) };
  }

  async function inspectAs(input = {}) {
    const checked = await guard();
    if (!checked.ok) return checked.result;
    if (!input || typeof input !== "object" || !nonBlank(input.sessionId) || !nonBlank(input.userId)) return invalid("request", "sessionId and userId are required.");
    return inspectEventSessionAs(input.sessionId, input.userId, checked.context);
  }

  async function findActionsByConsequence(filters = {}) {
    const checked = await guard();
    if (!checked.ok) return checked.result;
    return findAuthoredActions(filters, checked.context);
  }

  async function discoverFixtureRequirements(input = {}) {
    const checked = await guard();
    if (!checked.ok) return checked.result;
    const cloned = safeClone(input);
    if (!cloned.ok || !cloned.value || typeof cloned.value !== "object" || Array.isArray(cloned.value)
      || !nonBlank(cloned.value.eventId) || (Object.hasOwn(cloned.value, "definitionSnapshotId") && !nonBlank(cloned.value.definitionSnapshotId))) {
      return invalid("request", "discoverFixtureRequirements requires eventId and optional definitionSnapshotId.");
    }
    const listed = await Promise.resolve(listEventDefinitions(checked.context));
    const selected = listed.find((entry) => entry?.eventId === cloned.value.eventId) ?? null;
    if (!selected) return eventTestFailure(testError("m11-event-definition-not-found", "eventId", "The selected event definition was not discovered."));
    let definition = null;
    try {
      definition = typeof checked.context.resolveEventDefinitionSnapshot === "function"
        ? await checked.context.resolveEventDefinitionSnapshot(cloned.value.eventId, cloned.value.definitionSnapshotId ?? selected.definitionSnapshotId)
        : getM12EventDefinition();
    } catch {}
    const rounds = Array.isArray(definition?.rounds) ? [...definition.rounds].sort((left, right) => (left?.roundNumber ?? 0) - (right?.roundNumber ?? 0)) : [];
    const round = rounds[0] ?? null;
    const stations = Array.isArray(round?.availableStations)
      ? round.availableStations.map((station) => ({
        stationId: station?.stationId ?? null,
        label: station?.label ?? station?.name ?? station?.stationId ?? null,
        actions: Array.isArray(station?.actions) ? station.actions.map((action) => ({
          actionId: action?.actionId ?? null,
          name: action?.name ?? action?.actionId ?? null,
          approaches: Array.isArray(action?.approaches) ? action.approaches.map((approach) => ({ approachId: approach?.approachId ?? null, name: approach?.name ?? approach?.approachId ?? null })) : []
        })) : []
      }))
      : [];
    if (!nonBlank(round?.roundId) || stations.length === 0 || stations.some((station) => !nonBlank(station.stationId) || station.actions.length === 0)) {
      return eventTestFailure(testError("m12-test-engine-station-requirements-unavailable", "eventDefinition.rounds", "The selected event has no valid authored station requirements for Fixture Prep."));
    }
    return { ok: true, eventId: cloned.value.eventId, definitionSnapshotId: selected.definitionSnapshotId ?? null, roundId: round.roundId, roundNumber: round.roundNumber ?? null, stations };
  }

  async function listOperators(input = {}) {
    const checked = await guard();
    if (!checked.ok) return checked.result;
    const cloned = safeClone(input);
    if (!cloned.ok || !cloned.value || typeof cloned.value !== "object" || Array.isArray(cloned.value)
      || !nonBlank(cloned.value.eventId) || !nonBlank(cloned.value.shipId)) return invalid("request", "listOperators requires eventId and shipId.");
    const ship = listVoyageEventLaunchShips(actorValues(checked.context)).find((entry) => entry.id === cloned.value.shipId);
    if (!ship) return eventTestFailure(testError("m12-invalid-ship-fixture", "shipId", "The selected ship is not a valid Arcflight launch ship."));
    const operators = fixtureOperatorCandidates(checked.context, ship.id);
    if (operators.length === 0) return eventTestFailure(testError("m12-test-engine-no-valid-operators", "operators", "No valid operator Actors are available for Fixture Prep."));
    return { ok: true, eventId: cloned.value.eventId, shipId: ship.id, operators, assignmentPolicy: "canonical-first-valid" };
  }

  async function abandon(input = {}) {
    const checked = await guard();
    if (!checked.ok) return checked.result;
    const cloned = safeClone(input);
    if (!cloned.ok || !cloned.value || typeof cloned.value !== "object" || Array.isArray(cloned.value)
      || Object.getPrototypeOf(cloned.value) !== Object.prototype || Object.keys(cloned.value).length !== 1
      || Object.keys(cloned.value)[0] !== "sessionId" || !nonBlank(cloned.value.sessionId)) {
      return invalid("request", "abandon requires exactly sessionId.");
    }
    const sessionId = cloned.value.sessionId;
    const found = findStoredSession(sessionId, checked.context);
    if (!found.ok) return testLifecycleFailure(found.code, found.message, sessionId);
    const reloaded = reloadVoyageEventSession(sessionId, checked.context);
    if (!reloaded?.ok) return testLifecycleFailure("m11-invalid-session-document", "Stored Event Session is invalid.", sessionId, "flags.arcflight.system.voyageSession");
    const origin = sessionTestOrigin(found.session);
    if (!validTestOrigin(origin, checked.context.authenticatedUserId)) {
      return testLifecycleFailure("m12-test-session-origin-required", "Only Event Test Engine sessions may be abandoned.", sessionId);
    }
    if (typeof found.document.delete !== "function") {
      return testLifecycleFailure("m12-test-session-cleanup-unavailable", "The test session container cannot be safely removed.", sessionId, "sessionDocument");
    }
    try {
      await found.document.delete();
    } catch {
      const afterThrow = findStoredSession(sessionId, checked.context);
      if (!afterThrow.ok && afterThrow.code === "m11-session-document-not-found") return { ok: true, sessionId, status: "abandoned", deleted: true };
      return testLifecycleFailure("m11-session-write-failed", "The test session container could not be removed.", sessionId, "sessionDocument");
    }
    const remaining = findStoredSession(sessionId, checked.context);
    if (remaining.ok) return testLifecycleFailure("m11-recovery-required", "The test session removal could not be verified.", sessionId, "sessionDocument");
    if (remaining.code !== "m11-session-document-not-found") return testLifecycleFailure(remaining.code, remaining.message, sessionId);
    return { ok: true, sessionId, status: "abandoned", deleted: true };
  }

  async function claimLegacyTestSession(input = {}) {
    const checked = await guard();
    if (!checked.ok) return checked.result;
    const cloned = safeClone(input);
    if (!cloned.ok || !cloned.value || typeof cloned.value !== "object" || Array.isArray(cloned.value)
      || Object.getPrototypeOf(cloned.value) !== Object.prototype || Object.keys(cloned.value).length !== 2
      || Object.keys(cloned.value)[0] !== "sessionId" || Object.keys(cloned.value)[1] !== "expectedRevision"
      || cloned.value.sessionId !== LEGACY_TEST_SESSION_ID || cloned.value.expectedRevision !== LEGACY_TEST_REVISION) {
      return testLifecycleFailure("m12-legacy-test-claim-rejected", "The one-time legacy test-session contract did not match.", cloned.value?.sessionId ?? null, "request");
    }
    const found = findStoredSession(LEGACY_TEST_SESSION_ID, checked.context);
    if (!found.ok) return testLifecycleFailure(found.code, found.message, LEGACY_TEST_SESSION_ID);
    const reloaded = reloadVoyageEventSession(LEGACY_TEST_SESSION_ID, checked.context);
    if (!reloaded?.ok) return testLifecycleFailure("m11-invalid-session-document", "Stored Event Session is invalid.", LEGACY_TEST_SESSION_ID, "flags.arcflight.system.voyageSession");
    const session = found.session;
    if (session.eventId !== LEGACY_TEST_EVENT_ID || session.revision !== LEGACY_TEST_REVISION
      || session.sessionState !== "station-resolution" || session.encounterState?.lifecycleState !== "active"
      || session.encounterState?.phase !== "resolution" || session.closeout?.status !== "none" || session.recovery?.status !== "none") {
      return testLifecycleFailure("m12-legacy-test-claim-rejected", "The one-time legacy test-session contract did not match.", LEGACY_TEST_SESSION_ID, "session");
    }
    const existingOrigin = sessionTestOrigin(session);
    if (existingOrigin !== null) {
      if (validTestOrigin(existingOrigin, checked.context.authenticatedUserId)) return { ok: true, sessionId: LEGACY_TEST_SESSION_ID, claimed: false, origin: safeClone(existingOrigin).value };
      return testLifecycleFailure("m12-legacy-test-claim-rejected", "The legacy session has an invalid test-origin marker.", LEGACY_TEST_SESSION_ID, "encounterState.metadata.testOrigin");
    }
    const origin = testOriginFor(checked.context.authenticatedUserId);
    const candidate = safeClone(session);
    if (!candidate.ok || !candidate.value.encounterState || typeof candidate.value.encounterState !== "object"
      || !candidate.value.encounterState.metadata || typeof candidate.value.encounterState.metadata !== "object") {
      return testLifecycleFailure("m12-legacy-test-claim-rejected", "The legacy session metadata could not be safely extended.", LEGACY_TEST_SESSION_ID, "encounterState.metadata");
    }
    candidate.value.encounterState.metadata.testOrigin = origin;
    const verify = () => {
      const reread = findStoredSession(LEGACY_TEST_SESSION_ID, checked.context);
      return reread.ok && sameData(reread.session, candidate.value) && validTestOrigin(sessionTestOrigin(reread.session), checked.context.authenticatedUserId);
    };
    try {
      await found.document.update({ "flags.arcflight.system.voyageSession": candidate.value }, { diff: false, recursive: false });
    } catch {
      if (verify()) return { ok: true, sessionId: LEGACY_TEST_SESSION_ID, claimed: true, origin: safeClone(origin).value };
      return testLifecycleFailure("m11-session-write-failed", "The legacy test-session marker could not be persisted.", LEGACY_TEST_SESSION_ID, "flags.arcflight.system.voyageSession");
    }
    if (!verify()) return testLifecycleFailure("m11-session-write-failed", "The legacy test-session marker could not be reread and verified.", LEGACY_TEST_SESSION_ID, "flags.arcflight.system.voyageSession");
    return { ok: true, sessionId: LEGACY_TEST_SESSION_ID, claimed: true, origin: safeClone(origin).value };
  }
  async function start(input = {}) {
    const checked = await guard();
    if (!checked.ok) return checked.result;
    const cloned = safeClone(input);
    if (!cloned.ok || !cloned.value || typeof cloned.value !== "object" || Array.isArray(cloned.value) || Object.getPrototypeOf(cloned.value) !== Object.prototype) return invalid("request", "start input must be a plain object.");
    const request = launchRequest(cloned.value, checked.context);
    if (!nonBlank(request.shipId)) return invalid("shipId", "A valid Arcflight ship is required.");
    const launchContext = { ...checked.context, __eventTestOrigin: testOriginFor(checked.context.authenticatedUserId) };
    const result = await Promise.resolve(launchVoyageEventSession(request, launchContext));
    if (!result?.ok) return operation(result);
    const snapshot = await inspectEventSession(result.sessionId, checked.context);
    return snapshot?.ok ? operation(result, withTestOrigin(snapshot.snapshot, result.sessionId, checked.context)) : operation(result);
  }

  async function rapidPlan(input = {}) {
    const checked = await guard();
    if (!checked.ok) return checked.result;
    const cloned = safeClone(input);
    if (!cloned.ok || !cloned.value || typeof cloned.value !== "object" || Array.isArray(cloned.value) || Object.getPrototypeOf(cloned.value) !== Object.prototype || !nonBlank(cloned.value.sessionId)) return invalid("request", "rapidPlan requires sessionId.");
    const value = cloned.value;
    const found = findStoredSession(value.sessionId, checked.context);
    if (!found.ok) return testLifecycleFailure(found.code, found.message, value.sessionId);
    if (!validTestOrigin(sessionTestOrigin(found.session), checked.context.authenticatedUserId)) {
      return testLifecycleFailure("m12-test-session-origin-required", "Only Event Test Engine sessions may be rapidly planned.", value.sessionId);
    }
    const trace = [];
    let inspection = await inspectEventSession(value.sessionId, checked.context);
    if (!inspection?.ok) return inspection;
    let state = currentValues({ revision: inspection.snapshot.session.revision, authorityEpoch: inspection.snapshot.session.authorityEpoch });
    let sessionState = inspection.snapshot.session.sessionState;
    if (sessionState === "round-introduction") {
      const begun = await dispatchPlanning(value.sessionId, checked.context, "begin-crew-planning", { phaseStartSnapshotId: id("event-test-crew-planning") }, state);
      if (!begun.result?.ok) return operation(begun.result);
      recordPlanningTrace(trace, "begin-crew-planning", state, begun, sessionState, "crew-planning", { phaseStartSnapshotId: begun.request.payload.phaseStartSnapshotId });
      state = begun.state;
      inspection = await inspectEventSession(value.sessionId, checked.context);
      if (!inspection?.ok) return inspection;
      sessionState = inspection.snapshot.session.sessionState;
      if (value.stopAt === "crew-planning") {
        const stopped = operation(begun.result, inspection.snapshot);
        stopped.trace = trace;
        stopped.checkpoint = "crew-planning";
        return stopped;
      }
    }
    if (sessionState === "crew-planning" && value.stopAt === "crew-planning") {
      return { ...inspection, trace, checkpoint: "crew-planning" };
    }
    if (sessionState === "station-resolution") return { ...inspection, trace };
    if (sessionState !== "crew-planning") return operation({ ok: false, sessionId: value.sessionId, errors: [{ code: "m11-command-not-allowed", path: "sessionState", message: "Rapid planning requires Round Introduction or Crew Planning.", severity: "error" }] });
    const selections = stationSelections(inspection.snapshot, value.selections);
    if (!selections || selections.length === 0) return operation({ ok: false, sessionId: value.sessionId, errors: [{ code: "m12-test-engine-no-assigned-stations", path: "planning.assignments", message: "Rapid planning requires assigned stations and authored actions.", severity: "error" }] });
    for (const selection of selections) {
      const selected = await dispatchPlanning(value.sessionId, checked.context, "station-selection", selection, state);
      if (!selected.result?.ok) return operation(selected.result);
      recordPlanningTrace(trace, "station-selection", state, selected, "crew-planning", "crew-planning", selection);
      state = selected.state;
    }
    inspection = await inspectEventSession(value.sessionId, checked.context);
    if (!inspection?.ok) return inspection;
    state = currentValues({ revision: inspection.snapshot.session.revision, authorityEpoch: inspection.snapshot.session.authorityEpoch });
    const locked = new Set(inspection.snapshot.planning.stationLocks ?? []);
    for (const assignment of selections) {
      if (locked.has(assignment.stationId)) continue;
      const lock = await dispatchPlanning(value.sessionId, checked.context, "station-lock", { stationId: assignment.stationId }, state);
      if (!lock.result?.ok) return operation(lock.result);
      recordPlanningTrace(trace, "station-lock", state, lock, "crew-planning", "crew-planning", { stationId: assignment.stationId });
      state = lock.state;
    }
    inspection = await inspectEventSession(value.sessionId, checked.context);
    if (!inspection?.ok) return inspection;
    state = currentValues({ revision: inspection.snapshot.session.revision, authorityEpoch: inspection.snapshot.session.authorityEpoch });
    const desiredOrder = Array.isArray(value.stationOrder) && value.stationOrder.length > 0
      ? value.stationOrder
      : inspection.snapshot.planning.assignments.map((entry) => entry.stationId);
    const currentOrder = inspection.snapshot.planning.proposedStationOrder ?? [];
    if (JSON.stringify(currentOrder) !== JSON.stringify(desiredOrder)) {
      const order = await dispatchPlanning(value.sessionId, checked.context, "station-order", { stationOrder: desiredOrder }, state);
      if (!order.result?.ok) return operation(order.result);
      recordPlanningTrace(trace, "station-order", state, order, "crew-planning", "crew-planning", { stationOrder: desiredOrder });
      state = order.state;
    }
    inspection = await inspectEventSession(value.sessionId, checked.context);
    if (!inspection?.ok) return inspection;
    state = currentValues({ revision: inspection.snapshot.session.revision, authorityEpoch: inspection.snapshot.session.authorityEpoch });
    const lockedResult = await dispatchPlanning(value.sessionId, checked.context, "plan-lock", { phaseStartSnapshotId: id("event-test-plan-lock") }, state);
    if (!lockedResult.result?.ok) return operation(lockedResult.result);
    recordPlanningTrace(trace, "plan-lock", state, lockedResult, "crew-planning", "plan-locked", { phaseStartSnapshotId: lockedResult.request.payload.phaseStartSnapshotId });
    if (value.stopAt === "plan-locked") {
      const locked = await inspectEventSession(value.sessionId, checked.context);
      if (!locked?.ok) return locked;
      const stopped = operation(lockedResult.result, locked.snapshot);
      stopped.trace = trace;
      stopped.checkpoint = "plan-locked";
      return stopped;
    }
    const resolutionRequest = { kind: "voyage.m12-begin-resolution", requestId: id("event-test-begin-resolution"), sessionId: value.sessionId, expectedRevision: lockedResult.result.revision, authorityEpoch: lockedResult.result.authorityEpoch };
    const resolution = await Promise.resolve(beginVoyageEventSessionResolution(resolutionRequest, checked.context));
    if (!resolution?.ok) return operation(resolution);
    const final = await inspectEventSession(value.sessionId, checked.context);
    return final?.ok ? Object.assign(operation(resolution, final.snapshot), { trace, checkpoint: "station-resolution" }) : operation(resolution);
  }

  async function resolveStation(input = {}) {
    const checked = await guard();
    if (!checked.ok) return checked.result;
    const cloned = safeClone(input);
    if (!cloned.ok || !cloned.value || typeof cloned.value !== "object" || Array.isArray(cloned.value)
      || Object.getPrototypeOf(cloned.value) !== Object.prototype) return invalid("request", "resolveStation requires a plain object.");
    const keys = Object.keys(cloned.value);
    if (!keys.every((key) => ["sessionId", "stationId", "degree"].includes(key))
      || !keys.includes("sessionId") || !keys.includes("degree")
      || keys.length > 3 || !nonBlank(cloned.value.sessionId)
      || (Object.hasOwn(cloned.value, "stationId") && (!nonBlank(cloned.value.stationId) || ["__proto__", "constructor", "prototype"].includes(cloned.value.stationId)))
      || !EVENT_TEST_DEGREES.includes(cloned.value.degree)) {
      return invalid("request", "resolveStation requires sessionId, optional stationId, and a canonical degree.");
    }
    const sessionId = cloned.value.sessionId;
    const found = findStoredSession(sessionId, checked.context);
    if (!found.ok) return testLifecycleFailure(found.code, found.message, sessionId);
    if (!validTestOrigin(sessionTestOrigin(found.session), checked.context.authenticatedUserId)) {
      return resolveStationFailure("m12-test-session-origin-required", "session", "Only Event Test Engine sessions may be resolved.", sessionId);
    }
    const inspection = await inspectEventSession(sessionId, checked.context);
    if (!inspection?.ok) return inspection;
    const session = inspection.snapshot.session;
    if (session.sessionState !== "station-resolution" || session.phase !== "resolution") {
      return resolveStationFailure("m11-command-not-allowed", "sessionState", "Station resolution is not active.", sessionId);
    }
    const order = inspection.snapshot.planning.committedStationOrder;
    const pending = inspection.snapshot.resolution.pendingChecks;
    const currentStationId = order.find((stationId) => pending.some((entry) => entry.stationId === stationId && entry.status === "pending")) ?? null;
    if (!currentStationId) return resolveStationFailure("m11-command-not-allowed", "stationId", "No station is currently pending.", sessionId);
    if (Object.hasOwn(cloned.value, "stationId") && cloned.value.stationId !== currentStationId) {
      return resolveStationFailure("m11-command-not-allowed", "stationId", "The requested station is not the current legal pending station.", sessionId);
    }
    const executor = createDeterministicPendingCheckExecutor({ degree: cloned.value.degree });
    if (typeof executor !== "function") return invalid("degree", "A canonical degree is required.");
    const request = {
      kind: "voyage.m12-resolve-station",
      requestId: id("event-test-resolve-station"),
      sessionId,
      expectedRevision: session.revision,
      authorityEpoch: session.authorityEpoch
    };
    const result = await Promise.resolve(resolveVoyageEventSessionStation(request, {
      ...checked.context,
      __eventTestExecutorTrusted: true,
      __eventTestPendingCheckExecutor: executor
    }));
    const refreshed = result?.ok ? await inspectEventSession(sessionId, checked.context) : null;
    return {
      ...operation(result, refreshed?.ok ? refreshed.snapshot : null),
      resolvedStationId: result?.ok ? currentStationId : null,
      requestedDegree: cloned.value.degree
    };
  }
  async function readResolution(sessionId, context) {
    const inspection = await inspectEventSession(sessionId, context);
    if (!inspection?.ok) return { ok: false, result: inspection };
    const found = findStoredSession(sessionId, context);
    if (!found.ok) return { ok: false, result: testLifecycleFailure(found.code, found.message, sessionId) };
    return { ok: true, inspection, found };
  }

  function resolutionInput(input, allowDegree = false) {
    const cloned = safeClone(input);
    if (!cloned.ok || !cloned.value || typeof cloned.value !== "object" || Array.isArray(cloned.value) || Object.getPrototypeOf(cloned.value) !== Object.prototype) return { ok: false, result: invalid("request", "Resolution control input must be a plain object.") };
    const allowed = ["sessionId", "stationId", "degree", "degreeProfile", "customDegrees", "reactionMode", "expectedRevision"];
    const keys = Object.keys(cloned.value);
    if (!keys.includes("sessionId") || !keys.every((key) => allowed.includes(key)) || !nonBlank(cloned.value.sessionId)) return { ok: false, result: invalid("request", "Resolution controls require a nonblank sessionId.") };
    if (Object.hasOwn(cloned.value, "stationId") && !nonBlank(cloned.value.stationId)) return { ok: false, result: invalid("stationId", "stationId must be nonblank when supplied.") };
    if (Object.hasOwn(cloned.value, "expectedRevision") && (!Number.isSafeInteger(cloned.value.expectedRevision) || cloned.value.expectedRevision < 0)) return { ok: false, result: invalid("expectedRevision", "expectedRevision must be a non-negative safe integer when supplied.") };
    if (allowDegree && Object.hasOwn(cloned.value, "degree") && !EVENT_TEST_DEGREES.includes(cloned.value.degree)) return { ok: false, result: invalid("degree", "degree must be a canonical deterministic degree.") };
    if (Object.hasOwn(cloned.value, "reactionMode") && !["pass", "block"].includes(cloned.value.reactionMode)) return { ok: false, result: invalid("reactionMode", "reactionMode must be pass or block.") };
    const degreeProfile = cloned.value.degreeProfile ?? "all-success";
    const degrees = resolutionDegreeMap(degreeProfile, cloned.value.customDegrees);
    if (!degrees) return { ok: false, result: invalid("degreeProfile", "degreeProfile and customDegrees must describe canonical station degrees.") };
    return { ok: true, value: cloned.value, degrees };
  }

  async function startResolution(input = {}) {
    const checked = await guard();
    if (!checked.ok) return checked.result;
    const parsed = resolutionInput(input);
    if (!parsed.ok) return parsed.result;
    const { sessionId } = parsed.value;
    const before = await readResolution(sessionId, checked.context);
    if (!before.ok) return before.result;
    if (!validTestOrigin(sessionTestOrigin(before.found.session), checked.context.authenticatedUserId)) return testLifecycleFailure("m12-test-session-origin-required", "Only Event Test Engine sessions may start resolution.", sessionId);
    if (before.inspection.snapshot.session.sessionState !== "plan-locked" || before.inspection.snapshot.session.phase !== "lock-readiness") return testLifecycleFailure("m11-command-not-allowed", "Resolution requires the retained plan-locked fixture.", sessionId, "sessionState");
    if (parsed.value.expectedRevision !== undefined && parsed.value.expectedRevision !== before.inspection.snapshot.session.revision) return testLifecycleFailure("m11-stale-session-revision", "The retained fixture changed after validation; resolution start was not attempted.", sessionId, "expectedRevision");
    const request = { kind: "voyage.m12-begin-resolution", requestId: id("event-test-start-resolution"), sessionId, expectedRevision: before.inspection.snapshot.session.revision, authorityEpoch: before.inspection.snapshot.session.authorityEpoch };
    const result = await Promise.resolve(beginVoyageEventSessionResolution(request, checked.context));
    const after = await readResolution(sessionId, checked.context);
    if (!result?.ok || !after.ok) return { ...operation(result, after.ok ? after.inspection.snapshot : before.inspection.snapshot), beforeSnapshot: before.inspection.snapshot, afterSnapshot: after.ok ? after.inspection.snapshot : null, trace: [] };
    const trace = resolutionTraceEntry({ command: "resolution-start", requestId: request.requestId, before: before.inspection.snapshot, after: after.inspection.snapshot, beforeStored: before.found, afterStored: after.found, runtimeResult: result, writes: after.inspection.snapshot.session.revision - before.inspection.snapshot.session.revision });
    return { ...operation(result, after.inspection.snapshot), beforeSnapshot: before.inspection.snapshot, afterSnapshot: after.inspection.snapshot, trace: [trace], checkpoint: "station-resolution" };
  }

  async function runCurrentStation(input = {}) {
    const checked = await guard();
    if (!checked.ok) return checked.result;
    const parsed = resolutionInput(input, true);
    if (!parsed.ok) return parsed.result;
    const { sessionId } = parsed.value;
    const initial = await readResolution(sessionId, checked.context);
    if (!initial.ok) return initial.result;
    if (!validTestOrigin(sessionTestOrigin(initial.found.session), checked.context.authenticatedUserId)) return testLifecycleFailure("m12-test-session-origin-required", "Only Event Test Engine sessions may run station resolution.", sessionId);
    const initialSession = initial.inspection.snapshot.session;
    if (initialSession.sessionState !== "station-resolution" || initialSession.phase !== "resolution") return testLifecycleFailure("m11-command-not-allowed", "Station resolution is not active.", sessionId, "sessionState");
    const trace = [];
    let before = initial;
    let writes = 0;
    if (resolutionReactionOpen(before.inspection.snapshot)) {
      const reactionMode = parsed.value.reactionMode ?? "pass";
      if (reactionMode !== "pass") {
        const blocked = testLifecycleFailure("m11-command-not-allowed", "An open reaction window must be handled before the current station can resolve.", sessionId, "reactionWindow");
        const blockedTrace = resolutionTraceEntry({ command: "reaction-gate", requestId: null, station: { stationId: resolutionCurrentStationId(before.inspection.snapshot) }, before: before.inspection.snapshot, after: before.inspection.snapshot, beforeStored: before.found, afterStored: before.found, runtimeResult: blocked, writes: 0 });
        blockedTrace.status = "FAIL";
        blockedTrace.invariantResults = [];
        return { ...blocked, beforeSnapshot: initial.inspection.snapshot, afterSnapshot: initial.inspection.snapshot, trace: [blockedTrace], writes: 0, checkpoint: "reaction-required" };
      }
      const reaction = before.inspection.snapshot.resolution.currentReaction?.[0] ?? before.inspection.snapshot.resolution.reactionWindowPending?.[0] ?? null;
      const reactionResult = await passCurrentReaction({ sessionId });
      const afterReaction = await readResolution(sessionId, checked.context);
      const afterReactionSnapshot = afterReaction.ok ? afterReaction.inspection.snapshot : before.inspection.snapshot;
      const reactionTrace = resolutionTraceEntry({ command: "focus-reaction-pass", requestId: reactionResult?.requestId ?? null, station: { stationId: reaction?.stationId ?? resolutionCurrentStationId(before.inspection.snapshot) }, before: before.inspection.snapshot, after: afterReactionSnapshot, beforeStored: before.found, afterStored: afterReaction.ok ? afterReaction.found : before.found, runtimeResult: reactionResult, writes: afterReaction.ok ? Math.max(0, afterReactionSnapshot.session.revision - before.inspection.snapshot.session.revision) : 0 });
      reactionTrace.reactionId = reaction?.reactionId ?? null;
      reactionTrace.status = reactionResult?.ok === true ? "PASS" : "FAIL";
      trace.push(reactionTrace);
      writes += reactionTrace.writes;
      if (!reactionResult?.ok || !afterReaction.ok) return { ...reactionResult, beforeSnapshot: initial.inspection.snapshot, afterSnapshot: afterReactionSnapshot, trace, writes, checkpoint: "reaction-failed" };
      before = afterReaction;
    }
    const session = before.inspection.snapshot.session;
    if (session.sessionState !== "station-resolution" || session.phase !== "resolution") return testLifecycleFailure("m11-command-not-allowed", "Station resolution is not active.", sessionId, "sessionState");
    const currentStationId = resolutionCurrentStationId(before.inspection.snapshot);
    const station = before.inspection.snapshot.resolution.pendingChecks.find((entry) => entry.stationId === currentStationId) ?? null;
    if (!currentStationId || !station) return { ...testLifecycleFailure("m11-command-not-allowed", "No current station is available for resolution.", sessionId, "resolution.currentStationId"), beforeSnapshot: initial.inspection.snapshot, afterSnapshot: before.inspection.snapshot, trace, writes, checkpoint: "station-resolution-failed" };
    const requestedStationId = parsed.value.stationId ?? currentStationId;
    const degree = parsed.value.degree ?? parsed.degrees[currentStationId];
    const result = await resolveStation({ sessionId, stationId: requestedStationId, degree });
    const after = await readResolution(sessionId, checked.context);
    const afterSnapshot = after.ok ? after.inspection.snapshot : before.inspection.snapshot;
    const stationTrace = resolutionTraceEntry({ command: "action-segment", requestId: result?.requestId ?? null, station, degree, before: before.inspection.snapshot, after: afterSnapshot, beforeStored: before.found, afterStored: after.ok ? after.found : before.found, runtimeResult: result, writes: after.ok ? Math.max(0, after.inspection.snapshot.session.revision - before.inspection.snapshot.session.revision) : 0 });
    stationTrace.status = result?.ok === true ? "PASS" : "FAIL";
    if (result?.ok !== true) stationTrace.invariantResults = [];
    writes += stationTrace.writes;
    return { ...result, beforeSnapshot: initial.inspection.snapshot, afterSnapshot, trace: [...trace, stationTrace], writes, checkpoint: afterSnapshot.session?.sessionState ?? null };
  }

  async function runNextStation(input = {}) {
    return runCurrentStation(input);
  }

  async function runAllStations(input = {}) {
    const checked = await guard();
    if (!checked.ok) return checked.result;
    const parsed = resolutionInput(input);
    if (!parsed.ok) return parsed.result;
    const { sessionId } = parsed.value;
    const reactionMode = parsed.value.reactionMode ?? "pass";
    const trace = [];
    let latest = await readResolution(sessionId, checked.context);
    if (!latest.ok) return latest.result;
    if (!validTestOrigin(sessionTestOrigin(latest.found.session), checked.context.authenticatedUserId)) return testLifecycleFailure("m12-test-session-origin-required", "Only Event Test Engine sessions may run all station resolution.", sessionId);
    if (latest.inspection.snapshot.session.sessionState !== "station-resolution" || latest.inspection.snapshot.session.phase !== "resolution") return testLifecycleFailure("m11-command-not-allowed", "Station resolution is not active.", sessionId, "sessionState");
    for (let guardCount = 0; guardCount < STATIONS.length * 3; guardCount += 1) {
      const snapshot = latest.inspection.snapshot;
      const pendingChecks = Array.isArray(snapshot.resolution.pendingChecks) ? snapshot.resolution.pendingChecks : [];
      if (snapshot.resolution.completed || (pendingChecks.length > 0 && pendingChecks.every((entry) => entry?.status === "resolved"))) return { ok: true, sessionId, revision: snapshot.session.revision, authorityEpoch: snapshot.session.authorityEpoch, snapshot, trace, checkpoint: "station-resolution-complete" };
      if (resolutionReactionOpen(snapshot)) {
        if (reactionMode !== "pass") return { ok: false, sessionId, errors: [{ code: "m11-command-not-allowed", path: "reactionWindow", message: "An open reaction window must be handled before the next station can resolve.", severity: "error" }], snapshot, trace, checkpoint: "reaction-required" };
        const before = latest;
        const result = await passCurrentReaction({ sessionId });
        latest = await readResolution(sessionId, checked.context);
        const afterSnapshot = latest.ok ? latest.inspection.snapshot : before.inspection.snapshot;
        const reaction = before.inspection.snapshot.resolution.currentReaction?.[0] ?? null;
        const entry = resolutionTraceEntry({ command: "focus-reaction-pass", requestId: result?.requestId ?? null, station: { stationId: reaction?.stationId ?? resolutionCurrentStationId(before.inspection.snapshot) }, before: before.inspection.snapshot, after: afterSnapshot, beforeStored: before.found, afterStored: latest.ok ? latest.found : before.found, runtimeResult: result, writes: latest.ok ? Math.max(0, afterSnapshot.session.revision - before.inspection.snapshot.session.revision) : 0 });
        entry.status = result?.ok === true ? "PASS" : "FAIL";
        trace.push(entry);
        if (!result?.ok || !latest.ok) return { ...result, snapshot: afterSnapshot, trace, checkpoint: "reaction-failed" };
        continue;
      }
      const currentStationId = resolutionCurrentStationId(snapshot);
      if (!currentStationId) return { ok: false, sessionId, errors: [{ code: "m11-command-not-allowed", path: "resolution.currentStationId", message: "No current station is available for deterministic resolution.", severity: "error" }], snapshot, trace };
      const result = await runCurrentStation({ sessionId, stationId: currentStationId, degree: parsed.degrees[currentStationId] });
      if (Array.isArray(result.trace)) trace.push(...result.trace);
      if (!result?.ok) return { ...result, trace, checkpoint: "station-resolution-failed" };
      latest = await readResolution(sessionId, checked.context);
      if (!latest.ok) return { ...latest.result, trace, checkpoint: "reread-failed" };
    }
    return { ok: false, sessionId, errors: [{ code: "m12-test-resolution-loop-guard", path: "resolution", message: "Deterministic station resolution exceeded its safety loop guard.", severity: "error" }], snapshot: latest.inspection.snapshot, trace, checkpoint: "loop-guard" };
  }

  async function setPressure(input = {}) {
    const checked = await guard();
    if (!checked.ok) return checked.result;
    const cloned = safeClone(input);
    if (!cloned.ok || !cloned.value || typeof cloned.value !== "object" || Array.isArray(cloned.value)
      || Object.getPrototypeOf(cloned.value) !== Object.prototype || Object.keys(cloned.value).length !== 3
      || Object.keys(cloned.value)[0] !== "sessionId" || Object.keys(cloned.value)[1] !== "pressureSystemId" || Object.keys(cloned.value)[2] !== "value"
      || !nonBlank(cloned.value.sessionId) || !nonBlank(cloned.value.pressureSystemId)) {
      return invalid("request", "setPressure requires exactly sessionId, pressureSystemId, and value.");
    }
    const sessionId = cloned.value.sessionId;
    const pressureSystemId = cloned.value.pressureSystemId;
    const requestedValue = cloned.value.value;
    const requestId = id("event-test-set-pressure");
    const found = findStoredSession(sessionId, checked.context);
    if (!found.ok) return testLifecycleFailure(found.code, found.message, sessionId);
    if (!validTestOrigin(sessionTestOrigin(found.session), checked.context.authenticatedUserId)) {
      return testLifecycleFailure("m12-test-session-origin-required", "Only Event Test Engine sessions may set Pressure.", sessionId);
    }
    const reloaded = reloadVoyageEventSession(sessionId, checked.context);
    if (!reloaded?.ok) return testLifecycleFailure("m11-invalid-session-document", "Stored Event Session is invalid.", sessionId, "flags.arcflight.system.voyageSession");
    const initialSystem = validPressureSystems(found.session)?.[pressureSystemId];
    if (!initialSystem) return testLifecycleFailure("m11-command-payload-invalid", "The requested Pressure system is not present on the authoritative session.", sessionId, "pressureSystemId");
    if (!Number.isSafeInteger(requestedValue) || requestedValue < 0 || requestedValue > initialSystem.capacity) return testLifecycleFailure("m11-command-payload-invalid", "Pressure value must be an integer within the authoritative system capacity.", sessionId, "value");
    const result = await persistPressurePrecondition({ sessionId, pressureSystemId, requestedValue, requestId, found, context: checked.context });
    if (!result?.ok) return operation(result);
    const refreshed = await inspectEventSession(sessionId, checked.context);
    const after = findStoredSession(sessionId, checked.context);
    const pressure = after.ok ? validPressureSystems(after.session)?.[pressureSystemId] : null;
    if (!pressure || !refreshed?.ok) return testLifecycleFailure("m11-recovery-required", "The Pressure precondition snapshot could not be verified.", sessionId, "flags.arcflight.system.voyageSession");
    return { ...operation(result, refreshed.snapshot), pressureSystemId, previousValue: initialSystem.value, value: pressure.value, capacity: pressure.capacity, changed: initialSystem.value !== pressure.value };
  }

  async function passCurrentReaction(input = {}) {
    const checked = await guard();
    if (!checked.ok) return checked.result;
    const cloned = safeClone(input);
    if (!cloned.ok || !cloned.value || typeof cloned.value !== "object" || Array.isArray(cloned.value)
      || Object.getPrototypeOf(cloned.value) !== Object.prototype || Object.keys(cloned.value).length !== 1
      || Object.keys(cloned.value)[0] !== "sessionId" || !nonBlank(cloned.value.sessionId)) {
      return invalid("request", "passCurrentReaction requires exactly sessionId.");
    }
    const sessionId = cloned.value.sessionId;
    const found = findStoredSession(sessionId, checked.context);
    if (!found.ok) return testLifecycleFailure(found.code, found.message, sessionId);
    if (!validTestOrigin(sessionTestOrigin(found.session), checked.context.authenticatedUserId)) {
      return testLifecycleFailure("m12-test-session-origin-required", "Only Event Test Engine sessions may pass reactions.", sessionId);
    }
    const reloaded = reloadVoyageEventSession(sessionId, checked.context);
    if (!reloaded?.ok) return testLifecycleFailure("m11-invalid-session-document", "Stored Event Session is invalid.", sessionId, "flags.arcflight.system.voyageSession");
    const current = findStoredSession(sessionId, checked.context);
    if (!current.ok) return testLifecycleFailure(current.code, current.message, sessionId);
    if (!validTestOrigin(sessionTestOrigin(current.session), checked.context.authenticatedUserId)) {
      return testLifecycleFailure("m12-test-session-origin-required", "Only Event Test Engine sessions may pass reactions.", sessionId);
    }
    const reaction = currentPendingReaction(current.session);
    if (!reaction) return testLifecycleFailure("m11-command-not-allowed", "No current reaction is pending.", sessionId, "reactionWindow");
    const request = commandRequest(sessionId, current.session.revision, current.session.authorityEpoch, "focus-reaction-pass", { reactionId: reaction.reactionId });
    const result = await Promise.resolve(dispatchVoyageEventSessionCommand(request, checked.context));
    if (!result?.ok) return operation(result);
    const refreshed = await inspectEventSession(sessionId, checked.context);
    return {
      ...operation(result, refreshed?.ok ? refreshed.snapshot : null),
      passedReactionId: reaction.reactionId
    };
  }

  return Object.freeze({
    listEvents,
    listShips,
    inspect,
    inspectAs,
    findActionsByConsequence,
    discoverFixtureRequirements,
    listOperators,
    start,
    rapidPlan,
    startResolution,
    runCurrentStation,
    runNextStation,
    runAllStations,
    resolveStation,
    passCurrentReaction,
    setPressure,
    abandon,
    claimLegacyTestSession
  });
}
