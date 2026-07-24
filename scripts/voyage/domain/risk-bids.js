import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES, VOYAGE_ROUND_PHASES } from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyageEncounterStationSelections } from "./station-selection.js";
import { validateVoyageEncounterState } from "./validation.js";

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const issue = (errors, code, path, message) => errors.push({ code, path, message, severity: "error" });
const hasId = (value) => typeof value === "string" && value.trim().length > 0;
const safeKey = (value) => !UNSAFE_KEYS.has(value);
function deduplicateIssues(issues) {
  const seen = new Set();
  return issues.filter((entry) => {
    const identity = `${entry.code}\u0000${entry.path}\u0000${entry.message}\u0000${entry.severity}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}
const failure = (errors, warnings) => ({ ok: false, nextState: null, events: [], errors: deduplicateIssues(errors), warnings: deduplicateIssues(warnings) });
function stations(state, id) {
  const found = [];
  for (let index = 0; index < state.availableStations.length; index += 1) {
    if (!Object.hasOwn(state.availableStations, index)) continue;
    const station = state.availableStations[index];
    if (isPlainObject(station) && station.stationId === id) found.push({ station, index });
  }
  return found;
}
function actions(station, id) {
  const found = [];
  for (let index = 0; index < station.actions.length; index += 1) {
    if (!Object.hasOwn(station.actions, index)) continue;
    const action = station.actions[index];
    if (isPlainObject(action) && action.actionId === id) found.push({ action, index });
  }
  return found;
}
export function analyzeAuthoredVoyageRiskBidOptions(action, path, errors) {
  if (!Object.hasOwn(action, "riskBidOptions")) return { options: [], referenceRecords: [] };
  const optionsDescriptor = Object.getOwnPropertyDescriptor(action, "riskBidOptions");
  if (!optionsDescriptor || !("value" in optionsDescriptor)) {
    issue(errors, "outcome-data-read-failed", path, "Risk Bid data could not be read safely.");
    return null;
  }
  const source = optionsDescriptor.value;
  if (!Array.isArray(source)) { issue(errors, "invalid-risk-bid-options", path, "Authored Risk Bid options must be an array when supplied."); return null; }
  const ids = new Set(); const options = new Array(source.length); const referenceRecords = [];
  for (let index = 0; index < source.length; index += 1) {
    if (!Object.hasOwn(source, index)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(source, index);
    if (!descriptor || !("value" in descriptor)) { issue(errors, "outcome-data-read-failed", `${path}[${index}]`, "Risk Bid data could not be read safely."); continue; }
    const option = descriptor.value;
    if (!isPlainObject(option)) { issue(errors, "invalid-risk-bid-option", `${path}[${index}]`, "Authored Risk Bid option must be a plain object."); continue; }
    const idDescriptor = Object.getOwnPropertyDescriptor(option, "riskBidId"); const riskBidId = idDescriptor && "value" in idDescriptor ? idDescriptor.value : undefined;
    if (!idDescriptor || !("value" in idDescriptor) || !hasId(riskBidId)) { issue(errors, "invalid-risk-bid-id", `${path}[${index}].riskBidId`, "Authored Risk Bid option requires a non-empty riskBidId."); continue; }
    if (!safeKey(riskBidId)) issue(errors, "unsafe-risk-bid-key", `${path}[${index}].riskBidId`, "Authored Risk Bid option requires a safe riskBidId.");
    if (ids.has(riskBidId)) issue(errors, "duplicate-risk-bid-id", `${path}[${index}].riskBidId`, "Authored Risk Bid option riskBidId must be unique within an action.");
    ids.add(riskBidId);
    const normalized = { riskBidId, rewardEffectIds: [], dangerEffectIds: [] };
    options[index] = normalized;
    for (const field of ["rewardEffectIds", "dangerEffectIds"]) {
      if (!Object.hasOwn(option, field)) continue;
      const listDescriptor = Object.getOwnPropertyDescriptor(option, field);
      if (!listDescriptor || !("value" in listDescriptor)) { issue(errors, "outcome-data-read-failed", `${path}[${index}].${field}`, "Risk Bid data could not be read safely."); continue; }
      const referenceList = listDescriptor.value;
      if (!Array.isArray(referenceList)) { issue(errors, field === "rewardEffectIds" ? "invalid-risk-bid-reward-effect-ids" : "invalid-risk-bid-danger-effect-ids", `${path}[${index}].${field}`, `${field} must be an array when supplied.`); continue; }
      const references = new Set();
      for (let referenceIndex = 0; referenceIndex < referenceList.length; referenceIndex += 1) {
        if (!Object.hasOwn(referenceList, referenceIndex)) continue;
        const referenceDescriptor = Object.getOwnPropertyDescriptor(referenceList, referenceIndex);
        if (!referenceDescriptor || !("value" in referenceDescriptor)) { issue(errors, "outcome-data-read-failed", `${path}[${index}].${field}[${referenceIndex}]`, "Risk Bid data could not be read safely."); continue; }
        const reference = referenceDescriptor.value;
        if (!hasId(reference) || !safeKey(reference)) issue(errors, "invalid-effect-reference", `${path}[${index}].${field}[${referenceIndex}]`, "Risk Bid effect references must be non-empty safe strings.");
        else if (references.has(reference)) issue(errors, "duplicate-effect-reference", `${path}[${index}].${field}[${referenceIndex}]`, "Risk Bid effect references must be unique within a list.");
        references.add(reference);
        normalized[field][referenceIndex] = reference;
        referenceRecords.push({ effectId: reference, path: `${path}[${index}].${field}[${referenceIndex}]` });
      }
    }
  }
  return { options, referenceRecords };
}
function options(action, path, errors) { return analyzeAuthoredVoyageRiskBidOptions(action, path, errors); }
function validateAuthoredOptions(state, errors) {
  const collections = new Map();
  for (let stationIndex = 0; stationIndex < state.availableStations.length; stationIndex += 1) {
    if (!Object.hasOwn(state.availableStations, stationIndex)) continue;
    const station = state.availableStations[stationIndex];
    if (!isPlainObject(station) || !Array.isArray(station.actions)) continue;
    for (let actionIndex = 0; actionIndex < station.actions.length; actionIndex += 1) {
      if (!Object.hasOwn(station.actions, actionIndex)) continue;
      const action = station.actions[actionIndex];
      if (isPlainObject(action)) collections.set(action, options(action, `availableStations[${stationIndex}].actions[${actionIndex}].riskBidOptions`, errors));
    }
  }
  return collections;
}
function resolve(state, stationId, actionId, riskBidId, errors, path, authoredOptions = null) {
  const stationMatches = stations(state, stationId);
  if (stationMatches.length !== 1) { issue(errors, stationMatches.length ? "risk-bid-station-ambiguous" : "risk-bid-station-not-available", `${path}.stationId`, "Risk Bid station must match exactly one available station."); return null; }
  const { station, index } = stationMatches[0];
  if (!Array.isArray(station.actions)) { issue(errors, "invalid-available-station-actions", `availableStations[${index}].actions`, "Available Voyage station actions must be an array."); return null; }
  const actionMatches = actions(station, actionId);
  if (actionMatches.length !== 1) { issue(errors, actionMatches.length ? "risk-bid-action-ambiguous" : "risk-bid-action-not-available", `${path}.actionId`, "Risk Bid action must match exactly one authored action."); return null; }
  const { action, index: actionIndex } = actionMatches[0];
  const optionList = authoredOptions?.get(action) ?? options(action, `availableStations[${index}].actions[${actionIndex}].riskBidOptions`, errors);
  if (!optionList) return null;
  const matches = optionList.options.filter((option) => option && option.riskBidId === riskBidId);
  if (matches.length !== 1) issue(errors, matches.length ? "risk-bid-option-ambiguous" : "risk-bid-not-available", `${path}.riskBidId`, "Risk Bid must match exactly one authored option for the selected action.");
  return matches.length === 1 ? { station, action } : null;
}
/** Validate persisted, action-coupled Voyage Risk Bid references. */
export function validateVoyageEncounterRiskBids(state) {
  const structural = validateVoyageEncounterState(state);
  if (!structural.valid) return { valid: false, errors: [...structural.errors], warnings: [...structural.warnings] };
  const selections = validateVoyageEncounterStationSelections(state);
  const errors = [...selections.errors]; const warnings = [...structural.warnings, ...selections.warnings];
  const authoredOptions = validateAuthoredOptions(state, errors);
  for (const key of Object.keys(state.riskBids)) {
    const path = `riskBids.${key}`;
    if (!safeKey(key)) { issue(errors, "unsafe-risk-bid-station-key", path, "Stored Risk Bid uses an unsafe station key."); continue; }
    const bid = state.riskBids[key];
    if (!isPlainObject(bid)) { issue(errors, "invalid-risk-bid", path, "Stored Risk Bid must be a plain object."); continue; }
    for (const field of ["stationId", "actionId", "riskBidId"]) if (!Object.hasOwn(bid, field) || !hasId(bid[field])) issue(errors, ({ stationId: "invalid-risk-bid-station-id", actionId: "invalid-risk-bid-action-id", riskBidId: "invalid-risk-bid-id" })[field], `${path}.${field}`, `Stored Risk Bid requires a non-empty ${field}.`);
    if (!hasId(bid.stationId) || !hasId(bid.actionId) || !hasId(bid.riskBidId)) continue;
    if (bid.stationId !== key) { issue(errors, "risk-bid-station-key-mismatch", `${path}.stationId`, "Stored Risk Bid stationId must match its riskBids map key."); continue; }
    if (!Object.hasOwn(state.selections, key)) { issue(errors, "risk-bid-selection-missing", path, "Stored Risk Bid requires an existing station action selection."); continue; }
    const selection = state.selections[key];
    if (!isPlainObject(selection) || selection.actionId !== bid.actionId) { issue(errors, "risk-bid-action-mismatch", `${path}.actionId`, "Stored Risk Bid actionId must match the station's selected action."); continue; }
    resolve(state, bid.stationId, bid.actionId, bid.riskBidId, errors, path, authoredOptions);
  }
  return { valid: errors.length === 0, errors: deduplicateIssues(errors), warnings: deduplicateIssues(warnings) };
}
function request(state, value, needsExisting) {
  const errors = []; if (!isPlainObject(value)) issue(errors, "invalid-risk-bid-request", "bidRequest", "Risk Bid request must be a plain object.");
  const stationId = value?.stationId; const riskBidId = value?.riskBidId;
  if (!hasId(stationId)) issue(errors, "invalid-risk-bid-station-id", "bidRequest.stationId", "Risk Bid requires a non-empty stationId."); else if (!safeKey(stationId)) issue(errors, "unsafe-risk-bid-station-key", "bidRequest.stationId", "Risk Bid requires a safe station map key.");
  if (!hasId(riskBidId)) issue(errors, "invalid-risk-bid-id", "bidRequest.riskBidId", "Risk Bid requires a non-empty riskBidId.");
  if (errors.length) return { errors };
  if (needsExisting !== Object.hasOwn(state.riskBids, stationId)) issue(errors, needsExisting ? "risk-bid-does-not-exist" : "risk-bid-already-exists", `riskBids.${stationId}`, needsExisting ? "Voyage station has no Risk Bid to edit." : "Voyage station already has a Risk Bid.");
  const selection = state.selections[stationId]; if (!Object.hasOwn(state.selections, stationId)) issue(errors, "risk-bid-selection-missing", `selections.${stationId}`, "Risk Bid requires an existing station action selection.");
  if (selection && hasId(riskBidId)) resolve(state, stationId, selection.actionId, riskBidId, errors, "bidRequest");
  return { errors, stationId, riskBidId, selection };
}
function mutate(state, value, type, existing = false, clear = false) {
  const source = validateVoyageEncounterRiskBids(state); const warnings = [...source.warnings]; if (!source.valid) return failure(source.errors, warnings);
  if (state.lifecycleState !== VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE) return failure([{ code: "risk-bid-requires-active", path: "lifecycleState", message: "Risk Bid editing requires an Active encounter.", severity: "error" }], warnings);
  if (state.phase !== VOYAGE_ROUND_PHASES.CREW_PLANNING) return failure([{ code: "risk-bid-requires-crew-planning", path: "phase", message: "Risk Bid editing requires the Crew Planning phase.", severity: "error" }], warnings);
  const input = clear ? (() => { const errors = []; const stationId = value?.stationId; if (!isPlainObject(value)) issue(errors, "invalid-risk-bid-request", "clearRequest", "Risk Bid clear request must be a plain object."); if (!hasId(stationId)) issue(errors, "invalid-risk-bid-station-id", "clearRequest.stationId", "Risk Bid requires a non-empty stationId."); else if (!safeKey(stationId)) issue(errors, "unsafe-risk-bid-station-key", "clearRequest.stationId", "Risk Bid requires a safe station map key."); if (errors.length === 0 && !Object.hasOwn(state.riskBids, stationId)) issue(errors, "risk-bid-does-not-exist", `riskBids.${stationId}`, "Voyage station has no Risk Bid to clear."); return { errors, stationId, selection: state.selections[stationId] }; })() : request(state, value, existing); if (input.errors.length) return failure(input.errors, warnings);
  const previous = state.riskBids[input.stationId]; if (existing && !clear && previous.riskBidId === input.riskBidId) return failure([{ code: "risk-bid-unchanged", path: "bidRequest.riskBidId", message: "Requested Risk Bid is already selected.", severity: "error" }], warnings);
  let candidate; try { candidate = clonePlainData(state); } catch { return failure([{ code: "risk-bid-candidate-construction-failed", path: "encounterState", message: "Risk Bid mutation could not clone encounter state.", severity: "error" }], warnings); }
  if (clear) delete candidate.riskBids[input.stationId]; else candidate.riskBids[input.stationId] = { stationId: input.stationId, actionId: input.selection.actionId, riskBidId: input.riskBidId };
  candidate.revision = state.revision + 1; const final = validateVoyageEncounterRiskBids(candidate); warnings.push(...final.warnings); if (!final.valid) return failure(final.errors, warnings);
  const event = { type, encounterId: candidate.encounterId, lifecycleState: candidate.lifecycleState, roundNumber: candidate.roundNumber, phase: candidate.phase, stationId: input.stationId, actionId: previous?.actionId ?? input.selection.actionId, ...(previous ? { previousRiskBidId: previous.riskBidId } : {}), riskBidId: clear ? previous.riskBidId : input.riskBidId, previousRevision: state.revision, revision: candidate.revision };
  return { ok: true, nextState: candidate, events: [event], errors: [], warnings: deduplicateIssues(warnings) };
}
export const applyVoyageEncounterRiskBidSelection = (state, request) => mutate(state, request, "voyage.risk-bid-selected");
export const applyVoyageEncounterRiskBidChange = (state, request) => mutate(state, request, "voyage.risk-bid-changed", true);
export const applyVoyageEncounterRiskBidClear = (state, request) => mutate(state, request, "voyage.risk-bid-cleared", true, true);
