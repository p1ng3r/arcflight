export const TRAVEL_V2_RISK_BID_QUEUE_INSERTION_INTENT_VERSION = 1;

const INTENT_MODES = Object.freeze(["none", "prepare", "confirm"]);
const RISK_BID_QUEUE_INSERTION_SOURCE = "riskBidResult";
const RISK_BID_QUEUE_INSERTION_REQUEST_TYPE = "riskBidReviewQueueInsertion";

const TOP_LEVEL_KEYS = Object.freeze([
  "version",
  "ok",
  "available",
  "prepared",
  "confirmed",
  "inserted",
  "blockedReasons",
  "intentMode",
  "resultBand",
  "tier",
  "dcModifier",
  "dangerLevel",
  "stationKey",
  "stationName",
  "actionId",
  "actionName",
  "roundIndex",
  "roundNumber",
  "insertionRequest",
  "gmReviewRequired"
]);

const INSERTION_REQUEST_KEYS = Object.freeze([
  "requestVersion",
  "source",
  "requestType",
  "intentMode",
  "reviewPayloadCount",
  "payloadTypes",
  "candidateTypes",
  "resultBand",
  "tier",
  "dcModifier",
  "dangerLevel",
  "stationKey",
  "stationName",
  "actionId",
  "actionName",
  "roundIndex",
  "roundNumber",
  "reviewPayloads",
  "queueInsertionReady",
  "inserted"
]);

const REVIEW_PAYLOAD_KEYS = Object.freeze([
  "adapterVersion",
  "source",
  "payloadType",
  "candidateType",
  "severity",
  "tier",
  "resultBand",
  "dangerLevel",
  "stationKey",
  "stationName",
  "actionId",
  "actionName",
  "roundIndex",
  "roundNumber",
  "label",
  "text",
  "requiresReview",
  "queueReady"
]);

const FORBIDDEN_OUTPUT_TERMS = Object.freeze([
  "gmOnly",
  "secret",
  "hiddenHazards",
  "unrevealedHazard",
  "futureTriggers",
  "internalScoring",
  "debugReport",
  "auditRecord",
  "applyPayload",
  "actorUuid",
  "targetActorUuid",
  "userId",
  "userName",
  "updateData",
  "actor.update",
  "ChatMessage",
  "JournalEntry",
  "socket",
  "Compendium.",
  "Actor.",
  "Item."
]);

function unsafeOutputString(value) {
  if (typeof value !== "string") return false;
  return FORBIDDEN_OUTPUT_TERMS.some((term) => value.includes(term));
}

function safeString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return unsafeOutputString(trimmed) ? fallback : trimmed;
}

function safeIntegerOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && Number.isFinite(number) ? number : null;
}

function safeRiskBidTierOrNull(value) {
  if (typeof value === "string" && unsafeOutputString(value)) return null;
  const number = safeIntegerOrNull(value);
  return [2, 5, 8].includes(number) ? number : null;
}

function freezeOutput(value) {
  if (Array.isArray(value)) {
    for (const entry of value) freezeOutput(entry);
  } else if (value && typeof value === "object") {
    for (const entry of Object.values(value)) freezeOutput(entry);
  }
  return Object.freeze(value);
}

export function normalizeTravelV2RiskBidQueueInsertionIntentMode(value) {
  const normalized = safeString(value);
  return INTENT_MODES.includes(normalized) ? normalized : "none";
}

export function isTravelV2RiskBidQueueInsertionIntentMode(value) {
  return safeString(value) === normalizeTravelV2RiskBidQueueInsertionIntentMode(value);
}

function pendingReviewFromInput(input) {
  if (!input || typeof input !== "object") return null;
  if (input.pendingReview && typeof input.pendingReview === "object") return input.pendingReview;
  return input;
}

function contextFromPendingReview(pendingReview) {
  return {
    resultBand: safeString(pendingReview?.resultBand) || null,
    tier: safeRiskBidTierOrNull(pendingReview?.tier),
    dcModifier: safeRiskBidTierOrNull(pendingReview?.dcModifier),
    dangerLevel: safeString(pendingReview?.dangerLevel) || "none",
    stationKey: safeString(pendingReview?.stationKey),
    stationName: safeString(pendingReview?.stationName),
    actionId: safeString(pendingReview?.actionId),
    actionName: safeString(pendingReview?.actionName),
    roundIndex: safeIntegerOrNull(pendingReview?.roundIndex),
    roundNumber: safeIntegerOrNull(pendingReview?.roundNumber)
  };
}

function sanitizeReviewPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  return {
    adapterVersion: safeIntegerOrNull(payload.adapterVersion),
    source: safeString(payload.source),
    payloadType: safeString(payload.payloadType),
    candidateType: safeString(payload.candidateType),
    severity: safeString(payload.severity, "standard") || "standard",
    tier: safeRiskBidTierOrNull(payload.tier),
    resultBand: safeString(payload.resultBand) || null,
    dangerLevel: safeString(payload.dangerLevel) || "none",
    stationKey: safeString(payload.stationKey),
    stationName: safeString(payload.stationName),
    actionId: safeString(payload.actionId),
    actionName: safeString(payload.actionName),
    roundIndex: safeIntegerOrNull(payload.roundIndex),
    roundNumber: safeIntegerOrNull(payload.roundNumber),
    label: safeString(payload.label, "Risk bid review payload"),
    text: safeString(payload.text, "Reviewed risk bid payload requires GM review."),
    requiresReview: payload.requiresReview === false ? false : true,
    queueReady: payload.queueReady === true
  };
}

function baseOutput(pendingReview, intentMode, blockedReasons) {
  const context = contextFromPendingReview(pendingReview);
  return freezeOutput({
    version: TRAVEL_V2_RISK_BID_QUEUE_INSERTION_INTENT_VERSION,
    ok: false,
    available: false,
    prepared: false,
    confirmed: false,
    inserted: false,
    blockedReasons: Array.from(new Set(blockedReasons)),
    intentMode,
    ...context,
    insertionRequest: null,
    gmReviewRequired: false
  });
}

export function prepareTravelV2RiskBidQueueInsertionIntent(input = {}, options = {}) {
  const pendingReview = pendingReviewFromInput(input);
  const intentMode = normalizeTravelV2RiskBidQueueInsertionIntentMode(options?.intentMode ?? input?.intentMode);
  if (options?.canReview !== true) return baseOutput(pendingReview, intentMode, ["travel-v2-review-permission-required"]);
  if (intentMode === "none") return baseOutput(pendingReview, intentMode, ["risk-bid-queue-insertion-intent-required"]);
  if (!pendingReview || typeof pendingReview !== "object") return baseOutput(null, intentMode, ["missing-risk-bid-pending-review"]);
  if (pendingReview.ok !== true) return baseOutput(pendingReview, intentMode, ["risk-bid-pending-review-not-ok"]);
  if (pendingReview.hasReviewPayloads !== true) return baseOutput(pendingReview, intentMode, ["missing-review-payloads"]);
  if (pendingReview.queueReady !== true) return baseOutput(pendingReview, intentMode, ["risk-bid-pending-review-not-queue-ready"]);
  if (pendingReview.inserted === true) return baseOutput(pendingReview, intentMode, ["risk-bid-pending-review-already-inserted"]);
  if (!Array.isArray(pendingReview.reviewPayloads) || pendingReview.reviewPayloads.length === 0) return baseOutput(pendingReview, intentMode, ["missing-review-payloads"]);

  const context = contextFromPendingReview(pendingReview);
  const reviewPayloads = pendingReview.reviewPayloads.map((payload) => sanitizeReviewPayload(payload)).filter(Boolean);
  if (reviewPayloads.length === 0) return baseOutput(pendingReview, intentMode, ["missing-review-payloads"]);

  const insertionRequest = {
    requestVersion: TRAVEL_V2_RISK_BID_QUEUE_INSERTION_INTENT_VERSION,
    source: RISK_BID_QUEUE_INSERTION_SOURCE,
    requestType: RISK_BID_QUEUE_INSERTION_REQUEST_TYPE,
    intentMode,
    reviewPayloadCount: reviewPayloads.length,
    payloadTypes: Array.from(new Set(reviewPayloads.map((payload) => payload.payloadType).filter(Boolean))),
    candidateTypes: Array.from(new Set(reviewPayloads.map((payload) => payload.candidateType).filter(Boolean))),
    ...context,
    reviewPayloads,
    queueInsertionReady: true,
    inserted: false
  };
  for (const key of Object.keys(insertionRequest)) {
    if (!INSERTION_REQUEST_KEYS.includes(key)) delete insertionRequest[key];
  }

  const output = {
    version: TRAVEL_V2_RISK_BID_QUEUE_INSERTION_INTENT_VERSION,
    ok: true,
    available: true,
    prepared: true,
    confirmed: intentMode === "confirm",
    inserted: false,
    blockedReasons: [],
    intentMode,
    ...context,
    insertionRequest,
    gmReviewRequired: pendingReview.gmReviewRequired === true
  };
  for (const key of Object.keys(output)) {
    if (!TOP_LEVEL_KEYS.includes(key)) delete output[key];
  }
  return freezeOutput(output);
}
