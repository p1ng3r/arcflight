import { ARCFLIGHT } from "./config/constants.js";
import { createArcflightDevTools } from "./dev/dev-tools.js";
import { runFrameworkSmokeTest } from "./dev/framework-smoke-test.js";
import {
  createArcflightItem,
  createArkengine,
  createArkengineMod,
  createCoreArkengine,
  createCoreArkengineMod,
  createCoreCrewAsset,
  createCoreHull,
  createCoreRoom,
  createCoreShipUpgrade,
  createCrewAsset,
  createHull,
  createRoom,
  createShipUpgrade,
  getArcflightItemDocumentType
} from "./documents/creation.js";
import { CORE_HULL_PLATFORM_KEYS, CORE_HULLS, getCoreHull, getCoreHullPlatformKeys } from "../data/hulls/core-hulls.js";
import { HULL_PATTERN_KEYS, HULL_PATTERNS, getHullPattern, getHullPatternKeys } from "../data/hulls/hull-patterns.js";
import { CORE_ARKENGINE_KEYS, CORE_ARKENGINES, getCoreArkengine, getCoreArkengineKeys } from "../data/arkengines/core-arkengines.js";
import { ARKENGINE_PATTERN_KEYS, ARKENGINE_PATTERNS, getArkenginePattern, getArkenginePatternKeys } from "../data/arkengines/arkengine-patterns.js";
import { CORE_ROOM_KEYS, CORE_ROOMS, getCoreRoom, getCoreRoomKeys } from "../data/rooms/core-rooms.js";
import { CORE_SHIP_UPGRADE_KEYS, CORE_SHIP_UPGRADES, getCoreShipUpgrade, getCoreShipUpgradeKeys } from "../data/ship-upgrades/core-ship-upgrades.js";
import { CORE_ARKENGINE_MOD_KEYS, CORE_ARKENGINE_MODS, getCoreArkengineMod, getCoreArkengineModKeys } from "../data/arkengine-mods/core-arkengine-mods.js";
import { CORE_STATIONS, STATION_KEYS, getStation, getStationKeys, getStations } from "../data/stations/core-stations.js";
import { CORE_CREW_ASSET_KEYS, CORE_CREW_ASSETS, getCoreCrewAsset, getCoreCrewAssetKeys } from "../data/crew/core-crew-assets.js";
import {
  ARKENGINE_VARIANT_KEYS,
  ARKENGINE_VARIANTS,
  getArkengineVariant,
  getArkengineVariantKeys,
  getArkengineVariants
} from "../data/arkengines/arkengine-variants.js";
import {
  arcflightComponentDefaults,
  getDefaultArcflightComponentData,
  getComponentData,
  getComponentType,
  isArcflightItem
} from "./documents/components.js";
import {
  ARCFLIGHT_SHIP_ACTOR_TYPE,
  arcflightShipDefaults,
  calculateDerivedShipStats,
  getArcflightShipData,
  addCrewAsset,
  assignStation,
  clearStationAssignment,
  getDefaultArcflightShipData,
  installArkengine,
  installArkengineMod,
  installArkengineModOnShip,
  installArkengineOnShip,
  installHull,
  installHullOnShip,
  installRoom,
  installRoomOnShip,
  installShipUpgrade,
  installShipUpgradeOnShip,
  recalculateShipStats,
  removeCrewAsset,
  setArkenginePattern,
  setHullPattern
} from "./documents/ships.js";
import { registerArcflightSheets } from "./sheets/registration.js";

function isArcflightVehicle(actor) {
  return actor?.type === "vehicle"
    && actor.getFlag?.(ARCFLIGHT.MODULE_ID, "enabled") === true
    && actor.getFlag?.(ARCFLIGHT.MODULE_ID, "actorType") === ARCFLIGHT_SHIP_ACTOR_TYPE;
}

