import test from "node:test";
import assert from "node:assert/strict";
import { launchVoyageEventSession } from "../../../scripts/voyage/foundry/event-launcher.js";
import { getM12EventDefinition, M12_DEFINITION_SNAPSHOT_ID, M12_EVENT_ID, M12_FOCUS_ABILITIES } from "../../../scripts/voyage/m12/event-definition.js";
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
