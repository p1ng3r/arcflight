import {
  VOYAGE_PERMANENT_CONSEQUENCE_STATUSES,
  VOYAGE_PRESSURE_SYSTEM_IDS
} from "./constants.js";
import { captureVoyageHazardRecord } from "./hazard-schema.js";
import { applyVoyageHazardTriggerExistingConsequence } from "./hazard-trigger-existing-consequence.js";
import { getVoyagePressureBreachHazardDefinition } from "./pressure-breach-hazard-definitions.js";
import { analyzeVoyageEncounterPressurePlan } from "./pressure.js";
import { deduplicateVoyageResolutionIssues } from "./resolution-order.js";
import { validateVoyageEncounterState } from "./validation.js";

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const PRESSURE_BREACH_HAZARD_CATEGORY = "system";
const PRESSURE_BREACH_HAZARD_STATUS = "active";
const PRESSURE_BREACH_HAZARD_SOURCE_KIND = "pressure-breach";
const PRESSURE_BREACH_HAZARD_NAME_BY_SYSTEM_ID = Object.freeze({
  "crew-morale": "Crew Morale Breach",
  arkengine: "Arkengine Breach",
  "levstone-array": "Levstone Array Breach",
  "solar-sail-rig": "Solar Sail Rig Breach",
  lifeveil: "Lifeveil Breach"
});
const PRESSURE_BREACH_SPARSE_HAZARD_FIELDS = Object.freeze([
  "hazardId",
  "pressureBreachId",
  "encounterId",
  "stageId",
  "roundNumber",
  "effectIndex",
  "sequence",
  "stationId",
  "actionId",
  "pressureSystemId",
  "category",
  "status",
  "sourceKind",
  "pressureEffectId",
  "sourceIntentId",
  "activationSource",
  "branch",
  "timing",
  "visibility",
  "name"
]);
const PRESSURE_BREACH_SPARSE_HAZARD_FIELD_SET = new Set(PRESSURE_BREACH_SPARSE_HAZARD_FIELDS);
const PRESSURE_BREACH_VOID_SCAR_CONSEQUENCE_KIND = "void-scar";
const PRESSURE_BREACH_VOID_SCAR_STATUS = VOYAGE_PERMANENT_CONSEQUENCE_STATUSES.PROPOSED;
const PRESSURE_BREACH_VOID_SCAR_PERSISTENCE = "lasting";
const PRESSURE_BREACH_VOID_SCAR_SOURCE_KIND = "pressure-breach";
const PRESSURE_BREACH_VOID_SCAR_NAME_BY_SYSTEM_ID = Object.freeze({
  "crew-morale": "Crew Morale Void Scar",
  arkengine: "Arkengine Void Scar",
  "levstone-array": "Levstone Array Void Scar",
  "solar-sail-rig": "Solar Sail Rig Void Scar",
  lifeveil: "Lifeveil Void Scar"
});

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

function pressureBreachHazardReport({
  structurallyValid = false,
  breachPlanReady = false,
  readyForPressureBreachHazardPlanning = false,
  hazardRequired = false,
  hazardCount = 0,
  hazard = null,
  errors = [],
  warnings = []
} = {}) {
  return {
    structurallyValid,
    breachPlanReady,
    readyForPressureBreachHazardPlanning,
    hazardRequired,
    hazardCount,
    hazard,
    errors: deduplicateVoyageResolutionIssues(errors),
    warnings: deduplicateVoyageResolutionIssues(warnings)
  };
}

function createPressureBreachHazardId(breach) {
  return `arcflight-hazard:${JSON.stringify([
    PRESSURE_BREACH_HAZARD_SOURCE_KIND,
    breach.pressureBreachId
  ])}`;
}

function buildPressureBreachHazard(breach) {
  const name = PRESSURE_BREACH_HAZARD_NAME_BY_SYSTEM_ID[breach?.pressureSystemId];
  if (!name) return null;

  return {
    hazardId: createPressureBreachHazardId(breach),
    pressureBreachId: breach.pressureBreachId,
    encounterId: breach.encounterId,
    stageId: breach.stageId,
    roundNumber: breach.roundNumber,
    effectIndex: breach.effectIndex,
    sequence: breach.sequence,
    stationId: breach.stationId,
    actionId: breach.actionId,
    pressureSystemId: breach.pressureSystemId,
    category: PRESSURE_BREACH_HAZARD_CATEGORY,
    status: PRESSURE_BREACH_HAZARD_STATUS,
    sourceKind: PRESSURE_BREACH_HAZARD_SOURCE_KIND,
    pressureEffectId: breach.pressureEffectId,
    sourceIntentId: breach.sourceIntentId,
    activationSource: breach.activationSource,
    branch: breach.branch,
    timing: breach.timing,
    visibility: breach.visibility,
    name
  };
}

