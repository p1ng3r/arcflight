import { ARCFLIGHT_MODULE_ID, ARCFLIGHT_TRAVEL_EVENT_OUTCOMES, ARCFLIGHT_TRAVEL_RESOURCES, ARCFLIGHT_TRAVEL_ROUND_OUTCOMES } from "../config/constants.js";
import { ARCFLIGHT_SHIP_ACTOR_TYPE, getArcflightShipData, getShipTravelResources, previewShipTravelResourceChange, updateShipTravelResources } from "../documents/ships.js";
import { getCoreTravelEvent } from "../../data/travel-events/core-travel-events.js";
import {
  getTravelDegreeContribution,
  getTravelEventOutcome,
  getTravelRoundOutcome,
  isTravelStationKey,
  normalizeTravelDegree,
  validateTravelEventDefinition
} from "./travel-events.js";

const EMPTY_TRAVEL_EVENT_STATE = Object.freeze({
  activeEvent: null,
  completedEvents: Object.freeze([])
});

const SUPPORTED_RESOURCE_EFFECT_MODES = Object.freeze(["add", "set"]);
const SUPPORTED_TRAVEL_EFFECT_RESOURCES = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_RESOURCES));

function isSupportedResourceStagedEffect(effect = {}) {
  return effect?.type === "resource"
    && SUPPORTED_TRAVEL_EFFECT_RESOURCES.includes(effect.resource)
    && SUPPORTED_RESOURCE_EFFECT_MODES.includes(effect.mode)
    && Number.isFinite(Number(effect.value));
}

function findIndexedEffect(effects, effect, effectIndex) {
  if (!Array.isArray(effects)) return null;
  if (Number.isInteger(effectIndex) && effectIndex >= 0 && effectIndex < effects.length) return effects[effectIndex];
  return effects.find((candidate) => candidate === effect) ?? null;
}

function resolveEffectStateReference(state, effect, options = {}) {
  const effectIndex = Number.isInteger(options.effectIndex) ? options.effectIndex : Number(options.effectIndex);
  const normalizedEffectIndex = Number.isInteger(effectIndex) ? effectIndex : null;
  const source = options.source ?? "";

  if (source === "activeRound" || options.round != null) {
    const roundNumber = Number(options.round);
    const roundState = state.activeEvent?.rounds?.find((round) => round.round === roundNumber) ?? null;
    const stateEffect = findIndexedEffect(roundState?.stagedEffects, effect, normalizedEffectIndex);
    return stateEffect ? { effect: stateEffect, container: roundState, collectionName: "stagedEffects", source: "activeRound", round: roundNumber } : null;
  }

  if (source === "activeFinal") {
    const stateEffect = findIndexedEffect(state.activeEvent?.stagedFinalEffects, effect, normalizedEffectIndex);
    return stateEffect ? { effect: stateEffect, container: state.activeEvent, collectionName: "stagedFinalEffects", source: "activeFinal" } : null;
  }

  if (source === "completedFinal" || options.completedEventIndex != null) {
    const completedEvents = Array.isArray(state.completedEvents) ? state.completedEvents : [];
    const completedEventIndex = Number.isInteger(options.completedEventIndex) ? options.completedEventIndex : Number(options.completedEventIndex);
    const eventIndex = Number.isInteger(completedEventIndex) ? completedEventIndex : completedEvents.length - 1;
    const completedEvent = eventIndex >= 0 ? completedEvents[eventIndex] : null;
    const stateEffect = findIndexedEffect(completedEvent?.stagedFinalEffects, effect, normalizedEffectIndex);
    return stateEffect ? { effect: stateEffect, container: completedEvent, collectionName: "stagedFinalEffects", source: "completedFinal", completedEventIndex: eventIndex } : null;
  }

  for (const roundState of state.activeEvent?.rounds ?? []) {
    const stateEffect = findIndexedEffect(roundState.stagedEffects, effect, normalizedEffectIndex);
    if (stateEffect) return { effect: stateEffect, container: roundState, collectionName: "stagedEffects", source: "activeRound", round: roundState.round };
  }

  const activeFinalEffect = findIndexedEffect(state.activeEvent?.stagedFinalEffects, effect, normalizedEffectIndex);
  if (activeFinalEffect) return { effect: activeFinalEffect, container: state.activeEvent, collectionName: "stagedFinalEffects", source: "activeFinal" };

  const completedEvents = Array.isArray(state.completedEvents) ? state.completedEvents : [];
  for (let index = completedEvents.length - 1; index >= 0; index -= 1) {
    const completedFinalEffect = findIndexedEffect(completedEvents[index]?.stagedFinalEffects, effect, normalizedEffectIndex);
    if (completedFinalEffect) return { effect: completedFinalEffect, container: completedEvents[index], collectionName: "stagedFinalEffects", source: "completedFinal", completedEventIndex: index };
  }

  return null;
}

