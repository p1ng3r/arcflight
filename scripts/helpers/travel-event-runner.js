import { getStation } from "../../data/stations/core-stations.js";
import { ARCFLIGHT_TRAVEL_STATIONS } from "../config/constants.js";
import { getPublishedTravelEventLibrary, loadPublishedTravelEventFromLibrary, preparePublishedTravelEventLibraryState } from "./travel-event-builder.js";
import { validateTravelEventDefinition } from "./travel-events.js";

export const TRAVEL_EVENT_RUNNER_SESSION_VERSION = 1;
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

function nowIso(options = {}) {
  if (typeof options.now === "string" && options.now.length > 0) return options.now;
  if (options.now instanceof Date) return options.now.toISOString();
  return new Date().toISOString();
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

export function prepareTravelEventRunnerState(session = null, options = {}) {
  const libraryState = prepareTravelEventRunnerLibraryState(options);
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
