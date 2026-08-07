import {
  VOYAGE_ACTION_OUTCOME_BRANCHES,
  VOYAGE_EFFECT_INTENT_TIMING,
  VOYAGE_EFFECT_INTENT_VISIBILITY,
  VOYAGE_PRESSURE_SYSTEM_IDS
} from "./constants.js";

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export const VOYAGE_VOID_SCAR_STATUSES = Object.freeze({ ACTIVE: "active" });
export const VOYAGE_VOID_SCAR_STATUS = VOYAGE_VOID_SCAR_STATUSES.ACTIVE;
export const VOYAGE_VOID_SCAR_SOURCE_KINDS = Object.freeze({ PRESSURE_BREACH: "pressure-breach" });
export const VOYAGE_VOID_SCAR_SOURCE_KIND = VOYAGE_VOID_SCAR_SOURCE_KINDS.PRESSURE_BREACH;

export const VOYAGE_VOID_SCAR_NAME_BY_PRESSURE_SYSTEM_ID = Object.freeze({
  "crew-morale": "Crew Morale Void Scar",
  arkengine: "Arkengine Void Scar",
  "levstone-array": "Levstone Array Void Scar",
  "solar-sail-rig": "Solar Sail Rig Void Scar",
  lifeveil: "Lifeveil Void Scar"
});

const VOID_SCAR_PROVENANCE_FIELDS = Object.freeze([
  "pressureBreachId",
  "hazardId",
  "encounterId",
  "stageId",
  "roundNumber",
  "effectIndex",
  "sequence",
  "stationId",
  "actionId",
  "pressureEffectId",
  "sourceIntentId",
  "activationSource",
  "branch",
  "timing",
  "visibility"
]);

export const VOYAGE_VOID_SCAR_RECORD_FIELDS = Object.freeze([
  "voidScarId",
  "name",
  "pressureSystemId",
  "status",
  "sourceKind",
  "description",
  "operationalEffects",
  "baseRepairCost",
  "baseRepairTime",
  "repairDcSource",
  "eligibleRepairChecks",
  "requiredFacilities",
  "compatibleFieldRepairTags",
  ...VOID_SCAR_PROVENANCE_FIELDS
]);
export const VOYAGE_VOID_SCAR_PROVENANCE_FIELDS = VOID_SCAR_PROVENANCE_FIELDS;
const M10_CLOSEOUT_VOID_SCAR_SOURCE_FIELDS = Object.freeze([
  "eventId",
  "sessionId",
  "definitionSnapshotId",
  "misfortuneId",
  "voidScarDefinitionId"
]);
const VOYAGE_M10_CLOSEOUT_VOID_SCAR_RECORD_FIELDS = Object.freeze([
  "schemaVersion",
  "voidScarId",
  "name",
  "pressureSystemId",
  "status",
  "sourceKind",
  "description",
  "operationalEffects",
  "baseRepairCost",
  "baseRepairTime",
  "repairDcSource",
  "eligibleRepairChecks",
  "requiredFacilities",
  "compatibleFieldRepairTags",
  "source"
]);

const PRESSURE_SYSTEM_SET = new Set(VOYAGE_PRESSURE_SYSTEM_IDS);
const VOID_SCAR_BRANCHES = new Set(Object.values(VOYAGE_ACTION_OUTCOME_BRANCHES));
const VOID_SCAR_VISIBILITY = new Set(Object.values(VOYAGE_EFFECT_INTENT_VISIBILITY));
const VOID_SCAR_TIMING = new Set(Object.values(VOYAGE_EFFECT_INTENT_TIMING));
const VOID_SCAR_OPTION_FIELDS = Object.freeze([
  "expectedEncounterId",
  "expectedPressureSystemId",
  "expectedPressureBreachId"
]);

function issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function pathFor(path, key) {
  return `${path}.${typeof key === "symbol" ? "[symbol]" : key}`;
}

function isNonBlankString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function safeIsArray(value) {
  try {
    return { ok: true, value: Array.isArray(value) };
  } catch {
    return { ok: false, value: false };
  }
}

function safeGetPrototype(value) {
  try {
    return { ok: true, value: Object.getPrototypeOf(value) };
  } catch {
    return { ok: false, value: undefined };
  }
}

function safeOwnKeys(value) {
  try {
    return { ok: true, value: Reflect.ownKeys(value) };
  } catch {
    return { ok: false, value: [] };
  }
}

