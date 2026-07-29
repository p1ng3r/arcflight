import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { applyVoyageEncounterCrewPlanningLock } from "../../../scripts/voyage/domain/crew-planning-lock.js";
import { applyVoyageEncounterResolutionTransition } from "../../../scripts/voyage/domain/resolution-transition.js";
import { prepareVoyageEncounterActionExecutionRequests } from "../../../scripts/voyage/domain/resolution-execution-requests.js";
import { applyVoyageEncounterPendingCheckPreparation } from "../../../scripts/voyage/domain/pending-checks.js";
import { applyVoyageEncounterPendingCheckResult } from "../../../scripts/voyage/domain/resolution-results.js";
import { prepareVoyageEncounterResolutionCompletion } from "../../../scripts/voyage/domain/resolution-completion.js";
import { applyVoyageEncounterConsequencesTransition } from "../../../scripts/voyage/domain/consequences-transition.js";
import { analyzeVoyageEncounterRoundUnitAggregation } from "../../../scripts/voyage/domain/round-unit-aggregation.js";
import {
  analyzeVoyageEncounterRoundResult,
  classifyVoyageEncounterRoundUnits
} from "../../../scripts/voyage/domain/round-result-classification.js";
import {
  VOYAGE_ROUND_RESULTS,
  VOYAGE_ACTION_EXECUTION_MODES as MODES
} from "../../../scripts/voyage/domain/constants.js";

const DEGREES = ["critical-failure", "failure", "success", "critical-success"];
const STATION_IDS = ["captain", "engineer", "navigator", "watchmaster", "veilwarden", "station-5", "station-6", "station-7", "station-8", "station-9"];

function effectRule(effectId, overrides = {}) {
  return {
    effectId,
    intentType: "track-change",
    timing: "consequences",
    visibility: "public",
    target: { kind: "encounter" },
    payload: { marker: effectId },
    ...overrides
  };
}

function checkAction(actionId, degree, includeWarning = false) {
  const branches = Object.fromEntries(DEGREES.map((branch) => [branch, []]));
  branches[degree] = [`${actionId}-effect`];
  const action = {
    actionId,
    check: {
      source: { kind: "character", uuid: `Actor.${actionId}` },
      statisticOptions: ["diplomacy"],
      dcSource: { kind: "fixed", value: 20 },
      secrecy: "public",
      metadata: {}
    },
    outcomeDefinition: {
      effectRules: [effectRule(`${actionId}-effect`)],
      branches
    }
  };
  if (includeWarning) action.outcomeDefinition.effectRules.push(effectRule(`${actionId}-unused`));
  return action;
}

function noRollAction(actionId) {
  return {
    actionId,
    outcomeDefinition: {
      effectRules: [effectRule(`${actionId}-effect`)],
      branches: { "no-roll": [`${actionId}-effect`] }
    }
  };
}

function makeState(stations, phase = "crew-planning") {
  const selections = {};
  for (const station of stations) {
    const [action] = station.actions;
    action.approaches = Object.hasOwn(action, "check")
      ? [{ approachId: `approach-${action.actionId}`, statisticSlugOrAbilityId: "diplomacy" }]
      : [{ approachId: `approach-${action.actionId}`, noRoll: true }];
    selections[station.stationId] = {
      stationId: station.stationId,
      actionId: action.actionId,
      approachId: `approach-${action.actionId}`,
      ...(Object.hasOwn(action, "check") ? { statisticSlugOrAbilityId: "diplomacy" } : { noRoll: true })
    };
  }
  const state = createVoyageEncounterState({ encounterId: "encounter", definitionId: "definition", primaryShip: { id: "ship" } });
  state.lifecycleState = "active";
  state.currentStage = { stageId: "stage" };
  state.roundNumber = 1;
  state.phase = phase;
  state.availableStations = stations;
  state.stationAssignments = Object.keys(selections).map((stationId) => ({ stationId, operator: { kind: "actor", uuid: `Actor.${stationId}` } }));
  state.selections = selections;
  state.riskBids = {};
  state.proposedStationOrder = phase === "crew-planning" ? stations.map(({ stationId }) => stationId) : [];
  state.committedStationOrder = phase === "crew-planning" ? [] : stations.map(({ stationId }) => stationId);
  return state;
}

