import assert from "node:assert/strict";
import test from "node:test";

import {
  VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS,
  getVoyagePressureBreachHazardDefinition
} from "../../../scripts/voyage/domain/pressure-breach-hazard-definitions.js";

const PRESSURE_SYSTEM_IDS = [
  "crew-morale",
  "arkengine",
  "levstone-array",
  "solar-sail-rig",
  "lifeveil"
];

const EXPECTED_IDS = {
  "crew-morale": {
    effectId: "crew-morale-fracture",
    criticalSuccessBenefit: {
      benefitId: "crew-morale-fracture-addressed-critical",
      name: "Crew Morale Restored",
      description: "A critical Address Hazard success produces this authored narrative benefit."
    },
    ignoredConsequenceId: "crew-morale-fracture-ignored",
    collisionConsequenceId: "crew-morale-repeat-breach"
  },
  arkengine: {
    effectId: "arkengine-instability",
    criticalSuccessBenefit: {
      benefitId: "arkengine-instability-addressed-critical",
      name: "Arkengine Stabilized",
      description: "A critical Address Hazard success produces this authored narrative benefit."
    },
    ignoredConsequenceId: "arkengine-instability-ignored",
    collisionConsequenceId: "arkengine-repeat-breach"
  },
  "levstone-array": {
    effectId: "levstone-gravity-shear",
    criticalSuccessBenefit: {
      benefitId: "levstone-gravity-shear-addressed-critical",
      name: "Levstone Array Stabilized",
      description: "A critical Address Hazard success produces this authored narrative benefit."
    },
    ignoredConsequenceId: "levstone-gravity-shear-ignored",
    collisionConsequenceId: "levstone-array-repeat-breach"
  },
  "solar-sail-rig": {
    effectId: "solar-sail-desynchronization",
    criticalSuccessBenefit: {
      benefitId: "solar-sail-desynchronization-addressed-critical",
      name: "Solar-Sail Rig Resynchronized",
      description: "A critical Address Hazard success produces this authored narrative benefit."
    },
    ignoredConsequenceId: "solar-sail-desynchronization-ignored",
    collisionConsequenceId: "solar-sail-rig-repeat-breach"
  },
  lifeveil: {
    effectId: "lifeveil-collapse",
    criticalSuccessBenefit: {
      benefitId: "lifeveil-collapse-addressed-critical",
      name: "Lifeveil Restored",
      description: "A critical Address Hazard success produces this authored narrative benefit."
    },
    ignoredConsequenceId: "lifeveil-collapse-ignored",
    collisionConsequenceId: "lifeveil-repeat-breach"
  }
};

function assertDeeplyFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
  if (value === null || typeof value !== "object") return;
  for (const child of Object.values(value)) assertDeeplyFrozen(child);
}

test("contains exactly the five canonical Pressure-system definitions", () => {
  assert.deepEqual(Object.keys(VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS).sort(), [...PRESSURE_SYSTEM_IDS].sort());
  assertDeeplyFrozen(VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS);
  assert.throws(() => { VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS.extra = {}; }, TypeError);
  assert.throws(() => { VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS["crew-morale"].currentEffect.name = "Changed"; }, TypeError);
  assert.throws(() => { VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS["crew-morale"].activationTiming.kind = "immediate"; }, TypeError);
  assert.throws(() => { VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS["crew-morale"].metadata.collision.consequence.name = "Changed"; }, TypeError);
  assert.throws(() => { VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS["crew-morale"].escalation.stages.push({}); }, TypeError);
  assert.throws(() => { VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS["crew-morale"].duration.mode = "rounds"; }, TypeError);
});

