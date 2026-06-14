import { arcflightTemplatePath } from "../sheets/sheet-helpers.js";
import {
  applyTravelEventBuilderFinalOutcomeEffectFormDataToDraft,
  applyTravelEventBuilderFinalOutcomeFormDataToDraft,
  applyTravelEventBuilderFormDataToDraft,
  applyTravelEventBuilderRoundFormDataToDraft,
  createTravelEventDraft,
  normalizeTravelEventDraft,
  clonePublishedTravelEventToDraft,
  deletePublishedTravelEventFromLibrary,
  deleteTravelEventBuilderDraftFromLibrary,
  getPublishedTravelEventLibrary,
  duplicateTravelEventBuilderLibraryDraft,
  loadPublishedTravelEventFromLibrary,
  loadTravelEventBuilderDraftFromLibrary,
  prepareTravelEventBuilderFinalOutcomeEditorState,
  prepareTravelEventBuilderFinalOutcomeEffectEditorState,
  prepareTravelEventBuilderFormOptions,
  preparePublishedTravelEventLibraryState,
  prepareTravelEventBuilderLibraryState,
  prepareTravelEventBuilderPreview,
  prepareTravelEventBuilderQualityReport,
  prepareTravelEventBuilderRoundEditorState,
  publishTravelEventDraftToLibrary,
  saveTravelEventBuilderDraftToLibrary
} from "../helpers/travel-event-builder.js";
import {
  exportFinalTravelEventToJson,
  exportTravelEventDraftToJson,
  importTravelEventDraftFromJson,
  prepareTravelEventBuilderExportPreview,
  exportPublishedTravelEventToJson,
  exportPublishedTravelEventPackToJson,
  importPublishedTravelEventFromJson,
  importPublishedTravelEventPackFromJson,
  saveImportedPublishedTravelEventToLibrary,
  saveImportedPublishedTravelEventPackToLibrary
} from "../helpers/travel-event-builder-io.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const BUILDER_CLICK_SELECTOR = [
  "[data-arcflight-builder-reset]",
  "[data-arcflight-builder-preview]",
  "[data-arcflight-builder-refresh-quality]",
  "[data-arcflight-builder-apply-form]",
  "[data-arcflight-builder-apply-rounds]",
  "[data-arcflight-builder-apply-final-outcomes]",
  "[data-arcflight-builder-library-save]",
  "[data-arcflight-builder-library-save-as]",
  "[data-arcflight-builder-library-load]",
  "[data-arcflight-builder-library-duplicate]",
  "[data-arcflight-builder-library-delete]",
  "[data-arcflight-builder-library-refresh]",
  "[data-arcflight-builder-published-publish]",
  "[data-arcflight-builder-published-load]",
  "[data-arcflight-builder-published-duplicate]",
  "[data-arcflight-builder-published-delete]",
  "[data-arcflight-builder-published-refresh]",
  "[data-arcflight-builder-published-export]",
  "[data-arcflight-builder-published-export-pack]",
  "[data-arcflight-builder-published-import]",
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
  const qualityReport = prepareTravelEventBuilderQualityReport(normalizedDraft, options);

  return Object.freeze({
    draft: normalizedDraft,
    draftJson: formatJson(normalizedDraft),
    preview,
    exportPreview,
    qualityReport,
    qualityReadiness: qualityReport.readiness,
    qualityReadinessClass: qualityReport.readiness.toLowerCase().replace(/\s+/g, "-"),
    qualityScore: qualityReport.score,
    qualityReady: qualityReport.ready,
    qualityBlocked: qualityReport.readiness === "Blocked",
    qualityNeedsAttention: qualityReport.readiness === "Needs Attention",
    validationOk: preview.validation.ok,
    validationErrors: preview.validation.errors,
    validationWarnings: preview.validation.warnings,
    hasValidationErrors: preview.validation.errors.length > 0,
    hasValidationWarnings: preview.validation.warnings.length > 0,
    canExportFinal: exportPreview.exportFinalAvailable === true,
    canExportDraft: exportPreview.exportDraftAvailable === true,
    formOptions: prepareTravelEventBuilderFormOptions(normalizedDraft, options),
    roundEditor: prepareTravelEventBuilderRoundEditorState(normalizedDraft, options),
    finalOutcomeEditor: prepareTravelEventBuilderFinalOutcomeEditorState(normalizedDraft, options),
    finalOutcomeEffectEditor: prepareTravelEventBuilderFinalOutcomeEffectEditorState(normalizedDraft, options),
    library: prepareTravelEventBuilderLibraryState(options),
    publishedLibrary: preparePublishedTravelEventLibraryState(options)
  });
}

