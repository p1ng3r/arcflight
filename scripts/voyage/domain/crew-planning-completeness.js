import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES, VOYAGE_ROUND_PHASES } from "./constants.js";
import { isPlainObject } from "./defaults.js";
import { validateVoyageEncounterStationSelections } from "./station-selection.js";

function issue(errors, code, path, message) {
  errors.push({ code, path, message, severity: "error" });
}

function hasNonEmptyId(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Prepare a Foundry-free Crew Planning completeness report.
 *
 * Every available station requires a selected action unless the station
 * explicitly declares `selectionRequired: false`.
 */
export function prepareVoyageEncounterCrewPlanningCompleteness(encounterState) {
  const validation = validateVoyageEncounterStationSelections(encounterState);
  const warnings = [...validation.warnings];
  if (!validation.valid) {
    return {
      valid: false,
      complete: false,
      requiredStationIds: [],
      selectedStationIds: [],
      missingStationIds: [],
      optionalStationIds: [],
      errors: validation.errors,
      warnings
    };
  }

  const errors = [];
  if (encounterState.lifecycleState !== VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE) {
    issue(errors, "crew-planning-completeness-requires-active", "lifecycleState", "Crew Planning completeness requires an Active encounter.");
  } else if (encounterState.phase !== VOYAGE_ROUND_PHASES.CREW_PLANNING) {
    issue(errors, "crew-planning-completeness-requires-crew-planning", "phase", "Crew Planning completeness requires the Crew Planning phase.");
  }

  const requiredStationIds = [];
  const optionalStationIds = [];
  const seen = new Set();

  encounterState.availableStations.forEach((station, index) => {
    const path = `availableStations[${index}]`;
    if (!isPlainObject(station)) {
      issue(errors, "invalid-available-station", path, "Available Voyage station must be a plain object.");
      return;
    }
    if (!hasNonEmptyId(station.stationId)) {
      issue(errors, "invalid-available-station-id", `${path}.stationId`, "Available Voyage station requires a non-empty stationId.");
      return;
    }
    if (seen.has(station.stationId)) {
      issue(errors, "duplicate-available-station-id", `${path}.stationId`, "Available Voyage station IDs must be unique for completeness validation.");
      return;
    }
    seen.add(station.stationId);

    if (station.selectionRequired === false) optionalStationIds.push(station.stationId);
    else requiredStationIds.push(station.stationId);
  });

  const selectedStationIds = Object.keys(encounterState.selections)
    .filter((stationId) => seen.has(stationId));
  const selectedSet = new Set(selectedStationIds);
  const missingStationIds = requiredStationIds.filter((stationId) => !selectedSet.has(stationId));

  return {
    valid: errors.length === 0,
    complete: errors.length === 0 && missingStationIds.length === 0,
    requiredStationIds,
    selectedStationIds,
    missingStationIds,
    optionalStationIds,
    errors,
    warnings
  };
}
