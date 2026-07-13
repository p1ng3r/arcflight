import { prepareTravelV2RiskBidSelectedReviewPreview } from "./travel-v2-risk-bid-review-preview.js";

export const TRAVEL_V2_RISK_BID_REVIEW_APPLY_INTENT_VERSION = 1;

const QUEUE_SESSION_KEY = "travelV2RiskBidReviewQueue";
const VALID_INTENT_MODES = Object.freeze(["none", "prepare", "confirm"]);
const INTENT_RECORD_KEYS = Object.freeze(["intentVersion", "intentKey", "queueKey", "status", "payloadType", "candidateType", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "resolutionType", "resolutionFamily", "previewOnly", "intentOnly", "confirmed", "applied"]);
const FORBIDDEN_OUTPUT_TERMS = Object.freeze(["gmOnly", "secret", "hiddenHazards", "unrevealedHazard", "futureTriggers", "internalScoring", "debugReport", "auditRecord", "applyPayload", "actorUuid", "targetActorUuid", "userId", "userName", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."]);

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
function freezeOutput(value) {
  if (Array.isArray(value)) for (const entry of value) freezeOutput(entry);
  else if (value && typeof value === "object") for (const entry of Object.values(value)) freezeOutput(entry);
  return Object.freeze(value);
}
function incrementCount(counts, key) {
  const safeKey = safeString(key) || "unknown";
  counts[safeKey] = (Number(counts[safeKey]) || 0) + 1;
}
function normalizeIntentMode(value) {
  const safeMode = safeString(value);
  return VALID_INTENT_MODES.includes(safeMode) ? safeMode : "";
}
function countIntentRecords(intentRecords = []) {
  const byResolutionFamily = {};
  const byResolutionType = {};
  const byPayloadType = {};
  const byDangerLevel = {};
  const bySeverity = {};
  for (const record of intentRecords) {
    incrementCount(byResolutionFamily, record.resolutionFamily);
    incrementCount(byResolutionType, record.resolutionType);
    incrementCount(byPayloadType, record.payloadType);
    incrementCount(byDangerLevel, record.dangerLevel);
    incrementCount(bySeverity, record.severity);
  }
  return freezeOutput({ byResolutionFamily, byResolutionType, byPayloadType, byDangerLevel, bySeverity });
}
function shell({ canReview = false, intentMode = "prepare", confirmed = false, intentRecords = [], selectedCount = 0, blockedReasons = [], warnings = [], ok = false, available = false } = {}) {
  const counted = countIntentRecords(intentRecords);
  return freezeOutput({
    version: TRAVEL_V2_RISK_BID_REVIEW_APPLY_INTENT_VERSION,
    ok,
    available,
    canReview,
    intentMode,
    confirmed,
    applyReady: intentRecords.length > 0 && confirmed === true,
    selectedCount,
    intentRecords: freezeOutput(intentRecords),
    byResolutionFamily: counted.byResolutionFamily,
    byResolutionType: counted.byResolutionType,
    byPayloadType: counted.byPayloadType,
    byDangerLevel: counted.byDangerLevel,
    bySeverity: counted.bySeverity,
    blockedReasons: Array.from(new Set(blockedReasons)),
    warnings: Array.from(new Set(warnings)),
    applied: false
  });
}
function makeIntentRecord(previewRecord, confirmed) {
  const queueKey = safeString(previewRecord.queueKey);
  const intent = {
    intentVersion: TRAVEL_V2_RISK_BID_REVIEW_APPLY_INTENT_VERSION,
    intentKey: `risk-bid-review-apply-intent:${queueKey}`,
    queueKey,
    status: safeString(previewRecord.status) || "pending",
    payloadType: safeString(previewRecord.payloadType),
    candidateType: safeString(previewRecord.candidateType),
    severity: safeString(previewRecord.severity) || "standard",
    tier: previewRecord.tier ?? null,
    resultBand: safeString(previewRecord.resultBand) || null,
    dangerLevel: safeString(previewRecord.dangerLevel) || "none",
    stationKey: safeString(previewRecord.stationKey),
    stationName: safeString(previewRecord.stationName),
    actionId: safeString(previewRecord.actionId),
    actionName: safeString(previewRecord.actionName),
    roundIndex: previewRecord.roundIndex ?? null,
    roundNumber: previewRecord.roundNumber ?? null,
    label: safeString(previewRecord.label, "Risk bid review apply intent") || "Risk bid review apply intent",
    text: safeString(previewRecord.text, "Intent only — no effects applied.") || "Intent only — no effects applied.",
    resolutionType: safeString(previewRecord.resolutionType) || "review",
    resolutionFamily: safeString(previewRecord.resolutionFamily) || "review",
    previewOnly: true,
    intentOnly: true,
    confirmed,
    applied: false
  };
  for (const key of Object.keys(intent)) if (!INTENT_RECORD_KEYS.includes(key)) delete intent[key];
  return freezeOutput(intent);
}

export function prepareTravelV2RiskBidReviewApplyIntent(session = {}, options = {}) {
  const canReview = options?.canReview === true;
  const hasRequestedMode = Object.hasOwn(options ?? {}, "intentMode");
  const requestedMode = options?.intentMode ?? "prepare";
  const normalizedMode = normalizeIntentMode(requestedMode);
  const intentMode = normalizedMode || "prepare";
  const invalidRequestedMode = hasRequestedMode && !normalizedMode;
  if (!canReview) return shell({ canReview: false, intentMode, blockedReasons: ["travel-v2-review-permission-required"] });
  if (invalidRequestedMode) return shell({ canReview: true, intentMode, blockedReasons: ["invalid-risk-bid-review-apply-intent-mode"] });
  if (intentMode === "none") return shell({ canReview: true, intentMode, blockedReasons: ["risk-bid-review-apply-intent-mode-none"] });
  if (!session?.[QUEUE_SESSION_KEY] || typeof session[QUEUE_SESSION_KEY] !== "object") return shell({ canReview: true, intentMode, blockedReasons: ["risk-bid-review-queue-not-found"] });

  const preview = prepareTravelV2RiskBidSelectedReviewPreview(session, { canReview: true, includeDismissed: options?.includeDismissed === true });
  if (!preview?.previewRecords?.length) {
    return shell({ canReview: true, intentMode, selectedCount: Number(preview?.selectedCount) || 0, blockedReasons: ["missing-selected-risk-bid-review-preview-records"], warnings: preview?.warnings ?? [] });
  }

  const confirmed = intentMode === "confirm";
  const intentRecords = preview.previewRecords.map((record) => makeIntentRecord(record, confirmed));
  const blockedReasons = confirmed ? [] : ["risk-bid-review-apply-intent-not-confirmed"];
  return shell({ canReview: true, intentMode, confirmed, intentRecords, selectedCount: preview.selectedCount, blockedReasons, warnings: preview.warnings, ok: true, available: true });
}
