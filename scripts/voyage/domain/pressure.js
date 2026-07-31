import {
  VOYAGE_ACTION_OUTCOME_BRANCHES as BRANCHES,
  VOYAGE_CONTROLLED_EFFECT_INTENT_TYPES as CONTROLLED_INTENTS,
  VOYAGE_EFFECT_INTENT_TIMING as TIMINGS,
  VOYAGE_EFFECT_INTENT_VISIBILITY as VISIBILITIES,
  VOYAGE_EFFECT_TARGET_KINDS as TARGETS,
  VOYAGE_PRESSURE_SYSTEM_BY_STATION_ID,
  VOYAGE_PRESSURE_SYSTEM_IDS
} from "./constants.js";
import { analyzeVoyageEncounterActionOutcomes } from "./action-outcome-interpretation.js";
import { deduplicateVoyageResolutionIssues } from "./resolution-order.js";
import { validateVoyageEncounterState } from "./validation.js";

const BRANCH_SET = new Set(Object.values(BRANCHES));
const TIMING_SET = new Set(Object.values(TIMINGS));
const VISIBILITY_SET = new Set(Object.values(VISIBILITIES));
const CANONICAL_STATION_IDS = new Set(Object.keys(VOYAGE_PRESSURE_SYSTEM_BY_STATION_ID));
const CANONICAL_PRESSURE_SYSTEM_IDS = new Set(VOYAGE_PRESSURE_SYSTEM_IDS);
const PRESSURE_CHANGE_INTENT_TYPE = CONTROLLED_INTENTS.PRESSURE_CHANGE;
const ALLOWED_ACTIVATION_SOURCES = new Set(["branch", "risk-bid"]);
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const STANDARD_PRESSURE_DELTAS = Object.freeze({
  [BRANCHES.FAILURE]: 1,
  [BRANCHES.CRITICAL_FAILURE]: 2
});

function issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function emptyReport({
  structurallyValid = false,
  outcomesValid = false,
  readyForPressurePlanning = false,
  actionCount = 0,
  pressureEffectCount = 0,
  standardPressureEffectCount = 0,
  authoredPressureEffectCount = 0,
  effects = [],
  errors = [],
  warnings = []
} = {}) {
  return {
    structurallyValid,
    outcomesValid,
    readyForPressurePlanning,
    actionCount,
    pressureEffectCount,
    standardPressureEffectCount,
    authoredPressureEffectCount,
    effects,
    errors,
    warnings
  };
}

function failureReport(upstream, errors, warnings) {
  return emptyReport({
    structurallyValid: Boolean(upstream?.structurallyValid),
    outcomesValid: Boolean(upstream?.readyForInterpretation),
    readyForPressurePlanning: false,
    actionCount: 0,
    pressureEffectCount: 0,
    standardPressureEffectCount: 0,
    authoredPressureEffectCount: 0,
    effects: [],
    errors: deduplicateVoyageResolutionIssues(errors),
    warnings: deduplicateVoyageResolutionIssues(warnings)
  });
}

function isObjectLike(value) {
  return value !== null && (typeof value === "object" || typeof value === "function");
}

function readOwnEnumerableDataValue(object, key) {
  try {
    if (!isObjectLike(object)) {
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

function readDenseOwnArray(value) {
  try {
    if (!Array.isArray(value)) return null;

    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      !lengthDescriptor
      || !Object.hasOwn(lengthDescriptor, "value")
      || !Number.isSafeInteger(lengthDescriptor.value)
      || lengthDescriptor.value < 0
    ) {
      return null;
    }

    const ownKeys = Reflect.ownKeys(value);
    const keySet = new Set(ownKeys);
    if (!keySet.has("length") || keySet.size !== lengthDescriptor.value + 1) return null;

    for (const key of keySet) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key)) return null;
      const index = Number(key);
      if (!Number.isSafeInteger(index) || index < 0 || index >= lengthDescriptor.value) return null;
    }

    const entries = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) return null;
      entries.push({ index, value: descriptor.value });
    }

    return entries;
  } catch {
    return null;
  }
}