export class ArcflightTravelEventBuilder extends HandlebarsApplicationMixin(ApplicationV2) {
  #boundBuilderClick = this.#onBuilderClick.bind(this);
  #boundBuilderChange = this.#onBuilderChange.bind(this);

  constructor(options = {}) {
    super(options);
    this.draft = normalizeTravelEventDraft(options.draft ?? createTravelEventDraft());
    this.outputJson = "";
    this.currentLibraryDraftId = typeof options.libraryDraftId === "string" ? options.libraryDraftId : "";
    this.status = createStatus("info", "Draft is local to this window until you explicitly save it to the Saved Drafts library.");
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
    const shell = prepareTravelEventBuilderShellState(this.draft, { ...options, currentId: this.currentLibraryDraftId });

    return {
      ...context,
      ...shell,
      outputJson: this.outputJson,
      hasOutputJson: typeof this.outputJson === "string" && this.outputJson.trim().length > 0,
      status: this.status,
      hasStatus: Boolean(this.status?.message),
      hardBoundaryHint: "Authoring shell only: saved drafts and published event records use Arcflight world settings, but there are no compendium writes, actor mutation, chat posting, travel-event running, AP/RAP mechanics, combat automation, or staged-effect application."
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
    if (target.hasAttribute("data-arcflight-builder-refresh-quality")) return this.#onRefreshQuality(event);
    if (target.hasAttribute("data-arcflight-builder-apply-form")) return this.#onApplyForm(event);
    if (target.hasAttribute("data-arcflight-builder-apply-rounds")) return this.#onApplyRounds(event);
    if (target.hasAttribute("data-arcflight-builder-apply-final-outcomes")) return this.#onApplyFinalOutcomes(event);
    if (target.hasAttribute("data-arcflight-builder-library-save")) return this.#onSaveLibraryDraft(event);
    if (target.hasAttribute("data-arcflight-builder-library-save-as")) return this.#onSaveAsLibraryDraft(event);
    if (target.hasAttribute("data-arcflight-builder-library-load")) return this.#onLoadLibraryDraft(event, target);
    if (target.hasAttribute("data-arcflight-builder-library-duplicate")) return this.#onDuplicateLibraryDraft(event, target);
    if (target.hasAttribute("data-arcflight-builder-library-delete")) return this.#onDeleteLibraryDraft(event, target);
    if (target.hasAttribute("data-arcflight-builder-library-refresh")) return this.#onRefreshLibrary(event);
    if (target.hasAttribute("data-arcflight-builder-published-publish")) return this.#onPublishCurrentDraft(event);
    if (target.hasAttribute("data-arcflight-builder-published-load")) return this.#onLoadPublishedEvent(event, target);
    if (target.hasAttribute("data-arcflight-builder-published-duplicate")) return this.#onDuplicatePublishedEvent(event, target);
    if (target.hasAttribute("data-arcflight-builder-published-delete")) return this.#onDeletePublishedEvent(event, target);
    if (target.hasAttribute("data-arcflight-builder-published-refresh")) return this.#onRefreshPublishedLibrary(event);
    if (target.hasAttribute("data-arcflight-builder-published-export")) return this.#onExportPublishedEvent(event, target);
    if (target.hasAttribute("data-arcflight-builder-published-export-pack")) return this.#onExportPublishedPack(event);
    if (target.hasAttribute("data-arcflight-builder-published-import")) return this.#onImportPublishedJson(event);
    if (target.hasAttribute("data-arcflight-builder-import")) return this.#onImportDraft(event);
    if (target.hasAttribute("data-arcflight-builder-export-draft")) return this.#onExportDraft(event);
    if (target.hasAttribute("data-arcflight-builder-export-final")) return this.#onExportFinal(event);
  }


  async #onBuilderChange(event) {
    const target = event.target?.closest?.("[data-arcflight-builder-form-field], [data-arcflight-builder-round-field], [data-arcflight-builder-final-outcome-field], [data-arcflight-builder-final-outcome-effect-field]");
    if (!target || !this.element?.contains(target)) return;
    if (target.closest?.("[data-arcflight-builder-final-outcome-add-effect]") && !target.hasAttribute("data-arcflight-builder-final-outcome-add-effect-enabled")) return;

    if (target.hasAttribute("data-arcflight-builder-round-field")) this.#syncDraftFromRoundForm();
    else if (target.hasAttribute("data-arcflight-builder-final-outcome-field") || target.hasAttribute("data-arcflight-builder-final-outcome-effect-field")) this.#syncDraftFromFinalOutcomeForm();
    else this.#syncDraftFromForm();
    this.outputJson = "";
    this.status = createStatus("success", target.hasAttribute("data-arcflight-builder-round-field") ? "Updated the local in-memory draft from the round editor." : (target.hasAttribute("data-arcflight-builder-final-outcome-field") || target.hasAttribute("data-arcflight-builder-final-outcome-effect-field") ? "Updated the local in-memory draft from the final outcome editor." : "Updated the local in-memory draft from the form."));
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

  #readFinalOutcomeFormData() {
    const outcomes = Array.from(this.element?.querySelectorAll?.("[data-arcflight-builder-final-outcome]") ?? []).map((outcomeElement) => {
      const effects = Array.from(outcomeElement.querySelectorAll("[data-arcflight-builder-final-outcome-effect]")).map((effectElement) => ({
        index: Number(effectElement.dataset.arcflightBuilderFinalOutcomeEffect),
        resource: readInputValue(effectElement, "[data-arcflight-builder-final-outcome-effect-resource]"),
        mode: readInputValue(effectElement, "[data-arcflight-builder-final-outcome-effect-mode]"),
        value: readInputValue(effectElement, "[data-arcflight-builder-final-outcome-effect-value]"),
        label: readInputValue(effectElement, "[data-arcflight-builder-final-outcome-effect-label]"),
        remove: effectElement.querySelector("[data-arcflight-builder-final-outcome-effect-remove]")?.checked === true
      }));
      const addEffectElement = outcomeElement.querySelector("[data-arcflight-builder-final-outcome-add-effect]");
      const addEffect = addEffectElement ? {
        enabled: addEffectElement.querySelector("[data-arcflight-builder-final-outcome-add-effect-enabled]")?.checked === true,
        resource: readInputValue(addEffectElement, "[data-arcflight-builder-final-outcome-add-effect-resource]"),
        mode: readInputValue(addEffectElement, "[data-arcflight-builder-final-outcome-add-effect-mode]"),
        value: readInputValue(addEffectElement, "[data-arcflight-builder-final-outcome-add-effect-value]"),
        label: readInputValue(addEffectElement, "[data-arcflight-builder-final-outcome-add-effect-label]")
      } : {};

      return {
        key: outcomeElement.dataset.arcflightBuilderFinalOutcome,
        label: readInputValue(outcomeElement, "[data-arcflight-builder-final-outcome-label]"),
        narrative: readTextareaValue(outcomeElement, "[data-arcflight-builder-final-outcome-narrative]"),
        rewardsText: readTextareaValue(outcomeElement, "[data-arcflight-builder-final-outcome-rewards]"),
        consequencesText: readTextareaValue(outcomeElement, "[data-arcflight-builder-final-outcome-consequences]"),
        effects,
        addEffect
      };
    });

    return { outcomes };
  }

