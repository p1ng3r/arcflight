import assert from "node:assert/strict";
import test from "node:test";
import { applyVoyageEncounterActivation } from "../../../scripts/voyage/domain/activation-application.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES, VOYAGE_ROUND_PHASES } from "../../../scripts/voyage/domain/constants.js";
import { clonePlainData, createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";
import { validateVoyageEncounterState } from "../../../scripts/voyage/domain/validation.js";

function readyEncounter() {
  return {
    ...createDraftVoyageEncounterDefaults(),
    encounterId: "activation-application", definitionId: "glassback", lifecycleState: STATES.READY, revision: 4,
    primaryShip: { actorId: "ship-1", details: { hull: "glassback" } },
    currentSituation: { clue: { id: "wake" } }, objective: { id: "survive" },
    currentStage: { stageId: "opening", details: { tags: ["alpha"] } },
    participants: [{ participantId: "captain", details: { operatorId: "player-1" } }],
    availableStations: [{ stationId: "captain", actions: [{ actionId: "command" }] }],
    playerVisibleInformation: { clues: [{ id: "debris" }] },
    successConditions: [{ conditionId: "reach-wreck" }], failureConditions: [{ conditionId: "ship-lost" }],
    tracks: [{ trackId: "pressure", visibility: "exact", limitBehavior: "clamp", thresholds: [], details: { current: 1 } }],
    snapshots: [{ snapshotId: "existing", boundaryType: "round-start", lifecycleState: STATES.ACTIVE, stageId: "previous", roundNumber: 1, phase: "situation", temporaryState: { currentStage: { stageId: "previous" } } }],
    recovery: { status: "none" }, metadata: { nested: { preserved: true } }
  };
}

function assertFailure(result) {
  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
}

function codes(result) { return result.errors.map(({ code }) => code); }

test("activates a Ready encounter atomically with ordered caller-identified snapshots and one event", () => {
  const encounter = readyEncounter();
  const request = { roundStartSnapshotId: "  round-start  ", phaseStartSnapshotId: "phase-start", ignored: { value: true } };
  const encounterBefore = clonePlainData(encounter);
  const requestBefore = clonePlainData(request);
  const result = applyVoyageEncounterActivation(encounter, request);

  assert.equal(result.ok, true);
  assert.ok(result.nextState);
  assert.deepEqual(result.errors, []);
  assert.ok(Array.isArray(result.warnings));
  assert.equal(result.events.length, 1);
  assert.equal(result.nextState.lifecycleState, STATES.ACTIVE);
  assert.equal(result.nextState.roundNumber, 1);
  assert.equal(result.nextState.phase, VOYAGE_ROUND_PHASES.SITUATION);
  assert.equal(result.nextState.revision, encounterBefore.revision + 1);
  assert.equal(encounter.revision, encounterBefore.revision);
  assert.deepEqual(result.nextState.snapshots.slice(0, 1), encounterBefore.snapshots);
  assert.equal(result.nextState.snapshots.length, encounterBefore.snapshots.length + 2);
  const [roundStart, phaseStart] = result.nextState.snapshots.slice(-2);
  assert.equal(roundStart.snapshotId, "  round-start  ");
  assert.equal(phaseStart.snapshotId, "phase-start");
  assert.equal(roundStart.boundaryType, "round-start");
  assert.equal(phaseStart.boundaryType, "phase-start");
  for (const snapshot of [roundStart, phaseStart]) {
    assert.equal(snapshot.lifecycleState, STATES.ACTIVE);
    assert.equal(snapshot.roundNumber, 1);
    assert.equal(snapshot.phase, VOYAGE_ROUND_PHASES.SITUATION);
    assert.equal(snapshot.temporaryState.roundNumber, 1);
    assert.equal(snapshot.temporaryState.phase, VOYAGE_ROUND_PHASES.SITUATION);
  }
  assert.notEqual(roundStart.temporaryState, phaseStart.temporaryState);
  assert.notEqual(result.nextState.currentStage, encounter.currentStage);
  assert.notEqual(result.nextState.participants, encounter.participants);
  assert.notEqual(result.nextState.availableStations, encounter.availableStations);
  assert.notEqual(result.nextState.playerVisibleInformation, encounter.playerVisibleInformation);
  assert.notEqual(result.nextState.tracks, encounter.tracks);
  assert.notEqual(result.nextState.metadata, encounter.metadata);
  assert.notEqual(result.nextState.snapshots, encounter.snapshots);
  assert.notEqual(roundStart.temporaryState, encounter.currentSituation);
  assert.deepEqual(encounter, encounterBefore);
  assert.deepEqual(request, requestBefore);
  roundStart.temporaryState.currentStage.details.tags.push("snapshot-only");
  result.nextState.participants[0].details.operatorId = "next-only";
  encounter.metadata.nested.preserved = false;
  assert.equal(phaseStart.temporaryState.currentStage.details.tags.includes("snapshot-only"), false);
  assert.equal(encounter.currentStage.details.tags.includes("snapshot-only"), false);
  assert.equal(encounter.participants[0].details.operatorId, "player-1");
  assert.equal(result.nextState.metadata.nested.preserved, true);
  assert.deepEqual(result.events[0], {
    type: "voyage.lifecycle-transitioned", encounterId: "activation-application",
    fromLifecycleState: STATES.READY, toLifecycleState: STATES.ACTIVE,
    previousRevision: 4, revision: 5, roundNumber: 1, phase: VOYAGE_ROUND_PHASES.SITUATION,
    roundStartSnapshotId: "  round-start  ", phaseStartSnapshotId: "phase-start"
  });
  assert.equal(validateVoyageEncounterState(result.nextState).valid, true);
});

test("propagates activation-start failures before validating requests", () => {
  const cases = [
    [{ ...readyEncounter(), schemaVersion: 99 }, "unsupported-schema-version"],
    [{ ...readyEncounter(), lifecycleState: STATES.CONFIGURATION }, "activation-lifecycle-must-be-ready"],
    [{ ...readyEncounter(), lifecycleState: STATES.ACTIVE, roundNumber: 1, phase: "situation" }, "activation-lifecycle-must-be-ready"],
    [{ ...readyEncounter(), definitionId: null, definitionRef: null }, "missing-definition"],
    [{ ...readyEncounter(), primaryShip: null }, "missing-primary-ship"],
    [{ ...readyEncounter(), selections: { captain: {} } }, "activation-planning-state-not-empty"]
  ];
  for (const [encounter, code] of cases) {
    const before = clonePlainData(encounter);
    const result = applyVoyageEncounterActivation(encounter, null);
    assertFailure(result);
    assert.ok(codes(result).includes(code));
    assert.deepEqual(encounter, before);
  }
});

test("collects activation request ID errors and snapshot collisions without mutating inputs", () => {
  const cases = [
    [null, ["invalid-activation-request"]],
    [{ phaseStartSnapshotId: "phase" }, ["invalid-round-start-snapshot-id"]],
    [{ roundStartSnapshotId: " " }, ["invalid-round-start-snapshot-id", "invalid-phase-start-snapshot-id"]],
    [{ roundStartSnapshotId: "round", phaseStartSnapshotId: " " }, ["invalid-phase-start-snapshot-id"]],
    [{ roundStartSnapshotId: "same", phaseStartSnapshotId: "same" }, ["duplicate-activation-snapshot-id"]],
    [{ roundStartSnapshotId: "existing", phaseStartSnapshotId: "phase" }, ["activation-snapshot-id-already-exists"]],
    [{ roundStartSnapshotId: "round", phaseStartSnapshotId: "existing" }, ["activation-snapshot-id-already-exists"]],
    [{ roundStartSnapshotId: "existing", phaseStartSnapshotId: "existing" }, ["duplicate-activation-snapshot-id", "activation-snapshot-id-already-exists", "activation-snapshot-id-already-exists"]]
  ];
  for (const [request, expectedCodes] of cases) {
    const encounter = readyEncounter();
    const encounterBefore = clonePlainData(encounter);
    const requestBefore = clonePlainData(request);
    const result = applyVoyageEncounterActivation(encounter, request);
    assertFailure(result);
    assert.deepEqual(codes(result), expectedCodes);
    assert.deepEqual(encounter, encounterBefore);
    assert.deepEqual(request, requestBefore);
  }
  const collision = applyVoyageEncounterActivation(readyEncounter(), { roundStartSnapshotId: "existing", phaseStartSnapshotId: "existing" });
  assert.deepEqual(collision.errors.map(({ path }) => path), ["activationRequest.phaseStartSnapshotId", "activationRequest.roundStartSnapshotId", "activationRequest.phaseStartSnapshotId"]);
});

test("candidate construction failure from adversarial plain data is atomic", () => {
  const encounter = readyEncounter();
  let metadataReads = 0;
  Object.defineProperty(encounter, "metadata", {
    enumerable: true,
    get() {
      metadataReads += 1;
      if (metadataReads > 2) throw new Error("adversarial getter");
      return { nested: { preserved: true } };
    }
  });
  const result = applyVoyageEncounterActivation(encounter, { roundStartSnapshotId: "round", phaseStartSnapshotId: "phase" });
  assertFailure(result);
  assert.equal(result.errors[0].code, "activation-candidate-construction-failed");
  assert.equal(encounter.lifecycleState, STATES.READY);
  assert.equal(encounter.snapshots.length, 1);
});

test("the domain module imports without Foundry globals", () => {
  assert.equal(typeof applyVoyageEncounterActivation, "function");
});

test("Arcflight registers activation application and matching devTools alias", async () => {
  const previous = Object.fromEntries(["foundry", "Hooks", "CONFIG", "game"].map((key) => [key, { exists: Object.hasOwn(globalThis, key), value: globalThis[key] }]));
  let initCallback;
  class TestActorSheetV2 {}
  try {
    globalThis.foundry = { applications: { api: { HandlebarsApplicationMixin: (Base) => Base }, sheets: { ActorSheetV2: TestActorSheetV2 }, apps: {} }, documents: {}, utils: {} };
    globalThis.Hooks = { once: (_event, callback) => { initCallback = callback; } };
    globalThis.CONFIG = {};
    globalThis.game = {};
    await import(`../../../scripts/arcflight.js?activation-application=${Date.now()}`);
    initCallback();
    assert.equal(typeof globalThis.game.arcflight.applyVoyageEncounterActivation, "function");
    assert.equal(typeof globalThis.game.arcflight.devTools.applyVoyageEncounterActivation, "function");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value.exists) globalThis[key] = value.value;
      else delete globalThis[key];
    }
  }
});
