import {
  VOYAGE_HAZARD_CATEGORIES,
  VOYAGE_HAZARD_COLLISION_POLICIES,
  VOYAGE_HAZARD_DURATION_MODES,
  VOYAGE_HAZARD_ESCALATION_MODES,
  VOYAGE_HAZARD_STATUSES,
  VOYAGE_HAZARD_TIMING_KINDS,
  VOYAGE_HAZARD_VISIBILITY,
  VOYAGE_PRESSURE_SYSTEM_IDS
} from "./constants.js";

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const PRESSURE_SYSTEM_IDS = new Set(VOYAGE_PRESSURE_SYSTEM_IDS);

const PROVENANCE_FIELDS = Object.freeze([
  "pressureBreachId",
  "stationId",
  "actionId",
  "pressureEffectId",
  "sourceIntentId",
  "activationSource",
  "branch",
  "sourceTiming",
  "sourceVisibility"
]);

const HAZARD_FIELDS = Object.freeze([
  "hazardId",
  "encounterId",
  "category",
  "status",
  "name",
  "currentEffect",
  "activationTiming",
  "removalMethod",
  "ignoredConsequence",
  "visibility",
  "sourceKind",
  "createdStageId",
  "createdRoundNumber",
  "createdSequence",
  "escalation",
  "collisionPolicy",
  "duration",
  "failurePressureSystemId",
  "resolvedStageId",
  "resolvedRoundNumber",
  "terminalReason",
  "replacedByHazardId",
  "metadata",
  "pressureSystemId",
  "eventAreaId",
  ...PROVENANCE_FIELDS
]);

const HAZARD_FIELD_SET = new Set(HAZARD_FIELDS);
const PROVENANCE_FIELD_SET = new Set(PROVENANCE_FIELDS);
const HAZARD_STATUS_VALUES = new Set(Object.values(VOYAGE_HAZARD_STATUSES));
const HAZARD_TIMING_VALUES = new Set(Object.values(VOYAGE_HAZARD_TIMING_KINDS));
const HAZARD_COLLISION_VALUES = new Set(Object.values(VOYAGE_HAZARD_COLLISION_POLICIES));
const HAZARD_ESCALATION_VALUES = new Set(Object.values(VOYAGE_HAZARD_ESCALATION_MODES));
const HAZARD_DURATION_VALUES = new Set(Object.values(VOYAGE_HAZARD_DURATION_MODES));
const HAZARD_CATEGORY_VALUES = new Set(Object.values(VOYAGE_HAZARD_CATEGORIES));
const HAZARD_VISIBILITY_VALUES = new Set(Object.values(VOYAGE_HAZARD_VISIBILITY));

function issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function pathFor(path, key) {
  return `${path}.${typeof key === "symbol" ? "[symbol]" : key}`;
}

function isNonBlankString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function safeGetPrototype(value) {
  try {
    return { ok: true, prototype: Object.getPrototypeOf(value) };
  } catch {
    return { ok: false, prototype: undefined };
  }
}

function safeIsArray(value) {
  try {
    return { ok: true, isArray: Array.isArray(value) };
  } catch {
    return { ok: false, isArray: false };
  }
}

function isSafePlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const arrayCheck = safeIsArray(value);
  if (!arrayCheck.ok || arrayCheck.isArray) return false;
  const result = safeGetPrototype(value);
  return result.ok && (result.prototype === Object.prototype || result.prototype === null);
}

function ownKeys(value, path, errors, code = "hazard-data-read-failed") {
  try {
    return Reflect.ownKeys(value);
  } catch {
    errors.push(issue(code, path, "Hazard data could not be reflected safely."));
    return null;
  }
}

function ownDataValue(value, key, path, errors, missingCode = "missing-hazard-field") {
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    errors.push(issue("hazard-data-read-failed", pathFor(path, key), "Hazard data could not be read safely."));
    return { ok: false, present: false, value: undefined };
  }

  if (!descriptor) {
    errors.push(issue(missingCode, pathFor(path, key), `Hazard record requires ${String(key)}.`));
    return { ok: false, present: false, value: undefined };
  }
  if (!Object.hasOwn(descriptor, "value") || !descriptor.enumerable) {
    errors.push(issue(
      "invalid-hazard-data-property",
      pathFor(path, key),
      "Hazard fields must be own enumerable data properties."
    ));
    return { ok: false, present: true, value: undefined };
  }
  return { ok: true, present: true, value: descriptor.value };
}

