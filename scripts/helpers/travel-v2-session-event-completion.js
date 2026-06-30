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

function hazardSummaryFor(session = {}) {
  const records = Array.isArray(session?.travelV2Hazards?.records) ? session.travelV2Hazards.records : [];
  const map = (filter) => records.filter(filter).map((record) => ({ id: record.id, hazardId: record.hazardId, name: record.name, status: record.status, revealed: record.revealed === true, drawnAt: record.drawnAt || "", revealedAt: record.revealedAt || "", activatedAt: record.activatedAt || "", clearedAt: record.clearedAt || "" }));
  return {
    revealed: map((record) => record.revealed === true),
    activated: map((record) => record.status === "active" || Boolean(record.activatedAt)),
    dismissedResolved: map((record) => record.status === "cleared"),
    stillActive: map((record) => record.status === "active")
  };
}

function summaryTextFor(readiness = {}) {
  return `Completed Travel v2 event with ${Number(readiness.finalizedRoundCount) || 0} / ${Number(readiness.eventRoundCount) || 0} rounds finalized.`;
}

function recordsFrom(container) {
  if (Array.isArray(container)) return container;
  if (Array.isArray(container?.records)) return container.records;
  return [];
}

function resultLabelFor(value) {
  const labels = { criticalSuccess: "Critical Success", success: "Success", failure: "Failure", criticalFailure: "Critical Failure" };
  return labels[value] ?? (value ? String(value) : "Unrecorded");
}

function roundNumberFor(round = {}, roundIndex = -1) {
  const value = Number(round?.roundNumber ?? round?.number ?? round?.round ?? roundIndex + 1);
  return Number.isInteger(value) && value > 0 ? value : roundIndex + 1;
}

function emptyResourceDeltas() {
  return { hull: 0, strain: 0, lifeveil: 0, morale: 0, supplies: 0 };
}

