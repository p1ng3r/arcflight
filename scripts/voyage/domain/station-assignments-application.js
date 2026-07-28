import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyageEncounterState } from "./validation.js";
import { analyzeVoyageStationAssignments, deriveOccupiedVoyageStationIds } from "./station-assignments.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES } from "./constants.js";

const PREACTIVATION_LIFECYCLE_STATES = new Set([
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES.DRAFT,
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES.CONFIGURATION,
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES.READY
]);

function issue(errors, code, path, message) {
  errors.push({ code, path, message, severity: "error" });
}

function validateAssignmentMutationContext(encounterState, errors) {
  if (!isPlainObject(encounterState)) {
    issue(errors, "invalid-encounter-state", "encounterState", "Voyage encounter state must be a plain object.");
    return false;
  }

  if (!PREACTIVATION_LIFECYCLE_STATES.has(encounterState.lifecycleState)) {
    issue(errors, "station-assignments-requires-preactivation", "lifecycleState", "Setting Voyage station assignments requires a draft, configuration, or ready encounter.");
    return false;
  }

  return true;
}

export function applyVoyageEncounterStationAssignments(encounterState, stationAssignments) {
  const warnings = [];
  const errors = [];

  let validState = false;
  try {
    validState = validateAssignmentMutationContext(encounterState, errors);
  } catch (_error) {
    issue(errors, "station-assignments-state-read-failed", "encounterState", "Voyage encounter state could not be read safely.");
  }
  const assignmentReport = analyzeVoyageStationAssignments(stationAssignments);
  if (!assignmentReport.valid) errors.push(...assignmentReport.errors);
  if (!validState || errors.length > 0) return { ok: false, nextState: null, events: [], errors, warnings };

  let candidate;
  try {
    candidate = clonePlainData(encounterState);
    candidate.stationAssignments = clonePlainData(assignmentReport.assignments);
  } catch (_error) {
    issue(errors, "station-assignments-candidate-construction-failed", "encounterState", "Voyage station assignments could not clone encounter state.");
    return { ok: false, nextState: null, events: [], errors, warnings };
  }
  const previousRevision = candidate.revision;
  candidate.revision = previousRevision + 1;

  const candidateValidation = validateVoyageEncounterState(candidate);
  warnings.push(...candidateValidation.warnings);
  if (!candidateValidation.valid) return { ok: false, nextState: null, events: [], errors: candidateValidation.errors, warnings };

  return {
    ok: true,
    nextState: candidate,
    events: [{
      type: "voyage.station-assignments-set",
      encounterId: candidate.encounterId,
      lifecycleState: candidate.lifecycleState,
      stationAssignmentCount: assignmentReport.assignmentCount,
      occupiedStationIds: [...deriveOccupiedVoyageStationIds(candidate.stationAssignments)],
      stationAssignments: clonePlainData(candidate.stationAssignments),
      previousRevision,
      revision: candidate.revision
    }],
    errors: [],
    warnings
  };
}