test("resolves each canonical definition with exact authored structure", () => {
  const registryBenefits = Object.fromEntries(PRESSURE_SYSTEM_IDS.map((pressureSystemId) => [
    pressureSystemId,
    structuredClone(VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS[pressureSystemId].removalMethod.criticalSuccessBenefit)
  ]));

  for (const pressureSystemId of PRESSURE_SYSTEM_IDS) {
    const result = getVoyagePressureBreachHazardDefinition(pressureSystemId);
    const expected = EXPECTED_IDS[pressureSystemId];

    assert.equal(result.ok, true, pressureSystemId);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(Object.keys(result.definition).sort(), [
      "activationTiming",
      "collisionPolicy",
      "currentEffect",
      "duration",
      "escalation",
      "ignoredConsequence",
      "metadata",
      "removalMethod"
    ].sort());
    assert.deepEqual(result.definition.activationTiming, {
      kind: "start-of-next-round",
      stationId: null,
      resultId: null
    });
    assert.deepEqual(result.definition.removalMethod, {
      methodId: "address-hazard",
      name: "Address Hazard",
      criticalSuccessBenefit: expected.criticalSuccessBenefit
    });
    assert.equal(result.definition.collisionPolicy, "trigger-existing-consequence");
    assert.deepEqual(result.definition.escalation, {
      mode: "none",
      currentStageId: null,
      stages: [],
      countdown: null,
      maximumEscalationReached: false,
      escalationConsequence: null
    });
    assert.deepEqual(result.definition.duration, {
      mode: "none",
      remaining: null,
      initial: null,
      decrementTiming: null
    });
    assert.equal(result.definition.currentEffect.effectId, expected.effectId);
    assert.deepEqual(result.definition.removalMethod.criticalSuccessBenefit, expected.criticalSuccessBenefit);
    result.definition.removalMethod.criticalSuccessBenefit.benefitId = "changed-benefit-id";
    result.definition.removalMethod.criticalSuccessBenefit.name = "Changed benefit";
    result.definition.removalMethod.criticalSuccessBenefit.description = "Changed description";
    const reread = getVoyagePressureBreachHazardDefinition(pressureSystemId);
    assert.deepEqual(reread.definition.removalMethod.criticalSuccessBenefit, registryBenefits[pressureSystemId], pressureSystemId);
    for (const otherPressureSystemId of PRESSURE_SYSTEM_IDS) {
      assert.deepEqual(
        VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS[otherPressureSystemId].removalMethod.criticalSuccessBenefit,
        registryBenefits[otherPressureSystemId],
        `${pressureSystemId}:${otherPressureSystemId}`
      );
    }
    assert.equal(result.definition.ignoredConsequence.consequenceId, expected.ignoredConsequenceId);
    assert.equal(result.definition.metadata.collision.consequence.consequenceId, expected.collisionConsequenceId);
    assert.deepEqual(Object.keys(result.definition.currentEffect).sort(), ["description", "effectId", "name"]);
    assert.deepEqual(Object.keys(result.definition.ignoredConsequence).sort(), ["consequenceId", "description", "name"]);
    assert.deepEqual(Object.keys(result.definition.metadata.collision).sort(), ["consequence"]);
    assert.deepEqual(Object.keys(result.definition.metadata.collision.consequence).sort(), ["consequenceId", "description", "name"]);
  }
});

test("rejects missing, blank, unknown, and malformed Pressure-system IDs", () => {
  for (const pressureSystemId of [
    undefined,
    null,
    "",
    " ",
    "unknown-system",
    42,
    {},
    [],
    Symbol("pressure"),
    new String("crew-morale"),
    () => "crew-morale"
  ]) {
    const result = getVoyagePressureBreachHazardDefinition(pressureSystemId);

    assert.equal(result.ok, false);
    assert.equal(result.definition, null);
    assert.deepEqual(result.errors, [{
      code: "pressure-breach-hazard-definition-missing",
      path: "$.pressureSystemId",
      message: "No authored Pressure-system Hazard definition exists for this pressureSystemId.",
      severity: "error"
    }]);
    assert.deepEqual(result.warnings, []);
  }
});

test("rejects Proxy IDs without invoking caller traps", () => {
  let trapCount = 0;
  const pressureSystemId = new Proxy({}, {
    get() {
      trapCount += 1;
      throw new Error("must not read Proxy data");
    },
    getPrototypeOf() {
      trapCount += 1;
      throw new Error("must not reflect Proxy data");
    },
    ownKeys() {
      trapCount += 1;
      throw new Error("must not enumerate Proxy data");
    }
  });

  const result = getVoyagePressureBreachHazardDefinition(pressureSystemId);

  assert.equal(result.ok, false);
  assert.equal(trapCount, 0);
});

test("rejects coercion objects without invoking coercion hooks", () => {
  let coercionCalls = 0;
  const value = {
    [Symbol.toPrimitive]() {
      coercionCalls += 1;
      throw new Error("must not coerce");
    },
    toString() {
      coercionCalls += 1;
      throw new Error("must not stringify");
    },
    valueOf() {
      coercionCalls += 1;
      throw new Error("must not valueOf");
    }
  };

  const result = getVoyagePressureBreachHazardDefinition(value);

  assert.equal(result.ok, false);
  assert.equal(coercionCalls, 0);
});

test("returns isolated mutable definition data without exposing the frozen registry", () => {
  const first = getVoyagePressureBreachHazardDefinition("crew-morale");
  const second = getVoyagePressureBreachHazardDefinition("crew-morale");

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.notStrictEqual(first.definition, second.definition);
  assert.notStrictEqual(first.definition.currentEffect, second.definition.currentEffect);
  assert.notStrictEqual(first.definition.metadata.collision.consequence, second.definition.metadata.collision.consequence);

  first.definition.currentEffect.name = "Changed";
  first.definition.metadata.collision.consequence.description = "Changed";

  assert.equal(second.definition.currentEffect.name, "Crew Morale Fracture");
  assert.equal(
    second.definition.metadata.collision.consequence.description,
    "A repeated Crew Morale breach triggers the existing Hazard's authored consequence."
  );
  assert.equal(
    VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS["crew-morale"].currentEffect.name,
    "Crew Morale Fracture"
  );
});
