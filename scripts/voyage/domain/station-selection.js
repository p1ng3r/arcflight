import {
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES,
  VOYAGE_ROUND_PHASES
} from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyageEncounterState } from "./validation.js";
import { validateVoyageEncounterRiskBids } from "./risk-bids.js";

const UNSAFE_STATION_KEYS = new Set(["__proto__", "constructor", "prototype"]);
function deduplicateIssues(issues) {
  const seen = new Set();
  return issues.filter((entry) => {
    const identity = `${entry.code}\u0000${entry.path}\u0000${entry.message}\u0000${entry.severity}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}
function validationResult(validation) {
  return { errors: deduplicateIssues(validation.errors), warnings: deduplicateIssues(validation.warnings) };
}


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

function validateCrewPlanningMutationContext(encounterState) {
  const validation = validateVoyageEncounterStationSelections(encounterState);
  const bidValidation = validateVoyageEncounterRiskBids(encounterState);
  const combined = validationResult({ errors: [...validation.errors, ...bidValidation.errors], warnings: [...validation.warnings, ...bidValidation.warnings] });
  if (!validation.valid || !bidValidation.valid) return { ok: false, ...combined };
  const warnings = combined.warnings;

  const errors = [];
  if (encounterState.lifecycleState !== VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE) {
    issue(errors, "station-selection-requires-active", "lifecycleState", "Changing a Voyage station action selection requires an Active encounter.");
  } else if (encounterState.phase !== VOYAGE_ROUND_PHASES.CREW_PLANNING) {
    issue(errors, "station-selection-requires-crew-planning", "phase", "Changing a Voyage station action selection requires the Crew Planning phase.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

function validateStationIdRequest(request, errors, requestPath) {
  if (!isPlainObject(request)) {
    issue(errors, "invalid-station-selection-request", requestPath, "Voyage station selection request must be a plain object.");
    return false;
  }

  const validStationId = hasNonEmptyId(request.stationId);
  if (!validStationId) {
    issue(errors, "invalid-station-id", `${requestPath}.stationId`, "Voyage station selection requires a non-empty stationId.");
    return false;
  }
  if (!isSafeStationKey(request.stationId)) {
    issue(errors, "unsafe-station-selection-key", `${requestPath}.stationId`, "Voyage station selection requires a safe station map key.");
    return false;
  }
  return true;
}

function validateRequestedAction(encounterState, request, errors, requestPath) {
  const validActionId = hasNonEmptyId(request.actionId);
  if (!validActionId) {
    issue(errors, "invalid-action-id", `${requestPath}.actionId`, "Voyage station selection requires a non-empty actionId.");
    return;
  }

  const stationMatches = findAvailableStations(encounterState.availableStations, request.stationId);
  if (stationMatches.length === 0) {
    issue(errors, "station-not-available", `${requestPath}.stationId`, "Requested Voyage station is not currently available.");
    return;
  }
  if (stationMatches.length > 1) {
    issue(errors, "available-station-is-ambiguous", `${requestPath}.stationId`, "Requested Voyage station matches more than one available station.");
    return;
  }

  const { station, index } = stationMatches[0];
  if (!Array.isArray(station.actions)) {
    issue(errors, "invalid-available-station-actions", `availableStations[${index}].actions`, "Available Voyage station actions must be an array.");
    return;
  }

  const actionMatches = findAvailableActions(station.actions, request.actionId);
  if (actionMatches.length === 0) issue(errors, "station-action-not-available", `${requestPath}.actionId`, "Requested Voyage action is not available for the selected station.");
  if (actionMatches.length > 1) issue(errors, "station-action-is-ambiguous", `${requestPath}.actionId`, "Requested Voyage action matches more than one action for the selected station.");
}

function cloneSelectionCandidate(encounterState, errors, failureCode, message) {
  try {
    return clonePlainData(encounterState);
  } catch (_error) {
    issue(errors, failureCode, "encounterState", message);
    return null;
  }
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
  const riskValidation = validateVoyageEncounterRiskBids(encounterState);
  const warnings = [...riskValidation.warnings];
  if (!riskValidation.valid) return { ok: false, nextState: null, events: [], errors: riskValidation.errors, warnings: deduplicateIssues(warnings) };

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

  const candidate = cloneSelectionCandidate(
    encounterState,
    errors,
    "station-selection-candidate-construction-failed",
    "Voyage station selection could not clone encounter state."
  );
  if (!candidate) return { ok: false, nextState: null, events: [], errors, warnings };

  Object.defineProperty(candidate.selections, selectionRequest.stationId, {
    value: { stationId: selectionRequest.stationId, actionId: selectionRequest.actionId },
    enumerable: true,
    configurable: true,
    writable: true
  });
  candidate.revision = encounterState.revision + 1;

  const candidateValidation = validateVoyageEncounterRiskBids(candidate);
  warnings.push(...candidateValidation.warnings);
  if (!candidateValidation.valid) return { ok: false, nextState: null, events: [], errors: candidateValidation.errors, warnings: deduplicateIssues(warnings) };

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

/**
 * Atomically replace one existing Crew Planning station action selection.
 */
export function applyVoyageEncounterStationActionSelectionChange(encounterState, selectionRequest) {
  const context = validateCrewPlanningMutationContext(encounterState);
  if (!context.ok) return { ok: false, nextState: null, events: [], errors: context.errors, warnings: context.warnings };

  const errors = [];
  const warnings = [...context.warnings];
  const validStationId = validateStationIdRequest(selectionRequest, errors, "selectionRequest");
  if (validStationId) validateRequestedAction(encounterState, selectionRequest, errors, "selectionRequest");

  let previousSelection = null;
  if (validStationId) {
    if (!Object.hasOwn(encounterState.selections, selectionRequest.stationId)) {
      issue(errors, "station-selection-does-not-exist", `selections.${selectionRequest.stationId}`, "Voyage station does not have a selected action to change.");
    } else {
      previousSelection = encounterState.selections[selectionRequest.stationId];
      if (hasNonEmptyId(selectionRequest.actionId) && previousSelection.actionId === selectionRequest.actionId) {
        issue(errors, "station-selection-unchanged", "selectionRequest.actionId", "Requested Voyage station action is already selected.");
      }
    }
  }
  if (errors.length > 0) return { ok: false, nextState: null, events: [], errors, warnings };

  const candidate = cloneSelectionCandidate(
    encounterState,
    errors,
    "station-selection-change-candidate-construction-failed",
    "Voyage station selection change could not clone encounter state."
  );
  if (!candidate) return { ok: false, nextState: null, events: [], errors, warnings };

  candidate.selections[selectionRequest.stationId] = {
    stationId: selectionRequest.stationId,
    actionId: selectionRequest.actionId
  };
  const clearedRiskBidId = Object.hasOwn(candidate.riskBids, selectionRequest.stationId) ? candidate.riskBids[selectionRequest.stationId].riskBidId : null;
  if (clearedRiskBidId !== null) delete candidate.riskBids[selectionRequest.stationId];
  candidate.revision = encounterState.revision + 1;

  const candidateValidation = validateVoyageEncounterStationSelections(candidate);
  const candidateBids = validateVoyageEncounterRiskBids(candidate);
  warnings.push(...candidateValidation.warnings, ...candidateBids.warnings);
  const candidateIssues = validationResult({ errors: [...candidateValidation.errors, ...candidateBids.errors], warnings });
  if (!candidateValidation.valid || !candidateBids.valid) return { ok: false, nextState: null, events: [], ...candidateIssues };
  warnings.splice(0, warnings.length, ...candidateIssues.warnings);

  return {
    ok: true,
    nextState: candidate,
    events: [{
      type: "voyage.station-action-selection-changed",
      encounterId: candidate.encounterId,
      lifecycleState: VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE,
      roundNumber: candidate.roundNumber,
      phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
      stationId: selectionRequest.stationId,
      previousActionId: previousSelection.actionId,
      actionId: selectionRequest.actionId,
      ...(clearedRiskBidId !== null ? { clearedRiskBidId } : {}),
      previousRevision: encounterState.revision,
      revision: candidate.revision
    }],
    errors: [],
    warnings
  };
}

/**
 * Atomically clear one existing Crew Planning station action selection.
 */
export function applyVoyageEncounterStationActionSelectionClear(encounterState, clearRequest) {
  const context = validateCrewPlanningMutationContext(encounterState);
  if (!context.ok) return { ok: false, nextState: null, events: [], errors: context.errors, warnings: context.warnings };

  const errors = [];
  const warnings = [...context.warnings];
  const validStationId = validateStationIdRequest(clearRequest, errors, "clearRequest");

  let previousSelection = null;
  if (validStationId) {
    if (!Object.hasOwn(encounterState.selections, clearRequest.stationId)) {
      issue(errors, "station-selection-does-not-exist", `selections.${clearRequest.stationId}`, "Voyage station does not have a selected action to clear.");
    } else {
      previousSelection = encounterState.selections[clearRequest.stationId];
    }
  }
  if (errors.length > 0) return { ok: false, nextState: null, events: [], errors, warnings };

  const candidate = cloneSelectionCandidate(
    encounterState,
    errors,
    "station-selection-clear-candidate-construction-failed",
    "Voyage station selection clear could not clone encounter state."
  );
  if (!candidate) return { ok: false, nextState: null, events: [], errors, warnings };

  const clearedRiskBidId = Object.hasOwn(candidate.riskBids, clearRequest.stationId) ? candidate.riskBids[clearRequest.stationId].riskBidId : null;
  delete candidate.selections[clearRequest.stationId];
  if (clearedRiskBidId !== null) delete candidate.riskBids[clearRequest.stationId];
  candidate.revision = encounterState.revision + 1;

  const candidateValidation = validateVoyageEncounterStationSelections(candidate);
  const candidateBids = validateVoyageEncounterRiskBids(candidate);
  warnings.push(...candidateValidation.warnings, ...candidateBids.warnings);
  const candidateIssues = validationResult({ errors: [...candidateValidation.errors, ...candidateBids.errors], warnings });
  if (!candidateValidation.valid || !candidateBids.valid) return { ok: false, nextState: null, events: [], ...candidateIssues };
  warnings.splice(0, warnings.length, ...candidateIssues.warnings);

  return {
    ok: true,
    nextState: candidate,
    events: [{
      type: "voyage.station-action-selection-cleared",
      encounterId: candidate.encounterId,
      lifecycleState: VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE,
      roundNumber: candidate.roundNumber,
      phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
      stationId: clearRequest.stationId,
      actionId: previousSelection.actionId,
      ...(clearedRiskBidId !== null ? { clearedRiskBidId } : {}),
      previousRevision: encounterState.revision,
      revision: candidate.revision
    }],
    errors: [],
    warnings
  };
}
