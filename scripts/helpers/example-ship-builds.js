import { ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import {
  EXAMPLE_SHIP_BUILD_KEYS,
  getExampleShipBuild
} from "../../data/example-ships.js";
import {
  createCoreArkengine,
  createCoreArkengineMod,
  createCoreCrewAsset,
  createCoreHull,
  createCoreRoom,
  createCoreShipUpgrade
} from "../documents/creation.js";
import {
  ARCFLIGHT_SHIP_ACTOR_TYPE,
  addCrewAsset,
  assignStation,
  clearShipBuild,
  getArcflightShipData,
  installArkengine,
  installArkengineMod,
  installHull,
  installRoom,
  installShipUpgrade,
  recalculateShipStats,
  setArkenginePattern,
  setHullPattern
} from "../documents/ships.js";

function isArcflightVehicle(actor) {
  return actor?.type === "vehicle"
    && actor.getFlag?.(ARCFLIGHT_MODULE_ID, "enabled") === true
    && actor.getFlag?.(ARCFLIGHT_MODULE_ID, "actorType") === ARCFLIGHT_SHIP_ACTOR_TYPE;
}

function assertArcflightVehicle(actor) {
  if (!isArcflightVehicle(actor)) {
    throw new Error("Arcflight | applyExampleShipBuild requires an Arcflight-enabled PF2E vehicle actor.");
  }
}

async function createAndInstallMany(shipActor, keys, createItem, installItem) {
  for (const key of keys) {
    const item = await createItem(key);
    await installItem(shipActor, item);
  }
}

function findCrewAssetEntry(shipActor, crewAssetKey) {
  const shipData = getArcflightShipData(shipActor);
  return shipData.crew.namedCrew.find((entry) => (
    entry.key === crewAssetKey || entry.identity?.id === crewAssetKey
  ));
}

async function assignSuggestedStations(shipActor, stationAssignmentSuggestions = {}) {
  for (const [stationKey, crewAssetKey] of Object.entries(stationAssignmentSuggestions)) {
    const shipData = getArcflightShipData(shipActor);
    if (shipData.stations.assignments[stationKey]) continue;

    const crewEntry = findCrewAssetEntry(shipActor, crewAssetKey);
    if (!crewEntry) continue;

    await assignStation(shipActor, stationKey, crewEntry, { assigneeType: "crewAsset" });
  }
}

export function getExampleShipBuildKeys() {
  return EXAMPLE_SHIP_BUILD_KEYS;
}

export { EXAMPLE_SHIP_BUILD_KEYS, getExampleShipBuild };

/**
 * Apply a complete example build to an Arcflight-enabled PF2E vehicle.
 *
 * This helper only creates component Items, installs data using existing ship
 * helpers, applies patterns, suggests clean station assignments, and
 * recalculates derived stats. It does not add combat, travel, resource,
 * condition, station action, or UI systems.
 *
 * @param {Actor} shipActor Arcflight-enabled PF2E vehicle actor.
 * @param {string} buildKey Example build key.
 * @returns {Promise<Actor>} The updated ship actor.
 */
export async function applyExampleShipBuild(shipActor, buildKey) {
  assertArcflightVehicle(shipActor);

  const build = getExampleShipBuild(buildKey);
  if (!build) {
    throw new Error(`Arcflight | Unknown example ship build key: ${buildKey}`);
  }

  const hullItem = await createCoreHull(build.hullKey);
  await installHull(shipActor, hullItem);
  await setHullPattern(shipActor, build.hullPatternKey);

  const arkengineItem = await createCoreArkengine(build.arkengineKey);
  await installArkengine(shipActor, arkengineItem);
  await setArkenginePattern(shipActor, build.arkenginePatternKey);

  await createAndInstallMany(shipActor, build.arkengineMods, createCoreArkengineMod, installArkengineMod);
  await createAndInstallMany(shipActor, build.rooms, createCoreRoom, installRoom);
  await createAndInstallMany(shipActor, build.shipUpgrades, createCoreShipUpgrade, installShipUpgrade);
  await createAndInstallMany(shipActor, build.crewAssets, createCoreCrewAsset, addCrewAsset);
  await assignSuggestedStations(shipActor, build.stationAssignmentSuggestions);
  await recalculateShipStats(shipActor);

  return shipActor;
}

/**
 * Clear an Arcflight ship build before applying an example build.
 *
 * @param {Actor} shipActor Arcflight-enabled PF2E vehicle actor.
 * @param {string} buildKey Example build key.
 * @returns {Promise<Actor>} The updated ship actor.
 */
export async function applyCleanExampleShipBuild(shipActor, buildKey) {
  assertArcflightVehicle(shipActor);

  await clearShipBuild(shipActor);
  return applyExampleShipBuild(shipActor, buildKey);
}
