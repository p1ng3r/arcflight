import {
  TRAVEL_V2_CONSEQUENCE_AFFECTED_TRACKS,
  TRAVEL_V2_CONSEQUENCE_CATALOG,
  TRAVEL_V2_CONSEQUENCE_SEVERITIES,
  TRAVEL_V2_CONSEQUENCE_SOURCES,
  normalizeTravelV2ConsequenceCatalogEntry as normalizeCatalogEntry,
  prepareTravelV2ConsequenceGmReview,
  prepareTravelV2ConsequencePlayerSafeSummary
} from "../../data/travel-events/travel-v2-consequence-catalog.js";
import { validateTravelV2CardDefinition } from "./travel-v2-card-schema.js";

const REQUIRED_FIELDS = Object.freeze(["id", "schemaVersion", "type", "title", "severity", "source", "affectedTrack", "publicText", "playerSafeSummary", "gmText", "status"]);
const FORBIDDEN_PLAYER_SAFE_FIELDS = Object.freeze(["gmText", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "before", "after", "applyPayload", "queueInternals"]);

function isPlainObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function cloneData(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function sources(entry) { return Array.isArray(entry.source) ? entry.source : [entry.source].filter(Boolean); }
function hasForbiddenField(entry) { return FORBIDDEN_PLAYER_SAFE_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(entry, field)); }
function gmLeak(entry) {
  const gmText = text(entry.gmText).toLowerCase();
  if (!gmText) return false;
  return [entry.publicText, entry.playerSafeSummary].some((value) => text(value).toLowerCase() === gmText);
}

export function normalizeTravelV2ConsequenceCatalogEntry(entry, options = {}) {
  const normalized = normalizeCatalogEntry(entry);
  if (!isPlainObject(normalized)) return normalized;
  if (options.includeContext === true && isPlainObject(options.context)) normalized.context = cloneData(options.context);
  return normalized;
}

export function validateTravelV2ConsequenceCatalogEntry(entry, options = {}) {
  const errors = [];
  const warnings = [];
  const normalized = normalizeTravelV2ConsequenceCatalogEntry(entry, options);
  if (!isPlainObject(normalized)) return { ok: false, errors: ["entry must be an object"], warnings, entry: normalized };
  for (const field of REQUIRED_FIELDS) {
    if (field === "source") {
      if (!sources(normalized).length) errors.push("source must include at least one source");
      continue;
    }
    if (text(normalized[field]).length === 0) errors.push(`${field} must be a non-empty string`);
  }
  if (normalized.type !== "consequence") errors.push("type must be consequence");
  if (!TRAVEL_V2_CONSEQUENCE_SEVERITIES.includes(normalized.severity)) errors.push(`severity must be one of: ${TRAVEL_V2_CONSEQUENCE_SEVERITIES.join(", ")}`);
  if (!TRAVEL_V2_CONSEQUENCE_AFFECTED_TRACKS.includes(normalized.affectedTrack)) errors.push(`affectedTrack must be one of: ${TRAVEL_V2_CONSEQUENCE_AFFECTED_TRACKS.join(", ")}`);
  for (const source of sources(normalized)) if (!TRAVEL_V2_CONSEQUENCE_SOURCES.includes(source)) warnings.push(`source is not in the foundation source list: ${source}`);
  if (gmLeak(normalized)) errors.push("gmText must not be copied into publicText or playerSafeSummary");
  if (isPlainObject(normalized.explicitGmApplyEffect) && !text(normalized.applyEffectSummary)) errors.push("applyEffectSummary is required when explicitGmApplyEffect is present");
  const schemaCandidate = { ...normalized, source: sources(normalized)[0] ?? "manual" };
  const schemaResult = validateTravelV2CardDefinition(schemaCandidate, options.schemaOptions ?? {});
  for (const error of schemaResult.errors) errors.push(`schema: ${error}`);
  for (const warning of schemaResult.warnings) warnings.push(`schema: ${warning}`);
  const playerSafe = prepareTravelV2ConsequencePlayerSafeSummary(normalized);
  if (hasForbiddenField(playerSafe)) errors.push("player-safe summary includes a forbidden GM-only/internal field");
  return { ok: errors.length === 0, errors, warnings, entry: normalized, playerSafeEntry: playerSafe, gmReviewEntry: prepareTravelV2ConsequenceGmReview(normalized) };
}

export function validateTravelV2ConsequenceCatalog(catalog = TRAVEL_V2_CONSEQUENCE_CATALOG, options = {}) {
  const errors = [];
  const warnings = [];
  const entries = [];
  const playerSafeEntries = [];
  const gmReviewEntries = [];
  const seenIds = new Set();
  const list = Array.isArray(catalog) ? catalog : [];
  if (!Array.isArray(catalog)) errors.push("catalog must be an array");
  list.forEach((entry, index) => {
    const result = validateTravelV2ConsequenceCatalogEntry(entry, options);
    for (const error of result.errors) errors.push(`entries[${index}]: ${error}`);
    for (const warning of result.warnings) warnings.push(`entries[${index}]: ${warning}`);
    if (result.entry) {
      entries.push(result.entry);
      if (seenIds.has(result.entry.id)) errors.push(`entries[${index}]: duplicate id ${result.entry.id}`);
      seenIds.add(result.entry.id);
    }
    if (result.playerSafeEntry) playerSafeEntries.push(result.playerSafeEntry);
    if (result.gmReviewEntry) gmReviewEntries.push(result.gmReviewEntry);
  });
  return { ok: errors.length === 0, errors, warnings, entries, playerSafeEntries, gmReviewEntries, counts: { entries: entries.length, playerSafeEntries: playerSafeEntries.length, gmReviewEntries: gmReviewEntries.length, ids: seenIds.size } };
}

export function prepareTravelV2ConsequenceCatalogReview(catalog = TRAVEL_V2_CONSEQUENCE_CATALOG, options = {}) {
  const result = validateTravelV2ConsequenceCatalog(catalog, options);
  return { ...result, entries: result.gmReviewEntries };
}

export function prepareTravelV2ConsequencePlayerSafeCatalog(catalog = TRAVEL_V2_CONSEQUENCE_CATALOG, options = {}) {
  const result = validateTravelV2ConsequenceCatalog(catalog, options);
  return { ...result, entries: result.playerSafeEntries };
}

export function buildTravelV2PendingConsequenceCandidate(entry, context = {}, options = {}) {
  const normalized = normalizeTravelV2ConsequenceCatalogEntry(entry, options);
  const playerSafe = prepareTravelV2ConsequencePlayerSafeSummary(normalized);
  return {
    version: 1,
    sourceType: text(context.sourceType) || "catalog",
    sourceId: text(context.sourceId),
    catalogId: normalized.id,
    title: normalized.title,
    severity: normalized.severity,
    affectedTrack: normalized.affectedTrack,
    publicSummary: playerSafe.playerSafeSummary || playerSafe.publicText,
    gmSummary: text(normalized.gmText) || text(normalized.applyEffectSummary),
    applyEffectSummary: normalized.applyEffectSummary,
    status: "pending",
    mutation: "none",
    requiresGmApply: true,
    selectedConsequence: playerSafe,
    context: cloneData(context)
  };
}
