import {
  INACTIVE_VOYAGE_ROUND_VALUE,
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES
} from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyageEncounterState } from "./validation.js";

const PLANNING_OBJECT_FIELDS = ["selections", "targets", "riskBids"];
const PLANNING_ARRAY_FIELDS = [
  "assistance",
  "reservations",
  "pendingChecks",
  "pendingThresholdQueue",
  "pendingConsequences"
];

function error(code, path, message) {
  return { code, path, message, severity: "error" };
}

/**
 * Read-only validation for a Configuration encounter's transition readiness.
 * This does not apply a lifecycle change; the Ready candidate is internal.
 */
export function validateVoyageEncounterActivationReadiness(encounterState) {
  const initialValidation = validateVoyageEncounterState(encounterState);
  if (!initialValidation.valid) {
    return {
      ready: false,
      errors: initialValidation.errors,
      warnings: initialValidation.warnings
    };
  }

  if (encounterState.lifecycleState !== VOYAGE_ENCOUNTER_LIFECYCLE_STATES.CONFIGURATION) {
    return {
      ready: false,
      errors: [error(
        "activation-readiness-requires-configuration",
        "lifecycleState",
        "Activation readiness validation requires a Configuration encounter."
      )],
      warnings: initialValidation.warnings
    };
  }

  const readyCandidate = clonePlainData(encounterState);
  readyCandidate.lifecycleState = VOYAGE_ENCOUNTER_LIFECYCLE_STATES.READY;
  const candidateValidation = validateVoyageEncounterState(readyCandidate);
  const errors = [...candidateValidation.errors];

  if (!isPlainObject(encounterState.currentStage)) {
    errors.push(error("missing-initial-stage", "currentStage", "Activation readiness requires an initial stage."));
  } else if (typeof encounterState.currentStage.stageId !== "string" || !encounterState.currentStage.stageId.trim()) {
    errors.push(error("invalid-initial-stage-id", "currentStage.stageId", "The initial stage requires a non-empty stageId."));
  }

  if (encounterState.successConditions.length === 0) {
    errors.push(error("missing-success-conditions", "successConditions", "Activation readiness requires at least one success condition."));
  }
  if (encounterState.failureConditions.length === 0) {
    errors.push(error("missing-failure-conditions", "failureConditions", "Activation readiness requires at least one failure condition."));
  }
  if (encounterState.availableStations.length === 0) {
    errors.push(error("missing-available-stations", "availableStations", "Activation readiness requires at least one available station."));
  }
  if (encounterState.roundNumber !== INACTIVE_VOYAGE_ROUND_VALUE) {
    errors.push(error("activation-round-must-be-inactive", "roundNumber", "A Configuration encounter cannot contain an active round number."));
  }
  if (encounterState.phase !== INACTIVE_VOYAGE_ROUND_VALUE) {
    errors.push(error("activation-phase-must-be-inactive", "phase", "A Configuration encounter cannot contain an active round phase."));
  }

  for (const fieldName of PLANNING_OBJECT_FIELDS) {
    if (Object.keys(encounterState[fieldName]).length > 0) {
      errors.push(error("activation-planning-state-not-empty", fieldName, "Activation readiness requires empty round-planning state."));
    }
  }
  for (const fieldName of PLANNING_ARRAY_FIELDS) {
    if (encounterState[fieldName].length > 0) {
      errors.push(error("activation-planning-state-not-empty", fieldName, "Activation readiness requires empty round-planning state."));
    }
  }

  return { ready: errors.length === 0, errors, warnings: candidateValidation.warnings };
}
