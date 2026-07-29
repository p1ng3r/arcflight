import {
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES as LIFE,
  VOYAGE_ROUND_PHASES as PHASES,
  VOYAGE_PENDING_CHECK_STATUSES as STATUSES
} from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyageEncounterState } from "./validation.js";
import { validateVoyageEncounterPendingChecks } from "./pending-checks.js";
import { deduplicateVoyageResolutionIssues } from "./resolution-order.js";

const RESULT_DEGREE_SLUGS = [
  "critical-failure",
  "failure",
  "success",
  "critical-success"
];

const error = (code, path, message) => ({ code, path, message, severity: "error" });

const fail = (errors, warnings = []) => ({
  ok: false,
  nextState: null,
  events: [],
  errors: deduplicateVoyageResolutionIssues(errors),
  warnings: deduplicateVoyageResolutionIssues(warnings)
});

function hasExactOwnDataFields(value, fields) {
  try {
    if (!isPlainObject(value)) return false;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== fields.length) return false;
    for (const key of keys) {
      if (typeof key !== "string" || !fields.includes(key)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, "value")) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isOrdinaryEmptyArray(value) {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== 0) return false;
    return Reflect.ownKeys(value).length === 1
      && Object.getOwnPropertyDescriptor(value, "length")?.value === 0;
  } catch {
    return false;
  }
}

function validExecutionResult(value) {
  const fields = [
    "ok",
    "status",
    "pendingCheckId",
    "sequence",
    "sourceKind",
    "sourceUuid",
    "statisticSlug",
    "dc",
    "rollMode",
    "result",
    "errors",
    "warnings"
  ];

  try {
    if (!hasExactOwnDataFields(value, fields)
      || value.ok !== true
      || value.status !== "rolled"
      || value.sourceKind !== "character"
      || typeof value.pendingCheckId !== "string"
      || typeof value.sourceUuid !== "string"
      || typeof value.statisticSlug !== "string"
      || !Number.isSafeInteger(value.sequence)
      || value.sequence < 0
      || !Number.isSafeInteger(value.dc)
      || value.dc < 0
      || !["public", "blind"].includes(value.rollMode)
      || !isOrdinaryEmptyArray(value.errors)
      || !isOrdinaryEmptyArray(value.warnings)) {
      return false;
    }

    const result = value.result;
    return hasExactOwnDataFields(result, ["total", "degreeOfSuccess", "degreeOfSuccessSlug"])
      && Number.isFinite(result.total)
      && Number.isSafeInteger(result.degreeOfSuccess)
      && result.degreeOfSuccess >= 0
      && result.degreeOfSuccess <= 3
      && result.degreeOfSuccessSlug === RESULT_DEGREE_SLUGS[result.degreeOfSuccess];
  } catch {
    return false;
  }
}

function ownValue(object, key) {
  if (object === null || (typeof object !== "object" && typeof object !== "function")) {
    return { present: false, ok: false, value: undefined };
  }
  try {
    if (!Object.hasOwn(object, key)) return { present: false, ok: true, value: undefined };
    return { present: true, ok: true, value: object[key] };
  } catch {
    return { present: true, ok: false, value: undefined };
  }
}

function ownPendingCheckEntries(pendingChecks) {
  const entries = [];
  if (!Array.isArray(pendingChecks)) return entries;

  for (let index = 0; index < pendingChecks.length; index += 1) {
    if (Object.hasOwn(pendingChecks, index)) entries.push({ index, record: pendingChecks[index] });
  }
  return entries;
}

