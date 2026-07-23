import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as LIFE, VOYAGE_PENDING_CHECK_STATUSES as STATUSES, VOYAGE_ROUND_PHASES as PHASES } from "./constants.js";
import { clonePlainData } from "./defaults.js";
import { validateVoyageEncounterPendingChecks } from "./pending-checks.js";
import { prepareVoyageEncounterActionExecutionRequests } from "./resolution-execution-requests.js";
import { deduplicateVoyageResolutionIssues } from "./resolution-order.js";
import { validateVoyageEncounterState } from "./validation.js";

const issue = (errors, code, path, message) => errors.push({ code, path, message, severity: "error" });

/** Report whether Resolution has completed without mutating encounter state. */
function prepare(state) {
  const structural = validateVoyageEncounterState(state);
  const errors = [...structural.errors];
  const warnings = [...structural.warnings];
  const execution = prepareVoyageEncounterActionExecutionRequests(state);
  const pending = structural.valid ? validateVoyageEncounterPendingChecks(state) : { valid: false, errors: [], warnings: [] };
  warnings.push(...execution.warnings, ...pending.warnings);
  if (structural.valid && state.lifecycleState !== LIFE.ACTIVE) issue(errors, "resolution-completion-requires-active", "lifecycleState", "Resolution completion requires an Active encounter.");
  if (structural.valid && state.phase !== PHASES.RESOLUTION) issue(errors, "resolution-completion-requires-resolution", "phase", "Resolution completion requires Resolution phase.");
  if (!pending.valid) errors.push(...pending.errors);
  const collection = state?.pendingChecks;
  if (!Array.isArray(collection)) throw new Error("pendingChecks must be an array");
  const records = [];
  for (let index = 0; index < collection.length; index += 1) {
    if (!Object.hasOwn(collection, index)) continue;
    records.push(collection[index]);
  }
  const unresolvedChecks = [];
  let resolvedCheckCount = 0;
  for (const check of records) {
    if (check.status === STATUSES.RESOLVED) resolvedCheckCount += 1;
    if (check.status === STATUSES.PENDING) unresolvedChecks.push({ pendingCheckId: check.pendingCheckId, sequence: check.sequence, stationId: check.stationId, actionId: check.actionId });
  }
  unresolvedChecks.sort((left, right) => left.sequence - right.sequence);
  const pendingCheckCount = records.length;
  const allChecksPrepared = execution.checkCount === pendingCheckCount && (execution.checkCount === 0 || pendingCheckCount > 0);
  const readyForConsequences = structural.valid && state.lifecycleState === LIFE.ACTIVE && state.phase === PHASES.RESOLUTION && execution.readyForExecution && pending.valid && allChecksPrepared && unresolvedChecks.length === 0;
  if (execution.readyForExecution && !allChecksPrepared) issue(errors, "resolution-completion-checks-unprepared", "pendingChecks", "Every check-producing action must have a prepared pending check.");
  if (unresolvedChecks.length) issue(errors, "resolution-completion-checks-unresolved", "pendingChecks", "Every prepared pending check must be resolved.");
  const final = deduplicateVoyageResolutionIssues(errors);
  return { structurallyValid: structural.valid, active: state?.lifecycleState === LIFE.ACTIVE, resolution: state?.phase === PHASES.RESOLUTION, readyForConsequences: readyForConsequences && final.length === 0, actionCount: execution.actionCount, checkCount: execution.checkCount, noRollActionCount: execution.noRollActionCount, pendingCheckCount, resolvedCheckCount, unresolvedCheckCount: unresolvedChecks.length, unresolvedChecks, errors: final, warnings: deduplicateVoyageResolutionIssues(warnings) };
}


export function prepareVoyageEncounterResolutionCompletion(state) {
  try { return prepare(state); } catch {
    return { structurallyValid: false, active: false, resolution: false, readyForConsequences: false, actionCount: 0, checkCount: 0, noRollActionCount: 0, pendingCheckCount: 0, resolvedCheckCount: 0, unresolvedCheckCount: 0, unresolvedChecks: [], errors: [{ code: "resolution-completion-data-read-failed", path: "$", message: "Resolution completion data could not be read safely.", severity: "error" }], warnings: [] };
  }
}
