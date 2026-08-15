import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildVoyageEventManagerDashboardModel, isVoyageEventSessionActive, isVoyageEventSessionTerminal, launchVoyageEventSession, listVoyageEventLaunchShips, normalizeVoyageEventOperatorSelections } from "../../../scripts/voyage/foundry/event-launcher.js";
import { getM12EventDefinition, M12_DEFINITION_SNAPSHOT_ID, M12_EVENT_ID, M12_FOCUS_ABILITIES } from "../../../scripts/voyage/m12/event-definition.js";
import { ARCFLIGHT_SHIP_ACTOR_TYPE } from "../../../scripts/documents/ships.js";
import { analyzeVoyageEventDefinitionRoundActionAuthoring } from "../../../scripts/voyage/domain/round-action-authoring.js";
import { abortVoyageEventSession, applyVoyageEncounterAbortTransition, correctVoyageEventSession, dispatchVoyageEventSessionCommand, readVoyageEventSessionPlanning, reloadVoyageEventSession, transferVoyageEventSessionControl } from "../../../scripts/voyage/foundry/event-session-runtime.js";

globalThis.foundry ??= { applications: { api: { HandlebarsApplicationMixin: (base) => base, ApplicationV2: class {} } } };
const { buildEventManagerResolutionPresentation, buildPlanningStations, buildVoyagePlanReview, buildVoyagePlanningOrder, buildVoyageRiskBidDependencies, buildVoyageStationSelectionClearCommand, isVoyagePlanReady, reorderVoyagePlanningOrder, EVENT_MANAGER_TAB_IDS, normalizeEventManagerTab } = await import("../../../scripts/voyage/apps/event-manager.js");
const { VOYAGE_STATION_ICON_REGISTRY, stationPresentation } = await import("../../../scripts/voyage/apps/station-icons.js");
const { VOYAGE_RESOURCE_ICON_REGISTRY, resourcePresentation } = await import("../../../scripts/voyage/apps/resource-icons.js");

function actor(id, name, ship = false, tracker = null, actorType = ARCFLIGHT_SHIP_ACTOR_TYPE, enabled = true) { return { id, uuid: `Actor.${id}`, name, type: ship ? "vehicle" : "character", getFlag: (_module, key) => ship ? (key === "enabled" ? enabled : actorType) : (key === "enabled" ? enabled : actorType), async update() { if (tracker) tracker.actors += 1; return this; } }; }
function fixture() {
  const journals = [];
  const tracker = { creates: 0, updates: 0, deletes: 0, actors: 0, throwUpdate: false, persistThenThrow: false, distinctReread: false, jsonRoundTrip: false };
  const actors = [actor("ship-1", "The Cinderwake", true, tracker), actor("captain", "Captain Vale", false, tracker), actor("engineer", "Engineer Orr", false, tracker)];
  const document = (data, sharedSource = null) => {
    const source = sharedSource ?? { _id: data._id, flags: structuredClone(data.flags), name: data.name, pages: [] };
    return { id: source._id, __testSource: source, toObject: () => structuredClone(source), async update(payload) { tracker.updates += 1; source.flags.arcflight.system.voyageSession = structuredClone(payload["flags.arcflight.system.voyageSession"]); if (tracker.throwUpdate) { if (!tracker.persistThenThrow) delete source.flags.arcflight.system.voyageSession; throw new Error("update failed"); } return this; }, async delete() { tracker.deletes += 1; const index = journals.indexOf(this); if (index >= 0) journals.splice(index, 1); return this; } };
  };
  const context = {
    authenticatedUserId: "gm-1", authenticatedConnectionId: "connection-gm-1", trustedTransportContext: true, activeGmUserId: "gm-1",
    users: [{ id: "gm-1", isGM: true, active: true }], actors, journalEntries: journals,
    createDocumentId: () => "Journal.session-1", createVoyageTimestamp: () => "2026-08-12T12:00:00.000Z",
    JournalEntry: { async create(data, operation) { tracker.creates += 1; if (typeof data?._id !== "string" || data._id.length === 0 || operation?.keepId !== true) throw new Error("Foundry create did not retain the preallocated JournalEntry ID"); const entry = document(data); if (tracker.distinctReread) { const persistedData = tracker.jsonRoundTrip ? JSON.parse(JSON.stringify(data)) : data; journals.push(tracker.jsonRoundTrip ? document(persistedData) : document(persistedData, entry.__testSource)); } else journals.push(entry); return entry; } },
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

test("M12 ship filtering requires the canonical enabled Arcflight vehicle identity", () => {
  const fx = fixture();
  const disabled = actor("disabled", "Disabled", true, null, ARCFLIGHT_SHIP_ACTOR_TYPE, false);
  const wrongType = actor("wrong-type", "Wrong Type", true, null, "ship", true);
  const nonVehicle = actor("character-ship", "Character Ship", false, null, ARCFLIGHT_SHIP_ACTOR_TYPE, true);
  assert.deepEqual(listVoyageEventLaunchShips([...fx.actors, disabled, wrongType, nonVehicle]), [{ id: "ship-1", uuid: "Actor.ship-1", name: "The Cinderwake" }]);
  assert.deepEqual(listVoyageEventLaunchShips([fx.actors[0]]), [{ id: "ship-1", uuid: "Actor.ship-1", name: "The Cinderwake" }]);
});

test("registered M12 snapshot is directly Task-2-compatible across all three rounds", () => {
  const definition = getM12EventDefinition();
    assert.equal(M12_DEFINITION_SNAPSHOT_ID, "m12-glassback-cinderwake-v3");
  assert.equal(definition.definitionSnapshotId, M12_DEFINITION_SNAPSHOT_ID);
  const analysis = analyzeVoyageEventDefinitionRoundActionAuthoring(definition);
  assert.equal(analysis.authoringValid, true, JSON.stringify(analysis.errors));
  assert.equal(definition.rounds.length, 3);
  for (const round of definition.rounds) {
    for (const station of round.availableStations) assert.equal(station.actions.length, 3);
  }
});

test("M12 vertical slice is handcrafted with transparent approaches and nonempty authored Risk Bids", () => {
  const definition = getM12EventDefinition();
  assert.deepEqual(definition.rounds.map((round) => Object.keys(round).slice(0, 6)), [
    ["roundId", "roundNumber", "title", "vignette", "situation", "objective"],
    ["roundId", "roundNumber", "title", "vignette", "situation", "objective"],
    ["roundId", "roundNumber", "title", "vignette", "situation", "objective"]
  ]);
  for (const round of definition.rounds) {
    assert.equal(typeof round.knownStakes, "string");
    for (const station of round.availableStations) {
      assert.equal(station.actions.length, 3);
      assert.equal(new Set(station.actions.map((action) => action.name)).size, 3);
      for (const action of station.actions) {
        assert.ok(action.description);
        assert.ok(action.approaches.length >= 1 && action.approaches.length <= 2);
        assert.ok(action.approaches.every((approach) => approach.name && approach.description));
        assert.ok(action.riskBidOptions.length >= 0 && action.riskBidOptions.length <= 3);
        assert.ok(action.riskBidOptions.every((option) => [2, 5, 8].includes(option.dcAdjustment)
          && option.outcomes.criticalSuccess.length > 0
          && option.outcomes.success.length > 0
          && option.outcomes.failure.length === 0
          && option.outcomes.criticalFailure.length === 0));
        const references = action.riskBidOptions.flatMap((option) => Object.values(option.outcomes).flat());
        assert.equal(new Set(references).size, references.length);
        assert.equal(new Set(action.outcomeDefinition.effectRules.map((rule) => rule.effectId)).size, action.outcomeDefinition.effectRules.length);
        assert.deepEqual(new Set(references), new Set(action.outcomeDefinition.effectRules.map((rule) => rule.effectId)));
        for (const option of action.riskBidOptions) {
          const stakes = action.riskBidPresentation[String(option.dcAdjustment)];
          assert.ok(stakes?.intendedBenefit && stakes.target);
          assert.ok(Object.values(stakes.outcome).every((text) => text && !/authored (benefit|consequence) applies/i.test(text)));
        }
      }
    }
  }
  for (const round of definition.rounds) {
    const riskActions = round.availableStations.flatMap((station) => station.actions.filter((action) => action.riskBidOptions.length > 0));
    assert.equal(riskActions.length, 4);
    assert.ok(round.availableStations.every((station) => station.actions.filter((action) => action.riskBidOptions.length > 0).length <= 2));
    assert.ok(round.availableStations.every((station) => station.actions.some((action) => action.riskBidOptions.length === 0)));
    for (const action of riskActions) {
      assert.ok(action.riskBidOptions.every((option) => action.riskBidPresentation[String(option.dcAdjustment)]?.mechanicalEffect?.effects?.length > 0));
    }
  }
  const mark = definition.rounds[0].availableStations.find((station) => station.stationId === "captain").actions.find((action) => action.name === "Mark the Beast");
  assert.deepEqual(mark.riskBidPresentation["2"].mechanicalEffect.effects, [{ effectKind: "roll-bonus", value: 1, targetStationIds: ["navigator"], activationTiming: "next-unresolved-check", consumptionTiming: "on-target-resolution", requiresSourceBeforeTarget: true }]);
  assert.deepEqual(mark.riskBidPresentation["5"].mechanicalEffect.effects.map(({ effectKind, value, targetStationIds }) => ({ effectKind, value, targetStationIds })), [
    { effectKind: "roll-bonus", value: 2, targetStationIds: ["navigator"] },
    { effectKind: "roll-bonus", value: 1, targetStationIds: ["watchmaster"] }
  ]);
  assert.equal(mark.riskBidPresentation["8"].mechanicalEffect.effects[0].effectKind, "degree-shift");
  assert.ok(/no additional Risk Bid penalty/.test(mark.riskBidPresentation["2"].outcome.failure));
  for (const stationId of definition.rounds[0].availableStations.map((station) => station.stationId)) {
    const signatures = definition.rounds.map((round) => JSON.stringify(round.availableStations.find((station) => station.stationId === stationId).actions.map((action) => ({
      name: action.name,
      description: action.description,
      approaches: action.approaches.map(({ name, description, statisticSlugOrAbilityId }) => ({ name, description, statisticSlugOrAbilityId })),
      bids: action.riskBidOptions.map(({ dcAdjustment, outcomes }) => ({ dcAdjustment, outcomes }))
    }))));
    assert.equal(new Set(signatures).size, definition.rounds.length, `${stationId} rounds must have distinct authored signatures`);
  }
  for (let stationIndex = 0; stationIndex < definition.rounds[0].availableStations.length; stationIndex += 1) {
    const namesByRound = definition.rounds.map((round) => round.availableStations[stationIndex].actions.map((action) => action.name).join("|"));
    assert.equal(new Set(namesByRound).size, definition.rounds.length);
  }
  const ability = M12_FOCUS_ABILITIES[0];
  assert.deepEqual(Object.keys(ability), ["focusAbilityId", "name", "description", "trigger", "timing", "cost", "stationId", "targetStationId", "eligibleSource", "targetRule", "check", "dcSource", "statisticSlugOrAbilityId", "dc", "secrecy", "outcomes", "outcomeNarration", "visibility", "narration"]);
  for (const field of ["focusAbilityId", "name", "description", "trigger", "timing", "cost", "stationId", "targetStationId", "eligibleSource", "targetRule", "check", "dcSource", "statisticSlugOrAbilityId", "dc", "secrecy", "outcomes", "outcomeNarration", "visibility", "narration"]) assert.ok(Object.hasOwn(ability, field), field);
  assert.deepEqual(Object.keys(ability.outcomes), ["criticalSuccess", "success", "failure", "criticalFailure"]);
  assert.ok(Object.values(ability.outcomeNarration).every((text) => text.length > 0));
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
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.encounterState.availableStations.every((station) => station.actions.length === 3), true);
  const conflict = await launchVoyageEventSession({ ...request, shipId: "ship-1", operatorSelections: { captain: "engineer" } }, fx.context);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.errors[0].code, "m11-request-id-conflict");
  assert.equal(fx.tracker.updates, 1);
});

