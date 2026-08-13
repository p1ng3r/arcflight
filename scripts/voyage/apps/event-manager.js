import { readVoyageEventSessionProjection, reloadVoyageEventSession } from "../foundry/event-session-runtime.js";
import { buildVoyageEventManagerDashboardModel, listVoyageEventLaunchShips, normalizeVoyageEventOperatorSelections } from "../foundry/event-launcher.js";
import { M12_EVENT_PRESENTATION, M12_STATION_IDS } from "../m12/event-definition.js";
import { arcflightTemplatePath } from "../../sheets/sheet-helpers.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;

function actors() {
  try { return game.actors ? (typeof game.actors.values === "function" ? [...game.actors.values()] : Array.from(game.actors)) : []; } catch { return []; }
}
function activeGmId() {
  try { return game.users?.activeGM?.id ?? game.users?.find?.((user) => user?.isGM && user.active)?.id ?? null; } catch { return null; }
}
function trustedUsersSnapshot() {
  try {
    const source = game.users;
    const users = Array.isArray(source) ? source : source?.contents;
    if (!Array.isArray(users)) return [];
    return users.map((user) => ({ id: user?.id, isGM: user?.isGM, active: user?.active }));
  } catch {
    return [];
  }
}
function eventContext() {
  const connectionId = game.socket?.id ?? null;
  return {
    authenticatedUserId: game.user?.id ?? null,
    authenticatedConnectionId: connectionId,
    trustedTransportContext: typeof connectionId === "string" && connectionId.length > 0,
    activeGmUserId: activeGmId(),
    users: trustedUsersSnapshot(),
    actors: game.actors,
    journalEntries: game.journal,
    JournalEntry,
    isJournalEntryDocument: (document) => document?.documentName === "JournalEntry" || document?.constructor?.name === "JournalEntry",
    createDocumentId: () => foundry.utils.randomID(),
    resolveEventDefinitionSnapshot: (eventId, definitionSnapshotId) => game.arcflight.getM12EventDefinition(eventId, definitionSnapshotId),
    runExclusiveSessionMutation: game.arcflight?.runExclusiveSessionMutation
  };
}
function randomId(prefix) { return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`; }

export function buildPlanningStations(planning, locked = false) {
  const assignments = new Map((planning?.stationAssignments ?? []).map((entry) => [entry.stationId, entry]));
  return (planning?.stations ?? []).map((station) => {
    const selection = planning.selections?.[station.stationId] ?? null;
    const actionOptions = (station.actions ?? []).map((action) => ({
      ...action,
      selected: selection?.actionId === action.actionId,
      approaches: (action.approaches ?? []).map((approach) => ({ ...approach, selected: selection?.approachId === approach.approachId })),
      riskBidOptions: (action.riskBidOptions ?? []).map((option) => ({ ...option, selected: planning.riskBids?.[station.stationId]?.riskBidId === option.riskBidId }))
    }));
    const selectedAction = actionOptions.find((action) => action.selected) ?? null;
    const hasAction = Boolean(selection?.actionId);
    const hasApproach = Boolean(selection?.approachId);
    const planState = locked ? "locked" : !hasAction ? "incomplete" : !hasApproach ? "approach-required" : "ready";
    return {
      stationId: station.stationId,
      label: station.stationId.replace(/(^|-)(\w)/g, (_m, _p, c) => c.toUpperCase()),
      operator: assignments.get(station.stationId)?.operator ?? null,
      actions: actionOptions,
      selectedActionId: selection?.actionId ?? "",
      selectedApproachId: selection?.approachId ?? "",
      selectedRiskBidId: planning.riskBids?.[station.stationId]?.riskBidId ?? "",
      approaches: (selectedAction?.approaches ?? []).map((approach) => ({ ...approach, selected: selection?.approachId === approach.approachId })),
      riskBidOptions: (selectedAction?.riskBidOptions ?? []).map((option) => ({ ...option, selected: planning.riskBids?.[station.stationId]?.riskBidId === option.riskBidId })),
      ready: hasAction && hasApproach,
      planState,
      selectionState: hasAction ? (hasApproach ? "complete" : "action-selected") : "none",
      statusLabel: planState === "locked" ? "LOCKED" : planState === "ready" ? "READY" : planState === "approach-required" ? "APPROACH REQUIRED" : "ACTION REQUIRED",
      statusMessage: planState === "locked" ? "Planning is locked." : planState === "ready" ? "Ready for Plan Lock." : planState === "approach-required" ? "Choose how this action is being attempted." : "Choose one of the three authored actions."
    };
  });
}

export function buildVoyageStationSelectionClearCommand(stationId) {
  if (typeof stationId !== "string" || stationId.trim().length === 0) return null;
  return { commandKind: "station-selection-clear", payload: { stationId } };
}

export function buildVoyagePlanningOrder(planning) {
  const assignments = Array.isArray(planning?.stationAssignments)
    ? planning.stationAssignments.map((entry) => entry?.stationId)
    : [];
  if (assignments.some((stationId) => typeof stationId !== "string" || stationId.length === 0)
    || new Set(assignments).size !== assignments.length) return [];
  const proposed = planning?.sessionState === "plan-locked"
    ? planning?.committedStationOrder
    : planning?.proposedStationOrder;
  if (Array.isArray(proposed)
    && proposed.length === assignments.length
    && new Set(proposed).size === proposed.length
    && proposed.every((stationId) => assignments.includes(stationId))) return [...proposed];
  return [...assignments];
}

export function reorderVoyagePlanningOrder(order, draggedStationId, targetStationId, before = true) {
  if (!Array.isArray(order) || typeof draggedStationId !== "string" || typeof targetStationId !== "string") return null;
  const source = [...order];
  if (new Set(source).size !== source.length || !source.includes(draggedStationId) || !source.includes(targetStationId)) return null;
  if (draggedStationId === targetStationId) return source;
  source.splice(source.indexOf(draggedStationId), 1);
  let targetIndex = source.indexOf(targetStationId);
  if (targetIndex < 0) return null;
  if (!before) targetIndex += 1;
  source.splice(targetIndex, 0, draggedStationId);
  return source;
}

export const EVENT_MANAGER_TAB_IDS = Object.freeze(["overview", "crew-plan", "resolution-order", "plan-review"]);

export function normalizeEventManagerTab(tab) {
  return typeof tab === "string" && EVENT_MANAGER_TAB_IDS.includes(tab) ? tab : "overview";
}

export function buildVoyagePlanReview(planning, planningStations, order) {
  const rows = (Array.isArray(order) ? order : []).map((stationId, index) => {
    const station = (Array.isArray(planningStations) ? planningStations : []).find((entry) => entry.stationId === stationId);
    const action = station?.selectedActionId ? station.actions.find((entry) => entry.actionId === station.selectedActionId) : null;
    const riskBid = station?.riskBidOptions.find((entry) => entry.selected) ?? null;
    return {
      stationId,
      orderNumber: index + 1,
      stationLabel: station?.label ?? stationId,
      operatorName: station?.operator?.name ?? "Unassigned",
      actionName: action?.name ?? action?.label ?? action?.actionId ?? "No action",
      approachName: station?.selectedApproachId || "No approach",
      riskBidName: riskBid ? `+${riskBid.dcAdjustment}` : "No Bid",
      planState: station?.planState ?? "incomplete",
      ready: Boolean(station?.ready)
    };
  });
  return {
    rows,
    incompleteStations: (Array.isArray(planningStations) ? planningStations : []).filter((station) => !station.ready),
    ready: Boolean(planning && rows.length > 0 && rows.every((row) => row.ready)),
    locked: planning?.sessionState === "plan-locked"
  };
}

export class ArcflightEventManager extends HandlebarsApplicationMixin(ApplicationV2) {
  #expectedRevision = 0;
  #authorityEpoch = 0;
  #mode = "setup";
  #sessionId = null;
  #operatorSelections = Object.fromEntries(M12_STATION_IDS.map((stationId) => [stationId, null]));
  #shipId = "";
  #dragStationId = null;
  #activeTab = "overview";
  #tabScrollPositions = Object.create(null);
  #pendingViewState = null;

  static DEFAULT_OPTIONS = {
    id: "arcflight-event-manager",
    classes: ["arcflight", "event-manager"],
    tag: "section",
    position: { width: 720, height: 680 },
    window: { resizable: true }
  };

  static PARTS = { body: { template: arcflightTemplatePath("voyage/event-manager.hbs") } };

  async _prepareContext() {
    const allActors = actors();
    const ships = listVoyageEventLaunchShips(allActors);
    if (!this.#shipId && ships[0]) this.#shipId = ships[0].id;
    let dashboard = null;
    let planning = null;
    if (this.#mode === "live" && this.#sessionId) {
      const projection = readVoyageEventSessionProjection({ kind: "voyage.m11-read-projection", requestId: randomId("m12-read"), sessionId: this.#sessionId, expectedRevision: this.#expectedRevision ?? 0 }, eventContext());
      if (projection.ok) {
        dashboard = { ...buildVoyageEventManagerDashboardModel(projection.projection, M12_EVENT_PRESENTATION, eventContext().activeGmUserId), shipName: allActors.find((actor) => actor.id === this.#shipId)?.name ?? this.#shipId ?? "" };
        planning = game.arcflight?.readVoyageEventSessionPlanning?.(this.#sessionId) ?? null;
        if (planning?.ok) this.#authorityEpoch = planning.projection.authorityEpoch;
      }
    }
    const operatorActors = allActors.filter((actor) => actor?.type !== "vehicle").map((actor) => ({ id: actor.id, name: actor.name ?? actor.id }));
    const normalized = normalizeVoyageEventOperatorSelections(this.#operatorSelections, allActors);
    const planningProjection = planning?.ok ? planning.projection : null;
    const planningStations = planningProjection ? buildPlanningStations(planningProjection, planningProjection.sessionState === "plan-locked") : [];
    const proposedOrder = planningProjection ? buildVoyagePlanningOrder(planningProjection) : [];
    const planReady = Boolean(planningProjection && planningStations.every((station) => station.ready)
      && (planningProjection.proposedStationOrder.length || planningProjection.stationAssignments.length === 0));
    const planReview = buildVoyagePlanReview(planningProjection, planningStations, proposedOrder);
    return {
      mode: this.#mode,
      event: M12_EVENT_PRESENTATION,
      ships: ships.map((ship) => ({ ...ship, selected: ship.id === this.#shipId })),
      operators: operatorActors,
      stations: M12_STATION_IDS.map((stationId) => ({ stationId, label: stationId.replace(/(^|-)(\w)/g, (_m, _p, c) => c.toUpperCase()), selected: this.#operatorSelections[stationId] ?? "", occupied: Boolean(this.#operatorSelections[stationId]), options: [{ id: "", name: "Unoccupied", selected: !this.#operatorSelections[stationId] }, ...operatorActors.map((operator) => ({ ...operator, selected: operator.id === this.#operatorSelections[stationId] }))] })),
      setupMode: this.#mode === "setup",
      liveMode: this.#mode === "live",
      validationErrors: normalized.valid ? [] : normalized.errors.map((error) => error.message),
      launchEnabled: Boolean(this.#shipId && normalized.valid && game.user?.isGM && activeGmId() === game.user?.id),
      sessionId: this.#sessionId,
      dashboard,
      planning: planning?.ok ? planning.projection : null,
      planningStations,
      proposedOrder,
      orderEntries: planningProjection ? proposedOrder.map((stationId, index) => {
        const station = planningStations.find((entry) => entry.stationId === stationId);
        const action = station?.selectedActionId ? station.actions.find((entry) => entry.actionId === station.selectedActionId) : null;
        const riskBid = station?.riskBidOptions.find((entry) => entry.selected) ?? null;
        return {
          stationId,
          orderNumber: index + 1,
          stationLabel: station?.label ?? stationId,
          operatorName: station?.operator?.name ?? "Unassigned",
          actionName: action?.name ?? action?.label ?? action?.actionId ?? "No action",
          approachName: station?.selectedApproachId || "No approach",
          riskBidName: riskBid ? `+${riskBid.dcAdjustment}` : "No Bid"
        };
      }) : [],
      planReviewRows: planReview.rows,
      incompleteStations: planReview.incompleteStations,
      activeTab: this.#activeTab,
      tabIds: EVENT_MANAGER_TAB_IDS,
      planReady,
      planLocked: planningProjection?.sessionState === "plan-locked"
    };
  }

  discoverDurableSession() {
    if (!game.user?.isGM || activeGmId() !== game.user.id) return false;
    const journals = (() => { try { return game.journal ? (typeof game.journal.values === "function" ? [...game.journal.values()] : Array.from(game.journal)) : []; } catch { return []; } })();
    const candidates = journals.map((entry) => {
      try {
        const session = entry?.flags?.arcflight?.system?.voyageSession ?? entry?.toObject?.()?.flags?.arcflight?.system?.voyageSession;
        if (!session || session.eventId !== M12_EVENT_PRESENTATION.eventId) return null;
        const reloaded = reloadVoyageEventSession(session.sessionId, eventContext());
        if (!reloaded.ok || ["completed", "aborted"].includes(reloaded.status)) return null;
        return { sessionId: session.sessionId, revision: reloaded.revision, shipId: session.shipId };
      } catch { return null; }
    }).filter(Boolean);
    if (candidates.length !== 1) return false;
    this.#sessionId = candidates[0].sessionId;
    this.#expectedRevision = candidates[0].revision;
    this.#shipId = candidates[0].shipId;
    this.#mode = "live";
    return true;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll("[data-m12-tab]").forEach((tab) => tab.addEventListener("click", () => {
      const viewState = this.#captureViewState() ?? { scrollPositions: { ...this.#tabScrollPositions } };
      this.#activeTab = normalizeEventManagerTab(tab.dataset.tabId);
      this.#pendingViewState = { ...viewState, activeTab: this.#activeTab, stationId: null, controlId: null, actionId: null };
      this.#applyTabState();
      this.#restoreViewState();
    }));
    this.element.querySelectorAll("[data-m12-ship]").forEach((input) => input.addEventListener("change", (event) => { this.#shipId = event.currentTarget.value; this.render(); }));
    this.element.querySelectorAll("[data-m12-operator]").forEach((input) => input.addEventListener("change", (event) => { this.#operatorSelections[event.currentTarget.dataset.m12Operator] = event.currentTarget.value || null; this.render(); }));
    this.element.querySelector("[data-m12-launch]")?.addEventListener("click", () => this.#launch());
    this.element.querySelector("[data-m12-refresh]")?.addEventListener("click", () => this.render());
    this.element.querySelector("[data-m12-new-session]")?.addEventListener("click", () => { this.#mode = "setup"; this.#sessionId = null; this.render(); });
    this.element.querySelectorAll("[data-m12-station-selection]").forEach((element) => element.addEventListener("change", (event) => this.#selection(event.currentTarget)));
    this.element.querySelectorAll("[data-m12-clear-selection]").forEach((element) => element.addEventListener("click", (event) => {
      const command = buildVoyageStationSelectionClearCommand(event.currentTarget.dataset.stationId);
      if (command) this.#dispatchPlanning(command.commandKind, command.payload);
    }));
    this.element.querySelectorAll("[data-m12-order-station]").forEach((element) => {
      element.addEventListener("dragstart", (event) => {
        this.#dragStationId = event.currentTarget.dataset.stationId;
        event.dataTransfer?.setData("text/plain", this.#dragStationId);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        event.currentTarget.classList.add("is-dragging");
      });
      element.addEventListener("dragend", (event) => {
        this.#dragStationId = null;
        event.currentTarget.classList.remove("is-dragging");
        this.element.querySelectorAll("[data-m12-order-station]").forEach((entry) => entry.classList.remove("is-drag-over"));
      });
      element.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.currentTarget.classList.add("is-drag-over");
        const rect = event.currentTarget.getBoundingClientRect();
        const before = event.clientY < rect.top + (rect.height / 2);
        event.currentTarget.style.borderTop = before ? "2px solid var(--color-border-highlight, #b98b4f)" : "";
        event.currentTarget.style.borderBottom = before ? "" : "2px solid var(--color-border-highlight, #b98b4f)";
      });
      element.addEventListener("dragleave", (event) => {
        event.currentTarget.classList.remove("is-drag-over");
        event.currentTarget.style.borderTop = "";
        event.currentTarget.style.borderBottom = "";
      });
      element.addEventListener("drop", (event) => this.#dropOrder(event));
    });
    this.element.querySelector("[data-m12-plan-lock]")?.addEventListener("click", () => this.#dispatchPlanning("plan-lock", { phaseStartSnapshotId: randomId("m12-plan-lock") }));
    this.#applyTabState();
    this.#restoreViewState();
  }

  #captureViewState() {
    const root = this.element;
    if (!root) return this.#pendingViewState;
    const activeTab = normalizeEventManagerTab(this.#activeTab);
    const panels = [...root.querySelectorAll("[data-m12-tab-content]")];
    const scrollPositions = { ...this.#tabScrollPositions };
    for (const panel of panels) {
      const tabId = normalizeEventManagerTab(panel.dataset.tabId);
      if (panel.dataset.tabId === tabId && Number.isFinite(panel.scrollTop)) scrollPositions[tabId] = panel.scrollTop;
    }
    this.#tabScrollPositions = scrollPositions;
    const activeElement = root.ownerDocument?.activeElement;
    const station = activeElement?.closest?.("[data-station-id]");
    const control = activeElement?.dataset?.controlId ?? activeElement?.dataset?.m12ControlId ?? null;
    const actionId = activeElement?.dataset?.actionId ?? null;
    this.#pendingViewState = { activeTab, scrollPositions, stationId: station?.dataset?.stationId ?? null, controlId: control, actionId };
    return this.#pendingViewState;
  }

  #applyTabState() {
    if (!this.element) return;
    const activeTab = normalizeEventManagerTab(this.#activeTab);
    this.element.dataset.activeTab = activeTab;
    this.element.querySelectorAll("[data-m12-tab]").forEach((tab) => {
      const selected = tab.dataset.tabId === activeTab;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", selected ? "true" : "false");
      tab.tabIndex = selected ? 0 : -1;
    });
    this.element.querySelectorAll("[data-m12-tab-content]").forEach((panel) => {
      panel.hidden = panel.dataset.tabId !== activeTab;
      panel.classList.toggle("is-active", panel.dataset.tabId === activeTab);
    });
  }

  #restoreViewState() {
    if (!this.element) return;
    const state = this.#pendingViewState;
    const activeTab = normalizeEventManagerTab(state?.activeTab ?? this.#activeTab);
    this.#activeTab = activeTab;
    const panel = [...this.element.querySelectorAll("[data-m12-tab-content]")].find((entry) => entry.dataset.tabId === activeTab);
    const scrollTop = state?.scrollPositions?.[activeTab] ?? this.#tabScrollPositions[activeTab];
    if (panel && Number.isFinite(scrollTop)) panel.scrollTop = scrollTop;
    if (state?.stationId) {
      const escape = (value) => globalThis.CSS?.escape?.(value) ?? String(value).replace(/(["\\])/g, "\\$1");
      const station = panel?.querySelector(`[data-station-id="${escape(state.stationId)}"]`) ?? this.element.querySelector(`[data-station-id="${escape(state.stationId)}"]`);
      station?.scrollIntoView?.({ block: "nearest" });
      const selector = state.controlId ? `[data-control-id="${escape(state.controlId)}"]` : state.actionId ? `[data-action-id="${escape(state.actionId)}"]` : null;
      const target = selector ? station?.querySelector(selector) : null;
      target?.focus?.({ preventScroll: true });
    }
    this.#pendingViewState = null;
  }

  #selection(element) {
    const stationId = element.dataset.stationId;
    const actionId = this.element.querySelector(`[data-m12-action="${stationId}"]`)?.value ?? "";
    const action = [...this.element.querySelectorAll(`[data-m12-action-option="${stationId}"]`)].find((entry) => entry.dataset.actionId === actionId);
    const actionChanged = Boolean(element.dataset.m12Action);
    const approachId = actionChanged
      ? action?.dataset.approachId || ""
      : this.element.querySelector(`[data-m12-approach="${stationId}"]`)?.value || action?.dataset.approachId || "";
    const riskBidId = actionChanged
      ? null
      : this.element.querySelector(`[data-m12-risk-bid="${stationId}"]`)?.value || null;
    this.#dispatchPlanning("station-selection", { stationId, actionId, approachId, riskBidId });
  }

  #dropOrder(event) {
    event.preventDefault();
    const target = event.currentTarget;
    const draggedStationId = this.#dragStationId || event.dataTransfer?.getData("text/plain");
    const targetStationId = target?.dataset?.stationId;
    const before = event.clientY < target.getBoundingClientRect().top + (target.getBoundingClientRect().height / 2);
    const order = [...this.element.querySelectorAll("[data-m12-order-station]")].map((entry) => entry.dataset.stationId);
    const proposed = reorderVoyagePlanningOrder(order, draggedStationId, targetStationId, before);
    target.classList.remove("is-drag-over");
    target.style.borderTop = "";
    target.style.borderBottom = "";
    if (!proposed || proposed.every((stationId, index) => stationId === order[index])) return;
    this.#dispatchPlanning("station-order", { stationOrder: proposed });
  }

  async #dispatchPlanning(commandKind, payload) {
    const viewState = this.#captureViewState();
    const dispatch = game.arcflight?.dispatchVoyageEventSessionCommand;
    if (typeof dispatch !== "function") return ui.notifications?.error?.("Arcflight planning transport is unavailable.");
    const result = await dispatch({ kind: "voyage.m11-command", requestId: randomId(`m12-${commandKind}`), sessionId: this.#sessionId, expectedRevision: this.#expectedRevision, authorityEpoch: this.#authorityEpoch, commandKind, payload });
    if (!result?.ok) {
      const reread = this.#sessionId ? reloadVoyageEventSession(this.#sessionId, eventContext()) : null;
      if (reread?.ok) {
        this.#expectedRevision = reread.revision;
        this.#authorityEpoch = reread.authorityEpoch;
      }
      ui.notifications?.error?.(result?.errors?.[0]?.message ?? "The planning change was rejected.");
      this.#pendingViewState = viewState;
      this.render();
      return result;
    }
    const reread = reloadVoyageEventSession(this.#sessionId, eventContext());
    if (!reread.ok) {
      ui.notifications?.error?.("The planning change was persisted but could not be verified.");
      this.#pendingViewState = viewState;
      this.render();
      return reread;
    }
    this.#expectedRevision = reread.revision;
    this.#authorityEpoch = reread.authorityEpoch;
    this.#pendingViewState = viewState;
    this.render();
    return result;
  }

  async #launch() {
    const request = { kind: "voyage.m12-launch-event", requestId: randomId("m12-launch"), sessionId: randomId("voyage-session"), expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_PRESENTATION.eventId, definitionSnapshotId: M12_EVENT_PRESENTATION.definitionSnapshotId, shipId: this.#shipId, operatorSelections: { ...this.#operatorSelections } };
    const launch = game.arcflight?.launchVoyageEventSession;
    if (typeof launch !== "function") return ui.notifications?.error?.("Arcflight launch transport is unavailable.");
    let result;
    try {
      result = await launch(request);
    } catch (error) {
      ui.notifications?.error?.(error?.message ?? "Arcflight could not launch the event.");
      return null;
    }
    if (!result?.ok) {
      const launchError = result?.errors?.[0] ?? new Error("Arcflight could not launch the event.");
      return ui.notifications?.error?.(launchError?.message ?? "Arcflight could not launch the event.");
    }
    this.#sessionId = result.sessionId; this.#expectedRevision = result.revision; this.#mode = "live"; this.render();
  }
}

export function openArcflightEventManager() {
  if (!game.user?.isGM || activeGmId() !== game.user.id) return ui.notifications?.warn?.("Only the active GM can open the Arcflight Event Manager.");
  const manager = new ArcflightEventManager();
  manager.discoverDurableSession();
  return manager.render({ force: true });
}
