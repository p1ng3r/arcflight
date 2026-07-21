import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES, VOYAGE_ROUND_PHASES } from "./constants.js";
import { isPlainObject } from "./defaults.js";
import { validateVoyageEncounterState } from "./validation.js";
import { validateVoyageEncounterStationSelections } from "./station-selection.js";
import { validateVoyageEncounterRiskBids } from "./risk-bids.js";

const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);
const issue = (errors, code, path, message) => errors.push({ code, path, message, severity: "error" });
const id = (value) => typeof value === "string" && value.trim().length > 0;
const dedupe = (items) => [...new Map(items.map((item) => [`${item.code}\0${item.path}\0${item.message}\0${item.severity}`, item])).values()];

/** Analyze the locked plan without imposing a public phase boundary. */
export function analyzeVoyageEncounterResolutionOrder(state) {
  const structural = validateVoyageEncounterState(state);
  const errors = [...structural.errors]; const warnings = [...structural.warnings];
  if (!structural.valid) return { valid: false, orderedActions: [], errors: dedupe(errors), warnings: dedupe(warnings) };
  const selections = validateVoyageEncounterStationSelections(state);
  const bids = validateVoyageEncounterRiskBids(state);
  errors.push(...selections.errors, ...bids.errors); warnings.push(...selections.warnings, ...bids.warnings);
  const stationMap = new Map();
  state.availableStations.forEach((station, stationIndex) => {
    const path = `availableStations[${stationIndex}]`;
    if (!isPlainObject(station)) return issue(errors, "invalid-available-station", path, "Available Voyage station must be a plain object.");
    if (!Object.hasOwn(station, "stationId") || !id(station.stationId) || UNSAFE.has(station.stationId)) return issue(errors, "invalid-available-station-id", `${path}.stationId`, "Available Voyage station requires a safe non-empty stationId.");
    if (stationMap.has(station.stationId)) return issue(errors, "duplicate-available-station-id", `${path}.stationId`, "Available Voyage station IDs must be unique.");
    if (!Object.hasOwn(station, "actions") || !Array.isArray(station.actions)) return issue(errors, "invalid-available-station-actions", `${path}.actions`, "Available Voyage station actions must be an array.");
    const actions = new Map();
    station.actions.forEach((action, actionIndex) => {
      const actionPath = `${path}.actions[${actionIndex}]`;
      if (!isPlainObject(action)) return issue(errors, "invalid-available-station-action", actionPath, "Available Voyage action must be a plain object.");
      if (!Object.hasOwn(action, "actionId") || !id(action.actionId)) return issue(errors, "invalid-available-station-action-id", `${actionPath}.actionId`, "Available Voyage action requires a non-empty actionId.");
      if (actions.has(action.actionId)) issue(errors, "duplicate-available-station-action-id", `${actionPath}.actionId`, "Available Voyage action IDs must be unique within a station.");
      else actions.set(action.actionId, { action, actionIndex });
      if (Object.hasOwn(action, "resolutionPriority") && !Number.isSafeInteger(action.resolutionPriority)) issue(errors, "invalid-resolution-priority", `${actionPath}.resolutionPriority`, "resolutionPriority must be a safe integer when supplied.");
    });
    stationMap.set(station.stationId, { station, stationIndex, actions });
  });
  for (const [stationId, entry] of stationMap) {
    if (entry.station.selectionRequired === false) continue;
    if (!Object.hasOwn(state.selections, stationId)) issue(errors, "missing-required-station-selection", `selections.${stationId}`, "Required Voyage station has no selected action.");
  }
  const rows = [];
  for (const stationId of Object.keys(state.selections)) {
    const selection = state.selections[stationId]; const station = stationMap.get(stationId);
    if (!station || !isPlainObject(selection) || selection.stationId !== stationId) continue;
    const action = station.actions.get(selection.actionId);
    if (!action) continue;
    rows.push({ stationId, actionId: selection.actionId, resolutionPriority: Object.hasOwn(action.action, "resolutionPriority") ? action.action.resolutionPriority : 0, riskBidId: Object.hasOwn(state.riskBids, stationId) ? state.riskBids[stationId].riskBidId : null, stationIndex: station.stationIndex, actionIndex: action.actionIndex });
  }
  rows.sort((a,b) => a.resolutionPriority - b.resolutionPriority || a.stationIndex - b.stationIndex || a.actionIndex - b.actionIndex || (a.stationId < b.stationId ? -1 : a.stationId > b.stationId ? 1 : 0) || (a.actionId < b.actionId ? -1 : a.actionId > b.actionId ? 1 : 0));
  return { valid: errors.length === 0, orderedActions: errors.length ? [] : rows.map((row, sequence) => ({ sequence, stationId: row.stationId, actionId: row.actionId, resolutionPriority: row.resolutionPriority, riskBidId: row.riskBidId })), errors: dedupe(errors), warnings: dedupe(warnings) };
}

export function prepareVoyageEncounterResolutionOrder(state) {
  const analyzed = analyzeVoyageEncounterResolutionOrder(state);
  const active = state?.lifecycleState === VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE;
  const lockReadiness = state?.phase === VOYAGE_ROUND_PHASES.LOCK_READINESS;
  const errors = [...analyzed.errors];
  if (analyzed.valid && !active) issue(errors, "resolution-order-requires-active", "lifecycleState", "Preparing Resolution order requires an Active encounter.");
  if (analyzed.valid && !lockReadiness) issue(errors, "resolution-order-requires-lock-readiness", "phase", "Preparing Resolution order requires the Lock Readiness phase.");
  const finalErrors = dedupe(errors); const orderedActions = finalErrors.length ? [] : analyzed.orderedActions.map((action) => ({ ...action }));
  return { structurallyValid: analyzed.valid, active, lockReadiness, readyForResolution: finalErrors.length === 0, actionCount: orderedActions.length, orderedActions, errors: finalErrors, warnings: dedupe(analyzed.warnings) };
}
