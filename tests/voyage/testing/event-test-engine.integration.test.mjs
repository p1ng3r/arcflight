import test from "node:test";
import assert from "node:assert/strict";
import { createVoyageEventTestNamespace } from "../../../scripts/voyage/testing/event-test-engine.js";
import { dispatchVoyageEventSessionCommand } from "../../../scripts/voyage/foundry/event-session-runtime.js";
import { getM12EventDefinition, M12_FOCUS_ABILITIES } from "../../../scripts/voyage/m12/event-definition.js";
import { ARCFLIGHT_SHIP_ACTOR_TYPE } from "../../../scripts/documents/ships.js";

function actor(id, ship = false) {
  return { id, uuid: `Actor.${id}`, name: id, type: ship ? "vehicle" : "character", getFlag: (_m, key) => ship ? (key === "enabled" ? true : ARCFLIGHT_SHIP_ACTOR_TYPE) : undefined };
}
function fixture() {
  const entries = [];
  const tracker = { creates: 0, updates: 0, deletes: 0 };
  const actors = [actor("ship", true), ...["captain", "engineer", "navigator", "watchmaster", "veilwarden"].map((id) => actor(id))];
  const document = (data) => {
    const persisted = { _id: data._id, flags: structuredClone(data.flags), name: data.name, pages: [] };
    return {
      id: persisted._id,
      __testSource: persisted,
      toObject: () => structuredClone(persisted),
      async update(payload) { tracker.updates += 1; persisted.flags.arcflight.system.voyageSession = structuredClone(payload["flags.arcflight.system.voyageSession"]); return this; },
      async delete() { tracker.deletes += 1; const index = entries.indexOf(this); if (index >= 0) entries.splice(index, 1); }
    };
  };
  const users = [{ id: "gm-1", name: "GM", isGM: true, active: true }, { id: "player-1", name: "Player", isGM: false, active: true }];
  const context = {
    authenticatedUserId: "gm-1", authenticatedConnectionId: "conn", trustedTransportContext: true, activeGmUserId: "gm-1",
    users, actors, journalEntries: entries, createDocumentId: () => "Journal.event-test",
    resolveEventDefinitionSnapshot: () => getM12EventDefinition(),
    resolveVoyageOperatorForPrincipal: (userId) => userId === "player-1" ? [{ kind: "actor", id: "captain", uuid: "Actor.captain", name: "captain" }] : [],
    async runExclusiveSessionMutation(_descriptor, callback) { return callback({ connectionId: "conn", occurredAt: "2026-08-21T12:00:00.000Z" }); },
    JournalEntry: { async create(data) { tracker.creates += 1; const entry = document(data); entries.push(entry); return entry; } },
    isJournalEntryDocument: () => true
  };
  return { context, game: { user: users[0], users }, entries, tracker };
}
test("rapidPlan rejects ordinary non-test sessions before any planning write", async () => {
  const { fx, api, started, document } = await startedFixture();
  const beforeStart = document.toObject().flags.arcflight.system.voyageSession;
  const begun = await dispatchVoyageEventSessionCommand({
    kind: "voyage.m11-command",
    requestId: "event-test-ordinary-begin",
    sessionId: started.sessionId,
    expectedRevision: beforeStart.revision,
    authorityEpoch: beforeStart.authorityEpoch,
    commandKind: "begin-crew-planning",
    payload: { phaseStartSnapshotId: "event-test-ordinary-begin-snapshot" }
  }, fx.context);
  assert.equal(begun.ok, true, JSON.stringify(begun.errors));
  const before = document.toObject().flags.arcflight.system.voyageSession;
  delete document.__testSource.flags.arcflight.system.voyageSession.encounterState.metadata.testOrigin;
  const persistedBefore = document.toObject().flags.arcflight.system.voyageSession;
  const beforeUpdates = fx.tracker.updates;
  const result = await api.rapidPlan({ sessionId: started.sessionId, mode: "first-valid" });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m12-test-session-origin-required");
  assert.equal(fx.tracker.updates, beforeUpdates);
  const after = document.toObject().flags.arcflight.system.voyageSession;
  assert.equal(after.revision, before.revision);
  assert.equal(after.sessionState, before.sessionState);
  assert.deepEqual(after, persistedBefore);
});
test("start and rapidPlan use the real launch and planning lifecycle", async () => {
  const fx = fixture();
  const api = createVoyageEventTestNamespace({ getContext: () => fx.context, getGame: () => fx.game });
  const started = await api.start({ shipId: "ship", operatorSelections: Object.fromEntries(["captain", "engineer", "navigator", "watchmaster", "veilwarden"].map((id) => [id, id])) });
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const planned = await api.rapidPlan({ sessionId: started.sessionId, mode: "first-valid" });
  assert.equal(planned.ok, true, JSON.stringify(planned.errors));
  assert.equal(planned.snapshot.session.sessionState, "station-resolution");
  assert.equal(planned.snapshot.session.phase, "resolution");
  assert.equal(planned.snapshot.resolution.pendingChecks.length, 5);
  const player = await api.inspectAs({ sessionId: started.sessionId, userId: "player-1" });
  assert.equal(player.ok, true, JSON.stringify(player.errors));
  assert.equal(player.projection.projectionRole, "operator");
  assert.equal(player.projection.assignedStations.length, 1);
});
async function startedFixture(input = {}) {
  const fx = fixture();
  const api = createVoyageEventTestNamespace({ getContext: () => fx.context, getGame: () => fx.game });
  const started = await api.start({ shipId: "ship", operatorSelections: Object.fromEntries(["captain", "engineer", "navigator", "watchmaster", "veilwarden"].map((id) => [id, id])), ...input });
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  return { fx, api, started, document: fx.entries[0] };
}

