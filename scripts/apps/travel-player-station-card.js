import { arcflightTemplatePath } from "../sheets/sheet-helpers.js";
import { buildTravelPlayerStationOrderCommitData, normalizeTravelEventRunnerSession, prepareTravelPlayerMissionBoardState, prepareTravelPlayerReactionPromptState, prepareTravelPlayerStationCardState } from "../helpers/travel-event-runner.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const activeTravelPlayerStationCards = new Map();
const TRAVEL_PLAYER_STATION_CARD_SOCKET_ACTION = "openTravelPlayerStationCard";
const TRAVEL_PLAYER_STATION_CARD_SOCKET_TEST_ACTION = "arcflightSocketDiagnostic";
const TRAVEL_PLAYER_STATION_APPROACH_SUBMIT_ACTION = "submitTravelPlayerStationApproach";
const TRAVEL_PLAYER_MISSION_BOARD_SOCKET_ACTION = "openTravelPlayerMissionBoard";
const TRAVEL_PLAYER_MISSION_BOARD_REFRESH_ACTION = "refreshTravelPlayerMissionBoard";
const TRAVEL_PLAYER_MISSION_BOARD_STATION_UPDATE_ACTION = "updateTravelPlayerMissionBoardStation";
const TRAVEL_PLAYER_STATION_ROLL_ACTION = "rollTravelPlayerStation";
const TRAVEL_PLAYER_REACTION_PROMPT_ACTION = "openTravelPlayerReactionPrompt";
const TRAVEL_PLAYER_REACTION_RESPONSE_ACTION = "resolveTravelPlayerReactionPrompt";

let travelPlayerStationApproachSubmitHandler = null;
let travelPlayerStationRollHandler = null;
let travelPlayerReactionResponseHandler = null;
const missionBoardRefreshTimers = new Map();
const activeTravelPlayerReactionPrompts = new Map();

function debugTravelReaction(message, data = {}) {
  try {
    if (globalThis.game?.settings?.get?.("arcflight", "debugTravelReactions") !== true) return;
    console.debug(`Arcflight | Travel Reaction | ${message}`, data);
  } catch (_error) {
    // Debug logging must never break player flows.
  }
}

function sanitizeText(value) {
  return typeof value === "string" ? value : "";
}

function sanitizeBoolean(value) {
  return value === true;
}

function sanitizeApproachOptions(value = []) {
  return (Array.isArray(value) ? value : [])
    .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => ({
      skill: sanitizeText(entry.skill),
      value: sanitizeText(entry.value ?? entry.optionKey ?? entry.skill),
      optionKey: sanitizeText(entry.optionKey ?? entry.value),
      actionType: sanitizeText(entry.actionType) || "eventApproach",
      stabilizePressureKey: sanitizeText(entry.stabilizePressureKey),
      pressureLabel: sanitizeText(entry.pressureLabel),
      skillLabel: sanitizeText(entry.skillLabel),
      statisticLabel: sanitizeText(entry.statisticLabel),
      modifier: Number.isFinite(Number(entry.modifier)) ? Number(entry.modifier) : null,
      modifierLabel: sanitizeText(entry.modifierLabel),
      label: sanitizeText(entry.label),
      displayLabel: sanitizeText(entry.displayLabel),
      helpText: sanitizeText(entry.helpText),
      dc: Number.isFinite(Number(entry.dc)) ? Number(entry.dc) : null,
      dcLabel: sanitizeText(entry.dcLabel),
      selected: sanitizeBoolean(entry.selected),
      selectedClass: sanitizeBoolean(entry.selected) ? "arcflight-travel-card--selected" : "",
      typeLabel: sanitizeText(entry.actionType) === "stabilize" ? "Stabilize" : "Push Forward"
    }))
    .filter((entry) => entry.skill || entry.label || entry.helpText);
}

function sanitizePublicHazards(value = []) {
  return (Array.isArray(value) ? value : [])
    .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => ({
      id: sanitizeText(entry.id),
      name: sanitizeText(entry.name),
      category: sanitizeText(entry.category),
      playerText: sanitizeText(entry.playerText),
      publicModifierText: sanitizeText(entry.publicModifierText),
      status: sanitizeText(entry.status),
      affectedStations: Array.isArray(entry.affectedStations) ? entry.affectedStations.map(sanitizeText).filter(Boolean) : [],
      affectedStationText: sanitizeText(entry.affectedStationText),
      responseActions: (Array.isArray(entry.responseActions) ? entry.responseActions : []).filter((action) => action && typeof action === "object" && !Array.isArray(action)).map((action) => ({ key: sanitizeText(action.key), stationKey: sanitizeText(action.stationKey), stationLabel: sanitizeText(action.stationLabel), label: sanitizeText(action.label), skill: sanitizeText(action.skill), helpText: sanitizeText(action.helpText) }))
    }))
    .filter((entry) => entry.name || entry.playerText);
}

function sanitizePublicShipScars(value = []) {
  return (Array.isArray(value) ? value : [])
    .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => ({
      id: sanitizeText(entry.id),
      name: sanitizeText(entry.name),
      severity: sanitizeText(entry.severity),
      category: sanitizeText(entry.category),
      playerText: sanitizeText(entry.playerText),
      repairRequirement: sanitizeText(entry.repairRequirement),
      status: sanitizeText(entry.status)
    }))
    .filter((entry) => entry.name || entry.playerText);
}


function sanitizePressureGauges(value = []) {
  return (Array.isArray(value) ? value : [])
    .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => ({
      key: sanitizeText(entry.key),
      icon: sanitizeText(entry.icon),
      label: sanitizeText(entry.label),
      description: sanitizeText(entry.description),
      value: Math.max(0, Math.min(4, sanitizeInteger(entry.value, 0))),
      valueLabel: sanitizeText(entry.valueLabel) || `${Math.max(0, Math.min(4, sanitizeInteger(entry.value, 0)))} / 4`,
      statusBand: sanitizeText(entry.statusBand) || "Calm",
      stateClass: sanitizeText(entry.stateClass) || "calm",
      needleAngle: Number.isFinite(Number(entry.needleAngle)) ? Number(entry.needleAngle) : -60,
      fillPercent: Number.isFinite(Number(entry.fillPercent)) ? Number(entry.fillPercent) : 0,
      tooltip: sanitizeText(entry.tooltip)
    }))
    .filter((entry) => entry.key && entry.label);
}

function sanitizePartyAlerts(value = []) {
  return (Array.isArray(value) ? value : [])
    .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => ({ tone: sanitizeText(entry.tone) || "attention", icon: sanitizeText(entry.icon), text: sanitizeText(entry.text) }))
    .filter((entry) => entry.text);
}

function sanitizeFocusOptions(value = []) {
  return (Array.isArray(value) ? value : [])
    .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => ({
      value: sanitizeText(entry.value ?? entry.key),
      label: sanitizeText(entry.label ?? entry.name),
      description: sanitizeText(entry.description ?? entry.whatItHelps),
      whatItHelps: sanitizeText(entry.whatItHelps ?? entry.description),
      publicRiskText: sanitizeText(entry.publicRiskText),
      publicBacklashPreviewText: sanitizeText(entry.publicBacklashPreviewText),
      available: sanitizeBoolean(entry.available),
      blocked: sanitizeBoolean(entry.blocked),
      blockedReason: sanitizeText(entry.blockedReason),
      stationKey: sanitizeText(entry.stationKey),
      roundIndex: sanitizeInteger(entry.roundIndex, 0),
      used: sanitizeBoolean(entry.used),
      unavailable: sanitizeBoolean(entry.unavailable)
    }))
    .filter((entry) => entry.value && entry.label);
}

