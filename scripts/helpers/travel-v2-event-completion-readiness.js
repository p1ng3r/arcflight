export const TRAVEL_V2_EVENT_COMPLETION_READINESS_VERSION = 1;

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

function integerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function isCompletedSession(session = {}) {
  return session?.status === "completed" || session?.completed === true || Boolean(session?.completedAt && session?.status !== "active");
}

function recordsFromContainer(container) {
  if (Array.isArray(container)) return container;
  if (Array.isArray(container?.records)) return container.records;
  return [];
}

function roundNumberFor(round = {}, roundIndex = -1) {
  return positiveIntegerOrNull(round?.roundNumber ?? round?.number ?? round?.round ?? roundIndex + 1);
}

function roundSummary(round = {}, roundIndex = -1) {
  return {
    roundIndex,
    roundNumber: roundNumberFor(round, roundIndex),
    title: typeof round?.title === "string" ? round.title : ""
  };
}

function recordMatchesRound(record = {}, roundIndex = -1, roundNumber = null) {
  if (!isPlainObject(record)) return false;
  const recordRoundIndex = integerOrNull(record.roundIndex);
  const recordRoundNumber = positiveIntegerOrNull(record.roundNumber ?? record.round);
  const hasIndex = recordRoundIndex !== null;
  const hasNumber = recordRoundNumber !== null;

  if (hasIndex && hasNumber && roundNumber !== null) {
    return recordRoundIndex === roundIndex && recordRoundNumber === roundNumber;
  }
  if (hasIndex) return recordRoundIndex === roundIndex;
  if (hasNumber && roundNumber !== null) return recordRoundNumber === roundNumber;
  return false;
}

function findFinalizationRecord(records = [], roundIndex = -1, roundNumber = null) {
  const matches = records.filter((record) => recordMatchesRound(record, roundIndex, roundNumber));
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

function effectiveOutcomeSummaryFrom(record = null) {
  if (!isPlainObject(record)) return null;
  return {
    roundIndex: integerOrNull(record.roundIndex),
    roundNumber: positiveIntegerOrNull(record.roundNumber ?? record.round),
    outcomeKey: record.effectiveOutcomeKey ?? record.outcomeKey ?? record.selectedOutcomeKey ?? null,
    createdAt: record.createdAt ?? null
  };
}

function currentRoundIndexFor(session = {}, eventRoundCount = 0) {
  if (eventRoundCount <= 0) return -1;
  const requested = integerOrNull(session.currentRoundIndex) ?? 0;
  return Math.min(Math.max(requested, 0), eventRoundCount - 1);
}

function summaryTextFor(eventReady) {
  return eventReady
    ? "All Travel v2 rounds are finalized. Event completion handoff is ready for a later step."
    : "Finalize all Travel v2 rounds before event completion.";
}

export function prepareTravelV2EventCompletionReadiness(session, options = {}) {
  const hasSession = isPlainObject(session);
  const isCompleted = hasSession ? isCompletedSession(session) : false;
  const rounds = hasSession && Array.isArray(session.event?.rounds) ? session.event.rounds : [];
  const eventRoundCount = rounds.length;
  const currentRoundIndex = hasSession ? currentRoundIndexFor(session, eventRoundCount) : -1;
  const currentRound = currentRoundIndex >= 0 ? rounds[currentRoundIndex] : null;
  const currentRoundNumber = currentRound ? roundNumberFor(currentRound, currentRoundIndex) : null;
  const finalRoundIndex = eventRoundCount > 0 ? eventRoundCount - 1 : -1;
  const finalRound = finalRoundIndex >= 0 ? rounds[finalRoundIndex] : null;
  const finalRoundNumber = finalRound ? roundNumberFor(finalRound, finalRoundIndex) : null;
  const records = hasSession ? recordsFromContainer(session.travelV2RoundResolutions).filter(isPlainObject) : [];

  const finalizedRounds = [];
  const pendingRounds = [];

  for (let index = 0; index < rounds.length; index += 1) {
    const round = rounds[index];
    const summary = roundSummary(round, index);
    const record = findFinalizationRecord(records, index, summary.roundNumber);
    if (record) {
      finalizedRounds.push({ ...summary, finalizationRecord: cloneData(record) });
    } else {
      pendingRounds.push(summary);
    }
  }

  const finalizedRoundCount = finalizedRounds.length;
  const pendingRoundCount = pendingRounds.length;
  const latestFinalizationRecord = finalizedRounds.length > 0 ? cloneData(finalizedRounds[finalizedRounds.length - 1].finalizationRecord) : null;
  const finalRoundFinalized = finalRoundIndex >= 0 && finalizedRounds.some((round) => round.roundIndex === finalRoundIndex && round.roundNumber === finalRoundNumber);
  const blockedReasons = [];

  if (!hasSession) blockedReasons.push("No active Travel v2 runner session.");
  if (isCompleted) blockedReasons.push("Travel v2 runner session is already completed.");
  if (eventRoundCount === 0) blockedReasons.push("Travel v2 event has no rounds.");
  if (pendingRoundCount > 0) blockedReasons.push("Travel v2 event has pending round finalizations.");
  if (eventRoundCount > 0 && !finalRoundFinalized) blockedReasons.push("Final Travel v2 round is not finalized.");

  const eventReady = hasSession && !isCompleted && eventRoundCount > 0 && pendingRoundCount === 0 && finalRoundFinalized;
  const status = isCompleted ? "completed" : (eventReady ? "ready" : "blocked");
  const lifecycleState = eventReady ? "event-completion-ready" : (isCompleted ? "completed" : "event-completion-blocked");
  const summaryText = summaryTextFor(eventReady);

  return deepFreeze({
    version: TRAVEL_V2_EVENT_COMPLETION_READINESS_VERSION,
    hasSession,
    status,
    lifecycleState,
    isCompleted,
    canCompleteEvent: eventReady,
    eventReady,
    blockedReasons,
    eventRoundCount,
    finalizedRoundCount,
    pendingRoundCount,
    currentRoundIndex,
    currentRoundNumber,
    finalRoundIndex,
    finalRoundNumber,
    finalizedRounds,
    pendingRounds,
    latestFinalizationRecord,
    effectiveOutcomeSummary: effectiveOutcomeSummaryFrom(latestFinalizationRecord),
    title: "Event Completion Readiness",
    summaryText,
    footerText: eventReady ? "Completion handoff is ready." : (blockedReasons[0] ?? summaryText),
    nextStepText: eventReady ? "Completion handoff is ready." : summaryText
  });
}

export default prepareTravelV2EventCompletionReadiness;
