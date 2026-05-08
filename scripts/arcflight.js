import { ARCFLIGHT } from "./config/constants.js";
import { ArcflightActor } from "./documents/arcflight-actor.js";
import { ArcflightItem } from "./documents/arcflight-item.js";
import { ShipActor } from "./documents/ship-actor.js";
import { HullItem } from "./documents/hull-item.js";
import { ArkengineItem } from "./documents/arkengine-item.js";
import { WeaponItem } from "./documents/weapon-item.js";
import { RoomItem } from "./documents/room-item.js";
import { CargoItem } from "./documents/cargo-item.js";
import { CrewItem } from "./documents/crew-item.js";

const documentClasses = Object.freeze({
  ArcflightActor,
  ArcflightItem,
  ShipActor,
  HullItem,
  ArkengineItem,
  WeaponItem,
  RoomItem,
  CargoItem,
  CrewItem
});

Hooks.once("init", () => {
  console.log("Arcflight | Initializing module");

  CONFIG.arcflight = Object.freeze({
    constants: ARCFLIGHT,
    documents: documentClasses
  });

  game.arcflight = CONFIG.arcflight;
});

export {
  ARCFLIGHT,
  ArcflightActor,
  ArcflightItem,
  ShipActor,
  HullItem,
  ArkengineItem,
  WeaponItem,
  RoomItem,
  CargoItem,
  CrewItem
};
