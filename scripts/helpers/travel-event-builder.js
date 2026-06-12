import { getStation } from "../../data/stations/core-stations.js";
import { ARCFLIGHT_TRAVEL_EVENT_CATEGORIES, ARCFLIGHT_TRAVEL_EVENT_OUTCOMES, ARCFLIGHT_TRAVEL_RESOURCES, ARCFLIGHT_TRAVEL_ROUND_OUTCOMES, ARCFLIGHT_TRAVEL_STATIONS, ARCFLIGHT_TRAVEL_TAGS } from "../config/constants.js";
import { createBlankOutcomeBranchesTemplate, createBlankStationPromptTemplate, createBlankTravelEventTemplate, createBlankTravelRoundTemplate } from "./travel-event-template.js";
import { validateTravelEventDefinition } from "./travel-events.js";

export const TRAVEL_EVENT_BUILDER_VERSION = "0.1.0";

const DEFAULT_ROUND_COUNT = 4;
const DEFAULT_BASE_DC = 18;
const DEFAULT_CATEGORY = ARCFLIGHT_TRAVEL_EVENT_CATEGORIES.DISCOVERY;

const TRAVEL_FIVE_STATION_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_STATIONS));
const TRAVEL_RESOURCE_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_RESOURCES));
const TRAVEL_TAG_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_TAGS));
const CATEGORY_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_EVENT_CATEGORIES));
const ROUND_OUTCOME_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_ROUND_OUTCOMES));
const LEGACY_FINAL_OUTCOME_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_EVENT_OUTCOMES));
const FINAL_OUTCOME_KEYS = Object.freeze(["criticalSuccess", "success", "mixed", "failure", "criticalFailure"]);
const RESOURCE_EFFECT_MODES = Object.freeze(["add", "set"]);

const LEGACY_TO_CANONICAL_FINAL_OUTCOME_KEYS = Object.freeze({
  majorVictory: "criticalSuccess",
  victory: "success",
  costlySuccess: "mixed",
  failure: "failure",
  catastrophicFailure: "criticalFailure"
});

const CANONICAL_TO_LEGACY_FINAL_OUTCOME_KEYS = Object.freeze(Object.fromEntries(Object.entries(LEGACY_TO_CANONICAL_FINAL_OUTCOME_KEYS).map(([legacy, canonical]) => [canonical, legacy])));

const FINAL_OUTCOME_LABELS = Object.freeze({
  criticalSuccess: "Critical Success",
  success: "Success",
  mixed: "Mixed",
  failure: "Failure",
  criticalFailure: "Critical Failure"
});

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

function createOption(value, label, selected = false) {
  return { value, label, selected };
}

function createCheckboxOption(value, label, selectedValues = []) {
  return { value, label, checked: selectedValues.includes(value) };
}

function coerceFormString(value, fallback = "") {
  if (Array.isArray(value)) return coerceFormString(value[0], fallback);
  return typeof value === "string" ? value : fallback;
}

function coerceFormStringArray(value) {
  if (Array.isArray(value)) return value.filter((entry) => typeof entry === "string");
  if (typeof value === "string") return value.length > 0 ? [value] : [];
  return [];
}

function splitTagText(value) {
  return coerceFormString(value)
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
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

function createDefaultFinalOutcomeForKey(key) {
  return createTravelBuilderFinalOutcome({
    label: FINAL_OUTCOME_LABELS[key] ?? key,
    vignette: `[${key} final outcome vignette: close the travel event in 3-5 sentences.]`
  });
}

function normalizeFinalOutcomeEntry(key, sourceEntry) {
  const source = sourceEntry && typeof sourceEntry === "object" && !Array.isArray(sourceEntry) ? cloneData(sourceEntry) : {};
  return {
    ...createDefaultFinalOutcomeForKey(key),
    ...source,
    label: typeof source.label === "string" ? source.label : (typeof source.title === "string" ? source.title : (FINAL_OUTCOME_LABELS[key] ?? key)),
    vignette: typeof source.vignette === "string" ? source.vignette : (typeof source.narrative === "string" ? source.narrative : (typeof source.result === "string" ? source.result : createDefaultFinalOutcomeForKey(key).vignette)),
    proposedEffects: Array.isArray(source.proposedEffects) ? cloneData(source.proposedEffects) : [],
    rewards: Array.isArray(source.rewards) ? cloneData(source.rewards).filter((entry) => typeof entry === "string") : [],
    losses: Array.isArray(source.losses) ? cloneData(source.losses).filter((entry) => typeof entry === "string") : []
  };
}

function normalizeFinalOutcomes(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(FINAL_OUTCOME_KEYS.map((key) => [key, normalizeFinalOutcomeEntry(key, source[key] ?? source[CANONICAL_TO_LEGACY_FINAL_OUTCOME_KEYS[key]])]));
}

function collectMalformedFinalOutcomeErrors(draft) {
  const finalOutcomes = draft?.finalOutcomes;
  if (finalOutcomes == null) return [];
  if (typeof finalOutcomes !== "object" || Array.isArray(finalOutcomes)) return ["finalOutcomes must be an object."];

  return FINAL_OUTCOME_KEYS.flatMap((key) => {
    const outcome = finalOutcomes[key];
    if (outcome == null) return [];
    if (typeof outcome !== "object" || Array.isArray(outcome)) return [`Final outcome ${key} must be an object.`];
    const errors = [];
    if (Object.hasOwn(outcome, "proposedEffects") && !Array.isArray(outcome.proposedEffects)) errors.push(`Final outcome ${key} proposedEffects must be an array when present.`);
    if (Object.hasOwn(outcome, "rewards") && !Array.isArray(outcome.rewards)) errors.push(`Final outcome ${key} rewards must be an array when present.`);
    if (Object.hasOwn(outcome, "losses") && !Array.isArray(outcome.losses)) errors.push(`Final outcome ${key} losses must be an array when present.`);
    return errors;
  });
}

function createReadOnlyEffectSummaries(outcome = {}) {
  const proposedEffects = Array.isArray(outcome.proposedEffects) ? outcome.proposedEffects : [];
  return proposedEffects.map((effect, index) => {
    const type = typeof effect?.type === "string" && effect.type.length > 0 ? effect.type : "data";
    const label = typeof effect?.label === "string" && effect.label.length > 0 ? effect.label : `${type} effect ${index + 1}`;
    return {
      index,
      label,
      type,
      summary: stringifyCompactData(effect)
    };
  });
}

function isEditableFinalOutcomeResourceEffect(effect) {
  return isPlainObject(effect) &&
    effect.type === "resource" &&
    TRAVEL_RESOURCE_KEYS.includes(effect.resource) &&
    RESOURCE_EFFECT_MODES.includes(effect.mode) &&
    Number.isFinite(Number(effect.value));
}

function createFinalOutcomeResourceEffectEditorEntry(effect, index) {
  const value = Number(effect.value);
  return {
    index,
    displayIndex: index + 1,
    label: typeof effect.label === "string" ? effect.label : "",
    resource: effect.resource,
    mode: effect.mode,
    value,
    valueText: String(value),
    resourceOptions: TRAVEL_RESOURCE_KEYS.map((key) => createOption(key, RESOURCE_LABELS[key] ?? key, effect.resource === key)),
    modeOptions: RESOURCE_EFFECT_MODES.map((mode) => createOption(mode, mode, effect.mode === mode))
  };
}

function createBlankFinalOutcomeResourceEffectEditorEntry() {
  const defaultResource = ARCFLIGHT_TRAVEL_RESOURCES.HULL;
  const defaultMode = "add";
  return {
    resource: defaultResource,
    mode: defaultMode,
    value: 0,
    valueText: "0",
    label: "",
    resourceOptions: TRAVEL_RESOURCE_KEYS.map((key) => createOption(key, RESOURCE_LABELS[key] ?? key, key === defaultResource)),
    modeOptions: RESOURCE_EFFECT_MODES.map((mode) => createOption(mode, mode, mode === defaultMode))
  };
}

function normalizeEffectEditorEntries(formData = {}) {
  if (Array.isArray(formData.outcomes)) {
    return formData.outcomes.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
  }

  const entries = new Map();
  for (const [key, value] of Object.entries(formData)) {
    const match = key.match(/^finalOutcomes\.([^.]+)\.effects(?:\.(\d+)\.(resource|mode|value|label|remove)|\.add\.(enabled|resource|mode|value|label))$/);
    if (!match || !FINAL_OUTCOME_KEYS.includes(match[1])) continue;
    const outcomeKey = match[1];
    const entry = entries.get(outcomeKey) ?? { key: outcomeKey, effects: [], addEffect: {} };
    if (match[2] != null) {
      const index = Number(match[2]);
      if (!Number.isInteger(index) || index < 0) continue;
      const effectEntry = entry.effects.find((candidate) => candidate.index === index) ?? { index };
      effectEntry[match[3]] = value;
      if (!entry.effects.includes(effectEntry)) entry.effects.push(effectEntry);
    } else {
      entry.addEffect[match[4]] = value;
    }
    entries.set(outcomeKey, entry);
  }

  return Array.from(entries.values());
}

function coerceEffectEditorBoolean(value) {
  if (Array.isArray(value)) return value.some((entry) => coerceEffectEditorBoolean(entry));
  return value === true || value === "true" || value === "on" || value === "1" || value === 1;
}

function createValidResourceEffectFromEditor(entry) {
  const resource = coerceFormString(entry?.resource);
  const mode = coerceFormString(entry?.mode);
  const rawValue = entry?.value;
  const value = Number(Array.isArray(rawValue) ? rawValue[0] : rawValue);
  if (!TRAVEL_RESOURCE_KEYS.includes(resource) || !RESOURCE_EFFECT_MODES.includes(mode) || !Number.isFinite(value)) return null;
  return {
    type: "resource",
    resource,
    mode,
    value,
    label: coerceFormString(entry?.label, "")
  };
}

function stringifyCompactData(value) {
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return "<unserializable data>";
  }
}

function joinTextArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string").join("\n") : "";
}

function splitTextLines(value) {
  return coerceFormString(value)
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
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

function createRoundStationPromptForEditor(stationKey, existingPrompt = {}, promptFormData = {}) {
  const basePrompt = createTravelBuilderStationPrompt(stationKey);
  const sourcePrompt = existingPrompt && typeof existingPrompt === "object" && !Array.isArray(existingPrompt) ? cloneData(existingPrompt) : {};
  const nextPrompt = {
    ...basePrompt,
    ...sourcePrompt,
    stationKey,
    stationName: sourcePrompt.stationName ?? basePrompt.stationName
  };

  if (Object.hasOwn(promptFormData, "playerAction")) {
    nextPrompt.playerAction = coerceFormString(promptFormData.playerAction, nextPrompt.playerAction ?? "");
  }

  return nextPrompt;
}

function normalizeRoundEditorEntries(formData = {}) {
  if (Array.isArray(formData.rounds)) {
    return formData.rounds.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
  }

  const entries = new Map();
  for (const [key, value] of Object.entries(formData)) {
    const match = key.match(/^rounds\.(\d+)\.(openingVignette|activeStations|stationPrompts\.[^.]+\.playerAction)$/);
    if (!match) continue;

    const roundNumber = Number(match[1]);
    if (!Number.isInteger(roundNumber) || roundNumber <= 0) continue;

    const entry = entries.get(roundNumber) ?? { round: roundNumber, stationPrompts: {} };
    const field = match[2];
    if (field === "openingVignette") entry.openingVignette = value;
    else if (field === "activeStations") entry.activeStations = value;
    else {
      const stationKey = field.split(".")[1];
      entry.stationPrompts[stationKey] = { ...(entry.stationPrompts[stationKey] ?? {}), playerAction: value };
    }
    entries.set(roundNumber, entry);
  }

  return Array.from(entries.values());
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

export function prepareTravelEventBuilderFormOptions(draft, options = {}) {
  assertOptionsObject(options, "prepareTravelEventBuilderFormOptions");
  const normalizedDraft = normalizeTravelEventDraft(draft ?? createTravelEventDraft(), options);

  return deepFreeze({
    categories: CATEGORY_KEYS.map((key) => createOption(key, CATEGORY_LABELS[key] ?? key, normalizedDraft.category === key)),
    activeResources: TRAVEL_RESOURCE_KEYS.map((key) => createCheckboxOption(key, RESOURCE_LABELS[key] ?? key, normalizedDraft.activeResources)),
    travelStations: TRAVEL_FIVE_STATION_KEYS.map((key) => createCheckboxOption(key, labelForStation(key), normalizedDraft.travelStations)),
    suggestedTags: TRAVEL_TAG_KEYS.map((key) => createCheckboxOption(key, key, normalizedDraft.tags)),
    tagsText: normalizedDraft.tags.join(", "),
    hasDescription: Object.hasOwn(normalizedDraft, "description"),
    hasGmSummary: Object.hasOwn(normalizedDraft, "gmSummary")
  });
}

export function prepareTravelEventBuilderRoundEditorState(draft, options = {}) {
  assertOptionsObject(options, "prepareTravelEventBuilderRoundEditorState");
  const normalizedDraft = normalizeTravelEventDraft(draft ?? createTravelEventDraft(), options);
  const allowedStations = uniqueKnownValues(normalizedDraft.travelStations, TRAVEL_FIVE_STATION_KEYS, TRAVEL_FIVE_STATION_KEYS);

  return deepFreeze({
    allowedStations: allowedStations.map((stationKey) => ({
      key: stationKey,
      value: stationKey,
      label: labelForStation(stationKey)
    })),
    rounds: normalizedDraft.rounds.map((round) => {
      const activeStationKeys = (Array.isArray(round.activeStations) ? round.activeStations : [])
        .map((prompt) => prompt?.stationKey)
        .filter((stationKey) => allowedStations.includes(stationKey));
      const uniqueActiveStationKeys = Array.from(new Set(activeStationKeys));
      const promptsByStation = new Map((Array.isArray(round.activeStations) ? round.activeStations : [])
        .filter((prompt) => prompt && typeof prompt === "object" && allowedStations.includes(prompt.stationKey))
        .map((prompt) => [prompt.stationKey, prompt]));

      return {
        round: round.round,
        title: round.title,
        openingVignette: typeof round.openingVignette === "string" ? round.openingVignette : "",
        activeStationsLabel: labelList(uniqueActiveStationKeys, {}),
        stationOptions: allowedStations.map((stationKey) => createCheckboxOption(stationKey, labelForStation(stationKey), uniqueActiveStationKeys)),
        stationPrompts: uniqueActiveStationKeys.map((stationKey) => {
          const prompt = promptsByStation.get(stationKey) ?? createTravelBuilderStationPrompt(stationKey);
          return {
            stationKey,
            stationName: prompt.stationName ?? labelForStation(stationKey),
            playerAction: typeof prompt.playerAction === "string" ? prompt.playerAction : ""
          };
        }),
        outcomeBranches: ROUND_OUTCOME_KEYS.map((key) => {
          const branch = round.outcomeBranches?.[key] ?? {};
          return {
            key,
            label: key,
            vignette: typeof branch.vignette === "string" ? branch.vignette : "",
            proposedEffectCount: Array.isArray(branch.proposedEffects) ? branch.proposedEffects.length : 0,
            hasCombatHandoff: branch.combatHandoff === true,
            nextRoundNotes: typeof branch.nextRoundNotes === "string" ? branch.nextRoundNotes : "",
            handoffNotes: typeof branch.handoffNotes === "string" ? branch.handoffNotes : ""
          };
        })
      };
    })
  });
}

export function prepareTravelEventBuilderFinalOutcomeEffectEditorState(draft, options = {}) {
  assertOptionsObject(options, "prepareTravelEventBuilderFinalOutcomeEffectEditorState");
  const normalizedDraft = normalizeTravelEventDraft(draft ?? createTravelEventDraft(), options);

  return deepFreeze({
    resourceOptions: TRAVEL_RESOURCE_KEYS.map((key) => createOption(key, RESOURCE_LABELS[key] ?? key, false)),
    modeOptions: RESOURCE_EFFECT_MODES.map((mode) => createOption(mode, mode, false)),
    outcomes: FINAL_OUTCOME_KEYS.map((key) => {
      const outcome = normalizedDraft.finalOutcomes?.[key] ?? createDefaultFinalOutcomeForKey(key);
      const proposedEffects = Array.isArray(outcome.proposedEffects) ? outcome.proposedEffects : [];
      const resourceEffects = [];
      const readOnlyEffectSummaries = [];
      proposedEffects.forEach((effect, index) => {
        if (isEditableFinalOutcomeResourceEffect(effect)) resourceEffects.push(createFinalOutcomeResourceEffectEditorEntry(effect, index));
        else {
          const [summary] = createReadOnlyEffectSummaries({ proposedEffects: [effect] });
          readOnlyEffectSummaries.push({ ...summary, index });
        }
      });

      return {
        key,
        label: FINAL_OUTCOME_LABELS[key] ?? key,
        proposedEffectCount: proposedEffects.length,
        resourceEffectCount: resourceEffects.length,
        readOnlyEffectCount: readOnlyEffectSummaries.length,
        resourceEffects,
        readOnlyEffectSummaries,
        hasResourceEffects: resourceEffects.length > 0,
        hasReadOnlyEffects: readOnlyEffectSummaries.length > 0,
        addEffect: createBlankFinalOutcomeResourceEffectEditorEntry()
      };
    })
  });
}

export function prepareTravelEventBuilderFinalOutcomeEditorState(draft, options = {}) {
  assertOptionsObject(options, "prepareTravelEventBuilderFinalOutcomeEditorState");
  const normalizedDraft = normalizeTravelEventDraft(draft ?? createTravelEventDraft(), options);
  const effectEditor = prepareTravelEventBuilderFinalOutcomeEffectEditorState(normalizedDraft, options);
  const effectsByOutcome = new Map(effectEditor.outcomes.map((outcome) => [outcome.key, outcome]));

  return deepFreeze({
    outcomes: FINAL_OUTCOME_KEYS.map((key) => {
      const outcome = normalizedDraft.finalOutcomes?.[key] ?? createDefaultFinalOutcomeForKey(key);
      const effectSummaries = createReadOnlyEffectSummaries(outcome);
      const effectState = effectsByOutcome.get(key);
      return {
        key,
        label: FINAL_OUTCOME_LABELS[key] ?? key,
        title: typeof outcome.label === "string" ? outcome.label : (FINAL_OUTCOME_LABELS[key] ?? key),
        narrative: typeof outcome.vignette === "string" ? outcome.vignette : "",
        rewardsText: joinTextArray(outcome.rewards),
        consequencesText: joinTextArray(outcome.losses),
        proposedEffectCount: effectSummaries.length,
        effectSummaries,
        hasProposedEffects: effectSummaries.length > 0,
        resourceEffects: effectState?.resourceEffects ?? [],
        hasResourceEffects: effectState?.hasResourceEffects === true,
        readOnlyEffectSummaries: effectState?.readOnlyEffectSummaries ?? [],
        hasReadOnlyEffects: effectState?.hasReadOnlyEffects === true,
        addEffect: effectState?.addEffect ?? createBlankFinalOutcomeResourceEffectEditorEntry(),
        hasCombatHandoff: outcome.combatHandoff === true,
        handoffNotes: typeof outcome.handoffNotes === "string" ? outcome.handoffNotes : ""
      };
    })
  });
}

function normalizeFinalOutcomeEditorEntries(formData = {}) {
  if (Array.isArray(formData.outcomes)) {
    return formData.outcomes.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
  }

  const entries = new Map();
  for (const [key, value] of Object.entries(formData)) {
    const match = key.match(/^finalOutcomes\.([^.]+)\.(label|title|vignette|narrative|result|rewardsText|rewardText|lossesText|consequencesText|consequenceText)$/);
    if (!match || !FINAL_OUTCOME_KEYS.includes(match[1])) continue;
    const outcomeKey = match[1];
    const entry = entries.get(outcomeKey) ?? { key: outcomeKey };
    entry[match[2]] = value;
    entries.set(outcomeKey, entry);
  }

  return Array.from(entries.values());
}

export function applyTravelEventBuilderFinalOutcomeFormDataToDraft(draft, formData = {}, options = {}) {
  assertOptionsObject(options, "applyTravelEventBuilderFinalOutcomeFormDataToDraft");
  assertOptionsObject(formData, "applyTravelEventBuilderFinalOutcomeFormDataToDraft formData");
  const source = normalizeTravelEventDraft(draft ?? createTravelEventDraft(), options);
  const entries = normalizeFinalOutcomeEditorEntries(formData);
  if (entries.length === 0) return source;

  const finalOutcomes = cloneData(source.finalOutcomes);
  for (const entry of entries) {
    const key = entry.key;
    if (!FINAL_OUTCOME_KEYS.includes(key)) continue;
    const outcome = normalizeFinalOutcomeEntry(key, finalOutcomes[key]);
    const nextOutcome = { ...outcome };

    if (Object.hasOwn(entry, "label")) nextOutcome.label = coerceFormString(entry.label, outcome.label ?? "");
    else if (Object.hasOwn(entry, "title")) nextOutcome.label = coerceFormString(entry.title, outcome.label ?? "");

    if (Object.hasOwn(entry, "vignette")) nextOutcome.vignette = coerceFormString(entry.vignette, outcome.vignette ?? "");
    else if (Object.hasOwn(entry, "narrative")) nextOutcome.vignette = coerceFormString(entry.narrative, outcome.vignette ?? "");
    else if (Object.hasOwn(entry, "result")) nextOutcome.vignette = coerceFormString(entry.result, outcome.vignette ?? "");

    if (Object.hasOwn(entry, "rewardsText")) nextOutcome.rewards = splitTextLines(entry.rewardsText);
    else if (Object.hasOwn(entry, "rewardText")) nextOutcome.rewards = splitTextLines(entry.rewardText);

    if (Object.hasOwn(entry, "lossesText")) nextOutcome.losses = splitTextLines(entry.lossesText);
    else if (Object.hasOwn(entry, "consequencesText")) nextOutcome.losses = splitTextLines(entry.consequencesText);
    else if (Object.hasOwn(entry, "consequenceText")) nextOutcome.losses = splitTextLines(entry.consequenceText);

    finalOutcomes[key] = nextOutcome;
  }

  return normalizeTravelEventDraft({
    ...source,
    finalOutcomes
  }, options);
}

export function applyTravelEventBuilderFinalOutcomeEffectFormDataToDraft(draft, formData = {}, options = {}) {
  assertOptionsObject(options, "applyTravelEventBuilderFinalOutcomeEffectFormDataToDraft");
  assertOptionsObject(formData, "applyTravelEventBuilderFinalOutcomeEffectFormDataToDraft formData");
  const source = normalizeTravelEventDraft(draft ?? createTravelEventDraft(), options);
  const entries = normalizeEffectEditorEntries(formData);
  if (entries.length === 0) return source;

  const finalOutcomes = cloneData(source.finalOutcomes);
  for (const entry of entries) {
    const key = entry.key;
    if (!FINAL_OUTCOME_KEYS.includes(key)) continue;
    const outcome = normalizeFinalOutcomeEntry(key, finalOutcomes[key]);
    const effects = Array.isArray(outcome.proposedEffects) ? cloneData(outcome.proposedEffects) : [];
    const editsByIndex = new Map((Array.isArray(entry.effects) ? entry.effects : [])
      .filter((effectEntry) => Number.isInteger(Number(effectEntry.index)) && Number(effectEntry.index) >= 0)
      .map((effectEntry) => [Number(effectEntry.index), effectEntry]));

    const nextEffects = effects.flatMap((effect, index) => {
      const edit = editsByIndex.get(index);
      if (!edit || !isEditableFinalOutcomeResourceEffect(effect)) return [effect];
      if (coerceEffectEditorBoolean(edit.remove)) return [];
      const editedEffect = createValidResourceEffectFromEditor({
        resource: Object.hasOwn(edit, "resource") ? edit.resource : effect.resource,
        mode: Object.hasOwn(edit, "mode") ? edit.mode : effect.mode,
        value: Object.hasOwn(edit, "value") ? edit.value : effect.value,
        label: Object.hasOwn(edit, "label") ? edit.label : effect.label
      });
      return [editedEffect ?? effect];
    });

    if (coerceEffectEditorBoolean(entry.addEffect?.enabled)) {
      const addedEffect = createValidResourceEffectFromEditor(entry.addEffect);
      if (addedEffect) nextEffects.push(addedEffect);
    }

    finalOutcomes[key] = {
      ...outcome,
      proposedEffects: nextEffects
    };
  }

  return normalizeTravelEventDraft({
    ...source,
    finalOutcomes
  }, options);
}

export function applyTravelEventBuilderRoundFormDataToDraft(draft, formData = {}, options = {}) {
  assertOptionsObject(options, "applyTravelEventBuilderRoundFormDataToDraft");
  assertOptionsObject(formData, "applyTravelEventBuilderRoundFormDataToDraft formData");
  const source = normalizeTravelEventDraft(draft ?? createTravelEventDraft(), options);
  const allowedStations = uniqueKnownValues(source.travelStations, TRAVEL_FIVE_STATION_KEYS, TRAVEL_FIVE_STATION_KEYS);
  const entries = normalizeRoundEditorEntries(formData);
  if (entries.length === 0) return source;

  const entriesByRound = new Map(entries.map((entry) => [Number(entry.round), entry]));
  const rounds = source.rounds.map((round) => {
    const entry = entriesByRound.get(round.round);
    if (!entry) return round;

    const existingPrompts = new Map((Array.isArray(round.activeStations) ? round.activeStations : [])
      .filter((prompt) => prompt && typeof prompt === "object" && allowedStations.includes(prompt.stationKey))
      .map((prompt) => [prompt.stationKey, prompt]));
    const requestedActiveStations = Object.hasOwn(entry, "activeStations")
      ? uniqueKnownValues(coerceFormStringArray(entry.activeStations), allowedStations, [])
      : Array.from(existingPrompts.keys());
    const stationPromptFormData = entry.stationPrompts && typeof entry.stationPrompts === "object" && !Array.isArray(entry.stationPrompts) ? entry.stationPrompts : {};

    return {
      ...round,
      openingVignette: Object.hasOwn(entry, "openingVignette") ? coerceFormString(entry.openingVignette, round.openingVignette ?? "") : round.openingVignette,
      activeStations: requestedActiveStations.map((stationKey) => createRoundStationPromptForEditor(stationKey, existingPrompts.get(stationKey), stationPromptFormData[stationKey] ?? {}))
    };
  });

  return normalizeTravelEventDraft({
    ...source,
    rounds
  }, options);
}

export function applyTravelEventBuilderFormDataToDraft(draft, formData = {}, options = {}) {
  assertOptionsObject(options, "applyTravelEventBuilderFormDataToDraft");
  assertOptionsObject(formData, "applyTravelEventBuilderFormDataToDraft formData");
  const source = normalizeTravelEventDraft(draft ?? createTravelEventDraft(), options);
  const nextDraft = {
    ...source,
    key: coerceFormString(formData.key, source.key),
    name: coerceFormString(formData.name, source.name),
    category: coerceFormString(formData.category, source.category),
    baseDC: coerceFormString(formData.baseDC, String(source.baseDC)),
    roundCount: coerceFormString(formData.roundCount, String(source.roundCount)),
    tags: Object.hasOwn(formData, "tags") ? splitTagText(formData.tags) : source.tags,
    activeResources: Object.hasOwn(formData, "activeResources") ? coerceFormStringArray(formData.activeResources) : source.activeResources,
    travelStations: Object.hasOwn(formData, "travelStations") ? coerceFormStringArray(formData.travelStations) : source.travelStations
  };

  if (Object.hasOwn(source, "description") || Object.hasOwn(formData, "description")) {
    nextDraft.description = coerceFormString(formData.description, source.description ?? "");
  }

  if (Object.hasOwn(source, "gmSummary") || Object.hasOwn(formData, "gmSummary")) {
    nextDraft.gmSummary = coerceFormString(formData.gmSummary, source.gmSummary ?? "");
  }

  return normalizeTravelEventDraft(nextDraft, options);
}


function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function trimmedText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function countWords(value) {
  const text = trimmedText(value);
  return text.length > 0 ? text.split(/\s+/).filter(Boolean).length : 0;
}

function isPlaceholderText(value) {
  const text = trimmedText(value);
  if (text.length === 0) return false;
  return /^\[[^\]]+\]$/.test(text)
    || /\b(?:placeholder|todo|tbd|lorem ipsum|fill this|replace this|describe how|table-ready prose|opening vignette|final outcome vignette|outcome branch vignette)\b/i.test(text);
}

function addQualityIssue(collection, area, message, path = "", details = {}) {
  collection.push({ area, message, path, ...details });
}

function createChecklistItem(label, passed, severity = "suggestion", message = "") {
  return { label, passed: Boolean(passed), severity, message };
}

function collectTextEntries(value, path = "root", entries = []) {
  if (typeof value === "string") entries.push({ path, text: value });
  else if (Array.isArray(value)) value.forEach((entry, index) => collectTextEntries(entry, `${path}[${index}]`, entries));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, entry]) => collectTextEntries(entry, `${path}.${key}`, entries));
  return entries;
}

