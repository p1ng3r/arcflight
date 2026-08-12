import test from "node:test";
import assert from "node:assert/strict";
import { buildVoyageEventManagerDashboardModel, launchVoyageEventSession, listVoyageEventLaunchShips, normalizeVoyageEventOperatorSelections } from "../../../scripts/voyage/foundry/event-launcher.js";
import { getM12EventDefinition, M12_DEFINITION_SNAPSHOT_ID, M12_EVENT_ID } from "../../../scripts/voyage/m12/event-definition.js";
import { analyzeVoyageEventDefinitionRoundActionAuthoring } from "../../../scripts/voyage/domain/round-action-authoring.js";
import { reloadVoyageEventSession, transferVoyageEventSessionControl } from "../../../scripts/voyage/foundry/event-session-runtime.js";

function actor(id, name, ship = false, tracker = null) { return { id, uuid: `Actor.${id}`, name, type: ship ? "vehicle" : "character", getFlag: (_module, key) => ship ? (key === "enabled" ? true : "ship") : false, async update() { if (tracker) tracker.actors += 1; return this; } }; }
function fixture() {
  const journals = [];
  const tracker = { creates: 0, updates: 0, deletes: 0, actors: 0, throwUpdate: false, persistThenThrow: false };
  const actors = [actor("ship-1", "The Cinderwake", true, tracker), actor("captain", "Captain Vale", false, tracker), actor("engineer", "Engineer Orr", false, tracker)];
  const document = (data) => {
    const source = { _id: data._id, flags: structuredClone(data.flags), name: data.name, pages: [] };
    return { id: source._id, __testSource: source, toObject: () => structuredClone(source), async update(payload) { tracker.updates += 1; source.flags.arcflight.system.voyageSession = structuredClone(payload["flags.arcflight.system.voyageSession"]); if (tracker.throwUpdate) { if (!tracker.persistThenThrow) delete source.flags.arcflight.system.voyageSession; throw new Error("update failed"); } return this; }, async delete() { tracker.deletes += 1; const index = journals.indexOf(this); if (index >= 0) journals.splice(index, 1); return this; } };
  };
  const context = {
    authenticatedUserId: "gm-1", authenticatedConnectionId: "connection-gm-1", trustedTransportContext: true, activeGmUserId: "gm-1",
    users: [{ id: "gm-1", isGM: true, active: true }], actors, journalEntries: journals,
    createDocumentId: () => "Journal.session-1", createVoyageTimestamp: () => "2026-08-12T12:00:00.000Z",
    JournalEntry: { async create(data) { tracker.creates += 1; const entry = document(data); journals.push(entry); return entry; } },
    isJournalEntryDocument: () => true,
    resolveEventDefinitionSnapshot: async () => getM12EventDefinition(),
    async runExclusiveSessionMutation(_descriptor, callback) {
      return callback({ connectionId: "connection-gm-1", occurredAt: "2026-08-12T12:00:00.000Z" });
    }
  };
  return { context, journals, actors, tracker };
}

test("M12 launch candidates and assignment normalization use canonical identities", () => {
  const fx = fixture();
  assert.deepEqual(listVoyageEventLaunchShips(fx.actors), [{ id: "ship-1", uuid: "Actor.ship-1", name: "The Cinderwake" }]);
  const normalized = normalizeVoyageEventOperatorSelections({ captain: "captain", engineer: "engineer", navigator: null }, fx.actors);
  assert.equal(normalized.valid, true);
  assert.deepEqual(normalized.assignments[0].operator, { kind: "actor", id: "captain", uuid: "Actor.captain", name: "Captain Vale" });
  assert.equal(normalizeVoyageEventOperatorSelections({ captain: "captain", engineer: "captain" }, fx.actors).valid, false);
});

test("registered M12 snapshot is directly Task-2-compatible across all three rounds", () => {
  const definition = getM12EventDefinition();
  const analysis = analyzeVoyageEventDefinitionRoundActionAuthoring(definition);
  assert.equal(analysis.authoringValid, true, JSON.stringify(analysis.errors));
  assert.equal(definition.rounds.length, 3);
  for (const round of definition.rounds) {
    for (const station of round.availableStations) assert.equal(station.actions.length, 3);
  }
});

