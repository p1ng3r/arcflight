import {
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES,
  VOYAGE_ROUND_PHASES
} from "./constants.js";
import { isPlainObject } from "./defaults.js";
import { deriveOccupiedVoyageStationIds } from "./station-assignments.js";
import { validateVoyageEncounterStationSelections } from "./station-selection.js";

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

function isValidOwnSelection(selections, station) {
  if (!Object.hasOwn(selections, station.stationId)) return false;

  const selection = selections[station.stationId];
  if (!isPlainObject(selection)
    || !Object.hasOwn(selection, "stationId")
    || !Object.hasOwn(selection, "actionId")
    || selection.stationId !== station.stationId
    || !hasNonEmptyId(selection.actionId)
    || !Array.isArray(station.actions)) return false;

  let matches = 0;
  for (let index = 0; index < station.actions.length; index += 1) {
    if (!Object.hasOwn(station.actions, index)) continue;
    const action = station.actions[index];
    if (isPlainObject(action) && action.actionId === selection.actionId) matches += 1;
  }
  return matches === 1;
}

/**
 * Prepare a read-only Crew Planning action-selection completeness report.
 */
export function prepareVoyageEncounterCrewPlanningCompleteness(encounterState) {
  const selectionValidation = validateVoyageEncounterStationSelections(encounterState);
  const errors = [...selectionValidation.errors];
  const warnings = [...selectionValidation.warnings];
  const occupiedStationIds = deriveOccupiedVoyageStationIds(encounterState?.stationAssignments);
  const selectedStationIds = [];

  if (!selectionValidation.valid) {
    return {
      occupiedStationIds,
      selectedStationIds,
      missingOccupiedStationIds: [...occupiedStationIds],
      complete: false,
      errors,
      warnings
    };
  }

  if (encounterState.lifecycleState !== VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE) {
    issue(errors, "crew-planning-completeness-requires-active", "lifecycleState", "Preparing Crew Planning completeness requires an Active encounter.");
  } else if (encounterState.phase !== VOYAGE_ROUND_PHASES.CREW_PLANNING) {
    issue(errors, "crew-planning-completeness-requires-crew-planning", "phase", "Preparing Crew Planning completeness requires the Crew Planning phase.");
  }

  const seenStationIds = new Set();
  const availableStations = new Map();
  for (let index = 0; index < encounterState.availableStations.length; index += 1) {
    if (!Object.hasOwn(encounterState.availableStations, index)) continue;
    const station = encounterState.availableStations[index];
    const path = `availableStations[${index}]`;
    if (!isPlainObject(station)) {
      issue(errors, "invalid-available-station", path, "Available Voyage station must be a plain object.");
      continue;
    }
    if (!Object.hasOwn(station, "stationId") || !hasNonEmptyId(station.stationId)) {
      issue(errors, "invalid-available-station-id", `${path}.stationId`, "Available Voyage station requires a non-empty stationId.");
      continue;
    }
    if (!isSafeStationKey(station.stationId)) {
      issue(errors, "unsafe-available-station-id", `${path}.stationId`, "Available Voyage station requires a safe stationId.");
      continue;
    }
    if (seenStationIds.has(station.stationId)) {
      issue(errors, "duplicate-available-station-id", `${path}.stationId`, "Available Voyage station IDs must be unique.");
      continue;
    }
    seenStationIds.add(station.stationId);
    if (!Object.hasOwn(station, "actions") || !Array.isArray(station.actions)) {
      issue(errors, "invalid-available-station-actions", `${path}.actions`, "Available Voyage station actions must be an array.");
      continue;
    }
    availableStations.set(station.stationId, station);
  }

  for (const stationId of occupiedStationIds) {
    const station = availableStations.get(stationId);
    if (station && isValidOwnSelection(encounterState.selections, station)) selectedStationIds.push(stationId);
  }

  const selectedIds = new Set(selectedStationIds);
  const missingOccupiedStationIds = occupiedStationIds.filter((stationId) => !selectedIds.has(stationId));
  return {
    occupiedStationIds,
    selectedStationIds,
    missingOccupiedStationIds,
    complete: errors.length === 0 && missingOccupiedStationIds.length === 0,
    errors,
    warnings
  };
}
