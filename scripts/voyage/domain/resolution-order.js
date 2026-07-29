import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES, VOYAGE_ROUND_PHASES } from "./constants.js";
import { isPlainObject } from "./defaults.js";
import { deriveOccupiedVoyageStationIds } from "./station-assignments.js";
import { analyzeVoyageEncounterStationOrder } from "./station-order.js";
import { validateVoyageEncounterState } from "./validation.js";
import { validateVoyageEncounterStationSelections } from "./station-selection.js";
import { validateVoyageEncounterRiskBids } from "./risk-bids.js";

const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);
const issue = (errors, code, path, message) => errors.push({ code, path, message, severity: "error" });
const nonEmptyId = (value) => typeof value === "string" && value.trim().length > 0;
export function deduplicateVoyageResolutionIssues(issues) {
  const seen = new Set();
  const deduplicated = [];
  for (const entry of issues) {
    const key = `${entry.code}\0${entry.path}\0${entry.message}\0${entry.severity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduplicated.push({ ...entry });
  }
  return deduplicated;
}

/** Analyze a locked plan without the public Active/Lock Readiness phase gate. */
export function analyzeVoyageEncounterResolutionOrder(state) {
  const stationOrder = analyzeVoyageEncounterStationOrder(state);
  const errors = [...stationOrder.errors];
  const warnings = [...stationOrder.warnings];
  if (!stationOrder.valid) {
    return {
      valid: false,
      orderedActions: [],
      errors: deduplicateVoyageResolutionIssues(errors),
      warnings: deduplicateVoyageResolutionIssues(warnings)
    };
  }

  if (stationOrder.proposedStationOrder.length > 0) {
    issue(
      errors,
      "resolution-order-requires-empty-proposed-station-order",
      "proposedStationOrder",
      "Resolution ordering requires proposedStationOrder to be empty after locking."
    );
  }
  if (!stationOrder.committedOrderComplete) {
    issue(
      errors,
      "resolution-order-requires-complete-committed-station-order",
      "committedStationOrder",
      "Resolution ordering requires a complete committed station order for every occupied station."
    );
  }

  const selectionValidation = validateVoyageEncounterStationSelections(state);
  const bidValidation = validateVoyageEncounterRiskBids(state);
  errors.push(...selectionValidation.errors, ...bidValidation.errors);
  warnings.push(...selectionValidation.warnings, ...bidValidation.warnings);
  if (bidValidation.overRiskBidLimit) {
    issue(
      errors,
      "risk-bid-round-limit-exceeded",
      "riskBids",
      `Resolution allows at most ${bidValidation.riskBidLimit} selected Risk Bids.`
    );
  }

  const stations = new Map();
  for (let stationIndex = 0; stationIndex < state.availableStations.length; stationIndex += 1) {
    if (!Object.hasOwn(state.availableStations, stationIndex)) continue;
    const station = state.availableStations[stationIndex];
    const path = `availableStations[${stationIndex}]`;
    if (!isPlainObject(station)) { issue(errors, "invalid-available-station", path, "Available Voyage station must be a plain object."); continue; }
    if (!Object.hasOwn(station, "stationId") || !nonEmptyId(station.stationId)) { issue(errors, "invalid-available-station-id", `${path}.stationId`, "Available Voyage station requires a non-empty stationId."); continue; }
    if (UNSAFE.has(station.stationId)) { issue(errors, "unsafe-available-station-id", `${path}.stationId`, "Available Voyage station requires a safe stationId."); continue; }
    if (stations.has(station.stationId)) { issue(errors, "duplicate-available-station-id", `${path}.stationId`, "Available Voyage station IDs must be unique."); continue; }
    if (!Object.hasOwn(station, "actions") || !Array.isArray(station.actions)) { issue(errors, "invalid-available-station-actions", `${path}.actions`, "Available Voyage station actions must be an array."); continue; }
    const actions = new Map();
    for (let actionIndex = 0; actionIndex < station.actions.length; actionIndex += 1) {
      if (!Object.hasOwn(station.actions, actionIndex)) continue;
      const action = station.actions[actionIndex];
      const actionPath = `${path}.actions[${actionIndex}]`;
      if (!isPlainObject(action)) { issue(errors, "invalid-available-station-action", actionPath, "Available Voyage action must be a plain object."); continue; }
      if (!Object.hasOwn(action, "actionId") || !nonEmptyId(action.actionId)) { issue(errors, "invalid-available-station-action-id", `${actionPath}.actionId`, "Available Voyage action requires a non-empty actionId."); continue; }
      if (actions.has(action.actionId)) issue(errors, "duplicate-available-station-action-id", `${actionPath}.actionId`, "Available Voyage action IDs must be unique within a station.");
      else actions.set(action.actionId, { action, actionIndex });
      if (Object.hasOwn(action, "resolutionPriority") && !Number.isSafeInteger(action.resolutionPriority)) issue(errors, "invalid-resolution-priority", `${actionPath}.resolutionPriority`, "resolutionPriority must be a safe integer when supplied.");
    }
    stations.set(station.stationId, { station, stationIndex, actions });
  }

  for (const stationId of deriveOccupiedVoyageStationIds(state.stationAssignments)) {
    if (!Object.hasOwn(state.selections, stationId)) {
      issue(errors, "missing-occupied-station-selection", `selections.${stationId}`, "Occupied Voyage station has no selected action.");
    }
  }

  const orderedActions = [];
  for (let sequence = 0; sequence < stationOrder.committedStationOrder.length; sequence += 1) {
    const stationId = stationOrder.committedStationOrder[sequence];
    const selection = state.selections[stationId];
    const station = stations.get(stationId);
    if (!station || !isPlainObject(selection) || selection.stationId !== stationId) continue;
    const action = station.actions.get(selection.actionId);
    if (!action) continue;
    const selectedRiskBid = bidValidation.valid
      && !bidValidation.overRiskBidLimit
      && Object.hasOwn(state.riskBids, stationId)
      ? state.riskBids[stationId]
      : null;
    orderedActions.push({
      sequence,
      stationId,
      actionId: selection.actionId,
      resolutionPriority: Object.hasOwn(action.action, "resolutionPriority")
        ? action.action.resolutionPriority
        : 0,
      riskBidId: selectedRiskBid?.riskBidId ?? null,
      dcAdjustment: selectedRiskBid?.dcAdjustment ?? null
    });
  }
  const finalErrors = deduplicateVoyageResolutionIssues(errors);
  return {
    valid: finalErrors.length === 0,
    orderedActions: finalErrors.length
      ? []
      : orderedActions.map((action) => ({ ...action })),
    errors: finalErrors,
    warnings: deduplicateVoyageResolutionIssues(warnings)
  };
}

export function prepareVoyageEncounterResolutionOrder(state) {
  const structural = validateVoyageEncounterState(state);
  const analyzed = analyzeVoyageEncounterResolutionOrder(state);
  const active = state?.lifecycleState === VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE;
  const lockReadiness = state?.phase === VOYAGE_ROUND_PHASES.LOCK_READINESS;
  const errors = [...analyzed.errors];
  if (structural.valid && !active) issue(errors, "resolution-order-requires-active", "lifecycleState", "Preparing Resolution order requires an Active encounter.");
  if (structural.valid && !lockReadiness) issue(errors, "resolution-order-requires-lock-readiness", "phase", "Preparing Resolution order requires the Lock Readiness phase.");
  const finalErrors = deduplicateVoyageResolutionIssues(errors);
  const orderedActions = finalErrors.length === 0 ? analyzed.orderedActions.map((action) => ({ ...action })) : [];
  return { structurallyValid: structural.valid, active, lockReadiness, readyForResolution: structural.valid && active && lockReadiness && analyzed.valid, actionCount: orderedActions.length, orderedActions, errors: finalErrors, warnings: deduplicateVoyageResolutionIssues(analyzed.warnings) };
}
