import { createTravelEventRunnerSession, deleteTravelEventRunnerSessionFromLibrary, getTravelEventRunnerSessionLibrary, normalizeTravelEventRunnerSession, saveTravelEventRunnerSessionToLibrary, setTravelEventRunnerStationResult, inspectTravelV2RoundResolutionReadiness } from "./travel-event-runner.js";
import { applyTravelV2PressureToRunnerSession } from "./travel-v2-session-pressure-application.js";
import { finalizeTravelV2RoundOnRunnerSession } from "./travel-v2-session-round-finalization.js";
import { completeTravelV2EventOnRunnerSession } from "./travel-v2-session-event-completion.js";
import { prepareTravelV2EventOutcomePackage } from "./travel-v2-event-outcome-package.js";
import { prepareTravelV2FollowUpState } from "./travel-v2-followups.js";
import { LANTERN_IN_THE_STATIC_SAMPLE_EVENT } from "../../data/travel-events/sample-travel-v2-events.js";

export const TRAVEL_V2_DEV_TOOLS_SETTING = "travelV2DevToolsEnabled";
export const TRAVEL_V2_DEV_TOOLS_VERSION = 1;
export const TRAVEL_V2_FORCE_OUTCOME_KEYS = Object.freeze(["criticalSuccess", "success", "mixed", "failure", "criticalFailure"]);

const RESULT_BY_OUTCOME = Object.freeze({ criticalSuccess: "criticalSuccess", success: "success", mixed: "success", failure: "failure", criticalFailure: "criticalFailure" });

export const TRAVEL_V2_FORCE_ROUND_RESULT_VALUES = Object.freeze(["criticalFailure", "failure", "success", "criticalSuccess"]);

function normalizeForceRoundResolvedOptions(input = {}) {
  const options = isPlainObject(input) ? input : {};
  const results = isPlainObject(options.results) ? options.results : {};
  const defaultResult = TRAVEL_V2_FORCE_ROUND_RESULT_VALUES.includes(options.defaultResult) ? options.defaultResult : "success";
  return { ...options, results, defaultResult, settleFocus: options.settleFocus === true };
}

export function forceTravelV2RoundResolved(session, input = {}, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.session) return { ok: false, errors: normalized.errors?.length ? normalized.errors : ["Travel v2 runner session is required."], warnings: normalized.warnings ?? [], session: normalized.session ?? session, sessionKey: "", currentRoundIndex: -1, resolvedStationCount: 0, activeStationCount: 0, results: {}, readiness: null };
  const forceOptions = normalizeForceRoundResolvedOptions(input);
  const errors = [];
  const warnings = [];
  const activeSession = normalized.session;
  const roundIndex = getCurrentRoundIndex(activeSession);
  const round = activeSession.event?.rounds?.[roundIndex] ?? {};
  const activeStations = Array.isArray(round.activeStations) ? round.activeStations : stationKeysForRoundResult(activeSession.roundResults?.[roundIndex] ?? {});
  const requestedResults = {};
  for (const stationKey of activeStations) {
    const value = forceOptions.results[stationKey] ?? forceOptions.defaultResult;
    if (!TRAVEL_V2_FORCE_ROUND_RESULT_VALUES.includes(value)) errors.push(`Invalid forced result for ${stationKey}: ${value}.`);
    else requestedResults[stationKey] = value;
  }
  for (const stationKey of Object.keys(forceOptions.results)) {
    if (!activeStations.includes(stationKey)) warnings.push(`Ignoring result for inactive station ${stationKey}.`);
  }
  if (errors.length) return { ok: false, errors, warnings, session: activeSession, sessionKey: activeSession.key ?? "", currentRoundIndex: roundIndex, resolvedStationCount: 0, activeStationCount: activeStations.length, results: requestedResults, readiness: inspectTravelV2RoundResolutionReadiness(activeSession, options) };
  let nextSession = cloneData(activeSession);
  for (const stationKey of activeStations) {
    const updated = setTravelEventRunnerStationResult(nextSession, roundIndex, stationKey, requestedResults[stationKey], options);
    if (!updated.ok || !updated.session) {
      return { ok: false, errors: updated.errors ?? [`Could not force ${stationKey}.`], warnings: [...warnings, ...(updated.warnings ?? [])], session: nextSession, sessionKey: nextSession.key ?? "", currentRoundIndex: roundIndex, resolvedStationCount: Object.values(nextSession.roundResults?.[roundIndex]?.stationResults ?? {}).filter(Boolean).length, activeStationCount: activeStations.length, results: requestedResults, readiness: inspectTravelV2RoundResolutionReadiness(nextSession, options) };
    }
    warnings.push(...(updated.warnings ?? []));
    nextSession = updated.session;
  }
  nextSession.travelV2DevForcedRound = { forcedAt: nowIso(options), mode: "round-resolved", results: cloneData(requestedResults), settleFocus: forceOptions.settleFocus };
  nextSession.updatedAt = nowIso(options);
  const readiness = inspectTravelV2RoundResolutionReadiness(nextSession, options);
  const resolvedStationCount = activeStations.filter((stationKey) => Boolean(nextSession.roundResults?.[roundIndex]?.stationResults?.[stationKey])).length;
  return { ok: errors.length === 0, errors, warnings, session: nextSession, sessionKey: nextSession.key ?? "", currentRoundIndex: roundIndex, resolvedStationCount, activeStationCount: activeStations.length, results: cloneData(requestedResults), readiness };
}

