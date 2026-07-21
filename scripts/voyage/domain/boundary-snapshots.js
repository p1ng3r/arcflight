import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES } from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyageEncounterState } from "./validation.js";

const SUPPORTED_BOUNDARY_TYPES = new Set(["round-start", "phase-start"]);
const TEMPORARY_STATE_FIELDS = [
  "currentSituation",
  "objective",
  "participants",
  "availableStations",
  "temporaryStationAssignments",
  "currentStage",
  "roundNumber",
  "phase",
  "playerVisibleInformation",
  "gmSecretInformation",
  "temporaryConsequences",
  "tracks",
  "thresholdHistory",
  "pendingThresholdQueue",
  "selections",
  "targets",
  "riskBids",
  "assistance",
  "reservations",
  "pendingChecks",
  "pendingConsequences"
];

function error(code, path, message) {
  return { code, path, message, severity: "error" };
}

/**
 * Construct a read-only, caller-identified snapshot of temporary Active
 * Voyage Encounter state. Appending, restoration, and persistence remain the
 * responsibility of specialized future operations.
 */
export function createVoyageEncounterBoundarySnapshot(encounterState, snapshotRequest) {
  const initialValidation = validateVoyageEncounterState(encounterState);
  if (!initialValidation.valid) {
    return {
      ok: false,
      snapshot: null,
      errors: initialValidation.errors,
      warnings: initialValidation.warnings
    };
  }

  const errors = [];
  if (encounterState.lifecycleState !== VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE) {
    errors.push(error(
      "boundary-snapshot-requires-active",
      "lifecycleState",
      "Boundary snapshot construction requires an Active encounter."
    ));
  }

  if (!isPlainObject(snapshotRequest)) {
    errors.push(error(
      "invalid-snapshot-request",
      "snapshotRequest",
      "Boundary snapshot request must be a plain object."
    ));
  } else {
    if (typeof snapshotRequest.snapshotId !== "string" || !snapshotRequest.snapshotId.trim()) {
      errors.push(error(
        "invalid-snapshot-id",
        "snapshotRequest.snapshotId",
        "Boundary snapshot requires a non-empty snapshotId."
      ));
    }
    if (!SUPPORTED_BOUNDARY_TYPES.has(snapshotRequest.boundaryType)) {
      errors.push(error(
        "invalid-snapshot-boundary-type",
        "snapshotRequest.boundaryType",
        "Boundary snapshot type must be round-start or phase-start."
      ));
    }
  }

  if (isPlainObject(encounterState.currentStage)
    && (typeof encounterState.currentStage.stageId !== "string" || !encounterState.currentStage.stageId.trim())) {
    errors.push(error(
      "invalid-snapshot-stage-id",
      "currentStage.stageId",
      "Boundary snapshot construction requires a non-empty current stageId."
    ));
  }

  if (errors.length > 0) {
    return { ok: false, snapshot: null, errors, warnings: [...initialValidation.warnings] };
  }

  const temporaryState = {};
  for (const fieldName of TEMPORARY_STATE_FIELDS) {
    temporaryState[fieldName] = clonePlainData(encounterState[fieldName]);
  }

  return {
    ok: true,
    snapshot: {
      snapshotId: snapshotRequest.snapshotId,
      boundaryType: snapshotRequest.boundaryType,
      lifecycleState: encounterState.lifecycleState,
      stageId: encounterState.currentStage.stageId,
      roundNumber: encounterState.roundNumber,
      phase: encounterState.phase,
      temporaryState
    },
    errors: [],
    warnings: [...initialValidation.warnings]
  };
}
