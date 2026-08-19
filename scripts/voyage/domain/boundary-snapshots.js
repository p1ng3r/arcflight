import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES } from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyageEncounterRiskBids } from "./risk-bids.js";
import { validateVoyageEncounterState } from "./validation.js";

const SUPPORTED_BOUNDARY_TYPES = new Set(["round-start", "phase-start"]);
const TEMPORARY_STATE_FIELDS = [
  "currentSituation",
  "objective",
  "participants",
  "availableStations",
  "stationAssignments",
  "currentStage",
  "roundNumber",
  "phase",
  "playerVisibleInformation",
  "gmSecretInformation",
  "temporaryConsequences",
  "tracks",
  "pressureSystems",
  "thresholdHistory",
  "pendingThresholdQueue",
  "selections",
  "proposedStationOrder",
  "committedStationOrder",
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

function createBoundarySnapshot(encounterState, snapshotRequest) {
  const initialValidation = validateVoyageEncounterState(encounterState);
  if (!initialValidation.valid) {
    return {
      ok: false,
      snapshot: null,
      errors: initialValidation.errors,
      warnings: initialValidation.warnings
    };
  }

  let riskBidKeys;
  try {
    riskBidKeys = Reflect.ownKeys(encounterState.riskBids);
  } catch (_error) {
    return {
      ok: false,
      snapshot: null,
      errors: [error(
        "boundary-snapshot-data-read-failed",
        "riskBids",
        "Boundary snapshot Risk Bid data could not be read safely."
      )],
      warnings: [...initialValidation.warnings]
    };
  }
  const riskBidValidation = riskBidKeys.length > 0
    ? validateVoyageEncounterRiskBids(encounterState)
    : null;
  const validationWarnings = [
    ...initialValidation.warnings,
    ...(riskBidValidation?.warnings ?? [])
  ];
  if (riskBidValidation && !riskBidValidation.valid) {
    return {
      ok: false,
      snapshot: null,
      errors: [...riskBidValidation.errors],
      warnings: validationWarnings
    };
  }
  if (riskBidValidation?.overRiskBidLimit) {
    return {
      ok: false,
      snapshot: null,
      errors: [error(
        "risk-bid-round-limit-exceeded",
        "riskBids",
        `Selected Risk Bids cannot exceed the number of occupied stations.`
      )],
      warnings: validationWarnings
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
    return { ok: false, snapshot: null, errors, warnings: validationWarnings };
  }

  const temporaryState = {};
  for (const fieldName of TEMPORARY_STATE_FIELDS) {
    try {
      temporaryState[fieldName] = clonePlainData(encounterState[fieldName]);
    } catch (_error) {
      return {
        ok: false,
        snapshot: null,
        errors: [error(
          "boundary-snapshot-data-read-failed",
          fieldName,
          fieldName === "proposedStationOrder"
            || fieldName === "committedStationOrder"
            ? "Boundary snapshot station-order data could not be read safely."
            : "Boundary snapshot temporary state could not be read safely."
        )],
        warnings: validationWarnings
      };
    }
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
    warnings: validationWarnings
  };
}

/**
 * Construct a read-only, caller-identified snapshot of temporary Active
 * Voyage Encounter state. Appending, restoration, and persistence remain the
 * responsibility of specialized future operations.
 */
export function createVoyageEncounterBoundarySnapshot(encounterState, snapshotRequest) {
  try {
    return createBoundarySnapshot(encounterState, snapshotRequest);
  } catch (_error) {
    return {
      ok: false,
      snapshot: null,
      errors: [error(
        "boundary-snapshot-data-read-failed",
        "$",
        "Boundary snapshot inputs could not be read safely."
      )],
      warnings: []
    };
  }
}
