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
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { analyzeVoyageHazardCollisionPlan } from "../../../scripts/voyage/domain/hazard-collision.js";

const [SYSTEM_A, SYSTEM_B] = VOYAGE_PRESSURE_SYSTEM_IDS;

function timing() {
  return {
    kind: VOYAGE_HAZARD_TIMING_KINDS.IMMEDIATE,
    stationId: null,
    resultId: null
  };
}

function hazard(overrides = {}) {
  return {
    hazardId: "hazard-incoming",
    encounterId: "encounter-1",
    category: VOYAGE_HAZARD_CATEGORIES.SYSTEM,
    status: VOYAGE_HAZARD_STATUSES.ACTIVE,
    name: "Arc instability",
    currentEffect: {
      effectId: "current-effect",
      nested: { values: [1] }
    },
    activationTiming: timing(),
    removalMethod: { methodId: "address-hazard" },
    ignoredConsequence: {
      consequenceId: "ignored-consequence",
      nested: { values: [2] }
    },
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

function stateWithHazards(activeHazards = []) {
  const state = createVoyageEncounterState({ encounterId: "encounter-1" });
  state.activeHazards = activeHazards;
  return state;
}

function existingHazard(overrides = {}) {
  return hazard({
    hazardId: "hazard-existing",
    metadata: { collision: { hazardId: "replacement-hazard" } },
    ...overrides
  });
}

function collisionPayload(policy) {
  if (policy === VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING) {
    return { targetStageId: "stage-2" };
  }
  if (policy === VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING) {
    return { hazardId: "replacement-hazard" };
  }
  if (policy === VOYAGE_HAZARD_COLLISION_POLICIES.TRIGGER_EXISTING_CONSEQUENCE) {
    return { consequence: { consequenceId: "trigger-consequence" } };
  }
  if (policy === VOYAGE_HAZARD_COLLISION_POLICIES.EXTEND_DURATION) {
    return { amount: 1 };
  }
  return { pressureSystemId: SYSTEM_A, amount: 1 };
}

function incomingForPolicy(policy, overrides = {}) {
  return hazard({
    collisionPolicy: policy,
    metadata: { collision: collisionPayload(policy) },
    ...overrides
  });
}

function codes(report) {
  return report.errors.map((error) => error.code);
}

test("valid system Hazard with no occupied slot produces a no-collision plan", () => {
  const result = analyzeVoyageHazardCollisionPlan(stateWithHazards(), hazard());

  assert.equal(result.readyForHazardCollisionPlanning, true);
  assert.equal(result.collision, false);
  assert.equal(result.plan.kind, "no-collision");
  assert.equal(result.plan.existingHazard, null);
  assert.equal(result.plan.collisionPolicy, null);
  assert.equal(result.plan.collisionPayload, null);
});

test("no-collision recommends persist-incoming", () => {
  const result = analyzeVoyageHazardCollisionPlan(stateWithHazards(), hazard());

  assert.equal(result.plan.recommendedOperation, "persist-incoming");
  assert.equal(result.plan.incomingHazardId, "hazard-incoming");
});

test("no-collision does not mutate or persist anything", () => {
  const state = stateWithHazards();
  const incoming = hazard();
  const stateBefore = structuredClone(state);
  const incomingBefore = structuredClone(incoming);

  const result = analyzeVoyageHazardCollisionPlan(state, incoming);

  assert.deepEqual(state, stateBefore);
  assert.deepEqual(incoming, incomingBefore);
  assert.deepEqual(state.activeHazards, []);
  assert.equal(result.plan.incomingHazard.hazardId, incoming.hazardId);
});

test("matching system Hazard produces a collision plan", () => {
  const result = analyzeVoyageHazardCollisionPlan(
    stateWithHazards([existingHazard()]),
    incomingForPolicy(VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING)
  );

  assert.equal(result.readyForHazardCollisionPlanning, true);
  assert.equal(result.collision, true);
  assert.equal(result.plan.kind, "collision");
});

test("collision identifies the exact existing Hazard index and ID", () => {
  const existing = existingHazard();
  const state = stateWithHazards([
    hazard({ hazardId: "other-system", pressureSystemId: SYSTEM_B, failurePressureSystemId: SYSTEM_B }),
    existing
  ]);

  const result = analyzeVoyageHazardCollisionPlan(state, incomingForPolicy(
    VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING
  ));

  assert.equal(result.plan.existingHazardId, existing.hazardId);
  assert.equal(result.plan.existingHazardIndex, 1);
});

test("collision preserves the incoming policy exactly", () => {
  const policy = VOYAGE_HAZARD_COLLISION_POLICIES.EXTEND_DURATION;
  const result = analyzeVoyageHazardCollisionPlan(
    stateWithHazards([existingHazard()]),
    incomingForPolicy(policy)
  );

  assert.equal(result.plan.collisionPolicy, policy);
  assert.equal(result.plan.recommendedOperation, policy);
});

test("collision preserves an isolated incoming collision payload exactly", () => {
  const payload = { consequence: { consequenceId: "trigger-consequence", nested: { value: 1 } } };
  const incoming = incomingForPolicy(
    VOYAGE_HAZARD_COLLISION_POLICIES.TRIGGER_EXISTING_CONSEQUENCE,
    { metadata: { collision: payload } }
  );
  const result = analyzeVoyageHazardCollisionPlan(stateWithHazards([existingHazard()]), incoming);

  assert.deepEqual(result.plan.collisionPayload, payload);
  assert.notStrictEqual(result.plan.collisionPayload, incoming.metadata.collision);
  assert.notStrictEqual(result.plan.collisionPayload.consequence, incoming.metadata.collision.consequence);
});

test("each canonical collision policy produces a declarative collision plan", () => {
  for (const policy of Object.values(VOYAGE_HAZARD_COLLISION_POLICIES)) {
    const result = analyzeVoyageHazardCollisionPlan(
      stateWithHazards([existingHazard()]),
      incomingForPolicy(policy)
    );

    assert.equal(result.plan.kind, "collision", policy);
    assert.equal(result.plan.recommendedOperation, policy, policy);
  }
});

test("analysis executes no collision policy", () => {
  const state = stateWithHazards([existingHazard()]);
  const incoming = incomingForPolicy(VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING);
  const stateBefore = structuredClone(state);

  const result = analyzeVoyageHazardCollisionPlan(state, incoming);

  assert.deepEqual(state, stateBefore);
  assert.equal(result.plan.recommendedOperation, "replace-existing");
  assert.equal(result.plan.events, undefined);
  assert.equal(result.plan.nextState, undefined);
});

test("event Hazards never occupy a system slot", () => {
  const incoming = hazard({
    hazardId: "event-incoming",
    category: VOYAGE_HAZARD_CATEGORIES.EVENT,
    pressureSystemId: null,
    eventAreaId: "engine-room",
    failurePressureSystemId: null
  });
  const result = analyzeVoyageHazardCollisionPlan(stateWithHazards([existingHazard()]), incoming);

  assert.equal(result.plan.kind, "no-collision");
  assert.equal(result.plan.recommendedOperation, "persist-incoming");
});

test("event Hazards with matching failurePressureSystemId do not collide", () => {
  const incoming = hazard({
    hazardId: "event-incoming",
    category: VOYAGE_HAZARD_CATEGORIES.EVENT,
    pressureSystemId: null,
    eventAreaId: "engine-room",
    failurePressureSystemId: SYSTEM_A
  });
  const result = analyzeVoyageHazardCollisionPlan(stateWithHazards([existingHazard()]), incoming);

  assert.equal(result.plan.kind, "no-collision");
  assert.equal(result.plan.pressureSystemId, null);
});

test("different Pressure systems do not collide", () => {
  const incoming = hazard({ pressureSystemId: SYSTEM_B, failurePressureSystemId: SYSTEM_B });
  const result = analyzeVoyageHazardCollisionPlan(stateWithHazards([existingHazard()]), incoming);

  assert.equal(result.plan.kind, "no-collision");
  assert.equal(result.plan.existingHazard, null);
});

test("shared eventAreaId does not create a collision", () => {
  const event = hazard({
    hazardId: "event-existing",
    category: VOYAGE_HAZARD_CATEGORIES.EVENT,
    pressureSystemId: null,
    eventAreaId: "engine-room",
    failurePressureSystemId: null
  });
  const incoming = hazard({
    hazardId: "event-incoming",
    category: VOYAGE_HAZARD_CATEGORIES.EVENT,
    pressureSystemId: null,
    eventAreaId: "engine-room",
    failurePressureSystemId: null
  });
  const result = analyzeVoyageHazardCollisionPlan(stateWithHazards([event]), incoming);

  assert.equal(result.plan.kind, "no-collision");
});

test("invalid state fails safely", () => {
  const state = stateWithHazards();
  state.activeHazards = null;

  const result = analyzeVoyageHazardCollisionPlan(state, hazard());

  assert.equal(result.readyForHazardCollisionPlanning, false);
  assert.equal(result.plan, null);
  assert.ok(codes(result).includes("hazard-collision-analysis-state-invalid"));
});

test("invalid incoming Hazard fails safely", () => {
  const incoming = hazard();
  delete incoming.name;

  const result = analyzeVoyageHazardCollisionPlan(stateWithHazards(), incoming);

  assert.equal(result.readyForHazardCollisionPlanning, false);
  assert.equal(result.plan, null);
  assert.ok(codes(result).includes("hazard-collision-analysis-incoming-invalid"));
  assert.ok(codes(result).includes("missing-hazard-field"));
});

test("terminal incoming Hazard fails active-mode validation", () => {
  const incoming = hazard({
    status: VOYAGE_HAZARD_STATUSES.EXPIRED,
    terminalReason: "duration-ended"
  });

  const result = analyzeVoyageHazardCollisionPlan(stateWithHazards(), incoming);

  assert.equal(result.readyForHazardCollisionPlanning, false);
  assert.ok(codes(result).includes("invalid-hazard-active-status"));
});

test("encounter mismatch fails safely", () => {
  const incoming = hazard({ encounterId: "other-encounter" });

  const result = analyzeVoyageHazardCollisionPlan(stateWithHazards(), incoming);

  assert.equal(result.readyForHazardCollisionPlanning, false);
  assert.ok(codes(result).includes("hazard-encounter-id-mismatch"));
});

test("hostile incoming getters fail without executing them", () => {
  const incoming = hazard();
  let reads = 0;
  Object.defineProperty(incoming, "name", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("getter must not execute");
    }
  });

  const result = analyzeVoyageHazardCollisionPlan(stateWithHazards(), incoming);

  assert.equal(reads, 0);
  assert.equal(result.readyForHazardCollisionPlanning, false);
  assert.ok(codes(result).includes("hazard-collision-analysis-incoming-invalid"));
});

