import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createVoyageEncounterState, normalizeVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { validateVoyageEncounterState } from "../../../scripts/voyage/domain/validation.js";
import { applyVoyageEncounterCrewPlanningLock } from "../../../scripts/voyage/domain/crew-planning-lock.js";
import { applyVoyageEncounterResolutionTransition } from "../../../scripts/voyage/domain/resolution-transition.js";
import { prepareVoyageEncounterActionExecutionRequests } from "../../../scripts/voyage/domain/resolution-execution-requests.js";
import { applyVoyageEncounterPendingCheckPreparation } from "../../../scripts/voyage/domain/pending-checks.js";
import { applyVoyageEncounterPendingCheckResult } from "../../../scripts/voyage/domain/resolution-results.js";
import { prepareVoyageEncounterResolutionCompletion } from "../../../scripts/voyage/domain/resolution-completion.js";
import { applyVoyageEncounterConsequencesTransition } from "../../../scripts/voyage/domain/consequences-transition.js";
import { analyzeVoyageEncounterRoundUnitAggregation } from "../../../scripts/voyage/domain/round-unit-aggregation.js";
import { analyzeVoyageEncounterRoundResult } from "../../../scripts/voyage/domain/round-result-classification.js";
import {
  analyzeVoyageEncounterMomentumUpdate,
  applyVoyageEncounterMomentumUpdate
} from "../../../scripts/voyage/domain/momentum.js";
import {
  VOYAGE_ACTION_EXECUTION_MODES as MODES,
  VOYAGE_MOMENTUM_MAX,
  VOYAGE_MOMENTUM_MIN,
  VOYAGE_MOMENTUM_START,
  VOYAGE_ROUND_RESULTS
} from "../../../scripts/voyage/domain/constants.js";

const DEGREES = ["critical-failure", "failure", "success", "critical-success"];
const STATION_IDS = ["captain", "engineer", "navigator", "watchmaster", "veilwarden"];

function effectRule(effectId) {
  return {
    effectId,
    intentType: "track-change",
    timing: "consequences",
    visibility: "public",
    target: { kind: "encounter" },
    payload: { marker: effectId }
  };
}

function checkAction(actionId, degree, warning = false) {
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
    outcomeDefinition: { effectRules: [effectRule(`${actionId}-effect`)], branches }
  };
  if (warning) action.outcomeDefinition.effectRules.push(effectRule(`${actionId}-unused`));
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

