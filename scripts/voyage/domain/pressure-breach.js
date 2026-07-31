import {
  VOYAGE_PRESSURE_SYSTEM_IDS
} from "./constants.js";
import { analyzeVoyageEncounterPressurePlan } from "./pressure.js";
import { deduplicateVoyageResolutionIssues } from "./resolution-order.js";
import { validateVoyageEncounterState } from "./validation.js";

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function breachReport({
  structurallyValid = false,
  pressurePlanReady = false,
  readyForPressureBreachPlanning = false,
  pressureEffectCount = 0,
  simulatedEffectCount = 0,
  breachRequired = false,
  breach = null,
  errors = [],
  warnings = []
} = {}) {
  return {
    structurallyValid,
    pressurePlanReady,
    readyForPressureBreachPlanning,
    pressureEffectCount,
    simulatedEffectCount,
    breachRequired,
    breach,
    errors: deduplicateVoyageResolutionIssues(errors),
    warnings: deduplicateVoyageResolutionIssues(warnings)
  };
}

function captureFailure(path) {
  return {
    ok: false,
    issue: issue(
      "pressure-breach-plan-data-read-failed",
      path,
      "Pressure breach planning data could not be read safely."
    )
  };
}

function capturePressureBreachData(value, path = "$", ancestors = new Set()) {
  try {
    if (value === null || typeof value === "string" || typeof value === "boolean") {
      return { ok: true, value };
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? { ok: true, value } : captureFailure(path);
    }
    if (typeof value !== "object") {
      return captureFailure(path);
    }
    if (ancestors.has(value)) {
      return captureFailure(path);
    }

    let prototype;
    try {
      prototype = Object.getPrototypeOf(value);
    } catch {
      return captureFailure(path);
    }

    const array = Array.isArray(value);
    if (array) {
      if (prototype !== Array.prototype) return captureFailure(path);
    } else if (prototype !== Object.prototype && prototype !== null) {
      return captureFailure(path);
    }

    let ownKeys;
    try {
      ownKeys = Reflect.ownKeys(value);
    } catch {
      return captureFailure(path);
    }

    ancestors.add(value);
    try {
      if (array) {
        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
        if (
          !lengthDescriptor
          || !Object.hasOwn(lengthDescriptor, "value")
          || !Number.isSafeInteger(lengthDescriptor.value)
          || lengthDescriptor.value < 0
        ) {
          return captureFailure(path);
        }

        const keySet = new Set(ownKeys);
        if (!keySet.has("length") || keySet.size !== lengthDescriptor.value + 1) {
          return captureFailure(path);
        }

        const clone = new Array(lengthDescriptor.value);
        for (let index = 0; index < lengthDescriptor.value; index += 1) {
          const key = String(index);
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
            return captureFailure(`${path}[${index}]`);
          }

          const next = capturePressureBreachData(descriptor.value, `${path}[${index}]`, ancestors);
          if (!next.ok) return next;
          clone[index] = next.value;
        }
        return { ok: true, value: clone };
      }

      const clone = Object.create(prototype);
      for (const key of ownKeys) {
        if (typeof key !== "string") return captureFailure(path);
        if (UNSAFE_KEYS.has(key)) return captureFailure(`${path}.${key}`);

        let descriptor;
        try {
          descriptor = Object.getOwnPropertyDescriptor(value, key);
        } catch {
          return captureFailure(`${path}.${key}`);
        }
        if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
          return captureFailure(`${path}.${key}`);
        }

        const next = capturePressureBreachData(descriptor.value, `${path}.${key}`, ancestors);
        if (!next.ok) return next;
        clone[key] = next.value;
      }

      return { ok: true, value: clone };
    } finally {
      ancestors.delete(value);
    }
  } catch {
    return captureFailure(path);
  }
}

function readOwnEnumerableDataValue(object, key) {
  try {
    if (object === null || (typeof object !== "object" && typeof object !== "function")) {
      return { ok: false, present: false, value: undefined };
    }

    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor) return { ok: true, present: false, value: undefined };
    if (descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
      return { ok: false, present: true, value: undefined };
    }

    return { ok: true, present: true, value: descriptor.value };
  } catch {
    return { ok: false, present: true, value: undefined };
  }
}

