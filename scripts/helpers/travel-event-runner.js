import { getStation } from "../../data/stations/core-stations.js";
import { ARCFLIGHT_MODULE_ID, ARCFLIGHT_TRAVEL_RESOURCES, ARCFLIGHT_TRAVEL_STATIONS } from "../config/constants.js";
import { getShipTravelResources, previewShipTravelResourceChange, updateShipTravelResources } from "../documents/ships.js";
import { getPublishedTravelEventLibrary, loadPublishedTravelEventFromLibrary, preparePublishedTravelEventLibraryState } from "./travel-event-builder.js";
import { validateTravelEventDefinition } from "./travel-events.js";

export const TRAVEL_EVENT_RUNNER_SESSION_VERSION = 1;
export const TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING = "travelEventRunnerSessionLibrary";
export const TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_VERSION = 1;
export const TRAVEL_EVENT_RUNNER_RESULT_VALUES = Object.freeze(["criticalFailure", "failure", "success", "criticalSuccess", "skipped"]);
export const TRAVEL_EVENT_RUNNER_FINAL_OUTCOMES = Object.freeze(["criticalSuccess", "success", "mixed", "failure", "criticalFailure"]);

const TRAVEL_FIVE_STATION_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_STATIONS));
const RESULT_SCORES = Object.freeze({ criticalSuccess: 2, success: 1, skipped: 0, failure: -1, criticalFailure: -2 });
const FINAL_OUTCOME_LABELS = Object.freeze({
  criticalSuccess: "Critical Success",
  success: "Success",
  mixed: "Mixed",
  failure: "Failure",
  criticalFailure: "Critical Failure"
});

const REVIEW_RESOURCE_KEYS = Object.freeze([
  ARCFLIGHT_TRAVEL_RESOURCES.HULL,
  ARCFLIGHT_TRAVEL_RESOURCES.STRAIN,
  ARCFLIGHT_TRAVEL_RESOURCES.LIFEVEIL,
  ARCFLIGHT_TRAVEL_RESOURCES.MORALE,
  ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES
]);
const REVIEW_RESOURCE_MODES = Object.freeze(["add", "set"]);
const REVIEW_NOT_APPLIED_WARNING = "Review only. Effects have not been applied.";

function getResourceMaxKey(resource) {
  if (resource === ARCFLIGHT_TRAVEL_RESOURCES.HULL) return "maxHull";
  if (resource === ARCFLIGHT_TRAVEL_RESOURCES.LIFEVEIL) return "maxLifeveil";
  if (resource === ARCFLIGHT_TRAVEL_RESOURCES.STRAIN) return "maxStrain";
  return "";
}

function resolveReviewResources(shipOrResources = null) {
  if (!shipOrResources || typeof shipOrResources !== "object") return null;
  if (typeof shipOrResources.getFlag === "function" || shipOrResources.type) {
    try {
      return getShipTravelResources(shipOrResources);
    } catch (_error) {
      return null;
    }
  }
  return cloneData(shipOrResources);
}

function valueDisplay(value) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function cloneData(value) {
  if (value == null) return value;
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nowIso(options = {}) {
  if (typeof options.now === "string" && options.now.length > 0) return options.now;
  if (options.now instanceof Date) return options.now.toISOString();
  return new Date().toISOString();
}

function slugifySessionKey(value) {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "travel-event-runner-session";
}

function humanizeIdentifier(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeStationKey(entry) {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object" && !Array.isArray(entry)) return entry.stationKey ?? entry.key ?? "";
  return "";
}

function getPromptFromRound(round, stationKey) {
  const promptFromMap = round?.stationPrompts?.[stationKey];
  if (promptFromMap && typeof promptFromMap === "object" && !Array.isArray(promptFromMap)) return { ...promptFromMap, stationKey: promptFromMap.stationKey ?? stationKey };
  const promptFromActiveStation = (round?.activeStations ?? []).find((entry) => normalizeStationKey(entry) === stationKey);
  if (promptFromActiveStation && typeof promptFromActiveStation === "object" && !Array.isArray(promptFromActiveStation)) return { ...promptFromActiveStation, stationKey };
  return { stationKey };
}

function normalizeRoundDefinition(round, index) {
  const activeStationKeys = Array.isArray(round?.activeStations)
    ? round.activeStations.map(normalizeStationKey).filter((stationKey) => TRAVEL_FIVE_STATION_KEYS.includes(stationKey))
    : [];
  return {
    round: Number.isInteger(Number(round?.round)) ? Number(round.round) : index + 1,
    title: typeof round?.title === "string" ? round.title : `Round ${index + 1}`,
    openingVignette: typeof round?.openingVignette === "string" ? round.openingVignette : "",
    activeStations: Array.from(new Set(activeStationKeys)),
    stationPrompts: Object.fromEntries(Array.from(new Set(activeStationKeys)).map((stationKey) => [stationKey, cloneData(getPromptFromRound(round, stationKey))]))
  };
}

function normalizeFinalOutcomes(finalOutcomes = {}) {
  const source = finalOutcomes && typeof finalOutcomes === "object" && !Array.isArray(finalOutcomes) ? finalOutcomes : {};
  return Object.fromEntries(TRAVEL_EVENT_RUNNER_FINAL_OUTCOMES.map((key) => {
    const outcome = source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) ? source[key] : {};
    return [key, {
      key,
      label: typeof outcome.label === "string" && outcome.label.length > 0 ? outcome.label : FINAL_OUTCOME_LABELS[key],
      text: typeof outcome.text === "string" ? outcome.text : (typeof outcome.narrative === "string" ? outcome.narrative : ""),
      proposedEffects: Array.isArray(outcome.proposedEffects) ? cloneData(outcome.proposedEffects) : []
    }];
  }));
}

function normalizeEventForRunner(event) {
  const rounds = Array.isArray(event?.rounds) ? event.rounds.map(normalizeRoundDefinition) : [];
  return {
    key: typeof event?.key === "string" ? event.key : "",
    name: typeof event?.name === "string" ? event.name : (typeof event?.key === "string" ? humanizeIdentifier(event.key) : "Untitled Travel Event"),
    category: typeof event?.category === "string" ? event.category : "",
    categoryLabel: humanizeIdentifier(event?.category),
    baseDC: Number.isFinite(Number(event?.baseDC)) ? Number(event.baseDC) : 0,
    roundCount: Number.isInteger(Number(event?.roundCount)) && Number(event.roundCount) > 0 ? Number(event.roundCount) : rounds.length,
    rounds,
    finalOutcomes: normalizeFinalOutcomes(event?.finalOutcomes)
  };
}

function validateRunnerEvent(event, options = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) errors.push("Travel Event Runner requires a finalized published event object.");
  if (event?.builder !== undefined) errors.push("Travel Event Runner cannot start from a draft containing builder metadata.");
  if (!Array.isArray(event?.rounds) || event.rounds.length === 0) errors.push("Travel Event Runner requires at least one round.");
  const validation = event && typeof event === "object" && !Array.isArray(event) ? validateTravelEventDefinition(event, { ...options, strictAuthoring: true }) : { ok: false, errors: [], warnings: [] };
  errors.push(...(validation.errors ?? []));
  return { ok: errors.length === 0, errors, warnings: validation.warnings ?? [], validation };
}

function createRoundResults(event) {
  return event.rounds.map((round, index) => ({
    roundIndex: index,
    roundNumber: round.round,
    title: round.title,
    stationResults: Object.fromEntries(round.activeStations.map((stationKey) => [stationKey, null]))
  }));
}

export function prepareTravelEventRunnerLibraryState(options = {}) {
  const state = preparePublishedTravelEventLibraryState(options);
  const selectedId = typeof options.selectedEventId === "string" ? options.selectedEventId : "";
  const entries = (state.entries ?? []).map((entry, index) => ({
    ...entry,
    categoryLabel: humanizeIdentifier(entry.category),
    publishedAtLabel: entry.publishedAt ? new Date(entry.publishedAt).toLocaleString() : "",
    selected: selectedId ? entry.id === selectedId || entry.key === selectedId : index === 0
  }));
  return { ...state, entries, selectedEventId: entries.find((entry) => entry.selected)?.id ?? "", hasLoadableEvents: entries.some((entry) => entry.canLoad) };
}

