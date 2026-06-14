import { finalizeTravelEventDraft, normalizeTravelEventDraft, validateTravelEventDraft, prepareTravelEventBuilderQualityReport, getPublishedTravelEventLibrary, publishTravelEventDraftToLibrary } from "./travel-event-builder.js";
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
  const validation = validateTravelEventDraft(source, { strictAuthoring: true });
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

  const source = cloneData(draft);
  const normalized = normalizeTravelEventDraft(source);
  const validation = validateTravelEventDraft(source, { strictAuthoring: true });
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

export const PUBLISHED_TRAVEL_EVENT_EXPORT_VERSION = 1;
export const PUBLISHED_TRAVEL_EVENT_EXPORT_TYPE = "arcflight.publishedTravelEvent";
export const PUBLISHED_TRAVEL_EVENT_PACK_EXPORT_TYPE = "arcflight.publishedTravelEventPack";

function getExportMetadata() {
  return {
    moduleId: "arcflight",
    worldId: globalThis.game?.world?.id ?? "",
    userId: globalThis.game?.user?.id ?? "",
    userName: globalThis.game?.user?.name ?? ""
  };
}

function normalizePublishedImportEvent(event, options = {}) {
  const finalized = finalizeTravelEventDraft(cloneData(event), { ...options, strictAuthoring: true });
  if (finalized.ok && finalized.event) return stripBuilderMetadata(finalized.event);
  return stripBuilderMetadata(normalizeTravelEventDraft(cloneData(event)));
}

function createPublishedImportCopyKey(baseKey, library, options = {}) {
  const events = Object.values(library?.events ?? {});
  const base = String(baseKey || "imported-travel-event");
  const timestamp = String(options.now instanceof Date ? options.now.toISOString() : (options.now ?? new Date().toISOString())).replace(/[^0-9]/g, "").slice(0, 14);
  let key = `${base}-copy-${timestamp}`;
  let index = 2;
  while (events.some((entry) => entry?.key === key)) key = `${base}-copy-${timestamp}-${index++}`;
  return key;
}

function getDuplicateEntryForEvent(event, library) {
  return Object.values(library?.events ?? {}).find((entry) => entry?.key === event?.key) ?? null;
}

export function buildPublishedTravelEventExportData(eventOrEntry, options = {}) {
  const sourceEvent = isPlainObject(eventOrEntry?.event) ? eventOrEntry.event : eventOrEntry;
  const validation = validateImportedPublishedTravelEvent(sourceEvent, options);
  if (!validation.ok) return { ok: false, errors: validation.errors, warnings: validation.warnings, data: null, event: null, validation };
  const data = { exportType: PUBLISHED_TRAVEL_EVENT_EXPORT_TYPE, exportVersion: PUBLISHED_TRAVEL_EVENT_EXPORT_VERSION, exportedAt: options.exportedAt ?? new Date().toISOString(), metadata: getExportMetadata(), event: validation.event };
  return { ok: true, errors: [], warnings: validation.warnings, data, event: validation.event, validation };
}

export function exportPublishedTravelEventToJson(eventOrEntry, options = {}) {
  const built = buildPublishedTravelEventExportData(eventOrEntry, options);
  return { ...built, json: built.ok ? stringifyStable(built.data, options) : null };
}

export function buildPublishedTravelEventPackExportData(eventsOrLibrary, options = {}) {
  const sourceEvents = Array.isArray(eventsOrLibrary) ? eventsOrLibrary : Object.values(eventsOrLibrary?.events ?? {}).map((entry) => entry?.event ?? entry);
  const errors = [];
  const warnings = [];
  const events = [];
  if (!Array.isArray(sourceEvents)) errors.push("Published Travel Event pack export requires an array or library object.");
  sourceEvents.forEach((event, index) => {
    const validation = validateImportedPublishedTravelEvent(event, options);
    if (!validation.ok) errors.push(...validation.errors.map((error) => `Event ${index + 1}: ${error}`));
    warnings.push(...validation.warnings.map((warning) => `Event ${index + 1}: ${warning}`));
    if (validation.event) events.push(validation.event);
  });
  const data = errors.length === 0 ? { exportType: PUBLISHED_TRAVEL_EVENT_PACK_EXPORT_TYPE, exportVersion: PUBLISHED_TRAVEL_EVENT_EXPORT_VERSION, exportedAt: options.exportedAt ?? new Date().toISOString(), metadata: getExportMetadata(), events } : null;
  return { ok: errors.length === 0, errors, warnings, data, events };
}

