import assert from "node:assert/strict";
import test from "node:test";

import {
  VOYAGE_HAZARD_CATEGORIES,
  VOYAGE_HAZARD_COLLISION_POLICIES,
  VOYAGE_HAZARD_DURATION_MODES,
  VOYAGE_HAZARD_ESCALATION_MODES,
  VOYAGE_HAZARD_STATUSES,
  VOYAGE_HAZARD_TIMING_KINDS,
  VOYAGE_HAZARD_VISIBILITY,
  VOYAGE_PRESSURE_SYSTEM_IDS
} from "../../../scripts/voyage/domain/constants.js";
import { analyzeVoyageHazardCollisionPlan } from "../../../scripts/voyage/domain/hazard-collision.js";
import { analyzeVoyageHazardStageEscalation } from "../../../scripts/voyage/domain/hazard-escalation.js";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { validateVoyageHazardRecord } from "../../../scripts/voyage/domain/hazard-schema.js";

const [SYSTEM_A, SYSTEM_B] = VOYAGE_PRESSURE_SYSTEM_IDS;

function timing() {
  return {
    kind: VOYAGE_HAZARD_TIMING_KINDS.IMMEDIATE,
    stationId: null,
    resultId: null
  };
}

function stageDescriptor(stageId, suffix = stageId) {
  return {
    stageId,
    effect: {
      effectId: `effect-${suffix}`,
      name: `Effect ${suffix}`,
      description: `Effect for ${suffix}`,
      nested: { values: [suffix] }
    },
    ignoredConsequence: {
      consequenceId: `ignored-${suffix}`,
      name: `Ignored ${suffix}`,
      description: `Ignored consequence for ${suffix}`,
      nested: { values: [suffix] }
    }
  };
}

function stagesInOrder(ids = ["stage-10", "stage-20", "stage-30"]) {
  return ids.map((id) => stageDescriptor(id, id));
}

function hazard(overrides = {}) {
  const stages = stagesInOrder();
  return {
    hazardId: "hazard-incoming",
    encounterId: "encounter-1",
    category: VOYAGE_HAZARD_CATEGORIES.SYSTEM,
    status: VOYAGE_HAZARD_STATUSES.ACTIVE,
    name: "Arc instability",
    currentEffect: { effectId: "current-effect", name: "Current effect", description: "Current" },
    activationTiming: timing(),
    removalMethod: { methodId: "address-hazard", name: "Address Hazard" },
    ignoredConsequence: { consequenceId: "ignored-consequence", name: "Ignored", description: "Ignored" },
    visibility: VOYAGE_HAZARD_VISIBILITY.PUBLIC,
    sourceKind: "pressure-breach",
    createdStageId: "stage-1",
    createdRoundNumber: 1,
    createdSequence: 0,
    escalation: {
      mode: VOYAGE_HAZARD_ESCALATION_MODES.NONE,
      currentStageId: null,
      stages: [],
      countdown: null,
      maximumEscalationReached: false,
      escalationConsequence: null
    },
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    duration: {
      mode: VOYAGE_HAZARD_DURATION_MODES.NONE,
      remaining: null,
      initial: null,
      decrementTiming: null
    },
    failurePressureSystemId: SYSTEM_A,
    resolvedStageId: null,
    resolvedRoundNumber: null,
    terminalReason: null,
    replacedByHazardId: null,
    metadata: { collision: { hazardId: "replacement-hazard" } },
    pressureSystemId: SYSTEM_A,
    eventAreaId: null,
    pressureBreachId: "breach-1",
    stationId: "engineer",
    actionId: "action-1",
    pressureEffectId: "pressure-effect-1",
    sourceIntentId: "intent-1",
    activationSource: "pressure-breach",
    branch: "failure",
    sourceTiming: "consequences",
    sourceVisibility: "public",
    ...overrides
  };
}

function stagedHazard(overrides = {}) {
  const stages = stagesInOrder();
  return hazard({
    hazardId: "hazard-existing",
    currentEffect: stages[0].effect,
    ignoredConsequence: stages[0].ignoredConsequence,
    escalation: {
      mode: VOYAGE_HAZARD_ESCALATION_MODES.STAGES,
      currentStageId: stages[0].stageId,
      stages,
      countdown: null,
      maximumEscalationReached: false,
      escalationConsequence: {
        consequenceId: "escalation-consequence",
        name: "Escalation consequence",
        description: "Authored escalation consequence",
        nested: { values: ["consequence"] }
      }
    },
    ...overrides
  });
}

