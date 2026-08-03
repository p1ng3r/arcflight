import {
  VOYAGE_HAZARD_CATEGORIES,
  VOYAGE_HAZARD_COLLISION_POLICIES,
  VOYAGE_HAZARD_STATUSES
} from "./constants.js";
import {
  captureVoyageHazardRecord,
  validateVoyageHazardRecord
} from "./hazard-schema.js";
import { validateVoyageEncounterState } from "./validation.js";

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const COLLISION_POLICIES = new Set(Object.values(VOYAGE_HAZARD_COLLISION_POLICIES));

function issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function rebaseIssue(error, basePath) {
  const path = typeof error?.path === "string" ? error.path : "$";
  const suffix = path === "$"
    ? ""
    : path.startsWith("$")
      ? path.slice(1)
      : `.${path}`;
  return {
    code: error?.code ?? "hazard-collision-analysis-data-invalid",
    path: `${basePath}${suffix}`,
    message: error?.message ?? "Hazard collision analysis data is invalid.",
    severity: error?.severity ?? "error"
  };
}

function deduplicateIssues(errors) {
  const seen = new Set();
  return errors.filter((error) => {
    const key = `${error.code}\u0000${error.path}\u0000${error.message}\u0000${error.severity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function captureFailure(path) {
  return {
    ok: false,
    value: null,
    error: issue(
      "hazard-collision-analysis-data-read-failed",
      path,
      "Hazard collision analysis data could not be read safely."
    )
  };
}

function capturePlainData(value, path = "$", ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return { ok: true, value };
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? { ok: true, value } : captureFailure(path);
  }
  if (typeof value !== "object") return captureFailure(path);
  if (ancestors.has(value)) return captureFailure(path);

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

  if (array) {
    if (prototype !== Array.prototype) return captureFailure(path);
  } else if (prototype !== Object.prototype && prototype !== null) {
    return captureFailure(path);
  }

  ancestors.add(value);
  try {
    if (array) {
      let lengthDescriptor;
      try {
        lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      } catch {
        return captureFailure(`${path}.length`);
      }
      if (
        !lengthDescriptor
        || !Object.hasOwn(lengthDescriptor, "value")
        || !Number.isSafeInteger(lengthDescriptor.value)
        || lengthDescriptor.value < 0
        || ownKeys.length !== lengthDescriptor.value + 1
      ) {
        return captureFailure(path);
      }

      const clone = new Array(lengthDescriptor.value);
      for (let index = 0; index < lengthDescriptor.value; index += 1) {
        const key = String(index);
        if (!ownKeys.includes(key)) return captureFailure(`${path}[${index}]`);

        let descriptor;
        try {
          descriptor = Object.getOwnPropertyDescriptor(value, key);
        } catch {
          return captureFailure(`${path}[${index}]`);
        }
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
          return captureFailure(`${path}[${index}]`);
        }

        const nested = capturePlainData(descriptor.value, `${path}[${index}]`, ancestors);
        if (!nested.ok) return nested;
        clone[index] = nested.value;
      }

      for (const key of ownKeys) {
        if (key === "length") continue;
        if (typeof key !== "string" || !/^0$|^[1-9]\d*$/.test(key) || Number(key) >= lengthDescriptor.value) {
          return captureFailure(`${path}.${typeof key === "symbol" ? "[symbol]" : key}`);
        }
      }
      return { ok: true, value: clone };
    }

    const clone = {};
    for (const key of ownKeys) {
      if (typeof key !== "string") return captureFailure(`${path}.[symbol]`);
      if (UNSAFE_KEYS.has(key)) return captureFailure(`${path}.${key}`);

      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
      } catch {
        return captureFailure(`${path}.${key}`);
      }
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
        return captureFailure(`${path}.${key}`);
      }

      const nested = capturePlainData(descriptor.value, `${path}.${key}`, ancestors);
      if (!nested.ok) return nested;
      clone[key] = nested.value;
    }
    return { ok: true, value: clone };
  } finally {
    ancestors.delete(value);
  }
}

function clonePlanData(value) {
  if (Array.isArray(value)) return value.map((entry) => clonePlanData(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clonePlanData(entry)]));
  }
  return value;
}

function reportFailure(errors) {
  return {
    structurallyValid: false,
    readyForHazardCollisionPlanning: false,
    collision: false,
    plan: null,
    errors: deduplicateIssues(errors),
    warnings: []
  };
}

function reportSuccess(plan) {
  return {
    structurallyValid: true,
    readyForHazardCollisionPlanning: true,
    collision: plan.kind === "collision",
    plan,
    errors: [],
    warnings: []
  };
}

function invalidStateReport(errors) {
  return reportFailure([
    ...errors,
    issue(
      "hazard-collision-analysis-state-invalid",
      "state",
      "Hazard collision analysis requires a valid Voyage Encounter state."
    )
  ]);
}

function invalidIncomingReport(errors) {
  return reportFailure([
    ...errors,
    issue(
      "hazard-collision-analysis-incoming-invalid",
      "incomingHazard",
      "Hazard collision analysis requires a valid active incoming Hazard."
    )
  ]);
}

function captureActiveHazard(record, path, expectedEncounterId) {
  const captured = captureVoyageHazardRecord(record, {
    mode: "active",
    expectedEncounterId
  });
  if (!captured.ok) {
    return {
      ok: false,
      errors: captured.errors.map((error) => rebaseIssue(error, path))
    };
  }

  const validation = validateVoyageHazardRecord(captured.record, {
    mode: "active",
    expectedEncounterId
  });
  if (!validation.valid) {
    return {
      ok: false,
      errors: validation.errors.map((error) => rebaseIssue(error, path))
    };
  }
  return { ok: true, record: captured.record };
}

function buildPlan({
  state,
  incoming,
  existing,
  existingIndex
}) {
  const isSystemHazard = incoming.category === VOYAGE_HAZARD_CATEGORIES.SYSTEM;
  const base = {
    encounterId: state.encounterId,
    expectedRevision: state.revision,
    incomingHazardId: incoming.hazardId,
    existingHazardId: existing?.hazardId ?? null,
    existingHazardIndex: existing ? existingIndex : null,
    pressureSystemId: isSystemHazard ? incoming.pressureSystemId : null,
    collisionPolicy: existing ? incoming.collisionPolicy : null,
    incomingHazard: clonePlanData(incoming),
    existingHazard: existing ? clonePlanData(existing) : null,
    collisionPayload: existing ? clonePlanData(incoming.metadata.collision) : null
  };

  if (!existing) {
    return {
      kind: "no-collision",
      ...base,
      recommendedOperation: "persist-incoming"
    };
  }

  return {
    kind: "collision",
    ...base,
    recommendedOperation: incoming.collisionPolicy
  };
}

/**
 * Analyze one incoming active Hazard against the authoritative active Hazard
 * collection without applying any collision operation.
 */
export function analyzeVoyageHazardCollisionPlan(state, incomingHazard) {
  const capturedState = capturePlainData(state, "state");
  if (!capturedState.ok) return invalidStateReport([capturedState.error]);

  let stateValidation;
  try {
    stateValidation = validateVoyageEncounterState(capturedState.value);
  } catch {
    return invalidStateReport([
      issue(
        "hazard-collision-analysis-state-invalid",
        "state",
        "Hazard collision analysis state could not be validated safely."
      )
    ]);
  }
  if (!stateValidation.valid) {
    return invalidStateReport(stateValidation.errors.map((error) => rebaseIssue(error, "state")));
  }

  const incomingCapture = captureActiveHazard(
    incomingHazard,
    "incomingHazard",
    capturedState.value.encounterId
  );
  if (!incomingCapture.ok) return invalidIncomingReport(incomingCapture.errors);

  const incoming = incomingCapture.record;
  if (!COLLISION_POLICIES.has(incoming.collisionPolicy)) {
    return reportFailure([
      issue(
        "hazard-collision-analysis-policy-invalid",
        "incomingHazard.collisionPolicy",
        "Hazard collision analysis requires a supported collision policy."
      )
    ]);
  }

  const activeHazards = capturedState.value.activeHazards;
  const occupied = incoming.category === VOYAGE_HAZARD_CATEGORIES.SYSTEM
    ? activeHazards
      .map((hazard, index) => ({ hazard, index }))
      .filter(({ hazard }) => (
        hazard.category === VOYAGE_HAZARD_CATEGORIES.SYSTEM
        && hazard.status === VOYAGE_HAZARD_STATUSES.ACTIVE
        && hazard.pressureSystemId === incoming.pressureSystemId
      ))
    : [];

  if (occupied.length > 1) {
    return reportFailure([
      issue(
        "hazard-collision-analysis-slot-ambiguous",
        "state.activeHazards",
        "Hazard collision analysis found more than one active system Hazard in the target Pressure slot."
      )
    ]);
  }

  if (occupied.length === 0) return reportSuccess(buildPlan({ state: capturedState.value, incoming, existing: null, existingIndex: null }));

  const existingCapture = captureActiveHazard(
    occupied[0].hazard,
    `state.activeHazards[${occupied[0].index}]`,
    capturedState.value.encounterId
  );
  if (!existingCapture.ok) return invalidStateReport(existingCapture.errors);

  return reportSuccess(buildPlan({
    state: capturedState.value,
    incoming,
    existing: existingCapture.record,
    existingIndex: occupied[0].index
  }));
}
