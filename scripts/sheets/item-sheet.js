import { ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import { getComponentData, getComponentType, isArcflightItem } from "../documents/components.js";
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
    const item = this.document;
    const arcflightEnabled = isArcflightItem(item);
    const componentType = getComponentType(item);
    const componentData = getComponentData(item) ?? {};

    return {
      ...context,
      item,
      arcflightEnabled,
      componentType,
      componentData,
      isHull: componentType === "hull",
      isArkengine: componentType === "arkengine",
      isArkengineMod: componentType === "arkengineMod",
      isWeapon: componentType === "weapon",
      isRoom: componentType === "room",
      isShipUpgrade: componentType === "shipUpgrade",
      isCargo: componentType === "cargo",
      isCrewAsset: componentType === "crewAsset",
      arcflightFlagPath: `flags.${ARCFLIGHT_MODULE_ID}.system`
    };
  }
}
