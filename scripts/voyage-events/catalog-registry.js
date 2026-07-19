import { VOYAGE_EVENT_HAZARD_SEVERITIES, VOYAGE_EVENT_PRESSURE_LANES, VOYAGE_EVENT_STATION_KEYS } from "./constants.js";
import { isVoyageEventCatalogEntry } from "./contracts.js";

export const VOYAGE_EVENT_CATALOG_GROUPS = Object.freeze(["rewards", "dangers", "hazards", "downstreamEffects", "heldEffects", "preparedAdvantages", "consequences"]);

const plainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const clone = (value) => JSON.parse(JSON.stringify(value));
const issue = (issues, severity, code, path, message, referenceId) => issues.push({ severity, code, path, message, ...(referenceId ? { referenceId } : {}) });
const entriesFor = (source) => Array.isArray(source) ? source : plainObject(source) ? Object.values(source) : [];

/** Builds immutable-source-independent catalog lookups and reports malformed or duplicate entries. */
export function createVoyageEventCatalogRegistry(source = {}) {
  const errors = [], warnings = [], groups = Object.fromEntries(VOYAGE_EVENT_CATALOG_GROUPS.map((group) => [group, new Map()]));
  const allIds = new Map();
  if (!plainObject(source)) issue(errors, "error", "catalog.source.invalid", "catalogs", "Catalog source must be a plain object.");
  inspectSafeData(source, "catalogs", errors, new Set());

  for (const group of VOYAGE_EVENT_CATALOG_GROUPS) {
    const raw = source?.[group];
    if (raw !== undefined && !Array.isArray(raw) && !plainObject(raw)) issue(errors, "error", "catalog.group.invalid", `catalogs.${group}`, "Catalog group must be an array or object.");
    for (const [index, entry] of entriesFor(raw).entries()) {
      const path = `catalogs.${group}[${index}]`;
      if (!isJsonData(entry) || !isVoyageEventCatalogEntry(entry)) {
        issue(errors, "error", "catalog.entry.invalid", path, "Catalog entry does not meet the shared catalog contract.");
        continue;
      }
      const errorCount = errors.length;
      validateGroupEntry(group, entry, errors, path);
      if (errors.length !== errorCount) continue;
      if (groups[group].has(entry.id)) { issue(errors, "error", "catalog.id.duplicate.group", `${path}.id`, "Catalog ID is duplicated within its group; the first valid entry is retained.", entry.id); continue; }
      if (allIds.has(entry.id)) { issue(errors, "error", "catalog.id.duplicate.crossGroup", `${path}.id`, "Catalog ID is duplicated across incompatible groups; the first valid entry is retained.", entry.id); continue; }
      groups[group].set(entry.id, clone(entry)); allIds.set(entry.id, group);
    }
  }
  const report = { valid: errors.length === 0, errors, warnings };
  return Object.freeze({ report, get: (group, id) => groups[group]?.get(id) ? clone(groups[group].get(id)) : null, getGroup: (group) => groups[group] ? Object.fromEntries([...groups[group]].map(([id, entry]) => [id, clone(entry)])) : null, has: (group, id) => groups[group]?.has(id) ?? false });
}

const isJsonData = (value, seen = new Set()) => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (!Array.isArray(value) && !plainObject(value)) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  const valid = Object.values(value).every((entry) => isJsonData(entry, seen));
  seen.delete(value);
  return valid;
};
function inspectSafeData(value, path, errors, seen) {
  const type = typeof value;
  if (["function", "symbol", "bigint", "undefined"].includes(type) || (type === "number" && !Number.isFinite(value))) return issue(errors, "error", "data.json.incompatible", path, "Imported data must be JSON-compatible plain data.");
  if (value && type === "object") {
    if (seen.has(value)) return issue(errors, "error", "data.cyclic", path, "Imported data must not contain cyclic references.");
    if (!Array.isArray(value) && !plainObject(value)) return issue(errors, "error", "data.classInstance", path, "Imported data must not contain class instances.");
    seen.add(value); Object.entries(value).forEach(([key, entry]) => inspectSafeData(entry, Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`, errors, seen)); seen.delete(value);
  }
}

function validateGroupEntry(group, entry, errors, path) {
  const stationArray = (field) => Array.isArray(entry[field]) && entry[field].every((key) => VOYAGE_EVENT_STATION_KEYS.includes(key));
  if (group === "rewards" && (!['plus2', 'plus5', 'plus8'].includes(entry.bidBand) || !stationArray("sourceStations") || !stationArray("targetStations") || !Array.isArray(entry.actionTags))) issue(errors, "error", "catalog.reward.invalid", path, "Reward requires a plus2, plus5, or plus8 bid band, active source and target stations, and action tags.", entry.id);
  if (group === "dangers" && (!stationArray("sourceStations") || !stationArray("targetStations"))) issue(errors, "error", "catalog.danger.invalid", path, "Danger requires active source and target stations.", entry.id);
  if (group === "hazards" && (!Object.values(VOYAGE_EVENT_HAZARD_SEVERITIES).includes(entry.severity) || !Array.isArray(entry.pressureLanes) || new Set(entry.pressureLanes).size !== entry.pressureLanes.length || !entry.pressureLanes.every((lane) => VOYAGE_EVENT_PRESSURE_LANES.includes(lane)))) issue(errors, "error", "catalog.hazard.invalid", path, "Hazard requires alpha severity and unique valid pressure lanes.", entry.id);
  if (group === "downstreamEffects" && (!VOYAGE_EVENT_STATION_KEYS.includes(entry.sourceStation) || !VOYAGE_EVENT_STATION_KEYS.includes(entry.targetStation))) issue(errors, "error", "catalog.downstreamEffect.invalid", path, "Downstream effect requires active source and target stations.", entry.id);
  if (group === "heldEffects" && (typeof entry.cardId !== "string" || !entry.cardId.trim())) issue(errors, "error", "catalog.heldEffect.invalid", path, "Held effect requires a non-empty card ID.", entry.id);
}
