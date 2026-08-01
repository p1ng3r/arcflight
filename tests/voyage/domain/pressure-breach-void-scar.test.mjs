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
  analyzeVoyageEncounterPressureBreachVoidScarProposalPlan,
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


function voidScarId(breach) {
  return `arcflight-void-scar:${JSON.stringify([
    "pressure-breach",
    breach.pressureBreachId
  ])}`;
}

function voidScarProposalId(breach) {
  return `arcflight-void-scar-proposal:${JSON.stringify([
    "pressure-breach",
    breach.pressureBreachId
  ])}`;
}

const VOID_SCAR_REPORT_KEYS = [
  "structurallyValid",
  "breachPlanReady",
  "hazardPlanReady",
  "readyForPressureBreachVoidScarProposalPlanning",
  "voidScarProposalRequired",
  "voidScarProposalCount",
  "voidScarProposal",
  "errors",
  "warnings"
];

const VOID_SCAR_PROPOSAL_KEYS = [
  "voidScarProposalId",
  "voidScarId",
  "pressureBreachId",
  "hazardId",
  "encounterId",
  "stageId",
  "roundNumber",
  "effectIndex",
  "sequence",
  "stationId",
  "actionId",
  "pressureSystemId",
  "consequenceKind",
  "status",
  "persistence",
  "sourceKind",
  "pressureEffectId",
  "sourceIntentId",
  "activationSource",
  "branch",
  "timing",
  "visibility",
  "name"
];

test("builds one exact deterministic lasting Void Scar proposal for a standard Pressure breach", () => {
  const source = setPressure(oneCheckConsequences("failure"), "crew-morale", 2);
  const before = structuredClone(source);
  const breachPlan = analyzeVoyageEncounterPressureBreachPlan(source);
  const hazardPlan = analyzeVoyageEncounterPressureBreachHazardPlan(source);

  const first = analyzeVoyageEncounterPressureBreachVoidScarProposalPlan(source);
  const second = analyzeVoyageEncounterPressureBreachVoidScarProposalPlan(source);

  assert.deepEqual(first, second);
  assert.deepEqual(source, before);
  assertExactKeys(first, VOID_SCAR_REPORT_KEYS);
  assert.equal(first.structurallyValid, true);
  assert.equal(first.breachPlanReady, true);
  assert.equal(first.hazardPlanReady, true);
  assert.equal(first.readyForPressureBreachVoidScarProposalPlanning, true);
  assert.equal(first.voidScarProposalRequired, true);
  assert.equal(first.voidScarProposalCount, 1);
  assert.deepEqual(first.errors, []);
  assertExactKeys(first.voidScarProposal, VOID_SCAR_PROPOSAL_KEYS);
  assert.equal(first.voidScarProposal.voidScarProposalId, voidScarProposalId(breachPlan.breach));
  assert.equal(first.voidScarProposal.voidScarId, voidScarId(breachPlan.breach));
  assert.equal(first.voidScarProposal.pressureBreachId, breachPlan.breach.pressureBreachId);
  assert.equal(first.voidScarProposal.hazardId, hazardPlan.hazard.hazardId);
  assert.equal(first.voidScarProposal.encounterId, breachPlan.breach.encounterId);
  assert.equal(first.voidScarProposal.stageId, breachPlan.breach.stageId);
  assert.equal(first.voidScarProposal.roundNumber, breachPlan.breach.roundNumber);
  assert.equal(first.voidScarProposal.effectIndex, breachPlan.breach.effectIndex);
  assert.equal(first.voidScarProposal.sequence, breachPlan.breach.sequence);
  assert.equal(first.voidScarProposal.stationId, "captain");
  assert.equal(first.voidScarProposal.actionId, breachPlan.breach.actionId);
  assert.equal(first.voidScarProposal.pressureSystemId, "crew-morale");
  assert.equal(first.voidScarProposal.consequenceKind, "void-scar");
  assert.equal(first.voidScarProposal.status, "proposed");
  assert.equal(first.voidScarProposal.persistence, "lasting");
  assert.equal(first.voidScarProposal.sourceKind, "pressure-breach");
  assert.equal(first.voidScarProposal.pressureEffectId, breachPlan.breach.pressureEffectId);
  assert.equal(first.voidScarProposal.sourceIntentId, null);
  assert.equal(first.voidScarProposal.activationSource, null);
  assert.equal(first.voidScarProposal.branch, "failure");
  assert.equal(first.voidScarProposal.timing, "consequences");
  assert.equal(first.voidScarProposal.visibility, "public");
  assert.equal(first.voidScarProposal.name, "Crew Morale Void Scar");
  assert.notEqual(first.voidScarProposal, second.voidScarProposal);
});

