import {
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES,
  VOYAGE_ROUND_PHASES
} from "./constants.js";
import { prepareVoyageEncounterCrewPlanningCompleteness } from "./crew-planning-completeness.js";
import { validateVoyageEncounterState } from "./validation.js";
import { validateVoyageEncounterRiskBids } from "./risk-bids.js";

function issue(errors, code, path, message) {
  errors.push({ code, path, message, severity: "error" });
}

function deduplicateIssues(issues) {
  const seen = new Set();
  return issues.filter((entry) => {
    const identity = `${entry.code}\u0000${entry.path}\u0000${entry.message}\u0000${entry.severity}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

/**
 * Prepare a read-only, derived report for locking an Active Crew Plan.
 */
export function prepareVoyageEncounterCrewPlanningReadiness(encounterState) {
  const structural = validateVoyageEncounterState(encounterState);
  const errors = [...structural.errors];
  const warnings = [...structural.warnings];
  const completeness = prepareVoyageEncounterCrewPlanningCompleteness(encounterState);
  const riskBids = validateVoyageEncounterRiskBids(encounterState);
  errors.push(...riskBids.errors.map((entry) => ({ ...entry })));
  warnings.push(...riskBids.warnings.map((entry) => ({ ...entry })));

  // Completeness owns available-station completion validation.
  errors.push(...completeness.errors.map((entry) => ({ ...entry })));
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
  if (structural.valid && (!encounterState.currentStage
    || typeof encounterState.currentStage.stageId !== "string"
    || !encounterState.currentStage.stageId.trim())) {
    issue(errors, "invalid-crew-planning-readiness-stage-id", "currentStage.stageId", "Crew Planning readiness requires a non-empty current stageId for the Lock Readiness snapshot.");
  }

  return {
    structurallyValid: structural.valid,
    active,
    crewPlanning,
    occupiedStationIds: [...completeness.occupiedStationIds],
    selectedStationIds: [...completeness.selectedStationIds],
    missingOccupiedStationIds: [...completeness.missingOccupiedStationIds],
    complete: completeness.complete,
    readyToLock: errors.length === 0 && active && crewPlanning && completeness.complete,
    errors: deduplicateIssues(errors),
    warnings: deduplicateIssues(warnings)
  };
}
