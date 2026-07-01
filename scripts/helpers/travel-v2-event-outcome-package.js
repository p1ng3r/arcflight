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
  if (Array.isArray(session.summary?.rounds)) return session.summary.rounds.filter(isPlainObject);
  return Array.isArray(session.roundResults) ? session.roundResults.filter(isPlainObject) : [];
}
function outcomeFromLiveRoundResult(roundResult = {}, index = 0) {
  const explicit = normalizeOutcomeKey(roundResult.effectiveOutcomeKey ?? roundResult.outcomeKey ?? roundResult.selectedOutcomeKey ?? roundResult.roundOutcomeKey);
  if (explicit) return explicit;
  const stationResults = isPlainObject(roundResult.stationResults) ? Object.values(roundResult.stationResults) : [];
  const resolvedResults = stationResults.filter((result) => typeof result === "string" && result.trim());
  if (!resolvedResults.length) return "not-run";
  const scoredResults = resolvedResults.filter((result) => Object.hasOwn(RESULT_SCORES, result));
  if (!scoredResults.length) return "not-run";
  const score = scoredResults.reduce((sum, result) => sum + (RESULT_SCORES[result] ?? 0), 0);
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
  if (roundSummaries.length && roundSummaries.every((record) => record.outcomeKey === "not-run")) return "not-run";
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
function summaryNarrativeCandidate(session = {}, eventOutcomeKey = "") {
  const text = typeof session.summary?.finalOutcomeText === "string" ? session.summary.finalOutcomeText.trim() : "";
  if (!text) return null;
  return {
    name: session.summary?.suggestedFinalOutcomeLabel ?? humanizeIdentifier(eventOutcomeKey),
    text,
    sourceType: "summary.finalOutcomeText"
  };
}
function appendSummaryNarrativeFallback(candidates = [], session = {}, eventOutcomeKey = "", type = "") {
  if (candidates.length) return candidates;
  const candidate = summaryNarrativeCandidate(session, eventOutcomeKey);
  if (!candidate) return candidates;
  if (type === "reward" && ["critical-success", "success"].includes(eventOutcomeKey)) return [...candidates, candidate];
  if (type === "consequence" && ["mixed", "failure", "critical-failure"].includes(eventOutcomeKey)) return [...candidates, candidate];
  return candidates;
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
  const rewardCandidates = appendSummaryNarrativeFallback(combineCandidates(collectCandidates(session, ["rewardCandidates", "travelV2RewardCandidates", "rewards"]), collectFinalOutcomeCandidates(finalOutcome, ["rewardCandidates"], ["rewards"])), session, eventOutcomeKey, "reward");
  const consequenceCandidates = appendSummaryNarrativeFallback(combineCandidates(collectCandidates(session, ["consequenceCandidates", "travelV2ConsequenceCandidates", "consequences"]), collectFinalOutcomeCandidates(finalOutcome, ["consequenceCandidates"], ["losses", "consequences"])), session, eventOutcomeKey, "consequence");
  const summaryText = `Travel v2 event outcome package prepared: ${eventOutcomeLabel}.`;
  const nextStepText = "GM may review and apply this package to lock a session-local outcome record. Actor/item mutation is intentionally deferred.";
  const packageRecord = { version: TRAVEL_V2_EVENT_OUTCOME_PACKAGE_VERSION, preparedAt: options.preparedAt ?? options.now ?? null, eventOutcomeKey, eventOutcomeLabel, completedAt: session.completedAt ?? session.travelV2EventCompletion?.completedAt ?? null, roundSummaries: cloneData(roundSummaries), pressureSummary: cloneData(pressureSummary), hazardSummary: cloneData(hazardSummary), shipScarCandidates: cloneData(shipScarCandidates), fortuneCandidates: cloneData(fortuneCandidates), rewardCandidates: cloneData(rewardCandidates), consequenceCandidates: cloneData(consequenceCandidates), summaryText, nextStepText };
  return deepFreeze({ version: TRAVEL_V2_EVENT_OUTCOME_PACKAGE_VERSION, hasSession: true, canPreparePackage: true, blockedReasons: [], status: "ready", isCompleted: true, alreadyApplied: Boolean(session.travelV2EventOutcomeApplication?.applied), completedAt: packageRecord.completedAt, eventRoundCount: rounds.length, finalizedRoundCount: finalizationRecords.length, roundSummaries, pressureSummary, hazardSummary, shipScarCandidates, fortuneCandidates, rewardCandidates, consequenceCandidates, eventOutcomeKey, eventOutcomeLabel, summaryText, nextStepText, packageRecord });
}

const PUBLIC_ENTRY_KEYS = Object.freeze(["id", "key", "name", "label", "title", "text", "summary", "description", "sourceType", "status", "roundIndex", "roundNumber", "outcomeKey", "finalizedAt", "playerText", "publicText", "displayText"]);
function userIsGm(options = {}) { return options.user?.isGM === true || options.isGM === true || globalThis.game?.user?.isGM === true; }
function publicEntry(value = {}) {
  if (!isPlainObject(value)) return value;
  const output = {};
  for (const key of PUBLIC_ENTRY_KEYS) {
    if (value[key] !== undefined) output[key] = cloneData(value[key]);
  }
  if (!Object.keys(output).length) output.text = String(value.name ?? value.label ?? value.title ?? value.text ?? value.summary ?? "").trim();
  return output;
}
function publicEntries(values = []) { return (Array.isArray(values) ? values : []).map(publicEntry).filter((entry) => !isPlainObject(entry) || Object.values(entry).some((value) => String(value ?? "").trim())); }
function reviewSection(key, label, entries = [], options = {}) {
  const safeEntries = options.publicSafe ? publicEntries(entries) : cloneData(Array.isArray(entries) ? entries : []);
  return { key, label, entries: safeEntries, count: safeEntries.length, hasEntries: safeEntries.length > 0, emptyText: `No ${label.toLowerCase()} in this outcome package.`, visibilityLabel: options.gmOnly ? "GM-only" : "Public-safe", statusLabel: options.deferred ? "Deferred to later PR" : "Review only" };
}
function pressureReviewSummary(pressureSummary = {}, options = {}) {
  const totals = isPlainObject(pressureSummary.totalsByPressureType) ? Object.entries(pressureSummary.totalsByPressureType).map(([key, value]) => ({ key, label: humanizeIdentifier(key), value })) : [];
  return { current: options.publicSafe ? {} : cloneData(pressureSummary.current ?? {}), totalsByPressureType: totals, applicationRecordCount: Array.isArray(pressureSummary.applicationRecords) ? pressureSummary.applicationRecords.length : 0, applicationRecords: options.includeManagementDetails ? cloneData(pressureSummary.applicationRecords ?? []) : [] };
}
function baseReviewState(session, options = {}) {
  const outcomePackage = prepareTravelV2EventOutcomePackage(session, options);
  const publicSafe = options.publicSafe === true;
  const includeManagementDetails = options.includeManagementDetails === true;
  const statusLabel = outcomePackage.alreadyApplied ? "Already applied" : (outcomePackage.canPreparePackage ? "Pending" : "Review only");
  const sections = {
    rounds: reviewSection("rounds", "Round Summary", outcomePackage.roundSummaries, { publicSafe }),
    pressure: { key: "pressure", label: "Pressure Summary", ...pressureReviewSummary(outcomePackage.pressureSummary, { publicSafe, includeManagementDetails }), visibilityLabel: publicSafe ? "Public-safe" : "GM-only", statusLabel: "Review only", hasEntries: Boolean(Object.keys(outcomePackage.pressureSummary?.totalsByPressureType ?? {}).length), emptyText: "No pressure applications in this outcome package." },
    hazards: reviewSection("hazards", "Hazards", outcomePackage.hazardSummary, { publicSafe }),
    shipScars: reviewSection("shipScars", "Ship Scars", outcomePackage.shipScarCandidates, { publicSafe, gmOnly: !publicSafe, deferred: true }),
    fortunes: reviewSection("fortunes", "Fortunes", outcomePackage.fortuneCandidates, { publicSafe, deferred: true }),
    rewards: reviewSection("rewards", "Rewards", outcomePackage.rewardCandidates, { publicSafe, deferred: true }),
    consequences: reviewSection("consequences", "Consequences", outcomePackage.consequenceCandidates, { publicSafe, gmOnly: !publicSafe, deferred: true })
  };
  return deepFreeze({ version: TRAVEL_V2_EVENT_OUTCOME_PACKAGE_VERSION, title: "Final Outcome Package Review", status: outcomePackage.status, canPreparePackage: outcomePackage.canPreparePackage, blockedReasons: cloneData(outcomePackage.blockedReasons), hasBlockedReasons: outcomePackage.blockedReasons.length > 0, isCompleted: outcomePackage.isCompleted, alreadyApplied: outcomePackage.alreadyApplied, completedAt: outcomePackage.completedAt, eventRoundCount: outcomePackage.eventRoundCount, finalizedRoundCount: outcomePackage.finalizedRoundCount, eventOutcomeKey: outcomePackage.eventOutcomeKey, eventOutcomeLabel: outcomePackage.eventOutcomeLabel, summaryText: outcomePackage.summaryText, nextStepText: outcomePackage.nextStepText, reviewOnlyLabel: "Review only", pendingLabel: "Pending", alreadyAppliedLabel: "Already applied", deferredLabel: "Deferred to later PR", gmOnlyLabel: "GM-only", publicSafeLabel: "Public-safe", statusLabel, applyStatusLabel: outcomePackage.alreadyApplied ? "Already applied" : "Deferred to later PR", sections, roundSummaries: sections.rounds.entries, pressureSummary: sections.pressure, hazardSummary: sections.hazards.entries, shipScarCandidates: sections.shipScars.entries, fortuneCandidates: sections.fortunes.entries, rewardCandidates: sections.rewards.entries, consequenceCandidates: sections.consequences.entries, managementDetails: includeManagementDetails ? { packageRecord: cloneData(outcomePackage.packageRecord), rawApplicationRecord: cloneData(session?.travelV2EventOutcomeApplication ?? null), marker: "GM-only management details" } : null });
}
export function prepareTravelV2FinalOutcomePackagePublicState(session, options = {}) { return baseReviewState(session, { ...options, publicSafe: true, includeManagementDetails: false }); }
export function prepareTravelV2FinalOutcomePackageGmState(session, options = {}) { return userIsGm(options) ? baseReviewState(session, { ...options, publicSafe: false, includeManagementDetails: true }) : prepareTravelV2FinalOutcomePackagePublicState(session, options); }
export function prepareTravelV2FinalOutcomePackageReviewState(session, options = {}) { return userIsGm(options) ? prepareTravelV2FinalOutcomePackageGmState(session, options) : prepareTravelV2FinalOutcomePackagePublicState(session, options); }

export default prepareTravelV2EventOutcomePackage;
