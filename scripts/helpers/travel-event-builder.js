import { getStation } from "../../data/stations/core-stations.js";
import { ARCFLIGHT_TRAVEL_EVENT_CATEGORIES, ARCFLIGHT_TRAVEL_EVENT_OUTCOMES, ARCFLIGHT_TRAVEL_RESOURCES, ARCFLIGHT_TRAVEL_ROUND_OUTCOMES, ARCFLIGHT_TRAVEL_STATIONS } from "../config/constants.js";
import { createBlankFinalOutcomesTemplate, createBlankOutcomeBranchesTemplate, createBlankStationPromptTemplate, createBlankTravelEventTemplate, createBlankTravelRoundTemplate } from "./travel-event-template.js";
import { validateTravelEventDefinition } from "./travel-events.js";

export const TRAVEL_EVENT_BUILDER_VERSION = "0.1.0";

const DEFAULT_ROUND_COUNT = 4;
const DEFAULT_BASE_DC = 18;
const DEFAULT_CATEGORY = ARCFLIGHT_TRAVEL_EVENT_CATEGORIES.DISCOVERY;

const TRAVEL_FIVE_STATION_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_STATIONS));
const TRAVEL_RESOURCE_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_RESOURCES));
const CATEGORY_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_EVENT_CATEGORIES));
const ROUND_OUTCOME_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_ROUND_OUTCOMES));
const FINAL_OUTCOME_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_EVENT_OUTCOMES));
const RESOURCE_EFFECT_MODES = Object.freeze(["add", "set"]);

const CATEGORY_LABELS = Object.freeze({
  environmental: "Environmental",
  navigation: "Navigation",
  threat: "Threat",
  social: "Social",
  shipboard: "Shipboard",
  discovery: "Discovery",
  occult: "Occult"
});

const RESOURCE_LABELS = Object.freeze({
  hull: "Hull",
  lifeveil: "Lifeveil",
  strain: "Strain",
  morale: "Morale",
  supplies: "Supplies",
  storedSpellRanks: "Stored Spell Ranks"
});

function cloneData(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch (_error) {
      // Fall through to JSON cloning so validation helpers can report data-only
      // failures instead of throwing on function-bearing draft objects.
    }
  }
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach((child) => deepFreeze(child));
  return value;
}

function nowIso(options = {}) {
  if (typeof options.now === "string" && options.now.length > 0) return options.now;
  if (options.now instanceof Date) return options.now.toISOString();
  return new Date().toISOString();
}

function uniqueKnownValues(values, knownValues, fallback = []) {
  const source = Array.isArray(values) ? values : fallback;
  return Array.from(new Set(source.filter((value) => knownValues.includes(value))));
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}

function normalizeBaseDC(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : DEFAULT_BASE_DC;
}

function normalizeRoundCount(value, fallback) {
  const number = Number(value);
  if (Number.isInteger(number) && number > 0) return number;
  return Number.isInteger(fallback) && fallback > 0 ? fallback : DEFAULT_ROUND_COUNT;
}

function createBuilderMetadata(existingBuilder = {}, options = {}) {
  const timestamp = nowIso(options);
  return {
    version: existingBuilder.version ?? TRAVEL_EVENT_BUILDER_VERSION,
    status: existingBuilder.status ?? "draft",
    createdAt: existingBuilder.createdAt ?? timestamp,
    updatedAt: options.preserveUpdatedAt ? (existingBuilder.updatedAt ?? timestamp) : timestamp,
    source: existingBuilder.source ?? "builder"
  };
}

function normalizeFutureAutomationNotes(value) {
  if (Array.isArray(value)) return value.filter((entry) => typeof entry === "string");
  if (typeof value === "string" && value.trim().length > 0) return [value];
  return [];
}

function assertOptionsObject(options, helperName) {
  if (options == null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError(`${helperName} options must be an object.`);
  }
}

function stripBuilderMetadata(event) {
  const cloned = cloneData(event);
  if (cloned && typeof cloned === "object") delete cloned.builder;
  return cloned;
}

function labelForStation(stationKey) {
  const station = getStation(stationKey) ?? {};
  return station.displayName ?? station.name ?? stationKey;
}

