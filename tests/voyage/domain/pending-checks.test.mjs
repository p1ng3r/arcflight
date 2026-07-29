import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import {
  applyVoyageEncounterPendingCheckPreparation,
  analyzeVoyageEncounterPendingChecks,
  validateVoyageEncounterPendingChecks
} from "../../../scripts/voyage/domain/pending-checks.js";
import { prepareVoyageEncounterActionExecutionRequests } from "../../../scripts/voyage/domain/resolution-execution-requests.js";

const RESULT_FIELDS = [
  "total",
  "degreeOfSuccess",
  "degreeOfSuccessSlug",
  "statisticSlug",
  "dc",
  "rollMode"
];

function riskBidOption(riskBidId, dcAdjustment) {
  return {
    riskBidId,
    dcAdjustment,
    outcomes: {
      criticalSuccess: [],
      success: [],
      failure: [],
      criticalFailure: []
    }
  };
}

function encounter({ phase = "resolution", secret = false, statisticOptions = ["diplomacy"], riskBidAdjustment = null } = {}) {
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
    stationAssignments: [{
      stationId: "captain",
      operator: { kind: "actor", uuid: "Actor.captain" }
    }],
    selections: { captain: { stationId: "captain", actionId: "check" } },
    committedStationOrder: ["captain"]
  });

  if (riskBidAdjustment !== null) {
    state.availableStations[0].actions[0].approaches = [{
      approachId: "diplomacy",
      statisticSlugOrAbilityId: "diplomacy"
    }];
    state.availableStations[0].actions[0].riskBidOptions = [
      riskBidOption(`bid-${riskBidAdjustment}`, riskBidAdjustment)
    ];
    state.selections.captain = {
      stationId: "captain",
      actionId: "check",
      approachId: "diplomacy",
      statisticSlugOrAbilityId: "diplomacy"
    };
    state.riskBids.captain = {
      stationId: "captain",
      actionId: "check",
      riskBidId: `bid-${riskBidAdjustment}`,
      dcAdjustment: riskBidAdjustment
    };
  }

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

test("pending-check preparation preserves committed station sequence", () => {
  const state = encounter();
  state.availableStations[0].actions[0].resolutionPriority = -100;
  state.availableStations.push({
    stationId: "engineer",
    actions: [{
      actionId: "repair",
      resolutionPriority: 100,
      check: {
        source: { kind: "character", uuid: "Actor.engineer" },
        statisticOptions: ["crafting"],
        dcSource: { kind: "fixed", value: 22 },
        secrecy: "public"
      }
    }]
  });
  state.stationAssignments.push({
    stationId: "engineer",
    operator: { kind: "actor", uuid: "Actor.engineer" }
  });
  state.selections.engineer = { stationId: "engineer", actionId: "repair" };
  state.committedStationOrder = ["engineer", "captain"];

  const result = applyVoyageEncounterPendingCheckPreparation(state, {
    pendingCheckIds: [
      { sequence: 0, pendingCheckId: "pending-engineer" },
      { sequence: 1, pendingCheckId: "pending-captain" }
    ]
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.nextState.pendingChecks.map(
      ({ sequence, stationId }) => ({ sequence, stationId })
    ),
    [
      { sequence: 0, stationId: "engineer" },
      { sequence: 1, stationId: "captain" }
    ]
  );
});

test("pending-check preparation preserves canonical Risk Bid metadata without another check or final DC", () => {
  for (const dcAdjustment of [2, 5, 8]) {
    const source = encounter({ riskBidAdjustment: dcAdjustment });
    const before = structuredClone(source);
    const result = applyVoyageEncounterPendingCheckPreparation(source, {
      pendingCheckIds: [{ sequence: 0, pendingCheckId: `pending-${dcAdjustment}` }]
    });

    assert.equal(result.ok, true);
    assert.equal(result.nextState.pendingChecks.length, 1);
    assert.equal(
      result.nextState.pendingChecks[0].riskBidId,
      `bid-${dcAdjustment}`
    );
    assert.equal(
      result.nextState.pendingChecks[0].dcAdjustment,
      dcAdjustment
    );
    assert.equal(Object.hasOwn(result.nextState.pendingChecks[0], "finalDc"), false);
    assert.equal(Object.hasOwn(result.nextState.pendingChecks[0], "outcomes"), false);
    assert.deepEqual(result.nextState.pendingChecks[0].dcSource, {
      kind: "fixed",
      value: 20
    });
    assert.deepEqual(source, before);
  }

  const base = preparedEncounter();
  assert.equal(base.pendingChecks[0].riskBidId, null);
  assert.equal(base.pendingChecks[0].dcAdjustment, null);
});

test("pending-check validation rejects missing, forged, unexpected, and accessor-backed Risk Bid metadata", () => {
  const missing = preparedEncounter({ riskBidAdjustment: 2 });
  delete missing.pendingChecks[0].dcAdjustment;
  let report = analyzeVoyageEncounterPendingChecks(missing);
  assert.equal(report.pendingChecksValid, false);
  assert.ok(report.errors.some(
    (entry) => entry.code === "missing-pending-check-field"
      && entry.path === "pendingChecks[0].dcAdjustment"
  ));

  const forged = preparedEncounter({ riskBidAdjustment: 2 });
  forged.pendingChecks[0].dcAdjustment = 8;
  report = analyzeVoyageEncounterPendingChecks(forged);
  assert.equal(report.pendingChecksValid, false);
  assert.ok(report.errors.some(
    (entry) => entry.code === "pending-check-request-mismatch"
      && entry.path === "pendingChecks[0].dcAdjustment"
  ));

  const unexpected = preparedEncounter();
  unexpected.pendingChecks[0].riskBidId = "unexpected";
  unexpected.pendingChecks[0].dcAdjustment = 2;
  report = analyzeVoyageEncounterPendingChecks(unexpected);
  assert.equal(report.pendingChecksValid, false);
  assert.ok(report.errors.some(
    (entry) => entry.code === "pending-check-request-mismatch"
      && entry.path === "pendingChecks[0].riskBidId"
  ));

  const accessor = preparedEncounter({ riskBidAdjustment: 2 });
  let reads = 0;
  Object.defineProperty(accessor.pendingChecks[0], "dcAdjustment", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("must not execute");
    }
  });
  report = analyzeVoyageEncounterPendingChecks(accessor);
  assert.equal(report.pendingChecksValid, false);
  assert.equal(reads, 0);
  assert.ok(report.errors.some(
    (entry) => entry.code === "pending-check-data-read-failed"
      && entry.path === "pendingChecks[0].dcAdjustment"
  ));
});

