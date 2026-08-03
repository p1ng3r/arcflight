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
import { applyVoyageHazardStageEscalationPlan } from "../../../scripts/voyage/domain/hazard-escalation-application.js";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { validateVoyageEncounterState } from "../../../scripts/voyage/domain/validation.js";

const [SYSTEM_A, SYSTEM_B] = VOYAGE_PRESSURE_SYSTEM_IDS;
const SUCCESS_KEYS = ["errors", "events", "nextState", "ok", "warnings"];
const EVENT_KEYS = [
  "collisionPolicy", "encounterId", "hazard", "hazardId", "incomingHazardId",
  "operationId", "previousHazard", "previousRevision", "previousStageId",
  "pressureSystemId", "requestKind", "requestedTargetStageId", "revision",
  "skippedStages", "targetStageId", "type"
];

function timing() {
  return { kind: VOYAGE_HAZARD_TIMING_KINDS.IMMEDIATE, stationId: null, resultId: null };
}

function stageDescriptor(stageId, suffix = stageId) {
  return {
    stageId,
    effect: { effectId: `effect-${suffix}`, name: `Effect ${suffix}`, nested: { values: [suffix] } },
    ignoredConsequence: { consequenceId: `ignored-${suffix}`, name: `Ignored ${suffix}`, nested: { values: [suffix] } }
  };
}

function stagedHazard(overrides = {}) {
  const stages = [stageDescriptor("stage-10"), stageDescriptor("stage-20"), stageDescriptor("stage-30")];
  return {
    hazardId: "hazard-existing",
    encounterId: "encounter-1",
    category: VOYAGE_HAZARD_CATEGORIES.SYSTEM,
    status: VOYAGE_HAZARD_STATUSES.ACTIVE,
    name: "Arc instability",
    currentEffect: stages[0].effect,
    activationTiming: timing(),
    removalMethod: { methodId: "address-hazard", name: "Address Hazard" },
    ignoredConsequence: stages[0].ignoredConsequence,
    visibility: VOYAGE_HAZARD_VISIBILITY.PUBLIC,
    sourceKind: "pressure-breach",
    createdStageId: "stage-1",
    createdRoundNumber: 1,
    createdSequence: 0,
    escalation: {
      mode: VOYAGE_HAZARD_ESCALATION_MODES.STAGES,
      currentStageId: stages[0].stageId,
      stages,
      countdown: null,
      maximumEscalationReached: false,
      escalationConsequence: { consequenceId: "escalation-consequence", name: "Escalation" }
    },
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    duration: { mode: VOYAGE_HAZARD_DURATION_MODES.NONE, remaining: null, initial: null, decrementTiming: null },
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

function incomingHazard() {
  return {
    ...stagedHazard(),
    hazardId: "hazard-incoming",
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING,
    metadata: { collision: { targetStageId: "stage-20" } }
  };
}

function makeState(activeHazards = [stagedHazard()], overrides = {}) {
  const state = createVoyageEncounterState({ encounterId: "encounter-1", ...overrides });
  state.revision = 7;
  state.momentum = 2;
  state.pressureSystems[SYSTEM_A].value = 1;
  state.pressureSystems[SYSTEM_B].value = 2;
  state.activeHazards = activeHazards;
  return state;
}

function makeResult(state = makeState(), incoming = incomingHazard()) {
  const collision = analyzeVoyageHazardCollisionPlan(state, incoming);
  assert.equal(collision.plan.kind, "collision", JSON.stringify(collision.errors));
  const result = analyzeVoyageHazardStageEscalation(collision.plan);
  assert.equal(result.outcome, "escalation-ready", JSON.stringify(result.errors));
  return result;
}

function makeMaximumResult(state = makeState()) {
  const result = makeResult(state);
  result.outcome = "maximum-escalation";
  result.plan.kind = "maximum-escalation";
  result.plan.requestKind = "operation";
  result.plan.requestedTargetStageId = null;
  result.plan.requestedOperationId = "advance-one-stage";
  result.plan.targetStageId = null;
  result.plan.skippedStages = false;
  result.plan.prospectiveHazard = null;
  result.plan.escalationConsequence = { consequenceId: "maximum-consequence" };
  return result;
}

function makeInvalidResult() {
  return {
    structurallyValid: false,
    readyForHazardStageEscalation: false,
    outcome: "invalid-or-not-applicable",
    plan: null,
    errors: [{ severity: "error", code: "upstream-invalid", path: "collisionPlan", message: "Invalid collision plan." }],
    warnings: []
  };
}

function codes(result) {
  return result.errors.map(({ code }) => code);
}

function assertFailure(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  assert.ok(codes(result).includes(code), JSON.stringify(result.errors));
}

function assertPrimaryFailure(result, code, state, stateBefore, escalationResult, escalationResultBefore) {
  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  const applicationCodes = result.errors
    .map(({ code: issueCode }) => issueCode)
    .filter((issueCode) => issueCode.startsWith("hazard-stage-escalation-application-"));
  assert.deepEqual(applicationCodes, [code], JSON.stringify(result.errors));
  assert.deepEqual(state, stateBefore);
  assert.deepEqual(escalationResult, escalationResultBefore);
}

function applyReady(state = makeState()) {
  return applyVoyageHazardStageEscalationPlan(state, makeResult(state));
}

test("valid target-stage result applies with one revision and one exact event", () => {
  const state = makeState();
  const result = applyReady(state);

  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result).sort(), SUCCESS_KEYS);
  assert.equal(result.nextState.revision, 8);
  assert.equal(result.events.length, 1);
  assert.deepEqual(Object.keys(result.events[0]).sort(), EVENT_KEYS.sort());
  assert.equal(result.events[0].type, "voyage.hazard-escalated");
  assert.equal(result.events[0].requestKind, "target-stage");
  assert.equal(result.events[0].requestedTargetStageId, "stage-20");
  assert.equal(result.events[0].operationId, null);
});

