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
import { captureVoyageHazardRecord } from "./hazard-schema.js";
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
const DOMAIN_PRESSURE_EFFECT_KIND = "domain-pressure-effect";
const DOMAIN_PRESSURE_SOURCE_KIND = "hazard-address-failure";
const DOMAIN_PRESSURE_ACTIVATION_SOURCE = "hazard";
const DOMAIN_PRESSURE_OUTCOMES = Object.freeze([BRANCHES.FAILURE, BRANCHES.CRITICAL_FAILURE]);
const PRESSURE_EFFECT_KEYS = Object.freeze([
  "pressureEffectId",
  "encounterId",
  "stageId",
  "roundNumber",
  "sequence",
  "stationId",
  "actionId",
  "pressureSystemId",
  "delta",
  "timing",
  "sourceKind",
  "sourceIntentId",
  "activationSource",
  "branch",
  "visibility"
]);
const DOMAIN_PRESSURE_REQUEST_KEYS = Object.freeze([
  "kind",
  "encounterId",
  "expectedRevision",
  "pressureSystemId",
  "delta",
  "source"
]);
const DOMAIN_PRESSURE_SOURCE_KEYS = Object.freeze([
  "kind",
  "hazardId",
  "existingHazardIndex",
  "previousHazard",
  "addressOutcome"
]);
const DOMAIN_PRESSURE_PLAN_KEYS = Object.freeze([
  "structurallyValid",
  "readyForDomainPressurePlanning",
  "kind",
  "encounterId",
  "expectedRevision",
  "pressureSystemId",
  "delta",
  "source",
  "pressureEffectCount",
  "standardPressureEffectCount",
  "authoredPressureEffectCount",
  "effects",
  "errors",
  "warnings"
]);

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
  if (sourceKind === "outcome-intent" || sourceKind === DOMAIN_PRESSURE_SOURCE_KIND) {
    components.push(sourceIntentId);
  }
  return `arcflight-pressure-effect:${JSON.stringify(components)}`;
}

function createDomainPressureEffectId({
  encounterId,
  stageId,
  roundNumber,
  expectedRevision,
  sequence,
  pressureSystemId,
  sourceKind,
  hazardId,
  addressOutcome
}) {
  return `arcflight-pressure-effect:${JSON.stringify([
    encounterId,
    stageId,
    roundNumber,
    expectedRevision,
    sequence,
    pressureSystemId,
    sourceKind,
    hazardId,
    addressOutcome
  ])}`;
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

function nonBlankString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function equalPlainData(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (!equalPlainData(left[index], right[index])) return false;
    }
    return true;
  }
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!Object.hasOwn(right, key) || !equalPlainData(left[key], right[key])) return false;
  }
  return true;
}

function rebaseHazardIssues(errors, basePath) {
  return errors.map((entry) => ({
    ...entry,
    path: entry.path === "$"
      ? basePath
      : `${basePath}${entry.path.startsWith("$") ? entry.path.slice(1) : `.${entry.path}`}`
  }));
}

