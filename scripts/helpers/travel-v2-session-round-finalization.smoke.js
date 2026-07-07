import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import {
  finalizeTravelV2RoundOnRunnerSession,
  getTravelV2DifficultyBidDcModifier,
  normalizeTravelV2DifficultyBid,
  prepareTravelV2DifficultyBidPreview,
  prepareTravelV2DifficultyBidRewardPreview,
  TRAVEL_V2_DIFFICULTY_BID_KEYS,
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

function lockedRoundResult() {
  const stations = ["captain", "navigator", "engineer", "veilwarden", "watchmaster"];
  return {
    stationActions: Object.fromEntries(stations.map((stationKey) => [stationKey, { actionKey: "eventApproach", label: "Event Approach" }])),
    stationOrderCommitments: Object.fromEntries(stations.map((stationKey) => [stationKey, { committed: true }]))
  };
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
          activeStations: ["captain", "navigator", "engineer", "veilwarden", "watchmaster"],
          stationSummary: { engineer: { outcomeKey: "mixed", pressure: 1 } }
        },
        {
          number: 2,
          title: "Session Round Finalization Test 2",
          primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.CREW,
          secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.MORALE,
          pressureStation: "engineer",
          activeStations: ["captain", "navigator", "engineer", "veilwarden", "watchmaster"]
        }
      ]
    },
    roundResults: [lockedRoundResult(), lockedRoundResult()],
    ...overrides
  };
}

function applicationRecord(overrides = {}) {
  return { roundIndex: 0, roundNumber: 1, outcomeKey: "mixed", requestCount: 1, ...overrides };
}