function executionResult(request, pending, degree) {
  return {
    ok: true,
    status: "rolled",
    pendingCheckId: pending.pendingCheckId,
    sequence: request.sequence,
    sourceKind: "character",
    sourceUuid: pending.source.uuid,
    statisticSlug: pending.statisticSlugOrAbilityId,
    dc: pending.finalDc,
    rollMode: "public",
    result: { total: pending.finalDc, degreeOfSuccess: DEGREES.indexOf(degree), degreeOfSuccessSlug: degree },
    errors: [],
    warnings: []
  };
}

function completeRound(stations, degrees, phase = "crew-planning") {
  const source = makeState(stations, phase);
  const locked = applyVoyageEncounterCrewPlanningLock(source, { phaseStartSnapshotId: "classification-lock" });
  assert.equal(locked.ok, true);
  const resolution = applyVoyageEncounterResolutionTransition(locked.nextState, { phaseStartSnapshotId: "classification-resolution" });
  assert.equal(resolution.ok, true);
  const execution = prepareVoyageEncounterActionExecutionRequests(resolution.nextState);
  assert.equal(execution.readyForExecution, true);
  let state = resolution.nextState;
  const checks = execution.executionRequests.filter(({ mode }) => mode === MODES.CHECK);
  if (checks.length > 0) {
    const prepared = applyVoyageEncounterPendingCheckPreparation(state, { pendingCheckIds: checks.map(({ sequence }) => ({ sequence, pendingCheckId: `pending-${sequence}` })) });
    assert.equal(prepared.ok, true);
    state = prepared.nextState;
    for (const request of checks) {
      const pending = state.pendingChecks.find(({ sequence }) => sequence === request.sequence);
      const applied = applyVoyageEncounterPendingCheckResult(state, executionResult(request, pending, degrees[request.sequence]));
      assert.equal(applied.ok, true);
      state = applied.nextState;
    }
  }
  const completion = prepareVoyageEncounterResolutionCompletion(state);
  assert.equal(completion.readyForConsequences, true);
  const consequences = applyVoyageEncounterConsequencesTransition(state, { phaseStartSnapshotId: "classification-consequences" });
  assert.equal(consequences.ok, true);
  return consequences.nextState;
}

function degreesForUnits(successUnits, failureUnits) {
  const degrees = [];
  while (successUnits >= 2) {
    degrees.push("critical-success");
    successUnits -= 2;
  }
  if (successUnits === 1) degrees.push("success");
  while (failureUnits >= 2) {
    degrees.push("critical-failure");
    failureUnits -= 2;
  }
  if (failureUnits === 1) degrees.push("failure");
  return degrees;
}

function stateForUnits(successUnits, failureUnits) {
  const degrees = degreesForUnits(successUnits, failureUnits);
  const stations = degrees.map((degree, index) => ({ stationId: STATION_IDS[index], actions: [checkAction(`action-${index}`, degree)] }));
  return { state: completeRound(stations, degrees), degrees };
}

function assertReportContract(report) {
  for (const key of [
    "aggregationReady",
    "readyForRoundResult",
    "successUnits",
    "failureUnits",
    "roundResult",
    "roundResultSide",
    "eventVictoryRoundWeight",
    "classificationSource",
    "requiresAuthoredFallback",
    "usedAuthoredFallback",
    "errors",
    "warnings"
  ]) assert.equal(Object.hasOwn(report, key), true, key);
}

function referenceResult(successUnits, failureUnits) {
  if (successUnits === 0 && failureUnits === 0) return null;
  if (Math.floor(successUnits / 2) >= failureUnits) return VOYAGE_ROUND_RESULTS.CRITICAL_SUCCESS;
  if (successUnits >= failureUnits) return VOYAGE_ROUND_RESULTS.SUCCESS;
  if (Math.floor(failureUnits / 2) >= successUnits) return VOYAGE_ROUND_RESULTS.CRITICAL_FAILURE;
  return VOYAGE_ROUND_RESULTS.FAILURE;
}

test("canonical round-result identifiers are exact and immutable", () => {
  assert.deepEqual(VOYAGE_ROUND_RESULTS, {
    CRITICAL_SUCCESS: "critical-round-success",
    SUCCESS: "round-success",
    FAILURE: "round-failure",
    CRITICAL_FAILURE: "critical-round-failure"
  });
  assert.deepEqual(Object.keys(VOYAGE_ROUND_RESULTS).sort(), ["CRITICAL_FAILURE", "CRITICAL_SUCCESS", "FAILURE", "SUCCESS"]);
  assert.equal(Object.isFrozen(VOYAGE_ROUND_RESULTS), true);
  assert.equal(Object.hasOwn(VOYAGE_ROUND_RESULTS, "ZERO_CONTRIBUTION"), false);
});

