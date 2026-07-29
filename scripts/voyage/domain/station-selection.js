import {
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES,
  VOYAGE_ROUND_PHASES
} from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { deriveOccupiedVoyageStationIds } from "./station-assignments.js";
import { validateVoyageEncounterState } from "./validation.js";
import { validateVoyageEncounterRiskBids } from "./risk-bids.js";

const UNSAFE_STATION_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const APPROACH_SELECTION_FIELDS = ["approachId", "statisticSlugOrAbilityId", "noRoll"];
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

function readOwnDataProperty(value, key, path, errors) {
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    issue(
      errors,
      "station-selection-data-read-failed",
      path,
      "Voyage station selection data could not be read safely."
    );
    return { present: true, ok: false, value: undefined };
  }

  if (!descriptor) return { present: false, ok: true, value: undefined };
  if (!Object.hasOwn(descriptor, "value")) {
    issue(
      errors,
      "station-selection-data-read-failed",
      path,
      "Voyage station selection properties must be own data properties."
    );
    return { present: true, ok: false, value: undefined };
  }

  return { present: true, ok: true, value: descriptor.value };
}

function inspectPlainObject(value, path, errors) {
  try {
    return { ok: true, plain: isPlainObject(value) };
  } catch {
    issue(
      errors,
      "station-selection-data-read-failed",
      path,
      "Voyage station selection data could not be inspected safely."
    );
    return { ok: false, plain: false };
  }
}

function validateExactSafeId(value, path, errors, codes, label) {
  if (!hasNonEmptyId(value)) {
    issue(errors, codes.invalid, path, `${label} must be a non-empty exact string.`);
    return false;
  }
  if (!isSafeStationKey(value)) {
    issue(errors, codes.unsafe, path, `${label} must be safe.`);
    return false;
  }
  return true;
}

function validatePersistedApproachFields(selection, selectionPath, errors) {
  const reads = Object.create(null);
  for (const field of APPROACH_SELECTION_FIELDS) {
    reads[field] = readOwnDataProperty(selection, field, `${selectionPath}.${field}`, errors);
  }
  const committed = APPROACH_SELECTION_FIELDS.some((field) => reads[field].present);
  if (!committed) return { committed: false, valid: true, reads };

  let valid = APPROACH_SELECTION_FIELDS.every((field) => reads[field].ok);
  const approachIdRead = reads.approachId;
  if (!approachIdRead.present) {
    issue(errors, "missing-selection-approach-id", `${selectionPath}.approachId`, "Committed Voyage station approach requires an own approachId.");
    valid = false;
  } else if (approachIdRead.ok) {
    valid = validateExactSafeId(
      approachIdRead.value,
      `${selectionPath}.approachId`,
      errors,
      { invalid: "invalid-selection-approach-id", unsafe: "unsafe-selection-approach-id" },
      "Committed Voyage station approach ID"
    ) && valid;
  }

  const statisticRead = reads.statisticSlugOrAbilityId;
  const noRollRead = reads.noRoll;
  if (statisticRead.present && noRollRead.present) {
    issue(errors, "ambiguous-selection-approach-execution-identity", selectionPath, "Committed Voyage station approach must not own both execution identities.");
    valid = false;
  } else if (!statisticRead.present && !noRollRead.present) {
    issue(errors, "missing-selection-approach-execution-identity", selectionPath, "Committed Voyage station approach requires exactly one own execution identity.");
    valid = false;
  } else if (statisticRead.present && statisticRead.ok) {
    valid = validateExactSafeId(
      statisticRead.value,
      `${selectionPath}.statisticSlugOrAbilityId`,
      errors,
      {
        invalid: "invalid-selection-statistic-or-ability-id",
        unsafe: "unsafe-selection-statistic-or-ability-id"
      },
      "Committed Voyage statistic or ability identity"
    ) && valid;
  } else if (noRollRead.present && noRollRead.ok && noRollRead.value !== true) {
    issue(errors, "invalid-selection-no-roll-identity", `${selectionPath}.noRoll`, "Committed Voyage no-roll identity must be exactly true.");
    valid = false;
  }

  return { committed, valid, reads };
}

