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

function breachApplicationFailure(errors = [], warnings = []) {
  return {
    ok: false,
    nextState: null,
    events: [],
    errors: deduplicateVoyageResolutionIssues(errors),
    warnings: deduplicateVoyageResolutionIssues(warnings)
  };
}

function breachApplicationIssue(code, path, message) {
  return issue(code, path, message);
}

function clonePressureBreach(breach) {
  return { ...breach };
}

function pressureBreachMatchesAuthoritativeEffect(breach, effect, effectIndex, system) {
  if (!breach || !effect || !system) return false;
  if (breach.effectIndex !== effectIndex) return false;

  for (const key of [
    "encounterId",
    "stageId",
    "roundNumber",
    "sequence",
    "stationId",
    "actionId",
    "pressureSystemId",
    "pressureEffectId",
    "sourceKind",
    "sourceIntentId",
    "activationSource",
    "branch",
    "timing",
    "visibility"
  ]) {
    if (breach[key] !== effect[key]) return false;
  }

  const remainingCapacity = system.capacity - system.value;
  const overflowDelta = effect.delta - remainingCapacity;
  return breach.pressureBreachId === createPressureBreachId(effect, effectIndex)
    && breach.previousValue === system.value
    && breach.capacity === system.capacity
    && breach.remainingCapacity === remainingCapacity
    && breach.attemptedDelta === effect.delta
    && breach.overflowDelta === overflowDelta
    && Number.isSafeInteger(remainingCapacity)
    && remainingCapacity >= 0
    && Number.isSafeInteger(overflowDelta)
    && overflowDelta > 0;
}

function simulateNonBreachPressureEffect(system, effect) {
  if (!system || !Number.isSafeInteger(effect?.delta) || effect.delta === 0) {
    return { ok: false, overflow: false };
  }

  const proposedValue = system.value + effect.delta;
  if (!Number.isSafeInteger(proposedValue)) {
    return { ok: false, overflow: false };
  }

  if (effect.delta > 0) {
    if (proposedValue > system.capacity) {
      return { ok: true, overflow: true };
    }
    system.value = proposedValue;
    return { ok: true, overflow: false };
  }

  system.value = Math.max(0, proposedValue);
  return { ok: true, overflow: false };
}

/**
 * Apply one authoritative first-breach Pressure transaction.
 *
 * This Task 02 foundation applies every safe Pressure effect in authoritative
 * order, resets the first breached Pressure system to zero, increments the
 * encounter revision once, and emits one isolated audit event. A second breach
 * in the same plan fails atomically until multi-breach orchestration is added.
 *
 * Hazard creation, Void Scar proposals, ship persistence, closeout behavior,
 * lifecycle advancement, and public API registration remain outside this
 * operation.
 */
