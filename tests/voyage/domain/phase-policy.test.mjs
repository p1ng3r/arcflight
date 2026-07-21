import assert from "node:assert/strict";
import test from "node:test";
import {
  getAllowedVoyagePhaseTransitions,
  getVoyagePhaseTransitionPolicy,
  isLegalVoyagePhaseTransition,
  validateVoyagePhaseTransition
} from "../../../scripts/voyage/domain/phase.js";
import { VOYAGE_ROUND_PHASES } from "../../../scripts/voyage/domain/constants.js";

const PHASES = VOYAGE_ROUND_PHASES;
const PHASE_VALUES = Object.values(PHASES);
const ACCEPTED_TRANSITIONS = {
  [PHASES.SITUATION]: [PHASES.CREW_PLANNING],
  [PHASES.CREW_PLANNING]: [PHASES.LOCK_READINESS],
  [PHASES.LOCK_READINESS]: [PHASES.RESOLUTION],
  [PHASES.RESOLUTION]: [PHASES.CONSEQUENCES],
  [PHASES.CONSEQUENCES]: [PHASES.CLEANUP_ADVANCE],
  [PHASES.CLEANUP_ADVANCE]: []
};

test("accepts every ordinary forward Voyage Round phase edge", () => {
  for (const [fromPhase, allowedTargets] of Object.entries(ACCEPTED_TRANSITIONS)) {
    for (const toPhase of allowedTargets) {
      const report = validateVoyagePhaseTransition(fromPhase, toPhase);
      assert.equal(isLegalVoyagePhaseTransition(fromPhase, toPhase), true);
      assert.equal(report.valid, true);
      assert.deepEqual(report.errors, []);
      assert.deepEqual(report.warnings, []);
    }
  }
});

test("Cleanup and Advance has no ordinary outgoing transition", () => {
  const first = getAllowedVoyagePhaseTransitions(PHASES.CLEANUP_ADVANCE);
  const second = getAllowedVoyagePhaseTransitions(PHASES.CLEANUP_ADVANCE);
  assert.deepEqual(first, []);
  assert.notEqual(first, second);
  assert.equal(isLegalVoyagePhaseTransition(PHASES.CLEANUP_ADVANCE, PHASES.SITUATION), false);
});

test("rejects skipped and backward recognized phase transitions", () => {
  for (const [fromPhase, toPhase] of [
    [PHASES.SITUATION, PHASES.LOCK_READINESS],
    [PHASES.CREW_PLANNING, PHASES.RESOLUTION],
    [PHASES.CONSEQUENCES, PHASES.RESOLUTION],
    [PHASES.CLEANUP_ADVANCE, PHASES.SITUATION]
  ]) {
    const report = validateVoyagePhaseTransition(fromPhase, toPhase);
    assert.equal(isLegalVoyagePhaseTransition(fromPhase, toPhase), false);
    assert.deepEqual(report.errors, [{
      code: "illegal-voyage-phase-transition",
      path: "toPhase",
      message: "The Voyage phase transition is not permitted by policy.",
      severity: "error"
    }]);
    assert.ok(Array.isArray(report.warnings));
  }
});

test("rejects every same-phase transition without an illegal-edge error", () => {
  for (const phase of PHASE_VALUES) {
    const report = validateVoyagePhaseTransition(phase, phase);
    assert.equal(isLegalVoyagePhaseTransition(phase, phase), false);
    assert.deepEqual(report.errors, [{
      code: "same-voyage-phase",
      path: "toPhase",
      message: "Voyage phase transitions must change phase.",
      severity: "error"
    }]);
  }
});

test("collects ordered phase recognition errors", () => {
  assert.deepEqual(validateVoyagePhaseTransition("unknown-source", PHASES.SITUATION).errors, [{
    code: "invalid-source-voyage-phase",
    path: "fromPhase",
    message: "Source Voyage phase is not recognized.",
    severity: "error"
  }]);
  assert.deepEqual(validateVoyagePhaseTransition(PHASES.SITUATION, "unknown-target").errors, [{
    code: "invalid-target-voyage-phase",
    path: "toPhase",
    message: "Target Voyage phase is not recognized.",
    severity: "error"
  }]);
  assert.deepEqual(validateVoyagePhaseTransition("unknown-source", "unknown-target").errors, [
    {
      code: "invalid-source-voyage-phase",
      path: "fromPhase",
      message: "Source Voyage phase is not recognized.",
      severity: "error"
    },
    {
      code: "invalid-target-voyage-phase",
      path: "toPhase",
      message: "Target Voyage phase is not recognized.",
      severity: "error"
    }
  ]);
});

