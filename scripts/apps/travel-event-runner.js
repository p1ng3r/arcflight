import { getCoreTravelEvent, getCoreTravelEventKeys } from "../../data/travel-events/core-travel-events.js";
import { arcflightTemplatePath } from "../sheets/sheet-helpers.js";
import { openTravelSceneOverlay, updateActiveTravelSceneOverlayContext } from "./travel-scene-overlay.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";
import { sendTravelPlayerMissionBoardToPlayers, sendTravelPlayerReactionPromptToPlayers } from "./travel-player-station-card.js";
import {
  advanceTravelEventRunnerRoundPhase,
  advanceTravelEventRunnerRound,
  completeTravelEventRunnerSession,
  exportTravelEventRunnerSessionToJson,
  createTravelEventRunnerSummaryJournalEntry,
  deleteTravelEventRunnerSessionFromLibrary,
  duplicateTravelEventRunnerSession,
  importTravelEventRunnerSessionFromJson,
  preparePublishedTravelEventRunnerLaunchState,
  startTravelEventRunnerFromPublishedEvent,
  postTravelEventRunnerSummaryToChat,
  saveImportedTravelEventRunnerSessionToLibrary,
  renderTravelEventRunnerSummaryHtml,
  renderTravelEventRunnerSummaryMarkdown,
  renderTravelEventStagedEffectReviewHtml,
  renderTravelEventStagedEffectReviewMarkdown,
  applyTravelEventRunnerSelectedEffects,
  undoTravelEventAppliedEffect,
  loadTravelEventRunnerSessionFromLibrary,
  prepareTravelEventEffectApplicationState,
  prepareTravelEventRunnerState,
  retreatTravelEventRunnerRoundPhase,
  retreatTravelEventRunnerRound,
  saveTravelEventRunnerSessionToLibrary,
  commitTravelEventRunnerStationOrder,
  setTravelEventRunnerRoundPhase,
  setTravelEventRunnerStationResult,
  updateTravelEventRunnerStationAssignment,
  clearTravelEventRunnerStationAssignment,
  resetTravelEventRunnerStationAssignmentToShip,
  setTravelEventRunnerNpcStationController,
  markTravelFocusEffectApplied,
  dismissTravelFocusEffect,
  updateTravelFocusEffectNote,
  markTravelStabilizeResolutionApplied,
  dismissTravelStabilizeResolution,
  updateTravelStabilizeResolutionNote,
  acceptTravelReactionPrompt, dismissTravelReactionPrompt, updateTravelReactionPromptNote,
  markTravelReactionPromptRerollResult, applyTravelReactionPromptBacklash, dismissTravelReactionPromptBacklash
} from "../helpers/travel-event-runner.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

let activeTravelEventRunner = null;

