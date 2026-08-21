import assert from "node:assert/strict";
import test from "node:test";

import { CORE_HULLS, CORE_HULL_PLATFORM_KEYS } from "../../../data/hulls/core-hulls.js";
import {
  createVoyageBreachSavePending,
  analyzeVoyageEncounterBreachSavePlan,
  resolveVoyageBreachSave,
  resolveVoyageEventBreachDc,
  validateVoyageBreachSavePending,
  classifyVoyageBreachSaveRoll
} from "../../../scripts/voyage/domain/breach-save.js";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { applyVoyageEncounterCrewPlanningLock } from "../../../scripts/voyage/domain/crew-planning-lock.js";
import { applyVoyageEncounterResolutionTransition } from "../../../scripts/voyage/domain/resolution-transition.js";
import { prepareVoyageEncounterActionExecutionRequests } from "../../../scripts/voyage/domain/resolution-execution-requests.js";
import { prepareVoyageEncounterResolutionCompletion } from "../../../scripts/voyage/domain/resolution-completion.js";
import { applyVoyageEncounterConsequencesTransition } from "../../../scripts/voyage/domain/consequences-transition.js";
import { getM12EventDefinition, validateM12EventDefinition } from "../../../scripts/voyage/m12/event-definition.js";
import { analyzeVoyageEncounterOverallResult } from "../../../scripts/voyage/domain/event-result.js";

globalThis.foundry = {
  utils: {
    deepClone: (value) => structuredClone(value),
    mergeObject: (target, source, options = {}) => {
      const output = options.inplace === false ? structuredClone(target) : target;
      const merge = (left, right) => {
        for (const [key, value] of Object.entries(right ?? {})) {
          if (value && typeof value === "object" && !Array.isArray(value) && left[key] && typeof left[key] === "object" && !Array.isArray(left[key])) merge(left[key], value);
          else left[key] = structuredClone(value);
        }
        return left;
      };
      return merge(output, source);
    }
  }
};
const { calculateDerivedShipStats, arcflightShipDefaults } = await import("../../../scripts/documents/ships.js");

function breach(overrides = {}) {
  return {
    pressureBreachId: "arcflight-pressure-breach:test",
    encounterId: "encounter-1",
    stageId: "stage-1",
    roundNumber: 1,
    effectIndex: 0,
    sequence: 0,
    stationId: "captain",
    actionId: "action-1",
    pressureSystemId: "crew-morale",
    pressureEffectId: "effect-1",
    sourceKind: "standard-result",
    sourceIntentId: null,
    activationSource: null,
    branch: "failure",
    timing: "consequences",
    visibility: "public",
    previousValue: 2,
    capacity: 2,
    remainingCapacity: 0,
    attemptedDelta: 1,
    overflowDelta: 1,
    ...overrides
  };
}

function pending(overrides = {}) {
  return createVoyageBreachSavePending({
    encounterId: "encounter-1",
    roundId: "m12-round-1",
    roundNumber: 1,
    breach: breach(overrides.breach),
    breachSaveModifier: 2,
    breachDC: 21,
    originatingEffectId: "effect-1",
    ...overrides
  });
}

function breachFixture({ incomingPressure = 1, effectRules = null } = {}) {
  const state = createVoyageEncounterState({
    encounterId: "breach-save-encounter",
    definitionId: "breach-save-definition",
    primaryShip: { id: "breach-save-ship" }
  });
  state.lifecycleState = "active";
  state.currentStage = { stageId: "breach-save-stage" };
  state.roundNumber = 1;
  state.phase = "crew-planning";
  state.availableStations = [{
    stationId: "captain",
    actions: [{
      actionId: "breach-save-action",
      approaches: [{ approachId: "breach-save-approach", noRoll: true }],
      outcomeDefinition: { effectRules: effectRules ?? [{ effectId: "breach-save-effect", intentType: "pressure-change", timing: "consequences", visibility: "public", target: { kind: "source-station" }, payload: { delta: incomingPressure } }], branches: { "no-roll": (effectRules ?? [{ effectId: "breach-save-effect" }]).map((effect) => effect.effectId) } }
    }]
  }];
  state.stationAssignments = [{ stationId: "captain", operator: { kind: "actor", uuid: "Actor.breach-save" } }];
  state.selections = { captain: { stationId: "captain", actionId: "breach-save-action", approachId: "breach-save-approach", noRoll: true } };
  state.proposedStationOrder = ["captain"];
  state.committedStationOrder = [];
  const locked = applyVoyageEncounterCrewPlanningLock(state, { phaseStartSnapshotId: "breach-save-lock" });
  assert.equal(locked.ok, true);
  const resolution = applyVoyageEncounterResolutionTransition(locked.nextState, { phaseStartSnapshotId: "breach-save-resolution" });
  assert.equal(resolution.ok, true);
  const execution = prepareVoyageEncounterActionExecutionRequests(resolution.nextState);
  assert.equal(execution.readyForExecution, true);
  const completion = prepareVoyageEncounterResolutionCompletion(resolution.nextState);
  assert.equal(completion.readyForConsequences, true);
  const consequences = applyVoyageEncounterConsequencesTransition(resolution.nextState, { phaseStartSnapshotId: "breach-save-consequences" });
  assert.equal(consequences.ok, true);
  return consequences.nextState;
}

