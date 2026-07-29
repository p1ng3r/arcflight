import {
  VOYAGE_CONTROLLED_EFFECT_INTENT_TYPES as CONTROLLED_INTENTS,
  VOYAGE_EVENT_RUNNER_STATION_IDS,
  VOYAGE_EFFECT_INTENT_TIMING as TIMINGS,
  VOYAGE_EFFECT_TARGET_KINDS as TARGETS
} from "./constants.js";
import { isPlainObject } from "./defaults.js";

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const CHECK_MODIFIER_TARGETS = Object.freeze([
  TARGETS.SOURCE_STATION,
  TARGETS.STATION,
  TARGETS.SELECTED_TARGET
]);
const RESOURCE_TARGETS = CHECK_MODIFIER_TARGETS;
const PRESSURE_TARGETS = Object.freeze([
  TARGETS.SOURCE_STATION,
  TARGETS.STATION,
  TARGETS.PRESSURE_SYSTEM,
  TARGETS.SELECTED_TARGET
]);
const HAZARD_OPERATION_TARGETS = Object.freeze([TARGETS.HAZARD, TARGETS.SELECTED_TARGET]);
const HAZARD_CREATE_TARGETS = Object.freeze([
  TARGETS.PRESSURE_SYSTEM,
  TARGETS.ENCOUNTER,
  TARGETS.CURRENT_STAGE,
  TARGETS.SELECTED_TARGET
]);
const CANONICAL_STATION_IDS = Object.freeze([...VOYAGE_EVENT_RUNNER_STATION_IDS]);

function freezeField(schema) {
  return Object.freeze({
    ...schema,
    ...(schema.values ? { values: Object.freeze([...schema.values]) } : {})
  });
}

function freezeSchema(schema) {
  return Object.fromEntries(Object.entries(schema).map(([key, field]) => [key, freezeField(field)]));
}

function freezeContract({ implemented, targetKinds, timings, required = {}, optional = {}, variants = null, applicationConstraints = {} }) {
  return Object.freeze({
    implemented,
    targetKinds: Object.freeze([...targetKinds]),
    timings: Object.freeze([...timings]),
    required: Object.freeze(freezeSchema(required)),
    optional: Object.freeze(freezeSchema(optional)),
    ...(variants ? { variants: Object.freeze(variants.map((variant) => Object.freeze({
      required: Object.freeze(freezeSchema(variant.required ?? {})),
      optional: Object.freeze(freezeSchema(variant.optional ?? {}))
    }))) } : {}),
    unexpectedFields: "reject",
    applicationConstraints: Object.freeze({ ...applicationConstraints })
  });
}

/**
 * Declarative schema metadata for controlled Milestone 3B effect intents.
 * All canonical controlled contracts are declarative and fail closed on invalid data.
 */