function sanitizeInteger(value, fallback = -1) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function sanitizeTravelPlayerStationCardState(state = {}) {
  const source = state && typeof state === "object" && !Array.isArray(state) ? state : {};
  return {
    hasSession: sanitizeBoolean(source.hasSession),
    sessionKey: sanitizeText(source.sessionKey),
    roundLabel: sanitizeText(source.roundLabel),
    roundTitle: sanitizeText(source.roundTitle),
    stationKey: sanitizeText(source.stationKey),
    stationName: sanitizeText(source.stationName) || "Travel Station",
    assignedActorName: sanitizeText(source.assignedActorName) || "Unassigned",
    promptText: sanitizeText(source.promptText),
    hasPromptText: sanitizeBoolean(source.hasPromptText),
    selectedApproachLabel: sanitizeText(source.selectedApproachLabel),
    selectedApproachHelpText: sanitizeText(source.selectedApproachHelpText),
    selectedApproachRollLabel: sanitizeText(source.selectedApproachRollLabel),
    hasSelectedApproach: sanitizeBoolean(source.hasSelectedApproach),
    hasSelectedApproachHelpText: sanitizeBoolean(source.hasSelectedApproachHelpText),
    resultStatusLabel: sanitizeText(source.resultStatusLabel) || "Waiting for GM resolution",
    resultLabel: sanitizeText(source.resultLabel),
    resultFeedbackText: sanitizeText(source.resultFeedbackText),
    hasResultFeedback: sanitizeBoolean(source.hasResultFeedback),
    waitingStateText: sanitizeText(source.waitingStateText) || "Waiting for GM resolution",
    isResolved: sanitizeBoolean(source.isResolved),
    statusKey: sanitizeText(source.statusKey) || "waitingOnGm",
    approachOptions: sanitizeApproachOptions(source.approachOptions),
    hasApproachOptions: sanitizeBoolean(source.hasApproachOptions) || sanitizeApproachOptions(source.approachOptions).length > 0,
    selectedApproachValue: sanitizeText(source.selectedApproachValue),
    selectedStationOrder: sanitizeText(source.selectedStationOrder) || "eventApproach",
    selectedStationOrderLabel: sanitizeText(source.selectedStationOrderLabel) || "Push Forward",
    stationOrderCommitted: sanitizeBoolean(source.stationOrderCommitted),
    isStabilize: sanitizeBoolean(source.isStabilize),
    stabilizePressureKey: sanitizeText(source.stabilizePressureKey),
    stabilizePressureLabel: sanitizeText(source.stabilizePressureLabel),
    focusCapacity: Math.max(0, sanitizeInteger(source.focusCapacity, 0)),
    focusRemaining: Math.max(0, sanitizeInteger(source.focusRemaining, 0)),
    focusOptions: sanitizeFocusOptions(source.focusOptions),
    hasFocusOptions: sanitizeFocusOptions(source.focusOptions).length > 0,
    selectedFocusAbility: sanitizeText(source.selectedFocusAbility),
    noFocusRemaining: sanitizeBoolean(source.noFocusRemaining),
    canSpendFocus: sanitizeBoolean(source.canSpendFocus),
    focusBlocked: sanitizeBoolean(source.focusBlocked),
    focusBlockedReason: sanitizeText(source.focusBlockedReason),
    focusBlockedHazardName: sanitizeText(source.focusBlockedHazardName),
    hasPendingReactionPrompt: sanitizeBoolean(source.hasPendingReactionPrompt),
    pendingReactionPromptId: sanitizeText(source.pendingReactionPromptId),
    pendingReactionPromptTitle: sanitizeText(source.pendingReactionPromptTitle),
    pendingReactionPromptAbilityLabel: sanitizeText(source.pendingReactionPromptAbilityLabel),
    hasPublicHazards: sanitizeBoolean(source.hasPublicHazards) || sanitizePublicHazards(source.publicHazards).length > 0,
    publicHazards: sanitizePublicHazards(source.publicHazards),
    hasPublicShipScars: sanitizeBoolean(source.hasPublicShipScars) || sanitizePublicShipScars(source.publicShipScars).length > 0,
    publicShipScars: sanitizePublicShipScars(source.publicShipScars),
    hasPendingReactionBacklash: sanitizeBoolean(source.hasPendingReactionBacklash),
    pendingReactionBacklashText: sanitizeText(source.pendingReactionBacklashText),
    currentRoundIndex: sanitizeInteger(source.currentRoundIndex, -1)
  };
}

function sanitizeTravelPlayerReactionPromptState(state = {}) {
  const source = state && typeof state === "object" && !Array.isArray(state) ? state : {};
  return {
    available: sanitizeBoolean(source.available),
    permitted: sanitizeBoolean(source.permitted),
    sessionKey: sanitizeText(source.sessionKey),
    reactionPromptId: sanitizeText(source.reactionPromptId),
    roundIndex: sanitizeInteger(source.roundIndex, -1),
    stationKey: sanitizeText(source.stationKey),
    stationName: sanitizeText(source.stationName),
    abilityKey: sanitizeText(source.abilityKey),
    abilityLabel: sanitizeText(source.abilityLabel),
    status: sanitizeText(source.status),
    promptTitle: sanitizeText(source.promptTitle),
    promptText: sanitizeText(source.promptText),
    choiceText: sanitizeText(source.choiceText),
    effectText: sanitizeText(source.effectText),
    canAccept: sanitizeBoolean(source.canAccept),
    canDismiss: sanitizeBoolean(source.canDismiss)
  };
}

function buildTravelPlayerStationOrderPayload(state = {}, optionKey = "", options = {}) {
  const commit = buildTravelPlayerStationOrderCommitData(sanitizeTravelPlayerStationCardState(state), optionKey);
  return {
    action: TRAVEL_PLAYER_STATION_APPROACH_SUBMIT_ACTION,
    ...commit,
    userId: sanitizeText(options.userId ?? globalThis.game?.user?.id)
  };
}

function stationCardInstanceKey({ session = null, stationKey = "", state = null } = {}) {
  if (state) {
    const safe = sanitizeTravelPlayerStationCardState(state);
    return `${safe.sessionKey || "socket-session"}:${safe.stationKey || "station"}`;
  }
  return `${session?.key ?? "unsaved-session"}:${stationKey || "station"}`;
}

function bringCardToFront(app) {
  if (!app) return;
  if (typeof app.bringToFront === "function") app.bringToFront();
}

function getUserCollectionValues() {
  const users = globalThis.game?.users;
  if (!users) return [];
  if (typeof users.filter === "function") return users.filter(() => true);
  if (typeof users.values === "function") return Array.from(users.values());
  if (Array.isArray(users)) return users;
  return [];
}

function getActorCollectionValues(options = {}) {
  const actors = options.actors ?? globalThis.game?.actors;
  if (!actors) return [];
  if (typeof actors.filter === "function") return actors.filter(() => true);
  if (typeof actors.values === "function") return Array.from(actors.values());
  if (Array.isArray(actors)) return actors;
  return [];
}

function actorUuid(actor) {
  return typeof actor?.uuid === "string" ? actor.uuid : (actor?.id ? `Actor.${actor.id}` : "");
}

function getStationAssignment(session, stationKey) {
  const normalized = normalizeTravelEventRunnerSession(session);
  return normalized.session?.stationAssignments?.[stationKey] ?? null;
}

function getActorByStationAssignment(session, stationKey, options = {}) {
  const assignment = getStationAssignment(session, stationKey);
  if (!assignment?.actorId && !assignment?.actorUuid) return null;
  return getActorCollectionValues(options).find((actor) => actor?.id === assignment.actorId || actorUuid(actor) === assignment.actorUuid) ?? null;
}

function getOwnershipLevel(actor, userId) {
  const level = Number(actor?.ownership?.[userId] ?? actor?.data?.ownership?.[userId]);
  if (Number.isFinite(level)) return level;
  const defaultLevel = Number(actor?.ownership?.default ?? actor?.data?.ownership?.default);
  return Number.isFinite(defaultLevel) ? defaultLevel : 0;
}

function getObserverThreshold() {
  return Number(globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2);
}

function getActiveNonGmUsers() {
  return getUserCollectionValues()
    .filter((user) => user?.active === true && user?.isGM !== true && typeof user.id === "string")
    .map((user) => ({ id: user.id, name: user.name ?? user.id }));
}

export function resolveActivePlayerOwnersForStation(session, stationKey, options = {}) {
  const actor = options.assignedActor ?? getActorByStationAssignment(session, stationKey, options);
  if (!actor) return [];
  const observerThreshold = getObserverThreshold();
  return getActiveNonGmUsers()
    .filter((user) => getOwnershipLevel(actor, user.id) >= observerThreshold);
}

export function sendTravelPlayerReactionPromptToPlayers(session, reactionPromptId, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  const record = normalized.session?.reactionPrompts?.records?.find((entry) => entry.reactionPromptId === reactionPromptId) ?? null;
  debugTravelReaction("Preparing player reaction prompt delivery.", {
    sessionKey: normalized.session?.key ?? "",
    reactionPromptId,
    hasRecord: Boolean(record),
    recordStatus: record?.status ?? "",
    stationKey: record?.stationKey ?? "",
    abilityKey: record?.abilityKey ?? ""
  });
  if (!record || record.status !== "pending") return { ok: false, errors: ["Reaction prompt is not pending."], sentRecipients: 0, targetUserIds: [] };
  const owners = resolveActivePlayerOwnersForStation(normalized.session, record.stationKey, options);
  const targetUserIds = owners.map((owner) => owner.id);
  debugTravelReaction("Resolved player reaction prompt delivery targets.", {
    sessionKey: normalized.session?.key ?? "",
    reactionPromptId,
    stationKey: record.stationKey,
    ownerIds: owners.map((owner) => owner.id),
    ownerNames: owners.map((owner) => owner.name ?? owner.id),
    targetUserIds
  });
  if (targetUserIds.length === 0) return { ok: false, errors: ["No active assigned player controls this station."], sentRecipients: 0, targetUserIds };
  if (!globalThis.game?.socket || typeof game.socket.emit !== "function") return { ok: false, errors: ["Foundry socket is not available."], sentRecipients: 0, targetUserIds };
  const state = prepareTravelPlayerReactionPromptState(normalized.session, reactionPromptId, {
    ...options,
    userId: targetUserIds[0],
    permittedUserIds: targetUserIds
  });
  const payload = {
    action: TRAVEL_PLAYER_REACTION_PROMPT_ACTION,
    targetUserIds,
    state: sanitizeTravelPlayerReactionPromptState(state)
  };
  debugTravelReaction("Emitting player reaction prompt socket payload.", {
    action: payload.action,
    reactionPromptId,
    targetUserIds,
    state: payload.state
  });
  globalThis.game?.socket?.emit?.("module.arcflight", payload);
  return { ok: true, errors: [], sentRecipients: targetUserIds.length, targetUserIds, owners, payload, state: payload.state };
}

