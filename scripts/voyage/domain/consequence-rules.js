import { VOYAGE_ACTION_OUTCOME_BRANCHES as BRANCHES, VOYAGE_EFFECT_INTENT_TYPES as INTENTS, VOYAGE_EFFECT_INTENT_TIMING as TIMINGS, VOYAGE_EFFECT_INTENT_VISIBILITY as VISIBILITIES, VOYAGE_EFFECT_TARGET_KINDS as TARGETS, VOYAGE_ENCOUNTER_LIFECYCLE_STATES as LIFE, VOYAGE_ROUND_PHASES as PHASES } from "./constants.js";
import { isPlainObject } from "./defaults.js";
import { validateVoyageEncounterState } from "./validation.js";
import { validateVoyageEncounterActionExecutionDefinitions } from "./resolution-execution-requests.js";
import { analyzeAuthoredVoyageRiskBidOptions } from "./risk-bids.js";

const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);
const CHECK_BRANCHES = [BRANCHES.CRITICAL_FAILURE, BRANCHES.FAILURE, BRANCHES.SUCCESS, BRANCHES.CRITICAL_SUCCESS];
const ID_TARGETS = new Set([TARGETS.TRACK, TARGETS.PARTICIPANT, TARGETS.STATION]);
const issue = (list, code, path, message, severity = "error") => list.push({ code, path, message, severity });
const safeId = (value) => typeof value === "string" && value.trim().length > 0 && !UNSAFE.has(value);
const numericIndices = (value) => Array.isArray(value) ? Array.from({ length: value.length }, (_, index) => index).filter((index) => Object.hasOwn(value, index)) : [];
function deduplicateIssues(issues) { const seen = new Set(); return issues.filter((entry) => { const key = `${entry.code}\0${entry.path}\0${entry.message}\0${entry.severity}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
function readOwnDataProperty(object, key, path, errors) {
  if (!object || (typeof object !== "object" && typeof object !== "function") || !Object.hasOwn(object, key)) return { present: false, ok: true, value: undefined };
  let descriptor; try { descriptor = Object.getOwnPropertyDescriptor(object, key); } catch { issue(errors, "outcome-data-read-failed", path, "Outcome data could not be read safely."); return { present: true, ok: false }; }
  if (!descriptor || !("value" in descriptor)) { issue(errors, "outcome-data-read-failed", path, "Outcome data must use data properties."); return { present: true, ok: false }; }
  return { present: true, ok: true, value: descriptor.value };
}
function exactPlainObject(value, fields, path, errors, invalidCode, unexpectedCode) {
  if (!isPlainObject(value)) { issue(errors, invalidCode, path, "Authored data must be a plain object."); return null; }
  const values = {};
  for (const key of Reflect.ownKeys(value)) {
    const display = typeof key === "symbol" ? "[symbol]" : `.${key}`;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || !fields.includes(key)) issue(errors, unexpectedCode, `${path}${display}`, "Unexpected authored field.");
    else if (!descriptor || !("value" in descriptor)) issue(errors, "outcome-data-read-failed", `${path}.${key}`, "Outcome data must use data properties.");
    else values[key] = descriptor.value;
  }
  for (const field of fields) if (!Object.hasOwn(values, field)) issue(errors, invalidCode, `${path}.${field}`, "Required authored field is missing.");
  return values;
}
function captureSafePlainData(value, path, errors, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return { ok: true, value };
  if (typeof value === "number") { if (Number.isFinite(value)) return { ok: true, value }; issue(errors, "invalid-effect-payload", path, "Effect payload must contain finite plain data."); return { ok: false }; }
  if (typeof value !== "object" || ancestors.has(value) || (!Array.isArray(value) && !isPlainObject(value))) { issue(errors, "invalid-effect-payload", path, "Effect payload must be recursively plain and acyclic."); return { ok: false }; }
  ancestors.add(value); const array = Array.isArray(value); const result = array ? new Array(value.length) : {};
  let ok = true;
  for (const key of array ? numericIndices(value) : Reflect.ownKeys(value)) {
    const childPath = array ? `${path}[${key}]` : `${path}.${typeof key === "symbol" ? "[symbol]" : key}`;
    if (typeof key === "symbol") { issue(errors, "invalid-effect-payload", childPath, "Effect payload must not contain symbol keys."); ok = false; continue; }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) { issue(errors, "invalid-effect-payload", childPath, "Effect payload properties must be data properties."); ok = false; continue; }
    const child = captureSafePlainData(descriptor.value, childPath, errors, ancestors); if (!child.ok) { ok = false; continue; }
    Object.defineProperty(result, key, { value: child.value, enumerable: true, configurable: true, writable: true });
  }
  ancestors.delete(value); return { ok, value: result };
}
function validateReferenceList(value, path, errors, references) {
  if (!Array.isArray(value)) { issue(errors, "invalid-effect-reference-list", path, "Effect references must be an array."); return []; }
  const result = new Array(value.length); const seen = new Set();
  for (const index of numericIndices(value)) {
    const read = readOwnDataProperty(value, index, `${path}[${index}]`, errors); if (!read.ok) continue;
    if (typeof read.value !== "string" || !read.value.trim()) issue(errors, "invalid-effect-reference", `${path}[${index}]`, "Effect reference must be a non-blank exact string.");
    else if (UNSAFE.has(read.value)) issue(errors, "unsafe-effect-reference", `${path}[${index}]`, "Effect reference must be safe.");
    else if (seen.has(read.value)) issue(errors, "duplicate-effect-reference", `${path}[${index}]`, "Effect references must be unique within a list.");
    else { seen.add(read.value); result[index] = read.value; references.push({ effectId: read.value, path: `${path}[${index}]` }); }
  }
  return result;
}
function analyzeTarget(value, path, errors) {
  if (!isPlainObject(value)) { issue(errors, "invalid-effect-target", path, "Effect target must be a plain object."); return null; }
  const kindDescriptor = Object.getOwnPropertyDescriptor(value, "kind");
  const kind = kindDescriptor && "value" in kindDescriptor ? kindDescriptor.value : undefined;
  const known = Object.values(TARGETS).includes(kind);
  const idBearing = known && ID_TARGETS.has(kind);
  if (known && !idBearing && Object.hasOwn(value, "targetId")) {
    issue(errors, "unexpected-effect-target-id", `${path}.targetId`, "Target ID is not allowed for this target kind.");
  }
  const target = exactPlainObject(value, idBearing ? ["kind", "targetId"] : ["kind"], path, errors, "invalid-effect-target", "unexpected-effect-target-field");
  if (!target) return null;
  if (!known) { issue(errors, "invalid-effect-target-kind", `${path}.kind`, "Effect target kind is not recognized."); return null; }
  if (idBearing && !Object.hasOwn(target, "targetId")) issue(errors, "missing-effect-target-id", `${path}.targetId`, "Target requires targetId.");
  if (idBearing && Object.hasOwn(target, "targetId") && !safeId(target.targetId)) issue(errors, "invalid-effect-target-id", `${path}.targetId`, "Target ID must be a non-blank safe exact string.");
  const result = { kind }; if (idBearing && safeId(target.targetId)) result.targetId = target.targetId; return result;
}
function analyzeEffectRule(value, path, errors, effectIds, effectPaths) {
  const rule = exactPlainObject(value, ["effectId", "intentType", "timing", "visibility", "target", "payload"], path, errors, "invalid-effect-rule", "unexpected-effect-rule-field");
  if (!rule) return null;
  if (typeof rule.effectId !== "string" || !rule.effectId.trim()) issue(errors, "invalid-effect-id", `${path}.effectId`, "effectId must be a non-blank exact string.");
  else if (UNSAFE.has(rule.effectId)) issue(errors, "unsafe-effect-id", `${path}.effectId`, "effectId must be safe.");
  else if (effectIds.has(rule.effectId)) issue(errors, "duplicate-effect-id", `${path}.effectId`, "effectId must be unique within an action.");
  else { effectIds.add(rule.effectId); effectPaths.set(rule.effectId, `${path}.effectId`); }
  if (!Object.values(INTENTS).includes(rule.intentType)) issue(errors, "invalid-effect-intent-type", `${path}.intentType`, "Effect intent type is not recognized.");
  if (!Object.values(TIMINGS).includes(rule.timing)) issue(errors, "invalid-effect-intent-timing", `${path}.timing`, "Effect timing is not recognized.");
  if (!Object.values(VISIBILITIES).includes(rule.visibility)) issue(errors, "invalid-effect-intent-visibility", `${path}.visibility`, "Effect visibility is not recognized.");
  const target = analyzeTarget(rule.target, `${path}.target`, errors); const payload = captureSafePlainData(rule.payload, `${path}.payload`, errors);
  return { effectId: rule.effectId, intentType: rule.intentType, timing: rule.timing, visibility: rule.visibility, target, payload: payload.value };
}
function analyzeRiskBidOptions(action, path, mode, errors, references) {
  const analysis = analyzeAuthoredVoyageRiskBidOptions(action, `${path}.riskBidOptions`, errors);
  if (!analysis) return [];
  references.push(...analysis.referenceRecords);
  for (const option of analysis.options) {
    if (option && mode === "no-roll" && (option.rewardEffectIds.some(Boolean) || option.dangerEffectIds.some(Boolean))) {
      issue(errors, "no-roll-risk-bid-result-reference", path, "No-roll actions cannot reference result effects.");
    }
  }
  return analysis.options;
}
function analyzeAction(action, stationId, stationIndex, actionIndex, errors, warnings) {
  const actionPath = `availableStations[${stationIndex}].actions[${actionIndex}]`; const check = readOwnDataProperty(action, "check", `${actionPath}.check`, errors); const mode = check.present ? "check" : "no-roll";
  const result = { stationId, actionId: readOwnDataProperty(action, "actionId", `${actionPath}.actionId`, errors).value, mode, effectRules: [], branches: Object.fromEntries((mode === "check" ? CHECK_BRANCHES : [BRANCHES.NO_ROLL]).map((key) => [key, []])), riskBidOptions: [] };
  const references = []; const effectIds = new Set(); const effectPaths = new Map(); const outcome = readOwnDataProperty(action, "outcomeDefinition", `${actionPath}.outcomeDefinition`, errors);
  if (outcome.present && outcome.ok) {
    const definition = exactPlainObject(outcome.value, ["effectRules", "branches"], `${actionPath}.outcomeDefinition`, errors, "invalid-action-outcome-definition", "unexpected-action-outcome-field");
    if (definition) {
      if (!Array.isArray(definition.effectRules)) issue(errors, "invalid-action-effect-rules", `${actionPath}.outcomeDefinition.effectRules`, "effectRules must be an array."); else for (const index of numericIndices(definition.effectRules)) { const rule = analyzeEffectRule(readOwnDataProperty(definition.effectRules, index, `${actionPath}.outcomeDefinition.effectRules[${index}]`, errors).value, `${actionPath}.outcomeDefinition.effectRules[${index}]`, errors, effectIds, effectPaths); if (rule) result.effectRules[index] = rule; }
      const expected = mode === "check" ? CHECK_BRANCHES : [BRANCHES.NO_ROLL];
      if (!isPlainObject(definition.branches)) issue(errors, "invalid-action-outcome-branches", `${actionPath}.outcomeDefinition.branches`, "branches must be a plain object."); else { const branchValues = exactPlainObject(definition.branches, expected, `${actionPath}.outcomeDefinition.branches`, errors, "invalid-action-outcome-branch-set", "invalid-action-outcome-branch-set"); if (branchValues) for (const key of expected) result.branches[key] = validateReferenceList(branchValues[key], `${actionPath}.outcomeDefinition.branches.${key}`, errors, references); }
    }
  }
  result.riskBidOptions = analyzeRiskBidOptions(action, actionPath, mode, errors, references);
  const referenced = new Set(); for (const reference of references) { referenced.add(reference.effectId); if (!effectIds.has(reference.effectId)) issue(errors, "missing-effect-reference", reference.path, "Effect reference must resolve to an action-local effect rule."); }
  for (const [effectId, effectPath] of effectPaths) if (!referenced.has(effectId)) issue(warnings, "unreferenced-effect-rule", effectPath, "Effect rule is not referenced by a branch or Risk Bid option.", "warning");
  return { actionPath, result };
}
export function analyzeVoyageEncounterActionOutcomeDefinitions(state) {
  try {
    const structural = validateVoyageEncounterState(state); const execution = validateVoyageEncounterActionExecutionDefinitions(state); const errors = [...structural.errors, ...execution.errors]; const warnings = [...structural.warnings, ...execution.warnings]; const analyses = [];
    if (structural.valid && Array.isArray(state.availableStations)) for (const stationIndex of numericIndices(state.availableStations)) { const station = state.availableStations[stationIndex]; if (!isPlainObject(station) || !Array.isArray(station.actions)) continue; for (const actionIndex of numericIndices(station.actions)) { const action = station.actions[actionIndex]; if (isPlainObject(action)) analyses.push(analyzeAction(action, station.stationId, stationIndex, actionIndex, errors, warnings)); } }
    const finalErrors = deduplicateIssues(errors); const invalid = analyses.filter(({ actionPath }) => finalErrors.some((entry) => entry.path === actionPath || entry.path.startsWith(`${actionPath}.`) || entry.path.startsWith(`${actionPath}[`))).length; const actions = analyses.map(({ result }) => result); const definitionsValid = structural.valid && finalErrors.length === 0;
    return { structurallyValid: structural.valid, definitionsValid, active: state?.lifecycleState === LIFE.ACTIVE, consequences: state?.phase === PHASES.CONSEQUENCES, readyForInterpretation: definitionsValid && state?.lifecycleState === LIFE.ACTIVE && state?.phase === PHASES.CONSEQUENCES, actionCount: actions.length, validActionCount: actions.length - invalid, invalidActionCount: invalid, checkActionCount: actions.filter((action) => action.mode === "check").length, noRollActionCount: actions.filter((action) => action.mode === "no-roll").length, effectRuleCount: actions.reduce((count, action) => count + numericIndices(action.effectRules).length, 0), actions, errors: finalErrors, warnings: deduplicateIssues(warnings) };
  } catch { return { structurallyValid: false, definitionsValid: false, active: false, consequences: false, readyForInterpretation: false, actionCount: 0, validActionCount: 0, invalidActionCount: 0, checkActionCount: 0, noRollActionCount: 0, effectRuleCount: 0, actions: [], errors: [{ code: "outcome-data-read-failed", path: "$", message: "Outcome data could not be read safely.", severity: "error" }], warnings: [] }; }
}
export function validateVoyageEncounterActionOutcomeDefinitions(state) { const report = analyzeVoyageEncounterActionOutcomeDefinitions(state); return { valid: report.structurallyValid && report.definitionsValid, errors: [...report.errors], warnings: [...report.warnings] }; }