function cloneData(value) { if (value == null) return value; return JSON.parse(JSON.stringify(value)); }
function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function nowIso(options = {}) { if (typeof options.now === "string" && options.now.trim()) return options.now.trim(); if (options.now instanceof Date) return options.now.toISOString(); if (typeof options.now === "function") { const value = options.now(); if (typeof value === "string" && value.trim()) return value.trim(); if (value instanceof Date) return value.toISOString(); } return new Date().toISOString(); }
function formatDateTime(value) { const text = typeof value === "string" ? value.trim() : ""; if (!text) return ""; const date = new Date(text); return Number.isNaN(date.getTime()) ? text : date.toLocaleString(); }
function normalizeOutcome(value, fallback = "mixed") { if (value === "critical-success" || value === "critical_success") return "criticalSuccess"; if (value === "critical-failure" || value === "critical_failure") return "criticalFailure"; return TRAVEL_V2_FORCE_OUTCOME_KEYS.includes(value) ? value : fallback; }
function stationKeysForRoundResult(roundResult = {}) { return Object.keys(isPlainObject(roundResult.stationResults) ? roundResult.stationResults : {}); }
function resultMapForOutcome(stationKeys = [], outcomeKey = "mixed") { const normalized = normalizeOutcome(outcomeKey); return Object.fromEntries(stationKeys.map((key, index) => [key, normalized === "mixed" ? (index % 2 === 0 ? "success" : "failure") : RESULT_BY_OUTCOME[normalized]])); }
function getCurrentRoundIndex(session = {}) { const count = Array.isArray(session.roundResults) ? session.roundResults.length : 0; const index = Number.isInteger(Number(session.currentRoundIndex)) ? Number(session.currentRoundIndex) : 0; return Math.min(Math.max(index, 0), Math.max(count - 1, 0)); }
function recordsFrom(container) { if (Array.isArray(container)) return container; if (Array.isArray(container?.records)) return container.records; return []; }
function roundRecord(session = {}, roundIndex = 0, roundNumber = roundIndex + 1) { return recordsFrom(session.travelV2PressureApplications).find((record) => Number(record?.roundIndex) === roundIndex || Number(record?.roundNumber) === roundNumber) ?? null; }
function pressureChangeRows(record = null) { return Object.entries(record?.totalsByPressureType ?? {}).filter(([, amount]) => Number(amount) !== 0).map(([pressureType, amount]) => ({ pressureType, amount: Number(amount), label: pressureType, displayAmount: `${Number(amount) > 0 ? "+" : ""}${Number(amount)}` })); }

export function isTravelV2DevToolsEnabled(options = {}) {
  if (options.enabled === true || options.force === true) return true;
  if (options.enabled === false) return false;
  try { return globalThis.game?.user?.isGM === true && globalThis.game?.settings?.get?.("arcflight", TRAVEL_V2_DEV_TOOLS_SETTING) === true; } catch { return false; }
}