test("hostile state Proxy failures fail safely", () => {
  const state = stateWithHazards();
  const hostile = new Proxy(state, {
    ownKeys() {
      throw new Error("reflection must not escape");
    }
  });

  const result = analyzeVoyageHazardCollisionPlan(hostile, hazard());

  assert.equal(result.readyForHazardCollisionPlanning, false);
  assert.ok(codes(result).includes("hazard-collision-analysis-data-read-failed"));
  assert.ok(codes(result).includes("hazard-collision-analysis-state-invalid"));
});

test("invalid collision payload fails through the Task 1 schema", () => {
  const incoming = incomingForPolicy(VOYAGE_HAZARD_COLLISION_POLICIES.EXTEND_DURATION, {
    metadata: { collision: { amount: 0 } }
  });

  const result = analyzeVoyageHazardCollisionPlan(stateWithHazards(), incoming);

  assert.equal(result.readyForHazardCollisionPlanning, false);
  assert.ok(codes(result).includes("invalid-hazard-collision-amount"));
  assert.ok(result.errors.some((error) => error.path === "incomingHazard.metadata.collision.amount"));
});

test("returned plans do not alias caller data", () => {
  const state = stateWithHazards([existingHazard()]);
  const incoming = incomingForPolicy(VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING);
  const stateBefore = structuredClone(state);
  const incomingBefore = structuredClone(incoming);
  const result = analyzeVoyageHazardCollisionPlan(state, incoming);

  result.plan.incomingHazard.currentEffect.nested.values[0] = 99;
  result.plan.existingHazard.ignoredConsequence.nested.values[0] = 98;
  result.plan.collisionPayload.hazardId = "mutated";

  assert.deepEqual(state, stateBefore);
  assert.deepEqual(incoming, incomingBefore);
});

