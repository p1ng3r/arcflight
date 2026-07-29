import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { applyVoyageEncounterCrewPlanningLock } from "../../../scripts/voyage/domain/crew-planning-lock.js";
import { applyVoyageEncounterResolutionTransition } from "../../../scripts/voyage/domain/resolution-transition.js";
import { prepareVoyageEncounterActionExecutionRequests } from "../../../scripts/voyage/domain/resolution-execution-requests.js";
import { applyVoyageEncounterPendingCheckPreparation } from "../../../scripts/voyage/domain/pending-checks.js";
import { applyVoyageEncounterPendingCheckResult } from "../../../scripts/voyage/domain/resolution-results.js";
import { prepareVoyageEncounterResolutionCompletion } from "../../../scripts/voyage/domain/resolution-completion.js";
import { applyVoyageEncounterConsequencesTransition } from "../../../scripts/voyage/domain/consequences-transition.js";
import { analyzeVoyageEncounterActionOutcomes } from "../../../scripts/voyage/domain/action-outcome-interpretation.js";
import {
  VOYAGE_ACTION_BRANCH_UNIT_CONTRIBUTIONS as CONTRIBUTIONS,
  VOYAGE_ACTION_EXECUTION_MODES as MODES
} from "../../../scripts/voyage/domain/constants.js";
import { analyzeVoyageEncounterRoundUnitAggregation } from "../../../scripts/voyage/domain/round-unit-aggregation.js";

const DEGREES = ["critical-failure", "failure", "success", "critical-success"];

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

function controlledEffectRule(effectId, overrides = {}) {
  return effectRule(effectId, {
    intentType: "dc-change",
    target: { kind: "source-station" },
    payload: { delta: 1 },
    ...overrides
  });
}

function checkAction(actionId, branch, effectId = `${actionId}-effect`) {
  const branches = Object.fromEntries(DEGREES.map((degree) => [degree, []]));
  branches[branch] = [effectId];
  return {
    actionId,
    check: { source: { kind: "character", uuid: `Actor.${actionId}` }, statisticOptions: ["diplomacy"], dcSource: { kind: "fixed", value: 20 }, secrecy: "public", metadata: {} },
    outcomeDefinition: { effectRules: [effectRule(effectId)], branches }
  };
}

function noRollAction(actionId, effectId = `${actionId}-effect`) {
  return { actionId, outcomeDefinition: { effectRules: [effectRule(effectId)], branches: { "no-roll": [effectId] } } };
}

function riskBidOption(riskBidId, dcAdjustment, degree, effectId) {
  const outcomes = { criticalSuccess: [], success: [], failure: [], criticalFailure: [] };
  outcomes[{ "critical-success": "criticalSuccess", success: "success", failure: "failure", "critical-failure": "criticalFailure" }[degree]] = [effectId];
  return { riskBidId, dcAdjustment, outcomes };
}

