import { getStation } from "../../data/stations/core-stations.js";
import { getCoreTravelEvent, getCoreTravelEventKeys } from "../../data/travel-events/core-travel-events.js";
import { ARCFLIGHT_MODULE_ID, ARCFLIGHT_TRAVEL_RESULT_TIERS } from "../config/constants.js";
import { ARCFLIGHT_SHIP_ACTOR_TYPE, getArcflightShipData } from "../documents/ships.js";
import {
  advanceShipTravelEventRound,
  applyTravelStagedEffect,
  clearShipTravelEvent,
  completeShipTravelEvent,
  getShipTravelEventState,
  previewTravelStagedEffectApplication,
  recordShipTravelStationResult,
  startShipTravelEvent
} from "../helpers/ship-travel-event-state.js";
import { getPf2eRollTotal, normalizePf2eStatisticKey, resolvePf2eActorStatistic, rollPf2eStatistic } from "../helpers/pf2e-statistics.js";
import { arcflightTemplatePath } from "../sheets/sheet-helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const DEFAULT_TRAVEL_EVENT_KEY = "black-tide-crossing";
const RUNNER_CLICK_SELECTOR = [
  "[data-arcflight-start-selected-travel-event]",
  "[data-arcflight-record-station-result]",
  "[data-arcflight-roll-station-prompt]",
  "[data-arcflight-advance-travel-round]",
  "[data-arcflight-complete-travel-event]",
  "[data-arcflight-clear-travel-event]",
  "[data-arcflight-apply-staged-effect]",
  "[data-arcflight-apply-staged-effects]"
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


function getDefaultTravelEventKey() {
  const keys = getCoreTravelEventKeys();
  if (keys.includes(DEFAULT_TRAVEL_EVENT_KEY)) return DEFAULT_TRAVEL_EVENT_KEY;
  return keys[0] ?? "";
}

function normalizeSelectedTravelEventKey(selectedKey = "") {
  const keys = getCoreTravelEventKeys();
  if (selectedKey && keys.includes(selectedKey)) return selectedKey;
  return getDefaultTravelEventKey();
}

export function prepareTravelEventLibraryOptions(selectedKey = "") {
  const normalizedSelectedKey = normalizeSelectedTravelEventKey(selectedKey);

  return getCoreTravelEventKeys()
    .map((key) => getCoreTravelEvent(key))
    .filter(Boolean)
    .map((event) => ({
      key: event.key,
      name: event.name || humanizeIdentifier(event.key),
      category: event.category ?? "",
      categoryLabel: humanizeIdentifier(event.category),
      roundCount: Number(event.roundCount) || 0,
      baseDC: Number(event.baseDC) || 0,
      description: event.description || event.gmSummary || "",
      gmSummary: event.gmSummary || "",
      tags: Array.isArray(event.tags) ? [...event.tags] : [],
      tagsLabel: Array.isArray(event.tags) ? event.tags.map((tag) => humanizeIdentifier(tag)).join(", ") : "",
      selected: event.key === normalizedSelectedKey
    }));
}

export function prepareSelectedTravelEventLibraryDetails(selectedKey = "") {
  const options = prepareTravelEventLibraryOptions(selectedKey);
  return options.find((option) => option.selected) ?? options[0] ?? null;
}

function prepareEffectRows(shipActor, effects = []) {
  return (Array.isArray(effects) ? effects : []).map((effect, index) => {
    const preview = previewTravelStagedEffectApplication(shipActor, effect);
    const isResourceEffect = preview.supported === true;
    const applied = effect.applied === true;
    const beforeValue = isResourceEffect ? preview.before?.[effect.resource] : null;
    const afterValue = isResourceEffect ? preview.after?.[effect.resource] : null;
    const valueLabel = effect.value ?? "—";
    const previewLabel = isResourceEffect ? `${beforeValue} → ${afterValue}` : "Manual / unsupported in MVP";

    return {
      ...effect,
      index,
      label: effect.label || humanizeIdentifier(effect.resource || effect.target || effect.type || `Effect ${index + 1}`),
      typeLabel: humanizeIdentifier(effect.type || "effect"),
      targetLabel: effect.resource || effect.target || "—",
      modeLabel: humanizeIdentifier(effect.mode || "preview"),
      valueLabel,
      preview,
      previewLabel,
      beforeValue,
      afterValue,
      isResourceEffect,
      isUnsupportedEffect: !isResourceEffect,
      applied,
      appliedAtLabel: formatTimestamp(effect.appliedAt),
      canApply: isResourceEffect && !applied && globalThis.game?.user?.isGM === true,
      applyStatusLabel: applied ? "Applied" : (isResourceEffect ? "Ready" : "Manual / unsupported in MVP")
    };
  });
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
    const existingResultDegree = normalizeTravelRollDegree(existingResult?.degreeOfSuccess);
    const existingRollFeedback = existingResultDegree && prompt?.rollFeedback && typeof prompt.rollFeedback === "object"
      ? prompt.rollFeedback[existingResultDegree] ?? ""
      : "";

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
      playerAction: typeof prompt.playerAction === "string" ? prompt.playerAction : "",
      hasPlayerAction: typeof prompt.playerAction === "string" && prompt.playerAction.trim().length > 0,
      resourceOptions: Array.isArray(prompt.resourceOptions) ? prompt.resourceOptions : [],
      hasResourceOptions: Array.isArray(prompt.resourceOptions) && prompt.resourceOptions.length > 0,
      existingResult,
      hasExistingResult: Boolean(existingResult),
      existingResultLabel: existingResult ? humanizeIdentifier(existingResult.degreeOfSuccess) : "",
      existingRollFeedback,
      hasExistingRollFeedback: existingRollFeedback.trim().length > 0,
      degreeOptions: DEGREE_OPTIONS.map((option) => ({ ...option, selected: option.value === ARCFLIGHT_TRAVEL_RESULT_TIERS.SUCCESS })),
      canRecord,
      canRoll: canRecord && assignmentResolution.actorResolved && statisticOptions.length > 0
    };
  }));
}


