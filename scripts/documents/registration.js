import { ARCFLIGHT_ITEM_DOCUMENT_TYPES } from "../config/constants.js";
import { ArkengineItem } from "./arkengine-item.js";
import { ArkengineModItem } from "./arkengine-mod-item.js";
import { CargoItem } from "./cargo-item.js";
import { CrewAssetItem } from "./crew-item.js";
import { HullItem } from "./hull-item.js";
import { RoomItem } from "./room-item.js";
import { ShipUpgradeItem } from "./ship-upgrade-item.js";
import { WeaponItem } from "./weapon-item.js";

export const arcflightActorDocumentClasses = Object.freeze({});

export const arcflightItemDocumentClasses = Object.freeze({
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.HULL]: HullItem,
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.ARKENGINE]: ArkengineItem,
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.ARKENGINE_MOD]: ArkengineModItem,
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.WEAPON]: WeaponItem,
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.ROOM]: RoomItem,
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.SHIP_UPGRADE]: ShipUpgradeItem,
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.CARGO]: CargoItem,
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.CREW_ASSET]: CrewAssetItem
});

/**
 * Arcflight Phase 0 stores components on PF2E equipment items instead of
 * registering live custom Item sub-types. This avoids PF2E type-dispatch
 * recursion without monkey-patching Item.create or Item.createDocuments.
 */
export function registerArcflightDocumentClasses() {
  return registerArcflightPf2eDocumentClasses();
}

/** Ensure all Arcflight document registrations are in place for the current startup phase. */
export function ensureArcflightDocumentRegistration() {
  return registerArcflightPf2eDocumentClasses();
}

/** Do not register Arcflight item classes with PF2E's live document registry during Phase 0. */
export function registerArcflightPf2eDocumentClasses() {
  return {
    Actor: false,
    Item: false
  };
}
