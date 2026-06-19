import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import {
  createTravelV2PressureChangeRequest,
  TRAVEL_V2_PRESSURE_CHANGE_SOURCES
} from "./travel-v2-pressure-engine.js";
import { normalizeTravelV2PressureType } from "./travel-v2-state.js";

export const TRAVEL_V2_ROUND_PRESSURE_ADAPTER_VERSION = 1;

export const TRAVEL_V2_ROUND_OUTCOME_KEYS = Object.freeze({
  CRITICAL_SUCCESS: "criticalSuccess",
  SUCCESS: "success",
  MIXED: "mixed",
  FAILURE: "failure",
  CRITICAL_FAILURE: "criticalFailure",
  SKIPPED: "skipped"
});

export const TRAVEL_V2_ROUND_OUTCOME_PRESSURE_RULES = Object.freeze({
  [TRAVEL_V2_ROUND_OUTCOME_KEYS.CRITICAL_SUCCESS]: Object.freeze({ primary: 0, secondary: 0 }),
  [TRAVEL_V2_ROUND_OUTCOME_KEYS.SUCCESS]: Object.freeze({ primary: 0, secondary: 0 }),
  [TRAVEL_V2_ROUND_OUTCOME_KEYS.MIXED]: Object.freeze({ primary: 1, secondary: 0 }),
  [TRAVEL_V2_ROUND_OUTCOME_KEYS.FAILURE]: Object.freeze({ primary: 1, secondary: 1 }),
  [TRAVEL_V2_ROUND_OUTCOME_KEYS.CRITICAL_FAILURE]: Object.freeze({ primary: 2, secondary: 1 }),
  [TRAVEL_V2_ROUND_OUTCOME_KEYS.SKIPPED]: Object.freeze({ primary: 0, secondary: 0 })
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function integerValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function positiveRoundNumber(value) {
  const number = integerValue(value, 0);
  return number > 0 ? number : null;
}

export function normalizeTravelV2RoundOutcomeKey(value) {
  if (value === 3 || value === "3" || value === "critical-success" || value === "criticalSuccess" || value === "criticalRoundSuccess") return TRAVEL_V2_ROUND_OUTCOME_KEYS.CRITICAL_SUCCESS;
  if (value === 2 || value === "2" || value === "success" || value === "roundSuccess" || value === "dominantSuccess") return TRAVEL_V2_ROUND_OUTCOME_KEYS.SUCCESS;
  if (value === "mixed" || value === "narrowRoundSuccess") return TRAVEL_V2_ROUND_OUTCOME_KEYS.MIXED;
  if (value === 1 || value === "1" || value === "failure" || value === "roundFailure" || value === "dominantFailure") return TRAVEL_V2_ROUND_OUTCOME_KEYS.FAILURE;
  if (value === 0 || value === "0" || value === "critical-failure" || value === "criticalFailure" || value === "criticalRoundFailure" || value === "catastrophicFailure") return TRAVEL_V2_ROUND_OUTCOME_KEYS.CRITICAL_FAILURE;
  if (value === "skipped") return TRAVEL_V2_ROUND_OUTCOME_KEYS.SKIPPED;
  return TRAVEL_V2_ROUND_OUTCOME_KEYS.SKIPPED;
}

export function getTravelV2RoundOutcomePressureRule(outcomeKeyInput) {
  const outcomeKey = normalizeTravelV2RoundOutcomeKey(outcomeKeyInput);
  return TRAVEL_V2_ROUND_OUTCOME_PRESSURE_RULES[outcomeKey] ?? TRAVEL_V2_ROUND_OUTCOME_PRESSURE_RULES.skipped;
}

export function normalizeTravelV2RoundPressureProfile(roundInput = {}) {
  const round = isPlainObject(roundInput) ? roundInput : {};
  const primaryPressureType = normalizeTravelV2PressureType(round.primaryPressureType ?? round.primaryPressure ?? round.pressureType ?? ARCFLIGHT_TRAVEL_RESOURCES.STRAIN);
  const secondaryPressureType = normalizeTravelV2PressureType(round.secondaryPressureType ?? round.secondaryPressure ?? "");
  const roundNumber = positiveRoundNumber(round.roundNumber ?? round.number ?? round.round);
  return {
    roundNumber,
    primaryPressureType,
    secondaryPressureType: secondaryPressureType === primaryPressureType ? "" : secondaryPressureType,
    pressureStation: stringValue(round.pressureStation ?? round.stationKey)
  };
}

export function createTravelV2RoundOutcomePressureRequests(roundInput = {}, outcomeKeyInput = "skipped", options = {}) {
  const profile = normalizeTravelV2RoundPressureProfile(roundInput);
  const outcomeKey = normalizeTravelV2RoundOutcomeKey(outcomeKeyInput);
  const rule = getTravelV2RoundOutcomePressureRule(outcomeKey);
  const source = stringValue(options.source, TRAVEL_V2_PRESSURE_CHANGE_SOURCES.ROUND_OUTCOME) || TRAVEL_V2_PRESSURE_CHANGE_SOURCES.ROUND_OUTCOME;
  const reason = stringValue(options.reason, `round-outcome-${outcomeKey}`);
  const requests = [];

  if (rule.primary && profile.primaryPressureType) {
    requests.push(createTravelV2PressureChangeRequest({
      pressureType: profile.primaryPressureType,
      amount: rule.primary,
      source,
      reason,
      roundNumber: options.roundNumber ?? profile.roundNumber,
      stationKey: options.stationKey ?? profile.pressureStation,
      note: options.note
    }));
  }

  if (rule.secondary && profile.secondaryPressureType) {
    requests.push(createTravelV2PressureChangeRequest({
      pressureType: profile.secondaryPressureType,
      amount: rule.secondary,
      source,
      reason,
      roundNumber: options.roundNumber ?? profile.roundNumber,
      stationKey: options.stationKey ?? profile.pressureStation,
      note: options.note
    }));
  }

  return requests;
}

export function normalizeTravelV2StationResultPressureInput(stationResultInput = {}) {
  const result = isPlainObject(stationResultInput) ? stationResultInput : {};
  return {
    stationKey: stringValue(result.stationKey ?? result.station),
    outcomeKey: normalizeTravelV2RoundOutcomeKey(result.outcomeKey ?? result.result ?? result.degreeOfSuccess ?? result.degree),
    pressureType: normalizeTravelV2PressureType(result.pressureType ?? result.primaryPressureType ?? result.primaryPressure ?? ""),
    secondaryPressureType: normalizeTravelV2PressureType(result.secondaryPressureType ?? result.secondaryPressure ?? ""),
    roundNumber: positiveRoundNumber(result.roundNumber ?? result.roundIndex + 1 ?? result.round),
    note: stringValue(result.note ?? result.notes)
  };
}

export function createTravelV2StationResultPressureRequests(stationResultInput = {}, options = {}) {
  const normalized = normalizeTravelV2StationResultPressureInput(stationResultInput);
  const roundProfile = {
    roundNumber: options.roundNumber ?? normalized.roundNumber,
    primaryPressureType: options.pressureType ?? normalized.pressureType,
    secondaryPressureType: options.secondaryPressureType ?? normalized.secondaryPressureType,
    pressureStation: options.stationKey ?? normalized.stationKey
  };
  return createTravelV2RoundOutcomePressureRequests(roundProfile, normalized.outcomeKey, {
    source: options.source ?? TRAVEL_V2_PRESSURE_CHANGE_SOURCES.ROUND_OUTCOME,
    reason: options.reason ?? `station-result-${normalized.outcomeKey}`,
    stationKey: options.stationKey ?? normalized.stationKey,
    roundNumber: options.roundNumber ?? normalized.roundNumber,
    note: options.note ?? normalized.note
  });
}

export function createTravelV2RoundPressureRequestSummary(requests = []) {
  const list = Array.isArray(requests) ? requests : [];
  const totalsByPressureType = {};
  for (const request of list) {
    const pressureType = normalizeTravelV2PressureType(request?.pressureType);
    if (!pressureType) continue;
    totalsByPressureType[pressureType] = (totalsByPressureType[pressureType] ?? 0) + integerValue(request?.amount, 0);
  }
  return {
    requestCount: list.length,
    hasRequests: list.length > 0,
    totalsByPressureType
  };
}
