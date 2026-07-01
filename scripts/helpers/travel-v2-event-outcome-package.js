import { getShipTravelResources, previewShipTravelResourceChange, updateShipTravelResources } from "../documents/ships.js";
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
  const finalOutcomes = isPlainObject(session?.event?.finalOutcomes) ? session.event.finalOutcomes : {};
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
function userIsGm(options = {}) {
  if (typeof options.user?.isGM === "boolean") return options.user.isGM === true;
  if (typeof options.isGM === "boolean") return options.isGM === true;
  return globalThis.game?.user?.isGM === true;
}
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
  return deepFreeze({ version: TRAVEL_V2_EVENT_OUTCOME_PACKAGE_VERSION, title: "Final Outcome Package Review", status: outcomePackage.status, canPreparePackage: outcomePackage.canPreparePackage, blockedReasons: cloneData(outcomePackage.blockedReasons), hasBlockedReasons: outcomePackage.blockedReasons.length > 0, isCompleted: outcomePackage.isCompleted, alreadyApplied: outcomePackage.alreadyApplied, completedAt: outcomePackage.completedAt, eventRoundCount: outcomePackage.eventRoundCount, finalizedRoundCount: outcomePackage.finalizedRoundCount, eventOutcomeKey: outcomePackage.eventOutcomeKey, eventOutcomeLabel: outcomePackage.eventOutcomeLabel, summaryText: outcomePackage.summaryText, nextStepText: outcomePackage.nextStepText, reviewOnlyLabel: "Review only", pendingLabel: "Pending", alreadyAppliedLabel: "Already applied", deferredLabel: "Deferred to later PR", gmOnlyLabel: "GM-only", publicSafeLabel: "Public-safe", statusLabel, applyStatusLabel: outcomePackage.alreadyApplied ? "Already applied" : "Deferred to later PR", sections, roundSummaries: sections.rounds.entries, pressureSummary: sections.pressure, hazardSummary: sections.hazards.entries, shipScarCandidates: sections.shipScars.entries, fortuneCandidates: sections.fortunes.entries, rewardCandidates: sections.rewards.entries, consequenceCandidates: sections.consequences.entries, applyState: includeManagementDetails ? prepareTravelV2FinalOutcomeApplyState(session, options) : playerSafeApplyState(), managementDetails: includeManagementDetails ? { packageRecord: cloneData(outcomePackage.packageRecord), rawApplicationRecord: cloneData(session?.travelV2EventOutcomeApplication ?? null), marker: "GM-only management details" } : null });
}

