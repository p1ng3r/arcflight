import assert from "node:assert/strict";
import test from "node:test";
import { applyContextPreservingVoyageLifecycleTransition } from "../../../scripts/voyage/domain/lifecycle-application.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES, VOYAGE_ROUND_PHASES } from "../../../scripts/voyage/domain/constants.js";
import { clonePlainData, createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";

function createEncounter(lifecycleState, revision = 7) {
  const state = {
    ...createDraftVoyageEncounterDefaults(),
    encounterId: "voyage-lifecycle-application",
    lifecycleState,
    revision,
    metadata: { nested: { preserved: true } },
    selections: { captain: { actionId: "hold-course" } },
    reservations: [{ reservationId: "reserve-1", details: { station: "captain" } }],
    tracks: [{ trackId: "pressure", visibility: "exact", limitBehavior: "clamp", thresholds: [] }],
    pendingChecks: [{ checkId: "check-1", data: { dc: 20 } }],
    temporaryConsequences: [{ consequenceId: "temporary-1" }],
    snapshots: [{ snapshotId: "snapshot-1", temporaryState: { tracks: ["pressure"] } }],
    recovery: { status: "none", details: { preserved: true } }
  };

  if ([STATES.READY, STATES.ACTIVE, STATES.PAUSED].includes(lifecycleState)) {
    state.definitionId = "glassback";
    state.primaryShip = { actorId: "ship-1" };
  }
  if ([STATES.ACTIVE, STATES.PAUSED].includes(lifecycleState)) {
    state.currentStage = { stageId: "stage-2", progress: { current: 1 } };
    state.roundNumber = 3;
    state.phase = VOYAGE_ROUND_PHASES.CREW_PLANNING;
  }
  return state;
}

function assertFailure(result) {
  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
}

test("supports every context-preserving lifecycle edge with one revision and one event", () => {
  for (const [fromLifecycleState, toLifecycleState] of [
    [STATES.DRAFT, STATES.CONFIGURATION],
    [STATES.CONFIGURATION, STATES.DRAFT],
    [STATES.READY, STATES.CONFIGURATION],
    [STATES.ACTIVE, STATES.PAUSED],
    [STATES.PAUSED, STATES.ACTIVE]
  ]) {
    const encounter = createEncounter(fromLifecycleState);
    const original = clonePlainData(encounter);
    const result = applyContextPreservingVoyageLifecycleTransition(encounter, toLifecycleState);

    assert.equal(result.ok, true);
    assert.equal(result.nextState.lifecycleState, toLifecycleState);
    assert.equal(result.nextState.revision, original.revision + 1);
    assert.equal(result.events.length, 1);
    assert.deepEqual(result.events[0], {
      type: "voyage.lifecycle-transitioned",
      encounterId: original.encounterId,
      fromLifecycleState,
      toLifecycleState,
      previousRevision: original.revision,
      revision: original.revision + 1
    });
    assert.deepEqual(encounter, original);
    assert.deepEqual({ ...result.nextState, lifecycleState: fromLifecycleState, revision: original.revision }, original);
  }
});

test("success recursively clones mutable encounter data", () => {
  const encounter = createEncounter(STATES.ACTIVE);
  const result = applyContextPreservingVoyageLifecycleTransition(encounter, STATES.PAUSED);

  assert.notEqual(result.nextState, encounter);
  assert.notEqual(result.nextState.metadata, encounter.metadata);
  assert.notEqual(result.nextState.metadata.nested, encounter.metadata.nested);
  assert.notEqual(result.nextState.reservations, encounter.reservations);
  assert.notEqual(result.nextState.reservations[0], encounter.reservations[0]);
  assert.notEqual(result.nextState.snapshots[0].temporaryState, encounter.snapshots[0].temporaryState);
});

test("pausing and resuming preserve the complete active round context", () => {
  for (const [fromLifecycleState, toLifecycleState] of [[STATES.ACTIVE, STATES.PAUSED], [STATES.PAUSED, STATES.ACTIVE]]) {
    const encounter = createEncounter(fromLifecycleState);
    const result = applyContextPreservingVoyageLifecycleTransition(encounter, toLifecycleState);

    for (const field of ["roundNumber", "phase", "currentStage", "selections", "reservations", "tracks", "pendingChecks", "temporaryConsequences", "snapshots", "recovery", "metadata"]) {
      assert.deepEqual(result.nextState[field], encounter[field], field);
    }
  }
});

test("same-state, invalid-target, policy-illegal, invalid-state, and invalid-revision requests fail atomically", () => {
  const cases = [
    [createEncounter(STATES.DRAFT), STATES.DRAFT, "same-lifecycle-state"],
    [createEncounter(STATES.DRAFT), "not-a-lifecycle", "invalid-target-lifecycle-state"],
    [createEncounter(STATES.DRAFT), STATES.ACTIVE, "illegal-lifecycle-transition"],
    [{ ...createEncounter(STATES.DRAFT), encounterId: "" }, STATES.CONFIGURATION, "invalid-encounter-id"],
    [{ ...createEncounter(STATES.DRAFT), revision: -1 }, STATES.CONFIGURATION, "invalid-revision"]
  ];
  for (const [encounter, target, code] of cases) {
    const original = clonePlainData(encounter);
    const result = applyContextPreservingVoyageLifecycleTransition(encounter, target);
    assertFailure(result);
    assert.equal(result.errors[0].code, code);
    assert.deepEqual(encounter, original);
  }
});

test("policy-legal specialized edges require specialized lifecycle operations", () => {
  for (const [fromLifecycleState, toLifecycleState] of [
    [STATES.CONFIGURATION, STATES.READY],
    [STATES.READY, STATES.ACTIVE],
    [STATES.ACTIVE, STATES.COMPLETED_SUCCESS],
    [STATES.ACTIVE, STATES.RECOVERY],
    [STATES.PAUSED, STATES.DISCARDED]
  ]) {
    const encounter = createEncounter(fromLifecycleState);
    const original = clonePlainData(encounter);
    const result = applyContextPreservingVoyageLifecycleTransition(encounter, toLifecycleState);
    assertFailure(result);
    assert.deepEqual(result.errors, [{
      code: "specialized-lifecycle-operation-required",
      path: "toLifecycleState",
      severity: "error",
      message: "This lifecycle transition requires a specialized domain operation."
    }]);
    assert.deepEqual(encounter, original);
  }
});

test("candidate validation failures are atomic", () => {
  const encounter = createEncounter(STATES.READY);
  let encounterIdReads = 0;

  Object.defineProperty(encounter, "encounterId", {
    enumerable: true,
    get() {
      encounterIdReads += 1;
      return encounterIdReads === 1
        ? "voyage-lifecycle-application"
        : "";
    }
  });

  const result = applyContextPreservingVoyageLifecycleTransition(
    encounter,
    STATES.CONFIGURATION
  );

  assertFailure(result);
  assert.equal(result.errors[0].code, "invalid-encounter-id");
});

test("lifecycle application imports without Foundry globals", () => {
  assert.equal(typeof applyContextPreservingVoyageLifecycleTransition, "function");
});

test("Arcflight registration exposes lifecycle application and matching devTools alias", async () => {
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

    await import(`../../../scripts/arcflight.js?lifecycle-application=${Date.now()}`);
    initCallback();
    assert.equal(typeof globalThis.game.arcflight.applyContextPreservingVoyageLifecycleTransition, "function");
    assert.equal(typeof globalThis.game.arcflight.devTools.applyContextPreservingVoyageLifecycleTransition, "function");
  } finally {
    for (const [key, previous] of Object.entries(previousGlobals)) {
      if (previous.exists) globalThis[key] = previous.value;
      else delete globalThis[key];
    }
  }
});
