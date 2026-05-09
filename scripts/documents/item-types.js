import { ARCFLIGHT_ITEM_DOCUMENT_TYPES } from "../config/constants.js";

export const arcflightItemTypeLabels = Object.freeze({
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.HULL]: "TYPES.Item.arcflight.hull",
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.ARKENGINE]: "TYPES.Item.arcflight.arkengine",
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.ARKENGINE_MOD]: "TYPES.Item.arcflight.arkengineMod",
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.WEAPON]: "TYPES.Item.arcflight.weapon",
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.ROOM]: "TYPES.Item.arcflight.room",
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.SHIP_UPGRADE]: "TYPES.Item.arcflight.shipUpgrade",
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.CARGO]: "TYPES.Item.arcflight.cargo",
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.CREW_ASSET]: "TYPES.Item.arcflight.crewAsset"
});

/** Ensure Arcflight module item sub-types have Foundry type labels for item creation UIs. */
export function registerArcflightItemTypeLabels() {
  const typeLabels = globalThis.CONFIG?.Item?.typeLabels;
  if (!typeLabels || typeof typeLabels !== "object") {
    console.debug("Arcflight | CONFIG.Item.typeLabels is not available; skipping Arcflight item type labels.");
    return false;
  }

  if (!Object.isExtensible(typeLabels)) {
    console.warn("Arcflight | CONFIG.Item.typeLabels is not extensible; Arcflight item types may not appear in the Create Item dialog.");
    return false;
  }

  for (const [documentType, label] of Object.entries(arcflightItemTypeLabels)) {
    if (!typeLabels[documentType]) typeLabels[documentType] = label;
  }

  return true;
}
