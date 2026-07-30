import {
  VOYAGE_MOMENTUM_MAX,
  VOYAGE_MOMENTUM_MIN,
  VOYAGE_ROUND_RESULTS
} from "./constants.js";
import { clonePlainData } from "./defaults.js";
import { analyzeVoyageEncounterRoundResult } from "./round-result-classification.js";
import { validateVoyageEncounterState } from "./validation.js";

const ROUND_RESULT_SIDES = Object.freeze({
  [VOYAGE_ROUND_RESULTS.CRITICAL_SUCCESS]: "success",
  [VOYAGE_ROUND_RESULTS.SUCCESS]: "success",
  [VOYAGE_ROUND_RESULTS.FAILURE]: "failure",
  [VOYAGE_ROUND_RESULTS.CRITICAL_FAILURE]: "failure"
});
const ROUND_RESULT_SOURCES = new Set(["unit-ladder", "authored-zero-contribution-fallback"]);

function issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function cloneIssue(entry) {
  return {
    code: entry.code,
    path: entry.path,
    message: entry.message,
    severity: entry.severity
  };
}

function deduplicateIssues(entries) {
  const seen = new Set();
  const result = [];
  for (const entry of entries) {
    const cloned = cloneIssue(entry);
    const identity = `${cloned.code}\u0000${cloned.path}\u0000${cloned.message}\u0000${cloned.severity}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    result.push(cloned);
  }
  return result;
}

function applicationFailure(errors, warnings = []) {
  return {
    ok: false,
    nextState: null,
    events: [],
    errors: deduplicateIssues(errors),
    warnings: deduplicateIssues(warnings)
  };
}

function readOwnData(value, key) {
  try {
    if (value === null || (typeof value !== "object" && typeof value !== "function")) return { ok: false, value: undefined };
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return { ok: false, value: undefined };
    return { ok: true, value: descriptor.value };
  } catch {
    return { ok: false, value: undefined };
  }
}

function ownArrayEntries(value) {
  try {
    if (!Array.isArray(value)) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor, "value")
      || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) return null;
    const entries = [];
    for (const key of Reflect.ownKeys(value)) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key)) return null;
      const index = Number(key);
      if (!Number.isSafeInteger(index) || index >= lengthDescriptor.value) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
      entries.push({ index, value: descriptor.value });
    }
    entries.sort((left, right) => left.index - right.index);
    if (entries.length !== lengthDescriptor.value || entries.some(({ index }, expected) => index !== expected)) return null;
    return entries;
  } catch {
    return null;
  }
}

function cloneDiagnostics(value, path, errors) {
  const entries = ownArrayEntries(value);
  if (!entries) {
    errors.push(issue("momentum-upstream-diagnostics-invalid", path, "Round-result diagnostics must be a dense safe array."));
    return [];
  }
  const cloned = [];
  for (const { index, value: entry } of entries) {
    const code = readOwnData(entry, "code");
    const issuePath = readOwnData(entry, "path");
    const message = readOwnData(entry, "message");
    const severity = readOwnData(entry, "severity");
    if (!code.ok || !issuePath.ok || !message.ok || !severity.ok
      || typeof code.value !== "string" || typeof issuePath.value !== "string"
      || typeof message.value !== "string" || typeof severity.value !== "string") {
      errors.push(issue("momentum-upstream-diagnostics-invalid", `${path}[${index}]`, "Round-result diagnostics must contain safe string fields."));
      continue;
    }
    cloned.push({ code: code.value, path: issuePath.value, message: message.value, severity: severity.value });
  }
  return cloned;
}

function readCurrentMomentum(state) {
  const momentum = readOwnData(state, "momentum");
  if (!momentum.ok || !Number.isSafeInteger(momentum.value)
    || momentum.value < VOYAGE_MOMENTUM_MIN || momentum.value > VOYAGE_MOMENTUM_MAX) {
    return {
      ok: false,
      value: 0,
      error: issue("momentum-invalid-state-value", "momentum", "Momentum must be an own non-negative safe integer from 0 through 3.")
    };
  }
  return { ok: true, value: momentum.value };
}

function validateRoundResultReport(report) {
  const localErrors = [];
  const fields = {};
  for (const key of [
    "aggregationReady",
    "readyForRoundResult",
    "roundResult",
    "roundResultSide",
    "classificationSource",
    "requiresAuthoredFallback",
    "usedAuthoredFallback",
    "errors",
    "warnings"
  ]) {
    const result = readOwnData(report, key);
    if (!result.ok) localErrors.push(issue("momentum-round-result-field-invalid", `roundResult.${key}`, "Consumed round-result fields must be own data properties."));
    fields[key] = result.value;
  }

  const preservedErrors = cloneDiagnostics(fields.errors, "roundResult.errors", localErrors);
  const preservedWarnings = cloneDiagnostics(fields.warnings, "roundResult.warnings", localErrors);
  if (typeof fields.aggregationReady !== "boolean") localErrors.push(issue("momentum-round-result-readiness-invalid", "roundResult.aggregationReady", "Round-result aggregation readiness must be boolean."));
  if (typeof fields.readyForRoundResult !== "boolean") localErrors.push(issue("momentum-round-result-readiness-invalid", "roundResult.readyForRoundResult", "Round-result readiness must be boolean."));
  if (typeof fields.requiresAuthoredFallback !== "boolean") localErrors.push(issue("momentum-round-result-fallback-metadata-invalid", "roundResult.requiresAuthoredFallback", "Round-result fallback metadata must be boolean."));
  if (typeof fields.usedAuthoredFallback !== "boolean") localErrors.push(issue("momentum-round-result-fallback-metadata-invalid", "roundResult.usedAuthoredFallback", "Round-result fallback metadata must be boolean."));

  const canonicalResult = typeof fields.roundResult === "string" && Object.hasOwn(ROUND_RESULT_SIDES, fields.roundResult);
  if (fields.readyForRoundResult === true) {
    if (fields.aggregationReady !== true || !canonicalResult) localErrors.push(issue("momentum-round-result-inconsistent", "roundResult", "A ready round result must be a canonical classified result from ready aggregation."));
    if (fields.roundResultSide !== ROUND_RESULT_SIDES[fields.roundResult]) localErrors.push(issue("momentum-round-result-side-invalid", "roundResult.roundResultSide", "Round-result side must match the canonical result."));
    if (typeof fields.classificationSource !== "string" || !ROUND_RESULT_SOURCES.has(fields.classificationSource)) localErrors.push(issue("momentum-round-result-source-invalid", "roundResult.classificationSource", "Round-result classification source is not recognized."));
    if (fields.requiresAuthoredFallback !== false || fields.usedAuthoredFallback !== (fields.classificationSource === "authored-zero-contribution-fallback")) localErrors.push(issue("momentum-round-result-fallback-metadata-invalid", "roundResult", "Classified round-result fallback metadata is contradictory."));
    if (preservedErrors.length > 0) localErrors.push(issue("momentum-round-result-ready-with-errors", "roundResult", "A ready round result cannot contain errors."));
  } else {
    if (fields.roundResult !== null || fields.roundResultSide !== null || fields.classificationSource !== null || fields.usedAuthoredFallback !== false) {
      localErrors.push(issue("momentum-round-result-inconsistent", "roundResult", "An unresolved round result must expose null classification metadata."));
    }
  }

  return {
    ok: localErrors.length === 0,
    aggregationReady: fields.aggregationReady,
    readyForRoundResult: fields.readyForRoundResult,
    roundResult: fields.roundResult,
    roundResultSide: fields.roundResultSide,
    classificationSource: fields.classificationSource,
    requiresAuthoredFallback: fields.requiresAuthoredFallback,
    usedAuthoredFallback: fields.usedAuthoredFallback,
    errors: [...preservedErrors, ...localErrors],
    warnings: preservedWarnings
  };
}

function report({ currentMomentum, nextMomentum, momentumDelta, roundResultReady, readyForMomentumUpdate, roundResult, roundResultSide, classificationSource, appliesBeginningWithNextCheck, requiresAuthoredFallback, usedAuthoredFallback, errors, warnings }) {
  return {
    roundResultReady,
    readyForMomentumUpdate,
    currentMomentum,
    momentumDelta,
    nextMomentum,
    roundResult,
    roundResultSide,
    classificationSource,
    appliesBeginningWithNextCheck,
    requiresAuthoredFallback,
    usedAuthoredFallback,
    errors: [...errors],
    warnings: [...warnings]
  };
}

export function analyzeVoyageEncounterMomentumUpdate(state) {
  let roundResultReport;
  try {
    roundResultReport = analyzeVoyageEncounterRoundResult(state);
  } catch {
    roundResultReport = null;
  }

  const current = readCurrentMomentum(state);
  let validatedRoundResult;
  try {
    validatedRoundResult = validateRoundResultReport(roundResultReport);
  } catch {
    validatedRoundResult = {
      ok: false,
      aggregationReady: false,
      readyForRoundResult: false,
      roundResult: null,
      roundResultSide: null,
      classificationSource: null,
      requiresAuthoredFallback: false,
      usedAuthoredFallback: false,
      errors: [issue("momentum-round-result-read-failed", "roundResult", "Round-result analysis could not be validated safely.")],
      warnings: []
    };
  }

  const errors = [...validatedRoundResult.errors];
  const warnings = [...validatedRoundResult.warnings];
  if (!current.ok) errors.push(current.error);

  const roundResultContextReadable =
    validatedRoundResult.ok
    && validatedRoundResult.aggregationReady === true;

  const roundResultReady =
    roundResultContextReadable
    && validatedRoundResult.readyForRoundResult === true;

  if (!current.ok || !roundResultReady) {
    return report({
      currentMomentum: current.value,
      nextMomentum: current.value,
      momentumDelta: 0,
      roundResultReady,
      readyForMomentumUpdate: false,
      roundResult: roundResultContextReadable
        ? validatedRoundResult.roundResult
        : null,
      roundResultSide: roundResultContextReadable
        ? validatedRoundResult.roundResultSide
        : null,
      classificationSource: roundResultContextReadable
        ? validatedRoundResult.classificationSource
        : null,
      appliesBeginningWithNextCheck: false,
      requiresAuthoredFallback: roundResultContextReadable
        ? validatedRoundResult.requiresAuthoredFallback
        : false,
      usedAuthoredFallback: roundResultContextReadable
        ? validatedRoundResult.usedAuthoredFallback
        : false,
      errors,
      warnings
    });
  }

  const momentumDelta = validatedRoundResult.roundResultSide === "success" ? 1 : -1;
  const nextMomentum = momentumDelta === 1
    ? Math.min(current.value + 1, VOYAGE_MOMENTUM_MAX)
    : Math.max(current.value - 1, VOYAGE_MOMENTUM_MIN);
  return report({
    currentMomentum: current.value,
    nextMomentum,
    momentumDelta,
    roundResultReady: true,
    readyForMomentumUpdate: true,
    roundResult: validatedRoundResult.roundResult,
    roundResultSide: validatedRoundResult.roundResultSide,
    classificationSource: validatedRoundResult.classificationSource,
    appliesBeginningWithNextCheck: true,
    requiresAuthoredFallback: validatedRoundResult.requiresAuthoredFallback,
    usedAuthoredFallback: validatedRoundResult.usedAuthoredFallback,
    errors,
    warnings
  });
}
export function applyVoyageEncounterMomentumUpdate(state) {
  try {
    const analysis = analyzeVoyageEncounterMomentumUpdate(state);
    const warnings = [...analysis.warnings];

    if (!analysis.readyForMomentumUpdate) {
      return applicationFailure([
        ...analysis.errors,
        issue(
          "momentum-update-not-ready",
          "roundResult",
          "Momentum update requires a ready classified round result and valid current Momentum."
        )
      ], warnings);
    }

    let candidate;
    try {
      candidate = clonePlainData(state);
    } catch {
      return applicationFailure([
        issue(
          "momentum-candidate-construction-failed",
          "encounterState",
          "Momentum update could not clone the Voyage Encounter state."
        )
      ], warnings);
    }

    candidate.momentum = analysis.nextMomentum;
    candidate.revision = state.revision + 1;

    const final = validateVoyageEncounterState(candidate);
    warnings.push(...final.warnings);
    if (!final.valid) return applicationFailure(final.errors, warnings);

    return {
      ok: true,
      nextState: candidate,
      events: [{
        type: "voyage.momentum-updated",
        encounterId: candidate.encounterId,
        lifecycleState: candidate.lifecycleState,
        roundNumber: candidate.roundNumber,
        phase: candidate.phase,
        roundResult: analysis.roundResult,
        roundResultSide: analysis.roundResultSide,
        classificationSource: analysis.classificationSource,
        usedAuthoredFallback: analysis.usedAuthoredFallback,
        previousMomentum: analysis.currentMomentum,
        momentumDelta: analysis.momentumDelta,
        momentum: candidate.momentum,
        appliesBeginningWithNextCheck: analysis.appliesBeginningWithNextCheck,
        previousRevision: state.revision,
        revision: candidate.revision
      }],
      errors: [],
      warnings: deduplicateIssues(warnings)
    };
  } catch {
    return applicationFailure([
      issue(
        "momentum-update-failed",
        "encounterState",
        "Momentum update could not be completed safely."
      )
    ]);
  }
}
