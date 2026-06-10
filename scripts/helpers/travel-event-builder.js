import { ARCFLIGHT_TRAVEL_EVENT_CATEGORIES, ARCFLIGHT_TRAVEL_EVENT_OUTCOMES, ARCFLIGHT_TRAVEL_RESOURCES, ARCFLIGHT_TRAVEL_RESULT_TIERS, ARCFLIGHT_TRAVEL_ROUND_OUTCOMES, ARCFLIGHT_TRAVEL_STATIONS } from "../config/constants.js";
import { validateTravelEventDefinition } from "./travel-events.js";
import { createBlankFinalOutcomesTemplate, createBlankOutcomeBranchesTemplate, createBlankRollFeedbackTemplate, createBlankStationPromptTemplate, createBlankTravelEventTemplate, createBlankTravelRoundTemplate } from "./travel-event-template.js";

export const TRAVEL_EVENT_BUILDER_VERSION = "0.1.0";

const BUILDER_METADATA_KEY = "builder";
const TRAVEL_FIVE_STATION_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_STATIONS));
const TRAVEL_RESOURCE_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_RESOURCES));
const TRAVEL_CATEGORY_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_EVENT_CATEGORIES));
const ROUND_OUTCOME_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_ROUND_OUTCOMES));
const FINAL_OUTCOME_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_EVENT_OUTCOMES));
const DEFAULT_CATEGORY = ARCFLIGHT_TRAVEL_EVENT_CATEGORIES.DISCOVERY;
const DEFAULT_BASE_DC = 18;