test("valid operation result applies and maps operation request fields", () => {
  const state = makeState();
  const incoming = { ...incomingHazard(), metadata: { collision: { escalation: { operationId: "advance-one-stage" } } } };
  const result = applyVoyageHazardStageEscalationPlan(state, makeResult(state, incoming));

  assert.equal(result.ok, true);
  assert.equal(result.events[0].requestKind, "operation");
  assert.equal(result.events[0].requestedTargetStageId, null);
  assert.equal(result.events[0].operationId, "advance-one-stage");
  assert.equal(result.events[0].skippedStages, false);
});

test("collisionPolicy is copied from the Task 4B2 plan", () => {
  const state = makeState();
  const task4B2 = makeResult(state);
  const result = applyVoyageHazardStageEscalationPlan(state, task4B2);

  assert.equal(task4B2.plan.collisionPolicy, "escalate-existing");
  assert.equal(result.events[0].collisionPolicy, task4B2.plan.collisionPolicy);
});

test("replacement preserves index, order, unrelated Hazards, and encounter state", () => {
  const other = { ...stagedHazard(), hazardId: "hazard-other", pressureSystemId: SYSTEM_B, failurePressureSystemId: SYSTEM_B };
  const state = makeState([other, stagedHazard()]);
  const before = structuredClone(state);
  const task4B2 = makeResult(state);
  task4B2.plan.existingHazardIndex = 1;
  const result = applyVoyageHazardStageEscalationPlan(state, task4B2);

  assert.equal(result.ok, true);
  assert.equal(result.nextState.activeHazards.length, 2);
  assert.equal(result.nextState.activeHazards[0].hazardId, "hazard-other");
  assert.equal(result.nextState.activeHazards[1].hazardId, "hazard-existing");
  assert.equal(result.nextState.activeHazards[1].escalation.currentStageId, "stage-20");
  assert.equal(result.nextState.pressureSystems[SYSTEM_A].value, before.pressureSystems[SYSTEM_A].value);
  assert.equal(result.nextState.pressureSystems[SYSTEM_B].value, before.pressureSystems[SYSTEM_B].value);
  assert.equal(result.nextState.momentum, before.momentum);
  assert.equal(result.nextState.phase, before.phase);
  assert.equal(result.nextState.roundNumber, before.roundNumber);
  assert.deepEqual(result.nextState.currentStage, before.currentStage);
  assert.equal(result.nextState.activeHazards.some(({ hazardId }) => hazardId === "hazard-incoming"), false);
});

test("event snapshots and next state are isolated", () => {
  const state = makeState();
  const task4B2 = makeResult(state);
  const result = applyVoyageHazardStageEscalationPlan(state, task4B2);

  assert.notStrictEqual(result.nextState, state);
  assert.notStrictEqual(result.events[0], result.nextState);
  assert.notStrictEqual(result.events[0].previousHazard, result.events[0].hazard);
  assert.notStrictEqual(result.events[0].hazard, result.nextState.activeHazards[0]);
  result.events[0].hazard.currentEffect.nested.values[0] = "event-change";
  result.nextState.activeHazards[0].currentEffect.nested.values[0] = "state-change";
  assert.equal(task4B2.plan.previousExistingHazard.currentEffect.nested.values[0], "stage-10");
  assert.equal(state.activeHazards[0].currentEffect.nested.values[0], "stage-10");
});

test("live Hazard must match the previous snapshot semantically, not by identity", () => {
  const state = makeState();
  const task4B2 = makeResult(state);
  state.activeHazards[0] = structuredClone(state.activeHazards[0]);
  const result = applyVoyageHazardStageEscalationPlan(state, task4B2);

  assert.equal(result.ok, true);
});