function collectUnsupportedShapeIssues(value, path = "root", issues = []) {
  if (typeof value === "function") issues.push(`${path} contains a function value.`);
  else if (Array.isArray(value)) value.forEach((entry, index) => collectUnsupportedShapeIssues(entry, `${path}[${index}]`, issues));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, entry]) => collectUnsupportedShapeIssues(entry, `${path}.${key}`, issues));
  return issues;
}

const QUALITY_LEAKAGE_PATTERNS = Object.freeze([
  { key: "apRap", severity: "error", label: "AP/RAP spending", pattern: /\b(?:spend(?:ing)?\s+)?(?:AP|RAP|action points?|reaction action points?)\b/i },
  { key: "shipCombat", severity: "warning", label: "ship combat automation", pattern: /\b(?:ship\s+combat|combat\s+automation|automate\s+combat|roll\s+initiative|create\s+combatants?)\b/i },
  { key: "automaticCombatStart", severity: "error", label: "automatic combat start", pattern: /\b(?:automatically|auto)\s+(?:start|create|launch|begin)\s+(?:combat|encounter|initiative)\b|\bstart\s+(?:combat|encounter|initiative)\s+automatically\b/i },
  { key: "actorMutation", severity: "error", label: "actor mutation", pattern: /\b(?:actor\.(?:update|create|delete)|Actor\.(?:create|update|delete)|mutate\s+(?:the\s+)?actor|update\s+(?:the\s+)?actor)\b/i },
  { key: "persistence", severity: "error", label: "compendium/world setting writes", pattern: /\b(?:game\.settings\.set|world\s+setting\s+writes?|compendium\s+writes?|CompendiumCollection|pack\.(?:set|update|create)|save\s+to\s+(?:world|compendium))\b/i },
  { key: "stagedEffectApplication", severity: "error", label: "direct staged-effect application language", pattern: /\b(?:apply|applies|applied|applying)\s+(?:the\s+)?(?:staged\s+)?effects?\b|\bapplyTravelStagedEffects?\b/i },
  { key: "oceanOnly", severity: "warning", label: "ocean-only sailing language", pattern: /\b(?:ocean|seas|seawater|saltwater|brine|briny|underwater|submerged|harbor|harbour|tide|tidal)\b/i }
]);