async function setArcflightVehicleEnabled(actor, enabled = true) {
  if (actor?.type !== "vehicle" || typeof actor.setFlag !== "function") {
    throw new Error("Arcflight ships must be PF2E vehicle actors.");
  }

  if (!enabled) {
    return actor.setFlag(ARCFLIGHT.MODULE_ID, "enabled", false);
  }

  return actor.update({
    [`flags.${ARCFLIGHT.MODULE_ID}.enabled`]: true,
    [`flags.${ARCFLIGHT.MODULE_ID}.actorType`]: ARCFLIGHT_SHIP_ACTOR_TYPE,
    [`flags.${ARCFLIGHT.MODULE_ID}.system`]: getArcflightShipData(actor)
  });
}

Hooks.once("init", () => {
  console.log("Arcflight | Initializing module");

  CONFIG.arcflight = Object.freeze({
    constants: ARCFLIGHT,
    createItem: createArcflightItem,
    createCoreHull,
    createHull,
    createCoreArkengine,
    createCoreArkengineMod,
    createCoreCrewAsset,
    createArkengine,
    createArkengineMod,
    createCrewAsset,
    createCoreRoom,
    createRoom,
    createCoreShipUpgrade,
    createShipUpgrade,
    getCoreHull,
    getCoreArkengine,
    getCoreArkengineMod,
    getCoreCrewAsset,
    getCoreRoom,
    getCoreShipUpgrade,
    getCoreHullPlatformKeys,
    getCoreArkengineKeys,
    getHullPatternKeys,
    getHullPattern,
    getArkenginePatternKeys,
    getArkenginePattern,
    getCoreArkengineModKeys,
    getCoreCrewAssetKeys,
    getCoreRoomKeys,
    getCoreShipUpgradeKeys,
    getArkengineVariantKeys,
    getArkengineVariant,
    getArkengineVariants,
    getStationKeys,
    getStation,
    getStations,
    CORE_HULL_PLATFORM_KEYS,
    CORE_ARKENGINE_KEYS,
    HULL_PATTERN_KEYS,
    ARKENGINE_PATTERN_KEYS,
    CORE_ARKENGINE_MOD_KEYS,
    CORE_CREW_ASSET_KEYS,
    CORE_ROOM_KEYS,
    CORE_SHIP_UPGRADE_KEYS,
    ARKENGINE_VARIANT_KEYS,
    STATION_KEYS,
    coreHulls: CORE_HULLS,
    coreArkengines: CORE_ARKENGINES,
    hullPatterns: HULL_PATTERNS,
    arkenginePatterns: ARKENGINE_PATTERNS,
    coreArkengineMods: CORE_ARKENGINE_MODS,
    coreCrewAssets: CORE_CREW_ASSETS,
    coreRooms: CORE_ROOMS,
    coreShipUpgrades: CORE_SHIP_UPGRADES,
    arkengineVariants: ARKENGINE_VARIANTS,
    coreStations: CORE_STATIONS,
    coreHullPlatformKeys: CORE_HULL_PLATFORM_KEYS,
    coreArkengineKeys: CORE_ARKENGINE_KEYS,
    hullPatternKeys: HULL_PATTERN_KEYS,
    arkenginePatternKeys: ARKENGINE_PATTERN_KEYS,
    coreArkengineModKeys: CORE_ARKENGINE_MOD_KEYS,
    coreCrewAssetKeys: CORE_CREW_ASSET_KEYS,
    coreRoomKeys: CORE_ROOM_KEYS,
    coreShipUpgradeKeys: CORE_SHIP_UPGRADE_KEYS,
    arkengineVariantKeys: ARKENGINE_VARIANT_KEYS,
    stationKeys: STATION_KEYS,
    getItemDocumentType: getArcflightItemDocumentType,
    getDefaultComponentData: getDefaultArcflightComponentData,
    getDefaultShipData: getDefaultArcflightShipData,
    isArcflightItem,
    getComponentType,
    getComponentData,
    isArcflightVehicle,
    setArcflightVehicleEnabled,
    setHullPattern,
    setArkenginePattern,
    addCrewAsset,
    removeCrewAsset,
    installHull,
    installHullOnShip,
    installArkengine,
    installArkengineMod,
    installArkengineModOnShip,
    installArkengineOnShip,
    installRoom,
    installRoomOnShip,
    installShipUpgrade,
    installShipUpgradeOnShip,
    recalculateShipStats,
    calculateDerivedShipStats,
    assignStation,
    clearStationAssignment,
    assignShipStation: assignStation,
    clearShipStation: clearStationAssignment,
    runFrameworkSmokeTest,
    getShipData: getArcflightShipData,
    componentDefaults: arcflightComponentDefaults,
    shipDefaults: arcflightShipDefaults,
    devTools: createArcflightDevTools()
  });

  game.arcflight = CONFIG.arcflight;

  registerArcflightSheets().catch((error) => {
    console.warn("Arcflight | Sheet registration failed; continuing startup.", error);
  });
});

