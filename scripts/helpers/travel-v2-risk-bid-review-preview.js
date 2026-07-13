import { prepareTravelV2RiskBidReviewQueueState } from "./travel-v2-risk-bid-review-queue.js";

export const TRAVEL_V2_RISK_BID_REVIEW_PREVIEW_VERSION = 1;

const QUEUE_SESSION_KEY = "travelV2RiskBidReviewQueue";
const SAFE_LABEL_FALLBACK = "Risk bid review preview";
const SAFE_TEXT_FALLBACK = "Selected risk bid review is ready for GM review.";
const RESOLUTION_FAMILIES = Object.freeze(["pressure", "hazard", "consequence", "benefit", "reward", "momentum", "scar", "review"]);
const PAYLOAD_RESOLUTION_MAP = Object.freeze({
  pressureReview: { resolutionFamily: "pressure", resolutionType: "pressure" },
  severePressureReview: { resolutionFamily: "pressure", resolutionType: "severePressure" },
  hazardProgressReview: { resolutionFamily: "hazard", resolutionType: "hazardProgress" },
  hazardEscalationReview: { resolutionFamily: "hazard", resolutionType: "hazardEscalation" },
  additionalHazardReview: { resolutionFamily: "hazard", resolutionType: "additionalHazard" },
  consequenceReview: { resolutionFamily: "consequence", resolutionType: "consequence" },
  stationComplicationReview: { resolutionFamily: "consequence", resolutionType: "stationComplication" },
  nextRoundDifficultyReview: { resolutionFamily: "consequence", resolutionType: "nextRoundDifficulty" },
  benefitReview: { resolutionFamily: "benefit", resolutionType: "benefit" },
  progressReview: { resolutionFamily: "benefit", resolutionType: "progress" },
  rewardReview: { resolutionFamily: "reward", resolutionType: "reward" },
  momentumReview: { resolutionFamily: "momentum", resolutionType: "momentum" },
  shipScarReview: { resolutionFamily: "scar", resolutionType: "shipScar" }
});
const PREVIEW_RECORD_KEYS = Object.freeze(["queueKey", "status", "selected", "payloadType", "candidateType", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "resolutionType", "resolutionFamily", "previewOnly", "applied"]);
const FORBIDDEN_OUTPUT_TERMS = Object.freeze(["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions", "hiddenHazards", "futureTriggers", "internalScoring", "debugReport", "actorUuid", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."]);

function unsafeOutputString(value) {
  if (typeof value !== "string") return false;
  return FORBIDDEN_OUTPUT_TERMS.some((term) => value.includes(term));
}
function safeString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed || unsafeOutputString(trimmed)) return fallback;
  return trimmed;
}
function safeIntegerOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && unsafeOutputString(value)) return null;
  const number = Number(value);
  return Number.isInteger(number) && Number.isFinite(number) ? number : null;
}
function safeRiskBidTierOrNull(value) {
  const number = safeIntegerOrNull(value);
  return [2, 5, 8].includes(number) ? number : null;
}
function freezeOutput(value) {
  if (Array.isArray(value)) for (const entry of value) freezeOutput(entry);
  else if (value && typeof value === "object") for (const entry of Object.values(value)) freezeOutput(entry);
  return Object.freeze(value);
}
function incrementCount(counts, key) {
  const safeKey = safeString(key) || "unknown";
  counts[safeKey] = (Number(counts[safeKey]) || 0) + 1;
}
function emptyFamilyBooleans() {
  return {
    hasPressurePreview: false,
    hasHazardPreview: false,
    hasConsequencePreview: false,
    hasBenefitPreview: false,
    hasRewardPreview: false,
    hasMomentumPreview: false,
    hasScarPreview: false
  };
}
function resolutionForPayloadType(payloadType) {
  const safePayloadType = safeString(payloadType);
  return PAYLOAD_RESOLUTION_MAP[safePayloadType] ?? { resolutionFamily: "review", resolutionType: "review" };
}
function makePreviewRecord(record = {}) {
  const payloadType = safeString(record.payloadType);
  const resolution = resolutionForPayloadType(payloadType);
  const preview = {
    queueKey: safeString(record.queueKey),
    status: safeString(record.status) || "pending",
    selected: record.selected === true,
    payloadType,
    candidateType: safeString(record.candidateType),
    severity: safeString(record.severity, "standard") || "standard",
    tier: safeRiskBidTierOrNull(record.tier),
    resultBand: safeString(record.resultBand) || null,
    dangerLevel: safeString(record.dangerLevel) || "none",
    stationKey: safeString(record.stationKey),
    stationName: safeString(record.stationName),
    actionId: safeString(record.actionId),
    actionName: safeString(record.actionName),
    roundIndex: safeIntegerOrNull(record.roundIndex),
    roundNumber: safeIntegerOrNull(record.roundNumber),
    label: safeString(record.label, SAFE_LABEL_FALLBACK) || SAFE_LABEL_FALLBACK,
    text: safeString(record.text, SAFE_TEXT_FALLBACK) || SAFE_TEXT_FALLBACK,
    resolutionType: resolution.resolutionType,
    resolutionFamily: resolution.resolutionFamily,
    previewOnly: true,
    applied: false
  };
  for (const key of Object.keys(preview)) if (!PREVIEW_RECORD_KEYS.includes(key)) delete preview[key];
  return freezeOutput(preview);
}
function countPreviewRecords(previewRecords = []) {
  const byPayloadType = {};
  const byDangerLevel = {};
  const bySeverity = {};
  const familyBooleans = emptyFamilyBooleans();
  for (const record of previewRecords) {
    incrementCount(byPayloadType, record.payloadType);
    incrementCount(byDangerLevel, record.dangerLevel);
    incrementCount(bySeverity, record.severity);
    if (record.resolutionFamily === "pressure") familyBooleans.hasPressurePreview = true;
    if (record.resolutionFamily === "hazard") familyBooleans.hasHazardPreview = true;
    if (record.resolutionFamily === "consequence") familyBooleans.hasConsequencePreview = true;
    if (record.resolutionFamily === "benefit") familyBooleans.hasBenefitPreview = true;
    if (record.resolutionFamily === "reward") familyBooleans.hasRewardPreview = true;
    if (record.resolutionFamily === "momentum") familyBooleans.hasMomentumPreview = true;
    if (record.resolutionFamily === "scar") familyBooleans.hasScarPreview = true;
  }
  return { byPayloadType: freezeOutput(byPayloadType), byDangerLevel: freezeOutput(byDangerLevel), bySeverity: freezeOutput(bySeverity), familyBooleans };
}
function emptyPreview({ canReview = false, blockedReasons = [], warnings = [], selectedCount = 0 } = {}) {
  const counted = countPreviewRecords([]);
  return freezeOutput({
    version: TRAVEL_V2_RISK_BID_REVIEW_PREVIEW_VERSION,
    ok: false,
    available: false,
    canReview,
    selectedCount,
    previewRecords: [],
    byPayloadType: counted.byPayloadType,
    byDangerLevel: counted.byDangerLevel,
    bySeverity: counted.bySeverity,
    ...counted.familyBooleans,
    blockedReasons: Array.from(new Set(blockedReasons)),
    warnings: Array.from(new Set(warnings)),
    applied: false
  });
}