function stateWithHazard(existingHazard) {
  const state = createVoyageEncounterState({ encounterId: "encounter-1" });
  state.activeHazards = [existingHazard];
  return state;
}

function incomingForPayload(collision) {
  return hazard({
    hazardId: "hazard-incoming",
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING,
    metadata: { collision }
  });
}

function collisionPlan(collision, existing = stagedHazard(), incomingOverrides = {}) {
  const incoming = incomingForPayload(collision);
  Object.assign(incoming, incomingOverrides);
  const result = analyzeVoyageHazardCollisionPlan(stateWithHazard(existing), incoming);
  assert.equal(result.readyForHazardCollisionPlanning, true, JSON.stringify(result.errors));
  assert.equal(result.plan.kind, "collision");
  return result.plan;
}

function targetPlan(targetStageId, existing = stagedHazard()) {
  return collisionPlan({ targetStageId }, existing);
}

function operationPlan(operationId = "advance-one-stage", existing = stagedHazard()) {
  return collisionPlan({ escalation: { operationId } }, existing);
}

function codes(result) {
  return result.errors.map((entry) => entry.code);
}

function assertInvalid(result, code) {
  assert.equal(result.structurallyValid, false);
  assert.equal(result.readyForHazardStageEscalation, false);
  assert.equal(result.outcome, "invalid-or-not-applicable");
  assert.equal(result.plan, null);
  assert.ok(codes(result).includes(code), JSON.stringify(result.errors));
}

function assertReady(result) {
  assert.equal(result.structurallyValid, true);
  assert.equal(result.readyForHazardStageEscalation, true);
  assert.equal(result.outcome, "escalation-ready");
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.plan.kind, "escalation-ready");
}

test("valid targetStageId advances to a later authored stage", () => {
  const result = analyzeVoyageHazardStageEscalation(targetPlan("stage-20"));

  assertReady(result);
  assert.equal(result.plan.requestKind, "target-stage");
  assert.equal(result.plan.targetStageId, "stage-20");
  assert.equal(result.plan.prospectiveHazard.escalation.currentStageId, "stage-20");
});

test("explicit targetStageId may skip forward", () => {
  const result = analyzeVoyageHazardStageEscalation(targetPlan("stage-30"));

  assertReady(result);
  assert.equal(result.plan.skippedStages, true);
  assert.equal(result.plan.targetStageId, "stage-30");
});

test("skipped intermediate effects and consequences are not used", () => {
  const existing = stagedHazard();
  const result = analyzeVoyageHazardStageEscalation(targetPlan("stage-30", existing));

  assert.deepEqual(result.plan.prospectiveHazard.currentEffect, existing.escalation.stages[2].effect);
  assert.deepEqual(result.plan.prospectiveHazard.ignoredConsequence, existing.escalation.stages[2].ignoredConsequence);
  assert.notDeepEqual(result.plan.prospectiveHazard.currentEffect, existing.escalation.stages[1].effect);
  assert.notDeepEqual(result.plan.prospectiveHazard.ignoredConsequence, existing.escalation.stages[1].ignoredConsequence);
});

test("same-stage target fails with the canonical diagnostic", () => {
  const result = analyzeVoyageHazardStageEscalation(targetPlan("stage-10"));

  assertInvalid(result, "hazard-stage-escalation-same-stage");
});

test("backward target fails with the canonical diagnostic", () => {
  const existing = stagedHazard({
    currentEffect: stagedHazard().escalation.stages[1].effect,
    ignoredConsequence: stagedHazard().escalation.stages[1].ignoredConsequence,
    escalation: {
      ...stagedHazard().escalation,
      currentStageId: "stage-20"
    }
  });
  const result = analyzeVoyageHazardStageEscalation(targetPlan("stage-10", existing));

  assertInvalid(result, "hazard-stage-escalation-backward");
});