test("different key sets and array order fail semantic equality", () => {
  const state = makeState();
  const task4B2 = makeResult(state);
  task4B2.plan.previousExistingHazard.currentEffect.extra = true;
  assertFailure(applyVoyageHazardStageEscalationPlan(state, task4B2), "hazard-stage-escalation-application-snapshot-mismatch");

  const secondState = makeState();
  secondState.activeHazards[0].escalation.stages.reverse();
  const second = makeResult(makeState());
  assertFailure(applyVoyageHazardStageEscalationPlan(secondState, second), "hazard-stage-escalation-application-snapshot-mismatch");
});

test("unapproved live and prospective changes fail atomically", () => {
  const state = makeState();
  const task4B2 = makeResult(state);
  state.activeHazards[0].currentEffect.extra = true;
  assertFailure(applyVoyageHazardStageEscalationPlan(state, task4B2), "hazard-stage-escalation-application-snapshot-mismatch");

  const secondState = makeState();
  const second = makeResult(secondState);
  second.plan.prospectiveHazard.metadata.extra = true;
  assertFailure(applyVoyageHazardStageEscalationPlan(secondState, second), "hazard-stage-escalation-application-change-set-invalid");
});

test("equal authorized descriptors and maximum flag are permitted", () => {
  const state = makeState();
  const task4B2 = makeResult(state);
  task4B2.plan.prospectiveHazard.currentEffect = structuredClone(task4B2.plan.previousExistingHazard.currentEffect);
  task4B2.plan.prospectiveHazard.ignoredConsequence = structuredClone(task4B2.plan.previousExistingHazard.ignoredConsequence);
  task4B2.plan.prospectiveHazard.escalation.maximumEscalationReached = task4B2.plan.previousExistingHazard.escalation.maximumEscalationReached;
  const result = applyVoyageHazardStageEscalationPlan(state, task4B2);

  assert.equal(result.ok, true);
});

test("encounter, revision, index, moved, identity, and slot mismatches fail atomically", () => {
  const cases = [
    ["encounter", () => { const state = makeState(); const result = makeResult(state); state.encounterId = "other"; state.activeHazards[0].encounterId = "other"; return [state, result, "hazard-stage-escalation-application-encounter-mismatch"]; }],
    ["revision", () => { const state = makeState(); const result = makeResult(state); state.revision += 1; return [state, result, "hazard-stage-escalation-application-revision-mismatch"]; }],
    ["index", () => { const state = makeState(); const result = makeResult(state); result.plan.existingHazardIndex = 4; return [state, result, "hazard-stage-escalation-application-index-invalid"]; }],
    ["moved", () => { const state = makeState([stagedHazard({ hazardId: "other", pressureSystemId: SYSTEM_B, failurePressureSystemId: SYSTEM_B }), stagedHazard()]); const result = makeResult(makeState()); result.plan.existingHazardIndex = 0; return [state, result, "hazard-stage-escalation-application-live-hazard-mismatch"]; }],
    ["identity", () => { const state = makeState(); const result = makeResult(state); state.activeHazards[0].hazardId = "other"; return [state, result, "hazard-stage-escalation-application-live-hazard-mismatch"]; }],
    ["slot", () => { const state = makeState(); const result = makeResult(state); state.activeHazards[0].pressureSystemId = SYSTEM_B; state.activeHazards[0].failurePressureSystemId = SYSTEM_B; return [state, result, "hazard-stage-escalation-application-live-hazard-mismatch"]; }]
  ];
  for (const [name, createCase] of cases) {
    const [state, result, code] = createCase();
    const before = structuredClone(state);
    const report = applyVoyageHazardStageEscalationPlan(state, result);
    assertFailure(report, code);
    assert.deepEqual(state, before, name);
  }
});

test("live diagnostic precedence outranks invalid prospective Hazards", () => {
  const cases = [
    ["revision", (state, result) => {
      state.revision += 1;
      result.plan.prospectiveHazard.status = VOYAGE_HAZARD_STATUSES.RESOLVED;
      return "hazard-stage-escalation-application-revision-mismatch";
    }],
    ["revision plus unauthorized change", (state, result) => {
      state.revision += 1;
      result.plan.prospectiveHazard.name = "unauthorized";
      return "hazard-stage-escalation-application-revision-mismatch";
    }],
    ["index", (state, result) => {
      result.plan.existingHazardIndex = 4;
      result.plan.prospectiveHazard.status = VOYAGE_HAZARD_STATUSES.RESOLVED;
      return "hazard-stage-escalation-application-index-invalid";
    }],
    ["snapshot", (state, result) => {
      state.activeHazards[0].name = "changed live Hazard";
      result.plan.prospectiveHazard.status = VOYAGE_HAZARD_STATUSES.RESOLVED;
      return "hazard-stage-escalation-application-snapshot-mismatch";
    }]
  ];

  for (const [name, configure] of cases) {
    const state = makeState();
    const result = makeResult(state);
    const expectedCode = configure(state, result);
    const stateBefore = structuredClone(state);
    const resultBefore = structuredClone(result);
    const report = applyVoyageHazardStageEscalationPlan(state, result);

    assertPrimaryFailure(report, expectedCode, state, stateBefore, result, resultBefore);
  }
});