test("M12 new launch keeps revision-0 draft canonical and hydrates Task 2 authored planning on read", async () => {
  const fx = fixture();
  const request = { kind: "voyage.m12-launch-event", requestId: "draft-launch", sessionId: "draft-session", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: { captain: "captain", engineer: "engineer" } };
  const launched = await launchVoyageEventSession(request, fx.context);
  assert.equal(launched.ok, true, JSON.stringify(launched.errors));
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  assert.equal(stored.revision, 5);
  assert.equal(stored.encounterState.availableStations.every((station) => station.actions.length === 3), true);
  const planning = readVoyageEventSessionPlanning("draft-session", fx.context);
  assert.equal(planning.ok, true, JSON.stringify(planning.errors));
  assert.equal(planning.projection.stations.length, 2);
  assert.equal(planning.projection.stations.every((station) => station.actions.length === 3), true);
  assert.deepEqual(stored.encounterState.selections, {});
  assert.deepEqual(stored.encounterState.riskBids, {});
  assert.deepEqual(stored.encounterState.proposedStationOrder, []);
  assert.deepEqual(stored.checkpoints, []);
});

test("M12 new launch verifies stable persisted ID across distinct create and reread document instances", async () => {
  const fx = fixture();
  fx.tracker.distinctReread = true;
  const request = { kind: "voyage.m12-launch-event", requestId: "distinct-launch", sessionId: "distinct-session", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: { captain: "captain", engineer: "engineer" } };
  const result = await launchVoyageEventSession(request, fx.context);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.revision, 5);
  assert.equal(fx.journals.length, 1);
  assert.equal(fx.journals[0].id, "Journal.session-1");
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.sessionId, "distinct-session");
  assert.equal(reloadVoyageEventSession("distinct-session", fx.context).ok, true);
});

test("M12 revision-zero creation survives Foundry-like JSON flag round-trip and distinct reread", async () => {
  const fx = fixture();
  fx.tracker.distinctReread = true;
  fx.tracker.jsonRoundTrip = true;
  const request = { kind: "voyage.m12-launch-event", requestId: "json-roundtrip-launch", sessionId: "json-roundtrip-session", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: { captain: "captain", engineer: "engineer" } };
  const result = await launchVoyageEventSession(request, fx.context);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.revision, 5);
  assert.equal(fx.journals.length, 1);
  assert.equal(fx.journals[0].id, "Journal.session-1");
  assert.equal(reloadVoyageEventSession("json-roundtrip-session", fx.context).ok, true);
});

test("M12 launch preserves the M11 revision-0 diagnostic at the public failure boundary", async () => {
  const fx = fixture();
  fx.context.JournalEntry.create = async () => { const error = new Error("Foundry create failed"); error.code = "ERR_CREATE"; error.cause = new Error("create cause"); throw error; };
  const request = { kind: "voyage.m12-launch-event", requestId: "diagnostic-launch", sessionId: "diagnostic-session", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: { captain: "captain", engineer: "engineer" } };
  const result = await launchVoyageEventSession(request, fx.context);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-session-write-failed");
  assert.equal(result.errors[0].diagnostic?.revision0Stage, "create-before");
  assert.equal(result.errors[0].diagnostic?.sessionId, "diagnostic-session");
  assert.equal(result.errors[0].diagnostic?.createErrorName, "Error");
  assert.equal(result.errors[0].diagnostic?.createErrorMessage, "Foundry create failed");
  assert.equal(result.errors[0].diagnostic?.createErrorCode, "ERR_CREATE");
  assert.equal(result.errors[0].diagnostic?.createErrorCauseMessage, "create cause");
  assert.equal(fx.tracker.creates, 0);
  assert.equal(fx.tracker.updates, 0);
});

test("M12 launch blocks a second active session before JournalEntry.create", async () => {
  const fx = fixture();
  const base = (requestId, sessionId) => ({ kind: "voyage.m12-launch-event", requestId, sessionId, expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: { captain: "captain", engineer: "engineer" } });
  const first = await launchVoyageEventSession(base("existing-launch", "existing-session"), fx.context);
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  const before = structuredClone(fx.journals[0].__testSource);
  const creates = fx.tracker.creates, updates = fx.tracker.updates;
  const second = await launchVoyageEventSession(base("new-launch", "new-session"), fx.context);
  assert.equal(second.ok, false);
  assert.deepEqual(second.errors[0], { code: "m12-active-session-conflict", path: "sessionId", message: "An active Event Session already exists. Complete or abort it before launching another.", severity: "error" });
  assert.equal(fx.tracker.creates, creates);
  assert.equal(fx.tracker.updates, updates);
  assert.deepEqual(fx.journals[0].__testSource, before);
  assert.equal(fx.journals.length, 1);
  assert.equal(reloadVoyageEventSession("existing-session", fx.context).ok, true);
});

test("M12 launch permits a new session when no active session exists", async () => {
  const fx = fixture();
  const request = { kind: "voyage.m12-launch-event", requestId: "new-launch", sessionId: "new-session", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: { captain: "captain", engineer: "engineer" } };
  const result = await launchVoyageEventSession(request, fx.context);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(fx.tracker.creates, 1);
  assert.equal(reloadVoyageEventSession("new-session", fx.context).ok, true);
});

test("M12 terminal session classification ignores abandoned history but blocks active sessions", () => {
  const abandoned = { sessionState: "aborted", encounterState: { lifecycleState: "abandoned" } };
  assert.equal(isVoyageEventSessionTerminal(abandoned), true);
  assert.equal(isVoyageEventSessionActive(abandoned), false);
  assert.equal(isVoyageEventSessionTerminal({ sessionState: "crew-planning", encounterState: { lifecycleState: "active" } }), false);
  assert.equal(isVoyageEventSessionActive({ sessionState: "crew-planning", encounterState: { lifecycleState: "active" } }), true);
  assert.equal(isVoyageEventSessionTerminal({ sessionState: "crew-planning", encounterState: { lifecycleState: "discarded" } }), true);
});

test("M12 abandoned session no longer blocks a fresh launch", async () => {
  const fx = fixture();
  fx.context.applyVoyageEncounterAbortTransition = applyVoyageEncounterAbortTransition;
  const first = await launchVoyageEventSession({ kind: "voyage.m12-launch-event", requestId: "abandon-launch", sessionId: "abandon-session", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: { captain: "captain" } }, fx.context);
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  const abandoned = await abortVoyageEventSession({ kind: "voyage.m11-abort-session", requestId: "abandon-session-request", sessionId: "abandon-session", expectedRevision: first.revision, authorityEpoch: 0, reason: "GM test abandon", confirmation: true }, fx.context);
  assert.equal(abandoned.ok, true, JSON.stringify(abandoned.errors));
  assert.equal(reloadVoyageEventSession("abandon-session", fx.context).status, "aborted");
  fx.context.createDocumentId = () => "Journal.session-2";
  const fresh = await launchVoyageEventSession({ kind: "voyage.m12-launch-event", requestId: "fresh-after-abandon", sessionId: "fresh-session", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: {} }, fx.context);
  assert.equal(fresh.ok, true, JSON.stringify(fresh.errors));
  assert.equal(fx.journals.length, 2);
});

test("M12 fresh launch after abandon verifies the new document by ID across distinct rereads", async () => {
  const fx = fixture();
  fx.context.applyVoyageEncounterAbortTransition = applyVoyageEncounterAbortTransition;
  const first = await launchVoyageEventSession({ kind: "voyage.m12-launch-event", requestId: "abandon-launch", sessionId: "abandon-session", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: { captain: "captain" } }, fx.context);
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  const abandoned = await abortVoyageEventSession({ kind: "voyage.m11-abort-session", requestId: "abandon-session-request", sessionId: "abandon-session", expectedRevision: first.revision, authorityEpoch: 0, reason: "GM test abandon", confirmation: true }, fx.context);
  assert.equal(abandoned.ok, true, JSON.stringify(abandoned.errors));
  fx.context.createDocumentId = () => "Journal.session-2";
  fx.tracker.distinctReread = true;
  const fresh = await launchVoyageEventSession({ kind: "voyage.m12-launch-event", requestId: "fresh-distinct-launch", sessionId: "fresh-session", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: {} }, fx.context);
  assert.equal(fresh.ok, true, JSON.stringify(fresh.errors));
  assert.equal(fx.journals.length, 2);
  assert.equal(fx.journals.filter((entry) => entry.id === "Journal.session-2").length, 1);
  assert.equal(reloadVoyageEventSession("abandon-session", fx.context).status, "aborted");
  assert.equal(reloadVoyageEventSession("fresh-session", fx.context).status, "crew-planning");
  assert.equal(fx.tracker.deletes, 0);
});

test("M12 fresh launch after abandon accepts a persisted-then-thrown update without cleanup", async () => {
  const fx = fixture();
  fx.context.applyVoyageEncounterAbortTransition = applyVoyageEncounterAbortTransition;
  const first = await launchVoyageEventSession({ kind: "voyage.m12-launch-event", requestId: "abandon-launch", sessionId: "abandon-session", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: { captain: "captain" } }, fx.context);
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  const abandoned = await abortVoyageEventSession({ kind: "voyage.m11-abort-session", requestId: "abandon-session-request", sessionId: "abandon-session", expectedRevision: first.revision, authorityEpoch: 0, reason: "GM test abandon", confirmation: true }, fx.context);
  assert.equal(abandoned.ok, true, JSON.stringify(abandoned.errors));
  const writesBeforeFresh = fx.tracker.updates;
  fx.context.createDocumentId = () => "Journal.session-2";
  fx.tracker.distinctReread = true;
  fx.tracker.throwUpdate = true;
  fx.tracker.persistThenThrow = true;
  const fresh = await launchVoyageEventSession({ kind: "voyage.m12-launch-event", requestId: "fresh-throw-launch", sessionId: "fresh-session", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: {} }, fx.context);
  assert.equal(fresh.ok, true, JSON.stringify(fresh.errors));
  assert.equal(fx.tracker.updates, writesBeforeFresh + 1);
  assert.equal(fx.tracker.deletes, 0);
  assert.equal(fx.journals.length, 2);
  assert.equal(reloadVoyageEventSession("fresh-session", fx.context).status, "crew-planning");
});

