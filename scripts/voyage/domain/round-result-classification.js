import { VOYAGE_ROUND_RESULTS } from "./constants.js";
import { analyzeVoyageEncounterRoundUnitAggregation } from "./round-unit-aggregation.js";

const ROUND_RESULT_SIDES = Object.freeze({
  [VOYAGE_ROUND_RESULTS.CRITICAL_SUCCESS]: "success",
  [VOYAGE_ROUND_RESULTS.SUCCESS]: "success",
  [VOYAGE_ROUND_RESULTS.FAILURE]: "failure",
  [VOYAGE_ROUND_RESULTS.CRITICAL_FAILURE]: "failure"
});
const CANONICAL_ROUND_RESULTS = new Set(Object.values(VOYAGE_ROUND_RESULTS));

function issue(code, path, message) {
  return { code, path, message, severity: "error" };
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
    errors.push(issue("round-result-classification-upstream-diagnostics-invalid", path, "Upstream diagnostics must be a dense safe array."));
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
      errors.push(issue("round-result-classification-upstream-diagnostics-invalid", `${path}[${index}]`, "Upstream diagnostics must contain safe string fields."));
      continue;
    }
    cloned.push({ code: code.value, path: issuePath.value, message: message.value, severity: severity.value });
  }
  return cloned;
}

function invalidReport(errors = [], warnings = []) {
  return {
    aggregationReady: false,
    readyForRoundResult: false,
    successUnits: 0,
    failureUnits: 0,
    roundResult: null,
    roundResultSide: null,
    eventVictoryRoundWeight: 0,
    classificationSource: null,
    requiresAuthoredFallback: false,
    usedAuthoredFallback: false,
    errors: [...errors],
    warnings: [...warnings]
  };
}

function unresolvedReport({ aggregationReady, successUnits, failureUnits, requiresAuthoredFallback, errors, warnings }) {
  return {
    aggregationReady,
    readyForRoundResult: false,
    successUnits,
    failureUnits,
    roundResult: null,
    roundResultSide: null,
    eventVictoryRoundWeight: 0,
    classificationSource: null,
    requiresAuthoredFallback,
    usedAuthoredFallback: false,
    errors: [...errors],
    warnings: [...warnings]
  };
}

function validateAggregationReport(report) {
  const localErrors = [];
  const fields = {};
  for (const key of ["readyForAggregation", "successUnits", "failureUnits", "errors", "warnings"]) {
    const result = readOwnData(report, key);
    if (!result.ok) localErrors.push(issue("round-result-classification-upstream-field-invalid", `upstream.${key}`, "Consumed upstream fields must be own data properties."));
    fields[key] = result.value;
  }

  const preservedErrors = cloneDiagnostics(fields.errors, "upstream.errors", localErrors);
  const preservedWarnings = cloneDiagnostics(fields.warnings, "upstream.warnings", localErrors);
  if (typeof fields.readyForAggregation !== "boolean") {
    localErrors.push(issue("round-result-classification-upstream-readiness-invalid", "upstream.readyForAggregation", "Upstream aggregation readiness must be boolean."));
  }
  for (const key of ["successUnits", "failureUnits"]) {
    if (!Number.isSafeInteger(fields[key]) || fields[key] < 0) {
      localErrors.push(issue("round-result-classification-upstream-units-invalid", `upstream.${key}`, "Upstream unit totals must be non-negative safe integers."));
    }
  }
  if (fields.readyForAggregation === true && preservedErrors.length > 0) {
    localErrors.push(issue("round-result-classification-upstream-ready-with-errors", "upstream", "Upstream aggregation cannot be ready while containing errors."));
  }
  if (fields.readyForAggregation === false && (fields.successUnits !== 0 || fields.failureUnits !== 0)) {
    localErrors.push(issue("round-result-classification-upstream-not-ready-with-units", "upstream", "An unready aggregation must expose zero unit totals."));
  }
  if (localErrors.length > 0) return { ok: false, errors: [...preservedErrors, ...localErrors], warnings: preservedWarnings };
  return {
    ok: true,
    readyForAggregation: fields.readyForAggregation,
    successUnits: fields.successUnits,
    failureUnits: fields.failureUnits,
    errors: preservedErrors,
    warnings: preservedWarnings
  };
}

function classifyNonzeroUnits(successUnits, failureUnits) {
  // floor(successUnits / 2) >= failureUnits is equivalent to successUnits >= 2 * failureUnits without overflow.
  if (Math.floor(successUnits / 2) >= failureUnits) return VOYAGE_ROUND_RESULTS.CRITICAL_SUCCESS;
  if (successUnits >= failureUnits) return VOYAGE_ROUND_RESULTS.SUCCESS;
  if (Math.floor(failureUnits / 2) >= successUnits) return VOYAGE_ROUND_RESULTS.CRITICAL_FAILURE;
  return VOYAGE_ROUND_RESULTS.FAILURE;
}

export function classifyVoyageEncounterRoundUnits(successUnits, failureUnits) {
  if (!Number.isSafeInteger(successUnits) || successUnits < 0
    || !Number.isSafeInteger(failureUnits) || failureUnits < 0
    || (successUnits === 0 && failureUnits === 0)) return null;
  return classifyNonzeroUnits(successUnits, failureUnits);
}