function emitTravelPlayerStationCard(state, targetUserIds) {
  const socket = globalThis.game?.socket;
  if (!socket || typeof socket.emit !== "function") return { ok: false, errors: ["Foundry socket is not available."], targetUserIds, state };
  const payload = {
    action: TRAVEL_PLAYER_STATION_CARD_SOCKET_ACTION,
    state: sanitizeTravelPlayerStationCardState(state),
    targetUserIds: Array.isArray(targetUserIds) ? targetUserIds.filter(Boolean) : []
  };
  socket.emit("module.arcflight", payload);
  return { ok: true, errors: [], payload, targetUserIds: payload.targetUserIds, state: payload.state };
}

export function sendTravelPlayerStationCardSocketDiagnostic(options = {}) {
  const users = getActiveNonGmUsers();
  const targetUserIds = users.map((user) => user.id);
  const payload = {
    action: TRAVEL_PLAYER_STATION_CARD_SOCKET_TEST_ACTION,
    targetUserIds,
    message: "Arcflight socket diagnostic",
    sentAt: Date.now()
  };

  console.warn("Arcflight | Sending socket diagnostic.", {
    targetUserIds,
    users
  });

  globalThis.game?.socket?.emit?.("module.arcflight", payload);

  return {
    ok: targetUserIds.length > 0,
    sentRecipients: targetUserIds.length,
    targetUserIds,
    users,
    payload,
    errors: targetUserIds.length > 0 ? [] : ["No active non-GM users found."]
  };
}

export function broadcastTravelPlayerStationCardToAllPlayers(session, stationKey, options = {}) {
  const state = sanitizeTravelPlayerStationCardState(prepareTravelPlayerStationCardState(session, stationKey, options));
  const users = getActiveNonGmUsers();
  const targetUserIds = users.map((user) => user.id);

  if (targetUserIds.length === 0) {
    return {
      ok: false,
      errors: ["No active non-GM users found."],
      sentRecipients: 0,
      targetUserIds,
      users,
      state
    };
  }

  console.warn("Arcflight | Force-broadcasting player station card.", {
    stationKey,
    targetUserIds,
    users,
    state
  });

  const emitted = emitTravelPlayerStationCard(state, targetUserIds);

  return {
    ...emitted,
    ok: emitted.ok,
    sentRecipients: emitted.ok ? targetUserIds.length : 0,
    targetUserIds,
    users,
    stationKey,
    state,
    fallbackBroadcast: true
  };
}

export function sendTravelPlayerStationCardToPlayers(session, stationKey, options = {}) {
  const state = sanitizeTravelPlayerStationCardState(prepareTravelPlayerStationCardState(session, stationKey, options));
  const owners = resolveActivePlayerOwnersForStation(session, stationKey, options);
  const fallbackBroadcast = owners.length === 0;
  const recipients = fallbackBroadcast ? getActiveNonGmUsers() : owners;
  if (recipients.length === 0) {
    return { ok: false, errors: ["No active player users found."], warnings: [], sent: 0, sentRecipients: 0, skipped: 1, stationKey, state, targetUserIds: [], owners: [], fallbackBroadcast };
  }
  const targetUserIds = recipients.map((recipient) => recipient.id);
  const emitted = emitTravelPlayerStationCard(state, targetUserIds);
  return {
    ...emitted,
    sent: emitted.ok ? targetUserIds.length : 0,
    sentRecipients: emitted.ok ? targetUserIds.length : 0,
    skipped: emitted.ok ? 0 : 1,
    stationKey,
    owners: recipients,
    fallbackBroadcast
  };
}

export function sendAllTravelPlayerStationCardsToPlayers(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  const round = normalized.session?.event?.rounds?.[normalized.session?.currentRoundIndex ?? 0] ?? null;
  const stationKeys = Array.isArray(round?.activeStations) ? round.activeStations : [];
  let sentCards = 0;
  let sentRecipients = 0;
  let skipped = 0;
  let fallbackBroadcasts = 0;
  const results = [];
  for (const stationKey of stationKeys) {
    const result = sendTravelPlayerStationCardToPlayers(normalized.session, stationKey, options);
    results.push(result);
    if (result.ok) {
      sentCards += 1;
      sentRecipients += Number(result.sentRecipients ?? result.sent ?? 0);
      if (result.fallbackBroadcast === true) fallbackBroadcasts += 1;
    } else {
      skipped += 1;
    }
  }
  return { ok: sentCards > 0, errors: sentCards > 0 ? [] : ["No player station cards were sent."], warnings: [], sentCards, sentRecipients, skipped, fallbackBroadcasts, results };
}

export function handleTravelPlayerStationCardSocketPayload(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  if (payload.action === TRAVEL_PLAYER_STATION_CARD_SOCKET_TEST_ACTION) {
    const userId = globalThis.game?.user?.id ?? "";
    const targetUserIds = Array.isArray(payload.targetUserIds) ? payload.targetUserIds : [];
    const matched = Boolean(userId && targetUserIds.includes(userId));

    console.warn("Arcflight | Socket diagnostic received.", {
      userId,
      targetUserIds,
      matched,
      payload
    });

    if (matched) ui.notifications?.info?.("Arcflight socket diagnostic received.");
    return true;
  }
  if (payload.action === TRAVEL_PLAYER_STATION_APPROACH_SUBMIT_ACTION) {
    if (globalThis.game?.user?.isGM !== true) return true;
    if (typeof travelPlayerStationApproachSubmitHandler === "function") {
      travelPlayerStationApproachSubmitHandler(payload);
    } else {
      console.warn("Arcflight | No Travel Player Station approach submit handler registered.", payload);
    }
    return true;
  }
  if (payload.action === TRAVEL_PLAYER_STATION_ROLL_ACTION) {
    if (globalThis.game?.user?.isGM !== true) return true;
    if (typeof travelPlayerStationRollHandler === "function") travelPlayerStationRollHandler(payload);
    else console.warn("Arcflight | No Travel Player Station roll handler registered.", payload);
    return true;
  }
  if (payload.action === TRAVEL_PLAYER_REACTION_RESPONSE_ACTION) {
    if (globalThis.game?.user?.isGM !== true) return true;
    if (typeof travelPlayerReactionResponseHandler === "function") travelPlayerReactionResponseHandler(payload);
    else console.warn("Arcflight | No Travel Player reaction response handler registered.", payload);
    return true;
  }
  if (payload.action === TRAVEL_PLAYER_REACTION_PROMPT_ACTION) {
    const userId = globalThis.game?.user?.id ?? "";
    const targetUserIds = Array.isArray(payload.targetUserIds) ? payload.targetUserIds : [];
    debugTravelReaction("Player received reaction prompt socket payload.", {
      userId,
      targetUserIds,
      matched: Boolean(userId && targetUserIds.includes(userId)),
      reactionPromptId: payload?.state?.reactionPromptId ?? "",
      stationKey: payload?.state?.stationKey ?? "",
      abilityKey: payload?.state?.abilityKey ?? "",
      available: payload?.state?.available === true
    });
    if (!userId || !targetUserIds.includes(userId)) return true;
    openTravelPlayerReactionPrompt({ state: payload.state }).catch((error) => {
      console.error("Arcflight | Failed to open player reaction prompt from socket.", error);
      ui.notifications?.error?.("Arcflight failed to open the reaction prompt. Reopen it from your station card.");
    });
    return true;
  }
  if (payload.action === TRAVEL_PLAYER_MISSION_BOARD_STATION_UPDATE_ACTION) {
    const userId = globalThis.game?.user?.id ?? "";
    const targetUserIds = Array.isArray(payload.targetUserIds) ? payload.targetUserIds : [];
    if (!userId || !targetUserIds.includes(userId)) return true;
    const key = payload.sessionKey || "travel-player-mission-board";
    const app = activeTravelPlayerMissionBoards.get(key);
    if (app && payload.station) app.updateStationState(payload.station, { render: true });
    return true;
  }
  if (payload.action === TRAVEL_PLAYER_MISSION_BOARD_SOCKET_ACTION || payload.action === TRAVEL_PLAYER_MISSION_BOARD_REFRESH_ACTION) {
    const userId = globalThis.game?.user?.id ?? "";
    const targetUserIds = Array.isArray(payload.targetUserIds) ? payload.targetUserIds : [];
    if (!userId || !targetUserIds.includes(userId)) return true;
    openTravelPlayerMissionBoard({ state: payload.state })
      .then(() => ui.notifications?.info?.("Arcflight travel mission board updated."))
      .catch((error) => console.error("Arcflight | Failed to open player mission board from socket.", error));
    return true;
  }
  if (payload.action !== TRAVEL_PLAYER_STATION_CARD_SOCKET_ACTION) return false;
  const userId = globalThis.game?.user?.id ?? "";
  const targetUserIds = Array.isArray(payload.targetUserIds) ? payload.targetUserIds : [];
  const matched = Boolean(userId && targetUserIds.includes(userId));
  console.debug("Arcflight | Player station card socket payload received.", {
    userId,
    targetUserIds,
    stationKey: payload?.state?.stationKey,
    matched
  });
  if (!matched) return true;
  console.warn("Arcflight | Opening player station card from socket.", {
    userId,
    stationKey: payload?.state?.stationKey
  });
  openTravelPlayerStationCard({ state: payload.state })
    .then(() => ui.notifications?.info?.("Arcflight player station card opened."))
    .catch((error) => {
      console.error("Arcflight | Failed to open player station card from socket.", error);
      ui.notifications?.error?.("Arcflight failed to open player station card. See console.");
    });
  return true;
}

