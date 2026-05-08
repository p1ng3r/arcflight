import { ARCFLIGHT } from "./config/constants.js";
import { ArcflightActor } from "./documents/arcflight-actor.js";
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
import { ShipActor } from "./documents/ship-actor.js";
import { ShipUpgradeItem } from "./documents/ship-upgrade-item.js";
import { WeaponItem } from "./documents/weapon-item.js";

const documentClasses = Object.freeze({
  ArcflightActor,
  ArcflightItem,
  ShipActor,
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

  // TODO: Re-enable Arcflight sheet imports and registration here after the module safe-load path is verified.
});

export {
  ARCFLIGHT,
  ArcflightActor,
  ArcflightItem,
  ShipActor,
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
  registerArcflightPf2eDocumentClasses
};