function getStationPromptForResult(activeEvent, stationKey) {
  if (!activeEvent || !stationKey) return null;
  const eventDefinition = getCoreTravelEvent(activeEvent.eventKey);
  const roundDefinition = getRoundDefinition(eventDefinition, activeEvent.currentRound);
  return roundDefinition?.activeStations?.find((entry) => entry.stationKey === stationKey) ?? null;
}

function getStationResultNarrative(activeEvent, stationKey, degreeOfSuccess) {
  const degree = normalizeTravelRollDegree(degreeOfSuccess);
  const prompt = getStationPromptForResult(activeEvent, stationKey);
  const playerAction = typeof prompt?.playerAction === "string" ? prompt.playerAction.trim() : "";
  const feedbackText = degree && typeof prompt?.rollFeedback?.[degree] === "string" ? prompt.rollFeedback[degree].trim() : "";

  return {
    playerAction,
    feedbackText,
    narrativeText: feedbackText
  };
}

function getStationName(stationKey) {
  const station = getStation(stationKey) ?? {};
  return station.displayName || station.name || humanizeIdentifier(stationKey);
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

function prepareCompletedRoundEffects(shipActor, activeEvent = {}) {
  return (activeEvent.rounds ?? [])
    .filter((round) => Array.isArray(round.stagedEffects) && round.stagedEffects.length > 0)
    .map((round) => ({
      round: round.round,
      title: `Round ${round.round}`,
      outcomeKey: round.outcomeKey ?? "",
      outcomeLabel: humanizeIdentifier(round.outcomeKey),
      effects: prepareEffectRows(shipActor, round.stagedEffects),
      effectCount: round.stagedEffects.length
    }));
}

function prepareLastCompletedSummary(shipActor, state = {}) {
  const completedEvents = Array.isArray(state.completedEvents) ? state.completedEvents : [];
  const event = completedEvents.at?.(-1) ?? completedEvents[completedEvents.length - 1] ?? null;
  if (!event) return null;

  const narrativeLog = prepareTravelEventNarrativeLog(event);

  return {
    ...cloneData(event),
    completedEventIndex: completedEvents.length - 1,
    eventName: event.eventName || humanizeIdentifier(event.eventKey),
    finalOutcomeLabel: humanizeIdentifier(event.finalOutcomeKey),
    completedAtLabel: formatTimestamp(event.completedAt),
    stagedFinalEffectsCount: Array.isArray(event.stagedFinalEffects) ? event.stagedFinalEffects.length : 0,
    stagedFinalEffects: prepareEffectRows(shipActor, event.stagedFinalEffects),
    narrativeLog,
    hasNarrativeLog: narrativeLog.length > 0,
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

  const narrativeLog = prepareTravelEventNarrativeLog(activeEvent);

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
    stagedRoundEffects: prepareCompletedRoundEffects(shipActor, activeEvent),
    hasStagedRoundEffects: prepareCompletedRoundEffects(shipActor, activeEvent).length > 0,
    stagedFinalEffects: prepareEffectRows(shipActor, activeEvent.stagedFinalEffects),
    hasStagedFinalEffects: Array.isArray(activeEvent.stagedFinalEffects) && activeEvent.stagedFinalEffects.length > 0,
    combatHandoff: prepareCombatHandoff(activeEvent),
    narrativeLog,
    hasNarrativeLog: narrativeLog.length > 0,
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

function getStationRollFeedback(activeEvent, stationKey, degreeOfSuccess) {
  return getStationResultNarrative(activeEvent, stationKey, degreeOfSuccess).feedbackText;
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
  #boundRunnerChange = this.#onRunnerChange.bind(this);

  constructor(shipActor, options = {}) {
    assertArcflightTravelRunnerShipActor(shipActor);
    super(options);
    this.shipActor = shipActor;
    this.selectedEventKey = normalizeSelectedTravelEventKey(options.selectedEventKey ?? DEFAULT_TRAVEL_EVENT_KEY);
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
    const lastCompletedEvent = prepareLastCompletedSummary(this.shipActor, state);
    const selectedEventKey = normalizeSelectedTravelEventKey(this.selectedEventKey);
    this.selectedEventKey = selectedEventKey;
    const travelEventOptions = prepareTravelEventLibraryOptions(selectedEventKey);
    const selectedTravelEvent = prepareSelectedTravelEventLibraryDetails(selectedEventKey);

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
      travelEventOptions,
      hasTravelEventOptions: travelEventOptions.length > 0,
      selectedTravelEvent,
      hasSelectedTravelEvent: Boolean(selectedTravelEvent),
      noAutomationHint: "Staged effects require explicit GM Apply clicks. This runner never spends AP/RAP, starts combat, creates encounters, or auto-applies effects."
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    this.element?.removeEventListener("click", this.#boundRunnerClick);
    this.element?.addEventListener("click", this.#boundRunnerClick);
    this.element?.removeEventListener("change", this.#boundRunnerChange);
    this.element?.addEventListener("change", this.#boundRunnerChange);
  }

  async #onRunnerClick(event) {
    const target = event.target?.closest?.(RUNNER_CLICK_SELECTOR);
    if (!target || !this.element?.contains(target) || target.disabled === true) return;

    if (target.hasAttribute("data-arcflight-start-selected-travel-event")) return await this.#onStartSelectedTravelEvent(event);
    if (target.hasAttribute("data-arcflight-record-station-result")) return await this.#onRecordStationResult(event);
    if (target.hasAttribute("data-arcflight-roll-station-prompt")) return await this.#onRollStationPrompt(event);
    if (target.hasAttribute("data-arcflight-advance-travel-round")) return await this.#onAdvanceRound(event);
    if (target.hasAttribute("data-arcflight-complete-travel-event")) return await this.#onCompleteEvent(event);
    if (target.hasAttribute("data-arcflight-clear-travel-event")) return await this.#onClearEvent(event);
    if (target.hasAttribute("data-arcflight-apply-staged-effect")) return await this.#onApplyStagedEffect(event, target);
    if (target.hasAttribute("data-arcflight-apply-staged-effects")) return await this.#onApplyStagedEffects(event, target);
  }

  async #onRunnerChange(event) {
    const target = event.target?.closest?.("[data-arcflight-travel-event-select]");
    if (!target || !this.element?.contains(target)) return;

    this.selectedEventKey = normalizeSelectedTravelEventKey(target.value);
    await this.render(true);
  }

  async #rerenderAfterAction() {
    await this.render(true);
  }

  get #isGm() {
    return globalThis.game?.user?.isGM === true;
  }

  #getStagedEffectContext(target) {
    const source = target?.dataset?.source ?? "";
    const round = target?.dataset?.round ? Number(target.dataset.round) : null;
    const completedEventIndex = target?.dataset?.completedEventIndex ? Number(target.dataset.completedEventIndex) : null;
    const effectIndex = Number(target?.dataset?.effectIndex);
    const state = getShipTravelEventState(this.shipActor);

    if (source === "activeRound") {
      const roundState = state.activeEvent?.rounds?.find((entry) => entry.round === round) ?? null;
      return { source, round, effectIndex, effects: roundState?.stagedEffects ?? [], effect: roundState?.stagedEffects?.[effectIndex] ?? null };
    }

    if (source === "activeFinal") {
      return { source, effectIndex, effects: state.activeEvent?.stagedFinalEffects ?? [], effect: state.activeEvent?.stagedFinalEffects?.[effectIndex] ?? null };
    }

    if (source === "completedFinal") {
      const eventIndex = Number.isInteger(completedEventIndex) ? completedEventIndex : (state.completedEvents?.length ?? 0) - 1;
      const completedEvent = state.completedEvents?.[eventIndex] ?? null;
      return { source, completedEventIndex: eventIndex, effectIndex, effects: completedEvent?.stagedFinalEffects ?? [], effect: completedEvent?.stagedFinalEffects?.[effectIndex] ?? null };
    }

    return { source, effectIndex, effects: [], effect: null };
  }

  async #onApplyStagedEffect(event, target) {
    event.preventDefault();

    if (!this.#isGm) {
      ui.notifications?.warn?.("Only a GM can apply staged travel effects.");
      return;
    }

    const context = this.#getStagedEffectContext(target);
    if (!context.effect) {
      ui.notifications?.warn?.("Arcflight could not find that staged effect.");
      return;
    }

    try {
      const result = await applyTravelStagedEffect(this.shipActor, context.effect, context);
      if (result.ok) ui.notifications?.info?.(`Applied ${context.effect.label ?? "staged travel effect"}.`);
      else ui.notifications?.warn?.(result.message ?? "That staged effect was not applied.");
      await this.#rerenderAfterAction();
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not apply that staged effect.");
      console.warn("Arcflight | Travel runner staged effect apply failed.", { context, error });
    }
  }

  async #onApplyStagedEffects(event, target) {
    event.preventDefault();

    if (!this.#isGm) {
      ui.notifications?.warn?.("Only a GM can apply staged travel effects.");
      return;
    }

    const context = this.#getStagedEffectContext(target);
    const resourceEffects = context.effects.filter((effect) => previewTravelStagedEffectApplication(this.shipActor, effect).supported && effect.applied !== true);
    if (resourceEffects.length === 0) {
      ui.notifications?.warn?.("No unapplied resource staged effects are available in this group.");
      return;
    }

    try {
      const results = [];
      for (const effect of resourceEffects) {
        const effectIndex = context.effects.indexOf(effect);
        results.push(await applyTravelStagedEffect(this.shipActor, effect, { ...context, effectIndex }));
      }
      const appliedCount = results.filter((result) => result.ok).length;
      ui.notifications?.info?.(`Applied ${appliedCount} staged resource effect${appliedCount === 1 ? "" : "s"}.`);
      await this.#rerenderAfterAction();
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not apply those staged effects.");
      console.warn("Arcflight | Travel runner staged effects apply failed.", { context, error });
    }
  }

  async #onStartSelectedTravelEvent(event) {
    event.preventDefault();

    const selectedEventKey = event.target
      ?.closest?.(".arcflight-travel-runner__library")
      ?.querySelector?.("[data-arcflight-travel-event-select]")
      ?.value ?? "";

    if (!selectedEventKey) {
      ui.notifications?.warn?.("Select a travel event before starting.");
      return;
    }

    const eventDefinition = getCoreTravelEvent(selectedEventKey);
    if (!eventDefinition) {
      ui.notifications?.warn?.("Arcflight could not find that core travel event.");
      return;
    }

    try {
      await startShipTravelEvent(this.shipActor, selectedEventKey);
      ui.notifications?.info?.(`Started ${eventDefinition.name || humanizeIdentifier(selectedEventKey)}.`);
      await this.#rerenderAfterAction();
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not start that travel event.");
      console.warn("Arcflight | Travel runner start failed.", { selectedEventKey, error });
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
      const activeEvent = getShipTravelEventState(this.shipActor).activeEvent;
      const narrative = getStationResultNarrative(activeEvent, stationKey, degreeOfSuccess);
      await recordShipTravelStationResult(this.shipActor, { stationKey, degreeOfSuccess, actorName, notes, ...narrative });
      const updatedActiveEvent = getShipTravelEventState(this.shipActor).activeEvent;
      const feedback = getStationRollFeedback(updatedActiveEvent, stationKey, degreeOfSuccess);
      ui.notifications?.info?.(feedback || `Recorded ${humanizeIdentifier(degreeOfSuccess)} for ${humanizeIdentifier(stationKey)}.`);
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

      const narrative = getStationResultNarrative(activeEvent, stationKey, degreeOfSuccess);
      await recordShipTravelStationResult(this.shipActor, {
        stationKey,
        actorUuid: assignmentResolution.actorUuid,
        actorId: assignmentResolution.actorId,
        actorName: assignmentResolution.actorName,
        statisticKey,
        degreeOfSuccess,
        notes: `PF2E ${humanizeIdentifier(statisticKey)} roll`,
        ...narrative,
        rollTotal: getPf2eRollTotal(rollResult),
        rollId: getRollId(rollResult),
        messageId: getMessageId(rollResult),
        source: "pf2e-roll"
      });

      const updatedActiveEvent = getShipTravelEventState(this.shipActor).activeEvent;
      const feedback = getStationRollFeedback(updatedActiveEvent, stationKey, degreeOfSuccess);
      ui.notifications?.info?.(feedback || `Recorded ${humanizeIdentifier(degreeOfSuccess)} for ${stationName}.`);
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
