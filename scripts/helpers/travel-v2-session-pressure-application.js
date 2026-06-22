import { applyTravelV2PressureChanges } from "./travel-v2-pressure-engine.js";
import { prepareTravelV2PressureApplicationState } from "./travel-v2-pressure-application-state.js";
import { TRAVEL_V2_ROUND_OUTCOME_KEYS } from "./travel-v2-round-pressure-adapter.js";
import { drawTravelV2HazardsForPressureResult } from "./travel-v2-hazards.js";
import { drawTravelV2ShipScarsForPressureResult } from "./travel-v2-ship-scars.js";

export const TRAVEL_V2_SESSION_PRESSURE_APPLICATION_VERSION = 1;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneData(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function selectedOutcomeKeyFromOptions(options = {}) {
  return typeof options.selectedOutcomeKey === "string" && options.selectedOutcomeKey.trim()
    ? options.selectedOutcomeKey.trim()
    : TRAVEL_V2_ROUND_OUTCOME_KEYS.MIXED;
}

function createdAtFromOptions(options = {}) {
  if (typeof options.createdAt === "string" && options.createdAt.trim()) return options.createdAt.trim();
  if (typeof options.now === "string" && options.now.trim()) return options.now.trim();
  if (typeof options.now === "function") {
    const value = options.now();
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value instanceof Date) return value.toISOString();
  }
  return new Date().toISOString();
}

function createApplicationRecord(applicationStateBefore = {}, pressureResult = {}, options = {}) {
  const selectedRow = applicationStateBefore.selectedRow ?? {};
  return {
    roundIndex: applicationStateBefore.roundIndex,
    roundNumber: applicationStateBefore.roundNumber,
    outcomeKey: applicationStateBefore.selectedOutcomeKey,
    requestCount: selectedRow.requestCount ?? (Array.isArray(selectedRow.requests) ? selectedRow.requests.length : 0),
    totalsByPressureType: cloneData(selectedRow.totalsByPressureType ?? {}),
    createdAt: createdAtFromOptions(options),
    helperVersion: TRAVEL_V2_SESSION_PRESSURE_APPLICATION_VERSION,
    pressureChangeCount: Array.isArray(pressureResult.changes) ? pressureResult.changes.length : 0
  };
}

function appendApplicationRecord(session = {}, applicationRecord = {}) {
  const existingContainer = session.travelV2PressureApplications;
  const existingRecords = Array.isArray(existingContainer)
    ? existingContainer
    : (Array.isArray(existingContainer?.records) ? existingContainer.records : []);
  return {
    ...session,
    travelV2PressureApplications: {
      ...(isPlainObject(existingContainer) ? existingContainer : {}),
      records: [...cloneData(existingRecords), cloneData(applicationRecord)]
    }
  };
}

function blockedResult(session, applicationStateBefore, selectedOutcomeKey, error = "Travel v2 pressure application is blocked for this runner session.") {
  return {
    ok: false,
    applied: false,
    session,
    applicationStateBefore,
    selectedOutcomeKey,
    blockedReasons: cloneData(applicationStateBefore?.blockedReasons ?? [error]),
    error
  };
}

export function applyTravelV2PressureToRunnerSession(session, options = {}) {
  const selectedOutcomeKey = selectedOutcomeKeyFromOptions(options);
  const applicationStateBefore = prepareTravelV2PressureApplicationState(session, { ...options, selectedOutcomeKey });

  if (applicationStateBefore.canApply !== true) {
    return blockedResult(session, applicationStateBefore, selectedOutcomeKey, applicationStateBefore.blockedReasons[0]);
  }

  const clonedSession = cloneData(session);
  const requests = cloneData(applicationStateBefore.selectedRow?.requests ?? []);
  const pressureResult = applyTravelV2PressureChanges(clonedSession, requests);
  const updatedSession = {
    ...clonedSession,
    pressure: cloneData(pressureResult.session.pressure)
  };
  const hazardResult = drawTravelV2HazardsForPressureResult(updatedSession, pressureResult, options);
  const shipScarResult = drawTravelV2ShipScarsForPressureResult(hazardResult.session, pressureResult, options);
  const applicationRecord = createApplicationRecord(applicationStateBefore, pressureResult, options);
  const sessionWithRecord = appendApplicationRecord(shipScarResult.session, applicationRecord);

  return {
    ok: true,
    applied: true,
    session: sessionWithRecord,
    applicationRecord,
    applicationStateBefore,
    selectedOutcomeKey,
    pressureResult,
    hazardDraws: hazardResult.drawn,
    shipScarDraws: shipScarResult.drawn
  };
}

export default applyTravelV2PressureToRunnerSession;