export function registerTravelPlayerStationApproachSubmitHandler(handler) {
  travelPlayerStationApproachSubmitHandler = typeof handler === "function" ? handler : null;
}

export class ArcflightTravelPlayerReactionPrompt extends HandlebarsApplicationMixin(ApplicationV2) {
  #boundClick = this.#onClick.bind(this);

  constructor(options = {}) {
    super(options);
    this.promptState = sanitizeTravelPlayerReactionPromptState(options.state);
  }

  static DEFAULT_OPTIONS = {
    id: "arcflight-travel-player-reaction-prompt",
    classes: ["arcflight", "arcflight-travel-player-reaction-prompt"],
    position: { width: 430, height: "auto" },
    window: { title: "Station Focus Reaction", resizable: false }
  };

  static PARTS = {
    prompt: { template: arcflightTemplatePath("apps/travel-player-reaction-prompt.hbs") }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return { ...context, state: this.promptState };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element?.removeEventListener("click", this.#boundClick);
    this.element?.addEventListener("click", this.#boundClick);
    this.bringToFront?.();
    if (this.element?.style) this.element.style.zIndex = String(Math.max(Number(this.element.style.zIndex) || 0, 10000));
  }

  async #onClick(event) {
    const target = event.target?.closest?.("[data-arcflight-player-reaction-response]");
    if (!target || !this.element?.contains(target) || target.disabled === true) return;
    event.preventDefault();
    const response = target.dataset.arcflightPlayerReactionResponse ?? "";
    if (!["accept", "dismiss"].includes(response)) return;
    debugTravelReaction("Player reaction prompt response emitted.", {
      sessionKey: this.promptState.sessionKey,
      reactionPromptId: this.promptState.reactionPromptId,
      stationKey: this.promptState.stationKey,
      abilityKey: this.promptState.abilityKey,
      response,
      userId: globalThis.game?.user?.id ?? ""
    });
    globalThis.game?.socket?.emit?.("module.arcflight", {
      action: TRAVEL_PLAYER_REACTION_RESPONSE_ACTION,
      sessionKey: this.promptState.sessionKey,
      reactionPromptId: this.promptState.reactionPromptId,
      response,
      userId: globalThis.game?.user?.id ?? ""
    });
    ui.notifications?.info?.(response === "accept" ? "Focus spend sent to the GM. Prepare to reroll." : "Reaction ignored.");
    await this.close();
  }

  async close(options = {}) {
    if (activeTravelPlayerReactionPrompts.get(this.promptState.reactionPromptId) === this) activeTravelPlayerReactionPrompts.delete(this.promptState.reactionPromptId);
    return super.close(options);
  }
}

export async function openTravelPlayerReactionPrompt(options = {}) {
  const state = sanitizeTravelPlayerReactionPromptState(options.state);
  debugTravelReaction("Player reaction prompt open requested.", {
    reactionPromptId: state.reactionPromptId,
    stationKey: state.stationKey,
    abilityKey: state.abilityKey,
    available: state.available,
    permitted: state.permitted,
    userId: globalThis.game?.user?.id ?? ""
  });
  if (!state.available || !state.reactionPromptId) {
    debugTravelReaction("Player reaction prompt open skipped.", {
      reactionPromptId: state.reactionPromptId,
      available: state.available,
      permitted: state.permitted
    });
    return null;
  }
  const existing = activeTravelPlayerReactionPrompts.get(state.reactionPromptId);
  if (existing) {
    existing.promptState = state;
    await existing.render(true);
    existing.bringToFront?.();
    debugTravelReaction("Player reaction prompt app refreshed.", { reactionPromptId: state.reactionPromptId });
    return existing;
  }
  const app = new ArcflightTravelPlayerReactionPrompt({ state });
  activeTravelPlayerReactionPrompts.set(state.reactionPromptId, app);
  await app.render(true);
  app.bringToFront?.();
  debugTravelReaction("Player reaction prompt app opened.", { reactionPromptId: state.reactionPromptId, stationKey: state.stationKey, abilityKey: state.abilityKey });
  return app;
}

export class ArcflightTravelPlayerStationCard extends HandlebarsApplicationMixin(ApplicationV2) {
  #boundPlayerCardClick = this.#onPlayerCardClick.bind(this);
  #boundPlayerCardChange = this.#onPlayerCardChange.bind(this);

  constructor(options = {}) {
    super(options);
    this.session = options.session ?? null;
    this.stationKey = options.stationKey ?? "";
    this.actor = options.actor ?? null;
    this.playerCardState = options.state ? sanitizeTravelPlayerStationCardState(options.state) : null;
    this.instanceKey = stationCardInstanceKey({ session: this.session, stationKey: this.stationKey, state: this.playerCardState });
  }

  static DEFAULT_OPTIONS = {
    id: "arcflight-travel-player-station-card",
    classes: ["arcflight", "arcflight-travel-player-station-card"],
    position: { width: 420, height: "auto" },
    window: { title: "Travel Station Card", resizable: true }
  };

  static PARTS = {
    card: { template: arcflightTemplatePath("apps/travel-player-station-card.hbs") }
  };

  async setContext({ session = this.session, stationKey = this.stationKey, actor = this.actor, state = this.playerCardState } = {}, { render = true } = {}) {
    const previousKey = this.instanceKey;
    this.playerCardState = state ? sanitizeTravelPlayerStationCardState(state) : null;
    this.session = this.playerCardState ? null : (session ?? null);
    this.stationKey = this.playerCardState ? this.playerCardState.stationKey : (stationKey ?? "");
    this.actor = this.playerCardState ? null : (actor ?? null);
    this.instanceKey = stationCardInstanceKey({ session: this.session, stationKey: this.stationKey, state: this.playerCardState });
    if (previousKey !== this.instanceKey && activeTravelPlayerStationCards.get(previousKey) === this) activeTravelPlayerStationCards.delete(previousKey);
    activeTravelPlayerStationCards.set(this.instanceKey, this);
    if (render) await this.render(true);
    return this;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const state = this.playerCardState ?? prepareTravelPlayerStationCardState(this.session, this.stationKey, { actor: this.actor });
    return { ...context, state };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element?.removeEventListener("click", this.#boundPlayerCardClick);
    this.element?.addEventListener("click", this.#boundPlayerCardClick);
    this.element?.removeEventListener("change", this.#boundPlayerCardChange);
    this.element?.addEventListener("change", this.#boundPlayerCardChange);
  }

  async #onPlayerCardChange(event) {
    const optionSelect = event.target?.closest?.("[data-arcflight-player-card-approach]");
    if (optionSelect && this.element?.contains(optionSelect) && this.playerCardState) {
      const selectedOption = this.playerCardState.approachOptions.find((entry) => entry.value === optionSelect.value) ?? null;
      this.playerCardState = sanitizeTravelPlayerStationCardState({
        ...this.playerCardState,
        approachOptions: this.playerCardState.approachOptions.map((entry) => ({ ...entry, selected: entry.value === optionSelect.value })),
        selectedApproachValue: optionSelect.value,
        selectedStationOrder: selectedOption?.actionType || "eventApproach",
        selectedStationOrderLabel: selectedOption?.actionType === "stabilize" ? "Stabilize" : "Push Forward",
        isStabilize: selectedOption?.actionType === "stabilize",
        stabilizePressureKey: selectedOption?.stabilizePressureKey || "",
        stabilizePressureLabel: selectedOption?.pressureLabel || ""
      });
      return this.render(true);
    }
    const focusSelect = event.target?.closest?.("[data-arcflight-player-card-focus]");
    if (focusSelect && this.element?.contains(focusSelect) && this.playerCardState) {
      this.playerCardState = sanitizeTravelPlayerStationCardState({ ...this.playerCardState, selectedFocusAbility: focusSelect.value ?? "" });
    }
  }

  async #onPlayerCardClick(event) {
    const target = event.target?.closest?.("[data-arcflight-player-card-select-approach], [data-arcflight-player-card-roll], [data-arcflight-player-card-reopen-reaction]");
    if (!target || !this.element?.contains(target) || target.disabled === true) return;
    event.preventDefault();
    if (target.hasAttribute("data-arcflight-player-card-reopen-reaction")) {
      globalThis.game?.socket?.emit?.("module.arcflight", {
        action: TRAVEL_PLAYER_REACTION_RESPONSE_ACTION,
        sessionKey: this.playerCardState?.sessionKey ?? "",
        reactionPromptId: this.playerCardState?.pendingReactionPromptId ?? "",
        response: "reopen",
        userId: globalThis.game?.user?.id ?? ""
      });
      return true;
    }
    if (target.hasAttribute("data-arcflight-player-card-select-approach")) return this.#selectApproachChoice(target.dataset.approachValue || "");
    if (target.hasAttribute("data-arcflight-player-card-roll")) return this.#rollSelectedApproach();
    return false;
  }

  async #selectApproachChoice(optionValue = "") {
    const optionKey = sanitizeText(optionValue);
    if (!optionKey || !this.playerCardState) return false;
    const selectedOption = this.playerCardState.approachOptions.find((entry) => entry.value === optionKey) ?? null;
    this.playerCardState = sanitizeTravelPlayerStationCardState({
      ...this.playerCardState,
      approachOptions: this.playerCardState.approachOptions.map((entry) => ({ ...entry, selected: entry.value === optionKey })),
      selectedApproachValue: optionKey,
      selectedApproachLabel: selectedOption?.label || optionKey,
      selectedApproachHelpText: selectedOption?.helpText || "",
      selectedApproachRollLabel: selectedOption ? `${selectedOption.statisticLabel || "Statistic unavailable"} vs ${selectedOption.dcLabel || "DC unavailable"}` : "",
      hasSelectedApproachHelpText: Boolean(selectedOption?.helpText),
      hasSelectedApproach: true,
      selectedStationOrder: selectedOption?.actionType || "eventApproach",
      selectedStationOrderLabel: selectedOption?.actionType === "stabilize" ? "Stabilize" : "Push Forward",
      isStabilize: selectedOption?.actionType === "stabilize",
      stabilizePressureKey: selectedOption?.stabilizePressureKey || "",
      stabilizePressureLabel: selectedOption?.pressureLabel || "",
      resultStatusLabel: "Ready to Roll",
      waitingStateText: `Ready to roll ${this.playerCardState.stationName}.`,
      statusKey: "readyToRoll"
    });
    await this.render(true);
    return true;
  }

  async #rollSelectedApproach() {
    const optionKey = sanitizeText(this.playerCardState?.selectedApproachValue);
    if (!optionKey) {
      ui.notifications?.warn?.("Select an action card before rolling.");
      return false;
    }
    if (!this.playerCardState) {
      ui.notifications?.warn?.("This player card cannot roll without socket state.");
      return false;
    }
    const selectedApproach = this.playerCardState.approachOptions.find((entry) => entry.value === optionKey) ?? null;
    this.playerCardState = sanitizeTravelPlayerStationCardState({ ...this.playerCardState, resultStatusLabel: "Rolling", waitingStateText: "Rolling your selected station action...", statusKey: "rolling" });
    await this.render(true);
    globalThis.game?.socket?.emit?.("module.arcflight", {
      action: TRAVEL_PLAYER_STATION_ROLL_ACTION,
      ...buildTravelPlayerStationOrderCommitData(this.playerCardState, optionKey),
      skill: selectedApproach?.skill || "",
      userId: globalThis.game?.user?.id ?? ""
    });
    this.playerCardState = sanitizeTravelPlayerStationCardState({ ...this.playerCardState, resultStatusLabel: "Rolling", waitingStateText: "Roll sent to the GM Command Bridge.", statusKey: "rolling" });
    ui.notifications?.info?.(`Rolling ${this.playerCardState.stationName}.`);
    await this.render(true);
    return true;
  }

