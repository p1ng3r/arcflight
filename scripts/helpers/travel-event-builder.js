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

export function prepareTravelEventBuilderFinalOutcomeEditorState(draft, options = {}) {
  assertOptionsObject(options, "prepareTravelEventBuilderFinalOutcomeEditorState");
  const normalizedDraft = normalizeTravelEventDraft(draft ?? createTravelEventDraft(), options);

  return deepFreeze({
    outcomes: FINAL_OUTCOME_KEYS.map((key) => {
      const outcome = normalizedDraft.finalOutcomes?.[key] ?? createDefaultFinalOutcomeForKey(key);
      const effectSummaries = createReadOnlyEffectSummaries(outcome);
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
