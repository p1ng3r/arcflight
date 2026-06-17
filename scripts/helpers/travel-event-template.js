import { getStation } from "../../data/stations/core-stations.js";
import { ARCFLIGHT_TRAVEL_EVENT_CATEGORIES, ARCFLIGHT_TRAVEL_EVENT_OUTCOMES, ARCFLIGHT_TRAVEL_RESOURCES, ARCFLIGHT_TRAVEL_RESULT_TIERS, ARCFLIGHT_TRAVEL_ROUND_OUTCOMES, ARCFLIGHT_TRAVEL_STATIONS } from "../config/constants.js";
import { validateTravelEventDefinition } from "./travel-events.js";

export const TRAVEL_EVENT_TEMPLATE_VERSION = "0.1.0";

export const TRAVEL_EVENT_PROMPT_DEGREES = Object.freeze([
  ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_SUCCESS,
  ARCFLIGHT_TRAVEL_RESULT_TIERS.SUCCESS,
  ARCFLIGHT_TRAVEL_RESULT_TIERS.FAILURE,
  ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_FAILURE
]);

const TRAVEL_FIVE_STATION_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_STATIONS));
const TRAVEL_RESOURCE_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_RESOURCES));
const ROUND_OUTCOME_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_ROUND_OUTCOMES));
const FINAL_OUTCOME_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_EVENT_OUTCOMES));

const DEFAULT_CATEGORY = ARCFLIGHT_TRAVEL_EVENT_CATEGORIES.DISCOVERY;
const DEFAULT_BASE_DC = 18;