export function createTravelEventRunnerSession(event, options = {}) {
  const runnerValidation = validateRunnerEvent(event, options);
  if (!runnerValidation.ok) return { ok: false, errors: runnerValidation.errors, warnings: runnerValidation.warnings, session: null };

  const normalizedEvent = normalizeEventForRunner(event);
  const timestamp = nowIso(options);
  const session = {
    version: TRAVEL_EVENT_RUNNER_SESSION_VERSION,
    status: "active",
    event: normalizedEvent,
    currentRoundIndex: 0,
    roundResults: createRoundResults(normalizedEvent),
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: "",
    summary: null
  };

  return { ok: true, errors: [], warnings: runnerValidation.warnings, session };
}

export function normalizeTravelEventRunnerSession(session, options = {}) {
  const errors = [];
  if (!session || typeof session !== "object" || Array.isArray(session)) return { ok: false, errors: ["Travel Event Runner session is malformed."], warnings: [], session: null };
  const event = normalizeEventForRunner(session.event ?? {});
  if (event.rounds.length === 0) errors.push("Travel Event Runner session has no rounds.");
  const currentRoundIndex = Math.min(Math.max(Number.isInteger(Number(session.currentRoundIndex)) ? Number(session.currentRoundIndex) : 0, 0), Math.max(event.rounds.length - 1, 0));
  const roundResults = createRoundResults(event).map((roundResult, index) => {
    const source = Array.isArray(session.roundResults) ? session.roundResults[index] : null;
    const sourceResults = source?.stationResults && typeof source.stationResults === "object" && !Array.isArray(source.stationResults) ? source.stationResults : {};
    return {
      ...roundResult,
      stationResults: Object.fromEntries(Object.keys(roundResult.stationResults).map((stationKey) => [stationKey, TRAVEL_EVENT_RUNNER_RESULT_VALUES.includes(sourceResults[stationKey]) ? sourceResults[stationKey] : null]))
    };
  });
  const normalized = {
    key: typeof session.key === "string" ? session.key : "",
    version: TRAVEL_EVENT_RUNNER_SESSION_VERSION,
    status: ["active", "completed"].includes(session.status) ? session.status : "active",
    event,
    currentRoundIndex,
    roundResults,
    startedAt: typeof session.startedAt === "string" ? session.startedAt : nowIso(options),
    updatedAt: typeof session.updatedAt === "string" ? session.updatedAt : nowIso(options),
    completedAt: typeof session.completedAt === "string" ? session.completedAt : "",
    summary: session.summary && typeof session.summary === "object" ? cloneData(session.summary) : null,
    appliedEffects: normalizeTravelEventAppliedEffects(session.appliedEffects)
  };
  return { ok: errors.length === 0, errors, warnings: [], session: normalized };
}

function normalizeTravelEventAppliedEffects(appliedEffects = {}) {
  const source = isPlainObject(appliedEffects) ? appliedEffects : {};
  const records = Array.isArray(source.records) ? source.records.filter(isPlainObject).map((record) => ({
    applicationId: typeof record.applicationId === "string" ? record.applicationId : "",
    effectId: typeof record.effectId === "string" ? record.effectId : "",
    effectIndex: Number.isInteger(Number(record.effectIndex)) ? Number(record.effectIndex) : null,
    effectLabel: typeof record.effectLabel === "string" ? record.effectLabel : "",
    effectType: typeof record.effectType === "string" ? record.effectType : "",
    resource: typeof record.resource === "string" ? record.resource : "",
    mode: typeof record.mode === "string" ? record.mode : "",
    value: Number.isFinite(Number(record.value)) ? Number(record.value) : null,
    actorId: typeof record.actorId === "string" ? record.actorId : "",
    actorName: typeof record.actorName === "string" ? record.actorName : "",
    beforeValue: Number.isFinite(Number(record.beforeValue)) ? Number(record.beforeValue) : null,
    afterValue: Number.isFinite(Number(record.afterValue)) ? Number(record.afterValue) : null,
    appliedAt: typeof record.appliedAt === "string" ? record.appliedAt : "",
    source: record.source === "travel-event-runner" ? "travel-event-runner" : "travel-event-runner",
    undone: record.undone === true,
    undoneAt: typeof record.undoneAt === "string" ? record.undoneAt : "",
    undoneByUserId: typeof record.undoneByUserId === "string" ? record.undoneByUserId : "",
    undoneByUserName: typeof record.undoneByUserName === "string" ? record.undoneByUserName : "",
    undoBeforeValue: Number.isFinite(Number(record.undoBeforeValue)) ? Number(record.undoBeforeValue) : null,
    undoAfterValue: Number.isFinite(Number(record.undoAfterValue)) ? Number(record.undoAfterValue) : null,
    undoReason: typeof record.undoReason === "string" ? record.undoReason : ""
  })) : [];
  return { records };
}

function prepareStationRows(session, round, roundResult) {
  return round.activeStations.map((stationKey) => {
    const station = getStation(stationKey) ?? {};
    const prompt = round.stationPrompts[stationKey] ?? { stationKey };
    const suggestedSkills = Array.isArray(prompt.suggestedSkills) && prompt.suggestedSkills.length > 0
      ? prompt.suggestedSkills
      : (Array.isArray(station.primarySkills) ? station.primarySkills : []);
    const result = roundResult?.stationResults?.[stationKey] ?? null;
    return {
      stationKey,
      stationName: prompt.stationName || station.displayName || station.name || humanizeIdentifier(stationKey),
      prompt: prompt.playerAction || prompt.vignette || "No station prompt provided.",
      vignette: prompt.vignette || "",
      suggestedSkills,
      suggestedSkillsLabel: suggestedSkills.map(humanizeIdentifier).join(", "),
      result,
      resultLabel: result ? humanizeIdentifier(result) : "Unrecorded",
      resultOptions: TRAVEL_EVENT_RUNNER_RESULT_VALUES.map((value) => ({ value, label: humanizeIdentifier(value), selected: value === result }))
    };
  });
}


function getGameSettingRunnerSessionLibrary() {
  const settings = globalThis.game?.settings;
  if (!settings || typeof settings.get !== "function") return null;
  try {
    return settings.get(ARCFLIGHT_MODULE_ID, TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING);
  } catch (_error) {
    return null;
  }
}

async function setGameSettingRunnerSessionLibrary(library) {
  const settings = globalThis.game?.settings;
  if (!settings || typeof settings.set !== "function") throw new Error("Foundry game.settings is not available for the Travel Event Runner Session library.");
  return settings.set(ARCFLIGHT_MODULE_ID, TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING, cloneData(library));
}

function buildRunnerLibraryResult(ok, data = {}) {
  return {
    ok: Boolean(ok),
    errors: Array.isArray(data.errors) ? data.errors : [],
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    ...data
  };
}

function createUniqueRunnerSessionKey(library, seed, options = {}) {
  const sessions = library?.sessions ?? {};
  const base = slugifySessionKey(seed || "travel-event-runner-session");
  if (!Object.hasOwn(sessions, base)) return base;

  const timestamp = nowIso(options).replace(/[^0-9]/g, "").slice(0, 14);
  const timestamped = `${base}-${timestamp}`;
  if (!Object.hasOwn(sessions, timestamped)) return timestamped;

  let index = 2;
  while (Object.hasOwn(sessions, `${timestamped}-${index}`)) index += 1;
  return `${timestamped}-${index}`;
}