export function analyzeAuthoredVoyageStationApproaches(action, actionPath, selectedApproachId, errors) {
  const approachesPath = `${actionPath}.approaches`;
  const approachesRead = readOwnDataProperty(action, "approaches", approachesPath, errors);
  if (!approachesRead.present) {
    issue(errors, "missing-authored-approaches", approachesPath, "Selected Voyage action requires an own approaches array.");
    return { valid: false, matches: [] };
  }
  if (!approachesRead.ok) return { valid: false, matches: [] };

  let approachesIsArray;
  try {
    approachesIsArray = Array.isArray(approachesRead.value);
  } catch {
    issue(errors, "station-selection-data-read-failed", approachesPath, "Selected Voyage action approaches could not be inspected safely.");
    return { valid: false, matches: [] };
  }
  if (!approachesIsArray) {
    issue(errors, "invalid-authored-approaches", approachesPath, "Selected Voyage action approaches must be an array.");
    return { valid: false, matches: [] };
  }

  const lengthRead = readOwnDataProperty(approachesRead.value, "length", `${approachesPath}.length`, errors);
  if (!lengthRead.ok || !lengthRead.present) return { valid: false, matches: [] };

  let valid = true;
  const matches = [];
  const approachIdCounts = new Map();
  for (let approachIndex = 0; approachIndex < lengthRead.value; approachIndex += 1) {
    const approachPath = `${approachesPath}[${approachIndex}]`;
    const approachRead = readOwnDataProperty(approachesRead.value, approachIndex, approachPath, errors);
    if (!approachRead.present) {
      issue(errors, "sparse-authored-approaches", approachPath, "Selected Voyage action approaches must be a dense own-entry array.");
      valid = false;
      continue;
    }
    if (!approachRead.ok) {
      valid = false;
      continue;
    }

    const plainInspection = inspectPlainObject(approachRead.value, approachPath, errors);
    if (!plainInspection.ok) {
      valid = false;
      continue;
    }
    if (!plainInspection.plain) {
      issue(errors, "invalid-authored-approach", approachPath, "Each selected Voyage action approach must be a plain object.");
      valid = false;
      continue;
    }

    const approachIdPath = `${approachPath}.approachId`;
    const approachIdRead = readOwnDataProperty(approachRead.value, "approachId", approachIdPath, errors);
    let approachIdValid = true;
    if (!approachIdRead.present) {
      issue(errors, "missing-authored-approach-id", approachIdPath, "Each selected Voyage action approach requires an own approachId.");
      approachIdValid = false;
      valid = false;
    } else if (!approachIdRead.ok) {
      approachIdValid = false;
      valid = false;
    } else {
      approachIdValid = validateExactSafeId(
        approachIdRead.value,
        approachIdPath,
        errors,
        { invalid: "invalid-authored-approach-id", unsafe: "unsafe-authored-approach-id" },
        "Authored Voyage approach ID"
      );
      if (!approachIdValid) {
        valid = false;
      } else {
        const count = (approachIdCounts.get(approachIdRead.value) ?? 0) + 1;
        approachIdCounts.set(approachIdRead.value, count);
        if (count > 1) {
          issue(errors, "duplicate-authored-approach-id", approachIdPath, "Authored Voyage approach IDs must be unique within the selected action.");
          valid = false;
        }
      }
    }

    const statisticPath = `${approachPath}.statisticSlugOrAbilityId`;
    const noRollPath = `${approachPath}.noRoll`;
    const statisticRead = readOwnDataProperty(approachRead.value, "statisticSlugOrAbilityId", statisticPath, errors);
    const noRollRead = readOwnDataProperty(approachRead.value, "noRoll", noRollPath, errors);
    let executionKind = null;
    let executionValid = statisticRead.ok && noRollRead.ok;
    if (!executionValid) {
      valid = false;
    } else if (statisticRead.present && noRollRead.present) {
      issue(errors, "ambiguous-authored-approach-execution-identity", approachPath, "Authored Voyage approach must not define both execution identities.");
      executionValid = false;
      valid = false;
    } else if (!statisticRead.present && !noRollRead.present) {
      issue(errors, "missing-authored-approach-execution-identity", approachPath, "Authored Voyage approach requires exactly one execution identity.");
      executionValid = false;
      valid = false;
    } else if (statisticRead.present) {
      executionValid = validateExactSafeId(
        statisticRead.value,
        statisticPath,
        errors,
        {
          invalid: "invalid-authored-statistic-or-ability-id",
          unsafe: "unsafe-authored-statistic-or-ability-id"
        },
        "Authored Voyage statistic or ability identity"
      );
      if (!executionValid) {
        valid = false;
      } else {
        executionKind = "statistic-or-ability";
      }
    } else if (noRollRead.value !== true) {
      issue(errors, "invalid-authored-no-roll-identity", noRollPath, "Authored Voyage no-roll identity must be exactly true.");
      executionValid = false;
      valid = false;
    } else {
      executionKind = "no-roll";
    }

    if (approachIdValid && approachIdRead.value === selectedApproachId) {
      matches.push({
        executionKind,
        executionValid,
        statisticSlugOrAbilityId: statisticRead.value
      });
    }
  }

  return { valid, matches };
}

