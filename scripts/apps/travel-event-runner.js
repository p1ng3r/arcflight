import { getCoreTravelEvent, getCoreTravelEventKeys } from "../../data/travel-events/core-travel-events.js";
import { arcflightTemplatePath } from "../sheets/sheet-helpers.js";
import {
  advanceTravelEventRunnerRound,
  completeTravelEventRunnerSession,
  createTravelEventRunnerSession,
  exportTravelEventRunnerSessionToJson,
  loadPublishedTravelEventForRunner,
  prepareTravelEventRunnerState,
  retreatTravelEventRunnerRound,
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
  "[data-arcflight-runner-clear]"
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
    const state = prepareTravelEventRunnerState(this.session, { selectedEventId: this.selectedEventId });
    if (!this.selectedEventId) this.selectedEventId = state.library?.selectedEventId ?? "";
    return {
      ...context,
      state,
      selectedEventId: this.selectedEventId,
      statusMessage: this.statusMessage,
      hardBoundaryHint: "Manual MVP only: no dice automation, actor mutation, resource application, chat posting, combat, encounters, AP/RAP, or published-event edits. Proposed effects are staged/read-only.",
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
    const target = event.target?.closest?.("[data-arcflight-runner-event-select]");
    if (!target || !this.element?.contains(target)) return;
    this.selectedEventId = target.value ?? "";
    this.statusMessage = "Published travel event selected. Start Event creates a local in-memory session.";
    await this.render(true);
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
      this.statusMessage = `Recorded ${result} for ${stationKey}.`;
    }
    return this.render(true);
  }

  async #advanceRound() {
    const updated = advanceTravelEventRunnerRound(this.session);
    this.session = updated.session ?? this.session;
    this.statusMessage = updated.ok ? "Advanced to the next round." : (updated.errors?.[0] ?? "Could not advance the runner round.");
    if (!updated.ok) ui.notifications?.warn?.(this.statusMessage);
    return this.render(true);
  }

  async #retreatRound() {
    const updated = retreatTravelEventRunnerRound(this.session);
    this.session = updated.session ?? this.session;
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

  async #clearSession() {
    this.session = null;
    this.statusMessage = "Local runner session cleared. Published events were not modified.";
    return this.render(true);
  }
}

export function openTravelEventRunner(options = {}, maybeOptions = {}) {
  const appOptions = options?.type && typeof options.getFlag === "function" ? maybeOptions : options;
  const app = new ArcflightTravelEventRunner(appOptions ?? {});
  app.render(true);
  return app;
}