test("encounter mismatch outranks every later prospective defect", () => {
  const cases = [
    (result) => { result.plan.prospectiveHazard.status = VOYAGE_HAZARD_STATUSES.RESOLVED; },
    (result) => { result.plan.prospectiveHazard.name = "unauthorized"; },
    (result) => {
      result.plan.prospectiveHazard.status = VOYAGE_HAZARD_STATUSES.RESOLVED;
      result.plan.prospectiveHazard.name = "unauthorized";
    }
  ];

  for (const mutate of cases) {
    const state = makeState();
    const result = makeResult(state);
    state.encounterId = "other-encounter";
    state.activeHazards[0].encounterId = "other-encounter";
    mutate(result);
    const stateBefore = structuredClone(state);
    const resultBefore = structuredClone(result);
    const report = applyVoyageHazardStageEscalationPlan(state, result);

    assertPrimaryFailure(report, "hazard-stage-escalation-application-encounter-mismatch", state, stateBefore, result, resultBefore);
  }
});

test("live identity mismatch outranks an unauthorized prospective change", () => {
  const state = makeState();
  const result = makeResult(state);
  state.activeHazards[0].hazardId = "different-live-hazard";
  result.plan.prospectiveHazard.name = "unauthorized";
  const stateBefore = structuredClone(state);
  const resultBefore = structuredClone(result);

  const report = applyVoyageHazardStageEscalationPlan(state, result);

  assertPrimaryFailure(report, "hazard-stage-escalation-application-live-hazard-mismatch", state, stateBefore, result, resultBefore);
});

test("valid live state reports prospective and change-set defects in order", () => {
  const invalidProspectiveState = makeState();
  const invalidProspectiveResult = makeResult(invalidProspectiveState);
  invalidProspectiveResult.plan.prospectiveHazard.status = VOYAGE_HAZARD_STATUSES.RESOLVED;
  const invalidProspectiveBefore = structuredClone(invalidProspectiveState);
  const invalidProspectiveResultBefore = structuredClone(invalidProspectiveResult);
  const invalidProspective = applyVoyageHazardStageEscalationPlan(invalidProspectiveState, invalidProspectiveResult);

  assertPrimaryFailure(
    invalidProspective,
    "hazard-stage-escalation-application-prospective-invalid",
    invalidProspectiveState,
    invalidProspectiveBefore,
    invalidProspectiveResult,
    invalidProspectiveResultBefore
  );

  const invalidChangeState = makeState();
  const invalidChangeResult = makeResult(invalidChangeState);
  invalidChangeResult.plan.prospectiveHazard.name = "unauthorized";
  const invalidChangeBefore = structuredClone(invalidChangeState);
  const invalidChangeResultBefore = structuredClone(invalidChangeResult);
  const invalidChange = applyVoyageHazardStageEscalationPlan(invalidChangeState, invalidChangeResult);

  assertPrimaryFailure(
    invalidChange,
    "hazard-stage-escalation-application-change-set-invalid",
    invalidChangeState,
    invalidChangeBefore,
    invalidChangeResult,
    invalidChangeResultBefore
  );
});

test("structurally valid maximum and invalid outcomes are not ready without live-state checks", () => {
  const maximumState = makeState();
  const maximum = makeMaximumResult(maximumState);
  const maximumStateBefore = structuredClone(maximumState);
  const maximumBefore = structuredClone(maximum);
  const maximumReport = applyVoyageHazardStageEscalationPlan(maximumState, maximum);

  assertPrimaryFailure(
    maximumReport,
    "hazard-stage-escalation-application-not-ready",
    maximumState,
    maximumStateBefore,
    maximum,
    maximumBefore
  );

  for (const mutate of [
    (result) => { result.plan.encounterId = ""; },
    (result) => { result.plan.expectedRevision = -1; }
  ]) {
    const state = makeState();
    const result = makeMaximumResult(state);
    mutate(result);
    const stateBefore = structuredClone(state);
    const resultBefore = structuredClone(result);
    const report = applyVoyageHazardStageEscalationPlan(state, result);

    assertPrimaryFailure(report, "hazard-stage-escalation-application-plan-invalid", state, stateBefore, result, resultBefore);
    assert.equal(codes(report).includes("hazard-stage-escalation-application-not-ready"), false);
  }

  const invalidState = makeState();
  const invalid = makeInvalidResult();
  const invalidStateBefore = structuredClone(invalidState);
  const invalidBefore = structuredClone(invalid);
  const invalidReport = applyVoyageHazardStageEscalationPlan(invalidState, invalid);

  assertPrimaryFailure(
    invalidReport,
    "hazard-stage-escalation-application-not-ready",
    invalidState,
    invalidStateBefore,
    invalid,
    invalidBefore
  );

  const extraInvalidState = makeState();
  const extraInvalid = makeInvalidResult();
  extraInvalid.extra = true;
  const extraInvalidStateBefore = structuredClone(extraInvalidState);
  const extraInvalidBefore = structuredClone(extraInvalid);
  const extraInvalidReport = applyVoyageHazardStageEscalationPlan(extraInvalidState, extraInvalid);

  assertPrimaryFailure(
    extraInvalidReport,
    "hazard-stage-escalation-application-plan-invalid",
    extraInvalidState,
    extraInvalidStateBefore,
    extraInvalid,
    extraInvalidBefore
  );
  assert.equal(codes(extraInvalidReport).includes("hazard-stage-escalation-application-not-ready"), false);
});