test("M12 historical Foundry Journals with exportSource accessors do not block repeated fresh launches", async () => {
  const fx = fixture();
  fx.context.applyVoyageEncounterAbortTransition = applyVoyageEncounterAbortTransition;
  const accessorized = (entry) => {
    entry.toObject = () => {
      const source = structuredClone(entry.__testSource);
      Object.defineProperty(source.flags, "exportSource", { enumerable: false, get() { throw new Error("exportSource must not be captured"); } });
      return source;
    };
  };
  const launch = async (requestId, sessionId, documentId) => {
    fx.context.createDocumentId = () => documentId;
    const result = await launchVoyageEventSession({ kind: "voyage.m12-launch-event", requestId, sessionId, expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: {} }, fx.context);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    const entry = fx.journals.find((candidate) => candidate.id === documentId);
    assert.ok(entry);
    accessorized(entry);
    return result;
  };
  const eventA = await launch("historical-a", "historical-session-a", "Journal.historical-a");
  const abandonedA = await abortVoyageEventSession({ kind: "voyage.m11-abort-session", requestId: "historical-abort-a", sessionId: "historical-session-a", expectedRevision: eventA.revision, authorityEpoch: 0, reason: "GM test abandon", confirmation: true }, fx.context);
  assert.equal(abandonedA.ok, true, JSON.stringify(abandonedA.errors));
  const eventB = await launch("historical-b", "historical-session-b", "Journal.historical-b");
  const abandonedB = await abortVoyageEventSession({ kind: "voyage.m11-abort-session", requestId: "historical-abort-b", sessionId: "historical-session-b", expectedRevision: eventB.revision, authorityEpoch: 0, reason: "GM test abandon", confirmation: true }, fx.context);
  assert.equal(abandonedB.ok, true, JSON.stringify(abandonedB.errors));
  const eventC = await launch("historical-c", "historical-session-c", "Journal.historical-c");
  assert.equal(eventC.status, "crew-planning");
  assert.equal(fx.tracker.creates, 3);
  assert.deepEqual(fx.journals.map((entry) => entry.id).sort(), ["Journal.historical-a", "Journal.historical-b", "Journal.historical-c"]);
  assert.equal(reloadVoyageEventSession("historical-session-a", fx.context).status, "aborted");
  assert.equal(reloadVoyageEventSession("historical-session-b", fx.context).status, "aborted");
  assert.equal(reloadVoyageEventSession("historical-session-c", fx.context).status, "crew-planning");
  assert.equal(fx.tracker.deletes, 0);
});

test("M12 different new-session launches share one world coordination claim", async () => {
  const fx = fixture();
  let nextDocumentId = 1;
  fx.context.createDocumentId = () => `Journal.concurrent-${nextDocumentId++}`;
  const entered = Promise.withResolvers();
  const winnerDone = Promise.withResolvers();
  let claimed = false;
  fx.context.runExclusiveSessionMutation = async (descriptor, callback) => {
    assert.equal(descriptor.sessionId, "arcflight-m12-event-launch-world");
    assert.equal(descriptor.sessionDocumentId, "arcflight-m12-event-launch-world");
    if (claimed) {
      await winnerDone.promise;
      return null;
    }
    claimed = true;
    entered.resolve();
    try { return await callback({ connectionId: descriptor.connectionId, occurredAt: "2026-08-12T12:00:00.000Z" }); }
    finally { claimed = false; winnerDone.resolve(); }
  };
  const makeRequest = (requestId, sessionId) => ({ kind: "voyage.m12-launch-event", requestId, sessionId, expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: { captain: "captain", engineer: "engineer" } });
  const firstPromise = launchVoyageEventSession(makeRequest("concurrent-a", "concurrent-session-a"), fx.context);
  await entered.promise;
  const secondPromise = launchVoyageEventSession(makeRequest("concurrent-b", "concurrent-session-b"), fx.context);
  await winnerDone.promise;
  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  const results = [first, second];
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => result.errors?.[0]?.code === "m12-active-session-conflict").length, 1);
  assert.equal(fx.journals.length, 1);
  assert.equal(fx.tracker.creates, 1);
  const successful = results.find((result) => result.ok);
  assert.equal(reloadVoyageEventSession(successful.sessionId, fx.context).ok, true);
});

test("M12 concurrent loser does not claim an active session after winner fails before creation", async () => {
  const fx = fixture();
  let nextDocumentId = 1;
  fx.context.createDocumentId = () => `Journal.failed-concurrent-${nextDocumentId++}`;
  const entered = Promise.withResolvers();
  const winnerDone = Promise.withResolvers();
  let claimed = false;
  fx.context.JournalEntry.create = async () => {
    fx.tracker.creates += 1;
    throw new Error("winner create failed");
  };
  fx.context.runExclusiveSessionMutation = async (descriptor, callback) => {
    assert.equal(descriptor.sessionId, "arcflight-m12-event-launch-world");
    assert.equal(descriptor.sessionDocumentId, "arcflight-m12-event-launch-world");
    if (claimed) {
      await winnerDone.promise;
      return null;
    }
    claimed = true;
    entered.resolve();
    try { return await callback({ connectionId: descriptor.connectionId, occurredAt: "2026-08-12T12:00:00.000Z" }); }
    finally { claimed = false; winnerDone.resolve(); }
  };
  const makeRequest = (requestId, sessionId) => ({ kind: "voyage.m12-launch-event", requestId, sessionId, expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: { captain: "captain", engineer: "engineer" } });
  const firstPromise = launchVoyageEventSession(makeRequest("failed-concurrent-a", "failed-concurrent-session-a"), fx.context);
  await entered.promise;
  const secondPromise = launchVoyageEventSession(makeRequest("failed-concurrent-b", "failed-concurrent-session-b"), fx.context);
  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  assert.equal(first.ok, false);
  assert.equal(first.errors[0].code, "m11-session-write-failed");
  assert.equal(second.ok, false);
  assert.notEqual(second.errors?.[0]?.code, "m12-active-session-conflict");
  assert.equal(second.errors?.[0]?.code, "m11-cross-client-coordinator-required");
  assert.equal(fx.journals.length, 0);
  assert.equal(fx.tracker.creates, 1);
  assert.equal(fx.tracker.updates, 0);
  assert.equal(fx.journals.some((entry) => reloadVoyageEventSession(entry.id, fx.context).ok), false);
});

test("M12 Task 2 drag order uses only the persisted participating station IDs", () => {
  const planning = {
    stationAssignments: [{ stationId: "captain" }, { stationId: "engineer" }, { stationId: "watchmaster" }, { stationId: "veilwarden" }],
    proposedStationOrder: ["captain", "watchmaster", "engineer", "veilwarden"]
  };
  assert.deepEqual(buildVoyagePlanningOrder(planning), ["captain", "watchmaster", "engineer", "veilwarden"]);
  assert.deepEqual(reorderVoyagePlanningOrder(["captain", "engineer", "watchmaster", "veilwarden"], "watchmaster", "engineer", true), ["captain", "watchmaster", "engineer", "veilwarden"]);
  assert.deepEqual(reorderVoyagePlanningOrder(buildVoyagePlanningOrder(planning), "engineer", "watchmaster", true), ["captain", "engineer", "watchmaster", "veilwarden"]);
  assert.deepEqual(reorderVoyagePlanningOrder(["captain", "engineer"], "captain", "engineer", true), ["captain", "engineer"]);
  assert.equal(reorderVoyagePlanningOrder(["captain", "captain"], "captain", "captain", true), null);
  assert.equal(reorderVoyagePlanningOrder(["captain", "engineer"], "unknown", "captain", true), null);
  assert.deepEqual(buildVoyagePlanningOrder({ stationAssignments: [{ stationId: "captain" }, { stationId: "engineer" }], proposedStationOrder: ["captain", "unknown"] }), ["captain", "engineer"]);
});

test("M12 Event Manager tabs have a deterministic default and navigation vocabulary", () => {
  assert.deepEqual(EVENT_MANAGER_TAB_IDS, ["overview", "crew-plan", "resolution-order", "plan-review", "resolution"]);
  assert.equal(normalizeEventManagerTab(undefined), "overview");
  assert.equal(normalizeEventManagerTab("not-a-tab"), "overview");
  assert.equal(normalizeEventManagerTab("crew-plan"), "crew-plan");
});

test("M12 Event Manager keeps Resolution after Plan Review and gates its controls on the canonical handoff", () => {
  const beforeLock = buildEventManagerResolutionPresentation({ planLocked: false, resolutionPhase: "planning" });
  assert.equal(beforeLock.awaitingPlanLock, true);
  assert.equal(beforeLock.readyToStart, false);
  assert.equal(beforeLock.rollAvailable, false);
  assert.equal(beforeLock.planReviewStatus, "PLAN REVIEW");
  const locked = buildEventManagerResolutionPresentation({ planLocked: true, resolutionPhase: "lock-readiness" });
  assert.equal(locked.awaitingPlanLock, false);
  assert.equal(locked.readyToStart, true);
  assert.equal(locked.rollAvailable, false);
  assert.equal(locked.planReviewStatus, "PLAN LOCKED");
  const resolving = buildEventManagerResolutionPresentation({ planLocked: true, resolutionPhase: "resolution" });
  assert.equal(resolving.readyToStart, false);
  assert.equal(resolving.rollAvailable, true);
  assert.equal(EVENT_MANAGER_TAB_IDS.indexOf("resolution") > EVENT_MANAGER_TAB_IDS.indexOf("plan-review"), true);
});

