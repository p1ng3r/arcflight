import assert from "node:assert/strict";
import test from "node:test";
import {
  getAllowedVoyageLifecycleTransitions,
  getVoyageLifecycleTransitionPolicy,
  isLegalVoyageLifecycleTransition,
  validateVoyageLifecycleTransition
} from "../../../scripts/voyage/domain/lifecycle.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES } from "../../../scripts/voyage/domain/constants.js";

const STATES = VOYAGE_ENCOUNTER_LIFECYCLE_STATES;
const ACCEPTED_TRANSITIONS = {
  [STATES.DRAFT]: [STATES.CONFIGURATION],
  [STATES.CONFIGURATION]: [STATES.DRAFT, STATES.READY, STATES.RECOVERY, STATES.DISCARDED],
  [STATES.READY]: [STATES.CONFIGURATION, STATES.ACTIVE, STATES.RECOVERY, STATES.DISCARDED],
  [STATES.ACTIVE]: [STATES.PAUSED, STATES.RECOVERY, STATES.COMPLETED_SUCCESS, STATES.COMPLETED_FAILURE, STATES.ABANDONED],
  [STATES.PAUSED]: [STATES.ACTIVE, STATES.RECOVERY, STATES.ABANDONED, STATES.DISCARDED],
  [STATES.RECOVERY]: [STATES.CONFIGURATION, STATES.READY, STATES.ACTIVE, STATES.PAUSED, STATES.ABANDONED, STATES.DISCARDED],
  [STATES.COMPLETED_SUCCESS]: [],
  [STATES.COMPLETED_FAILURE]: [],
  [STATES.ABANDONED]: [],
  [STATES.DISCARDED]: []
};

test("accepts every lifecycle transition in the approved graph", () => {
  for (const [fromLifecycleState, allowedTargets] of Object.entries(ACCEPTED_TRANSITIONS)) {
    for (const toLifecycleState of allowedTargets) {
      assert.equal(isLegalVoyageLifecycleTransition(fromLifecycleState, toLifecycleState), true);
      assert.deepEqual(validateVoyageLifecycleTransition(fromLifecycleState, toLifecycleState), {
        valid: true,
        errors: [],
        warnings: []
      });
    }
  }
});

test("rejects recognized lifecycle transitions outside the approved graph", () => {
  for (const [fromLifecycleState, toLifecycleState] of [
    [STATES.DRAFT, STATES.READY],
    [STATES.CONFIGURATION, STATES.ACTIVE],
    [STATES.READY, STATES.PAUSED],
    [STATES.ACTIVE, STATES.DISCARDED],
    [STATES.PAUSED, STATES.CONFIGURATION],
    [STATES.RECOVERY, STATES.COMPLETED_SUCCESS],
    [STATES.COMPLETED_SUCCESS, STATES.RECOVERY]
  ]) {
    const report = validateVoyageLifecycleTransition(fromLifecycleState, toLifecycleState);
    assert.equal(isLegalVoyageLifecycleTransition(fromLifecycleState, toLifecycleState), false);
    assert.equal(report.valid, false);
    assert.deepEqual(report.errors.map(({ code, path, severity }) => ({ code, path, severity })), [{
      code: "illegal-lifecycle-transition",
      path: "toLifecycleState",
      severity: "error"
    }]);
  }
});

test("rejects same-state and invalid lifecycle transitions with distinct errors", () => {
  const sameState = validateVoyageLifecycleTransition(STATES.READY, STATES.READY);
  assert.equal(isLegalVoyageLifecycleTransition(STATES.READY, STATES.READY), false);
  assert.equal(sameState.errors[0].code, "same-lifecycle-state");
  assert.equal(sameState.errors[0].path, "toLifecycleState");
  assert.equal(sameState.errors[0].severity, "error");

  const invalidSource = validateVoyageLifecycleTransition("unknown-source", STATES.READY);
  assert.equal(isLegalVoyageLifecycleTransition("unknown-source", STATES.READY), false);
  assert.equal(invalidSource.errors[0].code, "invalid-source-lifecycle-state");
  assert.equal(invalidSource.errors[0].path, "fromLifecycleState");

  const invalidTarget = validateVoyageLifecycleTransition(STATES.READY, "unknown-target");
  assert.equal(isLegalVoyageLifecycleTransition(STATES.READY, "unknown-target"), false);
  assert.equal(invalidTarget.errors[0].code, "invalid-target-lifecycle-state");
  assert.equal(invalidTarget.errors[0].path, "toLifecycleState");
});

test("terminal lifecycle states have no allowed transitions", () => {
  for (const lifecycleState of [STATES.COMPLETED_SUCCESS, STATES.COMPLETED_FAILURE, STATES.ABANDONED, STATES.DISCARDED]) {
    assert.deepEqual(getAllowedVoyageLifecycleTransitions(lifecycleState), []);
  }
  assert.deepEqual(getAllowedVoyageLifecycleTransitions("unknown-state"), []);
});

test("allowed transition arrays do not expose internal policy", () => {
  const allowedTransitions = getAllowedVoyageLifecycleTransitions(STATES.DRAFT);
  allowedTransitions.push(STATES.ACTIVE);

  assert.deepEqual(getAllowedVoyageLifecycleTransitions(STATES.DRAFT), [STATES.CONFIGURATION]);
  assert.equal(isLegalVoyageLifecycleTransition(STATES.DRAFT, STATES.ACTIVE), false);
});

test("complete policy copies do not expose internal policy", () => {
  const policy = getVoyageLifecycleTransitionPolicy();
  policy[STATES.DRAFT].push(STATES.ACTIVE);
  policy[STATES.ACTIVE] = [];
  delete policy[STATES.RECOVERY];

  const freshPolicy = getVoyageLifecycleTransitionPolicy();
  assert.deepEqual(freshPolicy, ACCEPTED_TRANSITIONS);
  assert.equal(isLegalVoyageLifecycleTransition(STATES.ACTIVE, STATES.PAUSED), true);
});

test("lifecycle domain helpers load without Foundry globals", () => {
  assert.equal(typeof getAllowedVoyageLifecycleTransitions, "function");
  assert.equal(typeof isLegalVoyageLifecycleTransition, "function");
  assert.equal(typeof validateVoyageLifecycleTransition, "function");
  assert.equal(typeof getVoyageLifecycleTransitionPolicy, "function");
});

test("Arcflight registration exposes lifecycle helpers and devTools aliases", async () => {
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

    await import("../../../scripts/arcflight.js");
    initCallback();
    for (const helperName of [
      "getAllowedVoyageLifecycleTransitions",
      "isLegalVoyageLifecycleTransition",
      "validateVoyageLifecycleTransition",
      "getVoyageLifecycleTransitionPolicy"
    ]) {
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
