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
  applyVoyageEncounterPressureBreachPlan
} from "../../../scripts/voyage/domain/pressure-breach.js";

const BRANCHES = ["critical-failure", "failure", "success", "critical-success"];

const PRESSURE_BREACH_EVENT_KEYS = [
  "type",
  "encounterId",
  "lifecycleState",
  "stageId",
  "roundNumber",
  "phase",
  "pressureEffectCount",
  "appliedEffectCount",
  "breach",
  "hazard",
  "collisionOutcome",
  "voidScarProposal",
  "pressureReset",
  "effects",
  "previousPressureSystems",
  "pressureSystems",
  "previousRevision",
  "revision"
];

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


test("applies one standard Pressure breach atomically with the exact event contract", () => {
  const source = setPressure(oneCheckConsequences("failure"), "crew-morale", 2);
  const before = structuredClone(source);
  const planned = analyzeVoyageEncounterPressureBreachPlan(source);
  const previousRevision = source.revision;

  const result = applyVoyageEncounterPressureBreachPlan(source);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.events.length, 1);
  assert.deepEqual(source, before);
  assert.notEqual(result.nextState, source);
  assert.equal(result.nextState.revision, previousRevision + 1);
  assert.equal(result.nextState.lifecycleState, source.lifecycleState);
  assert.equal(result.nextState.phase, source.phase);
  assert.equal(result.nextState.pressureSystems["crew-morale"].value, 0);
  assert.equal(result.nextState.pressureSystems["crew-morale"].capacity, 2);

  const event = result.events[0];
  assert.deepEqual(Object.keys(event), PRESSURE_BREACH_EVENT_KEYS);
  assertExactKeys(event, [
    "type",
    "encounterId",
    "lifecycleState",
    "stageId",
    "roundNumber",
    "phase",
    "pressureEffectCount",
    "appliedEffectCount",
    "breach",
    "hazard",
    "collisionOutcome",
    "voidScarProposal",
    "pressureReset",
    "effects",
    "previousPressureSystems",
    "pressureSystems",
    "previousRevision",
    "revision"
  ]);
  assert.equal(event.type, "voyage.pressure-breach-applied");
  assert.equal(event.encounterId, source.encounterId);
  assert.equal(event.lifecycleState, source.lifecycleState);
  assert.equal(event.stageId, source.currentStage.stageId);
  assert.equal(event.roundNumber, source.roundNumber);
  assert.equal(event.phase, source.phase);
  assert.equal(event.pressureEffectCount, 1);
  assert.equal(event.appliedEffectCount, 1);
  assert.equal(event.collisionOutcome, null);
  for (const key of ["metadata", "collision", "consequence", "collisionOutcome"]) {
    assert.equal(Object.hasOwn(event.hazard, key), false, `event.hazard.${key}`);
  }
  assert.deepEqual(event.breach, planned.breach);
  assert.equal(event.hazard.pressureBreachId, planned.breach.pressureBreachId);
  assert.equal(event.hazard.pressureSystemId, planned.breach.pressureSystemId);
  assert.equal(event.hazard.category, "system");
  assert.equal(event.hazard.status, "active");
  assert.equal(event.hazard.sourceKind, "pressure-breach");
  assert.equal(event.hazard.name, "Crew Morale Breach");
  assert.equal(event.voidScarProposal.pressureBreachId, planned.breach.pressureBreachId);
  assert.equal(event.voidScarProposal.hazardId, event.hazard.hazardId);
  assert.equal(event.voidScarProposal.pressureSystemId, planned.breach.pressureSystemId);
  assert.equal(event.voidScarProposal.consequenceKind, "void-scar");
  assert.equal(event.voidScarProposal.status, "proposed");
  assert.equal(event.voidScarProposal.persistence, "lasting");
  assert.equal(event.voidScarProposal.sourceKind, "pressure-breach");
  assert.equal(event.voidScarProposal.name, "Crew Morale Void Scar");
  assert.deepEqual(event.pressureReset, {
    pressureBreachId: planned.breach.pressureBreachId,
    pressureSystemId: "crew-morale",
    previousValue: 2,
    resetValue: 0
  });
  assert.equal(event.effects.length, 1);
  assert.equal(event.previousPressureSystems["crew-morale"].value, 2);
  assert.equal(event.pressureSystems["crew-morale"].value, 0);
  assert.equal(event.previousRevision, previousRevision);
  assert.equal(event.revision, previousRevision + 1);
  assert.notEqual(event.pressureSystems, result.nextState.pressureSystems);
  assert.notEqual(event.breach, planned.breach);
  assert.notEqual(event.hazard, planned.breach);
  assert.notEqual(event.voidScarProposal, event.hazard);
});

