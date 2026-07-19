import { VOYAGE_EVENT_BID_BANDS, VOYAGE_EVENT_MECHANICS_VERSION, VOYAGE_EVENT_PACKAGE_SCHEMA_VERSION, VOYAGE_EVENT_PHASES, VOYAGE_EVENT_PRESSURE_LANES, VOYAGE_EVENT_SCHEMA_VERSION, VOYAGE_EVENT_STATION_KEYS } from "./constants.js";

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

/** Clones JSON-compatible plain data without retaining mutable input references. */
function cloneJsonData(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) return value.map((entry) => cloneJsonData(entry) ?? null);
  if (!isPlainObject(value)) return undefined;

  const clone = {};
  for (const [key, entry] of Object.entries(value)) {
    const clonedEntry = cloneJsonData(entry);
    if (clonedEntry !== undefined) clone[key] = clonedEntry;
  }
  return clone;
}

const object = (value) => isPlainObject(value) ? cloneJsonData(value) : {};
const string = (value, fallback = "") => typeof value === "string" ? value : fallback;
const number = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const array = (value) => Array.isArray(value) ? cloneJsonData(value) : [];

/** Returns a new event-local Pressure record. It is intentionally distinct from refitPressure. */
export function createVoyageEventPressure(source = {}) {
  const input = object(source);
  return Object.fromEntries(VOYAGE_EVENT_PRESSURE_LANES.map((lane) => [lane, Math.max(0, number(input[lane]))]));
}

/** Returns new runtime records for precisely the five active Voyage Event stations. */
export function createVoyageEventStationRuntimes(source = {}) {
  const input = object(source);
  return Object.fromEntries(VOYAGE_EVENT_STATION_KEYS.map((stationKey) => {
    const station = object(input[stationKey]);
    return [stationKey, { stationKey, operatorActorUuid: string(station.operatorActorUuid), focus: Math.max(0, number(station.focus, 1)), status: string(station.status, "unresolved"), activatedAt: number(station.activatedAt, null), resolvedAt: number(station.resolvedAt, null) }];
  }));
}

/** Returns an independent, serializable Voyage Event runtime with Focus only on station records. */
export function createVoyageEventRuntime(source = {}) {
  const input = object(source);
  const hazards = object(input.hazards);
  return {
    runtimeId: string(input.runtimeId), packageId: string(input.packageId), packageVersion: string(input.packageVersion, "1.0.0"), shipUuid: string(input.shipUuid),
    phase: string(input.phase, VOYAGE_EVENT_PHASES.SETUP), revision: Math.max(0, number(input.revision)), paused: input.paused === true,
    roundIndex: Math.max(0, number(input.roundIndex)), stationOrder: array(input.stationOrder).filter((key) => VOYAGE_EVENT_STATION_KEYS.includes(key)),
    stations: createVoyageEventStationRuntimes(input.stations), incomingEffects: array(input.incomingEffects), pressure: createVoyageEventPressure(input.pressure),
    hazards: { minor: array(hazards.minor), serious: array(hazards.serious) }, narrativeFlags: object(input.narrativeFlags),
    tentativeChoices: object(input.tentativeChoices), lockedChoices: object(input.lockedChoices), completedStationResults: object(input.completedStationResults),
    roundHistory: array(input.roundHistory), postedVignettes: array(input.postedVignettes), eventScore: number(input.eventScore), stagedAftermath: array(input.stagedAftermath),
    auditHistory: array(input.auditHistory), createdAt: number(input.createdAt), createdByUserId: string(input.createdByUserId), updatedAt: number(input.updatedAt), updatedByUserId: string(input.updatedByUserId)
  };
}

/** Returns the safe value for flags.arcflight.system.voyageEvents, including older ships with no Voyage Event data. */
export function createVoyageEventsContainer(source = {}) {
  const input = object(source);
  return { schemaVersion: VOYAGE_EVENT_SCHEMA_VERSION, active: isPlainObject(input.active) ? createVoyageEventRuntime(input.active) : null, archive: array(input.archive) };
}

/** Returns a new declarative bid selection with stable catalog references only. */
export function createVoyageEventBid(source = {}) {
  const input = object(source);
  const band = Object.values(VOYAGE_EVENT_BID_BANDS).includes(input.band) ? input.band : VOYAGE_EVENT_BID_BANDS.NONE;
  return { band, rewardId: string(input.rewardId), dangerId: string(input.dangerId) };
}

/** Returns a new declarative event package shell; it contains no executable mechanics or shared mutable input data. */
export function createVoyageEventPackage(source = {}) {
  const input = object(source);
  return { schemaVersion: VOYAGE_EVENT_PACKAGE_SCHEMA_VERSION, mechanicsVersion: string(input.mechanicsVersion, String(VOYAGE_EVENT_MECHANICS_VERSION)), packageVersion: string(input.packageVersion, "1.0.0"), packageId: string(input.packageId), title: string(input.title), category: string(input.category), tags: array(input.tags), minimumRounds: Math.max(0, number(input.minimumRounds)), maximumRounds: Math.max(0, number(input.maximumRounds)), objective: object(input.objective), visibleStakes: string(input.visibleStakes), hiddenGmSummary: string(input.hiddenGmSummary), artworkRoles: object(input.artworkRoles), rounds: array(input.rounds), narrativeComponents: array(input.narrativeComponents), finalOutcomeNarrative: object(input.finalOutcomeNarrative), aftermathPackages: array(input.aftermathPackages), validShipScarCategories: array(input.validShipScarCategories), earlyCompletion: object(input.earlyCompletion), withdrawal: object(input.withdrawal), transformations: array(input.transformations) };
}