function collectBoundaryLeakageIssues(draft) {
  const issues = [];
  for (const { path, text } of collectTextEntries(draft)) {
    for (const leakage of QUALITY_LEAKAGE_PATTERNS) {
      if (leakage.pattern.test(text)) {
        issues.push({ ...leakage, path, message: `${path} appears to include ${leakage.label}; keep builder data local-only, data-only, and voidsailing-oriented.` });
      }
    }
  }
  return issues;
}

function checkFinalOutcomeResourceEffects(sourceFinalOutcomes, normalizedDraft, warnings) {
  if (!isPlainObject(sourceFinalOutcomes)) return;
  for (const key of FINAL_OUTCOME_KEYS) {
    const outcome = sourceFinalOutcomes[key] ?? sourceFinalOutcomes[CANONICAL_TO_LEGACY_FINAL_OUTCOME_KEYS[key]];
    if (!isPlainObject(outcome) || !Array.isArray(outcome.proposedEffects)) continue;
    outcome.proposedEffects.forEach((effect, index) => {
      if (!isPlainObject(effect)) {
        addQualityIssue(warnings, "finalOutcomes", `Final outcome ${key} staged resource effect ${index + 1} is malformed.`, `finalOutcomes.${key}.proposedEffects[${index}]`);
        return;
      }
      if (effect.type === "resource" || Object.hasOwn(effect, "resource") || Object.hasOwn(effect, "mode") || Object.hasOwn(effect, "value")) {
        if (!TRAVEL_RESOURCE_KEYS.includes(effect.resource)) addQualityIssue(warnings, "finalOutcomes", `Final outcome ${key} resource effect ${index + 1} references unknown resource "${effect.resource ?? "<missing>"}".`, `finalOutcomes.${key}.proposedEffects[${index}].resource`);
        if (!RESOURCE_EFFECT_MODES.includes(effect.mode)) addQualityIssue(warnings, "finalOutcomes", `Final outcome ${key} resource effect ${index + 1} references unknown mode "${effect.mode ?? "<missing>"}".`, `finalOutcomes.${key}.proposedEffects[${index}].mode`);
        if (!Number.isFinite(Number(effect.value))) addQualityIssue(warnings, "finalOutcomes", `Final outcome ${key} resource effect ${index + 1} has non-numeric value "${effect.value ?? "<missing>"}".`, `finalOutcomes.${key}.proposedEffects[${index}].value`);
        const activeResources = Array.isArray(normalizedDraft.activeResources) ? normalizedDraft.activeResources : [];
        if (TRAVEL_RESOURCE_KEYS.includes(effect.resource) && !activeResources.includes(effect.resource)) addQualityIssue(warnings, "finalOutcomes", `Final outcome ${key} resource effect ${index + 1} targets inactive resource "${effect.resource}".`, `finalOutcomes.${key}.proposedEffects[${index}].resource`);
      }
    });
  }
}

