import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import {
  applyVoyageEncounterPendingCheckPreparation,
  validateVoyageEncounterPendingChecks
} from "../../../scripts/voyage/domain/pending-checks.js";

const RESULT_FIELDS = [
  "total",
  "degreeOfSuccess",
  "degreeOfSuccessSlug",
  "statisticSlug",
  "dc",
  "rollMode"
];

function encounter({ phase = "resolution", secret = false, statisticOptions = ["diplomacy"] } = {}) {
  const state = createVoyageEncounterState({
    encounterId: "pending-checks",
    definitionId: "definition",
    primaryShip: { id: "ship" }
  });

  Object.assign(state, {
    lifecycleState: "active",
    currentStage: { stageId: "stage" },
    roundNumber: 1,
    phase,
    availableStations: [{
      stationId: "captain",
      actions: [{
        actionId: "check",
        check: {
          source: { kind: "character", uuid: "Actor.captain" },
          statisticOptions,
          dcSource: { kind: "fixed", value: 20 },
          secrecy: secret ? "secret" : "public"
        }
      }]
    }],
    selections: { captain: { stationId: "captain", actionId: "check" } }
  });

  return state;
}

function preparedEncounter(options = {}) {
  const result = applyVoyageEncounterPendingCheckPreparation(
    encounter(options),
    { pendingCheckIds: [{ sequence: 0, pendingCheckId: "pending-0" }] }
  );
  assert.equal(result.ok, true);
  return result.nextState;
}

function resolvedResult(overrides = {}) {
  return {
    total: 20,
    degreeOfSuccess: 2,
    degreeOfSuccessSlug: "success",
    statisticSlug: "diplomacy",
    dc: 20,
    rollMode: "public",
    ...overrides
  };
}

function setResolvedCheck(state, result = resolvedResult()) {
  state.pendingChecks[0].status = "resolved";
  state.pendingChecks[0].result = result;
}

function customPrototypeArray(array, prototype, callback) {
  const previous = Object.getPrototypeOf(array);
  Object.setPrototypeOf(array, prototype);
  try {
    return callback();
  } finally {
    Object.setPrototypeOf(array, previous);
  }
}

test("accepts pending checks with a null result and resolved checks with all degree/slug pairs", () => {
  assert.equal(validateVoyageEncounterPendingChecks(preparedEncounter()).valid, true);

  const pairs = [
    [0, "critical-failure"],
    [1, "failure"],
    [2, "success"],
    [3, "critical-success"]
  ];

  for (const [degreeOfSuccess, degreeOfSuccessSlug] of pairs) {
    const state = preparedEncounter();
    setResolvedCheck(state, resolvedResult({ degreeOfSuccess, degreeOfSuccessSlug }));
    assert.equal(validateVoyageEncounterPendingChecks(state).valid, true, degreeOfSuccessSlug);

    state.phase = "consequences";
    assert.equal(validateVoyageEncounterPendingChecks(state).valid, true, `${degreeOfSuccessSlug} in Consequences`);
  }
});

test("requires an exact six-own-field resolved result", () => {
  for (const [mutationIndex, mutate] of [
    (result) => delete result.total,
    (result) => { result.extra = true; },
    (result) => Object.defineProperty(result, "extra", { configurable: true, value: true }),
    (result) => { result[Symbol("extra")] = true; },
    (result) => { result.degreeOfSuccess = 4; },
    (result) => { result.degreeOfSuccessSlug = "failure"; },
    (result) => { result.total = Number.POSITIVE_INFINITY; },
    (result) => { result.statisticSlug = "athletics"; },
    (result) => { result.dc = 21; },
    (result) => { result.rollMode = "publicroll"; }
  ].entries()) {
    const state = preparedEncounter();
    const result = resolvedResult();
    mutate(result);
    setResolvedCheck(state, result);
    assert.equal(validateVoyageEncounterPendingChecks(state).valid, false, `mutation ${mutationIndex}`);
  }
});

test("requires secrecy-specific public and blind roll modes", () => {
  const publicState = preparedEncounter();
  setResolvedCheck(publicState, resolvedResult({ rollMode: "blind" }));
  assert.equal(validateVoyageEncounterPendingChecks(publicState).valid, false);

  const secretState = preparedEncounter({ secret: true });
  setResolvedCheck(secretState, resolvedResult({ rollMode: "public" }));
  assert.equal(validateVoyageEncounterPendingChecks(secretState).valid, false);

  for (const rollMode of ["publicroll", "blindroll"]) {
    const state = preparedEncounter();
    setResolvedCheck(state, resolvedResult({ rollMode }));
    assert.equal(validateVoyageEncounterPendingChecks(state).valid, false, rollMode);
  }
});

test("uses only own statistic options and ignores inherited entries and getters", () => {
  const sparseOptions = ["diplomacy"];
  sparseOptions.length = 2;
  const state = preparedEncounter({ statisticOptions: sparseOptions });
  const options = state.pendingChecks[0].statisticOptions;
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, 1, {
    configurable: true,
    get() {
      throw new Error("inherited statistic option must not be read");
    }
  });
  customPrototypeArray(options, prototype, () => {
    setResolvedCheck(state, resolvedResult({ statisticSlug: "diplomacy" }));
    assert.equal(validateVoyageEncounterPendingChecks(state).valid, true);
  });

  const inheritedSourceOptions = ["diplomacy"];
  inheritedSourceOptions.length = 2;
  const inheritedOnly = preparedEncounter({ statisticOptions: inheritedSourceOptions });
  const inheritedOptions = inheritedOnly.pendingChecks[0].statisticOptions;
  const inheritedPrototype = Object.create(Array.prototype);
  Object.defineProperty(inheritedPrototype, 1, {
    configurable: true,
    value: "athletics",
    enumerable: true
  });
  customPrototypeArray(inheritedOptions, inheritedPrototype, () => {
    setResolvedCheck(inheritedOnly, resolvedResult({ statisticSlug: "athletics" }));
    assert.equal(validateVoyageEncounterPendingChecks(inheritedOnly).valid, false);
  });
});

test("reads the resolved result property exactly once", () => {
  const state = preparedEncounter();
  const result = resolvedResult();
  let reads = 0;
  Object.defineProperty(state.pendingChecks[0], "result", {
    configurable: true,
    enumerable: true,
    get() {
      reads += 1;
      return result;
    }
  });
  state.pendingChecks[0].status = "resolved";

  assert.equal(validateVoyageEncounterPendingChecks(state).valid, true);
  assert.equal(reads, 1);
});

test("ignores inherited pending-check entries and supports sparse own arrays", () => {
  const state = preparedEncounter();
  state.pendingChecks.length = 2;
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, 1, {
    configurable: true,
    get() {
      throw new Error("inherited pending check must not be read");
    }
  });

  customPrototypeArray(state.pendingChecks, prototype, () => {
    assert.equal(validateVoyageEncounterPendingChecks(state).valid, true);
  });
});

test("rejects missing and unexpected persisted pending-check fields", () => {
  const missing = preparedEncounter();
  delete missing.pendingChecks[0].status;
  assert.equal(validateVoyageEncounterPendingChecks(missing).valid, false);

  const extra = preparedEncounter();
  Object.defineProperty(extra.pendingChecks[0], "extra", {
    configurable: true,
    enumerable: false,
    value: true
  });
  assert.equal(validateVoyageEncounterPendingChecks(extra).valid, false);
});

test("retains the exact six result field contract in the resolved record", () => {
  const state = preparedEncounter();
  setResolvedCheck(state);
  assert.deepEqual(Object.keys(state.pendingChecks[0].result), RESULT_FIELDS);
});
