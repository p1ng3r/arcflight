import { validateVoyageEncounterActivationStart } from "./activation-start-readiness.js";
import { createVoyageEncounterBoundarySnapshot } from "./boundary-snapshots.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES, VOYAGE_ROUND_PHASES } from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyageLifecycleTransition } from "./lifecycle.js";
import { validateVoyageEncounterState } from "./validation.js";

function failure(errors, warnings) {
  return { ok: false, nextState: null, events: [], errors, warnings };
}

function error(code, path, message) {
  return { code, path, message, severity: "error" };
}

function isValidSnapshotId(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateActivationRequest(activationRequest, snapshots) {
  if (!isPlainObject(activationRequest)) {
    return [error(
      "invalid-activation-request",
      "activationRequest",
      "Voyage activation request must be a plain object."
    )];
  }

  const errors = [];
  const roundStartSnapshotIdValid = isValidSnapshotId(activationRequest.roundStartSnapshotId);
  const phaseStartSnapshotIdValid = isValidSnapshotId(activationRequest.phaseStartSnapshotId);

  if (!roundStartSnapshotIdValid) {
    errors.push(error(
      "invalid-round-start-snapshot-id",
      "activationRequest.roundStartSnapshotId",
      "Voyage activation requires a non-empty round-start snapshot ID."
    ));
  }
  if (!phaseStartSnapshotIdValid) {
    errors.push(error(
      "invalid-phase-start-snapshot-id",
      "activationRequest.phaseStartSnapshotId",
      "Voyage activation requires a non-empty phase-start snapshot ID."
    ));
  }
  if (roundStartSnapshotIdValid && phaseStartSnapshotIdValid
    && activationRequest.roundStartSnapshotId === activationRequest.phaseStartSnapshotId) {
    errors.push(error(
      "duplicate-activation-snapshot-id",
      "activationRequest.phaseStartSnapshotId",
      "Voyage activation requires distinct round-start and phase-start snapshot IDs."
    ));
  }

  const existingSnapshotIds = new Set(
    snapshots.map((snapshot) => snapshot?.snapshotId)
  );
  if (roundStartSnapshotIdValid && existingSnapshotIds.has(activationRequest.roundStartSnapshotId)) {
    errors.push(error(
      "activation-snapshot-id-already-exists",
      "activationRequest.roundStartSnapshotId",
      "Voyage activation snapshot ID already exists in encounter snapshots."
    ));
  }
  if (phaseStartSnapshotIdValid && existingSnapshotIds.has(activationRequest.phaseStartSnapshotId)) {
    errors.push(error(
      "activation-snapshot-id-already-exists",
      "activationRequest.phaseStartSnapshotId",
      "Voyage activation snapshot ID already exists in encounter snapshots."
    ));
  }
  return errors;
}

/**
 * Atomically apply the specialized Ready-to-Active transition and establish
 * the initial round-one Situation boundary snapshots without persistence.
 */
export function applyVoyageEncounterActivation(encounterState, activationRequest) {
  const activationStart = validateVoyageEncounterActivationStart(encounterState);
  if (!activationStart.ready) return failure(activationStart.errors, [...activationStart.warnings]);

  const lifecycleTransition = validateVoyageLifecycleTransition(
    encounterState.lifecycleState,
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE
  );
  const initialWarnings = [...activationStart.warnings, ...lifecycleTransition.warnings];
  if (!lifecycleTransition.valid) return failure(lifecycleTransition.errors, initialWarnings);

  const requestErrors = validateActivationRequest(activationRequest, encounterState.snapshots);
  if (requestErrors.length > 0) return failure(requestErrors, initialWarnings);

  let candidate;
  try {
    candidate = clonePlainData(encounterState);
  } catch (_error) {
    return failure([error(
      "activation-candidate-construction-failed",
      "encounterState",
      "Voyage activation could not clone encounter state."
    )], initialWarnings);
  }

  candidate.lifecycleState = VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE;
  candidate.roundNumber = 1;
  candidate.phase = VOYAGE_ROUND_PHASES.SITUATION;

  let roundStart;
  try {
    roundStart = createVoyageEncounterBoundarySnapshot(candidate, {
      snapshotId: activationRequest.roundStartSnapshotId,
      boundaryType: "round-start"
    });
  } catch (_error) {
    return failure([error(
      "activation-round-start-snapshot-construction-failed",
      "roundStartSnapshot",
      "Voyage activation could not construct the round-start snapshot."
    )], initialWarnings);
  }
  const roundStartWarnings = [...initialWarnings, ...roundStart.warnings];
  if (!roundStart.ok) return failure(roundStart.errors, roundStartWarnings);

  let phaseStart;
  try {
    phaseStart = createVoyageEncounterBoundarySnapshot(candidate, {
      snapshotId: activationRequest.phaseStartSnapshotId,
      boundaryType: "phase-start"
    });
  } catch (_error) {
    return failure([error(
      "activation-phase-start-snapshot-construction-failed",
      "phaseStartSnapshot",
      "Voyage activation could not construct the phase-start snapshot."
    )], roundStartWarnings);
  }
  const snapshotWarnings = [...roundStartWarnings, ...phaseStart.warnings];
  if (!phaseStart.ok) return failure(phaseStart.errors, snapshotWarnings);

  candidate.snapshots.push(roundStart.snapshot, phaseStart.snapshot);
  candidate.revision = encounterState.revision + 1;

  const candidateValidation = validateVoyageEncounterState(candidate);
  const warnings = [...snapshotWarnings, ...candidateValidation.warnings];
  if (!candidateValidation.valid) return failure(candidateValidation.errors, warnings);

  return {
    ok: true,
    nextState: candidate,
    events: [{
      type: "voyage.lifecycle-transitioned",
      encounterId: candidate.encounterId,
      fromLifecycleState: VOYAGE_ENCOUNTER_LIFECYCLE_STATES.READY,
      toLifecycleState: VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE,
      previousRevision: encounterState.revision,
      revision: candidate.revision,
      roundNumber: 1,
      phase: VOYAGE_ROUND_PHASES.SITUATION,
      roundStartSnapshotId: activationRequest.roundStartSnapshotId,
      phaseStartSnapshotId: activationRequest.phaseStartSnapshotId
    }],
    errors: [],
    warnings
  };
}
