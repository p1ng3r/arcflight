import {
  INACTIVE_VOYAGE_ROUND_VALUE,
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES,
  VOYAGE_ENCOUNTER_SCHEMA_VERSION
} from "./constants.js";

export function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function createDefaultVoyageEncounterCollections() {
  return {
    primaryShip: null,
    currentSituation: null,
    objective: null,
    participants: [],
    availableStations: [],
    temporaryStationAssignments: [],
    playerVisibleInformation: {},
    gmSecretInformation: {},
    successConditions: [],
    failureConditions: [],
    permanentConsequences: [],
    temporaryConsequences: [],
    tracks: [],
    thresholdHistory: [],
    pendingThresholdQueue: [],
    selections: {},
    targets: {},
    riskBids: {},
    assistance: [],
    reservations: [],
    pendingChecks: [],
    pendingConsequences: [],
    processedRequestIds: [],
    snapshots: [],
    recovery: {},
    metadata: {}
  };
}

export function createDraftVoyageEncounterDefaults() {
  return {
    schemaVersion: VOYAGE_ENCOUNTER_SCHEMA_VERSION,
    encounterId: "",
    definitionId: null,
    definitionRef: null,
    title: "",
    description: "",
    lifecycleState: VOYAGE_ENCOUNTER_LIFECYCLE_STATES.DRAFT,
    revision: 0,
    currentStage: INACTIVE_VOYAGE_ROUND_VALUE,
    roundNumber: INACTIVE_VOYAGE_ROUND_VALUE,
    phase: INACTIVE_VOYAGE_ROUND_VALUE,
    ...createDefaultVoyageEncounterCollections()
  };
}