export const VOYAGE_CONTROLLED_EFFECT_INTENT_CONTRACTS = Object.freeze({
  [CONTROLLED_INTENTS.DC_CHANGE]: freezeContract({
    implemented: true,
    targetKinds: CHECK_MODIFIER_TARGETS,
    timings: [TIMINGS.CONSEQUENCES, TIMINGS.END_OF_ROUND],
    required: { delta: { type: "safe-integer", nonzero: true } },
    applicationConstraints: { maximumTotalDcReduction: -5 }
  }),
  [CONTROLLED_INTENTS.ROLL_MODIFIER]: freezeContract({
    implemented: true,
    targetKinds: CHECK_MODIFIER_TARGETS,
    timings: [TIMINGS.CONSEQUENCES],
    required: { delta: { type: "safe-integer", nonzero: true } },
    applicationConstraints: { minimumTotal: -5, maximumTotal: 5 }
  }),
  [CONTROLLED_INTENTS.RESULT_DEGREE_SHIFT]: freezeContract({
    implemented: true,
    targetKinds: CHECK_MODIFIER_TARGETS,
    timings: [TIMINGS.CONSEQUENCES],
    required: { steps: { type: "safe-integer", values: [1, -1] } },
    applicationConstraints: { maximumImprovement: "critical-success", minimumWorsening: "critical-failure" }
  }),
  [CONTROLLED_INTENTS.REROLL]: freezeContract({
    implemented: true,
    targetKinds: CHECK_MODIFIER_TARGETS,
    timings: [TIMINGS.CONSEQUENCES],
    required: { keep: { type: "enum", values: ["second"] } },
    applicationConstraints: { maximumPerCheck: 1 }
  }),
  [CONTROLLED_INTENTS.ROLL_TWICE]: freezeContract({
    implemented: true,
    targetKinds: CHECK_MODIFIER_TARGETS,
    timings: [TIMINGS.CONSEQUENCES],
    required: { keep: { type: "enum", values: ["better"] } },
    applicationConstraints: { maximumPerCheck: 1 }
  }),
  [CONTROLLED_INTENTS.FOCUS_RESTORATION]: freezeContract({
    implemented: true,
    targetKinds: RESOURCE_TARGETS,
    timings: [TIMINGS.CONSEQUENCES, TIMINGS.END_OF_ROUND],
    required: { amount: { type: "safe-integer", minimum: 1 } },
    applicationConstraints: { maximumAtCurrentCapacity: true }
  }),
  [CONTROLLED_INTENTS.PRESSURE_CHANGE]: freezeContract({
    implemented: true,
    targetKinds: PRESSURE_TARGETS,
    timings: [TIMINGS.CONSEQUENCES, TIMINGS.END_OF_ROUND],
    required: { delta: { type: "safe-integer", nonzero: true } },
    applicationConstraints: { minimumAppliedPressure: 0 }
  }),
  [CONTROLLED_INTENTS.HAZARD_CREATE]: freezeContract({
    implemented: true,
    targetKinds: HAZARD_CREATE_TARGETS,
    timings: [TIMINGS.CONSEQUENCES, TIMINGS.END_OF_ROUND],
    required: { hazardId: { type: "safe-string" } }
  }),
  [CONTROLLED_INTENTS.HAZARD_REMOVE]: freezeContract({
    implemented: true,
    targetKinds: HAZARD_OPERATION_TARGETS,
    timings: [TIMINGS.CONSEQUENCES, TIMINGS.END_OF_ROUND]
  }),
  [CONTROLLED_INTENTS.HAZARD_PREVENT]: freezeContract({
    implemented: true,
    targetKinds: HAZARD_OPERATION_TARGETS,
    timings: [TIMINGS.CONSEQUENCES, TIMINGS.END_OF_ROUND]
  }),
  [CONTROLLED_INTENTS.HAZARD_SUPPRESS]: freezeContract({
    implemented: true,
    targetKinds: HAZARD_OPERATION_TARGETS,
    timings: [TIMINGS.CONSEQUENCES, TIMINGS.END_OF_ROUND]
  }),
  [CONTROLLED_INTENTS.STATION_ORDER_CHANGE]: freezeContract({
    implemented: true,
    targetKinds: [TARGETS.SOURCE_STATION, TARGETS.STATION, TARGETS.SELECTED_TARGET],
    timings: [TIMINGS.CONSEQUENCES, TIMINGS.END_OF_ROUND],
    variants: [
      { required: { position: { type: "enum", values: ["first", "last"] } } },
      { required: {
        position: { type: "enum", values: ["before", "after"] },
        anchorStationId: { type: "enum", values: CANONICAL_STATION_IDS }
      } }
    ]
  }),
  [CONTROLLED_INTENTS.SYSTEM_REPAIR]: freezeContract({
    implemented: true,
    targetKinds: PRESSURE_TARGETS,
    timings: [TIMINGS.CONSEQUENCES, TIMINGS.END_OF_ROUND],
    required: { scope: { type: "enum", values: ["temporary"] } }
  }),
  [CONTROLLED_INTENTS.SYSTEM_PROTECTION]: freezeContract({
    implemented: true,
    targetKinds: PRESSURE_TARGETS,
    timings: [TIMINGS.CONSEQUENCES, TIMINGS.END_OF_ROUND],
    required: { scope: { type: "enum", values: ["next-consequence"] } }
  })
});