export function forceTravelV2CurrentRoundResults(session, outcomeKey = "mixed", options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.session) return { ok: false, session, error: normalized.errors?.[0] ?? "Travel v2 runner session is required." };
  const next = cloneData(normalized.session);
  const roundIndex = getCurrentRoundIndex(next);
  const roundResult = next.roundResults[roundIndex];
  const stationKeys = stationKeysForRoundResult(roundResult);
  roundResult.stationResults = resultMapForOutcome(stationKeys, outcomeKey);
  roundResult.travelV2DevForced = { outcomeKey: normalizeOutcome(outcomeKey), forcedAt: nowIso(options), mode: "current-round-results" };
  next.updatedAt = nowIso(options);
  return { ok: true, session: next, roundIndex, roundNumber: roundIndex + 1, outcomeKey: normalizeOutcome(outcomeKey), stationResults: cloneData(roundResult.stationResults) };
}

export function forceTravelV2Outcome(session, outcomeKey = "mixed", options = {}) {
  const forced = forceTravelV2CurrentRoundResults(session, outcomeKey, options);
  if (!forced.ok) return forced;
  const pressure = applyTravelV2PressureToRunnerSession(forced.session, { ...options, selectedOutcomeKey: forced.outcomeKey });
  if (!pressure.ok) return { ...forced, ok: false, error: pressure.error, blockedReasons: pressure.blockedReasons, pressureResult: pressure };
  return { ...forced, ok: true, session: pressure.session, pressureResult: pressure, forcedOutcomeApplied: true };
}

export function forceTravelV2EarlyEndRound(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.session) return { ok: false, session, error: normalized.errors?.[0] ?? "Travel v2 runner session is required." };
  const next = cloneData(normalized.session);
  const roundIndex = getCurrentRoundIndex(next);
  const roundResult = next.roundResults[roundIndex];
  const stationKeys = stationKeysForRoundResult(roundResult);
  roundResult.stationResults = Object.fromEntries(stationKeys.map((key) => [key, null]));
  roundResult.travelV2DevForced = { outcomeKey: "skipped", forcedAt: nowIso(options), mode: "ended-early", notRun: true };
  next.updatedAt = nowIso(options);
  const skippedRecord = {
    roundIndex,
    roundNumber: roundIndex + 1,
    outcomeKey: "skipped",
    requestCount: 0,
    totalsByPressureType: {},
    createdAt: nowIso(options),
    helperVersion: TRAVEL_V2_DEV_TOOLS_VERSION,
    pressureChangeCount: 0,
    notRun: true,
    endedEarly: true
  };
  const existing = Array.isArray(next.travelV2PressureApplications)
    ? next.travelV2PressureApplications
    : (Array.isArray(next.travelV2PressureApplications?.records) ? next.travelV2PressureApplications.records : []);
  next.travelV2PressureApplications = { ...(isPlainObject(next.travelV2PressureApplications) ? next.travelV2PressureApplications : {}), records: [...cloneData(existing), skippedRecord] };
  return { ok: true, session: next, roundIndex, roundNumber: roundIndex + 1, outcomeKey: "skipped", endedEarly: true, pressureResult: { ok: true, applied: true, selectedOutcomeKey: "skipped", applicationRecord: skippedRecord, session: next } };
}

export function prepareTravelV2RoundResolutionDialogState(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options).session ?? session;
  const roundIndex = getCurrentRoundIndex(normalized);
  const round = normalized?.event?.rounds?.[roundIndex] ?? {};
  const roundResult = normalized?.roundResults?.[roundIndex] ?? {};
  const stationResults = isPlainObject(roundResult.stationResults) ? roundResult.stationResults : {};
  const values = Object.values(stationResults);
  const notRun = values.length === 0 || values.every((value) => value == null);
  const pressureApplicationRecord = roundRecord(normalized, roundIndex, roundIndex + 1);
  const pressureChanges = pressureChangeRows(pressureApplicationRecord);
  return Object.freeze({ version: TRAVEL_V2_DEV_TOOLS_VERSION, title: `Round ${roundIndex + 1} Resolution`, roundIndex, roundNumber: roundIndex + 1, eventName: normalized?.event?.name ?? normalized?.event?.title ?? "Travel Event", vignette: round.vignette ?? round.intro ?? "", stationResults: cloneData(stationResults), notRun, outcomeLabel: notRun ? "Not run / ended early" : "Ready for GM review", pressureApplicationRecord: cloneData(pressureApplicationRecord), pressureChanges, hasPressureChanges: pressureChanges.length > 0, pressureChangeText: pressureChanges.length ? pressureChanges.map((row) => `${row.displayAmount} ${row.label}`).join(", ") : "No pressure changes", canFinalize: true, finalizeButtonLabel: "Finalize Round" });
}