function cloneSafeData(value, path, errors, ancestors = new Set()) {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) errors.push(issue("invalid-hazard-number", path, "Hazard data numbers must be finite."));
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "undefined") {
    errors.push(issue("invalid-hazard-undefined", path, "Hazard data must not contain undefined."));
    return undefined;
  }
  if (typeof value === "function" || typeof value === "bigint" || typeof value === "symbol") {
    errors.push(issue("invalid-hazard-value", path, "Hazard data contains a non-serializable value."));
    return undefined;
  }
  if (typeof value !== "object") {
    errors.push(issue("invalid-hazard-value", path, "Hazard data contains an unsupported value."));
    return undefined;
  }

  if (ancestors.has(value)) {
    errors.push(issue("cyclic-hazard-data", path, "Hazard data must not contain cycles."));
    return undefined;
  }
  ancestors.add(value);

  let clone;
  const arrayCheck = safeIsArray(value);
  if (!arrayCheck.ok) {
    errors.push(issue("hazard-data-read-failed", path, "Hazard data could not be read safely."));
    ancestors.delete(value);
    return undefined;
  }
  if (arrayCheck.isArray) {
    const keys = ownKeys(value, path, errors);
    if (!keys) {
      ancestors.delete(value);
      return undefined;
    }

    let lengthDescriptor;
    try {
      lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    } catch {
      errors.push(issue("hazard-data-read-failed", `${path}.length`, "Hazard data could not be read safely."));
      lengthDescriptor = null;
    }
    const length = lengthDescriptor && Object.hasOwn(lengthDescriptor, "value")
      ? lengthDescriptor.value
      : undefined;
    if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor, "value")) {
      errors.push(issue("invalid-hazard-array", `${path}.length`, "Hazard arrays require an intrinsic data length."));
    }
    if (!Number.isSafeInteger(length) || length < 0) {
      errors.push(issue("invalid-hazard-array", path, "Hazard arrays must have a safe non-negative length."));
    }

    const safeLength = Number.isSafeInteger(length) && length >= 0 ? length : 0;
    clone = new Array(safeLength);
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^0$|^[1-9]\d*$/.test(key) || Number(key) >= safeLength) {
        errors.push(issue("invalid-hazard-array", pathFor(path, key), "Hazard arrays must be dense and contain no extra fields."));
        continue;
      }
      const entry = ownDataValue(value, key, path, errors, "invalid-hazard-array");
      if (entry.ok) clone[Number(key)] = cloneSafeData(entry.value, pathFor(path, key), errors, ancestors);
    }
    for (let index = 0; index < safeLength; index += 1) {
      if (!Object.hasOwn(clone, index)) {
        errors.push(issue("sparse-hazard-array", `${path}[${index}]`, "Hazard arrays must be dense."));
      }
    }
  } else if (isSafePlainObject(value)) {
    const keys = ownKeys(value, path, errors);
    if (!keys) {
      ancestors.delete(value);
      return undefined;
    }
    clone = {};
    for (const key of keys) {
      if (typeof key !== "string") {
        errors.push(issue("unexpected-hazard-symbol", pathFor(path, key), "Hazard data must not contain symbol keys."));
        continue;
      }
      if (UNSAFE_KEYS.has(key)) {
        errors.push(issue("unsafe-hazard-key", pathFor(path, key), "Hazard data contains a prototype-sensitive key."));
        continue;
      }
      const entry = ownDataValue(value, key, path, errors, "invalid-hazard-data-property");
      if (entry.ok) clone[key] = cloneSafeData(entry.value, pathFor(path, key), errors, ancestors);
    }
  } else {
    errors.push(issue("invalid-hazard-object", path, "Hazard data must contain only plain objects and arrays."));
  }

  ancestors.delete(value);
  return clone;
}

