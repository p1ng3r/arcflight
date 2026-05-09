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

const proxyCache = new WeakMap();
const proxyMetadata = new WeakMap();

function getProxyTarget(DocumentClass) {
  return proxyMetadata.get(DocumentClass)?.target ?? DocumentClass;
}

function getExistingTypeOptions(options) {
  return Array.isArray(options?.types) ? options.types : options?.types ? [options.types] : [];
}

function getKnownDocumentTypes(documentName) {
  const typeLabels = globalThis.CONFIG?.[documentName]?.typeLabels;
  if (typeLabels && typeof typeLabels === "object") return Object.keys(typeLabels);

  const pf2eDocumentClasses = getPf2eDocumentClasses(documentName);
  if (pf2eDocumentClasses) return Object.keys(pf2eDocumentClasses);

  const dataModels = globalThis.CONFIG?.[documentName]?.dataModels;
  return dataModels && typeof dataModels === "object" ? Object.keys(dataModels) : [];
}

function createDialogWithArcflightTypes(documentName, createDialog, arcflightClasses) {
  return function arcflightCreateDialog(data, createOptions, options = {}, renderOptions = {}) {
    registerPf2eDocumentClasses(documentName, arcflightClasses);
    const existingTypes = getExistingTypeOptions(options);
    if (existingTypes.length > 0) return createDialog.call(this, data, createOptions, options, renderOptions);

    const arcflightTypes = Object.keys(arcflightClasses);
    const baseTypes = getKnownDocumentTypes(documentName);

    return createDialog.call(
      this,
      data,
      createOptions,
      {
        ...options,
        types: Array.from(new Set([...baseTypes, ...arcflightTypes]))
      },
      renderOptions
    );
  };
}

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
 * Build a Foundry document implementation proxy which dispatches Arcflight
 * module sub-types to their specific Arcflight classes while preserving the
 * active system's implementation for every non-Arcflight document type.
 *
 * @param {"Actor"|"Item"} documentName
 * @param {typeof foundry.abstract.Document} fallbackClass
 * @param {Record<string, typeof foundry.abstract.Document>} arcflightClasses
 * @returns {typeof foundry.abstract.Document}
 */
function createArcflightDocumentProxy(documentName, fallbackClass, arcflightClasses) {
  const existingMetadata = proxyMetadata.get(fallbackClass);
  if (existingMetadata?.documentName === documentName) return fallbackClass;

  const targetClass = getProxyTarget(fallbackClass);
  const cachedProxy = proxyCache.get(targetClass);
  if (cachedProxy) return cachedProxy;

  const proxy = new Proxy(targetClass, {
    construct(target, args) {
      const [data] = args;
      registerPf2eDocumentClasses(documentName, arcflightClasses);

      const DocumentClass = arcflightClasses[data?.type] ?? target;
      return Reflect.construct(DocumentClass, args, DocumentClass);
    },

    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);

      if ((property === "create" || property === "createDocuments") && typeof value === "function") {
        return function arcflightCreateWithRegisteredPf2eClasses(...args) {
          registerPf2eDocumentClasses(documentName, arcflightClasses);
          return value.apply(this, args);
        };
      }

      if (property !== "createDialog" || typeof value !== "function") return value;

      return createDialogWithArcflightTypes(documentName, value, arcflightClasses);
    }
  });

  proxyCache.set(targetClass, proxy);
  proxyMetadata.set(proxy, { documentName, target: targetClass });
  return proxy;
}

/** Register Arcflight document class dispatch for Foundry v13. */
export function registerArcflightDocumentClasses() {
  const itemDocumentClasses = Object.fromEntries(
    Object.entries(arcflightItemDocumentClasses).filter(([documentType, DocumentClass]) => {
      const valid = isDocumentClassForName("Item", DocumentClass);
      if (!valid) {
        console.warn(`Arcflight | Refusing to register ${documentType} in CONFIG.Item.documentClass because it is not an Item document class.`);
      }
      return valid;
    })
  );

  const itemConfig = globalThis.CONFIG?.Item;
  if (!itemConfig?.documentClass) return;

  const currentItemDocumentClass = itemConfig.documentClass;
  const nextItemDocumentClass = createArcflightDocumentProxy("Item", currentItemDocumentClass, itemDocumentClasses);
  if (nextItemDocumentClass !== currentItemDocumentClass) itemConfig.documentClass = nextItemDocumentClass;
}

/** Ensure all Arcflight document registrations are in place for the current startup phase. */
export function ensureArcflightDocumentRegistration() {
  const pf2eRegistration = registerArcflightPf2eDocumentClasses();
  registerArcflightDocumentClasses();
  return pf2eRegistration;
}

/** Register Arcflight document classes with PF2E's type-specific document registries when present. */
export function registerArcflightPf2eDocumentClasses() {
  const itemRegistered = registerPf2eDocumentClasses("Item", arcflightItemDocumentClasses);

  return {
    Actor: false,
    Item: itemRegistered
  };
}
