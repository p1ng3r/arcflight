import { arcflightTemplatePath, prepareInstalledContainers } from "./sheet-helpers.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const DEFAULT_ARCFLIGHT_SHIP_FLAGS = Object.freeze({
  enabled: false,
  resources: {
    hull: {
      value: 0,
      max: 0
    },
    lifeveil: {
      value: 0,
      max: 0
    },
    strain: {
      value: 0,
      max: 0
    }
  },
  morale: 0,
  supplies: 0,
  installed: {
    hull: null,
    arkengine: null,
    weapons: [],
    rooms: [],
    upgrades: []
  }
});

function prepareArcflightShipFlags(actor) {
  return foundry.utils.mergeObject(
    foundry.utils.deepClone(DEFAULT_ARCFLIGHT_SHIP_FLAGS),
    foundry.utils.deepClone(actor.flags?.arcflight ?? {}),
    { inplace: false }
  );
}

/** Lightweight ApplicationV2 sheet foundation for Arcflight PF2E vehicle actors. */
export class ArcflightShipSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["arcflight", "sheet", "actor", "ship", "vehicle"],
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
      template: arcflightTemplatePath("actors/ship-sheet.hbs")
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const arcflight = prepareArcflightShipFlags(this.document);

    return {
      ...context,
      actor: this.document,
      arcflight,
      installed: prepareInstalledContainers(arcflight.installed)
    };
  }
}

export { ArcflightShipSheet as ShipSheet };
