import {
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES,
  VOYAGE_ROUND_PHASES
} from "./constants.js";
import { prepareVoyageEncounterCrewPlanningCompleteness } from "./crew-planning-completeness.js";
import { validateVoyageEncounterState } from "./validation.js";

function issue(errors, code, path, message) {
  errors.push({ code, path, message, severity: "error" });
}

/**
 * Prepare a read-only, derived report for locking an Active Crew Plan.
 */
export function prepareVoyageEncounterCrewPlanningReadiness(encounterState) {
  const structural = validateVoyageEncounterState(encounterState);
  const errors = [...structural.errors];
  const warnings = [...structural.warnings];
  const completeness = prepareVoyageEncounterCrewPlanningCompleteness(encounterState);

  // Completeness owns persisted selection and available-station validation.
  for (const entry of completeness.errors) {
    if (!errors.some((existing) => existing.code === entry.code && existing.path === entry.path)) errors.push({ ...entry });
  }
  warnings.push(...completeness.warnings.map((entry) => ({ ...entry })));

  const active = structural.valid
    && encounterState.lifecycleState === VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE;
  const crewPlanning = structural.valid
    && encounterState.phase === VOYAGE_ROUND_PHASES.CREW_PLANNING;
  if (structural.valid && !active) {
    issue(errors, "crew-planning-readiness-requires-active", "lifecycleState", "Preparing Crew Planning readiness requires an Active encounter.");
  }
  if (structural.valid && !crewPlanning) {
    issue(errors, "crew-planning-readiness-requires-crew-planning", "phase", "Preparing Crew Planning readiness requires the Crew Planning phase.");
  }

  return {
    structurallyValid: structural.valid,
    active,
    crewPlanning,
    requiredStationIds: [...completeness.requiredStationIds],
    optionalStationIds: [...completeness.optionalStationIds],
    selectedStationIds: [...completeness.selectedStationIds],
    missingRequiredStationIds: [...completeness.missingRequiredStationIds],
    complete: completeness.complete,
    readyToLock: errors.length === 0 && active && crewPlanning && completeness.complete,
    errors,
    warnings
  };
}
