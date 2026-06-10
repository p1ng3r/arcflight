import { finalizeTravelEventDraft, normalizeTravelEventDraft, validateTravelEventDraft } from "./travel-event-builder.js";
import { validateTravelEventDefinition } from "./travel-events.js";

export const TRAVEL_EVENT_BUILDER_IO_VERSION = "0.1.0";

const BUILDER_METADATA_KEYS = new Set(["builder", "builderMetadata", "_builder", "builderVersion"]);
const UNSAFE_BOUNDARY_PATTERNS = Object.freeze([
  /\b(?:AP|RAP|action points?|reaction action points?)\b/i,
  /\b(?:start|create|roll)\s+(?:combat|encounter|initiative|combatants?)\b/i,
  /\b(?:automatically|auto)\s+(?:apply|start|create|roll|mutate|spend)\b/i,
  /\b(?:apply|mutate|update)\s+(?:staged effects?|ship resources?|actor|actors?)\b/i,
  /\b(?:ship-resource|ship resource)\s+mutation\b/i
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneData(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function containsFunctionValue(value, path = "root", found = []) {
  if (typeof value === "function") found.push(path);
  else if (Array.isArray(value)) value.forEach((entry, index) => containsFunctionValue(entry, `${path}[${index}]`, found));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, entry]) => containsFunctionValue(entry, `${path}.${key}`, found));
  return found;
}

function collectUnsafeBoundaryWarnings(value, path = "root", warnings = []) {
  if (typeof value === "string") {
    for (const pattern of UNSAFE_BOUNDARY_PATTERNS) {
      if (pattern.test(value)) {
        warnings.push(`${path} contains restricted travel automation or AP/RAP language.`);
        break;
      }
    }
  } else if (Array.isArray(value)) {
    value.forEach((entry, index) => collectUnsafeBoundaryWarnings(entry, `${path}[${index}]`, warnings));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => collectUnsafeBoundaryWarnings(entry, `${path}.${key}`, warnings));
  }
  return warnings;
}

function stripBuilderMetadata(value) {
  if (Array.isArray(value)) return value.map((entry) => stripBuilderMetadata(entry));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !BUILDER_METADATA_KEYS.has(key))
    .map(([key, entry]) => [key, stripBuilderMetadata(entry)]));
}

function sortStable(value) {
  if (Array.isArray(value)) return value.map((entry) => sortStable(entry));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortStable(value[key])]));
}

function stringifyStable(value, options = {}) {
  const spaces = Number.isInteger(options.spaces) ? options.spaces : 2;
  return JSON.stringify(sortStable(value), null, spaces);
}

function hasBuilderMetadata(value) {
  return isPlainObject(value) && Object.keys(value).some((key) => BUILDER_METADATA_KEYS.has(key));
}

function combineValidationWarnings(validation, boundaryWarnings) {
  return [...(validation?.warnings ?? []), ...boundaryWarnings];
}

export function parseTravelEventBuilderJson(jsonText, options = {}) {
  const errors = [];
  const warnings = [];
  void options;

  if (typeof jsonText !== "string" || jsonText.trim().length === 0) {
    return { ok: false, errors: ["Travel event builder JSON must be a non-empty string."], warnings, data: null };
  }

  try {
    const data = JSON.parse(jsonText);
    if (!isPlainObject(data)) errors.push("Travel event builder JSON root must be an object.");
    return { ok: errors.length === 0, errors, warnings, data: errors.length === 0 ? data : null };
  } catch (error) {
    errors.push(`Malformed travel event builder JSON: ${error.message}`);
    return { ok: false, errors, warnings, data: null };
  }
}

export function importTravelEventDraftFromData(data, options = {}) {
  const errors = [];
  const warnings = [];
  void options;

  if (!isPlainObject(data)) {
    return { ok: false, errors: ["Travel event draft import data must be an object."], warnings, draft: null, validation: null };
  }

  const functionPaths = containsFunctionValue(data);
  if (functionPaths.length > 0) errors.push(`Travel event draft import data must be data-only; function values found at: ${functionPaths.join(", ")}.`);
  if (errors.length > 0) return { ok: false, errors, warnings, draft: null, validation: null };

  const source = cloneData(data);
  const draft = normalizeTravelEventDraft(source);
  const validation = validateTravelEventDraft(draft, { strictAuthoring: true });
  const boundaryWarnings = collectUnsafeBoundaryWarnings(draft);
  warnings.push(...combineValidationWarnings(validation, boundaryWarnings));
  errors.push(...validation.errors);

  return { ok: validation.ok && errors.length === 0, errors, warnings, draft, validation };
}

