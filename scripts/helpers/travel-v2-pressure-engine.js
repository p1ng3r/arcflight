import {
  applyTravelV2PressureChange as applyTravelV2StatePressureChange,
  createTravelV2HazardDrawRequest,
  normalizeTravelV2PressureType,
  normalizeTravelV2SessionState,
  previewTravelV2PressureChange,
  TRAVEL_V2_PRESSURE_TRACK_KEYS
} from "./travel-v2-state.js";

export const TRAVEL_V2_PRESSURE_ENGINE_VERSION = 1;
export const TRAVEL_V2_PRESSURE_CHANGE_SOURCES = Object.freeze({
  HIDDEN_RISK: "hiddenRisk",
  MANUAL: "manual",
  ROUND_OUTCOME: "roundOutcome",
  STABILIZE: "stabilize"
});

export const TRAVEL_V2_PRESSURE_RESULT_DEGREES = Object.freeze([
  "criticalSuccess",
  "success",
  "failure",
  "criticalFailure",
  "skipped"
]);

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

function normalizeResultDegree(value) {
  if (value === 3 || value === "3" || value === "critical-success" || value === "criticalSuccess") return "criticalSuccess";
  if (value === 2 || value === "2" || value === "success") return "success";
  if (value === 1 || value === "1" || value === "failure") return "failure";
  if (value === 0 || value === "0" || value === "critical-failure" || value === "criticalFailure") return "criticalFailure";
  if (value === "skipped") return "skipped";
  return "skipped";
}

function normalizeRoundNumber(value) {
  return value == null ? null : Math.max(1, integerValue(value, 1));
}

function normalizePressureAmount(value) {
  return integerValue(value, 0);
}

function normalizePressureChangeSource(value) {
  const source = stringValue(value, TRAVEL_V2_PRESSURE_CHANGE_SOURCES.MANUAL).trim();
  return source || TRAVEL_V2_PRESSURE_CHANGE_SOURCES.MANUAL;
}

export function createTravelV2PressureChangeRequest(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return {
    pressureType: normalizeTravelV2PressureType(source.pressureType),
    amount: normalizePressureAmount(source.amount ?? source.delta ?? source.value),
    source: normalizePressureChangeSource(source.source),
    reason: stringValue(source.reason),
    roundNumber: normalizeRoundNumber(source.roundNumber),
    stationKey: stringValue(source.stationKey),
    actorUuid: stringValue(source.actorUuid),
    note: stringValue(source.note).trim()
  };
}

export function createTravelV2PressureNoopResult(sessionInput = {}, warnings = []) {
  return {
    ok: true,
    session: normalizeTravelV2SessionState(sessionInput),
    changes: [],
    hazardDraws: [],
    shipScarTriggers: [],
    warnings: Array.isArray(warnings) ? warnings.filter((entry) => typeof entry === "string") : []
  };
}

export function previewTravelV2PressureChangeRequest(sessionInput = {}, requestInput = {}) {
  const session = normalizeTravelV2SessionState(sessionInput);
  const request = createTravelV2PressureChangeRequest(requestInput);
  const preview = previewTravelV2PressureChange(session.pressure, request.pressureType, request.amount, {
    reason: request.reason || request.source,
    roundNumber: request.roundNumber,
    source: request.source
  });
  return {
    request,
    preview,
    change: {
      ...request,
      previousValue: preview.previousValue,
      requestedValue: preview.requestedValue,
      value: preview.value,
      thresholdCrossings: preview.thresholdCrossings,
      hazardDraws: preview.hazardDraws,
      shipScarTrigger: preview.shipScarTrigger,
      overflowAmount: preview.overflowAmount
    }
  };
}

export function applyTravelV2PressureChangeRequest(sessionInput = {}, requestInput = {}) {
  const session = normalizeTravelV2SessionState(sessionInput);
  const { request, preview, change } = previewTravelV2PressureChangeRequest(session, requestInput);
  if (request.amount === 0) {
    return {
      ok: true,
      session,
      changes: [change],
      hazardDraws: [],
      shipScarTriggers: [],
      warnings: []
    };
  }

  const nextSession = applyTravelV2StatePressureChange(session, request.pressureType, request.amount, {
    reason: request.reason || request.source,
    roundNumber: request.roundNumber,
    source: request.source
  });

  return {
    ok: true,
    session: nextSession,
    changes: [change],
    hazardDraws: preview.hazardDraws,
    shipScarTriggers: preview.shipScarTrigger ? [preview.shipScarTrigger] : [],
    warnings: []
  };
}

