import {
  INACTIVE_VOYAGE_ROUND_VALUE,
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES,
  VOYAGE_ROUND_PHASES
} from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyageLifecycleTransition } from "./lifecycle.js";
import { validateVoyageEncounterState } from "./validation.js";

const PLANNING_OBJECT_FIELDS = ["selections", "targets", "riskBids"];
const PLANNING_ARRAY_FIELDS = [
  "assistance",
  "reservations",
  "proposedStationOrder",
  "committedStationOrder",
  "pendingChecks",
  "pendingThresholdQueue",
  "pendingConsequences"
];

function error(code, path, message) {
  return { code, path, message, severity: "error" };
}

/**
 * Read-only validation for beginning the specialized Ready-to-Active operation.
 * The internal Active candidate is never returned or applied.
 */
function validateActivationStartSafely(encounterState) {
  const initialValidation = validateVoyageEncounterState(encounterState);
  if (!initialValidation.valid) {
    return {
      ready: false,
      errors: initialValidation.errors,
      warnings: initialValidation.warnings
    };
  }

  if (encounterState.lifecycleState !== VOYAGE_ENCOUNTER_LIFECYCLE_STATES.READY) {
    return {
      ready: false,
      errors: [error(
        "activation-start-requires-ready",
        "lifecycleState",
        "Voyage activation requires a Ready encounter."
      )],
      warnings: initialValidation.warnings
    };
  }

  const lifecycleValidation = validateVoyageLifecycleTransition(
    encounterState.lifecycleState,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE
  );
  const activeCandidate = clonePlainData(encounterState);
  activeCandidate.lifecycleState = VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE;
  activeCandidate.roundNumber = 1;
  activeCandidate.phase = VOYAGE_ROUND_PHASES.SITUATION;
  const candidateValidation = validateVoyageEncounterState(activeCandidate);
  const errors = [...lifecycleValidation.errors, ...candidateValidation.errors];

  if (isPlainObject(encounterState.currentStage)
    && (typeof encounterState.currentStage.stageId !== "string" || !encounterState.currentStage.stageId.trim())) {
    errors.push(error(
      "invalid-initial-stage-id",
      "currentStage.stageId",
      "Voyage activation requires a non-empty initial stageId."
    ));
  }

  if (encounterState.successConditions.length === 0) {
    errors.push(error("missing-success-conditions", "successConditions", "Voyage activation requires at least one success condition."));
  }
  if (encounterState.failureConditions.length === 0) {
    errors.push(error("missing-failure-conditions", "failureConditions", "Voyage activation requires at least one failure condition."));
  }
  if (encounterState.availableStations.length === 0) {
    errors.push(error("missing-available-stations", "availableStations", "Voyage activation requires at least one available station."));
  }
  if (encounterState.roundNumber !== INACTIVE_VOYAGE_ROUND_VALUE) {
    errors.push(error("activation-round-must-be-inactive", "roundNumber", "A Ready encounter cannot already contain an active round number."));
  }
  if (encounterState.phase !== INACTIVE_VOYAGE_ROUND_VALUE) {
    errors.push(error("activation-phase-must-be-inactive", "phase", "A Ready encounter cannot already contain an active round phase."));
  }

  for (const fieldName of PLANNING_OBJECT_FIELDS) {
    if (Object.keys(encounterState[fieldName]).length > 0) {
      errors.push(error("activation-planning-state-not-empty", fieldName, "Voyage activation requires empty pre-round planning state."));
    }
  }
  for (const fieldName of PLANNING_ARRAY_FIELDS) {
    if (encounterState[fieldName].length > 0) {
      errors.push(error("activation-planning-state-not-empty", fieldName, "Voyage activation requires empty pre-round planning state."));
    }
  }

  return {
    ready: errors.length === 0,
    errors,
    warnings: [...initialValidation.warnings, ...lifecycleValidation.warnings, ...candidateValidation.warnings]
  };
}

export function validateVoyageEncounterActivationStart(encounterState) {
  try {
    return validateActivationStartSafely(encounterState);
  } catch (_error) {
    return {
      ready: false,
      errors: [error(
        "activation-start-data-read-failed",
        "$",
        "Activation-start data could not be read safely."
      )],
      warnings: []
    };
  }
}
