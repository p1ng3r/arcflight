import test from "node:test";
import assert from "node:assert/strict";
import { launchVoyageEventSession } from "../../../scripts/voyage/foundry/event-launcher.js";
import { getM12EventDefinition, M12_DEFINITION_SNAPSHOT_ID, M12_EVENT_ID, M12_FOCUS_ABILITIES } from "../../../scripts/voyage/m12/event-definition.js";
import { abortVoyageEventSession, applyVoyageEncounterAbortTransition, beginVoyageEventSessionResolution, correctVoyageEventSession, dispatchVoyageEventSessionCommand, readVoyageEventSessionMultiplayerProjection, readVoyageEventSessionResolution, reloadVoyageEventSession, resolveVoyageEventSessionStation, transferVoyageEventSessionControl } from "../../../scripts/voyage/foundry/event-session-runtime.js";
import { prepareVoyageEncounterActionExecutionRequests } from "../../../scripts/voyage/domain/resolution-execution-requests.js";
import { getFoundrySessionMutationCoordinator } from "../../../scripts/voyage/foundry/session-coordinator.js";
import { executeVoyagePlayerIntent, registerVoyageGmCommandTransport } from "../../../scripts/voyage/foundry/gm-command-transport.js";

function actor(id, type = "character") {
  return { id, uuid: `Actor.${id}`, name: id, type, getFlag: () => true };
}

function fixture() {
  const journals = [];
  const tracker = { creates: 0, updates: 0, gmJournalWrites: 0, actors: 0, distinctReread: false, jsonRoundTrip: false, throwUpdate: false, persistThenThrow: false };
  const document = (data, sharedSource = null) => {
    const source = sharedSource ?? { _id: data._id, flags: structuredClone(data.flags), name: "Session", pages: [] };
    const entry = { id: source._id, __testSource: source, toObject: () => structuredClone(source), async update(payload) { tracker.updates += 1; tracker.gmJournalWrites += 1; source.flags.arcflight.system.voyageSession = structuredClone(payload["flags.arcflight.system.voyageSession"]); if (tracker.distinctReread) { const index = journals.indexOf(entry); if (index >= 0) journals[index] = document(tracker.jsonRoundTrip ? JSON.parse(JSON.stringify({ _id: source._id, flags: source.flags })) : { _id: source._id, flags: source.flags }, source); } if (tracker.throwUpdate) { if (!tracker.persistThenThrow) delete source.flags.arcflight.system.voyageSession; throw new Error("update failed"); } return this; }, async delete() { journals.splice(journals.indexOf(entry), 1); } };
    return entry;
  };
  const actors = [actor("ship-1", "vehicle"), actor("captain"), actor("engineer"), actor("navigator")];
  actors[0].getFlag = (_module, key) => key === "enabled" ? true : "arcflightShip";
  const context = {
    authenticatedUserId: "gm-1", authenticatedConnectionId: "connection-gm-1", trustedTransportContext: true, activeGmUserId: "gm-1",
    users: [{ id: "gm-1", isGM: true, active: true }], actors, journalEntries: journals,
    createDocumentId: () => "Journal.resolution", createVoyageTimestamp: () => "2026-08-13T12:00:00.000Z",
    JournalEntry: { async create(data) { tracker.creates += 1; const entry = document(data); journals.push(entry); return entry; } },
    isJournalEntryDocument: () => true, resolveEventDefinitionSnapshot: async () => getM12EventDefinition(),
    async runExclusiveSessionMutation(_descriptor, callback) { return callback({ connectionId: "connection-gm-1", occurredAt: "2026-08-13T12:00:00.000Z" }); },
    applyVoyageEncounterAbortTransition
  };
  context.executeVoyagePf2ePendingCheck = async (pending) => ({ ok: true, status: "rolled", pendingCheckId: pending.pendingCheckId, sequence: pending.sequence, sourceKind: "character", sourceUuid: pending.source.uuid, statisticSlug: pending.statisticSlugOrAbilityId, dc: pending.finalDc, rollMode: "public", result: { total: pending.finalDc, degreeOfSuccess: 2, degreeOfSuccessSlug: "success" }, errors: [], warnings: [] });
  return { context, journals, tracker };
}

async function launchAndLock(fixtureValue, sessionId = "resolution-session", operatorSelections = { captain: "captain", engineer: "engineer" }, stationOrder = Object.keys(operatorSelections), riskBidSelections = {}) {
  const request = { kind: "voyage.m12-launch-event", requestId: "launch", sessionId, expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections };
  const launched = await launchVoyageEventSession(request, fixtureValue.context); assert.equal(launched.ok, true, JSON.stringify(launched.errors));
  const send = (requestId, expectedRevision, commandKind, payload) => dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId, sessionId, expectedRevision, authorityEpoch: 0, commandKind, payload }, fixtureValue.context);
  let revision = launched.revision;
  for (const stationId of stationOrder) {
    const actionId = stationId === "captain" && operatorSelections.navigator ? "captain-round-1-action-3" : `${stationId}-round-1-action-1`;
    const result = await send(`select-${stationId}`, revision, "station-selection", { stationId, actionId, approachId: `${actionId}-approach`, riskBidId: riskBidSelections[stationId] ?? null }); assert.equal(result.ok, true, JSON.stringify(result.errors)); revision = result.revision;
  }
  const order = await send("order", revision, "station-order", { stationOrder }); assert.equal(order.ok, true, JSON.stringify(order.errors)); revision = order.revision;
  const locked = await send("lock", revision, "plan-lock", { phaseStartSnapshotId: "resolution-plan-lock" }); assert.equal(locked.ok, true, JSON.stringify(locked.errors));
  return locked;
}

function operatorContext(fx, userId = "operator-1", connectionId = "connection-operator-1", operatorId = "navigator") {
  const operatorIds = Array.isArray(operatorId) ? operatorId : [operatorId];
  return {
    ...fx.context,
    authenticatedUserId: userId,
    authenticatedConnectionId: connectionId,
    users: [{ id: "gm-1", isGM: true, active: true }, { id: userId, isGM: false, active: true }],
    resolveVoyageOperatorForPrincipal: () => operatorIds.map((id) => ({ kind: "actor", id, uuid: `Actor.${id}`, name: id })),
    async runExclusiveSessionMutation(descriptor, callback) { return callback({ connectionId: descriptor.connectionId, occurredAt: "2026-08-13T12:00:00.000Z" }); }
  };
}

function snapshotEntry(source) {
  return { id: source._id, toObject: () => structuredClone(source), update: async () => { throw new Error("unexpected drift-test update"); } };
}

function contextWithRereadDrift(base, beforeSource, afterSource, switchAt = 4) {
  const context = { ...base };
  let reads = 0;
  Object.defineProperty(context, "journalEntries", { configurable: true, get: () => { reads += 1; return [snapshotEntry(reads < switchAt ? beforeSource : afterSource)]; } });
  return context;
}

test("M12 Task 3 enters Resolution, persists pending checks, rolls once, and reloads", async () => {
  const fx = fixture(); const locked = await launchAndLock(fx); assert.equal(locked.status, "plan-locked");
  const lockedProjection = readVoyageEventSessionResolution("resolution-session", fx.context);
  assert.equal(lockedProjection.projection.phase, "lock-readiness");
  assert.equal(lockedProjection.projection.stations.filter((station) => station.canRoll).length, 0);
  const direct = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "direct-before-start", sessionId: "resolution-session", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(direct.ok, false); assert.equal(direct.errors[0].code, "m11-command-not-allowed"); assert.equal(fx.tracker.updates, 5);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "begin-resolution", sessionId: "resolution-session", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const startedProjection = readVoyageEventSessionResolution("resolution-session", fx.context); assert.equal(startedProjection.projection.phase, "resolution");
  assert.equal(startedProjection.projection.stations.filter((station) => station.canRoll).length, 1);
  assert.equal(startedProjection.projection.stations.find((station) => station.current).canRoll, true);
  assert.equal(startedProjection.projection.stations.filter((station) => !station.current).every((station) => station.canRoll === false), true);
  const startReplay = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "begin-resolution", sessionId: "resolution-session", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.deepEqual(startReplay, started);
  let result = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "resolve-1", sessionId: "resolution-session", expectedRevision: started.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  const projection = readVoyageEventSessionResolution("resolution-session", fx.context); assert.equal(projection.ok, true, JSON.stringify(projection.errors));
  assert.equal(projection.projection.phase, "resolution"); assert.equal(projection.projection.sessionState, "station-resolution"); assert.equal(projection.projection.stations[0].status, "resolved");
  assert.equal(projection.projection.stations[0].result.degreeOfSuccessSlug, "success");
  assert.equal(projection.projection.stations[0].result.dc, 18);
  const replay = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "resolve-1", sessionId: "resolution-session", expectedRevision: started.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(replay.ok, true);
  assert.deepEqual(replay, result);
  assert.equal(reloadVoyageEventSession("resolution-session", fx.context).ok, true);
  assert.equal(fx.tracker.actors, 0);
});

test("M12 Task 3 accepts a persisted resolution start after a distinct Foundry reread", async () => {
  const fx = fixture(); fx.tracker.distinctReread = true; fx.tracker.jsonRoundTrip = true;
  const locked = await launchAndLock(fx);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "begin-distinct", sessionId: "resolution-session", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  assert.equal(started.status, "station-resolution");
  assert.equal(readVoyageEventSessionResolution("resolution-session", fx.context).projection.phase, "resolution");
  assert.equal(fx.tracker.updates, 7);
});

test("M12 Task 3 recognizes a persisted-then-thrown resolution start without a second write", async () => {
  const fx = fixture(); const locked = await launchAndLock(fx); fx.tracker.throwUpdate = true; fx.tracker.persistThenThrow = true;
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "begin-persisted-throw", sessionId: "resolution-session", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  assert.equal(started.status, "station-resolution");
  assert.equal(fx.tracker.updates, 7);
  assert.equal(readVoyageEventSessionResolution("resolution-session", fx.context).projection.phase, "resolution");
});

test("M12 Slice F exposes one shared committed order and current station to every player role", async () => {
  const fx = fixture();
  const locked = await launchAndLock(fx, "slice-f-resolution", { navigator: "navigator", captain: "captain", engineer: "engineer" }, ["navigator", "captain", "engineer"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-f-begin", sessionId: "slice-f-resolution", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const writesBeforeReads = fx.tracker.updates;
  const read = (context, requestId) => readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId, sessionId: "slice-f-resolution", expectedRevision: started.revision }, context);
  const gm = read(fx.context, "slice-f-gm");
  assert.equal(gm.ok, true, JSON.stringify(gm.errors));
  assert.deepEqual(gm.projection.sharedStationOrder, ["navigator", "captain", "engineer"]);
  assert.deepEqual(gm.projection.resolutionOrder, ["navigator", "captain", "engineer"]);
  assert.equal(gm.projection.resolutionStarted, true);
  assert.equal(gm.projection.currentActingStationId, "navigator");
  assert.equal(gm.projection.resolutionCurrentStationId, "navigator");
  assert.equal(gm.projection.resolutionOrderPosition, 1);
  assert.equal(gm.projection.resolutionTotalStations, 3);
  assert.deepEqual(gm.projection.resolutionStations.map((entry) => [entry.stationId, entry.status]), [["navigator", "current"], ["captain", "waiting"], ["engineer", "waiting"]]);
  const operatorContext = { ...fx.context, authenticatedUserId: "operator-1", authenticatedConnectionId: "connection-operator-1", users: [{ id: "gm-1", isGM: true, active: true }, { id: "operator-1", isGM: false, active: true }], resolveVoyageOperatorForPrincipal: () => ({ kind: "actor", id: "navigator", uuid: "Actor.navigator", name: "navigator" }) };
  const operator = read(operatorContext, "slice-f-operator");
  assert.equal(operator.ok, true, JSON.stringify(operator.errors));
  assert.equal(operator.projection.projectionRole, "operator");
  assert.equal(operator.projection.currentActingStationId, gm.projection.currentActingStationId);
  assert.deepEqual(operator.projection.resolutionOrder, gm.projection.resolutionOrder);
  const crewContext = { ...operatorContext, authenticatedUserId: "crew-1", authenticatedConnectionId: "connection-crew-1", users: [...operatorContext.users, { id: "crew-1", isGM: false, active: true }], resolveVoyageOperatorForPrincipal: () => ({ kind: "actor", id: "unassigned", uuid: "Actor.unassigned", name: "unassigned" }) };
  const crew = read(crewContext, "slice-f-crew");
  assert.equal(crew.ok, true, JSON.stringify(crew.errors));
  assert.equal(crew.projection.projectionRole, "crew");
  assert.equal(crew.projection.currentActingStationId, gm.projection.currentActingStationId);
  const observerContext = { ...crewContext, authenticatedUserId: "observer-1", authenticatedConnectionId: "connection-observer-1", users: [...crewContext.users, { id: "observer-1", isGM: false, active: true }], resolveVoyageOperatorForPrincipal: () => [] };
  const observer = read(observerContext, "slice-f-observer");
  assert.equal(observer.ok, true, JSON.stringify(observer.errors));
  assert.equal(observer.projection.projectionRole, "observer");
  assert.equal(observer.projection.currentActingStationId, gm.projection.currentActingStationId);
  assert.equal(fx.tracker.updates, writesBeforeReads);
});

test("M12 Slice F keeps Begin Resolution GM-authoritative and does not add player roll controls", async () => {
  const fx = fixture();
  const locked = await launchAndLock(fx, "slice-f-authority");
  const nonGmContext = { ...fx.context, authenticatedUserId: "operator-1", authenticatedConnectionId: "connection-operator-1", users: [{ id: "gm-1", isGM: true, active: true }, { id: "operator-1", isGM: false, active: true }] };
  const rejected = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-f-forged", sessionId: "slice-f-authority", expectedRevision: locked.revision, authorityEpoch: 0 }, nonGmContext);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.errors[0].code, "m11-active-gm-required");
  assert.equal(fx.tracker.updates, 5);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-f-valid", sessionId: "slice-f-authority", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const replay = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-f-valid", sessionId: "slice-f-authority", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.deepEqual(replay, started);
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  assert.equal(stored.sessionState, "station-resolution");
  assert.equal(stored.encounterState.pendingChecks.some((entry) => entry.result), false);
  assert.equal(stored.events.filter((entry) => entry.type === "voyage.m12-resolution-start").length, 1);
});

test("M12 Slice G current operator executes through the canonical Task 3 path exactly once", async () => {
  const fx = fixture();
  const locked = await launchAndLock(fx, "slice-g-player", { navigator: "navigator", captain: "captain", engineer: "engineer" }, ["navigator", "captain", "engineer"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-g-begin", sessionId: "slice-g-player", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  let executions = 0;
  fx.context.executeVoyagePf2ePendingCheck = async (pending) => { executions += 1; return { ok: true, status: "rolled", pendingCheckId: pending.pendingCheckId, sequence: pending.sequence, sourceKind: "character", sourceUuid: pending.source.uuid, statisticSlug: pending.statisticSlugOrAbilityId, dc: pending.finalDc, rollMode: "public", result: { total: pending.finalDc, degreeOfSuccess: 2, degreeOfSuccessSlug: "success" }, errors: [], warnings: [] }; };
  const player = operatorContext(fx);
  const projection = readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId: "slice-g-player-read", sessionId: "slice-g-player", expectedRevision: started.revision }, player);
  assert.equal(projection.ok, true, JSON.stringify(projection.errors));
  assert.equal(projection.projection.projectionRole, "operator");
  assert.equal(projection.projection.canExecuteCurrentStation, true);
  assert.equal(projection.projection.currentExecution.stationId, "navigator");
  assert.ok(projection.projection.currentExecution.actionName);
  assert.ok(projection.projection.currentExecution.approachName);
  assert.ok(projection.projection.currentExecution.statisticLabel);
  assert.equal("pendingCheckId" in projection.projection.currentExecution, false);
  const request = { kind: "voyage.m12-resolve-station", requestId: "slice-g-player-roll", sessionId: "slice-g-player", expectedRevision: started.revision, authorityEpoch: 0 };
  const rolled = await resolveVoyageEventSessionStation(request, player);
  assert.equal(rolled.ok, true, JSON.stringify(rolled.errors));
  assert.equal(executions, 1);
  const replay = await resolveVoyageEventSessionStation(request, player);
  assert.equal(replay.ok, true, JSON.stringify(replay.errors));
  assert.deepEqual(replay, rolled);
  assert.equal(executions, 1);
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.encounterState.pendingChecks.find((entry) => entry.stationId === "navigator").status, "resolved");
  const writes = fx.tracker.updates;
  const secondRequest = await resolveVoyageEventSessionStation({ ...request, requestId: "slice-g-player-roll-again", expectedRevision: rolled.revision }, player);
  assert.equal(secondRequest.ok, false);
  assert.equal(secondRequest.errors[0].code, "m11-projection-not-authorized");
  assert.equal(executions, 1);
  assert.equal(fx.tracker.updates, writes);
});