export function prepareTravelV2RiskBidSelectedReviewPreview(session = {}, options = {}) {
  const canReview = options?.canReview === true;
  if (!canReview) return emptyPreview({ canReview: false, blockedReasons: ["travel-v2-review-permission-required"] });
  if (!session?.[QUEUE_SESSION_KEY] || typeof session[QUEUE_SESSION_KEY] !== "object") return emptyPreview({ canReview: true, blockedReasons: ["risk-bid-review-queue-not-found"] });

  const queue = prepareTravelV2RiskBidReviewQueueState(session);
  const selectedRecords = queue.records.filter((record) => record.selected === true);
  if (selectedRecords.length === 0) return emptyPreview({ canReview: true, blockedReasons: ["missing-selected-risk-bid-review-records"] });

  const warnings = [];
  const includeDismissed = options?.includeDismissed === true;
  let appliedSkipped = 0;
  let dismissedExcluded = 0;
  const previewRecords = [];
  for (const record of selectedRecords) {
    const status = safeString(record.status) || "pending";
    if (status === "applied") {
      appliedSkipped += 1;
      continue;
    }
    if (status === "dismissed" && !includeDismissed) {
      dismissedExcluded += 1;
      continue;
    }
    const preview = makePreviewRecord(record);
    if (!RESOLUTION_FAMILIES.includes(preview.resolutionFamily)) continue;
    if (preview.resolutionFamily === "review") warnings.push("unknown-risk-bid-review-payload-mapped-to-review");
    previewRecords.push(preview);
  }
  if (appliedSkipped > 0) warnings.push("applied-risk-bid-review-records-skipped");
  if (dismissedExcluded > 0) warnings.push("dismissed-risk-bid-review-records-excluded");

  if (previewRecords.length === 0) {
    const allApplied = selectedRecords.every((record) => safeString(record.status) === "applied");
    return emptyPreview({ canReview: true, selectedCount: selectedRecords.length, warnings, blockedReasons: [allApplied ? "selected-risk-bid-review-records-all-applied" : "selected-risk-bid-review-records-not-ready"] });
  }

  const counted = countPreviewRecords(previewRecords);
  return freezeOutput({
    version: TRAVEL_V2_RISK_BID_REVIEW_PREVIEW_VERSION,
    ok: true,
    available: true,
    canReview: true,
    selectedCount: selectedRecords.length,
    previewRecords: freezeOutput(previewRecords),
    byPayloadType: counted.byPayloadType,
    byDangerLevel: counted.byDangerLevel,
    bySeverity: counted.bySeverity,
    ...counted.familyBooleans,
    blockedReasons: [],
    warnings: Array.from(new Set(warnings)),
    applied: false
  });
}

export function prepareTravelV2RiskBidReviewPreviewPackage(session = {}, options = {}) {
  return prepareTravelV2RiskBidSelectedReviewPreview(session, options);
}

export function applyTravelV2RiskBidReviewPreviewToRenderState(state = {}, input = {}, options = {}) {
  const user = options.user ?? input.user ?? state.user ?? globalThis.game?.user;
  const canReview = options.canReview === true || input.canReview === true || user?.isGM === true;
  const preview = prepareTravelV2RiskBidSelectedReviewPreview(input.session ?? state.session ?? state, { canReview, includeDismissed: options.includeDismissed === true || input.includeDismissed === true });
  const safePreview = canReview ? preview : emptyPreview({ canReview: false, blockedReasons: ["travel-v2-review-permission-required"] });
  return { ...state, travelV2RiskBidSelectedReviewPreview: safePreview, riskBidSelectedReviewPreview: safePreview, travelV2RiskBidReviewPreview: safePreview, riskBidReviewPreview: safePreview };
}
