export const TRAVEL_V2_INTER_STATION_HELP_ACTIONS_VERSION = 1;

const FORBIDDEN_AUTHORED_KEYS = new Set([
  "gmText",
  "gmSummary",
  "gmMechanicalNotes",
  "gmNotes",
  "hidden",
  "hiddenData",
  "secret",
  "secretText",
  "applyPayload",
  "mutationPayload",
  "internalMutation",
  "targetActorId",
  "targetActorUuid",
  "actorId",
  "actorUuid",
  "userId",
  "socketPayload",
  "audit"
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneData(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function integerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function humanizeIdentifier(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function uniqueStrings(values = []) {
  return Array.from(new Set(values.map(text).filter(Boolean)));
}

function stationKeyFrom(value) {
  if (typeof value === "string") return text(value);
  if (!isPlainObject(value)) return "";
  return text(value.stationKey ?? value.key ?? value.id ?? value.slug);
}

function recordsFrom(value) {
  if (Array.isArray(value)) return value;
  if (!isPlainObject(value)) return [];
  if (Array.isArray(value.actions)) return value.actions;
  if (Array.isArray(value.records)) return value.records;
  if (Array.isArray(value.items)) return value.items;
  return Object.entries(value).map(([key, record]) => isPlainObject(record) ? { actionId: key, ...record } : record);
}

function sanitizeTags(value) {
  if (Array.isArray(value)) return uniqueStrings(value);
  if (typeof value === "string") return uniqueStrings(value.split(/[;,]/g));
  return [];
}

function scrubForbidden(value) {
  if (Array.isArray(value)) return value.map(scrubForbidden);
  if (!isPlainObject(value)) return value;
  const next = {};
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_AUTHORED_KEYS.has(key)) continue;
    next[key] = scrubForbidden(nested);
  }
  return next;
}

function sanitizeCriticalSuccessMetadata(value) {
  if (!isPlainObject(value)) return null;
  const metadata = scrubForbidden({
    id: text(value.id),
    key: text(value.key),
    title: text(value.title ?? value.label ?? value.name),
    publicText: text(value.publicText ?? value.playerText ?? value.description ?? value.summary),
    strengthening: text(value.strengthening ?? value.mode ?? value.kind),
    benefitKind: text(value.benefitKind ?? value.benefitType),
    magnitude: Number.isFinite(Number(value.magnitude ?? value.value ?? value.amount)) ? Number(value.magnitude ?? value.value ?? value.amount) : undefined,
    tags: sanitizeTags(value.tags ?? value.tag)
  });
  for (const key of Object.keys(metadata)) {
    if (metadata[key] === undefined || metadata[key] === null || metadata[key] === "" || (Array.isArray(metadata[key]) && metadata[key].length === 0)) delete metadata[key];
  }
  return Object.keys(metadata).length > 0 ? metadata : null;
}

function criticalSuccessMetadataFrom(record = {}) {
  return sanitizeCriticalSuccessMetadata(record.criticalSuccessMetadata ?? record.criticalSuccess ?? record.criticalSuccessStrengthening ?? record.criticalSuccessBenefit);
}

function currentRoundContext(session = {}, options = {}) {
  const rounds = Array.isArray(session?.event?.rounds) ? session.event.rounds : [];
  if (rounds.length === 0) return { roundIndex: -1, roundNumber: null, round: null, roundResult: {}, event: isPlainObject(session?.event) ? session.event : {}, blockedReasons: ["missing-travel-event-rounds"] };
  const requested = integerOrNull(options.roundIndex ?? session.currentRoundIndex) ?? 0;
  if (requested < 0 || requested >= rounds.length) return { roundIndex: requested, roundNumber: null, round: null, roundResult: {}, event: session.event, blockedReasons: ["invalid-current-round-index"] };
  const round = isPlainObject(rounds[requested]) ? rounds[requested] : null;
  if (!round) return { roundIndex: requested, roundNumber: null, round: null, roundResult: {}, event: session.event, blockedReasons: ["missing-current-round"] };
  const roundResult = isPlainObject(session?.roundResults?.[requested]) ? session.roundResults[requested] : {};
  return {
    roundIndex: requested,
    roundNumber: positiveIntegerOrNull(round.roundNumber ?? round.number ?? round.round ?? requested + 1) ?? requested + 1,
    round,
    roundResult,
    event: session.event,
    blockedReasons: []
  };
}

function activeStationsFrom(round = {}, roundResult = {}) {
  const authored = Array.isArray(round.activeStations) ? round.activeStations : [];
  const fallback = Object.keys(roundResult.stationResults ?? {});
  return uniqueStrings((authored.length > 0 ? authored : fallback).map(stationKeyFrom));
}

function explicitOrderFrom(session = {}, context = {}, options = {}) {
  const direct = options.stationOrder ?? options.order;
  if (Array.isArray(direct)) return direct;
  const roundIndex = context.roundIndex;
  const orderState = isPlainObject(session.travelV2RoundActionOrder) ? session.travelV2RoundActionOrder : {};
  const roundOrder = orderState.rounds?.[String(roundIndex)] ?? orderState.rounds?.[roundIndex];
  for (const candidate of [
    roundOrder?.order,
    roundOrder?.stationOrder,
    context.roundResult?.stationActionOrder,
    context.roundResult?.actionOrder,
    context.roundResult?.stationOrder,
    context.round?.stationActionOrder,
    context.round?.actionOrder,
    context.round?.stationOrder
  ]) {
    if (Array.isArray(candidate) && candidate.length > 0) return candidate;
  }
  return [];
}

function normalizeStationOrder(session = {}, context = {}, options = {}) {
  const activeStations = activeStationsFrom(context.round, context.roundResult);
  const warnings = [];
  let rawOrder = explicitOrderFrom(session, context, options);
  let usedFallback = false;
  if (rawOrder.length === 0 && activeStations.length > 0) {
    rawOrder = context.round.activeStations;
    usedFallback = true;
    warnings.push("station-order-fallback-active-stations");
  }
  const ordered = uniqueStrings(rawOrder.map(stationKeyFrom).filter((key) => activeStations.includes(key)));
  const stationOrder = [...ordered, ...activeStations.filter((key) => !ordered.includes(key))];
  const orderRecord = session?.travelV2RoundActionOrder?.rounds?.[String(context.roundIndex)] ?? session?.travelV2RoundActionOrder?.rounds?.[context.roundIndex] ?? null;
  const stationOrderLocked = options.stationOrderLocked === true
    || orderRecord?.locked === true
    || orderRecord?.committed === true
    || Boolean(orderRecord?.committedAt)
    || (isPlainObject(context.roundResult?.stationOrderCommitments)
      && activeStations.length > 0
      && activeStations.every((key) => context.roundResult.stationOrderCommitments[key]?.committed === true));
  return { activeStations, stationOrder, stationOrderLocked, warnings, usedFallback };
}

function stationNameFor(round = {}, stationKey = "") {
  const prompt = round?.stationPrompts?.[stationKey] ?? {};
  const card = (Array.isArray(round?.stationCards) ? round.stationCards : []).find((entry) => stationKeyFrom(entry) === stationKey) ?? {};
  return text(prompt.stationName ?? prompt.label ?? prompt.name ?? card.stationName ?? card.label ?? card.name) || humanizeIdentifier(stationKey);
}

function collectAuthoredDefinitions(context = {}) {
  const rows = [];
  const round = context.round ?? {};
  const event = context.event ?? {};
  const add = (value, metadata = {}) => {
    for (const record of recordsFrom(value)) rows.push({ record: cloneData(record), ...metadata });
  };

  for (const card of Array.isArray(round.stationCards) ? round.stationCards : []) {
    const sourceStationKey = stationKeyFrom(card);
    add(card?.interStationHelp, { sourceStationKey, authoredFrom: "round.stationCards.interStationHelp" });
    add(card?.helpActions, { sourceStationKey, authoredFrom: "round.stationCards.helpActions" });
    add(card?.supportActions, { sourceStationKey, authoredFrom: "round.stationCards.supportActions" });
  }

  for (const [stationKey, prompt] of Object.entries(isPlainObject(round.stationPrompts) ? round.stationPrompts : {})) {
    add(prompt?.interStationHelp, { sourceStationKey: stationKey, authoredFrom: "round.stationPrompts.interStationHelp" });
    add(prompt?.helpActions, { sourceStationKey: stationKey, authoredFrom: "round.stationPrompts.helpActions" });
    add(prompt?.supportActions, { sourceStationKey: stationKey, authoredFrom: "round.stationPrompts.supportActions" });
  }

  add(round.interStationHelp, { sourceStationKey: "", authoredFrom: "round.interStationHelp" });
  add(round.helpActions, { sourceStationKey: "", authoredFrom: "round.helpActions" });
  add(event.interStationHelp, { sourceStationKey: "", authoredFrom: "event.interStationHelp" });
  add(event.helpActions, { sourceStationKey: "", authoredFrom: "event.helpActions" });
  return rows;
}

function targetKeysFrom(record = {}) {
  const direct = record.targetStationKey ?? record.targetStation ?? record.target ?? record.stationTarget ?? record.helpTarget;
  const collection = record.targetStationKeys ?? record.targets ?? record.allowedTargets;
  if (Array.isArray(collection)) return uniqueStrings(collection.map(stationKeyFrom));
  const directKey = stationKeyFrom(direct);
  return directKey ? [directKey] : [];
}

function actionIdFor(record = {}, sourceStationKey = "", targetStationKey = "", index = 0) {
  const supplied = text(record.actionId ?? record.helpActionId ?? record.id ?? record.key ?? record.slug);
  if (supplied) return supplied;
  return `inter-station-help:${sourceStationKey || "unknown"}:${targetStationKey || "unknown"}:${index + 1}`;
}

function normalizeAction(entry = {}, index = 0, context = {}, orderState = {}, options = {}) {
  const record = isPlainObject(entry.record) ? scrubForbidden(entry.record) : {};
  const sourceStationKey = stationKeyFrom(record.sourceStationKey ?? record.sourceStation ?? record.stationKey) || text(entry.sourceStationKey) || text(options.stationKey);
  const targets = targetKeysFrom(record);
  if (targets.length === 0) return { rows: [], dropReason: "missing-target-station" };
  const rows = [];
  for (const targetStationKey of targets) {
    if (!sourceStationKey) continue;
    if (!orderState.activeStations.includes(sourceStationKey) || !orderState.activeStations.includes(targetStationKey)) continue;
    if (sourceStationKey === targetStationKey) continue;
    const sourceIndex = orderState.stationOrder.indexOf(sourceStationKey);
    const targetIndex = orderState.stationOrder.indexOf(targetStationKey);
    if (sourceIndex < 0 || targetIndex < 0) continue;
    const targetLaterInOrder = targetIndex > sourceIndex;
    if (!targetLaterInOrder && options.includeUnavailable !== true) continue;
    const available = targetLaterInOrder;
    const title = text(record.title ?? record.name ?? record.label) || `${stationNameFor(context.round, sourceStationKey)} helps ${stationNameFor(context.round, targetStationKey)}`;
    const publicText = text(record.publicText ?? record.playerText ?? record.description ?? record.text ?? record.helpText ?? record.summary);
    const tags = sanitizeTags(record.tags ?? record.tag);
    rows.push({
      version: TRAVEL_V2_INTER_STATION_HELP_ACTIONS_VERSION,
      roundIndex: context.roundIndex,
      roundNumber: context.roundNumber,
      actionId: actionIdFor(record, sourceStationKey, targetStationKey, index),
      title,
      publicText,
      sourceStationKey,
      sourceStationName: stationNameFor(context.round, sourceStationKey),
      sourceOrderIndex: sourceIndex,
      sourceOrderNumber: sourceIndex + 1,
      targetStationKey,
      targetStationName: stationNameFor(context.round, targetStationKey),
      targetOrderIndex: targetIndex,
      targetOrderNumber: targetIndex + 1,
      targetLaterInOrder,
      available,
      unavailableReason: available ? null : "target-station-not-later-in-order",
      tags,
      authoredFrom: text(entry.authoredFrom),
      stationOrderLocked: orderState.stationOrderLocked === true,
      ...(criticalSuccessMetadataFrom(record) ? { criticalSuccessMetadata: criticalSuccessMetadataFrom(record) } : {}),
      playerSafe: true,
      reviewOnly: true,
      createsAssist: false,
      consumesAssist: false,
      applied: false
    });
  }
  return { rows, dropReason: rows.length === 0 ? "invalid-help-action-target" : null };
}

function dedupeActions(actions = []) {
  const seen = new Set();
  return actions.filter((action) => {
    const key = `${action.actionId}|${action.sourceStationKey}|${action.targetStationKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function groupBy(actions = [], keyFor) {
  const grouped = {};
  for (const action of actions) {
    const keys = keyFor(action);
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      if (!key) continue;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(cloneData(action));
    }
  }
  return grouped;
}

export function prepareTravelV2InterStationHelpActions(session = {}, options = {}) {
  const blockedReasons = [];
  const warnings = [];
  if (!isPlainObject(session) || Object.keys(session).length === 0) blockedReasons.push("travel-v2-session-required");
  const context = currentRoundContext(session, options);
  blockedReasons.push(...context.blockedReasons);
  const orderState = context.round ? normalizeStationOrder(session, context, options) : { activeStations: [], stationOrder: [], stationOrderLocked: false, warnings: [] };
  warnings.push(...orderState.warnings);
  if (context.round && orderState.activeStations.length === 0) blockedReasons.push("current-round-has-no-active-stations");
  if (context.round && orderState.stationOrder.length === 0) blockedReasons.push("station-order-unavailable");

  const stationKey = text(options.stationKey)
    || text(context.roundResult?.currentStationKey)
    || text(session?.travelV2RoundActionOrder?.currentStationKey)
    || orderState.stationOrder.find((key) => !context.roundResult?.stationResults?.[key])
    || orderState.stationOrder[0]
    || "";
  const stationName = stationKey ? stationNameFor(context.round, stationKey) : "";

  const normalized = [];
  const droppedReasons = [];
  if (blockedReasons.length === 0) {
    for (const [index, entry] of collectAuthoredDefinitions(context).entries()) {
      const prepared = normalizeAction(entry, index, context, orderState, options);
      normalized.push(...prepared.rows);
      if (prepared.dropReason) droppedReasons.push(prepared.dropReason);
    }
  }
  const helpActions = dedupeActions(normalized);
  const availableHelpActionCount = helpActions.filter((action) => action.available).length;
  if (helpActions.length === 0 && blockedReasons.length === 0) blockedReasons.push("no-valid-inter-station-help-actions");
  if (droppedReasons.length > 0) warnings.push(...uniqueStrings(droppedReasons));
  const ok = blockedReasons.length === 0;

  return deepFreeze({
    version: TRAVEL_V2_INTER_STATION_HELP_ACTIONS_VERSION,
    ok,
    available: availableHelpActionCount > 0,
    canReview: helpActions.length > 0,
    roundIndex: context.roundIndex,
    roundNumber: context.roundNumber,
    stationKey,
    stationName,
    stationOrder: cloneData(orderState.stationOrder),
    stationOrderLocked: orderState.stationOrderLocked === true,
    helpReady: availableHelpActionCount > 0,
    helpActionCount: helpActions.length,
    availableHelpActionCount,
    helpActions: cloneData(helpActions),
    byTargetStation: groupBy(helpActions, (action) => action.targetStationKey),
    bySourceStation: groupBy(helpActions, (action) => action.sourceStationKey),
    byTag: groupBy(helpActions, (action) => action.tags),
    blockedReasons: uniqueStrings(blockedReasons),
    warnings: uniqueStrings(warnings),
    applied: false
  });
}

export default prepareTravelV2InterStationHelpActions;