test("maximum, invalid, null, missing, wrong, and extra plan data are rejected", () => {
  const state = makeState();
  const maximum = makeMaximumResult(state);
  assertFailure(applyVoyageHazardStageEscalationPlan(state, maximum), "hazard-stage-escalation-application-not-ready");

  for (const result of [
    { ...makeResult(state), outcome: "invalid-or-not-applicable", plan: null },
    null,
    { ...makeResult(state), plan: { ...makeResult(state).plan, collisionPolicy: undefined } },
    { ...makeResult(state), plan: { ...makeResult(state).plan, collisionPolicy: "replace-existing" } },
    { ...makeResult(state), extra: true },
    { ...makeResult(state), plan: { ...makeResult(state).plan, extra: true } },
    { ...makeResult(state), plan: { ...makeResult(state).plan, prospectiveHazard: null } }
  ]) {
    const report = applyVoyageHazardStageEscalationPlan(state, result);
    assert.equal(report.ok, false);
    assert.equal(report.nextState, null);
    assert.deepEqual(report.events, []);
  }
});

test("revision overflow and invalid prospective/state data fail atomically", () => {
  const state = makeState();
  state.revision = Number.MAX_SAFE_INTEGER;
  const result = makeResult(makeState());
  result.plan.expectedRevision = Number.MAX_SAFE_INTEGER;
  assertFailure(applyVoyageHazardStageEscalationPlan(state, result), "hazard-stage-escalation-application-revision-overflow");

  const invalidProspective = makeState();
  const invalidResult = makeResult(invalidProspective);
  invalidResult.plan.prospectiveHazard.status = "resolved";
  assertFailure(applyVoyageHazardStageEscalationPlan(invalidProspective, invalidResult), "hazard-stage-escalation-application-prospective-invalid");

  const invalidState = makeState();
  const invalidStateResult = makeResult(invalidState);
  invalidState.momentum = 99;
  assertFailure(applyVoyageHazardStageEscalationPlan(invalidState, invalidStateResult), "hazard-stage-escalation-application-state-invalid");
});

test("hostile data, symbols, unsafe keys, cycles, sparse arrays, and coercion hooks fail safely", () => {
  let getterCalls = 0;
  const hostileState = makeState();
  Object.defineProperty(hostileState, "encounterId", { enumerable: true, get() { getterCalls += 1; throw new Error("secret"); } });
  assertFailure(applyVoyageHazardStageEscalationPlan(hostileState, makeResult()), "hazard-stage-escalation-application-data-read-failed");
  assert.equal(getterCalls, 0);

  const hostileResult = makeResult();
  Object.defineProperty(hostileResult, "plan", { enumerable: true, get() { getterCalls += 1; throw new Error("secret"); } });
  assertFailure(applyVoyageHazardStageEscalationPlan(makeState(), hostileResult), "hazard-stage-escalation-application-data-read-failed");
  assert.equal(getterCalls, 0);

  for (const value of [
    Object.assign(makeState(), { [Symbol("x")]: true }),
    Object.assign(makeState(), { constructor: true }),
    (() => { const value = makeState(); value.metadata = value; return value; })(),
    (() => { const value = makeState(); value.activeHazards = new Array(2); value.activeHazards[1] = stagedHazard(); return value; })(),
    (() => { const value = makeState(); value.metadata = { valueOf() { throw new Error("secret"); } }; return value; })()
  ]) {
    const report = applyVoyageHazardStageEscalationPlan(value, makeResult());
    assertFailure(report, "hazard-stage-escalation-application-data-read-failed");
  }
});

