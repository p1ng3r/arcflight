import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as LIFE, VOYAGE_PENDING_CHECK_STATUSES as STATUSES, VOYAGE_ROUND_PHASES as PHASES } from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyageEncounterPendingChecks } from "./pending-checks.js";
import { deduplicateVoyageResolutionIssues } from "./resolution-order.js";
import { validateVoyageEncounterState } from "./validation.js";

const EXECUTION_FIELDS = Object.freeze(["ok", "status", "pendingCheckId", "sequence", "sourceKind", "sourceUuid", "statisticSlug", "dc", "rollMode", "result", "errors", "warnings"]);
const RESULT_FIELDS = Object.freeze(["total", "degreeOfSuccess", "degreeOfSuccessSlug"]);
const SLUGS = ["critical-failure", "failure", "success", "critical-success"];
const error = (code, path, message) => ({ code, path, message, severity: "error" });
const failure = (errors, warnings = []) => ({ ok: false, nextState: null, events: [], errors: deduplicateVoyageResolutionIssues(errors), warnings: deduplicateVoyageResolutionIssues(warnings) });
const own = (value, key) => Object.hasOwn(value, key);
function hasOwnStatisticOption(options, slug) {
  if (!Array.isArray(options)) return false;
  for (let index = 0; index < options.length; index += 1) {
    if (!Object.hasOwn(options, index)) continue;
    if (options[index] === slug) return true;
  }
  return false;
}

function exactObject(value, fields) {
  return isPlainObject(value) && Object.keys(value).length === fields.length && fields.every((field) => own(value, field));
}

function emptyDenseArray(value) { return Array.isArray(value) && value.length === 0 && Object.keys(value).length === 0; }

function captureExecution(value) {
  try {
    if (!isPlainObject(value)) return { error: "invalid-execution-result-shape" };
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string")) return { error: "unexpected-execution-result-field" };
    for (const field of EXECUTION_FIELDS) if (!own(value, field)) return { error: "missing-execution-result-field" };
    if (keys.some((key) => !EXECUTION_FIELDS.includes(key))) return { error: "unexpected-execution-result-field" };
    const output = {}; for (const field of EXECUTION_FIELDS) output[field] = value[field];
    if (output.status !== "rolled" || output.ok !== true) return { error: "invalid-execution-result-status" };
    if (!emptyDenseArray(output.errors)) return { error: "execution-result-contains-errors" };
    if (!emptyDenseArray(output.warnings)) return { error: "execution-result-contains-warnings" };
    if (!isPlainObject(output.result) || Reflect.ownKeys(output.result).length !== RESULT_FIELDS.length || !RESULT_FIELDS.every((field) => own(output.result, field))) return { error: "invalid-execution-result-result" };
    if (typeof output.pendingCheckId !== "string" || !output.pendingCheckId.trim()) return { error: "invalid-pending-check-id" };
    if (!Number.isSafeInteger(output.sequence) || output.sequence < 0) return { error: "invalid-sequence" };
    if (output.sourceKind !== "character") return { error: "invalid-source-kind" };
    if (typeof output.sourceUuid !== "string" || !output.sourceUuid.trim()) return { error: "invalid-source-uuid" };
    if (typeof output.statisticSlug !== "string" || !output.statisticSlug.trim()) return { error: "invalid-statistic-slug" };
    if (!Number.isSafeInteger(output.dc) || output.dc < 0) return { error: "invalid-dc" };
    if (!["public", "blind"].includes(output.rollMode)) return { error: "invalid-roll-mode" };
    if (!Number.isFinite(output.result.total) || !Number.isSafeInteger(output.result.degreeOfSuccess) || output.result.degreeOfSuccess < 0 || output.result.degreeOfSuccess > 3 || output.result.degreeOfSuccessSlug !== SLUGS[output.result.degreeOfSuccess]) return { error: "invalid-execution-result-result" };
    return { value: output };
  } catch { return { error: "invalid-execution-result-shape" }; }
}

