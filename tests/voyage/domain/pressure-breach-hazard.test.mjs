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
import {
  analyzeVoyageEncounterPressureBreachPlan,
  analyzeVoyageEncounterPressureBreachHazardPlan,
  applyVoyageEncounterPressureBreachPlan
} from "../../../scripts/voyage/domain/pressure-breach.js";

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


function pressureBreachHazardId(breach) {
  return `arcflight-hazard:${JSON.stringify([
    "pressure-breach",
    breach.pressureBreachId
  ])}`;
}

const HAZARD_REPORT_KEYS = [
  "structurallyValid",
  "breachPlanReady",
  "readyForPressureBreachHazardPlanning",
  "hazardRequired",
  "hazardCount",
  "hazard",
  "errors",
  "warnings"
];

const HAZARD_KEYS = [
  "hazardId",
  "pressureBreachId",
  "encounterId",
  "stageId",
  "roundNumber",
  "effectIndex",
  "sequence",
  "stationId",
  "actionId",
  "pressureSystemId",
  "category",
  "status",
  "sourceKind",
  "pressureEffectId",
  "sourceIntentId",
  "activationSource",
  "branch",
  "timing",
  "visibility",
  "name"
];

test("builds one exact deterministic active system Hazard for a standard Pressure breach", () => {
  const source = setPressure(oneCheckConsequences("failure"), "crew-morale", 2);
  const before = structuredClone(source);
  const breachPlan = analyzeVoyageEncounterPressureBreachPlan(source);

  const first = analyzeVoyageEncounterPressureBreachHazardPlan(source);
  const second = analyzeVoyageEncounterPressureBreachHazardPlan(source);

  assert.deepEqual(first, second);
  assert.deepEqual(source, before);
  assertExactKeys(first, HAZARD_REPORT_KEYS);
  assert.equal(first.structurallyValid, true);
  assert.equal(first.breachPlanReady, true);
  assert.equal(first.readyForPressureBreachHazardPlanning, true);
  assert.equal(first.hazardRequired, true);
  assert.equal(first.hazardCount, 1);
  assert.deepEqual(first.errors, []);
  assertExactKeys(first.hazard, HAZARD_KEYS);
  assert.equal(first.hazard.hazardId, pressureBreachHazardId(breachPlan.breach));
  assert.equal(first.hazard.pressureBreachId, breachPlan.breach.pressureBreachId);
  assert.equal(first.hazard.encounterId, breachPlan.breach.encounterId);
  assert.equal(first.hazard.stageId, breachPlan.breach.stageId);
  assert.equal(first.hazard.roundNumber, breachPlan.breach.roundNumber);
  assert.equal(first.hazard.effectIndex, breachPlan.breach.effectIndex);
  assert.equal(first.hazard.sequence, breachPlan.breach.sequence);
  assert.equal(first.hazard.stationId, "captain");
  assert.equal(first.hazard.actionId, breachPlan.breach.actionId);
  assert.equal(first.hazard.pressureSystemId, "crew-morale");
  assert.equal(first.hazard.category, "system");
  assert.equal(first.hazard.status, "active");
  assert.equal(first.hazard.sourceKind, "pressure-breach");
  assert.equal(first.hazard.pressureEffectId, breachPlan.breach.pressureEffectId);
  assert.equal(first.hazard.sourceIntentId, null);
  assert.equal(first.hazard.activationSource, null);
  assert.equal(first.hazard.branch, "failure");
  assert.equal(first.hazard.timing, "consequences");
  assert.equal(first.hazard.visibility, "public");
  assert.equal(first.hazard.name, "Crew Morale Breach");
  assert.notEqual(first.hazard, second.hazard);
});

