import assert from "node:assert/strict";
import test from "node:test";
import { applyVoyageEncounterCrewPlanningTransition } from "../../../scripts/voyage/domain/crew-planning-transition.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES, VOYAGE_ROUND_PHASES } from "../../../scripts/voyage/domain/constants.js";
import { clonePlainData, createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";
import { validateVoyageEncounterState } from "../../../scripts/voyage/domain/validation.js";

function activeSituationEncounter() {
  return {
    ...createDraftVoyageEncounterDefaults(),
    encounterId: "crew-planning", definitionId: "glassback", lifecycleState: STATES.ACTIVE, revision: 4,
    primaryShip: { actorId: "ship", nested: { hull: "glassback" } }, currentStage: { stageId: "opening", details: { tags: ["alpha"] } },
    currentSituation: { details: { threat: "debris" } }, objective: { id: "survive" }, roundNumber: 2, phase: VOYAGE_ROUND_PHASES.SITUATION,
    participants: [{ participantId: "captain", details: { userId: "user" } }], availableStations: [{ stationId: "captain", actions: [{ actionId: "command" }] }],
    successConditions: [{ conditionId: "success" }], failureConditions: [{ conditionId: "failure" }], playerVisibleInformation: { clues: ["wake"] }, gmSecretInformation: { threat: { id: "hidden" } },
    tracks: [{ trackId: "pressure", visibility: "exact", limitBehavior: "clamp", thresholds: [] }], metadata: { nested: { retained: true } },
    snapshots: [{ snapshotId: "existing", boundaryType: "phase-start", lifecycleState: STATES.ACTIVE, stageId: "previous", roundNumber: 1, phase: "situation", temporaryState: {} }],
    pendingThresholdQueue: [{ thresholdId: "queue" }], pendingConsequences: [{ consequenceId: "pending" }], temporaryConsequences: [{ consequenceId: "temporary" }], recovery: { status: "none" }
  };
}

function assertFailure(result) {
  assert.equal(result.ok, false); assert.equal(result.nextState, null); assert.deepEqual(result.events, []);
}

test("atomically enters Crew Planning with one appended phase-start snapshot and event", () => {
  const encounter = activeSituationEncounter();
  const request = { phaseStartSnapshotId: "  planning-start  ", ignored: { value: true } };
  const before = clonePlainData(encounter); const requestBefore = clonePlainData(request);
  const result = applyVoyageEncounterCrewPlanningTransition(encounter, request);
  assert.equal(result.ok, true); assert.deepEqual(result.errors, []); assert.ok(Array.isArray(result.warnings)); assert.equal(result.events.length, 1);
  assert.equal(result.nextState.lifecycleState, STATES.ACTIVE); assert.equal(result.nextState.phase, VOYAGE_ROUND_PHASES.CREW_PLANNING); assert.equal(result.nextState.roundNumber, 2); assert.equal(result.nextState.revision, 5);
  assert.deepEqual(result.nextState.snapshots.slice(0, -1), before.snapshots);
  const snapshot = result.nextState.snapshots.at(-1);
  assert.equal(snapshot.snapshotId, "  planning-start  "); assert.equal(snapshot.boundaryType, "phase-start"); assert.equal(snapshot.lifecycleState, STATES.ACTIVE); assert.equal(snapshot.roundNumber, 2); assert.equal(snapshot.phase, VOYAGE_ROUND_PHASES.CREW_PLANNING); assert.equal(snapshot.temporaryState.phase, VOYAGE_ROUND_PHASES.CREW_PLANNING); assert.equal(snapshot.temporaryState.roundNumber, 2);
  assert.deepEqual(result.events[0], { type: "voyage.phase-transitioned", encounterId: "crew-planning", lifecycleState: STATES.ACTIVE, roundNumber: 2, fromPhase: VOYAGE_ROUND_PHASES.SITUATION, toPhase: VOYAGE_ROUND_PHASES.CREW_PLANNING, previousRevision: 4, revision: 5, phaseStartSnapshotId: "  planning-start  " });
  assert.deepEqual(encounter, before); assert.deepEqual(request, requestBefore); assert.equal(validateVoyageEncounterState(result.nextState).valid, true);
  assert.notEqual(result.nextState.currentStage, encounter.currentStage); assert.notEqual(result.nextState.currentSituation, encounter.currentSituation); assert.notEqual(result.nextState.participants, encounter.participants); assert.notEqual(result.nextState.availableStations, encounter.availableStations); assert.notEqual(result.nextState.playerVisibleInformation, encounter.playerVisibleInformation); assert.notEqual(result.nextState.gmSecretInformation, encounter.gmSecretInformation); assert.notEqual(result.nextState.tracks, encounter.tracks); assert.notEqual(result.nextState.metadata, encounter.metadata); assert.notEqual(snapshot.temporaryState, result.nextState.currentSituation);
  result.nextState.metadata.nested.retained = false; encounter.currentStage.details.tags.push("source-only");
  assert.equal(encounter.metadata.nested.retained, true); assert.equal(result.nextState.currentStage.details.tags.includes("source-only"), false);
});

test("propagates structural, lifecycle, and phase-policy failures before request inspection", () => {
  const malformed = { ...activeSituationEncounter(), schemaVersion: 99 };
  const validation = validateVoyageEncounterState(malformed);
  const malformedResult = applyVoyageEncounterCrewPlanningTransition(malformed, null);
  assertFailure(malformedResult); assert.deepEqual(malformedResult.errors, validation.errors);
  for (const [lifecycle, phase, code] of [[STATES.READY, "inactive", "crew-planning-transition-requires-active"], [STATES.PAUSED, VOYAGE_ROUND_PHASES.SITUATION, "crew-planning-transition-requires-active"], [STATES.ACTIVE, VOYAGE_ROUND_PHASES.CREW_PLANNING, "same-voyage-phase"], [STATES.ACTIVE, VOYAGE_ROUND_PHASES.LOCK_READINESS, "illegal-voyage-phase-transition"], [STATES.ACTIVE, VOYAGE_ROUND_PHASES.RESOLUTION, "illegal-voyage-phase-transition"]]) {
    const encounter = activeSituationEncounter(); encounter.lifecycleState = lifecycle; encounter.phase = phase;
    if (lifecycle === STATES.READY) { encounter.roundNumber = "inactive"; }
    const result = applyVoyageEncounterCrewPlanningTransition(encounter, null); assertFailure(result); assert.equal(result.errors[0].code, code);
  }
});

test("collects request, collision, and stale planning errors in contract order", () => {
  const invalidRequest = applyVoyageEncounterCrewPlanningTransition(activeSituationEncounter(), null); assertFailure(invalidRequest); assert.deepEqual(invalidRequest.errors.map((entry) => entry.code), ["invalid-crew-planning-transition-request"]);
  const missing = applyVoyageEncounterCrewPlanningTransition(activeSituationEncounter(), {}); assert.deepEqual(missing.errors.map((entry) => entry.code), ["invalid-phase-start-snapshot-id"]);
  const encounter = activeSituationEncounter(); encounter.selections.a = {}; encounter.targets.a = {}; encounter.riskBids.a = {}; encounter.assistance.push({}); encounter.reservations.push({}); encounter.pendingChecks.push({});
  const result = applyVoyageEncounterCrewPlanningTransition(encounter, { phaseStartSnapshotId: "existing" }); assertFailure(result);
  assert.deepEqual(result.errors.map((entry) => entry.code), ["phase-start-snapshot-id-already-exists", "crew-planning-input-not-empty", "crew-planning-input-not-empty", "crew-planning-input-not-empty", "crew-planning-input-not-empty", "crew-planning-input-not-empty", "crew-planning-input-not-empty"]);
  assert.deepEqual(result.errors.map((entry) => entry.path), ["transitionRequest.phaseStartSnapshotId", "selections", "targets", "riskBids", "assistance", "reservations", "pendingChecks"]);
  const caseSensitive = applyVoyageEncounterCrewPlanningTransition(activeSituationEncounter(), { phaseStartSnapshotId: "EXISTING" }); assert.equal(caseSensitive.ok, true);
});

test("the Crew Planning domain module imports without Foundry globals", () => {
  assert.equal(typeof applyVoyageEncounterCrewPlanningTransition, "function");
});

test("Arcflight registers the Crew Planning transition and matching devTools alias", async () => {
  const previous = Object.fromEntries(["foundry", "Hooks", "CONFIG", "game"].map((key) => [key, { exists: Object.hasOwn(globalThis, key), value: globalThis[key] }]));
  let initCallback;
  class TestActorSheetV2 {}
  try {
    globalThis.foundry = { applications: { api: { HandlebarsApplicationMixin: (Base) => Base }, sheets: { ActorSheetV2: TestActorSheetV2 }, apps: {} }, documents: {}, utils: {} };
    globalThis.Hooks = { once: (_event, callback) => { initCallback = callback; } };
    globalThis.CONFIG = {}; globalThis.game = {};
    await import(`../../../scripts/arcflight.js?crew-planning-transition=${Date.now()}`);
    initCallback();
    assert.equal(typeof globalThis.game.arcflight.applyVoyageEncounterCrewPlanningTransition, "function");
    assert.equal(typeof globalThis.game.arcflight.devTools.applyVoyageEncounterCrewPlanningTransition, "function");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value.exists) globalThis[key] = value.value;
      else delete globalThis[key];
    }
  }
});
