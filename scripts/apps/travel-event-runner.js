import { getCoreTravelEvent, getCoreTravelEventKeys } from "../../data/travel-events/core-travel-events.js";
import { arcflightTemplatePath } from "../sheets/sheet-helpers.js";
import { openTravelSceneOverlay, updateActiveTravelSceneOverlayContext } from "./travel-scene-overlay.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";
import { applyTravelV2PressureToRunnerSession } from "../helpers/travel-v2-session-pressure-application.js";
import { correctTravelV2PressureApplicationOnRunnerSession } from "../helpers/travel-v2-pressure-correction.js";
import { finalizeTravelV2RoundOnRunnerSession } from "../helpers/travel-v2-session-round-finalization.js";
import { completeTravelV2EventOnRunnerSession } from "../helpers/travel-v2-session-event-completion.js";
import { applyTravelV2EventOutcomePackageToRunnerSession } from "../helpers/travel-v2-session-event-outcome-application.js";
import { prepareTravelV2ActorApplicationPreviewFromSession, applyTravelV2ActorApplicationPreview } from "../helpers/travel-v2-actor-application-bridge.js";
import { updateTravelV2FollowUpStatus } from "../helpers/travel-v2-followups.js";
import { applyAllExecutableTravelV2SelectedConsequencesToSession, applyTravelV2SelectedConsequenceToSession, clearAllTravelV2PendingConsequenceSelections, clearTravelV2PendingConsequenceSelection, selectAllSingleSuggestionTravelV2PendingConsequences, selectTravelV2PendingConsequenceCatalogCard, updateTravelV2ConsequenceFollowupStatus, updateTravelV2PendingConsequenceQueueItem } from "../helpers/travel-v2-pending-consequence-queue.js";
import { applyTravelV2ShipScarToActor, repairTravelV2ShipScarOnActor } from "../helpers/travel-v2-ship-scars.js";
import { forceTravelV2Outcome, forceTravelV2EarlyEndRound, forceTravelV2CurrentRoundResults, createLanternTravelV2SampleSession, copyTravelV2DebugReport, isTravelV2DevToolsEnabled, prepareTravelV2EndOfEventResolutionDialogState, prepareTravelV2RoundResolutionDialogState, deleteTravelV2CompletedSessionFromLibrary } from "../helpers/travel-v2-dev-tools.js";
import { sendTravelPlayerMissionBoardToPlayers, sendTravelPlayerReactionPromptToPlayers, queueTravelPlayerMissionBoardRefreshToPlayers } from "./travel-player-station-card.js";
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
  prepareTravelEventRunnerStartupDiagnostics,
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
  setTravelEventRunnerStationAction,
  setTravelEventRunnerRoundPhase,
  setTravelEventRunnerStationResult,
  clearTravelEventRunnerStationResult,
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
  markTravelReactionPromptRerollResult, applyTravelReactionPromptBacklash, dismissTravelReactionPromptBacklash, drawTravelV2RunnerHazard, revealTravelV2RunnerHazard, holdTravelV2RunnerHazard, activateTravelV2RunnerHazard, clearTravelV2RunnerHazard, applyTravelV2RunnerHazardToRound, resolveTravelV2RunnerUnresolvedHazards, spendTravelV2RunnerMomentumDowngrade, dismissTravelV2RunnerShipScar, applyTravelV2FocusBacklash, dismissTravelV2FocusBacklash, useTravelV2SupportRecord, dismissTravelV2SupportRecord, applyTravelV2SupportBacklashRecord, dismissTravelV2SupportBacklashRecord
} from "../helpers/travel-event-runner.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

let activeTravelEventRunner = null;