export function exportPublishedTravelEventPackToJson(eventsOrLibrary, options = {}) {
  const built = buildPublishedTravelEventPackExportData(eventsOrLibrary, options);
  return { ...built, json: built.ok ? stringifyStable(built.data, options) : null };
}

export function parsePublishedTravelEventJson(jsonText, options = {}) {
  const parsed = parseTravelEventBuilderJson(jsonText, options);
  if (!parsed.ok) return { ok: false, errors: parsed.errors, warnings: parsed.warnings, data: null, event: null };
  const data = parsed.data;
  if (data.exportType !== PUBLISHED_TRAVEL_EVENT_EXPORT_TYPE) return { ok: false, errors: [`Published Travel Event JSON exportType must be "${PUBLISHED_TRAVEL_EVENT_EXPORT_TYPE}".`], warnings: parsed.warnings, data, event: null };
  if (data.exportVersion !== PUBLISHED_TRAVEL_EVENT_EXPORT_VERSION) return { ok: false, errors: ["Published Travel Event JSON exportVersion is unsupported."], warnings: parsed.warnings, data, event: null };
  if (!isPlainObject(data.event)) return { ok: false, errors: ["Published Travel Event JSON is missing event data."], warnings: parsed.warnings, data, event: null };
  return { ok: true, errors: [], warnings: parsed.warnings, data, event: data.event };
}

export function parsePublishedTravelEventPackJson(jsonText, options = {}) {
  const parsed = parseTravelEventBuilderJson(jsonText, options);
  if (!parsed.ok) return { ok: false, errors: parsed.errors, warnings: parsed.warnings, data: null, events: [] };
  const data = parsed.data;
  if (data.exportType !== PUBLISHED_TRAVEL_EVENT_PACK_EXPORT_TYPE) return { ok: false, errors: [`Published Travel Event pack JSON exportType must be "${PUBLISHED_TRAVEL_EVENT_PACK_EXPORT_TYPE}".`], warnings: parsed.warnings, data, events: [] };
  if (data.exportVersion !== PUBLISHED_TRAVEL_EVENT_EXPORT_VERSION) return { ok: false, errors: ["Published Travel Event pack JSON exportVersion is unsupported."], warnings: parsed.warnings, data, events: [] };
  if (!Array.isArray(data.events)) return { ok: false, errors: ["Published Travel Event pack JSON is missing events array."], warnings: parsed.warnings, data, events: [] };
  return { ok: true, errors: [], warnings: parsed.warnings, data, events: data.events };
}

export function validateImportedPublishedTravelEvent(event, options = {}) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(event)) return { ok: false, errors: ["Imported published Travel Event must be an object."], warnings, event: null, validation: null, qualityReport: null };
  const functionPaths = containsFunctionValue(event);
  if (functionPaths.length > 0) errors.push(`Imported published Travel Event must be data-only; function values found at: ${functionPaths.join(", ")}.`);
  const normalized = normalizePublishedImportEvent(event, options);
  if (normalized?.builder !== undefined) delete normalized.builder;
  const validation = validateTravelEventDefinition(normalized, { ...options, strictAuthoring: true });
  const qualityReport = prepareTravelEventBuilderQualityReport(normalized, options);
  errors.push(...(validation.errors ?? []));
  if (qualityReport?.errors?.length > 0) errors.push(...qualityReport.errors.map((issue) => `Quality error at ${issue.path || issue.area}: ${issue.message}`));
  warnings.push(...(validation.warnings ?? []), ...(qualityReport?.warnings ?? []).map((issue) => `Quality warning at ${issue.path || issue.area}: ${issue.message}`));
  if (Array.isArray(normalized?.rounds) && !normalized.rounds.every((round) => Array.isArray(round.activeStations) && round.activeStations.every((station) => typeof station === "string"))) errors.push("Imported published Travel Event activeStations must normalize to string keys only.");
  return { ok: errors.length === 0, errors, warnings, event: errors.length === 0 ? normalized : null, validation, qualityReport };
}

