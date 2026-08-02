import assert from "node:assert/strict";
import test from "node:test";

import { applyVoyageHazardTriggerExistingConsequence } from "../../../scripts/voyage/domain/hazard-trigger-existing-consequence.js";

const POLICY = "trigger-existing-consequence";

function hazard(overrides = {}) {
  return {
    hazardId: "existing-hazard",
    encounterId: "encounter",
    category: "system",
    status: "active",
    pressureSystemId: "crew-morale",
    collisionPolicy: POLICY,
    metadata: {
      collision: {
        consequence: {
          consequenceId: "existing-repeat",
          name: "Existing Repeat",
          description: "The existing consequence applies.",
          narrative: { kind: "authored", tags: ["repeat"] }
        }
      }
    },
    ...overrides
  };
}

function analysis(state, incoming, overrides = {}) {
  const existing = state.activeHazards[0] ?? null;
  return {
    structurallyValid: true,
    readyForHazardCollisionPlanning: true,
    collision: existing !== null,
    plan: {
      kind: existing ? "collision" : "no-collision",
      encounterId: state.encounterId,
      expectedRevision: state.revision,
      incomingHazardId: incoming.hazardId,
      existingHazardId: existing?.hazardId ?? null,
      existingHazardIndex: existing ? 0 : null,
      pressureSystemId: incoming.pressureSystemId,
      collisionPolicy: existing ? incoming.collisionPolicy : null,
      incomingHazard: structuredClone(incoming),
      existingHazard: existing ? structuredClone(existing) : null,
      collisionPayload: existing ? structuredClone(incoming.metadata.collision) : null,
      recommendedOperation: existing ? incoming.collisionPolicy : "persist-incoming",
      ...overrides
    },
    errors: [],
    warnings: []
  };
}

function stateWith(existingHazards) {
  return {
    encounterId: "encounter",
    revision: 3,
    activeHazards: existingHazards
  };
}

function incoming(overrides = {}) {
  return hazard({
    hazardId: "incoming-hazard",
    metadata: {
      collision: {
        consequence: {
          consequenceId: "incoming-repeat",
          name: "Incoming Repeat",
          description: "The incoming descriptor is not selected."
        }
      }
    },
    ...overrides
  });
}

function assertFailure(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.collision, false);
  assert.equal(result.activeHazards, null);
  assert.equal(result.consequence, null);
  assert.equal(Object.hasOwn(result, "collisionOutcome"), false);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.errors[0].code, code);
}

test("no collision returns isolated active Hazards without applying a consequence", () => {
  const state = stateWith([]);
  const candidate = incoming();
  const result = applyVoyageHazardTriggerExistingConsequence(
    state,
    candidate,
    analysis(state, candidate)
  );

  assert.equal(result.ok, true);
  assert.equal(result.collision, false);
  assert.equal(result.consequence, null);
  assert.equal(result.collisionOutcome, null);
  assert.deepEqual(result.activeHazards, []);
  assert.notStrictEqual(result.activeHazards, state.activeHazards);
  assert.deepEqual(state, stateWith([]));
});

test("trigger collision selects only the existing authored descriptor and preserves its slot", () => {
  const existing = hazard();
  const state = stateWith([existing]);
  const candidate = incoming();
  const before = structuredClone(state);
  const result = applyVoyageHazardTriggerExistingConsequence(
    state,
    candidate,
    analysis(state, candidate)
  );

  assert.equal(result.ok, true);
  assert.equal(result.collision, true);
  assert.deepEqual(result.consequence, existing.metadata.collision.consequence);
  assert.deepEqual(Object.keys(result.collisionOutcome), [
    "kind",
    "hazardId",
    "incomingHazardId",
    "pressureSystemId",
    "collisionPolicy",
    "consequence"
  ]);
  assert.deepEqual(result.collisionOutcome, {
    kind: "hazard-consequence-triggered",
    hazardId: existing.hazardId,
    incomingHazardId: candidate.hazardId,
    pressureSystemId: existing.pressureSystemId,
    collisionPolicy: POLICY,
    consequence: existing.metadata.collision.consequence
  });
  assert.deepEqual(result.activeHazards, [existing]);
  assert.notStrictEqual(result.activeHazards, state.activeHazards);
  assert.notStrictEqual(result.activeHazards[0], existing);
  assert.notStrictEqual(result.consequence, existing.metadata.collision.consequence);
  assert.notStrictEqual(
    result.collisionOutcome.consequence,
    existing.metadata.collision.consequence
  );

  result.activeHazards[0].metadata.collision.consequence.name = "changed-state";
  result.consequence.description = "changed-result";
  result.collisionOutcome.consequence.description = "changed-outcome";
  assert.deepEqual(state, before);
  assert.deepEqual(candidate, incoming());
});

