import test from "node:test";
import assert from "node:assert/strict";
import { launchVoyageEventSession } from "../../../scripts/voyage/foundry/event-launcher.js";
import { getM12EventDefinition, M12_DEFINITION_SNAPSHOT_ID, M12_EVENT_ID } from "../../../scripts/voyage/m12/event-definition.js";
import { abortVoyageEventSession, applyVoyageEncounterAbortTransition, beginVoyageEventSessionResolution, dispatchVoyageEventSessionCommand, readVoyageEventSessionResolution, reloadVoyageEventSession, resolveVoyageEventSessionStation } from "../../../scripts/voyage/foundry/event-session-runtime.js";
import { prepareVoyageEncounterActionExecutionRequests } from "../../../scripts/voyage/domain/resolution-execution-requests.js";

function actor(id, type = "character") {
  return { id, uuid: `Actor.${id}`, name: id, type, getFlag: () => true };
}

function fixture() {
  const journals = [];
  const tracker = { creates: 0, updates: 0, actors: 0, distinctReread: false, jsonRoundTrip: false, throwUpdate: false, persistThenThrow: false };
  const document = (data, sharedSource = null) => {
    const source = sharedSource ?? { _id: data._id, flags: structuredClone(data.flags), name: "Session", pages: [] };
    const entry = { id: source._id, __testSource: source, toObject: () => structuredClone(source), async update(payload) { tracker.updates += 1; source.flags.arcflight.system.voyageSession = structuredClone(payload["flags.arcflight.system.voyageSession"]); if (tracker.distinctReread) { const index = journals.indexOf(entry); if (index >= 0) journals[index] = document(tracker.jsonRoundTrip ? JSON.parse(JSON.stringify({ _id: source._id, flags: source.flags })) : { _id: source._id, flags: source.flags }, source); } if (tracker.throwUpdate) { if (!tracker.persistThenThrow) delete source.flags.arcflight.system.voyageSession; throw new Error("update failed"); } return this; }, async delete() { journals.splice(journals.indexOf(entry), 1); } };
    return entry;
  };
  const actors = [actor("ship-1", "vehicle"), actor("captain"), actor("engineer")];
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

async function launchAndLock(fixtureValue) {
  const request = { kind: "voyage.m12-launch-event", requestId: "launch", sessionId: "resolution-session", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: { captain: "captain", engineer: "engineer" } };
  const launched = await launchVoyageEventSession(request, fixtureValue.context); assert.equal(launched.ok, true, JSON.stringify(launched.errors));
  const send = (requestId, expectedRevision, commandKind, payload) => dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId, sessionId: "resolution-session", expectedRevision, authorityEpoch: 0, commandKind, payload }, fixtureValue.context);
  let revision = launched.revision;
  for (const [stationId, actionId] of [["captain", "captain-round-1-action-1"], ["engineer", "engineer-round-1-action-1"]]) {
    const result = await send(`select-${stationId}`, revision, "station-selection", { stationId, actionId, approachId: `${actionId}-approach`, riskBidId: null }); assert.equal(result.ok, true, JSON.stringify(result.errors)); revision = result.revision;
  }
  const order = await send("order", revision, "station-order", { stationOrder: ["captain", "engineer"] }); assert.equal(order.ok, true, JSON.stringify(order.errors)); revision = order.revision;
  const locked = await send("lock", revision, "plan-lock", { phaseStartSnapshotId: "resolution-plan-lock" }); assert.equal(locked.ok, true, JSON.stringify(locked.errors));
  return locked;
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
  assert.equal(replay.ok, false);
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
  assert.equal(fx.tracker.updates, 6);
});

test("M12 Task 3 recognizes a persisted-then-thrown resolution start without a second write", async () => {
  const fx = fixture(); const locked = await launchAndLock(fx); fx.tracker.throwUpdate = true; fx.tracker.persistThenThrow = true;
  const started = await beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "begin-persisted-throw", sessionId: "resolution-session", expectedRevision: locked.revision, authorityEpoch: 0 }, fx.context);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  assert.equal(started.status, "station-resolution");
  assert.equal(fx.tracker.updates, 6);
  assert.equal(readVoyageEventSessionResolution("resolution-session", fx.context).projection.phase, "resolution");
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
      assert.equal(action.approaches.length, 1);
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