test("M12 Resolution pre-lock guard uses the prepared model key", () => {
  const presentation = buildEventManagerResolutionPresentation({ planLocked: false, resolutionPhase: "lock-readiness" });
  const template = readFileSync(new URL("../../../templates/voyage/event-manager.hbs", import.meta.url), "utf8");
  assert.equal(presentation.awaitingPlanLock, true);
  assert.match(template, /\{\{#if awaitingPlanLock\}\}/);
  assert.doesNotMatch(template, /resolutionAwaitingPlanLock/);
  assert.match(template, /PLAN MUST BE LOCKED BEFORE RESOLUTION/);
  assert.doesNotMatch(template, /resolutionAwaitingPlanLock[\s\S]*ROLL CHECK/);
});

test("M12 paused nonterminal session blocks a fresh launch but abandoned history does not", async () => {
  const fx = fixture();
  fx.context.applyVoyageEncounterAbortTransition = applyVoyageEncounterAbortTransition;
  const first = await launchVoyageEventSession({ kind: "voyage.m12-launch-event", requestId: "paused-launch-a", sessionId: "paused-session-a", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: {} }, fx.context);
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  const storedA = fx.journals.find((entry) => entry.id === "Journal.session-1").__testSource.flags.arcflight.system.voyageSession;
  storedA.sessionState = "paused";
  storedA.encounterState.lifecycleState = "paused";
  assert.equal(isVoyageEventSessionActive(storedA), true);
  fx.context.createDocumentId = () => "Journal.session-2";
  const blocked = await launchVoyageEventSession({ kind: "voyage.m12-launch-event", requestId: "paused-launch-b", sessionId: "paused-session-b", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: {} }, fx.context);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.errors[0].code, "m12-active-session-conflict");
  assert.equal(fx.tracker.creates, 1);
  const abandoned = await abortVoyageEventSession({ kind: "voyage.m11-abort-session", requestId: "paused-abort-a", sessionId: "paused-session-a", expectedRevision: storedA.revision, authorityEpoch: 0, reason: "GM test abandon", confirmation: true }, fx.context);
  assert.equal(abandoned.ok, true, JSON.stringify(abandoned.errors));
  const allowed = await launchVoyageEventSession({ kind: "voyage.m12-launch-event", requestId: "paused-launch-b-retry", sessionId: "paused-session-b", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: {} }, fx.context);
  assert.equal(allowed.ok, true, JSON.stringify(allowed.errors));
  assert.equal(fx.journals.length, 2);
});

test("M12 Plan Review reconstructs incomplete and ready station state from persisted planning", () => {
  const planning = { sessionState: "crew-planning", stationAssignments: [{ stationId: "captain" }, { stationId: "engineer" }] };
  const stations = [
    { stationId: "captain", label: "Captain", operator: { name: "PC 1" }, actions: [{ actionId: "helm", approaches: [] }], selectedActionId: "helm", selectedApproachId: "careful", riskBidOptions: [], ready: true, planState: "ready" },
    { stationId: "engineer", label: "Engineer", operator: { name: "PC 2" }, actions: [], selectedActionId: "", selectedApproachId: "", riskBidOptions: [], ready: false, planState: "incomplete" }
  ];
  const incomplete = buildVoyagePlanReview(planning, stations, ["captain", "engineer"]);
  assert.equal(incomplete.ready, false);
  assert.deepEqual(incomplete.incompleteStations.map((station) => station.stationId), ["engineer"]);
  assert.equal(incomplete.rows[0].operatorName, "PC 1");
  const lockedPlanning = { ...planning, sessionState: "plan-locked", committedStationOrder: ["engineer", "captain"], proposedStationOrder: ["captain", "engineer"] };
  const lockedOrder = buildVoyagePlanningOrder(lockedPlanning);
  assert.deepEqual(lockedOrder, ["engineer", "captain"]);
  const locked = buildVoyagePlanReview(lockedPlanning, stations, lockedOrder);
  assert.equal(locked.locked, true);
  assert.equal(locked.rows[0].stationId, "engineer");
});

test("M12 default effective station order makes a complete plan lock-ready without a drag", async () => {
  const { fx, run } = await task2Fixture();
  const captain = await run("default-captain", 5, "station-selection", { stationId: "captain", actionId: "captain-round-1-action-1", approachId: "captain-round-1-action-1-approach", riskBidId: null });
  const engineer = await run("default-engineer", captain.revision, "station-selection", { stationId: "engineer", actionId: "engineer-round-1-action-1", approachId: "engineer-round-1-action-1-approach", riskBidId: null });
  assert.equal(engineer.ok, true, JSON.stringify(engineer.errors));
  const planning = readVoyageEventSessionPlanning("task2-session", fx.context);
  assert.equal(planning.ok, true, JSON.stringify(planning.errors));
  const stations = buildPlanningStations(planning.projection);
  const effectiveOrder = buildVoyagePlanningOrder(planning.projection);
  assert.deepEqual(planning.projection.proposedStationOrder, []);
  assert.deepEqual(effectiveOrder, ["captain", "engineer"]);
  assert.equal(isVoyagePlanReady(planning.projection, stations, effectiveOrder), true);
  const writesBeforeLock = fx.tracker.updates;
  const locked = await run("default-lock", engineer.revision, "plan-lock", { phaseStartSnapshotId: "default-order-lock" });
  assert.equal(locked.ok, true, JSON.stringify(locked.errors));
  assert.equal(fx.tracker.updates, writesBeforeLock + 1);
  assert.deepEqual(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.encounterState.committedStationOrder, effectiveOrder);
});

test("M12 Crew Plan keeps an unselected action blank and gates approach/risk until selection", () => {
  const planning = { stationAssignments: [{ stationId: "captain", operator: { id: "captain", name: "Captain" } }], stations: [{ stationId: "captain", actions: [
    { actionId: "action-1", approaches: [{ approachId: "approach-1" }], riskBidOptions: [{ riskBidId: "risk-2", dcAdjustment: 2 }] },
    { actionId: "action-2", approaches: [{ approachId: "approach-2" }], riskBidOptions: [{ riskBidId: "risk-5", dcAdjustment: 5 }] },
    { actionId: "action-3", approaches: [{ approachId: "approach-3" }], riskBidOptions: [{ riskBidId: "risk-8", dcAdjustment: 8 }] }
  ] }], selections: {}, riskBids: {} };
  const blank = buildPlanningStations(planning)[0];
  assert.equal(blank.selectedActionId, "");
  assert.equal(blank.actions.some((action) => action.selected), false);
  assert.deepEqual(blank.approaches, []);
  assert.deepEqual(blank.riskBidOptions, []);
  const template = readFileSync(new URL("../../../templates/voyage/event-manager.hbs", import.meta.url), "utf8");
  assert.match(template, /data-m12-action-picker/);
  assert.match(template, /role="listbox"/);
  assert.match(template, /role="option"/);
  assert.doesNotMatch(template, /data-m12-action-option="\{\{\.\.\/stationId\}\}"[^>]*<option/);
  assert.match(template, /riskBidAvailableResource/);
  assert.match(template, /Select an Action first/);
  const selected = buildPlanningStations({ ...planning, selections: { captain: { actionId: "action-1", approachId: "", statisticSlugOrAbilityId: null } } })[0];
  assert.equal(selected.actions.find((action) => action.actionId === "action-1").selected, true);
  assert.equal(selected.approaches.length, 1);
  assert.deepEqual(selected.riskBidOptions.map((option) => option.dcAdjustment), [2]);
});

test("M12 Crew Plan action picker marks only authored Risk Bid actions and keeps the canonical selection path", () => {
  const template = readFileSync(new URL("../../../templates/voyage/event-manager.hbs", import.meta.url), "utf8");
  const runtime = readFileSync(new URL("../../../scripts/voyage/apps/event-manager.js", import.meta.url), "utf8");
  assert.match(template, /data-m12-action-picker/);
  assert.match(template, /data-m12-action-option/);
  assert.match(template, /data-action-id="\{\{actionId\}\}"/);
  assert.match(template, /data-approach-id="\{\{approaches\.\[0\]\.approachId\}\}"/);
  assert.match(template, /resourceIconPath/);
  assert.match(template, /aria-label="\{\{riskBidAvailableResource\.resourceIconTitle\}\}"/);
  assert.match(runtime, /#selectActionOption/);
  assert.match(runtime, /#actionPickerKeydown/);
  assert.match(runtime, /riskBidId: null/);
  assert.match(template, /selectedActionHasRiskBids/);
  assert.match(template, /action-picker-readonly/);
});

test("M12 choice transparency names authored Risk Bid and Focus consequences", () => {
  const template = readFileSync(new URL("../../../templates/voyage/event-manager.hbs", import.meta.url), "utf8");
  assert.match(template, /displayName/);
  assert.match(template, /adjustedDc/);
  assert.match(template, /presentation\.intendedBenefit/);
  assert.match(template, /presentation\.outcome\.failure/);
  assert.match(template, /focusAbility\.name/);
  assert.match(template, /focusAbility\.criticalSuccess/);
  assert.match(template, /focusAbility\.criticalFailure/);
  assert.match(template, /focusAbility\.visibility/);
  assert.doesNotMatch(template, /<p>Eligible: \{\{operatorId\}\} \/ \{\{focusAbilityId\}\}<\/p>/);
});

test("M12 Event Manager body template has one ApplicationV2 root", () => {
  const template = readFileSync(new URL("../../../templates/voyage/event-manager.hbs", import.meta.url), "utf8");
  const staticMarkup = template.replace(/\{\{[\s\S]*?\}\}/g, "");
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const tags = /<\/?([a-z][\w:-]*)(?:\s[^<>]*?)?\/?\s*>/gi;
  let depth = 0;
  let roots = 0;
  let match;
  while ((match = tags.exec(staticMarkup))) {
    const token = match[0];
    const name = match[1].toLowerCase();
    if (token.startsWith("</")) {
      depth -= 1;
      assert.ok(depth >= 0, `unbalanced closing tag: ${name}`);
    } else {
      if (depth === 0) roots += 1;
      if (!token.endsWith("/>") && !voidTags.has(name)) depth += 1;
    }
  }
  assert.equal(roots, 1);
  assert.equal(depth, 0);
  assert.match(staticMarkup.trim(), /^<div class="arcflight-event-manager event-manager-shell"/);
  assert.match(staticMarkup, /<style data-component="event-manager-task4-ui">/);
});

test("M12 station icon registry decorates planning, order, Risk Bid, and template models", () => {
  const expected = {
    captain: "modules/arcflight/assets/ui/stations/captain_icon.webp",
    navigator: "modules/arcflight/assets/ui/stations/navigator_icon.webp",
    watchmaster: "modules/arcflight/assets/ui/stations/watchmaster_icon.webp",
    veilwarden: "modules/arcflight/assets/ui/stations/veilwarden_icon.webp",
    engineer: "modules/arcflight/assets/ui/stations/engineer_icon.webp"
  };
  for (const [stationId, path] of Object.entries(expected)) {
    assert.equal(VOYAGE_STATION_ICON_REGISTRY[stationId].file, `${stationId}_icon.webp`);
    assert.equal(stationPresentation(stationId).stationIconPath, path);
    assert.equal(stationPresentation(stationId).stationIconSize, 48);
    assert.equal(stationPresentation(stationId).stationIconMajorSize, 56);
    assert.equal(stationPresentation(stationId).stationIconTitle, `${stationPresentation(stationId).stationDisplayName} Station`);
  }
  assert.equal(stationPresentation("future-station").stationIconPath, null);
  assert.equal(stationPresentation("future-station").stationDisplayName, "Future Station");
  assert.equal(stationPresentation("future-station").stationIconSize, 48);
  const planning = { stationAssignments: [{ stationId: "captain", operator: { name: "Captain" } }], stations: [{ stationId: "captain", actions: [{ actionId: "mark", name: "Mark the Beast", approaches: [{ approachId: "approach" }], riskBidOptions: [{ riskBidId: "mark-risk-5", dcAdjustment: 5 }], riskBidPresentation: { "5": { label: "+5 Risk Bid", mechanicalEffect: { effects: [{ effectKind: "roll-bonus", value: 2, targetStationIds: ["navigator"] }] }, intendedBenefit: "Navigator bonus", target: "Navigator", outcome: { failure: "No payoff", criticalFailure: "No payoff" } } } }, { actionId: "steady", name: "Steady the Crew", approaches: [{ approachId: "steady-approach" }], riskBidOptions: [] }] }], selections: { captain: { actionId: "mark", approachId: "approach" } }, riskBids: { captain: { riskBidId: "mark-risk-5", dcAdjustment: 5 } } };
  const stations = buildPlanningStations(planning);
  assert.equal(stations[0].stationIconPath, expected.captain);
  assert.equal(stations[0].actions.find((action) => action.actionId === "mark").riskBidBadge, undefined);
  assert.equal(stations[0].actions.find((action) => action.actionId === "steady").riskBidBadge, undefined);
  assert.equal(stations[0].actions.find((action) => action.actionId === "mark").displayName, "Mark the Beast");
  assert.equal(stations[0].selectedActionHasRiskBids, true);
  assert.equal(stations[0].selectedRiskBidAvailableResource.resourceIconPath, "modules/arcflight/assets/ui/resources/risk_bid_icon.webp");
  assert.equal(stations[0].selectedRiskBidResource.resourceIconPath, "modules/arcflight/assets/ui/resources/risk_bid_icon_+5.webp");
  assert.equal(stations[0].riskBidOptions[0].targetStations[0].stationIconPath, expected.navigator);
  assert.equal(stations[0].riskBidOptions[0].payoffEffects[0].targetStations[0].stationDisplayName, "Navigator");
  assert.equal(stations[0].riskBidOptions[0].payoffEffects[0].text, "+2 to the next unresolved station roll this round");
  assert.equal(stations[0].riskBidOptions[0].failureText, "No payoff");
  const noBidStation = buildPlanningStations({ ...planning, selections: { captain: { actionId: "steady", approachId: "steady-approach" } }, riskBids: {} })[0];
  assert.equal(noBidStation.selectedActionHasRiskBids, false);
  assert.equal(noBidStation.selectedRiskBidAvailableResource, null);
  assert.equal(noBidStation.expanded, false);
  const readyStation = buildPlanningStations({ ...planning, selections: { captain: { actionId: "mark", approachId: "approach" } }, riskBids: { captain: { riskBidId: "mark-risk-5", dcAdjustment: 5 } } })[0];
  assert.equal(readyStation.ready, true);
  assert.equal(readyStation.expanded, false);
  assert.equal(buildPlanningStations({ ...planning, selections: { captain: { actionId: "mark", approachId: "approach" } }, riskBids: { captain: { riskBidId: "mark-risk-5", dcAdjustment: 5 } } }, false, "captain")[0].expanded, true);
  const dependencies = buildVoyageRiskBidDependencies(stations, ["captain", "navigator"]);
  assert.equal(dependencies[0].sourceStationIconPath, expected.captain);
  assert.equal(dependencies[0].targetStations[0].stationDisplayName, "Navigator");
  assert.match(dependencies[0].status, /ORDER VALID/);
  const template = readFileSync(new URL("../../../templates/voyage/event-manager.hbs", import.meta.url), "utf8");
  assert.match(template, /stationIconPath/);
  assert.match(template, /stationIconTitle/);
  assert.match(template, /stationIconSize/);
  assert.match(template, /stationIconMajorSize/);
  assert.match(template, /station-cell/);
  assert.match(template, /targetStations/);
  assert.match(template, /risk-bid-target-cell/);
  assert.match(template, /FAILURE \/ CRITICAL FAILURE/);
  assert.match(template, /ACTIVE BENEFIT/);
  assert.match(template, /sourceActionId/);
  assert.match(template, /effectText/);
  assert.match(template, /consumptionLabel/);
  assert.match(template, /No Risk Bid is authored for this action/);
});

test("M12 resource registry decorates Risk Bid tiers, Focus, and Resolution Order cards", () => {
  const expected = {
    focus: "modules/arcflight/assets/ui/resources/focus_icon.webp",
    riskBid: "modules/arcflight/assets/ui/resources/risk_bid_icon.webp",
    riskBid2: "modules/arcflight/assets/ui/resources/risk_bid_icon_+2.webp",
    riskBid5: "modules/arcflight/assets/ui/resources/risk_bid_icon_+5.webp",
    riskBid8: "modules/arcflight/assets/ui/resources/risk_bid_icon_+8.webp"
  };
  for (const [key, path] of Object.entries(expected)) assert.equal(resourcePresentation(key).resourceIconPath, path);
  assert.equal(resourcePresentation("riskBid", 2).resourceIconPath, expected.riskBid2);
  assert.equal(resourcePresentation("riskBid", 5).resourceIconPath, expected.riskBid5);
  assert.equal(resourcePresentation("riskBid", 8).resourceIconPath, expected.riskBid8);
  assert.equal(resourcePresentation("focus").resourceIconSize, 40);
  assert.equal(resourcePresentation("riskBid", 5).resourceIconSize, 64);
  assert.equal(VOYAGE_RESOURCE_ICON_REGISTRY.riskBid.file, "risk_bid_icon.webp");
  const template = readFileSync(new URL("../../../templates/voyage/event-manager.hbs", import.meta.url), "utf8");
  assert.match(template, /resolution-order-rail/);
  assert.match(template, /stationOrderIconSize/);
  assert.match(template, /selectedRiskBidResource/);
  assert.match(template, /action-picker-option:hover/);
  assert.match(template, /aria-selected="true"\]::before/);
  assert.match(template, /crew-plan-controls/);
  assert.match(template, /station-compact-summary/);
  assert.match(template, /data-m12-edit-station/);
  assert.match(template, /risk-bid-tier-summary/);
  assert.match(template, /selectedRiskBidId/);
  assert.match(template, /riskBidFinalDc/);
  assert.match(template, /resourceIconPath/);
  assert.match(template, /focusResource/);
  assert.match(template, /OPERATOR:/);
  assert.match(template, /ACTION:/);
  assert.match(template, /APPROACH:/);
  assert.match(template, /data-m12-order-station/);
  assert.match(template, /data-m12-order-move/);
  assert.match(template, /stationOrderIconSize/);
  assert.match(template, /canMoveUp/);
  assert.match(template, /canMoveDown/);
  assert.match(template, /resolution-order-status/);
  assert.match(template, /overview-station-cell/);
  assert.match(template, /plan-review-station/);
  assert.match(template, /selectedRiskBidAvailableResource/);
  assert.match(template, /selectedActionHasRiskBids/);
  assert.doesNotMatch(template, /riskBidBadge/);
  assert.match(template, /font-family/);
  assert.match(template, /Cinzel/);
  assert.match(template, /Inter/);
  assert.match(template, /selectedRiskBidResource/);
  assert.match(template, /riskBidPayoffEffects/);
  const orderCard = template.slice(template.indexOf('<ol data-m12-order-list'), template.indexOf('</ol>'));
  assert.ok(orderCard.indexOf('resolution-order-rail') < orderCard.indexOf('resolution-order-identity'));
  assert.ok(orderCard.indexOf('resolution-order-identity') < orderCard.indexOf('resolution-order-fields'));
  assert.ok(orderCard.indexOf('resolution-order-fields') < orderCard.indexOf('resolution-order-risk'));
  assert.ok(orderCard.indexOf('resolution-order-risk') < orderCard.indexOf('resolution-order-status'));
  const planCard = template.slice(template.indexOf('<div class="plan-review-stations"'), template.indexOf('</div>', template.indexOf('<div class="plan-review-stations"')));
  assert.ok(planCard.indexOf('station-identity') < planCard.indexOf('station-detail-fields'));
  assert.ok(planCard.indexOf('station-detail-fields') < planCard.indexOf('plan-review-status'));
});

test("M12 Task 2 Clear uses the exact station-selection-clear command", () => {
  assert.deepEqual(buildVoyageStationSelectionClearCommand("captain"), { commandKind: "station-selection-clear", payload: { stationId: "captain" } });
  assert.equal(buildVoyageStationSelectionClearCommand(""), null);
  assert.equal(buildVoyageStationSelectionClearCommand("captain").payload.actionId, undefined);
});

test("M12 Task 2 clearing a selection preserves order, marks the station incomplete, and allows canonical reselect", async () => {
  const { fx, run } = await task2Fixture();
  await run("captain", 5, "station-selection", { stationId: "captain", actionId: "captain-round-1-action-1", approachId: "captain-round-1-action-1-approach", riskBidId: "captain-round-1-action-1-risk-2" });
  await run("engineer", 6, "station-selection", { stationId: "engineer", actionId: "engineer-round-1-action-1", approachId: "engineer-round-1-action-1-approach", riskBidId: null });
  await run("order-before-clear", 7, "station-order", { stationOrder: ["engineer", "captain"] });
  const cleared = await run("clear-selection", 8, "station-selection-clear", { stationId: "captain" });
  assert.equal(cleared.ok, true, JSON.stringify(cleared.errors));
  assert.equal(cleared.revision, 9);
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  assert.equal(stored.encounterState.selections.captain, undefined);
  assert.equal(stored.encounterState.riskBids.captain, undefined);
  assert.deepEqual(stored.encounterState.proposedStationOrder, ["engineer", "captain"]);
  assert.equal(stored.encounterState.stationAssignments.find((entry) => entry.stationId === "captain").operator.id, "captain");
  assert.deepEqual(stored.checkpoints, []);
  const planning = readVoyageEventSessionPlanning("task2-session", fx.context);
  assert.equal(planning.ok, true, JSON.stringify(planning.errors));
  const captain = buildPlanningStations(planning.projection).find((entry) => entry.stationId === "captain");
  assert.equal(captain.planState, "incomplete");
  assert.equal(captain.selectionState, "none");
  assert.equal(captain.selectedActionId, "");
  assert.equal(captain.actions.some((action) => action.selected), false);
  assert.deepEqual(captain.approaches, []);
  assert.deepEqual(captain.riskBidOptions, []);
  assert.equal(captain.ready, false);
  const planLock = await run("locked-too-soon", 9, "plan-lock", { phaseStartSnapshotId: "not-ready" });
  assert.equal(planLock.ok, false);
  assert.equal(fx.tracker.updates, 5);
  const replay = await run("clear-selection", 8, "station-selection-clear", { stationId: "captain" });
  assert.deepEqual(replay, cleared);
  const writesAfterClear = fx.tracker.updates;
  const stale = await run("clear-stale", 8, "station-selection-clear", { stationId: "captain" });
  assert.equal(stale.ok, false);
  assert.equal(fx.tracker.updates, writesAfterClear);
  const wrongEpoch = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "clear-wrong-epoch", sessionId: "task2-session", expectedRevision: 9, authorityEpoch: 1, commandKind: "station-selection-clear", payload: { stationId: "captain" } }, fx.context);
  assert.equal(wrongEpoch.ok, false);
  assert.equal(fx.tracker.updates, writesAfterClear);
  const reselected = await run("reselect", 9, "station-selection", { stationId: "captain", actionId: "captain-round-1-action-2", approachId: "captain-round-1-action-2-approach", riskBidId: null });
  assert.equal(reselected.ok, true, JSON.stringify(reselected.errors));
  assert.equal(reselected.revision, 10);
  assert.equal(reloadVoyageEventSession("task2-session", fx.context).ok, true);
  assert.equal(fx.tracker.updates, 6);
});

test("M12 Task 2 persists canonical selections, order, and one pre-lock checkpoint", async () => {
  const fx = fixture();
  const launch = await launchVoyageEventSession({ kind: "voyage.m12-launch-event", requestId: "task2-launch", sessionId: "task2-session", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: { captain: "captain", engineer: "engineer" } }, fx.context);
  assert.equal(launch.ok, true, JSON.stringify(launch.errors));
  const command = (requestId, expectedRevision, commandKind, payload) => dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId, sessionId: "task2-session", expectedRevision, authorityEpoch: 0, commandKind, payload }, fx.context);
  const captain = await command("task2-captain", 5, "station-selection", { stationId: "captain", actionId: "captain-round-1-action-1", approachId: "captain-round-1-action-1-approach", riskBidId: "captain-round-1-action-1-risk-2" });
  assert.equal(captain.ok, true, JSON.stringify(captain.errors));
  const engineer = await command("task2-engineer", 6, "station-selection", { stationId: "engineer", actionId: "engineer-round-1-action-1", approachId: "engineer-round-1-action-1-approach", riskBidId: null });
  assert.equal(engineer.ok, true, JSON.stringify(engineer.errors));
  const order = await command("task2-order", 7, "station-order", { stationOrder: ["engineer", "captain"] });
  assert.equal(order.ok, true, JSON.stringify(order.errors));
  const locked = await command("task2-lock", 8, "plan-lock", { phaseStartSnapshotId: "task2-lock-snapshot" });
  assert.equal(locked.ok, true, JSON.stringify(locked.errors));
  assert.equal(locked.status, "plan-locked");
  assert.equal(fx.tracker.updates, 5);
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  assert.equal(stored.checkpoints.length, 1);
  assert.equal(stored.checkpoints[0].kind, "before-plan-lock");
  assert.equal(stored.checkpoints[0].revision, 8);
  assert.deepEqual(stored.encounterState.committedStationOrder, ["engineer", "captain"]);
  assert.equal(readVoyageEventSessionPlanning("task2-session", fx.context).ok, true);
  assert.equal(reloadVoyageEventSession("task2-session", fx.context).ok, true);
});

