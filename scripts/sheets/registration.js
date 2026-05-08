import { ARCFLIGHT_MODULE_ID, ARCFLIGHT_ACTOR_DOCUMENT_TYPES, ARCFLIGHT_ITEM_DOCUMENT_TYPES } from "../config/constants.js";
import { ArcflightItemSheet } from "./item-sheet.js";
import { ShipSheet } from "./ship-sheet.js";

/** Register Arcflight sheet foundations without changing non-Arcflight PF2E sheets. */
export function registerArcflightSheets() {
  foundry.documents.collections.Actors.registerSheet(ARCFLIGHT_MODULE_ID, ShipSheet, {
    types: [ARCFLIGHT_ACTOR_DOCUMENT_TYPES.SHIP],
    makeDefault: true,
    label: "Arcflight Ship Sheet"
  });

  foundry.documents.collections.Items.registerSheet(ARCFLIGHT_MODULE_ID, ArcflightItemSheet, {
    types: Object.values(ARCFLIGHT_ITEM_DOCUMENT_TYPES),
    makeDefault: true,
    label: "Arcflight Item Sheet"
  });
}

export { ArcflightItemSheet, ShipSheet };
