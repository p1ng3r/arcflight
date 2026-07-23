import {
  VOYAGE_ACTION_EXECUTION_MODES as MODES,
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES as LIFE,
  VOYAGE_ROUND_PHASES as PHASES,
  VOYAGE_PENDING_CHECK_STATUSES as STATUSES
} from "./constants.js";
import { validateVoyageEncounterState } from "./validation.js";
import { validateVoyageEncounterPendingChecks } from "./pending-checks.js";
import { analyzeVoyageEncounterActionExecutionRequests } from "./resolution-execution-requests.js";
import { deduplicateVoyageResolutionIssues } from "./resolution-order.js";

const error = (code, path, message) => ({ code, path, message, severity: "error" });

function failed(errors, warnings = []) {
  return {
    structurallyValid: false,
    active: false,
    resolution: false,
    readyForConsequences: false,
    actionCount: 0,
    checkCount: 0,
    noRollActionCount: 0,
    pendingCheckCount: 0,
    resolvedCheckCount: 0,
    unresolvedCheckCount: 0,
    unresolvedChecks: [],
    errors,
    warnings
  };
}

function ownPendingCheckEntries(pendingChecks) {
  const entries = [];
  if (!Array.isArray(pendingChecks)) return entries;

  for (let index = 0; index < pendingChecks.length; index += 1) {
    if (Object.hasOwn(pendingChecks, index)) entries.push(pendingChecks[index]);
  }
  return entries;
}

function completeReport({
  structurallyValid,
  active,
  resolution,
  readyForConsequences,
  actionCount,
  checkCount,
  noRollActionCount,
  pendingCheckCount,
  resolvedCheckCount,
  unresolvedChecks,
  errors,
  warnings
}) {
  return {
    structurallyValid,
    active,
    resolution,
    readyForConsequences,
    actionCount,
    checkCount,
    noRollActionCount,
    pendingCheckCount,
    resolvedCheckCount,
    unresolvedCheckCount: unresolvedChecks.length,
    unresolvedChecks,
    errors: deduplicateVoyageResolutionIssues(errors),
    warnings: deduplicateVoyageResolutionIssues(warnings)
  };
}

export function prepareVoyageEncounterResolutionCompletion(state) {
  try {
    const structural = validateVoyageEncounterState(state);
    const report = analyzeVoyageEncounterActionExecutionRequests(state, { requireResolution: false });
    const pending = validateVoyageEncounterPendingChecks(state);
    const requests = Array.isArray(report.executionRequests) ? report.executionRequests : [];
    const checkCount = requests.filter((request) => request.mode === MODES.CHECK).length;
    const pendingRecords = ownPendingCheckEntries(state?.pendingChecks);
    const pendingCheckCount = pendingRecords.length;
    const resolvedCheckCount = pendingRecords.filter((record) => record?.status === STATUSES.RESOLVED).length;
    const unresolvedChecks = pendingRecords
      .filter((record) => record?.status !== STATUSES.RESOLVED)
      .map((record) => ({
        pendingCheckId: record?.pendingCheckId,
        sequence: record?.sequence,
        stationId: record?.stationId,
        actionId: record?.actionId
      }))
      .sort((left, right) => left.sequence - right.sequence);
    const active = state?.lifecycleState === LIFE.ACTIVE;
    const resolution = state?.phase === PHASES.RESOLUTION;
    const errors = [...structural.errors, ...report.errors, ...pending.errors];
    const warnings = [...structural.warnings, ...report.warnings, ...pending.warnings];
    const countsMatch = pendingCheckCount === checkCount;

    if (!countsMatch) {
      errors.push(error(
        checkCount > 0 && pendingCheckCount === 0
          ? "resolution-pending-checks-not-prepared"
          : "resolution-pending-check-count-mismatch",
        "pendingChecks",
        "Resolution pending-check count must equal the required check count."
      ));
    }

    const structurallyValid = structural.valid
      && report.errors.length === 0
      && pending.valid
      && countsMatch;
    const readyForConsequences = structurallyValid
      && active
      && resolution
      && unresolvedChecks.length === 0;

    return completeReport({
      structurallyValid,
      active,
      resolution,
      readyForConsequences,
      actionCount: requests.length,
      checkCount,
      noRollActionCount: requests.length - checkCount,
      pendingCheckCount,
      resolvedCheckCount,
      unresolvedChecks,
      errors,
      warnings
    });
  } catch {
    return failed([
      error(
        "resolution-completion-failed",
        "$",
        "Resolution completion could not be prepared safely."
      )
    ]);
  }
}