function buildPublishedImportPreview(events, importType, options = {}) {
  const library = getPublishedTravelEventLibrary(options);
  const rows = events.map((sourceEvent, index) => {
    const validation = validateImportedPublishedTravelEvent(sourceEvent, options);
    const event = validation.event ?? (isPlainObject(sourceEvent) ? normalizePublishedImportEvent(sourceEvent, options) : null);
    const duplicate = validation.event ? getDuplicateEntryForEvent(validation.event, library) : null;
    const actionRequired = duplicate ? (options.overwrite === true ? "overwrite-confirmation-required" : "save-as-copy") : "save";
    return {
      index,
      name: event?.name ?? sourceEvent?.name ?? "<missing>",
      key: event?.key ?? sourceEvent?.key ?? "<missing>",
      category: event?.category ?? sourceEvent?.category ?? "<missing>",
      roundCount: event?.roundCount ?? (Array.isArray(event?.rounds) ? event.rounds.length : 0),
      valid: validation.ok,
      validationStatus: validation.ok ? "valid" : "invalid",
      duplicateKey: Boolean(duplicate),
      duplicateId: duplicate?.id ?? "",
      actionRequired,
      warnings: validation.warnings,
      errors: validation.errors
    };
  });
  const errors = rows.flatMap((row) => row.errors.map((error) => `${row.name}: ${error}`));
  const warnings = rows.flatMap((row) => row.warnings.map((warning) => `${row.name}: ${warning}`));
  return Object.freeze({ importType, eventCount: rows.length, events: rows, valid: errors.length === 0, validationStatus: errors.length === 0 ? "valid" : "invalid", duplicateKeyConflicts: rows.filter((row) => row.duplicateKey), warnings, errors, requiresConfirmation: rows.some((row) => row.duplicateKey), defaultDuplicateBehavior: importType === "single" ? "save-as-copy" : "save-all-as-copies" });
}

export function preparePublishedTravelEventImportPreview(jsonTextOrData, options = {}) {
  const parsed = typeof jsonTextOrData === "string" ? parsePublishedTravelEventJson(jsonTextOrData, options) : { ok: isPlainObject(jsonTextOrData), errors: isPlainObject(jsonTextOrData) ? [] : ["Published Travel Event import preview requires event data."], warnings: [], event: jsonTextOrData };
  if (!parsed.ok) return Object.freeze({ importType: "single", eventCount: 0, events: [], valid: false, validationStatus: "invalid", duplicateKeyConflicts: [], warnings: parsed.warnings, errors: parsed.errors, requiresConfirmation: false, defaultDuplicateBehavior: "save-as-copy" });
  return buildPublishedImportPreview([parsed.event], "single", options);
}

export function preparePublishedTravelEventPackImportPreview(jsonTextOrData, options = {}) {
  const parsed = typeof jsonTextOrData === "string" ? parsePublishedTravelEventPackJson(jsonTextOrData, options) : { ok: Array.isArray(jsonTextOrData), errors: Array.isArray(jsonTextOrData) ? [] : ["Published Travel Event pack import preview requires an events array."], warnings: [], events: jsonTextOrData };
  if (!parsed.ok) return Object.freeze({ importType: "pack", eventCount: 0, events: [], valid: false, validationStatus: "invalid", duplicateKeyConflicts: [], warnings: parsed.warnings, errors: parsed.errors, requiresConfirmation: false, defaultDuplicateBehavior: "save-all-as-copies" });
  return buildPublishedImportPreview(parsed.events, "pack", options);
}

export function importPublishedTravelEventFromJson(jsonText, options = {}) {
  const parsed = parsePublishedTravelEventJson(jsonText, options);
  const preview = preparePublishedTravelEventImportPreview(jsonText, options);
  if (!parsed.ok) return { ok: false, errors: parsed.errors, warnings: parsed.warnings, event: null, preview, validation: null };
  const validation = validateImportedPublishedTravelEvent(parsed.event, options);
  return { ok: validation.ok, errors: validation.errors, warnings: [...parsed.warnings, ...validation.warnings], event: validation.event, preview, validation };
}