test("unknown target fails", () => {
  const result = analyzeVoyageHazardStageEscalation(targetPlan("stage-unknown"));

  assertInvalid(result, "hazard-stage-escalation-target-stage-unknown");
});

test("authored array order controls progression rather than stage ID text", () => {
  const stages = stagesInOrder(["stage-30", "stage-10", "stage-20"]);
  const existing = stagedHazard({
    currentEffect: stages[0].effect,
    ignoredConsequence: stages[0].ignoredConsequence,
    escalation: {
      ...stagedHazard().escalation,
      currentStageId: "stage-30",
      stages
    }
  });
  const result = analyzeVoyageHazardStageEscalation(operationPlan("advance-one-stage", existing));

  assertReady(result);
  assert.equal(result.plan.targetStageId, "stage-10");
});

test("advance-one-stage advances exactly one stage", () => {
  const result = analyzeVoyageHazardStageEscalation(operationPlan());

  assertReady(result);
  assert.equal(result.plan.requestKind, "operation");
  assert.equal(result.plan.requestedOperationId, "advance-one-stage");
  assert.equal(result.plan.targetStageId, "stage-20");
  assert.equal(result.plan.skippedStages, false);
});

test("advance-one-stage never skips", () => {
  const result = analyzeVoyageHazardStageEscalation(operationPlan());

  assert.equal(result.plan.targetStageId, "stage-20");
  assert.notEqual(result.plan.targetStageId, "stage-30");
});

test("unknown operationId fails", () => {
  const plan = collisionPlan({ escalation: { operationId: "advance-to-final-stage" } });
  const result = analyzeVoyageHazardStageEscalation(plan);

  assertInvalid(result, "hazard-stage-escalation-operation-unknown");
});

test("advance-one-stage at the final stage returns maximum-escalation", () => {
  const stages = stagesInOrder();
  const existing = stagedHazard({
    currentEffect: stages[2].effect,
    ignoredConsequence: stages[2].ignoredConsequence,
    escalation: {
      ...stagedHazard().escalation,
      currentStageId: stages[2].stageId,
      stages,
      maximumEscalationReached: true
    }
  });
  const result = analyzeVoyageHazardStageEscalation(operationPlan("advance-one-stage", existing));

  assert.equal(result.structurallyValid, true);
  assert.equal(result.readyForHazardStageEscalation, true);
  assert.equal(result.outcome, "maximum-escalation");
  assert.equal(result.plan.kind, "maximum-escalation");
});

test("maximum outcome returns no prospective changed Hazard", () => {
  const stages = stagesInOrder();
  const existing = stagedHazard({
    currentEffect: stages[2].effect,
    ignoredConsequence: stages[2].ignoredConsequence,
    escalation: { ...stagedHazard().escalation, currentStageId: stages[2].stageId, stages }
  });
  const result = analyzeVoyageHazardStageEscalation(operationPlan("advance-one-stage", existing));

  assert.equal(result.plan.prospectiveHazard, null);
});

test("maximum outcome preserves an unchanged isolated existing Hazard", () => {
  const stages = stagesInOrder();
  const existing = stagedHazard({
    currentEffect: stages[2].effect,
    ignoredConsequence: stages[2].ignoredConsequence,
    escalation: { ...stagedHazard().escalation, currentStageId: stages[2].stageId, stages }
  });
  const result = analyzeVoyageHazardStageEscalation(operationPlan("advance-one-stage", existing));

  assert.deepEqual(result.plan.previousExistingHazard, existing);
  assert.notStrictEqual(result.plan.previousExistingHazard, existing);
});

test("maximum outcome returns an isolated escalationConsequence", () => {
  const stages = stagesInOrder();
  const existing = stagedHazard({
    currentEffect: stages[2].effect,
    ignoredConsequence: stages[2].ignoredConsequence,
    escalation: { ...stagedHazard().escalation, currentStageId: stages[2].stageId, stages }
  });
  const result = analyzeVoyageHazardStageEscalation(operationPlan("advance-one-stage", existing));

  assert.deepEqual(result.plan.escalationConsequence, existing.escalation.escalationConsequence);
  assert.notStrictEqual(result.plan.escalationConsequence, existing.escalation.escalationConsequence);
});

