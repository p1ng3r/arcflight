import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { validateVoyageEncounterActivationStart } from "../../../scripts/voyage/domain/activation-start-readiness.js";

function readyEncounter() {
  const state = createVoyageEncounterState({ encounterId: "activation-start" });
  Object.assign(state, {
    lifecycleState: "ready",
    revision: 7,
    definitionId: "cinderwake-wreck",
    primaryShip: { shipId: "glassback" },
    currentStage: { stageId: "opening", details: { tags: ["alpha"] } },
    successConditions: [{ conditionId: "reach-wreck" }],
    failureConditions: [{ conditionId: "ship-lost" }],
    availableStations: [{ stationId: "captain" }]
  });
  return state;
}

function errorCodes(report) {
  return report.errors.map((entry) => entry.code);
}

test("returns a clean report for a valid Ready encounter without exposing or mutating the Active candidate", () => {
  const encounter = readyEncounter();
  encounter.metadata = { nested: { values: ["preserve"] } };
  const before = structuredClone(encounter);

  const report = validateVoyageEncounterActivationStart(encounter);

  assert.deepEqual(report, { ready: true, errors: [], warnings: [] });
  assert.deepEqual(encounter, before);
  assert.equal(encounter.lifecycleState, "ready");
  assert.equal(encounter.revision, 7);
  assert.equal(encounter.roundNumber, null);
  assert.equal(encounter.phase, null);
  assert.deepEqual(encounter.currentStage.details.tags, ["alpha"]);
  assert.deepEqual(encounter.metadata.nested.values, ["preserve"]);
  assert.equal(Object.hasOwn(report, "activeCandidate"), false);
  assert.equal(Object.hasOwn(report, "nextState"), false);
});

test("contains hostile station-order array reads", () => {
  const encounter = readyEncounter();
  encounter.committedStationOrder = new Proxy([], {
    get(target, key, receiver) {
      if (key === "length") throw new Error("hostile length");
      return Reflect.get(target, key, receiver);
    }
  });

  assert.deepEqual(validateVoyageEncounterActivationStart(encounter), {
    ready: false,
    errors: [{
      code: "activation-start-data-read-failed",
      path: "$",
      message: "Activation-start data could not be read safely.",
      severity: "error"
    }],
    warnings: []
  });
});

test("rejects malformed fixed assignments through canonical state validation", () => {
  const encounter = readyEncounter();
  encounter.stationAssignments = [
    {
      stationId: "captain",
      operator: { kind: "actor", id: "shared", uuid: "Actor.shared" }
    },
    {
      stationId: "engineer",
      operator: { kind: "actor", id: "shared", uuid: "Actor.shared" }
    }
  ];

  const report = validateVoyageEncounterActivationStart(encounter);

  assert.equal(report.ready, false);
  assert.ok(errorCodes(report).includes("duplicate-station-operator"));
});

test("returns existing supplied-state validation reports unchanged", () => {
  const malformed = readyEncounter();
  malformed.schemaVersion = 999;
  malformed.revision = -1;
  malformed.participants = {};
  const report = validateVoyageEncounterActivationStart(malformed);

  assert.equal(report.ready, false);
  assert.ok(errorCodes(report).includes("unsupported-schema-version"));
  assert.ok(errorCodes(report).includes("invalid-revision"));
  assert.ok(errorCodes(report).includes("invalid-collection-type"));
  assert.equal(errorCodes(report).includes("missing-success-conditions"), false);
});

test("requires an otherwise valid Ready encounter", () => {
  for (const lifecycleState of ["configuration", "active"]) {
    const encounter = readyEncounter();
    encounter.lifecycleState = lifecycleState;
    if (lifecycleState === "active") {
      encounter.roundNumber = 1;
      encounter.phase = "situation";
    }
    const report = validateVoyageEncounterActivationStart(encounter);
    assert.deepEqual(report.errors, [{
      code: "activation-start-requires-ready",
      path: "lifecycleState",
      message: "Voyage activation requires a Ready encounter.",
      severity: "error"
    }]);
  }
});

test("uses state and Ready-to-Active lifecycle policy validation", () => {
  const missingDefinition = readyEncounter();
  missingDefinition.definitionId = null;
  const missingShip = readyEncounter();
  missingShip.primaryShip = null;

  assert.ok(errorCodes(validateVoyageEncounterActivationStart(missingDefinition)).includes("missing-definition"));
  assert.ok(errorCodes(validateVoyageEncounterActivationStart(missingShip)).includes("missing-primary-ship"));
  assert.equal(validateVoyageEncounterActivationStart(readyEncounter()).ready, true);
});