function makeState({ stations, selections, order, phase = "crew-planning", riskBids = {} }) {
  for (const station of stations) {
    for (const action of station.actions) {
      action.approaches = Object.hasOwn(action, "check")
        ? [{ approachId: `approach-${action.actionId}`, statisticSlugOrAbilityId: "diplomacy" }]
        : [{ approachId: `approach-${action.actionId}`, noRoll: true }];
    }
  }
  const state = createVoyageEncounterState({ encounterId: "encounter", definitionId: "definition", primaryShip: { id: "ship" } });
  state.lifecycleState = "active";
  state.currentStage = { stageId: "stage" };
  state.roundNumber = 1;
  state.phase = phase;
  state.availableStations = stations;
  state.stationAssignments = Object.keys(selections).map((stationId) => ({ stationId, operator: { kind: "actor", uuid: `Actor.${stationId}` } }));
  state.selections = selections;
  state.riskBids = structuredClone(riskBids);
  state.proposedStationOrder = phase === "crew-planning" ? [...order] : [];
  state.committedStationOrder = phase === "crew-planning" ? [] : [...order];
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

function completeRound({ stations, selections, order, degrees, riskBids = {} }) {
  const source = makeState({ stations, selections, order, riskBids });
  const before = structuredClone(source);
  const locked = applyVoyageEncounterCrewPlanningLock(source, { phaseStartSnapshotId: "units-lock" });
  assert.equal(locked.ok, true);
  const resolution = applyVoyageEncounterResolutionTransition(locked.nextState, { phaseStartSnapshotId: "units-resolution" });
  assert.equal(resolution.ok, true);
  const execution = prepareVoyageEncounterActionExecutionRequests(resolution.nextState);
  assert.equal(execution.readyForExecution, true);
  let resolved = resolution.nextState;
  const checks = execution.executionRequests.filter(({ mode }) => mode === MODES.CHECK);
  if (checks.length > 0) {
    const prepared = applyVoyageEncounterPendingCheckPreparation(resolved, { pendingCheckIds: checks.map(({ sequence }) => ({ sequence, pendingCheckId: `pending-${sequence}` })) });
    assert.equal(prepared.ok, true);
    resolved = prepared.nextState;
    for (const request of checks) {
      const pending = resolved.pendingChecks.find(({ sequence }) => sequence === request.sequence);
      const applied = applyVoyageEncounterPendingCheckResult(resolved, executionResult(request, pending, degrees[request.sequence]));
      assert.equal(applied.ok, true);
      resolved = applied.nextState;
    }
  }
  const completion = prepareVoyageEncounterResolutionCompletion(resolved);
  assert.equal(completion.readyForConsequences, true);
  const consequences = applyVoyageEncounterConsequencesTransition(resolved, { phaseStartSnapshotId: "units-consequences" });
  assert.equal(consequences.ok, true);
  return { source, before, state: consequences.nextState, report: analyzeVoyageEncounterRoundUnitAggregation(consequences.nextState) };
}

function selectionsFor(stations) {
  return Object.fromEntries(stations.map(({ stationId, actions: [action] }) => [stationId, {
    stationId,
    actionId: action.actionId,
    approachId: `approach-${action.actionId}`,
    ...(Object.hasOwn(action, "check") ? { statisticSlugOrAbilityId: "diplomacy" } : { noRoll: true })
  }]));
}

function assertAtomicFailure(report) {
  assert.equal(report.outcomesReady, false);
  assert.equal(report.readyForAggregation, false);
  assert.equal(report.successUnits, 0);
  assert.equal(report.failureUnits, 0);
  assert.deepEqual(report.contributions, []);
  assert.equal(report.actionCount, 0);
  assert.equal(report.checkActionCount, 0);
  assert.equal(report.noRollActionCount, 0);
  assert.equal(report.contributingActionCount, 0);
  assert.ok(report.errors.length > 0);
}

function completedState(options) {
  return completeRound(options).state;
}

function riskMatrixAction(actionId, degree, riskBidId, tier) {
  const action = checkAction(actionId, degree, `${actionId}-normal-1`);
  const normalSecond = `${actionId}-normal-2`;
  const riskFirst = `${actionId}-risk-1`;
  const riskSecond = `${actionId}-risk-2`;
  action.outcomeDefinition.effectRules.push(effectRule(normalSecond));
  action.outcomeDefinition.effectRules.push(effectRule(riskFirst));
  action.outcomeDefinition.effectRules.push(effectRule(riskSecond, { visibility: "gm-secret" }));
  action.outcomeDefinition.branches[degree] = [`${actionId}-normal-1`, normalSecond];
  const option = riskBidOption(riskBidId, tier, degree, riskFirst);
  const field = { "critical-success": "criticalSuccess", success: "success", failure: "failure", "critical-failure": "criticalFailure" }[degree];
  option.outcomes[field] = [riskFirst, riskSecond];
  action.riskBidOptions = [option];
  return action;
}

function preparedResolution({ stations, selections, order, riskBids = {} }) {
  const source = makeState({ stations, selections, order, riskBids });
  const locked = applyVoyageEncounterCrewPlanningLock(source, { phaseStartSnapshotId: "aggregation-prepared-lock" });
  assert.equal(locked.ok, true);
  const resolution = applyVoyageEncounterResolutionTransition(locked.nextState, { phaseStartSnapshotId: "aggregation-prepared-resolution" });
  assert.equal(resolution.ok, true);
  const execution = prepareVoyageEncounterActionExecutionRequests(resolution.nextState);
  assert.equal(execution.readyForExecution, true);
  const checks = execution.executionRequests.filter(({ mode }) => mode === MODES.CHECK);
  const prepared = checks.length > 0
    ? applyVoyageEncounterPendingCheckPreparation(resolution.nextState, { pendingCheckIds: checks.map(({ sequence }) => ({ sequence, pendingCheckId: `pending-${sequence}` })) })
    : { ok: true, nextState: resolution.nextState };
  assert.equal(prepared.ok, true);
  return { source, execution, state: prepared.nextState };
}

test("canonical branch mapping is exact, immutable, and excludes no-roll", () => {
  assert.deepEqual(CONTRIBUTIONS, {
    "critical-success": { successUnits: 2, failureUnits: 0 },
    success: { successUnits: 1, failureUnits: 0 },
    failure: { successUnits: 0, failureUnits: 1 },
    "critical-failure": { successUnits: 0, failureUnits: 2 }
  });
  assert.deepEqual(Object.keys(CONTRIBUTIONS).sort(), ["critical-failure", "critical-success", "failure", "success"]);
  assert.equal(Object.hasOwn(CONTRIBUTIONS, "no-roll"), false);
  assert.equal(Object.isFrozen(CONTRIBUTIONS), true);
  assert.equal(Object.values(CONTRIBUTIONS).every(Object.isFrozen), true);
});

test("mixed occupied-station aggregation maps each finalized degree once", () => {
  const stations = DEGREES.map((degree, index) => ({ stationId: ["captain", "engineer", "navigator", "watchmaster"][index], actions: [checkAction(`action-${index}`, degree)] }));
  const result = completeRound({ stations, selections: selectionsFor(stations), order: stations.map(({ stationId }) => stationId), degrees: DEGREES });
  assert.equal(result.report.outcomesReady, true);
  assert.equal(result.report.readyForAggregation, true);
  assert.equal(result.report.actionCount, 4);
  assert.equal(result.report.checkActionCount, 4);
  assert.equal(result.report.noRollActionCount, 0);
  assert.equal(result.report.contributingActionCount, 4);
  assert.equal(result.report.successUnits, 3);
  assert.equal(result.report.failureUnits, 3);
  assert.deepEqual(result.report.contributions, [
    { sequence: 0, stationId: "captain", actionId: "action-0", mode: "check", branch: "critical-failure", riskBidId: null, dcAdjustment: null, successUnits: 0, failureUnits: 2 },
    { sequence: 1, stationId: "engineer", actionId: "action-1", mode: "check", branch: "failure", riskBidId: null, dcAdjustment: null, successUnits: 0, failureUnits: 1 },
    { sequence: 2, stationId: "navigator", actionId: "action-2", mode: "check", branch: "success", riskBidId: null, dcAdjustment: null, successUnits: 1, failureUnits: 0 },
    { sequence: 3, stationId: "watchmaster", actionId: "action-3", mode: "check", branch: "critical-success", riskBidId: null, dcAdjustment: null, successUnits: 2, failureUnits: 0 }
  ]);
  assert.deepEqual(result.source, result.before);
});

test("Risk Bid tiers and normal or bid intents produce one degree contribution", () => {
  for (const tier of [2, 5, 8]) {
    const action = checkAction("action", "success");
    const effectId = "bid-effect";
    action.riskBidOptions = [riskBidOption(`bid-${tier}`, tier, "success", effectId)];
    action.outcomeDefinition.effectRules.push(effectRule(effectId));
    const result = completeRound({
      stations: [{ stationId: "captain", actions: [action] }],
      selections: selectionsFor([{ stationId: "captain", actions: [action] }]),
      order: ["captain"],
      degrees: ["success"],
      riskBids: { captain: { stationId: "captain", actionId: "action", riskBidId: `bid-${tier}`, dcAdjustment: tier } }
    });
    assert.equal(result.report.contributions.length, 1);
    assert.deepEqual(result.report.contributions[0], { sequence: 0, stationId: "captain", actionId: "action", mode: "check", branch: "success", riskBidId: `bid-${tier}`, dcAdjustment: tier, successUnits: 1, failureUnits: 0 });
  }
});

test("no-roll and unoccupied stations contribute a visible zero record only for the occupied action", () => {
  const stations = [
    { stationId: "captain", actions: [noRollAction("no-roll")] },
    { stationId: "engineer", actions: [checkAction("check", "success")] }
  ];
  const result = completeRound({ stations, selections: selectionsFor(stations), order: ["engineer", "captain"], degrees: ["success", undefined] });
  assert.equal(result.report.actionCount, 2);
  assert.equal(result.report.checkActionCount, 1);
  assert.equal(result.report.noRollActionCount, 1);
  assert.equal(result.report.contributingActionCount, 1);
  assert.equal(result.report.successUnits, 1);
  assert.equal(result.report.failureUnits, 0);
  assert.deepEqual(result.report.contributions, [
    { sequence: 0, stationId: "engineer", actionId: "check", mode: "check", branch: "success", riskBidId: null, dcAdjustment: null, successUnits: 1, failureUnits: 0 },
    { sequence: 1, stationId: "captain", actionId: "no-roll", mode: "no-roll", branch: "no-roll", riskBidId: null, dcAdjustment: null, successUnits: 0, failureUnits: 0 }
  ]);
});

test("upstream incomplete or hostile state fails atomically", () => {
  const incomplete = makeState({ stations: [{ stationId: "captain", actions: [checkAction("action", "success")] }], selections: { captain: { stationId: "captain", actionId: "action", approachId: "approach-action", statisticSlugOrAbilityId: "diplomacy" } }, order: ["captain"], phase: "resolution" });
  const failed = analyzeVoyageEncounterRoundUnitAggregation(incomplete);
  assert.equal(failed.outcomesReady, false);
  assert.equal(failed.readyForAggregation, false);
  assert.equal(failed.successUnits, 0);
  assert.equal(failed.failureUnits, 0);
  assert.deepEqual(failed.contributions, []);

  const hostile = makeState({ stations: [], selections: {}, order: [], phase: "consequences" });
  Object.defineProperty(hostile, "availableStations", { enumerable: true, configurable: true, get() { throw new Error("hostile"); } });
  const hostileReport = analyzeVoyageEncounterRoundUnitAggregation(hostile);
  assert.equal(hostileReport.readyForAggregation, false);
  assert.deepEqual(hostileReport.contributions, []);
});

test("aggregation is deterministic, isolated, and preserves independent diagnostics", () => {
  const action = checkAction("action", "critical-success");
  action.outcomeDefinition.effectRules.push(effectRule("unused-effect"));
  const stations = [{ stationId: "captain", actions: [action] }];
  const result = completeRound({ stations, selections: selectionsFor(stations), order: ["captain"], degrees: ["critical-success"] });
  const first = result.report;
  const second = analyzeVoyageEncounterRoundUnitAggregation(result.state);
  assert.deepEqual(first, second);
  first.contributions[0].successUnits = 99;
  first.errors.push({ code: "changed", path: "$", message: "changed", severity: "error" });
  const fresh = analyzeVoyageEncounterRoundUnitAggregation(result.state);
  assert.equal(fresh.successUnits, 2);
  assert.equal(fresh.contributions[0].successUnits, 2);
  assert.equal(fresh.errors.some(({ code }) => code === "changed"), false);
  assert.ok(first.warnings.length > 0);
  assert.deepEqual(first.warnings, fresh.warnings);
  assert.deepEqual(result.source, result.before);
  assert.notEqual(first.errors, fresh.errors);
  assert.notEqual(first.warnings, fresh.warnings);
});

test("complete degree and Risk Bid matrix preserves one exact contribution per action", () => {
  const expected = {
    "critical-failure": { successUnits: 0, failureUnits: 2 },
    failure: { successUnits: 0, failureUnits: 1 },
    success: { successUnits: 1, failureUnits: 0 },
    "critical-success": { successUnits: 2, failureUnits: 0 }
  };
  for (const degree of DEGREES) {
    const base = checkAction(`base-${degree}`, degree);
    const baseResult = completeRound({
      stations: [{ stationId: "captain", actions: [base] }],
      selections: selectionsFor([{ stationId: "captain", actions: [base] }]),
      order: ["captain"],
      degrees: [degree]
    });
    assert.deepEqual(baseResult.report.contributions, [{
      sequence: 0, stationId: "captain", actionId: `base-${degree}`, mode: "check", branch: degree,
      riskBidId: null, dcAdjustment: null, ...expected[degree]
    }]);
    for (const tier of [2, 5, 8]) {
      const riskBidId = `bid-${degree}-${tier}`;
      const action = riskMatrixAction(`risk-${degree}-${tier}`, degree, riskBidId, tier);
      const result = completeRound({
        stations: [{ stationId: "captain", actions: [action] }],
        selections: selectionsFor([{ stationId: "captain", actions: [action] }]),
        order: ["captain"],
        degrees: [degree],
        riskBids: { captain: { stationId: "captain", actionId: action.actionId, riskBidId, dcAdjustment: tier } }
      });
      assert.deepEqual(result.report.contributions, [{
        sequence: 0, stationId: "captain", actionId: action.actionId, mode: "check", branch: degree,
        riskBidId, dcAdjustment: tier, ...expected[degree]
      }]);
      assert.equal(result.report.contributions.length, 1);
      assert.equal(result.report.successUnits, expected[degree].successUnits);
      assert.equal(result.report.failureUnits, expected[degree].failureUnits);
      const interpreted = analyzeVoyageEncounterActionOutcomes(result.state);
      assert.equal(interpreted.readyForInterpretation, true);
      assert.ok(interpreted.intents.some(({ activationSource }) => activationSource === "risk-bid"));
      if (degree === "success") assert.ok(interpreted.intents.some(({ activationSource }) => activationSource === "branch"));
    }
  }
});

test("intent cardinality, visibility, controlled contracts, and payloads do not change units", () => {
  const variants = [
    { id: "empty", normal: [], risk: [] },
    { id: "one-normal", normal: ["legacy-1"], risk: [] },
    { id: "many-normal", normal: ["legacy-1", "legacy-2", "controlled-1"], risk: [] },
    { id: "one-risk", normal: [], risk: ["risk-1"] },
    { id: "many-risk", normal: ["risk-1", "risk-2", "controlled-risk"], risk: ["risk-1"] }
  ];
  const reports = [];
  for (const variant of variants) {
    const action = checkAction(`intent-${variant.id}`, "success", variant.normal[0] ?? `fallback-${variant.id}`);
    const rules = new Map(action.outcomeDefinition.effectRules.map((rule) => [rule.effectId, rule]));
    const allIds = [...new Set([...variant.normal, ...variant.risk])];
    for (const [index, effectId] of allIds.entries()) {
      const controlled = effectId.startsWith("controlled");
      const rule = controlled
        ? controlledEffectRule(effectId, { visibility: index % 2 ? "gm-secret" : "public" })
        : effectRule(effectId, { visibility: index % 2 ? "gm-secret" : "public", payload: { marker: `${variant.id}-${index}` } });
      rules.set(effectId, rule);
    }
    action.outcomeDefinition.effectRules = [...rules.values()];
    action.outcomeDefinition.branches.success = variant.normal;
    if (variant.risk.length > 0) {
      const bid = `intent-bid-${variant.id}`;
      const option = riskBidOption(bid, 5, "success", variant.risk[0]);
      option.outcomes.success = variant.risk;
      action.riskBidOptions = [option];
      const result = completeRound({
        stations: [{ stationId: "captain", actions: [action] }],
        selections: selectionsFor([{ stationId: "captain", actions: [action] }]),
        order: ["captain"],
        degrees: ["success"],
        riskBids: { captain: { stationId: "captain", actionId: action.actionId, riskBidId: bid, dcAdjustment: 5 } }
      });
      reports.push(result.report);
    } else {
      reports.push(completeRound({
        stations: [{ stationId: "captain", actions: [action] }],
        selections: selectionsFor([{ stationId: "captain", actions: [action] }]),
        order: ["captain"],
        degrees: ["success"]
      }).report);
    }
  }
  for (const report of reports) {
    assert.equal(report.successUnits, 1);
    assert.equal(report.failureUnits, 0);
    assert.equal(report.contributingActionCount, 1);
    assert.equal(report.contributions.length, 1);
  }
});

test("occupancy matrix emits only occupied actions in committed order", () => {
  const canonical = ["captain", "engineer", "navigator", "watchmaster", "veilwarden"];
  for (let occupied = 1; occupied <= canonical.length; occupied += 1) {
    const selectedStations = canonical.slice(0, occupied).map((stationId, index) => ({
      stationId,
      actions: [checkAction(`occupied-${occupied}-${index}`, "success")]
    }));
    const order = [...selectedStations].reverse().map(({ stationId }) => stationId);
    const result = completeRound({ stations: selectedStations, selections: selectionsFor(selectedStations), order, degrees: order.map(() => "success") });
    assert.equal(result.report.actionCount, occupied);
    assert.equal(result.report.contributions.length, occupied);
    assert.deepEqual(result.report.contributions.map(({ stationId }) => stationId), order);
    assert.equal(result.report.successUnits, occupied);
    assert.equal(result.report.failureUnits, 0);
    assert.equal(result.report.actionCount, result.report.checkActionCount + result.report.noRollActionCount);
  }
});

test("mixed five-station round has exact totals, counts, and committed ordering", () => {
  const captain = checkAction("captain-cs", "critical-success");
  const engineer = riskMatrixAction("engineer-success", "success", "bid-engineer", 2);
  const navigator = riskMatrixAction("navigator-failure", "failure", "bid-navigator", 5);
  const watchmaster = checkAction("watchmaster-cf", "critical-failure");
  const veilwarden = noRollAction("veilwarden-no-roll");
  const stations = [
    { stationId: "captain", actions: [captain] },
    { stationId: "engineer", actions: [engineer] },
    { stationId: "navigator", actions: [navigator] },
    { stationId: "watchmaster", actions: [watchmaster] },
    { stationId: "veilwarden", actions: [veilwarden] }
  ];
  const order = ["navigator", "captain", "veilwarden", "engineer", "watchmaster"];
  const result = completeRound({
    stations,
    selections: selectionsFor(stations),
    order,
    degrees: ["failure", "critical-success", undefined, "success", "critical-failure"],
    riskBids: {
      engineer: { stationId: "engineer", actionId: engineer.actionId, riskBidId: "bid-engineer", dcAdjustment: 2 },
      navigator: { stationId: "navigator", actionId: navigator.actionId, riskBidId: "bid-navigator", dcAdjustment: 5 }
    }
  });
  assert.equal(result.report.successUnits, 3);
  assert.equal(result.report.failureUnits, 3);
  assert.equal(result.report.actionCount, 5);
  assert.equal(result.report.checkActionCount, 4);
  assert.equal(result.report.noRollActionCount, 1);
  assert.equal(result.report.contributingActionCount, 4);
  assert.deepEqual(result.report.contributions, [
    { sequence: 0, stationId: "navigator", actionId: "navigator-failure", mode: "check", branch: "failure", riskBidId: "bid-navigator", dcAdjustment: 5, successUnits: 0, failureUnits: 1 },
    { sequence: 1, stationId: "captain", actionId: "captain-cs", mode: "check", branch: "critical-success", riskBidId: null, dcAdjustment: null, successUnits: 2, failureUnits: 0 },
    { sequence: 2, stationId: "veilwarden", actionId: "veilwarden-no-roll", mode: "no-roll", branch: "no-roll", riskBidId: null, dcAdjustment: null, successUnits: 0, failureUnits: 0 },
    { sequence: 3, stationId: "engineer", actionId: "engineer-success", mode: "check", branch: "success", riskBidId: "bid-engineer", dcAdjustment: 2, successUnits: 1, failureUnits: 0 },
    { sequence: 4, stationId: "watchmaster", actionId: "watchmaster-cf", mode: "check", branch: "critical-failure", riskBidId: null, dcAdjustment: null, successUnits: 0, failureUnits: 2 }
  ]);
  assert.equal(result.report.actionCount, result.report.contributions.length);
  assert.equal(result.report.actionCount, result.report.checkActionCount + result.report.noRollActionCount);
  assert.equal(result.report.contributingActionCount, result.report.contributions.filter(({ successUnits, failureUnits }) => successUnits !== 0 || failureUnits !== 0).length);
  assert.equal(result.report.contributingActionCount, result.report.checkActionCount);
  for (const value of [result.report.actionCount, result.report.checkActionCount, result.report.noRollActionCount, result.report.contributingActionCount, result.report.successUnits, result.report.failureUnits]) {
    assert.equal(Number.isSafeInteger(value), true);
    assert.ok(value >= 0);
  }
});

test("no-roll metadata and branch contracts fail closed without scoring it as success", () => {
  const stations = [{ stationId: "captain", actions: [noRollAction("no-roll-contract")] }];
  const valid = completedState({ stations, selections: selectionsFor(stations), order: ["captain"], degrees: [undefined] });
  const report = analyzeVoyageEncounterRoundUnitAggregation(valid);
  assert.deepEqual(report.contributions, [{ sequence: 0, stationId: "captain", actionId: "no-roll-contract", mode: "no-roll", branch: "no-roll", riskBidId: null, dcAdjustment: null, successUnits: 0, failureUnits: 0 }]);
  assert.equal(report.noRollActionCount, 1);
  assert.equal(report.checkActionCount, 0);
  assert.equal(report.contributingActionCount, 0);
  assert.equal(report.successUnits, 0);
  assert.equal(report.failureUnits, 0);

  const metadata = structuredClone(valid);
  metadata.selections.captain.riskBidId = "bid-no-roll";
  assertAtomicFailure(analyzeVoyageEncounterRoundUnitAggregation(metadata));
  const branch = structuredClone(valid);
  branch.availableStations[0].actions[0].outcomeDefinition.branches.success = [];
  assertAtomicFailure(analyzeVoyageEncounterRoundUnitAggregation(branch));
});

test("reachable upstream failures preserve diagnostics and discard every partial unit", () => {
  const action = checkAction("failure-action", "success");
  const stations = [{ stationId: "captain", actions: [action] }];
  const selections = selectionsFor(stations);
  const valid = completedState({ stations, selections, order: ["captain"], degrees: ["success"] });
  const cases = [
    ["inactive encounter", (state) => { state.lifecycleState = "draft"; }],
    ["incorrect phase", (state) => { state.phase = "resolution"; }],
    ["invalid result degree", (state) => { state.pendingChecks[0].result.degreeOfSuccessSlug = "not-a-degree"; }],
    ["missing pending check", (state) => { state.pendingChecks = []; }],
    ["malformed outcome definition", (state) => { state.availableStations[0].actions[0].outcomeDefinition.branches.success = null; }],
    ["invalid controlled intent payload", (state) => {
      state.availableStations[0].actions[0].outcomeDefinition.effectRules[0] = controlledEffectRule("failure-action-effect", { payload: { delta: Number.NaN } });
    }],
    ["hostile authored consequence data", (state) => {
      Object.defineProperty(state.availableStations[0].actions[0].outcomeDefinition, "effectRules", { enumerable: true, configurable: true, get() { throw new Error("hostile effect rules"); } });
    }],
    ["NaN round number", (state) => { state.roundNumber = Number.NaN; }],
    ["infinite round number", (state) => { state.roundNumber = Number.POSITIVE_INFINITY; }],
    ["unsafe round number", (state) => { state.roundNumber = Number.MAX_SAFE_INTEGER + 1; }]
  ];
  for (const [label, mutate] of cases) {
    const state = structuredClone(valid);
    mutate(state);
    assert.doesNotThrow(() => assertAtomicFailure(analyzeVoyageEncounterRoundUnitAggregation(state)), label);
    const report = analyzeVoyageEncounterRoundUnitAggregation(state);
    assert.equal(report.errors[0].severity, "error", label);
    assert.deepEqual(report.contributions, [], label);
  }

  const prepared = preparedResolution({ stations, selections, order: ["captain"] });
  const unresolved = analyzeVoyageEncounterRoundUnitAggregation(prepared.state);
  assertAtomicFailure(unresolved);
  assert.ok(unresolved.errors.some(({ code }) => code === "outcome-interpretation-resolution-incomplete"));

  const riskAction = riskMatrixAction("risk-failure", "success", "risk-valid", 2);
  const riskState = completedState({
    stations: [{ stationId: "captain", actions: [riskAction] }],
    selections: selectionsFor([{ stationId: "captain", actions: [riskAction] }]),
    order: ["captain"],
    degrees: ["success"],
    riskBids: { captain: { stationId: "captain", actionId: riskAction.actionId, riskBidId: "risk-valid", dcAdjustment: 2 } }
  });
  riskState.riskBids.captain.dcAdjustment = 8;
  const riskFailure = analyzeVoyageEncounterRoundUnitAggregation(riskState);
  assertAtomicFailure(riskFailure);
  assert.ok(riskFailure.errors.some(({ code }) => code.includes("risk-bid")));
});

test("hostile encounter boundary values never escape or mutate source data", () => {
  const action = checkAction("hostile-action", "success");
  const stations = [{ stationId: "captain", actions: [action] }];
  const valid = completedState({ stations, selections: selectionsFor(stations), order: ["captain"], degrees: ["success"] });
  const hostileCases = [
    ["getter-backed field", (state) => Object.defineProperty(state, "phase", { enumerable: true, configurable: true, get() { throw new Error("getter"); } })],
    ["setter-only field", (state) => Object.defineProperty(state, "phase", { enumerable: true, configurable: true, set() {} })],
    ["inherited field", (state) => { const inherited = Object.create(state); delete inherited.phase; return inherited; }],
    ["own __proto__ data", (state) => Object.defineProperty(state.availableStations[0].actions[0].outcomeDefinition.effectRules[0], "__proto__", { enumerable: true, configurable: true, value: { hostile: true }, writable: true })],
    ["sparse stations", (state) => { state.availableStations.length = 2; delete state.availableStations[0]; }],
    ["cyclic consequence payload", (state) => { const cycle = {}; cycle.self = cycle; state.availableStations[0].actions[0].outcomeDefinition.effectRules[0].payload = cycle; }],
    ["NaN authored DC", (state) => { state.availableStations[0].actions[0].check.dcSource.value = Number.NaN; }],
    ["infinite authored DC", (state) => { state.availableStations[0].actions[0].check.dcSource.value = Number.NEGATIVE_INFINITY; }],
    ["unsafe authored DC", (state) => { state.availableStations[0].actions[0].check.dcSource.value = Number.MAX_SAFE_INTEGER + 1; }]
  ];
  for (const [label, mutate] of hostileCases) {
    let state = structuredClone(valid);
    const before = structuredClone(state);
    const returned = mutate(state);
    if (returned) state = returned;
    let report;
    assert.doesNotThrow(() => { report = analyzeVoyageEncounterRoundUnitAggregation(state); }, label);
    if (report.outcomesReady) assert.fail(`hostile case unexpectedly ready: ${label}`);
    assertAtomicFailure(report);
    if (state === valid) assert.deepEqual(state, before, label);
  }
  const symbolState = structuredClone(valid);
  symbolState.availableStations[0].actions[Symbol("hostile")] = true;
  const symbolReport = analyzeVoyageEncounterRoundUnitAggregation(symbolState);
  assert.equal(symbolReport.readyForAggregation, true);
  assert.deepEqual(symbolReport.contributions, analyzeVoyageEncounterRoundUnitAggregation(valid).contributions);
  const noncanonicalState = structuredClone(valid);
  noncanonicalState.availableStations[0].actions[0].outcomeDefinition.branches.success["01"] = "ignored-hostile-reference";
  const noncanonicalReport = analyzeVoyageEncounterRoundUnitAggregation(noncanonicalState);
  assert.equal(noncanonicalReport.readyForAggregation, true);
  assert.deepEqual(noncanonicalReport.contributions, symbolReport.contributions);
  const proxyTraps = [
    ["prototype inspection", { getPrototypeOf() { throw new Error("prototype"); } }],
    ["own-key enumeration", { ownKeys() { throw new Error("own keys"); } }],
    ["descriptor access", { getOwnPropertyDescriptor() { throw new Error("descriptor"); } }]
  ];
  for (const [label, traps] of proxyTraps) {
    const proxy = structuredClone(valid);
    proxy.availableStations[0].actions[0].outcomeDefinition.effectRules[0].target = new Proxy(
      proxy.availableStations[0].actions[0].outcomeDefinition.effectRules[0].target,
      traps
    );
    let report;
    assert.doesNotThrow(() => { report = analyzeVoyageEncounterRoundUnitAggregation(proxy); }, label);
    if (report.outcomesReady) assert.fail(`proxy trap unexpectedly ready: ${label}`);
    assertAtomicFailure(report);
  }
});

test("count invariants, totals, and returned nested data remain isolated across repeated analysis", () => {
  const action = riskMatrixAction("isolation-action", "critical-success", "isolation-bid", 8);
  const state = completedState({
    stations: [{ stationId: "captain", actions: [action] }],
    selections: selectionsFor([{ stationId: "captain", actions: [action] }]),
    order: ["captain"],
    degrees: ["critical-success"],
    riskBids: { captain: { stationId: "captain", actionId: action.actionId, riskBidId: "isolation-bid", dcAdjustment: 8 } }
  });
  const snapshot = structuredClone(state);
  const first = analyzeVoyageEncounterRoundUnitAggregation(state);
  const second = analyzeVoyageEncounterRoundUnitAggregation(state);
  assert.deepEqual(first, second);
  assert.deepEqual(state, snapshot);
  assert.equal(first.contributions.length, 1);
  assert.equal(first.actionCount, first.contributions.length);
  assert.equal(first.actionCount, first.checkActionCount + first.noRollActionCount);
  assert.equal(first.contributingActionCount, first.contributions.filter(({ successUnits, failureUnits }) => successUnits || failureUnits).length);
  assert.equal(first.successUnits, first.contributions.reduce((sum, row) => sum + row.successUnits, 0));
  assert.equal(first.failureUnits, first.contributions.reduce((sum, row) => sum + row.failureUnits, 0));
  first.contributions[0].failureUnits = 123;
  first.errors.push({ code: "caller-mutation", path: "$", message: "caller-mutation", severity: "error" });
  first.warnings.push({ code: "caller-warning", path: "$", message: "caller-warning", severity: "warning" });
  const fresh = analyzeVoyageEncounterRoundUnitAggregation(state);
  assert.deepEqual(fresh, second);
  assert.notEqual(first.contributions[0], fresh.contributions[0]);
  assert.equal(Object.isFrozen(CONTRIBUTIONS), true);
  assert.equal(Object.values(CONTRIBUTIONS).every(Object.isFrozen), true);
});