function exactKeys(value, keys, path, errors, code = "unexpected-hazard-field") {
  const expected = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) errors.push(issue(code, pathFor(path, key), "Hazard object contains an unexpected field."));
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) errors.push(issue("missing-hazard-field", pathFor(path, key), `Hazard object requires ${key}.`));
  }
}

function validateString(value, path, errors, code = "invalid-hazard-id") {
  if (!isNonBlankString(value)) errors.push(issue(code, path, "Hazard identifier must be a non-blank exact string."));
}

function validateNullableString(value, path, errors, code = "invalid-hazard-id") {
  if (value !== null) validateString(value, path, errors, code);
}

function validateSafeInteger(value, path, errors, { positive = false, code = "invalid-hazard-number" } = {}) {
  if (!Number.isSafeInteger(value) || (positive ? value <= 0 : value < 0)) {
    errors.push(issue(code, path, positive
      ? "Hazard value must be a positive safe integer."
      : "Hazard value must be a non-negative safe integer."));
  }
}

function validateEnum(value, values, path, errors, code) {
  if (!values.has(value)) errors.push(issue(code, path, "Hazard value is not recognized."));
}

function validatePlainDescriptor(value, path, errors, nullable = false) {
  if (nullable && value === null) return;
  if (!isSafePlainObject(value)) errors.push(issue("invalid-hazard-descriptor", path, "Hazard descriptors must be plain objects."));
}

function validateRequiredDescriptor(value, path, errors, code = "invalid-hazard-descriptor") {
  if (!isSafePlainObject(value) || Object.keys(value).length === 0) {
    errors.push(issue(code, path, "Hazard descriptors must be non-empty plain objects."));
  }
}

function validateTiming(value, path, errors) {
  if (!isSafePlainObject(value)) {
    errors.push(issue("invalid-hazard-timing", path, "Hazard timing must be a plain object."));
    return;
  }
  exactKeys(value, ["kind", "stationId", "resultId"], path, errors, "unexpected-hazard-timing-field");
  validateEnum(value.kind, HAZARD_TIMING_VALUES, `${path}.kind`, errors, "invalid-hazard-timing-kind");

  const stationPath = `${path}.stationId`;
  const resultPath = `${path}.resultId`;
  if (value.kind === VOYAGE_HAZARD_TIMING_KINDS.NAMED_STATION_ACTIVATION) {
    validateString(value.stationId, stationPath, errors, "invalid-hazard-timing-station-id");
    if (value.resultId !== null) errors.push(issue("invalid-hazard-timing-result-id", resultPath, "Named-station timing requires a null resultId."));
  } else if (value.kind === VOYAGE_HAZARD_TIMING_KINDS.SPECIFIED_RESULT) {
    validateString(value.resultId, resultPath, errors, "invalid-hazard-timing-result-id");
    if (value.stationId !== null) errors.push(issue("invalid-hazard-timing-station-id", stationPath, "Specified-result timing requires a null stationId."));
  } else {
    if (value.stationId !== null) errors.push(issue("invalid-hazard-timing-station-id", stationPath, "This timing kind requires a null stationId."));
    if (value.resultId !== null) errors.push(issue("invalid-hazard-timing-result-id", resultPath, "This timing kind requires a null resultId."));
  }
}

function validateDuration(value, path, errors) {
  if (!isSafePlainObject(value)) {
    errors.push(issue("invalid-hazard-duration", path, "Hazard duration must be a plain object."));
    return;
  }
  exactKeys(value, ["mode", "remaining", "initial", "decrementTiming"], path, errors, "unexpected-hazard-duration-field");
  validateEnum(value.mode, HAZARD_DURATION_VALUES, `${path}.mode`, errors, "invalid-hazard-duration-mode");
  if (value.mode === VOYAGE_HAZARD_DURATION_MODES.NONE) {
    if (value.remaining !== null) errors.push(issue("invalid-hazard-duration-remaining", `${path}.remaining`, "None duration requires a null remaining value."));
    if (value.initial !== null) errors.push(issue("invalid-hazard-duration-initial", `${path}.initial`, "None duration requires a null initial value."));
    if (value.decrementTiming !== null) errors.push(issue("invalid-hazard-duration-timing", `${path}.decrementTiming`, "None duration requires a null decrementTiming."));
    return;
  }
  validateSafeInteger(value.remaining, `${path}.remaining`, errors, { code: "invalid-hazard-duration-remaining" });
  validateSafeInteger(value.initial, `${path}.initial`, errors, { code: "invalid-hazard-duration-initial" });
  if (Number.isSafeInteger(value.remaining) && Number.isSafeInteger(value.initial) && value.remaining > value.initial) {
    errors.push(issue("invalid-hazard-duration-count", `${path}.remaining`, "Duration remaining must not exceed initial."));
  }
  if (value.decrementTiming === null) errors.push(issue("missing-hazard-duration-timing", `${path}.decrementTiming`, "Non-none duration requires decrementTiming."));
  else validateTiming(value.decrementTiming, `${path}.decrementTiming`, errors);
}

