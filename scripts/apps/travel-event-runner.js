import { getStation } from "../../data/stations/core-stations.js";
import { getCoreTravelEvent } from "../../data/travel-events/core-travel-events.js";
import { ARCFLIGHT_MODULE_ID, ARCFLIGHT_TRAVEL_RESULT_TIERS } from "../config/constants.js";
import { ARCFLIGHT_SHIP_ACTOR_TYPE } from "../documents/ships.js";
import {
  advanceShipTravelEventRound,
  clearShipTravelEvent,
  completeShipTravelEvent,
  getShipTravelEventState,
  recordShipTravelStationResult,
  startShipTravelEvent
} from "../helpers/ship-travel-event-state.js";
import { arcflightTemplatePath } from "../sheets/sheet-helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const BLACK_TIDE_CROSSING_KEY = "black-tide-crossing";
const RUNNER_CLICK_SELECTOR = [
  "[data-arcflight-start-black-tide]",
  "[data-arcflight-record-station-result]",
  "[data-arcflight-advance-travel-round]",
  "[data-arcflight-complete-travel-event]",
  "[data-arcflight-clear-travel-event]"
].join(", ");

const DEGREE_OPTIONS = Object.freeze([
  { value: ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_SUCCESS, label: "Critical Success" },
  { value: ARCFLIGHT_TRAVEL_RESULT_TIERS.SUCCESS, label: "Success" },
  { value: ARCFLIGHT_TRAVEL_RESULT_TIERS.FAILURE, label: "Failure" },
  { value: ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_FAILURE, label: "Critical Failure" }
]);