function getResourceEffectChanges(shipActor, effect = {}) {
  const resource = effect.resource;
  const value = Number(effect.value);
  if (effect.mode === "set") {
    const resources = getShipTravelResources(shipActor);
    return { [resource]: value - Number(resources[resource] ?? 0) };
  }

  return { [resource]: value };
}

function cloneData(value) {
  if (value == null) return value;
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function timestamp() {
  return Date.now();
}

function currentUserId() {
  return globalThis.game?.user?.id ?? "";
}

function assertArcflightShipActor(shipActor, helperName) {
  const isArcflightShip = shipActor?.type === "vehicle"
    && shipActor.getFlag?.(ARCFLIGHT_MODULE_ID, "enabled") === true
    && shipActor.getFlag?.(ARCFLIGHT_MODULE_ID, "actorType") === ARCFLIGHT_SHIP_ACTOR_TYPE;

  if (!isArcflightShip) {
    throw new Error(`Arcflight | ${helperName} requires an Arcflight-enabled PF2E vehicle actor.`);
  }
}

function normalizeTravelEventState(systemTravelState = {}) {
  return {
    activeEvent: systemTravelState?.activeEvent ? cloneData(systemTravelState.activeEvent) : null,
    completedEvents: Array.isArray(systemTravelState?.completedEvents) ? cloneData(systemTravelState.completedEvents) : []
  };
}

function activeEventUpdatePath() {
  return `flags.${ARCFLIGHT_MODULE_ID}.system.travel`;
}

async function updateTravelEventState(shipActor, state) {
  await shipActor.update({ [activeEventUpdatePath()]: normalizeTravelEventState(state) });
  return getShipTravelEventState(shipActor);
}

function getEventRoundDefinition(activeEvent, roundNumber) {
  const event = getCoreTravelEvent(activeEvent?.eventKey);
  return event?.rounds?.find((round) => round.round === Number(roundNumber)) ?? null;
}

function getRoundState(activeEvent, roundNumber) {
  return activeEvent?.rounds?.find((round) => round.round === Number(roundNumber)) ?? null;
}

function getRoundOutcomeBranch(activeEvent, roundState) {
  const roundDefinition = getEventRoundDefinition(activeEvent, roundState?.round);
  return roundDefinition?.outcomeBranches?.[roundState?.outcomeKey] ?? null;
}

function normalizeOutcomeOptions(outcomeKeyOrOptions) {
  if (typeof outcomeKeyOrOptions === "string") return { outcomeKey: outcomeKeyOrOptions };
  return outcomeKeyOrOptions && typeof outcomeKeyOrOptions === "object" ? outcomeKeyOrOptions : {};
}

function hasCatastrophicRound(activeEvent) {
  return activeEvent?.rounds?.some((round) => round.outcomeKey === ARCFLIGHT_TRAVEL_ROUND_OUTCOMES.CATASTROPHIC_FAILURE) ?? false;
}

function validateFinalOutcome(outcomeKey) {
  if (!Object.values(ARCFLIGHT_TRAVEL_EVENT_OUTCOMES).includes(outcomeKey)) {
    throw new Error(`Arcflight | Unknown travel event final outcome: ${outcomeKey ?? "<missing>"}.`);
  }
}

export function getEmptyShipTravelEventState() {
  return cloneData(EMPTY_TRAVEL_EVENT_STATE);
}

export function getShipTravelEventState(shipActor) {
  assertArcflightShipActor(shipActor, "getShipTravelEventState");
  return normalizeTravelEventState(getArcflightShipData(shipActor).travel);
}

export function getActiveShipTravelEvent(shipActor) {
  return getShipTravelEventState(shipActor).activeEvent;
}

export async function startShipTravelEvent(shipActor, eventKey, options = {}) {
  assertArcflightShipActor(shipActor, "startShipTravelEvent");

  const state = getShipTravelEventState(shipActor);
  if (state.activeEvent) {
    throw new Error(`Arcflight | ${shipActor.name ?? "Ship"} already has an active travel event (${state.activeEvent.eventName}). Complete or clear it before starting another.`);
  }

  const event = getCoreTravelEvent(eventKey);
  if (!event) throw new Error(`Arcflight | Travel event not found: ${eventKey ?? "<missing>"}.`);

  const validation = validateTravelEventDefinition(event);
  if (!validation.ok) {
    throw new Error(`Arcflight | Travel event ${eventKey} is invalid: ${validation.errors.join(" ")}`);
  }

  const now = options.startedAt ?? timestamp();
  state.activeEvent = {
    eventKey: event.key,
    eventName: event.name,
    category: event.category,
    baseDC: event.baseDC ?? 0,
    currentRound: 1,
    roundCount: event.roundCount,
    startedAt: now,
    startedBy: options.startedBy ?? currentUserId(),
    status: "active",
    totals: {
      successes: 0,
      failures: 0,
      criticalFailures: 0
    },
    rounds: event.rounds.map((round) => ({
      round: round.round,
      status: round.round === 1 ? "active" : "pending",
      successes: 0,
      failures: 0,
      criticalFailures: 0,
      stationResults: [],
      outcomeKey: "",
      stagedEffects: []
    })),
    stagedFinalEffects: [],
    combatHandoff: false,
    handoffNotes: "",
    history: [
      {
        type: "started",
        at: now,
        by: options.startedBy ?? currentUserId(),
        eventKey: event.key
      }
    ]
  };

  return (await updateTravelEventState(shipActor, state)).activeEvent;
}

export function getCurrentShipTravelRound(shipActor) {
  const activeEvent = getActiveShipTravelEvent(shipActor);
  if (!activeEvent) return null;
  return getRoundState(activeEvent, activeEvent.currentRound);
}

export async function recordShipTravelStationResult(shipActor, resultData = {}) {
  assertArcflightShipActor(shipActor, "recordShipTravelStationResult");

  const state = getShipTravelEventState(shipActor);
  const activeEvent = state.activeEvent;
  if (!activeEvent) throw new Error("Arcflight | No active ship travel event is available for station result recording.");

  const stationKey = resultData.stationKey ?? "";
  if (!isTravelStationKey(stationKey)) throw new Error(`Arcflight | ${stationKey || "<missing>"} is not a Travel Five station key.`);

  const roundState = getRoundState(activeEvent, activeEvent.currentRound);
  if (!roundState) throw new Error(`Arcflight | Current travel event round ${activeEvent.currentRound} was not found.`);
  if (roundState.status === "completed") throw new Error(`Arcflight | Travel event round ${roundState.round} is already completed.`);

  const allowDuplicateStationResult = resultData.options?.allowDuplicateStationResult === true || resultData.allowDuplicateStationResult === true;
  const existingStationResult = roundState.stationResults.some((entry) => entry.stationKey === stationKey && entry.primary !== false);
  if (!allowDuplicateStationResult && existingStationResult) {
    throw new Error(`Arcflight | ${stationKey} already has a primary result for travel round ${roundState.round}.`);
  }

  const degree = normalizeTravelDegree(resultData.degreeOfSuccess ?? resultData.degree);
  if (!degree) throw new Error(`Arcflight | Unknown travel degree: ${resultData.degreeOfSuccess ?? resultData.degree ?? "<missing>"}.`);

  const contribution = getTravelDegreeContribution(degree);
  const resultRecord = {
    stationKey,
    round: roundState.round,
    actorUuid: resultData.actorUuid ?? "",
    actorId: resultData.actorId ?? "",
    actorName: resultData.actorName ?? "",
    statisticKey: resultData.statisticKey ?? "",
    degreeOfSuccess: degree,
    contribution,
    notes: resultData.notes ?? "",
    rollTotal: resultData.rollTotal ?? null,
    rollId: resultData.rollId ?? "",
    messageId: resultData.messageId ?? "",
    source: resultData.source ?? "manual",
    primary: !allowDuplicateStationResult,
    recordedAt: resultData.recordedAt ?? timestamp(),
    recordedBy: resultData.recordedBy ?? currentUserId()
  };

  roundState.stationResults.push(resultRecord);
  roundState.successes += contribution.successes;
  roundState.failures += contribution.failures;
  roundState.criticalFailures += contribution.criticalFailures;
  activeEvent.totals.successes += contribution.successes;
  activeEvent.totals.failures += contribution.failures;
  activeEvent.totals.criticalFailures += contribution.criticalFailures;
  activeEvent.history.push({
    type: "stationResultRecorded",
    at: resultRecord.recordedAt,
    by: resultRecord.recordedBy,
    round: roundState.round,
    stationKey,
    degreeOfSuccess: degree,
    contribution,
    source: resultRecord.source,
    rollTotal: resultRecord.rollTotal,
    rollId: resultRecord.rollId,
    messageId: resultRecord.messageId
  });

  await updateTravelEventState(shipActor, state);
  return cloneData(resultRecord);
}

export async function advanceShipTravelEventRound(shipActor, options = {}) {
  assertArcflightShipActor(shipActor, "advanceShipTravelEventRound");

  const state = getShipTravelEventState(shipActor);
  const activeEvent = state.activeEvent;
  if (!activeEvent) throw new Error("Arcflight | No active ship travel event is available to advance.");

  const roundState = getRoundState(activeEvent, activeEvent.currentRound);
  if (!roundState) throw new Error(`Arcflight | Current travel event round ${activeEvent.currentRound} was not found.`);

  const outcomeKey = options.outcomeKey ?? getTravelRoundOutcome(roundState);
  roundState.outcomeKey = outcomeKey;
  const branch = getRoundOutcomeBranch(activeEvent, roundState);
  roundState.stagedEffects = cloneData(branch?.proposedEffects ?? []);
  roundState.status = "completed";

  if (branch?.combatHandoff === true) activeEvent.combatHandoff = true;
  if (branch?.handoffNotes) activeEvent.handoffNotes = branch.handoffNotes;

  const isFinalRound = roundState.round >= activeEvent.roundCount;
  if (isFinalRound) {
    activeEvent.status = "awaitingCompletion";
  } else {
    activeEvent.currentRound = roundState.round + 1;
    const nextRound = getRoundState(activeEvent, activeEvent.currentRound);
    if (nextRound && nextRound.status === "pending") nextRound.status = "active";
  }

  activeEvent.history.push({
    type: "roundAdvanced",
    at: options.advancedAt ?? timestamp(),
    by: options.advancedBy ?? currentUserId(),
    round: roundState.round,
    outcomeKey,
    stagedEffects: cloneData(roundState.stagedEffects)
  });

  return (await updateTravelEventState(shipActor, state)).activeEvent;
}

export async function completeShipTravelEvent(shipActor, outcomeKeyOrOptions = {}) {
  assertArcflightShipActor(shipActor, "completeShipTravelEvent");

  const options = normalizeOutcomeOptions(outcomeKeyOrOptions);
  const state = getShipTravelEventState(shipActor);
  const activeEvent = state.activeEvent;
  if (!activeEvent) throw new Error("Arcflight | No active ship travel event is available to complete.");

  const event = getCoreTravelEvent(activeEvent.eventKey);
  const outcomeKey = options.outcomeKey ?? getTravelEventOutcome({ ...activeEvent.totals, catastrophicFailure: hasCatastrophicRound(activeEvent) });
  validateFinalOutcome(outcomeKey);

  const finalOutcome = event?.finalOutcomes?.[outcomeKey] ?? null;
  activeEvent.stagedFinalEffects = cloneData(finalOutcome?.proposedEffects ?? []);
  activeEvent.finalOutcomeKey = outcomeKey;
  activeEvent.completedAt = options.completedAt ?? timestamp();
  activeEvent.completedBy = options.completedBy ?? currentUserId();
  activeEvent.status = "completed";

  if (finalOutcome?.combatHandoff === true) activeEvent.combatHandoff = true;
  if (finalOutcome?.handoffNotes) activeEvent.handoffNotes = finalOutcome.handoffNotes;

  activeEvent.history.push({
    type: "completed",
    at: activeEvent.completedAt,
    by: activeEvent.completedBy,
    outcomeKey,
    stagedFinalEffects: cloneData(activeEvent.stagedFinalEffects)
  });

  state.completedEvents.push(cloneData(activeEvent));
  state.activeEvent = null;

  return updateTravelEventState(shipActor, state);
}

export function previewTravelStagedEffectApplication(shipActor, effect = {}) {
  assertArcflightShipActor(shipActor, "previewTravelStagedEffectApplication");

  const effectCopy = cloneData(effect ?? {});
  if (!isSupportedResourceStagedEffect(effectCopy)) {
    return {
      ok: false,
      supported: false,
      blocked: true,
      effect: effectCopy,
      before: getShipTravelResources(shipActor),
      after: getShipTravelResources(shipActor),
      changes: {},
      warnings: [`${effectCopy?.type ?? "effect"} staged effect is manual / unsupported in this MVP.`],
      messages: [`${effectCopy?.type ?? "effect"} staged effect is manual / unsupported in this MVP.`]
    };
  }

  const preview = previewShipTravelResourceChange(shipActor, getResourceEffectChanges(shipActor, effectCopy));
  return {
    ...preview,
    supported: true,
    blocked: false,
    effect: effectCopy,
    label: effectCopy.label ?? "",
    resource: effectCopy.resource,
    mode: effectCopy.mode,
    value: Number(effectCopy.value)
  };
}

export async function applyTravelStagedEffect(shipActor, effect = {}, options = {}) {
  assertArcflightShipActor(shipActor, "applyTravelStagedEffect");

  const state = getShipTravelEventState(shipActor);
  const effectRef = resolveEffectStateReference(state, effect, options);
  const stateEffect = effectRef?.effect ?? cloneData(effect ?? {});
  const preventDoubleApply = options.preventDoubleApply !== false;

  if (preventDoubleApply && stateEffect?.applied === true) {
    return {
      ok: false,
      blocked: true,
      reason: "already-applied",
      effect: cloneData(stateEffect),
      message: `${stateEffect.label ?? "Travel staged effect"} has already been applied.`
    };
  }

  const preview = previewTravelStagedEffectApplication(shipActor, stateEffect);
  if (!preview.supported) {
    return {
      ok: false,
      blocked: true,
      unsupported: true,
      skipped: true,
      reason: "unsupported",
      effect: cloneData(stateEffect),
      preview,
      message: preview.messages?.[0] ?? "Staged effect is manual / unsupported in this MVP."
    };
  }

  const appliedAt = options.appliedAt ?? timestamp();
  const appliedBy = options.appliedBy ?? currentUserId();
  const resources = await updateShipTravelResources(shipActor, preview.changes, options.resourceOptions ?? {});
  const applicationResult = {
    ok: true,
    supported: true,
    resource: stateEffect.resource,
    mode: stateEffect.mode,
    value: Number(stateEffect.value),
    before: preview.before,
    after: resources,
    changes: preview.changes,
    warnings: preview.warnings ?? []
  };

  if (effectRef?.effect) {
    effectRef.effect.applied = true;
    effectRef.effect.appliedAt = appliedAt;
    effectRef.effect.appliedBy = appliedBy;
    effectRef.effect.applicationResult = cloneData(applicationResult);

    const historyTarget = effectRef.source === "completedFinal"
      ? state.completedEvents?.[effectRef.completedEventIndex] ?? null
      : state.activeEvent ?? null;
    historyTarget?.history?.push?.({
      type: "stagedEffectApplied",
      at: appliedAt,
      by: appliedBy,
      source: effectRef.source,
      round: effectRef.round ?? null,
      effectIndex: options.effectIndex ?? null,
      resource: stateEffect.resource,
      mode: stateEffect.mode,
      value: Number(stateEffect.value),
      label: stateEffect.label ?? "",
      applicationResult: cloneData(applicationResult)
    });

    await updateTravelEventState(shipActor, state);
  }

  return {
    ok: true,
    blocked: false,
    supported: true,
    effect: cloneData(effectRef?.effect ?? stateEffect),
    applicationResult,
    resources
  };
}

export async function applyTravelStagedEffects(shipActor, effects = [], options = {}) {
  assertArcflightShipActor(shipActor, "applyTravelStagedEffects");

  const effectList = Array.isArray(effects) ? effects : [];
  const hasExplicitEffectIndex = Object.prototype.hasOwnProperty.call(options, "effectIndex");
  const results = [];
  for (const effect of effectList) {
    const effectOptions = hasExplicitEffectIndex ? { ...options, effectIndex: options.effectIndex } : { ...options };
    results.push(await applyTravelStagedEffect(shipActor, effect, effectOptions));
  }

  return {
    ok: results.every((result) => result.ok === true || (result.unsupported === true && result.skipped === true)),
    appliedCount: results.filter((result) => result.ok === true).length,
    skippedCount: results.filter((result) => result.unsupported === true && result.skipped === true).length,
    results
  };
}

export async function clearShipTravelEvent(shipActor, options = {}) {
  assertArcflightShipActor(shipActor, "clearShipTravelEvent");

  const state = getShipTravelEventState(shipActor);
  if (state.activeEvent && options.preserveHistory === true) {
    const abandonedEvent = cloneData(state.activeEvent);
    abandonedEvent.status = "abandoned";
    abandonedEvent.clearedAt = options.clearedAt ?? timestamp();
    abandonedEvent.clearedBy = options.clearedBy ?? currentUserId();
    abandonedEvent.history.push({
      type: "cleared",
      at: abandonedEvent.clearedAt,
      by: abandonedEvent.clearedBy,
      reason: options.reason ?? ""
    });
    state.completedEvents.push(abandonedEvent);
  }

  state.activeEvent = null;
  return updateTravelEventState(shipActor, state);
}
