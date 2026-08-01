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
import { analyzeVoyageEncounterPressureBreachPlan } from "../../../scripts/voyage/domain/pressure-breach.js";

const BRANCHES = ["critical-failure", "failure", "success", "critical-success"];

function encounterState({
  encounterId = "pressure-breach-encounter",
  stageId = "pressure-breach-stage",
  roundNumber = 1,
  availableStations = [],
  selections = {},
  targets = {}
} = {}) {
  for (const station of availableStations) {
    for (const action of station.actions) {
      if (Object.hasOwn(action, "approaches")) continue;
      action.approaches = Object.hasOwn(action, "check")
        ? [{
            approachId: `approach-${action.actionId}`,
            statisticSlugOrAbilityId: action.check.statisticOptions[0]
          }]
        : [{
            approachId: `approach-${action.actionId}`,
            noRoll: true
          }];
    }
  }

  for (const [stationId, selection] of Object.entries(selections)) {
    if (Object.hasOwn(selection, "approachId")) continue;
    const action = availableStations
      .find((station) => station.stationId === stationId)
      ?.actions.find((candidate) => candidate.actionId === selection.actionId);
    const approach = action?.approaches?.[0];
    if (!approach) continue;
    selection.approachId = approach.approachId;
    if (approach.noRoll === true) selection.noRoll = true;
    else selection.statisticSlugOrAbilityId = approach.statisticSlugOrAbilityId;
  }

  const result = createVoyageEncounterState({
    encounterId,
    definitionId: "pressure-breach-definition",
    primaryShip: { id: "pressure-breach-ship" }
  });
  result.lifecycleState = "active";
  result.currentStage = { stageId };
  result.roundNumber = roundNumber;
  result.phase = "crew-planning";
  result.availableStations = availableStations;
  result.stationAssignments = Object.keys(selections).map((stationId) => ({
    stationId,
    operator: { kind: "actor", uuid: `Actor.operator-${stationId}` }
  }));
  result.selections = selections;
  result.targets = targets;
  result.committedStationOrder = [];
  return result;
}

function pressureRule(effectId, target, delta, overrides = {}) {
  return {
    effectId,
    intentType: "pressure-change",
    timing: "consequences",
    visibility: "public",
    target,
    payload: { delta },
    ...overrides
  };
}

function noRollAction(actionId, effectRules = []) {
  return {
    actionId,
    outcomeDefinition: {
      effectRules,
      branches: {
        "no-roll": effectRules.map(({ effectId }) => effectId)
      }
    }
  };
}

function checkAction(actionId, branch = "failure", effectRules = []) {
  const branches = Object.fromEntries(BRANCHES.map((candidate) => [candidate, []]));
  branches[branch] = effectRules.map(({ effectId }) => effectId);
  return {
    actionId,
    check: {
      source: { kind: "character", uuid: `Actor.${actionId}` },
      statisticOptions: ["diplomacy"],
      dcSource: { kind: "fixed", value: 20 },
      secrecy: "public",
      metadata: {}
    },
    outcomeDefinition: { effectRules, branches }
  };
}

function executionResult(pendingCheck, degreeOfSuccessSlug) {
  return {
    ok: true,
    status: "rolled",
    pendingCheckId: pendingCheck.pendingCheckId,
    sequence: pendingCheck.sequence,
    sourceKind: "character",
    sourceUuid: pendingCheck.source.uuid,
    statisticSlug: pendingCheck.statisticSlugOrAbilityId,
    dc: pendingCheck.finalDc,
    rollMode: "public",
    result: {
      total: pendingCheck.finalDc,
      degreeOfSuccess: BRANCHES.indexOf(degreeOfSuccessSlug),
      degreeOfSuccessSlug
    },
    errors: [],
    warnings: []
  };
}