function normalizeRunnerSessionLibraryEntry(key, entry = {}, options = {}) {
  const fallbackTimestamp = nowIso(options);
  const source = isPlainObject(entry) ? entry : {};
  const normalizedSession = normalizeTravelEventRunnerSession(isPlainObject(source.session) ? source.session : source, options);
  const session = normalizedSession.session;
  const event = session?.event ?? {};
  const status = ["active", "completed"].includes(source.status) ? source.status : (session?.status ?? "active");
  const entryKey = typeof source.key === "string" && source.key.length > 0 ? source.key : key;
  if (session && !session.key) session.key = entryKey;

  return {
    key: entryKey,
    name: typeof source.name === "string" && source.name.length > 0 ? source.name : (event.name ? `${event.name} Session` : entryKey),
    eventKey: typeof source.eventKey === "string" ? source.eventKey : (event.key ?? ""),
    eventName: typeof source.eventName === "string" && source.eventName.length > 0 ? source.eventName : (event.name ?? ""),
    eventCategory: typeof source.eventCategory === "string" ? source.eventCategory : (event.category ?? ""),
    status,
    currentRoundIndex: Number.isInteger(Number(source.currentRoundIndex)) ? Number(source.currentRoundIndex) : (session?.currentRoundIndex ?? 0),
    startedAt: typeof source.startedAt === "string" && source.startedAt.length > 0 ? source.startedAt : (session?.startedAt ?? fallbackTimestamp),
    completedAt: typeof source.completedAt === "string" ? source.completedAt : (session?.completedAt ?? ""),
    updatedAt: typeof source.updatedAt === "string" && source.updatedAt.length > 0 ? source.updatedAt : (session?.updatedAt ?? fallbackTimestamp),
    session: session ? cloneData(session) : null,
    isMalformed: normalizedSession.ok !== true,
    validationErrors: normalizedSession.errors ?? [],
    validationWarnings: normalizedSession.warnings ?? []
  };
}

function normalizeTravelEventRunnerSessionLibraryData(rawLibrary, options = {}) {
  const source = isPlainObject(rawLibrary) ? rawLibrary : {};
  const sourceSessions = isPlainObject(source.sessions) ? source.sessions : {};
  const sessions = {};
  for (const [key, entry] of Object.entries(sourceSessions)) {
    if (typeof key !== "string" || key.length === 0) continue;
    sessions[key] = normalizeRunnerSessionLibraryEntry(key, entry, options);
  }
  return {
    version: Number.isInteger(source.version) ? source.version : TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_VERSION,
    sessions
  };
}

function getRunnerSessionLibraryEntries(library) {
  return Object.values(library.sessions ?? {}).sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")) || String(a.name ?? "").localeCompare(String(b.name ?? "")));
}

function findRunnerSessionLibraryEntry(library, sessionKey) {
  const key = String(sessionKey ?? "");
  return library.sessions?.[key] ?? getRunnerSessionLibraryEntries(library).find((candidate) => candidate.key === key) ?? null;
}

function publishedEventExistsForSession(entry, options = {}) {
  const eventKey = entry?.eventKey ?? entry?.session?.event?.key ?? "";
  if (!eventKey) return false;
  const library = getPublishedTravelEventLibrary(Object.hasOwn(options, "publishedLibrary") ? { ...options, library: options.publishedLibrary } : options);
  return Object.values(library.events ?? {}).some((candidate) => candidate.id === eventKey || candidate.key === eventKey);
}

export function cloneTravelEventRunnerSession(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  return { ok: true, errors: [], warnings: normalized.warnings, session: cloneData(normalized.session) };
}

export function getTravelEventRunnerSessionLibrary(options = {}) {
  const rawLibrary = Object.hasOwn(options, "runnerSessionLibrary") ? options.runnerSessionLibrary : (Object.hasOwn(options, "library") ? options.library : getGameSettingRunnerSessionLibrary());
  return normalizeTravelEventRunnerSessionLibraryData(rawLibrary, options);
}

export async function saveTravelEventRunnerSessionToLibrary(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  const library = getTravelEventRunnerSessionLibrary(options);
  if (!normalized.ok || !normalized.session) return buildRunnerLibraryResult(false, { errors: normalized.errors, warnings: normalized.warnings, library, entry: null, session: null });

  const overwrite = options.overwrite === true;
  const explicitKey = typeof options.key === "string" && options.key.length > 0 ? options.key : (typeof normalized.session.key === "string" && normalized.session.key.length > 0 ? normalized.session.key : "");
  const key = explicitKey || createUniqueRunnerSessionKey(library, `${normalized.session.event.key || normalized.session.event.name}-${nowIso(options)}`, options);
  if (Object.hasOwn(library.sessions, key) && !overwrite) {
    return buildRunnerLibraryResult(false, { errors: [`Runner session "${key}" already exists; pass overwrite: true or use Save Current Session As.`], warnings: [], library, entry: cloneData(library.sessions[key]), session: cloneData(normalized.session) });
  }

  const timestamp = nowIso(options);
  const existing = library.sessions[key] ?? null;
  const nextSession = cloneData(normalized.session);
  nextSession.key = key;
  nextSession.updatedAt = timestamp;
  if (nextSession.status === "completed" && !nextSession.summary) nextSession.summary = summarizeTravelEventRunnerSession(nextSession, options).summary;

  const entry = {
    key,
    name: typeof options.name === "string" && options.name.length > 0 ? options.name : (existing?.name ?? `${nextSession.event.name} Session`),
    eventKey: nextSession.event.key,
    eventName: nextSession.event.name,
    eventCategory: nextSession.event.category,
    status: nextSession.status,
    currentRoundIndex: nextSession.currentRoundIndex,
    startedAt: nextSession.startedAt,
    completedAt: nextSession.completedAt,
    updatedAt: timestamp,
    session: nextSession
  };

  const nextLibrary = { ...library, version: TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_VERSION, sessions: { ...library.sessions, [key]: entry } };
  if (!options.dryRun) await setGameSettingRunnerSessionLibrary(nextLibrary);
  return buildRunnerLibraryResult(true, { warnings: [], library: nextLibrary, entry: cloneData(entry), session: cloneData(nextSession) });
}

export function loadTravelEventRunnerSessionFromLibrary(sessionKey, options = {}) {
  const library = getTravelEventRunnerSessionLibrary(options);
  const entry = findRunnerSessionLibraryEntry(library, sessionKey);
  if (!entry) return buildRunnerLibraryResult(false, { errors: [`No Travel Event Runner session found for "${String(sessionKey ?? "")}".`], warnings: [], library, entry: null, session: null });
  if (!entry.session || entry.isMalformed) return buildRunnerLibraryResult(false, { errors: entry.validationErrors?.length ? entry.validationErrors : [`Travel Event Runner session "${entry.key}" is malformed and cannot be loaded.`], warnings: entry.validationWarnings ?? [], library, entry: cloneData(entry), session: null });
  const normalized = normalizeTravelEventRunnerSession(entry.session, options);
  if (!normalized.ok) return buildRunnerLibraryResult(false, { errors: normalized.errors, warnings: normalized.warnings, library, entry: cloneData(entry), session: null });
  const session = cloneData(normalized.session);
  session.key = entry.key;
  const warnings = [...(normalized.warnings ?? [])];
  if (!publishedEventExistsForSession(entry, options)) warnings.push(`Saved runner session "${entry.name}" references published event "${entry.eventKey || entry.eventName || "<missing>"}", which is not currently in the Published Travel Event Library. Loading the saved session snapshot only.`);
  return buildRunnerLibraryResult(true, { warnings, library, entry: cloneData(entry), session });
}

export async function deleteTravelEventRunnerSessionFromLibrary(sessionKey, options = {}) {
  const library = getTravelEventRunnerSessionLibrary(options);
  const entry = findRunnerSessionLibraryEntry(library, sessionKey);
  if (!entry) return buildRunnerLibraryResult(false, { errors: [`No Travel Event Runner session found for "${String(sessionKey ?? "")}".`], warnings: [], library, deleted: null });
  const { [entry.key]: _deleted, ...remainingSessions } = library.sessions;
  const nextLibrary = { ...library, sessions: remainingSessions };
  if (!options.dryRun) await setGameSettingRunnerSessionLibrary(nextLibrary);
  return buildRunnerLibraryResult(true, { warnings: [], library: nextLibrary, deleted: cloneData(entry) });
}

