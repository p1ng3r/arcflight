import test from "node:test";
import assert from "node:assert/strict";

import {
  createTestLabControl,
  isActiveTestLabGm,
  registerTestLabSceneControl
} from "../../../scripts/voyage/testing/event-test-lab-entry.js";
import { createTestRunner } from "../../../scripts/voyage/testing/event-test-runner.js";
import { createSuiteRegistry, QUICK_CHECK_SUITE_ID } from "../../../scripts/voyage/testing/event-test-suite-registry.js";
import { listEventDefinitions } from "../../../scripts/voyage/testing/event-test-inspector.js";

const gmGame = { user: { id: "gm-1", isGM: true }, users: { activeGM: { id: "gm-1" } } };

test("Test Lab scene control is visible only to the active GM and uses Foundry's button callback", async () => {
  let opened = 0;
  const controls = [{ name: "token", tools: [] }];
  assert.equal(registerTestLabSceneControl(controls, { gameValue: gmGame, open: () => { opened += 1; } }), true);
  assert.equal(controls[0].tools.length, 1);
  assert.equal(controls[0].tools[0].name, "arcflight-test-lab");
  assert.equal(controls[0].tools[0].visible, true);
  assert.equal(typeof controls[0].tools[0].onChange, "function");
  await controls[0].tools[0].onChange();
  assert.equal(opened, 1);

  const playerControls = [{ name: "token", tools: [] }];
  const playerGame = { user: { id: "player-1", isGM: false }, users: { activeGM: { id: "gm-1" } } };
  assert.equal(isActiveTestLabGm(playerGame), false);
  assert.equal(registerTestLabSceneControl(playerControls, { gameValue: playerGame }), false);
  assert.deepEqual(playerControls[0].tools, []);
  assert.equal(createTestLabControl({ gameValue: playerGame }), null);
});

test("registering the Test Lab scene control is idempotent", () => {
  const controls = [{ name: "token", tools: [] }];
  assert.equal(registerTestLabSceneControl(controls, { gameValue: gmGame }), true);
  assert.equal(registerTestLabSceneControl(controls, { gameValue: gmGame }), true);
  assert.equal(controls[0].tools.length, 1);
});

test("Test Lab entry tolerates a Foundry control wrapper and active-GM collection fallback", () => {
  const controls = { controls: [{ name: "environment", tools: null }] };
  const gmGame = {
    user: { id: "gm-1", isGM: true },
    users: { contents: [{ id: "gm-1", isGM: true, active: true }] }
  };
  assert.equal(isActiveTestLabGm(gmGame), true);
  assert.equal(registerTestLabSceneControl(controls, { gameValue: gmGame }), true);
  assert.equal(controls.controls[0].tools[0].name, "arcflight-test-lab");
});

test("Test Lab entry uses the Foundry v14.365 Scene Controls record contract", async () => {
  let opened = 0;
  const controls = {
    tokens: {
      name: "tokens",
      title: "CONTROLS.TokenControls",
      icon: "fa-solid fa-user",
      order: 0,
      tools: {
        select: { name: "select", title: "Select", icon: "fa-solid fa-arrow-pointer", order: 0, control: true }
      }
    }
  };
  const gameValue = { user: { id: "gm-1", isGM: true }, users: { activeGM: { id: "gm-1" } } };
  assert.equal(registerTestLabSceneControl(controls, { gameValue, open: () => { opened += 1; } }), true);
  const tool = controls.tokens.tools["arcflight-test-lab"];
  assert.equal(tool.name, "arcflight-test-lab");
  assert.equal(tool.order, 1);
  assert.equal(tool.title, "ARCFLIGHT.TestLab.Title");
  assert.equal(tool.icon, "fa-solid fa-flask");
  await tool.onChange(new Event("click"), true);
  assert.equal(opened, 1);
});

test("event discovery consumes the canonical registry and handles an empty registry", async () => {
  const listed = await listEventDefinitions({
    listEventDefinitions: () => [
      { eventId: "fixture-event", title: "Fixture Event", definitionSnapshotId: "fixture-v1", rounds: [] }
    ]
  });
  assert.deepEqual(listed, [{ eventId: "fixture-event", title: "Fixture Event", definitionSnapshotId: "fixture-v1", breachDC: null, rounds: [] }]);
  assert.deepEqual(listEventDefinitions({ listEventDefinitions: () => [] }), []);
});

function runnerContext(overrides = {}) {
  const calls = { starts: [], abandons: 0, persistedSessionIds: new Set() };
  const context = {
    authenticatedUserId: "gm-1",
    activeGmUserId: "gm-1",
    game: { user: { id: "gm-1", isGM: true } },
    eventDefinitions: [{ eventId: "fixture-event", title: "Fixture Event", definitionSnapshotId: "fixture-v1" }],
    ships: [{ id: "fixture-ship", name: "Fixture Ship" }],
    eventTest: {
      listEvents: async () => ({ ok: true, events: context.eventDefinitions }),
      listShips: async () => ({ ok: true, ships: context.ships }),
      start: async (request) => {
        calls.starts.push(request);
        calls.persistedSessionIds.add(request.sessionId);
        return { ok: true, sessionId: request.sessionId, snapshot: { session: { revision: 1 } } };
      },
      inspect: async () => ({ ok: true, snapshot: { session: { revision: 1, encounterState: { pressureSystems: { hull: { value: 0, capacity: 2 } } } } } }),
      abandon: async ({ sessionId }) => { calls.abandons += 1; calls.persistedSessionIds.delete(sessionId); return { ok: true, deleted: true }; }
    },
    ...overrides
  };
  context.calls = calls;
  return context;
}

