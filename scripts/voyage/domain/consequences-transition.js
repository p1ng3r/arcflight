import { createVoyageEncounterBoundarySnapshot } from "./boundary-snapshots.js";
import { VOYAGE_ROUND_PHASES as PHASES } from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyagePhaseTransition } from "./phase.js";
import { prepareVoyageEncounterResolutionCompletion } from "./resolution-completion.js";
import { deduplicateVoyageResolutionIssues } from "./resolution-order.js";
import { validateVoyageEncounterState } from "./validation.js";
import { validateVoyageEncounterPendingChecks } from "./pending-checks.js";
const error = (code, path, message) => ({ code, path, message, severity: "error" });
const failure = (errors, warnings = []) => ({ ok: false, nextState: null, events: [], errors: deduplicateVoyageResolutionIssues(errors), warnings: deduplicateVoyageResolutionIssues(warnings) });
function captureTransitionRequest(value) {
  try {
    if (!isPlainObject(value)) return { error: "invalid-consequences-transition-request" };
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 1 || keys[0] !== "phaseStartSnapshotId") return { error: "invalid-consequences-transition-request" };
    const descriptor = Object.getOwnPropertyDescriptor(value, "phaseStartSnapshotId");
    if (!descriptor || !descriptor.enumerable) return { error: "invalid-consequences-transition-request" };
    return { value: value.phaseStartSnapshotId };
  } catch { return { error: "consequences-transition-request-read-failed" }; }
}

export function applyVoyageEncounterConsequencesTransition(state, transitionRequest) {
 try {
  const structural = validateVoyageEncounterState(state);
  if (!structural.valid) return failure(structural.errors, structural.warnings);
  if (state.lifecycleState !== "active") return failure([error("consequences-transition-requires-active", "lifecycleState", "Consequences transition requires Active.")]);
  if (state.phase !== PHASES.RESOLUTION) return failure([error("consequences-transition-requires-resolution", "phase", "Consequences transition requires Resolution.")]);
  const phase = validateVoyagePhaseTransition(state.phase, PHASES.CONSEQUENCES);
  if (!phase.valid) return failure(phase.errors, phase.warnings);
  const completion = prepareVoyageEncounterResolutionCompletion(state);
  const warnings = [...structural.warnings, ...completion.warnings];
  if (!completion.readyForConsequences) return failure([error("resolution-incomplete", "pendingChecks", "Resolution is incomplete.")], warnings);
  const capturedRequest = captureTransitionRequest(transitionRequest);
  if (capturedRequest.error) return failure([error(capturedRequest.error, "transitionRequest", "Consequences transition request could not be read safely.")], warnings);
  const snapshotId = capturedRequest.value;
  if (typeof snapshotId !== "string" || !snapshotId.trim() || ["__proto__", "constructor", "prototype"].includes(snapshotId)) return failure([error("invalid-phase-start-snapshot-id", "transitionRequest.phaseStartSnapshotId", "Consequences snapshot ID must be safe and non-empty.")], warnings);
  if (state.snapshots.some((snapshot) => snapshot?.snapshotId === snapshotId)) return failure([error("phase-start-snapshot-id-already-exists", "transitionRequest.phaseStartSnapshotId", "Consequences phase-start snapshot ID already exists.")], warnings);
  warnings.push(...phase.warnings);
  let candidate; try { candidate = clonePlainData(state); } catch { return failure([error("consequences-candidate-construction-failed", "encounterState", "Consequences candidate could not be cloned.")], warnings); }
  candidate.phase = PHASES.CONSEQUENCES;
  let snapshot; try { snapshot = createVoyageEncounterBoundarySnapshot(candidate, { snapshotId, boundaryType: "phase-start" }); } catch { return failure([error("consequences-snapshot-construction-failed", "phaseStartSnapshot", "Consequences snapshot could not be constructed.")], warnings); }
  warnings.push(...snapshot.warnings);
  if (!snapshot.ok) return failure([error("consequences-snapshot-construction-failed", "phaseStartSnapshot", "Consequences snapshot could not be constructed."), ...snapshot.errors], warnings);
  candidate.snapshots.push(snapshot.snapshot);
  candidate.revision = state.revision + 1;
  const final = validateVoyageEncounterState(candidate), finalPending = validateVoyageEncounterPendingChecks(candidate);
  if (!final.valid) return failure([error("consequences-final-state-validation-failed", "encounterState", "Consequences candidate state is invalid."), ...final.errors], [...warnings, ...final.warnings]);
  if (!finalPending.valid) return failure([error("consequences-final-pending-check-validation-failed", "pendingChecks", "Consequences candidate pending checks are invalid."), ...finalPending.errors], [...warnings, ...finalPending.warnings]);
  return { ok: true, nextState: candidate, events: [{ type: "voyage.consequences-started", encounterId: candidate.encounterId, lifecycleState: candidate.lifecycleState, roundNumber: candidate.roundNumber, previousPhase: state.phase, phase: candidate.phase, actionCount: completion.actionCount, checkCount: completion.checkCount, noRollActionCount: completion.noRollActionCount, resolvedCheckCount: completion.resolvedCheckCount, previousRevision: state.revision, revision: candidate.revision, phaseStartSnapshotId: snapshotId }], errors: [], warnings: deduplicateVoyageResolutionIssues(warnings) };
 } catch { return failure([error("consequences-transition-state-read-failed", "encounterState", "Consequences transition state could not be read safely.")]); }
}
