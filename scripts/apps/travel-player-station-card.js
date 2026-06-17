import { arcflightTemplatePath } from "../sheets/sheet-helpers.js";
import { normalizeTravelEventRunnerSession, prepareTravelPlayerMissionBoardState, prepareTravelPlayerStationCardState } from "../helpers/travel-event-runner.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const activeTravelPlayerStationCards = new Map();
const TRAVEL_PLAYER_STATION_CARD_SOCKET_ACTION = "openTravelPlayerStationCard";
const TRAVEL_PLAYER_STATION_CARD_SOCKET_TEST_ACTION = "arcflightSocketDiagnostic";
const TRAVEL_PLAYER_STATION_APPROACH_SUBMIT_ACTION = "submitTravelPlayerStationApproach";
const TRAVEL_PLAYER_MISSION_BOARD_SOCKET_ACTION = "openTravelPlayerMissionBoard";
const TRAVEL_PLAYER_MISSION_BOARD_REFRESH_ACTION = "refreshTravelPlayerMissionBoard";
const TRAVEL_PLAYER_MISSION_BOARD_STATION_UPDATE_ACTION = "updateTravelPlayerMissionBoardStation";
const TRAVEL_PLAYER_STATION_ROLL_ACTION = "rollTravelPlayerStation";

let travelPlayerStationApproachSubmitHandler = null;
let travelPlayerStationRollHandler = null;
const missionBoardRefreshTimers = new Map();

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
      skillLabel: sanitizeText(entry.skillLabel),
      statisticLabel: sanitizeText(entry.statisticLabel),
      modifier: Number.isFinite(Number(entry.modifier)) ? Number(entry.modifier) : null,
      modifierLabel: sanitizeText(entry.modifierLabel),
      label: sanitizeText(entry.label),
      displayLabel: sanitizeText(entry.displayLabel),
      helpText: sanitizeText(entry.helpText),
      dc: Number.isFinite(Number(entry.dc)) ? Number(entry.dc) : null,
      dcLabel: sanitizeText(entry.dcLabel),
      selected: sanitizeBoolean(entry.selected)
    }))
    .filter((entry) => entry.skill || entry.label || entry.helpText);
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
    statusKey: sanitizeText(source.statusKey) || "waitingForGmRoll",
    approachOptions: sanitizeApproachOptions(source.approachOptions),
    hasApproachOptions: sanitizeBoolean(source.hasApproachOptions) || sanitizeApproachOptions(source.approachOptions).length > 0,
    selectedApproachValue: sanitizeText(source.selectedApproachValue),
    currentRoundIndex: sanitizeInteger(source.currentRoundIndex, -1)
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