function labelList(values, labels) {
  if (!Array.isArray(values) || values.length === 0) return "None";
  return values.map((value) => labels[value] ?? labelForStation(value)).join(", ");
}

function hasFunctionValue(value) {
  if (typeof value === "function") return true;
  if (Array.isArray(value)) return value.some((entry) => hasFunctionValue(entry));
  if (value && typeof value === "object") return Object.values(value).some((entry) => hasFunctionValue(entry));
  return false;
}

function containsAutomationReference(value) {
  if (typeof value === "string") return /\b(?:spend(?:ing)?\s+(?:AP|RAP)|automatic(?:ally)?\s+(?:start|starts|apply|applies)|start\s+combat|combat\s+start)\b/i.test(value);
  if (Array.isArray(value)) return value.some((entry) => containsAutomationReference(entry));
  if (value && typeof value === "object") return Object.values(value).some((entry) => containsAutomationReference(entry));
  return false;
}

function normalizeOutcomeBranches(value) {
  const defaults = createBlankOutcomeBranchesTemplate();
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(ROUND_OUTCOME_KEYS.map((key) => [key, { ...cloneData(defaults[key]), ...(cloneData(source[key]) ?? {}) }]));
}

function normalizeFinalOutcomes(value) {
  const defaults = createBlankFinalOutcomesTemplate();
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(FINAL_OUTCOME_KEYS.map((key) => [key, { ...cloneData(defaults[key]), ...(cloneData(source[key]) ?? {}) }]));
}

function normalizeRound(round, index, travelStations) {
  const source = round && typeof round === "object" && !Array.isArray(round) ? cloneData(round) : {};
  const template = createBlankTravelRoundTemplate(index + 1, { travelStations });
  const activeStations = Array.isArray(source.activeStations)
    ? source.activeStations.map((prompt) => cloneData(prompt)).filter((prompt) => prompt && typeof prompt === "object")
    : template.activeStations;

  return {
    ...template,
    ...source,
    round: Number.isInteger(source.round) && source.round > 0 ? source.round : index + 1,
    activeStations,
    outcomeBranches: normalizeOutcomeBranches(source.outcomeBranches)
  };
}

export function createTravelBuilderStationPrompt(stationKey, options = {}) {
  assertOptionsObject(options, "createTravelBuilderStationPrompt");
  const resolvedStationKey = TRAVEL_FIVE_STATION_KEYS.includes(stationKey) ? stationKey : ARCFLIGHT_TRAVEL_STATIONS.NAVIGATOR;
  const prompt = createBlankStationPromptTemplate(resolvedStationKey, options);
  if (resolvedStationKey !== stationKey) prompt.warnings = [`Unknown Travel Five station "${stationKey}"; using navigator.`];
  return prompt;
}

export function createTravelBuilderOutcomeBranch(options = {}) {
  assertOptionsObject(options, "createTravelBuilderOutcomeBranch");
  return {
    vignette: options.vignette ?? "[outcome branch vignette: describe what changes before any staged effects.]",
    proposedEffects: Array.isArray(options.proposedEffects) ? cloneData(options.proposedEffects) : [],
    ...(options.nextRoundNotes ? { nextRoundNotes: options.nextRoundNotes } : {}),
    ...(options.combatHandoff === true ? { combatHandoff: true } : {}),
    ...(options.handoffNotes ? { handoffNotes: options.handoffNotes } : {})
  };
}

export function createTravelBuilderFinalOutcome(options = {}) {
  assertOptionsObject(options, "createTravelBuilderFinalOutcome");
  return {
    label: options.label ?? "Final Outcome",
    vignette: options.vignette ?? "[final outcome vignette: close the travel event in table-ready prose.]",
    proposedEffects: Array.isArray(options.proposedEffects) ? cloneData(options.proposedEffects) : [],
    rewards: Array.isArray(options.rewards) ? cloneData(options.rewards) : [],
    losses: Array.isArray(options.losses) ? cloneData(options.losses) : [],
    ...(options.combatHandoff === true ? { combatHandoff: true } : {}),
    ...(options.handoffNotes ? { handoffNotes: options.handoffNotes } : {})
  };
}