test("authored cross-system breaches preserve source metadata and use the matching system Hazard name", () => {
  const source = oneNoRollConsequences([
    pressureRule("lifeveil-breach", { kind: "pressure-system", targetId: "lifeveil" }, 1)
  ]);
  setPressure(source, "lifeveil", 2);
  const breachPlan = analyzeVoyageEncounterPressureBreachPlan(source);

  const report = analyzeVoyageEncounterPressureBreachHazardPlan(source);

  assert.equal(report.readyForPressureBreachHazardPlanning, true);
  assert.equal(report.hazardRequired, true);
  assert.equal(report.hazardCount, 1);
  assert.equal(report.hazard.pressureSystemId, "lifeveil");
  assert.equal(report.hazard.name, "Lifeveil Breach");
  for (const key of [
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
    "sourceIntentId",
    "activationSource",
    "branch",
    "timing",
    "visibility"
  ]) {
    assert.equal(report.hazard[key], breachPlan.breach[key], key);
  }
});

test("all five canonical Pressure systems create stable matching Hazard identities", () => {
  const cases = [
    ["captain", "crew-morale", "Crew Morale Breach"],
    ["engineer", "arkengine", "Arkengine Breach"],
    ["navigator", "levstone-array", "Levstone Array Breach"],
    ["watchmaster", "solar-sail-rig", "Solar Sail Rig Breach"],
    ["veilwarden", "lifeveil", "Lifeveil Breach"]
  ];

  for (const [stationId, pressureSystemId, name] of cases) {
    const source = oneNoRollConsequences([
      pressureRule(`${pressureSystemId}-breach`, { kind: "source-station" }, 1)
    ], stationId);
    setPressure(source, pressureSystemId, 2);

    const report = analyzeVoyageEncounterPressureBreachHazardPlan(source);

    assert.equal(report.hazardRequired, true, pressureSystemId);
    assert.equal(report.hazard.pressureSystemId, pressureSystemId);
    assert.equal(report.hazard.name, name);
    assert.equal(report.hazard.category, "system");
    assert.equal(report.hazard.status, "active");
  }
});

test("no-breach, not-ready, and invalid states fail closed without partial Hazard records", () => {
  const safe = setPressure(oneNoRollConsequences([
    pressureRule("safe-pressure", { kind: "source-station" }, 1)
  ]), "crew-morale", 0);
  const safeReport = analyzeVoyageEncounterPressureBreachHazardPlan(safe);
  assertExactKeys(safeReport, HAZARD_REPORT_KEYS);
  assert.equal(safeReport.structurallyValid, true);
  assert.equal(safeReport.breachPlanReady, true);
  assert.equal(safeReport.readyForPressureBreachHazardPlanning, true);
  assert.equal(safeReport.hazardRequired, false);
  assert.equal(safeReport.hazardCount, 0);
  assert.equal(safeReport.hazard, null);
  assert.deepEqual(safeReport.errors, []);

  const notReady = encounterState({
    availableStations: [{
      stationId: "captain",
      actions: [checkAction("not-ready")]
    }],
    selections: {
      captain: { stationId: "captain", actionId: "not-ready" }
    }
  });
  const notReadyReport = analyzeVoyageEncounterPressureBreachHazardPlan(notReady);
  assert.equal(notReadyReport.breachPlanReady, false);
  assert.equal(notReadyReport.readyForPressureBreachHazardPlanning, false);
  assert.equal(notReadyReport.hazardRequired, false);
  assert.equal(notReadyReport.hazardCount, 0);
  assert.equal(notReadyReport.hazard, null);
  assert.ok(notReadyReport.errors.some(({ code }) => code === "pressure-breach-hazard-plan-breach-not-ready"));

  const invalid = oneNoRollConsequences([]);
  invalid.pressureSystems["crew-morale"].value = 99;
  const invalidReport = analyzeVoyageEncounterPressureBreachHazardPlan(invalid);
  assert.equal(invalidReport.breachPlanReady, false);
  assert.equal(invalidReport.hazard, null);
  assert.ok(invalidReport.errors.some(({ code }) => code === "pressure-breach-plan-state-invalid"));
});

