import { getStation } from "../../data/stations/core-stations.js";
import { normalizeTravelRoundSegmentKey } from "./travel-round-segments.js";

export const TRAVEL_V2_ROUND_ACTION_ORDER_STATE_VERSION = 2;

const RESULT_LABELS = Object.freeze({
  criticalFailure: "Critical Failure",
  failure: "Failure",
  success: "Success",
  criticalSuccess: "Critical Success",
  skipped: "Skipped"
});
const RESULT_VALUES = Object.freeze(Object.keys(RESULT_LABELS));
const ORDER_PHASES = Object.freeze({
  ROUND_REVEAL: "roundReveal",
  CREW_STRATEGY: "crewStrategy",
  STATION_ORDERS: "stationOrders",
  STATION_ROLLS: "stationRolls",
  REACTION_WINDOW: "reactionWindow",
  OUTCOME_PRESSURE: "outcomePressure"
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneData(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!isPlainObject(value) && !Array.isArray(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function humanizeIdentifier(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function integerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function recordsFromContainer(container) {
  if (Array.isArray(container)) return container;
  if (Array.isArray(container?.records)) return container.records;
  return [];
}

function roundMatchesRecord(record = {}, roundIndex, roundNumber) {
  if (!isPlainObject(record)) return false;
  const recordRoundIndex = integerOrNull(record.roundIndex);
  if (recordRoundIndex !== null && recordRoundIndex === roundIndex) return true;
  const recordRoundNumber = positiveIntegerOrNull(record.roundNumber ?? record.round);
  return roundNumber !== null && recordRoundNumber === roundNumber;
}

function isCompletedSession(session = {}) {
  return session?.status === "completed" || session?.completed === true || Boolean(session?.completedAt && session?.status !== "active");
}

function getCurrentRound(session = {}) {
  const rounds = Array.isArray(session?.event?.rounds) ? session.event.rounds : [];
  if (rounds.length === 0) return { roundIndex: -1, round: null, roundNumber: null, rounds };
  const requested = integerOrNull(session.currentRoundIndex) ?? 0;
  const roundIndex = Math.min(Math.max(requested, 0), rounds.length - 1);
  const round = isPlainObject(rounds[roundIndex]) ? rounds[roundIndex] : null;
  const roundNumber = positiveIntegerOrNull(round?.roundNumber ?? round?.number ?? round?.round ?? roundIndex + 1);
  return { roundIndex: round ? roundIndex : -1, round, roundNumber, rounds };
}

function activeStationKeys(round = {}, roundResult = {}) {
  const raw = Array.isArray(round?.activeStations) ? round.activeStations : Object.keys(roundResult?.stationResults ?? {});
  return Array.from(new Set(raw.map((entry) => typeof entry === "string" ? entry : entry?.stationKey).filter(Boolean)));
}

function sourceOrderFrom(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.order)) return value.order;
  if (Array.isArray(value?.stationOrder)) return value.stationOrder;
  if (Array.isArray(value?.stationKeys)) return value.stationKeys;
  if (Array.isArray(value?.activeStations)) return value.activeStations;
  return [];
}

export function normalizeTravelV2ProposedRoundActionOrder(sourceOrder = [], fallbackStations = []) {
  const active = activeStationKeys({ activeStations: fallbackStations }, {});
  const proposed = sourceOrderFrom(sourceOrder)
    .map((entry) => typeof entry === "string" ? entry : entry?.stationKey)
    .filter(Boolean);
  const duplicateKeys = proposed.filter((stationKey, index) => proposed.indexOf(stationKey) !== index);
  const unknownKeys = proposed.filter((stationKey) => !active.includes(stationKey));
  const missingKeys = active.filter((stationKey) => !proposed.includes(stationKey));
  const valid = active.length > 0 && proposed.length === active.length && duplicateKeys.length === 0 && unknownKeys.length === 0 && missingKeys.length === 0;
  const blockedReasons = [];
  if (active.length === 0) blockedReasons.push("Current Travel v2 round has no active stations to reorder.");
  if (proposed.length === 0) blockedReasons.push("A proposed station order is required.");
  if (duplicateKeys.length > 0) blockedReasons.push(`Proposed order repeats station keys: ${Array.from(new Set(duplicateKeys)).join(", ")}.`);
  if (unknownKeys.length > 0) blockedReasons.push(`Proposed order includes inactive station keys: ${Array.from(new Set(unknownKeys)).join(", ")}.`);
  if (missingKeys.length > 0) blockedReasons.push(`Proposed order is missing active station keys: ${missingKeys.join(", ")}.`);
  return deepFreeze({ valid, ready: valid, proposedStationKeys: proposed, activeStationKeys: active, missingKeys, unknownKeys: Array.from(new Set(unknownKeys)), duplicateKeys: Array.from(new Set(duplicateKeys)), blockedReasons });
}

function normalizeStationOrder(sourceOrder = [], fallbackStations = []) {
  const fallback = activeStationKeys({ activeStations: fallbackStations }, {});
  const ordered = sourceOrderFrom(sourceOrder)
    .map((entry) => typeof entry === "string" ? entry : entry?.stationKey)
    .filter((stationKey) => stationKey && fallback.includes(stationKey));
  return Array.from(new Set([...ordered, ...fallback]));
}

function explicitOrderSource(session = {}, round = {}, roundResult = {}, options = {}) {
  if (Array.isArray(options.order) || Array.isArray(options.stationOrder)) return options.order ?? options.stationOrder;
  if (Array.isArray(roundResult.stationActionOrder) || Array.isArray(roundResult.actionOrder) || Array.isArray(roundResult.stationOrder)) return roundResult.stationActionOrder ?? roundResult.actionOrder ?? roundResult.stationOrder;
  if (Array.isArray(round.stationActionOrder) || Array.isArray(round.actionOrder) || Array.isArray(round.stationOrder)) return round.stationActionOrder ?? round.actionOrder ?? round.stationOrder;
  const orderState = isPlainObject(session.travelV2RoundActionOrder) ? session.travelV2RoundActionOrder : {};
  const roundOrder = orderState.rounds?.[String(roundResult.roundIndex ?? session.currentRoundIndex ?? 0)] ?? orderState.rounds?.[roundResult.roundIndex ?? session.currentRoundIndex ?? 0];
  return sourceOrderFrom(roundOrder);
}

function stationLabel(round = {}, stationKey = "") {
  const prompt = round?.stationPrompts?.[stationKey] ?? {};
  const station = getStation(stationKey) ?? {};
  return prompt.stationName || prompt.label || station.displayName || station.name || humanizeIdentifier(stationKey);
}

function selectedActionLabel(roundResult = {}, stationKey = "") {
  const optionLabel = roundResult?.selectedStationOptionLabels?.[stationKey];
  if (typeof optionLabel === "string" && optionLabel.trim()) return optionLabel.trim();
  const action = roundResult?.stationActions?.[stationKey] ?? {};
  return action.label || action.actionLabel || action.optionLabel || humanizeIdentifier(action.type || "station order");
}

function resultKeyFor(roundResult = {}, stationKey = "") {
  const result = roundResult?.stationResults?.[stationKey];
  return RESULT_VALUES.includes(result) ? result : null;
}

function findRoundResolutionRecord(session = {}, round = {}, roundIndex = -1, roundNumber = null) {
  for (const key of ["travelV2RoundResolution", "travelV2RoundResolutionRecord", "roundResolution", "roundResolutionRecord"]) {
    if (isPlainObject(round?.[key])) return round[key];
  }
  for (const key of ["travelV2RoundResolutions", "travelV2RoundResolutionRecords", "roundResolutionRecords", "roundResolutions"]) {
    for (const record of recordsFromContainer(session[key])) {
      if (roundMatchesRecord(record, roundIndex, roundNumber)) return record;
    }
  }
  return null;
}

function statusForRow({ committed, resultKey }) {
  if (resultKey) return "resolved";
  if (committed) return "committed";
  return "needs-order";
}

function currentPointerFor(rows = [], phase = "roundReveal", blocked = false) {
  if (blocked || rows.length === 0) return { currentStationKey: "", currentOrderIndex: -1, currentMode: "none", currentRow: null, hasCurrent: false };
  if ([ORDER_PHASES.STATION_ROLLS, ORDER_PHASES.REACTION_WINDOW, ORDER_PHASES.OUTCOME_PRESSURE].includes(phase)) {
    const row = rows.find((candidate) => !candidate.resultKey) ?? null;
    return { currentStationKey: row?.stationKey ?? "", currentOrderIndex: row?.orderIndex ?? -1, currentMode: row ? "roll" : "none", currentRow: row ? cloneData(row) : null, hasCurrent: Boolean(row) };
  }
  const row = rows.find((candidate) => !candidate.committed) ?? rows.find((candidate) => !candidate.resultKey) ?? null;
  return { currentStationKey: row?.stationKey ?? "", currentOrderIndex: row?.orderIndex ?? -1, currentMode: row && !row.committed ? "order" : (row ? "roll" : "none"), currentRow: row ? cloneData(row) : null, hasCurrent: Boolean(row) };
}

function footerTextFor(blockedReasons = [], rows = [], pointer = {}) {
  if (blockedReasons.length > 0) return blockedReasons[0];
  if (pointer.currentMode === "order") return `${pointer.currentRow?.stationName ?? "Next station"} has not committed an action order yet.`;
  if (pointer.currentMode === "roll") return `${pointer.currentRow?.stationName ?? "Next station"} is next to resolve its station roll.`;
  if (rows.length > 0) return "All current round station action-order rows are settled for this state foundation.";
  return "No round action-order rows are available.";
}

function prepareReorderRequestState({ sessionState, currentRows, currentOrder, activeStations, options = {} }) {
  const requested = options.travelV2RoundActionOrderReorderRequested === true || options.reorderRequested === true;
  const isGm = options.user?.isGM === true || options.isGM === true;
  const proposedInput = options.proposedOrder ?? options.proposedStationOrder ?? options.travelV2ProposedRoundActionOrder ?? [];
  if (!requested) return { requested: false, ready: false, blocked: true, playerSafe: true, status: "not-requested", feedbackText: "No GM reorder review requested.", currentRows: [], proposedRows: [], blockedReasons: ["No GM reorder review requested."], reviewOnly: true };
  if (!isGm) return { requested: true, ready: false, blocked: true, playerSafe: true, status: "blocked", feedbackText: "Only the GM can request round action-order reorder review.", currentRows: [], proposedRows: [], blockedReasons: ["Only the GM can request round action-order reorder review."], reviewOnly: true };
  const validation = normalizeTravelV2ProposedRoundActionOrder(proposedInput, activeStations);
  const blockedReasons = [...(Array.isArray(sessionState.blockedReasons) ? sessionState.blockedReasons : []), ...validation.blockedReasons];
  const rowByKey = new Map(currentRows.map((row) => [row.stationKey, row]));
  const rowFor = (stationKey, index) => {
    const row = rowByKey.get(stationKey) ?? {};
    return { stationKey, stationName: row.stationName || stationLabel({}, stationKey), orderNumber: index + 1, orderLabel: `#${index + 1}`, selectedActionLabel: row.selectedActionLabel || "Station order", statusLabel: row.statusLabel || "Needs Order", resultLabel: row.resultLabel || "Unresolved" };
  };
  const ready = blockedReasons.length === 0 && validation.ready === true;
  return deepFreeze({ requested: true, ready, blocked: !ready, playerSafe: false, status: ready ? "ready" : "blocked", feedbackText: ready ? "Reorder candidate is ready for GM review only. It has not been applied, saved, or persisted." : (blockedReasons[0] ?? "Reorder candidate is blocked."), currentStationKeys: currentOrder, proposedStationKeys: validation.proposedStationKeys, currentRows: currentOrder.map(rowFor), proposedRows: validation.proposedStationKeys.map(rowFor), blockedReasons, missingKeys: validation.missingKeys, unknownKeys: validation.unknownKeys, duplicateKeys: validation.duplicateKeys, reviewOnly: true, mutationNote: "Review-only reorder candidate. No session write, persistence, round advancement, station result change, roll, DC, socket, actor, item, chat, or journal mutation is performed." });
}

export function prepareTravelV2RoundActionOrderState(session = null, options = {}) {
  const hasSession = isPlainObject(session);
  const isCompleted = hasSession ? isCompletedSession(session) : false;
  const { roundIndex, round, roundNumber } = hasSession ? getCurrentRound(session) : { roundIndex: -1, round: null, roundNumber: null };
  const hasCurrentRound = Boolean(round);
  const roundResult = hasCurrentRound && Array.isArray(session.roundResults) && isPlainObject(session.roundResults[roundIndex]) ? session.roundResults[roundIndex] : {};
  const activeStations = hasCurrentRound ? activeStationKeys(round, roundResult) : [];
  const orderedStationKeys = hasCurrentRound ? normalizeStationOrder(explicitOrderSource(session, round, roundResult, options), activeStations) : [];
  const phase = normalizeTravelRoundSegmentKey(options.roundPhase ?? session?.roundPhase ?? session?.currentRoundPhase);
  const roundResolutionRecord = hasCurrentRound ? findRoundResolutionRecord(session, round, roundIndex, roundNumber) : null;
  const roundCompleted = Boolean(roundResolutionRecord);

  const rows = orderedStationKeys.map((stationKey, orderIndex) => {
    const action = isPlainObject(roundResult.stationActions?.[stationKey]) ? roundResult.stationActions[stationKey] : {};
    const commitment = isPlainObject(roundResult.stationOrderCommitments?.[stationKey]) ? roundResult.stationOrderCommitments[stationKey] : {};
    const committed = commitment.committed === true;
    const resultKey = resultKeyFor(roundResult, stationKey);
    const status = statusForRow({ committed, resultKey });
    return {
      orderIndex,
      orderNumber: orderIndex + 1,
      stationKey,
      stationName: stationLabel(round, stationKey),
      actionType: typeof action.type === "string" && action.type ? action.type : "",
      actionTypeLabel: humanizeIdentifier(action.type || "station order"),
      selectedActionLabel: selectedActionLabel(roundResult, stationKey),
      committed,
      commitmentSource: commitment.source === "player" ? "player" : "",
      selectedFocusAbility: typeof commitment.selectedFocusAbility === "string" ? commitment.selectedFocusAbility : "",
      hasSelectedFocusAbility: typeof commitment.selectedFocusAbility === "string" && commitment.selectedFocusAbility.length > 0,
      resultKey,
      resultLabel: resultKey ? RESULT_LABELS[resultKey] : "Unresolved",
      resolved: Boolean(resultKey),
      pendingOrder: !committed,
      pendingRoll: committed && !resultKey,
      status,
      statusLabel: humanizeIdentifier(status)
    };
  });

  const blockedReasons = [];
  if (!hasSession) blockedReasons.push("Travel v2 runner session is required.");
  if (isCompleted) blockedReasons.push("Travel v2 runner session is completed.");
  if (!hasCurrentRound) blockedReasons.push("Travel v2 runner session has no current round.");
  if (hasCurrentRound && activeStations.length === 0) blockedReasons.push("Current Travel v2 round has no active stations.");
  if (roundCompleted) blockedReasons.push("Current Travel v2 round is already completed.");

  const blocked = blockedReasons.length > 0;
  const pointer = currentPointerFor(rows, phase, blocked);
  const rowsWithCurrent = rows.map((row) => ({ ...row, current: row.stationKey === pointer.currentStationKey }));

  const reorderRequest = prepareReorderRequestState({ sessionState: { blockedReasons }, currentRows: rowsWithCurrent, currentOrder: orderedStationKeys, activeStations, options });

  return deepFreeze({
    version: TRAVEL_V2_ROUND_ACTION_ORDER_STATE_VERSION,
    hasSession,
    isCompleted,
    hasCurrentRound,
    roundIndex,
    roundNumber,
    phase,
    blocked,
    ready: !blocked && rowsWithCurrent.length > 0,
    blockedReasons,
    activeStations,
    orderedStationKeys,
    rows: rowsWithCurrent,
    hasRows: rowsWithCurrent.length > 0,
    rowCount: rowsWithCurrent.length,
    committedCount: rowsWithCurrent.filter((row) => row.committed).length,
    pendingOrderCount: rowsWithCurrent.filter((row) => row.pendingOrder).length,
    pendingRollCount: rowsWithCurrent.filter((row) => row.pendingRoll).length,
    resolvedCount: rowsWithCurrent.filter((row) => row.resolved).length,
    currentStationKey: pointer.currentStationKey,
    currentOrderIndex: pointer.currentOrderIndex,
    currentMode: pointer.currentMode,
    currentRow: pointer.currentRow,
    hasCurrent: pointer.hasCurrent,
    roundResolutionRecord: roundResolutionRecord ? cloneData(roundResolutionRecord) : null,
    footerText: footerTextFor(blockedReasons, rowsWithCurrent, pointer),
    stateOnly: true,
    reorderRequest,
    mutationNote: "Round action order state is read-only. It does not commit order, advance rounds, roll checks, change DCs, or persist session data."
  });
}

export default prepareTravelV2RoundActionOrderState;
