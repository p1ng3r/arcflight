import { VOYAGE_HAZARD_TIMING_KINDS } from "./constants.js";
import { captureVoyageHazardRecord } from "./hazard-schema.js";
import { validateVoyageEncounterState } from "./validation.js";

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const RESULT_KEYS = Object.freeze([
  "structurallyValid",
  "readyForHazardOperationalTiming",
  "encounterId",
  "hazardId",
  "roundNumber",
  "createdRoundNumber",
  "operationalRoundNumber",
  "operational",
  "errors",
  "warnings"
]);

function issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function deduplicateIssues(issues) {
  const seen = new Set();
  return issues.filter((entry) => {
    const key = `${entry.severity}\u0000${entry.code}\u0000${entry.path}\u0000${entry.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function report({
  structurallyValid = false,
  readyForHazardOperationalTiming = false,
  encounterId = null,
  hazardId = null,
  roundNumber = null,
  createdRoundNumber = null,
  operationalRoundNumber = null,
  operational = false,
  errors = [],
  warnings = []
} = {}) {
  return {
    structurallyValid,
    readyForHazardOperationalTiming,
    encounterId,
    hazardId,
    roundNumber,
    createdRoundNumber,
    operationalRoundNumber,
    operational,
    errors: deduplicateIssues(errors),
    warnings: deduplicateIssues(warnings)
  };
}

function captureFailure(path) {
  return {
    ok: false,
    value: null,
    error: issue(
      "hazard-operational-timing-data-read-failed",
      path,
      "Hazard operational timing data could not be read safely."
    )
  };
}

function capturePlainData(value, path = "$", ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return { ok: true, value };
  if (typeof value === "number") return Number.isFinite(value) ? { ok: true, value } : captureFailure(path);
  if (typeof value !== "object" || ancestors.has(value)) return captureFailure(path);

  let prototype;
  let keys;
  let array;
  try {
    prototype = Object.getPrototypeOf(value);
    array = Array.isArray(value);
    keys = Reflect.ownKeys(value);
  } catch {
    return captureFailure(path);
  }
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return captureFailure(path);

  ancestors.add(value);
  try {
    if (array) {
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      const length = lengthDescriptor?.value;
      if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor, "value") || !Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1) {
        return captureFailure(path);
      }
      const clone = new Array(length);
      for (let index = 0; index < length; index += 1) {
        const key = String(index);
        let descriptor;
        try {
          descriptor = Object.getOwnPropertyDescriptor(value, key);
        } catch {
          return captureFailure(`${path}[${index}]`);
        }
        if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) return captureFailure(`${path}[${index}]`);
        const nested = capturePlainData(descriptor.value, `${path}[${index}]`, ancestors);
        if (!nested.ok) return nested;
        clone[index] = nested.value;
      }
      return { ok: true, value: clone };
    }

    const clone = {};
    for (const key of keys) {
      if (typeof key !== "string" || UNSAFE_KEYS.has(key)) return captureFailure(`${path}.${typeof key === "symbol" ? "[symbol]" : key}`);
      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
      } catch {
        return captureFailure(`${path}.${key}`);
      }
      if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) return captureFailure(`${path}.${key}`);
      const nested = capturePlainData(descriptor.value, `${path}.${key}`, ancestors);
      if (!nested.ok) return nested;
      clone[key] = nested.value;
    }
    return { ok: true, value: clone };
  } finally {
    ancestors.delete(value);
  }
}

function rebaseIssues(errors, path) {
  return errors.map((entry) => ({
    ...entry,
    path: entry.path === "$" ? path : `${path}${entry.path.startsWith("$") ? entry.path.slice(1) : `.${entry.path}`}`
  }));
}

/**
 * Determine whether one persisted active Hazard is operational at the current
 * round. This is pure eligibility analysis; it never activates or executes a
 * Hazard effect.
 */
export function analyzeVoyageHazardOperationalTiming(encounterState, hazard) {
  const capturedState = capturePlainData(encounterState, "encounterState");
  if (!capturedState.ok) return report({ errors: [capturedState.error] });
  const capturedHazard = capturePlainData(hazard, "hazard");
  if (!capturedHazard.ok) return report({ errors: [capturedHazard.error] });

  const stateValidation = validateVoyageEncounterState(capturedState.value);
  if (!stateValidation.valid) {
    return report({
      errors: [
        issue("hazard-operational-timing-state-invalid", "encounterState", "Hazard operational timing requires a valid Voyage Encounter state."),
        ...rebaseIssues(stateValidation.errors, "encounterState")
      ],
      warnings: stateValidation.warnings
    });
  }

  const hazardCapture = captureVoyageHazardRecord(capturedHazard.value, {
    mode: "active",
    expectedEncounterId: capturedState.value.encounterId
  });
  if (!hazardCapture.ok) {
    return report({
      encounterId: capturedState.value.encounterId,
      roundNumber: capturedState.value.roundNumber,
      errors: [
        issue("hazard-operational-timing-hazard-invalid", "hazard", "Hazard operational timing requires one valid active Hazard."),
        ...rebaseIssues(hazardCapture.errors, "hazard")
      ],
      warnings: stateValidation.warnings
    });
  }

  const captured = hazardCapture.record;
  if (captured.activationTiming.kind !== VOYAGE_HAZARD_TIMING_KINDS.START_OF_NEXT_ROUND) {
    return report({
      structurallyValid: true,
      encounterId: capturedState.value.encounterId,
      hazardId: captured.hazardId,
      roundNumber: capturedState.value.roundNumber,
      createdRoundNumber: captured.createdRoundNumber,
      errors: [issue(
        "hazard-operational-timing-not-applicable",
        "hazard.activationTiming.kind",
        "Operational timing analysis currently supports only start-of-next-round Hazards."
      )],
      warnings: stateValidation.warnings
    });
  }

  const operationalRoundNumber = captured.createdRoundNumber + 1;
  if (!Number.isSafeInteger(operationalRoundNumber)) {
    return report({
      encounterId: capturedState.value.encounterId,
      hazardId: captured.hazardId,
      roundNumber: capturedState.value.roundNumber,
      createdRoundNumber: captured.createdRoundNumber,
      errors: [issue(
        "hazard-operational-timing-round-overflow",
        "hazard.createdRoundNumber",
        "Hazard operational round cannot be represented as a safe integer."
      )],
      warnings: stateValidation.warnings
    });
  }

  return report({
    structurallyValid: true,
    readyForHazardOperationalTiming: true,
    encounterId: capturedState.value.encounterId,
    hazardId: captured.hazardId,
    roundNumber: capturedState.value.roundNumber,
    createdRoundNumber: captured.createdRoundNumber,
    operationalRoundNumber,
    operational: capturedState.value.roundNumber >= operationalRoundNumber,
    warnings: stateValidation.warnings
  });
}