test("applies safe Pressure effects before and after the first breach in exact order", () => {
  const source = oneNoRollConsequences([
    pressureRule("lifeveil-before", { kind: "pressure-system", targetId: "lifeveil" }, 1),
    pressureRule("crew-breach", { kind: "source-station" }, 1),
    pressureRule("crew-after-reset", { kind: "source-station" }, 2),
    pressureRule("lifeveil-after", { kind: "pressure-system", targetId: "lifeveil" }, -2)
  ]);
  setPressure(source, "crew-morale", 2);
  setPressure(source, "lifeveil", 1);
  const before = structuredClone(source);
  const planned = analyzeVoyageEncounterPressureBreachPlan(source);

  assert.equal(planned.breachRequired, true);
  assert.equal(planned.breach.effectIndex, 1);

  const result = applyVoyageEncounterPressureBreachPlan(source);

  assert.equal(result.ok, true);
  assert.equal(result.events[0].pressureEffectCount, 4);
  assert.equal(result.events[0].appliedEffectCount, 4);
  assert.equal(result.events[0].breach.effectIndex, 1);
  assert.match(result.events[0].breach.pressureEffectId, /crew-breach/);
  assert.equal(result.nextState.pressureSystems["crew-morale"].value, 2);
  assert.equal(result.nextState.pressureSystems.lifeveil.value, 0);
  assert.deepEqual(
    result.events[0].effects.map(({ pressureSystemId, delta }) => ({ pressureSystemId, delta })),
    [
      { pressureSystemId: "lifeveil", delta: 1 },
      { pressureSystemId: "crew-morale", delta: 1 },
      { pressureSystemId: "crew-morale", delta: 2 },
      { pressureSystemId: "lifeveil", delta: -2 }
    ]
  );
  assert.deepEqual(source, before);
});