export async function duplicateTravelEventRunnerSession(sessionKey, options = {}) {
  const loaded = loadTravelEventRunnerSessionFromLibrary(sessionKey, options);
  if (!loaded.ok || !loaded.session) return buildRunnerLibraryResult(false, { errors: loaded.errors, warnings: loaded.warnings, library: loaded.library, entry: null, session: null });
  const key = createUniqueRunnerSessionKey(loaded.library, `${loaded.entry?.key ?? sessionKey}-copy`, options);
  const session = cloneData(loaded.session);
  session.key = key;
  const name = typeof options.name === "string" && options.name.length > 0 ? options.name : `${loaded.entry?.name ?? session.event.name ?? key} Copy`;
  return saveTravelEventRunnerSessionToLibrary(session, { ...options, library: loaded.library, key, name, overwrite: false });
}

export function prepareTravelEventRunnerSessionLibraryState(options = {}) {
  const library = getTravelEventRunnerSessionLibrary(options);
  const selectedSessionKey = typeof options.selectedSessionKey === "string" ? options.selectedSessionKey : "";
  const entries = getRunnerSessionLibraryEntries(library).map((entry) => ({
    ...cloneData(entry),
    session: undefined,
    eventCategoryLabel: humanizeIdentifier(entry.eventCategory),
    statusLabel: humanizeIdentifier(entry.status),
    currentRoundNumber: Number(entry.currentRoundIndex ?? 0) + 1,
    updatedAtLabel: entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : "",
    startedAtLabel: entry.startedAt ? new Date(entry.startedAt).toLocaleString() : "",
    completedAtLabel: entry.completedAt ? new Date(entry.completedAt).toLocaleString() : "",
    canLoad: entry.isMalformed !== true && Boolean(entry.session),
    canDuplicate: entry.isMalformed !== true && Boolean(entry.session),
    canDelete: true,
    selected: selectedSessionKey ? entry.key === selectedSessionKey : false,
    missingPublishedEvent: !publishedEventExistsForSession(entry, options)
  }));
  return Object.freeze({
    settingKey: `${ARCFLIGHT_MODULE_ID}.${TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING}`,
    version: library.version,
    entries,
    count: entries.length,
    hasSessions: entries.length > 0,
    selectedSessionKey
  });
}

export function prepareTravelEventRunnerState(session = null, options = {}) {
  const libraryState = prepareTravelEventRunnerLibraryState(options);
  const sessionLibraryOptions = Object.hasOwn(options, "runnerSessionLibrary") ? { ...options, library: options.runnerSessionLibrary } : options;
  const sessionLibraryState = prepareTravelEventRunnerSessionLibraryState(sessionLibraryOptions);
  const normalized = session ? normalizeTravelEventRunnerSession(session, options) : { ok: true, errors: [], warnings: [], session: null };
  const activeSession = normalized.session;
  const currentRound = activeSession?.event.rounds[activeSession.currentRoundIndex] ?? null;
  const currentRoundResult = activeSession?.roundResults[activeSession.currentRoundIndex] ?? null;
  const summary = activeSession?.status === "completed" ? summarizeTravelEventRunnerSession(activeSession, options).summary : null;

  return {
    ok: normalized.ok,
    errors: normalized.errors,
    warnings: normalized.warnings,
    library: libraryState,
    sessionLibrary: sessionLibraryState,
    hasSavedSessions: sessionLibraryState.hasSessions === true,
    canSaveSession: Boolean(activeSession),
    canSaveSessionAs: Boolean(activeSession),
    hasPublishedEvents: libraryState.hasEvents === true,
    hasLoadableEvents: libraryState.hasLoadableEvents === true,
    session: activeSession,
    hasSession: Boolean(activeSession),
    isCompleted: activeSession?.status === "completed",
    event: activeSession?.event ?? null,
    currentRound,
    currentRoundNumber: currentRound ? activeSession.currentRoundIndex + 1 : 0,
    currentRoundTitle: currentRound?.title ?? "",
    currentRoundOpeningVignette: currentRound?.openingVignette ?? "",
    stations: activeSession && currentRound ? prepareStationRows(activeSession, currentRound, currentRoundResult) : [],
    hasStations: Boolean(activeSession && currentRound && currentRound.activeStations.length > 0),
    canRetreat: Boolean(activeSession && activeSession.currentRoundIndex > 0 && activeSession.status !== "completed"),
    canAdvance: Boolean(activeSession && activeSession.currentRoundIndex < activeSession.event.rounds.length - 1 && activeSession.status !== "completed"),
    canComplete: Boolean(activeSession && activeSession.status !== "completed"),
    summary,
    summaryOutput: prepareTravelEventRunnerSummaryOutputState(activeSession, options),
    stagedEffectReview: prepareTravelEventStagedEffectReviewState(activeSession, options),
    summaryJson: summary ? exportTravelEventRunnerSessionToJson(activeSession, options).json : ""
  };
}