test("reaches complete Active-candidate validation and preserves supplied state atomically", () => {
  const encounter = readyEncounter();
  let reads = 0;
  Object.defineProperty(encounter, "encounterId", {
    enumerable: true,
    get() {
      reads += 1;
      return reads === 1 ? "activation-start" : "";
    }
  });

  const report = validateVoyageEncounterActivationStart(encounter);

  assert.equal(report.ready, false);
  assert.ok(errorCodes(report).includes("invalid-encounter-id"));
  assert.equal(encounter.lifecycleState, "ready");
  assert.equal(encounter.revision, 7);
  assert.equal(encounter.roundNumber, null);
  assert.equal(encounter.phase, null);
  assert.equal(Object.hasOwn(report, "activeCandidate"), false);
});

test("requires the Active candidate current stage and a non-blank initial stage ID", () => {
  const missingStage = readyEncounter();
  missingStage.currentStage = null;
  const blankStageId = readyEncounter();
  blankStageId.currentStage.stageId = "  ";

  assert.ok(errorCodes(validateVoyageEncounterActivationStart(missingStage)).includes("missing-current-stage"));
  assert.ok(errorCodes(validateVoyageEncounterActivationStart(blankStageId)).includes("invalid-initial-stage-id"));
});

test("requires conditions, stations, and inactive Ready round context", () => {
  for (const [fieldName, code] of [
    ["successConditions", "missing-success-conditions"],
    ["failureConditions", "missing-failure-conditions"],
    ["availableStations", "missing-available-stations"]
  ]) {
    const encounter = readyEncounter();
    encounter[fieldName] = [];
    assert.ok(errorCodes(validateVoyageEncounterActivationStart(encounter)).includes(code));
  }
  const activeRound = readyEncounter();
  activeRound.roundNumber = 1;
  const activePhase = readyEncounter();
  activePhase.phase = "crew-planning";
  assert.ok(errorCodes(validateVoyageEncounterActivationStart(activeRound)).includes("activation-round-must-be-inactive"));
  assert.ok(errorCodes(validateVoyageEncounterActivationStart(activePhase)).includes("activation-phase-must-be-inactive"));
});

test("requires every pre-round planning field to be empty and collects multiple failures", () => {
  for (const fieldName of ["selections", "targets", "riskBids"]) {
    const encounter = readyEncounter();
    encounter[fieldName] = { captain: "command" };
    const issue = validateVoyageEncounterActivationStart(encounter).errors.find((entry) => entry.path === fieldName);
    assert.equal(issue?.code, "activation-planning-state-not-empty");
  }
  for (const fieldName of ["assistance", "reservations", "proposedStationOrder", "committedStationOrder", "pendingChecks", "pendingThresholdQueue", "pendingConsequences"]) {
    const encounter = readyEncounter();
    encounter[fieldName] = [{ id: fieldName }];
    const issue = validateVoyageEncounterActivationStart(encounter).errors.find((entry) => entry.path === fieldName);
    assert.equal(issue?.code, "activation-planning-state-not-empty");
  }

  const encounter = readyEncounter();
  Object.assign(encounter, { currentStage: null, successConditions: [], failureConditions: [], availableStations: [], roundNumber: 1, phase: "situation", selections: { captain: "command" }, assistance: [{ id: "help" }] });
  const report = validateVoyageEncounterActivationStart(encounter);
  for (const code of ["missing-current-stage", "missing-success-conditions", "missing-failure-conditions", "missing-available-stations", "activation-round-must-be-inactive", "activation-phase-must-be-inactive", "activation-planning-state-not-empty"]) {
    assert.ok(errorCodes(report).includes(code));
  }
});

test("allows optional and historical data that is structurally valid", () => {
  const encounter = readyEncounter();
  Object.assign(encounter, {
    tracks: [], participants: [], playerVisibleInformation: {}, gmSecretInformation: {},
    temporaryConsequences: [], permanentConsequences: [],
    snapshots: [{ snapshotId: "before-active", temporaryState: {} }],
    processedRequestIds: ["request-1"], recovery: { reason: "saved" }, metadata: { note: "ready" }
  });
  assert.deepEqual(validateVoyageEncounterActivationStart(encounter), { ready: true, errors: [], warnings: [] });
});

test("the domain module imports without Foundry globals", () => {
  assert.equal(typeof validateVoyageEncounterActivationStart, "function");
  assert.equal(validateVoyageEncounterActivationStart(readyEncounter()).ready, true);
});

test("Arcflight registers the activation-start validator and dev-tools alias", async () => {
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

    await import(`../../../scripts/arcflight.js?activation-start=${Date.now()}`);
    initCallback();
    assert.equal(typeof globalThis.game.arcflight.validateVoyageEncounterActivationStart, "function");
    assert.equal(typeof globalThis.game.arcflight.devTools.validateVoyageEncounterActivationStart, "function");
  } finally {
    for (const [key, previous] of Object.entries(previousGlobals)) {
      if (previous.exists) globalThis[key] = previous.value;
      else delete globalThis[key];
    }
  }
});