function summarizeQualitySeverity(errors, warnings, suggestions) {
  const score = Math.max(0, 100 - (errors.length * 20) - (warnings.length * 8) - (suggestions.length * 2));
  const readiness = errors.length > 0 ? "Blocked" : (warnings.length > 0 ? "Needs Attention" : "Ready to Export");
  return { score, errorCount: errors.length, warningCount: warnings.length, suggestionCount: suggestions.length, readiness };
}


export function analyzeTravelEventBuilderQuality(draft, options = {}) {
  assertOptionsObject(options, "analyzeTravelEventBuilderQuality");
  const errors = [];
  const warnings = [];
  const suggestions = [];
  const checklist = {
    topLevel: [],
    rounds: [],
    finalOutcomes: [],
    boundaries: [],
    builderReadiness: []
  };

  if (!isPlainObject(draft)) {
    addQualityIssue(errors, "builderReadiness", "Travel event quality check requires a plain object draft.", "root");
    const summary = summarizeQualitySeverity(errors, warnings, suggestions);
    return deepFreeze({ ok: false, ready: false, ...summary, errors, warnings, suggestions, checklist });
  }

  const source = draft;
  const normalizedDraft = normalizeTravelEventDraft(source, options);
  const validation = validateTravelEventDraft(source, options);
  for (const validationError of validation.errors) addQualityIssue(errors, "builderReadiness", validationError, "validation");
  for (const validationWarning of validation.warnings) {
    if (validationWarning === "Travel event is not registered in CORE_TRAVEL_EVENTS.") continue;
    addQualityIssue(warnings, "builderReadiness", validationWarning, "validation");
  }

  const unsupportedShapeIssues = collectUnsupportedShapeIssues(source);
  for (const issue of unsupportedShapeIssues) addQualityIssue(errors, "builderReadiness", `Unsupported data shape: ${issue}`, "root");

  const sourceRoundCount = Number(source.roundCount);
  const sourceRounds = Array.isArray(source.rounds) ? source.rounds : [];
  const topLevelChecks = [
    createChecklistItem("Event key is present", trimmedText(source.key).length > 0, "error", "Add a stable event key before final export."),
    createChecklistItem("Event name is present", trimmedText(source.name).length > 0, "error", "Add a table-facing event name."),
    createChecklistItem("Category is known", CATEGORY_KEYS.includes(source.category), "error", "Choose one of the canonical Arcflight travel event categories."),
    createChecklistItem("Base DC is a reasonable number", Number.isFinite(Number(source.baseDC)) && Number(source.baseDC) > 0, "error", "Set a positive numeric base DC."),
    createChecklistItem("Round count matches round array", Number.isInteger(sourceRoundCount) && sourceRoundCount === sourceRounds.length, "warning", "Keep roundCount in sync with authored rounds."),
    createChecklistItem("At least one active travel resource", Array.isArray(source.activeResources) && source.activeResources.some((resource) => TRAVEL_RESOURCE_KEYS.includes(resource)), "error", "Select at least one active travel resource."),
    createChecklistItem("At least one Travel Five station", Array.isArray(source.travelStations) && source.travelStations.some((station) => TRAVEL_FIVE_STATION_KEYS.includes(station)), "error", "Select at least one Travel Five station.")
  ];
  checklist.topLevel.push(...topLevelChecks);
  for (const item of topLevelChecks.filter((entry) => !entry.passed)) {
    addQualityIssue(item.severity === "error" ? errors : warnings, "topLevel", item.message, "topLevel");
  }
  if (source.category != null && !CATEGORY_KEYS.includes(source.category)) addQualityIssue(errors, "topLevel", `Unknown category "${source.category}".`, "category");
  if (Array.isArray(source.activeResources)) {
    source.activeResources.filter((resource) => !TRAVEL_RESOURCE_KEYS.includes(resource)).forEach((resource) => addQualityIssue(warnings, "topLevel", `Unknown active resource "${resource}" will be ignored by normalization.`, "activeResources"));
  }
  if (Array.isArray(source.travelStations)) {
    source.travelStations.filter((station) => !TRAVEL_FIVE_STATION_KEYS.includes(station)).forEach((station) => addQualityIssue(warnings, "topLevel", `Unknown travel station "${station}" will be ignored by normalization.`, "travelStations"));
  }

  const actionCounts = new Map();
  normalizedDraft.rounds.forEach((round, index) => {
    const roundPath = `rounds[${index}]`;
    const openingVignette = trimmedText(round.openingVignette);
    const activeStations = Array.isArray(round.activeStations) ? round.activeStations : [];
    const roundChecks = [
      createChecklistItem(`Round ${round.round} has an opening vignette`, openingVignette.length > 0, "warning", `Round ${round.round} needs an opening vignette.`),
      createChecklistItem(`Round ${round.round} opening vignette is specific`, openingVignette.length > 0 && !isPlaceholderText(openingVignette), "suggestion", `Round ${round.round} opening vignette still looks placeholder/generic.`),
      createChecklistItem(`Round ${round.round} has active stations`, activeStations.length > 0, "warning", `Round ${round.round} has no active stations.`)
    ];
    checklist.rounds.push(...roundChecks);
    if (!roundChecks[0].passed) addQualityIssue(warnings, "rounds", roundChecks[0].message, `${roundPath}.openingVignette`);
    else if (!roundChecks[1].passed) addQualityIssue(suggestions, "rounds", roundChecks[1].message, `${roundPath}.openingVignette`);
    if (!roundChecks[2].passed) addQualityIssue(warnings, "rounds", roundChecks[2].message, `${roundPath}.activeStations`);

    activeStations.forEach((prompt, promptIndex) => {
      const promptPath = `${roundPath}.activeStations[${promptIndex}]`;
      if (!isPlainObject(prompt)) {
        addQualityIssue(warnings, "rounds", `Round ${round.round} station prompt ${promptIndex + 1} is malformed.`, promptPath);
        return;
      }
      if (!TRAVEL_FIVE_STATION_KEYS.includes(prompt.stationKey)) addQualityIssue(warnings, "rounds", `Round ${round.round} station prompt uses unknown station "${prompt.stationKey ?? "<missing>"}".`, `${promptPath}.stationKey`);
      if (!normalizedDraft.travelStations.includes(prompt.stationKey)) addQualityIssue(warnings, "rounds", `Round ${round.round} station prompt references station "${prompt.stationKey}" that is not active at the event level.`, `${promptPath}.stationKey`);
      const playerAction = trimmedText(prompt.playerAction);
      if (playerAction.length === 0) addQualityIssue(warnings, "rounds", `Round ${round.round} ${labelForStation(prompt.stationKey)} prompt has no playerAction.`, `${promptPath}.playerAction`);
      else {
        if (countWords(playerAction) < 6) addQualityIssue(suggestions, "rounds", `Round ${round.round} ${labelForStation(prompt.stationKey)} playerAction is short; add clearer table-facing instruction.`, `${promptPath}.playerAction`);
        const normalizedAction = playerAction.toLowerCase().replace(/\s+/g, " ");
        actionCounts.set(normalizedAction, [...(actionCounts.get(normalizedAction) ?? []), `${round.round}:${prompt.stationKey}`]);
      }
    });

    if (!isPlainObject(round.outcomeBranches)) addQualityIssue(warnings, "rounds", `Round ${round.round} outcomeBranches is missing or malformed.`, `${roundPath}.outcomeBranches`);
    else {
      for (const outcomeKey of ROUND_OUTCOME_KEYS) {
        const branch = round.outcomeBranches[outcomeKey];
        if (!isPlainObject(branch)) addQualityIssue(warnings, "rounds", `Round ${round.round} outcome branch ${outcomeKey} is missing or malformed.`, `${roundPath}.outcomeBranches.${outcomeKey}`);
        else if (!Array.isArray(branch.proposedEffects)) addQualityIssue(suggestions, "rounds", `Round ${round.round} outcome branch ${outcomeKey} should keep proposedEffects as an array, even when empty.`, `${roundPath}.outcomeBranches.${outcomeKey}.proposedEffects`);
      }
    }
  });
  for (const [action, locations] of actionCounts.entries()) {
    if (action.length > 0 && locations.length > 1) addQualityIssue(warnings, "rounds", `Repeated identical playerAction text appears in ${locations.join(", ")}.`, "rounds.activeStations.playerAction");
  }

  const sourceFinalOutcomes = source.finalOutcomes;
  if (!isPlainObject(sourceFinalOutcomes)) addQualityIssue(errors, "finalOutcomes", "finalOutcomes must be an object with the five canonical outcomes.", "finalOutcomes");
  for (const key of FINAL_OUTCOME_KEYS) {
    const outcome = normalizedDraft.finalOutcomes?.[key];
    const sourceOutcome = isPlainObject(sourceFinalOutcomes) ? (sourceFinalOutcomes[key] ?? sourceFinalOutcomes[CANONICAL_TO_LEGACY_FINAL_OUTCOME_KEYS[key]]) : null;
    if (!isPlainObject(sourceOutcome)) addQualityIssue(errors, "finalOutcomes", `Missing canonical final outcome ${key}.`, `finalOutcomes.${key}`);
    const label = trimmedText(outcome?.label);
    const narrative = trimmedText(outcome?.vignette);
    const rewards = Array.isArray(outcome?.rewards) ? outcome.rewards.filter((entry) => trimmedText(entry).length > 0) : [];
    const losses = Array.isArray(outcome?.losses) ? outcome.losses.filter((entry) => trimmedText(entry).length > 0) : [];
    const outcomeChecks = [
      createChecklistItem(`${FINAL_OUTCOME_LABELS[key]} label is present`, label.length > 0, "warning", `${FINAL_OUTCOME_LABELS[key]} needs a label.`),
      createChecklistItem(`${FINAL_OUTCOME_LABELS[key]} narrative/result text is present`, narrative.length > 0, "warning", `${FINAL_OUTCOME_LABELS[key]} needs narrative/result text.`),
      createChecklistItem(`${FINAL_OUTCOME_LABELS[key]} narrative/result text is table-ready length`, countWords(narrative) >= 8 && !isPlaceholderText(narrative), "suggestion", `${FINAL_OUTCOME_LABELS[key]} final outcome text is short or placeholder-like.`)
    ];
    checklist.finalOutcomes.push(...outcomeChecks);
    if (!outcomeChecks[0].passed) addQualityIssue(warnings, "finalOutcomes", outcomeChecks[0].message, `finalOutcomes.${key}.label`);
    if (!outcomeChecks[1].passed) addQualityIssue(warnings, "finalOutcomes", outcomeChecks[1].message, `finalOutcomes.${key}.vignette`);
    else if (!outcomeChecks[2].passed) addQualityIssue(suggestions, "finalOutcomes", outcomeChecks[2].message, `finalOutcomes.${key}.vignette`);
    if (["criticalSuccess", "success"].includes(key) && rewards.length === 0) addQualityIssue(suggestions, "finalOutcomes", `${FINAL_OUTCOME_LABELS[key]} usually benefits from reward text, even if the reward is narrative-only.`, `finalOutcomes.${key}.rewards`);
    if (["mixed", "failure", "criticalFailure"].includes(key) && losses.length === 0) addQualityIssue(suggestions, "finalOutcomes", `${FINAL_OUTCOME_LABELS[key]} usually benefits from consequence text, even if the consequence is narrative-only.`, `finalOutcomes.${key}.losses`);
  }
  checkFinalOutcomeResourceEffects(sourceFinalOutcomes, normalizedDraft, warnings);

  const leakageIssues = collectBoundaryLeakageIssues(source);
  for (const issue of leakageIssues) {
    const target = issue.severity === "error" ? errors : warnings;
    addQualityIssue(target, "boundaries", issue.message, issue.path, { leakage: issue.key });
  }
  checklist.boundaries.push(
    createChecklistItem("No AP/RAP spending language", !leakageIssues.some((issue) => issue.key === "apRap"), "error", "Remove AP/RAP spending language from event data."),
    createChecklistItem("No combat automation language", !leakageIssues.some((issue) => ["shipCombat", "automaticCombatStart"].includes(issue.key)), "error", "Keep combat handoffs narrative/data-only."),
    createChecklistItem("No actor/world/compendium mutation language", !leakageIssues.some((issue) => ["actorMutation", "persistence"].includes(issue.key)), "error", "Remove persistence and actor mutation language."),
    createChecklistItem("No staged-effect application language", !leakageIssues.some((issue) => issue.key === "stagedEffectApplication"), "error", "Describe proposed effects as staged/GM-applied only."),
    createChecklistItem("Voidsailing wording preferred over ocean-only terms", !leakageIssues.some((issue) => issue.key === "oceanOnly"), "warning", "Swap ocean-only sailing terms for voidsailing language where appropriate.")
  );

  const canExportDraft = isPlainObject(source) && unsupportedShapeIssues.length === 0;
  const finalized = finalizeTravelEventDraft(normalizedDraft, options);
  const stripped = finalized.event ? stripBuilderMetadata(finalized.event) : stripBuilderMetadata(normalizedDraft);
  checklist.builderReadiness.push(
    createChecklistItem("Event can be exported as draft", canExportDraft, "error", "Draft export requires data-only object shape."),
    createChecklistItem("Event can be finalized", finalized.ok === true, "error", "Fix validation errors before final export."),
    createChecklistItem("Builder metadata can be stripped", !Object.hasOwn(stripped ?? {}, "builder"), "error", "Final export must omit builder metadata."),
    createChecklistItem("Import/export shape is supported", unsupportedShapeIssues.length === 0, "error", "Remove unsupported values that JSON import/export cannot represent safely.")
  );
  for (const item of checklist.builderReadiness.filter((entry) => !entry.passed)) addQualityIssue(errors, "builderReadiness", item.message, "builderReadiness");

  const summary = summarizeQualitySeverity(errors, warnings, suggestions);
  const ready = summary.readiness === "Ready to Export";
  return deepFreeze({
    ok: errors.length === 0,
    ready,
    ...summary,
    errors,
    warnings,
    suggestions,
    checklist,
    validation: {
      ok: validation.ok,
      errors: cloneData(validation.errors),
      warnings: cloneData(validation.warnings)
    }
  });
}

