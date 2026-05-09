import { ARCFLIGHT_ITEM_TYPES, ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import { getCoreHull } from "../../data/hulls/core-hulls.js";
import { getCoreArkengine } from "../../data/arkengines/core-arkengines.js";
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
  const arcflightFlagData = getDefaultArcflightComponentFlags(normalizedType, fullComponentSystem);

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
  source.flags[ARCFLIGHT_MODULE_ID].system = arcflightFlagData.system;

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
    name: hullData.platform,
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

export const createArkengine = createCoreArkengine;

export const createHull = createCoreHull;

export { getArcflightItemDocumentType };