const classificationCases = [
  ["Critical Round Success", [[1, 0], [2, 0], [2, 1], [4, 2]], VOYAGE_ROUND_RESULTS.CRITICAL_SUCCESS],
  ["Round Success", [[1, 1], [2, 2], [3, 2], [4, 3]], VOYAGE_ROUND_RESULTS.SUCCESS],
  ["Critical Round Failure", [[0, 1], [0, 2], [1, 2], [2, 4]], VOYAGE_ROUND_RESULTS.CRITICAL_FAILURE],
  ["Round Failure", [[2, 3], [3, 4], [4, 5]], VOYAGE_ROUND_RESULTS.FAILURE]
];

for (const [label, cases, expected] of classificationCases) {
  test(`${label} uses the canonical integer-safe ladder`, () => {
    for (const [successUnits, failureUnits] of cases) {
      const { state } = stateForUnits(successUnits, failureUnits);
      const report = analyzeVoyageEncounterRoundResult(state);
      assert.equal(report.aggregationReady, true, `${successUnits}/${failureUnits}`);
      assert.equal(report.readyForRoundResult, true, `${successUnits}/${failureUnits}`);
      assert.equal(report.successUnits, successUnits, `${successUnits}/${failureUnits}`);
      assert.equal(report.failureUnits, failureUnits, `${successUnits}/${failureUnits}`);
      assert.equal(report.roundResult, expected, `${successUnits}/${failureUnits}`);
      assert.equal(report.roundResultSide, expected.includes("success") ? "success" : "failure", `${successUnits}/${failureUnits}`);
      assert.equal(report.eventVictoryRoundWeight, 1, `${successUnits}/${failureUnits}`);
      assert.equal(report.classificationSource, "unit-ladder", `${successUnits}/${failureUnits}`);
      assert.equal(report.requiresAuthoredFallback, false, `${successUnits}/${failureUnits}`);
      assert.equal(report.usedAuthoredFallback, false, `${successUnits}/${failureUnits}`);
      assertReportContract(report);
    }
  });
}

test("every bounded nonzero unit pair has exactly one canonical result", () => {
  for (let successUnits = 0; successUnits <= 10; successUnits += 1) {
    for (let failureUnits = 0; failureUnits <= 10; failureUnits += 1) {
      if (successUnits === 0 && failureUnits === 0) continue;
      const expected = referenceResult(successUnits, failureUnits);
      assert.equal(classifyVoyageEncounterRoundUnits(successUnits, failureUnits), expected, `${successUnits}/${failureUnits}`);
    }
  }
});

test("zero contribution remains unclassified and requires authored fallback", () => {
  const action = noRollAction("zero-contribution");
  const state = completeRound([{ stationId: "captain", actions: [action] }], [undefined]);
  const report = analyzeVoyageEncounterRoundResult(state);
  assert.equal(report.aggregationReady, true);
  assert.equal(report.readyForRoundResult, false);
  assert.equal(report.successUnits, 0);
  assert.equal(report.failureUnits, 0);
  assert.equal(report.roundResult, null);
  assert.equal(report.roundResultSide, null);
  assert.equal(report.eventVictoryRoundWeight, 0);
  assert.equal(report.classificationSource, null);
  assert.equal(report.requiresAuthoredFallback, true);
  assert.equal(report.usedAuthoredFallback, false);
  assertReportContract(report);
  assert.notEqual(report.roundResult, VOYAGE_ROUND_RESULTS.CRITICAL_SUCCESS);
  assert.notEqual(report.roundResult, VOYAGE_ROUND_RESULTS.CRITICAL_FAILURE);
});

test("valid authored fallbacks classify a real no-roll-only round", () => {
  for (const roundResult of Object.values(VOYAGE_ROUND_RESULTS)) {
    const state = completeRound([{ stationId: "captain", actions: [noRollAction(`fallback-${roundResult}`)] }], [undefined]);
    const snapshot = structuredClone(state);
    state.currentStage.zeroContributionRoundResult = roundResult;
    const report = analyzeVoyageEncounterRoundResult(state);
    assert.equal(report.aggregationReady, true, roundResult);
    assert.equal(report.readyForRoundResult, true, roundResult);
    assert.equal(report.successUnits, 0, roundResult);
    assert.equal(report.failureUnits, 0, roundResult);
    assert.equal(report.roundResult, roundResult, roundResult);
    assert.equal(report.roundResultSide, roundResult.includes("success") ? "success" : "failure", roundResult);
    assert.equal(report.eventVictoryRoundWeight, 1, roundResult);
    assert.equal(report.classificationSource, "authored-zero-contribution-fallback", roundResult);
    assert.equal(report.requiresAuthoredFallback, false, roundResult);
    assert.equal(report.usedAuthoredFallback, true, roundResult);
    assert.deepEqual(state, { ...snapshot, currentStage: { ...snapshot.currentStage, zeroContributionRoundResult: roundResult } }, roundResult);
  }
});

