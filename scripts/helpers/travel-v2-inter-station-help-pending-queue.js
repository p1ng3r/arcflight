import { prepareTravelV2InterStationHelpPendingRecord } from "./travel-v2-inter-station-help-pending-records.js";

export const TRAVEL_V2_INTER_STATION_HELP_PENDING_QUEUE_VERSION = 1;
export const TRAVEL_V2_INTER_STATION_HELP_QUEUE_INSERT_NOT_REQUESTED = "inter-station-help-queue-insert-not-requested";
export const TRAVEL_V2_INTER_STATION_HELP_QUEUE_DUPLICATE = "duplicate-pending-inter-station-help-queue-record";

const QUEUE_FIELD = "travelV2PendingStationBenefits";
const DUPLICATE_SUMMARY_KEYS = Object.freeze(["queueKey", "pendingHelpKey", "dedupeKey", "actionId", "authoredActionId", "title", "publicText", "playerSafeSummary", "sourceStation", "sourceStationKey", "sourceStationName", "sourceStationLabel", "targetStation", "targetStationKey", "targetStationName", "targetStationLabel", "roundIndex", "roundNumber", "resultBand", "benefitKind", "expires", "status", "tags", "criticalSuccess", "playerSafe", "playerVisible", "reviewOnly", "applyAvailable", "useAvailable", "applied", "consumed", "used"]);
const CRITICAL_METADATA_KEYS = Object.freeze(["id", "key", "title", "publicText", "strengthening", "benefitKind", "magnitude", "tags"]);