test("eventTest.start persists the canonical test-origin marker", async () => {
  const { started, document } = await startedFixture();
  const session = document.toObject().flags.arcflight.system.voyageSession;
  assert.deepEqual(Object.keys(session.encounterState.metadata.testOrigin), ["kind", "createdByUserId", "createdAt"]);
  assert.equal(session.encounterState.metadata.testOrigin.kind, "arcflight-event-test");
  assert.equal(session.encounterState.metadata.testOrigin.createdByUserId, "gm-1");
  assert.equal(started.revision, 4);
});

test("marked test sessions remain valid through normal reread", async () => {
  const { fx, api, started } = await startedFixture();
  const reread = await api.inspect({ sessionId: started.sessionId });
  assert.equal(reread.ok, true, JSON.stringify(reread.errors));
  assert.equal(fx.entries[0].toObject().flags.arcflight.system.voyageSession.encounterState.metadata.testOrigin.kind, "arcflight-event-test");
  assert.equal(fx.tracker.updates > 0, true);
});

test("eventTest.abandon removes only the marked session container", async () => {
  const { fx, api, started } = await startedFixture();
  const beforeUpdates = fx.tracker.updates;
  const result = await api.abandon({ sessionId: started.sessionId });
  assert.deepEqual(result, { ok: true, sessionId: started.sessionId, status: "abandoned", deleted: true });
  assert.equal(fx.entries.length, 0);
  assert.equal(fx.tracker.deletes, 1);
  assert.equal(fx.tracker.updates, beforeUpdates);
});

test("abandon performs no ship or gameplay persistence", async () => {
  const { fx, api, started } = await startedFixture();
  const actorSnapshot = fx.context.actors.map((actor) => ({ id: actor.id, uuid: actor.uuid, name: actor.name, type: actor.type }));
  await api.abandon({ sessionId: started.sessionId });
  assert.deepEqual(fx.context.actors.map((actor) => ({ id: actor.id, uuid: actor.uuid, name: actor.name, type: actor.type })), actorSnapshot);
  assert.equal(fx.tracker.creates, 1);
  assert.equal(fx.tracker.updates > 0, true);
});