function validateEscalation(value, path, errors) {
  if (!isSafePlainObject(value)) {
    errors.push(issue("invalid-hazard-escalation", path, "Hazard escalation must be a plain object."));
    return;
  }
  exactKeys(value, ["mode", "currentStageId", "stages", "countdown", "maximumEscalationReached", "escalationConsequence"], path, errors, "unexpected-hazard-escalation-field");
  validateEnum(value.mode, HAZARD_ESCALATION_VALUES, `${path}.mode`, errors, "invalid-hazard-escalation-mode");
  if (typeof value.maximumEscalationReached !== "boolean") errors.push(issue("invalid-hazard-escalation-maximum", `${path}.maximumEscalationReached`, "maximumEscalationReached must be boolean."));
  validatePlainDescriptor(value.escalationConsequence, `${path}.escalationConsequence`, errors, true);

  if (!Array.isArray(value.stages)) {
    errors.push(issue("invalid-hazard-escalation-stages", `${path}.stages`, "Escalation stages must be an array."));
  } else {
    const stageIds = new Set();
    for (let index = 0; index < value.stages.length; index += 1) {
      const stage = value.stages[index];
      const stagePath = `${path}.stages[${index}]`;
      if (!isSafePlainObject(stage)) {
        errors.push(issue("invalid-hazard-escalation-stage", stagePath, "Escalation stages must be plain objects."));
        continue;
      }
      exactKeys(stage, ["stageId", "effect", "ignoredConsequence"], stagePath, errors, "unexpected-hazard-escalation-stage-field");
      validateString(stage.stageId, `${stagePath}.stageId`, errors, "invalid-hazard-escalation-stage-id");
      if (isNonBlankString(stage.stageId) && stageIds.has(stage.stageId)) errors.push(issue("duplicate-hazard-escalation-stage-id", `${stagePath}.stageId`, "Escalation stage IDs must be unique."));
      if (isNonBlankString(stage.stageId)) stageIds.add(stage.stageId);
      validatePlainDescriptor(stage.effect, `${stagePath}.effect`, errors);
      validatePlainDescriptor(stage.ignoredConsequence, `${stagePath}.ignoredConsequence`, errors);
    }

    if (value.mode === VOYAGE_HAZARD_ESCALATION_MODES.STAGES) {
      validateString(value.currentStageId, `${path}.currentStageId`, errors, "invalid-hazard-escalation-current-stage");
      if (isNonBlankString(value.currentStageId) && !stageIds.has(value.currentStageId)) errors.push(issue("invalid-hazard-escalation-current-stage", `${path}.currentStageId`, "Current escalation stage must exist in stages."));
      if (value.stages.length === 0) errors.push(issue("missing-hazard-escalation-stage", `${path}.stages`, "Stages mode requires at least one stage."));
    } else if (value.mode === VOYAGE_HAZARD_ESCALATION_MODES.NONE || value.mode === VOYAGE_HAZARD_ESCALATION_MODES.COUNTDOWN) {
      if (value.currentStageId !== null) errors.push(issue("invalid-hazard-escalation-current-stage", `${path}.currentStageId`, "This escalation mode requires a null currentStageId."));
      if (value.stages.length !== 0) errors.push(issue("invalid-hazard-escalation-stages", `${path}.stages`, "This escalation mode requires an empty stages array."));
    }
  }

  if (value.mode === VOYAGE_HAZARD_ESCALATION_MODES.COUNTDOWN) {
    const countdownPath = `${path}.countdown`;
    if (!isSafePlainObject(value.countdown)) {
      errors.push(issue("invalid-hazard-escalation-countdown", countdownPath, "Countdown mode requires a plain countdown object."));
    } else {
      exactKeys(value.countdown, ["current", "initial", "decrementTiming"], countdownPath, errors, "unexpected-hazard-escalation-countdown-field");
      validateSafeInteger(value.countdown.current, `${countdownPath}.current`, errors, { code: "invalid-hazard-escalation-countdown" });
      validateSafeInteger(value.countdown.initial, `${countdownPath}.initial`, errors, { code: "invalid-hazard-escalation-countdown" });
      if (Number.isSafeInteger(value.countdown.current) && Number.isSafeInteger(value.countdown.initial) && value.countdown.current > value.countdown.initial) errors.push(issue("invalid-hazard-escalation-countdown", countdownPath, "Countdown current must not exceed initial."));
      validateTiming(value.countdown.decrementTiming, `${countdownPath}.decrementTiming`, errors);
    }
  } else if (value.countdown !== null) {
    errors.push(issue("invalid-hazard-escalation-countdown", `${path}.countdown`, "This escalation mode requires a null countdown."));
  }
}

