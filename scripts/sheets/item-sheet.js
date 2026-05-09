import { ARCFLIGHT_ITEM_TYPES, ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import { getArcflightComponentFlags, getComponentData, getComponentType, isArcflightItem } from "../documents/components.js";
import { arcflightTemplatePath } from "./sheet-helpers.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/** Optional ApplicationV2 sheet for Arcflight PF2E equipment components. */
export class ArcflightItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["arcflight", "sheet", "item"],
    tag: "form",
    position: {
      width: 560,
      height: "auto"
    },
    window: {
      resizable: true
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false
    }
  };

  static PARTS = {
    sheet: {
      template: arcflightTemplatePath("items/item-sheet.hbs")
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.document ?? context.item ?? context.document;
    const arcflightFlags = getArcflightComponentFlags(item);
    const arcflightEnabled = isArcflightItem(item);
    const componentType = getComponentType(item);
    const componentData = getComponentData(item) ?? {};

    return {
      ...context,
      item,
      arcflightFlags,
      arcflightEnabled,
      componentType,
      componentData,
      isHull: componentType === ARCFLIGHT_ITEM_TYPES.HULL,
      isArkengine: componentType === ARCFLIGHT_ITEM_TYPES.ARKENGINE,
      isArkengineMod: componentType === ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD,
      isWeapon: componentType === ARCFLIGHT_ITEM_TYPES.WEAPON,
      isRoom: componentType === ARCFLIGHT_ITEM_TYPES.ROOM,
      isShipUpgrade: componentType === ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE,
      isCargo: componentType === ARCFLIGHT_ITEM_TYPES.CARGO,
      isCrewAsset: componentType === ARCFLIGHT_ITEM_TYPES.CREW_ASSET,
      arcflightFlagPath: `flags.${ARCFLIGHT_MODULE_ID}.system`
    };
  }
}