function validateCommittedApproach(
  selection,
  selectionPath,
  action,
  actionPath,
  errors
) {
  const persisted = validatePersistedApproachFields(selection, selectionPath, errors);
  if (!persisted.committed || !persisted.valid) return;

  const approachId = persisted.reads.approachId.value;
  const authored = analyzeAuthoredVoyageStationApproaches(action, actionPath, approachId, errors);
  if (authored.matches.length === 0) {
    if (authored.valid) {
      issue(errors, "selected-approach-not-available", `${selectionPath}.approachId`, "Stored Voyage station selection references an approach that is not available for its action.");
    }
    return;
  }
  if (authored.matches.length > 1) {
    issue(errors, "selected-approach-is-ambiguous", `${selectionPath}.approachId`, "Stored Voyage station selection references an ambiguous authored approach.");
    return;
  }
  if (!authored.valid || !authored.matches[0].executionValid) return;

  const authoredApproach = authored.matches[0];
  const statisticRead = persisted.reads.statisticSlugOrAbilityId;
  const noRollRead = persisted.reads.noRoll;
  if (authoredApproach.executionKind === "statistic-or-ability") {
    if (!statisticRead.present) {
      issue(errors, "selection-approach-execution-mismatch", `${selectionPath}.noRoll`, "Stored Voyage no-roll identity does not match the authored statistic or ability approach.");
    } else if (statisticRead.value !== authoredApproach.statisticSlugOrAbilityId) {
      issue(errors, "selection-statistic-or-ability-id-mismatch", `${selectionPath}.statisticSlugOrAbilityId`, "Stored Voyage statistic or ability identity must exactly match the authored approach.");
    }
  } else if (!noRollRead.present) {
    issue(errors, "selection-approach-execution-mismatch", `${selectionPath}.statisticSlugOrAbilityId`, "Stored Voyage statistic or ability identity does not match the authored no-roll approach.");
  }
}

function isOccupiedStation(encounterState, stationId) {
  return deriveOccupiedVoyageStationIds(encounterState.stationAssignments).includes(stationId);
}

function findAvailableStations(availableStations, stationId) {
  const matches = [];
  for (let index = 0; index < availableStations.length; index += 1) {
    if (!Object.hasOwn(availableStations, index)) continue;
    const station = availableStations[index];
    if (isPlainObject(station) && station.stationId === stationId) matches.push({ station, index });
  }
  return matches;
}

