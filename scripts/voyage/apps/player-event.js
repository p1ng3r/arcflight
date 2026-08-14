import { arcflightTemplatePath } from "../../sheets/sheet-helpers.js";
import { stationPresentation } from "./station-icons.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;
const PLAYER_TABS = Object.freeze(["round", "my-station", "crew-plan", "resolution"]);

function randomId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

function normalizePlayerTab(value) {
  return typeof value === "string" && PLAYER_TABS.includes(value) ? value : "round";
}

function stationView(assignment, ownedStationIds, orderIndex) {
  const stationId = assignment?.stationId ?? null;
  const icon = stationPresentation(stationId);
  const operator = assignment?.operator;
  return {
    stationId,
    ...icon,
    operatorName: typeof operator?.name === "string" && operator.name.length > 0 ? operator.name : "Unassigned",
    owned: ownedStationIds.has(stationId),
    orderNumber: orderIndex.has(stationId) ? orderIndex.get(stationId) + 1 : null,
    actionName: null,
    approachName: null,
    riskBidName: null,
    targetName: null,
    stateLabel: "WAITING",
    readOnly: true
  };
}

function roundView(projection) {
  const narrativeAvailable = [projection.roundTitle, projection.vignette, projection.situation, projection.objective, projection.knownStakes]
    .some((entry) => typeof entry === "string" && entry.length > 0);
  return {
    eventTitle: typeof projection.eventTitle === "string" && projection.eventTitle.length > 0 ? projection.eventTitle : projection.eventId ?? "Arcflight Event",
    roundNumber: projection.roundNumber ?? null,
    roundTitle: projection.roundTitle ?? null,
    vignette: projection.vignette ?? null,
    situation: projection.situation ?? null,
    objective: projection.objective ?? null,
    knownStakes: projection.knownStakes ?? null,
    narrativeAvailable,
    phase: projection.phase ?? null,
    sessionState: projection.sessionState ?? null,
    momentum: Number.isFinite(projection.momentum) ? projection.momentum : null,
    hasMomentum: Number.isFinite(projection.momentum),
    pressureSystems: Array.isArray(projection.pressureSystems) ? projection.pressureSystems.map((entry) => ({
      pressureSystemId: entry?.pressureSystemId ?? null,
      value: entry?.value ?? null,
      capacity: entry?.capacity ?? null
    })) : [],
    activeHazards: Array.isArray(projection.activeHazards) ? projection.activeHazards.map((entry) => ({ hazardId: entry?.hazardId ?? null })) : []
  };
}

export function buildVoyagePlayerEventModel(projection) {
  if (!projection || typeof projection !== "object") return null;
  const assignments = Array.isArray(projection.stationAssignments) ? projection.stationAssignments : [];
  const ownedOperators = Array.isArray(projection.ownedOperators) ? projection.ownedOperators : [];
  const ownedStationIds = new Set(ownedOperators.map((entry) => entry?.stationId).filter((entry) => typeof entry === "string"));
  const committedOrder = Array.isArray(projection.committedStationOrder) ? projection.committedStationOrder.filter((entry) => typeof entry === "string") : [];
  const orderIndex = new Map(committedOrder.map((stationId, index) => [stationId, index]));
  const stations = assignments.map((assignment) => stationView(assignment, ownedStationIds, orderIndex));
  const ownedStations = stations.filter((station) => station.owned);
  const role = ["gm", "operator", "crew", "observer"].includes(projection.projectionRole) ? projection.projectionRole : "observer";
  const roleLabel = role === "operator" ? "OPERATOR" : role === "crew" ? "CREW" : role === "gm" ? "GM" : "OBSERVER";
  const currentStationId = typeof projection.currentActingStationId === "string" ? projection.currentActingStationId : null;
  const currentStation = stations.find((station) => station.stationId === currentStationId) ?? null;
  const resolutionComplete = projection.sessionState === "round-closeout" || projection.sessionState === "completed";
  const planLocked = projection.sessionState === "plan-locked" || projection.sessionState === "station-resolution" || projection.phase === "lock-readiness" || projection.phase === "resolution";
  const resolution = resolutionComplete
    ? { stateLabel: "RESOLUTION COMPLETE", detail: "AWAITING ROUND CLOSEOUT", currentStation, ownedCurrent: Boolean(currentStation?.owned), waiting: false }
    : planLocked
      ? { stateLabel: "PLAN LOCKED", detail: "Waiting for the GM to begin Resolution.", currentStation, ownedCurrent: Boolean(currentStation?.owned), waiting: true }
      : { stateLabel: "WAITING FOR RESOLUTION", detail: "Resolution has not begun.", currentStation: null, ownedCurrent: false, waiting: true };
  return {
    schemaVersion: 1,
    sessionId: projection.sessionId,
    revision: projection.revision,
    eventId: projection.eventId,
    projectionRole: role,
    roleLabel,
    round: roundView(projection),
    ownedStations,
    hasOwnedStation: ownedStations.length > 0,
    crewPlan: stations,
    committedOrder,
    resolution,
    activeTab: "round",
    tabs: PLAYER_TABS.map((id) => ({ id, label: id === "my-station" ? "My Station" : id === "crew-plan" ? "Crew Plan" : id === "resolution" ? "Resolution" : "Round", active: id === "round" })),
    readOnly: true
  };
}