const APPLY_RESOURCE_KEYS = Object.freeze(["hull", "strain", "lifeveil", "morale", "supplies"]);
const APPLY_RESOURCE_MODES = Object.freeze(["add", "set"]);
const SHIP_APPLICATION_SESSION_KEY = "travelV2FinalOutcomeShipApplication";
function nowIso(options = {}) { return options.now ?? new Date().toISOString(); }
function resolveApplyActor(session = {}, options = {}) {
  const explicit = options.actor ?? options.targetActor ?? null;
  if (explicit) return explicit;
  const id = options.actorId ?? options.targetActorId ?? session?.ship?.actorId ?? "";
  const uuid = options.actorUuid ?? options.targetActorUuid ?? session?.ship?.actorUuid ?? "";
  if (id) return globalThis.game?.actors?.get?.(String(id)) ?? null;
  if (uuid && globalThis.fromUuidSync) { try { return globalThis.fromUuidSync(uuid); } catch (_error) { return null; } }
  return null;
}
function stagedEffectsForApply(session = {}, options = {}) {
  if (!isPlainObject(session)) return [];
  const outcomePackage = prepareTravelV2EventOutcomePackage(session, options);
  if (!outcomePackage.canPreparePackage) return [];
  const eventOutcome = finalOutcomeFor(session, outcomePackage.eventOutcomeKey);
  const summaryEffects = Array.isArray(session?.summary?.stagedProposedEffects) ? session.summary.stagedProposedEffects : [];
  const eventEffects = Array.isArray(eventOutcome?.proposedEffects) ? eventOutcome.proposedEffects : [];
  return summaryEffects.length ? cloneData(summaryEffects) : cloneData(eventEffects);
}
function normalizeApplyEffect(effect = {}, index = 0, actor = null) {
  const label = typeof effect?.label === "string" && effect.label.trim() ? effect.label.trim() : `Final Outcome Effect ${index + 1}`;
  const base = { index, label, type: effect?.type ?? "unsupported", resource: effect?.resource ?? "", mode: effect?.mode ?? "", value: effect?.value ?? null, currentValue: null, delta: null, previewValue: null, status: "unsupported", supported: false, reason: "Unsupported final outcome package part.", deferredLabel: "Review only", raw: cloneData(effect) };
  if (!isPlainObject(effect)) return { ...base, reason: "Effect is not a data object." };
  if (effect.type !== "resource") return base;
  const value = Number(effect.value);
  if (!APPLY_RESOURCE_KEYS.includes(effect.resource)) return { ...base, status: "unsupported", reason: `Unsupported resource ${effect.resource ?? "<missing>"}.` };
  if (!APPLY_RESOURCE_MODES.includes(effect.mode)) return { ...base, status: "unsupported", reason: `Unsupported resource mode ${effect.mode ?? "<missing>"}.` };
  if (!Number.isFinite(value)) return { ...base, status: "unsupported", reason: "Resource value must be numeric." };
  if (!actor) return { ...base, value, status: "blocked", reason: "Target ship actor is required for preview." };
  try {
    const before = getShipTravelResources(actor);
    const delta = effect.mode === "set" ? value - before[effect.resource] : value;
    const helperPreview = previewShipTravelResourceChange(actor, { [effect.resource]: delta });
    return { ...base, value, currentValue: helperPreview.before[effect.resource], delta, previewValue: helperPreview.after[effect.resource], status: "ready", supported: true, reason: "Supported ship resource update.", warnings: helperPreview.warnings ?? [] };
  } catch (_error) {
    return { ...base, value, status: "blocked", reason: "Target actor is not an Arcflight ship/PF2E vehicle actor." };
  }
}
function deferredRowsFromPackage(pkg = {}) {
  const map = [
    ["shipScars", "Ship Scars", pkg.shipScarCandidates, "Deferred to later PR"],
    ["fortunes", "Fortunes", pkg.fortuneCandidates, "Deferred to later PR"],
    ["hazards", "Hazards", pkg.hazardSummary, "Review only"],
    ["rewards", "Rewards", pkg.rewardCandidates, "Review only / Deferred to later PR"],
    ["consequences", "Consequences", pkg.consequenceCandidates, "Review only / Deferred to later PR"]
  ];
  return map.flatMap(([key, label, values, statusLabel]) => (Array.isArray(values) ? values : []).map((entry, index) => ({ key, label, index, status: "deferred", statusLabel, supported: false, reason: statusLabel, entry: cloneData(entry) })));
}
function playerSafeApplyState(reason = "Only GMs can preview or apply final outcome ship updates.") { return deepFreeze({ isGM: false, available: false, canApply: false, disabled: true, disabledReason: reason, rows: [], supportedRows: [], unsupportedRows: [], deferredRows: [], records: [], changes: {} }); }
function blockedGmApplyState(outcomePackage = {}, reason = "Travel v2 runner session must be completed before applying final outcome ship updates.") {
  const disabledReason = outcomePackage.blockedReasons?.[0] ?? reason;
  return deepFreeze({ isGM: true, available: false, canApply: false, disabled: true, disabledReason, rows: [], supportedRows: [], unsupportedRows: [], deferredRows: [], changes: {}, packageAlreadyApplied: outcomePackage.alreadyApplied === true, shipAlreadyApplied: false, alreadyApplied: false });
}
export function prepareTravelV2FinalOutcomeShipUpdatePreview(session, options = {}) {
  if (!userIsGm(options)) return playerSafeApplyState();
  const outcomePackage = prepareTravelV2EventOutcomePackage(session, options);
  if (!outcomePackage.canPreparePackage) return blockedGmApplyState(outcomePackage);
  const actor = resolveApplyActor(session, options);
  const rows = stagedEffectsForApply(session, options).map((effect, index) => normalizeApplyEffect(effect, index, actor));
  const supportedRows = rows.filter((row) => row.supported);
  const unsupportedRows = rows.filter((row) => !row.supported);
  const deferredRows = deferredRowsFromPackage(outcomePackage);
  const reasons = [];
  if (!outcomePackage.isCompleted) reasons.push("Travel v2 runner session must be completed before applying final outcome ship updates.");
  const shipApplicationRecord = isPlainObject(session?.[SHIP_APPLICATION_SESSION_KEY]) ? session[SHIP_APPLICATION_SESSION_KEY] : null;
  const shipAlreadyApplied = shipApplicationRecord?.applied === true;
  if (shipAlreadyApplied) reasons.push("This final outcome ship update has already been applied to a ship.");
  if (!actor) reasons.push("Select or resolve a target ship actor before applying final outcome updates.");
  else { try { getShipTravelResources(actor); } catch (_e) { reasons.push("Target actor is not an Arcflight ship/PF2E vehicle actor."); } }
  if (!supportedRows.length) reasons.push("No supported ship resource updates are present in the final outcome package.");
  const changes = supportedRows.reduce((acc, row) => { acc[row.resource] = (Number(acc[row.resource]) || 0) + row.delta; return acc; }, {});
  return deepFreeze({ isGM: true, available: outcomePackage.isCompleted, canApply: reasons.length === 0, disabled: reasons.length > 0, disabledReason: reasons[0] ?? "Ready to apply supported ship resource updates.", targetActorId: actor?.id ?? "", targetActorName: actor?.name ?? "", packageVersion: outcomePackage.version, reviewVersion: outcomePackage.version, alreadyApplied: shipAlreadyApplied, shipAlreadyApplied, packageAlreadyApplied: outcomePackage.alreadyApplied, applicationRecord: cloneData(shipApplicationRecord), rows, supportedRows, unsupportedRows, deferredRows, changes });
}
export function prepareTravelV2FinalOutcomeApplyState(session, options = {}) { return prepareTravelV2FinalOutcomeShipUpdatePreview(session, options); }
export function buildTravelV2FinalOutcomeApplicationRecord(session, preview, options = {}) {
  return { applied: true, appliedAt: nowIso(options), appliedBy: options.user?.id ?? options.user?.name ?? globalThis.game?.user?.id ?? globalThis.game?.user?.name ?? "", targetActorId: preview.targetActorId, targetActorName: preview.targetActorName, packageVersion: preview.packageVersion, reviewVersion: preview.reviewVersion, rowsApplied: cloneData(preview.supportedRows), before: Object.fromEntries(preview.supportedRows.map((row) => [row.resource, row.currentValue])), after: Object.fromEntries(preview.supportedRows.map((row) => [row.resource, row.previewValue])), unsupportedRows: cloneData(preview.unsupportedRows), deferredRows: cloneData(preview.deferredRows) };
}
export async function applyTravelV2FinalOutcomeToShip(session, options = {}) {
  const preview = prepareTravelV2FinalOutcomeShipUpdatePreview(session, options);
  if (!preview.isGM) return { ok: false, applied: false, blocked: true, blockedReasons: [preview.disabledReason], session: cloneData(session) };
  if (!preview.canApply) return { ok: false, applied: false, blocked: true, blockedReasons: [preview.disabledReason], preview, session: cloneData(session) };
  const actor = resolveApplyActor(session, options);
  if (!actor?.update) return { ok: false, applied: false, blocked: true, blockedReasons: ["Target ship actor update API is unavailable."], preview, session: cloneData(session) };
  if (!options.dryRun) await updateShipTravelResources(actor, preview.changes, options.resourceOptions ?? {});
  const record = buildTravelV2FinalOutcomeApplicationRecord(session, preview, options);
  const nextSession = cloneData(session);
  if (!options.dryRun) { nextSession[SHIP_APPLICATION_SESSION_KEY] = record; nextSession.updatedAt = nowIso(options); }
  return { ok: true, applied: !options.dryRun, dryRun: options.dryRun === true, blocked: false, blockedReasons: [], preview, record, session: nextSession };
}

export function prepareTravelV2FinalOutcomePackagePublicState(session, options = {}) { return baseReviewState(session, { ...options, publicSafe: true, includeManagementDetails: false }); }
export function prepareTravelV2FinalOutcomePackageGmState(session, options = {}) { return userIsGm(options) ? baseReviewState(session, { ...options, publicSafe: false, includeManagementDetails: true }) : prepareTravelV2FinalOutcomePackagePublicState(session, options); }
export function prepareTravelV2FinalOutcomePackageReviewState(session, options = {}) { return userIsGm(options) ? prepareTravelV2FinalOutcomePackageGmState(session, options) : prepareTravelV2FinalOutcomePackagePublicState(session, options); }

export default prepareTravelV2EventOutcomePackage;
