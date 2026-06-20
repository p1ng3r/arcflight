import { prepareTravelV2EventCompletionReadiness } from "./travel-v2-event-completion-readiness.js";

export const TRAVEL_V2_SESSION_EVENT_COMPLETION_VERSION = 1;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneData(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function timestampFromOptions(options = {}) {
  const value = options.completedAt ?? options.now;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "function") {
    const produced = value();
    if (typeof produced === "string" && produced.trim()) return produced.trim();
    if (produced instanceof Date) return produced.toISOString();
  }
  return new Date().toISOString();
}

function effectiveOutcomeSummary(readiness = {}) {
  if (readiness.effectiveOutcomeSummary) return cloneData(readiness.effectiveOutcomeSummary);
  const finalizedRounds = Array.isArray(readiness.finalizedRounds) ? readiness.finalizedRounds : [];
  return finalizedRounds.map((round) => ({
    roundIndex: round.roundIndex,
    roundNumber: round.roundNumber,
    outcomeKey: round.finalizationRecord?.effectiveOutcomeKey ?? round.finalizationRecord?.outcomeKey ?? null
  }));
}

function summaryTextFor(readiness = {}) {
  return `Completed Travel v2 event with ${Number(readiness.finalizedRoundCount) || 0} / ${Number(readiness.eventRoundCount) || 0} rounds finalized.`;
}

function blockedResult(session, readiness = null, blockedReasons = []) {
  const reasons = blockedReasons.length > 0 ? blockedReasons : (Array.isArray(readiness?.blockedReasons) ? readiness.blockedReasons : ["Travel v2 event completion is blocked."]);
  return {
    ok: false,
    completed: false,
    session,
    originalSession: session,
    blockedReasons: cloneData(reasons),
    completionRecord: null,
    readiness,
    completedAt: null,
    helperVersion: TRAVEL_V2_SESSION_EVENT_COMPLETION_VERSION,
    summaryText: reasons[0] ?? "Travel v2 event completion is blocked."
  };
}

export function completeTravelV2EventOnRunnerSession(session, options = {}) {
  const readiness = prepareTravelV2EventCompletionReadiness(session, options);
  const blockedReasons = Array.isArray(readiness?.blockedReasons) ? [...readiness.blockedReasons] : [];

  if (!isPlainObject(session)) return blockedResult(session, readiness, blockedReasons);
  if (readiness.eventReady !== true || readiness.canCompleteEvent !== true) return blockedResult(session, readiness, blockedReasons);

  const completedAt = timestampFromOptions(options);
  const summaryText = summaryTextFor(readiness);
  const completionRecord = {
    version: TRAVEL_V2_SESSION_EVENT_COMPLETION_VERSION,
    completed: true,
    completedAt,
    helperVersion: TRAVEL_V2_SESSION_EVENT_COMPLETION_VERSION,
    finalizedRoundCount: readiness.finalizedRoundCount,
    eventRoundCount: readiness.eventRoundCount,
    effectiveOutcomeSummary: effectiveOutcomeSummary(readiness),
    readinessSummary: {
      status: readiness.status,
      lifecycleState: readiness.lifecycleState,
      eventReady: readiness.eventReady,
      canCompleteEvent: readiness.canCompleteEvent,
      blockedReasons: cloneData(readiness.blockedReasons),
      summaryText: readiness.summaryText,
      countText: `${readiness.finalizedRoundCount} / ${readiness.eventRoundCount} rounds finalized.`
    },
    summaryText
  };
  const completedSession = {
    ...cloneData(session),
    status: "completed",
    completed: true,
    completedAt,
    travelV2EventCompletion: cloneData(completionRecord)
  };

  return {
    ok: true,
    completed: true,
    session: completedSession,
    originalSession: session,
    blockedReasons: [],
    completionRecord,
    readiness,
    completedAt,
    helperVersion: TRAVEL_V2_SESSION_EVENT_COMPLETION_VERSION,
    summaryText
  };
}

export default completeTravelV2EventOnRunnerSession;