function breachPlanFor({ currentPressure, capacity, incomingPressure = 1, breachSaveModifier = 2, effectRules = null } = {}) {
  const state = breachFixture({ incomingPressure, effectRules });
  state.pressureSystems["crew-morale"].value = currentPressure;
  state.pressureSystems["crew-morale"].capacity = capacity;
  return analyzeVoyageEncounterBreachSavePlan(state, {
    eventDefinition: { breachDC: 21 },
    roundId: "m12-round-1",
    roundNumber: 1,
    breachSaveModifier,
    originatingEffectId: "breach-save-effect"
  });
}
test("all locked core hulls carry restrained finite Breach Save modifiers", () => {
  assert.deepEqual(CORE_HULL_PLATFORM_KEYS, ["void-skiff", "sloop", "cutter", "brigantine", "frigate", "galleon", "hammerhead", "arkcruiser", "dread-caravel", "cathedral-ship", "leviathan-class-platform"]);
  for (const key of CORE_HULL_PLATFORM_KEYS) assert.equal(Number.isFinite(CORE_HULLS[key].breachSaveModifier), true, key);
  const expected = { "void-skiff": 7, sloop: 8, cutter: 9, brigantine: 10, frigate: 11, galleon: 11, hammerhead: 12, arkcruiser: 13, "dread-caravel": 13, "cathedral-ship": 14, "leviathan-class-platform": 15 };
  for (const key of CORE_HULL_PLATFORM_KEYS) assert.equal(calculateDerivedShipStats({ hull: CORE_HULLS[key], arkengine: {}, coreRooms: [] }, {}).breachSaveModifier, expected[key], key);
  assert.deepEqual(Object.fromEntries(CORE_HULL_PLATFORM_KEYS.map((key) => [key, CORE_HULLS[key].breachSaveModifier])), {
    "void-skiff": 7, sloop: 8, cutter: 9, brigantine: 10, frigate: 11, galleon: 11, hammerhead: 12, arkcruiser: 13, "dread-caravel": 13, "cathedral-ship": 14, "leviathan-class-platform": 15
  });
});

test("hull and recalculated derived ship state carry the distinct modifier", () => {
  const base = { hull: CORE_HULLS.brigantine, arkengine: {}, coreRooms: [] };
  const derived = calculateDerivedShipStats(base, {});
  assert.equal(derived.breachSaveModifier, 10);
  const replacement = calculateDerivedShipStats({ hull: CORE_HULLS.leviathanClassPlatform ?? CORE_HULLS["leviathan-class-platform"], arkengine: {}, coreRooms: [] }, {});
  assert.equal(replacement.breachSaveModifier, 15);
  assert.equal(arcflightShipDefaults.derived.breachSaveModifier, 0);
  const legacyBase = { hull: { ...CORE_HULLS.brigantine } };
  delete legacyBase.hull.breachSaveModifier;
  assert.equal(calculateDerivedShipStats(legacyBase, {}).breachSaveModifier, 0);
});

