import {
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES,
  VOYAGE_ROUND_PHASES
} from "./constants.js";
import { prepareVoyageEncounterCrewPlanningCompleteness } from "./crew-planning-completeness.js";
import { analyzeVoyageEncounterStationOrder } from "./station-order.js";
import { validateVoyageEncounterState } from "./validation.js";
import { validateVoyageEncounterRiskBids } from "./risk-bids.js";

function issue(errors, code, path, message) {
  errors.push({ code, path, message, severity: "error" });
}

function issueIdentity(entry) {
  return `${entry.code}\u0000${entry.path}\u0000${entry.message}\u0000${entry.severity}`;
}

function deduplicateIssues(issues) {
  const seen = new Set();
  return issues.filter((entry) => {
    const identity = issueIdentity(entry);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function cloneIssues(issues) {
  return issues.map((entry) => ({ ...entry }));
}

const COMPLETENESS_GATE_CODES = new Set([
  "crew-planning-completeness-requires-active",
  "crew-planning-completeness-requires-crew-planning"
]);

/**
 * Prepare a read-only, derived report for locking an Active Crew Plan.
 */
export function prepareVoyageEncounterCrewPlanningReadiness(encounterState) {
  const structural = validateVoyageEncounterState(encounterState);
  const completeness = prepareVoyageEncounterCrewPlanningCompleteness(encounterState);
  const stationOrder = analyzeVoyageEncounterStationOrder(encounterState);
  const riskBids = validateVoyageEncounterRiskBids(encounterState);
  const stationOrderErrorIdentities = new Set(stationOrder.errors.map(issueIdentity));
  const stationOrderWarningIdentities = new Set(stationOrder.warnings.map(issueIdentity));
  const completenessGateErrors = completeness.errors.filter(
    (entry) => COMPLETENESS_GATE_CODES.has(entry.code)
  );
  const errors = [
    ...cloneIssues(structural.errors),
    ...cloneIssues(riskBids.errors),
    ...cloneIssues(completeness.errors.filter(
      (entry) => !stationOrderErrorIdentities.has(issueIdentity(entry))
        && !COMPLETENESS_GATE_CODES.has(entry.code)
    )),
    ...cloneIssues(stationOrder.errors),
    ...cloneIssues(completenessGateErrors)
  ];
  const warnings = [
    ...cloneIssues(structural.warnings),
    ...cloneIssues(riskBids.warnings),
    ...cloneIssues(completeness.warnings.filter(
      (entry) => !stationOrderWarningIdentities.has(issueIdentity(entry))
    )),
    ...cloneIssues(stationOrder.warnings)
  ];

  const active = structural.valid
    && encounterState.lifecycleState === VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE;
  const crewPlanning = structural.valid
    && encounterState.phase === VOYAGE_ROUND_PHASES.CREW_PLANNING;
  if (structural.valid && !active) {
    issue(errors, "crew-planning-readiness-requires-active", "lifecycleState", "Preparing Crew Planning readiness requires an Active encounter.");
  }
  if (structural.valid && !crewPlanning) {
    issue(errors, "crew-planning-readiness-requires-crew-planning", "phase", "Preparing Crew Planning readiness requires the Crew Planning phase.");
  }
  if (structural.valid && (!encounterState.currentStage
    || typeof encounterState.currentStage.stageId !== "string"
    || !encounterState.currentStage.stageId.trim())) {
    issue(errors, "invalid-crew-planning-readiness-stage-id", "currentStage.stageId", "Crew Planning readiness requires a non-empty current stageId for the Lock Readiness snapshot.");
  }
  if (stationOrder.valid
    && active
    && crewPlanning
    && stationOrder.committedStationOrder.length > 0) {
    issue(
      errors,
      "crew-planning-committed-station-order-already-present",
      "committedStationOrder",
      "Crew Planning requires committedStationOrder to remain empty until the plan is locked."
    );
  }

  const finalErrors = deduplicateIssues(errors);
  const finalWarnings = deduplicateIssues(warnings);
  const readyToLock = finalErrors.length === 0
    && active
    && crewPlanning
    && completeness.complete
    && completeness.missingOccupiedStationIds.length === 0
    && completeness.missingApproachStationIds.length === 0
    && completeness.proposedOrderComplete;

  return {
    structurallyValid: structural.valid,
    active,
    crewPlanning,
    occupiedStationIds: [...completeness.occupiedStationIds],
    selectedStationIds: [...completeness.selectedStationIds],
    missingOccupiedStationIds: [...completeness.missingOccupiedStationIds],
    approachSelectedStationIds: [...completeness.approachSelectedStationIds],
    missingApproachStationIds: [...completeness.missingApproachStationIds],
    proposedStationOrder: [...completeness.proposedStationOrder],
    proposedOrderComplete: completeness.proposedOrderComplete,
    complete: completeness.complete,
    readyToLock,
    errors: cloneIssues(finalErrors),
    warnings: cloneIssues(finalWarnings)
  };
}