test("null and explicit undefined fallbacks remain unresolved", () => {
  for (const value of [null, undefined]) {
    const state = completeRound([{ stationId: "captain", actions: [noRollAction(`unresolved-${String(value)}`)] }], [undefined]);
    state.currentStage.zeroContributionRoundResult = value;
    const report = analyzeVoyageEncounterRoundResult(state);
    assert.equal(report.aggregationReady, true);
    assert.equal(report.readyForRoundResult, false);
    assert.equal(report.roundResult, null);
    assert.equal(report.roundResultSide, null);
    assert.equal(report.eventVictoryRoundWeight, 0);
    assert.equal(report.classificationSource, null);
    assert.equal(report.requiresAuthoredFallback, true);
    assert.equal(report.usedAuthoredFallback, false);
    assert.equal(report.errors.length, 0);
  }
});

test("malformed authored fallbacks fail closed with classifier-owned diagnostics", () => {
  const malformedValues = [
    "unknown-round-result",
    " round-success",
    1,
    true,
    Symbol("round-result"),
    {},
    []
  ];
  for (const value of malformedValues) {
    const state = completeRound([{ stationId: "captain", actions: [noRollAction("malformed")] }], [undefined]);
    state.currentStage.zeroContributionRoundResult = value;
    const report = analyzeVoyageEncounterRoundResult(state);
    assert.equal(report.aggregationReady, true, String(value));
    assert.equal(report.readyForRoundResult, false, String(value));
    assert.equal(report.roundResult, null, String(value));
    assert.equal(report.roundResultSide, null, String(value));
    assert.equal(report.eventVictoryRoundWeight, 0, String(value));
    assert.equal(report.classificationSource, null, String(value));
    assert.equal(report.requiresAuthoredFallback, true, String(value));
    assert.equal(report.usedAuthoredFallback, false, String(value));
    assert.ok(report.errors.some(({ code }) => code === "round-result-classification-fallback-invalid"), String(value));
  }

  const inherited = completeRound([{ stationId: "captain", actions: [noRollAction("inherited")] }], [undefined]);
  inherited.currentStage = new Proxy(inherited.currentStage, {
    has(target, key) {
      if (key === "zeroContributionRoundResult") return true;
      return Reflect.has(target, key);
    }
  });
  const inheritedReport = analyzeVoyageEncounterRoundResult(inherited);
  assert.equal(inheritedReport.aggregationReady, true);
  assert.equal(inheritedReport.readyForRoundResult, false);
  assert.ok(inheritedReport.errors.some(({ code }) => code === "round-result-classification-fallback-invalid"));

  const getter = completeRound([{ stationId: "captain", actions: [noRollAction("getter")] }], [undefined]);
  Object.defineProperty(getter.currentStage, "zeroContributionRoundResult", { enumerable: true, configurable: true, get() { throw new Error("getter"); } });
  const getterReport = analyzeVoyageEncounterRoundResult(getter);
  assert.equal(getterReport.aggregationReady, true);
  assert.equal(getterReport.readyForRoundResult, false);
  assert.ok(getterReport.errors.some(({ code }) => code === "round-result-classification-fallback-invalid"));

  const setter = completeRound([{ stationId: "captain", actions: [noRollAction("setter")] }], [undefined]);
  Object.defineProperty(setter.currentStage, "zeroContributionRoundResult", { enumerable: true, configurable: true, set() {} });
  const setterReport = analyzeVoyageEncounterRoundResult(setter);
  assert.equal(setterReport.aggregationReady, true);
  assert.equal(setterReport.readyForRoundResult, false);
  assert.ok(setterReport.errors.some(({ code }) => code === "round-result-classification-fallback-invalid"));

  const hostile = completeRound([{ stationId: "captain", actions: [noRollAction("hostile-fallback")] }], [undefined]);
  hostile.currentStage.zeroContributionRoundResult = new Proxy({}, { getOwnPropertyDescriptor() { throw new Error("descriptor"); } });
  assert.doesNotThrow(() => analyzeVoyageEncounterRoundResult(hostile));
  const hostileReport = analyzeVoyageEncounterRoundResult(hostile);
  assert.equal(hostileReport.aggregationReady, true);
  assert.equal(hostileReport.readyForRoundResult, false);
  assert.ok(hostileReport.errors.some(({ code }) => code === "round-result-classification-fallback-invalid"));

});

