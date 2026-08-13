import { createVoyageEventSession, reloadVoyageEventSession, runExclusiveSessionMutation } from "./event-session-runtime.js";
import { applyVoyageEncounterActivation } from "../domain/activation-application.js";
import { applyVoyageEncounterCrewPlanningTransition } from "../domain/crew-planning-transition.js";
import { applyVoyageEncounterReadyTransition } from "../domain/readiness-application.js";
import { createVoyageEncounterState } from "../domain/state.js";
import { createDraftVoyageEncounterDefaults } from "../domain/defaults.js";
import { applyVoyageEncounterStationAssignments } from "../domain/station-assignments-application.js";
import { applyContextPreservingVoyageLifecycleTransition } from "../domain/lifecycle-application.js";
import { analyzeVoyageStationAssignments } from "../domain/station-assignments.js";
import { ARCFLIGHT_SHIP_ACTOR_TYPE } from "../../documents/ships.js";
import { M12_DEFINITION_SNAPSHOT_ID, M12_EVENT_ID, M12_EVENT_PRESENTATION, M12_STATION_IDS, getM12EventDefinition, validateM12EventDefinition } from "../m12/event-definition.js";

const LAUNCH_FIELDS = Object.freeze(["kind", "requestId", "sessionId", "expectedRevision", "authorityEpoch", "eventId", "definitionSnapshotId", "shipId", "operatorSelections"]);
const LAUNCH_KIND = "voyage.m12-launch-event";
const M12_RUNTIME_EVENT_FIELDS = Object.freeze(["type", "sessionId", "eventId", "definitionSnapshotId", "shipId", "transitionKind", "previousSessionState", "nextSessionState", "previousEncounterRevision", "encounterRevision", "previousRevision", "revision"]);
const ACTIVE_SESSION_CONFLICT = Object.freeze({ code: "m12-active-session-conflict", path: "sessionId", message: "An active Event Session already exists. Complete or abort it before launching another.", severity: "error" });
const M12_LAUNCH_COORDINATION_ID = "arcflight-m12-event-launch-world";