test("abandon does not run closeout, hazard, or Void Scar processing", async () => {
  const { fx, api, started } = await startedFixture();
  const result = await api.abandon({ sessionId: started.sessionId });
  assert.equal(result.ok, true);
  assert.equal(fx.entries.some((entry) => entry.toObject().flags?.arcflight?.system?.voyageSession), false);
});

test("abandon rejects an ordinary unmarked session with zero writes", async () => {
  const { fx, api, started } = await startedFixture();
  const session = fx.entries[0].__testSource.flags.arcflight.system.voyageSession;
  delete session.encounterState.metadata.testOrigin;
  const before = { updates: fx.tracker.updates, deletes: fx.tracker.deletes };
  const result = await api.abandon({ sessionId: started.sessionId });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m12-test-session-origin-required");
  assert.deepEqual({ updates: fx.tracker.updates, deletes: fx.tracker.deletes }, before);
  assert.equal(fx.entries.length, 1);
});

test("abandon rejects a wrong session ID without writes", async () => {
  const { fx, api, started } = await startedFixture();
  const before = { updates: fx.tracker.updates, deletes: fx.tracker.deletes };
  const result = await api.abandon({ sessionId: `${started.sessionId}-wrong` });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-session-document-not-found");
  assert.deepEqual({ updates: fx.tracker.updates, deletes: fx.tracker.deletes }, before);
});

test("players cannot abandon a test session", async () => {
  const { fx, api, started } = await startedFixture();
  fx.context.authenticatedUserId = "player-1";
  fx.game.user = fx.context.users[1];
  const before = { updates: fx.tracker.updates, deletes: fx.tracker.deletes };
  const result = await api.abandon({ sessionId: started.sessionId });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-active-gm-required");
  assert.deepEqual({ updates: fx.tracker.updates, deletes: fx.tracker.deletes }, before);
});

test("inactive GMs cannot abandon a test session", async () => {
  const { fx, api, started } = await startedFixture();
  fx.context.users[0].active = false;
  fx.game.user.active = false;
  const before = { updates: fx.tracker.updates, deletes: fx.tracker.deletes };
  const result = await api.abandon({ sessionId: started.sessionId });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-active-gm-required");
  assert.deepEqual({ updates: fx.tracker.updates, deletes: fx.tracker.deletes }, before);
});

test("active-session launch conflict leaves the attempted ID absent", async () => {
  const { fx, api, started } = await startedFixture();
  const beforeCreates = fx.tracker.creates;
  const attempted = "voyage-session-a3920558-a660-4ef3-89c2-b46c3a429da9";
  const result = await api.start({ sessionId: attempted, shipId: "ship" });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m12-active-session-conflict");
  assert.equal(fx.tracker.creates, beforeCreates);
  assert.equal(fx.entries.filter((entry) => entry.toObject().flags.arcflight.system.voyageSession.sessionId === attempted).length, 0);
  assert.equal(fx.entries.length, 1);
  assert.equal(fx.entries[0].toObject().flags.arcflight.system.voyageSession.sessionId, started.sessionId);
});

test("legacy claim rejects a missing session without writes", async () => {
  const { fx, api } = await startedFixture();
  const before = { updates: fx.tracker.updates, deletes: fx.tracker.deletes };
  const result = await api.claimLegacyTestSession({ sessionId: "voyage-session-77a382de-1d6d-4bf9-a3d7-673057f0e6b5", expectedRevision: 25 });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-session-document-not-found");
  assert.deepEqual({ updates: fx.tracker.updates, deletes: fx.tracker.deletes }, before);
});

