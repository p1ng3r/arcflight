export const TRAVEL_V2_EVENT_OUTCOME_PACKAGE_VERSION = 1;

function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function cloneData(value) { if (value === null || value === undefined) return value; return JSON.parse(JSON.stringify(value)); }
function deepFreeze(value) { if (!isPlainObject(value) && !Array.isArray(value)) return value; for (const nested of Object.values(value)) deepFreeze(nested); return Object.freeze(value); }
function recordsFromContainer(container) { if (Array.isArray(container)) return container; if (Array.isArray(container?.records)) return container.records; return []; }
function humanizeIdentifier(value) { return String(value ?? "").replace(/[-_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function isCompletedSession(session = {}) { return session?.status === "completed" || session?.completed === true || Boolean(session?.completedAt && session?.status !== "active"); }
function outcomeFrom(record = {}) { return record?.effectiveOutcomeKey ?? record?.outcomeKey ?? record?.selectedOutcomeKey ?? null; }
function normalizeOutcomeKey(value) {
  const key = String(value ?? "").trim();
  if (["critical-success", "criticalSuccess", "critical_success"].includes(key)) return "critical-success";
  if (key === "success") return "success";
  if (key === "mixed") return "mixed";
  if (key === "failure") return "failure";
  if (["critical-failure", "criticalFailure", "critical_failure"].includes(key)) return "critical-failure";
  return "";
}

function finalOutcomeKeyForPackage(value) {
  return normalizeOutcomeKey(value) || "mixed";
}
const RESULT_SCORES = Object.freeze({ criticalSuccess: 2, success: 1, failure: -1, criticalFailure: -2 });
function scoreToOutcome(score) {
  if (score >= 4) return "critical-success";
  if (score > 0) return "success";
  if (score === 0) return "mixed";
  if (score <= -4) return "critical-failure";
  return "failure";
}
function liveRoundResults(session = {}) {
  return Array.isArray(session.roundResults) ? session.roundResults.filter(isPlainObject) : [];
}
function outcomeFromLiveRoundResult(roundResult = {}, index = 0) {
  const explicit = normalizeOutcomeKey(roundResult.effectiveOutcomeKey ?? roundResult.outcomeKey ?? roundResult.selectedOutcomeKey ?? roundResult.roundOutcomeKey);
  if (explicit) return explicit;
  const stationResults = isPlainObject(roundResult.stationResults) ? Object.values(roundResult.stationResults) : [];
  if (!stationResults.length) return null;
  const score = stationResults.reduce((sum, result) => sum + (RESULT_SCORES[result] ?? 0), 0);
  return scoreToOutcome(score);
}
function roundSummariesFromLiveSession(session = {}) {
  return liveRoundResults(session).map((roundResult, index) => ({
    roundIndex: roundResult.roundIndex ?? index,
    roundNumber: roundResult.roundNumber ?? index + 1,
    outcomeKey: outcomeFromLiveRoundResult(roundResult, index),
    finalizedAt: roundResult.finalizedAt ?? session.completedAt ?? null,
    stationSummary: cloneData(roundResult.stationSummary ?? roundResult.stationResults ?? null)
  }));
}
function eventOutcomeFromLiveSession(session = {}, fallbackRecords = []) {
  const summaryValue = session.summary?.suggestedFinalOutcome ?? session.summary?.finalOutcomeKey ?? session.summary?.eventOutcomeKey;
  if (summaryValue !== undefined && summaryValue !== null && String(summaryValue).trim()) return finalOutcomeKeyForPackage(summaryValue);
  const roundSummaries = roundSummariesFromLiveSession(session).filter((record) => record.outcomeKey);
  if (roundSummaries.length) return summarizeOutcome(roundSummaries);
  if (fallbackRecords.length) return summarizeOutcome(fallbackRecords);
  return "mixed";
}
function summarizeOutcome(records = []) {
  const outcomes = records.map(outcomeFrom).map(normalizeOutcomeKey).filter(Boolean);
  if (!outcomes.length) return "mixed";
  const count = (key) => outcomes.filter((outcome) => outcome === key).length;
  const criticalSuccess = count("critical-success");
  const criticalFailure = count("critical-failure");
  const successLike = criticalSuccess + count("success");
  const failureLike = criticalFailure + count("failure");
  const threshold = Math.max(1, Math.ceil(outcomes.length / 2));
  if (criticalSuccess >= threshold) return "critical-success";
  if (criticalFailure >= threshold) return "critical-failure";
  if (successLike > failureLike) return "success";
  if (failureLike > successLike) return "failure";
  return "mixed";
}
function pressureSummaryFrom(session = {}, records = []) {
  const totals = {};
  for (const record of records) {
    for (const [key, value] of Object.entries(record?.totalsByPressureType ?? record?.pressureSummary?.totalsByPressureType ?? {})) {
      totals[key] = (Number(totals[key]) || 0) + (Number(value) || 0);
    }
  }
  return { current: cloneData(session.pressure ?? {}), totalsByPressureType: totals, applicationRecords: cloneData(records) };
}
function collectCandidates(session = {}, keys = []) {
  const collected = [];
  for (const key of keys) {
    const value = session[key];
    if (Array.isArray(value)) collected.push(...value);
    else if (Array.isArray(value?.records)) collected.push(...value.records);
    else if (Array.isArray(value?.pending)) collected.push(...value.pending);
    else if (Array.isArray(value?.pendingDraws)) collected.push(...value.pendingDraws);
    else if (isPlainObject(value)) collected.push(value);
  }
  return cloneData(collected);
}

function finalOutcomeFor(session = {}, outcomeKey = "") {
  const finalOutcomes = isPlainObject(session.event?.finalOutcomes) ? session.event.finalOutcomes : {};
  const aliases = {
    "critical-success": ["criticalSuccess", "critical-success", "critical_success"],
    "critical-failure": ["criticalFailure", "critical-failure", "critical_failure"]
  };
  for (const key of aliases[outcomeKey] ?? [outcomeKey]) {
    if (isPlainObject(finalOutcomes[key])) return finalOutcomes[key];
  }
  return {};
}
function valueCandidate(value, type) {
  if (isPlainObject(value)) return cloneData(value);
  const text = String(value ?? "").trim();
  return text ? { name: text, text, sourceType: type } : null;
}
function collectFinalOutcomeCandidates(finalOutcome = {}, explicitKeys = [], legacyKeys = []) {
  const collected = [];
  for (const key of explicitKeys) {
    if (Array.isArray(finalOutcome[key])) collected.push(...finalOutcome[key].map((value) => valueCandidate(value, key)).filter(Boolean));
  }
  for (const key of legacyKeys) {
    if (Array.isArray(finalOutcome[key])) collected.push(...finalOutcome[key].map((value) => valueCandidate(value, key)).filter(Boolean));
  }
  return cloneData(collected);
}
function combineCandidates(...lists) {
  return cloneData(lists.flat().filter((entry) => entry !== null && entry !== undefined));
}

function blocked(session, reasons) {
  return deepFreeze({ version: TRAVEL_V2_EVENT_OUTCOME_PACKAGE_VERSION, hasSession: isPlainObject(session), canPreparePackage: false, blockedReasons: cloneData(reasons), status: "blocked", isCompleted: isPlainObject(session) ? isCompletedSession(session) : false, alreadyApplied: Boolean(session?.travelV2EventOutcomeApplication?.applied), completedAt: session?.completedAt ?? null, eventRoundCount: 0, finalizedRoundCount: 0, roundSummaries: [], pressureSummary: {}, hazardSummary: [], shipScarCandidates: [], fortuneCandidates: [], rewardCandidates: [], consequenceCandidates: [], eventOutcomeKey: "mixed", eventOutcomeLabel: "Mixed", summaryText: reasons[0] ?? "Travel v2 event outcome package is blocked.", nextStepText: reasons[0] ?? "Complete the event before preparing an outcome package.", packageRecord: null });
}
export function prepareTravelV2EventOutcomePackage(session, options = {}) {
  const reasons = [];
  if (!isPlainObject(session)) reasons.push("Travel v2 runner session is required.");
  if (isPlainObject(session) && !isCompletedSession(session)) reasons.push("Travel v2 runner session must be completed before outcome package preparation.");
  if (isPlainObject(session) && !isPlainObject(session.travelV2EventCompletion) && !isPlainObject(session.summary) && !Array.isArray(session.roundResults)) reasons.push("Completed Travel v2 runner session is missing its completion summary or live round results.");
  if (reasons.length) return blocked(session, reasons);

  const rounds = Array.isArray(session.event?.rounds) ? session.event.rounds : [];
  const explicitFinalizationRecords = recordsFromContainer(session.travelV2RoundResolutions).filter(isPlainObject);
  const liveRoundSummaries = roundSummariesFromLiveSession(session).filter((record) => record.outcomeKey || record.stationSummary);
  const finalizationRecords = explicitFinalizationRecords.length ? explicitFinalizationRecords : liveRoundSummaries;
  const roundSummaries = finalizationRecords.map((record) => ({ roundIndex: record.roundIndex ?? null, roundNumber: record.roundNumber ?? null, outcomeKey: outcomeFrom(record), finalizedAt: record.finalizedAt ?? record.createdAt ?? session.completedAt ?? null, stationSummary: cloneData(record.stationSummary ?? null) }));
  const pressureRecords = recordsFromContainer(session.travelV2PressureApplications).filter(isPlainObject);
  const eventOutcomeKey = explicitFinalizationRecords.length ? summarizeOutcome(explicitFinalizationRecords) : eventOutcomeFromLiveSession(session, finalizationRecords);
  const eventOutcomeLabel = humanizeIdentifier(eventOutcomeKey);
  const pressureSummary = pressureSummaryFrom(session, pressureRecords);
  const finalOutcome = finalOutcomeFor(session, eventOutcomeKey);
  const hazardSummary = combineCandidates(collectCandidates(session, ["hazards", "travelV2Hazards", "hazardSummary", "hazardCandidates"]), collectFinalOutcomeCandidates(finalOutcome, ["hazardCandidates", "hazards"], []));
  const shipScarCandidates = combineCandidates(collectCandidates(session, ["shipScars", "travelV2ShipScars", "shipScarCandidates"]), collectFinalOutcomeCandidates(finalOutcome, ["shipScarCandidates", "shipScars"], []));
  const fortuneCandidates = combineCandidates(collectCandidates(session, ["fortuneCandidates", "travelV2FortuneCandidates", "fortunes"]), collectFinalOutcomeCandidates(finalOutcome, ["fortuneCandidates", "fortunes"], []));
  const rewardCandidates = combineCandidates(collectCandidates(session, ["rewardCandidates", "travelV2RewardCandidates", "rewards"]), collectFinalOutcomeCandidates(finalOutcome, ["rewardCandidates"], ["rewards"]));
  const consequenceCandidates = combineCandidates(collectCandidates(session, ["consequenceCandidates", "travelV2ConsequenceCandidates", "consequences"]), collectFinalOutcomeCandidates(finalOutcome, ["consequenceCandidates"], ["losses", "consequences"]));
  const summaryText = `Travel v2 event outcome package prepared: ${eventOutcomeLabel}.`;
  const nextStepText = "GM may review and apply this package to lock a session-local outcome record. Actor/item mutation is intentionally deferred.";
  const packageRecord = { version: TRAVEL_V2_EVENT_OUTCOME_PACKAGE_VERSION, preparedAt: options.preparedAt ?? options.now ?? null, eventOutcomeKey, eventOutcomeLabel, completedAt: session.completedAt ?? session.travelV2EventCompletion?.completedAt ?? null, roundSummaries: cloneData(roundSummaries), pressureSummary: cloneData(pressureSummary), hazardSummary: cloneData(hazardSummary), shipScarCandidates: cloneData(shipScarCandidates), fortuneCandidates: cloneData(fortuneCandidates), rewardCandidates: cloneData(rewardCandidates), consequenceCandidates: cloneData(consequenceCandidates), summaryText, nextStepText };
  return deepFreeze({ version: TRAVEL_V2_EVENT_OUTCOME_PACKAGE_VERSION, hasSession: true, canPreparePackage: true, blockedReasons: [], status: "ready", isCompleted: true, alreadyApplied: Boolean(session.travelV2EventOutcomeApplication?.applied), completedAt: packageRecord.completedAt, eventRoundCount: rounds.length, finalizedRoundCount: finalizationRecords.length, roundSummaries, pressureSummary, hazardSummary, shipScarCandidates, fortuneCandidates, rewardCandidates, consequenceCandidates, eventOutcomeKey, eventOutcomeLabel, summaryText, nextStepText, packageRecord });
}
export default prepareTravelV2EventOutcomePackage;
