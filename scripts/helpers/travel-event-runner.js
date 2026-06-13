import { getStation } from "../../data/stations/core-stations.js";
import { ARCFLIGHT_MODULE_ID, ARCFLIGHT_TRAVEL_STATIONS } from "../config/constants.js";
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
    summary: session.summary && typeof session.summary === "object" ? cloneData(session.summary) : null
  };
  return { ok: errors.length === 0, errors, warnings: [], session: normalized };
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
