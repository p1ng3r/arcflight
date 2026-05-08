import { ARCFLIGHT_ITEM_DOCUMENT_TYPES } from "../config/constants.js";
import { ArkengineItem } from "./arkengine-item.js";
import { ArkengineModItem } from "./arkengine-mod-item.js";
import { CargoItem } from "./cargo-item.js";
import { CrewAssetItem } from "./crew-item.js";
import { HullItem } from "./hull-item.js";
import { RoomItem } from "./room-item.js";
import { ShipUpgradeItem } from "./ship-upgrade-item.js";
import { WeaponItem } from "./weapon-item.js";

function createFieldFromDefaultValue(value) {
  const fields = foundry.data.fields;
  const initial = () => foundry.utils.deepClone(value);

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

function isTypeDataModelClass(DataModelClass) {
  return (
    typeof DataModelClass === "function" &&
    typeof foundry.abstract.TypeDataModel === "function" &&
    (DataModelClass === foundry.abstract.TypeDataModel || DataModelClass.prototype instanceof foundry.abstract.TypeDataModel)
  );
}

class ArcflightTypeDataModel extends foundry.abstract.TypeDataModel {
  static documentClass = null;

  static defineSchema() {
    return createSchemaFromDefaultData(this.documentClass.defaultSystemData());
  }
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

export const arcflightActorDataModels = Object.freeze({});

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

/** Register Arcflight module sub-type system data models for Foundry v13. */
export function registerArcflightDataModels() {
  const itemDataModels = Object.fromEntries(
    Object.entries(arcflightItemDataModels).filter(([documentType, DataModelClass]) => {
      const valid = isTypeDataModelClass(DataModelClass);
      if (!valid) {
        console.warn(`Arcflight | Refusing to register ${documentType} in CONFIG.Item.dataModels because it is not a TypeDataModel class.`);
      }
      return valid;
    })
  );

  Object.assign(CONFIG.Item.dataModels, itemDataModels);
}