/** Persist exactly one fully normalized successful V3-004E-C execution result. */
export function applyVoyageEncounterPendingCheckResult(state, executionResult) {
  try {
    const structural = validateVoyageEncounterState(state);
    if (!structural.valid) return failure(structural.errors, structural.warnings);
    const pending = validateVoyageEncounterPendingChecks(state);
    const warnings = [...structural.warnings, ...pending.warnings];
    if (!pending.valid) return failure(pending.errors, warnings);
    if (state.lifecycleState !== LIFE.ACTIVE) return failure([error("pending-check-result-requires-active", "lifecycleState", "Persisting a check result requires an Active encounter.")], warnings);
    if (state.phase !== PHASES.RESOLUTION) return failure([error("pending-check-result-requires-resolution", "phase", "Persisting a check result requires Resolution phase.")], warnings);
    const captured = captureExecution(executionResult);
    if (captured.error) return failure([error(captured.error, "executionResult", "Execution result is invalid.")], warnings);
    const execution = captured.value;

    const idIndex = state.pendingChecks.findIndex((check) => check.pendingCheckId === execution.pendingCheckId);
    if (idIndex < 0) return failure([error("unknown-pending-check-result", "executionResult.pendingCheckId", "Execution result does not identify a prepared pending check.")], warnings);
    const record = state.pendingChecks[idIndex];
    if (record.sequence !== execution.sequence) return failure([error("pending-check-result-sequence-mismatch", "executionResult.sequence", "Execution sequence does not match the identified pending check.")], warnings);
    if (record.status !== STATUSES.PENDING) return failure([error("pending-check-result-already-persisted", `pendingChecks[${idIndex}].status`, "This pending check has already been resolved.")], warnings);
    const expected = [
      ["sourceKind", record.source?.kind], ["sourceUuid", record.source?.uuid],
      ["statisticSlug", hasOwnStatisticOption(record.statisticOptions, execution.statisticSlug) ? execution.statisticSlug : undefined],
      ["dc", record.dcSource?.kind === "fixed" ? record.dcSource.value : undefined],
      ["rollMode", record.secrecy === "secret" ? "blind" : "public"]
    ];
    for (const [field, expectedValue] of expected) if (execution[field] !== expectedValue) return failure([error(`pending-check-result-${field}-mismatch`, `executionResult.${field}`, `Execution ${field} does not match the prepared pending check.`)], warnings);

    const persistedResult = { total: execution.result.total, degreeOfSuccess: execution.result.degreeOfSuccess, degreeOfSuccessSlug: execution.result.degreeOfSuccessSlug, statisticSlug: execution.statisticSlug, dc: execution.dc, rollMode: execution.rollMode };
    let candidate;
    try { candidate = clonePlainData(state); } catch {
      return failure([error("pending-check-result-candidate-construction-failed", "encounterState", "Pending check result candidate could not be cloned.")], warnings);
    }
    candidate.pendingChecks[idIndex].status = STATUSES.RESOLVED;
    candidate.pendingChecks[idIndex].result = persistedResult;
    candidate.revision = state.revision + 1;
    const final = validateVoyageEncounterState(candidate);
    const finalPending = validateVoyageEncounterPendingChecks(candidate);
    warnings.push(...final.warnings, ...finalPending.warnings);
    if (!final.valid || !finalPending.valid) return failure([...final.errors, ...finalPending.errors], warnings);
    const resolvedCheckCount = candidate.pendingChecks.filter((check) => check.status === STATUSES.RESOLVED).length;
    const remainingCheckCount = candidate.pendingChecks.length - resolvedCheckCount;
    return { ok: true, nextState: candidate, events: [{ type: "voyage.pending-check-resolved", encounterId: candidate.encounterId, lifecycleState: candidate.lifecycleState, roundNumber: candidate.roundNumber, phase: candidate.phase, pendingCheckId: record.pendingCheckId, sequence: record.sequence, stationId: record.stationId, actionId: record.actionId, resolvedCheckCount, remainingCheckCount, allChecksResolved: remainingCheckCount === 0, previousRevision: state.revision, revision: candidate.revision }], errors: [], warnings: deduplicateVoyageResolutionIssues(warnings) };
  } catch {
    return failure([error("pending-check-result-data-read-failed", "executionResult", "Pending check result data could not be read safely.")]);
  }
}