  async #submitApproachChoice() {
    const select = this.element?.querySelector?.("[data-arcflight-player-card-approach]");
    const optionKey = sanitizeText(select?.value || this.playerCardState?.selectedApproachValue);
    if (!optionKey) {
      ui.notifications?.warn?.("Choose how to handle your station before committing.");
      return false;
    }
    if (!this.playerCardState) {
      ui.notifications?.warn?.("This player card cannot submit an approach without socket state.");
      return false;
    }
    globalThis.game?.socket?.emit?.("module.arcflight", buildTravelPlayerStationOrderPayload(this.playerCardState, optionKey));
    const selectedApproach = this.playerCardState.approachOptions.find((entry) => entry.value === optionKey) ?? null;
    this.playerCardState = sanitizeTravelPlayerStationCardState({
      ...this.playerCardState,
      selectedApproachValue: optionKey,
      selectedApproachLabel: selectedApproach?.label || optionKey,
      selectedApproachHelpText: selectedApproach?.helpText || "",
      selectedApproachRollLabel: selectedApproach ? `${selectedApproach.statisticLabel || "Statistic unavailable"} vs ${selectedApproach.dcLabel || "DC unavailable"}` : "",
      hasSelectedApproachHelpText: Boolean(selectedApproach?.helpText),
      hasSelectedApproach: true,
      selectedStationOrder: selectedApproach?.actionType || "eventApproach",
      selectedStationOrderLabel: selectedApproach?.actionType === "stabilize" ? "Stabilize" : "Push Forward",
      stationOrderCommitted: true,
      isStabilize: selectedApproach?.actionType === "stabilize",
      stabilizePressureKey: selectedApproach?.stabilizePressureKey || "",
      stabilizePressureLabel: selectedApproach?.pressureLabel || "",
      resultStatusLabel: "Action selected",
      waitingStateText: "Action selected. Roll from your station card when ready.",
      statusKey: "waitingOnGm"
    });
    ui.notifications?.info?.("Action selection sent to the GM.");
    await this.render(true);
    return true;
  }

  async close(options = {}) {
    if (activeTravelPlayerStationCards.get(this.instanceKey) === this) activeTravelPlayerStationCards.delete(this.instanceKey);
    return super.close(options);
  }
}

export async function openTravelPlayerStationCard(options = {}) {
  const appOptions = options && typeof options === "object" ? options : {};
  const key = stationCardInstanceKey({ session: appOptions.session, stationKey: appOptions.stationKey, state: appOptions.state });
  const app = activeTravelPlayerStationCards.get(key) ?? new ArcflightTravelPlayerStationCard(appOptions);
  activeTravelPlayerStationCards.set(key, app);

  try {
    await app.setContext(appOptions, { render: true });
    bringCardToFront(app);
  } catch (error) {
    console.warn("Arcflight | Unable to open Travel Player Station Card.", error);
  }

  return app;
}

const activeTravelPlayerMissionBoards = new Map();

function sanitizeMissionBoardStation(station = {}) {
  const source = station && typeof station === "object" && !Array.isArray(station) ? station : {};
  return {
    stationKey: sanitizeText(source.stationKey),
    stationName: sanitizeText(source.stationName) || "Travel Station",
    assignedActorName: sanitizeText(source.assignedActorName) || "Unassigned",
    promptText: sanitizeText(source.promptText),
    hasPromptText: sanitizeBoolean(source.hasPromptText),
    approachOptions: sanitizeApproachOptions(source.approachOptions),
    hasApproachOptions: sanitizeBoolean(source.hasApproachOptions) || sanitizeApproachOptions(source.approachOptions).length > 0,
    hasSelectedApproach: sanitizeBoolean(source.hasSelectedApproach),
    selectedApproachValue: sanitizeText(source.selectedApproachValue),
    selectedApproachLabel: sanitizeText(source.selectedApproachLabel),
    selectedApproachHelpText: sanitizeText(source.selectedApproachHelpText),
    selectedApproachSkillLabel: sanitizeText(source.selectedApproachSkillLabel),
    selectedApproachStatisticLabel: sanitizeText(source.selectedApproachStatisticLabel),
    selectedApproachModifier: Number.isFinite(Number(source.selectedApproachModifier)) ? Number(source.selectedApproachModifier) : null,
    selectedApproachModifierLabel: sanitizeText(source.selectedApproachModifierLabel),
    selectedApproachRollLabel: sanitizeText(source.selectedApproachRollLabel),
    hasSelectedApproachHelpText: sanitizeBoolean(source.hasSelectedApproachHelpText),
    dcLabel: sanitizeText(source.dcLabel),
    resultLabel: sanitizeText(source.resultLabel) || "Unrecorded",
    resultFeedbackText: sanitizeText(source.resultFeedbackText),
    hasResultFeedback: sanitizeBoolean(source.hasResultFeedback),
    hasResult: sanitizeBoolean(source.hasResult),
    result: sanitizeText(source.result),
    isRolling: sanitizeBoolean(source.isRolling),
    rollDetailText: sanitizeText(source.rollDetailText),
    stateLabel: sanitizeText(source.stateLabel) || "Waiting for player",
    statusKey: sanitizeText(source.statusKey) || "waiting",
    partyRowClass: sanitizeText(source.partyRowClass) || "arcflight-party-row--waiting",
    stationConsoleLabel: sanitizeText(source.stationConsoleLabel),
    isCurrentUserRollable: sanitizeBoolean(source.isCurrentUserRollable),
    disabledReason: sanitizeText(source.disabledReason),
    npcControllerUserId: sanitizeText(source.npcControllerUserId),
    npcControllerName: sanitizeText(source.npcControllerName),
    permittedUserIds: Array.isArray(source.permittedUserIds) ? source.permittedUserIds.filter((id) => typeof id === "string") : [],
    canChooseApproach: sanitizeBoolean(source.canChooseApproach),
    selectedStationOrder: sanitizeText(source.selectedStationOrder) || "eventApproach",
    selectedStationOrderLabel: sanitizeText(source.selectedStationOrderLabel) || "Advance the Mission",
    stationOrderCommitted: sanitizeBoolean(source.stationOrderCommitted),
    isStabilize: sanitizeBoolean(source.isStabilize),
    stabilizePressureKey: sanitizeText(source.stabilizePressureKey),
    stabilizePressureLabel: sanitizeText(source.stabilizePressureLabel),
    focusCapacity: Math.max(0, sanitizeInteger(source.focusCapacity, 0)),
    focusRemaining: Math.max(0, sanitizeInteger(source.focusRemaining, 0)),
    focusOptions: sanitizeFocusOptions(source.focusOptions),
    hasFocusOptions: sanitizeFocusOptions(source.focusOptions).length > 0,
    selectedFocusAbility: sanitizeText(source.selectedFocusAbility),
    noFocusRemaining: sanitizeBoolean(source.noFocusRemaining),
    canSpendFocus: sanitizeBoolean(source.canSpendFocus),
    focusBlocked: sanitizeBoolean(source.focusBlocked),
    focusBlockedReason: sanitizeText(source.focusBlockedReason),
    focusBlockedHazardName: sanitizeText(source.focusBlockedHazardName),
    rollUnavailableReason: sanitizeText(source.rollUnavailableReason),
    canRollStation: sanitizeBoolean(source.canRollStation),
    permissionReason: sanitizeText(source.permissionReason) || "Not assigned to your actor."
  };
}

