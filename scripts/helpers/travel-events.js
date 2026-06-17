import { ARCFLIGHT_TRAVEL_EVENT_CATEGORIES, ARCFLIGHT_TRAVEL_EVENT_OUTCOMES, ARCFLIGHT_TRAVEL_RESOURCES, ARCFLIGHT_TRAVEL_RESULT_TIERS, ARCFLIGHT_TRAVEL_ROUND_OUTCOMES, ARCFLIGHT_TRAVEL_STATIONS } from "../config/constants.js";
import { CORE_TRAVEL_EVENTS, getCoreTravelEvent } from "../../data/travel-events/core-travel-events.js";

const TRAVEL_FIVE_STATION_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_STATIONS));
const TRAVEL_RESOURCE_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_RESOURCES));
const TRAVEL_EVENT_CATEGORIES = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_EVENT_CATEGORIES));
const TRAVEL_EVENT_OUTCOME_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_EVENT_OUTCOMES));
const CANONICAL_TRAVEL_EVENT_OUTCOME_KEYS = Object.freeze(["criticalSuccess", "success", "mixed", "failure", "criticalFailure"]);
const TRAVEL_DEGREE_ALIASES = Object.freeze({
  3: ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_SUCCESS,
  2: ARCFLIGHT_TRAVEL_RESULT_TIERS.SUCCESS,
  1: ARCFLIGHT_TRAVEL_RESULT_TIERS.FAILURE,
  0: ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_FAILURE,
  criticalsuccess: ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_SUCCESS,
  "critical-success": ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_SUCCESS,
  "critical success": ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_SUCCESS,
  critsuccess: ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_SUCCESS,
  success: ARCFLIGHT_TRAVEL_RESULT_TIERS.SUCCESS,
  failure: ARCFLIGHT_TRAVEL_RESULT_TIERS.FAILURE,
  criticalfailure: ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_FAILURE,
  "critical-failure": ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_FAILURE,
  "critical failure": ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_FAILURE,
  critfailure: ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_FAILURE
});


function containsApRapReference(value) {
  if (typeof value === "string") return /\b(?:AP|RAP|action points?|reaction action points?)\b/i.test(value);
  if (Array.isArray(value)) return value.some((entry) => containsApRapReference(entry));
  if (value && typeof value === "object") return Object.values(value).some((entry) => containsApRapReference(entry));
  return false;
}

function containsFunctionValue(value) {
  if (typeof value === "function") return true;
  if (Array.isArray(value)) return value.some((entry) => containsFunctionValue(entry));
  if (value && typeof value === "object") return Object.values(value).some((entry) => containsFunctionValue(entry));
  return false;
}

function getActiveStationKey(entry) {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object" && !Array.isArray(entry)) return entry.stationKey;
  return null;
}

function getStrictAuthoringPrompt(round, activeStationEntry) {
  if (activeStationEntry && typeof activeStationEntry === "object" && !Array.isArray(activeStationEntry)) return activeStationEntry;
  const stationKey = getActiveStationKey(activeStationEntry);
  const prompt = round?.stationPrompts?.[stationKey];
  return prompt && typeof prompt === "object" && !Array.isArray(prompt) ? { ...prompt, stationKey: prompt.stationKey ?? stationKey } : { stationKey };
}

function validateStrictAuthoringStationPrompt(prompt, roundNumber, errors) {
  const stationLabel = `Round ${roundNumber ?? "?"} ${prompt?.stationKey ?? "<missing station>"}`;
  if (typeof prompt?.playerAction !== "string" || prompt.playerAction.trim().length === 0) errors.push(`${stationLabel} is missing playerAction.`);
  if (!prompt?.rollFeedback || typeof prompt.rollFeedback !== "object" || Array.isArray(prompt.rollFeedback)) {
    errors.push(`${stationLabel} is missing rollFeedback.`);
    return;
  }

  for (const degree of Object.values(ARCFLIGHT_TRAVEL_RESULT_TIERS)) {
    if (typeof prompt.rollFeedback[degree] !== "string" || prompt.rollFeedback[degree].trim().length === 0) errors.push(`${stationLabel} rollFeedback.${degree} must be a non-empty string.`);
  }
}