function safeDescriptor(value, key) {
  try {
    return { ok: true, value: Object.getOwnPropertyDescriptor(value, key) };
  } catch {
    return { ok: false, value: undefined };
  }
}

function captureError(path, message = "Void Scar data could not be read safely.", code = "void-scar-data-read-failed") {
  return issue(code, path, message);
}

function capturePlainData(value, path, errors, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) errors.push(issue("invalid-void-scar-number", path, "Void Scar data numbers must be finite."));
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    errors.push(issue("invalid-void-scar-value", path, "Void Scar data must contain only serializable values."));
    return undefined;
  }
  if (typeof value !== "object") {
    errors.push(issue("invalid-void-scar-value", path, "Void Scar data contains an unsupported value."));
    return undefined;
  }
  if (ancestors.has(value)) {
    errors.push(issue("cyclic-void-scar-data", path, "Void Scar data must not contain cycles."));
    return undefined;
  }

  const arrayCheck = safeIsArray(value);
  if (!arrayCheck.ok) {
    errors.push(captureError(path));
    return undefined;
  }
  const prototype = safeGetPrototype(value);
  if (!prototype.ok) {
    errors.push(captureError(path));
    return undefined;
  }
  if (arrayCheck.value) {
    if (prototype.value !== Array.prototype) {
      errors.push(issue("invalid-void-scar-object", path, "Void Scar data arrays must use the standard Array prototype."));
      return undefined;
    }
  } else if (prototype.value !== Object.prototype && prototype.value !== null) {
    errors.push(issue("invalid-void-scar-object", path, "Void Scar data must contain only plain objects and arrays."));
    return undefined;
  }

  const reflectedKeys = safeOwnKeys(value);
  if (!reflectedKeys.ok) {
    errors.push(captureError(path));
    return undefined;
  }
  const keys = reflectedKeys.value;
  ancestors.add(value);
  try {
    if (arrayCheck.value) {
      const lengthDescriptor = safeDescriptor(value, "length");
      if (!lengthDescriptor.ok || !lengthDescriptor.value || !Object.hasOwn(lengthDescriptor.value, "value")) {
        errors.push(captureError(`${path}.length`));
        return undefined;
      }
      const length = lengthDescriptor.value.value;
      if (!Number.isSafeInteger(length) || length < 0) {
        errors.push(issue("invalid-void-scar-array", path, "Void Scar arrays must have a safe non-negative length."));
        return undefined;
      }
      if (keys.length !== length + 1) {
        errors.push(issue("invalid-void-scar-array", path, "Void Scar arrays must contain exactly one length key and one key per entry."));
        return undefined;
      }
      const result = new Array(length);
      const expectedKeys = new Set(["length", ...Array.from({ length }, (_, index) => String(index))]);
      for (const key of keys) {
        if (typeof key !== "string" || !expectedKeys.has(key)) {
          errors.push(issue("invalid-void-scar-array", pathFor(path, key), "Void Scar arrays must be dense and contain no extra fields."));
        }
      }
      for (let index = 0; index < length; index += 1) {
        const key = String(index);
        const descriptor = safeDescriptor(value, key);
        if (!descriptor.ok) {
          errors.push(captureError(`${path}[${index}]`));
        } else if (!descriptor.value || descriptor.value.enumerable !== true || !Object.hasOwn(descriptor.value, "value")) {
          errors.push(issue("invalid-void-scar-data-property", `${path}[${index}]`, "Void Scar array entries must be own enumerable data properties."));
        } else {
          const captured = capturePlainData(descriptor.value.value, `${path}[${index}]`, errors, ancestors);
          if (captured !== undefined || descriptor.value.value === null) {
            // The array is only returned when all errors are absent; retaining an
            // undefined placeholder here cannot expose the hostile source.
            result[index] = captured;
          }
        }
      }
      return result;
    }

    const result = {};
    for (const key of keys) {
      if (typeof key !== "string") {
        errors.push(issue("unexpected-void-scar-symbol", pathFor(path, key), "Void Scar data must not contain symbol keys."));
        continue;
      }
      if (UNSAFE_KEYS.has(key)) {
        errors.push(issue("unsafe-void-scar-key", pathFor(path, key), "Void Scar data contains a prototype-sensitive key."));
        continue;
      }
      const descriptor = safeDescriptor(value, key);
      if (!descriptor.ok) {
        errors.push(captureError(pathFor(path, key)));
      } else if (!descriptor.value || descriptor.value.enumerable !== true || !Object.hasOwn(descriptor.value, "value")) {
        errors.push(issue("invalid-void-scar-data-property", pathFor(path, key), "Void Scar fields must be own enumerable data properties."));
      } else {
        const captured = capturePlainData(descriptor.value.value, pathFor(path, key), errors, ancestors);
        if (captured !== undefined || descriptor.value.value === null) result[key] = captured;
      }
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

function captureRoot(value, path, options = {}) {
  const errors = [];
  const result = capturePlainData(value, path, errors);
  return { value: errors.length === 0 ? result : null, errors, options };
}

function exactKeys(value, fields, path, errors, code) {
  const keys = Object.keys(value);
  const expected = new Set(fields);
  for (const key of keys) {
    if (!expected.has(key)) errors.push(issue(code, pathFor(path, key), "Object contains an unexpected field."));
  }
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) errors.push(issue("missing-void-scar-field", pathFor(path, field), `Object requires ${field}.`));
  }
  if (keys.length === fields.length && keys.some((key, index) => key !== fields[index])) {
    errors.push(issue("invalid-void-scar-key-order", path, "Object fields must use the canonical order."));
  }
}

