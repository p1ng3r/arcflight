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

function encounter({
  phase = "resolution",
  secret = false,
  statisticOptions = ["diplomacy"],
  riskBidAdjustment = null,
  actionDcAdjustment = 0,
  upgradeDcReduction = 0
} = {}) {
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
        approaches: [{
          approachId: "diplomacy",
          statisticSlugOrAbilityId: "diplomacy"
        }],
        check: {
          source: { kind: "character", uuid: "Actor.captain" },
          statisticOptions,
          dcSource: { kind: "fixed", value: 20 },
          actionDcAdjustment,
          upgradeDcReduction,
          secrecy: secret ? "secret" : "public"
        }
      }]
    }],
    stationAssignments: [{
      stationId: "captain",
      operator: { kind: "actor", uuid: "Actor.captain" }
    }],
    selections: {
      captain: {
        stationId: "captain",
        actionId: "check",
        approachId: "diplomacy",
        statisticSlugOrAbilityId: "diplomacy"
      }
    },
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
      approaches: [{
        approachId: "crafting",
        statisticSlugOrAbilityId: "crafting"
      }],
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
  state.selections.engineer = {
    stationId: "engineer",
    actionId: "repair",
    approachId: "crafting",
    statisticSlugOrAbilityId: "crafting"
  };
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

test("pending-check preparation persists canonical identity and final DC once", () => {
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
      Object.hasOwn(result.nextState.pendingChecks[0], "statisticOptions"),
      false
    );
    assert.equal(
      Object.hasOwn(result.nextState.pendingChecks[0], "dcSource"),
      false
    );
    assert.equal(
      result.nextState.pendingChecks[0].approachId,
      "diplomacy"
    );
    assert.equal(
      result.nextState.pendingChecks[0].statisticSlugOrAbilityId,
      "diplomacy"
    );
    assert.equal(
      result.nextState.pendingChecks[0].dcAdjustment,
      dcAdjustment
    );
    for (const field of [
      "baseDc",
      "actionDcAdjustment",
      "upgradeDcReduction",
      "riskBidDcAdjustment"
    ]) {
      assert.equal(
        Object.hasOwn(result.nextState.pendingChecks[0], field),
        false,
        field
      );
    }
    assert.equal(Object.hasOwn(result.nextState.pendingChecks[0], "outcomes"), false);
    assert.equal(result.nextState.pendingChecks[0].finalDc, 20 + dcAdjustment);
    assert.deepEqual(source, before);
  }

  const base = preparedEncounter();
  assert.equal(base.pendingChecks[0].riskBidId, null);
  assert.equal(base.pendingChecks[0].dcAdjustment, null);
});

test("pending-check preparation locks Momentum separately from final DC", () => {
  const source = encounter({ riskBidAdjustment: 5 });
  source.momentum = 2;
  const result = applyVoyageEncounterPendingCheckPreparation(source, {
    pendingCheckIds: [{ sequence: 0, pendingCheckId: "locked-momentum" }]
  });

  assert.equal(result.ok, true);
  assert.equal(result.nextState.pendingChecks[0].momentumRollBonus, 2);
  assert.equal(result.nextState.pendingChecks[0].finalDc, 25);
  assert.equal(result.nextState.pendingChecks[0].momentumRollBonus, source.momentum);

  source.momentum = 3;
  assert.equal(result.nextState.pendingChecks[0].momentumRollBonus, 2);
  assert.equal(result.nextState.pendingChecks[0].finalDc, 25);
});

test("pending-check preparation does not mutate its nested request data", () => {
  const source = encounter({ riskBidAdjustment: 5 });
  source.momentum = 2;
  const preparationRequest = {
    pendingCheckIds: [{
      sequence: 0,
      pendingCheckId: "request-isolated",
      metadata: {
        nested: {
          values: ["unchanged", { flag: true }]
        }
      }
    }],
    metadata: {
      nested: {
        reason: "caller-owned"
      }
    }
  };
  const before = structuredClone(preparationRequest);

  const result = applyVoyageEncounterPendingCheckPreparation(
    source,
    preparationRequest
  );

  assert.equal(result.ok, true);
  assert.deepEqual(preparationRequest, before);
});

