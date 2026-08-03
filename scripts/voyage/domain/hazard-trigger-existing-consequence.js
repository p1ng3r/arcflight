import { VOYAGE_HAZARD_COLLISION_POLICIES } from "./constants.js";
import { analyzeVoyageHazardCollisionPlan } from "./hazard-collision.js";
import {
  captureVoyageHazardRecord,
  validateVoyageHazardRecord
} from "./hazard-schema.js";
import { validateVoyageEncounterState } from "./validation.js";

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const RESULT_FIELDS = Object.freeze([
  "structurallyValid",
  "readyForHazardCollisionPlanning",
  "collision",
  "plan",
  "errors",
  "warnings"
]);
const PLAN_FIELDS = Object.freeze([
  "kind",
  "encounterId",
  "expectedRevision",
  "incomingHazardId",
  "existingHazardId",
  "existingHazardIndex",
  "pressureSystemId",
  "collisionPolicy",
  "incomingHazard",
  "existingHazard",
  "collisionPayload",
  "recommendedOperation"
]);

function issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function failure(code, path, message) {
  return {
    ok: false,
    collision: false,
    activeHazards: null,
    consequence: null,
    collisionOutcome: null,
    errors: [issue(code, path, message)],
    warnings: []
  };
}

function success(collision, activeHazards, consequence = null, collisionOutcome = null) {
  return {
    ok: true,
    collision,
    activeHazards,
    consequence,
    collisionOutcome,
    errors: [],
    warnings: []
  };
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function captureFailure(path) {
  return { ok: false, path };
}

function capturePlainData(value, path = "$", ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return { ok: true, value };
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? { ok: true, value } : captureFailure(path);
  }
  if (typeof value !== "object" || ancestors.has(value)) return captureFailure(path);

  let prototype;
  let array;
  let ownKeys;
  try {
    prototype = Object.getPrototypeOf(value);
    array = Array.isArray(value);
    ownKeys = Reflect.ownKeys(value);
  } catch {
    return captureFailure(path);
  }
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    return captureFailure(path);
  }

  ancestors.add(value);
  try {
    if (array) {
      const length = Object.getOwnPropertyDescriptor(value, "length");
      if (!length || !Object.hasOwn(length, "value") || !Number.isSafeInteger(length.value) || length.value < 0 || ownKeys.length !== length.value + 1) {
        return captureFailure(path);
      }
      const clone = new Array(length.value);
      for (let index = 0; index < length.value; index += 1) {
        const key = String(index);
        if (!ownKeys.includes(key)) return captureFailure(`${path}[${index}]`);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) return captureFailure(`${path}[${index}]`);
        const nested = capturePlainData(descriptor.value, `${path}[${index}]`, ancestors);
        if (!nested.ok) return nested;
        clone[index] = nested.value;
      }
      for (const key of ownKeys) {
        if (key !== "length" && (typeof key !== "string" || !/^0$|^[1-9]\d*$/.test(key) || Number(key) >= length.value)) {
          return captureFailure(`${path}.${typeof key === "symbol" ? "[symbol]" : key}`);
        }
      }
      return { ok: true, value: clone };
    }

    const clone = {};
    for (const key of ownKeys) {
      if (typeof key !== "string" || UNSAFE_KEYS.has(key)) return captureFailure(`${path}.${typeof key === "symbol" ? "[symbol]" : key}`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) return captureFailure(`${path}.${key}`);
      const nested = capturePlainData(descriptor.value, `${path}.${key}`, ancestors);
      if (!nested.ok) return nested;
      clone[key] = nested.value;
    }
    return { ok: true, value: clone };
  } catch {
    return captureFailure(path);
  } finally {
    ancestors.delete(value);
  }
}

function clonePlainData(value) {
  if (Array.isArray(value)) return value.map((entry) => clonePlainData(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clonePlainData(entry)]));
  }
  return value;
}

function samePlainData(left, right) {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null || Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left)) {
    if (left.length !== right.length || Object.keys(left).length !== Object.keys(right).length) return false;
    return left.every((entry, index) => Object.hasOwn(right, index) && samePlainData(entry, right[index]));
  }
  if (typeof left !== "object") return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && samePlainData(left[key], right[key]));
}

function exactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}

function validInternallyGeneratedAnalysis(analysis) {
  return isPlainObject(analysis)
    && exactKeys(analysis, RESULT_FIELDS)
    && analysis.structurallyValid === true
    && analysis.readyForHazardCollisionPlanning === true
    && Array.isArray(analysis.errors)
    && analysis.errors.length === 0
    && Array.isArray(analysis.warnings)
    && exactKeys(analysis.plan, PLAN_FIELDS);
}

function validConsequence(value) {
  return isPlainObject(value) && Object.keys(value).length > 0;
}

function captureCanonicalState(state) {
  const captured = capturePlainData(state, "encounterState");
  if (!captured.ok) return { ok: false, failure: failure("pressure-breach-application-data-read-failed", captured.path, "Repeated Pressure Breach encounter state could not be read safely.") };
  const validation = validateVoyageEncounterState(captured.value);
  if (!validation.valid) return { ok: false, failure: failure("pressure-breach-application-state-invalid", "encounterState", "Repeated Pressure Breach application requires a valid encounter state.") };
  return { ok: true, state: captured.value };
}