test("M12 Slice E GM unlock preserves the locked plan, reloads, replays, and relocks canonically", async () => {
  const { fx, run } = await task2Fixture();
  const captain = await run("slice-e-captain", 5, "station-selection", { stationId: "captain", actionId: "captain-round-1-action-1", approachId: "captain-round-1-action-1-approach", riskBidId: "captain-round-1-action-1-risk-2" });
  const engineer = await run("slice-e-engineer", captain.revision, "station-selection", { stationId: "engineer", actionId: "engineer-round-1-action-1", approachId: "engineer-round-1-action-1-approach", riskBidId: null });
  const order = await run("slice-e-order", engineer.revision, "station-order", { stationOrder: ["engineer", "captain"] });
  const locked = await run("slice-e-lock", order.revision, "plan-lock", { phaseStartSnapshotId: "slice-e-lock-snapshot" });
  assert.equal(locked.ok, true, JSON.stringify(locked.errors));
  const storedBefore = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  const beforeSelections = structuredClone(storedBefore.encounterState.selections);
  const beforeAssignments = structuredClone(storedBefore.encounterState.stationAssignments);
  const beforeEvents = storedBefore.events.length;
  const beforeCheckpoints = storedBefore.checkpoints.length;
  const writesBeforeUnlock = fx.tracker.updates;
  const request = { kind: "voyage.m11-correct-session", requestId: "slice-e-unlock", sessionId: "task2-session", expectedRevision: locked.revision, authorityEpoch: 0, correctionKind: "plan-unlock", targetRequestId: null, targetCheckpointId: null, replacementPayload: {}, reason: "GM needs to correct the plan", confirmation: true };
  const unlocked = await correctVoyageEventSession(request, fx.context);
  assert.equal(unlocked.ok, true, JSON.stringify(unlocked.errors));
  assert.equal(unlocked.status, "crew-planning");
  assert.equal(unlocked.revision, locked.revision + 1);
  assert.equal(unlocked.events.length, 1);
  assert.equal(fx.tracker.updates, writesBeforeUnlock + 1);
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  assert.equal(stored.sessionState, "crew-planning");
  assert.equal(stored.encounterState.lifecycleState, "active");
  assert.equal(stored.encounterState.phase, "crew-planning");
  assert.deepEqual(stored.encounterState.proposedStationOrder, ["engineer", "captain"]);
  assert.deepEqual(stored.encounterState.committedStationOrder, []);
  assert.deepEqual(stored.encounterState.selections, beforeSelections);
  assert.deepEqual(stored.encounterState.stationAssignments, beforeAssignments);
  const planningAfterUnlock = readVoyageEventSessionPlanning("task2-session", fx.context);
  assert.equal(planningAfterUnlock.ok, true, JSON.stringify(planningAfterUnlock.errors));
  assert.equal(planningAfterUnlock.projection.sessionState, "crew-planning");
  assert.deepEqual(planningAfterUnlock.projection.proposedStationOrder, ["engineer", "captain"]);
  assert.equal(stored.events.length, beforeEvents + 1);
  assert.equal(stored.checkpoints.length, beforeCheckpoints);
  assert.equal(stored.events.at(-1).correctionKind, "plan-unlock");
  assert.equal(stored.auditHistory.at(-1).kind, "correction-applied");
  const reread = reloadVoyageEventSession("task2-session", fx.context);
  assert.equal(reread.ok, true, JSON.stringify(reread.errors));
  const replayWrites = fx.tracker.updates;
  const replay = await correctVoyageEventSession(request, fx.context);
  assert.deepEqual(replay, unlocked);
  assert.equal(fx.tracker.updates, replayWrites);
  const relocked = await run("slice-e-relock", unlocked.revision, "plan-lock", { phaseStartSnapshotId: "slice-e-relock-snapshot" });
  assert.equal(relocked.ok, true, JSON.stringify(relocked.errors));
  const final = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  assert.equal(final.sessionState, "plan-locked");
  assert.deepEqual(final.encounterState.committedStationOrder, ["engineer", "captain"]);
  assert.deepEqual(final.encounterState.proposedStationOrder, []);
  assert.equal(final.checkpoints.filter((entry) => entry.kind === "before-plan-lock").length, 2);
  const template = readFileSync(new URL("../../../templates/voyage/event-manager.hbs", import.meta.url), "utf8");
  const playerTemplate = readFileSync(new URL("../../../templates/voyage/player-event.hbs", import.meta.url), "utf8");
  assert.match(template, /data-m12-plan-unlock/);
  assert.match(template, /planUnlockAvailable/);
  assert.doesNotMatch(playerTemplate, /data-m12-plan-unlock/);
});