function findAvailableActions(actions, actionId) {
  const matches = [];
  for (let index = 0; index < actions.length; index += 1) {
    if (!Object.hasOwn(actions, index)) continue;
    const action = actions[index];
    if (isPlainObject(action) && action.actionId === actionId) matches.push({ action, index });
  }
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
  if (!isOccupiedStation(encounterState, request.stationId)) {
    issue(errors, "station-not-occupied", `${requestPath}.stationId`, "Requested Voyage station is not occupied for this event.");
    return;
  }
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
    if (!isOccupiedStation(encounterState, selection.stationId)) {
      issue(errors, "selected-station-not-occupied", `${selectionPath}.stationId`, "Stored Voyage station selection references an unoccupied station.");
      continue;
    }

    const { station, index } = stationMatches[0];
    if (!Array.isArray(station.actions)) {
      issue(errors, "invalid-available-station-actions", `availableStations[${index}].actions`, "Available Voyage station actions must be an array.");
      continue;
    }
    const actionMatches = findAvailableActions(station.actions, selection.actionId);
    if (actionMatches.length === 0) {
      issue(errors, "selected-action-not-available", `${selectionPath}.actionId`, "Stored Voyage station selection references an action that is not available for its station.");
      continue;
    }
    if (actionMatches.length > 1) {
      issue(errors, "selected-action-is-ambiguous", `${selectionPath}.actionId`, "Stored Voyage station selection references an ambiguous station action.");
      continue;
    }

    const { action, index: actionIndex } = actionMatches[0];
    validateCommittedApproach(
      selection,
      selectionPath,
      action,
      `availableStations[${index}].actions[${actionIndex}]`,
      errors
    );
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

  const occupiedStation = matchingStation && isOccupiedStation(encounterState, selectionRequest.stationId);
  if (matchingStation && !occupiedStation) {
    issue(errors, "station-not-occupied", "selectionRequest.stationId", "Requested Voyage station is not occupied for this event.");
  }

  if (matchingStation && occupiedStation && validActionId) {
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
  const occupiedStation = validStationId && isOccupiedStation(encounterState, selectionRequest.stationId);

  let previousSelection = null;
  if (validStationId && occupiedStation) {
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
  const clearedApproachId = Object.hasOwn(previousSelection, "approachId") ? previousSelection.approachId : null;
  const clearedRiskBid = Object.hasOwn(candidate.riskBids, selectionRequest.stationId)
    ? candidate.riskBids[selectionRequest.stationId]
    : null;
  const clearedRiskBidId = clearedRiskBid?.riskBidId ?? null;
  const clearedRiskBidDcAdjustment = clearedRiskBid?.dcAdjustment ?? null;
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
      ...(clearedApproachId !== null ? { clearedApproachId } : {}),
      ...(clearedRiskBidId !== null ? { clearedRiskBidId } : {}),
      ...(clearedRiskBidDcAdjustment !== null ? { clearedRiskBidDcAdjustment } : {}),
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
  const occupiedStation = validStationId && isOccupiedStation(encounterState, clearRequest.stationId);
  if (validStationId && !occupiedStation) {
    issue(errors, "station-not-occupied", "clearRequest.stationId", "Requested Voyage station is not occupied for this event.");
  }

  let previousSelection = null;
  if (validStationId && occupiedStation) {
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

  const clearedApproachId = Object.hasOwn(previousSelection, "approachId") ? previousSelection.approachId : null;
  const clearedRiskBid = Object.hasOwn(candidate.riskBids, clearRequest.stationId)
    ? candidate.riskBids[clearRequest.stationId]
    : null;
  const clearedRiskBidId = clearedRiskBid?.riskBidId ?? null;
  const clearedRiskBidDcAdjustment = clearedRiskBid?.dcAdjustment ?? null;
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
      ...(clearedApproachId !== null ? { clearedApproachId } : {}),
      ...(clearedRiskBidId !== null ? { clearedRiskBidId } : {}),
      ...(clearedRiskBidDcAdjustment !== null ? { clearedRiskBidDcAdjustment } : {}),
      previousRevision: encounterState.revision,
      revision: candidate.revision
    }],
    errors: [],
    warnings
  };
}