test("authored Event breachDC is stable and fallback uses only authored base action DC", () => {
  assert.deepEqual(resolveVoyageEventBreachDc({ breachDC: 24 }), { ok: true, value: 24, source: "authored", errors: [] });
  assert.equal(resolveVoyageEventBreachDc({ breachDC: 0 }).ok, false);
  const definition = { rounds: [{ availableStations: [{ actions: [{ check: { dcSource: { kind: "fixed", value: 18 } } }, { check: { dcSource: { kind: "fixed", value: 22 } } }] }] }] };
  assert.deepEqual(resolveVoyageEventBreachDc(definition), { ok: true, value: 18, source: "authored-action-base-dc-fallback", errors: [] });
  assert.equal(resolveVoyageEventBreachDc({ rounds: [{ availableStations: [] }] }).value, 18);
  const riskBidDefinition = { rounds: [{ availableStations: [{ actions: [{ check: { dcSource: { kind: "fixed", value: 18 }, dcAdjustment: 8, temporaryDcReduction: 5 }, riskBidPresentation: { "8": { dc: 26 } } }] }] }] };
  assert.equal(resolveVoyageEventBreachDc(riskBidDefinition).value, 18);
});

test("pending Breach Save resolves all four degrees with exact once-only evidence", () => {
  const criticalSuccess = resolveVoyageBreachSave(pending(), "critical-success");
  assert.equal(criticalSuccess.ok, true); assert.equal(criticalSuccess.pressureValue, 1); assert.equal(criticalSuccess.breach, null); assert.equal(criticalSuccess.hazard, null); assert.equal(criticalSuccess.voidScarProposal, null);
  const success = resolveVoyageBreachSave(pending(), "success");
  assert.equal(success.ok, true); assert.equal(success.pressureValue, 2); assert.equal(success.requiresExistingPressureBreach, false);
  for (const degree of ["failure", "critical-failure"]) {
    const failed = resolveVoyageBreachSave(pending(), degree);
    assert.equal(failed.ok, true); assert.equal(failed.requiresExistingPressureBreach, true); assert.equal(failed.breach.pressureBreachId, "arcflight-pressure-breach:test");
    const applied = resolveVoyageBreachSave(pending(), degree, { pressureBreachResult: { ok: true, breach: breach(), hazard: { hazardId: "hazard-1" }, ordinaryScarProposal: { voidScarProposalId: "scar-1" } } });
    assert.equal(applied.ok, true); assert.equal(applied.outcome, "breach"); assert.equal(applied.hazard.hazardId, "hazard-1");
  }
  assert.equal(resolveVoyageBreachSave(success.pendingBreachSave, "success").ok, false);
});

test("pending evidence is isolated and hostile or mismatched resolution fails closed", () => {
  const source = pending(); const captured = validateVoyageBreachSavePending(source); assert.equal(captured.valid, true);
  source.pressureBreach.pressureSystemId = "arkengine";
  assert.equal(captured.value.pressureBreach.pressureSystemId, "crew-morale");
  const cycle = pending(); cycle.pressureBreach.cycle = cycle; assert.equal(validateVoyageBreachSavePending(cycle).valid, false);
  assert.equal(resolveVoyageBreachSave(pending(), "success", { expectedSystemId: "arkengine" }).ok, false);
  assert.equal(resolveVoyageBreachSave(pending(), "success", { expectedRoundId: "m12-round-2" }).ok, false);
  assert.equal(resolveVoyageBreachSave(pending(), "not-a-degree").ok, false);
});
test("Breach Save planner follows the canonical 0/2, 1/2, 2/2, and 3/3 threat matrix", () => {
  for (const [currentPressure, capacity, incomingPressure, expected] of [
    [0, 2, 1, false],
    [1, 2, 1, false],
    [2, 2, 1, true],
    [3, 3, 1, true],
    [2, 2, 2, true]
  ]) {
    const report = breachPlanFor({ currentPressure, capacity, incomingPressure });
    assert.equal(report.ok, true);
    assert.equal(report.requiresBreachSave, expected, String(currentPressure) + "/" + String(capacity) + "+" + String(incomingPressure));
    assert.equal(report.pressureBreachPlan.breachRequired, expected);
    if (expected) assert.equal(report.pending.breachSaveModifier, 2);
  }
});

test("Breach Save planning remains pure and keeps existing Breach analysis as the source seam", () => {
  const source = breachPlanFor({ currentPressure: 2, capacity: 2, incomingPressure: 1 });
  assert.equal(source.ok, true);
  assert.equal(source.pending.status, "pending");
  assert.equal(source.pending.pressureBreachId, source.pressureBreachPlan.breach.pressureBreachId);
  const again = breachPlanFor({ currentPressure: 2, capacity: 2, incomingPressure: 1 });
  assert.deepEqual(again.pending, source.pending);
});

