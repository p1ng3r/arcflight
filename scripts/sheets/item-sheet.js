import { arcflightTemplatePath, localizeDocumentType, prepareSystemEntries } from "./sheet-helpers.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/** Lightweight reusable ApplicationV2 sheet foundation for Arcflight items. */
export class ArcflightItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["arcflight", "sheet", "item"],
    tag: "form",
    position: {
      width: 520,
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

    return {
      ...context,
      item: this.document,
      typeLabel: localizeDocumentType(this.document),
      system: this.document.system ?? {},
      systemEntries: prepareSystemEntries(this.document.system)
    };
  }
}