export function isVoyageControlledEffectIntentType(value) {
  return typeof value === "string" && Object.values(CONTROLLED_INTENTS).includes(value);
}

function issue(errors, code, path, message) {
  errors.push({ code, path, message, severity: "error" });
}

function safeOwnKeys(value, path, errors) {
  try {
    return Reflect.ownKeys(value);
  } catch {
    issue(errors, "controlled-intent-payload-data-read-failed", path, "Controlled intent payload could not be inspected safely.");
    return null;
  }
}

function safeDescriptor(value, key, path, errors) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value")) {
      issue(errors, "controlled-intent-payload-data-read-failed", path, "Controlled intent payload fields must be own data properties.");
      return null;
    }
    return descriptor;
  } catch {
    issue(errors, "controlled-intent-payload-data-read-failed", path, "Controlled intent payload could not be read safely.");
    return null;
  }
}

function validateField(value, schema, path, errors) {
  if (schema.type === "boolean") {
    if (typeof value !== "boolean") issue(errors, "controlled-intent-payload-invalid-type", path, "Controlled intent payload field must be a boolean.");
    return;
  }
  if (schema.type === "safe-string") {
    if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) {
      issue(errors, "controlled-intent-payload-invalid-type", path, "Controlled intent payload field must be a non-blank exact string.");
    } else if (UNSAFE_KEYS.has(value)) {
      issue(errors, "controlled-intent-payload-unsafe-id", path, "Controlled intent payload field must not use an unsafe identifier.");
    }
    return;
  }
  if (schema.type === "enum") {
    if (typeof value !== "string") {
      issue(errors, "controlled-intent-payload-invalid-type", path, "Controlled intent payload field must be an exact enum string.");
    } else if (!schema.values.includes(value)) {
      issue(errors, "controlled-intent-payload-invalid-enum", path, "Controlled intent payload field is not an allowed enum value.");
    }
    return;
  }
  const integer = schema.type === "safe-integer";
  if (typeof value !== "number" || !Number.isFinite(value) || (integer && !Number.isSafeInteger(value))) {
    issue(errors, "controlled-intent-payload-invalid-type", path, integer
      ? "Controlled intent payload field must be a finite safe integer."
      : "Controlled intent payload field must be a finite number.");
    return;
  }
  if (schema.nonzero && value === 0) {
    issue(errors, "controlled-intent-payload-zero-prohibited", path, "Controlled intent payload field must not be zero.");
  }
  if (schema.values && !schema.values.includes(value)) {
    issue(errors, "controlled-intent-payload-invalid-enum", path, "Controlled intent payload field is not an allowed exact value.");
  }
  if ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum)) {
    issue(errors, "controlled-intent-payload-number-out-of-range", path, "Controlled intent payload number is outside the allowed range.");
  }
}

function selectPayloadVariant(payload, keys, contract, path, errors) {
  const stringKeys = keys.filter((key) => typeof key === "string");
  const candidates = [];
  for (const variant of contract.variants) {
    const schemas = { ...variant.required, ...variant.optional };
    const expected = Object.keys(schemas).sort();
    const actual = [...stringKeys].sort();
    if (expected.length !== actual.length || expected.some((key, index) => key !== actual[index])) continue;
    const candidateErrors = [];
    for (const key of expected) {
      const descriptor = safeDescriptor(payload, key, `${path}.${key}`, candidateErrors);
      if (!descriptor) break;
      validateField(descriptor.value, schemas[key], `${path}.${key}`, candidateErrors);
    }
    if (candidateErrors.length === 0) candidates.push(variant);
  }
  if (candidates.length !== 1) {
    issue(errors, candidates.length > 1
      ? "controlled-intent-payload-ambiguous-variant"
      : "controlled-intent-payload-no-variant", path,
    candidates.length > 1
      ? "Controlled intent payload matches more than one schema variant."
      : "Controlled intent payload does not match an allowed schema variant.");
    return null;
  }
  return candidates[0];
}

