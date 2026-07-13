import { prepareTravelV2InterStationHelpActions } from "./travel-v2-inter-station-help-actions.js";

export const TRAVEL_V2_INTER_STATION_HELP_PENDING_RECORDS_VERSION = 1;

const SUCCESS_RESULTS = new Set(["success", "criticalSuccess"]);
const CRITICAL_SUCCESS_RESULTS = new Set(["criticalSuccess"]);
const FORBIDDEN_KEYS = new Set(["auditRecord", "commitRecords", "userId", "userName", "gmText", "gmSummary", "gmMechanicalNotes", "applyPayload", "targetActorUuid", "targetActorId", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions", "hiddenData", "socketPayload"]);

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
function authoredCriticalMetadata(action = {}, context = {}) {
  const authored = action.criticalSuccess ?? action.criticalSuccessMetadata ?? action.criticalSuccessStrengthening ?? context.criticalSuccess ?? context.criticalSuccessMetadata ?? null;
  if (!isPlainObject(authored)) return null;
  return scrubForbidden(cloneData(authored));
}

export function prepareTravelV2InterStationHelpPendingRecord(session = {}, action = {}, resultContext = {}, options = {}) {
  const blockedReasons = [];
  const warnings = [];
  if (!isPlainObject(session) || Object.keys(session).length === 0) blockedReasons.push("travel-v2-session-required");
  if (!isPlainObject(action) || Object.keys(action).length === 0) blockedReasons.push("inter-station-help-action-required");
  if (!isPlainObject(resultContext)) blockedReasons.push("inter-station-help-result-context-required");

  const prepared = prepareTravelV2InterStationHelpActions(session, { ...options, roundIndex: resultContext?.roundIndex ?? action?.roundIndex ?? options.roundIndex, includeUnavailable: true });
  const roundIndex = Number.isInteger(Number(resultContext?.roundIndex ?? action?.roundIndex ?? prepared.roundIndex)) ? Number(resultContext?.roundIndex ?? action?.roundIndex ?? prepared.roundIndex) : prepared.roundIndex;
  const sourceStationKey = text(action.sourceStationKey);
  const targetStationKey = text(resultContext?.targetStationKey ?? action.targetStationKey);
  const actionId = text(action.actionId ?? resultContext?.actionId);
  const resultBand = resultBandFrom(resultContext);

  if (!SUCCESS_RESULTS.has(resultBand)) blockedReasons.push("inter-station-help-result-not-successful");
  if (!sourceStationKey) blockedReasons.push("missing-source-station");
  if (!targetStationKey) blockedReasons.push("missing-target-station");
  if (sourceStationKey && targetStationKey && sourceStationKey === targetStationKey) blockedReasons.push("target-station-self");
  if (!actionId) blockedReasons.push("missing-action-id");
  if (Number(roundIndex) !== Number(prepared.roundIndex)) blockedReasons.push("round-context-mismatch");

  const matched = prepared.helpActions.find((row) => row.actionId === actionId && row.sourceStationKey === sourceStationKey && row.targetStationKey === targetStationKey);
  if (!matched) blockedReasons.push("inter-station-help-action-not-prepared-for-round");
  if (matched && matched.available !== true) blockedReasons.push("target-station-not-later-in-order");
  if (matched && matched.targetLaterInOrder !== true) blockedReasons.push("target-station-not-later-in-order");
  if (matched && !prepared.stationOrder.includes(sourceStationKey)) blockedReasons.push("source-station-inactive");
  if (matched && !prepared.stationOrder.includes(targetStationKey)) blockedReasons.push("target-station-inactive");

  const dedupeKey = ["inter-station-help", roundIndex, actionId, sourceStationKey, targetStationKey].map(stablePart).join(":");
  const existingRecords = existingRecordsFrom(options.existingRecords ?? resultContext?.existingRecords ?? session?.travelV2PendingInterStationHelpRecords);
  const duplicateRecord = existingRecords.find((record) => text(record?.dedupeKey) === dedupeKey || text(record?.pendingHelpKey) === dedupeKey);
  if (duplicateRecord) blockedReasons.push("duplicate-pending-inter-station-help-record");

  const criticalSuccessMetadata = CRITICAL_SUCCESS_RESULTS.has(resultBand) ? authoredCriticalMetadata(action, resultContext) : null;
  const record = blockedReasons.length === 0 ? scrubForbidden({
    version: TRAVEL_V2_INTER_STATION_HELP_PENDING_RECORDS_VERSION,
    pendingHelpKey: dedupeKey,
    dedupeKey,
    actionId,
    title: text(action.title) || matched.title,
    publicText: text(action.publicText) || matched.publicText,
    sourceStationKey,
    sourceStationName: text(action.sourceStationName) || matched.sourceStationName,
    targetStationKey,
    targetStationName: text(action.targetStationName) || matched.targetStationName,
    roundIndex,
    roundNumber: prepared.roundNumber,
    resultBand,
    tags: uniqueStrings([...(Array.isArray(matched.tags) ? matched.tags : []), ...(Array.isArray(action.tags) ? action.tags : [])]),
    authoredActionId: actionId,
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
    existingRecord: duplicateRecord ? scrubForbidden(cloneData(duplicateRecord)) : null,
    applied: false
  });
}

export default prepareTravelV2InterStationHelpPendingRecord;
