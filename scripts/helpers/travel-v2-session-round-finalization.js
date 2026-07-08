import { prepareTravelV2RoundFinalizationState } from "./travel-v2-round-finalization-state.js";
import { TRAVEL_V2_ALPHA_CORE_STATION_KEYS, checkTravelV2StationActionLockInReady } from "./travel-v2-station-action-lock-in.js";

export const TRAVEL_V2_SESSION_ROUND_FINALIZATION_VERSION = 1;
export const TRAVEL_V2_STATION_ACTION_RESOLUTION_SUMMARY_VERSION = 1;
export const TRAVEL_V2_STATION_ACTION_EFFECTS_VERSION = 1;
export const TRAVEL_V2_PENDING_STATION_ACTION_BONUSES_VERSION = 1;
export const TRAVEL_V2_EVENT_APPROACH_CONTRIBUTIONS_VERSION = 1;
export const TRAVEL_V2_EVENT_APPROACH_CONTRIBUTION_TALLY_VERSION = 1;
export const TRAVEL_V2_EVENT_APPROACH_TALLY_STATUS_VERSION = 1;
export const TRAVEL_V2_DIFFICULTY_BID_VERSION = 1;
export const TRAVEL_V2_ACTIVE_CARD_RECORDS_VERSION = 1;
export const TRAVEL_V2_ACTIVE_CARD_PREVIEW_VERSION = 1;
export const TRAVEL_V2_ACTIVE_CARD_APPLICATION_PREVIEW_VERSION = 1;
export const TRAVEL_V2_EVENT_APPROACH_TALLY_APPLICATION_PREVIEW_VERSION = 1;
export const TRAVEL_V2_EVENT_APPROACH_TALLY_APPLICATION_RECORDS_VERSION = 1;
export const TRAVEL_V2_DIFFICULTY_BID_KEYS = Object.freeze(["none", "minor", "greater", "extreme"]);
export const TRAVEL_V2_DIFFICULTY_BID_REWARD_KEYS = Object.freeze(["minorOpening", "greaterOpening", "heroicEvent", "legendaryEvent"]);
export const TRAVEL_V2_ACTIVE_CARD_STATUSES = Object.freeze(["pending", "consumed", "applied"]);
export const TRAVEL_V2_APPLIED_ACTIVE_CARDS_VERSION = 1;
export const TRAVEL_V2_PENDING_STATION_RESULT_FLOORS_VERSION = 1;
export const TRAVEL_V2_ACTIVE_CARD_TIMING_TYPES = Object.freeze(["beforeRoll", "afterFailure"]);
export const TRAVEL_V2_ACTIVE_CARD_PREVIEW_STATUSES = Object.freeze(["needsTarget", "waitingForLock", "playable", "missedWindow", "waitingForTrigger", "triggerReady", "noTrigger", "consumed"]);
export const TRAVEL_V2_ACTIVE_CARD_APPLICATION_TYPES = Object.freeze({
  circumstanceBonusPreview: "circumstanceBonusPreview",
  degreeUpgradePreview: "degreeUpgradePreview",
  resultFloorPreview: "resultFloorPreview"
});
export const TRAVEL_V2_ACTIVE_CARD_APPLICATION_EFFECTS = Object.freeze({
  minorOpeningBonus: "minorOpeningBonus",
  greaterOpeningBonus: "greaterOpeningBonus",
  heroicDegreeUpgrade: "heroicDegreeUpgrade",
  legendarySuccessFloor: "legendarySuccessFloor"
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneData(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function timestampFromOptions(options = {}) {
  for (const key of ["finalizedAt", "createdAt", "now"]) {
    const value = options[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value instanceof Date) return value.toISOString();
  }
  if (typeof options.now === "function") {
    const value = options.now();
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value instanceof Date) return value.toISOString();
  }
  return new Date().toISOString();
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function humanizeIdentifier(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeKey(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return /^[a-zA-Z0-9_-]+$/.test(trimmed) ? trimmed : "";
}

function stationLabel(round = {}, stationKey = "") {
  const prompt = isPlainObject(round?.stationPrompts?.[stationKey]) ? round.stationPrompts[stationKey] : {};
  return optionalString(prompt.stationName)
    ?? optionalString(prompt.stationLabel)
    ?? optionalString(prompt.label)
    ?? humanizeIdentifier(stationKey);
}

function actionLabel(action = {}, actionKey = "") {
  return optionalString(action.label)
    ?? optionalString(action.actionLabel)
    ?? optionalString(action.name)
    ?? humanizeIdentifier(actionKey || "station-action");
}


const TRAVEL_V2_DIFFICULTY_BID_CONFIG = Object.freeze({
  none: Object.freeze({ label: "No Bid", dcModifier: 0 }),
  minor: Object.freeze({ label: "Minor Bid", dcModifier: 2 }),
  greater: Object.freeze({ label: "Greater Bid", dcModifier: 5 }),
  extreme: Object.freeze({ label: "Extreme Bid", dcModifier: 8 })
});

const TRAVEL_V2_DIFFICULTY_BID_REWARD_LADDER = Object.freeze({
  minor: Object.freeze({ success: "minorOpening", criticalSuccess: "greaterOpening" }),
  greater: Object.freeze({ success: "greaterOpening", criticalSuccess: "heroicEvent" }),
  extreme: Object.freeze({ success: "heroicEvent", criticalSuccess: "legendaryEvent" })
});

const TRAVEL_V2_ACTIVE_CARD_CONFIG = Object.freeze({
  minorOpening: Object.freeze({
    cardLabel: "Minor Opening",
    timingHint: "Play after station actions are locked and before the target station rolls.",
    effectPreviewText: "Creates a +1 circumstance bonus for one target station roll after GM confirmation.",
    timingType: "beforeRoll",
    playWindowKey: "afterLockBeforeRoll",
    playWindowLabel: "After lock, before target roll"
  }),
  greaterOpening: Object.freeze({
    cardLabel: "Greater Opening",
    timingHint: "Play after station actions are locked and before the target station rolls.",
    effectPreviewText: "Creates a +3 circumstance bonus for one target station roll after GM confirmation.",
    timingType: "beforeRoll",
    playWindowKey: "afterLockBeforeRoll",
    playWindowLabel: "After lock, before target roll"
  }),
  heroicEvent: Object.freeze({
    cardLabel: "Heroic Event",
    timingHint: "Triggers when the target station rolls failure or critical failure.",
    effectPreviewText: "Improves one target station failure or critical failure by one degree after GM confirmation.",
    timingType: "afterFailure",
    playWindowKey: "afterTargetFailure",
    playWindowLabel: "After target failure"
  }),
  legendaryEvent: Object.freeze({
    cardLabel: "Legendary Event",
    timingHint: "Play after station actions are locked but before the target station rolls.",
    effectPreviewText: "Sets a success result floor for one target station roll after GM confirmation.",
    timingType: "beforeRoll",
    playWindowKey: "afterLockBeforeRoll",
    playWindowLabel: "After lock, before target roll"
  })
});

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function normalizeTravelV2DifficultyBid(value = "none") {
  const key = safeKey(isPlainObject(value) ? (value.difficultyBidKey ?? value.bidKey ?? value.key) : value);
  const difficultyBidKey = TRAVEL_V2_DIFFICULTY_BID_KEYS.includes(key) ? key : "none";
  const config = TRAVEL_V2_DIFFICULTY_BID_CONFIG[difficultyBidKey];
  return {
    version: TRAVEL_V2_DIFFICULTY_BID_VERSION,
    difficultyBidKey,
    difficultyBidLabel: config.label,
    difficultyBidDcModifier: config.dcModifier,
    playerSafe: true,
    readOnly: true
  };
}

export function getTravelV2DifficultyBidDcModifier(value = "none") {
  return normalizeTravelV2DifficultyBid(value).difficultyBidDcModifier;
}

export function prepareTravelV2DifficultyBidRewardPreview(bid = "none", outcomeKey = "") {
  const normalizedBid = normalizeTravelV2DifficultyBid(bid);
  const stationOutcome = normalizeStationOutcomeKey(outcomeKey);
  const rewardKey = TRAVEL_V2_DIFFICULTY_BID_REWARD_LADDER[normalizedBid.difficultyBidKey]?.[stationOutcome] ?? "";
  const hasReward = Boolean(rewardKey);
  const hasBacklashPreview = normalizedBid.difficultyBidKey !== "none" && stationOutcome === "criticalFailure";
  return {
    version: TRAVEL_V2_DIFFICULTY_BID_VERSION,
    difficultyBidKey: normalizedBid.difficultyBidKey,
    difficultyBidLabel: normalizedBid.difficultyBidLabel,
    stationOutcome: stationOutcome || "unknown",
    rewardKey,
    rewardLabel: rewardKey ? humanizeIdentifier(rewardKey) : "No Bid Reward",
    hasReward,
    backlashPreview: hasBacklashPreview ? {
      placeholder: true,
      label: "Optional GM-facing backlash preview placeholder",
      summary: "Critical failure creates no bid reward. Any backlash remains an optional GM-facing preview for a later pass.",
      playerSafe: true,
      readOnly: true
    } : null,
    hasBacklashPreview,
    summary: hasReward
      ? `${normalizedBid.difficultyBidLabel} ${humanizeIdentifier(stationOutcome)} preview: ${humanizeIdentifier(rewardKey)}.`
      : (hasBacklashPreview ? `${normalizedBid.difficultyBidLabel} Critical Failure preview: no reward; optional backlash placeholder only.` : `${normalizedBid.difficultyBidLabel} preview: no reward.`),
    playerSafe: true,
    readOnly: true
  };
}

export function prepareTravelV2DifficultyBidPreview({ bid = "none", baseDC = 0, stationDcModifier = 0, outcomeKey = "" } = {}) {
  const normalizedBid = normalizeTravelV2DifficultyBid(bid);
  const baseDcValue = numberOrZero(baseDC);
  const stationModifierValue = numberOrZero(stationDcModifier);
  const bidModifierValue = normalizedBid.difficultyBidDcModifier;
  const effectiveDc = baseDcValue + stationModifierValue + bidModifierValue;
  const rewardPreview = prepareTravelV2DifficultyBidRewardPreview(normalizedBid, outcomeKey);
  return {
    ...normalizedBid,
    difficultyBidRewardPreview: rewardPreview,
    effectiveDcPreview: {
      baseDC: baseDcValue,
      stationDcModifier: stationModifierValue,
      bidDcModifier: bidModifierValue,
      effectiveDC: effectiveDc,
      parts: [
        { key: "baseDC", label: "Base DC", value: baseDcValue },
        { key: "stationDcModifier", label: "Station Modifier", value: stationModifierValue },
        { key: "bidDcModifier", label: "Bid Modifier", value: bidModifierValue }
      ],
      summary: `Effective DC preview: ${baseDcValue} base ${stationModifierValue >= 0 ? "+" : ""}${stationModifierValue} station ${bidModifierValue >= 0 ? "+" : ""}${bidModifierValue} bid = ${effectiveDc}.`,
      playerSafe: true,
      readOnly: true
    },
    playerSafe: true,
    readOnly: true
  };
}

function activeCardId({ roundIndex = null, sourceStationKey = "", sourceBidKey = "", sourceResult = "", rewardKey = "" } = {}) {
  return ["travel-v2-card", roundIndex ?? "unknown-round", sourceStationKey || "unknown-station", sourceBidKey || "no-bid", sourceResult || "unknown-result", rewardKey || "no-reward"].join(":");
}

export function normalizeTravelV2ActiveCardRecords(container = {}) {
  const records = recordsFromContainer(container)
    .filter((record) => isPlainObject(record))
    .map((record) => {
      const rewardKey = TRAVEL_V2_DIFFICULTY_BID_REWARD_KEYS.includes(safeKey(record.rewardKey ?? record.cardKey)) ? safeKey(record.rewardKey ?? record.cardKey) : "";
      const config = TRAVEL_V2_ACTIVE_CARD_CONFIG[rewardKey] ?? {};
      const roundIndex = Number.isInteger(Number(record.roundIndex)) ? Number(record.roundIndex) : null;
      const sourceStationKey = safeKey(record.sourceStationKey);
      const sourceBidKey = TRAVEL_V2_DIFFICULTY_BID_KEYS.includes(safeKey(record.sourceBidKey ?? record.difficultyBidKey)) ? safeKey(record.sourceBidKey ?? record.difficultyBidKey) : "none";
      const sourceResult = normalizeStationOutcomeKey(record.sourceResult ?? record.stationOutcome);
      const cardId = optionalString(record.cardId ?? record.id) ?? activeCardId({ roundIndex, sourceStationKey, sourceBidKey, sourceResult, rewardKey });
      return {
        cardId,
        id: cardId,
        cardKey: rewardKey,
        rewardKey,
        cardLabel: optionalString(record.cardLabel ?? record.rewardLabel) ?? config.cardLabel ?? humanizeIdentifier(rewardKey || "travel card"),
        sourceStationKey,
        sourceStationLabel: optionalString(record.sourceStationLabel) ?? humanizeIdentifier(sourceStationKey || "station"),
        sourceBidKey,
        sourceBidLabel: optionalString(record.sourceBidLabel ?? record.difficultyBidLabel) ?? normalizeTravelV2DifficultyBid(sourceBidKey).difficultyBidLabel,
        sourceResult: sourceResult || "unknown",
        roundIndex,
        roundNumber: record.roundNumber ?? null,
        status: TRAVEL_V2_ACTIVE_CARD_STATUSES.includes(safeKey(record.status)) ? safeKey(record.status) : "pending",
        timingHint: optionalString(record.timingHint) ?? config.timingHint ?? "",
        effectPreviewText: optionalString(record.effectPreviewText) ?? config.effectPreviewText ?? "",
        targetStationKey: safeKey(record.targetStationKey),
        targetStationLabel: optionalString(record.targetStationLabel) ?? "",
        hasTargetStation: Boolean(safeKey(record.targetStationKey)),
        targetStatus: safeKey(record.targetStationKey) ? "targeted" : "needsTarget",
        timingType: activeCardTimingType(rewardKey),
        playWindowKey: config.playWindowKey ?? "",
        playWindowLabel: config.playWindowLabel ?? "",
        playablePreview: false,
        triggerReadyPreview: false,
        waitingForTrigger: false,
        previewStatus: safeKey(record.targetStationKey) ? "waitingForLock" : "needsTarget",
        previewStatusLabel: activeCardPreviewStatusLabel(safeKey(record.targetStationKey) ? "waitingForLock" : "needsTarget"),
        playerSafe: true,
        readOnly: true
      };
    })
    .filter((record) => record.rewardKey);
  const deduped = [];
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.cardId)) continue;
    seen.add(record.cardId);
    deduped.push(record);
  }
  return {
    version: TRAVEL_V2_ACTIVE_CARD_RECORDS_VERSION,
    records: deduped,
    hasRecords: deduped.length > 0,
    playerSafe: true,
    readOnly: true
  };
}


function activeCardTimingType(cardKey = "") {
  const timingType = TRAVEL_V2_ACTIVE_CARD_CONFIG[cardKey]?.timingType;
  return TRAVEL_V2_ACTIVE_CARD_TIMING_TYPES.includes(timingType) ? timingType : "beforeRoll";
}

function activeCardPreviewStatusLabel(status = "") {
  return {
    needsTarget: "Needs target",
    waitingForLock: "Waiting for station action lock",
    playable: "Playable preview",
    missedWindow: "Missed play window",
    waitingForTrigger: "Waiting for trigger",
    triggerReady: "Trigger-ready preview",
    noTrigger: "No trigger"
  }[status] ?? humanizeIdentifier(status || "unknown");
}

function availableTravelV2TargetStations(round = {}, session = {}) {
  const keys = Array.isArray(round?.stationOrder) ? round.stationOrder : (Array.isArray(session?.activeStations) ? session.activeStations : TRAVEL_V2_ALPHA_CORE_STATION_KEYS);
  return Array.from(new Set([...keys, ...TRAVEL_V2_ALPHA_CORE_STATION_KEYS].map(safeKey).filter(Boolean)))
    .filter((stationKey) => TRAVEL_V2_ALPHA_CORE_STATION_KEYS.includes(stationKey))
    .map((stationKey) => ({ stationKey, stationLabel: stationLabel(round, stationKey), playerSafe: true, readOnly: true }));
}

function currentRoundContext(session = {}) {
  const rounds = Array.isArray(session?.event?.rounds) ? session.event.rounds : [];
  const roundIndex = Number.isInteger(Number(session?.currentRoundIndex)) ? Number(session.currentRoundIndex) : 0;
  const round = isPlainObject(rounds[roundIndex]) ? rounds[roundIndex] : {};
  const roundNumber = round?.roundNumber ?? round?.number ?? roundIndex + 1;
  return { roundIndex, roundNumber, round };
}

function roundResultEntryForIndex(session = {}, roundIndex = 0) {
  const records = Array.isArray(session?.roundResults) ? session.roundResults : recordsFromContainer(session?.roundResults);
  const index = Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : 0;
  const explicitIndex = records.findIndex((record) => Number.isInteger(Number(record?.roundIndex)) && Number(record.roundIndex) === index);
  if (explicitIndex >= 0) return { record: records[explicitIndex], arrayIndex: explicitIndex, roundIndex: index };
  if (records[index]) return { record: records[index], arrayIndex: index, roundIndex: index };
  return { record: {}, arrayIndex: index, roundIndex: index };
}

function roundResultForIndex(session = {}, roundIndex = 0) {
  return roundResultEntryForIndex(session, roundIndex).record ?? {};
}

export function resolveTravelV2ActiveCardPreviewRound(session = {}, card = {}) {
  const context = currentRoundContext(session);
  return {
    previewRoundIndex: context.roundIndex,
    previewRoundNumber: context.roundNumber,
    round: context.round,
    createdRoundIndex: Number.isInteger(Number(card?.roundIndex)) ? Number(card.roundIndex) : null,
    createdRoundNumber: card?.roundNumber ?? null
  };
}

export function isTravelV2RoundActionsLocked(session = {}, roundIndex = null) {
  const { roundIndex: currentIndex } = currentRoundContext(session);
  const index = Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : currentIndex;
  const result = roundResultForIndex(session, index);
  if (isPlainObject(result?.stationOrderCommitments)) {
    return TRAVEL_V2_ALPHA_CORE_STATION_KEYS.every((stationKey) => result.stationOrderCommitments[stationKey]?.committed === true || result.stationOrderCommitments[stationKey]?.locked === true);
  }
  const lockState = session?.travelV2StationActionLockIn ?? session?.stationActionLockIn ?? result?.travelV2StationActionLockIn;
  if (isPlainObject(lockState)) return checkTravelV2StationActionLockInReady(lockState).allRequiredLocked === true;
  return false;
}

export function getTravelV2StationResultForRound(session = {}, stationKey = "", roundIndex = null) {
  const key = safeKey(stationKey);
  if (!key) return "";
  const { roundIndex: currentIndex, round } = currentRoundContext(session);
  const index = Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : currentIndex;
  const candidates = [roundResultForIndex(session, index), round].filter(Boolean);
  for (const candidate of candidates) {
    const value = candidate?.stationResults?.[key] ?? candidate?.stationSummary?.[key]?.degree ?? candidate?.stationSummary?.[key]?.outcomeKey ?? candidate?.stations?.[key]?.result;
    const normalized = normalizeStationOutcomeKey(value);
    if (normalized) return normalized;
  }
  return "";
}

export function hasTravelV2StationRolledForRound(session = {}, stationKey = "", roundIndex = null) {
  return Boolean(getTravelV2StationResultForRound(session, stationKey, roundIndex));
}

export function prepareTravelV2ActiveCardTargetPreview(card = {}, session = {}) {
  const { round } = currentRoundContext(session);
  const availableTargetStations = availableTravelV2TargetStations(round, session);
  const targetStationKey = safeKey(card.targetStationKey ?? card.target?.stationKey ?? card.stationTargetKey);
  const targetOption = availableTargetStations.find((option) => option.stationKey === targetStationKey);
  const targetStationLabel = targetOption?.stationLabel ?? optionalString(card.targetStationLabel ?? card.target?.stationLabel) ?? "";
  const hasTargetStation = Boolean(targetOption);
  return { targetStationKey: hasTargetStation ? targetStationKey : "", targetStationLabel: hasTargetStation ? targetStationLabel : "", hasTargetStation, targetStatus: hasTargetStation ? "targeted" : (targetStationKey ? "invalidTarget" : "needsTarget"), availableTargetStations, playerSafe: true, readOnly: true };
}

export function prepareTravelV2ActiveCardPlayPreview(card = {}, session = {}) {
  const target = prepareTravelV2ActiveCardTargetPreview(card, session);
  const timingType = activeCardTimingType(card.rewardKey ?? card.cardKey);
  let previewStatus = "needsTarget";
  let playablePreview = false;
  let triggerReadyPreview = false;
  let waitingForTrigger = false;
  const { previewRoundIndex, previewRoundNumber } = resolveTravelV2ActiveCardPreviewRound(session, card);
  const stationResult = target.hasTargetStation ? getTravelV2StationResultForRound(session, target.targetStationKey, previewRoundIndex) : "";
  const stationRolled = Boolean(stationResult);
  if (target.hasTargetStation && timingType === "afterFailure") {
    if (!stationRolled) { previewStatus = "waitingForTrigger"; waitingForTrigger = true; }
    else if (stationResult === "failure" || stationResult === "criticalFailure") { previewStatus = "triggerReady"; triggerReadyPreview = true; }
    else previewStatus = "noTrigger";
  } else if (target.hasTargetStation) {
    if (stationRolled) previewStatus = "missedWindow";
    else if (isTravelV2RoundActionsLocked(session, previewRoundIndex)) { previewStatus = "playable"; playablePreview = true; }
    else previewStatus = "waitingForLock";
  }
  const config = TRAVEL_V2_ACTIVE_CARD_CONFIG[card.rewardKey ?? card.cardKey] ?? {};
  return { ...target, previewRoundIndex, previewRoundNumber, timingType, playWindowKey: config.playWindowKey ?? "", playWindowLabel: config.playWindowLabel ?? "", playablePreview, triggerReadyPreview, waitingForTrigger, previewStatus, previewStatusLabel: activeCardPreviewStatusLabel(previewStatus), stationResult: stationResult || "", playerSafe: true, readOnly: true };
}

export function prepareTravelV2ActiveCardsPreviewState(container = {}, session = {}) {
  const normalized = normalizeTravelV2ActiveCardRecords(container);
  const records = normalized.records.map((record) => {
    const { previewRoundIndex, previewRoundNumber, createdRoundIndex, createdRoundNumber } = resolveTravelV2ActiveCardPreviewRound(session, record);
    const playPreview = record.status === "pending"
      ? prepareTravelV2ActiveCardPlayPreview(record, session)
      : {
        ...prepareTravelV2ActiveCardTargetPreview(record, session),
        previewRoundIndex,
        previewRoundNumber,
        createdRoundIndex,
        createdRoundNumber,
        timingType: activeCardTimingType(record.rewardKey ?? record.cardKey),
        playablePreview: false,
        triggerReadyPreview: false,
        waitingForTrigger: false,
        previewStatus: "consumed",
        previewStatusLabel: "Consumed",
        stationResult: "",
        playerSafe: true,
        readOnly: true
      };
    return { ...record, ...playPreview, status: record.status, playerSafe: true, readOnly: true };
  });
  return { version: TRAVEL_V2_ACTIVE_CARD_PREVIEW_VERSION, records, hasRecords: records.length > 0, playerSafe: true, readOnly: true };
}

export function sanitizeTravelV2ActiveCardPreviewForPlayers(container = {}, session = {}) {
  return prepareTravelV2ActiveCardsPreviewState(container, session);
}


function activeCardApplicationPreviewSegment(value = "", fallback = "unknown") {
  const segment = String(value ?? "").trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return segment || fallback;
}

function activeCardApplicationPreviewId(card = {}, effectKey = "") {
  return ["travel-v2-card-application-preview", activeCardApplicationPreviewSegment(card.cardId ?? card.id, "unknown-card"), safeKey(effectKey) || "unknown-effect", Number.isInteger(Number(card.previewRoundIndex)) ? Number(card.previewRoundIndex) : "unknown-round", safeKey(card.targetStationKey) || "no-target"].join(":");
}

function activeCardApplicationTypeLabel(applicationType = "") {
  return {
    circumstanceBonusPreview: "Circumstance Bonus Preview",
    degreeUpgradePreview: "Degree Upgrade Preview",
    resultFloorPreview: "Result Floor Preview"
  }[applicationType] ?? humanizeIdentifier(applicationType || "application preview");
}

function activeCardApplicationEffectLabel(effectKey = "") {
  return {
    minorOpeningBonus: "Minor Opening Bonus",
    greaterOpeningBonus: "Greater Opening Bonus",
    heroicDegreeUpgrade: "Heroic Degree Upgrade",
    legendarySuccessFloor: "Legendary Success Floor"
  }[effectKey] ?? humanizeIdentifier(effectKey || "application effect");
}

function blockedActiveCardApplicationReason(card = {}, requiredStatus = "playable", extraReason = "") {
  if (!card.hasTargetStation) return card.targetStatus === "invalidTarget" ? "Target station is unavailable." : "Target station is required.";
  if (card.previewStatus !== requiredStatus) return `Card preview status is ${activeCardPreviewStatusLabel(card.previewStatus)}; expected ${activeCardPreviewStatusLabel(requiredStatus)}.`;
  return extraReason;
}

export function previewTravelV2DegreeUpgrade(result = "") {
  const before = normalizeStationOutcomeKey(result);
  const after = before === "criticalFailure" ? "failure" : (before === "failure" ? "success" : "");
  return { before, after, canApplyPreview: Boolean(after), playerSafe: true, readOnly: true };
}

export function previewTravelV2ResultFloor(result = "", floor = "success") {
  const before = normalizeStationOutcomeKey(result);
  const normalizedFloor = normalizeStationOutcomeKey(floor) || "success";
  const order = { criticalFailure: 0, failure: 1, success: 2, criticalSuccess: 3 };
  const after = before ? (order[before] < order[normalizedFloor] ? normalizedFloor : before) : "";
  return { before, after, resultFloor: normalizedFloor, preservesCriticalSuccess: true, canApplyPreview: true, playerSafe: true, readOnly: true };
}

export function previewTravelV2CircumstanceBonusCard(cardKey = "") {
  const key = safeKey(cardKey);
  const bonusValue = key === "greaterOpening" ? 3 : (key === "minorOpening" ? 1 : 0);
  return { bonusType: bonusValue ? "circumstance" : "", bonusValue, canApplyPreview: bonusValue > 0, playerSafe: true, readOnly: true };
}

export function prepareTravelV2ActiveCardApplicationPreviewRecord(card = {}) {
  const cardKey = safeKey(card.cardKey ?? card.rewardKey);
  let applicationType = "";
  let effectKey = "";
  let effectSummary = "";
  let bonusType = "";
  let bonusValue = null;
  let targetResultBefore = card.stationResult || "";
  let targetResultAfter = "";
  let resultFloor = "";
  let canApplyPreview = false;
  let blockedReason = "";

  if (cardKey === "minorOpening" || cardKey === "greaterOpening") {
    applicationType = TRAVEL_V2_ACTIVE_CARD_APPLICATION_TYPES.circumstanceBonusPreview;
    effectKey = cardKey === "minorOpening" ? TRAVEL_V2_ACTIVE_CARD_APPLICATION_EFFECTS.minorOpeningBonus : TRAVEL_V2_ACTIVE_CARD_APPLICATION_EFFECTS.greaterOpeningBonus;
    const bonus = previewTravelV2CircumstanceBonusCard(cardKey);
    bonusType = bonus.bonusType;
    bonusValue = bonus.bonusValue;
    blockedReason = blockedActiveCardApplicationReason(card, "playable");
    canApplyPreview = !blockedReason && bonus.canApplyPreview;
    effectSummary = `Would create a future +${bonusValue} ${bonusType} bonus for ${card.targetStationLabel || "the target station"} roll.`;
  } else if (cardKey === "heroicEvent") {
    applicationType = TRAVEL_V2_ACTIVE_CARD_APPLICATION_TYPES.degreeUpgradePreview;
    effectKey = TRAVEL_V2_ACTIVE_CARD_APPLICATION_EFFECTS.heroicDegreeUpgrade;
    const upgrade = previewTravelV2DegreeUpgrade(card.stationResult);
    targetResultBefore = upgrade.before;
    targetResultAfter = upgrade.after;
    blockedReason = blockedActiveCardApplicationReason(card, "triggerReady", upgrade.canApplyPreview ? "" : "Target station result is not failure or critical failure.");
    canApplyPreview = !blockedReason && upgrade.canApplyPreview;
    effectSummary = targetResultAfter ? `Would improve ${card.targetStationLabel || "the target station"} result from ${humanizeIdentifier(targetResultBefore)} to ${humanizeIdentifier(targetResultAfter)}.` : "Would improve a target station failure or critical failure by one degree when trigger-ready.";
  } else if (cardKey === "legendaryEvent") {
    applicationType = TRAVEL_V2_ACTIVE_CARD_APPLICATION_TYPES.resultFloorPreview;
    effectKey = TRAVEL_V2_ACTIVE_CARD_APPLICATION_EFFECTS.legendarySuccessFloor;
    const floor = previewTravelV2ResultFloor(card.stationResult, "success");
    targetResultBefore = floor.before;
    targetResultAfter = floor.after;
    resultFloor = floor.resultFloor;
    blockedReason = blockedActiveCardApplicationReason(card, "playable");
    canApplyPreview = !blockedReason;
    effectSummary = `Would set ${card.targetStationLabel || "the target station"} result floor to Success when that station rolls; Critical Success remains Critical Success.`;
  }
  if (!applicationType || !effectKey) return null;
  return {
    previewId: activeCardApplicationPreviewId(card, effectKey),
    id: activeCardApplicationPreviewId(card, effectKey),
    sourceCardId: card.cardId ?? card.id ?? "",
    cardKey,
    rewardKey: card.rewardKey ?? cardKey,
    cardLabel: card.cardLabel ?? humanizeIdentifier(cardKey),
    sourceStationKey: card.sourceStationKey ?? "",
    sourceStationLabel: card.sourceStationLabel ?? "",
    targetStationKey: card.targetStationKey ?? "",
    targetStationLabel: card.targetStationLabel ?? "",
    createdRoundIndex: Number.isInteger(Number(card.roundIndex)) ? Number(card.roundIndex) : null,
    createdRoundNumber: card.roundNumber ?? null,
    previewRoundIndex: Number.isInteger(Number(card.previewRoundIndex)) ? Number(card.previewRoundIndex) : null,
    previewRoundNumber: card.previewRoundNumber ?? null,
    previewStatus: card.previewStatus ?? "",
    previewStatusLabel: card.previewStatusLabel ?? activeCardPreviewStatusLabel(card.previewStatus),
    applicationType,
    applicationTypeLabel: activeCardApplicationTypeLabel(applicationType),
    effectKey,
    effectLabel: activeCardApplicationEffectLabel(effectKey),
    effectSummary,
    targetResultBefore,
    targetResultAfter,
    bonusType,
    bonusValue,
    resultFloor,
    preservesCriticalSuccess: cardKey === "legendaryEvent",
    requiresGMConfirmation: true,
    canApplyPreview,
    blockedReason: canApplyPreview ? "" : blockedReason,
    playerSafe: true,
    readOnly: true
  };
}

export function prepareTravelV2ActiveCardApplicationPreviewState(activeCardPreviewState = {}, session = {}) {
  const source = activeCardPreviewState?.version === TRAVEL_V2_ACTIVE_CARD_PREVIEW_VERSION
    ? activeCardPreviewState
    : prepareTravelV2ActiveCardsPreviewState(activeCardPreviewState, session);
  const records = [];
  const seen = new Set();
  for (const card of recordsFromContainer(source)) {
    const record = prepareTravelV2ActiveCardApplicationPreviewRecord(card);
    if (!record || seen.has(record.previewId)) continue;
    seen.add(record.previewId);
    records.push(record);
  }
  return { version: TRAVEL_V2_ACTIVE_CARD_APPLICATION_PREVIEW_VERSION, records, hasRecords: records.length > 0, playerSafe: true, readOnly: true };
}

export function sanitizeTravelV2ActiveCardApplicationPreviewsForPlayers(activeCardPreviewState = {}, session = {}) {
  return prepareTravelV2ActiveCardApplicationPreviewState(activeCardPreviewState, session);
}

function blockedTravelV2ActiveCardApplyResult(session, blockedReason = "Application blocked.") {
  return { ok: false, applied: false, blocked: true, blockedReason, session: cloneData(session), playerSafe: true, readOnly: true };
}

function findCurrentTravelV2ActiveCardApplicationPreview(session = {}, previewId = "") {
  const id = optionalString(previewId) ?? "";
  if (!id) return null;
  const previewState = prepareTravelV2ActiveCardApplicationPreviewState(prepareTravelV2ActiveCardsPreviewState(session?.travelV2ActiveCards, session), session);
  return previewState.records.find((record) => record.previewId === id || record.id === id) ?? null;
}

function appliedActiveCardId(preview = {}) {
  return ["travel-v2-applied-card", activeCardApplicationPreviewSegment(preview.sourceCardId, "unknown-card"), activeCardApplicationPreviewSegment(preview.effectKey, "unknown-effect"), Number.isInteger(Number(preview.previewRoundIndex)) ? Number(preview.previewRoundIndex) : "unknown-round", activeCardApplicationPreviewSegment(preview.targetStationKey, "no-target")].join(":");
}

function normalizeTravelV2AppliedActiveCards(container = {}) {
  const records = recordsFromContainer(container).filter(isPlainObject).map((record) => ({
    ...cloneData(record),
    playerSafe: true,
    readOnly: true
  }));
  return { version: TRAVEL_V2_APPLIED_ACTIVE_CARDS_VERSION, records, hasRecords: records.length > 0, playerSafe: true, readOnly: true };
}

function appendTravelV2AppliedActiveCardRecord(session = {}, record = {}) {
  const existing = normalizeTravelV2AppliedActiveCards(session.travelV2AppliedActiveCards);
  const records = [...existing.records, cloneData(record)];
  return {
    ...session,
    travelV2AppliedActiveCards: { version: TRAVEL_V2_APPLIED_ACTIVE_CARDS_VERSION, records, hasRecords: records.length > 0, playerSafe: true, readOnly: true }
  };
}

function buildPendingStationActionBonusFromCardPreview(preview = {}) {
  const value = Number(preview.bonusValue);
  if (preview.applicationType !== TRAVEL_V2_ACTIVE_CARD_APPLICATION_TYPES.circumstanceBonusPreview || !Number.isFinite(value) || value <= 0) return null;
  return {
    sourceCardId: preview.sourceCardId,
    sourceCardLabel: preview.cardLabel,
    targetStationKey: preview.targetStationKey,
    targetStationLabel: preview.targetStationLabel,
    bonusKey: preview.effectKey,
    bonusType: "circumstance",
    bonusValue: value,
    bonusLabel: `${preview.cardLabel}: +${value} circumstance bonus for ${preview.targetStationLabel || "target station"}.`,
    previewRoundIndex: preview.previewRoundIndex,
    previewRoundNumber: preview.previewRoundNumber,
    roundIndex: preview.previewRoundIndex,
    roundNumber: preview.previewRoundNumber,
    consumed: false,
    playerSafe: true,
    readOnly: true
  };
}

function buildPendingResultFloorFromCardPreview(preview = {}) {
  if (preview.applicationType !== TRAVEL_V2_ACTIVE_CARD_APPLICATION_TYPES.resultFloorPreview || preview.effectKey !== TRAVEL_V2_ACTIVE_CARD_APPLICATION_EFFECTS.legendarySuccessFloor) return null;
  return {
    sourceCardId: preview.sourceCardId,
    sourceCardLabel: preview.cardLabel,
    targetStationKey: preview.targetStationKey,
    targetStationLabel: preview.targetStationLabel,
    resultFloor: "success",
    timing: "beforeTargetRoll",
    previewRoundIndex: preview.previewRoundIndex,
    previewRoundNumber: preview.previewRoundNumber,
    playerSafe: true,
    readOnly: true
  };
}

function appendPendingStationResultFloor(session = {}, record = {}) {
  const existing = recordsFromContainer(session.travelV2PendingStationResultFloors);
  const records = [...cloneData(existing), cloneData(record)];
  return {
    ...session,
    travelV2PendingStationResultFloors: { version: TRAVEL_V2_PENDING_STATION_RESULT_FLOORS_VERSION, records, hasRecords: records.length > 0, playerSafe: true, readOnly: true }
  };
}

function pendingRecordAppliesToRound(record = {}, roundIndex = 0) {
  const expectedRound = Number(roundIndex);
  if (!Number.isInteger(expectedRound)) return false;
  for (const key of ["appliesToRoundIndex", "nextRoundIndex"]) {
    if (record?.[key] === null || record?.[key] === undefined || record?.[key] === "") continue;
    const value = Number(record[key]);
    return Number.isInteger(value) && value === expectedRound;
  }
  if (record?.roundIndex !== null && record?.roundIndex !== undefined && record?.roundIndex !== "") {
    const value = Number(record.roundIndex);
    return Number.isInteger(value) && value === expectedRound;
  }
  if (record?.previewRoundIndex !== null && record?.previewRoundIndex !== undefined && record?.previewRoundIndex !== "") {
    const value = Number(record.previewRoundIndex);
    return Number.isInteger(value) && value === expectedRound;
  }
  return false;
}

function pendingRecordAuditId(record = {}, index = 0) {
  return optionalString(record.id) ?? optionalString(record.recordId) ?? optionalString(record.bonusId) ?? optionalString(record.sourceCardId) ?? `${record.bonusKey || record.resultFloor || "pending"}-${index}`;
}

function stationLabelForSession(session = {}, stationKey = "") {
  const roundIndex = Number.isInteger(Number(session?.currentRoundIndex)) ? Number(session.currentRoundIndex) : 0;
  const round = Array.isArray(session?.event?.rounds) && isPlainObject(session.event.rounds[roundIndex]) ? session.event.rounds[roundIndex] : {};
  return stationLabel(round, stationKey);
}

function sanitizePendingStationActionBonusCandidate(record = {}, index = 0) {
  const bonusValue = Number(record?.bonusValue);
  const bonusType = safeKey(record?.bonusType) || "circumstance";
  const targetStationKey = safeKey(record?.targetStationKey);
  if (!targetStationKey || !Number.isFinite(bonusValue)) return null;
  return {
    recordId: pendingRecordAuditId(record, index),
    recordIndex: index,
    bonusKey: safeKey(record?.bonusKey) || "stationActionBonus",
    bonusType,
    bonusValue,
    sourceLabel: optionalString(record?.sourceCardLabel) ?? optionalString(record?.sourceStationLabel) ?? optionalString(record?.sourceLabel) ?? humanizeIdentifier(record?.bonusKey || "bonus"),
    sourceCardId: optionalString(record?.sourceCardId) ?? "",
    sourceCardLabel: optionalString(record?.sourceCardLabel) ?? "",
    sourceStationKey: safeKey(record?.sourceStationKey),
    sourceStationLabel: optionalString(record?.sourceStationLabel) ?? "",
    targetStationKey,
    targetStationLabel: optionalString(record?.targetStationLabel) ?? humanizeIdentifier(targetStationKey),
    roundIndex: Number.isInteger(Number(record?.roundIndex)) ? Number(record.roundIndex) : (Number.isInteger(Number(record?.previewRoundIndex)) ? Number(record.previewRoundIndex) : null),
    roundNumber: record?.roundNumber ?? record?.previewRoundNumber ?? null,
    appliesToRoundIndex: Number.isInteger(Number(record?.appliesToRoundIndex)) ? Number(record.appliesToRoundIndex) : null,
    nextRoundIndex: Number.isInteger(Number(record?.nextRoundIndex)) ? Number(record.nextRoundIndex) : null,
    playerSafe: true,
    readOnly: true
  };
}

export function prepareTravelV2StationRollBonusState(session = {}, stationKey = "", roundIndex = 0) {
  const targetStationKey = safeKey(stationKey);
  const targetRoundIndex = Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : 0;
  const roundNumber = targetRoundIndex + 1;
  const candidates = recordsFromContainer(session?.travelV2PendingStationActionBonuses)
    .map((record, index) => ({ record, index, candidate: sanitizePendingStationActionBonusCandidate(record, index) }))
    .filter(({ record, candidate }) => candidate && record?.consumed !== true && candidate.targetStationKey === targetStationKey && pendingRecordAppliesToRound(record, targetRoundIndex))
    .map(({ candidate }) => candidate);
  const selected = [];
  const suppressed = [];
  const byType = new Map();
  for (const candidate of candidates) {
    const group = byType.get(candidate.bonusType) ?? [];
    group.push(candidate);
    byType.set(candidate.bonusType, group);
  }
  for (const [bonusType, group] of byType.entries()) {
    const sorted = [...group].sort((a, b) => (Number(b.bonusValue) - Number(a.bonusValue)) || (a.recordIndex - b.recordIndex));
    const winner = bonusType === "circumstance" ? sorted[0] : null;
    if (winner) {
      selected.push({ ...winner, selected: true });
      suppressed.push(...sorted.slice(1).map((record) => ({ ...record, suppressed: true, suppressedReason: `${humanizeIdentifier(bonusType)} bonuses do not stack.`, suppressedBy: winner.recordId, suppressedByRecordId: winner.recordId })));
    } else {
      selected.push(...sorted.map((record) => ({ ...record, selected: true })));
    }
  }
  const totalAppliedBonus = selected.reduce((total, record) => total + Number(record.bonusValue || 0), 0);
  const primary = selected[0] ?? null;
  return {
    stationKey: targetStationKey,
    stationLabel: primary?.targetStationLabel || stationLabelForSession(session, targetStationKey),
    roundIndex: targetRoundIndex,
    roundNumber,
    bonusType: primary?.bonusType ?? "",
    selectedBonusValue: primary?.bonusValue ?? 0,
    selectedSourceLabel: primary?.sourceLabel ?? "",
    selectedSourceCardId: primary?.sourceCardId ?? "",
    candidates: cloneData(candidates),
    selected: cloneData(selected),
    applied: cloneData(selected),
    suppressed: cloneData(suppressed),
    totalAppliedBonus,
    hasBonus: selected.length > 0,
    playerSafe: true,
    readOnly: true
  };
}

export function resolveTravelV2BestStationRollBonuses(session = {}, roundIndex = 0) {
  const records = recordsFromContainer(session?.travelV2PendingStationActionBonuses);
  const stationKeys = Array.from(new Set(records.map((record) => safeKey(record?.targetStationKey)).filter(Boolean)));
  const states = stationKeys.map((stationKey) => prepareTravelV2StationRollBonusState(session, stationKey, roundIndex));
  return { roundIndex: Number(roundIndex), roundNumber: Number(roundIndex) + 1, stations: states, records: states, hasBonuses: states.some((state) => state.hasBonus), playerSafe: true, readOnly: true };
}

export function applyTravelV2PendingStationActionBonusToStationRollPreview(preview = {}, bonusState = {}) {
  return { ...cloneData(preview), travelV2StationRollBonusState: cloneData(bonusState), stationRollBonusState: cloneData(bonusState), totalModifier: Number(preview?.totalModifier ?? 0) + Number(bonusState?.totalAppliedBonus ?? 0), playerSafe: true, readOnly: true };
}

export function consumeTravelV2PendingStationActionBonusRecord(session = {}, recordId = "", options = {}) {
  const nextSession = cloneData(session);
  const records = recordsFromContainer(nextSession.travelV2PendingStationActionBonuses);
  const updated = records.map((record, index) => pendingRecordAuditId(record, index) === recordId ? { ...cloneData(record), consumed: true, consumedRoundIndex: options.roundIndex ?? record.roundIndex ?? record.previewRoundIndex ?? null, consumedStationKey: options.stationKey ?? record.targetStationKey ?? "" } : cloneData(record));
  nextSession.travelV2PendingStationActionBonuses = { ...(isPlainObject(nextSession.travelV2PendingStationActionBonuses) ? nextSession.travelV2PendingStationActionBonuses : {}), records: updated, hasRecords: updated.length > 0, playerSafe: true, readOnly: true };
  return nextSession;
}

export function consumeTravelV2PendingStationActionBonusesForStationRoll(session = {}, stationKey = "", roundIndex = 0, options = {}) {
  const state = prepareTravelV2StationRollBonusState(session, stationKey, roundIndex);
  const selectedIds = new Set(state.selected.map((record) => record.recordId));
  const suppressedById = new Map(state.suppressed.map((record) => [record.recordId, record.suppressedByRecordId || record.suppressedBy]));
  const nextSession = cloneData(session);
  const records = recordsFromContainer(nextSession.travelV2PendingStationActionBonuses);
  const updated = records.map((record, index) => {
    const id = pendingRecordAuditId(record, index);
    if (selectedIds.has(id)) return { ...cloneData(record), consumed: true, consumedRoundIndex: Number(roundIndex), consumedStationKey: stationKey, consumedByRoll: true };
    if (suppressedById.has(id)) return { ...cloneData(record), consumed: true, consumedRoundIndex: Number(roundIndex), consumedStationKey: stationKey, suppressed: true, suppressedBy: suppressedById.get(id), consumedByRoll: true };
    return cloneData(record);
  });
  nextSession.travelV2PendingStationActionBonuses = { ...(isPlainObject(nextSession.travelV2PendingStationActionBonuses) ? nextSession.travelV2PendingStationActionBonuses : {}), records: updated, hasRecords: updated.length > 0, playerSafe: true, readOnly: true };
  return { ok: true, session: nextSession, bonusState: state, consumedRecordIds: [...selectedIds, ...suppressedById.keys()], playerSafe: true, readOnly: true };
}

function sanitizePendingStationResultFloorCandidate(record = {}, index = 0) {
  const targetStationKey = safeKey(record?.targetStationKey);
  const resultFloor = normalizeStationOutcomeKey(record?.resultFloor);
  if (!targetStationKey || !resultFloor) return null;
  return {
    recordId: pendingRecordAuditId(record, index),
    recordIndex: index,
    targetStationKey,
    targetStationLabel: optionalString(record?.targetStationLabel) ?? humanizeIdentifier(targetStationKey),
    resultFloor,
    sourceCardId: optionalString(record?.sourceCardId) ?? "",
    sourceCardLabel: optionalString(record?.sourceCardLabel) ?? "",
    sourceLabel: optionalString(record?.sourceCardLabel) ?? optionalString(record?.sourceLabel) ?? "Result Floor",
    roundIndex: Number.isInteger(Number(record?.roundIndex)) ? Number(record.roundIndex) : (Number.isInteger(Number(record?.previewRoundIndex)) ? Number(record.previewRoundIndex) : null),
    roundNumber: record?.roundNumber ?? record?.previewRoundNumber ?? null,
    playerSafe: true,
    readOnly: true
  };
}

export function prepareTravelV2StationResultFloorState(session = {}, stationKey = "", roundIndex = 0, options = {}) {
  const targetStationKey = safeKey(stationKey);
  const targetRoundIndex = Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : 0;
  const floors = recordsFromContainer(session?.travelV2PendingStationResultFloors)
    .map((record, index) => ({ record, candidate: sanitizePendingStationResultFloorCandidate(record, index) }))
    .filter(({ record, candidate }) => candidate && record?.consumed !== true && candidate.targetStationKey === targetStationKey && pendingRecordAppliesToRound(record, targetRoundIndex))
    .map(({ candidate }) => candidate);
  const selected = floors[0] ?? null;
  const outcomeKey = normalizeStationOutcomeKey(options.outcomeKey ?? getTravelV2StationResultForRound(session, targetStationKey, targetRoundIndex));
  const preview = selected && outcomeKey ? previewTravelV2ResultFloor(outcomeKey, selected.resultFloor) : null;
  const predicted = preview ? { beforeOutcomeKey: preview.before, afterOutcomeKey: preview.after, effectiveOutcomeKey: preview.after, changed: preview.before !== preview.after, resultFloor: selected.resultFloor, playerSafe: true, readOnly: true } : null;
  return { stationKey: targetStationKey, stationLabel: selected?.targetStationLabel || stationLabelForSession(session, targetStationKey), roundIndex: targetRoundIndex, roundNumber: targetRoundIndex + 1, pendingFloors: cloneData(floors), selectedFloor: cloneData(selected), resultFloor: selected?.resultFloor ?? "", sourceCardId: selected?.sourceCardId ?? "", sourceLabel: selected?.sourceLabel ?? "", predictedFloorEffect: predicted, hasPendingFloor: Boolean(selected), playerSafe: true, readOnly: true };
}

export function applyTravelV2PendingStationResultFloorToOutcome(session = {}, stationKey = "", outcomeKey = "", roundIndex = 0, options = {}) {
  const before = normalizeStationOutcomeKey(outcomeKey);
  if (!safeKey(stationKey) || !before) return { ok: false, outcomeKey: before, effectiveOutcomeKey: before, resultFloorChange: null, session: cloneData(session), blockedReason: "Station and outcome are required.", playerSafe: true, readOnly: true };
  const state = prepareTravelV2StationResultFloorState(session, stationKey, roundIndex, { outcomeKey: before });
  if (!state.selectedFloor) return { ok: true, outcomeKey: before, effectiveOutcomeKey: before, resultFloorChange: null, session: cloneData(session), playerSafe: true, readOnly: true };
  const preview = previewTravelV2ResultFloor(before, state.selectedFloor.resultFloor);
  const change = { beforeOutcomeKey: before, afterOutcomeKey: preview.after, outcomeKey: before, effectiveOutcomeKey: preview.after, resultFloor: state.selectedFloor.resultFloor, sourceCardId: state.selectedFloor.sourceCardId, sourceLabel: state.selectedFloor.sourceLabel, appliedRoundIndex: Number(roundIndex), appliedRoundNumber: Number(roundIndex) + 1, changed: before !== preview.after, playerSafe: true, readOnly: true };
  const nextSession = cloneData(session);
  const records = recordsFromContainer(nextSession.travelV2PendingStationResultFloors);
  const updated = records.map((record, index) => pendingRecordAuditId(record, index) === state.selectedFloor.recordId ? { ...cloneData(record), consumed: true, consumedRoundIndex: Number(roundIndex), consumedStationKey: stationKey, effectiveOutcomeKey: preview.after, beforeOutcomeKey: before } : cloneData(record));
  nextSession.travelV2PendingStationResultFloors = { ...(isPlainObject(nextSession.travelV2PendingStationResultFloors) ? nextSession.travelV2PendingStationResultFloors : {}), records: updated, hasRecords: updated.length > 0, playerSafe: true, readOnly: true };
  return { ok: true, outcomeKey: before, effectiveOutcomeKey: preview.after, resultFloorChange: change, session: nextSession, playerSafe: true, readOnly: true };
}

export function consumeTravelV2PendingStationResultFloorForStationRoll(session = {}, stationKey = "", outcomeKey = "", roundIndex = 0, options = {}) {
  return applyTravelV2PendingStationResultFloorToOutcome(session, stationKey, outcomeKey, roundIndex, options);
}


function stationOutcomeFromRollTotal(total, dc) {
  const rollTotal = Number(total);
  const targetDc = Number(dc);
  if (!Number.isFinite(rollTotal) || !Number.isFinite(targetDc)) return "";
  if (rollTotal >= targetDc + 10) return "criticalSuccess";
  if (rollTotal >= targetDc) return "success";
  if (rollTotal <= targetDc - 10) return "criticalFailure";
  return "failure";
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function writeTravelV2StationRollResolutionToSession(session = {}, stationKey = "", roundIndex = 0, resolution = {}) {
  const key = safeKey(stationKey);
  const index = Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : 0;
  const nextSession = cloneData(session);
  const roundResults = Array.isArray(nextSession.roundResults) ? nextSession.roundResults : [];
  const { record, arrayIndex } = roundResultEntryForIndex({ roundResults }, index);
  while (roundResults.length <= arrayIndex) roundResults.push({});
  const roundResult = isPlainObject(record) ? cloneData(record) : {};
  roundResult.roundIndex = index;
  roundResult.roundNumber = roundResult.roundNumber ?? index + 1;
  roundResult.stationResults = isPlainObject(roundResult.stationResults) ? roundResult.stationResults : {};
  roundResult.stationSummary = isPlainObject(roundResult.stationSummary) ? roundResult.stationSummary : {};
  roundResult.stationRollResolutions = isPlainObject(roundResult.stationRollResolutions) ? roundResult.stationRollResolutions : {};
  roundResult.stationResults[key] = resolution.effectiveOutcomeKey;
  const existingSummary = isPlainObject(roundResult.stationSummary[key]) ? roundResult.stationSummary[key] : {};
  roundResult.stationSummary[key] = {
    ...existingSummary,
    stationKey: key,
    rawOutcomeKey: resolution.rawOutcomeKey,
    outcomeKey: resolution.effectiveOutcomeKey,
    effectiveOutcomeKey: resolution.effectiveOutcomeKey,
    degree: resolution.effectiveOutcomeKey,
    rawRollTotal: resolution.rawRollTotal,
    appliedBonusTotal: resolution.appliedBonusTotal,
    effectiveRollTotal: resolution.effectiveRollTotal,
    rawModifier: resolution.rawModifier,
    effectiveModifier: resolution.effectiveModifier,
    stationRollBonusState: cloneData(resolution.stationRollBonusState),
    selectedStationRollBonuses: cloneData(resolution.stationRollBonusState?.selected ?? []),
    suppressedStationRollBonuses: cloneData(resolution.stationRollBonusState?.suppressed ?? []),
    resultFloorState: cloneData(resolution.resultFloorState),
    resultFloorChange: cloneData(resolution.resultFloorChange),
    outcomeOnlyResolution: resolution.outcomeOnlyResolution === true,
    bonusAffectsOutcome: resolution.bonusAffectsOutcome === true,
    playerSafe: true,
    readOnly: true
  };
  roundResult.stationRollResolutions[key] = cloneData(resolution);
  roundResult.stationCheckAppliedBonuses = isPlainObject(roundResult.stationCheckAppliedBonuses) ? roundResult.stationCheckAppliedBonuses : {};
  if ((resolution.stationRollBonusState?.selected ?? []).length > 0) {
    roundResult.stationCheckAppliedBonuses[key] = cloneData(resolution.stationRollBonusState.selected);
  }
  roundResults[arrayIndex] = roundResult;
  nextSession.roundResults = roundResults;
  return nextSession;
}

export function resolveTravelV2StationRollWithPendingEffects(session = {}, stationKey = "", rollData = {}, options = {}) {
  const key = safeKey(stationKey);
  const roundIndex = Number.isInteger(Number(options.roundIndex ?? rollData.roundIndex))
    ? Number(options.roundIndex ?? rollData.roundIndex)
    : (Number.isInteger(Number(session?.currentRoundIndex)) ? Number(session.currentRoundIndex) : 0);
  const rawRollTotal = firstFiniteNumber(rollData.rawRollTotal, rollData.rollTotal, rollData.total);
  const rawModifier = firstFiniteNumber(rollData.rawModifier, rollData.modifier, rollData.totalModifier);
  if (!key) return { ok: false, session: cloneData(session), stationKey: key, roundIndex, blockedReason: "Station is required.", playerSafe: true, readOnly: true };
  const pendingBonusState = prepareTravelV2StationRollBonusState(session, key, roundIndex);
  const dc = firstFiniteNumber(rollData.dc, rollData.targetDc, options.dc, options.targetDc);
  const hasRollTotalAndDc = rawRollTotal != null && dc != null;
  const appliedBonusTotal = hasRollTotalAndDc ? Number(pendingBonusState.totalAppliedBonus ?? 0) : 0;
  const effectiveRollTotal = rawRollTotal == null ? null : rawRollTotal + appliedBonusTotal;
  const effectiveModifier = rawModifier == null ? null : rawModifier + appliedBonusTotal;
  const providedOutcomeKey = normalizeStationOutcomeKey(rollData.rawOutcomeKey ?? rollData.outcomeKey ?? rollData.resultKey);
  const rawOutcomeKey = hasRollTotalAndDc ? stationOutcomeFromRollTotal(effectiveRollTotal, dc) : providedOutcomeKey;
  const outcomeOnlyResolution = !hasRollTotalAndDc;
  const stationRollBonusState = outcomeOnlyResolution
    ? { ...cloneData(pendingBonusState), selected: [], applied: [], suppressed: [], selectedBonusValue: 0, selectedSourceLabel: "", selectedSourceCardId: "", totalAppliedBonus: 0, hasBonus: false, outcomeOnlyResolution: true, bonusAffectsOutcome: false, bonusConsumptionSkippedReason: "Manual outcome-only station resolution did not include roll total and DC data.", playerSafe: true, readOnly: true }
    : pendingBonusState;
  const consumedStationRollBonuses = outcomeOnlyResolution
    ? { ok: true, session: cloneData(session), bonusState: stationRollBonusState, consumedRecordIds: [], outcomeOnlyResolution: true, bonusAffectsOutcome: false, playerSafe: true, readOnly: true }
    : consumeTravelV2PendingStationActionBonusesForStationRoll(session, key, roundIndex);
  const floorState = prepareTravelV2StationResultFloorState(consumedStationRollBonuses.session, key, roundIndex, { outcomeKey: rawOutcomeKey });
  const floorResult = applyTravelV2PendingStationResultFloorToOutcome(consumedStationRollBonuses.session, key, rawOutcomeKey, roundIndex);
  const effectiveOutcomeKey = floorResult.effectiveOutcomeKey || rawOutcomeKey;
  const resolution = {
    ok: true,
    stationKey: key,
    roundIndex,
    roundNumber: roundIndex + 1,
    rawRollTotal,
    rawModifier,
    appliedBonusTotal,
    effectiveRollTotal,
    effectiveModifier,
    rawOutcomeKey,
    outcomeKey: effectiveOutcomeKey,
    effectiveOutcomeKey,
    stationRollBonusState: cloneData(stationRollBonusState),
    consumedStationRollBonuses: cloneData(consumedStationRollBonuses),
    resultFloorState: cloneData(floorState),
    resultFloorChange: cloneData(floorResult.resultFloorChange),
    outcomeOnlyResolution,
    bonusAffectsOutcome: !outcomeOnlyResolution,
    playerSafe: true,
    readOnly: true
  };
  const updatedSession = writeTravelV2StationRollResolutionToSession(floorResult.session, key, roundIndex, resolution);
  return { ...resolution, session: updatedSession };
}

function consumeTravelV2ActiveCard(session = {}, sourceCardId = "") {
  const activeCards = normalizeTravelV2ActiveCardRecords(session.travelV2ActiveCards);
  let consumedCardRecord = null;
  const records = activeCards.records.map((record) => {
    if (record.cardId !== sourceCardId && record.id !== sourceCardId) return record;
    consumedCardRecord = { ...record, status: "consumed", playablePreview: false, triggerReadyPreview: false, waitingForTrigger: false, previewStatus: "consumed", previewStatusLabel: "Consumed", playerSafe: true, readOnly: true };
    return consumedCardRecord;
  });
  return {
    session: { ...session, travelV2ActiveCards: { version: TRAVEL_V2_ACTIVE_CARD_RECORDS_VERSION, records, hasRecords: records.length > 0, playerSafe: true, readOnly: true } },
    consumedCardRecord
  };
}

function applyHeroicStationResultChange(session = {}, preview = {}) {
  const before = getTravelV2StationResultForRound(session, preview.targetStationKey, preview.previewRoundIndex);
  const after = before === "criticalFailure" ? "failure" : (before === "failure" ? "success" : "");
  if (!after) return { blockedReason: "Target station result is not failure or critical failure." };
  const roundIndex = Number.isInteger(Number(preview.previewRoundIndex)) ? Number(preview.previewRoundIndex) : 0;
  const roundResults = Array.isArray(session.roundResults) ? cloneData(session.roundResults) : [];
  const { record, arrayIndex } = roundResultEntryForIndex({ roundResults }, roundIndex);
  while (roundResults.length <= arrayIndex) roundResults.push({});
  const roundResult = isPlainObject(record) ? cloneData(record) : {};
  roundResult.roundIndex = roundIndex;
  roundResult.stationResults = isPlainObject(roundResult.stationResults) ? roundResult.stationResults : {};
  roundResult.stationResults[preview.targetStationKey] = after;
  if (isPlainObject(roundResult.stationSummary?.[preview.targetStationKey])) {
    roundResult.stationSummary[preview.targetStationKey].degree = after;
    roundResult.stationSummary[preview.targetStationKey].outcomeKey = after;
  }
  roundResults[arrayIndex] = roundResult;
  return { session: { ...session, roundResults }, stationResultChange: { targetStationKey: preview.targetStationKey, targetStationLabel: preview.targetStationLabel, roundIndex, roundNumber: preview.previewRoundNumber, before, after, playerSafe: true, readOnly: true } };
}

export function applyTravelV2ActiveCardApplicationPreviewToSession(session = {}, previewId = "", options = {}) {
  if (!isPlainObject(session)) return blockedTravelV2ActiveCardApplyResult(session, "Travel v2 session is required.");
  if (options?.confirmedByGM !== true) return blockedTravelV2ActiveCardApplyResult(session, "GM confirmation is required.");
  const id = optionalString(options?.previewId) ?? optionalString(previewId) ?? "";
  const preview = findCurrentTravelV2ActiveCardApplicationPreview(session, id);
  if (!preview) return blockedTravelV2ActiveCardApplyResult(session, "Active card application preview was not found.");
  if (preview.canApplyPreview !== true) return blockedTravelV2ActiveCardApplyResult(session, preview.blockedReason || "Active card application preview is not apply-ready.");
  const sourceCard = normalizeTravelV2ActiveCardRecords(session.travelV2ActiveCards).records.find((record) => record.cardId === preview.sourceCardId || record.id === preview.sourceCardId);
  if (!sourceCard) return blockedTravelV2ActiveCardApplyResult(session, "Source active card was not found.");
  if (sourceCard.status !== "pending") return blockedTravelV2ActiveCardApplyResult(session, "Source active card is already consumed.");

  let nextSession = cloneData(session);
  let pendingStationActionBonusRecord = null;
  let pendingResultFloorRecord = null;
  let stationResultChange = null;

  if (preview.effectKey === TRAVEL_V2_ACTIVE_CARD_APPLICATION_EFFECTS.minorOpeningBonus || preview.effectKey === TRAVEL_V2_ACTIVE_CARD_APPLICATION_EFFECTS.greaterOpeningBonus) {
    pendingStationActionBonusRecord = buildPendingStationActionBonusFromCardPreview(preview);
    nextSession = appendPendingStationActionBonuses(nextSession, { records: [pendingStationActionBonusRecord] });
  } else if (preview.effectKey === TRAVEL_V2_ACTIVE_CARD_APPLICATION_EFFECTS.heroicDegreeUpgrade) {
    const heroic = applyHeroicStationResultChange(nextSession, preview);
    if (heroic.blockedReason) return blockedTravelV2ActiveCardApplyResult(session, heroic.blockedReason);
    nextSession = heroic.session;
    stationResultChange = heroic.stationResultChange;
  } else if (preview.effectKey === TRAVEL_V2_ACTIVE_CARD_APPLICATION_EFFECTS.legendarySuccessFloor) {
    pendingResultFloorRecord = buildPendingResultFloorFromCardPreview(preview);
    nextSession = appendPendingStationResultFloor(nextSession, pendingResultFloorRecord);
  } else {
    return blockedTravelV2ActiveCardApplyResult(session, "Unsupported active card application effect.");
  }

  const appliedAt = timestampFromOptions(options);
  const { session: consumedSession, consumedCardRecord } = consumeTravelV2ActiveCard(nextSession, preview.sourceCardId);
  nextSession = consumedSession;
  const appliedCardRecord = {
    appliedId: appliedActiveCardId(preview),
    id: appliedActiveCardId(preview),
    previewId: preview.previewId,
    sourceCardId: preview.sourceCardId,
    cardKey: preview.cardKey,
    rewardKey: preview.rewardKey,
    cardLabel: preview.cardLabel,
    applicationType: preview.applicationType,
    effectKey: preview.effectKey,
    effectSummary: preview.effectSummary,
    sourceStationKey: preview.sourceStationKey,
    sourceStationLabel: preview.sourceStationLabel,
    targetStationKey: preview.targetStationKey,
    targetStationLabel: preview.targetStationLabel,
    previewRoundIndex: preview.previewRoundIndex,
    previewRoundNumber: preview.previewRoundNumber,
    appliedRoundIndex: preview.previewRoundIndex,
    appliedRoundNumber: preview.previewRoundNumber,
    ...(stationResultChange ? { targetResultBefore: stationResultChange.before, targetResultAfter: stationResultChange.after } : {}),
    ...(pendingStationActionBonusRecord ? { bonusType: pendingStationActionBonusRecord.bonusType, bonusValue: pendingStationActionBonusRecord.bonusValue } : {}),
    ...(pendingResultFloorRecord ? { resultFloor: pendingResultFloorRecord.resultFloor } : {}),
    appliedAt,
    requiresGMConfirmation: true,
    confirmed: true,
    playerSafe: true,
    readOnly: true
  };
  nextSession = appendTravelV2AppliedActiveCardRecord(nextSession, appliedCardRecord);
  const refreshedActiveCardPreviewState = prepareTravelV2ActiveCardsPreviewState(nextSession.travelV2ActiveCards, nextSession);
  nextSession = {
    ...nextSession,
    travelV2ActiveCardApplicationPreviews: prepareTravelV2ActiveCardApplicationPreviewState(refreshedActiveCardPreviewState, nextSession),
    activeCardApplicationPreviews: prepareTravelV2ActiveCardApplicationPreviewState(refreshedActiveCardPreviewState, nextSession)
  };
  return { ok: true, applied: true, blocked: false, blockedReason: "", session: cloneData(nextSession), appliedCardRecord: cloneData(appliedCardRecord), consumedCardRecord: cloneData(consumedCardRecord), ...(pendingStationActionBonusRecord ? { pendingStationActionBonusRecord: cloneData(pendingStationActionBonusRecord) } : {}), ...(pendingResultFloorRecord ? { pendingResultFloorRecord: cloneData(pendingResultFloorRecord) } : {}), ...(stationResultChange ? { stationResultChange: cloneData(stationResultChange) } : {}), playerSafe: true, readOnly: true };
}

export function prepareTravelV2DifficultyBidCardRecord(stationRow = {}) {
  const preview = isPlainObject(stationRow?.difficultyBidRewardPreview) ? stationRow.difficultyBidRewardPreview : null;
  const rewardKey = safeKey(preview?.rewardKey);
  if (preview?.hasReward !== true || !TRAVEL_V2_DIFFICULTY_BID_REWARD_KEYS.includes(rewardKey)) return null;
  const sourceStationKey = safeKey(stationRow.stationKey);
  const sourceBidKey = normalizeTravelV2DifficultyBid(stationRow.difficultyBidKey).difficultyBidKey;
  const sourceResult = normalizeStationOutcomeKey(stationRow.stationResult ?? preview.stationOutcome);
  const roundIndex = Number.isInteger(Number(stationRow.roundIndex)) ? Number(stationRow.roundIndex) : null;
  const config = TRAVEL_V2_ACTIVE_CARD_CONFIG[rewardKey];
  return normalizeTravelV2ActiveCardRecords([{
    cardId: activeCardId({ roundIndex, sourceStationKey, sourceBidKey, sourceResult, rewardKey }),
    cardKey: rewardKey,
    rewardKey,
    cardLabel: config.cardLabel,
    sourceStationKey,
    sourceStationLabel: stationRow.stationLabel,
    sourceBidKey,
    sourceBidLabel: stationRow.difficultyBidLabel,
    sourceResult,
    roundIndex,
    roundNumber: stationRow.roundNumber ?? null,
    status: "pending",
    timingHint: config.timingHint,
    effectPreviewText: config.effectPreviewText,
    targetStationKey: stationRow.targetStationKey,
    targetStationLabel: stationRow.targetStationLabel
  }]).records[0] ?? null;
}


export function prepareTravelV2DifficultyBidCardRecordsFromStationActionSummary(stationActionSummary = {}) {
  const stations = Array.isArray(stationActionSummary?.stations) ? stationActionSummary.stations : [];
  return normalizeTravelV2ActiveCardRecords(stations.map(prepareTravelV2DifficultyBidCardRecord).filter(Boolean));
}

function isSupportActionSummaryRow(row = {}) {
  return row?.selectedActionKey === "support" || row?.selectedActionType === "support";
}

function isEventApproachActionSummaryRow(row = {}) {
  return row?.selectedActionKey === "eventApproach" || row?.selectedActionType === "eventApproach";
}

function buildSafeSupportWarning(sourceStationLabel = "Station") {
  return `${sourceStationLabel} selected Support, but no valid target station was available; no Support effect was recorded.`;
}

export function prepareTravelV2StationActionSupportEffects(stationActionSummary = {}) {
  const stations = Array.isArray(stationActionSummary?.stations) ? stationActionSummary.stations : [];
  const activeStationKeys = new Set(TRAVEL_V2_ALPHA_CORE_STATION_KEYS);
  const stationLabels = new Map(stations
    .filter((row) => activeStationKeys.has(row?.stationKey))
    .map((row) => [row.stationKey, optionalString(row.stationLabel) ?? humanizeIdentifier(row.stationKey)]));
  const effects = [];
  const warnings = [];
  for (const row of stations) {
    const sourceStationKey = safeKey(row?.stationKey);
    if (!activeStationKeys.has(sourceStationKey) || !isSupportActionSummaryRow(row)) continue;
    const sourceStationLabel = stationLabels.get(sourceStationKey) ?? humanizeIdentifier(sourceStationKey);
    const targetStationKey = safeKey(row?.targetStationKey);
    const targetStationLabel = stationLabels.get(targetStationKey);
    if (!targetStationKey || !activeStationKeys.has(targetStationKey) || targetStationKey === sourceStationKey || !targetStationLabel) {
      warnings.push(buildSafeSupportWarning(sourceStationLabel));
      continue;
    }
    effects.push({
      sourceStationKey,
      sourceStationLabel,
      targetStationKey,
      targetStationLabel,
      effectKey: "support",
      effectType: "support",
      effectLabel: `${sourceStationLabel} supports ${targetStationLabel}.`,
      roundIndex: Number.isInteger(Number(stationActionSummary.roundIndex)) ? Number(stationActionSummary.roundIndex) : (Number.isInteger(Number(row?.roundIndex)) ? Number(row.roundIndex) : null),
      roundNumber: stationActionSummary.roundNumber ?? row?.roundNumber ?? null,
      playerSafe: true,
      readOnly: true
    });
  }
  return {
    version: TRAVEL_V2_STATION_ACTION_EFFECTS_VERSION,
    roundIndex: Number.isInteger(Number(stationActionSummary?.roundIndex)) ? Number(stationActionSummary.roundIndex) : null,
    roundNumber: stationActionSummary?.roundNumber ?? null,
    effects,
    warnings,
    hasEffects: effects.length > 0,
    playerSafe: true,
    readOnly: true
  };
}

export function prepareTravelV2StationActionEventApproachEffects(stationActionSummary = {}) {
  const stations = Array.isArray(stationActionSummary?.stations) ? stationActionSummary.stations : [];
  const activeStationKeys = new Set(TRAVEL_V2_ALPHA_CORE_STATION_KEYS);
  const effects = [];
  for (const row of stations) {
    const sourceStationKey = safeKey(row?.stationKey);
    if (!activeStationKeys.has(sourceStationKey) || !isEventApproachActionSummaryRow(row)) continue;
    const sourceStationLabel = optionalString(row?.stationLabel) ?? humanizeIdentifier(sourceStationKey);
    const selectedSkillLabel = optionalString(row?.selectedSkillLabel) ?? optionalString(row?.approachLabel) ?? optionalString(row?.selectedApproachLabel);
    const stationOutcome = optionalString(row?.stationOutcome) ?? optionalString(row?.stationResult) ?? optionalString(row?.outcomeLabel);
    effects.push({
      sourceStationKey,
      sourceStationLabel,
      effectKey: "eventApproach",
      effectType: "eventApproach",
      effectLabel: `${sourceStationLabel} uses Event Approach.`,
      selectedSkillLabel,
      stationOutcome,
      roundIndex: Number.isInteger(Number(stationActionSummary.roundIndex)) ? Number(stationActionSummary.roundIndex) : (Number.isInteger(Number(row?.roundIndex)) ? Number(row.roundIndex) : null),
      roundNumber: stationActionSummary.roundNumber ?? row?.roundNumber ?? null,
      playerSafe: true,
      readOnly: true
    });
  }
  return {
    version: TRAVEL_V2_STATION_ACTION_EFFECTS_VERSION,
    roundIndex: Number.isInteger(Number(stationActionSummary?.roundIndex)) ? Number(stationActionSummary.roundIndex) : null,
    roundNumber: stationActionSummary?.roundNumber ?? null,
    effects,
    warnings: [],
    hasEffects: effects.length > 0,
    playerSafe: true,
    readOnly: true
  };
}

const EVENT_APPROACH_CONTRIBUTION_VALUES = Object.freeze({
  criticalSuccess: 2,
  success: 1,
  failure: 0,
  criticalFailure: -1
});

function normalizeStationOutcomeKey(value) {
  const key = safeKey(value);
  if (Object.prototype.hasOwnProperty.call(EVENT_APPROACH_CONTRIBUTION_VALUES, key)) return key;
  return "";
}

function eventApproachContributionLabel(sourceStationLabel = "Station", stationOutcome = "", contributionValue = 0, selectedSkillLabel = "") {
  const outcomeLabel = stationOutcome ? humanizeIdentifier(stationOutcome) : "Unknown Result";
  const valueLabel = `${contributionValue > 0 ? "+" : ""}${contributionValue}`;
  const approachText = selectedSkillLabel ? ` using ${selectedSkillLabel}` : "";
  return `${sourceStationLabel} Event Approach${approachText}: ${outcomeLabel} (${valueLabel}).`;
}

export function prepareTravelV2StationActionEventApproachContributions(stationActionEventApproachEffects = {}) {
  const effects = Array.isArray(stationActionEventApproachEffects?.effects) ? stationActionEventApproachEffects.effects : [];
  const records = [];
  for (const effect of effects) {
    const sourceStationKey = safeKey(effect?.sourceStationKey);
    if (!sourceStationKey) continue;
    const sourceStationLabel = optionalString(effect?.sourceStationLabel) ?? humanizeIdentifier(sourceStationKey);
    const selectedSkillLabel = optionalString(effect?.selectedSkillLabel) ?? "";
    const stationOutcome = normalizeStationOutcomeKey(effect?.stationOutcome);
    const contributionValue = stationOutcome ? EVENT_APPROACH_CONTRIBUTION_VALUES[stationOutcome] : 0;
    const roundIndex = Number.isInteger(Number(effect?.roundIndex)) ? Number(effect.roundIndex) : (Number.isInteger(Number(stationActionEventApproachEffects?.roundIndex)) ? Number(stationActionEventApproachEffects.roundIndex) : null);
    const roundNumber = effect?.roundNumber ?? stationActionEventApproachEffects?.roundNumber ?? null;
    records.push({
      sourceStationKey,
      sourceStationLabel,
      contributionKey: "eventApproach",
      contributionType: "eventApproach",
      stationOutcome: stationOutcome || "unknown",
      contributionValue,
      contributionLabel: eventApproachContributionLabel(sourceStationLabel, stationOutcome, contributionValue, selectedSkillLabel),
      selectedSkillLabel,
      roundIndex,
      roundNumber,
      playerSafe: true,
      readOnly: true
    });
  }
  return {
    version: TRAVEL_V2_EVENT_APPROACH_CONTRIBUTIONS_VERSION,
    roundIndex: Number.isInteger(Number(stationActionEventApproachEffects?.roundIndex)) ? Number(stationActionEventApproachEffects.roundIndex) : null,
    roundNumber: stationActionEventApproachEffects?.roundNumber ?? null,
    records,
    hasRecords: records.length > 0,
    playerSafe: true,
    readOnly: true
  };
}

export function prepareTravelV2StationActionEventApproachContributionTally(stationActionEventApproachContributions = {}) {
  const records = Array.isArray(stationActionEventApproachContributions?.records) ? stationActionEventApproachContributions.records : [];
  const contributionRecords = records.filter((record) => record?.contributionKey === "eventApproach" || record?.contributionType === "eventApproach");
  const totalContributionValue = contributionRecords.reduce((total, record) => {
    const contributionValue = Number(record?.contributionValue);
    return total + (Number.isFinite(contributionValue) ? contributionValue : 0);
  }, 0);
  const contributingStationLabels = Array.from(new Set(contributionRecords
    .map((record) => optionalString(record?.sourceStationLabel) ?? humanizeIdentifier(safeKey(record?.sourceStationKey) || "station"))
    .filter(Boolean)));
  return {
    version: TRAVEL_V2_EVENT_APPROACH_CONTRIBUTION_TALLY_VERSION,
    tallyKey: "eventApproach",
    tallyType: "eventApproach",
    tallyLabel: `Event Approach contribution tally: ${totalContributionValue > 0 ? "+" : ""}${totalContributionValue} from ${contributionRecords.length} contribution${contributionRecords.length === 1 ? "" : "s"}.`,
    totalContributionValue,
    contributionCount: contributionRecords.length,
    positiveContributionCount: contributionRecords.filter((record) => Number(record?.contributionValue) > 0).length,
    zeroContributionCount: contributionRecords.filter((record) => Number(record?.contributionValue) === 0 || !Number.isFinite(Number(record?.contributionValue))).length,
    negativeContributionCount: contributionRecords.filter((record) => Number(record?.contributionValue) < 0).length,
    contributingStationLabels,
    roundIndex: Number.isInteger(Number(stationActionEventApproachContributions?.roundIndex)) ? Number(stationActionEventApproachContributions.roundIndex) : null,
    roundNumber: stationActionEventApproachContributions?.roundNumber ?? contributionRecords[0]?.roundNumber ?? null,
    hasContributions: contributionRecords.length > 0,
    playerSafe: true,
    readOnly: true
  };
}

function eventApproachTallyStatusBand(totalContributionValue = 0) {
  if (totalContributionValue >= 3) return { statusKey: "strongProgress", statusLabel: "Strong Progress", statusTone: "safe" };
  if (totalContributionValue >= 1) return { statusKey: "partialProgress", statusLabel: "Partial Progress", statusTone: "warning" };
  if (totalContributionValue === 0) return { statusKey: "noNetProgress", statusLabel: "No Net Progress", statusTone: "neutral" };
  return { statusKey: "setback", statusLabel: "Setback", statusTone: "danger" };
}

export function prepareTravelV2StationActionEventApproachTallyStatus(eventApproachContributionTally = {}) {
  const totalContributionValue = Number.isFinite(Number(eventApproachContributionTally?.totalContributionValue)) ? Number(eventApproachContributionTally.totalContributionValue) : 0;
  const valueLabel = `${totalContributionValue > 0 ? "+" : ""}${totalContributionValue}`;
  const { statusKey, statusLabel, statusTone } = eventApproachTallyStatusBand(totalContributionValue);
  const roundIndex = Number.isInteger(Number(eventApproachContributionTally?.roundIndex)) ? Number(eventApproachContributionTally.roundIndex) : null;
  const roundNumber = eventApproachContributionTally?.roundNumber ?? null;
  return {
    version: TRAVEL_V2_EVENT_APPROACH_TALLY_STATUS_VERSION,
    statusKey,
    statusLabel,
    statusTone,
    statusCategory: statusTone,
    totalContributionValue,
    valueLabel,
    previewLabel: `${statusLabel} preview: ${valueLabel} Event Approach tally captured for later resolution.`,
    previewMessage: `${statusLabel} preview: ${valueLabel} Event Approach tally captured as read-only. Event completion reads effective station outcomes after roll bonus and result-floor resolution.`,
    roundIndex,
    roundNumber,
    playerSafe: true,
    readOnly: true
  };
}


const EVENT_APPROACH_PLAYER_SAFE_FORBIDDEN_KEYS = Object.freeze([
  "auditRecord", "commitRecords", "userId", "userName", "gmText", "gmSummary", "gmMechanicalNotes", "gmReview",
  "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload",
  "before", "after", "queueInternals", "mutationScope", "secret", "pendingConsequenceQueue", "gmOnly",
  "unrevealedHazard", "catalogSuggestions"
]);

function stripEventApproachPlayerUnsafeKeys(value) {
  if (Array.isArray(value)) return value.map((entry) => stripEventApproachPlayerUnsafeKeys(entry));
  if (!isPlainObject(value)) return cloneData(value);
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (EVENT_APPROACH_PLAYER_SAFE_FORBIDDEN_KEYS.includes(key)) continue;
    output[key] = stripEventApproachPlayerUnsafeKeys(entry);
  }
  return output;
}

function findEventApproachTallyResolutionRecord(session = {}, options = {}) {
  const records = recordsFromContainer(session?.travelV2RoundResolutions);
  const explicitRoundIndex = Number.isInteger(Number(options.roundIndex)) ? Number(options.roundIndex) : null;
  const candidates = explicitRoundIndex === null
    ? records
    : records.filter((record) => Number(record?.roundIndex) === explicitRoundIndex);
  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

function normalizeEventApproachApplicationSourceTally(tally = null, fallback = {}) {
  const source = isPlainObject(tally) ? tally : {};
  const totalContributionValue = Number.isFinite(Number(source.totalContributionValue)) ? Number(source.totalContributionValue) : 0;
  const contributionCount = Number.isInteger(Number(source.contributionCount)) ? Number(source.contributionCount) : 0;
  return {
    version: source.version ?? TRAVEL_V2_EVENT_APPROACH_CONTRIBUTION_TALLY_VERSION,
    tallyKey: source.tallyKey ?? "eventApproach",
    tallyType: source.tallyType ?? "eventApproach",
    tallyLabel: optionalString(source.tallyLabel) ?? `Event Approach contribution tally: ${totalContributionValue > 0 ? "+" : ""}${totalContributionValue} from ${contributionCount} contribution${contributionCount === 1 ? "" : "s"}.`,
    totalContributionValue,
    contributionCount,
    positiveContributionCount: Number.isInteger(Number(source.positiveContributionCount)) ? Number(source.positiveContributionCount) : 0,
    zeroContributionCount: Number.isInteger(Number(source.zeroContributionCount)) ? Number(source.zeroContributionCount) : 0,
    negativeContributionCount: Number.isInteger(Number(source.negativeContributionCount)) ? Number(source.negativeContributionCount) : 0,
    contributingStationLabels: Array.isArray(source.contributingStationLabels) ? source.contributingStationLabels.filter((label) => typeof label === "string" && label.trim()).map((label) => label.trim()) : [],
    roundIndex: Number.isInteger(Number(source.roundIndex)) ? Number(source.roundIndex) : (Number.isInteger(Number(fallback.roundIndex)) ? Number(fallback.roundIndex) : null),
    roundNumber: source.roundNumber ?? fallback.roundNumber ?? null,
    hasContributions: source.hasContributions === true || contributionCount > 0,
    playerSafe: true,
    readOnly: true
  };
}

function eventApproachApplicationPreviewRecordFromTally(sourceTally = {}, finalized = false, blockedReason = "") {
  const total = Number.isFinite(Number(sourceTally.totalContributionValue)) ? Number(sourceTally.totalContributionValue) : 0;
  const valueLabel = `${total > 0 ? "+" : ""}${total}`;
  const ready = finalized && sourceTally.hasContributions === true;
  return {
    id: ["travel-v2-event-approach-apply-preview", Number.isInteger(Number(sourceTally.roundIndex)) ? Number(sourceTally.roundIndex) : "unknown-round"].join(":"),
    previewId: ["travel-v2-event-approach-apply-preview", Number.isInteger(Number(sourceTally.roundIndex)) ? Number(sourceTally.roundIndex) : "unknown-round"].join(":"),
    previewType: "eventApproachTallyApplication",
    status: ready ? "readyForFutureGmApply" : "blocked",
    statusLabel: ready ? "Ready for Future GM Apply" : "Blocked / Not Ready",
    blockedReason: ready ? "" : (blockedReason || "Event Approach tally is not finalized."),
    roundIndex: sourceTally.roundIndex,
    roundNumber: sourceTally.roundNumber,
    title: "Event Approach Tally Apply Preview",
    summary: ready
      ? `If the GM applies this in a future slice, the finalized Event Approach tally would adjust event progress by ${valueLabel}.`
      : "No Event Approach tally application can be previewed until the round tally is finalized.",
    effectPreview: {
      effectKey: "eventApproachProgressDeltaPreview",
      effectLabel: "Event progress delta preview",
      delta: total,
      valueLabel,
      appliesOnFutureGmConfirmation: true,
      applied: false,
      readOnly: true,
      playerSafe: true
    },
    applicationAvailable: false,
    canApply: false,
    applied: false,
    reviewOnly: true,
    playerSafe: true,
    readOnly: true
  };
}

export function prepareTravelV2EventApproachTallyApplicationPreview(session = {}, options = {}) {
  const sourceSession = isPlainObject(session) ? session : {};
  const resolutionRecord = findEventApproachTallyResolutionRecord(sourceSession, options);
  const explicitRoundIndex = Number.isInteger(Number(options.roundIndex)) ? Number(options.roundIndex) : null;
  const fallbackRoundIndex = explicitRoundIndex ?? (Number.isInteger(Number(sourceSession?.currentRoundIndex)) ? Number(sourceSession.currentRoundIndex) : null);
  const fallbackRoundNumber = resolutionRecord?.roundNumber ?? (fallbackRoundIndex === null ? null : fallbackRoundIndex + 1);
  const rawTally = resolutionRecord?.stationActionEventApproachContributionTally
    ?? resolutionRecord?.eventApproachContributionTally
    ?? sourceSession?.stationActionEventApproachContributionTally
    ?? sourceSession?.eventApproachContributionTally
    ?? null;
  const sourceTally = normalizeEventApproachApplicationSourceTally(rawTally, { roundIndex: fallbackRoundIndex, roundNumber: fallbackRoundNumber });
  const finalized = resolutionRecord?.lifecycleState === "finalized" || resolutionRecord?.status === "finalized" || resolutionRecord?.finalized === true;
  const blockedReason = !resolutionRecord
    ? "No finalized round resolution record was found for the requested round."
    : (!sourceTally.hasContributions ? "No finalized Event Approach contributions were found for this round." : "Event Approach tally is not finalized.");
  const record = eventApproachApplicationPreviewRecordFromTally(sourceTally, finalized, blockedReason);
  const records = [record];
  const playerState = stripEventApproachPlayerUnsafeKeys({
    version: TRAVEL_V2_EVENT_APPROACH_TALLY_APPLICATION_PREVIEW_VERSION,
    previewType: "eventApproachTallyApplication",
    status: record.status,
    statusLabel: record.statusLabel,
    readyForFutureGmApply: record.status === "readyForFutureGmApply",
    blocked: record.status !== "readyForFutureGmApply",
    blockedReason: record.blockedReason,
    roundIndex: sourceTally.roundIndex,
    roundNumber: sourceTally.roundNumber,
    sourceTally,
    records,
    hasRecords: records.length > 0,
    applicationAvailable: false,
    canApply: false,
    applied: false,
    reviewOnly: true,
    playerSafe: true,
    readOnly: true
  });
  const gmState = {
    ...cloneData(playerState),
    playerSafe: false,
    gmReview: {
      resolutionRecordFound: Boolean(resolutionRecord),
      requestedRoundIndex: explicitRoundIndex,
      sourceTally: cloneData(sourceTally),
      notes: "Review-only. This slice does not implement GM apply flow or mutate session/world data."
    },
    readOnly: true
  };
  return { version: TRAVEL_V2_EVENT_APPROACH_TALLY_APPLICATION_PREVIEW_VERSION, playerState: cloneData(playerState), gmState: cloneData(gmState), playerSafe: true, readOnly: true };
}


function eventApproachApplicationRecordId(record = {}) {
  const explicitId = optionalString(record.id ?? record.recordId ?? record.previewId);
  if (explicitId) return explicitId;
  const sourceTally = normalizeEventApproachApplicationSourceTally(record.sourceTally ?? record.sourceTallySummary ?? record, record);
  return ["travel-v2-event-approach-apply", Number.isInteger(Number(sourceTally.roundIndex)) ? Number(sourceTally.roundIndex) : "unknown-round"].join(":");
}

function normalizeEventApproachApplicationStatus(record = {}) {
  if (record.applied === true || record.status === "applied") return "applied";
  if (record.status === "blocked") return "blocked";
  if (record.status === "ready" || record.status === "readyForGmApply" || record.status === "readyForFutureGmApply") return "readyForGmApply";
  return "readyForGmApply";
}

function normalizeEventApproachTallyApplicationRecord(record = {}, fallback = {}) {
  const source = isPlainObject(record) ? record : {};
  const sourceTally = normalizeEventApproachApplicationSourceTally(source.sourceTally ?? source.sourceTallySummary ?? source.tally ?? source, fallback);
  const id = eventApproachApplicationRecordId({ ...source, sourceTally });
  const total = Number.isFinite(Number(source.progressDeltaPreview?.delta)) ? Number(source.progressDeltaPreview.delta) : sourceTally.totalContributionValue;
  const valueLabel = `${total > 0 ? "+" : ""}${total}`;
  const status = normalizeEventApproachApplicationStatus(source);
  const applied = status === "applied";
  return stripEventApproachPlayerUnsafeKeys({
    version: source.version ?? TRAVEL_V2_EVENT_APPROACH_TALLY_APPLICATION_RECORDS_VERSION,
    id,
    recordId: id,
    previewId: optionalString(source.previewId) ?? id,
    applicationType: "eventApproachTallyApplication",
    status,
    statusLabel: applied ? "Applied" : (status === "blocked" ? "Blocked" : "Ready for GM Apply"),
    applied,
    appliedAtRound: Number.isInteger(Number(source.appliedAtRound)) ? Number(source.appliedAtRound) : null,
    appliedAt: optionalString(source.appliedAt) ?? "",
    appliedByFlow: optionalString(source.appliedByFlow) ?? "",
    sourceRoundIndex: Number.isInteger(Number(source.sourceRoundIndex)) ? Number(source.sourceRoundIndex) : sourceTally.roundIndex,
    sourceRoundNumber: source.sourceRoundNumber ?? sourceTally.roundNumber ?? null,
    sourceTallySummary: source.sourceTallySummary ?? sourceTally.tallyLabel,
    sourceTally,
    progressDeltaPreview: {
      effectKey: "eventApproachProgressDeltaPreview",
      effectLabel: "Event progress delta preview",
      delta: total,
      valueLabel,
      applied,
      inert: true,
      playerSafe: true,
      readOnly: true
    },
    requiresGMConfirmation: true,
    confirmed: applied,
    playerSafe: true,
    readOnly: true
  });
}

export function normalizeTravelV2EventApproachTallyApplicationRecords(container = {}) {
  const sourceRecords = recordsFromContainer(container);
  const records = [];
  const seen = new Set();
  for (const record of sourceRecords) {
    if (!isPlainObject(record)) continue;
    const normalized = normalizeEventApproachTallyApplicationRecord(record);
    if (seen.has(normalized.id)) continue;
    seen.add(normalized.id);
    records.push(normalized);
  }
  return { version: TRAVEL_V2_EVENT_APPROACH_TALLY_APPLICATION_RECORDS_VERSION, records, hasRecords: records.length > 0, playerSafe: true, readOnly: true };
}

function blockedEventApproachTallyApplyResult(session, blockedReason = "Event Approach tally application blocked.") {
  const clonedSession = isPlainObject(session) ? cloneData(session) : session;
  return { ok: false, applied: false, blocked: true, blockedReason, session: clonedSession, playerSafe: true, readOnly: true };
}

export function applyTravelV2EventApproachTallyApplicationRecordToSession(session = {}, recordId = "", options = {}) {
  if (!isPlainObject(session)) return blockedEventApproachTallyApplyResult(session, "Travel v2 session is required.");
  if (options?.confirmedByGM !== true) return blockedEventApproachTallyApplyResult(session, "GM confirmation is required.");
  const id = optionalString(options?.id ?? options?.recordId) ?? optionalString(recordId) ?? "";
  if (!id) return blockedEventApproachTallyApplyResult(session, "Event Approach tally application record id is required.");

  const existing = normalizeTravelV2EventApproachTallyApplicationRecords(session.travelV2EventApproachTallyApplications ?? session.eventApproachTallyApplications ?? []);
  const target = existing.records.find((record) => record.id === id || record.recordId === id || record.previewId === id);
  if (!target) return blockedEventApproachTallyApplyResult(session, "Event Approach tally application record was not found.");

  const appliedAt = timestampFromOptions(options);
  const appliedAtRound = Number.isInteger(Number(options.appliedAtRound))
    ? Number(options.appliedAtRound)
    : (Number.isInteger(Number(session.currentRoundIndex)) ? Number(session.currentRoundIndex) : target.sourceRoundIndex);
  const appliedRecord = normalizeEventApproachTallyApplicationRecord({
    ...target,
    status: "applied",
    applied: true,
    appliedAt,
    appliedAtRound,
    appliedByFlow: optionalString(options.appliedByFlow) ?? "gm-event-approach-tally-apply",
    confirmed: true
  });
  const records = existing.records.map((record) => (record.id === target.id ? appliedRecord : record));
  const nextContainer = { version: TRAVEL_V2_EVENT_APPROACH_TALLY_APPLICATION_RECORDS_VERSION, records, hasRecords: records.length > 0, playerSafe: true, readOnly: true };
  const nextSession = {
    ...cloneData(session),
    travelV2EventApproachTallyApplications: nextContainer,
    eventApproachTallyApplications: cloneData(nextContainer)
  };
  return { ok: true, applied: true, blocked: false, blockedReason: "", session: cloneData(nextSession), appliedRecord: cloneData(appliedRecord), playerSafe: true, readOnly: true };
}

export function prepareTravelV2PendingStationActionBonusesFromSupportEffects(stationActionSupportEffects = {}) {
  const effects = Array.isArray(stationActionSupportEffects?.effects) ? stationActionSupportEffects.effects : [];
  const bonuses = [];
  for (const effect of effects) {
    const sourceStationKey = safeKey(effect?.sourceStationKey);
    const targetStationKey = safeKey(effect?.targetStationKey);
    const sourceStationLabel = optionalString(effect?.sourceStationLabel) ?? humanizeIdentifier(sourceStationKey);
    const targetStationLabel = optionalString(effect?.targetStationLabel) ?? humanizeIdentifier(targetStationKey);
    if (!sourceStationKey || !targetStationKey || sourceStationKey === targetStationKey || !sourceStationLabel || !targetStationLabel) continue;
    const roundIndex = Number.isInteger(Number(effect?.roundIndex)) ? Number(effect.roundIndex) : (Number.isInteger(Number(stationActionSupportEffects?.roundIndex)) ? Number(stationActionSupportEffects.roundIndex) : null);
    const roundNumber = effect?.roundNumber ?? stationActionSupportEffects?.roundNumber ?? null;
    const appliesToRoundIndex = roundIndex === null ? null : roundIndex + 1;
    bonuses.push({
      sourceStationKey,
      sourceStationLabel,
      targetStationKey,
      targetStationLabel,
      bonusKey: "support",
      bonusType: "circumstance",
      bonusValue: 1,
      bonusLabel: `Support from ${sourceStationLabel}: +1 circumstance bonus for ${targetStationLabel}.`,
      roundIndex,
      roundNumber,
      appliesToRoundIndex,
      nextRoundIndex: appliesToRoundIndex,
      consumed: false,
      playerSafe: true,
      readOnly: true
    });
  }
  return {
    version: TRAVEL_V2_PENDING_STATION_ACTION_BONUSES_VERSION,
    roundIndex: Number.isInteger(Number(stationActionSupportEffects?.roundIndex)) ? Number(stationActionSupportEffects.roundIndex) : null,
    roundNumber: stationActionSupportEffects?.roundNumber ?? null,
    records: bonuses,
    hasRecords: bonuses.length > 0,
    playerSafe: true,
    readOnly: true
  };
}

function recordsFromContainer(container) {
  if (Array.isArray(container)) return container;
  if (Array.isArray(container?.records)) return container.records;
  return [];
}

function createRoundResolutionRecord(finalizationState = {}, options = {}) {
  const supportEffects = isPlainObject(finalizationState.stationActionSupportEffects) ? finalizationState.stationActionSupportEffects : null;
  const eventApproachEffects = isPlainObject(finalizationState.stationActionEventApproachEffects) ? finalizationState.stationActionEventApproachEffects : null;
  const eventApproachContributions = isPlainObject(finalizationState.stationActionEventApproachContributions) ? finalizationState.stationActionEventApproachContributions : null;
  const eventApproachContributionTally = isPlainObject(finalizationState.stationActionEventApproachContributionTally) ? finalizationState.stationActionEventApproachContributionTally : null;
  const eventApproachTallyStatus = isPlainObject(finalizationState.stationActionEventApproachTallyStatus) ? finalizationState.stationActionEventApproachTallyStatus : null;
  const activeCards = isPlainObject(finalizationState.travelV2ActiveCards) ? finalizationState.travelV2ActiveCards : null;
  const stationActionEffects = [
    ...(supportEffects?.effects ?? []),
    ...(eventApproachEffects?.effects ?? [])
  ];
  const record = {
    roundIndex: finalizationState.roundIndex,
    roundNumber: finalizationState.roundNumber,
    finalizedAt: timestampFromOptions(options),
    helperVersion: TRAVEL_V2_SESSION_ROUND_FINALIZATION_VERSION,
    lifecycleState: "finalized",
    effectiveOutcomeKey: finalizationState.effectiveOutcomeKey,
    pressureApplicationRecord: cloneData(finalizationState.pressureApplicationRecord),
    correctionRecord: finalizationState.correctionRecord ? cloneData(finalizationState.correctionRecord) : null,
    stationSummary: finalizationState.stationSummary ? cloneData(finalizationState.stationSummary) : null,
    stationActionSummary: finalizationState.stationActionSummary ? cloneData(finalizationState.stationActionSummary) : null,
    stationActionSupportEffects: supportEffects ? cloneData(supportEffects) : null,
    stationActionEventApproachEffects: eventApproachEffects ? cloneData(eventApproachEffects) : null,
    stationActionEventApproachContributions: eventApproachContributions ? cloneData(eventApproachContributions) : null,
    eventApproachContributions: eventApproachContributions ? cloneData(eventApproachContributions) : null,
    stationActionEventApproachContributionTally: eventApproachContributionTally ? cloneData(eventApproachContributionTally) : null,
    eventApproachContributionTally: eventApproachContributionTally ? cloneData(eventApproachContributionTally) : null,
    stationActionEventApproachTallyStatus: eventApproachTallyStatus ? cloneData(eventApproachTallyStatus) : null,
    eventApproachTallyStatus: eventApproachTallyStatus ? cloneData(eventApproachTallyStatus) : null,
    stationActionEffects: cloneData(stationActionEffects),
    pendingStationActionBonuses: finalizationState.pendingStationActionBonuses ? cloneData(finalizationState.pendingStationActionBonuses) : null,
    travelV2ActiveCards: activeCards ? cloneData(activeCards) : null,
    activeCardRecords: activeCards ? cloneData(activeCards.records) : []
  };
  const notes = optionalString(options.notes);
  const reason = optionalString(options.reason);
  if (notes !== undefined) record.notes = notes;
  if (reason !== undefined) record.reason = reason;
  return record;
}

function appendRoundResolutionRecord(session = {}, roundResolutionRecord = {}) {
  const existingContainer = session.travelV2RoundResolutions;
  const existingRecords = recordsFromContainer(existingContainer);
  return {
    ...session,
    travelV2RoundResolutions: {
      ...(isPlainObject(existingContainer) ? existingContainer : {}),
      records: [...cloneData(existingRecords), cloneData(roundResolutionRecord)]
    }
  };
}

function appendPendingStationActionBonuses(session = {}, pendingStationActionBonuses = {}) {
  const pendingRecords = recordsFromContainer(pendingStationActionBonuses);
  if (pendingRecords.length === 0) return session;
  const existingContainer = session.travelV2PendingStationActionBonuses;
  const existingRecords = recordsFromContainer(existingContainer);
  return {
    ...session,
    travelV2PendingStationActionBonuses: {
      ...(isPlainObject(existingContainer) ? existingContainer : {}),
      version: TRAVEL_V2_PENDING_STATION_ACTION_BONUSES_VERSION,
      records: [...cloneData(existingRecords), ...cloneData(pendingRecords)],
      playerSafe: true,
      readOnly: true
    }
  };
}

export function appendTravelV2ActiveCardRecordsToSession(session = {}, activeCards = {}) {
  const incoming = normalizeTravelV2ActiveCardRecords(activeCards).records;
  const existingContainer = normalizeTravelV2ActiveCardRecords(session?.travelV2ActiveCards);
  const existingIds = new Set(existingContainer.records.map((record) => record.cardId));
  const merged = [...existingContainer.records];
  for (const record of incoming) {
    if (existingIds.has(record.cardId)) continue;
    existingIds.add(record.cardId);
    merged.push(record);
  }
  return {
    ...session,
    travelV2ActiveCards: {
      version: TRAVEL_V2_ACTIVE_CARD_RECORDS_VERSION,
      records: cloneData(merged),
      hasRecords: merged.length > 0,
      playerSafe: true,
      readOnly: true
    }
  };
}

export function sanitizeTravelV2ActiveCardsForPlayers(container = {}) {
  return normalizeTravelV2ActiveCardRecords(container);
}


function currentRoundLockInSource(session = {}) {
  const rounds = Array.isArray(session?.event?.rounds) ? session.event.rounds : [];
  const roundIndex = Number.isInteger(Number(session?.currentRoundIndex)) ? Math.min(Math.max(Number(session.currentRoundIndex), 0), Math.max(rounds.length - 1, 0)) : 0;
  const round = rounds[roundIndex] && typeof rounds[roundIndex] === "object" && !Array.isArray(rounds[roundIndex]) ? rounds[roundIndex] : {};
  const roundResult = Array.isArray(session?.roundResults) && session.roundResults[roundIndex] && typeof session.roundResults[roundIndex] === "object" && !Array.isArray(session.roundResults[roundIndex]) ? session.roundResults[roundIndex] : {};
  const stationOrder = Array.from(new Set([
    ...(Array.isArray(round.activeStations) ? round.activeStations : []),
    ...TRAVEL_V2_ALPHA_CORE_STATION_KEYS
  ].filter((key) => typeof key === "string" && key.trim()).map((key) => key.trim())));
  const actions = isPlainObject(roundResult.stationActions) ? roundResult.stationActions : {};
  const commitments = isPlainObject(roundResult.stationOrderCommitments) ? roundResult.stationOrderCommitments : {};
  const stationKeys = Array.from(new Set([...stationOrder, ...Object.keys(actions), ...Object.keys(commitments)]));
  const stations = {};
  for (const stationKey of stationKeys) {
    const action = isPlainObject(actions[stationKey]) ? actions[stationKey] : {};
    const commitment = isPlainObject(commitments[stationKey]) ? commitments[stationKey] : {};
    stations[stationKey] = {
      ...cloneData(action),
      actionKey: action.actionKey ?? action.key ?? action.type ?? action.action ?? "",
      label: action.label ?? action.actionLabel ?? action.name ?? "",
      locked: commitment.committed === true || commitment.locked === true || action.locked === true
    };
  }
  return { stationOrder, activeStations: stationOrder, stations };
}

export function prepareTravelV2StationActionResolutionSummary(session = {}, options = {}) {
  const rounds = Array.isArray(session?.event?.rounds) ? session.event.rounds : [];
  const roundIndex = Number.isInteger(Number(options.roundIndex))
    ? Number(options.roundIndex)
    : (Number.isInteger(Number(session?.currentRoundIndex)) ? Number(session.currentRoundIndex) : 0);
  const boundedRoundIndex = rounds.length > 0 ? Math.min(Math.max(roundIndex, 0), rounds.length - 1) : Math.max(roundIndex, 0);
  const round = isPlainObject(rounds[boundedRoundIndex]) ? rounds[boundedRoundIndex] : {};
  const roundResult = Array.isArray(session?.roundResults) && isPlainObject(session.roundResults[boundedRoundIndex]) ? session.roundResults[boundedRoundIndex] : {};
  const source = currentRoundLockInSource({ ...session, currentRoundIndex: boundedRoundIndex });
  const activeStationKeys = new Set(source.stationOrder);
  const stations = TRAVEL_V2_ALPHA_CORE_STATION_KEYS.map((stationKey) => {
    const action = isPlainObject(roundResult.stationActions?.[stationKey]) ? roundResult.stationActions[stationKey] : {};
    const commitment = isPlainObject(roundResult.stationOrderCommitments?.[stationKey]) ? roundResult.stationOrderCommitments[stationKey] : {};
    const selectedActionKey = safeKey(action.actionKey ?? action.key ?? action.action ?? action.type);
    const selectedActionType = safeKey(action.type ?? action.actionType ?? selectedActionKey);
    const stationDcModifier = round.stationPrompts?.[stationKey]?.dcModifier ?? round.stationPrompts?.[stationKey]?.dcMod ?? action.dcModifier ?? action.dcMod ?? 0;
    const difficultyBidPreview = prepareTravelV2DifficultyBidPreview({
      bid: action.difficultyBidKey ?? action.difficultyBid ?? action.bidKey ?? action.bid ?? "none",
      baseDC: session?.event?.baseDC ?? round.baseDC ?? 0,
      stationDcModifier,
      outcomeKey: roundResult.stationResults?.[stationKey] ?? round.stationSummary?.[stationKey]?.degree ?? round.stationSummary?.[stationKey]?.outcomeKey ?? ""
    });
    const targetStationKey = safeKey(action.targetStationKey ?? action.targetStation ?? "");
    const hasTarget = targetStationKey && activeStationKeys.has(targetStationKey);
    return {
      stationKey,
      stationLabel: stationLabel(round, stationKey),
      selectedActionKey,
      selectedActionType,
      selectedActionLabel: actionLabel(action, selectedActionKey || selectedActionType),
      difficultyBidKey: difficultyBidPreview.difficultyBidKey,
      difficultyBidLabel: difficultyBidPreview.difficultyBidLabel,
      difficultyBidDcModifier: difficultyBidPreview.difficultyBidDcModifier,
      difficultyBidRewardPreview: difficultyBidPreview.difficultyBidRewardPreview,
      effectiveDcPreview: difficultyBidPreview.effectiveDcPreview,
      targetStationKey: hasTarget ? targetStationKey : "",
      targetStationLabel: hasTarget ? stationLabel(round, targetStationKey) : "",
      selectedSkillLabel: optionalString(action.selectedSkillLabel) ?? optionalString(action.skillLabel) ?? optionalString(action.approachLabel) ?? optionalString(action.selectedApproachLabel) ?? "",
      stationResult: optionalString(roundResult.stationResults?.[stationKey]) ?? optionalString(round.stationSummary?.[stationKey]?.degree) ?? "",
      locked: commitment.committed === true || commitment.locked === true || action.locked === true,
      committed: commitment.committed === true || commitment.locked === true || action.locked === true,
      roundIndex: boundedRoundIndex,
      roundNumber: round.roundNumber ?? round.number ?? boundedRoundIndex + 1
    };
  });
  return {
    version: TRAVEL_V2_STATION_ACTION_RESOLUTION_SUMMARY_VERSION,
    roundIndex: boundedRoundIndex,
    roundNumber: round.roundNumber ?? round.number ?? boundedRoundIndex + 1,
    stations,
    stationCount: stations.length,
    playerSafe: true
  };
}

function formatLockInGuardMessage(entry = {}) {
  const stationKey = typeof entry?.stationKey === "string" && entry.stationKey ? entry.stationKey : "unknown";
  switch (entry?.code) {
    case "invalidStationKey": return `Invalid required station key for Travel v2 round resolution: ${stationKey}.`;
    case "missingRequiredStation": return `Required Travel Five station is missing before round resolution: ${stationKey}.`;
    case "missingStationAction": return `Required Travel Five station has no selected action before round resolution: ${stationKey}.`;
    case "stationActionUnlocked": return `Required Travel Five station action is not locked before round resolution: ${stationKey}.`;
    case "resolveBeforeLockIn": return "Station action lock-in is not ready: all required Travel Five station actions must be selected and locked before round resolution.";
    default: return typeof entry?.message === "string" && entry.message.trim() ? entry.message.trim() : "Station action lock-in is not ready for round resolution.";
  }
}

export function inspectTravelV2StationActionLockInFinalizationGuard(session = {}, options = {}) {
  const source = currentRoundLockInSource(session);
  const readiness = checkTravelV2StationActionLockInReady(source, { ...options, requiredStationKeys: TRAVEL_V2_ALPHA_CORE_STATION_KEYS, stationOrder: source.stationOrder });
  const gmMessages = Array.from(new Set((readiness.validationErrors ?? []).map(formatLockInGuardMessage)));
  const ready = readiness.ready === true && gmMessages.length === 0;
  return {
    ready,
    gmMessage: ready ? "Station action lock-in is ready for round resolution." : (gmMessages[0] ?? "Station action lock-in is not ready for round resolution."),
    playerMessage: ready ? "Station actions are ready for round resolution." : "Round resolution is waiting for all required station actions to be selected and locked.",
    blockedReasons: ready ? [] : gmMessages,
    playerBlockedReasons: ready ? [] : ["Round resolution is waiting for all required station actions to be selected and locked."]
  };
}

function stateSummary(finalizationState = {}) {
  return {
    lifecycleState: finalizationState.lifecycleState,
    roundIndex: finalizationState.roundIndex,
    roundNumber: finalizationState.roundNumber,
    effectiveOutcomeKey: finalizationState.effectiveOutcomeKey,
    isEventCompleteReady: finalizationState.isEventCompleteReady === true
  };
}

function blockedResult(session, finalizationState = {}, error = "Travel v2 round finalization is blocked for this runner session.") {
  return {
    ok: false,
    finalized: false,
    session,
    blockedReasons: cloneData(finalizationState.blockedReasons ?? [error]),
    error,
    ...stateSummary(finalizationState)
  };
}

export function finalizeTravelV2RoundOnRunnerSession(session, options = {}) {
  const finalizationStateBefore = prepareTravelV2RoundFinalizationState(session, options);

  if (finalizationStateBefore.canFinalize !== true) {
    return blockedResult(session, finalizationStateBefore, finalizationStateBefore.blockedReasons[0]);
  }

  const lockInGuard = inspectTravelV2StationActionLockInFinalizationGuard(session, options);
  if (lockInGuard.ready !== true) {
    return {
      ...blockedResult(session, { ...finalizationStateBefore, blockedReasons: lockInGuard.blockedReasons }, lockInGuard.gmMessage),
      stationActionLockInReady: false,
      gmMessage: lockInGuard.gmMessage,
      playerMessage: lockInGuard.playerMessage,
      playerBlockedReasons: lockInGuard.playerBlockedReasons
    };
  }

  const clonedSession = cloneData(session);
  const stationActionSummary = prepareTravelV2StationActionResolutionSummary(session, { ...options, roundIndex: finalizationStateBefore.roundIndex });
  const stationActionSupportEffects = prepareTravelV2StationActionSupportEffects(stationActionSummary);
  const stationActionEventApproachEffects = prepareTravelV2StationActionEventApproachEffects(stationActionSummary);
  const stationActionEffects = [...stationActionSupportEffects.effects, ...stationActionEventApproachEffects.effects];
  const stationActionEventApproachContributions = prepareTravelV2StationActionEventApproachContributions(stationActionEventApproachEffects);
  const stationActionEventApproachContributionTally = prepareTravelV2StationActionEventApproachContributionTally(stationActionEventApproachContributions);
  const stationActionEventApproachTallyStatus = prepareTravelV2StationActionEventApproachTallyStatus(stationActionEventApproachContributionTally);
  const pendingStationActionBonuses = prepareTravelV2PendingStationActionBonusesFromSupportEffects(stationActionSupportEffects);
  const travelV2ActiveCards = prepareTravelV2DifficultyBidCardRecordsFromStationActionSummary(stationActionSummary);
  const roundResolutionRecord = createRoundResolutionRecord({ ...finalizationStateBefore, stationActionSummary, stationActionSupportEffects, stationActionEventApproachEffects, stationActionEventApproachContributions, stationActionEventApproachContributionTally, stationActionEventApproachTallyStatus, pendingStationActionBonuses, travelV2ActiveCards }, options);
  const finalizedSession = appendTravelV2ActiveCardRecordsToSession(appendPendingStationActionBonuses(appendRoundResolutionRecord(clonedSession, roundResolutionRecord), pendingStationActionBonuses), travelV2ActiveCards);
  const mergedTravelV2ActiveCards = normalizeTravelV2ActiveCardRecords(finalizedSession.travelV2ActiveCards);
  const travelV2ActiveCardPreviewState = prepareTravelV2ActiveCardsPreviewState(mergedTravelV2ActiveCards, finalizedSession);
  const travelV2ActiveCardApplicationPreviews = prepareTravelV2ActiveCardApplicationPreviewState(travelV2ActiveCardPreviewState, finalizedSession);
  const finalizationStateAfter = prepareTravelV2RoundFinalizationState(finalizedSession, options);
  const lifecycleState = finalizationStateAfter.lifecycleState;

  return {
    ok: true,
    finalized: true,
    session: finalizedSession,
    roundResolutionRecord,
    lifecycleState,
    roundIndex: finalizationStateBefore.roundIndex,
    roundNumber: finalizationStateBefore.roundNumber,
    effectiveOutcomeKey: finalizationStateBefore.effectiveOutcomeKey,
    isEventCompleteReady: finalizationStateAfter.isEventCompleteReady === true,
    finalizationStateBefore,
    finalizationStateAfter,
    stationActionSummary: cloneData(stationActionSummary),
    stationActionSupportEffects: cloneData(stationActionSupportEffects),
    stationActionEventApproachEffects: cloneData(stationActionEventApproachEffects),
    stationActionEventApproachContributions: cloneData(stationActionEventApproachContributions),
    eventApproachContributions: cloneData(stationActionEventApproachContributions),
    stationActionEventApproachContributionTally: cloneData(stationActionEventApproachContributionTally),
    eventApproachContributionTally: cloneData(stationActionEventApproachContributionTally),
    stationActionEventApproachTallyStatus: cloneData(stationActionEventApproachTallyStatus),
    eventApproachTallyStatus: cloneData(stationActionEventApproachTallyStatus),
    stationActionEffects: cloneData(stationActionEffects),
    stationActionEffectWarnings: cloneData(stationActionSupportEffects.warnings),
    pendingStationActionBonuses: cloneData(pendingStationActionBonuses),
    travelV2PendingStationActionBonuses: cloneData(pendingStationActionBonuses),
    travelV2ActiveCards: cloneData(mergedTravelV2ActiveCards),
    travelV2ActiveCardApplicationPreviews: cloneData(travelV2ActiveCardApplicationPreviews),
    activeCardApplicationPreviews: cloneData(travelV2ActiveCardApplicationPreviews),
    activeCardRecords: cloneData(mergedTravelV2ActiveCards.records),
    createdTravelV2ActiveCards: cloneData(travelV2ActiveCards),
    createdActiveCardRecords: cloneData(travelV2ActiveCards.records)
  };
}

export default finalizeTravelV2RoundOnRunnerSession;
