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
export const TRAVEL_V2_DIFFICULTY_BID_KEYS = Object.freeze(["none", "minor", "greater", "extreme"]);
export const TRAVEL_V2_DIFFICULTY_BID_REWARD_KEYS = Object.freeze(["minorOpening", "greaterOpening", "heroicEvent", "legendaryEvent"]);
export const TRAVEL_V2_ACTIVE_CARD_STATUSES = Object.freeze(["pending"]);

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
    effectPreviewText: "Future effect: grant +1 circumstance bonus to one target station roll."
  }),
  greaterOpening: Object.freeze({
    cardLabel: "Greater Opening",
    timingHint: "Play after station actions are locked and before the target station rolls.",
    effectPreviewText: "Future effect: grant +3 circumstance bonus to one target station roll."
  }),
  heroicEvent: Object.freeze({
    cardLabel: "Heroic Event",
    timingHint: "Triggers when the target station rolls failure or critical failure.",
    effectPreviewText: "Future effect: improve one target station failure or critical failure by one degree."
  }),
  legendaryEvent: Object.freeze({
    cardLabel: "Legendary Event",
    timingHint: "Play after station actions are locked but before the target station rolls.",
    effectPreviewText: "Future effect: target station cannot resolve worse than success."
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
    previewMessage: `${statusLabel} preview: ${valueLabel} Event Approach tally captured as read-only and not applied yet. It does not change pressure, hazards, rewards, resources, DCs, event progress, or completion.`,
    roundIndex,
    roundNumber,
    playerSafe: true,
    readOnly: true
  };
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
    travelV2ActiveCards: cloneData(travelV2ActiveCards),
    activeCardRecords: cloneData(travelV2ActiveCards.records)
  };
}

export default finalizeTravelV2RoundOnRunnerSession;
