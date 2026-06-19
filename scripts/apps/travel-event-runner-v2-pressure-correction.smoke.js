import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";

export const TRAVEL_EVENT_RUNNER_V2_PRESSURE_CORRECTION_SMOKE_VERSION = 1;

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel event runner v2 pressure correction smoke check failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Travel event runner v2 pressure correction smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
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
          title: "Runner Pressure Correction Test",
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

export async function runTravelEventRunnerV2PressureCorrectionSmokeChecks() {
  assertEqual(TRAVEL_EVENT_RUNNER_V2_PRESSURE_CORRECTION_SMOKE_VERSION, 1, "correction smoke version should be exported");
  const { prepareTravelV2PressureApplicationRunnerUpdate, prepareTravelV2PressureCorrectionRunnerUpdate } = await importRunnerModule();
  assertSmoke(typeof prepareTravelV2PressureCorrectionRunnerUpdate === "function", "runner correction update helper should be exported");

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
    const applied = prepareTravelV2PressureApplicationRunnerUpdate(session, { selectedOutcomeKey: "failure", now: "2026-01-01T00:00:00.000Z" });
    assertSmoke(applied.shouldUpdateSession, "fixture should apply pressure before correction");

    const appliedSession = applied.nextSession;
    const beforeCorrection = snapshot(appliedSession);
    const successful = prepareTravelV2PressureCorrectionRunnerUpdate(appliedSession, { correctedOutcomeKey: "mixed", now: "2026-01-01T00:00:01.000Z" });
    assertSmoke(successful.result.ok && successful.result.corrected, "explicit runner correction should correct pressure");
    assertSmoke(successful.shouldUpdateSession, "successful correction should request session replacement");
    assertSmoke(successful.shouldRerender, "successful correction should request rerender");
    assertSmoke(successful.nextSession !== appliedSession, "successful correction should return cloned updated session");
    assertEqual(snapshot(appliedSession), beforeCorrection, "successful correction should not mutate input session");
    assertEqual(successful.result.previousOutcomeKey, "failure", "correction should expose previous outcome");
    assertEqual(successful.result.selectedOutcomeKey, "mixed", "correction should expose corrected outcome");
    assertEqual(successful.nextSession.pressure[ARCFLIGHT_TRAVEL_RESOURCES.HULL].value, 1, "mixed correction should leave only primary pressure");
    assertEqual(successful.nextSession.pressure[ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES].value, 0, "mixed correction should reverse secondary pressure");

    const missing = prepareTravelV2PressureCorrectionRunnerUpdate(appliedSession, {});
    assertSmoke(!missing.result.ok && !missing.result.corrected, "missing corrected outcome should block");
    assertSmoke(!missing.shouldUpdateSession, "missing corrected outcome should not replace session");

    const invalid = prepareTravelV2PressureCorrectionRunnerUpdate(appliedSession, { correctedOutcomeKey: "not-real" });
    assertSmoke(!invalid.result.ok && !invalid.result.corrected, "invalid corrected outcome should block");
    assertSmoke(!invalid.shouldUpdateSession, "invalid corrected outcome should not replace session");

    const same = prepareTravelV2PressureCorrectionRunnerUpdate(appliedSession, { correctedOutcomeKey: "failure" });
    assertSmoke(!same.result.ok && !same.result.corrected, "same/effective corrected outcome should block");
    assertSmoke(same.result.blockedReasons.some((reason) => reason.includes("different")), "same/effective block should explain different outcome requirement");

    const beforePanel = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session });
    assertSmoke(beforePanel.travelV2PreviewPanel.rows.every((row) => !row.canCorrectPressure), "correction controls should be unavailable before application");

    const appliedPanel = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: appliedSession });
    const failureRow = appliedPanel.travelV2PreviewPanel.rows.find((row) => row.outcomeKey === "failure");
    const mixedRow = appliedPanel.travelV2PreviewPanel.rows.find((row) => row.outcomeKey === "mixed");
    assertSmoke(appliedPanel.travelV2PreviewPanel.pressureApplication.alreadyApplied, "panel should detect existing application record");
    assertSmoke(appliedPanel.travelV2PreviewPanel.rows.every((row) => row.pressureApplyDisabled), "apply controls should remain disabled after application");
    assertSmoke(failureRow.isEffectiveAppliedOutcome, "effective row should be marked");
    assertSmoke(!failureRow.canCorrectPressure && failureRow.pressureCorrectionDisabled, "effective row correction should be disabled");
    assertSmoke(mixedRow.canCorrectPressure && !mixedRow.pressureCorrectionDisabled, "other valid outcome should expose correction control");

    const successFeedbackPanel = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: successful.nextSession, uiState: { travelV2PressureCorrectionResult: successful.result } });
    assertSmoke(successFeedbackPanel.travelV2PreviewPanel.pressureApplication.feedbackText.includes("Failure → Mixed"), "success feedback should render previous and corrected labels");
    const blockedFeedbackPanel = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: appliedSession, uiState: { travelV2PressureCorrectionResult: invalid.result } });
    assertSmoke(blockedFeedbackPanel.travelV2PreviewPanel.pressureApplication.feedbackText.includes("not available"), "blocked correction feedback should render reason");

    assertEqual(chatCalls, 0, "runner pressure correction path should not create chat messages");
    assertEqual(socketCalls, 0, "runner pressure correction path should not emit sockets");
    assertEqual(actorUpdateCalls, 0, "runner pressure correction path should not update actors");
  } finally {
    if (previousGame === undefined) delete globalThis.game;
    else globalThis.game = previousGame;
    if (previousChatMessage === undefined) delete globalThis.ChatMessage;
    else globalThis.ChatMessage = previousChatMessage;
  }

  return {
    ok: true,
    checked: [
      "correction-smoke-version",
      "runner-helper-exported",
      "successful-correction-replaces-session",
      "missing-corrected-outcome-blocked",
      "invalid-corrected-outcome-blocked",
      "same-effective-outcome-blocked",
      "correction-controls-after-application-only",
      "apply-controls-remain-disabled",
      "correction-feedback-success-and-blocked",
      "no-chat-socket-actor-side-effects"
    ]
  };
}

export default runTravelEventRunnerV2PressureCorrectionSmokeChecks;