function cloneData(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function uniqueKnownValues(values, knownValues, fallback) {
  const source = Array.isArray(values) ? values : fallback;
  return Array.from(new Set(source.filter((value) => knownValues.includes(value))));
}

function placeholder(label) {
  return `[${label}]`;
}

function createProposedEffectsArray(value) {
  return Array.isArray(value) ? cloneData(value) : [];
}

function createOutcomeBranch(key, options = {}) {
  const branchOptions = options.branches?.[key] ?? {};
  return {
    vignette: branchOptions.vignette ?? placeholder(`${key} outcome branch vignette: describe the fiction change in 2-4 sentences.`),
    proposedEffects: createProposedEffectsArray(branchOptions.proposedEffects),
    ...(branchOptions.nextRoundNotes ? { nextRoundNotes: branchOptions.nextRoundNotes } : {}),
    ...(branchOptions.combatHandoff === true ? { combatHandoff: true } : {}),
    ...(branchOptions.handoffNotes ? { handoffNotes: branchOptions.handoffNotes } : {})
  };
}

function createFinalOutcome(key, options = {}) {
  const finalOptions = options.outcomes?.[key] ?? {};
  return {
    label: finalOptions.label ?? key,
    vignette: finalOptions.vignette ?? placeholder(`${key} final outcome vignette: close the travel event in 3-5 sentences.`),
    proposedEffects: createProposedEffectsArray(finalOptions.proposedEffects),
    rewards: Array.isArray(finalOptions.rewards) ? [...finalOptions.rewards] : [],
    losses: Array.isArray(finalOptions.losses) ? [...finalOptions.losses] : [],
    ...(finalOptions.combatHandoff === true ? { combatHandoff: true } : {}),
    ...(finalOptions.handoffNotes ? { handoffNotes: finalOptions.handoffNotes } : {})
  };
}

export function createBlankRollFeedbackTemplate(options = {}) {
  return {
    [ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_SUCCESS]: options.criticalSuccess ?? placeholder("critical success feedback: one short sentence."),
    [ARCFLIGHT_TRAVEL_RESULT_TIERS.SUCCESS]: options.success ?? placeholder("success feedback: one short sentence."),
    [ARCFLIGHT_TRAVEL_RESULT_TIERS.FAILURE]: options.failure ?? placeholder("failure feedback: one short sentence."),
    [ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_FAILURE]: options.criticalFailure ?? placeholder("critical failure feedback: one short sentence.")
  };
}

export function createBlankStationPromptTemplate(stationKey, options = {}) {
  const station = getStation(stationKey) ?? {};
  return {
    stationKey,
    stationName: options.stationName ?? station.displayName ?? station.name ?? stationKey,
    vignette: options.vignette ?? placeholder(`${stationKey} station vignette: describe what this station faces in 1-2 sentences.`),
    playerAction: options.playerAction ?? placeholder(`${stationKey} player action: explain what players do at this station in 1-2 sentences.`),
    suggestedSkills: Array.isArray(options.suggestedSkills) ? [...options.suggestedSkills] : [...(station.primarySkills ?? [])],
    ...(Number.isFinite(options.dcModifier) ? { dcModifier: options.dcModifier } : {}),
    resourceOptions: Array.isArray(options.resourceOptions) ? [...options.resourceOptions] : [],
    rollFeedback: createBlankRollFeedbackTemplate(options.rollFeedback ?? {})
  };
}

export function createBlankStationCardTemplate(stationKey, options = {}) {
  const prompt = createBlankStationPromptTemplate(stationKey, options);
  return {
    stationKey: prompt.stationKey,
    stationName: prompt.stationName,
    problem: options.problem ?? options.vignette ?? prompt.vignette,
    skillApproaches: Array.isArray(options.skillApproaches)
      ? cloneData(options.skillApproaches)
      : prompt.suggestedSkills.slice(0, 3).map((skill) => ({
        skill,
        label: `${prompt.stationName} ${skill}`,
        helpText: options.playerAction ?? prompt.playerAction
      })),
    rollFeedback: createBlankRollFeedbackTemplate(options.rollFeedback ?? {}),
    hooks: {
      rooms: Array.isArray(options.hooks?.rooms) ? cloneData(options.hooks.rooms) : [],
      shipUpgrades: Array.isArray(options.hooks?.shipUpgrades) ? cloneData(options.hooks.shipUpgrades) : [],
      arkengineMods: Array.isArray(options.hooks?.arkengineMods) ? cloneData(options.hooks.arkengineMods) : [],
      crewAssets: Array.isArray(options.hooks?.crewAssets) ? cloneData(options.hooks.crewAssets) : [],
      factions: Array.isArray(options.hooks?.factions) ? cloneData(options.hooks.factions) : []
    }
  };
}

export function createBlankOutcomeBranchesTemplate(options = {}) {
  return Object.fromEntries(ROUND_OUTCOME_KEYS.map((key) => [key, createOutcomeBranch(key, options)]));
}

export function createBlankFinalOutcomesTemplate(options = {}) {
  return Object.fromEntries(FINAL_OUTCOME_KEYS.map((key) => [key, createFinalOutcome(key, options)]));
}

export function createBlankTravelRoundTemplate(roundNumber, options = {}) {
  const activeStationKeys = uniqueKnownValues(options.travelStations, TRAVEL_FIVE_STATION_KEYS, TRAVEL_FIVE_STATION_KEYS);
  return {
    round: Number.isInteger(roundNumber) && roundNumber > 0 ? roundNumber : 1,
    title: options.title ?? `Round ${Number.isInteger(roundNumber) && roundNumber > 0 ? roundNumber : 1}`,
    openingVignette: options.openingVignette ?? placeholder("round opening vignette: table-ready prose; round 1 is usually 4-6 sentences, later rounds 3-5 sentences."),
    stationCards: activeStationKeys.map((stationKey) => createBlankStationCardTemplate(stationKey, options.stationCards?.[stationKey] ?? options.stationPrompts?.[stationKey] ?? {})),
    activeStations: activeStationKeys.map((stationKey) => createBlankStationPromptTemplate(stationKey, options.stationPrompts?.[stationKey] ?? {})),
    outcomeBranches: createBlankOutcomeBranchesTemplate(options.outcomeBranches ?? {})
  };
}

export function createBlankTravelEventTemplate(options = {}) {
  const roundCount = Number.isInteger(options.roundCount) && options.roundCount > 0 ? options.roundCount : 1;
  const travelStations = uniqueKnownValues(options.travelStations, TRAVEL_FIVE_STATION_KEYS, TRAVEL_FIVE_STATION_KEYS);
  const activeResources = uniqueKnownValues(options.activeResources, TRAVEL_RESOURCE_KEYS, TRAVEL_RESOURCE_KEYS);
  const category = Object.values(ARCFLIGHT_TRAVEL_EVENT_CATEGORIES).includes(options.category) ? options.category : DEFAULT_CATEGORY;

  return {
    key: options.key ?? "new-travel-event",
    name: options.name ?? "New Travel Event",
    category,
    tags: Array.isArray(options.tags) ? [...options.tags] : [],
    roundCount,
    baseDC: Number.isFinite(options.baseDC) ? options.baseDC : DEFAULT_BASE_DC,
    activeResources,
    travelStations,
    openingVignette: options.openingVignette ?? options.description ?? placeholder("event opening vignette: cinematic table-ready setup before round play begins."),
    description: options.description ?? placeholder("event description: 2-4 sentences explaining situation and gameplay feel."),
    gmSummary: options.gmSummary ?? placeholder("GM summary: 2-4 practical sentences explaining how to run the event and its consequences."),
    rounds: Array.from({ length: roundCount }, (_, index) => createBlankTravelRoundTemplate(index + 1, {
      travelStations,
      ...(options.rounds?.[index] ?? options.rounds?.[index + 1] ?? {})
    })),
    finalOutcomes: createBlankFinalOutcomesTemplate(options.finalOutcomes ?? {}),
    rewards: Array.isArray(options.rewards) ? [...options.rewards] : [],
    futureAutomationNotes: options.futureAutomationNotes ?? "Metadata only. Do not include executable code, travel action economy use, automatic combat start, or automatic staged effect application."
  };
}

export function getTravelEventAuthoringGuidelines() {
  return cloneData({
    version: TRAVEL_EVENT_TEMPLATE_VERSION,
    purpose: "Canonical Arcflight travel event authoring shape for future core packs and GM-builder compatibility.",
    tone: ["beautiful", "dangerous", "haunted", "adventurous", "strange", "mythic", "clear enough to run at the table"],
    proseStandards: {
      description: "2-4 sentences; explain situation and gameplay feel.",
      gmSummary: "2-4 practical GM-facing sentences; explain how to run the event and what consequences it creates.",
      roundOneOpeningVignette: "Usually 4-6 sentences; lay setting, mood, stakes, and immediate tension.",
      laterRoundOpeningVignette: "Usually 3-5 sentences; set scene, mood, and immediate danger.",
      stationVignette: "1-2 evocative sentences describing what the station faces.",
      playerAction: "1-2 sentences explaining what the players actually do at that station.",
      rollFeedback: "Four short one-sentence post-roll quips keyed by degree of success.",
      outcomeBranchVignette: "2-4 sentences describing what changes in the fiction before proposed effects.",
      finalOutcomeVignette: "3-5 sentences with a satisfying closing beat."
    },
    boundaries: [
      "Use proposedEffects as staged data only.",
      "Use combatHandoff as metadata only; do not start combat automatically.",
      "Do not include AP/RAP travel use.",
      "Do not include executable code in event data."
    ],
    pf2eDegreeNote: "Arcflight does not implement custom natural 20/natural 1 degree logic for PF2E roll buttons; PF2E handles degree shifts natively when rolling against a DC. Manual result entry remains GM-selected."
  });
}

export function validateTravelEventAuthoringTemplate(event, options = {}) {
  const { requireFinished = false } = options ?? {};
  const validation = validateTravelEventDefinition(event, { strictAuthoring: true });

  if (requireFinished) {
    if (typeof event?.description !== "string" || event.description.trim().length === 0) validation.errors.push("description must be a non-empty string.");
    if (typeof event?.gmSummary !== "string" || event.gmSummary.trim().length === 0) validation.errors.push("gmSummary must be a non-empty string.");
    for (const round of event?.rounds ?? []) {
      if (typeof round.openingVignette !== "string" || round.openingVignette.trim().length === 0) validation.errors.push(`Round ${round.round ?? "?"} openingVignette must be a non-empty string.`);
      for (const prompt of round.activeStations ?? []) {
        if (typeof prompt.vignette !== "string" || prompt.vignette.trim().length === 0) validation.errors.push(`Round ${round.round ?? "?"} ${prompt.stationKey ?? "?"} vignette must be a non-empty string.`);
      }
    }
  }

  validation.ok = validation.errors.length === 0;
  return validation;
}
