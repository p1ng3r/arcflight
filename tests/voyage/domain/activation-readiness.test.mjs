import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { validateVoyageEncounterActivationReadiness } from "../../../scripts/voyage/domain/activation-readiness.js";

function configuredEncounter() {
  const state = createVoyageEncounterState({ encounterId: "activation-readiness" });
  Object.assign(state, {
    lifecycleState: "configuration",
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

test("returns a clean ready result for a fully configured encounter without mutating it", () => {
  const encounter = configuredEncounter();
  encounter.metadata = { nested: { values: ["preserve"] } };
  const before = structuredClone(encounter);

  const report = validateVoyageEncounterActivationReadiness(encounter);

  assert.deepEqual(report, { ready: true, errors: [], warnings: [] });
  assert.deepEqual(encounter, before);
  assert.equal(encounter.lifecycleState, "configuration");
  assert.equal(encounter.revision, 7);
  assert.deepEqual(encounter.currentStage.details.tags, ["alpha"]);
  assert.deepEqual(encounter.metadata.nested.values, ["preserve"]);
  assert.equal(Object.hasOwn(report, "readyCandidate"), false);
});

test("accepts valid empty and partial fixed assignment sets", () => {
  const empty = configuredEncounter();
  const partial = configuredEncounter();
  partial.stationAssignments = [{
    stationId: "captain",
    operator: {
      kind: "actor",
      id: "captain-actor",
      uuid: "Actor.captain-actor",
      name: "Captain"
    }
  }];
  const partialBefore = structuredClone(partial);

  assert.equal(validateVoyageEncounterActivationReadiness(empty).ready, true);
  assert.equal(validateVoyageEncounterActivationReadiness(partial).ready, true);
  assert.deepEqual(partial, partialBefore);
});

test("rejects malformed fixed assignments through canonical state validation", () => {
  const encounter = configuredEncounter();
  encounter.stationAssignments = [{
    stationId: "captain",
    operator: { kind: "actor", id: "" }
  }];

  const report = validateVoyageEncounterActivationReadiness(encounter);

  assert.equal(report.ready, false);
  assert.ok(errorCodes(report).includes("invalid-station-operator-id"));
  assert.ok(errorCodes(report).includes("missing-station-operator-identity"));
});

test("preserves existing structural validation errors before readiness checks", () => {
  const malformed = configuredEncounter();
  malformed.schemaVersion = 999;
  malformed.revision = -1;
  malformed.participants = {};
  const report = validateVoyageEncounterActivationReadiness(malformed);

  assert.equal(report.ready, false);
  assert.ok(errorCodes(report).includes("unsupported-schema-version"));
  assert.ok(errorCodes(report).includes("invalid-revision"));
  assert.ok(errorCodes(report).includes("invalid-collection-type"));
  assert.equal(errorCodes(report).includes("missing-success-conditions"), false);
});

test("requires an otherwise valid Configuration encounter", () => {
  const encounter = configuredEncounter();
  encounter.lifecycleState = "ready";
  const report = validateVoyageEncounterActivationReadiness(encounter);

  assert.deepEqual(report.errors, [{
    code: "activation-readiness-requires-configuration",
    path: "lifecycleState",
    message: "Activation readiness validation requires a Configuration encounter.",
    severity: "error"
  }]);
});

test("uses Ready-candidate validation for definition and primary ship requirements", () => {
  const missingDefinition = configuredEncounter();
  missingDefinition.definitionId = null;
  const missingShip = configuredEncounter();
  missingShip.primaryShip = null;

  assert.ok(errorCodes(validateVoyageEncounterActivationReadiness(missingDefinition)).includes("missing-definition"));
  assert.ok(errorCodes(validateVoyageEncounterActivationReadiness(missingShip)).includes("missing-primary-ship"));
});

test("requires an initial stage and non-empty stage ID", () => {
  const missingStage = configuredEncounter();
  missingStage.currentStage = null;
  const blankStageId = configuredEncounter();
  blankStageId.currentStage.stageId = "  ";

  assert.ok(errorCodes(validateVoyageEncounterActivationReadiness(missingStage)).includes("missing-initial-stage"));
  assert.ok(errorCodes(validateVoyageEncounterActivationReadiness(blankStageId)).includes("invalid-initial-stage-id"));
});

test("requires success conditions, failure conditions, and available stations", () => {
  for (const [fieldName, code] of [
    ["successConditions", "missing-success-conditions"],
    ["failureConditions", "missing-failure-conditions"],
    ["availableStations", "missing-available-stations"]
  ]) {
    const encounter = configuredEncounter();
    encounter[fieldName] = [];
    assert.ok(errorCodes(validateVoyageEncounterActivationReadiness(encounter)).includes(code));
  }
});

test("requires inactive round context", () => {
  const roundActive = configuredEncounter();
  roundActive.roundNumber = 1;
  const phaseActive = configuredEncounter();
  phaseActive.phase = "crew-planning";

  assert.ok(errorCodes(validateVoyageEncounterActivationReadiness(roundActive)).includes("activation-round-must-be-inactive"));
  assert.ok(errorCodes(validateVoyageEncounterActivationReadiness(phaseActive)).includes("activation-phase-must-be-inactive"));
});

test("requires every round-planning collection to be empty", () => {
  for (const fieldName of ["selections", "targets", "riskBids"]) {
    const encounter = configuredEncounter();
    encounter[fieldName] = { station: "captain" };
    const issue = validateVoyageEncounterActivationReadiness(encounter).errors.find((entry) => entry.path === fieldName);
    assert.equal(issue?.code, "activation-planning-state-not-empty");
  }
  for (const fieldName of ["assistance", "reservations", "pendingChecks", "pendingThresholdQueue", "pendingConsequences"]) {
    const encounter = configuredEncounter();
    encounter[fieldName] = [{ id: fieldName }];
    const issue = validateVoyageEncounterActivationReadiness(encounter).errors.find((entry) => entry.path === fieldName);
    assert.equal(issue?.code, "activation-planning-state-not-empty");
  }
});

test("collects multiple readiness errors and permits optional configured or recovery data", () => {
  const encounter = configuredEncounter();
  Object.assign(encounter, {
    currentStage: null,
    successConditions: [],
    failureConditions: [],
    availableStations: [],
    roundNumber: 1,
    phase: "situation",
    selections: { captain: "command" },
    tracks: [],
    participants: [],
    snapshots: [{ snapshotId: "before-ready", temporaryState: {} }],
    processedRequestIds: ["request-1"],
    recovery: { reason: "saved" },
    metadata: { note: "configured" }
  });
  const report = validateVoyageEncounterActivationReadiness(encounter);

  for (const code of ["missing-initial-stage", "missing-success-conditions", "missing-failure-conditions", "missing-available-stations", "activation-round-must-be-inactive", "activation-phase-must-be-inactive", "activation-planning-state-not-empty"]) {
    assert.ok(errorCodes(report).includes(code));
  }
});

test("allows empty optional collections and valid historical or recovery data", () => {
  const encounter = configuredEncounter();
  Object.assign(encounter, {
    tracks: [],
    participants: [],
    playerVisibleInformation: {},
    gmSecretInformation: {},
    temporaryConsequences: [],
    permanentConsequences: [],
    snapshots: [{ snapshotId: "before-ready", temporaryState: {} }],
    processedRequestIds: ["request-1"],
    recovery: { reason: "saved" },
    metadata: { note: "configured" }
  });

  assert.deepEqual(validateVoyageEncounterActivationReadiness(encounter), { ready: true, errors: [], warnings: [] });
});

test("the domain module imports without Foundry globals", () => {
  assert.equal(typeof validateVoyageEncounterActivationReadiness, "function");
  assert.equal(validateVoyageEncounterActivationReadiness(configuredEncounter()).ready, true);
});

test("Arcflight registers the activation readiness validator and dev-tools alias", async () => {
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

    await import(`../../../scripts/arcflight.js?activation-readiness=${Date.now()}`);
    initCallback();
    assert.equal(typeof globalThis.game.arcflight.validateVoyageEncounterActivationReadiness, "function");
    assert.equal(typeof globalThis.game.arcflight.devTools.validateVoyageEncounterActivationReadiness, "function");
  } finally {
    for (const [key, previous] of Object.entries(previousGlobals)) {
      if (previous.exists) globalThis[key] = previous.value;
      else delete globalThis[key];
    }
  }
});