test("legacy claim rejects a revision mismatch before lookup", async () => {
  const { fx, api } = await startedFixture();
  const before = { updates: fx.tracker.updates, deletes: fx.tracker.deletes };
  const result = await api.claimLegacyTestSession({ sessionId: "voyage-session-77a382de-1d6d-4bf9-a3d7-673057f0e6b5", expectedRevision: 24 });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m12-legacy-test-claim-rejected");
  assert.deepEqual({ updates: fx.tracker.updates, deletes: fx.tracker.deletes }, before);
});

test("legacy claim rejects an event mismatch before lookup", async () => {
  const { fx, api } = await startedFixture();
  const before = { updates: fx.tracker.updates, deletes: fx.tracker.deletes };
  const result = await api.claimLegacyTestSession({ sessionId: "other-session", expectedRevision: 25 });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m12-legacy-test-claim-rejected");
  assert.deepEqual({ updates: fx.tracker.updates, deletes: fx.tracker.deletes }, before);
});

test("legacy claim rejects malformed lifecycle input without writes", async () => {
  const { fx, api } = await startedFixture();
  const before = { updates: fx.tracker.updates, deletes: fx.tracker.deletes };
  const result = await api.claimLegacyTestSession({ sessionId: "voyage-session-77a382de-1d6d-4bf9-a3d7-673057f0e6b5", expectedRevision: 25, extra: true });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m12-legacy-test-claim-rejected");
  assert.deepEqual({ updates: fx.tracker.updates, deletes: fx.tracker.deletes }, before);
});

test("legacy claim does not alter an unrelated test session", async () => {
  const { fx, api, started } = await startedFixture();
  const before = structuredClone(fx.entries[0].toObject().flags.arcflight.system.voyageSession);
  await api.claimLegacyTestSession({ sessionId: "voyage-session-77a382de-1d6d-4bf9-a3d7-673057f0e6b5", expectedRevision: 25 });
  const after = fx.entries[0].toObject().flags.arcflight.system.voyageSession;
  assert.deepEqual(after, before);
  assert.equal(after.sessionId, started.sessionId);
});
test("abandon rejects extra Journal identifiers", async () => {
  const { fx, api, started } = await startedFixture();
  const before = { updates: fx.tracker.updates, deletes: fx.tracker.deletes };
  const result = await api.abandon({ sessionId: started.sessionId, documentId: fx.entries[0].id });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-invalid-request-shape");
  assert.deepEqual({ updates: fx.tracker.updates, deletes: fx.tracker.deletes }, before);
});

test("abandon rejects a blank session ID", async () => {
  const { fx, api } = await startedFixture();
  const before = { updates: fx.tracker.updates, deletes: fx.tracker.deletes };
  const result = await api.abandon({ sessionId: "" });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-invalid-request-shape");
  assert.deepEqual({ updates: fx.tracker.updates, deletes: fx.tracker.deletes }, before);
});

test("abandon remains write-free after the test session is already removed", async () => {
  const { fx, api, started } = await startedFixture();
  const first = await api.abandon({ sessionId: started.sessionId });
  assert.equal(first.ok, true);
  const before = { updates: fx.tracker.updates, deletes: fx.tracker.deletes };
  const second = await api.abandon({ sessionId: started.sessionId });
  assert.equal(second.ok, false);
  assert.equal(second.errors[0].code, "m11-session-document-not-found");
  assert.deepEqual({ updates: fx.tracker.updates, deletes: fx.tracker.deletes }, before);
});

test("legacy claim rejects a non-object request", async () => {
  const { fx, api } = await startedFixture();
  const before = { updates: fx.tracker.updates, deletes: fx.tracker.deletes };
  const result = await api.claimLegacyTestSession(null);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m12-legacy-test-claim-rejected");
  assert.deepEqual({ updates: fx.tracker.updates, deletes: fx.tracker.deletes }, before);
});
async function readyResolutionFixture(input = {}) {
  const fx = await startedFixture(input);
  const planned = await fx.api.rapidPlan({ sessionId: fx.started.sessionId });
  assert.equal(planned.ok, true, JSON.stringify(planned.errors));
  return fx;
}