test("nested incoming and existing data are isolated in separate snapshots", () => {
  const state = stateWithHazards([existingHazard()]);
  const incoming = incomingForPolicy(VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING);
  const result = analyzeVoyageHazardCollisionPlan(state, incoming);

  assert.notStrictEqual(result.plan.incomingHazard.currentEffect, incoming.currentEffect);
  assert.notStrictEqual(result.plan.existingHazard.currentEffect, state.activeHazards[0].currentEffect);
  assert.notStrictEqual(result.plan.incomingHazard.currentEffect.nested, incoming.currentEffect.nested);
  assert.notStrictEqual(result.plan.existingHazard.currentEffect.nested, state.activeHazards[0].currentEffect.nested);
});

test("analysis preserves activeHazards ordering while reporting the existing index", () => {
  const event = hazard({
    hazardId: "event-before",
    category: VOYAGE_HAZARD_CATEGORIES.EVENT,
    pressureSystemId: null,
    eventAreaId: "engine-room",
    failurePressureSystemId: null
  });
  const existing = existingHazard();
  const state = stateWithHazards([event, existing]);
  const before = structuredClone(state.activeHazards);
  const result = analyzeVoyageHazardCollisionPlan(state, incomingForPolicy(
    VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING
  ));

  assert.equal(result.plan.existingHazardIndex, 1);
  assert.deepEqual(state.activeHazards, before);
});

