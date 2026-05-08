import { ARCFLIGHT_ITEM_DOCUMENT_TYPES, ARCFLIGHT_MODULE_ID } from "../config/constants.js";

const PF2E_VEHICLE_ACTOR_TYPE = "vehicle";

export let ArcflightItemSheet;
export let ArcflightShipSheet;

async function loadArcflightItemSheetClass() {
  const { ArcflightItemSheet: ItemSheetClass } = await import("./item-sheet.js");
  ArcflightItemSheet = ItemSheetClass;
  return ItemSheetClass;
}

async function loadArcflightShipSheetClass() {
  const { ArcflightShipSheet: ShipSheetClass } = await import("./ship-sheet.js");
  ArcflightShipSheet = ShipSheetClass;
  return ShipSheetClass;
}

function getSheetRegistry(collectionName) {
  const collection = foundry?.documents?.collections?.[collectionName];
  return typeof collection?.registerSheet === "function" ? collection : null;
}

function pf2eVehicleActorsAvailable() {
  const actorTypes = CONFIG?.Actor?.typeLabels ? Object.keys(CONFIG.Actor.typeLabels) : [];
  const pf2eActorClasses = CONFIG?.PF2E?.Actor?.documentClasses;

  return actorTypes.includes(PF2E_VEHICLE_ACTOR_TYPE) || Boolean(pf2eActorClasses?.[PF2E_VEHICLE_ACTOR_TYPE]);
}

/** Register Arcflight sheet foundations without changing non-Arcflight PF2E sheets. */
export async function registerArcflightSheets() {
  const registered = {};

  const actors = getSheetRegistry("Actors");
  if (actors && pf2eVehicleActorsAvailable()) {
    try {
      const ShipSheetClass = await loadArcflightShipSheetClass();
      actors.registerSheet(ARCFLIGHT_MODULE_ID, ShipSheetClass, {
        types: [PF2E_VEHICLE_ACTOR_TYPE],
        makeDefault: false,
        label: "Arcflight Ship Sheet"
      });
      registered.ArcflightShipSheet = ShipSheetClass;
    } catch (error) {
      console.warn("Arcflight | Could not register the optional PF2E vehicle sheet; continuing startup.", error);
    }
  } else {
    console.debug("Arcflight | PF2E vehicle actor sheet registry not available; skipping Arcflight ship sheet registration.");
  }

  const items = getSheetRegistry("Items");
  if (items) {
    try {
      const ItemSheetClass = await loadArcflightItemSheetClass();
      items.registerSheet(ARCFLIGHT_MODULE_ID, ItemSheetClass, {
        types: Object.values(ARCFLIGHT_ITEM_DOCUMENT_TYPES),
        makeDefault: true,
        label: "Arcflight Item Sheet"
      });
      registered.ArcflightItemSheet = ItemSheetClass;
    } catch (error) {
      console.warn("Arcflight | Could not register Arcflight item sheets; continuing startup.", error);
    }
  }

  return registered;
}