function issue(code, path, message) { return { code, path, message, severity: "error" }; }
function validIsoTimestamp(value) { try { return typeof value === "string" && new Date(value).toISOString() === value; } catch { return false; } }
function response(requestId = null, sessionId = null, status = "failed", revision = null, authorityEpoch = null, errors = [], events = []) {
  return { ok: errors.length === 0, requestId, sessionId, status, revision, authorityEpoch, projection: null, events: structuredClone(events), errors: structuredClone(errors), warnings: [] };
}
function isPlainObject(value) { try { if (value === null || typeof value !== "object" || Array.isArray(value)) return false; const proto = Object.getPrototypeOf(value); return proto === Object.prototype || proto === null; } catch { return false; } }
function ownValue(value, key) { try { const descriptor = Object.getOwnPropertyDescriptor(value, key); return descriptor && descriptor.enumerable && Object.hasOwn(descriptor, "value") ? { present: true, value: descriptor.value } : { present: false, value: undefined }; } catch { return { present: false, value: undefined, failed: true }; } }
function capture(value, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return { ok: true, value };
  if (typeof value === "number") return Number.isFinite(value) ? { ok: true, value } : { ok: false, value: null };
  if (typeof value !== "object" || ancestors.has(value)) return { ok: false, value: null };
  let keys, proto, array;
  try { keys = Reflect.ownKeys(value); proto = Object.getPrototypeOf(value); array = Array.isArray(value); } catch { return { ok: false, value: null }; }
  if (!array && proto !== Object.prototype && proto !== null) return { ok: false, value: null };
  const next = new Set(ancestors); next.add(value);
  if (array) {
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (!lengthDescriptor || !Number.isSafeInteger(lengthDescriptor.value)) return { ok: false, value: null };
    const out = new Array(lengthDescriptor.value);
    for (let index = 0; index < out.length; index += 1) {
      if (!Object.hasOwn(value, index)) return { ok: false, value: null };
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      const nested = descriptor && Object.hasOwn(descriptor, "value") && descriptor.enumerable ? capture(descriptor.value, next) : { ok: false, value: null };
      if (!nested.ok) return nested;
      out[index] = nested.value;
    }
    for (const key of keys) if (key !== "length" && (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key))) return { ok: false, value: null };
    return { ok: true, value: out };
  }
  const out = {};
  for (const key of keys) {
    if (typeof key !== "string" || ["__proto__", "constructor", "prototype"].includes(key)) return { ok: false, value: null };
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) return { ok: false, value: null };
    const nested = capture(descriptor.value, next); if (!nested.ok) return nested; out[key] = nested.value;
  }
  return { ok: true, value: out };
}
function actorsFrom(context) {
  const source = context?.actors ?? globalThis.game?.actors;
  if (!source) return [];
  try { return typeof source.values === "function" ? [...source.values()] : Array.from(source); } catch { return []; }
}
function actorIdentity(actor) {
  const id = typeof actor?.id === "string" ? actor.id : "";
  const uuid = typeof actor?.uuid === "string" ? actor.uuid : id ? `Actor.${id}` : "";
  const name = typeof actor?.name === "string" && actor.name.trim() ? actor.name : id;
  return id && uuid ? { kind: "actor", id, uuid, name } : null;
}
function validShip(actor) {
  try { return actor?.type === "vehicle" && actor.getFlag?.("arcflight", "enabled") === true && actor.getFlag?.("arcflight", "actorType") === ARCFLIGHT_SHIP_ACTOR_TYPE; } catch { return false; }
}
function journalEntries(context) {
  try { const source = context?.journalEntries ?? globalThis.game?.journal; return source ? (typeof source.values === "function" ? [...source.values()] : Array.from(source)) : []; } catch { return []; }
}
function readSession(entry) { try { return entry?.__testSource?.flags?.arcflight?.system?.voyageSession ?? entry?.flags?.arcflight?.system?.voyageSession ?? entry?.toObject?.()?.flags?.arcflight?.system?.voyageSession ?? null; } catch { return null; } }
function findSession(context, sessionId) { return journalEntries(context).find((entry) => readSession(entry)?.sessionId === sessionId) ?? null; }
function hasActiveSession(context, excludedSessionId = null) {
  return journalEntries(context).some((entry) => {
    const session = readSession(entry);
    return session?.sessionId !== excludedSessionId
      && session?.encounterState?.lifecycleState === "active"
      && !["completed", "aborted"].includes(session?.sessionState);
  });
}
function fingerprint(value, auth) { return JSON.stringify([value.sessionId, auth, "gm", 0, 0, "m12-launch", { eventId: value.eventId, definitionSnapshotId: value.definitionSnapshotId, shipId: value.shipId, operatorSelections: M12_STATION_IDS.map((stationId) => [stationId, value.operatorSelections[stationId] === "" || value.operatorSelections[stationId] === undefined ? null : value.operatorSelections[stationId]]) }]); }
function activeGm(context) {
  const userId = context?.authenticatedUserId;
  const users = context?.users ?? globalThis.game?.users;
  let user = null;
  let values = [];
  try {
    values = users ? (Array.isArray(users) ? [...users] : Array.from(users.contents ?? users)) : [];
    user = values.find((entry) => entry?.id === userId) ?? (typeof users?.get === "function" ? users.get(userId) : null);
    const activeGms = values.filter((entry) => entry?.isGM === true && entry?.active === true);
    if (!context?.trustedTransportContext || typeof context?.authenticatedConnectionId !== "string" || !context.authenticatedConnectionId.trim() || !user?.isGM || user?.active !== true || context.activeGmUserId !== userId || activeGms.length !== 1 || activeGms[0]?.id !== userId) return null;
  } catch { return null; }
  return userId;
}
function actorsBySelection(actors, selection) { return actors.find((actor) => actor?.id === selection || actor?.uuid === selection) ?? null; }