test("M12 launch reaches Round 1 Crew Planning and replays idempotently", async () => {
  const fx = fixture();
  const request = { kind: "voyage.m12-launch-event", requestId: "launch-1", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: { captain: "captain", engineer: "engineer" } };
  const first = await launchVoyageEventSession(request, fx.context);
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  assert.equal(first.status, "crew-planning");
  assert.equal(first.revision, 5);
  assert.equal(fx.tracker.creates, 1);
  assert.equal(fx.tracker.updates, 1);
  const reloaded = reloadVoyageEventSession("session-1", fx.context);
  assert.equal(reloaded.ok, true, JSON.stringify(reloaded.errors));
  assert.equal(reloaded.sessionState ?? reloaded.status, "crew-planning");
  assert.deepEqual(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.checkpoints, []);
  const replay = await launchVoyageEventSession(request, fx.context);
  assert.deepEqual(replay, first);
  assert.equal(fx.tracker.updates, 1);
  assert.equal(fx.tracker.actors, 0);
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.encounterState.stationAssignments.length, 2);
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.encounterState.stationAssignments[0].operator.id, "captain");
  const conflict = await launchVoyageEventSession({ ...request, shipId: "ship-1", operatorSelections: { captain: "engineer" } }, fx.context);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.errors[0].code, "m11-request-id-conflict");
  assert.equal(fx.tracker.updates, 1);
});

test("M12 launch evidence remains reloadable after later control-transfer history", async () => {
  const fx = fixture();
  const request = { kind: "voyage.m12-launch-event", requestId: "historical-launch", sessionId: "session-historical-launch", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: {} };
  assert.equal((await launchVoyageEventSession(request, fx.context)).ok, true);
  const transfer = await transferVoyageEventSessionControl({ kind: "voyage.m11-transfer-control", requestId: "historical-transfer", sessionId: request.sessionId, expectedRevision: 5, authorityEpoch: 0, targetUserId: "gm-1", reason: "election" }, fx.context);
  assert.equal(transfer.ok, true, JSON.stringify(transfer.errors));
  const reloaded = reloadVoyageEventSession(request.sessionId, fx.context);
  assert.equal(reloaded.ok, true, JSON.stringify(reloaded.errors));
});

test("M12 launch rejects an invalid immutable snapshot before any write", async () => {
  const fx = fixture();
  fx.context.resolveEventDefinitionSnapshot = async () => ({ ...getM12EventDefinition(), roundCount: 4 });
  const result = await launchVoyageEventSession({ kind: "voyage.m12-launch-event", requestId: "invalid-snapshot", sessionId: "session-invalid", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: {} }, fx.context);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m12-event-definition-mismatch");
  assert.equal(fx.tracker.creates, 0); assert.equal(fx.tracker.updates, 0); assert.equal(fx.tracker.actors, 0);
});

test("M12 launch cleans an exact newly-created document after a failed final update and retries", async () => {
  const fx = fixture();
  fx.tracker.throwUpdate = true;
  const request = { kind: "voyage.m12-launch-event", requestId: "cleanup-launch", sessionId: "session-cleanup", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: {} };
  const failed = await launchVoyageEventSession(request, fx.context);
  assert.equal(failed.ok, false);
  assert.equal(fx.tracker.deletes, 1);
  assert.equal(fx.journals.length, 0);
  fx.tracker.throwUpdate = false;
  const retry = await launchVoyageEventSession(request, fx.context);
  assert.equal(retry.ok, true, JSON.stringify(retry.errors));
  assert.equal(fx.tracker.creates, 2);
});

test("M12 launch treats a persisted-then-thrown final update as exact success without cleanup", async () => {
  const fx = fixture();
  fx.tracker.throwUpdate = true;
  fx.tracker.persistThenThrow = true;
  const request = { kind: "voyage.m12-launch-event", requestId: "persisted-throw-launch", sessionId: "session-persisted-throw", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: {} };
  const result = await launchVoyageEventSession(request, fx.context);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(fx.tracker.deletes, 0);
  assert.equal(fx.tracker.updates, 1);
});

test("M12 launch requires the connected active GM and rejects stale launch authority", async () => {
  const inactive = fixture(); inactive.context.users[0].active = false;
  const base = { kind: "voyage.m12-launch-event", requestId: "auth-failure", sessionId: "session-auth", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: {} };
  const unauthorised = await launchVoyageEventSession(base, inactive.context);
  assert.equal(unauthorised.ok, false); assert.equal(unauthorised.errors[0].code, "m11-active-gm-required");
  const stale = fixture();
  const staleRevision = await launchVoyageEventSession({ ...base, requestId: "stale-revision", expectedRevision: 1 }, stale.context);
  assert.equal(staleRevision.ok, false); assert.equal(staleRevision.errors[0].code, "m11-stale-session-revision");
  const staleAuthority = await launchVoyageEventSession({ ...base, requestId: "stale-authority", authorityEpoch: 1 }, stale.context);
  assert.equal(staleAuthority.ok, false); assert.equal(staleAuthority.errors[0].code, "m11-control-transfer-required");
  assert.equal(stale.tracker.creates, 0); assert.equal(stale.tracker.updates, 0); assert.equal(stale.tracker.actors, 0);
});