function validateLiveDomainHazardSource(state, source, pressureSystemId, errors) {
  const activeHazards = readDenseOwnArray(state.activeHazards);
  if (!activeHazards) {
    addIssue(errors, "domain-pressure-source-invalid", "request.source.existingHazardIndex", "Domain Pressure source requires a readable dense activeHazards collection.");
    return null;
  }
  if (!Number.isSafeInteger(source.existingHazardIndex) || source.existingHazardIndex < 0) {
    addIssue(errors, "domain-pressure-source-invalid", "request.source.existingHazardIndex", "Hazard index must be a nonnegative safe integer.");
    return null;
  }
  if (source.existingHazardIndex >= activeHazards.length) {
    addIssue(errors, "domain-pressure-source-stale", "request.source.existingHazardIndex", "Hazard index is outside the live activeHazards collection.");
    return null;
  }

  const liveCapture = captureVoyageHazardRecord(activeHazards[source.existingHazardIndex].value, {
    mode: "active",
    expectedEncounterId: state.encounterId
  });
  if (!liveCapture.ok) {
    errors.push(...rebaseHazardIssues(liveCapture.errors, `state.activeHazards[${source.existingHazardIndex}]`));
    addIssue(errors, "domain-pressure-source-stale", `state.activeHazards[${source.existingHazardIndex}]`, "Live Hazard source is not a valid active Hazard record.");
    return null;
  }

  const previousCapture = captureVoyageHazardRecord(source.previousHazard, {
    mode: "active",
    expectedEncounterId: state.encounterId
  });
  if (!previousCapture.ok) {
    errors.push(...rebaseHazardIssues(previousCapture.errors, "request.source.previousHazard"));
    addIssue(errors, "domain-pressure-source-invalid", "request.source.previousHazard", "Previous Hazard must be a valid active Hazard snapshot.");
    return null;
  }

  const liveHazard = liveCapture.record;
  if (!nonBlankString(source.hazardId) || source.hazardId !== liveHazard.hazardId) {
    addIssue(errors, "domain-pressure-source-stale", "request.source.hazardId", "Hazard ID does not match the exact indexed live Hazard.");
  }
  if (liveHazard.status !== "active") {
    addIssue(errors, "domain-pressure-source-stale", `state.activeHazards[${source.existingHazardIndex}].status`, "Address Hazard Pressure requires an active Hazard.");
  }
  if (liveHazard.category !== "system") {
    addIssue(errors, "domain-pressure-source-stale", `state.activeHazards[${source.existingHazardIndex}].category`, "Address Hazard Pressure requires a system Hazard.");
  }
  if (liveHazard.encounterId !== state.encounterId) {
    addIssue(errors, "domain-pressure-source-stale", `state.activeHazards[${source.existingHazardIndex}].encounterId`, "Hazard encounter ID does not match the state.");
  }
  if (liveHazard.pressureSystemId !== pressureSystemId) {
    addIssue(errors, "domain-pressure-source-stale", `state.activeHazards[${source.existingHazardIndex}].pressureSystemId`, "Hazard Pressure system does not match the request.");
  }
  if (!equalPlainData(liveHazard, previousCapture.record)) {
    addIssue(errors, "domain-pressure-source-stale", "request.source.previousHazard", "Previous Hazard snapshot does not match the exact indexed live Hazard.");
  }
  if (liveHazard.removalMethod?.methodId !== "address-hazard") {
    addIssue(errors, "domain-pressure-source-invalid", `state.activeHazards[${source.existingHazardIndex}].removalMethod`, "Hazard removal method does not permit Address Hazard.");
  }

  return {
    liveHazard,
    previousHazard: previousCapture.record
  };
}

function readOrderedExactPlainDataRecord(value, path, errors, allowedKeys, invalidCode, invalidMessage) {
  const record = readExactPlainDataRecord(value, path, errors, allowedKeys, invalidCode, invalidMessage);
  if (!record) return null;

  if (Object.keys(record).some((key, index) => key !== allowedKeys[index])) {
    addIssue(errors, invalidCode, path, invalidMessage);
    return null;
  }
  return record;
}

function domainPressurePlanFailure(errors = [], warnings = []) {
  return {
    structurallyValid: false,
    readyForDomainPressurePlanning: false,
    kind: null,
    encounterId: null,
    expectedRevision: null,
    pressureSystemId: null,
    delta: null,
    source: null,
    pressureEffectCount: 0,
    standardPressureEffectCount: 0,
    authoredPressureEffectCount: 0,
    effects: [],
    errors: deduplicateVoyageResolutionIssues(errors),
    warnings: deduplicateVoyageResolutionIssues(warnings)
  };
}