function readExactPlainDataRecord(value, path, errors, allowedKeys, invalidCode, invalidMessage) {
  try {
    if (!isObjectLike(value)) {
      addIssue(errors, invalidCode, path, invalidMessage);
      return null;
    }

    let prototype;
    try {
      prototype = Object.getPrototypeOf(value);
    } catch {
      addIssue(errors, "pressure-plan-data-read-failed", path, "Pressure plan data could not be read safely.");
      return null;
    }
    if (prototype !== Object.prototype && prototype !== null) {
      addIssue(errors, invalidCode, path, invalidMessage);
      return null;
    }

    let ownKeys;
    try {
      ownKeys = Reflect.ownKeys(value);
    } catch {
      addIssue(errors, "pressure-plan-data-read-failed", path, "Pressure plan data could not be read safely.");
      return null;
    }
    if (ownKeys.length !== allowedKeys.length) {
      addIssue(errors, invalidCode, path, invalidMessage);
      return null;
    }

    const allowedKeySet = new Set(allowedKeys);
    for (const key of ownKeys) {
      if (typeof key !== "string" || !allowedKeySet.has(key)) {
        addIssue(errors, invalidCode, path, invalidMessage);
        return null;
      }
    }

    const result = Object.create(null);
    for (const key of allowedKeys) {
      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
      } catch {
        addIssue(errors, "pressure-plan-data-read-failed", `${path}.${key}`, "Pressure plan data could not be read safely.");
        return null;
      }
      if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
        addIssue(errors, invalidCode, `${path}.${key}`, invalidMessage);
        return null;
      }
      result[key] = descriptor.value;
    }

    return result;
  } catch {
    addIssue(errors, "pressure-plan-data-read-failed", path, "Pressure plan data could not be read safely.");
    return null;
  }
}

function captureFailure(path) {
  return {
    ok: false,
    issue: issue(
      "pressure-plan-data-read-failed",
      path,
      "Pressure plan data could not be read safely."
    )
  };
}

function capturePressurePlanData(value, path = "$", ancestors = new Set()) {
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
      if (prototype !== Array.prototype) {
        return captureFailure(path);
      }
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
          const next = capturePressurePlanData(descriptor.value, `${path}[${index}]`, ancestors);
          if (!next.ok) {
            return next;
          }
          clone[index] = next.value;
        }
        return { ok: true, value: clone };
      }

      const clone = Object.create(prototype);
      for (const key of ownKeys) {
        if (typeof key !== "string") {
          return captureFailure(path);
        }
        if (UNSAFE_KEYS.has(key)) {
          return captureFailure(`${path}.${key}`);
        }

        let descriptor;
        try {
          descriptor = Object.getOwnPropertyDescriptor(value, key);
        } catch {
          return captureFailure(`${path}.${key}`);
        }
        if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
          return captureFailure(`${path}.${key}`);
        }

        const next = capturePressurePlanData(descriptor.value, `${path}.${key}`, ancestors);
        if (!next.ok) {
          return next;
        }
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

function addIssue(errors, code, path, message) {
  errors.push(issue(code, path, message));
}

function isCanonicalStationId(value) {
  return typeof value === "string" && CANONICAL_STATION_IDS.has(value);
}

function isCanonicalPressureSystemId(value) {
  return typeof value === "string" && CANONICAL_PRESSURE_SYSTEM_IDS.has(value);
}

function pressureSystemIdFromStationId(stationId) {
  return VOYAGE_PRESSURE_SYSTEM_BY_STATION_ID[stationId] ?? null;
}

function createPressureEffectId(encounterId, stageId, roundNumber, sequence, sourceKind, sourceIntentId = null) {
  const components = [encounterId, stageId, roundNumber, sequence, sourceKind];
  if (sourceKind === "outcome-intent") components.push(sourceIntentId);
  return `arcflight-pressure-effect:${JSON.stringify(components)}`;
}

function buildStandardEffect({
  encounterId,
  stageId,
  roundNumber,
  sequence,
  stationId,
  actionId,
  pressureSystemId,
  branch
}) {
  const delta = STANDARD_PRESSURE_DELTAS[branch];
  if (!delta) return null;

  return {
    pressureEffectId: createPressureEffectId(encounterId, stageId, roundNumber, sequence, "standard-result"),
    encounterId,
    stageId,
    roundNumber,
    sequence,
    stationId,
    actionId,
    pressureSystemId,
    delta,
    timing: TIMINGS.CONSEQUENCES,
    sourceKind: "standard-result",
    sourceIntentId: null,
    activationSource: null,
    branch,
    visibility: VISIBILITIES.PUBLIC
  };
}