function sanitizeTravelPlayerMissionBoardState(state = {}) {
  const source = state && typeof state === "object" && !Array.isArray(state) ? state : {};
  const userId = globalThis.game?.user?.id ?? "";
  const stations = (Array.isArray(source.stations) ? source.stations : []).map((station) => {
    const safe = sanitizeMissionBoardStation(station);
    const allowed = Boolean(userId && safe.permittedUserIds.includes(userId));
    const localApproach = safe.approachOptions.find((approach) => approach.value === safe.selectedApproachValue) ?? null;
    const hasLocalOrSubmittedApproach = safe.hasSelectedApproach || Boolean(localApproach);
    const localRollReady = localApproach ? Number.isFinite(localApproach.modifier) && Number.isFinite(localApproach.dc) : safe.canRollStation;
    const localRollReason = localApproach
      ? (!Number.isFinite(localApproach.modifier) ? `Cannot roll: ${localApproach.modifierLabel || `${localApproach.skillLabel || localApproach.skill} was not found on ${safe.assignedActorName}`}.` : (!Number.isFinite(localApproach.dc) ? "Cannot roll: DC unavailable." : ""))
      : "Choose an approach first.";
    const canChooseApproach = allowed && !safe.hasSelectedApproach && safe.hasApproachOptions && !safe.isRolling;
    const canRollStation = allowed && hasLocalOrSubmittedApproach && !safe.hasResult && !safe.isRolling && localRollReady;
    const stateLabel = safe.stateLabel && safe.stateLabel !== "Waiting for player" ? safe.stateLabel : (safe.isRolling ? "Rolling" : (safe.hasResult ? "Rolled / Waiting on GM" : (hasLocalOrSubmittedApproach ? (canRollStation ? "Ready to Roll" : "Waiting on GM") : (canChooseApproach ? "Choosing" : "Waiting"))));
    const statusKey = safe.statusKey || (safe.hasResult ? "rolled" : (hasLocalOrSubmittedApproach ? "ready" : "choosing"));
    const disabledReason = canRollStation || canChooseApproach ? "" : (safe.isRolling ? "Dice are rolling for this station." : (allowed ? (safe.hasResult ? "This station has already been rolled." : (safe.rollUnavailableReason || localRollReason)) : safe.permissionReason));
    return {
      ...safe,
      canChooseApproach,
      canRollStation,
      isCurrentUserRollable: canRollStation || canChooseApproach,
      stateLabel,
      statusKey,
      partyRowClass: safe.partyRowClass || `arcflight-party-row--${statusKey}`,
      stationConsoleLabel: safe.stationConsoleLabel || `${safe.stationName} — ${stateLabel}`,
      disabledReason,
      permissionReason: disabledReason || (canRollStation ? "Ready to roll." : "Choose an approach before rolling.")
    };
  });
  return {
    hasSession: sanitizeBoolean(source.hasSession),
    sessionKey: sanitizeText(source.sessionKey),
    eventName: sanitizeText(source.eventName) || "Travel Mission",
    roundLabel: sanitizeText(source.roundLabel),
    roundTitle: sanitizeText(source.roundTitle),
    currentRoundIndex: sanitizeInteger(source.currentRoundIndex, -1),
    currentPhaseLabel: sanitizeText(source.currentPhaseLabel) || "Travel Round",
    shipName: sanitizeText(source.shipName) || "Unknown Ship",
    voyageStatus: sanitizeText(source.voyageStatus) || "In Progress",
    vignette: sanitizeText(source.vignette),
    stations,
    hasStations: stations.length > 0,
    pressureGauges: sanitizePressureGauges(source.pressureGauges),
    hasPressureGauges: sanitizePressureGauges(source.pressureGauges).length > 0,
    publicHazards: sanitizePublicHazards(source.publicHazards),
    hasPublicHazards: sanitizeBoolean(source.hasPublicHazards) || sanitizePublicHazards(source.publicHazards).length > 0,
    publicShipScars: sanitizePublicShipScars(source.publicShipScars),
    hasPublicShipScars: sanitizeBoolean(source.hasPublicShipScars) || sanitizePublicShipScars(source.publicShipScars).length > 0,
    partyAlerts: sanitizePartyAlerts(source.partyAlerts),
    hasPartyAlerts: sanitizeBoolean(source.hasPartyAlerts) || sanitizePartyAlerts(source.partyAlerts).length > 0,
    hudMode: sanitizeText(source.hudMode) || "expanded",
    isCompactHud: sanitizeText(source.hudMode) === "compact"
  };
}

function getPermittedUsersForStation(session, stationKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session);
  const assignment = normalized.session?.stationAssignments?.[stationKey] ?? null;
  const controller = normalized.session?.npcStationControllers?.[stationKey] ?? null;
  if (assignment?.actorType === "npc" && controller?.userId) return getActiveNonGmUsers().filter((user) => user.id === controller.userId);
  const actor = getActorByStationAssignment(session, stationKey, options);
  if (!actor) return [];
  const observerThreshold = getObserverThreshold();
  return getActiveNonGmUsers().filter((user) => getOwnershipLevel(actor, user.id) >= observerThreshold);
}

export function prepareTravelPlayerMissionBoardStateForPlayers(session = null, options = {}) {
  const base = prepareTravelPlayerMissionBoardState(session, options);
  return sanitizeTravelPlayerMissionBoardState({
    ...base,
    stations: (base.stations ?? []).map((station) => {
      const permittedUsers = getPermittedUsersForStation(session, station.stationKey, options);
      return {
        ...station,
        permittedUserIds: permittedUsers.map((user) => user.id),
        permissionReason: permittedUsers.length ? "Waiting for assigned player." : "No active player observer is assigned.",
        npcControllerUserId: session?.npcStationControllers?.[station.stationKey]?.userId ?? "",
        npcControllerName: session?.npcStationControllers?.[station.stationKey]?.userName ?? ""
      };
    })
  });
}

function getMissionBoardRecipients() {
  const users = getActiveNonGmUsers();
  return { users, targetUserIds: users.map((user) => user.id) };
}

function emitTravelPlayerMissionBoard(state, targetUserIds, action = TRAVEL_PLAYER_MISSION_BOARD_SOCKET_ACTION) {
  const socket = globalThis.game?.socket;
  if (!socket || typeof socket.emit !== "function") return { ok: false, errors: ["Foundry socket is not available."], targetUserIds, state };
  const payload = { action, state: sanitizeTravelPlayerMissionBoardState(state), targetUserIds: Array.isArray(targetUserIds) ? targetUserIds.filter(Boolean) : [] };
  socket.emit("module.arcflight", payload);
  return { ok: true, errors: [], payload, targetUserIds: payload.targetUserIds, state: payload.state };
}

export function sendTravelPlayerMissionBoardToPlayers(session, options = {}) {
  const { users, targetUserIds } = getMissionBoardRecipients();
  if (targetUserIds.length === 0) return { ok: false, errors: ["No active non-GM users found."], sentRecipients: 0, users, targetUserIds };
  const state = prepareTravelPlayerMissionBoardStateForPlayers(session, options);
  const emitted = emitTravelPlayerMissionBoard(state, targetUserIds, options.refresh === true ? TRAVEL_PLAYER_MISSION_BOARD_REFRESH_ACTION : TRAVEL_PLAYER_MISSION_BOARD_SOCKET_ACTION);
  return { ...emitted, sentRecipients: emitted.ok ? targetUserIds.length : 0, users };
}