function validateCanonicalPressureEffect(effect, path, errors, { expectedRevision } = {}) {
  const record = readOrderedExactPlainDataRecord(
    effect,
    path,
    errors,
    PRESSURE_EFFECT_KEYS,
    "pressure-application-effect-invalid",
    "Pressure application effects must use the exact canonical schema."
  );
  if (!record) return null;

  if (!nonBlankString(record.pressureEffectId)) {
    addIssue(errors, "pressure-application-effect-invalid", `${path}.pressureEffectId`, "Pressure effect identity must be a nonblank string.");
  }
  if (!nonBlankString(record.encounterId)) {
    addIssue(errors, "pressure-application-effect-invalid", `${path}.encounterId`, "Pressure effect encounter ID must be a nonblank string.");
  }
  if (!nonBlankString(record.stageId)) {
    addIssue(errors, "pressure-application-effect-invalid", `${path}.stageId`, "Pressure effect stage ID must be a nonblank string.");
  }
  if (!Number.isSafeInteger(record.roundNumber) || record.roundNumber < 0) {
    addIssue(errors, "pressure-application-effect-invalid", `${path}.roundNumber`, "Pressure effect round number must be a nonnegative safe integer.");
  }
  if (!Number.isSafeInteger(record.sequence) || record.sequence < 0) {
    addIssue(errors, "pressure-application-effect-invalid", `${path}.sequence`, "Pressure effect sequence must be a nonnegative safe integer.");
  }
  if (!isCanonicalPressureSystemId(record.pressureSystemId)) {
    addIssue(errors, "pressure-application-effect-invalid", `${path}.pressureSystemId`, "Pressure effect must target a canonical Pressure system.");
  }
  if (!Number.isSafeInteger(record.delta) || record.delta === 0) {
    addIssue(errors, "pressure-application-effect-invalid", `${path}.delta`, "Pressure effect delta must be a nonzero safe integer.");
  }
  if (!TIMING_SET.has(record.timing)) {
    addIssue(errors, "pressure-application-effect-invalid", `${path}.timing`, "Pressure effect timing is not recognized.");
  }
  if (!BRANCH_SET.has(record.branch)) {
    addIssue(errors, "pressure-application-effect-invalid", `${path}.branch`, "Pressure effect branch is not recognized.");
  }
  if (!VISIBILITY_SET.has(record.visibility)) {
    addIssue(errors, "pressure-application-effect-invalid", `${path}.visibility`, "Pressure effect visibility is not recognized.");
  }

  const actionMetadata = record.sourceKind === "standard-result" || record.sourceKind === "outcome-intent";
  const domainMetadata = record.sourceKind === DOMAIN_PRESSURE_SOURCE_KIND;
  if (!actionMetadata && !domainMetadata) {
    addIssue(errors, "pressure-application-effect-invalid", `${path}.sourceKind`, "Pressure effect source kind is not recognized.");
  }

  if (record.sourceKind === "standard-result") {
    if (typeof record.stationId !== "string" || typeof record.actionId !== "string") {
      addIssue(errors, "pressure-application-effect-invalid", path, "Standard Pressure effects require station and action identifiers.");
    }
    if (record.sourceIntentId !== null || record.activationSource !== null) {
      addIssue(errors, "pressure-application-effect-invalid", path, "Standard Pressure effects cannot carry authored source metadata.");
    }
    if (STANDARD_PRESSURE_DELTAS[record.branch] !== record.delta) {
      addIssue(errors, "pressure-application-effect-invalid", `${path}.delta`, "Standard Pressure effect delta must match its failure branch.");
    }
  } else if (record.sourceKind === "outcome-intent") {
    if (typeof record.stationId !== "string" || typeof record.actionId !== "string") {
      addIssue(errors, "pressure-application-effect-invalid", path, "Authored Pressure effects require station and action identifiers.");
    }
    if (!nonBlankString(record.sourceIntentId) || !ALLOWED_ACTIVATION_SOURCES.has(record.activationSource)) {
      addIssue(errors, "pressure-application-effect-invalid", path, "Authored Pressure effects require recognized source metadata.");
    }
  } else if (record.sourceKind === DOMAIN_PRESSURE_SOURCE_KIND) {
    if (record.stationId !== null || record.actionId !== null) {
      addIssue(errors, "pressure-application-effect-invalid", path, "Domain Pressure effects cannot carry action identifiers.");
    }
    if (!nonBlankString(record.sourceIntentId) || record.activationSource !== DOMAIN_PRESSURE_ACTIVATION_SOURCE) {
      addIssue(errors, "pressure-application-effect-invalid", path, "Domain Pressure effects require Hazard provenance.");
    }
    if (record.timing !== TIMINGS.CONSEQUENCES || record.visibility !== VISIBILITIES.PUBLIC) {
      addIssue(errors, "pressure-application-effect-invalid", path, "Domain Pressure effects use consequences timing and public visibility.");
    }
    if (!DOMAIN_PRESSURE_OUTCOMES.includes(record.branch) || STANDARD_PRESSURE_DELTAS[record.branch] !== record.delta) {
      addIssue(errors, "pressure-application-effect-invalid", `${path}.delta`, "Domain Pressure effect delta must match its Address Hazard outcome.");
    }
  }

  if (
    nonBlankString(record.encounterId)
    && nonBlankString(record.stageId)
    && Number.isSafeInteger(record.roundNumber)
    && Number.isSafeInteger(record.sequence)
    && (record.sourceKind === "standard-result" || record.sourceKind === "outcome-intent" || record.sourceKind === DOMAIN_PRESSURE_SOURCE_KIND)
  ) {
    const expectedId = record.sourceKind === DOMAIN_PRESSURE_SOURCE_KIND
      ? createDomainPressureEffectId({
          encounterId: record.encounterId,
          stageId: record.stageId,
          roundNumber: record.roundNumber,
          expectedRevision,
          sequence: record.sequence,
          pressureSystemId: record.pressureSystemId,
          sourceKind: record.sourceKind,
          hazardId: record.sourceIntentId,
          addressOutcome: record.branch
        })
      : createPressureEffectId(
          record.encounterId,
          record.stageId,
          record.roundNumber,
          record.sequence,
          record.sourceKind,
          record.sourceIntentId
        );
    if (record.pressureEffectId !== expectedId) {
      addIssue(errors, "pressure-application-effect-invalid", `${path}.pressureEffectId`, "Pressure effect identity is not deterministic for its canonical fields.");
    }
  }

  return record;
}