test("authored cross-system breaches preserve source metadata and match the Hazard identity", () => {
  const source = oneNoRollConsequences([
    pressureRule("lifeveil-breach", { kind: "pressure-system", targetId: "lifeveil" }, 1)
  ]);
  setPressure(source, "lifeveil", 2);
  const breachPlan = analyzeVoyageEncounterPressureBreachPlan(source);
  const hazardPlan = analyzeVoyageEncounterPressureBreachHazardPlan(source);

  const report = analyzeVoyageEncounterPressureBreachVoidScarProposalPlan(source);

  assert.equal(report.readyForPressureBreachVoidScarProposalPlanning, true);
  assert.equal(report.voidScarProposalRequired, true);
  assert.equal(report.voidScarProposalCount, 1);
  assert.equal(report.voidScarProposal.pressureSystemId, "lifeveil");
  assert.equal(report.voidScarProposal.name, "Lifeveil Void Scar");
  assert.equal(report.voidScarProposal.hazardId, hazardPlan.hazard.hazardId);
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
    assert.equal(report.voidScarProposal[key], breachPlan.breach[key], key);
  }
});

test("all five canonical Pressure systems create stable matching Void Scar proposal identities", () => {
  const cases = [
    ["captain", "crew-morale", "Crew Morale Void Scar"],
    ["engineer", "arkengine", "Arkengine Void Scar"],
    ["navigator", "levstone-array", "Levstone Array Void Scar"],
    ["watchmaster", "solar-sail-rig", "Solar Sail Rig Void Scar"],
    ["veilwarden", "lifeveil", "Lifeveil Void Scar"]
  ];

  for (const [stationId, pressureSystemId, name] of cases) {
    const source = oneNoRollConsequences([
      pressureRule(`${pressureSystemId}-breach`, { kind: "source-station" }, 1)
    ], stationId);
    setPressure(source, pressureSystemId, 2);

    const report = analyzeVoyageEncounterPressureBreachVoidScarProposalPlan(source);

    assert.equal(report.voidScarProposalRequired, true, pressureSystemId);
    assert.equal(report.voidScarProposal.pressureSystemId, pressureSystemId);
    assert.equal(report.voidScarProposal.name, name);
    assert.equal(report.voidScarProposal.consequenceKind, "void-scar");
    assert.equal(report.voidScarProposal.status, "proposed");
    assert.equal(report.voidScarProposal.persistence, "lasting");
  }
});

test("no-breach, not-ready, and invalid states fail closed without partial Void Scar proposals", () => {
  const safe = setPressure(oneNoRollConsequences([
    pressureRule("safe-pressure", { kind: "source-station" }, 1)
  ]), "crew-morale", 0);
  const safeReport = analyzeVoyageEncounterPressureBreachVoidScarProposalPlan(safe);
  assertExactKeys(safeReport, VOID_SCAR_REPORT_KEYS);
  assert.equal(safeReport.structurallyValid, true);
  assert.equal(safeReport.breachPlanReady, true);
  assert.equal(safeReport.hazardPlanReady, true);
  assert.equal(safeReport.readyForPressureBreachVoidScarProposalPlanning, true);
  assert.equal(safeReport.voidScarProposalRequired, false);
  assert.equal(safeReport.voidScarProposalCount, 0);
  assert.equal(safeReport.voidScarProposal, null);
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
  const notReadyReport = analyzeVoyageEncounterPressureBreachVoidScarProposalPlan(notReady);
  assert.equal(notReadyReport.breachPlanReady, false);
  assert.equal(notReadyReport.hazardPlanReady, false);
  assert.equal(notReadyReport.readyForPressureBreachVoidScarProposalPlanning, false);
  assert.equal(notReadyReport.voidScarProposalRequired, false);
  assert.equal(notReadyReport.voidScarProposalCount, 0);
  assert.equal(notReadyReport.voidScarProposal, null);
  assert.ok(notReadyReport.errors.some(({ code }) => (
    code === "pressure-breach-void-scar-plan-breach-not-ready"
  )));

  const invalid = oneNoRollConsequences([]);
  invalid.pressureSystems["crew-morale"].value = 99;
  const invalidReport = analyzeVoyageEncounterPressureBreachVoidScarProposalPlan(invalid);
  assert.equal(invalidReport.breachPlanReady, false);
  assert.equal(invalidReport.voidScarProposal, null);
  assert.ok(invalidReport.errors.some(({ code }) => code === "pressure-breach-plan-state-invalid"));
});