export function listVoyageEventLaunchShips(actors = []) { try { return (Array.isArray(actors) ? actors : []).filter(validShip).map((actor) => ({ id: actor.id, uuid: actor.uuid ?? `Actor.${actor.id}`, name: actor.name ?? actor.id })); } catch { return []; } }

export function normalizeVoyageEventOperatorSelections(selections, actors = []) {
  try {
    if (!isPlainObject(selections)) return { valid: false, assignments: [], errors: [issue("m12-invalid-operator-selections", "operatorSelections", "Operator selections must be a plain object.")] };
    const keys = Reflect.ownKeys(selections);
    if (keys.some((key) => typeof key !== "string" || !M12_STATION_IDS.includes(key))) return { valid: false, assignments: [], errors: [issue("m12-invalid-operator-selections", "operatorSelections", "Operator selections contain an unexpected field.")] };
    const assignments = [];
    for (const stationId of M12_STATION_IDS) {
      const read = ownValue(selections, stationId); if (read.failed) return { valid: false, assignments: [], errors: [issue("m12-invalid-operator-selections", `operatorSelections.${stationId}`, "Operator selections could not be read safely.")] };
      const selected = read.present ? read.value : null;
      if (selected === null || selected === "") continue;
      if (typeof selected !== "string") return { valid: false, assignments: [], errors: [issue("m12-invalid-operator-selection", `operatorSelections.${stationId}`, "Operator selection must identify an Actor by id or UUID.")] };
      const identity = actorIdentity(actorsBySelection(actors, selected));
      if (!identity) return { valid: false, assignments: [], errors: [issue("m12-operator-not-found", `operatorSelections.${stationId}`, "Selected operator Actor was not found.")] };
      assignments.push({ stationId, operator: identity });
    }
    const report = analyzeVoyageStationAssignments(assignments);
    return report.valid ? { valid: true, assignments: report.assignments.filter(Boolean), errors: [] } : { valid: false, assignments: [], errors: report.errors };
  } catch { return { valid: false, assignments: [], errors: [issue("m12-invalid-operator-selections", "operatorSelections", "Operator selections could not be read safely.")] }; }
}

function buildInitialEncounter(eventDefinition, ship, assignments, sessionId) {
  const identity = {
    encounterId: eventDefinition.eventId,
    definitionId: eventDefinition.eventId,
    definitionRef: { eventId: eventDefinition.eventId, definitionSnapshotId: eventDefinition.definitionSnapshotId },
    primaryShip: { id: ship.id }
  };
  // M11 creation is intentionally limited to the canonical draft shape. The
  // configured opening state is built only after that draft is durably created.
  const draftDefaults = createDraftVoyageEncounterDefaults();
  const base = createVoyageEncounterState({ ...draftDefaults, ...identity }, { idGenerator: () => `${sessionId}-encounter` });
  const configured = createVoyageEncounterState({
    ...draftDefaults,
    ...identity,
    title: M12_EVENT_PRESENTATION.title,
    description: M12_EVENT_PRESENTATION.description,
    currentStage: { stageId: "m12-round-1-opening" },
    successConditions: [{ conditionId: "m12-survive-cinderwake" }],
    failureConditions: [{ conditionId: "m12-lose-the-wake" }],
    availableStations: structuredClone(eventDefinition.rounds?.[0]?.availableStations ?? M12_STATION_IDS.map((stationId) => ({ stationId, actions: [] }))),
    stationAssignments: []
  }, { idGenerator: () => `${sessionId}-encounter` });
  configured.currentStage = { stageId: "m12-round-1-opening" };
  return { base, configured, assignments };
}
function transitionOrNull(result) { return result?.ok && result.nextState ? result : null; }
function launchCandidate(initial, assignments, sessionId) {
  const assigned = transitionOrNull(applyVoyageEncounterStationAssignments(initial, assignments)); if (!assigned) return null;
  const configured = transitionOrNull(applyContextPreservingVoyageLifecycleTransition(assigned.nextState, "configuration")); if (!configured) return null;
  const ready = transitionOrNull(applyVoyageEncounterReadyTransition(configured.nextState)); if (!ready) return null;
  const active = transitionOrNull(applyVoyageEncounterActivation(ready.nextState, { roundStartSnapshotId: `${sessionId}-round-1`, phaseStartSnapshotId: `${sessionId}-situation` })); if (!active) return null;
  const planning = transitionOrNull(applyVoyageEncounterCrewPlanningTransition(active.nextState, { phaseStartSnapshotId: `${sessionId}-crew-planning` }));
  return planning;
}
function launchEvents(sessionId, eventId, definitionSnapshotId, shipId, states) {
  const transitions = [
    ["station-assignments", "setup", "setup", 0, 1], ["configuration", "setup", "setup", 1, 2], ["ready", "setup", "setup", 2, 3], ["activation", "setup", "round-introduction", 3, 4], ["crew-planning", "round-introduction", "crew-planning", 4, 5]
  ];
  return transitions.map(([transitionKind, previousSessionState, nextSessionState, previousEncounterRevision, encounterRevision], index) => ({ type: `voyage.m12-${transitionKind}`, sessionId, eventId, definitionSnapshotId, shipId, transitionKind, previousSessionState, nextSessionState, previousEncounterRevision, encounterRevision, previousRevision: index, revision: index + 1 }));
}
function launchPersistedExactly(documentIdValue, candidate, sessionId, context) {
  try {
    const matches = journalEntries(context).filter((entry) => entry?.id === documentIdValue);
    if (matches.length !== 1) return false;
    const stored = readSession(matches[0]);
    return stored !== null && JSON.stringify(stored) === JSON.stringify(candidate) && reloadVoyageEventSession(sessionId, context).ok;
  } catch { return false; }
}

