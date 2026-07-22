/**
 * PF2e-facing preflight boundary for persisted Voyage pending checks.
 * This module intentionally knows no Foundry or PF2e runtime globals: callers
 * supply the three runtime operations used to locate a document, actor, and
 * statistic. It does not roll, post chat, or persist anything.
 */

const issue = (errors, code, path, message) => errors.push({ code, path, message, severity: "error" });
const nonBlankString = (value) => typeof value === "string" && value.trim().length > 0;
const UNSAFE_PENDING_CHECK_IDS = new Set(["__proto__", "constructor", "prototype"]);
const validPendingCheckId = (value) => nonBlankString(value) && !UNSAFE_PENDING_CHECK_IDS.has(value);

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

function baseResult(captured = {}) {
  const result = {
    ok: false,
    status: "blocked",
    errors: [],
    warnings: []
  };
  if (validPendingCheckId(captured.pendingCheckId)) result.pendingCheckId = captured.pendingCheckId;
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

  for (const key of ["pendingCheckId", "sequence", "status", "mode", "source", "statisticOptions", "dcSource", "secrecy"]) {
    const read = readOwn(value, key, key, errors);
    if (!read.ok) continue;
    if (!read.present) issue(errors, "voyage-pf2e-invalid-request", key, `Pending check requires ${key}.`);
    else captured[key] = read.value;
  }
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

function captureStatisticOptions(value, errors) {
  let array;
  try { array = Array.isArray(value); } catch {
    issue(errors, "voyage-pf2e-invalid-statistic-options", "statisticOptions", "Statistic option array identity could not be inspected safely.");
    return [];
  }
  if (!array) {
    issue(errors, "voyage-pf2e-invalid-statistic-options", "statisticOptions", "Statistic options must be an array.");
    return [];
  }

  let keys;
  try { keys = Reflect.ownKeys(value); } catch {
    issue(errors, "voyage-pf2e-invalid-statistic-options", "statisticOptions", "Statistic option keys could not be inspected safely.");
    return [];
  }

  const indices = [];
  for (const key of keys) {
    if (typeof key !== "string") continue;
    const numeric = Number(key);
    if (!Number.isInteger(numeric) || numeric < 0 || numeric >= 4294967295 || String(numeric) !== key) continue;
    indices.push({ key, numeric });
  }
  indices.sort((left, right) => left.numeric - right.numeric);

  const options = [];
  for (const index of indices) {
    const read = readOwn(value, index.key, `statisticOptions[${index.key}]`, errors, "voyage-pf2e-invalid-statistic-options");
    if (!read.present && read.ok) continue;
    if (!read.ok) continue;
    if (!nonBlankString(read.value)) issue(errors, "voyage-pf2e-invalid-statistic-options", `statisticOptions[${index.key}]`, "Statistic options must be non-blank exact strings.");
    else options.push(read.value);
  }
  if (options.length === 0 && errors.length === 0) issue(errors, "voyage-pf2e-invalid-statistic-options", "statisticOptions", "Statistic options require an own numeric entry.");
  return options;
}

/**
 * Preflights a persisted, normalized pending check. Statistics are looked up
 * with the exact authored slug, in ascending own numeric array-index order.
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
  if (!validPendingCheckId(captured.pendingCheckId)) {
    issue(errors, "voyage-pf2e-invalid-pending-check-id", "pendingCheckId", "Pending check ID must be a safe non-blank exact string.");
    return blocked(captured, errors);
  }
  if (!Number.isSafeInteger(captured.sequence) || captured.sequence < 0) {
    issue(errors, "voyage-pf2e-invalid-request", "sequence", "Pending check sequence must be a non-negative safe integer.");
    return blocked(captured, errors);
  }

  const source = ownPlainObject(captured.source, "source", errors);
  if (!source) return blocked(captured, errors);
  const sourceKind = readOwn(source, "kind", "source.kind", errors);
  if (!sourceKind.present || !sourceKind.ok) issue(errors, "voyage-pf2e-invalid-request", "source.kind", "Source kind is required.");
  else if (sourceKind.value !== "character") issue(errors, "voyage-pf2e-unsupported-source-kind", "source.kind", "Only character sources are supported by PF2e preflight.");
  const uuid = readOwn(source, "uuid", "source.uuid", errors);
  if (!uuid.present || !uuid.ok || !nonBlankString(uuid.value)) issue(errors, "voyage-pf2e-missing-source-uuid", "source.uuid", "Character sources require an own non-blank uuid.");

  const dcSource = ownPlainObject(captured.dcSource, "dcSource", errors);
  let dc;
  if (dcSource) {
    const dcKind = readOwn(dcSource, "kind", "dcSource.kind", errors);
    if (!dcKind.present || !dcKind.ok) issue(errors, "voyage-pf2e-invalid-request", "dcSource.kind", "DC source kind is required.");
    else if (dcKind.value !== "fixed") issue(errors, "voyage-pf2e-unsupported-dc-source", "dcSource.kind", "Only fixed DC sources are supported by PF2e preflight.");
    else {
      const dcValue = readOwn(dcSource, "value", "dcSource.value", errors);
      if (!dcValue.present || !dcValue.ok || !Number.isSafeInteger(dcValue.value) || dcValue.value < 0) issue(errors, "voyage-pf2e-invalid-fixed-dc", "dcSource.value", "Fixed DC requires an own non-negative safe integer value.");
      else dc = dcValue.value;
    }
  }
  const options = captureStatisticOptions(captured.statisticOptions, errors);
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

  let statisticSlug = null;
  let selectedStatistic = null;
  for (const slug of options) {
    let statistic;
    try { statistic = functions.getStatistic(actor, slug); } catch {
      issue(errors, "voyage-pf2e-statistic-resolution-failed", "statisticOptions", `Statistic resolution failed for ${slug}.`);
      return blocked(captured, errors);
    }
    if (statistic) { statisticSlug = slug; selectedStatistic = statistic; break; }
  }
  if (!statisticSlug) {
    issue(errors, "voyage-pf2e-statistic-unresolved", "statisticOptions", "No authored statistic option resolved.");
    return blocked(captured, errors);
  }

  const result = {
    ok: true,
    status: "ready",
    pendingCheckId: captured.pendingCheckId,
    sequence: captured.sequence,
    sourceKind: "character",
    sourceUuid: uuid.value,
    statisticSlug,
    dc,
    rollMode,
    errors: [],
    warnings: []
  };
  return { result, context: { actor, statistic: selectedStatistic } };
}