test("M12 Slice G replays only for a connected exact fingerprint", async () => {
  const fx = fixture();
  const locked = await launchAndLock(fx, "slice-g-replay", { navigator: "navigator", captain: "captain" }, ["navigator", "captain"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-g-replay-begin", sessionId: "slice-g-replay", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  let executions = 0;
  fx.context.executeVoyagePf2ePendingCheck = async (pending) => { executions += 1; return { ok: true, status: "rolled", pendingCheckId: pending.pendingCheckId, sequence: pending.sequence, sourceKind: "character", sourceUuid: pending.source.uuid, statisticSlug: pending.statisticSlugOrAbilityId, dc: pending.finalDc, rollMode: "public", result: { total: pending.finalDc, degreeOfSuccess: 2, degreeOfSuccessSlug: "success" }, errors: [], warnings: [] }; };
  const player = operatorContext(fx);
  const request = { kind: "voyage.m12-resolve-station", requestId: "slice-g-replay-roll", sessionId: "slice-g-replay", expectedRevision: started.revision, authorityEpoch: 0 };
  const first = await resolveVoyageEventSessionStation(request, player);
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  const writes = fx.tracker.updates;
  const stored = structuredClone(fx.journals[0].__testSource.flags.arcflight.system.voyageSession);
  const exact = await resolveVoyageEventSessionStation(request, player);
  assert.deepEqual(exact, first);
  assert.equal(executions, 1);
  assert.equal(fx.tracker.updates, writes);
  const changedRevision = await resolveVoyageEventSessionStation({ ...request, expectedRevision: first.revision }, player);
  assert.equal(changedRevision.ok, false);
  assert.equal(changedRevision.errors[0].code, "m11-request-id-conflict");
  const changedEpoch = await resolveVoyageEventSessionStation({ ...request, authorityEpoch: 1 }, player);
  assert.equal(changedEpoch.ok, false);
  assert.equal(changedEpoch.errors[0].code, "m11-request-id-conflict");
  const disconnected = await resolveVoyageEventSessionStation(request, { ...player, authenticatedConnectionId: null, trustedTransportContext: false });
  assert.equal(disconnected.ok, false);
  assert.equal(disconnected.errors[0].code, "m11-authentication-required");
  assert.equal(executions, 1);
  assert.equal(fx.tracker.updates, writes);
  assert.deepEqual(fx.journals[0].__testSource.flags.arcflight.system.voyageSession, stored);
});

test("M12 Slice G rejects foreign, future, crew, observer, forged, and stale station execution intents", async () => {
  const fx = fixture();
  const locked = await launchAndLock(fx, "slice-g-authority", { navigator: "navigator", captain: "captain", engineer: "engineer" }, ["navigator", "captain", "engineer"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-g-authority-begin", sessionId: "slice-g-authority", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const captain = operatorContext(fx, "captain-player", "connection-captain", "captain");
  const engineer = operatorContext(fx, "engineer-player", "connection-engineer", "engineer");
  const crew = { ...operatorContext(fx, "crew-player", "connection-crew", "unassigned"), resolveVoyageOperatorForPrincipal: () => ({ kind: "actor", id: "unassigned", uuid: "Actor.unassigned", name: "unassigned" }) };
  const observer = { ...crew, authenticatedUserId: "observer-player", authenticatedConnectionId: "connection-observer", users: [...crew.users, { id: "observer-player", isGM: false, active: true }], resolveVoyageOperatorForPrincipal: () => [] };
  const request = (requestId, context, extra = {}) => resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId, sessionId: "slice-g-authority", expectedRevision: started.revision, authorityEpoch: 0, ...extra }, context);
  for (const [label, context] of [["captain", captain], ["engineer", engineer], ["crew", crew], ["observer", observer]]) {
    const result = await request(`slice-g-${label}`, context);
    assert.equal(result.ok, false, label);
    assert.ok(["m11-projection-not-authorized", "m11-active-gm-required"].includes(result.errors[0].code), label);
  }
  const forged = await request("slice-g-forged-station", operatorContext(fx), { stationId: "captain" });
  assert.equal(forged.ok, false);
  assert.equal(forged.errors[0].code, "m11-invalid-request-shape");
  const stale = await request("slice-g-stale", operatorContext(fx), {});
  assert.equal(stale.ok, true, JSON.stringify(stale.errors));
  const staleAgain = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "slice-g-stale-new", sessionId: "slice-g-authority", expectedRevision: started.revision, authorityEpoch: 0 }, operatorContext(fx));
  assert.equal(staleAgain.ok, false);
  assert.equal(staleAgain.errors[0].code, "m11-stale-session-revision");
});

test("M12 Slice G GM execution remains canonical and player/GM contention rolls once", async () => {
  const fx = fixture();
  const locked = await launchAndLock(fx, "slice-g-contention", { navigator: "navigator", captain: "captain" }, ["navigator", "captain"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-g-contention-begin", sessionId: "slice-g-contention", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  let executions = 0;
  fx.context.executeVoyagePf2ePendingCheck = async (pending) => { executions += 1; await new Promise((resolve) => setTimeout(resolve, 5)); return { ok: true, status: "rolled", pendingCheckId: pending.pendingCheckId, sequence: pending.sequence, sourceKind: "character", sourceUuid: pending.source.uuid, statisticSlug: pending.statisticSlugOrAbilityId, dc: pending.finalDc, rollMode: "public", result: { total: pending.finalDc, degreeOfSuccess: 2, degreeOfSuccessSlug: "success" }, errors: [], warnings: [] }; };
  const player = operatorContext(fx);
  const request = { kind: "voyage.m12-resolve-station", requestId: "slice-g-contention-player", sessionId: "slice-g-contention", expectedRevision: started.revision, authorityEpoch: 0 };
  const [playerResult, gmResult] = await Promise.all([
    resolveVoyageEventSessionStation(request, player),
    resolveVoyageEventSessionStation({ ...request, requestId: "slice-g-contention-gm" }, fx.context)
  ]);
  assert.equal(executions, 1);
  assert.equal([playerResult, gmResult].filter((entry) => entry.ok).length, 1);
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  assert.equal(stored.encounterState.pendingChecks.filter((entry) => entry.status === "resolved").length, 1);
  assert.equal(stored.events.filter((entry) => entry.type === "voyage.m12-action-segment").length, 1);
});

test("M12 Slice G preserves the caller revision through deterministic reread drift", async () => {
  const fx = fixture();
  const locked = await launchAndLock(fx, "slice-g-revision-drift", { navigator: "navigator", captain: "captain" }, ["navigator", "captain"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-g-revision-begin", sessionId: "slice-g-revision-drift", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  const beforeSource = structuredClone(fx.journals[0].__testSource);
  const advanced = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "slice-g-revision-advance", sessionId: "slice-g-revision-drift", expectedRevision: started.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(advanced.ok, true, JSON.stringify(advanced.errors));
  const afterSource = structuredClone(fx.journals[0].__testSource);
  assert.equal(afterSource.flags.arcflight.system.voyageSession.revision, started.revision + 1);
  fx.journals[0].__testSource.flags = structuredClone(beforeSource.flags);
  let playerExecutions = 0;
  const player = operatorContext(fx);
  const executor = player.executeVoyagePf2ePendingCheck;
  player.executeVoyagePf2ePendingCheck = async (...args) => { playerExecutions += 1; return executor(...args); };
  const drifted = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "slice-g-revision-stale", sessionId: "slice-g-revision-drift", expectedRevision: started.revision, authorityEpoch: 0 }, contextWithRereadDrift(player, beforeSource, afterSource));
  assert.equal(drifted.ok, false);
  assert.equal(drifted.errors[0].code, "m11-stale-session-revision");
  assert.equal(playerExecutions, 0);
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.revision, started.revision);
});

test("M12 Slice G preserves the caller authority epoch through deterministic drift", async () => {
  const fx = fixture();
  const locked = await launchAndLock(fx, "slice-g-epoch-drift", { navigator: "navigator", captain: "captain" }, ["navigator", "captain"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-g-epoch-begin", sessionId: "slice-g-epoch-drift", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  const beforeSource = structuredClone(fx.journals[0].__testSource);
  const transferred = await transferVoyageEventSessionControl({ kind: "voyage.m11-transfer-control", requestId: "slice-g-epoch-advance", sessionId: "slice-g-epoch-drift", expectedRevision: started.revision, authorityEpoch: 0, targetUserId: "gm-1", reason: "epoch drift witness" }, fx.context);
  assert.equal(transferred.ok, true, JSON.stringify(transferred.errors));
  const afterSource = structuredClone(fx.journals[0].__testSource);
  assert.equal(afterSource.flags.arcflight.system.voyageSession.authorityEpoch, 1);
  fx.journals[0].__testSource.flags = structuredClone(beforeSource.flags);
  let playerExecutions = 0;
  const player = operatorContext(fx);
  const executor = player.executeVoyagePf2ePendingCheck;
  player.executeVoyagePf2ePendingCheck = async (...args) => { playerExecutions += 1; return executor(...args); };
  const drifted = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "slice-g-epoch-stale", sessionId: "slice-g-epoch-drift", expectedRevision: started.revision, authorityEpoch: 0 }, contextWithRereadDrift(player, beforeSource, afterSource));
  assert.equal(drifted.ok, false);
  assert.equal(drifted.errors[0].code, "m11-control-transfer-required");
  assert.equal(playerExecutions, 0);
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.authorityEpoch, 0);
});

test("M12 Slice G applies the existing pre-roll Focus gate to player execution", async () => {
  const fx = fixture();
  fx.context.focusAbilities = [...M12_FOCUS_ABILITIES];
  const locked = await launchAndLock(fx, "slice-g-player-focus", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-g-player-focus-begin", sessionId: "slice-g-player-focus", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  const player = operatorContext(fx, "captain-player", "connection-captain", "captain");
  let executions = 0;
  const executor = player.executeVoyagePf2ePendingCheck;
  player.executeVoyagePf2ePendingCheck = async (...args) => { executions += 1; return executor(...args); };
  const blocked = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "slice-g-player-focus-blocked", sessionId: "slice-g-player-focus", expectedRevision: started.revision, authorityEpoch: 0 }, player);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.errors[0].code, "m11-command-not-allowed");
  assert.equal(executions, 0);
  const projection = readVoyageEventSessionResolution("slice-g-player-focus", fx.context).projection;
  const passed = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "slice-g-player-focus-pass", sessionId: "slice-g-player-focus", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId: projection.reactionWindow.opportunities[0].reactionId } }, fx.context);
  assert.equal(passed.ok, true, JSON.stringify(passed.errors));
  const retried = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "slice-g-player-focus-retry", sessionId: "slice-g-player-focus", expectedRevision: passed.revision, authorityEpoch: 0 }, player);
  assert.equal(retried.ok, true, JSON.stringify(retried.errors));
  assert.equal(executions, 1);
});

test("M12 Slice G follows multi-owned operator authority by current station", async () => {
  const fx = fixture();
  fx.context.actors.push(actor("watchmaster"));
  const locked = await launchAndLock(fx, "slice-g-multi-owned", { captain: "captain", navigator: "navigator", watchmaster: "watchmaster" }, ["captain", "navigator", "watchmaster"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-g-multi-owned-begin", sessionId: "slice-g-multi-owned", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  const player = operatorContext(fx, "operator-1", "connection-operator-1", ["captain", "watchmaster"]);
  let executions = 0;
  const executor = player.executeVoyagePf2ePendingCheck;
  player.executeVoyagePf2ePendingCheck = async (...args) => { executions += 1; return executor(...args); };
  const captain = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "slice-g-multi-owned-captain", sessionId: "slice-g-multi-owned", expectedRevision: started.revision, authorityEpoch: 0 }, player);
  assert.equal(captain.ok, true, JSON.stringify(captain.errors));
  const navigatorProjection = readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId: "slice-g-multi-owned-nav-read", sessionId: "slice-g-multi-owned", expectedRevision: captain.revision }, player);
  assert.equal(navigatorProjection.projection.resolutionCurrentStationId, "navigator");
  assert.equal(navigatorProjection.projection.canExecuteCurrentStation, false);
  const navigator = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "slice-g-multi-owned-navigator", sessionId: "slice-g-multi-owned", expectedRevision: captain.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(navigator.ok, true, JSON.stringify(navigator.errors));
  const watchmasterProjection = readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId: "slice-g-multi-owned-watch-read", sessionId: "slice-g-multi-owned", expectedRevision: navigator.revision }, player);
  assert.equal(watchmasterProjection.projection.resolutionCurrentStationId, "watchmaster");
  assert.equal(watchmasterProjection.projection.canExecuteCurrentStation, true);
  const watchmaster = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "slice-g-multi-owned-watchmaster", sessionId: "slice-g-multi-owned", expectedRevision: navigator.revision, authorityEpoch: 0 }, player);
  assert.equal(watchmaster.ok, true, JSON.stringify(watchmaster.errors));
  assert.equal(executions, 2);
});

test("Slice H follows the current reaction opportunity for a player owning Captain and Watchmaster", async () => {
  const fx = fixture(); fx.context.actors.push(actor("watchmaster"));
  const captainFocus = structuredClone(M12_FOCUS_ABILITIES[0]);
  const navigatorFocus = { ...captainFocus, focusAbilityId: "m12-focus-navigator-assist", name: "Navigator's Sounding", stationId: "navigator", targetStationId: "navigator", eligibleSource: { kind: "station", stationId: "navigator" }, targetRule: { kind: "current-station", stationId: "navigator" }, narration: "The navigator sounds the shoals." };
  const watchmasterFocus = { ...captainFocus, focusAbilityId: "m12-focus-watchmaster-assist", name: "Watchmaster's Bearing", stationId: "watchmaster", targetStationId: "watchmaster", eligibleSource: { kind: "station", stationId: "watchmaster" }, targetRule: { kind: "current-station", stationId: "watchmaster" }, narration: "The watchmaster holds the bearing." };
  fx.context.focusAbilities = [captainFocus, navigatorFocus, watchmasterFocus];
  const sessionId = "slice-h-multi-owned-focus";
  const locked = await launchAndLock(fx, sessionId, { captain: "captain", navigator: "navigator", watchmaster: "watchmaster" }, ["captain", "navigator", "watchmaster"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-h-multi-owned-begin", sessionId, expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const player = operatorContext(fx, "multi-focus-player", "connection-multi-focus", ["captain", "watchmaster"]);
  const captainProjection = readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId: "slice-h-multi-owned-captain-read", sessionId, expectedRevision: started.revision }, player);
  assert.equal(captainProjection.projection.decisionOptions.length, 2);
  const captainPass = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "slice-h-multi-owned-captain-pass", sessionId, expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId: captainProjection.projection.decisionOptions[0].reactionId } }, player);
  assert.equal(captainPass.ok, true, JSON.stringify(captainPass.errors));
  const captainRoll = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "slice-h-multi-owned-captain-roll", sessionId, expectedRevision: captainPass.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(captainRoll.ok, true, JSON.stringify(captainRoll.errors));
  const navigatorProjection = readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId: "slice-h-multi-owned-navigator-read", sessionId, expectedRevision: captainRoll.revision }, player);
  assert.equal(navigatorProjection.projection.resolutionCurrentStationId, "navigator");
  assert.equal(navigatorProjection.projection.hasPendingPlayerDecision, true);
  assert.deepEqual(navigatorProjection.projection.decisionOptions, []);
  const writes = fx.tracker.updates;
  const foreignNavigatorPass = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "slice-h-multi-owned-navigator-foreign", sessionId, expectedRevision: captainRoll.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId: navigatorProjection.projection.reactionWindow?.opportunities?.[0]?.reactionId ?? "navigator-reaction" } }, player);
  assert.equal(foreignNavigatorPass.ok, false);
  assert.equal(foreignNavigatorPass.errors[0].code, "m11-projection-not-authorized");
  assert.equal(fx.tracker.updates, writes);
  const gmNavigatorProjection = readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId: "slice-h-multi-owned-navigator-gm-read", sessionId, expectedRevision: captainRoll.revision }, fx.context);
  const gmNavigatorPass = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "slice-h-multi-owned-navigator-pass", sessionId, expectedRevision: captainRoll.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId: gmNavigatorProjection.projection.decisionOptions[0].reactionId } }, fx.context);
  assert.equal(gmNavigatorPass.ok, true, JSON.stringify(gmNavigatorPass.errors));
  const navigatorRoll = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "slice-h-multi-owned-navigator-roll", sessionId, expectedRevision: gmNavigatorPass.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(navigatorRoll.ok, true, JSON.stringify(navigatorRoll.errors));
  const watchmasterProjection = readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId: "slice-h-multi-owned-watchmaster-read", sessionId, expectedRevision: navigatorRoll.revision }, player);
  assert.equal(watchmasterProjection.projection.resolutionCurrentStationId, "watchmaster");
  assert.equal(watchmasterProjection.projection.decisionOptions.length, 2);
  const watchmasterPass = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "slice-h-multi-owned-watchmaster-pass", sessionId, expectedRevision: navigatorRoll.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId: watchmasterProjection.projection.decisionOptions[0].reactionId } }, player);
  assert.equal(watchmasterPass.ok, true, JSON.stringify(watchmasterPass.errors));
  const watchmasterRoll = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "slice-h-multi-owned-watchmaster-roll", sessionId, expectedRevision: watchmasterPass.revision, authorityEpoch: 0 }, player);
  assert.equal(watchmasterRoll.ok, true, JSON.stringify(watchmasterRoll.errors));
});