function validateCollision(value, metadata, path, errors, context = {}) {
  validateEnum(value, HAZARD_COLLISION_VALUES, path, errors, "invalid-hazard-collision-policy");
  if (!isSafePlainObject(metadata)) return;
  if (!Object.hasOwn(metadata, "collision")) {
    errors.push(issue("missing-hazard-collision-metadata", `${path.replace(".collisionPolicy", ".metadata.collision")}`, "Hazard metadata requires collision data."));
    return;
  }
  const collision = metadata.collision;
  if (!isSafePlainObject(collision)) {
    errors.push(issue("invalid-hazard-collision-metadata", `${path.replace(".collisionPolicy", ".metadata.collision")}`, "Hazard collision data must be a plain object."));
    return;
  }

  const collisionPath = path.replace(".collisionPolicy", ".metadata.collision");
  if (value === VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING) {
    const keys = Object.keys(collision);
    if (keys.length === 1 && Object.hasOwn(collision, "targetStageId")) {
      validateString(collision.targetStageId, `${collisionPath}.targetStageId`, errors, "invalid-hazard-collision-target-stage");
    } else if (keys.length === 1 && Object.hasOwn(collision, "escalation")) {
      const escalationPath = `${collisionPath}.escalation`;
      if (!isSafePlainObject(collision.escalation)) {
        errors.push(issue("invalid-hazard-collision-escalation", escalationPath, "Escalation collision data must be a plain object."));
      } else {
        exactKeys(collision.escalation, ["operationId"], escalationPath, errors, "unexpected-hazard-collision-escalation-field");
        if (!Object.hasOwn(collision.escalation, "operationId")) {
          errors.push(issue("invalid-hazard-collision-escalation", escalationPath, "Escalation collision data requires operationId."));
        } else {
          validateString(collision.escalation.operationId, `${escalationPath}.operationId`, errors, "invalid-hazard-collision-operation-id");
        }
      }
    } else {
      exactKeys(collision, ["targetStageId"], collisionPath, errors, "unexpected-hazard-collision-field");
      errors.push(issue("invalid-hazard-collision-metadata", collisionPath, "Escalation collision requires exactly one targetStageId or escalation operation."));
    }
  } else if (value === VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING) {
    const keys = Object.keys(collision);
    if (keys.length === 1 && Object.hasOwn(collision, "hazardId")) {
      validateString(collision.hazardId, `${collisionPath}.hazardId`, errors, "invalid-hazard-collision-hazard-id");
    } else {
      exactKeys(collision, HAZARD_FIELDS, collisionPath, errors, "unexpected-hazard-collision-field");
      if (keys.length === HAZARD_FIELDS.length && HAZARD_FIELDS.every((field) => Object.hasOwn(collision, field))) {
        if (context.rejectInlineReplacement) {
          errors.push(issue("recursive-hazard-replacement", collisionPath, "Inline replacement definitions must not recursively contain another inline replacement definition."));
        } else {
          validateRecordValues(collision, "active", undefined, errors, collisionPath, { rejectInlineReplacement: true });
        }
      } else {
        errors.push(issue("invalid-hazard-collision-replacement", collisionPath, "Replacement collision data requires a stable hazardId reference or complete active Hazard definition."));
      }
    }
  } else if (value === VOYAGE_HAZARD_COLLISION_POLICIES.TRIGGER_EXISTING_CONSEQUENCE) {
    exactKeys(collision, ["consequence"], collisionPath, errors, "unexpected-hazard-collision-field");
    validateRequiredDescriptor(collision.consequence, `${collisionPath}.consequence`, errors, "invalid-hazard-collision-consequence");
  } else if (value === VOYAGE_HAZARD_COLLISION_POLICIES.EXTEND_DURATION) {
    exactKeys(collision, ["amount"], collisionPath, errors, "unexpected-hazard-collision-field");
    validateSafeInteger(collision.amount, `${collisionPath}.amount`, errors, { positive: true, code: "invalid-hazard-collision-amount" });
  } else if (value === VOYAGE_HAZARD_COLLISION_POLICIES.ADD_PRESSURE) {
    exactKeys(collision, ["pressureSystemId", "amount"], collisionPath, errors, "unexpected-hazard-collision-field");
    if (!PRESSURE_SYSTEM_IDS.has(collision.pressureSystemId)) errors.push(issue("invalid-hazard-collision-pressure-system", `${collisionPath}.pressureSystemId`, "Collision Pressure target must be canonical."));
    validateSafeInteger(collision.amount, `${collisionPath}.amount`, errors, { positive: true, code: "invalid-hazard-collision-amount" });
  }
}