export function applyVoyageEncounterPendingCheckResult(state, executionResult) {
  try {
    const structural = validateVoyageEncounterState(state);
    if (!structural.valid) return fail(structural.errors, structural.warnings);

    const authoritative = validateVoyageEncounterPendingChecks(state);
    const warnings = [...structural.warnings, ...authoritative.warnings];
    if (!authoritative.valid) return fail(authoritative.errors, warnings);

    if (state.lifecycleState !== LIFE.ACTIVE || state.phase !== PHASES.RESOLUTION) {
      return fail([
        error(
          "pending-check-result-requires-resolution",
          "phase",
          "Applying a pending-check result requires an Active Resolution encounter."
        )
      ], warnings);
    }

    if (!validExecutionResult(executionResult)) {
      return fail([
        error(
          "invalid-pending-check-result-application",
          "executionResult",
          "Result application requires the exact normalized successful execution-result contract."
        )
      ], warnings);
    }

    let matchedIndex = -1;
    let matchedStatus = undefined;
    let matchedResult = undefined;
    for (const { index, record } of ownPendingCheckEntries(state.pendingChecks)) {
      const pendingCheckId = ownValue(record, "pendingCheckId");
      const sequence = ownValue(record, "sequence");
      const source = ownValue(record, "source");
      const statisticSlugOrAbilityId = ownValue(record, "statisticSlugOrAbilityId");
      const finalDc = ownValue(record, "finalDc");
      const secrecy = ownValue(record, "secrecy");
      const status = ownValue(record, "status");
      const result = ownValue(record, "result");

      if (![pendingCheckId, sequence, source, statisticSlugOrAbilityId, finalDc, secrecy, status, result].every((read) => read.ok)) continue;

      const sourceValue = source.value;
      const expectedRollMode = secrecy.value === "secret" ? "blind" : "public";
      const matches = pendingCheckId.value === executionResult.pendingCheckId
        && sequence.value === executionResult.sequence
        && sourceValue?.kind === executionResult.sourceKind
        && sourceValue?.uuid === executionResult.sourceUuid
        && statisticSlugOrAbilityId.value === executionResult.statisticSlug
        && finalDc.value === executionResult.dc
        && expectedRollMode === executionResult.rollMode;

      if (matches) {
        if (matchedIndex !== -1) {
          return fail([
            error("pending-check-result-mismatch", "executionResult", "Result matches more than one pending check.")
          ], warnings);
        }
        matchedIndex = index;
        matchedStatus = status.value;
        matchedResult = result.value;
      }
    }

    if (matchedIndex === -1) {
      return fail([
        error("pending-check-result-mismatch", "executionResult", "Result does not match one pending check.")
      ], warnings);
    }

    if (matchedStatus !== STATUSES.PENDING || matchedResult !== null) {
      return fail([
        error("pending-check-result-mismatch", "executionResult", "Result target must still be pending with a null result.")
      ], warnings);
    }

    const candidate = clonePlainData(state);
    const candidateTarget = candidate.pendingChecks[matchedIndex];
    candidateTarget.status = STATUSES.RESOLVED;
    candidateTarget.result = {
      total: executionResult.result.total,
      degreeOfSuccess: executionResult.result.degreeOfSuccess,
      degreeOfSuccessSlug: executionResult.result.degreeOfSuccessSlug,
      statisticSlug: executionResult.statisticSlug,
      dc: executionResult.dc,
      rollMode: executionResult.rollMode
    };
    candidate.revision = state.revision + 1;

    const final = validateVoyageEncounterState(candidate);
    const pending = validateVoyageEncounterPendingChecks(candidate);
    warnings.push(...final.warnings, ...pending.warnings);
    if (!final.valid || !pending.valid) return fail([...final.errors, ...pending.errors], warnings);

    let resolvedCheckCount = 0;
    let pendingCheckCount = 0;
    for (const { record } of ownPendingCheckEntries(candidate.pendingChecks)) {
      pendingCheckCount += 1;
      if (record.status === STATUSES.RESOLVED) resolvedCheckCount += 1;
    }
    const remainingCheckCount = pendingCheckCount - resolvedCheckCount;

    return {
      ok: true,
      nextState: candidate,
      events: [{
        type: "voyage.pending-check-resolved",
        encounterId: candidate.encounterId,
        lifecycleState: candidate.lifecycleState,
        roundNumber: candidate.roundNumber,
        phase: candidate.phase,
        pendingCheckId: candidateTarget.pendingCheckId,
        sequence: candidateTarget.sequence,
        stationId: candidateTarget.stationId,
        actionId: candidateTarget.actionId,
        resolvedCheckCount,
        remainingCheckCount,
        allChecksResolved: remainingCheckCount === 0,
        previousRevision: state.revision,
        revision: candidate.revision
      }],
      errors: [],
      warnings: deduplicateVoyageResolutionIssues(warnings)
    };
  } catch {
    return fail([
      error(
        "pending-check-result-application-failed",
        "executionResult",
        "Result application could not be completed safely."
      )
    ]);
  }
}