function validatePressureTransitionPlan(plan, errors) {
  const effectEntries = readDenseOwnArray(plan.effects);
  if (!effectEntries) {
    addIssue(errors, "pressure-application-plan-invalid", "pressurePlan.effects", "Pressure application requires a dense effect array.");
    return;
  }

  const countFields = ["pressureEffectCount", "standardPressureEffectCount", "authoredPressureEffectCount"];
  for (const field of countFields) {
    if (!Number.isSafeInteger(plan[field]) || plan[field] < 0) {
      addIssue(errors, "pressure-application-plan-invalid", `pressurePlan.${field}`, "Pressure application plan counts must be nonnegative safe integers.");
    }
  }
  if (plan.pressureEffectCount !== effectEntries.length) {
    addIssue(errors, "pressure-application-plan-invalid", "pressurePlan.pressureEffectCount", "Pressure application effect count must match its effect array.");
  }

  let standardCount = 0;
  let authoredCount = 0;
  for (const { index, value } of effectEntries) {
    const effect = validateCanonicalPressureEffect(
      value,
      `pressurePlan.effects[${index}]`,
      errors,
      { expectedRevision: plan.expectedRevision }
    );
    if (effect?.sourceKind === "standard-result") standardCount += 1;
    else if (effect?.sourceKind === "outcome-intent" || effect?.sourceKind === DOMAIN_PRESSURE_SOURCE_KIND) authoredCount += 1;
  }
  if (plan.standardPressureEffectCount !== standardCount) {
    addIssue(errors, "pressure-application-plan-invalid", "pressurePlan.standardPressureEffectCount", "Standard Pressure effect count does not match the effect records.");
  }
  if (plan.authoredPressureEffectCount !== authoredCount) {
    addIssue(errors, "pressure-application-plan-invalid", "pressurePlan.authoredPressureEffectCount", "Authored Pressure effect count does not match the effect records.");
  }
}

