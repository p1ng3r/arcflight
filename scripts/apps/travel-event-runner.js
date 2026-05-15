import { getStation } from "../../data/stations/core-stations.js";
import { getCoreTravelEvent } from "../../data/travel-events/core-travel-events.js";
import { ARCFLIGHT_MODULE_ID, ARCFLIGHT_TRAVEL_RESULT_TIERS } from "../config/constants.js";
import { ARCFLIGHT_SHIP_ACTOR_TYPE, getArcflightShipData } from "../documents/ships.js";
import {
  advanceShipTravelEventRound,
  clearShipTravelEvent,
  completeShipTravelEvent,
  getShipTravelEventState,
  recordShipTravelStationResult,
  startShipTravelEvent
} from "../helpers/ship-travel-event-state.js";
import { getPf2eRollTotal, normalizePf2eStatisticKey, resolvePf2eActorStatistic, rollPf2eStatistic } from "../helpers/pf2e-statistics.js";
import { arcflightTemplatePath } from "../sheets/sheet-helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const BLACK_TIDE_CROSSING_KEY = "black-tide-crossing";
const RUNNER_CLICK_SELECTOR = [
  "[data-arcflight-start-black-tide]",
  "[data-arcflight-record-station-result]",
  "[data-arcflight-roll-station-prompt]",
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

function numericModifier(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function calculateEffectiveTravelDc(activeEvent, roundDefinition, prompt) {
  const baseDC = Number(activeEvent?.baseDC);
  if (!Number.isFinite(baseDC)) return null;
  return baseDC + numericModifier(roundDefinition?.dcModifier) + numericModifier(prompt?.dcModifier);
}

function getFiniteStatisticModifier(value) {
  return Number.isFinite(value) ? value : null;
}

export function getResolvedPf2eStatisticModifier(statistic) {
  return getFiniteStatisticModifier(statistic?.mod)
    ?? getFiniteStatisticModifier(statistic?.check?.mod)
    ?? getFiniteStatisticModifier(statistic?.totalModifier)
    ?? getFiniteStatisticModifier(statistic?.check?.totalModifier)
    ?? null;
}

function formatSignedStatisticModifier(modifier) {
  if (!Number.isFinite(modifier)) return "";
  return modifier >= 0 ? `+${modifier}` : String(modifier);
}

export function formatStatisticOptionLabel(statisticKey, resolution = null) {
  const baseLabel = humanizeIdentifier(statisticKey);
  if (!resolution) return baseLabel;
  if (!resolution.ok) return `${baseLabel} (unavailable)`;

  const modifier = getResolvedPf2eStatisticModifier(resolution.statistic);
  const modifierLabel = formatSignedStatisticModifier(modifier);
  return modifierLabel ? `${baseLabel} (${modifierLabel})` : baseLabel;
}

function getStatisticOptions(prompt, station) {
  const suggestedSkills = Array.isArray(prompt?.suggestedSkills) && prompt.suggestedSkills.length > 0
    ? prompt.suggestedSkills
    : station?.primarySkills ?? [];

  return Array.from(new Set(suggestedSkills.map((skill) => normalizePf2eStatisticKey(skill)).filter(Boolean)))
    .map((value, index) => ({
      value,
      label: humanizeIdentifier(value),
      selected: index === 0
    }));
}

function getStationAssignment(shipActor, stationKey) {
  if (!shipActor || !stationKey) return null;
  return getArcflightShipData(shipActor)?.stations?.assignments?.[stationKey] ?? null;
}

export async function resolveTravelStationAssignedActor(shipActor, stationKey) {
  const assignment = stationKey ? getStationAssignment(shipActor, stationKey) : null;
  if (!assignment) return { assignment: null, actor: null, actorResolved: false, actorName: "", actorId: "", actorUuid: "" };

  let actor = null;
  if (assignment.actorUuid && typeof globalThis.fromUuid === "function") {
    try {
      actor = await globalThis.fromUuid(assignment.actorUuid);
    } catch (error) {
      console.warn("Arcflight | Could not resolve travel station assigned actor UUID.", { stationKey, actorUuid: assignment.actorUuid, error });
    }
  }

  if (!actor && assignment.actorId) actor = globalThis.game?.actors?.get?.(assignment.actorId) ?? null;

  return {
    assignment: cloneData(assignment),
    actor,
    actorResolved: Boolean(actor),
    actorName: actor?.name ?? assignment.name ?? "",
    actorId: actor?.id ?? assignment.actorId ?? "",
    actorUuid: actor?.uuid ?? assignment.actorUuid ?? ""
  };
}

async function prepareStationPromptRows(shipActor, activeEvent, roundDefinition, roundState) {
  return Promise.all((roundDefinition?.activeStations ?? []).map(async (prompt) => {
    const stationKey = prompt.stationKey ?? "";
    const station = getStation(stationKey) ?? {};
    const existingResult = getPrimaryStationResult(roundState, stationKey);
    const baseStatisticOptions = getStatisticOptions(prompt, station);
    const assignmentResolution = await resolveTravelStationAssignedActor(shipActor, stationKey);
    const statisticOptions = baseStatisticOptions.map((option) => {
      const resolution = assignmentResolution.actor
        ? resolvePf2eActorStatistic(assignmentResolution.actor, option.value)
        : null;
      const modifier = resolution?.ok ? getResolvedPf2eStatisticModifier(resolution.statistic) : null;
      const modifierLabel = formatSignedStatisticModifier(modifier);

      return {
        ...option,
        label: formatStatisticOptionLabel(option.value, resolution),
        modifier,
        modifierLabel,
        resolved: Boolean(resolution?.ok),
        unavailable: Boolean(assignmentResolution.actor && !resolution?.ok)
      };
    });
    const effectiveDC = calculateEffectiveTravelDc(activeEvent, roundDefinition, prompt);
    const canRecord = !existingResult && roundState?.status !== "completed";

    return {
      ...cloneData(prompt),
      stationKey,
      stationName: station.displayName || station.name || humanizeIdentifier(stationKey),
      assignedActorName: assignmentResolution.actorName || "Unassigned",
      hasAssignedActor: assignmentResolution.actorResolved,
      assignmentHint: assignmentResolution.actorResolved ? "" : "No assigned actor. Use manual result entry.",
      suggestedSkills: statisticOptions.map((option) => option.value),
      suggestedSkillsLabel: statisticOptions.map((option) => option.label).join(", "),
      statisticOptions,
      hasStatisticOptions: statisticOptions.length > 0,
      effectiveDC,
      effectiveDCLabel: effectiveDC === null ? "—" : String(effectiveDC),
      resourceOptions: Array.isArray(prompt.resourceOptions) ? prompt.resourceOptions : [],
      hasResourceOptions: Array.isArray(prompt.resourceOptions) && prompt.resourceOptions.length > 0,
      existingResult,
      hasExistingResult: Boolean(existingResult),
      existingResultLabel: existingResult ? humanizeIdentifier(existingResult.degreeOfSuccess) : "",
      degreeOptions: DEGREE_OPTIONS.map((option) => ({ ...option, selected: option.value === ARCFLIGHT_TRAVEL_RESULT_TIERS.SUCCESS })),
      canRecord,
      canRoll: canRecord && assignmentResolution.actorResolved && statisticOptions.length > 0
    };
  }));
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

async function prepareActiveEventContext(shipActor, activeEvent) {
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
    stationPrompts: await prepareStationPromptRows(shipActor, activeEvent, currentRoundDefinition, currentRound),
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

function normalizeTravelRollDegree(degree) {
  if (degree === ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_SUCCESS || degree === 3 || degree === "3") return ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_SUCCESS;
  if (degree === ARCFLIGHT_TRAVEL_RESULT_TIERS.SUCCESS || degree === 2 || degree === "2") return ARCFLIGHT_TRAVEL_RESULT_TIERS.SUCCESS;
  if (degree === ARCFLIGHT_TRAVEL_RESULT_TIERS.FAILURE || degree === 1 || degree === "1") return ARCFLIGHT_TRAVEL_RESULT_TIERS.FAILURE;
  if (degree === ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_FAILURE || degree === 0 || degree === "0") return ARCFLIGHT_TRAVEL_RESULT_TIERS.CRITICAL_FAILURE;
  return "";
}

function getRollDegree(rollResult) {
  return rollResult?.degreeOfSuccess
    ?? rollResult?.degree
    ?? rollResult?.roll?.degreeOfSuccess
    ?? rollResult?.roll?.degree
    ?? null;
}

function getRollId(rollResult) {
  return rollResult?.rollId ?? rollResult?.id ?? rollResult?.roll?.id ?? "";
}

function getMessageId(rollResult) {
  return rollResult?.messageId ?? rollResult?.message?.id ?? rollResult?.message?._id ?? rollResult?.roll?.message?.id ?? rollResult?.roll?.messageId ?? "";
}

function getActiveRollContext(activeEvent) {
  const eventDefinition = getCoreTravelEvent(activeEvent?.eventKey);
  const roundDefinition = getRoundDefinition(eventDefinition, activeEvent?.currentRound);
  return {
    eventDefinition,
    roundDefinition,
    roundState: getRoundState(activeEvent, activeEvent?.currentRound)
  };
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
      height: 660
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
    const activeEvent = state.activeEvent ? await prepareActiveEventContext(this.shipActor, state.activeEvent) : null;
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
      noAutomationHint: "Staged effects are preview-only. This runner does not mutate travel resources, spend AP/RAP, apply staged effects, or start combat."
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
    if (target.hasAttribute("data-arcflight-roll-station-prompt")) return await this.#onRollStationPrompt(event);
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

  async #onRollStationPrompt(event) {
    event.preventDefault();

    const stationElement = event.target?.closest?.("[data-arcflight-station-prompt]")
      ?? event.currentTarget?.closest?.("[data-arcflight-station-prompt]");
    const stationKey = stationElement?.dataset?.stationKey ?? "";
    const statisticKey = normalizePf2eStatisticKey(stationElement?.querySelector?.("[data-arcflight-statistic]")?.value ?? "");

    try {
      const state = getShipTravelEventState(this.shipActor);
      const activeEvent = state.activeEvent;
      if (!activeEvent) throw new Error("Arcflight | No active travel event is available for rolling.");

      const { eventDefinition, roundDefinition, roundState } = getActiveRollContext(activeEvent);
      if (getPrimaryStationResult(roundState, stationKey)) throw new Error(`Arcflight | ${stationKey} already has a primary result for travel round ${roundState?.round ?? activeEvent.currentRound}.`);

      if (!statisticKey) throw new Error("Arcflight | Select a PF2E statistic before rolling this travel prompt.");

      const assignmentResolution = await resolveTravelStationAssignedActor(this.shipActor, stationKey);
      if (!assignmentResolution.actor) throw new Error("Arcflight | No assigned actor. Use manual result entry.");

      const statisticResolution = resolvePf2eActorStatistic(assignmentResolution.actor, statisticKey);
      if (!statisticResolution.ok) throw new Error(statisticResolution.message || `Arcflight | Could not resolve ${statisticKey} on ${assignmentResolution.actorName || "assigned actor"}.`);

      const prompt = roundDefinition?.activeStations?.find((entry) => entry.stationKey === stationKey) ?? {};
      const station = getStation(stationKey) ?? {};
      const stationName = station.displayName || station.name || humanizeIdentifier(stationKey);
      const roundTitle = roundDefinition?.title ?? `Round ${activeEvent.currentRound}`;
      const effectiveDC = calculateEffectiveTravelDc(activeEvent, roundDefinition, prompt);
      const rollResult = await rollPf2eStatistic(assignmentResolution.actor, statisticResolution.statistic, {
        event,
        title: `Arcflight Travel: ${activeEvent.eventName || eventDefinition?.name || humanizeIdentifier(activeEvent.eventKey)} — ${stationName}`,
        label: `${roundTitle} — ${stationName}`,
        slug: `arcflight-travel-${activeEvent.eventKey}-${stationKey}`,
        action: "arcflight-travel",
        dc: effectiveDC ?? undefined,
        extraRollOptions: [
          "arcflight",
          "arcflight:travel",
          `arcflight:travel:event:${activeEvent.eventKey}`,
          `arcflight:travel:station:${stationKey}`,
          `arcflight:travel:round:${activeEvent.currentRound}`,
          `arcflight:travel:statistic:${statisticKey}`
        ],
        skipDialog: false,
        createMessage: true
      });

      if (!rollResult) throw new Error("Arcflight | PF2E statistic roll did not return a result. Use manual result entry.");

      const degreeOfSuccess = normalizeTravelRollDegree(getRollDegree(rollResult));
      if (!degreeOfSuccess) throw new Error("Arcflight | PF2E roll completed, but no degree of success was available. Use manual result entry.");

      await recordShipTravelStationResult(this.shipActor, {
        stationKey,
        actorUuid: assignmentResolution.actorUuid,
        actorId: assignmentResolution.actorId,
        actorName: assignmentResolution.actorName,
        statisticKey,
        degreeOfSuccess,
        notes: `PF2E ${humanizeIdentifier(statisticKey)} roll`,
        rollTotal: getPf2eRollTotal(rollResult),
        rollId: getRollId(rollResult),
        messageId: getMessageId(rollResult),
        source: "pf2e-roll"
      });

      ui.notifications?.info?.(`Recorded ${humanizeIdentifier(degreeOfSuccess)} for ${stationName}.`);
      await this.#rerenderAfterAction();
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not roll that travel station prompt.");
      console.warn("Arcflight | Travel runner PF2E station prompt roll failed.", { stationKey, statisticKey, error });
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