function validateTerminalFields(values, mode, errors, path = "$") {
  const status = values.status;
  const fieldPath = (field) => `${path}.${field}`;
  validateNullableString(values.resolvedStageId, fieldPath("resolvedStageId"), errors, "invalid-hazard-resolved-stage");
  if (values.resolvedRoundNumber !== null) validateSafeInteger(values.resolvedRoundNumber, fieldPath("resolvedRoundNumber"), errors, { positive: true, code: "invalid-hazard-resolved-round" });
  if (status === VOYAGE_HAZARD_STATUSES.ACTIVE) {
    if (values.resolvedStageId !== null) errors.push(issue("invalid-hazard-terminal-field", fieldPath("resolvedStageId"), "Active Hazards require a null resolvedStageId."));
    if (values.resolvedRoundNumber !== null) errors.push(issue("invalid-hazard-terminal-field", fieldPath("resolvedRoundNumber"), "Active Hazards require a null resolvedRoundNumber."));
    if (values.terminalReason !== null) errors.push(issue("invalid-hazard-terminal-field", fieldPath("terminalReason"), "Active Hazards require a null terminalReason."));
    if (values.replacedByHazardId !== null) errors.push(issue("invalid-hazard-terminal-field", fieldPath("replacedByHazardId"), "Active Hazards require a null replacedByHazardId."));
    return;
  }
  if (mode === "active") errors.push(issue("invalid-hazard-active-status", fieldPath("status"), "Active-record validation permits only active status."));
  validateString(values.terminalReason, fieldPath("terminalReason"), errors, "invalid-hazard-terminal-reason");
  if (status === VOYAGE_HAZARD_STATUSES.REPLACED) validateString(values.replacedByHazardId, fieldPath("replacedByHazardId"), errors, "invalid-hazard-replaced-by");
  else if (values.replacedByHazardId !== null) errors.push(issue("invalid-hazard-terminal-field", fieldPath("replacedByHazardId"), "Only replaced snapshots may name a replacement Hazard."));
}

