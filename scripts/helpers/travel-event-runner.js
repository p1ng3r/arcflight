import { getStation } from "../../data/stations/core-stations.js";
import { ARCFLIGHT_MODULE_ID, ARCFLIGHT_TRAVEL_RESOURCES, ARCFLIGHT_TRAVEL_STATIONS } from "../config/constants.js";
import { ARCFLIGHT_SHIP_ACTOR_TYPE, getShipTravelResources, previewShipTravelResourceChange, updateShipTravelResources } from "../documents/ships.js";
import { getPublishedTravelEventLibrary, loadPublishedTravelEventFromLibrary, preparePublishedTravelEventLibraryState } from "./travel-event-builder.js";
import { validateTravelEventDefinition } from "./travel-events.js";
import {
  ARCFLIGHT_TRAVEL_STATION_ACTIONS,
  ARCFLIGHT_TRAVEL_PRESSURE_TRACKS,
  createEmptyTravelPressureState,
  eventApproach,
  getPendingTravelStabilizeEffect,
  getTravelPressureIdentity,
  isTravelPressureKey,
  getTravelStationStabilizePressureKey,
  hazardResponse,
  normalizeTravelPressureState,
  normalizeTravelRoundPressureProfile,
  normalizeTravelStationAction,
  resolveTravelStabilizePressureDelta,
  stabilize,
  support
} from "./travel-pressure.js";
import { getNextTravelRoundSegment, getPreviousTravelRoundSegment, normalizeTravelRunnerRoundPhase, prepareTravelRoundSegmentState } from "./travel-round-segments.js";
import { normalizeTravelV2HazardDeckState, prepareTravelV2HazardPanelState, setTravelV2HazardStatus, drawTravelV2ManualHazard, revealTravelV2Hazard, prepareTravelV2ActiveHazardModifiers, applyTravelV2HazardToRound, resolveTravelV2HazardResponse, resolveTravelV2UnresolvedHazardsForRound, sanitizeTravelV2PublicHazard } from "./travel-v2-hazards.js";
import { normalizeTravelV2ShipScarsState, prepareTravelV2ShipScarsPanelState, setTravelV2ShipScarSessionStatus } from "./travel-v2-ship-scars.js";
import { prepareTravelV2RoundNarration } from "./travel-v2-narration.js";
import { prepareTravelV2RoundFinalizationState } from "./travel-v2-round-finalization-state.js";
import { inspectTravelV2StationActionLockInFinalizationGuard } from "./travel-v2-session-round-finalization.js";
import { lockTravelV2StationAction, prepareGmTravelV2StationActionLockState, preparePlayerSafeTravelV2StationActionLockState, unlockTravelV2StationAction } from "./travel-v2-station-action-lock-in.js";
import { prepareTravelV2PendingConsequenceQueue } from "./travel-v2-pending-consequence-queue.js";
import { prepareTravelV2FinalOutcomePackageReviewState, prepareTravelV2FinalOutcomeApplyState } from "./travel-v2-event-outcome-package.js";
import { buildTravelV2CompletedSummaryMarkdown, buildTravelV2CompletedSummaryHtml, buildTravelV2CompletedSummaryExportState, postTravelV2CompletedSummaryToChat, createTravelV2CompletedSummaryJournalEntry } from "./travel-v2-completed-summary-export.js";

export const TRAVEL_EVENT_RUNNER_SESSION_VERSION = 1;
export const TRAVEL_EVENT_RUNNER_SESSION_EXPORT_VERSION = 1;
export const TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING = "travelEventRunnerSessionLibrary";
export const TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_VERSION = 1;
export const TRAVEL_APPROACH_STATISTIC_DEBUG_SETTING = "debugTravelApproachStatistics";
export const TRAVEL_EVENT_RUNNER_RESULT_VALUES = Object.freeze(["criticalFailure", "failure", "success", "criticalSuccess", "skipped"]);
export const TRAVEL_EVENT_RUNNER_FINAL_OUTCOMES = Object.freeze(["criticalSuccess", "success", "mixed", "failure", "criticalFailure"]);

const TRAVEL_FIVE_STATION_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_STATIONS));
const RESULT_SCORES = Object.freeze({ criticalSuccess: 2, success: 1, skipped: 0, failure: -1, criticalFailure: -2 });
const ROUND_RESULT_LABELS = Object.freeze({
  criticalRoundSuccess: "Critical Round Success",
  roundSuccess: "Round Success",
  narrowRoundSuccess: "Narrow Round Success / Held Together",
  roundFailure: "Round Failure",
  criticalRoundFailure: "Critical Round Failure"
});
const FINAL_OUTCOME_LABELS = Object.freeze({
  criticalSuccess: "Critical Success",
  success: "Success",
  mixed: "Mixed",
  failure: "Failure",
  criticalFailure: "Critical Failure"
});

const REVIEW_RESOURCE_KEYS = Object.freeze([
  ARCFLIGHT_TRAVEL_RESOURCES.HULL,
  ARCFLIGHT_TRAVEL_RESOURCES.STRAIN,
  ARCFLIGHT_TRAVEL_RESOURCES.LIFEVEIL,
  ARCFLIGHT_TRAVEL_RESOURCES.MORALE,
  ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES
]);
const REVIEW_RESOURCE_MODES = Object.freeze(["add", "set"]);
const REVIEW_NOT_APPLIED_WARNING = "Review only. Effects have not been applied.";
const DEFAULT_STABILIZE_SKILLS = Object.freeze({
  [ARCFLIGHT_TRAVEL_STATIONS.CAPTAIN]: "diplomacy",
  [ARCFLIGHT_TRAVEL_STATIONS.NAVIGATOR]: "piloting-lore",
  [ARCFLIGHT_TRAVEL_STATIONS.ENGINEER]: "crafting",
  [ARCFLIGHT_TRAVEL_STATIONS.VEILWARDEN]: "occultism",
  [ARCFLIGHT_TRAVEL_STATIONS.WATCHMASTER]: "perception"
});
const DEFAULT_FOCUS_RISK_TEXT = "Risk: if this Focus push backfires, the GM may create a session-local backlash complication.";
const DEFAULT_FOCUS_BACKLASH_PREVIEW_TEXT = "The GM resolves any Focus consequences later. This does not automatically mutate actor, item, chat, journal, combat, or socket state.";
const DEFAULT_STATION_FOCUS_ABILITIES = Object.freeze({
  captain: Object.freeze([
    { key: "command-the-momentum", label: "Command the Momentum", timing: "End of Round / before next station roll.", effectText: "Choose one active station. That station gains advantage on its next station roll." },
    { key: "hold-the-line", label: "Hold the Line", timing: "End of Round / after consequence is revealed.", effectText: "Reduce one pressure gain, resource loss, or consequence by 1 step." },
    { key: "call-for-everything", label: "Call for Everything", timing: "Reaction after any active station fails.", effectText: "That station rerolls. If the reroll fails, add 1 Morale pressure." }
  ]),
  navigator: Object.freeze([
    { key: "hard-correction", label: "Hard Correction", timing: "Reaction after Navigator fails.", effectText: "Reroll the Navigator check. If the reroll fails, add 1 Strain pressure." },
    { key: "read-the-route", label: "Read the Route", timing: "End of Round.", effectText: "Reveal the next round’s primary pressure or most threatened station." },
    { key: "plot-the-impossible-angle", label: "Plot the Impossible Angle", timing: "End of Round / before next round.", effectText: "Choose one station next round. It gains +1 circumstance bonus to its station roll." }
  ]),
  engineer: Object.freeze([
    { key: "blow-the-safety-valves", label: "Blow the Safety Valves", timing: "Reaction after Engineer fails.", effectText: "Improve the Engineer result by one degree, then add 1 Strain pressure." },
    { key: "patch-the-strain", label: "Patch the Strain", timing: "End of Round.", effectText: "Reduce Strain by 1." },
    { key: "overdrive-the-arkengine", label: "Overdrive the Arkengine", timing: "End of Round / before next round.", effectText: "Choose one station next round. It gains +1 circumstance bonus, but if it fails add 1 Strain." }
  ]),
  veilwarden: Object.freeze([
    { key: "seal-the-breach", label: "Seal the Breach", timing: "Reaction when Lifeveil loss or occult/environmental consequence is revealed.", effectText: "Reduce the Lifeveil loss or occult consequence by 1. If the round still fails, add 1 Lifeveil." },
    { key: "steady-the-lifeveil", label: "Steady the Lifeveil", timing: "End of Round.", effectText: "Reduce Lifeveil by 1." },
    { key: "ward-against-the-churn", label: "Ward Against the Churn", timing: "Reaction to occult, mental, void, or Churn-tagged complication.", effectText: "Downgrade the complication by one step or grant one reroll against it." }
  ]),
  watchmaster: Object.freeze([
    { key: "shout-the-warning", label: "Shout the Warning", timing: "Reaction after a hidden hazard, ambush, threat, or false signal causes a station failure.", effectText: "That station rerolls. If the reroll fails, add 1 Morale pressure but reveal one hidden danger." },
    { key: "read-the-enemy", label: "Read the Enemy", timing: "End of Round.", effectText: "Reveal one hidden threat, next-round danger, or enemy intent." },
    { key: "rally-the-deck", label: "Rally the Deck", timing: "End of Round.", effectText: "Reduce Morale by 1." }
  ])
});


const MOMENTUM_RECORD_STATUSES = Object.freeze(["earned", "spent", "pending", "dismissed"]);
const MOMENTUM_SOURCE_LABELS = Object.freeze({ stationCritical: "Station Critical", hazardClearCritical: "Hazard Clear Critical", failureDowngrade: "Failure Downgrade", manual: "Manual" });
const MOMENTUM_DOWNGRADE_MAP = Object.freeze({ criticalFailure: "failure", failure: "success" });

export function normalizeTravelV2MomentumState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const rawRecords = [...(Array.isArray(source.records) ? source.records : []), ...(Array.isArray(source.pendingRecords) ? source.pendingRecords : [])];
  const records = rawRecords.filter(isPlainObject).map((record, index) => {
    const status = MOMENTUM_RECORD_STATUSES.includes(record.status) ? record.status : (Number(record.amount) < 0 ? "spent" : "earned");
    const amount = Number.isFinite(Number(record.amount)) ? Number(record.amount) : 0;
    return {
      id: typeof record.id === "string" && record.id ? record.id : `momentum-${index + 1}`,
      roundIndex: Number.isInteger(Number(record.roundIndex)) ? Number(record.roundIndex) : null,
      stationKey: typeof record.stationKey === "string" ? record.stationKey : "",
      source: typeof record.source === "string" ? record.source : "manual",
      sourceLabel: MOMENTUM_SOURCE_LABELS[record.source] ?? humanizeIdentifier(record.source || "manual"),
      amount,
      status,
      publicSummary: typeof record.publicSummary === "string" ? record.publicSummary : "",
      gmNote: typeof record.gmNote === "string" ? record.gmNote : "",
      createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
      resolvedAt: typeof record.resolvedAt === "string" ? record.resolvedAt : "",
      target: isPlainObject(record.target) ? cloneData(record.target) : {}
    };
  });
  const activeRecords = records.filter((record) => record.status !== "dismissed");
  const earnedTotal = Number.isFinite(Number(source.earnedTotal)) ? Math.max(0, Number(source.earnedTotal)) : activeRecords.filter((record) => record.amount > 0 && record.status === "earned").reduce((sum, record) => sum + record.amount, 0);
  const spentTotal = Number.isFinite(Number(source.spentTotal)) ? Math.max(0, Number(source.spentTotal)) : Math.abs(activeRecords.filter((record) => record.amount < 0 && record.status === "spent").reduce((sum, record) => sum + record.amount, 0));
  const valueFromRecords = Math.max(0, earnedTotal - spentTotal);
  const value = Number.isFinite(Number(source.value)) ? Math.max(0, Number(source.value)) : valueFromRecords;
  return { version: 1, value, earnedTotal, spentTotal, records, pendingRecords: records.filter((record) => record.status === "pending") };
}

function momentumRecordId(parts = []) { return parts.map((part) => String(part ?? "").replace(/[^a-zA-Z0-9_-]+/g, "-")).filter(Boolean).join(":"); }

export function sanitizeTravelV2MomentumForPlayers(value = {}) {
  const state = normalizeTravelV2MomentumState(value);
  return { value: state.value, earnedTotal: state.earnedTotal, spentTotal: state.spentTotal, records: state.records.map(({ gmNote, target, ...record }) => ({ ...record, target: undefined })).slice(-5), helpText: "Momentum is earned from decisive Travel v2 play and can be spent by the GM to help the crew fight back against event pressure." };
}

export function prepareTravelV2MomentumPanelState(session = {}) {
  const state = normalizeTravelV2MomentumState(session?.travelV2Momentum);
  const roundIndex = Number.isInteger(Number(session?.currentRoundIndex)) ? Number(session.currentRoundIndex) : 0;
  const roundResult = session?.roundResults?.[roundIndex] ?? {};
  const round = session?.event?.rounds?.[roundIndex] ?? {};
  const spendOptions = Object.entries(roundResult.stationResults ?? {})
    .filter(([stationKey, result]) => {
      const action = normalizeTravelStationAction(roundResult.stationActions?.[stationKey], stationKey, round);
      return action.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.EVENT_APPROACH && Object.hasOwn(MOMENTUM_DOWNGRADE_MAP, result);
    })
    .map(([stationKey, result]) => ({ type: "downgradeFailure", stationKey, roundIndex, fromResult: result, toResult: MOMENTUM_DOWNGRADE_MAP[result], label: `Spend 1: ${humanizeIdentifier(stationKey)} ${humanizeIdentifier(result)} → ${humanizeIdentifier(MOMENTUM_DOWNGRADE_MAP[result])}`, disabled: state.value < 1 }));
  return { ...state, hasMomentum: state.value > 0, recentRecords: state.records.slice(-5).reverse(), hasRecords: state.records.length > 0, spendOptions, hasSpendOptions: spendOptions.length > 0, publicHelpText: "Earn Momentum on critical Travel v2 plays. Spend it to downgrade a station failure in the local session before final pressure is settled." };
}

export function awardTravelV2Momentum(session, recordData = {}, options = {}) {
  const state = normalizeTravelV2MomentumState(session?.travelV2Momentum);
  const amount = Math.max(1, Number.isFinite(Number(recordData.amount)) ? Number(recordData.amount) : 1);
  const id = typeof recordData.id === "string" && recordData.id ? recordData.id : momentumRecordId(["momentum", recordData.source ?? "award", recordData.roundIndex ?? session?.currentRoundIndex ?? 0, recordData.stationKey ?? "party"]);
  if (state.records.some((record) => record.id === id && record.status !== "dismissed")) return { ok: true, duplicate: true, errors: [], warnings: [], session: { ...cloneData(session), travelV2Momentum: state }, record: state.records.find((record) => record.id === id) };
  const record = { id, roundIndex: Number.isInteger(Number(recordData.roundIndex)) ? Number(recordData.roundIndex) : (Number.isInteger(Number(session?.currentRoundIndex)) ? Number(session.currentRoundIndex) : null), stationKey: typeof recordData.stationKey === "string" ? recordData.stationKey : "", source: typeof recordData.source === "string" ? recordData.source : "manual", sourceLabel: MOMENTUM_SOURCE_LABELS[recordData.source] ?? humanizeIdentifier(recordData.source || "manual"), amount, status: recordData.status === "pending" ? "pending" : "earned", publicSummary: typeof recordData.publicSummary === "string" ? recordData.publicSummary : `The crew gains ${amount} Momentum.`, gmNote: typeof recordData.gmNote === "string" ? recordData.gmNote : "", createdAt: nowIso(options), resolvedAt: recordData.status === "pending" ? "" : nowIso(options), target: isPlainObject(recordData.target) ? cloneData(recordData.target) : {} };
  const nextState = normalizeTravelV2MomentumState({ ...state, value: state.value + amount, earnedTotal: state.earnedTotal + amount, records: [...state.records, record] });
  return { ok: true, duplicate: false, errors: [], warnings: [], session: { ...cloneData(session), travelV2Momentum: nextState, updatedAt: nowIso(options), summary: null }, record };
}

export function spendTravelV2Momentum(session, spendData = {}, options = {}) {
  const state = normalizeTravelV2MomentumState(session?.travelV2Momentum);
  const amount = Math.max(1, Number.isFinite(Number(spendData.amount)) ? Number(spendData.amount) : 1);
  if (state.value < amount) return { ok: false, errors: ["Not enough Momentum."], warnings: [], session: cloneData(session) };
  const id = typeof spendData.id === "string" && spendData.id ? spendData.id : momentumRecordId(["momentum-spend", spendData.source ?? "spend", spendData.roundIndex ?? session?.currentRoundIndex ?? 0, spendData.stationKey ?? "party", state.records.length + 1]);
  const record = { id, roundIndex: Number.isInteger(Number(spendData.roundIndex)) ? Number(spendData.roundIndex) : (Number.isInteger(Number(session?.currentRoundIndex)) ? Number(session.currentRoundIndex) : null), stationKey: typeof spendData.stationKey === "string" ? spendData.stationKey : "", source: typeof spendData.source === "string" ? spendData.source : "manual", sourceLabel: MOMENTUM_SOURCE_LABELS[spendData.source] ?? humanizeIdentifier(spendData.source || "manual"), amount: -amount, status: "spent", publicSummary: typeof spendData.publicSummary === "string" ? spendData.publicSummary : `The crew spends ${amount} Momentum.`, gmNote: typeof spendData.gmNote === "string" ? spendData.gmNote : "", createdAt: nowIso(options), resolvedAt: nowIso(options), target: isPlainObject(spendData.target) ? cloneData(spendData.target) : {} };
  const nextState = normalizeTravelV2MomentumState({ ...state, value: state.value - amount, spentTotal: state.spentTotal + amount, records: [...state.records, record] });
  return { ok: true, errors: [], warnings: [], session: { ...cloneData(session), travelV2Momentum: nextState, updatedAt: nowIso(options), summary: null }, record };
}

function syncTravelV2MomentumAwardsForStationResult(session, roundIndex, stationKey, options = {}) {
  const action = normalizeTravelStationAction(session?.roundResults?.[roundIndex]?.stationActions?.[stationKey], stationKey, session?.event?.rounds?.[roundIndex]);
  const result = session?.roundResults?.[roundIndex]?.stationResults?.[stationKey];
  if (result !== "criticalSuccess") return { ok: true, errors: [], warnings: [], session };
  if (action.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.EVENT_APPROACH) {
    return awardTravelV2Momentum(session, { id: momentumRecordId(["momentum", "station-critical", roundIndex, stationKey]), roundIndex, stationKey, source: "stationCritical", amount: 1, publicSummary: `${humanizeIdentifier(stationKey)} turns a critical success into +1 Momentum.`, gmNote: "Awarded for critical success on a main objective station action.", target: { result } }, options);
  }
  if (action.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.HAZARD_RESPONSE && action.hazardRecordId) {
    const hazard = session?.travelV2Hazards?.records?.find?.((record) => record.id === action.hazardRecordId);
    if (hazard?.status === "cleared") return awardTravelV2Momentum(session, { id: momentumRecordId(["momentum", "hazard-clear-critical", roundIndex, stationKey, action.hazardRecordId]), roundIndex, stationKey, source: "hazardClearCritical", amount: 1, publicSummary: `${humanizeIdentifier(stationKey)} clears ${hazard.name ?? "a hazard"} with a critical success for +1 Momentum.`, gmNote: "Awarded for a critical hazard response that cleared an active hazard.", target: { hazardRecordId: action.hazardRecordId, result } }, options);
  }
  return { ok: true, errors: [], warnings: [], session };
}

export function spendTravelV2MomentumToDowngradeStationFailure(session, roundIndex, stationKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const index = Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : normalized.session.currentRoundIndex;
  const round = normalized.session.event?.rounds?.[index] ?? {};
  const roundResult = normalized.session.roundResults?.[index] ?? {};
  const action = normalizeTravelStationAction(roundResult.stationActions?.[stationKey], stationKey, round);
  if (action.type !== ARCFLIGHT_TRAVEL_STATION_ACTIONS.EVENT_APPROACH) return { ok: false, errors: ["Momentum failure downgrade currently only supports main objective station actions."], warnings: [], session: normalized.session };
  const result = roundResult.stationResults?.[stationKey];
  const nextResult = MOMENTUM_DOWNGRADE_MAP[result];
  if (!nextResult) return { ok: false, errors: ["Momentum can only downgrade failure or critical failure results."], warnings: [], session: normalized.session };
  const spend = spendTravelV2Momentum(normalized.session, { id: momentumRecordId(["momentum-spend", "downgrade", index, stationKey, result, nextResult]), roundIndex: index, stationKey, source: "failureDowngrade", amount: 1, publicSummary: `${humanizeIdentifier(stationKey)} spends Momentum to shift ${humanizeIdentifier(result)} to ${humanizeIdentifier(nextResult)}.`, gmNote: `Session-local audit: ${stationKey} result changed from ${result} to ${nextResult}. No actor/item/chat/journal/combat mutation.`, target: { fromResult: result, toResult: nextResult } }, options);
  if (!spend.ok) return spend;
  const nextSession = cloneData(spend.session);
  nextSession.roundResults[index].stationResults[stationKey] = nextResult;
  nextSession.updatedAt = nowIso(options);
  nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession, record: spend.record, fromResult: result, toResult: nextResult };
}

export function getDefaultStationFocusAbilities(stationKey, options = {}) {
  const configured = options.stationFocusAbilities?.[stationKey];
  return cloneData(Array.isArray(configured) ? configured : (DEFAULT_STATION_FOCUS_ABILITIES[stationKey] ?? []));
}

export function createTravelStationFocusState(stationKey, options = {}) {
  const configured = isPlainObject(options.stationFocus?.[stationKey]) ? options.stationFocus[stationKey] : {};
  const capacity = Math.max(0, Number.isFinite(Number(configured.focusCapacity ?? options.focusCapacity)) ? Number(configured.focusCapacity ?? options.focusCapacity) : 1);
  return {
    focusCapacity: capacity,
    focusRemaining: Math.min(capacity, Math.max(0, Number.isFinite(Number(configured.focusRemaining)) ? Number(configured.focusRemaining) : capacity)),
    usedAbilityKeys: [],
    roundSpent: {},
    selectedFocusAbility: ""
  };
}

export function normalizeTravelStationFocusState(value, stationKey, options = {}) {
  const source = isPlainObject(value) ? value : {};
  const fallback = createTravelStationFocusState(stationKey, options);
  const capacity = Math.max(0, Number.isFinite(Number(source.focusCapacity)) ? Number(source.focusCapacity) : fallback.focusCapacity);
  return {
    focusCapacity: capacity,
    focusRemaining: Math.min(capacity, Math.max(0, Number.isFinite(Number(source.focusRemaining)) ? Number(source.focusRemaining) : capacity)),
    usedAbilityKeys: Array.from(new Set((Array.isArray(source.usedAbilityKeys) ? source.usedAbilityKeys : []).filter((key) => typeof key === "string" && getDefaultStationFocusAbilities(stationKey, options).some((ability) => ability.key === key)))),
    roundSpent: Object.fromEntries(Object.entries(isPlainObject(source.roundSpent) ? source.roundSpent : {}).filter(([roundIndex, abilityKey]) => /^\d+$/.test(roundIndex) && typeof abilityKey === "string")),
    selectedFocusAbility: typeof source.selectedFocusAbility === "string" ? source.selectedFocusAbility : ""
  };
}

export function normalizeTravelEventRunnerStationFocus(value, roundOrSession = null, options = {}) {
  const source = isPlainObject(value) ? value : {};
  const rounds = Array.isArray(roundOrSession?.event?.rounds) ? roundOrSession.event.rounds : (Array.isArray(roundOrSession?.rounds) ? roundOrSession.rounds : [roundOrSession]);
  const stationKeys = Array.from(new Set(rounds.flatMap((round) => Array.isArray(round?.activeStations) ? round.activeStations : []).filter((key) => TRAVEL_FIVE_STATION_KEYS.includes(key))));
  return Object.fromEntries(stationKeys.map((stationKey) => [stationKey, normalizeTravelStationFocusState(source[stationKey], stationKey, options)]));
}

export function sanitizeTravelStationFocusOption(ability = {}, context = {}) {
  const key = typeof ability.key === "string" && ability.key ? ability.key : (typeof ability.value === "string" ? ability.value : "");
  const label = typeof ability.label === "string" && ability.label ? ability.label : humanizeIdentifier(key);
  const whatItHelps = typeof ability.whatItHelps === "string" && ability.whatItHelps
    ? ability.whatItHelps
    : [ability.timing, ability.effectText].filter((part) => typeof part === "string" && part.trim()).join(" ");
  const publicRiskText = typeof ability.publicRiskText === "string" && ability.publicRiskText ? ability.publicRiskText : DEFAULT_FOCUS_RISK_TEXT;
  const publicBacklashPreviewText = typeof ability.publicBacklashPreviewText === "string" && ability.publicBacklashPreviewText ? ability.publicBacklashPreviewText : DEFAULT_FOCUS_BACKLASH_PREVIEW_TEXT;
  const unavailable = context.used === true || context.spentThisRound === true || context.noFocusRemaining === true || context.blocked === true;
  return {
    key,
    value: key,
    label,
    whatItHelps,
    description: whatItHelps,
    publicRiskText,
    publicBacklashPreviewText,
    available: !unavailable,
    blocked: context.blocked === true,
    blockedReason: typeof context.blockedReason === "string" ? context.blockedReason : "",
    stationKey: typeof context.stationKey === "string" ? context.stationKey : "",
    roundIndex: Number.isInteger(Number(context.roundIndex)) ? Number(context.roundIndex) : 0,
    used: context.used === true,
    unavailable,
    availabilityLabel: context.used === true ? "Used this event." : (context.spentThisRound === true ? "Focus already spent this round." : (context.noFocusRemaining === true ? "No Focus remaining." : (context.blocked === true ? "Blocked by an active hazard." : "")))
  };
}

export function prepareTravelStationFocusState(session, stationKey, roundIndex, options = {}) {
  const state = normalizeTravelStationFocusState(session?.stationFocus?.[stationKey], stationKey, options);
  const abilities = getDefaultStationFocusAbilities(stationKey, options);
  const spentThisRound = typeof state.roundSpent[String(roundIndex)] === "string";
  return {
    ...state,
    spentThisRound,
    focusOptions: abilities.map((ability) => {
      const used = state.usedAbilityKeys.includes(ability.key);
      return sanitizeTravelStationFocusOption(ability, { stationKey, roundIndex, used, spentThisRound, noFocusRemaining: state.focusRemaining <= 0 });
    })
  };
}

export function commitTravelEventRunnerStationFocus(session, roundIndex, stationKey, abilityKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const index = Number(roundIndex);
  if (!normalized.session.event.rounds[index]?.activeStations?.includes(stationKey)) return { ok: false, errors: [`Station "${stationKey}" is not active in round ${index + 1}.`], warnings: [], session: normalized.session };
  const ability = getDefaultStationFocusAbilities(stationKey, options).find((entry) => entry.key === abilityKey);
  const focus = prepareTravelStationFocusState(normalized.session, stationKey, index, options);
  if (!ability) return { ok: false, errors: [`Focus ability "${abilityKey}" is not available for ${stationKey}.`], warnings: [], session: normalized.session };
  if (focus.focusRemaining <= 0) return { ok: false, errors: [`${stationKey} has no Focus remaining.`], warnings: [], session: normalized.session };
  if (focus.usedAbilityKeys.includes(abilityKey)) return { ok: false, errors: [`${ability.label} was already used this event.`], warnings: [], session: normalized.session };
  if (focus.spentThisRound) return { ok: false, errors: [`${stationKey} already spent Focus in round ${index + 1}.`], warnings: [], session: normalized.session };
  const nextSession = cloneData(normalized.session);
  nextSession.stationFocus[stationKey] = {
    focusCapacity: focus.focusCapacity,
    focusRemaining: focus.focusRemaining - 1,
    usedAbilityKeys: [...focus.usedAbilityKeys, abilityKey],
    roundSpent: { ...focus.roundSpent, [String(index)]: abilityKey },
    selectedFocusAbility: abilityKey
  };
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function clearTravelEventRunnerStationFocusSelection(session, roundIndex, stationKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  nextSession.stationFocus[stationKey] = normalizeTravelStationFocusState(nextSession.stationFocus[stationKey], stationKey, options);
  nextSession.stationFocus[stationKey].selectedFocusAbility = "";
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function normalizeTravelFocusEffectRecords(value = {}, options = {}) {
  const source = isPlainObject(value) ? value : {};
  const records = (Array.isArray(source.records) ? source.records : []).filter(isPlainObject).map((record) => ({
    focusEffectId: typeof record.focusEffectId === "string" ? record.focusEffectId : "",
    roundIndex: Math.max(0, Number.isInteger(Number(record.roundIndex)) ? Number(record.roundIndex) : 0),
    stationKey: typeof record.stationKey === "string" ? record.stationKey : "",
    stationName: typeof record.stationName === "string" ? record.stationName : "",
    abilityKey: typeof record.abilityKey === "string" ? record.abilityKey : "",
    abilityLabel: typeof record.abilityLabel === "string" ? record.abilityLabel : "",
    timing: typeof record.timing === "string" ? record.timing : "",
    effectText: typeof record.effectText === "string" ? record.effectText : "",
    selectedActionLabel: typeof record.selectedActionLabel === "string" ? record.selectedActionLabel : "",
    assignedActorName: typeof record.assignedActorName === "string" ? record.assignedActorName : "",
    status: ["pending", "applied", "dismissed"].includes(record.status) ? record.status : "pending",
    createdAt: typeof record.createdAt === "string" ? record.createdAt : nowIso(options),
    resolvedAt: typeof record.resolvedAt === "string" ? record.resolvedAt : "",
    resolvedByUserId: typeof record.resolvedByUserId === "string" ? record.resolvedByUserId : "",
    resolvedByUserName: typeof record.resolvedByUserName === "string" ? record.resolvedByUserName : "",
    resolutionNote: typeof record.resolutionNote === "string" ? record.resolutionNote.trim().slice(0, 500) : ""
  })).filter((record) => record.focusEffectId && record.stationKey && record.abilityKey);
  return { records: Array.from(new Map(records.map((record) => [record.focusEffectId, record])).values()) };
}

export function buildTravelFocusEffectRecord(session, roundIndex, stationKey, abilityKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return null;
  const index = Number(roundIndex);
  const ability = getDefaultStationFocusAbilities(stationKey, options).find((entry) => entry.key === abilityKey);
  const round = normalized.session.event.rounds[index];
  const roundResult = normalized.session.roundResults[index];
  if (!ability || !round || !roundResult) return null;
  const station = prepareStationRows(normalized.session, round, roundResult, options).find((row) => row.stationKey === stationKey);
  return {
    focusEffectId: `round-${index}-${stationKey}-${abilityKey}`,
    roundIndex: index,
    stationKey,
    stationName: station?.stationName || humanizeIdentifier(stationKey),
    abilityKey,
    abilityLabel: ability.label,
    timing: ability.timing,
    effectText: ability.effectText,
    selectedActionLabel: station?.selectedActionLabel || "Station Order",
    assignedActorName: station?.assignedActorName || "",
    status: "pending",
    createdAt: nowIso(options),
    resolvedAt: "",
    resolvedByUserId: "",
    resolvedByUserName: "",
    resolutionNote: ""
  };
}

export function syncTravelFocusEffectRecordsForStationOrder(session, roundIndex, stationKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  const commitment = nextSession.roundResults[Number(roundIndex)]?.stationOrderCommitments?.[stationKey];
  const records = normalizeTravelFocusEffectRecords(nextSession.focusEffectRecords, options).records;
  for (const record of records.filter((entry) => entry.roundIndex === Number(roundIndex) && entry.stationKey === stationKey && entry.status === "pending")) {
    if (!commitment?.committed || record.abilityKey !== commitment.selectedFocusAbility) {
      record.status = "dismissed";
      record.resolvedAt = nowIso(options);
    }
  }
  if (commitment?.committed && commitment.selectedFocusAbility) {
    const record = buildTravelFocusEffectRecord(nextSession, roundIndex, stationKey, commitment.selectedFocusAbility, options);
    if (record && !records.some((entry) => entry.focusEffectId === record.focusEffectId)) records.push(record);
  }
  nextSession.focusEffectRecords = { records };
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function prepareTravelFocusEffectReviewState(session, options = {}) {
  const records = normalizeTravelFocusEffectRecords(session?.focusEffectRecords, options).records.map((record) => ({
    ...record,
    statusLabel: humanizeIdentifier(record.status),
    isPending: record.status === "pending",
    hasResolutionNote: Boolean(record.resolutionNote)
  }));
  return { records, hasRecords: records.length > 0, pendingCount: records.filter((record) => record.status === "pending").length };
}

function resolveTravelFocusEffect(session, focusEffectId, status, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  const record = nextSession.focusEffectRecords.records.find((entry) => entry.focusEffectId === focusEffectId);
  if (!record) return { ok: false, errors: [`Focus effect "${focusEffectId}" was not found.`], warnings: [], session: nextSession };
  record.status = status;
  record.resolvedAt = nowIso(options);
  record.resolvedByUserId = options.userId ?? globalThis.game?.user?.id ?? "";
  record.resolvedByUserName = options.userName ?? globalThis.game?.user?.name ?? "";
  nextSession.updatedAt = nowIso(options);
  nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function markTravelFocusEffectApplied(session, focusEffectId, options = {}) {
  return resolveTravelFocusEffect(session, focusEffectId, "applied", options);
}

export function dismissTravelFocusEffect(session, focusEffectId, options = {}) {
  return resolveTravelFocusEffect(session, focusEffectId, "dismissed", options);
}

export function updateTravelFocusEffectNote(session, focusEffectId, note, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  const record = nextSession.focusEffectRecords.records.find((entry) => entry.focusEffectId === focusEffectId);
  if (!record) return { ok: false, errors: [`Focus effect "${focusEffectId}" was not found.`], warnings: [], session: nextSession };
  record.resolutionNote = typeof note === "string" ? note.trim().slice(0, 500) : "";
  nextSession.updatedAt = nowIso(options);
  nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

const FOCUS_BACKLASH_STATUSES = Object.freeze(["pending", "applied", "dismissed"]);
const FOCUS_BACKLASH_STATUS_LABELS = Object.freeze({ pending: "Pending risk", applied: "Applied", dismissed: "Dismissed" });

function focusBacklashRecordId(roundIndex, stationKey, focusKey) { return ["focus-backlash", roundIndex, stationKey, focusKey].map((part) => String(part ?? "").replace(/[^a-zA-Z0-9_-]+/g, "-")).join(":"); }
function focusBacklashRecordsMatch(record, roundIndex, stationKey, focusKey) { return Number(record?.roundIndex) === Number(roundIndex) && record?.stationKey === stationKey && record?.focusKey === focusKey; }
function nextFocusBacklashRecordId(records = [], baseId = "") {
  if (!records.some((record) => record.id === baseId)) return baseId;
  let suffix = 2;
  while (records.some((record) => record.id === `${baseId}:${suffix}`)) suffix += 1;
  return `${baseId}:${suffix}`;
}

export function normalizeTravelV2FocusBacklashRecords(recordsOrState = {}, options = {}) {
  const rawRecords = Array.isArray(recordsOrState) ? recordsOrState : (Array.isArray(recordsOrState?.records) ? recordsOrState.records : []);
  const records = rawRecords.filter(isPlainObject).map((record, index) => ({
    id: typeof record.id === "string" && record.id ? record.id : `focus-backlash:${index + 1}`,
    roundIndex: Number.isInteger(Number(record.roundIndex)) ? Number(record.roundIndex) : null,
    stationKey: typeof record.stationKey === "string" ? record.stationKey : "",
    stationName: typeof record.stationName === "string" ? record.stationName : "",
    focusKey: typeof record.focusKey === "string" ? record.focusKey : (typeof record.abilityKey === "string" ? record.abilityKey : ""),
    focusLabel: typeof record.focusLabel === "string" ? record.focusLabel : (typeof record.abilityLabel === "string" ? record.abilityLabel : ""),
    actorId: typeof record.actorId === "string" ? record.actorId : "",
    actorName: typeof record.actorName === "string" ? record.actorName : (typeof record.assignedActorName === "string" ? record.assignedActorName : ""),
    publicSummary: typeof record.publicSummary === "string" ? record.publicSummary : "",
    publicRiskText: typeof record.publicRiskText === "string" ? record.publicRiskText : "",
    publicBacklashPreviewText: typeof record.publicBacklashPreviewText === "string" ? record.publicBacklashPreviewText : "",
    pressureKey: isTravelPressureKey(record.pressureKey) ? record.pressureKey : "",
    pressureLabel: typeof record.pressureLabel === "string" ? record.pressureLabel : (isTravelPressureKey(record.pressureKey) ? humanizeIdentifier(record.pressureKey) : ""),
    pressureDelta: Number.isFinite(Number(record.pressureDelta)) ? Math.max(0, Math.trunc(Number(record.pressureDelta))) : 0,
    consequenceCandidate: typeof record.consequenceCandidate === "string" ? record.consequenceCandidate : "",
    gmNote: typeof record.gmNote === "string" ? record.gmNote : "",
    status: FOCUS_BACKLASH_STATUSES.includes(record.status) ? record.status : "pending",
    createdAt: typeof record.createdAt === "string" ? record.createdAt : nowIso(options),
    resolvedAt: typeof record.resolvedAt === "string" ? record.resolvedAt : "",
    resolvedByUserId: typeof record.resolvedByUserId === "string" ? record.resolvedByUserId : "",
    resolvedByUserName: typeof record.resolvedByUserName === "string" ? record.resolvedByUserName : "",
    resolutionNote: typeof record.resolutionNote === "string" ? record.resolutionNote.trim().slice(0, 500) : "",
    pressureBefore: Number.isFinite(Number(record.pressureBefore)) ? Number(record.pressureBefore) : null,
    pressureAfter: Number.isFinite(Number(record.pressureAfter)) ? Number(record.pressureAfter) : null
  })).filter((record) => record.id && record.stationKey && record.focusKey);
  return { records: Array.from(new Map(records.map((record) => [record.id, record])).values()) };
}

export function prepareTravelV2FocusBacklashPanelState(session, options = {}) {
  const records = normalizeTravelV2FocusBacklashRecords(session?.travelV2FocusBacklashRecords, options).records.map((record) => ({
    ...record, statusLabel: FOCUS_BACKLASH_STATUS_LABELS[record.status] ?? humanizeIdentifier(record.status), isPending: record.status === "pending", isApplied: record.status === "applied", isDismissed: record.status === "dismissed", hasPressure: record.pressureDelta > 0 && Boolean(record.pressureKey), hasConsequenceCandidate: Boolean(record.consequenceCandidate)
  }));
  return { records, pendingRecords: records.filter((record) => record.isPending), recentRecords: records.slice(-5).reverse(), hasRecords: records.length > 0, pendingCount: records.filter((record) => record.isPending).length };
}

export function sanitizeTravelV2FocusBacklashForPlayers(recordsOrState = {}, options = {}) {
  const records = normalizeTravelV2FocusBacklashRecords(recordsOrState, options).records.map((record) => ({
    id: record.id, roundIndex: record.roundIndex, stationKey: record.stationKey, stationName: record.stationName, focusKey: record.focusKey, focusLabel: record.focusLabel, actorName: record.actorName, publicSummary: record.publicSummary, publicRiskText: record.publicRiskText, publicBacklashPreviewText: record.publicBacklashPreviewText, status: record.status, statusLabel: FOCUS_BACKLASH_STATUS_LABELS[record.status] ?? humanizeIdentifier(record.status)
  }));
  return { records, pendingRecords: records.filter((record) => record.status === "pending"), recentRecords: records.slice(-5).reverse(), hasRecords: records.length > 0, pendingCount: records.filter((record) => record.status === "pending").length };
}

export function createTravelV2FocusBacklashRecord(session, roundIndex, stationKey, focusKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const index = Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : normalized.session.currentRoundIndex;
  const result = options.result ?? normalized.session.roundResults?.[index]?.stationResults?.[stationKey];
  if (!options.force && !["failure", "criticalFailure"].includes(result)) return { ok: true, errors: [], warnings: [], session: normalized.session, record: null, skipped: true };
  const spentFocusKey = focusKey || normalized.session.stationFocus?.[stationKey]?.roundSpent?.[String(index)] || normalized.session.stationFocus?.[stationKey]?.selectedFocusAbility || "";
  if (!spentFocusKey) return { ok: true, errors: [], warnings: [], session: normalized.session, record: null, skipped: true };
  const baseId = typeof options.id === "string" && options.id ? options.id : focusBacklashRecordId(index, stationKey, spentFocusKey);
  const records = normalizeTravelV2FocusBacklashRecords(normalized.session.travelV2FocusBacklashRecords, options).records;
  const existing = records.find((record) => record.status !== "dismissed" && (record.id === baseId || focusBacklashRecordsMatch(record, index, stationKey, spentFocusKey)));
  if (existing) return { ok: true, duplicate: true, errors: [], warnings: [], session: { ...cloneData(normalized.session), travelV2FocusBacklashRecords: { records } }, record: existing };
  const id = nextFocusBacklashRecordId(records, baseId);
  const ability = getDefaultStationFocusAbilities(stationKey, options).find((entry) => entry.key === spentFocusKey) ?? {};
  const round = normalized.session.event?.rounds?.[index] ?? {};
  const action = normalizeTravelStationAction(normalized.session.roundResults?.[index]?.stationActions?.[stationKey], stationKey, round);
  const pressureKey = isTravelPressureKey(options.pressureKey) ? options.pressureKey : (action.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.STABILIZE ? action.stabilizePressureKey : (isTravelPressureKey(round.primaryPressure) ? round.primaryPressure : ARCFLIGHT_TRAVEL_PRESSURE_TRACKS.STRAIN));
  const pressure = getTravelPressureIdentity(pressureKey);
  const assignment = normalized.session.stationAssignments?.[stationKey] ?? {};
  const pressureDelta = Number.isFinite(Number(options.pressureDelta)) ? Math.max(0, Math.trunc(Number(options.pressureDelta))) : (result === "criticalFailure" ? 2 : 1);
  // Conservative Part 2 mapping: failed Focus-backed results create pending session-local pressure/consequence candidates only after the roll resolves.
  const record = { id, roundIndex: index, stationKey, stationName: getStation(stationKey)?.displayName || getStation(stationKey)?.name || humanizeIdentifier(stationKey), focusKey: spentFocusKey, focusLabel: ability.label || humanizeIdentifier(spentFocusKey), actorId: assignment.actorId || "", actorName: assignment.actorName || "", publicSummary: typeof options.publicSummary === "string" ? options.publicSummary : `${humanizeIdentifier(stationKey)}’s Focus risk is pending GM review.`, publicRiskText: typeof options.publicRiskText === "string" ? options.publicRiskText : "Focus backlash is a GM-controlled consequence candidate.", publicBacklashPreviewText: typeof options.publicBacklashPreviewText === "string" ? options.publicBacklashPreviewText : `Pending risk: +${pressureDelta} ${pressure?.label || humanizeIdentifier(pressureKey)} pressure candidate.`, pressureKey, pressureLabel: pressure?.label || humanizeIdentifier(pressureKey), pressureDelta, consequenceCandidate: typeof options.consequenceCandidate === "string" ? options.consequenceCandidate : (result === "criticalFailure" ? "Critical Focus backlash consequence candidate; keep session-local unless the GM later converts it manually." : ""), gmNote: typeof options.gmNote === "string" ? options.gmNote : "GM-controlled Focus consequence candidate. The GM chooses Apply or Dismiss; no automatic actor/item/chat/journal/combat/socket/scene/token mutation.", status: "pending", createdAt: nowIso(options), resolvedAt: "", resolvedByUserId: "", resolvedByUserName: "", resolutionNote: "", pressureBefore: null, pressureAfter: null };
  records.push(record);
  const nextSession = { ...cloneData(normalized.session), travelV2FocusBacklashRecords: { records }, updatedAt: nowIso(options), summary: null };
  return { ok: true, duplicate: false, errors: [], warnings: [], session: nextSession, record };
}

export function syncTravelV2FocusBacklashRecordsForStationResult(session, roundIndex, stationKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const index = Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : normalized.session.currentRoundIndex;
  const focusKey = normalized.session.stationFocus?.[stationKey]?.roundSpent?.[String(index)] || normalized.session.stationFocus?.[stationKey]?.selectedFocusAbility || "";
  if (!focusKey) return { ok: true, errors: [], warnings: [], session: normalized.session };
  const result = normalized.session.roundResults?.[index]?.stationResults?.[stationKey] ?? null;
  if (["failure", "criticalFailure"].includes(result)) return createTravelV2FocusBacklashRecord(normalized.session, index, stationKey, focusKey, options);
  const records = normalizeTravelV2FocusBacklashRecords(normalized.session.travelV2FocusBacklashRecords, options).records;
  const baseId = focusBacklashRecordId(index, stationKey, focusKey);
  let changed = false;
  for (const record of records) {
    if (record.status !== "pending") continue;
    if (record.id !== baseId && !focusBacklashRecordsMatch(record, index, stationKey, focusKey)) continue;
    record.status = "dismissed";
    record.resolvedAt = nowIso(options);
    record.resolvedByUserId = options.userId ?? globalThis.game?.user?.id ?? "";
    record.resolvedByUserName = options.userName ?? globalThis.game?.user?.name ?? "";
    record.resolutionNote = options.cleared === true
      ? "Station result was cleared before the Focus backlash was resolved."
      : "Original Focus backlash trigger result changed before the backlash was resolved.";
    changed = true;
  }
  if (!changed) return { ok: true, errors: [], warnings: [], session: { ...cloneData(normalized.session), travelV2FocusBacklashRecords: { records } } };
  return { ok: true, errors: [], warnings: [], session: { ...cloneData(normalized.session), travelV2FocusBacklashRecords: { records }, updatedAt: nowIso(options), summary: null } };
}

export function applyTravelV2FocusBacklash(session, recordId, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  const record = nextSession.travelV2FocusBacklashRecords.records.find((entry) => entry.id === recordId);
  if (!record) return { ok: false, errors: [`Focus backlash "${recordId}" was not found.`], warnings: [], session: nextSession };
  if (record.status !== "pending") return { ok: false, errors: [`Focus backlash "${recordId}" is already ${record.status}.`], warnings: [], session: nextSession };
  const before = Number(nextSession.pressure?.[record.pressureKey] ?? 0);
  nextSession.pressure = normalizeTravelPressureState({ ...nextSession.pressure, [record.pressureKey]: before + record.pressureDelta });
  record.status = "applied"; record.resolvedAt = nowIso(options); record.resolvedByUserId = options.userId ?? globalThis.game?.user?.id ?? ""; record.resolvedByUserName = options.userName ?? globalThis.game?.user?.name ?? ""; record.pressureBefore = before; record.pressureAfter = nextSession.pressure[record.pressureKey];
  nextSession.travelV2PressureApplications = { records: [...(Array.isArray(nextSession.travelV2PressureApplications?.records) ? nextSession.travelV2PressureApplications.records : []), { id: `${record.id}:application`, source: "focusBacklash", recordId: record.id, pressureKey: record.pressureKey, pressureDelta: record.pressureDelta, createdAt: record.resolvedAt }] };
  nextSession.updatedAt = nowIso(options); nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession, record };
}

export function dismissTravelV2FocusBacklash(session, recordId, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  const record = nextSession.travelV2FocusBacklashRecords.records.find((entry) => entry.id === recordId);
  if (!record) return { ok: false, errors: [`Focus backlash "${recordId}" was not found.`], warnings: [], session: nextSession };
  if (record.status !== "pending") return { ok: false, errors: [`Focus backlash "${recordId}" is already ${record.status}.`], warnings: [], session: nextSession };
  record.status = "dismissed"; record.resolvedAt = nowIso(options); record.resolvedByUserId = options.userId ?? globalThis.game?.user?.id ?? ""; record.resolvedByUserName = options.userName ?? globalThis.game?.user?.name ?? ""; record.resolutionNote = typeof options.note === "string" ? options.note.trim().slice(0, 500) : record.resolutionNote;
  nextSession.updatedAt = nowIso(options); nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession, record };
}

const SUPPORT_RECORD_STATUSES = Object.freeze(["pending", "used", "dismissed"]);
const SUPPORT_RECORD_STATUS_LABELS = Object.freeze({ pending: "Pending assist", used: "Used", dismissed: "Dismissed" });

export function formatTravelV2SupportAssistPublicText(record = {}) {
  const supporting = record.supportingStationName || humanizeIdentifier(record.supportingStationKey || "supporting station");
  const target = record.targetStationName || humanizeIdentifier(record.targetStationKey || "target station");
  const assistValue = Math.max(0, Math.trunc(Number(record.assistValue) || 0));
  if (record.status === "used") return `${target} used ${supporting}’s assist.`;
  if (record.status === "dismissed") return `${supporting}’s assist was dismissed.`;
  if (assistValue >= 2) return `${supporting} gives ${target} a strong opening. Pending assist: +${assistValue}.`;
  return `${supporting} is helping ${target}. Pending assist: +${assistValue}.`;
}

function supportAssistRecordId(roundIndex, supportingStationKey, targetStationKey) { return ["support-assist", roundIndex, supportingStationKey, targetStationKey].map((part) => String(part ?? "").replace(/[^a-zA-Z0-9_-]+/g, "-")).join(":"); }
function supportAssistRecordsMatch(record, roundIndex, supportingStationKey, targetStationKey) { return Number(record?.roundIndex) === Number(roundIndex) && record?.supportingStationKey === supportingStationKey && record?.targetStationKey === targetStationKey; }
function nextSupportAssistRecordId(records = [], baseId = "") {
  if (!records.some((record) => record.id === baseId)) return baseId;
  let suffix = 2;
  while (records.some((record) => record.id === `${baseId}:${suffix}`)) suffix += 1;
  return `${baseId}:${suffix}`;
}

export function normalizeTravelV2SupportRecords(recordsOrState = {}, options = {}) {
  const rawRecords = Array.isArray(recordsOrState) ? recordsOrState : (Array.isArray(recordsOrState?.records) ? recordsOrState.records : []);
  const records = rawRecords.filter(isPlainObject).map((record, index) => {
    const normalized = {
      id: typeof record.id === "string" && record.id ? record.id : `support-assist:${index + 1}`,
      roundIndex: Number.isInteger(Number(record.roundIndex)) ? Number(record.roundIndex) : null,
      supportingStationKey: typeof record.supportingStationKey === "string" ? record.supportingStationKey : "",
      supportingStationName: typeof record.supportingStationName === "string" ? record.supportingStationName : "",
      targetStationKey: typeof record.targetStationKey === "string" ? record.targetStationKey : "",
      targetStationName: typeof record.targetStationName === "string" ? record.targetStationName : "",
      supportKey: typeof record.supportKey === "string" ? record.supportKey : (typeof record.supportMode === "string" ? record.supportMode : ""),
      supportMode: typeof record.supportMode === "string" ? record.supportMode : (typeof record.supportKey === "string" ? record.supportKey : ""),
      publicSummary: typeof record.publicSummary === "string" ? record.publicSummary : "",
      publicAssistText: typeof record.publicAssistText === "string" ? record.publicAssistText : "",
      assistValue: Number.isFinite(Number(record.assistValue)) ? Math.max(0, Math.trunc(Number(record.assistValue))) : 0,
      gmNote: typeof record.gmNote === "string" ? record.gmNote : "",
      status: SUPPORT_RECORD_STATUSES.includes(record.status) ? record.status : "pending",
      createdAt: typeof record.createdAt === "string" ? record.createdAt : nowIso(options),
      resolvedAt: typeof record.resolvedAt === "string" ? record.resolvedAt : "",
      resolvedByUserId: typeof record.resolvedByUserId === "string" ? record.resolvedByUserId : "",
      resolvedByUserName: typeof record.resolvedByUserName === "string" ? record.resolvedByUserName : "",
      resolutionNote: typeof record.resolutionNote === "string" ? record.resolutionNote.trim().slice(0, 500) : ""
    };
    normalized.statusLabel = SUPPORT_RECORD_STATUS_LABELS[normalized.status] ?? humanizeIdentifier(normalized.status);
    if (!normalized.publicAssistText) normalized.publicAssistText = formatTravelV2SupportAssistPublicText(normalized);
    if (!normalized.publicSummary) normalized.publicSummary = `${normalized.supportingStationName || humanizeIdentifier(normalized.supportingStationKey)} supports ${normalized.targetStationName || humanizeIdentifier(normalized.targetStationKey)} with a +${normalized.assistValue} assist.`;
    return normalized;
  }).filter((record) => record.id && record.supportingStationKey && record.targetStationKey);
  return { records: Array.from(new Map(records.map((record) => [record.id, record])).values()) };
}

export function prepareTravelV2SupportPanelState(session, options = {}) {
  const records = normalizeTravelV2SupportRecords(session?.travelV2SupportRecords, options).records.map((record) => ({
    ...record,
    statusLabel: record.statusLabel,
    isPending: record.status === "pending",
    isUsed: record.status === "used",
    isDismissed: record.status === "dismissed"
  }));
  return { records, pendingRecords: records.filter((record) => record.isPending), recentRecords: records.slice(-5).reverse(), hasRecords: records.length > 0, pendingCount: records.filter((record) => record.isPending).length };
}

export function sanitizeTravelV2SupportForPlayers(recordsOrState = {}, options = {}) {
  const records = normalizeTravelV2SupportRecords(recordsOrState, options).records.map((record) => ({
    id: record.id,
    roundIndex: record.roundIndex,
    supportingStationKey: record.supportingStationKey,
    supportingStationName: record.supportingStationName,
    targetStationKey: record.targetStationKey,
    targetStationName: record.targetStationName,
    publicSummary: record.publicSummary,
    publicAssistText: formatTravelV2SupportAssistPublicText(record),
    assistValue: record.assistValue,
    status: record.status,
    statusLabel: record.statusLabel
  }));
  return { records, pendingRecords: records.filter((record) => record.status === "pending"), recentRecords: records.slice(-5).reverse(), hasRecords: records.length > 0, pendingCount: records.filter((record) => record.status === "pending").length };
}

export function createTravelV2SupportRecord(session, roundIndex, supportingStationKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const index = Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : normalized.session.currentRoundIndex;
  const round = normalized.session.event?.rounds?.[index] ?? {};
  const action = normalizeTravelStationAction(normalized.session.roundResults?.[index]?.stationActions?.[supportingStationKey], supportingStationKey, round);
  const result = options.result ?? normalized.session.roundResults?.[index]?.stationResults?.[supportingStationKey];
  if (action.type !== ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT || !action.targetStationKey || !["success", "criticalSuccess"].includes(result)) return { ok: true, errors: [], warnings: [], session: normalized.session, record: null, skipped: true };
  const baseId = typeof options.id === "string" && options.id ? options.id : supportAssistRecordId(index, supportingStationKey, action.targetStationKey);
  const records = normalizeTravelV2SupportRecords(normalized.session.travelV2SupportRecords, options).records;
  const existing = records.find((record) => record.status !== "dismissed" && (record.id === baseId || supportAssistRecordsMatch(record, index, supportingStationKey, action.targetStationKey)));
  if (existing) return { ok: true, duplicate: true, errors: [], warnings: [], session: { ...cloneData(normalized.session), travelV2SupportRecords: { records } }, record: existing };
  const supportingStationName = getStation(supportingStationKey)?.displayName || getStation(supportingStationKey)?.name || humanizeIdentifier(supportingStationKey);
  const targetStationName = getStation(action.targetStationKey)?.displayName || getStation(action.targetStationKey)?.name || humanizeIdentifier(action.targetStationKey);
  const assistValue = result === "criticalSuccess" ? 2 : 1;
  const record = {
    id: nextSupportAssistRecordId(records, baseId),
    roundIndex: index,
    supportingStationKey,
    supportingStationName,
    targetStationKey: action.targetStationKey,
    targetStationName,
    supportKey: action.supportKey || "support",
    supportMode: action.supportKey || "support",
    publicSummary: typeof options.publicSummary === "string" ? options.publicSummary : `${supportingStationName} supports ${targetStationName} with a +${assistValue} assist.`,
    publicAssistText: typeof options.publicAssistText === "string" ? options.publicAssistText : "",
    assistValue,
    gmNote: typeof options.gmNote === "string" ? options.gmNote : "Session-local Support assist, not an automatic roll mutation. The GM chooses Use or Dismiss; no actor/item/chat/journal/combat/socket/scene/token mutation.",
    status: "pending",
    createdAt: nowIso(options),
    resolvedAt: "",
    resolvedByUserId: "",
    resolvedByUserName: "",
    resolutionNote: ""
  };
  record.statusLabel = SUPPORT_RECORD_STATUS_LABELS[record.status];
  record.publicAssistText = record.publicAssistText || formatTravelV2SupportAssistPublicText(record);
  records.push(record);
  return { ok: true, duplicate: false, errors: [], warnings: [], session: { ...cloneData(normalized.session), travelV2SupportRecords: { records }, updatedAt: nowIso(options), summary: null }, record };
}

export function syncTravelV2SupportRecordsForStationResult(session, roundIndex, supportingStationKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const index = Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : normalized.session.currentRoundIndex;
  const round = normalized.session.event?.rounds?.[index] ?? {};
  const action = normalizeTravelStationAction(normalized.session.roundResults?.[index]?.stationActions?.[supportingStationKey], supportingStationKey, round);
  if (action.type !== ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT || !action.targetStationKey) return { ok: true, errors: [], warnings: [], session: normalized.session };
  const result = normalized.session.roundResults?.[index]?.stationResults?.[supportingStationKey] ?? null;
  if (["success", "criticalSuccess"].includes(result)) return createTravelV2SupportRecord(normalized.session, index, supportingStationKey, options);
  const records = normalizeTravelV2SupportRecords(normalized.session.travelV2SupportRecords, options).records;
  let changed = false;
  for (const record of records) {
    if (record.status !== "pending" || !supportAssistRecordsMatch(record, index, supportingStationKey, action.targetStationKey)) continue;
    record.status = "dismissed";
    record.resolvedAt = nowIso(options);
    record.resolvedByUserId = options.userId ?? globalThis.game?.user?.id ?? "";
    record.resolvedByUserName = options.userName ?? globalThis.game?.user?.name ?? "";
    record.resolutionNote = options.cleared === true
      ? "Station result was cleared before the Support assist was used."
      : "Original Support assist trigger result changed before the assist was used.";
    changed = true;
  }
  if (!changed) return { ok: true, errors: [], warnings: [], session: { ...cloneData(normalized.session), travelV2SupportRecords: { records } } };
  return { ok: true, errors: [], warnings: [], session: { ...cloneData(normalized.session), travelV2SupportRecords: { records }, updatedAt: nowIso(options), summary: null } };
}

function resolveTravelV2SupportRecord(session, recordId, status, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  const record = nextSession.travelV2SupportRecords.records.find((entry) => entry.id === recordId);
  if (!record) return { ok: false, errors: [`Support assist "${recordId}" was not found.`], warnings: [], session: nextSession };
  if (record.status !== "pending") return { ok: false, errors: [`Support assist "${recordId}" is already ${record.status}.`], warnings: [], session: nextSession };
  record.status = status;
  record.resolvedAt = nowIso(options);
  record.resolvedByUserId = options.userId ?? globalThis.game?.user?.id ?? "";
  record.resolvedByUserName = options.userName ?? globalThis.game?.user?.name ?? "";
  record.resolutionNote = typeof options.note === "string" ? options.note.trim().slice(0, 500) : record.resolutionNote;
  nextSession.updatedAt = nowIso(options);
  nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession, record };
}

export function useTravelV2SupportRecord(session, recordId, options = {}) {
  return resolveTravelV2SupportRecord(session, recordId, "used", options);
}

export function dismissTravelV2SupportRecord(session, recordId, options = {}) {
  return resolveTravelV2SupportRecord(session, recordId, "dismissed", options);
}

const SUPPORT_BACKLASH_RECORD_STATUSES = Object.freeze(["pending", "applied", "dismissed"]);
const SUPPORT_BACKLASH_STATUS_LABELS = Object.freeze({ pending: "Pending backlash", applied: "Applied", dismissed: "Dismissed" });

function supportBacklashRecordId(roundIndex, supportingStationKey, targetStationKey, sourceResult) { return ["support-backlash", roundIndex, supportingStationKey, targetStationKey, sourceResult].map((part) => String(part ?? "").replace(/[^a-zA-Z0-9_-]+/g, "-")).join(":"); }
function supportBacklashRecordsMatch(record, roundIndex, supportingStationKey, targetStationKey, sourceResult) { return Number(record?.roundIndex) === Number(roundIndex) && record?.supportingStationKey === supportingStationKey && record?.targetStationKey === targetStationKey && record?.sourceResult === sourceResult; }

export function formatTravelV2SupportBacklashPublicText(record = {}) {
  const supporting = record.supportingStationName || humanizeIdentifier(record.supportingStationKey || "supporting station");
  const target = record.targetStationName || humanizeIdentifier(record.targetStationKey || "target station");
  if (record.status === "applied") return `The GM marked ${supporting}’s Support backlash as applied; any actual consequence remains manually handled.`;
  if (record.status === "dismissed") return `${supporting}’s Support backlash was dismissed.`;
  if (record.sourceResult === "criticalFailure" || record.severity === "major") return `${supporting}’s Support for ${target} backfires, creating a major backlash candidate.`;
  return `${supporting}’s Support for ${target} falters, creating a minor complication candidate.`;
}

export function normalizeTravelV2SupportBacklashRecords(recordsOrState = {}, options = {}) {
  const rawRecords = Array.isArray(recordsOrState) ? recordsOrState : (Array.isArray(recordsOrState?.records) ? recordsOrState.records : []);
  const records = rawRecords.filter(isPlainObject).map((record, index) => {
    const sourceResult = record.sourceResult === "criticalFailure" ? "criticalFailure" : "failure";
    const severity = record.severity === "major" || sourceResult === "criticalFailure" ? "major" : "minor";
    const normalized = {
      id: typeof record.id === "string" && record.id ? record.id : `support-backlash:${index + 1}`,
      roundIndex: Number.isInteger(Number(record.roundIndex)) ? Number(record.roundIndex) : null,
      supportingStationKey: typeof record.supportingStationKey === "string" ? record.supportingStationKey : "",
      supportingStationName: typeof record.supportingStationName === "string" ? record.supportingStationName : "",
      targetStationKey: typeof record.targetStationKey === "string" ? record.targetStationKey : "",
      targetStationName: typeof record.targetStationName === "string" ? record.targetStationName : "",
      severity,
      sourceResult,
      publicSummary: typeof record.publicSummary === "string" ? record.publicSummary : "",
      publicRiskText: typeof record.publicRiskText === "string" ? record.publicRiskText : "",
      gmNote: typeof record.gmNote === "string" ? record.gmNote : "",
      status: SUPPORT_BACKLASH_RECORD_STATUSES.includes(record.status) ? record.status : "pending",
      createdAt: typeof record.createdAt === "string" ? record.createdAt : nowIso(options),
      resolvedAt: typeof record.resolvedAt === "string" ? record.resolvedAt : "",
      resolvedByUserId: typeof record.resolvedByUserId === "string" ? record.resolvedByUserId : "",
      resolvedByUserName: typeof record.resolvedByUserName === "string" ? record.resolvedByUserName : "",
      resolutionNote: typeof record.resolutionNote === "string" ? record.resolutionNote.trim().slice(0, 500) : ""
    };
    normalized.statusLabel = SUPPORT_BACKLASH_STATUS_LABELS[normalized.status] ?? humanizeIdentifier(normalized.status);
    if (!normalized.publicRiskText) normalized.publicRiskText = formatTravelV2SupportBacklashPublicText(normalized);
    if (!normalized.publicSummary) normalized.publicSummary = normalized.publicRiskText;
    if (!normalized.gmNote) normalized.gmNote = normalized.sourceResult === "criticalFailure"
      ? "GM-controlled failed-Support consequence candidate. The GM chooses Apply or Dismiss; no automatic pressure, damage, condition, roll, actor/item/chat/journal/combat/socket/scene/token mutation."
      : "GM-controlled failed-Support consequence candidate. The GM chooses Apply or Dismiss; no automatic pressure, damage, condition, roll, actor/item/chat/journal/combat/socket/scene/token mutation.";
    return normalized;
  }).filter((record) => record.id && record.supportingStationKey && record.targetStationKey);
  return { records: Array.from(new Map(records.map((record) => [record.id, record])).values()) };
}

export function prepareTravelV2SupportBacklashPanelState(session, options = {}) {
  const records = normalizeTravelV2SupportBacklashRecords(session?.travelV2SupportBacklashRecords, options).records.map((record) => ({ ...record, isPending: record.status === "pending", isApplied: record.status === "applied", isDismissed: record.status === "dismissed" }));
  return { records, pendingRecords: records.filter((record) => record.isPending), recentRecords: records.slice(-5).reverse(), hasRecords: records.length > 0, pendingCount: records.filter((record) => record.isPending).length };
}

export function sanitizeTravelV2SupportBacklashForPlayers(recordsOrState = {}, options = {}) {
  const records = normalizeTravelV2SupportBacklashRecords(recordsOrState, options).records.map((record) => ({ id: record.id, roundIndex: record.roundIndex, supportingStationKey: record.supportingStationKey, supportingStationName: record.supportingStationName, targetStationKey: record.targetStationKey, targetStationName: record.targetStationName, severity: record.severity, sourceResult: record.sourceResult, status: record.status, statusLabel: record.statusLabel, publicSummary: record.publicSummary, publicRiskText: formatTravelV2SupportBacklashPublicText(record) }));
  return { records, pendingRecords: records.filter((record) => record.status === "pending"), recentRecords: records.slice(-5).reverse(), hasRecords: records.length > 0, pendingCount: records.filter((record) => record.status === "pending").length };
}

export function createTravelV2SupportBacklashRecord(session, roundIndex, supportingStationKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const index = Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : normalized.session.currentRoundIndex;
  const round = normalized.session.event?.rounds?.[index] ?? {};
  const action = normalizeTravelStationAction(normalized.session.roundResults?.[index]?.stationActions?.[supportingStationKey], supportingStationKey, round);
  const result = options.result ?? normalized.session.roundResults?.[index]?.stationResults?.[supportingStationKey];
  if (action.type !== ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT || !action.targetStationKey || !["failure", "criticalFailure"].includes(result)) return { ok: true, errors: [], warnings: [], session: normalized.session, record: null, skipped: true };
  const baseId = supportBacklashRecordId(index, supportingStationKey, action.targetStationKey, result);
  const records = normalizeTravelV2SupportBacklashRecords(normalized.session.travelV2SupportBacklashRecords, options).records;
  for (let i = records.length - 1; i >= 0; i -= 1) {
    const record = records[i];
    if (record.status === "pending" && Number(record.roundIndex) === Number(index) && record.supportingStationKey === supportingStationKey && (record.targetStationKey !== action.targetStationKey || record.sourceResult !== result)) records.splice(i, 1);
  }
  const existing = records.find((record) => record.status === "pending" && (record.id === baseId || supportBacklashRecordsMatch(record, index, supportingStationKey, action.targetStationKey, result)));
  if (existing) return { ok: true, duplicate: true, errors: [], warnings: [], session: { ...cloneData(normalized.session), travelV2SupportBacklashRecords: { records } }, record: existing };
  const supportingStationName = getStation(supportingStationKey)?.displayName || getStation(supportingStationKey)?.name || humanizeIdentifier(supportingStationKey);
  const targetStationName = getStation(action.targetStationKey)?.displayName || getStation(action.targetStationKey)?.name || humanizeIdentifier(action.targetStationKey);
  const severity = result === "criticalFailure" ? "major" : "minor";
  const record = { id: baseId, roundIndex: index, supportingStationKey, supportingStationName, targetStationKey: action.targetStationKey, targetStationName, severity, sourceResult: result, publicSummary: "", publicRiskText: "", gmNote: "", status: "pending", createdAt: nowIso(options), resolvedAt: "", resolvedByUserId: "", resolvedByUserName: "", resolutionNote: "" };
  record.statusLabel = SUPPORT_BACKLASH_STATUS_LABELS[record.status];
  record.publicRiskText = formatTravelV2SupportBacklashPublicText(record);
  record.publicSummary = record.publicRiskText;
  record.gmNote = result === "criticalFailure" ? "GM-controlled failed-Support consequence candidate. The GM chooses Apply or Dismiss; no automatic pressure, damage, condition, roll, actor/item/chat/journal/combat/socket/scene/token mutation." : "GM-controlled failed-Support consequence candidate. The GM chooses Apply or Dismiss; no automatic pressure, damage, condition, roll, actor/item/chat/journal/combat/socket/scene/token mutation.";
  records.push(record);
  return { ok: true, duplicate: false, errors: [], warnings: [], session: { ...cloneData(normalized.session), travelV2SupportBacklashRecords: { records }, updatedAt: nowIso(options), summary: null }, record };
}

export function syncTravelV2SupportBacklashRecordsForStationResult(session, roundIndex, supportingStationKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const index = Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : normalized.session.currentRoundIndex;
  const round = normalized.session.event?.rounds?.[index] ?? {};
  const action = normalizeTravelStationAction(normalized.session.roundResults?.[index]?.stationActions?.[supportingStationKey], supportingStationKey, round);
  const result = normalized.session.roundResults?.[index]?.stationResults?.[supportingStationKey] ?? null;
  if (action.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT && action.targetStationKey && ["failure", "criticalFailure"].includes(result)) return createTravelV2SupportBacklashRecord(normalized.session, index, supportingStationKey, options);
  const records = normalizeTravelV2SupportBacklashRecords(normalized.session.travelV2SupportBacklashRecords, options).records;
  let changed = false;
  for (let i = records.length - 1; i >= 0; i -= 1) {
    const record = records[i];
    if (record.status !== "pending" || Number(record.roundIndex) !== Number(index) || record.supportingStationKey !== supportingStationKey) continue;
    if (action.type !== ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT || !action.targetStationKey || !["failure", "criticalFailure"].includes(result) || record.targetStationKey !== action.targetStationKey || record.sourceResult !== result) {
      records.splice(i, 1);
      changed = true;
    }
  }
  if (!changed) return { ok: true, errors: [], warnings: [], session: { ...cloneData(normalized.session), travelV2SupportBacklashRecords: { records } } };
  return { ok: true, errors: [], warnings: [], session: { ...cloneData(normalized.session), travelV2SupportBacklashRecords: { records }, updatedAt: nowIso(options), summary: null } };
}

function resolveTravelV2SupportBacklashRecord(session, recordId, status, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  const record = nextSession.travelV2SupportBacklashRecords.records.find((entry) => entry.id === recordId);
  if (!record) return { ok: false, errors: [`Support backlash "${recordId}" was not found.`], warnings: [], session: nextSession };
  if (record.status !== "pending") return { ok: false, errors: [`Support backlash "${recordId}" is already ${record.status}.`], warnings: [], session: nextSession };
  record.status = status; record.statusLabel = SUPPORT_BACKLASH_STATUS_LABELS[status]; record.resolvedAt = nowIso(options); record.resolvedByUserId = options.userId ?? globalThis.game?.user?.id ?? ""; record.resolvedByUserName = options.userName ?? globalThis.game?.user?.name ?? ""; record.resolutionNote = typeof options.note === "string" ? options.note.trim().slice(0, 500) : record.resolutionNote;
  nextSession.updatedAt = nowIso(options); nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession, record };
}

export function applyTravelV2SupportBacklashRecord(session, recordId, options = {}) { return resolveTravelV2SupportBacklashRecord(session, recordId, "applied", options); }
export function dismissTravelV2SupportBacklashRecord(session, recordId, options = {}) { return resolveTravelV2SupportBacklashRecord(session, recordId, "dismissed", options); }


export const TRAVEL_REACTION_DEFINITIONS = Object.freeze({
  "navigator.hard-correction": Object.freeze({
    stationKey: "navigator",
    abilityKey: "hard-correction",
    trigger: "navigatorFailure",
    promptTitle: "Hard Correction Available",
    promptText: "The route slips wrong beneath your hands — a false star, a bad angle, a current in the void that should not be there. You can burn your station Focus to wrench the ship back into line.",
    choiceText: "Spend 1 Focus to attempt Hard Correction?",
    effectText: "You may reroll the Navigator check. If the reroll also fails, the ship gains +1 Strain.",
    consequencePressureKey: "strain",
    consequencePressureLabel: "Strain",
    consequenceAmount: 1
  })
});

function travelReactionDefinitionKey(stationKey, abilityKey) {
  return `${stationKey}.${abilityKey}`;
}

export function getTravelReactionDefinition(stationKey, abilityKey) {
  return TRAVEL_REACTION_DEFINITIONS[travelReactionDefinitionKey(stationKey, abilityKey)] ?? null;
}

function getTravelReactionDefinitionsForStation(stationKey) {
  return Object.values(TRAVEL_REACTION_DEFINITIONS).filter((definition) => definition.stationKey === stationKey);
}

function debugTravelReaction(message, data = {}) {
  try {
    if (globalThis.game?.settings?.get?.("arcflight", "debugTravelReactions") !== true) return;
    console.debug(`Arcflight | Travel Reaction | ${message}`, data);
  } catch (_error) {
    // Debug logging must never break travel helper flows.
  }
}

function isTravelApproachStatisticDebugEnabled(options = {}) {
  if (options.debugTravelApproachStatistics === true || options.debugTravelApproachStatisticResolution === true) return true;
  if (options.debugTravelApproachStatistics === false || options.debugTravelApproachStatisticResolution === false) return false;
  try {
    return globalThis.game?.settings?.get?.(ARCFLIGHT_MODULE_ID, TRAVEL_APPROACH_STATISTIC_DEBUG_SETTING) === true;
  } catch (_error) {
    return false;
  }
}

function debugTravelApproachStatisticResolution(options = {}, data = {}) {
  if (!isTravelApproachStatisticDebugEnabled(options)) return;
  console.debug?.("Arcflight | Travel approach statistic resolution", data);
}

export function normalizeTravelReactionPromptRecords(value = {}, options = {}) {
  const source = isPlainObject(value) ? value : {};
  const records = (Array.isArray(source.records) ? source.records : []).filter(isPlainObject).map((record) => ({
    reactionPromptId: typeof record.reactionPromptId === "string" ? record.reactionPromptId : "",
    roundIndex: Math.max(0, Number.isInteger(Number(record.roundIndex)) ? Number(record.roundIndex) : 0),
    stationKey: typeof record.stationKey === "string" ? record.stationKey : "",
    stationName: typeof record.stationName === "string" ? record.stationName : "",
    abilityKey: typeof record.abilityKey === "string" ? record.abilityKey : "",
    abilityLabel: typeof record.abilityLabel === "string" ? record.abilityLabel : "",
    trigger: typeof record.trigger === "string" ? record.trigger : "",
    triggerResult: TRAVEL_EVENT_RUNNER_RESULT_VALUES.includes(record.triggerResult) ? record.triggerResult : "",
    status: ["pending", "accepted", "dismissed", "resolved"].includes(record.status) ? record.status : "pending",
    promptTitle: typeof record.promptTitle === "string" ? record.promptTitle : "",
    promptText: typeof record.promptText === "string" ? record.promptText : "",
    choiceText: typeof record.choiceText === "string" ? record.choiceText : "",
    effectText: typeof record.effectText === "string" ? record.effectText : "",
    consequencePressureKey: typeof record.consequencePressureKey === "string" ? record.consequencePressureKey : "",
    consequencePressureLabel: typeof record.consequencePressureLabel === "string" ? record.consequencePressureLabel : "",
    consequenceAmount: Math.max(0, Math.trunc(Number(record.consequenceAmount) || 0)),
    createdAt: typeof record.createdAt === "string" ? record.createdAt : nowIso(options),
    resolvedAt: typeof record.resolvedAt === "string" ? record.resolvedAt : "",
    resolvedByUserId: typeof record.resolvedByUserId === "string" ? record.resolvedByUserId : "",
    resolvedByUserName: typeof record.resolvedByUserName === "string" ? record.resolvedByUserName : "",
    resolutionNote: typeof record.resolutionNote === "string" ? record.resolutionNote.trim().slice(0, 500) : "",
    rerollResult: TRAVEL_EVENT_RUNNER_RESULT_VALUES.includes(record.rerollResult) ? record.rerollResult : "",
    backlashStatus: ["none", "pending", "applied", "dismissed"].includes(record.backlashStatus) ? record.backlashStatus : "none"
  })).filter((record) => record.reactionPromptId && record.stationKey && record.abilityKey);
  return { records: Array.from(new Map(records.map((record) => [record.reactionPromptId, record])).values()) };
}

export function buildTravelReactionPromptRecord(session, roundIndex, stationKey, abilityKey, trigger, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return null;
  const index = Number(roundIndex);
  const result = normalized.session.roundResults[index]?.stationResults?.[stationKey];
  const definition = getTravelReactionDefinition(stationKey, abilityKey);
  debugTravelReaction("Build reaction prompt candidate.", {
    sessionKey: normalized.session?.key ?? "",
    roundIndex: index,
    stationKey,
    abilityKey,
    trigger,
    result,
    hasDefinition: Boolean(definition)
  });
  if (!definition || trigger !== definition.trigger || !["failure", "criticalFailure"].includes(result)) return null;
  const ability = getDefaultStationFocusAbilities(stationKey, options).find((entry) => entry.key === abilityKey);
  if (!ability) return null;
  return {
    reactionPromptId: `round-${index}-${definition.stationKey}-${definition.abilityKey}`,
    roundIndex: index,
    stationKey: definition.stationKey,
    stationName: getStation(definition.stationKey)?.displayName || getStation(definition.stationKey)?.name || humanizeIdentifier(definition.stationKey),
    abilityKey: definition.abilityKey,
    abilityLabel: ability.label,
    trigger: definition.trigger,
    triggerResult: result,
    status: "pending",
    promptTitle: definition.promptTitle,
    promptText: definition.promptText,
    choiceText: definition.choiceText,
    effectText: definition.effectText,
    consequencePressureKey: definition.consequencePressureKey,
    consequencePressureLabel: definition.consequencePressureLabel,
    consequenceAmount: definition.consequenceAmount,
    createdAt: nowIso(options), resolvedAt: "", resolvedByUserId: "", resolvedByUserName: "", resolutionNote: "", rerollResult: "", backlashStatus: "none"
  };
}

export function syncTravelReactionPromptsForStationResult(session, roundIndex, stationKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  const index = Number(roundIndex);
  const records = normalizeTravelReactionPromptRecords(nextSession.reactionPrompts, options).records;
  const definitions = getTravelReactionDefinitionsForStation(stationKey);
  const hardCorrection = getTravelReactionDefinition("navigator", "hard-correction");
  const id = hardCorrection ? `round-${index}-${stationKey}-${hardCorrection.abilityKey}` : "";
  const existing = id ? records.find((record) => record.reactionPromptId === id) : null;
  debugTravelReaction("Station result reaction sync started.", {
    sessionKey: nextSession?.key ?? "",
    roundIndex: index,
    stationKey,
    definitions: definitions.map((definition) => ({ stationKey: definition.stationKey, abilityKey: definition.abilityKey, trigger: definition.trigger })),
    existing: existing ? { ...existing } : null,
    recordsBefore: records.map((record) => ({ ...record }))
  });
  if (hardCorrection && existing?.status === "accepted" && !existing.rerollResult) {
    const rerollResult = nextSession.roundResults[index]?.stationResults?.[stationKey];
    debugTravelReaction("Station result reaction sync marking reroll result.", { reactionPromptId: id, stationKey, rerollResult });
    return markTravelReactionPromptRerollResult(nextSession, id, rerollResult, options);
  }
  const focus = prepareTravelStationFocusState(nextSession, stationKey, index, options);
  const result = nextSession.roundResults[index]?.stationResults?.[stationKey];
  debugTravelReaction("Station result reaction sync eligibility.", {
    sessionKey: nextSession?.key ?? "",
    roundIndex: index,
    stationKey,
    result,
    focusRemaining: focus.focusRemaining,
    spentThisRound: focus.spentThisRound,
    usedAbilityKeys: focus.usedAbilityKeys ?? []
  });
  if (existing?.status === "pending" && !["failure", "criticalFailure"].includes(result)) {
    existing.status = "dismissed";
    existing.resolvedAt = nowIso(options);
    existing.resolutionNote = existing.resolutionNote || "Original trigger result changed before the reaction was resolved.";
  }
  for (const definition of definitions) {
    const definitionId = `round-${index}-${definition.stationKey}-${definition.abilityKey}`;
    const definitionExisting = records.find((record) => record.reactionPromptId === definitionId);
    if (definitionExisting) continue;
    if (!["failure", "criticalFailure"].includes(result)) continue;
    if (focus.focusRemaining <= 0 || focus.spentThisRound || focus.usedAbilityKeys.includes(definition.abilityKey)) continue;
    const record = buildTravelReactionPromptRecord(nextSession, index, stationKey, definition.abilityKey, definition.trigger, options);
    if (record) {
      debugTravelReaction("Station result reaction prompt created.", { reactionPromptId: record.reactionPromptId, record });
      records.push(record);
    }
  }
  nextSession.reactionPrompts = { records };
  debugTravelReaction("Station result reaction sync completed.", {
    sessionKey: nextSession?.key ?? "",
    roundIndex: index,
    stationKey,
    recordsAfter: records.map((record) => ({ ...record }))
  });
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function prepareTravelReactionPromptReviewState(session, options = {}) {
  const records = normalizeTravelReactionPromptRecords(session?.reactionPrompts, options).records.map((record) => ({
    ...record, statusLabel: humanizeIdentifier(record.status), backlashStatusLabel: humanizeIdentifier(record.backlashStatus),
    isPending: record.status === "pending", isAccepted: record.status === "accepted", rerollRequested: record.status === "accepted" && !record.rerollResult,
    hasRerollResult: Boolean(record.rerollResult), rerollResultLabel: humanizeIdentifier(record.rerollResult), backlashPending: record.backlashStatus === "pending"
  }));
  return { records, hasRecords: records.length > 0, pendingCount: records.filter((record) => record.status === "pending" || record.backlashStatus === "pending").length };
}

export function prepareTravelPlayerReactionPromptState(session, reactionPromptId, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  const record = normalized.session?.reactionPrompts?.records?.find((entry) => entry.reactionPromptId === reactionPromptId) ?? null;
  const permittedUserIds = Array.isArray(options.permittedUserIds) ? options.permittedUserIds.filter((userId) => typeof userId === "string" && userId) : [];
  const userId = typeof options.userId === "string" ? options.userId : "";
  const permitted = Boolean(record && userId && permittedUserIds.includes(userId));
  const available = Boolean(permitted && record.status === "pending");
  return {
    hasPrompt: Boolean(record),
    available,
    permitted,
    userId,
    permittedUserIds,
    sessionKey: normalized.session?.key ?? "",
    reactionPromptId: record?.reactionPromptId ?? "",
    roundIndex: record?.roundIndex ?? -1,
    stationKey: record?.stationKey ?? "",
    stationName: record?.stationName ?? "",
    abilityKey: record?.abilityKey ?? "",
    abilityLabel: record?.abilityLabel ?? "",
    status: record?.status ?? "",
    promptTitle: record?.promptTitle ?? "",
    promptText: record?.promptText ?? "",
    choiceText: record?.choiceText ?? "",
    effectText: record?.effectText ?? "",
    rerollResult: record?.rerollResult ?? "",
    backlashStatus: record?.backlashStatus ?? "",
    canAccept: available,
    canDismiss: available,
    canReopen: available
  };
}

function resolveReactionPrompt(session, reactionPromptId, mutate, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  const record = nextSession.reactionPrompts.records.find((entry) => entry.reactionPromptId === reactionPromptId);
  if (!record) return { ok: false, errors: [`Reaction prompt "${reactionPromptId}" was not found.`], warnings: [], session: nextSession };
  const error = mutate(record, nextSession);
  if (error) return { ok: false, errors: [error], warnings: [], session: nextSession };
  nextSession.updatedAt = nowIso(options); nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function acceptTravelReactionPrompt(session, reactionPromptId, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const record = normalized.session.reactionPrompts.records.find((entry) => entry.reactionPromptId === reactionPromptId);
  if (!record || record.status !== "pending") return { ok: false, errors: [`Reaction prompt "${reactionPromptId}" is not pending.`], warnings: [], session: normalized.session };
  const spent = commitTravelEventRunnerStationFocus(normalized.session, record.roundIndex, record.stationKey, record.abilityKey, options);
  if (!spent.ok) return spent;
  const nextSession = cloneData(spent.session);
  const target = nextSession.reactionPrompts.records.find((entry) => entry.reactionPromptId === reactionPromptId);
  target.status = "accepted"; target.resolvedByUserId = options.userId ?? globalThis.game?.user?.id ?? ""; target.resolvedByUserName = options.userName ?? globalThis.game?.user?.name ?? "";
  const effect = buildTravelFocusEffectRecord(nextSession, target.roundIndex, target.stationKey, target.abilityKey, options);
  const effects = normalizeTravelFocusEffectRecords(nextSession.focusEffectRecords, options).records;
  if (effect && !effects.some((entry) => entry.focusEffectId === effect.focusEffectId)) effects.push(effect);
  nextSession.focusEffectRecords = { records: effects };
  nextSession.roundResults[target.roundIndex].stationResults[target.stationKey] = null;
  nextSession.updatedAt = nowIso(options); nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function dismissTravelReactionPrompt(session, reactionPromptId, options = {}) { return resolveReactionPrompt(session, reactionPromptId, (record) => { if (record.status !== "pending") return "Reaction prompt is not pending."; record.status = "dismissed"; record.resolvedAt = nowIso(options); }, options); }
export function updateTravelReactionPromptNote(session, reactionPromptId, note, options = {}) { return resolveReactionPrompt(session, reactionPromptId, (record) => { record.resolutionNote = typeof note === "string" ? note.trim().slice(0, 500) : ""; }, options); }
export function markTravelReactionPromptRerollResult(session, reactionPromptId, result, options = {}) { return resolveReactionPrompt(session, reactionPromptId, (record) => { if (record.status !== "accepted") return "Reaction prompt has not been accepted."; if (!["criticalFailure", "failure", "success", "criticalSuccess"].includes(result)) return `Invalid reaction reroll result "${result}".`; record.rerollResult = result; record.status = ["failure", "criticalFailure"].includes(result) ? "accepted" : "resolved"; record.backlashStatus = ["failure", "criticalFailure"].includes(result) ? "pending" : "none"; if (record.status === "resolved") record.resolvedAt = nowIso(options); }, options); }
export function applyTravelReactionPromptBacklash(session, reactionPromptId, options = {}) { return resolveReactionPrompt(session, reactionPromptId, (record, nextSession) => { if (record.backlashStatus !== "pending") return "Reaction backlash is not pending."; nextSession.pressure = normalizeTravelPressureState(nextSession.pressure); nextSession.pressure[record.consequencePressureKey] = Math.min(5, nextSession.pressure[record.consequencePressureKey] + record.consequenceAmount); record.backlashStatus = "applied"; record.status = "resolved"; record.resolvedAt = nowIso(options); }, options); }
export function dismissTravelReactionPromptBacklash(session, reactionPromptId, options = {}) { return resolveReactionPrompt(session, reactionPromptId, (record) => { if (record.backlashStatus !== "pending") return "Reaction backlash is not pending."; record.backlashStatus = "dismissed"; record.status = "resolved"; record.resolvedAt = nowIso(options); }, options); }

export function normalizeTravelStabilizeResolutionRecords(value = {}, options = {}) {
  const source = isPlainObject(value) ? value : {};
  const records = (Array.isArray(source.records) ? source.records : []).filter(isPlainObject).map((record) => ({
    stabilizeResolutionId: typeof record.stabilizeResolutionId === "string" ? record.stabilizeResolutionId : "",
    roundIndex: Math.max(0, Number.isInteger(Number(record.roundIndex)) ? Number(record.roundIndex) : 0),
    stationKey: typeof record.stationKey === "string" ? record.stationKey : "",
    stationName: typeof record.stationName === "string" ? record.stationName : "",
    assignedActorName: typeof record.assignedActorName === "string" ? record.assignedActorName : "",
    result: TRAVEL_EVENT_RUNNER_RESULT_VALUES.includes(record.result) ? record.result : "",
    resultLabel: typeof record.resultLabel === "string" ? record.resultLabel : "",
    pressureKey: typeof record.pressureKey === "string" ? record.pressureKey : "",
    pressureLabel: typeof record.pressureLabel === "string" ? record.pressureLabel : "",
    reduction: Math.max(0, Math.trunc(Number(record.reduction) || 0)),
    pressureIncrease: Math.max(0, Math.trunc(Number(record.pressureIncrease) || 0)),
    pressureDelta: Number.isFinite(Number(record.pressureDelta)) ? Math.trunc(Number(record.pressureDelta)) : Math.trunc(Number(record.pressureIncrease || 0)) - Math.trunc(Number(record.reduction || 0)),
    complication: record.complication === true,
    publicSummary: typeof record.publicSummary === "string" ? record.publicSummary : "",
    gmNote: typeof record.gmNote === "string" ? record.gmNote : "",
    status: ["pending", "applied", "dismissed"].includes(record.status) ? record.status : "pending",
    createdAt: typeof record.createdAt === "string" ? record.createdAt : nowIso(options),
    resolvedAt: typeof record.resolvedAt === "string" ? record.resolvedAt : "",
    resolvedByUserId: typeof record.resolvedByUserId === "string" ? record.resolvedByUserId : "",
    resolvedByUserName: typeof record.resolvedByUserName === "string" ? record.resolvedByUserName : "",
    resolutionNote: typeof record.resolutionNote === "string" ? record.resolutionNote.trim().slice(0, 500) : "",
    pressureBefore: Number.isFinite(Number(record.pressureBefore)) ? Number(record.pressureBefore) : null,
    pressureAfter: Number.isFinite(Number(record.pressureAfter)) ? Number(record.pressureAfter) : null
  })).filter((record) => record.stabilizeResolutionId && record.stationKey && record.pressureKey && record.result);
  return { records: Array.from(new Map(records.map((record) => [record.stabilizeResolutionId, record])).values()) };
}

export function buildTravelStabilizeResolutionRecord(session, roundIndex, stationKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return null;
  const index = Number(roundIndex);
  const round = normalized.session.event.rounds[index];
  const roundResult = normalized.session.roundResults[index];
  const action = roundResult?.stationActions?.[stationKey];
  const result = roundResult?.stationResults?.[stationKey];
  if (!round || !roundResult || action?.type !== ARCFLIGHT_TRAVEL_STATION_ACTIONS.STABILIZE || !result) return null;
  const pressureKey = action.stabilizePressureKey || getTravelStationStabilizePressureKey(stationKey, round);
  const effect = resolveTravelStabilizePressureDelta(result, pressureKey);
  const pressure = getTravelPressureIdentity(pressureKey);
  const station = prepareStationRows(normalized.session, round, roundResult, options).find((row) => row.stationKey === stationKey);
  const pressureLabel = pressure?.label || humanizeIdentifier(pressureKey);
  const resultLabel = humanizeIdentifier(result);
  const publicSummary = effect.pressureDelta < 0
    ? `${station?.stationName || humanizeIdentifier(stationKey)} ${resultLabel}: ${pressureLabel} pressure reduction ${Math.abs(effect.pressureDelta)} pending GM apply.`
    : (effect.pressureDelta > 0
      ? `${station?.stationName || humanizeIdentifier(stationKey)} ${resultLabel}: ${pressureLabel} pressure increase candidate pending GM apply.`
      : `${station?.stationName || humanizeIdentifier(stationKey)} ${resultLabel}: no ${pressureLabel} pressure reduction.`);
  return {
    stabilizeResolutionId: `round-${index}-${stationKey}-${pressureKey}`,
    roundIndex: index,
    stationKey,
    stationName: station?.stationName || humanizeIdentifier(stationKey),
    assignedActorName: station?.assignedActorName || "",
    result,
    resultLabel,
    pressureKey,
    pressureLabel,
    reduction: effect?.reduction ?? 0,
    pressureIncrease: effect?.pressureIncrease ?? 0,
    pressureDelta: effect?.pressureDelta ?? 0,
    complication: effect?.complicationCandidate === true,
    publicSummary,
    gmNote: effect?.complicationCandidate ? "Critical failure creates a session-local pressure increase candidate; apply only if the GM wants that pressure reflected in session state." : "Session-local stabilize candidate; no actor, item, chat, journal, or combat mutation.",
    status: "pending",
    createdAt: nowIso(options),
    resolvedAt: "",
    resolvedByUserId: "",
    resolvedByUserName: "",
    resolutionNote: "",
    pressureBefore: null,
    pressureAfter: null
  };
}

export function syncTravelStabilizeResolutionRecordsForStationResult(session, roundIndex, stationKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  const index = Number(roundIndex);
  const candidate = buildTravelStabilizeResolutionRecord(nextSession, index, stationKey, options);
  const records = normalizeTravelStabilizeResolutionRecords(nextSession.stabilizeResolutionRecords, options).records;
  const pending = records.find((record) => record.roundIndex === index && record.stationKey === stationKey && record.status === "pending");
  if (!candidate) {
    if (pending) {
      pending.status = "dismissed";
      pending.resolvedAt = nowIso(options);
    }
  } else if (pending) {
    Object.assign(pending, candidate, {
      stabilizeResolutionId: pending.stabilizeResolutionId,
      createdAt: pending.createdAt,
      resolutionNote: pending.resolutionNote
    });
  } else {
    const duplicate = records.find((record) => record.stabilizeResolutionId === candidate.stabilizeResolutionId);
    if (!duplicate) records.push(candidate);
    else if (duplicate.status !== "pending" && duplicate.result !== candidate.result) {
      candidate.stabilizeResolutionId = `${candidate.stabilizeResolutionId}-${candidate.result}-${records.length}`;
      records.push(candidate);
    }
  }
  nextSession.stabilizeResolutionRecords = { records };
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function prepareTravelStabilizeResolutionReviewState(session, options = {}) {
  const records = normalizeTravelStabilizeResolutionRecords(session?.stabilizeResolutionRecords, options).records.map((record) => ({
    ...record,
    statusLabel: humanizeIdentifier(record.status),
    isPending: record.status === "pending",
    isApplied: record.status === "applied",
    isDismissed: record.status === "dismissed",
    pendingEffectText: record.reduction > 0
      ? `Reduce ${record.pressureLabel} by ${record.reduction}.`
      : (record.pressureIncrease > 0 ? `Add ${record.pressureIncrease} ${record.pressureLabel} pressure complication.` : "No pressure reduction.")
  }));
  return { records, hasRecords: records.length > 0, pendingCount: records.filter((record) => record.isPending).length };
}

export function prepareTravelStabilizeResolution(session, roundIndex, stationKey, options = {}) {
  return buildTravelStabilizeResolutionRecord(session, roundIndex, stationKey, options);
}

export function sanitizeTravelStabilizeResolutionForPlayers(record = {}) {
  return {
    stabilizeResolutionId: typeof record.stabilizeResolutionId === "string" ? record.stabilizeResolutionId : "",
    roundIndex: Math.max(0, Number.isInteger(Number(record.roundIndex)) ? Number(record.roundIndex) : 0),
    stationKey: typeof record.stationKey === "string" ? record.stationKey : "",
    stationName: typeof record.stationName === "string" ? record.stationName : "",
    assignedActorName: typeof record.assignedActorName === "string" ? record.assignedActorName : "",
    result: TRAVEL_EVENT_RUNNER_RESULT_VALUES.includes(record.result) ? record.result : "",
    resultLabel: typeof record.resultLabel === "string" ? record.resultLabel : "",
    pressureKey: typeof record.pressureKey === "string" ? record.pressureKey : "",
    pressureLabel: typeof record.pressureLabel === "string" ? record.pressureLabel : "",
    pressureDelta: Number.isFinite(Number(record.pressureDelta)) ? Math.trunc(Number(record.pressureDelta)) : 0,
    publicSummary: typeof record.publicSummary === "string" ? record.publicSummary : "",
    status: ["pending", "applied", "dismissed"].includes(record.status) ? record.status : "pending",
    pendingGmApply: record.status === "pending",
    applied: record.status === "applied",
    dismissed: record.status === "dismissed"
  };
}

export function applyTravelStabilizePressureDeltaToSession(session, stabilizeResolutionId, options = {}) {
  return markTravelStabilizeResolutionApplied(session, stabilizeResolutionId, options);
}

export function markTravelStabilizeResolutionApplied(session, stabilizeResolutionId, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  const record = nextSession.stabilizeResolutionRecords.records.find((entry) => entry.stabilizeResolutionId === stabilizeResolutionId);
  if (!record) return { ok: false, errors: [`Stabilize resolution "${stabilizeResolutionId}" was not found.`], warnings: [], session: nextSession };
  if (record.status !== "pending") return { ok: false, errors: [`Stabilize resolution "${stabilizeResolutionId}" is already ${record.status}.`], warnings: [], session: nextSession };
  const before = Number(nextSession.pressure[record.pressureKey] ?? 0);
  nextSession.pressure = normalizeTravelPressureState({
    ...nextSession.pressure,
    [record.pressureKey]: before - record.reduction + record.pressureIncrease
  });
  record.status = "applied";
  record.pressureBefore = before;
  record.pressureAfter = nextSession.pressure[record.pressureKey];
  record.resolvedAt = nowIso(options);
  record.resolvedByUserId = options.userId ?? globalThis.game?.user?.id ?? "";
  record.resolvedByUserName = options.userName ?? globalThis.game?.user?.name ?? "";
  nextSession.updatedAt = nowIso(options);
  nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function dismissTravelStabilizeResolution(session, stabilizeResolutionId, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  const record = nextSession.stabilizeResolutionRecords.records.find((entry) => entry.stabilizeResolutionId === stabilizeResolutionId);
  if (!record) return { ok: false, errors: [`Stabilize resolution "${stabilizeResolutionId}" was not found.`], warnings: [], session: nextSession };
  if (record.status !== "pending") return { ok: false, errors: [`Stabilize resolution "${stabilizeResolutionId}" is already ${record.status}.`], warnings: [], session: nextSession };
  record.status = "dismissed";
  record.resolvedAt = nowIso(options);
  record.resolvedByUserId = options.userId ?? globalThis.game?.user?.id ?? "";
  record.resolvedByUserName = options.userName ?? globalThis.game?.user?.name ?? "";
  nextSession.updatedAt = nowIso(options);
  nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function updateTravelStabilizeResolutionNote(session, stabilizeResolutionId, note, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  const record = nextSession.stabilizeResolutionRecords.records.find((entry) => entry.stabilizeResolutionId === stabilizeResolutionId);
  if (!record) return { ok: false, errors: [`Stabilize resolution "${stabilizeResolutionId}" was not found.`], warnings: [], session: nextSession };
  record.resolutionNote = typeof note === "string" ? note.trim().slice(0, 500) : "";
  nextSession.updatedAt = nowIso(options);
  nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

function getResourceMaxKey(resource) {
  if (resource === ARCFLIGHT_TRAVEL_RESOURCES.HULL) return "maxHull";
  if (resource === ARCFLIGHT_TRAVEL_RESOURCES.LIFEVEIL) return "maxLifeveil";
  if (resource === ARCFLIGHT_TRAVEL_RESOURCES.STRAIN) return "maxStrain";
  return "";
}

function resolveReviewResources(shipOrResources = null) {
  if (!shipOrResources || typeof shipOrResources !== "object") return null;
  if (typeof shipOrResources.getFlag === "function" || shipOrResources.type) {
    try {
      return getShipTravelResources(shipOrResources);
    } catch (_error) {
      return null;
    }
  }
  return cloneData(shipOrResources);
}

function valueDisplay(value) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function cloneData(value) {
  if (value == null) return value;
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nowIso(options = {}) {
  if (typeof options.now === "string" && options.now.length > 0) return options.now;
  if (options.now instanceof Date) return options.now.toISOString();
  return new Date().toISOString();
}

function slugifySessionKey(value) {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "travel-event-runner-session";
}

function normalizeSessionKeyValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildStableRunnerSessionKeySeed(session = {}, options = {}) {
  const event = isPlainObject(session.event) ? session.event : {};
  const ship = isPlainObject(session.ship) ? session.ship : {};
  const timestamp = normalizeSessionKeyValue(session.startedAt)
    || normalizeSessionKeyValue(session.createdAt)
    || normalizeSessionKeyValue(session.updatedAt)
    || normalizeSessionKeyValue(session.completedAt)
    || nowIso(options);
  return [
    event.key,
    event.id,
    event.name,
    ship.actorUuid,
    ship.actorId,
    ship.name,
    timestamp
  ].filter((part) => normalizeSessionKeyValue(part)).join("-");
}

function createStableRunnerSessionKey(session = {}, options = {}) {
  return slugifySessionKey(buildStableRunnerSessionKeySeed(session, options) || `travel-event-runner-session-${nowIso(options)}`);
}

function resolveTravelEventRunnerSessionKey(session = {}, options = {}) {
  return normalizeSessionKeyValue(session.key) || normalizeSessionKeyValue(session.sessionKey) || normalizeSessionKeyValue(session.id) || createStableRunnerSessionKey(session, options);
}

function humanizeIdentifier(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeStationKey(entry) {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object" && !Array.isArray(entry)) return entry.stationKey ?? entry.key ?? "";
  return "";
}

function getPromptFromRound(round, stationKey) {
  const promptFromMap = round?.stationPrompts?.[stationKey];
  if (promptFromMap && typeof promptFromMap === "object" && !Array.isArray(promptFromMap)) return { ...promptFromMap, stationKey: promptFromMap.stationKey ?? stationKey };
  const promptFromActiveStation = (round?.activeStations ?? []).find((entry) => normalizeStationKey(entry) === stationKey);
  if (promptFromActiveStation && typeof promptFromActiveStation === "object" && !Array.isArray(promptFromActiveStation)) return { ...promptFromActiveStation, stationKey };
  return { stationKey };
}

function getStationCardFromRound(round, stationKey) {
  const cardFromArray = (Array.isArray(round?.stationCards) ? round.stationCards : []).find((entry) => normalizeStationKey(entry) === stationKey);
  if (cardFromArray && typeof cardFromArray === "object" && !Array.isArray(cardFromArray)) return { ...cardFromArray, stationKey };
  const cardFromMap = round?.stationCards?.[stationKey];
  if (cardFromMap && typeof cardFromMap === "object" && !Array.isArray(cardFromMap)) return { ...cardFromMap, stationKey: cardFromMap.stationKey ?? stationKey };
  return null;
}

function createBlankRollFeedback() {
  return {
    criticalSuccess: "",
    success: "",
    failure: "",
    criticalFailure: ""
  };
}

function normalizeDegreeTextMap(value = {}, fallback = {}) {
  const source = isPlainObject(value) ? value : {};
  const fallbackSource = isPlainObject(fallback) ? fallback : {};
  return Object.fromEntries(Object.keys(createBlankRollFeedback()).map((key) => [key, typeof source[key] === "string" ? source[key] : (typeof fallbackSource[key] === "string" ? fallbackSource[key] : "")]));
}

function createEmptyStationCardHooks() {
  return {
    rooms: [],
    shipUpgrades: [],
    arkengineMods: [],
    crewAssets: [],
    factions: []
  };
}

function normalizeStationCardHooks(value = {}) {
  const source = isPlainObject(value) ? value : {};
  return {
    rooms: Array.isArray(source.rooms) ? cloneData(source.rooms) : [],
    shipUpgrades: Array.isArray(source.shipUpgrades) ? cloneData(source.shipUpgrades) : [],
    arkengineMods: Array.isArray(source.arkengineMods) ? cloneData(source.arkengineMods) : [],
    crewAssets: Array.isArray(source.crewAssets) ? cloneData(source.crewAssets) : [],
    factions: Array.isArray(source.factions) ? cloneData(source.factions) : []
  };
}


const FALLBACK_SKILL_APPROACH_COPY = Object.freeze({
  arcana: { label: "Read the arcane pattern", helpText: "Use magical theory to interpret the strange forces affecting the station problem." },
  survival: { label: "Read the environment", helpText: "Use instinct, pressure, motion, and hazard signs to find a practical way through." },
  society: { label: "Recall known routes", helpText: "Use records, customs, stories, and prior voyages to identify a known solution." },
  "sailing-lore": { label: "Apply voidsailor craft", helpText: "Use shiphandling tradition and starlane knowledge to choose a safe course." }
});

function fallbackSkillApproachCopy(skill) {
  const key = String(skill ?? "").trim().toLowerCase();
  if (FALLBACK_SKILL_APPROACH_COPY[key]) return { skill, ...FALLBACK_SKILL_APPROACH_COPY[key] };
  return {
    skill,
    label: `Apply ${humanizeIdentifier(key || skill)} method`,
    helpText: "Use this training as a practical plan to solve or bypass the station problem."
  };
}

function normalizeStationCardSkillApproaches(card = {}, prompt = {}) {
  const explicit = Array.isArray(card.skillApproaches) ? card.skillApproaches : (Array.isArray(card.approaches) ? card.approaches : (Array.isArray(prompt.skillApproaches) ? prompt.skillApproaches : (Array.isArray(prompt.approaches) ? prompt.approaches : [])));
  const approaches = explicit
    .filter(isPlainObject)
    .map((entry) => ({
      skill: typeof entry.skill === "string" ? entry.skill : "",
      label: typeof entry.label === "string" ? entry.label : (typeof entry.skill === "string" ? humanizeIdentifier(entry.skill) : ""),
      helpText: typeof entry.helpText === "string" ? entry.helpText : "",
      dc: Number.isFinite(Number(entry.dc)) ? Number(entry.dc) : null,
      boardResultFeedback: normalizeDegreeTextMap(entry.boardResultFeedback, entry.rollFeedback),
      gmNarrationFeedback: normalizeDegreeTextMap(entry.gmNarrationFeedback, entry.boardResultFeedback ?? entry.rollFeedback),
      gmOnlyConsequence: typeof entry.gmOnlyConsequence === "string" ? entry.gmOnlyConsequence : "",
      qualityWarnings: typeof entry.helpText === "string" && entry.helpText.trim().length > 0 ? [] : ["Missing structured How This Helps text; upgrade this legacy approach."]
    }))
    .filter((entry) => entry.skill || entry.label || entry.helpText);
  if (approaches.length > 0) return approaches;
  const suggestedSkills = Array.isArray(prompt.suggestedSkills) ? prompt.suggestedSkills : [];
  const fallbackFeedback = normalizeDegreeTextMap(prompt.rollFeedback);
  const fallback = suggestedSkills.slice(0, 3).map((skill) => ({
    ...fallbackSkillApproachCopy(skill),
    boardResultFeedback: fallbackFeedback,
    gmNarrationFeedback: fallbackFeedback
  }));
  if (fallback.length > 0) return fallback;
  return [{ skill: "", label: "Approach", helpText: "" }];
}

function normalizeRoundEndNarration(value = {}) {
  const source = isPlainObject(value) ? value : {};
  return Object.fromEntries(Object.keys(ROUND_RESULT_LABELS).map((key) => [key, typeof source[key] === "string" ? source[key] : ""]));
}

function normalizeStationCardForRunner(stationKey, card = null, prompt = {}) {
  const sourceCard = isPlainObject(card) ? card : {};
  const sourcePrompt = isPlainObject(prompt) ? prompt : {};
  const station = getStation(stationKey) ?? {};
  return {
    ...cloneData(sourceCard),
    stationKey,
    stationName: typeof sourceCard.stationName === "string"
      ? sourceCard.stationName
      : (typeof sourcePrompt.stationName === "string" ? sourcePrompt.stationName : (station.displayName ?? station.name ?? humanizeIdentifier(stationKey))),
    problem: typeof sourceCard.problem === "string"
      ? sourceCard.problem
      : (typeof sourcePrompt.problem === "string"
        ? sourcePrompt.problem
        : (typeof sourcePrompt.vignette === "string"
          ? sourcePrompt.vignette
          : (typeof sourcePrompt.playerAction === "string" ? sourcePrompt.playerAction : `[${stationKey} station problem]`))),
    skillApproaches: normalizeStationCardSkillApproaches(sourceCard, sourcePrompt),
    rollFeedback: {
      ...createBlankRollFeedback(),
      ...(isPlainObject(sourcePrompt.rollFeedback) ? cloneData(sourcePrompt.rollFeedback) : {}),
      ...(isPlainObject(sourceCard.visibleResultFeedback) ? cloneData(sourceCard.visibleResultFeedback) : {}),
      ...(isPlainObject(sourceCard.rollFeedback) ? cloneData(sourceCard.rollFeedback) : {})
    },
    visibleResultFeedback: normalizeDegreeTextMap(sourceCard.visibleResultFeedback),
    gmOnlyConsequence: typeof sourceCard.gmOnlyConsequence === "string" ? sourceCard.gmOnlyConsequence : "",
    hooks: sourceCard.hooks == null ? createEmptyStationCardHooks() : normalizeStationCardHooks(sourceCard.hooks),
    qualityWarnings: normalizeStationCardSkillApproaches(sourceCard, sourcePrompt).some((entry) => !entry.helpText?.trim?.()) ? ["Station card has legacy or incomplete approaches missing How This Helps text."] : []
  };
}

function normalizeRoundDefinition(round, index) {
  const activeStationKeys = Array.isArray(round?.activeStations)
    ? round.activeStations.map(normalizeStationKey).filter((stationKey) => TRAVEL_FIVE_STATION_KEYS.includes(stationKey))
    : [];
  const pressureProfile = normalizeTravelRoundPressureProfile(round);
  return {
    round: Number.isInteger(Number(round?.round)) ? Number(round.round) : index + 1,
    title: typeof round?.title === "string" ? round.title : `Round ${index + 1}`,
    openingVignette: typeof round?.openingVignette === "string" ? round.openingVignette : "",
    primaryPressure: pressureProfile.primaryPressure,
    secondaryPressure: pressureProfile.secondaryPressure,
    progressTarget: pressureProfile.progressTarget,
    activeStations: Array.from(new Set(activeStationKeys)),
    stationPrompts: Object.fromEntries(Array.from(new Set(activeStationKeys)).map((stationKey) => [stationKey, cloneData(getPromptFromRound(round, stationKey))])),
    stationCards: Array.from(new Set(activeStationKeys)).map((stationKey) => {
      const prompt = getPromptFromRound(round, stationKey);
      const card = getStationCardFromRound(round, stationKey);
      return normalizeStationCardForRunner(stationKey, card, prompt);
    }),
    outcomeBranches: isPlainObject(round?.outcomeBranches) ? cloneData(round.outcomeBranches) : {},
    roundEndNarration: normalizeRoundEndNarration(round?.roundEndNarration ?? round?.gmRoundEndNarration)
  };
}

function normalizeFinalOutcomes(finalOutcomes = {}) {
  const source = finalOutcomes && typeof finalOutcomes === "object" && !Array.isArray(finalOutcomes) ? finalOutcomes : {};
  return Object.fromEntries(TRAVEL_EVENT_RUNNER_FINAL_OUTCOMES.map((key) => {
    const outcome = source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) ? source[key] : {};
    return [key, {
      key,
      label: typeof outcome.label === "string" && outcome.label.length > 0 ? outcome.label : FINAL_OUTCOME_LABELS[key],
      text: typeof outcome.text === "string" ? outcome.text : (typeof outcome.narrative === "string" ? outcome.narrative : (typeof outcome.vignette === "string" ? outcome.vignette : "")),
      proposedEffects: Array.isArray(outcome.proposedEffects) ? cloneData(outcome.proposedEffects) : [],
      rewards: Array.isArray(outcome.rewards) ? cloneData(outcome.rewards) : [],
      losses: Array.isArray(outcome.losses) ? cloneData(outcome.losses) : [],
      shipScarCandidates: Array.isArray(outcome.shipScarCandidates) ? cloneData(outcome.shipScarCandidates) : [],
      fortuneCandidates: Array.isArray(outcome.fortuneCandidates) ? cloneData(outcome.fortuneCandidates) : [],
      rewardCandidates: Array.isArray(outcome.rewardCandidates) ? cloneData(outcome.rewardCandidates) : [],
      consequenceCandidates: Array.isArray(outcome.consequenceCandidates) ? cloneData(outcome.consequenceCandidates) : [],
      hazardCandidates: Array.isArray(outcome.hazardCandidates) ? cloneData(outcome.hazardCandidates) : []
    }];
  }));
}

function getActorCollection(options = {}) {
  if (options.actors) return options.actors;
  return globalThis.game?.actors ?? [];
}

function actorCollectionValues(actors) {
  if (!actors) return [];
  if (Array.isArray(actors)) return actors;
  if (typeof actors.values === "function") return Array.from(actors.values());
  if (typeof actors.contents !== "undefined") return Array.from(actors.contents ?? []);
  if (typeof actors === "object") return Object.values(actors);
  return [];
}

function actorUuid(actor) {
  return typeof actor?.uuid === "string" ? actor.uuid : (typeof actor?.documentName === "string" && actor?.id ? `${actor.documentName}.${actor.id}` : "");
}

function isArcflightRunnerShipActor(actor) {
  return actor?.type === "vehicle"
    && (actor.getFlag?.(ARCFLIGHT_MODULE_ID, "actorType") === ARCFLIGHT_SHIP_ACTOR_TYPE || actor.getFlag?.(ARCFLIGHT_MODULE_ID, "enabled") === true);
}

export function getArcflightTravelEventRunnerShipOptions(options = {}) {
  const selectedId = String(options.selectedActorId ?? options.actorId ?? options.shipId ?? "");
  const selectedUuid = String(options.selectedActorUuid ?? options.actorUuid ?? options.shipUuid ?? "");
  const actors = actorCollectionValues(getActorCollection(options))
    .filter((actor) => actor?.type === "vehicle")
    .map((actor) => {
      const uuid = actorUuid(actor);
      const arcflight = isArcflightRunnerShipActor(actor);
      return {
        id: actor.id ?? "",
        uuid,
        name: actor.name ?? actor.id ?? "Unnamed Vehicle",
        type: actor.type ?? "",
        arcflight,
        label: `${actor.name ?? actor.id ?? "Unnamed Vehicle"}${arcflight ? " (Arcflight ship)" : " (PF2E vehicle)"}`,
        selected: Boolean((selectedUuid && uuid === selectedUuid) || (selectedId && actor.id === selectedId))
      };
    })
    .sort((a, b) => Number(b.arcflight) - Number(a.arcflight) || a.name.localeCompare(b.name));
  if (!actors.some((actor) => actor.selected) && actors[0]) actors[0].selected = true;
  return actors;
}


function emptyStationAssignment(source = "empty", overridden = false) {
  return { actorId: "", actorUuid: "", actorName: "", actorType: "", source, overridden: Boolean(overridden) };
}

function normalizeAssignmentSource(value, hasActor = false) {
  if (["ship", "override", "manual", "empty"].includes(value)) return value;
  return hasActor ? "manual" : "empty";
}

function normalizeStationAssignment(value = null) {
  if (!isPlainObject(value)) return emptyStationAssignment();
  const actorId = typeof value.actorId === "string" ? value.actorId : (typeof value.id === "string" ? value.id : "");
  const actorUuid = typeof value.actorUuid === "string" ? value.actorUuid : (typeof value.uuid === "string" ? value.uuid : "");
  const actorName = typeof value.actorName === "string" ? value.actorName : (typeof value.name === "string" ? value.name : "");
  const actorType = typeof value.actorType === "string" ? value.actorType : (typeof value.type === "string" ? value.type : "");
  const hasActor = Boolean(actorId || actorUuid || actorName || actorType);
  const source = normalizeAssignmentSource(value.source, hasActor);
  return { actorId, actorUuid, actorName, actorType, source, overridden: value.overridden === true || source === "override" };
}

function actorTypeFromAssigneeType(assigneeType = "") {
  if (assigneeType === "npc") return "npc";
  if (assigneeType === "crewAsset") return "crewAsset";
  return assigneeType || "actor";
}

function normalizeShipStationAssignment(assignment = null) {
  if (!isPlainObject(assignment)) return emptyStationAssignment();
  const actorId = typeof assignment.actorId === "string" ? assignment.actorId : "";
  const actorUuid = typeof assignment.actorUuid === "string" ? assignment.actorUuid : "";
  const actorName = typeof assignment.name === "string" ? assignment.name : (typeof assignment.actorName === "string" ? assignment.actorName : "");
  const actorType = typeof assignment.actorType === "string" ? assignment.actorType : actorTypeFromAssigneeType(assignment.assigneeType);
  if (!actorId && !actorUuid && !actorName) return emptyStationAssignment();
  return { actorId, actorUuid, actorName, actorType, source: "ship", overridden: false };
}

function getShipStationAssignmentData(ship = null) {
  if (!ship || typeof ship !== "object") return {};
  const flagSystem = ship.getFlag?.(ARCFLIGHT_MODULE_ID, "system") ?? {};
  const directAssignments = ship.stationAssignments ?? ship.stations?.assignments ?? ship.system?.stations?.assignments ?? flagSystem?.stations?.assignments ?? {};
  return isPlainObject(directAssignments) ? directAssignments : {};
}

export function getTravelEventRunnerShipStationAssignments(ship = null, options = {}) {
  const assignments = getShipStationAssignmentData(ship ?? options.ship ?? options.actor);
  return Object.fromEntries(TRAVEL_FIVE_STATION_KEYS.map((stationKey) => [stationKey, normalizeShipStationAssignment(assignments[stationKey])]));
}

export function normalizeTravelEventRunnerStationAssignments(value = {}, options = {}) {
  const source = isPlainObject(value) ? value : {};
  return Object.fromEntries(TRAVEL_FIVE_STATION_KEYS.map((stationKey) => [stationKey, normalizeStationAssignment(source[stationKey])]));
}

function isAssignedStationActor(actor, selectedShip = {}) {
  if (!actor || typeof actor !== "object") return false;
  const uuid = actorUuid(actor);
  if (actor.type === "vehicle") return false;
  if (selectedShip.actorId && actor.id === selectedShip.actorId) return false;
  if (selectedShip.actorUuid && uuid === selectedShip.actorUuid) return false;
  return true;
}

function actorOptionSortRank(actor) {
  if (["character", "npc", "familiar"].includes(actor?.type)) return 0;
  return 1;
}

export function getTravelEventRunnerStationActorOptions(options = {}) {
  const selectedShip = normalizeTravelEventRunnerShipSelection(options.ship ?? options.shipSelection ?? options.actor ?? options);
  const selectedId = String(options.selectedActorId ?? options.actorId ?? "");
  const selectedUuid = String(options.selectedActorUuid ?? options.actorUuid ?? "");
  return actorCollectionValues(getActorCollection(options))
    .filter((actor) => isAssignedStationActor(actor, selectedShip))
    .map((actor) => {
      const uuid = actorUuid(actor);
      const name = actor.name ?? actor.id ?? "Unnamed Actor";
      const type = actor.type ?? "";
      return {
        actorId: actor.id ?? "",
        actorUuid: uuid,
        actorName: name,
        actorType: type,
        id: actor.id ?? "",
        uuid,
        name,
        type,
        label: `${name}${type ? ` (${humanizeIdentifier(type)})` : ""}`,
        selected: Boolean((selectedUuid && uuid === selectedUuid) || (selectedId && actor.id === selectedId))
      };
    })
    .sort((a, b) => actorOptionSortRank(a) - actorOptionSortRank(b) || a.actorName.localeCompare(b.actorName));
}

function findStationActorOption(actorIdOrUuid, options = {}) {
  const key = String(actorIdOrUuid ?? "");
  if (!key) return null;
  return getTravelEventRunnerStationActorOptions(options).find((actor) => actor.actorId === key || actor.actorUuid === key) ?? null;
}

export function updateTravelEventRunnerStationAssignment(session, stationKey, actorIdOrUuid, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return normalized;
  if (!TRAVEL_FIVE_STATION_KEYS.includes(stationKey)) return { ok: false, errors: [`Invalid travel runner station key "${stationKey}".`], warnings: [], session: cloneData(normalized.session) };
  const actor = findStationActorOption(actorIdOrUuid, { ...options, ship: normalized.session.ship });
  if (!actor) return { ok: false, errors: [`No eligible station actor found for "${String(actorIdOrUuid ?? "")}".`], warnings: [], session: cloneData(normalized.session) };
  const nextSession = cloneData(normalized.session);
  nextSession.stationAssignments = normalizeTravelEventRunnerStationAssignments(nextSession.stationAssignments);
  nextSession.stationAssignments[stationKey] = { actorId: actor.actorId, actorUuid: actor.actorUuid, actorName: actor.actorName, actorType: actor.actorType, source: "override", overridden: true };
  nextSession.updatedAt = nowIso(options);
  return { ok: true, errors: [], warnings: [], session: nextSession, assignment: cloneData(nextSession.stationAssignments[stationKey]) };
}

export function clearTravelEventRunnerStationAssignment(session, stationKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return normalized;
  if (!TRAVEL_FIVE_STATION_KEYS.includes(stationKey)) return { ok: false, errors: [`Invalid travel runner station key "${stationKey}".`], warnings: [], session: cloneData(normalized.session) };
  const nextSession = cloneData(normalized.session);
  nextSession.stationAssignments = normalizeTravelEventRunnerStationAssignments(nextSession.stationAssignments);
  nextSession.stationAssignments[stationKey] = emptyStationAssignment("override", true);
  nextSession.updatedAt = nowIso(options);
  return { ok: true, errors: [], warnings: [], session: nextSession, assignment: cloneData(nextSession.stationAssignments[stationKey]) };
}

export function resetTravelEventRunnerStationAssignmentToShip(session, stationKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return normalized;
  if (!TRAVEL_FIVE_STATION_KEYS.includes(stationKey)) return { ok: false, errors: [`Invalid travel runner station key "${stationKey}".`], warnings: [], session: cloneData(normalized.session) };
  const shipAssignment = getTravelEventRunnerShipStationAssignments(options.ship ?? options.actor)[stationKey] ?? emptyStationAssignment();
  const nextSession = cloneData(normalized.session);
  nextSession.stationAssignments = normalizeTravelEventRunnerStationAssignments(nextSession.stationAssignments);
  nextSession.stationAssignments[stationKey] = shipAssignment.actorId || shipAssignment.actorUuid || shipAssignment.actorName ? shipAssignment : emptyStationAssignment();
  nextSession.updatedAt = nowIso(options);
  return { ok: true, errors: [], warnings: shipAssignment.source === "empty" ? [`No ship assignment exists for ${humanizeIdentifier(stationKey)}.`] : [], session: nextSession, assignment: cloneData(nextSession.stationAssignments[stationKey]) };
}

function getActorByAssignment(assignment, options = {}) {
  if (!assignment?.actorId && !assignment?.actorUuid) return null;
  return actorCollectionValues(getActorCollection(options)).find((actor) => actor?.id === assignment.actorId || actorUuid(actor) === assignment.actorUuid) ?? null;
}


function normalizeSelectedStationSkills(roundResult = {}, round = null) {
  const source = isPlainObject(roundResult?.selectedStationSkills) ? roundResult.selectedStationSkills : {};
  const activeKeys = Array.isArray(round?.activeStations) ? round.activeStations : Object.keys(roundResult?.stationResults ?? {});
  return Object.fromEntries(activeKeys.map((stationKey) => [stationKey, typeof source[stationKey] === "string" ? source[stationKey] : ""]));
}

function normalizeStationActions(roundResult = {}, round = null) {
  const source = isPlainObject(roundResult?.stationActions) ? roundResult.stationActions : {};
  const activeKeys = Array.isArray(round?.activeStations) ? round.activeStations : Object.keys(roundResult?.stationResults ?? {});
  return Object.fromEntries(activeKeys.map((stationKey) => [stationKey, normalizeTravelStationAction(source[stationKey], stationKey, round)]));
}

function normalizeStationOrderCommitments(roundResult = {}, round = null) {
  const source = isPlainObject(roundResult?.stationOrderCommitments) ? roundResult.stationOrderCommitments : {};
  const activeKeys = Array.isArray(round?.activeStations) ? round.activeStations : Object.keys(roundResult?.stationResults ?? {});
  return Object.fromEntries(activeKeys.map((stationKey) => {
    const commitment = isPlainObject(source[stationKey]) ? source[stationKey] : {};
    return [stationKey, {
      committed: commitment.committed === true,
      source: commitment.source === "player" ? "player" : "",
      selectedFocusAbility: typeof commitment.selectedFocusAbility === "string" ? commitment.selectedFocusAbility : ""
    }];
  }));
}

function normalizeSelectedStationOptionLabels(roundResult = {}, round = null) {
  const source = isPlainObject(roundResult?.selectedStationOptionLabels) ? roundResult.selectedStationOptionLabels : {};
  const activeKeys = Array.isArray(round?.activeStations) ? round.activeStations : Object.keys(roundResult?.stationResults ?? {});
  return Object.fromEntries(activeKeys.map((stationKey) => [stationKey, typeof source[stationKey] === "string" ? source[stationKey] : ""]));
}

export function validateTravelSupportTarget(session, roundIndex, supportingStationKey, targetStationKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const index = Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : normalized.session.currentRoundIndex;
  const round = normalized.session.event?.rounds?.[index] ?? null;
  if (!round) return { ok: false, errors: [`Travel runner round ${roundIndex} does not exist.`], warnings: [], session: normalized.session };
  if (!round.activeStations?.includes(supportingStationKey)) return { ok: false, errors: [`Station "${supportingStationKey}" is not active in round ${index + 1}.`], warnings: [], session: normalized.session };
  if (typeof targetStationKey !== "string" || !targetStationKey) return { ok: false, errors: ["Support requires a target station."], warnings: [], session: normalized.session };
  if (targetStationKey === supportingStationKey) return { ok: false, errors: ["Support cannot target its own station."], warnings: [], session: normalized.session };
  if (!round.activeStations?.includes(targetStationKey)) return { ok: false, errors: [`Support target "${targetStationKey}" is not active in this round.`], warnings: [], session: normalized.session };
  return { ok: true, errors: [], warnings: [], session: normalized.session, round, roundIndex: index, supportingStationKey, targetStationKey };
}

function stationOptionKey(actionType, skill, pressureKey = "") {
  return [actionType, pressureKey, skill].filter(Boolean).join(":");
}

function supportStationOptionKey(targetStationKey) {
  return stationOptionKey(ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT, "assist", targetStationKey);
}

function stationNameForRound(round, stationKey) {
  const station = getStation(stationKey) ?? {};
  const prompt = round?.stationPrompts?.[stationKey] ?? {};
  return prompt.stationName || station.displayName || station.name || humanizeIdentifier(stationKey);
}

function defaultStabilizeSkill(stationKey, assignedActor) {
  const defaultSkill = DEFAULT_STABILIZE_SKILLS[stationKey] ?? "";
  if (stationKey !== ARCFLIGHT_TRAVEL_STATIONS.NAVIGATOR) return defaultSkill;
  return Number.isFinite(resolveActorStatisticDetails(assignedActor, defaultSkill).modifier) ? defaultSkill : "survival";
}

function normalizeCustomStabilizeOptions(card = {}, stationKey, round, assignedActor) {
  const explicit = Array.isArray(card?.stabilizeOptions) ? card.stabilizeOptions : [];
  const pressureKey = getTravelStationStabilizePressureKey(stationKey, round);
  const defaults = explicit.length > 0 ? explicit : [{ skill: defaultStabilizeSkill(stationKey, assignedActor), pressureKey }];
  return defaults.filter(isPlainObject).map((entry) => {
    const skill = typeof entry.skill === "string" && entry.skill ? entry.skill : defaultStabilizeSkill(stationKey, assignedActor);
    const target = getTravelPressureIdentity(entry.pressureKey)?.key ?? pressureKey;
    const pressureLabel = getTravelPressureIdentity(target)?.label ?? humanizeIdentifier(target);
    return {
      optionKey: stationOptionKey(ARCFLIGHT_TRAVEL_STATION_ACTIONS.STABILIZE, skill, target),
      actionType: ARCFLIGHT_TRAVEL_STATION_ACTIONS.STABILIZE,
      skill,
      label: typeof entry.label === "string" && entry.label ? entry.label : `Stabilize ${pressureLabel} — ${humanizeIdentifier(skill)}`,
      helpText: typeof entry.helpText === "string" ? entry.helpText : "Reduce pressure instead of adding round progress.",
      stabilizePressureKey: target,
      pressureLabel
    };
  });
}

function resolveStationApproachSelection(roundResult, stationKey, card, suggestedSkills = []) {
  const approaches = Array.isArray(card?.skillApproaches) ? card.skillApproaches.filter((entry) => isPlainObject(entry) && typeof entry.skill === "string" && entry.skill.length > 0) : [];
  const storedSkill = typeof roundResult?.selectedStationSkills?.[stationKey] === "string" ? roundResult.selectedStationSkills[stationKey] : "";
  const selectedApproach = approaches.find((entry) => entry.skill === storedSkill) ?? approaches[0] ?? null;
  const fallbackSkill = Array.isArray(suggestedSkills) ? suggestedSkills.find(Boolean) : "";
  const skill = selectedApproach?.skill || fallbackSkill || "";
  const label = selectedApproach?.label || (skill ? humanizeIdentifier(skill) : "Approach");
  return {
    skill,
    label,
    helpText: selectedApproach?.helpText ?? "",
    dc: Number.isFinite(Number(selectedApproach?.dc)) ? Number(selectedApproach.dc) : null,
    selected: selectedApproach ? cloneData(selectedApproach) : null,
    isSelected: Boolean(storedSkill),
    source: selectedApproach ? "stationCard" : (fallbackSkill ? "suggestedSkills" : "default"),
    options: approaches.map((entry) => ({
      skill: entry.skill,
      label: entry.label || humanizeIdentifier(entry.skill),
      helpText: entry.helpText || "",
      dc: Number.isFinite(Number(entry.dc)) ? Number(entry.dc) : null,
      selected: entry.skill === skill
    }))
  };
}

function resolveSafeStatisticLabel(actor, suggestedSkills = []) {
  const key = Array.isArray(suggestedSkills) ? suggestedSkills.find(Boolean) : "";
  if (!key) return "No rollable statistic found";
  const label = humanizeIdentifier(key);
  if (!actor) return `${label} (unavailable)`;
  const statistic = key === "perception"
    ? (actor?.system?.perception ?? actor?.system?.attributes?.perception ?? actor?.perception ?? actor?.system?.proficiencies?.perception ?? actor?.system?.skills?.perception ?? actor?.system?.statistics?.perception ?? actor?.skills?.perception ?? actor?.statistics?.perception ?? null)
    : (actor?.system?.skills?.[key] ?? actor?.system?.statistics?.[key] ?? actor?.skills?.[key] ?? actor?.statistics?.[key] ?? null);
  const mod = Number(statistic?.mod ?? statistic?.check?.mod ?? statistic?.totalModifier);
  if (Number.isFinite(mod)) return `${label} (${mod >= 0 ? "+" : ""}${mod})`;
  return `${label} (unavailable)`;
}

function getCollectionValue(collection, key) {
  if (!collection || !key) return null;
  if (typeof collection.get === "function") return collection.get(key) ?? null;
  return collection[key] ?? null;
}

function collectionEntries(collection) {
  if (!collection) return [];
  if (collection instanceof Map) return Array.from(collection.entries());
  if (typeof collection.entries === "function") {
    try {
      return Array.from(collection.entries());
    } catch (_error) {
      // Fall back to object entries for Foundry data wrappers.
    }
  }
  return Object.entries(collection);
}

function normalizeStatisticAlias(value = "") {
  return String(value ?? "").trim().toLowerCase().replace(/[ _]+/g, "-");
}

const PF2E_TRAVEL_SKILL_ALIASES = Object.freeze({
  survival: ["survival", "sur"],
  arcana: ["arcana", "arc"],
  occultism: ["occultism", "occ"],
  society: ["society", "soc"],
  crafting: ["crafting", "cra"],
  diplomacy: ["diplomacy", "dip"],
  intimidation: ["intimidation", "itm"],
  perception: ["perception"],
  "piloting-lore": ["piloting-lore", "piloting", "lore:piloting"],
  "sailing-lore": ["sailing-lore", "sailing", "lore:sailing"]
});

function loreBaseFromSkill(skill = "") {
  const key = normalizeStatisticAlias(skill);
  if (key.endsWith("-lore")) return key.replace(/-lore$/, "");
  if (key.startsWith("lore:")) return key.replace(/^lore:/, "");
  return "";
}

function statisticAliasCandidates(skill, actor = null) {
  const key = normalizeStatisticAlias(skill);
  if (!key) return [];
  const aliases = [...(PF2E_TRAVEL_SKILL_ALIASES[key] ?? [key])];
  const base = loreBaseFromSkill(key);
  if (base) aliases.push(base, `${base}-lore`, `lore:${base}`);
  const normalizedBase = base || (key.includes("lore") ? key.replace(/-?lore|lore:/g, "") : "");
  if (normalizedBase) {
    const entries = [
      ...collectionEntries(actor?.statistics),
      ...collectionEntries(actor?.skills),
      ...collectionEntries(actor?.system?.skills),
      ...collectionEntries(actor?.system?.statistics)
    ];
    for (const [entryKey, statistic] of entries) {
      const labels = [entryKey, statistic?.slug, statistic?.label, statistic?.name, statistic?.system?.slug, statistic?.system?.label, statistic?.system?.name].map(normalizeStatisticAlias);
      if (labels.some((label) => label.includes(normalizedBase) && label.includes("lore"))) aliases.push(String(entryKey), statistic?.slug, statistic?.label, statistic?.name);
    }
  }
  return Array.from(new Set(aliases.map((alias) => String(alias ?? "").trim()).filter(Boolean)));
}

function getStatisticModifierValue(statistic) {
  const modifier = Number(statistic?.mod ?? statistic?.check?.mod ?? statistic?.totalModifier ?? statistic?.modifier ?? statistic?.value);
  return Number.isFinite(modifier) ? modifier : null;
}

function resolveActorStatisticDetails(actor, skill) {
  const aliasesTried = statisticAliasCandidates(skill, actor);
  if (!actor || aliasesTried.length === 0) return { statistic: null, statisticKey: "", modifier: null, aliasesTried, label: humanizeIdentifier(skill), actorName: actor?.name ?? "", message: `Modifier unavailable: could not find ${humanizeIdentifier(skill)} on ${actor?.name ?? "assigned actor"}` };

  for (const alias of aliasesTried) {
    let statistic = null;
    if (typeof actor.getStatistic === "function") {
      try {
        statistic = actor.getStatistic(alias) ?? null;
      } catch (_error) {
        statistic = null;
      }
    }
    statistic = statistic
      ?? (normalizeStatisticAlias(alias) === "perception" ? (actor?.system?.perception ?? actor?.system?.attributes?.perception ?? actor?.perception ?? actor?.system?.proficiencies?.perception ?? null) : null)
      ?? getCollectionValue(actor?.statistics, alias)
      ?? getCollectionValue(actor?.skills, alias)
      ?? getCollectionValue(actor?.system?.skills, alias)
      ?? getCollectionValue(actor?.system?.statistics, alias);
    const modifier = getStatisticModifierValue(statistic);
    if (statistic && Number.isFinite(modifier)) {
      return {
        statistic,
        statisticKey: alias,
        modifier,
        aliasesTried,
        label: statistic?.label ?? statistic?.name ?? statistic?.slug ?? humanizeIdentifier(skill),
        actorName: actor.name ?? ""
      };
    }
  }

  return { statistic: null, statisticKey: "", modifier: null, aliasesTried, label: humanizeIdentifier(skill), actorName: actor.name ?? "", message: `Modifier unavailable: could not find ${humanizeIdentifier(skill)} on ${actor.name ?? "assigned actor"}` };
}

function resolveActorStatisticModifier(actor, skill) {
  return resolveActorStatisticDetails(actor, skill).modifier;
}

function resolveStationDc(row, baseDC) {
  const approachDc = Number(row?.selectedApproach?.dc);
  const hazardDcModifier = Number(row?.selectedApproach?.hazardDcModifier ?? row?.hazardDcModifier ?? 0) || 0;
  if (Number.isFinite(approachDc) && approachDc > 0) return { dc: approachDc + hazardDcModifier, source: hazardDcModifier ? "hazard" : "approach" };
  const card = isPlainObject(row?.stationCard) ? row.stationCard : {};
  const prompt = isPlainObject(row?.promptData) ? row.promptData : {};
  const directDc = Number(card.dc ?? card.DC ?? prompt.dc ?? prompt.DC);
  if (Number.isFinite(directDc) && directDc > 0) return { dc: directDc + hazardDcModifier, source: hazardDcModifier ? "hazard" : "station" };
  const dcModifier = Number(card.dcModifier ?? prompt.dcModifier);
  const eventDc = Number(baseDC);
  if (Number.isFinite(eventDc) && eventDc > 0 && Number.isFinite(dcModifier)) return { dc: eventDc + dcModifier + hazardDcModifier, source: hazardDcModifier ? "hazard" : "stationModifier" };
  if (Number.isFinite(eventDc) && eventDc > 0) return { dc: eventDc + hazardDcModifier, source: hazardDcModifier ? "hazard" : "event" };
  return { dc: null, source: "" };
}

export function prepareTravelEventRunnerStationAssignmentState(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  const assignments = normalizeTravelEventRunnerStationAssignments(normalized.session?.stationAssignments);
  const actorOptions = getTravelEventRunnerStationActorOptions({ ...options, ship: normalized.session?.ship });
  const playerUserOptions = getActivePlayerUserOptions();
  const npcControllers = normalizeNpcStationControllers(normalized.session?.npcStationControllers);
  const rows = TRAVEL_FIVE_STATION_KEYS.map((stationKey) => {
    const assignment = assignments[stationKey];
    const assigned = Boolean(assignment.actorId || assignment.actorUuid || assignment.actorName);
    return {
      stationKey,
      stationName: humanizeIdentifier(stationKey),
      assignment,
      assigned,
      assignedActorName: assigned ? (assignment.actorName || "Unknown Actor") : "Unassigned",
      sourceLabel: assignment.source === "ship" ? "Ship" : (assignment.source === "override" ? "Temporary Override" : (assignment.source === "manual" ? "Manual" : "Empty")),
      hasShipSource: assignment.source === "ship",
      hasOverride: assignment.overridden === true,
      options: actorOptions.map((actor) => ({ ...actor, selected: Boolean((assignment.actorUuid && actor.actorUuid === assignment.actorUuid) || (assignment.actorId && actor.actorId === assignment.actorId)) })),
      canClear: assigned,
      isNpcAssignment: assignment.actorType === "npc",
      npcController: npcControllers[stationKey],
      npcControllerName: npcControllers[stationKey]?.userName || "Unassigned",
      npcControllerOptions: playerUserOptions.map((user) => ({ ...user, selected: npcControllers[stationKey]?.userId === user.userId }))
    };
  });
  return { ok: normalized.ok, errors: normalized.errors ?? [], warnings: normalized.warnings ?? [], session: normalized.session, rows, actorOptions };
}

function getActivePlayerUserOptions() {
  const users = globalThis.game?.users;
  const values = users?.filter ? users.filter(() => true) : (users?.values ? Array.from(users.values()) : (Array.isArray(users) ? users : []));
  return values
    .filter((user) => user?.isGM !== true && typeof user.id === "string")
    .map((user) => ({ userId: user.id, userName: user.name ?? user.id, label: user.name ?? user.id }));
}

function normalizeNpcStationControllers(value = {}) {
  const source = isPlainObject(value) ? value : {};
  return Object.fromEntries(TRAVEL_FIVE_STATION_KEYS.map((stationKey) => {
    const entry = isPlainObject(source[stationKey]) ? source[stationKey] : {};
    return [stationKey, {
      userId: typeof entry.userId === "string" ? entry.userId : "",
      userName: typeof entry.userName === "string" ? entry.userName : ""
    }];
  }));
}

export function setTravelEventRunnerNpcStationController(session, stationKey, userId, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return normalized;
  if (!TRAVEL_FIVE_STATION_KEYS.includes(stationKey)) return { ok: false, errors: [`Invalid travel runner station key "${stationKey}".`], warnings: [], session: cloneData(normalized.session) };
  const userOptions = getActivePlayerUserOptions();
  const selected = userId ? userOptions.find((user) => user.userId === userId) : null;
  if (userId && !selected) return { ok: false, errors: ["No active non-GM player user found for this NPC controller."], warnings: [], session: cloneData(normalized.session) };
  const nextSession = cloneData(normalized.session);
  nextSession.npcStationControllers = normalizeNpcStationControllers(nextSession.npcStationControllers);
  nextSession.npcStationControllers[stationKey] = selected ? { userId: selected.userId, userName: selected.userName } : { userId: "", userName: "" };
  nextSession.updatedAt = nowIso(options);
  return { ok: true, errors: [], warnings: [], session: nextSession, controller: cloneData(nextSession.npcStationControllers[stationKey]) };
}

function normalizeTravelEventRunnerShipSelection(selection = null) {
  const actor = selection?.actor ?? (selection?.type === "vehicle" ? selection : null);
  const source = actor ?? selection ?? {};
  const id = typeof source.id === "string" ? source.id : (typeof source.actorId === "string" ? source.actorId : "");
  const uuid = typeof source.uuid === "string" ? source.uuid : (typeof source.actorUuid === "string" ? source.actorUuid : actorUuid(actor));
  const name = typeof source.name === "string" ? source.name : (typeof source.actorName === "string" ? source.actorName : "");
  return {
    actorId: id,
    actorUuid: uuid,
    actorName: name,
    actorType: typeof source.type === "string" ? source.type : (typeof source.actorType === "string" ? source.actorType : ""),
    arcflight: source.arcflight === true || isArcflightRunnerShipActor(actor)
  };
}


function resolveTravelEventRunnerShipActor(selection = null, options = {}) {
  if (selection && typeof selection === "object" && typeof selection.getFlag === "function") return selection;
  const normalized = normalizeTravelEventRunnerShipSelection(selection ?? options.ship ?? options.actor ?? options);
  return actorCollectionValues(getActorCollection(options)).find((candidate) => (normalized.actorUuid && actorUuid(candidate) === normalized.actorUuid) || (normalized.actorId && candidate?.id === normalized.actorId)) ?? null;
}

function normalizeEventForRunner(event) {
  const rounds = Array.isArray(event?.rounds) ? event.rounds.map(normalizeRoundDefinition) : [];
  return {
    key: typeof event?.key === "string" ? event.key : "",
    name: typeof event?.name === "string" ? event.name : (typeof event?.key === "string" ? humanizeIdentifier(event.key) : "Untitled Travel Event"),
    category: typeof event?.category === "string" ? event.category : "",
    categoryLabel: humanizeIdentifier(event?.category),
    baseDC: Number.isFinite(Number(event?.baseDC)) ? Number(event.baseDC) : 0,
    roundCount: Number.isInteger(Number(event?.roundCount)) && Number(event.roundCount) > 0 ? Number(event.roundCount) : rounds.length,
    rounds,
    finalOutcomes: normalizeFinalOutcomes(event?.finalOutcomes)
  };
}

function validateRunnerEvent(event, options = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) errors.push("Travel Event Runner requires a finalized published event object.");
  if (event?.builder !== undefined) errors.push("Travel Event Runner cannot start from a draft containing builder metadata.");
  if (!Array.isArray(event?.rounds) || event.rounds.length === 0) errors.push("Travel Event Runner requires at least one round.");
  const validationEvent = event && typeof event === "object" && !Array.isArray(event) ? { ...event, rounds: normalizeEventForRunner(event).rounds } : event;
  const validation = validationEvent && typeof validationEvent === "object" && !Array.isArray(validationEvent) ? validateTravelEventDefinition(validationEvent, { ...options, strictAuthoring: true }) : { ok: false, errors: [], warnings: [] };
  errors.push(...(validation.errors ?? []));
  return { ok: errors.length === 0, errors, warnings: validation.warnings ?? [], validation };
}

function createRoundResults(event) {
  return event.rounds.map((round, index) => ({
    roundIndex: index,
    roundNumber: round.round,
    title: round.title,
    stationResults: Object.fromEntries(round.activeStations.map((stationKey) => [stationKey, null])),
    selectedStationSkills: Object.fromEntries(round.activeStations.map((stationKey) => [stationKey, ""])),
    selectedStationOptionLabels: Object.fromEntries(round.activeStations.map((stationKey) => [stationKey, ""])),
    stationActions: Object.fromEntries(round.activeStations.map((stationKey) => [stationKey, eventApproach()])),
    stationOrderCommitments: Object.fromEntries(round.activeStations.map((stationKey) => [stationKey, { committed: false, source: "", selectedFocusAbility: "" }]))
  }));
}

export function prepareTravelEventRunnerLibraryState(options = {}) {
  const state = preparePublishedTravelEventLibraryState(options);
  const selectedId = typeof options.selectedEventId === "string" ? options.selectedEventId : "";
  const entries = (state.entries ?? []).map((entry, index) => ({
    ...entry,
    categoryLabel: humanizeIdentifier(entry.category),
    publishedAtLabel: entry.publishedAt ? new Date(entry.publishedAt).toLocaleString() : "",
    selected: selectedId ? entry.id === selectedId || entry.key === selectedId : index === 0
  }));
  return { ...state, entries, selectedEventId: entries.find((entry) => entry.selected)?.id ?? "", hasLoadableEvents: entries.some((entry) => entry.canLoad) };
}

export function prepareTravelEventRunnerStartupDiagnostics(options = {}) {
  const hasSession = Boolean(options.session);
  const library = prepareTravelEventRunnerLibraryState(options);
  const selectedEventId = options.selectedEventId || library.selectedEventId || "";
  const selectedEntry = library.entries?.find((entry) => entry.selected || entry.id === selectedEventId || entry.key === selectedEventId) ?? null;
  const launchState = selectedEventId ? preparePublishedTravelEventRunnerLaunchState({ ...options, idOrKey: selectedEventId }) : null;
  const shipOptions = launchState?.shipOptions ?? getArcflightTravelEventRunnerShipOptions(options);
  const dialogV2Available = options.dialogV2Available === true;
  const issues = [];
  const nextSteps = [];

  if (hasSession) issues.push("A local runner session already exists. Save, export, or clear the current local runner session before starting another.");
  if (!library.hasEvents) issues.push("No published finalized travel event exists. Open Travel Event Builder, use Load Sample: The Lantern in the Static if desired, then Publish Current Draft before starting a local runner session.");
  else if (!library.hasLoadableEvents) issues.push("Published travel event entries exist, but none are loadable finalized events. Malformed or not-finalized entries cannot start a local runner session.");
  else if (selectedEntry?.isMalformed || selectedEntry?.canLoad === false) issues.push("The selected published travel event is malformed or not finalized. Select a loadable finalized published event.");
  else if (launchState && !launchState.event) issues.push(launchState.errors?.[0] ?? "The selected published travel event could not be loaded.");

  if (shipOptions.length === 0) issues.push("No PF2E vehicle / Arcflight ship actor exists. Create or enable a vehicle actor before starting a local runner session.");
  if (!dialogV2Available) issues.push("Foundry DialogV2 is unavailable. Start Local Runner Session cannot show the ship/session dialog in this environment.");

  if (!hasSession) {
    nextSteps.push("Select a published finalized travel event.");
    nextSteps.push("Click Start Local Runner Session.");
    nextSteps.push("Choose a ship/PF2E vehicle in the DialogV2 prompt.");
    nextSteps.push("Confirm to create a local runner session.");
  }

  return Object.freeze({
    canStart: issues.length === 0,
    hasSession,
    hasPublishedFinalizedEvent: library.hasLoadableEvents === true,
    hasSelectedPublishedEvent: Boolean(selectedEventId),
    selectedEventId,
    selectedEventName: selectedEntry?.name ?? launchState?.event?.name ?? "",
    selectedEventMalformed: selectedEntry?.isMalformed === true || selectedEntry?.canLoad === false,
    hasShipOptions: shipOptions.length > 0,
    shipOptionCount: shipOptions.length,
    dialogV2Available,
    issues,
    nextSteps
  });
}

export function createTravelEventRunnerSession(event, options = {}) {
  const runnerValidation = validateRunnerEvent(event, options);
  if (!runnerValidation.ok) return { ok: false, errors: runnerValidation.errors, warnings: runnerValidation.warnings, session: null };

  const normalizedEvent = normalizeEventForRunner(event);
  const shipActor = resolveTravelEventRunnerShipActor(options.ship ?? options.actor ?? options, options);
  const shipSelection = normalizeTravelEventRunnerShipSelection(shipActor ?? options.ship ?? options.actor ?? options);
  const timestamp = nowIso(options);
  const session = {
    version: TRAVEL_EVENT_RUNNER_SESSION_VERSION,
    key: resolveTravelEventRunnerSessionKey({ ...options, event: normalizedEvent, ship: shipSelection, startedAt: timestamp }, options),
    status: "active",
    event: normalizedEvent,
    currentRoundIndex: 0,
    pressure: createEmptyTravelPressureState(),
    roundPhase: normalizeTravelRunnerRoundPhase(),
    roundResults: createRoundResults(normalizedEvent),
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: "",
    summary: null,
    ship: shipSelection,
    notes: typeof options.notes === "string" ? options.notes.trim() : "",
    stationAssignments: normalizeTravelEventRunnerStationAssignments(Object.hasOwn(options, "stationAssignments") ? options.stationAssignments : getTravelEventRunnerShipStationAssignments(shipActor ?? options.ship ?? options.actor)),
    npcStationControllers: normalizeNpcStationControllers(options.npcStationControllers),
    stationFocus: normalizeTravelEventRunnerStationFocus(options.stationFocus, normalizedEvent, options),
    focusEffectRecords: normalizeTravelFocusEffectRecords(options.focusEffectRecords, options),
    stabilizeResolutionRecords: normalizeTravelStabilizeResolutionRecords(options.stabilizeResolutionRecords, options),
    reactionPrompts: normalizeTravelReactionPromptRecords(options.reactionPrompts, options),
    travelV2Hazards: normalizeTravelV2HazardDeckState(options.travelV2Hazards),
    shipScars: normalizeTravelV2ShipScarsState(options.shipScars),
    travelV2Momentum: normalizeTravelV2MomentumState(options.travelV2Momentum)
  };

  return { ok: true, errors: [], warnings: runnerValidation.warnings, session };
}

export function normalizeTravelEventRunnerSession(session, options = {}) {
  const errors = [];
  if (!session || typeof session !== "object" || Array.isArray(session)) return { ok: false, errors: ["Travel Event Runner session is malformed."], warnings: [], session: null };
  const event = normalizeEventForRunner(session.event ?? {});
  if (event.rounds.length === 0) errors.push("Travel Event Runner session has no rounds.");
  const currentRoundIndex = Math.min(Math.max(Number.isInteger(Number(session.currentRoundIndex)) ? Number(session.currentRoundIndex) : 0, 0), Math.max(event.rounds.length - 1, 0));
  const roundResults = createRoundResults(event).map((roundResult, index) => {
    const source = Array.isArray(session.roundResults) ? session.roundResults[index] : null;
    const sourceResults = source?.stationResults && typeof source.stationResults === "object" && !Array.isArray(source.stationResults) ? source.stationResults : {};
    return {
      ...roundResult,
      stationResults: Object.fromEntries(Object.keys(roundResult.stationResults).map((stationKey) => [stationKey, TRAVEL_EVENT_RUNNER_RESULT_VALUES.includes(sourceResults[stationKey]) ? sourceResults[stationKey] : null])),
      selectedStationSkills: normalizeSelectedStationSkills(source, event.rounds[index]),
      selectedStationOptionLabels: normalizeSelectedStationOptionLabels(source, event.rounds[index]),
      stationActions: normalizeStationActions(source, event.rounds[index]),
      stationOrderCommitments: normalizeStationOrderCommitments(source, event.rounds[index])
    };
  });
  const normalized = {
    key: resolveTravelEventRunnerSessionKey({ ...session, event, startedAt: typeof session.startedAt === "string" ? session.startedAt : "" }, options),
    name: typeof session.name === "string" ? session.name : "",
    version: TRAVEL_EVENT_RUNNER_SESSION_VERSION,
    status: ["active", "completed"].includes(session.status) ? session.status : "active",
    event,
    currentRoundIndex,
    pressure: normalizeTravelPressureState(session.pressure ?? session.travelPressure),
    roundPhase: normalizeTravelRunnerRoundPhase(session.roundPhase ?? session.currentRoundPhase),
    roundResults,
    startedAt: typeof session.startedAt === "string" ? session.startedAt : nowIso(options),
    updatedAt: typeof session.updatedAt === "string" ? session.updatedAt : nowIso(options),
    completedAt: typeof session.completedAt === "string" ? session.completedAt : "",
    summary: session.summary && typeof session.summary === "object" ? cloneData(session.summary) : null,
    appliedEffects: normalizeTravelEventAppliedEffects(session.appliedEffects),
    ship: normalizeTravelEventRunnerShipSelection(session.ship ?? session.shipSelection ?? session.actor ?? null),
    notes: typeof session.notes === "string" ? session.notes : "",
    stationAssignments: normalizeTravelEventRunnerStationAssignments(session.stationAssignments),
    npcStationControllers: normalizeNpcStationControllers(session.npcStationControllers),
    stationFocus: normalizeTravelEventRunnerStationFocus(session.stationFocus, event, options),
    focusEffectRecords: normalizeTravelFocusEffectRecords(session.focusEffectRecords, options),
    stabilizeResolutionRecords: normalizeTravelStabilizeResolutionRecords(session.stabilizeResolutionRecords, options),
    reactionPrompts: normalizeTravelReactionPromptRecords(session.reactionPrompts, options),
    travelV2Hazards: normalizeTravelV2HazardDeckState(session.travelV2Hazards ?? session.hazards),
    shipScars: normalizeTravelV2ShipScarsState(session.shipScars ?? session.travelV2ShipScars),
    travelV2Momentum: normalizeTravelV2MomentumState(session.travelV2Momentum),
    travelV2FocusBacklashRecords: normalizeTravelV2FocusBacklashRecords(session.travelV2FocusBacklashRecords, options),
    travelV2SupportRecords: normalizeTravelV2SupportRecords(session.travelV2SupportRecords, options),
    travelV2SupportBacklashRecords: normalizeTravelV2SupportBacklashRecords(session.travelV2SupportBacklashRecords, options),
    playerMissionBoardRollDetails: isPlainObject(session.playerMissionBoardRollDetails) ? cloneData(session.playerMissionBoardRollDetails) : {},
    travelV2PressureApplications: isPlainObject(session.travelV2PressureApplications) || Array.isArray(session.travelV2PressureApplications) ? cloneData(session.travelV2PressureApplications) : undefined,
    travelV2PressureCorrections: isPlainObject(session.travelV2PressureCorrections) || Array.isArray(session.travelV2PressureCorrections) ? cloneData(session.travelV2PressureCorrections) : undefined,
    travelV2RoundActionOrder: isPlainObject(session.travelV2RoundActionOrder) ? cloneData(session.travelV2RoundActionOrder) : undefined,
    travelV2RoundResolutions: isPlainObject(session.travelV2RoundResolutions) || Array.isArray(session.travelV2RoundResolutions) ? cloneData(session.travelV2RoundResolutions) : undefined,
    travelV2EventCompletion: isPlainObject(session.travelV2EventCompletion) ? cloneData(session.travelV2EventCompletion) : undefined,
    travelV2EventOutcomeApplication: isPlainObject(session.travelV2EventOutcomeApplication) ? cloneData(session.travelV2EventOutcomeApplication) : undefined,
    travelV2ActorApplication: isPlainObject(session.travelV2ActorApplication) ? cloneData(session.travelV2ActorApplication) : undefined
  };
  for (const key of ["travelV2PressureApplications", "travelV2PressureCorrections", "travelV2RoundActionOrder", "travelV2RoundResolutions", "travelV2EventCompletion", "travelV2EventOutcomeApplication", "travelV2ActorApplication"]) {
    if (normalized[key] === undefined) delete normalized[key];
  }
  return { ok: errors.length === 0, errors, warnings: [], session: normalized };
}

function normalizeTravelEventAppliedEffects(appliedEffects = {}) {
  const source = isPlainObject(appliedEffects) ? appliedEffects : {};
  const records = Array.isArray(source.records) ? source.records.filter(isPlainObject).map((record) => ({
    applicationId: typeof record.applicationId === "string" ? record.applicationId : "",
    effectId: typeof record.effectId === "string" ? record.effectId : (typeof record.effectKey === "string" ? record.effectKey : ""),
    effectKey: typeof record.effectKey === "string" ? record.effectKey : (typeof record.effectId === "string" ? record.effectId : ""),
    effectIndex: Number.isInteger(Number(record.effectIndex)) ? Number(record.effectIndex) : null,
    effectLabel: typeof record.effectLabel === "string" ? record.effectLabel : (typeof record.label === "string" ? record.label : ""),
    label: typeof record.label === "string" ? record.label : (typeof record.effectLabel === "string" ? record.effectLabel : ""),
    effectType: typeof record.effectType === "string" ? record.effectType : "",
    resource: typeof record.resource === "string" ? record.resource : "",
    mode: typeof record.mode === "string" ? record.mode : "",
    value: Number.isFinite(Number(record.value)) ? Number(record.value) : null,
    actorId: typeof record.actorId === "string" ? record.actorId : "",
    actorName: typeof record.actorName === "string" ? record.actorName : "",
    beforeValue: Number.isFinite(Number(record.beforeValue)) ? Number(record.beforeValue) : null,
    afterValue: Number.isFinite(Number(record.afterValue)) ? Number(record.afterValue) : null,
    appliedAt: typeof record.appliedAt === "string" ? record.appliedAt : "",
    appliedByUserId: typeof record.appliedByUserId === "string" ? record.appliedByUserId : "",
    appliedByUserName: typeof record.appliedByUserName === "string" ? record.appliedByUserName : "",
    source: record.source === "travel-event-runner" ? "travel-event-runner" : "travel-event-runner",
    undone: record.undone === true,
    undoneAt: typeof record.undoneAt === "string" ? record.undoneAt : "",
    undoneByUserId: typeof record.undoneByUserId === "string" ? record.undoneByUserId : "",
    undoneByUserName: typeof record.undoneByUserName === "string" ? record.undoneByUserName : "",
    undoBeforeValue: Number.isFinite(Number(record.undoBeforeValue)) ? Number(record.undoBeforeValue) : null,
    undoAfterValue: Number.isFinite(Number(record.undoAfterValue)) ? Number(record.undoAfterValue) : null,
    undoReason: typeof record.undoReason === "string" ? record.undoReason : ""
  })) : [];
  return { records };
}

function prepareStationRows(session, round, roundResult, options = {}) {
  const assignments = normalizeTravelEventRunnerStationAssignments(session?.stationAssignments);
  const hazardModifiers = prepareTravelV2ActiveHazardModifiers(session, { ...options, roundIndex: roundResult?.roundIndex ?? session?.currentRoundIndex ?? 0 });
  return round.activeStations.map((stationKey) => {
    const station = getStation(stationKey) ?? {};
    const prompt = round.stationPrompts[stationKey] ?? { stationKey };
    const card = (Array.isArray(round.stationCards) ? round.stationCards : []).find((entry) => entry?.stationKey === stationKey) ?? normalizeStationCardForRunner(stationKey, null, prompt);
    const suggestedSkills = Array.isArray(prompt.suggestedSkills) && prompt.suggestedSkills.length > 0
      ? prompt.suggestedSkills
      : (Array.isArray(station.primarySkills) ? station.primarySkills : []);
    const result = roundResult?.stationResults?.[stationKey] ?? null;
    const assignment = assignments[stationKey] ?? emptyStationAssignment();
    const assignedActor = getActorByAssignment(assignment, options);
    const assigned = Boolean(assignment.actorId || assignment.actorUuid || assignment.actorName);
    const eventApproachSelection = resolveStationApproachSelection(roundResult, stationKey, card, suggestedSkills);
    const storedSkill = typeof roundResult?.selectedStationSkills?.[stationKey] === "string" ? roundResult.selectedStationSkills[stationKey] : "";
    const selectedAction = normalizeTravelStationAction(roundResult?.stationActions?.[stationKey], stationKey, round);
    const stabilizePressureKey = selectedAction.stabilizePressureKey || getTravelStationStabilizePressureKey(stationKey, round);
    const stabilizePressure = getTravelPressureIdentity(stabilizePressureKey);
    const pendingStabilize = selectedAction.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.STABILIZE
      ? getPendingTravelStabilizeEffect(result, stabilizePressureKey)
      : null;
    const stationOrderCommitment = normalizeStationOrderCommitments(roundResult, round)[stationKey];
    const stationFocus = prepareTravelStationFocusState(session, stationKey, roundResult?.roundIndex ?? session?.currentRoundIndex ?? 0, options);
    const committedFocusAbility = getDefaultStationFocusAbilities(stationKey, options).find((ability) => ability.key === stationOrderCommitment.selectedFocusAbility);
    const eventOptions = eventApproachSelection.options.map((approach) => ({
      ...approach,
      optionKey: stationOptionKey(ARCFLIGHT_TRAVEL_STATION_ACTIONS.EVENT_APPROACH, approach.skill),
      actionType: ARCFLIGHT_TRAVEL_STATION_ACTIONS.EVENT_APPROACH,
      stabilizePressureKey: ""
    }));
    const stabilizeOptions = normalizeCustomStabilizeOptions(card, stationKey, round, assignedActor);
    const supportOptions = (Array.isArray(round?.activeStations) ? round.activeStations : [])
      .filter((targetStationKey) => targetStationKey && targetStationKey !== stationKey)
      .map((targetStationKey) => {
        const targetStation = getStation(targetStationKey);
        const targetName = targetStation?.displayName || targetStation?.name || humanizeIdentifier(targetStationKey);
        return {
          optionKey: supportStationOptionKey(targetStationKey),
          actionType: ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT,
          skill: eventApproachSelection.skill,
          supportKey: "assist",
          supportMode: "assist",
          label: `Support ${targetName}`,
          helpText: "Create a session-local assist for another station on success. Does not add main objective progress.",
          targetStationKey,
          targetStationName: targetName
        };
      });
    const hazardResponseOptions = hazardModifiers.responseActions
      .filter((action) => action.stationKey === stationKey || action.stationKey === "any")
      .map((action) => ({
        ...action,
        optionKey: stationOptionKey("hazardResponse", `${action.hazardRecordId}-${action.key}-${stationKey}`),
        value: stationOptionKey("hazardResponse", `${action.hazardRecordId}-${action.key}-${stationKey}`),
        actionType: "hazardResponse",
        label: `${action.hazardName}: ${action.label}`,
        dc: Number.isFinite(Number(card.dc)) ? Number(card.dc) : null,
        hazardRecordId: action.hazardRecordId,
        hazardName: action.hazardName
      }));
    const stationOptions = [...eventOptions, ...stabilizeOptions, ...supportOptions, ...hazardResponseOptions].map((option) => {
      const hazardDc = hazardModifiers.dcModifiers
        .filter((modifier) => (!modifier.stationKey || modifier.stationKey === stationKey) && (!modifier.actionType || modifier.actionType === option.actionType))
        .reduce((sum, modifier) => sum + (Number(modifier.modifier) || 0), 0);
      const suppressedByHazard = hazardModifiers.suppressions.some((suppression) => (!suppression.stationKey || suppression.stationKey === stationKey) && suppression.match.some((needle) => `${option.optionKey} ${option.label} ${option.helpText}`.toLowerCase().includes(needle)));
      const baseDc = Number.isFinite(Number(option.dc)) ? Number(option.dc) : null;
      return {
      ...option,
      dc: baseDc == null ? baseDc : baseDc + hazardDc,
      hazardDcModifier: hazardDc,
      suppressedByHazard,
      disabled: suppressedByHazard,
      unavailable: suppressedByHazard,
      hazardModifierText: hazardDc ? `Hazard DC ${hazardDc >= 0 ? "+" : ""}${hazardDc}` : "",
      selected: option.actionType === selectedAction.type
        && option.skill === (storedSkill || eventApproachSelection.skill)
        && (option.actionType !== ARCFLIGHT_TRAVEL_STATION_ACTIONS.STABILIZE || option.stabilizePressureKey === stabilizePressureKey)
        && (option.actionType !== ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT || option.targetStationKey === selectedAction.targetStationKey)
      };
    });
    const selectedStationOption = stationOptions.find((option) => option.selected) ?? stationOptions.find((option) => option.actionType === selectedAction.type) ?? stationOptions[0] ?? null;
    const selectedApproach = {
      ...eventApproachSelection,
      skill: selectedStationOption?.skill || eventApproachSelection.skill,
      label: selectedStationOption?.label || eventApproachSelection.label,
      helpText: selectedStationOption?.helpText || eventApproachSelection.helpText,
      selected: selectedStationOption?.actionType === ARCFLIGHT_TRAVEL_STATION_ACTIONS.STABILIZE
        ? cloneData(selectedStationOption)
        : eventApproachSelection.selected,
      isSelected: Boolean(storedSkill),
      options: eventApproachSelection.options
    };
    return {
      stationKey,
      stationName: card.stationName || prompt.stationName || station.displayName || station.name || humanizeIdentifier(stationKey),
      prompt: prompt.playerAction || prompt.vignette || "No station prompt provided.",
      promptData: prompt,
      vignette: prompt.vignette || "",
      stationCard: card,
      problem: card.problem || prompt.playerAction || prompt.vignette || "No station card problem provided.",
      skillApproaches: selectedApproach.options,
      rollFeedback: card.rollFeedback ?? {},
      suggestedSkills,
      suggestedSkillsLabel: suggestedSkills.map(humanizeIdentifier).join(", "),
      assignment,
      assigned,
      assignedActorName: assigned ? (assignment.actorName || "Unknown Actor") : "Unassigned",
      assignmentSourceLabel: assignment.source === "ship" ? "Ship" : (assignment.source === "override" ? "Temporary Override" : (assignment.source === "manual" ? "Manual" : "Empty")),
      selectedApproach,
      selectedAction,
      selectedActionType: selectedAction.type,
      selectedActionLabel: selectedAction.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.STABILIZE ? "Stabilize" : (selectedAction.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.HAZARD_RESPONSE ? "Respond to Hazard" : (selectedAction.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT ? "Support" : "Push Forward")),
      supportTargetStationKey: selectedAction.targetStationKey || "",
      supportTargetStationName: selectedAction.targetStationKey ? stationNameForRound(round, selectedAction.targetStationKey) : "",
      supportTargetOptions: round.activeStations.filter((key) => key !== stationKey).map((key) => ({ stationKey: key, stationName: stationNameForRound(round, key), selected: key === selectedAction.targetStationKey })),
      selectedStationOption,
      selectedStationOptionKey: selectedStationOption?.optionKey ?? "",
      selectedStationOptionLabel: roundResult?.selectedStationOptionLabels?.[stationKey] || selectedStationOption?.label || "",
      stationOptions,
      stationOrderCommitted: stationOrderCommitment.committed,
      stationOrderCommitmentSource: stationOrderCommitment.source,
      selectedFocusAbility: committedFocusAbility?.label ?? "",
      selectedFocusAbilityKey: stationOrderCommitment.selectedFocusAbility,
      focusRemaining: stationFocus.focusRemaining,
      focusCapacity: stationFocus.focusCapacity,
      focusSuppressedByHazard: hazardModifiers.suppressFocus,
      focusSuppression: hazardModifiers.focusSuppression,
      activeHazardModifiers: hazardModifiers.publicHazards,
      isEventApproach: selectedAction.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.EVENT_APPROACH,
      isStabilize: selectedAction.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.STABILIZE,
      isHazardResponse: selectedAction.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.HAZARD_RESPONSE,
      isSupport: selectedAction.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT,
      stabilizePressureKey,
      stabilizePressureLabel: stabilizePressure?.label ?? humanizeIdentifier(stabilizePressureKey),
      pendingStabilize,
      pendingStabilizeReduction: pendingStabilize?.reduction ?? 0,
      pendingStabilizeDelta: pendingStabilize?.pendingDelta ?? 0,
      hasStabilizeComplication: pendingStabilize?.complication === true,
      selectedSkill: selectedApproach.skill,
      selectedSkillLabel: selectedApproach.skill ? humanizeIdentifier(selectedApproach.skill) : "No rollable statistic found",
      statisticLabel: resolveSafeStatisticLabel(assignedActor, [selectedApproach.skill]),
      result,
      resultLabel: result ? (result === "skipped" ? "Skipped / Not Participating" : humanizeIdentifier(result)) : "Unrecorded",
      resultFeedback: result ? (selectedApproach.selected?.boardResultFeedback?.[result] || card.visibleResultFeedback?.[result] || card.rollFeedback?.[result] || "") : "",
      rollDetailText: session?.playerMissionBoardRollDetails?.[stationKey] || "",
      gmNarrationFeedback: result ? (selectedApproach.selected?.gmNarrationFeedback?.[result] || selectedApproach.selected?.boardResultFeedback?.[result] || card.visibleResultFeedback?.[result] || card.rollFeedback?.[result] || "") : "",
      gmOnlyConsequence: result ? (selectedApproach.selected?.gmOnlyConsequence || card.gmOnlyConsequence || "") : "",
      hasResultFeedback: Boolean(result && (selectedApproach.selected?.boardResultFeedback?.[result] || card.visibleResultFeedback?.[result] || card.rollFeedback?.[result])),
      hasGmOnlyConsequence: Boolean(result && (selectedApproach.selected?.gmOnlyConsequence || card.gmOnlyConsequence)),
      qualityWarnings: [...(card.qualityWarnings ?? []), ...(selectedApproach.selected?.qualityWarnings ?? [])],
      resultOptions: TRAVEL_EVENT_RUNNER_RESULT_VALUES.map((value) => ({ value, label: value === "skipped" ? "Skip Station" : humanizeIdentifier(value), selected: value === result })),
      stationStateLabel: deriveTravelStationStateLabel({ result, assigned, stationOrderCommitted: stationOrderCommitment.committed, pendingReaction: (session?.reactionPrompts?.records ?? []).some((record) => record.stationKey === stationKey && record.roundIndex === (roundResult?.roundIndex ?? session?.currentRoundIndex ?? 0) && record.status === "pending") })
    };
  });
}

function resultTone(row) {
  if (["success", "criticalSuccess"].includes(row?.result)) return "success";
  if (["failure", "criticalFailure"].includes(row?.result)) return "failure";
  return "neutral";
}

function roundOutcomeKeyFromScore(score) {
  if (score >= 4) return "criticalRoundSuccess";
  if (score >= 1) return "roundSuccess";
  if (score === 0) return "narrowRoundSuccess";
  if (score <= -4) return "criticalRoundFailure";
  return "roundFailure";
}

function cleanActionPhrase(label = "") {
  const text = String(label ?? "").trim();
  if (!text) return "answers the station problem";
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function hasSentencePunctuation(text = "") {
  return /[.!?][\s”’"]*$/.test(String(text ?? "").trim());
}

function stripLeadingActorName(text, actorName) {
  const escaped = String(actorName ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escaped ? String(text ?? "").replace(new RegExp(`^${escaped}\\s+`, "i"), "") : String(text ?? "");
}

function buildStationNarrationSentence(row) {
  const actorName = row.assignedActorName && row.assignedActorName !== "Unassigned" ? row.assignedActorName : "Unassigned crew";
  const stationName = row.stationName || humanizeIdentifier(row.stationKey);
  const leadIn = `${actorName}, the ${stationName},`;
  const feedback = stripLeadingActorName(String(row.gmNarrationFeedback || row.resultFeedback || "").trim(), actorName).trim();
  if (feedback) {
    const body = hasSentencePunctuation(feedback) ? feedback : `${feedback}.`;
    return `${leadIn} ${body.charAt(0).toLowerCase()}${body.slice(1)}`;
  }
  const action = cleanActionPhrase(row.selectedApproach?.label || row.selectedSkillLabel);
  if (["success", "criticalSuccess"].includes(row.result)) return `${leadIn} ${action} and opens a way through the station problem.`;
  if (["failure", "criticalFailure"].includes(row.result)) return `${leadIn} ${action}, but pressure still gathers around the station.`;
  return `${leadIn} ${action}.`;
}

function buildTravelEventRunnerRoundSummaryText(stationRows, _successCount, _failureCount, _roundOutcomeKey = "narrowRoundSuccess", scriptedNarration = "") {
  const resolvedRows = (Array.isArray(stationRows) ? stationRows : []).filter((row) => Boolean(row.result));
  if (resolvedRows.length === 0) return scriptedNarration || "";
  const orderedRows = [...resolvedRows].sort((a, b) => {
    const toneRank = { criticalFailure: 0, failure: 1, skipped: 2, success: 3, criticalSuccess: 4 };
    return (toneRank[a.result] ?? 2) - (toneRank[b.result] ?? 2);
  });
  const outcomeText = orderedRows.map(buildStationNarrationSentence).join(" ");
  return [scriptedNarration, outcomeText].filter((entry) => typeof entry === "string" && entry.trim().length > 0).join(" ");
}

export function prepareTravelEventRunnerRoundSummaryCard(session, round, roundResult, options = {}) {
  if (!session || !round || !roundResult) {
    return {
      hasResolvedStations: false,
      resolvedStationCount: 0,
      unresolvedStationCount: 0,
      successCount: 0,
      failureCount: 0,
      summaryLines: [],
      summaryText: ""
    };
  }
  const stationRows = prepareStationRows(session, round, roundResult, options);
  const resolvedRows = stationRows.filter((row) => Boolean(row.result));
  const objectiveRows = resolvedRows.filter((row) => row.isEventApproach);
  const stabilizeRows = resolvedRows.filter((row) => row.isStabilize);
  const hazardResponseRows = resolvedRows.filter((row) => row.isHazardResponse);
  const supportRows = resolvedRows.filter((row) => row.isSupport);
  const unresolvedRows = stationRows.filter((row) => !row.result);
  const successCount = objectiveRows.filter((row) => ["success", "criticalSuccess"].includes(row.result)).length;
  const failureCount = objectiveRows.filter((row) => ["failure", "criticalFailure"].includes(row.result)).length;
  const unresolvedStationCount = stationRows.length - resolvedRows.length;
  const summaryLines = resolvedRows.map((row) => {
    const actorName = row.assignedActorName && row.assignedActorName !== "Unassigned" ? row.assignedActorName : "Unassigned crew";
    const approachLabel = row.selectedApproach?.label || row.selectedSkillLabel || "an approach";
    const feedback = row.resultFeedback ? ` ${row.resultFeedback}` : "";
    const complication = row.hasGmOnlyConsequence ? ` GM complication: ${row.gmOnlyConsequence}` : "";
    return `${actorName} at ${row.stationName} used ${approachLabel} and scored ${row.resultLabel}.${feedback}${complication}`;
  });
  const roundScore = objectiveRows.reduce((sum, row) => sum + (RESULT_SCORES[row.result] ?? 0), 0);
  const roundOutcomeKey = roundOutcomeKeyFromScore(roundScore);
  const summaryText = buildTravelEventRunnerRoundSummaryText(stationRows, successCount, failureCount, roundOutcomeKey, round?.roundEndNarration?.[roundOutcomeKey] || "");
  const unresolvedStationNames = unresolvedRows.map((row) => row.stationName || humanizeIdentifier(row.stationKey));
  const unresolvedStationText = unresolvedStationNames.length > 0 ? `Unresolved: ${unresolvedStationNames.join(", ")}.` : "";
  const gmOnlyComplicationText = resolvedRows.filter((row) => row.hasGmOnlyConsequence).map((row) => `${row.stationName || humanizeIdentifier(row.stationKey)}: ${row.gmOnlyConsequence}`).join(" ");
  if (resolvedRows.length > 0) summaryLines.push(`Round state: ${successCount} objective success-side results, ${failureCount} objective failure-side results, ${stabilizeRows.length} stabilizer${stabilizeRows.length === 1 ? "" : "s"}, ${hazardResponseRows.length} hazard responder${hazardResponseRows.length === 1 ? "" : "s"}, ${supportRows.length} supporter${supportRows.length === 1 ? "" : "s"}, ${unresolvedStationCount} unresolved stations. Weighted objective score ${roundScore}: ${ROUND_RESULT_LABELS[roundOutcomeKey]}.`);
  return {
    hasResolvedStations: resolvedRows.length > 0,
    resolvedStationCount: resolvedRows.length,
    unresolvedStationCount,
    successCount,
    failureCount,
    objectiveContributorCount: objectiveRows.length,
    objectiveContributors: objectiveRows.map((row) => row.stationKey),
    stabilizerCount: stabilizeRows.length,
    stabilizers: stabilizeRows.map((row) => row.stationKey),
    hazardResponderCount: hazardResponseRows.length,
    hazardResponders: hazardResponseRows.map((row) => row.stationKey),
    supporterCount: supportRows.length,
    supporters: supportRows.map((row) => ({ stationKey: row.stationKey, targetStationKey: row.supportTargetStationKey, targetStationName: row.supportTargetStationName })),
    unresolvedStations: unresolvedRows.map((row) => row.stationKey),
    roundScore,
    roundOutcomeKey,
    roundOutcomeLabel: ROUND_RESULT_LABELS[roundOutcomeKey],
    summaryLines,
    cinematicSummaryText: summaryText,
    unresolvedStationText,
    gmOnlyComplicationText,
    summaryText
  };
}

function getGameSettingRunnerSessionLibrary() {
  const settings = globalThis.game?.settings;
  if (!settings || typeof settings.get !== "function") return null;
  try {
    return settings.get(ARCFLIGHT_MODULE_ID, TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING);
  } catch (_error) {
    return null;
  }
}

async function setGameSettingRunnerSessionLibrary(library) {
  const settings = globalThis.game?.settings;
  if (!settings || typeof settings.set !== "function") throw new Error("Foundry game.settings is not available for the Travel Event Runner Session library.");
  return settings.set(ARCFLIGHT_MODULE_ID, TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING, cloneData(library));
}

function buildRunnerLibraryResult(ok, data = {}) {
  return {
    ok: Boolean(ok),
    errors: Array.isArray(data.errors) ? data.errors : [],
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    ...data
  };
}

function createUniqueRunnerSessionKey(library, seed, options = {}) {
  const sessions = library?.sessions ?? {};
  const base = slugifySessionKey(seed || "travel-event-runner-session");
  if (!Object.hasOwn(sessions, base)) return base;

  const timestamp = nowIso(options).replace(/[^0-9]/g, "").slice(0, 14);
  const timestamped = `${base}-${timestamp}`;
  if (!Object.hasOwn(sessions, timestamped)) return timestamped;

  let index = 2;
  while (Object.hasOwn(sessions, `${timestamped}-${index}`)) index += 1;
  return `${timestamped}-${index}`;
}

function normalizeRunnerSessionLibraryEntry(key, entry = {}, options = {}) {
  const fallbackTimestamp = nowIso(options);
  const source = isPlainObject(entry) ? entry : {};
  const normalizedSession = normalizeTravelEventRunnerSession(isPlainObject(source.session) ? source.session : source, options);
  const session = normalizedSession.session;
  const event = session?.event ?? {};
  const status = ["active", "completed"].includes(source.status) ? source.status : (session?.status ?? "active");
  const entryKey = typeof source.key === "string" && source.key.length > 0 ? source.key : key;
  if (session && !session.key) session.key = entryKey;

  return {
    key: entryKey,
    name: typeof source.name === "string" && source.name.length > 0 ? source.name : (event.name ? `${event.name} Session` : entryKey),
    eventKey: typeof source.eventKey === "string" ? source.eventKey : (event.key ?? ""),
    eventName: typeof source.eventName === "string" && source.eventName.length > 0 ? source.eventName : (event.name ?? ""),
    eventCategory: typeof source.eventCategory === "string" ? source.eventCategory : (event.category ?? ""),
    status,
    currentRoundIndex: Number.isInteger(Number(source.currentRoundIndex)) ? Number(source.currentRoundIndex) : (session?.currentRoundIndex ?? 0),
    startedAt: typeof source.startedAt === "string" && source.startedAt.length > 0 ? source.startedAt : (session?.startedAt ?? fallbackTimestamp),
    completedAt: typeof source.completedAt === "string" ? source.completedAt : (session?.completedAt ?? ""),
    updatedAt: typeof source.updatedAt === "string" && source.updatedAt.length > 0 ? source.updatedAt : (session?.updatedAt ?? fallbackTimestamp),
    session: session ? cloneData(session) : null,
    isMalformed: normalizedSession.ok !== true,
    validationErrors: normalizedSession.errors ?? [],
    validationWarnings: normalizedSession.warnings ?? []
  };
}

function normalizeTravelEventRunnerSessionLibraryData(rawLibrary, options = {}) {
  const source = isPlainObject(rawLibrary) ? rawLibrary : {};
  const sourceSessions = isPlainObject(source.sessions) ? source.sessions : {};
  const sessions = {};
  for (const [key, entry] of Object.entries(sourceSessions)) {
    if (typeof key !== "string" || key.length === 0) continue;
    sessions[key] = normalizeRunnerSessionLibraryEntry(key, entry, options);
  }
  return {
    version: Number.isInteger(source.version) ? source.version : TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_VERSION,
    sessions
  };
}

function getRunnerSessionLibraryEntries(library) {
  return Object.values(library.sessions ?? {}).sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")) || String(a.name ?? "").localeCompare(String(b.name ?? "")));
}

function findRunnerSessionLibraryEntry(library, sessionKey) {
  const key = String(sessionKey ?? "");
  return library.sessions?.[key] ?? getRunnerSessionLibraryEntries(library).find((candidate) => candidate.key === key) ?? null;
}


function safeRunnerSessionRoundIndex(session = {}) {
  try {
    const roundIndex = Number(session?.currentRoundIndex);
    return Number.isInteger(roundIndex) && roundIndex >= 0 ? roundIndex : 0;
  } catch (_error) {
    return 0;
  }
}

function normalizeRunnerSessionOrderStationKey(entry) {
  const stationKey = normalizeStationKey(entry);
  return TRAVEL_FIVE_STATION_KEYS.includes(stationKey) ? stationKey : "";
}

function getRunnerSessionCurrentRoundOrderRecord(session = {}) {
  const roundIndex = safeRunnerSessionRoundIndex(session);
  const state = isPlainObject(session?.travelV2RoundActionOrder) ? session.travelV2RoundActionOrder : {};
  const rounds = isPlainObject(state.rounds) ? state.rounds : {};
  const record = rounds[String(roundIndex)] ?? rounds[roundIndex] ?? null;
  const orderSource = Array.isArray(record?.order) ? record.order : (Array.isArray(record?.stationOrder) ? record.stationOrder : []);
  const order = orderSource.map(normalizeRunnerSessionOrderStationKey).filter(Boolean);
  return { roundIndex, record: isPlainObject(record) ? record : null, order };
}

function runnerSessionStationLabel(session = {}, stationKey = "") {
  const roundIndex = safeRunnerSessionRoundIndex(session);
  const round = Array.isArray(session?.event?.rounds) && isPlainObject(session.event.rounds[roundIndex]) ? session.event.rounds[roundIndex] : {};
  const prompt = isPlainObject(round.stationPrompts?.[stationKey]) ? round.stationPrompts[stationKey] : {};
  const station = getStation(stationKey) ?? {};
  return prompt.stationName || prompt.label || station.displayName || station.name || humanizeIdentifier(stationKey);
}

export function prepareTravelV2RoundActionOrderLibraryStatus(session = null, options = {}) {
  const isGm = options.user?.isGM === true || options.isGM === true;
  if (!isPlainObject(session)) return Object.freeze({ statusLabel: "No committed order saved", ...(isGm ? { roundNumber: null, stationLabelText: "" } : {}) });
  const { roundIndex, record, order } = getRunnerSessionCurrentRoundOrderRecord(session);
  const hasCommittedOrder = Boolean(record && order.length > 0);
  const statusLabel = hasCommittedOrder ? "Committed order saved" : "No committed order saved";
  if (!isGm) return Object.freeze({ statusLabel });
  const round = Array.isArray(session.event?.rounds) ? session.event.rounds[roundIndex] : null;
  const roundNumber = hasCommittedOrder ? (Number.isInteger(Number(record?.roundNumber)) ? Number(record.roundNumber) : (Number.isInteger(Number(round?.roundNumber)) ? Number(round.roundNumber) : roundIndex + 1)) : null;
  const stationLabels = hasCommittedOrder ? order.map((stationKey) => runnerSessionStationLabel(session, stationKey)) : [];
  return Object.freeze({ statusLabel, roundNumber, stationLabelText: stationLabels.join(" → ") });
}

function publishedEventExistsForSession(entry, options = {}) {
  const eventKey = entry?.eventKey ?? entry?.session?.event?.key ?? "";
  if (!eventKey) return false;
  const library = getPublishedTravelEventLibrary(Object.hasOwn(options, "publishedLibrary") ? { ...options, library: options.publishedLibrary } : options);
  return Object.values(library.events ?? {}).some((candidate) => candidate.id === eventKey || candidate.key === eventKey);
}

export function cloneTravelEventRunnerSession(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  return { ok: true, errors: [], warnings: normalized.warnings, session: cloneData(normalized.session) };
}

export function getTravelEventRunnerSessionLibrary(options = {}) {
  const rawLibrary = Object.hasOwn(options, "runnerSessionLibrary") ? options.runnerSessionLibrary : (Object.hasOwn(options, "library") ? options.library : getGameSettingRunnerSessionLibrary());
  return normalizeTravelEventRunnerSessionLibraryData(rawLibrary, options);
}

export async function saveTravelEventRunnerSessionToLibrary(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  const library = getTravelEventRunnerSessionLibrary(options);
  if (!normalized.ok || !normalized.session) return buildRunnerLibraryResult(false, { errors: normalized.errors, warnings: normalized.warnings, library, entry: null, session: null });

  const overwrite = options.overwrite === true;
  const explicitKey = typeof options.key === "string" && options.key.length > 0 ? options.key : (typeof normalized.session.key === "string" && normalized.session.key.length > 0 ? normalized.session.key : "");
  const key = explicitKey || createUniqueRunnerSessionKey(library, `${normalized.session.event.key || normalized.session.event.name}-${nowIso(options)}`, options);
  if (Object.hasOwn(library.sessions, key) && !overwrite) {
    return buildRunnerLibraryResult(false, { errors: [`Runner session "${key}" already exists; pass overwrite: true or use Save Current Session As.`], warnings: [], library, entry: cloneData(library.sessions[key]), session: cloneData(normalized.session) });
  }

  const timestamp = nowIso(options);
  const existing = library.sessions[key] ?? null;
  const nextSession = cloneData(normalized.session);
  nextSession.key = key;
  nextSession.name = typeof options.name === "string" && options.name.length > 0 ? options.name : (existing?.name ?? nextSession.name ?? `${nextSession.event.name} Session`);
  nextSession.updatedAt = timestamp;
  if (nextSession.status === "completed" && !nextSession.summary) nextSession.summary = summarizeTravelEventRunnerSession(nextSession, options).summary;

  const entry = {
    key,
    name: nextSession.name,
    eventKey: nextSession.event.key,
    eventName: nextSession.event.name,
    eventCategory: nextSession.event.category,
    status: nextSession.status,
    currentRoundIndex: nextSession.currentRoundIndex,
    startedAt: nextSession.startedAt,
    completedAt: nextSession.completedAt,
    updatedAt: timestamp,
    session: nextSession
  };

  const nextLibrary = { ...library, version: TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_VERSION, sessions: { ...library.sessions, [key]: entry } };
  if (!options.dryRun) await setGameSettingRunnerSessionLibrary(nextLibrary);
  return buildRunnerLibraryResult(true, { warnings: [], library: nextLibrary, entry: cloneData(entry), session: cloneData(nextSession) });
}

function committedRoundActionOrderRecord(session) {
  const state = isPlainObject(session?.travelV2RoundActionOrder) ? session.travelV2RoundActionOrder : null;
  const roundIndex = Number.isInteger(Number(session?.currentRoundIndex)) ? Number(session.currentRoundIndex) : -1;
  const record = isPlainObject(state?.rounds) ? (state.rounds[String(roundIndex)] ?? state.rounds[roundIndex] ?? null) : null;
  if (!isPlainObject(record) || !Array.isArray(record.order ?? record.stationOrder)) return null;
  return { roundIndex, state: cloneData(state), record: cloneData(record) };
}

function orderPersistenceResult(ok, data = {}) {
  const blockedReasons = Array.isArray(data.blockedReasons) ? data.blockedReasons : [];
  const duplicate = data.duplicate === true;
  const persisted = ok === true && data.persisted === true;
  return {
    ...data,
    ok: ok === true,
    blocked: ok !== true,
    persisted,
    duplicate,
    blockedReasons,
    persistedRecord: data.persistedRecord ?? null,
    summaryText: typeof data.summaryText === "string" && data.summaryText.length > 0 ? data.summaryText : (ok ? (duplicate ? "Committed round action order was already persisted; no saved session data changed." : "Committed round action order was persisted to the saved runner session.") : (blockedReasons[0] ?? "Committed round action order persistence was blocked."))
  };
}

export async function persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary(session, options = {}) {
  const isGm = options.user?.isGM === true || options.isGM === true;
  const persistRequested = options.persistRequested === true || options.travelV2RoundActionOrderPersistRequested === true;
  const blockedReasons = [];
  if (!isGm) blockedReasons.push("Only the GM can persist committed round action order.");
  if (!persistRequested) blockedReasons.push("Explicit round action-order persist request is required.");
  if (!isPlainObject(session)) blockedReasons.push("Travel v2 runner session is required.");
  const committed = isPlainObject(session) ? committedRoundActionOrderRecord(session) : null;
  if (isPlainObject(session) && !committed) blockedReasons.push("Travel v2 runner session has no committed round action order to persist.");
  if (blockedReasons.length > 0) return orderPersistenceResult(false, { blockedReasons, persistedRecord: null, session: isGm && isPlainObject(session) ? cloneData(session) : null });

  const library = getTravelEventRunnerSessionLibrary(options);
  const key = typeof options.key === "string" && options.key.length > 0 ? options.key : (typeof session.key === "string" ? session.key : "");
  const existingEntry = findRunnerSessionLibraryEntry(library, key);
  const savedSession = isPlainObject(existingEntry?.session) ? cloneData(existingEntry.session) : cloneData(session);
  const priorState = isPlainObject(savedSession.travelV2RoundActionOrder) ? savedSession.travelV2RoundActionOrder : null;
  if (JSON.stringify(priorState) === JSON.stringify(committed.state)) {
    return orderPersistenceResult(true, { persisted: false, duplicate: true, library: cloneData(library), entry: existingEntry ? cloneData(existingEntry) : null, session: cloneData(savedSession), persistedRecord: cloneData(committed.record) });
  }

  savedSession.travelV2RoundActionOrder = cloneData(committed.state);
  const saved = await saveTravelEventRunnerSessionToLibrary(savedSession, { ...options, key: key || savedSession.key, overwrite: true });
  if (!saved.ok) return orderPersistenceResult(false, { blockedReasons: saved.errors?.length ? saved.errors : ["Existing Travel Event Runner session save path blocked persistence."], warnings: saved.warnings ?? [], library: saved.library, entry: saved.entry ?? null, session: isGm ? saved.session ?? cloneData(savedSession) : null });
  return orderPersistenceResult(true, { persisted: true, duplicate: false, warnings: saved.warnings ?? [], library: saved.library, entry: saved.entry, session: saved.session, persistedRecord: cloneData(committed.record) });
}

function stationActionLockPersistenceResult(ok, data = {}) {
  const blockedReasons = Array.isArray(data.blockedReasons) ? data.blockedReasons : [];
  const duplicate = data.duplicate === true;
  const persisted = ok === true && data.persisted === true;
  return {
    ...data,
    ok: ok === true,
    blocked: ok !== true,
    persisted,
    duplicate,
    blockedReasons,
    summaryText: typeof data.summaryText === "string" && data.summaryText.length > 0
      ? data.summaryText
      : (ok ? (duplicate ? "Station action lock state was already persisted; no saved session data changed." : "Station action lock state was persisted to the saved runner session.") : (blockedReasons[0] ?? "Station action lock persistence was blocked."))
  };
}

export async function persistTravelV2StationActionLockInToRunnerSessionLibrary(session, options = {}) {
  const isGm = options.user?.isGM === true || options.isGM === true;
  const persistRequested = options.persistRequested === true || options.travelV2StationActionLockPersistRequested === true;
  const stationKey = typeof options.stationKey === "string" ? options.stationKey.trim() : "";
  const blockedReasons = [];
  if (!isGm) blockedReasons.push("Only the GM can persist station action lock state.");
  if (!persistRequested) blockedReasons.push("Explicit station action lock persist request is required.");
  if (!isPlainObject(session)) blockedReasons.push("Travel v2 runner session is required.");
  const normalized = isPlainObject(session) ? normalizeTravelEventRunnerSession(session, options) : null;
  if (normalized && (!normalized.ok || !normalized.session)) blockedReasons.push(...(normalized.errors?.length ? normalized.errors : ["Travel Event Runner session is invalid."]));
  const activeSession = normalized?.session ?? null;
  if (activeSession?.status === "completed") blockedReasons.push("Completed Travel Event Runner sessions cannot persist station action lock changes.");
  const roundIndex = Number.isInteger(Number(activeSession?.currentRoundIndex)) ? Number(activeSession.currentRoundIndex) : -1;
  const round = activeSession?.event?.rounds?.[roundIndex] ?? null;
  const roundResult = activeSession?.roundResults?.[roundIndex] ?? null;
  const stationOrder = Array.isArray(round?.activeStations) ? round.activeStations : [];
  if (!stationKey) blockedReasons.push("Station action lock persistence requires a station key.");
  else if (!stationOrder.includes(stationKey)) blockedReasons.push(`Invalid or inactive station key: ${stationKey}.`);
  else if (!roundResult?.stationActions?.[stationKey]) blockedReasons.push(`${formatTravelEventRunnerStationName(stationKey)} has no selected action to persist.`);
  if (blockedReasons.length > 0) return stationActionLockPersistenceResult(false, { blockedReasons, session: isGm && activeSession ? cloneData(activeSession) : null, stationKey });

  const library = getTravelEventRunnerSessionLibrary(options);
  const key = typeof options.key === "string" && options.key.length > 0 ? options.key : (typeof activeSession.key === "string" ? activeSession.key : "");
  const existingEntry = findRunnerSessionLibraryEntry(library, key);
  const savedSession = isPlainObject(existingEntry?.session) ? cloneData(existingEntry.session) : cloneData(activeSession);
  const nextCommitment = cloneData(activeSession.roundResults[roundIndex].stationOrderCommitments?.[stationKey] ?? {});
  const priorCommitment = savedSession.roundResults?.[roundIndex]?.stationOrderCommitments?.[stationKey] ?? null;
  if (JSON.stringify(priorCommitment) === JSON.stringify(nextCommitment)) {
    return stationActionLockPersistenceResult(true, { persisted: false, duplicate: true, library: cloneData(library), entry: existingEntry ? cloneData(existingEntry) : null, session: cloneData(savedSession), stationKey });
  }
  const nextSession = cloneData(savedSession);
  if (!Array.isArray(nextSession.roundResults)) nextSession.roundResults = [];
  if (!isPlainObject(nextSession.roundResults[roundIndex])) nextSession.roundResults[roundIndex] = {};
  nextSession.roundResults[roundIndex].stationOrderCommitments = { ...(nextSession.roundResults[roundIndex].stationOrderCommitments ?? {}), [stationKey]: nextCommitment };
  const saved = await saveTravelEventRunnerSessionToLibrary(nextSession, { ...options, key: key || nextSession.key, overwrite: true });
  if (!saved.ok) return stationActionLockPersistenceResult(false, { blockedReasons: saved.errors?.length ? saved.errors : ["Existing Travel Event Runner session save path blocked station action lock persistence."], warnings: saved.warnings ?? [], library: saved.library, entry: saved.entry ?? null, session: isGm ? saved.session ?? cloneData(nextSession) : null, stationKey });
  return stationActionLockPersistenceResult(true, { persisted: true, duplicate: false, warnings: saved.warnings ?? [], library: saved.library, entry: saved.entry, session: saved.session, stationKey });
}

export function loadTravelEventRunnerSessionFromLibrary(sessionKey, options = {}) {
  const library = getTravelEventRunnerSessionLibrary(options);
  const entry = findRunnerSessionLibraryEntry(library, sessionKey);
  if (!entry) return buildRunnerLibraryResult(false, { errors: [`No Travel Event Runner session found for "${String(sessionKey ?? "")}".`], warnings: [], library, entry: null, session: null });
  if (!entry.session || entry.isMalformed) return buildRunnerLibraryResult(false, { errors: entry.validationErrors?.length ? entry.validationErrors : [`Travel Event Runner session "${entry.key}" is malformed and cannot be loaded.`], warnings: entry.validationWarnings ?? [], library, entry: cloneData(entry), session: null });
  const normalized = normalizeTravelEventRunnerSession(entry.session, options);
  if (!normalized.ok) return buildRunnerLibraryResult(false, { errors: normalized.errors, warnings: normalized.warnings, library, entry: cloneData(entry), session: null });
  const session = cloneData(normalized.session);
  session.key = entry.key;
  const warnings = [...(normalized.warnings ?? [])];
  if (!publishedEventExistsForSession(entry, options)) warnings.push(`Saved runner session "${entry.name}" references published event "${entry.eventKey || entry.eventName || "<missing>"}", which is not currently in the Published Travel Event Library. Loading the saved session snapshot only.`);
  return buildRunnerLibraryResult(true, { warnings, library, entry: cloneData(entry), session });
}

export async function deleteTravelEventRunnerSessionFromLibrary(sessionKey, options = {}) {
  const library = getTravelEventRunnerSessionLibrary(options);
  const entry = findRunnerSessionLibraryEntry(library, sessionKey);
  if (!entry) return buildRunnerLibraryResult(false, { errors: [`No Travel Event Runner session found for "${String(sessionKey ?? "")}".`], warnings: [], library, deleted: null });
  const { [entry.key]: _deleted, ...remainingSessions } = library.sessions;
  const nextLibrary = { ...library, sessions: remainingSessions };
  if (!options.dryRun) await setGameSettingRunnerSessionLibrary(nextLibrary);
  return buildRunnerLibraryResult(true, { warnings: [], library: nextLibrary, deleted: cloneData(entry) });
}

export async function duplicateTravelEventRunnerSession(sessionKey, options = {}) {
  const loaded = loadTravelEventRunnerSessionFromLibrary(sessionKey, options);
  if (!loaded.ok || !loaded.session) return buildRunnerLibraryResult(false, { errors: loaded.errors, warnings: loaded.warnings, library: loaded.library, entry: null, session: null });
  const key = createUniqueRunnerSessionKey(loaded.library, `${loaded.entry?.key ?? sessionKey}-copy`, options);
  const session = cloneData(loaded.session);
  session.key = key;
  const name = typeof options.name === "string" && options.name.length > 0 ? options.name : `${loaded.entry?.name ?? session.event.name ?? key} Copy`;
  return saveTravelEventRunnerSessionToLibrary(session, { ...options, library: loaded.library, key, name, overwrite: false });
}

export function prepareTravelEventRunnerSessionLibraryState(options = {}) {
  const library = getTravelEventRunnerSessionLibrary(options);
  const selectedSessionKey = typeof options.selectedSessionKey === "string" ? options.selectedSessionKey : "";
  const entries = getRunnerSessionLibraryEntries(library).map((entry) => ({
    ...cloneData(entry),
    session: undefined,
    roundActionOrderLibraryStatus: prepareTravelV2RoundActionOrderLibraryStatus(entry.session, options),
    eventCategoryLabel: humanizeIdentifier(entry.eventCategory),
    statusLabel: humanizeIdentifier(entry.status),
    currentRoundNumber: Number(entry.currentRoundIndex ?? 0) + 1,
    updatedAtLabel: entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : "",
    startedAtLabel: entry.startedAt ? new Date(entry.startedAt).toLocaleString() : "",
    completedAtLabel: entry.completedAt ? new Date(entry.completedAt).toLocaleString() : "",
    canLoad: entry.isMalformed !== true && Boolean(entry.session),
    canDuplicate: entry.isMalformed !== true && Boolean(entry.session),
    canDelete: true,
    selected: selectedSessionKey ? entry.key === selectedSessionKey : false,
    missingPublishedEvent: !publishedEventExistsForSession(entry, options)
  }));
  return Object.freeze({
    settingKey: `${ARCFLIGHT_MODULE_ID}.${TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING}`,
    version: library.version,
    entries,
    count: entries.length,
    hasSessions: entries.length > 0,
    selectedSessionKey
  });
}

function prepareTravelFocusRiskSummary(stations = []) {
  const rows = (Array.isArray(stations) ? stations : []).map((station) => ({
    stationKey: station.stationKey,
    stationName: station.stationName,
    focusRemaining: station.focusRemaining,
    focusCapacity: station.focusCapacity,
    blocked: station.focusSuppressedByHazard === true,
    blockedReason: station.focusSuppression?.publicReasonText ?? "",
    blockedHazardName: station.focusSuppression?.hazardName ?? "",
    options: (station.focusOptions ?? []).map((option) => sanitizeTravelStationFocusOption(option, { stationKey: station.stationKey, roundIndex: station.currentRoundIndex ?? 0, used: option.used, noFocusRemaining: station.focusRemaining <= 0, spentThisRound: option.unavailable === true && option.used !== true, blocked: station.focusSuppressedByHazard === true, blockedReason: station.focusSuppression?.publicReasonText ?? "" }))
  }));
  return { rows, hasRows: rows.length > 0, blockedRows: rows.filter((row) => row.blocked), hasBlockedRows: rows.some((row) => row.blocked), mutationNote: DEFAULT_FOCUS_BACKLASH_PREVIEW_TEXT };
}


function makeCompletionChecklistRow({ key, label, status = "blocked", statusLabel = "Blocked", reason = "", targetHeading = "" } = {}) {
  return {
    key,
    label,
    status,
    statusLabel,
    ready: status === "ready",
    blocked: status === "blocked",
    done: status === "done",
    deferred: status === "deferred" || status === "reviewOnly",
    reason,
    targetHeading
  };
}

function hasReviewEntries(section = {}) {
  return section?.hasEntries === true || (Array.isArray(section?.entries) && section.entries.length > 0);
}

function completionChecklistUserIsGm(options = {}) {
  if (typeof options.user?.isGM === "boolean") return options.user.isGM === true;
  if (typeof options.isGM === "boolean") return options.isGM === true;
  return globalThis.game?.user?.isGM === true;
}

export function prepareTravelV2CompletionChecklistState(session = null, options = {}) {
  const isGM = completionChecklistUserIsGm(options);
  const hasSession = isPlainObject(session);
  if (!isGM) return { isGM: false, hasSession, visible: false, rows: [], safetyNote: "" };

  const isCompleted = hasSession && session.status === "completed";
  const summaryOutput = options.summaryOutput ?? prepareTravelEventRunnerSummaryOutputState(session, options);
  const finalOutcomePackageReview = options.finalOutcomePackageReview ?? prepareTravelV2FinalOutcomePackageReviewState(session, options);
  const finalOutcomeApply = options.finalOutcomeApply ?? prepareTravelV2FinalOutcomeApplyState(session, options);
  const summary = isCompleted ? (session.summary ?? summarizeTravelEventRunnerSession(session, options).summary) : null;
  const eventName = session?.event?.name ?? session?.travelV2CompletionSummary?.eventTitle ?? "No active event";
  const finalOutcomeLabel = summary?.suggestedFinalOutcomeLabel ?? session?.travelV2CompletionSummary?.finalOutcomeLabel ?? finalOutcomePackageReview?.eventOutcomeLabel ?? "Not determined";
  const completedAt = session?.completedAt ?? session?.travelV2CompletionSummary?.completedAt ?? "";

  const packageApplied = session?.travelV2EventOutcomeApplication?.applied === true || finalOutcomePackageReview?.alreadyApplied === true;
  const shipApplied = session?.travelV2FinalOutcomeShipApplication?.applied === true || finalOutcomeApply?.shipAlreadyApplied === true || finalOutcomeApply?.alreadyApplied === true;
  const hasDeferredParts = ["hazards", "shipScars", "fortunes", "rewards", "consequences"].some((key) => hasReviewEntries(finalOutcomePackageReview?.sections?.[key])) || (Array.isArray(finalOutcomeApply?.deferredRows) && finalOutcomeApply.deferredRows.length > 0);

  const rows = [
    makeCompletionChecklistRow({ key: "session-completed", label: "Session completion", status: isCompleted ? "done" : "blocked", statusLabel: isCompleted ? "Completed" : "Blocked", reason: isCompleted ? (completedAt ? `Completed at ${completedAt}.` : "Session is completed.") : (hasSession ? "Complete the Travel event before final completion actions are available." : "No Travel Event Runner session is active."), targetHeading: "Final Summary" }),
    makeCompletionChecklistRow({ key: "final-summary", label: "Final Summary", status: summary ? "ready" : "blocked", statusLabel: summary ? "Ready" : "Blocked", reason: summary ? "Final summary is available for review and copy/export." : "Final summary is not available until the session is completed.", targetHeading: "Final Summary" }),
    makeCompletionChecklistRow({ key: "final-outcome-package-review", label: "Final Outcome Package Review", status: finalOutcomePackageReview?.canPreparePackage ? "reviewOnly" : "blocked", statusLabel: finalOutcomePackageReview?.canPreparePackage ? "Review only" : "Blocked", reason: finalOutcomePackageReview?.canPreparePackage ? "Package can be reviewed; this does not update ship resources." : (finalOutcomePackageReview?.blockedReasons?.[0] ?? "Complete the session before reviewing the outcome package."), targetHeading: "Final Outcome Package Review" }),
    makeCompletionChecklistRow({ key: "package-level-application", label: "Package-level application", status: packageApplied ? "done" : (finalOutcomePackageReview?.canPreparePackage ? "deferred" : "blocked"), statusLabel: packageApplied ? "Already done" : (finalOutcomePackageReview?.canPreparePackage ? "Deferred" : "Blocked"), reason: packageApplied ? "Package-level outcome application record exists. This does not mean ship resources were updated." : (finalOutcomePackageReview?.canPreparePackage ? "Only the separate package-level Apply Outcome Package action can mark this done." : "Outcome package is not ready."), targetHeading: "Final Outcome Package Review" }),
    makeCompletionChecklistRow({ key: "final-outcome-ship-apply", label: "Final Outcome Ship Apply", status: shipApplied ? "done" : (finalOutcomeApply?.canApply ? "ready" : "blocked"), statusLabel: shipApplied ? "Already done" : (finalOutcomeApply?.canApply ? "Ready" : "Blocked"), reason: shipApplied ? "travelV2FinalOutcomeShipApplication.applied is true for ship resource updates." : (finalOutcomeApply?.canApply ? `Ready for ${finalOutcomeApply.targetActorName || "resolved target ship"}.` : (finalOutcomeApply?.disabledReason ?? "Ship application is unavailable.")), targetHeading: "Apply Final Outcome to Ship" }),
    makeCompletionChecklistRow({ key: "completed-summary-output", label: "Completed Summary Output", status: summaryOutput?.available ? "ready" : "blocked", statusLabel: summaryOutput?.available ? "Ready" : "Blocked", reason: summaryOutput?.available ? "Markdown/HTML copy controls are available." : (summaryOutput?.reason ?? "Completed summary output is unavailable."), targetHeading: "Completed Summary Output" }),
    makeCompletionChecklistRow({ key: "chat-export", label: "Post Summary to Chat", status: summaryOutput?.canPostChat ? "ready" : "blocked", statusLabel: summaryOutput?.canPostChat ? "Ready" : "Blocked", reason: summaryOutput?.postChatTitle ?? "Only GMs can post completed summaries when available.", targetHeading: "Completed Summary Output" }),
    makeCompletionChecklistRow({ key: "journal-export", label: "Create Journal Entry", status: summaryOutput?.canCreateJournal ? "ready" : "blocked", statusLabel: summaryOutput?.canCreateJournal ? "Ready" : "Blocked", reason: summaryOutput?.createJournalTitle ?? "Only GMs can create completed-summary journal entries when available.", targetHeading: "Completed Summary Output" }),
    makeCompletionChecklistRow({ key: "deferred-package-parts", label: "Deferred package parts", status: hasDeferredParts ? "deferred" : "ready", statusLabel: hasDeferredParts ? "Deferred" : "Ready", reason: hasDeferredParts ? "Ship scars, fortunes, hazards, rewards, or consequences remain review-only/deferred." : "No deferred package parts are currently listed.", targetHeading: "Final Outcome Package Review" })
  ];

  return {
    isGM,
    hasSession,
    visible: true,
    isCompleted,
    title: "GM Completion Checklist",
    statusLabel: !hasSession ? "No Session" : (isCompleted ? "Completed / Reopened Review" : "Active Session"),
    completedAt,
    eventName,
    finalOutcomeLabel,
    targetShipName: finalOutcomeApply?.targetActorName ?? session?.ship?.actorName ?? session?.ship?.name ?? "",
    shipApplyDisabledReason: finalOutcomeApply?.disabledReason ?? "",
    rows,
    hasRows: rows.length > 0,
    safetyNote: "No actor, item, chat, journal, combat, active-effect, socket, scene, token, compendium, or world changes occur unless the GM clicks a specific action button."
  };
}



const PLAYER_SAFE_RUNNER_OMIT_KEYS = new Set([
  "travelV2EventOutcomeApplication",
  "travelV2FinalOutcomeShipApplication",
  "travelV2ActorApplication",
  "travelV2PressureApplications",
  "travelV2RoundResolutions",
  "rawApplicationRecord",
  "packageRecord",
  "applicationRecord",
  "before",
  "after",
  "targetActorId",
  "targetActorUuid",
  "supportedRows",
  "unsupportedRows",
  "deferredRows",
  "resourceOptions",
  "debugReport",
  "auditRecord",
  "commitRecords",
  "userId",
  "userName",
  "gmText",
  "applyPayload",
  "targetActorUuid",
  "mutationScope",
  "internalMutation",
  "secret"
]);

function sanitizePlayerSafeRunnerStateValue(value) {
  if (typeof value === "string") {
    return value
      .replaceAll("GM-only", "restricted")
      .replaceAll("GM only", "restricted")
      .replaceAll("Apply Outcome Package", "Review Outcome");
  }
  if (Array.isArray(value)) return value.map((entry) => sanitizePlayerSafeRunnerStateValue(entry));
  if (!value || typeof value !== "object") return value;
  const next = {};
  for (const [key, entry] of Object.entries(value)) {
    if (PLAYER_SAFE_RUNNER_OMIT_KEYS.has(key) || key === "canManageTravelV2Consequences" || key.startsWith("consequenceFlow")) continue;
    next[key] = sanitizePlayerSafeRunnerStateValue(entry);
  }
  return next;
}

function runnerStateUserIsExplicitNonGm(options = {}) {
  if (options.user?.isGM === false) return true;
  if (options.isGM === false) return true;
  return globalThis.game?.user?.isGM === false;
}

function preparePlayerSafeRunnerSession(session = null, options = {}) {
  if (!session || typeof session !== "object") return session;
  if (!runnerStateUserIsExplicitNonGm(options)) return session;
  const safe = cloneData(session);
  delete safe.travelV2EventOutcomeApplication;
  delete safe.travelV2FinalOutcomeShipApplication;
  delete safe.travelV2ActorApplication;
  delete safe.travelV2PressureApplications;
  delete safe.travelV2RoundResolutions;
  return safe;
}


function formatTravelEventRunnerStationActionLockValidationMessage(entry = {}) {
  if (typeof entry === "string") return entry;
  if (typeof entry?.message === "string" && entry.message.trim()) return entry.message.trim();

  const stationKey = typeof entry?.stationKey === "string" ? entry.stationKey : "";
  const stationLabel = stationKey ? stationKey.replace(/[-_]+/g, " ") : "Station";

  switch (entry?.code) {
    case "invalidStationKey":
      return `Invalid station key: ${stationKey || "unknown"}.`;
    case "missingRequiredStation":
      return `Required station is missing: ${stationKey || "unknown"}.`;
    case "missingStationAction":
      return `${stationLabel}: missing station action.`;
    case "stationActionUnlocked":
      return `${stationLabel}: station action must be locked before resolution.`;
    case "resolveBeforeLockIn":
      return "Attempted resolution before lock-in: all required station actions must be selected and locked before resolution.";
    default:
      return "Station action lock-in is not ready.";
  }
}

function formatTravelEventRunnerStationActionLabel(action = null) {
  if (!action) return "No action selected";
  if (typeof action.label === "string" && action.label.trim()) return action.label.trim();
  if (typeof action.name === "string" && action.name.trim()) return action.name.trim();
  if (typeof action.actionLabel === "string" && action.actionLabel.trim()) return action.actionLabel.trim();
  if (typeof action.actionKey === "string" && action.actionKey.trim()) return action.actionKey.trim();
  if (typeof action.key === "string" && action.key.trim()) return action.key.trim();
  return "Selected action";
}

function formatTravelEventRunnerStationName(stationKey = "") {
  return stationKey
    ? stationKey.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Station";
}

function prepareTravelEventRunnerStationActionLockInRenderState(helperState = {}, options = {}) {
  const ready = helperState.readyToResolve === true || helperState.ready === true;
  const stationRows = Array.isArray(helperState.stations)
    ? helperState.stations
    : (helperState.stations && typeof helperState.stations === "object" ? Object.values(helperState.stations) : []);

  const canManageLocks = completionChecklistUserIsGm(options);
  const rows = stationRows.map((row) => {
    const action = row.action ?? null;
    const stationKey = row.stationKey ?? action?.stationKey ?? "";
    const actionKey = action?.actionKey ?? action?.key ?? "";
    const locked = row.locked === true;

    return {
      stationKey,
      stationName: formatTravelEventRunnerStationName(stationKey),
      stationPresent: true,
      action,
      actionKey,
      actionLabel: formatTravelEventRunnerStationActionLabel(action),
      hasAction: Boolean(action),
      locked,
      lockState: locked ? "locked" : "unlocked",
      lockStateLabel: locked ? "Locked" : "Unlocked",
      readinessLabel: action && locked ? "Ready" : "Not ready",
      message: !action ? "No action selected." : (!locked ? "Must be locked before resolution." : "Ready."),
      canLock: Boolean(action) && !locked && canManageLocks,
      canUnlock: Boolean(action) && locked && canManageLocks,
      lockActionLabel: "Lock Action",
      unlockActionLabel: "Unlock Action",
      lockDisabledReason: !action ? "Select a station action before locking." : (locked ? "Station action is already locked." : (canManageLocks ? "" : "Only the GM can lock this station action in the runner.")),
      unlockDisabledReason: !action ? "Select a station action before unlocking." : (!locked ? "Station action is not locked." : (canManageLocks ? "" : "Only the GM can unlock this station action in the runner."))
    };
  });

  const validationMessages = Array.isArray(helperState.validationErrors)
    ? helperState.validationErrors.map(formatTravelEventRunnerStationActionLockValidationMessage)
    : [];
  const firstChangedStationKey = rows.find((row) => row.hasAction)?.stationKey ?? "";

  return {
    ...helperState,
    rows,
    ready,
    statusLabel: ready ? "Ready to resolve" : "Not ready to resolve",
    readinessText: ready
      ? "Ready to resolve: all required station actions are selected and locked."
      : "Not ready: all required station actions must be selected and locked before resolution.",
    validationMessages,
    hasValidationMessages: validationMessages.length > 0,
    canPersist: canManageLocks && Boolean(firstChangedStationKey),
    firstChangedStationKey,
    persistenceStatus: options.travelV2StationActionLockPersistResult ?? null,
    blockedReason: ready ? "" : "Resolution requires all required station actions to be selected and locked."
  };
}

function prepareTravelEventRunnerStationActionLockInState(session = null, currentRound = null, currentRoundResult = null, options = {}) {
  const requiredStationKeys = ["captain", "navigator", "engineer", "veilwarden", "watchmaster"];
  const stationOrder = Array.isArray(currentRound?.activeStations) && currentRound.activeStations.length > 0
    ? currentRound.activeStations
    : requiredStationKeys;

  const stationActions = currentRoundResult?.stationActions ?? {};
  const stationOrderCommitments = currentRoundResult?.stationOrderCommitments ?? {};

  const stations = Object.fromEntries(stationOrder.map((stationKey) => {
    const actionChoice = stationActions?.[stationKey] ?? {};
    const commitment = stationOrderCommitments?.[stationKey] ?? {};
    const locked = commitment?.committed === true || commitment?.locked === true || actionChoice?.locked === true;

    return [
      stationKey,
      {
        ...actionChoice,
        actionKey: actionChoice?.actionKey ?? actionChoice?.key ?? actionChoice?.type ?? actionChoice?.action ?? "",
        label: actionChoice?.label ?? actionChoice?.actionLabel ?? actionChoice?.name ?? "",
        locked
      }
    ];
  }));

  const helperOptions = { ...options, requiredStationKeys, stationOrder };
  const source = { stationOrder, activeStations: stationOrder, stations };

  const helperState = completionChecklistUserIsGm(options)
    ? prepareGmTravelV2StationActionLockState(source, helperOptions)
    : preparePlayerSafeTravelV2StationActionLockState(source, helperOptions);

  return prepareTravelEventRunnerStationActionLockInRenderState(helperState, options);
}

export function prepareTravelV2StationActionLockRunnerUpdate(currentSession, options = {}) {
  const stationKey = typeof options.stationKey === "string" ? options.stationKey.trim() : "";
  if (!stationKey) return { result: { ok: false, errors: ["Station action lock requires a station key."], warnings: [] }, nextSession: currentSession, shouldUpdateSession: false, shouldRerender: false };
  const normalized = normalizeTravelEventRunnerSession(currentSession, options);
  if (!normalized.ok || !normalized.session) return { result: { ok: false, errors: normalized.errors?.length ? normalized.errors : ["Travel Event Runner session is invalid."], warnings: normalized.warnings ?? [] }, nextSession: currentSession, shouldUpdateSession: false, shouldRerender: false };
  if (normalized.session.status === "completed") return { result: { ok: false, errors: ["Completed Travel Event Runner sessions cannot lock station actions."], warnings: [] }, nextSession: currentSession, shouldUpdateSession: false, shouldRerender: false };
  if (!completionChecklistUserIsGm(options)) return { result: { ok: false, errors: ["Only the GM can lock station actions in the runner."], warnings: [] }, nextSession: currentSession, shouldUpdateSession: false, shouldRerender: false };

  const roundIndex = normalized.session.currentRoundIndex;
  const currentRound = normalized.session.event.rounds[roundIndex];
  const currentRoundResult = normalized.session.roundResults[roundIndex];
  const stationOrder = Array.isArray(currentRound?.activeStations) ? currentRound.activeStations : [];
  if (!stationOrder.includes(stationKey)) return { result: { ok: false, errors: [`Invalid or inactive station key: ${stationKey}.`], warnings: [] }, nextSession: currentSession, shouldUpdateSession: false, shouldRerender: false };
  const action = currentRoundResult?.stationActions?.[stationKey] ?? null;
  if (!action) return { result: { ok: false, errors: [`${formatTravelEventRunnerStationName(stationKey)} has no selected action to lock.`], warnings: [] }, nextSession: currentSession, shouldUpdateSession: false, shouldRerender: false };

  const source = { stationOrder, activeStations: stationOrder, stations: Object.fromEntries(stationOrder.map((key) => [key, { ...(currentRoundResult.stationActions?.[key] ?? {}), locked: currentRoundResult.stationOrderCommitments?.[key]?.committed === true }])) };
  const lockedState = lockTravelV2StationAction(source, stationKey);
  if (lockedState.stations?.[stationKey]?.locked !== true) return { result: { ok: false, errors: [`${formatTravelEventRunnerStationName(stationKey)} station action could not be locked.`], warnings: [] }, nextSession: currentSession, shouldUpdateSession: false, shouldRerender: false };
  const nextSession = cloneData(normalized.session);
  nextSession.roundResults[roundIndex].stationOrderCommitments[stationKey] = { ...(nextSession.roundResults[roundIndex].stationOrderCommitments[stationKey] ?? {}), committed: true };
  nextSession.updatedAt = nowIso(options);
  return { result: { ok: true, errors: [], warnings: [], stationKey, locked: true, message: `${formatTravelEventRunnerStationName(stationKey)} station action locked.` }, nextSession, shouldUpdateSession: true, shouldRerender: true };
}

export function prepareTravelV2StationActionUnlockRunnerUpdate(currentSession, options = {}) {
  const stationKey = typeof options.stationKey === "string" ? options.stationKey.trim() : "";
  if (!stationKey) return { result: { ok: false, errors: ["Station action unlock requires a station key."], warnings: [] }, nextSession: currentSession, shouldUpdateSession: false, shouldRerender: false };
  const normalized = normalizeTravelEventRunnerSession(currentSession, options);
  if (!normalized.ok || !normalized.session) return { result: { ok: false, errors: normalized.errors?.length ? normalized.errors : ["Travel Event Runner session is invalid."], warnings: normalized.warnings ?? [] }, nextSession: currentSession, shouldUpdateSession: false, shouldRerender: false };
  if (normalized.session.status === "completed") return { result: { ok: false, errors: ["Completed Travel Event Runner sessions cannot unlock station actions."], warnings: [] }, nextSession: currentSession, shouldUpdateSession: false, shouldRerender: false };
  if (!completionChecklistUserIsGm(options)) return { result: { ok: false, errors: ["Only the GM can unlock station actions in the runner."], warnings: [] }, nextSession: currentSession, shouldUpdateSession: false, shouldRerender: false };
  if (options.allowUnlock !== true) return { result: { ok: false, errors: ["Unlock requires explicit GM allowUnlock authorization."], warnings: [] }, nextSession: currentSession, shouldUpdateSession: false, shouldRerender: false };

  const roundIndex = normalized.session.currentRoundIndex;
  const currentRound = normalized.session.event.rounds[roundIndex];
  const currentRoundResult = normalized.session.roundResults[roundIndex];
  const stationOrder = Array.isArray(currentRound?.activeStations) ? currentRound.activeStations : [];
  if (!stationOrder.includes(stationKey)) return { result: { ok: false, errors: [`Invalid or inactive station key: ${stationKey}.`], warnings: [] }, nextSession: currentSession, shouldUpdateSession: false, shouldRerender: false };
  const action = currentRoundResult?.stationActions?.[stationKey] ?? null;
  if (!action) return { result: { ok: false, errors: [`${formatTravelEventRunnerStationName(stationKey)} has no selected action to unlock.`], warnings: [] }, nextSession: currentSession, shouldUpdateSession: false, shouldRerender: false };

  const source = { stationOrder, activeStations: stationOrder, stations: Object.fromEntries(stationOrder.map((key) => [key, { ...(currentRoundResult.stationActions?.[key] ?? {}), locked: currentRoundResult.stationOrderCommitments?.[key]?.committed === true }])) };
  const unlockedState = unlockTravelV2StationAction(source, stationKey, { allowUnlock: true });
  if (unlockedState.stations?.[stationKey]?.locked === true) return { result: { ok: false, errors: [`${formatTravelEventRunnerStationName(stationKey)} station action could not be unlocked.`], warnings: [] }, nextSession: currentSession, shouldUpdateSession: false, shouldRerender: false };
  const nextSession = cloneData(normalized.session);
  nextSession.roundResults[roundIndex].stationOrderCommitments[stationKey] = { ...(nextSession.roundResults[roundIndex].stationOrderCommitments[stationKey] ?? {}), committed: false };
  nextSession.updatedAt = nowIso(options);
  return { result: { ok: true, errors: [], warnings: [], stationKey, locked: false, message: `${formatTravelEventRunnerStationName(stationKey)} station action unlocked.` }, nextSession, shouldUpdateSession: true, shouldRerender: true };
}

export function prepareTravelEventRunnerState(session = null, options = {}) {
  const libraryState = prepareTravelEventRunnerLibraryState(options);
  const sessionLibraryOptions = Object.hasOwn(options, "runnerSessionLibrary") ? { ...options, library: options.runnerSessionLibrary } : options;
  const sessionLibraryState = prepareTravelEventRunnerSessionLibraryState(sessionLibraryOptions);
  const normalized = session ? normalizeTravelEventRunnerSession(session, options) : { ok: true, errors: [], warnings: [], session: null };
  const activeSession = normalized.session;
  const currentRound = activeSession?.event.rounds[activeSession.currentRoundIndex] ?? null;
  const currentRoundResult = activeSession?.roundResults[activeSession.currentRoundIndex] ?? null;
  const summary = activeSession?.status === "completed" ? summarizeTravelEventRunnerSession(activeSession, options).summary : null;
  const stations = activeSession && currentRound ? prepareStationRows(activeSession, currentRound, currentRoundResult, options) : [];
  const roundSummaryCard = activeSession && currentRound ? prepareTravelEventRunnerRoundSummaryCard(activeSession, currentRound, currentRoundResult, options) : prepareTravelEventRunnerRoundSummaryCard(null, null, null, options);
  const roundResolutionReadiness = activeSession ? inspectTravelV2RoundResolutionReadiness(activeSession, options) : null;
  const stationActionLockIn = prepareTravelEventRunnerStationActionLockInState(activeSession, currentRound, currentRoundResult, options);
  const stabilizeResolutionReview = prepareTravelStabilizeResolutionReviewState(activeSession, options);
  const pendingStabilizeRows = stabilizeResolutionReview.records.filter((record) => record.isPending);
  const reactionPromptReview = prepareTravelReactionPromptReviewState(activeSession, options);
  const focusEffectReview = prepareTravelFocusEffectReviewState(activeSession, options);
  const focusBacklashReview = prepareTravelV2FocusBacklashPanelState(activeSession, options);
  const supportAssistReview = prepareTravelV2SupportPanelState(activeSession, options);
  const supportBacklashReview = prepareTravelV2SupportBacklashPanelState(activeSession, options);
  const summaryOutput = prepareTravelEventRunnerSummaryOutputState(activeSession, options);
  const finalOutcomePackageReview = prepareTravelV2FinalOutcomePackageReviewState(activeSession, options);
  const finalOutcomeApply = prepareTravelV2FinalOutcomeApplyState(activeSession, options);
  const stagedEffectReview = prepareTravelEventStagedEffectReviewState(activeSession, options);
  const completionChecklist = prepareTravelV2CompletionChecklistState(activeSession, { ...options, summaryOutput, finalOutcomePackageReview, finalOutcomeApply, stagedEffectReview });
  const playerSafeSession = preparePlayerSafeRunnerSession(activeSession, options);
  const currentUserIsGm = completionChecklistUserIsGm(options);
  const runnerState = {
    ok: normalized.ok,
    errors: normalized.errors,
    warnings: normalized.warnings,
    library: libraryState,
    sessionLibrary: sessionLibraryState,
    hasSavedSessions: sessionLibraryState.hasSessions === true,
    canSaveSession: Boolean(activeSession),
    canSaveSessionAs: Boolean(activeSession),
    hasPublishedEvents: libraryState.hasEvents === true,
    hasLoadableEvents: libraryState.hasLoadableEvents === true,
    canImportSession: true,
    canExportSession: Boolean(activeSession),
    currentSessionName: activeSession?.name || (activeSession?.event?.name ? `${activeSession.event.name} Session` : "No active session"),
    currentSessionStatusLabel: activeSession ? humanizeIdentifier(activeSession.status) : "No Active Session",
    session: playerSafeSession,
    hasSession: Boolean(activeSession),
    isCompleted: activeSession?.status === "completed",
    event: activeSession?.event ?? null,
    currentRound,
    currentRoundNumber: currentRound ? activeSession.currentRoundIndex + 1 : 0,
    currentRoundTitle: currentRound?.title ?? "",
    currentRoundOpeningVignette: currentRound?.openingVignette ?? "",
    roundSegmentState: activeSession ? prepareTravelRoundSegmentState(activeSession, { reactionPromptReview, stabilizeResolutionReview, focusEffectReview }) : prepareTravelRoundSegmentState(null),
    stationAssignments: activeSession ? prepareTravelEventRunnerStationAssignmentState(activeSession, options) : { rows: [], actorOptions: [] },
    stations,
    reactionPromptReview,
    stabilizeResolutionReview,
    pendingStabilize: {
      rows: pendingStabilizeRows,
      hasPending: pendingStabilizeRows.length > 0,
      totalReduction: pendingStabilizeRows.reduce((total, row) => total + row.reduction, 0),
      hasComplications: pendingStabilizeRows.some((row) => row.complication)
    },
    focusEffectReview,
    focusBacklashReview,
    supportAssistReview,
    supportBacklashReview,
    focusRiskSummary: prepareTravelFocusRiskSummary(stations),
    travelV2Hazards: prepareTravelV2HazardPanelState(activeSession),
    travelV2Narration: activeSession ? prepareTravelV2RoundNarration(activeSession, activeSession.currentRoundIndex, options) : null,
    travelV2ShipScars: prepareTravelV2ShipScarsPanelState(activeSession),
    travelV2Momentum: prepareTravelV2MomentumPanelState(activeSession),
    roundSummaryCard,
    stationActionLockIn,
    roundResolutionReadiness,
    roundResolutionReady: roundResolutionReadiness?.roundResolutionReady === true,
    roundResolutionBlocked: roundResolutionReadiness?.roundResolutionBlocked === true,
    roundResolutionBlockers: roundResolutionReadiness?.roundResolutionBlockers ?? [],
    roundResolutionWarningLabel: roundResolutionReadiness?.roundResolutionWarningLabel ?? "",
    canFinalizeCurrentRound: roundResolutionReadiness?.canFinalizeCurrentRound === true,
    canAdvanceCurrentRound: roundResolutionReadiness?.canAdvanceCurrentRound === true,
    finalizationReadinessLabel: roundResolutionReadiness?.finalizationReadinessLabel ?? "",
    hasStations: Boolean(activeSession && currentRound && currentRound.activeStations.length > 0),
    canRetreat: Boolean(activeSession && activeSession.currentRoundIndex > 0 && activeSession.status !== "completed"),
    canAdvance: Boolean(activeSession && activeSession.currentRoundIndex < activeSession.event.rounds.length - 1 && activeSession.status !== "completed"),
    canComplete: Boolean(activeSession && activeSession.status !== "completed"),
    summary,
    summaryOutput,
    finalOutcomePackageReview,
    finalOutcomeApply,
    stagedEffectReview,
    ...(currentUserIsGm ? { completionChecklist } : {}),
    summaryJson: currentUserIsGm && summary ? exportTravelEventRunnerSessionToJson(activeSession, options).json : ""
  };
  return runnerStateUserIsExplicitNonGm(options) ? sanitizePlayerSafeRunnerStateValue(runnerState) : runnerState;
}

export function prepareTravelSceneOverlayState(session = null, options = {}) {
  const runnerState = prepareTravelEventRunnerState(session, options);
  if (!runnerState.hasSession) {
    return {
      hasSession: false,
      emptyMessage: "No Travel Event Runner session is active. Start or load a runner session, then open the overlay again.",
      eventName: "",
      roundNumber: 0,
      roundTitle: "",
      roundLabel: "No active round",
      vignette: "",
      stations: [],
      hasStations: false,
      gmRoundSummaryText: "",
      unresolvedStationCount: 0,
      unassignedStationCount: 0,
      unselectedApproachCount: 0,
      unresolvedResultCount: 0,
      roundCompletionState: "noSession",
      gmGuidanceTitle: "",
      gmGuidanceText: "",
      gmGuidanceSteps: [],
      guidanceStation: null,
      guidanceStationName: "",
      hasGuidanceStation: false,
      hasGmGuidanceSteps: false,
      hasGmGuidance: false,
      currentRoundIndex: -1,
      isCompleted: false
    };
  }

  const roundNumber = runnerState.currentRoundNumber || 0;
  const roundTitle = runnerState.currentRoundTitle || "";
  const assignmentRowsByStation = new Map((runnerState.stationAssignments?.rows ?? []).map((row) => [row.stationKey, row]));
  const stations = (runnerState.stations ?? []).map((row) => {
    const hasAssignment = row.assigned === true;
    const hasSelectedApproach = row.selectedApproach?.isSelected === true;
    const hasResult = Boolean(row.result);
    const assignmentRow = assignmentRowsByStation.get(row.stationKey) ?? null;
    const resolvedDc = resolveStationDc(row, runnerState.event?.baseDC);
    const assignedActor = row.assignment?.actorId || row.assignment?.actorUuid ? getActorByAssignment(row.assignment, options) : null;
    const selectedStatistic = resolveActorStatisticDetails(assignedActor, row.selectedApproach?.skill);
    const selectedApproachModifier = selectedStatistic.modifier;
    const hasSelectedApproachModifier = Number.isFinite(selectedApproachModifier);
    if (row.selectedApproach?.skill) debugTravelApproachStatisticResolution(options, { stationKey: row.stationKey, actorName: assignedActor?.name ?? row.assignedActorName, skill: row.selectedApproach.skill, aliasesTried: selectedStatistic.aliasesTried, resolvedStatisticKey: selectedStatistic.statisticKey, modifier: selectedStatistic.modifier });
    const rollUnavailableReason = !hasAssignment
      ? "Assign an actor before rolling."
      : (!hasSelectedApproach
        ? "Select an approach before rolling."
        : (!Number.isFinite(resolvedDc.dc)
          ? "DC unavailable."
          : (!hasSelectedApproachModifier ? (selectedStatistic.message || `Modifier unavailable: could not find ${row.selectedSkillLabel} on ${row.assignedActorName}`) : "")));
    const resultStateClass = hasResult ? `arcflight-travel-scene-overlay__station-card--${String(row.result).replaceAll("_", "-")}` : "arcflight-travel-scene-overlay__station-card--result-unrecorded";
    const station = {
      stationKey: row.stationKey,
      stationName: row.stationName || humanizeIdentifier(row.stationKey),
      assignedActorName: hasAssignment ? (row.assignedActorName || "Unknown Actor") : "Unassigned",
      approachLabel: hasSelectedApproach ? (row.selectedApproach?.label || row.selectedSkillLabel || "Selected") : "Not selected",
      approachHelpText: hasSelectedApproach ? (row.selectedApproach?.helpText || "") : "",
      resultLabel: hasResult ? (row.resultLabel || humanizeIdentifier(row.result)) : "Unrecorded",
      resultFeedback: row.resultFeedback || "",
      promptText: row.problem || row.prompt || "",
      hasPromptText: Boolean(row.problem || row.prompt),
      hasApproachHelpText: Boolean(hasSelectedApproach && row.selectedApproach?.helpText),
      hasResultFeedback: Boolean(row.resultFeedback),
      dc: resolvedDc.dc,
      hasDc: Number.isFinite(resolvedDc.dc),
      dcLabel: Number.isFinite(resolvedDc.dc) ? `DC ${resolvedDc.dc}` : "DC unavailable",
      dcSource: resolvedDc.source,
      selectedApproachModifier,
      hasSelectedApproachModifier,
      selectedApproachModifierLabel: hasSelectedApproachModifier ? `${selectedApproachModifier >= 0 ? "+" : ""}${selectedApproachModifier}` : "Modifier unavailable",
      canRollStationCheck: Boolean(hasAssignment && hasSelectedApproach && Number.isFinite(resolvedDc.dc) && hasSelectedApproachModifier),
      rollUnavailableReason,
      hasAssignment,
      hasSelectedApproach,
      hasResult,
      result: row.result || "",
      selectedActionType: row.selectedActionType,
      selectedActionLabel: row.selectedActionLabel,
      stationOrderCommitted: row.stationOrderCommitted === true,
      isStabilize: row.isStabilize === true,
      isSupport: row.isSupport === true,
      supportTargetStationKey: row.supportTargetStationKey || "",
      supportTargetStationName: row.supportTargetStationName || "",
      stabilizePressureKey: row.stabilizePressureKey || "",
      stabilizePressureLabel: row.stabilizePressureLabel || "",
      selectedFocusAbility: row.selectedFocusAbility || "",
      focusSuppressedByHazard: row.focusSuppressedByHazard === true,
      focusSuppression: row.focusSuppression ?? null,
      activeHazardModifiers: row.activeHazardModifiers ?? [],
      assignmentOptions: assignmentRow?.options ?? [],
      hasAssignmentOptions: (assignmentRow?.options ?? []).length > 0,
      selectedAssignmentValue: row.assignment?.actorUuid || row.assignment?.actorId || "",
      canClearAssignment: assignmentRow?.canClear === true,
      canResetAssignment: true,
      isNpcAssignment: assignmentRow?.isNpcAssignment === true,
      npcController: assignmentRow?.npcController ?? { userId: "", userName: "" },
      npcControllerName: assignmentRow?.npcControllerName || "Unassigned",
      npcControllerOptions: assignmentRow?.npcControllerOptions ?? [],
      approachOptions: (row.stationOptions ?? []).map((approach) => {
        const optionDc = resolveStationDc({ ...row, selectedApproach: approach }, runnerState.event?.baseDC);
        const statistic = resolveActorStatisticDetails(assignedActor, approach.skill);
        const modifier = statistic.modifier;
        const skillLabel = approach.skill ? humanizeIdentifier(approach.skill) : "No statistic";
        const modifierLabel = Number.isFinite(modifier) ? `${modifier >= 0 ? "+" : ""}${modifier}` : (statistic.message || "modifier unavailable");
        const dcLabel = Number.isFinite(optionDc.dc) ? `DC ${optionDc.dc}` : "DC unavailable";
        return {
          ...approach,
          value: approach.optionKey,
          skillLabel,
          statisticLabel: Number.isFinite(modifier) ? `${skillLabel} ${modifierLabel}` : modifierLabel,
          aliasesTried: statistic.aliasesTried,
          resolvedStatisticKey: statistic.statisticKey,
          modifier,
          modifierLabel,
          dc: optionDc.dc,
          dcLabel,
          displayLabel: `${approach.label || skillLabel} — ${skillLabel} ${modifierLabel} — ${dcLabel}`
        };
      }),
      hasApproachOptions: (row.stationOptions ?? []).length > 0,
      selectedApproachValue: row.selectedApproach?.isSelected === true ? (row.selectedStationOptionKey || "") : "",
      selectedApproachSkillLabel: row.selectedApproach?.skill ? humanizeIdentifier(row.selectedApproach.skill) : "",
      selectedApproachStatisticLabel: row.selectedApproach?.skill ? (hasSelectedApproachModifier ? `${humanizeIdentifier(row.selectedApproach.skill)} ${selectedApproachModifier >= 0 ? "+" : ""}${selectedApproachModifier}` : (selectedStatistic.message || `${humanizeIdentifier(row.selectedApproach.skill)} modifier unavailable`)) : "",
      selectedApproachRollLabel: hasSelectedApproach ? `${row.selectedApproach?.skill ? (hasSelectedApproachModifier ? `${humanizeIdentifier(row.selectedApproach.skill)} ${selectedApproachModifier >= 0 ? "+" : ""}${selectedApproachModifier}` : (selectedStatistic.message || `${humanizeIdentifier(row.selectedApproach.skill)} modifier unavailable`)) : "Statistic unavailable"} vs ${Number.isFinite(resolvedDc.dc) ? `DC ${resolvedDc.dc}` : "DC unavailable"}` : "",
      resultOptions: row.resultOptions ?? [],
      hasResultOptions: (row.resultOptions ?? []).length > 0
    };
    station.classes = [
      "arcflight-travel-scene-overlay__station-card",
      "arcflight-travel-scene-overlay__station-card--active",
      hasAssignment ? "" : "arcflight-travel-scene-overlay__station-card--unassigned",
      hasSelectedApproach ? "" : "arcflight-travel-scene-overlay__station-card--approach-not-selected",
      resultStateClass
    ].filter(Boolean).join(" ");
    return station;
  });
  const focusedStation = stations.find((station) => !station.hasResult)
    ?? stations.find((station) => !station.hasSelectedApproach)
    ?? stations.find((station) => !station.hasAssignment)
    ?? stations[0]
    ?? null;
  if (focusedStation) {
    focusedStation.classes = `${focusedStation.classes} arcflight-travel-scene-overlay__station-card--focused`;
  }
  const stationCount = stations.length;
  const assignedStationCount = stations.filter((station) => station.hasAssignment).length;
  const selectedApproachCount = stations.filter((station) => station.hasSelectedApproach).length;
  const recordedResultCount = stations.filter((station) => station.hasResult).length;
  const unassignedStationCount = stationCount - assignedStationCount;
  const unselectedApproachCount = stationCount - selectedApproachCount;
  const unresolvedResultCount = stationCount - recordedResultCount;
  const unresolvedStationCount = stations.filter((station) => !station.hasAssignment || !station.hasSelectedApproach || !station.hasResult).length;
  const roundCompletionState = stationCount <= 0
    ? "noStations"
    : (unresolvedStationCount <= 0 ? "resolved" : "unresolved");
  let guidanceTargetStation = null;
  let guidanceStationName = "";
  let gmGuidanceTitle = "GM Round Guidance";
  let gmGuidanceText = "";
  let gmGuidanceSteps = [];

  if (stationCount <= 0) {
    gmGuidanceTitle = "No Active Station Prompts";
    gmGuidanceText = "No station prompts are active for this round. Review the round vignette and runner state before advancing.";
    gmGuidanceSteps = ["Review the round summary", "Confirm the runner has the correct round loaded", "Advance only if this round intentionally has no station prompts"];
  } else if (unassignedStationCount > 0) {
    guidanceTargetStation = stations.find((station) => !station.hasAssignment) ?? null;
    guidanceStationName = guidanceTargetStation?.stationName ?? "the first unassigned station";
    gmGuidanceTitle = "Assign Crew to Stations";
    gmGuidanceText = `${unassignedStationCount} station${unassignedStationCount === 1 ? " needs" : "s need"} an assigned crew member or actor. Start with ${guidanceStationName}.`;
    gmGuidanceSteps = ["Review guidance station", "Confirm assignment", "Refresh overlay after runner changes", "Then confirm approaches"];
  } else if (unselectedApproachCount > 0) {
    guidanceTargetStation = stations.find((station) => !station.hasSelectedApproach) ?? null;
    guidanceStationName = guidanceTargetStation?.stationName ?? "the first station without an approach";
    gmGuidanceTitle = "Confirm Station Approaches";
    gmGuidanceText = `${unselectedApproachCount} station${unselectedApproachCount === 1 ? " needs" : "s need"} a selected approach. Start with ${guidanceStationName}.`;
    gmGuidanceSteps = ["Review guidance station", "Confirm approach", "Refresh overlay after runner changes", "Then resolve station results"];
  } else if (unresolvedResultCount > 0) {
    guidanceTargetStation = stations.find((station) => !station.hasResult) ?? null;
    guidanceStationName = guidanceTargetStation?.stationName ?? "the first station without a result";
    gmGuidanceTitle = "Resolve Station Results";
    gmGuidanceText = `${unresolvedResultCount} station result${unresolvedResultCount === 1 ? " is" : "s are"} still unrecorded. Start with ${guidanceStationName}.`;
    gmGuidanceSteps = ["Review guidance station", "Resolve result", "Refresh overlay after runner changes", "Repeat until all station results are recorded"];
  } else {
    gmGuidanceTitle = "Round Appears Resolved";
    gmGuidanceText = "All active stations have assignments, approaches, and recorded results. The GM can advance or apply round consequences in the runner.";
    gmGuidanceSteps = ["Review final station outcomes", "Apply or narrate round consequences", "Advance the runner when ready", "Refresh overlay after runner changes"];
  }

  const gmRoundSummaryText = runnerState.roundSummaryCard?.summaryText || "";
  const roundStateSummary = gmRoundSummaryText || `${recordedResultCount} of ${stationCount} stations have recorded results.`;

  return {
    hasSession: true,
    emptyMessage: "",
    eventName: runnerState.event?.name ?? "Unnamed Travel Event",
    roundNumber,
    roundTitle,
    roundLabel: roundNumber ? `Round ${roundNumber}` : "No active round",
    currentRoundIndex: runnerState.session?.currentRoundIndex ?? -1,
    isCompleted: runnerState.isCompleted === true,
    vignette: runnerState.currentRoundOpeningVignette || "",
    stations,
    hasStations: stationCount > 0,
    focusedStation,
    hasFocusedStation: Boolean(focusedStation),
    focusedStationLabel: focusedStation ? `Active Station Focus: ${focusedStation.stationName}` : "",
    stationCount,
    assignedStationCount,
    selectedApproachCount,
    recordedResultCount,
    unresolvedStationCount,
    unassignedStationCount,
    unselectedApproachCount,
    unresolvedResultCount,
    roundCompletionState,
    gmGuidanceTitle,
    gmGuidanceText,
    gmGuidanceSteps,
    guidanceStation: guidanceTargetStation,
    guidanceStationName,
    hasGuidanceStation: Boolean(guidanceTargetStation),
    hasGmGuidanceSteps: gmGuidanceSteps.length > 0,
    hasGmGuidance: Boolean(gmGuidanceTitle || gmGuidanceText || gmGuidanceSteps.length > 0),
    roundStateSummary,
    gmRoundSummaryText
  };
}

export function prepareTravelPlayerStationCardState(session = null, stationKey = "", options = {}) {
  const normalizedStationKey = typeof stationKey === "string" ? stationKey : String(stationKey ?? "");
  const overlayState = prepareTravelSceneOverlayState(session, options);
  if (!overlayState.hasSession) {
    return {
      hasSession: false,
      sessionKey: "",
      roundLabel: "No active round",
      roundTitle: "",
      stationKey: normalizedStationKey,
      stationName: normalizedStationKey ? humanizeIdentifier(normalizedStationKey) : "Travel Station",
      assignedActorName: "Unassigned",
      promptText: "",
      hasPromptText: false,
      selectedApproachLabel: "",
      selectedApproachHelpText: "",
      selectedApproachRollLabel: "",
      hasSelectedApproach: false,
      hasSelectedApproachHelpText: false,
      resultStatusLabel: "No active session",
      resultFeedbackText: "",
      hasResultFeedback: false,
      waitingStateText: overlayState.emptyMessage,
      isResolved: false,
      statusKey: "noSession",
      approachOptions: [],
      hasApproachOptions: false,
      selectedApproachValue: "",
      currentRoundIndex: -1
    };
  }

  const station = (overlayState.stations ?? []).find((candidate) => candidate.stationKey === normalizedStationKey) ?? null;
  const activeSession = normalizeTravelEventRunnerSession(session, options).session;
  if (!station) {
    return {
      hasSession: true,
      sessionKey: activeSession?.key ?? "",
      roundLabel: overlayState.roundLabel,
      roundTitle: overlayState.roundTitle,
      stationKey: normalizedStationKey,
      stationName: normalizedStationKey ? humanizeIdentifier(normalizedStationKey) : "Travel Station",
      assignedActorName: "Unassigned",
      promptText: "",
      hasPromptText: false,
      selectedApproachLabel: "",
      selectedApproachHelpText: "",
      selectedApproachRollLabel: "",
      hasSelectedApproach: false,
      hasSelectedApproachHelpText: false,
      resultStatusLabel: "Station unavailable",
      resultFeedbackText: "",
      hasResultFeedback: false,
      waitingStateText: "This station is not active for the current round.",
      isResolved: false,
      statusKey: "unavailable",
      approachOptions: [],
      hasApproachOptions: false,
      selectedApproachValue: "",
      currentRoundIndex: activeSession?.currentRoundIndex ?? -1
    };
  }
  const focusSource = prepareTravelStationFocusState(activeSession, station.stationKey, activeSession?.currentRoundIndex ?? 0, options);
  const { focusOptions, focusCapacity, focusRemaining } = focusSource;
  const publicHazards = prepareTravelV2HazardPanelState(activeSession).records
    .filter((record) => record.revealed === true && record.status !== "cleared" && typeof record.playerText === "string" && record.playerText.trim())
    .map(sanitizeTravelV2PublicHazard);
  const publicShipScars = prepareTravelV2ShipScarsPanelState(activeSession).records
    .filter((record) => ["applied", "repaired"].includes(record.status) && record.playerVisible !== false && typeof record.playerText === "string" && record.playerText.trim())
    .map((record) => ({ id: record.id, name: record.name, severity: record.severity, category: record.category, playerText: record.playerText, repairRequirement: record.repairRequirement, status: record.status }));
  const stationReactionRecords = normalizeTravelReactionPromptRecords(activeSession?.reactionPrompts, options).records.filter((record) =>
    record.stationKey === station.stationKey
    && record.roundIndex === activeSession?.currentRoundIndex
  );
  const pendingReactionPrompt = stationReactionRecords.find((record) => record.status === "pending") ?? null;
  const acceptedReactionPrompt = stationReactionRecords.find((record) => record.status === "accepted") ?? null;
  const rerollReactionPrompt = stationReactionRecords.find((record) => record.rerollResult) ?? null;
  const reactionBacklash = normalizeTravelReactionPromptRecords(activeSession?.reactionPrompts, options).records.find((record) =>
    record.stationKey === station.stationKey
    && record.roundIndex === activeSession?.currentRoundIndex
    && record.backlashStatus === "pending"
  ) ?? null;
  const stationFlow = buildTravelPlayerStationFlowState(station, normalizeTravelReactionPromptRecords(activeSession?.reactionPrompts, options).records);

  let statusKey = stationFlow.statusKey;
  let resultStatusLabel = stationFlow.stateLabel;
  let waitingStateText = stationFlow.stateLabel;
  if (!station.hasAssignment) {
    statusKey = "needsAssignment";
    resultStatusLabel = "Needs assignment";
    waitingStateText = "Waiting for station assignment";
  } else if (!station.hasSelectedApproach) {
    statusKey = "choosing";
    resultStatusLabel = "Choosing";
    waitingStateText = "Choose an action card, then roll from this station card.";
  } else if (station.hasResult) {
    statusKey = "rolled";
    resultStatusLabel = "Rolled";
    waitingStateText = "Waiting for GM pressure resolution";
  }

  return {
    hasSession: true,
    sessionKey: activeSession?.key ?? "",
    roundLabel: overlayState.roundLabel,
    roundTitle: overlayState.roundTitle,
    stationKey: station.stationKey,
    stationName: station.stationName,
    assignedActorName: station.assignedActorName,
    promptText: station.promptText,
    hasPromptText: station.hasPromptText === true,
    selectedApproachLabel: station.hasSelectedApproach ? station.approachLabel : "",
    selectedApproachHelpText: station.hasSelectedApproach ? station.approachHelpText : "",
    selectedApproachRollLabel: station.hasSelectedApproach ? (station.selectedApproachRollLabel || "") : "",
    hasSelectedApproach: station.hasSelectedApproach === true,
    hasSelectedApproachHelpText: station.hasApproachHelpText === true,
    resultStatusLabel,
    resultLabel: station.hasResult ? station.resultLabel : "",
    resultFeedbackText: station.hasResult ? station.resultFeedback : "",
    hasResultFeedback: station.hasResult === true && Boolean(station.resultFeedback),
    rollDetailText: activeSession?.playerMissionBoardRollDetails?.[station.stationKey] || station.rollDetailText || "",
    canRollStation: station.canRollStationCheck === true && station.hasResult !== true,
    rollDisabledReason: station.hasResult === true ? "This station already has a result." : (station.rollUnavailableReason || "Select an action card to roll."),
    reactionStatusLabel: pendingReactionPrompt ? "Focus reaction available." : (acceptedReactionPrompt && !acceptedReactionPrompt.rerollResult ? "Focus accepted; reroll needed." : (rerollReactionPrompt ? `Reroll resolved: ${humanizeIdentifier(rerollReactionPrompt.rerollResult)}.` : "No Focus reaction is pending.")),
    focusReactionAvailable: Boolean(pendingReactionPrompt),
    focusReactionAccepted: Boolean(acceptedReactionPrompt),
    focusRerollNeeded: Boolean(acceptedReactionPrompt && !acceptedReactionPrompt.rerollResult),
    focusRerollResolved: Boolean(rerollReactionPrompt),
    focusRerollResultLabel: rerollReactionPrompt ? humanizeIdentifier(rerollReactionPrompt.rerollResult) : "",
    waitingStateText,
    isResolved: station.hasResult === true,
    statusKey,
    approachOptions: station.approachOptions ?? [],
    hasApproachOptions: (station.approachOptions ?? []).length > 0,
    selectedApproachValue: station.hasSelectedApproach ? (station.selectedApproachValue || "") : "",
    selectedStationOrder: station.selectedActionType || "eventApproach",
    selectedStationOrderLabel: station.selectedActionLabel || "Push Forward",
    stationOrderCommitted: station.stationOrderCommitted === true,
    isStabilize: station.isStabilize === true,
    isSupport: station.isSupport === true,
    supportTargetStationName: station.supportTargetStationName || "",
    stabilizePressureKey: station.stabilizePressureKey || "",
    stabilizePressureLabel: station.stabilizePressureLabel || "",
    focusCapacity,
    focusRemaining,
    focusOptions: focusOptions.map((option) => station.focusSuppressedByHazard === true ? sanitizeTravelStationFocusOption(option, { stationKey: station.stationKey, roundIndex: activeSession?.currentRoundIndex ?? 0, used: option.used, noFocusRemaining: focusRemaining <= 0, spentThisRound: focusSource.spentThisRound, blocked: true, blockedReason: station.focusSuppression?.publicReasonText ?? "Focus is blocked by an active hazard." }) : option),
    hasFocusOptions: focusOptions.length > 0,
    selectedFocusAbility: station.selectedFocusAbility || "",
    noFocusRemaining: focusRemaining <= 0 || station.focusSuppressedByHazard === true,
    canSpendFocus: focusRemaining > 0 && focusOptions.length > 0 && !focusSource.spentThisRound && station.focusSuppressedByHazard !== true,
    focusBlocked: station.focusSuppressedByHazard === true,
    focusBlockedReason: station.focusSuppression?.publicReasonText ?? "",
    focusBlockedHazardName: station.focusSuppression?.hazardName ?? "",
    hasPendingReactionPrompt: Boolean(pendingReactionPrompt),
    pendingReactionPromptId: pendingReactionPrompt?.reactionPromptId ?? "",
    pendingReactionPromptTitle: pendingReactionPrompt?.promptTitle ?? "",
    pendingReactionPromptAbilityLabel: pendingReactionPrompt?.abilityLabel ?? "",
    hasPublicHazards: publicHazards.length > 0,
    publicHazards,
    hasPublicShipScars: publicShipScars.length > 0,
    publicShipScars,
    hasPendingReactionBacklash: Boolean(reactionBacklash),
    pendingReactionBacklashText: reactionBacklash ? "Hard Correction fails to bite; the ship shudders under the strain. The GM must resolve +1 Strain." : "",
    currentRoundIndex: activeSession?.currentRoundIndex ?? -1,
    momentum: sanitizeTravelV2MomentumForPlayers(activeSession?.travelV2Momentum),
    hasMomentum: sanitizeTravelV2MomentumForPlayers(activeSession?.travelV2Momentum).value > 0,
    focusBacklash: sanitizeTravelV2FocusBacklashForPlayers(activeSession?.travelV2FocusBacklashRecords),
    hasFocusBacklash: sanitizeTravelV2FocusBacklashForPlayers(activeSession?.travelV2FocusBacklashRecords).hasRecords,
    supportAssists: sanitizeTravelV2SupportForPlayers(activeSession?.travelV2SupportRecords),
    supportBacklash: sanitizeTravelV2SupportBacklashForPlayers(activeSession?.travelV2SupportBacklashRecords),
    hasSupportAssists: sanitizeTravelV2SupportForPlayers(activeSession?.travelV2SupportRecords).hasRecords,
    hasSupportBacklash: sanitizeTravelV2SupportBacklashForPlayers(activeSession?.travelV2SupportBacklashRecords).hasRecords
  };
}


function buildTravelPlayerStationFlowState(station = {}, reactionRecords = []) {
  const stationReactionRecords = reactionRecords.filter((record) => record.stationKey === station.stationKey);
  const pendingReaction = stationReactionRecords.some((record) => record.status === "pending");
  const acceptedReaction = stationReactionRecords.some((record) => record.status === "accepted" && !record.rerollResult);
  const rerollReaction = stationReactionRecords.find((record) => record.rerollResult) ?? null;
  let key = "waiting";
  let label = "Waiting";
  if (pendingReaction) { key = "reaction"; label = "Reaction Available"; }
  else if (acceptedReaction) { key = "ready"; label = "Focus Accepted / Reroll Needed"; }
  else if (rerollReaction) { key = "rolled"; label = `Reroll Resolved: ${humanizeIdentifier(rerollReaction.rerollResult)}`; }
  else if (station.hasResult) { key = "rolled"; label = "Rolled / Waiting on GM"; }
  else if (!station.hasAssignment) { key = "waiting"; label = "Waiting"; }
  else if (!station.hasSelectedApproach) { key = "choosing"; label = "Choosing"; }
  else if (station.canRollStationCheck) { key = "ready"; label = "Ready to Roll"; }
  else { key = "waitingOnGm"; label = "Waiting on GM"; }
  return {
    statusKey: key,
    stateLabel: label,
    partyRowClass: `arcflight-party-row--${key === "waitingOnGm" ? "waiting" : key === "reaction" ? "ready" : key}`,
    stationConsoleLabel: `${station.stationName || humanizeIdentifier(station.stationKey)} — ${label}`,
    focusRerollResolved: Boolean(rerollReaction),
    focusRerollResultLabel: rerollReaction ? humanizeIdentifier(rerollReaction.rerollResult) : ""
  };
}

function buildTravelPlayerPressureGauges(session = {}) {
  const configs = [
    { key: "strain", icon: "🔥", label: "Strain", description: "Arkengine stress and magical system pressure" },
    { key: "lifeveil", icon: "🌬️", label: "Lifeveil", description: "Breathable air / protective veil stability" },
    { key: "morale", icon: "🎭", label: "Morale", description: "Crew confidence and cohesion" },
    { key: "hull", icon: "⚓", label: "Hull", description: "Physical ship integrity pressure" },
    { key: "supplies", icon: "📦", label: "Supplies", description: "Food, parts, and voyage stores pressure" }
  ];
  return configs.map((config) => {
    const rawValue = Number(session?.pressure?.[config.key]?.value ?? session?.pressure?.[config.key] ?? 0) || 0;
    const value = Math.max(0, Math.min(4, rawValue));
    const statusBand = value >= 4 ? "Critical" : (value >= 3 ? "Dangerous" : (value >= 2 ? "Rising" : "Calm"));
    return {
      ...config,
      value,
      valueLabel: `${value} / 4`,
      statusBand,
      stateClass: value >= 4 ? "danger" : (value >= 3 ? "strong-warning" : (value >= 2 ? "warning" : (value >= 1 ? "active" : "calm"))),
      needleAngle: -60 + (value * 30),
      fillPercent: value * 25,
      tooltip: `${config.label}: ${config.description}. ${statusBand}.`
    };
  });
}

function buildTravelPlayerPartyAlerts({ stations = [], publicHazards = [], publicShipScars = [], reactionRecords = [] } = {}) {
  const alerts = [];
  const waitingCount = stations.filter((station) => !station.hasResult).length;
  if (waitingCount > 0) alerts.push({ tone: "waiting", icon: "⚠️", text: `${waitingCount} station ${waitingCount === 1 ? "roll" : "rolls"} waiting.` });
  if (reactionRecords.some((record) => record.status === "pending")) alerts.push({ tone: "attention", icon: "🧭", text: "Reaction prompt available." });
  if (publicHazards.length > 0) alerts.push({ tone: "attention", icon: "⚠️", text: `${publicHazards.length} hazard ${publicHazards.length === 1 ? "card" : "cards"} revealed.` });
  if (publicShipScars.length > 0) alerts.push({ tone: "danger", icon: "🚨", text: `${publicShipScars.length} Ship Scar ${publicShipScars.length === 1 ? "is" : "are"} revealed.` });
  if (stations.length > 0 && waitingCount === 0) alerts.push({ tone: "resolved", icon: "✅", text: "Round rolls resolved. GM is reviewing pressure." });
  return alerts;
}

export function buildTravelPlayerStationOrderCommitData(state = {}, optionKey = "") {
  return {
    sessionKey: typeof state?.sessionKey === "string" ? state.sessionKey : "",
    stationKey: typeof state?.stationKey === "string" ? state.stationKey : "",
    roundIndex: Number.isInteger(Number(state?.currentRoundIndex)) ? Number(state.currentRoundIndex) : -1,
    optionKey: typeof optionKey === "string" && optionKey ? optionKey : (typeof state?.selectedApproachValue === "string" ? state.selectedApproachValue : ""),
    selectedFocusAbility: typeof state?.selectedFocusAbility === "string" ? state.selectedFocusAbility : ""
  };
}

export function prepareTravelPlayerMissionBoardState(session = null, options = {}) {
  const overlayState = prepareTravelSceneOverlayState(session, options);
  const normalized = session ? normalizeTravelEventRunnerSession(session, options) : { session: null };
  if (!overlayState.hasSession) {
    return {
      hasSession: false,
      sessionKey: "",
      eventName: "",
      roundLabel: "No active round",
      roundTitle: "",
      currentRoundIndex: -1,
      vignette: "",
      stations: [],
      hasStations: false
    };
  }
  const publicHazards = prepareTravelV2HazardPanelState(normalized.session).records
    .filter((record) => record.revealed === true && record.status !== "cleared" && typeof record.playerText === "string" && record.playerText.trim())
    .map(sanitizeTravelV2PublicHazard);
  const publicShipScars = prepareTravelV2ShipScarsPanelState(normalized.session).records
    .filter((record) => ["applied", "repaired"].includes(record.status) && record.playerVisible !== false && typeof record.playerText === "string" && record.playerText.trim())
    .map((record) => ({ id: record.id, name: record.name, severity: record.severity, category: record.category, playerText: record.playerText, repairRequirement: record.repairRequirement, status: record.status, statusLabel: record.statusLabel }));
  const reactionRecords = normalizeTravelReactionPromptRecords(normalized.session?.reactionPrompts, options).records;
  const stations = (overlayState.stations ?? []).map((station) => {
      const focusSource = prepareTravelStationFocusState(normalized.session, station.stationKey, normalized.session?.currentRoundIndex ?? 0, options);
      const { focusOptions, focusCapacity, focusRemaining } = focusSource;
      const stationFlow = buildTravelPlayerStationFlowState(station, reactionRecords);
      return {
      ...stationFlow,
      stationKey: station.stationKey,
      stationName: station.stationName,
      assignedActorName: station.assignedActorName,
      promptText: station.promptText,
      hasPromptText: station.hasPromptText === true,
      approachOptions: station.approachOptions ?? [],
      hasApproachOptions: (station.approachOptions ?? []).length > 0,
      hasSelectedApproach: station.hasSelectedApproach === true,
      selectedApproachValue: station.selectedApproachValue || "",
      selectedApproachLabel: station.hasSelectedApproach ? station.approachLabel : "",
      selectedApproachHelpText: station.hasSelectedApproach ? station.approachHelpText : "",
      selectedApproachSkillLabel: station.selectedApproachSkillLabel || "",
      selectedApproachStatisticLabel: station.selectedApproachStatisticLabel || "",
      selectedApproachModifier: Number.isFinite(station.selectedApproachModifier) ? station.selectedApproachModifier : null,
      selectedApproachModifierLabel: station.selectedApproachModifierLabel || "modifier unavailable",
      selectedApproachRollLabel: station.selectedApproachRollLabel || "",
      hasSelectedApproachHelpText: station.hasApproachHelpText === true,
      dcLabel: station.dcLabel,
      dc: station.dc,
      resultLabel: station.resultLabel,
      resultFeedbackText: station.hasResult ? station.resultFeedback : "",
      hasResultFeedback: station.hasResultFeedback === true,
      hasResult: station.hasResult === true,
      reactionStatusLabel: stationFlow.stateLabel === "Reaction Available" ? "Focus reaction available." : (stationFlow.stateLabel === "Focus Accepted / Reroll Needed" ? "Focus accepted; reroll needed." : (stationFlow.focusRerollResolved ? `Reroll resolved: ${stationFlow.focusRerollResultLabel}.` : "")),
      focusReactionAvailable: stationFlow.stateLabel === "Reaction Available",
      focusReactionAccepted: stationFlow.stateLabel === "Focus Accepted / Reroll Needed",
      focusRerollNeeded: stationFlow.stateLabel === "Focus Accepted / Reroll Needed",
      focusRerollResolved: stationFlow.focusRerollResolved === true,
      focusRerollResultLabel: stationFlow.focusRerollResultLabel || "",
      result: station.result || "",
      isNpcAssignment: station.isNpcAssignment === true,
      npcControllerUserId: station.npcController?.userId || "",
      npcControllerName: station.npcControllerName || "",
      rollDetailText: session?.playerMissionBoardRollDetails?.[station.stationKey] || station.rollDetailText || "",
      rollUnavailableReason: station.rollUnavailableReason || "",
      canRollStation: station.canRollStationCheck === true,
      selectedStationOrder: station.selectedActionType,
      selectedStationOrderLabel: station.selectedActionLabel,
      stationOrderCommitted: station.stationOrderCommitted === true,
      isStabilize: station.isStabilize === true,
      stabilizePressureKey: station.stabilizePressureKey || "",
      stabilizePressureLabel: station.stabilizePressureLabel || "",
      focusCapacity,
      focusRemaining,
      focusOptions,
      hasFocusOptions: focusOptions.length > 0,
      selectedFocusAbility: station.selectedFocusAbility || "",
      noFocusRemaining: focusRemaining <= 0 || station.focusSuppressedByHazard === true,
      canSpendFocus: focusRemaining > 0 && focusOptions.length > 0 && !focusSource.spentThisRound && station.focusSuppressedByHazard !== true,
    focusBlocked: station.focusSuppressedByHazard === true,
    focusBlockedReason: station.focusSuppression?.publicReasonText ?? "",
    focusBlockedHazardName: station.focusSuppression?.hazardName ?? "",
      canChooseApproach: false,
      permissionReason: "Waiting for board permissions."
      };
    });
  return {
    hasSession: true,
    sessionKey: normalized.session?.key ?? "",
    eventName: overlayState.eventName,
    roundLabel: overlayState.roundLabel,
    roundTitle: overlayState.roundTitle,
    currentRoundIndex: overlayState.currentRoundIndex,
    currentPhaseLabel: overlayState.roundCompletionState ? humanizeIdentifier(overlayState.roundCompletionState) : "Travel Round",
    shipName: normalized.session?.ship?.actorName || normalized.session?.ship?.name || "Unknown Ship",
    voyageStatus: normalized.session?.status === "completed" ? "Completed" : "In Progress",
    vignette: overlayState.vignette,
    stations,
    hasStations: stations.length > 0,
    pressureGauges: buildTravelPlayerPressureGauges(normalized.session),
    publicHazards,
    hasPublicHazards: publicHazards.length > 0,
    publicShipScars,
    hasPublicShipScars: publicShipScars.length > 0,
    momentum: sanitizeTravelV2MomentumForPlayers(normalized.session?.travelV2Momentum),
    hasMomentum: sanitizeTravelV2MomentumForPlayers(normalized.session?.travelV2Momentum).value > 0,
    focusBacklash: sanitizeTravelV2FocusBacklashForPlayers(normalized.session?.travelV2FocusBacklashRecords),
    hasFocusBacklash: sanitizeTravelV2FocusBacklashForPlayers(normalized.session?.travelV2FocusBacklashRecords).hasRecords,
    supportAssists: sanitizeTravelV2SupportForPlayers(normalized.session?.travelV2SupportRecords),
    supportBacklash: sanitizeTravelV2SupportBacklashForPlayers(normalized.session?.travelV2SupportBacklashRecords),
    hasSupportAssists: sanitizeTravelV2SupportForPlayers(normalized.session?.travelV2SupportRecords).hasRecords,
    hasSupportBacklash: sanitizeTravelV2SupportBacklashForPlayers(normalized.session?.travelV2SupportBacklashRecords).hasRecords,
    partyAlerts: buildTravelPlayerPartyAlerts({ stations, publicHazards, publicShipScars, reactionRecords }),
    hasPartyAlerts: buildTravelPlayerPartyAlerts({ stations, publicHazards, publicShipScars, reactionRecords }).length > 0
  };
}

function deriveTravelStationStateLabel({ result = null, assigned = false, stationOrderCommitted = false, pendingReaction = false } = {}) {
  if (result === "skipped") return "Skipped / Not Participating";
  if (pendingReaction) return "Reaction Available";
  if (result) return "Rolled";
  if (!assigned) return "Unassigned";
  if (stationOrderCommitted) return "Ready to Roll";
  return "Choosing";
}

export function clearTravelEventRunnerStationResult(session, roundIndex, stationKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const index = Math.min(Math.max(Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : normalized.session.currentRoundIndex, 0), normalized.session.roundResults.length - 1);
  if (!Object.hasOwn(normalized.session.roundResults[index]?.stationResults ?? {}, stationKey)) return { ok: false, errors: [`Station "${stationKey}" is not active in round ${index + 1}.`], warnings: [], session: normalized.session };
  const nextSession = cloneData(normalized.session);
  nextSession.roundResults[index].stationResults[stationKey] = null;
  nextSession.playerMissionBoardRollDetails = { ...(nextSession.playerMissionBoardRollDetails ?? {}) };
  delete nextSession.playerMissionBoardRollDetails[stationKey];
  const focusBacklashUpdate = syncTravelV2FocusBacklashRecordsForStationResult(nextSession, index, stationKey, { ...options, cleared: true });
  if (!focusBacklashUpdate.ok) return focusBacklashUpdate;
  Object.assign(nextSession, focusBacklashUpdate.session);
  const supportUpdate = syncTravelV2SupportRecordsForStationResult(nextSession, index, stationKey, { ...options, cleared: true });
  if (!supportUpdate.ok) return supportUpdate;
  Object.assign(nextSession, supportUpdate.session);
  const supportBacklashUpdate = syncTravelV2SupportBacklashRecordsForStationResult(nextSession, index, stationKey, { ...options, cleared: true });
  if (!supportBacklashUpdate.ok) return supportBacklashUpdate;
  Object.assign(nextSession, supportBacklashUpdate.session);
  nextSession.updatedAt = nowIso(options);
  nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function setTravelEventRunnerStationResult(session, roundIndex, stationKey, result, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  if (!TRAVEL_EVENT_RUNNER_RESULT_VALUES.includes(result)) return { ok: false, errors: [`Invalid travel runner station result "${result}".`], warnings: [], session: normalized.session };
  const index = Number(roundIndex);
  if (!Number.isInteger(index) || !normalized.session.roundResults[index]) return { ok: false, errors: [`Travel runner round ${roundIndex} does not exist.`], warnings: [], session: normalized.session };
  if (!Object.hasOwn(normalized.session.roundResults[index].stationResults, stationKey)) return { ok: false, errors: [`Station "${stationKey}" is not active in round ${index + 1}.`], warnings: [], session: normalized.session };
  let nextSession = cloneData(normalized.session);
  nextSession.roundResults[index].stationResults[stationKey] = result;
  const stationAction = normalizeTravelStationAction(nextSession.roundResults[index].stationActions?.[stationKey], stationKey, nextSession.event.rounds[index]);
  if (stationAction.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.HAZARD_RESPONSE && stationAction.hazardRecordId) {
    const hazardUpdate = resolveTravelV2HazardResponse(nextSession, stationAction.hazardRecordId, stationKey, result, { ...options, roundIndex: index });
    if (!hazardUpdate.ok) return { ...hazardUpdate, warnings: hazardUpdate.warnings ?? [] };
    nextSession = cloneData(hazardUpdate.session);
    nextSession.roundResults[index].stationResults[stationKey] = result;
  }
  const stabilizeUpdate = syncTravelStabilizeResolutionRecordsForStationResult(nextSession, index, stationKey, options);
  if (!stabilizeUpdate.ok) return stabilizeUpdate;
  Object.assign(nextSession, stabilizeUpdate.session);
  const reactionUpdate = syncTravelReactionPromptsForStationResult(nextSession, index, stationKey, options);
  if (!reactionUpdate.ok) return reactionUpdate;
  Object.assign(nextSession, reactionUpdate.session);
  const momentumUpdate = syncTravelV2MomentumAwardsForStationResult(nextSession, index, stationKey, options);
  if (!momentumUpdate.ok) return momentumUpdate;
  Object.assign(nextSession, momentumUpdate.session);
  const focusBacklashUpdate = syncTravelV2FocusBacklashRecordsForStationResult(nextSession, index, stationKey, options);
  if (!focusBacklashUpdate.ok) return focusBacklashUpdate;
  Object.assign(nextSession, focusBacklashUpdate.session);
  const supportUpdate = syncTravelV2SupportRecordsForStationResult(nextSession, index, stationKey, options);
  if (!supportUpdate.ok) return supportUpdate;
  Object.assign(nextSession, supportUpdate.session);
  const supportBacklashUpdate = syncTravelV2SupportBacklashRecordsForStationResult(nextSession, index, stationKey, options);
  if (!supportBacklashUpdate.ok) return supportBacklashUpdate;
  Object.assign(nextSession, supportBacklashUpdate.session);
  nextSession.updatedAt = nowIso(options);
  nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

function collectTravelV2RoundResolutionBlockers(session = {}, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return { ok: false, errors: normalized.errors ?? ["No active Travel v2 runner session."], warnings: [], report: null };
  const activeSession = normalized.session;
  const currentRoundIndex = Math.max(0, Number(activeSession.currentRoundIndex ?? 0) || 0);
  const currentRound = activeSession.event?.rounds?.[currentRoundIndex] ?? null;
  const activeStations = Array.isArray(currentRound?.activeStations) ? currentRound.activeStations : [];
  const stationResults = activeSession.roundResults?.[currentRoundIndex]?.stationResults ?? {};
  const reactionRecords = normalizeTravelReactionPromptRecords(activeSession.reactionPrompts, options).records
    .filter((record) => Number(record.roundIndex) === currentRoundIndex);
  const pendingReactionRecords = reactionRecords.filter((record) => record.status === "pending");
  const acceptedFocusRecords = reactionRecords.filter((record) => record.status === "accepted");
  const rerollNeededRecords = acceptedFocusRecords.filter((record) => !record.rerollResult);
  const rerollResolvedRecords = reactionRecords.filter((record) => Boolean(record.rerollResult));
  const unresolvedStations = activeStations.filter((stationKey) => !stationResults[stationKey]);
  const roundFinalizationState = prepareTravelV2RoundFinalizationState(activeSession, options);
  const roundOutcomeKey = roundFinalizationState.effectiveOutcomeKey
    || (roundFinalizationState.pressureApplicationRecord?.outcomeKey ?? "")
    || "";
  const hasFinalizationRecord = Boolean(roundFinalizationState.finalizationRecord);
  const errors = [];
  const warnings = [];
  const lockInGuard = inspectTravelV2StationActionLockInFinalizationGuard(activeSession, options);
  if (unresolvedStations.length > 0) errors.push("Resolve active stations before finalizing this round.");
  if (pendingReactionRecords.length > 0) errors.push("Resolve pending Focus reaction prompts before finalizing this round.");
  if (rerollNeededRecords.length > 0) errors.push("Resolve accepted Focus rerolls before finalizing this round.");
  if (lockInGuard.ready !== true) errors.push(lockInGuard.gmMessage);
  for (const record of rerollNeededRecords) {
    if (!stationResults[record.stationKey]) errors.push(`${record.stationKey} requires a Focus reroll result before round resolution.`);
  }
  if (hasFinalizationRecord) {
    for (const stationKey of activeStations) {
      const hasResult = Boolean(stationResults[stationKey]);
      const hasResolvedReroll = rerollResolvedRecords.some((record) => record.stationKey === stationKey);
      if (!hasResult && !hasResolvedReroll) errors.push(`${stationKey} has no result but the current round appears finalized.`);
    }
  }
  const preparedConsequenceQueue = prepareTravelV2PendingConsequenceQueue(activeSession, options);
  const pendingConsequenceCount = (preparedConsequenceQueue.pendingCount ?? 0)
    + recordsFromTravelV2Container(activeSession.travelV2ConsequenceFollowups).filter((record) => !["reviewed", "resolved", "dismissed"].includes(record?.status)).length;
  if (hasFinalizationRecord && pendingConsequenceCount > 0) errors.push("Review pending consequences before advancing.");
  const canResolveRound = errors.length === 0 && roundFinalizationState.canFinalize === true;
  const canAdvanceRound = errors.length === 0 && hasFinalizationRecord && currentRoundIndex < (activeSession.event?.rounds?.length ?? 0) - 1 && activeSession.status !== "completed";
  const nextRoundNumber = currentRoundIndex + 2;
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    report: {
      sessionKey: activeSession.key ?? "",
      currentRoundIndex,
      stationCount: activeStations.length,
      resolvedStationCount: activeStations.length - unresolvedStations.length,
      unresolvedStationCount: unresolvedStations.length,
      pendingReactionCount: pendingReactionRecords.length,
      acceptedFocusCount: acceptedFocusRecords.length,
      rerollNeededCount: rerollNeededRecords.length,
      rerollResolvedCount: rerollResolvedRecords.length,
      canResolveRound,
      canAdvanceRound,
      roundOutcomeKey,
      roundOutcomeLabel: roundOutcomeKey ? humanizeIdentifier(roundOutcomeKey) : "",
      unresolvedStations,
      roundResolutionReady: errors.length === 0,
      roundResolutionBlocked: errors.length > 0,
      roundResolutionBlockers: errors,
      roundResolutionPlayerMessage: lockInGuard.playerMessage,
      roundResolutionPlayerBlockers: lockInGuard.ready === true ? [] : lockInGuard.playerBlockedReasons,
      stationActionLockInReadyForFinalization: lockInGuard.ready === true,
      roundResolutionWarningLabel: errors[0] ?? "Round can be finalized.",
      canFinalizeCurrentRound: canResolveRound,
      canAdvanceCurrentRound: canAdvanceRound,
      finalizationReadinessLabel: errors[0] ?? "Ready to finalize this round.",
      consequenceFlowReady: hasFinalizationRecord && pendingConsequenceCount === 0,
      consequenceFlowBlocked: hasFinalizationRecord && pendingConsequenceCount > 0,
      consequenceFlowBlockers: hasFinalizationRecord && pendingConsequenceCount > 0 ? ["Pending consequences require GM review."] : [],
      consequenceFlowWarningLabel: hasFinalizationRecord ? (pendingConsequenceCount > 0 ? "Review pending consequences before advancing." : (canAdvanceRound ? `Ready to advance to Round ${nextRoundNumber}.` : (errors[0] ?? "No pending consequences. Ready to advance."))) : (errors[0] ?? "Finalize this round before advancing."),
      canReviewConsequences: hasFinalizationRecord && pendingConsequenceCount > 0,
      canApplyPendingConsequences: hasFinalizationRecord && pendingConsequenceCount > 0,
      canDismissPendingConsequences: hasFinalizationRecord && pendingConsequenceCount > 0,
      canAdvanceAfterConsequences: canAdvanceRound,
      notes: canResolveRound || canAdvanceRound ? ["Round resolution readiness checks passed."] : ["Resolve active stations, Focus prompts, required rerolls, and pending consequences before advancing."]
    }
  };
}

export function inspectTravelV2RoundResolutionReadiness(session = null, options = {}) {
  const collected = collectTravelV2RoundResolutionBlockers(session, options);
  if (!collected.report) return { ok: false, errors: collected.errors, warnings: collected.warnings, sessionKey: "", currentRoundIndex: -1, stationCount: 0, resolvedStationCount: 0, unresolvedStationCount: 0, pendingReactionCount: 0, acceptedFocusCount: 0, rerollNeededCount: 0, rerollResolvedCount: 0, canResolveRound: false, canAdvanceRound: false, roundOutcomeKey: "", roundOutcomeLabel: "", pendingConsequenceCount: 0, playerSummarySafe: false, notes: [] };
  const playerSafeState = options.playerSafeState ?? {};
  const pendingConsequenceCount = recordsFromTravelV2Container(session?.travelV2PendingConsequenceQueue).length
    + recordsFromTravelV2Container(session?.travelV2ConsequenceFollowups).filter((record) => !["reviewed", "resolved", "dismissed"].includes(record.status)).length
    + recordsFromTravelV2Container(session?.travelV2FocusBacklashRecords).filter((record) => ["pending", ""].includes(record.status ?? "")).length;
  const playerSafeJson = JSON.stringify(playerSafeState ?? {});
  const forbiddenTerms = ["pendingConsequenceQueue", "queueGroup", "consequenceCatalog", "gmOnly", "internalSeverity", "unrevealedHazard", "shipScarControls", "managementAction", "gmItemGroups", "catalogSuggestions", "selectedConsequenceApplyPreview"];
  const leakedTerms = forbiddenTerms.filter((term) => playerSafeJson.includes(term));
  const errors = [...collected.errors];
  if (leakedTerms.length > 0) errors.push(`Player-safe Travel v2 state exposes GM-only round resolution term(s): ${leakedTerms.join(", ")}.`);
  return {
    ok: errors.length === 0,
    errors,
    warnings: collected.warnings,
    ...collected.report,
    pendingConsequenceCount,
    playerSummarySafe: leakedTerms.length === 0,
    notes: [...(collected.report.notes ?? []), ...(leakedTerms.length === 0 ? ["Player-safe round summary scan found no GM-only consequence queue terms."] : [])]
  };
}

function recordsFromTravelV2Container(container) {
  if (Array.isArray(container)) return container;
  if (Array.isArray(container?.records)) return container.records;
  return [];
}

export function setTravelEventRunnerStationSkillApproach(session, roundIndex, stationKey, skill, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const index = Number(roundIndex);
  if (!Number.isInteger(index) || !normalized.session.roundResults[index]) return { ok: false, errors: [`Travel runner round ${roundIndex} does not exist.`], warnings: [], session: normalized.session };
  const round = normalized.session.event.rounds[index];
  if (!round?.activeStations?.includes(stationKey)) return { ok: false, errors: [`Station "${stationKey}" is not active in round ${index + 1}.`], warnings: [], session: normalized.session };
  const prompt = round.stationPrompts[stationKey] ?? { stationKey };
  const card = (Array.isArray(round.stationCards) ? round.stationCards : []).find((entry) => entry?.stationKey === stationKey) ?? normalizeStationCardForRunner(stationKey, null, prompt);
  const approaches = Array.isArray(card.skillApproaches) ? card.skillApproaches.filter((entry) => isPlainObject(entry) && entry.skill) : [];
  if (approaches.length > 0 && !approaches.some((entry) => entry.skill === skill)) return { ok: false, errors: [`Skill approach "${skill}" is not available for ${stationKey}.`], warnings: [], session: normalized.session };
  const nextSession = cloneData(normalized.session);
  nextSession.roundResults[index].selectedStationSkills = normalizeSelectedStationSkills(nextSession.roundResults[index], round);
  nextSession.roundResults[index].selectedStationSkills[stationKey] = typeof skill === "string" ? skill : "";
  nextSession.roundResults[index].selectedStationOptionLabels = normalizeSelectedStationOptionLabels(nextSession.roundResults[index], round);
  nextSession.roundResults[index].selectedStationOptionLabels[stationKey] = approaches.find((entry) => entry.skill === skill)?.label ?? "";
  nextSession.roundResults[index].stationActions = normalizeStationActions(nextSession.roundResults[index], round);
  nextSession.roundResults[index].stationActions[stationKey] = eventApproach();
  nextSession.updatedAt = nowIso(options);
  nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function setTravelEventRunnerStationAction(session, roundIndex, stationKey, actionType, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const index = Number(roundIndex);
  if (!Number.isInteger(index) || !normalized.session.roundResults[index]) return { ok: false, errors: [`Travel runner round ${roundIndex} does not exist.`], warnings: [], session: normalized.session };
  const round = normalized.session.event.rounds[index];
  if (!round?.activeStations?.includes(stationKey)) return { ok: false, errors: [`Station "${stationKey}" is not active in round ${index + 1}.`], warnings: [], session: normalized.session };
  if (![ARCFLIGHT_TRAVEL_STATION_ACTIONS.EVENT_APPROACH, ARCFLIGHT_TRAVEL_STATION_ACTIONS.STABILIZE, ARCFLIGHT_TRAVEL_STATION_ACTIONS.HAZARD_RESPONSE, ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT].includes(actionType)) {
    return { ok: false, errors: [`Invalid travel runner station action "${actionType}".`], warnings: [], session: normalized.session };
  }
  if (actionType === ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT) {
    const targetValidation = validateTravelSupportTarget(
      normalized.session,
      index,
      stationKey,
      typeof options.targetStationKey === "string" ? options.targetStationKey : "",
      options
    );
    if (!targetValidation.ok) return targetValidation;
  }
  const previousAction = normalizeTravelStationAction(
    normalized.session.roundResults?.[index]?.stationActions?.[stationKey],
    stationKey,
    round
  );
  const nextSession = cloneData(normalized.session);
  nextSession.roundResults[index].stationActions = normalizeStationActions(nextSession.roundResults[index], round);
  nextSession.roundResults[index].stationActions[stationKey] = actionType === ARCFLIGHT_TRAVEL_STATION_ACTIONS.STABILIZE
    ? stabilize(getTravelStationStabilizePressureKey(stationKey, round))
    : (actionType === ARCFLIGHT_TRAVEL_STATION_ACTIONS.HAZARD_RESPONSE ? hazardResponse() : (actionType === ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT ? support(options.targetStationKey ?? "", options) : eventApproach()));
  nextSession.roundResults[index].stationOrderCommitments = normalizeStationOrderCommitments(nextSession.roundResults[index], round);
  nextSession.roundResults[index].stationOrderCommitments[stationKey] = { committed: false, source: "", selectedFocusAbility: "" };
  const stabilizeUpdate = syncTravelStabilizeResolutionRecordsForStationResult(nextSession, index, stationKey, options);
  if (!stabilizeUpdate.ok) return stabilizeUpdate;
  Object.assign(nextSession, stabilizeUpdate.session);
  const supportUpdate = syncTravelV2SupportRecordsForStationResult(nextSession, index, stationKey, options);
  if (!supportUpdate.ok) return supportUpdate;
  Object.assign(nextSession, supportUpdate.session);
  const supportBacklashUpdate = syncTravelV2SupportBacklashRecordsForStationResult(nextSession, index, stationKey, options);
  if (!supportBacklashUpdate.ok) return supportBacklashUpdate;
  Object.assign(nextSession, supportBacklashUpdate.session);
  if (
    previousAction.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT
    && previousAction.targetStationKey
    && (
      actionType !== ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT
      || previousAction.targetStationKey !== options.targetStationKey
    )
  ) {
    const supportRecords = normalizeTravelV2SupportRecords(nextSession.travelV2SupportRecords, options).records;
    let dismissedSupportAssist = false;
    for (const record of supportRecords) {
      if (record.status !== "pending" || !supportAssistRecordsMatch(record, index, stationKey, previousAction.targetStationKey)) continue;
      record.status = "dismissed";
      record.resolvedAt = nowIso(options);
      record.resolvedByUserId = options.userId ?? globalThis.game?.user?.id ?? "";
      record.resolvedByUserName = options.userName ?? globalThis.game?.user?.name ?? "";
      record.resolutionNote = "Support station action changed before the assist was used.";
      dismissedSupportAssist = true;
    }
    if (dismissedSupportAssist) {
      nextSession.travelV2SupportRecords = { records: supportRecords };
      nextSession.updatedAt = nowIso(options);
      nextSession.summary = null;
    }
  }
  nextSession.updatedAt = nowIso(options);
  nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function commitTravelEventRunnerStationOrder(session, roundIndex, stationKey, optionKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const index = Number(roundIndex);
  const round = normalized.session.event.rounds[index];
  const roundResult = normalized.session.roundResults[index];
  if (!round || !roundResult) return { ok: false, errors: [`Travel runner round ${roundIndex} does not exist.`], warnings: [], session: normalized.session };
  const stationOption = prepareStationRows(normalized.session, round, roundResult, options)
    .find((row) => row.stationKey === stationKey)?.stationOptions
    ?.find((option) => option.optionKey === optionKey);
  if (!stationOption) return { ok: false, errors: [`Station option "${optionKey}" is not available for ${stationKey}.`], warnings: [], session: normalized.session };
  if (stationOption.suppressedByHazard || stationOption.disabled || stationOption.unavailable) return { ok: false, errors: [`Station option "${stationOption.label}" is suppressed by an active hazard.`], warnings: [], session: normalized.session };
  const previousCommitment = normalizeStationOrderCommitments(roundResult, round)[stationKey];
  const actionOptions = stationOption.actionType === ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT
    ? { ...options, targetStationKey: stationOption.targetStationKey, supportKey: stationOption.supportKey, supportMode: stationOption.supportMode, label: stationOption.label, helpText: stationOption.helpText }
    : options;
  const actionUpdate = setTravelEventRunnerStationAction(normalized.session, index, stationKey, stationOption.actionType, actionOptions);
  if (!actionUpdate.ok) return actionUpdate;
  let nextSession = cloneData(actionUpdate.session);
  nextSession.roundResults[index].selectedStationSkills = normalizeSelectedStationSkills(nextSession.roundResults[index], round);
  nextSession.roundResults[index].selectedStationSkills[stationKey] = stationOption.skill;
  nextSession.roundResults[index].selectedStationOptionLabels = normalizeSelectedStationOptionLabels(nextSession.roundResults[index], round);
  nextSession.roundResults[index].selectedStationOptionLabels[stationKey] = stationOption.label;
  if (stationOption.actionType === ARCFLIGHT_TRAVEL_STATION_ACTIONS.STABILIZE) {
    nextSession.roundResults[index].stationActions[stationKey] = stabilize(stationOption.stabilizePressureKey);
  } else if (stationOption.actionType === ARCFLIGHT_TRAVEL_STATION_ACTIONS.HAZARD_RESPONSE) {
    nextSession.roundResults[index].stationActions[stationKey] = hazardResponse(stationOption.hazardRecordId ?? "", stationOption.hazardName ?? "");
  } else if (stationOption.actionType === ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT) {
    nextSession.roundResults[index].stationActions[stationKey] = support(stationOption.targetStationKey ?? "", {
      supportKey: stationOption.supportKey ?? stationOption.optionKey ?? "",
      supportMode: stationOption.supportMode ?? "assist",
      label: stationOption.label ?? "",
      helpText: stationOption.helpText ?? ""
    });
  }
  nextSession.roundResults[index].stationOrderCommitments = normalizeStationOrderCommitments(nextSession.roundResults[index], round);
  const hazardModifiers = prepareTravelV2ActiveHazardModifiers(nextSession, { ...options, roundIndex: index });
  const requestedFocusAbility = hazardModifiers.suppressFocus ? "" : (typeof options.selectedFocusAbility === "string" ? options.selectedFocusAbility : "");
  if (requestedFocusAbility && previousCommitment?.committed && previousCommitment.selectedFocusAbility === requestedFocusAbility) {
    // Preserve the original spend when the same committed order is submitted again.
  } else if (requestedFocusAbility) {
    const focusUpdate = commitTravelEventRunnerStationFocus(nextSession, index, stationKey, requestedFocusAbility, options);
    if (!focusUpdate.ok) return focusUpdate;
    nextSession = cloneData(focusUpdate.session);
  } else {
    const clearFocus = clearTravelEventRunnerStationFocusSelection(nextSession, index, stationKey, options);
    if (!clearFocus.ok) return clearFocus;
    nextSession = cloneData(clearFocus.session);
  }
  nextSession.roundResults[index].stationOrderCommitments = normalizeStationOrderCommitments(nextSession.roundResults[index], round);
  nextSession.roundResults[index].stationOrderCommitments[stationKey] = {
    committed: true,
    source: options.source === "player" ? "player" : "",
    selectedFocusAbility: requestedFocusAbility
  };
  const focusEffectUpdate = syncTravelFocusEffectRecordsForStationOrder(nextSession, index, stationKey, options);
  if (!focusEffectUpdate.ok) return focusEffectUpdate;
  nextSession = cloneData(focusEffectUpdate.session);
  const stabilizeUpdate = syncTravelStabilizeResolutionRecordsForStationResult(nextSession, index, stationKey, options);
  if (!stabilizeUpdate.ok) return stabilizeUpdate;
  nextSession = cloneData(stabilizeUpdate.session);
  nextSession.updatedAt = nowIso(options);
  nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function advanceTravelEventRunnerRound(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const readiness = collectTravelV2RoundResolutionBlockers(normalized.session, options);
  if (options.force !== true) {
    const roundFinalizationState = prepareTravelV2RoundFinalizationState(normalized.session, options);
    const currentRoundIndex = Number(normalized.session.currentRoundIndex ?? 0);
    const advanceErrors = [...readiness.errors];
    if (!roundFinalizationState.finalizationRecord) advanceErrors.push("Finalize this round before advancing.");
    if (roundFinalizationState.finalizationRecord && roundFinalizationState.isPressureApplied !== true && !roundFinalizationState.pressureApplicationRecord) advanceErrors.push("Apply pressure/finalization before advancing.");
    if (currentRoundIndex >= (normalized.session.event?.rounds?.length ?? 0) - 1) advanceErrors.push("No next round is available.");
    if (advanceErrors.length > 0) return { ok: false, errors: advanceErrors, warnings: readiness.warnings, session: normalized.session, readiness: readiness.report };
  }
  const nextSession = cloneData(normalized.session);
  nextSession.currentRoundIndex = Math.min(nextSession.currentRoundIndex + 1, nextSession.event.rounds.length - 1);
  nextSession.roundPhase = normalizeTravelRunnerRoundPhase();
  nextSession.updatedAt = nowIso(options);
  nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function retreatTravelEventRunnerRound(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  nextSession.currentRoundIndex = Math.max(nextSession.currentRoundIndex - 1, 0);
  nextSession.roundPhase = normalizeTravelRunnerRoundPhase();
  nextSession.updatedAt = nowIso(options);
  nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function setTravelEventRunnerRoundPhase(session, roundPhase, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  nextSession.roundPhase = normalizeTravelRunnerRoundPhase(roundPhase);
  nextSession.updatedAt = nowIso(options);
  nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function advanceTravelEventRunnerRoundPhase(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  return setTravelEventRunnerRoundPhase(normalized.session, getNextTravelRoundSegment(normalized.session.roundPhase), options);
}

export function retreatTravelEventRunnerRoundPhase(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  return setTravelEventRunnerRoundPhase(normalized.session, getPreviousTravelRoundSegment(normalized.session.roundPhase), options);
}

function scoreSession(session) {
  return session.roundResults.reduce((total, round, roundIndex) => {
    const actions = normalizeStationActions(round, session.event.rounds[roundIndex]);
    return total + Object.entries(round.stationResults).reduce((subtotal, [stationKey, result]) => (
      subtotal + (actions[stationKey]?.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.EVENT_APPROACH ? (RESULT_SCORES[result] ?? 0) : 0)
    ), 0);
  }, 0);
}

function mapScoreToFinalOutcome(score) {
  // MVP mapping is intentionally simple and transparent: each station result is
  // worth -2..+2, then the final total chooses a canonical final outcome.
  if (score >= 4) return "criticalSuccess";
  if (score > 0) return "success";
  if (score === 0) return "mixed";
  if (score <= -4) return "criticalFailure";
  return "failure";
}

export function summarizeTravelEventRunnerSession(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return { ...normalized, summary: null, json: "" };
  const activeSession = normalized.session;
  const totalScore = scoreSession(activeSession);
  const suggestedFinalOutcome = mapScoreToFinalOutcome(totalScore);
  const finalOutcome = activeSession.event.finalOutcomes[suggestedFinalOutcome] ?? { key: suggestedFinalOutcome, label: FINAL_OUTCOME_LABELS[suggestedFinalOutcome], text: "", proposedEffects: [] };
  const summary = {
    version: TRAVEL_EVENT_RUNNER_SESSION_VERSION,
    event: {
      key: activeSession.event.key,
      name: activeSession.event.name,
      category: activeSession.event.category,
      baseDC: activeSession.event.baseDC
    },
    startedAt: activeSession.startedAt,
    completedAt: activeSession.completedAt || nowIso(options),
    totalScore,
    suggestedFinalOutcome,
    suggestedFinalOutcomeLabel: finalOutcome.label || FINAL_OUTCOME_LABELS[suggestedFinalOutcome],
    finalOutcomeText: finalOutcome.text || "",
    stagedProposedEffects: cloneData(finalOutcome.proposedEffects ?? []),
    stagedProposedEffectRows: (finalOutcome.proposedEffects ?? []).map((effect, index) => ({ index, json: JSON.stringify(effect, null, 2) })),
    focusEffectRecords: cloneData(activeSession.focusEffectRecords.records),
    rounds: activeSession.roundResults.map((roundResult, index) => ({
      roundIndex: index,
      roundNumber: roundResult.roundNumber,
      title: roundResult.title,
      stationResults: cloneData(roundResult.stationResults),
      stationActions: cloneData(roundResult.stationActions),
      stationOrderCommitments: cloneData(roundResult.stationOrderCommitments)
    }))
  };
  return { ok: true, errors: [], warnings: [], session: activeSession, summary };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatEffectForReport(effect, index) {
  const label = typeof effect?.label === "string" && effect.label.trim() ? effect.label.trim() : `Proposed Effect ${index + 1}`;
  return { index, label, json: JSON.stringify(effect ?? {}, null, 2) };
}

export function prepareTravelEventResourceEffectPreview(effect, shipOrResources = null, options = {}) {
  const resources = resolveReviewResources(shipOrResources ?? options.ship ?? options.resources ?? null);
  const resource = effect?.resource;
  const mode = effect?.mode;
  const value = Number(effect?.value);
  const currentValue = resources && Object.hasOwn(resources, resource) && Number.isFinite(Number(resources[resource])) ? Number(resources[resource]) : null;
  let previewValue = currentValue == null || !Number.isFinite(value) ? null : (mode === "set" ? value : currentValue + value);
  const warnings = [];
  const actor = options.ship ?? null;
  if (actor && currentValue != null && Number.isFinite(value)) {
    try {
      const changes = { [resource]: (mode === "set" ? value : currentValue + value) - currentValue };
      const helperPreview = previewShipTravelResourceChange(actor, changes);
      previewValue = helperPreview.after?.[resource] ?? previewValue;
      warnings.push(...(helperPreview.warnings ?? []));
    } catch (_error) {
      // Review previews can also run against plain resource snapshots.
    }
  }
  const maxKey = getResourceMaxKey(resource);
  const maxValue = maxKey && resources && Number.isFinite(Number(resources[maxKey])) ? Number(resources[maxKey]) : null;
  if (previewValue != null && previewValue < 0) warnings.push(`${resource} preview value ${previewValue} is below minimum 0.`);
  if (previewValue != null && maxValue != null && maxValue > 0 && previewValue > maxValue) warnings.push(`${resource} preview value ${previewValue} exceeds known maximum ${maxValue}.`);
  return { resources, currentValue, previewValue, hasCurrentValue: currentValue != null, hasPreviewValue: previewValue != null, maxValue, warnings };
}

export function normalizeTravelEventProposedEffectForReview(effect, index, options = {}) {
  const rawJson = JSON.stringify(effect ?? null, null, 2);
  const label = typeof effect?.label === "string" && effect.label.trim() ? effect.label.trim() : `Staged Effect ${index + 1}`;
  const base = { index, displayIndex: index + 1, label, type: typeof effect?.type === "string" ? effect.type : "unsupported", resource: "", mode: "", value: null, currentValue: null, previewValue: null, hasCurrentValue: false, hasPreviewValue: false, status: "unsupported", supported: false, warnings: [], raw: cloneData(effect), rawJson };
  if (!isPlainObject(effect)) return { ...base, status: "unsupported", warnings: ["Effect is not a data object."] };
  if (effect.type === "note") return { ...base, type: "note", text: typeof effect.text === "string" ? effect.text : "", status: "note", supported: true };
  if (effect.type !== "resource") return base;

  const value = Number(effect.value);
  const warnings = [];
  if (!REVIEW_RESOURCE_KEYS.includes(effect.resource)) warnings.push(`Unsupported resource "${effect.resource ?? "<missing>"}".`);
  if (!REVIEW_RESOURCE_MODES.includes(effect.mode)) warnings.push(`Unsupported resource mode "${effect.mode ?? "<missing>"}".`);
  if (!Number.isFinite(value)) warnings.push(`Resource effect value "${effect.value ?? "<missing>"}" is not numeric.`);
  if (warnings.length) return { ...base, type: "resource", resource: effect.resource ?? "", mode: effect.mode ?? "", value: effect.value ?? null, status: "invalid", warnings };

  const preview = prepareTravelEventResourceEffectPreview(effect, options.ship ?? options.resources ?? null, options);
  return { ...base, type: "resource", resource: effect.resource, mode: effect.mode, value, currentValue: preview.currentValue, previewValue: preview.previewValue, hasCurrentValue: preview.hasCurrentValue, hasPreviewValue: preview.hasPreviewValue, status: "ready", supported: true, warnings: preview.warnings };
}

export function prepareTravelEventStagedEffectReview(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return { ...normalized, available: false, reason: normalized.errors?.[0] ?? "Travel Event Runner session is malformed.", review: null };
  if (normalized.session.status !== "completed") return { ok: true, errors: [], warnings: [], session: normalized.session, available: false, reason: "Staged consequence review is unavailable until the runner session is completed.", review: null };
  const summarized = summarizeTravelEventRunnerSession(normalized.session, options);
  const summary = summarized.summary;
  const effects = Array.isArray(summary?.stagedProposedEffects) ? summary.stagedProposedEffects : [];
  const rows = effects.map((effect, index) => normalizeTravelEventProposedEffectForReview(effect, index, options));
  const supportedEffectCount = rows.filter((row) => row.supported).length;
  const unsupportedEffectCount = rows.length - supportedEffectCount;
  const review = {
    available: true,
    eventName: summary.event.name,
    finalOutcomeKey: summary.suggestedFinalOutcome,
    finalOutcomeLabel: summary.suggestedFinalOutcomeLabel,
    effectCount: rows.length,
    supportedEffectCount,
    unsupportedEffectCount,
    notAppliedWarning: REVIEW_NOT_APPLIED_WARNING,
    rows
  };
  return { ok: true, errors: [], warnings: [], session: normalized.session, available: true, review };
}

export function renderTravelEventStagedEffectReviewMarkdown(session, options = {}) {
  const prepared = prepareTravelEventStagedEffectReview(session, options);
  if (!prepared.available || !prepared.review) return { ...prepared, markdown: "" };
  const r = prepared.review;
  const lines = [`# Staged Consequence Review — ${r.eventName}`, "", `**${r.notAppliedWarning}**`, "", `- **Final Outcome:** ${r.finalOutcomeLabel}`, `- **Effect Count:** ${r.effectCount}`, `- **Supported Effects:** ${r.supportedEffectCount}`, `- **Unsupported Effects:** ${r.unsupportedEffectCount}`];
  if (!r.rows.length) lines.push("", "No proposed effects are attached to the final outcome.");
  for (const row of r.rows) {
    lines.push("", `## ${row.displayIndex}. ${row.label}`, `- **Type:** ${row.type}`, `- **Status:** ${row.status}`, `- **Resource:** ${valueDisplay(row.resource)}`, `- **Mode:** ${valueDisplay(row.mode)}`, `- **Value:** ${valueDisplay(row.value)}`, `- **Current Value:** ${valueDisplay(row.currentValue)}`, `- **Preview Value:** ${valueDisplay(row.previewValue)}`);
    if (row.warnings.length) lines.push(`- **Warnings:** ${row.warnings.join("; ")}`);
    lines.push("", "```json", row.rawJson, "```");
  }
  return { ...prepared, markdown: lines.join("\n") };
}

export function renderTravelEventStagedEffectReviewHtml(session, options = {}) {
  const prepared = prepareTravelEventStagedEffectReview(session, options);
  if (!prepared.available || !prepared.review) return { ...prepared, html: "" };
  const r = prepared.review;
  const rows = r.rows.length ? r.rows.map((row) => `<article class="arcflight-travel-runner-review__effect"><h3>${escapeHtml(row.displayIndex)}. ${escapeHtml(row.label)}</h3><dl><dt>Type</dt><dd>${escapeHtml(row.type)}</dd><dt>Status</dt><dd>${escapeHtml(row.status)}</dd><dt>Resource</dt><dd>${escapeHtml(valueDisplay(row.resource))}</dd><dt>Mode</dt><dd>${escapeHtml(valueDisplay(row.mode))}</dd><dt>Value</dt><dd>${escapeHtml(valueDisplay(row.value))}</dd><dt>Current Value</dt><dd>${escapeHtml(valueDisplay(row.currentValue))}</dd><dt>Preview Value</dt><dd>${escapeHtml(valueDisplay(row.previewValue))}</dd></dl>${row.warnings.length ? `<p><strong>Warnings:</strong> ${escapeHtml(row.warnings.join("; "))}</p>` : ""}<pre>${escapeHtml(row.rawJson)}</pre></article>`).join("") : "<p>No proposed effects are attached to the final outcome.</p>";
  const html = `<section class="arcflight-travel-runner-review"><h1>Staged Consequence Review — ${escapeHtml(r.eventName)}</h1><p><strong>${escapeHtml(r.notAppliedWarning)}</strong></p><ul><li><strong>Final Outcome:</strong> ${escapeHtml(r.finalOutcomeLabel)}</li><li><strong>Effect Count:</strong> ${escapeHtml(r.effectCount)}</li><li><strong>Supported Effects:</strong> ${escapeHtml(r.supportedEffectCount)}</li><li><strong>Unsupported Effects:</strong> ${escapeHtml(r.unsupportedEffectCount)}</li></ul>${rows}</section>`;
  return { ...prepared, html };
}

export function prepareTravelEventStagedEffectReviewState(session, options = {}) {
  const review = prepareTravelEventStagedEffectReview(session, options);
  const markdown = review.available ? renderTravelEventStagedEffectReviewMarkdown(session, options).markdown : "";
  const html = review.available ? renderTravelEventStagedEffectReviewHtml(session, options).html : "";
  return { ...review, markdown, html, canCopyMarkdown: review.available, canCopyHtml: review.available };
}

function resolveApplicationActor(actorOrId) {
  if (!actorOrId) return null;
  if (typeof actorOrId === "object") return actorOrId;
  return globalThis.game?.actors?.get?.(String(actorOrId)) ?? null;
}

function getEffectApplicationKey(effectRowOrIndex) {
  if (Number.isInteger(Number(effectRowOrIndex))) return { effectIndex: Number(effectRowOrIndex), effectId: "" };
  const row = effectRowOrIndex ?? {};
  const effectId = typeof row.effectId === "string" && row.effectId.length > 0 ? row.effectId : (typeof row.id === "string" ? row.id : "");
  const effectIndex = Number.isInteger(Number(row.index)) ? Number(row.index) : null;
  return { effectIndex, effectId };
}

function findStagedEffect(session, effectRowOrIndex, options = {}) {
  const summarized = summarizeTravelEventRunnerSession(session, options);
  const effects = Array.isArray(summarized.summary?.stagedProposedEffects) ? summarized.summary.stagedProposedEffects : [];
  const key = getEffectApplicationKey(effectRowOrIndex);
  if (key.effectIndex != null && effects[key.effectIndex] !== undefined) return { effect: effects[key.effectIndex], index: key.effectIndex, effectId: key.effectId };
  if (key.effectId) {
    const index = effects.findIndex((effect) => effect?.id === key.effectId || effect?.effectId === key.effectId);
    if (index >= 0) return { effect: effects[index], index, effectId: key.effectId };
  }
  return { effect: null, index: key.effectIndex, effectId: key.effectId };
}

export function getTravelEventAppliedEffectRecords(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return [];
  return cloneData(normalized.session.appliedEffects?.records ?? []);
}

export function isTravelEventEffectApplied(session, effectIdOrIndex, options = {}) {
  const key = getEffectApplicationKey(effectIdOrIndex);
  return getTravelEventAppliedEffectRecords(session, options).some((record) => {
    if (record.undone === true) return false;
    if (key.effectId) return record.effectId === key.effectId;
    return key.effectIndex != null && record.effectIndex === key.effectIndex;
  });
}

export function markTravelEventEffectApplied(session, appliedRecord, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return normalized;
  const nextSession = cloneData(normalized.session);
  const records = Array.isArray(nextSession.appliedEffects?.records) ? nextSession.appliedEffects.records : [];
  nextSession.appliedEffects = { records: [...records, cloneData(appliedRecord)] };
  nextSession.updatedAt = nowIso(options);
  return { ok: true, errors: [], warnings: [], session: nextSession, record: cloneData(appliedRecord) };
}

function buildResourceEffectChanges(actor, effect) {
  const resources = getShipTravelResources(actor);
  const value = Number(effect.value);
  const target = effect.mode === "set" ? value : resources[effect.resource] + value;
  return { [effect.resource]: target - resources[effect.resource] };
}

export function buildTravelEventAppliedEffectRecord(session, actor, effectRow, beforeAfter, options = {}) {
  const effect = effectRow?.raw ?? effectRow?.effect ?? effectRow;
  const index = Number.isInteger(Number(effectRow?.index)) ? Number(effectRow.index) : null;
  const effectId = typeof effect?.id === "string" ? effect.id : (typeof effect?.effectId === "string" ? effect.effectId : "");
  const effectLabel = typeof effect?.label === "string" && effect.label.trim() ? effect.label.trim() : (index == null ? "Staged Effect" : `Staged Effect ${index + 1}`);
  return {
    applicationId: `${session?.key || session?.event?.key || "runner"}-${effectId || (index ?? "effect")}-${nowIso(options).replace(/[^0-9]/g, "")}`,
    effectId,
    effectIndex: index,
    effectLabel,
    effectType: effect?.type ?? "",
    resource: effect?.resource ?? "",
    mode: effect?.mode ?? "",
    value: Number.isFinite(Number(effect?.value)) ? Number(effect.value) : null,
    actorId: actor?.id ?? "",
    actorName: actor?.name ?? "",
    beforeValue: beforeAfter?.before?.[effect?.resource] ?? null,
    afterValue: beforeAfter?.after?.[effect?.resource] ?? null,
    appliedAt: nowIso(options),
    source: "travel-event-runner",
    undone: false
  };
}

export function prepareTravelEventEffectApplicationState(session, actorOrId = null, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return { ...normalized, available: false, reason: normalized.errors?.[0] ?? "Travel Event Runner session is malformed.", rows: [], records: [] };
  if (normalized.session.status !== "completed") return { ok: true, errors: [], warnings: [], session: normalized.session, available: false, reason: "Manual effect application is unavailable until the runner session is completed.", rows: [], records: getTravelEventAppliedEffectRecords(normalized.session, options) };
  const actor = resolveApplicationActor(actorOrId ?? options.actor ?? options.actorId);
  let actorResources = null;
  let actorValid = false;
  const actorWarning = actor ? "" : "Select an Arcflight ship token or actor to apply effects.";
  if (actor) {
    try {
      actorResources = getShipTravelResources(actor);
      actorValid = true;
    } catch (_error) {
      actorValid = false;
    }
  }
  const review = prepareTravelEventStagedEffectReview(normalized.session, { ...options, resources: actorResources });
  const rows = (review.review?.rows ?? []).map((row) => {
    const applied = isTravelEventEffectApplied(normalized.session, row, options);
    const selectable = actorValid && row.type === "resource" && row.status === "ready" && row.supported === true && !applied;
    const status = applied ? "already applied" : (!actorValid && row.type === "resource" && row.status === "ready" ? "no target" : row.status);
    return { ...row, applied, selectable, status, selected: selectable };
  });
  return {
    ok: true,
    errors: [],
    warnings: actorWarning ? [actorWarning] : [],
    session: normalized.session,
    available: true,
    actor,
    targetActorId: actor?.id ?? "",
    targetActorName: actorValid ? actor.name : "",
    hasTarget: actorValid,
    noTargetReason: actorValid ? "" : (actor ? "Selected actor is not an Arcflight ship." : actorWarning),
    rows,
    records: prepareTravelEventAppliedEffectHistoryState(normalized.session, actor, options).records,
    canApply: rows.some((row) => row.selectable)
  };
}

export async function applyTravelEventRunnerResourceEffect(session, actorOrId, effectRowOrIndex, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return { ...normalized, applied: false };
  if (normalized.session.status !== "completed") return { ok: false, errors: ["Manual effect application is unavailable until the runner session is completed."], warnings: [], session: normalized.session, applied: false };
  const actor = resolveApplicationActor(actorOrId);
  if (!actor) return { ok: false, errors: ["Select an Arcflight ship token or actor to apply effects."], warnings: [], session: normalized.session, applied: false };
  try {
    getShipTravelResources(actor);
  } catch (_error) {
    return { ok: false, errors: ["Selected actor is not an Arcflight ship."], warnings: [], session: normalized.session, applied: false };
  }
  const found = findStagedEffect(normalized.session, effectRowOrIndex, options);
  if (!found.effect) return { ok: false, errors: ["Unknown staged effect id/index."], warnings: [], session: normalized.session, applied: false };
  const row = normalizeTravelEventProposedEffectForReview(found.effect, found.index, { ...options, ship: actor });
  if (!(row.type === "resource" && row.status === "ready" && row.supported === true)) return { ok: false, errors: ["Staged effect is not a supported resource effect."], warnings: row.warnings ?? [], session: normalized.session, applied: false };
  if (isTravelEventEffectApplied(normalized.session, row, options)) return { ok: false, errors: [], warnings: [`${row.label} has already been applied for this runner session.`], session: normalized.session, applied: false, blocked: true, reason: "already-applied" };
  const preview = previewShipTravelResourceChange(actor, buildResourceEffectChanges(actor, found.effect));
  const resources = options.dryRun ? preview.after : await updateShipTravelResources(actor, preview.changes, options.resourceOptions ?? {});
  const record = buildTravelEventAppliedEffectRecord(normalized.session, actor, row, { before: preview.before, after: resources }, options);
  const marked = markTravelEventEffectApplied(normalized.session, record, options);
  return { ok: true, errors: [], warnings: preview.warnings ?? [], session: marked.session, applied: true, record, preview, resources };
}

export function isTravelEventAppliedEffectUndoable(session, actorOrId, appliedRecord, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return { undoable: false, status: "not undoable", warning: normalized.errors?.[0] ?? "Runner session is malformed." };
  const record = appliedRecord ?? {};
  if (record.undone === true) return { undoable: false, status: "undone", warning: record.undoneAt ? `Undone at ${record.undoneAt}.` : "Already undone." };
  if (!record.applicationId) return { undoable: false, status: "not undoable", warning: "Applied record is missing an application id." };
  if (!(record.effectType === "resource" && REVIEW_RESOURCE_KEYS.includes(record.resource) && REVIEW_RESOURCE_MODES.includes(record.mode))) return { undoable: false, status: "not undoable", warning: "Applied record is not a reversible resource effect." };
  const actor = resolveApplicationActor(actorOrId ?? record.actorId);
  if (!actor) return { undoable: false, status: "not undoable", warning: "Target ship actor is missing." };
  let resources;
  try {
    resources = getShipTravelResources(actor);
  } catch (_error) {
    return { undoable: false, status: "not undoable", warning: "Target actor is not an Arcflight ship." };
  }
  const currentValue = resources?.[record.resource];
  if (currentValue !== record.afterValue) return { undoable: false, status: "blocked", warning: "Cannot undo because the ship resource has changed since this effect was applied.", actor, currentValue };
  return { undoable: true, status: "applied", warning: "", actor, currentValue, undoAfterValue: record.beforeValue };
}

export function buildTravelEventEffectUndoRecord(session, actor, appliedRecord, beforeAfter, options = {}) {
  return {
    undone: true,
    undoneAt: nowIso(options),
    undoneByUserId: options.userId ?? globalThis.game?.user?.id ?? "",
    undoneByUserName: options.userName ?? globalThis.game?.user?.name ?? "",
    undoBeforeValue: beforeAfter?.before?.[appliedRecord.resource] ?? null,
    undoAfterValue: beforeAfter?.after?.[appliedRecord.resource] ?? null,
    undoReason: typeof options.reason === "string" ? options.reason : ""
  };
}

export function markTravelEventAppliedEffectUndone(session, applicationId, undoRecord, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return normalized;
  const nextSession = cloneData(normalized.session);
  const records = Array.isArray(nextSession.appliedEffects?.records) ? nextSession.appliedEffects.records : [];
  const index = records.findIndex((record) => record.applicationId === applicationId);
  if (index < 0) return { ok: false, errors: ["Applied effect record was not found."], warnings: [], session: normalized.session };
  if (records[index].undone === true) return { ok: false, errors: ["Applied effect record has already been undone."], warnings: [], session: normalized.session };
  records[index] = { ...records[index], ...cloneData(undoRecord) };
  nextSession.appliedEffects = { records };
  nextSession.updatedAt = nowIso(options);
  return { ok: true, errors: [], warnings: [], session: nextSession, record: cloneData(records[index]) };
}

export function prepareTravelEventAppliedEffectHistoryState(session, actorOrId = null, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return { ...normalized, available: false, records: [] };
  const records = getTravelEventAppliedEffectRecords(normalized.session, options).map((record) => {
    const undo = isTravelEventAppliedEffectUndoable(normalized.session, actorOrId ?? record.actorId, record, options);
    return { ...record, status: undo.status, undoable: undo.undoable, undoWarning: undo.warning, currentValue: undo.currentValue ?? null, undoTargetValue: record.beforeValue };
  });
  return { ok: true, errors: [], warnings: [], session: normalized.session, available: true, records };
}

export async function undoTravelEventAppliedEffect(session, actorOrId, applicationIdOrEffectIndex, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return { ...normalized, undone: false };
  const records = getTravelEventAppliedEffectRecords(normalized.session, options);
  const applicationId = String(applicationIdOrEffectIndex ?? "");
  const record = records.find((entry) => entry.applicationId === applicationId || (applicationId && String(entry.effectIndex) === applicationId));
  if (!record) return { ok: false, errors: ["Applied effect record was not found."], warnings: [], session: normalized.session, undone: false };
  const undoable = isTravelEventAppliedEffectUndoable(normalized.session, actorOrId ?? record.actorId, record, options);
  if (!undoable.undoable) return { ok: false, errors: undoable.status === "blocked" ? [] : [undoable.warning], warnings: undoable.status === "blocked" ? [undoable.warning] : [], session: normalized.session, undone: false, blocked: true, reason: undoable.warning };
  const actor = undoable.actor;
  const before = getShipTravelResources(actor);
  const changes = { [record.resource]: record.beforeValue - before[record.resource] };
  const after = options.dryRun ? previewShipTravelResourceChange(actor, changes).after : await updateShipTravelResources(actor, changes, options.resourceOptions ?? {});
  const undoRecord = buildTravelEventEffectUndoRecord(normalized.session, actor, record, { before, after }, options);
  const marked = markTravelEventAppliedEffectUndone(normalized.session, record.applicationId, undoRecord, options);
  return { ok: marked.ok, errors: marked.errors ?? [], warnings: marked.warnings ?? [], session: marked.session, undone: marked.ok, record: marked.record, undoRecord, resources: after };
}

export async function applyTravelEventRunnerSelectedEffects(session, actorOrId, selectedEffectIds = [], options = {}) {
  const selected = Array.isArray(selectedEffectIds) ? selectedEffectIds : [];
  let currentSession = normalizeTravelEventRunnerSession(session, options).session;
  const applied = [];
  const skipped = [];
  const errors = [];
  const warnings = [];
  for (const selection of selected) {
    const result = await applyTravelEventRunnerResourceEffect(currentSession, actorOrId, selection, options);
    if (result.applied) {
      applied.push(result.record);
      currentSession = result.session;
    } else {
      skipped.push(selection);
    }
    errors.push(...(result.errors ?? []));
    warnings.push(...(result.warnings ?? []));
  }
  return { ok: errors.length === 0, errors, warnings, session: currentSession, applied, skipped };
}

export function prepareTravelEventRunnerSummaryReport(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return { ...normalized, available: false, report: null, reason: normalized.errors?.[0] ?? "Travel Event Runner session is malformed." };
  if (normalized.session.status !== "completed") return { ok: true, errors: [], warnings: [], session: normalized.session, available: false, report: null, reason: "Completed summary output is unavailable until the runner session is completed." };
  const summarized = summarizeTravelEventRunnerSession(normalized.session, options);
  if (!summarized.ok || !summarized.summary) return { ...summarized, available: false, report: null, reason: summarized.errors?.[0] ?? "Unable to prepare completed runner summary." };
  const summary = summarized.summary;
  const report = {
    ...cloneData(summary),
    available: true,
    eventName: summary.event.name,
    eventCategory: summary.event.category,
    baseDC: summary.event.baseDC,
    finalOutcomeLabel: summary.suggestedFinalOutcomeLabel,
    finalOutcomeNarrativeText: summary.finalOutcomeText,
    proposedEffectsNotice: "Proposed effects have not been applied.",
    proposedEffectRows: (summary.stagedProposedEffects ?? []).map(formatEffectForReport),
    rounds: summary.rounds.map((round) => ({
      ...round,
      stationRows: Object.entries(round.stationResults ?? {}).map(([stationKey, result]) => ({ stationKey, stationName: humanizeIdentifier(stationKey), result: result ?? "unrecorded", resultLabel: result ? humanizeIdentifier(result) : "Unrecorded" }))
    }))
  };
  return { ok: true, errors: [], warnings: [], session: normalized.session, available: true, report };
}

export function renderTravelEventRunnerSummaryMarkdown(session, options = {}) {
  if (isPlainObject(session?.travelV2CompletionSummary) || isPlainObject(session?.travelV2EventCompletion?.summary)) return buildTravelV2CompletedSummaryMarkdown(session, options);
  const prepared = prepareTravelEventRunnerSummaryReport(session, options);
  if (!prepared.available || !prepared.report) return { ...prepared, markdown: "" };
  const r = prepared.report;
  const lines = [
    `# Travel Event Summary — ${r.eventName}`,
    "",
    `- **Event Category:** ${r.eventCategory || "Uncategorized"}`,
    `- **Base DC:** ${r.baseDC}`,
    `- **Started At:** ${r.startedAt || ""}`,
    `- **Completed At:** ${r.completedAt || ""}`,
    `- **Total Score:** ${r.totalScore}`,
    `- **Suggested Final Outcome:** ${humanizeIdentifier(r.suggestedFinalOutcome)}`,
    `- **Final Outcome Label:** ${r.finalOutcomeLabel}`,
    "",
    "## Final Outcome Narrative",
    r.finalOutcomeNarrativeText || "No final outcome narrative text provided.",
    "",
    "## Round-by-Round Station Results"
  ];
  for (const round of r.rounds) {
    lines.push("", `### Round ${round.roundNumber}: ${round.title}`);
    for (const row of round.stationRows) lines.push(`- **${row.stationName}** (${row.stationKey}): ${row.resultLabel}`);
  }
  lines.push("", "## Proposed Travel Effects / Rewards", `**${r.proposedEffectsNotice}**`);
  if (r.proposedEffectRows.length) for (const effect of r.proposedEffectRows) lines.push("", `### ${effect.label}`, "```json", effect.json, "```");
  else lines.push("", "No proposed effects are attached to the suggested final outcome.");
  return { ...prepared, markdown: lines.join("\n") };
}

export function renderTravelEventRunnerSummaryHtml(session, options = {}) {
  if (isPlainObject(session?.travelV2CompletionSummary) || isPlainObject(session?.travelV2EventCompletion?.summary)) return buildTravelV2CompletedSummaryHtml(session, options);
  const prepared = prepareTravelEventRunnerSummaryReport(session, options);
  if (!prepared.available || !prepared.report) return { ...prepared, html: "" };
  const r = prepared.report;
  const roundHtml = r.rounds.map((round) => `<h3>Round ${escapeHtml(round.roundNumber)}: ${escapeHtml(round.title)}</h3><ul>${round.stationRows.map((row) => `<li><strong>${escapeHtml(row.stationName)}</strong> (${escapeHtml(row.stationKey)}): ${escapeHtml(row.resultLabel)}</li>`).join("")}</ul>`).join("");
  const effectsHtml = r.proposedEffectRows.length
    ? r.proposedEffectRows.map((effect) => `<h3>${escapeHtml(effect.label)}</h3><pre>${escapeHtml(effect.json)}</pre>`).join("")
    : "<p>No proposed effects are attached to the suggested final outcome.</p>";
  const html = `<section class="arcflight-travel-runner-summary"><h1>Travel Event Summary — ${escapeHtml(r.eventName)}</h1><ul><li><strong>Event Category:</strong> ${escapeHtml(r.eventCategory || "Uncategorized")}</li><li><strong>Base DC:</strong> ${escapeHtml(r.baseDC)}</li><li><strong>Started At:</strong> ${escapeHtml(r.startedAt)}</li><li><strong>Completed At:</strong> ${escapeHtml(r.completedAt)}</li><li><strong>Total Score:</strong> ${escapeHtml(r.totalScore)}</li><li><strong>Suggested Final Outcome:</strong> ${escapeHtml(humanizeIdentifier(r.suggestedFinalOutcome))}</li><li><strong>Final Outcome Label:</strong> ${escapeHtml(r.finalOutcomeLabel)}</li></ul><h2>Final Outcome Narrative</h2><p>${escapeHtml(r.finalOutcomeNarrativeText || "No final outcome narrative text provided.")}</p><h2>Round-by-Round Station Results</h2>${roundHtml}<h2>Proposed Travel Effects / Rewards</h2><p><strong>${escapeHtml(r.proposedEffectsNotice)}</strong></p>${effectsHtml}</section>`;
  return { ...prepared, html };
}

export function prepareTravelEventRunnerSummaryOutputState(session, options = {}) {
  const isTravelV2CompletedSummary = isPlainObject(session?.travelV2CompletionSummary) || isPlainObject(session?.travelV2EventCompletion?.summary);
  const report = isTravelV2CompletedSummary ? buildTravelV2CompletedSummaryExportState(session) : prepareTravelEventRunnerSummaryReport(session, options);
  const markdown = report.available ? renderTravelEventRunnerSummaryMarkdown(session, options).markdown : "";
  const html = report.available ? renderTravelEventRunnerSummaryHtml(session, options).html : "";
  const canUseCompletedSummarySideEffects = isTravelV2CompletedSummary && report.available === true && options.user?.isGM === true;
  const unavailableReason = !isTravelV2CompletedSummary || !report.available ? (report.reason ?? "A completed Travel v2 summary is unavailable.") : "Only GMs can post completed Travel v2 summaries.";
  return { ...report, markdown, html, canCopyMarkdown: report.available, canCopyHtml: report.available, canPostChat: canUseCompletedSummarySideEffects, canCreateJournal: canUseCompletedSummarySideEffects, postChatTitle: canUseCompletedSummarySideEffects ? "Post one player-safe Travel v2 summary to public chat." : unavailableReason, createJournalTitle: canUseCompletedSummarySideEffects ? "Create one player-safe Travel v2 summary journal entry." : unavailableReason, lastResultMessage: options.summaryOutputStatusMessage ?? "" };
}

export async function postTravelEventRunnerSummaryToChat(session, options = {}) {
  return postTravelV2CompletedSummaryToChat(session, options);
}

export async function createTravelEventRunnerSummaryJournalEntry(session, options = {}) {
  return createTravelV2CompletedSummaryJournalEntry(session, options);
}

export function completeTravelEventRunnerSession(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  nextSession.status = "completed";
  nextSession.currentRoundIndex = Math.max(nextSession.event.rounds.length - 1, 0);
  nextSession.completedAt = nowIso(options);
  nextSession.updatedAt = nextSession.completedAt;
  const summary = summarizeTravelEventRunnerSession(nextSession, options).summary;
  nextSession.summary = summary;
  return { ok: true, errors: [], warnings: [], session: nextSession, summary };
}

export function exportTravelEventRunnerSessionToJson(session, options = {}) {
  const built = buildTravelEventRunnerSessionExportData(session, options);
  if (!built.ok) return { ...built, json: "" };
  return { ...built, json: JSON.stringify(built.data, null, 2) };
}

export function buildTravelEventRunnerSessionExportData(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return { ...normalized, data: null, json: "" };
  const metadata = {
    exportVersion: TRAVEL_EVENT_RUNNER_SESSION_EXPORT_VERSION,
    exportedAt: nowIso(options),
    exportedByUserId: options.userId ?? globalThis.game?.user?.id ?? "",
    exportedByUserName: options.userName ?? globalThis.game?.user?.name ?? "",
    arcflightVersion: options.arcflightVersion ?? globalThis.game?.modules?.get?.(ARCFLIGHT_MODULE_ID)?.version ?? "",
    sourceWorldId: options.sourceWorldId ?? globalThis.game?.world?.id ?? "",
    sourceWorldTitle: options.sourceWorldTitle ?? globalThis.game?.world?.title ?? ""
  };
  return { ok: true, errors: [], warnings: normalized.warnings ?? [], session: cloneData(normalized.session), metadata, data: { ...metadata, session: cloneData(normalized.session) } };
}

export function parseTravelEventRunnerSessionJson(jsonText, options = {}) {
  const errors = [];
  let data;
  try {
    data = JSON.parse(String(jsonText ?? ""));
  } catch (_error) {
    return { ok: false, errors: ["Travel Event Runner session JSON is malformed."], warnings: [], data: null, session: null, preview: null };
  }
  if (!isPlainObject(data)) return { ok: false, errors: ["Travel Event Runner session import root must be a JSON object."], warnings: [], data, session: null, preview: null };
  const sessionData = isPlainObject(data.session) ? data.session : data;
  const normalized = normalizeTravelEventRunnerSession(sessionData, options);
  errors.push(...(normalized.errors ?? []));
  return { ok: errors.length === 0, errors, warnings: normalized.warnings ?? [], data, session: normalized.session, preview: null };
}

export function validateImportedTravelEventRunnerSession(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  const errors = [...(normalized.errors ?? [])];
  const warnings = [...(normalized.warnings ?? [])];
  if (normalized.session?.event?.key) {
    const entry = { eventKey: normalized.session.event.key, session: normalized.session };
    if (!publishedEventExistsForSession(entry, options)) warnings.push("Imported session references a published event that is not available in this world.");
  }
  if (!normalized.session?.key) warnings.push("Imported session has no saved library key; a new key will be generated when saved.");
  return { ok: errors.length === 0, errors, warnings, session: normalized.session };
}

export function prepareTravelEventRunnerSessionImportPreview(dataOrSession, options = {}) {
  const parsed = typeof dataOrSession === "string" ? parseTravelEventRunnerSessionJson(dataOrSession, options) : { ok: isPlainObject(dataOrSession), errors: isPlainObject(dataOrSession) ? [] : ["Travel Event Runner session import root must be a JSON object."], warnings: [], data: dataOrSession, session: isPlainObject(dataOrSession?.session) ? dataOrSession.session : dataOrSession };
  if (!parsed.ok) return { ...parsed, importResult: parsed, preview: { errors: parsed.errors, warnings: parsed.warnings } };
  const validated = validateImportedTravelEventRunnerSession(parsed.session, options);
  const session = validated.session;
  const library = getTravelEventRunnerSessionLibrary(options);
  const key = session?.key ?? "";
  const duplicateKey = Boolean(key && Object.hasOwn(library.sessions, key));
  const records = session?.appliedEffects?.records ?? [];
  const staged = session?.summary?.stagedProposedEffects ?? summarizeTravelEventRunnerSession(session, options).summary?.stagedProposedEffects ?? [];
  const preview = {
    sessionName: session?.name || (session?.event?.name ? `${session.event.name} Session` : key),
    sessionKey: key,
    eventName: session?.event?.name ?? "",
    eventKey: session?.event?.key ?? "",
    status: session?.status ?? "",
    currentRound: Number(session?.currentRoundIndex ?? 0) + 1,
    completed: session?.status === "completed",
    stagedEffectCount: Array.isArray(staged) ? staged.length : 0,
    appliedEffectCount: records.length,
    undoneEffectCount: records.filter((record) => record.undone === true).length,
    duplicateKey,
    warnings: validated.warnings,
    errors: validated.errors
  };
  const importResult = { ok: validated.ok, errors: validated.errors, warnings: validated.warnings, data: parsed.data, session, preview, library, duplicateKey };
  return { ...importResult, importResult };
}

export function importTravelEventRunnerSessionFromJson(jsonText, options = {}) {
  return prepareTravelEventRunnerSessionImportPreview(jsonText, options);
}

export async function saveImportedTravelEventRunnerSessionToLibrary(importResult, options = {}) {
  const source = importResult?.session ? importResult : prepareTravelEventRunnerSessionImportPreview(importResult, options);
  if (!source.ok || !source.session) return buildRunnerLibraryResult(false, { errors: source.errors ?? ["Imported runner session is not valid."], warnings: source.warnings ?? [], session: null, entry: null });
  const mode = options.mode === "overwrite" ? "overwrite" : "copy";
  const libraryOptions = source.library ? { ...options, library: source.library } : options;
  if (source.duplicateKey && mode !== "overwrite" && options.allowDuplicateKey !== true) {
    const key = createUniqueRunnerSessionKey(source.library ?? getTravelEventRunnerSessionLibrary(options), `${source.session.key || source.session.event?.key || "runner-session"}-import`, options);
    const copy = cloneData(source.session);
    copy.key = key;
    const savedCopy = await saveTravelEventRunnerSessionToLibrary(copy, { ...libraryOptions, key, name: `${source.preview?.sessionName || source.session.event?.name || key} Imported Copy`, overwrite: false });
    return { ...savedCopy, importMode: "copy", overwritten: false };
  }
  if (source.duplicateKey && mode === "overwrite" && options.confirmOverwrite !== true) {
    return buildRunnerLibraryResult(false, { errors: ["Overwrite requires explicit confirmation."], warnings: source.warnings ?? [], session: cloneData(source.session), entry: null, importMode: "overwrite", overwritten: false });
  }
  const saved = await saveTravelEventRunnerSessionToLibrary(source.session, { ...libraryOptions, key: source.session.key, overwrite: mode === "overwrite" });
  return { ...saved, importMode: mode, overwritten: mode === "overwrite" && saved.ok === true };
}

export function loadPublishedTravelEventForRunner(idOrKey, options = {}) {
  const loaded = loadPublishedTravelEventFromLibrary(idOrKey, options);
  if (!loaded.ok || !loaded.event) return { ok: false, errors: loaded.errors ?? ["Published travel event could not be loaded."], warnings: loaded.warnings ?? [], entry: loaded.entry ?? null, event: null };
  return { ok: true, errors: [], warnings: loaded.warnings ?? [], entry: loaded.entry, event: loaded.event };
}

export function preparePublishedTravelEventRunnerLaunchState(options = {}) {
  const idOrKey = options.idOrKey ?? options.eventId ?? options.selectedEventId ?? "";
  const loaded = idOrKey ? loadPublishedTravelEventForRunner(idOrKey, options) : { ok: false, errors: ["Choose a published travel event before starting the runner."], warnings: [], entry: null, event: null };
  const shipOptions = getArcflightTravelEventRunnerShipOptions(options);
  const selectedShip = shipOptions.find((actor) => actor.selected) ?? null;
  const defaultSessionName = loaded.event?.name ? `${loaded.event.name} Run` : "Travel Event Run";
  const errors = [...(loaded.errors ?? [])];
  if (loaded.ok === true && shipOptions.length === 0) errors.push("No Arcflight ship or PF2E vehicle actors are available. Create or enable a vehicle actor before starting a travel event run.");
  return {
    ok: loaded.ok === true && shipOptions.length > 0,
    errors,
    warnings: loaded.warnings ?? [],
    entry: loaded.entry ?? null,
    event: loaded.event ? cloneData(loaded.event) : null,
    shipOptions,
    hasShipOptions: shipOptions.length > 0,
    selectedShip,
    defaultSessionName,
    notes: typeof options.notes === "string" ? options.notes : ""
  };
}

export async function startTravelEventRunnerFromPublishedEvent(idOrKey, options = {}) {
  const launchState = preparePublishedTravelEventRunnerLaunchState({ ...options, idOrKey });
  if (!launchState.ok || !launchState.event) return buildRunnerLibraryResult(false, { errors: launchState.errors, warnings: launchState.warnings, launchState, session: null, entry: launchState.entry ?? null });
  const actorId = String(options.actorId ?? options.shipId ?? launchState.selectedShip?.id ?? "");
  const selectedActorUuid = String(options.actorUuid ?? options.shipUuid ?? launchState.selectedShip?.uuid ?? "");
  const actor = actorCollectionValues(getActorCollection(options)).find((candidate) => (selectedActorUuid && actorUuid(candidate) === selectedActorUuid) || (actorId && candidate?.id === actorId)) ?? null;
  if (!actor && !launchState.selectedShip) {
    return buildRunnerLibraryResult(false, { errors: ["No Arcflight ship or PF2E vehicle actor could be resolved for this travel event run."], warnings: launchState.warnings, launchState, session: null, entry: launchState.entry });
  }
  const ship = normalizeTravelEventRunnerShipSelection(actor ?? launchState.selectedShip);
  if (!ship.actorId && !ship.actorUuid) {
    return buildRunnerLibraryResult(false, { errors: ["No Arcflight ship or PF2E vehicle actor could be resolved for this travel event run."], warnings: launchState.warnings, launchState, session: null, entry: launchState.entry });
  }
  const sessionName = typeof options.sessionName === "string" && options.sessionName.trim() ? options.sessionName.trim() : launchState.defaultSessionName;
  const seedShipActor = actor ?? resolveTravelEventRunnerShipActor(ship, options);
  const created = createTravelEventRunnerSession(cloneData(launchState.event), { ...options, ship: seedShipActor ?? ship, notes: options.notes ?? "" });
  if (!created.ok || !created.session) return buildRunnerLibraryResult(false, { errors: created.errors, warnings: created.warnings, launchState, session: null, entry: launchState.entry });
  created.session.name = sessionName;
  created.session.ship = ship;
  created.session.notes = typeof options.notes === "string" ? options.notes.trim() : "";
  return buildRunnerLibraryResult(true, { warnings: [...launchState.warnings, ...created.warnings], launchState, session: cloneData(created.session), entry: launchState.entry });
}

export function getPublishedTravelEventRunnerEntries(options = {}) {
  const library = getPublishedTravelEventLibrary(options);
  return prepareTravelEventRunnerLibraryState({ ...options, library }).entries;
}

export function drawTravelV2RunnerHazard(session, options = {}) { return drawTravelV2ManualHazard(session, options); }
export function revealTravelV2RunnerHazard(session, hazardRecordId, options = {}) { return revealTravelV2Hazard(session, hazardRecordId, options); }
export function holdTravelV2RunnerHazard(session, hazardRecordId, options = {}) { return setTravelV2HazardStatus(session, hazardRecordId, "held", options); }
export function activateTravelV2RunnerHazard(session, hazardRecordId, options = {}) { return setTravelV2HazardStatus(session, hazardRecordId, "active", options); }
export function applyTravelV2RunnerHazardToRound(session, hazardRecordId, options = {}) { return applyTravelV2HazardToRound(session, hazardRecordId, options); }
export function resolveTravelV2RunnerUnresolvedHazards(session, options = {}) { return resolveTravelV2UnresolvedHazardsForRound(session, options); }
export function clearTravelV2RunnerHazard(session, hazardRecordId, options = {}) { return setTravelV2HazardStatus(session, hazardRecordId, "cleared", options); }
export function spendTravelV2RunnerMomentumDowngrade(session, roundIndex, stationKey, options = {}) { return spendTravelV2MomentumToDowngradeStationFailure(session, roundIndex, stationKey, options); }
export function dismissTravelV2RunnerShipScar(session, scarRecordId, options = {}) { return setTravelV2ShipScarSessionStatus(session, scarRecordId, "dismissed", options); }
