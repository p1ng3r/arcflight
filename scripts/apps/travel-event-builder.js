import { arcflightTemplatePath } from "../sheets/sheet-helpers.js";
import {
  applyTravelEventBuilderFinalOutcomeEffectFormDataToDraft,
  applyTravelEventBuilderFormDataToDraft,
  applyTravelEventBuilderRoundFormDataToDraft,
  createTravelEventDraft,
  normalizeTravelEventDraft,
  prepareTravelEventBuilderFinalOutcomeEffectEditorState,
  prepareTravelEventBuilderFormOptions,
  prepareTravelEventBuilderPreview,
  prepareTravelEventBuilderRoundEditorState
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
  "[data-arcflight-builder-apply-rounds]",
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
    formOptions: prepareTravelEventBuilderFormOptions(normalizedDraft, options),
    roundEditor: prepareTravelEventBuilderRoundEditorState(normalizedDraft, options),
    finalOutcomeEffectEditor: prepareTravelEventBuilderFinalOutcomeEffectEditorState(normalizedDraft, options)
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
    if (target.hasAttribute("data-arcflight-builder-apply-rounds")) return this.#onApplyRounds(event);
    if (target.hasAttribute("data-arcflight-builder-apply-final-outcomes")) return this.#onApplyFinalOutcomes(event);
    if (target.hasAttribute("data-arcflight-builder-add-final-effect")) return this.#onAddFinalOutcomeEffect(event, target);
    if (target.hasAttribute("data-arcflight-builder-remove-final-effect")) return this.#onRemoveFinalOutcomeEffect(event, target);
    if (target.hasAttribute("data-arcflight-builder-import")) return this.#onImportDraft(event);
    if (target.hasAttribute("data-arcflight-builder-export-draft")) return this.#onExportDraft(event);
    if (target.hasAttribute("data-arcflight-builder-export-final")) return this.#onExportFinal(event);
  }


  async #onBuilderChange(event) {
    const target = event.target?.closest?.("[data-arcflight-builder-form-field], [data-arcflight-builder-round-field], [data-arcflight-builder-final-outcome-field]");
    if (!target || !this.element?.contains(target)) return;

    if (target.hasAttribute("data-arcflight-builder-round-field")) this.#syncDraftFromRoundForm();
    else if (target.hasAttribute("data-arcflight-builder-final-outcome-field")) this.#syncDraftFromFinalOutcomeEffects();
    else this.#syncDraftFromForm();
    this.outputJson = "";
    const message = target.hasAttribute("data-arcflight-builder-round-field")
      ? "Updated the local in-memory draft from the round editor."
      : (target.hasAttribute("data-arcflight-builder-final-outcome-field") ? "Updated the local in-memory draft from the final outcome editor." : "Updated the local in-memory draft from the form.");
    this.status = createStatus("success", message);
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

  #readRoundFormData() {
    const rounds = Array.from(this.element?.querySelectorAll?.("[data-arcflight-builder-round]") ?? []).map((roundElement) => {
      const round = Number(roundElement.dataset.arcflightBuilderRound);
      const stationPrompts = Object.fromEntries(Array.from(roundElement.querySelectorAll("[data-arcflight-builder-station-player-action]")).map((input) => [
        input.dataset.arcflightBuilderStationPlayerAction,
        { playerAction: input.value ?? "" }
      ]));

      return {
        round,
        openingVignette: readTextareaValue(roundElement, "[data-arcflight-builder-round-opening-vignette]"),
        activeStations: readCheckedValues(roundElement, "[data-arcflight-builder-round-active-stations]"),
        stationPrompts
      };
    });

    return { rounds };
  }

  #syncDraftFromRoundForm() {
    this.draft = applyTravelEventBuilderRoundFormDataToDraft(this.draft, this.#readRoundFormData());
    return this.draft;
  }

  #readFinalOutcomeEffectFormData(extra = {}) {
    const outcomes = Object.fromEntries(Array.from(this.element?.querySelectorAll?.("[data-arcflight-builder-final-outcome]") ?? []).map((outcomeElement) => {
      const outcomeKey = outcomeElement.dataset.arcflightBuilderFinalOutcome;
      const effects = Array.from(outcomeElement.querySelectorAll("[data-arcflight-builder-final-effect]")).map((effectElement) => ({
        index: Number(effectElement.dataset.arcflightBuilderFinalEffect),
        resource: readInputValue(effectElement, "[data-arcflight-builder-final-effect-resource]"),
        mode: readInputValue(effectElement, "[data-arcflight-builder-final-effect-mode]"),
        value: readInputValue(effectElement, "[data-arcflight-builder-final-effect-value]"),
        label: readInputValue(effectElement, "[data-arcflight-builder-final-effect-label]")
      }));

      return [outcomeKey, {
        label: readInputValue(outcomeElement, "[data-arcflight-builder-final-outcome-label]"),
        vignette: readTextareaValue(outcomeElement, "[data-arcflight-builder-final-outcome-vignette]"),
        effects
      }];
    }));

    if (extra.outcomeKey) {
      outcomes[extra.outcomeKey] = outcomes[extra.outcomeKey] ?? { effects: [] };
      if (extra.addResourceEffect === true) outcomes[extra.outcomeKey].addResourceEffect = true;
      if (Number.isInteger(extra.removeEffectIndex)) {
        const existing = outcomes[extra.outcomeKey].effects.find((effect) => effect.index === extra.removeEffectIndex);
        if (existing) existing.remove = true;
        else outcomes[extra.outcomeKey].effects.push({ index: extra.removeEffectIndex, remove: true });
      }
    }

    return { outcomes };
  }

  #syncDraftFromFinalOutcomeEffects(extra = {}) {
    this.draft = applyTravelEventBuilderFinalOutcomeEffectFormDataToDraft(this.draft, this.#readFinalOutcomeEffectFormData(extra));
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

  async #onApplyRounds(event) {
    event.preventDefault();
    this.#syncDraftFromRoundForm();
    this.outputJson = "";
    this.status = createStatus("success", "Applied round editor changes to the local in-memory draft.");
    await this.#rerenderAfterAction();
  }


  async #onApplyFinalOutcomes(event) {
    event.preventDefault();
    this.#syncDraftFromFinalOutcomeEffects();
    this.outputJson = "";
    this.status = createStatus("success", "Applied final outcome text and resource effect edits to the local in-memory draft.");
    await this.#rerenderAfterAction();
  }

  async #onAddFinalOutcomeEffect(event, target) {
    event.preventDefault();
    this.#syncDraftFromFinalOutcomeEffects({ outcomeKey: target.dataset.arcflightBuilderAddFinalEffect, addResourceEffect: true });
    this.outputJson = "";
    this.status = createStatus("success", "Added one local staged resource effect to the final outcome draft.");
    await this.#rerenderAfterAction();
  }

  async #onRemoveFinalOutcomeEffect(event, target) {
    event.preventDefault();
    this.#syncDraftFromFinalOutcomeEffects({
      outcomeKey: target.dataset.arcflightBuilderRemoveFinalEffect,
      removeEffectIndex: Number(target.dataset.arcflightBuilderFinalEffectIndex)
    });
    this.outputJson = "";
    this.status = createStatus("success", "Removed the staged resource effect from the local final outcome draft.");
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