function validateRecordValues(values, mode, expectedEncounterId, errors, path = "$", context = {}) {
  const fieldPath = (field) => `${path}.${field}`;
  validateString(values.hazardId, fieldPath("hazardId"), errors, "invalid-hazard-id");
  validateString(values.encounterId, fieldPath("encounterId"), errors, "invalid-hazard-encounter-id");
  if (expectedEncounterId !== undefined && values.encounterId !== expectedEncounterId) errors.push(issue("hazard-encounter-id-mismatch", fieldPath("encounterId"), "Hazard encounterId does not match the expected encounter."));
  validateEnum(values.category, HAZARD_CATEGORY_VALUES, fieldPath("category"), errors, "invalid-hazard-category");
  validateEnum(values.status, HAZARD_STATUS_VALUES, fieldPath("status"), errors, "invalid-hazard-status");
  validateString(values.name, fieldPath("name"), errors, "invalid-hazard-name");
  validatePlainDescriptor(values.currentEffect, fieldPath("currentEffect"), errors);
  validateTiming(values.activationTiming, fieldPath("activationTiming"), errors);
  validatePlainDescriptor(values.removalMethod, fieldPath("removalMethod"), errors);
  validatePlainDescriptor(values.ignoredConsequence, fieldPath("ignoredConsequence"), errors);
  validateEnum(values.visibility, HAZARD_VISIBILITY_VALUES, fieldPath("visibility"), errors, "invalid-hazard-visibility");
  validateString(values.sourceKind, fieldPath("sourceKind"), errors, "invalid-hazard-source-kind");
  validateString(values.createdStageId, fieldPath("createdStageId"), errors, "invalid-hazard-stage-id");
  validateSafeInteger(values.createdRoundNumber, fieldPath("createdRoundNumber"), errors, { positive: true, code: "invalid-hazard-created-round" });
  validateSafeInteger(values.createdSequence, fieldPath("createdSequence"), errors, { code: "invalid-hazard-created-sequence" });
  validateEscalation(values.escalation, fieldPath("escalation"), errors);
  validateDuration(values.duration, fieldPath("duration"), errors);
  validateCollision(values.collisionPolicy, values.metadata, fieldPath("collisionPolicy"), errors, context);
  validatePlainDescriptor(values.metadata, fieldPath("metadata"), errors);

  if (values.category === VOYAGE_HAZARD_CATEGORIES.SYSTEM) {
    if (!PRESSURE_SYSTEM_IDS.has(values.pressureSystemId)) errors.push(issue("invalid-hazard-pressure-system", fieldPath("pressureSystemId"), "System Hazard pressureSystemId must be canonical."));
    if (values.eventAreaId !== null) errors.push(issue("invalid-hazard-event-area", fieldPath("eventAreaId"), "System Hazards require a null eventAreaId."));
    if (values.failurePressureSystemId !== values.pressureSystemId) errors.push(issue("invalid-hazard-failure-pressure-system", fieldPath("failurePressureSystemId"), "System Hazard failurePressureSystemId must equal pressureSystemId."));
  } else if (values.category === VOYAGE_HAZARD_CATEGORIES.EVENT) {
    validateString(values.eventAreaId, fieldPath("eventAreaId"), errors, "invalid-hazard-event-area");
    if (values.pressureSystemId !== null) errors.push(issue("invalid-hazard-pressure-system", fieldPath("pressureSystemId"), "Event Hazards require a null pressureSystemId."));
    if (values.failurePressureSystemId !== null && !PRESSURE_SYSTEM_IDS.has(values.failurePressureSystemId)) errors.push(issue("invalid-hazard-failure-pressure-system", fieldPath("failurePressureSystemId"), "Event Hazard failurePressureSystemId must be canonical or null."));
  }

  for (const field of PROVENANCE_FIELDS) validateNullableString(values[field], fieldPath(field), errors, "invalid-hazard-provenance");
  validateTerminalFields(values, mode, errors, path);
}