function validateString(value, path, errors, code = "invalid-void-scar-id") {
  if (!isNonBlankString(value)) errors.push(issue(code, path, "Value must be a non-blank exact string."));
}

function validateNullableString(value, path, errors, code = "invalid-void-scar-id") {
  if (value !== null) validateString(value, path, errors, code);
}

function validateSafeInteger(value, path, errors, positive = false, code = "invalid-void-scar-number") {
  if (!Number.isSafeInteger(value) || (positive ? value <= 0 : value < 0)) {
    errors.push(issue(code, path, positive ? "Value must be a positive safe integer." : "Value must be a non-negative safe integer."));
  }
}

function validateDescriptor(value, path, errors, { allowNumber = false, allowString = false } = {}) {
  if (allowNumber && typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) errors.push(issue("invalid-void-scar-descriptor", path, "Descriptor numbers must be non-negative safe integers."));
    return;
  }
  if (allowString && isNonBlankString(value)) return;
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) {
    errors.push(issue("invalid-void-scar-descriptor", path, "Descriptor must be a non-empty plain object or an allowed scalar."));
  }
}

function validateDescriptorArray(value, path, errors) {
  if (!Array.isArray(value)) {
    errors.push(issue("invalid-void-scar-array", path, "Value must be a dense array."));
    return;
  }
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    if (typeof entry === "string") validateString(entry, `${path}[${index}]`, errors, "invalid-void-scar-descriptor");
    else validateDescriptor(entry, `${path}[${index}]`, errors);
  }
}

function canonicalVoidScarId(pressureBreachId) {
  return `arcflight-void-scar:${JSON.stringify(["pressure-breach", pressureBreachId])}`;
}

function canonicalM10CloseoutVoidScarId(source) {
  return `arcflight-void-scar:${JSON.stringify([
    "m8-critical-overall-failure",
    source.eventId,
    source.sessionId,
    source.definitionSnapshotId,
    source.misfortuneId,
    source.voidScarDefinitionId,
    source.pressureSystemId
  ])}`;
}

function readOptions(options) {
  const captured = captureRoot(options, "$.options");
  const errors = [...captured.errors];
  if (errors.length > 0) return { ok: false, value: null, errors };
  exactKeys(captured.value, VOID_SCAR_OPTION_FIELDS.filter((field) => Object.hasOwn(captured.value, field)), "$.options", errors, "unexpected-void-scar-option");
  for (const field of VOID_SCAR_OPTION_FIELDS) {
    if (Object.hasOwn(captured.value, field)) validateString(captured.value[field], `$.options.${field}`, errors, "invalid-void-scar-option");
  }
  return { ok: errors.length === 0, value: captured.value, errors };
}