export class VoyagePlayerEventApp extends HandlebarsApplicationMixin(ApplicationV2) {
  #sessionId = null;
  #expectedRevision = 0;
  #activeTab = "round";
  #scrollTop = 0;

  static DEFAULT_OPTIONS = {
    id: "arcflight-player-event",
    classes: ["arcflight", "player-event"],
    tag: "section",
    position: { width: 620, height: 560 },
    window: { resizable: true }
  };

  static PARTS = { body: { template: arcflightTemplatePath("voyage/player-event.hbs") } };

  constructor(options = {}) { super(options); }

  _prepareContext() {
    if (!this.#sessionId) {
      const discovered = game.arcflight?.discoverVoyageEventSession?.();
      this.#sessionId = discovered?.sessionId ?? null;
      this.#expectedRevision = discovered?.revision ?? 0;
    }
    let result = null;
    if (this.#sessionId) {
      const request = {
        kind: "voyage.m12-read-multiplayer-projection",
        requestId: randomId("m12-player-read"),
        sessionId: this.#sessionId,
        expectedRevision: this.#expectedRevision
      };
      result = typeof game.arcflight?.readVoyageEventSessionMultiplayerProjection === "function"
        ? game.arcflight.readVoyageEventSessionMultiplayerProjection(request)
        : null;
    }
    const model = result?.ok ? buildVoyagePlayerEventModel(result.projection) : null;
    if (model) {
      model.activeTab = this.#activeTab;
      model.tabs = PLAYER_TABS.map((id) => ({ id, label: id === "my-station" ? "My Station" : id === "crew-plan" ? "Crew Plan" : id === "resolution" ? "Resolution" : "Round", active: id === this.#activeTab }));
      model.showRound = this.#activeTab === "round";
      model.showMyStation = this.#activeTab === "my-station";
      model.showCrewPlan = this.#activeTab === "crew-plan";
      model.showResolution = this.#activeTab === "resolution";
    }
    return {
      model,
      sessionUnavailable: !model,
      errorMessage: result?.errors?.[0]?.message ?? "No active Arcflight Event Session is available.",
      activeTab: this.#activeTab,
      tabs: [...PLAYER_TABS]
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll("[data-player-tab]").forEach((tab) => tab.addEventListener("click", () => {
      const panel = this.element.querySelector(`[data-player-panel=\"${tab.dataset.playerTab}\"]`);
      this.#scrollTop = panel?.scrollTop ?? this.#scrollTop;
      this.#activeTab = normalizePlayerTab(tab.dataset.playerTab);
      this.render();
    }));
    this.element.querySelectorAll("[data-player-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.playerPanel !== this.#activeTab;
      if (panel.dataset.playerPanel === this.#activeTab) panel.scrollTop = this.#scrollTop;
    });
  }
}

export function openVoyagePlayerEvent() {
  const app = new VoyagePlayerEventApp();
  return app.render({ force: true });
}

export { PLAYER_TABS, normalizePlayerTab };