export function importPublishedTravelEventPackFromJson(jsonText, options = {}) {
  const parsed = parsePublishedTravelEventPackJson(jsonText, options);
  const preview = preparePublishedTravelEventPackImportPreview(jsonText, options);
  if (!parsed.ok) return { ok: false, errors: parsed.errors, warnings: parsed.warnings, events: [], preview, validations: [] };
  const validations = parsed.events.map((event) => validateImportedPublishedTravelEvent(event, options));
  return { ok: validations.every((validation) => validation.ok), errors: validations.flatMap((validation) => validation.errors), warnings: [...parsed.warnings, ...validations.flatMap((validation) => validation.warnings)], events: validations.filter((validation) => validation.event).map((validation) => validation.event), preview, validations };
}

export async function saveImportedPublishedTravelEventToLibrary(event, options = {}) {
  const library = getPublishedTravelEventLibrary(options);
  const validation = validateImportedPublishedTravelEvent(event, options);
  if (!validation.ok || !validation.event) return { ok: false, errors: validation.errors, warnings: validation.warnings, library, entry: null, event: null, preview: preparePublishedTravelEventImportPreview(event, options) };
  const duplicate = getDuplicateEntryForEvent(validation.event, library);
  const duplicateMode = options.duplicateMode ?? "copy";
  if (duplicate && duplicateMode === "overwrite" && options.confirmOverwrite !== true) return { ok: false, errors: [`Overwrite for published event key "${validation.event.key}" requires explicit confirmOverwrite: true.`], warnings: validation.warnings, library, entry: null, event: validation.event, preview: preparePublishedTravelEventImportPreview(event, options) };
  const eventToSave = duplicate && duplicateMode !== "overwrite" ? { ...validation.event, key: createPublishedImportCopyKey(validation.event.key, library, options), name: options.copyName ?? `${validation.event.name || validation.event.key} Copy` } : validation.event;
  const id = duplicate && duplicateMode === "overwrite" ? duplicate.id : undefined;
  return publishTravelEventDraftToLibrary(eventToSave, { ...options, library, id, overwrite: duplicate && duplicateMode === "overwrite", sourceDraftId: "" });
}

export async function saveImportedPublishedTravelEventPackToLibrary(events, options = {}) {
  const sourceEvents = Array.isArray(events) ? events : [];
  const libraryStart = getPublishedTravelEventLibrary(options);
  const preview = preparePublishedTravelEventPackImportPreview(sourceEvents, options);
  if (!preview.valid) return { ok: false, errors: preview.errors, warnings: preview.warnings, library: libraryStart, entries: [], events: [], preview };
  const duplicateMode = options.duplicateMode ?? "copy";
  if (duplicateMode === "cancel") return { ok: false, cancelled: true, errors: ["Pack import cancelled."], warnings: [], library: libraryStart, entries: [], events: [], preview };
  if (duplicateMode === "overwrite" && options.confirmOverwrite !== true && preview.duplicateKeyConflicts.length > 0) return { ok: false, errors: ["Pack overwrite requires explicit confirmOverwrite: true."], warnings: preview.warnings, library: libraryStart, entries: [], events: [], preview };
  let workingLibrary = libraryStart;
  const entries = [];
  const savedEvents = [];
  const errors = [];
  const warnings = [...preview.warnings];
  for (const event of sourceEvents) {
    const normalized = validateImportedPublishedTravelEvent(event, options).event;
    const duplicate = getDuplicateEntryForEvent(normalized, workingLibrary);
    if (duplicate && duplicateMode === "skip") { warnings.push(`Skipped duplicate published event key "${normalized.key}".`); continue; }
    const saved = await saveImportedPublishedTravelEventToLibrary(normalized, { ...options, library: workingLibrary, duplicateMode, confirmOverwrite: options.confirmOverwrite === true, dryRun: true });
    if (!saved.ok) { errors.push(...(saved.errors ?? [])); continue; }
    workingLibrary = saved.library;
    entries.push(saved.entry);
    savedEvents.push(saved.event);
  }
  if (errors.length === 0 && !options.dryRun) await globalThis.game?.settings?.set?.("arcflight", "publishedTravelEventLibrary", workingLibrary);
  return { ok: errors.length === 0, errors, warnings, library: workingLibrary, entries, events: savedEvents, preview };
}
