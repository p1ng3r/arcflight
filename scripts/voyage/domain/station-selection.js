import {
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES,
  VOYAGE_ROUND_PHASES
} from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyageEncounterState } from "./validation.js";

const UNSAFE_STATION_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function issue(errors, code, path, message) {
  errors.push({ code, path, message, severity: "error" });
}

function hasNonEmptyId(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isSafeStationKey(stationId) {
  return !UNSAFE_STATION_KEYS.has(stationId);
}

function findAvailableStations(availableStations, stationId) {
  const matches = [];
  availableStations.forEach((station, index) => {
    if (isPlainObject(station) && station.stationId === stationId) matches.push({ station, index });
  });
  return matches;
}

function findAvailableActions(actions, actionId) {
  const matches = [];
  actions.forEach((action, index) => {
    if (isPlainObject(action) && action.actionId === actionId) matches.push({ action, index });
  });
  return matches;
}

/**
 * Validate persisted, encounter-local Voyage station action selections.
 */
export function validateVoyageEncounterStationSelections(encounterState) {
  const stateValidation = validateVoyageEncounterState(encounterState);
  if (!stateValidation.valid) {
    return { valid: false, errors: stateValidation.errors, warnings: [...stateValidation.warnings] };
  }

  const errors = [];
  const warnings = [...stateValidation.warnings];
  for (const stationKey of Object.keys(encounterState.selections)) {
    const selectionPath = `selections.${stationKey}`;
    if (!isSafeStationKey(stationKey)) {
      issue(errors, "unsafe-station-selection-key", selectionPath, "Stored Voyage station selection uses an unsafe station key.");
      continue;
    }

    const selection = encounterState.selections[stationKey];
    if (!isPlainObject(selection)) {
      issue(errors, "invalid-station-selection", selectionPath, "Voyage station selection must be a plain object.");
      continue;
    }

    const validStationId = hasNonEmptyId(selection.stationId);
    if (!validStationId) issue(errors, "invalid-selection-station-id", `${selectionPath}.stationId`, "Voyage station selection requires a non-empty stationId.");
    if (validStationId && selection.stationId !== stationKey) issue(errors, "selection-station-key-mismatch", `${selectionPath}.stationId`, "Voyage station selection stationId must match its selections map key.");

    const validActionId = hasNonEmptyId(selection.actionId);
    if (!validActionId) issue(errors, "invalid-selection-action-id", `${selectionPath}.actionId`, "Voyage station selection requires a non-empty actionId.");
    if (!validStationId || selection.stationId !== stationKey || !validActionId) continue;

    const stationMatches = findAvailableStations(encounterState.availableStations, selection.stationId);
    if (stationMatches.length === 0) {
      issue(errors, "selected-station-not-available", `${selectionPath}.stationId`, "Stored Voyage station selection references a station that is not available.");
      continue;
    }
    if (stationMatches.length > 1) {
      issue(errors, "selected-station-is-ambiguous", `${selectionPath}.stationId`, "Stored Voyage station selection references an ambiguous available station.");
      continue;
    }

    const { station, index } = stationMatches[0];
    if (!Array.isArray(station.actions)) {
      issue(errors, "invalid-available-station-actions", `availableStations[${index}].actions`, "Available Voyage station actions must be an array.");
      continue;
    }
    const actionMatches = findAvailableActions(station.actions, selection.actionId);
    if (actionMatches.length === 0) issue(errors, "selected-action-not-available", `${selectionPath}.actionId`, "Stored Voyage station selection references an action that is not available for its station.");
    if (actionMatches.length > 1) issue(errors, "selected-action-is-ambiguous", `${selectionPath}.actionId`, "Stored Voyage station selection references an ambiguous station action.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Atomically add one initial, encounter-local Voyage station action selection.
 */
export function applyVoyageEncounterStationActionSelection(encounterState, selectionRequest) {
  const validation = validateVoyageEncounterStationSelections(encounterState);
  const warnings = [...validation.warnings];
  if (!validation.valid) return { ok: false, nextState: null, events: [], errors: validation.errors, warnings };

  if (encounterState.lifecycleState !== VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE) {
    const errors = [];
    issue(errors, "station-selection-requires-active", "lifecycleState", "Selecting a Voyage station action requires an Active encounter.");
    return { ok: false, nextState: null, events: [], errors, warnings };
  }
  if (encounterState.phase !== VOYAGE_ROUND_PHASES.CREW_PLANNING) {
    const errors = [];
    issue(errors, "station-selection-requires-crew-planning", "phase", "Selecting a Voyage station action requires the Crew Planning phase.");
    return { ok: false, nextState: null, events: [], errors, warnings };
  }

  const errors = [];
  if (!isPlainObject(selectionRequest)) {
    issue(errors, "invalid-station-selection-request", "selectionRequest", "Voyage station selection request must be a plain object.");
    return { ok: false, nextState: null, events: [], errors, warnings };
  }

  const validStationId = hasNonEmptyId(selectionRequest.stationId);
  if (!validStationId) issue(errors, "invalid-station-id", "selectionRequest.stationId", "Voyage station selection requires a non-empty stationId.");
  const safeStationId = validStationId && isSafeStationKey(selectionRequest.stationId);
  if (validStationId && !safeStationId) issue(errors, "unsafe-station-selection-key", "selectionRequest.stationId", "Voyage station selection requires a safe station map key.");
  const validActionId = hasNonEmptyId(selectionRequest.actionId);
  if (!validActionId) issue(errors, "invalid-action-id", "selectionRequest.actionId", "Voyage station selection requires a non-empty actionId.");

  let matchingStation = null;
  if (safeStationId) {
    const stationMatches = findAvailableStations(encounterState.availableStations, selectionRequest.stationId);
    if (stationMatches.length === 0) issue(errors, "station-not-available", "selectionRequest.stationId", "Requested Voyage station is not currently available.");
    if (stationMatches.length > 1) issue(errors, "available-station-is-ambiguous", "selectionRequest.stationId", "Requested Voyage station matches more than one available station.");
    if (stationMatches.length === 1) matchingStation = stationMatches[0];
  }

  if (matchingStation && validActionId) {
    const { station, index } = matchingStation;
    if (!Array.isArray(station.actions)) {
      issue(errors, "invalid-available-station-actions", `availableStations[${index}].actions`, "Available Voyage station actions must be an array.");
    } else {
      const actionMatches = findAvailableActions(station.actions, selectionRequest.actionId);
      if (actionMatches.length === 0) issue(errors, "station-action-not-available", "selectionRequest.actionId", "Requested Voyage action is not available for the selected station.");
      if (actionMatches.length > 1) issue(errors, "station-action-is-ambiguous", "selectionRequest.actionId", "Requested Voyage action matches more than one action for the selected station.");
    }
  }

  if (safeStationId && Object.hasOwn(encounterState.selections, selectionRequest.stationId)) {
    issue(errors, "station-selection-already-exists", `selections.${selectionRequest.stationId}`, "Voyage station already has a selected action.");
  }
  if (errors.length > 0) return { ok: false, nextState: null, events: [], errors, warnings };

  let candidate;
  try {
    candidate = clonePlainData(encounterState);
  } catch (_error) {
    issue(errors, "station-selection-candidate-construction-failed", "encounterState", "Voyage station selection could not clone encounter state.");
    return { ok: false, nextState: null, events: [], errors, warnings };
  }

  Object.defineProperty(candidate.selections, selectionRequest.stationId, {
    value: { stationId: selectionRequest.stationId, actionId: selectionRequest.actionId },
    enumerable: true,
    configurable: true,
    writable: true
  });
  candidate.revision = encounterState.revision + 1;

  const candidateValidation = validateVoyageEncounterStationSelections(candidate);
  warnings.push(...candidateValidation.warnings);
  if (!candidateValidation.valid) return { ok: false, nextState: null, events: [], errors: candidateValidation.errors, warnings };

  return {
    ok: true,
    nextState: candidate,
    events: [{
      type: "voyage.station-action-selected",
      encounterId: candidate.encounterId,
      lifecycleState: VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE,
      roundNumber: candidate.roundNumber,
      phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
      stationId: selectionRequest.stationId,
      actionId: selectionRequest.actionId,
      previousRevision: encounterState.revision,
      revision: candidate.revision
    }],
    errors: [],
    warnings
  };
}