function validateDomainPressurePlan(plan, errors) {
  const record = readOrderedExactPlainDataRecord(
    plan,
    "plan",
    errors,
    DOMAIN_PRESSURE_PLAN_KEYS,
    "domain-pressure-plan-invalid",
    "Domain Pressure plans must use the exact generated schema."
  );
  if (!record) return null;

  if (record.structurallyValid !== true || record.readyForDomainPressurePlanning !== true) {
    addIssue(errors, "domain-pressure-plan-invalid", "plan", "Domain Pressure application requires a ready generated plan.");
  }
  if (record.kind !== DOMAIN_PRESSURE_EFFECT_KIND) {
    addIssue(errors, "domain-pressure-plan-invalid", "plan.kind", "Domain Pressure plan kind is not authorized.");
  }
  if (!nonBlankString(record.encounterId)) {
    addIssue(errors, "domain-pressure-plan-invalid", "plan.encounterId", "Domain Pressure plan encounter ID must be nonblank.");
  }
  if (!Number.isSafeInteger(record.expectedRevision) || record.expectedRevision < 0) {
    addIssue(errors, "domain-pressure-plan-invalid", "plan.expectedRevision", "Domain Pressure plan revision must be a nonnegative safe integer.");
  }
  if (!isCanonicalPressureSystemId(record.pressureSystemId)) {
    addIssue(errors, "domain-pressure-plan-invalid", "plan.pressureSystemId", "Domain Pressure plan must target a canonical Pressure system.");
  }
  if (!Number.isSafeInteger(record.delta) || record.delta <= 0) {
    addIssue(errors, "domain-pressure-plan-invalid", "plan.delta", "Domain Pressure plan delta must be a positive safe integer.");
  }
  if (
    !Array.isArray(record.effects)
    || record.effects.length !== 1
    || record.pressureEffectCount !== 1
    || record.standardPressureEffectCount !== 0
    || record.authoredPressureEffectCount !== 1
  ) {
    addIssue(errors, "domain-pressure-plan-invalid", "plan.effects", "A valid Domain Pressure plan must contain exactly one authored effect.");
  }
  const planErrors = readDenseOwnArray(record.errors);
  const planWarnings = readDenseOwnArray(record.warnings);
  if (!planErrors || !planWarnings || planErrors.length > 0 || planWarnings.length > 0) {
    addIssue(errors, "domain-pressure-plan-invalid", "plan.errors", "Generated Domain Pressure plans must contain empty diagnostic arrays.");
  }

  const source = readOrderedExactPlainDataRecord(
    record.source,
    "plan.source",
    errors,
    DOMAIN_PRESSURE_SOURCE_KEYS,
    "domain-pressure-plan-invalid",
    "Domain Pressure source must use the exact authorized schema."
  );
  if (source) {
    if (source.kind !== DOMAIN_PRESSURE_SOURCE_KIND || !nonBlankString(source.hazardId) || !DOMAIN_PRESSURE_OUTCOMES.includes(source.addressOutcome)) {
      addIssue(errors, "domain-pressure-plan-invalid", "plan.source", "Domain Pressure source is not an authorized Hazard address failure.");
    }
    if (!Number.isSafeInteger(source.existingHazardIndex) || source.existingHazardIndex < 0) {
      addIssue(errors, "domain-pressure-plan-invalid", "plan.source.existingHazardIndex", "Domain Pressure source Hazard index must be a nonnegative safe integer.");
    }
    if (STANDARD_PRESSURE_DELTAS[source.addressOutcome] !== record.delta) {
      addIssue(errors, "domain-pressure-plan-invalid", "plan.delta", "Domain Pressure delta must match the Address Hazard outcome.");
    }
  }

  validatePressureTransitionPlan(record, errors);
  const effect = Array.isArray(record.effects) && record.effects.length === 1 ? record.effects[0] : null;
  if (effect) {
    if (
      effect.sourceKind !== DOMAIN_PRESSURE_SOURCE_KIND
      || effect.encounterId !== record.encounterId
      || effect.pressureSystemId !== record.pressureSystemId
      || effect.delta !== record.delta
      || effect.sourceIntentId !== record.source?.hazardId
      || effect.branch !== record.source?.addressOutcome
      || effect.sequence !== 0
      || effect.timing !== TIMINGS.CONSEQUENCES
      || effect.visibility !== VISIBILITIES.PUBLIC
    ) {
      addIssue(errors, "domain-pressure-plan-invalid", "plan.effects[0]", "Domain Pressure effect provenance does not match the generated plan.");
    }
  }

  return record;
}