export class ArcflightTravelPlayerStationCard extends HandlebarsApplicationMixin(ApplicationV2) {
  #boundPlayerCardClick = this.#onPlayerCardClick.bind(this);

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
  }

  async #onPlayerCardClick(event) {
    const target = event.target?.closest?.("[data-arcflight-player-card-submit-approach]");
    if (!target || !this.element?.contains(target) || target.disabled === true) return;
    event.preventDefault();
    return this.#submitApproachChoice();
  }

  async #submitApproachChoice() {
    const select = this.element?.querySelector?.("[data-arcflight-player-card-approach]");
    const skill = sanitizeText(select?.value);
    if (!skill) {
      ui.notifications?.warn?.("Choose an approach before submitting.");
      return false;
    }
    if (!this.playerCardState) {
      ui.notifications?.warn?.("This player card cannot submit an approach without socket state.");
      return false;
    }
    globalThis.game?.socket?.emit?.("module.arcflight", {
      action: TRAVEL_PLAYER_STATION_APPROACH_SUBMIT_ACTION,
      sessionKey: this.playerCardState.sessionKey,
      stationKey: this.playerCardState.stationKey,
      roundIndex: this.playerCardState.currentRoundIndex,
      skill,
      userId: globalThis.game?.user?.id ?? ""
    });
    const selectedApproach = this.playerCardState.approachOptions.find((entry) => entry.skill === skill) ?? null;
    this.playerCardState = {
      ...this.playerCardState,
      selectedApproachValue: skill,
      selectedApproachLabel: selectedApproach?.label || skill,
      selectedApproachHelpText: selectedApproach?.helpText || "",
      selectedApproachRollLabel: selectedApproach ? `${selectedApproach.label || selectedApproach.skillLabel || skill}: ${selectedApproach.statisticLabel || "Statistic unavailable"} vs ${selectedApproach.dcLabel || "DC unavailable"}` : "",
      hasSelectedApproachHelpText: Boolean(selectedApproach?.helpText),
      hasSelectedApproach: true,
      resultStatusLabel: "Approach submitted",
      waitingStateText: "Approach submitted. Waiting for GM roll.",
      statusKey: "waitingForGmRoll"
    };
    ui.notifications?.info?.("Approach submitted to the GM.");
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
    isCurrentUserRollable: sanitizeBoolean(source.isCurrentUserRollable),
    disabledReason: sanitizeText(source.disabledReason),
    npcControllerUserId: sanitizeText(source.npcControllerUserId),
    npcControllerName: sanitizeText(source.npcControllerName),
    permittedUserIds: Array.isArray(source.permittedUserIds) ? source.permittedUserIds.filter((id) => typeof id === "string") : [],
    canChooseApproach: sanitizeBoolean(source.canChooseApproach),
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
    const localApproach = safe.approachOptions.find((approach) => approach.skill === safe.selectedApproachValue) ?? null;
    const hasLocalOrSubmittedApproach = safe.hasSelectedApproach || Boolean(localApproach);
    const localRollReady = localApproach ? Number.isFinite(localApproach.modifier) && Number.isFinite(localApproach.dc) : safe.canRollStation;
    const localRollReason = localApproach
      ? (!Number.isFinite(localApproach.modifier) ? `Cannot roll: ${localApproach.modifierLabel || `${localApproach.skillLabel || localApproach.skill} was not found on ${safe.assignedActorName}`}.` : (!Number.isFinite(localApproach.dc) ? "Cannot roll: DC unavailable." : ""))
      : "Choose an approach first.";
    const canChooseApproach = allowed && !safe.hasSelectedApproach && safe.hasApproachOptions && !safe.isRolling;
    const canRollStation = allowed && hasLocalOrSubmittedApproach && !safe.hasResult && !safe.isRolling && localRollReady;
    const stateLabel = safe.isRolling ? "Rolling..." : (safe.hasResult ? "Resolved" : (hasLocalOrSubmittedApproach ? (canRollStation ? "Ready to roll" : "Waiting for player") : (canChooseApproach ? "Ready to choose" : "Waiting for player")));
    const disabledReason = canRollStation || canChooseApproach ? "" : (safe.isRolling ? "Dice are rolling for this station." : (allowed ? (safe.hasResult ? "This station has already been rolled." : (safe.rollUnavailableReason || localRollReason)) : safe.permissionReason));
    return {
      ...safe,
      canChooseApproach,
      canRollStation,
      isCurrentUserRollable: canRollStation || canChooseApproach,
      stateLabel,
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
    vignette: sanitizeText(source.vignette),
    stations,
    hasStations: stations.length > 0
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
    window: { title: "Travel Mission Board", resizable: true }
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
    const select = event.target?.closest?.("[data-arcflight-mission-board-approach]");
    if (!select || !this.element?.contains(select)) return;
    const stationKey = select.dataset.stationKey ?? "";
    this.#setLocalStationApproach(stationKey, select.value ?? "");
  }

  async #onMissionBoardClick(event) {
    const submit = event.target?.closest?.("[data-arcflight-mission-board-submit-approach]");
    const roll = event.target?.closest?.("[data-arcflight-mission-board-roll]");
    const target = submit ?? roll;
    if (!target || !this.element?.contains(target) || target.disabled === true) return;
    event.preventDefault();
    const stationKey = target.dataset.stationKey ?? "";
    if (submit) return this.#submitApproach(stationKey);
    return this.#rollStation(stationKey);
  }

  #getStation(stationKey) {
    return this.boardState.stations.find((station) => station.stationKey === stationKey) ?? null;
  }

  #setLocalStationApproach(stationKey, skill) {
    const scrollState = this.#captureScrollState();
    this.boardState = sanitizeTravelPlayerMissionBoardState({
      ...this.boardState,
      stations: this.boardState.stations.map((station) => {
        if (station.stationKey !== stationKey) return station;
        const approach = station.approachOptions.find((entry) => entry.skill === skill) ?? null;
        return {
          ...station,
          selectedApproachValue: skill,
          selectedApproachLabel: approach?.label || station.selectedApproachLabel,
          selectedApproachHelpText: approach?.helpText || station.selectedApproachHelpText,
          selectedApproachSkillLabel: approach?.skillLabel || station.selectedApproachSkillLabel,
          selectedApproachStatisticLabel: approach?.statisticLabel || station.selectedApproachStatisticLabel,
          selectedApproachRollLabel: `${approach?.label || station.selectedApproachLabel || "Selected"}: ${approach?.statisticLabel || station.selectedApproachStatisticLabel || "Statistic unavailable"} vs ${approach?.dcLabel || station.dcLabel || "DC unavailable"}`,
          selectedApproachModifier: Number.isFinite(approach?.modifier) ? approach.modifier : station.selectedApproachModifier,
          selectedApproachModifierLabel: approach?.modifierLabel || station.selectedApproachModifierLabel,
          dcLabel: approach?.dcLabel || station.dcLabel,
          dc: Number.isFinite(approach?.dc) ? approach.dc : station.dc,
          rollUnavailableReason: approach && !Number.isFinite(approach.modifier) ? `Cannot roll: ${approach.modifierLabel || `${approach.skillLabel || approach.skill} was not found on ${station.assignedActorName}`}.` : (approach && !Number.isFinite(approach.dc) ? "Cannot roll: DC unavailable." : "")
        };
      })
    });
    return this.#renderPreservingScroll(true).then(() => this.#restoreScrollState(scrollState));
  }

  async #submitApproach(stationKey) {
    const station = this.#getStation(stationKey);
    const select = this.element?.querySelector?.(`[data-arcflight-mission-board-approach][data-station-key="${stationKey}"]`);
    const skill = sanitizeText(select?.value || station?.selectedApproachValue);
    if (!station?.canChooseApproach || !skill) return ui.notifications?.warn?.(station?.permissionReason || "You cannot choose this station approach.");
    console.debug("Arcflight | Player approach submit.", { sessionKey: this.boardState.sessionKey, stationKey, roundIndex: this.boardState.currentRoundIndex, skill, userId: globalThis.game?.user?.id ?? "" });
    globalThis.game?.socket?.emit?.("module.arcflight", { action: TRAVEL_PLAYER_STATION_APPROACH_SUBMIT_ACTION, sessionKey: this.boardState.sessionKey, stationKey, roundIndex: this.boardState.currentRoundIndex, skill, userId: globalThis.game?.user?.id ?? "" });
    const approach = station.approachOptions.find((entry) => entry.skill === skill) ?? null;
    if (approach) {
      await this.#setLocalStationApproach(stationKey, skill);
      this.boardState = sanitizeTravelPlayerMissionBoardState({
        ...this.boardState,
        stations: this.boardState.stations.map((entry) => entry.stationKey === stationKey ? {
          ...entry,
          hasSelectedApproach: true,
          selectedApproachLabel: approach.label || approach.skillLabel || skill,
          selectedApproachHelpText: approach.helpText || "",
          hasSelectedApproachHelpText: Boolean(approach.helpText),
          stateLabel: "Approach submitted",
          disabledReason: entry.canRollStation ? "" : entry.disabledReason
        } : entry)
      });
      await this.#renderPreservingScroll(true);
    }
    ui.notifications?.info?.("Approach submitted to the GM.");
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
    const skill = sanitizeText(select?.value || station.selectedApproachValue);
    console.debug("Arcflight | Player roll request.", { sessionKey: this.boardState.sessionKey, stationKey, roundIndex: this.boardState.currentRoundIndex, skill, userId: globalThis.game?.user?.id ?? "" });
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
