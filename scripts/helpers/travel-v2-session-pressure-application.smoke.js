import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import {
  applyTravelV2PressureToRunnerSession,
  TRAVEL_V2_SESSION_PRESSURE_APPLICATION_VERSION
} from "./travel-v2-session-pressure-application.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 session pressure application smoke check failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Travel v2 session pressure application smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
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
          title: "Session Application Test",
          primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.HULL,
          secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES,
          pressureStation: "engineer"
        }
      ]
    },
    ...overrides
  };
}

export function runTravelV2SessionPressureApplicationSmokeChecks() {
  assertEqual(TRAVEL_V2_SESSION_PRESSURE_APPLICATION_VERSION, 1, "session application version should be 1");

  const session = createRunnerSessionFixture();
  const before = snapshot(session);
  const mixedResult = applyTravelV2PressureToRunnerSession(session, { now: "2026-01-01T00:00:00.000Z" });
  assertSmoke(mixedResult.ok && mixedResult.applied, "mixed application should succeed for active session");
  assertEqual(snapshot(session), before, "application should not mutate input session");
  assertSmoke(mixedResult.session !== session, "returned session should be a different object");
  assertEqual(mixedResult.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.HULL].value, 1, "mixed should change primary pressure on returned session");
  assertSmoke(Array.isArray(mixedResult.session.travelV2PressureApplications.records), "application record collection should be written");
  assertEqual(mixedResult.applicationRecord.outcomeKey, "mixed", "application record should store outcome key");

  const duplicateResult = applyTravelV2PressureToRunnerSession(mixedResult.session, { now: "2026-01-01T00:00:01.000Z" });
  assertSmoke(!duplicateResult.ok && !duplicateResult.applied, "duplicate application for the same round should be blocked");
  assertSmoke(duplicateResult.blockedReasons.some((reason) => reason.includes("already been applied")), "duplicate block should explain existing application");

  const completedResult = applyTravelV2PressureToRunnerSession(createRunnerSessionFixture({ status: "completed" }));
  assertSmoke(!completedResult.ok, "completed session should block application");

  const invalidOutcomeResult = applyTravelV2PressureToRunnerSession(createRunnerSessionFixture(), { selectedOutcomeKey: "not-real" });
  assertSmoke(!invalidOutcomeResult.ok, "invalid selected outcome should block application");

  const failureResult = applyTravelV2PressureToRunnerSession(createRunnerSessionFixture(), { selectedOutcomeKey: "failure", now: "2026-01-01T00:00:02.000Z" });
  assertEqual(failureResult.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.HULL].value, 1, "failure should add one primary pressure");
  assertEqual(failureResult.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES].value, 1, "failure should add one secondary pressure");

  const criticalFailureResult = applyTravelV2PressureToRunnerSession(createRunnerSessionFixture(), { selectedOutcomeKey: "criticalFailure", now: "2026-01-01T00:00:03.000Z" });
  assertEqual(criticalFailureResult.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.HULL].value, 2, "critical failure should add two primary pressure");
  assertEqual(criticalFailureResult.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES].value, 1, "critical failure should add one secondary pressure");

  const existingRecord = { roundIndex: 2, roundNumber: 3, outcomeKey: "success", requestCount: 0 };
  const preservedResult = applyTravelV2PressureToRunnerSession(createRunnerSessionFixture({
    travelV2PressureApplications: { records: [existingRecord] }
  }), { now: "2026-01-01T00:00:04.000Z" });
  assertEqual(preservedResult.session.travelV2PressureApplications.records.length, 2, "existing records should be preserved when appending");
  assertEqual(preservedResult.session.travelV2PressureApplications.records[0].roundNumber, 3, "preserved record should remain first");

  return {
    ok: true,
    checked: [
      "session-application-version",
      "mixed-application-succeeds",
      "input-session-not-mutated",
      "returned-session-is-clone",
      "pressure-state-changes",
      "application-record-written",
      "duplicate-application-blocked",
      "completed-session-blocked",
      "invalid-outcome-blocked",
      "failure-critical-failure-pressure-totals",
      "existing-records-preserved"
    ]
  };
}

export default runTravelV2SessionPressureApplicationSmokeChecks;