function makeState(stations, phase = "crew-planning", momentum = VOYAGE_MOMENTUM_START) {
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
  const state = createVoyageEncounterState({ encounterId: "momentum-encounter", definitionId: "definition", primaryShip: { id: "ship" } });
  state.lifecycleState = "active";
  state.currentStage = { stageId: "stage" };
  state.roundNumber = 1;
  state.phase = phase;
  state.momentum = momentum;
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

function completeRound(stations, degrees, momentum = VOYAGE_MOMENTUM_START, phase = "crew-planning") {
  const source = makeState(stations, phase, momentum);
  const locked = applyVoyageEncounterCrewPlanningLock(source, { phaseStartSnapshotId: "momentum-lock" });
  assert.equal(locked.ok, true);
  const resolution = applyVoyageEncounterResolutionTransition(locked.nextState, { phaseStartSnapshotId: "momentum-resolution" });
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
  const consequences = applyVoyageEncounterConsequencesTransition(state, { phaseStartSnapshotId: "momentum-consequences" });
  assert.equal(consequences.ok, true);
  return consequences.nextState;
}

function oneDegreeState(degree, momentum = VOYAGE_MOMENTUM_START, warning = false) {
  return completeRound([{ stationId: "captain", actions: [checkAction(`action-${degree}`, degree, warning)] }], [degree], momentum);
}

function stateForRoundResult(roundResult, momentum = VOYAGE_MOMENTUM_START) {
  const degrees = {
    [VOYAGE_ROUND_RESULTS.CRITICAL_SUCCESS]: ["critical-success"],
    [VOYAGE_ROUND_RESULTS.SUCCESS]: ["success", "failure"],
    [VOYAGE_ROUND_RESULTS.FAILURE]: ["critical-success", "critical-failure", "failure"],
    [VOYAGE_ROUND_RESULTS.CRITICAL_FAILURE]: ["critical-failure"]
  }[roundResult];
  const stations = degrees.map((degree, index) => ({ stationId: STATION_IDS[index], actions: [checkAction(`result-${roundResult}-${index}`, degree)] }));
  return completeRound(stations, degrees, momentum);
}

function noRollState(momentum = VOYAGE_MOMENTUM_START) {
  return completeRound([{ stationId: "captain", actions: [noRollAction("no-roll")] }], [undefined], momentum);
}

function assertInvalidMomentumValue(value) {
  const state = createVoyageEncounterState({ encounterId: "momentum-invalid" });
  state.momentum = value;
  let report;
  assert.doesNotThrow(() => { report = validateVoyageEncounterState(state); });
  assert.equal(report.valid, false, String(value));
  assert.ok(report.errors.some(({ code }) => code.includes("momentum")), String(value));
}

test("Momentum defaults, normalization, and validation use the dedicated top-level field", () => {
  const created = createVoyageEncounterState({ encounterId: "momentum-default" });
  assert.equal(created.momentum, VOYAGE_MOMENTUM_START);
  assert.equal(Object.hasOwn(created, "momentum"), true);

  const absent = normalizeVoyageEncounterState({ encounterId: "momentum-normalized" });
  assert.equal(absent.momentum, VOYAGE_MOMENTUM_START);
  for (const value of [0, 1, 2, 3]) {
    const source = { encounterId: `momentum-${value}`, momentum: value };
    const normalized = normalizeVoyageEncounterState(source);
    assert.equal(normalized.momentum, value);
    assert.equal(validateVoyageEncounterState(createVoyageEncounterState(source)).valid, true);
  }
  assert.equal(normalizeVoyageEncounterState({ momentum: 3 }).metadata.momentum, undefined);
});

test("Momentum validation rejects every malformed value without mutating state", () => {
  for (const value of [-1, 4, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "1", 1n, true, {}, [], Symbol("momentum"), null, undefined]) {
    assertInvalidMomentumValue(value);
  }

  const inherited = createVoyageEncounterState({ encounterId: "momentum-inherited" });
  const priorPrototype = Object.getPrototypeOf(inherited);
  Object.setPrototypeOf(inherited, { momentum: 2 });
  delete inherited.momentum;
  const inheritedReport = validateVoyageEncounterState(inherited);
  Object.setPrototypeOf(inherited, priorPrototype);
  assert.equal(inheritedReport.valid, false);

  const getter = createVoyageEncounterState({ encounterId: "momentum-getter" });
  let reads = 0;
  Object.defineProperty(getter, "momentum", { enumerable: true, configurable: true, get() { reads += 1; return 2; } });
  const getterReport = validateVoyageEncounterState(getter);
  assert.equal(getterReport.valid, false);
  assert.equal(reads, 0);

  const setter = createVoyageEncounterState({ encounterId: "momentum-setter" });
  Object.defineProperty(setter, "momentum", { enumerable: true, configurable: true, set() {} });
  assert.equal(validateVoyageEncounterState(setter).valid, false);

  const hostile = createVoyageEncounterState({ encounterId: "momentum-hostile" });
  const proxy = new Proxy(hostile, { getOwnPropertyDescriptor(target, key) { if (key === "momentum") throw new Error("hostile descriptor"); return Reflect.getOwnPropertyDescriptor(target, key); } });
  let hostileReport;
  assert.doesNotThrow(() => { hostileReport = validateVoyageEncounterState(proxy); });
  assert.equal(hostileReport.valid, false);
  assert.equal(hostile.momentum, VOYAGE_MOMENTUM_START);
});

const resultMatrix = [
  [VOYAGE_ROUND_RESULTS.CRITICAL_SUCCESS, "success", 1],
  [VOYAGE_ROUND_RESULTS.SUCCESS, "success", 1],
  [VOYAGE_ROUND_RESULTS.FAILURE, "failure", -1],
  [VOYAGE_ROUND_RESULTS.CRITICAL_FAILURE, "failure", -1]
];

test("every Momentum and classified round-result combination uses one step with cap/floor", () => {
  for (const currentMomentum of [0, 1, 2, 3]) {
    for (const [roundResult, side, delta] of resultMatrix) {
      const report = analyzeVoyageEncounterMomentumUpdate(stateForRoundResult(roundResult, currentMomentum));
      assert.equal(report.roundResultReady, true, `${currentMomentum}/${roundResult}`);
      assert.equal(report.readyForMomentumUpdate, true, `${currentMomentum}/${roundResult}`);
      assert.equal(report.currentMomentum, currentMomentum, `${currentMomentum}/${roundResult}`);
      assert.equal(report.momentumDelta, delta, `${currentMomentum}/${roundResult}`);
      assert.equal(report.nextMomentum, Math.min(Math.max(currentMomentum + delta, VOYAGE_MOMENTUM_MIN), VOYAGE_MOMENTUM_MAX), `${currentMomentum}/${roundResult}`);
      assert.equal(report.roundResult, roundResult, `${currentMomentum}/${roundResult}`);
      assert.equal(report.roundResultSide, side, `${currentMomentum}/${roundResult}`);
      assert.equal(report.classificationSource, "unit-ladder", `${currentMomentum}/${roundResult}`);
      assert.equal(report.appliesBeginningWithNextCheck, true, `${currentMomentum}/${roundResult}`);
    }
  }
});

test("real action outcomes flow through 4A, 4B, and Momentum", () => {
  const stations = DEGREES.map((degree, index) => ({ stationId: STATION_IDS[index], actions: [checkAction(`mixed-${index}`, degree)] }));
  stations.push({ stationId: STATION_IDS[4], actions: [noRollAction("mixed-no-roll")] });
  const state = completeRound(stations, [...DEGREES, undefined], 2);
  const before = structuredClone(state);
  const aggregation = analyzeVoyageEncounterRoundUnitAggregation(state);
  const roundResult = analyzeVoyageEncounterRoundResult(state);
  const momentum = analyzeVoyageEncounterMomentumUpdate(state);
  assert.deepEqual([aggregation.successUnits, aggregation.failureUnits], [3, 3]);
  assert.equal(roundResult.roundResult, VOYAGE_ROUND_RESULTS.SUCCESS);
  assert.equal(momentum.roundResult, VOYAGE_ROUND_RESULTS.SUCCESS);
  assert.equal(momentum.roundResultSide, "success");
  assert.equal(momentum.momentumDelta, 1);
  assert.equal(momentum.nextMomentum, 3);
  assert.deepEqual(state, before);
  assert.deepEqual(roundResult, analyzeVoyageEncounterRoundResult(state));
});

test("all authored zero-contribution fallbacks update Momentum by their result side", () => {
  for (const [roundResult, side, delta] of resultMatrix) {
    const state = noRollState(2);
    state.currentStage.zeroContributionRoundResult = roundResult;
    const before = structuredClone(state);
    const report = analyzeVoyageEncounterMomentumUpdate(state);
    assert.equal(report.roundResultReady, true, roundResult);
    assert.equal(report.readyForMomentumUpdate, true, roundResult);
    assert.equal(report.roundResult, roundResult, roundResult);
    assert.equal(report.roundResultSide, side, roundResult);
    assert.equal(report.classificationSource, "authored-zero-contribution-fallback", roundResult);
    assert.equal(report.momentumDelta, delta, roundResult);
    assert.equal(report.nextMomentum, 2 + delta, roundResult);
    assert.equal(report.requiresAuthoredFallback, false, roundResult);
    assert.equal(report.usedAuthoredFallback, true, roundResult);
    assert.deepEqual(state, before, roundResult);
  }
});

test("absent and malformed zero-contribution fallbacks do not update Momentum", () => {
  const absent = analyzeVoyageEncounterMomentumUpdate(noRollState(2));
  assert.equal(absent.roundResultReady, false);
  assert.equal(absent.readyForMomentumUpdate, false);
  assert.equal(absent.currentMomentum, 2);
  assert.equal(absent.momentumDelta, 0);
  assert.equal(absent.nextMomentum, 2);
  assert.equal(absent.roundResult, null);
  assert.equal(absent.roundResultSide, null);
  assert.equal(absent.classificationSource, null);
  assert.equal(absent.appliesBeginningWithNextCheck, false);
  assert.equal(absent.requiresAuthoredFallback, true);

  const malformed = noRollState(2);
  malformed.currentStage.zeroContributionRoundResult = "not-canonical";
  const malformedReport = analyzeVoyageEncounterMomentumUpdate(malformed);
  assert.equal(malformedReport.roundResultReady, false);
  assert.equal(malformedReport.readyForMomentumUpdate, false);
  assert.equal(malformedReport.currentMomentum, 2);
  assert.equal(malformedReport.momentumDelta, 0);
  assert.equal(malformedReport.nextMomentum, 2);
  assert.ok(malformedReport.errors.some(({ code }) => code === "round-result-classification-fallback-invalid"));
});

test("incomplete or invalid 4B analysis prevents Momentum updates", () => {
  const incomplete = makeState([{ stationId: "captain", actions: [checkAction("incomplete", "success")] }], "resolution", 2);
  const report = analyzeVoyageEncounterMomentumUpdate(incomplete);
  assert.equal(report.roundResultReady, false);
  assert.equal(report.readyForMomentumUpdate, false);
  assert.equal(report.currentMomentum, 2);
  assert.equal(report.nextMomentum, 2);
  assert.equal(report.momentumDelta, 0);
  assert.equal(report.roundResult, null);
  assert.equal(report.roundResultSide, null);
  assert.equal(report.appliesBeginningWithNextCheck, false);
  assert.ok(report.errors.length > 0);

  const malformedMomentum = oneDegreeState("success", 2);
  malformedMomentum.momentum = 9;
  const malformedMomentumReport = analyzeVoyageEncounterMomentumUpdate(malformedMomentum);
  assert.equal(malformedMomentumReport.roundResultReady, false);
  assert.equal(malformedMomentumReport.readyForMomentumUpdate, false);
  assert.equal(malformedMomentumReport.currentMomentum, 0);
  assert.equal(malformedMomentumReport.nextMomentum, 0);
  assert.equal(malformedMomentumReport.momentumDelta, 0);
  assert.equal(malformedMomentumReport.roundResult, null);
  assert.equal(malformedMomentumReport.roundResultSide, null);
  assert.equal(malformedMomentumReport.classificationSource, null);
  assert.equal(malformedMomentumReport.requiresAuthoredFallback, false);
  assert.equal(malformedMomentumReport.usedAuthoredFallback, false);
  assert.equal(malformedMomentumReport.appliesBeginningWithNextCheck, false);
  assert.ok(malformedMomentumReport.errors.some(({ code }) => code === "invalid-momentum"));
  assert.ok(malformedMomentumReport.errors.some(({ code }) => code === "momentum-invalid-state-value"));
});

test("diagnostics, determinism, source immutability, and hostile state handling remain isolated", () => {
  const state = oneDegreeState("critical-success", 1, true);
  const snapshot = structuredClone(state);
  const first = analyzeVoyageEncounterMomentumUpdate(state);
  const second = analyzeVoyageEncounterMomentumUpdate(state);
  assert.deepEqual(first, second);
  assert.ok(first.warnings.length > 0);
  first.warnings[0].message = "caller mutation";
  first.warnings.push({ code: "caller", path: "$", message: "caller", severity: "warning" });
  const fresh = analyzeVoyageEncounterMomentumUpdate(state);
  assert.deepEqual(fresh, second);
  assert.notEqual(first.warnings, fresh.warnings);
  assert.notEqual(first.warnings[0], fresh.warnings[0]);
  assert.deepEqual(state, snapshot);

  const hostile = oneDegreeState("success", 1);
  Object.defineProperty(hostile, "momentum", { enumerable: true, configurable: true, get() { throw new Error("hostile momentum"); } });
  let hostileReport;
  assert.doesNotThrow(() => { hostileReport = analyzeVoyageEncounterMomentumUpdate(hostile); });
  assert.equal(hostileReport.currentMomentum, 0);
  assert.equal(hostileReport.nextMomentum, 0);
  assert.equal(hostileReport.readyForMomentumUpdate, false);
  assert.ok(hostileReport.errors.some(({ code }) => code === "momentum-invalid-state-value"));
});

test("Momentum source boundary calls only the 4B analyzer once and excludes later pipelines", () => {
  const source = readFileSync(new URL("../../../scripts/voyage/domain/momentum.js", import.meta.url), "utf8");
  assert.equal((source.match(/analyzeVoyageEncounterRoundResult\(/g) ?? []).length, 1);
  for (const term of ["round-unit-aggregation", "action-outcome-interpretation", "pending-check", "Risk Bid", "Pressure", "Hazard", "Void Scar", "reward", "Misfortune", "event victory", "closeout", "socket", "game.arcflight", "CONFIG"]) {
    assert.doesNotMatch(source, new RegExp(term.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"), term);
  }
});
test("Momentum application atomically updates state, revision, and exact event", () => {
  const source = stateForRoundResult(VOYAGE_ROUND_RESULTS.SUCCESS, 2);
  const before = structuredClone(source);
  const result = applyVoyageEncounterMomentumUpdate(source);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.nextState.momentum, 3);
  assert.equal(result.nextState.revision, source.revision + 1);
  assert.deepEqual(result.events, [{
    type: "voyage.momentum-updated",
    encounterId: source.encounterId,
    lifecycleState: source.lifecycleState,
    roundNumber: source.roundNumber,
    phase: source.phase,
    roundResult: VOYAGE_ROUND_RESULTS.SUCCESS,
    roundResultSide: "success",
    classificationSource: "unit-ladder",
    usedAuthoredFallback: false,
    previousMomentum: 2,
    momentumDelta: 1,
    momentum: 3,
    appliesBeginningWithNextCheck: true,
    previousRevision: source.revision,
    revision: source.revision + 1
  }]);
  assert.deepEqual(source, before);
  assert.notEqual(result.nextState, source);
});

test("Momentum application preserves one-step delta at every cap and floor", () => {
  for (const currentMomentum of [0, 1, 2, 3]) {
    for (const [roundResult, side, delta] of resultMatrix) {
      const source = stateForRoundResult(roundResult, currentMomentum);
      const result = applyVoyageEncounterMomentumUpdate(source);
      const expectedMomentum = Math.min(
        Math.max(currentMomentum + delta, VOYAGE_MOMENTUM_MIN),
        VOYAGE_MOMENTUM_MAX
      );

      assert.equal(result.ok, true, `${currentMomentum}/${roundResult}`);
      assert.equal(result.nextState.momentum, expectedMomentum, `${currentMomentum}/${roundResult}`);
      assert.equal(result.nextState.revision, source.revision + 1, `${currentMomentum}/${roundResult}`);
      assert.equal(result.events.length, 1, `${currentMomentum}/${roundResult}`);
      assert.equal(result.events[0].roundResult, roundResult, `${currentMomentum}/${roundResult}`);
      assert.equal(result.events[0].roundResultSide, side, `${currentMomentum}/${roundResult}`);
      assert.equal(result.events[0].previousMomentum, currentMomentum, `${currentMomentum}/${roundResult}`);
      assert.equal(result.events[0].momentumDelta, delta, `${currentMomentum}/${roundResult}`);
      assert.equal(result.events[0].momentum, expectedMomentum, `${currentMomentum}/${roundResult}`);
      assert.equal(result.events[0].appliesBeginningWithNextCheck, true, `${currentMomentum}/${roundResult}`);
    }
  }
});

test("authored zero-contribution fallback applies atomically through 4B", () => {
  const source = noRollState(2);
  source.currentStage.zeroContributionRoundResult = VOYAGE_ROUND_RESULTS.CRITICAL_FAILURE;
  const before = structuredClone(source);
  const result = applyVoyageEncounterMomentumUpdate(source);

  assert.equal(result.ok, true);
  assert.equal(result.nextState.momentum, 1);
  assert.equal(result.events[0].roundResult, VOYAGE_ROUND_RESULTS.CRITICAL_FAILURE);
  assert.equal(result.events[0].roundResultSide, "failure");
  assert.equal(result.events[0].classificationSource, "authored-zero-contribution-fallback");
  assert.equal(result.events[0].usedAuthoredFallback, true);
  assert.equal(result.events[0].momentumDelta, -1);
  assert.deepEqual(source, before);
});

test("unresolved, incomplete, and malformed Momentum updates fail atomically", () => {
  const unresolved = noRollState(2);
  const unresolvedBefore = structuredClone(unresolved);
  const unresolvedResult = applyVoyageEncounterMomentumUpdate(unresolved);
  assert.equal(unresolvedResult.ok, false);
  assert.equal(unresolvedResult.nextState, null);
  assert.deepEqual(unresolvedResult.events, []);
  assert.ok(unresolvedResult.errors.some(({ code }) => code === "momentum-update-not-ready"));
  assert.deepEqual(unresolved, unresolvedBefore);

  const incomplete = makeState(
    [{ stationId: "captain", actions: [checkAction("application-incomplete", "success")] }],
    "resolution",
    2
  );
  const incompleteBefore = structuredClone(incomplete);
  const incompleteResult = applyVoyageEncounterMomentumUpdate(incomplete);
  assert.equal(incompleteResult.ok, false);
  assert.equal(incompleteResult.nextState, null);
  assert.deepEqual(incompleteResult.events, []);
  assert.ok(incompleteResult.errors.some(({ code }) => code === "momentum-update-not-ready"));
  assert.deepEqual(incomplete, incompleteBefore);

  const malformed = oneDegreeState("success", 2);
  malformed.momentum = 9;
  const malformedBefore = structuredClone(malformed);
  const malformedResult = applyVoyageEncounterMomentumUpdate(malformed);
  assert.equal(malformedResult.ok, false);
  assert.equal(malformedResult.nextState, null);
  assert.deepEqual(malformedResult.events, []);
  assert.ok(malformedResult.errors.some(({ code }) => code === "invalid-momentum"));
  assert.ok(malformedResult.errors.some(({ code }) => code === "momentum-invalid-state-value"));
  assert.ok(malformedResult.errors.some(({ code }) => code === "momentum-update-not-ready"));
  assert.deepEqual(malformed, malformedBefore);
});

test("Momentum application outputs are isolated and deterministic", () => {
  const source = stateForRoundResult(VOYAGE_ROUND_RESULTS.CRITICAL_SUCCESS, 1);
  const snapshot = structuredClone(source);
  const first = applyVoyageEncounterMomentumUpdate(source);
  const second = applyVoyageEncounterMomentumUpdate(source);

  assert.deepEqual(first, second);
  first.nextState.metadata.callerMutation = true;
  first.events[0].momentum = -100;
  first.events.push({ type: "caller" });
  first.warnings.push({ code: "caller", path: "$", message: "caller", severity: "warning" });

  const fresh = applyVoyageEncounterMomentumUpdate(source);
  assert.deepEqual(fresh, second);
  assert.deepEqual(source, snapshot);
  assert.notEqual(first.nextState, fresh.nextState);
  assert.notEqual(first.events, fresh.events);
  assert.notEqual(first.warnings, fresh.warnings);
});

test("Momentum application source boundary remains pure-domain and Task 02 limited", () => {
  const source = readFileSync(new URL("../../../scripts/voyage/domain/momentum.js", import.meta.url), "utf8");
  assert.equal((source.match(/applyVoyageEncounterMomentumUpdate\(state\)/g) ?? []).length, 1);
  assert.equal((source.match(/analyzeVoyageEncounterMomentumUpdate\(state\)/g) ?? []).length, 2);
  for (const term of [
    "game.arcflight", "socket", "CONFIG", "fromUuid", "Statistic.roll",
    "closeout", "event victory", "reward", "Pressure", "Hazard",
    "Void Scar", "Focus restoration"
  ]) {
    assert.doesNotMatch(source, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), term);
  }
});