  #syncDraftFromFinalOutcomeForm() {
    const formData = this.#readFinalOutcomeFormData();
    this.draft = applyTravelEventBuilderFinalOutcomeFormDataToDraft(this.draft, formData);
    this.draft = applyTravelEventBuilderFinalOutcomeEffectFormDataToDraft(this.draft, formData);
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
    this.currentLibraryDraftId = "";
    this.status = createStatus("info", "Created a new default local travel event draft.");
    await this.#rerenderAfterAction();
  }

  async #onPreviewDraft(event) {
    event.preventDefault();
    const imported = this.#syncDraftFromEditor();
    this.status = createStatus(imported.ok ? (imported.warnings.length > 0 ? "warning" : "success") : "warning", imported.ok ? (imported.warnings[0] ?? "Preview refreshed from local draft JSON.") : firstError(imported, "Preview refreshed with validation errors."));
    await this.#rerenderAfterAction();
  }


  async #onRefreshQuality(event) {
    event.preventDefault();
    const imported = this.#syncDraftFromEditor();
    const qualityReport = prepareTravelEventBuilderQualityReport(this.draft);
    this.status = createStatus(imported.draft && qualityReport.ok ? "success" : "warning", imported.draft ? `Quality check refreshed: ${qualityReport.readiness}.` : firstError(imported, "Quality check could not read the draft JSON."));
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
    this.#syncDraftFromFinalOutcomeForm();
    this.outputJson = "";
    this.status = createStatus("success", "Applied final outcome text and resource effect edits to the local in-memory draft.");
    await this.#rerenderAfterAction();
  }


  async #confirmBuilderDialog({ title, content, yesLabel = "Confirm", unavailableMessage = "This action requires Foundry DialogV2." } = {}) {
    const dialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (typeof dialogV2?.confirm === "function") return dialogV2.confirm({ window: { title }, content, yes: { label: yesLabel }, no: { label: "Cancel" }, rejectClose: false });
    this.status = createStatus("warning", unavailableMessage);
    return false;
  }

  async #onSaveLibraryDraft(event) {
    event.preventDefault();
    const imported = this.#syncDraftFromEditor();
    if (!imported.draft) return await this.#rerenderAfterAction();

    const saved = await saveTravelEventBuilderDraftToLibrary(this.draft, { id: this.currentLibraryDraftId || undefined, overwrite: Boolean(this.currentLibraryDraftId) });
    if (saved.entry) this.currentLibraryDraftId = saved.entry.id;
    this.outputJson = "";
    this.status = createStatus(saved.ok ? (saved.warnings.length > 0 ? "warning" : "success") : "warning", saved.ok ? (saved.warnings[0] ?? `Saved draft "${saved.entry.name}" to the local library.`) : firstError(saved, "Draft could not be saved to the library."));
    await this.#rerenderAfterAction();
  }

  async #onSaveAsLibraryDraft(event) {
    event.preventDefault();
    const imported = this.#syncDraftFromEditor();
    if (!imported.draft) return await this.#rerenderAfterAction();

    const saved = await saveTravelEventBuilderDraftToLibrary(this.draft, { overwrite: false });
    if (saved.entry) this.currentLibraryDraftId = saved.entry.id;
    this.outputJson = "";
    this.status = createStatus(saved.ok ? (saved.warnings.length > 0 ? "warning" : "success") : "warning", saved.ok ? (saved.warnings[0] ?? `Saved a new library draft "${saved.entry.name}".`) : firstError(saved, "Draft could not be saved as a new library entry."));
    await this.#rerenderAfterAction();
  }

  async #onLoadLibraryDraft(event, target) {
    event.preventDefault();
    const id = target.dataset.arcflightBuilderLibraryLoad;
    const loaded = loadTravelEventBuilderDraftFromLibrary(id);
    if (!loaded.draft) {
      this.status = createStatus("warning", firstError(loaded, "Saved draft could not be loaded."));
      await this.#rerenderAfterAction();
      return;
    }

    this.draft = cloneData(loaded.draft);
    this.currentLibraryDraftId = loaded.entry?.id ?? "";
    this.outputJson = "";
    this.status = createStatus(loaded.ok ? (loaded.warnings.length > 0 ? "warning" : "success") : "warning", loaded.ok ? (loaded.warnings[0] ?? `Loaded saved draft "${loaded.entry.name}".`) : firstError(loaded, "Loaded draft with validation errors."));
    await this.#rerenderAfterAction();
  }

  async #onDuplicateLibraryDraft(event, target) {
    event.preventDefault();
    const id = target.dataset.arcflightBuilderLibraryDuplicate;
    const duplicated = await duplicateTravelEventBuilderLibraryDraft(id);
    if (duplicated.entry) this.currentLibraryDraftId = duplicated.entry.id;
    if (duplicated.draft) this.draft = cloneData(duplicated.draft);
    this.outputJson = "";
    this.status = createStatus(duplicated.ok ? (duplicated.warnings.length > 0 ? "warning" : "success") : "warning", duplicated.ok ? (duplicated.warnings[0] ?? `Duplicated saved draft as "${duplicated.entry.name}" and loaded the duplicate.`) : firstError(duplicated, "Saved draft could not be duplicated."));
    await this.#rerenderAfterAction();
  }

  async #onDeleteLibraryDraft(event, target) {
    event.preventDefault();
    const id = target.dataset.arcflightBuilderLibraryDelete;
    const confirmed = await this.#confirmBuilderDialog({ title: "Delete Saved Draft", content: `<p>Delete saved travel event draft <strong>${id}</strong>? This only removes the builder-library copy.</p>`, yesLabel: "Delete Draft", unavailableMessage: "Delete requires Foundry DialogV2; saved draft library was not changed." });
    if (!confirmed) {
      this.status = createStatus("info", "Delete cancelled; saved draft library was not changed.");
      await this.#rerenderAfterAction();
      return;
    }

    const deleted = await deleteTravelEventBuilderDraftFromLibrary(id);
    if (deleted.deleted?.id === this.currentLibraryDraftId) this.currentLibraryDraftId = "";
    this.status = createStatus(deleted.ok ? "success" : "warning", deleted.ok ? `Deleted saved draft "${deleted.deleted.name}" from the local library.` : firstError(deleted, "Saved draft could not be deleted."));
    await this.#rerenderAfterAction();
  }

  async #onRefreshLibrary(event) {
    event.preventDefault();
    this.status = createStatus("success", "Saved draft library refreshed from the Arcflight world setting.");
    await this.#rerenderAfterAction();
  }

  async #onPublishCurrentDraft(event) {
    event.preventDefault();
    const imported = this.#syncDraftFromEditor();
    if (!imported.draft) return await this.#rerenderAfterAction();

    const published = await publishTravelEventDraftToLibrary(this.draft, { sourceDraftId: this.currentLibraryDraftId || undefined });
    this.outputJson = "";
    this.status = createStatus(published.ok ? (published.warnings.length > 0 ? "warning" : "success") : "warning", published.ok ? (published.warnings[0] ?? `Published finalized travel event "${published.entry.name}" to the Published Events library.`) : firstError(published, "Published event could not be created."));
    await this.#rerenderAfterAction();
  }

  async #onLoadPublishedEvent(event, target) {
    event.preventDefault();
    const id = target.dataset.arcflightBuilderPublishedLoad;
    const cloned = clonePublishedTravelEventToDraft(id);
    if (!cloned.draft) {
      this.status = createStatus("warning", firstError(cloned, "Published event could not be loaded as a draft."));
      await this.#rerenderAfterAction();
      return;
    }

    this.draft = cloneData(cloned.draft);
    this.currentLibraryDraftId = "";
    this.outputJson = "";
    this.status = createStatus(cloned.warnings.length > 0 ? "warning" : "success", cloned.warnings[0] ?? `Loaded published event "${cloned.entry.name}" as an editable local draft.`);
    await this.#rerenderAfterAction();
  }

  async #onDuplicatePublishedEvent(event, target) {
    event.preventDefault();
    const id = target.dataset.arcflightBuilderPublishedDuplicate;
    const cloned = clonePublishedTravelEventToDraft(id, { duplicate: true });
    if (!cloned.draft) {
      this.status = createStatus("warning", firstError(cloned, "Published event could not be duplicated as a draft."));
      await this.#rerenderAfterAction();
      return;
    }

    this.draft = cloneData(cloned.draft);
    this.currentLibraryDraftId = "";
    this.outputJson = "";
    this.status = createStatus(cloned.warnings.length > 0 ? "warning" : "success", cloned.warnings[0] ?? `Duplicated published event "${cloned.entry.name}" as a distinct editable local draft.`);
    await this.#rerenderAfterAction();
  }

  async #onDeletePublishedEvent(event, target) {
    event.preventDefault();
    const id = target.dataset.arcflightBuilderPublishedDelete;
    const loaded = loadPublishedTravelEventFromLibrary(id);
    const label = loaded.entry?.name ?? id;
    const confirmed = await this.#confirmBuilderDialog({ title: "Delete Published Event", content: `<p>Delete published travel event <strong>${label}</strong>? This removes only the published-library record and does not change saved drafts.</p>`, yesLabel: "Delete Published Event", unavailableMessage: "Delete requires Foundry DialogV2; Published Events library was not changed." });
    if (!confirmed) {
      this.status = createStatus("info", "Delete cancelled; Published Events library was not changed.");
      await this.#rerenderAfterAction();
      return;
    }

    const deleted = await deletePublishedTravelEventFromLibrary(id);
    this.status = createStatus(deleted.ok ? "success" : "warning", deleted.ok ? `Deleted published event "${deleted.deleted.name}" from the Published Events library.` : firstError(deleted, "Published event could not be deleted."));
    await this.#rerenderAfterAction();
  }

  async #onRefreshPublishedLibrary(event) {
    event.preventDefault();
    this.status = createStatus("success", "Published Events library refreshed from the Arcflight world setting.");
    await this.#rerenderAfterAction();
  }

  async #writeJsonOutput(json, filename) {
    if (globalThis.saveDataToFile) {
      saveDataToFile(json, "application/json", filename);
      return "downloaded";
    }
    await globalThis.navigator?.clipboard?.writeText?.(json);
    return "copied";
  }

  async #onExportPublishedEvent(event, target) {
    event.preventDefault();
    const id = target.dataset.arcflightBuilderPublishedExport;
    const loaded = loadPublishedTravelEventFromLibrary(id);
    const exported = loaded.event ? exportPublishedTravelEventToJson(loaded.event) : { ok: false, errors: loaded.errors, json: null };
    if (!exported.ok || !exported.json) {
      this.status = createStatus("warning", firstError(exported, "Published event export failed."));
      return this.#rerenderAfterAction();
    }
    const mode = await this.#writeJsonOutput(exported.json, `arcflight-published-travel-event-${loaded.event.key || id}.json`);
    this.outputJson = exported.json;
    this.status = createStatus("success", `Published event JSON ${mode}; export did not mutate anything.`);
    await this.#rerenderAfterAction();
  }

  async #onExportPublishedPack(event) {
    event.preventDefault();
    const exported = exportPublishedTravelEventPackToJson(getPublishedTravelEventLibrary());
    if (!exported.ok || !exported.json) {
      this.status = createStatus("warning", firstError(exported, "Published event pack export failed."));
      return this.#rerenderAfterAction();
    }
    const mode = await this.#writeJsonOutput(exported.json, "arcflight-published-travel-event-pack.json");
    this.outputJson = exported.json;
    this.status = createStatus("success", `Published event pack JSON ${mode}; export did not mutate anything.`);
    await this.#rerenderAfterAction();
  }

  async #onImportPublishedJson(event) {
    event.preventDefault();
    const dialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (typeof dialogV2?.prompt !== "function" || typeof dialogV2?.confirm !== "function") {
      this.status = createStatus("warning", "Import requires Foundry DialogV2; Published Events library was not changed.");
      return this.#rerenderAfterAction();
    }
    let jsonText = "";
    try {
      jsonText = await dialogV2.prompt({ window: { title: "Import Published Travel Event JSON" }, content: `<form><div class="form-group"><label>Paste single event or pack JSON</label><textarea name="jsonText" rows="16"></textarea></div><p class="notes">Preview is shown before saving. Import writes only to the Published Travel Event Library after confirmation.</p></form>`, rejectClose: false, ok: { label: "Preview Import", callback: (event, _button, dialog) => String(new FormData(event?.currentTarget?.closest?.("form") ?? dialog?.element?.querySelector?.("form") ?? dialog?.element?.[0]?.querySelector?.("form")).get("jsonText") ?? "") }, cancel: { label: "Cancel" } });
    } catch (_error) { jsonText = ""; }
    if (!jsonText) {
      this.status = createStatus("info", "Import cancelled; Published Events library was not changed.");
      return this.#rerenderAfterAction();
    }
    const isPack = /arcflight\.publishedTravelEventPack/.test(jsonText);
    const imported = isPack ? importPublishedTravelEventPackFromJson(jsonText) : importPublishedTravelEventFromJson(jsonText);
    const preview = imported.preview ?? {};
    const rows = (preview.events ?? []).map((row) => `<li>${row.valid ? "✓" : "✗"} <strong>${row.name}</strong> (<code>${row.key}</code>) — ${row.category}, ${row.roundCount} rounds${row.duplicateKey ? " — duplicate key" : ""}; ${row.actionRequired}</li>`).join("");
    const errors = (preview.errors ?? imported.errors ?? []).map((error) => `<li>${error}</li>`).join("");
    const warnings = (preview.warnings ?? imported.warnings ?? []).map((warning) => `<li>${warning}</li>`).join("");
    const confirmed = await dialogV2.confirm({ window: { title: imported.ok ? "Confirm Published Import" : "Published Import Blocked" }, content: `<section><p>Type: ${isPack ? "pack" : "single event"}. Events: ${preview.eventCount ?? 0}.</p><ul>${rows}</ul>${errors ? `<h3>Errors</h3><ul>${errors}</ul>` : ""}${warnings ? `<h3>Warnings</h3><ul>${warnings}</ul>` : ""}<p>Duplicate defaults: ${preview.defaultDuplicateBehavior ?? "save-as-copy"}. Overwrite is not used by this default import.</p></section>`, yes: { label: imported.ok ? "Save Import" : "Close" }, no: { label: "Cancel" }, rejectClose: false });
    if (!imported.ok || !confirmed) {
      this.status = createStatus(imported.ok ? "info" : "warning", imported.ok ? "Import cancelled; Published Events library was not changed." : firstError(imported, "Import blocked by validation errors."));
      return this.#rerenderAfterAction();
    }
    const saved = isPack ? await saveImportedPublishedTravelEventPackToLibrary(imported.events, { duplicateMode: "copy" }) : await saveImportedPublishedTravelEventToLibrary(imported.event, { duplicateMode: "copy" });
    this.status = createStatus(saved.ok ? "success" : "warning", saved.ok ? `Imported ${isPack ? saved.entries.length : 1} published travel event record(s).` : firstError(saved, "Import save failed."));
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
    this.currentLibraryDraftId = "";
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
