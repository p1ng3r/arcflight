import { ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import {
  createCoreArkengine,
  createCoreArkengineMod,
  createCoreCrewAsset,
  createCoreHull,
  createCoreRoom,
  createCoreShipUpgrade
} from "../documents/creation.js";
import {
  addCrewAsset,
  assignStation,
  clearStationAssignment,
  getArcflightShipData,
  getDefaultArcflightShipFlags,
  installArkengine,
  installArkengineMod,
  installHull,
  installRoom,
  installShipUpgrade,
  recalculateShipStats
} from "../documents/ships.js";
import { CORE_HULL_PLATFORM_KEYS } from "../../data/hulls/core-hulls.js";
import { CORE_ARKENGINE_KEYS } from "../../data/arkengines/core-arkengines.js";
import { CORE_ARKENGINE_MOD_KEYS } from "../../data/arkengine-mods/core-arkengine-mods.js";
import { CORE_ROOM_KEYS } from "../../data/rooms/core-rooms.js";
import { CORE_SHIP_UPGRADE_KEYS } from "../../data/ship-upgrades/core-ship-upgrades.js";
import { CORE_CREW_ASSET_KEYS } from "../../data/crew/core-crew-assets.js";
import { STATION_KEYS } from "../../data/stations/core-stations.js";

const SMOKE_TEST_ACTOR_NAME = "Arcflight Smoke Test Ship";
const SMOKE_TEST_FLAG = "frameworkSmokeTestHelper";

function check(result, name, passed, expected, actual, message = "") {
  const entry = { name, passed: Boolean(passed), expected, actual, message };
  result.checks.push(entry);
  return entry.passed;
}

function checkEqual(result, name, expected, actual, message = "") {
  return check(result, name, actual === expected, expected, actual, message);
}

function summarize(result) {
  result.passed = result.checks.every((entry) => entry.passed);

  const rows = result.checks.map((entry) => ({
    check: entry.name,
    passed: entry.passed,
    expected: entry.expected,
    actual: entry.actual,
    message: entry.message
  }));

  console.group(`Arcflight | Framework smoke test ${result.passed ? "PASSED" : "FAILED"}`);
  console.table(rows);
  console.log("Arcflight | Framework smoke test result", result);
  console.groupEnd();
}

function isCoreKeyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function findSmokeTestActor() {
  return Array.from(globalThis.game?.actors ?? []).find((actor) => (
    actor?.type === "vehicle"
    && actor?.name === SMOKE_TEST_ACTOR_NAME
    && actor.getFlag?.(ARCFLIGHT_MODULE_ID, SMOKE_TEST_FLAG) === true
  ));
}

async function ensureSmokeTestActor() {
  const existing = findSmokeTestActor();
  if (existing) return { actor: existing, created: false };

  const actor = await Actor.create({
    name: SMOKE_TEST_ACTOR_NAME,
    type: "vehicle",
    flags: {
      [ARCFLIGHT_MODULE_ID]: {
        [SMOKE_TEST_FLAG]: true
      }
    }
  });

  return { actor, created: true };
}

async function createSmokeTestComponent(createdItems, key, creator) {
  const item = await creator();
  createdItems.push(item);
  return [key, item];
}

async function createSmokeTestComponents(createdItems) {
  const entries = [
    await createSmokeTestComponent(createdItems, "hull", () => createCoreHull("brigantine")),
    await createSmokeTestComponent(createdItems, "arkengine", () => createCoreArkengine("tidewake-arkengine")),
    await createSmokeTestComponent(createdItems, "arkengineMod", () => createCoreArkengineMod("pressure-lattice-tuning")),
    await createSmokeTestComponent(createdItems, "room", () => createCoreRoom("workshop")),
    await createSmokeTestComponent(createdItems, "shipUpgrade", () => createCoreShipUpgrade("reinforced-structural-ribbing")),
    await createSmokeTestComponent(createdItems, "crewAsset", () => createCoreCrewAsset("veteran-chief-engineer"))
  ];

  return Object.fromEntries(entries);
}

async function deleteDocuments(documents) {
  for (const document of documents.filter(Boolean).reverse()) {
    try {
      await document.delete();
    } catch (error) {
      console.warn(`Arcflight | Framework smoke test cleanup could not delete ${document.name ?? document.id}.`, error);
    }
  }
}

async function attemptDuplicateInstall(result, name, operation) {
  try {
    await operation();
    check(result, name, true, "no double-apply", "completed", "Duplicate install completed without increasing installed counts.");
  } catch (error) {
    check(result, name, true, "duplicate rejected", "rejected", error.message);
  }
}

/**
 * Run a temporary developer-facing smoke test against the current Arcflight framework.
 *
 * The helper creates throwaway world Items and a marked test vehicle actor when
 * needed. Source definitions are read but never mutated. Pass { cleanup: true }
 * to delete only documents created or marked by this helper.
 *
 * @param {{ cleanup?: boolean }} [options]
 * @returns {Promise<{passed: boolean, checks: Array, actorId: string, createdItemIds: string[]}>}
 */
export async function runFrameworkSmokeTest(options = {}) {
  const { cleanup = false } = options ?? {};
  const result = {
    passed: false,
    checks: [],
    actorId: "",
    createdItemIds: []
  };
  const createdItems = [];
  let actor = null;
  let deleteActorOnCleanup = false;

  try {
    check(result, "Core hull key array exists", isCoreKeyArray(CORE_HULL_PLATFORM_KEYS), "non-empty array", CORE_HULL_PLATFORM_KEYS?.length ?? 0);
    check(result, "Core arkengine key array exists", isCoreKeyArray(CORE_ARKENGINE_KEYS), "non-empty array", CORE_ARKENGINE_KEYS?.length ?? 0);
    check(result, "Core arkengine mod key array exists", isCoreKeyArray(CORE_ARKENGINE_MOD_KEYS), "non-empty array", CORE_ARKENGINE_MOD_KEYS?.length ?? 0);
    check(result, "Core room key array exists", isCoreKeyArray(CORE_ROOM_KEYS), "non-empty array", CORE_ROOM_KEYS?.length ?? 0);
    check(result, "Core ship upgrade key array exists", isCoreKeyArray(CORE_SHIP_UPGRADE_KEYS), "non-empty array", CORE_SHIP_UPGRADE_KEYS?.length ?? 0);
    check(result, "Core crew asset key array exists", isCoreKeyArray(CORE_CREW_ASSET_KEYS), "non-empty array", CORE_CREW_ASSET_KEYS?.length ?? 0);
    check(result, "Core station key array exists", isCoreKeyArray(STATION_KEYS), "non-empty array", STATION_KEYS?.length ?? 0);

    const componentItems = await createSmokeTestComponents(createdItems);
    result.createdItemIds = createdItems.map((item) => item?.id).filter(Boolean);
    check(result, "Created smoke test components", result.createdItemIds.length === 6, 6, result.createdItemIds.length);

    const actorResult = await ensureSmokeTestActor();
    actor = actorResult.actor;
    deleteActorOnCleanup = actorResult.created || actor.getFlag?.(ARCFLIGHT_MODULE_ID, SMOKE_TEST_FLAG) === true;
    result.actorId = actor?.id ?? "";
    check(result, "PF2E vehicle actor available", actor?.type === "vehicle", "vehicle", actor?.type ?? null, actorResult.created ? "Created test vehicle actor." : "Reused marked smoke test vehicle actor.");

    const arcflightFlags = getDefaultArcflightShipFlags();
    await actor.update({
      [`flags.${ARCFLIGHT_MODULE_ID}.enabled`]: arcflightFlags.enabled,
      [`flags.${ARCFLIGHT_MODULE_ID}.actorType`]: arcflightFlags.actorType,
      [`flags.${ARCFLIGHT_MODULE_ID}.system`]: arcflightFlags.system,
      [`flags.${ARCFLIGHT_MODULE_ID}.${SMOKE_TEST_FLAG}`]: true
    });
    check(result, "Arcflight enabled on vehicle", actor.getFlag(ARCFLIGHT_MODULE_ID, "enabled") === true, true, actor.getFlag(ARCFLIGHT_MODULE_ID, "enabled"));

    await installHull(actor, componentItems.hull);
    await installArkengine(actor, componentItems.arkengine);
    await installArkengineMod(actor, componentItems.arkengineMod);
    await installRoom(actor, componentItems.room);
    await installShipUpgrade(actor, componentItems.shipUpgrade);
    await addCrewAsset(actor, componentItems.crewAsset);

    const preservedCurrent = { hull: 120, lifeveil: 4, strain: 2, morale: 1 };
    await actor.update({
      [`flags.${ARCFLIGHT_MODULE_ID}.system.current`]: preservedCurrent
    });

    let shipData = getArcflightShipData(actor);
    const crewEntry = shipData.crew.namedCrew[0];
    await assignStation(actor, "engineer", crewEntry, { assigneeType: "crewAsset" });

    await attemptDuplicateInstall(result, "Duplicate arkengine mod install attempt", () => installArkengineMod(actor, componentItems.arkengineMod));
    await attemptDuplicateInstall(result, "Duplicate room install attempt", () => installRoom(actor, componentItems.room));
    await attemptDuplicateInstall(result, "Duplicate ship upgrade install attempt", () => installShipUpgrade(actor, componentItems.shipUpgrade));
    await attemptDuplicateInstall(result, "Duplicate crew asset install attempt", () => addCrewAsset(actor, componentItems.crewAsset));

    await recalculateShipStats(actor);
    shipData = getArcflightShipData(actor);

    checkEqual(result, "Installed arkengine mod count", 1, shipData.installed.arkengineMods.length);
    checkEqual(result, "Installed room count", 1, shipData.installed.rooms.length);
    checkEqual(result, "Installed ship upgrade count", 1, shipData.installed.shipUpgrades.length);
    checkEqual(result, "Named crew count", 1, shipData.crew.namedCrew.length);

    checkEqual(result, "Derived hull integrity", 180, shipData.derived.hullIntegrity, "Brigantine 160 + Reinforced Structural Ribbing 20.");
    checkEqual(result, "Derived strain capacity", 13, shipData.derived.strainCapacity, "Brigantine 10 + Tidewake 2 + Pressure Lattice Tuning 1.");
    checkEqual(result, "Derived voyage speed travel hex days", 5, shipData.derived.voyageSpeedTravelHexDays);

    checkEqual(result, "Room slots used", 1, shipData.installed.roomSlots.used);
    checkEqual(result, "Arkengine mod slots capacity", 4, shipData.installed.arkengineModSlots.capacity);
    checkEqual(result, "Arkengine mod slots used", 1, shipData.installed.arkengineModSlots.used);
    checkEqual(result, "Ship upgrade slots used", 1, shipData.installed.shipUpgradeSlots.used);
    checkEqual(result, "Room slots shape has available", 3, shipData.installed.roomSlots.available);
    checkEqual(result, "Arkengine mod slots shape has available", 3, shipData.installed.arkengineModSlots.available);
    checkEqual(result, "Ship upgrade slots shape has available", 2, shipData.installed.shipUpgradeSlots.available);

    checkEqual(result, "Current hull preserved", preservedCurrent.hull, shipData.current.hull);
    checkEqual(result, "Current lifeveil preserved", preservedCurrent.lifeveil, shipData.current.lifeveil);
    checkEqual(result, "Current strain preserved", preservedCurrent.strain, shipData.current.strain);
    checkEqual(result, "Current morale preserved", preservedCurrent.morale, shipData.current.morale);

    const engineerAssignment = shipData.stations.assignments.engineer;
    check(result, "Engineer station assignment exists", Boolean(engineerAssignment), "assignment", engineerAssignment?.name ?? null);
    await clearStationAssignment(actor, "engineer");
    shipData = getArcflightShipData(actor);
    checkEqual(result, "Engineer station assignment clears", null, shipData.stations.assignments.engineer);
  } catch (error) {
    check(result, "Smoke test threw unexpected error", false, "no unexpected error", error.message, error.stack ?? error.message);
    console.error("Arcflight | Framework smoke test failed with an unexpected error.", error);
  } finally {
    if (cleanup) {
      await deleteDocuments(createdItems);

      if (actor && deleteActorOnCleanup) {
        try {
          await actor.delete();
        } catch (error) {
          console.warn(`Arcflight | Framework smoke test cleanup could not delete ${actor.name}.`, error);
        }
      }
    }

    summarize(result);
  }

  return result;
}