test("M12 launch rechecks active-GM and connection authority inside the coordinator", async () => {
  const activeDrift = fixture();
  activeDrift.context.runExclusiveSessionMutation = async (_descriptor, callback) => { activeDrift.context.users[0].active = false; return callback({ connectionId: "connection-gm-1", occurredAt: "2026-08-12T12:00:00.000Z" }); };
  const base = { kind: "voyage.m12-launch-event", requestId: "authority-drift", sessionId: "session-authority-drift", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: {} };
  const activeResult = await launchVoyageEventSession(base, activeDrift.context);
  assert.equal(activeResult.ok, false);
  assert.equal(activeDrift.tracker.creates, 0);
  const connectionDrift = fixture();
  connectionDrift.context.runExclusiveSessionMutation = async (_descriptor, callback) => { connectionDrift.context.authenticatedConnectionId = "connection-changed"; return callback({ connectionId: "connection-gm-1", occurredAt: "2026-08-12T12:00:00.000Z" }); };
  const connectionResult = await launchVoyageEventSession({ ...base, requestId: "connection-drift", sessionId: "session-connection-drift" }, connectionDrift.context);
  assert.equal(connectionResult.ok, false);
  assert.equal(connectionDrift.tracker.creates, 0);
});

test("concurrent same-session launches have one durable winner", async () => {
  const fx = fixture();
  let occupied = false;
  fx.context.runExclusiveSessionMutation = async (_descriptor, callback) => {
    if (occupied) return null;
    occupied = true;
    try { return await callback({ connectionId: "connection-gm-1", occurredAt: "2026-08-12T12:00:00.000Z" }); } finally { occupied = false; }
  };
  const request = { kind: "voyage.m12-launch-event", requestId: "concurrent-launch", sessionId: "session-concurrent", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: {} };
  const [first, second] = await Promise.all([launchVoyageEventSession(request, fx.context), launchVoyageEventSession(request, fx.context)]);
  assert.equal([first, second].filter((result) => result.ok).length, 1);
  assert.equal(fx.tracker.creates, 1);
  assert.equal(fx.journals.length, 1);
});

test("M12 dashboard model is an isolated view of the persisted projection", () => {
  const projection = { schemaVersion: 1, sessionId: "session-1", revision: 5, sessionState: "crew-planning", lifecycleState: "draft", phase: null, roundNumber: null, momentum: 0, pressureSystems: [{ pressureSystemId: "crew-morale", value: 0, capacity: 2 }], activeHazards: [], stationAssignments: [{ stationId: "captain", operator: { kind: "actor", id: "captain", uuid: "Actor.captain", name: "Captain Vale" } }] };
  const dashboard = buildVoyageEventManagerDashboardModel(projection, undefined, "gm-1");
  assert.equal(dashboard.eventTitle, "The Glassback at Cinderwake Wreck");
  assert.equal(dashboard.activeGmUserId, "gm-1");
  dashboard.pressureSystems[0].value = 99; dashboard.stationAssignments[0].operator.name = "forged";
  assert.equal(projection.pressureSystems[0].value, 0); assert.equal(projection.stationAssignments[0].operator.name, "Captain Vale");
});

test("M12 Event Manager reopens one durable live session read-only and resolves its persisted ship identity", async () => {
  const fx = fixture();
  const request = { kind: "voyage.m12-launch-event", requestId: "reopen-launch", sessionId: "session-reopen", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: {} };
  assert.equal((await launchVoyageEventSession(request, fx.context)).ok, true);
  fx.journals[0].documentName = "JournalEntry";
  const previous = { foundry: globalThis.foundry, game: globalThis.game, ui: globalThis.ui, JournalEntry: globalThis.JournalEntry };
  try {
    const users = [{ id: "gm-1", isGM: true, active: true }];
    globalThis.foundry = { applications: { api: { HandlebarsApplicationMixin: (Base) => Base, ApplicationV2: class {} } } };
    globalThis.game = { user: users[0], users: { activeGM: users[0], contents: users }, socket: { id: "connection-gm-1" }, actors: fx.actors, journal: fx.journals, arcflight: { getM12EventDefinition: () => getM12EventDefinition() } };
    globalThis.ui = {};
    globalThis.JournalEntry = fx.context.JournalEntry;
    const { ArcflightEventManager } = await import(`../../../scripts/voyage/apps/event-manager.js?reopen=${Date.now()}`);
    const manager = new ArcflightEventManager();
    assert.equal(manager.discoverDurableSession(), true);
    const prepared = await manager._prepareContext();
    assert.equal(prepared.liveMode, true);
    assert.equal(prepared.sessionId, "session-reopen");
    assert.equal(prepared.dashboard.shipName, "The Cinderwake");
    assert.equal(fx.tracker.updates, 1);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