test("execution-request and pending-check Risk Bid metadata remain isolated", () => {
  const prepared = preparedEncounter({ riskBidAdjustment: 5 });
  const before = structuredClone(prepared.pendingChecks);
  const first = prepareVoyageEncounterActionExecutionRequests(prepared);
  const second = prepareVoyageEncounterActionExecutionRequests(prepared);

  first.executionRequests[0].riskBidId = "request-only";
  first.executionRequests[0].dcAdjustment = 8;
  assert.equal(second.executionRequests[0].riskBidId, "bid-5");
  assert.equal(second.executionRequests[0].dcAdjustment, 5);
  assert.deepEqual(prepared.pendingChecks, before);
});

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

test("analyzes an exact isolated pending-check report contract", () => {
  const state = preparedEncounter();
  const report = analyzeVoyageEncounterPendingChecks(state);
  assert.deepEqual(Object.keys(report), [
    "structurallyValid", "pendingChecksValid", "pendingCheckCount", "unresolvedCheckCount",
    "resolvedCheckCount", "pendingChecks", "errors", "warnings"
  ]);
  assert.equal(report.pendingCheckCount, 1);
  assert.equal(report.unresolvedCheckCount, 1);
  assert.equal(report.resolvedCheckCount, 0);
  assert.deepEqual(Object.keys(report.pendingChecks[0]), [
    "pendingCheckIndex", "pendingCheckId", "preparedRevision", "stageId", "roundNumber",
    "sequence", "stationId", "actionId", "resolutionPriority", "riskBidId", "dcAdjustment", "target", "mode",
    "source", "statisticOptions", "dcSource", "secrecy", "metadata", "status", "result"
  ]);
  assert.equal(report.pendingChecks[0].pendingCheckIndex, 0);
  assert.equal(report.pendingChecks[0].status, "pending");
  assert.equal(report.pendingChecks[0].result, null);
});

test("analyzes every resolved degree pair with exact isolated results", () => {
  for (const [degreeOfSuccess, degreeOfSuccessSlug] of [[0, "critical-failure"], [1, "failure"], [2, "success"], [3, "critical-success"]]) {
    const state = preparedEncounter();
    setResolvedCheck(state, resolvedResult({ degreeOfSuccess, degreeOfSuccessSlug }));
    const report = analyzeVoyageEncounterPendingChecks(state);
    assert.equal(report.pendingChecksValid, true, degreeOfSuccessSlug);
    assert.equal(report.pendingCheckCount, 1);
    assert.equal(report.unresolvedCheckCount, 0);
    assert.equal(report.resolvedCheckCount, 1);
    assert.deepEqual(Object.keys(report.pendingChecks[0].result), RESULT_FIELDS);
  }
});