function validateValues(record, options, errors) {
  exactKeys(record, VOYAGE_VOID_SCAR_RECORD_FIELDS, "$", errors, "unexpected-void-scar-field");
  validateString(record.voidScarId, "$.voidScarId", errors);
  validateString(record.name, "$.name", errors, "invalid-void-scar-name");
  if (!PRESSURE_SYSTEM_SET.has(record.pressureSystemId)) errors.push(issue("invalid-void-scar-pressure-system", "$.pressureSystemId", "Pressure-system identifier is not canonical."));
  if (record.name !== VOYAGE_VOID_SCAR_NAME_BY_PRESSURE_SYSTEM_ID[record.pressureSystemId]) errors.push(issue("invalid-void-scar-name", "$.name", "Void Scar name must match its canonical Pressure system."));
  if (record.status !== VOYAGE_VOID_SCAR_STATUS) errors.push(issue("invalid-void-scar-status", "$.status", "Void Scar status must be active."));
  if (record.sourceKind !== VOYAGE_VOID_SCAR_SOURCE_KIND) errors.push(issue("invalid-void-scar-source-kind", "$.sourceKind", "Void Scar sourceKind must be pressure-breach."));
  validateString(record.description, "$.description", errors, "invalid-void-scar-description");
  validateDescriptorArray(record.operationalEffects, "$.operationalEffects", errors);
  validateDescriptor(record.baseRepairCost, "$.baseRepairCost", errors, { allowNumber: true });
  validateDescriptor(record.baseRepairTime, "$.baseRepairTime", errors, { allowNumber: true });
  validateDescriptor(record.repairDcSource, "$.repairDcSource", errors, { allowString: true });
  validateDescriptorArray(record.eligibleRepairChecks, "$.eligibleRepairChecks", errors);
  validateDescriptorArray(record.requiredFacilities, "$.requiredFacilities", errors);
  validateDescriptorArray(record.compatibleFieldRepairTags, "$.compatibleFieldRepairTags", errors);

  for (const field of ["pressureBreachId", "hazardId", "encounterId", "stageId", "stationId", "actionId", "pressureEffectId"]) {
    validateString(record[field], `$.${field}`, errors, `invalid-void-scar-${field}`);
  }
  for (const field of ["roundNumber", "effectIndex", "sequence"]) validateSafeInteger(record[field], `$.${field}`, errors, false, `invalid-void-scar-${field}`);
  validateNullableString(record.sourceIntentId, "$.sourceIntentId", errors, "invalid-void-scar-source-intent");
  validateNullableString(record.activationSource, "$.activationSource", errors, "invalid-void-scar-activation-source");
  if (!VOID_SCAR_BRANCHES.has(record.branch)) errors.push(issue("invalid-void-scar-branch", "$.branch", "Void Scar branch is not recognized."));
  if (!VOID_SCAR_TIMING.has(record.timing)) errors.push(issue("invalid-void-scar-timing", "$.timing", "Void Scar timing must be consequences."));
  if (!VOID_SCAR_VISIBILITY.has(record.visibility)) errors.push(issue("invalid-void-scar-visibility", "$.visibility", "Void Scar visibility is not recognized."));
  if (isNonBlankString(record.pressureBreachId) && record.voidScarId !== canonicalVoidScarId(record.pressureBreachId)) {
    errors.push(issue("invalid-void-scar-id", "$.voidScarId", "Void Scar ID must be deterministic from pressureBreachId."));
  }
  if (options.expectedEncounterId !== undefined && record.encounterId !== options.expectedEncounterId) errors.push(issue("void-scar-encounter-id-mismatch", "$.encounterId", "Void Scar encounterId must match the expected encounter."));
  if (options.expectedPressureSystemId !== undefined && record.pressureSystemId !== options.expectedPressureSystemId) errors.push(issue("void-scar-pressure-system-mismatch", "$.pressureSystemId", "Void Scar pressureSystemId must match the expected system."));
  if (options.expectedPressureBreachId !== undefined && record.pressureBreachId !== options.expectedPressureBreachId) errors.push(issue("void-scar-pressure-breach-id-mismatch", "$.pressureBreachId", "Void Scar pressureBreachId must match the expected breach."));
}

function inspect(record, options) {
  const captured = captureRoot(record, "$");
  const errors = [...captured.errors];
  if (errors.length === 0) {
    if (captured.value === null || typeof captured.value !== "object" || Array.isArray(captured.value)) {
      errors.push(issue("invalid-void-scar-object", "$", "Void Scar data must contain only plain objects and arrays."));
    } else {
      validateValues(captured.value, options, errors);
    }
  }
  return { value: errors.length === 0 ? captured.value : null, errors };
}