function applyValidatedPressurePlan(isolatedState, pressurePlan, initialWarnings = []) {
  const warnings = [...initialWarnings];
  const planErrors = [];
  validatePressureTransitionPlan(pressurePlan, planErrors);
  for (let index = 0; index < (pressurePlan.effects?.length ?? 0); index += 1) {
    const effect = pressurePlan.effects[index];
    if (effect?.encounterId !== isolatedState.encounterId) {
      addIssue(planErrors, "pressure-application-encounter-mismatch", `pressurePlan.effects[${index}].encounterId`, "Pressure effect encounter ID does not match the state.");
    }
  }
  if (Object.hasOwn(pressurePlan, "expectedRevision") && pressurePlan.expectedRevision !== isolatedState.revision) {
    addIssue(planErrors, "pressure-application-revision-mismatch", "pressurePlan.expectedRevision", "Pressure plan revision does not match the state.");
  }
  if (pressurePlan.kind === DOMAIN_PRESSURE_EFFECT_KIND && pressurePlan.effects?.length === 1) {
    const stageRead = readOwnEnumerableDataValue(isolatedState.currentStage, "stageId");
    const effect = pressurePlan.effects[0];
    if (!stageRead.ok || !stageRead.present || effect.stageId !== stageRead.value) {
      addIssue(planErrors, "pressure-application-stage-mismatch", "pressurePlan.effects[0].stageId", "Domain Pressure effect stage does not match the current state stage.");
    }
    if (effect.roundNumber !== isolatedState.roundNumber || effect.sequence !== 0) {
      addIssue(planErrors, "pressure-application-round-mismatch", "pressurePlan.effects[0]", "Domain Pressure effect round and sequence do not match the current state.");
    }
  }
  if (planErrors.length > 0) return applicationFailure(planErrors, warnings);

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

    return applyValidatedPressurePlan(isolatedState, pressurePlan, warnings);
  } catch {
    return applicationFailure([applicationIssue(
      "pressure-application-failed",
      "encounterState",
      "Pressure application could not be completed safely."
    )]);
  }
}