test("prevented incoming Pressure is processed before Breach Save planning", () => {
  const report = breachPlanFor({
    currentPressure: 2,
    capacity: 2,
    effectRules: [
      { effectId: "reduce-first", intentType: "pressure-change", timing: "consequences", visibility: "public", target: { kind: "source-station" }, payload: { delta: -1 } },
      { effectId: "gain-after-reduction", intentType: "pressure-change", timing: "consequences", visibility: "public", target: { kind: "source-station" }, payload: { delta: 1 } }
    ]
  });
  assert.equal(report.ok, true);
  assert.equal(report.requiresBreachSave, false);
  assert.equal(report.pressureBreachPlan.breachRequired, false);
});

test("redirected Pressure threatens the final authoritative target", () => {
  const report = breachPlanFor({
    currentPressure: 0,
    capacity: 2,
    effectRules: [{
      effectId: "redirected-gain",
      intentType: "pressure-change",
      timing: "consequences",
      visibility: "public",
      target: { kind: "pressure-system", targetId: "arkengine" },
      payload: { delta: 3 }
    }]
  });
  assert.equal(report.ok, true);
  assert.equal(report.requiresBreachSave, true);
  assert.equal(report.pending.systemId, "arkengine");
  assert.equal(report.pending.pressureBreach.pressureSystemId, "arkengine");
});
test("Breach Save PF2e classification honors degrees and natural face rules", () => {
  assert.equal(classifyVoyageBreachSaveRoll({ d20: 10, total: 21, dc: 21 }).degreeOfSuccessSlug, "success");
  assert.equal(classifyVoyageBreachSaveRoll({ d20: 20, total: 21, dc: 21 }).degreeOfSuccessSlug, "critical-success");
  assert.equal(classifyVoyageBreachSaveRoll({ d20: 1, total: 31, dc: 21 }).degreeOfSuccessSlug, "success");
  assert.equal(classifyVoyageBreachSaveRoll({ d20: 10, total: 12, dc: 21 }).degreeOfSuccessSlug, "failure");
  assert.equal(classifyVoyageBreachSaveRoll({ d20: 1, total: 12, dc: 21 }).degreeOfSuccessSlug, "critical-failure");
  assert.equal(classifyVoyageBreachSaveRoll({ d20: 21, total: 21, dc: 21 }), null);
});
test("M12 immutable Event Definition captures and validates breachDC", () => {
  const definition = getM12EventDefinition();
  assert.equal(definition.breachDC, 21);
  assert.equal(validateM12EventDefinition(definition).valid, true);
  const copy = getM12EventDefinition();
  copy.breachDC = 22;
  assert.equal(getM12EventDefinition().breachDC, 21);
  assert.equal(validateM12EventDefinition({ ...definition, breachDC: 0 }).valid, false);
  assert.equal(validateM12EventDefinition({ ...definition, breachDC: "21" }).valid, false);
  const legacy = { ...definition };
  delete legacy.breachDC;
  assert.equal(validateM12EventDefinition(legacy).valid, false);
});
test("generic Event Definitions keep breachDC optional while fallback remains deterministic", () => {
  const definition = {
    schemaVersion: 1,
    eventId: "generic-event",
    definitionSnapshotId: "generic-v1",
    roundCount: 3,
    rounds: [
      { roundId: "round-1", roundNumber: 1 },
      { roundId: "round-2", roundNumber: 2 },
      { roundId: "round-3", roundNumber: 3 }
    ],
    rewards: [],
    enhancements: [],
    misfortuneEnhancements: [],
    misfortunes: [],
    nextSituations: []
  };
  const history = {
    schemaVersion: 1,
    eventId: definition.eventId,
    sessionId: "generic-session",
    definitionSnapshotId: definition.definitionSnapshotId,
    roundCount: 3,
    rounds: definition.rounds.map((round) => ({ ...round, roundResult: "round-success" }))
  };
  const result = analyzeVoyageEncounterOverallResult({
    kind: "m8-overall-result",
    sessionId: history.sessionId,
    eventDefinition: definition,
    completedRoundHistory: history
  });
  assert.equal(result.ok, true);
  assert.equal(resolveVoyageEventBreachDc(definition).value, 18);
});