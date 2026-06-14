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
  togglePublishedTravelEventFavorite,
  updatePublishedTravelEventLibraryTags,
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
  parsePublishedTravelEventJson,
  parsePublishedTravelEventPackJson,
  saveImportedPublishedTravelEventToLibrary,
  saveImportedPublishedTravelEventPackToLibrary
} from "../helpers/travel-event-builder-io.js";
import {
  preparePublishedTravelEventRunnerLaunchState,
  startTravelEventRunnerFromPublishedEvent
} from "../helpers/travel-event-runner.js";
import { openTravelEventRunner } from "./travel-event-runner.js";

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
  "[data-arcflight-builder-published-run]",
  "[data-arcflight-builder-published-favorite]",
  "[data-arcflight-builder-published-edit-tags]",
  "[data-arcflight-builder-published-category-view]",
  "[data-arcflight-builder-published-clear-filters]",
  "[data-arcflight-builder-import]",
  "[data-arcflight-builder-export-draft]",
  "[data-arcflight-builder-export-final]"
].join(", ");
const BUILDER_LIBRARY_FILTER_SELECTOR = "[data-arcflight-builder-published-filter]";

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

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderPublishedTravelEventImportPreviewHtml(preview = {}, options = {}) {
  const isPack = options.isPack === true;
  const rows = (Array.isArray(preview.events) ? preview.events : []).map((row) => `<li>${row.valid ? "✓" : "✗"} <strong>${escapeHtml(row.name)}</strong> (<code>${escapeHtml(row.key)}</code>) — ${escapeHtml(row.category)}, ${escapeHtml(row.roundCount)} rounds${row.duplicateKey ? " — duplicate key" : ""}; ${escapeHtml(row.actionRequired)}</li>`).join("");
  const errors = (Array.isArray(preview.errors) ? preview.errors : []).map((error) => `<li>${escapeHtml(error)}</li>`).join("");
  const warnings = (Array.isArray(preview.warnings) ? preview.warnings : []).map((warning) => `<li>${escapeHtml(warning)}</li>`).join("");
  const modeHint = typeof options.modeHint === "string" && options.modeHint.length > 0 ? `<p>${escapeHtml(options.modeHint)}</p>` : "";
  return `<section><p>Type: ${isPack ? "pack" : "single event"}. Events: ${escapeHtml(preview.eventCount ?? 0)}.</p><ul>${rows}</ul>${errors ? `<h3>Errors</h3><ul>${errors}</ul>` : ""}${warnings ? `<h3>Warnings</h3><ul>${warnings}</ul>` : ""}${modeHint}</section>`;
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
  #boundBuilderKeydown = this.#onBuilderKeydown.bind(this);
  #pendingScrollState = null;

  constructor(options = {}) {
    super(options);
    this.draft = normalizeTravelEventDraft(options.draft ?? createTravelEventDraft());
    this.outputJson = "";
    this.currentLibraryDraftId = typeof options.libraryDraftId === "string" ? options.libraryDraftId : "";
    this.status = createStatus("info", "Draft is local to this window until you explicitly save it to the Saved Drafts library.");
    this.uiState = {
      scrollTop: 0,
      scrollSelector: "",
      librarySearchText: "",
      libraryCategoryFilter: "all",
      libraryTagFilter: "all",
      libraryRoundCountFilter: "all",
      librarySortMode: "updatedDesc",
      libraryFavoritesOnly: false
    };
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

  render(force, options) {
    if (force === true) this.#captureScrollPosition();
    return super.render(force, options);
  }

  #getApplicationRoot() {
    return this.element?.closest?.(".app, .application, .window-app")
      ?? this.element
      ?? null;
  }

  #getScrollCandidates() {
    const root = this.#getApplicationRoot();
    const selectors = [
      ".arcflight-travel-builder",
      ".arcflight-travel-builder-mvp",
      ".window-content",
      ".application-content",
      "[data-application-part='builder']",
      "[data-application-part]"
    ];
    const candidates = [];
    for (const element of [this.element, root]) {
      if (element) candidates.push({ element, selector: "" });
    }
    for (const selector of selectors) {
      const scoped = root?.querySelector?.(selector);
      if (scoped) candidates.push({ element: scoped, selector });
      const local = this.element?.querySelector?.(selector);
      if (local) candidates.push({ element: local, selector });
    }
    return candidates.filter((candidate, index, array) => candidate.element && array.findIndex((other) => other.element === candidate.element) === index);
  }

  #isScrollable(element) {
    return Boolean(element && Number(element.scrollHeight) > Number(element.clientHeight) + 1);
  }

  #findScrollContainer(preferredSelector = "") {
    const candidates = this.#getScrollCandidates();
    if (preferredSelector) {
      const preferred = candidates.find((candidate) => candidate.selector === preferredSelector && this.#isScrollable(candidate.element));
      if (preferred) return preferred;
    }
    return candidates.find((candidate) => this.#isScrollable(candidate.element) && Number(candidate.element.scrollTop) > 0)
      ?? candidates.find((candidate) => this.#isScrollable(candidate.element))
      ?? candidates.find((candidate) => candidate.element)
      ?? null;
  }

  #captureScrollPosition() {
    const candidate = this.#findScrollContainer(this.uiState.scrollSelector);
    if (!candidate?.element || !Number.isFinite(Number(candidate.element.scrollTop))) return;
    this.uiState.scrollTop = candidate.element.scrollTop;
    this.uiState.scrollSelector = candidate.selector;
    this.#pendingScrollState = { scrollTop: candidate.element.scrollTop, selector: candidate.selector };
  }

  #restoreScrollPosition() {
    if (!this.#pendingScrollState) return;
    const { scrollTop, selector } = this.#pendingScrollState;
    this.#pendingScrollState = null;
    const restore = () => {
      const candidate = this.#findScrollContainer(selector);
      if (candidate?.element) {
        candidate.element.scrollTop = scrollTop;
        this.uiState.scrollTop = scrollTop;
        this.uiState.scrollSelector = candidate.selector;
      }
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => requestAnimationFrame(restore));
    else setTimeout(restore, 0);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const shell = prepareTravelEventBuilderShellState(this.draft, { ...options, currentId: this.currentLibraryDraftId, ...this.#publishedLibraryFilterOptions() });

    return {
      ...context,
      ...shell,
      outputJson: this.outputJson,
      hasOutputJson: typeof this.outputJson === "string" && this.outputJson.trim().length > 0,
      status: this.status,
      hasStatus: Boolean(this.status?.message),
      uiState: this.uiState,
      hardBoundaryHint: "Authoring shell only: saved drafts and published event records use Arcflight world settings, but there are no compendium writes, actor mutation, chat posting, travel-event running, AP/RAP mechanics, combat automation, or staged-effect application."
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    this.element?.removeEventListener("click", this.#boundBuilderClick);
    this.element?.addEventListener("click", this.#boundBuilderClick);
    this.element?.removeEventListener("change", this.#boundBuilderChange);
    this.element?.addEventListener("change", this.#boundBuilderChange);
    this.element?.removeEventListener("input", this.#boundBuilderChange);
    this.element?.addEventListener("input", this.#boundBuilderChange);
    this.element?.removeEventListener("keydown", this.#boundBuilderKeydown);
    this.element?.addEventListener("keydown", this.#boundBuilderKeydown);
    this.#restoreScrollPosition();
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
    if (target.hasAttribute("data-arcflight-builder-published-run")) return this.#onRunPublishedEvent(event, target);
    if (target.hasAttribute("data-arcflight-builder-published-favorite")) return this.#onTogglePublishedFavorite(event, target);
    if (target.hasAttribute("data-arcflight-builder-published-edit-tags")) return this.#onEditPublishedTags(event, target);
    if (target.hasAttribute("data-arcflight-builder-published-category-view")) return this.#onPublishedCategoryView(event, target);
    if (target.hasAttribute("data-arcflight-builder-published-clear-filters")) return this.#onClearPublishedLibraryFilters(event);
    if (target.hasAttribute("data-arcflight-builder-import")) return this.#onImportDraft(event);
    if (target.hasAttribute("data-arcflight-builder-export-draft")) return this.#onExportDraft(event);
    if (target.hasAttribute("data-arcflight-builder-export-final")) return this.#onExportFinal(event);
  }


  async #onBuilderKeydown(event) {
    const target = event.target?.closest?.('[data-arcflight-builder-published-filter="librarySearchText"]');
    if (!target || !this.element?.contains(target) || event.key !== "Enter") return;
    event.preventDefault();
    this.uiState.librarySearchText = target.value ?? "";
    this.status = createStatus("success", "Updated Published Events library search.");
    await this.#rerenderAfterAction();
  }

  async #onBuilderChange(event) {
    const target = event.target?.closest?.(`[data-arcflight-builder-form-field], [data-arcflight-builder-round-field], [data-arcflight-builder-final-outcome-field], [data-arcflight-builder-final-outcome-effect-field], ${BUILDER_LIBRARY_FILTER_SELECTOR}`);
    if (!target || !this.element?.contains(target)) return;
    if (target.hasAttribute("data-arcflight-builder-published-filter")) return this.#onPublishedLibraryFilterChange(event, target);
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

  #publishedLibraryFilterOptions() {
    return {
      librarySearchText: this.uiState.librarySearchText,
      libraryCategoryFilter: this.uiState.libraryCategoryFilter,
      libraryTagFilter: this.uiState.libraryTagFilter,
      libraryRoundCountFilter: this.uiState.libraryRoundCountFilter,
      librarySortMode: this.uiState.librarySortMode,
      libraryFavoritesOnly: this.uiState.libraryFavoritesOnly === true || this.uiState.libraryFavoritesOnly === "favorites"
    };
  }

  async #onPublishedLibraryFilterChange(event, target) {
    event.preventDefault();
    const key = target.dataset.arcflightBuilderPublishedFilter;
    if (!Object.hasOwn(this.uiState, key)) return;
    this.uiState[key] = target.value ?? "";
    if (key === "librarySearchText" && event.type === "input") return;
    this.status = createStatus("success", key === "librarySearchText" ? "Updated Published Events library search." : "Updated Published Events library filters.");
    await this.#rerenderAfterAction();
  }

  async #onClearPublishedLibraryFilters(event) {
    event.preventDefault();
    this.uiState.librarySearchText = "";
    this.uiState.libraryCategoryFilter = "all";
    this.uiState.libraryTagFilter = "all";
    this.uiState.libraryRoundCountFilter = "all";
    this.uiState.librarySortMode = "updatedDesc";
    this.uiState.libraryFavoritesOnly = false;
    this.status = createStatus("success", "Cleared Published Events library filters.");
    await this.#rerenderAfterAction();
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
    const confirmed = await this.#confirmBuilderDialog({ title: "Delete Saved Draft", content: `<p>Delete saved travel event draft <strong>${escapeHtml(id)}</strong>? This only removes the builder-library copy.</p>`, yesLabel: "Delete Draft", unavailableMessage: "Delete requires Foundry DialogV2; saved draft library was not changed." });
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

  async #onTogglePublishedFavorite(event, target) {
    event.preventDefault();
    const id = target.dataset.arcflightBuilderPublishedFavorite;
    const toggled = await togglePublishedTravelEventFavorite(id);
    this.status = createStatus(toggled.ok ? "success" : "warning", toggled.ok ? `${toggled.favorite ? "Favorited" : "Unfavorited"} published event "${toggled.entry.name}".` : firstError(toggled, "Published event favorite could not be updated."));
    await this.#rerenderAfterAction();
  }

  async #onPublishedCategoryView(event, target) {
    event.preventDefault();
    const view = target.dataset.arcflightBuilderPublishedCategoryView || "all";
    this.uiState.libraryFavoritesOnly = view === "favorites";
    this.uiState.libraryCategoryFilter = view === "favorites" ? "all" : view;
    this.status = createStatus("success", "Updated Published Events category view.");
    await this.#rerenderAfterAction();
  }

  async #onEditPublishedTags(event, target) {
    event.preventDefault();
    const id = target.dataset.arcflightBuilderPublishedEditTags;
    const loaded = loadPublishedTravelEventFromLibrary(id);
    if (!loaded.entry) {
      this.status = createStatus("warning", firstError(loaded, "Published event tags could not be edited."));
      await this.#rerenderAfterAction();
      return;
    }
    const dialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (!dialogV2?.wait) {
      this.status = createStatus("warning", "Editing library tags requires Foundry DialogV2; Published Events library was not changed.");
      await this.#rerenderAfterAction();
      return;
    }
    const currentTags = Array.isArray(loaded.entry.tags) ? loaded.entry.tags.join(", ") : "";
    const result = await dialogV2.wait({
      window: { title: `Edit Library Tags: ${loaded.entry.name}` },
      content: `<form><div class="form-group"><label>Library tags</label><textarea name="libraryTags" rows="6">${escapeHtml(currentTags)}</textarea></div><p class="notes">Separate tags with commas or new lines. This updates only Published Travel Event Library entry metadata.</p></form>`,
      buttons: [{ action: "save", label: "Save Tags", default: true, callback: (event, _button, dialog) => readTextareaValue(dialog.element, "[name='libraryTags']") }, { action: "cancel", label: "Cancel" }],
      close: () => null
    });
    if (result == null) {
      this.status = createStatus("info", "Library tag edit cancelled; Published Events library was not changed.");
      await this.#rerenderAfterAction();
      return;
    }
    const updated = await updatePublishedTravelEventLibraryTags(id, result);
    this.status = createStatus(updated.ok ? "success" : "warning", updated.ok ? `Updated library tags for "${updated.entry.name}".` : firstError(updated, "Published event tags could not be saved."));
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

  async #onRunPublishedEvent(event, target) {
    event.preventDefault();
    const id = target.dataset.arcflightBuilderPublishedRun;
    const dialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    const launchState = preparePublishedTravelEventRunnerLaunchState({ idOrKey: id });
    if (!launchState.ok || !launchState.event) {
      this.status = createStatus("warning", launchState.errors?.[0] ?? "Published event could not be prepared for the runner.");
      await this.#rerenderAfterAction();
      return;
    }
    if (typeof dialogV2?.prompt !== "function") {
      this.status = createStatus("warning", "Starting a published event from the library requires Foundry DialogV2; no runner session was created.");
      await this.#rerenderAfterAction();
      return;
    }

    const shipOptions = launchState.shipOptions.length
      ? launchState.shipOptions.map((ship) => `<option value="${escapeHtml(ship.id)}" data-actor-uuid="${escapeHtml(ship.uuid)}" ${ship.selected ? "selected" : ""}>${escapeHtml(ship.label)}</option>`).join("")
      : `<option value="" selected>No PF2E vehicle actors available</option>`;
    let formData = null;
    try {
      formData = await dialogV2.prompt({
        window: { title: `Start Travel Event Run: ${launchState.event.name}` },
        content: `<form><p>Start a local Travel Event Runner session from a cloned snapshot of <strong>${escapeHtml(launchState.event.name)}</strong>.</p><div class="form-group"><label>Ship / PF2E vehicle</label><select name="actorId" ${launchState.shipOptions.length ? "" : "disabled"}>${shipOptions}</select></div><div class="form-group"><label>Session name</label><input type="text" name="sessionName" value="${escapeHtml(launchState.defaultSessionName)}"></div><div class="form-group"><label>Session notes</label><textarea name="notes" rows="4" placeholder="Optional GM notes for this runner session"></textarea></div><p class="notes">This creates only a local runner session. It does not mutate actors, resources, proposed effects, chat, journals, combat, drafts, published events, favorites, or tags.</p></form>`,
        rejectClose: false,
        ok: {
          label: "Start Run",
          callback: (event, _button, dialog) => {
            const form = event?.currentTarget?.closest?.("form") ?? dialog?.element?.querySelector?.("form") ?? dialog?.element?.[0]?.querySelector?.("form");
            const data = new FormData(form);
            const select = form?.querySelector?.("[name='actorId']");
            return {
              actorId: String(data.get("actorId") ?? ""),
              actorUuid: select?.selectedOptions?.[0]?.dataset?.actorUuid ?? "",
              sessionName: String(data.get("sessionName") ?? ""),
              notes: String(data.get("notes") ?? "")
            };
          }
        },
        cancel: { label: "Cancel" }
      });
    } catch (_error) {
      formData = null;
    }
    if (!formData) {
      this.status = createStatus("info", "Run start cancelled; no runner session was created.");
      await this.#rerenderAfterAction();
      return;
    }

    const started = await startTravelEventRunnerFromPublishedEvent(id, formData);
    if (!started.ok || !started.session) {
      this.status = createStatus("warning", firstError(started, "Published event runner session could not be started."));
      await this.#rerenderAfterAction();
      return;
    }
    openTravelEventRunner({ session: started.session, selectedEventId: id, currentSessionCollapsed: false });
    this.status = createStatus(started.warnings.length > 0 ? "warning" : "success", started.warnings[0] ?? `Started runner session "${started.session.name}" from published event "${started.session.event.name}".`);
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
    const confirmed = await this.#confirmBuilderDialog({ title: "Delete Published Event", content: `<p>Delete published travel event <strong>${escapeHtml(label)}</strong>? This removes only the published-library record and does not change saved drafts.</p>`, yesLabel: "Delete Published Event", unavailableMessage: "Delete requires Foundry DialogV2; Published Events library was not changed." });
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
    const saveDataToFile = globalThis.foundry?.utils?.saveDataToFile;
    if (typeof saveDataToFile === "function") {
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

  #getDialogForm(event, dialog) {
    return event?.currentTarget?.closest?.("form") ?? dialog?.element?.querySelector?.("form") ?? dialog?.element?.[0]?.querySelector?.("form") ?? null;
  }

  #readDialogFormValue(event, dialog, fieldName) {
    const form = this.#getDialogForm(event, dialog);
    if (!form) return "";
    try {
      return String(new FormData(form).get(fieldName) ?? "");
    } catch (_error) {
      return "";
    }
  }

  async #readFileText(file) {
    if (!file) return "";
    try {
      if (typeof file.text === "function") return String(await file.text());
      if (typeof FileReader === "function") {
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.addEventListener("load", () => resolve(String(reader.result ?? "")), { once: true });
          reader.addEventListener("error", () => resolve(""), { once: true });
          reader.readAsText(file);
        });
      }
    } catch (_error) {
      return "";
    }
    return "";
  }

  async #readPublishedImportJsonInput(event, dialog) {
    const form = this.#getDialogForm(event, dialog);
    if (!form) return "";
    const file = form.querySelector?.("[name='jsonFile']")?.files?.[0] ?? null;
    if (file) return this.#readFileText(file);
    try {
      return String(new FormData(form).get("jsonText") ?? "");
    } catch (_error) {
      return "";
    }
  }

  #getPublishedImportKind(jsonText) {
    const packParsed = parsePublishedTravelEventPackJson(jsonText);
    if (packParsed.ok || packParsed.data?.exportType === "arcflight.publishedTravelEventPack") return { ok: true, isPack: true };

    const singleParsed = parsePublishedTravelEventJson(jsonText);
    if (singleParsed.ok || singleParsed.data?.exportType === "arcflight.publishedTravelEvent") return { ok: true, isPack: false };

    return { ok: false, isPack: false };
  }

  async #requestPublishedImportDuplicateMode(preview, isPack) {
    const conflicts = Array.isArray(preview?.duplicateKeyConflicts) ? preview.duplicateKeyConflicts : [];
    if (conflicts.length === 0) return { cancelled: false, duplicateMode: "copy", confirmOverwrite: false };

    const dialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (typeof dialogV2?.prompt !== "function" || typeof dialogV2?.confirm !== "function") return { cancelled: true, duplicateMode: "cancel", confirmOverwrite: false };

    const copyLabel = isPack ? "Save duplicates as copies" : "Save as copy";
    const options = isPack
      ? `<option value="copy">${copyLabel}</option><option value="skip">Skip duplicates</option><option value="overwrite">Overwrite duplicates</option>`
      : `<option value="copy">${copyLabel}</option><option value="overwrite">Overwrite existing event</option>`;
    const conflictRows = conflicts.map((conflict) => `<li><strong>${escapeHtml(conflict.name)}</strong> (<code>${escapeHtml(conflict.key)}</code>) conflicts with published id <code>${escapeHtml(conflict.duplicateId)}</code>.</li>`).join("");
    let duplicateMode = "";
    try {
      duplicateMode = await dialogV2.prompt({
        window: { title: isPack ? "Resolve Published Event Pack Duplicates" : "Resolve Published Event Duplicate" },
        content: `<form><p>${isPack ? "This pack contains duplicate published event keys." : "This event has a duplicate published event key."}</p><ul>${conflictRows}</ul><div class="form-group"><label>Duplicate handling</label><select name="duplicateMode">${options}</select></div><p class="notes">No overwrite occurs unless you choose overwrite and confirm it in the next dialog.</p></form>`,
        rejectClose: false,
        ok: {
          label: "Continue",
          callback: (event, _button, dialog) => this.#readDialogFormValue(event, dialog, "duplicateMode")
        },
        cancel: { label: "Cancel" }
      });
    } catch (_error) {
      duplicateMode = "";
    }
    if (!duplicateMode) return { cancelled: true, duplicateMode: "cancel", confirmOverwrite: false };
    if (duplicateMode !== "overwrite") return { cancelled: false, duplicateMode, confirmOverwrite: false };

    const overwriteConfirmed = await dialogV2.confirm({
      window: { title: isPack ? "Confirm Published Event Pack Overwrite" : "Confirm Published Event Overwrite" },
      content: `<section><p><strong>Overwrite is destructive for the Published Travel Event Library entries listed below.</strong></p><ul>${conflictRows}</ul><p>Actors, ship resources, AP/RAP, chat, journals, combat, runner sessions, and builder drafts are still not touched.</p></section>`,
      yes: { label: isPack ? "Overwrite Duplicate Events" : "Overwrite Published Event" },
      no: { label: "Cancel" },
      rejectClose: false
    });
    return { cancelled: !overwriteConfirmed, duplicateMode: overwriteConfirmed ? "overwrite" : "cancel", confirmOverwrite: overwriteConfirmed === true };
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
      jsonText = await dialogV2.prompt({
        window: { title: "Import Published Travel Event JSON" },
        content: `<form><div class="form-group"><label>Choose JSON file</label><input type="file" name="jsonFile" accept=".json,application/json"></div><div class="form-group"><label>Or paste single event or pack JSON</label><textarea name="jsonText" rows="16"></textarea></div><p class="notes">If both a file and pasted JSON are provided, the selected file is used. Preview is shown before saving. Import writes only to the Published Travel Event Library after confirmation.</p></form>`,
        rejectClose: false,
        ok: {
          label: "Preview Import",
          callback: (event, _button, dialog) => this.#readPublishedImportJsonInput(event, dialog)
        },
        cancel: { label: "Cancel" }
      });
    } catch (_error) { jsonText = ""; }
    if (!jsonText) {
      this.status = createStatus("info", "Import cancelled; Published Events library was not changed.");
      return this.#rerenderAfterAction();
    }

    const importKind = this.#getPublishedImportKind(jsonText);
    const isPack = importKind.ok === true && importKind.isPack === true;
    const imported = isPack ? importPublishedTravelEventPackFromJson(jsonText) : importPublishedTravelEventFromJson(jsonText);
    const preview = imported.preview ?? {};
    const previewContent = renderPublishedTravelEventImportPreviewHtml(preview, { isPack, modeHint: "Duplicate defaults are safe: save as copy unless you explicitly choose another duplicate action." });
    const confirmed = await dialogV2.confirm({ window: { title: imported.ok ? "Confirm Published Import" : "Published Import Blocked" }, content: previewContent, yes: { label: imported.ok ? "Continue" : "Close" }, no: { label: "Cancel" }, rejectClose: false });
    if (!imported.ok || !confirmed) {
      this.status = createStatus(imported.ok ? "info" : "warning", imported.ok ? "Import cancelled; Published Events library was not changed." : firstError(imported, "Import blocked by validation errors."));
      return this.#rerenderAfterAction();
    }

    const duplicateChoice = await this.#requestPublishedImportDuplicateMode(preview, isPack);
    if (duplicateChoice.cancelled) {
      this.status = createStatus("info", "Import cancelled; Published Events library was not changed.");
      return this.#rerenderAfterAction();
    }

    const saveOptions = { duplicateMode: duplicateChoice.duplicateMode, confirmOverwrite: duplicateChoice.confirmOverwrite === true };
    const saved = isPack ? await saveImportedPublishedTravelEventPackToLibrary(imported.events, saveOptions) : await saveImportedPublishedTravelEventToLibrary(imported.event, saveOptions);
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