function captureCanonicalIncomingHazard(incomingHazard, encounterId) {
  const captured = captureVoyageHazardRecord(incomingHazard, { mode: "active", expectedEncounterId: encounterId });
  if (!captured.ok) return { ok: false, failure: failure("pressure-breach-application-hazard-invalid", "incomingHazard", "Repeated Pressure Breach application requires a valid active incoming Hazard.") };
  const validation = validateVoyageHazardRecord(captured.record, { mode: "active", expectedEncounterId: encounterId });
  if (!validation.valid) return { ok: false, failure: failure("pressure-breach-application-hazard-invalid", "incomingHazard", "Repeated Pressure Breach application requires a valid active incoming Hazard.") };
  return { ok: true, hazard: captured.record };
}

/**
 * Apply only the Hazard-side interpretation of a repeated Pressure Breach.
 * Collision analysis is regenerated from the canonical request inside this
 * boundary; callers cannot authorize an outcome with a supplied plan.
 */
export function applyVoyageHazardTriggerExistingConsequence(encounterState, incomingHazard) {
  const stateCapture = captureCanonicalState(encounterState);
  if (!stateCapture.ok) return stateCapture.failure;
  const incomingCapture = captureCanonicalIncomingHazard(incomingHazard, stateCapture.state.encounterId);
  if (!incomingCapture.ok) return incomingCapture.failure;

  try {
    const state = stateCapture.state;
    const incoming = incomingCapture.hazard;
    if (incoming.collisionPolicy !== VOYAGE_HAZARD_COLLISION_POLICIES.TRIGGER_EXISTING_CONSEQUENCE) {
      return failure("pressure-breach-application-collision-policy-invalid", "incomingHazard.collisionPolicy", "Repeated Pressure Breach application requires trigger-existing-consequence.");
    }
    const collisionAnalysis = analyzeVoyageHazardCollisionPlan(state, incoming);
    if (!validInternallyGeneratedAnalysis(collisionAnalysis)) {
      return failure("pressure-breach-application-collision-invalid", "collisionAnalysis", "Repeated Pressure Breach collision analysis could not be validated safely.");
    }
    const plan = collisionAnalysis.plan;
    if (
      plan.encounterId !== state.encounterId
      || plan.expectedRevision !== state.revision
      || plan.incomingHazardId !== incoming.hazardId
      || !samePlainData(plan.incomingHazard, incoming)
    ) {
      return failure("pressure-breach-application-collision-invalid", "collisionAnalysis.plan", "Internally generated collision analysis does not match the canonical request.");
    }

    if (plan.kind === "no-collision" && collisionAnalysis.collision === false) {
      if (
        plan.existingHazardId !== null
        || plan.existingHazardIndex !== null
        || plan.existingHazard !== null
        || plan.pressureSystemId !== incoming.pressureSystemId
        || plan.collisionPolicy !== null
        || plan.collisionPayload !== null
        || plan.recommendedOperation !== "persist-incoming"
      ) return failure("pressure-breach-application-collision-invalid", "collisionAnalysis.plan", "Internally generated no-collision analysis is invalid.");
      return success(false, clonePlainData(state.activeHazards));
    }

    const index = plan.existingHazardIndex;
    if (
      plan.kind !== "collision"
      || collisionAnalysis.collision !== true
      || !Number.isSafeInteger(index)
      || index < 0
      || index >= state.activeHazards.length
      || plan.existingHazardId !== state.activeHazards[index].hazardId
      || plan.pressureSystemId !== incoming.pressureSystemId
      || plan.collisionPolicy !== VOYAGE_HAZARD_COLLISION_POLICIES.TRIGGER_EXISTING_CONSEQUENCE
      || plan.recommendedOperation !== VOYAGE_HAZARD_COLLISION_POLICIES.TRIGGER_EXISTING_CONSEQUENCE
      || incoming.collisionPolicy !== VOYAGE_HAZARD_COLLISION_POLICIES.TRIGGER_EXISTING_CONSEQUENCE
      || !samePlainData(plan.existingHazard, state.activeHazards[index])
      || !samePlainData(plan.collisionPayload, incoming.metadata.collision)
    ) return failure("pressure-breach-application-collision-invalid", "collisionAnalysis.plan", "Internally generated collision analysis is invalid.");

    const existingHazard = state.activeHazards[index];
    const consequence = existingHazard.metadata.collision.consequence;
    if (!validConsequence(consequence)) {
      return failure("pressure-breach-application-consequence-invalid", `encounterState.activeHazards[${index}].metadata.collision.consequence`, "The existing Hazard requires one exact authored collision consequence descriptor.");
    }

    return success(true, clonePlainData(state.activeHazards), clonePlainData(consequence), {
      kind: "hazard-consequence-triggered",
      hazardId: existingHazard.hazardId,
      incomingHazardId: incoming.hazardId,
      pressureSystemId: incoming.pressureSystemId,
      collisionPolicy: incoming.collisionPolicy,
      consequence: clonePlainData(consequence)
    });
  } catch {
    return failure("pressure-breach-application-collision-invalid", "collisionAnalysis", "Repeated Pressure Breach collision application could not be completed safely.");
  }
}
