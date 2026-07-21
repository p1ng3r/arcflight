import { VOYAGE_ROUND_PHASES } from "./constants.js";

const VOYAGE_PHASE_VALUES = Object.freeze([
  VOYAGE_ROUND_PHASES.SITUATION,
  VOYAGE_ROUND_PHASES.CREW_PLANNING,
  VOYAGE_ROUND_PHASES.LOCK_READINESS,
  VOYAGE_ROUND_PHASES.RESOLUTION,
  VOYAGE_ROUND_PHASES.CONSEQUENCES,
  VOYAGE_ROUND_PHASES.CLEANUP_ADVANCE
]);

const VOYAGE_PHASE_TRANSITION_POLICY = Object.freeze({
  [VOYAGE_ROUND_PHASES.SITUATION]: Object.freeze([VOYAGE_ROUND_PHASES.CREW_PLANNING]),
  [VOYAGE_ROUND_PHASES.CREW_PLANNING]: Object.freeze([VOYAGE_ROUND_PHASES.LOCK_READINESS]),
  [VOYAGE_ROUND_PHASES.LOCK_READINESS]: Object.freeze([VOYAGE_ROUND_PHASES.RESOLUTION]),
  [VOYAGE_ROUND_PHASES.RESOLUTION]: Object.freeze([VOYAGE_ROUND_PHASES.CONSEQUENCES]),
  [VOYAGE_ROUND_PHASES.CONSEQUENCES]: Object.freeze([VOYAGE_ROUND_PHASES.CLEANUP_ADVANCE]),
  [VOYAGE_ROUND_PHASES.CLEANUP_ADVANCE]: Object.freeze([])
});

function isRecognizedVoyagePhase(value) {
  return VOYAGE_PHASE_VALUES.includes(value);
}

function issue(errors, code, path, message) {
  errors.push({ code, path, message, severity: "error" });
}

/**
 * Return legal ordinary phase targets without exposing internal policy data.
 */
export function getAllowedVoyagePhaseTransitions(phase) {
  if (!isRecognizedVoyagePhase(phase)) return [];
  return [...VOYAGE_PHASE_TRANSITION_POLICY[phase]];
}

/**
 * Determine whether the ordinary Voyage Round policy permits a phase change.
 */
export function isLegalVoyagePhaseTransition(fromPhase, toPhase) {
  return isRecognizedVoyagePhase(fromPhase)
    && isRecognizedVoyagePhase(toPhase)
    && fromPhase !== toPhase
    && VOYAGE_PHASE_TRANSITION_POLICY[fromPhase].includes(toPhase);
}

/**
 * Validate a proposed ordinary phase transition without changing encounter state.
 */
export function validateVoyagePhaseTransition(fromPhase, toPhase) {
  const errors = [];
  const warnings = [];
  const sourceIsRecognized = isRecognizedVoyagePhase(fromPhase);
  const targetIsRecognized = isRecognizedVoyagePhase(toPhase);

  if (!sourceIsRecognized) {
    issue(errors, "invalid-source-voyage-phase", "fromPhase", "Source Voyage phase is not recognized.");
  }
  if (!targetIsRecognized) {
    issue(errors, "invalid-target-voyage-phase", "toPhase", "Target Voyage phase is not recognized.");
  }
  if (sourceIsRecognized && targetIsRecognized && fromPhase === toPhase) {
    issue(errors, "same-voyage-phase", "toPhase", "Voyage phase transitions must change phase.");
  }
  if (sourceIsRecognized && targetIsRecognized && fromPhase !== toPhase
    && !isLegalVoyagePhaseTransition(fromPhase, toPhase)) {
    issue(errors, "illegal-voyage-phase-transition", "toPhase", "The Voyage phase transition is not permitted by policy.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Return a complete plain-data copy of the ordinary Voyage Round phase policy.
 */
export function getVoyagePhaseTransitionPolicy() {
  return Object.fromEntries(
    VOYAGE_PHASE_VALUES.map((phase) => [phase, [...VOYAGE_PHASE_TRANSITION_POLICY[phase]]])
  );
}
