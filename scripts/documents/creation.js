import { ARCFLIGHT_ITEM_TYPES, ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import { getCoreHull } from "../../data/hulls/core-hulls.js";
import { getCoreArkengine } from "../../data/arkengines/core-arkengines.js";
import { getCoreRoom } from "../../data/rooms/core-rooms.js";
import { getCoreShipUpgrade } from "../../data/ship-upgrades/core-ship-upgrades.js";
import { getCoreArkengineMod } from "../../data/arkengine-mods/core-arkengine-mods.js";
import { getCoreCrewAsset } from "../../data/crew/core-crew-assets.js";
import { getCoreWeapon } from "../../data/weapons/core-weapons.js";
import {
  ARCFLIGHT_COMPONENT_ITEM_TYPE,
  arcflightComponentTypeLabels,
  getDefaultArcflightComponentFlags,
  normalizeArcflightComponentType
} from "./components.js";

function getArcflightItemDocumentType(type) {
  normalizeArcflightComponentType(type);
  return ARCFLIGHT_COMPONENT_ITEM_TYPE;
}

/**
 * Create an Arcflight component as a PF2E equipment item.
 *
 * Arcflight component data is stored under flags.arcflight.system so PF2E owns
 * the equipment item's normal system data and normal PF2E equipment remains
 * unaffected.
 *
 * @param {string} componentType Arcflight component type, such as "hull" or "weapon".
 * @param {object} [data]
 * @param {object} [operation]
 * @returns {Promise<Item|null>}
 */
export async function createArcflightItem(componentType, data = {}, operation = {}) {
  const normalizedType = normalizeArcflightComponentType(componentType);
  const { flags = {}, system: componentSystem = {}, ...itemData } = data ?? {};
  const providedArcflightFlags = flags?.[ARCFLIGHT_MODULE_ID] ?? {};
  const providedFlagSystem = providedArcflightFlags.system ?? {};
  const fullComponentSystem = foundry.utils.mergeObject(componentSystem, providedFlagSystem, { inplace: false });
  const arcflightFlagData = getDefaultArcflightComponentFlags(normalizedType, deepCloneData(fullComponentSystem));

  const source = foundry.utils.mergeObject(
    {
      name: arcflightComponentTypeLabels[normalizedType] ?? `Arcflight ${normalizedType}`,
      type: ARCFLIGHT_COMPONENT_ITEM_TYPE,
      flags: {
        ...flags,
        [ARCFLIGHT_MODULE_ID]: foundry.utils.mergeObject(arcflightFlagData, providedArcflightFlags, { inplace: false })
      }
    },
    itemData,
    { inplace: false }
  );

  source.type = ARCFLIGHT_COMPONENT_ITEM_TYPE;
  source.flags[ARCFLIGHT_MODULE_ID].enabled = true;
  source.flags[ARCFLIGHT_MODULE_ID].componentType = normalizedType;
  source.flags[ARCFLIGHT_MODULE_ID].system = deepCloneData(arcflightFlagData.system);

  return Item.create(source, operation);
}

function deepCloneData(data) {
  if (typeof foundry !== "undefined" && foundry.utils?.deepClone) return foundry.utils.deepClone(data);
  return structuredClone(data);
}

/**
 * Create one of Arcflight's locked Phase 2 core hulls as a PF2E equipment item.
 *
 * @param {string} platformKey Lower-case kebab-case core hull platform key.
 * @param {object} [operation]
 * @returns {Promise<Item|null>}
 */
export async function createCoreHull(platformKey, operation = {}) {
  const hullData = getCoreHull(platformKey);
  if (!hullData) {
    throw new Error(`Arcflight | ${platformKey} is not a supported core hull platform.`);
  }

  return createArcflightItem(ARCFLIGHT_ITEM_TYPES.HULL, {
    name: hullData.displayName ?? hullData.platform,
    system: deepCloneData(hullData)
  }, operation);
}

/**
 * Create one of Arcflight's locked Phase 3 core arkengines as a PF2E equipment item.
 *
 * @param {string} engineKey Lower-case kebab-case core arkengine key.
 * @param {object} [operation]
 * @returns {Promise<Item|null>}
 */
export async function createCoreArkengine(engineKey, operation = {}) {
  const arkengineData = getCoreArkengine(engineKey);
  if (!arkengineData) {
    throw new Error(`Arcflight | ${engineKey} is not a supported core arkengine.`);
  }

  return createArcflightItem(ARCFLIGHT_ITEM_TYPES.ARKENGINE, {
    name: arkengineData.displayName,
    system: deepCloneData(arkengineData)
  }, operation);
}


/**
 * Create one of Arcflight's Phase 4 room framework entries as a PF2E equipment item.
 *
 * @param {string} roomKey Lower-case kebab-case room key.
 * @param {object} [operation]
 * @returns {Promise<Item|null>}
 */
export async function createCoreRoom(roomKey, operation = {}) {
  const roomData = getCoreRoom(roomKey);
  if (!roomData) {
    throw new Error(`Arcflight | ${roomKey} is not a supported core room.`);
  }

  return createArcflightItem(ARCFLIGHT_ITEM_TYPES.ROOM, {
    name: roomData.identity?.displayName ?? roomKey,
    system: deepCloneData(roomData)
  }, operation);
}

/**
 * Create one of Arcflight's Phase 4.5 standard ship upgrade entries as a PF2E equipment item.
 *
 * @param {string} upgradeKey Lower-case kebab-case ship upgrade key.
 * @param {object} [operation]
 * @returns {Promise<Item|null>}
 */
export async function createCoreShipUpgrade(upgradeKey, operation = {}) {
  const upgradeData = getCoreShipUpgrade(upgradeKey);
  if (!upgradeData) {
    throw new Error(`Arcflight | ${upgradeKey} is not a supported core ship upgrade.`);
  }

  return createArcflightItem(ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE, {
    name: upgradeData.identity?.displayName ?? upgradeKey,
    system: deepCloneData(upgradeData)
  }, operation);
}

/**
 * Create one of Arcflight's Phase 4 core arkengine mods as a PF2E equipment item.
 *
 * @param {string} modKey Lower-case kebab-case arkengine mod key.
 * @param {object} [operation]
 * @returns {Promise<Item|null>}
 */
export async function createCoreArkengineMod(modKey, operation = {}) {
  const modData = getCoreArkengineMod(modKey);
  if (!modData) {
    throw new Error(`Arcflight | ${modKey} is not a supported core arkengine mod.`);
  }

  return createArcflightItem(ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD, {
    name: modData.identity?.displayName ?? modKey,
    system: deepCloneData(modData)
  }, operation);
}

/**
 * Create one of Arcflight's core weapon entries as a PF2E equipment item.
 *
 * @param {string} weaponKey Lower-case kebab-case weapon key.
 * @param {object} [operation]
 * @returns {Promise<Item|null>}
 */
export async function createCoreWeapon(weaponKey, operation = {}) {
  const weaponData = getCoreWeapon(weaponKey);
  if (!weaponData) {
    throw new Error(`Arcflight | ${weaponKey} is not a supported core weapon.`);
  }

  return createArcflightItem(ARCFLIGHT_ITEM_TYPES.WEAPON, {
    name: weaponData.name ?? weaponData.key ?? weaponKey,
    system: deepCloneData(weaponData)
  }, operation);
}

/**
 * Create one of Arcflight's Phase 7 core crew assets as a PF2E equipment item.
 *
 * @param {string} crewAssetKey Lower-case kebab-case crew asset key.
 * @param {object} [operation]
 * @returns {Promise<Item|null>}
 */
export async function createCoreCrewAsset(crewAssetKey, operation = {}) {
  const crewAssetData = getCoreCrewAsset(crewAssetKey);
  if (!crewAssetData) {
    throw new Error(`Arcflight | ${crewAssetKey} is not a supported core crew asset.`);
  }

  return createArcflightItem(ARCFLIGHT_ITEM_TYPES.CREW_ASSET, {
    name: crewAssetData.identity?.displayName ?? crewAssetKey,
    system: deepCloneData(crewAssetData)
  }, operation);
}

export const createArkengine = createCoreArkengine;
export const createArkengineMod = createCoreArkengineMod;
export const createCrewAsset = createCoreCrewAsset;
export const createHull = createCoreHull;
export const createWeapon = createCoreWeapon;
export const createRoom = createCoreRoom;
export const createShipUpgrade = createCoreShipUpgrade;

export { getArcflightItemDocumentType };