test("Proxy reflection failures fail safely without partial output", () => {
  const state = makeState();
  const ownKeysFailure = new Proxy(state, { ownKeys() { throw new Error("secret"); } });
  assertFailure(applyVoyageHazardStageEscalationPlan(ownKeysFailure, makeResult()), "hazard-stage-escalation-application-data-read-failed");

  const descriptorFailure = new Proxy(state, { getOwnPropertyDescriptor() { throw new Error("secret"); } });
  assertFailure(applyVoyageHazardStageEscalationPlan(descriptorFailure, makeResult()), "hazard-stage-escalation-application-data-read-failed");

  const prototypeFailure = new Proxy(state, { getPrototypeOf() { throw new Error("secret"); } });
  assertFailure(applyVoyageHazardStageEscalationPlan(prototypeFailure, makeResult()), "hazard-stage-escalation-application-data-read-failed");
});

test("caller inputs remain unchanged and equivalent calls are deterministic", () => {
  const state = makeState();
  const result = makeResult(state);
  const stateBefore = structuredClone(state);
  const resultBefore = structuredClone(result);
  const first = applyVoyageHazardStageEscalationPlan(state, result);
  const second = applyVoyageHazardStageEscalationPlan(state, result);

  assert.deepEqual(state, stateBefore);
  assert.deepEqual(result, resultBefore);
  assert.deepEqual(first, second);
  assert.notStrictEqual(first.nextState, second.nextState);
  assert.notStrictEqual(first.events[0], second.events[0]);
  assert.equal(validateVoyageEncounterState(first.nextState).valid, true);
});

test("application has no consequence, Pressure Breach, timing, lifecycle, Void Scar, UI, socket, authority, persistence, or Foundry behavior", () => {
  const state = makeState();
  const result = applyReady(state);
  assert.equal(result.events[0].type, "voyage.hazard-escalated");
  assert.equal(result.events.length, 1);
  assert.equal(result.nextState.activeHazards.length, state.activeHazards.length);
  assert.equal(result.nextState.pressureSystems[SYSTEM_A].value, state.pressureSystems[SYSTEM_A].value);
  assert.equal(Object.hasOwn(result.nextState, "voidScarProposal"), false);
});

test("successful event mapping contains no undefined values and exact snapshots", () => {
  const state = makeState();
  const task4B2 = makeResult(state);
  const result = applyVoyageHazardStageEscalationPlan(state, task4B2);
  const event = result.events[0];

  assert.equal(Object.values(event).some((value) => value === undefined), false);
  assert.equal(event.encounterId, state.encounterId);
  assert.equal(event.hazardId, task4B2.plan.existingHazardId);
  assert.equal(event.pressureSystemId, task4B2.plan.pressureSystemId);
  assert.equal(event.incomingHazardId, task4B2.plan.incomingHazardId);
  assert.equal(event.previousRevision, state.revision);
  assert.equal(event.revision, state.revision + 1);
  assert.equal(event.previousStageId, task4B2.plan.previousStageId);
  assert.equal(event.targetStageId, task4B2.plan.targetStageId);
  assert.deepEqual(event.previousHazard, task4B2.plan.previousExistingHazard);
  assert.deepEqual(event.hazard, task4B2.plan.prospectiveHazard);
});

test("success preserves every unrelated top-level state field", () => {
  const state = makeState();
  const before = structuredClone(state);
  const result = applyReady(state);

  for (const key of Object.keys(before)) {
    if (key === "activeHazards" || key === "revision") continue;
    assert.deepEqual(result.nextState[key], before[key], key);
  }
  assert.deepEqual(result.nextState.activeHazards.slice(1), before.activeHazards.slice(1));
  assert.deepEqual(state, before);
});

test("target-stage and operation plans retain their exact request combinations", () => {
  const targetState = makeState();
  const target = makeResult(targetState);
  assert.equal(target.plan.requestKind, "target-stage");
  assert.equal(typeof target.plan.requestedTargetStageId, "string");
  assert.equal(target.plan.requestedOperationId, null);

  const operationState = makeState();
  const operationIncoming = { ...incomingHazard(), metadata: { collision: { escalation: { operationId: "advance-one-stage" } } } };
  const operation = makeResult(operationState, operationIncoming);
  assert.equal(operation.plan.requestKind, "operation");
  assert.equal(operation.plan.requestedTargetStageId, null);
  assert.equal(operation.plan.requestedOperationId, "advance-one-stage");
  assert.equal(operation.plan.skippedStages, false);
});

test("invalid request combinations fail with no state or event", () => {
  const mutations = [
    (plan) => { plan.requestKind = "other"; },
    (plan) => { plan.requestKind = "target-stage"; plan.requestedTargetStageId = null; },
    (plan) => { plan.requestKind = "target-stage"; plan.requestedOperationId = "advance-one-stage"; },
    (plan) => { plan.requestKind = "operation"; plan.requestedTargetStageId = "stage-20"; },
    (plan) => { plan.requestKind = "operation"; plan.requestedOperationId = "other"; },
    (plan) => { plan.requestKind = "operation"; plan.skippedStages = true; },
    (plan) => { plan.targetStageId = ""; },
    (plan) => { plan.previousStageId = " "; }
  ];
  for (const mutate of mutations) {
    const state = makeState();
    const result = makeResult(state);
    mutate(result.plan);
    assertFailure(applyVoyageHazardStageEscalationPlan(state, result), "hazard-stage-escalation-application-plan-invalid");
  }
});

