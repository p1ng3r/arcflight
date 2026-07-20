import { validateVoyageEncounterActivationReadiness } from "./activation-readiness.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES } from "./constants.js";
import { clonePlainData } from "./defaults.js";
import { validateVoyageLifecycleTransition } from "./lifecycle.js";
import { validateVoyageEncounterState } from "./validation.js";

function failure(errors, warnings) {
  return { ok: false, nextState: null, events: [], errors, warnings };
}

/**
 * Apply the specialized Configuration-to-Ready lifecycle transition without
 * initializing play. Readiness validation owns all Configuration requirements.
 */
export function applyVoyageEncounterReadyTransition(encounterState) {
  const readiness = validateVoyageEncounterActivationReadiness(encounterState);
  if (!readiness.ready) return failure(readiness.errors, readiness.warnings);

  const transition = validateVoyageLifecycleTransition(
    encounterState.lifecycleState,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.READY
  );
  const transitionWarnings = [...readiness.warnings, ...transition.warnings];
  if (!transition.valid) return failure(transition.errors, transitionWarnings);

  const nextState = clonePlainData(encounterState);
  nextState.lifecycleState = VOYAGE_ENCOUNTER_LIFECYCLE_STATES.READY;
  nextState.revision = encounterState.revision + 1;

  const candidateValidation = validateVoyageEncounterState(nextState);
  const warnings = [...transitionWarnings, ...candidateValidation.warnings];
  if (!candidateValidation.valid) return failure(candidateValidation.errors, warnings);

  return {
    ok: true,
    nextState,
    events: [{
      type: "voyage.lifecycle-transitioned",
      encounterId: nextState.encounterId,
      fromLifecycleState: VOYAGE_ENCOUNTER_LIFECYCLE_STATES.CONFIGURATION,
      toLifecycleState: VOYAGE_ENCOUNTER_LIFECYCLE_STATES.READY,
      previousRevision: encounterState.revision,
      revision: nextState.revision
    }],
    errors: [],
    warnings
  };
}