test("maximum outcome returns null consequence when absent", () => {
  const stages = stagesInOrder();
  const existing = stagedHazard({
    currentEffect: stages[2].effect,
    ignoredConsequence: stages[2].ignoredConsequence,
    escalation: { ...stagedHazard().escalation, currentStageId: stages[2].stageId, stages, escalationConsequence: null }
  });
  const result = analyzeVoyageHazardStageEscalation(operationPlan("advance-one-stage", existing));

  assert.equal(result.plan.escalationConsequence, null);
});

test("maximum warning is nonfatal and path-specific", () => {
  const stages = stagesInOrder();
  const existing = stagedHazard({
    currentEffect: stages[2].effect,
    ignoredConsequence: stages[2].ignoredConsequence,
    escalation: { ...stagedHazard().escalation, currentStageId: stages[2].stageId, stages }
  });
  const result = analyzeVoyageHazardStageEscalation(operationPlan("advance-one-stage", existing));

  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.warnings, [{
    severity: "warning",
    code: "hazard-stage-escalation-at-maximum",
    path: "collisionPlan.existingHazard.escalation.currentStageId",
    message: "Stage escalation operation reached the maximum authored stage."
  }]);
});

test("explicit final/current target remains a canonical same-stage error", () => {
  const stages = stagesInOrder();
  const existing = stagedHazard({
    currentEffect: stages[2].effect,
    ignoredConsequence: stages[2].ignoredConsequence,
    escalation: { ...stagedHazard().escalation, currentStageId: stages[2].stageId, stages }
  });
  const result = analyzeVoyageHazardStageEscalation(targetPlan(stages[2].stageId, existing));

  assertInvalid(result, "hazard-stage-escalation-same-stage");
});

test("none mode fails with unsupported-mode diagnostic", () => {
  const result = analyzeVoyageHazardStageEscalation(collisionPlan(
    { targetStageId: "stage-20" },
    hazard({ hazardId: "hazard-existing" })
  ));

  assertInvalid(result, "hazard-stage-escalation-mode-unsupported");
});

test("countdown mode fails as not applicable", () => {
  const existing = hazard({
    hazardId: "hazard-existing",
    escalation: {
      mode: VOYAGE_HAZARD_ESCALATION_MODES.COUNTDOWN,
      currentStageId: null,
      stages: [],
      countdown: { current: 2, initial: 3, decrementTiming: timing() },
      maximumEscalationReached: false,
      escalationConsequence: { consequenceId: "countdown-consequence" }
    }
  });
  const result = analyzeVoyageHazardStageEscalation(collisionPlan(
    { targetStageId: "stage-20" },
    existing
  ));

  assertInvalid(result, "hazard-stage-escalation-not-applicable");
});

test("countdown data remains unchanged", () => {
  const countdown = { current: 2, initial: 3, decrementTiming: timing() };
  const existing = hazard({
    hazardId: "hazard-existing",
    escalation: {
      mode: VOYAGE_HAZARD_ESCALATION_MODES.COUNTDOWN,
      currentStageId: null,
      stages: [],
      countdown,
      maximumEscalationReached: false,
      escalationConsequence: null
    }
  });
  const before = structuredClone(existing);
  analyzeVoyageHazardStageEscalation(collisionPlan({ targetStageId: "stage-20" }, existing));

  assert.deepEqual(existing, before);
  assert.deepEqual(countdown, before.escalation.countdown);
});

test("successful transformation changes exactly the four canonical fields", () => {
  const existing = stagedHazard();
  const result = analyzeVoyageHazardStageEscalation(targetPlan("stage-20", existing));
  const prospective = result.plan.prospectiveHazard;
  const changed = new Set(["escalation", "currentEffect", "ignoredConsequence"]);

  for (const key of Object.keys(existing)) {
    if (!changed.has(key)) assert.deepEqual(prospective[key], existing[key], key);
  }
  assert.equal(prospective.escalation.currentStageId, "stage-20");
  assert.deepEqual(prospective.currentEffect, existing.escalation.stages[1].effect);
  assert.deepEqual(prospective.ignoredConsequence, existing.escalation.stages[1].ignoredConsequence);
  assert.equal(prospective.escalation.maximumEscalationReached, false);
  assert.deepEqual(prospective.escalation.stages, existing.escalation.stages);
  assert.deepEqual(prospective.escalation.countdown, existing.escalation.countdown);
  assert.deepEqual(prospective.escalation.escalationConsequence, existing.escalation.escalationConsequence);
});

