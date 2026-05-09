import { ARCFLIGHT_ITEM_DOCUMENT_TYPES, ARCFLIGHT_ITEM_TYPES } from "../config/constants.js";
import { arcflightItemDocumentClasses, ensureArcflightDocumentRegistration } from "./registration.js";

const arcflightSubtypeToDocumentType = Object.freeze({
  [ARCFLIGHT_ITEM_TYPES.HULL]: ARCFLIGHT_ITEM_DOCUMENT_TYPES.HULL,
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE]: ARCFLIGHT_ITEM_DOCUMENT_TYPES.ARKENGINE,
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD]: ARCFLIGHT_ITEM_DOCUMENT_TYPES.ARKENGINE_MOD,
  [ARCFLIGHT_ITEM_TYPES.WEAPON]: ARCFLIGHT_ITEM_DOCUMENT_TYPES.WEAPON,
  [ARCFLIGHT_ITEM_TYPES.ROOM]: ARCFLIGHT_ITEM_DOCUMENT_TYPES.ROOM,
  [ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE]: ARCFLIGHT_ITEM_DOCUMENT_TYPES.SHIP_UPGRADE,
  [ARCFLIGHT_ITEM_TYPES.CARGO]: ARCFLIGHT_ITEM_DOCUMENT_TYPES.CARGO,
  [ARCFLIGHT_ITEM_TYPES.CREW_ASSET]: ARCFLIGHT_ITEM_DOCUMENT_TYPES.CREW_ASSET
});

function getArcflightItemDocumentType(type) {
  if (arcflightItemDocumentClasses[type]) return type;
  const documentType = arcflightSubtypeToDocumentType[type];
  if (documentType) return documentType;

  throw new Error(`Arcflight | ${type} is not a registered Arcflight item type.`);
}

/**
 * Create an Arcflight item without patching core or PF2E document creation.
 *
 * This helper is intentionally explicit for PF2E worlds whose Create Item dialog
 * filters out module-provided Item sub-types even when Foundry can create them.
 *
 * @param {string} type Arcflight document type, such as "arcflight.hull", or subtype, such as "hull".
 * @param {object} [data]
 * @param {object} [operation]
 * @returns {Promise<Item|null>}
 */
export async function createArcflightItem(type, data = {}, operation = {}) {
  ensureArcflightDocumentRegistration();

  const documentType = getArcflightItemDocumentType(type);
  const DocumentClass = arcflightItemDocumentClasses[documentType];
  const defaultName = game.i18n?.localize?.(`TYPES.Item.${documentType}`) || documentType;
  const source = foundry.utils.mergeObject(
    {
      name: defaultName,
      type: documentType,
      system: DocumentClass.defaultSystemData()
    },
    data,
    { inplace: false }
  );

  source.type = documentType;

  return Item.create(source, operation);
}

export { getArcflightItemDocumentType };