test("Void Scar proposal planning rejects hostile caller data without executing getters or Proxy get traps", () => {
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
  const accessorReport = analyzeVoyageEncounterPressureBreachVoidScarProposalPlan(accessor);
  assert.equal(accessorReport.readyForPressureBreachVoidScarProposalPlanning, false);
  assert.equal(accessorReport.voidScarProposal, null);
  assert.ok(accessorReport.errors.some(({ code }) => (
    code === "pressure-breach-void-scar-plan-data-read-failed"
  )));
  assert.equal(getterReads, 0);

  let proxyReads = 0;
  const proxy = new Proxy(base, {
    get(target, key, receiver) {
      proxyReads += 1;
      return Reflect.get(target, key, receiver);
    }
  });
  const proxyReport = analyzeVoyageEncounterPressureBreachVoidScarProposalPlan(proxy);
  assert.equal(proxyReport.readyForPressureBreachVoidScarProposalPlanning, true);
  assert.equal(proxyReport.voidScarProposalRequired, true);
  assert.equal(proxyReads, 0);

  const cyclic = structuredClone(base);
  cyclic.metadata.cycle = cyclic.metadata;
  const first = analyzeVoyageEncounterPressureBreachVoidScarProposalPlan(cyclic);
  const second = analyzeVoyageEncounterPressureBreachVoidScarProposalPlan(cyclic);
  assert.deepEqual(first, second);
  assert.equal(first.voidScarProposal, null);
  assert.ok(first.errors.some(({ code }) => (
    code === "pressure-breach-void-scar-plan-data-read-failed"
  )));
  assert.deepEqual(base, before);
});

test("successful breach application emits one isolated matching proposal without active Scar persistence", () => {
  const source = setPressure(oneNoRollConsequences([
    pressureRule("breach", { kind: "source-station" }, 1)
  ]), "crew-morale", 2);
  const before = structuredClone(source);
  const proposalPlan = analyzeVoyageEncounterPressureBreachVoidScarProposalPlan(source);

  const first = applyVoyageEncounterPressureBreachPlan(source);
  const second = applyVoyageEncounterPressureBreachPlan(source);

  assert.equal(first.ok, true);
  assert.deepEqual(first, second);
  assert.deepEqual(source, before);
  assert.equal(first.events.length, 1);
  assert.deepEqual(first.events[0].voidScarProposal, proposalPlan.voidScarProposal);
  assert.notEqual(first.events[0].voidScarProposal, proposalPlan.voidScarProposal);
  assert.notEqual(first.events[0].voidScarProposal, second.events[0].voidScarProposal);
  assert.equal(
    first.events[0].voidScarProposal.pressureBreachId,
    first.events[0].breach.pressureBreachId
  );
  assert.equal(
    first.events[0].voidScarProposal.hazardId,
    first.events[0].hazard.hazardId
  );
  assert.equal(Object.hasOwn(first, "voidScarProposal"), false);
  assert.equal(Object.hasOwn(first.nextState, "voidScars"), false);
  assert.deepEqual(first.nextState.permanentConsequences, source.permanentConsequences);

  for (const key of [
    "voidScar",
    "voidScars",
    "hullCapacity",
    "repair",
    "closeout",
    "persistence"
  ]) {
    assert.equal(Object.hasOwn(first, key), false, key);
    assert.equal(Object.hasOwn(first.events[0], key), false, `event.${key}`);
  }

  first.events[0].voidScarProposal.name = "Mutated";
  assert.equal(second.events[0].voidScarProposal.name, "Crew Morale Void Scar");
});

test("a deferred second breach produces no Void Scar proposal event or partial state", () => {
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
  assert.ok(result.errors.some(({ code }) => (
    code === "pressure-breach-application-multiple-breaches-deferred"
  )));
  assert.deepEqual(source, before);
});
