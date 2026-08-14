import {
  VOYAGE_MOMENTUM_MAX,
  VOYAGE_MOMENTUM_MIN
} from "../domain/constants.js";

/**
 * PF2e-facing preflight boundary for persisted Voyage pending checks.
 * This module intentionally knows no Foundry or PF2e runtime globals: callers
 * supply the three runtime operations used to locate a document, actor, and
 * statistic. It does not roll, post chat, or persist anything.
 */

const issue = (errors, code, path, message) => errors.push({ code, path, message, severity: "error" });
const nonBlankString = (value) => typeof value === "string" && value.trim().length > 0;
const UNSAFE_PENDING_CHECK_IDS = new Set(["__proto__", "constructor", "prototype"]);
const validExactId = (value) => nonBlankString(value) && !UNSAFE_PENDING_CHECK_IDS.has(value);

function plainObject(value, path, errors, code = "voyage-pf2e-invalid-request") {
  if (value === null || typeof value !== "object") return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    issue(errors, code, path, "Value prototype could not be inspected safely.");
    return false;
  }
}

function readOwn(object, key, path, errors, code = "voyage-pf2e-invalid-request") {
  if (object === null || (typeof object !== "object" && typeof object !== "function")) return { present: false, ok: true, value: undefined };
  let present;
  try { present = Object.hasOwn(object, key); } catch {
    issue(errors, code, path, "Value ownness could not be inspected safely.");
    return { present: false, ok: false, value: undefined };
  }
  if (!present) return { present: false, ok: true, value: undefined };
  try {
    return { present: true, ok: true, value: object[key] };
  } catch {
    issue(errors, code, path, "Value could not be read safely.");
    return { present: true, ok: false, value: undefined };
  }
}

function readOwnData(object, key, path, errors, code = "voyage-pf2e-invalid-request") {
  if (object === null || (typeof object !== "object" && typeof object !== "function")) {
    return { present: false, ok: true, value: undefined };
  }
  try {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor) return { present: false, ok: true, value: undefined };
    if (!Object.hasOwn(descriptor, "value")) {
      issue(errors, code, path, "Value must use an own data property.");
      return { present: true, ok: false, value: undefined };
    }
    return { present: true, ok: true, value: descriptor.value };
  } catch {
    issue(errors, code, path, "Value descriptor could not be inspected safely.");
    return { present: false, ok: false, value: undefined };
  }
}

function baseResult(captured = {}) {
  const result = {
    ok: false,
    status: "blocked",
    errors: [],
    warnings: []
  };
  if (validExactId(captured.pendingCheckId)) result.pendingCheckId = captured.pendingCheckId;
  if (Number.isSafeInteger(captured.sequence) && captured.sequence >= 0) result.sequence = captured.sequence;
  return result;
}

function blocked(captured, errors) {
  const result = baseResult(captured);
  result.errors = errors.map((entry) => ({ ...entry }));
  return result;
}

function capturePendingCheck(value) {
  const errors = [];
  const captured = Object.create(null);
  if (!plainObject(value, "pendingCheck", errors)) {
    issue(errors, "voyage-pf2e-invalid-request", "pendingCheck", "Pending check must be a plain object.");
    return { captured, errors };
  }

  let keys;
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    issue(errors, "voyage-pf2e-invalid-request", "pendingCheck", "Pending check keys could not be inspected safely.");
    return { captured, errors };
  }
  for (const key of keys) {
    if (typeof key === "symbol" || UNSAFE_PENDING_CHECK_IDS.has(key)) {
      issue(errors, "voyage-pf2e-invalid-request", typeof key === "symbol" ? "pendingCheck.[symbol]" : `pendingCheck.${key}`, "Pending check contains an unsafe own key.");
    }
  }
  for (const key of ["pendingCheckId", "sequence", "status", "mode", "source", "approachId", "statisticSlugOrAbilityId", "finalDc", "momentumRollBonus", "secrecy"]) {
    const read = readOwnData(value, key, key, errors);
    if (!read.ok) continue;
    if (!read.present) issue(errors, "voyage-pf2e-invalid-request", key, `Pending check requires ${key}.`);
    else captured[key] = read.value;
  }
  const focusModifier = readOwnData(value, "focusModifier", "focusModifier", errors);
  if (focusModifier.present && focusModifier.ok) captured.focusModifier = focusModifier.value;

  return { captured, errors };
}

