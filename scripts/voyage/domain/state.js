import { VOYAGE_ENCOUNTER_SCHEMA_VERSION } from "./constants.js";
import { clonePlainData, createDraftVoyageEncounterDefaults, isPlainObject } from "./defaults.js";

function generateEncounterId(context) {
  if (typeof context?.idGenerator === "function") {
    const generatedId = context.idGenerator();
    if (typeof generatedId === "string" && generatedId.trim()) return generatedId;
  }

  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `voyage-${globalThis.crypto.randomUUID()}`;
  }

  return `voyage-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create a plain-data Voyage Encounter in Draft state. Creation never starts a
 * round; activation is a separate future domain operation.
 */
export function createVoyageEncounterState(input = {}, context = {}) {
  const supplied = isPlainObject(input) ? input : {};
  const state = normalizeVoyageEncounterState({ ...supplied, lifecycleState: "draft", revision: 0 });
  state.encounterId = typeof supplied.encounterId === "string" && supplied.encounterId.trim()
    ? supplied.encounterId
    : generateEncounterId(context);
  state.lifecycleState = "draft";
  state.schemaVersion = VOYAGE_ENCOUNTER_SCHEMA_VERSION;
  state.revision = 0;
  state.currentStage = null;
  state.roundNumber = null;
  state.phase = null;
  return state;
}

/**
 * Return a fresh, safe plain-data shape without modifying the supplied value.
 * Invalid enum values are retained for validation rather than silently repaired.
 */
export function normalizeVoyageEncounterState(value) {
  const source = isPlainObject(value) ? value : {};
  const defaults = createDraftVoyageEncounterDefaults();
  const normalized = clonePlainData(source);
  if (Object.hasOwn(normalized, "temporaryStationAssignments")) {
    delete normalized.temporaryStationAssignments;
  }

  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (Array.isArray(defaultValue)) {
      normalized[key] = Array.isArray(source[key]) ? clonePlainData(source[key]) : [];
    } else if (isPlainObject(defaultValue)) {
      normalized[key] = isPlainObject(source[key]) ? clonePlainData(source[key]) : clonePlainData(defaultValue);
    } else if (!(key in source)) {
      normalized[key] = defaultValue;
    }
  }

  for (const key of ["primaryShip", "currentStage"]) {
    if (key in source && source[key] !== null && !isPlainObject(source[key])) normalized[key] = null;
  }

  return normalized;
}
