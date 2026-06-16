import { arcflightTemplatePath } from "../sheets/sheet-helpers.js";
import { normalizeTravelEventRunnerSession, prepareTravelPlayerStationCardState } from "../helpers/travel-event-runner.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const activeTravelPlayerStationCards = new Map();
const TRAVEL_PLAYER_STATION_CARD_SOCKET_ACTION = "openTravelPlayerStationCard";

function sanitizeText(value) {
  return typeof value === "string" ? value : "";
}

function sanitizeBoolean(value) {
  return value === true;
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
    hasSelectedApproach: sanitizeBoolean(source.hasSelectedApproach),
    hasSelectedApproachHelpText: sanitizeBoolean(source.hasSelectedApproachHelpText),
    resultStatusLabel: sanitizeText(source.resultStatusLabel) || "Waiting for GM resolution",
    resultLabel: sanitizeText(source.resultLabel),
    resultFeedbackText: sanitizeText(source.resultFeedbackText),
    hasResultFeedback: sanitizeBoolean(source.hasResultFeedback),
    waitingStateText: sanitizeText(source.waitingStateText) || "Waiting for GM resolution",
    isResolved: sanitizeBoolean(source.isResolved),
    statusKey: sanitizeText(source.statusKey) || "waitingForGmRoll"
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

function getOwnerThreshold() {
  return Number(globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3);
}

export function resolveActivePlayerOwnersForStation(session, stationKey, options = {}) {
  const actor = options.assignedActor ?? getActorByStationAssignment(session, stationKey, options);
  if (!actor) return [];
  const ownerThreshold = getOwnerThreshold();
  return getUserCollectionValues()
    .filter((user) => user?.active === true && user?.isGM !== true && typeof user.id === "string" && getOwnershipLevel(actor, user.id) >= ownerThreshold)
    .map((user) => ({ id: user.id, name: user.name ?? user.id }));
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

export function sendTravelPlayerStationCardToPlayers(session, stationKey, options = {}) {
  const state = sanitizeTravelPlayerStationCardState(prepareTravelPlayerStationCardState(session, stationKey, options));
  const owners = resolveActivePlayerOwnersForStation(session, stationKey, options);
  if (owners.length === 0) {
    return { ok: false, errors: ["No active player owner found for this station."], warnings: [], sent: 0, skipped: 1, stationKey, state, targetUserIds: [] };
  }
  const targetUserIds = owners.map((owner) => owner.id);
  const emitted = emitTravelPlayerStationCard(state, targetUserIds);
  return { ...emitted, sent: emitted.ok ? targetUserIds.length : 0, skipped: emitted.ok ? 0 : 1, stationKey, owners };
}

export function sendAllTravelPlayerStationCardsToPlayers(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  const round = normalized.session?.event?.rounds?.[normalized.session?.currentRoundIndex ?? 0] ?? null;
  const stationKeys = Array.isArray(round?.activeStations) ? round.activeStations : [];
  let sent = 0;
  let skipped = 0;
  const results = [];
  for (const stationKey of stationKeys) {
    const result = sendTravelPlayerStationCardToPlayers(normalized.session, stationKey, options);
    results.push(result);
    if (result.ok) sent += 1;
    else skipped += 1;
  }
  return { ok: sent > 0, errors: sent > 0 ? [] : ["No player station cards were sent."], warnings: [], sent, skipped, results };
}

export function handleTravelPlayerStationCardSocketPayload(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  if (payload.action !== TRAVEL_PLAYER_STATION_CARD_SOCKET_ACTION) return false;
  const userId = globalThis.game?.user?.id ?? "";
  const targetUserIds = Array.isArray(payload.targetUserIds) ? payload.targetUserIds : [];
  if (!userId || !targetUserIds.includes(userId)) return true;
  openTravelPlayerStationCard({ state: payload.state });
  return true;
}

export class ArcflightTravelPlayerStationCard extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.session = options.session ?? null;
    this.stationKey = options.stationKey ?? "";
    this.actor = options.actor ?? null;
    this.state = options.state ? sanitizeTravelPlayerStationCardState(options.state) : null;
    this.instanceKey = stationCardInstanceKey({ session: this.session, stationKey: this.stationKey, state: this.state });
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

  async setContext({ session = this.session, stationKey = this.stationKey, actor = this.actor, state = this.state } = {}, { render = true } = {}) {
    const previousKey = this.instanceKey;
    this.state = state ? sanitizeTravelPlayerStationCardState(state) : null;
    this.session = this.state ? null : (session ?? null);
    this.stationKey = this.state ? this.state.stationKey : (stationKey ?? "");
    this.actor = this.state ? null : (actor ?? null);
    this.instanceKey = stationCardInstanceKey({ session: this.session, stationKey: this.stationKey, state: this.state });
    if (previousKey !== this.instanceKey && activeTravelPlayerStationCards.get(previousKey) === this) activeTravelPlayerStationCards.delete(previousKey);
    activeTravelPlayerStationCards.set(this.instanceKey, this);
    if (render) await this.render(true);
    return this;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const state = this.state ?? prepareTravelPlayerStationCardState(this.session, this.stationKey, { actor: this.actor });
    return { ...context, state };
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