export function createTravelBuilderRound(options = {}) {
  assertOptionsObject(options, "createTravelBuilderRound");
  const roundNumber = Number.isInteger(options.round) && options.round > 0 ? options.round : 1;
  const travelStations = uniqueKnownValues(options.travelStations, TRAVEL_FIVE_STATION_KEYS, TRAVEL_FIVE_STATION_KEYS);
  return createBlankTravelRoundTemplate(roundNumber, { ...options, travelStations });
}

export function createTravelBuilderResourceEffect(options = {}) {
  assertOptionsObject(options, "createTravelBuilderResourceEffect");
  const warnings = [];
  const resource = TRAVEL_RESOURCE_KEYS.includes(options.resource) ? options.resource : ARCFLIGHT_TRAVEL_RESOURCES.HULL;
  const mode = RESOURCE_EFFECT_MODES.includes(options.mode) ? options.mode : "add";
  const value = Number.isFinite(Number(options.value)) ? Number(options.value) : 0;

  if (resource !== options.resource) warnings.push(`Unknown travel resource "${options.resource ?? "<missing>"}"; using hull.`);
  if (mode !== options.mode) warnings.push(`Unknown resource effect mode "${options.mode ?? "<missing>"}"; using add.`);
  if (!Number.isFinite(Number(options.value))) warnings.push(`Resource effect value "${options.value ?? "<missing>"}" is not numeric; using 0.`);

  const effect = {
    type: "resource",
    resource,
    mode,
    value,
    label: options.label ?? `${RESOURCE_LABELS[resource] ?? resource} ${mode} ${value}`
  };

  if (warnings.length > 0) effect.warnings = warnings;
  return effect;
}

export function createTravelEventDraft(options = {}) {
  assertOptionsObject(options, "createTravelEventDraft");
  const roundCount = normalizeRoundCount(options.roundCount);
  const draft = createBlankTravelEventTemplate({
    ...options,
    roundCount,
    baseDC: normalizeBaseDC(options.baseDC),
    category: CATEGORY_KEYS.includes(options.category) ? options.category : DEFAULT_CATEGORY,
    travelStations: uniqueKnownValues(options.travelStations, TRAVEL_FIVE_STATION_KEYS, TRAVEL_FIVE_STATION_KEYS)
  });

  return normalizeTravelEventDraft({
    ...draft,
    futureAutomationNotes: normalizeFutureAutomationNotes(options.futureAutomationNotes),
    builder: createBuilderMetadata({}, options)
  }, { ...options, preserveUpdatedAt: true });
}

export function normalizeTravelEventDraft(draft, options = {}) {
  assertOptionsObject(options, "normalizeTravelEventDraft");
  const source = draft && typeof draft === "object" && !Array.isArray(draft) ? cloneData(draft) : {};
  const travelStations = uniqueKnownValues(source.travelStations, TRAVEL_FIVE_STATION_KEYS, TRAVEL_FIVE_STATION_KEYS);
  const sourceRounds = Array.isArray(source.rounds) ? source.rounds : [];
  const roundCount = normalizeRoundCount(source.roundCount, sourceRounds.length || DEFAULT_ROUND_COUNT);
  const rounds = Array.from({ length: roundCount }, (_, index) => normalizeRound(sourceRounds[index], index, travelStations));
  const category = CATEGORY_KEYS.includes(source.category) ? source.category : DEFAULT_CATEGORY;

  return {
    ...source,
    key: typeof source.key === "string" ? source.key : "",
    name: typeof source.name === "string" ? source.name : "",
    category,
    tags: normalizeStringArray(source.tags),
    roundCount: rounds.length,
    baseDC: normalizeBaseDC(source.baseDC),
    activeResources: uniqueKnownValues(source.activeResources, TRAVEL_RESOURCE_KEYS, TRAVEL_RESOURCE_KEYS),
    travelStations,
    rounds,
    finalOutcomes: normalizeFinalOutcomes(source.finalOutcomes),
    rewards: Array.isArray(source.rewards) ? cloneData(source.rewards) : [],
    futureAutomationNotes: normalizeFutureAutomationNotes(source.futureAutomationNotes),
    builder: createBuilderMetadata(source.builder, options)
  };
}