function readValidationOptions(options) {
  const errors = [];
  if (options === undefined || options === null) return { ok: true, mode: "active", expectedEncounterId: undefined, errors };
  if (!isSafePlainObject(options)) {
    errors.push(issue("invalid-hazard-options", "$.options", "Hazard validation options must be a plain object."));
    return { ok: false, mode: "active", expectedEncounterId: undefined, errors };
  }

  const keys = ownKeys(options, "$.options", errors);
  if (!keys) return { ok: false, mode: "active", expectedEncounterId: undefined, errors };
  for (const key of keys) {
    if (typeof key !== "string" || !["mode", "expectedEncounterId"].includes(key)) {
      errors.push(issue("unexpected-hazard-option", pathFor("$.options", key), "Hazard validation options contain an unexpected field."));
    }
  }

  const values = {};
  for (const key of ["mode", "expectedEncounterId"]) {
    if (!keys.includes(key)) continue;
    const read = ownDataValue(options, key, "$.options", errors);
    if (read.ok) values[key] = read.value;
  }
  return {
    ok: errors.length === 0,
    mode: values.mode ?? "active",
    expectedEncounterId: values.expectedEncounterId,
    errors
  };
}

function inspectHazardRecord(input, { mode = "active", expectedEncounterId, normalizeProvenance = false } = {}) {
  const errors = [];
  if (mode !== "active" && mode !== "snapshot") errors.push(issue("invalid-hazard-validation-mode", "$.mode", "Hazard validation mode must be active or snapshot."));
  if (!isSafePlainObject(input)) {
    errors.push(issue("invalid-hazard-record", "$", "Hazard record must be a plain object."));
    return { value: null, errors };
  }

  const keys = ownKeys(input, "$", errors);
  if (!keys) return { value: null, errors };
  for (const key of keys) {
    if (typeof key !== "string") errors.push(issue("unexpected-hazard-symbol", pathFor("$", key), "Hazard record must not contain symbol fields."));
    else if (!HAZARD_FIELD_SET.has(key)) errors.push(issue("unexpected-hazard-field", pathFor("$", key), "Hazard record contains an unexpected field."));
  }

  const values = {};
  for (const field of HAZARD_FIELDS) {
    const missingAllowed = normalizeProvenance && PROVENANCE_FIELD_SET.has(field);
    if (missingAllowed && !keys.includes(field)) {
      values[field] = null;
      continue;
    }
    const read = ownDataValue(input, field, "$", errors);
    if (read.ok) values[field] = read.value;
  }

  const normalized = {};
  for (const field of HAZARD_FIELDS) {
    if (!Object.hasOwn(values, field)) continue;
    normalized[field] = cloneSafeData(values[field], `$.${field}`, errors);
  }

  if (errors.length === 0 || Object.keys(normalized).length > 0) validateRecordValues(normalized, mode, expectedEncounterId, errors);
  return { value: errors.length === 0 ? normalized : null, errors };
}

/**
 * Validate one Hazard record. The default active mode is strict enough for a
 * future activeHazards entry; snapshot mode also permits terminal statuses.
 */
export function validateVoyageHazardRecord(record, options = {}) {
  const parsedOptions = readValidationOptions(options);
  if (!parsedOptions.ok) return { valid: false, errors: parsedOptions.errors, warnings: [] };
  const result = inspectHazardRecord(record, {
    mode: parsedOptions.mode,
    expectedEncounterId: parsedOptions.expectedEncounterId,
    normalizeProvenance: false
  });
  return {
    valid: result.errors.length === 0,
    errors: result.errors,
    warnings: []
  };
}

/**
 * Safely capture one isolated Hazard record. Missing provenance fields are
 * normalized to null because source adapters are allowed to omit provenance.
 */
export function captureVoyageHazardRecord(record, options = {}) {
  const parsedOptions = readValidationOptions(options);
  if (!parsedOptions.ok) return { ok: false, record: null, errors: parsedOptions.errors, warnings: [] };
  const result = inspectHazardRecord(record, {
    mode: parsedOptions.mode,
    expectedEncounterId: parsedOptions.expectedEncounterId,
    normalizeProvenance: true
  });
  return {
    ok: result.errors.length === 0,
    record: result.errors.length === 0 ? result.value : null,
    errors: result.errors,
    warnings: []
  };
}

export const VOYAGE_HAZARD_RECORD_FIELDS = HAZARD_FIELDS;
export const VOYAGE_HAZARD_PROVENANCE_FIELDS = PROVENANCE_FIELDS;
