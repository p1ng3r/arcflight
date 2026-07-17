import { getStation } from "../../data/stations/core-stations.js";
import { normalizeTravelRoundSegmentKey } from "./travel-round-segments.js";

export const TRAVEL_V2_ROUND_ACTION_ORDER_STATE_VERSION = 4;

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

const CAPTAIN_ORDER_GUIDANCE_TEXT = "The crew should agree on station order before Round 1 begins. If the crew cannot agree, the Captain makes the final call.";
const ORDER_DECISION_COPY = Object.freeze({
  committed: { statusLabel: "Committed Order", statusTone: "safe", guidanceText: "The station order is committed for this round.", currentOrderLabel: "Committed Station Sequence" },
  proposed: { statusLabel: "Proposed Order", statusTone: "warning", guidanceText: "This order is proposed and remains changeable until the GM commits it.", currentOrderLabel: "Proposed Station Sequence" },
  needsDecision: { statusLabel: "Needs Decision", statusTone: "danger", guidanceText: "The crew has not agreed on a station order yet.", currentOrderLabel: "Current Station Sequence" }
});
const ORDER_SOURCE_LABELS = Object.freeze({
  committed: "Committed by GM",
  authoredProposal: "Authored Proposal",
  fallback: "Fallback Display Order",
  none: "No Order Selected"
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

function blockedDropTargetResult({ stationKey = "", sourceIndex = -1, pointerY = null, previousOrder = [], blockedReasons = [] } = {}) {
  return deepFreeze({
    ok: false,
    blocked: true,
    wouldMove: false,
    sameIndex: false,
    stationKey,
    sourceIndex,
    insertionSlot: -1,
    targetIndex: -1,
    pointerY,
    previousOrder: [...previousOrder],
    blockedReasons: [...blockedReasons],
    reason: blockedReasons[0] ?? "Round action-order drop target is blocked."
  });
}

export function resolveTravelV2RoundActionOrderDropTarget(sourceOrder = [], options = {}) {
  options = isPlainObject(options) ? options : {};

  const stationKey = typeof options.stationKey === "string" ? options.stationKey.trim() : "";
  const pointerY = options.pointerY;
  const rowBounds = Array.isArray(options.rowBounds) ? options.rowBounds : null;
  const activeStations = Array.isArray(options.activeStations) ? options.activeStations : [];
  const validation = normalizeTravelV2ProposedRoundActionOrder(sourceOrder, activeStations);
  const previousOrder = [...validation.proposedStationKeys];
  const blockedReasons = [...validation.blockedReasons];

  if (!stationKey) blockedReasons.push("A station key is required.");
  if (stationKey && !validation.activeStationKeys.includes(stationKey)) blockedReasons.push(`Unknown station key cannot be reordered: ${stationKey}.`);
  if (stationKey && validation.valid && !previousOrder.includes(stationKey)) blockedReasons.push(`Station key is not present in the source order: ${stationKey}.`);
  if (!Number.isFinite(pointerY)) blockedReasons.push("Pointer Y coordinate must be a finite number.");
  if (!Array.isArray(options.rowBounds)) blockedReasons.push("Row bounds must be an array.");
  if (rowBounds && rowBounds.length !== previousOrder.length) blockedReasons.push(`Row bounds length must equal source order length (${previousOrder.length}).`);

  const seen = new Set();
  if (rowBounds) {
    let previousBottom = null;
    rowBounds.forEach((row, index) => {
      if (!isPlainObject(row)) {
        blockedReasons.push(`Row bounds entry ${index + 1} must be an object.`);
        return;
      }
      const rowStationKey = typeof row.stationKey === "string" ? row.stationKey.trim() : "";
      if (!rowStationKey) blockedReasons.push(`Row bounds entry ${index + 1} requires a station key.`);
      if (rowStationKey && seen.has(rowStationKey)) blockedReasons.push(`Row bounds repeat station key: ${rowStationKey}.`);
      if (rowStationKey) seen.add(rowStationKey);
      if (rowStationKey && validation.activeStationKeys.length > 0 && !validation.activeStationKeys.includes(rowStationKey)) blockedReasons.push(`Row bounds include inactive station key: ${rowStationKey}.`);
      if (rowStationKey && previousOrder[index] !== rowStationKey) blockedReasons.push(`Row bounds station key at index ${index} must be ${previousOrder[index] ?? "none"}.`);
      if (!Number.isFinite(row.top) || !Number.isFinite(row.bottom)) blockedReasons.push(`Row bounds for ${rowStationKey || `entry ${index + 1}`} must have finite top and bottom values.`);
      if (Number.isFinite(row.top) && Number.isFinite(row.bottom) && row.bottom <= row.top) blockedReasons.push(`Row bounds for ${rowStationKey || `entry ${index + 1}`} must have bottom greater than top.`);
      if (previousBottom !== null && Number.isFinite(row.top) && row.top < previousBottom) blockedReasons.push(`Row bounds for ${rowStationKey || `entry ${index + 1}`} overlap or are out of vertical order.`);
      if (Number.isFinite(row.bottom)) previousBottom = row.bottom;
    });
    for (const expected of previousOrder) {
      if (!seen.has(expected)) blockedReasons.push(`Row bounds are missing station key: ${expected}.`);
    }
  }

  const sourceIndex = previousOrder.indexOf(stationKey);
  if (blockedReasons.length > 0) {
    return blockedDropTargetResult({ stationKey, sourceIndex, pointerY: Number.isFinite(pointerY) ? pointerY : null, previousOrder, blockedReasons });
  }

  const insertionSlot = rowBounds.reduce((count, row) => {
    const midpoint = row.top + ((row.bottom - row.top) / 2);
    return pointerY >= midpoint ? count + 1 : count;
  }, 0);
  let targetIndex = insertionSlot;
  if (insertionSlot > sourceIndex) targetIndex -= 1;
  targetIndex = Math.min(Math.max(targetIndex, 0), previousOrder.length - 1);
  const sameIndex = sourceIndex === targetIndex;
  return deepFreeze({
    ok: true,
    blocked: false,
    wouldMove: !sameIndex,
    sameIndex,
    stationKey,
    sourceIndex,
    insertionSlot,
    targetIndex,
    pointerY,
    previousOrder,
    blockedReasons: [],
    reason: sameIndex ? "Round action-order drop target is the current position." : "Round action-order drop target resolved."
  });
}


export function moveTravelV2RoundActionOrderCandidate(sourceOrder = [], options = {}) {
  const stationKey = typeof options.stationKey === "string"
    ? options.stationKey.trim()
    : "";

  const hasDirection = Object.prototype.hasOwnProperty.call(options, "direction");
  const hasTargetIndex = Object.prototype.hasOwnProperty.call(options, "targetIndex");

  const direction = typeof options.direction === "string"
    ? options.direction.trim()
    : "";

  const requestedTargetIndex = options.targetIndex;
  const activeStations = Array.isArray(options.activeStations)
    ? options.activeStations
    : [];

  const validation = normalizeTravelV2ProposedRoundActionOrder(
    sourceOrder,
    activeStations
  );

  const previousOrder = [...validation.proposedStationKeys];
  const blockedReasons = [...validation.blockedReasons];

  if (!stationKey) {
    blockedReasons.push("A station key is required.");
  }

  if (
    stationKey
    && !validation.activeStationKeys.includes(stationKey)
  ) {
    blockedReasons.push(
      `Unknown station key cannot be reordered: ${stationKey}.`
    );
  }

  if (hasDirection && hasTargetIndex) {
    blockedReasons.push(
      "Specify either a reorder direction or a target index, not both."
    );
  }

  if (!hasDirection && !hasTargetIndex) {
    blockedReasons.push(
      "A reorder direction or target index is required."
    );
  }

  if (
    hasDirection
    && !["up", "down"].includes(direction)
  ) {
    blockedReasons.push(
      `Unsupported reorder direction: ${direction || "none"}.`
    );
  }

  if (
    hasTargetIndex
    && !Number.isInteger(requestedTargetIndex)
  ) {
    blockedReasons.push(
      "Target index must be an integer."
    );
  }

  const previousIndex = previousOrder.indexOf(stationKey);

  let targetIndex = -1;

  if (hasDirection && direction === "up") {
    targetIndex = previousIndex - 1;
  } else if (hasDirection && direction === "down") {
    targetIndex = previousIndex + 1;
  } else if (hasTargetIndex && Number.isInteger(requestedTargetIndex)) {
    targetIndex = requestedTargetIndex;
  }

  if (
    blockedReasons.length === 0
    && hasDirection
    && direction === "up"
    && previousIndex === 0
  ) {
    blockedReasons.push("The first station cannot move up.");
  }

  if (
    blockedReasons.length === 0
    && hasDirection
    && direction === "down"
    && previousIndex === previousOrder.length - 1
  ) {
    blockedReasons.push("The final station cannot move down.");
  }

  if (
    blockedReasons.length === 0
    && hasTargetIndex
    && (targetIndex < 0 || targetIndex >= previousOrder.length)
  ) {
    blockedReasons.push(
      `Target index must be between 0 and ${Math.max(previousOrder.length - 1, 0)}.`
    );
  }

  if (blockedReasons.length > 0) {
    return deepFreeze({
      ok: false,
      moved: false,
      duplicate: false,
      blocked: true,
      reason: blockedReasons[0],
      blockedReasons,
      stationKey,
      direction,
      previousIndex,
      targetIndex,
      previousOrder,
      proposedOrder: [...previousOrder]
    });
  }

  if (previousIndex === targetIndex) {
    return deepFreeze({
      ok: true,
      moved: false,
      duplicate: false,
      blocked: false,
      reason: "Round action-order candidate is already at the requested position.",
      blockedReasons: [],
      stationKey,
      direction,
      previousIndex,
      targetIndex,
      previousOrder,
      proposedOrder: [...previousOrder]
    });
  }

  const proposedOrder = [...previousOrder];
  const [movedStation] = proposedOrder.splice(previousIndex, 1);
  proposedOrder.splice(targetIndex, 0, movedStation);

  return deepFreeze({
    ok: true,
    moved: true,
    duplicate: false,
    blocked: false,
    reason: "Round action-order candidate moved.",
    blockedReasons: [],
    stationKey,
    direction,
    previousIndex,
    targetIndex,
    previousOrder,
    proposedOrder
  });
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
  const orderState = isPlainObject(session.travelV2RoundActionOrder) ? session.travelV2RoundActionOrder : {};
  const roundOrder = orderState.rounds?.[String(roundResult.roundIndex ?? session.currentRoundIndex ?? 0)] ?? orderState.rounds?.[roundResult.roundIndex ?? session.currentRoundIndex ?? 0];
  const committedOrder = sourceOrderFrom(roundOrder);
  if (committedOrder.length > 0) return committedOrder;
  if (Array.isArray(roundResult.stationActionOrder) || Array.isArray(roundResult.actionOrder) || Array.isArray(roundResult.stationOrder)) return roundResult.stationActionOrder ?? roundResult.actionOrder ?? roundResult.stationOrder;
  if (Array.isArray(round.stationActionOrder) || Array.isArray(round.actionOrder) || Array.isArray(round.stationOrder)) return round.stationActionOrder ?? round.actionOrder ?? round.stationOrder;
  return [];
}

function explicitAuthoredOrderSource(round = {}, roundResult = {}, options = {}) {
  round = isPlainObject(round) ? round : {};
  roundResult = isPlainObject(roundResult) ? roundResult : {};
  if (Array.isArray(options.order) || Array.isArray(options.stationOrder)) return options.order ?? options.stationOrder;
  if (Array.isArray(roundResult.stationActionOrder) || Array.isArray(roundResult.actionOrder) || Array.isArray(roundResult.stationOrder)) return roundResult.stationActionOrder ?? roundResult.actionOrder ?? roundResult.stationOrder;
  if (Array.isArray(round.stationActionOrder) || Array.isArray(round.actionOrder) || Array.isArray(round.stationOrder)) return round.stationActionOrder ?? round.actionOrder ?? round.stationOrder;
  return [];
}

function committedOrderRecordForRound(session = {}, roundIndex = -1) {
  if (!Number.isInteger(roundIndex) || roundIndex < 0) return null;
  const state = isPlainObject(session.travelV2RoundActionOrder) ? session.travelV2RoundActionOrder : {};
  const rounds = isPlainObject(state.rounds) ? state.rounds : {};
  const record = rounds[String(roundIndex)] ?? rounds[roundIndex] ?? null;
  return isPlainObject(record) ? record : null;
}

function buildOrderDecision(statusKey, orderSourceKey) {
  const copy = ORDER_DECISION_COPY[statusKey] ?? ORDER_DECISION_COPY.needsDecision;
  return deepFreeze({
    statusKey,
    statusLabel: copy.statusLabel,
    statusTone: copy.statusTone,
    orderSourceKey,
    orderSourceLabel: ORDER_SOURCE_LABELS[orderSourceKey] ?? ORDER_SOURCE_LABELS.none,
    hasCommittedOrder: statusKey === "committed",
    hasProposedOrder: statusKey === "proposed",
    needsDecision: statusKey === "needsDecision",
    currentOrderLabel: copy.currentOrderLabel,
    guidanceText: copy.guidanceText,
    captainGuidanceText: CAPTAIN_ORDER_GUIDANCE_TEXT,
    showCaptainGuidance: statusKey !== "committed",
    playerSafe: true,
    readOnly: true
  });
}

export function determineRoundActionOrderDecision({ session = {}, round = {}, roundResult = {}, roundIndex = -1, activeStations = [], reorderRequest = null, options = {} } = {}) {
  const committedRecord = committedOrderRecordForRound(session, roundIndex);
  const committedValidation = normalizeTravelV2ProposedRoundActionOrder(committedRecord ? sourceOrderFrom(committedRecord) : [], activeStations);
  if (committedRecord && committedValidation.valid) {
    return { orderDecision: buildOrderDecision("committed", "committed"), currentOrder: committedValidation.proposedStationKeys };
  }

  const authoredOrder = explicitAuthoredOrderSource(round, roundResult, options);
  const authoredValidation = normalizeTravelV2ProposedRoundActionOrder(authoredOrder, activeStations);
  if (authoredValidation.valid) {
    return { orderDecision: buildOrderDecision("proposed", "authoredProposal"), currentOrder: authoredValidation.proposedStationKeys };
  }

  const fallbackSource = Array.isArray(options.order) || Array.isArray(options.stationOrder) ? (options.order ?? options.stationOrder) : [];
  return { orderDecision: buildOrderDecision("needsDecision", activeStations.length > 0 ? "fallback" : "none"), currentOrder: normalizeStationOrder(fallbackSource, activeStations) };
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
  const unchanged = validation.valid === true && arraysEqual(validation.proposedStationKeys, currentOrder);
  if (unchanged) blockedReasons.push("The proposed order matches the current order.");
  const ready = blockedReasons.length === 0 && validation.ready === true;
  return deepFreeze({ requested: true, ready, blocked: !ready, playerSafe: false, status: ready ? "ready" : "blocked", feedbackText: ready ? "Reorder candidate is ready for GM review only. It has not been applied, saved, or persisted." : (blockedReasons[0] ?? "Reorder candidate is blocked."), currentStationKeys: currentOrder, proposedStationKeys: validation.proposedStationKeys, currentRows: currentOrder.map(rowFor), proposedRows: validation.proposedStationKeys.map(rowFor), blockedReasons, missingKeys: validation.missingKeys, unknownKeys: validation.unknownKeys, duplicateKeys: validation.duplicateKeys, reviewOnly: true, mutationNote: "Review-only reorder candidate. No session write, persistence, round advancement, station result change, roll, DC, socket, actor, item, chat, or journal mutation is performed." });
}

function arraysEqual(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function safeUserMetadata(options = {}) {
  const user = options.user ?? {};
  return {
    source: typeof options.source === "string" && options.source.trim() ? options.source.trim() : "gm-order-commit",
    userId: typeof user.id === "string" && user.id.trim() ? user.id.trim() : (typeof options.userId === "string" && options.userId.trim() ? options.userId.trim() : null),
    userName: typeof user.name === "string" && user.name.trim() ? user.name.trim() : (typeof options.userName === "string" && options.userName.trim() ? options.userName.trim() : null),
    isGM: user.isGM === true || options.isGM === true
  };
}

function hasRecordedStationResult(roundResult = {}) {
  const results = isPlainObject(roundResult?.stationResults) ? roundResult.stationResults : {};
  return Object.values(results).some((result) => RESULT_VALUES.includes(result));
}

function latestRoundRecord(records = [], roundIndex = -1, roundNumber = null) {
  return recordsFromContainer(records)
    .filter((record) => roundMatchesRecord(record, roundIndex, roundNumber))
    .sort((left, right) => String(right?.timestamp ?? "").localeCompare(String(left?.timestamp ?? "")))[0] ?? null;
}

function committedOrderKeysFromRecord(record = {}) {
  if (Array.isArray(record?.committedOrder)) return record.committedOrder;
  return sourceOrderFrom(record);
}

function validCommitRecordForRound(record = {}, roundIndex = -1, roundNumber = null, activeStations = []) {
  if (!roundMatchesRecord(record, roundIndex, roundNumber)) return false;
  const validation = normalizeTravelV2ProposedRoundActionOrder(committedOrderKeysFromRecord(record), activeStations);
  return validation.valid === true && typeof record?.timestamp === "string" && record.timestamp.trim().length > 0;
}

function validUnlockRecordForRound(record = {}, roundIndex = -1, roundNumber = null) {
  return roundMatchesRecord(record, roundIndex, roundNumber)
    && record?.type === "roundActionOrderUnlock"
    && typeof record?.timestamp === "string"
    && record.timestamp.trim().length > 0;
}

export function prepareTravelV2RoundActionOrderUnlockLifecycleState(session = null, options = {}) {
  const hasSession = isPlainObject(session);
  const isCompleted = hasSession ? isCompletedSession(session) : false;
  const { roundIndex, round, roundNumber } = hasSession ? getCurrentRound(session) : { roundIndex: -1, round: null, roundNumber: null };
  const hasCurrentRound = Boolean(round);
  const roundResult = hasCurrentRound && Array.isArray(session.roundResults) && isPlainObject(session.roundResults[roundIndex]) ? session.roundResults[roundIndex] : {};
  const activeStations = hasCurrentRound ? activeStationKeys(round, roundResult) : [];
  const roundResolutionRecord = hasCurrentRound ? findRoundResolutionRecord(session, round, roundIndex, roundNumber) : null;
  const resultsRecorded = hasRecordedStationResult(roundResult);
  const state = hasSession && isPlainObject(session.travelV2RoundActionOrder) ? session.travelV2RoundActionOrder : {};
  const committedRecord = hasSession ? committedOrderRecordForRound(session, roundIndex) : null;
  const committedValidation = normalizeTravelV2ProposedRoundActionOrder(committedRecord ? sourceOrderFrom(committedRecord) : [], activeStations);
  const hasValidCommittedOrder = Boolean(committedRecord && committedValidation.valid);
  const unlockRecords = recordsFromContainer(state.unlockRecords).filter((record) => validUnlockRecordForRound(record, roundIndex, roundNumber));
  const commitRecords = recordsFromContainer(state.commitRecords ?? state.commits ?? state.auditRecords).filter((record) => validCommitRecordForRound(record, roundIndex, roundNumber, activeStations));
  const latestUnlock = unlockRecords.sort((left, right) => String(right.timestamp).localeCompare(String(left.timestamp)))[0] ?? null;
  const priorCommit = latestUnlock ? commitRecords.filter((record) => String(record.timestamp) <= String(latestUnlock.timestamp)).sort((left, right) => String(right.timestamp).localeCompare(String(left.timestamp)))[0] ?? null : null;
  const laterCommit = latestUnlock ? commitRecords.filter((record) => String(record.timestamp) > String(latestUnlock.timestamp)).sort((left, right) => String(right.timestamp).localeCompare(String(left.timestamp)))[0] ?? null : null;
  const wasPreviouslyCommitted = Boolean(priorCommit || latestUnlock);
  const base = {
    openForReconsideration: false,
    wasPreviouslyCommitted,
    statusKey: "notOpen",
    statusLabel: "Order Not Open for Reconsideration",
    guidanceText: "",
    playerSafe: true,
    readOnly: true
  };
  if (!hasSession || isCompleted || !hasCurrentRound || activeStations.length === 0 || roundResolutionRecord || hasValidCommittedOrder || !latestUnlock || !priorCommit || laterCommit) return deepFreeze(base);
  if (resultsRecorded) {
    return deepFreeze({
      ...base,
      wasPreviouslyCommitted: true,
      statusKey: "closedByStationResults",
      statusLabel: "Order Reconsideration Closed",
      guidanceText: "Station resolution has begun, so the round action order can no longer be changed."
    });
  }
  return deepFreeze({
    openForReconsideration: true,
    wasPreviouslyCommitted: true,
    statusKey: "openForReconsideration",
    statusLabel: "Order Open for Reconsideration",
    guidanceText: "The GM reopened station order for reconsideration. The crew may agree on a new order before it is committed.",
    playerSafe: true,
    readOnly: true
  });
}

function prepareRoundActionOrderUnlockControl({ session = {}, round = null, roundResult = {}, roundIndex = -1, roundNumber = null, activeStations = [], blockedReasons = [], unlockStatus = null, options = {} } = {}) {
  const isGm = options.user?.isGM === true || options.isGM === true;
  const reasons = [];
  if (!isGm) reasons.push("Only the GM can unlock round action order.");
  reasons.push(...blockedReasons);
  if (hasRecordedStationResult(roundResult)) reasons.push("Round action order cannot be unlocked after station results have been recorded.");
  const committedRecord = committedOrderRecordForRound(session, roundIndex);
  const validation = normalizeTravelV2ProposedRoundActionOrder(committedRecord ? sourceOrderFrom(committedRecord) : [], activeStations);
  if (!committedRecord) reasons.push(unlockStatus?.openForReconsideration ? "Round action order is already unlocked." : "Current round has no committed action order to unlock.");
  if (committedRecord && !validation.valid) reasons.push(...validation.blockedReasons.map((reason) => reason.replace(/^Proposed order/, "Committed order")));
  return deepFreeze({
    visibleForGM: isGm,
    canUnlock: isGm && reasons.length === 0,
    disabled: reasons.length > 0,
    buttonLabel: "Unlock Order",
    blockedReason: reasons[0] ?? "",
    blockedReasons: reasons,
    requiresConfirmation: true,
    playerSafe: false,
    readOnly: true
  });
}



const ROUND_ACTION_ORDER_STATUSES = Object.freeze(["selecting", "committed", "unlocked"]);
const ROUND_ACTION_ORDER_SOURCES = Object.freeze(["authored", "priorRoundSuggestion", "manual", "legacyCommitted", "none"]);

function defaultRoundActionOrderRoundState(roundIndex = 0, roundNumber = null) {
  const index = Math.max(0, Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : 0);
  return {
    version: 1,
    roundIndex: index,
    roundNumber: positiveIntegerOrNull(roundNumber) ?? index + 1,
    status: "selecting",
    proposedStationKeys: [],
    committedStationKeys: [],
    orderSource: "none",
    suggestionSource: null,
    committedAt: null,
    committedByUserId: null,
    committedByUserName: null,
    committedByIsGM: false,
    unlockedAt: null,
    unlockedByUserId: null,
    unlockedByUserName: null,
    unlockedByIsGM: false,
    historicalCommittedStationKeys: []
  };
}

function validOrderOrEmpty(order = [], activeStations = []) {
  const validation = normalizeTravelV2ProposedRoundActionOrder(order, activeStations);
  return validation.valid ? validation.proposedStationKeys : [];
}

function legacyCommittedRoundState(legacyRecord, activeStations = [], roundIndex = 0, roundNumber = null) {
  if (!isPlainObject(legacyRecord)) return null;
  const committed = validOrderOrEmpty(sourceOrderFrom(legacyRecord), activeStations);
  if (committed.length === 0) return null;
  const audit = isPlainObject(legacyRecord.auditRecord) ? legacyRecord.auditRecord : {};
  return {
    ...defaultRoundActionOrderRoundState(roundIndex, roundNumber),
    status: "committed",
    proposedStationKeys: cloneData(committed),
    committedStationKeys: cloneData(committed),
    orderSource: "legacyCommitted",
    committedAt: typeof legacyRecord.committedAt === "string" ? legacyRecord.committedAt : (typeof audit.timestamp === "string" ? audit.timestamp : null),
    committedByUserId: typeof legacyRecord.userId === "string" ? legacyRecord.userId : (typeof audit.userId === "string" ? audit.userId : null),
    committedByUserName: typeof legacyRecord.userName === "string" ? legacyRecord.userName : (typeof audit.userName === "string" ? audit.userName : null),
    committedByIsGM: legacyRecord.isGM === true || audit.isGM === true
  };
}

export function normalizeTravelV2RoundActionOrderRoundState(input = null, activeStations = [], options = {}) {
  const roundIndex = Math.max(0, Number.isInteger(Number(options.roundIndex ?? input?.roundIndex)) ? Number(options.roundIndex ?? input?.roundIndex) : 0);
  const roundNumber = positiveIntegerOrNull(options.roundNumber ?? input?.roundNumber) ?? roundIndex + 1;
  const active = activeStationKeys({ activeStations }, {});
  const legacyState = legacyCommittedRoundState(options.legacyRecord, active, roundIndex, roundNumber);
  const source = isPlainObject(input) ? input : (legacyState ?? {});
  const base = defaultRoundActionOrderRoundState(roundIndex, roundNumber);
  const proposed = validOrderOrEmpty(source.proposedStationKeys, active);
  const committed = validOrderOrEmpty(source.committedStationKeys, active);
  const status = ROUND_ACTION_ORDER_STATUSES.includes(source.status) ? source.status : (committed.length > 0 ? "committed" : "selecting");
  const authored = validOrderOrEmpty(options.authoredOrder ?? [], active);
  const fallbackProposed = proposed.length > 0 ? proposed : (committed.length > 0 ? committed : authored.length > 0 ? authored : active);
  return deepFreeze({
    ...base,
    version: 1,
    roundIndex,
    roundNumber,
    status: status === "committed" && committed.length === 0 ? "selecting" : status,
    proposedStationKeys: cloneData(fallbackProposed),
    committedStationKeys: status === "committed" ? cloneData(committed) : cloneData(committed),
    orderSource: ROUND_ACTION_ORDER_SOURCES.includes(source.orderSource) ? source.orderSource : (legacyState ? "legacyCommitted" : (authored.length > 0 ? "authored" : "none")),
    suggestionSource: isPlainObject(source.suggestionSource) ? cloneData(source.suggestionSource) : null,
    committedAt: typeof source.committedAt === "string" ? source.committedAt : null,
    committedByUserId: typeof source.committedByUserId === "string" ? source.committedByUserId : null,
    committedByUserName: typeof source.committedByUserName === "string" ? source.committedByUserName : null,
    committedByIsGM: source.committedByIsGM === true,
    unlockedAt: typeof source.unlockedAt === "string" ? source.unlockedAt : null,
    unlockedByUserId: typeof source.unlockedByUserId === "string" ? source.unlockedByUserId : null,
    unlockedByUserName: typeof source.unlockedByUserName === "string" ? source.unlockedByUserName : null,
    unlockedByIsGM: source.unlockedByIsGM === true,
    historicalCommittedStationKeys: Array.from(new Set((Array.isArray(source.historicalCommittedStationKeys) ? source.historicalCommittedStationKeys : []).filter((key) => active.includes(key))))
  });
}

export function repairTravelV2RoundActionOrderSuggestion(priorCommittedStationKeys = [], destinationActiveStationKeys = [], options = {}) {
  const active = activeStationKeys({ activeStations: destinationActiveStationKeys }, {});
  const authored = activeStationKeys({ activeStations: Array.isArray(options.destinationAuthoredStationKeys) ? options.destinationAuthoredStationKeys : active }, {}).filter((key) => active.includes(key));
  const retained = Array.from(new Set(sourceOrderFrom(priorCommittedStationKeys).filter((key) => active.includes(key))));
  const proposed = [...retained, ...authored.filter((key) => !retained.includes(key)), ...active.filter((key) => !retained.includes(key) && !authored.includes(key))];
  return deepFreeze({
    ...defaultRoundActionOrderRoundState(options.roundIndex ?? 0, options.roundNumber ?? null),
    status: "selecting",
    proposedStationKeys: proposed,
    committedStationKeys: [],
    orderSource: proposed.length > 0 && retained.length > 0 ? "priorRoundSuggestion" : (proposed.length > 0 ? "authored" : "none"),
    suggestionSource: Number.isInteger(Number(options.sourceRoundIndex)) ? { type: "priorRoundCommittedOrder", sourceRoundIndex: Number(options.sourceRoundIndex), sourceRoundNumber: positiveIntegerOrNull(options.sourceRoundNumber) ?? Number(options.sourceRoundIndex) + 1 } : null
  });
}

function roundContextFromSession(session = {}, roundIndex = 0) {
  const round = session?.event?.rounds?.[roundIndex] ?? {};
  const result = session?.roundResults?.[roundIndex] ?? {};
  const roundNumber = positiveIntegerOrNull(round.roundNumber ?? round.number ?? round.round ?? result.roundNumber) ?? roundIndex + 1;
  return { round, result, roundNumber, activeStations: activeStationKeys(round, result), authoredOrder: explicitAuthoredOrderSource(round, result, {}) };
}

export function initializeTravelV2RoundActionOrderForRound(session = null, roundIndex = 0, options = {}) {
  const nextSession = cloneData(session ?? {});
  if (!Array.isArray(nextSession.roundResults)) nextSession.roundResults = [];
  const index = Math.max(0, Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : 0);
  const { roundNumber, activeStations, authoredOrder } = roundContextFromSession(nextSession, index);
  const legacyRecord = committedOrderRecordForRound(nextSession, index);
  const existing = nextSession.roundResults[index]?.actionOrder;
  let actionOrder = normalizeTravelV2RoundActionOrderRoundState(existing, activeStations, { roundIndex: index, roundNumber, authoredOrder, legacyRecord });
  if (!legacyRecord && index > 0 && Array.isArray(options.priorCommittedStationKeys) && options.priorCommittedStationKeys.length > 0 && (!existing || (actionOrder.status === "selecting" && actionOrder.committedStationKeys.length === 0))) {
    actionOrder = repairTravelV2RoundActionOrderSuggestion(options.priorCommittedStationKeys, activeStations, { roundIndex: index, roundNumber, destinationAuthoredStationKeys: authoredOrder.length > 0 ? authoredOrder : activeStations, sourceRoundIndex: options.sourceRoundIndex ?? index - 1, sourceRoundNumber: options.sourceRoundNumber ?? index });
  }
  nextSession.roundResults[index] = { ...(isPlainObject(nextSession.roundResults[index]) ? nextSession.roundResults[index] : {}), actionOrder: cloneData(actionOrder) };
  return deepFreeze(nextSession);
}

export function replaceTravelV2RoundActionOrderProposal(session = null, roundIndex = 0, proposedOrder = [], options = {}) {
  const nextSession = initializeTravelV2RoundActionOrderForRound(session, roundIndex, options);
  const index = Math.max(0, Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : 0);
  const { activeStations } = roundContextFromSession(nextSession, index);
  const validation = normalizeTravelV2ProposedRoundActionOrder(proposedOrder, activeStations);
  if (!validation.valid) return deepFreeze({ ok: false, blocked: true, blockedReasons: validation.blockedReasons, reason: validation.blockedReasons[0] ?? "Proposal blocked.", session: nextSession });
  const current = nextSession.roundResults[index].actionOrder;
  if (!["selecting", "unlocked"].includes(current.status)) {
    const reason = "Committed round action order must be explicitly unlocked before replacing the proposal.";
    return deepFreeze({ ok: false, blocked: true, blockedReasons: [reason], reason, session: nextSession });
  }
  const editable = cloneData(nextSession);
  editable.roundResults[index].actionOrder = { ...current, proposedStationKeys: validation.proposedStationKeys, orderSource: "manual" };
  return deepFreeze({ ok: true, blocked: false, blockedReasons: [], session: editable, proposedStationKeys: validation.proposedStationKeys });
}

export function commitTravelV2RoundActionOrderRoundState(session = null, roundIndex = 0, options = {}) {
  const nextSession = initializeTravelV2RoundActionOrderForRound(session, roundIndex, options);
  const index = Math.max(0, Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : 0);
  const { activeStations } = roundContextFromSession(nextSession, index);
  const current = nextSession.roundResults[index].actionOrder;
  const validation = normalizeTravelV2ProposedRoundActionOrder(options.proposedOrder ?? current.proposedStationKeys, activeStations);
  if (!validation.valid) return deepFreeze({ ok: false, committed: false, blocked: true, blockedReasons: validation.blockedReasons, reason: validation.blockedReasons[0] ?? "Commit blocked.", session: nextSession });
  const timestamp = typeof options.timestamp === "string" && options.timestamp.trim() ? options.timestamp.trim() : new Date().toISOString();
  const metadata = safeUserMetadata(options);
  const editable = cloneData(nextSession);
  editable.roundResults[index].actionOrder = { ...current, status: "committed", proposedStationKeys: validation.proposedStationKeys, committedStationKeys: validation.proposedStationKeys, orderSource: current.orderSource === "priorRoundSuggestion" ? "priorRoundSuggestion" : "manual", committedAt: timestamp, committedByUserId: metadata.userId, committedByUserName: metadata.userName, committedByIsGM: metadata.isGM };
  return deepFreeze({ ok: true, committed: true, blocked: false, blockedReasons: [], session: editable, committedStationKeys: validation.proposedStationKeys });
}

export function unlockTravelV2RoundActionOrderRoundState(session = null, roundIndex = 0, options = {}) {
  const nextSession = initializeTravelV2RoundActionOrderForRound(session, roundIndex, options);
  const index = Math.max(0, Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : 0);
  const current = nextSession.roundResults[index].actionOrder;
  if (current.status !== "committed" || current.committedStationKeys.length === 0) return deepFreeze({ ok: false, unlocked: false, blocked: true, blockedReasons: ["Current round has no committed action order to unlock."], reason: "Current round has no committed action order to unlock.", session: nextSession });
  const timestamp = typeof options.timestamp === "string" && options.timestamp.trim() ? options.timestamp.trim() : new Date().toISOString();
  const metadata = safeUserMetadata({ ...options, source: options.source ?? "gm-order-unlock" });
  const editable = cloneData(nextSession);
  const history = cloneData(current.committedStationKeys);
  editable.roundResults[index].actionOrder = { ...current, status: "unlocked", proposedStationKeys: current.proposedStationKeys.length > 0 ? current.proposedStationKeys : current.committedStationKeys, historicalCommittedStationKeys: history, unlockedAt: timestamp, unlockedByUserId: metadata.userId, unlockedByUserName: metadata.userName, unlockedByIsGM: metadata.isGM };
  return deepFreeze({ ok: true, unlocked: true, blocked: false, blockedReasons: [], session: editable, historicalCommittedStationKeys: history });
}

export function prepareTravelV2NextRoundActionOrder(session = null, sourceRoundIndex = 0, destinationRoundIndex = sourceRoundIndex + 1, options = {}) {
  const sourceSession = initializeTravelV2RoundActionOrderForRound(session, sourceRoundIndex, options);
  const prior = sourceSession.roundResults?.[sourceRoundIndex]?.actionOrder?.committedStationKeys ?? [];
  return initializeTravelV2RoundActionOrderForRound(sourceSession, destinationRoundIndex, { ...options, priorCommittedStationKeys: prior, sourceRoundIndex, sourceRoundNumber: sourceRoundIndex + 1 });
}

function existingRoundOrderRecord(session = {}, roundIndex = -1) {
  const state = isPlainObject(session.travelV2RoundActionOrder) ? session.travelV2RoundActionOrder : {};
  const rounds = isPlainObject(state.rounds) ? state.rounds : {};
  return rounds[String(roundIndex)] ?? rounds[roundIndex] ?? null;
}

export function commitTravelV2RoundActionOrderToSession(session = null, proposedOrder = [], options = {}) {
  const isGm = options.user?.isGM === true || options.isGM === true;
  const commitRequested = options.commitRequested === true || options.travelV2RoundActionOrderCommitRequested === true;
  const blockedReasons = [];
  if (!isGm) blockedReasons.push("Only the GM can commit round action order.");
  if (!commitRequested) blockedReasons.push("Explicit round action-order commit request is required.");
  if (!isPlainObject(session)) blockedReasons.push("Travel v2 runner session is required.");
  const isCompleted = isPlainObject(session) ? isCompletedSession(session) : false;
  if (isCompleted) blockedReasons.push("Completed Travel v2 runner sessions cannot commit round action order.");
  const { roundIndex, round, roundNumber } = isPlainObject(session) ? getCurrentRound(session) : { roundIndex: -1, round: null, roundNumber: null };
  const hasCurrentRound = Boolean(round);
  const roundResult = hasCurrentRound && Array.isArray(session.roundResults) && isPlainObject(session.roundResults[roundIndex]) ? session.roundResults[roundIndex] : {};
  const activeStations = hasCurrentRound ? activeStationKeys(round, roundResult) : [];
  const roundResolutionRecord = hasCurrentRound ? findRoundResolutionRecord(session, round, roundIndex, roundNumber) : null;
  if (!hasCurrentRound) blockedReasons.push("Travel v2 runner session has no current round.");
  if (hasCurrentRound && activeStations.length === 0) blockedReasons.push("Current Travel v2 round has no active stations.");
  if (roundResolutionRecord) blockedReasons.push("Current Travel v2 round is already completed.");
  if (hasRecordedStationResult(roundResult)) blockedReasons.push("Round action order cannot be committed after station results have been recorded.");

  const validation = normalizeTravelV2ProposedRoundActionOrder(proposedOrder, activeStations);
  blockedReasons.push(...validation.blockedReasons);
  if (blockedReasons.length > 0) return deepFreeze({ ok: false, committed: false, duplicate: false, blocked: true, playerSafe: !isGm, blockedReasons, reason: blockedReasons[0] ?? "Round action order commit blocked.", session: isGm ? cloneData(session) : null });

  const previousOrder = normalizeStationOrder(explicitOrderSource(session, round, roundResult, {}), activeStations);
  const committedOrder = [...validation.proposedStationKeys];
  const existingRecord = existingRoundOrderRecord(session, roundIndex);
  const existingOrder = sourceOrderFrom(existingRecord);
  if (arraysEqual(existingOrder, committedOrder)) {
    return deepFreeze({ ok: true, committed: false, duplicate: true, blocked: false, blockedReasons: [], reason: "Round action order already committed with the same station order.", roundIndex, roundNumber, previousOrder, committedOrder, auditRecord: isPlainObject(existingRecord?.auditRecord) ? cloneData(existingRecord.auditRecord) : null, session: cloneData(session) });
  }

  const timestamp = typeof options.timestamp === "string" && options.timestamp.trim() ? options.timestamp.trim() : new Date().toISOString();
  const metadata = safeUserMetadata(options);
  const auditRecord = {
    id: `round-action-order:${roundIndex}:${timestamp}`,
    type: "roundActionOrderCommit",
    roundIndex,
    roundNumber,
    previousOrder: cloneData(previousOrder),
    committedOrder: cloneData(committedOrder),
    timestamp,
    source: metadata.source,
    userId: metadata.userId,
    userName: metadata.userName,
    isGM: metadata.isGM,
    mutationScope: "session-local-station-action-order-only"
  };
  const nextSession = cloneData(session);
  const nextState = isPlainObject(nextSession.travelV2RoundActionOrder) ? { ...nextSession.travelV2RoundActionOrder } : {};
  const nextRounds = isPlainObject(nextState.rounds) ? { ...nextState.rounds } : {};
  nextRounds[String(roundIndex)] = { roundIndex, roundNumber, order: cloneData(committedOrder), stationOrder: cloneData(committedOrder), committedAt: timestamp, source: metadata.source, userId: metadata.userId, userName: metadata.userName, auditRecord: cloneData(auditRecord) };
  const priorRecords = recordsFromContainer(nextState.commitRecords ?? nextState.commits ?? nextState.auditRecords);
  nextState.version = TRAVEL_V2_ROUND_ACTION_ORDER_STATE_VERSION;
  nextState.rounds = nextRounds;
  nextState.commitRecords = [...cloneData(priorRecords), cloneData(auditRecord)];
  nextSession.travelV2RoundActionOrder = nextState;
  const canonicalCommit = commitTravelV2RoundActionOrderRoundState(nextSession, roundIndex, { ...options, proposedOrder: committedOrder, timestamp });
  const sessionWithCanonicalOrder = canonicalCommit.ok ? canonicalCommit.session : nextSession;
  return deepFreeze({ ok: true, committed: true, duplicate: false, blocked: false, blockedReasons: [], reason: "Round action order committed to this runner session.", roundIndex, roundNumber, previousOrder, committedOrder, auditRecord, session: sessionWithCanonicalOrder });
}

export function unlockTravelV2RoundActionOrderInSession(session = null, options = {}) {
  const isGm = options.user?.isGM === true || options.isGM === true;
  const unlockRequested = options.unlockRequested === true || options.travelV2RoundActionOrderUnlockRequested === true;
  const blockedReasons = [];
  if (!isGm) blockedReasons.push("Only the GM can unlock round action order.");
  if (!unlockRequested) blockedReasons.push("Explicit round action-order unlock request is required.");
  if (!isPlainObject(session)) blockedReasons.push("Travel v2 runner session is required.");
  const isCompleted = isPlainObject(session) ? isCompletedSession(session) : false;
  if (isCompleted) blockedReasons.push("Completed Travel v2 runner sessions cannot unlock round action order.");
  const { roundIndex, round, roundNumber } = isPlainObject(session) ? getCurrentRound(session) : { roundIndex: -1, round: null, roundNumber: null };
  const hasCurrentRound = Boolean(round);
  const roundResult = hasCurrentRound && Array.isArray(session.roundResults) && isPlainObject(session.roundResults[roundIndex]) ? session.roundResults[roundIndex] : {};
  const activeStations = hasCurrentRound ? activeStationKeys(round, roundResult) : [];
  const roundResolutionRecord = hasCurrentRound ? findRoundResolutionRecord(session, round, roundIndex, roundNumber) : null;
  if (!hasCurrentRound) blockedReasons.push("Travel v2 runner session has no current round.");
  if (hasCurrentRound && activeStations.length === 0) blockedReasons.push("Current Travel v2 round has no active stations.");
  if (roundResolutionRecord) blockedReasons.push("Current Travel v2 round is already completed.");
  if (hasRecordedStationResult(roundResult)) blockedReasons.push("Round action order cannot be unlocked after station results have been recorded.");

  const state = isPlainObject(session?.travelV2RoundActionOrder) ? session.travelV2RoundActionOrder : {};
  const committedRecord = isPlainObject(session) ? committedOrderRecordForRound(session, roundIndex) : null;
  const unlockStatus = isPlainObject(session) ? prepareTravelV2RoundActionOrderUnlockLifecycleState(session) : null;
  if (!committedRecord) {
    if (unlockStatus?.openForReconsideration === true && isGm && unlockRequested && blockedReasons.length === 0) {
      return deepFreeze({ ok: true, unlocked: false, duplicate: true, blocked: false, reason: "Round action order is already unlocked.", blockedReasons: [], roundIndex, roundNumber, session: cloneData(session) });
    }
    blockedReasons.push("Current round has no committed action order to unlock.");
  }
  const validation = normalizeTravelV2ProposedRoundActionOrder(committedRecord ? sourceOrderFrom(committedRecord) : [], activeStations);
  if (committedRecord && !validation.valid) blockedReasons.push(...validation.blockedReasons.map((reason) => reason.replace(/^Proposed order/, "Committed order")));
  if (blockedReasons.length > 0) return deepFreeze({ ok: false, unlocked: false, duplicate: false, blocked: true, playerSafe: !isGm, reason: blockedReasons[0] ?? "Round action order unlock blocked.", blockedReasons, roundIndex, roundNumber, session: isGm && isPlainObject(session) ? cloneData(session) : null });

  const timestamp = typeof options.timestamp === "string" && options.timestamp.trim() ? options.timestamp.trim() : new Date().toISOString();
  const metadata = safeUserMetadata({ ...options, source: options.source ?? "gm-order-unlock" });
  const previousOrder = cloneData(validation.proposedStationKeys);
  const previousAudit = isPlainObject(committedRecord.auditRecord) ? committedRecord.auditRecord : {};
  const unlockRecord = { id: `round-action-order-unlock:${roundIndex}:${timestamp}`, type: "roundActionOrderUnlock", roundIndex, roundNumber, previousOrder, previousCommittedAt: committedRecord.committedAt ?? previousAudit.timestamp ?? null, previousCommitAuditId: previousAudit.id ?? null, timestamp, source: metadata.source, userId: metadata.userId, userName: metadata.userName, isGM: metadata.isGM, mutationScope: "session-local-station-action-order-only" };
  const nextSession = cloneData(session);
  const nextState = isPlainObject(nextSession.travelV2RoundActionOrder) ? { ...nextSession.travelV2RoundActionOrder } : {};
  const nextRounds = isPlainObject(nextState.rounds) ? { ...nextState.rounds } : {};
  delete nextRounds[String(roundIndex)];
  nextState.version = TRAVEL_V2_ROUND_ACTION_ORDER_STATE_VERSION;
  nextState.rounds = nextRounds;
  nextState.commitRecords = cloneData(recordsFromContainer(nextState.commitRecords ?? nextState.commits ?? nextState.auditRecords));
  nextState.unlockRecords = [...cloneData(recordsFromContainer(state.unlockRecords)), cloneData(unlockRecord)];
  nextSession.travelV2RoundActionOrder = nextState;
  const canonicalUnlock = unlockTravelV2RoundActionOrderRoundState(nextSession, roundIndex, { ...options, timestamp });
  const sessionWithCanonicalOrder = canonicalUnlock.ok ? canonicalUnlock.session : nextSession;
  return deepFreeze({ ok: true, unlocked: true, duplicate: false, blocked: false, reason: "Round action order unlocked for reconsideration.", blockedReasons: [], roundIndex, roundNumber, previousOrder, unlockRecord, session: sessionWithCanonicalOrder });
}

export function prepareTravelV2RoundActionOrderState(session = null, options = {}) {
  const hasSession = isPlainObject(session);
  const isCompleted = hasSession ? isCompletedSession(session) : false;
  const { roundIndex, round, roundNumber } = hasSession ? getCurrentRound(session) : { roundIndex: -1, round: null, roundNumber: null };
  const hasCurrentRound = Boolean(round);
  const roundResult = hasCurrentRound && Array.isArray(session.roundResults) && isPlainObject(session.roundResults[roundIndex]) ? session.roundResults[roundIndex] : {};
  const activeStations = hasCurrentRound ? activeStationKeys(round, roundResult) : [];
  const phase = normalizeTravelRoundSegmentKey(options.roundPhase ?? session?.roundPhase ?? session?.currentRoundPhase);
  const roundResolutionRecord = hasCurrentRound ? findRoundResolutionRecord(session, round, roundIndex, roundNumber) : null;
  const roundCompleted = Boolean(roundResolutionRecord);

  const preliminaryReorderRequest = prepareReorderRequestState({ sessionState: { blockedReasons: [] }, currentRows: [], currentOrder: normalizeStationOrder([], activeStations), activeStations, options });
  const { orderDecision, currentOrder } = determineRoundActionOrderDecision({ session, round, roundResult, roundIndex, activeStations, reorderRequest: preliminaryReorderRequest, options });
  const orderedStationKeys = hasCurrentRound ? currentOrder : [];

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
  const unlockStatus = prepareTravelV2RoundActionOrderUnlockLifecycleState(session ?? {}, options);
  const unlockControl = prepareRoundActionOrderUnlockControl({ session: session ?? {}, round, roundResult, roundIndex, roundNumber, activeStations, blockedReasons, unlockStatus, options });
  const pointer = currentPointerFor(rows, phase, blocked);
  const rowsWithCurrent = rows.map((row) => ({ ...row, current: row.stationKey === pointer.currentStationKey }));

  const reorderRequestBlockedReasons = [...blockedReasons];
  if (hasRecordedStationResult(roundResult)) reorderRequestBlockedReasons.push("Order Reconsideration Closed: station resolution has begun.");
  const reorderRequest = prepareReorderRequestState({ sessionState: { blockedReasons: reorderRequestBlockedReasons }, currentRows: rowsWithCurrent, currentOrder: orderedStationKeys, activeStations, options });
  const isGm = options.user?.isGM === true || options.isGM === true;
  const hasValidCommittedOrder = orderDecision.hasCommittedOrder === true;
  const canReorderReasons = [];
  if (!isGm) canReorderReasons.push("Only the GM can reorder round action order.");
  canReorderReasons.push(...blockedReasons);
  if (hasRecordedStationResult(roundResult)) canReorderReasons.push("Order Reconsideration Closed: station resolution has begun.");
  if (hasValidCommittedOrder) canReorderReasons.push("Committed orders must be unlocked before keyboard reordering.");
  const canReorder = isGm && canReorderReasons.length === 0 && rowsWithCurrent.length > 1;
  const candidateValidation = normalizeTravelV2ProposedRoundActionOrder(options.proposedOrder ?? options.travelV2ProposedRoundActionOrder ?? [], activeStations);
  const candidateOrder = candidateValidation.valid ? candidateValidation.proposedStationKeys : orderedStationKeys;
  const candidateChanged = !arraysEqual(candidateOrder, orderedStationKeys);
  const reorderInteraction = isGm ? deepFreeze({
    visibleForGM: true, canReorder, disabled: !canReorder, keyboardEnabled: canReorder, dragEnabled: canReorder, dropTargetEnabled: canReorder, blockedReason: canReorderReasons[0] ?? "", blockedReasons: canReorderReasons,
    currentOrder: [...orderedStationKeys], candidateOrder: [...candidateOrder], candidateChanged,
    rows: candidateOrder.map((stationKey, orderIndex) => ({ stationKey, stationName: stationLabel(round, stationKey), orderIndex, orderNumber: orderIndex + 1, orderLabel: `#${orderIndex + 1}`, canMoveUp: canReorder && orderIndex > 0, canMoveDown: canReorder && orderIndex < candidateOrder.length - 1, moveUpLabel: `Move ${stationLabel(round, stationKey)} up`, moveDownLabel: `Move ${stationLabel(round, stationKey)} down`, draggable: canReorder, dropTargetEnabled: canReorder, dragLabel: `Drag ${stationLabel(round, stationKey)} to reorder` })),
    canResetCandidate: canReorder && candidateChanged, playerSafe: false, readOnly: true
  }) : null;

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
    orderDecision,
    orderStatusKey: orderDecision.statusKey,
    orderStatusLabel: orderDecision.statusLabel,
    orderStatusTone: orderDecision.statusTone,
    hasCommittedOrder: orderDecision.hasCommittedOrder,
    hasProposedOrder: orderDecision.hasProposedOrder,
    needsOrderDecision: orderDecision.needsDecision,
    unlockStatus,
    unlockControl: (options.user?.isGM === true || options.isGM === true) ? unlockControl : null,
    orderOpenForReconsideration: unlockStatus.openForReconsideration,
    roundActionOrderUnlockStatusLabel: unlockStatus.statusLabel,
    roundActionOrderUnlockGuidanceText: unlockStatus.guidanceText,
    captainGuidanceText: orderDecision.captainGuidanceText,
    showCaptainGuidance: orderDecision.showCaptainGuidance,
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
    reorderInteraction,
    mutationNote: "Round action order state is read-only. It does not commit order, advance rounds, roll checks, change DCs, or persist session data."
  });
}

export default prepareTravelV2RoundActionOrderState;