function capturePressureBreachHazardInput(input) {
  const captured = capturePressureBreachData(input);
  if (!captured.ok) {
    return {
      ok: false,
      value: null,
      issue: issue(
        "pressure-breach-application-hazard-invalid",
        captured.issue.path,
        "Pressure breach Hazard input could not be captured safely."
      )
    };
  }

  const value = captured.value;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      value: null,
      issue: issue(
        "pressure-breach-application-hazard-invalid",
        "$",
        "Pressure breach Hazard input must be a plain sparse Hazard object."
      )
    };
  }

  const keys = Object.keys(value);
  for (const key of keys) {
    if (!PRESSURE_BREACH_SPARSE_HAZARD_FIELD_SET.has(key)) {
      return {
        ok: false,
        value: null,
        issue: issue(
          "pressure-breach-application-hazard-invalid",
          `$.${key}`,
          "Pressure breach Hazard input contains an unexpected field."
        )
      };
    }
  }
  for (const key of PRESSURE_BREACH_SPARSE_HAZARD_FIELDS) {
    if (!Object.hasOwn(value, key)) {
      return {
        ok: false,
        value: null,
        issue: issue(
          "pressure-breach-application-hazard-invalid",
          `$.${key}`,
          "Pressure breach Hazard input requires this own field."
        )
      };
    }
  }

  return { ok: true, value, issue: null };
}

export function buildVoyagePressureBreachActiveHazard(hazard) {
  const sparseHazardCapture = capturePressureBreachHazardInput(hazard);
  if (!sparseHazardCapture.ok) {
    return {
      ok: false,
      hazard: null,
      errors: [sparseHazardCapture.issue],
      warnings: []
    };
  }

  const sparseHazard = sparseHazardCapture.value;
  const hazardDefinition = getVoyagePressureBreachHazardDefinition(sparseHazard.pressureSystemId);
  if (!hazardDefinition.ok) {
    return {
      ok: false,
      hazard: null,
      errors: hazardDefinition.errors,
      warnings: []
    };
  }

  return {
    ok: true,
    hazard: {
      hazardId: sparseHazard.hazardId,
      encounterId: sparseHazard.encounterId,
      category: sparseHazard.category,
      status: sparseHazard.status,
      name: sparseHazard.name,
      ...hazardDefinition.definition,
      visibility: sparseHazard.visibility,
      sourceKind: sparseHazard.sourceKind,
      createdStageId: sparseHazard.stageId,
      createdRoundNumber: sparseHazard.roundNumber,
      createdSequence: sparseHazard.sequence,
      failurePressureSystemId: sparseHazard.pressureSystemId,
      resolvedStageId: null,
      resolvedRoundNumber: null,
      terminalReason: null,
      replacedByHazardId: null,
      pressureSystemId: sparseHazard.pressureSystemId,
      eventAreaId: null,
      pressureBreachId: sparseHazard.pressureBreachId,
      stationId: sparseHazard.stationId,
      actionId: sparseHazard.actionId,
      pressureEffectId: sparseHazard.pressureEffectId,
      sourceIntentId: sparseHazard.sourceIntentId,
      activationSource: sparseHazard.activationSource,
      branch: sparseHazard.branch,
      sourceTiming: sparseHazard.timing,
      sourceVisibility: sparseHazard.visibility
    },
    errors: [],
    warnings: []
  };
}

function rebaseHazardCaptureIssue(error, basePath) {
  const suffix = error.path === "$"
    ? ""
    : error.path.startsWith("$")
      ? error.path.slice(1)
      : `.${error.path}`;
  return { ...error, path: `${basePath}${suffix}` };
}

function pressureBreachVoidScarProposalReport({
  structurallyValid = false,
  breachPlanReady = false,
  hazardPlanReady = false,
  readyForPressureBreachVoidScarProposalPlanning = false,
  voidScarProposalRequired = false,
  voidScarProposalCount = 0,
  voidScarProposal = null,
  errors = [],
  warnings = []
} = {}) {
  return {
    structurallyValid,
    breachPlanReady,
    hazardPlanReady,
    readyForPressureBreachVoidScarProposalPlanning,
    voidScarProposalRequired,
    voidScarProposalCount,
    voidScarProposal,
    errors: deduplicateVoyageResolutionIssues(errors),
    warnings: deduplicateVoyageResolutionIssues(warnings)
  };
}

function createPressureBreachVoidScarId(breach) {
  return `arcflight-void-scar:${JSON.stringify([
    PRESSURE_BREACH_VOID_SCAR_SOURCE_KIND,
    breach.pressureBreachId
  ])}`;
}

function createPressureBreachVoidScarProposalId(breach) {
  return `arcflight-void-scar-proposal:${JSON.stringify([
    PRESSURE_BREACH_VOID_SCAR_SOURCE_KIND,
    breach.pressureBreachId
  ])}`;
}