test("passCurrentReaction clears exactly the live reaction through the canonical runtime", async () => {
  const { fx, api, started } = await startedFixture();
  fx.context.focusAbilities = [...M12_FOCUS_ABILITIES];
  const planned = await api.rapidPlan({ sessionId: started.sessionId });
  assert.equal(planned.ok, true, JSON.stringify(planned.errors));
  const reaction = planned.snapshot.resolution.currentReaction[0];
  assert.ok(reaction?.reactionId);
  const beforeWrites = fx.tracker.updates;
  const pass = await api.passCurrentReaction({ sessionId: started.sessionId });
  assert.equal(pass.ok, true, JSON.stringify(pass.errors));
  assert.equal(pass.passedReactionId, reaction.reactionId);
  assert.equal(pass.revision, planned.revision + 1);
  assert.equal(pass.snapshot.resolution.currentReaction.length, 0);
  assert.equal(pass.snapshot.resolution.pendingChecks.find((entry) => entry.stationId === "captain").status, "pending");
  assert.equal(fx.tracker.updates, beforeWrites + 1);
  const stored = fx.entries[0].toObject().flags.arcflight.system.voyageSession;
  assert.equal(stored.events.filter((entry) => entry.type === "voyage.m12-focus-reaction-pass").length, 1);
  assert.equal(stored.auditHistory.filter((entry) => entry.kind === "m12-focus-reaction-passed").length, 1);
  assert.equal(stored.events.some((entry) => entry.type === "voyage.m12-focus-reaction-use"), false);
  assert.equal(stored.encounterState.metadata.focusPendingCheck ?? null, null);
  const resolved = await api.resolveStation({ sessionId: started.sessionId, degree: "success" });
  assert.equal(resolved.ok, true, JSON.stringify(resolved.errors));
  assert.equal(resolved.resolvedStationId, "captain");
});

test("passCurrentReaction rejects an empty reaction window without writes", async () => {
  const { fx, api, started } = await readyResolutionFixture();
  const before = fx.tracker.updates;
  const malformed = await api.passCurrentReaction(started.sessionId);
  assert.equal(malformed.ok, false);
  assert.equal(malformed.errors[0].code, "m11-invalid-request-shape");
  const extra = await api.passCurrentReaction({ sessionId: started.sessionId, reactionId: "forged" });
  assert.equal(extra.ok, false);
  assert.equal(extra.errors[0].code, "m11-invalid-request-shape");
  const result = await api.passCurrentReaction({ sessionId: started.sessionId });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-command-not-allowed");
  assert.equal(fx.tracker.updates, before);
});

test("passCurrentReaction requires the active GM and a marked test session", async () => {
  const player = await startedFixture();
  const playerWrites = player.fx.tracker.updates;
  player.fx.context.authenticatedUserId = "player-1";
  player.fx.game.user = player.fx.context.users[1];
  const deniedPlayer = await player.api.passCurrentReaction({ sessionId: player.started.sessionId });
  assert.equal(deniedPlayer.ok, false);
  assert.equal(deniedPlayer.errors[0].code, "m11-active-gm-required");
  assert.equal(player.fx.tracker.updates, playerWrites);

  const inactive = await startedFixture();
  const inactiveWrites = inactive.fx.tracker.updates;
  inactive.fx.context.users[0].active = false;
  inactive.fx.game.user.active = false;
  const deniedInactive = await inactive.api.passCurrentReaction({ sessionId: inactive.started.sessionId });
  assert.equal(deniedInactive.ok, false);
  assert.equal(deniedInactive.errors[0].code, "m11-active-gm-required");
  assert.equal(inactive.fx.tracker.updates, inactiveWrites);

  const unmarked = await startedFixture();
  delete unmarked.fx.entries[0].__testSource.flags.arcflight.system.voyageSession.encounterState.metadata.testOrigin;
  const unmarkedWrites = unmarked.fx.tracker.updates;
  const deniedUnmarked = await unmarked.api.passCurrentReaction({ sessionId: unmarked.started.sessionId });
  assert.equal(deniedUnmarked.ok, false);
  assert.equal(deniedUnmarked.errors[0].code, "m12-test-session-origin-required");
  assert.equal(unmarked.fx.tracker.updates, unmarkedWrites);
});

