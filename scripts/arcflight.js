import { ARCFLIGHT } from "./config/constants.js";
import { createArcflightDevTools } from "./dev/dev-tools.js";
import { createArcflightItem, createCoreHull, createHull, getArcflightItemDocumentType } from "./documents/creation.js";
import { CORE_HULL_PLATFORM_KEYS, CORE_HULLS, getCoreHull, getCoreHullPlatformKeys } from "../data/hulls/core-hulls.js";
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
  getDefaultArcflightShipData,
  installHull,
  installHullOnShip,
  recalculateShipStats
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

  const existingShipData = actor.getFlag(ARCFLIGHT.MODULE_ID, "system") ?? {};

  return actor.update({
    [`flags.${ARCFLIGHT.MODULE_ID}.enabled`]: true,
    [`flags.${ARCFLIGHT.MODULE_ID}.actorType`]: ARCFLIGHT_SHIP_ACTOR_TYPE,
    [`flags.${ARCFLIGHT.MODULE_ID}.system`]: foundry.utils.mergeObject(
      getDefaultArcflightShipData(),
      foundry.utils.deepClone(existingShipData),
      { inplace: false }
    )
  });
}

Hooks.once("init", () => {
  console.log("Arcflight | Initializing module");

  CONFIG.arcflight = Object.freeze({
    constants: ARCFLIGHT,
    createItem: createArcflightItem,
    createCoreHull,
    createHull,
    getCoreHull,
    getCoreHullPlatformKeys,
    CORE_HULL_PLATFORM_KEYS,
    coreHulls: CORE_HULLS,
    coreHullPlatformKeys: CORE_HULL_PLATFORM_KEYS,
    getItemDocumentType: getArcflightItemDocumentType,
    getDefaultComponentData: getDefaultArcflightComponentData,
    getDefaultShipData: getDefaultArcflightShipData,
    isArcflightItem,
    getComponentType,
    getComponentData,
    isArcflightVehicle,
    setArcflightVehicleEnabled,
    installHull,
    installHullOnShip,
    recalculateShipStats,
    calculateDerivedShipStats,
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
  getCoreHull,
  getCoreHullPlatformKeys,
  CORE_HULLS,
  CORE_HULL_PLATFORM_KEYS,
  isArcflightVehicle,
  setArcflightVehicleEnabled,
  installHull,
  installHullOnShip,
  recalculateShipStats,
  calculateDerivedShipStats,
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