test("nonzero unit classification never reads or accepts the authored fallback", () => {
  const values = [VOYAGE_ROUND_RESULTS.CRITICAL_FAILURE, "invalid-round-result", new Proxy({}, { get() { throw new Error("fallback read"); } })];
  for (const value of values) {
    const state = stateForUnits(2, 1).state;
    let reads = 0;
    Object.defineProperty(state.currentStage, "zeroContributionRoundResult", {
      enumerable: true,
      configurable: true,
      get() {
        reads += 1;
        return value;
      }
    });
    const report = analyzeVoyageEncounterRoundResult(state);
    assert.equal(report.roundResult, VOYAGE_ROUND_RESULTS.CRITICAL_SUCCESS);
    assert.equal(report.roundResultSide, "success");
    assert.equal(report.eventVictoryRoundWeight, 1);
    assert.equal(report.classificationSource, "unit-ladder");
    assert.equal(reads, 0);
  }
});

test("safe integer boundaries remain exact without overflow", () => {
  const max = Number.MAX_SAFE_INTEGER;
  const half = Math.floor(max / 2);
  const cases = [
    [max, 0],
    [0, max],
    [max, max],
    [max, half],
    [half, max],
    [max, half + 1],
    [half + 1, max]
  ];
  for (const [successUnits, failureUnits] of cases) {
    assert.equal(classifyVoyageEncounterRoundUnits(successUnits, failureUnits), referenceResult(successUnits, failureUnits), `${successUnits}/${failureUnits}`);
  }
  for (const [successUnits, failureUnits] of [
    [max + 1, 0],
    [0, max + 1],
    [Number.POSITIVE_INFINITY, 1],
    [1, Number.NEGATIVE_INFINITY],
    [Number.NaN, 1],
    [-1, 1],
    ["1", 1],
    [1, 1n],
    [0, 0]
  ]) assert.equal(classifyVoyageEncounterRoundUnits(successUnits, failureUnits), null, `${String(successUnits)}/${String(failureUnits)}`);
});

test("action outcomes flow through 4A aggregation into round classification", () => {
  const { state } = stateForUnits(2, 1);
  const aggregation = analyzeVoyageEncounterRoundUnitAggregation(state);
  const classification = analyzeVoyageEncounterRoundResult(state);
  assert.equal(aggregation.readyForAggregation, true);
  assert.deepEqual([aggregation.successUnits, aggregation.failureUnits], [2, 1]);
  assert.equal(classification.roundResult, VOYAGE_ROUND_RESULTS.CRITICAL_SUCCESS);
  assert.equal(classification.roundResultSide, "success");
  assert.equal(classification.eventVictoryRoundWeight, 1);
});

test("incomplete upstream aggregation fails atomically and preserves diagnostics", () => {
  const action = checkAction("incomplete", "success");
  const state = makeState([{ stationId: "captain", actions: [action] }], "resolution");
  const upstream = analyzeVoyageEncounterRoundUnitAggregation(state);
  const report = analyzeVoyageEncounterRoundResult(state);
  assert.equal(report.aggregationReady, false);
  assert.equal(report.readyForRoundResult, false);
  assert.equal(report.successUnits, 0);
  assert.equal(report.failureUnits, 0);
  assert.equal(report.roundResult, null);
  assert.equal(report.roundResultSide, null);
  assert.equal(report.eventVictoryRoundWeight, 0);
  assert.equal(report.classificationSource, null);
  assert.equal(report.requiresAuthoredFallback, false);
  assert.equal(report.usedAuthoredFallback, false);
  assert.deepEqual(report.errors, upstream.errors);
  assert.deepEqual(report.warnings, upstream.warnings);
});

test("analysis is deterministic, source-immutable, and diagnostic data is isolated", () => {
  const action = checkAction("warning", "critical-success", true);
  const state = completeRound([{ stationId: "captain", actions: [action] }], ["critical-success"]);
  const snapshot = structuredClone(state);
  const first = analyzeVoyageEncounterRoundResult(state);
  const second = analyzeVoyageEncounterRoundResult(state);
  assert.deepEqual(first, second);
  assert.deepEqual(state, snapshot);
  assert.ok(first.warnings.length > 0);
  first.warnings[0].message = "caller mutation";
  first.errors.push({ code: "caller-mutation", path: "$", message: "caller-mutation", severity: "error" });
  const fresh = analyzeVoyageEncounterRoundResult(state);
  assert.deepEqual(fresh, second);
  assert.notEqual(first.warnings, fresh.warnings);
  assert.notEqual(first.warnings[0], fresh.warnings[0]);
});