function resolvePressureTarget(intent, intentPath, actionStationId, errors) {
  const targetRead = readOwnEnumerableDataValue(intent, "target");
  if (!targetRead.ok || !targetRead.present) {
    addIssue(errors, "pressure-plan-target-invalid", `${intentPath}.target`, "Pressure intent requires a selected target.");
    return null;
  }
  const targetKindRead = readOwnEnumerableDataValue(targetRead.value, "kind");
  if (!targetKindRead.ok || !targetKindRead.present || typeof targetKindRead.value !== "string") {
    addIssue(errors, "pressure-plan-target-invalid", `${intentPath}.target.kind`, "Pressure intent target must be an exact plain record.");
    return null;
  }
  const kind = targetKindRead.value;

  const targetKeys = kind === TARGETS.SOURCE_STATION || kind === TARGETS.SELECTED_TARGET
    ? ["kind"]
    : kind === TARGETS.STATION || kind === TARGETS.PRESSURE_SYSTEM
      ? ["kind", "targetId"]
      : null;
  if (!targetKeys) {
    addIssue(errors, "pressure-plan-target-invalid", `${intentPath}.target.kind`, "Pressure intent target kind is not supported.");
    return null;
  }

  const target = readExactPlainDataRecord(
    targetRead.value,
    `${intentPath}.target`,
    errors,
    targetKeys,
    "pressure-plan-target-invalid",
    "Pressure intent target must be an exact plain record."
  );
  if (!target) {
    return null;
  }

  if (kind === TARGETS.SOURCE_STATION) {
    const pressureSystemId = pressureSystemIdFromStationId(actionStationId);
    if (!pressureSystemId) {
      addIssue(errors, "pressure-plan-source-metadata-mismatch", `${intentPath}.target.kind`, "Source-station Pressure intent does not map to a canonical Pressure system.");
      return null;
    }
    return pressureSystemId;
  }

  if (kind === TARGETS.STATION) {
    if (!isCanonicalStationId(target.targetId)) {
      addIssue(errors, "pressure-plan-station-target-invalid", `${intentPath}.target.targetId`, "Station Pressure intent must target one canonical station.");
      return null;
    }
    return pressureSystemIdFromStationId(target.targetId);
  }

  if (kind === TARGETS.PRESSURE_SYSTEM) {
    if (!isCanonicalPressureSystemId(target.targetId)) {
      addIssue(errors, "pressure-plan-pressure-system-target-invalid", `${intentPath}.target.targetId`, "Pressure-system intent must target one canonical Pressure system.");
      return null;
    }
    return target.targetId;
  }

  if (kind === TARGETS.SELECTED_TARGET) {
    const selectedRead = readOwnEnumerableDataValue(intent, "selectedTarget");
    if (!selectedRead.ok || !selectedRead.present) {
      addIssue(errors, "pressure-plan-selected-target-required", `${intentPath}.selectedTarget`, "Selected-target Pressure intent requires a selected target.");
      return null;
    }
    const selectedTarget = readExactPlainDataRecord(
      selectedRead.value,
      `${intentPath}.selectedTarget`,
      errors,
      ["kind", "targetId"],
      "pressure-plan-target-invalid",
      "Selected target must be an exact plain record."
    );
    if (!selectedTarget) {
      return null;
    }

    if (selectedTarget.kind === TARGETS.STATION) {
      if (!isCanonicalStationId(selectedTarget.targetId)) {
        addIssue(errors, "pressure-plan-station-target-invalid", `${intentPath}.selectedTarget.targetId`, "Selected station target must be one canonical station.");
        return null;
      }
      return pressureSystemIdFromStationId(selectedTarget.targetId);
    }

    if (selectedTarget.kind === TARGETS.PRESSURE_SYSTEM) {
      if (!isCanonicalPressureSystemId(selectedTarget.targetId)) {
        addIssue(errors, "pressure-plan-pressure-system-target-invalid", `${intentPath}.selectedTarget.targetId`, "Selected Pressure-system target must be one canonical Pressure system.");
        return null;
      }
      return selectedTarget.targetId;
    }

    addIssue(errors, "pressure-plan-target-invalid", `${intentPath}.selectedTarget.kind`, "Selected-target Pressure intent requires a station or pressure-system target.");
    return null;
  }
}

function buildAuthoredEffect({
  encounterId,
  stageId,
  roundNumber,
  sequence,
  stationId,
  actionId,
  pressureSystemId,
  intent,
  sourceIntentId,
  intentPath,
  errors
}) {
  const payloadRead = readOwnEnumerableDataValue(intent, "payload");
  if (!payloadRead.ok || !payloadRead.present) {
    addIssue(errors, "pressure-plan-delta-invalid", `${intentPath}.payload`, "Pressure intent payload must be an exact plain record.");
    return null;
  }

  const payload = readExactPlainDataRecord(
    payloadRead.value,
    `${intentPath}.payload`,
    errors,
    ["delta"],
    "pressure-plan-delta-invalid",
    "Pressure intent payload must be an exact plain record."
  );
  if (!payload) {
    return null;
  }

  if (
    typeof payload.delta !== "number"
    || !Number.isSafeInteger(payload.delta)
    || payload.delta === 0
  ) {
    addIssue(errors, "pressure-plan-delta-invalid", `${intentPath}.payload.delta`, "Pressure intent delta must be a nonzero safe integer.");
    return null;
  }

  const activationSourceRead = readOwnEnumerableDataValue(intent, "activationSource");
  const branchRead = readOwnEnumerableDataValue(intent, "branch");
  const timingRead = readOwnEnumerableDataValue(intent, "timing");
  const visibilityRead = readOwnEnumerableDataValue(intent, "visibility");
  if (!activationSourceRead.ok || !branchRead.ok || !timingRead.ok || !visibilityRead.ok) {
    addIssue(errors, "pressure-plan-source-metadata-mismatch", intentPath, "Pressure intent source metadata could not be read safely.");
    return null;
  }

  if (!ALLOWED_ACTIVATION_SOURCES.has(activationSourceRead.value)) {
    addIssue(errors, "pressure-plan-source-metadata-mismatch", `${intentPath}.activationSource`, "Pressure intent activation source is not recognized.");
    return null;
  }
  if (!BRANCH_SET.has(branchRead.value)) {
    addIssue(errors, "pressure-plan-source-metadata-mismatch", `${intentPath}.branch`, "Pressure intent branch metadata is not recognized.");
    return null;
  }
  if (!TIMING_SET.has(timingRead.value)) {
    addIssue(errors, "pressure-plan-source-metadata-mismatch", `${intentPath}.timing`, "Pressure intent timing metadata is not recognized.");
    return null;
  }
  if (!VISIBILITY_SET.has(visibilityRead.value)) {
    addIssue(errors, "pressure-plan-source-metadata-mismatch", `${intentPath}.visibility`, "Pressure intent visibility metadata is not recognized.");
    return null;
  }

  return {
    pressureEffectId: createPressureEffectId(encounterId, stageId, roundNumber, sequence, "outcome-intent", sourceIntentId),
    encounterId,
    stageId,
    roundNumber,
    sequence,
    stationId,
    actionId,
    pressureSystemId,
    delta: payload.delta,
    timing: timingRead.value,
    sourceKind: "outcome-intent",
    sourceIntentId,
    activationSource: activationSourceRead.value,
    branch: branchRead.value,
    visibility: visibilityRead.value
  };
}