test("Hazard planning rejects hostile caller data without executing getters or Proxy get traps", () => {
  const base = setPressure(oneNoRollConsequences([
    pressureRule("breach", { kind: "source-station" }, 1)
  ]), "crew-morale", 2);
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
  const accessorReport = analyzeVoyageEncounterPressureBreachHazardPlan(accessor);
  assert.equal(accessorReport.readyForPressureBreachHazardPlanning, false);
  assert.equal(accessorReport.hazard, null);
  assert.ok(accessorReport.errors.some(({ code }) => code === "pressure-breach-hazard-plan-data-read-failed"));
  assert.equal(getterReads, 0);

  let proxyReads = 0;
  const proxy = new Proxy(base, {
    get(target, key, receiver) {
      proxyReads += 1;
      return Reflect.get(target, key, receiver);
    }
  });
  const proxyReport = analyzeVoyageEncounterPressureBreachHazardPlan(proxy);
  assert.equal(proxyReport.readyForPressureBreachHazardPlanning, true);
  assert.equal(proxyReport.hazardRequired, true);
  assert.equal(proxyReads, 0);

  const cyclic = structuredClone(base);
  cyclic.metadata.cycle = cyclic.metadata;
  const first = analyzeVoyageEncounterPressureBreachHazardPlan(cyclic);
  const second = analyzeVoyageEncounterPressureBreachHazardPlan(cyclic);
  assert.deepEqual(first, second);
  assert.equal(first.hazard, null);
  assert.ok(first.errors.some(({ code }) => code === "pressure-breach-hazard-plan-data-read-failed"));
  assert.deepEqual(base, before);
});

test("successful breach application emits one exact isolated matching Hazard and no deferred Void Scar systems", () => {
  const source = setPressure(oneNoRollConsequences([
    pressureRule("breach", { kind: "source-station" }, 1)
  ]), "crew-morale", 2);
  const before = structuredClone(source);
  const hazardPlan = analyzeVoyageEncounterPressureBreachHazardPlan(source);

  const first = applyVoyageEncounterPressureBreachPlan(source);
  const second = applyVoyageEncounterPressureBreachPlan(source);

  assert.equal(first.ok, true);
  assert.deepEqual(first, second);
  assert.deepEqual(source, before);
  assert.equal(first.events.length, 1);
  assert.deepEqual(first.events[0].hazard, hazardPlan.hazard);
  assert.notEqual(first.events[0].hazard, hazardPlan.hazard);
  assert.notEqual(first.events[0].hazard, second.events[0].hazard);
  assert.equal(first.events[0].hazard.pressureBreachId, first.events[0].breach.pressureBreachId);
  assert.equal(first.events[0].hazard.pressureSystemId, first.events[0].breach.pressureSystemId);
  assert.equal(Object.hasOwn(first.nextState, "hazards"), false);
  assert.equal(Object.hasOwn(first, "hazard"), false);
  assert.equal(Object.hasOwn(first, "hazards"), false);

  for (const key of [
    "voidScar",
    "voidScars",
    "permanentConsequenceProposal",
    "closeout",
    "persistence"
  ]) {
    assert.equal(Object.hasOwn(first, key), false, key);
    assert.equal(Object.hasOwn(first.events[0], key), false, `event.${key}`);
  }

  first.events[0].hazard.name = "Mutated";
  assert.equal(second.events[0].hazard.name, "Crew Morale Breach");
});

test("a deferred second breach produces no Hazard creation event or partial state", () => {
  const source = oneNoRollConsequences([
    pressureRule("first-breach", { kind: "source-station" }, 1),
    pressureRule("second-breach", { kind: "pressure-system", targetId: "lifeveil" }, 1)
  ]);
  setPressure(source, "crew-morale", 2);
  setPressure(source, "lifeveil", 2);
  const before = structuredClone(source);

  const result = applyVoyageEncounterPressureBreachPlan(source);

  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  assert.ok(result.errors.some(({ code }) => code === "pressure-breach-application-multiple-breaches-deferred"));
  assert.deepEqual(source, before);
});
