import { ARCFLIGHT_TRAVEL_ROUND_SEGMENTS, prepareTravelRoundSegmentState } from "./travel-round-segments.js";
import { normalizeTravelV2ProposedRoundActionOrder } from "./travel-v2-round-action-order-state.js";

const REASON_CODES = Object.freeze({
  MISSING_SESSION: "missing-session",
  MISSING_ROUND: "missing-round",
  MISSING_PLANNING_STATE: "missing-planning-state",
  STALE_PLANNING_ROUND: "stale-planning-round",
  WRONG_STATION_ACTION_ROUND: "wrong-station-action-round",
  INVALID_STATION_ACTION_PHASE: "invalid-station-action-phase",
  PLANNING_NOT_COMMITTED: "planning-not-committed",
  INVALID_ACTIVE_STATIONS: "invalid-active-stations",
  INVALID_COMMITTED_ORDER: "invalid-committed-order",
  STATION_NOT_ACTIVE: "station-not-active",
  STATION_NOT_COMMITTED: "station-not-committed"
});

export const TRAVEL_V2_STATION_ACTION_PLANNING_GATE_REASONS = REASON_CODES;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze(value) {
  if (!isPlainObject(value) && !Array.isArray(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function positiveIntegerValueOrNull(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function currentPhaseContext(session = {}) {
  return { phase: prepareTravelRoundSegmentState(session).phase };
}

function currentRoundContext(session = {}) {
  const rounds = Array.isArray(session?.event?.rounds) ? session.event.rounds : [];
  if (rounds.length === 0) return { roundIndex: -1, round: null, roundNumber: null, roundResult: null, activeStationKeys: [] };
  if (!Object.hasOwn(session, "currentRoundIndex") || !Number.isInteger(session.currentRoundIndex) || session.currentRoundIndex < 0 || session.currentRoundIndex >= rounds.length) {
    return { roundIndex: -1, round: null, roundNumber: null, roundResult: null, activeStationKeys: [] };
  }
  const roundIndex = session.currentRoundIndex;
  const round = isPlainObject(rounds[roundIndex]) ? rounds[roundIndex] : null;
  const roundResult = Array.isArray(session.roundResults) && isPlainObject(session.roundResults[roundIndex]) ? session.roundResults[roundIndex] : null;
  const roundNumber = positiveIntegerValueOrNull(round?.roundNumber ?? round?.number ?? round?.round);
  const rawStations = Array.isArray(round?.activeStations) ? round.activeStations : Object.keys(roundResult?.stationResults ?? {});
  const activeStationKeys = rawStations.map((entry) => typeof entry === "string" ? entry : entry?.stationKey).filter(Boolean);
  return { roundIndex: round && roundNumber !== null ? roundIndex : -1, round: roundNumber !== null ? round : null, roundNumber, roundResult: roundNumber !== null ? roundResult : null, activeStationKeys: roundNumber !== null ? activeStationKeys : [] };
}

function requestedRoundIsAuthorized(session = {}, context = {}, options = {}) {
  if (!isPlainObject(options) || !Object.hasOwn(options, "requestedRoundIndex")) return true;
  const requestedRoundIndex = options.requestedRoundIndex;
  const rounds = Array.isArray(session?.event?.rounds) ? session.event.rounds : [];
  const roundResults = Array.isArray(session?.roundResults) ? session.roundResults : [];
  return Number.isInteger(requestedRoundIndex)
    && requestedRoundIndex >= 0
    && requestedRoundIndex < rounds.length
    && requestedRoundIndex < roundResults.length
    && requestedRoundIndex === context.roundIndex;
}

function blockedResult(reasonCode, context = {}) {
  return deepFreeze({
    allowed: false,
    blocked: true,
    reasonCode,
    roundIndex: context.roundIndex ?? -1,
    roundNumber: context.roundNumber ?? null,
    stationKey: context.stationKey ?? "",
    activeStationKeys: Array.isArray(context.activeStationKeys) ? [...context.activeStationKeys] : [],
    committedStationKeys: Array.isArray(context.committedStationKeys) ? [...context.committedStationKeys] : [],
    planningStatus: context.planningStatus ?? "",
    playerSafe: true,
    readOnly: true
  });
}

function playerSafeCommittedStationKeys(committedStationKeys = [], activeStationKeys = []) {
  const active = new Set(activeStationKeys);
  const seen = new Set();
  return committedStationKeys.filter((stationKey) => {
    if (!active.has(stationKey) || seen.has(stationKey)) return false;
    seen.add(stationKey);
    return true;
  });
}

/**
 * Purely checks whether current-round committed Crew Planning allows a station.
 *
 * This helper intentionally reads only the canonical round-local planning state at
 * session.roundResults[roundIndex].actionOrder. It never initializes, normalizes,
 * repairs, migrates, or writes planning state.
 */
export function prepareTravelV2StationActionPlanningGate(session = null, stationKey = "", options = {}) {
  const requestedStationKey = typeof stationKey === "string" ? stationKey.trim() : "";
  if (!isPlainObject(session)) return blockedResult(REASON_CODES.MISSING_SESSION, { stationKey: requestedStationKey });

  const context = currentRoundContext(session);
  if (!context.round) return blockedResult(REASON_CODES.MISSING_ROUND, { ...context, stationKey: requestedStationKey });
  if (!requestedRoundIsAuthorized(session, context, options)) {
    return blockedResult(REASON_CODES.WRONG_STATION_ACTION_ROUND, { ...context, stationKey: requestedStationKey });
  }

  const phaseContext = currentPhaseContext(session);
  if (phaseContext.phase !== ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STATION_ORDERS) {
    return blockedResult(REASON_CODES.INVALID_STATION_ACTION_PHASE, { ...context, stationKey: requestedStationKey });
  }

  const uniqueActive = Array.from(new Set(context.activeStationKeys));
  const activeValidation = normalizeTravelV2ProposedRoundActionOrder(uniqueActive, uniqueActive);
  if (context.activeStationKeys.length === 0 || uniqueActive.length !== context.activeStationKeys.length || !activeValidation.valid) {
    return blockedResult(REASON_CODES.INVALID_ACTIVE_STATIONS, { ...context, activeStationKeys: uniqueActive, stationKey: requestedStationKey });
  }

  const actionOrder = context.roundResult?.actionOrder;
  if (!isPlainObject(actionOrder)) return blockedResult(REASON_CODES.MISSING_PLANNING_STATE, { ...context, activeStationKeys: uniqueActive, stationKey: requestedStationKey });

  const committedStationKeys = Array.isArray(actionOrder.committedStationKeys) ? [...actionOrder.committedStationKeys] : [];
  const planningStatus = typeof actionOrder.status === "string" ? actionOrder.status : "";
  const safeCommittedStationKeys = playerSafeCommittedStationKeys(committedStationKeys, uniqueActive);
  const resultContext = { ...context, activeStationKeys: uniqueActive, committedStationKeys: safeCommittedStationKeys, planningStatus, stationKey: requestedStationKey };
  const stateRoundIndex = Number.isInteger(actionOrder.roundIndex) ? actionOrder.roundIndex : null;
  const stateRoundNumber = positiveIntegerValueOrNull(actionOrder.roundNumber);
  if (stateRoundIndex !== context.roundIndex || stateRoundNumber !== context.roundNumber) return blockedResult(REASON_CODES.STALE_PLANNING_ROUND, resultContext);
  if (planningStatus !== "committed") return blockedResult(REASON_CODES.PLANNING_NOT_COMMITTED, resultContext);

  const committedValidation = normalizeTravelV2ProposedRoundActionOrder(committedStationKeys, uniqueActive);
  if (!committedValidation.valid) return blockedResult(REASON_CODES.INVALID_COMMITTED_ORDER, resultContext);
  if (!uniqueActive.includes(requestedStationKey)) return blockedResult(REASON_CODES.STATION_NOT_ACTIVE, resultContext);
  if (!committedValidation.proposedStationKeys.includes(requestedStationKey)) return blockedResult(REASON_CODES.STATION_NOT_COMMITTED, resultContext);

  return deepFreeze({
    allowed: true,
    blocked: false,
    reasonCode: "",
    roundIndex: context.roundIndex,
    roundNumber: context.roundNumber,
    stationKey: requestedStationKey,
    activeStationKeys: uniqueActive,
    committedStationKeys: committedValidation.proposedStationKeys,
    planningStatus,
    playerSafe: true,
    readOnly: true
  });
}