test("M12 Slice E rejects unlock outside the pre-resolution locked boundary and from non-GM callers", async () => {
  const { fx, run } = await task2Fixture();
  const captain = await run("slice-e-gate-captain", 5, "station-selection", { stationId: "captain", actionId: "captain-round-1-action-1", approachId: "captain-round-1-action-1-approach", riskBidId: null });
  const engineer = await run("slice-e-gate-engineer", captain.revision, "station-selection", { stationId: "engineer", actionId: "engineer-round-1-action-1", approachId: "engineer-round-1-action-1-approach", riskBidId: null });
  const order = await run("slice-e-gate-order", engineer.revision, "station-order", { stationOrder: ["engineer", "captain"] });
  const locked = await run("slice-e-gate-lock", order.revision, "plan-lock", { phaseStartSnapshotId: "slice-e-gate-lock" });
  const request = (requestId, expectedRevision = locked.revision) => ({ kind: "voyage.m11-correct-session", requestId, sessionId: "task2-session", expectedRevision, authorityEpoch: 0, correctionKind: "plan-unlock", targetRequestId: null, targetCheckpointId: null, replacementPayload: {}, reason: "unlock", confirmation: true });
  const writes = fx.tracker.updates;
  const playerContext = { ...fx.context, authenticatedUserId: "player-1", authenticatedConnectionId: "connection-player-1", users: [...fx.context.users, { id: "player-1", isGM: false, active: true }] };
  const player = await correctVoyageEventSession(request("slice-e-player"), playerContext);
  assert.equal(player.ok, false);
  assert.equal(player.errors[0].code, "m11-active-gm-required");
  assert.equal(fx.tracker.updates, writes);
  const stale = await correctVoyageEventSession(request("slice-e-stale", locked.revision - 1), fx.context);
  assert.equal(stale.ok, false);
  assert.equal(stale.errors[0].code, "m11-stale-session-revision");
  assert.equal(fx.tracker.updates, writes);
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  stored.sessionState = "station-resolution";
  stored.encounterState.lifecycleState = "active";
  stored.encounterState.phase = "resolution";
  const resolution = await correctVoyageEventSession(request("slice-e-resolution", locked.revision), fx.context);
  assert.equal(resolution.ok, false);
  assert.equal(resolution.errors[0].code, "m11-command-not-allowed");
  assert.equal(fx.tracker.updates, writes);
});

test("M12 Slice E rejects a correction event whose persisted kind is forged", async () => {
  const { fx, run } = await task2Fixture();
  const captain = await run("slice-e-forged-captain", 5, "station-selection", { stationId: "captain", actionId: "captain-round-1-action-1", approachId: "captain-round-1-action-1-approach", riskBidId: null });
  const engineer = await run("slice-e-forged-engineer", captain.revision, "station-selection", { stationId: "engineer", actionId: "engineer-round-1-action-1", approachId: "engineer-round-1-action-1-approach", riskBidId: null });
  const order = await run("slice-e-forged-order", engineer.revision, "station-order", { stationOrder: ["engineer", "captain"] });
  const locked = await run("slice-e-forged-lock", order.revision, "plan-lock", { phaseStartSnapshotId: "slice-e-forged-lock" });
  const request = { kind: "voyage.m11-correct-session", requestId: "slice-e-forged-unlock", sessionId: "task2-session", expectedRevision: locked.revision, authorityEpoch: 0, correctionKind: "plan-unlock", targetRequestId: null, targetCheckpointId: null, replacementPayload: {}, reason: "unlock", confirmation: true };
  const unlocked = await correctVoyageEventSession(request, fx.context);
  assert.equal(unlocked.ok, true, JSON.stringify(unlocked.errors));
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  stored.events.at(-1).correctionKind = "station-order";
  stored.processedRequests.at(-1).response.events[0].correctionKind = "station-order";
  const writes = fx.tracker.updates;
  const reread = reloadVoyageEventSession("task2-session", fx.context);
  assert.equal(reread.ok, false);
  assert.equal(reread.errors[0].code, "m11-invalid-session-document");
  assert.equal(fx.tracker.updates, writes);
});