export function buildTravelV2EventCompletionSummary(session, options = {}) {
  const now = timestampFromOptions(options);
  const rounds = Array.isArray(session?.event?.rounds) ? session.event.rounds : [];
  const pressureApplications = recordsFrom(session?.travelV2PressureApplications);
  const consequenceQueue = recordsFrom(session?.travelV2PendingConsequenceQueue);
  const consequenceApplications = recordsFrom(session?.travelV2ConsequenceApplicationHistory);
  const followups = recordsFrom(session?.travelV2ConsequenceFollowups);
  const totals = {
    stationsResolved: 0,
    criticalSuccesses: 0,
    successes: 0,
    failures: 0,
    criticalFailures: 0,
    focusUses: 0,
    rerollsAccepted: 0,
    consequencesPending: consequenceQueue.filter((record) => record?.status === "pending").length,
    consequencesApplied: consequenceQueue.filter((record) => record?.status === "applied").length + consequenceApplications.length,
    consequencesDismissed: consequenceQueue.filter((record) => record?.status === "dismissed").length,
    resourceDeltas: emptyResourceDeltas()
  };
  for (const record of pressureApplications) {
    const deltas = isPlainObject(record?.totalsByPressureType) ? record.totalsByPressureType : {};
    for (const key of Object.keys(totals.resourceDeltas)) totals.resourceDeltas[key] += Number(deltas[key] ?? 0) || 0;
  }
  for (const record of consequenceApplications) {
    const key = record?.resource ?? record?.pressureTrack;
    if (Object.hasOwn(totals.resourceDeltas, key)) totals.resourceDeltas[key] += Number(record?.delta ?? record?.pressureDelta ?? 0) || 0;
  }
  const completedRoundCount = recordsFrom(session?.travelV2RoundResolutions).filter(isPlainObject).length;
  const summaryRounds = rounds.map((round, roundIndex) => {
    const roundNumber = roundNumberFor(round, roundIndex);
    const roundResult = session?.roundResults?.[roundIndex] ?? {};
    const stationResults = Object.entries(isPlainObject(roundResult.stationResults) ? roundResult.stationResults : {}).map(([stationKey, result]) => {
      if (result) totals.stationsResolved += 1;
      if (result === "criticalSuccess") totals.criticalSuccesses += 1;
      else if (result === "success") totals.successes += 1;
      else if (result === "failure") totals.failures += 1;
      else if (result === "criticalFailure") totals.criticalFailures += 1;
      const stationState = roundResult.stationStates?.[stationKey] ?? {};
      const focusUsed = Boolean(stationState.focusUsed ?? stationState.focus?.used ?? false);
      const rerollUsed = Boolean(stationState.rerollUsed ?? stationState.focusRerollUsed ?? stationState.rerollAccepted ?? false);
      if (focusUsed) totals.focusUses += 1;
      if (rerollUsed) totals.rerollsAccepted += 1;
      const label = resultLabelFor(result);
      return {
        stationKey,
        stationName: stationState.stationName ?? stationKey,
        approachLabel: stationState.selectedApproach?.label ?? stationState.approachLabel ?? stationState.selectedSkillLabel ?? "",
        resultLabel: label,
        degreeOfSuccess: result ?? null,
        total: Number.isFinite(Number(stationState.total)) ? Number(stationState.total) : null,
        dc: Number.isFinite(Number(stationState.dc)) ? Number(stationState.dc) : null,
        actorName: stationState.actorName ?? stationState.assignedActorName ?? "",
        playerName: stationState.playerName ?? "",
        focusUsed,
        rerollUsed,
        publicSummary: `${stationState.stationName ?? stationKey}: ${label}.`
      };
    });
    const pressureApplication = pressureApplications.find((record) => Number(record?.roundIndex) === roundIndex || Number(record?.roundNumber) === roundNumber) ?? null;
    const roundOutcome = recordsFrom(session?.travelV2RoundResolutions).find((record) => Number(record?.roundIndex) === roundIndex || Number(record?.roundNumber) === roundNumber) ?? null;
    return {
      roundIndex,
      roundNumber,
      title: round?.title ?? `Round ${roundNumber}`,
      status: roundOutcome ? "finalized" : "pending",
      stationResults,
      pressureApplication: cloneData(pressureApplication),
      roundOutcome: cloneData(roundOutcome),
      consequencesGenerated: cloneData(consequenceQueue.filter((record) => Number(record?.roundIndex) === roundIndex || Number(record?.roundNumber) === roundNumber)),
      consequencesHandled: cloneData(consequenceQueue.filter((record) => ["applied", "dismissed", "resolved"].includes(record?.status) && (Number(record?.roundIndex) === roundIndex || Number(record?.roundNumber) === roundNumber)))
    };
  });
  const finalOutcomeLabel = totals.criticalFailures > 0 ? "Hard-won passage" : (totals.failures > totals.successes ? "Costly passage" : "Travel complete");
  const finalOutcomeTone = totals.criticalFailures > 0 ? "danger" : (totals.failures > totals.successes ? "warning" : "success");
  return {
    version: 1,
    eventTitle: session?.event?.title ?? session?.event?.name ?? session?.name ?? "Travel Event",
    eventId: session?.event?.id ?? session?.event?.key ?? session?.eventId ?? "",
    sessionKey: session?.key ?? "",
    actorName: options.actor?.name ?? session?.actorName ?? session?.shipName ?? "",
    startedAt: session?.startedAt ?? session?.createdAt ?? "",
    completedAt: options.completedAt ?? now,
    totalRounds: rounds.length,
    completedRoundCount,
    finalOutcomeLabel,
    finalOutcomeTone,
    rounds: summaryRounds,
    totals,
    consequenceApplications: cloneData(consequenceApplications),
    followups: cloneData(followups),
    publicSummary: { title: finalOutcomeLabel, paragraphs: [`${session?.event?.title ?? session?.event?.name ?? "The Travel event"} is complete after ${completedRoundCount} of ${rounds.length} rounds.`], chips: ["Travel complete", `Round ${Math.max(completedRoundCount, 0)} of ${rounds.length}`] },
    gmSummary: { paragraphs: [summaryTextFor({ finalizedRoundCount: completedRoundCount, eventRoundCount: rounds.length })], nextSteps: ["Review the public summary with the table.", "Explicitly apply or export any desired follow-up records."], warnings: [] }
  };
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
  const completionSummary = buildTravelV2EventCompletionSummary(session, { ...options, completedAt });
  const hazardSummary = hazardSummaryFor(session);
  const completionRecord = {
    version: TRAVEL_V2_SESSION_EVENT_COMPLETION_VERSION,
    completed: true,
    completedAt,
    completedByUserId: options.completedByUserId ?? globalThis.game?.user?.id ?? "",
    completedByUserName: options.completedByUserName ?? globalThis.game?.user?.name ?? "",
    helperVersion: TRAVEL_V2_SESSION_EVENT_COMPLETION_VERSION,
    finalizedRoundCount: readiness.finalizedRoundCount,
    eventRoundCount: readiness.eventRoundCount,
    effectiveOutcomeSummary: effectiveOutcomeSummary(readiness),
    hazardSummary,
    readinessSummary: {
      status: readiness.status,
      lifecycleState: readiness.lifecycleState,
      eventReady: readiness.eventReady,
      canCompleteEvent: readiness.canCompleteEvent,
      blockedReasons: cloneData(readiness.blockedReasons),
      summaryText: readiness.summaryText,
      countText: `${readiness.finalizedRoundCount} / ${readiness.eventRoundCount} rounds finalized.`
    },
    summaryText,
    summary: cloneData(completionSummary)
  };
  const completedSession = {
    ...cloneData(session),
    status: "completed",
    completed: true,
    completedAt,
    completedByUserId: completionRecord.completedByUserId,
    completedByUserName: completionRecord.completedByUserName,
    travelV2EventCompletion: cloneData(completionRecord),
    travelV2CompletionSummary: cloneData(completionSummary)
  };

  return {
    ok: true,
    completed: true,
    session: completedSession,
    originalSession: session,
    blockedReasons: [],
    completionRecord,
    summary: completionSummary,
    readiness,
    completedAt,
    helperVersion: TRAVEL_V2_SESSION_EVENT_COMPLETION_VERSION,
    summaryText
  };
}

export default completeTravelV2EventOnRunnerSession;