export function applyTravelV2PressureChanges(sessionInput = {}, requestInputs = []) {
  let session = normalizeTravelV2SessionState(sessionInput);
  const changes = [];
  const hazardDraws = [];
  const shipScarTriggers = [];
  const warnings = [];

  for (const requestInput of Array.isArray(requestInputs) ? requestInputs : []) {
    const result = applyTravelV2PressureChangeRequest(session, requestInput);
    session = result.session;
    changes.push(...result.changes);
    hazardDraws.push(...result.hazardDraws);
    shipScarTriggers.push(...result.shipScarTriggers);
    warnings.push(...result.warnings);
  }

  return { ok: true, session, changes, hazardDraws, shipScarTriggers, warnings };
}

export function getTravelV2HiddenRiskPressureAmount(resultDegreeInput, hiddenRiskInput = {}) {
  const resultDegree = normalizeResultDegree(resultDegreeInput);
  const hiddenRisk = isPlainObject(hiddenRiskInput) ? hiddenRiskInput : {};
  if (resultDegree === "criticalFailure") return Math.max(0, integerValue(hiddenRisk.criticalFailureIncrease, 2));
  if (resultDegree === "failure") return Math.max(0, integerValue(hiddenRisk.failureIncrease, 1));
  return 0;
}

export function createTravelV2HiddenRiskPressureChange(sessionInput = {}, resultDegreeInput = "skipped", options = {}) {
  const session = normalizeTravelV2SessionState(sessionInput);
  const hiddenRisk = isPlainObject(options.hiddenRisk) ? options.hiddenRisk : session.hiddenRisk;
  const resultDegree = normalizeResultDegree(resultDegreeInput);
  const amount = getTravelV2HiddenRiskPressureAmount(resultDegree, hiddenRisk);
  return createTravelV2PressureChangeRequest({
    pressureType: hiddenRisk?.pressureType,
    amount,
    source: TRAVEL_V2_PRESSURE_CHANGE_SOURCES.HIDDEN_RISK,
    reason: resultDegree === "criticalFailure" ? "critical-failure-hidden-risk" : (resultDegree === "failure" ? "failure-hidden-risk" : "no-hidden-risk-pressure"),
    roundNumber: options.roundNumber ?? session.round?.number,
    stationKey: hiddenRisk?.pressureStation ?? options.stationKey,
    note: stringValue(options.note)
  });
}

export function applyTravelV2HiddenRiskPressure(sessionInput = {}, resultDegreeInput = "skipped", options = {}) {
  const session = normalizeTravelV2SessionState(sessionInput);
  const request = createTravelV2HiddenRiskPressureChange(session, resultDegreeInput, options);
  if (request.amount <= 0) return createTravelV2PressureNoopResult(session);
  return applyTravelV2PressureChangeRequest(session, request);
}

export function applyTravelV2ManualPressureChange(sessionInput = {}, pressureType, amount, options = {}) {
  return applyTravelV2PressureChangeRequest(sessionInput, {
    pressureType,
    amount,
    source: TRAVEL_V2_PRESSURE_CHANGE_SOURCES.MANUAL,
    reason: options.reason,
    roundNumber: options.roundNumber,
    stationKey: options.stationKey,
    note: options.note
  });
}

export function clearTravelV2PendingHazardDraws(sessionInput = {}, predicate = null) {
  const session = normalizeTravelV2SessionState(sessionInput);
  const shouldClear = typeof predicate === "function" ? predicate : () => true;
  const pendingDraws = [];
  const cleared = [];
  for (const draw of session.hazards.pendingDraws) {
    if (shouldClear(draw)) cleared.push(draw);
    else pendingDraws.push(draw);
  }
  return {
    ok: true,
    session: {
      ...session,
      hazards: {
        ...session.hazards,
        pendingDraws
      }
    },
    cleared,
    warnings: []
  };
}

export function createTravelV2HazardDrawRequestsForCurrentPressure(sessionInput = {}) {
  const session = normalizeTravelV2SessionState(sessionInput);
  return TRAVEL_V2_PRESSURE_TRACK_KEYS.flatMap((pressureType) => {
    const track = session.pressure[pressureType];
    return (track?.crossed ?? []).map((threshold) => createTravelV2HazardDrawRequest({
      pressureType,
      threshold,
      reason: "current-pressure-threshold",
      roundNumber: session.round?.number
    }));
  });
}