test("M12 Slice E binds unlock encounter revisions to the canonical Plan Lock predecessor", async () => {
  const { fx, run } = await task2Fixture();
  const captain = await run("slice-e-history-captain", 5, "station-selection", { stationId: "captain", actionId: "captain-round-1-action-1", approachId: "captain-round-1-action-1-approach", riskBidId: null });
  const engineer = await run("slice-e-history-engineer", captain.revision, "station-selection", { stationId: "engineer", actionId: "engineer-round-1-action-1", approachId: "engineer-round-1-action-1-approach", riskBidId: null });
  const order = await run("slice-e-history-order", engineer.revision, "station-order", { stationOrder: ["engineer", "captain"] });
  const locked = await run("slice-e-history-lock", order.revision, "plan-lock", { phaseStartSnapshotId: "slice-e-history-lock" });
  const request = { kind: "voyage.m11-correct-session", requestId: "slice-e-history-unlock", sessionId: "task2-session", expectedRevision: locked.revision, authorityEpoch: 0, correctionKind: "plan-unlock", targetRequestId: null, targetCheckpointId: null, replacementPayload: {}, reason: "unlock", confirmation: true };
  const unlocked = await correctVoyageEventSession(request, fx.context);
  assert.equal(unlocked.ok, true, JSON.stringify(unlocked.errors));
  assert.equal(reloadVoyageEventSession("task2-session", fx.context).ok, true);
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  const unlockEvent = stored.events.at(-1);
  const unlockAudit = stored.auditHistory.at(-1);
  unlockEvent.previousEncounterRevision = 999;
  unlockEvent.encounterRevision = 1000;
  unlockAudit.details.previousEncounterRevision = 999;
  unlockAudit.details.encounterRevision = 1000;
  const writes = fx.tracker.updates;
  const invalid = reloadVoyageEventSession("task2-session", fx.context);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors[0].code, "m11-invalid-session-document");
  assert.equal(fx.tracker.updates, writes);
});

test("M12 Slice E rejects an unlock whose historical predecessor is not Plan Lock", async () => {
  const { fx, run } = await task2Fixture();
  const captain = await run("slice-e-predecessor-captain", 5, "station-selection", { stationId: "captain", actionId: "captain-round-1-action-1", approachId: "captain-round-1-action-1-approach", riskBidId: null });
  const engineer = await run("slice-e-predecessor-engineer", captain.revision, "station-selection", { stationId: "engineer", actionId: "engineer-round-1-action-1", approachId: "engineer-round-1-action-1-approach", riskBidId: null });
  const order = await run("slice-e-predecessor-order", engineer.revision, "station-order", { stationOrder: ["engineer", "captain"] });
  const locked = await run("slice-e-predecessor-lock", order.revision, "plan-lock", { phaseStartSnapshotId: "slice-e-predecessor-lock" });
  const request = { kind: "voyage.m11-correct-session", requestId: "slice-e-predecessor-unlock", sessionId: "task2-session", expectedRevision: locked.revision, authorityEpoch: 0, correctionKind: "plan-unlock", targetRequestId: null, targetCheckpointId: null, replacementPayload: {}, reason: "unlock", confirmation: true };
  assert.equal((await correctVoyageEventSession(request, fx.context)).ok, true);
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  const predecessor = stored.events.find((event) => event.revision === stored.events.at(-1).previousRevision);
  predecessor.type = "voyage.m12-station-order";
  predecessor.transitionKind = "station-order";
  const writes = fx.tracker.updates;
  const invalid = reloadVoyageEventSession("task2-session", fx.context);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors[0].code, "m11-invalid-session-document");
  assert.equal(fx.tracker.updates, writes);
});

async function task2Fixture() {
  const fx = fixture();
  const launch = await launchVoyageEventSession({ kind: "voyage.m12-launch-event", requestId: "task2-launch", sessionId: "task2-session", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: { captain: "captain", engineer: "engineer" } }, fx.context);
  assert.equal(launch.ok, true, JSON.stringify(launch.errors));
  const run = (requestId, expectedRevision, commandKind, payload) => dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId, sessionId: "task2-session", expectedRevision, authorityEpoch: 0, commandKind, payload }, fx.context);
  return { fx, run };
}

test("M12 Task 2 planning read exposes only occupied canonical actions and is isolated", async () => {
  const { fx } = await task2Fixture();
  const first = readVoyageEventSessionPlanning("task2-session", fx.context);
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  assert.equal(first.projection.stations.length, 2);
  assert.equal(first.projection.stations.every((station) => station.actions.length === 3), true);
  assert.equal(first.projection.authorityEpoch, 0);
  assert.equal(first.projection.events, undefined);
  first.projection.stations[0].actions[0].actionId = "forged";
  const second = readVoyageEventSessionPlanning("task2-session", fx.context);
  assert.equal(second.projection.stations[0].actions[0].actionId.includes("forged"), false);
  assert.equal(fx.tracker.updates, 1);
});

test("M12 Task 2 planning read hydrates an existing Task 1 station shell without writing", async () => {
  const { fx } = await task2Fixture();
  fx.context.resolveEventDefinitionSnapshot = () => getM12EventDefinition();
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  stored.encounterState.availableStations = stored.encounterState.availableStations.map((station) => ({ stationId: station.stationId }));
  const before = fx.tracker.updates;
  const planning = readVoyageEventSessionPlanning("task2-session", fx.context);
  assert.equal(planning.ok, true, JSON.stringify(planning.errors));
  assert.equal(planning.projection.stations.every((station) => station.actions.length === 3), true);
  assert.equal(fx.tracker.updates, before);
});

test("M12 Task 2 clears and replaces a canonical station selection", async () => {
  const { fx, run } = await task2Fixture();
  const selected = await run("selection", 5, "station-selection", { stationId: "captain", actionId: "captain-round-1-action-1", approachId: "captain-round-1-action-1-approach", riskBidId: "captain-round-1-action-1-risk-2" });
  assert.equal(selected.ok, true, JSON.stringify(selected.errors));
  const changed = await run("change", 6, "station-selection", { stationId: "captain", actionId: "captain-round-1-action-2", approachId: "captain-round-1-action-2-approach", riskBidId: null });
  assert.equal(changed.ok, true, JSON.stringify(changed.errors));
  const cleared = await run("clear", 7, "station-selection-clear", { stationId: "captain" });
  assert.equal(cleared.ok, true, JSON.stringify(cleared.errors));
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.encounterState.selections.captain, undefined);
  assert.equal(fx.tracker.actors, 0);
});

test("M12 Task 2 composes same-action Risk Bid edits into one durable command", async () => {
  const { fx, run } = await task2Fixture();
  const base = { stationId: "captain", actionId: "captain-round-1-action-1", approachId: "captain-round-1-action-1-approach" };
  const selected = await run("bid-base", 5, "station-selection", { ...base, riskBidId: null });
  assert.equal(selected.ok, true, JSON.stringify(selected.errors));
  const writesAfterBase = fx.tracker.updates;

  const noOp = await run("bid-no-op", 6, "station-selection", { ...base, riskBidId: null });
  assert.equal(noOp.ok, false);
  assert.equal(fx.tracker.updates, writesAfterBase);

  const plusTwo = await run("bid-plus-two", 6, "station-selection", { ...base, riskBidId: "captain-round-1-action-1-risk-2" });
  assert.equal(plusTwo.ok, true, JSON.stringify(plusTwo.errors));
  assert.equal(plusTwo.revision, 7);
  const replay = await run("bid-plus-two", 6, "station-selection", { ...base, riskBidId: "captain-round-1-action-1-risk-2" });
  assert.deepEqual(replay, plusTwo);
  assert.equal(fx.tracker.updates, writesAfterBase + 1);

  const plusFive = await run("bid-plus-five", 7, "station-selection", { ...base, riskBidId: "captain-round-1-action-1-risk-5" });
  assert.equal(plusFive.ok, true, JSON.stringify(plusFive.errors));
  const noBid = await run("bid-clear", 8, "station-selection", { ...base, riskBidId: null });
  assert.equal(noBid.ok, true, JSON.stringify(noBid.errors));
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.encounterState.riskBids.captain, undefined);
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.checkpoints.length, 0);

  plusFive.events[0].revision = 999;
  const reloaded = reloadVoyageEventSession("task2-session", fx.context);
  assert.equal(reloaded.ok, true, JSON.stringify(reloaded.errors));
  assert.equal(reloaded.revision, 9);
  const stale = await run("bid-stale", 8, "station-selection", { ...base, riskBidId: "captain-round-1-action-1-risk-2" });
  assert.equal(stale.ok, false);
  assert.equal(fx.tracker.updates, writesAfterBase + 3);
});

test("M12 Task 2 composes same-action approach and Risk Bid edits", async () => {
  const { fx, run } = await task2Fixture();
  const definition = getM12EventDefinition();
  const action = definition.rounds[0].availableStations.find((station) => station.stationId === "captain").actions[0];
  const secondApproachId = `${action.actionId}-approach-2`;
  action.approaches.push({ approachId: secondApproachId, statisticSlugOrAbilityId: "captain-skill-alt" });
  fx.context.resolveEventDefinitionSnapshot = () => structuredClone(definition);
  const stored = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  stored.encounterState.availableStations = structuredClone(definition.rounds[0].availableStations);

  const base = { stationId: "captain", actionId: action.actionId };
  const selected = await run("approach-base", 5, "station-selection", { ...base, approachId: `${action.actionId}-approach`, riskBidId: `${action.actionId}-risk-2` });
  assert.equal(selected.ok, true, JSON.stringify(selected.errors));
  const editedPayload = { ...base, approachId: secondApproachId, riskBidId: `${action.actionId}-risk-5` };
  const edited = await run("approach-edit", 6, "station-selection", editedPayload);
  assert.equal(edited.ok, true, JSON.stringify(edited.errors));
  assert.equal(edited.revision, 7);
  const replay = await run("approach-edit", 6, "station-selection", editedPayload);
  assert.deepEqual(replay, edited);
  const session = reloadVoyageEventSession("task2-session", fx.context);
  assert.equal(session.ok, true, JSON.stringify(session.errors));
  const persisted = fx.journals[0].__testSource.flags.arcflight.system.voyageSession;
  assert.equal(persisted.encounterState.selections.captain.approachId, secondApproachId);
  assert.equal(persisted.encounterState.riskBids.captain.riskBidId, `${action.actionId}-risk-5`);
  assert.equal(persisted.checkpoints.length, 0);
});