test("resolveStation resolves the omitted current station through the canonical runtime", async () => {
  const { fx, api, started } = await readyResolutionFixture();
  let realPf2eCalls = 0;
  fx.context.executeVoyagePf2ePendingCheck = async () => { realPf2eCalls += 1; throw new Error("must not call real executor"); };
  const before = fx.tracker.updates;
  const result = await api.resolveStation({ sessionId: started.sessionId, degree: "success" });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.resolvedStationId, "captain");
  assert.equal(result.requestedDegree, "success");
  assert.equal(result.snapshot.resolution.pendingChecks[0].status, "resolved");
  assert.equal(result.snapshot.resolution.pendingChecks[0].result.degreeOfSuccessSlug, "success");
  assert.equal(result.snapshot.resolution.currentStationId, "engineer");
  assert.equal(fx.tracker.updates, before + 1);
  assert.equal(realPf2eCalls, 0);
});

test("resolveStation accepts the explicit current station and preserves each requested degree", async () => {
  for (const degree of ["critical-success", "success", "failure", "critical-failure"]) {
    const { api, started } = await readyResolutionFixture();
    const result = await api.resolveStation({ sessionId: started.sessionId, stationId: "captain", degree });
    assert.equal(result.ok, true, degree + ": " + JSON.stringify(result.errors));
    assert.equal(result.resolvedStationId, "captain");
    assert.equal(result.requestedDegree, degree);
    assert.equal(result.snapshot.resolution.pendingChecks[0].result.degreeOfSuccessSlug, degree);
  }
});

test("resolveStation rejects invalid degree and out-of-order stations without writes", async () => {
  const { fx, api, started } = await readyResolutionFixture();
  const before = fx.tracker.updates;
  const invalidDegree = await api.resolveStation({ sessionId: started.sessionId, degree: "2" });
  assert.equal(invalidDegree.ok, false);
  assert.equal(invalidDegree.errors[0].code, "m11-invalid-request-shape");
  const outOfOrder = await api.resolveStation({ sessionId: started.sessionId, stationId: "engineer", degree: "success" });
  assert.equal(outOfOrder.ok, false);
  assert.equal(outOfOrder.errors[0].code, "m11-command-not-allowed");
  assert.equal(fx.tracker.updates, before);
});

test("resolveStation rejects a resolved station and does not double-apply it", async () => {
  const { fx, api, started } = await readyResolutionFixture();
  const first = await api.resolveStation({ sessionId: started.sessionId, stationId: "captain", degree: "failure" });
  assert.equal(first.ok, true);
  const before = fx.tracker.updates;
  const second = await api.resolveStation({ sessionId: started.sessionId, stationId: "captain", degree: "success" });
  assert.equal(second.ok, false);
  assert.equal(second.errors[0].code, "m11-command-not-allowed");
  assert.equal(fx.tracker.updates, before);
});

test("resolveStation rejects players and inactive GMs before any write", async () => {
  const player = await readyResolutionFixture();
  const playerUpdates = player.fx.tracker.updates;
  player.fx.context.authenticatedUserId = "player-1";
  player.fx.game.user = player.fx.context.users[1];
  const deniedPlayer = await player.api.resolveStation({ sessionId: player.started.sessionId, degree: "success" });
  assert.equal(deniedPlayer.ok, false);
  assert.equal(deniedPlayer.errors[0].code, "m11-active-gm-required");
  assert.equal(player.fx.tracker.updates, playerUpdates);

  const inactive = await readyResolutionFixture();
  const inactiveUpdates = inactive.fx.tracker.updates;
  inactive.fx.context.users[0].active = false;
  inactive.fx.game.user = inactive.fx.context.users[0];
  const deniedInactive = await inactive.api.resolveStation({ sessionId: inactive.started.sessionId, degree: "success" });
  assert.equal(deniedInactive.ok, false);
  assert.equal(deniedInactive.errors[0].code, "m11-active-gm-required");
  assert.equal(inactive.fx.tracker.updates, inactiveUpdates);
});