test("isolates normalized records from source state and other reports", () => {
  const state = preparedEncounter();
  setResolvedCheck(state);
  const first = analyzeVoyageEncounterPendingChecks(state);
  const second = analyzeVoyageEncounterPendingChecks(state);
  const record = first.pendingChecks[0];
  assert.equal(record.target, null);
  record.source.changed = true;
  record.statisticOptions.push("athletics");
  record.dcSource.changed = true;
  record.metadata.changed = true;
  record.result.total = 1;
  assert.equal(state.pendingChecks[0].target, null);
  assert.equal(state.pendingChecks[0].source.changed, undefined);
  assert.equal(state.pendingChecks[0].statisticOptions.includes("athletics"), false);
  assert.equal(state.pendingChecks[0].dcSource.changed, undefined);
  assert.equal(state.pendingChecks[0].metadata.changed, undefined);
  assert.equal(state.pendingChecks[0].result.total, 20);
  assert.equal(second.pendingChecks[0].target, null);
  assert.equal(second.pendingChecks[0].source.changed, undefined);
  assert.equal(second.pendingChecks[0].statisticOptions.includes("athletics"), false);
  assert.equal(second.pendingChecks[0].dcSource.changed, undefined);
  assert.equal(second.pendingChecks[0].metadata.changed, undefined);
  assert.equal(second.pendingChecks[0].result.total, 20);
});

test("preserves sparse own pending-check indexes and ignores inherited entries", () => {
  const state = preparedEncounter();
  state.pendingChecks[3] = state.pendingChecks[0];
  delete state.pendingChecks[0];
  const prototype = Object.create(Array.prototype);
  let reads = 0;
  Object.defineProperty(prototype, 1, { configurable: true, get() { reads += 1; return {}; } });
  customPrototypeArray(state.pendingChecks, prototype, () => {
    const report = analyzeVoyageEncounterPendingChecks(state);
    assert.equal(report.pendingChecksValid, true);
    assert.equal(reads, 0);
    assert.equal(report.pendingChecks.length, 1);
    assert.equal(report.pendingChecks[0].pendingCheckIndex, 3);
  });
});

test("returns atomic invalid reports and delegates validation semantics", () => {
  const fixtures = [
    ["missing-pending-check-field", (state) => delete state.pendingChecks[0].status],
    ["unexpected-pending-check-field", (state) => { state.pendingChecks[0].extra = true; }],
    ["duplicate-pending-check-sequence", (state) => { state.pendingChecks.push(structuredClone(state.pendingChecks[0])); }],
    ["pending-check-request-mismatch", (state) => { state.pendingChecks[0].actionId = "other"; }],
    ["invalid-pending-check-result", (state) => setResolvedCheck(state, { total: 20 })]
  ];
  for (const [code, mutate] of fixtures) {
    const state = preparedEncounter();
    mutate(state);
    const report = analyzeVoyageEncounterPendingChecks(state);
    const validation = validateVoyageEncounterPendingChecks(state);
    assert.equal(report.pendingChecksValid, false, code);
    assert.equal(report.pendingCheckCount, 0, code);
    assert.equal(report.unresolvedCheckCount, 0, code);
    assert.equal(report.resolvedCheckCount, 0, code);
    assert.deepEqual(report.pendingChecks, [], code);
    assert.equal(report.errors.some((entry) => entry.code === code), true, code);
    assert.deepEqual(validation, { valid: report.structurallyValid && report.pendingChecksValid, errors: report.errors, warnings: report.warnings });
  }
});

test("analyzes a resolved result getter once and returns an isolated result", () => {
  const state = preparedEncounter();
  const result = resolvedResult();
  let reads = 0;
  Object.defineProperty(state.pendingChecks[0], "result", { configurable: true, enumerable: true, get() { reads += 1; return result; } });
  state.pendingChecks[0].status = "resolved";
  const report = analyzeVoyageEncounterPendingChecks(state);
  assert.equal(reads, 1);
  assert.equal(report.pendingChecksValid, true);
  report.pendingChecks[0].result.total = 1;
  assert.equal(result.total, 20);
});