test("missing collisionPolicy, prospectiveHazard, and required plan fields fail exact validation", () => {
  const cases = [
    (plan) => { delete plan.collisionPolicy; },
    (plan) => { delete plan.prospectiveHazard; },
    (plan) => { delete plan.expectedRevision; },
    (plan) => { delete plan.existingHazardIndex; },
    (plan) => { delete plan.requestKind; }
  ];
  for (const mutate of cases) {
    const state = makeState();
    const result = makeResult(state);
    mutate(result.plan);
    assertFailure(applyVoyageHazardStageEscalationPlan(state, result), "hazard-stage-escalation-application-plan-invalid");
  }
});

test("invalid Hazard identities, categories, slots, status, and terminal fields fail before application", () => {
  const cases = [
    [(hazardValue) => { hazardValue.hazardId = "different"; }, "hazard-stage-escalation-application-prospective-invalid"],
    [(hazardValue) => { hazardValue.category = VOYAGE_HAZARD_CATEGORIES.EVENT; hazardValue.pressureSystemId = null; hazardValue.failurePressureSystemId = null; hazardValue.eventAreaId = "area-1"; }, "hazard-stage-escalation-application-prospective-invalid"],
    [(hazardValue) => { hazardValue.pressureSystemId = SYSTEM_B; hazardValue.failurePressureSystemId = SYSTEM_B; }, "hazard-stage-escalation-application-prospective-invalid"],
    [(hazardValue) => { hazardValue.status = VOYAGE_HAZARD_STATUSES.RESOLVED; hazardValue.terminalReason = "resolved"; hazardValue.resolvedStageId = "stage-10"; hazardValue.resolvedRoundNumber = 1; }, "hazard-stage-escalation-application-prospective-invalid"],
    [(hazardValue) => { hazardValue.terminalReason = "active-is-not-terminal"; }, "hazard-stage-escalation-application-prospective-invalid"]
  ];
  for (const [mutate, expectedCode] of cases) {
    const state = makeState();
    const result = makeResult(state);
    mutate(result.plan.prospectiveHazard);
    assertFailure(applyVoyageHazardStageEscalationPlan(state, result), expectedCode);
  }
});

test("state validation failure preserves the canonical state diagnostics and is atomic", () => {
  const state = makeState();
  const result = makeResult(state);
  state.activeHazards[0].terminalReason = "invalid-active-terminal";
  const before = structuredClone(state);
  const report = applyVoyageHazardStageEscalationPlan(state, result);

  assertFailure(report, "hazard-stage-escalation-application-state-invalid");
  assert.ok(report.errors.some(({ path }) => path === "state.activeHazards[0].terminalReason"));
  assert.deepEqual(state, before);
});

test("live snapshot comparison includes primitive values and nested descriptors", () => {
  const state = makeState();
  const result = makeResult(state);
  state.activeHazards[0].name = "different";
  assertFailure(applyVoyageHazardStageEscalationPlan(state, result), "hazard-stage-escalation-application-snapshot-mismatch");

  const nestedState = makeState();
  const nestedResult = makeResult(nestedState);
  nestedState.activeHazards[0].escalation.stages[0].effect.nested.values[0] = "different";
  assertFailure(applyVoyageHazardStageEscalationPlan(nestedState, nestedResult), "hazard-stage-escalation-application-snapshot-mismatch");
});

test("prospective changes outside the four authorized paths are rejected individually", () => {
  const paths = [
    (hazardValue) => { hazardValue.name = "different"; },
    (hazardValue) => { hazardValue.escalation.stages[0].effect.nested.values[0] = "different"; },
    (hazardValue) => { hazardValue.createdSequence = 99; },
    (hazardValue) => { hazardValue.metadata.collision.hazardId = "different"; },
    (hazardValue) => { hazardValue.pressureBreachId = "different"; }
  ];
  for (const mutate of paths) {
    const state = makeState();
    const result = makeResult(state);
    mutate(result.plan.prospectiveHazard);
    assertFailure(applyVoyageHazardStageEscalationPlan(state, result), "hazard-stage-escalation-application-change-set-invalid");
  }
});

test("authorized current stage, effect, ignored consequence, and maximum flag changes are independently accepted", () => {
  const mutations = [
    (hazardValue) => { hazardValue.escalation.currentStageId = "stage-20"; },
    (hazardValue) => { hazardValue.currentEffect = { effectId: "same-authorized-effect" }; },
    (hazardValue) => { hazardValue.ignoredConsequence = { consequenceId: "same-authorized-consequence" }; },
    (hazardValue) => { hazardValue.escalation.maximumEscalationReached = true; }
  ];
  for (const mutate of mutations) {
    const state = makeState();
    const result = makeResult(state);
    mutate(result.plan.prospectiveHazard);
    const report = applyVoyageHazardStageEscalationPlan(state, result);
    assert.equal(report.ok, true);
  }
});