function captureDependencyFunctions(dependencies, errors) {
  const functions = Object.create(null);
  if (dependencies === null || (typeof dependencies !== "object" && typeof dependencies !== "function")) {
    issue(errors, "voyage-pf2e-invalid-dependencies", "dependencies", "Adapter dependencies must be an object.");
    return functions;
  }
  for (const key of ["resolveUuid", "getActorFromResolvedDocument", "getStatistic"]) {
    const read = readOwn(dependencies, key, `dependencies.${key}`, errors, "voyage-pf2e-invalid-dependencies");
    if (!read.present || !read.ok || typeof read.value !== "function") {
      if (read.ok) issue(errors, "voyage-pf2e-invalid-dependencies", `dependencies.${key}`, `${key} must be an own function.`);
      continue;
    }
    functions[key] = read.value;
  }
  return functions;
}

/** Validates dependency presence without exposing runtime functions. */
export function validateVoyagePf2eAdapterDependencies(dependencies) {
  const errors = [];
  captureDependencyFunctions(dependencies, errors);
  return { valid: errors.length === 0, errors: errors.map((entry) => ({ ...entry })), warnings: [] };
}

function ownPlainObject(value, path, errors) {
  if (!plainObject(value, path, errors)) {
    issue(errors, "voyage-pf2e-invalid-request", path, "Value must be a plain object.");
    return null;
  }
  return value;
}

/**
 * Preflights a persisted, normalized pending check. Exactly one statistic is
 * looked up with the exact committed statistic or ability identity.
 */