test("pending-check validation rejects malformed Momentum lock values", () => {
  for (const value of [null, -1, 1.5, 4, Number.NaN, Number.POSITIVE_INFINITY, "2", true, {}, []]) {
    const state = preparedEncounter();
    state.pendingChecks[0].momentumRollBonus = value;
    const report = analyzeVoyageEncounterPendingChecks(state);
    assert.equal(report.pendingChecksValid, false, String(value));
    assert.ok(report.errors.some((entry) => entry.code === "invalid-pending-check-momentum-roll-bonus"));
  }

  const missing = preparedEncounter();
  delete missing.pendingChecks[0].momentumRollBonus;
  const missingReport = analyzeVoyageEncounterPendingChecks(missing);
  assert.equal(missingReport.pendingChecksValid, false);
  assert.ok(missingReport.errors.some((entry) => entry.code === "missing-pending-check-field" && entry.path.endsWith(".momentumRollBonus")));

  const accessor = preparedEncounter();
  let reads = 0;
  Object.defineProperty(accessor.pendingChecks[0], "momentumRollBonus", {
    enumerable: true,
    configurable: true,
    get() {
      reads += 1;
      throw new Error("hostile Momentum lock");
    }
  });
  const accessorReport = analyzeVoyageEncounterPendingChecks(accessor);
  assert.equal(accessorReport.pendingChecksValid, false);
  assert.equal(reads, 0);
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

test("obsolete pending-check compatibility authorities are rejected", () => {
  const state = preparedEncounter({
    statisticOptions: ["athletics", "diplomacy", "survival"]
  });
  assert.equal(Object.hasOwn(state.pendingChecks[0], "statisticOptions"), false);
  assert.equal(Object.hasOwn(state.pendingChecks[0], "dcSource"), false);

  for (const [field, value] of [
    ["statisticOptions", ["diplomacy"]],
    ["dcSource", { kind: "fixed", value: 20 }]
  ]) {
    const obsolete = structuredClone(state);
    obsolete.pendingChecks[0][field] = value;
    const first = analyzeVoyageEncounterPendingChecks(obsolete);
    const second = analyzeVoyageEncounterPendingChecks(obsolete);
    assert.equal(first.pendingChecksValid, false);
    assert.deepEqual(first.errors, second.errors);
    assert.ok(first.errors.some(
      (entry) => entry.code === "unexpected-pending-check-field"
        && entry.path === `pendingChecks[0].${field}`
    ));
  }
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
    "source", "approachId", "statisticSlugOrAbilityId", "finalDc",
    "momentumRollBonus",
    "secrecy", "metadata", "status", "result"
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
  record.metadata.changed = true;
  record.result.total = 1;
  assert.equal(state.pendingChecks[0].target, null);
  assert.equal(state.pendingChecks[0].source.changed, undefined);
  assert.equal(state.pendingChecks[0].metadata.changed, undefined);
  assert.equal(state.pendingChecks[0].result.total, 20);
  assert.equal(second.pendingChecks[0].target, null);
  assert.equal(second.pendingChecks[0].source.changed, undefined);
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

test("pending-check construction copies final DC without repeating arithmetic", () => {
  const source = encounter({
    actionDcAdjustment: -3,
    upgradeDcReduction: 4,
    riskBidAdjustment: 5,
    statisticOptions: ["athletics", "diplomacy", "survival"]
  });
  const execution = prepareVoyageEncounterActionExecutionRequests(source);
  assert.equal(execution.executionRequests[0].finalDc, 20);

  const request = {
    pendingCheckIds: [{ sequence: 0, pendingCheckId: "canonical-dc" }]
  };
  const first = applyVoyageEncounterPendingCheckPreparation(source, request);
  const second = applyVoyageEncounterPendingCheckPreparation(source, request);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.nextState.pendingChecks, second.nextState.pendingChecks);

  const pending = first.nextState.pendingChecks[0];
  assert.equal(pending.approachId, "diplomacy");
  assert.equal(pending.statisticSlugOrAbilityId, "diplomacy");
  assert.equal(pending.finalDc, 20);
  assert.equal(Object.hasOwn(pending, "statisticOptions"), false);
  assert.equal(Object.hasOwn(pending, "dcSource"), false);
  for (const field of [
    "baseDc",
    "actionDcAdjustment",
    "upgradeDcReduction",
    "riskBidDcAdjustment"
  ]) {
    assert.equal(Object.hasOwn(pending, field), false, field);
  }
});

test("canonical pending identity and final DC are required exact own data", () => {
  for (const [field, value, code] of [
    ["approachId", undefined, "missing-pending-check-field"],
    ["statisticSlugOrAbilityId", undefined, "missing-pending-check-field"],
    ["finalDc", undefined, "missing-pending-check-field"],
    ["approachId", "", "invalid-pending-check-approach-id"],
    ["statisticSlugOrAbilityId", " ", "invalid-pending-check-statistic-id"],
    ["finalDc", "20", "invalid-pending-check-final-dc"],
    ["finalDc", 1.5, "invalid-pending-check-final-dc"],
    ["finalDc", Infinity, "invalid-pending-check-plain-data"],
    ["finalDc", Number.MAX_SAFE_INTEGER + 1, "invalid-pending-check-final-dc"]
  ]) {
    const state = preparedEncounter();
    if (value === undefined) delete state.pendingChecks[0][field];
    else state.pendingChecks[0][field] = value;
    const report = analyzeVoyageEncounterPendingChecks(state);
    assert.equal(report.pendingChecksValid, false, `${field}:${String(value)}`);
    assert.deepEqual(report.pendingChecks, []);
    assert.ok(report.errors.some((entry) => entry.code === code), code);
  }
});

test("canonical pending fields reject accessors without invoking them", () => {
  for (const field of [
    "approachId",
    "statisticSlugOrAbilityId",
    "finalDc"
  ]) {
    const state = preparedEncounter();
    let reads = 0;
    Object.defineProperty(state.pendingChecks[0], field, {
      enumerable: true,
      configurable: true,
      get() {
        reads += 1;
        throw new Error("hostile canonical field");
      }
    });
    const report = analyzeVoyageEncounterPendingChecks(state);
    assert.equal(report.pendingChecksValid, false, field);
    assert.deepEqual(report.pendingChecks, []);
    assert.equal(reads, 0, field);
  }
});

test("canonical pending identities remain isolated across requests and siblings", () => {
  const source = encounter();
  source.availableStations.push({
    stationId: "engineer",
    actions: [{
      actionId: "repair",
      approaches: [{
        approachId: "crafting",
        statisticSlugOrAbilityId: "crafting"
      }],
      check: {
        source: { kind: "character", uuid: "Actor.engineer" },
        statisticOptions: ["crafting"],
        dcSource: { kind: "fixed", value: 22 },
        secrecy: "public"
      }
    }]
  });
  source.stationAssignments.push({
    stationId: "engineer",
    operator: { kind: "actor", uuid: "Actor.engineer" }
  });
  source.selections.engineer = {
    stationId: "engineer",
    actionId: "repair",
    approachId: "crafting",
    statisticSlugOrAbilityId: "crafting"
  };
  source.committedStationOrder = ["captain", "engineer"];
  const requests = prepareVoyageEncounterActionExecutionRequests(source);
  const prepared = applyVoyageEncounterPendingCheckPreparation(source, {
    pendingCheckIds: [
      { sequence: 0, pendingCheckId: "first" },
      { sequence: 1, pendingCheckId: "second" }
    ]
  });
  assert.equal(prepared.ok, true);
  const [first, second] = prepared.nextState.pendingChecks;
  assert.equal(Object.hasOwn(first, "statisticOptions"), false);
  assert.equal(Object.hasOwn(first, "dcSource"), false);
  assert.equal(Object.hasOwn(second, "statisticOptions"), false);
  assert.equal(Object.hasOwn(second, "dcSource"), false);
  assert.equal(Object.hasOwn(requests.executionRequests[0], "statisticOptions"), false);
  assert.equal(Object.hasOwn(requests.executionRequests[0], "dcSource"), false);
  first.source.uuid = "Actor.changed";
  assert.equal(first.statisticSlugOrAbilityId, "diplomacy");
  assert.equal(second.statisticSlugOrAbilityId, "crafting");
  assert.equal(second.finalDc, 22);
  assert.equal(requests.executionRequests[0].source.uuid, "Actor.captain");
});

test("no-roll plans never create synthetic pending checks", () => {
  const source = encounter();
  const action = source.availableStations[0].actions[0];
  delete action.check;
  action.approaches = [{ approachId: "automatic", noRoll: true }];
  source.selections.captain = {
    stationId: "captain",
    actionId: "check",
    approachId: "automatic",
    noRoll: true
  };
  const before = structuredClone(source);
  let result = applyVoyageEncounterPendingCheckPreparation(source, {
    pendingCheckIds: []
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.nextState, null);
  assert.ok(result.errors.some(
    (entry) => entry.code === "pending-check-preparation-not-required"
  ));
  assert.deepEqual(source, before);

  source.selections.captain.finalDc = 20;
  result = applyVoyageEncounterPendingCheckPreparation(source, {
    pendingCheckIds: []
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.nextState, null);
  assert.ok(result.errors.some(
    (entry) => entry.code === "unexpected-execution-approach-selection-field"
  ));
  assert.deepEqual(source.pendingChecks, []);
});
