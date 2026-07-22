import { VOYAGE_ACTION_EXECUTION_MODES as MODES, VOYAGE_CHECK_SECRECY as SECRECY, VOYAGE_CHECK_SOURCE_KINDS as SOURCES, VOYAGE_DC_SOURCE_KINDS as DCS, VOYAGE_ENCOUNTER_LIFECYCLE_STATES as LIFE, VOYAGE_ROUND_PHASES as PHASES } from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyageEncounterState } from "./validation.js";
import { analyzeVoyageEncounterResolutionOrder, deduplicateVoyageResolutionIssues } from "./resolution-order.js";

const issue = (errors, code, path, message) => errors.push({ code, path, message, severity: "error" });
const own = (v, key) => Object.hasOwn(v, key);
const indices = (a) => Array.isArray(a) ? Array.from({ length: a.length }, (_, i) => i).filter((i) => own(a, i)) : [];
const isNonBlankExactString = (value) => typeof value === "string" && value.trim().length > 0;
const sourceKinds = new Set(Object.values(SOURCES).filter((value) => value !== SOURCES.NO_ROLL));
const dcKinds = new Set(Object.values(DCS));
function readOwnValue(object, key, path, errors) {
  if (!own(object, key)) return { present: false, ok: true, value: undefined };
  try { return { present: true, ok: true, value: object[key] }; }
  catch { issue(errors, "execution-data-read-failed", path, "Execution data could not be read safely."); return { present: true, ok: false, value: undefined }; }
}
function validatePlainData(value, path, errors, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") { if (Number.isFinite(value)) return true; issue(errors, "invalid-execution-plain-data", path, "Execution data numbers must be finite."); return false; }
  if (typeof value !== "object" || ancestors.has(value)) { issue(errors, "invalid-execution-plain-data", path, "Execution data must be recursively plain and acyclic."); return false; }
  if (!Array.isArray(value) && !isPlainObject(value)) { issue(errors, "invalid-execution-plain-data", path, "Execution data must be recursively plain."); return false; }
  ancestors.add(value);
  const keys = Array.isArray(value) ? indices(value) : Object.keys(value);
  for (const key of keys) { const read = readOwnValue(value, key, `${path}[${JSON.stringify(key)}]`, errors); if (read.ok) validatePlainData(read.value, `${path}[${JSON.stringify(key)}]`, errors, ancestors); }
  ancestors.delete(value); return true;
}
function cloneExecutionPlainData(value, path, errors, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    issue(errors, "invalid-execution-plain-data", path, "Execution data numbers must be finite.");
    return null;
  }
  if (typeof value !== "object" || ancestors.has(value)) {
    issue(errors, "invalid-execution-plain-data", path, "Execution data must be recursively plain and acyclic.");
    return null;
  }
  if (!Array.isArray(value) && !isPlainObject(value)) {
    issue(errors, "invalid-execution-plain-data", path, "Execution data must be recursively plain.");
    return null;
  }
  ancestors.add(value);
  if (Array.isArray(value)) {
    const result = [];
    for (const index of indices(value)) {
      const read = readOwnValue(value, index, `${path}[${index}]`, errors);
      if (read.ok) result[index] = cloneExecutionPlainData(read.value, `${path}[${index}]`, errors, ancestors);
    }
    ancestors.delete(value);
    return result;
  }
  const result = {};
  for (const key of Object.keys(value)) {
    const read = readOwnValue(value, key, `${path}.${key}`, errors);
    const cloned = read.ok ? cloneExecutionPlainData(read.value, `${path}.${key}`, errors, ancestors) : null;
    Object.defineProperty(result, key, { value: cloned, enumerable: true, writable: true, configurable: true });
  }
  ancestors.delete(value);
  return result;
}
function checkDefinition(action, path, errors) {
  const checkRead = readOwnValue(action, "check", `${path}.check`, errors);
  if (!checkRead.present || !checkRead.ok) return;
  const check = checkRead.value;
  if (!isPlainObject(check)) { issue(errors, "invalid-action-check", `${path}.check`, "Action check must be a plain object when authored."); return; }
  for (const field of ["source", "statisticOptions", "dcSource", "secrecy"]) if (!own(check, field)) issue(errors, "missing-action-check-field", `${path}.check.${field}`, `Action check requires ${field}.`);
  if (own(check, "source")) {
    if (!isPlainObject(check.source)) issue(errors, "invalid-check-source", `${path}.check.source`, "Check source must be a plain object.");
    else if (!own(check.source, "kind") || !sourceKinds.has(check.source.kind)) issue(errors, "invalid-check-source-kind", `${path}.check.source.kind`, "Check source kind is not recognized.");
  }
  if (own(check, "statisticOptions")) {
    const options = check.statisticOptions;
    if (!Array.isArray(options)) issue(errors, "invalid-check-statistic-options", `${path}.check.statisticOptions`, "statisticOptions must be an array.");
    else {
      const numeric = indices(options); if (!numeric.length) issue(errors, "empty-check-statistic-options", `${path}.check.statisticOptions`, "statisticOptions requires an own numeric entry.");
      const seen = new Set(); for (const i of numeric) { const value = options[i]; if (!isNonBlankExactString(value)) issue(errors, "invalid-check-statistic-option", `${path}.check.statisticOptions[${i}]`, "Statistic option must be a non-blank exact string."); else if (seen.has(value)) issue(errors, "duplicate-check-statistic-option", `${path}.check.statisticOptions[${i}]`, "Statistic options must be unique."); else seen.add(value); }
    }
  }
  if (own(check, "dcSource")) {
    if (!isPlainObject(check.dcSource)) issue(errors, "invalid-check-dc-source", `${path}.check.dcSource`, "DC source must be a plain object.");
    else { if (!own(check.dcSource, "kind") || !dcKinds.has(check.dcSource.kind)) issue(errors, "invalid-check-dc-source-kind", `${path}.check.dcSource.kind`, "DC source kind is not recognized."); if (check.dcSource.kind === DCS.FIXED && (!own(check.dcSource, "value") || !Number.isSafeInteger(check.dcSource.value) || check.dcSource.value < 0)) issue(errors, "invalid-fixed-check-dc", `${path}.check.dcSource.value`, "Fixed DC requires a non-negative safe integer value."); }
  }
  if (own(check, "secrecy") && !Object.values(SECRECY).includes(check.secrecy)) issue(errors, "invalid-check-secrecy", `${path}.check.secrecy`, "Check secrecy must be public or secret.");
  if (own(check, "metadata") && !isPlainObject(check.metadata)) issue(errors, "invalid-check-metadata", `${path}.check.metadata`, "Check metadata must be a plain object.");
  for (const field of ["source", "dcSource", "metadata"]) if (own(check, field)) validatePlainData(check[field], `${path}.check.${field}`, errors);
}
export function validateVoyageEncounterActionExecutionDefinitions(state) {
  try {
    const structural = validateVoyageEncounterState(state); const errors = [...structural.errors], warnings = [...structural.warnings];
    if (structural.valid && Array.isArray(state.availableStations)) for (const si of indices(state.availableStations)) { const station = state.availableStations[si]; if (!isPlainObject(station) || !Array.isArray(station.actions)) continue; for (const ai of indices(station.actions)) { const action = station.actions[ai]; if (isPlainObject(action)) checkDefinition(action, `availableStations[${si}].actions[${ai}]`, errors); } }
    const final = deduplicateVoyageResolutionIssues(errors); return { valid: final.length === 0, errors: final, warnings: deduplicateVoyageResolutionIssues(warnings) };
  } catch {
    const errors = []; issue(errors, "execution-data-read-failed", "$", "Execution data could not be read safely.");
    return { valid: false, errors, warnings: [] };
  }
}
function selectedAction(state, stationId, actionId) {
  const stations = state.availableStations;
  for (let stationIndex = 0; stationIndex < stations.length; stationIndex += 1) {
    if (!own(stations, stationIndex)) continue;
    const station = stations[stationIndex];
    if (!isPlainObject(station) || station.stationId !== stationId || !Array.isArray(station.actions)) continue;
    for (let actionIndex = 0; actionIndex < station.actions.length; actionIndex += 1) {
      if (!own(station.actions, actionIndex)) continue;
      const action = station.actions[actionIndex];
      if (isPlainObject(action) && action.actionId === actionId) return action;
    }
  }
  return null;
}
export function prepareVoyageEncounterActionExecutionRequests(state) {
  let structural = null;
  let active = false;
  let resolution = false;
  try {
  structural = validateVoyageEncounterState(state); active = state?.lifecycleState === LIFE.ACTIVE; resolution = state?.phase === PHASES.RESOLUTION;
  const order = analyzeVoyageEncounterResolutionOrder(state), definitions = validateVoyageEncounterActionExecutionDefinitions(state);
  const errors = [...order.errors, ...definitions.errors], warnings = [...structural.warnings, ...order.warnings, ...definitions.warnings];
  if (structural.valid && !active) issue(errors, "execution-requires-active", "lifecycleState", "Preparing execution requests requires an Active encounter.");
  if (structural.valid && !resolution) issue(errors, "execution-requires-resolution", "phase", "Preparing execution requests requires Resolution phase.");
  const validPlan = structural.valid && active && resolution && order.valid && definitions.valid;
  const requests = [];
  if (validPlan) for (let rowIndex = 0; rowIndex < order.orderedActions.length; rowIndex += 1) {
    const row = order.orderedActions[rowIndex], action = selectedAction(state, row.stationId, row.actionId);
    const targetRead = readOwnValue(state.targets, row.stationId, `targets.${row.stationId}`, errors);
    const target = targetRead.present && targetRead.ok ? cloneExecutionPlainData(targetRead.value, `targets.${row.stationId}`, errors) : null;
    if (errors.length) continue;
    if (!own(action, "check")) { requests.push({ ...row, target, mode: MODES.NO_ROLL, source: { kind: SOURCES.NO_ROLL }, statisticOptions: [], dcSource: null, secrecy: SECRECY.PUBLIC, metadata: {} }); continue; }
    const checkRead = readOwnValue(action, "check", `${row.stationId}.${row.actionId}.check`, errors);
    if (!checkRead.ok) continue;
    const check = checkRead.value;
    requests.push({ ...row, target, mode: MODES.CHECK, source: cloneExecutionPlainData(check.source, "check.source", errors), statisticOptions: indices(check.statisticOptions).map((i) => check.statisticOptions[i]), dcSource: cloneExecutionPlainData(check.dcSource, "check.dcSource", errors), secrecy: check.secrecy, metadata: own(check, "metadata") ? cloneExecutionPlainData(check.metadata, "check.metadata", errors) : {} });
  }
  const final = deduplicateVoyageResolutionIssues(errors), checkCount = requests.filter((r) => r.mode === MODES.CHECK).length;
  const pendingChecksEmpty = structural.valid && Array.isArray(state.pendingChecks) && indices(state.pendingChecks).length === 0;
  return { structurallyValid: structural.valid, active, resolution, pendingChecksEmpty, readyForExecution: validPlan && final.length === 0, pendingCheckPreparationRequired: validPlan && checkCount > 0, readyToPreparePendingChecks: validPlan && checkCount > 0 && pendingChecksEmpty && final.length === 0, actionCount: requests.length, checkCount, noRollActionCount: requests.length - checkCount, executionRequests: requests, errors: final, warnings: deduplicateVoyageResolutionIssues(warnings) };
  } catch {
    const errors = []; issue(errors, "execution-data-read-failed", "$", "Execution data could not be read safely.");
    return { structurallyValid: structural?.valid ?? false, active, resolution, pendingChecksEmpty: false, readyForExecution: false, pendingCheckPreparationRequired: false, readyToPreparePendingChecks: false, actionCount: 0, checkCount: 0, noRollActionCount: 0, executionRequests: [], errors, warnings: structural?.warnings ?? [] };
  }
}
