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

/**
 * Clone serializable plain data without relying on JSON serialization.
 * Non-plain objects are retained as supplied because they are outside the
 * Voyage domain's plain-data contract.
 */
export function clonePlainData(value) {
  if (Array.isArray(value)) {
    const clone = new Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
      if (Object.hasOwn(value, index)) clone[index] = clonePlainData(value[index]);
    }
    return clone;
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clonePlainData(entry)]));
  }
  return value;
}

export function createDefaultVoyageEncounterCollections() {
  return {
    primaryShip: null,
    currentSituation: null,
    objective: null,
    participants: [],
    availableStations: [],
    stationAssignments: [],
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