test("nested hostile escalation result data is rejected without executing getters", () => {
  let calls = 0;
  const state = makeState();
  const result = makeResult(state);
  Object.defineProperty(result.plan.prospectiveHazard.currentEffect, "hostile", {
    enumerable: true,
    get() { calls += 1; throw new Error("secret"); }
  });
  const report = applyVoyageHazardStageEscalationPlan(state, result);

  assertFailure(report, "hazard-stage-escalation-application-data-read-failed");
  assert.equal(calls, 0);
});

test("nested symbols, unsafe keys, cycles, and unsupported values fail safely", () => {
  const mutations = [
    (result) => { result.plan.prospectiveHazard.currentEffect[Symbol("x")] = true; },
    (result) => { result.plan.prospectiveHazard.currentEffect.constructor = true; },
    (result) => { result.plan.prospectiveHazard.currentEffect.cycle = result.plan.prospectiveHazard.currentEffect; },
    (result) => { result.plan.prospectiveHazard.currentEffect.invalid = new Date(); },
    (result) => { result.plan.prospectiveHazard.currentEffect.invalid = new Map(); },
    (result) => { result.plan.prospectiveHazard.currentEffect.invalid = new Set(); },
    (result) => { result.plan.prospectiveHazard.currentEffect.invalid = new Uint8Array([1]); },
    (result) => { result.plan.prospectiveHazard.currentEffect.invalid = 1n; },
    (result) => { result.plan.prospectiveHazard.currentEffect.invalid = NaN; },
    (result) => { result.plan.prospectiveHazard.currentEffect.invalid = Infinity; },
    (result) => { result.plan.prospectiveHazard.currentEffect.invalid = undefined; },
    (result) => { result.plan.prospectiveHazard.currentEffect.invalid = () => {}; }
  ];
  for (const mutate of mutations) {
    const state = makeState();
    const result = makeResult(state);
    mutate(result);
    assertFailure(applyVoyageHazardStageEscalationPlan(state, result), "hazard-stage-escalation-application-data-read-failed");
  }
});

test("hostile nested Proxy reflection fails closed", () => {
  const traps = [
    { ownKeys() { throw new Error("secret"); } },
    { getOwnPropertyDescriptor() { throw new Error("secret"); } },
    { getPrototypeOf() { throw new Error("secret"); } }
  ];
  for (const handler of traps) {
    const state = makeState();
    const result = makeResult(state);
    result.plan.prospectiveHazard.currentEffect = new Proxy(result.plan.prospectiveHazard.currentEffect, handler);
    assertFailure(applyVoyageHazardStageEscalationPlan(state, result), "hazard-stage-escalation-application-data-read-failed");
  }
});

test("application rejects hostile result root and preserves deterministic diagnostics", () => {
  const state = makeState();
  const result = makeResult(state);
  const proxy = new Proxy(result, { getPrototypeOf() { throw new Error("secret"); } });
  const first = applyVoyageHazardStageEscalationPlan(state, proxy);
  const second = applyVoyageHazardStageEscalationPlan(state, proxy);

  assertFailure(first, "hazard-stage-escalation-application-data-read-failed");
  assert.deepEqual(first, second);
  assert.notStrictEqual(first.errors, second.errors);
});

test("failure results never expose partial state, events, revision, or consequence output", () => {
  const state = makeState();
  const result = makeResult(state);
  result.plan.prospectiveHazard.name = "unauthorized";
  const report = applyVoyageHazardStageEscalationPlan(state, result);

  assert.equal(report.ok, false);
  assert.equal(report.nextState, null);
  assert.deepEqual(report.events, []);
  assert.equal(Object.hasOwn(report, "revision"), false);
  assert.equal(Object.hasOwn(report, "consequence"), false);
  assert.equal(Object.hasOwn(report, "voidScarProposal"), false);
});

test("separate successful calls do not alias any returned structure", () => {
  const first = applyReady(makeState());
  const second = applyReady(makeState());

  assert.notStrictEqual(first.nextState, second.nextState);
  assert.notStrictEqual(first.nextState.activeHazards, second.nextState.activeHazards);
  assert.notStrictEqual(first.events, second.events);
  assert.notStrictEqual(first.events[0], second.events[0]);
  assert.notStrictEqual(first.events[0].previousHazard, second.events[0].previousHazard);
  assert.notStrictEqual(first.events[0].hazard, second.events[0].hazard);
  first.events[0].hazard.name = "changed";
  assert.equal(second.events[0].hazard.name, "Arc instability");
});
