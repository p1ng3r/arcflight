import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import {
  finalizeTravelV2RoundOnRunnerSession,
  TRAVEL_V2_SESSION_ROUND_FINALIZATION_VERSION
} from "./travel-v2-session-round-finalization.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 session round finalization smoke check failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Travel v2 session round finalization smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
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
          title: "Session Round Finalization Test 1",
          primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.HULL,
          secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES,
          pressureStation: "engineer",
          stationSummary: { engineer: { outcomeKey: "mixed", pressure: 1 } }
        },
        {
          number: 2,
          title: "Session Round Finalization Test 2",
          primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.CREW,
          secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.MORALE,
          pressureStation: "pilot"
        }
      ]
    },
    ...overrides
  };
}

function applicationRecord(overrides = {}) {
  return { roundIndex: 0, roundNumber: 1, outcomeKey: "mixed", requestCount: 1, ...overrides };
}

export function runTravelV2SessionRoundFinalizationSmokeChecks() {
  assertEqual(TRAVEL_V2_SESSION_ROUND_FINALIZATION_VERSION, 1, "session round finalization version should be 1");

  const missingResult = finalizeTravelV2RoundOnRunnerSession(null);
  assertSmoke(!missingResult.ok && !missingResult.finalized, "missing session should block without throwing");
  assertEqual(missingResult.session, null, "missing session block should preserve input session reference");

  const previewResult = finalizeTravelV2RoundOnRunnerSession(createRunnerSessionFixture());
  assertSmoke(!previewResult.ok, "active current round without pressure application should block");
  assertSmoke(previewResult.blockedReasons.includes("Current Travel v2 round has no effective pressure application."), "preview block should explain missing pressure application");

  const session = createRunnerSessionFixture({
    travelV2PressureApplications: { records: [applicationRecord()] }
  });
  const before = snapshot(session);
  const result = finalizeTravelV2RoundOnRunnerSession(session, {
    now: "2026-06-19T00:00:00.000Z",
    notes: "Reviewed",
    reason: "round-end"
  });
  assertSmoke(result.ok && result.finalized, "active current round with pressure application should finalize");
  assertSmoke(result.session !== session, "successful finalize should return cloned session");
  assertEqual(snapshot(session), before, "successful finalize should not mutate input session");
  assertEqual(result.session.travelV2RoundResolutions.records.length, 1, "successful finalize should append one resolution record");
  assertEqual(result.roundResolutionRecord.roundIndex, 0, "record should include round index");
  assertEqual(result.roundResolutionRecord.roundNumber, 1, "record should include round number");
  assertEqual(result.roundResolutionRecord.effectiveOutcomeKey, "mixed", "record should include effective outcome");
  assertEqual(result.roundResolutionRecord.helperVersion, TRAVEL_V2_SESSION_ROUND_FINALIZATION_VERSION, "record should include helper version");
  assertEqual(result.roundResolutionRecord.finalizedAt, "2026-06-19T00:00:00.000Z", "record should include timestamp");
  assertEqual(result.roundResolutionRecord.pressureApplicationRecord.outcomeKey, "mixed", "record should include pressure snapshot");
  assertEqual(result.roundResolutionRecord.stationSummary.engineer.outcomeKey, "mixed", "record should include station summary snapshot");
  assertEqual(result.roundResolutionRecord.notes, "Reviewed", "record should include optional notes");
  assertEqual(result.roundResolutionRecord.reason, "round-end", "record should include optional reason");

  result.roundResolutionRecord.pressureApplicationRecord.outcomeKey = "changed";
  assertEqual(result.session.travelV2PressureApplications.records[0].outcomeKey, "mixed", "record snapshots should not be live references");

  const duplicateResult = finalizeTravelV2RoundOnRunnerSession(result.session, { now: "2026-06-19T00:00:01.000Z" });
  assertSmoke(!duplicateResult.ok && !duplicateResult.finalized, "duplicate finalization should block");
  assertSmoke(duplicateResult.blockedReasons.includes("Current Travel v2 round is already finalized."), "duplicate block should explain existing finalization");
  assertEqual(duplicateResult.session.travelV2RoundResolutions.records.length, 1, "duplicate finalization should append no new record");

  const completedResult = finalizeTravelV2RoundOnRunnerSession(createRunnerSessionFixture({
    status: "completed",
    travelV2PressureApplications: { records: [applicationRecord()] }
  }));
  assertSmoke(!completedResult.ok, "completed session should block");

  const correctionRecord = {
    roundIndex: 0,
    roundNumber: 1,
    previousOutcomeKey: "mixed",
    correctedOutcomeKey: "failure",
    correctedApplicationRecord: applicationRecord({ outcomeKey: "failure" })
  };
  const correctedResult = finalizeTravelV2RoundOnRunnerSession(createRunnerSessionFixture({
    travelV2PressureApplications: { records: [applicationRecord(), correctionRecord.correctedApplicationRecord] },
    travelV2PressureCorrections: { records: [correctionRecord] }
  }), { now: "2026-06-19T00:00:02.000Z" });
  assertEqual(correctedResult.effectiveOutcomeKey, "failure", "corrected pressure outcome should finalize with corrected effective outcome");
  assertEqual(correctedResult.roundResolutionRecord.correctionRecord.correctedOutcomeKey, "failure", "correction snapshot should be included when present");

  const finalRoundResult = finalizeTravelV2RoundOnRunnerSession(createRunnerSessionFixture({
    currentRoundIndex: 1,
    travelV2PressureApplications: { records: [applicationRecord({ roundIndex: 1, roundNumber: 2, outcomeKey: "success" })] }
  }), { now: "2026-06-19T00:00:03.000Z" });
  assertSmoke(finalRoundResult.lifecycleState === "event-complete-ready" || finalRoundResult.isEventCompleteReady === true, "final event round should report event-complete-ready metadata");

  const sideEffectResult = finalizeTravelV2RoundOnRunnerSession(createRunnerSessionFixture({
    travelV2PressureApplications: { records: [applicationRecord()] },
    actor: { update() { throw new Error("actor update should not be called"); } },
    item: { update() { throw new Error("item update should not be called"); } },
    socket: { emit() { throw new Error("socket emit should not be called"); } },
    chat: { create() { throw new Error("chat create should not be called"); } },
    playerStationCards: { update() { throw new Error("player station cards should not be called"); } }
  }), { now: "2026-06-19T00:00:04.000Z" });
  assertSmoke(sideEffectResult.ok, "side-effect sentinels should not be called during finalization");

  return {
    ok: true,
    checked: [
      "session-round-finalization-version",
      "missing-session-block",
      "without-pressure-application-block",
      "with-pressure-application-finalizes",
      "returned-session-is-clone",
      "input-session-not-mutated",
      "resolution-record-appended",
      "resolution-record-shape-and-snapshots",
      "duplicate-finalization-blocked",
      "completed-session-blocked",
      "corrected-outcome-finalizes",
      "final-event-round-ready-metadata",
      "no-side-effects-called"
    ]
  };
}

export default runTravelV2SessionRoundFinalizationSmokeChecks;
