import { prepareTravelV2RiskBidReviewQueueState } from "./travel-v2-risk-bid-review-queue.js";

export const TRAVEL_V2_RISK_BID_REVIEW_PREVIEW_VERSION = 1;

const SAFE_LABEL_FALLBACK = "Risk bid review preview";
const SAFE_TEXT_FALLBACK = "Selected risk bid review is ready for later GM resolution.";
const PREVIEW_KEYS = Object.freeze(["previewVersion", "queueKey", "source", "status", "payloadType", "candidateType", "resolutionFamily", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "requiresReview", "selected", "selectedAt", "readyForResolution", "resolutionMode", "applied"]);
const RESOLUTION_FAMILIES = Object.freeze(["pressure", "hazard", "consequence", "shipScar", "benefit", "difficulty", "reward", "other"]);
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
function emptyCountMap(keys = []) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}
function incrementCount(counts, key) {
  const safeKey = safeString(key) || "unknown";
  counts[safeKey] = (Number(counts[safeKey]) || 0) + 1;
}
function resolutionFamilyFor(record = {}) {
  const text = `${safeString(record.payloadType)} ${safeString(record.candidateType)}`.toLowerCase();
  if (text.includes("pressure")) return "pressure";
  if (text.includes("hazard")) return "hazard";
  if (text.includes("consequence")) return "consequence";
  if (text.includes("scar")) return "shipScar";
  if (text.includes("benefit") || text.includes("progress")) return "benefit";
  if (text.includes("difficulty")) return "difficulty";
  if (text.includes("reward") || text.includes("momentum")) return "reward";
  return "other";
}
function buildCounts(records = [], previews = []) {
  const counts = {
    selected: records.length,
    ready: previews.length,
    blocked: Math.max(0, records.length - previews.length),
    byStatus: {},
    byResolutionFamily: emptyCountMap(RESOLUTION_FAMILIES),
    bySeverity: {},
    byDangerLevel: {},
    byResultBand: {},
    byTier: {}
  };
  for (const record of records) {
    incrementCount(counts.byStatus, record.status);
    incrementCount(counts.bySeverity, record.severity);
    incrementCount(counts.byDangerLevel, record.dangerLevel);
    incrementCount(counts.byResultBand, record.resultBand);
    incrementCount(counts.byTier, record.tier === null || record.tier === undefined ? "none" : String(record.tier));
  }
  for (const preview of previews) incrementCount(counts.byResolutionFamily, preview.resolutionFamily);
  return freezeOutput(counts);
}
function buildResolutionFamilies(previews = []) {
  const grouped = new Map(RESOLUTION_FAMILIES.map((family) => [family, []]));
  for (const preview of previews) {
    const family = RESOLUTION_FAMILIES.includes(preview.resolutionFamily) ? preview.resolutionFamily : "other";
    grouped.get(family).push(preview);
  }
  return freezeOutput(RESOLUTION_FAMILIES.map((family) => {
    const records = grouped.get(family) ?? [];
    return {
      family,
      label: family === "shipScar" ? "Ship Scar" : `${family.charAt(0).toUpperCase()}${family.slice(1)}`,
      count: records.length,
      hasRecords: records.length > 0,
      records
    };
  }).filter((family) => family.hasRecords));
}
function previewRecord(record = {}) {
  const preview = {
    previewVersion: TRAVEL_V2_RISK_BID_REVIEW_PREVIEW_VERSION,
    queueKey: safeString(record.queueKey),
    source: safeString(record.source) || "riskBidResult",
    status: safeString(record.status) || "pending",
    payloadType: safeString(record.payloadType),
    candidateType: safeString(record.candidateType),
    resolutionFamily: resolutionFamilyFor(record),
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
    requiresReview: record.requiresReview === false ? false : true,
    selected: record.selected === true,
    selectedAt: record.selected === true ? safeString(record.selectedAt) : "",
    readyForResolution: record.selected === true && !["dismissed", "applied"].includes(safeString(record.status)),
    resolutionMode: "later-gm-review",
    applied: false
  };
  for (const key of Object.keys(preview)) if (!PREVIEW_KEYS.includes(key)) delete preview[key];
  return freezeOutput(preview);
}

export function prepareTravelV2RiskBidSelectedReviewPreview(session = {}, options = {}) {
  const canReview = options?.canReview === true;
  const queue = prepareTravelV2RiskBidReviewQueueState(session);
  const emptyCounts = buildCounts([], []);
  if (!canReview) return freezeOutput({ version: TRAVEL_V2_RISK_BID_REVIEW_PREVIEW_VERSION, available: false, ok: false, canReview: false, selectedCount: 0, readyCount: 0, blockedCount: 0, blockedReasons: ["travel-v2-review-permission-required"], summaryText: "Risk bid selected review preview is GM-only.", counts: emptyCounts, resolutionFamilies: [], previews: [], hasPreviews: false, applied: false });
  const selectedRecords = queue.records.filter((record) => record.selected === true);
  const previews = selectedRecords.map(previewRecord).filter((record) => record.readyForResolution === true);
  const counts = buildCounts(selectedRecords, previews);
  const resolutionFamilies = buildResolutionFamilies(previews);
  const blockedReasons = [];
  if (selectedRecords.length === 0) blockedReasons.push("missing-selected-risk-bid-review-records");
  if (selectedRecords.length > 0 && previews.length === 0) blockedReasons.push("selected-risk-bid-review-records-not-ready");
  return freezeOutput({
    version: TRAVEL_V2_RISK_BID_REVIEW_PREVIEW_VERSION,
    available: previews.length > 0,
    ok: previews.length > 0,
    canReview: true,
    selectedCount: selectedRecords.length,
    readyCount: previews.length,
    blockedCount: counts.blocked,
    blockedReasons,
    summaryText: previews.length > 0 ? `${previews.length} of ${selectedRecords.length} selected risk bid review ${selectedRecords.length === 1 ? "record is" : "records are"} ready for later GM resolution across ${resolutionFamilies.length} resolution ${resolutionFamilies.length === 1 ? "family" : "families"}.` : "Select ready risk bid review records before preparing a later-resolution preview.",
    counts,
    resolutionFamilies,
    previews,
    hasPreviews: previews.length > 0,
    applied: false
  });
}

export function prepareTravelV2RiskBidReviewPreviewPackage(session = {}, options = {}) {
  return prepareTravelV2RiskBidSelectedReviewPreview(session, options);
}

export function applyTravelV2RiskBidReviewPreviewToRenderState(state = {}, input = {}, options = {}) {
  const user = options.user ?? input.user ?? state.user ?? globalThis.game?.user;
  const canReview = options.canReview === true || input.canReview === true || user?.isGM === true;
  const preview = prepareTravelV2RiskBidSelectedReviewPreview(input.session ?? state.session ?? state, { canReview });
  const safePreview = canReview ? preview : { ...preview, previews: [] };
  return { ...state, travelV2RiskBidReviewPreview: safePreview, riskBidReviewPreview: safePreview };
}
