import { prepareTravelV2RiskBidReviewApplyIntent } from "./travel-v2-risk-bid-review-apply-intent.js";

export const TRAVEL_V2_RISK_BID_REVIEW_APPLY_GATE_VERSION = 1;

const QUEUE_SESSION_KEY = "travelV2RiskBidReviewQueue";
const VALID_GATE_MODES = Object.freeze(["closed", "preview", "armed"]);
const GATE_RECORD_KEYS = Object.freeze(["gateVersion", "gateKey", "intentKey", "queueKey", "status", "payloadType", "candidateType", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "resolutionType", "resolutionFamily", "previewOnly", "intentOnly", "gateOnly", "confirmed", "armed", "applied"]);
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
function normalizeGateMode(value) {
  const safeMode = safeString(value);
  return VALID_GATE_MODES.includes(safeMode) ? safeMode : "";
}
function countGateRecords(gateRecords = []) {
  const byResolutionFamily = {};
  const byResolutionType = {};
  const byPayloadType = {};
  const byDangerLevel = {};
  const bySeverity = {};
  for (const record of gateRecords) {
    incrementCount(byResolutionFamily, record.resolutionFamily);
    incrementCount(byResolutionType, record.resolutionType);
    incrementCount(byPayloadType, record.payloadType);
    incrementCount(byDangerLevel, record.dangerLevel);
    incrementCount(bySeverity, record.severity);
  }
  return freezeOutput({ byResolutionFamily, byResolutionType, byPayloadType, byDangerLevel, bySeverity });
}
function shell({ canReview = false, gateMode = "preview", armed = false, gateRecords = [], selectedCount = 0, intentRecordCount = 0, blockedReasons = [], warnings = [], ok = false, available = false } = {}) {
  const counted = countGateRecords(gateRecords);
  return freezeOutput({
    version: TRAVEL_V2_RISK_BID_REVIEW_APPLY_GATE_VERSION,
    ok,
    available,
    canReview,
    gateMode,
    armed,
    gateReady: armed === true && gateRecords.length > 0,
    confirmedIntentRequired: true,
    selectedCount,
    intentRecordCount,
    gateRecords: freezeOutput(gateRecords),
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
function makeGateRecord(intentRecord, armed) {
  const intentKey = safeString(intentRecord.intentKey);
  const gate = {
    gateVersion: TRAVEL_V2_RISK_BID_REVIEW_APPLY_GATE_VERSION,
    gateKey: `risk-bid-review-apply-gate:${intentKey}`,
    intentKey,
    queueKey: safeString(intentRecord.queueKey),
    status: safeString(intentRecord.status) || "pending",
    payloadType: safeString(intentRecord.payloadType),
    candidateType: safeString(intentRecord.candidateType),
    severity: safeString(intentRecord.severity) || "standard",
    tier: intentRecord.tier ?? null,
    resultBand: safeString(intentRecord.resultBand) || null,
    dangerLevel: safeString(intentRecord.dangerLevel) || "none",
    stationKey: safeString(intentRecord.stationKey),
    stationName: safeString(intentRecord.stationName),
    actionId: safeString(intentRecord.actionId),
    actionName: safeString(intentRecord.actionName),
    roundIndex: intentRecord.roundIndex ?? null,
    roundNumber: intentRecord.roundNumber ?? null,
    label: safeString(intentRecord.label, "Risk bid review apply gate") || "Risk bid review apply gate",
    text: safeString(intentRecord.text, "Gate only — no effects applied.") || "Gate only — no effects applied.",
    resolutionType: safeString(intentRecord.resolutionType) || "review",
    resolutionFamily: safeString(intentRecord.resolutionFamily) || "review",
    previewOnly: true,
    intentOnly: true,
    gateOnly: true,
    confirmed: true,
    armed,
    applied: false
  };
  for (const key of Object.keys(gate)) if (!GATE_RECORD_KEYS.includes(key)) delete gate[key];
  return freezeOutput(gate);
}

export function prepareTravelV2RiskBidReviewApplyGate(session = {}, options = {}) {
  const canReview = options?.canReview === true;
  const hasRequestedMode = Object.hasOwn(options ?? {}, "gateMode");
  const normalizedMode = normalizeGateMode(options?.gateMode ?? "preview");
  const gateMode = normalizedMode || "preview";
  const invalidRequestedMode = hasRequestedMode && !normalizedMode;
  if (!canReview) return shell({ canReview: false, gateMode, blockedReasons: ["travel-v2-review-permission-required"] });
  if (invalidRequestedMode) return shell({ canReview: true, gateMode, blockedReasons: ["invalid-risk-bid-review-apply-gate-mode"] });
  if (!session?.[QUEUE_SESSION_KEY] || typeof session[QUEUE_SESSION_KEY] !== "object") return shell({ canReview: true, gateMode, blockedReasons: ["risk-bid-review-queue-not-found"] });
  if (gateMode === "closed") return shell({ canReview: true, gateMode, blockedReasons: ["risk-bid-review-apply-gate-mode-closed"] });

  const intent = prepareTravelV2RiskBidReviewApplyIntent(session, { canReview: true, intentMode: "confirm", includeDismissed: options?.includeDismissed === true });
  const intentRecords = Array.isArray(intent?.intentRecords) ? intent.intentRecords.filter((record) => record?.confirmed === true && record?.applied !== true) : [];
  if (!intentRecords.length) {
    return shell({ canReview: true, gateMode, selectedCount: Number(intent?.selectedCount) || 0, intentRecordCount: 0, blockedReasons: ["missing-confirmed-risk-bid-review-apply-intent-records"], warnings: intent?.warnings ?? [] });
  }
  const armed = gateMode === "armed";
  const gateRecords = intentRecords.map((record) => makeGateRecord(record, armed));
  return shell({ canReview: true, gateMode, armed, gateRecords, selectedCount: Number(intent?.selectedCount) || 0, intentRecordCount: intentRecords.length, warnings: intent?.warnings ?? [], ok: true, available: true });
}