export function analyzeVoyageEncounterPressurePlan(state) {
  try {
    const capturedState = capturePressurePlanData(state);
    if (!capturedState.ok) {
      return failureReport(
        null,
        [capturedState.issue],
        []
      );
    }

    const source = capturedState.value;
    const upstream = analyzeVoyageEncounterActionOutcomes(source);
    const structurallyValid = Boolean(upstream?.structurallyValid);
    const outcomesValid = Boolean(upstream?.readyForInterpretation);
    const upstreamErrors = deduplicateVoyageResolutionIssues(upstream?.errors ?? []);
    const upstreamWarnings = deduplicateVoyageResolutionIssues(upstream?.warnings ?? []);

    if (!outcomesValid || upstreamErrors.length > 0) {
      return failureReport(
        upstream,
        [
          ...upstreamErrors,
          issue(
            "pressure-plan-outcomes-not-ready",
            "$",
            "Pressure planning requires successful action outcome interpretation."
          )
        ],
        upstreamWarnings
      );
    }

    const actions = readDenseOwnArray(upstream.actions);
    const intents = readDenseOwnArray(upstream.intents);
    if (!actions || !intents) {
      return failureReport(
        upstream,
        [issue("pressure-plan-data-read-failed", "$", "Pressure plan data could not be read safely.")],
        upstreamWarnings
      );
    }

    const encounterIdRead = readOwnEnumerableDataValue(source, "encounterId");
    const currentStageRead = readOwnEnumerableDataValue(source, "currentStage");
    const roundRead = readOwnEnumerableDataValue(source, "roundNumber");
    const stageRead = currentStageRead.ok && currentStageRead.present
      ? readOwnEnumerableDataValue(currentStageRead.value, "stageId")
      : { ok: false, present: false, value: undefined };
    if (
      !encounterIdRead.ok
      || !currentStageRead.ok
      || !stageRead.ok
      || !roundRead.ok
      || typeof encounterIdRead.value !== "string"
      || encounterIdRead.value.trim().length === 0
      || typeof stageRead.value !== "string"
      || stageRead.value.trim().length === 0
      || !Number.isSafeInteger(roundRead.value)
      || roundRead.value < 0
    ) {
      return failureReport(
        upstream,
        [issue("pressure-plan-data-read-failed", "$", "Pressure plan context could not be read safely.")],
        upstreamWarnings
      );
    }

    const intentRecordsById = new Map();
    const errors = [];
    const effects = [];
    const effectIds = new Set();

    for (const { index, value: intent } of intents) {
      const intentPath = `intents[${index}]`;
      const intentIdRead = readOwnEnumerableDataValue(intent, "intentId");
      if (!intentIdRead.ok) {
        addIssue(errors, "pressure-plan-data-read-failed", `${intentPath}.intentId`, "Pressure intent ID could not be read safely.");
        continue;
      }
      if (!intentIdRead.present || typeof intentIdRead.value !== "string" || intentIdRead.value.trim().length === 0) {
        addIssue(errors, "pressure-plan-action-intent-missing", `${intentPath}.intentId`, "Pressure intent requires a unique intentId.");
        continue;
      }
      if (intentRecordsById.has(intentIdRead.value)) {
        addIssue(errors, "pressure-plan-action-intent-ambiguous", `${intentPath}.intentId`, "Pressure intent IDs must be unique.");
        continue;
      }
      intentRecordsById.set(intentIdRead.value, { index, value: intent, consumed: false });
    }

    for (const { index, value: action } of actions) {
      const actionPath = `actions[${index}]`;
      const sequenceRead = readOwnEnumerableDataValue(action, "sequence");
      const stationIdRead = readOwnEnumerableDataValue(action, "stationId");
      const actionIdRead = readOwnEnumerableDataValue(action, "actionId");
      const branchRead = readOwnEnumerableDataValue(action, "branch");
      const intentIdsRead = readOwnEnumerableDataValue(action, "intentIds");

      if (!sequenceRead.ok || !stationIdRead.ok || !actionIdRead.ok || !branchRead.ok || !intentIdsRead.ok) {
        return failureReport(
          upstream,
          [...errors, issue("pressure-plan-action-invalid", actionPath, "Pressure plan action could not be read safely.")],
          upstreamWarnings
        );
      }

      if (
        !Number.isSafeInteger(sequenceRead.value)
        || sequenceRead.value < 0
      ) {
        addIssue(errors, "pressure-plan-action-invalid", `${actionPath}.sequence`, "Pressure plan action requires a non-negative safe integer sequence.");
        continue;
      }
      if (!isCanonicalStationId(stationIdRead.value)) {
        addIssue(errors, "pressure-plan-source-metadata-mismatch", `${actionPath}.stationId`, "Pressure plan action stationId must be canonical.");
        continue;
      }
      if (typeof actionIdRead.value !== "string" || actionIdRead.value.trim().length === 0) {
        addIssue(errors, "pressure-plan-action-invalid", `${actionPath}.actionId`, "Pressure plan action requires a non-blank actionId.");
        continue;
      }
      if (!BRANCH_SET.has(branchRead.value)) {
        addIssue(errors, "pressure-plan-action-invalid", `${actionPath}.branch`, "Pressure plan action branch is not recognized.");
        continue;
      }

      const intentIds = readDenseOwnArray(intentIdsRead.value);
      if (!intentIds) {
        addIssue(errors, "pressure-plan-action-invalid", `${actionPath}.intentIds`, "Pressure plan action requires an own dense intentIds array.");
        continue;
      }

      const stationId = stationIdRead.value;
      const actionId = actionIdRead.value;
      const branch = branchRead.value;
      const pressureSystemId = pressureSystemIdFromStationId(stationId);
      if (!pressureSystemId) {
        addIssue(errors, "pressure-plan-source-metadata-mismatch", `${actionPath}.stationId`, "Pressure plan action stationId does not map to a canonical Pressure system.");
        continue;
      }

      const standardEffect = buildStandardEffect({
        encounterId: encounterIdRead.value,
        stageId: stageRead.value,
        roundNumber: roundRead.value,
        sequence: sequenceRead.value,
        stationId,
        actionId,
        pressureSystemId,
        branch
      });
      if (standardEffect) {
        if (effectIds.has(standardEffect.pressureEffectId)) {
          addIssue(errors, "pressure-plan-effect-id-duplicate", actionPath, "Pressure effect IDs must be unique.");
        } else {
          effectIds.add(standardEffect.pressureEffectId);
          effects.push(standardEffect);
        }
      }

      for (const { index: intentIndex, value: intentIdValue } of intentIds) {
        const intentPath = `${actionPath}.intentIds[${intentIndex}]`;
        if (typeof intentIdValue !== "string" || intentIdValue.trim().length === 0) {
          addIssue(errors, "pressure-plan-action-intent-missing", intentPath, "Pressure plan action intentIds must contain exact intent IDs.");
          continue;
        }

        const record = intentRecordsById.get(intentIdValue);
        if (!record) {
          addIssue(errors, "pressure-plan-action-intent-missing", intentPath, "Pressure plan action references a missing intent.");
          continue;
        }
        if (record.consumed) {
          addIssue(errors, "pressure-plan-intent-reused", intentPath, "Pressure intent IDs must not be referenced by multiple actions.");
          continue;
        }

        const intent = record.value;
        const encounterIntentRead = readOwnEnumerableDataValue(intent, "encounterId");
        const stageIntentRead = readOwnEnumerableDataValue(intent, "stageId");
        const roundIntentRead = readOwnEnumerableDataValue(intent, "roundNumber");
        const sequenceIntentRead = readOwnEnumerableDataValue(intent, "sequence");
        const stationIntentRead = readOwnEnumerableDataValue(intent, "stationId");
        const actionIntentRead = readOwnEnumerableDataValue(intent, "actionId");
        const typeIntentRead = readOwnEnumerableDataValue(intent, "intentType");
        const branchIntentRead = readOwnEnumerableDataValue(intent, "branch");
        const activationSourceRead = readOwnEnumerableDataValue(intent, "activationSource");
        const timingRead = readOwnEnumerableDataValue(intent, "timing");
        const visibilityRead = readOwnEnumerableDataValue(intent, "visibility");

        if (
          !encounterIntentRead.ok
          || !stageIntentRead.ok
          || !roundIntentRead.ok
          || !sequenceIntentRead.ok
          || !stationIntentRead.ok
          || !actionIntentRead.ok
          || !typeIntentRead.ok
          || !branchIntentRead.ok
          || !activationSourceRead.ok
          || !timingRead.ok
          || !visibilityRead.ok
        ) {
          addIssue(errors, "pressure-plan-source-metadata-mismatch", intentPath, "Pressure intent source metadata could not be read safely.");
          continue;
        }

        if (encounterIntentRead.value !== encounterIdRead.value) {
          addIssue(errors, "pressure-plan-source-metadata-mismatch", `${intentPath}.encounterId`, "Pressure intent source metadata must match its owning action.");
          continue;
        }
        if (stageIntentRead.value !== stageRead.value) {
          addIssue(errors, "pressure-plan-source-metadata-mismatch", `${intentPath}.stageId`, "Pressure intent source metadata must match its owning action.");
          continue;
        }
        if (roundIntentRead.value !== roundRead.value) {
          addIssue(errors, "pressure-plan-source-metadata-mismatch", `${intentPath}.roundNumber`, "Pressure intent source metadata must match its owning action.");
          continue;
        }
        if (sequenceIntentRead.value !== sequenceRead.value) {
          addIssue(errors, "pressure-plan-source-metadata-mismatch", `${intentPath}.sequence`, "Pressure intent source metadata must match its owning action.");
          continue;
        }
        if (stationIntentRead.value !== stationId) {
          addIssue(errors, "pressure-plan-source-metadata-mismatch", `${intentPath}.stationId`, "Pressure intent source metadata must match its owning action.");
          continue;
        }
        if (actionIntentRead.value !== actionId) {
          addIssue(errors, "pressure-plan-source-metadata-mismatch", `${intentPath}.actionId`, "Pressure intent source metadata must match its owning action.");
          continue;
        }
        if (branchIntentRead.value !== branch) {
          addIssue(errors, "pressure-plan-source-metadata-mismatch", `${intentPath}.branch`, "Pressure intent source metadata must match its owning action.");
          continue;
        }

        record.consumed = true;
        if (typeIntentRead.value !== PRESSURE_CHANGE_INTENT_TYPE) {
          continue;
        }

        if (!ALLOWED_ACTIVATION_SOURCES.has(activationSourceRead.value)) {
          addIssue(errors, "pressure-plan-source-metadata-mismatch", `${intentPath}.activationSource`, "Pressure intent activation source is not recognized.");
          continue;
        }
        if (!TIMING_SET.has(timingRead.value)) {
          addIssue(errors, "pressure-plan-source-metadata-mismatch", `${intentPath}.timing`, "Pressure intent timing metadata is not recognized.");
          continue;
        }
        if (!VISIBILITY_SET.has(visibilityRead.value)) {
          addIssue(errors, "pressure-plan-source-metadata-mismatch", `${intentPath}.visibility`, "Pressure intent visibility metadata is not recognized.");
          continue;
        }

        const pressureSystemForIntent = resolvePressureTarget(intent, intentPath, stationId, errors);
        if (!pressureSystemForIntent) continue;

        const authoredEffect = buildAuthoredEffect({
          encounterId: encounterIdRead.value,
          stageId: stageRead.value,
          roundNumber: roundRead.value,
          sequence: sequenceRead.value,
          stationId,
          actionId,
          pressureSystemId: pressureSystemForIntent,
          intent,
          sourceIntentId: intentIdValue,
          intentPath,
          errors
        });
        if (!authoredEffect) continue;

        if (effectIds.has(authoredEffect.pressureEffectId)) {
          addIssue(errors, "pressure-plan-effect-id-duplicate", intentPath, "Pressure effect IDs must be unique.");
          continue;
        }

        effectIds.add(authoredEffect.pressureEffectId);
        effects.push(authoredEffect);
      }
    }

    for (const record of intentRecordsById.values()) {
      if (!record.consumed) {
        addIssue(errors, "pressure-plan-intent-unreferenced", `intents[${record.index}]`, "Pressure intent IDs must be referenced by exactly one action.");
      }
    }

    if (errors.length > 0) {
      return failureReport(upstream, errors, upstreamWarnings);
    }

    const finalEffects = effects.map((effect) => ({ ...effect }));
    const standardPressureEffectCount = finalEffects.filter((effect) => effect.sourceKind === "standard-result").length;
    const authoredPressureEffectCount = finalEffects.length - standardPressureEffectCount;

    return emptyReport({
      structurallyValid,
      outcomesValid: true,
      readyForPressurePlanning: true,
      actionCount: actions.length,
      pressureEffectCount: finalEffects.length,
      standardPressureEffectCount,
      authoredPressureEffectCount,
      effects: finalEffects,
      errors: [],
      warnings: upstreamWarnings
    });
  } catch {
    return emptyReport({
      structurallyValid: false,
      outcomesValid: false,
      readyForPressurePlanning: false,
      actionCount: 0,
      pressureEffectCount: 0,
      standardPressureEffectCount: 0,
      authoredPressureEffectCount: 0,
      effects: [],
      errors: [issue("pressure-plan-data-read-failed", "$", "Pressure plan data could not be read safely.")],
      warnings: []
    });
  }
}