test("a Pressure plan with two breach effects remains unsupported and fails atomically", () => {
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

test("no-breach, not-ready, and invalid states fail without partial output", () => {
  const noBreach = setPressure(oneNoRollConsequences([
    pressureRule("safe", { kind: "source-station" }, 1)
  ]), "crew-morale", 0);
  const noBreachBefore = structuredClone(noBreach);
  const noBreachResult = applyVoyageEncounterPressureBreachPlan(noBreach);
  assert.equal(noBreachResult.ok, false);
  assert.equal(noBreachResult.nextState, null);
  assert.deepEqual(noBreachResult.events, []);
  assert.ok(noBreachResult.errors.some(({ code }) => code === "pressure-breach-application-not-required"));
  assert.deepEqual(noBreach, noBreachBefore);

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
  const notReadyResult = applyVoyageEncounterPressureBreachPlan(notReady);
  assert.equal(notReadyResult.ok, false);
  assert.equal(notReadyResult.nextState, null);
  assert.deepEqual(notReadyResult.events, []);
  assert.ok(notReadyResult.errors.some(({ code }) => code === "pressure-breach-application-plan-not-ready"));
  assert.deepEqual(notReady, notReadyBefore);

  const invalid = oneNoRollConsequences([]);
  invalid.pressureSystems["crew-morale"].value = 99;
  const invalidBefore = structuredClone(invalid);
  const invalidResult = applyVoyageEncounterPressureBreachPlan(invalid);
  assert.equal(invalidResult.ok, false);
  assert.equal(invalidResult.nextState, null);
  assert.deepEqual(invalidResult.events, []);
  assert.ok(invalidResult.errors.some(({ code }) => code === "pressure-breach-plan-state-invalid"));
  assert.deepEqual(invalid, invalidBefore);
});

test("application capture rejects hostile caller data without executing getters or Proxy get traps", () => {
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
  const accessorResult = applyVoyageEncounterPressureBreachPlan(accessor);
  assert.equal(accessorResult.ok, false);
  assert.ok(accessorResult.errors.some(({ code }) => code === "pressure-breach-application-data-read-failed"));
  assert.equal(getterReads, 0);

  let proxyReads = 0;
  const proxy = new Proxy(base, {
    get(target, key, receiver) {
      proxyReads += 1;
      return Reflect.get(target, key, receiver);
    }
  });
  const proxyResult = applyVoyageEncounterPressureBreachPlan(proxy);
  assert.equal(proxyResult.ok, true);
  assert.equal(proxyReads, 0);

  const cyclic = structuredClone(base);
  cyclic.metadata.cycle = cyclic.metadata;
  const first = applyVoyageEncounterPressureBreachPlan(cyclic);
  const second = applyVoyageEncounterPressureBreachPlan(cyclic);
  assert.deepEqual(first, second);
  assert.equal(first.ok, false);
  assert.equal(first.nextState, null);
  assert.deepEqual(first.events, []);
  assert.ok(first.errors.some(({ code }) => code === "pressure-breach-application-data-read-failed"));

  assert.deepEqual(base, before);
});

test("revision overflow fails atomically without a breach event", () => {
  const source = setPressure(oneNoRollConsequences([
    pressureRule("breach", { kind: "source-station" }, 1)
  ]), "crew-morale", 2);
  source.revision = Number.MAX_SAFE_INTEGER;
  const before = structuredClone(source);

  const result = applyVoyageEncounterPressureBreachPlan(source);

  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  assert.ok(result.errors.some(({ code, path }) => (
    code === "pressure-breach-application-candidate-invalid"
    && path === "nextState.revision"
  )));
  assert.deepEqual(source, before);
});

test("successful breach outputs are deterministic, isolated, and contain no deferred active systems", () => {
  const source = setPressure(oneNoRollConsequences([
    pressureRule("breach", { kind: "source-station" }, 1)
  ]), "crew-morale", 2);
  const before = structuredClone(source);

  const first = applyVoyageEncounterPressureBreachPlan(source);
  const second = applyVoyageEncounterPressureBreachPlan(source);

  assert.equal(first.ok, true);
  assert.deepEqual(first, second);
  assert.deepEqual(source, before);
  assert.notEqual(first.nextState, second.nextState);
  assert.notEqual(first.events[0], second.events[0]);
  assert.notEqual(first.events[0].breach, second.events[0].breach);
  assert.notEqual(first.events[0].hazard, second.events[0].hazard);
  assert.notEqual(first.events[0].voidScarProposal, second.events[0].voidScarProposal);
  assert.notEqual(first.events[0].effects, second.events[0].effects);

  assert.equal(Object.hasOwn(first, "hazard"), false);
  assert.equal(Object.hasOwn(first, "voidScarProposal"), false);
  assert.equal(Object.hasOwn(first.events[0], "hazard"), true);
  assert.equal(Object.hasOwn(first.events[0], "voidScarProposal"), true);

  for (const key of [
    "hazards",
    "voidScar",
    "voidScars",
    "permanentConsequenceProposal",
    "closeout",
    "persistence"
  ]) {
    assert.equal(Object.hasOwn(first, key), false, key);
    assert.equal(Object.hasOwn(first.events[0], key), false, `event.${key}`);
  }

  first.nextState.pressureSystems["crew-morale"].value = 2;
  first.events[0].pressureSystems["crew-morale"].value = 2;
  first.events[0].breach.previousValue = 0;
  first.events[0].hazard.name = "Mutated";
  first.events[0].voidScarProposal.name = "Mutated";
  first.events[0].effects[0].delta = 99;

  assert.equal(source.pressureSystems["crew-morale"].value, 2);
  assert.equal(second.nextState.pressureSystems["crew-morale"].value, 0);
  assert.equal(second.events[0].pressureSystems["crew-morale"].value, 0);
  assert.equal(second.events[0].breach.previousValue, 2);
  assert.equal(second.events[0].hazard.name, "Crew Morale Breach");
  assert.equal(second.events[0].voidScarProposal.name, "Crew Morale Void Scar");
  assert.equal(second.events[0].effects[0].delta, 1);
});