test("currentEffect comes from target stage.effect", () => {
  const result = analyzeVoyageHazardStageEscalation(targetPlan("stage-20"));

  assert.deepEqual(result.plan.prospectiveHazard.currentEffect, result.plan.previousExistingHazard.escalation.stages[1].effect);
});

test("ignoredConsequence comes from target stage.ignoredConsequence", () => {
  const result = analyzeVoyageHazardStageEscalation(targetPlan("stage-20"));

  assert.deepEqual(result.plan.prospectiveHazard.ignoredConsequence, result.plan.previousExistingHazard.escalation.stages[1].ignoredConsequence);
});

test("maximumEscalationReached is false for a nonfinal target", () => {
  const result = analyzeVoyageHazardStageEscalation(targetPlan("stage-20"));

  assert.equal(result.plan.prospectiveHazard.escalation.maximumEscalationReached, false);
});

test("maximumEscalationReached is true for a final target", () => {
  const result = analyzeVoyageHazardStageEscalation(targetPlan("stage-30"));

  assert.equal(result.plan.prospectiveHazard.escalation.maximumEscalationReached, true);
});

test("prospective Hazard passes active Hazard validation", () => {
  const result = analyzeVoyageHazardStageEscalation(targetPlan("stage-30"));
  const validation = validateVoyageHazardRecord(result.plan.prospectiveHazard, {
    mode: "active",
    expectedEncounterId: "encounter-1"
  });

  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
});

test("unsafe target-stage data fails at safe capture without execution", () => {
  const plan = targetPlan("stage-20");
  plan.existingHazard.escalation.stages[1].effect = { invalid: undefined };
  const result = analyzeVoyageHazardStageEscalation(plan);

  assertInvalid(result, "hazard-stage-escalation-analysis-data-read-failed");
  assert.equal(result.errors[0].path, "collisionPlan.existingHazard.escalation.stages[1].effect.invalid");
  assert.equal(result.plan, null);
});

test("invalid currentStageId fails defensively", () => {
  const plan = targetPlan("stage-20");
  plan.existingHazard.escalation.currentStageId = "missing-stage";
  const result = analyzeVoyageHazardStageEscalation(plan);

  assertInvalid(result, "hazard-stage-escalation-plan-invalid");
  assert.ok(codes(result).includes("hazard-stage-escalation-current-stage-unknown"));
  assert.ok(codes(result).includes("invalid-hazard-escalation-current-stage"));
});

test("malformed Task 4A plan fails", () => {
  const plan = targetPlan("stage-20");
  delete plan.kind;
  const result = analyzeVoyageHazardStageEscalation(plan);

  assertInvalid(result, "hazard-stage-escalation-plan-invalid");
});

test("a no-collision plan fails as an invalid escalation plan", () => {
  const incoming = incomingForPayload({ targetStageId: "stage-20" });
  const report = analyzeVoyageHazardCollisionPlan(createVoyageEncounterState({ encounterId: "encounter-1" }), incoming);
  const result = analyzeVoyageHazardStageEscalation(report.plan);

  assertInvalid(result, "hazard-stage-escalation-plan-invalid");
});

test("a collision plan using another policy fails", () => {
  const existing = stagedHazard();
  const incoming = hazard({
    hazardId: "hazard-incoming",
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: { hazardId: "replacement" } }
  });
  const report = analyzeVoyageHazardCollisionPlan(stateWithHazard(existing), incoming);
  const result = analyzeVoyageHazardStageEscalation(report.plan);

  assertInvalid(result, "hazard-stage-escalation-plan-invalid");
});

test("mismatched plan identity fields fail", () => {
  const plan = targetPlan("stage-20");
  plan.existingHazardId = "wrong-existing";
  const result = analyzeVoyageHazardStageEscalation(plan);

  assertInvalid(result, "hazard-stage-escalation-plan-invalid");
});