export function queueTravelPlayerMissionBoardRefreshToPlayers(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  const sessionKey = normalized.session?.key || "active-travel-mission-board";
  const delayMs = Number.isFinite(Number(options.delayMs)) ? Math.max(0, Number(options.delayMs)) : 75;
  const existing = missionBoardRefreshTimers.get(sessionKey);
  if (existing) globalThis.clearTimeout?.(existing.timerId);
  const timerId = globalThis.setTimeout?.(() => {
    missionBoardRefreshTimers.delete(sessionKey);
    const result = sendTravelPlayerMissionBoardToPlayers(normalized.session, { ...options, refresh: true, debounce: false });
    console.debug("Arcflight | Debounced mission board refresh broadcast result.", result);
  }, delayMs);
  if (!timerId) return sendTravelPlayerMissionBoardToPlayers(normalized.session, { ...options, refresh: true });
  missionBoardRefreshTimers.set(sessionKey, { timerId, session: normalized.session, options: { ...options } });
  return { ok: true, scheduled: true, errors: [], warnings: [], sentRecipients: 0, sessionKey, delayMs };
}

export function sendTravelPlayerMissionBoardStationUpdateToPlayers(session, stationKey, options = {}) {
  const { users, targetUserIds } = getMissionBoardRecipients();
  if (targetUserIds.length === 0) return { ok: false, errors: ["No active non-GM users found."], sentRecipients: 0, users, targetUserIds, stationKey };
  const state = prepareTravelPlayerMissionBoardStateForPlayers(session, options);
  const station = (state.stations ?? []).find((candidate) => candidate.stationKey === stationKey) ?? null;
  if (!station) return { ok: false, errors: [`Station "${stationKey}" is not on the player mission board.`], sentRecipients: 0, users, targetUserIds, stationKey };
  const socket = globalThis.game?.socket;
  if (!socket || typeof socket.emit !== "function") return { ok: false, errors: ["Foundry socket is not available."], sentRecipients: 0, users, targetUserIds, stationKey };
  const payload = { action: TRAVEL_PLAYER_MISSION_BOARD_STATION_UPDATE_ACTION, sessionKey: state.sessionKey, currentRoundIndex: state.currentRoundIndex, station, targetUserIds };
  socket.emit("module.arcflight", payload);
  return { ok: true, errors: [], payload, sentRecipients: targetUserIds.length, users, targetUserIds, stationKey };
}

function missionBoardInstanceKey(state = {}) {
  const safe = sanitizeTravelPlayerMissionBoardState(state);
  return safe.sessionKey || "travel-player-mission-board";
}

export class ArcflightTravelPlayerMissionBoard extends HandlebarsApplicationMixin(ApplicationV2) {
  #boundMissionBoardClick = this.#onMissionBoardClick.bind(this);
  #boundMissionBoardChange = this.#onMissionBoardChange.bind(this);

  constructor(options = {}) {
    super(options);
    this.boardState = sanitizeTravelPlayerMissionBoardState(options.state ?? {});
    this.instanceKey = missionBoardInstanceKey(this.boardState);
  }

  static DEFAULT_OPTIONS = {
    id: "arcflight-travel-player-mission-board",
    classes: ["arcflight", "arcflight-travel-player-mission-board"],
    position: { width: 1280, height: 900 },
    window: { title: "Arcflight Party Travel HUD", resizable: true }
  };

  static PARTS = {
    board: { template: arcflightTemplatePath("apps/travel-player-mission-board.hbs") }
  };