test("Slice H rejects a resolved old reaction window after station advancement", async () => {
  const fx = fixture(); fx.context.focusAbilities = [...M12_FOCUS_ABILITIES];
  const locked = await launchAndLock(fx, "slice-h-old-window", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-h-old-window-begin", sessionId: "slice-h-old-window", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  const before = readVoyageEventSessionResolution("slice-h-old-window", fx.context).projection;
  const oldReactionId = before.reactionWindow.opportunities[0].reactionId;
  const passed = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "slice-h-old-window-pass", sessionId: "slice-h-old-window", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId: oldReactionId } }, fx.context);
  assert.equal(passed.ok, true, JSON.stringify(passed.errors));
  let stationCalls = 0;
  const originalStation = fx.context.executeVoyagePf2ePendingCheck;
  fx.context.executeVoyagePf2ePendingCheck = async (pending) => { stationCalls += 1; return originalStation(pending); };
  const rolled = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "slice-h-old-window-roll", sessionId: "slice-h-old-window", expectedRevision: passed.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(rolled.ok, true, JSON.stringify(rolled.errors));
  const writes = fx.tracker.updates;
  const oldRequest = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "slice-h-old-window-new-request", sessionId: "slice-h-old-window", expectedRevision: rolled.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId: oldReactionId } }, fx.context);
  assert.equal(oldRequest.ok, false);
  assert.equal(oldRequest.errors[0].code, "m11-command-not-allowed");
  assert.equal(stationCalls, 1);
  assert.equal(fx.tracker.updates, writes);
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  assert.equal(stored.events.filter((event) => event.type === "voyage.m12-focus-reaction-pass").length, 1);
  assert.equal(stored.encounterState.metadata.focusPools.find((entry) => entry.stationId === "captain")?.current, 1);
});

test("Slice H rejects invalid or foreign reaction IDs and caller-authored reaction fields without mutation", async () => {
  const fx = fixture(); fx.context.focusAbilities = [...M12_FOCUS_ABILITIES];
  const locked = await launchAndLock(fx, "slice-h-hostile-reactions", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-h-hostile-begin", sessionId: "slice-h-hostile-reactions", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  const participant = operatorContext(fx, "captain-player", "connection-captain", "captain");
  const foreign = operatorContext(fx, "engineer-player", "connection-engineer", "engineer");
  const projection = readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId: "slice-h-hostile-read", sessionId: "slice-h-hostile-reactions", expectedRevision: started.revision }, participant);
  const reactionId = projection.projection.decisionOptions[0].reactionId;
  const writes = fx.tracker.updates;
  const unknown = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "slice-h-unknown-reaction", sessionId: "slice-h-hostile-reactions", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId: "unknown-reaction" } }, participant);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.errors[0].code, "m11-projection-not-authorized");
  const foreignResult = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "slice-h-foreign-reaction", sessionId: "slice-h-hostile-reactions", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId } }, foreign);
  assert.equal(foreignResult.ok, false);
  assert.equal(foreignResult.errors[0].code, "m11-projection-not-authorized");
  const injectedFields = ["stationId", "operatorId", "actorId", "userId", "principalId", "participantId", "focus", "focusBalance", "modifier", "degree", "degreeShift", "dc", "total", "result", "effect", "target", "isGM", "role", "ownership"];
  for (const [index, field] of injectedFields.entries()) {
    const result = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: `slice-h-injected-${index}`, sessionId: "slice-h-hostile-reactions", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId, [field]: field === "result" ? { forged: true } : 1 } }, participant);
    assert.equal(result.ok, false, field);
    assert.equal(result.errors[0].code, "m11-command-payload-invalid", field);
  }
  assert.equal(fx.tracker.updates, writes);
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.encounterState.metadata.focusPools.find((entry) => entry.stationId === "captain")?.current, 1);
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.events.filter((event) => event.type === "voyage.m12-focus-reaction-pass").length, 0);
});

test("M12 Slice G player execution advances through the final station without Task 5", async () => {
  const fx = fixture();
  fx.context.actors.push(actor("watchmaster"));
  const locked = await launchAndLock(fx, "slice-g-player-final", { captain: "captain", navigator: "navigator", watchmaster: "watchmaster" }, ["captain", "navigator", "watchmaster"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-g-player-final-begin", sessionId: "slice-g-player-final", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  const player = operatorContext(fx, "operator-1", "connection-operator-1", ["captain", "navigator", "watchmaster"]);
  let executions = 0;
  const executor = player.executeVoyagePf2ePendingCheck;
  player.executeVoyagePf2ePendingCheck = async (...args) => { executions += 1; return executor(...args); };
  let revision = started.revision;
  for (const stationId of ["captain", "navigator", "watchmaster"]) {
    const result = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: `slice-g-player-final-${stationId}`, sessionId: "slice-g-player-final", expectedRevision: revision, authorityEpoch: 0 }, player);
    assert.equal(result.ok, true, `${stationId}: ${JSON.stringify(result.errors)}`);
    revision = result.revision;
  }
  assert.equal(executions, 3);
  const projection = readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId: "slice-g-player-final-read", sessionId: "slice-g-player-final", expectedRevision: revision }, player);
  assert.equal(projection.projection.resolutionComplete, true);
  assert.equal(projection.projection.sessionState, "station-resolution");
  assert.equal(projection.projection.phase, "resolution");
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.encounterState.momentum, 0);
});

test("M12 Slice G rejects player rule and result injection before execution", async () => {
  const fields = ["stationId", "operatorId", "actorId", "statistic", "actionId", "approach", "riskBid", "total", "dieResult", "degree", "dc", "result", "outcome"];
  const fx = fixture();
  const locked = await launchAndLock(fx, "slice-g-injection", { navigator: "navigator", captain: "captain" }, ["navigator", "captain"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-g-injection-begin", sessionId: "slice-g-injection", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  const player = operatorContext(fx);
  let executions = 0;
  const executor = player.executeVoyagePf2ePendingCheck;
  player.executeVoyagePf2ePendingCheck = async (...args) => { executions += 1; return executor(...args); };
  const writes = fx.tracker.updates;
  for (const [index, field] of fields.entries()) {
    const result = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: `slice-g-injection-${index}`, sessionId: "slice-g-injection", expectedRevision: started.revision, authorityEpoch: 0, [field]: field === "result" ? { ok: true } : 1 }, player);
    assert.equal(result.ok, false, field);
    assert.equal(result.errors[0].code, "m11-invalid-request-shape", field);
  }
  assert.equal(executions, 0);
  assert.equal(fx.tracker.updates, writes);
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.revision, started.revision);
});

test("M12 Slice F rejects a new Begin after resolution starts without resetting evidence", async () => {
  const fx = fixture(); const locked = await launchAndLock(fx, "slice-f-new-begin");
  let pf2eCalls = 0; fx.context.executeVoyagePf2ePendingCheck = async () => { pf2eCalls += 1; return null; };
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-f-first-begin", sessionId: "slice-f-new-begin", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const before = structuredClone(fx.journals[0].__testSource.flags.arcflight.system.voyageSession); const writes = fx.tracker.updates;
  const duplicate = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-f-second-begin", sessionId: "slice-f-new-begin", expectedRevision: started.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(duplicate.ok, false); assert.equal(duplicate.errors[0].code, "m11-command-not-allowed");
  assert.equal(fx.tracker.updates, writes); assert.deepEqual(fx.journals[0].__testSource.flags.arcflight.system.voyageSession, before);
  assert.equal(pf2eCalls, 0); assert.equal(before.events.filter((entry) => entry.type === "voyage.m12-resolution-start").length, 1);
});

test("M12 Slice F rejects a stale Begin through the public wrapper before any resolution mutation", async () => {
  const fx = fixture(); const locked = await launchAndLock(fx, "slice-f-stale-begin");
  const abandoned = await abortVoyageEventSession({ kind: "voyage.m11-abort-session", requestId: "slice-f-advance", sessionId: "slice-f-stale-begin", expectedRevision: locked.revision, authorityEpoch: 0, reason: "advance revision", confirmation: true }, fx.context);
  assert.equal(abandoned.ok, true, JSON.stringify(abandoned.errors));
  const before = structuredClone(fx.journals[0].__testSource.flags.arcflight.system.voyageSession); const writes = fx.tracker.updates;
  const stale = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-f-stale-request", sessionId: "slice-f-stale-begin", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(stale.ok, false); assert.equal(stale.errors[0].code, "m11-stale-session-revision");
  assert.equal(fx.tracker.updates, writes); assert.deepEqual(fx.journals[0].__testSource.flags.arcflight.system.voyageSession, before);
});

test("M12 Slice F rejects every non-eligible Begin source state without a successful transition", async () => {
  const states = [
    ["paused", "paused", null], ["round-closeout", "active", "consequences"], ["next-round", "active", "situation"],
    ["event-closeout-review", "active", "cleanup-advance"], ["persistent-application", "active", "cleanup-advance"],
    ["completed", "completed-success", null], ["recovery-required", "recovery", "resolution"]
  ];
  for (const [sessionState, lifecycleState, phase] of states) {
    const fx = fixture(); const locked = await launchAndLock(fx, `slice-f-invalid-${sessionState}`);
    const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
    stored.sessionState = sessionState; stored.encounterState.lifecycleState = lifecycleState; stored.encounterState.phase = phase;
    const before = structuredClone(stored); const writes = fx.tracker.updates;
    const result = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: `slice-f-invalid-request-${sessionState}`, sessionId: stored.sessionId, expectedRevision: stored.revision, authorityEpoch: 0 }, fx.context);
    assert.equal(result.ok, false, sessionState); assert.ok(["m11-command-not-allowed", "m11-invalid-session-document"].includes(result.errors[0].code), sessionState);
    assert.equal(fx.tracker.updates, writes, sessionState); assert.deepEqual(stored, before, sessionState);
  }
});

test("M12 Slice F rejects Begin while the session is still in crew planning", async () => {
  const fx = fixture();
  const launched = await launchVoyageEventSession({ kind: "voyage.m12-launch-event", requestId: "slice-f-crew-planning-launch", sessionId: "slice-f-crew-planning", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: { captain: "captain", engineer: "engineer" } }, fx.context);
  assert.equal(launched.ok, true, JSON.stringify(launched.errors)); assert.equal(launched.status, "crew-planning");
  const writes = fx.tracker.updates; const before = structuredClone(fx.journals[0].__testSource.flags.arcflight.system.voyageSession);
  const result = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-f-crew-planning-begin", sessionId: "slice-f-crew-planning", expectedRevision: launched.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(result.ok, false); assert.equal(result.errors[0].code, "m11-command-not-allowed"); assert.equal(fx.tracker.updates, writes);
  assert.deepEqual(fx.journals[0].__testSource.flags.arcflight.system.voyageSession, before);
});

test("M12 Slice F does not execute PF2e or persist a result during Begin", async () => {
  const fx = fixture(); let pf2eCalls = 0;
  fx.context.executeVoyagePf2ePendingCheck = async () => { pf2eCalls += 1; throw new Error("must not execute"); };
  const locked = await launchAndLock(fx, "slice-f-no-roll");
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-f-no-roll-begin", sessionId: "slice-f-no-roll", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors)); assert.equal(pf2eCalls, 0);
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  assert.equal(stored.encounterState.pendingChecks.every((entry) => entry.result === null || entry.result === undefined), true);
});

test("M12 Slice F rejects Plan Unlock after Begin through the Slice E boundary", async () => {
  const fx = fixture(); const locked = await launchAndLock(fx, "slice-f-unlock-boundary");
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-f-unlock-begin", sessionId: "slice-f-unlock-boundary", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors)); const before = structuredClone(fx.journals[0].__testSource.flags.arcflight.system.voyageSession); const writes = fx.tracker.updates;
  const unlock = await correctVoyageEventSession({ kind: "voyage.m11-correct-session", requestId: "slice-f-unlock", sessionId: "slice-f-unlock-boundary", expectedRevision: started.revision, authorityEpoch: 0, correctionKind: "plan-unlock", targetRequestId: null, targetCheckpointId: null, replacementPayload: {}, reason: "must remain locked", confirmation: true }, fx.context);
  assert.equal(unlock.ok, false); assert.equal(unlock.errors[0].code, "m11-command-not-allowed"); assert.equal(fx.tracker.updates, writes);
  assert.deepEqual(fx.journals[0].__testSource.flags.arcflight.system.voyageSession, before);
});

test("M12 Slice F serializes two competing Begin callers through the shared coordinator", async () => {
  const fx = fixture(); const locked = await launchAndLock(fx, "slice-f-contention"); let held = false;
  const initial = structuredClone(fx.journals[0].__testSource.flags.arcflight.system.voyageSession);
  const coordinatorFailure = (sessionId) => ({ ok: false, requestId: null, sessionId, revision: null, status: null, projection: null, events: [], errors: [{ code: "m11-control-transfer-required", path: "authorityEpoch", message: "Control transfer required." }], warnings: [] });
  fx.context.runExclusiveSessionMutation = async (descriptor, callback) => {
    if (held) return coordinatorFailure(descriptor.sessionId);
    held = true;
    try { return await callback({ connectionId: descriptor.connectionId, occurredAt: "2026-08-13T12:00:00.000Z" }); } finally { held = false; }
  };
  const request = (requestId) => ({ kind: "voyage.m12-begin-resolution", requestId, sessionId: "slice-f-contention", expectedRevision: locked.revision, authorityEpoch: 0 });
  const [first, second] = await Promise.all([beginVoyageEventSessionResolution(request("slice-f-contender-a"), fx.context), beginVoyageEventSessionResolution(request("slice-f-contender-b"), fx.context)]);
  assert.equal([first, second].filter((entry) => entry.ok).length, 1); assert.equal([first, second].filter((entry) => !entry.ok).length, 1);
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  assert.equal(stored.sessionState, "station-resolution"); assert.equal(stored.events.filter((entry) => entry.type === "voyage.m12-resolution-start").length, 1);
  assert.equal(stored.auditHistory.filter((entry) => entry.kind === "m12-resolution-start").length, 1);
  assert.equal(stored.events.filter((entry) => entry.type === "voyage.m12-pending-checks-prepared").length, 1);
  assert.equal(stored.auditHistory.filter((entry) => entry.kind === "m12-pending-checks-prepared").length, 1);
  assert.equal(stored.revision - initial.revision, 2);
  assert.equal(stored.encounterState.revision - initial.encounterState.revision, 2);
  assert.equal(stored.encounterState.pendingChecks.filter((entry) => entry.status === "pending").length, 2);
});