function validateM10CloseoutValues(record, errors) {
  exactKeys(record, VOYAGE_M10_CLOSEOUT_VOID_SCAR_RECORD_FIELDS, "$", errors, "unexpected-void-scar-field");
  if (record.schemaVersion !== 2) errors.push(issue("invalid-void-scar-schema-version", "$.schemaVersion", "Void Scar schemaVersion must be 2."));
  validateString(record.voidScarId, "$.voidScarId", errors);
  validateString(record.name, "$.name", errors, "invalid-void-scar-name");
  if (!PRESSURE_SYSTEM_SET.has(record.pressureSystemId)) errors.push(issue("invalid-void-scar-pressure-system", "$.pressureSystemId", "Pressure-system identifier is not canonical."));
  if (record.status !== VOYAGE_VOID_SCAR_STATUS) errors.push(issue("invalid-void-scar-status", "$.status", "Void Scar status must be active."));
  if (record.sourceKind !== "m8-critical-overall-failure") errors.push(issue("invalid-void-scar-source-kind", "$.sourceKind", "Void Scar sourceKind must be m8-critical-overall-failure."));
  validateString(record.description, "$.description", errors, "invalid-void-scar-description");
  validateDescriptorArray(record.operationalEffects, "$.operationalEffects", errors);
  validateDescriptor(record.baseRepairCost, "$.baseRepairCost", errors, { allowNumber: true });
  validateDescriptor(record.baseRepairTime, "$.baseRepairTime", errors, { allowNumber: true });
  validateDescriptor(record.repairDcSource, "$.repairDcSource", errors, { allowString: true });
  validateDescriptorArray(record.eligibleRepairChecks, "$.eligibleRepairChecks", errors);
  validateDescriptorArray(record.requiredFacilities, "$.requiredFacilities", errors);
  validateDescriptorArray(record.compatibleFieldRepairTags, "$.compatibleFieldRepairTags", errors);
  const sourceKeys = isPlainObject(record.source)
    && Object.keys(record.source).length === M10_CLOSEOUT_VOID_SCAR_SOURCE_FIELDS.length
    && Object.keys(record.source).every((key, index) => key === M10_CLOSEOUT_VOID_SCAR_SOURCE_FIELDS[index]);
  if (!sourceKeys) {
    errors.push(issue("invalid-void-scar-source", "$.source", "Closeout Void Scar source is invalid."));
  } else {
    for (const field of M10_CLOSEOUT_VOID_SCAR_SOURCE_FIELDS) validateString(record.source[field], `$.source.${field}`, errors, "invalid-void-scar-source");
    if (record.voidScarId !== canonicalM10CloseoutVoidScarId({ ...record.source, pressureSystemId: record.pressureSystemId })) {
      errors.push(issue("invalid-void-scar-id", "$.voidScarId", "Void Scar ID must be deterministic from its closeout source."));
    }
  }
}

function inspectDurable(record) {
  const captured = captureRoot(record, "$");
  const errors = [...captured.errors];
  if (errors.length === 0) {
    if (captured.value === null || typeof captured.value !== "object" || Array.isArray(captured.value)) {
      errors.push(issue("invalid-void-scar-object", "$", "Void Scar data must contain only plain objects and arrays."));
    } else if (captured.value.schemaVersion === 2) {
      validateM10CloseoutValues(captured.value, errors);
    } else {
      validateValues(captured.value, {}, errors);
    }
  }
  return { value: errors.length === 0 ? captured.value : null, errors };
}

export function validateVoyageVoidScarRecord(record, options = {}) {
  const parsedOptions = readOptions(options);
  if (!parsedOptions.ok) return { valid: false, errors: parsedOptions.errors, warnings: [] };
  const result = inspect(record, parsedOptions.value);
  return { valid: result.errors.length === 0, errors: result.errors, warnings: [] };
}

export function captureVoyageVoidScarRecord(record, options = {}) {
  const parsedOptions = readOptions(options);
  if (!parsedOptions.ok) return { ok: false, record: null, errors: parsedOptions.errors, warnings: [] };
  const result = inspect(record, parsedOptions.value);
  return { ok: result.errors.length === 0, record: result.errors.length === 0 ? result.value : null, errors: result.errors, warnings: [] };
}

export function validateVoyageDurableVoidScarRecord(record) {
  const result = inspectDurable(record);
  return { valid: result.errors.length === 0, errors: result.errors, warnings: [] };
}

export function captureVoyageDurableVoidScarRecord(record) {
  const result = inspectDurable(record);
  return {
    ok: result.errors.length === 0,
    record: result.errors.length === 0 ? result.value : null,
    errors: result.errors,
    warnings: []
  };
}

// Used by the durable ship-state boundary so both public APIs share the same
// narrow, reflection-safe capture implementation without exposing caller data.
export function captureVoyageVoidScarPlainData(value, path = "$") {
  const errors = [];
  const captured = capturePlainData(value, path, errors);
  return { ok: errors.length === 0, value: errors.length === 0 ? captured : null, errors };
}

export const getCanonicalVoyageVoidScarId = canonicalVoidScarId;
