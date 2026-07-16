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
  return deepFreeze({ ok: true, committed: true, duplicate: false, blocked: false, blockedReasons: [], reason: "Round action order committed to this runner session.", roundIndex, roundNumber, previousOrder, committedOrder, auditRecord, session: nextSession });
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
  return deepFreeze({ ok: true, unlocked: true, duplicate: false, blocked: false, reason: "Round action order unlocked for reconsideration.", blockedReasons: [], roundIndex, roundNumber, previousOrder, unlockRecord, session: nextSession });
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
    visibleForGM: true, canReorder, disabled: !canReorder, keyboardEnabled: canReorder, blockedReason: canReorderReasons[0] ?? "", blockedReasons: canReorderReasons,
    currentOrder: [...orderedStationKeys], candidateOrder: [...candidateOrder], candidateChanged,
    rows: candidateOrder.map((stationKey, orderIndex) => ({ stationKey, stationName: stationLabel(round, stationKey), orderIndex, orderNumber: orderIndex + 1, orderLabel: `#${orderIndex + 1}`, canMoveUp: canReorder && orderIndex > 0, canMoveDown: canReorder && orderIndex < candidateOrder.length - 1, moveUpLabel: `Move ${stationLabel(round, stationKey)} up`, moveDownLabel: `Move ${stationLabel(round, stationKey)} down` })),
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