function readPressureSystemSnapshot(state) {
  const pressureSystemsRead = readOwnEnumerableDataValue(state, "pressureSystems");
  if (!pressureSystemsRead.ok || !pressureSystemsRead.present) return null;

  const snapshot = {};
  for (const pressureSystemId of VOYAGE_PRESSURE_SYSTEM_IDS) {
    const recordRead = readOwnEnumerableDataValue(pressureSystemsRead.value, pressureSystemId);
    if (!recordRead.ok || !recordRead.present) return null;

    const idRead = readOwnEnumerableDataValue(recordRead.value, "pressureSystemId");
    const valueRead = readOwnEnumerableDataValue(recordRead.value, "value");
    const capacityRead = readOwnEnumerableDataValue(recordRead.value, "capacity");
    if (
      !idRead.ok
      || !idRead.present
      || !valueRead.ok
      || !valueRead.present
      || !capacityRead.ok
      || !capacityRead.present
    ) {
      return null;
    }

    snapshot[pressureSystemId] = {
      pressureSystemId: idRead.value,
      value: valueRead.value,
      capacity: capacityRead.value
    };
  }

  return snapshot;
}

function clonePressureSystemSnapshot(snapshot) {
  const clone = {};
  for (const pressureSystemId of VOYAGE_PRESSURE_SYSTEM_IDS) {
    const record = snapshot[pressureSystemId];
    clone[pressureSystemId] = {
      pressureSystemId: record.pressureSystemId,
      value: record.value,
      capacity: record.capacity
    };
  }
  return clone;
}

function createPressureBreachId(effect, effectIndex) {
  return `arcflight-pressure-breach:${JSON.stringify([
    effect.encounterId,
    effect.stageId,
    effect.roundNumber,
    effectIndex,
    effect.pressureSystemId,
    effect.pressureEffectId
  ])}`;
}

function buildPressureBreach(effect, effectIndex, system) {
  const remainingCapacity = system.capacity - system.value;
  const overflowDelta = effect.delta - remainingCapacity;

  return {
    pressureBreachId: createPressureBreachId(effect, effectIndex),
    encounterId: effect.encounterId,
    stageId: effect.stageId,
    roundNumber: effect.roundNumber,
    effectIndex,
    sequence: effect.sequence,
    stationId: effect.stationId,
    actionId: effect.actionId,
    pressureSystemId: effect.pressureSystemId,
    pressureEffectId: effect.pressureEffectId,
    sourceKind: effect.sourceKind,
    sourceIntentId: effect.sourceIntentId,
    activationSource: effect.activationSource,
    branch: effect.branch,
    timing: effect.timing,
    visibility: effect.visibility,
    previousValue: system.value,
    capacity: system.capacity,
    remainingCapacity,
    attemptedDelta: effect.delta,
    overflowDelta
  };
}

function validationFailure(validation) {
  return breachReport({
    structurallyValid: false,
    pressurePlanReady: false,
    readyForPressureBreachPlanning: false,
    pressureEffectCount: 0,
    simulatedEffectCount: 0,
    breachRequired: false,
    breach: null,
    errors: [
      ...validation.errors,
      issue(
        "pressure-breach-plan-state-invalid",
        "encounterState",
        "Pressure breach planning requires a valid Voyage Encounter state."
      )
    ],
    warnings: validation.warnings
  });
}

/**
 * Analyze the authoritative ordered Pressure plan and identify the first effect
 * that would exceed one canonical Pressure system's capacity.
 *
 * This is a pure planning operation. It does not mutate Pressure, create a
 * Hazard, propose a Void Scar, reset a system, emit events, or advance
 * lifecycle state.
 */