test("M12 Risk Bid effects activate only after a successful source and are consumed once", async () => {
  const fx = fixture();
  const modifiers = [];
  fx.context.executeVoyagePf2ePendingCheck = async (pending) => {
    modifiers.push(pending.focusModifier ?? 0);
    return { ok: true, status: "rolled", pendingCheckId: pending.pendingCheckId, sequence: pending.sequence, sourceKind: "character", sourceUuid: pending.source.uuid, statisticSlug: pending.statisticSlugOrAbilityId, dc: pending.finalDc, rollMode: "public", result: { total: pending.finalDc, degreeOfSuccess: 2, degreeOfSuccessSlug: "success" }, errors: [], warnings: [] };
  };
  const locked = await launchAndLock(fx, "risk-effect-session", { captain: "captain", navigator: "navigator" }, ["captain", "navigator"], { captain: "captain-round-1-action-3-risk-2" });
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "risk-effect-begin", sessionId: "risk-effect-session", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const source = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "risk-effect-source", sessionId: "risk-effect-session", expectedRevision: started.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(source.ok, true, JSON.stringify(source.errors));
  const active = readVoyageEventSessionResolution("risk-effect-session", fx.context).projection;
  assert.equal(active.stations.find((station) => station.stationId === "navigator").riskBidModifier, 1);
  assert.equal(active.stations.find((station) => station.stationId === "navigator").riskBidEffects.length, 1);
  const target = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "risk-effect-target", sessionId: "risk-effect-session", expectedRevision: source.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(target.ok, true, JSON.stringify(target.errors));
  assert.deepEqual(modifiers, [0, 1]);
  const reloaded = reloadVoyageEventSession("risk-effect-session", fx.context);
  assert.equal(reloaded.ok, true, JSON.stringify(reloaded.errors));
  const consumed = fx.journals[0].__testSource.flags.arcflight.system.voyageSession.encounterState.metadata.riskBidEffects;
  assert.equal(consumed.length, 1);
  assert.equal(consumed[0].status, "consumed");
  assert.equal(readVoyageEventSessionResolution("risk-effect-session", fx.context).projection.stations.find((station) => station.stationId === "navigator").riskBidEffects.length, 0);
});

test("M12 Risk Bid failure and target-before-source order never grant a payoff", async () => {
  const failed = fixture();
  failed.context.executeVoyagePf2ePendingCheck = async (pending) => ({ ok: true, status: "rolled", pendingCheckId: pending.pendingCheckId, sequence: pending.sequence, sourceKind: "character", sourceUuid: pending.source.uuid, statisticSlug: pending.statisticSlugOrAbilityId, dc: pending.finalDc, rollMode: "public", result: { total: pending.finalDc, degreeOfSuccess: 1, degreeOfSuccessSlug: "failure" }, errors: [], warnings: [] });
  const failedLocked = await launchAndLock(failed, "risk-effect-failure", { captain: "captain", navigator: "navigator" }, ["captain", "navigator"], { captain: "captain-round-1-action-3-risk-2" });
  const failedStart = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "risk-failure-begin", sessionId: "risk-effect-failure", expectedRevision: failedLocked.revision, authorityEpoch: 0 }, failed.context);
  const failedSource = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "risk-failure-source", sessionId: "risk-effect-failure", expectedRevision: failedStart.revision, authorityEpoch: 0 }, failed.context);
  assert.equal(failedSource.ok, true, JSON.stringify(failedSource.errors));
  assert.equal(readVoyageEventSessionResolution("risk-effect-failure", failed.context).projection.stations.find((station) => station.stationId === "navigator").riskBidEffects.length, 0);

  const reversed = fixture();
  const reversedLocked = await launchAndLock(reversed, "risk-effect-reversed", { captain: "captain", navigator: "navigator" }, ["navigator", "captain"], { captain: "captain-round-1-action-3-risk-2" });
  const reversedStart = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "risk-reversed-begin", sessionId: "risk-effect-reversed", expectedRevision: reversedLocked.revision, authorityEpoch: 0 }, reversed.context);
  const targetFirst = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "risk-reversed-target", sessionId: "risk-effect-reversed", expectedRevision: reversedStart.revision, authorityEpoch: 0 }, reversed.context);
  const sourceLast = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "risk-reversed-source", sessionId: "risk-effect-reversed", expectedRevision: targetFirst.revision, authorityEpoch: 0 }, reversed.context);
  assert.equal(sourceLast.ok, true, JSON.stringify(sourceLast.errors));
  const blocked = reversed.journals[0].__testSource.flags.arcflight.system.voyageSession.encounterState.metadata.riskBidEffects;
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0].status, "blocked");
  assert.equal(reloadVoyageEventSession("risk-effect-reversed", reversed.context).ok, true);
});

test("M12 Task 4 Focus reaction pass gates the station roll and persists reloadable evidence", async () => {
  const fx = fixture();
  fx.context.focusAbilities = M12_FOCUS_ABILITIES;
  const locked = await launchAndLock(fx);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "focus-begin", sessionId: "resolution-session", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const blocked = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "focus-roll-before-pass", sessionId: "resolution-session", expectedRevision: started.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(blocked.ok, false); assert.equal(blocked.errors[0].code, "m11-command-not-allowed");
  const projection = readVoyageEventSessionResolution("resolution-session", fx.context);
  assert.equal(projection.projection.reactionWindowOpen, true);
  assert.deepEqual(projection.projection.focusPools.map((pool) => [pool.stationId, pool.operatorId, pool.current]), [["captain", "Actor.captain", 1], ["engineer", "Actor.engineer", 1]]);
  assert.equal(projection.projection.focusPools.some((pool) => pool.stationId === "navigator"), false);
  const reactionId = projection.projection.reactionWindow.opportunities[0].reactionId;
  const passed = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "focus-pass", sessionId: "resolution-session", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId } }, fx.context);
  assert.equal(passed.ok, true, JSON.stringify(passed.errors) + JSON.stringify(fx.journals[0]?.__testSource?.flags?.arcflight?.system?.voyageSession?.metadata));
  assert.equal(readVoyageEventSessionResolution("resolution-session", fx.context).projection.reactionWindowOpen, false);
  const rolled = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "focus-roll-after-pass", sessionId: "resolution-session", expectedRevision: passed.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(rolled.ok, true, JSON.stringify(rolled.errors));
  assert.equal(reloadVoyageEventSession("resolution-session", fx.context).ok, true);
});

test("M12 Task 4 Focus use spends once, executes through PF2e, and applies every authored degree", async () => {
  for (const [degreeOfSuccessSlug, modifier] of [["critical-failure", -3], ["failure", -1], ["success", 1], ["critical-success", 3]]) {
    const fx = fixture();
    fx.context.focusAbilities = M12_FOCUS_ABILITIES;
    let focusCalls = 0;
    fx.context.executeVoyagePf2eFocusCheck = async (pending) => {
      focusCalls += 1;
      return { ok: true, status: "rolled", pendingCheckId: pending.pendingCheckId, sequence: pending.sequence, sourceKind: "character", sourceUuid: pending.source.uuid, statisticSlug: pending.statisticSlugOrAbilityId, dc: pending.finalDc, rollMode: "public", result: { total: pending.finalDc, degreeOfSuccess: { "critical-failure": 0, failure: 1, success: 2, "critical-success": 3 }[degreeOfSuccessSlug], degreeOfSuccessSlug }, errors: [], warnings: [] };
    };
    const locked = await launchAndLock(fx);
    const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "focus-use-begin", sessionId: "resolution-session", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
    const blocked = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "focus-use-open", sessionId: "resolution-session", expectedRevision: started.revision, authorityEpoch: 0 }, fx.context);
    assert.equal(blocked.ok, false);
    const before = readVoyageEventSessionResolution("resolution-session", fx.context).projection;
    const reactionId = before.reactionWindow.opportunities[0].reactionId;
    const used = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: `focus-use-${degreeOfSuccessSlug}`, sessionId: "resolution-session", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } }, fx.context);
    assert.equal(used.ok, true, JSON.stringify(used.errors));
    assert.equal(focusCalls, 1);
    const after = readVoyageEventSessionResolution("resolution-session", fx.context).projection;
    assert.equal(after.focusPools.find((pool) => pool.stationId === "captain").current, 0);
    assert.equal(after.focusEffects[0].modifier, modifier);
    assert.equal(after.reactionWindowOpen, false);
    const replay = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: `focus-use-${degreeOfSuccessSlug}`, sessionId: "resolution-session", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } }, fx.context);
    assert.deepEqual(replay, used);
    assert.equal(focusCalls, 1);
    assert.equal(reloadVoyageEventSession("resolution-session", fx.context).ok, true);
  }
});

test("M12 Task 4 persists Focus spend before execution, including a persisted-then-thrown preparation write", async () => {
  const fx = fixture(); fx.context.focusAbilities = M12_FOCUS_ABILITIES;
  let focusCalls = 0; fx.context.executeVoyagePf2eFocusCheck = async (pending) => { focusCalls += 1; return { ok: true, status: "rolled", pendingCheckId: pending.pendingCheckId, sequence: pending.sequence, sourceKind: "character", sourceUuid: pending.source.uuid, statisticSlug: pending.statisticSlugOrAbilityId, dc: pending.finalDc, rollMode: "public", result: { total: pending.finalDc, degreeOfSuccess: 2, degreeOfSuccessSlug: "success" }, errors: [], warnings: [] }; };
  const locked = await launchAndLock(fx); const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "focus-prep-throw-begin", sessionId: "resolution-session", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  const reactionId = readVoyageEventSessionResolution("resolution-session", fx.context).projection.reactionWindow.opportunities[0].reactionId;
  fx.tracker.throwUpdate = true; fx.tracker.persistThenThrow = true;
  const used = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "focus-prep-throw-use", sessionId: "resolution-session", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } }, fx.context);
  assert.equal(used.ok, true, JSON.stringify(used.errors)); assert.equal(focusCalls, 1); assert.equal(fx.tracker.updates, 10);
  assert.equal(reloadVoyageEventSession("resolution-session", fx.context).ok, true);
  const replay = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "focus-prep-throw-use", sessionId: "resolution-session", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } }, fx.context);
  assert.deepEqual(replay, used); assert.equal(focusCalls, 1); assert.equal(fx.tracker.updates, 10);
});

test("M12 Task 4 resumes a Focus result after an uncertain result write without a second PF2e execution", async () => {
  const fx = fixture(); fx.context.focusAbilities = M12_FOCUS_ABILITIES;
  let focusCalls = 0; fx.context.executeVoyagePf2eFocusCheck = async (pending) => { focusCalls += 1; return { ok: true, status: "rolled", pendingCheckId: pending.pendingCheckId, sequence: pending.sequence, sourceKind: "character", sourceUuid: pending.source.uuid, statisticSlug: pending.statisticSlugOrAbilityId, dc: pending.finalDc, rollMode: "public", result: { total: pending.finalDc, degreeOfSuccess: 2, degreeOfSuccessSlug: "success" }, errors: [], warnings: [] }; };
  const locked = await launchAndLock(fx); const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "focus-result-uncertain-begin", sessionId: "resolution-session", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  const reactionId = readVoyageEventSessionResolution("resolution-session", fx.context).projection.reactionWindow.opportunities[0].reactionId;
  const entry = fx.journals[0]; const originalUpdate = entry.update; let updateCalls = 0;
  entry.update = async (...args) => { updateCalls += 1; if (updateCalls === 3) { fx.tracker.updates += 1; throw new Error("uncertain result write"); } return originalUpdate(...args); };
  const first = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "focus-result-uncertain-use", sessionId: "resolution-session", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } }, fx.context);
  assert.equal(first.ok, false); assert.equal(first.errors[0].code, "m11-session-write-failed"); assert.equal(focusCalls, 1);
  const durablePending = fx.journals[0].__testSource.flags.arcflight.system.voyageSession.encounterState.metadata.focusPendingCheck;
  assert.equal(durablePending.executionStatus, "captured");
  assert.equal(durablePending.executionReceipt.pendingCheckId, durablePending.pendingCheckId);
  entry.update = originalUpdate;
  const retry = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "focus-result-uncertain-use", sessionId: "resolution-session", expectedRevision: started.revision + 1, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } }, fx.context);
  assert.equal(retry.ok, true, JSON.stringify(retry.errors)); assert.equal(focusCalls, 1); assert.equal(fx.tracker.updates, 11);
  const replay = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "focus-result-uncertain-use", sessionId: "resolution-session", expectedRevision: started.revision + 1, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } }, fx.context);
  assert.deepEqual(replay, retry); assert.equal(fx.tracker.updates, 11); assert.equal(reloadVoyageEventSession("resolution-session", fx.context).ok, true);
});

test("M12 Task 4 retries an uncertain Focus result through a distinct JournalEntry instance", async () => {
  const fx = fixture(); fx.context.focusAbilities = M12_FOCUS_ABILITIES; let focusCalls = 0; const sessionId = "distinct-resolution-session";
  fx.context.executeVoyagePf2eFocusCheck = async (pending) => { focusCalls += 1; return { ok: true, status: "rolled", pendingCheckId: pending.pendingCheckId, sequence: pending.sequence, sourceKind: "character", sourceUuid: pending.source.uuid, statisticSlug: pending.statisticSlugOrAbilityId, dc: pending.finalDc, rollMode: "public", result: { total: pending.finalDc, degreeOfSuccess: 2, degreeOfSuccessSlug: "success" }, errors: [], warnings: [] }; };
  const locked = await launchAndLock(fx, sessionId); const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "focus-distinct-begin", sessionId, expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  const reactionId = readVoyageEventSessionResolution(sessionId, fx.context).projection.reactionWindow.opportunities[0].reactionId;
  const original = fx.journals[0]; const originalUpdate = original.update.bind(original); let updateCalls = 0;
  original.update = async (payload, options) => { updateCalls += 1; if (updateCalls === 3) throw new Error("uncertain result write"); return originalUpdate(payload, options); };
  const first = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "focus-distinct-use", sessionId, expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } }, fx.context);
  assert.equal(first.ok, false); assert.equal(focusCalls, 1);
  const distinct = { ...original, id: original.id, toObject: original.toObject.bind(original), update: original.update.bind(original) }; fx.journals[0] = distinct;
  const recoveredContext = { ...fx.context, focusAbilities: [...M12_FOCUS_ABILITIES] };
  const retry = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "focus-distinct-use", sessionId, expectedRevision: started.revision + 1, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } }, recoveredContext);
  assert.equal(retry.ok, true, JSON.stringify(retry.errors)); assert.equal(focusCalls, 1);
});

test("M12 Task 4 rejects tampered persisted Focus result bindings without writes", async () => {
  const tamperPaths = [
    (entry, pending) => { entry.modifier = 4; },
    (entry, pending) => { entry.pendingCheckId = `${pending.pendingCheckId}-forged`; },
    (entry, pending) => { entry.targetPendingCheckId = `${pending.targetPendingCheckId}-forged`; },
    (entry) => { entry.result.statisticSlug = "arcana"; },
    (entry) => { entry.result.dc = 99; },
    (entry) => { entry.result.normalizedDegree = "failure"; }
  ];
  for (const tamper of tamperPaths) {
    const fx = fixture(); fx.context.focusAbilities = M12_FOCUS_ABILITIES; const locked = await launchAndLock(fx);
    const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "focus-tamper-begin", sessionId: "resolution-session", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
    const reactionId = readVoyageEventSessionResolution("resolution-session", fx.context).projection.reactionWindow.opportunities[0].reactionId;
    const used = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "focus-tamper-use", sessionId: "resolution-session", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } }, fx.context);
    assert.equal(used.ok, true, JSON.stringify(used.errors));
    const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
    const entry = stored.encounterState.metadata.focusResults[0]; tamper(entry, stored.encounterState.metadata.focusPendingCheck ?? { pendingCheckId: entry.pendingCheckId, targetPendingCheckId: entry.targetPendingCheckId });
    const writes = fx.tracker.updates; const invalid = reloadVoyageEventSession("resolution-session", fx.context);
    assert.equal(invalid.ok, false); assert.equal(invalid.errors[0].code, "m11-invalid-session-document"); assert.equal(fx.tracker.updates, writes);
  }
});

