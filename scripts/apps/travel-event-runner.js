import { getCoreTravelEvent, getCoreTravelEventKeys } from "../../data/travel-events/core-travel-events.js";
import { arcflightTemplatePath } from "../sheets/sheet-helpers.js";
import {
  advanceTravelEventRunnerRound,
  completeTravelEventRunnerSession,
  createTravelEventRunnerSession,
  exportTravelEventRunnerSessionToJson,
  createTravelEventRunnerSummaryJournalEntry,
  deleteTravelEventRunnerSessionFromLibrary,
  duplicateTravelEventRunnerSession,
  loadPublishedTravelEventForRunner,
  postTravelEventRunnerSummaryToChat,
  renderTravelEventRunnerSummaryHtml,
  renderTravelEventRunnerSummaryMarkdown,
  renderTravelEventStagedEffectReviewHtml,
  renderTravelEventStagedEffectReviewMarkdown,
  applyTravelEventRunnerSelectedEffects,
  undoTravelEventAppliedEffect,
  loadTravelEventRunnerSessionFromLibrary,
  prepareTravelEventEffectApplicationState,
  prepareTravelEventRunnerState,
  retreatTravelEventRunnerRound,
  saveTravelEventRunnerSessionToLibrary,
  setTravelEventRunnerStationResult
} from "../helpers/travel-event-runner.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const RUNNER_CLICK_SELECTOR = [
  "[data-arcflight-start-travel-event-runner]",
  "[data-arcflight-runner-result]",
  "[data-arcflight-runner-previous]",
  "[data-arcflight-runner-next]",
  "[data-arcflight-runner-complete]",
  "[data-arcflight-runner-export]",
  "[data-arcflight-runner-clear]",
  "[data-arcflight-runner-save]",
  "[data-arcflight-runner-save-as]",
  "[data-arcflight-runner-load-session]",
  "[data-arcflight-runner-duplicate-session]",
  "[data-arcflight-runner-delete-session]",
  "[data-arcflight-runner-refresh-sessions]",
  "[data-arcflight-runner-copy-markdown]",
  "[data-arcflight-runner-copy-html]",
  "[data-arcflight-runner-post-chat]",
  "[data-arcflight-runner-create-journal]",
  "[data-arcflight-runner-refresh-summary]",
  "[data-arcflight-runner-refresh-review]",
  "[data-arcflight-runner-copy-review-markdown]",
  "[data-arcflight-runner-copy-review-html]",
  "[data-arcflight-runner-refresh-application]",
  "[data-arcflight-runner-apply-effects]",
  "[data-arcflight-runner-undo-effect]"
].join(", ");


