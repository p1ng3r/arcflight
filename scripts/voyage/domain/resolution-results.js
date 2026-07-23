import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as LIFE, VOYAGE_ROUND_PHASES as PHASES } from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyageEncounterPendingChecks } from "./pending-checks.js";
import { validateVoyagePhaseTransition } from "./phase.js";
import { deduplicateVoyageResolutionIssues } from "./resolution-order.js";
import { validateVoyageEncounterState } from "./validation.js";

const SLUGS = ["critical-failure", "failure", "success", "critical-success"];
const error = (code, path, message) => ({ code, path, message, severity: "error" });
const failure = (errors, warnings = []) => ({ ok: false, nextState: null, events: [], errors: deduplicateVoyageResolutionIssues(errors), warnings: deduplicateVoyageResolutionIssues(warnings) });

function validResult(value) {
  return isPlainObject(value)
    && Object.keys(value).length === 3
    && Number.isFinite(value.total)
    && Number.isSafeInteger(value.degreeOfSuccess)
    && value.degreeOfSuccess >= 0
    && value.degreeOfSuccess <= 3
    && value.degreeOfSuccessSlug === SLUGS[value.degreeOfSuccess];
}

/**
 * Persist one successful, already-posted PF2e check.  This deliberately does
 * not invoke PF2e: callers execute exactly once, then persist its isolated
 * result through the authoritative encounter mutation path.
 */
export function applyVoyageEncounterPendingCheckResult(state, executionResult) {
  try {
  const structural = validateVoyageEncounterState(state);
  if (!structural.valid) return failure(structural.errors, structural.warnings);
  const pending = validateVoyageEncounterPendingChecks(state);
  const warnings = [...structural.warnings, ...pending.warnings];
  if (!pending.valid) return failure(pending.errors, warnings);
  if (state.lifecycleState !== LIFE.ACTIVE) return failure([error("pending-check-result-requires-active", "lifecycleState", "Persisting a check result requires an Active encounter.")], warnings);
  if (state.phase !== PHASES.RESOLUTION) return failure([error("pending-check-result-requires-resolution", "phase", "Persisting a check result requires Resolution phase.")], warnings);
  if (!isPlainObject(executionResult)) return failure([error("invalid-pending-check-execution-result", "executionResult", "Execution result must be a plain object.")], warnings);
  if (executionResult.ok !== true || executionResult.status !== "rolled") return failure([error("pending-check-execution-not-rolled", "executionResult.status", "Only a successful PF2e rolled result can be persisted.")], warnings);
  if (typeof executionResult.pendingCheckId !== "string" || !executionResult.pendingCheckId.trim()) return failure([error("invalid-pending-check-result-id", "executionResult.pendingCheckId", "Execution result requires a non-empty pending check ID.")], warnings);
  if (!Number.isSafeInteger(executionResult.sequence) || executionResult.sequence < 0) return failure([error("invalid-pending-check-result-sequence", "executionResult.sequence", "Execution result requires a non-negative sequence.")], warnings);
  if (!validResult(executionResult.result)) return failure([error("invalid-pending-check-result", "executionResult.result", "Execution result must contain a valid isolated PF2e result.")], warnings);

  const index = state.pendingChecks.findIndex((check) => check.pendingCheckId === executionResult.pendingCheckId && check.sequence === executionResult.sequence);
  if (index < 0) return failure([error("unknown-pending-check-result", "executionResult.pendingCheckId", "Execution result does not identify a prepared pending check.")], warnings);
  if (state.pendingChecks[index].status !== "pending") return failure([error("pending-check-result-already-persisted", `pendingChecks[${index}].status`, "This pending check has already been resolved.")], warnings);

  let candidate;
  try {
    candidate = clonePlainData(state);
    candidate.pendingChecks[index].status = "resolved";
    candidate.pendingChecks[index].result = clonePlainData(executionResult.result);
    candidate.revision = state.revision + 1;
  } catch {
    return failure([error("pending-check-result-candidate-construction-failed", "encounterState", "Pending check result could not be persisted safely.")], warnings);
  }

  const allResolved = candidate.pendingChecks.every((check) => check.status === "resolved");
  if (allResolved) {
    const transition = validateVoyagePhaseTransition(candidate.phase, PHASES.CONSEQUENCES);
    warnings.push(...transition.warnings);
    if (!transition.valid) return failure(transition.errors, warnings);
    candidate.phase = PHASES.CONSEQUENCES;
  }

  const final = validateVoyageEncounterState(candidate);
  const finalPending = validateVoyageEncounterPendingChecks(candidate);
  warnings.push(...final.warnings, ...finalPending.warnings);
  if (!final.valid || !finalPending.valid) return failure([...final.errors, ...finalPending.errors], warnings);

  const resultEvent = {
    type: "voyage.pending-check-result-persisted",
    encounterId: candidate.encounterId,
    roundNumber: candidate.roundNumber,
    pendingCheckId: candidate.pendingChecks[index].pendingCheckId,
    sequence: candidate.pendingChecks[index].sequence,
    previousRevision: state.revision,
    revision: candidate.revision
  };
  const events = [resultEvent];
  if (allResolved) events.push({ type: "voyage.consequences-started", encounterId: candidate.encounterId, roundNumber: candidate.roundNumber, previousPhase: PHASES.RESOLUTION, phase: PHASES.CONSEQUENCES, previousRevision: state.revision, revision: candidate.revision });
    return { ok: true, nextState: candidate, events, errors: [], warnings: deduplicateVoyageResolutionIssues(warnings) };
  } catch {
    return failure([error("pending-check-result-data-read-failed", "executionResult", "Pending check result data could not be read safely.")]);
  }
}