function cloneData(value) {
  if (value == null) return value;
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function humanizeIdentifier(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTimestamp(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
  return new Date(timestamp).toLocaleString();
}

function prepareEffectRows(effects = []) {
  return (Array.isArray(effects) ? effects : []).map((effect, index) => ({
    ...effect,
    index,
    label: effect.label || humanizeIdentifier(effect.resource || effect.target || effect.type || `Effect ${index + 1}`),
    typeLabel: humanizeIdentifier(effect.type || "effect"),
    targetLabel: effect.resource || effect.target || "—",
    modeLabel: humanizeIdentifier(effect.mode || "preview"),
    valueLabel: effect.value ?? "—"
  }));
}

function prepareCombatHandoff(source = {}) {
  return {
    available: source?.combatHandoff === true,
    handoffNotes: source?.handoffNotes ?? ""
  };
}

function getRoundDefinition(eventDefinition, roundNumber) {
  return eventDefinition?.rounds?.find((round) => round.round === Number(roundNumber)) ?? null;
}

function getRoundState(activeEvent, roundNumber) {
  return activeEvent?.rounds?.find((round) => round.round === Number(roundNumber)) ?? null;
}

function getPrimaryStationResult(roundState, stationKey) {
  return roundState?.stationResults?.find((result) => result.stationKey === stationKey && result.primary !== false) ?? null;
}

function prepareStationPromptRows(roundDefinition, roundState) {
  return (roundDefinition?.activeStations ?? []).map((prompt) => {
    const stationKey = prompt.stationKey ?? "";
    const station = getStation(stationKey) ?? {};
    const existingResult = getPrimaryStationResult(roundState, stationKey);

    return {
      ...cloneData(prompt),
      stationKey,
      stationName: station.name || humanizeIdentifier(stationKey),
      suggestedSkills: Array.isArray(prompt.suggestedSkills) ? prompt.suggestedSkills : station.primarySkills ?? [],
      suggestedSkillsLabel: (Array.isArray(prompt.suggestedSkills) ? prompt.suggestedSkills : station.primarySkills ?? []).join(", "),
      resourceOptions: Array.isArray(prompt.resourceOptions) ? prompt.resourceOptions : [],
      hasResourceOptions: Array.isArray(prompt.resourceOptions) && prompt.resourceOptions.length > 0,
      existingResult,
      hasExistingResult: Boolean(existingResult),
      existingResultLabel: existingResult ? humanizeIdentifier(existingResult.degreeOfSuccess) : "",
      degreeOptions: DEGREE_OPTIONS.map((option) => ({ ...option, selected: option.value === ARCFLIGHT_TRAVEL_RESULT_TIERS.SUCCESS })),
      canRecord: !existingResult && roundState?.status !== "completed"
    };
  });
}

function prepareCompletedRoundEffects(activeEvent = {}) {
  return (activeEvent.rounds ?? [])
    .filter((round) => Array.isArray(round.stagedEffects) && round.stagedEffects.length > 0)
    .map((round) => ({
      round: round.round,
      title: `Round ${round.round}`,
      outcomeKey: round.outcomeKey ?? "",
      outcomeLabel: humanizeIdentifier(round.outcomeKey),
      effects: prepareEffectRows(round.stagedEffects),
      effectCount: round.stagedEffects.length
    }));
}

function prepareLastCompletedSummary(state = {}) {
  const completedEvents = Array.isArray(state.completedEvents) ? state.completedEvents : [];
  const event = completedEvents.at?.(-1) ?? completedEvents[completedEvents.length - 1] ?? null;
  if (!event) return null;

  return {
    ...cloneData(event),
    eventName: event.eventName || humanizeIdentifier(event.eventKey),
    finalOutcomeLabel: humanizeIdentifier(event.finalOutcomeKey),
    completedAtLabel: formatTimestamp(event.completedAt),
    stagedFinalEffectsCount: Array.isArray(event.stagedFinalEffects) ? event.stagedFinalEffects.length : 0,
    stagedFinalEffects: prepareEffectRows(event.stagedFinalEffects),
    combatHandoff: event.combatHandoff === true,
    handoffNotes: event.handoffNotes ?? ""
  };
}

function prepareActiveEventContext(activeEvent) {
  const eventDefinition = getCoreTravelEvent(activeEvent.eventKey);
  const currentRound = getRoundState(activeEvent, activeEvent.currentRound);
  const currentRoundDefinition = getRoundDefinition(eventDefinition, activeEvent.currentRound);
  const isFinalRound = Number(activeEvent.currentRound) >= Number(activeEvent.roundCount);
  const finalOutcomeKey = globalThis.game?.arcflight?.getTravelEventOutcome?.({ ...activeEvent.totals }) ?? "";
  const finalOutcome = finalOutcomeKey ? eventDefinition?.finalOutcomes?.[finalOutcomeKey] : null;

  return {
    ...cloneData(activeEvent),
    categoryLabel: humanizeIdentifier(activeEvent.category),
    statusLabel: humanizeIdentifier(activeEvent.status),
    currentRound,
    currentRoundDefinition,
    currentRoundTitle: currentRoundDefinition?.title ?? `Round ${activeEvent.currentRound}`,
    currentRoundVignette: currentRoundDefinition?.openingVignette ?? "",
    stationPrompts: prepareStationPromptRows(currentRoundDefinition, currentRound),
    hasStationPrompts: (currentRoundDefinition?.activeStations ?? []).length > 0,
    stagedRoundEffects: prepareCompletedRoundEffects(activeEvent),
    hasStagedRoundEffects: prepareCompletedRoundEffects(activeEvent).length > 0,
    stagedFinalEffects: prepareEffectRows(activeEvent.stagedFinalEffects),
    hasStagedFinalEffects: Array.isArray(activeEvent.stagedFinalEffects) && activeEvent.stagedFinalEffects.length > 0,
    combatHandoff: prepareCombatHandoff(activeEvent),
    isFinalRound,
    canAdvanceRound: activeEvent.status !== "awaitingCompletion",
    advanceButtonLabel: isFinalRound ? "Stage Final Round Outcome" : "Advance Round",
    expectedFinalOutcomeLabel: finalOutcome ? finalOutcome.label || humanizeIdentifier(finalOutcomeKey) : humanizeIdentifier(finalOutcomeKey)
  };
}

export function isArcflightTravelRunnerShipActor(shipActor) {
  return shipActor?.type === "vehicle"
    && shipActor?.getFlag?.(ARCFLIGHT_MODULE_ID, "enabled") === true
    && shipActor?.getFlag?.(ARCFLIGHT_MODULE_ID, "actorType") === ARCFLIGHT_SHIP_ACTOR_TYPE;
}

export function assertArcflightTravelRunnerShipActor(shipActor) {
  if (!isArcflightTravelRunnerShipActor(shipActor)) {
    throw new Error("Arcflight | Travel Event Runner requires an Arcflight-enabled PF2E vehicle actor.");
  }
}

async function confirmClearActiveEvent(shipActor) {
  const actorName = shipActor?.name ?? "this ship";
  const escapedActorName = foundry.utils.escapeHTML(actorName);
  const title = "Clear Active Travel Event";
  const content = `<p>Clear the active travel event for <strong>${escapedActorName}</strong>?</p><p>This cancels the active runner state. It does not apply staged effects, mutate travel resources, start combat, or spend AP/RAP.</p>`;
  const dialogV2 = foundry.applications.api.DialogV2;

  if (typeof dialogV2?.confirm === "function") {
    return await dialogV2.confirm({ window: { title }, content, rejectClose: false });
  }

  if (typeof globalThis.Dialog?.confirm === "function") {
    return await globalThis.Dialog.confirm({ title, content, defaultYes: false });
  }

  return globalThis.confirm?.(`Clear the active travel event for ${actorName}?`) === true;
}

export class ArcflightTravelEventRunner extends HandlebarsApplicationMixin(ApplicationV2) {
  #boundRunnerClick = this.#onRunnerClick.bind(this);

  constructor(shipActor, options = {}) {
    assertArcflightTravelRunnerShipActor(shipActor);
    super(options);
    this.shipActor = shipActor;
  }

  static DEFAULT_OPTIONS = {
    classes: ["arcflight", "arcflight-travel-runner"],
    tag: "section",
    position: {
      width: 760,
      height: 720
    },
    window: {
      title: "Travel Event Runner",
      resizable: true
    }
  };

  static PARTS = {
    runner: {
      template: arcflightTemplatePath("apps/travel-event-runner.hbs")
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const state = getShipTravelEventState(this.shipActor);
    const activeEvent = state.activeEvent ? prepareActiveEventContext(state.activeEvent) : null;
    const lastCompletedEvent = prepareLastCompletedSummary(state);

    return {
      ...context,
      ship: this.shipActor,
      shipName: this.shipActor?.name ?? "Unknown Ship",
      state,
      activeEvent,
      hasActiveEvent: Boolean(activeEvent),
      noActiveEvent: !activeEvent,
      lastCompletedEvent,
      hasLastCompletedEvent: Boolean(lastCompletedEvent),
      canStartBlackTideCrossing: !activeEvent,
      noAutomationHint: "Staged effects are preview-only. This runner does not mutate travel resources, spend AP/RAP, roll PF2E statistics, or start combat."
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    this.element?.removeEventListener("click", this.#boundRunnerClick);
    this.element?.addEventListener("click", this.#boundRunnerClick);
  }

  async #onRunnerClick(event) {
    const target = event.target?.closest?.(RUNNER_CLICK_SELECTOR);
    if (!target || !this.element?.contains(target) || target.disabled === true) return;

    if (target.hasAttribute("data-arcflight-start-black-tide")) return await this.#onStartBlackTideCrossing(event);
    if (target.hasAttribute("data-arcflight-record-station-result")) return await this.#onRecordStationResult(event);
    if (target.hasAttribute("data-arcflight-advance-travel-round")) return await this.#onAdvanceRound(event);
    if (target.hasAttribute("data-arcflight-complete-travel-event")) return await this.#onCompleteEvent(event);
    if (target.hasAttribute("data-arcflight-clear-travel-event")) return await this.#onClearEvent(event);
  }

  async #rerenderAfterAction() {
    await this.render(true);
  }

  async #onStartBlackTideCrossing(event) {
    event.preventDefault();

    try {
      await startShipTravelEvent(this.shipActor, BLACK_TIDE_CROSSING_KEY);
      ui.notifications?.info?.("Started Black Tide Crossing.");
      await this.#rerenderAfterAction();
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not start that travel event.");
      console.warn("Arcflight | Travel runner start failed.", error);
    }
  }

  async #onRecordStationResult(event) {
    event.preventDefault();

    const stationElement = event.target?.closest?.("[data-arcflight-station-prompt]")
      ?? event.currentTarget?.closest?.("[data-arcflight-station-prompt]");
    const stationKey = stationElement?.dataset?.stationKey ?? "";
    const degreeOfSuccess = stationElement?.querySelector?.("[data-arcflight-degree]")?.value ?? "";
    const actorName = stationElement?.querySelector?.("[data-arcflight-actor-name]")?.value ?? "";
    const notes = stationElement?.querySelector?.("[data-arcflight-notes]")?.value ?? "";

    try {
      await recordShipTravelStationResult(this.shipActor, { stationKey, degreeOfSuccess, actorName, notes });
      ui.notifications?.info?.(`Recorded ${humanizeIdentifier(degreeOfSuccess)} for ${humanizeIdentifier(stationKey)}.`);
      await this.#rerenderAfterAction();
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not record that station result.");
      console.warn("Arcflight | Travel runner station result failed.", error);
    }
  }

  async #onAdvanceRound(event) {
    event.preventDefault();

    try {
      await advanceShipTravelEventRound(this.shipActor);
      ui.notifications?.info?.("Travel event round staged and advanced.");
      await this.#rerenderAfterAction();
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not advance that travel event round.");
      console.warn("Arcflight | Travel runner advance failed.", error);
    }
  }

  async #onCompleteEvent(event) {
    event.preventDefault();

    try {
      await completeShipTravelEvent(this.shipActor);
      ui.notifications?.info?.("Travel event completed. Final effects are staged only.");
      await this.#rerenderAfterAction();
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not complete that travel event.");
      console.warn("Arcflight | Travel runner complete failed.", error);
    }
  }

  async #onClearEvent(event) {
    event.preventDefault();

    const confirmed = await confirmClearActiveEvent(this.shipActor);
    if (!confirmed) return;

    try {
      await clearShipTravelEvent(this.shipActor);
      ui.notifications?.info?.("Active travel event cleared.");
      await this.#rerenderAfterAction();
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not clear that travel event.");
      console.warn("Arcflight | Travel runner clear failed.", error);
    }
  }
}

export function openTravelEventRunner(shipActor, options = {}) {
  assertArcflightTravelRunnerShipActor(shipActor);
  const app = new ArcflightTravelEventRunner(shipActor, options);
  app.render(true);
  return app;
}