export function prepareTravelV2EndOfEventResolutionDialogState(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options).session ?? session;
  const outcome = prepareTravelV2EventOutcomePackage(normalized, options);
  const followUps = prepareTravelV2FollowUpState(options.actor ?? null, normalized?.travelV2ActorApplication ?? outcome.packageRecord, { session: normalized });
  const debugReport = buildTravelV2DebugReport(normalized, { ...options, outcomePackage: outcome, followUps });
  return Object.freeze({ version: TRAVEL_V2_DEV_TOOLS_VERSION, title: "End-of-Event Resolution", tabs: ["vignette", "rounds", "rewards", "consequences", "shipChanges", "followUps", "debug"], eventName: normalized?.event?.name ?? normalized?.event?.title ?? "Travel Event", shipName: normalized?.ship?.actorName ?? normalized?.ship?.name ?? "", completedAt: normalized?.completedAt ?? "", outcomePackage: outcome, followUps, debugReport, applyButtonsExplicit: true });
}

export function filterTravelV2CompletedSessionEntries(libraryStateOrSessions = {}) {
  const entries = Array.isArray(libraryStateOrSessions) ? libraryStateOrSessions : (Array.isArray(libraryStateOrSessions.entries) ? libraryStateOrSessions.entries : Object.values(libraryStateOrSessions.sessions ?? {}));
  return entries.map((entry) => {
    const session = entry?.session ?? entry;
    const status = session?.status ?? entry?.status ?? "";
    const completedAt = session?.completedAt ?? entry?.completedAt ?? "";
    return { entry, session, status, completedAt };
  }).filter(({ entry, session, status, completedAt }) => Boolean(entry) && (status === "completed" || session?.completed === true || Boolean(completedAt)));
}

export async function deleteTravelV2CompletedSessionFromLibrary(sessionKey, options = {}) {
  const key = String(sessionKey ?? "");
  const library = getTravelEventRunnerSessionLibrary(options);
  const matches = filterTravelV2CompletedSessionEntries(library).map(({ entry, session }) => entry?.key ?? session?.key ?? "");
  if (!matches.includes(key)) {
    return { ok: false, errors: [`No completed Travel v2 runner session found for "${key}".`], warnings: [], library, deleted: null };
  }
  return deleteTravelEventRunnerSessionFromLibrary(key, { ...options, library });
}


