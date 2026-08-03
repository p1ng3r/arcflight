import { CORE_HULLS, CORE_HULL_PLATFORM_KEYS } from "../../../data/hulls/core-hulls.js";
import {
  captureVoyageVoidScarPlainData,
  validateVoyageVoidScarRecord
} from "./void-scar-schema.js";

const SHIP_STATE_FIELDS = Object.freeze(["shipId", "revision", "installed", "hull", "voidScars"]);
const INSTALLED_FIELDS = Object.freeze(["hullPlatform"]);
const HULL_FIELDS = Object.freeze(["voidScarCapacity"]);
const HULL_PLATFORM_SET = new Set(CORE_HULL_PLATFORM_KEYS);

export const VOYAGE_SHIP_STATE_FIELDS = SHIP_STATE_FIELDS;
export const VOYAGE_SHIP_INSTALLED_FIELDS = INSTALLED_FIELDS;
export const VOYAGE_SHIP_HULL_FIELDS = HULL_FIELDS;

export const VOYAGE_HULL_VOID_SCAR_CAPACITY_BY_PLATFORM = Object.freeze(
  Object.fromEntries(CORE_HULL_PLATFORM_KEYS.map((platform) => [platform, CORE_HULLS[platform].voidScarCapacity]))
);
export const VOYAGE_HULL_VOID_SCAR_CAPACITIES = VOYAGE_HULL_VOID_SCAR_CAPACITY_BY_PLATFORM;

function issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function pathFor(path, key) {
  return `${path}.${key}`;
}

function isNonBlankString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function exactKeys(value, fields, path, errors, code) {
  const keys = Object.keys(value);
  const expected = new Set(fields);
  for (const key of keys) {
    if (!expected.has(key)) errors.push(issue(code, pathFor(path, key), "Ship state contains an unexpected field."));
  }
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) errors.push(issue("missing-ship-state-field", pathFor(path, field), `Ship state requires ${field}.`));
  }
  if (keys.length === fields.length && keys.some((key, index) => key !== fields[index])) {
    errors.push(issue("invalid-ship-state-key-order", path, "Ship state fields must use the canonical order."));
  }
}

function validateString(value, path, errors, code) {
  if (!isNonBlankString(value)) errors.push(issue(code, path, "Value must be a non-blank exact string."));
}

function validateSafeInteger(value, path, errors, code, positive = false) {
  if (!Number.isSafeInteger(value) || (positive ? value <= 0 : value < 0)) {
    errors.push(issue(code, path, positive ? "Value must be a positive safe integer." : "Value must be a non-negative safe integer."));
  }
}

function captureState(state) {
  return captureVoyageVoidScarPlainData(state, "$");
}

function validateStateValues(state, errors) {
  if (state === null || typeof state === "undefined") {
    errors.push(issue("invalid-ship-state", "$", "Ship state must be a plain object."));
    return;
  }
  exactKeys(state, SHIP_STATE_FIELDS, "$", errors, "unexpected-ship-state-field");
  validateString(state.shipId, "$.shipId", errors, "invalid-ship-id");
  validateSafeInteger(state.revision, "$.revision", errors, "invalid-ship-revision");

  if (state.installed === null || typeof state.installed !== "object" || Array.isArray(state.installed)) {
    errors.push(issue("invalid-ship-installed", "$.installed", "installed must be a plain object."));
  } else {
    exactKeys(state.installed, INSTALLED_FIELDS, "$.installed", errors, "unexpected-ship-installed-field");
    validateString(state.installed.hullPlatform, "$.installed.hullPlatform", errors, "invalid-hull-platform");
  }

  if (state.hull === null || typeof state.hull !== "object" || Array.isArray(state.hull)) {
    errors.push(issue("invalid-ship-hull", "$.hull", "hull must be a plain object."));
  } else {
    exactKeys(state.hull, HULL_FIELDS, "$.hull", errors, "unexpected-ship-hull-field");
    validateSafeInteger(state.hull.voidScarCapacity, "$.hull.voidScarCapacity", errors, "invalid-void-scar-capacity", true);
  }

  if (!Array.isArray(state.voidScars)) {
    errors.push(issue("invalid-ship-void-scars", "$.voidScars", "voidScars must be a dense array."));
  } else {
    const ids = new Set();
    for (let index = 0; index < state.voidScars.length; index += 1) {
      const scar = state.voidScars[index];
      if (scar === null || typeof scar === "undefined") {
        errors.push(issue("invalid-ship-void-scar", `$.voidScars[${index}]`, "Each active Void Scar must be a plain object."));
        continue;
      }
      const validation = validateVoyageVoidScarRecord(scar);
      for (const error of validation.errors) errors.push({ ...error, path: `$.voidScars[${index}]${error.path === "$" ? "" : error.path.slice(1)}` });
      if (validation.valid && ids.has(scar.voidScarId)) errors.push(issue("duplicate-void-scar-id", `$.voidScars[${index}].voidScarId`, "voidScarId values must be unique within ship state."));
      if (validation.valid) ids.add(scar.voidScarId);
    }

    if (state.hull && Number.isSafeInteger(state.hull.voidScarCapacity) && state.voidScars.length > state.hull.voidScarCapacity) {
      errors.push(issue("void-scar-capacity-exceeded", "$.voidScars", "Active Void Scar count must not exceed hull capacity."));
    }
  }

  if (state.installed && HULL_PLATFORM_SET.has(state.installed.hullPlatform)) {
    const authoredCapacity = VOYAGE_HULL_VOID_SCAR_CAPACITY_BY_PLATFORM[state.installed.hullPlatform];
    if (state.hull && state.hull.voidScarCapacity !== authoredCapacity) {
      errors.push(issue("void-scar-capacity-mismatch", "$.hull.voidScarCapacity", "voidScarCapacity must match the installed hull platform."));
    }
  } else if (state.installed && isNonBlankString(state.installed.hullPlatform)) {
    errors.push(issue("unknown-hull-platform", "$.installed.hullPlatform", "Hull platform is not a canonical authored platform."));
  }
}

export function validateVoyageShipState(state) {
  const captured = captureState(state);
  const errors = [...captured.errors];
  if (errors.length === 0) validateStateValues(captured.value, errors);
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function captureVoyageShipState(state) {
  const captured = captureState(state);
  const errors = [...captured.errors];
  if (errors.length === 0) validateStateValues(captured.value, errors);
  return {
    ok: errors.length === 0,
    state: errors.length === 0 ? captured.value : null,
    errors,
    warnings: []
  };
}

export function getVoyageHullVoidScarCapacity(platform) {
  return HULL_PLATFORM_SET.has(platform) ? VOYAGE_HULL_VOID_SCAR_CAPACITY_BY_PLATFORM[platform] : null;
}