function buildPressureBreachVoidScarProposal(breach, hazard) {
  const name = PRESSURE_BREACH_VOID_SCAR_NAME_BY_SYSTEM_ID[breach?.pressureSystemId];
  if (!name || !hazard) return null;

  return {
    voidScarProposalId: createPressureBreachVoidScarProposalId(breach),
    voidScarId: createPressureBreachVoidScarId(breach),
    pressureBreachId: breach.pressureBreachId,
    hazardId: hazard.hazardId,
    encounterId: breach.encounterId,
    stageId: breach.stageId,
    roundNumber: breach.roundNumber,
    effectIndex: breach.effectIndex,
    sequence: breach.sequence,
    stationId: breach.stationId,
    actionId: breach.actionId,
    pressureSystemId: breach.pressureSystemId,
    consequenceKind: PRESSURE_BREACH_VOID_SCAR_CONSEQUENCE_KIND,
    status: PRESSURE_BREACH_VOID_SCAR_STATUS,
    persistence: PRESSURE_BREACH_VOID_SCAR_PERSISTENCE,
    sourceKind: PRESSURE_BREACH_VOID_SCAR_SOURCE_KIND,
    pressureEffectId: breach.pressureEffectId,
    sourceIntentId: breach.sourceIntentId,
    activationSource: breach.activationSource,
    branch: breach.branch,
    timing: breach.timing,
    visibility: breach.visibility,
    name
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

/**
 * Build the deterministic active system Hazard creation record for the first
 * authoritative Pressure breach.
 *
 * This Task 03 operation is pure. It does not persist an active Hazard, apply
 * collision or escalation policy, propose a Void Scar, mutate Pressure, emit
 * events, or advance lifecycle state.
 */
export function analyzeVoyageEncounterPressureBreachHazardPlan(state) {
  try {
    const captured = capturePressureBreachData(state);
    if (!captured.ok) {
      return pressureBreachHazardReport({
        errors: [issue(
          "pressure-breach-hazard-plan-data-read-failed",
          captured.issue.path,
          "Pressure breach Hazard planning data could not be read safely."
        )]
      });
    }

    const breachPlan = analyzeVoyageEncounterPressureBreachPlan(captured.value);
    if (!breachPlan.readyForPressureBreachPlanning) {
      return pressureBreachHazardReport({
        structurallyValid: Boolean(breachPlan.structurallyValid),
        breachPlanReady: false,
        readyForPressureBreachHazardPlanning: false,
        hazardRequired: false,
        hazardCount: 0,
        hazard: null,
        errors: [
          ...breachPlan.errors,
          issue(
            "pressure-breach-hazard-plan-breach-not-ready",
            "pressureBreachPlan",
            "Pressure breach Hazard planning requires a ready authoritative breach plan."
          )
        ],
        warnings: breachPlan.warnings
      });
    }

    if (!breachPlan.breachRequired || !breachPlan.breach) {
      return pressureBreachHazardReport({
        structurallyValid: Boolean(breachPlan.structurallyValid),
        breachPlanReady: true,
        readyForPressureBreachHazardPlanning: true,
        hazardRequired: false,
        hazardCount: 0,
        hazard: null,
        errors: [],
        warnings: breachPlan.warnings
      });
    }

    const hazard = buildPressureBreachHazard(breachPlan.breach);
    if (!hazard) {
      return pressureBreachHazardReport({
        structurallyValid: Boolean(breachPlan.structurallyValid),
        breachPlanReady: true,
        readyForPressureBreachHazardPlanning: false,
        hazardRequired: false,
        hazardCount: 0,
        hazard: null,
        errors: [issue(
          "pressure-breach-hazard-plan-system-invalid",
          "pressureBreachPlan.breach.pressureSystemId",
          "Pressure breach Hazard planning requires one canonical Pressure system."
        )],
        warnings: breachPlan.warnings
      });
    }

    return pressureBreachHazardReport({
      structurallyValid: Boolean(breachPlan.structurallyValid),
      breachPlanReady: true,
      readyForPressureBreachHazardPlanning: true,
      hazardRequired: true,
      hazardCount: 1,
      hazard,
      errors: [],
      warnings: breachPlan.warnings
    });
  } catch {
    return pressureBreachHazardReport({
      errors: [issue(
        "pressure-breach-hazard-plan-failed",
        "encounterState",
        "Pressure breach Hazard planning could not be completed safely."
      )]
    });
  }
}

/**
 * Build one deterministic lasting Void Scar proposal for the first
 * authoritative Pressure breach and its matching Hazard.
 *
 * This Task 04 operation is pure. It does not persist a Void Scar, consume hull
 * capacity, apply operational or repair rules, mutate Pressure, emit events, or
 * advance lifecycle state.
 */
export function analyzeVoyageEncounterPressureBreachVoidScarProposalPlan(state) {
  try {
    const captured = capturePressureBreachData(state);
    if (!captured.ok) {
      return pressureBreachVoidScarProposalReport({
        errors: [issue(
          "pressure-breach-void-scar-plan-data-read-failed",
          captured.issue.path,
          "Pressure breach Void Scar proposal planning data could not be read safely."
        )]
      });
    }

    const isolatedState = captured.value;
    const breachPlan = analyzeVoyageEncounterPressureBreachPlan(isolatedState);
    if (!breachPlan.readyForPressureBreachPlanning) {
      return pressureBreachVoidScarProposalReport({
        structurallyValid: Boolean(breachPlan.structurallyValid),
        breachPlanReady: false,
        hazardPlanReady: false,
        readyForPressureBreachVoidScarProposalPlanning: false,
        voidScarProposalRequired: false,
        voidScarProposalCount: 0,
        voidScarProposal: null,
        errors: [
          ...breachPlan.errors,
          issue(
            "pressure-breach-void-scar-plan-breach-not-ready",
            "pressureBreachPlan",
            "Pressure breach Void Scar proposal planning requires a ready authoritative breach plan."
          )
        ],
        warnings: breachPlan.warnings
      });
    }

    const hazardPlan = analyzeVoyageEncounterPressureBreachHazardPlan(isolatedState);
    if (!hazardPlan.readyForPressureBreachHazardPlanning) {
      return pressureBreachVoidScarProposalReport({
        structurallyValid: Boolean(breachPlan.structurallyValid),
        breachPlanReady: true,
        hazardPlanReady: false,
        readyForPressureBreachVoidScarProposalPlanning: false,
        voidScarProposalRequired: false,
        voidScarProposalCount: 0,
        voidScarProposal: null,
        errors: [
          ...hazardPlan.errors,
          issue(
            "pressure-breach-void-scar-plan-hazard-not-ready",
            "pressureBreachHazardPlan",
            "Pressure breach Void Scar proposal planning requires a ready matching Hazard plan."
          )
        ],
        warnings: [...breachPlan.warnings, ...hazardPlan.warnings]
      });
    }

    if (!breachPlan.breachRequired || !breachPlan.breach) {
      if (
        hazardPlan.hazardRequired
        || hazardPlan.hazardCount !== 0
        || hazardPlan.hazard !== null
      ) {
        return pressureBreachVoidScarProposalReport({
          structurallyValid: Boolean(breachPlan.structurallyValid),
          breachPlanReady: true,
          hazardPlanReady: false,
          readyForPressureBreachVoidScarProposalPlanning: false,
          voidScarProposalRequired: false,
          voidScarProposalCount: 0,
          voidScarProposal: null,
          errors: [issue(
            "pressure-breach-void-scar-plan-hazard-mismatch",
            "pressureBreachHazardPlan",
            "Pressure breach Void Scar proposal planning received a Hazard without a breach."
          )],
          warnings: [...breachPlan.warnings, ...hazardPlan.warnings]
        });
      }

      return pressureBreachVoidScarProposalReport({
        structurallyValid: Boolean(breachPlan.structurallyValid),
        breachPlanReady: true,
        hazardPlanReady: true,
        readyForPressureBreachVoidScarProposalPlanning: true,
        voidScarProposalRequired: false,
        voidScarProposalCount: 0,
        voidScarProposal: null,
        errors: [],
        warnings: [...breachPlan.warnings, ...hazardPlan.warnings]
      });
    }

    if (
      !hazardPlan.hazardRequired
      || hazardPlan.hazardCount !== 1
      || !hazardPlan.hazard
      || !pressureBreachHazardMatchesBreach(hazardPlan.hazard, breachPlan.breach)
    ) {
      return pressureBreachVoidScarProposalReport({
        structurallyValid: Boolean(breachPlan.structurallyValid),
        breachPlanReady: true,
        hazardPlanReady: false,
        readyForPressureBreachVoidScarProposalPlanning: false,
        voidScarProposalRequired: false,
        voidScarProposalCount: 0,
        voidScarProposal: null,
        errors: [issue(
          "pressure-breach-void-scar-plan-hazard-mismatch",
          "pressureBreachHazardPlan.hazard",
          "Pressure breach Void Scar proposal planning requires one Hazard matching the authoritative breach."
        )],
        warnings: [...breachPlan.warnings, ...hazardPlan.warnings]
      });
    }

    const voidScarProposal = buildPressureBreachVoidScarProposal(
      breachPlan.breach,
      hazardPlan.hazard
    );
    if (!voidScarProposal) {
      return pressureBreachVoidScarProposalReport({
        structurallyValid: Boolean(breachPlan.structurallyValid),
        breachPlanReady: true,
        hazardPlanReady: true,
        readyForPressureBreachVoidScarProposalPlanning: false,
        voidScarProposalRequired: false,
        voidScarProposalCount: 0,
        voidScarProposal: null,
        errors: [issue(
          "pressure-breach-void-scar-plan-system-invalid",
          "pressureBreachPlan.breach.pressureSystemId",
          "Pressure breach Void Scar proposal planning requires one canonical Pressure system."
        )],
        warnings: [...breachPlan.warnings, ...hazardPlan.warnings]
      });
    }

    return pressureBreachVoidScarProposalReport({
      structurallyValid: Boolean(breachPlan.structurallyValid),
      breachPlanReady: true,
      hazardPlanReady: true,
      readyForPressureBreachVoidScarProposalPlanning: true,
      voidScarProposalRequired: true,
      voidScarProposalCount: 1,
      voidScarProposal,
      errors: [],
      warnings: [...breachPlan.warnings, ...hazardPlan.warnings]
    });
  } catch {
    return pressureBreachVoidScarProposalReport({
      errors: [issue(
        "pressure-breach-void-scar-plan-failed",
        "encounterState",
        "Pressure breach Void Scar proposal planning could not be completed safely."
      )]
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

function clonePressureBreachHazard(hazard) {
  return { ...hazard };
}

function clonePressureBreachVoidScarProposal(voidScarProposal) {
  return { ...voidScarProposal };
}

function pressureBreachHazardMatchesBreach(hazard, breach) {
  if (!hazard || !breach) return false;

  for (const key of [
    "pressureBreachId",
    "encounterId",
    "stageId",
    "roundNumber",
    "effectIndex",
    "sequence",
    "stationId",
    "actionId",
    "pressureSystemId",
    "pressureEffectId",
    "sourceIntentId",
    "activationSource",
    "branch",
    "timing",
    "visibility"
  ]) {
    if (hazard[key] !== breach[key]) return false;
  }

  return hazard.hazardId === createPressureBreachHazardId(breach)
    && hazard.category === PRESSURE_BREACH_HAZARD_CATEGORY
    && hazard.status === PRESSURE_BREACH_HAZARD_STATUS
    && hazard.sourceKind === PRESSURE_BREACH_HAZARD_SOURCE_KIND
    && hazard.name === PRESSURE_BREACH_HAZARD_NAME_BY_SYSTEM_ID[breach.pressureSystemId];
}

function pressureBreachVoidScarProposalMatches(
  voidScarProposal,
  breach,
  hazard
) {
  if (!voidScarProposal || !breach || !hazard) return false;

  for (const key of [
    "pressureBreachId",
    "encounterId",
    "stageId",
    "roundNumber",
    "effectIndex",
    "sequence",
    "stationId",
    "actionId",
    "pressureSystemId",
    "pressureEffectId",
    "sourceIntentId",
    "activationSource",
    "branch",
    "timing",
    "visibility"
  ]) {
    if (voidScarProposal[key] !== breach[key]) return false;
  }

  return voidScarProposal.voidScarProposalId === createPressureBreachVoidScarProposalId(breach)
    && voidScarProposal.voidScarId === createPressureBreachVoidScarId(breach)
    && voidScarProposal.hazardId === hazard.hazardId
    && voidScarProposal.consequenceKind === PRESSURE_BREACH_VOID_SCAR_CONSEQUENCE_KIND
    && voidScarProposal.status === PRESSURE_BREACH_VOID_SCAR_STATUS
    && voidScarProposal.persistence === PRESSURE_BREACH_VOID_SCAR_PERSISTENCE
    && voidScarProposal.sourceKind === PRESSURE_BREACH_VOID_SCAR_SOURCE_KIND
    && voidScarProposal.name === PRESSURE_BREACH_VOID_SCAR_NAME_BY_SYSTEM_ID[breach.pressureSystemId];
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
 * Narrow M10-only Pressure Breach transaction kernel.
 *
 * M10 closes an encounter from an isolated closeout projection, rather than a
 * complete Voyage Encounter state.  The established public M6 APIs correctly
 * reject that projection, so this helper deliberately accepts only the
 * already-captured M10 simulation values.  It reuses the canonical M6 Breach,
 * Hazard, Void Scar proposal, reset, collision, and event builders above.
 * It is not a general Pressure application API.
 */
export function analyzeVoyagePressureBreachCloseoutTransaction({
  expectedEncounterRevision,
  closeoutContext,
  pressureSystems,
  activeHazards,
  pressureEffect,
  lifecycleState = "active"
}) {
  try {
    const previousPressureSystems = capturePressureBreachData(pressureSystems);
    const previousActiveHazards = capturePressureBreachData(activeHazards);
    const capturedEffect = capturePressureBreachData(pressureEffect);
    if (!previousPressureSystems.ok || !previousActiveHazards.ok || !capturedEffect.ok) {
      return {
        ok: false,
        breachRequired: false,
        previousEncounterRevision: null,
        encounterRevision: null,
        nextPressureSystems: [],
        nextActiveHazards: [],
        breach: null,
        hazard: null,
        ordinaryScarProposal: null,
        pressureReset: null,
        event: null,
        errors: [issue("pressure-breach-closeout-data-invalid", "closeout", "Closeout Pressure Breach data could not be captured safely.")],
        warnings: []
      };
    }

    const systems = previousPressureSystems.value;
    const hazards = previousActiveHazards.value;
    const effect = capturedEffect.value;
    if (
      !Number.isSafeInteger(expectedEncounterRevision)
      || expectedEncounterRevision < 0
      || !Array.isArray(systems)
      || !Array.isArray(hazards)
      || !effect
      || typeof effect !== "object"
      || !closeoutContext
      || typeof closeoutContext !== "object"
    ) {
      return {
        ok: false,
        breachRequired: false,
        previousEncounterRevision: null,
        encounterRevision: null,
        nextPressureSystems: [],
        nextActiveHazards: [],
        breach: null,
        hazard: null,
        ordinaryScarProposal: null,
        pressureReset: null,
        event: null,
        errors: [issue("pressure-breach-closeout-data-invalid", "closeout", "Closeout Pressure Breach data is invalid.")],
        warnings: []
      };
    }

    const nextPressureSystems = systems.map((system) => ({ ...system }));
    const systemIndex = nextPressureSystems.findIndex((system) => system?.pressureSystemId === effect.pressureSystemId);
    const system = systemIndex >= 0 ? nextPressureSystems[systemIndex] : null;
    if (
      !system
      || !Number.isSafeInteger(system.value)
      || !Number.isSafeInteger(system.capacity)
      || !Number.isSafeInteger(effect.delta)
      || effect.delta <= 0
    ) {
      return {
        ok: false,
        breachRequired: false,
        previousEncounterRevision: null,
        encounterRevision: null,
        nextPressureSystems: [],
        nextActiveHazards: [],
        breach: null,
        hazard: null,
        ordinaryScarProposal: null,
        pressureReset: null,
        event: null,
        errors: [issue("pressure-breach-closeout-arithmetic-invalid", "pressureEffect", "Closeout Pressure Breach arithmetic is invalid.")],
        warnings: []
      };
    }

    const remainingCapacity = system.capacity - system.value;
    if (effect.delta <= remainingCapacity) {
      const nextValue = system.value + effect.delta;
      if (!Number.isSafeInteger(nextValue)) {
        return {
          ok: false,
          breachRequired: false,
          previousEncounterRevision: null,
          encounterRevision: null,
          nextPressureSystems: [],
          nextActiveHazards: [],
          breach: null,
          hazard: null,
          ordinaryScarProposal: null,
          pressureReset: null,
          event: null,
          errors: [issue("pressure-breach-closeout-arithmetic-invalid", "pressureEffect.delta", "Closeout Pressure Breach arithmetic is invalid.")],
          warnings: []
        };
      }
      system.value = nextValue;
      return {
        ok: true,
        breachRequired: false,
        previousEncounterRevision: expectedEncounterRevision,
        encounterRevision: expectedEncounterRevision,
        nextPressureSystems,
        nextActiveHazards: hazards,
        breach: null,
        hazard: null,
        ordinaryScarProposal: null,
        pressureReset: null,
        event: null,
        errors: [],
        warnings: []
      };
    }

    const breach = buildPressureBreach(effect, 0, system);
    const sparseHazard = buildPressureBreachHazard(breach);
    if (!sparseHazard) {
      return {
        ok: false,
        breachRequired: false,
        previousEncounterRevision: null,
        encounterRevision: null,
        nextPressureSystems: [],
        nextActiveHazards: [],
        breach: null,
        hazard: null,
        ordinaryScarProposal: null,
        pressureReset: null,
        event: null,
        errors: [issue("pressure-breach-closeout-hazard-invalid", "pressureEffect.pressureSystemId", "Closeout Pressure Breach could not build its canonical Hazard.")],
        warnings: []
      };
    }

    const activeHazardBuild = buildVoyagePressureBreachActiveHazard(sparseHazard);
    if (!activeHazardBuild.ok) {
      return {
        ok: false,
        breachRequired: false,
        previousEncounterRevision: null,
        encounterRevision: null,
        nextPressureSystems: [],
        nextActiveHazards: [],
        breach: null,
        hazard: null,
        ordinaryScarProposal: null,
        pressureReset: null,
        event: null,
        errors: activeHazardBuild.errors,
        warnings: []
      };
    }
    const activeHazardCapture = captureVoyageHazardRecord(activeHazardBuild.hazard, {
      mode: "active",
      expectedEncounterId: closeoutContext.eventId
    });
    if (!activeHazardCapture.ok) {
      return {
        ok: false,
        breachRequired: false,
        previousEncounterRevision: null,
        encounterRevision: null,
        nextPressureSystems: [],
        nextActiveHazards: [],
        breach: null,
        hazard: null,
        ordinaryScarProposal: null,
        pressureReset: null,
        event: null,
        errors: activeHazardCapture.errors,
        warnings: []
      };
    }

    const occupied = hazards
      .map((hazard, index) => ({ hazard, index }))
      .filter(({ hazard }) => (
        hazard?.category === "system"
        && hazard.status === "active"
        && hazard.pressureSystemId === breach.pressureSystemId
      ));
    if (occupied.length > 1) {
      return {
        ok: false,
        breachRequired: false,
        previousEncounterRevision: null,
        encounterRevision: null,
        nextPressureSystems: [],
        nextActiveHazards: [],
        breach: null,
        hazard: null,
        ordinaryScarProposal: null,
        pressureReset: null,
        event: null,
        errors: [issue("pressure-breach-closeout-collision-invalid", "activeHazards", "Closeout Pressure Breach found an ambiguous canonical Hazard slot.")],
        warnings: []
      };
    }

    let collisionOutcome = null;
    let nextActiveHazards;
    if (occupied.length === 1) {
      const existingHazard = occupied[0].hazard;
      const consequence = existingHazard?.metadata?.collision?.consequence;
      if (
        !consequence
        || typeof consequence !== "object"
        || Array.isArray(consequence)
        || Object.keys(consequence).length === 0
      ) {
        return {
          ok: false,
          breachRequired: false,
          previousEncounterRevision: null,
          encounterRevision: null,
          nextPressureSystems: [],
          nextActiveHazards: [],
          breach: null,
          hazard: null,
          ordinaryScarProposal: null,
          pressureReset: null,
          event: null,
          errors: [issue("pressure-breach-closeout-collision-invalid", `activeHazards[${occupied[0].index}].metadata.collision.consequence`, "Closeout Pressure Breach requires the existing Hazard collision consequence.")],
          warnings: []
        };
      }
      collisionOutcome = {
        kind: "hazard-consequence-triggered",
        hazardId: existingHazard.hazardId,
        incomingHazardId: sparseHazard.hazardId,
        pressureSystemId: breach.pressureSystemId,
        collisionPolicy: activeHazardCapture.record.collisionPolicy,
        consequence: capturePressureBreachData(consequence).value
      };
      nextActiveHazards = hazards;
    } else {
      nextActiveHazards = [...hazards, activeHazardCapture.record];
    }

    const ordinaryScarProposal = buildPressureBreachVoidScarProposal(breach, sparseHazard);
    if (!ordinaryScarProposal) {
      return {
        ok: false,
        breachRequired: false,
        previousEncounterRevision: null,
        encounterRevision: null,
        nextPressureSystems: [],
        nextActiveHazards: [],
        breach: null,
        hazard: null,
        ordinaryScarProposal: null,
        pressureReset: null,
        event: null,
        errors: [issue("pressure-breach-closeout-scar-invalid", "pressureEffect.pressureSystemId", "Closeout Pressure Breach could not build its canonical Void Scar proposal.")],
        warnings: []
      };
    }

    const encounterRevision = expectedEncounterRevision + 1;
    if (!Number.isSafeInteger(encounterRevision)) {
      return {
        ok: false,
        breachRequired: false,
        previousEncounterRevision: null,
        encounterRevision: null,
        nextPressureSystems: [],
        nextActiveHazards: [],
        breach: null,
        hazard: null,
        ordinaryScarProposal: null,
        pressureReset: null,
        event: null,
        errors: [issue("pressure-breach-closeout-revision-invalid", "expectedEncounterRevision", "Closeout Pressure Breach cannot advance the encounter revision safely.")],
        warnings: []
      };
    }

    system.value = 0;
    const pressureReset = {
      pressureBreachId: breach.pressureBreachId,
      pressureSystemId: breach.pressureSystemId,
      previousValue: breach.previousValue,
      resetValue: 0
    };
    const previousPressureSystemMap = Object.fromEntries(systems.map((entry) => [entry.pressureSystemId, { ...entry }]));
    const nextPressureSystemMap = Object.fromEntries(nextPressureSystems.map((entry) => [entry.pressureSystemId, { ...entry }]));
    const event = {
      type: "voyage.pressure-breach-applied",
      encounterId: closeoutContext.eventId,
      lifecycleState,
      stageId: closeoutContext.stageId,
      roundNumber: closeoutContext.roundNumber,
      phase: closeoutContext.phase,
      pressureEffectCount: 1,
      appliedEffectCount: 1,
      breach: clonePressureBreach(breach),
      hazard: clonePressureBreachHazard(sparseHazard),
      collisionOutcome,
      voidScarProposal: clonePressureBreachVoidScarProposal(ordinaryScarProposal),
      pressureReset: { ...pressureReset },
      effects: [capturedEffect.value],
      previousPressureSystems: previousPressureSystemMap,
      pressureSystems: nextPressureSystemMap,
      previousRevision: expectedEncounterRevision,
      revision: encounterRevision
    };
    return {
      ok: true,
      breachRequired: true,
      previousEncounterRevision: expectedEncounterRevision,
      encounterRevision,
      nextPressureSystems,
      nextActiveHazards,
      breach,
      hazard: sparseHazard,
      ordinaryScarProposal,
      pressureReset,
      event,
      errors: [],
      warnings: []
    };
  } catch {
    return {
      ok: false,
      breachRequired: false,
      previousEncounterRevision: null,
      encounterRevision: null,
      nextPressureSystems: [],
      nextActiveHazards: [],
      breach: null,
      hazard: null,
      ordinaryScarProposal: null,
      pressureReset: null,
      event: null,
      errors: [issue("pressure-breach-closeout-failed", "closeout", "Closeout Pressure Breach could not be completed safely.")],
      warnings: []
    };
  }
}

/**
 * Apply one authoritative Pressure Breach transaction.
 *
 * This operation applies every safe Pressure effect in authoritative order,
 * persists one deterministic active system Hazard record when its slot is
 * empty, proposes one deterministic lasting Void Scar, resets that Pressure
 * system to zero, increments the encounter revision once, and emits one
 * isolated audit event.
 * A repeated same-system trigger-existing-consequence collision selects the
 * existing authored consequence without persisting the incoming Hazard or
 * executing that consequence.
 *
 * Active Void Scar storage, hull capacity, operational and repair rules, ship
 * persistence, other collision policies, closeout behavior, lifecycle
 * advancement, and public API registration remain outside this operation.
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

    const hazardPlan = analyzeVoyageEncounterPressureBreachHazardPlan(isolatedState);
    warnings.push(...hazardPlan.warnings);
    if (
      !hazardPlan.readyForPressureBreachHazardPlanning
      || !hazardPlan.hazardRequired
      || hazardPlan.hazardCount !== 1
      || !hazardPlan.hazard
    ) {
      return breachApplicationFailure(
        [
          ...hazardPlan.errors,
          breachApplicationIssue(
            "pressure-breach-application-hazard-not-ready",
            "pressureBreachHazardPlan",
            "Pressure breach application requires one deterministic matching Hazard creation record."
          )
        ],
        warnings
      );
    }

    const hazard = hazardPlan.hazard;
    if (!pressureBreachHazardMatchesBreach(hazard, breachPlan.breach)) {
      return breachApplicationFailure(
        [breachApplicationIssue(
          "pressure-breach-application-hazard-mismatch",
          "pressureBreachHazardPlan.hazard",
          "Pressure breach application Hazard does not match the authoritative Pressure breach."
        )],
        warnings
      );
    }

    const activeHazardBuild = buildVoyagePressureBreachActiveHazard(hazard);
    if (!activeHazardBuild.ok) {
      return breachApplicationFailure(
        activeHazardBuild.errors.map((error) => rebaseHazardCaptureIssue(
          error,
          "pressureBreachHazardPlan.hazard"
        )),
        warnings
      );
    }

    const activeHazardCapture = captureVoyageHazardRecord(
      activeHazardBuild.hazard,
      {
        mode: "active",
        expectedEncounterId: isolatedState.encounterId
      }
    );
    if (!activeHazardCapture.ok) {
      return breachApplicationFailure(
        [
          ...activeHazardCapture.errors.map((error) => rebaseHazardCaptureIssue(
            error,
            "pressureBreachHazardPlan.hazard"
          )),
          breachApplicationIssue(
            "pressure-breach-application-hazard-invalid",
            "pressureBreachHazardPlan.hazard",
            "Pressure breach application Hazard could not be captured as active state."
          )
        ],
        warnings
      );
    }

    const triggerCollision = applyVoyageHazardTriggerExistingConsequence(
      isolatedState,
      activeHazardCapture.record
    );
    if (!triggerCollision.ok) {
      return breachApplicationFailure(triggerCollision.errors, warnings);
    }

    const repeatedBreach = triggerCollision.collision;
    const activeHazardIndex = isolatedState.activeHazards.length;
    const activeHazardPath = `activeHazards[${activeHazardIndex}]`;
    if (!repeatedBreach) {
      for (let index = 0; index < isolatedState.activeHazards.length; index += 1) {
        const existingHazard = isolatedState.activeHazards[index];
        if (existingHazard.hazardId === activeHazardCapture.record.hazardId) {
          return breachApplicationFailure(
            [breachApplicationIssue(
              "duplicate-hazard-id",
              `${activeHazardPath}.hazardId`,
              `Duplicate hazardId "${activeHazardCapture.record.hazardId}".`
            )],
            warnings
          );
        }
        if (
          existingHazard.category === "system"
          && existingHazard.status === "active"
          && existingHazard.pressureSystemId === activeHazardCapture.record.pressureSystemId
        ) {
          return breachApplicationFailure(
            [breachApplicationIssue(
              "duplicate-active-hazard-system-slot",
              `${activeHazardPath}.pressureSystemId`,
              `Pressure system ${activeHazardCapture.record.pressureSystemId} already has an active system Hazard.`
            )],
            warnings
          );
        }
      }
    }

    const voidScarProposalPlan =
      analyzeVoyageEncounterPressureBreachVoidScarProposalPlan(isolatedState);
    warnings.push(...voidScarProposalPlan.warnings);
    if (
      !voidScarProposalPlan.readyForPressureBreachVoidScarProposalPlanning
      || !voidScarProposalPlan.voidScarProposalRequired
      || voidScarProposalPlan.voidScarProposalCount !== 1
      || !voidScarProposalPlan.voidScarProposal
    ) {
      return breachApplicationFailure(
        [
          ...voidScarProposalPlan.errors,
          breachApplicationIssue(
            "pressure-breach-application-void-scar-proposal-not-ready",
            "pressureBreachVoidScarProposalPlan",
            "Pressure breach application requires one deterministic matching Void Scar proposal."
          )
        ],
        warnings
      );
    }

    const voidScarProposal = voidScarProposalPlan.voidScarProposal;
    if (!pressureBreachVoidScarProposalMatches(
      voidScarProposal,
      breachPlan.breach,
      hazard
    )) {
      return breachApplicationFailure(
        [breachApplicationIssue(
          "pressure-breach-application-void-scar-proposal-mismatch",
          "pressureBreachVoidScarProposalPlan.voidScarProposal",
          "Pressure breach application Void Scar proposal does not match the authoritative breach and Hazard."
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

    const previewState = candidateCapture.value;
    previewState.pressureSystems = simulatedPressureSystems;
    previewState.revision = nextRevision;
    previewState.activeHazards = repeatedBreach
      ? triggerCollision.activeHazards
      : [
        ...previewState.activeHazards,
        activeHazardCapture.record
      ];

    let finalValidation;
    try {
      finalValidation = validateVoyageEncounterState(previewState);
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

    const returnedStateCapture = capturePressureBreachData(isolatedState);
    if (!returnedStateCapture.ok) {
      return breachApplicationFailure(
        [breachApplicationIssue(
          "pressure-breach-application-candidate-invalid",
          returnedStateCapture.issue.path,
          "Pressure breach application could not construct the returned state."
        )],
        warnings
      );
    }

    const nextState = returnedStateCapture.value;
    nextState.pressureSystems = clonePressureSystemSnapshot(simulatedPressureSystems);
    nextState.revision = nextRevision;
    const returnedHazardCapture = captureVoyageHazardRecord(
      activeHazardCapture.record,
      {
        mode: "active",
        expectedEncounterId: isolatedState.encounterId
      }
    );
    if (!returnedHazardCapture.ok) {
      return breachApplicationFailure(
        [
          ...returnedHazardCapture.errors.map((error) => rebaseHazardCaptureIssue(
            error,
            "pressureBreachHazardPlan.hazard"
          )),
          breachApplicationIssue(
            "pressure-breach-application-hazard-invalid",
            "pressureBreachHazardPlan.hazard",
            "Pressure breach application returned Hazard could not be captured safely."
          )
        ],
        warnings
      );
    }
    nextState.activeHazards = repeatedBreach
      ? triggerCollision.activeHazards
      : [
        ...nextState.activeHazards,
        returnedHazardCapture.record
      ];

    const eventHazard = clonePressureBreachHazard(hazard);
    const collisionOutcome = repeatedBreach
      ? triggerCollision.collisionOutcome
      : null;

    const event = {
      type: "voyage.pressure-breach-applied",
      encounterId: nextState.encounterId,
      lifecycleState: nextState.lifecycleState,
      stageId: breach.stageId,
      roundNumber: nextState.roundNumber,
      phase: nextState.phase,
      pressureEffectCount: pressurePlan.pressureEffectCount,
      appliedEffectCount: pressurePlan.pressureEffectCount,
      breach: clonePressureBreach(breach),
      hazard: eventHazard,
      collisionOutcome,
      voidScarProposal: clonePressureBreachVoidScarProposal(voidScarProposal),
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
      revision: nextState.revision
    };

    return {
      ok: true,
      nextState,
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