export function setTravelEventRunnerStationResult(session, roundIndex, stationKey, result, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  if (!TRAVEL_EVENT_RUNNER_RESULT_VALUES.includes(result)) return { ok: false, errors: [`Invalid travel runner station result "${result}".`], warnings: [], session: normalized.session };
  const index = Number(roundIndex);
  if (!Number.isInteger(index) || !normalized.session.roundResults[index]) return { ok: false, errors: [`Travel runner round ${roundIndex} does not exist.`], warnings: [], session: normalized.session };
  if (!Object.hasOwn(normalized.session.roundResults[index].stationResults, stationKey)) return { ok: false, errors: [`Station "${stationKey}" is not active in round ${index + 1}.`], warnings: [], session: normalized.session };
  const nextSession = cloneData(normalized.session);
  nextSession.roundResults[index].stationResults[stationKey] = result;
  nextSession.updatedAt = nowIso(options);
  nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function advanceTravelEventRunnerRound(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  nextSession.currentRoundIndex = Math.min(nextSession.currentRoundIndex + 1, nextSession.event.rounds.length - 1);
  nextSession.updatedAt = nowIso(options);
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function retreatTravelEventRunnerRound(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  nextSession.currentRoundIndex = Math.max(nextSession.currentRoundIndex - 1, 0);
  nextSession.updatedAt = nowIso(options);
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

function scoreSession(session) {
  return session.roundResults.reduce((total, round) => total + Object.values(round.stationResults).reduce((subtotal, result) => subtotal + (RESULT_SCORES[result] ?? 0), 0), 0);
}

function mapScoreToFinalOutcome(score) {
  // MVP mapping is intentionally simple and transparent: each station result is
  // worth -2..+2, then the final total chooses a canonical final outcome.
  if (score >= 4) return "criticalSuccess";
  if (score > 0) return "success";
  if (score === 0) return "mixed";
  if (score <= -4) return "criticalFailure";
  return "failure";
}

export function summarizeTravelEventRunnerSession(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return { ...normalized, summary: null, json: "" };
  const activeSession = normalized.session;
  const totalScore = scoreSession(activeSession);
  const suggestedFinalOutcome = mapScoreToFinalOutcome(totalScore);
  const finalOutcome = activeSession.event.finalOutcomes[suggestedFinalOutcome] ?? { key: suggestedFinalOutcome, label: FINAL_OUTCOME_LABELS[suggestedFinalOutcome], text: "", proposedEffects: [] };
  const summary = {
    version: TRAVEL_EVENT_RUNNER_SESSION_VERSION,
    event: {
      key: activeSession.event.key,
      name: activeSession.event.name,
      category: activeSession.event.category,
      baseDC: activeSession.event.baseDC
    },
    startedAt: activeSession.startedAt,
    completedAt: activeSession.completedAt || nowIso(options),
    totalScore,
    suggestedFinalOutcome,
    suggestedFinalOutcomeLabel: finalOutcome.label || FINAL_OUTCOME_LABELS[suggestedFinalOutcome],
    finalOutcomeText: finalOutcome.text || "",
    stagedProposedEffects: cloneData(finalOutcome.proposedEffects ?? []),
    stagedProposedEffectRows: (finalOutcome.proposedEffects ?? []).map((effect, index) => ({ index, json: JSON.stringify(effect, null, 2) })),
    rounds: activeSession.roundResults.map((roundResult, index) => ({
      roundIndex: index,
      roundNumber: roundResult.roundNumber,
      title: roundResult.title,
      stationResults: cloneData(roundResult.stationResults)
    }))
  };
  return { ok: true, errors: [], warnings: [], session: activeSession, summary };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatEffectForReport(effect, index) {
  const label = typeof effect?.label === "string" && effect.label.trim() ? effect.label.trim() : `Proposed Effect ${index + 1}`;
  return { index, label, json: JSON.stringify(effect ?? {}, null, 2) };
}

export function prepareTravelEventResourceEffectPreview(effect, shipOrResources = null, options = {}) {
  const resources = resolveReviewResources(shipOrResources ?? options.ship ?? options.resources ?? null);
  const resource = effect?.resource;
  const mode = effect?.mode;
  const value = Number(effect?.value);
  const currentValue = resources && Object.hasOwn(resources, resource) && Number.isFinite(Number(resources[resource])) ? Number(resources[resource]) : null;
  let previewValue = currentValue == null || !Number.isFinite(value) ? null : (mode === "set" ? value : currentValue + value);
  const warnings = [];
  const actor = options.ship ?? null;
  if (actor && currentValue != null && Number.isFinite(value)) {
    try {
      const changes = { [resource]: (mode === "set" ? value : currentValue + value) - currentValue };
      const helperPreview = previewShipTravelResourceChange(actor, changes);
      previewValue = helperPreview.after?.[resource] ?? previewValue;
      warnings.push(...(helperPreview.warnings ?? []));
    } catch (_error) {
      // Review previews can also run against plain resource snapshots.
    }
  }
  const maxKey = getResourceMaxKey(resource);
  const maxValue = maxKey && resources && Number.isFinite(Number(resources[maxKey])) ? Number(resources[maxKey]) : null;
  if (previewValue != null && previewValue < 0) warnings.push(`${resource} preview value ${previewValue} is below minimum 0.`);
  if (previewValue != null && maxValue != null && maxValue > 0 && previewValue > maxValue) warnings.push(`${resource} preview value ${previewValue} exceeds known maximum ${maxValue}.`);
  return { resources, currentValue, previewValue, hasCurrentValue: currentValue != null, hasPreviewValue: previewValue != null, maxValue, warnings };
}

export function normalizeTravelEventProposedEffectForReview(effect, index, options = {}) {
  const rawJson = JSON.stringify(effect ?? null, null, 2);
  const label = typeof effect?.label === "string" && effect.label.trim() ? effect.label.trim() : `Staged Effect ${index + 1}`;
  const base = { index, displayIndex: index + 1, label, type: typeof effect?.type === "string" ? effect.type : "unsupported", resource: "", mode: "", value: null, currentValue: null, previewValue: null, hasCurrentValue: false, hasPreviewValue: false, status: "unsupported", supported: false, warnings: [], raw: cloneData(effect), rawJson };
  if (!isPlainObject(effect)) return { ...base, status: "unsupported", warnings: ["Effect is not a data object."] };
  if (effect.type === "note") return { ...base, type: "note", text: typeof effect.text === "string" ? effect.text : "", status: "note", supported: true };
  if (effect.type !== "resource") return base;

  const value = Number(effect.value);
  const warnings = [];
  if (!REVIEW_RESOURCE_KEYS.includes(effect.resource)) warnings.push(`Unsupported resource "${effect.resource ?? "<missing>"}".`);
  if (!REVIEW_RESOURCE_MODES.includes(effect.mode)) warnings.push(`Unsupported resource mode "${effect.mode ?? "<missing>"}".`);
  if (!Number.isFinite(value)) warnings.push(`Resource effect value "${effect.value ?? "<missing>"}" is not numeric.`);
  if (warnings.length) return { ...base, type: "resource", resource: effect.resource ?? "", mode: effect.mode ?? "", value: effect.value ?? null, status: "invalid", warnings };

  const preview = prepareTravelEventResourceEffectPreview(effect, options.ship ?? options.resources ?? null, options);
  return { ...base, type: "resource", resource: effect.resource, mode: effect.mode, value, currentValue: preview.currentValue, previewValue: preview.previewValue, hasCurrentValue: preview.hasCurrentValue, hasPreviewValue: preview.hasPreviewValue, status: "ready", supported: true, warnings: preview.warnings };
}

export function prepareTravelEventStagedEffectReview(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return { ...normalized, available: false, reason: normalized.errors?.[0] ?? "Travel Event Runner session is malformed.", review: null };
  if (normalized.session.status !== "completed") return { ok: true, errors: [], warnings: [], session: normalized.session, available: false, reason: "Staged consequence review is unavailable until the runner session is completed.", review: null };
  const summarized = summarizeTravelEventRunnerSession(normalized.session, options);
  const summary = summarized.summary;
  const effects = Array.isArray(summary?.stagedProposedEffects) ? summary.stagedProposedEffects : [];
  const rows = effects.map((effect, index) => normalizeTravelEventProposedEffectForReview(effect, index, options));
  const supportedEffectCount = rows.filter((row) => row.supported).length;
  const unsupportedEffectCount = rows.length - supportedEffectCount;
  const review = {
    available: true,
    eventName: summary.event.name,
    finalOutcomeKey: summary.suggestedFinalOutcome,
    finalOutcomeLabel: summary.suggestedFinalOutcomeLabel,
    effectCount: rows.length,
    supportedEffectCount,
    unsupportedEffectCount,
    notAppliedWarning: REVIEW_NOT_APPLIED_WARNING,
    rows
  };
  return { ok: true, errors: [], warnings: [], session: normalized.session, available: true, review };
}

export function renderTravelEventStagedEffectReviewMarkdown(session, options = {}) {
  const prepared = prepareTravelEventStagedEffectReview(session, options);
  if (!prepared.available || !prepared.review) return { ...prepared, markdown: "" };
  const r = prepared.review;
  const lines = [`# Staged Consequence Review — ${r.eventName}`, "", `**${r.notAppliedWarning}**`, "", `- **Final Outcome:** ${r.finalOutcomeLabel}`, `- **Effect Count:** ${r.effectCount}`, `- **Supported Effects:** ${r.supportedEffectCount}`, `- **Unsupported Effects:** ${r.unsupportedEffectCount}`];
  if (!r.rows.length) lines.push("", "No proposed effects are attached to the final outcome.");
  for (const row of r.rows) {
    lines.push("", `## ${row.displayIndex}. ${row.label}`, `- **Type:** ${row.type}`, `- **Status:** ${row.status}`, `- **Resource:** ${valueDisplay(row.resource)}`, `- **Mode:** ${valueDisplay(row.mode)}`, `- **Value:** ${valueDisplay(row.value)}`, `- **Current Value:** ${valueDisplay(row.currentValue)}`, `- **Preview Value:** ${valueDisplay(row.previewValue)}`);
    if (row.warnings.length) lines.push(`- **Warnings:** ${row.warnings.join("; ")}`);
    lines.push("", "```json", row.rawJson, "```");
  }
  return { ...prepared, markdown: lines.join("\n") };
}

export function renderTravelEventStagedEffectReviewHtml(session, options = {}) {
  const prepared = prepareTravelEventStagedEffectReview(session, options);
  if (!prepared.available || !prepared.review) return { ...prepared, html: "" };
  const r = prepared.review;
  const rows = r.rows.length ? r.rows.map((row) => `<article class="arcflight-travel-runner-review__effect"><h3>${escapeHtml(row.displayIndex)}. ${escapeHtml(row.label)}</h3><dl><dt>Type</dt><dd>${escapeHtml(row.type)}</dd><dt>Status</dt><dd>${escapeHtml(row.status)}</dd><dt>Resource</dt><dd>${escapeHtml(valueDisplay(row.resource))}</dd><dt>Mode</dt><dd>${escapeHtml(valueDisplay(row.mode))}</dd><dt>Value</dt><dd>${escapeHtml(valueDisplay(row.value))}</dd><dt>Current Value</dt><dd>${escapeHtml(valueDisplay(row.currentValue))}</dd><dt>Preview Value</dt><dd>${escapeHtml(valueDisplay(row.previewValue))}</dd></dl>${row.warnings.length ? `<p><strong>Warnings:</strong> ${escapeHtml(row.warnings.join("; "))}</p>` : ""}<pre>${escapeHtml(row.rawJson)}</pre></article>`).join("") : "<p>No proposed effects are attached to the final outcome.</p>";
  const html = `<section class="arcflight-travel-runner-review"><h1>Staged Consequence Review — ${escapeHtml(r.eventName)}</h1><p><strong>${escapeHtml(r.notAppliedWarning)}</strong></p><ul><li><strong>Final Outcome:</strong> ${escapeHtml(r.finalOutcomeLabel)}</li><li><strong>Effect Count:</strong> ${escapeHtml(r.effectCount)}</li><li><strong>Supported Effects:</strong> ${escapeHtml(r.supportedEffectCount)}</li><li><strong>Unsupported Effects:</strong> ${escapeHtml(r.unsupportedEffectCount)}</li></ul>${rows}</section>`;
  return { ...prepared, html };
}

export function prepareTravelEventStagedEffectReviewState(session, options = {}) {
  const review = prepareTravelEventStagedEffectReview(session, options);
  const markdown = review.available ? renderTravelEventStagedEffectReviewMarkdown(session, options).markdown : "";
  const html = review.available ? renderTravelEventStagedEffectReviewHtml(session, options).html : "";
  return { ...review, markdown, html, canCopyMarkdown: review.available, canCopyHtml: review.available };
}

function resolveApplicationActor(actorOrId) {
  if (!actorOrId) return null;
  if (typeof actorOrId === "object") return actorOrId;
  return globalThis.game?.actors?.get?.(String(actorOrId)) ?? null;
}

function getEffectApplicationKey(effectRowOrIndex) {
  if (Number.isInteger(Number(effectRowOrIndex))) return { effectIndex: Number(effectRowOrIndex), effectId: "" };
  const row = effectRowOrIndex ?? {};
  const effectId = typeof row.effectId === "string" && row.effectId.length > 0 ? row.effectId : (typeof row.id === "string" ? row.id : "");
  const effectIndex = Number.isInteger(Number(row.index)) ? Number(row.index) : null;
  return { effectIndex, effectId };
}

function findStagedEffect(session, effectRowOrIndex, options = {}) {
  const summarized = summarizeTravelEventRunnerSession(session, options);
  const effects = Array.isArray(summarized.summary?.stagedProposedEffects) ? summarized.summary.stagedProposedEffects : [];
  const key = getEffectApplicationKey(effectRowOrIndex);
  if (key.effectIndex != null && effects[key.effectIndex] !== undefined) return { effect: effects[key.effectIndex], index: key.effectIndex, effectId: key.effectId };
  if (key.effectId) {
    const index = effects.findIndex((effect) => effect?.id === key.effectId || effect?.effectId === key.effectId);
    if (index >= 0) return { effect: effects[index], index, effectId: key.effectId };
  }
  return { effect: null, index: key.effectIndex, effectId: key.effectId };
}

export function getTravelEventAppliedEffectRecords(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return [];
  return cloneData(normalized.session.appliedEffects?.records ?? []);
}

export function isTravelEventEffectApplied(session, effectIdOrIndex, options = {}) {
  const key = getEffectApplicationKey(effectIdOrIndex);
  return getTravelEventAppliedEffectRecords(session, options).some((record) => {
    if (record.undone === true) return false;
    if (key.effectId) return record.effectId === key.effectId;
    return key.effectIndex != null && record.effectIndex === key.effectIndex;
  });
}

export function markTravelEventEffectApplied(session, appliedRecord, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return normalized;
  const nextSession = cloneData(normalized.session);
  const records = Array.isArray(nextSession.appliedEffects?.records) ? nextSession.appliedEffects.records : [];
  nextSession.appliedEffects = { records: [...records, cloneData(appliedRecord)] };
  nextSession.updatedAt = nowIso(options);
  return { ok: true, errors: [], warnings: [], session: nextSession, record: cloneData(appliedRecord) };
}

function buildResourceEffectChanges(actor, effect) {
  const resources = getShipTravelResources(actor);
  const value = Number(effect.value);
  const target = effect.mode === "set" ? value : resources[effect.resource] + value;
  return { [effect.resource]: target - resources[effect.resource] };
}

export function buildTravelEventAppliedEffectRecord(session, actor, effectRow, beforeAfter, options = {}) {
  const effect = effectRow?.raw ?? effectRow?.effect ?? effectRow;
  const index = Number.isInteger(Number(effectRow?.index)) ? Number(effectRow.index) : null;
  const effectId = typeof effect?.id === "string" ? effect.id : (typeof effect?.effectId === "string" ? effect.effectId : "");
  const effectLabel = typeof effect?.label === "string" && effect.label.trim() ? effect.label.trim() : (index == null ? "Staged Effect" : `Staged Effect ${index + 1}`);
  return {
    applicationId: `${session?.key || session?.event?.key || "runner"}-${effectId || (index ?? "effect")}-${nowIso(options).replace(/[^0-9]/g, "")}`,
    effectId,
    effectIndex: index,
    effectLabel,
    effectType: effect?.type ?? "",
    resource: effect?.resource ?? "",
    mode: effect?.mode ?? "",
    value: Number.isFinite(Number(effect?.value)) ? Number(effect.value) : null,
    actorId: actor?.id ?? "",
    actorName: actor?.name ?? "",
    beforeValue: beforeAfter?.before?.[effect?.resource] ?? null,
    afterValue: beforeAfter?.after?.[effect?.resource] ?? null,
    appliedAt: nowIso(options),
    source: "travel-event-runner",
    undone: false
  };
}

export function prepareTravelEventEffectApplicationState(session, actorOrId = null, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return { ...normalized, available: false, reason: normalized.errors?.[0] ?? "Travel Event Runner session is malformed.", rows: [], records: [] };
  if (normalized.session.status !== "completed") return { ok: true, errors: [], warnings: [], session: normalized.session, available: false, reason: "Manual effect application is unavailable until the runner session is completed.", rows: [], records: getTravelEventAppliedEffectRecords(normalized.session, options) };
  const actor = resolveApplicationActor(actorOrId ?? options.actor ?? options.actorId);
  let actorResources = null;
  let actorValid = false;
  const actorWarning = actor ? "" : "Select an Arcflight ship token or actor to apply effects.";
  if (actor) {
    try {
      actorResources = getShipTravelResources(actor);
      actorValid = true;
    } catch (_error) {
      actorValid = false;
    }
  }
  const review = prepareTravelEventStagedEffectReview(normalized.session, { ...options, resources: actorResources });
  const rows = (review.review?.rows ?? []).map((row) => {
    const applied = isTravelEventEffectApplied(normalized.session, row, options);
    const selectable = actorValid && row.type === "resource" && row.status === "ready" && row.supported === true && !applied;
    const status = applied ? "already applied" : (!actorValid && row.type === "resource" && row.status === "ready" ? "no target" : row.status);
    return { ...row, applied, selectable, status, selected: selectable };
  });
  return {
    ok: true,
    errors: [],
    warnings: actorWarning ? [actorWarning] : [],
    session: normalized.session,
    available: true,
    actor,
    targetActorId: actor?.id ?? "",
    targetActorName: actorValid ? actor.name : "",
    hasTarget: actorValid,
    noTargetReason: actorValid ? "" : (actor ? "Selected actor is not an Arcflight ship." : actorWarning),
    rows,
    records: prepareTravelEventAppliedEffectHistoryState(normalized.session, actor, options).records,
    canApply: rows.some((row) => row.selectable)
  };
}

export async function applyTravelEventRunnerResourceEffect(session, actorOrId, effectRowOrIndex, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return { ...normalized, applied: false };
  if (normalized.session.status !== "completed") return { ok: false, errors: ["Manual effect application is unavailable until the runner session is completed."], warnings: [], session: normalized.session, applied: false };
  const actor = resolveApplicationActor(actorOrId);
  if (!actor) return { ok: false, errors: ["Select an Arcflight ship token or actor to apply effects."], warnings: [], session: normalized.session, applied: false };
  try {
    getShipTravelResources(actor);
  } catch (_error) {
    return { ok: false, errors: ["Selected actor is not an Arcflight ship."], warnings: [], session: normalized.session, applied: false };
  }
  const found = findStagedEffect(normalized.session, effectRowOrIndex, options);
  if (!found.effect) return { ok: false, errors: ["Unknown staged effect id/index."], warnings: [], session: normalized.session, applied: false };
  const row = normalizeTravelEventProposedEffectForReview(found.effect, found.index, { ...options, ship: actor });
  if (!(row.type === "resource" && row.status === "ready" && row.supported === true)) return { ok: false, errors: ["Staged effect is not a supported resource effect."], warnings: row.warnings ?? [], session: normalized.session, applied: false };
  if (isTravelEventEffectApplied(normalized.session, row, options)) return { ok: false, errors: [], warnings: [`${row.label} has already been applied for this runner session.`], session: normalized.session, applied: false, blocked: true, reason: "already-applied" };
  const preview = previewShipTravelResourceChange(actor, buildResourceEffectChanges(actor, found.effect));
  const resources = options.dryRun ? preview.after : await updateShipTravelResources(actor, preview.changes, options.resourceOptions ?? {});
  const record = buildTravelEventAppliedEffectRecord(normalized.session, actor, row, { before: preview.before, after: resources }, options);
  const marked = markTravelEventEffectApplied(normalized.session, record, options);
  return { ok: true, errors: [], warnings: preview.warnings ?? [], session: marked.session, applied: true, record, preview, resources };
}

export function isTravelEventAppliedEffectUndoable(session, actorOrId, appliedRecord, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return { undoable: false, status: "not undoable", warning: normalized.errors?.[0] ?? "Runner session is malformed." };
  const record = appliedRecord ?? {};
  if (record.undone === true) return { undoable: false, status: "undone", warning: record.undoneAt ? `Undone at ${record.undoneAt}.` : "Already undone." };
  if (!record.applicationId) return { undoable: false, status: "not undoable", warning: "Applied record is missing an application id." };
  if (!(record.effectType === "resource" && REVIEW_RESOURCE_KEYS.includes(record.resource) && REVIEW_RESOURCE_MODES.includes(record.mode))) return { undoable: false, status: "not undoable", warning: "Applied record is not a reversible resource effect." };
  const actor = resolveApplicationActor(actorOrId ?? record.actorId);
  if (!actor) return { undoable: false, status: "not undoable", warning: "Target ship actor is missing." };
  let resources;
  try {
    resources = getShipTravelResources(actor);
  } catch (_error) {
    return { undoable: false, status: "not undoable", warning: "Target actor is not an Arcflight ship." };
  }
  const currentValue = resources?.[record.resource];
  if (currentValue !== record.afterValue) return { undoable: false, status: "blocked", warning: "Cannot undo because the ship resource has changed since this effect was applied.", actor, currentValue };
  return { undoable: true, status: "applied", warning: "", actor, currentValue, undoAfterValue: record.beforeValue };
}

export function buildTravelEventEffectUndoRecord(session, actor, appliedRecord, beforeAfter, options = {}) {
  return {
    undone: true,
    undoneAt: nowIso(options),
    undoneByUserId: options.userId ?? globalThis.game?.user?.id ?? "",
    undoneByUserName: options.userName ?? globalThis.game?.user?.name ?? "",
    undoBeforeValue: beforeAfter?.before?.[appliedRecord.resource] ?? null,
    undoAfterValue: beforeAfter?.after?.[appliedRecord.resource] ?? null,
    undoReason: typeof options.reason === "string" ? options.reason : ""
  };
}

export function markTravelEventAppliedEffectUndone(session, applicationId, undoRecord, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return normalized;
  const nextSession = cloneData(normalized.session);
  const records = Array.isArray(nextSession.appliedEffects?.records) ? nextSession.appliedEffects.records : [];
  const index = records.findIndex((record) => record.applicationId === applicationId);
  if (index < 0) return { ok: false, errors: ["Applied effect record was not found."], warnings: [], session: normalized.session };
  if (records[index].undone === true) return { ok: false, errors: ["Applied effect record has already been undone."], warnings: [], session: normalized.session };
  records[index] = { ...records[index], ...cloneData(undoRecord) };
  nextSession.appliedEffects = { records };
  nextSession.updatedAt = nowIso(options);
  return { ok: true, errors: [], warnings: [], session: nextSession, record: cloneData(records[index]) };
}

export function prepareTravelEventAppliedEffectHistoryState(session, actorOrId = null, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return { ...normalized, available: false, records: [] };
  const records = getTravelEventAppliedEffectRecords(normalized.session, options).map((record) => {
    const undo = isTravelEventAppliedEffectUndoable(normalized.session, actorOrId ?? record.actorId, record, options);
    return { ...record, status: undo.status, undoable: undo.undoable, undoWarning: undo.warning, currentValue: undo.currentValue ?? null, undoTargetValue: record.beforeValue };
  });
  return { ok: true, errors: [], warnings: [], session: normalized.session, available: true, records };
}

export async function undoTravelEventAppliedEffect(session, actorOrId, applicationIdOrEffectIndex, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return { ...normalized, undone: false };
  const records = getTravelEventAppliedEffectRecords(normalized.session, options);
  const applicationId = String(applicationIdOrEffectIndex ?? "");
  const record = records.find((entry) => entry.applicationId === applicationId || (applicationId && String(entry.effectIndex) === applicationId));
  if (!record) return { ok: false, errors: ["Applied effect record was not found."], warnings: [], session: normalized.session, undone: false };
  const undoable = isTravelEventAppliedEffectUndoable(normalized.session, actorOrId ?? record.actorId, record, options);
  if (!undoable.undoable) return { ok: false, errors: undoable.status === "blocked" ? [] : [undoable.warning], warnings: undoable.status === "blocked" ? [undoable.warning] : [], session: normalized.session, undone: false, blocked: true, reason: undoable.warning };
  const actor = undoable.actor;
  const before = getShipTravelResources(actor);
  const changes = { [record.resource]: record.beforeValue - before[record.resource] };
  const after = options.dryRun ? previewShipTravelResourceChange(actor, changes).after : await updateShipTravelResources(actor, changes, options.resourceOptions ?? {});
  const undoRecord = buildTravelEventEffectUndoRecord(normalized.session, actor, record, { before, after }, options);
  const marked = markTravelEventAppliedEffectUndone(normalized.session, record.applicationId, undoRecord, options);
  return { ok: marked.ok, errors: marked.errors ?? [], warnings: marked.warnings ?? [], session: marked.session, undone: marked.ok, record: marked.record, undoRecord, resources: after };
}

export async function applyTravelEventRunnerSelectedEffects(session, actorOrId, selectedEffectIds = [], options = {}) {
  const selected = Array.isArray(selectedEffectIds) ? selectedEffectIds : [];
  let currentSession = normalizeTravelEventRunnerSession(session, options).session;
  const applied = [];
  const skipped = [];
  const errors = [];
  const warnings = [];
  for (const selection of selected) {
    const result = await applyTravelEventRunnerResourceEffect(currentSession, actorOrId, selection, options);
    if (result.applied) {
      applied.push(result.record);
      currentSession = result.session;
    } else {
      skipped.push(selection);
    }
    errors.push(...(result.errors ?? []));
    warnings.push(...(result.warnings ?? []));
  }
  return { ok: errors.length === 0, errors, warnings, session: currentSession, applied, skipped };
}

export function prepareTravelEventRunnerSummaryReport(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return { ...normalized, available: false, report: null, reason: normalized.errors?.[0] ?? "Travel Event Runner session is malformed." };
  if (normalized.session.status !== "completed") return { ok: true, errors: [], warnings: [], session: normalized.session, available: false, report: null, reason: "Completed summary output is unavailable until the runner session is completed." };
  const summarized = summarizeTravelEventRunnerSession(normalized.session, options);
  if (!summarized.ok || !summarized.summary) return { ...summarized, available: false, report: null, reason: summarized.errors?.[0] ?? "Unable to prepare completed runner summary." };
  const summary = summarized.summary;
  const report = {
    ...cloneData(summary),
    available: true,
    eventName: summary.event.name,
    eventCategory: summary.event.category,
    baseDC: summary.event.baseDC,
    finalOutcomeLabel: summary.suggestedFinalOutcomeLabel,
    finalOutcomeNarrativeText: summary.finalOutcomeText,
    proposedEffectsNotice: "Proposed effects have not been applied.",
    proposedEffectRows: (summary.stagedProposedEffects ?? []).map(formatEffectForReport),
    rounds: summary.rounds.map((round) => ({
      ...round,
      stationRows: Object.entries(round.stationResults ?? {}).map(([stationKey, result]) => ({ stationKey, stationName: humanizeIdentifier(stationKey), result: result ?? "unrecorded", resultLabel: result ? humanizeIdentifier(result) : "Unrecorded" }))
    }))
  };
  return { ok: true, errors: [], warnings: [], session: normalized.session, available: true, report };
}

export function renderTravelEventRunnerSummaryMarkdown(session, options = {}) {
  const prepared = prepareTravelEventRunnerSummaryReport(session, options);
  if (!prepared.available || !prepared.report) return { ...prepared, markdown: "" };
  const r = prepared.report;
  const lines = [
    `# Travel Event Summary — ${r.eventName}`,
    "",
    `- **Event Category:** ${r.eventCategory || "Uncategorized"}`,
    `- **Base DC:** ${r.baseDC}`,
    `- **Started At:** ${r.startedAt || ""}`,
    `- **Completed At:** ${r.completedAt || ""}`,
    `- **Total Score:** ${r.totalScore}`,
    `- **Suggested Final Outcome:** ${humanizeIdentifier(r.suggestedFinalOutcome)}`,
    `- **Final Outcome Label:** ${r.finalOutcomeLabel}`,
    "",
    "## Final Outcome Narrative",
    r.finalOutcomeNarrativeText || "No final outcome narrative text provided.",
    "",
    "## Round-by-Round Station Results"
  ];
  for (const round of r.rounds) {
    lines.push("", `### Round ${round.roundNumber}: ${round.title}`);
    for (const row of round.stationRows) lines.push(`- **${row.stationName}** (${row.stationKey}): ${row.resultLabel}`);
  }
  lines.push("", "## Pending Consequences / Rewards (Read-only Proposed Effects)", `**${r.proposedEffectsNotice}**`);
  if (r.proposedEffectRows.length) for (const effect of r.proposedEffectRows) lines.push("", `### ${effect.label}`, "```json", effect.json, "```");
  else lines.push("", "No proposed effects are attached to the suggested final outcome.");
  return { ...prepared, markdown: lines.join("\n") };
}

export function renderTravelEventRunnerSummaryHtml(session, options = {}) {
  const prepared = prepareTravelEventRunnerSummaryReport(session, options);
  if (!prepared.available || !prepared.report) return { ...prepared, html: "" };
  const r = prepared.report;
  const roundHtml = r.rounds.map((round) => `<h3>Round ${escapeHtml(round.roundNumber)}: ${escapeHtml(round.title)}</h3><ul>${round.stationRows.map((row) => `<li><strong>${escapeHtml(row.stationName)}</strong> (${escapeHtml(row.stationKey)}): ${escapeHtml(row.resultLabel)}</li>`).join("")}</ul>`).join("");
  const effectsHtml = r.proposedEffectRows.length
    ? r.proposedEffectRows.map((effect) => `<h3>${escapeHtml(effect.label)}</h3><pre>${escapeHtml(effect.json)}</pre>`).join("")
    : "<p>No proposed effects are attached to the suggested final outcome.</p>";
  const html = `<section class="arcflight-travel-runner-summary"><h1>Travel Event Summary — ${escapeHtml(r.eventName)}</h1><ul><li><strong>Event Category:</strong> ${escapeHtml(r.eventCategory || "Uncategorized")}</li><li><strong>Base DC:</strong> ${escapeHtml(r.baseDC)}</li><li><strong>Started At:</strong> ${escapeHtml(r.startedAt)}</li><li><strong>Completed At:</strong> ${escapeHtml(r.completedAt)}</li><li><strong>Total Score:</strong> ${escapeHtml(r.totalScore)}</li><li><strong>Suggested Final Outcome:</strong> ${escapeHtml(humanizeIdentifier(r.suggestedFinalOutcome))}</li><li><strong>Final Outcome Label:</strong> ${escapeHtml(r.finalOutcomeLabel)}</li></ul><h2>Final Outcome Narrative</h2><p>${escapeHtml(r.finalOutcomeNarrativeText || "No final outcome narrative text provided.")}</p><h2>Round-by-Round Station Results</h2>${roundHtml}<h2>Pending Consequences / Rewards (Read-only Proposed Effects)</h2><p><strong>${escapeHtml(r.proposedEffectsNotice)}</strong></p>${effectsHtml}</section>`;
  return { ...prepared, html };
}

export function prepareTravelEventRunnerSummaryOutputState(session, options = {}) {
  const report = prepareTravelEventRunnerSummaryReport(session, options);
  const markdown = report.available ? renderTravelEventRunnerSummaryMarkdown(session, options).markdown : "";
  const html = report.available ? renderTravelEventRunnerSummaryHtml(session, options).html : "";
  return { ...report, markdown, html, canCopyMarkdown: report.available, canCopyHtml: report.available, canPostChat: report.available, canCreateJournal: report.available };
}

export async function postTravelEventRunnerSummaryToChat(session, options = {}) {
  const rendered = renderTravelEventRunnerSummaryHtml(session, options);
  if (!rendered.available || !rendered.html) return { ...rendered, created: false, message: null };
  const data = { content: rendered.html };
  if (options.whisper === "gm" || options.gmOnly === true) data.whisper = globalThis.ChatMessage?.getWhisperRecipients?.("GM")?.map((u) => u.id) ?? [];
  if (options.dryRun === true) return { ...rendered, created: false, messageData: data, message: null };
  if (!globalThis.ChatMessage?.create) return { ...rendered, ok: false, errors: ["ChatMessage.create is not available."], created: false, message: null };
  const message = await ChatMessage.create(data);
  return { ...rendered, created: true, message };
}

export async function createTravelEventRunnerSummaryJournalEntry(session, options = {}) {
  const rendered = renderTravelEventRunnerSummaryHtml(session, options);
  if (!rendered.available || !rendered.html) return { ...rendered, created: false, journalEntry: null };
  const title = typeof options.title === "string" && options.title.trim() ? options.title.trim() : `Travel Event Summary — ${rendered.report.eventName}`;
  const data = { name: title, pages: [{ name: "Summary", type: "text", text: { format: 1, content: rendered.html } }] };
  if (options.dryRun === true) return { ...rendered, created: false, journalData: data, journalEntry: null };
  if (!globalThis.JournalEntry?.create) return { ...rendered, ok: false, errors: ["JournalEntry.create is not available."], created: false, journalEntry: null };
  const journalEntry = await JournalEntry.create(data);
  return { ...rendered, created: true, journalEntry };
}

export function completeTravelEventRunnerSession(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  nextSession.status = "completed";
  nextSession.currentRoundIndex = Math.max(nextSession.event.rounds.length - 1, 0);
  nextSession.completedAt = nowIso(options);
  nextSession.updatedAt = nextSession.completedAt;
  const summary = summarizeTravelEventRunnerSession(nextSession, options).summary;
  nextSession.summary = summary;
  return { ok: true, errors: [], warnings: [], session: nextSession, summary };
}

export function exportTravelEventRunnerSessionToJson(session, options = {}) {
  const summaryResult = summarizeTravelEventRunnerSession(session, options);
  if (!summaryResult.ok) return { ...summaryResult, json: "" };
  return { ...summaryResult, json: JSON.stringify(summaryResult.summary, null, 2) };
}

export function loadPublishedTravelEventForRunner(idOrKey, options = {}) {
  const loaded = loadPublishedTravelEventFromLibrary(idOrKey, options);
  if (!loaded.ok || !loaded.event) return { ok: false, errors: loaded.errors ?? ["Published travel event could not be loaded."], warnings: loaded.warnings ?? [], entry: loaded.entry ?? null, event: null };
  return { ok: true, errors: [], warnings: loaded.warnings ?? [], entry: loaded.entry, event: loaded.event };
}

export function getPublishedTravelEventRunnerEntries(options = {}) {
  const library = getPublishedTravelEventLibrary(options);
  return prepareTravelEventRunnerLibraryState({ ...options, library }).entries;
}
