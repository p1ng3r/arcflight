export const TRAVEL_V2_ROUND_FINALIZATION_STATE_VERSION = 1;

const LIFECYCLE_STATES = Object.freeze({
  PREVIEWING: "previewing",
  PRESSURE_APPLIED: "pressure-applied",
  FINALIZED: "finalized",
  EVENT_COMPLETE_READY: "event-complete-ready"
});

const ROUND_PRESSURE_APPLICATION_KEYS = Object.freeze([
  "travelV2PressureApplication",
  "travelV2PressureApplicationRecord",
  "pressureApplication",
  "pressureApplicationRecord"
]);

const PRESSURE_APPLICATION_COLLECTION_KEYS = Object.freeze([
  "travelV2PressureApplications",
  "travelV2PressureApplicationRecords",
  "pressureApplicationRecords",
  "pressureApplications"
]);

const PRESSURE_CORRECTION_COLLECTION_KEYS = Object.freeze([
  "travelV2PressureCorrections",
  "travelV2PressureCorrectionRecords",
  "pressureCorrectionRecords",
  "pressureCorrections"
]);

const ROUND_FINALIZATION_COLLECTION_KEYS = Object.freeze([
  "travelV2RoundResolutions",
  "travelV2RoundResolutionRecords",
  "roundResolutionRecords",
  "roundResolutions"
]);

const ROUND_FINALIZATION_KEYS = Object.freeze([
  "travelV2RoundResolution",
  "travelV2RoundResolutionRecord",
  "roundResolution",
  "roundResolutionRecord"
]);