export function analyzeVoyageEncounterPressureBreachPlan(state) {
  try {
    const captured = capturePressureBreachData(state);
    if (!captured.ok) {
      return breachReport({
        errors: [captured.issue]
      });
    }

    const isolatedState = captured.value;

    let validation;
    try {
      validation = validateVoyageEncounterState(isolatedState);
    } catch {
      validation = {
        valid: false,
        errors: [
          issue(
            "pressure-breach-plan-state-invalid",
            "encounterState",
            "Pressure breach planning state could not be validated safely."
          )
        ],
        warnings: []
      };
    }
    if (!validation.valid) return validationFailure(validation);

    const pressurePlan = analyzeVoyageEncounterPressurePlan(isolatedState);
    if (!pressurePlan.readyForPressurePlanning) {
      return breachReport({
        structurallyValid: Boolean(pressurePlan.structurallyValid),
        pressurePlanReady: false,
        readyForPressureBreachPlanning: false,
        pressureEffectCount: 0,
        simulatedEffectCount: 0,
        breachRequired: false,
        breach: null,
        errors: [
          ...pressurePlan.errors,
          issue(
            "pressure-breach-plan-pressure-not-ready",
            "pressurePlan",
            "Pressure breach planning requires a ready authoritative Pressure plan."
          )
        ],
        warnings: pressurePlan.warnings
      });
    }

    const pressureSystems = readPressureSystemSnapshot(isolatedState);
    if (!pressureSystems) {
      return breachReport({
        structurallyValid: Boolean(pressurePlan.structurallyValid),
        pressurePlanReady: true,
        readyForPressureBreachPlanning: false,
        pressureEffectCount: pressurePlan.pressureEffectCount,
        errors: [
          issue(
            "pressure-breach-plan-pressure-systems-invalid",
            "pressureSystems",
            "Pressure breach planning requires five readable canonical Pressure systems."
          )
        ],
        warnings: [...pressurePlan.warnings, ...validation.warnings]
      });
    }

    const simulated = clonePressureSystemSnapshot(pressureSystems);
    for (let effectIndex = 0; effectIndex < pressurePlan.effects.length; effectIndex += 1) {
      const effect = pressurePlan.effects[effectIndex];
      const system = simulated[effect.pressureSystemId];
      if (
        !system
        || !Number.isSafeInteger(effect.delta)
        || effect.delta === 0
      ) {
        return breachReport({
          structurallyValid: Boolean(pressurePlan.structurallyValid),
          pressurePlanReady: true,
          readyForPressureBreachPlanning: false,
          pressureEffectCount: pressurePlan.pressureEffectCount,
          simulatedEffectCount: effectIndex,
          errors: [
            issue(
              "pressure-breach-plan-effect-invalid",
              `pressurePlan.effects[${effectIndex}]`,
              "Pressure breach planning encountered an invalid authoritative Pressure effect."
            )
          ],
          warnings: [...pressurePlan.warnings, ...validation.warnings]
        });
      }

      if (effect.delta > 0) {
        const remainingCapacity = system.capacity - system.value;
        if (effect.delta > remainingCapacity) {
          const breach = buildPressureBreach(effect, effectIndex, system);
          if (
            !Number.isSafeInteger(breach.remainingCapacity)
            || breach.remainingCapacity < 0
            || !Number.isSafeInteger(breach.overflowDelta)
            || breach.overflowDelta <= 0
          ) {
            return breachReport({
              structurallyValid: Boolean(pressurePlan.structurallyValid),
              pressurePlanReady: true,
              readyForPressureBreachPlanning: false,
              pressureEffectCount: pressurePlan.pressureEffectCount,
              simulatedEffectCount: effectIndex,
              errors: [
                issue(
                  "pressure-breach-plan-arithmetic-invalid",
                  `pressurePlan.effects[${effectIndex}]`,
                  "Pressure breach planning could not represent the breach arithmetic safely."
                )
              ],
              warnings: [...pressurePlan.warnings, ...validation.warnings]
            });
          }

          return breachReport({
            structurallyValid: Boolean(pressurePlan.structurallyValid),
            pressurePlanReady: true,
            readyForPressureBreachPlanning: true,
            pressureEffectCount: pressurePlan.pressureEffectCount,
            simulatedEffectCount: effectIndex,
            breachRequired: true,
            breach,
            errors: [],
            warnings: [...pressurePlan.warnings, ...validation.warnings]
          });
        }

        system.value += effect.delta;
      } else {
        system.value = Math.max(0, system.value + effect.delta);
      }
    }

    return breachReport({
      structurallyValid: Boolean(pressurePlan.structurallyValid),
      pressurePlanReady: true,
      readyForPressureBreachPlanning: true,
      pressureEffectCount: pressurePlan.pressureEffectCount,
      simulatedEffectCount: pressurePlan.pressureEffectCount,
      breachRequired: false,
      breach: null,
      errors: [],
      warnings: [...pressurePlan.warnings, ...validation.warnings]
    });
  } catch {
    return breachReport({
      errors: [
        issue(
          "pressure-breach-plan-failed",
          "encounterState",
          "Pressure breach planning could not be completed safely."
        )
      ]
    });
  }
}