test("M12 Task 4 opens and advances a pre-roll reaction window for each committed station", async () => {
  const fx = fixture();
  fx.context.focusAbilities = [
    ...M12_FOCUS_ABILITIES,
    {
      focusAbilityId: "m12-focus-engineer-assist",
      name: "Engineer Sequencing Assist",
      description: "The engineer sequences the drive coils before the current station check.",
      trigger: "before-current-station-check",
      timing: "before-roll",
      cost: 1,
      stationId: "engineer",
      targetStationId: "engineer",
      eligibleSource: { kind: "station", stationId: "engineer" },
      targetRule: { kind: "current-station", stationId: "engineer" },
      check: { kind: "pf2e-check", statisticSlugOrAbilityId: "crafting" },
      dcSource: { kind: "fixed", value: 18 },
      statisticSlugOrAbilityId: "crafting",
      dc: 18,
      secrecy: "public",
      outcomes: { criticalSuccess: 3, success: 1, failure: -1, criticalFailure: -3 },
      outcomeNarration: {
        criticalSuccess: "The drive sequence is perfect and the check gains +3.",
        success: "The drive sequence helps and the check gains +1.",
        failure: "The sequence costs time and the check takes -1.",
        criticalFailure: "The sequence misfires and the check takes -3."
      },
      visibility: "public",
      narration: "The engineer sequences the coils for the next station check."
    }
  ];
  const locked = await launchAndLock(fx);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "focus-advance-begin", sessionId: "resolution-session", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  let projection = readVoyageEventSessionResolution("resolution-session", fx.context).projection;
  assert.equal(projection.reactionWindowOpen, true);
  assert.equal(projection.reactionWindow.stationId, "captain");
  const captainReaction = projection.reactionWindow.opportunities[0].reactionId;
  const passedCaptain = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "focus-advance-pass-captain", sessionId: "resolution-session", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId: captainReaction } }, fx.context);
  const rolledCaptain = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "focus-advance-roll-captain", sessionId: "resolution-session", expectedRevision: passedCaptain.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(rolledCaptain.ok, true, JSON.stringify(rolledCaptain.errors));
  projection = readVoyageEventSessionResolution("resolution-session", fx.context).projection;
  assert.equal(projection.reactionWindowOpen, true);
  assert.equal(projection.reactionWindow.stationId, "engineer");
  const engineerReaction = projection.reactionWindow.opportunities[0].reactionId;
  const passedEngineer = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "focus-advance-pass-engineer", sessionId: "resolution-session", expectedRevision: rolledCaptain.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId: engineerReaction } }, fx.context);
  const rolledEngineer = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "focus-advance-roll-engineer", sessionId: "resolution-session", expectedRevision: passedEngineer.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(rolledEngineer.ok, true, JSON.stringify(rolledEngineer.errors));
  assert.equal(readVoyageEventSessionResolution("resolution-session", fx.context).projection.completed, true);
});

test("M12 Slice H lets the eligible player resolve the canonical Focus decision exactly once", async () => {
  const fx = fixture(); fx.context.focusAbilities = [...M12_FOCUS_ABILITIES];
  const locked = await launchAndLock(fx, "slice-h-player-focus", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-h-player-focus-begin", sessionId: "slice-h-player-focus", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  const player = operatorContext(fx, "captain-player", "connection-captain", "captain");
  const before = readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId: "slice-h-player-focus-read", sessionId: "slice-h-player-focus", expectedRevision: started.revision }, player);
  assert.equal(before.ok, true, JSON.stringify(before.errors)); assert.equal(before.projection.hasPendingPlayerDecision, true);
  assert.equal(before.projection.canUseFocus, true); assert.equal(before.projection.rollBlockedByDecision, true);
  assert.equal(before.projection.decisionOptions[0].kind, "focus-reaction-use");
  assert.equal("pendingCheckId" in before.projection, false); assert.equal("focusResults" in before.projection, false);
  const reactionId = before.projection.decisionOptions[0].reactionId; const writes = fx.tracker.updates;
  const used = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "slice-h-player-focus-use", sessionId: "slice-h-player-focus", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } }, player);
  assert.equal(used.ok, true, JSON.stringify(used.errors)); assert.equal(fx.tracker.updates, writes + 3);
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  assert.equal(stored.encounterState.metadata.focusPools.find((entry) => entry.stationId === "captain").current, 0);
  const replay = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "slice-h-player-focus-use", sessionId: "slice-h-player-focus", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } }, player);
  assert.deepEqual(replay, used); assert.equal(fx.tracker.updates, writes + 3);
  const conflict = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "slice-h-player-focus-use", sessionId: "slice-h-player-focus", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId: "changed-reaction" } }, player);
  assert.equal(conflict.ok, false); assert.equal(conflict.errors[0].code, "m11-request-id-conflict"); assert.equal(fx.tracker.updates, writes + 3);
  const disconnectedReplay = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "slice-h-player-focus-use", sessionId: "slice-h-player-focus", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } }, { ...player, authenticatedConnectionId: null, trustedTransportContext: false });
  assert.equal(disconnectedReplay.ok, false); assert.equal(disconnectedReplay.errors[0].code, "m11-authentication-required"); assert.equal(fx.tracker.updates, writes + 3);
});

test("M12 Slice H filters reaction authority and rejects changed or disconnected player decisions", async () => {
  const fx = fixture(); fx.context.focusAbilities = [...M12_FOCUS_ABILITIES];
  const locked = await launchAndLock(fx, "slice-h-authority", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-h-authority-begin", sessionId: "slice-h-authority", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  const captain = operatorContext(fx, "captain-player", "connection-captain", "captain");
  const engineer = operatorContext(fx, "engineer-player", "connection-engineer", "engineer");
  const observer = operatorContext(fx, "observer-player", "connection-observer", []);
  const projection = readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId: "slice-h-authority-read", sessionId: "slice-h-authority", expectedRevision: started.revision }, captain);
  const reactionId = projection.projection.decisionOptions[0].reactionId;
  const writes = fx.tracker.updates;
  for (const [label, context] of [["foreign", engineer], ["observer", observer]]) {
    const rejected = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: `slice-h-${label}`, sessionId: "slice-h-authority", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId } }, context);
    assert.equal(rejected.ok, false, label); assert.equal(rejected.errors[0].code, "m11-projection-not-authorized", label); assert.equal(fx.tracker.updates, writes, label);
  }
  const disconnected = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "slice-h-disconnected", sessionId: "slice-h-authority", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId } }, { ...captain, trustedTransportContext: false, authenticatedConnectionId: null });
  assert.equal(disconnected.ok, false); assert.equal(disconnected.errors[0].code, "m11-authentication-required"); assert.equal(fx.tracker.updates, writes);
  const changed = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "slice-h-changed", sessionId: "slice-h-authority", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId: "forged-reaction" } }, captain);
  assert.equal(changed.ok, false); assert.equal(changed.errors[0].code, "m11-projection-not-authorized"); assert.equal(fx.tracker.updates, writes);
  const stale = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "slice-h-stale", sessionId: "slice-h-authority", expectedRevision: started.revision - 1, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId } }, captain);
  assert.equal(stale.ok, false); assert.equal(stale.errors[0].code, "m11-stale-session-revision"); assert.equal(fx.tracker.updates, writes);
});

test("M12 Slice H preserves one-winner Focus contention and no-refund reload", async () => {
  const fx = fixture(); fx.context.focusAbilities = [...M12_FOCUS_ABILITIES];
  const locked = await launchAndLock(fx, "slice-h-contention", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-h-contention-begin", sessionId: "slice-h-contention", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  let focusCalls = 0; fx.context.executeVoyagePf2eFocusCheck = async (pending) => { focusCalls += 1; return fx.context.executeVoyagePf2ePendingCheck(pending); };
  const player = operatorContext(fx, "captain-player", "connection-captain", "captain");
  const projection = readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId: "slice-h-contention-read", sessionId: "slice-h-contention", expectedRevision: started.revision }, player);
  const reactionId = projection.projection.decisionOptions[0].reactionId;
  const request = { kind: "voyage.m11-command", requestId: "slice-h-contention-player", sessionId: "slice-h-contention", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } };
  const [playerResult, gmResult] = await Promise.all([dispatchVoyageEventSessionCommand(request, player), dispatchVoyageEventSessionCommand({ ...request, requestId: "slice-h-contention-gm" }, fx.context)]);
  assert.equal(focusCalls, 1); assert.equal([playerResult, gmResult].filter((entry) => entry.ok).length, 1);
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  assert.equal(stored.encounterState.metadata.focusPools.find((entry) => entry.stationId === "captain").current, 0);
  assert.equal(stored.events.filter((entry) => entry.type === "voyage.m12-focus-reaction-use").length, 1);
  assert.equal(reloadVoyageEventSession("slice-h-contention", fx.context).ok, true);
});

function realTransportFixture(fx, playerId = "captain-player", options = {}) {
  const listeners = [];
  let playerJournalWrites = 0;
  const playerDocumentAdapter = {
    update() { playerJournalWrites += 1; },
    reset() { playerJournalWrites = 0; }
  };
  const users = options.users ?? [{ id: "gm-1", isGM: true, active: true }, { id: playerId, isGM: false, active: true }];
  const game = {
    user: { id: "gm-1", isGM: true, active: true },
    users,
    socket: { id: "gm-transport", on: (_channel, handler) => listeners.push(handler), emit: () => {} },
    time: { serverTime: Date.parse("2026-08-13T12:00:00.000Z") }
  };
  const coordinator = getFoundrySessionMutationCoordinator(game);
  fx.context.authenticatedConnectionId = "gm-transport";
  fx.context.users = game.users;
  fx.context.runExclusiveSessionMutation = coordinator;
  const remoteContext = {
    ...fx.context,
    authenticatedUserId: playerId,
    authenticatedConnectionId: "gm-transport",
    trustedTransportContext: true,
    activeGmUserId: "gm-1",
    users: game.users,
    resolveVoyageOperatorForPrincipal: options.resolveVoyageOperatorForPrincipal ?? (() => [{ kind: "actor", id: "captain", uuid: "Actor.captain", name: "Captain" }]),
    runExclusiveSessionMutation: coordinator,
    __trustedRemotePlayerIntent: true,
    executingGmUserId: "gm-1"
  };
  let handler;
  const socket = {
    register: (_name, callback) => { handler = callback; },
    async executeAsGM(_name, request) {
      await options.beforeHandler?.(request);
      if (typeof options.executeAsGM === "function") return options.executeAsGM(request, handler);
      return handler.call({ socketdata: { userId: playerId } }, request);
    }
  };
  return {
    remoteContext,
    socket,
    game,
    playerDocumentAdapter,
    playerDocumentAdapterWasInstalled: true,
    get playerJournalWrites() { return playerJournalWrites; },
    register: (onIntent) => registerVoyageGmCommandTransport({ socketlib: { registerModule: () => socket }, onIntent })
  };
}

test("real socketlib-shaped transport routes player station execution to the active GM coordinator", async () => {
  const fx = fixture(); const locked = await launchAndLock(fx, "transport-station", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const transport = realTransportFixture(fx);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "transport-begin", sessionId: "transport-station", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  let stationCalls = 0;
  const originalStation = fx.context.executeVoyagePf2ePendingCheck;
  fx.context.executeVoyagePf2ePendingCheck = async (pending) => { stationCalls += 1; return originalStation(pending); };
  transport.remoteContext.executeVoyagePf2ePendingCheck = fx.context.executeVoyagePf2ePendingCheck;
  assert.equal(transport.register((request, origin) => {
    assert.equal(origin.originatingUserId, "captain-player");
    return resolveVoyageEventSessionStation(request, transport.remoteContext);
  }), true);
  const writes = fx.tracker.updates;
  const gmWrites = fx.tracker.gmJournalWrites;
  const result = await executeVoyagePlayerIntent({ kind: "voyage.m12-resolve-station", requestId: "transport-roll", sessionId: "transport-station", expectedRevision: started.revision, authorityEpoch: 0 }, transport.socket);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.errors.length, 0);
  assert.equal(stationCalls, 1);
  assert.equal(fx.tracker.updates, writes + 1);
  assert.equal(transport.playerDocumentAdapterWasInstalled, true);
  assert.equal(typeof transport.playerDocumentAdapter.update, "function");
  transport.playerDocumentAdapter.update();
  assert.equal(transport.playerJournalWrites, 1);
  transport.playerDocumentAdapter.reset();
  assert.equal(transport.playerJournalWrites, 0);
  assert.equal(fx.tracker.gmJournalWrites, gmWrites + 1);
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.events.filter((event) => event.type === "voyage.m12-action-segment").length, 1);
  const replay = await executeVoyagePlayerIntent({ kind: "voyage.m12-resolve-station", requestId: "transport-roll", sessionId: "transport-station", expectedRevision: started.revision, authorityEpoch: 0 }, transport.socket);
  assert.deepEqual(replay, result);
  assert.equal(stationCalls, 1);
  assert.equal(fx.tracker.updates, writes + 1);
  const conflict = await executeVoyagePlayerIntent({ kind: "voyage.m12-resolve-station", requestId: "transport-roll", sessionId: "transport-station", expectedRevision: started.revision + 1, authorityEpoch: 0 }, transport.socket);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.errors[0].code, "m11-request-id-conflict");
  assert.equal(fx.tracker.updates, writes + 1);
  const epochConflict = await executeVoyagePlayerIntent({ kind: "voyage.m12-resolve-station", requestId: "transport-roll", sessionId: "transport-station", expectedRevision: started.revision, authorityEpoch: 1 }, transport.socket);
  assert.equal(epochConflict.ok, false);
  assert.equal(epochConflict.errors[0].code, "m11-request-id-conflict");
  assert.equal(stationCalls, 1);
  assert.equal(fx.tracker.updates, writes + 1);
});

test("real socketlib-shaped transport routes player PASS without a PF2E roll and keeps the player principal", async () => {
  const fx = fixture(); fx.context.focusAbilities = [...M12_FOCUS_ABILITIES];
  const locked = await launchAndLock(fx, "transport-focus", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const transport = realTransportFixture(fx);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "transport-focus-begin", sessionId: "transport-focus", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const projection = readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId: "transport-focus-read", sessionId: "transport-focus", expectedRevision: started.revision }, { ...transport.remoteContext, resolveVoyageOperatorForPrincipal: () => [{ kind: "actor", id: "captain", uuid: "Actor.captain", name: "Captain" }] });
  const reactionId = projection.projection.decisionOptions[0].reactionId;
  const focusBefore = fx.journals[0].__testSource.flags.arcflight.system.voyageSession.encounterState.metadata.focusPools.find((entry) => entry.stationId === "captain")?.current;
  let focusSpecificCalls = 0; fx.context.executeVoyagePf2eFocusCheck = async () => { focusSpecificCalls += 1; return null; };
  let stationActionSegmentCalls = 0;
  const originalStation = fx.context.executeVoyagePf2ePendingCheck;
  fx.context.executeVoyagePf2ePendingCheck = async (pending) => { stationActionSegmentCalls += 1; return originalStation(pending); };
  transport.remoteContext.executeVoyagePf2eFocusCheck = fx.context.executeVoyagePf2eFocusCheck;
  transport.remoteContext.executeVoyagePf2ePendingCheck = fx.context.executeVoyagePf2ePendingCheck;
  assert.equal(transport.register((request, origin) => {
    assert.equal(origin.originatingUserId, "captain-player");
    return dispatchVoyageEventSessionCommand(request, transport.remoteContext);
  }), true);
  const writes = fx.tracker.updates;
  const gmWrites = fx.tracker.gmJournalWrites;
  const result = await executeVoyagePlayerIntent({ kind: "voyage.m11-command", requestId: "transport-focus-pass", sessionId: "transport-focus", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId } }, transport.socket);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(focusSpecificCalls, 0);
  assert.equal(stationActionSegmentCalls, 0);
  assert.equal(fx.tracker.updates, writes + 1);
  assert.equal(transport.playerDocumentAdapterWasInstalled, true);
  assert.equal(transport.playerJournalWrites, 0);
  assert.equal(fx.tracker.gmJournalWrites, gmWrites + 1);
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  assert.equal(stored.events.filter((event) => event.type === "voyage.m12-focus-reaction-pass").length, 1);
  assert.equal(stored.auditHistory.filter((entry) => entry.kind === "m12-focus-reaction-passed").length, 1);
  assert.equal(stored.encounterState.metadata.focusPools.find((entry) => entry.stationId === "captain")?.current, focusBefore);
  const after = readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId: "transport-focus-pass-after", sessionId: "transport-focus", expectedRevision: result.revision }, transport.remoteContext);
  assert.equal(after.ok, true, JSON.stringify(after.errors));
  assert.equal(after.projection.hasPendingPlayerDecision, false);
  assert.equal(after.projection.canExecuteCurrentStation, true);
  assert.equal(after.projection.rollBlockedByDecision, false);
  const replay = await executeVoyagePlayerIntent({ kind: "voyage.m11-command", requestId: "transport-focus-pass", sessionId: "transport-focus", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId } }, transport.socket);
  assert.equal(replay.ok, true);
  assert.deepEqual(replay, result);
  assert.equal(focusSpecificCalls, 0);
  assert.equal(stationActionSegmentCalls, 0);
  assert.equal(fx.tracker.updates, writes + 1);
  const conflict = await executeVoyagePlayerIntent({ kind: "voyage.m11-command", requestId: "transport-focus-pass", sessionId: "transport-focus", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId: "changed-reaction" } }, transport.socket);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.errors[0].code, "m11-request-id-conflict");
  assert.equal(fx.tracker.updates, writes + 1);
  const secondPass = await executeVoyagePlayerIntent({ kind: "voyage.m11-command", requestId: "transport-focus-pass-again", sessionId: "transport-focus", expectedRevision: result.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId } }, transport.socket);
  assert.equal(secondPass.ok, false);
  assert.ok(["m11-command-not-allowed", "m11-stale-session-revision", "m11-projection-not-authorized"].includes(secondPass.errors[0].code));
  assert.equal(focusSpecificCalls, 0);
  assert.equal(stationActionSegmentCalls, 0);
  assert.equal(fx.tracker.updates, writes + 1);
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.events.filter((event) => event.type === "voyage.m12-focus-reaction-pass").length, 1);
});