function resolveToConsequences(source, resultBranches = []) {
  const working = structuredClone(source);
  working.proposedStationOrder = [...Object.keys(working.selections)];
  working.riskBids = structuredClone(working.riskBids ?? {});

  const locked = applyVoyageEncounterCrewPlanningLock(working, {
    phaseStartSnapshotId: "pressure-breach-lock"
  });
  assert.equal(locked.ok, true);

  const resolution = applyVoyageEncounterResolutionTransition(locked.nextState, {
    phaseStartSnapshotId: "pressure-breach-resolution"
  });
  assert.equal(resolution.ok, true);

  const execution = prepareVoyageEncounterActionExecutionRequests(resolution.nextState);
  assert.equal(execution.readyForExecution, true);

  let resolved = resolution.nextState;
  const checkRequests = execution.executionRequests.filter(({ mode }) => mode === "check");
  if (checkRequests.length > 0) {
    const prepared = applyVoyageEncounterPendingCheckPreparation(resolved, {
      pendingCheckIds: checkRequests.map(({ sequence }) => ({
        sequence,
        pendingCheckId: `pressure-breach-pending-${sequence}`
      }))
    });
    assert.equal(prepared.ok, true);
    resolved = prepared.nextState;

    for (const request of checkRequests) {
      const pendingCheck = resolved.pendingChecks.find(({ sequence }) => sequence === request.sequence);
      assert.ok(pendingCheck);
      const result = applyVoyageEncounterPendingCheckResult(
        resolved,
        executionResult(pendingCheck, resultBranches[request.sequence] ?? "success")
      );
      assert.equal(result.ok, true);
      resolved = result.nextState;
    }
  }

  const completion = prepareVoyageEncounterResolutionCompletion(resolved);
  assert.equal(completion.readyForConsequences, true);

  const consequences = applyVoyageEncounterConsequencesTransition(resolved, {
    phaseStartSnapshotId: "pressure-breach-consequences"
  });
  assert.equal(consequences.ok, true);
  return consequences.nextState;
}

function oneNoRollConsequences(effectRules = [], stationId = "captain", targets = {}) {
  return resolveToConsequences(encounterState({
    availableStations: [{
      stationId,
      actions: [noRollAction("pressure-breach-action", effectRules)]
    }],
    selections: {
      [stationId]: {
        stationId,
        actionId: "pressure-breach-action"
      }
    },
    targets
  }));
}

function oneCheckConsequences(branch) {
  return resolveToConsequences(encounterState({
    availableStations: [{
      stationId: "captain",
      actions: [checkAction("pressure-breach-check", branch)]
    }],
    selections: {
      captain: {
        stationId: "captain",
        actionId: "pressure-breach-check"
      }
    }
  }), [branch]);
}

function setPressure(
  state,
  pressureSystemId,
  value,
  capacity = state.pressureSystems[pressureSystemId].capacity
) {
  state.pressureSystems[pressureSystemId].value = value;
  state.pressureSystems[pressureSystemId].capacity = capacity;
  return state;
}

function pressureBreachId(effect, effectIndex) {
  return `arcflight-pressure-breach:${JSON.stringify([
    effect.encounterId,
    effect.stageId,
    effect.roundNumber,
    effectIndex,
    effect.pressureSystemId,
    effect.pressureEffectId
  ])}`;
}

function assertExactKeys(value, keys) {
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
}

function assertReadyNoBreach(report, effectCount) {
  assert.equal(report.structurallyValid, true);
  assert.equal(report.pressurePlanReady, true);
  assert.equal(report.readyForPressureBreachPlanning, true);
  assert.equal(report.pressureEffectCount, effectCount);
  assert.equal(report.simulatedEffectCount, effectCount);
  assert.equal(report.breachRequired, false);
  assert.equal(report.breach, null);
  assert.deepEqual(report.errors, []);
}

test("no-breach reports are pure, deterministic, and expose the exact report contract", () => {
  const source = setPressure(oneNoRollConsequences([
    pressureRule("safe-pressure", { kind: "source-station" }, 1)
  ]), "crew-morale", 0);
  const before = structuredClone(source);

  const first = analyzeVoyageEncounterPressureBreachPlan(source);
  const second = analyzeVoyageEncounterPressureBreachPlan(source);

  assert.deepEqual(first, second);
  assertReadyNoBreach(first, 1);
  assertExactKeys(first, [
    "structurallyValid",
    "pressurePlanReady",
    "readyForPressureBreachPlanning",
    "pressureEffectCount",
    "simulatedEffectCount",
    "breachRequired",
    "breach",
    "errors",
    "warnings"
  ]);
  assert.deepEqual(source, before);
});