export function runTravelV2SessionRoundFinalizationSmokeChecks() {
  assertEqual(TRAVEL_V2_SESSION_ROUND_FINALIZATION_VERSION, 1, "session round finalization version should be 1");


  for (const [key, modifier] of [["none", 0], ["minor", 2], ["greater", 5], ["extreme", 8]]) {
    const normalized = normalizeTravelV2DifficultyBid(key);
    assertEqual(normalized.difficultyBidKey, key, `${key} bid should normalize to itself`);
    assertEqual(normalized.difficultyBidDcModifier, modifier, `${key} bid should expose expected DC modifier`);
    assertSmoke(normalized.playerSafe && normalized.readOnly, `${key} normalized bid should be player-safe/read-only`);
    assertEqual(getTravelV2DifficultyBidDcModifier(key), modifier, `${key} modifier helper should match config`);
  }
  assertEqual(TRAVEL_V2_DIFFICULTY_BID_KEYS.join(","), "none,minor,greater,extreme", "bid key list should expose all supported levels");
  assertEqual(normalizeTravelV2DifficultyBid("missing").difficultyBidKey, "none", "invalid bid should normalize to none");
  assertEqual(normalizeTravelV2DifficultyBid(undefined).difficultyBidKey, "none", "missing bid should normalize to none");

  for (const [bid, outcome, reward] of [
    ["minor", "success", "minorOpening"],
    ["minor", "criticalSuccess", "greaterOpening"],
    ["greater", "success", "greaterOpening"],
    ["greater", "criticalSuccess", "heroicEvent"],
    ["extreme", "success", "heroicEvent"],
    ["extreme", "criticalSuccess", "legendaryEvent"]
  ]) {
    const preview = prepareTravelV2DifficultyBidRewardPreview(bid, outcome);
    assertEqual(preview.rewardKey, reward, `${bid} + ${outcome} should preview ${reward}`);
    assertSmoke(preview.hasReward, `${bid} + ${outcome} should have reward preview`);
    assertSmoke(preview.playerSafe && preview.readOnly, `${bid} + ${outcome} reward preview should be player-safe/read-only`);
  }
  assertSmoke(!prepareTravelV2DifficultyBidRewardPreview("extreme", "failure").hasReward, "failure should create no bid reward");
  const criticalFailureBidPreview = prepareTravelV2DifficultyBidRewardPreview("extreme", "criticalFailure");
  assertSmoke(!criticalFailureBidPreview.hasReward, "critical failure should create no bid reward");
  assertSmoke(criticalFailureBidPreview.hasBacklashPreview && criticalFailureBidPreview.backlashPreview?.placeholder, "critical failure should expose only backlash preview placeholder");
  const previewSource = { bid: "greater", baseDC: 20, stationDcModifier: -1, outcomeKey: "success" };
  const previewSourceBefore = snapshot(previewSource);
  const bidPreview = prepareTravelV2DifficultyBidPreview(previewSource);
  assertEqual(bidPreview.effectiveDcPreview.effectiveDC, 24, "effective DC preview should include base, station, and bid modifiers");
  assertEqual(bidPreview.difficultyBidRewardPreview.rewardKey, "greaterOpening", "effective DC preview should include reward preview");
  assertSmoke(bidPreview.playerSafe && bidPreview.readOnly && bidPreview.effectiveDcPreview.playerSafe && bidPreview.effectiveDcPreview.readOnly, "difficulty bid preview should be player-safe/read-only");
  assertEqual(snapshot(previewSource), previewSourceBefore, "preview helper should not mutate source options");

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
  const navigatorSummary = result.stationActionSummary.stations.find((row) => row.stationKey === "navigator");
  assertEqual(navigatorSummary.difficultyBidKey, "none", "missing station bid should normalize to none in summary");
  assertEqual(navigatorSummary.effectiveDcPreview.effectiveDC, 0, "summary should expose read-only effective DC preview even when no base DC exists");

  result.roundResolutionRecord.pressureApplicationRecord.outcomeKey = "changed";
  assertEqual(result.session.travelV2PressureApplications.records[0].outcomeKey, "mixed", "record snapshots should not be live references");

  const bidSession = createRunnerSessionFixture({
    event: { ...createRunnerSessionFixture().event, baseDC: 20, rounds: [{ ...createRunnerSessionFixture().event.rounds[0], stationPrompts: { navigator: { stationName: "Navigator", dcModifier: 1 } } }, createRunnerSessionFixture().event.rounds[1]] },
    roundResults: [{ ...lockedRoundResult(), stationActions: { ...lockedRoundResult().stationActions, navigator: { actionKey: "eventApproach", label: "Event Approach", difficultyBidKey: "extreme" } }, stationResults: { navigator: "criticalSuccess" } }, lockedRoundResult()],
    travelV2PressureApplications: { records: [applicationRecord()] }
  });
  const bidSessionBefore = snapshot(bidSession);
  const bidResult = finalizeTravelV2RoundOnRunnerSession(bidSession, { now: "2026-06-19T00:00:00.500Z" });
  const bidNavigatorSummary = bidResult.stationActionSummary.stations.find((row) => row.stationKey === "navigator");
  assertEqual(snapshot(bidSession), bidSessionBefore, "finalization bid preview should not mutate source session/action/round data");
  assertEqual(bidNavigatorSummary.difficultyBidKey, "extreme", "summary should include declared bid key");
  assertEqual(bidNavigatorSummary.effectiveDcPreview.effectiveDC, 29, "summary effective DC preview should include base DC, station modifier, and bid modifier");
  assertEqual(bidNavigatorSummary.difficultyBidRewardPreview.rewardKey, "legendaryEvent", "summary should include read-only reward preview ladder result");

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
    journal: { create() { throw new Error("journal create should not be called"); } },
    scene: { update() { throw new Error("scene update should not be called"); } },
    token: { update() { throw new Error("token update should not be called"); } },
    combat: { update() { throw new Error("combat update should not be called"); } },
    playerStationCards: { update() { throw new Error("player station cards should not be called"); } }
  }), { now: "2026-06-19T00:00:04.000Z" });
  assertSmoke(sideEffectResult.ok, "side-effect sentinels should not be called during finalization");

  return {
    ok: true,
    checked: [
      "session-round-finalization-version",
      "difficulty-bid-normalization",
      "difficulty-bid-reward-ladder",
      "difficulty-bid-preview-player-safe-read-only",
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