  #captureScrollState() {
    const root = this.element?.querySelector?.(".arcflight-travel-player-mission-board__shell") ?? this.element;
    return { windowY: globalThis.window?.scrollY ?? 0, rootTop: root?.scrollTop ?? 0 };
  }

  #restoreScrollState(scrollState = null) {
    if (!scrollState) return;
    const root = this.element?.querySelector?.(".arcflight-travel-player-mission-board__shell") ?? this.element;
    if (root && Number.isFinite(scrollState.rootTop)) root.scrollTop = scrollState.rootTop;
    if (globalThis.window?.scrollTo && Number.isFinite(scrollState.windowY)) globalThis.window.scrollTo({ top: scrollState.windowY, behavior: "instant" });
  }

  async #renderPreservingScroll(force = true) {
    const scrollState = this.#captureScrollState();
    await this.render(force);
    (globalThis.requestAnimationFrame ?? ((callback) => setTimeout(callback, 0)))(() => this.#restoreScrollState(scrollState));
    return this;
  }

  async setContext({ state = this.boardState } = {}, { render = true } = {}) {
    const previousKey = this.instanceKey;
    this.boardState = sanitizeTravelPlayerMissionBoardState(state ?? {});
    this.instanceKey = missionBoardInstanceKey(this.boardState);
    if (previousKey !== this.instanceKey && activeTravelPlayerMissionBoards.get(previousKey) === this) activeTravelPlayerMissionBoards.delete(previousKey);
    activeTravelPlayerMissionBoards.set(this.instanceKey, this);
    if (render) await this.#renderPreservingScroll(true);
    return this;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return { ...context, state: this.boardState };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element?.removeEventListener("click", this.#boundMissionBoardClick);
    this.element?.addEventListener("click", this.#boundMissionBoardClick);
    this.element?.removeEventListener("change", this.#boundMissionBoardChange);
    this.element?.addEventListener("change", this.#boundMissionBoardChange);
  }

  async #onMissionBoardChange(event) {
    const approachSelect = event.target?.closest?.("[data-arcflight-mission-board-approach]");
    if (approachSelect && this.element?.contains(approachSelect)) {
      return this.#setLocalStationApproach(approachSelect.dataset.stationKey ?? "", approachSelect.value ?? "");
    }
    const focusSelect = event.target?.closest?.("[data-arcflight-mission-board-focus]");
    if (focusSelect && this.element?.contains(focusSelect)) {
      this.boardState = sanitizeTravelPlayerMissionBoardState({
        ...this.boardState,
        stations: this.boardState.stations.map((station) => station.stationKey === (focusSelect.dataset.stationKey ?? "") ? {
          ...station,
          selectedFocusAbility: focusSelect.value ?? ""
        } : station)
      });
    }
  }

  async #onMissionBoardClick(event) {
    const submit = event.target?.closest?.("[data-arcflight-mission-board-commit-order]");
    const roll = event.target?.closest?.("[data-arcflight-mission-board-roll]");
    const openStation = event.target?.closest?.("[data-arcflight-party-hud-open-station]");
    const toggleHud = event.target?.closest?.("[data-arcflight-party-hud-toggle]");
    const reviewSection = event.target?.closest?.("[data-arcflight-party-hud-review-section]");
    const target = submit ?? roll ?? openStation ?? toggleHud ?? reviewSection;
    if (!target || !this.element?.contains(target) || target.disabled === true) return;
    event.preventDefault();
    const stationKey = target.dataset.stationKey ?? "";
    if (reviewSection) return this.#scrollToHudSection(reviewSection.dataset.arcflightPartyHudReviewSection ?? "");
    if (toggleHud) return this.#toggleHudMode();
    if (submit) return this.#submitApproach(stationKey);
    if (openStation) return this.#openStationCard(stationKey);
    return this.#rollStation(stationKey);
  }

  #scrollToHudSection(sectionKey = "") {
    const selectors = { hazards: "#arcflight-party-hud-hazards", "ship-status": "#arcflight-party-hud-ship-status" };
    const section = this.element?.querySelector?.(selectors[sectionKey] ?? selectors["ship-status"]);
    if (!section) {
      ui.notifications?.warn?.("That travel HUD section is not currently available.");
      return false;
    }
    section.scrollIntoView?.({ behavior: "smooth", block: "start" });
    section.focus?.({ preventScroll: true });
    return true;
  }

  async #toggleHudMode() {
    this.boardState = sanitizeTravelPlayerMissionBoardState({ ...this.boardState, hudMode: this.boardState.isCompactHud ? "expanded" : "compact" });
    return this.render(true);
  }

  async #openStationCard(stationKey) {
    const station = this.#getStation(stationKey) ?? this.boardState.stations.find((entry) => entry.isCurrentUserRollable) ?? null;
    if (!station) return ui.notifications?.warn?.("No station card is currently available for you.");
    return openTravelPlayerStationCard({
      state: {
        hasSession: this.boardState.hasSession,
        sessionKey: this.boardState.sessionKey,
        roundLabel: this.boardState.roundLabel,
        roundTitle: this.boardState.roundTitle,
        stationKey: station.stationKey,
        stationName: station.stationName,
        assignedActorName: station.assignedActorName,
        promptText: station.promptText,
        hasPromptText: station.hasPromptText,
        selectedApproachLabel: station.selectedApproachLabel,
        selectedApproachHelpText: station.selectedApproachHelpText,
        selectedApproachRollLabel: station.selectedApproachRollLabel,
        hasSelectedApproach: station.hasSelectedApproach,
        hasSelectedApproachHelpText: station.hasSelectedApproachHelpText,
        resultStatusLabel: station.stateLabel,
        resultLabel: station.resultLabel,
        resultFeedbackText: station.resultFeedbackText,
        hasResultFeedback: station.hasResultFeedback,
        waitingStateText: station.stateLabel,
        isResolved: station.hasResult,
        statusKey: station.hasResult ? "resolved" : "waitingOnGm",
        approachOptions: station.approachOptions,
        hasApproachOptions: station.hasApproachOptions,
        selectedApproachValue: station.selectedApproachValue,
        selectedStationOrder: station.selectedStationOrder,
        selectedStationOrderLabel: station.selectedStationOrderLabel,
        stationOrderCommitted: station.stationOrderCommitted,
        isStabilize: station.isStabilize,
        stabilizePressureKey: station.stabilizePressureKey,
        stabilizePressureLabel: station.stabilizePressureLabel,
        focusCapacity: station.focusCapacity,
        focusRemaining: station.focusRemaining,
        focusOptions: station.focusOptions,
        hasFocusOptions: station.hasFocusOptions,
        currentRoundIndex: this.boardState.currentRoundIndex,
        hasPublicHazards: this.boardState.hasPublicHazards,
        publicHazards: this.boardState.publicHazards,
        hasPublicShipScars: this.boardState.hasPublicShipScars,
        publicShipScars: this.boardState.publicShipScars
      }
    });
  }

  #getStation(stationKey) {
    return this.boardState.stations.find((station) => station.stationKey === stationKey) ?? null;
  }

  #setLocalStationApproach(stationKey, optionKey) {
    const scrollState = this.#captureScrollState();
    this.boardState = sanitizeTravelPlayerMissionBoardState({
      ...this.boardState,
      stations: this.boardState.stations.map((station) => {
        if (station.stationKey !== stationKey) return station;
        const approach = station.approachOptions.find((entry) => entry.value === optionKey) ?? null;
        return {
          ...station,
          approachOptions: station.approachOptions.map((entry) => ({ ...entry, selected: entry.value === optionKey })),
          selectedApproachValue: optionKey,
          selectedApproachLabel: approach?.label || station.selectedApproachLabel,
          selectedApproachHelpText: approach?.helpText || station.selectedApproachHelpText,
          selectedApproachSkillLabel: approach?.skillLabel || station.selectedApproachSkillLabel,
          selectedApproachStatisticLabel: approach?.statisticLabel || station.selectedApproachStatisticLabel,
          selectedApproachRollLabel: `${approach?.statisticLabel || station.selectedApproachStatisticLabel || "Statistic unavailable"} vs ${approach?.dcLabel || station.dcLabel || "DC unavailable"}`,
          selectedApproachModifier: Number.isFinite(approach?.modifier) ? approach.modifier : station.selectedApproachModifier,
          selectedApproachModifierLabel: approach?.modifierLabel || station.selectedApproachModifierLabel,
          dcLabel: approach?.dcLabel || station.dcLabel,
          dc: Number.isFinite(approach?.dc) ? approach.dc : station.dc,
          selectedStationOrder: approach?.actionType || "eventApproach",
          selectedStationOrderLabel: approach?.actionType === "stabilize" ? "Stabilize" : "Push Forward",
          isStabilize: approach?.actionType === "stabilize",
          stabilizePressureKey: approach?.stabilizePressureKey || "",
          stabilizePressureLabel: approach?.pressureLabel || "",
          rollUnavailableReason: approach && !Number.isFinite(approach.modifier) ? `Cannot roll: ${approach.modifierLabel || `${approach.skillLabel || approach.skill} was not found on ${station.assignedActorName}`}.` : (approach && !Number.isFinite(approach.dc) ? "Cannot roll: DC unavailable." : "")
        };
      })
    });
    return this.#renderPreservingScroll(true).then(() => this.#restoreScrollState(scrollState));
  }

  async #submitApproach(stationKey) {
    const station = this.#getStation(stationKey);
    const select = this.element?.querySelector?.(`[data-arcflight-mission-board-approach][data-station-key="${stationKey}"]`);
    const optionKey = sanitizeText(select?.value || station?.selectedApproachValue);
    if (!station?.canChooseApproach || !optionKey) return ui.notifications?.warn?.(station?.permissionReason || "You cannot choose this station option.");
    console.debug("Arcflight | Player Station Order commit.", { sessionKey: this.boardState.sessionKey, stationKey, roundIndex: this.boardState.currentRoundIndex, optionKey, userId: globalThis.game?.user?.id ?? "" });
    globalThis.game?.socket?.emit?.("module.arcflight", { action: TRAVEL_PLAYER_STATION_APPROACH_SUBMIT_ACTION, sessionKey: this.boardState.sessionKey, stationKey, roundIndex: this.boardState.currentRoundIndex, optionKey, selectedFocusAbility: station.selectedFocusAbility || "", userId: globalThis.game?.user?.id ?? "" });
    const approach = station.approachOptions.find((entry) => entry.value === optionKey) ?? null;
    if (approach) {
      await this.#setLocalStationApproach(stationKey, optionKey);
      this.boardState = sanitizeTravelPlayerMissionBoardState({
        ...this.boardState,
        stations: this.boardState.stations.map((entry) => entry.stationKey === stationKey ? {
          ...entry,
          hasSelectedApproach: true,
          selectedApproachLabel: approach.label || approach.skillLabel || approach.skill,
          selectedApproachHelpText: approach.helpText || "",
          hasSelectedApproachHelpText: Boolean(approach.helpText),
          selectedStationOrder: approach.actionType,
          selectedStationOrderLabel: approach.actionType === "stabilize" ? "Stabilize" : "Push Forward",
          stationOrderCommitted: true,
          isStabilize: approach.actionType === "stabilize",
          stateLabel: "Action selected",
          disabledReason: entry.canRollStation ? "" : entry.disabledReason
        } : entry)
      });
      await this.#renderPreservingScroll(true);
    }
    ui.notifications?.info?.("Action selection sent to the GM.");
    return true;
  }

  updateStationState(station = {}, { render = true } = {}) {
    const safe = sanitizeMissionBoardStation(station);
    this.boardState = sanitizeTravelPlayerMissionBoardState({
      ...this.boardState,
      stations: this.boardState.stations.map((entry) => entry.stationKey === safe.stationKey ? { ...entry, ...safe } : entry)
    });
    if (render) return this.#renderPreservingScroll(true);
    return this;
  }

  #markStationRolling(stationKey) {
    const station = this.#getStation(stationKey);
    if (!station) return;
    this.updateStationState({ ...station, isRolling: true, stateLabel: "Rolling...", canRollStation: false, disabledReason: "Dice are rolling for this station." }, { render: false });
    const card = this.element?.querySelector?.(`[data-arcflight-mission-board-station][data-station-key="${stationKey}"]`);
    card?.classList?.add?.("arcflight-travel-player-mission-board__station--rolling");
    const stateNode = card?.querySelector?.("[data-arcflight-mission-board-state]");
    if (stateNode) stateNode.textContent = "Rolling...";
    const rollButton = card?.querySelector?.("[data-arcflight-mission-board-roll]");
    if (rollButton) {
      rollButton.disabled = true;
      rollButton.title = "Dice are rolling for this station.";
    }
  }

  async #rollStation(stationKey) {
    const station = this.#getStation(stationKey);
    if (!station?.canRollStation) return ui.notifications?.warn?.(station?.permissionReason || "You cannot roll this station.");
    this.#markStationRolling(stationKey);
    const select = this.element?.querySelector?.(`[data-arcflight-mission-board-approach][data-station-key="${stationKey}"]`);
    const optionKey = sanitizeText(select?.value || station.selectedApproachValue);
    const skill = station.approachOptions.find((entry) => entry.value === optionKey)?.skill || station.selectedApproachSkillLabel || "";
    console.debug("Arcflight | Player roll request.", { sessionKey: this.boardState.sessionKey, stationKey, roundIndex: this.boardState.currentRoundIndex, skill, userId: globalThis.game?.user?.id ?? "" });
    debugTravelReaction("Player station roll request emitted.", { sessionKey: this.boardState.sessionKey, stationKey, roundIndex: this.boardState.currentRoundIndex, skill, userId: globalThis.game?.user?.id ?? "" });
    globalThis.game?.socket?.emit?.("module.arcflight", { action: TRAVEL_PLAYER_STATION_ROLL_ACTION, sessionKey: this.boardState.sessionKey, stationKey, roundIndex: this.boardState.currentRoundIndex, skill, userId: globalThis.game?.user?.id ?? "" });
    ui.notifications?.info?.("Station roll requested.");
    return true;
  }

  async close(options = {}) {
    if (activeTravelPlayerMissionBoards.get(this.instanceKey) === this) activeTravelPlayerMissionBoards.delete(this.instanceKey);
    return super.close(options);
  }
}

export async function openTravelPlayerMissionBoard(options = {}) {
  const appOptions = options && typeof options === "object" ? options : {};
  const key = missionBoardInstanceKey(appOptions.state ?? {});
  const app = activeTravelPlayerMissionBoards.get(key) ?? new ArcflightTravelPlayerMissionBoard(appOptions);
  activeTravelPlayerMissionBoards.set(key, app);
  await app.setContext(appOptions, { render: true });
  bringCardToFront(app);
  return app;
}

export function registerTravelPlayerStationRollHandler(handler) {
  travelPlayerStationRollHandler = typeof handler === "function" ? handler : null;
}

export function registerTravelPlayerReactionResponseHandler(handler) {
  travelPlayerReactionResponseHandler = typeof handler === "function" ? handler : null;
}
