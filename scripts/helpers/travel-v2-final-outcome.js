import { normalizeTravelV2HazardDeckState, sanitizeTravelV2PublicHazard } from "./travel-v2-hazards.js";
import { normalizeTravelV2ShipScarsState } from "./travel-v2-ship-scars.js";

const FORBIDDEN_STRINGS = Object.freeze(["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions", "hiddenHazards", "debugReport", "futureTriggers"]);
const PUBLIC_PRESSURE_LABELS = Object.freeze({ hull: "Hull", strain: "Strain", lifeveil: "Lifeveil", morale: "Morale", supplies: "Supplies" });
const PUBLIC_ENTRY_KEYS = Object.freeze(["id", "key", "name", "label", "title", "text", "summary", "description", "playerText", "publicText", "displayText", "status", "category", "severity", "roundIndex", "roundNumber", "outcomeKey", "sourceType"]);
const EMPTY_ARRAY_KEYS = Object.freeze(["unresolvedHazards", "resolvedHazards", "consequences", "rewards", "clues", "routeAdvantages", "followUps", "scars", "pressureChanges", "gmReviewPrompts"]);

function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function cloneData(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function recordsFrom(value) {
  if (Array.isArray(value)) return value;
  if (!isPlainObject(value)) return [];
  return ["records", "pending", "active", "cleared", "resolved", "unresolved", "items", "entries", "candidates"].flatMap((key) => recordsFrom(value[key]));
}
function humanize(value) { return String(value ?? "").replace(/[-_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function safeString(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return FORBIDDEN_STRINGS.some((needle) => text.includes(needle)) || /Actor\.[A-Za-z0-9_-]+|User\.[A-Za-z0-9_-]+|Compendium\./.test(text) ? "" : text;
}
function safeValue(value) {
  if (Array.isArray(value)) return value.map(safeValue).filter((entry) => entry !== undefined && entry !== "");
  if (isPlainObject(value)) {
    const output = {};
    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_STRINGS.includes(key)) continue;
      const safe = safeValue(nested);
      if (safe !== undefined) output[key] = safe;
    }
    return output;
  }
  if (typeof value === "string") return safeString(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  return undefined;
}
function isHiddenEntry(value) {
  return isPlainObject(value) && (
    value.hidden === true ||
    value.gmOnly === true ||
    value.unrevealedHazard === true ||
    value.playerVisible === false ||
    value.revealed === false ||
    value.public === false
  );
}
function publicEntry(value) {
  if (isHiddenEntry(value)) return null;
  if (typeof value === "string") return safeString(value);
  if (!isPlainObject(value)) return null;
  const output = {};
  for (const key of PUBLIC_ENTRY_KEYS) if (value[key] !== undefined) output[key] = safeValue(value[key]);
  if (!Object.keys(output).length) output.text = safeString(value.name ?? value.label ?? value.title ?? value.text ?? value.summary ?? "");
  return Object.values(output).some((entry) => String(entry ?? "").trim()) ? output : null;
}
function collectPublicEntries(...values) { return values.flatMap(recordsFrom).filter((entry) => !isHiddenEntry(entry)).map(publicEntry).filter(Boolean); }
function finalOutcome(session) { return session?.finalOutcome ?? session?.outcome ?? session?.aftermath ?? session?.event?.finalOutcome ?? session?.event?.outcome ?? session?.event?.aftermath ?? {}; }
function completionState(session) { return safeString(session?.completionState ?? session?.travelV2EventCompletion?.state ?? session?.status ?? ""); }
function hasFinalOutcome(session) { return isPlainObject(session) && (session.status === "completed" || session.completed === true || Boolean(session.completedAt) || isPlainObject(session.finalOutcome) || isPlainObject(session.aftermath)); }
function locationChangeFrom(session, outcome) {
  const source = outcome.locationChange ?? session?.locationChange ?? session?.route?.locationChange ?? {};
  const from = safeString(source.from ?? session?.route?.from ?? session?.startLocation ?? session?.origin ?? "");
  const to = safeString(source.to ?? session?.route?.to ?? session?.endLocation ?? session?.destination ?? "");
  const summary = safeString(source.summary ?? (from && to ? `${from} → ${to}` : ""));
  return { from, to, summary };
}
function collectHazards(session) {
  const state = normalizeTravelV2HazardDeckState(session?.travelV2Hazards ?? session?.hazards ?? {});
  const publicRecords = state.records.filter((record) => record.revealed === true || record.playerVisible === true || record.public === true);
  return {
    unresolved: publicRecords.filter((record) => record.status !== "cleared").map((record) => safeValue(sanitizeTravelV2PublicHazard(record))),
    resolved: publicRecords.filter((record) => record.status === "cleared").map((record) => safeValue(sanitizeTravelV2PublicHazard(record)))
  };
}
function collectScars(session, outcome) {
  const source = session?.travelV2ShipScars ?? session?.shipScars ?? outcome.shipScars ?? {};
  const hiddenIds = new Set(recordsFrom(source).filter(isHiddenEntry).map((record) => String(record.id ?? record.key ?? record.scarId ?? "")).filter(Boolean));
  return normalizeTravelV2ShipScarsState(source).records
    .filter((record) => !isHiddenEntry(record) && !hiddenIds.has(String(record.id ?? record.key ?? record.scarId ?? "")))
    .map((record) => publicEntry({ id: record.id, name: record.name, category: record.category, severity: record.severity, status: record.status, text: record.playerText ?? record.flavorText ?? record.repairRequirement }))
    .filter(Boolean);
}
function collectPressureChanges(session, outcome) {
  const records = recordsFrom(outcome.pressureChanges).concat(recordsFrom(outcome.pressure), recordsFrom(session?.pressureChanges), recordsFrom(session?.travelV2PressureChanges));
  const deltas = records.length ? records : recordsFrom(session?.travelV2PressureApplications).flatMap((record) => Object.entries(record.totalsByPressureType ?? record.pressureDelta ?? {}).map(([key, value]) => ({ key, value })));
  return deltas.map((entry) => {
    const key = String(entry.key ?? entry.resource ?? entry.pressureType ?? "").toLowerCase();
    if (!Object.hasOwn(PUBLIC_PRESSURE_LABELS, key)) return null;
    const amount = Number(entry.value ?? entry.amount ?? entry.delta ?? 0) || 0;
    const direction = amount > 0 ? "increased" : (amount < 0 ? "reduced" : "unchanged");
    return { resource: PUBLIC_PRESSURE_LABELS[key], direction, summary: `${PUBLIC_PRESSURE_LABELS[key]} ${direction}${amount ? ` by ${Math.abs(amount)}` : ""}.` };
  }).filter(Boolean);
}

export function prepareTravelV2FinalOutcomePackage(session, options = {}) {
  const source = isPlainObject(session) ? session : null;
  const outcome = finalOutcome(source);
  const hazards = collectHazards(source ?? {});
  const rounds = Array.isArray(source?.event?.rounds) ? source.event.rounds : [];
  const completedRounds = recordsFrom(source?.travelV2RoundResolutions).length || (Array.isArray(source?.roundResults) ? source.roundResults.length : 0) || (Array.isArray(source?.summary?.rounds) ? source.summary.rounds.length : 0);
  const category = safeString(source?.event?.category ?? source?.category ?? "");
  const eventName = safeString(source?.event?.name ?? source?.eventName ?? source?.name ?? "");
  const completion = completionState(source);
  const currentRoundIndex = Number.isInteger(Number(source?.currentRoundIndex)) ? Number(source.currentRoundIndex) : 0;
  const currentRoundNumber = Number.isInteger(Number(source?.currentRoundNumber)) ? Number(source.currentRoundNumber) : currentRoundIndex + 1;
  const result = {
    hasFinalOutcome: hasFinalOutcome(source),
    eventKey: safeString(source?.event?.key ?? source?.eventKey ?? source?.key ?? ""),
    eventName,
    category,
    categoryLabel: humanize(category),
    roundCount: rounds.length,
    completedRoundCount: completedRounds,
    currentRoundIndex,
    currentRoundNumber,
    completionState: completion,
    locationChange: locationChangeFrom(source, outcome),
    unresolvedHazards: hazards.unresolved,
    resolvedHazards: hazards.resolved,
    consequences: collectPublicEntries(outcome.consequences, outcome.consequenceCandidates, source?.consequences, source?.consequenceCandidates, source?.visibleStakes?.consequences),
    rewards: collectPublicEntries(outcome.rewards, outcome.rewardCandidates, source?.rewards, source?.rewardCandidates, source?.visibleStakes?.rewards),
    clues: collectPublicEntries(outcome.clues, source?.clues, source?.discoveries, source?.visibleStakes?.clues),
    routeAdvantages: collectPublicEntries(outcome.routeAdvantages, source?.routeAdvantages, source?.visibleStakes?.routeAdvantages),
    followUps: collectPublicEntries(outcome.followUps, source?.followUps, source?.travelV2FollowUps),
    scars: collectScars(source ?? {}, outcome),
    pressureChanges: collectPressureChanges(source ?? {}, outcome),
    outcomeSummary: safeString(outcome.summary ?? outcome.text ?? source?.summary?.finalOutcomeText ?? (eventName ? `${eventName} is ready for GM aftermath review.` : "")),
    gmReviewPrompts: ["Review consequences, rewards, clues, route advantages, follow-ups, scars, and pressure changes before applying anything persistently."],
    playerSafeSummary: "Aftermath package prepared for player-safe review. Nothing has been applied automatically.",
    safetyNote: "Review only. This helper does not persist changes or mutate actors, items, chat, journals, sockets, scenes, tokens, compendia, or world data."
  };
  if (options.includeEmptyArrays !== false) for (const key of EMPTY_ARRAY_KEYS) result[key] = Array.isArray(result[key]) ? result[key] : [];
  return Object.freeze(safeValue(cloneData(result)));
}

export default prepareTravelV2FinalOutcomePackage;
