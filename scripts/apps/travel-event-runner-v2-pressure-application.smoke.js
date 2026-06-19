import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel event runner v2 pressure application smoke check failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Travel event runner v2 pressure application smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
  }
}

function snapshot(value) {
  return JSON.stringify(value);
}

function createRunnerSessionFixture(overrides = {}) {
  return {
    status: "active",
    currentRoundIndex: 0,
    event: {
      rounds: [
        {
          number: 1,
          title: "Runner Pressure Application Test",
          primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.HULL,
          secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES,
          pressureStation: "engineer"
        }
      ]
    },
    ...overrides
  };
}

async function importRunnerModule() {
  const previousFoundry = globalThis.foundry;
  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: class {},
        HandlebarsApplicationMixin: (Base) => Base
      }
    }
  };
  try {
    return await import("./travel-event-runner.js");
  } finally {
    if (previousFoundry === undefined) delete globalThis.foundry;
    else globalThis.foundry = previousFoundry;
  }
}

export async function runTravelEventRunnerV2PressureApplicationSmokeChecks() {
  const { prepareTravelV2PressureApplicationRunnerUpdate } = await importRunnerModule();

  assertSmoke(typeof prepareTravelV2PressureApplicationRunnerUpdate === "function", "runner pressure update helper should be exported");

  let chatCalls = 0;
  let socketCalls = 0;
  let actorUpdateCalls = 0;
  const previousGame = globalThis.game;
  globalThis.game = {
    socket: { emit: () => { socketCalls += 1; } },
    actors: { values: () => [], get: () => ({ update: () => { actorUpdateCalls += 1; } }) }
  };
  const previousChatMessage = globalThis.ChatMessage;
  globalThis.ChatMessage = { create: () => { chatCalls += 1; } };

  try {
    const session = createRunnerSessionFixture();
    const before = snapshot(session);
    const previewOnly = snapshot(session);
    assertEqual(snapshot(session), previewOnly, "session pressure should not change before explicit runner helper call");

    const successful = prepareTravelV2PressureApplicationRunnerUpdate(session, { selectedOutcomeKey: "failure", now: "2026-01-01T00:00:00.000Z" });
    assertSmoke(successful.result.ok && successful.result.applied, "explicit runner helper call should apply pressure");
    assertSmoke(successful.shouldUpdateSession, "successful application should request session replacement");
    assertSmoke(successful.shouldRerender, "successful application should request rerender");
    assertSmoke(successful.nextSession !== session, "successful application should return cloned updated session");
    assertEqual(snapshot(session), before, "successful application should not mutate input session");
    assertEqual(successful.nextSession.pressure[ARCFLIGHT_TRAVEL_RESOURCES.HULL].value, 1, "failure outcome should update primary pressure on next session");
    assertEqual(successful.nextSession.pressure[ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES].value, 1, "failure outcome should update secondary pressure on next session");

    const duplicateBefore = snapshot(successful.nextSession);
    const duplicate = prepareTravelV2PressureApplicationRunnerUpdate(successful.nextSession, { selectedOutcomeKey: "failure", now: "2026-01-01T00:00:01.000Z" });
    assertSmoke(!duplicate.result.ok && !duplicate.result.applied, "duplicate application should be blocked");
    assertSmoke(!duplicate.shouldUpdateSession, "blocked duplicate should not request session replacement");
    assertSmoke(duplicate.nextSession === successful.nextSession, "blocked duplicate should keep current session reference");
    assertEqual(snapshot(successful.nextSession), duplicateBefore, "blocked duplicate should not mutate the current session");

    const invalidSession = createRunnerSessionFixture();
    const invalidBefore = snapshot(invalidSession);
    const invalid = prepareTravelV2PressureApplicationRunnerUpdate(invalidSession, { selectedOutcomeKey: "not-real" });
    assertSmoke(!invalid.result.ok && !invalid.result.applied, "invalid selected outcome should be blocked");
    assertSmoke(!invalid.shouldUpdateSession, "invalid selected outcome should not replace session");
    assertEqual(snapshot(invalidSession), invalidBefore, "invalid selected outcome should not mutate session");

    const defaultMixed = prepareTravelV2PressureApplicationRunnerUpdate(createRunnerSessionFixture(), { now: "2026-01-01T00:00:02.000Z" });
    assertEqual(defaultMixed.result.selectedOutcomeKey, "mixed", "missing selected outcome should default to mixed");

    assertEqual(chatCalls, 0, "runner pressure path should not create chat messages");
    assertEqual(socketCalls, 0, "runner pressure path should not emit sockets");
    assertEqual(actorUpdateCalls, 0, "runner pressure path should not update actors");
  } finally {
    if (previousGame === undefined) delete globalThis.game;
    else globalThis.game = previousGame;
    if (previousChatMessage === undefined) delete globalThis.ChatMessage;
    else globalThis.ChatMessage = previousChatMessage;
  }

  return {
    ok: true,
    checked: [
      "runner-helper-exported",
      "explicit-call-required",
      "successful-application-replaces-session",
      "blocked-duplicate-non-destructive",
      "invalid-outcome-blocked",
      "missing-outcome-defaults-to-mixed",
      "no-chat-socket-actor-side-effects"
    ]
  };
}

export default runTravelEventRunnerV2PressureApplicationSmokeChecks;
