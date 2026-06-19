import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import { applyTravelV2PressureToRunnerSession } from "./travel-v2-session-pressure-application.js";
import { prepareTravelV2PressureApplicationState } from "./travel-v2-pressure-application-state.js";
import {
  correctTravelV2PressureApplicationOnRunnerSession,
  TRAVEL_V2_PRESSURE_CORRECTION_VERSION
} from "./travel-v2-pressure-correction.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 pressure correction smoke check failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`Travel v2 pressure correction smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
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
          title: "Correction Test",
          primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.HULL,
          secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES,
          pressureStation: "engineer"
        }
      ]
    },
    ...overrides
  };
}

export function runTravelV2PressureCorrectionSmokeChecks() {
  assertEqual(TRAVEL_V2_PRESSURE_CORRECTION_VERSION, 1, "pressure correction version should be 1");

  const emptyCorrection = correctTravelV2PressureApplicationOnRunnerSession(createRunnerSessionFixture(), { selectedOutcomeKey: "mixed" });
  assertSmoke(!emptyCorrection.ok && !emptyCorrection.corrected, "correction should block without an application record");

  const appliedFailure = applyTravelV2PressureToRunnerSession(createRunnerSessionFixture(), {
    selectedOutcomeKey: "failure",
    now: "2026-01-01T00:00:00.000Z"
  });
  const appliedSnapshot = snapshot(appliedFailure.session);

  const invalidCorrection = correctTravelV2PressureApplicationOnRunnerSession(appliedFailure.session, { selectedOutcomeKey: "not-real" });
  assertSmoke(!invalidCorrection.ok, "correction should block invalid selected outcome");

  const sameCorrection = correctTravelV2PressureApplicationOnRunnerSession(appliedFailure.session, { selectedOutcomeKey: "failure" });
  assertSmoke(!sameCorrection.ok, "correction should block same selected outcome");

  const corrected = correctTravelV2PressureApplicationOnRunnerSession(appliedFailure.session, {
    selectedOutcomeKey: "mixed",
    reason: "GM selected the wrong outcome.",
    now: "2026-01-01T00:00:01.000Z"
  });
  assertSmoke(corrected.ok && corrected.corrected, "failure to mixed correction should succeed");
  assertEqual(snapshot(appliedFailure.session), appliedSnapshot, "correction should not mutate input session");
  assertSmoke(corrected.session !== appliedFailure.session, "corrected session should be a different object");
  assertEqual(corrected.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.HULL].value, 1, "corrected primary pressure should be reapplied");
  assertEqual(corrected.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES].value, 0, "prior secondary pressure should be reversed");
  assertEqual(corrected.originalApplicationRecord.outcomeKey, "failure", "original application record should be preserved in result");
  assertEqual(corrected.session.travelV2PressureApplications.records[0].outcomeKey, "failure", "original application record should stay in history");
  assertEqual(corrected.session.travelV2PressureApplications.records[1].outcomeKey, "mixed", "corrected application record should be appended");
  assertEqual(corrected.session.travelV2PressureCorrections.records.length, 1, "correction record should be appended");
  assertEqual(corrected.correctionRecord.previousOutcomeKey, "failure", "correction record should store previous outcome");
  assertEqual(corrected.correctionRecord.correctedOutcomeKey, "mixed", "correction record should store corrected outcome");

  const duplicateState = prepareTravelV2PressureApplicationState(corrected.session, { selectedOutcomeKey: "failure" });
  assertEqual(duplicateState.applicationRecord.outcomeKey, "mixed", "duplicate guard should see corrected effective application record");
  assertSmoke(duplicateState.alreadyApplied, "duplicate guard should still block further application");

  const lowPressureSession = {
    ...appliedFailure.session,
    pressure: {
      ...appliedFailure.session.pressure,
      [ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES]: { value: 0, crossed: [] }
    }
  };
  const belowZeroCorrection = correctTravelV2PressureApplicationOnRunnerSession(lowPressureSession, { selectedOutcomeKey: "mixed" });
  assertSmoke(!belowZeroCorrection.ok, "correction should block if reversal pushes pressure below zero");

  const sideEffects = { chat: 0, socket: 0, actor: 0 };
  const priorGame = globalThis.game;
  const priorChat = globalThis.ChatMessage;
  try {
    globalThis.game = { socket: { emit: () => { sideEffects.socket += 1; } } };
    globalThis.ChatMessage = { create: () => { sideEffects.chat += 1; } };
    correctTravelV2PressureApplicationOnRunnerSession(appliedFailure.session, {
      selectedOutcomeKey: "success",
      actor: { update: () => { sideEffects.actor += 1; } }
    });
  } finally {
    globalThis.game = priorGame;
    globalThis.ChatMessage = priorChat;
  }
  assertEqual(sideEffects.chat, 0, "correction should not send chat messages");
  assertEqual(sideEffects.socket, 0, "correction should not emit sockets");
  assertEqual(sideEffects.actor, 0, "correction should not mutate actors");

  return {
    ok: true,
    checked: [
      "pressure-correction-version",
      "missing-application-blocked",
      "invalid-outcome-blocked",
      "same-outcome-blocked",
      "failure-to-mixed-correction-succeeds",
      "input-session-not-mutated",
      "returned-session-is-clone",
      "prior-deltas-reversed-before-reapply",
      "original-application-record-preserved",
      "correction-record-appended",
      "duplicate-guard-sees-corrected-effective-record",
      "below-zero-reversal-blocked",
      "no-chat-socket-actor-side-effects"
    ]
  };
}

export default runTravelV2PressureCorrectionSmokeChecks;