function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function cloneData(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function deepFreeze(value) { if (!value || typeof value !== "object" || Object.isFrozen(value)) return value; for (const nested of Object.values(value)) deepFreeze(nested); return Object.freeze(value); }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function uniqueStrings(values = []) { return Array.from(new Set(values.map(text).filter(Boolean))); }
function pendingRowsFrom(session = {}) { return Array.isArray(session?.[QUEUE_FIELD]) ? session[QUEUE_FIELD] : []; }
function queueIdentityFor(record = {}) { return text(record.pendingHelpKey) || text(record.dedupeKey); }
function rowMatchesIdentity(row = {}, identity = "") { return Boolean(identity) && [row.queueKey, row.pendingHelpKey, row.dedupeKey].some((value) => text(value) === identity); }
function prepareUnchangedSession(session = {}) { return isPlainObject(session) ? cloneData(session) : session; }
function safeCriticalSuccessMetadata(value = {}) {
  if (!isPlainObject(value)) return null;
  const safe = {};
  for (const key of CRITICAL_METADATA_KEYS) {
    if (!Object.hasOwn(value, key)) continue;
    if (key === "tags") safe.tags = Array.from(new Set((Array.isArray(value.tags) ? value.tags : [value.tags]).map(text).filter(Boolean)));
    else safe[key] = cloneData(value[key]);
  }
  for (const key of Object.keys(safe)) if (safe[key] === undefined || safe[key] === null || safe[key] === "" || (Array.isArray(safe[key]) && safe[key].length === 0)) delete safe[key];
  return Object.keys(safe).length > 0 ? safe : null;
}
function safeDuplicateQueueSummary(row = {}) {
  if (!isPlainObject(row)) return null;
  const summary = {};
  for (const key of DUPLICATE_SUMMARY_KEYS) {
    if (Object.hasOwn(row, key)) summary[key] = cloneData(row[key]);
  }
  const criticalSuccessMetadata = safeCriticalSuccessMetadata(row.criticalSuccessMetadata);
  if (criticalSuccessMetadata) summary.criticalSuccessMetadata = criticalSuccessMetadata;
  return summary;
}
function safeDuplicateSession(session = {}) {
  if (!isPlainObject(session)) return session;
  return { [QUEUE_FIELD]: pendingRowsFrom(session).map(safeDuplicateQueueSummary).filter(Boolean) };
}
function inertQueueRowFromRecord(record = {}) {
  const queueKey = queueIdentityFor(record);
  return {
    interStationHelpPendingQueueVersion: TRAVEL_V2_INTER_STATION_HELP_PENDING_QUEUE_VERSION,
    queueKey,
    pendingHelpKey: record.pendingHelpKey,
    dedupeKey: record.dedupeKey,
    actionId: record.actionId,
    authoredActionId: record.authoredActionId,
    title: record.title,
    publicText: record.publicText,
    playerSafeSummary: record.publicText,
    sourceStation: record.sourceStationKey,
    sourceStationKey: record.sourceStationKey,
    sourceStationName: record.sourceStationName,
    sourceStationLabel: record.sourceStationName,
    targetStation: record.targetStationKey,
    targetStationKey: record.targetStationKey,
    targetStationName: record.targetStationName,
    targetStationLabel: record.targetStationName,
    roundIndex: record.roundIndex,
    roundNumber: record.roundNumber,
    resultBand: record.resultBand,
    benefitKind: "stationOrderOpening",
    expires: "endOfRound",
    status: "pending",
    tags: Array.isArray(record.tags) ? cloneData(record.tags) : [],
    criticalSuccess: record.criticalSuccess === true,
    ...(isPlainObject(record.criticalSuccessMetadata) ? { criticalSuccessMetadata: cloneData(record.criticalSuccessMetadata) } : {}),
    playerSafe: true,
    playerVisible: true,
    readOnly: true,
    reviewOnly: true,
    applyAvailable: false,
    useAvailable: false,
    applied: false,
    consumed: false,
    used: false,
    stationCheckMutated: false,
    rollMutated: false,
    checkPreviewMutated: false
  };
}

export function queueTravelV2InterStationHelpPendingRecord(session = {}, action = {}, resultContext = {}, options = {}) {
  const enqueueRequested = options.enqueueRequested === true;
  const unchangedSession = prepareUnchangedSession(session);
  if (!enqueueRequested) {
    return deepFreeze({ version: TRAVEL_V2_INTER_STATION_HELP_PENDING_QUEUE_VERSION, ok: false, queued: false, duplicate: false, blockedReasons: [TRAVEL_V2_INTER_STATION_HELP_QUEUE_INSERT_NOT_REQUESTED], session: unchangedSession, queueField: QUEUE_FIELD, pendingRecord: null, queueRecord: null, applied: false });
  }

  const existingQueueRows = pendingRowsFrom(session);
  const preparation = prepareTravelV2InterStationHelpPendingRecord(session, action, resultContext, { ...options, existingRecords: options.existingRecords ?? resultContext?.existingRecords });
  if (!preparation.ok || !preparation.record) {
    return deepFreeze({ version: TRAVEL_V2_INTER_STATION_HELP_PENDING_QUEUE_VERSION, ok: false, queued: false, duplicate: preparation.duplicate === true, blockedReasons: cloneData(preparation.blockedReasons ?? []), session: unchangedSession, queueField: QUEUE_FIELD, pendingRecord: preparation.record ?? null, queueRecord: null, preparation, applied: false });
  }

  const identity = queueIdentityFor(preparation.record);
  const duplicateRecord = existingQueueRows.find((row) => rowMatchesIdentity(row, identity));
  if (duplicateRecord) {
    return deepFreeze({ version: TRAVEL_V2_INTER_STATION_HELP_PENDING_QUEUE_VERSION, ok: false, queued: false, duplicate: true, blockedReasons: [TRAVEL_V2_INTER_STATION_HELP_QUEUE_DUPLICATE], session: safeDuplicateSession(session), queueField: QUEUE_FIELD, pendingRecord: cloneData(preparation.record), queueRecord: null, existingQueueRecord: safeDuplicateQueueSummary(duplicateRecord), preparation, applied: false });
  }

  const queueRecord = inertQueueRowFromRecord(preparation.record);
  const nextSession = { ...(isPlainObject(session) ? cloneData(session) : {}), [QUEUE_FIELD]: [...existingQueueRows.map(cloneData), queueRecord] };
  return deepFreeze({ version: TRAVEL_V2_INTER_STATION_HELP_PENDING_QUEUE_VERSION, ok: true, queued: true, duplicate: false, blockedReasons: uniqueStrings(preparation.blockedReasons ?? []), session: nextSession, queueField: QUEUE_FIELD, pendingRecord: cloneData(preparation.record), queueRecord: cloneData(queueRecord), preparation, applied: false });
}

export default queueTravelV2InterStationHelpPendingRecord;
