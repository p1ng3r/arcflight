import { arcflightTemplatePath } from "../sheets/sheet-helpers.js";
import {
  applyTravelEventBuilderFormDataToDraft,
  createTravelEventDraft,
  normalizeTravelEventDraft,
  prepareTravelEventBuilderFormOptions,
  prepareTravelEventBuilderPreview
} from "../helpers/travel-event-builder.js";
import {
  exportFinalTravelEventToJson,
  exportTravelEventDraftToJson,
  importTravelEventDraftFromJson,
  prepareTravelEventBuilderExportPreview
} from "../helpers/travel-event-builder-io.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const BUILDER_CLICK_SELECTOR = [
  "[data-arcflight-builder-reset]",
  "[data-arcflight-builder-preview]",
  "[data-arcflight-builder-apply-form]",
  "[data-arcflight-builder-import]",
  "[data-arcflight-builder-export-draft]",
  "[data-arcflight-builder-export-final]"
].join(", ");

function cloneData(value) {
  if (value == null) return value;
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function readTextareaValue(root, selector) {
  return root?.querySelector?.(selector)?.value ?? "";
}

function readInputValue(root, selector) {
  return root?.querySelector?.(selector)?.value ?? "";
}

function readCheckedValues(root, selector) {
  return Array.from(root?.querySelectorAll?.(selector) ?? [])
    .filter((input) => input.checked === true)
    .map((input) => input.value);
}

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function getMessageList(result, key) {
  return Array.isArray(result?.[key]) ? result[key] : [];
}

function firstError(result, fallback) {
  return getMessageList(result, "errors")[0] ?? getMessageList(result?.validation, "errors")[0] ?? fallback;
}

function createStatus(kind = "info", message = "") {
  return { kind, message };
}

export function prepareTravelEventBuilderShellState(draft, options = {}) {
  const normalizedDraft = normalizeTravelEventDraft(draft ?? createTravelEventDraft(), options);
  const preview = prepareTravelEventBuilderPreview(normalizedDraft, options);
  const exportPreview = prepareTravelEventBuilderExportPreview(normalizedDraft, options);

  return Object.freeze({
    draft: normalizedDraft,
    draftJson: formatJson(normalizedDraft),
    preview,
    exportPreview,
    validationOk: preview.validation.ok,
    validationErrors: preview.validation.errors,
    validationWarnings: preview.validation.warnings,
    hasValidationErrors: preview.validation.errors.length > 0,
    hasValidationWarnings: preview.validation.warnings.length > 0,
    canExportFinal: exportPreview.exportFinalAvailable === true,
    canExportDraft: exportPreview.exportDraftAvailable === true,
    formOptions: prepareTravelEventBuilderFormOptions(normalizedDraft, options)
  });
}

export class ArcflightTravelEventBuilder extends HandlebarsApplicationMixin(ApplicationV2) {
  #boundBuilderClick = this.#onBuilderClick.bind(this);
  #boundBuilderChange = this.#onBuilderChange.bind(this);

  constructor(options = {}) {
    super(options);
    this.draft = normalizeTravelEventDraft(options.draft ?? createTravelEventDraft());
    this.outputJson = "";
    this.status = createStatus("info", "Draft is local to this window. Nothing is persisted or applied.");
  }

  static DEFAULT_OPTIONS = {
    classes: ["arcflight", "arcflight-travel-builder"],
    tag: "section",
    position: {
      width: 860,
      height: 720
    },
    window: {
      title: "Travel Event Builder",
      resizable: true
    }
  };

  static PARTS = {
    builder: {
      template: arcflightTemplatePath("apps/travel-event-builder.hbs")
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const shell = prepareTravelEventBuilderShellState(this.draft, options);

    return {
      ...context,
      ...shell,
      outputJson: this.outputJson,
      hasOutputJson: typeof this.outputJson === "string" && this.outputJson.trim().length > 0,
      status: this.status,
      hasStatus: Boolean(this.status?.message),
      hardBoundaryHint: "Shell only: no compendium writes, world settings persistence, actor mutation, chat posting, travel-event running, AP/RAP mechanics, combat automation, or staged-effect application."
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    this.element?.removeEventListener("click", this.#boundBuilderClick);
    this.element?.addEventListener("click", this.#boundBuilderClick);
    this.element?.removeEventListener("change", this.#boundBuilderChange);
    this.element?.addEventListener("change", this.#boundBuilderChange);
  }

  async #onBuilderClick(event) {
    const target = event.target?.closest?.(BUILDER_CLICK_SELECTOR);
    if (!target || !this.element?.contains(target) || target.disabled === true) return;

    if (target.hasAttribute("data-arcflight-builder-reset")) return this.#onResetDraft(event);
    if (target.hasAttribute("data-arcflight-builder-preview")) return this.#onPreviewDraft(event);
    if (target.hasAttribute("data-arcflight-builder-apply-form")) return this.#onApplyForm(event);
    if (target.hasAttribute("data-arcflight-builder-import")) return this.#onImportDraft(event);
    if (target.hasAttribute("data-arcflight-builder-export-draft")) return this.#onExportDraft(event);
    if (target.hasAttribute("data-arcflight-builder-export-final")) return this.#onExportFinal(event);
  }


  async #onBuilderChange(event) {
    const target = event.target?.closest?.("[data-arcflight-builder-form-field]");
    if (!target || !this.element?.contains(target)) return;

    this.#syncDraftFromForm();
    this.outputJson = "";
    this.status = createStatus("success", "Updated the local in-memory draft from the form.");
    await this.#rerenderAfterAction();
  }

  async #rerenderAfterAction() {
    await this.render(true);
  }


  #readFormData() {
    return {
      key: readInputValue(this.element, "[name='arcflight-builder-key']"),
      name: readInputValue(this.element, "[name='arcflight-builder-name']"),
      category: readInputValue(this.element, "[name='arcflight-builder-category']"),
      baseDC: readInputValue(this.element, "[name='arcflight-builder-baseDC']"),
      roundCount: readInputValue(this.element, "[name='arcflight-builder-roundCount']"),
      description: readTextareaValue(this.element, "[name='arcflight-builder-description']"),
      gmSummary: readTextareaValue(this.element, "[name='arcflight-builder-gmSummary']"),
      tags: readInputValue(this.element, "[name='arcflight-builder-tags']"),
      activeResources: readCheckedValues(this.element, "[name='arcflight-builder-activeResources']"),
      travelStations: readCheckedValues(this.element, "[name='arcflight-builder-travelStations']")
    };
  }

  #syncDraftFromForm() {
    this.draft = applyTravelEventBuilderFormDataToDraft(this.draft, this.#readFormData());
    return this.draft;
  }

  #syncDraftFromEditor() {
    const jsonText = readTextareaValue(this.element, "[data-arcflight-builder-draft-json]");
    const imported = importTravelEventDraftFromJson(jsonText);
    if (!imported.draft) {
      this.status = createStatus("warning", firstError(imported, "Draft JSON could not be parsed."));
      return imported;
    }

    this.draft = cloneData(imported.draft);
    return imported;
  }

  async #onResetDraft(event) {
    event.preventDefault();
    this.draft = createTravelEventDraft();
    this.outputJson = "";
    this.status = createStatus("info", "Created a new default local travel event draft.");
    await this.#rerenderAfterAction();
  }

  async #onPreviewDraft(event) {
    event.preventDefault();
    const imported = this.#syncDraftFromEditor();
    this.status = createStatus(imported.ok ? (imported.warnings.length > 0 ? "warning" : "success") : "warning", imported.ok ? (imported.warnings[0] ?? "Preview refreshed from local draft JSON.") : firstError(imported, "Preview refreshed with validation errors."));
    await this.#rerenderAfterAction();
  }


  async #onApplyForm(event) {
    event.preventDefault();
    this.#syncDraftFromForm();
    this.outputJson = "";
    this.status = createStatus("success", "Applied form edits to the local in-memory draft.");
    await this.#rerenderAfterAction();
  }

  async #onImportDraft(event) {
    event.preventDefault();
    const jsonText = readTextareaValue(this.element, "[data-arcflight-builder-import-json]");
    const imported = importTravelEventDraftFromJson(jsonText);

    if (!imported.draft) {
      this.status = createStatus("warning", firstError(imported, "Pasted JSON could not be imported."));
      await this.#rerenderAfterAction();
      return;
    }

    this.draft = cloneData(imported.draft);
    this.outputJson = "";
    this.status = createStatus(imported.ok ? (imported.warnings.length > 0 ? "warning" : "success") : "warning", imported.ok ? (imported.warnings[0] ?? "Imported pasted draft JSON into this local builder shell.") : firstError(imported, "Imported draft with validation errors."));
    await this.#rerenderAfterAction();
  }

  async #onExportDraft(event) {
    event.preventDefault();
    const imported = this.#syncDraftFromEditor();
    if (!imported.draft) return await this.#rerenderAfterAction();

    const exported = exportTravelEventDraftToJson(this.draft);
    this.outputJson = exported.json ?? "";
    this.status = createStatus(exported.ok ? "success" : "warning", exported.ok ? "Draft JSON exported below. Copy it manually; nothing was persisted." : firstError(exported, "Draft JSON export failed."));
    await this.#rerenderAfterAction();
  }

  async #onExportFinal(event) {
    event.preventDefault();
    const imported = this.#syncDraftFromEditor();
    if (!imported.draft) return await this.#rerenderAfterAction();

    const exported = exportFinalTravelEventToJson(this.draft);
    this.outputJson = exported.json ?? "";
    this.status = createStatus(exported.ok ? "success" : "warning", exported.ok ? "Final event JSON exported below without builder metadata. Copy it manually; nothing was persisted." : firstError(exported, "Final event JSON export failed."));
    await this.#rerenderAfterAction();
  }
}

export function openTravelEventBuilder(options = {}) {
  const app = new ArcflightTravelEventBuilder(options);
  app.render(true);
  return app;
}