test("real socketlib-shaped transport routes player USE Focus through the GM exactly once", async () => {
  const fx = fixture(); fx.context.focusAbilities = [...M12_FOCUS_ABILITIES];
  const locked = await launchAndLock(fx, "transport-focus-use", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const transport = realTransportFixture(fx);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "transport-use-begin", sessionId: "transport-focus-use", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const projection = readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId: "transport-use-read", sessionId: "transport-focus-use", expectedRevision: started.revision }, transport.remoteContext);
  const reactionId = projection.projection.decisionOptions[0].reactionId;
  let focusCalls = 0; const originalFocus = fx.context.executeVoyagePf2eFocusCheck ?? fx.context.executeVoyagePf2ePendingCheck;
  fx.context.executeVoyagePf2eFocusCheck = async (pending) => { focusCalls += 1; return originalFocus(pending); };
  transport.remoteContext.executeVoyagePf2eFocusCheck = fx.context.executeVoyagePf2eFocusCheck;
  assert.equal(transport.register((request, origin) => {
    assert.equal(origin.originatingUserId, "captain-player");
    return dispatchVoyageEventSessionCommand(request, transport.remoteContext);
  }), true);
  const writes = fx.tracker.updates;
  const gmWrites = fx.tracker.gmJournalWrites;
  const result = await executeVoyagePlayerIntent({ kind: "voyage.m11-command", requestId: "transport-focus-use", sessionId: "transport-focus-use", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } }, transport.socket);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(focusCalls, 1);
  assert.equal(fx.tracker.updates, writes + 3);
  assert.equal(transport.playerDocumentAdapterWasInstalled, true);
  assert.equal(transport.playerJournalWrites, 0);
  assert.equal(fx.tracker.gmJournalWrites, gmWrites + 3);
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  assert.equal(stored.events.filter((event) => event.type === "voyage.m12-focus-reaction-use").length, 1);
  const replay = await executeVoyagePlayerIntent({ kind: "voyage.m11-command", requestId: "transport-focus-use", sessionId: "transport-focus-use", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } }, transport.socket);
  assert.equal(replay.ok, true);
  assert.equal(focusCalls, 1);
  assert.equal(fx.tracker.updates, writes + 3);
  const conflict = await executeVoyagePlayerIntent({ kind: "voyage.m11-command", requestId: "transport-focus-use", sessionId: "transport-focus-use", expectedRevision: started.revision + 1, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } }, transport.socket);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.errors[0].code, "m11-request-id-conflict");
  assert.equal(fx.tracker.updates, writes + 3);
});

test("transport preserves current connection validation when the sender disconnects before GM handling", async () => {
  const fx = fixture(); const locked = await launchAndLock(fx, "transport-disconnected", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const transport = realTransportFixture(fx, "captain-player", {
    users: [{ id: "gm-1", isGM: true, active: true }, { id: "captain-player", isGM: false, active: false }]
  });
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "transport-disconnected-begin", sessionId: "transport-disconnected", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  assert.equal(transport.register((request, origin) => {
    assert.equal(origin.originatingUserId, "captain-player");
    return resolveVoyageEventSessionStation(request, transport.remoteContext);
  }), true);
  const writes = fx.tracker.updates;
  const result = await executeVoyagePlayerIntent({ kind: "voyage.m12-resolve-station", requestId: "transport-disconnected-roll", sessionId: "transport-disconnected", expectedRevision: started.revision, authorityEpoch: 0 }, transport.socket);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-authentication-required");
  assert.equal(result.errors[0].path, "transport.user");
  assert.equal(fx.tracker.updates, writes);
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.events.filter((event) => event.type === "voyage.m12-action-segment").length, 0);
});

test("transport delivers a connected nonparticipant to the GM, where canonical authority rejects it", async () => {
  const fx = fixture(); const locked = await launchAndLock(fx, "transport-nonparticipant", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const transport = realTransportFixture(fx, "player-b", { resolveVoyageOperatorForPrincipal: () => [] });
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "transport-nonparticipant-begin", sessionId: "transport-nonparticipant", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  assert.equal(transport.register((request, origin) => {
    assert.equal(origin.originatingUserId, "player-b");
    return resolveVoyageEventSessionStation(request, transport.remoteContext);
  }), true);
  const writes = fx.tracker.updates;
  const result = await executeVoyagePlayerIntent({ kind: "voyage.m12-resolve-station", requestId: "transport-nonparticipant-roll", sessionId: "transport-nonparticipant", expectedRevision: started.revision, authorityEpoch: 0 }, transport.socket);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-projection-not-authorized");
  assert.equal(fx.tracker.updates, writes);
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.events.filter((event) => event.type === "voyage.m12-action-segment").length, 0);
});

test("transport preserves caller revision during deterministic authoritative drift", async () => {
  const fx = fixture(); const locked = await launchAndLock(fx, "transport-revision-drift", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "transport-revision-drift-begin", sessionId: "transport-revision-drift", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  let stationCalls = 0;
  const originalStation = fx.context.executeVoyagePf2ePendingCheck;
  fx.context.executeVoyagePf2ePendingCheck = async (pending) => { stationCalls += 1; return originalStation(pending); };
  const request = { kind: "voyage.m12-resolve-station", requestId: "transport-revision-drift-roll", sessionId: "transport-revision-drift", expectedRevision: started.revision, authorityEpoch: 0 };
  let capturedExpectedRevision = null;
  const transport = realTransportFixture(fx, "captain-player", {
    beforeHandler: async (routedRequest) => {
      assert.equal(routedRequest.expectedRevision, started.revision);
      const advanced = await resolveVoyageEventSessionStation({ ...request, requestId: "transport-revision-drift-advance" }, fx.context);
      assert.equal(advanced.ok, true, JSON.stringify(advanced.errors));
      assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.revision > started.revision, true);
    }
  });
  assert.equal(transport.register((candidate) => {
    capturedExpectedRevision = candidate.expectedRevision;
    return resolveVoyageEventSessionStation(candidate, transport.remoteContext);
  }), true);
  const writes = fx.tracker.updates;
  const stale = await executeVoyagePlayerIntent(request, transport.socket);
  assert.equal(capturedExpectedRevision, started.revision);
  assert.equal(stale.ok, false);
  assert.equal(stale.errors[0].code, "m11-stale-session-revision");
  assert.equal(stationCalls, 1);
  // The deterministic pre-handler advance is the one expected canonical write;
  // the stale transported request must not add another.
  assert.equal(fx.tracker.updates, writes + 1);
});

test("transport preserves caller authority epoch when the active GM changes", async () => {
  const fx = fixture(); const locked = await launchAndLock(fx, "transport-epoch-drift", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "transport-epoch-drift-begin", sessionId: "transport-epoch-drift", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  let stationCalls = 0;
  const originalStation = fx.context.executeVoyagePf2ePendingCheck;
  fx.context.executeVoyagePf2ePendingCheck = async (pending) => { stationCalls += 1; return originalStation(pending); };
  let capturedAuthorityEpoch = null;
  const transport = realTransportFixture(fx, "captain-player", {
    beforeHandler: async (routedRequest) => {
      assert.equal(routedRequest.authorityEpoch, 0);
      const transition = await transferVoyageEventSessionControl({
        kind: "voyage.m11-transfer-control",
        requestId: "transport-epoch-drift-transfer",
        sessionId: "transport-epoch-drift",
        expectedRevision: started.revision,
        authorityEpoch: 0,
        targetUserId: "gm-1",
        reason: "canonical epoch drift witness"
      }, fx.context);
      assert.equal(transition.ok, true, JSON.stringify(transition.errors));
      assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.authorityEpoch, 1);
    }
  });
  assert.equal(transport.register((candidate) => {
    capturedAuthorityEpoch = candidate.authorityEpoch;
    return resolveVoyageEventSessionStation(candidate, transport.remoteContext);
  }), true);
  const writes = fx.tracker.updates;
  const result = await executeVoyagePlayerIntent({ kind: "voyage.m12-resolve-station", requestId: "transport-epoch-drift-roll", sessionId: "transport-epoch-drift", expectedRevision: started.revision, authorityEpoch: 0 }, transport.socket);
  assert.equal(capturedAuthorityEpoch, 0);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-control-transfer-required");
  assert.equal(stationCalls, 0);
  // The canonical transfer is the one expected authority write; the drifted
  // transported request must not add another.
  assert.equal(fx.tracker.updates, writes + 1);
});

test("transported player and GM station contenders share one coordinator winner", async () => {
  const fx = fixture(); const locked = await launchAndLock(fx, "transport-station-contention", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const transport = realTransportFixture(fx);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "transport-station-contention-begin", sessionId: "transport-station-contention", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  let stationCalls = 0;
  const executor = fx.context.executeVoyagePf2ePendingCheck;
  fx.context.executeVoyagePf2ePendingCheck = async (pending) => { stationCalls += 1; return executor(pending); };
  transport.remoteContext.executeVoyagePf2ePendingCheck = fx.context.executeVoyagePf2ePendingCheck;
  assert.equal(transport.register((request) => resolveVoyageEventSessionStation(request, transport.remoteContext)), true);
  const request = { kind: "voyage.m12-resolve-station", requestId: "transport-station-contention-player", sessionId: "transport-station-contention", expectedRevision: started.revision, authorityEpoch: 0 };
  const writes = fx.tracker.updates;
  const [playerResult, gmResult] = await Promise.all([
    executeVoyagePlayerIntent(request, transport.socket),
    resolveVoyageEventSessionStation({ ...request, requestId: "transport-station-contention-gm" }, fx.context)
  ]);
  assert.equal(stationCalls, 1);
  assert.equal([playerResult, gmResult].filter((entry) => entry.ok).length, 1);
  assert.equal(fx.tracker.updates, writes + 1);
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.events.filter((event) => event.type === "voyage.m12-action-segment").length, 1);
});

test("no active GM transport failure performs no local fallback or session write", async () => {
  const fx = fixture(); const locked = await launchAndLock(fx, "transport-no-gm", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "transport-no-gm-begin", sessionId: "transport-no-gm", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const writes = fx.tracker.updates;
  const gmWrites = fx.tracker.gmJournalWrites;
  const transport = realTransportFixture(fx, "captain-player", {
    executeAsGM: async () => { const error = new Error("no GM"); error.name = "SocketlibNoGMConnectedError"; throw error; }
  });
  let stationPf2eExecutorCalls = 0;
  let focusExecutorCalls = 0;
  let reactionCommitCalls = 0;
  fx.context.executeVoyagePf2ePendingCheck = async () => { stationPf2eExecutorCalls += 1; return null; };
  fx.context.executeVoyagePf2eFocusCheck = async () => { focusExecutorCalls += 1; return null; };
  fx.context.commitVoyageFocusReaction = async () => { reactionCommitCalls += 1; return null; };
  const result = await executeVoyagePlayerIntent({ kind: "voyage.m12-resolve-station", requestId: "transport-no-gm-roll", sessionId: "transport-no-gm", expectedRevision: started.revision, authorityEpoch: 0 }, transport.socket);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-active-gm-unavailable");
  assert.equal(result.errors[0].path, "transport.activeGm");
  assert.equal(fx.tracker.updates, writes);
  assert.equal(transport.playerDocumentAdapterWasInstalled, true);
  assert.equal(typeof transport.playerDocumentAdapter.update, "function");
  assert.equal(transport.playerJournalWrites, 0);
  assert.equal(fx.tracker.gmJournalWrites, gmWrites);
  assert.equal(stationPf2eExecutorCalls, 0);
  assert.equal(focusExecutorCalls, 0);
  assert.equal(reactionCommitCalls, 0);
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.events.filter((event) => event.type === "voyage.m12-action-segment").length, 0);
});

test("real transport and GM-local Focus contenders serialize to one winner", async () => {
  const fx = fixture(); fx.context.focusAbilities = [...M12_FOCUS_ABILITIES];
  const locked = await launchAndLock(fx, "transport-contention", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const transport = realTransportFixture(fx);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "transport-contention-begin", sessionId: "transport-contention", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const projection = readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId: "transport-contention-read", sessionId: "transport-contention", expectedRevision: started.revision }, transport.remoteContext);
  const reactionId = projection.projection.decisionOptions[0].reactionId;
  let focusCalls = 0; const originalFocus = fx.context.executeVoyagePf2eFocusCheck ?? fx.context.executeVoyagePf2ePendingCheck;
  fx.context.executeVoyagePf2eFocusCheck = async (pending) => { focusCalls += 1; return originalFocus(pending); };
  transport.remoteContext.executeVoyagePf2eFocusCheck = fx.context.executeVoyagePf2eFocusCheck;
  assert.equal(transport.register((request) => dispatchVoyageEventSessionCommand(request, transport.remoteContext)), true);
  const request = { kind: "voyage.m11-command", requestId: "transport-contention-player", sessionId: "transport-contention", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } };
  const writes = fx.tracker.updates;
  const [playerResult, gmResult] = await Promise.all([
    executeVoyagePlayerIntent(request, transport.socket),
    dispatchVoyageEventSessionCommand({ ...request, requestId: "transport-contention-gm" }, fx.context)
  ]);
  assert.equal([playerResult, gmResult].filter((entry) => entry.ok).length, 1);
  assert.equal(focusCalls, 1);
  assert.equal(fx.tracker.updates, writes + 3);
});