export function analyzeVoyageDomainPressureEffectPlan(state, request) {
  try {
    const capturedState = captureApplicationState(state);
    if (!capturedState.ok) return domainPressurePlanFailure([capturedState.issue]);

    const isolatedState = capturedState.value;
    const stateValidation = validateCapturedState(isolatedState);
    if (!stateValidation.valid) {
      return domainPressurePlanFailure(
        [
          ...stateValidation.errors,
          applicationIssue(
            "domain-pressure-plan-state-invalid",
            "encounterState",
            "Domain Pressure planning requires a valid Voyage Encounter state."
          )
        ],
        stateValidation.warnings
      );
    }

    const capturedRequest = capturePressurePlanData(request, "request");
    if (!capturedRequest.ok) {
      return domainPressurePlanFailure([applicationIssue(
        "domain-pressure-plan-data-read-failed",
        capturedRequest.issue.path,
        "Domain Pressure request data could not be read safely."
      )]);
    }

    const errors = [];
    const requestRecord = readOrderedExactPlainDataRecord(
      capturedRequest.value,
      "request",
      errors,
      DOMAIN_PRESSURE_REQUEST_KEYS,
      "domain-pressure-request-invalid",
      "Domain Pressure requests must use the exact authorized schema."
    );
    if (!requestRecord) return domainPressurePlanFailure(errors, stateValidation.warnings);

    if (requestRecord.kind !== DOMAIN_PRESSURE_EFFECT_KIND) {
      addIssue(errors, "domain-pressure-request-invalid", "request.kind", "Domain Pressure request kind is not authorized.");
    }
    if (!nonBlankString(requestRecord.encounterId)) {
      addIssue(errors, "domain-pressure-request-invalid", "request.encounterId", "Domain Pressure request encounter ID must be nonblank.");
    } else if (requestRecord.encounterId !== isolatedState.encounterId) {
      addIssue(errors, "domain-pressure-encounter-mismatch", "request.encounterId", "Domain Pressure request encounter ID does not match the state.");
    }
    if (!Number.isSafeInteger(requestRecord.expectedRevision) || requestRecord.expectedRevision < 0) {
      addIssue(errors, "domain-pressure-request-invalid", "request.expectedRevision", "Domain Pressure request revision must be a nonnegative safe integer.");
    } else if (requestRecord.expectedRevision !== isolatedState.revision) {
      addIssue(errors, "domain-pressure-revision-mismatch", "request.expectedRevision", "Domain Pressure request revision does not match the state.");
    }
    if (!isCanonicalPressureSystemId(requestRecord.pressureSystemId)) {
      addIssue(errors, "domain-pressure-system-invalid", "request.pressureSystemId", "Domain Pressure request must target a canonical Pressure system.");
    }

    const source = readOrderedExactPlainDataRecord(
      requestRecord.source,
      "request.source",
      errors,
      DOMAIN_PRESSURE_SOURCE_KEYS,
      "domain-pressure-source-invalid",
      "Domain Pressure source must use the exact authorized schema."
    );
    if (source) {
      if (source.kind !== DOMAIN_PRESSURE_SOURCE_KIND) {
        addIssue(errors, "domain-pressure-source-invalid", "request.source.kind", "Domain Pressure source kind is not authorized.");
      }
      if (!nonBlankString(source.hazardId)) {
        addIssue(errors, "domain-pressure-source-invalid", "request.source.hazardId", "Hazard provenance requires a nonblank Hazard ID.");
      }
      if (!DOMAIN_PRESSURE_OUTCOMES.includes(source.addressOutcome)) {
        addIssue(errors, "domain-pressure-source-invalid", "request.source.addressOutcome", "Address Hazard outcome is not authorized for domain Pressure.");
      }
    }

    if (!Number.isSafeInteger(requestRecord.delta) || requestRecord.delta <= 0) {
      addIssue(errors, "domain-pressure-delta-invalid", "request.delta", "Domain Pressure delta must be a positive safe integer.");
    }
    if (source && DOMAIN_PRESSURE_OUTCOMES.includes(source.addressOutcome) && requestRecord.delta !== STANDARD_PRESSURE_DELTAS[source.addressOutcome]) {
      addIssue(errors, "domain-pressure-delta-mismatch", "request.delta", "Domain Pressure delta must match the Address Hazard outcome.");
    }
    const validatedSource = source && errors.length === 0
      ? validateLiveDomainHazardSource(isolatedState, source, requestRecord.pressureSystemId, errors)
      : null;
    if (errors.length > 0 || !validatedSource) return domainPressurePlanFailure(errors, stateValidation.warnings);

    const stageRead = readOwnEnumerableDataValue(isolatedState.currentStage, "stageId");
    if (!stageRead.ok || !stageRead.present || !nonBlankString(stageRead.value)) {
      return domainPressurePlanFailure([
        applicationIssue("domain-pressure-plan-state-invalid", "currentStage.stageId", "Domain Pressure planning requires a readable current stage ID.")
      ], stateValidation.warnings);
    }

    const effect = {
      pressureEffectId: createDomainPressureEffectId({
        encounterId: requestRecord.encounterId,
        stageId: stageRead.value,
        roundNumber: isolatedState.roundNumber,
        expectedRevision: requestRecord.expectedRevision,
        sequence: 0,
        pressureSystemId: requestRecord.pressureSystemId,
        sourceKind: DOMAIN_PRESSURE_SOURCE_KIND,
        hazardId: source.hazardId,
        addressOutcome: source.addressOutcome
      }),
      encounterId: requestRecord.encounterId,
      stageId: stageRead.value,
      roundNumber: isolatedState.roundNumber,
      sequence: 0,
      stationId: null,
      actionId: null,
      pressureSystemId: requestRecord.pressureSystemId,
      delta: requestRecord.delta,
      timing: TIMINGS.CONSEQUENCES,
      sourceKind: DOMAIN_PRESSURE_SOURCE_KIND,
      sourceIntentId: source.hazardId,
      activationSource: DOMAIN_PRESSURE_ACTIVATION_SOURCE,
      branch: source.addressOutcome,
      visibility: VISIBILITIES.PUBLIC
    };

    return {
      structurallyValid: true,
      readyForDomainPressurePlanning: true,
      kind: DOMAIN_PRESSURE_EFFECT_KIND,
      encounterId: requestRecord.encounterId,
      expectedRevision: requestRecord.expectedRevision,
      pressureSystemId: requestRecord.pressureSystemId,
      delta: requestRecord.delta,
      source: {
        ...source,
        previousHazard: validatedSource.previousHazard
      },
      pressureEffectCount: 1,
      standardPressureEffectCount: 0,
      authoredPressureEffectCount: 1,
      effects: [effect],
      errors: [],
      warnings: deduplicateVoyageResolutionIssues(stateValidation.warnings)
    };
  } catch {
    return domainPressurePlanFailure([applicationIssue(
      "domain-pressure-plan-failed",
      "request",
      "Domain Pressure planning could not be completed safely."
    )]);
  }
}