test("M12 Task 2 rejects invalid action, approach, bid, order, unoccupied station, and stale lock write-free", async () => {
  const { fx, run } = await task2Fixture();
  const cases = [
    ["bad-action", 5, "station-selection", { stationId: "captain", actionId: "missing", approachId: "missing", riskBidId: null }],
    ["bad-approach", 5, "station-selection", { stationId: "captain", actionId: "captain-round-1-action-1", approachId: "missing", riskBidId: null }],
    ["bad-bid", 5, "station-selection", { stationId: "captain", actionId: "captain-round-1-action-1", approachId: "captain-round-1-action-1-approach", riskBidId: "forged" }],
    ["unoccupied", 5, "station-selection", { stationId: "navigator", actionId: "navigator-round-1-action-1", approachId: "navigator-round-1-action-1-approach", riskBidId: null }],
    ["clear-unknown", 5, "station-selection-clear", { stationId: "navigator" }],
    ["clear-malformed", 5, "station-selection-clear", {}],
    ["duplicate-order", 5, "station-order", { stationOrder: ["captain", "captain"] }],
    ["unknown-order", 5, "station-order", { stationOrder: ["captain", "unknown"] }],
    ["stale-lock", 4, "plan-lock", { phaseStartSnapshotId: "stale" }]
  ];
  for (const [requestId, revision, kind, payload] of cases) {
    const before = fx.tracker.updates;
    const result = await run(requestId, revision, kind, payload);
    assert.equal(result.ok, false, `${requestId}: ${JSON.stringify(result)}`);
    assert.equal(fx.tracker.updates, before);
  }
});

test("M12 Task 2 replays accepted planning commands without a second write", async () => {
  const { fx, run } = await task2Fixture();
  const payload = { stationId: "captain", actionId: "captain-round-1-action-1", approachId: "captain-round-1-action-1-approach", riskBidId: null };
  const first = await run("replay", 5, "station-selection", payload);
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  const writes = fx.tracker.updates;
  const replay = await run("replay", 5, "station-selection", payload);
  assert.deepEqual(replay, first);
  assert.equal(fx.tracker.updates, writes);
  const conflict = await run("replay", 5, "station-selection", { ...payload, actionId: "captain-round-1-action-2" });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.errors[0].code, "m11-request-id-conflict");
  assert.equal(fx.tracker.updates, writes);
});

test("M12 Task 2 incomplete plan lock writes no checkpoint and complete lock is idempotent", async () => {
  const { fx, run } = await task2Fixture();
  const incomplete = await run("incomplete-lock", 5, "plan-lock", { phaseStartSnapshotId: "incomplete" });
  assert.equal(incomplete.ok, false);
  assert.equal(fx.tracker.updates, 1);
  assert.deepEqual(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.checkpoints, []);
  await run("captain", 5, "station-selection", { stationId: "captain", actionId: "captain-round-1-action-1", approachId: "captain-round-1-action-1-approach", riskBidId: null });
  await run("engineer", 6, "station-selection", { stationId: "engineer", actionId: "engineer-round-1-action-1", approachId: "engineer-round-1-action-1-approach", riskBidId: null });
  await run("order", 7, "station-order", { stationOrder: ["captain", "engineer"] });
  const locked = await run("lock", 8, "plan-lock", { phaseStartSnapshotId: "complete" });
  assert.equal(locked.ok, true, JSON.stringify(locked.errors));
  const writes = fx.tracker.updates;
  const replay = await run("lock", 8, "plan-lock", { phaseStartSnapshotId: "complete" });
  assert.deepEqual(replay, locked);
  assert.equal(fx.tracker.updates, writes);
  assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.checkpoints.filter((entry) => entry.kind === "before-plan-lock").length, 1);
});

test("M12 Task 2 commits the trivial order for one occupied station before lock", async () => {
  const fx = fixture();
  const launch = await launchVoyageEventSession({ kind: "voyage.m12-launch-event", requestId: "single-launch", sessionId: "single-session", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: { captain: "captain" } }, fx.context);
  assert.equal(launch.ok, true, JSON.stringify(launch.errors));
  const run = (requestId, expectedRevision, commandKind, payload) => dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId, sessionId: "single-session", expectedRevision, authorityEpoch: 0, commandKind, payload }, fx.context);
  const selected = await run("single-selection", 5, "station-selection", { stationId: "captain", actionId: "captain-round-1-action-1", approachId: "captain-round-1-action-1-approach", riskBidId: null });
  assert.equal(selected.ok, true, JSON.stringify(selected.errors));
  const order = await run("single-order", 6, "station-order", { stationOrder: ["captain"] });
  assert.equal(order.ok, true, JSON.stringify(order.errors));
  const locked = await run("single-lock", 7, "plan-lock", { phaseStartSnapshotId: "single-lock-snapshot" });
  assert.equal(locked.ok, true, JSON.stringify(locked.errors));
  assert.equal(locked.status, "plan-locked");
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

test("public Foundry launch adapter snapshots User documents into trusted plain metadata", async () => {
  const fx = fixture();
  const createDocument = fx.context.JournalEntry.create;
  fx.context.JournalEntry.create = async (...args) => {
    const entry = await createDocument(...args);
    entry.documentName = "JournalEntry";
    return { ...entry, documentName: "JournalEntry", toObject: () => entry.toObject() };
  };
  const previous = Object.fromEntries(["foundry", "Hooks", "CONFIG", "game", "JournalEntry"].map((key) => [key, { exists: Object.hasOwn(globalThis, key), value: globalThis[key] }]));
  let initCallback;
  class FoundryUser {
    constructor(id, isGM, active) { this._id = id; this._isGM = isGM; this._active = active; }
    get id() { return this._id; }
    get isGM() { return this._isGM; }
    get active() { return this._active; }
  }
  const user = new FoundryUser("gm-1", true, true);
  const socketListeners = [];
  const socket = {
    id: "connection-gm-1",
    connected: true,
    on(channel, callback) { assert.equal(channel, "module.arcflight"); socketListeners.push(callback); },
    emit(channel, message) { assert.equal(channel, "module.arcflight"); for (const callback of socketListeners) callback(structuredClone(message)); }
  };
  try {
    globalThis.foundry = { applications: { api: { HandlebarsApplicationMixin: (Base) => Base }, sheets: { ActorSheetV2: class {}, ItemSheetV2: class {} }, apps: {} }, documents: {}, utils: { randomID: () => "Journal.public-launch" } };
    globalThis.Hooks = { once: (_event, callback) => { initCallback = callback; } };
    globalThis.CONFIG = {};
    globalThis.game = {
      user,
      userId: user.id,
      users: { contents: [user], activeGM: user },
      actors: fx.actors,
      journal: fx.journals,
      socket,
      time: { serverTime: Date.parse("2026-08-12T12:00:00.000Z") }
    };
    globalThis.JournalEntry = fx.context.JournalEntry;
    await import(`../../../scripts/arcflight.js?foundry-auth-boundary=${Date.now()}`);
    initCallback();
    const request = { kind: "voyage.m12-launch-event", requestId: "foundry-auth-launch", sessionId: "foundry-auth-session", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: { captain: "captain", engineer: "engineer" } };
    const result = await globalThis.game.arcflight.launchVoyageEventSession(request);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(result.status, "crew-planning");
    assert.equal(result.revision, 5);
    assert.equal(fx.tracker.creates, 1);
    assert.equal(fx.tracker.actors, 0);
    assert.equal(fx.journals.length, 1);
    assert.equal(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.revision, 5);
    assert.deepEqual(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.checkpoints, []);
    assert.deepEqual(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.encounterState.stationAssignments.map((entry) => entry.stationId), ["captain", "engineer"]);
    let revision = result.revision;
    for (const [stationId, actionId] of [["captain", "captain-round-1-action-1"], ["engineer", "engineer-round-1-action-1"]]) {
      const selection = await globalThis.game.arcflight.dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: `public-focus-select-${stationId}`, sessionId: "foundry-auth-session", expectedRevision: revision, authorityEpoch: 0, commandKind: "station-selection", payload: { stationId, actionId, approachId: `${actionId}-approach`, riskBidId: null } });
      assert.equal(selection.ok, true, JSON.stringify(selection.errors)); revision = selection.revision;
    }
    const ordered = await globalThis.game.arcflight.dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "public-focus-order", sessionId: "foundry-auth-session", expectedRevision: revision, authorityEpoch: 0, commandKind: "station-order", payload: { stationOrder: ["captain", "engineer"] } });
    assert.equal(ordered.ok, true, JSON.stringify(ordered.errors));
    const locked = await globalThis.game.arcflight.dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: "public-focus-lock", sessionId: "foundry-auth-session", expectedRevision: ordered.revision, authorityEpoch: 0, commandKind: "plan-lock", payload: { phaseStartSnapshotId: "public-focus-lock" } });
    assert.equal(locked.ok, true, JSON.stringify(locked.errors));
    const started = await globalThis.game.arcflight.beginVoyageEventSessionResolution({ kind: "voyage.m12-begin-resolution", requestId: "public-focus-begin", sessionId: "foundry-auth-session", expectedRevision: locked.revision, authorityEpoch: 0 });
    assert.equal(started.ok, true, JSON.stringify(started.errors));
    assert.deepEqual(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.encounterState.metadata.focusAbilities, M12_FOCUS_ABILITIES);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value.exists) globalThis[key] = value.value;
      else delete globalThis[key];
    }
  }
});

test("M12 launch ignores unrelated JournalEntry source accessors", async () => {
  const fx = fixture();
  const originalCreate = fx.context.JournalEntry.create;
  class JournalEntryLike {
    constructor(source) { this.source = source; this.documentName = "JournalEntry"; }
    get id() { return this.source.id; }
    get __testSource() { return this.source.__testSource; }
    get flags() { return this.source.__testSource.flags; }
    toObject() {
      const source = structuredClone(this.source.toObject());
      Object.defineProperty(source.flags, "exportSource", { enumerable: false, get() { throw new Error("unrelated accessor"); } });
      return source;
    }
    async update(...args) { return this.source.update(...args); }
    async delete(...args) { return this.source.delete(...args); }
  }
  fx.context.isJournalEntryDocument = (document) => document instanceof JournalEntryLike;
  fx.context.JournalEntry.create = async (...args) => {
    const created = await originalCreate(...args);
    const wrapped = new JournalEntryLike(created);
    fx.journals.splice(fx.journals.indexOf(created), 1, wrapped);
    return wrapped;
  };
  const request = { kind: "voyage.m12-launch-event", requestId: "accessor-launch", sessionId: "accessor-session", expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_ID, definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID, shipId: "ship-1", operatorSelections: { captain: "captain", engineer: "engineer" } };
  const result = await launchVoyageEventSession(request, fx.context);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.status, "crew-planning");
  assert.equal(result.revision, 5);
  assert.equal(fx.tracker.creates, 1);
  assert.equal(fx.tracker.updates, 1);
  assert.equal(fx.journals.length, 1);
  assert.deepEqual(fx.journals[0].__testSource.flags.arcflight.system.voyageSession.checkpoints, []);
  assert.equal(reloadVoyageEventSession("accessor-session", fx.context).ok, true);
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
