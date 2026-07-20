import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES } from "./constants.js";

const LIFECYCLE_VALUES = Object.freeze(Object.values(VOYAGE_ENCOUNTER_LIFECYCLE_STATES));

const VOYAGE_LIFECYCLE_TRANSITION_POLICY = Object.freeze({
  [VOYAGE_ENCOUNTER_LIFECYCLE_STATES.DRAFT]: Object.freeze([
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.CONFIGURATION
  ]),
  [VOYAGE_ENCOUNTER_LIFECYCLE_STATES.CONFIGURATION]: Object.freeze([
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.DRAFT,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.READY,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.RECOVERY,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.DISCARDED
  ]),
  [VOYAGE_ENCOUNTER_LIFECYCLE_STATES.READY]: Object.freeze([
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.CONFIGURATION,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.RECOVERY,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.DISCARDED
  ]),
  [VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE]: Object.freeze([
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.PAUSED,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.RECOVERY,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.COMPLETED_SUCCESS,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.COMPLETED_FAILURE,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ABANDONED
  ]),
  [VOYAGE_ENCOUNTER_LIFECYCLE_STATES.PAUSED]: Object.freeze([
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.RECOVERY,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ABANDONED,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.DISCARDED
  ]),
  [VOYAGE_ENCOUNTER_LIFECYCLE_STATES.RECOVERY]: Object.freeze([
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.CONFIGURATION,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.READY,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.PAUSED,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ABANDONED,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.DISCARDED
  ]),
  [VOYAGE_ENCOUNTER_LIFECYCLE_STATES.COMPLETED_SUCCESS]: Object.freeze([]),
  [VOYAGE_ENCOUNTER_LIFECYCLE_STATES.COMPLETED_FAILURE]: Object.freeze([]),
  [VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ABANDONED]: Object.freeze([]),
  [VOYAGE_ENCOUNTER_LIFECYCLE_STATES.DISCARDED]: Object.freeze([])
});

function isRecognizedLifecycleState(value) {
  return LIFECYCLE_VALUES.includes(value);
}

function issue(errors, code, path, message) {
  errors.push({ code, path, message, severity: "error" });
}

/**
 * Return legal target lifecycle states without exposing internal policy data.
 */
export function getAllowedVoyageLifecycleTransitions(lifecycleState) {
  if (!isRecognizedLifecycleState(lifecycleState)) return [];
  return [...VOYAGE_LIFECYCLE_TRANSITION_POLICY[lifecycleState]];
}

/**
 * Determine whether the accepted lifecycle graph permits a state change.
 */
export function isLegalVoyageLifecycleTransition(fromLifecycleState, toLifecycleState) {
  return isRecognizedLifecycleState(fromLifecycleState)
    && isRecognizedLifecycleState(toLifecycleState)
    && fromLifecycleState !== toLifecycleState
    && VOYAGE_LIFECYCLE_TRANSITION_POLICY[fromLifecycleState].includes(toLifecycleState);
}

/**
 * Validate a proposed lifecycle transition without changing encounter state.
 */
export function validateVoyageLifecycleTransition(fromLifecycleState, toLifecycleState) {
  const errors = [];
  const warnings = [];
  const sourceIsRecognized = isRecognizedLifecycleState(fromLifecycleState);
  const targetIsRecognized = isRecognizedLifecycleState(toLifecycleState);

  if (!sourceIsRecognized) {
    issue(errors, "invalid-source-lifecycle-state", "fromLifecycleState", "Source lifecycle state is not recognized.");
  }
  if (!targetIsRecognized) {
    issue(errors, "invalid-target-lifecycle-state", "toLifecycleState", "Target lifecycle state is not recognized.");
  }
  if (sourceIsRecognized && targetIsRecognized && fromLifecycleState === toLifecycleState) {
    issue(errors, "same-lifecycle-state", "toLifecycleState", "Lifecycle transitions must change state.");
  }
  if (sourceIsRecognized && targetIsRecognized && fromLifecycleState !== toLifecycleState
    && !isLegalVoyageLifecycleTransition(fromLifecycleState, toLifecycleState)) {
    issue(errors, "illegal-lifecycle-transition", "toLifecycleState", "The lifecycle transition is not permitted by policy.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Return a complete plain-data copy of the lifecycle transition policy.
 */
export function getVoyageLifecycleTransitionPolicy() {
  return Object.fromEntries(
    Object.entries(VOYAGE_LIFECYCLE_TRANSITION_POLICY)
      .map(([lifecycleState, allowedTransitions]) => [lifecycleState, [...allowedTransitions]])
  );
}