export function applyVoyageDomainPressureEffect(state, request) {
  try {
    const capturedState = captureApplicationState(state);
    if (!capturedState.ok) return applicationFailure([capturedState.issue]);
    const capturedRequest = capturePressurePlanData(request, "request");
    if (!capturedRequest.ok) {
      return applicationFailure([applicationIssue(
        "domain-pressure-request-data-read-failed",
        capturedRequest.issue.path,
        "Domain Pressure request data could not be read safely."
      )]);
    }

    const isolatedState = capturedState.value;
    const stateValidation = validateCapturedState(isolatedState);
    if (!stateValidation.valid) {
      return pressureApplicationStateFailure(stateValidation, []);
    }

    const domainPlan = analyzeVoyageDomainPressureEffectPlan(isolatedState, capturedRequest.value);
    if (!domainPlan.readyForDomainPressurePlanning) {
      return applicationFailure(
        [
          ...domainPlan.errors,
          applicationIssue(
            "domain-pressure-application-plan-not-ready",
            "pressurePlan",
            "Domain Pressure application requires a ready internally generated plan."
          )
        ],
        [...stateValidation.warnings, ...domainPlan.warnings]
      );
    }

    const planErrors = [];
    const validatedPlan = validateDomainPressurePlan(domainPlan, planErrors);
    if (!validatedPlan || planErrors.length > 0) {
      return applicationFailure(planErrors, [...stateValidation.warnings, ...domainPlan.warnings]);
    }

    return applyValidatedPressurePlan(isolatedState, validatedPlan, [
      ...stateValidation.warnings,
      ...validatedPlan.warnings
    ]);
  } catch {
    return applicationFailure([applicationIssue(
      "domain-pressure-application-failed",
      "request",
      "Domain Pressure application could not be completed safely."
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
