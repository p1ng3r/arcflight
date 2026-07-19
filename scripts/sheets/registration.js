import { ARCFLIGHT_MODULE_ID } from "../config/constants.js";

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

function getDocumentSheetConfig() {
  const documentSheetConfig = foundry?.applications?.apps?.DocumentSheetConfig;
  return typeof documentSheetConfig?.registerSheet === "function" ? documentSheetConfig : null;
}

function pf2eVehicleActorsAvailable() {
  const actorTypes = CONFIG?.Actor?.typeLabels ? Object.keys(CONFIG.Actor.typeLabels) : [];
  const pf2eActorClasses = CONFIG?.PF2E?.Actor?.documentClasses;

  return actorTypes.includes(PF2E_VEHICLE_ACTOR_TYPE) || Boolean(pf2eActorClasses?.[PF2E_VEHICLE_ACTOR_TYPE]);
}

/** Register Arcflight sheet foundations without changing non-Arcflight PF2E sheets. */
export async function registerArcflightSheets() {
  const registered = {};

  const documentSheetConfig = getDocumentSheetConfig();
  const ActorDocument = foundry?.documents?.Actor;
  if (documentSheetConfig && ActorDocument && pf2eVehicleActorsAvailable()) {
    try {
      const ShipSheetClass = await loadArcflightShipSheetClass();
      documentSheetConfig.registerSheet(ActorDocument, ARCFLIGHT_MODULE_ID, ShipSheetClass, {
        types: [PF2E_VEHICLE_ACTOR_TYPE],
        makeDefault: false,
        label: "Arcflight Ship Sheet"
      });
      registered.ArcflightShipSheet = ShipSheetClass;
    } catch (error) {
      console.warn("Arcflight | Could not register the optional PF2E vehicle sheet; continuing startup.", error);
    }
  } else {
    console.debug("Arcflight | Foundry v14 document sheet registration API or PF2E vehicle support not available; skipping Arcflight ship sheet registration.");
  }

  const ItemDocument = foundry?.documents?.Item;
  if (documentSheetConfig && ItemDocument) {
    try {
      const ItemSheetClass = await loadArcflightItemSheetClass();
      documentSheetConfig.registerSheet(ItemDocument, ARCFLIGHT_MODULE_ID, ItemSheetClass, {
        types: ["equipment"],
        makeDefault: false,
        label: "Arcflight Component Sheet"
      });
      registered.ArcflightItemSheet = ItemSheetClass;
    } catch (error) {
      console.warn("Arcflight | Could not register Arcflight item sheets; continuing startup.", error);
    }
  } else {
    console.debug("Arcflight | Foundry v14 item document sheet registration API not available; skipping Arcflight item sheet registration.");
  }

  return registered;
}
