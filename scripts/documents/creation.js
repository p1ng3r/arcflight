import { ARCFLIGHT_MODULE_ID } from "../config/constants.js";
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

export { getArcflightItemDocumentType };
