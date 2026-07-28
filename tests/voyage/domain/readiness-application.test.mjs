import assert from "node:assert/strict";
import test from "node:test";
import { applyVoyageEncounterReadyTransition } from "../../../scripts/voyage/domain/readiness-application.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES } from "../../../scripts/voyage/domain/constants.js";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";

function configuredEncounter() {
  const state = createVoyageEncounterState({ encounterId: "configuration-to-ready" });
  Object.assign(state, {
    lifecycleState: STATES.CONFIGURATION,
    revision: 7,
    definitionId: "cinderwake-wreck",
    definitionRef: { packageId: "cinderwake-wreck" },
    title: "Cinderwake Wreck",
    description: "Reach the wreck.",
    primaryShip: { shipId: "glassback", details: { name: "Glassback" } },
    currentStage: { stageId: "opening", details: { tags: ["alpha"] } },
    successConditions: [{ conditionId: "reach-wreck" }],
    failureConditions: [{ conditionId: "ship-lost" }],
    availableStations: [{ stationId: "captain" }],
    stationAssignments: [{ stationId: "captain", operator: { kind: "actor", uuid: "Actor.captain", name: "Captain" } }],
    tracks: [{ trackId: "pressure", visibility: "exact", limitBehavior: "clamp", thresholds: [] }],
    snapshots: [{ snapshotId: "configured", temporaryState: { tracks: [] } }],
    recovery: { status: "none", detail: { preserved: true } },
    metadata: { nested: { values: ["preserve"] } },
    unknownExtension: { nested: [{ value: true }] }
  });
  return state;
}

function assertFailure(result) {
  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  assert.ok(Array.isArray(result.warnings));
}

function errorCodes(result) {
  return result.errors.map((entry) => entry.code);
}

test("transitions a fully configured encounter to Ready with one event and isolated data", () => {
  const encounter = configuredEncounter();
  const before = structuredClone(encounter);

  const result = applyVoyageEncounterReadyTransition(encounter);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.ok(Array.isArray(result.warnings));
  assert.equal(result.nextState.lifecycleState, STATES.READY);
  assert.equal(result.nextState.revision, before.revision + 1);
  assert.equal(result.events.length, 1);
  assert.deepEqual(result.events[0], {
    type: "voyage.lifecycle-transitioned",
    encounterId: before.encounterId,
    fromLifecycleState: STATES.CONFIGURATION,
    toLifecycleState: STATES.READY,
    previousRevision: before.revision,
    revision: before.revision + 1
  });
  assert.deepEqual(encounter, before);
  assert.equal(encounter.lifecycleState, STATES.CONFIGURATION);
  assert.equal(encounter.revision, before.revision);
  assert.deepEqual({ ...result.nextState, lifecycleState: STATES.CONFIGURATION, revision: before.revision }, before);
  assert.notEqual(result.nextState.primaryShip, encounter.primaryShip);
  assert.deepEqual(result.nextState.stationAssignments, encounter.stationAssignments);
  assert.notEqual(result.nextState.stationAssignments, encounter.stationAssignments);
  assert.notEqual(result.nextState.stationAssignments[0].operator, encounter.stationAssignments[0].operator);
  assert.notEqual(result.nextState.tracks, encounter.tracks);
  assert.notEqual(result.nextState.snapshots[0].temporaryState, encounter.snapshots[0].temporaryState);
  assert.notEqual(result.nextState.recovery, encounter.recovery);
  assert.notEqual(result.nextState.metadata.nested, encounter.metadata.nested);
  assert.notEqual(result.nextState.unknownExtension.nested, encounter.unknownExtension.nested);
  assert.equal(result.nextState.roundNumber, null);
  assert.equal(result.nextState.phase, null);
  assert.deepEqual(result.nextState.snapshots, before.snapshots);
});

test("returns readiness errors unchanged and atomically for malformed or unready Configuration encounters", () => {
  const cases = [
    [{ ...configuredEncounter(), encounterId: "" }, "invalid-encounter-id"],
    [{ ...configuredEncounter(), definitionId: null, definitionRef: null }, "missing-definition"],
    [{ ...configuredEncounter(), primaryShip: null }, "missing-primary-ship"],
    [{ ...configuredEncounter(), currentStage: null }, "missing-initial-stage"],
    [{ ...configuredEncounter(), currentStage: { stageId: "" } }, "invalid-initial-stage-id"],
    [{ ...configuredEncounter(), successConditions: [] }, "missing-success-conditions"],
    [{ ...configuredEncounter(), failureConditions: [] }, "missing-failure-conditions"],
    [{ ...configuredEncounter(), availableStations: [] }, "missing-available-stations"],
    [{ ...configuredEncounter(), roundNumber: 1 }, "activation-round-must-be-inactive"],
    [{ ...configuredEncounter(), phase: "situation" }, "activation-phase-must-be-inactive"],
    [{ ...configuredEncounter(), selections: { captain: { actionId: "hold" } } }, "activation-planning-state-not-empty"]
  ];

  for (const [encounter, code] of cases) {
    const before = structuredClone(encounter);
    const result = applyVoyageEncounterReadyTransition(encounter);
    assertFailure(result);
    assert.ok(errorCodes(result).includes(code));
    assert.deepEqual(encounter, before);
  }
});

test("rejects non-Configuration encounters through activation readiness", () => {
  const encounter = configuredEncounter();
  encounter.lifecycleState = STATES.READY;
  const before = structuredClone(encounter);

  const result = applyVoyageEncounterReadyTransition(encounter);

  assertFailure(result);
  assert.equal(result.errors[0].code, "activation-readiness-requires-configuration");
  assert.deepEqual(encounter, before);
});

test("final candidate validation is reached and remains atomic", () => {
  const encounter = configuredEncounter();
  let encounterIdReads = 0;
  Object.defineProperty(encounter, "encounterId", {
    enumerable: true,
    get() {
      encounterIdReads += 1;
      return encounterIdReads <= 2 ? "configuration-to-ready" : "";
    }
  });

  const result = applyVoyageEncounterReadyTransition(encounter);

  assertFailure(result);
  assert.equal(result.errors[0].code, "invalid-encounter-id");
  assert.equal(encounter.lifecycleState, STATES.CONFIGURATION);
  assert.equal(encounter.revision, 7);
});

test("the domain module imports without Foundry globals", () => {
  assert.equal(typeof applyVoyageEncounterReadyTransition, "function");
});

test("Arcflight registration exposes the ready transition and matching devTools alias", async () => {
  const previousGlobals = Object.fromEntries(["foundry", "Hooks", "CONFIG", "game"].map((key) => [key, {
    exists: Object.hasOwn(globalThis, key), value: globalThis[key]
  }]));
  let initCallback;
  class TestActorSheetV2 {}

  try {
    globalThis.foundry = { applications: { api: { HandlebarsApplicationMixin: (Base) => Base }, sheets: { ActorSheetV2: TestActorSheetV2 }, apps: {} }, documents: {}, utils: {} };
    globalThis.Hooks = { once: (_event, callback) => { initCallback = callback; } };
    globalThis.CONFIG = {};
    globalThis.game = {};

    await import(`../../../scripts/arcflight.js?readiness-application=${Date.now()}`);
    initCallback();
    assert.equal(typeof globalThis.game.arcflight.applyVoyageEncounterReadyTransition, "function");
    assert.equal(typeof globalThis.game.arcflight.devTools.applyVoyageEncounterReadyTransition, "function");
  } finally {
    for (const [key, previous] of Object.entries(previousGlobals)) {
      if (previous.exists) globalThis[key] = previous.value;
      else delete globalThis[key];
    }
  }
});