export {
  ARCFLIGHT,
  createArcflightItem,
  createCoreHull,
  createHull,
  createCoreArkengine,
  createCoreArkengineMod,
  createCoreCrewAsset,
  createArkengine,
  createArkengineMod,
  createCrewAsset,
  createCoreRoom,
  createRoom,
  createCoreShipUpgrade,
  createShipUpgrade,
  getCoreHull,
  getCoreArkengine,
  getCoreArkengineMod,
  getCoreCrewAsset,
  getCoreRoom,
  getCoreShipUpgrade,
  getCoreHullPlatformKeys,
  getCoreArkengineKeys,
  getHullPatternKeys,
  getHullPattern,
  getArkenginePatternKeys,
  getArkenginePattern,
  getCoreArkengineModKeys,
  getCoreCrewAssetKeys,
  getCoreRoomKeys,
  getCoreShipUpgradeKeys,
  getArkengineVariantKeys,
  getArkengineVariant,
  getArkengineVariants,
  getStationKeys,
  getStation,
  getStations,
  CORE_HULLS,
  CORE_ARKENGINES,
  HULL_PATTERNS,
  ARKENGINE_PATTERNS,
  CORE_ARKENGINE_MODS,
  CORE_CREW_ASSETS,
  CORE_ROOMS,
  CORE_SHIP_UPGRADES,
  ARKENGINE_VARIANTS,
  CORE_HULL_PLATFORM_KEYS,
  CORE_ARKENGINE_KEYS,
  HULL_PATTERN_KEYS,
  ARKENGINE_PATTERN_KEYS,
  CORE_ARKENGINE_MOD_KEYS,
  CORE_CREW_ASSET_KEYS,
  CORE_ROOM_KEYS,
  CORE_SHIP_UPGRADE_KEYS,
  ARKENGINE_VARIANT_KEYS,
  CORE_STATIONS,
  STATION_KEYS,
  addCrewAsset,
  removeCrewAsset,
  isArcflightVehicle,
  setArcflightVehicleEnabled,
  setHullPattern,
  setArkenginePattern,
  installArkengine,
  installArkengineMod,
  installArkengineModOnShip,
  installArkengineOnShip,
  installHull,
  installHullOnShip,
  installRoom,
  installRoomOnShip,
  installShipUpgrade,
  installShipUpgradeOnShip,
  recalculateShipStats,
  calculateDerivedShipStats,
  assignStation,
  clearStationAssignment,
  runFrameworkSmokeTest,
  getArcflightItemDocumentType,
  isArcflightItem,
  getComponentType,
  getComponentData,
  getDefaultArcflightComponentData,
  arcflightComponentDefaults,
  ARCFLIGHT_SHIP_ACTOR_TYPE,
  arcflightShipDefaults,
  getArcflightShipData,
  getDefaultArcflightShipData
};
