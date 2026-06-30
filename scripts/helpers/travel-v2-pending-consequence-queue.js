import { prepareTravelV2EventOutcomePackage } from "./travel-v2-event-outcome-package.js";
import { getTravelV2ConsequenceById, getTravelV2ConsequencesBySource } from "../../data/travel-events/travel-v2-consequence-catalog.js";

export const TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION = 1;
const QUEUE_STATUSES = Object.freeze(["pending", "applied", "dismissed", "deferred"]);
const FOLLOWUP_STATUSES = Object.freeze(["open", "reviewed", "deferred", "resolved"]);
const FOLLOWUP_STATUS_LABELS = Object.freeze({ open: "Open", reviewed: "Reviewed", deferred: "Deferred", resolved: "Resolved" });
export const TRAVEL_V2_SELECTED_CONSEQUENCE_APPLY_PREVIEW_WARNING = "Preview only. This does not apply pressure, ship scars, actor/item changes, chat, journals, combat, scenes, tokens, sockets, compendia, or world data.";
export const TRAVEL_V2_SELECTED_CONSEQUENCE_MANUAL_APPLY_UNSUPPORTED = "Manual Apply is not implemented for this consequence type yet.";
const SUPPORTED_SESSION_PRESSURE_CONSEQUENCE_APPLIES = Object.freeze({
  "consequence-hull-stress": Object.freeze({ affectedTrack: "Hull", pressureTrack: "hull", pressureDelta: 1, severity: "minor" }),
  "consequence-crew-panic": Object.freeze({ affectedTrack: "Morale", pressureTrack: "morale", pressureDelta: 1, severity: "minor" }),
  "consequence-supplies-delay": Object.freeze({ affectedTrack: "Supplies", pressureTrack: "supplies", pressureDelta: 1, severity: "minor" }),
  "consequence-arkengine-whine": Object.freeze({ affectedTrack: "Strain", pressureTrack: "strain", pressureDelta: 1, severity: "minor" }),
  "consequence-veil-draft": Object.freeze({ affectedTrack: "Lifeveil", pressureTrack: "lifeveil", pressureDelta: 1, severity: "minor" }),
  "consequence-watch-fatigue": Object.freeze({ affectedTrack: "Morale", pressureTrack: "morale", pressureDelta: 1, severity: "minor" }),
  "consequence-arkengine-surge": Object.freeze({ affectedTrack: "Strain", pressureTrack: "strain", pressureDelta: 1, severity: "major" }),
  "consequence-lifeveil-flicker": Object.freeze({ affectedTrack: "Lifeveil", pressureTrack: "lifeveil", pressureDelta: 1, severity: "major" })
});
const SUPPORTED_SESSION_FOLLOWUP_CONSEQUENCE_APPLIES = Object.freeze({
  "consequence-course-slip": Object.freeze({ affectedTrack: "Route", kind: "finalOutcomeCandidate" }),
  "consequence-signal-echo": Object.freeze({ affectedTrack: "Threat", kind: "encounterSeedCandidate" }),
  "consequence-stores-tangle": Object.freeze({ affectedTrack: "Supplies", kind: "complicationCandidate" }),
  "consequence-route-drift": Object.freeze({ affectedTrack: "Route", kind: "finalOutcomeCandidate" }),
  "consequence-cargo-shift": Object.freeze({ affectedTrack: "Cargo", kind: "complicationCandidate" }),
  "consequence-threat-attracted": Object.freeze({ affectedTrack: "Threat", kind: "encounterSeedCandidate" }),
  "consequence-hazard-escalation": Object.freeze({ affectedTrack: "Hazard", kind: "hazardEscalationCandidate" }),
  "consequence-ship-scar-candidate": Object.freeze({ affectedTrack: "Ship Scar", kind: "shipScarHandoffCandidate" })
});
const SAFE_SESSION_PRESSURE_TRACKS = Object.freeze(["hull", "strain", "lifeveil", "morale", "supplies"]);
const RESOLVED_QUEUE_STATUSES = Object.freeze(["applied", "dismissed"]);