test("deterministic failure on an empty authored consequence branch adds no fabricated pressure", async () => {
  const { api, started } = await readyResolutionFixture();
  const result = await api.resolveStation({ sessionId: started.sessionId, degree: "failure" });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.ok(Object.values(result.snapshot.ship.pressureSystems).every((entry) => entry.value === 0));
  assert.deepEqual(result.snapshot.ship.activeHazards, []);
});

test("setPressure writes only the authoritative precondition and supports a no-op", async () => {
  const { fx, api, started, document } = await startedFixture();
  const before = document.toObject().flags.arcflight.system.voyageSession;
  const system = before.encounterState.pressureSystems["crew-morale"];
  const beforeUpdates = fx.tracker.updates;
  const result = await api.setPressure({ sessionId: started.sessionId, pressureSystemId: "crew-morale", value: system.capacity });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.pressureSystemId, "crew-morale");
  assert.equal(result.previousValue, system.value);
  assert.equal(result.value, system.capacity);
  assert.equal(result.capacity, system.capacity);
  assert.equal(result.changed, true);
  assert.equal(result.snapshot.ship.pressureSystems["crew-morale"].value, system.capacity);
  assert.equal(fx.tracker.updates, beforeUpdates + 1);
  const after = document.toObject().flags.arcflight.system.voyageSession;
  assert.equal(after.encounterState.pressureSystems["crew-morale"].value, system.capacity);
  assert.deepEqual(after.events, before.events);
  assert.deepEqual(after.auditHistory, before.auditHistory);
  assert.deepEqual(after.checkpoints, before.checkpoints);
  assert.deepEqual(after.processedRequests, before.processedRequests);
  assert.deepEqual(after.encounterState.pendingChecks, before.encounterState.pendingChecks);
  assert.deepEqual(after.encounterState.activeHazards, before.encounterState.activeHazards);
  assert.deepEqual(after.encounterState.metadata?.reactionWindow ?? null, before.encounterState.metadata?.reactionWindow ?? null);
  assert.equal(after.encounterState.pendingBreachSave ?? null, before.encounterState.pendingBreachSave ?? null);
  const noOp = await api.setPressure({ sessionId: started.sessionId, pressureSystemId: "crew-morale", value: system.capacity });
  assert.equal(noOp.ok, true, JSON.stringify(noOp.errors));
  assert.equal(noOp.previousValue, system.capacity);
  assert.equal(noOp.value, system.capacity);
  assert.equal(noOp.changed, false);
  assert.equal(fx.tracker.updates, beforeUpdates + 1);
  const reread = await api.inspect({ sessionId: started.sessionId });
  assert.equal(reread.ok, true, JSON.stringify(reread.errors));
  assert.equal(reread.snapshot.ship.pressureSystems["crew-morale"].value, system.capacity);
});

