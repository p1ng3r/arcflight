import { ARCFLIGHT_ACTOR_DOCUMENT_TYPES, ARCFLIGHT_ITEM_DOCUMENT_TYPES } from "../config/constants.js";
import { ArkengineItem } from "./arkengine-item.js";
import { ArkengineModItem } from "./arkengine-mod-item.js";
import { CargoItem } from "./cargo-item.js";
import { CrewAssetItem } from "./crew-item.js";
import { HullItem } from "./hull-item.js";
import { RoomItem } from "./room-item.js";
import { ShipActor } from "./ship-actor.js";
import { ShipUpgradeItem } from "./ship-upgrade-item.js";
import { WeaponItem } from "./weapon-item.js";

export const arcflightActorDocumentClasses = Object.freeze({
  [ARCFLIGHT_ACTOR_DOCUMENT_TYPES.SHIP]: ShipActor
});

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

const proxyCache = new WeakMap();

/**
 * Build a Foundry document implementation proxy which dispatches Arcflight
 * module sub-types to their specific Arcflight classes while preserving the
 * active system's implementation for every non-Arcflight document type.
 *
 * @param {typeof foundry.abstract.Document} fallbackClass
 * @param {Record<string, typeof foundry.abstract.Document>} arcflightClasses
 * @returns {typeof foundry.abstract.Document}
 */
function createArcflightDocumentProxy(fallbackClass, arcflightClasses) {
  const cachedProxy = proxyCache.get(fallbackClass);
  if (cachedProxy) return cachedProxy;

  const proxy = new Proxy(fallbackClass, {
    construct(target, args) {
      const [data] = args;
      const DocumentClass = arcflightClasses[data?.type] ?? target;
      return Reflect.construct(DocumentClass, args, DocumentClass);
    }
  });

  proxyCache.set(fallbackClass, proxy);
  return proxy;
}

/** Register Arcflight document class dispatch for Foundry v13. */
export function registerArcflightDocumentClasses() {
  CONFIG.Actor.documentClass = createArcflightDocumentProxy(CONFIG.Actor.documentClass, arcflightActorDocumentClasses);
  CONFIG.Item.documentClass = createArcflightDocumentProxy(CONFIG.Item.documentClass, arcflightItemDocumentClasses);
}