test("standard Failure and Critical Failure produce exact first-breach records", () => {
  for (const [branch, attemptedDelta, previousValue, remainingCapacity, overflowDelta] of [
    ["failure", 1, 2, 0, 1],
    ["critical-failure", 2, 1, 1, 1]
  ]) {
    const source = setPressure(oneCheckConsequences(branch), "crew-morale", previousValue);
    const before = structuredClone(source);
    const report = analyzeVoyageEncounterPressureBreachPlan(source);

    assert.equal(report.readyForPressureBreachPlanning, true, branch);
    assert.equal(report.pressurePlanReady, true, branch);
    assert.equal(report.pressureEffectCount, 1, branch);
    assert.equal(report.simulatedEffectCount, 0, branch);
    assert.equal(report.breachRequired, true, branch);
    assert.deepEqual(report.errors, [], branch);
    assert.ok(report.breach, branch);
    assertExactKeys(report.breach, [
      "pressureBreachId",
      "encounterId",
      "stageId",
      "roundNumber",
      "effectIndex",
      "sequence",
      "stationId",
      "actionId",
      "pressureSystemId",
      "pressureEffectId",
      "sourceKind",
      "sourceIntentId",
      "activationSource",
      "branch",
      "timing",
      "visibility",
      "previousValue",
      "capacity",
      "remainingCapacity",
      "attemptedDelta",
      "overflowDelta"
    ]);
    assert.equal(report.breach.pressureBreachId, pressureBreachId(report.breach, 0));
    assert.equal(report.breach.encounterId, "pressure-breach-encounter");
    assert.equal(report.breach.stageId, "pressure-breach-stage");
    assert.equal(report.breach.roundNumber, 1);
    assert.equal(report.breach.effectIndex, 0);
    assert.equal(report.breach.sequence, 0);
    assert.equal(report.breach.stationId, "captain");
    assert.equal(report.breach.actionId, "pressure-breach-check");
    assert.equal(report.breach.pressureSystemId, "crew-morale");
    assert.equal(report.breach.sourceKind, "standard-result");
    assert.equal(report.breach.sourceIntentId, null);
    assert.equal(report.breach.activationSource, null);
    assert.equal(report.breach.branch, branch);
    assert.equal(report.breach.timing, "consequences");
    assert.equal(report.breach.visibility, "public");
    assert.equal(report.breach.previousValue, previousValue);
    assert.equal(report.breach.capacity, 2);
    assert.equal(report.breach.remainingCapacity, remainingCapacity);
    assert.equal(report.breach.attemptedDelta, attemptedDelta);
    assert.equal(report.breach.overflowDelta, overflowDelta);
    assert.deepEqual(source, before);
  }
});

test("ordered authored Pressure simulation identifies only the first breach", () => {
  const lateBreach = setPressure(oneNoRollConsequences([
    pressureRule("first-safe", { kind: "source-station" }, 1),
    pressureRule("second-breach", { kind: "source-station" }, 1),
    pressureRule("never-simulated", { kind: "source-station" }, -2)
  ]), "crew-morale", 1);
  const lateReport = analyzeVoyageEncounterPressureBreachPlan(lateBreach);

  assert.equal(lateReport.pressureEffectCount, 3);
  assert.equal(lateReport.simulatedEffectCount, 1);
  assert.equal(lateReport.breachRequired, true);
  assert.equal(lateReport.breach.effectIndex, 1);
  assert.equal(lateReport.breach.previousValue, 2);
  assert.equal(lateReport.breach.remainingCapacity, 0);
  assert.equal(lateReport.breach.attemptedDelta, 1);
  assert.equal(lateReport.breach.overflowDelta, 1);
  assert.match(lateReport.breach.pressureEffectId, /second-breach/);

  const reductionFirst = setPressure(oneNoRollConsequences([
    pressureRule("reduce-first", { kind: "source-station" }, -1),
    pressureRule("increase-second", { kind: "source-station" }, 1)
  ]), "crew-morale", 2);
  assertReadyNoBreach(
    analyzeVoyageEncounterPressureBreachPlan(reductionFirst),
    2
  );

  const breachBeforeReduction = setPressure(oneNoRollConsequences([
    pressureRule("breach-first", { kind: "source-station" }, 1),
    pressureRule("rescue-too-late", { kind: "source-station" }, -2)
  ]), "crew-morale", 2);
  const firstReport = analyzeVoyageEncounterPressureBreachPlan(breachBeforeReduction);
  assert.equal(firstReport.breachRequired, true);
  assert.equal(firstReport.breach.effectIndex, 0);
  assert.match(firstReport.breach.pressureEffectId, /breach-first/);
});

test("authored target metadata is preserved when another canonical system breaches", () => {
  const source = setPressure(oneNoRollConsequences([
    pressureRule(
      "lifeveil-breach",
      { kind: "pressure-system", targetId: "lifeveil" },
      1,
      { timing: "end-of-round", visibility: "gm-secret" }
    )
  ]), "lifeveil", 2);
  const report = analyzeVoyageEncounterPressureBreachPlan(source);

  assert.equal(report.breachRequired, true);
  assert.equal(report.breach.stationId, "captain");
  assert.equal(report.breach.pressureSystemId, "lifeveil");
  assert.equal(report.breach.sourceKind, "outcome-intent");
  assert.match(report.breach.sourceIntentId, /lifeveil-breach/);
  assert.equal(report.breach.activationSource, "branch");
  assert.equal(report.breach.branch, "no-roll");
  assert.equal(report.breach.timing, "end-of-round");
  assert.equal(report.breach.visibility, "gm-secret");
});

