import { createVoyageEncounterBoundarySnapshot } from "./boundary-snapshots.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES, VOYAGE_ROUND_PHASES } from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyagePhaseTransition } from "./phase.js";
import { prepareVoyageEncounterCrewPlanningReadiness } from "./crew-planning-readiness.js";
import { analyzeVoyageEncounterStationOrder } from "./station-order.js";
import { validateVoyageEncounterStationSelections } from "./station-selection.js";
import { validateVoyageEncounterState } from "./validation.js";

function error(code, path, message) { return { code, path, message, severity: "error" }; }
function deduplicateIssues(issues) {
  const seen = new Set();
  return issues.filter((entry) => {
    const identity = `${entry.code}\u0000${entry.path}\u0000${entry.message}\u0000${entry.severity}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}
function failure(errors, warnings) {
  return { ok: false, nextState: null, events: [], errors: deduplicateIssues(errors), warnings: deduplicateIssues(warnings) };
}

function validateRequest(request, snapshots) {
  if (!isPlainObject(request)) return [error("invalid-crew-planning-lock-request", "lockRequest", "Crew Planning lock request must be a plain object.")];
  if (typeof request.phaseStartSnapshotId !== "string" || request.phaseStartSnapshotId.trim().length === 0) {
    return [error("invalid-phase-start-snapshot-id", "lockRequest.phaseStartSnapshotId", "Locking Crew Planning requires a non-empty phase-start snapshot ID.")];
  }
  if (snapshots.some((snapshot) => snapshot?.snapshotId === request.phaseStartSnapshotId)) {
    return [error("phase-start-snapshot-id-already-exists", "lockRequest.phaseStartSnapshotId", "Lock Readiness phase-start snapshot ID already exists in encounter snapshots.")];
  }
  return [];
}

/** Atomically transition a complete Crew Plan into the Lock Readiness boundary. */
function applyCrewPlanningLock(encounterState, lockRequest) {
  const structural = validateVoyageEncounterState(encounterState);
  if (!structural.valid) return failure(structural.errors, [...structural.warnings]);
  const selections = validateVoyageEncounterStationSelections(encounterState);
  const initialWarnings = [...structural.warnings, ...selections.warnings];
  if (!selections.valid) return failure(selections.errors, initialWarnings);
  if (encounterState.lifecycleState !== VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE) {
    return failure([error("crew-planning-lock-requires-active", "lifecycleState", "Locking Crew Planning requires an Active Voyage encounter.")], initialWarnings);
  }
  const phase = validateVoyagePhaseTransition(encounterState.phase, VOYAGE_ROUND_PHASES.LOCK_READINESS);
  if (!phase.valid) return failure(phase.errors, [...initialWarnings, ...phase.warnings]);
  const readiness = prepareVoyageEncounterCrewPlanningReadiness(encounterState);
  const readinessWarnings = [...initialWarnings, ...readiness.warnings];
  if (!readiness.readyToLock) return failure(readiness.errors, readinessWarnings);
  const requestErrors = validateRequest(lockRequest, encounterState.snapshots);
  if (requestErrors.length > 0) return failure(requestErrors, readinessWarnings);

  let candidate;
  try { candidate = clonePlainData(encounterState); } catch (_error) {
    return failure([error("crew-planning-lock-candidate-construction-failed", "encounterState", "Crew Planning lock could not clone encounter state.")], readinessWarnings);
  }
  try {
    const committedStationOrder = [...candidate.proposedStationOrder];
    candidate.proposedStationOrder = [];
    candidate.committedStationOrder = committedStationOrder;
  } catch (_error) {
    return failure([error(
      "crew-planning-lock-station-order-commitment-failed",
      "proposedStationOrder",
      "Crew Planning lock could not commit the proposed station order."
    )], readinessWarnings);
  }
  candidate.phase = VOYAGE_ROUND_PHASES.LOCK_READINESS;
  let phaseStart;
  try {
    phaseStart = createVoyageEncounterBoundarySnapshot(candidate, { snapshotId: lockRequest.phaseStartSnapshotId, boundaryType: "phase-start" });
  } catch (_error) {
    return failure([error("crew-planning-lock-phase-start-snapshot-construction-failed", "phaseStartSnapshot", "Crew Planning lock could not construct the phase-start snapshot.")], readinessWarnings);
  }
  const warnings = [...readinessWarnings, ...phaseStart.warnings];
  if (!phaseStart.ok) return failure(phaseStart.errors, warnings);
  candidate.snapshots.push(phaseStart.snapshot);
  candidate.revision = encounterState.revision + 1;
  const validation = validateVoyageEncounterState(candidate);
  warnings.push(...validation.warnings);
  if (!validation.valid) return failure(validation.errors, warnings);
  const stationOrder = analyzeVoyageEncounterStationOrder(candidate);
  warnings.push(...stationOrder.warnings);
  if (!stationOrder.valid) return failure(stationOrder.errors, warnings);
  if (!stationOrder.committedOrderComplete) {
    return failure([error(
      "crew-planning-lock-committed-station-order-incomplete",
      "committedStationOrder",
      "Crew Planning lock requires a complete committed station order."
    )], warnings);
  }
  return { ok: true, nextState: candidate, events: [{
    type: "voyage.crew-planning-locked", encounterId: candidate.encounterId,
    lifecycleState: candidate.lifecycleState, roundNumber: candidate.roundNumber,
    previousPhase: encounterState.phase, phase: candidate.phase,
    committedStationOrder: [...candidate.committedStationOrder],
    previousRevision: encounterState.revision, revision: candidate.revision,
    phaseStartSnapshotId: lockRequest.phaseStartSnapshotId
  }], errors: [], warnings: deduplicateIssues(warnings) };
}

export function applyVoyageEncounterCrewPlanningLock(encounterState, lockRequest) {
  try {
    return applyCrewPlanningLock(encounterState, lockRequest);
  } catch (_error) {
    return failure([error(
      "crew-planning-lock-data-read-failed",
      "$",
      "Crew Planning lock data could not be read safely."
    )], []);
  }
}
