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
  analyzeVoyageEncounterPressureCloseoutReset,
  applyVoyageEncounterPressurePlan
} from "../../../scripts/voyage/domain/pressure.js";

const BRANCHES = ["critical-failure", "failure", "success", "critical-success"];
const PRESSURE_SYSTEM_IDS = ["crew-morale", "arkengine", "levstone-array", "solar-sail-rig", "lifeveil"];

function encounterState({
  encounterId = "pressure-application-encounter",
  stageId = "pressure-application-stage",
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
        : [{ approachId: `approach-${action.actionId}`, noRoll: true }];
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
    definitionId: "pressure-application-definition",
    primaryShip: { id: "pressure-application-ship" }
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
      branches: { "no-roll": effectRules.map(({ effectId }) => effectId) }
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

  const locked = applyVoyageEncounterCrewPlanningLock(working, { phaseStartSnapshotId: "pressure-application-lock" });
  assert.equal(locked.ok, true);
  const resolution = applyVoyageEncounterResolutionTransition(locked.nextState, { phaseStartSnapshotId: "pressure-application-resolution" });
  assert.equal(resolution.ok, true);
  const execution = prepareVoyageEncounterActionExecutionRequests(resolution.nextState);
  assert.equal(execution.readyForExecution, true);

  let resolved = resolution.nextState;
  const checkRequests = execution.executionRequests.filter(({ mode }) => mode === "check");
  if (checkRequests.length > 0) {
    const prepared = applyVoyageEncounterPendingCheckPreparation(resolved, {
      pendingCheckIds: checkRequests.map(({ sequence }) => ({
        sequence,
        pendingCheckId: `pressure-application-pending-${sequence}`
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
  const consequences = applyVoyageEncounterConsequencesTransition(resolved, { phaseStartSnapshotId: "pressure-application-consequences" });
  assert.equal(consequences.ok, true);
  return consequences.nextState;
}

function oneNoRollConsequences(effectRules = [], stationId = "captain") {
  return resolveToConsequences(encounterState({
    availableStations: [{ stationId, actions: [noRollAction("pressure-action", effectRules)] }],
    selections: { [stationId]: { stationId, actionId: "pressure-action" } }
  }));
}

function oneCheckConsequences(branch, effectRules = []) {
  return resolveToConsequences(encounterState({
    availableStations: [{ stationId: "captain", actions: [checkAction("pressure-check", branch, effectRules)] }],
    selections: { captain: { stationId: "captain", actionId: "pressure-check" } }
  }), [branch]);
}

function setPressure(state, pressureSystemId, value, capacity = state.pressureSystems[pressureSystemId].capacity) {
  state.pressureSystems[pressureSystemId].value = value;
  state.pressureSystems[pressureSystemId].capacity = capacity;
  return state;
}

function assertFailure(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  assert.ok(result.errors.some((entry) => entry.code === code), code);
}

function assertExactKeys(value, keys) {
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
}

test("standard and authored Pressure effects apply atomically with exact ordered arithmetic", () => {
  const standard = setPressure(oneCheckConsequences("failure"), "crew-morale", 0);
  const standardResult = applyVoyageEncounterPressurePlan(standard);
  assert.equal(standardResult.ok, true);
  assert.equal(standardResult.nextState.pressureSystems["crew-morale"].value, 1);

  const critical = setPressure(oneCheckConsequences("critical-failure"), "crew-morale", 0);
  assert.equal(applyVoyageEncounterPressurePlan(critical).nextState.pressureSystems["crew-morale"].value, 2);

  const positive = setPressure(oneNoRollConsequences([
    pressureRule("positive", { kind: "source-station" }, 1)
  ]), "crew-morale", 0);
  assert.equal(applyVoyageEncounterPressurePlan(positive).nextState.pressureSystems["crew-morale"].value, 1);

  const negative = setPressure(oneNoRollConsequences([
    pressureRule("negative", { kind: "source-station" }, -1)
  ]), "crew-morale", 1);
  assert.equal(applyVoyageEncounterPressurePlan(negative).nextState.pressureSystems["crew-morale"].value, 0);

  const floor = setPressure(oneNoRollConsequences([
    pressureRule("floor", { kind: "source-station" }, -5)
  ]), "crew-morale", 1);
  assert.equal(applyVoyageEncounterPressurePlan(floor).nextState.pressureSystems["crew-morale"].value, 0);

  const ordered = setPressure(oneNoRollConsequences([
    pressureRule("increase", { kind: "source-station" }, 1),
    pressureRule("decrease", { kind: "source-station" }, -1)
  ]), "crew-morale", 1);
  const orderedResult = applyVoyageEncounterPressurePlan(ordered);
  assert.equal(orderedResult.nextState.pressureSystems["crew-morale"].value, 1);
  assert.deepEqual(orderedResult.events[0].effects.map(({ sourceIntentId }) => sourceIntentId), [
    'arcflight-intent:["pressure-application-encounter","pressure-application-stage",1,0,"branch",0,"increase"]',
    'arcflight-intent:["pressure-application-encounter","pressure-application-stage",1,0,"branch",1,"decrease"]'
  ]);

  const independent = resolveToConsequences(encounterState({
    availableStations: [
      { stationId: "captain", actions: [noRollAction("captain-pressure", [pressureRule("captain", { kind: "source-station" }, 1)])] },
      { stationId: "engineer", actions: [noRollAction("engineer-pressure", [pressureRule("engineer", { kind: "source-station" }, 1)])] }
    ],
    selections: {
      captain: { stationId: "captain", actionId: "captain-pressure" },
      engineer: { stationId: "engineer", actionId: "engineer-pressure" }
    }
  }));
  const independentResult = applyVoyageEncounterPressurePlan(independent);
  assert.equal(independentResult.nextState.pressureSystems["crew-morale"].value, 1);
  assert.equal(independentResult.nextState.pressureSystems.arkengine.value, 1);
});

test("capacity equality, upgraded capacity, and ordered breach behavior are atomic", () => {
  const equality = setPressure(oneNoRollConsequences([
    pressureRule("equal", { kind: "source-station" }, 1)
  ]), "crew-morale", 1, 2);
  assert.equal(applyVoyageEncounterPressurePlan(equality).nextState.pressureSystems["crew-morale"].value, 2);

  const defaultOverflow = setPressure(oneNoRollConsequences([
    pressureRule("overflow", { kind: "source-station" }, 1)
  ]), "crew-morale", 2);
  const defaultFailure = applyVoyageEncounterPressurePlan(defaultOverflow);
  assertFailure(defaultFailure, "pressure-breach-required");
  assert.equal(defaultFailure.errors.length, 1);
  assert.match(defaultFailure.errors[0].message, /crew-morale/);

  const upgraded = setPressure(oneNoRollConsequences([
    pressureRule("upgrade", { kind: "source-station" }, 3)
  ]), "crew-morale", 2, 5);
  assert.equal(applyVoyageEncounterPressurePlan(upgraded).nextState.pressureSystems["crew-morale"].value, 5);

  const upgradedOverflow = setPressure(oneNoRollConsequences([
    pressureRule("upgrade-overflow", { kind: "source-station" }, 4)
  ]), "crew-morale", 2, 5);
  assertFailure(applyVoyageEncounterPressurePlan(upgradedOverflow), "pressure-breach-required");

  const laterReductionCannotRescue = setPressure(oneNoRollConsequences([
    pressureRule("breach-first", { kind: "source-station" }, 1),
    pressureRule("rescue-later", { kind: "source-station" }, -2)
  ]), "crew-morale", 2);
  const rescueFailure = applyVoyageEncounterPressurePlan(laterReductionCannotRescue);
  assertFailure(rescueFailure, "pressure-breach-required");
  assert.equal(rescueFailure.errors[0].path, "pressurePlan.effects[0]");

  const priorReduction = setPressure(oneNoRollConsequences([
    pressureRule("reduce-first", { kind: "source-station" }, -1),
    pressureRule("increase-second", { kind: "source-station" }, 1)
  ]), "crew-morale", 2);
  assert.equal(applyVoyageEncounterPressurePlan(priorReduction).nextState.pressureSystems["crew-morale"].value, 2);

  const standardBreach = setPressure(oneCheckConsequences("failure"), "crew-morale", 2);
  assertFailure(applyVoyageEncounterPressurePlan(standardBreach), "pressure-breach-required");

  const authoredBreach = setPressure(oneNoRollConsequences([
    pressureRule("authored-breach", { kind: "source-station" }, 1)
  ]), "crew-morale", 2);
  assertFailure(applyVoyageEncounterPressurePlan(authoredBreach), "pressure-breach-required");
});

test("a late breach discards simulated changes and preserves the exact source", () => {
  const source = setPressure(oneNoRollConsequences([
    pressureRule("first-safe", { kind: "source-station" }, 1),
    pressureRule("second-breach", { kind: "source-station" }, 2),
    pressureRule("third-never-seen", { kind: "source-station" }, -1)
  ]), "crew-morale", 0);
  const before = structuredClone(source);
  const result = applyVoyageEncounterPressurePlan(source);

  assertFailure(result, "pressure-breach-required");
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].path, "pressurePlan.effects[1]");
  assert.deepEqual(source, before);
  assert.equal(source.revision, before.revision);
});

test("successful application increments revision once, preserves unrelated state, and emits one exact isolated event", () => {
  const source = setPressure(oneNoRollConsequences([
    pressureRule("event-pressure", { kind: "source-station" }, 1, { timing: "end-of-round" })
  ]), "crew-morale", 0, 5);
  source.metadata.marker = "preserve";
  const before = structuredClone(source);
  const result = applyVoyageEncounterPressurePlan(source);

  assert.equal(result.ok, true);
  assert.notEqual(result.nextState, source);
  assert.equal(result.nextState.revision, source.revision + 1);
  assert.equal(result.events.length, 1);
  assertExactKeys(result, ["ok", "nextState", "events", "errors", "warnings"]);
  assertExactKeys(result.events[0], [
    "type", "encounterId", "lifecycleState", "stageId", "roundNumber", "phase",
    "pressureEffectCount", "standardPressureEffectCount", "authoredPressureEffectCount",
    "effects", "previousPressureSystems", "pressureSystems", "previousRevision", "revision"
  ]);
  assert.equal(result.events[0].type, "voyage.pressure-applied");
  assert.equal(result.events[0].pressureEffectCount, 1);
  assert.equal(result.events[0].standardPressureEffectCount, 0);
  assert.equal(result.events[0].authoredPressureEffectCount, 1);
  assert.equal(result.events[0].effects[0].timing, "end-of-round");
  assert.deepEqual(result.events[0].previousPressureSystems, before.pressureSystems);
  assert.deepEqual(result.events[0].pressureSystems, result.nextState.pressureSystems);
  assert.equal(result.events[0].previousRevision, before.revision);
  assert.equal(result.events[0].revision, result.nextState.revision);
  assert.deepEqual(source, before);
  assert.equal(result.nextState.metadata.marker, "preserve");

  result.events[0].effects[0].delta = 99;
  result.events[0].previousPressureSystems["crew-morale"].value = 99;
  result.events[0].pressureSystems["crew-morale"].value = 99;
  assert.deepEqual(result.nextState.pressureSystems["crew-morale"], { pressureSystemId: "crew-morale", value: 1, capacity: 5 });
  const eventAfterMutation = structuredClone(result.events[0]);

  result.nextState.pressureSystems["crew-morale"].value = 0;
  assert.deepEqual(result.events[0], eventAfterMutation);
});

test("empty valid plans succeed, preserve capacities, and remain deterministic", () => {
  const source = oneNoRollConsequences([]);
  setPressure(source, "crew-morale", 1, 5);
  const before = structuredClone(source);
  const first = applyVoyageEncounterPressurePlan(source);
  const second = applyVoyageEncounterPressurePlan(source);

  assert.equal(first.ok, true);
  assert.deepEqual(first, second);
  assert.equal(first.nextState.revision, before.revision + 1);
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0].pressureEffectCount, 0);
  assert.deepEqual(first.nextState.pressureSystems, before.pressureSystems);
  assert.deepEqual(source, before);
});

test("invalid planning, caller plans, final failures, and breach operations fail without partial output", () => {
  const invalid = encounterState({
    availableStations: [{ stationId: "captain", actions: [noRollAction("invalid")] }],
    selections: { captain: { stationId: "captain", actionId: "missing" } }
  });
  const invalidBefore = structuredClone(invalid);
  const invalidResult = applyVoyageEncounterPressurePlan(invalid, { effects: [] });
  assertFailure(invalidResult, "pressure-application-plan-not-ready");
  assert.deepEqual(invalid, invalidBefore);

  const malformed = oneNoRollConsequences([]);
  malformed.pressureSystems["crew-morale"].value = 99;
  const malformedResult = applyVoyageEncounterPressurePlan(malformed);
  assertFailure(malformedResult, "pressure-application-state-invalid");

  const revisionOverflow = oneNoRollConsequences([]);
  revisionOverflow.revision = Number.MAX_SAFE_INTEGER;
  const overflowResult = applyVoyageEncounterPressurePlan(revisionOverflow);
  assertFailure(overflowResult, "pressure-application-candidate-invalid");

  const noPartial = setPressure(oneNoRollConsequences([
    pressureRule("overflow", { kind: "source-station" }, 1)
  ]), "crew-morale", 2);
  const noPartialRevision = noPartial.revision;
  const noPartialResult = applyVoyageEncounterPressurePlan(noPartial);
  assert.equal(noPartialResult.nextState, null);
  assert.deepEqual(noPartialResult.events, []);
  assert.equal(noPartialResult.errors.length, 1);
  assert.equal(noPartial.revision, noPartialRevision);
});

test("application capture rejects hostile caller data atomically and deterministically", () => {
  const base = oneNoRollConsequences([]);
  const assertHostile = (candidate) => {
    const before = structuredClone(base);
    const first = applyVoyageEncounterPressurePlan(candidate);
    const second = applyVoyageEncounterPressurePlan(candidate);
    assert.deepEqual(first, second);
    assertFailure(first, "pressure-application-data-read-failed");
    assert.deepEqual(base, before);
  };

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
  assertHostile(accessor);
  assert.equal(getterReads, 0);

  let proxyReads = 0;
  const proxy = new Proxy(base, {
    get(target, key, receiver) {
      proxyReads += 1;
      return Reflect.get(target, key, receiver);
    }
  });
  const proxyResult = applyVoyageEncounterPressurePlan(proxy);
  assert.equal(proxyResult.ok, true);
  assert.equal(proxyResult.events.length, 1);
  assert.equal(proxyReads, 0);

  for (const hostileProxy of [
    new Proxy(base, { getPrototypeOf() { throw new Error("hostile prototype"); } }),
    new Proxy(base, { ownKeys() { throw new Error("hostile keys"); } }),
    new Proxy(base, { getOwnPropertyDescriptor() { throw new Error("hostile descriptor"); } })
  ]) {
    assertHostile(hostileProxy);
  }

  const cyclic = structuredClone(base);
  cyclic.cycle = cyclic;
  assertHostile(cyclic);

  const undefinedValue = structuredClone(base);
  undefinedValue.metadata = { undefinedValue: undefined };
  assertHostile(undefinedValue);

  const symbolValue = structuredClone(base);
  symbolValue[Symbol("hostile")] = true;
  assertHostile(symbolValue);

  const unsafeValue = structuredClone(base);
  Object.defineProperty(unsafeValue, "constructor", { enumerable: true, configurable: true, value: true });
  assertHostile(unsafeValue);

  const sparse = structuredClone(base);
  sparse.availableStations = [];
  sparse.availableStations[1] = { stationId: "captain", actions: [] };
  assertHostile(sparse);
});

test("successful application outputs are isolated across repeated unchanged calls", () => {
  const source = setPressure(oneNoRollConsequences([
    pressureRule("repeat", { kind: "source-station" }, 1)
  ]), "crew-morale", 0);
  const first = applyVoyageEncounterPressurePlan(source);
  const second = applyVoyageEncounterPressurePlan(source);
  assert.deepEqual(first, second);

  first.nextState.pressureSystems["crew-morale"].value = 99;
  first.events[0].effects[0].delta = 99;
  const fresh = applyVoyageEncounterPressurePlan(source);
  assert.deepEqual(fresh, second);
  assert.notEqual(first.nextState, fresh.nextState);
  assert.notEqual(first.events, fresh.events);
});

test("closeout reset planning reports canonical isolated reset records without mutation", () => {
  const zero = oneNoRollConsequences([]);
  const zeroBefore = structuredClone(zero);
  const zeroReport = analyzeVoyageEncounterPressureCloseoutReset(zero);
  assertExactKeys(zeroReport, ["structurallyValid", "readyForPressureCloseoutReset", "pressureSystemCount", "resetCount", "resets", "errors", "warnings"]);
  assert.equal(zeroReport.structurallyValid, true);
  assert.equal(zeroReport.readyForPressureCloseoutReset, true);
  assert.equal(zeroReport.pressureSystemCount, 5);
  assert.equal(zeroReport.resetCount, 0);
  assert.deepEqual(zeroReport.resets, []);
  assert.deepEqual(zero, zeroBefore);

  const one = oneNoRollConsequences([]);
  setPressure(one, "lifeveil", 3, 5);
  const oneReport = analyzeVoyageEncounterPressureCloseoutReset(one);
  assert.deepEqual(oneReport.resets, [{ pressureSystemId: "lifeveil", previousValue: 3, nextValue: 0, capacity: 5 }]);

  const all = oneNoRollConsequences([]);
  PRESSURE_SYSTEM_IDS.forEach((pressureSystemId, index) => setPressure(all, pressureSystemId, index + 1, Math.min(index + 2, 5)));
  const allReport = analyzeVoyageEncounterPressureCloseoutReset(all);
  assert.equal(allReport.resetCount, 5);
  assert.deepEqual(allReport.resets.map(({ pressureSystemId }) => pressureSystemId), PRESSURE_SYSTEM_IDS);
  assert.deepEqual(allReport.resets.map(({ nextValue }) => nextValue), [0, 0, 0, 0, 0]);
  assert.deepEqual(allReport.resets.map(({ capacity }) => capacity), [2, 3, 4, 5, 5]);
  assert.equal(allReport.resets.some(({ previousValue }) => previousValue === 0), false);
  assert.equal(all.revision, 3);
  assert.equal(all.pressureSystems["crew-morale"].value, 1);
});

test("closeout reset analysis is pure, deterministic, lifecycle-independent, and isolated", () => {
  const source = oneNoRollConsequences([]);
  setPressure(source, "crew-morale", 2);
  source.lifecycleState = "draft";
  source.currentStage = null;
  source.roundNumber = null;
  source.phase = null;
  const before = structuredClone(source);
  const first = analyzeVoyageEncounterPressureCloseoutReset(source);
  const second = analyzeVoyageEncounterPressureCloseoutReset(source);
  assert.deepEqual(first, second);
  assert.equal(first.readyForPressureCloseoutReset, true);
  assert.equal(first.resetCount, 1);
  first.resets[0].previousValue = 99;
  const fresh = analyzeVoyageEncounterPressureCloseoutReset(source);
  assert.deepEqual(fresh, second);
  assert.deepEqual(source, before);
  assert.deepEqual(source.pressureSystems["crew-morale"], before.pressureSystems["crew-morale"]);
  assert.deepEqual(first.errors, []);
  assert.deepEqual(first.warnings, []);
});

test("invalid and hostile closeout states return atomic empty reports", () => {
  const invalid = oneNoRollConsequences([]);
  invalid.pressureSystems["crew-morale"].value = 99;
  const invalidReport = analyzeVoyageEncounterPressureCloseoutReset(invalid);
  assert.equal(invalidReport.readyForPressureCloseoutReset, false);
  assert.equal(invalidReport.pressureSystemCount, 0);
  assert.equal(invalidReport.resetCount, 0);
  assert.deepEqual(invalidReport.resets, []);
  assert.ok(invalidReport.errors.some(({ code }) => code === "pressure-closeout-reset-state-invalid"));

  const base = oneNoRollConsequences([]);
  const assertHostile = (candidate) => {
    const first = analyzeVoyageEncounterPressureCloseoutReset(candidate);
    const second = analyzeVoyageEncounterPressureCloseoutReset(candidate);
    assert.deepEqual(first, second);
    assert.equal(first.readyForPressureCloseoutReset, false);
    assert.equal(first.pressureSystemCount, 0);
    assert.equal(first.resetCount, 0);
    assert.deepEqual(first.resets, []);
    assert.ok(first.errors.length > 0);
  };

  let reads = 0;
  const accessor = structuredClone(base);
  Object.defineProperty(accessor, "pressureSystems", {
    enumerable: true,
    configurable: true,
    get() {
      reads += 1;
      return base.pressureSystems;
    }
  });
  assertHostile(accessor);
  assert.equal(reads, 0);

  let proxyReads = 0;
  const proxy = new Proxy(base, { get(target, key, receiver) { proxyReads += 1; return Reflect.get(target, key, receiver); } });
  const proxyReport = analyzeVoyageEncounterPressureCloseoutReset(proxy);
  assert.equal(proxyReport.readyForPressureCloseoutReset, true);
  assert.equal(proxyReport.pressureSystemCount, 5);
  assert.equal(proxyReads, 0);

  const cyclic = structuredClone(base);
  cyclic.metadata.cycle = cyclic.metadata;
  assertHostile(cyclic);

  const undefinedValue = structuredClone(base);
  undefinedValue.metadata = { undefinedValue: undefined };
  assertHostile(undefinedValue);

  const symbolValue = structuredClone(base);
  symbolValue[Symbol("hostile")] = true;
  assertHostile(symbolValue);

  const unsafeValue = structuredClone(base);
  Object.defineProperty(unsafeValue, "constructor", { enumerable: true, configurable: true, value: true });
  assertHostile(unsafeValue);

  const sparse = structuredClone(base);
  sparse.availableStations = [];
  sparse.availableStations[1] = { stationId: "captain", actions: [] };
  assertHostile(sparse);
});

test("closeout reset planning does not create closeout, Hazard, Breach, Scar, or event effects", () => {
  const source = oneNoRollConsequences([]);
  setPressure(source, "crew-morale", 1);
  const before = structuredClone(source);
  const report = analyzeVoyageEncounterPressureCloseoutReset(source);
  assert.equal(report.readyForPressureCloseoutReset, true);
  assert.equal(Object.hasOwn(report, "events"), false);
  assert.equal(Object.hasOwn(report, "hazards"), false);
  assert.equal(Object.hasOwn(report, "breaches"), false);
  assert.equal(Object.hasOwn(report, "voidScars"), false);
  assert.deepEqual(source, before);
});