const STATION_SUMMARY_KEYS = Object.freeze([
  "stationSummary",
  "stationSummaries",
  "stationResultSummary",
  "stationResultSummaries",
  "stationResultsSummary",
  "stationResults"
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

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function integerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function isCompletedSession(session = {}) {
  return session?.status === "completed" || session?.completed === true || Boolean(session?.completedAt && session?.status !== "active");
}

function recordsFromContainer(container) {
  if (Array.isArray(container)) return container;
  if (Array.isArray(container?.records)) return container.records;
  return [];
}

function roundMatchesRecord(record = {}, roundIndex, roundNumber) {
  if (!isPlainObject(record)) return false;
  const recordRoundIndex = integerOrNull(record.roundIndex);
  if (recordRoundIndex !== null && recordRoundIndex === roundIndex) return true;
  const recordRoundNumber = positiveIntegerOrNull(record.roundNumber ?? record.round);
  return roundNumber !== null && recordRoundNumber === roundNumber;
}

function getCurrentRound(session = {}) {
  const rounds = Array.isArray(session.event?.rounds) ? session.event.rounds : [];
  if (rounds.length === 0) return { roundIndex: -1, round: null, roundNumber: null, rounds };
  const requested = integerOrNull(session.currentRoundIndex) ?? 0;
  const roundIndex = Math.min(Math.max(requested, 0), rounds.length - 1);
  const round = isPlainObject(rounds[roundIndex]) ? rounds[roundIndex] : null;
  const roundNumber = positiveIntegerOrNull(round?.roundNumber ?? round?.number ?? round?.round ?? roundIndex + 1);
  return { roundIndex: round ? roundIndex : -1, round, roundNumber, rounds };
}

function latestMatchingCollectionRecord(session = {}, keys = [], roundIndex = -1, roundNumber = null) {
  const matches = [];
  for (const key of keys) {
    for (const record of recordsFromContainer(session[key])) {
      if (roundMatchesRecord(record, roundIndex, roundNumber)) matches.push(record);
    }
  }
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

function findRoundRecord(round = {}, keys = []) {
  if (!isPlainObject(round)) return null;
  for (const key of keys) {
    if (isPlainObject(round[key])) return round[key];
  }
  return null;
}

function findPressureApplicationRecord(session = {}, round = {}, roundIndex = -1, roundNumber = null) {
  return findRoundRecord(round, ROUND_PRESSURE_APPLICATION_KEYS)
    ?? latestMatchingCollectionRecord(session, PRESSURE_APPLICATION_COLLECTION_KEYS, roundIndex, roundNumber);
}

function findCorrectionRecord(session = {}, roundIndex = -1, roundNumber = null) {
  return latestMatchingCollectionRecord(session, PRESSURE_CORRECTION_COLLECTION_KEYS, roundIndex, roundNumber);
}

function findFinalizationRecord(session = {}, round = {}, roundIndex = -1, roundNumber = null) {
  return findRoundRecord(round, ROUND_FINALIZATION_KEYS)
    ?? latestMatchingCollectionRecord(session, ROUND_FINALIZATION_COLLECTION_KEYS, roundIndex, roundNumber);
}

function stationSummaryFromRound(round = {}) {
  if (!isPlainObject(round)) return null;
  for (const key of STATION_SUMMARY_KEYS) {
    const value = round[key];
    if (isPlainObject(value) || Array.isArray(value)) return cloneData(value);
  }
  return null;
}

function isFinalEventRound(roundIndex = -1, rounds = []) {
  return roundIndex >= 0 && Array.isArray(rounds) && rounds.length > 0 && roundIndex === rounds.length - 1;
}

function effectiveOutcomeKeyFrom(applicationRecord = null, correctionRecord = null) {
  return correctionRecord?.correctedOutcomeKey
    ?? correctionRecord?.selectedOutcomeKey
    ?? correctionRecord?.correctedApplicationRecord?.outcomeKey
    ?? applicationRecord?.outcomeKey
    ?? null;
}

function footerTextFor(blockedReasons = [], lifecycleState, canFinalize) {
  if (canFinalize) return "Ready to finalize the current Travel v2 round later. This state helper is read-only and does not finalize.";
  if (blockedReasons.length > 0) return blockedReasons[0];
  if (lifecycleState === LIFECYCLE_STATES.EVENT_COMPLETE_READY) return "Final event round is finalized and ready for event completion later.";
  if (lifecycleState === LIFECYCLE_STATES.FINALIZED) return "Current Travel v2 round is already finalized.";
  return "Current Travel v2 round is not ready to finalize.";
}

export function prepareTravelV2RoundFinalizationState(session = null, options = {}) {
  const hasSession = isPlainObject(session);
  const isCompleted = hasSession ? isCompletedSession(session) : false;
  const { roundIndex, round, roundNumber, rounds } = hasSession ? getCurrentRound(session) : { roundIndex: -1, round: null, roundNumber: null, rounds: [] };
  const hasCurrentRound = Boolean(round);
  const pressureApplicationSource = hasCurrentRound ? findPressureApplicationRecord(session, round, roundIndex, roundNumber) : null;
  const correctionSource = hasCurrentRound ? findCorrectionRecord(session, roundIndex, roundNumber) : null;
  const finalizationSource = hasCurrentRound ? findFinalizationRecord(session, round, roundIndex, roundNumber) : null;
  const pressureApplicationRecord = pressureApplicationSource ? cloneData(pressureApplicationSource) : null;
  const correctionRecord = correctionSource ? cloneData(correctionSource) : null;
  const finalizationRecord = finalizationSource ? cloneData(finalizationSource) : null;
  const isPressureApplied = Boolean(pressureApplicationRecord);
  const isFinalized = Boolean(finalizationRecord);
  const isEventCompleteReady = isFinalized && isFinalEventRound(roundIndex, rounds);
  const lifecycleState = isEventCompleteReady
    ? LIFECYCLE_STATES.EVENT_COMPLETE_READY
    : (isFinalized ? LIFECYCLE_STATES.FINALIZED : (isPressureApplied && !isCompleted ? LIFECYCLE_STATES.PRESSURE_APPLIED : LIFECYCLE_STATES.PREVIEWING));
  const blockedReasons = [];

  if (!hasSession) blockedReasons.push("Travel v2 runner session is required.");
  if (isCompleted) blockedReasons.push("Travel v2 runner session is completed.");
  if (!hasCurrentRound) blockedReasons.push("Travel v2 runner session has no current round.");
  if (hasCurrentRound && !isPressureApplied) blockedReasons.push("Current Travel v2 round has no effective pressure application.");
  if (isFinalized) blockedReasons.push("Current Travel v2 round is already finalized.");

  const canFinalize = hasSession && !isCompleted && hasCurrentRound && !isFinalized && isPressureApplied;

  return deepFreeze({
    version: TRAVEL_V2_ROUND_FINALIZATION_STATE_VERSION,
    hasSession,
    isCompleted,
    hasCurrentRound,
    roundIndex,
    roundNumber,
    lifecycleState,
    isPreviewing: lifecycleState === LIFECYCLE_STATES.PREVIEWING,
    isPressureApplied,
    isFinalized,
    isEventCompleteReady,
    canFinalize,
    blockedReasons,
    finalizationRecord,
    pressureApplicationRecord,
    correctionRecord,
    effectiveOutcomeKey: effectiveOutcomeKeyFrom(pressureApplicationRecord, correctionRecord),
    stationSummary: stationSummaryFromRound(round),
    footerText: footerTextFor(blockedReasons, lifecycleState, canFinalize)
  });
}

export default prepareTravelV2RoundFinalizationState;