function humanizeIdentifier(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getResolvedPf2eStatisticModifier(resolution = {}) {
  for (const value of [resolution?.statistic?.mod, resolution?.statistic?.check?.mod, resolution?.statistic?.totalModifier]) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

export function formatStatisticOptionLabel(statisticKey, resolution = null) {
  const label = humanizeIdentifier(statisticKey);
  if (!resolution) return label;
  if (resolution.ok === false) return `${label} (unavailable)`;
  const modifier = getResolvedPf2eStatisticModifier(resolution);
  return modifier == null ? label : `${label} (${modifier >= 0 ? "+" : ""}${modifier})`;
}

export async function resolveTravelStationAssignedActor() {
  return { actor: null, actorUuid: "", actorId: "", actorName: "", actorResolved: false };
}

function cloneData(value) {
  if (value == null) return value;
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}


function escapeHtml(value) {
  if (globalThis.foundry?.utils?.escapeHTML) return foundry.utils.escapeHTML(String(value ?? ""));
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTimestamp(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
  return new Date(timestamp).toLocaleString();
}

function normalizeTravelRollDegree(degree) {
  if (degree === "criticalSuccess" || degree === 3 || degree === "3") return "criticalSuccess";
  if (degree === "success" || degree === 2 || degree === "2") return "success";
  if (degree === "failure" || degree === 1 || degree === "1") return "failure";
  if (degree === "criticalFailure" || degree === 0 || degree === "0") return "criticalFailure";
  return typeof degree === "string" ? degree : "";
}

function getStationName(stationKey) {
  return humanizeIdentifier(stationKey);
}

export function prepareTravelEventNarrativeLog(activeOrCompletedEvent) {
  if (!activeOrCompletedEvent || !Array.isArray(activeOrCompletedEvent.rounds)) return [];

  return activeOrCompletedEvent.rounds
    .flatMap((round, roundIndex) => {
      const roundNumber = Number(round?.round);
      const normalizedRound = Number.isFinite(roundNumber) ? roundNumber : roundIndex + 1;
      const stationResults = Array.isArray(round?.stationResults) ? round.stationResults : [];

      return stationResults.map((result, resultIndex) => {
        const stationKey = result?.stationKey ?? "";
        const degreeOfSuccess = normalizeTravelRollDegree(result?.degreeOfSuccess ?? result?.degree) || (result?.degreeOfSuccess ?? "");
        const recordedAtLabel = formatTimestamp(result?.recordedAt);
        const feedbackText = typeof result?.feedbackText === "string" ? result.feedbackText.trim() : "";
        const narrativeText = typeof result?.narrativeText === "string" ? result.narrativeText.trim() : "";

        return {
          ...cloneData(result),
          roundNumber: normalizedRound,
          roundLabel: `Round ${normalizedRound}`,
          stationKey,
          stationName: getStationName(stationKey),
          degreeOfSuccess,
          degreeLabel: humanizeIdentifier(degreeOfSuccess),
          actorName: result?.actorName ?? "",
          statisticKey: result?.statisticKey ?? "",
          statisticLabel: result?.statisticKey ? humanizeIdentifier(result.statisticKey) : "",
          rollTotal: result?.rollTotal ?? null,
          hasRollTotal: result?.rollTotal !== null && result?.rollTotal !== undefined && result?.rollTotal !== "",
          playerAction: typeof result?.playerAction === "string" ? result.playerAction.trim() : "",
          feedbackText,
          narrativeText,
          resultText: narrativeText || feedbackText,
          notes: result?.notes ?? "",
          recordedAtLabel,
          hasRecordedAtLabel: recordedAtLabel.length > 0,
          _sortRound: normalizedRound,
          _sortIndex: resultIndex
        };
      });
    })
    .sort((a, b) => (a._sortRound - b._sortRound) || (a._sortIndex - b._sortIndex))
    .map(({ _sortRound, _sortIndex, ...row }) => row);
}

export function prepareTravelEventLibraryOptions(selectedKey = "") {
  const keys = getCoreTravelEventKeys();
  const selected = keys.includes(selectedKey) ? selectedKey : (keys[0] ?? "");
  return keys.map((key) => {
    const event = getCoreTravelEvent(key);
    return {
      key,
      name: event?.name ?? humanizeIdentifier(key),
      category: event?.category ?? "",
      categoryLabel: humanizeIdentifier(event?.category),
      roundCount: Number(event?.roundCount) || 0,
      baseDC: Number(event?.baseDC) || 0,
      selected: key === selected
    };
  });
}

export function prepareSelectedTravelEventLibraryDetails(selectedKey = "") {
  const options = prepareTravelEventLibraryOptions(selectedKey);
  return options.find((option) => option.selected) ?? options[0] ?? null;
}

function copyTextToClipboard(text) {
  if (globalThis.navigator?.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const element = document.createElement("textarea");
  element.value = text;
  element.setAttribute("readonly", "");
  element.style.position = "fixed";
  element.style.left = "-9999px";
  document.body.appendChild(element);
  element.select();
  document.execCommand("copy");
  element.remove();
  return Promise.resolve();
}

function defaultSelectedEventId(options = {}) {
  const state = prepareTravelEventRunnerState(null, options);
  return state.library?.selectedEventId ?? "";
}

export class ArcflightTravelEventRunner extends HandlebarsApplicationMixin(ApplicationV2) {
  #boundRunnerClick = this.#onRunnerClick.bind(this);
  #boundRunnerChange = this.#onRunnerChange.bind(this);

  constructor(options = {}) {
    super(options);
    this.selectedEventId = typeof options.selectedEventId === "string" ? options.selectedEventId : defaultSelectedEventId(options);
    this.session = options.session ?? null;
    this.selectedSessionKey = typeof options.selectedSessionKey === "string" ? options.selectedSessionKey : (this.session?.key ?? "");
    this.statusMessage = "Select a published finalized travel event to begin.";
  }

  static DEFAULT_OPTIONS = {
    classes: ["arcflight", "arcflight-travel-event-runner"],
    tag: "section",
    position: { width: 820, height: 720 },
    window: { title: "Travel Event Runner", resizable: true }
  };

  static PARTS = {
    runner: { template: arcflightTemplatePath("apps/travel-event-runner.hbs") }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const targetActor = this.#getSelectedShipActor();
    const state = prepareTravelEventRunnerState(this.session, { selectedEventId: this.selectedEventId, selectedSessionKey: this.selectedSessionKey, actor: targetActor });
    state.effectApplication = prepareTravelEventEffectApplicationState(this.session, targetActor);
    if (!this.selectedEventId) this.selectedEventId = state.library?.selectedEventId ?? "";
    return {
      ...context,
      state,
      selectedEventId: this.selectedEventId,
      statusMessage: this.statusMessage,
      hardBoundaryHint: "Manual MVP only: no automatic application, combat, encounters, AP/RAP, or published-event edits. Proposed effects apply only after explicit GM selection.",
      resultValues: ["criticalFailure", "failure", "success", "criticalSuccess", "skipped"]
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element?.removeEventListener("click", this.#boundRunnerClick);
    this.element?.addEventListener("click", this.#boundRunnerClick);
    this.element?.removeEventListener("change", this.#boundRunnerChange);
    this.element?.addEventListener("change", this.#boundRunnerChange);
  }

  async #onRunnerChange(event) {
    const eventSelect = event.target?.closest?.("[data-arcflight-runner-event-select]");
    if (eventSelect && this.element?.contains(eventSelect)) {
      this.selectedEventId = eventSelect.value ?? "";
      this.statusMessage = "Published travel event selected. Start Event creates a local in-memory session.";
      return this.render(true);
    }

    const sessionSelect = event.target?.closest?.("[data-arcflight-runner-session-select]");
    if (sessionSelect && this.element?.contains(sessionSelect)) {
      this.selectedSessionKey = sessionSelect.value ?? "";
      this.statusMessage = this.selectedSessionKey ? "Saved runner session selected. Load Session resumes from the saved snapshot." : "Select a saved runner session to load, duplicate, or delete.";
      return this.render(true);
    }
  }

  async #onRunnerClick(event) {
    const target = event.target?.closest?.(RUNNER_CLICK_SELECTOR);
    if (!target || !this.element?.contains(target) || target.disabled === true) return;
    event.preventDefault();

    if (target.hasAttribute("data-arcflight-start-travel-event-runner")) return this.#startSelectedEvent();
    if (target.hasAttribute("data-arcflight-runner-result")) return this.#recordStationResult(target);
    if (target.hasAttribute("data-arcflight-runner-previous")) return this.#retreatRound();
    if (target.hasAttribute("data-arcflight-runner-next")) return this.#advanceRound();
    if (target.hasAttribute("data-arcflight-runner-complete")) return this.#completeEvent();
    if (target.hasAttribute("data-arcflight-runner-export")) return this.#exportSummary();
    if (target.hasAttribute("data-arcflight-runner-clear")) return this.#clearSession();
    if (target.hasAttribute("data-arcflight-runner-save")) return this.#saveCurrentSession({ saveAs: false });
    if (target.hasAttribute("data-arcflight-runner-save-as")) return this.#saveCurrentSession({ saveAs: true });
    if (target.hasAttribute("data-arcflight-runner-load-session")) return this.#loadSelectedSession(target);
    if (target.hasAttribute("data-arcflight-runner-duplicate-session")) return this.#duplicateSelectedSession(target);
    if (target.hasAttribute("data-arcflight-runner-delete-session")) return this.#deleteSelectedSession(target);
    if (target.hasAttribute("data-arcflight-runner-refresh-sessions")) return this.#refreshSessions();
    if (target.hasAttribute("data-arcflight-runner-copy-markdown")) return this.#copySummaryMarkdown();
    if (target.hasAttribute("data-arcflight-runner-copy-html")) return this.#copySummaryHtml();
    if (target.hasAttribute("data-arcflight-runner-post-chat")) return this.#postSummaryToChat();
    if (target.hasAttribute("data-arcflight-runner-create-journal")) return this.#createSummaryJournal();
    if (target.hasAttribute("data-arcflight-runner-refresh-summary")) return this.#refreshSummary();
    if (target.hasAttribute("data-arcflight-runner-refresh-review")) return this.#refreshReview();
    if (target.hasAttribute("data-arcflight-runner-copy-review-markdown")) return this.#copyReviewMarkdown();
    if (target.hasAttribute("data-arcflight-runner-copy-review-html")) return this.#copyReviewHtml();
    if (target.hasAttribute("data-arcflight-runner-refresh-application")) return this.#refreshApplicationPreview();
    if (target.hasAttribute("data-arcflight-runner-apply-effects")) return this.#applySelectedEffects();
    if (target.hasAttribute("data-arcflight-runner-undo-effect")) return this.#undoAppliedEffect(target);
  }

  #getSelectedShipActor() {
    const controlled = globalThis.canvas?.tokens?.controlled ?? [];
    for (const token of controlled) {
      const actor = token?.actor;
      if (!actor) continue;
      try {
        if (prepareTravelEventEffectApplicationState(this.session, actor).hasTarget) return actor;
      } catch (_error) {
        // Try the next available actor source.
      }
    }
    return null;
  }

  async #startSelectedEvent() {
    const loaded = loadPublishedTravelEventForRunner(this.selectedEventId);
    if (!loaded.ok || !loaded.event) {
      this.statusMessage = loaded.errors?.[0] ?? "Selected published travel event could not be loaded.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }

    const created = createTravelEventRunnerSession(loaded.event);
    if (!created.ok) {
      this.statusMessage = created.errors?.[0] ?? "Selected published travel event is not valid for the runner.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }

    this.session = created.session;
    this.selectedSessionKey = "";
    this.statusMessage = `Started local runner session for ${created.session.event.name}.`;
    ui.notifications?.info?.(this.statusMessage);
    return this.render(true);
  }

  async #recordStationResult(target) {
    const roundIndex = Number(target.dataset.roundIndex);
    const stationKey = target.dataset.stationKey ?? "";
    const result = target.dataset.result ?? "";
    const updated = setTravelEventRunnerStationResult(this.session, roundIndex, stationKey, result);
    if (!updated.ok) {
      this.statusMessage = updated.errors?.[0] ?? "Station result was not recorded.";
      ui.notifications?.warn?.(this.statusMessage);
    } else {
      this.session = updated.session;
      this.selectedSessionKey = updated.session.key ?? this.selectedSessionKey;
      this.statusMessage = `Recorded ${result} for ${stationKey}.`;
    }
    return this.render(true);
  }

  async #advanceRound() {
    const updated = advanceTravelEventRunnerRound(this.session);
    this.session = updated.session ?? this.session;
    this.selectedSessionKey = this.session?.key ?? this.selectedSessionKey;
    this.statusMessage = updated.ok ? "Advanced to the next round." : (updated.errors?.[0] ?? "Could not advance the runner round.");
    if (!updated.ok) ui.notifications?.warn?.(this.statusMessage);
    return this.render(true);
  }

  async #retreatRound() {
    const updated = retreatTravelEventRunnerRound(this.session);
    this.session = updated.session ?? this.session;
    this.selectedSessionKey = this.session?.key ?? this.selectedSessionKey;
    this.statusMessage = updated.ok ? "Returned to the previous round." : (updated.errors?.[0] ?? "Could not return to the previous round.");
    if (!updated.ok) ui.notifications?.warn?.(this.statusMessage);
    return this.render(true);
  }

  async #completeEvent() {
    const completed = completeTravelEventRunnerSession(this.session);
    if (!completed.ok) {
      this.statusMessage = completed.errors?.[0] ?? "Could not complete the travel event session.";
      ui.notifications?.warn?.(this.statusMessage);
    } else {
      this.session = completed.session;
      this.selectedSessionKey = completed.session.key ?? this.selectedSessionKey;
      this.statusMessage = "Travel event complete. Summary and read-only staged proposed effects are ready.";
      ui.notifications?.info?.(this.statusMessage);
    }
    return this.render(true);
  }

  async #exportSummary() {
    const exported = exportTravelEventRunnerSessionToJson(this.session);
    if (!exported.ok || !exported.json) {
      this.statusMessage = exported.errors?.[0] ?? "No session summary is available to export.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    await copyTextToClipboard(exported.json);
    this.statusMessage = "Session summary JSON copied to clipboard.";
    ui.notifications?.info?.(this.statusMessage);
    return this.render(true);
  }


  async #copyOrFallback(text, successMessage) {
    try {
      await copyTextToClipboard(text);
      this.statusMessage = successMessage;
    } catch (_error) {
      this.statusMessage = "Clipboard unavailable; summary output is shown in the textarea below.";
    }
    ui.notifications?.info?.(this.statusMessage);
    return this.render(true);
  }

  async #copySummaryMarkdown() {
    const rendered = renderTravelEventRunnerSummaryMarkdown(this.session);
    if (!rendered.available || !rendered.markdown) {
      this.statusMessage = rendered.reason ?? "Completed summary output is unavailable.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    return this.#copyOrFallback(rendered.markdown, "Markdown summary copied to clipboard.");
  }

  async #copySummaryHtml() {
    const rendered = renderTravelEventRunnerSummaryHtml(this.session);
    if (!rendered.available || !rendered.html) {
      this.statusMessage = rendered.reason ?? "Completed summary output is unavailable.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    return this.#copyOrFallback(rendered.html, "HTML summary copied to clipboard.");
  }

  async #postSummaryToChat() {
    const posted = await postTravelEventRunnerSummaryToChat(this.session);
    this.statusMessage = posted.created ? "Posted completed runner summary to chat." : (posted.reason ?? posted.errors?.[0] ?? "Summary was not posted to chat.");
    if (posted.created) ui.notifications?.info?.(this.statusMessage); else ui.notifications?.warn?.(this.statusMessage);
    return this.render(true);
  }

  async #createSummaryJournal() {
    const created = await createTravelEventRunnerSummaryJournalEntry(this.session);
    this.statusMessage = created.created ? "Created JournalEntry for completed runner summary." : (created.reason ?? created.errors?.[0] ?? "Summary JournalEntry was not created.");
    if (created.created) ui.notifications?.info?.(this.statusMessage); else ui.notifications?.warn?.(this.statusMessage);
    return this.render(true);
  }

  async #refreshSummary() {
    this.statusMessage = this.session?.status === "completed" ? "Completed summary output refreshed." : "Completed summary output is unavailable until this runner session is completed.";
    return this.render(true);
  }


  async #copyReviewMarkdown() {
    const rendered = renderTravelEventStagedEffectReviewMarkdown(this.session);
    if (!rendered.available || !rendered.markdown) {
      this.statusMessage = rendered.reason ?? "Staged consequence review is unavailable.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    return this.#copyOrFallback(rendered.markdown, "Staged consequence review Markdown copied to clipboard.");
  }

  async #copyReviewHtml() {
    const rendered = renderTravelEventStagedEffectReviewHtml(this.session);
    if (!rendered.available || !rendered.html) {
      this.statusMessage = rendered.reason ?? "Staged consequence review is unavailable.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    return this.#copyOrFallback(rendered.html, "Staged consequence review HTML copied to clipboard.");
  }

  async #refreshReview() {
    this.statusMessage = this.session?.status === "completed" ? "Staged consequence review refreshed. Review only; effects have not been applied." : "Staged consequence review is unavailable until this runner session is completed.";
    return this.render(true);
  }

  async #refreshApplicationPreview() {
    this.statusMessage = this.session?.status === "completed" ? "Manual apply preview refreshed." : "Manual apply preview is unavailable until this runner session is completed.";
    return this.render(true);
  }

  async #applySelectedEffects() {
    const checked = Array.from(this.element?.querySelectorAll?.("[data-arcflight-runner-apply-effect]:checked") ?? []);
    const selectedEffectIds = checked.map((input) => Number(input.value)).filter((value) => Number.isInteger(value));
    if (!selectedEffectIds.length) {
      this.statusMessage = "Select at least one ready resource effect before applying.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    const actor = this.#getSelectedShipActor();
    const result = await applyTravelEventRunnerSelectedEffects(this.session, actor, selectedEffectIds);
    this.session = result.session ?? this.session;
    this.selectedSessionKey = this.session?.key ?? this.selectedSessionKey;
    if (result.applied?.length) {
      this.statusMessage = `Applied ${result.applied.length} selected travel resource effect(s). Save the runner session to preserve records.`;
      ui.notifications?.info?.(this.statusMessage);
    } else {
      this.statusMessage = result.errors?.[0] ?? result.warnings?.[0] ?? "No effects were applied.";
      ui.notifications?.warn?.(this.statusMessage);
    }
    return this.render(true);
  }

  async #confirmRunnerDialog({ title, content, yesLabel = "Confirm", unavailableMessage = "This action requires Foundry DialogV2." } = {}) {
    const dialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (typeof dialogV2?.confirm === "function") return dialogV2.confirm({ window: { title }, content, yes: { label: yesLabel }, no: { label: "Cancel" }, rejectClose: false });
    ui.notifications?.warn?.(unavailableMessage);
    return false;
  }

  async #confirmUndo(record, actor) {
    const content = `<p>Undo this applied travel resource effect?</p><ul><li><strong>Actor:</strong> ${record.actorName || actor?.name || "Unknown"}</li><li><strong>Resource:</strong> ${record.resource}</li><li><strong>Current value:</strong> ${record.afterValue}</li><li><strong>Value after undo:</strong> ${record.beforeValue}</li></ul>`;
    return this.#confirmRunnerDialog({
      title: "Undo Applied Effect",
      content,
      yesLabel: "Undo Applied Effect",
      unavailableMessage: "Undo requires Foundry DialogV2; this environment cannot show the confirmation dialog."
    });
  }

  async #undoAppliedEffect(target) {
    const applicationId = target.dataset.applicationId ?? "";
    const record = (this.session?.appliedEffects?.records ?? []).find((entry) => entry.applicationId === applicationId);
    const actor = this.#getSelectedShipActor() ?? record?.actorId ?? null;
    if (!record) {
      this.statusMessage = "Applied effect record was not found.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    const confirmed = await this.#confirmUndo(record, actor);
    if (!confirmed) {
      this.statusMessage = "Undo cancelled; applied effect history was not changed.";
      return this.render(true);
    }
    const result = await undoTravelEventAppliedEffect(this.session, actor, applicationId);
    this.session = result.session ?? this.session;
    this.selectedSessionKey = this.session?.key ?? this.selectedSessionKey;
    if (result.undone) {
      this.statusMessage = "Applied effect was undone and recorded in history.";
      ui.notifications?.info?.(this.statusMessage);
    } else {
      this.statusMessage = result.warnings?.[0] ?? result.errors?.[0] ?? "Applied effect could not be undone.";
      ui.notifications?.warn?.(this.statusMessage);
    }
    return this.render(true);
  }

  #getDefaultSaveAsName() {
    const sessionName = typeof this.session?.name === "string" ? this.session.name.trim() : "";
    const eventName = typeof this.session?.event?.name === "string" ? this.session.event.name.trim() : "";
    return sessionName || (eventName ? `${eventName} Session Copy` : "Travel Event Session Copy");
  }

  async #requestSaveAsSessionName() {
    const defaultName = this.#getDefaultSaveAsName();
    const dialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (typeof dialogV2?.prompt !== "function") {
      this.statusMessage = "Save As cancelled.";
      ui.notifications?.warn?.("Save As requires Foundry DialogV2; this environment cannot show the naming dialog.");
      return { cancelled: true, name: "" };
    }

    const content = `<form class="arcflight-travel-runner-mvp__save-as-form"><div class="form-group"><label for="arcflight-travel-runner-save-as-name">Session name</label><input id="arcflight-travel-runner-save-as-name" name="sessionName" type="text" value="${escapeHtml(defaultName)}" autocomplete="off" autofocus></div></form>`;
    let name = null;
    try {
      name = await dialogV2.prompt({
        window: { title: "Save Runner Session As" },
        content,
        rejectClose: false,
        ok: {
          label: "Save Copy",
          callback: (event, _button, dialog) => {
            const form = event?.currentTarget?.closest?.("form")
              ?? dialog?.element?.querySelector?.("form")
              ?? dialog?.element?.[0]?.querySelector?.("form");
            const formData = form ? new FormData(form) : null;
            return String(formData?.get("sessionName") ?? "").trim();
          }
        },
        cancel: { label: "Cancel" }
      });
    } catch (_error) {
      return { cancelled: true, name: "" };
    }

    if (typeof name !== "string") return { cancelled: true, name: "" };
    return { cancelled: false, name: name.trim() };
  }

  async #saveCurrentSession({ saveAs = false } = {}) {
    if (!this.session) {
      this.statusMessage = "No runner session is active to save.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }

    const options = {};
    if (saveAs) {
      const requested = await this.#requestSaveAsSessionName();
      if (requested.cancelled) {
        this.statusMessage = "Save As cancelled.";
        return this.render(true);
      }
      if (!requested.name) {
        this.statusMessage = "Save As requires a session name.";
        ui.notifications?.warn?.(this.statusMessage);
        return this.render(true);
      }
      options.name = requested.name;
      options.key = "";
      const copy = cloneData(this.session);
      delete copy.key;
      const savedAs = await saveTravelEventRunnerSessionToLibrary(copy, options);
      return this.#handleSavedSessionResult(savedAs, "Saved current runner session as a new library entry.");
    }

    if (this.session.key) {
      options.key = this.session.key;
      options.overwrite = true;
    }

    const saved = await saveTravelEventRunnerSessionToLibrary(this.session, options);
    return this.#handleSavedSessionResult(saved, "Saved current runner session to the Runner Session Library.");
  }

  async #handleSavedSessionResult(saved, successMessage) {
    if (!saved.ok) {
      this.statusMessage = saved.errors?.[0] ?? "Runner session could not be saved.";
      ui.notifications?.warn?.(this.statusMessage);
    } else {
      this.session = saved.session;
      this.selectedSessionKey = saved.entry.key;
      this.statusMessage = successMessage;
      ui.notifications?.info?.(`${successMessage} (${saved.entry.name})`);
    }
    return this.render(true);
  }

  #getSessionKeyFromTarget(target) {
    return target.dataset.arcflightRunnerLoadSession
      ?? target.dataset.arcflightRunnerDuplicateSession
      ?? target.dataset.arcflightRunnerDeleteSession
      ?? this.selectedSessionKey
      ?? "";
  }

  async #loadSelectedSession(target) {
    const key = this.#getSessionKeyFromTarget(target);
    const loaded = loadTravelEventRunnerSessionFromLibrary(key);
    if (!loaded.ok || !loaded.session) {
      this.statusMessage = loaded.errors?.[0] ?? "Saved runner session could not be loaded.";
      ui.notifications?.warn?.(this.statusMessage);
    } else {
      this.session = loaded.session;
      this.selectedSessionKey = loaded.entry.key;
      this.selectedEventId = loaded.entry.eventKey || this.selectedEventId;
      this.statusMessage = loaded.warnings?.[0] ?? `Loaded saved runner session "${loaded.entry.name}".`;
      if (loaded.warnings?.length) ui.notifications?.warn?.(this.statusMessage);
      else ui.notifications?.info?.(this.statusMessage);
    }
    return this.render(true);
  }

  async #duplicateSelectedSession(target) {
    const key = this.#getSessionKeyFromTarget(target);
    const duplicated = await duplicateTravelEventRunnerSession(key);
    if (!duplicated.ok) {
      this.statusMessage = duplicated.errors?.[0] ?? "Saved runner session could not be duplicated.";
      ui.notifications?.warn?.(this.statusMessage);
    } else {
      this.selectedSessionKey = duplicated.entry.key;
      this.statusMessage = `Duplicated runner session as "${duplicated.entry.name}".`;
      ui.notifications?.info?.(this.statusMessage);
    }
    return this.render(true);
  }

  async #deleteSelectedSession(target) {
    const key = this.#getSessionKeyFromTarget(target);
    const label = target.dataset.sessionName || key;
    const confirmed = await this.#confirmRunnerDialog({
      title: "Delete Runner Session",
      content: `<p>Delete saved runner session <strong>${escapeHtml(label)}</strong>?</p><p>This does not modify published events, actors, resources, chat, or combat.</p>`,
      yesLabel: "Delete",
      unavailableMessage: "Delete requires Foundry DialogV2; this environment cannot show the confirmation dialog."
    });
    if (!confirmed) {
      this.statusMessage = "Delete cancelled; Runner Session Library was not changed.";
      return this.render(true);
    }

    const deleted = await deleteTravelEventRunnerSessionFromLibrary(key);
    if (!deleted.ok) {
      this.statusMessage = deleted.errors?.[0] ?? "Saved runner session could not be deleted.";
      ui.notifications?.warn?.(this.statusMessage);
    } else {
      if (this.selectedSessionKey === deleted.deleted.key) this.selectedSessionKey = "";
      if (this.session?.key === deleted.deleted.key) this.session = null;
      this.statusMessage = `Deleted saved runner session "${deleted.deleted.name}".`;
      ui.notifications?.info?.(this.statusMessage);
    }
    return this.render(true);
  }

  async #refreshSessions() {
    this.statusMessage = "Runner Session Library refreshed from the Arcflight world setting.";
    return this.render(true);
  }

  async #clearSession() {
    this.session = null;
    this.selectedSessionKey = "";
    this.statusMessage = "Local runner session cleared. Published events were not modified.";
    return this.render(true);
  }
}

export function openTravelEventRunner(options = {}, maybeOptions = {}) {
  // Phase J runner sessions are published-event based and local-only. Older
  // ship-sheet callers may still pass a PF2E vehicle actor as the first
  // argument, but opening the runner must never require or validate an actor.
  const actorLikeArgument = options?.type && typeof options.getFlag === "function";
  const appOptions = actorLikeArgument ? maybeOptions : options;
  const app = new ArcflightTravelEventRunner(appOptions ?? {});
  app.render(true);
  return app;
}