function validateExactPayload(payload, contract, target, path, errors) {
  let plain = false;
  try {
    plain = isPlainObject(payload);
  } catch {
    issue(errors, "controlled-intent-payload-data-read-failed", path, "Controlled intent payload could not be inspected safely.");
    return null;
  }
  if (!plain) {
    issue(errors, "controlled-intent-payload-invalid", path, "Controlled intent payload must be a plain object.");
    return null;
  }

  const keys = safeOwnKeys(payload, path, errors);
  if (!keys) return null;
  let fieldSchemas = { ...contract.required, ...contract.optional };
  if (contract.variants) {
    const variant = selectPayloadVariant(payload, keys, contract, path, errors);
    if (!variant) return null;
    fieldSchemas = { ...variant.required, ...variant.optional };
  }
  const normalized = {};
  const present = new Set();
  const errorStart = errors.length;

  for (const key of keys) {
    const fieldPath = `${path}.${typeof key === "symbol" ? "[symbol]" : key}`;
    if (typeof key !== "string") {
      issue(errors, "controlled-intent-payload-symbol-key", fieldPath, "Controlled intent payload must not contain symbol keys.");
      continue;
    }
    if (UNSAFE_KEYS.has(key)) {
      issue(errors, "controlled-intent-payload-unsafe-key", fieldPath, "Controlled intent payload must not contain unsafe keys.");
      continue;
    }
    if (!Object.hasOwn(fieldSchemas, key)) {
      issue(errors, "controlled-intent-payload-unexpected-field", fieldPath, "Unexpected controlled intent payload field.");
      continue;
    }
    const descriptor = safeDescriptor(payload, key, fieldPath, errors);
    if (!descriptor) continue;
    present.add(key);
    validateField(descriptor.value, fieldSchemas[key], fieldPath, errors);
    Object.defineProperty(normalized, key, {
      value: descriptor.value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  }

  for (const key of Object.keys(contract.required)) {
    if (!present.has(key)) {
      issue(errors, "controlled-intent-payload-missing-field", `${path}.${key}`, "Required controlled intent payload field is missing.");
    }
  }

  if (errors.length !== errorStart) return null;

  if (contract === VOYAGE_CONTROLLED_EFFECT_INTENT_CONTRACTS[CONTROLLED_INTENTS.STATION_ORDER_CHANGE]
      && target?.kind === TARGETS.STATION
      && (normalized.position === "before" || normalized.position === "after")
      && normalized.anchorStationId === target.targetId) {
    issue(errors, "controlled-intent-payload-anchor-target-conflict", `${path}.anchorStationId`, "Station-order anchor must differ from a static station target.");
    return null;
  }
  return normalized;
}

/**
 * Validates and normalizes a controlled effect intent without applying it.
 */
export function validateVoyageControlledEffectIntent({ intentType, timing, target, payload, path, errors }) {
  if (!isVoyageControlledEffectIntentType(intentType)) return { controlled: false, valid: true, payload: null };
  const contract = Object.hasOwn(VOYAGE_CONTROLLED_EFFECT_INTENT_CONTRACTS, intentType)
    ? VOYAGE_CONTROLLED_EFFECT_INTENT_CONTRACTS[intentType]
    : null;
  if (!contract) {
    issue(errors, "controlled-intent-contract-registry-missing", `${path}.intentType`, "Controlled intent contract is missing from the registry.");
    return { controlled: true, valid: false, payload: null };
  }

  const errorStart = errors.length;
  if (!contract.targetKinds.includes(target?.kind)) {
    issue(errors, "controlled-intent-target-incompatible", `${path}.target.kind`, "Controlled intent target kind is not compatible with this intent.");
  }
  if (!contract.timings.includes(timing)) {
    issue(errors, "controlled-intent-timing-incompatible", `${path}.timing`, "Controlled intent timing is not compatible with this intent.");
  }
  if (!contract.implemented) {
    issue(errors, "controlled-intent-contract-not-implemented", `${path}.intentType`, "Controlled intent contract is not implemented for this milestone task.");
    return { controlled: true, valid: false, payload: null };
  }

  const normalizedPayload = validateExactPayload(payload, contract, target, `${path}.payload`, errors);
  return {
    controlled: true,
    valid: errors.length === errorStart,
    payload: normalizedPayload
  };
}
