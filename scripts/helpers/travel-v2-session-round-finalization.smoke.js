import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import {
  applyTravelV2ActiveCardApplicationPreviewToSession,
  finalizeTravelV2RoundOnRunnerSession,
  getTravelV2DifficultyBidDcModifier,
  getTravelV2StationResultForRound,
  isTravelV2RoundActionsLocked,
  normalizeTravelV2ActiveCardRecords,
  normalizeTravelV2DifficultyBid,
  prepareTravelV2DifficultyBidCardRecord,
  prepareTravelV2DifficultyBidCardRecordsFromStationActionSummary,
  prepareTravelV2DifficultyBidPreview,
  prepareTravelV2DifficultyBidRewardPreview,
  prepareTravelV2ActiveCardsPreviewState,
  prepareTravelV2ActiveCardApplicationPreviewState,
  prepareTravelV2StationActionResolutionSummary,
  prepareTravelV2StationActionEventApproachEffects,
  prepareTravelV2StationActionEventApproachContributions,
  prepareTravelV2StationRollBonusState,
  resolveTravelV2StationRollWithPendingEffects,
  consumeTravelV2PendingStationActionBonusesForStationRoll,
  applyTravelV2PendingStationResultFloorToOutcome,
  prepareTravelV2StationResultFloorState,
  prepareTravelV2EventApproachTallyApplicationPreview,
  sanitizeTravelV2ActiveCardsForPlayers,
  TRAVEL_V2_ACTIVE_CARD_RECORDS_VERSION,
  TRAVEL_V2_ACTIVE_CARD_STATUSES,
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

function pendingActiveCard(overrides = {}) {
  return {
    cardId: "travel-v2-card:0:captain:minor:success:minorOpening",
    cardKey: "minorOpening",
    rewardKey: "minorOpening",
    cardLabel: "Minor Opening",
    sourceStationKey: "captain",
    sourceStationLabel: "Captain",
    sourceBidKey: "minor",
    sourceBidLabel: "Minor Bid",
    sourceResult: "success",
    roundIndex: 0,
    roundNumber: 1,
    status: "pending",
    timingHint: "Play after station actions are locked and before the target station rolls.",
    effectPreviewText: "Future effect: grant +1 circumstance bonus to one target station roll.",
    playerSafe: true,
    readOnly: true,
    ...overrides
  };
}

export function runTravelV2SessionRoundFinalizationSmokeChecks() {
  assertEqual(TRAVEL_V2_SESSION_ROUND_FINALIZATION_VERSION, 1, "session round finalization version should be 1");
  assertEqual(TRAVEL_V2_ACTIVE_CARD_RECORDS_VERSION, 1, "active card records version should be 1");
  assertEqual(TRAVEL_V2_ACTIVE_CARD_STATUSES.join(","), "pending,consumed,applied", "active card statuses should expose pending and consumed states");


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
    const record = prepareTravelV2DifficultyBidCardRecord({
      stationKey: "navigator",
      stationLabel: "Navigator",
      difficultyBidKey: bid,
      difficultyBidLabel: `${bid} bid`,
      stationResult: outcome,
      difficultyBidRewardPreview: preview,
      roundIndex: 0,
      roundNumber: 1
    });
    assertEqual(record.rewardKey, reward, `${bid} + ${outcome} should create ${reward} card record`);
    assertEqual(record.status, "pending", `${bid} + ${outcome} card should be pending`);
    assertSmoke(record.playerSafe && record.readOnly, `${bid} + ${outcome} card should be player-safe/read-only`);
  }
  assertSmoke(!prepareTravelV2DifficultyBidRewardPreview("extreme", "failure").hasReward, "failure should create no bid reward");
  assertEqual(prepareTravelV2DifficultyBidCardRecord({ stationKey: "navigator", difficultyBidKey: "extreme", stationResult: "failure", difficultyBidRewardPreview: prepareTravelV2DifficultyBidRewardPreview("extreme", "failure") }), null, "failure should create no card record");
  const criticalFailureBidPreview = prepareTravelV2DifficultyBidRewardPreview("extreme", "criticalFailure");
  assertSmoke(!criticalFailureBidPreview.hasReward, "critical failure should create no bid reward");
  assertSmoke(criticalFailureBidPreview.hasBacklashPreview && criticalFailureBidPreview.backlashPreview?.placeholder, "critical failure should expose only backlash preview placeholder");
  assertEqual(prepareTravelV2DifficultyBidCardRecord({ stationKey: "navigator", difficultyBidKey: "extreme", stationResult: "criticalFailure", difficultyBidRewardPreview: criticalFailureBidPreview }), null, "critical failure should create no card record");
  assertSmoke(normalizeTravelV2ActiveCardRecords().records.length === 0, "active card normalization should tolerate missing saved-session data");
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
  assertEqual(bidResult.travelV2ActiveCards.records.length, 1, "successful bid finalization should create one active card container record");
  assertEqual(bidResult.travelV2ActiveCards.records[0].rewardKey, "legendaryEvent", "extreme critical success should create legendary event active card");
  assertEqual(bidResult.session.travelV2ActiveCards.records.length, 1, "finalized session should include active card container");
  assertEqual(bidResult.roundResolutionRecord.travelV2ActiveCards.records[0].rewardKey, "legendaryEvent", "round resolution should snapshot active card records");
  assertSmoke(sanitizeTravelV2ActiveCardsForPlayers(bidResult.session.travelV2ActiveCards).records[0].playerSafe, "sanitized active cards should remain player-safe");
  const bidSecondAppend = finalizeTravelV2RoundOnRunnerSession(bidResult.session, { now: "2026-06-19T00:00:00.750Z" });
  assertSmoke(!bidSecondAppend.ok, "second finalization of bid round should block");
  assertEqual(bidSecondAppend.session.travelV2ActiveCards.records.length, 1, "duplicate finalization should not duplicate active cards");
  const cardSummarySource = { roundIndex: 0, roundNumber: 1, stations: [bidNavigatorSummary, bidNavigatorSummary] };
  const cardSummaryBefore = snapshot(cardSummarySource);
  const cardRecords = prepareTravelV2DifficultyBidCardRecordsFromStationActionSummary(cardSummarySource);
  assertEqual(cardRecords.records.length, 1, "card summary helper should dedupe stable active card ids");
  assertEqual(snapshot(cardSummarySource), cardSummaryBefore, "card record helpers should not mutate source summary data");

  const existingCard = pendingActiveCard();
  const noNewCardResult = finalizeTravelV2RoundOnRunnerSession(createRunnerSessionFixture({
    currentRoundIndex: 1,
    travelV2ActiveCards: { records: [existingCard], playerSafe: true, readOnly: true },
    travelV2PressureApplications: { records: [applicationRecord({ roundIndex: 1, roundNumber: 2, outcomeKey: "success" })] }
  }), { now: "2026-06-19T00:00:00.800Z" });
  assertSmoke(noNewCardResult.ok, "round with existing active card and no new bid card should finalize");
  assertEqual(noNewCardResult.createdTravelV2ActiveCards.records.length, 0, "no-reward finalization should report zero newly created cards");
  assertEqual(noNewCardResult.travelV2ActiveCards.records.length, 1, "finalization result should expose existing merged active card when no new card is created");
  assertEqual(noNewCardResult.activeCardRecords[0].cardId, existingCard.cardId, "merged finalization active-card records should include existing card id");
  const oldPlusNewResult = finalizeTravelV2RoundOnRunnerSession({
    ...bidSession,
    travelV2ActiveCards: { records: [existingCard], playerSafe: true, readOnly: true }
  }, { now: "2026-06-19T00:00:00.900Z" });
  assertSmoke(oldPlusNewResult.ok, "round with existing active card and new bid card should finalize");
  assertEqual(oldPlusNewResult.createdTravelV2ActiveCards.records.length, 1, "bid finalization should preserve newly created card container separately");
  assertEqual(oldPlusNewResult.travelV2ActiveCards.records.length, 2, "merged finalization active-card pile should include old and new cards");
  const duplicateGeneratedCardId = oldPlusNewResult.createdActiveCardRecords[0].cardId;
  const duplicateExistingResult = finalizeTravelV2RoundOnRunnerSession({
    ...bidSession,
    travelV2ActiveCards: { records: [pendingActiveCard({ cardId: duplicateGeneratedCardId, id: duplicateGeneratedCardId, rewardKey: "legendaryEvent", cardKey: "legendaryEvent", cardLabel: "Legendary Event", sourceStationKey: "navigator", sourceStationLabel: "Navigator", sourceBidKey: "extreme", sourceBidLabel: "Extreme Bid", sourceResult: "criticalSuccess", roundIndex: 0, roundNumber: 1 })], playerSafe: true, readOnly: true }
  }, { now: "2026-06-19T00:00:00.950Z" });
  assertSmoke(duplicateExistingResult.ok, "round with duplicate existing active card id should finalize");
  assertEqual(duplicateExistingResult.travelV2ActiveCards.records.length, 1, "merged finalization active-card pile should dedupe duplicate stable ids");
  const unsafeSanitized = sanitizeTravelV2ActiveCardsForPlayers({ records: [pendingActiveCard({ gmText: "secret", auditRecord: { secret: true } })] });
  const unsafeSanitizedJson = JSON.stringify(unsafeSanitized);
  assertSmoke(!unsafeSanitizedJson.includes("gmText") && !unsafeSanitizedJson.includes("auditRecord") && !unsafeSanitizedJson.includes("secret"), "active card sanitizer should strip GM/internal fields");

  const previewBaseSession = createRunnerSessionFixture({ roundResults: [{ ...lockedRoundResult(), stationResults: {} }] });
  const previewWithoutTarget = prepareTravelV2ActiveCardsPreviewState([pendingActiveCard()], previewBaseSession);
  assertEqual(previewWithoutTarget.records[0].previewStatus, "needsTarget", "active card without target should need target");
  assertSmoke(snapshot(previewBaseSession) === snapshot(createRunnerSessionFixture({ roundResults: [{ ...lockedRoundResult(), stationResults: {} }] })), "active card preview helper should not mutate source session data");

  for (const cardKey of ["minorOpening", "greaterOpening", "legendaryEvent"]) {
    const preview = prepareTravelV2ActiveCardsPreviewState([pendingActiveCard({ cardKey, rewardKey: cardKey, targetStationKey: "navigator" })], previewBaseSession);
    assertEqual(preview.records[0].previewStatus, "playable", `${cardKey} with locked actions and no target result should be playable`);
    assertSmoke(preview.records[0].playablePreview === true, `${cardKey} should set playable preview`);
  }

  const rolledBeforeRoll = prepareTravelV2ActiveCardsPreviewState([pendingActiveCard({ targetStationKey: "navigator" })], createRunnerSessionFixture({ roundResults: [{ ...lockedRoundResult(), stationResults: { navigator: "success" } }] }));
  assertEqual(rolledBeforeRoll.records[0].previewStatus, "missedWindow", "before-roll active card with target already rolled should miss window");
  const beforeLock = prepareTravelV2ActiveCardsPreviewState([pendingActiveCard({ targetStationKey: "navigator" })], createRunnerSessionFixture({ roundResults: [{ stationOrderCommitments: {}, stationResults: {} }] }));
  assertEqual(beforeLock.records[0].previewStatus, "waitingForLock", "before-roll active card before lock should wait for lock");

  const heroicNoResult = prepareTravelV2ActiveCardsPreviewState([pendingActiveCard({ cardKey: "heroicEvent", rewardKey: "heroicEvent", targetStationKey: "navigator" })], previewBaseSession);
  assertEqual(heroicNoResult.records[0].previewStatus, "waitingForTrigger", "heroic event with no result should wait for trigger");
  for (const result of ["failure", "criticalFailure"]) {
    const heroic = prepareTravelV2ActiveCardsPreviewState([pendingActiveCard({ cardKey: "heroicEvent", rewardKey: "heroicEvent", targetStationKey: "navigator" })], createRunnerSessionFixture({ roundResults: [{ ...lockedRoundResult(), stationResults: { navigator: result } }] }));
    assertEqual(heroic.records[0].previewStatus, "triggerReady", `heroic event with ${result} should be trigger-ready`);
  }
  for (const result of ["success", "criticalSuccess"]) {
    const heroic = prepareTravelV2ActiveCardsPreviewState([pendingActiveCard({ cardKey: "heroicEvent", rewardKey: "heroicEvent", targetStationKey: "navigator" })], createRunnerSessionFixture({ roundResults: [{ ...lockedRoundResult(), stationResults: { navigator: result } }] }));
    assertEqual(heroic.records[0].previewStatus, "noTrigger", `heroic event with ${result} should have no trigger`);
  }
  const invalidTarget = prepareTravelV2ActiveCardsPreviewState([pendingActiveCard({ targetStationKey: "missing" })], previewBaseSession);
  assertEqual(invalidTarget.records[0].targetStatus, "invalidTarget", "unavailable target station should normalize safely");
  const previewJson = JSON.stringify(prepareTravelV2ActiveCardsPreviewState([pendingActiveCard({ targetStationKey: "navigator", gmText: "secret" })], previewBaseSession));
  assertSmoke(!previewJson.includes("gmText") && !previewJson.includes("secret"), "active card preview state should remain player-safe");

  const minorApplicationPreview = prepareTravelV2ActiveCardApplicationPreviewState(prepareTravelV2ActiveCardsPreviewState([pendingActiveCard({ cardKey: "minorOpening", rewardKey: "minorOpening", targetStationKey: "navigator" })], previewBaseSession), previewBaseSession);
  assertEqual(minorApplicationPreview.records.length, 1, "minor opening playable card should create one application preview");
  assertEqual(minorApplicationPreview.records[0].applicationType, "circumstanceBonusPreview", "minor opening application preview should be a circumstance bonus preview");
  assertEqual(minorApplicationPreview.records[0].bonusType, "circumstance", "minor opening application preview should use circumstance bonus type");
  assertEqual(minorApplicationPreview.records[0].bonusValue, 1, "minor opening application preview should grant future +1");
  assertSmoke(minorApplicationPreview.records[0].requiresGMConfirmation === true && minorApplicationPreview.records[0].canApplyPreview === true, "minor opening application preview should require GM confirmation and be apply-ready");
  assertSmoke(!JSON.stringify(minorApplicationPreview).includes("pendingStationActionBonuses"), "minor opening application preview should not create actual pending bonuses");

  const greaterApplicationPreview = prepareTravelV2ActiveCardApplicationPreviewState(prepareTravelV2ActiveCardsPreviewState([pendingActiveCard({ cardKey: "greaterOpening", rewardKey: "greaterOpening", targetStationKey: "navigator" })], previewBaseSession), previewBaseSession);
  assertEqual(greaterApplicationPreview.records[0].applicationType, "circumstanceBonusPreview", "greater opening application preview should be a circumstance bonus preview");
  assertEqual(greaterApplicationPreview.records[0].bonusValue, 3, "greater opening application preview should grant future +3");

  const heroicFailureApplicationPreview = prepareTravelV2ActiveCardApplicationPreviewState(prepareTravelV2ActiveCardsPreviewState([pendingActiveCard({ cardKey: "heroicEvent", rewardKey: "heroicEvent", targetStationKey: "navigator" })], createRunnerSessionFixture({ roundResults: [{ ...lockedRoundResult(), stationResults: { navigator: "failure" } }] })));
  assertEqual(heroicFailureApplicationPreview.records[0].applicationType, "degreeUpgradePreview", "heroic event failure should create degree upgrade preview");
  assertEqual(heroicFailureApplicationPreview.records[0].targetResultBefore, "failure", "heroic event failure preview should record before result");
  assertEqual(heroicFailureApplicationPreview.records[0].targetResultAfter, "success", "heroic event failure preview should record after result");

  const heroicCriticalFailureApplicationPreview = prepareTravelV2ActiveCardApplicationPreviewState(prepareTravelV2ActiveCardsPreviewState([pendingActiveCard({ cardKey: "heroicEvent", rewardKey: "heroicEvent", targetStationKey: "navigator" })], createRunnerSessionFixture({ roundResults: [{ ...lockedRoundResult(), stationResults: { navigator: "criticalFailure" } }] })));
  assertEqual(heroicCriticalFailureApplicationPreview.records[0].targetResultBefore, "criticalFailure", "heroic event critical failure preview should record before result");
  assertEqual(heroicCriticalFailureApplicationPreview.records[0].targetResultAfter, "failure", "heroic event critical failure preview should record after result");

  const heroicSuccessApplicationPreview = prepareTravelV2ActiveCardApplicationPreviewState(prepareTravelV2ActiveCardsPreviewState([pendingActiveCard({ cardKey: "heroicEvent", rewardKey: "heroicEvent", targetStationKey: "navigator" })], createRunnerSessionFixture({ roundResults: [{ ...lockedRoundResult(), stationResults: { navigator: "success" } }] })));
  assertSmoke(heroicSuccessApplicationPreview.records[0].canApplyPreview === false && Boolean(heroicSuccessApplicationPreview.records[0].blockedReason), "heroic event success should be represented as blocked when previewed");
  const heroicNoTargetApplicationPreview = prepareTravelV2ActiveCardApplicationPreviewState(prepareTravelV2ActiveCardsPreviewState([pendingActiveCard({ cardKey: "heroicEvent", rewardKey: "heroicEvent" })], previewBaseSession));
  assertSmoke(heroicNoTargetApplicationPreview.records[0].canApplyPreview === false && Boolean(heroicNoTargetApplicationPreview.records[0].blockedReason), "heroic event without target should be blocked when previewed");

  const legendaryApplicationPreview = prepareTravelV2ActiveCardApplicationPreviewState(prepareTravelV2ActiveCardsPreviewState([pendingActiveCard({ cardKey: "legendaryEvent", rewardKey: "legendaryEvent", targetStationKey: "navigator" })], previewBaseSession), previewBaseSession);
  assertEqual(legendaryApplicationPreview.records[0].applicationType, "resultFloorPreview", "legendary event should create result floor preview");
  assertEqual(legendaryApplicationPreview.records[0].resultFloor, "success", "legendary event should preview success result floor");
  assertSmoke(legendaryApplicationPreview.records[0].preservesCriticalSuccess === true, "legendary event should preserve possible critical successes");

  const duplicateApplicationPreview = prepareTravelV2ActiveCardApplicationPreviewState(prepareTravelV2ActiveCardsPreviewState([pendingActiveCard({ cardKey: "minorOpening", rewardKey: "minorOpening", targetStationKey: "navigator" }), pendingActiveCard({ cardKey: "minorOpening", rewardKey: "minorOpening", targetStationKey: "navigator" })], previewBaseSession), previewBaseSession);
  assertEqual(duplicateApplicationPreview.records.length, 1, "application preview state should dedupe stable preview ids");
  const invalidApplicationPreview = prepareTravelV2ActiveCardApplicationPreviewState(invalidTarget, previewBaseSession);
  assertSmoke(invalidApplicationPreview.records[0].canApplyPreview === false && Boolean(invalidApplicationPreview.records[0].blockedReason), "invalid target station should create no apply-ready preview");
  const applicationPreviewJson = JSON.stringify(legendaryApplicationPreview);
  for (const forbidden of ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions"]) {
    assertSmoke(!applicationPreviewJson.includes(forbidden), `application preview state should not include forbidden player-safe term ${forbidden}`);
  }
  const minorApplySession = createRunnerSessionFixture({ roundResults: [{ ...lockedRoundResult(), stationResults: {} }], travelV2ActiveCards: { records: [pendingActiveCard({ targetStationKey: "navigator", targetStationLabel: "Navigator" })], playerSafe: true, readOnly: true } });
  const minorPreviewId = prepareTravelV2ActiveCardApplicationPreviewState(prepareTravelV2ActiveCardsPreviewState(minorApplySession.travelV2ActiveCards, minorApplySession), minorApplySession).records[0].previewId;
  const missingConfirmationApply = applyTravelV2ActiveCardApplicationPreviewToSession(minorApplySession, minorPreviewId, { now: "2026-06-19T00:00:05.000Z" });
  assertSmoke(!missingConfirmationApply.ok && missingConfirmationApply.blocked, "active card application should require explicit GM confirmation");
  const invalidPreviewApply = applyTravelV2ActiveCardApplicationPreviewToSession(minorApplySession, "missing-preview", { confirmedByGM: true });
  assertSmoke(!invalidPreviewApply.ok && invalidPreviewApply.blocked, "invalid active card application preview id should block safely");
  const minorApply = applyTravelV2ActiveCardApplicationPreviewToSession(minorApplySession, minorPreviewId, { confirmedByGM: true, gmUserId: "gm-should-not-leak", now: "2026-06-19T00:00:05.000Z" });
  assertSmoke(minorApply.ok && minorApply.applied && !minorApply.blocked, "minor opening application should apply with GM confirmation");
  assertEqual(minorApply.pendingStationActionBonusRecord.bonusValue, 1, "minor opening application should create pending +1 bonus");
  assertEqual(minorApply.pendingStationActionBonusRecord.bonusType, "circumstance", "minor opening application should create circumstance bonus");
  assertEqual(minorApply.consumedCardRecord.status, "consumed", "minor opening application should consume active card");
  assertEqual(minorApply.session.travelV2ActiveCards.records.length, 1, "consumed active card should remain in session records");
  assertEqual(minorApply.session.travelV2ActiveCards.records[0].status, "consumed", "session active card record should be consumed");
  assertEqual(minorApply.session.travelV2AppliedActiveCards.records.length, 1, "minor opening application should append applied card record");
  assertSmoke(!minorApply.stationResultChange && !minorApply.session.roundResults[0].stationResults.navigator, "minor opening should not mutate station result data");
  assertEqual(snapshot(minorApplySession.roundResults[0].stationResults), snapshot({}), "minor opening application should not mutate source session");
  const consumedPreview = prepareTravelV2ActiveCardsPreviewState(minorApply.session.travelV2ActiveCards, minorApply.session).records[0];
  assertSmoke(consumedPreview.status === "consumed" && consumedPreview.playablePreview === false && consumedPreview.triggerReadyPreview === false, "consumed cards should not be apply-ready in recomputed preview state");

  const greaterApplySession = createRunnerSessionFixture({ roundResults: [{ ...lockedRoundResult(), stationResults: {} }], travelV2ActiveCards: { records: [pendingActiveCard({ cardKey: "greaterOpening", rewardKey: "greaterOpening", cardLabel: "Greater Opening", targetStationKey: "navigator", targetStationLabel: "Navigator" })], playerSafe: true, readOnly: true } });
  const greaterPreviewId = prepareTravelV2ActiveCardApplicationPreviewState(prepareTravelV2ActiveCardsPreviewState(greaterApplySession.travelV2ActiveCards, greaterApplySession), greaterApplySession).records[0].previewId;
  const greaterApply = applyTravelV2ActiveCardApplicationPreviewToSession(greaterApplySession, greaterPreviewId, { confirmedByGM: true, now: "2026-06-19T00:00:06.000Z" });
  assertSmoke(greaterApply.ok, "greater opening application should apply with GM confirmation");
  assertEqual(greaterApply.pendingStationActionBonusRecord.bonusValue, 3, "greater opening application should create pending +3 bonus");
  assertEqual(greaterApply.session.travelV2AppliedActiveCards.records.length, 1, "greater opening application should append applied card record");

  for (const [beforeResult, afterResult] of [["failure", "success"], ["criticalFailure", "failure"]]) {
    const heroicApplySession = createRunnerSessionFixture({ roundResults: [{ ...lockedRoundResult(), stationResults: { navigator: beforeResult } }], travelV2ActiveCards: { records: [pendingActiveCard({ cardKey: "heroicEvent", rewardKey: "heroicEvent", cardLabel: "Heroic Event", targetStationKey: "navigator", targetStationLabel: "Navigator" })], playerSafe: true, readOnly: true } });
    const heroicPreviewId = prepareTravelV2ActiveCardApplicationPreviewState(prepareTravelV2ActiveCardsPreviewState(heroicApplySession.travelV2ActiveCards, heroicApplySession), heroicApplySession).records[0].previewId;
    const heroicApply = applyTravelV2ActiveCardApplicationPreviewToSession(heroicApplySession, heroicPreviewId, { confirmedByGM: true, now: "2026-06-19T00:00:07.000Z" });
    assertSmoke(heroicApply.ok, `heroic event application should apply to ${beforeResult}`);
    assertEqual(heroicApply.stationResultChange.before, beforeResult, "heroic event applied record should include before result");
    assertEqual(heroicApply.stationResultChange.after, afterResult, "heroic event should improve target result by one degree");
    assertEqual(heroicApply.session.roundResults[0].stationResults.navigator, afterResult, "heroic event should update cloned session round result");
    assertEqual(heroicApply.appliedCardRecord.targetResultBefore, beforeResult, "heroic applied card record should include before result");
    assertEqual(heroicApply.appliedCardRecord.targetResultAfter, afterResult, "heroic applied card record should include after result");
    assertEqual(heroicApply.consumedCardRecord.status, "consumed", "heroic event should consume active card");
    assertEqual(heroicApplySession.roundResults[0].stationResults.navigator, beforeResult, "heroic application should not mutate source session");
    const consumedAgain = applyTravelV2ActiveCardApplicationPreviewToSession(heroicApply.session, heroicPreviewId, { confirmedByGM: true });
    assertSmoke(!consumedAgain.ok && consumedAgain.blocked, "already consumed heroic card should block reapplication");
  }
  const explicitRoundIndexHeroicSession = createRunnerSessionFixture({
    currentRoundIndex: 1,
    roundResults: [{ roundIndex: 1, ...lockedRoundResult(), stationResults: { navigator: "failure" } }],
    travelV2ActiveCards: { records: [pendingActiveCard({ cardKey: "heroicEvent", rewardKey: "heroicEvent", cardLabel: "Heroic Event", targetStationKey: "navigator", targetStationLabel: "Navigator" })], playerSafe: true, readOnly: true }
  });
  const explicitRoundIndexBefore = snapshot(explicitRoundIndexHeroicSession);
  const explicitRoundIndexHeroicPreviewId = prepareTravelV2ActiveCardApplicationPreviewState(prepareTravelV2ActiveCardsPreviewState(explicitRoundIndexHeroicSession.travelV2ActiveCards, explicitRoundIndexHeroicSession), explicitRoundIndexHeroicSession).records[0].previewId;
  const explicitRoundIndexHeroicApply = applyTravelV2ActiveCardApplicationPreviewToSession(explicitRoundIndexHeroicSession, explicitRoundIndexHeroicPreviewId, { confirmedByGM: true, now: "2026-06-19T00:00:07.500Z" });
  assertSmoke(explicitRoundIndexHeroicApply.ok, "heroic event should apply when preview uses an explicit roundIndex record stored at a different array position");
  assertEqual(explicitRoundIndexHeroicApply.session.roundResults.length, 1, "heroic explicit roundIndex apply should not create a duplicate array-position record");
  assertEqual(explicitRoundIndexHeroicApply.session.roundResults[0].roundIndex, 1, "heroic explicit roundIndex apply should preserve target roundIndex on updated record");
  assertEqual(explicitRoundIndexHeroicApply.session.roundResults[0].stationResults.navigator, "success", "heroic explicit roundIndex apply should update the explicit record read by preview lookup");
  assertEqual(getTravelV2StationResultForRound(explicitRoundIndexHeroicApply.session, "navigator", 1), "success", "station result lookup should read upgraded explicit roundIndex result after apply");
  assertEqual(snapshot(explicitRoundIndexHeroicSession), explicitRoundIndexBefore, "heroic explicit roundIndex apply should not mutate source session");
  const explicitRoundIndexConsumedAgain = applyTravelV2ActiveCardApplicationPreviewToSession(explicitRoundIndexHeroicApply.session, explicitRoundIndexHeroicPreviewId, { confirmedByGM: true });
  assertSmoke(!explicitRoundIndexConsumedAgain.ok && explicitRoundIndexConsumedAgain.blocked, "consumed explicit roundIndex heroic card should block replay");

  const indexPositionHeroicSession = createRunnerSessionFixture({
    currentRoundIndex: 1,
    roundResults: [lockedRoundResult(), { ...lockedRoundResult(), stationResults: { navigator: "failure" } }],
    travelV2ActiveCards: { records: [pendingActiveCard({ cardKey: "heroicEvent", rewardKey: "heroicEvent", cardLabel: "Heroic Event", targetStationKey: "navigator", targetStationLabel: "Navigator" })], playerSafe: true, readOnly: true }
  });
  const indexPositionHeroicBefore = snapshot(indexPositionHeroicSession);
  const indexPositionHeroicPreviewId = prepareTravelV2ActiveCardApplicationPreviewState(prepareTravelV2ActiveCardsPreviewState(indexPositionHeroicSession.travelV2ActiveCards, indexPositionHeroicSession), indexPositionHeroicSession).records[0].previewId;
  const indexPositionHeroicApply = applyTravelV2ActiveCardApplicationPreviewToSession(indexPositionHeroicSession, indexPositionHeroicPreviewId, { confirmedByGM: true, now: "2026-06-19T00:00:07.750Z" });
  assertSmoke(indexPositionHeroicApply.ok, "heroic event should apply using array-position fallback when no explicit roundIndex record exists");
  assertEqual(indexPositionHeroicApply.session.roundResults[1].roundIndex, 1, "heroic array-position fallback should set target roundIndex on updated record");
  assertEqual(indexPositionHeroicApply.session.roundResults[1].stationResults.navigator, "success", "heroic array-position fallback should update roundResults[1]");
  assertEqual(getTravelV2StationResultForRound(indexPositionHeroicApply.session, "navigator", 1), "success", "station result lookup should read upgraded array-position fallback result after apply");
  assertEqual(snapshot(indexPositionHeroicSession), indexPositionHeroicBefore, "heroic array-position fallback should not mutate source session");

  const heroicSuccessApplySession = createRunnerSessionFixture({ roundResults: [{ ...lockedRoundResult(), stationResults: { navigator: "success" } }], travelV2ActiveCards: { records: [pendingActiveCard({ cardKey: "heroicEvent", rewardKey: "heroicEvent", cardLabel: "Heroic Event", targetStationKey: "navigator", targetStationLabel: "Navigator" })], playerSafe: true, readOnly: true } });
  const heroicSuccessPreviewId = prepareTravelV2ActiveCardApplicationPreviewState(prepareTravelV2ActiveCardsPreviewState(heroicSuccessApplySession.travelV2ActiveCards, heroicSuccessApplySession), heroicSuccessApplySession).records[0].previewId;
  const heroicSuccessApply = applyTravelV2ActiveCardApplicationPreviewToSession(heroicSuccessApplySession, heroicSuccessPreviewId, { confirmedByGM: true });
  assertSmoke(!heroicSuccessApply.ok && heroicSuccessApply.blocked, "heroic event application should block when target result is success");

  const legendaryApplySession = createRunnerSessionFixture({ roundResults: [{ ...lockedRoundResult(), stationResults: {} }], travelV2ActiveCards: { records: [pendingActiveCard({ cardKey: "legendaryEvent", rewardKey: "legendaryEvent", cardLabel: "Legendary Event", targetStationKey: "navigator", targetStationLabel: "Navigator" })], playerSafe: true, readOnly: true } });
  const legendaryPreviewId = prepareTravelV2ActiveCardApplicationPreviewState(prepareTravelV2ActiveCardsPreviewState(legendaryApplySession.travelV2ActiveCards, legendaryApplySession), legendaryApplySession).records[0].previewId;
  const legendaryApply = applyTravelV2ActiveCardApplicationPreviewToSession(legendaryApplySession, legendaryPreviewId, { confirmedByGM: true, now: "2026-06-19T00:00:08.000Z" });
  assertSmoke(legendaryApply.ok, "legendary event application should apply with GM confirmation");
  assertEqual(legendaryApply.pendingResultFloorRecord.resultFloor, "success", "legendary event should create success result-floor record");
  assertEqual(legendaryApply.consumedCardRecord.status, "consumed", "legendary event should consume active card");
  assertSmoke(!legendaryApply.stationResultChange && !legendaryApply.session.roundResults[0].stationResults.navigator, "legendary event should not immediately mutate station result data");
  assertEqual(legendaryApply.session.travelV2AppliedActiveCards.records.length, 1, "legendary event should append applied card record");

  const supportRegressionSession = createRunnerSessionFixture({ travelV2PressureApplications: { records: [applicationRecord()] } });
  const supportBefore = finalizeTravelV2RoundOnRunnerSession(supportRegressionSession, { now: "2026-06-19T00:00:09.000Z" });
  const supportAfter = finalizeTravelV2RoundOnRunnerSession(supportRegressionSession, { now: "2026-06-19T00:00:09.000Z" });
  assertEqual(snapshot(supportAfter.pendingStationActionBonuses), snapshot(supportBefore.pendingStationActionBonuses), "support pending bonus behavior should remain unchanged by card apply helper");
  assertEqual(snapshot(supportAfter.eventApproachContributionTally), snapshot(supportBefore.eventApproachContributionTally), "event approach tally behavior should remain unchanged by card apply helper");

  const applyJson = JSON.stringify(minorApply);
  for (const forbidden of ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions", "gm-should-not-leak"]) {
    assertSmoke(!applyJson.includes(forbidden), `active card apply result should not include forbidden player-safe term ${forbidden}`);
  }


  const futureRoundSession = createRunnerSessionFixture({
    currentRoundIndex: 1,
    roundResults: [
      { ...lockedRoundResult(), stationResults: { navigator: "success" } },
      { ...lockedRoundResult(), stationResults: {} }
    ]
  });
  const oldBeforeRollCard = prepareTravelV2ActiveCardsPreviewState([pendingActiveCard({ roundIndex: 0, roundNumber: 1, targetStationKey: "navigator" })], futureRoundSession);
  assertEqual(oldBeforeRollCard.records[0].previewStatus, "playable", "existing before-roll card should evaluate current round instead of stale created round");
  assertEqual(oldBeforeRollCard.records[0].previewRoundIndex, 1, "active card preview should expose current preview round index");
  assertEqual(oldBeforeRollCard.records[0].previewRoundNumber, 2, "active card preview should expose current preview round number");

  const oldHeroicFailedCurrentRound = prepareTravelV2ActiveCardsPreviewState([pendingActiveCard({ cardKey: "heroicEvent", rewardKey: "heroicEvent", roundIndex: 0, roundNumber: 1, targetStationKey: "navigator" })], createRunnerSessionFixture({
    currentRoundIndex: 1,
    roundResults: [
      { ...lockedRoundResult(), stationResults: {} },
      { ...lockedRoundResult(), stationResults: { navigator: "failure" } }
    ]
  }));
  assertEqual(oldHeroicFailedCurrentRound.records[0].previewStatus, "triggerReady", "existing heroic card should trigger from current round failure");

  const oldHeroicStaleFailure = prepareTravelV2ActiveCardsPreviewState([pendingActiveCard({ cardKey: "heroicEvent", rewardKey: "heroicEvent", roundIndex: 0, roundNumber: 1, targetStationKey: "navigator" })], createRunnerSessionFixture({
    currentRoundIndex: 1,
    roundResults: [
      { ...lockedRoundResult(), stationResults: { navigator: "failure" } },
      { ...lockedRoundResult(), stationResults: {} }
    ]
  }));
  assertEqual(oldHeroicStaleFailure.records[0].previewStatus, "waitingForTrigger", "existing heroic card should ignore stale created-round failure");

  const implicitIndexSession = createRunnerSessionFixture({
    currentRoundIndex: 1,
    roundResults: [
      { ...lockedRoundResult(), stationResults: { navigator: "success" } },
      { stationOrderCommitments: {}, stationResults: { navigator: "failure" } }
    ]
  });
  assertSmoke(isTravelV2RoundActionsLocked(implicitIndexSession, 1) === false, "action lock lookup should use roundResults[1] when records lack explicit roundIndex");
  assertEqual(getTravelV2StationResultForRound(implicitIndexSession, "navigator", 1), "failure", "station result lookup should use roundResults[1] when records lack explicit roundIndex");

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

  const bonusSession = {
    currentRoundIndex: 0,
    event: { rounds: [{ activeStations: ["navigator", "engineer"] }] },
    travelV2PendingStationActionBonuses: {
      records: [
        { id: "support-1", bonusKey: "support", bonusType: "circumstance", bonusValue: 1, sourceStationLabel: "Engineer", targetStationKey: "navigator", targetStationLabel: "Navigator", nextRoundIndex: 0, consumed: false, playerSafe: true, readOnly: true },
        { id: "greater-1", bonusKey: "greaterOpeningBonus", bonusType: "circumstance", bonusValue: 3, sourceCardId: "card-greater", sourceCardLabel: "Greater Opening", targetStationKey: "navigator", targetStationLabel: "Navigator", previewRoundIndex: 0, consumed: false, playerSafe: true, readOnly: true },
        { id: "other-station", bonusKey: "minorOpeningBonus", bonusType: "circumstance", bonusValue: 1, sourceCardId: "card-minor", targetStationKey: "engineer", previewRoundIndex: 0, consumed: false, playerSafe: true, readOnly: true },
        { id: "wrong-round", bonusKey: "support", bonusType: "circumstance", bonusValue: 1, targetStationKey: "navigator", nextRoundIndex: 1, consumed: false, playerSafe: true, readOnly: true },
        { id: "consumed", bonusKey: "support", bonusType: "circumstance", bonusValue: 9, targetStationKey: "navigator", nextRoundIndex: 0, consumed: true, playerSafe: true, readOnly: true }
      ]
    }
  };
  const bonusState = prepareTravelV2StationRollBonusState(bonusSession, "navigator", 0);
  assertEqual(bonusState.selectedBonusValue, 3, "Greater Opening +3 should be selected over Support +1");
  assertEqual(bonusState.selectedSourceCardId, "card-greater", "selected card id should be exposed for card bonuses");
  assertSmoke(bonusState.suppressed.some((record) => record.recordId === "support-1"), "lower Support bonus should be suppressed by same-round Greater Opening");
  assertSmoke(!bonusState.candidates.some((record) => record.recordId === "other-station" || record.recordId === "wrong-round" || record.recordId === "consumed"), "wrong station, wrong round, and consumed bonuses should be ignored");
  const tiedBonusState = prepareTravelV2StationRollBonusState({
    currentRoundIndex: 0,
    travelV2PendingStationActionBonuses: { records: [
      { id: "support-tie", bonusKey: "support", bonusType: "circumstance", bonusValue: 1, targetStationKey: "navigator", nextRoundIndex: 0, consumed: false, playerSafe: true, readOnly: true },
      { id: "minor-tie", bonusKey: "minorOpeningBonus", bonusType: "circumstance", bonusValue: 1, sourceCardId: "card-minor", targetStationKey: "navigator", previewRoundIndex: 0, consumed: false, playerSafe: true, readOnly: true }
    ] }
  }, "navigator", 0);
  assertEqual(tiedBonusState.selectedBonusValue, 1, "Support +1 and Minor Opening +1 should select one +1 circumstance bonus");
  assertEqual(tiedBonusState.suppressed.length, 1, "equal circumstance bonus should suppress the other same-roll bonus");
  const consumedBonuses = consumeTravelV2PendingStationActionBonusesForStationRoll(bonusSession, "navigator", 0);
  assertSmoke(consumedBonuses.session !== bonusSession, "bonus consume helper should return cloned session");
  assertSmoke(bonusSession.travelV2PendingStationActionBonuses.records.every((record) => record.consumed !== true || record.id === "consumed"), "bonus consume helper should not mutate source session");
  assertSmoke(consumedBonuses.session.travelV2PendingStationActionBonuses.records.find((record) => record.id === "greater-1")?.consumed === true, "selected bonus should be marked consumed");
  assertSmoke(consumedBonuses.session.travelV2PendingStationActionBonuses.records.find((record) => record.id === "support-1")?.suppressed === true, "suppressed same-roll bonus should be marked suppressed");
  assertEqual(consumedBonuses.session.travelV2PendingStationActionBonuses.records.length, bonusSession.travelV2PendingStationActionBonuses.records.length, "consumed bonus records should remain auditable");

  const floorSession = {
    currentRoundIndex: 0,
    roundResults: [{ stationResults: { navigator: "failure" } }],
    travelV2PendingStationResultFloors: { records: [
      { id: "legendary-1", resultFloor: "success", sourceCardId: "card-legendary", sourceCardLabel: "Legendary Event", targetStationKey: "navigator", targetStationLabel: "Navigator", previewRoundIndex: 0, consumed: false, playerSafe: true, readOnly: true },
      { id: "wrong-floor", resultFloor: "success", targetStationKey: "engineer", previewRoundIndex: 0, consumed: false, playerSafe: true, readOnly: true }
    ] }
  };
  const floorState = prepareTravelV2StationResultFloorState(floorSession, "navigator", 0);
  assertEqual(floorState.predictedFloorEffect.effectiveOutcomeKey, "success", "result floor state should predict failure to success");
  for (const [before, after] of [["criticalFailure", "success"], ["failure", "success"], ["success", "success"], ["criticalSuccess", "criticalSuccess"]]) {
    const floorResult = applyTravelV2PendingStationResultFloorToOutcome(floorSession, "navigator", before, 0);
    assertEqual(floorResult.effectiveOutcomeKey, after, `Legendary floor should map ${before} to ${after}`);
    assertSmoke(floorResult.session !== floorSession, "result floor helper should return cloned session");
    assertSmoke(floorSession.travelV2PendingStationResultFloors.records[0].consumed === false, "result floor helper should not mutate source session");
    assertSmoke(floorResult.session.travelV2PendingStationResultFloors.records[0].consumed === true, "applied floor should be consumed");
  }
  const ignoredFloor = applyTravelV2PendingStationResultFloorToOutcome(applyTravelV2PendingStationResultFloorToOutcome(floorSession, "navigator", "failure", 0).session, "navigator", "failure", 0);
  assertSmoke(ignoredFloor.resultFloorChange === null, "consumed floor should be ignored on later calls");
  assertEqual(applyTravelV2PendingStationResultFloorToOutcome(floorSession, "engineer", "failure", 1).effectiveOutcomeKey, "failure", "wrong-round result floor should be ignored");

  const stationRollSource = {
    currentRoundIndex: 0,
    roundResults: [{ ...lockedRoundResult(), stationResults: { navigator: "failure" } }],
    travelV2PendingStationActionBonuses: { records: [
      { id: "support-roll", bonusKey: "support", bonusType: "circumstance", bonusValue: 1, sourceStationLabel: "Engineer", targetStationKey: "navigator", nextRoundIndex: 0, consumed: false, playerSafe: true, readOnly: true },
      { id: "greater-roll", bonusKey: "greaterOpeningBonus", bonusType: "circumstance", bonusValue: 3, sourceCardId: "card-greater", sourceCardLabel: "Greater Opening", targetStationKey: "navigator", previewRoundIndex: 0, consumed: false, playerSafe: true, readOnly: true }
    ] },
    travelV2PendingStationResultFloors: { records: [
      { id: "legendary-roll", resultFloor: "success", sourceCardId: "card-legendary", sourceCardLabel: "Legendary Event", targetStationKey: "navigator", targetStationLabel: "Navigator", previewRoundIndex: 0, consumed: false, playerSafe: true, readOnly: true }
    ] }
  };
  const stationRollSnapshot = snapshot(stationRollSource);
  const stationRollResolution = resolveTravelV2StationRollWithPendingEffects(stationRollSource, "navigator", { rawRollTotal: 14, dc: 20 }, { roundIndex: 0 });
  assertSmoke(stationRollResolution.ok, "station roll resolver should succeed");
  assertEqual(stationRollResolution.rawRollTotal, 14, "station roll resolver should preserve raw roll total");
  assertEqual(stationRollResolution.appliedBonusTotal, 3, "station roll resolver should apply only highest circumstance bonus");
  assertEqual(stationRollResolution.effectiveRollTotal, 17, "station roll resolver should add selected bonus to effective total");
  assertEqual(stationRollResolution.rawOutcomeKey, "failure", "station roll resolver should calculate raw outcome from effective total before floors");
  assertEqual(stationRollResolution.effectiveOutcomeKey, "success", "station roll resolver should apply Legendary floor to effective outcome");
  assertEqual(stationRollResolution.session.roundResults[0].stationResults.navigator, "success", "station results should store effective outcome for downstream logic");
  assertEqual(stationRollResolution.session.roundResults[0].stationSummary.navigator.rawOutcomeKey, "failure", "station summary should preserve raw outcome");
  assertEqual(stationRollResolution.session.roundResults[0].stationSummary.navigator.effectiveOutcomeKey, "success", "station summary should preserve effective outcome");
  assertSmoke(stationRollResolution.session.roundResults[0].stationSummary.navigator.selectedStationRollBonuses.some((record) => record.recordId === "greater-roll"), "round result should store selected bonus audit data");
  assertSmoke(stationRollResolution.session.roundResults[0].stationSummary.navigator.suppressedStationRollBonuses.some((record) => record.recordId === "support-roll"), "round result should store suppressed bonus audit data");
  assertSmoke(stationRollResolution.session.travelV2PendingStationActionBonuses.records.find((record) => record.id === "greater-roll")?.consumed === true, "selected bonus records should be consumed after station roll resolution");
  assertSmoke(stationRollResolution.session.travelV2PendingStationActionBonuses.records.find((record) => record.id === "support-roll")?.suppressed === true, "suppressed bonus records should be consumed and marked suppressed after station roll resolution");
  assertSmoke(stationRollResolution.session.travelV2PendingStationResultFloors.records.find((record) => record.id === "legendary-roll")?.consumed === true, "floor record should be consumed after station roll resolution");
  assertEqual(snapshot(stationRollSource), stationRollSnapshot, "station roll resolver should not mutate source session");

  const eventApproachFloorSession = createRunnerSessionFixture({ roundResults: [{ ...lockedRoundResult(), stationResults: { navigator: "failure", captain: "success", engineer: "failure", veilwarden: "success", watchmaster: "failure" } }] });
  const eventApproachFloorResolved = resolveTravelV2StationRollWithPendingEffects({ ...eventApproachFloorSession, travelV2PendingStationResultFloors: { records: [{ id: "legendary-event-approach", resultFloor: "success", targetStationKey: "navigator", previewRoundIndex: 0, consumed: false, playerSafe: true, readOnly: true }] } }, "navigator", { rawOutcomeKey: "failure" }, { roundIndex: 0 });
  const eventApproachEffective = prepareTravelV2StationActionEventApproachContributions(prepareTravelV2StationActionEventApproachEffects(prepareTravelV2StationActionResolutionSummary(eventApproachFloorResolved.session, { roundIndex: 0 })));
  assertEqual(eventApproachEffective.records.find((record) => record.sourceStationKey === "navigator")?.stationOutcome, "success", "Event Approach tally should see effective outcome when floor applies");
  const eventApproachNoFloor = prepareTravelV2StationActionEventApproachContributions(prepareTravelV2StationActionEventApproachEffects(prepareTravelV2StationActionResolutionSummary(eventApproachFloorSession, { roundIndex: 0 })));
  assertEqual(eventApproachNoFloor.records.find((record) => record.sourceStationKey === "navigator")?.stationOutcome, "failure", "Event Approach behavior should remain unchanged without a floor");
  assertEqual(eventApproachNoFloor.records.find((record) => record.sourceStationKey === "navigator")?.contributionValue, 0, "Event Approach failure contribution should remain unchanged without a floor");


  const explicitRoundSource = {
    currentRoundIndex: 1,
    roundResults: [{ roundIndex: 1, stationResults: { navigator: "failure" }, stationSummary: { navigator: { outcomeKey: "failure" } } }],
    travelV2PendingStationResultFloors: { records: [{ id: "explicit-floor", resultFloor: "success", targetStationKey: "navigator", previewRoundIndex: 1, consumed: false, playerSafe: true, readOnly: true }] }
  };
  const explicitRoundSnapshot = snapshot(explicitRoundSource);
  const explicitRoundResolution = resolveTravelV2StationRollWithPendingEffects(explicitRoundSource, "navigator", { rawOutcomeKey: "failure" }, { roundIndex: 1 });
  assertEqual(explicitRoundResolution.session.roundResults.length, 1, "explicit roundIndex station roll resolution should not create a duplicate array-position round result");
  assertEqual(explicitRoundResolution.session.roundResults[0].roundIndex, 1, "explicit roundIndex station roll resolution should update the matching record in place");
  assertEqual(getTravelV2StationResultForRound(explicitRoundResolution.session, "navigator", 1), "success", "station result lookup should read the updated explicit roundIndex effective result");
  assertEqual(snapshot(explicitRoundSource), explicitRoundSnapshot, "explicit roundIndex station roll resolution should not mutate source session");

  const fallbackRoundSource = { currentRoundIndex: 1, roundResults: [{}, { stationResults: { navigator: "failure" } }] };
  const fallbackRoundResolution = resolveTravelV2StationRollWithPendingEffects(fallbackRoundSource, "navigator", { rawOutcomeKey: "success" }, { roundIndex: 1 });
  assertEqual(fallbackRoundResolution.session.roundResults.length, 2, "array-position fallback station roll resolution should preserve round result length");
  assertEqual(fallbackRoundResolution.session.roundResults[1].stationResults.navigator, "success", "array-position fallback station roll resolution should update requested array position when no explicit roundIndex record exists");

  const eventApproachApplyPreviewSource = {
    currentRoundIndex: 1,
    travelV2RoundResolutions: { records: [
      { roundIndex: 0, roundNumber: 1, lifecycleState: "finalized", eventApproachContributionTally: { totalContributionValue: -1, contributionCount: 1, hasContributions: true, roundIndex: 0, roundNumber: 1, gmText: "old secret" } },
      { roundIndex: 1, roundNumber: 2, lifecycleState: "finalized", eventApproachContributionTally: { totalContributionValue: 3, contributionCount: 2, positiveContributionCount: 2, hasContributions: true, contributingStationLabels: ["Navigator", "Engineer"], roundIndex: 1, roundNumber: 2, gmText: "hidden", applyPayload: { secret: true } } }
    ] }
  };
  const eventApproachApplyPreviewSnapshot = snapshot(eventApproachApplyPreviewSource);
  const eventApproachApplyPreview = prepareTravelV2EventApproachTallyApplicationPreview(eventApproachApplyPreviewSource, { roundIndex: 1 });
  assertEqual(eventApproachApplyPreview.playerState.status, "readyForFutureGmApply", "finalized Event Approach tally should produce future GM apply readiness");
  assertEqual(eventApproachApplyPreview.playerState.sourceTally.totalContributionValue, 3, "preview should preserve readable source tally total");
  assertEqual(eventApproachApplyPreview.playerState.records[0].effectPreview.delta, 3, "preview record should show inert progress delta");
  assertSmoke(!eventApproachApplyPreview.playerState.canApply, "Event Approach tally preview should not expose apply behavior");
  assertSmoke(!eventApproachApplyPreview.playerState.applied, "Event Approach tally preview should not mark effects applied");
  assertSmoke(eventApproachApplyPreview.gmState.gmReview.resolutionRecordFound, "GM state should include review context");
  assertSmoke(!JSON.stringify(eventApproachApplyPreview.playerState).includes("gmText"), "player Event Approach preview should redact gmText");
  assertSmoke(!JSON.stringify(eventApproachApplyPreview.playerState).includes("applyPayload"), "player Event Approach preview should redact apply payloads");
  eventApproachApplyPreview.playerState.sourceTally.totalContributionValue = 99;
  const eventApproachApplyPreviewCloneCheck = prepareTravelV2EventApproachTallyApplicationPreview(eventApproachApplyPreviewSource, { roundIndex: 1 });
  assertEqual(eventApproachApplyPreviewCloneCheck.playerState.sourceTally.totalContributionValue, 3, "Event Approach preview output should be clone-safe");
  assertEqual(snapshot(eventApproachApplyPreviewSource), eventApproachApplyPreviewSnapshot, "Event Approach preview should not mutate source session");

  const eventApproachBlockedPreview = prepareTravelV2EventApproachTallyApplicationPreview({ currentRoundIndex: 0, travelV2RoundResolutions: { records: [{ roundIndex: 0, roundNumber: 1, lifecycleState: "pending", eventApproachContributionTally: { totalContributionValue: 1, contributionCount: 1, hasContributions: true, roundIndex: 0, roundNumber: 1 } }] } }, { roundIndex: 0 });
  assertEqual(eventApproachBlockedPreview.playerState.status, "blocked", "unfinalized Event Approach tally should be blocked");
  assertSmoke(eventApproachBlockedPreview.playerState.blockedReason.includes("not finalized"), "blocked preview should explain unfinalized tally");
  const eventApproachEmptyPreview = prepareTravelV2EventApproachTallyApplicationPreview({}, {});
  assertEqual(eventApproachEmptyPreview.playerState.status, "blocked", "empty Event Approach preview should be blocked safely");
  const eventApproachPartialPreview = prepareTravelV2EventApproachTallyApplicationPreview({ currentRoundIndex: 5, eventApproachContributionTally: { totalContributionValue: "bad", gmOnly: true } }, {});
  assertEqual(eventApproachPartialPreview.playerState.sourceTally.totalContributionValue, 0, "partial old Event Approach preview should normalize malformed tally values");
  assertSmoke(!JSON.stringify(eventApproachPartialPreview.playerState).includes("gmOnly"), "partial old Event Approach player preview should redact unsafe fields");


  return {
    ok: true,
    checked: [
      "session-round-finalization-version",
      "difficulty-bid-normalization",
      "difficulty-bid-reward-ladder",
      "difficulty-bid-active-card-records",
      "difficulty-bid-preview-player-safe-read-only",
      "active-card-normalization",
      "active-card-merged-finalization-result",
      "active-card-gm-confirmed-apply-flow",
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
      "no-side-effects-called",
      "station-roll-bonus-resolution-and-consumption",
      "station-result-floor-application-and-consumption",
      "event-approach-tally-application-preview"
    ]
  };
}

export default runTravelV2SessionRoundFinalizationSmokeChecks;
