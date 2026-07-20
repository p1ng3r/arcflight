import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES } from "./constants.js";
import { clonePlainData } from "./defaults.js";
import { validateVoyageLifecycleTransition } from "./lifecycle.js";
import { validateVoyageEncounterState } from "./validation.js";

const CONTEXT_PRESERVING_TRANSITIONS = new Set([
  `${VOYAGE_ENCOUNTER_LIFECYCLE_STATES.DRAFT}:${VOYAGE_ENCOUNTER_LIFECYCLE_STATES.CONFIGURATION}`,
  `${VOYAGE_ENCOUNTER_LIFECYCLE_STATES.CONFIGURATION}:${VOYAGE_ENCOUNTER_LIFECYCLE_STATES.DRAFT}`,
  `${VOYAGE_ENCOUNTER_LIFECYCLE_STATES.READY}:${VOYAGE_ENCOUNTER_LIFECYCLE_STATES.CONFIGURATION}`,
  `${VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE}:${VOYAGE_ENCOUNTER_LIFECYCLE_STATES.PAUSED}`,
  `${VOYAGE_ENCOUNTER_LIFECYCLE_STATES.PAUSED}:${VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE}`
]);

function failure(errors, warnings = []) {
  return { ok: false, nextState: null, events: [], errors, warnings };
}

/**
 * Apply a lifecycle edge whose only domain effects are changing lifecycle state
 * and advancing the encounter revision. Specialized lifecycle behavior belongs
 * to future domain operations.
 */
export function applyContextPreservingVoyageLifecycleTransition(encounterState, toLifecycleState) {
  const inputValidation = validateVoyageEncounterState(encounterState);
  if (!inputValidation.valid) return failure(inputValidation.errors, inputValidation.warnings);

  const fromLifecycleState = encounterState.lifecycleState;
  const transitionValidation = validateVoyageLifecycleTransition(fromLifecycleState, toLifecycleState);
  if (!transitionValidation.valid) return failure(transitionValidation.errors, transitionValidation.warnings);

  if (!CONTEXT_PRESERVING_TRANSITIONS.has(`${fromLifecycleState}:${toLifecycleState}`)) {
    return failure([{
      code: "specialized-lifecycle-operation-required",
      path: "toLifecycleState",
      severity: "error",
      message: "This lifecycle transition requires a specialized domain operation."
    }], transitionValidation.warnings);
  }

  const nextState = clonePlainData(encounterState);
  nextState.lifecycleState = toLifecycleState;
  nextState.revision = encounterState.revision + 1;

  const candidateValidation = validateVoyageEncounterState(nextState);
  if (!candidateValidation.valid) return failure(candidateValidation.errors, candidateValidation.warnings);

  return {
    ok: true,
    nextState,
    events: [{
      type: "voyage.lifecycle-transitioned",
      encounterId: encounterState.encounterId,
      fromLifecycleState,
      toLifecycleState,
      previousRevision: encounterState.revision,
      revision: nextState.revision
    }],
    errors: [],
    warnings: candidateValidation.warnings
  };
}
