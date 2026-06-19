import { prepareTravelV2RunnerCurrentRoundPreviewState } from "./travel-v2-preview-state.js";
import { TRAVEL_V2_ROUND_OUTCOME_KEYS } from "./travel-v2-round-pressure-adapter.js";

export const TRAVEL_V2_PRESSURE_APPLICATION_STATE_VERSION = 1;

const APPLICATION_RECORD_COLLECTION_KEYS = Object.freeze([
  "travelV2PressureApplications",
  "travelV2PressureApplicationRecords",
  "pressureApplicationRecords",
  "pressureApplications"
]);

const APPLICATION_RECORD_ROUND_KEYS = Object.freeze([
  "travelV2PressureApplication",
  "travelV2PressureApplicationRecord",
  "pressureApplication",
  "pressureApplicationRecord"
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneData(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!isPlainObject(value) && !Array.isArray(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function isCompletedSession(session = {}) {
  return session?.status === "completed" || session?.completed === true || Boolean(session?.completedAt && session?.status !== "active");
}

function copyRow(row = {}) {
  return {
    outcomeKey: row.outcomeKey ?? "",
    outcomeLabel: row.outcomeLabel ?? "",
    ok: row.ok === true,
    requestCount: Number(row.requestCount) || 0,
    hasRequests: row.hasRequests === true,
    requests: cloneData(Array.isArray(row.requests) ? row.requests : []),
    totalsByPressureType: cloneData(isPlainObject(row.totalsByPressureType) ? row.totalsByPressureType : {}),
    summaryText: typeof row.summaryText === "string" ? row.summaryText : "",
    errors: cloneData(Array.isArray(row.errors) ? row.errors : [])
  };
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function roundMatchesRecord(record = {}, roundIndex, roundNumber) {
  if (!isPlainObject(record)) return false;
  const recordRoundIndex = Number(record.roundIndex);
  if (Number.isInteger(recordRoundIndex) && recordRoundIndex === roundIndex) return true;
  const recordRoundNumber = positiveIntegerOrNull(record.roundNumber ?? record.round);
  return roundNumber !== null && recordRoundNumber === roundNumber;
}

function findApplicationRecord(session = {}, roundIndex = -1, roundNumber = null) {
  if (!isPlainObject(session) || roundIndex < 0) return null;
  const rounds = Array.isArray(session.event?.rounds) ? session.event.rounds : [];
  const currentRound = isPlainObject(rounds[roundIndex]) ? rounds[roundIndex] : null;

  for (const key of APPLICATION_RECORD_ROUND_KEYS) {
    const record = currentRound?.[key];
    if (isPlainObject(record)) return record;
  }

  for (const key of APPLICATION_RECORD_COLLECTION_KEYS) {
    const container = session[key];
    const records = Array.isArray(container) ? container : (Array.isArray(container?.records) ? container.records : []);
    const record = records.find((entry) => roundMatchesRecord(entry, roundIndex, roundNumber));
    if (record) return record;
  }

  return null;
}

function footerTextFor(blockedReasons = [], canApply = false) {
  if (canApply) return "Ready to apply the selected preview outcome later. This state helper is read-only and does not apply pressure.";
  if (blockedReasons.length > 0) return blockedReasons[0];
  return "Pressure application is unavailable for this runner state.";
}

export function prepareTravelV2PressureApplicationState(session, options = {}) {
  const hasSession = isPlainObject(session);
  const preview = hasSession ? prepareTravelV2RunnerCurrentRoundPreviewState(session, options) : null;
  const rows = Array.isArray(preview?.rows) ? preview.rows.map(copyRow) : [];
  const roundIndex = Number.isInteger(Number(preview?.roundIndex)) ? Number(preview.roundIndex) : -1;
  const roundNumber = positiveIntegerOrNull(preview?.roundNumber);
  const isCompleted = hasSession ? isCompletedSession(session) : false;
  const hasCurrentRound = hasSession && roundIndex >= 0;
  const previewAvailable = preview?.ok === true && rows.length > 0;
  const validOutcomeKeys = new Set(rows.map((row) => row.outcomeKey));
  const selectedOutcomeKey = typeof options.selectedOutcomeKey === "string" && options.selectedOutcomeKey.trim()
    ? options.selectedOutcomeKey.trim()
    : TRAVEL_V2_ROUND_OUTCOME_KEYS.MIXED;
  const selectedRow = rows.find((row) => row.outcomeKey === selectedOutcomeKey) ?? null;
  const applicationRecordSource = findApplicationRecord(session, roundIndex, roundNumber);
  const applicationRecord = applicationRecordSource ? cloneData(applicationRecordSource) : null;
  const alreadyApplied = Boolean(applicationRecord);
  const blockedReasons = [];

  if (!hasSession) blockedReasons.push("No active Travel v2 runner session.");
  if (isCompleted) blockedReasons.push("Completed Travel v2 runner sessions cannot apply round pressure.");
  if (!hasCurrentRound) blockedReasons.push("Travel v2 runner session has no current round.");
  if (!previewAvailable) blockedReasons.push("Travel v2 pressure preview is unavailable for the current round.");
  if (!validOutcomeKeys.has(selectedOutcomeKey)) blockedReasons.push(`Selected Travel v2 pressure outcome is not available: ${selectedOutcomeKey}.`);
  if (selectedRow && selectedRow.ok !== true) blockedReasons.push(`Selected Travel v2 pressure outcome cannot be applied: ${selectedOutcomeKey}.`);
  if (alreadyApplied) blockedReasons.push("Travel v2 pressure has already been applied for this round.");

  const canApply = blockedReasons.length === 0;
  return deepFreeze({
    version: TRAVEL_V2_PRESSURE_APPLICATION_STATE_VERSION,
    hasSession,
    isCompleted,
    hasCurrentRound,
    roundIndex,
    roundNumber,
    previewAvailable,
    selectedOutcomeKey,
    selectedRow,
    rows,
    alreadyApplied,
    applicationRecord,
    canApply,
    blockedReasons,
    footerText: footerTextFor(blockedReasons, canApply)
  });
}

export default prepareTravelV2PressureApplicationState;
