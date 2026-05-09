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

function getPf2eDocumentClasses(documentName) {
  const pf2eDocumentConfig = globalThis.CONFIG?.PF2E?.[documentName];
  const documentClasses = pf2eDocumentConfig?.documentClasses;
  return documentClasses && typeof documentClasses === "object" ? documentClasses : null;
}

function getCoreDocumentClass(documentName) {
  return documentName === "Item" ? globalThis.Item : globalThis.Actor;
}

function isDocumentClassForName(documentName, DocumentClass) {
  const CoreDocumentClass = getCoreDocumentClass(documentName);

  return (
    typeof DocumentClass === "function" &&
    typeof CoreDocumentClass === "function" &&
    (DocumentClass === CoreDocumentClass || DocumentClass.prototype instanceof CoreDocumentClass)
  );
}

function registerPf2eDocumentClasses(documentName, arcflightClasses) {
  const documentClasses = getPf2eDocumentClasses(documentName);
  if (!documentClasses) {
    console.debug(`Arcflight | PF2E ${documentName}.documentClasses registry not found; skipping PF2E-specific ${documentName} registration.`);
    return false;
  }

  for (const [documentType, DocumentClass] of Object.entries(arcflightClasses)) {
    if (!isDocumentClassForName(documentName, DocumentClass)) {
      console.warn(`Arcflight | Refusing to register ${documentType} in PF2E ${documentName}.documentClasses because it is not a ${documentName} document class.`);
      continue;
    }

    const existingClass = documentClasses[documentType];

    if (existingClass === DocumentClass) continue;

    if (existingClass) {
      console.warn(`Arcflight | PF2E ${documentName} document class for ${documentType} already exists; leaving existing class in place.`);
      continue;
    }

    if (!Object.isExtensible(documentClasses)) {
      console.warn(`Arcflight | PF2E ${documentName}.documentClasses is not extensible; skipping ${documentType} registration.`);
      continue;
    }

    try {
      documentClasses[documentType] = DocumentClass;
    } catch (error) {
      console.warn(`Arcflight | Could not register PF2E ${documentName} document class for ${documentType}; skipping PF2E-specific registration.`, error);
    }
  }

  return true;
}

/**
 * Static Arcflight document class registration for Foundry v13/PF2E.
 *
 * Arcflight intentionally does not replace CONFIG.Item.documentClass and does
 * not wrap Item.create or Item.createDocuments. Supported Arcflight item types
 * come from module.json documentTypes, CONFIG.Item.dataModels, and PF2E's
 * type-specific documentClasses registry when PF2E exposes it safely.
 */
export function registerArcflightDocumentClasses() {
  return registerArcflightPf2eDocumentClasses();
}

/** Ensure all Arcflight document registrations are in place for the current startup phase. */
export function ensureArcflightDocumentRegistration() {
  return registerArcflightPf2eDocumentClasses();
}

/** Register Arcflight document classes with PF2E's type-specific document registries when present. */
export function registerArcflightPf2eDocumentClasses() {
  const itemRegistered = registerPf2eDocumentClasses("Item", arcflightItemDocumentClasses);

  return {
    Actor: false,
    Item: itemRegistered
  };
}
