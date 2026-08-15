import { arcflightTemplatePath } from "../../sheets/sheet-helpers.js";
import { stationPresentation } from "./station-icons.js";
import { resourcePresentation } from "./resource-icons.js";

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

function planningView(option) {
  if (!option || typeof option !== "object") return null;
  const actions = Array.isArray(option.actions) ? option.actions.map((action) => ({
    actionId: action?.actionId ?? null,
    displayName: action?.displayName ?? action?.actionId ?? "Action",
    description: action?.description ?? "",
    selected: action?.selected === true,
    defaultApproachId: action?.approaches?.find((approach) => approach?.approachId)?.approachId ?? null,
    approaches: Array.isArray(action?.approaches) ? action.approaches.map((approach) => ({
      approachId: approach?.approachId ?? null,
      label: approach?.label ?? approach?.approachId ?? "Approach",
      description: approach?.description ?? "",
      selected: approach?.selected === true
    })) : [],
    riskBidCapable: action?.riskBidCapable === true,
    riskBidOptions: Array.isArray(action?.riskBidOptions) ? action.riskBidOptions.map((bid) => ({
      riskBidId: bid?.riskBidId ?? null,
      label: `${bid?.label ?? "Risk Bid"}${bid?.intendedBenefit ? ` — ${bid.intendedBenefit}` : ""}`,
      tierLabel: bid?.label ?? "Risk Bid",
      dcAdjustment: bid?.dcAdjustment ?? null,
      intendedBenefit: bid?.intendedBenefit ?? null,
      target: bid?.target ?? null,
      outcome: bid?.outcome && typeof bid.outcome === "object" ? {
        criticalSuccess: bid.outcome.criticalSuccess ?? null,
        success: bid.outcome.success ?? null,
        failure: bid.outcome.failure ?? null,
        criticalFailure: bid.outcome.criticalFailure ?? null
      } : null,
      resource: resourcePresentation("riskBid", bid?.dcAdjustment),
      selected: bid?.selected === true
    })) : [],
    targetRequired: action?.targetRequired === true,
    eligibleTargets: Array.isArray(action?.eligibleTargets) ? action.eligibleTargets.map((target) => ({ targetId: target?.targetId ?? null, label: target?.label ?? target?.targetId ?? "Target" })) : []
  })) : [];
  return {
    stationId: option.stationId ?? null,
    selectedActionId: option.selectedActionId ?? null,
    selectedApproachId: option.selectedApproachId ?? null,
    selectedRiskBidId: option.selectedRiskBidId ?? null,
    editable: option.editable === true,
    ready: option.ready === true,
    actions,
    selectedAction: actions.find((action) => action.selected) ?? null,
    selectedApproach: actions.flatMap((action) => action.approaches).find((approach) => approach.selected) ?? null,
    selectedRiskBid: actions.flatMap((action) => action.riskBidOptions).find((bid) => bid.selected) ?? null
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
  const planningOptions = new Map((Array.isArray(projection.ownedPlanningOptions) ? projection.ownedPlanningOptions : []).map((entry) => [entry?.stationId, planningView(entry)]));
  const committedOrder = Array.isArray(projection.committedStationOrder) ? projection.committedStationOrder.filter((entry) => typeof entry === "string") : [];
  const assignedOrder = assignments.map((assignment) => assignment?.stationId).filter((entry) => typeof entry === "string");
  const sharedStationOrder = Array.isArray(projection.sharedStationOrder) && projection.sharedStationOrder.length > 0
    ? projection.sharedStationOrder.filter((entry) => typeof entry === "string")
    : (committedOrder.length > 0 ? committedOrder : assignedOrder);
  const orderIndex = new Map(sharedStationOrder.map((stationId, index) => [stationId, index]));
  const byId = new Map(assignments.map((assignment) => [assignment?.stationId, assignment]));
  const orderedAssignments = [...sharedStationOrder.map((stationId) => byId.get(stationId)).filter(Boolean), ...assignments.filter((assignment) => !orderIndex.has(assignment?.stationId))];
  const stations = orderedAssignments.map((assignment) => stationView(assignment, ownedStationIds, orderIndex));
  const planLocked = projection.planLocked === true;
  const canMutateSharedOrder = projection.canMutateSharedOrder === true && !planLocked;
  stations.forEach((station) => {
    station.canMoveUp = canMutateSharedOrder && station.orderNumber > 1;
    station.canMoveDown = canMutateSharedOrder && station.orderNumber !== null && station.orderNumber < sharedStationOrder.length;
  });
  const ownedStations = stations.filter((station) => station.owned).map((station) => {
    const sourcePlanning = planningOptions.get(station.stationId);
    const planning = sourcePlanning && planLocked ? { ...sourcePlanning, editable: false } : sourcePlanning;
    return { ...station, planning, readOnly: planning ? !planning.editable : true, stateLabel: planning?.ready ? "READY" : planning?.editable ? "PLANNING" : station.stateLabel };
  });
  const role = ["gm", "operator", "crew", "observer"].includes(projection.projectionRole) ? projection.projectionRole : "observer";
  const roleLabel = role === "operator" ? "OPERATOR" : role === "crew" ? "CREW" : role === "gm" ? "GM" : "OBSERVER";
  const currentStationId = typeof projection.resolutionCurrentStationId === "string"
    ? projection.resolutionCurrentStationId
    : (typeof projection.currentActingStationId === "string" ? projection.currentActingStationId : null);
  const currentStation = stations.find((station) => station.stationId === currentStationId) ?? null;
  const resolutionComplete = projection.resolutionComplete === true || projection.sessionState === "round-closeout" || projection.sessionState === "completed";
  const resolutionStarted = projection.resolutionStarted === true
    || (projection.sessionState === "station-resolution" && typeof projection.currentActingStationId === "string");
  const projectedResolutionStations = Array.isArray(projection.resolutionStations)
    ? projection.resolutionStations.map((entry) => ({
      stationId: entry?.stationId ?? null,
      stationDisplayName: stationPresentation(entry?.stationId).stationDisplayName,
      orderPosition: entry?.orderPosition ?? null,
      status: entry?.status ?? "waiting",
      current: entry?.current === true,
      operatorName: typeof entry?.operator?.name === "string" ? entry.operator.name : "Unassigned"
    }))
    : stations.map((station, index) => ({ stationId: station.stationId, stationDisplayName: station.stationDisplayName, orderPosition: index + 1, status: "waiting", current: false, operatorName: station.operatorName }));
  const resolution = resolutionComplete
    ? { stateLabel: "RESOLUTION COMPLETE", detail: "AWAITING ROUND CLOSEOUT", currentStation: null, ownedCurrent: false, waiting: false, started: true, order: Array.isArray(projection.resolutionOrder) ? [...projection.resolutionOrder] : [...sharedStationOrder], orderPosition: null, totalStations: projection.resolutionTotalStations ?? projectedResolutionStations.length, stations: projectedResolutionStations, canExecuteCurrentStation: false, currentExecutionState: "complete", currentExecution: null }
    : resolutionStarted
      ? { stateLabel: "RESOLUTION IN PROGRESS", detail: "CURRENT STATION IDENTIFIED — AWAITING STATION EXECUTION", currentStation, ownedCurrent: Boolean(currentStation?.owned), waiting: false, started: true, order: Array.isArray(projection.resolutionOrder) ? [...projection.resolutionOrder] : [...sharedStationOrder], orderPosition: projection.resolutionOrderPosition ?? null, totalStations: projection.resolutionTotalStations ?? projectedResolutionStations.length, stations: projectedResolutionStations, canExecuteCurrentStation: projection.canExecuteCurrentStation === true, currentExecutionState: projection.currentExecutionState ?? "waiting", waitingOnOperator: projection.currentExecutionState === "waiting-on-operator", currentExecution: projection.currentExecution ?? null }
      : planLocked
        ? { stateLabel: "PLAN LOCKED", detail: "Waiting for the GM to begin Resolution.", currentStation: null, ownedCurrent: false, waiting: true, started: false, order: [...sharedStationOrder], orderPosition: null, totalStations: sharedStationOrder.length, stations: projectedResolutionStations, canExecuteCurrentStation: false, currentExecutionState: "not-started", currentExecution: null }
        : { stateLabel: "WAITING FOR RESOLUTION", detail: "Resolution has not begun.", currentStation: null, ownedCurrent: false, waiting: true, started: false, order: [...sharedStationOrder], orderPosition: null, totalStations: sharedStationOrder.length, stations: projectedResolutionStations, canExecuteCurrentStation: false, currentExecutionState: "not-started", currentExecution: null };
  return {
    schemaVersion: 1,
    sessionId: projection.sessionId,
    revision: projection.revision,
    eventId: projection.eventId,
    projectionRole: role,
    roleLabel,
    round: roundView(projection),
    ownedStations,
    ownedPlanningOptions: ownedStations.map((station) => station.planning).filter(Boolean),
    hasOwnedStation: ownedStations.length > 0,
    crewPlan: stations,
    sharedStationOrder,
    planReady: projection.planReady === true,
    planLocked,
    canMutateSharedOrder,
    committedOrder,
    resolution,
    activeTab: "round",
    tabs: PLAYER_TABS.map((id) => ({ id, label: id === "my-station" ? "My Station" : id === "crew-plan" ? "Crew Plan" : id === "resolution" ? "Resolution" : "Round", active: id === "round" })),
    readOnly: role !== "operator" || ownedStations.every((station) => station.readOnly)
  };
}

export class VoyagePlayerEventApp extends HandlebarsApplicationMixin(ApplicationV2) {
  #sessionId = null;
  #expectedRevision = 0;
  #authorityEpoch = 0;
  #activeTab = "round";
  #scrollTop = 0;
  #executionInFlight = false;

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
      this.#authorityEpoch = Number.isSafeInteger(result.authorityEpoch) ? result.authorityEpoch : this.#authorityEpoch;
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
    this.element.querySelectorAll("[data-player-planning-field]").forEach((control) => control.addEventListener("change", () => this.#submitPlanning(control)));
    this.element.querySelectorAll("[data-player-planning-clear]").forEach((control) => control.addEventListener("click", () => this.#submitPlanning(control, true)));
    this.element.querySelectorAll("[data-player-order-move]").forEach((control) => control.addEventListener("click", () => this.#submitOrder(control)));
    this.element.querySelectorAll("[data-player-execute-current]").forEach((control) => control.addEventListener("click", () => this.#submitExecution(control)));
  }

  async #submitExecution(control) {
    if (this.#executionInFlight || !this.#sessionId) return;
    this.#executionInFlight = true;
    const request = {
      kind: "voyage.m12-resolve-station",
      requestId: randomId("m12-player-execute"),
      sessionId: this.#sessionId,
      expectedRevision: this.#expectedRevision,
      authorityEpoch: this.#authorityEpoch
    };
    try {
      const result = await game.arcflight?.resolveVoyageEventSessionStation?.(request);
      if (result?.ok) {
        this.#expectedRevision = result.revision;
        this.#authorityEpoch = Number.isSafeInteger(result.authorityEpoch) ? result.authorityEpoch : this.#authorityEpoch;
      } else {
        const fresh = game.arcflight?.discoverVoyageEventSession?.();
        if (fresh?.sessionId === this.#sessionId && Number.isSafeInteger(fresh.revision)) this.#expectedRevision = fresh.revision;
        try { globalThis.ui?.notifications?.warn?.(result?.errors?.[0]?.message ?? "The current station changed. Refreshing the authoritative result."); } catch { /* presentation only */ }
      }
      await this.render({ force: true });
    } finally {
      this.#executionInFlight = false;
    }
  }

  async #submitOrder(control) {
    const stationId = control?.dataset?.stationId;
    const direction = control?.dataset?.direction;
    if (!stationId || !["up", "down"].includes(direction) || !this.#sessionId) return;
    const rows = [...this.element.querySelectorAll("[data-player-order-station]")];
    const stationOrder = rows.map((row) => row.dataset.stationId).filter((entry) => typeof entry === "string" && entry.length > 0);
    const index = stationOrder.indexOf(stationId);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= stationOrder.length) return;
    [stationOrder[index], stationOrder[target]] = [stationOrder[target], stationOrder[index]];
    const request = {
      kind: "voyage.m11-command",
      requestId: randomId("m12-player-order"),
      sessionId: this.#sessionId,
      expectedRevision: this.#expectedRevision,
      authorityEpoch: this.#authorityEpoch,
      commandKind: "station-order",
      payload: { stationOrder }
    };
    const result = await game.arcflight?.dispatchVoyageEventSessionCommand?.(request);
    if (result?.ok) {
      this.#expectedRevision = result.revision;
      this.#authorityEpoch = Number.isSafeInteger(result.authorityEpoch) ? result.authorityEpoch : this.#authorityEpoch;
    } else {
      const fresh = game.arcflight?.discoverVoyageEventSession?.();
      if (fresh?.sessionId === this.#sessionId && Number.isSafeInteger(fresh.revision)) this.#expectedRevision = fresh.revision;
      try { globalThis.ui?.notifications?.warn?.(result?.errors?.[0]?.message ?? "Crew planning changed. Review the current order."); } catch { /* presentation only */ }
    }
    await this.render({ force: true });
  }

  async #submitPlanning(control, clear = false) {
    const stationId = control?.dataset?.stationId;
    if (!stationId || !this.#sessionId) return;
    const station = this.element.querySelector(`[data-player-station="${stationId}"]`);
    const actionSelect = station?.querySelector('[data-player-planning-field="action"]');
    const approachSelect = station?.querySelector('[data-player-planning-field="approach"]');
    const riskSelect = station?.querySelector('[data-player-planning-field="riskBid"]');
    const changedField = control?.dataset?.playerPlanningField ?? null;
    const selectedAction = actionSelect?.selectedOptions?.[0] ?? null;
    const payload = clear ? { stationId } : {
      stationId,
      actionId: actionSelect?.value ?? "",
      approachId: changedField === "action"
        ? selectedAction?.dataset?.defaultApproachId ?? ""
        : approachSelect?.value ?? selectedAction?.dataset?.defaultApproachId ?? "",
      riskBidId: changedField === "action" ? null : (riskSelect?.value ? riskSelect.value : null)
    };
    const request = {
      kind: "voyage.m11-command",
      requestId: randomId("m12-player-planning"),
      sessionId: this.#sessionId,
      expectedRevision: this.#expectedRevision,
      authorityEpoch: this.#authorityEpoch,
      commandKind: clear ? "station-selection-clear" : "station-selection",
      payload
    };
    const result = await game.arcflight?.dispatchVoyageEventSessionCommand?.(request);
    if (result?.ok) {
      this.#expectedRevision = result.revision;
      this.#authorityEpoch = Number.isSafeInteger(result.authorityEpoch) ? result.authorityEpoch : this.#authorityEpoch;
    } else {
      const fresh = game.arcflight?.discoverVoyageEventSession?.();
      if (fresh?.sessionId === this.#sessionId && Number.isSafeInteger(fresh.revision)) this.#expectedRevision = fresh.revision;
      try { globalThis.ui?.notifications?.warn?.(result?.errors?.[0]?.message ?? "Crew planning changed. Refreshing the current plan."); } catch { /* presentation only */ }
    }
    await this.render({ force: true });
  }
}

export function openVoyagePlayerEvent() {
  const app = new VoyagePlayerEventApp();
  return app.render({ force: true });
}

export { PLAYER_TABS, normalizePlayerTab };