test("setPressure uses the persisted system capacity and rejects malformed values without writes", async () => {
  const { fx, api, started, document } = await startedFixture();
  const session = document.__testSource.flags.arcflight.system.voyageSession;
  session.encounterState.pressureSystems["crew-morale"].capacity = 5;
  const beforeUpdates = fx.tracker.updates;
  const zero = await api.setPressure({ sessionId: started.sessionId, pressureSystemId: "crew-morale", value: 0 });
  assert.equal(zero.ok, true, JSON.stringify(zero.errors));
  assert.equal(zero.value, 0);
  assert.equal(zero.changed, false);
  assert.equal(fx.tracker.updates, beforeUpdates);
  const accepted = await api.setPressure({ sessionId: started.sessionId, pressureSystemId: "crew-morale", value: 5 });
  assert.equal(accepted.ok, true, JSON.stringify(accepted.errors));
  assert.equal(accepted.capacity, 5);
  assert.equal(accepted.value, 5);
  const writesAfterAccepted = fx.tracker.updates;
  const invalidInputs = [
    { sessionId: started.sessionId, pressureSystemId: "crew-morale", value: -1 },
    { sessionId: started.sessionId, pressureSystemId: "crew-morale", value: 5.5 },
    { sessionId: started.sessionId, pressureSystemId: "crew-morale", value: "5" },
    { sessionId: started.sessionId, pressureSystemId: "crew-morale", value: 6 },
    { sessionId: started.sessionId, pressureSystemId: "unknown-system", value: 1 },
    { sessionId: started.sessionId, pressureSystemId: "crew-morale" }
  ];
  for (const input of invalidInputs) {
    const result = await api.setPressure(input);
    assert.equal(result.ok, false);
    assert.match(result.errors[0].code, /^m11-/);
    assert.equal(fx.tracker.updates, writesAfterAccepted);
  }
});

test("setPressure is active-GM-only and requires the marked test origin", async () => {
  const player = await startedFixture();
  const playerUpdates = player.fx.tracker.updates;
  player.fx.context.authenticatedUserId = "player-1";
  player.fx.game.user = player.fx.context.users[1];
  const deniedPlayer = await player.api.setPressure({ sessionId: player.started.sessionId, pressureSystemId: "crew-morale", value: 1 });
  assert.equal(deniedPlayer.ok, false);
  assert.equal(deniedPlayer.errors[0].code, "m11-active-gm-required");
  assert.equal(player.fx.tracker.updates, playerUpdates);

  const inactive = await startedFixture();
  const inactiveUpdates = inactive.fx.tracker.updates;
  inactive.fx.context.users[0].active = false;
  inactive.fx.game.user = inactive.fx.context.users[0];
  const deniedInactive = await inactive.api.setPressure({ sessionId: inactive.started.sessionId, pressureSystemId: "crew-morale", value: 1 });
  assert.equal(deniedInactive.ok, false);
  assert.equal(deniedInactive.errors[0].code, "m11-active-gm-required");
  assert.equal(inactive.fx.tracker.updates, inactiveUpdates);

  const unmarked = await startedFixture();
  const unmarkedSession = unmarked.document.__testSource.flags.arcflight.system.voyageSession;
  delete unmarkedSession.encounterState.metadata.testOrigin;
  const unmarkedUpdates = unmarked.fx.tracker.updates;
  const deniedUnmarked = await unmarked.api.setPressure({ sessionId: unmarked.started.sessionId, pressureSystemId: "crew-morale", value: 1 });
  assert.equal(deniedUnmarked.ok, false);
  assert.equal(deniedUnmarked.errors[0].code, "m12-test-session-origin-required");
  assert.equal(unmarked.fx.tracker.updates, unmarkedUpdates);
});

test("setPressure remains write-free for invalid or missing sessions", async () => {
  const { fx, api, started } = await startedFixture();
  const before = fx.tracker.updates;
  const missing = await api.setPressure({ sessionId: started.sessionId + "-missing", pressureSystemId: "crew-morale", value: 1 });
  assert.equal(missing.ok, false);
  assert.equal(missing.errors[0].code, "m11-session-document-not-found");
  assert.equal(fx.tracker.updates, before);
  const malformed = await api.setPressure({ sessionId: started.sessionId, pressureSystemId: "", value: 1 });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.errors[0].code, "m11-invalid-request-shape");
  assert.equal(fx.tracker.updates, before);
});
