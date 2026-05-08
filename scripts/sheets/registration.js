import { ARCFLIGHT_MODULE_ID, ARCFLIGHT_ACTOR_DOCUMENT_TYPES, ARCFLIGHT_ITEM_DOCUMENT_TYPES } from "../config/constants.js";

export let ArcflightItemSheet;
export let ShipSheet;

async function loadArcflightSheetClasses() {
  const [{ ArcflightItemSheet: ItemSheetClass }, { ShipSheet: ShipSheetClass }] = await Promise.all([
    import("./item-sheet.js"),
    import("./ship-sheet.js")
  ]);

  ArcflightItemSheet = ItemSheetClass;
  ShipSheet = ShipSheetClass;

  return { ArcflightItemSheet, ShipSheet };
}

/** Register Arcflight sheet foundations without changing non-Arcflight PF2E sheets. */
export async function registerArcflightSheets() {
  const { ArcflightItemSheet: ItemSheetClass, ShipSheet: ShipSheetClass } = await loadArcflightSheetClasses();

  foundry.documents.collections.Actors.registerSheet(ARCFLIGHT_MODULE_ID, ShipSheetClass, {
    types: [ARCFLIGHT_ACTOR_DOCUMENT_TYPES.SHIP],
    makeDefault: true,
    label: "Arcflight Ship Sheet"
  });

  foundry.documents.collections.Items.registerSheet(ARCFLIGHT_MODULE_ID, ItemSheetClass, {
    types: Object.values(ARCFLIGHT_ITEM_DOCUMENT_TYPES),
    makeDefault: true,
    label: "Arcflight Item Sheet"
  });

  return { ArcflightItemSheet: ItemSheetClass, ShipSheet: ShipSheetClass };
}
