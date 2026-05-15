import { ARCFLIGHT_MODULE_ID, ARCFLIGHT_TRAVEL_EVENT_OUTCOMES, ARCFLIGHT_TRAVEL_ROUND_OUTCOMES } from "../config/constants.js";
import { ARCFLIGHT_SHIP_ACTOR_TYPE, getArcflightShipData } from "../documents/ships.js";
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