test("incoming and existing encounter mismatch fails", () => {
  const plan = targetPlan("stage-20");
  plan.incomingHazard.encounterId = "other-encounter";
  const result = analyzeVoyageHazardStageEscalation(plan);

  assertInvalid(result, "hazard-stage-escalation-plan-invalid");
  assert.ok(codes(result).includes("hazard-encounter-id-mismatch"));
});

test("hostile root getter fails without execution", () => {
  const plan = targetPlan("stage-20");
  let reads = 0;
  Object.defineProperty(plan, "kind", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("must not execute");
    }
  });
  const result = analyzeVoyageHazardStageEscalation(plan);

  assert.equal(reads, 0);
  assertInvalid(result, "hazard-stage-escalation-analysis-data-read-failed");
});

test("hostile nested collision payload fails without execution", () => {
  const plan = targetPlan("stage-20");
  let reads = 0;
  Object.defineProperty(plan.collisionPayload, "targetStageId", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("must not execute");
    }
  });
  const result = analyzeVoyageHazardStageEscalation(plan);

  assert.equal(reads, 0);
  assertInvalid(result, "hazard-stage-escalation-analysis-data-read-failed");
});

test("Proxy ownKeys failure fails safely", () => {
  const plan = targetPlan("stage-20");
  const hostile = new Proxy(plan, { ownKeys() { throw new Error("reflection failure"); } });
  const result = analyzeVoyageHazardStageEscalation(hostile);

  assertInvalid(result, "hazard-stage-escalation-analysis-data-read-failed");
});

test("Proxy descriptor failure fails safely", () => {
  const plan = targetPlan("stage-20");
  const hostile = new Proxy(plan, { getOwnPropertyDescriptor() { throw new Error("descriptor failure"); } });
  const result = analyzeVoyageHazardStageEscalation(hostile);

  assertInvalid(result, "hazard-stage-escalation-analysis-data-read-failed");
});

test("Proxy getPrototypeOf failure fails safely", () => {
  const plan = targetPlan("stage-20");
  const hostile = new Proxy(plan, { getPrototypeOf() { throw new Error("prototype failure"); } });
  const result = analyzeVoyageHazardStageEscalation(hostile);

  assertInvalid(result, "hazard-stage-escalation-analysis-data-read-failed");
});

test("symbols and unsafe keys fail safely", () => {
  const symbolPlan = targetPlan("stage-20");
  Object.defineProperty(symbolPlan, Symbol("unsafe"), { enumerable: true, value: true });
  const unsafePlan = targetPlan("stage-20");
  Object.defineProperty(unsafePlan.collisionPayload, "__proto__", { enumerable: true, value: {} });

  assertInvalid(analyzeVoyageHazardStageEscalation(symbolPlan), "hazard-stage-escalation-analysis-data-read-failed");
  assertInvalid(analyzeVoyageHazardStageEscalation(unsafePlan), "hazard-stage-escalation-analysis-data-read-failed");
});

test("caller coercion hooks are not executed", () => {
  const plan = targetPlan("stage-20");
  let calls = 0;
  Object.defineProperty(plan.collisionPayload, "toString", {
    enumerable: true,
    value() {
      calls += 1;
      throw new Error("coercion must not execute");
    }
  });
  const result = analyzeVoyageHazardStageEscalation(plan);

  assert.equal(calls, 0);
  assertInvalid(result, "hazard-stage-escalation-analysis-data-read-failed");
});