const RUNNER_CLICK_SELECTOR = [
  "[data-arcflight-start-travel-event-runner]",
  "[data-arcflight-runner-result]",
  "[data-arcflight-runner-previous]",
  "[data-arcflight-runner-next]",
  "[data-arcflight-runner-previous-phase]",
  "[data-arcflight-runner-next-phase]",
  "[data-arcflight-runner-set-phase]",
  "[data-arcflight-runner-complete]",
  "[data-arcflight-runner-toggle-session-actions]",
  "[data-arcflight-runner-toggle-current-session]",
  "[data-arcflight-runner-toggle-compact]",
  "[data-arcflight-runner-export]",
  "[data-arcflight-runner-clear]",
  "[data-arcflight-runner-save]",
  "[data-arcflight-runner-save-as]",
  "[data-arcflight-runner-import-session]",
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
  "[data-arcflight-runner-undo-effect]",
  "[data-arcflight-runner-clear-assignment]",
  "[data-arcflight-runner-reset-assignment]",
  "[data-arcflight-open-travel-scene-overlay]",
  "[data-arcflight-runner-send-mission-board]",
  "[data-arcflight-focus-effect-apply]",
  "[data-arcflight-focus-effect-dismiss]",
  "[data-arcflight-stabilize-resolution-apply]",
  "[data-arcflight-stabilize-resolution-dismiss]",
  "[data-arcflight-reaction-accept]", "[data-arcflight-reaction-dismiss]",
  "[data-arcflight-reaction-reroll-result]", "[data-arcflight-reaction-backlash-apply]", "[data-arcflight-reaction-backlash-dismiss]"
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
  #pendingScrollState = null;

  constructor(options = {}) {
    super(options);
    activeTravelEventRunner = this;
    this.selectedEventId = typeof options.selectedEventId === "string" ? options.selectedEventId : defaultSelectedEventId(options);
    this.session = options.session ?? null;
    this.selectedSessionKey = typeof options.selectedSessionKey === "string" ? options.selectedSessionKey : (this.session?.key ?? "");
    this.selectedShipActorId = typeof options.actorId === "string" ? options.actorId : (typeof options.shipId === "string" ? options.shipId : (typeof options.selectedActorId === "string" ? options.selectedActorId : ""));
    this.selectedShipActorUuid = typeof options.actorUuid === "string" ? options.actorUuid : (typeof options.shipUuid === "string" ? options.shipUuid : (typeof options.selectedActorUuid === "string" ? options.selectedActorUuid : ""));
    this.statusMessage = "Select a published finalized travel event to begin.";
    this.uiState = {
      currentSessionCollapsed: options.currentSessionCollapsed !== false,
      sessionActionsExpanded: options.sessionActionsExpanded === true,
      compactRunner: options.compactRunner === true,
      scrollTop: 0,
      scrollSelector: ""
    };
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
      ".arcflight-travel-runner-mvp",
      ".window-content",
      ".application-content",
      "[data-application-part='runner']",
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

  #isScrollable(element) {
    return Boolean(element && Number(element.scrollHeight) > Number(element.clientHeight) + 1);
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
    const targetActor = this.#getSelectedShipActor();
    const state = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: this.session,
      selectedEventId: this.selectedEventId,
      selectedSessionKey: this.selectedSessionKey,
      actor: targetActor,
      uiState: this.uiState
    });
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
    // Keep any open overlay in sync after the runner has rendered, avoiding render side effects during _prepareContext.
    updateActiveTravelSceneOverlayContext({ session: this.session, actor: this.#getSelectedShipActor() }, { render: true });
    this.#applyCompactPosition();
    this.#restoreScrollPosition();
  }

  async #onRunnerChange(event) {
    const eventSelect = event.target?.closest?.("[data-arcflight-runner-event-select]");
    if (eventSelect && this.element?.contains(eventSelect)) {
      this.selectedEventId = eventSelect.value ?? "";
      this.statusMessage = "Published travel event selected. Start Local Runner Session will ask for a ship/PF2E vehicle before creating a local session.";
      return this.render(true);
    }

    const assignmentSelect = event.target?.closest?.("[data-arcflight-runner-assignment-select]");
    if (assignmentSelect && this.element?.contains(assignmentSelect)) {
      return this.#updateStationAssignment(assignmentSelect);
    }

    const controllerSelect = event.target?.closest?.("[data-arcflight-runner-npc-controller-select]");
    if (controllerSelect && this.element?.contains(controllerSelect)) {
      return this.#updateNpcStationController(controllerSelect);
    }

    const approachSelect = event.target?.closest?.("[data-arcflight-runner-approach-select]");
    if (approachSelect && this.element?.contains(approachSelect)) {
      return this.#updateStationSkillApproach(approachSelect);
    }

    const reactionNote = event.target?.closest?.("[data-arcflight-reaction-note]");
    if (reactionNote && this.element?.contains(reactionNote)) return this.#updateReactionNote(reactionNote);
    const focusNote = event.target?.closest?.("[data-arcflight-focus-effect-note]");
    if (focusNote && this.element?.contains(focusNote)) return this.#updateFocusEffectNote(focusNote);
    const stabilizeNote = event.target?.closest?.("[data-arcflight-stabilize-resolution-note]");
    if (stabilizeNote && this.element?.contains(stabilizeNote)) return this.#updateStabilizeResolutionNote(stabilizeNote);

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
    if (target.hasAttribute("data-arcflight-runner-previous-phase")) return this.#retreatRoundPhase();
    if (target.hasAttribute("data-arcflight-runner-next-phase")) return this.#advanceRoundPhase();
    if (target.hasAttribute("data-arcflight-runner-set-phase")) return this.#setRoundPhase(target);
    if (target.hasAttribute("data-arcflight-runner-complete")) return this.#completeEvent();
    if (target.hasAttribute("data-arcflight-runner-toggle-session-actions")) return this.#toggleSessionActions();
    if (target.hasAttribute("data-arcflight-runner-toggle-current-session")) return this.#toggleCurrentSession();
    if (target.hasAttribute("data-arcflight-runner-toggle-compact")) return this.#toggleCompactRunner();
    if (target.hasAttribute("data-arcflight-runner-export")) return this.#exportSummary();
    if (target.hasAttribute("data-arcflight-runner-clear")) return this.#clearSession();
    if (target.hasAttribute("data-arcflight-runner-save")) return this.#saveCurrentSession({ saveAs: false });
    if (target.hasAttribute("data-arcflight-runner-save-as")) return this.#saveCurrentSession({ saveAs: true });
    if (target.hasAttribute("data-arcflight-runner-import-session")) return this.#importSessionJson();
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
    if (target.hasAttribute("data-arcflight-runner-clear-assignment")) return this.#clearStationAssignment(target);
    if (target.hasAttribute("data-arcflight-runner-reset-assignment")) return this.#resetStationAssignment(target);
    if (target.hasAttribute("data-arcflight-open-travel-scene-overlay")) return this.#openTravelSceneOverlay();
    if (target.hasAttribute("data-arcflight-runner-send-mission-board")) return this.#sendPlayerMissionBoard();
    if (target.hasAttribute("data-arcflight-focus-effect-apply")) return this.#resolveFocusEffect(target, "applied");
    if (target.hasAttribute("data-arcflight-focus-effect-dismiss")) return this.#resolveFocusEffect(target, "dismissed");
    if (target.hasAttribute("data-arcflight-stabilize-resolution-apply")) return this.#resolveStabilizeResolution(target, "applied");
    if (target.hasAttribute("data-arcflight-stabilize-resolution-dismiss")) return this.#resolveStabilizeResolution(target, "dismissed");
    if (target.hasAttribute("data-arcflight-reaction-accept")) return this.#resolveReaction(target, "accept");
    if (target.hasAttribute("data-arcflight-reaction-dismiss")) return this.#resolveReaction(target, "dismiss");
    if (target.hasAttribute("data-arcflight-reaction-reroll-result")) return this.#resolveReaction(target, "reroll");
    if (target.hasAttribute("data-arcflight-reaction-backlash-apply")) return this.#resolveReaction(target, "applyBacklash");
    if (target.hasAttribute("data-arcflight-reaction-backlash-dismiss")) return this.#resolveReaction(target, "dismissBacklash");
  }

  async #resolveReaction(target, action) {
    const id = target.dataset.reactionPromptId ?? "";
    const actions = { accept: () => acceptTravelReactionPrompt(this.session, id), dismiss: () => dismissTravelReactionPrompt(this.session, id), reroll: () => markTravelReactionPromptRerollResult(this.session, id, target.dataset.result ?? ""), applyBacklash: () => applyTravelReactionPromptBacklash(this.session, id), dismissBacklash: () => dismissTravelReactionPromptBacklash(this.session, id) };
    const updated = actions[action]?.() ?? { ok: false, errors: ["Unknown reaction action."] };
    if (updated.ok) this.session = updated.session;
    this.statusMessage = updated.ok ? "Reaction prompt updated." : (updated.errors?.[0] ?? "Could not update reaction prompt.");
    return this.render(true);
  }

  async #updateReactionNote(input) {
    const updated = updateTravelReactionPromptNote(this.session, input.dataset.reactionPromptId ?? "", input.value ?? "");
    if (updated.ok) this.session = updated.session;
    this.statusMessage = updated.ok ? "Reaction note updated." : (updated.errors?.[0] ?? "Could not update reaction note.");
    return this.render(true);
  }

  async #resolveStabilizeResolution(target, status) {
    const stabilizeResolutionId = target.dataset.stabilizeResolutionId ?? "";
    const updated = status === "applied"
      ? markTravelStabilizeResolutionApplied(this.session, stabilizeResolutionId)
      : dismissTravelStabilizeResolution(this.session, stabilizeResolutionId);
    if (updated.ok) this.session = updated.session;
    this.statusMessage = updated.ok
      ? (status === "applied" ? "Stabilize pressure resolution applied." : "Stabilize pressure resolution dismissed.")
      : (updated.errors?.[0] ?? "Could not update Stabilize pressure resolution.");
    return this.render(true);
  }

  async #updateStabilizeResolutionNote(input) {
    const updated = updateTravelStabilizeResolutionNote(this.session, input.dataset.stabilizeResolutionId ?? "", input.value ?? "");
    if (updated.ok) this.session = updated.session;
    this.statusMessage = updated.ok ? "Stabilize resolution note updated." : (updated.errors?.[0] ?? "Could not update Stabilize resolution note.");
    return this.render(true);
  }

  async #resolveFocusEffect(target, status) {
    const focusEffectId = target.dataset.focusEffectId ?? "";
    const updated = status === "applied"
      ? markTravelFocusEffectApplied(this.session, focusEffectId)
      : dismissTravelFocusEffect(this.session, focusEffectId);
    if (updated.ok) this.session = updated.session;
    this.statusMessage = updated.ok
      ? (status === "applied" ? "Focus effect marked applied." : "Focus effect dismissed.")
      : (updated.errors?.[0] ?? "Could not update Focus effect.");
    return this.render(true);
  }

  async #updateFocusEffectNote(input) {
    const updated = updateTravelFocusEffectNote(this.session, input.dataset.focusEffectId ?? "", input.value ?? "");
    if (updated.ok) this.session = updated.session;
    this.statusMessage = updated.ok ? "Focus note updated." : (updated.errors?.[0] ?? "Could not update Focus note.");
    return this.render(true);
  }

  async #sendPlayerMissionBoard() {
    console.debug("Arcflight | GM send/refreshed mission board from runner.", { sessionKey: this.session?.key, roundIndex: this.session?.currentRoundIndex });
    const result = sendTravelPlayerMissionBoardToPlayers(this.session, { actor: this.#getSelectedShipActor(), refresh: true });
    if (!result.ok) ui.notifications?.warn?.(result.errors?.[0] ?? "No active non-GM users found.");
    else ui.notifications?.info?.(`Sent player mission board to ${result.sentRecipients} active player recipient(s).`);
    return result;
  }

  async #openTravelSceneOverlay() {
    await openTravelSceneOverlay({
      session: this.session,
      actor: this.#getSelectedShipActor(),
      onSessionUpdate: async (session) => {
        this.session = session ?? null;
        this.selectedSessionKey = this.session?.key ?? this.selectedSessionKey;
        this.statusMessage = "Travel Scene Overlay updated the active runner session.";
        await this.render(true);
      }
    });
    this.uiState.compactRunner = true;
    this.statusMessage = this.session ? "Travel Scene Overlay opened; runner compacted to keep the scene visible." : "Travel Scene Overlay opened with no active runner session; runner compacted.";
    return this.render(true);
  }

  async #toggleCompactRunner() {
    this.uiState.compactRunner = !this.uiState.compactRunner;
    this.statusMessage = this.uiState.compactRunner ? "Runner compacted." : "Runner expanded.";
    return this.render(true);
  }

  #applyCompactPosition() {
    if (typeof this.setPosition !== "function") return;
    const position = this.uiState.compactRunner
      ? { width: 420, height: 260 }
      : { width: 820, height: 720 };
    this.setPosition(position);
  }

  async #toggleSessionActions() {
    this.uiState.sessionActionsExpanded = !this.uiState.sessionActionsExpanded;
    this.statusMessage = this.uiState.sessionActionsExpanded ? "Session actions expanded." : "Session actions collapsed.";
    return this.render(true);
  }

  async #toggleCurrentSession() {
    this.uiState.currentSessionCollapsed = !this.uiState.currentSessionCollapsed;
    this.statusMessage = this.uiState.currentSessionCollapsed ? "Current Runner Session controls collapsed." : "Current Runner Session details expanded.";
    return this.render(true);
  }

  #resolveActorByIdOrUuid(actorId = "", actorUuid = "") {
    const actors = globalThis.game?.actors;
    if (actorId && typeof actors?.get === "function") {
      const actor = actors.get(actorId);
      if (actor) return actor;
    }
    if (actorUuid && typeof actors?.values === "function") {
      for (const actor of actors.values()) if (actor?.uuid === actorUuid) return actor;
    }
    return null;
  }

  #getControlledShipActorFallback() {
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

  #getSelectedShipActor() {
    return this.#resolveActorByIdOrUuid(this.selectedShipActorId, this.selectedShipActorUuid) ?? this.#getControlledShipActorFallback();
  }

  #getSessionShipActor() {
    const ship = this.session?.ship ?? {};
    return this.#resolveActorByIdOrUuid(ship.actorId, ship.actorUuid) ?? this.#getSelectedShipActor();
  }

  async #startSelectedEvent() {
    const dialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    const launchState = preparePublishedTravelEventRunnerLaunchState({ idOrKey: this.selectedEventId });
    if (!launchState.event) {
      this.statusMessage = launchState.errors?.[0] ?? "Selected published travel event could not be loaded.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    if (!launchState.hasShipOptions) {
      this.statusMessage = "No Arcflight ship or PF2E vehicle actors are available. Create or enable a vehicle actor before starting a travel event run.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    if (!launchState.ok) {
      this.statusMessage = launchState.errors?.[0] ?? "Selected published travel event is not valid for the runner.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    if (typeof dialogV2?.prompt !== "function") {
      this.statusMessage = "Starting a published event from the runner requires Foundry DialogV2; no runner session was created.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }

    const fallbackShip = this.#getSelectedShipActor();
    const preferredShipId = fallbackShip?.id ?? this.selectedShipActorId;
    const shipOptions = launchState.shipOptions.length
      ? launchState.shipOptions.map((ship) => `<option value="${escapeHtml(ship.id)}" data-actor-uuid="${escapeHtml(ship.uuid)}" ${(preferredShipId ? ship.id === preferredShipId : ship.selected) ? "selected" : ""}>${escapeHtml(ship.label)}</option>`).join("")
      : `<option value="" selected>No PF2E vehicle actors available</option>`;

    let formData = null;
    try {
      formData = await dialogV2.prompt({
        window: { title: `Start Travel Event Run: ${escapeHtml(launchState.event.name)}` },
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
      this.statusMessage = "Run start cancelled; no runner session was created.";
      return this.render(true);
    }

    const started = await startTravelEventRunnerFromPublishedEvent(this.selectedEventId, formData);
    if (!started.ok || !started.session) {
      this.statusMessage = started.errors?.[0] ?? "Selected published travel event could not be started.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }

    this.selectedShipActorId = started.session.ship?.actorId ?? formData.actorId ?? this.selectedShipActorId;
    this.selectedShipActorUuid = started.session.ship?.actorUuid ?? formData.actorUuid ?? this.selectedShipActorUuid;
    this.session = started.session;
    this.selectedSessionKey = "";
    this.statusMessage = `Started local runner session for ${started.session.event.name}.`;
    ui.notifications?.info?.(this.statusMessage);
    return this.render(true);
  }

  async #updateStationSkillApproach(select) {
    const roundIndex = Number(select.dataset.roundIndex);
    const stationKey = select.dataset.stationKey ?? "";
    const optionKey = select.value ?? "";
    const updated = commitTravelEventRunnerStationOrder(this.session, roundIndex, stationKey, optionKey);
    if (!updated.ok) {
      this.statusMessage = updated.errors?.[0] ?? "Station skill approach was not updated.";
      ui.notifications?.warn?.(this.statusMessage);
    } else {
      this.session = updated.session;
      this.selectedSessionKey = updated.session.key ?? this.selectedSessionKey;
      this.statusMessage = `Selected station option for ${humanizeIdentifier(stationKey)}.`;
    }
    return this.render(true);
  }

  async #updateStationAssignment(select) {
    const stationKey = select.dataset.stationKey ?? "";
    const actorIdOrUuid = select.value ?? "";
    const updated = actorIdOrUuid
      ? updateTravelEventRunnerStationAssignment(this.session, stationKey, actorIdOrUuid, { ship: this.#getSessionShipActor() })
      : clearTravelEventRunnerStationAssignment(this.session, stationKey, { ship: this.#getSessionShipActor() });
    if (!updated.ok) {
      this.statusMessage = updated.errors?.[0] ?? "Station assignment was not updated.";
      ui.notifications?.warn?.(this.statusMessage);
    } else {
      this.session = updated.session;
      this.selectedSessionKey = updated.session.key ?? this.selectedSessionKey;
      this.statusMessage = actorIdOrUuid ? `Assigned ${updated.assignment?.actorName ?? "actor"} to ${humanizeIdentifier(stationKey)}.` : `Cleared ${humanizeIdentifier(stationKey)} assignment.`;
    }
    return this.render(true);
  }

  async #updateNpcStationController(select) {
    const stationKey = select.dataset.stationKey ?? "";
    const updated = setTravelEventRunnerNpcStationController(this.session, stationKey, select.value ?? "");
    if (!updated.ok) {
      this.statusMessage = updated.errors?.[0] ?? "NPC station controller was not updated.";
      ui.notifications?.warn?.(this.statusMessage);
    } else {
      this.session = updated.session;
      this.selectedSessionKey = updated.session.key ?? this.selectedSessionKey;
      this.statusMessage = updated.controller?.userName ? `Assigned ${updated.controller.userName} to control ${humanizeIdentifier(stationKey)}.` : `Cleared ${humanizeIdentifier(stationKey)} NPC controller.`;
    }
    return this.render(true);
  }

  async #clearStationAssignment(target) {
    const stationKey = target.dataset.stationKey ?? "";
    const updated = clearTravelEventRunnerStationAssignment(this.session, stationKey, { ship: this.#getSessionShipActor() });
    if (!updated.ok) {
      this.statusMessage = updated.errors?.[0] ?? "Station assignment was not cleared.";
      ui.notifications?.warn?.(this.statusMessage);
    } else {
      this.session = updated.session;
      this.selectedSessionKey = updated.session.key ?? this.selectedSessionKey;
      this.statusMessage = `Cleared ${humanizeIdentifier(stationKey)} assignment.`;
    }
    return this.render(true);
  }

  async #resetStationAssignment(target) {
    const stationKey = target.dataset.stationKey ?? "";
    const updated = resetTravelEventRunnerStationAssignmentToShip(this.session, stationKey, { ship: this.#getSessionShipActor() });
    if (!updated.ok) {
      this.statusMessage = updated.errors?.[0] ?? "Station assignment was not reset.";
      ui.notifications?.warn?.(this.statusMessage);
    } else {
      this.session = updated.session;
      this.selectedSessionKey = updated.session.key ?? this.selectedSessionKey;
      this.statusMessage = updated.warnings?.[0] ?? `Reset ${humanizeIdentifier(stationKey)} to the selected ship assignment.`;
      if (updated.warnings?.length) ui.notifications?.warn?.(this.statusMessage);
    }
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
      const pendingReaction = updated.session.reactionPrompts?.records?.find((record) =>
        record.roundIndex === roundIndex
        && record.stationKey === stationKey
        && record.status === "pending"
      );
      if (pendingReaction) sendTravelPlayerReactionPromptToPlayers(updated.session, pendingReaction.reactionPromptId, { actor: this.#getSessionShipActor() });
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

  async #advanceRoundPhase() {
    return this.#applyRoundPhaseMutation(
      advanceTravelEventRunnerRoundPhase(this.session),
      "Advanced to the next round phase.",
      "Could not advance the round phase."
    );
  }

  async #retreatRoundPhase() {
    return this.#applyRoundPhaseMutation(
      retreatTravelEventRunnerRoundPhase(this.session),
      "Returned to the previous round phase.",
      "Could not return to the previous round phase."
    );
  }

  async #setRoundPhase(target) {
    const roundPhase = target.dataset.roundPhase ?? "";
    return this.#applyRoundPhaseMutation(
      setTravelEventRunnerRoundPhase(this.session, roundPhase),
      `Moved to ${target.dataset.roundPhaseLabel || humanizeIdentifier(roundPhase)}.`,
      "Could not set the round phase."
    );
  }

  async #applyRoundPhaseMutation(updated, successMessage, failureMessage) {
    this.session = updated.session ?? this.session;
    this.selectedSessionKey = this.session?.key ?? this.selectedSessionKey;
    this.statusMessage = updated.ok ? successMessage : (updated.errors?.[0] ?? failureMessage);
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
      this.statusMessage = exported.errors?.[0] ?? "No runner session is available to export.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    const filename = `arcflight-runner-session-${this.session?.key || this.session?.event?.key || "export"}.json`;
    const saveDataToFile = globalThis.foundry?.utils?.saveDataToFile;
    if (typeof saveDataToFile === "function") saveDataToFile(exported.json, "application/json", filename);
    else await copyTextToClipboard(exported.json);
    this.statusMessage = typeof saveDataToFile === "function" ? "Session JSON export downloaded." : "Session JSON copied to clipboard.";
    ui.notifications?.info?.(this.statusMessage);
    return this.render(true);
  }

  async #importSessionJson() {
    const dialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (typeof dialogV2?.prompt !== "function" || typeof dialogV2?.confirm !== "function") {
      this.statusMessage = "Import requires Foundry DialogV2; Runner Session Library was not changed.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }

    let jsonText = "";
    try {
      jsonText = await dialogV2.prompt({
        window: { title: "Import Runner Session JSON" },
        content: `<form><div class="form-group"><label for="arcflight-runner-import-json">Paste runner session JSON</label><textarea id="arcflight-runner-import-json" name="jsonText" rows="16" placeholder='{"exportVersion":1,"session":{...}}'></textarea></div><p class="notes">Preview is shown before anything is saved. Import never mutates actors, resources, AP/RAP, chat, journals, combat, drafts, or published events.</p></form>`,
        rejectClose: false,
        ok: {
          label: "Preview Import",
          callback: (event, _button, dialog) => {
            const form = event?.currentTarget?.closest?.("form") ?? dialog?.element?.querySelector?.("form") ?? dialog?.element?.[0]?.querySelector?.("form");
            return String(new FormData(form).get("jsonText") ?? "");
          }
        },
        cancel: { label: "Cancel" }
      });
    } catch (_error) {
      jsonText = "";
    }
    if (!jsonText) {
      this.statusMessage = "Import cancelled; Runner Session Library was not changed.";
      return this.render(true);
    }

    const imported = importTravelEventRunnerSessionFromJson(jsonText);
    const preview = imported.preview ?? {};
    const warnings = (preview.warnings ?? []).map((warning) => `<li>${escapeHtml(warning)}</li>`).join("");
    const errors = (preview.errors ?? []).map((error) => `<li>${escapeHtml(error)}</li>`).join("");
    const content = `<section><h2>Import Preview</h2><dl><dt>Session</dt><dd>${escapeHtml(preview.sessionName)}</dd><dt>Key</dt><dd>${escapeHtml(preview.sessionKey)}</dd><dt>Event</dt><dd>${escapeHtml(preview.eventName)} (${escapeHtml(preview.eventKey)})</dd><dt>Status</dt><dd>${escapeHtml(preview.status)}</dd><dt>Current Round</dt><dd>${escapeHtml(preview.currentRound)}</dd><dt>Completed</dt><dd>${preview.completed ? "Yes" : "No"}</dd><dt>Staged Effects</dt><dd>${escapeHtml(preview.stagedEffectCount)}</dd><dt>Applied Effects</dt><dd>${escapeHtml(preview.appliedEffectCount)}</dd><dt>Undone Effects</dt><dd>${escapeHtml(preview.undoneEffectCount)}</dd></dl>${errors ? `<h3>Errors</h3><ul>${errors}</ul>` : ""}${warnings ? `<h3>Warnings</h3><ul>${warnings}</ul>` : ""}${preview.duplicateKey ? "<p><strong>Conflict:</strong> A saved session with this key already exists. Default import saves a new copy.</p>" : ""}</section>`;
    if (!imported.ok) {
      await dialogV2.confirm({ window: { title: "Import Blocked" }, content, yes: { label: "Close" }, no: { label: "Cancel" }, rejectClose: false });
      this.statusMessage = imported.errors?.[0] ?? "Import blocked by validation errors.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    let mode = "copy";
    let confirmed = false;
    if (preview.duplicateKey) {
      mode = await dialogV2.prompt({
        window: { title: "Import Key Conflict" },
        content: `${content}<form><div class="form-group"><label>Conflict action</label><select name="mode"><option value="copy" selected>Save as new copy</option><option value="overwrite">Overwrite existing</option><option value="cancel">Cancel</option></select></div></form>`,
        rejectClose: false,
        ok: {
          label: "Continue",
          callback: (event, _button, dialog) => {
            const form = event?.currentTarget?.closest?.("form") ?? dialog?.element?.querySelector?.("form") ?? dialog?.element?.[0]?.querySelector?.("form");
            return String(new FormData(form).get("mode") ?? "cancel");
          }
        },
        cancel: { label: "Cancel" }
      });
      confirmed = mode === "copy" || mode === "overwrite";
      if (mode === "overwrite") {
        confirmed = await dialogV2.confirm({ window: { title: "Confirm Overwrite" }, content: `${content}<p><strong>Overwrite is permanent for the saved Runner Session Library entry.</strong></p>`, yes: { label: "Overwrite Existing" }, no: { label: "Cancel" }, rejectClose: false });
      }
    } else {
      confirmed = await dialogV2.confirm({ window: { title: "Save Imported Runner Session" }, content, yes: { label: "Import / Save" }, no: { label: "Cancel" }, rejectClose: false });
    }
    if (!confirmed) {
      this.statusMessage = "Import cancelled; Runner Session Library was not changed.";
      return this.render(true);
    }
    const saved = await saveImportedTravelEventRunnerSessionToLibrary(imported, { mode, confirmOverwrite: mode === "overwrite" });
    return this.#handleSavedSessionResult(saved, "Imported runner session into the Runner Session Library.");
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

export function getActiveTravelEventRunner() {
  return activeTravelEventRunner;
}

export async function updateActiveTravelEventRunnerSession(session, options = {}) {
  const app = activeTravelEventRunner;
  if (!app) return null;
  app.session = session ?? null;
  app.selectedSessionKey = app.session?.key ?? app.selectedSessionKey;
  if (typeof options.statusMessage === "string") app.statusMessage = options.statusMessage;
  await app.render(true);
  return app;
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