test("Slice H USE versus PASS contention resolves one shared reaction opportunity", async () => {
  const fx = fixture(); fx.context.focusAbilities = [...M12_FOCUS_ABILITIES];
  const locked = await launchAndLock(fx, "slice-h-use-pass-contention", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const transport = realTransportFixture(fx);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-h-use-pass-begin", sessionId: "slice-h-use-pass-contention", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const before = readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId: "slice-h-use-pass-read", sessionId: "slice-h-use-pass-contention", expectedRevision: started.revision }, transport.remoteContext);
  const reactionId = before.projection.decisionOptions[0].reactionId;
  let focusCalls = 0;
  const originalFocus = fx.context.executeVoyagePf2eFocusCheck ?? fx.context.executeVoyagePf2ePendingCheck;
  fx.context.executeVoyagePf2eFocusCheck = async (pending) => { focusCalls += 1; return originalFocus(pending); };
  transport.remoteContext.executeVoyagePf2eFocusCheck = fx.context.executeVoyagePf2eFocusCheck;
  assert.equal(transport.register((request) => dispatchVoyageEventSessionCommand(request, transport.remoteContext)), true);
  const writes = fx.tracker.updates;
  const useRequest = { kind: "voyage.m11-command", requestId: "slice-h-use-contender", sessionId: "slice-h-use-pass-contention", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } };
  const passRequest = { ...useRequest, requestId: "slice-h-pass-contender", commandKind: "focus-reaction-pass" };
  const [useResult, passResult] = await Promise.all([
    executeVoyagePlayerIntent(useRequest, transport.socket),
    dispatchVoyageEventSessionCommand(passRequest, fx.context)
  ]);
  const results = [useResult, passResult];
  assert.equal(results.filter((entry) => entry.ok).length, 1);
  assert.equal(focusCalls <= 1, true);
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  const successfulEvents = stored.events.filter((event) => ["voyage.m12-focus-reaction-use", "voyage.m12-focus-reaction-pass"].includes(event.type));
  const successfulAudits = stored.auditHistory.filter((entry) => ["m12-focus-reaction-used", "m12-focus-reaction-passed"].includes(entry.kind));
  assert.equal(successfulEvents.length, 1);
  assert.equal(successfulAudits.length, 1);
  assert.equal(stored.encounterState.metadata.reactionWindow.resolved.includes(reactionId), true);
  const useWon = successfulEvents[0].type === "voyage.m12-focus-reaction-use";
  assert.equal(stored.encounterState.metadata.focusPools.find((entry) => entry.stationId === "captain")?.current, useWon ? 0 : 1);
  assert.equal(fx.tracker.updates <= writes + 3, true);
  assert.equal(reloadVoyageEventSession("slice-h-use-pass-contention", fx.context).ok, true);
});

test("Slice H transported reaction request preserves revision during deterministic drift", async () => {
  const fx = fixture(); fx.context.focusAbilities = [...M12_FOCUS_ABILITIES];
  const locked = await launchAndLock(fx, "slice-h-revision-drift", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-h-revision-begin", sessionId: "slice-h-revision-drift", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const transport = realTransportFixture(fx, "captain-player", {
    beforeHandler: async (routedRequest) => {
      assert.equal(routedRequest.expectedRevision, started.revision);
      const advanced = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "slice-h-revision-advance", sessionId: "slice-h-revision-drift", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-pass", payload: { reactionId } }, fx.context);
      assert.equal(advanced.ok, true, JSON.stringify(advanced.errors));
      assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.revision, started.revision + 1);
    }
  });
  const before = readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId: "slice-h-revision-read", sessionId: "slice-h-revision-drift", expectedRevision: started.revision }, transport.remoteContext);
  const reactionId = before.projection.decisionOptions[0].reactionId;
  let capturedRevision = null; let focusCalls = 0; let stationCalls = 0;
  const originalFocus = fx.context.executeVoyagePf2eFocusCheck ?? fx.context.executeVoyagePf2ePendingCheck;
  fx.context.executeVoyagePf2eFocusCheck = async (pending) => { focusCalls += 1; return originalFocus(pending); };
  const originalStation = fx.context.executeVoyagePf2ePendingCheck;
  fx.context.executeVoyagePf2ePendingCheck = async (pending) => { stationCalls += 1; return originalStation(pending); };
  transport.remoteContext.executeVoyagePf2eFocusCheck = fx.context.executeVoyagePf2eFocusCheck;
  transport.remoteContext.executeVoyagePf2ePendingCheck = fx.context.executeVoyagePf2ePendingCheck;
  assert.equal(transport.register((request) => { capturedRevision = request.expectedRevision; return dispatchVoyageEventSessionCommand(request, transport.remoteContext); }), true);
  const writes = fx.tracker.updates;
  const result = await executeVoyagePlayerIntent({ kind: "voyage.m11-command", requestId: "slice-h-revision-use", sessionId: "slice-h-revision-drift", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } }, transport.socket);
  assert.equal(capturedRevision, started.revision);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-stale-session-revision");
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.revision, started.revision + 1);
  assert.equal(focusCalls, 0);
  assert.equal(stationCalls, 0);
  assert.equal(fx.tracker.updates, writes + 1);
});

test("Slice H transported reaction request preserves authority epoch during canonical transfer drift", async () => {
  const fx = fixture(); fx.context.focusAbilities = [...M12_FOCUS_ABILITIES];
  const locked = await launchAndLock(fx, "slice-h-epoch-drift", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-h-epoch-begin", sessionId: "slice-h-epoch-drift", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const transport = realTransportFixture(fx, "captain-player", {
    beforeHandler: async (routedRequest) => {
      assert.equal(routedRequest.authorityEpoch, 0);
      const transition = await transferVoyageEventSessionControl({ kind: "voyage.m11-transfer-control", requestId: "slice-h-epoch-transfer", sessionId: "slice-h-epoch-drift", expectedRevision: started.revision, authorityEpoch: 0, targetUserId: "gm-1", reason: "Slice H epoch drift witness" }, fx.context);
      assert.equal(transition.ok, true, JSON.stringify(transition.errors));
      assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.authorityEpoch, 1);
    }
  });
  const before = readVoyageEventSessionMultiplayerProjection({ kind: "voyage.m12-read-multiplayer-projection", requestId: "slice-h-epoch-read", sessionId: "slice-h-epoch-drift", expectedRevision: started.revision }, transport.remoteContext);
  const reactionId = before.projection.decisionOptions[0].reactionId;
  let capturedEpoch = null; let focusCalls = 0; let stationCalls = 0;
  const originalFocus = fx.context.executeVoyagePf2eFocusCheck ?? fx.context.executeVoyagePf2ePendingCheck;
  fx.context.executeVoyagePf2eFocusCheck = async (pending) => { focusCalls += 1; return originalFocus(pending); };
  const originalStation = fx.context.executeVoyagePf2ePendingCheck;
  fx.context.executeVoyagePf2ePendingCheck = async (pending) => { stationCalls += 1; return originalStation(pending); };
  transport.remoteContext.executeVoyagePf2eFocusCheck = fx.context.executeVoyagePf2eFocusCheck;
  transport.remoteContext.executeVoyagePf2ePendingCheck = fx.context.executeVoyagePf2ePendingCheck;
  assert.equal(transport.register((request) => { capturedEpoch = request.authorityEpoch; return dispatchVoyageEventSessionCommand(request, transport.remoteContext); }), true);
  const writes = fx.tracker.updates;
  const result = await executeVoyagePlayerIntent({ kind: "voyage.m11-command", requestId: "slice-h-epoch-use", sessionId: "slice-h-epoch-drift", expectedRevision: started.revision, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId } }, transport.socket);
  assert.equal(capturedEpoch, 0);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-control-transfer-required");
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.authorityEpoch, 1);
  assert.equal(focusCalls, 0);
  assert.equal(stationCalls, 0);
  assert.equal(fx.tracker.updates, writes + 1);
});

test("M12 trusted Focus authoring rejects the legacy short schema", async () => {
  const fx = fixture();
  fx.context.focusAbilities = [{
    focusAbilityId: "legacy-focus",
    trigger: "before-current-station-check",
    timing: "before-roll",
    cost: 1,
    stationId: "captain",
    targetStationId: "captain",
    statisticSlugOrAbilityId: "perception",
    dc: 18,
    secrecy: "public",
    outcomes: { criticalSuccess: 3, success: 1, failure: -1, criticalFailure: -3 }
  }];
  const locked = await launchAndLock(fx, "legacy-focus-session");
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "legacy-focus-begin", sessionId: "legacy-focus-session", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, false);
  assert.equal(started.errors[0].code, "m11-command-payload-invalid");
  assert.equal(fx.tracker.updates, 5);
});

test("M12 Task 3 rejects caller-authored calculated action results", async () => {
  const fx = fixture(); const locked = await launchAndLock(fx);
  const result = dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "forged", sessionId: "resolution-session", expectedRevision: locked.revision, authorityEpoch: 0, commandKind: "action-segment", payload: { executionResult: { result: { total: 999 } } } }, fx.context);
  assert.equal(result.ok, false); assert.equal(result.errors[0].code, "m11-command-payload-invalid"); assert.equal(fx.tracker.updates, 5);
});

