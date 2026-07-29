import { createVoyageEncounterBoundarySnapshot } from "./boundary-snapshots.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES, VOYAGE_ROUND_PHASES } from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyagePhaseTransition } from "./phase.js";
import { analyzeVoyageEncounterStationOrder } from "./station-order.js";
import { validateVoyageEncounterState } from "./validation.js";

function failure(errors, warnings) {
  return { ok: false, nextState: null, events: [], errors, warnings };
}

function error(code, path, message) {
  return { code, path, message, severity: "error" };
}

function hasValidSnapshotId(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateRequest(request, snapshots) {
  if (!isPlainObject(request)) {
    return [error(
      "invalid-crew-planning-transition-request",
      "transitionRequest",
      "Crew Planning transition request must be a plain object."
    )];
  }

  const errors = [];
  if (!hasValidSnapshotId(request.phaseStartSnapshotId)) {
    errors.push(error(
      "invalid-phase-start-snapshot-id",
      "transitionRequest.phaseStartSnapshotId",
      "Entering Crew Planning requires a non-empty phase-start snapshot ID."
    ));
  } else if (snapshots.some((snapshot) => snapshot?.snapshotId === request.phaseStartSnapshotId)) {
    errors.push(error(
      "phase-start-snapshot-id-already-exists",
      "transitionRequest.phaseStartSnapshotId",
      "Crew Planning phase-start snapshot ID already exists in encounter snapshots."
    ));
  }
  return errors;
}

function validateCleanPlanningInput(encounterState) {
  const errors = [];
  const fields = [
    ["selections", (value) => Object.keys(value).length > 0],
    ["targets", (value) => Object.keys(value).length > 0],
    ["riskBids", (value) => Object.keys(value).length > 0],
    ["assistance", (value) => value.length > 0],
    ["reservations", (value) => value.length > 0],
    ["pendingChecks", (value) => value.length > 0]
  ];
  for (const [path, isNonEmpty] of fields) {
    if (isNonEmpty(encounterState[path])) {
      errors.push(error(
        "crew-planning-input-not-empty",
        path,
        "Entering Crew Planning requires empty crew-planning input state."
      ));
    }
  }
  return errors;
}

/**
 * Atomically enter the Crew Planning boundary for an Active Situation round.
 */
export function applyVoyageEncounterCrewPlanningTransition(encounterState, transitionRequest) {
  const suppliedValidation = validateVoyageEncounterState(encounterState);
  if (!suppliedValidation.valid) return failure(suppliedValidation.errors, [...suppliedValidation.warnings]);

  if (encounterState.lifecycleState !== VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE) {
    return failure([error(
      "crew-planning-transition-requires-active",
      "lifecycleState",
      "Entering Crew Planning requires an Active Voyage encounter."
    )], [...suppliedValidation.warnings]);
  }

  const phaseValidation = validateVoyagePhaseTransition(
    encounterState.phase,
    VOYAGE_ROUND_PHASES.CREW_PLANNING
  );
  const stationOrder = analyzeVoyageEncounterStationOrder(encounterState);
  const initialWarnings = [
    ...suppliedValidation.warnings,
    ...phaseValidation.warnings,
    ...stationOrder.warnings
  ];
  if (!phaseValidation.valid) return failure(phaseValidation.errors, initialWarnings);

  const errors = [
    ...stationOrder.errors,
    ...validateRequest(transitionRequest, encounterState.snapshots),
    ...validateCleanPlanningInput(encounterState)
  ];
  if (stationOrder.proposedOrderValid && stationOrder.proposedStationOrder.length > 0) {
    errors.unshift(error(
      "crew-planning-transition-requires-empty-proposed-station-order",
      "proposedStationOrder",
      "Entering Crew Planning requires proposedStationOrder to be empty."
    ));
  }
  if (errors.length > 0) return failure(errors, initialWarnings);

  let candidate;
  try {
    candidate = clonePlainData(encounterState);
  } catch (_error) {
    return failure([error(
      "crew-planning-candidate-construction-failed",
      "encounterState",
      "Crew Planning transition could not clone encounter state."
    )], initialWarnings);
  }
  candidate.proposedStationOrder = [];
  candidate.committedStationOrder = [];
  candidate.phase = VOYAGE_ROUND_PHASES.CREW_PLANNING;

  let phaseStart;
  try {
    phaseStart = createVoyageEncounterBoundarySnapshot(candidate, {
      snapshotId: transitionRequest.phaseStartSnapshotId,
      boundaryType: "phase-start"
    });
  } catch (_error) {
    return failure([error(
      "crew-planning-phase-start-snapshot-construction-failed",
      "phaseStartSnapshot",
      "Crew Planning transition could not construct the phase-start snapshot."
    )], initialWarnings);
  }
  const snapshotWarnings = [...initialWarnings, ...phaseStart.warnings];
  if (!phaseStart.ok) return failure(phaseStart.errors, snapshotWarnings);

  candidate.snapshots.push(phaseStart.snapshot);
  candidate.revision = encounterState.revision + 1;

  const candidateValidation = validateVoyageEncounterState(candidate);
  const candidateStationOrder = analyzeVoyageEncounterStationOrder(candidate);
  const warnings = [
    ...snapshotWarnings,
    ...candidateValidation.warnings,
    ...candidateStationOrder.warnings
  ];
  if (!candidateValidation.valid) return failure(candidateValidation.errors, warnings);
  if (!candidateStationOrder.valid) return failure(candidateStationOrder.errors, warnings);

  return {
    ok: true,
    nextState: candidate,
    events: [{
      type: "voyage.phase-transitioned",
      encounterId: candidate.encounterId,
      lifecycleState: VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE,
      roundNumber: candidate.roundNumber,
      fromPhase: VOYAGE_ROUND_PHASES.SITUATION,
      toPhase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
      previousRevision: encounterState.revision,
      revision: candidate.revision,
      phaseStartSnapshotId: transitionRequest.phaseStartSnapshotId
    }],
    errors: [],
    warnings
  };
}
