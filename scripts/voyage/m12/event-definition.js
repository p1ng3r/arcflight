import { analyzeVoyageEncounterOverallResult } from "../domain/event-result.js";
import { analyzeVoyageEventDefinitionRoundActionAuthoring } from "../domain/round-action-authoring.js";

export const M12_EVENT_ID = "m12-glassback-cinderwake";
export const M12_DEFINITION_SNAPSHOT_ID = "m12-glassback-cinderwake-v1";
export const M12_STATION_IDS = Object.freeze(["captain", "engineer", "navigator", "watchmaster", "veilwarden"]);

const stationIds = ["captain", "engineer", "navigator", "watchmaster", "veilwarden"];

function authoredAction(stationId, roundNumber, actionNumber) {
  const actionId = `${stationId}-round-${roundNumber}-action-${actionNumber}`;
  const riskBidOptions = [2, 5, 8].map((dcAdjustment) => ({
    riskBidId: `${actionId}-risk-${dcAdjustment}`,
    dcAdjustment,
    outcomes: { criticalSuccess: [], success: [], failure: [], criticalFailure: [] }
  }));
  return {
    actionId,
    approaches: [{
      approachId: `${actionId}-approach`,
      statisticSlugOrAbilityId: `${stationId}-skill-${actionNumber}`
    }],
    riskBidOptions
  };
}

function authoredRound(roundNumber) {
  return {
    roundId: `m12-round-${roundNumber}`,
    availableStations: stationIds.map((stationId) => ({
      stationId,
      actions: [1, 2, 3].map((actionNumber) => authoredAction(stationId, roundNumber, actionNumber))
    }))
  };
}

const definition = {
  schemaVersion: 1,
  eventId: M12_EVENT_ID,
  definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID,
  roundCount: 3,
  rounds: [1, 2, 3].map(authoredRound),
  rewards: [],
  enhancements: [],
  misfortuneEnhancements: [],
  misfortunes: [],
  nextSituations: [{ nextSituationId: "m12-next-situation", title: "Into the Cinderwake", summary: "The wreck's wake opens a dangerous route onward.", transitionKind: "authored" }]
};

export const M12_EVENT_PRESENTATION = Object.freeze({
  eventId: M12_EVENT_ID,
  definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID,
  title: "The Glassback at Cinderwake Wreck",
  description: "A glassback leviathan circles a broken Arkflight wreck while its ember wake tears at the vessel's veil.",
  roundCount: 3,
  stationIds: M12_STATION_IDS
});

export function getM12EventDefinition() {
  return structuredClone(definition);
}

export function validateM12EventDefinition(value) {
  try {
    const captured = structuredClone(value);
    const authoring = analyzeVoyageEventDefinitionRoundActionAuthoring(captured);
    if (!authoring.structurallyValid || !authoring.authoringValid) return { valid: false, errors: authoring.errors, warnings: authoring.warnings };
    if (JSON.stringify(captured) !== JSON.stringify(definition)) return { valid: false, errors: [{ code: "m12-event-definition-mismatch", path: "eventDefinition", message: "The Milestone 12 event definition is not the registered immutable snapshot.", severity: "error" }], warnings: [] };
    const history = {
      schemaVersion: 1, eventId: M12_EVENT_ID, sessionId: "m12-definition-check", definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID,
      roundCount: 3, rounds: definition.rounds.map((round, index) => ({ roundId: round.roundId, roundNumber: index + 1, roundResult: "round-success" }))
    };
    const overallDefinition = { ...captured, rounds: captured.rounds.map((round, index) => ({ roundId: round.roundId, roundNumber: index + 1 })) };
    const result = analyzeVoyageEncounterOverallResult({ kind: "m8-overall-result", sessionId: history.sessionId, eventDefinition: overallDefinition, completedRoundHistory: history });
    return result.ok ? { valid: true, errors: [], warnings: [] } : { valid: false, errors: result.errors, warnings: result.warnings };
  } catch {
    return { valid: false, errors: [{ code: "m12-event-definition-invalid", path: "eventDefinition", message: "The Milestone 12 event definition could not be validated safely.", severity: "error" }], warnings: [] };
  }
}
