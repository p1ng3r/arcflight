import {
  ARCFLIGHT_ARKENGINE_CLASSES,
  ARCFLIGHT_ITEM_TYPES,
  ARCFLIGHT_MODULE_ID,
  ARCFLIGHT_RELOAD_STATES,
  ARCFLIGHT_SUGGESTED_WEAPON_TYPES,
  ARCFLIGHT_WEAPON_ARCS,
  ARCFLIGHT_WEAPON_SIZES
} from "../config/constants.js";
import {
  getArcflightComponentFlags,
  getComponentData,
  getComponentType,
  getDefaultArcflightComponentData,
  isArcflightItem,
  normalizeArcflightComponentType
} from "../documents/components.js";
import { arcflightTemplatePath } from "./sheet-helpers.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;


function objectValuesToOptions(values) {
  return Object.values(values).map((value) => ({ value, label: value }));
}

const arkengineClassOptions = Object.freeze(objectValuesToOptions(ARCFLIGHT_ARKENGINE_CLASSES));
const weaponArcOptions = Object.freeze(objectValuesToOptions(ARCFLIGHT_WEAPON_ARCS));
const weaponSizeOptions = Object.freeze(objectValuesToOptions(ARCFLIGHT_WEAPON_SIZES));
const reloadStateOptions = Object.freeze(objectValuesToOptions(ARCFLIGHT_RELOAD_STATES));
const suggestedWeaponTypeOptions = Object.freeze(objectValuesToOptions(ARCFLIGHT_SUGGESTED_WEAPON_TYPES));
const lockedPhaseOneSchemaTypes = Object.freeze(new Set([
  ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD,
  ARCFLIGHT_ITEM_TYPES.ROOM,
  ARCFLIGHT_ITEM_TYPES.CARGO
]));

const componentTypeOptions = Object.freeze(
  Object.values(ARCFLIGHT_ITEM_TYPES).map((componentType) => ({
    value: componentType,
    label: componentType,
    selected: componentType === ARCFLIGHT_ITEM_TYPES.HULL
  }))
);

/** Optional ApplicationV2 sheet for Arcflight PF2E equipment components. */
export class ArcflightItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["arcflight", "sheet", "item"],
    tag: "form",
    position: {
      width: 560,
      height: 640
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
      componentTypeOptions,
      arkengineClassOptions,
      weaponArcOptions,
      weaponSizeOptions,
      reloadStateOptions,
      suggestedWeaponTypeOptions,
      isHull: componentType === ARCFLIGHT_ITEM_TYPES.HULL,
      isArkengine: componentType === ARCFLIGHT_ITEM_TYPES.ARKENGINE,
      isArkengineMod: componentType === ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD,
      isWeapon: componentType === ARCFLIGHT_ITEM_TYPES.WEAPON,
      isRoom: componentType === ARCFLIGHT_ITEM_TYPES.ROOM,
      isShipUpgrade: componentType === ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE,
      isCargo: componentType === ARCFLIGHT_ITEM_TYPES.CARGO,
      isCrewAsset: componentType === ARCFLIGHT_ITEM_TYPES.CREW_ASSET,
      usesLockedPhaseOneSchema: lockedPhaseOneSchemaTypes.has(componentType),
      arcflightFlagPath: `flags.${ARCFLIGHT_MODULE_ID}.system`
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    this.element
      .querySelector?.("[data-arcflight-convert-component]")
      ?.addEventListener("click", this.#onConvertToArcflightComponent.bind(this));
  }

  /**
   * Convert a normal PF2E equipment item into an Arcflight component by adding
   * Arcflight flags only. PF2E equipment system data remains untouched.
   *
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  async #onConvertToArcflightComponent(event) {
    event.preventDefault();

    const item = this.document;
    if (item?.type !== "equipment") {
      ui.notifications?.warn?.("Arcflight components must be PF2E equipment items.");
      return;
    }

    const form = event.currentTarget?.closest?.("form") ?? this.element;
    const selectedType = form?.querySelector?.("[data-arcflight-component-type]")?.value ?? ARCFLIGHT_ITEM_TYPES.HULL;
    let componentType;

    try {
      componentType = normalizeArcflightComponentType(selectedType);
    } catch (error) {
      ui.notifications?.error?.(error.message);
      return;
    }

    await item.update({
      [`flags.${ARCFLIGHT_MODULE_ID}.enabled`]: true,
      [`flags.${ARCFLIGHT_MODULE_ID}.componentType`]: componentType,
      [`flags.${ARCFLIGHT_MODULE_ID}.system`]: getDefaultArcflightComponentData(componentType)
    });

    this.render(true);
  }
}