export function prepareTravelEventBuilderQualityReport(draft, options = {}) {
  assertOptionsObject(options, "prepareTravelEventBuilderQualityReport");
  const report = analyzeTravelEventBuilderQuality(draft, options);
  const grouped = {
    errors: Object.fromEntries(["topLevel", "rounds", "finalOutcomes", "boundaries", "builderReadiness"].map((area) => [area, report.errors.filter((entry) => entry.area === area)])),
    warnings: Object.fromEntries(["topLevel", "rounds", "finalOutcomes", "boundaries", "builderReadiness"].map((area) => [area, report.warnings.filter((entry) => entry.area === area)])),
    suggestions: Object.fromEntries(["topLevel", "rounds", "finalOutcomes", "boundaries", "builderReadiness"].map((area) => [area, report.suggestions.filter((entry) => entry.area === area)]))
  };

  return deepFreeze({
    ...report,
    grouped,
    hasErrors: report.errors.length > 0,
    hasWarnings: report.warnings.length > 0,
    hasSuggestions: report.suggestions.length > 0,
    areas: Object.entries(report.checklist).map(([key, items]) => ({
      key,
      label: {
        topLevel: "Top-Level Event Quality",
        rounds: "Round Quality",
        finalOutcomes: "Final Outcome Quality",
        boundaries: "Boundary Leakage",
        builderReadiness: "Builder Readiness"
      }[key] ?? key,
      items,
      passed: items.every((item) => item.passed),
      errorCount: grouped.errors[key]?.length ?? 0,
      warningCount: grouped.warnings[key]?.length ?? 0,
      suggestionCount: grouped.suggestions[key]?.length ?? 0,
      errors: grouped.errors[key] ?? [],
      warnings: grouped.warnings[key] ?? [],
      suggestions: grouped.suggestions[key] ?? []
    }))
  });
}

