import { ARCFLIGHT_ACTOR_DOCUMENT_TYPES, ARCFLIGHT_ITEM_DOCUMENT_TYPES } from "../config/constants.js";
import { ArkengineItem } from "./arkengine-item.js";
import { ArkengineModItem } from "./arkengine-mod-item.js";
import { CargoItem } from "./cargo-item.js";
import { CrewAssetItem } from "./crew-item.js";
import { HullItem } from "./hull-item.js";
import { RoomItem } from "./room-item.js";
import { ShipActor } from "./ship-actor.js";
import { ShipUpgradeItem } from "./ship-upgrade-item.js";
import { WeaponItem } from "./weapon-item.js";

const ArcflightTypeDataModelBase = globalThis.foundry?.abstract?.TypeDataModel ?? class {};

function getFoundryDataFields() {
  const fields = globalThis.foundry?.data?.fields;
  if (!fields) throw new Error("Foundry data fields are not available.");
  return fields;
}

function createFieldFromDefaultValue(value) {
  const fields = getFoundryDataFields();
  const initial = () => globalThis.foundry?.utils?.deepClone(value) ?? structuredClone(value);

  if (Array.isArray(value)) return new fields.ArrayField(new fields.AnyField(), { initial });
  if (value === null) return new fields.ObjectField({ required: false, nullable: true, initial: null });

  switch (typeof value) {
    case "string":
      return new fields.StringField({ required: true, blank: true, initial: value });
    case "number":
      return new fields.NumberField({ required: true, integer: Number.isInteger(value), initial: value });
    case "boolean":
      return new fields.BooleanField({ required: true, initial: value });
    case "object":
      return new fields.SchemaField(createSchemaFromDefaultData(value), { initial });
    default:
      return new fields.ObjectField({ required: false, nullable: true, initial: value });
  }
}

function createSchemaFromDefaultData(defaultData) {
  return Object.fromEntries(Object.entries(defaultData).map(([key, value]) => [key, createFieldFromDefaultValue(value)]));
}

class ArcflightTypeDataModel extends ArcflightTypeDataModelBase {
  static documentClass = null;

  static defineSchema() {
    return createSchemaFromDefaultData(this.documentClass.defaultSystemData());
  }
}

export class ShipActorDataModel extends ArcflightTypeDataModel {
  static documentClass = ShipActor;
}

export class HullItemDataModel extends ArcflightTypeDataModel {
  static documentClass = HullItem;
}

export class ArkengineItemDataModel extends ArcflightTypeDataModel {
  static documentClass = ArkengineItem;
}

export class ArkengineModItemDataModel extends ArcflightTypeDataModel {
  static documentClass = ArkengineModItem;
}

export class WeaponItemDataModel extends ArcflightTypeDataModel {
  static documentClass = WeaponItem;
}

export class RoomItemDataModel extends ArcflightTypeDataModel {
  static documentClass = RoomItem;
}

export class ShipUpgradeItemDataModel extends ArcflightTypeDataModel {
  static documentClass = ShipUpgradeItem;
}

export class CargoItemDataModel extends ArcflightTypeDataModel {
  static documentClass = CargoItem;
}

export class CrewAssetItemDataModel extends ArcflightTypeDataModel {
  static documentClass = CrewAssetItem;
}

export const arcflightActorDataModels = Object.freeze({
  [ARCFLIGHT_ACTOR_DOCUMENT_TYPES.SHIP]: ShipActorDataModel
});

export const arcflightItemDataModels = Object.freeze({
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.HULL]: HullItemDataModel,
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.ARKENGINE]: ArkengineItemDataModel,
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.ARKENGINE_MOD]: ArkengineModItemDataModel,
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.WEAPON]: WeaponItemDataModel,
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.ROOM]: RoomItemDataModel,
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.SHIP_UPGRADE]: ShipUpgradeItemDataModel,
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.CARGO]: CargoItemDataModel,
  [ARCFLIGHT_ITEM_DOCUMENT_TYPES.CREW_ASSET]: CrewAssetItemDataModel
});

function ensureDataModelRegistry(documentName) {
  const config = globalThis.CONFIG?.[documentName];
  if (!config) throw new Error(`CONFIG.${documentName} is not available.`);

  if (!config.dataModels || typeof config.dataModels !== "object") config.dataModels = {};
  return config.dataModels;
}

/** Register Arcflight module sub-type system data models for Foundry v13. */
export function registerArcflightDataModels() {
  Object.assign(ensureDataModelRegistry("Actor"), arcflightActorDataModels);
  Object.assign(ensureDataModelRegistry("Item"), arcflightItemDataModels);

  return {
    Actor: arcflightActorDataModels,
    Item: arcflightItemDataModels
  };
}