function hasAnyResultFeedbackText(source) {
  return source && typeof source === "object" && !Array.isArray(source) && Object.values(ARCFLIGHT_TRAVEL_RESULT_TIERS).some((degree) => typeof source[degree] === "string" && source[degree].trim().length > 0);
}

function validateResultFeedbackMap(source, path, errors) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    errors.push(`${path} must be an object.`);
    return false;
  }

  let ok = true;
  for (const degree of Object.values(ARCFLIGHT_TRAVEL_RESULT_TIERS)) {
    if (typeof source[degree] !== "string" || source[degree].trim().length === 0) {
      errors.push(`${path}.${degree} must be a non-empty string.`);
      ok = false;
    }
  }

  return ok;
}

function validateStationCard(card, roundNumber, errors, warnings, options = {}) {
  const { requireStructuredApproachFeedback = false } = options;
  const stationLabel = `Round ${roundNumber ?? "?"} stationCards ${card?.stationKey ?? "<missing station>"}`;
  if (!card || typeof card !== "object" || Array.isArray(card)) {
    errors.push(`${stationLabel} must be an object.`);
    return;
  }
  if (!isTravelStationKey(card.stationKey)) errors.push(`${stationLabel} has an invalid stationKey.`);
  if (typeof card.problem !== "string" || card.problem.trim().length === 0) errors.push(`${stationLabel} is missing problem.`);
  if (!Array.isArray(card.skillApproaches) || card.skillApproaches.length === 0) errors.push(`${stationLabel} skillApproaches must be a non-empty array.`);
  else {
    for (const [index, approach] of card.skillApproaches.entries()) {
      if (!approach || typeof approach !== "object" || Array.isArray(approach)) {
        errors.push(`${stationLabel} skillApproaches[${index}] must be an object.`);
        continue;
      }

      if (typeof approach.skill !== "string" || approach.skill.trim().length === 0) errors.push(`${stationLabel} skillApproaches[${index}].skill must be a non-empty string.`);
      if (typeof approach.label !== "string" || approach.label.trim().length === 0) errors.push(`${stationLabel} skillApproaches[${index}].label must be a non-empty string.`);
      if (typeof approach.helpText !== "string" || approach.helpText.trim().length === 0) errors.push(`${stationLabel} skillApproaches[${index}].helpText must be a non-empty string.`);
      if (approach.gmOnlyConsequence != null && typeof approach.gmOnlyConsequence !== "string") errors.push(`${stationLabel} skillApproaches[${index}].gmOnlyConsequence must be a string when present.`);

      if (requireStructuredApproachFeedback || hasAnyResultFeedbackText(approach.boardResultFeedback) || (typeof approach.gmOnlyConsequence === "string" && approach.gmOnlyConsequence.trim().length > 0)) {
        validateResultFeedbackMap(approach.boardResultFeedback, `${stationLabel} skillApproaches[${index}].boardResultFeedback`, errors);
      }
      if (requireStructuredApproachFeedback || hasAnyResultFeedbackText(approach.gmNarrationFeedback) || (typeof approach.gmOnlyConsequence === "string" && approach.gmOnlyConsequence.trim().length > 0)) {
        validateResultFeedbackMap(approach.gmNarrationFeedback, `${stationLabel} skillApproaches[${index}].gmNarrationFeedback`, errors);
      }
    }
  }
  if (!card.rollFeedback || typeof card.rollFeedback !== "object" || Array.isArray(card.rollFeedback)) errors.push(`${stationLabel} is missing rollFeedback.`);
  else {
    for (const degree of Object.values(ARCFLIGHT_TRAVEL_RESULT_TIERS)) {
      if (typeof card.rollFeedback[degree] !== "string" || card.rollFeedback[degree].trim().length === 0) errors.push(`${stationLabel} rollFeedback.${degree} must be a non-empty string.`);
    }
  }
  if (card.hooks != null && (typeof card.hooks !== "object" || Array.isArray(card.hooks))) errors.push(`${stationLabel} hooks must be an object when present.`);
  if (containsFunctionValue(card.hooks)) errors.push(`${stationLabel} hooks must be data only and cannot contain functions.`);
}