export function applyVoyageEncounterPressureBreachPlan(state) {
  try {
    const captured = capturePressureBreachData(state);
    if (!captured.ok) {
      return breachApplicationFailure([
        breachApplicationIssue(
          "pressure-breach-application-data-read-failed",
          captured.issue.path,
          "Pressure breach application state could not be read safely."
        )
      ]);
    }

    const isolatedState = captured.value;
    const breachPlan = analyzeVoyageEncounterPressureBreachPlan(isolatedState);
    const warnings = [...breachPlan.warnings];
    if (!breachPlan.readyForPressureBreachPlanning) {
      return breachApplicationFailure(
        [
          ...breachPlan.errors,
          breachApplicationIssue(
            "pressure-breach-application-plan-not-ready",
            "pressureBreachPlan",
            "Pressure breach application requires a ready authoritative breach plan."
          )
        ],
        warnings
      );
    }

    if (!breachPlan.breachRequired || !breachPlan.breach) {
      return breachApplicationFailure(
        [breachApplicationIssue(
          "pressure-breach-application-not-required",
          "pressureBreachPlan",
          "Pressure breach application requires one authoritative Pressure breach."
        )],
        warnings
      );
    }

    const pressurePlan = analyzeVoyageEncounterPressurePlan(isolatedState);
    warnings.push(...pressurePlan.warnings);
    if (!pressurePlan.readyForPressurePlanning) {
      return breachApplicationFailure(
        [
          ...pressurePlan.errors,
          breachApplicationIssue(
            "pressure-breach-application-plan-mismatch",
            "pressurePlan",
            "Pressure breach application could not reproduce the authoritative Pressure plan."
          )
        ],
        warnings
      );
    }

    if (
      pressurePlan.pressureEffectCount !== breachPlan.pressureEffectCount
      || pressurePlan.effects.length !== breachPlan.pressureEffectCount
    ) {
      return breachApplicationFailure(
        [breachApplicationIssue(
          "pressure-breach-application-plan-mismatch",
          "pressurePlan",
          "Pressure breach application Pressure and breach plan counts do not match."
        )],
        warnings
      );
    }

    const previousPressureSystems = readPressureSystemSnapshot(isolatedState);
    if (!previousPressureSystems) {
      return breachApplicationFailure(
        [breachApplicationIssue(
          "pressure-breach-application-state-invalid",
          "pressureSystems",
          "Pressure breach application requires five readable canonical Pressure systems."
        )],
        warnings
      );
    }

    const simulatedPressureSystems = clonePressureSystemSnapshot(previousPressureSystems);
    const breach = breachPlan.breach;
    let breachApplied = false;

    for (let effectIndex = 0; effectIndex < pressurePlan.effects.length; effectIndex += 1) {
      const effect = pressurePlan.effects[effectIndex];
      const system = simulatedPressureSystems[effect.pressureSystemId];
      if (!system) {
        return breachApplicationFailure(
          [breachApplicationIssue(
            "pressure-breach-application-plan-mismatch",
            `pressurePlan.effects[${effectIndex}].pressureSystemId`,
            "Pressure breach application effect does not target a canonical Pressure system."
          )],
          warnings
        );
      }

      if (effectIndex === breach.effectIndex) {
        if (
          effect.delta <= 0
          || !pressureBreachMatchesAuthoritativeEffect(breach, effect, effectIndex, system)
        ) {
          return breachApplicationFailure(
            [breachApplicationIssue(
              "pressure-breach-application-plan-mismatch",
              `pressurePlan.effects[${effectIndex}]`,
              "Pressure breach application could not match the authoritative breach effect."
            )],
            warnings
          );
        }

        system.value = 0;
        breachApplied = true;
        continue;
      }

      const simulated = simulateNonBreachPressureEffect(system, effect);
      if (!simulated.ok) {
        return breachApplicationFailure(
          [breachApplicationIssue(
            "pressure-breach-application-arithmetic-invalid",
            `pressurePlan.effects[${effectIndex}]`,
            "Pressure breach application could not represent Pressure arithmetic safely."
          )],
          warnings
        );
      }
      if (simulated.overflow) {
        return breachApplicationFailure(
          [breachApplicationIssue(
            effectIndex < breach.effectIndex
              ? "pressure-breach-application-plan-mismatch"
              : "pressure-breach-application-multiple-breaches-deferred",
            `pressurePlan.effects[${effectIndex}]`,
            effectIndex < breach.effectIndex
              ? "Pressure breach application encountered an overflow before the planned breach."
              : "Pressure breach application currently supports one breach per atomic transaction."
          )],
          warnings
        );
      }
    }

    if (!breachApplied) {
      return breachApplicationFailure(
        [breachApplicationIssue(
          "pressure-breach-application-plan-mismatch",
          "pressureBreachPlan.breach.effectIndex",
          "Pressure breach application did not encounter the planned breach effect."
        )],
        warnings
      );
    }

    const candidateCapture = capturePressureBreachData(isolatedState);
    if (!candidateCapture.ok) {
      return breachApplicationFailure(
        [breachApplicationIssue(
          "pressure-breach-application-candidate-invalid",
          candidateCapture.issue.path,
          "Pressure breach application could not construct an isolated candidate state."
        )],
        warnings
      );
    }

    const candidate = candidateCapture.value;
    candidate.pressureSystems = simulatedPressureSystems;
    const previousRevision = isolatedState.revision;
    const nextRevision = previousRevision + 1;
    if (!Number.isSafeInteger(nextRevision)) {
      return breachApplicationFailure(
        [breachApplicationIssue(
          "pressure-breach-application-candidate-invalid",
          "nextState.revision",
          "Pressure breach application could not represent the next revision safely."
        )],
        warnings
      );
    }
    candidate.revision = nextRevision;

    let finalValidation;
    try {
      finalValidation = validateVoyageEncounterState(candidate);
    } catch {
      finalValidation = {
        valid: false,
        errors: [breachApplicationIssue(
          "pressure-breach-application-candidate-invalid",
          "nextState",
          "Pressure breach application candidate could not be validated safely."
        )],
        warnings: []
      };
    }
    warnings.push(...finalValidation.warnings);
    if (!finalValidation.valid) {
      return breachApplicationFailure(
        [
          ...finalValidation.errors,
          breachApplicationIssue(
            "pressure-breach-application-candidate-invalid",
            "nextState",
            "Pressure breach application candidate failed final state validation."
          )
        ],
        warnings
      );
    }

    const event = {
      type: "voyage.pressure-breach-applied",
      encounterId: candidate.encounterId,
      lifecycleState: candidate.lifecycleState,
      stageId: breach.stageId,
      roundNumber: candidate.roundNumber,
      phase: candidate.phase,
      pressureEffectCount: pressurePlan.pressureEffectCount,
      appliedEffectCount: pressurePlan.pressureEffectCount,
      breach: clonePressureBreach(breach),
      pressureReset: {
        pressureBreachId: breach.pressureBreachId,
        pressureSystemId: breach.pressureSystemId,
        previousValue: breach.previousValue,
        resetValue: 0
      },
      effects: pressurePlan.effects.map((effect) => ({ ...effect })),
      previousPressureSystems: clonePressureSystemSnapshot(previousPressureSystems),
      pressureSystems: clonePressureSystemSnapshot(simulatedPressureSystems),
      previousRevision,
      revision: candidate.revision
    };

    return {
      ok: true,
      nextState: candidate,
      events: [event],
      errors: [],
      warnings: deduplicateVoyageResolutionIssues(warnings)
    };
  } catch {
    return breachApplicationFailure([
      breachApplicationIssue(
        "pressure-breach-application-failed",
        "encounterState",
        "Pressure breach application could not be completed safely."
      )
    ]);
  }
}