export async function resolveVoyagePf2ePendingCheckContext(pendingCheck, dependencies) {
  const { captured, errors } = capturePendingCheck(pendingCheck);
  const functions = captureDependencyFunctions(dependencies, errors);
  if (errors.length) return blocked(captured, errors);

  if (captured.status !== "pending") {
    issue(errors, "voyage-pf2e-check-not-pending", "status", "Only pending checks can be preflighted.");
    return blocked(captured, errors);
  }
  if (captured.mode !== "check") {
    issue(errors, "voyage-pf2e-invalid-check-mode", "mode", "Pending check mode must be check.");
    return blocked(captured, errors);
  }
  if (!validExactId(captured.pendingCheckId)) {
    issue(errors, "voyage-pf2e-invalid-pending-check-id", "pendingCheckId", "Pending check ID must be a safe non-blank exact string.");
    return blocked(captured, errors);
  }
  if (!Number.isSafeInteger(captured.sequence) || captured.sequence < 0) {
    issue(errors, "voyage-pf2e-invalid-request", "sequence", "Pending check sequence must be a non-negative safe integer.");
    return blocked(captured, errors);
  }

  const source = ownPlainObject(captured.source, "source", errors);
  if (!source) return blocked(captured, errors);
  const sourceKind = readOwnData(source, "kind", "source.kind", errors);
  if (!sourceKind.present || !sourceKind.ok) issue(errors, "voyage-pf2e-invalid-request", "source.kind", "Source kind is required.");
  else if (sourceKind.value !== "character") issue(errors, "voyage-pf2e-unsupported-source-kind", "source.kind", "Only character sources are supported by PF2e preflight.");
  const uuid = readOwnData(source, "uuid", "source.uuid", errors);
  if (!uuid.present || !uuid.ok || !nonBlankString(uuid.value)) issue(errors, "voyage-pf2e-missing-source-uuid", "source.uuid", "Character sources require an own non-blank uuid.");

  if (!validExactId(captured.approachId)) {
    issue(errors, "voyage-pf2e-invalid-approach-id", "approachId", "Approach ID must be a safe non-blank exact string.");
  }
  if (!validExactId(captured.statisticSlugOrAbilityId)) {
    issue(errors, "voyage-pf2e-invalid-statistic-id", "statisticSlugOrAbilityId", "Statistic or ability identity must be a safe non-blank exact string.");
  }
  if (!Number.isSafeInteger(captured.finalDc) || captured.finalDc < 0) {
    issue(errors, "voyage-pf2e-invalid-final-dc", "finalDc", "Final DC must be a non-negative safe integer.");
  }
  if (
    !Number.isSafeInteger(captured.momentumRollBonus)
    || captured.momentumRollBonus < VOYAGE_MOMENTUM_MIN
    || captured.momentumRollBonus > VOYAGE_MOMENTUM_MAX
  ) {
    issue(
      errors,
      "voyage-pf2e-invalid-momentum-roll-bonus",
      "momentumRollBonus",
      "Momentum roll bonus must be a safe integer from 0 through 3."
    );
  }
  if (captured.focusModifier !== undefined && (!Number.isSafeInteger(captured.focusModifier) || captured.focusModifier < -5 || captured.focusModifier > 5)) {
    issue(errors, "voyage-pf2e-invalid-focus-modifier", "focusModifier", "Focus modifier must be a safe integer from -5 through 5.");
  }

  let rollMode;
  if (captured.secrecy === "public") rollMode = "public";
  else if (captured.secrecy === "secret") rollMode = "blind";
  else issue(errors, "voyage-pf2e-invalid-secrecy", "secrecy", "Secrecy must be public or secret.");
  if (errors.length) return blocked(captured, errors);

  let document;
  try { document = await functions.resolveUuid(uuid.value); } catch {
    issue(errors, "voyage-pf2e-source-resolution-failed", "source.uuid", "Character source UUID resolution failed.");
    return blocked(captured, errors);
  }
  if (!document) {
    issue(errors, "voyage-pf2e-source-unresolved", "source.uuid", "Character source UUID did not resolve.");
    return blocked(captured, errors);
  }
  let actor;
  try { actor = functions.getActorFromResolvedDocument(document); } catch {
    issue(errors, "voyage-pf2e-source-resolution-failed", "source.uuid", "Actor extraction from the resolved source failed.");
    return blocked(captured, errors);
  }
  if (!actor) {
    issue(errors, "voyage-pf2e-actor-unresolved", "source.uuid", "Resolved source did not provide an actor.");
    return blocked(captured, errors);
  }

  let selectedStatistic;
  try {
    selectedStatistic = functions.getStatistic(actor, captured.statisticSlugOrAbilityId);
  } catch {
    issue(errors, "voyage-pf2e-statistic-resolution-failed", "statisticSlugOrAbilityId", `Statistic resolution failed for ${captured.statisticSlugOrAbilityId}.`);
    return blocked(captured, errors);
  }
  if (
    selectedStatistic === null
    || (typeof selectedStatistic !== "object" && typeof selectedStatistic !== "function")
  ) {
    issue(errors, "voyage-pf2e-statistic-unresolved", "statisticSlugOrAbilityId", "The exact committed statistic or ability identity did not resolve.");
    return blocked(captured, errors);
  }
  let resolvedSlug;
  try {
    resolvedSlug = selectedStatistic.slug;
  } catch {
    issue(errors, "voyage-pf2e-statistic-resolution-failed", "statistic.slug", "Resolved statistic identity could not be read safely.");
    return blocked(captured, errors);
  }
  if (
    resolvedSlug !== undefined
    && resolvedSlug !== captured.statisticSlugOrAbilityId
  ) {
    issue(errors, "voyage-pf2e-statistic-identity-mismatch", "statistic.slug", "Resolved statistic identity contradicts the committed statistic identity.");
    return blocked(captured, errors);
  }

  const result = {
    ok: true,
    status: "ready",
    pendingCheckId: captured.pendingCheckId,
    sequence: captured.sequence,
    sourceKind: "character",
    sourceUuid: uuid.value,
    statisticSlug: captured.statisticSlugOrAbilityId,
    dc: captured.finalDc,
    rollMode,
    errors: [],
    warnings: []
  };
  const context = {
    result,
    context: {
      actor,
      statistic: selectedStatistic,
      dc: captured.finalDc,
      momentumRollBonus: captured.momentumRollBonus
    }
  };
  if (captured.focusModifier !== undefined) context.context.focusModifier = captured.focusModifier;
  return context;
}
