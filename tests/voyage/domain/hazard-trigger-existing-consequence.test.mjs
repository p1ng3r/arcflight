import assert from "node:assert/strict";
import test from "node:test";

import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import {
  applyVoyageEncounterPressureBreachPlan,
  buildVoyagePressureBreachActiveHazard
} from "../../../scripts/voyage/domain/pressure-breach.js";
import { applyVoyageHazardTriggerExistingConsequence } from "../../../scripts/voyage/domain/hazard-trigger-existing-consequence.js";

const POLICY = "trigger-existing-consequence";

function activeHazard({
  hazardId,
  pressureSystemId = "crew-morale",
  encounterId = "encounter"
} = {}) {
  const result = buildVoyagePressureBreachActiveHazard({
    hazardId,
    pressureBreachId: `${hazardId}-breach`,
    encounterId,
    stageId: "stage",
    roundNumber: 1,
    effectIndex: 0,
    sequence: 0,
    stationId: "captain",
    actionId: "action",
    pressureSystemId,
    category: "system",
    status: "active",
    sourceKind: "pressure-breach",
    pressureEffectId: `${hazardId}-effect`,
    sourceIntentId: null,
    activationSource: "action-outcome",
    branch: "failure",
    timing: "consequences",
    visibility: "public",
    name: `${pressureSystemId} Breach`
  });
  assert.equal(result.ok, true);
  return result.hazard;
}

function stateWith(activeHazards = []) {
  const state = createVoyageEncounterState({
    encounterId: "encounter",
    definitionId: "definition",
    primaryShip: { id: "ship" }
  });
  state.activeHazards = activeHazards;
  return state;
}

function fabricatedNoCollision() {
  return {
    structurallyValid: true,
    readyForHazardCollisionPlanning: true,
    collision: false,
    plan: { kind: "no-collision", fabricated: true },
    errors: [],
    warnings: []
  };
}

function fabricatedTriggerCollision() {
  return {
    structurallyValid: true,
    readyForHazardCollisionPlanning: true,
    collision: true,
    plan: { kind: "collision", existingHazardIndex: 99, fabricated: true },
    errors: [],
    warnings: []
  };
}

function assertFailure(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.collision, false);
  assert.equal(result.activeHazards, null);
  assert.equal(result.consequence, null);
  assert.equal(result.collisionOutcome, null);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.errors[0].code, code);
}

test("noncanonical request rejects a fabricated no-collision analysis without mutation", () => {
  const state = { encounterId: "encounter", activeHazards: [] };
  const incoming = { hazardId: "incoming-hazard", encounterId: "encounter" };
  const before = structuredClone({ state, incoming });

  const result = applyVoyageHazardTriggerExistingConsequence(
    state,
    incoming,
    fabricatedNoCollision()
  );

  assertFailure(result, "pressure-breach-application-state-invalid");
  assert.deepEqual({ state, incoming }, before);
});

test("canonical collision regenerates analysis and ignores a fabricated no-collision result", () => {
  const existing = activeHazard({ hazardId: "existing-hazard" });
  const state = stateWith([existing]);
  const incoming = activeHazard({ hazardId: "incoming-hazard" });
  const before = structuredClone({ state, incoming });

  const result = applyVoyageHazardTriggerExistingConsequence(
    state,
    incoming,
    fabricatedNoCollision()
  );

  assert.equal(result.ok, true);
  assert.equal(result.collision, true);
  assert.deepEqual(result.activeHazards, [existing]);
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
    incomingHazardId: incoming.hazardId,
    pressureSystemId: existing.pressureSystemId,
    collisionPolicy: POLICY,
    consequence: existing.metadata.collision.consequence
  });
  assert.notStrictEqual(result.activeHazards, state.activeHazards);
  assert.notStrictEqual(result.activeHazards[0], existing);
  assert.notStrictEqual(result.consequence, existing.metadata.collision.consequence);
  assert.equal(result.activeHazards.some(({ hazardId }) => hazardId === incoming.hazardId), false);
  result.activeHazards[0].name = "changed";
  result.consequence.description = "changed";
  result.collisionOutcome.consequence.name = "changed";
  assert.deepEqual({ state, incoming }, before);
});

test("canonical no-collision regenerates analysis and ignores a fabricated collision result", () => {
  const existing = activeHazard({ hazardId: "existing-hazard", pressureSystemId: "crew-morale" });
  const state = stateWith([existing]);
  const incoming = activeHazard({ hazardId: "incoming-hazard", pressureSystemId: "arkengine" });
  const before = structuredClone({ state, incoming });

  const result = applyVoyageHazardTriggerExistingConsequence(
    state,
    incoming,
    fabricatedTriggerCollision()
  );

  assert.equal(result.ok, true);
  assert.equal(result.collision, false);
  assert.deepEqual(result.activeHazards, [existing]);
  assert.equal(result.consequence, null);
  assert.equal(result.collisionOutcome, null);
  assert.equal(result.activeHazards.some(({ hazardId }) => hazardId === incoming.hazardId), false);
  assert.deepEqual({ state, incoming }, before);
});

test("invalid canonical requests fail closed and repeated outcomes are isolated", () => {
  const existing = activeHazard({ hazardId: "existing-hazard" });
  const incoming = activeHazard({ hazardId: "incoming-hazard" });
  const cases = [
    {
      name: "encounter mismatch",
      state: stateWith([existing]),
      incoming: activeHazard({ hazardId: "mismatched-hazard", encounterId: "other-encounter" }),
      code: "pressure-breach-application-hazard-invalid"
    },
    {
      name: "unsupported collision policy",
      state: stateWith([existing]),
      incoming: { ...incoming, collisionPolicy: "replace-existing" },
      code: "pressure-breach-application-hazard-invalid"
    },
    {
      name: "canonical unsupported policy without a collision",
      state: stateWith([existing]),
      incoming: {
        ...activeHazard({ hazardId: "replacement-hazard", pressureSystemId: "arkengine" }),
        collisionPolicy: "replace-existing",
        metadata: { collision: { hazardId: "replacement-target" } }
      },
      code: "pressure-breach-application-collision-policy-invalid"
    },
    {
      name: "missing existing consequence",
      state: (() => {
        const state = stateWith([structuredClone(existing)]);
        delete state.activeHazards[0].metadata.collision.consequence;
        return state;
      })(),
      incoming,
      code: "pressure-breach-application-state-invalid"
    }
  ];

  for (const entry of cases) {
    const before = structuredClone({ state: entry.state, incoming: entry.incoming });
    const result = applyVoyageHazardTriggerExistingConsequence(entry.state, entry.incoming, fabricatedNoCollision());
    assertFailure(result, entry.code);
    assert.deepEqual({ state: entry.state, incoming: entry.incoming }, before, entry.name);
  }

  const first = applyVoyageHazardTriggerExistingConsequence(stateWith([existing]), incoming, fabricatedNoCollision());
  const second = applyVoyageHazardTriggerExistingConsequence(stateWith([existing]), incoming, fabricatedTriggerCollision());
  assert.equal(first.ok, true);
  assert.deepEqual(first, second);
  assert.notStrictEqual(first.activeHazards, second.activeHazards);
  assert.notStrictEqual(first.consequence, second.consequence);
});

test("Pressure Breach keeps its public transaction contract while using the request-only helper", () => {
  const source = stateWith([activeHazard({ hazardId: "existing-hazard" })]);
  source.lifecycleState = "active";
  source.currentStage = { stageId: "stage" };
  source.roundNumber = 1;
  source.phase = "consequences";
  const result = applyVoyageEncounterPressureBreachPlan(source);

  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
});