function cloneData(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function uniqueKnownValues(values, knownValues, fallback = []) {
  const source = Array.isArray(values) ? values : fallback;
  return Array.from(new Set(source.filter((value) => knownValues.includes(value))));
}

function stringValue(value, fallback) {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function integerValue(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function containsFunctionValue(value) {
  if (typeof value === "function") return true;
  if (Array.isArray(value)) return value.some((entry) => containsFunctionValue(entry));
  if (value && typeof value === "object") return Object.values(value).some((entry) => containsFunctionValue(entry));
  return false;
}

function normalizeProposedEffects(value) {
  return Array.isArray(value) ? cloneData(value) : [];
}

function normalizeRollFeedback(value) {
  const source = asObject(value);
  return {
    ...createBlankRollFeedbackTemplate(),
    ...Object.fromEntries(Object.values(ARCFLIGHT_TRAVEL_RESULT_TIERS).map((degree) => [degree, stringValue(source[degree], createBlankRollFeedbackTemplate()[degree])]))
  };
}

function normalizeStationPrompt(value, stationKey) {
  const source = asObject(value);
  const template = createBlankStationPromptTemplate(source.stationKey ?? stationKey);
  return {
    ...template,
    stationKey: stringValue(source.stationKey, stationKey),
    stationName: stringValue(source.stationName, template.stationName),
    vignette: stringValue(source.vignette, template.vignette),
    playerAction: stringValue(source.playerAction, template.playerAction),
    suggestedSkills: Array.isArray(source.suggestedSkills) ? cloneData(source.suggestedSkills) : template.suggestedSkills,
    ...(Number.isFinite(source.dcModifier) ? { dcModifier: source.dcModifier } : {}),
    resourceOptions: Array.isArray(source.resourceOptions) ? cloneData(source.resourceOptions) : [],
    rollFeedback: normalizeRollFeedback(source.rollFeedback)
  };
}

export function createTravelBuilderResourceEffect(options = {}) {
  return {
    type: "resource",
    resource: TRAVEL_RESOURCE_KEYS.includes(options.resource) ? options.resource : ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES,
    delta: Number.isFinite(options.delta) ? options.delta : 0,
    label: stringValue(options.label, "Proposed resource effect"),
    notes: stringValue(options.notes, "Staged data only; not automatically applied.")
  };
}

export function createTravelBuilderStationPrompt(stationKey, options = {}) {
  return normalizeStationPrompt({ ...options, stationKey }, stationKey);
}

export function createTravelBuilderOutcomeBranch(outcomeKey, options = {}) {
  return {
    vignette: stringValue(options.vignette, `[${outcomeKey} outcome branch vignette: describe the fiction change in 2-4 sentences.]`),
    proposedEffects: normalizeProposedEffects(options.proposedEffects),
    ...(options.nextRoundNotes ? { nextRoundNotes: options.nextRoundNotes } : {}),
    ...(options.combatHandoff === true ? { combatHandoff: true } : {}),
    ...(options.handoffNotes ? { handoffNotes: options.handoffNotes } : {})
  };
}

export function createTravelBuilderFinalOutcome(outcomeKey, options = {}) {
  return {
    label: stringValue(options.label, outcomeKey),
    vignette: stringValue(options.vignette, `[${outcomeKey} final outcome vignette: close the travel event in 3-5 sentences.]`),
    proposedEffects: normalizeProposedEffects(options.proposedEffects),
    rewards: Array.isArray(options.rewards) ? cloneData(options.rewards) : [],
    losses: Array.isArray(options.losses) ? cloneData(options.losses) : [],
    ...(options.combatHandoff === true ? { combatHandoff: true } : {}),
    ...(options.handoffNotes ? { handoffNotes: options.handoffNotes } : {})
  };
}

export function createTravelBuilderRound(roundNumber, options = {}) {
  const round = createBlankTravelRoundTemplate(roundNumber, options);
  return normalizeRound({ ...round, ...options, round: roundNumber }, roundNumber, options.travelStations);
}

function normalizeOutcomeBranches(value) {
  const source = asObject(value);
  return Object.fromEntries(ROUND_OUTCOME_KEYS.map((key) => [key, createTravelBuilderOutcomeBranch(key, source[key] ?? source.branches?.[key] ?? {})]));
}

function normalizeFinalOutcomes(value) {
  const source = asObject(value);
  return Object.fromEntries(FINAL_OUTCOME_KEYS.map((key) => [key, createTravelBuilderFinalOutcome(key, source[key] ?? source.outcomes?.[key] ?? {})]));
}

function normalizeRound(value, fallbackRound, travelStations) {
  const source = asObject(value);
  const roundNumber = integerValue(source.round, fallbackRound);
  const stationKeys = uniqueKnownValues(source.activeStations?.map((station) => station?.stationKey), TRAVEL_FIVE_STATION_KEYS, travelStations);
  const activeStations = stationKeys.map((stationKey) => normalizeStationPrompt(source.activeStations?.find((station) => station?.stationKey === stationKey), stationKey));
  return {
    round: roundNumber,
    title: stringValue(source.title, `Round ${roundNumber}`),
    openingVignette: stringValue(source.openingVignette, "[round opening vignette: table-ready prose; round 1 is usually 4-6 sentences, later rounds 3-5 sentences.]"),
    activeStations,
    outcomeBranches: normalizeOutcomeBranches(source.outcomeBranches)
  };
}

export function createTravelEventDraft(options = {}) {
  const source = asObject(options);
  const roundCount = integerValue(source.roundCount, 1);
  const travelStations = uniqueKnownValues(source.travelStations, TRAVEL_FIVE_STATION_KEYS, TRAVEL_FIVE_STATION_KEYS);
  const activeResources = uniqueKnownValues(source.activeResources, TRAVEL_RESOURCE_KEYS, TRAVEL_RESOURCE_KEYS);
  const category = TRAVEL_CATEGORY_KEYS.includes(source.category) ? source.category : DEFAULT_CATEGORY;
  const template = createBlankTravelEventTemplate({ ...source, roundCount, travelStations, activeResources, category });

  return normalizeTravelEventDraft({
    ...template,
    ...source,
    roundCount,
    travelStations,
    activeResources,
    category,
    [BUILDER_METADATA_KEY]: {
      version: TRAVEL_EVENT_BUILDER_VERSION,
      status: "draft",
      source: "builder",
      ...(asObject(source[BUILDER_METADATA_KEY]))
    }
  });
}

export function normalizeTravelEventDraft(draft) {
  const source = asObject(draft);
  const roundCount = integerValue(source.roundCount, 1);
  const travelStations = uniqueKnownValues(source.travelStations, TRAVEL_FIVE_STATION_KEYS, TRAVEL_FIVE_STATION_KEYS);
  const activeResources = uniqueKnownValues(source.activeResources, TRAVEL_RESOURCE_KEYS, TRAVEL_RESOURCE_KEYS);
  const category = TRAVEL_CATEGORY_KEYS.includes(source.category) ? source.category : DEFAULT_CATEGORY;
  const rounds = Array.from({ length: roundCount }, (_, index) => normalizeRound(source.rounds?.[index] ?? source.rounds?.find?.((round) => round?.round === index + 1) ?? {}, index + 1, travelStations));

  return {
    key: stringValue(source.key, "new-travel-event"),
    name: stringValue(source.name, "New Travel Event"),
    category,
    tags: Array.isArray(source.tags) ? cloneData(source.tags) : [],
    roundCount,
    baseDC: numberValue(source.baseDC, DEFAULT_BASE_DC),
    activeResources,
    travelStations,
    description: stringValue(source.description, "[event description: 2-4 sentences explaining situation and gameplay feel.]"),
    gmSummary: stringValue(source.gmSummary, "[GM summary: 2-4 practical sentences explaining how to run the event and its consequences.]"),
    rounds,
    finalOutcomes: normalizeFinalOutcomes(source.finalOutcomes),
    rewards: Array.isArray(source.rewards) ? cloneData(source.rewards) : [],
    futureAutomationNotes: stringValue(source.futureAutomationNotes, "Metadata only. Do not include executable code, travel action economy use, automatic combat start, or automatic staged effect application."),
    [BUILDER_METADATA_KEY]: {
      version: TRAVEL_EVENT_BUILDER_VERSION,
      status: "draft",
      source: "builder",
      ...asObject(source[BUILDER_METADATA_KEY])
    }
  };
}

export function validateTravelEventDraft(draft, options = {}) {
  const errors = [];
  const warnings = [];
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return { ok: false, errors: ["Travel event draft is missing or not an object."], warnings };
  if (containsFunctionValue(draft)) errors.push("Travel event draft must be data only and cannot contain functions.");
  const validation = validateTravelEventDefinition(draft, { strictAuthoring: true, ...(options.validationOptions ?? {}) });
  errors.push(...validation.errors);
  warnings.push(...validation.warnings);
  return { ok: errors.length === 0, errors, warnings };
}

export function finalizeTravelEventDraft(draft, options = {}) {
  const normalized = normalizeTravelEventDraft(draft);
  const validation = validateTravelEventDraft(normalized, options);
  if (!validation.ok) return { ok: false, errors: cloneData(validation.errors), warnings: cloneData(validation.warnings), event: null, draft: normalized, validation };
  const event = cloneData(normalized);
  delete event[BUILDER_METADATA_KEY];
  return { ok: true, errors: [], warnings: cloneData(validation.warnings), event, draft: normalized, validation };
}

export function cloneTravelEventToDraft(event, options = {}) {
  return normalizeTravelEventDraft({ ...cloneData(event), [BUILDER_METADATA_KEY]: { version: TRAVEL_EVENT_BUILDER_VERSION, status: "draft", source: options.source ?? "event" } });
}

export function prepareTravelEventBuilderPreview(draft) {
  const normalized = normalizeTravelEventDraft(draft);
  const validation = validateTravelEventDraft(normalized);
  return Object.freeze({
    key: normalized.key,
    name: normalized.name,
    category: normalized.category,
    roundCount: normalized.roundCount,
    stationCount: normalized.travelStations.length,
    resourceCount: normalized.activeResources.length,
    validation,
    finalizable: validation.ok,
    errorCount: validation.errors.length,
    warningCount: validation.warnings.length
  });
}