function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function cloneData(value) { if (value === null || value === undefined) return value; return JSON.parse(JSON.stringify(value)); }
function recordsFrom(container) { if (Array.isArray(container)) return container; if (Array.isArray(container?.records)) return container.records; if (Array.isArray(container?.pending)) return container.pending; if (Array.isArray(container?.pendingDraws)) return container.pendingDraws; return []; }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function titleFrom(value, fallback = "Consequence") { return text(value) || fallback; }
function statusFrom(value) { return QUEUE_STATUSES.includes(value) ? value : "pending"; }
function followupStatusFrom(value) { return FOLLOWUP_STATUSES.includes(value) ? value : "open"; }
function queueOverrides(session = {}) {
  const records = recordsFrom(session.travelV2PendingConsequenceQueue);
  return new Map(records.filter(isPlainObject).map((record) => [record.queueKey, record]));
}
function consequenceSummary(entry) {
  return entry ? { id: entry.id, title: entry.title, severity: entry.severity, playerSafeSummary: entry.playerSafeSummary, applyEffectSummary: entry.applyEffectSummary } : null;
}
function catalogSummaries(source) {
  return getTravelV2ConsequencesBySource(source).map((entry) => consequenceSummary(entry));
}
function addCatalogSummariesBySource(suggestions, source) {
  for (const summary of catalogSummaries(source)) if (summary?.id && !suggestions.has(summary.id)) suggestions.set(summary.id, summary);
}
function addCatalogSummaryById(suggestions, id) {
  const entry = getTravelV2ConsequenceById(id);
  const summary = consequenceSummary(entry);
  if (summary?.id && !suggestions.has(summary.id)) suggestions.set(summary.id, summary);
}
function searchablePendingConsequenceText(input = {}) {
  const record = isPlainObject(input.sourceRecord) ? input.sourceRecord : {};
  const parts = [input.sourceType, input.sourceStatus, input.severity, input.publicSummary, input.gmSummary, record.category, record.type, record.kind, record.source, record.sourceType, record.name, record.title, record.publicText, record.playerText, record.gmText, record.publicSummary, record.gmSummary];
  for (const key of ["tags", "categories", "source", "sources"]) if (Array.isArray(record[key])) parts.push(...record[key]);
  return parts.map((part) => text(String(part ?? "")).toLowerCase()).filter(Boolean).join(" ");
}
function hasAnyHint(haystack, hints) {
  return hints.some((hint) => haystack.includes(hint));
}
export function catalogSummariesForPendingConsequence(input = {}) {
  const suggestions = new Map();
  for (const summary of input.catalogSuggestions ?? []) if (summary?.id && !suggestions.has(summary.id)) suggestions.set(summary.id, cloneData(summary));
  if (input.sourceType === "focusBacklash") addCatalogSummariesBySource(suggestions, "focus-backlash");
  if (["supportBacklash", "failedSupport", "supportFailure"].includes(input.sourceType)) addCatalogSummariesBySource(suggestions, "failed-support");
  if (input.sourceType === "unresolvedHazard") addCatalogSummariesBySource(suggestions, "unresolved-hazard");
  if (input.sourceType === "shipScarCandidate") addCatalogSummariesBySource(suggestions, "repeated-severe-pressure");
  if (input.sourceType === "finalOutcomeFallout") addCatalogSummariesBySource(suggestions, "final-bad-outcome");
  const haystack = searchablePendingConsequenceText(input);
  if ((input.sourceType === "unresolvedHazard" && hasAnyHint(haystack, ["physical", "hull"])) || hasAnyHint(haystack, ["hull", "physical", "impact", "collision", "structure", "structural", "damage", "breach", "stress", "watchmaster", "plates", "ribs", "frame", "bulkhead"])) addCatalogSummaryById(suggestions, "consequence-hull-stress");
  if (["supportBacklash", "failedSupport", "supportFailure"].includes(input.sourceType) || hasAnyHint(haystack, ["failed support", "support backlash", "captain", "morale", "crew hesitation", "hesitates", "hesitation", "fear", "panic"])) addCatalogSummaryById(suggestions, "consequence-crew-panic");
  if (hasAnyHint(haystack, ["supplies", "stores", "ration", "rations", "food", "water", "delay", "blocked access", "low stores", "logistics"])) addCatalogSummaryById(suggestions, "consequence-supplies-delay");
  return Array.from(suggestions.values());
}
function selectedConsequenceDisplay(selectedConsequence, catalogEntry) {
  return consequenceSummary(catalogEntry) ?? cloneData(selectedConsequence ?? null);
}
function supportedSessionPressureEffect(catalogEntry) {
  if (!isPlainObject(catalogEntry)) return { supported: false, reason: TRAVEL_V2_SELECTED_CONSEQUENCE_MANUAL_APPLY_UNSUPPORTED };
  const expected = SUPPORTED_SESSION_PRESSURE_CONSEQUENCE_APPLIES[text(catalogEntry.id)];
  if (!expected) return { supported: false, reason: TRAVEL_V2_SELECTED_CONSEQUENCE_MANUAL_APPLY_UNSUPPORTED };
  const effect = isPlainObject(catalogEntry.sessionLocalEffect) ? catalogEntry.sessionLocalEffect : {};
  const explicitApply = isPlainObject(catalogEntry.explicitGmApplyEffect) ? catalogEntry.explicitGmApplyEffect : {};
  const affectedTrack = text(catalogEntry.affectedTrack);
  const suggestedTrack = text(effect.suggestedTrack);
  const pressureDelta = Number(effect.suggestedDelta);
  if (text(catalogEntry.severity) !== expected.severity) return { supported: false, reason: TRAVEL_V2_SELECTED_CONSEQUENCE_MANUAL_APPLY_UNSUPPORTED };
  if (text(explicitApply.kind) !== "pressureCandidate" || text(explicitApply.mutation) !== "none") return { supported: false, reason: TRAVEL_V2_SELECTED_CONSEQUENCE_MANUAL_APPLY_UNSUPPORTED };
  if (text(effect.kind) !== "candidateOnly") return { supported: false, reason: TRAVEL_V2_SELECTED_CONSEQUENCE_MANUAL_APPLY_UNSUPPORTED };
  if (affectedTrack !== expected.affectedTrack || suggestedTrack !== expected.affectedTrack) return { supported: false, reason: TRAVEL_V2_SELECTED_CONSEQUENCE_MANUAL_APPLY_UNSUPPORTED };
  if (!SAFE_SESSION_PRESSURE_TRACKS.includes(expected.pressureTrack)) return { supported: false, reason: TRAVEL_V2_SELECTED_CONSEQUENCE_MANUAL_APPLY_UNSUPPORTED };
  if (!Number.isInteger(pressureDelta) || pressureDelta !== expected.pressureDelta) return { supported: false, reason: TRAVEL_V2_SELECTED_CONSEQUENCE_MANUAL_APPLY_UNSUPPORTED };
  return { supported: true, affectedTrack: expected.affectedTrack, pressureTrack: expected.pressureTrack, pressureDelta: expected.pressureDelta };
}
export function testTravelV2SelectedConsequencePressureApplySupport(catalogEntry) {
  return supportedSessionPressureEffect(catalogEntry);
}
function supportedSessionFollowupEffect(catalogEntry) {
  if (!isPlainObject(catalogEntry)) return { supported: false, reason: TRAVEL_V2_SELECTED_CONSEQUENCE_MANUAL_APPLY_UNSUPPORTED };
  const expected = SUPPORTED_SESSION_FOLLOWUP_CONSEQUENCE_APPLIES[text(catalogEntry.id)];
  if (!expected) return { supported: false, reason: TRAVEL_V2_SELECTED_CONSEQUENCE_MANUAL_APPLY_UNSUPPORTED };
  const effect = isPlainObject(catalogEntry.sessionLocalEffect) ? catalogEntry.sessionLocalEffect : {};
  const explicitApply = isPlainObject(catalogEntry.explicitGmApplyEffect) ? catalogEntry.explicitGmApplyEffect : {};
  const affectedTrack = text(catalogEntry.affectedTrack);
  if (text(explicitApply.kind) !== expected.kind || text(explicitApply.mutation) !== "none") return { supported: false, reason: TRAVEL_V2_SELECTED_CONSEQUENCE_MANUAL_APPLY_UNSUPPORTED };
  if (text(effect.kind) !== "candidateOnly") return { supported: false, reason: TRAVEL_V2_SELECTED_CONSEQUENCE_MANUAL_APPLY_UNSUPPORTED };
  if (affectedTrack !== expected.affectedTrack || text(effect.suggestedTrack) !== expected.affectedTrack) return { supported: false, reason: TRAVEL_V2_SELECTED_CONSEQUENCE_MANUAL_APPLY_UNSUPPORTED };
  if (Number(effect.suggestedDelta) !== 1) return { supported: false, reason: TRAVEL_V2_SELECTED_CONSEQUENCE_MANUAL_APPLY_UNSUPPORTED };
  return { supported: true, affectedTrack: expected.affectedTrack, kind: expected.kind };
}
function followupApplyWarningText() {
  return "Applies this selected consequence by writing a session-local follow-up note only. Does not mutate route, cargo, hazards, ship scars, actors, items, inventories, chat, journals, combat, scenes, tokens, sockets, compendia, or world data.";
}
function pressureValue(session, pressureTrack) {
  const track = isPlainObject(session?.pressure?.[pressureTrack]) ? session.pressure[pressureTrack] : {};
  const value = Number(track.value);
  return Number.isInteger(value) ? value : 0;
}
function finiteNumber(value) { return Number.isFinite(Number(value)) ? Number(value) : null; }
function applicationRecordsFrom(session = {}) {
  const merged = recordsFrom(session.travelV2ConsequenceApplicationHistory)
    .concat(recordsFrom(session.travelV2PendingConsequenceQueue?.appliedRecords))
    .filter(isPlainObject);
  const seen = new Set();
  const deduped = [];
  for (const record of merged) {
    const key = text(record.applicationId) || `${text(record.queueKey) || text(record.consequenceItemKey)}:${text(record.appliedAt)}`;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    deduped.push(record);
  }
  return deduped;
}
function hasApplicationRecordForQueueItem(session = {}, queueKey = "") {
  return applicationRecordsFrom(session).some((record) => record.queueKey === queueKey || record.consequenceItemKey === queueKey);
}
function makeApplicationId(queueKey, appliedAt) {
  return `travel-v2-consequence:${queueKey}:${String(appliedAt ?? "").replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}
export function prepareTravelV2SelectedConsequenceApplyPreview(session, queueKey, options = {}) {
  if (!isPlainObject(session)) return null;
  const selected = recordsFrom(session.travelV2PendingConsequenceQueue).filter(isPlainObject).find((record) => record.queueKey === queueKey)?.selectedConsequence;
  if (!isPlainObject(selected) || !text(selected.id)) return null;
  const catalogEntry = getTravelV2ConsequenceById(selected.id);
  const fallbackTitle = titleFrom(selected.title, "Selected consequence");
  if (!catalogEntry) {
    return {
      hasPreview: true,
      consequenceId: selected.id,
      title: fallbackTitle,
      severity: text(selected.severity) || "unknown",
      source: "missing-catalog-card",
      affectedTrack: text(selected.affectedTrack),
      playerSafeSummary: text(selected.playerSafeSummary) || "Selected consequence catalog card could not be resolved.",
      applyEffectSummary: "Catalog card could not be resolved. No future Apply payload is executable from this preview.",
      mutation: "none",
      executable: false,
      previewOnly: true,
      warningText: `${TRAVEL_V2_SELECTED_CONSEQUENCE_APPLY_PREVIEW_WARNING} Catalog card could not be resolved from the authored consequence catalog.`
    };
  }
  const explicitApply = isPlainObject(catalogEntry.explicitGmApplyEffect) ? catalogEntry.explicitGmApplyEffect : {};
  const supportedEffect = supportedSessionPressureEffect(catalogEntry);
  const supportedFollowupEffect = supportedEffect.supported === true ? { supported: false } : supportedSessionFollowupEffect(catalogEntry);
  const executableEffect = supportedEffect.supported === true ? supportedEffect : supportedFollowupEffect;
  const mutation = supportedEffect.supported === true ? "session-pressure-only" : supportedFollowupEffect.supported === true ? "session-followup-note-only" : "none";
  return {
    hasPreview: true,
    consequenceId: catalogEntry.id,
    title: titleFrom(catalogEntry.title, fallbackTitle),
    severity: text(catalogEntry.severity) || text(selected.severity) || "unknown",
    source: text(explicitApply.kind) || (Array.isArray(catalogEntry.source) ? catalogEntry.source.join(", ") : text(catalogEntry.source)),
    affectedTrack: text(catalogEntry.affectedTrack) || text(catalogEntry.sessionLocalEffect?.suggestedTrack),
    playerSafeSummary: text(catalogEntry.playerSafeSummary) || text(catalogEntry.publicText) || text(selected.playerSafeSummary),
    applyEffectSummary: text(catalogEntry.applyEffectSummary) || text(explicitApply.summary) || text(selected.applyEffectSummary),
    mutation,
    executable: executableEffect.supported === true,
    previewOnly: executableEffect.supported !== true,
    pressureDelta: supportedEffect.pressureDelta ?? null,
    warningText: supportedEffect.supported ? "Applies this selected consequence to the runner session only. Does not mutate actors, items, chat, journals, combat, scenes, tokens, sockets, compendia, or world data." : supportedFollowupEffect.supported ? followupApplyWarningText(catalogEntry.id) : `${TRAVEL_V2_SELECTED_CONSEQUENCE_APPLY_PREVIEW_WARNING} ${supportedEffect.reason}`
  };
}
function makeQueueItem(input = {}, overrides = new Map()) {
  const queueKey = input.queueKey;
  const override = overrides.get(queueKey) ?? {};
  const status = statusFrom(override.status ?? input.status);
  const appliedEffect = cloneData(override.appliedEffect ?? null);
  const hasAppliedEffect = override.hasAppliedEffect === true || ["session-pressure-only", "session-followup-note-only"].includes(appliedEffect?.mutation);
  const selectedConsequenceApplyPreview = prepareTravelV2SelectedConsequenceApplyPreview({ travelV2PendingConsequenceQueue: { records: [override] } }, queueKey, {});
  const item = {
    version: TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION,
    queueKey,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? "",
    roundIndex: Number.isInteger(Number(input.roundIndex)) ? Number(input.roundIndex) : null,
    roundNumber: Number.isInteger(Number(input.roundNumber)) ? Number(input.roundNumber) : null,
    title: titleFrom(input.title, "Pending Consequence"),
    severity: text(input.severity) || "minor",
    status,
    sourceStatus: text(input.sourceStatus) || "",
    publicSummary: text(input.publicSummary) || "A consequence candidate needs GM review.",
    gmSummary: text(input.gmSummary) || text(input.publicSummary) || "Review this candidate before applying, dismissing, or deferring it.",
    applyLabel: "Apply",
    dismissLabel: "Dismiss",
    deferLabel: "Defer",
    requiresGmApply: true,
    mutation: "none",
    catalogSuggestions: catalogSummariesForPendingConsequence(input),
    sourceRecord: cloneData(input.sourceRecord ?? null),
    selectedConsequence: selectedConsequenceDisplay(override.selectedConsequence, override.selectedConsequence?.id ? getTravelV2ConsequenceById(override.selectedConsequence.id) : null),
    selectedConsequenceApplyPreview,
    appliedEffect,
    hasAppliedEffect,
    canClearSelectedConsequence: status === "pending" && Boolean(text(override.selectedConsequence?.id)) && hasAppliedEffect !== true && !isPlainObject(appliedEffect),
    canApplySelectedConsequence: selectedConsequenceApplyPreview?.executable === true && !hasAppliedEffect && status !== "applied",
    decidedAt: override.decidedAt ?? null,
    decisionNote: text(override.decisionNote),
    playerSafe: { title: titleFrom(input.title, "Pending Consequence"), summary: text(input.publicSummary) || "A consequence candidate needs GM review.", status }
  };
  return item;
}

function hasSelectedConsequenceId(item) { return Boolean(text(item?.selectedConsequence?.id)); }
function isMissingCatalogApplyPreview(item) { return item?.selectedConsequenceApplyPreview?.source === "missing-catalog-card"; }

const GM_ITEM_GROUP_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "readyToApply", label: "Ready to Apply", hint: "Pending selected consequences that can be applied to this runner session now." }),
  Object.freeze({ key: "needsSelection", label: "Needs Selection", hint: "Pending consequence candidates that need the GM to choose an authored consequence card." }),
  Object.freeze({ key: "unsupported", label: "Unsupported / Preview Only", hint: "Selected pending consequences that are read-only previews or are not executable by this queue." }),
  Object.freeze({ key: "otherPending", label: "Other Pending", hint: "Pending consequence candidates that do not fit the other GM review groups." }),
  Object.freeze({ key: "applied", label: "Applied / Reviewed", hint: "Consequences already marked applied or with a recorded session-local applied result." }),
  Object.freeze({ key: "deferred", label: "Deferred", hint: "Consequences deferred for later GM review." }),
  Object.freeze({ key: "dismissed", label: "Dismissed", hint: "Consequences dismissed from the current GM review queue." })
]);
function gmItemGroupKey(item) {
  if (item?.status === "applied" || item?.hasAppliedEffect === true || item?.appliedEffect) return "applied";
  if (item?.status === "deferred") return "deferred";
  if (item?.status === "dismissed") return "dismissed";
  if (item?.status === "pending" && item?.canApplySelectedConsequence === true && item?.selectedConsequenceApplyPreview?.executable === true && item?.selectedConsequenceApplyPreview?.previewOnly === false) return "readyToApply";
  if (item?.status === "pending" && !hasSelectedConsequenceId(item)) return "needsSelection";
  if (item?.status === "pending" && hasSelectedConsequenceId(item) && item?.selectedConsequenceApplyPreview && item?.canApplySelectedConsequence === false && (item.selectedConsequenceApplyPreview.executable !== true || item.selectedConsequenceApplyPreview.previewOnly === true)) return "unsupported";
  return "otherPending";
}
function prepareGmItemGroups(items = []) {
  const grouped = new Map(GM_ITEM_GROUP_DEFINITIONS.map((group) => [group.key, []]));
  for (const item of items) grouped.get(gmItemGroupKey(item))?.push(item);
  return GM_ITEM_GROUP_DEFINITIONS.map((group) => ({
    key: group.key,
    label: group.label,
    hint: group.hint,
    count: grouped.get(group.key)?.length ?? 0,
    items: grouped.get(group.key) ?? []
  }));
}

function prepareApplyStatusSummary(items = []) {
  return {
    totalItems: items.length,
    selectedCount: items.filter((item) => hasSelectedConsequenceId(item)).length,
    executableCount: items.filter((item) => item.canApplySelectedConsequence === true).length,
    alreadyAppliedCount: items.filter((item) => item.hasAppliedEffect === true).length,
    unsupportedCount: items.filter((item) => hasSelectedConsequenceId(item) && item.selectedConsequenceApplyPreview?.previewOnly === true && item.selectedConsequenceApplyPreview?.executable !== true && !isMissingCatalogApplyPreview(item)).length,
    missingSelectionCount: items.filter((item) => !hasSelectedConsequenceId(item)).length,
    missingCatalogCount: items.filter((item) => hasSelectedConsequenceId(item) && isMissingCatalogApplyPreview(item)).length,
    sessionPressureOnlyCount: items.filter((item) => item.selectedConsequenceApplyPreview?.mutation === "session-pressure-only").length
  };
}
const EMPTY_CLEAR_SELECTION_SUMMARY = Object.freeze({
  totalItems: 0,
  clearableCount: 0,
  selectedCount: 0,
  appliedOrEffectCount: 0,
  blockedStatusCount: 0
});
function prepareClearSelectionSummary(items = []) {
  const summary = { ...EMPTY_CLEAR_SELECTION_SUMMARY, totalItems: items.length };
  for (const item of items) {
    if (!hasSelectedConsequenceId(item)) continue;
    summary.selectedCount += 1;
    if (item.hasAppliedEffect === true || isPlainObject(item.appliedEffect)) summary.appliedOrEffectCount += 1;
    if (item.status !== "pending") summary.blockedStatusCount += 1;
    if (item.canClearSelectedConsequence === true) summary.clearableCount += 1;
  }
  return summary;
}
const EMPTY_SINGLE_SUGGESTION_SELECTION_SUMMARY = Object.freeze({
  totalItems: 0,
  eligibleCount: 0,
  alreadySelectedCount: 0,
  noSuggestionCount: 0,
  multipleSuggestionCount: 0,
  blockedStatusCount: 0
});
function isSingleSuggestionSelectionBlocked(item = {}) {
  return item.status !== "pending" || item.hasAppliedEffect === true || isPlainObject(item.appliedEffect);
}
function isSingleSuggestionSelectionEligible(item = {}) {
  return !isSingleSuggestionSelectionBlocked(item) &&
    !hasSelectedConsequenceId(item) &&
    Array.isArray(item.catalogSuggestions) &&
    item.catalogSuggestions.length === 1 &&
    Boolean(text(item.catalogSuggestions[0]?.id));
}
function prepareSingleSuggestionSelectionSummary(items = []) {
  const summary = { ...EMPTY_SINGLE_SUGGESTION_SELECTION_SUMMARY, totalItems: items.length };
  for (const item of items) {
    if (isSingleSuggestionSelectionBlocked(item)) summary.blockedStatusCount += 1;
    if (hasSelectedConsequenceId(item)) summary.alreadySelectedCount += 1;
    if (isSingleSuggestionSelectionBlocked(item) || hasSelectedConsequenceId(item)) continue;
    const suggestionCount = Array.isArray(item.catalogSuggestions) ? item.catalogSuggestions.length : 0;
    if (suggestionCount === 0) summary.noSuggestionCount += 1;
    else if (suggestionCount === 1 && text(item.catalogSuggestions[0]?.id)) summary.eligibleCount += 1;
    else if (suggestionCount > 1) summary.multipleSuggestionCount += 1;
  }
  return summary;
}
function unresolvedHazard(record = {}) { return ["active", "revealed", "held", "pending"].includes(record.status) && record.status !== "cleared" && record.status !== "dismissed"; }
function finalOutcomeConsequenceItems(session = {}, overrides) {
  const outcome = prepareTravelV2EventOutcomePackage(session, { now: session.completedAt ?? null });
  if (outcome.canPreparePackage !== true) return [];
  return (outcome.consequenceCandidates ?? []).map((candidate, index) => makeQueueItem({
    queueKey: `final-outcome:${outcome.eventOutcomeKey}:${index}`,
    sourceType: "finalOutcomeFallout",
    sourceId: candidate.id ?? candidate.key ?? String(index),
    title: candidate.name ?? candidate.title ?? candidate.text ?? "Final outcome fallout",
    severity: candidate.severity ?? (["failure", "critical-failure"].includes(outcome.eventOutcomeKey) ? "major" : "minor"),
    publicSummary: candidate.playerSafeSummary ?? candidate.publicText ?? candidate.text ?? candidate.name ?? "Final outcome consequence candidate.",
    gmSummary: candidate.gmSummary ?? candidate.gmText ?? candidate.text ?? candidate.name ?? "Review final outcome fallout.",
    sourceStatus: "candidate",
    catalogSuggestions: catalogSummaries("final-bad-outcome"),
    sourceRecord: candidate
  }, overrides));
}
export function prepareTravelV2PendingConsequenceQueue(session, options = {}) {
  if (!isPlainObject(session)) return { version: TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION, hasSession: false, items: [], pendingCount: 0, appliedCount: 0, dismissedCount: 0, deferredCount: 0, gmItemGroups: prepareGmItemGroups([]), singleSuggestionSelectionSummary: { ...EMPTY_SINGLE_SUGGESTION_SELECTION_SUMMARY }, clearSelectionSummary: { ...EMPTY_CLEAR_SELECTION_SUMMARY }, playerSafeItems: [], summaryText: "Travel v2 pending consequence queue requires a runner session." };
  const overrides = queueOverrides(session);
  const items = [];
  for (const record of recordsFrom(session.travelV2FocusBacklashRecords)) if (isPlainObject(record) && ["pending", "applied", "dismissed"].includes(record.status)) items.push(makeQueueItem({ queueKey: `focus-backlash:${record.id}`, sourceType: "focusBacklash", sourceId: record.id, roundIndex: record.roundIndex, roundNumber: Number(record.roundIndex) + 1, title: record.publicSummary || `${record.stationName ?? "Station"} Focus backlash`, severity: "minor", status: record.status, sourceStatus: record.status, publicSummary: record.publicRiskText || record.publicSummary, gmSummary: record.publicBacklashPreviewText || record.publicRiskText || record.publicSummary, catalogSuggestions: catalogSummaries("focus-backlash"), sourceRecord: record }, overrides));
  for (const record of recordsFrom(session.travelV2SupportBacklashRecords)) if (isPlainObject(record) && ["pending", "applied", "dismissed"].includes(record.status)) items.push(makeQueueItem({ queueKey: `support-backlash:${record.id}`, sourceType: "supportBacklash", sourceId: record.id, roundIndex: record.roundIndex, roundNumber: Number(record.roundIndex) + 1, title: `${record.supportingStationName ?? "Support"} backlash`, severity: record.severity ?? "minor", status: record.status, sourceStatus: record.status, publicSummary: record.publicRiskText || record.publicSummary, gmSummary: record.publicSummary || record.publicRiskText, catalogSuggestions: catalogSummaries("failed-support"), sourceRecord: record }, overrides));
  for (const record of recordsFrom(session.hazards).concat(recordsFrom(session.travelV2Hazards))) if (isPlainObject(record) && unresolvedHazard(record)) items.push(makeQueueItem({ queueKey: `hazard:${record.id}`, sourceType: "unresolvedHazard", sourceId: record.id, roundIndex: record.roundIndex, roundNumber: Number(record.roundIndex) + 1, title: `Unresolved hazard: ${record.name ?? record.title ?? record.id}`, severity: record.severity ?? "major", status: "pending", sourceStatus: record.status, publicSummary: record.playerText || record.publicText || "An unresolved hazard needs GM review.", gmSummary: record.gmText || record.name || "Resolve, clear, or escalate this hazard manually.", catalogSuggestions: catalogSummaries("unresolved-hazard"), sourceRecord: record }, overrides));
  for (const record of recordsFrom(session.shipScars).concat(recordsFrom(session.travelV2ShipScars))) if (isPlainObject(record) && (record.status ?? "pending") === "pending") items.push(makeQueueItem({ queueKey: `ship-scar:${record.id}`, sourceType: "shipScarCandidate", sourceId: record.id, roundIndex: record.roundIndex, roundNumber: Number(record.roundIndex) + 1, title: record.name ?? record.title ?? "Ship scar candidate", severity: record.severity ?? "severe", status: "pending", sourceStatus: record.status ?? "pending", publicSummary: record.playerSafeSummary ?? "A ship scar candidate needs explicit GM review.", gmSummary: record.gmSummary ?? record.gmText ?? "No actor mutation occurs from the queue.", catalogSuggestions: catalogSummaries("repeated-severe-pressure"), sourceRecord: record }, overrides));
  items.push(...finalOutcomeConsequenceItems(session, overrides));
  const ordered = items.sort((a, b) => (a.roundNumber ?? 999) - (b.roundNumber ?? 999) || a.sourceType.localeCompare(b.sourceType) || a.queueKey.localeCompare(b.queueKey));
  const count = (status) => ordered.filter((item) => item.status === status).length;
  const applyStatusSummary = prepareApplyStatusSummary(ordered);
  const gmItemGroups = prepareGmItemGroups(ordered);
  const singleSuggestionSelectionSummary = prepareSingleSuggestionSelectionSummary(ordered);
  const clearSelectionSummary = prepareClearSelectionSummary(ordered);
  return { version: TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION, hasSession: true, items: ordered, pendingCount: count("pending"), appliedCount: count("applied"), dismissedCount: count("dismissed"), deferredCount: count("deferred"), applyStatusSummary, gmItemGroups, singleSuggestionSelectionSummary, clearSelectionSummary, playerSafeItems: ordered.map((item) => item.playerSafe), summaryText: ordered.length ? `${ordered.length} consequence candidate${ordered.length === 1 ? "" : "s"} queued for GM review.` : "No pending consequence candidates." };
}
export function prepareTravelV2ConsequenceFollowupReview(session) {
  const emptyGroups = FOLLOWUP_STATUSES.map((key) => ({ key, label: FOLLOWUP_STATUS_LABELS[key], count: 0, records: [] }));
  if (!isPlainObject(session)) return { hasRecords: false, totalCount: 0, openCount: 0, reviewedCount: 0, deferredCount: 0, resolvedCount: 0, records: [], groups: emptyGroups };
  const records = recordsFrom(session.travelV2ConsequenceFollowups).filter(isPlainObject).map((record) => {
    const status = followupStatusFrom(record.status);
    return { ...cloneData(record), status, statusLabel: FOLLOWUP_STATUS_LABELS[status] };
  });
  const groups = FOLLOWUP_STATUSES.map((key) => {
    const groupRecords = records.filter((record) => record.status === key);
    return { key, label: FOLLOWUP_STATUS_LABELS[key], count: groupRecords.length, records: groupRecords };
  });
  const count = (status) => groups.find((group) => group.key === status)?.count ?? 0;
  return {
    hasRecords: records.length > 0,
    totalCount: records.length,
    openCount: count("open"),
    reviewedCount: count("reviewed"),
    deferredCount: count("deferred"),
    resolvedCount: count("resolved"),
    records,
    groups
  };
}

export function updateTravelV2ConsequenceFollowupStatus(session, followupRecordKey, status, options = {}) {
  if (!isPlainObject(session)) return { ok: false, session, error: "Travel v2 runner session is required." };
  const queueKey = text(followupRecordKey);
  if (!queueKey) return { ok: false, session, error: "Follow-up note record key is required." };
  const nextStatus = text(status);
  if (!FOLLOWUP_STATUSES.includes(nextStatus)) return { ok: false, session, error: "Follow-up note status must be open, reviewed, deferred, or resolved." };
  const currentFollowups = isPlainObject(session.travelV2ConsequenceFollowups) ? session.travelV2ConsequenceFollowups : {};
  const sourceRecords = recordsFrom(currentFollowups).filter(isPlainObject);
  if (!sourceRecords.some((record) => record.queueKey === queueKey)) return { ok: false, session, error: "Follow-up note record was not found." };
  const statusUpdatedAt = timestamp(options);
  let updatedRecord = null;
  const records = sourceRecords.map((record) => {
    if (record.queueKey !== queueKey) return cloneData(record);
    updatedRecord = { ...cloneData(record), status: nextStatus, statusUpdatedAt, statusUpdatedBy: "gm" };
    const note = text(options.note);
    if (note) updatedRecord.statusNote = note;
    return updatedRecord;
  });
  const nextFollowups = { ...cloneData(currentFollowups), records };
  const nextSession = { ...cloneData(session), travelV2ConsequenceFollowups: nextFollowups };
  return { ok: true, session: nextSession, record: updatedRecord, records };
}

function timestamp(options = {}) { const value = options.decidedAt ?? options.now; if (value instanceof Date) return value.toISOString(); if (typeof value === "string" && value.trim()) return value.trim(); return new Date().toISOString(); }
export function updateTravelV2PendingConsequenceQueueItem(session, queueKey, status, options = {}) {
  if (!isPlainObject(session)) return { ok: false, session, error: "Travel v2 runner session is required." };
  if (!text(queueKey)) return { ok: false, session, error: "Pending consequence queue key is required." };
  if (!["applied", "dismissed", "deferred", "pending"].includes(status)) return { ok: false, session, error: "Pending consequence status must be applied, dismissed, deferred, or pending." };
  const queue = prepareTravelV2PendingConsequenceQueue(session, options);
  if (!queue.items.some((item) => item.queueKey === queueKey)) return { ok: false, session, queue, error: "Pending consequence queue item was not found." };
  const current = recordsFrom(session.travelV2PendingConsequenceQueue).filter(isPlainObject).find((record) => record.queueKey === queueKey) ?? {};
  const existing = recordsFrom(session.travelV2PendingConsequenceQueue).filter(isPlainObject).filter((record) => record.queueKey !== queueKey);
  const record = { ...cloneData(current), version: TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION, queueKey, status, decidedAt: timestamp(options), decisionNote: text(options.note), mutation: "none" };
  const nextSession = { ...cloneData(session), travelV2PendingConsequenceQueue: { version: TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION, records: [...existing, record] } };
  return { ok: true, session: nextSession, queue: prepareTravelV2PendingConsequenceQueue(nextSession, options), record };
}

function canClearTravelV2PendingConsequenceSelectionItem(item = {}) {
  return item.status === "pending" && hasSelectedConsequenceId(item) && item.hasAppliedEffect !== true && !isPlainObject(item.appliedEffect);
}
function clearTravelV2PendingConsequenceSelectionBlockedReason(item = {}) {
  if (item.status !== "pending") return `Queue item status is ${item.status ?? "unknown"}.`;
  if (!hasSelectedConsequenceId(item)) return "No selected consequence catalog card.";
  if (item.hasAppliedEffect === true || isPlainObject(item.appliedEffect)) return "Selected consequence already has an applied effect.";
  return "Selected consequence cannot be cleared.";
}
function clearTravelV2PendingConsequenceSelectionSummary(item = {}, reason = "") {
  const selectedConsequenceId = text(item.selectedConsequence?.id);
  return {
    queueKey: item.queueKey,
    ...(reason ? { reason } : {}),
    ...(selectedConsequenceId ? { selectedConsequenceId } : {})
  };
}

export function clearTravelV2PendingConsequenceSelection(session, queueKey, options = {}) {
  if (!isPlainObject(session)) return { ok: false, session, error: "Travel v2 runner session is required." };
  if (!text(queueKey)) return { ok: false, session, error: "Pending consequence queue key is required." };
  const queue = prepareTravelV2PendingConsequenceQueue(session, options);
  const item = queue.items.find((candidate) => candidate.queueKey === queueKey);
  if (!item) return { ok: false, session, queue, error: "Pending consequence queue item was not found." };
  if (!canClearTravelV2PendingConsequenceSelectionItem(item)) return { ok: false, session, queue, error: clearTravelV2PendingConsequenceSelectionBlockedReason(item) };
  const currentRecords = recordsFrom(session.travelV2PendingConsequenceQueue).filter(isPlainObject);
  const current = currentRecords.find((record) => record.queueKey === queueKey);
  if (!isPlainObject(current)) return { ok: false, session, queue, error: "Pending consequence queue override record was not found." };
  const existing = currentRecords.filter((record) => record.queueKey !== queueKey).map((record) => cloneData(record));
  const record = { ...cloneData(current), version: TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION, queueKey, status: "pending", mutation: "none", selectionClearedAt: timestamp(options), selectionClearedBy: "gm" };
  delete record.selectedConsequence;
  delete record.selectedConsequenceApplyPreview;
  delete record.appliedEffect;
  delete record.hasAppliedEffect;
  delete record.selectedAt;
  delete record.selectedBy;
  const nextQueue = { ...cloneData(session.travelV2PendingConsequenceQueue ?? {}), version: TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION, records: [...existing, record] };
  const nextSession = { ...cloneData(session), travelV2PendingConsequenceQueue: nextQueue };
  return { ok: true, session: nextSession, queue: prepareTravelV2PendingConsequenceQueue(nextSession, options), record };
}

export function clearAllTravelV2PendingConsequenceSelections(session, options = {}) {
  const startedAt = timestamp(options);
  const initialQueue = prepareTravelV2PendingConsequenceQueue(session, options);
  if (!isPlainObject(session)) return { ok: false, reason: "No pending selected consequence cards can be cleared.", session, queue: initialQueue, cleared: [], skipped: [], attemptedCount: 0, clearedCount: 0, skippedCount: 0 };
  const eligibleItems = initialQueue.items.filter((item) => canClearTravelV2PendingConsequenceSelectionItem(item));
  const skipped = initialQueue.items.filter((item) => !canClearTravelV2PendingConsequenceSelectionItem(item)).map((item) => clearTravelV2PendingConsequenceSelectionSummary(item, clearTravelV2PendingConsequenceSelectionBlockedReason(item)));
  if (!eligibleItems.length) return { ok: false, reason: "No pending selected consequence cards can be cleared.", session, queue: initialQueue, cleared: [], skipped: [], attemptedCount: 0, clearedCount: 0, skippedCount: 0 };
  let currentSession = session;
  const cleared = [];
  for (const item of eligibleItems) {
    const result = clearTravelV2PendingConsequenceSelection(currentSession, item.queueKey, options);
    if (!result.ok) {
      skipped.push(clearTravelV2PendingConsequenceSelectionSummary(item, result.error ?? "Selected consequence clear failed."));
      continue;
    }
    currentSession = result.session;
    cleared.push({ queueKey: item.queueKey, consequenceId: text(item.selectedConsequence?.id), title: text(item.selectedConsequence?.title) || text(item.title) });
  }
  const completedAt = timestamp(options);
  return { ok: cleared.length > 0, ...(cleared.length > 0 ? {} : { reason: "No pending selected consequence cards can be cleared." }), session: currentSession, queue: prepareTravelV2PendingConsequenceQueue(currentSession, options), cleared, skipped, attemptedCount: eligibleItems.length, clearedCount: cleared.length, skippedCount: skipped.length, startedAt, completedAt };
}

export function applyTravelV2SelectedConsequenceToSession(session, queueKey, options = {}) {
  if (!isPlainObject(session)) return { ok: false, session, error: "Travel v2 runner session is required." };
  if (!text(queueKey)) return { ok: false, session, error: "Pending consequence queue key is required." };
  const queue = prepareTravelV2PendingConsequenceQueue(session, options);
  const item = queue.items.find((candidate) => candidate.queueKey === queueKey);
  if (!item) return { ok: false, session, queue, error: "Pending consequence queue item was not found." };
  const current = recordsFrom(session.travelV2PendingConsequenceQueue).filter(isPlainObject).find((record) => record.queueKey === queueKey) ?? {};
  if (RESOLVED_QUEUE_STATUSES.includes(item.status) || RESOLVED_QUEUE_STATUSES.includes(current.status)) return { ok: false, alreadyApplied: item.status === "applied" || current.status === "applied", session, queue, error: `Pending consequence queue item is already ${current.status ?? item.status}.` };
  if (hasApplicationRecordForQueueItem(session, queueKey) && options.force !== true) return { ok: false, alreadyApplied: true, session, queue, error: "Selected consequence already has an application history record." };
  if (!isPlainObject(current.selectedConsequence) || !text(current.selectedConsequence.id)) return { ok: false, session, queue, error: "Select a consequence catalog card before applying it." };
  if (["session-pressure-only", "session-followup-note-only"].includes(current.appliedEffect?.mutation)) return { ok: false, alreadyApplied: true, session, queue, error: "Selected consequence has already been applied to this queue item." };
  const catalogEntry = getTravelV2ConsequenceById(current.selectedConsequence.id);
  if (!catalogEntry) return { ok: false, session, queue, error: "Selected consequence catalog card was not found." };
  const supportedEffect = supportedSessionPressureEffect(catalogEntry);
  if (supportedEffect.supported !== true) {
    const supportedFollowupEffect = supportedSessionFollowupEffect(catalogEntry);
    if (supportedFollowupEffect.supported !== true) return { ok: false, session, queue, error: supportedEffect.reason };
    const createdAt = timestamp(options);
    const explicitApply = isPlainObject(catalogEntry.explicitGmApplyEffect) ? catalogEntry.explicitGmApplyEffect : {};
    const preview = prepareTravelV2SelectedConsequenceApplyPreview(session, queueKey, options);
    const followupRecord = {
      version: 1,
      queueKey,
      consequenceId: catalogEntry.id,
      title: titleFrom(catalogEntry.title, "Follow-up Note"),
      kind: supportedFollowupEffect.kind,
      affectedTrack: supportedFollowupEffect.affectedTrack,
      summary: text(catalogEntry.playerSafeSummary) || text(catalogEntry.applyEffectSummary) || text(explicitApply.summary),
      source: text(preview?.source) || text(explicitApply.kind),
      mutation: "session-followup-note-only",
      createdAt,
      createdBy: "gm",
      status: "open"
    };
    const applicationId = makeApplicationId(queueKey, createdAt);
    const appliedRecord = {
      applicationId,
      queueKey,
      consequenceItemKey: queueKey,
      consequenceId: catalogEntry.id,
      roundIndex: Number.isInteger(Number(item.roundIndex)) ? Number(item.roundIndex) : (Number.isInteger(Number(session.currentRoundIndex)) ? Number(session.currentRoundIndex) : null),
      statusBefore: item.status,
      statusAfter: "applied",
      appliedAt: createdAt,
      appliedBy: "gm",
      appliedByUserId: text(options.appliedByUserId) || text(globalThis.game?.user?.id) || "gm",
      appliedByUserName: text(options.appliedByUserName) || text(globalThis.game?.user?.name) || "GM",
      mutation: "session-followup-note-only",
      mode: "session-only",
      kind: supportedFollowupEffect.kind,
      affectedTrack: supportedFollowupEffect.affectedTrack,
      followupRecord: cloneData(followupRecord)
    };
    const existing = recordsFrom(session.travelV2PendingConsequenceQueue).filter(isPlainObject).filter((record) => record.queueKey !== queueKey);
    const currentFollowups = isPlainObject(session.travelV2ConsequenceFollowups) ? session.travelV2ConsequenceFollowups : {};
    const nextFollowups = { version: 1, records: [...cloneData(recordsFrom(currentFollowups)), followupRecord] };
    const record = { ...cloneData(current), version: TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION, queueKey, status: "applied", decidedAt: createdAt, mutation: "session-followup-note-only", selectedConsequence: consequenceSummary(catalogEntry), selectedConsequenceApplyPreview: preview, appliedEffect: appliedRecord };
    const nextSession = { ...cloneData(session), travelV2ConsequenceFollowups: nextFollowups, travelV2ConsequenceApplicationHistory: { version: 1, records: [...applicationRecordsFrom(session), appliedRecord] }, travelV2PendingConsequenceQueue: { version: TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION, records: [...existing, record] } };
    return { ok: true, session: nextSession, queue: prepareTravelV2PendingConsequenceQueue(nextSession, options), record, appliedRecord, followupRecord };
  }
  if (!SAFE_SESSION_PRESSURE_TRACKS.includes(supportedEffect.pressureTrack)) return { ok: false, session, queue, error: `Invalid Travel v2 pressure resource key: ${supportedEffect.pressureTrack}.` };
  const beforeValue = pressureValue(session, supportedEffect.pressureTrack);
  const afterValue = beforeValue + supportedEffect.pressureDelta;
  if (finiteNumber(beforeValue) === null || finiteNumber(afterValue) === null || finiteNumber(supportedEffect.pressureDelta) === null) return { ok: false, session, queue, error: "Selected consequence would create a non-finite Travel v2 resource value." };
  const appliedAt = timestamp(options);
  const applicationId = makeApplicationId(queueKey, appliedAt);
  const appliedRecord = {
    applicationId,
    queueKey,
    consequenceItemKey: queueKey,
    consequenceId: catalogEntry.id,
    roundIndex: Number.isInteger(Number(item.roundIndex)) ? Number(item.roundIndex) : (Number.isInteger(Number(session.currentRoundIndex)) ? Number(session.currentRoundIndex) : null),
    statusBefore: item.status,
    statusAfter: "applied",
    appliedAt,
    appliedBy: "gm",
    appliedByUserId: text(options.appliedByUserId) || text(globalThis.game?.user?.id) || "gm",
    appliedByUserName: text(options.appliedByUserName) || text(globalThis.game?.user?.name) || "GM",
    mutation: "session-pressure-only",
    affectedTrack: supportedEffect.affectedTrack,
    resource: supportedEffect.pressureTrack,
    pressureTrack: supportedEffect.pressureTrack,
    pressureDelta: supportedEffect.pressureDelta,
    delta: supportedEffect.pressureDelta,
    mode: "add",
    beforeValue,
    afterValue,
    note: text(options.note) || text(catalogEntry.applyEffectSummary)
  };
  const existing = recordsFrom(session.travelV2PendingConsequenceQueue).filter(isPlainObject).filter((record) => record.queueKey !== queueKey);
  const nextPressure = { ...cloneData(session.pressure ?? {}) };
  nextPressure[supportedEffect.pressureTrack] = { ...(isPlainObject(nextPressure[supportedEffect.pressureTrack]) ? nextPressure[supportedEffect.pressureTrack] : {}), value: afterValue };
  const record = { ...cloneData(current), version: TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION, queueKey, status: "applied", decidedAt: appliedRecord.appliedAt, mutation: "session-pressure-only", selectedConsequence: consequenceSummary(catalogEntry), selectedConsequenceApplyPreview: prepareTravelV2SelectedConsequenceApplyPreview(session, queueKey, options), appliedEffect: appliedRecord };
  const nextSession = { ...cloneData(session), pressure: nextPressure, travelV2ConsequenceApplicationHistory: { version: 1, records: [...applicationRecordsFrom(session), appliedRecord] }, travelV2PendingConsequenceQueue: { version: TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION, records: [...existing, record], appliedRecords: [...cloneData(session.travelV2PendingConsequenceQueue?.appliedRecords ?? []), appliedRecord] } };
  return { ok: true, session: nextSession, queue: prepareTravelV2PendingConsequenceQueue(nextSession, options), record, appliedRecord };
}

export function inspectTravelV2ConsequenceApplicationFlow(session, options = {}) {
  const errors = [];
  const warnings = [];
  const notes = [];
  if (!isPlainObject(session)) errors.push("No active local Travel v2 runner session. Open or start a Travel Event Runner first.");
  const queue = prepareTravelV2PendingConsequenceQueue(session, options);
  const records = applicationRecordsFrom(session);
  const seen = new Set();
  let duplicateApplicationRecordCount = 0;
  for (const record of records) {
    const key = text(record.queueKey) || text(record.consequenceItemKey);
    if (key && seen.has(key)) duplicateApplicationRecordCount += 1;
    if (key) seen.add(key);
  }
  const invalidResourceMutationErrors = [];
  for (const record of records) {
    if (record.mutation !== "session-pressure-only") continue;
    const resource = text(record.resource) || text(record.pressureTrack);
    if (!SAFE_SESSION_PRESSURE_TRACKS.includes(resource)) invalidResourceMutationErrors.push(`Invalid resource key ${resource || "(blank)"} for ${record.applicationId ?? record.queueKey ?? "application record"}.`);
    if (finiteNumber(record.beforeValue) === null || finiteNumber(record.afterValue) === null) invalidResourceMutationErrors.push(`Non-finite before/after value for ${record.applicationId ?? record.queueKey ?? "application record"}.`);
  }
  const appliedStillPending = queue.items.filter((item) => item.status === "pending" && hasApplicationRecordForQueueItem(session, item.queueKey)).length;
  if (appliedStillPending > 0) errors.push("One or more applied consequence records still appear pending.");
  if (duplicateApplicationRecordCount > 0) errors.push("Duplicate consequence application records were found.");
  if (invalidResourceMutationErrors.length > 0) errors.push("Invalid consequence resource mutation records were found.");
  if (!queue.hasSession) errors.push("No pending consequence queue can be prepared for this session.");
  const pendingReviewable = queue.items.filter((item) => item.status === "pending");
  const canAdvanceRound = queue.pendingCount === 0 && queue.deferredCount === 0;
  if (!queue.items.length) notes.push("No pending consequence queue items are currently generated.");
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    sessionKey: text(session?.key),
    currentRoundIndex: Number.isInteger(Number(session?.currentRoundIndex)) ? Number(session.currentRoundIndex) : -1,
    currentRoundNumber: Number.isInteger(Number(session?.currentRoundIndex)) ? Number(session.currentRoundIndex) + 1 : 0,
    pendingConsequenceCount: queue.pendingCount,
    unappliedConsequenceCount: queue.items.filter((item) => item.status === "pending" && !hasApplicationRecordForQueueItem(session, item.queueKey)).length,
    appliedConsequenceCount: queue.appliedCount,
    dismissedConsequenceCount: queue.dismissedCount,
    resolvedConsequenceCount: queue.appliedCount + queue.dismissedCount,
    reviewedConsequenceCount: queue.appliedCount + queue.dismissedCount + queue.deferredCount,
    canApplyConsequences: pendingReviewable.some((item) => item.canApplySelectedConsequence === true),
    canDismissConsequences: pendingReviewable.length > 0,
    canAdvanceRound,
    applicationRecordCount: records.length,
    duplicateApplicationRecordCount,
    invalidResourceMutationCount: invalidResourceMutationErrors.length,
    invalidResourceMutationErrors,
    appliedStillPendingCount: appliedStillPending,
    notes
  };
}

function selectedConsequenceBatchApplyEligible(item = {}) {
  return item.status === "pending" &&
    isPlainObject(item.selectedConsequence) &&
    isPlainObject(item.selectedConsequenceApplyPreview) &&
    item.selectedConsequenceApplyPreview.executable === true &&
    item.selectedConsequenceApplyPreview.previewOnly === false &&
    item.canApplySelectedConsequence === true &&
    !isPlainObject(item.appliedEffect);
}
function selectedConsequenceBatchSkipReason(item = {}) {
  if (item.status !== "pending") return `Queue item status is ${item.status ?? "unknown"}.`;
  if (!isPlainObject(item.selectedConsequence) || !text(item.selectedConsequence.id)) return "No selected consequence catalog card.";
  if (isPlainObject(item.appliedEffect)) return "Selected consequence already has an applied effect.";
  if (!isPlainObject(item.selectedConsequenceApplyPreview)) return "Selected consequence has no apply preview.";
  if (item.selectedConsequenceApplyPreview.previewOnly === true) return "Selected consequence apply preview is preview-only.";
  if (item.selectedConsequenceApplyPreview.executable !== true) return "Selected consequence is not executable.";
  if (item.canApplySelectedConsequence !== true) return "Selected consequence cannot be applied.";
  return "Queue item is not eligible for batch Apply.";
}
function selectedConsequenceBatchSummary(item = {}, reason = "") {
  return { queueKey: item.queueKey, consequenceId: text(item.selectedConsequence?.id) || undefined, title: text(item.selectedConsequence?.title) || text(item.title) || undefined, reason };
}
function selectedConsequenceAppliedBatchSummary(item = {}, result = {}) {
  const appliedEffect = cloneData(result.appliedRecord ?? result.record?.appliedEffect ?? item.appliedEffect ?? null);
  return {
    queueKey: item.queueKey,
    consequenceId: text(appliedEffect?.consequenceId) || text(item.selectedConsequence?.id),
    title: text(item.selectedConsequence?.title) || text(item.selectedConsequenceApplyPreview?.title) || text(item.title),
    mutation: text(appliedEffect?.mutation) || text(item.selectedConsequenceApplyPreview?.mutation),
    affectedTrack: text(appliedEffect?.affectedTrack) || text(item.selectedConsequenceApplyPreview?.affectedTrack),
    appliedEffect
  };
}

export function applyAllExecutableTravelV2SelectedConsequencesToSession(session, options = {}) {
  const startedAt = timestamp(options);
  const initialQueue = prepareTravelV2PendingConsequenceQueue(session, options);
  const eligibleItems = initialQueue.items.filter((item) => selectedConsequenceBatchApplyEligible(item));
  const skipped = initialQueue.items.filter((item) => !selectedConsequenceBatchApplyEligible(item)).map((item) => selectedConsequenceBatchSummary(item, selectedConsequenceBatchSkipReason(item)));
  if (!eligibleItems.length) {
    return { ok: false, reason: "No executable pending selected consequences are available to apply.", session, queue: initialQueue, applied: [], skipped: [], attemptedCount: 0, appliedCount: 0, skippedCount: 0, startedAt, completedAt: timestamp(options), appliedEffectMutations: {} };
  }
  let nextSession = session;
  const applied = [];
  const appliedEffectMutations = {};
  for (const item of eligibleItems) {
    const result = applyTravelV2SelectedConsequenceToSession(nextSession, item.queueKey, options);
    if (!result.ok) {
      skipped.push(selectedConsequenceBatchSummary(item, result.error ?? "Single-item Apply failed."));
      continue;
    }
    nextSession = result.session;
    const nextQueue = prepareTravelV2PendingConsequenceQueue(nextSession, options);
    const appliedItem = nextQueue.items.find((candidate) => candidate.queueKey === item.queueKey) ?? item;
    const summary = selectedConsequenceAppliedBatchSummary(appliedItem, result);
    applied.push(summary);
    if (summary.mutation) appliedEffectMutations[summary.mutation] = (appliedEffectMutations[summary.mutation] ?? 0) + 1;
  }
  const completedAt = timestamp(options);
  const finalQueue = prepareTravelV2PendingConsequenceQueue(nextSession, options);
  return { ok: applied.length > 0, ...(applied.length > 0 ? {} : { reason: "No executable pending selected consequences were applied." }), session: nextSession, queue: finalQueue, applied, skipped, attemptedCount: eligibleItems.length, appliedCount: applied.length, skippedCount: skipped.length, startedAt, completedAt, appliedEffectMutations };
}

export function selectTravelV2PendingConsequenceCatalogCard(session, queueKey, consequenceId, options = {}) {
  if (!isPlainObject(session)) return { ok: false, session, error: "Travel v2 runner session is required." };
  if (!text(queueKey)) return { ok: false, session, error: "Pending consequence queue key is required." };
  if (!text(consequenceId)) return { ok: false, session, error: "Pending consequence catalog card id is required." };
  const queue = prepareTravelV2PendingConsequenceQueue(session, options);
  const item = queue.items.find((candidate) => candidate.queueKey === queueKey);
  if (!item) return { ok: false, session, queue, error: "Pending consequence queue item was not found." };
  const consequence = getTravelV2ConsequenceById(consequenceId);
  if (!consequence) return { ok: false, session, queue, error: "Pending consequence catalog card was not found." };
  if (!item.catalogSuggestions.some((suggestion) => suggestion.id === consequenceId)) return { ok: false, session, queue, error: "Pending consequence catalog card is not suggested for this queue item." };
  const current = recordsFrom(session.travelV2PendingConsequenceQueue).filter(isPlainObject).find((record) => record.queueKey === queueKey) ?? {};
  const existing = recordsFrom(session.travelV2PendingConsequenceQueue).filter(isPlainObject).filter((record) => record.queueKey !== queueKey);
  const record = {
    ...cloneData(current),
    version: TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION,
    queueKey,
    status: statusFrom(current.status ?? item.status),
    mutation: "none",
    selectedConsequence: consequenceSummary(consequence)
  };
  const nextSession = { ...cloneData(session), travelV2PendingConsequenceQueue: { version: TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION, records: [...existing, record] } };
  return { ok: true, session: nextSession, queue: prepareTravelV2PendingConsequenceQueue(nextSession, options), record };
}

function singleSuggestionSelectionSkipReason(item = {}) {
  if (item.status !== "pending") return `Queue item status is ${item.status ?? "unknown"}.`;
  if (item.hasAppliedEffect === true || isPlainObject(item.appliedEffect)) return "Queue item already has an applied effect.";
  if (hasSelectedConsequenceId(item)) return "Queue item already has a selected consequence.";
  const suggestionCount = Array.isArray(item.catalogSuggestions) ? item.catalogSuggestions.length : 0;
  if (suggestionCount === 0) return "Queue item has no catalog suggestions.";
  if (suggestionCount > 1) return "Queue item has multiple catalog suggestions.";
  if (!text(item.catalogSuggestions?.[0]?.id)) return "Queue item single catalog suggestion has no id.";
  return "Queue item is not eligible for single-suggestion selection.";
}
function singleSuggestionSelectionSkippedSummary(item = {}) {
  const selectedConsequenceId = text(item.selectedConsequence?.id);
  return {
    queueKey: item.queueKey,
    reason: singleSuggestionSelectionSkipReason(item),
    ...(selectedConsequenceId ? { selectedConsequenceId } : {}),
    suggestionCount: Array.isArray(item.catalogSuggestions) ? item.catalogSuggestions.length : 0
  };
}
function singleSuggestionSelectionSelectedSummary(item = {}) {
  const suggestion = item.catalogSuggestions?.[0] ?? {};
  return {
    queueKey: item.queueKey,
    consequenceId: text(suggestion.id),
    title: text(suggestion.title) || text(item.title)
  };
}

export function selectAllSingleSuggestionTravelV2PendingConsequences(session, options = {}) {
  const startedAt = timestamp(options);
  const initialQueue = prepareTravelV2PendingConsequenceQueue(session, options);
  if (!isPlainObject(session)) {
    return { ok: false, reason: "No pending consequence items have exactly one unselected catalog suggestion.", session, queue: initialQueue, selected: [], skipped: [], attemptedCount: 0, selectedCount: 0, skippedCount: 0 };
  }
  const eligibleItems = initialQueue.items.filter((item) => isSingleSuggestionSelectionEligible(item));
  const skipped = initialQueue.items.filter((item) => !isSingleSuggestionSelectionEligible(item)).map((item) => singleSuggestionSelectionSkippedSummary(item));
  if (!eligibleItems.length) {
    return { ok: false, reason: "No pending consequence items have exactly one unselected catalog suggestion.", session, queue: initialQueue, selected: [], skipped: [], attemptedCount: 0, selectedCount: 0, skippedCount: 0 };
  }
  let currentSession = session;
  const selected = [];
  for (const item of eligibleItems) {
    const suggestionId = text(item.catalogSuggestions?.[0]?.id);
    const result = selectTravelV2PendingConsequenceCatalogCard(currentSession, item.queueKey, suggestionId, options);
    if (!result.ok) {
      skipped.push({ ...singleSuggestionSelectionSkippedSummary(item), reason: result.error ?? "Single-suggestion selection failed." });
      continue;
    }
    currentSession = result.session;
    selected.push(singleSuggestionSelectionSelectedSummary(item));
  }
  const completedAt = timestamp(options);
  const finalQueue = prepareTravelV2PendingConsequenceQueue(currentSession, options);
  return {
    ok: selected.length > 0,
    ...(selected.length > 0 ? {} : { reason: "No pending consequence items have exactly one unselected catalog suggestion." }),
    session: currentSession,
    queue: finalQueue,
    selected,
    skipped,
    attemptedCount: eligibleItems.length,
    selectedCount: selected.length,
    skippedCount: skipped.length,
    startedAt,
    completedAt
  };
}

export default prepareTravelV2PendingConsequenceQueue;