test("returns a fresh warnings array for every validation result", () => {
  const valid = validateVoyagePhaseTransition(PHASES.SITUATION, PHASES.CREW_PLANNING);
  const invalid = validateVoyagePhaseTransition(PHASES.SITUATION, PHASES.SITUATION);
  assert.ok(Array.isArray(valid.warnings));
  assert.ok(Array.isArray(invalid.warnings));
  assert.notEqual(valid.warnings, invalid.warnings);
});

test("returns exact allowed transition copies", () => {
  assert.deepEqual(getAllowedVoyagePhaseTransitions(PHASES.SITUATION), [PHASES.CREW_PLANNING]);
  assert.deepEqual(getAllowedVoyagePhaseTransitions("unknown-phase"), []);
  const first = getAllowedVoyagePhaseTransitions(PHASES.SITUATION);
  const second = getAllowedVoyagePhaseTransitions(PHASES.SITUATION);
  assert.notEqual(first, second);
  first.push(PHASES.RESOLUTION);
  assert.deepEqual(getAllowedVoyagePhaseTransitions(PHASES.SITUATION), [PHASES.CREW_PLANNING]);
});

test("returns a complete copy of the exact policy in phase order", () => {
  const first = getVoyagePhaseTransitionPolicy();
  const second = getVoyagePhaseTransitionPolicy();
  assert.deepEqual(Object.keys(first), PHASE_VALUES);
  assert.deepEqual(first, ACCEPTED_TRANSITIONS);
  assert.deepEqual(first[PHASES.CLEANUP_ADVANCE], []);
  assert.notEqual(first, second);
  assert.notEqual(first[PHASES.SITUATION], second[PHASES.SITUATION]);
  first[PHASES.SITUATION].push(PHASES.RESOLUTION);
  first[PHASES.RESOLUTION] = [];
  delete first[PHASES.CONSEQUENCES];
  assert.deepEqual(getVoyagePhaseTransitionPolicy(), ACCEPTED_TRANSITIONS);
});

test("rejects prototype-property names, null, and undefined safely", () => {
  for (const invalidPhase of ["__proto__", "constructor", "prototype", null, undefined]) {
    assert.doesNotThrow(() => getAllowedVoyagePhaseTransitions(invalidPhase));
    assert.deepEqual(getAllowedVoyagePhaseTransitions(invalidPhase), []);
    assert.equal(isLegalVoyagePhaseTransition(invalidPhase, PHASES.SITUATION), false);
    assert.equal(isLegalVoyagePhaseTransition(PHASES.SITUATION, invalidPhase), false);
  }
});

test("phase domain helpers load without Foundry globals", () => {
  assert.equal(typeof getAllowedVoyagePhaseTransitions, "function");
  assert.equal(typeof isLegalVoyagePhaseTransition, "function");
  assert.equal(typeof validateVoyagePhaseTransition, "function");
  assert.equal(typeof getVoyagePhaseTransitionPolicy, "function");
});

test("Arcflight registration exposes phase helpers and devTools aliases", async () => {
  const previousGlobals = Object.fromEntries(
    ["foundry", "Hooks", "CONFIG", "game"].map((key) => [key, {
      exists: Object.hasOwn(globalThis, key),
      value: globalThis[key]
    }])
  );
  let initCallback;

  class TestActorSheetV2 {}

  try {
    globalThis.foundry = {
      applications: {
        api: { HandlebarsApplicationMixin: (Base) => Base },
        sheets: { ActorSheetV2: TestActorSheetV2 },
        apps: {}
      },
      documents: {},
      utils: {}
    };
    globalThis.Hooks = { once: (_event, callback) => { initCallback = callback; } };
    globalThis.CONFIG = {};
    globalThis.game = {};

    const arcflight = await import("../../../scripts/arcflight.js");
    initCallback();
    for (const helperName of [
      "getAllowedVoyagePhaseTransitions",
      "isLegalVoyagePhaseTransition",
      "validateVoyagePhaseTransition",
      "getVoyagePhaseTransitionPolicy"
    ]) {
      assert.equal(typeof arcflight[helperName], "function");
      assert.equal(typeof globalThis.game.arcflight[helperName], "function");
      assert.equal(typeof globalThis.game.arcflight.devTools[helperName], "function");
    }
  } finally {
    for (const [key, previous] of Object.entries(previousGlobals)) {
      if (previous.exists) globalThis[key] = previous.value;
      else delete globalThis[key];
    }
  }
});