function applicationFailure(errors = [], warnings = []) {
  return {
    ok: false,
    nextState: null,
    events: [],
    errors: deduplicateVoyageResolutionIssues(errors),
    warnings: deduplicateVoyageResolutionIssues(warnings)
  };
}

function closeoutResetReport({
  structurallyValid = false,
  readyForPressureCloseoutReset = false,
  pressureSystemCount = 0,
  resetCount = 0,
  resets = [],
  errors = [],
  warnings = []
} = {}) {
  return {
    structurallyValid,
    readyForPressureCloseoutReset,
    pressureSystemCount,
    resetCount,
    resets,
    errors: deduplicateVoyageResolutionIssues(errors),
    warnings: deduplicateVoyageResolutionIssues(warnings)
  };
}

function applicationIssue(code, path, message) {
  return issue(code, path, message);
}

function readPressureSystemSnapshot(state) {
  const pressureSystemsRead = readOwnEnumerableDataValue(state, "pressureSystems");
  if (!pressureSystemsRead.ok || !pressureSystemsRead.present) return null;

  const pressureSystems = pressureSystemsRead.value;
  const snapshot = {};
  for (const pressureSystemId of VOYAGE_PRESSURE_SYSTEM_IDS) {
    const recordRead = readOwnEnumerableDataValue(pressureSystems, pressureSystemId);
    if (!recordRead.ok || !recordRead.present) return null;

    const record = recordRead.value;
    const idRead = readOwnEnumerableDataValue(record, "pressureSystemId");
    const valueRead = readOwnEnumerableDataValue(record, "value");
    const capacityRead = readOwnEnumerableDataValue(record, "capacity");
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

function captureApplicationState(state) {
  const captured = capturePressurePlanData(state);
  if (captured.ok) return captured;
  return {
    ok: false,
    issue: applicationIssue(
      "pressure-application-data-read-failed",
      captured.issue.path,
      "Pressure application state could not be read safely."
    )
  };
}

function validateCapturedState(state) {
  try {
    return validateVoyageEncounterState(state);
  } catch {
    return {
      valid: false,
      errors: [applicationIssue(
        "pressure-application-state-invalid",
        "encounterState",
        "Pressure application state could not be validated safely."
      )],
      warnings: []
    };
  }
}

function pressureApplicationStateFailure(validation, warnings = []) {
  return applicationFailure(
    [
      ...validation.errors,
      applicationIssue(
        "pressure-application-state-invalid",
        "encounterState",
        "Pressure application requires a valid Voyage Encounter state."
      )
    ],
    [...warnings, ...validation.warnings]
  );
}

export function applyVoyageEncounterPressurePlan(state) {
  try {
    const captured = captureApplicationState(state);
    if (!captured.ok) return applicationFailure([captured.issue]);

    const isolatedState = captured.value;
    const pressurePlan = analyzeVoyageEncounterPressurePlan(isolatedState);
    const warnings = [...pressurePlan.warnings];
    if (!pressurePlan.readyForPressurePlanning) {
      const stateValidation = validateCapturedState(isolatedState);
      const stateErrors = stateValidation.valid
        ? []
        : [
            ...stateValidation.errors,
            applicationIssue(
              "pressure-application-state-invalid",
              "encounterState",
              "Pressure application requires a valid Voyage Encounter state."
            )
          ];
      return applicationFailure(
        [
          ...pressurePlan.errors,
          ...stateErrors,
          applicationIssue(
            "pressure-application-plan-not-ready",
            "pressurePlan",
            "Pressure application requires a ready authoritative Pressure plan."
          )
        ],
        [...warnings, ...stateValidation.warnings]
      );
    }

    const stateValidation = validateCapturedState(isolatedState);
    if (!stateValidation.valid) return pressureApplicationStateFailure(stateValidation, warnings);
    warnings.push(...stateValidation.warnings);

    const previousPressureSystems = readPressureSystemSnapshot(isolatedState);
    if (!previousPressureSystems) {
      return applicationFailure(
        [applicationIssue(
          "pressure-application-state-invalid",
          "pressureSystems",
          "Pressure application requires five readable canonical Pressure systems."
        )],
        warnings
      );
    }

    const simulatedPressureSystems = clonePressureSystemSnapshot(previousPressureSystems);
    for (let index = 0; index < pressurePlan.effects.length; index += 1) {
      const effect = pressurePlan.effects[index];
      const system = simulatedPressureSystems[effect.pressureSystemId];
      if (!system) {
        return applicationFailure(
          [applicationIssue(
            "pressure-application-state-invalid",
            `pressurePlan.effects[${index}].pressureSystemId`,
            "Pressure application effect does not target a canonical Pressure system."
          )],
          warnings
        );
      }

      if (effect.delta > 0) {
        const proposedValue = system.value + effect.delta;
        if (proposedValue > system.capacity) {
          return applicationFailure(
            [applicationIssue(
              "pressure-breach-required",
              `pressurePlan.effects[${index}]`,
              `Pressure system ${system.pressureSystemId} would exceed capacity ${system.capacity}: current value ${system.value}, attempted delta ${effect.delta}.`
            )],
            warnings
          );
        }
        system.value = proposedValue;
      } else {
        system.value = Math.max(0, system.value + effect.delta);
      }
    }

    const finalCapture = capturePressurePlanData(isolatedState);
    if (!finalCapture.ok) {
      return applicationFailure(
        [applicationIssue(
          "pressure-application-candidate-invalid",
          finalCapture.issue.path,
          "Pressure application could not construct an isolated candidate state."
        )],
        warnings
      );
    }

    const candidate = finalCapture.value;
    candidate.pressureSystems = simulatedPressureSystems;
    const previousRevision = isolatedState.revision;
    candidate.revision = previousRevision + 1;

    const finalValidation = validateCapturedState(candidate);
    warnings.push(...finalValidation.warnings);
    if (!finalValidation.valid) {
      return applicationFailure(
        [
          ...finalValidation.errors,
          applicationIssue(
            "pressure-application-candidate-invalid",
            "nextState",
            "Pressure application candidate failed final state validation."
          )
        ],
        warnings
      );
    }
    if (!Number.isSafeInteger(candidate.revision)) {
      return applicationFailure(
        [applicationIssue(
          "pressure-application-candidate-invalid",
          "nextState.revision",
          "Pressure application could not represent the next revision safely."
        )],
        warnings
      );
    }

    const stageRead = readOwnEnumerableDataValue(candidate.currentStage, "stageId");
    if (!stageRead.ok || !stageRead.present) {
      return applicationFailure(
        [applicationIssue(
          "pressure-application-candidate-invalid",
          "currentStage.stageId",
          "Pressure application requires a readable current stage ID."
        )],
        warnings
      );
    }

    const event = {
      type: "voyage.pressure-applied",
      encounterId: candidate.encounterId,
      lifecycleState: candidate.lifecycleState,
      stageId: stageRead.value,
      roundNumber: candidate.roundNumber,
      phase: candidate.phase,
      pressureEffectCount: pressurePlan.pressureEffectCount,
      standardPressureEffectCount: pressurePlan.standardPressureEffectCount,
      authoredPressureEffectCount: pressurePlan.authoredPressureEffectCount,
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
    return applicationFailure([applicationIssue(
      "pressure-application-failed",
      "encounterState",
      "Pressure application could not be completed safely."
    )]);
  }
}

export function analyzeVoyageEncounterPressureCloseoutReset(state) {
  try {
    const captured = captureApplicationState(state);
    if (!captured.ok) {
      return closeoutResetReport({
        errors: [applicationIssue(
          "pressure-closeout-reset-data-read-failed",
          captured.issue.path,
          "Pressure closeout reset data could not be read safely."
        )]
      });
    }

    const isolatedState = captured.value;
    const validation = validateCapturedState(isolatedState);
    if (!validation.valid) {
      return closeoutResetReport({
        warnings: validation.warnings,
        errors: [
          ...validation.errors,
          applicationIssue(
            "pressure-closeout-reset-state-invalid",
            "encounterState",
            "Pressure closeout reset requires a valid Voyage Encounter state."
          )
        ]
      });
    }

    const pressureSystems = readPressureSystemSnapshot(isolatedState);
    if (!pressureSystems) {
      return closeoutResetReport({
        warnings: validation.warnings,
        errors: [applicationIssue(
          "pressure-closeout-reset-state-invalid",
          "pressureSystems",
          "Pressure closeout reset requires five readable canonical Pressure systems."
        )]
      });
    }

    const resets = [];
    for (const pressureSystemId of VOYAGE_PRESSURE_SYSTEM_IDS) {
      const record = pressureSystems[pressureSystemId];
      if (record.value <= 0) continue;
      resets.push({
        pressureSystemId: record.pressureSystemId,
        previousValue: record.value,
        nextValue: 0,
        capacity: record.capacity
      });
    }

    return closeoutResetReport({
      structurallyValid: true,
      readyForPressureCloseoutReset: true,
      pressureSystemCount: VOYAGE_PRESSURE_SYSTEM_IDS.length,
      resetCount: resets.length,
      resets,
      errors: [],
      warnings: validation.warnings
    });
  } catch {
    return closeoutResetReport({
      errors: [applicationIssue(
        "pressure-closeout-reset-failed",
        "encounterState",
        "Pressure closeout reset analysis could not be completed safely."
      )]
    });
  }
}