export function validateTravelEventDraft(draft, options = {}) {
  assertOptionsObject(options, "validateTravelEventDraft");
  const normalizedDraft = normalizeTravelEventDraft(draft, options);
  const validation = validateTravelEventDefinition(normalizedDraft, { ...options, strictAuthoring: true });
  const errors = [...validation.errors];
  const warnings = [...validation.warnings];

  if (normalizedDraft.key.trim().length === 0) errors.push("Builder draft key must be a non-empty string.");
  if (normalizedDraft.name.trim().length === 0) errors.push("Builder draft name must be a non-empty string.");
  if (hasFunctionValue(draft)) errors.push("Builder draft must be data only and cannot contain functions.");
  if (containsAutomationReference(normalizedDraft)) warnings.push("Builder draft references automation language; keep event definitions staged and GM-applied only.");

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    normalizedDraft
  };
}

export function finalizeTravelEventDraft(draft, options = {}) {
  assertOptionsObject(options, "finalizeTravelEventDraft");
  const validation = validateTravelEventDraft(draft, options);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      warnings: validation.warnings,
      event: null
    };
  }

  const event = stripBuilderMetadata(validation.normalizedDraft);
  return {
    ok: true,
    errors: [],
    warnings: validation.warnings,
    event
  };
}

export function cloneTravelEventToDraft(eventDefinition, options = {}) {
  assertOptionsObject(options, "cloneTravelEventToDraft");
  const source = eventDefinition && typeof eventDefinition === "object" && !Array.isArray(eventDefinition) ? cloneData(eventDefinition) : {};
  return normalizeTravelEventDraft({
    ...source,
    builder: createBuilderMetadata({}, options)
  }, { ...options, preserveUpdatedAt: true });
}

export function prepareTravelEventBuilderPreview(draft, options = {}) {
  assertOptionsObject(options, "prepareTravelEventBuilderPreview");
  const validation = validateTravelEventDraft(draft, options);
  const normalizedDraft = validation.normalizedDraft;
  const summary = {
    key: normalizedDraft.key,
    name: normalizedDraft.name,
    categoryLabel: CATEGORY_LABELS[normalizedDraft.category] ?? normalizedDraft.category,
    baseDC: normalizedDraft.baseDC,
    roundCount: normalizedDraft.roundCount,
    activeResourcesLabel: labelList(normalizedDraft.activeResources, RESOURCE_LABELS),
    travelStationsLabel: labelList(normalizedDraft.travelStations, {}),
    validation: {
      ok: validation.ok,
      errors: cloneData(validation.errors),
      warnings: cloneData(validation.warnings)
    },
    rounds: normalizedDraft.rounds.map((round) => ({
      round: round.round,
      title: round.title,
      activeStationCount: round.activeStations?.length ?? 0,
      activeStationsLabel: labelList((round.activeStations ?? []).map((prompt) => prompt.stationKey), {}),
      outcomeBranches: ROUND_OUTCOME_KEYS.map((key) => ({
        key,
        hasVignette: typeof round.outcomeBranches?.[key]?.vignette === "string" && round.outcomeBranches[key].vignette.trim().length > 0,
        proposedEffectCount: round.outcomeBranches?.[key]?.proposedEffects?.length ?? 0
      }))
    })),
    finalOutcomes: FINAL_OUTCOME_KEYS.map((key) => ({
      key,
      label: normalizedDraft.finalOutcomes?.[key]?.label ?? key,
      hasVignette: typeof normalizedDraft.finalOutcomes?.[key]?.vignette === "string" && normalizedDraft.finalOutcomes[key].vignette.trim().length > 0,
      proposedEffectCount: normalizedDraft.finalOutcomes?.[key]?.proposedEffects?.length ?? 0,
      rewardCount: normalizedDraft.finalOutcomes?.[key]?.rewards?.length ?? 0,
      lossCount: normalizedDraft.finalOutcomes?.[key]?.losses?.length ?? 0
    }))
  };

  return deepFreeze(summary);
}
