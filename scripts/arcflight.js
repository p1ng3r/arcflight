import { ARCFLIGHT } from "./config/constants.js";
import { ArcflightItem } from "./documents/arcflight-item.js";
import {
  arcflightActorDataModels,
  arcflightItemDataModels,
  registerArcflightDataModels
} from "./documents/data-models.js";
import { ArkengineItem } from "./documents/arkengine-item.js";
import { ArkengineModItem } from "./documents/arkengine-mod-item.js";
import { CargoItem } from "./documents/cargo-item.js";
import { CrewAssetItem, CrewItem } from "./documents/crew-item.js";
import { HullItem } from "./documents/hull-item.js";
import { RoomItem } from "./documents/room-item.js";
import {
  arcflightActorDocumentClasses,
  arcflightItemDocumentClasses,
  registerArcflightDocumentClasses,
  registerArcflightPf2eDocumentClasses
} from "./documents/registration.js";
import { ShipUpgradeItem } from "./documents/ship-upgrade-item.js";
import { WeaponItem } from "./documents/weapon-item.js";
import { registerArcflightSheets } from "./sheets/registration.js";

function isArcflightVehicle(actor) {
  return actor?.type === "vehicle" && actor.getFlag?.(ARCFLIGHT.MODULE_ID, "enabled") === true;
}

async function setArcflightVehicleEnabled(actor, enabled = true) {
  if (actor?.type !== "vehicle" || typeof actor.setFlag !== "function") {
    throw new Error("Arcflight ships must be PF2E vehicle actors.");
  }

  return actor.setFlag(ARCFLIGHT.MODULE_ID, "enabled", Boolean(enabled));
}

const documentClasses = Object.freeze({
  ArcflightItem,
  HullItem,
  ArkengineItem,
  ArkengineModItem,
  WeaponItem,
  RoomItem,
  ShipUpgradeItem,
  CargoItem,
  CrewAssetItem,
  CrewItem
});

Hooks.once("init", () => {
  console.log("Arcflight | Initializing module");

  registerArcflightDataModels();
  registerArcflightPf2eDocumentClasses();
  registerArcflightDocumentClasses();

  CONFIG.arcflight = Object.freeze({
    constants: ARCFLIGHT,
    documents: documentClasses,
    isArcflightVehicle,
    setArcflightVehicleEnabled,
    documentRegistries: Object.freeze({
      Actor: arcflightActorDocumentClasses,
      Item: arcflightItemDocumentClasses
    }),
    dataModels: Object.freeze({
      Actor: arcflightActorDataModels,
      Item: arcflightItemDataModels
    })
  });

  game.arcflight = CONFIG.arcflight;

  registerArcflightSheets().catch((error) => {
    console.warn("Arcflight | Sheet registration failed; continuing startup.", error);
  });
});

export {
  ARCFLIGHT,
  ArcflightItem,
  HullItem,
  ArkengineItem,
  ArkengineModItem,
  WeaponItem,
  RoomItem,
  ShipUpgradeItem,
  CargoItem,
  CrewAssetItem,
  CrewItem,
  arcflightActorDocumentClasses,
  arcflightItemDocumentClasses,
  arcflightActorDataModels,
  arcflightItemDataModels,
  registerArcflightDataModels,
  registerArcflightDocumentClasses,
  registerArcflightPf2eDocumentClasses,
  isArcflightVehicle,
  setArcflightVehicleEnabled
};
