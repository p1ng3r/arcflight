export const TRAVEL_V2_RISK_BID_REVIEW_QUEUE_VERSION = 1;

const QUEUE_RECORD_STATUSES = Object.freeze(["pending", "reviewed", "dismissed", "applied"]);
const QUEUE_SOURCE = "riskBidResult";
const QUEUE_SESSION_KEY = "travelV2RiskBidReviewQueue";
const SAFE_LABEL_FALLBACK = "Risk bid review";
const SAFE_TEXT_FALLBACK = "Risk bid review requires GM decision.";
const RECORD_KEYS = Object.freeze([
  "queueVersion",
  "queueKey",
  "source",
  "status",
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
  "queueReady",
  "insertedAt",
  "insertionRequestKey"
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
function cloneSession(session) {
  if (!session || typeof session !== "object") return {};
  if (typeof structuredClone === "function") return structuredClone(session);
  return JSON.parse(JSON.stringify(session));
}
function freezeOutput(value) {
  if (Array.isArray(value)) for (const entry of value) freezeOutput(entry);
  else if (value && typeof value === "object") for (const entry of Object.values(value)) freezeOutput(entry);
  return Object.freeze(value);
}

export function normalizeTravelV2RiskBidReviewQueueRecordStatus(value) {
  const normalized = safeString(value);
  return QUEUE_RECORD_STATUSES.includes(normalized) ? normalized : "";
}

export function isTravelV2RiskBidReviewQueueRecordStatus(value) {
  return typeof value === "string" && QUEUE_RECORD_STATUSES.includes(value) && normalizeTravelV2RiskBidReviewQueueRecordStatus(value) === value;
}

function deterministicInsertedAt(request, index) {
  const roundNumber = safeIntegerOrNull(request?.roundNumber) ?? 0;
  return `risk-bid-review:${roundNumber}:${index}`;
}
function makeInsertionRequestKey(request) {
  return ["risk-bid", safeIntegerOrNull(request?.roundNumber) ?? 0, safeString(request?.stationKey, "station"), safeString(request?.actionId, "action")].join(":");
}
function makeQueueKey(payload, request, index) {
  return [
    "risk-bid",
    safeIntegerOrNull(payload?.roundNumber) ?? safeIntegerOrNull(request?.roundNumber) ?? 0,
    safeString(payload?.stationKey) || safeString(request?.stationKey) || "station",
    safeString(payload?.actionId) || safeString(request?.actionId) || "action",
    safeString(payload?.payloadType, "review"),
    index
  ].join(":");
}

export function prepareTravelV2RiskBidReviewQueueRecord(input = {}, options = {}) {
  const request = options?.insertionRequest && typeof options.insertionRequest === "object" ? options.insertionRequest : {};
  const index = safeIntegerOrNull(options?.index) ?? 0;
  const recordStatus = options?.status === undefined ? "pending" : normalizeTravelV2RiskBidReviewQueueRecordStatus(options.status) || "pending";
  const record = {
    queueVersion: TRAVEL_V2_RISK_BID_REVIEW_QUEUE_VERSION,
    queueKey: safeString(options?.queueKey) || makeQueueKey(input, request, index),
    source: QUEUE_SOURCE,
    status: recordStatus,
    payloadType: safeString(input?.payloadType),
    candidateType: safeString(input?.candidateType),
    severity: safeString(input?.severity, "standard") || "standard",
    tier: safeRiskBidTierOrNull(input?.tier),
    resultBand: safeString(input?.resultBand) || safeString(request?.resultBand) || null,
    dangerLevel: safeString(input?.dangerLevel) || safeString(request?.dangerLevel) || "none",
    stationKey: safeString(input?.stationKey) || safeString(request?.stationKey),
    stationName: safeString(input?.stationName) || safeString(request?.stationName),
    actionId: safeString(input?.actionId) || safeString(request?.actionId),
    actionName: safeString(input?.actionName) || safeString(request?.actionName),
    roundIndex: safeIntegerOrNull(input?.roundIndex) ?? safeIntegerOrNull(request?.roundIndex),
    roundNumber: safeIntegerOrNull(input?.roundNumber) ?? safeIntegerOrNull(request?.roundNumber),
    label: safeString(input?.label, SAFE_LABEL_FALLBACK) || SAFE_LABEL_FALLBACK,
    text: safeString(input?.text, SAFE_TEXT_FALLBACK) || SAFE_TEXT_FALLBACK,
    requiresReview: input?.requiresReview === false ? false : true,
    queueReady: true,
    insertedAt: safeString(options?.insertedAt ?? input?.insertedAt) || deterministicInsertedAt(request, index),
    insertionRequestKey: safeString(options?.insertionRequestKey ?? input?.insertionRequestKey) || makeInsertionRequestKey(request)
  };
  for (const key of Object.keys(record)) if (!RECORD_KEYS.includes(key)) delete record[key];
  return freezeOutput(record);
}

function sanitizeExistingQueueRecord(record, index) {
  if (!record || typeof record !== "object") return prepareTravelV2RiskBidReviewQueueRecord({}, { index });
  return prepareTravelV2RiskBidReviewQueueRecord(record, {
    index,
    queueKey: safeString(record.queueKey),
    status: record.status,
    insertedAt: record.insertedAt,
    insertionRequestKey: record.insertionRequestKey
  });
}

export function prepareTravelV2RiskBidReviewQueueState(session = {}, options = {}) {
  const sourceQueue = options?.queue && typeof options.queue === "object" ? options.queue : session?.[QUEUE_SESSION_KEY];
  const records = Array.isArray(sourceQueue?.records) ? sourceQueue.records.map((record, index) => sanitizeExistingQueueRecord(record, index)) : [];
  const counts = { pendingCount: 0, reviewedCount: 0, dismissedCount: 0, appliedCount: 0 };
  for (const record of records) {
    const status = normalizeTravelV2RiskBidReviewQueueRecordStatus(record?.status) || "pending";
    counts[`${status}Count`] += 1;
  }
  return freezeOutput({
    version: TRAVEL_V2_RISK_BID_REVIEW_QUEUE_VERSION,
    records,
    ...counts,
    insertedCount: records.length
  });
}

function baseResult(session, blockedReasons) {
  const sessionCopy = cloneSession(session);
  const queue = prepareTravelV2RiskBidReviewQueueState(sessionCopy);
  sessionCopy[QUEUE_SESSION_KEY] = queue;
  return freezeOutput({
    version: TRAVEL_V2_RISK_BID_REVIEW_QUEUE_VERSION,
    ok: false,
    inserted: false,
    insertedCount: 0,
    skippedCount: 0,
    duplicateCount: 0,
    blockedReasons: Array.from(new Set(blockedReasons)),
    queue,
    insertedRecords: [],
    skippedRecords: [],
    session: sessionCopy,
    sessionPatch: {},
    applied: false
  });
}

export function insertTravelV2RiskBidReviewQueueRecords(session = {}, insertionIntent = {}, options = {}) {
  if (options?.canReview !== true) return baseResult(session, ["travel-v2-review-permission-required"]);
  if (!insertionIntent || typeof insertionIntent !== "object" || Object.keys(insertionIntent).length === 0) return baseResult(session, ["missing-risk-bid-queue-insertion-intent"]);
  if (insertionIntent.ok !== true) return baseResult(session, ["risk-bid-queue-insertion-intent-not-ok"]);
  if (insertionIntent.confirmed !== true) return baseResult(session, ["risk-bid-queue-insertion-intent-not-confirmed"]);
  if (insertionIntent.inserted === true) return baseResult(session, ["risk-bid-queue-insertion-intent-already-inserted"]);
  const request = insertionIntent.insertionRequest;
  if (!request || typeof request !== "object") return baseResult(session, ["missing-risk-bid-queue-insertion-request"]);
  if (request.queueInsertionReady !== true) return baseResult(session, ["risk-bid-queue-insertion-request-not-ready"]);
  if (request.inserted === true) return baseResult(session, ["risk-bid-queue-insertion-request-already-inserted"]);
  if (!Array.isArray(request.reviewPayloads) || request.reviewPayloads.length === 0) return baseResult(session, ["missing-risk-bid-review-payloads"]);

  const sessionCopy = cloneSession(session);
  const existingQueue = prepareTravelV2RiskBidReviewQueueState(sessionCopy);
  const records = existingQueue.records.map((record) => ({ ...record }));
  const existingKeys = new Set(records.map((record) => safeString(record?.queueKey)).filter(Boolean));
  const insertedRecords = [];
  const skippedRecords = [];
  let duplicateCount = 0;
  request.reviewPayloads.forEach((payload, index) => {
    const queueKey = makeQueueKey(payload, request, index);
    const record = prepareTravelV2RiskBidReviewQueueRecord(payload, { index, queueKey, insertionRequest: request });
    if (existingKeys.has(queueKey)) {
      duplicateCount += 1;
      skippedRecords.push(record);
      return;
    }
    existingKeys.add(queueKey);
    records.push(record);
    insertedRecords.push(record);
  });
  const queue = prepareTravelV2RiskBidReviewQueueState(sessionCopy, { queue: { records } });
  sessionCopy[QUEUE_SESSION_KEY] = queue;
  const sessionPatch = { [QUEUE_SESSION_KEY]: queue };
  return freezeOutput({
    version: TRAVEL_V2_RISK_BID_REVIEW_QUEUE_VERSION,
    ok: true,
    inserted: insertedRecords.length > 0,
    insertedCount: insertedRecords.length,
    skippedCount: skippedRecords.length,
    duplicateCount,
    blockedReasons: [],
    queue,
    insertedRecords,
    skippedRecords,
    session: sessionCopy,
    sessionPatch,
    applied: false
  });
}
