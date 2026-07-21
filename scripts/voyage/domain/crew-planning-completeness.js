import {
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES,
  VOYAGE_ROUND_PHASES
} from "./constants.js";
import { isPlainObject } from "./defaults.js";
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

  return station.actions.filter((action) => (
    isPlainObject(action) && action.actionId === selection.actionId
  )).length === 1;
}

/**
 * Prepare a read-only Crew Planning action-selection completeness report.
 */
export function prepareVoyageEncounterCrewPlanningCompleteness(encounterState) {
  const selectionValidation = validateVoyageEncounterStationSelections(encounterState);
  const errors = [...selectionValidation.errors];
  const warnings = [...selectionValidation.warnings];
  const requiredStationIds = [];
  const optionalStationIds = [];
  const selectedStationIds = [];

  if (!selectionValidation.valid) {
    return {
      requiredStationIds,
      optionalStationIds,
      selectedStationIds,
      missingRequiredStationIds: [],
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
  encounterState.availableStations.forEach((station, index) => {
    const path = `availableStations[${index}]`;
    if (!isPlainObject(station)) {
      issue(errors, "invalid-available-station", path, "Available Voyage station must be a plain object.");
      return;
    }
    if (!Object.hasOwn(station, "stationId") || !hasNonEmptyId(station.stationId)) {
      issue(errors, "invalid-available-station-id", `${path}.stationId`, "Available Voyage station requires a non-empty stationId.");
      return;
    }
    if (!isSafeStationKey(station.stationId)) {
      issue(errors, "unsafe-available-station-id", `${path}.stationId`, "Available Voyage station requires a safe stationId.");
      return;
    }
    if (seenStationIds.has(station.stationId)) {
      issue(errors, "duplicate-available-station-id", `${path}.stationId`, "Available Voyage station IDs must be unique.");
      return;
    }
    seenStationIds.add(station.stationId);
    if (!Object.hasOwn(station, "actions") || !Array.isArray(station.actions)) {
      issue(errors, "invalid-available-station-actions", `${path}.actions`, "Available Voyage station actions must be an array.");
      return;
    }

    if (Object.hasOwn(station, "selectionRequired") && station.selectionRequired === false) optionalStationIds.push(station.stationId);
    else requiredStationIds.push(station.stationId);
    if (isValidOwnSelection(encounterState.selections, station)) selectedStationIds.push(station.stationId);
  });

  const selectedIds = new Set(selectedStationIds);
  const missingRequiredStationIds = requiredStationIds.filter((stationId) => !selectedIds.has(stationId));
  return {
    requiredStationIds,
    optionalStationIds,
    selectedStationIds,
    missingRequiredStationIds,
    complete: errors.length === 0 && missingRequiredStationIds.length === 0,
    errors,
    warnings
  };
}