function readOptionalOwnData(value, key) {
  try {
    if (value === null || (typeof value !== "object" && typeof value !== "function")) return { ok: false, present: true, value: undefined };
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) {
      if (key in value) return { ok: false, present: true, value: undefined };
      return { ok: true, present: false, value: undefined };
    }
    if (!Object.hasOwn(descriptor, "value")) return { ok: false, present: true, value: undefined };
    return { ok: true, present: true, value: descriptor.value };
  } catch {
    return { ok: false, present: true, value: undefined };
  }
}

function readAuthoredZeroContributionFallback(state) {
  const currentStage = readOwnData(state, "currentStage");
  if (!currentStage.ok || currentStage.value === null || typeof currentStage.value !== "object" || Array.isArray(currentStage.value)) {
    return {
      ok: false,
      error: issue("round-result-classification-fallback-invalid", "currentStage", "A zero-contribution fallback requires a valid currentStage object.")
    };
  }

  const fallback = readOptionalOwnData(currentStage.value, "zeroContributionRoundResult");
  if (!fallback.ok) {
    return {
      ok: false,
      error: issue("round-result-classification-fallback-invalid", "currentStage.zeroContributionRoundResult", "The authored zero-contribution fallback must be an own data property.")
    };
  }
  if (!fallback.present || fallback.value === null || fallback.value === undefined) return { ok: true, authored: false, roundResult: null };
  if (typeof fallback.value !== "string" || !CANONICAL_ROUND_RESULTS.has(fallback.value)) {
    return {
      ok: false,
      error: issue("round-result-classification-fallback-invalid", "currentStage.zeroContributionRoundResult", "The authored zero-contribution fallback must be a canonical round-result identifier.")
    };
  }
  return { ok: true, authored: true, roundResult: fallback.value };
}

function classifiedReport({ successUnits, failureUnits, roundResult, classificationSource, requiresAuthoredFallback, usedAuthoredFallback, errors, warnings }) {
  return {
    aggregationReady: true,
    readyForRoundResult: true,
    successUnits,
    failureUnits,
    roundResult,
    roundResultSide: ROUND_RESULT_SIDES[roundResult],
    eventVictoryRoundWeight: 1,
    classificationSource,
    requiresAuthoredFallback,
    usedAuthoredFallback,
    errors: [...errors],
    warnings: [...warnings]
  };
}

export function analyzeVoyageEncounterRoundResult(state) {
  let aggregation;
  try {
    aggregation = analyzeVoyageEncounterRoundUnitAggregation(state);
  } catch {
    return invalidReport([issue("round-result-classification-upstream-data-read-failed", "$", "Round unit aggregation could not be read safely.")]);
  }

  let validated;
  try {
    validated = validateAggregationReport(aggregation);
  } catch {
    return invalidReport([issue("round-result-classification-upstream-data-read-failed", "$", "Round unit aggregation could not be validated safely.")]);
  }
  if (!validated.ok) return invalidReport(validated.errors, validated.warnings);
  if (!validated.readyForAggregation) {
    return unresolvedReport({
      aggregationReady: false,
      successUnits: 0,
      failureUnits: 0,
      requiresAuthoredFallback: false,
      errors: validated.errors,
      warnings: validated.warnings
    });
  }

  if (validated.successUnits === 0 && validated.failureUnits === 0) {
    let fallback;
    try {
      fallback = readAuthoredZeroContributionFallback(state);
    } catch {
      return unresolvedReport({
        aggregationReady: true,
        successUnits: 0,
        failureUnits: 0,
        requiresAuthoredFallback: true,
        errors: [...validated.errors, issue("round-result-classification-fallback-invalid", "currentStage.zeroContributionRoundResult", "The authored zero-contribution fallback could not be read safely.")],
        warnings: validated.warnings
      });
    }
    if (!fallback.ok) {
      return unresolvedReport({
        aggregationReady: true,
        successUnits: 0,
        failureUnits: 0,
        requiresAuthoredFallback: true,
        errors: [...validated.errors, fallback.error],
        warnings: validated.warnings
      });
    }
    if (fallback.authored) {
      return classifiedReport({
        successUnits: 0,
        failureUnits: 0,
        roundResult: fallback.roundResult,
        classificationSource: "authored-zero-contribution-fallback",
        requiresAuthoredFallback: false,
        usedAuthoredFallback: true,
        errors: validated.errors,
        warnings: validated.warnings
      });
    }
    return unresolvedReport({
      aggregationReady: true,
      successUnits: 0,
      failureUnits: 0,
      requiresAuthoredFallback: true,
      errors: validated.errors,
      warnings: validated.warnings
    });
  }

  return classifiedReport({
    successUnits: validated.successUnits,
    failureUnits: validated.failureUnits,
    roundResult: classifyVoyageEncounterRoundUnits(validated.successUnits, validated.failureUnits),
    classificationSource: "unit-ladder",
    requiresAuthoredFallback: false,
    usedAuthoredFallback: false,
    errors: validated.errors,
    warnings: validated.warnings
  });
}