export function importTravelEventDraftFromJson(jsonText, options = {}) {
  const parsed = parseTravelEventBuilderJson(jsonText, options);
  if (!parsed.ok) return { ok: false, errors: parsed.errors, warnings: parsed.warnings, draft: null, validation: null };
  const imported = importTravelEventDraftFromData(parsed.data, options);
  return {
    ok: imported.ok,
    errors: [...parsed.errors, ...imported.errors],
    warnings: [...parsed.warnings, ...imported.warnings],
    draft: imported.draft,
    validation: imported.validation
  };
}

export function exportTravelEventDraftToJson(draft, options = {}) {
  const { requireValid = false, includeBuilderMetadata = true } = options ?? {};
  const errors = [];
  const warnings = [];

  if (!isPlainObject(draft)) return { ok: false, errors: ["Travel event draft export input must be an object."], warnings, json: null, draft: null, validation: null };
  const functionPaths = containsFunctionValue(draft);
  if (functionPaths.length > 0) return { ok: false, errors: [`Travel event draft export input must be data-only; function values found at: ${functionPaths.join(", ")}.`], warnings, json: null, draft: null, validation: null };

  const normalized = normalizeTravelEventDraft(cloneData(draft));
  const validation = validateTravelEventDraft(normalized, { strictAuthoring: true });
  const boundaryWarnings = collectUnsafeBoundaryWarnings(normalized);
  warnings.push(...combineValidationWarnings(validation, boundaryWarnings));
  if (!validation.ok && requireValid) errors.push("Travel event draft export requires a valid draft.", ...validation.errors);
  const exportDraft = includeBuilderMetadata ? normalized : stripBuilderMetadata(normalized);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    json: errors.length === 0 ? stringifyStable(exportDraft, options) : null,
    draft: normalized,
    validation
  };
}

export function exportFinalTravelEventToJson(draftOrEvent, options = {}) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(draftOrEvent)) return { ok: false, errors: ["Final travel event export input must be an object."], warnings, json: null, event: null, validation: null };
  const functionPaths = containsFunctionValue(draftOrEvent);
  if (functionPaths.length > 0) return { ok: false, errors: [`Final travel event export input must be data-only; function values found at: ${functionPaths.join(", ")}.`], warnings, json: null, event: null, validation: null };

  const finalized = finalizeTravelEventDraft(cloneData(draftOrEvent), { strictAuthoring: true });
  if (!finalized.ok) {
    return { ok: false, errors: finalized.errors, warnings: finalized.warnings, json: null, event: null, validation: finalized.validation };
  }

  const event = stripBuilderMetadata(finalized.event);
  const validation = validateTravelEventDefinition(event, { strictAuthoring: true });
  const boundaryWarnings = collectUnsafeBoundaryWarnings(event);
  warnings.push(...combineValidationWarnings(validation, boundaryWarnings));
  if (!validation.ok) errors.push(...validation.errors);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    json: errors.length === 0 ? stringifyStable(event, options) : null,
    event: errors.length === 0 ? event : null,
    validation
  };
}

export function prepareTravelEventBuilderExportPreview(draftOrEvent, options = {}) {
  void options;
  const normalized = isPlainObject(draftOrEvent) ? normalizeTravelEventDraft(cloneData(draftOrEvent)) : null;
  const validation = normalized ? validateTravelEventDraft(normalized, { strictAuthoring: true }) : { ok: false, errors: ["Travel event export preview input must be an object."], warnings: [] };
  const finalExport = normalized ? exportFinalTravelEventToJson(normalized) : { ok: false };
  const draftExport = normalized ? exportTravelEventDraftToJson(normalized) : { ok: false };

  return Object.freeze({
    key: normalized?.key ?? null,
    name: normalized?.name ?? null,
    hasBuilderMetadata: hasBuilderMetadata(draftOrEvent),
    draftValidation: validation,
    finalizable: finalExport.ok,
    exportDraftAvailable: draftExport.ok,
    exportFinalAvailable: finalExport.ok,
    errorCount: validation.errors.length,
    warningCount: validation.warnings.length
  });
}