test("analysis preserves revision and returns the expected revision separately", () => {
  const state = stateWithHazards([existingHazard()]);
  state.revision = 7;
  const result = analyzeVoyageHazardCollisionPlan(state, incomingForPolicy(
    VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING
  ));

  assert.equal(result.plan.expectedRevision, 7);
  assert.equal(state.revision, 7);
});

test("analysis emits no events", () => {
  const result = analyzeVoyageHazardCollisionPlan(
    stateWithHazards([existingHazard()]),
    incomingForPolicy(VOYAGE_HAZARD_COLLISION_POLICIES.TRIGGER_EXISTING_CONSEQUENCE)
  );

  assert.equal(result.events, undefined);
  assert.equal(result.plan.events, undefined);
});

test("analysis does not change Pressure", () => {
  const state = stateWithHazards([existingHazard()]);
  const pressureBefore = structuredClone(state.pressureSystems);

  analyzeVoyageHazardCollisionPlan(
    state,
    incomingForPolicy(VOYAGE_HAZARD_COLLISION_POLICIES.ADD_PRESSURE)
  );

  assert.deepEqual(state.pressureSystems, pressureBefore);
});

test("analysis does not create a Void Scar proposal", () => {
  const result = analyzeVoyageHazardCollisionPlan(
    stateWithHazards([existingHazard()]),
    incomingForPolicy(VOYAGE_HAZARD_COLLISION_POLICIES.ADD_PRESSURE)
  );

  assert.equal(result.voidScarProposal, undefined);
  assert.equal(result.plan.voidScarProposal, undefined);
});

test("analysis does not create, remove, escalate, replace, resolve, or expire Hazards", () => {
  const state = stateWithHazards([existingHazard()]);
  const stateBefore = structuredClone(state);

  analyzeVoyageHazardCollisionPlan(
    state,
    incomingForPolicy(VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING)
  );

  assert.deepEqual(state, stateBefore);
});

test("equivalent inputs produce deeply equivalent plans", () => {
  const first = analyzeVoyageHazardCollisionPlan(
    stateWithHazards([existingHazard()]),
    incomingForPolicy(VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING)
  );
  const second = analyzeVoyageHazardCollisionPlan(
    stateWithHazards([existingHazard()]),
    incomingForPolicy(VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING)
  );

  assert.deepEqual(first, second);
});

test("inputs remain unchanged after mutating the returned plan", () => {
  const state = stateWithHazards([existingHazard()]);
  const incoming = incomingForPolicy(VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING);
  const stateBefore = structuredClone(state);
  const incomingBefore = structuredClone(incoming);
  const result = analyzeVoyageHazardCollisionPlan(state, incoming);

  result.plan.incomingHazard.metadata.collision.hazardId = "changed";
  result.plan.existingHazard.metadata.collision.hazardId = "changed-existing";
  result.plan.collisionPayload.hazardId = "changed-payload";

  assert.deepEqual(state, stateBefore);
  assert.deepEqual(incoming, incomingBefore);
});