async function cleanupCreatedLaunchDocument(document, expectedId, sessionId, beforeDocuments, context) {
  try {
    if (!document || document.id !== expectedId || beforeDocuments.some((entry) => entry === document || entry?.id === expectedId)) return false;
    await document.delete?.();
    const remaining = journalEntries(context);
    return !remaining.some((entry) => entry?.id === expectedId || readSession(entry)?.sessionId === sessionId);
  } catch { return false; }
}

export function buildVoyageEventManagerDashboardModel(projection, presentation = M12_EVENT_PRESENTATION, activeGmUserId = null) {
  if (!projection) return null;
  return { ...structuredClone(projection), eventTitle: presentation.title, eventDescription: presentation.description, activeGmUserId: typeof activeGmUserId === "string" ? activeGmUserId : "", shipName: projection.shipName ?? projection.primaryShip?.name ?? "", activeHazardCount: projection.activeHazards?.length ?? 0 };
}

export async function launchVoyageEventSession(request, context = {}) {
  const captured = capture(request); if (!captured.ok) return response(null, null, "failed", null, null, [issue("m12-hostile-data-capture-failed", "$", "Launch request could not be read safely.")]);
  const value = captured.value, requestId = value?.requestId ?? null, sessionId = value?.sessionId ?? null;
  if (!isPlainObject(value) || Object.keys(value).length !== LAUNCH_FIELDS.length || Object.keys(value).some((key, index) => key !== LAUNCH_FIELDS[index])) return response(requestId, sessionId, "failed", null, null, [issue("m12-invalid-request-shape", "request", "Launch request has an invalid exact shape.")]);
  if (value.kind !== LAUNCH_KIND) return response(requestId, sessionId, "failed", null, null, [issue("m12-invalid-mode", "request.kind", "Only the M12 launch mode is supported.")]);
  const auth = activeGm(context); if (!auth) return response(requestId, sessionId, "failed", null, null, [issue("m11-active-gm-required", "transport.connection", "An authenticated connected active GM is required.")]);
  if (![value.requestId, value.sessionId, value.eventId, value.definitionSnapshotId, value.shipId].every((entry) => typeof entry === "string" && entry.trim()) || !Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0 || !Number.isSafeInteger(value.authorityEpoch) || value.authorityEpoch < 0 || !isPlainObject(value.operatorSelections)) return response(requestId, sessionId, "failed", null, null, [issue("m12-invalid-request-shape", "request", "Launch request fields are invalid.")]);
  if (value.expectedRevision !== 0) return response(requestId, sessionId, "failed", null, null, [issue("m11-stale-session-revision", "expectedRevision", "Expected Event Session revision is stale.")]);
  if (value.authorityEpoch !== 0) return response(requestId, sessionId, "failed", null, null, [issue("m11-control-transfer-required", "authorityEpoch", "Event Session authority has changed.")]);
  if (value.eventId !== M12_EVENT_ID || value.definitionSnapshotId !== M12_DEFINITION_SNAPSHOT_ID) return response(requestId, sessionId, "failed", null, null, [issue("m12-event-definition-invalid", "request.eventId", "The selected event is not the registered Milestone 12 snapshot.")]);
  const fp = fingerprint(value, auth), beforeDocuments = journalEntries(context), documentIdValue = context.createDocumentId?.() ?? globalThis.foundry?.utils?.randomID?.();
  const descriptor = { sessionId: M12_LAUNCH_COORDINATION_ID, sessionDocumentId: M12_LAUNCH_COORDINATION_ID, expectedRevision: 0, expectedAuthorityEpoch: 0, authenticatedUserId: auth, connectionId: context.authenticatedConnectionId, activeGmUserId: auth };
  if (!documentIdValue || !context.authenticatedConnectionId) return response(requestId, sessionId, "failed", null, null, [issue("m11-cross-client-coordinator-required", "transport.coordinator", "A trusted cross-client mutation coordinator is required.")]);
  const identities = { requestId, sessionId };
  const launchResult = await runExclusiveSessionMutation(context, descriptor, async (witness) => {
    const currentAuth = activeGm(context); if (!currentAuth || currentAuth !== auth || context.authenticatedConnectionId !== descriptor.connectionId) return response(requestId, sessionId, "failed", null, null, [issue("m11-active-gm-required", "transport.connection", "An authenticated connected active GM is required.")]);
    const existing = findSession(context, sessionId);
    if (existing) {
      const stored = readSession(existing), record = stored?.processedRequests?.find((entry) => entry?.commandKind === "m12-launch" && entry.requestId === requestId);
      if (record) return record.fingerprint === fp ? structuredClone(record.response) : response(requestId, sessionId, "failed", null, null, [issue("m11-request-id-conflict", "request.requestId", "Request ID was previously used with different data.")]);
      return response(requestId, sessionId, "failed", null, null, [issue("m11-session-write-failed", "flags.arcflight.system.voyageSession", "An Event Session already exists for this launch.")]);
    }
    if (hasActiveSession(context, sessionId)) return response(requestId, sessionId, "failed", null, null, [ACTIVE_SESSION_CONFLICT]);
    const actors = actorsFrom(context), ship = actorsBySelection(actors, value.shipId); if (!validShip(ship)) return response(requestId, sessionId, "failed", null, null, [issue("m12-invalid-ship", "request.shipId", "Selected ship is not a valid Arcflight PF2e vehicle.")]);
    let definition; try { definition = typeof context.resolveEventDefinitionSnapshot === "function" ? await context.resolveEventDefinitionSnapshot(value.eventId, value.definitionSnapshotId) : getM12EventDefinition(); } catch { definition = null; }
    const definitionValidation = validateM12EventDefinition(definition); if (!definitionValidation.valid) return response(requestId, sessionId, "failed", null, null, definitionValidation.errors);
    const normalized = normalizeVoyageEventOperatorSelections(value.operatorSelections, actors); if (!normalized.valid) return response(requestId, sessionId, "failed", null, null, normalized.errors);
    const occurredAt = witness?.occurredAt; if (!validIsoTimestamp(occurredAt)) return response(requestId, sessionId, "failed", null, null, [issue("m12-launch-persistence-failed", "transport.timestamp", "A trusted launch timestamp is required.")]);
    const initialBundle = buildInitialEncounter(definition, ship, normalized.assignments, sessionId), planning = launchCandidate(initialBundle.configured, normalized.assignments, sessionId); if (!planning) return response(requestId, sessionId, "failed", null, null, [issue("m12-launch-transition-invalid", "request", "Canonical setup and activation transitions could not reach Crew Planning.")]);
    const createContext = { ...context, createDocumentId: () => documentIdValue, resolveEventDefinitionSnapshot: async () => structuredClone(definition), createInitialEncounterState: async () => structuredClone(initialBundle.base) };
    const created = await createVoyageEventSession({ kind: "voyage.m11-create-session", requestId: `${requestId}:create`, sessionId, eventId: value.eventId, definitionSnapshotId: value.definitionSnapshotId, shipId: value.shipId, eventDefinition: definition, initialEncounterState: initialBundle.base }, createContext); if (!created.ok) return response(requestId, sessionId, "failed", null, null, created.errors);
    const document = journalEntries(context).find((entry) => entry?.id === documentIdValue), stored = readSession(document); if (!document || !stored) return response(requestId, sessionId, "failed", null, null, [issue("m12-launch-persistence-failed", "flags.arcflight.system.voyageSession", "The created Event Session could not be reread.")]);
    const events = launchEvents(sessionId, value.eventId, value.definitionSnapshotId, value.shipId, planning.nextState), candidate = structuredClone(stored); candidate.revision = events.length; candidate.sessionState = "crew-planning"; candidate.encounterState = structuredClone(planning.nextState); candidate.events.push(...events);
    const launchResponse = response(requestId, sessionId, "crew-planning", candidate.revision, candidate.authorityEpoch, [], events); candidate.auditHistory.push({ auditId: `arcflight-voyage-audit:${JSON.stringify([candidate.sessionId, candidate.auditHistory.length, "m12-launch"])}`, kind: "m12-launch", sessionId, requestId, actorUserId: auth, authorityEpoch: candidate.authorityEpoch, previousRevision: candidate.revision - 1, revision: candidate.revision, occurredAt, details: { transitionKind: "launch", previousSessionState: "setup", nextSessionState: "crew-planning", previousEncounterRevision: 0, encounterRevision: candidate.encounterState.revision, eventCount: events.length } }); candidate.processedRequests.push({ requestId, principalUserId: auth, projectionKind: "gm", fingerprint: fp, commandKind: "m12-launch", resultKind: "launched", resultRevision: candidate.revision, response: launchResponse });
    try { await document.update({ "flags.arcflight.system.voyageSession": candidate }, { diff: false, recursive: false }); } catch { if (launchPersistedExactly(documentIdValue, candidate, sessionId, context)) return launchResponse; const cleaned = await cleanupCreatedLaunchDocument(document, documentIdValue, sessionId, beforeDocuments, context); return response(requestId, sessionId, "failed", null, null, [issue(cleaned ? "m12-launch-persistence-failed" : "m11-recovery-required", cleaned ? "flags.arcflight.system.voyageSession" : "recovery", cleaned ? "The Event Session launch could not be persisted." : "The Event Session requires recovery.")]); }
    if (launchPersistedExactly(documentIdValue, candidate, sessionId, context)) return launchResponse;
    const cleaned = await cleanupCreatedLaunchDocument(document, documentIdValue, sessionId, beforeDocuments, context); return response(requestId, sessionId, "failed", null, null, [issue(cleaned ? "m12-launch-persistence-failed" : "m11-recovery-required", cleaned ? "flags.arcflight.system.voyageSession" : "recovery", cleaned ? "The launched Event Session failed reread validation." : "The Event Session requires recovery.")]);
  }, identities, { nonWinnerCode: "m12-active-session-conflict", nonWinnerPath: "sessionId" });
  if (!launchResult?.ok && launchResult.errors?.[0]?.code === "m12-active-session-conflict") {
    // A coordinator loser cannot enter its callback; reread authoritative Journal state
    // before exposing the world-level active-session conflict.
    hasActiveSession(context, sessionId);
  }
  return launchResult;
}