test("safe capture rejects unsupported values and hostile structural forms", () => {
  class Unsupported {}

  const cases = [
    ["BigInt", (plan) => { plan.expectedRevision = 1n; }],
    ["NaN", (plan) => { plan.expectedRevision = Number.NaN; }],
    ["positive Infinity", (plan) => { plan.expectedRevision = Number.POSITIVE_INFINITY; }],
    ["negative Infinity", (plan) => { plan.expectedRevision = Number.NEGATIVE_INFINITY; }],
    ["Date", (plan) => { plan.collisionPayload.unsupported = new Date(0); }],
    ["Map", (plan) => { plan.collisionPayload.unsupported = new Map(); }],
    ["Set", (plan) => { plan.collisionPayload.unsupported = new Set(); }],
    ["typed array", (plan) => { plan.collisionPayload.unsupported = new Uint8Array([1]); }],
    ["class instance", (plan) => { plan.collisionPayload.unsupported = new Unsupported(); }],
    ["boxed primitive", (plan) => { plan.collisionPayload.unsupported = new Number(1); }],
    ["cyclic input", (plan) => { plan.collisionPayload.cycle = plan.collisionPayload; }],
    ["sparse array", (plan) => { plan.collisionPayload.sparse = new Array(1); }],
    ["inherited required property", (plan) => {
      const inherited = Object.create({ kind: "collision" });
      Object.assign(inherited, plan);
      delete inherited.kind;
      return inherited;
    }],
    ["non-enumerable required property", (plan) => {
      Object.defineProperty(plan, "kind", { configurable: true, enumerable: false, value: "collision" });
    }],
    ["setter-backed property", (plan, mark) => {
      Object.defineProperty(plan, "kind", {
        configurable: true,
        enumerable: true,
        set: mark
      });
    }],
    ["valueOf hook", (plan, mark) => {
      Object.defineProperty(plan, "valueOf", { enumerable: true, value: mark });
    }],
    ["Symbol.toPrimitive hook", (plan, mark) => {
      Object.defineProperty(plan, Symbol.toPrimitive, { enumerable: true, value: mark });
    }],
    ["iterator hook", (plan, mark) => {
      Object.defineProperty(plan, Symbol.iterator, { enumerable: true, value: mark });
    }]
  ];

  for (const [name, configure] of cases) {
    let calls = 0;
    const configured = targetPlan("stage-20");
    const plan = configure(configured, () => { calls += 1; }) ?? configured;
    const result = analyzeVoyageHazardStageEscalation(plan);

    assertInvalid(result, "hazard-stage-escalation-analysis-data-read-failed");
    assert.equal(calls, 0, `${name} hook executed`);
  }
});

test("all outer result categories expose the exact result fields", () => {
  const expectedKeys = [
    "errors",
    "outcome",
    "plan",
    "readyForHazardStageEscalation",
    "structurallyValid",
    "warnings"
  ];
  const ready = analyzeVoyageHazardStageEscalation(targetPlan("stage-20"));
  const stages = stagesInOrder();
  const maximumExisting = stagedHazard({
    currentEffect: stages[2].effect,
    ignoredConsequence: stages[2].ignoredConsequence,
    escalation: { ...stagedHazard().escalation, currentStageId: stages[2].stageId, stages }
  });
  const maximum = analyzeVoyageHazardStageEscalation(operationPlan("advance-one-stage", maximumExisting));
  const invalid = analyzeVoyageHazardStageEscalation(targetPlan("stage-unknown"));

  for (const result of [ready, maximum, invalid]) {
    assert.deepEqual(Object.keys(result).sort(), expectedKeys);
  }
});

test("error and warning arrays do not alias between calls", () => {
  const firstMaximum = analyzeVoyageHazardStageEscalation(operationPlan("advance-one-stage", stagedHazard({
    currentEffect: stagesInOrder()[2].effect,
    ignoredConsequence: stagesInOrder()[2].ignoredConsequence,
    escalation: { ...stagedHazard().escalation, currentStageId: "stage-30", stages: stagesInOrder() }
  })));
  const secondMaximum = analyzeVoyageHazardStageEscalation(operationPlan("advance-one-stage", stagedHazard({
    currentEffect: stagesInOrder()[2].effect,
    ignoredConsequence: stagesInOrder()[2].ignoredConsequence,
    escalation: { ...stagedHazard().escalation, currentStageId: "stage-30", stages: stagesInOrder() }
  })));
  const firstInvalid = analyzeVoyageHazardStageEscalation(targetPlan("stage-unknown"));
  const secondInvalid = analyzeVoyageHazardStageEscalation(targetPlan("stage-unknown"));

  assert.notStrictEqual(firstMaximum.errors, secondMaximum.errors);
  assert.notStrictEqual(firstMaximum.warnings, secondMaximum.warnings);
  assert.notStrictEqual(firstInvalid.errors, secondInvalid.errors);
  assert.notStrictEqual(firstInvalid.warnings, secondInvalid.warnings);

  firstMaximum.warnings.push({ code: "mutated" });
  firstInvalid.errors.push({ code: "mutated" });
  assert.equal(secondMaximum.warnings.length, 1);
  assert.equal(secondInvalid.errors.length, 1);
});