test("Quick Check starts from the UI-selected event and ship and preserves ordered evidence", async () => {
  const context = runnerContext();
  const run = await createTestRunner({ registry: createSuiteRegistry(), context }).run({
    suiteId: QUICK_CHECK_SUITE_ID,
    lane: "ENGINE",
    eventId: "fixture-event",
    shipId: "fixture-ship"
  });
  assert.equal(run.ok, true);
  assert.deepEqual(context.calls.starts[0], {
    eventId: "fixture-event",
    shipId: "fixture-ship",
    sessionId: context.calls.starts[0].sessionId
  });
  assert.deepEqual(run.steps.map((step) => step.stepId), [
    "authority", "event-discovery", "ship-validation", "start-session", "inspect-session", "initial-invariants", "safe-cleanup"
  ]);
  assert.deepEqual(run.summary, { total: 7, passed: 7, failed: 0, skipped: 0, warnings: 0, status: "PASSED" });
  assert.equal(run.retainedSessionId, null);
});

test("post-launch failure injection is opt-in and retains the marked session without automatic cleanup", async () => {
  const context = runnerContext();
  const run = await createTestRunner({ registry: createSuiteRegistry(), context }).run({
    suiteId: QUICK_CHECK_SUITE_ID,
    lane: "ENGINE",
    eventId: "fixture-event",
    shipId: "fixture-ship",
    forcePostLaunchFailure: true
  });
  assert.equal(run.ok, false);
  assert.deepEqual(run.steps.map((step) => step.stepId), [
    "authority", "event-discovery", "ship-validation", "start-session", "forced-post-launch-failure"
  ]);
  assert.deepEqual(run.steps.slice(0, 4).map((step) => step.status), ["PASS", "PASS", "PASS", "PASS"]);
  assert.equal(run.steps[4].status, "FAIL");
  assert.equal(run.steps[4].errorCode, "event-test-forced-post-launch-failure");
  assert.equal(run.retainedSessionId, context.calls.starts[0].sessionId);
  assert.equal(context.calls.persistedSessionIds.has(run.retainedSessionId), true);
  assert.equal(context.calls.abandons, 0);
  assert.equal(run.steps.some((step) => step.stepId === "safe-cleanup"), false);
});

test("a later Quick Check failure retains the marked fixture and reports diff/invariant evidence", async () => {
  const registry = [{
    id: QUICK_CHECK_SUITE_ID,
    lane: "ENGINE",
    tests: [
      { id: "start", label: "Start", run: async (_context, profile) => { profile.sessionId = "failed-fixture"; return { ok: true, retainedSessionId: "failed-fixture", afterSnapshot: { session: { revision: 1 } } }; } },
      { id: "verify", label: "Verify", run: async () => ({ ok: false, code: "fixture-failed", path: "session.state", expected: "valid", actual: "invalid", diff: [{ kind: "changed", path: "session.state" }], invariantResults: [{ status: "FAIL", label: "State valid", message: "Invalid state" }] }) }
    ]
  }];
  const run = await createTestRunner({ registry, context: runnerContext() }).run({ suiteId: QUICK_CHECK_SUITE_ID, eventId: "fixture-event", shipId: "fixture-ship" });
  assert.equal(run.ok, false);
  assert.equal(run.retainedSessionId, "failed-fixture");
  assert.deepEqual(run.steps[1].diff, [{ kind: "changed", path: "session.state" }]);
  assert.equal(run.steps[1].invariantResults[0].status, "FAIL");
});

test("an active ordinary-session conflict has zero-write evidence and no retained cleanup target", async () => {
  const context = runnerContext({
    eventTest: {
      listEvents: async () => ({ ok: true, events: [{ eventId: "fixture-event" }] }),
      listShips: async () => ({ ok: true, ships: [{ id: "fixture-ship" }] }),
      start: async () => ({ ok: false, sessionId: "test-request-only", errors: [{ code: "m12-active-session-conflict", path: "sessionId", message: "An active Event Session already exists." }] })
    }
  });
  const run = await createTestRunner({ registry: createSuiteRegistry(), context }).run({ suiteId: QUICK_CHECK_SUITE_ID, eventId: "fixture-event", shipId: "fixture-ship" });
  const step = run.steps.find((entry) => entry.stepId === "start-session");
  assert.equal(run.ok, false);
  assert.equal(step.errorCode, "m12-active-session-conflict");
  assert.equal(step.errorPath, "sessionId");
  assert.equal(step.writes, 0);
  assert.equal(run.retainedSessionId, null);
});