test("not-ready and invalid states fail closed without partial breach output", () => {
  const notReady = encounterState({
    availableStations: [{
      stationId: "captain",
      actions: [checkAction("not-ready")]
    }],
    selections: {
      captain: {
        stationId: "captain",
        actionId: "not-ready"
      }
    }
  });
  const notReadyBefore = structuredClone(notReady);
  const notReadyReport = analyzeVoyageEncounterPressureBreachPlan(notReady);

  assert.equal(notReadyReport.readyForPressureBreachPlanning, false);
  assert.equal(notReadyReport.pressurePlanReady, false);
  assert.equal(notReadyReport.pressureEffectCount, 0);
  assert.equal(notReadyReport.simulatedEffectCount, 0);
  assert.equal(notReadyReport.breachRequired, false);
  assert.equal(notReadyReport.breach, null);
  assert.ok(notReadyReport.errors.some(({ code }) => code === "pressure-breach-plan-pressure-not-ready"));
  assert.deepEqual(notReady, notReadyBefore);

  const invalid = oneNoRollConsequences([]);
  invalid.pressureSystems["crew-morale"].value = 99;
  const invalidReport = analyzeVoyageEncounterPressureBreachPlan(invalid);
  assert.equal(invalidReport.readyForPressureBreachPlanning, false);
  assert.equal(invalidReport.pressurePlanReady, false);
  assert.equal(invalidReport.breachRequired, false);
  assert.equal(invalidReport.breach, null);
  assert.ok(invalidReport.errors.some(({ code }) => code === "pressure-breach-plan-state-invalid"));
});

test("caller capture rejects hostile data without executing getters or Proxy get traps", () => {
  const base = oneNoRollConsequences([]);
  const before = structuredClone(base);

  let getterReads = 0;
  const accessor = structuredClone(base);
  Object.defineProperty(accessor, "currentStage", {
    enumerable: true,
    configurable: true,
    get() {
      getterReads += 1;
      return { stageId: "hostile" };
    }
  });
  const accessorReport = analyzeVoyageEncounterPressureBreachPlan(accessor);
  assert.equal(accessorReport.readyForPressureBreachPlanning, false);
  assert.ok(accessorReport.errors.some(({ code }) => code === "pressure-breach-plan-data-read-failed"));
  assert.equal(getterReads, 0);

  let proxyReads = 0;
  const proxy = new Proxy(base, {
    get(target, key, receiver) {
      proxyReads += 1;
      return Reflect.get(target, key, receiver);
    }
  });
  const proxyReport = analyzeVoyageEncounterPressureBreachPlan(proxy);
  assertReadyNoBreach(proxyReport, 0);
  assert.equal(proxyReads, 0);

  const assertHostile = (candidate) => {
    const first = analyzeVoyageEncounterPressureBreachPlan(candidate);
    const second = analyzeVoyageEncounterPressureBreachPlan(candidate);
    assert.deepEqual(first, second);
    assert.equal(first.readyForPressureBreachPlanning, false);
    assert.equal(first.breachRequired, false);
    assert.equal(first.breach, null);
    assert.ok(first.errors.some(({ code }) => code === "pressure-breach-plan-data-read-failed"));
  };

  const cyclic = structuredClone(base);
  cyclic.metadata.cycle = cyclic.metadata;
  assertHostile(cyclic);

  const undefinedValue = structuredClone(base);
  undefinedValue.metadata = { missing: undefined };
  assertHostile(undefinedValue);

  const symbolValue = structuredClone(base);
  symbolValue[Symbol("hostile")] = true;
  assertHostile(symbolValue);

  const unsafeValue = structuredClone(base);
  Object.defineProperty(unsafeValue, "constructor", {
    enumerable: true,
    configurable: true,
    value: true
  });
  assertHostile(unsafeValue);

  const sparse = structuredClone(base);
  sparse.availableStations = [];
  sparse.availableStations[1] = { stationId: "captain", actions: [] };
  assertHostile(sparse);

  assert.deepEqual(base, before);
});

test("breach planning creates no state, event, Hazard, Void Scar, reset, or lifecycle effects", () => {
  const source = setPressure(oneNoRollConsequences([
    pressureRule("breach", { kind: "source-station" }, 1)
  ]), "crew-morale", 2);
  const before = structuredClone(source);
  const report = analyzeVoyageEncounterPressureBreachPlan(source);

  assert.equal(report.breachRequired, true);
  for (const key of [
    "nextState",
    "events",
    "hazards",
    "hazard",
    "voidScars",
    "voidScar",
    "resets",
    "reset",
    "lifecycleState"
  ]) {
    assert.equal(Object.hasOwn(report, key), false, key);
    assert.equal(Object.hasOwn(report.breach, key), false, `breach.${key}`);
  }
  assert.deepEqual(source, before);
});