test("malformed, stale, moved, mismatched, and policy-invalid plans fail atomically", () => {
  const existing = hazard();
  const candidate = incoming();
  const cases = [
    {
      name: "malformed result",
      result: null,
      code: "pressure-breach-application-collision-invalid"
    },
    {
      name: "wrong collision policy",
      mutate: (plan) => { plan.collisionPolicy = "replace-existing"; },
      code: "pressure-breach-application-collision-policy-invalid"
    },
    {
      name: "stale revision",
      mutate: (plan) => { plan.expectedRevision = 2; },
      code: "pressure-breach-application-revision-mismatch"
    },
    {
      name: "out-of-range existing Hazard index",
      mutate: (plan) => { plan.existingHazardIndex = 2; },
      code: "pressure-breach-application-index-invalid"
    },
    {
      name: "pressure-system mismatch",
      mutate: (plan) => { plan.pressureSystemId = "arkengine"; },
      code: "pressure-breach-application-collision-invalid"
    },
    {
      name: "incoming identity mismatch",
      mutate: (plan) => { plan.incomingHazardId = "different-incoming"; },
      code: "pressure-breach-application-collision-invalid"
    },
    {
      name: "changed snapshot",
      mutate: (plan) => { plan.existingHazard.name = "changed"; },
      code: "pressure-breach-application-snapshot-mismatch"
    },
    {
      name: "missing consequence",
      stateMutate: (state) => { delete state.activeHazards[0].metadata.collision.consequence; },
      code: "pressure-breach-application-consequence-invalid"
    },
    {
      name: "malformed consequence",
      stateMutate: (state) => { state.activeHazards[0].metadata.collision.consequence = {}; },
      code: "pressure-breach-application-consequence-invalid"
    }
  ];

  for (const entry of cases) {
    const state = stateWith([structuredClone(existing)]);
    if (entry.stateMutate) entry.stateMutate(state);
    const stateBefore = structuredClone(state);
    const plan = analysis(state, candidate);
    if (entry.mutate) entry.mutate(plan.plan);
    const result = applyVoyageHazardTriggerExistingConsequence(
      state,
      candidate,
      entry.result === undefined ? plan : entry.result
    );

    assert.equal(result.ok, false, entry.name);
    assertFailure(result, entry.code);
    assert.deepEqual(state, stateBefore, entry.name);
  }

  const movedState = stateWith([hazard({ hazardId: "other-hazard" }), existing]);
  const movedPlan = analysis(stateWith([existing]), candidate);
  const movedResult = applyVoyageHazardTriggerExistingConsequence(movedState, candidate, movedPlan);
  assertFailure(movedResult, "pressure-breach-application-live-hazard-mismatch");
});

test("separate equivalent calls do not share state, consequence, or plan data", () => {
  const firstState = stateWith([hazard()]);
  const secondState = stateWith([hazard()]);
  const firstCandidate = incoming();
  const secondCandidate = incoming();
  const first = applyVoyageHazardTriggerExistingConsequence(
    firstState,
    firstCandidate,
    analysis(firstState, firstCandidate)
  );
  const second = applyVoyageHazardTriggerExistingConsequence(
    secondState,
    secondCandidate,
    analysis(secondState, secondCandidate)
  );

  assert.deepEqual(first, second);
  assert.notStrictEqual(first.activeHazards, second.activeHazards);
  assert.notStrictEqual(first.consequence, second.consequence);
  first.consequence.name = "changed";
  assert.equal(second.consequence.name, "Existing Repeat");
});
