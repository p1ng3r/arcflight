import { arcflightTemplatePath, prepareInstalledContainers } from "./sheet-helpers.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/** Lightweight ApplicationV2 sheet foundation for Arcflight ship actors. */
export class ShipSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["arcflight", "sheet", "actor", "ship"],
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
    const system = this.document.system ?? {};

    return {
      ...context,
      actor: this.document,
      system,
      installed: prepareInstalledContainers(system.installed)
    };
  }
}