const RUNNER_CLICK_SELECTOR = [
  "[data-arcflight-start-travel-event-runner]",
  "[data-arcflight-runner-result]",
  "[data-arcflight-runner-clear-result]",
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
  "[data-arcflight-travel-v2-delete-completed-session]",
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
  "[data-arcflight-guided-action]",
  "[data-arcflight-travel-v2-pressure-apply]",
  "[data-arcflight-travel-v2-pressure-correct]",
  "[data-arcflight-travel-v2-round-finalize]",
  "[data-arcflight-travel-v2-event-complete]",
  "[data-arcflight-travel-v2-outcome-apply]",
  "[data-arcflight-travel-v2-actor-apply]",
  "[data-arcflight-travel-v2-follow-up-status]",
  "[data-arcflight-travel-v2-followup-note-status]",
  "[data-arcflight-travel-v2-hazard-draw]",
  "[data-arcflight-travel-v2-hazard-reveal]",
  "[data-arcflight-travel-v2-hazard-hold]",
  "[data-arcflight-travel-v2-hazard-activate]",
  "[data-arcflight-travel-v2-hazard-clear]",
  "[data-arcflight-travel-v2-hazard-apply]",
  "[data-arcflight-travel-v2-momentum-downgrade]",
  "[data-arcflight-travel-v2-ship-scar-apply]",
  "[data-arcflight-travel-v2-ship-scar-dismiss]",
  "[data-arcflight-travel-v2-ship-scar-repair]",
  "[data-arcflight-travel-v2-dev-force-outcome]",
  "[data-arcflight-travel-v2-dev-force-round-result]",
  "[data-arcflight-travel-v2-dev-early-end]",
  "[data-arcflight-travel-v2-dev-lantern-sample]",
  "[data-arcflight-travel-v2-dev-copy-debug]",
  "[data-arcflight-travel-v2-round-review]",
  "[data-arcflight-travel-v2-event-review]",
  "[data-arcflight-travel-v2-narration-refresh]",
  `[data-action="arcflight-travel-v2-select-all-single-suggestion-consequences"]`,
  `[data-action="arcflight-travel-v2-apply-all-selected-consequences"]`,
  `[data-action="arcflight-travel-v2-clear-all-selected-consequences"]`,
  "[data-arcflight-travel-v2-pending-consequence-select]",
  "[data-arcflight-travel-v2-pending-consequence-clear-selection]",
  "[data-arcflight-travel-v2-pending-consequence-apply-selected]",
  "[data-arcflight-travel-v2-pending-consequence-status]",
  "[data-arcflight-focus-effect-apply]",
  "[data-arcflight-focus-effect-dismiss]",
  "[data-arcflight-stabilize-resolution-apply]",
  "[data-arcflight-stabilize-resolution-dismiss]",
  "[data-arcflight-reaction-accept]", "[data-arcflight-reaction-dismiss]",
  "[data-arcflight-reaction-reroll-result]", "[data-arcflight-reaction-backlash-apply]", "[data-arcflight-reaction-backlash-dismiss]",
  "[data-arcflight-focus-backlash-apply]", "[data-arcflight-focus-backlash-dismiss]",
  "[data-arcflight-support-assist-use]", "[data-arcflight-support-assist-dismiss]"
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

function normalizeGuidedRoundOutcomeKey(value) {
  if (["criticalSuccess", "criticalRoundSuccess", "critical-success", "3", 3].includes(value)) return "criticalSuccess";
  if (["success", "roundSuccess", "dominantSuccess", "2", 2].includes(value)) return "success";
  if (["mixed", "narrowRoundSuccess"].includes(value)) return "mixed";
  if (["failure", "roundFailure", "dominantFailure", "1", 1].includes(value)) return "failure";
  if (["criticalFailure", "criticalRoundFailure", "critical-failure", "catastrophicFailure", "0", 0].includes(value)) return "criticalFailure";
  return "mixed";
}

function getRunnerPressureSelectedOutcomeKey(source = {}) {
  const dataset = source?.dataset ?? source ?? {};
  const rawValue = dataset.selectedOutcomeKey
    ?? dataset.outcomeKey
    ?? dataset.arcflightTravelV2PressureApply
    ?? dataset.arcflightTravelV2PressureCorrect
    ?? dataset.travelV2OutcomeKey
    ?? "";
  return typeof rawValue === "string" ? rawValue.trim() : "";
}


function renderTravelV2KeyValueList(rows = []) {
  return `<dl>${rows.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value ?? "")}</dd>`).join("")}</dl>`;
}

function renderTravelV2RoundResolutionDialogHtml(state = {}) {
  const stationRows = Object.entries(state.stationResults ?? {}).map(([station, result]) => `<li><strong>${escapeHtml(humanizeIdentifier(station))}:</strong> ${escapeHtml(result ?? "Not run / ended early")}</li>`).join("") || `<li>Not run / ended early</li>`;
  const pressureRows = (state.pressureChanges ?? []).map((row) => `<li><strong>${escapeHtml(row.displayAmount)}</strong> ${escapeHtml(humanizeIdentifier(row.pressureType ?? row.label))}</li>`).join("") || `<li>No pressure changes</li>`;
  return `<section class="arcflight-travel-v2-resolution-dialog"><h2>${escapeHtml(state.title)}</h2><p><strong>Event:</strong> ${escapeHtml(state.eventName)}</p>${state.vignette ? `<h3>Vignette</h3><p>${escapeHtml(state.vignette)}</p>` : ""}<h3>Station Outcomes</h3><ul>${stationRows}</ul><h3>Pressure Changes</h3><ul>${pressureRows}</ul><p class="notes"><strong>Outcome:</strong> ${escapeHtml(state.outcomeLabel)}</p><p class="notes">Review this round pressure and vignette before finalizing. This dialog does not mutate actors until the GM confirms finalization.</p></section>`;
}

function renderTravelV2EndOfEventDialogHtml(state = {}) {
  const packageState = state.outcomePackage ?? {};
  const roundRows = (packageState.roundSummaries ?? []).map((round) => `<li>Round ${escapeHtml(round.roundNumber ?? "?")}: ${escapeHtml(round.outcomeKey ?? "not-run")}</li>`).join("") || `<li>No round summaries available.</li>`;
  const rewards = (packageState.rewardCandidates ?? []).map((entry) => `<li>${escapeHtml(entry.name ?? entry.text ?? entry)}</li>`).join("") || `<li>No reward candidates.</li>`;
  const consequences = (packageState.consequenceCandidates ?? []).map((entry) => `<li>${escapeHtml(entry.name ?? entry.text ?? entry)}</li>`).join("") || `<li>No consequence candidates.</li>`;
  const followUps = (state.followUps?.records ?? []).map((entry) => `<li>${escapeHtml(entry.title ?? entry.text ?? entry.id)}</li>`).join("") || `<li>No follow-ups.</li>`;
  return `<section class="arcflight-travel-v2-resolution-dialog"><h2>${escapeHtml(state.title)}</h2>${renderTravelV2KeyValueList([["Event", state.eventName], ["Ship", state.shipName], ["Outcome", packageState.eventOutcomeLabel ?? ""], ["Completed", state.completedAt || "Not completed"]])}<nav class="tabs"><span>Vignette</span><span>Rounds</span><span>Rewards</span><span>Consequences</span><span>Ship Changes</span><span>Follow-Ups</span><span>Debug</span></nav><h3>Vignette</h3><p>${escapeHtml(packageState.summaryText ?? "")}</p><h3>Rounds</h3><ul>${roundRows}</ul><h3>Rewards</h3><ul>${rewards}</ul><h3>Consequences</h3><ul>${consequences}</ul><h3>Ship Changes</h3><p>Actor mutation remains behind explicit GM Apply buttons.</p><h3>Follow-Ups</h3><ul>${followUps}</ul><h3>Debug</h3><textarea readonly rows="8">${escapeHtml(JSON.stringify(state.debugReport ?? {}, null, 2))}</textarea></section>`;
}

export function prepareTravelV2PressureApplicationRunnerUpdate(currentSession, options = {}) {
  const selectedOutcomeKey = typeof options.selectedOutcomeKey === "string" ? options.selectedOutcomeKey.trim() : "";
  const helperOptions = selectedOutcomeKey ? { ...options, selectedOutcomeKey } : { ...options };
  const result = applyTravelV2PressureToRunnerSession(currentSession, helperOptions);
  const shouldUpdateSession = result?.ok === true && result?.applied === true && result.session !== undefined;
  return {
    result,
    nextSession: shouldUpdateSession ? result.session : currentSession,
    shouldUpdateSession,
    shouldRerender: shouldUpdateSession
  };
}

export function prepareTravelV2PressureCorrectionRunnerUpdate(currentSession, options = {}) {
  const correctedOutcomeKey = typeof options.correctedOutcomeKey === "string" ? options.correctedOutcomeKey.trim() : "";
  const helperOptions = correctedOutcomeKey ? { ...options, correctedOutcomeKey } : { ...options };
  const result = correctTravelV2PressureApplicationOnRunnerSession(currentSession, helperOptions);
  const shouldUpdateSession = result?.ok === true && result?.corrected === true && result.session !== undefined;
  return {
    result,
    nextSession: shouldUpdateSession ? result.session : currentSession,
    shouldUpdateSession,
    shouldRerender: shouldUpdateSession
  };
}

export function prepareTravelV2RoundFinalizationRunnerUpdate(currentSession, options = {}) {
  const result = finalizeTravelV2RoundOnRunnerSession(currentSession, options);
  const shouldUpdateSession = result?.ok === true && result?.finalized === true && result.session !== undefined;
  return {
    result,
    nextSession: shouldUpdateSession ? result.session : currentSession,
    shouldUpdateSession,
    shouldRerender: shouldUpdateSession
  };
}

export function prepareTravelV2EventCompletionRunnerUpdate(currentSession, options = {}) {
  const result = completeTravelV2EventOnRunnerSession(currentSession, options);
  const shouldUpdateSession = result?.ok === true && result?.completed === true && result.session !== undefined;
  return {
    result,
    nextSession: shouldUpdateSession ? result.session : currentSession,
    shouldUpdateSession,
    shouldRerender: shouldUpdateSession
  };
}

export function prepareTravelV2EventOutcomeApplicationRunnerUpdate(currentSession, options = {}) {
  const result = applyTravelV2EventOutcomePackageToRunnerSession(currentSession, options);
  const shouldUpdateSession = result?.ok === true && result?.applied === true && result.session !== undefined;
  return {
    result,
    nextSession: shouldUpdateSession ? result.session : currentSession,
    shouldUpdateSession,
    shouldRerender: shouldUpdateSession
  };
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
      dismissedGuidedQueueKeys: Array.isArray(options.dismissedGuidedQueueKeys) ? options.dismissedGuidedQueueKeys : [],
      scrollTop: 0,
      scrollSelector: "",
      travelV2PressureApplicationResult: null,
      travelV2PressureCorrectionResult: null,
      travelV2RoundFinalizationResult: null,
      travelV2EventCompletionResult: null,
      travelV2EventOutcomeApplicationResult: null,
      travelV2ActorApplicationResult: null,
      travelV2FollowUpResult: null,
      travelV2ShipScarResult: null,
      travelV2DevToolResult: null,
      travelV2AutoSaveResult: null
    };
  }

  static DEFAULT_OPTIONS = {
    classes: ["arcflight", "arcflight-travel-event-runner"],
    tag: "section",
    position: { width: 820, height: 720 },
    window: { title: "Arcflight Travel Command", resizable: true }
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
      uiState: this.uiState,
      travelV2DevToolsEnabled: isTravelV2DevToolsEnabled(),
      user: game?.user
    });
    const startupDiagnostics = prepareTravelEventRunnerStartupDiagnostics({
      session: this.session,
      selectedEventId: this.selectedEventId || state.library?.selectedEventId || "",
      dialogV2Available: typeof globalThis.foundry?.applications?.api?.DialogV2?.prompt === "function"
    });
    state.startupDiagnostics = startupDiagnostics;
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
    this.#maybeOpenGuidedRoundResolution(context?.state);
  }

  #maybeOpenGuidedRoundResolution(state) {
    if (!state?.hasSession || state.isCompleted) return;
    const key = `${state.session?.key ?? "session"}:${state.currentRoundNumber}:round-resolution`;
    const guided = state.guidedBridge ?? {};
    const ready = guided.stationSummary?.total > 0 && guided.stationSummary?.waiting === 0 && state.travelV2PreviewPanel?.pressureApplication?.alreadyApplied !== true;
    if (!ready || this.uiState.lastGuidedRoundResolutionKey === key) return;
    this.uiState.lastGuidedRoundResolutionKey = key;
    setTimeout(() => this.#showTravelV2RoundResolutionDialog({ finalize: false }), 0);
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

    const supportTargetSelect = event.target?.closest?.("[data-arcflight-runner-support-target-select]");
    if (supportTargetSelect && this.element?.contains(supportTargetSelect)) {
      return this.#updateStationSupportTarget(supportTargetSelect);
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
    if (target.hasAttribute("data-arcflight-runner-clear-result")) return this.#clearStationResult(target);
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
    if (target.hasAttribute("data-arcflight-travel-v2-delete-completed-session")) return this.#deleteCompletedTravelV2Session(target);
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
    if (target.hasAttribute("data-arcflight-guided-action")) return this.#runGuidedAction(target);
    if (target.hasAttribute("data-arcflight-travel-v2-pressure-apply")) return this.#applyTravelV2Pressure(target);
    if (target.hasAttribute("data-arcflight-travel-v2-pressure-correct")) return this.#correctTravelV2Pressure(target);
    if (target.hasAttribute("data-arcflight-travel-v2-round-finalize")) return this.finalizeTravelV2Round();
    if (target.hasAttribute("data-arcflight-travel-v2-event-complete")) return this.completeTravelV2Event();
    if (target.hasAttribute("data-arcflight-travel-v2-outcome-apply")) return this.applyTravelV2EventOutcomePackage();
    if (target.hasAttribute("data-arcflight-travel-v2-actor-apply")) return this.applyTravelV2ActorApplication();
    if (target.hasAttribute("data-arcflight-travel-v2-follow-up-status")) return this.#updateTravelV2FollowUpStatus(target);
    if (target.hasAttribute("data-arcflight-travel-v2-followup-note-status")) return this.#updateTravelV2ConsequenceFollowupStatus(target);
    if (target.hasAttribute("data-arcflight-travel-v2-hazard-draw")) return this.#drawTravelV2Hazard();
    if (target.hasAttribute("data-arcflight-travel-v2-hazard-reveal")) return this.#updateTravelV2Hazard(target, "revealed");
    if (target.hasAttribute("data-arcflight-travel-v2-hazard-hold")) return this.#updateTravelV2Hazard(target, "held");
    if (target.hasAttribute("data-arcflight-travel-v2-hazard-activate")) return this.#updateTravelV2Hazard(target, "active");
    if (target.hasAttribute("data-arcflight-travel-v2-hazard-clear")) return this.#updateTravelV2Hazard(target, "cleared");
    if (target.hasAttribute("data-arcflight-travel-v2-hazard-apply")) return this.#applyTravelV2HazardToRound(target);
    if (target.hasAttribute("data-arcflight-travel-v2-momentum-downgrade")) return this.#spendTravelV2MomentumDowngrade(target);
    if (target.hasAttribute("data-arcflight-travel-v2-ship-scar-apply")) return this.#applyTravelV2ShipScar(target);
    if (target.hasAttribute("data-arcflight-travel-v2-ship-scar-dismiss")) return this.#dismissTravelV2ShipScar(target);
    if (target.hasAttribute("data-arcflight-travel-v2-ship-scar-repair")) return this.#repairTravelV2ShipScar(target);
    if (target.hasAttribute("data-arcflight-travel-v2-dev-force-outcome")) return this.#forceTravelV2DevOutcome(target);
    if (target.hasAttribute("data-arcflight-travel-v2-dev-force-round-result")) return this.#forceTravelV2DevRoundResult(target);
    if (target.hasAttribute("data-arcflight-travel-v2-dev-early-end")) return this.#forceTravelV2DevEarlyEnd();
    if (target.hasAttribute("data-arcflight-travel-v2-dev-lantern-sample")) return this.#setupTravelV2LanternSample();
    if (target.hasAttribute("data-arcflight-travel-v2-dev-copy-debug")) return this.#copyTravelV2DebugReport();
    if (target.hasAttribute("data-arcflight-travel-v2-round-review")) return this.#showTravelV2RoundResolutionDialog({ finalize: false });
    if (target.hasAttribute("data-arcflight-travel-v2-event-review")) return this.#showTravelV2EndOfEventDialog({ complete: false });
    if (target.hasAttribute("data-arcflight-travel-v2-narration-refresh")) return this.#refreshTravelV2Narration();
    if (target.dataset.action === "arcflight-travel-v2-select-all-single-suggestion-consequences") return this.#selectAllSingleSuggestionPendingConsequences();
    if (target.dataset.action === "arcflight-travel-v2-apply-all-selected-consequences") return this.#applyAllSelectedPendingConsequences();
    if (target.dataset.action === "arcflight-travel-v2-clear-all-selected-consequences") return this.#clearAllSelectedPendingConsequences();
    if (target.hasAttribute("data-arcflight-travel-v2-pending-consequence-select")) return this.#selectPendingConsequenceCatalogCard(target);
    if (target.hasAttribute("data-arcflight-travel-v2-pending-consequence-apply-selected")) return this.#applySelectedPendingConsequence(target);
    if (target.hasAttribute("data-arcflight-travel-v2-pending-consequence-clear-selection")) return this.#clearSelectedPendingConsequence(target);
    if (target.hasAttribute("data-arcflight-travel-v2-pending-consequence-status")) return this.#updatePendingConsequenceQueueItem(target);
    if (target.hasAttribute("data-arcflight-focus-effect-apply")) return this.#resolveFocusEffect(target, "applied");
    if (target.hasAttribute("data-arcflight-focus-effect-dismiss")) return this.#resolveFocusEffect(target, "dismissed");
    if (target.hasAttribute("data-arcflight-focus-backlash-apply")) return this.#resolveFocusBacklash(target, "applied");
    if (target.hasAttribute("data-arcflight-focus-backlash-dismiss")) return this.#resolveFocusBacklash(target, "dismissed");
    if (target.hasAttribute("data-arcflight-support-assist-use")) return this.#resolveSupportAssist(target, "used");
    if (target.hasAttribute("data-arcflight-support-assist-dismiss")) return this.#resolveSupportAssist(target, "dismissed");
    if (target.hasAttribute("data-arcflight-support-backlash-apply")) return this.#resolveSupportBacklash(target, "applied");
    if (target.hasAttribute("data-arcflight-support-backlash-dismiss")) return this.#resolveSupportBacklash(target, "dismissed");
    if (target.hasAttribute("data-arcflight-stabilize-resolution-apply")) return this.#resolveStabilizeResolution(target, "applied");
    if (target.hasAttribute("data-arcflight-stabilize-resolution-dismiss")) return this.#resolveStabilizeResolution(target, "dismissed");
    if (target.hasAttribute("data-arcflight-reaction-accept")) return this.#resolveReaction(target, "accept");
    if (target.hasAttribute("data-arcflight-reaction-dismiss")) return this.#resolveReaction(target, "dismiss");
    if (target.hasAttribute("data-arcflight-reaction-reroll-result")) return this.#resolveReaction(target, "reroll");
    if (target.hasAttribute("data-arcflight-reaction-backlash-apply")) return this.#resolveReaction(target, "applyBacklash");
    if (target.hasAttribute("data-arcflight-reaction-backlash-dismiss")) return this.#resolveReaction(target, "dismissBacklash");
  }


  async #refreshTravelV2Narration() {
    this.statusMessage = "Round narration refreshed from the current local session state.";
    return this.render(true);
  }

  async #updatePendingConsequenceQueueItem(target) {
    if (game?.user?.isGM !== true) {
      this.statusMessage = "Only GMs can update pending consequences.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    const queueKey = target.dataset.queueKey ?? "";
    const status = target.dataset.status ?? "";
    const updated = updateTravelV2PendingConsequenceQueueItem(this.session, queueKey, status);
    if (!updated.ok) {
      this.statusMessage = updated.error ?? "Pending consequence queue item was not updated.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    this.session = updated.session;
    this.selectedSessionKey = updated.session.key ?? this.selectedSessionKey;
    this.statusMessage = `Pending consequence marked ${status} in the session-local queue only; no actor, item, chat, journal, combat, scene, token, socket, compendium, or world data was mutated.`;
    ui.notifications?.info?.(this.statusMessage);
    return this.render(true);
  }


  async #applyAllSelectedPendingConsequences() {
    if (game?.user?.isGM !== true) {
      this.statusMessage = "Only GMs can apply selected consequences.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    const updated = applyAllExecutableTravelV2SelectedConsequencesToSession(this.session);
    if (!updated.ok) {
      this.statusMessage = updated.reason ?? "No executable selected consequences were applied.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    this.session = updated.session;
    this.selectedSessionKey = updated.session.key ?? this.selectedSessionKey;
    this.statusMessage = `Applied ${updated.appliedCount} executable selected consequence${updated.appliedCount === 1 ? "" : "s"} to session-local pressure/follow-up data only; no actor, item, inventory, chat, journal, combat, scene, token, socket, compendium, or world data was mutated.`;
    ui.notifications?.info?.(this.statusMessage);
    return this.render(true);
  }

  async #selectAllSingleSuggestionPendingConsequences() {
    if (game?.user?.isGM !== true) {
      this.statusMessage = "Only GMs can select pending consequence catalog cards.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    const updated = selectAllSingleSuggestionTravelV2PendingConsequences(this.session);
    if (!updated.ok) {
      this.statusMessage = updated.reason ?? "No pending consequence items have exactly one unselected catalog suggestion.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    this.session = updated.session;
    this.selectedSessionKey = updated.session.key ?? this.selectedSessionKey;
    this.statusMessage = `Selected ${updated.selectedCount} single-suggestion consequence card${updated.selectedCount === 1 ? "" : "s"} in the session-local queue only; no effects were applied and no actor/item/world data was mutated.`;
    ui.notifications?.info?.(this.statusMessage);
    return this.render(true);
  }

  async #clearAllSelectedPendingConsequences() {
    if (game?.user?.isGM !== true) {
      this.statusMessage = "Only GMs can clear selected consequences.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    const updated = clearAllTravelV2PendingConsequenceSelections(this.session);
    if (!updated.ok) {
      this.statusMessage = updated.reason ?? "No pending selected consequence cards can be cleared.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    this.session = updated.session;
    this.selectedSessionKey = updated.session.key ?? this.selectedSessionKey;
    this.statusMessage = `Cleared ${updated.clearedCount} selected consequence card${updated.clearedCount === 1 ? "" : "s"} in the session-local queue only; no effects were applied and no actor/item/world data was mutated.`;
    ui.notifications?.info?.(this.statusMessage);
    return this.render(true);
  }

  async #clearSelectedPendingConsequence(target) {
    if (game?.user?.isGM !== true) {
      this.statusMessage = "Only GMs can clear selected consequences.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    const queueKey = target.dataset.queueKey ?? "";
    const updated = clearTravelV2PendingConsequenceSelection(this.session, queueKey);
    if (!updated.ok) {
      this.statusMessage = updated.error ?? "Selected consequence was not cleared.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    this.session = updated.session;
    this.selectedSessionKey = updated.session.key ?? this.selectedSessionKey;
    this.statusMessage = "Selected consequence cleared in the session-local queue only; no effects were applied and no actor/item/world data was mutated.";
    ui.notifications?.info?.(this.statusMessage);
    return this.render(true);
  }

  async #applySelectedPendingConsequence(target) {
    if (game?.user?.isGM !== true) {
      this.statusMessage = "Only GMs can apply selected consequences.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    const queueKey = target.dataset.queueKey ?? "";
    const updated = applyTravelV2SelectedConsequenceToSession(this.session, queueKey);
    if (!updated.ok) {
      this.statusMessage = updated.error ?? "Selected consequence was not applied.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    this.session = updated.session;
    this.selectedSessionKey = updated.session.key ?? this.selectedSessionKey;
    const effect = updated.appliedRecord ?? {};
    this.statusMessage = `Applied selected consequence to session-local ${effect.affectedTrack ?? "pressure"} pressure only (${effect.beforeValue} → ${effect.afterValue}); no actor, item, chat, journal, combat, scene, token, socket, compendium, or world data was mutated.`;
    ui.notifications?.info?.(this.statusMessage);
    return this.render(true);
  }

  async #selectPendingConsequenceCatalogCard(target) {
    if (game?.user?.isGM !== true) {
      this.statusMessage = "Only GMs can select pending consequence catalog cards.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    const queueKey = target.dataset.queueKey ?? "";
    const consequenceId = target.dataset.consequenceId ?? "";
    const updated = selectTravelV2PendingConsequenceCatalogCard(this.session, queueKey, consequenceId);
    if (!updated.ok) {
      this.statusMessage = updated.error ?? "Pending consequence catalog card was not selected.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    this.session = updated.session;
    this.selectedSessionKey = updated.session.key ?? this.selectedSessionKey;
    const title = updated.record?.selectedConsequence?.title ?? "catalog card";
    this.statusMessage = `${title} selected for this pending consequence in the session-local queue only; no effects were applied and no actor, item, chat, journal, combat, scene, token, socket, compendium, or world data was mutated.`;
    ui.notifications?.info?.(this.statusMessage);
    return this.render(true);
  }

  async #runGuidedAction(target) {
    const action = target.dataset.arcflightGuidedAction ?? "";
    const queueKey = target.dataset.queueKey ?? "";
    if (action === "dismiss") {
      if (queueKey && !this.uiState.dismissedGuidedQueueKeys.includes(queueKey)) this.uiState.dismissedGuidedQueueKeys = [...this.uiState.dismissedGuidedQueueKeys, queueKey];
      this.statusMessage = "Guided queue item dismissed for this local runner view.";
      return this.render(true);
    }
    if (action === "send-players") return this.#sendPlayerMissionBoard();
    if (action === "start") return this.#focusGuidedDrawer("arcflight-guided-session-setup");
    if (action === "stations") return this.#focusGuidedDrawer("arcflight-guided-station-console");
    if (action === "reactions") return this.#focusGuidedDrawer("arcflight-guided-reaction-console");
    if (action === "round-review") return this.#showTravelV2RoundResolutionDialog({ finalize: false });
    if (action === "round-apply") return this.#applyGuidedSuggestedPressure();
    if (action === "round-details") return this.#focusGuidedDrawer("arcflight-guided-round-flow");
    if (action === "hazards") return this.#focusGuidedDrawer("arcflight-guided-hazard-deck");
    if (action === "ship-scars") return this.#focusGuidedDrawer("arcflight-guided-ship-scars-deck");
    if (action === "actor-apply") return this.#focusGuidedDrawer("arcflight-guided-actor-apply");
    if (action === "followups") return this.#focusGuidedDrawer("arcflight-guided-followups");
    if (action === "devtools") return this.#focusGuidedDrawer("arcflight-guided-devtools");
    if (action === "advance-round") return this.#advanceRound();
    if (action === "complete-event") return this.completeTravelV2Event();
    if (action === "completed") return this.#focusGuidedDrawer("arcflight-guided-completed");
    return this.#focusGuidedDrawer("arcflight-guided-command-bridge");
  }

  #focusGuidedDrawer(id) {
    const safeId = typeof globalThis.CSS?.escape === "function" ? globalThis.CSS.escape(id) : String(id).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
    const element = this.element?.querySelector?.(`#${safeId}`);
    if (element?.tagName?.toLowerCase?.() === "details") element.open = true;
    element?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    element?.focus?.();
    return element;
  }

  async #applyGuidedSuggestedPressure() {
    const state = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: this.session,
      selectedEventId: this.selectedEventId,
      selectedSessionKey: this.selectedSessionKey,
      actor: this.#getSelectedShipActor(),
      uiState: this.uiState,
      travelV2DevToolsEnabled: isTravelV2DevToolsEnabled(),
      user: game?.user
    });
    const suggestedOutcomeKey = normalizeGuidedRoundOutcomeKey(state.roundSummaryCard?.roundOutcomeKey);
    const preferred = state.travelV2PreviewPanel?.rows?.find((row) => row.outcomeKey === suggestedOutcomeKey && !row.pressureApplyDisabled)
      ?? state.travelV2PreviewPanel?.rows?.find((row) => row.isEffectiveAppliedOutcome)
      ?? state.travelV2PreviewPanel?.rows?.find((row) => !row.pressureApplyDisabled)
      ?? null;
    if (!preferred?.outcomeKey) {
      this.statusMessage = "No suggested pressure outcome is currently available to apply.";
      return this.render(true);
    }
    return this.#applyTravelV2Pressure({ dataset: { arcflightTravelV2PressureApply: preferred.outcomeKey } });
  }

  async #applyTravelV2ShipScar(target) {
    const id = target.dataset.arcflightTravelV2ShipScarApply || "";
    const result = await applyTravelV2ShipScarToActor(this.session, this.#getSessionShipActor(), id);
    this.uiState.travelV2ShipScarResult = result;
    if (result.ok) this.session = result.session;
    this.statusMessage = result.ok ? "Ship Scar applied to selected ship actor flags." : (result.blockedReasons?.[0] ?? result.error ?? "Could not apply Ship Scar.");
    return this.render(true);
  }

  async #dismissTravelV2ShipScar(target) {
    const id = target.dataset.arcflightTravelV2ShipScarDismiss || "";
    const result = dismissTravelV2RunnerShipScar(this.session, id);
    this.uiState.travelV2ShipScarResult = result;
    if (result.ok) this.session = result.session;
    this.statusMessage = result.ok ? "Pending Ship Scar dismissed in runner-session state." : (result.errors?.[0] ?? "Could not dismiss Ship Scar.");
    return this.render(true);
  }

  async #repairTravelV2ShipScar(target) {
    const id = target.dataset.arcflightTravelV2ShipScarRepair || "";
    const result = await repairTravelV2ShipScarOnActor(this.session, this.#getSessionShipActor(), id);
    this.uiState.travelV2ShipScarResult = result;
    if (result.ok) this.session = result.session;
    this.statusMessage = result.ok ? "Ship Scar marked repaired on selected ship actor flags." : (result.blockedReasons?.[0] ?? result.error ?? "Could not repair Ship Scar.");
    return this.render(true);
  }


  async #spendTravelV2MomentumDowngrade(target) {
    const roundIndex = Number(target.dataset.roundIndex ?? this.session?.currentRoundIndex ?? 0);
    const stationKey = target.dataset.stationKey ?? "";
    const updated = spendTravelV2RunnerMomentumDowngrade(this.session, roundIndex, stationKey);
    if (updated.ok) {
      this.session = updated.session;
      this.statusMessage = `Momentum spent: ${humanizeIdentifier(stationKey)} shifted from ${humanizeIdentifier(updated.fromResult)} to ${humanizeIdentifier(updated.toResult)}.`;
      this.#refreshPlayersQuietly();
    } else {
      this.statusMessage = updated.errors?.[0] ?? "Could not spend Momentum.";
    }
    return this.render(true);
  }

  async #drawTravelV2Hazard() {
    const updated = drawTravelV2RunnerHazard(this.session);
    if (updated.ok) this.session = updated.session;
    this.statusMessage = updated.ok ? `Travel v2 hazard staged: ${updated.drawn?.name ?? "Hazard"}.` : (updated.errors?.[0] ?? "Could not draw Travel v2 hazard.");
    return this.render(true);
  }

  async #applyTravelV2HazardToRound(target) {
    if (!this.session) return;
    const id = target.dataset.arcflightTravelV2HazardApply || target.dataset.hazardId || "";
    const updated = applyTravelV2RunnerHazardToRound(this.session, id);
    if (updated.ok) {
      this.session = updated.session;
      this.statusMessage = "Travel v2 hazard applied to the current round.";
      queueTravelPlayerMissionBoardRefreshToPlayers(this.session);
    } else {
      this.statusMessage = updated.errors?.[0] ?? "Could not apply Travel v2 hazard.";
    }
    await this.render(true);
  }

  async #updateTravelV2Hazard(target, status) {
    const id = target.dataset.arcflightTravelV2HazardActivate || target.dataset.arcflightTravelV2HazardClear || target.dataset.arcflightTravelV2HazardReveal || target.dataset.arcflightTravelV2HazardHold || target.dataset.hazardId || "";
    const wasRevealed = this.session?.travelV2Hazards?.records?.some?.((record) => record.id === id && record.revealed === true) === true;
    const actions = { active: activateTravelV2RunnerHazard, cleared: clearTravelV2RunnerHazard, revealed: revealTravelV2RunnerHazard, held: holdTravelV2RunnerHazard };
    const updated = actions[status]?.(this.session, id) ?? { ok: false, errors: ["Unsupported hazard action."] };
    const isRevealed = updated.session?.travelV2Hazards?.records?.some?.((record) => record.id === id && record.revealed === true) === true;
    if (updated.ok) this.session = updated.session;
    this.statusMessage = updated.ok ? `Travel v2 hazard ${status} in runner-session state.` : (updated.errors?.[0] ?? "Could not update Travel v2 hazard.");
    if (updated.ok && (status === "revealed" || wasRevealed || isRevealed)) this.#refreshPlayersQuietly();
    return this.render(true);
  }

  async #resolveReaction(target, action) {
    const id = target.dataset.reactionPromptId ?? "";
    const actions = { accept: () => acceptTravelReactionPrompt(this.session, id), dismiss: () => dismissTravelReactionPrompt(this.session, id), reroll: () => markTravelReactionPromptRerollResult(this.session, id, target.dataset.result ?? ""), applyBacklash: () => applyTravelReactionPromptBacklash(this.session, id), dismissBacklash: () => dismissTravelReactionPromptBacklash(this.session, id) };
    const updated = actions[action]?.() ?? { ok: false, errors: ["Unknown reaction action."] };
    if (updated.ok) { this.session = updated.session; this.#refreshPlayersQuietly(); }
    this.statusMessage = updated.ok ? "Reaction prompt updated." : (updated.errors?.[0] ?? "Could not update reaction prompt.");
    return this.render(true);
  }

  async #updateReactionNote(input) {
    const updated = updateTravelReactionPromptNote(this.session, input.dataset.reactionPromptId ?? "", input.value ?? "");
    if (updated.ok) this.session = updated.session;
    this.statusMessage = updated.ok ? "Reaction note updated." : (updated.errors?.[0] ?? "Could not update reaction note.");
    return this.render(true);
  }

  async #resolveFocusBacklash(target, status) {
    const recordId = target.dataset.focusBacklashId ?? "";
    const updated = status === "applied" ? applyTravelV2FocusBacklash(this.session, recordId) : dismissTravelV2FocusBacklash(this.session, recordId);
    if (updated.ok) { this.session = updated.session; this.#refreshPlayersQuietly(); }
    this.statusMessage = updated.ok ? (status === "applied" ? "Focus backlash applied." : "Focus backlash dismissed.") : (updated.errors?.[0] ?? "Could not update Focus backlash.");
    return this.render(true);
  }

  async #resolveSupportAssist(target, status) {
    const recordId = target.dataset.supportAssistId ?? "";
    const updated = status === "used" ? useTravelV2SupportRecord(this.session, recordId) : dismissTravelV2SupportRecord(this.session, recordId);
    if (updated.ok) { this.session = updated.session; this.#refreshPlayersQuietly(); }
    this.statusMessage = updated.ok ? (status === "used" ? "Support assist marked used." : "Support assist dismissed.") : (updated.errors?.[0] ?? "Could not update Support assist.");
    return this.render(true);
  }

  async #resolveSupportBacklash(target, status) {
    const recordId = target.dataset.supportBacklashId ?? "";
    const updated = status === "applied" ? applyTravelV2SupportBacklashRecord(this.session, recordId) : dismissTravelV2SupportBacklashRecord(this.session, recordId);
    if (updated.ok) { this.session = updated.session; this.#refreshPlayersQuietly(); }
    this.statusMessage = updated.ok ? (status === "applied" ? "Support backlash marked applied for manual GM handling." : "Support backlash dismissed.") : (updated.errors?.[0] ?? "Could not update Support backlash.");
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

  async #applyTravelV2Pressure(target) {
    const selectedOutcomeKey = getRunnerPressureSelectedOutcomeKey(target);
    const update = prepareTravelV2PressureApplicationRunnerUpdate(this.session, { selectedOutcomeKey });
    this.uiState.travelV2PressureApplicationResult = update.result;

    if (update.shouldUpdateSession) {
      this.session = update.nextSession;
      this.selectedSessionKey = this.session?.key ?? this.selectedSessionKey;
      this.statusMessage = `Applied Travel v2 pressure outcome: ${humanizeIdentifier(update.result.selectedOutcomeKey)}.`;
      this.#showTravelV2PressureAppliedDialog(update.result);
      this.#refreshPlayersQuietly();
      return this.render(true);
    }

    this.statusMessage = update.result?.blockedReasons?.[0] ?? update.result?.error ?? "Travel v2 pressure application was blocked.";
    return update.shouldRerender ? this.render(true) : update;
  }

  #showTravelV2PressureAppliedDialog(result = {}) {
    const dialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (typeof dialogV2?.wait !== "function") return;
    const pressureResult = result.pressureResult ?? {};
    const applicationRecord = result.applicationRecord ?? {};
    const changes = Array.isArray(pressureResult.changes) ? pressureResult.changes : [];
    const hazards = [
      ...(Array.isArray(pressureResult.hazardDraws) ? pressureResult.hazardDraws : []),
      ...(Array.isArray(result.hazardDraws) ? result.hazardDraws : [])
    ];
    const scars = [
      ...(Array.isArray(pressureResult.shipScarTriggers) ? pressureResult.shipScarTriggers : []),
      ...(Array.isArray(result.shipScarDraws) ? result.shipScarDraws : [])
    ];
    const changeRows = changes.map((change) => {
      const label = humanizeIdentifier(change.pressureType ?? change.key ?? change.track ?? "Pressure");
      const before = change.before ?? change.from ?? "?";
      const after = change.after ?? change.to ?? "?";
      const amount = Number.isFinite(Number(change.amount)) ? ` (${Number(change.amount) >= 0 ? "+" : ""}${Number(change.amount)})` : "";
      return `<li><strong>${escapeHtml(label)}</strong>: ${escapeHtml(before)} → ${escapeHtml(after)}${escapeHtml(amount)}</li>`;
    }).join("") || `<li>Application record created for ${escapeHtml(humanizeIdentifier(applicationRecord.outcomeKey ?? result.selectedOutcomeKey ?? "selected outcome"))}.</li>`;
    const hazardRows = hazards.map((draw) => `<li>${escapeHtml(draw.name ?? draw.hazardName ?? humanizeIdentifier(draw.pressureType ?? "Hazard"))}${draw.threshold ? ` — threshold ${escapeHtml(draw.threshold)}` : ""}${draw.count ? ` ×${escapeHtml(draw.count)}` : ""}</li>`).join("") || "<li>No Hazard cards drawn.</li>";
    const scarRows = scars.map((scar) => `<li>${escapeHtml(scar.name ?? scar.scarName ?? humanizeIdentifier(scar.pressureType ?? "Ship Scar"))}${scar.overflowAmount ? ` — overflow ${escapeHtml(scar.overflowAmount)}` : ""}</li>`).join("") || "<li>No Ship Scar candidates drawn.</li>";
    const nextAction = (hazards.length ? "Review Hazard Deck" : (scars.length ? "Review Ship Scars Deck" : "Continue the round flow"));
    setTimeout(async () => {
      try {
        const action = await dialogV2.wait({
          window: { title: "Pressure Applied" },
          content: `<section class="arcflight-travel-pressure-applied"><h2>Pressure Applied</h2><h3>Track Changes</h3><ul>${changeRows}</ul><h3>Thresholds / Hazard Draws</h3><ul>${hazardRows}</ul><h3>Ship Scar Candidates</h3><ul>${scarRows}</ul><p><strong>Next required action:</strong> ${escapeHtml(nextAction)}</p><p>Actor writes still require explicit GM Apply.</p></section>`,
          buttons: [
            ...(hazards.length ? [{ action: "hazards", label: "Review Hazard" }] : []),
            ...(scars.length ? [{ action: "shipScars", label: "Review Ship Scar" }] : []),
            { action: "continue", label: "Continue", default: true }
          ],
          close: () => "continue"
        });
        if (action === "hazards") this.#focusGuidedDrawer("arcflight-guided-hazard-deck");
        if (action === "shipScars") this.#focusGuidedDrawer("arcflight-guided-ship-scars-deck");
      } catch (_error) {
        // Dialog dismissal should not block pressure application.
      }
    }, 0);
  }

  async #correctTravelV2Pressure(target) {
    const correctedOutcomeKey = getRunnerPressureSelectedOutcomeKey(target);
    const update = prepareTravelV2PressureCorrectionRunnerUpdate(this.session, { correctedOutcomeKey });
    this.uiState.travelV2PressureCorrectionResult = update.result;

    if (update.shouldUpdateSession) {
      this.session = update.nextSession;
      this.selectedSessionKey = this.session?.key ?? this.selectedSessionKey;
      this.statusMessage = `Corrected Travel v2 pressure outcome: ${humanizeIdentifier(update.result.previousOutcomeKey)} → ${humanizeIdentifier(update.result.selectedOutcomeKey)}.`;
      return this.render(true);
    }

    this.statusMessage = update.result?.blockedReasons?.[0] ?? update.result?.error ?? "Travel v2 pressure correction was blocked.";
    return update.shouldRerender ? this.render(true) : update;
  }

  async finalizeTravelV2Round(options = {}) {
    if (options.skipDialog !== true) {
      const confirmed = await this.#showTravelV2RoundResolutionDialog({ finalize: true });
      if (!confirmed) return this.render(true);
    }
    const hazardResolution = resolveTravelV2RunnerUnresolvedHazards(this.session, options);
    if (hazardResolution.ok) this.session = hazardResolution.session;
    const update = prepareTravelV2RoundFinalizationRunnerUpdate(this.session, options);
    this.uiState.travelV2RoundFinalizationResult = update.result;

    if (update.shouldUpdateSession) {
      this.session = update.nextSession;
      this.selectedSessionKey = this.session?.key ?? this.selectedSessionKey;
      this.statusMessage = `Finalized Travel v2 round ${update.result.roundNumber ?? update.result.roundIndex + 1}.`;
      return this.render(true);
    }

    this.statusMessage = update.result?.blockedReasons?.[0] ?? update.result?.error ?? "Travel v2 round finalization was blocked.";
    return update.shouldRerender ? this.render(true) : update;
  }

  async completeTravelV2Event(options = {}) {
    if (options.skipDialog !== true) {
      const confirmed = await this.#showTravelV2EndOfEventDialog({ complete: true });
      if (!confirmed) return this.render(true);
    }
    const update = prepareTravelV2EventCompletionRunnerUpdate(this.session, options);
    this.uiState.travelV2EventCompletionResult = update.result;

    if (update.shouldUpdateSession) {
      this.session = update.nextSession;
      this.selectedSessionKey = this.session?.key ?? this.selectedSessionKey;
      const saved = await this.#saveCompletedTravelV2SessionForReopen();
      this.statusMessage = saved.ok ? "Saved for Reopen: completed Travel v2 event is in Completed Travel v2 Sessions." : "Completed Travel v2 event, but saving for reopen is unavailable. Save Current Session to preserve the reopen/history entry if available.";
      this.#refreshPlayersQuietly();
      return this.render(true);
    }

    this.statusMessage = update.result?.blockedReasons?.[0] ?? update.result?.error ?? "Travel v2 event completion was blocked.";
    return update.shouldRerender ? this.render(true) : update;
  }


  async #showTravelV2RoundResolutionDialog({ finalize = false } = {}) {
    const state = prepareTravelV2RoundResolutionDialogState(this.session);
    const dialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (typeof dialogV2?.wait !== "function") {
      this.statusMessage = finalize ? "Round resolution dialog unavailable; finalizing with current reviewed state." : "Round resolution dialog requires Foundry DialogV2.";
      if (!finalize) ui.notifications?.warn?.(this.statusMessage);
      return finalize;
    }
    const result = await dialogV2.wait({
      window: { title: state.title },
      content: renderTravelV2RoundResolutionDialogHtml(state),
      buttons: finalize
        ? [{ action: "finalize", label: "Finalize Round", default: true }, { action: "cancel", label: "Cancel" }]
        : [
          { action: "applyPressure", label: "Apply Suggested Pressure", default: true },
          { action: "editPressure", label: "Edit Pressure" },
          { action: "skipPressure", label: "Skip Pressure" },
          { action: "details", label: "Open Details" },
          { action: "cancel", label: "Cancel" }
        ],
      close: () => null
    });
    if (result === "applyPressure") {
      await this.#applyGuidedSuggestedPressure();
      return false;
    }
    if (result === "editPressure" || result === "details") {
      this.#focusGuidedDrawer("arcflight-guided-round-flow");
      return false;
    }
    if (result === "skipPressure") {
      this.statusMessage = "Suggested pressure skipped for now; use the Action Queue to review or apply it later.";
      return false;
    }
    const confirmed = result === "finalize" || result === "close";
    if (!confirmed && finalize) this.statusMessage = "Round finalization cancelled after resolution review.";
    return Boolean(confirmed);
  }

  async #showTravelV2EndOfEventDialog({ complete = false } = {}) {
    const state = prepareTravelV2EndOfEventResolutionDialogState(this.session, { actor: this.#getSessionShipActor() });
    const dialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (typeof dialogV2?.wait !== "function") {
      this.statusMessage = complete ? "End-of-event resolution dialog unavailable; completing with current reviewed state." : "End-of-event resolution dialog requires Foundry DialogV2.";
      if (!complete) ui.notifications?.warn?.(this.statusMessage);
      return complete;
    }
    const buttons = complete
      ? [{ action: "complete", label: "Complete Event", default: true }, { action: "cancel", label: "Cancel" }]
      : [{ action: "applyOutcome", label: "Apply Outcome Package" }, { action: "applyShip", label: "Apply Approved Changes to Ship" }, { action: "close", label: "Close", default: true }];
    const result = await dialogV2.wait({
      window: { title: state.title },
      content: renderTravelV2EndOfEventDialogHtml(state),
      buttons,
      close: () => null
    });
    if (result === "applyOutcome") {
      await this.applyTravelV2EventOutcomePackage();
      return false;
    }
    if (result === "applyShip") {
      await this.applyTravelV2ActorApplication();
      return false;
    }
    if (result !== "complete" && complete) this.statusMessage = "Event completion cancelled after end-of-event review.";
    return result === "complete" || result === "close";
  }

  async applyTravelV2EventOutcomePackage(options = {}) {
    const update = prepareTravelV2EventOutcomeApplicationRunnerUpdate(this.session, options);
    this.uiState.travelV2EventOutcomeApplicationResult = update.result;

    if (update.shouldUpdateSession) {
      this.session = update.nextSession;
      this.selectedSessionKey = this.session?.key ?? this.selectedSessionKey;
      const saved = await this.#saveCompletedTravelV2SessionForReopen();
      this.statusMessage = saved.ok ? "Saved for Reopen: applied outcome package status was saved to the completed session." : "Applied Travel v2 outcome package, but saving the completed-session update is unavailable.";
      return this.render(true);
    }

    this.statusMessage = update.result?.blockedReasons?.[0] ?? update.result?.error ?? "Travel v2 outcome package application was blocked.";
    return update.shouldRerender ? this.render(true) : update;
  }


  async applyTravelV2ActorApplication(options = {}) {
    const actor = this.#getSessionShipActor();
    const preview = prepareTravelV2ActorApplicationPreviewFromSession(this.session, actor, { ...options, session: this.session });
    const result = await applyTravelV2ActorApplicationPreview(actor, preview, options);
    this.uiState.travelV2ActorApplicationResult = result;
    if (result.ok && this.session) {
      const nextSession = cloneData(this.session);
      nextSession.travelV2ActorApplication = result.applicationRecord ?? nextSession.travelV2ActorApplication;
      nextSession.updatedAt = new Date().toISOString();
      this.session = nextSession;
      const saved = await this.#saveCompletedTravelV2SessionForReopen();
      this.statusMessage = saved.ok ? "Saved for Reopen: approved ship changes application was saved to the completed session." : "Applied approved Travel v2 changes to ship, but saving the completed-session update is unavailable.";
    } else {
      this.statusMessage = result.blockedReasons?.[0] ?? result.error ?? "Travel v2 actor application was blocked.";
    }
    return this.render(true);
  }


  async #updateTravelV2ConsequenceFollowupStatus(target) {
    if (game?.user?.isGM !== true) {
      this.statusMessage = "Only GMs can update follow-up note status.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    const followupKey = target.dataset.followupKey ?? "";
    const status = target.dataset.status ?? "";
    const updated = updateTravelV2ConsequenceFollowupStatus(this.session, followupKey, status);
    if (!updated.ok) {
      this.statusMessage = updated.error ?? "Follow-up note status was not updated.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    this.session = updated.session;
    this.selectedSessionKey = updated.session.key ?? this.selectedSessionKey;
    this.statusMessage = `Follow-up note marked ${status} in session-local note status only; no actor, item, inventory, chat, journal, combat, scene, token, socket, compendium, or world data was mutated.`;
    ui.notifications?.info?.(this.statusMessage);
    return this.render(true);
  }

  async #updateTravelV2FollowUpStatus(target) {
    const actor = this.#getSessionShipActor();
    const followUpId = target?.dataset?.arcflightTravelV2FollowUpId ?? "";
    const status = target?.dataset?.arcflightTravelV2FollowUpStatus ?? "";
    const noteInput = target?.closest?.("[data-arcflight-travel-v2-follow-up-card]")?.querySelector?.("[data-arcflight-travel-v2-follow-up-note]");
    const result = await updateTravelV2FollowUpStatus(actor, followUpId, status, { note: noteInput?.value ?? undefined });
    this.uiState.travelV2FollowUpResult = result;
    this.statusMessage = result.ok ? `Updated Travel v2 follow-up: ${status}.` : (result.blockedReasons?.[0] ?? result.error ?? "Travel v2 follow-up update was blocked.");
    return this.render(true);
  }


  async #forceTravelV2DevOutcome(target) {
    const outcomeKey = target?.dataset?.arcflightTravelV2DevForceOutcome ?? "mixed";
    const result = forceTravelV2Outcome(this.session, outcomeKey);
    if (result.ok) this.session = result.session;
    this.uiState.travelV2DevToolResult = result;
    this.statusMessage = result.ok ? `Travel v2 dev forced outcome: ${humanizeIdentifier(result.outcomeKey)}.` : (result.blockedReasons?.[0] ?? result.error ?? "Travel v2 dev force outcome failed.");
    return this.render(true);
  }

  async #forceTravelV2DevRoundResult(target) {
    const outcomeKey = target?.dataset?.arcflightTravelV2DevForceRoundResult ?? "mixed";
    const result = forceTravelV2CurrentRoundResults(this.session, outcomeKey);
    if (result.ok) this.session = result.session;
    this.uiState.travelV2DevToolResult = result;
    this.statusMessage = result.ok ? `Travel v2 dev forced current-round results: ${humanizeIdentifier(result.outcomeKey)}.` : (result.error ?? "Travel v2 dev force round results failed.");
    return this.render(true);
  }

  async #forceTravelV2DevEarlyEnd() {
    const result = forceTravelV2EarlyEndRound(this.session);
    if (result.ok) this.session = result.session;
    this.uiState.travelV2DevToolResult = result;
    this.statusMessage = result.ok ? "Travel v2 dev marked current round not run / ended early." : (result.blockedReasons?.[0] ?? result.error ?? "Travel v2 dev early-end failed.");
    return this.render(true);
  }


  #getTravelV2SampleShipOptions() {
    const selected = this.#getSelectedShipActor() ?? this.#getSessionShipActor();
    const actors = Array.from(globalThis.game?.actors ?? []);
    return actors
      .filter((actor) => actor?.type === "vehicle" || actor?.getFlag?.("arcflight", "ship") === true || actor?.system?.arcflight?.ship === true)
      .map((actor) => ({
        id: actor.id ?? "",
        uuid: actor.uuid ?? "",
        name: actor.name ?? "Unnamed Ship",
        label: `${actor.name ?? "Unnamed Ship"}${actor.type ? ` (${actor.type})` : ""}`,
        selected: selected ? (actor.id === selected.id || actor.uuid === selected.uuid) : false
      }));
  }

  async #requestTravelV2LanternSampleSetup() {
    const dialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    const shipOptions = this.#getTravelV2SampleShipOptions();
    if (typeof dialogV2?.prompt !== "function") {
      const selected = shipOptions.find((option) => option.selected) ?? shipOptions[0] ?? null;
      return selected ? { cancelled: false, actorId: selected.id, actorUuid: selected.uuid, actorName: selected.name, sessionName: "Lantern in the Static — Travel v2 Dev Sample", notes: "Travel v2 Lantern sample setup." } : { cancelled: true };
    }
    const optionsHtml = shipOptions.length
      ? shipOptions.map((ship, index) => `<option value="${escapeHtml(ship.id)}" data-actor-uuid="${escapeHtml(ship.uuid)}" data-actor-name="${escapeHtml(ship.name)}" ${(ship.selected || (!shipOptions.some((option) => option.selected) && index === 0)) ? "selected" : ""}>${escapeHtml(ship.label)}</option>`).join("")
      : `<option value="" selected>No PF2E vehicle actors available</option>`;
    try {
      const data = await dialogV2.prompt({
        window: { title: "Set Up Lantern Travel v2 Sample" },
        content: `<form><p>Create a local Travel v2 sample runner for <strong>Lantern in the Static</strong>.</p><div class="form-group"><label>Ship / PF2E vehicle</label><select name="actorId" ${shipOptions.length ? "" : "disabled"}>${optionsHtml}</select></div><div class="form-group"><label>Session name</label><input type="text" name="sessionName" value="Lantern in the Static — Travel v2 Dev Sample"></div><div class="form-group"><label>Session notes</label><textarea name="notes" rows="3">Travel v2 Lantern sample setup.</textarea></div><p class="notes">This creates a local runner session only. It does not mutate actors or publish content.</p></form>`,
        rejectClose: false,
        ok: {
          label: "Create Sample",
          callback: (event, _button, dialog) => {
            const form = event?.currentTarget?.closest?.("form") ?? dialog?.element?.querySelector?.("form") ?? dialog?.element?.[0]?.querySelector?.("form");
            const formData = form ? new FormData(form) : null;
            const select = form?.querySelector?.("[name='actorId']");
            const selectedOption = select?.selectedOptions?.[0];
            return {
              actorId: String(formData?.get("actorId") ?? ""),
              actorUuid: selectedOption?.dataset?.actorUuid ?? "",
              actorName: selectedOption?.dataset?.actorName ?? "",
              sessionName: String(formData?.get("sessionName") ?? ""),
              notes: String(formData?.get("notes") ?? "")
            };
          }
        },
        cancel: { label: "Cancel" }
      });
      return data ? { cancelled: false, ...data } : { cancelled: true };
    } catch (_error) {
      return { cancelled: true };
    }
  }

  async #setupTravelV2LanternSample() {
    const setup = await this.#requestTravelV2LanternSampleSetup();
    if (setup.cancelled) {
      this.statusMessage = "Lantern sample setup cancelled; no runner session was created.";
      return this.render(true);
    }
    if (!setup.actorId && !setup.actorUuid) {
      this.statusMessage = "Lantern sample setup requires a PF2E vehicle / Arcflight ship.";
      ui.notifications?.warn?.(this.statusMessage);
      return this.render(true);
    }
    const actor = this.#resolveActorByIdOrUuid(setup.actorId, setup.actorUuid);
    const result = createLanternTravelV2SampleSession({ ship: actor ?? { actorId: setup.actorId, actorUuid: setup.actorUuid, actorName: setup.actorName }, name: setup.sessionName, notes: setup.notes });
    if (result.ok) {
      const saved = await saveTravelEventRunnerSessionToLibrary(result.session, { saveAs: true, name: result.session.name });
      this.session = saved.session ?? result.session;
      this.selectedSessionKey = this.session?.key ?? this.selectedSessionKey;
      this.uiState.travelV2DevToolResult = saved.ok ? saved : result;
      this.statusMessage = saved.ok ? "Travel v2 Lantern sample session created and saved for repeated testing." : "Travel v2 Lantern sample session created locally; save it manually if needed.";
    } else {
      this.uiState.travelV2DevToolResult = result;
      this.statusMessage = result.errors?.[0] ?? result.error ?? "Could not create Lantern sample session.";
    }
    return this.render(true);
  }

  async #copyTravelV2DebugReport() {
    const result = await copyTravelV2DebugReport(this.session);
    this.uiState.travelV2DevToolResult = result;
    this.statusMessage = result.ok ? "Copied Travel v2 debug report." : (result.error ?? "Could not copy Travel v2 debug report; debug text is shown below.");
    if (result.ok) ui.notifications?.info?.(this.statusMessage); else ui.notifications?.warn?.(this.statusMessage);
    return this.render(true);
  }

  async #sendPlayerMissionBoard() {
    console.debug("Arcflight | GM send/refreshed mission board from runner.", { sessionKey: this.session?.key, roundIndex: this.session?.currentRoundIndex });
    const result = sendTravelPlayerMissionBoardToPlayers(this.session, { actor: this.#getSelectedShipActor(), refresh: true });
    if (!result.ok) ui.notifications?.warn?.(result.errors?.[0] ?? "No active non-GM users found.");
    else ui.notifications?.info?.(`Sent player mission board to ${result.sentRecipients} active player recipient(s).`);
    this.statusMessage = result.ok ? "Sent / refreshed Player HUD and Station Cards." : (result.errors?.[0] ?? "No active non-GM users found.");
    await this.render(true);
    return result;
  }

  #refreshPlayersQuietly() {
    return queueTravelPlayerMissionBoardRefreshToPlayers(this.session, { actor: this.#getSelectedShipActor(), refresh: true });
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

  async #saveCompletedTravelV2SessionForReopen() {
    const completed = this.session?.status === "completed" || this.session?.completed === true || Boolean(this.session?.completedAt);
    if (!this.session || !completed) {
      return { ok: false, skipped: true, error: "No completed Travel v2 runner session is available to preserve." };
    }

    const options = {};
    if (this.session.key) {
      options.key = this.session.key;
      options.overwrite = true;
    } else {
      const eventName = this.session.event?.name ?? "Travel Event";
      const completedAt = this.session.completedAt ? new Date(this.session.completedAt).toLocaleString() : new Date().toLocaleString();
      options.name = this.session.name?.trim?.() || `${eventName} — Completed ${completedAt}`;
    }

    if (typeof globalThis.game?.settings?.set !== "function") {
      const skipped = {
        ok: false,
        skipped: true,
        error: "Foundry game.settings is unavailable; completed session was not saved for reopen/history in this environment."
      };
      this.uiState.travelV2AutoSaveResult = skipped;
      globalThis.ui?.notifications?.warn?.(skipped.error);
      return skipped;
    }

    const saved = await saveTravelEventRunnerSessionToLibrary(this.session, options);
    this.uiState.travelV2AutoSaveResult = saved;
    if (saved.ok) {
      this.session = saved.session ?? this.session;
      this.selectedSessionKey = saved.entry?.key ?? this.session?.key ?? this.selectedSessionKey;
      globalThis.ui?.notifications?.info?.("Saved for Reopen: completed Travel v2 session history updated.");
      return { ...saved, preserved: true };
    }

    globalThis.ui?.notifications?.warn?.(saved.errors?.[0] ?? "Completed Travel v2 runner session could not be saved for reopen/history.");
    return saved;
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
    const supportTarget = optionKey.startsWith("support:")
      ? this.session?.roundResults?.[roundIndex]?.stationActions?.[stationKey]?.targetStationKey || this.session?.event?.rounds?.[roundIndex]?.activeStations?.find?.((key) => key !== stationKey) || ""
      : "";
    const updated = commitTravelEventRunnerStationOrder(this.session, roundIndex, stationKey, optionKey, supportTarget ? { targetStationKey: supportTarget } : {});
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

  async #updateStationSupportTarget(select) {
    const roundIndex = Number(select.dataset.roundIndex);
    const stationKey = select.dataset.stationKey ?? "";
    const targetStationKey = select.value ?? "";
    const updated = setTravelEventRunnerStationAction(this.session, roundIndex, stationKey, "support", { targetStationKey });
    if (!updated.ok) {
      this.statusMessage = updated.errors?.[0] ?? "Support target was not updated.";
      ui.notifications?.warn?.(this.statusMessage);
    } else {
      this.session = updated.session;
      this.selectedSessionKey = updated.session.key ?? this.selectedSessionKey;
      this.statusMessage = `Selected Support target for ${humanizeIdentifier(stationKey)}.`;
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
      this.#refreshPlayersQuietly();
    }
    return this.render(true);
  }

  async #clearStationResult(target) {
    const roundIndex = Number(target.dataset.roundIndex);
    const stationKey = target.dataset.stationKey ?? "";
    const updated = clearTravelEventRunnerStationResult(this.session, roundIndex, stationKey);
    if (updated.ok) {
      this.session = updated.session;
      this.selectedSessionKey = updated.session.key ?? this.selectedSessionKey;
      this.statusMessage = `Cleared result for ${humanizeIdentifier(stationKey)}.`;
      this.#refreshPlayersQuietly();
    } else {
      this.statusMessage = updated.errors?.[0] ?? "Station result was not cleared.";
      ui.notifications?.warn?.(this.statusMessage);
    }
    return this.render(true);
  }

  async #advanceRound() {
    const updated = advanceTravelEventRunnerRound(this.session);
    this.session = updated.session ?? this.session;
    this.selectedSessionKey = this.session?.key ?? this.selectedSessionKey;
    this.statusMessage = updated.ok ? "Advanced to the next round." : (updated.errors?.[0] ?? "Could not advance the runner round.");
    if (!updated.ok) ui.notifications?.warn?.(this.statusMessage);
    this.#refreshPlayersQuietly();
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
      ?? target.dataset.arcflightTravelV2DeleteCompletedSession
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

  async #deleteCompletedTravelV2Session(target) {
    const key = this.#getSessionKeyFromTarget(target);
    const label = target.dataset.sessionName || key;
    const confirmed = await this.#confirmRunnerDialog({
      title: "Delete Completed Travel v2 Session",
      content: `<p>Delete completed Travel v2 runner session <strong>${escapeHtml(label)}</strong> from completed-session history?</p><p>This removes only the saved runner session library entry. It does not delete actor follow-up records, actor application records, published events, resources, chat, journals, or combat.</p>`,
      yesLabel: "Delete Completed Session",
      unavailableMessage: "Delete requires Foundry DialogV2; this environment cannot show the confirmation dialog."
    });
    if (!confirmed) {
      this.statusMessage = "Delete cancelled; completed Travel v2 history was not changed.";
      return this.render(true);
    }

    const deleted = await deleteTravelV2CompletedSessionFromLibrary(key);
    if (!deleted.ok) {
      this.statusMessage = deleted.errors?.[0] ?? "Completed Travel v2 session could not be deleted.";
      ui.notifications?.warn?.(this.statusMessage);
    } else {
      if (this.selectedSessionKey === deleted.deleted.key) this.selectedSessionKey = "";
      if (this.session?.key === deleted.deleted.key) this.session = null;
      this.statusMessage = `Deleted completed Travel v2 runner session "${deleted.deleted.name}". Actor follow-ups and application records were not changed.`;
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