test("M12 Task 3 abandons an active session without deleting history or mutating Actors", async () => {
  const fx = fixture(); const locked = await launchAndLock(fx);
  const request = { kind: "voyage.m11-abort-session", requestId: "abandon", sessionId: "resolution-session", expectedRevision: locked.revision, authorityEpoch: 0, reason: "GM test abandon", confirmation: true };
  const first = await abortVoyageEventSession(request, fx.context);
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  const writes = fx.tracker.updates;
  assert.equal(reloadVoyageEventSession("resolution-session", fx.context).status, "aborted");
  const replay = await abortVoyageEventSession(request, fx.context);
  assert.deepEqual(replay, first); assert.equal(fx.tracker.updates, writes); assert.equal(fx.tracker.actors, 0);
  const station = await resolveVoyageEventSessionStation({ kind: "voyage.m12-resolve-station", requestId: "after-abandon", sessionId: "resolution-session", expectedRevision: first.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(station.ok, false); assert.equal(station.errors[0].code, "m11-command-not-allowed");
});

test("M12 Task 3 verifies distinct and persisted-then-thrown abandonment without deleting history", async () => {
  const fx = fixture(); fx.tracker.distinctReread = true; const locked = await launchAndLock(fx);
  const request = { kind: "voyage.m11-abort-session", requestId: "abandon-distinct", sessionId: "resolution-session", expectedRevision: locked.revision, authorityEpoch: 0, reason: "GM test abandon", confirmation: true };
  const first = await abortVoyageEventSession(request, fx.context);
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  assert.equal(fx.tracker.updates, 6);
  assert.equal(fx.journals.length, 1);
  assert.equal(reloadVoyageEventSession("resolution-session", fx.context).status, "aborted");

  const secondFx = fixture(); const secondLocked = await launchAndLock(secondFx); secondFx.tracker.throwUpdate = true; secondFx.tracker.persistThenThrow = true;
  const second = await abortVoyageEventSession({ ...request, requestId: "abandon-persisted-throw", expectedRevision: secondLocked.revision }, secondFx.context);
  assert.equal(second.ok, true, JSON.stringify(second.errors));
  assert.equal(secondFx.tracker.updates, 6);
  assert.equal(secondFx.journals.length, 1);
  assert.equal(reloadVoyageEventSession("resolution-session", secondFx.context).status, "aborted");
});

test("M12 Task 3 validates all Round 1 authored checks against ordinary PF2e statistics", () => {
  const definition = getM12EventDefinition();
  const round = definition.rounds[0];
  assert.equal(round.availableStations.length, 5);
  for (const station of round.availableStations) {
    assert.equal(station.actions.length, 3);
    for (const action of station.actions) {
      assert.deepEqual(action.check.statisticOptions.length, 3);
      assert.equal(new Set(action.check.statisticOptions).size, 3);
      assert.equal(action.check.dcSource.kind, "fixed");
      assert.equal(action.check.dcSource.value, 18);
      assert.equal(action.approaches.length, 2);
      assert.ok(action.check.statisticOptions.includes(action.approaches[0].statisticSlugOrAbilityId));
    }
  }
});

test("M12 Task 3 rejects stale resolution start before any write", async () => {
  const fx = fixture(); const locked = await launchAndLock(fx);
  const result = await dispatchVoyageEventSessionCommand({
    kind: "voyage.m11-command", requestId: "resolution-stale", sessionId: "resolution-session",
    expectedRevision: locked.revision - 1, authorityEpoch: 0, commandKind: "resolution-start",
    payload: { phaseStartSnapshotId: "forged-stale-start" }
  }, fx.context);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-stale-session-revision");
  assert.equal(fx.tracker.updates, 5);
});

test("M12 Task 3 resolution start replays exactly without a second write", async () => {
  const fx = fixture(); const locked = await launchAndLock(fx);
  const request = {
    kind: "voyage.m11-command", requestId: "resolution-start", sessionId: "resolution-session",
    expectedRevision: locked.revision, authorityEpoch: 0, commandKind: "resolution-start",
    payload: { phaseStartSnapshotId: "resolution-start-snapshot" }
  };
  const trustedContext = { ...fx.context, __trustedResolutionStart: true };
  const first = await dispatchVoyageEventSessionCommand(request, trustedContext);
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  const writes = fx.tracker.updates;
  const replay = await dispatchVoyageEventSessionCommand(request, trustedContext);
  assert.deepEqual(replay, first);
  assert.equal(fx.tracker.updates, writes);
  assert.equal(reloadVoyageEventSession("resolution-session", fx.context).ok, true);
});

test("M12 Task 3 rejects caller-authored resolution-start snapshot evidence", async () => {
  const fx = fixture(); const locked = await launchAndLock(fx);
  const result = await dispatchVoyageEventSessionCommand({
    kind: "voyage.m11-command", requestId: "forged-resolution-start", sessionId: "resolution-session",
    expectedRevision: locked.revision, authorityEpoch: 0, commandKind: "resolution-start",
    payload: { phaseStartSnapshotId: "caller-authored" }
  }, fx.context);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-command-payload-invalid");
  assert.equal(fx.tracker.updates, 5);
});

test("M12 Slice I blocks broad Plan Unlock and persists an audited unresolved-order correction", async () => {
  const fx = fixture();
  const locked = await launchAndLock(fx, "slice-i-order", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-i-begin", sessionId: "slice-i-order", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const broad = await correctVoyageEventSession({ kind: "voyage.m11-correct-session", requestId: "slice-i-broad", sessionId: "slice-i-order", expectedRevision: started.revision, authorityEpoch: 0, correctionKind: "plan-unlock", targetRequestId: null, targetCheckpointId: null, replacementPayload: {}, reason: "not allowed after resolution", confirmation: true }, fx.context);
  assert.equal(broad.ok, false);
  assert.equal(broad.errors[0].code, "m11-command-not-allowed");
  const before = structuredClone(fx.journals[0].__testSource.flags.arcflight.system.voyageSession);
  const corrected = await correctVoyageEventSession({ kind: "voyage.m11-correct-session", requestId: "slice-i-order-correction", sessionId: "slice-i-order", expectedRevision: started.revision, authorityEpoch: 0, correctionKind: "remaining-order", targetRequestId: null, targetCheckpointId: null, replacementPayload: { stationOrder: ["engineer", "captain"] }, reason: "the unresolved order must follow the current safety handoff", confirmation: true }, fx.context);
  assert.equal(corrected.ok, true, JSON.stringify(corrected.errors));
  assert.equal(corrected.events[0].correctionKind, "remaining-order");
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  assert.deepEqual(stored.encounterState.committedStationOrder, ["engineer", "captain"]);
  assert.deepEqual(stored.encounterState.selections, before.encounterState.selections);
  assert.equal(reloadVoyageEventSession("slice-i-order", fx.context).ok, true);
  const replay = await correctVoyageEventSession({ kind: "voyage.m11-correct-session", requestId: "slice-i-order-correction", sessionId: "slice-i-order", expectedRevision: started.revision, authorityEpoch: 0, correctionKind: "remaining-order", targetRequestId: null, targetCheckpointId: null, replacementPayload: { stationOrder: ["engineer", "captain"] }, reason: "the unresolved order must follow the current safety handoff", confirmation: true }, fx.context);
  assert.deepEqual(replay, corrected);
});

test("M12 Slice I records GM operator takeover without changing station assignment", async () => {
  const fx = fixture();
  const locked = await launchAndLock(fx, "slice-i-takeover", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-i-takeover-begin", sessionId: "slice-i-takeover", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const priorAssignment = structuredClone(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.encounterState.stationAssignments);
  const takeoverContext = { ...fx.context, users: [{ id: "gm-1", isGM: true, active: true }, { id: "captain-owner", isGM: false, active: false }], resolveVoyageOperatorForPrincipal: (userId) => userId === "captain-owner" ? [{ kind: "actor", id: "captain", uuid: "Actor.captain", name: "captain" }] : [] };
  const takeover = await correctVoyageEventSession({ kind: "voyage.m11-correct-session", requestId: "slice-i-takeover", sessionId: "slice-i-takeover", expectedRevision: started.revision, authorityEpoch: 0, correctionKind: "operator-takeover", targetRequestId: null, targetCheckpointId: null, replacementPayload: { stationId: "captain" }, reason: "the assigned operator is disconnected", confirmation: true }, takeoverContext);
  assert.equal(takeover.ok, true, JSON.stringify(takeover.errors));
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  assert.deepEqual(stored.encounterState.stationAssignments, priorAssignment);
  assert.deepEqual(stored.encounterState.metadata.recoveryControl, { kind: "operator-takeover", stationId: "captain", operatorId: "captain", controllerUserId: "gm-1" });
  assert.equal(reloadVoyageEventSession("slice-i-takeover", fx.context).ok, true);
});

test("M12 Slice I binds check retry to a new pending identity and keeps old evidence", async () => {
  const fx = fixture();
  const locked = await launchAndLock(fx, "slice-i-retry", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-i-retry-begin", sessionId: "slice-i-retry", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  const original = structuredClone(stored.encounterState.pendingChecks[0]);
  stored.encounterState.metadata.pendingCheckIntegrationStatus = "failed";
  const voided = await correctVoyageEventSession({ kind: "voyage.m11-correct-session", requestId: "slice-i-void", sessionId: "slice-i-retry", expectedRevision: started.revision, authorityEpoch: 0, correctionKind: "void-roll", targetRequestId: null, targetCheckpointId: null, replacementPayload: { pendingCheckId: original.pendingCheckId }, reason: "the PF2e result was captured but must be voided", confirmation: true }, fx.context);
  assert.equal(voided.ok, true, JSON.stringify(voided.errors));
  const afterVoid = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  assert.notEqual(afterVoid.encounterState.pendingChecks[0].pendingCheckId, original.pendingCheckId);
  assert.equal(afterVoid.encounterState.metadata.sliceIRecovery[0].replacementPendingCheckId, afterVoid.encounterState.pendingChecks[0].pendingCheckId);
  assert.equal(reloadVoyageEventSession("slice-i-retry", fx.context).ok, true);
  const retry = await correctVoyageEventSession({ kind: "voyage.m11-correct-session", requestId: "slice-i-retry", sessionId: "slice-i-retry", expectedRevision: voided.revision, authorityEpoch: 0, correctionKind: "retry-roll-integration", targetRequestId: null, targetCheckpointId: null, replacementPayload: { pendingCheckId: original.pendingCheckId }, reason: "the PF2e result was captured but integration failed", confirmation: true }, fx.context);
  assert.equal(retry.ok, true, JSON.stringify(retry.errors));
  const after = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  assert.notEqual(after.encounterState.pendingChecks[0].pendingCheckId, original.pendingCheckId);
  assert.equal(after.encounterState.metadata.sliceIRecovery[0].originalPendingCheckId, original.pendingCheckId);
  assert.equal(reloadVoyageEventSession("slice-i-retry", fx.context).ok, true);
});

test("M12 Slice I rejects non-GM and pre-resolution recovery without writes", async () => {
  const fx = fixture();
  const locked = await launchAndLock(fx, "slice-i-authority", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const nonGm = { ...fx.context, authenticatedUserId: "player-1", authenticatedConnectionId: "connection-player-1", users: [{ id: "gm-1", isGM: true, active: true }, { id: "player-1", isGM: false, active: true }] };
  const rejected = await correctVoyageEventSession({ kind: "voyage.m11-correct-session", requestId: "slice-i-player", sessionId: "slice-i-authority", expectedRevision: locked.revision, authorityEpoch: 0, correctionKind: "operator-takeover", targetRequestId: null, targetCheckpointId: null, replacementPayload: { stationId: "captain" }, reason: "forged player recovery", confirmation: true }, nonGm);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.errors[0].code, "m11-active-gm-required");
  assert.equal(fx.tracker.updates, 5);
  const preResolution = await correctVoyageEventSession({ kind: "voyage.m11-correct-session", requestId: "slice-i-before-resolution", sessionId: "slice-i-authority", expectedRevision: locked.revision, authorityEpoch: 0, correctionKind: "remaining-order", targetRequestId: null, targetCheckpointId: null, replacementPayload: { stationOrder: ["engineer", "captain"] }, reason: "must be rejected before resolution", confirmation: true }, fx.context);
  assert.equal(preResolution.ok, false);
  assert.equal(preResolution.errors[0].code, "m11-command-not-allowed");
  assert.equal(fx.tracker.updates, 5);
});

test("M12 Slice I defers target and recorded-result corrections before missing callbacks", async () => {
  const fx = fixture();
  const locked = await launchAndLock(fx, "slice-i-deferred", { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "slice-i-deferred-begin", sessionId: "slice-i-deferred", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  let targetCalls = 0;
  let recordedCalls = 0;
  const context = {
    ...fx.context,
    applyVoyageEncounterTargetCorrection: async () => { targetCalls += 1; return { ok: true }; },
    applyVoyageEncounterRecordedResultCorrection: async () => { recordedCalls += 1; return { ok: true }; }
  };
  const before = structuredClone(fx.journals[0].__testSource.flags.arcflight.system.voyageSession);
  const target = await correctVoyageEventSession({ kind: "voyage.m11-correct-session", requestId: "slice-i-target-deferred", sessionId: "slice-i-deferred", expectedRevision: started.revision, authorityEpoch: 0, correctionKind: "target", targetRequestId: null, targetCheckpointId: null, replacementPayload: { stationId: "captain", targetStationId: "engineer" }, reason: "deferred target correction", confirmation: true }, context);
  assert.equal(target.ok, false);
  assert.equal(target.errors[0].code, "m11-command-not-allowed");
  const recorded = await correctVoyageEventSession({ kind: "voyage.m11-correct-session", requestId: "slice-i-recorded-deferred", sessionId: "slice-i-deferred", expectedRevision: started.revision, authorityEpoch: 0, correctionKind: "recorded-result", targetRequestId: null, targetCheckpointId: null, replacementPayload: { pendingCheckId: before.encounterState.pendingChecks[0].pendingCheckId, correctedResult: { total: 18, degreeOfSuccess: 2, degreeOfSuccessSlug: "success", statisticSlug: "acrobatics", dc: 18, rollMode: "public" } }, reason: "deferred recorded result correction", confirmation: true }, context);
  assert.equal(recorded.ok, false);
  assert.equal(recorded.errors[0].code, "m11-command-not-allowed");
  assert.equal(targetCalls, 0);
  assert.equal(recordedCalls, 0);
  assert.equal(fx.tracker.updates, 7);
  assert.deepEqual(fx.journals[0].__testSource.flags.arcflight.system.voyageSession, before);
});

test("M12 Slice I rejects active owners and unowned operators for takeover", async () => {
  const make = async (users, resolver, requestId) => {
    const fx = fixture();
    const locked = await launchAndLock(fx, requestId, { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
    const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: `${requestId}-begin`, sessionId: requestId, expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
    const context = { ...fx.context, users, resolveVoyageOperatorForPrincipal: resolver };
    const result = await correctVoyageEventSession({ kind: "voyage.m11-correct-session", requestId: `${requestId}-takeover`, sessionId: requestId, expectedRevision: started.revision, authorityEpoch: 0, correctionKind: "operator-takeover", targetRequestId: null, targetCheckpointId: null, replacementPayload: { stationId: "captain" }, reason: "takeover", confirmation: true }, context);
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "m11-correction-invalid");
    assert.equal(fx.tracker.updates, 7);
  };
  await make([{ id: "gm-1", isGM: true, active: true }, { id: "captain-owner", isGM: false, active: true }], () => [{ kind: "actor", id: "captain", uuid: "Actor.captain", name: "captain" }], "slice-i-active-owner");
  await make([{ id: "gm-1", isGM: true, active: true }], () => [], "slice-i-no-owner");
});

test("M12 Slice I player intent transport never accepts deferred correction commands", async () => {
  let calls = 0;
  const result = await executeVoyagePlayerIntent({ kind: "voyage.m11-command", requestId: "slice-i-player-deferred", sessionId: "slice-i-deferred-transport", expectedRevision: 0, authorityEpoch: 0, commandKind: "correct-session", payload: { correctionKind: "target" } }, { async executeAsGM() { calls += 1; return null; } });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-command-payload-invalid");
  assert.equal(calls, 0);
});

test("M12 Slice I rejects every tampered stored correction response without writes", async () => {
  const mutations = [
    ["revision", (response) => { response.revision += 1; }],
    ["authorityEpoch", (response) => { response.authorityEpoch += 1; }],
    ["requestId", (response) => { response.requestId = "forged-request"; }],
    ["projection", (response) => { response.projection = { leaked: true }; }],
    ["errors", (response) => { response.errors = [{ code: "forged" }]; }],
    ["warnings", (response) => { response.warnings = [{ code: "forged" }]; }]
  ];
  for (const [label, mutate] of mutations) {
    const fx = fixture();
    const locked = await launchAndLock(fx, `slice-i-response-${label}`, { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
    const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: `${label}-begin`, sessionId: `slice-i-response-${label}`, expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
    const corrected = await correctVoyageEventSession({ kind: "voyage.m11-correct-session", requestId: `${label}-correction`, sessionId: `slice-i-response-${label}`, expectedRevision: started.revision, authorityEpoch: 0, correctionKind: "remaining-order", targetRequestId: null, targetCheckpointId: null, replacementPayload: { stationOrder: ["engineer", "captain"] }, reason: "response tamper witness", confirmation: true }, fx.context);
    assert.equal(corrected.ok, true, JSON.stringify(corrected.errors));
    const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
    mutate(stored.processedRequests.at(-1).response);
    const writes = fx.tracker.updates;
    const reloaded = reloadVoyageEventSession(`slice-i-response-${label}`, fx.context);
    assert.equal(reloaded.ok, false, label);
    assert.equal(reloaded.errors[0].code, "m11-invalid-session-document", label);
    assert.equal(fx.tracker.updates, writes, label);
  }
});

test("M12 Slice I binds remaining-order audit deltas to persisted order history", async () => {
  const mutations = [
    ["before", (audit, stored) => { audit.details.before = ["engineer", "captain"]; }],
    ["after", (audit) => { audit.details.after = ["captain", "engineer"]; }],
    ["persisted-order", (audit, stored) => { stored.encounterState.committedStationOrder = ["captain", "engineer"]; }]
  ];
  for (const [label, mutate] of mutations) {
    const fx = fixture();
    const locked = await launchAndLock(fx, `slice-i-order-tamper-${label}`, { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
    const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: `${label}-begin`, sessionId: `slice-i-order-tamper-${label}`, expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
    const corrected = await correctVoyageEventSession({ kind: "voyage.m11-correct-session", requestId: `${label}-correction`, sessionId: `slice-i-order-tamper-${label}`, expectedRevision: started.revision, authorityEpoch: 0, correctionKind: "remaining-order", targetRequestId: null, targetCheckpointId: null, replacementPayload: { stationOrder: ["engineer", "captain"] }, reason: "order tamper witness", confirmation: true }, fx.context);
    assert.equal(corrected.ok, true, JSON.stringify(corrected.errors));
    const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
    const audit = stored.auditHistory.at(-1);
    mutate(audit, stored);
    const writes = fx.tracker.updates;
    const reloaded = reloadVoyageEventSession(`slice-i-order-tamper-${label}`, fx.context);
    assert.equal(reloaded.ok, false, label);
    assert.equal(reloaded.errors[0].code, "m11-invalid-session-document", label);
    assert.equal(fx.tracker.updates, writes, label);
  }
});

test("M12 Slice I binds takeover audit deltas to recoveryControl and assignment history", async () => {
  const mutations = [
    ["before", (audit) => { audit.details.before = { kind: "operator-takeover", stationId: "captain", operatorId: "captain", controllerUserId: "forged" }; }],
    ["after", (audit) => { audit.details.after = { kind: "operator-takeover", stationId: "captain", operatorId: "captain", controllerUserId: "forged" }; }],
    ["recovery-control", (_audit, stored) => { stored.encounterState.metadata.recoveryControl.controllerUserId = "forged"; }]
  ];
  for (const [label, mutate] of mutations) {
    const fx = fixture();
    const locked = await launchAndLock(fx, `slice-i-takeover-tamper-${label}`, { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
    const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: `${label}-begin`, sessionId: `slice-i-takeover-tamper-${label}`, expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
    const takeoverContext = { ...fx.context, users: [{ id: "gm-1", isGM: true, active: true }, { id: "captain-owner", isGM: false, active: false }], resolveVoyageOperatorForPrincipal: (userId) => userId === "captain-owner" ? [{ kind: "actor", id: "captain", uuid: "Actor.captain", name: "captain" }] : [] };
    const corrected = await correctVoyageEventSession({ kind: "voyage.m11-correct-session", requestId: `${label}-correction`, sessionId: `slice-i-takeover-tamper-${label}`, expectedRevision: started.revision, authorityEpoch: 0, correctionKind: "operator-takeover", targetRequestId: null, targetCheckpointId: null, replacementPayload: { stationId: "captain" }, reason: "takeover tamper witness", confirmation: true }, takeoverContext);
    assert.equal(corrected.ok, true, JSON.stringify(corrected.errors));
    const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
    mutate(stored.auditHistory.at(-1), stored);
    const writes = fx.tracker.updates;
    const reloaded = reloadVoyageEventSession(`slice-i-takeover-tamper-${label}`, fx.context);
    assert.equal(reloaded.ok, false, label);
    assert.equal(reloaded.errors[0].code, "m11-invalid-session-document", label);
    assert.equal(fx.tracker.updates, writes, label);
  }
});

test("M12 Slice I rejects forged void and retry audit deltas without writes", async () => {
  const fx = fixture();
  const sessionId = "slice-i-audit-void-retry";
  const locked = await launchAndLock(fx, sessionId, { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "audit-void-begin", sessionId, expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  stored.encounterState.metadata.pendingCheckIntegrationStatus = "failed";
  const original = structuredClone(stored.encounterState.pendingChecks[0]);
  const voided = await correctVoyageEventSession({ kind: "voyage.m11-correct-session", requestId: "audit-void", sessionId, expectedRevision: started.revision, authorityEpoch: 0, correctionKind: "void-roll", targetRequestId: null, targetCheckpointId: null, replacementPayload: { pendingCheckId: original.pendingCheckId }, reason: "void audit witness", confirmation: true }, fx.context);
  assert.equal(voided.ok, true, JSON.stringify(voided.errors));
  const voidStored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  voidStored.auditHistory.at(-1).details.after.pendingCheckId = "forged-void";
  let writes = fx.tracker.updates;
  let reloaded = reloadVoyageEventSession(sessionId, fx.context);
  assert.equal(reloaded.ok, false);
  assert.equal(reloaded.errors[0].code, "m11-invalid-session-document");
  assert.equal(fx.tracker.updates, writes);

  const retryFx = fixture();
  const retrySessionId = "slice-i-audit-retry";
  const retryLocked = await launchAndLock(retryFx, retrySessionId, { captain: "captain", engineer: "engineer" }, ["captain", "engineer"]);
  const retryStarted = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "audit-retry-begin", sessionId: retrySessionId, expectedRevision: retryLocked.revision, authorityEpoch: 0 }, retryFx.context);
  const retryStored = retryFx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  retryStored.encounterState.metadata.pendingCheckIntegrationStatus = "failed";
  const retryOriginal = structuredClone(retryStored.encounterState.pendingChecks[0]);
  const retryVoid = await correctVoyageEventSession({ kind: "voyage.m11-correct-session", requestId: "audit-retry-void", sessionId: retrySessionId, expectedRevision: retryStarted.revision, authorityEpoch: 0, correctionKind: "void-roll", targetRequestId: null, targetCheckpointId: null, replacementPayload: { pendingCheckId: retryOriginal.pendingCheckId }, reason: "retry audit witness", confirmation: true }, retryFx.context);
  const retried = await correctVoyageEventSession({ kind: "voyage.m11-correct-session", requestId: "audit-retry", sessionId: retrySessionId, expectedRevision: retryVoid.revision, authorityEpoch: 0, correctionKind: "retry-roll-integration", targetRequestId: null, targetCheckpointId: null, replacementPayload: { pendingCheckId: retryOriginal.pendingCheckId }, reason: "retry audit witness", confirmation: true }, retryFx.context);
  assert.equal(retried.ok, true, JSON.stringify(retried.errors));
  const retryCurrent = retryFx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  retryCurrent.auditHistory.at(-1).details.before.pendingCheckId = "forged-retry";
  writes = retryFx.tracker.updates;
  reloaded = reloadVoyageEventSession(retrySessionId, retryFx.context);
  assert.equal(reloaded.ok, false);
  assert.equal(reloaded.errors[0].code, "m11-invalid-session-document");
  assert.equal(retryFx.tracker.updates, writes);
});