function asArray(value) { return Array.isArray(value) ? value : []; }
function cleanText(value) { return typeof value === "string" ? value.trim() : (value == null ? "" : String(value).trim()); }
function resourceDeltaRows(resourceDeltas = {}) {
  if (!isPlainObject(resourceDeltas)) return [];
  return Object.entries(resourceDeltas).map(([key, amount]) => {
    const numeric = Number(amount) || 0;
    return { key, label: humanizeIdentifier(key), amount: numeric, displayAmount: `${numeric > 0 ? "+" : ""}${numeric}` };
  }).filter((row) => row.amount !== 0);
}
function humanizeIdentifier(value) { return String(value ?? "").replace(/[-_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function consequenceCounts(summary = {}) {
  const totals = isPlainObject(summary.totals) ? summary.totals : {};
  return {
    applied: Math.max(0, Number(totals.consequencesApplied) || 0),
    dismissed: Math.max(0, Number(totals.consequencesDismissed) || 0),
    pending: Math.max(0, Number(totals.consequencesPending) || 0)
  };
}

export function prepareTravelV2CompletedSessionSummaryRows(summary = {}, options = {}) {
  const includeGm = options.includeGmSummary !== false;
  const rounds = asArray(summary?.rounds).map((round, index) => ({
    roundIndex: Number.isFinite(Number(round?.roundIndex)) ? Number(round.roundIndex) : index,
    roundNumber: Number.isFinite(Number(round?.roundNumber)) ? Number(round.roundNumber) : index + 1,
    title: cleanText(round?.title) || `Round ${index + 1}`,
    status: cleanText(round?.status) || "unknown",
    stationResults: asArray(round?.stationResults).map((station) => ({
      stationKey: cleanText(station?.stationKey),
      stationName: cleanText(station?.stationName) || cleanText(station?.stationKey) || "Station",
      approachLabel: cleanText(station?.approachLabel),
      resultLabel: cleanText(station?.resultLabel) || humanizeIdentifier(station?.degreeOfSuccess),
      degreeOfSuccess: cleanText(station?.degreeOfSuccess),
      actorName: cleanText(station?.actorName),
      playerName: cleanText(station?.playerName),
      total: station?.total ?? null,
      dc: station?.dc ?? null,
      focusUsed: station?.focusUsed === true,
      rerollUsed: station?.rerollUsed === true,
      publicSummary: cleanText(station?.publicSummary)
    })),
    consequencesGeneratedCount: asArray(round?.consequencesGenerated).length,
    consequencesHandledCount: asArray(round?.consequencesHandled).length,
    ...(includeGm ? { pressureApplication: cloneData(round?.pressureApplication ?? null), roundOutcome: cloneData(round?.roundOutcome ?? null) } : {})
  }));
  return Object.freeze({
    rounds,
    hasRounds: rounds.length > 0,
    stationResults: rounds.flatMap((round) => round.stationResults.map((station) => ({ ...station, roundNumber: round.roundNumber, roundTitle: round.title }))),
    resourceDeltas: resourceDeltaRows(summary?.totals?.resourceDeltas),
    consequenceCounts: consequenceCounts(summary),
    followups: asArray(summary?.followups).map((followup, index) => ({ key: cleanText(followup?.key ?? followup?.id) || `followup-${index + 1}`, title: cleanText(followup?.title ?? followup?.name) || `Follow-up ${index + 1}`, status: cleanText(followup?.status) || "pending", publicSummary: includeGm ? cleanText(followup?.publicSummary ?? followup?.summary ?? followup?.text) : cleanText(followup?.publicSummary ?? followup?.publicText ?? followup?.playerText), ...(includeGm ? { gmSummary: cleanText(followup?.gmSummary ?? followup?.gmText) } : {}) })),
    includeGm
  });
}

export function prepareTravelV2CompletedSessionSummaryViewState(session, options = {}) {
  const includeGm = options.includeGmSummary !== false;
  const summary = isPlainObject(session?.travelV2CompletionSummary) ? session.travelV2CompletionSummary : (isPlainObject(session?.travelV2EventCompletion?.summary) ? session.travelV2EventCompletion.summary : {});
  const rows = prepareTravelV2CompletedSessionSummaryRows(summary, { ...options, includeGmSummary: includeGm });
  const publicSummary = isPlainObject(summary.publicSummary) ? summary.publicSummary : {};
  const gmSummary = isPlainObject(summary.gmSummary) ? summary.gmSummary : {};
  const completedBy = cleanText(session?.completedByUserName) || cleanText(session?.travelV2EventCompletion?.completedByUserName);
  return Object.freeze({
    available: Object.keys(summary).length > 0,
    readOnly: true,
    sessionKey: cleanText(session?.key ?? summary.sessionKey),
    eventTitle: cleanText(summary.eventTitle ?? session?.event?.title ?? session?.event?.name ?? session?.name) || "Travel Event",
    shipName: cleanText(summary.actorName ?? session?.ship?.actorName ?? session?.ship?.name ?? session?.shipName),
    completedAt: cleanText(summary.completedAt ?? session?.completedAt),
    completedAtLabel: formatDateTime(summary.completedAt ?? session?.completedAt) || "Missing timestamp",
    completedBy,
    outcomeLabel: cleanText(summary.finalOutcomeLabel),
    outcomeTone: cleanText(summary.finalOutcomeTone),
    publicSummary: { title: cleanText(publicSummary.title) || cleanText(summary.finalOutcomeLabel) || "Travel complete", paragraphs: asArray(publicSummary.paragraphs).map(cleanText).filter(Boolean), chips: asArray(publicSummary.chips).map(cleanText).filter(Boolean) },
    ...(includeGm ? { gmSummary: { paragraphs: asArray(gmSummary.paragraphs).map(cleanText).filter(Boolean), nextSteps: asArray(gmSummary.nextSteps).map(cleanText).filter(Boolean), warnings: asArray(gmSummary.warnings).map(cleanText).filter(Boolean) } } : {}),
    totals: includeGm ? cloneData(summary.totals ?? {}) : {
      consequenceCounts: rows.consequenceCounts,
      resourceDeltas: rows.resourceDeltas,
      stationsResolved: Math.max(0, Number(summary?.totals?.stationsResolved) || 0),
      criticalSuccesses: Math.max(0, Number(summary?.totals?.criticalSuccesses) || 0),
      successes: Math.max(0, Number(summary?.totals?.successes) || 0),
      failures: Math.max(0, Number(summary?.totals?.failures) || 0),
      criticalFailures: Math.max(0, Number(summary?.totals?.criticalFailures) || 0)
    },
    rounds: rows.rounds,
    hasRounds: rows.hasRounds,
    stationResults: rows.stationResults,
    hasStationResults: rows.stationResults.length > 0,
    resourceDeltas: rows.resourceDeltas,
    hasResourceDeltas: rows.resourceDeltas.length > 0,
    consequenceCounts: rows.consequenceCounts,
    followups: rows.followups,
    followupCount: rows.followups.length,
    hasFollowups: rows.followups.length > 0
  });
}

export function prepareTravelV2CompletedSessionHistoryState(libraryStateOrSessions = {}, options = {}) {
  const includeGm = options.includeGmSummary !== false;
  const rows = filterTravelV2CompletedSessionEntries(libraryStateOrSessions).map(({ entry, session }) => {
    const outcome = prepareTravelV2EventOutcomePackage(session, options);
    const followUps = prepareTravelV2FollowUpState(options.actor ?? null, session?.travelV2ActorApplication ?? outcome.packageRecord, { session });
    const completedAt = session?.completedAt ?? entry?.completedAt ?? "";
    const actorAppliedAt = session?.travelV2ActorApplication?.appliedAt ?? "";
    const outcomeAppliedAt = session?.travelV2EventOutcomeApplication?.appliedAt ?? "";
    const appliedAt = actorAppliedAt || outcomeAppliedAt || entry?.appliedAt || "";
    const followUpsSaved = followUps.hasPersistedRecords === true || Number(followUps.persistedCount) > 0;
    const applicationStatusKey = followUpsSaved ? "followUpsSaved" : (actorAppliedAt ? "actorApplied" : (outcomeAppliedAt ? "outcomeApplied" : "completedNotApplied"));
    const applicationStatusLabel = followUpsSaved ? "Follow-ups saved to ship" : (actorAppliedAt ? "Actor applied" : (outcomeAppliedAt ? "Outcome applied" : "Completed / not applied"));
    const key = entry?.key ?? session?.key ?? "";
    return { key, name: entry?.name ?? session?.name ?? "", eventName: entry?.eventName ?? session?.event?.name ?? session?.event?.title ?? "Travel Event", shipName: entry?.shipName ?? session?.ship?.actorName ?? session?.ship?.name ?? "Unknown ship", completedBy: session?.completedByUserName ?? session?.travelV2EventCompletion?.completedByUserName ?? "", outcome: outcome.eventOutcomeLabel ?? "", outcomeKey: outcome.eventOutcomeKey ?? "", completedAt, completedAtLabel: formatDateTime(completedAt) || "Missing timestamp", completedDateTime: formatDateTime(completedAt) || "Missing timestamp", appliedAt, appliedAtLabel: appliedAt ? formatDateTime(appliedAt) : "Not applied", appliedDateTime: appliedAt ? formatDateTime(appliedAt) : "Not applied", applicationStatusKey, applicationStatusLabel, followUpCount: followUps.recordCount ?? followUps.records?.length ?? 0, canReopen: includeGm && Boolean(key) && entry?.isMalformed !== true && Boolean(session), canDelete: includeGm && Boolean(key), isMalformed: entry?.isMalformed === true, summaryView: prepareTravelV2CompletedSessionSummaryViewState(session, { ...options, includeGmSummary: includeGm }), session: includeGm ? cloneData(session) : null };
  }).sort((a, b) => String(b.completedAt || "0000").localeCompare(String(a.completedAt || "0000")) || String(b.key).localeCompare(String(a.key)));
  return Object.freeze({ version: TRAVEL_V2_DEV_TOOLS_VERSION, rows, count: rows.length, hasRows: rows.length > 0, isEmpty: rows.length === 0, newestFirst: true });
}

export function buildTravelV2DebugReport(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options).session ?? session;
  const outcomePackage = options.outcomePackage ?? prepareTravelV2EventOutcomePackage(normalized, options);
  const roundResults = (normalized?.roundResults ?? []).map((round, index) => { const values = Object.values(round.stationResults ?? {}); const notRun = values.length === 0 || values.every((value) => value == null); return { roundIndex: index, roundNumber: index + 1, outcomeKey: notRun ? "not-run" : (round.travelV2DevForced?.outcomeKey ?? outcomePackage.roundSummaries?.[index]?.outcomeKey ?? ""), statusLabel: notRun ? "Not run / ended early" : "Run", stationResults: cloneData(round.stationResults ?? {}) }; });
  return { version: TRAVEL_V2_DEV_TOOLS_VERSION, generatedAt: nowIso(options), eventName: normalized?.event?.name ?? normalized?.event?.title ?? "", ship: cloneData(normalized?.ship ?? {}), status: normalized?.status ?? "", completedAt: normalized?.completedAt ?? "", roundResults, outcomePackage: cloneData(outcomePackage.packageRecord ?? outcomePackage), pressureApplications: cloneData(normalized?.travelV2PressureApplications ?? null), roundResolutions: cloneData(normalized?.travelV2RoundResolutions ?? null) };
}

export async function copyTravelV2DebugReport(session, options = {}) {
  const report = buildTravelV2DebugReport(session, options);
  const text = JSON.stringify(report, null, 2);
  if (typeof globalThis.navigator?.clipboard?.writeText !== "function") {
    return { ok: false, copied: false, text, report, error: "Clipboard API is unavailable; use the returned debug report text." };
  }
  try {
    await globalThis.navigator.clipboard.writeText(text);
    return { ok: true, copied: true, text, report, error: "" };
  } catch (error) {
    return { ok: false, copied: false, text, report, error: error?.message ?? "Clipboard write failed; use the returned debug report text." };
  }
}

export function createLanternTravelV2SampleSession(options = {}) {
  const created = createTravelEventRunnerSession(LANTERN_IN_THE_STATIC_SAMPLE_EVENT, { ...options, notes: options.notes ?? "Travel v2 Lantern sample setup." });
  if (!created.ok) return created;
  let session = { ...created.session, name: options.name ?? "Lantern in the Static — Travel v2 Dev Sample" };
  if (options.save === true) {
    const saved = saveTravelEventRunnerSessionToLibrary(session, { ...options, saveAs: true });
    if (saved.ok) session = saved.session;
    return { ...saved, session, sampleEvent: LANTERN_IN_THE_STATIC_SAMPLE_EVENT };
  }
  return { ok: true, errors: [], warnings: [], session, sampleEvent: LANTERN_IN_THE_STATIC_SAMPLE_EVENT };
}

export function resolveTravelV2DevToolAction(session, action, options = {}) {
  if (action === "forceOutcome") return forceTravelV2Outcome(session, options.outcomeKey, options);
  if (action === "forceCurrentRoundResult") return forceTravelV2CurrentRoundResults(session, options.outcomeKey, options);
  if (action === "earlyEnd") return forceTravelV2EarlyEndRound(session, options);
  if (action === "finalizeRound") return finalizeTravelV2RoundOnRunnerSession(session, options);
  if (action === "completeEvent") return completeTravelV2EventOnRunnerSession(session, options);
  if (action === "debugReport") return copyTravelV2DebugReport(session, options);
  return { ok: false, session, error: `Unknown Travel v2 dev tool action: ${action}` };
}
