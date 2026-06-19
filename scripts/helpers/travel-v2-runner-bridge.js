import {
  createTravelV2RoundOutcomePressureRequests,
  createTravelV2RoundPressureRequestSummary,
  normalizeTravelV2RoundOutcomeKey,
  normalizeTravelV2RoundPressureProfile
} from "./travel-v2-round-pressure-adapter.js";
import { TRAVEL_V2_PRESSURE_CHANGE_SOURCES } from "./travel-v2-pressure-engine.js";

export const TRAVEL_V2_RUNNER_BRIDGE_VERSION = 1;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function integerValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function normalizeRoundIndex(sessionInput = {}, roundIndexInput = null) {
  const session = isPlainObject(sessionInput) ? sessionInput : {};
  const rounds = Array.isArray(session.event?.rounds) ? session.event.rounds : [];
  const fallback = integerValue(session.currentRoundIndex, 0);
  const requested = roundIndexInput === null || roundIndexInput === undefined ? fallback : integerValue(roundIndexInput, fallback);
  if (rounds.length === 0) return -1;
  return Math.min(Math.max(requested, 0), rounds.length - 1);
}

export function getTravelV2RunnerRound(sessionInput = {}, roundIndexInput = null) {
  const session = isPlainObject(sessionInput) ? sessionInput : {};
  const rounds = Array.isArray(session.event?.rounds) ? session.event.rounds : [];
  const roundIndex = normalizeRoundIndex(session, roundIndexInput);
  return {
    ok: roundIndex >= 0 && isPlainObject(rounds[roundIndex]),
    roundIndex,
    round: roundIndex >= 0 && isPlainObject(rounds[roundIndex]) ? rounds[roundIndex] : null
  };
}

export function createTravelV2RunnerRoundPressureProfile(sessionInput = {}, roundIndexInput = null, options = {}) {
  const resolved = getTravelV2RunnerRound(sessionInput, roundIndexInput);
  if (!resolved.ok) {
    return {
      ok: false,
      errors: ["Travel runner session has no readable round for Travel v2 pressure preview."],
      roundIndex: resolved.roundIndex,
      profile: null
    };
  }

  const round = resolved.round;
  const roundNumber = options.roundNumber ?? round.roundNumber ?? round.number ?? round.round ?? resolved.roundIndex + 1;
  const profile = normalizeTravelV2RoundPressureProfile({
    roundNumber,
    primaryPressureType: options.primaryPressureType ?? round.primaryPressureType ?? round.primaryPressure ?? round.pressureType,
    secondaryPressureType: options.secondaryPressureType ?? round.secondaryPressureType ?? round.secondaryPressure,
    pressureStation: options.pressureStation ?? round.pressureStation ?? round.stationKey
  });

  return { ok: true, errors: [], roundIndex: resolved.roundIndex, round, profile };
}

export function previewTravelV2RunnerRoundOutcomePressure(sessionInput = {}, roundIndexInput = null, outcomeKeyInput = "skipped", options = {}) {
  const profileResult = createTravelV2RunnerRoundPressureProfile(sessionInput, roundIndexInput, options);
  if (!profileResult.ok) {
    return {
      ok: false,
      errors: profileResult.errors,
      warnings: [],
      roundIndex: profileResult.roundIndex,
      roundNumber: null,
      outcomeKey: normalizeTravelV2RoundOutcomeKey(outcomeKeyInput),
      profile: null,
      requests: [],
      summary: createTravelV2RoundPressureRequestSummary([])
    };
  }

  const outcomeKey = normalizeTravelV2RoundOutcomeKey(outcomeKeyInput);
  const requests = createTravelV2RoundOutcomePressureRequests(profileResult.profile, outcomeKey, {
    source: options.source ?? TRAVEL_V2_PRESSURE_CHANGE_SOURCES.ROUND_OUTCOME,
    reason: options.reason ?? `runner-round-${outcomeKey}`,
    roundNumber: profileResult.profile.roundNumber,
    stationKey: options.stationKey ?? profileResult.profile.pressureStation,
    note: options.note
  });

  return {
    ok: true,
    errors: [],
    warnings: [],
    roundIndex: profileResult.roundIndex,
    roundNumber: profileResult.profile.roundNumber,
    outcomeKey,
    profile: profileResult.profile,
    requests,
    summary: createTravelV2RoundPressureRequestSummary(requests)
  };
}

export function previewTravelV2RunnerCurrentRoundOutcomePressure(sessionInput = {}, outcomeKeyInput = "skipped", options = {}) {
  return previewTravelV2RunnerRoundOutcomePressure(sessionInput, null, outcomeKeyInput, options);
}