export function validateTravelEventDraft(draft, options = {}) {
  assertOptionsObject(options, "validateTravelEventDraft");
  const normalizedDraft = normalizeTravelEventDraft(draft, options);
  const validation = validateTravelEventDefinition(normalizedDraft, { ...options, strictAuthoring: true });
  const errors = [...collectMalformedFinalOutcomeErrors(draft), ...validation.errors];
  const warnings = [...validation.warnings];
  const legacyMissingFinalOutcomeMessages = LEGACY_FINAL_OUTCOME_KEYS.map((key) => `Missing final outcome ${key}.`);
  const canonicalFinalOutcomesPresent = FINAL_OUTCOME_KEYS.every((key) => normalizedDraft.finalOutcomes?.[key]);
  if (canonicalFinalOutcomesPresent) {
    for (const message of legacyMissingFinalOutcomeMessages) {
      const index = errors.indexOf(message);
      if (index >= 0) errors.splice(index, 1);
    }
  }

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
      label: normalizedDraft.finalOutcomes?.[key]?.label ?? FINAL_OUTCOME_LABELS[key] ?? key,
      hasVignette: typeof normalizedDraft.finalOutcomes?.[key]?.vignette === "string" && normalizedDraft.finalOutcomes[key].vignette.trim().length > 0,
      proposedEffectCount: normalizedDraft.finalOutcomes?.[key]?.proposedEffects?.length ?? 0,
      rewardCount: normalizedDraft.finalOutcomes?.[key]?.rewards?.length ?? 0,
      lossCount: normalizedDraft.finalOutcomes?.[key]?.losses?.length ?? 0
    }))
  };

  return deepFreeze(summary);
}