test("returned plan does not alias caller input", () => {
  const input = targetPlan("stage-20");
  const before = structuredClone(input);
  const result = analyzeVoyageHazardStageEscalation(input);

  result.plan.prospectiveHazard.currentEffect.nested.values[0] = "changed";
  result.plan.previousExistingHazard.escalation.stages[0].effect.nested.values[0] = "changed";

  assert.deepEqual(input, before);
});

test("prospective Hazard nested data is isolated", () => {
  const result = analyzeVoyageHazardStageEscalation(targetPlan("stage-20"));

  assert.notStrictEqual(result.plan.prospectiveHazard.currentEffect, result.plan.previousExistingHazard.escalation.stages[1].effect);
  assert.notStrictEqual(result.plan.prospectiveHazard.ignoredConsequence, result.plan.previousExistingHazard.escalation.stages[1].ignoredConsequence);
  assert.notStrictEqual(result.plan.prospectiveHazard.escalation.stages, result.plan.previousExistingHazard.escalation.stages);
});

test("existing and prospective snapshots do not alias", () => {
  const result = analyzeVoyageHazardStageEscalation(targetPlan("stage-20"));

  assert.notStrictEqual(result.plan.previousExistingHazard, result.plan.prospectiveHazard);
  assert.notStrictEqual(result.plan.previousExistingHazard.escalation, result.plan.prospectiveHazard.escalation);
});

test("separate calls do not alias", () => {
  const first = analyzeVoyageHazardStageEscalation(targetPlan("stage-20"));
  const second = analyzeVoyageHazardStageEscalation(targetPlan("stage-20"));

  assert.notStrictEqual(first.plan, second.plan);
  assert.notStrictEqual(first.plan.prospectiveHazard, second.plan.prospectiveHazard);
});

test("equivalent inputs produce deeply equivalent outputs", () => {
  const first = analyzeVoyageHazardStageEscalation(targetPlan("stage-30"));
  const second = analyzeVoyageHazardStageEscalation(targetPlan("stage-30"));

  assert.deepEqual(first, second);
});

test("mutating returned data does not affect caller data", () => {
  const input = targetPlan("stage-30");
  const before = structuredClone(input);
  const result = analyzeVoyageHazardStageEscalation(input);

  result.plan.prospectiveHazard.escalation.stages[0].ignoredConsequence.nested.values[0] = "changed";
  result.plan.prospectiveHazard.metadata.collision.targetStageId = "changed";

  assert.deepEqual(input, before);
});

test("analysis changes no revision, event, Pressure, Void Scar, lifecycle, timing, or collection", () => {
  const input = targetPlan("stage-20");
  const before = structuredClone(input);
  const result = analyzeVoyageHazardStageEscalation(input);

  assert.deepEqual(input, before);
  assert.equal(result.events, undefined);
  assert.equal(result.nextState, undefined);
  assert.equal(result.voidScarProposal, undefined);
});

test("input collision plan remains deeply unchanged", () => {
  const input = operationPlan();
  const before = structuredClone(input);

  analyzeVoyageHazardStageEscalation(input);

  assert.deepEqual(input, before);
});

test("Task 4A collision-planner behavior remains unchanged", () => {
  const existing = stagedHazard();
  const incoming = incomingForPayload({ targetStageId: "stage-20" });
  const state = stateWithHazard(existing);
  const before = structuredClone(state);
  const result = analyzeVoyageHazardCollisionPlan(state, incoming);

  assert.equal(result.plan.kind, "collision");
  assert.equal(result.plan.recommendedOperation, "escalate-existing");
  assert.deepEqual(state, before);
});

test("collision payload mismatch fails as an invalid Task 4A plan", () => {
  const plan = targetPlan("stage-20");
  plan.collisionPayload.targetStageId = "stage-30";
  const result = analyzeVoyageHazardStageEscalation(plan);

  assertInvalid(result, "hazard-stage-escalation-plan-invalid");
});