test("hostile upstream state cannot escape the classifier", () => {
  const action = checkAction("hostile", "success");
  const state = completeRound([{ stationId: "captain", actions: [action] }], ["success"]);
  Object.defineProperty(state, "availableStations", { enumerable: true, configurable: true, get() { throw new Error("hostile"); } });
  assert.doesNotThrow(() => analyzeVoyageEncounterRoundResult(state));
  const report = analyzeVoyageEncounterRoundResult(state);
  assert.equal(report.aggregationReady, false);
  assert.equal(report.readyForRoundResult, false);
  assert.equal(report.roundResult, null);
  assert.equal(report.requiresAuthoredFallback, false);
  assert.equal(report.successUnits, 0);
  assert.equal(report.failureUnits, 0);
});

test("critical results do not encode two won or lost rounds", () => {
  const success = analyzeVoyageEncounterRoundResult(stateForUnits(2, 1).state);
  const failure = analyzeVoyageEncounterRoundResult(stateForUnits(1, 2).state);
  assert.equal(success.roundResult, VOYAGE_ROUND_RESULTS.CRITICAL_SUCCESS);
  assert.equal(failure.roundResult, VOYAGE_ROUND_RESULTS.CRITICAL_FAILURE);
  assert.equal(success.eventVictoryRoundWeight, 1);
  assert.equal(failure.eventVictoryRoundWeight, 1);
  assert.equal(Object.hasOwn(success, "roundsWon"), false);
  assert.equal(Object.hasOwn(failure, "roundsLost"), false);
});

test("mixed completed station pipeline preserves 4A contributions and classifies metadata", () => {
  const stations = DEGREES.map((degree, index) => ({ stationId: STATION_IDS[index], actions: [checkAction(`mixed-${index}`, degree)] }));
  stations.push({ stationId: STATION_IDS[4], actions: [noRollAction("mixed-no-roll")] });
  const state = completeRound(stations, [...DEGREES, undefined]);
  const before = structuredClone(state);
  const aggregation = analyzeVoyageEncounterRoundUnitAggregation(state);
  const report = analyzeVoyageEncounterRoundResult(state);
  assert.deepEqual(aggregation.contributions, [
    { sequence: 0, stationId: "captain", actionId: "mixed-0", mode: "check", branch: "critical-failure", riskBidId: null, dcAdjustment: null, successUnits: 0, failureUnits: 2 },
    { sequence: 1, stationId: "engineer", actionId: "mixed-1", mode: "check", branch: "failure", riskBidId: null, dcAdjustment: null, successUnits: 0, failureUnits: 1 },
    { sequence: 2, stationId: "navigator", actionId: "mixed-2", mode: "check", branch: "success", riskBidId: null, dcAdjustment: null, successUnits: 1, failureUnits: 0 },
    { sequence: 3, stationId: "watchmaster", actionId: "mixed-3", mode: "check", branch: "critical-success", riskBidId: null, dcAdjustment: null, successUnits: 2, failureUnits: 0 },
    { sequence: 4, stationId: "veilwarden", actionId: "mixed-no-roll", mode: "no-roll", branch: "no-roll", riskBidId: null, dcAdjustment: null, successUnits: 0, failureUnits: 0 }
  ]);
  assert.equal(report.successUnits, 3);
  assert.equal(report.failureUnits, 3);
  assert.equal(report.roundResult, VOYAGE_ROUND_RESULTS.SUCCESS);
  assert.equal(report.roundResultSide, "success");
  assert.equal(report.eventVictoryRoundWeight, 1);
  assert.equal(report.classificationSource, "unit-ladder");
  assert.deepEqual(state, before);
});

test("round-result classifier contains no later-milestone mechanics", () => {
  const source = readFileSync(new URL("../../../scripts/voyage/domain/round-result-classification.js", import.meta.url), "utf8");
  for (const term of ["Momentum", "Pressure", "Hazards", "Void Scars", "rewards", "Misfortunes", "event victory", "closeout", "persistence", "sockets", "UI"]) {
    assert.doesNotMatch(source, new RegExp(`\\b${term}\\b`, "i"), term);
  }
});
