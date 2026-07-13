import { prepareTravelV2InterStationHelpActions } from "./travel-v2-inter-station-help-actions.js";

export const TRAVEL_V2_INTER_STATION_HELP_PENDING_RECORDS_VERSION = 1;

const SUCCESS_RESULTS = new Set(["success", "criticalSuccess"]);
const CRITICAL_SUCCESS_RESULTS = new Set(["criticalSuccess"]);
const FORBIDDEN_KEYS = new Set(["auditRecord", "commitRecords", "userId", "userName", "gmText", "gmSummary", "gmMechanicalNotes", "applyPayload", "targetActorUuid", "targetActorId", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions", "hiddenData", "socketPayload"]);
const DUPLICATE_SUMMARY_KEYS = Object.freeze(["pendingHelpKey", "dedupeKey", "actionId", "authoredActionId", "title", "publicText", "sourceStationKey", "sourceStationName", "targetStationKey", "targetStationName", "roundIndex", "roundNumber", "resultBand", "tags", "status", "applied", "consumed", "criticalSuccess"]);
const CRITICAL_METADATA_KEYS = Object.freeze(["id", "key", "title", "publicText", "strengthening", "benefitKind", "magnitude", "tags"]);

function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function cloneData(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function deepFreeze(value) { if (!value || typeof value !== "object" || Object.isFrozen(value)) return value; for (const nested of Object.values(value)) deepFreeze(nested); return Object.freeze(value); }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function uniqueStrings(values = []) { return Array.from(new Set(values.map(text).filter(Boolean))); }
function scrubForbidden(value) {
  if (Array.isArray(value)) return value.map(scrubForbidden);
  if (!isPlainObject(value)) return value;
  const next = {};
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    next[key] = scrubForbidden(nested);
  }
  return next;
}
function stablePart(value) { const raw = value === null || value === undefined ? "" : String(value).trim(); return raw.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "none"; }
function existingRecordsFrom(value = {}) {
  if (Array.isArray(value)) return value;
  if (!isPlainObject(value)) return [];
  for (const key of ["records", "items", "rows", "pendingHelpRecords", "travelV2PendingInterStationHelpRecords"]) if (Array.isArray(value[key])) return value[key];
  return [];
}
function resultBandFrom(context = {}) { return text(context.resultBand ?? context.result ?? context.outcome ?? context.degreeOfSuccess); }
function integerOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}
function sameIfBothPresent(left, right) { return !text(left) || !text(right) || text(left) === text(right); }
function sameIntegerIfBothPresent(left, right) {
  const leftNumber = integerOrNull(left);
  const rightNumber = integerOrNull(right);
  return leftNumber === null || rightNumber === null || leftNumber === rightNumber;
}
function safeCriticalSuccessMetadata(value = {}) {
  if (!isPlainObject(value)) return null;
  const scrubbed = scrubForbidden(value);
  const safe = {};
  for (const key of CRITICAL_METADATA_KEYS) {
    if (!Object.hasOwn(scrubbed, key)) continue;
    if (key === "tags") safe.tags = uniqueStrings(Array.isArray(scrubbed.tags) ? scrubbed.tags : [scrubbed.tags]);
    else safe[key] = cloneData(scrubbed[key]);
  }
  for (const key of Object.keys(safe)) if (safe[key] === undefined || safe[key] === null || safe[key] === "" || (Array.isArray(safe[key]) && safe[key].length === 0)) delete safe[key];
  return Object.keys(safe).length > 0 ? safe : null;
}
function safeDuplicateSummary(record = {}) {
  if (!isPlainObject(record)) return null;
  const summary = {};
  for (const key of DUPLICATE_SUMMARY_KEYS) if (Object.hasOwn(record, key)) summary[key] = cloneData(record[key]);
  const metadata = safeCriticalSuccessMetadata(record.criticalSuccessMetadata);
  if (metadata) summary.criticalSuccessMetadata = metadata;
  return summary;
}
function contextValue(context = {}, ...keys) {
  for (const key of keys) {
    const value = context?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

export function prepareTravelV2InterStationHelpPendingRecord(session = {}, action = {}, resultContext = {}, options = {}) {
  const blockedReasons = [];
  const warnings = [];
  if (!isPlainObject(session) || Object.keys(session).length === 0) blockedReasons.push("travel-v2-session-required");
  if (!isPlainObject(action) || Object.keys(action).length === 0) blockedReasons.push("inter-station-help-action-required");
  if (!isPlainObject(resultContext)) blockedReasons.push("inter-station-help-result-context-required");

  const actionRoundIndex = integerOrNull(action?.roundIndex);
  const resultRoundIndex = integerOrNull(resultContext?.roundIndex);
  if (actionRoundIndex === null) blockedReasons.push("missing-action-round-context");
  if (!sameIntegerIfBothPresent(action?.roundIndex, resultContext?.roundIndex)) blockedReasons.push("round-context-mismatch");
  const requestedRoundIndex = resultRoundIndex ?? actionRoundIndex ?? integerOrNull(options.roundIndex);
  const prepared = prepareTravelV2InterStationHelpActions(session, { ...options, roundIndex: requestedRoundIndex ?? options.roundIndex, includeUnavailable: true });
  const roundIndex = requestedRoundIndex ?? prepared.roundIndex;

  const actionSourceStationKey = text(action.sourceStationKey);
  const actionTargetStationKey = text(action.targetStationKey);
  const actionId = text(action.actionId);
  const contextSourceStationKey = text(contextValue(resultContext, "sourceStationKey", "sourceStation"));
  const contextTargetStationKey = text(contextValue(resultContext, "targetStationKey", "targetStation"));
  const contextActionId = text(contextValue(resultContext, "actionId", "authoredActionId"));
  const sourceStationKey = actionSourceStationKey || contextSourceStationKey;
  const targetStationKey = actionTargetStationKey || contextTargetStationKey;
  const selectedActionId = actionId || contextActionId;
  const resultBand = resultBandFrom(resultContext);

  if (!sameIfBothPresent(actionSourceStationKey, contextSourceStationKey)) blockedReasons.push("inter-station-help-source-context-mismatch");
  if (!sameIfBothPresent(actionTargetStationKey, contextTargetStationKey)) blockedReasons.push("inter-station-help-target-context-mismatch");
  if (!sameIfBothPresent(actionId, contextActionId)) blockedReasons.push("inter-station-help-action-context-mismatch");
  if (!SUCCESS_RESULTS.has(resultBand)) blockedReasons.push("inter-station-help-result-not-successful");
  if (!sourceStationKey) blockedReasons.push("missing-source-station");
  if (!targetStationKey) blockedReasons.push("missing-target-station");
  if (sourceStationKey && targetStationKey && sourceStationKey === targetStationKey) blockedReasons.push("target-station-self");
  if (!selectedActionId) blockedReasons.push("missing-action-id");
  if (Number(roundIndex) !== Number(prepared.roundIndex)) blockedReasons.push("round-context-mismatch");
  if (prepared.stationOrderLocked !== true) blockedReasons.push("station-order-not-locked");

  const matched = prepared.helpActions.find((row) => row.actionId === selectedActionId && row.sourceStationKey === sourceStationKey && row.targetStationKey === targetStationKey && Number(row.roundIndex) === Number(roundIndex));
  if (!matched) blockedReasons.push("inter-station-help-action-not-prepared-for-round");
  if (matched && actionRoundIndex !== null && Number(actionRoundIndex) !== Number(matched.roundIndex)) blockedReasons.push("round-context-mismatch");
  if (matched && matched.available !== true) blockedReasons.push("target-station-not-later-in-order");
  if (matched && matched.targetLaterInOrder !== true) blockedReasons.push("target-station-not-later-in-order");
  if (matched && !prepared.stationOrder.includes(sourceStationKey)) blockedReasons.push("source-station-inactive");
  if (matched && !prepared.stationOrder.includes(targetStationKey)) blockedReasons.push("target-station-inactive");

  const dedupeKey = ["inter-station-help", roundIndex, selectedActionId, sourceStationKey, targetStationKey].map(stablePart).join(":");
  const existingRecords = existingRecordsFrom(options.existingRecords ?? resultContext?.existingRecords ?? session?.travelV2PendingInterStationHelpRecords);
  const duplicateRecord = existingRecords.find((record) => text(record?.dedupeKey) === dedupeKey || text(record?.pendingHelpKey) === dedupeKey);
  if (duplicateRecord) blockedReasons.push("duplicate-pending-inter-station-help-record");

  const criticalSuccessMetadata = CRITICAL_SUCCESS_RESULTS.has(resultBand) && matched ? safeCriticalSuccessMetadata(matched.criticalSuccessMetadata) : null;
  const record = blockedReasons.length === 0 ? scrubForbidden({
    version: TRAVEL_V2_INTER_STATION_HELP_PENDING_RECORDS_VERSION,
    pendingHelpKey: dedupeKey,
    dedupeKey,
    actionId: matched.actionId,
    title: matched.title,
    publicText: matched.publicText,
    sourceStationKey: matched.sourceStationKey,
    sourceStationName: matched.sourceStationName,
    targetStationKey: matched.targetStationKey,
    targetStationName: matched.targetStationName,
    roundIndex: matched.roundIndex,
    roundNumber: matched.roundNumber,
    resultBand,
    tags: uniqueStrings(Array.isArray(matched.tags) ? matched.tags : []),
    authoredActionId: matched.actionId,
    status: "pending",
    applied: false,
    consumed: false,
    playerSafe: true,
    readOnly: true,
    reviewOnly: true,
    criticalSuccess: CRITICAL_SUCCESS_RESULTS.has(resultBand),
    ...(criticalSuccessMetadata ? { criticalSuccessMetadata } : {})
  }) : null;

  return deepFreeze({
    version: TRAVEL_V2_INTER_STATION_HELP_PENDING_RECORDS_VERSION,
    ok: blockedReasons.length === 0,
    duplicate: Boolean(duplicateRecord),
    blockedReasons: uniqueStrings(blockedReasons),
    warnings: uniqueStrings([...warnings, ...(prepared.warnings ?? [])]),
    dedupeKey,
    record: cloneData(record),
    existingRecord: duplicateRecord ? safeDuplicateSummary(duplicateRecord) : null,
    applied: false
  });
}

export default prepareTravelV2InterStationHelpPendingRecord;