function validateProposedEffectsDataOnly(source, label, errors) {
  if (!Array.isArray(source?.proposedEffects)) return;
  source.proposedEffects.forEach((effect, index) => {
    if (containsFunctionValue(effect)) errors.push(`${label} proposedEffects[${index}] must be data only and cannot contain functions.`);
  });
}

function cloneData(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function getEventData(eventKeyOrData) {
  if (typeof eventKeyOrData === "string") return getCoreTravelEvent(eventKeyOrData);
  if (eventKeyOrData && typeof eventKeyOrData === "object") return eventKeyOrData;
  return null;
}

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function getTravelFiveStationKeys() {
  return [...TRAVEL_FIVE_STATION_KEYS];
}

export function isTravelStationKey(stationKey) {
  return TRAVEL_FIVE_STATION_KEYS.includes(stationKey);
}

export function normalizeTravelDegree(degreeOrLabel) {
  if (Object.values(ARCFLIGHT_TRAVEL_RESULT_TIERS).includes(degreeOrLabel)) return degreeOrLabel;
  const normalized = String(degreeOrLabel ?? "").trim().replace(/[ _]+/g, "").toLowerCase();
  return TRAVEL_DEGREE_ALIASES[degreeOrLabel] ?? TRAVEL_DEGREE_ALIASES[normalized] ?? null;
}

export function getTravelDegreeContribution(degreeOrLabel) {
  const degree = normalizeTravelDegree(degreeOrLabel);
  if (degree === ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_SUCCESS) return { successes: 2, failures: 0, criticalFailures: 0 };
  if (degree === ARCFLIGHT_TRAVEL_RESULT_TIERS.SUCCESS) return { successes: 1, failures: 0, criticalFailures: 0 };
  if (degree === ARCFLIGHT_TRAVEL_RESULT_TIERS.FAILURE) return { successes: 0, failures: 1, criticalFailures: 0 };
  if (degree === ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_FAILURE) return { successes: 0, failures: 2, criticalFailures: 1 };
  return { successes: 0, failures: 0, criticalFailures: 0 };
}

export function getTravelRoundOutcome({ successes = 0, failures = 0, criticalFailures = 0 } = {}) {
  const successCount = numericValue(successes);
  const failureCount = numericValue(failures);
  if (numericValue(criticalFailures) >= 2) return ARCFLIGHT_TRAVEL_ROUND_OUTCOMES.CATASTROPHIC_FAILURE;
  if (successCount > failureCount) return ARCFLIGHT_TRAVEL_ROUND_OUTCOMES.DOMINANT_SUCCESS;
  if (successCount === failureCount) return ARCFLIGHT_TRAVEL_ROUND_OUTCOMES.MIXED;
  return ARCFLIGHT_TRAVEL_ROUND_OUTCOMES.DOMINANT_FAILURE;
}

export function getTravelEventOutcome({ successes = 0, failures = 0, catastrophicFailure = false } = {}) {
  const successCount = numericValue(successes);
  const failureCount = numericValue(failures);
  if (catastrophicFailure) return ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.CATASTROPHIC_FAILURE;
  if (successCount >= failureCount + 4) return ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.MAJOR_VICTORY;
  if (successCount > failureCount) return ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.VICTORY;
  if (successCount === failureCount) return ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.COSTLY_SUCCESS;
  return ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.FAILURE;
}

export function validateTravelEventDefinition(event, options = {}) {
  const { strictAuthoring = false } = options ?? {};
  const errors = [];
  const warnings = [];

  if (!event || typeof event !== "object") {
    return { ok: false, errors: ["Travel event definition is missing or not an object."], warnings };
  }

  if (!TRAVEL_EVENT_CATEGORIES.includes(event.category)) errors.push(`category ${event.category ?? "<missing>"} is not a canonical travel event category (${TRAVEL_EVENT_CATEGORIES.join(", ")}).`);
  if (!Number.isInteger(event.roundCount) || event.roundCount <= 0) errors.push("roundCount must be a positive integer.");
  if (!Array.isArray(event.rounds)) errors.push("rounds must be an array.");
  else if (event.rounds.length !== event.roundCount) errors.push(`roundCount mismatch: roundCount is ${event.roundCount}, but rounds contains ${event.rounds.length} entries.`);

  if (!Array.isArray(event.tags)) errors.push("tags must be an array of strings.");
  else if (!event.tags.every((tag) => typeof tag === "string")) errors.push("Every tag must be a string.");

  if (!Array.isArray(event.activeResources)) errors.push("activeResources must be an array.");
  else {
    const unknownResources = event.activeResources.filter((resource) => !TRAVEL_RESOURCE_KEYS.includes(resource));
    if (unknownResources.length > 0) errors.push(`activeResources contains unknown travel resource keys: ${unknownResources.join(", ")} (canonical: ${TRAVEL_RESOURCE_KEYS.join(", ")}).`);
  }

  if (Array.isArray(event.travelStations)) {
    const unknownTravelStations = event.travelStations.filter((stationKey) => !isTravelStationKey(stationKey));
    if (unknownTravelStations.length > 0) errors.push(`travelStations contains unknown Travel Five station keys: ${unknownTravelStations.join(", ")} (canonical: ${TRAVEL_FIVE_STATION_KEYS.join(", ")}).`);
  } else {
    warnings.push("travelStations should list the Travel Five used by this event.");
  }

  for (const round of event.rounds ?? []) {
    if (!Number.isInteger(round.round) || round.round <= 0) errors.push(`Round has invalid round number: ${round.round ?? "<missing>"}.`);
    if (!Array.isArray(round.activeStations)) errors.push(`Round ${round.round ?? "?"} activeStations must be an array.`);
    else {
      const invalidStations = round.activeStations.map((station) => getActiveStationKey(station)).filter((stationKey) => !isTravelStationKey(stationKey));
      if (invalidStations.length > 0) errors.push(`Round ${round.round ?? "?"} activeStations contains unknown Travel Five station keys: ${invalidStations.join(", ")} (canonical: ${TRAVEL_FIVE_STATION_KEYS.join(", ")}).`);
      if (strictAuthoring) {
        for (const activeStation of round.activeStations) validateStrictAuthoringStationPrompt(getStrictAuthoringPrompt(round, activeStation), round.round, errors);
      }
    }
    if (round.stationCards != null) {
      if (!Array.isArray(round.stationCards)) errors.push(`Round ${round.round ?? "?"} stationCards must be an array when present.`);
      else {
        const activeStationKeys = Array.isArray(round.activeStations) ? round.activeStations.map((station) => getActiveStationKey(station)).filter((stationKey) => isTravelStationKey(stationKey)) : [];
        const structuredStationCards = activeStationKeys.length > 0 && round.activeStations.every((station) => typeof station === "string") && round.stationCards.some((card) => (Array.isArray(card?.skillApproaches) ? card.skillApproaches : []).some((approach) => hasAnyResultFeedbackText(approach?.boardResultFeedback) || hasAnyResultFeedbackText(approach?.gmNarrationFeedback) || (typeof approach?.gmOnlyConsequence === "string" && approach.gmOnlyConsequence.trim().length > 0)));
        const seenCards = new Set();
        for (const card of round.stationCards) {
          validateStationCard(card, round.round, errors, warnings, { requireStructuredApproachFeedback: structuredStationCards });
          if (!card || typeof card !== "object" || Array.isArray(card)) continue;
          if (seenCards.has(card.stationKey)) errors.push(`Round ${round.round ?? "?"} has duplicate stationCards for ${card.stationKey}.`);
          seenCards.add(card.stationKey);
          if (structuredStationCards && isTravelStationKey(card.stationKey) && !activeStationKeys.includes(card.stationKey)) errors.push(`Round ${round.round ?? "?"} stationCards ${card.stationKey} is not listed in activeStations.`);
          const seenSkills = new Set();
          for (const [index, approach] of (Array.isArray(card.skillApproaches) ? card.skillApproaches : []).entries()) {
            const skill = typeof approach?.skill === "string" ? approach.skill.trim() : "";
            if (!skill) continue;
            if (seenSkills.has(skill)) warnings.push(`Round ${round.round ?? "?"} stationCards ${card.stationKey ?? "<missing station>"} has duplicate skillApproaches for skill ${skill} at index ${index}.`);
            seenSkills.add(skill);
          }
        }
        if (structuredStationCards) {
          const cardStationKeys = round.stationCards.map((card) => card?.stationKey).filter((stationKey) => isTravelStationKey(stationKey));
          for (const stationKey of activeStationKeys) {
            if (!cardStationKeys.includes(stationKey)) errors.push(`Round ${round.round ?? "?"} has active station ${stationKey} but no matching stationCard.`);
          }
        }
      }
    }
    const branchKeys = Object.keys(round.outcomeBranches ?? {});
    for (const outcome of Object.values(ARCFLIGHT_TRAVEL_ROUND_OUTCOMES)) {
      if (!branchKeys.includes(outcome)) errors.push(`Round ${round.round ?? "?"} is missing outcome branch ${outcome}.`);
      validateProposedEffectsDataOnly(round.outcomeBranches?.[outcome], `Round ${round.round ?? "?"} ${outcome}`, errors);
    }
  }

  if (!event.finalOutcomes || typeof event.finalOutcomes !== "object" || Array.isArray(event.finalOutcomes)) errors.push("finalOutcomes must be an object.");
  else {
    const hasCanonicalFinalOutcomes = CANONICAL_TRAVEL_EVENT_OUTCOME_KEYS.every((outcome) => Boolean(event.finalOutcomes[outcome]));
    const expectedFinalOutcomes = hasCanonicalFinalOutcomes ? CANONICAL_TRAVEL_EVENT_OUTCOME_KEYS : TRAVEL_EVENT_OUTCOME_KEYS;
    for (const outcome of expectedFinalOutcomes) {
      if (!event.finalOutcomes[outcome]) errors.push(`finalOutcomes is missing required outcome key ${outcome}.`);
      validateProposedEffectsDataOnly(event.finalOutcomes[outcome], `Final outcome ${outcome}`, errors);
    }
  }

  if (strictAuthoring && containsApRapReference(event)) errors.push("Strict authoring travel event prose/data must not reference AP/RAP travel use.");

  if (!CORE_TRAVEL_EVENTS[event.key]) warnings.push("Travel event is not registered in CORE_TRAVEL_EVENTS.");

  return { ok: errors.length === 0, errors, warnings };
}

export function prepareTravelEventSummary(eventKeyOrData) {
  const event = getEventData(eventKeyOrData);
  if (!event) {
    return {
      ok: false,
      event: null,
      validation: { ok: false, errors: ["Travel event not found."], warnings: [] },
      errors: ["Travel event not found."],
      warnings: []
    };
  }

  const validation = validateTravelEventDefinition(event);
  return {
    ok: validation.ok,
    event: cloneData(event),
    validation,
    errors: cloneData(validation.errors),
    warnings: cloneData(validation.warnings)
  };
}

export function prepareTravelRoundSummary(eventKeyOrData, roundNumber) {
  const eventSummary = prepareTravelEventSummary(eventKeyOrData);
  if (!eventSummary.ok && !eventSummary.event) return { ...eventSummary, round: null };

  const requestedRound = Number(roundNumber);
  const round = eventSummary.event?.rounds?.find((entry) => entry.round === requestedRound) ?? null;
  const errors = [...eventSummary.errors];
  if (!round) errors.push(`Round ${roundNumber} not found.`);

  return {
    ok: eventSummary.ok && Boolean(round),
    event: eventSummary.event,
    round: cloneData(round),
    validation: eventSummary.validation,
    errors,
    warnings: eventSummary.warnings
  };
}

export function getTravelEventStationPrompt(eventKeyOrData, roundNumber, stationKey) {
  const roundSummary = prepareTravelRoundSummary(eventKeyOrData, roundNumber);
  const prompt = roundSummary.round?.activeStations?.find((station) => station.stationKey === stationKey) ?? null;
  const errors = [...roundSummary.errors];
  if (!isTravelStationKey(stationKey)) errors.push(`${stationKey} is not a Travel Five station key.`);
  if (!prompt) errors.push(`Station prompt not found for ${stationKey} in round ${roundNumber}.`);

  return {
    ok: roundSummary.ok && Boolean(prompt) && isTravelStationKey(stationKey),
    event: roundSummary.event,
    round: roundSummary.round,
    prompt: cloneData(prompt),
    validation: roundSummary.validation,
    errors,
    warnings: roundSummary.warnings
  };
}
