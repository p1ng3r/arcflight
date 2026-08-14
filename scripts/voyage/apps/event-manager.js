import { readVoyageEventSessionProjection, readVoyageEventSessionResolution, reloadVoyageEventSession } from "../foundry/event-session-runtime.js";
import { executeVoyagePf2ePendingCheckInFoundry } from "../pf2e/runtime-execution.js";
import { buildVoyageEventManagerDashboardModel, isVoyageEventSessionTerminal, listVoyageEventLaunchShips, normalizeVoyageEventOperatorSelections } from "../foundry/event-launcher.js";
import { M12_EVENT_PRESENTATION, M12_FOCUS_ABILITIES, M12_STATION_IDS } from "../m12/event-definition.js";
import { arcflightTemplatePath } from "../../sheets/sheet-helpers.js";
import { stationPresentation } from "./station-icons.js";
import { resourcePresentation } from "./resource-icons.js";

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
    runExclusiveSessionMutation: game.arcflight?.runExclusiveSessionMutation,
    executeVoyagePf2ePendingCheck: (pendingCheck) => executeVoyagePf2ePendingCheckInFoundry(pendingCheck, globalThis),
    focusAbilities: M12_FOCUS_ABILITIES,
    applyVoyageEncounterAbortTransition: game.arcflight?.applyVoyageEncounterAbortTransition
  };
}
function randomId(prefix) { return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`; }

function riskBidEffectText(effect) {
  if (effect?.effectKind === "roll-bonus") return `+${effect.value} to the next unresolved station roll this round`;
  if (effect?.effectKind === "degree-shift") return `Improve the next result by ${effect.value} degree`;
  return "Authored Risk Bid effect";
}

export function buildPlanningStations(planning, locked = false, expandedStationId = null) {
  const assignments = new Map((planning?.stationAssignments ?? []).map((entry) => [entry.stationId, entry]));
  return (planning?.stations ?? []).map((station) => {
    const selection = planning.selections?.[station.stationId] ?? null;
    const actionOptions = (station.actions ?? []).map((action) => ({
      ...action,
      displayName: action.name ?? action.label ?? action.actionId,
      displayDescription: action.description ?? "Round-specific station action.",
      baseDc: action.check?.dcSource?.value ?? null,
      selected: selection?.actionId === action.actionId,
      riskBidCapable: (action.riskBidOptions ?? []).length > 0,
      riskBidAvailableResource: (action.riskBidOptions ?? []).length > 0 ? resourcePresentation("riskBid") : null,
      approaches: (action.approaches ?? []).map((approach) => ({ ...approach, selected: selection?.approachId === approach.approachId })),
      riskBidOptions: (action.riskBidOptions ?? []).map((option) => ({
        ...option,
        selected: planning.riskBids?.[station.stationId]?.riskBidId === option.riskBidId,
        displayName: action.riskBidPresentation?.[String(option.dcAdjustment)]?.label ?? `+${option.dcAdjustment} Risk Bid`,
        adjustedDc: (action.check?.dcSource?.value ?? 0) + option.dcAdjustment,
        presentation: action.riskBidPresentation?.[String(option.dcAdjustment)] ?? null,
        finalDc: (action.check?.dcSource?.value ?? 0) + option.dcAdjustment,
        resource: resourcePresentation("riskBid", option.dcAdjustment)
      }))
    }));
    for (const option of actionOptions.flatMap((entry) => entry.riskBidOptions)) {
      const effects = option.presentation?.mechanicalEffect?.effects ?? [];
      option.targetStations = [...new Set(effects.flatMap((effect) => effect.targetStationIds ?? []))].map((targetStationId) => ({ stationId: targetStationId, ...stationPresentation(targetStationId) }));
      option.payoffEffects = effects.map((effect) => ({ ...effect, text: riskBidEffectText(effect), targetStations: (effect.targetStationIds ?? []).map((targetStationId) => ({ stationId: targetStationId, ...stationPresentation(targetStationId) })) }));
      option.failureText = option.presentation?.outcome?.failure ?? "Failure: no Risk Bid payoff; no additional Risk Bid penalty.";
      option.criticalFailureText = option.presentation?.outcome?.criticalFailure ?? "Critical Failure: no Risk Bid payoff; no additional Risk Bid penalty.";
    }
    const selectedAction = actionOptions.find((action) => action.selected) ?? null;
    const selectedRiskBid = selectedAction?.riskBidOptions.find((option) => option.selected) ?? null;
    const hasAction = Boolean(selection?.actionId);
    const hasApproach = Boolean(selection?.approachId);
    const planState = locked ? "locked" : !hasAction ? "incomplete" : !hasApproach ? "approach-required" : "ready";
    return {
      stationId: station.stationId,
      ...stationPresentation(station.stationId),
      label: stationPresentation(station.stationId).stationDisplayName,
      operator: assignments.get(station.stationId)?.operator ?? null,
      actions: actionOptions,
      selectedActionId: selection?.actionId ?? "",
      selectedApproachId: selection?.approachId ?? "",
      selectedRiskBidId: planning.riskBids?.[station.stationId]?.riskBidId ?? "",
      approaches: (selectedAction?.approaches ?? []).map((approach) => ({ ...approach, selected: selection?.approachId === approach.approachId })),
      riskBidOptions: (selectedAction?.riskBidOptions ?? []).map((option) => ({ ...option, selected: planning.riskBids?.[station.stationId]?.riskBidId === option.riskBidId })),
      selectedActionName: selectedAction?.displayName ?? selectedAction?.actionId ?? "No action",
      selectedActionDescription: selectedAction?.displayDescription ?? "",
      selectedActionBaseDc: selectedAction?.baseDc ?? null,
      selectedActionHasRiskBids: Boolean(selectedAction?.riskBidOptions?.length),
      selectedRiskBidAvailableResource: selectedAction?.riskBidOptions?.length ? resourcePresentation("riskBid") : null,
      selectedRiskBidResource: selectedRiskBid?.resource ?? null,
      selectedRiskBidFinalDc: selectedRiskBid?.finalDc ?? null,
      expanded: !locked && (!hasAction || !hasApproach || expandedStationId === station.stationId),
      compactSummary: {
        actionName: selectedAction?.displayName ?? "No action",
        approachName: selectedAction?.approaches?.find((approach) => approach.selected)?.name ?? selection?.approachId ?? "No approach",
        riskBidName: selectedRiskBid?.displayName ?? "NO BID"
      },
      ready: hasAction && hasApproach,
      planState,
      selectionState: hasAction ? (hasApproach ? "complete" : "action-selected") : "none",
      statusLabel: planState === "locked" ? "LOCKED" : planState === "ready" ? "READY" : planState === "approach-required" ? "APPROACH REQUIRED" : "ACTION REQUIRED",
      statusMessage: planState === "locked" ? "Planning is locked." : planState === "ready" ? "Ready for Plan Lock." : planState === "approach-required" ? "Choose how this action is being attempted." : "Choose one of the three authored actions."
    };
  });
}

export function buildVoyageRiskBidDependencies(planningStations, order) {
  const orderIndex = new Map((Array.isArray(order) ? order : []).map((stationId, index) => [stationId, index]));
  return (Array.isArray(planningStations) ? planningStations : []).flatMap((station) => {
    const action = station.actions?.find((entry) => entry.actionId === station.selectedActionId);
    const bid = station.riskBidOptions?.find((entry) => entry.selected);
    const presentation = bid?.presentation;
    const targets = presentation?.mechanicalEffect?.effects?.flatMap((effect) => effect.targetStationIds ?? []) ?? [];
    if (!bid || targets.length === 0) return [];
    return [{
      sourceStationId: station.stationId,
      sourceStationLabel: station.label,
      sourceStationIconPath: station.stationIconPath,
      sourceActionName: action?.displayName ?? action?.name ?? station.selectedActionId,
      riskBidName: bid.displayName,
      targetStationIds: [...new Set(targets)],
      targetStations: [...new Set(targets)].map((targetStationId) => ({ stationId: targetStationId, ...stationPresentation(targetStationId) })),
      sourceBeforeTarget: [...new Set(targets)].every((targetStationId) => orderIndex.has(station.stationId) && orderIndex.has(targetStationId) && orderIndex.get(station.stationId) < orderIndex.get(targetStationId)),
      status: [...new Set(targets)].every((targetStationId) => orderIndex.has(station.stationId) && orderIndex.has(targetStationId) && orderIndex.get(station.stationId) < orderIndex.get(targetStationId)) ? "ORDER VALID — bonus can activate" : "TARGET RESOLVES BEFORE SOURCE — payoff cannot affect that target"
    }];
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

export function isVoyagePlanReady(planning, planningStations, effectiveOrder = buildVoyagePlanningOrder(planning)) {
  const occupiedCount = Array.isArray(planning?.stationAssignments) ? planning.stationAssignments.length : 0;
  return Boolean(planning && Array.isArray(planningStations) && planningStations.every((station) => station.ready)
    && Array.isArray(effectiveOrder) && effectiveOrder.length === occupiedCount);
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

export const EVENT_MANAGER_TAB_IDS = Object.freeze(["overview", "crew-plan", "resolution-order", "plan-review", "resolution"]);

export function normalizeEventManagerTab(tab) {
  return typeof tab === "string" && EVENT_MANAGER_TAB_IDS.includes(tab) ? tab : "overview";
}

export function buildEventManagerResolutionPresentation({ planLocked = false, resolutionPhase = null } = {}) {
  const locked = planLocked === true;
  return {
    awaitingPlanLock: !locked,
    readyToStart: locked && resolutionPhase === "lock-readiness",
    rollAvailable: locked && resolutionPhase === "resolution",
    planReviewStatus: locked ? "PLAN LOCKED" : "PLAN REVIEW",
    canNavigateToResolution: locked
  };
}

export function buildVoyagePlanReview(planning, planningStations, order) {
  const rows = (Array.isArray(order) ? order : []).map((stationId, index) => {
    const station = (Array.isArray(planningStations) ? planningStations : []).find((entry) => entry.stationId === stationId);
    const action = station?.selectedActionId ? station.actions.find((entry) => entry.actionId === station.selectedActionId) : null;
    const riskBid = station?.riskBidOptions.find((entry) => entry.selected) ?? null;
    return {
      stationId,
      ...stationPresentation(stationId),
      orderNumber: index + 1,
      stationLabel: station?.label ?? stationId,
      operatorName: station?.operator?.name ?? "Unassigned",
      actionName: action?.displayName ?? action?.name ?? action?.label ?? action?.actionId ?? "No action",
      approachName: station?.approaches?.find((entry) => entry.selected)?.name ?? (station?.selectedApproachId || "No approach"),
      riskBidName: riskBid ? (riskBid.displayName ?? `+${riskBid.dcAdjustment}`) : "No Bid",
      riskBidFinalDc: riskBid?.finalDc ?? null,
      selectedRiskBidResource: riskBid?.resource ?? null,
      riskBidTargetStations: riskBid?.targetStations ?? [],
      riskBidPayoffEffects: riskBid?.payoffEffects ?? [],
      riskBidPresentation: riskBid?.presentation ?? null,
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
  #expandedStationId = null;

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
    let resolution = null;
    if (this.#mode === "live" && this.#sessionId) {
      const projection = readVoyageEventSessionProjection({ kind: "voyage.m11-read-projection", requestId: randomId("m12-read"), sessionId: this.#sessionId, expectedRevision: this.#expectedRevision ?? 0 }, eventContext());
      if (projection.ok) {
        const dashboardModel = buildVoyageEventManagerDashboardModel(projection.projection, M12_EVENT_PRESENTATION, eventContext().activeGmUserId);
        dashboard = { ...dashboardModel, stationAssignments: (dashboardModel.stationAssignments ?? []).map((assignment) => ({ ...assignment, ...stationPresentation(assignment.stationId), statusLabel: dashboardModel.sessionState === "plan-locked" ? "LOCKED" : dashboardModel.sessionState === "station-resolution" ? "RESOLVING" : "PLANNED" })), shipName: allActors.find((actor) => actor.id === this.#shipId)?.name ?? this.#shipId ?? "" };
        planning = game.arcflight?.readVoyageEventSessionPlanning?.(this.#sessionId) ?? null;
        resolution = game.arcflight?.readVoyageEventSessionResolution?.(this.#sessionId) ?? readVoyageEventSessionResolution(this.#sessionId, eventContext());
        if (planning?.ok) this.#authorityEpoch = planning.projection.authorityEpoch;
      }
    }
    const operatorActors = allActors.filter((actor) => actor?.type !== "vehicle").map((actor) => ({ id: actor.id, name: actor.name ?? actor.id }));
    const normalized = normalizeVoyageEventOperatorSelections(this.#operatorSelections, allActors);
    const planningProjection = planning?.ok ? planning.projection : null;
    const planLocked = planningProjection?.sessionState === "plan-locked" || planningProjection?.sessionState === "station-resolution";
    const planningStations = planningProjection ? buildPlanningStations(planningProjection, planLocked, this.#expandedStationId) : [];
    const proposedOrder = planningProjection ? buildVoyagePlanningOrder(planningProjection) : [];
    const planReady = isVoyagePlanReady(planningProjection, planningStations, proposedOrder);
    const planReview = buildVoyagePlanReview(planningProjection, planningStations, proposedOrder);
    const riskBidDependencies = buildVoyageRiskBidDependencies(planningStations, proposedOrder);
    const resolutionProjection = resolution?.ok ? {
      ...resolution.projection,
      stations: (resolution.projection.stations ?? []).map((station) => ({ ...station, ...stationPresentation(station.stationId), operator: station.operator ? { ...station.operator } : null, riskBidEffects: (station.riskBidEffects ?? []).map((effect) => ({
        ...effect,
        sourceStation: stationPresentation(effect.sourceStationId),
        targetStation: stationPresentation(effect.targetStationId),
        effectText: riskBidEffectText({ effectKind: effect.effectKind, value: effect.effectValue }),
        consumptionLabel: effect.consumptionTiming === "on-target-resolution" ? "Consumed when target resolves" : "Consumed at this station's resolution"
      })) })),
      reactionWindowPending: (resolution.projection.reactionWindowPending ?? []).map((entry) => ({ ...entry, focusResource: resourcePresentation("focus"), focusAbility: entry.focusAbility ? { ...entry.focusAbility, sourceStation: stationPresentation(entry.focusAbility.sourceStationId), targetStation: stationPresentation(entry.focusAbility.targetStationId) } : null }))
    } : null;
    const resolutionPresentation = buildEventManagerResolutionPresentation({ planLocked, resolutionPhase: resolutionProjection?.phase ?? null });
    const currentRound = M12_EVENT_PRESENTATION.rounds?.find((round) => round.roundNumber === (planningProjection?.roundNumber ?? dashboard?.roundNumber)) ?? null;
    return {
      mode: this.#mode,
      event: M12_EVENT_PRESENTATION,
      currentRound,
      ships: ships.map((ship) => ({ ...ship, selected: ship.id === this.#shipId })),
      operators: operatorActors,
      stations: M12_STATION_IDS.map((stationId) => ({ stationId, ...stationPresentation(stationId), label: stationPresentation(stationId).stationDisplayName, selected: this.#operatorSelections[stationId] ?? "", occupied: Boolean(this.#operatorSelections[stationId]), options: [{ id: "", name: "Unoccupied", selected: !this.#operatorSelections[stationId] }, ...operatorActors.map((operator) => ({ ...operator, selected: operator.id === this.#operatorSelections[stationId] }))] })),
      setupMode: this.#mode === "setup",
      liveMode: this.#mode === "live",
      validationErrors: normalized.valid ? [] : normalized.errors.map((error) => error.message),
      launchEnabled: Boolean(this.#shipId && normalized.valid && game.user?.isGM && activeGmId() === game.user?.id),
      sessionId: this.#sessionId,
      dashboard,
      planning: planning?.ok ? planning.projection : null,
      resolution: resolutionProjection,
      planningStations,
      proposedOrder,
      riskBidDependencies,
      orderEntries: planningProjection ? proposedOrder.map((stationId, index) => {
        const station = planningStations.find((entry) => entry.stationId === stationId);
        const action = station?.selectedActionId ? station.actions.find((entry) => entry.actionId === station.selectedActionId) : null;
        const riskBid = station?.riskBidOptions.find((entry) => entry.selected) ?? null;
        return {
          stationId,
          ...stationPresentation(stationId),
          orderNumber: index + 1,
          stationLabel: station?.label ?? stationId,
          stationIconPath: station?.stationIconPath ?? stationPresentation(stationId).stationIconPath,
          stationOrderIconSize: 128,
          stationOrderIconTitle: station?.stationIconTitle ?? stationPresentation(stationId).stationIconTitle,
          operatorName: station?.operator?.name ?? "Unassigned",
          actionName: action?.displayName ?? action?.name ?? action?.label ?? action?.actionId ?? "No action",
          approachName: station?.approaches?.find((entry) => entry.selected)?.name ?? (station?.selectedApproachId || "No approach"),
          riskBidName: riskBid ? (riskBid.displayName ?? `+${riskBid.dcAdjustment}`) : "No Bid",
          riskBidAdjustment: riskBid?.dcAdjustment ?? null,
          riskBidFinalDc: riskBid?.finalDc ?? null,
          selectedRiskBidResource: riskBid ? resourcePresentation("riskBid", riskBid.dcAdjustment) : null,
          riskBidAvailableResource: !riskBid && station?.actions?.find((entry) => entry.actionId === station.selectedActionId)?.riskBidCapable ? resourcePresentation("riskBid") : null,
          canMoveUp: index > 0,
          canMoveDown: index < proposedOrder.length - 1
        };
      }) : [],
      planReviewRows: planReview.rows,
      incompleteStations: planReview.incompleteStations,
      activeTab: this.#activeTab,
      tabIds: EVENT_MANAGER_TAB_IDS,
      planReady,
      planLocked,
      abandoned: planningProjection?.sessionState === "aborted",
      abandonEnabled: Boolean(dashboard && !["completed", "aborted"].includes(dashboard.sessionState)),
      ...resolutionPresentation,
      resolutionReadyToStart: resolutionPresentation.readyToStart,
      resolutionRollAvailable: resolutionPresentation.rollAvailable
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
        if (!reloaded.ok || isVoyageEventSessionTerminal({ ...session, sessionState: reloaded.status })) return null;
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
    this.element.querySelectorAll("[data-m12-tab]").forEach((tab) => tab.addEventListener("click", () => this.#navigateToTab(tab.dataset.tabId)));
    this.element.querySelectorAll("[data-m12-ship]").forEach((input) => input.addEventListener("change", (event) => { this.#shipId = event.currentTarget.value; this.render(); }));
    this.element.querySelectorAll("[data-m12-operator]").forEach((input) => input.addEventListener("change", (event) => { this.#operatorSelections[event.currentTarget.dataset.m12Operator] = event.currentTarget.value || null; this.render(); }));
    this.element.querySelector("[data-m12-launch]")?.addEventListener("click", () => this.#launch());
    this.element.querySelector("[data-m12-refresh]")?.addEventListener("click", () => this.render());
    this.element.querySelector("[data-m12-new-session]")?.addEventListener("click", () => { this.#mode = "setup"; this.#sessionId = null; this.render(); });
    this.element.querySelectorAll("[data-m12-action-picker]").forEach((picker) => {
      picker.addEventListener("click", () => this.#toggleActionPicker(picker));
      picker.addEventListener("keydown", (event) => this.#actionPickerKeydown(event, picker));
    });
    this.element.querySelectorAll("[data-m12-action-option]").forEach((option) => {
      option.addEventListener("click", () => this.#selectActionOption(option));
      option.addEventListener("keydown", (event) => this.#actionOptionKeydown(event, option));
    });
    this.element.querySelectorAll("[data-m12-station-selection]").forEach((element) => element.addEventListener("change", (event) => this.#selection(event.currentTarget)));
    this.element.querySelectorAll("[data-m12-clear-selection]").forEach((element) => element.addEventListener("click", (event) => {
      const command = buildVoyageStationSelectionClearCommand(event.currentTarget.dataset.stationId);
      if (command) this.#dispatchPlanning(command.commandKind, command.payload);
    }));
    this.element.querySelectorAll("[data-m12-edit-station]").forEach((button) => button.addEventListener("click", (event) => {
      this.#expandedStationId = event.currentTarget.dataset.stationId;
      this.render();
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
    this.element.querySelectorAll("[data-m12-order-move]").forEach((button) => button.addEventListener("click", (event) => this.#moveOrder(event.currentTarget)));
    this.element.querySelector("[data-m12-plan-lock]")?.addEventListener("click", () => this.#dispatchPlanning("plan-lock", { phaseStartSnapshotId: randomId("m12-plan-lock") }));
    this.element.querySelector("[data-m12-go-resolution]")?.addEventListener("click", () => this.#navigateToTab("resolution"));
    this.element.querySelector("[data-m12-resolution-start]")?.addEventListener("click", () => this.#beginResolution());
    this.element.querySelector("[data-m12-roll-check]")?.addEventListener("click", () => this.#resolveStation());
    this.element.querySelectorAll("[data-m12-focus-pass]").forEach((button) => button.addEventListener("click", () => this.#focusReaction("focus-reaction-pass", button.dataset.reactionId)));
    this.element.querySelectorAll("[data-m12-focus-use]").forEach((button) => button.addEventListener("click", () => this.#focusReaction("focus-reaction-use", button.dataset.reactionId)));
    this.element.querySelector("[data-m12-abandon]")?.addEventListener("click", () => this.#abandonEvent());
    this.#applyTabState();
    this.#restoreViewState();
  }

  #navigateToTab(tabId) {
    const viewState = this.#captureViewState() ?? { scrollPositions: { ...this.#tabScrollPositions } };
    this.#activeTab = normalizeEventManagerTab(tabId);
    this.#pendingViewState = { ...viewState, activeTab: this.#activeTab, stationId: null, controlId: null, actionId: null };
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

  #actionPickerMenu(picker) {
    const menuId = picker?.getAttribute?.("aria-controls");
    return menuId ? this.element.querySelector(`#${menuId}`) : null;
  }

  #toggleActionPicker(picker, force = null) {
    if (!picker || picker.disabled) return;
    const menu = this.#actionPickerMenu(picker);
    if (!menu) return;
    const open = force === null ? picker.getAttribute("aria-expanded") !== "true" : force;
    picker.setAttribute("aria-expanded", open ? "true" : "false");
    menu.hidden = !open;
    if (open) {
      const selected = menu.querySelector('[aria-selected="true"]') ?? menu.querySelector("[data-m12-action-option]");
      selected?.focus?.({ preventScroll: true });
    } else picker.focus?.({ preventScroll: true });
  }

  #actionPickerKeydown(event, picker) {
    if (["Enter", " ", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      this.#toggleActionPicker(picker, true);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      this.#toggleActionPicker(picker, true);
      const options = [...(this.#actionPickerMenu(picker)?.querySelectorAll("[data-m12-action-option]") ?? [])];
      options.at(-1)?.focus?.({ preventScroll: true });
    }
  }

  #actionOptionKeydown(event, option) {
    const options = [...(option.closest('[role="listbox"]')?.querySelectorAll("[data-m12-action-option]") ?? [])];
    const index = options.indexOf(option);
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.#selectActionOption(option);
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.#toggleActionPicker(this.element.querySelector(`[data-m12-action-picker][data-station-id="${option.dataset.stationId}"]`), false);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = options[(index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length];
      next?.focus?.({ preventScroll: true });
    }
  }

  #selectActionOption(option) {
    if (!option) return;
    const stationId = option.dataset.stationId;
    const actionId = option.dataset.actionId ?? "";
    const approachId = option.dataset.approachId ?? "";
    this.#toggleActionPicker(this.element.querySelector(`[data-m12-action-picker][data-station-id="${stationId}"]`), false);
    this.#dispatchPlanning("station-selection", { stationId, actionId, approachId, riskBidId: null });
  }

  #selection(element) {
    const stationId = element.dataset.stationId;
    const actionId = this.element.querySelector(`[data-m12-action-picker][data-station-id="${stationId}"]`)?.dataset.selectedActionId ?? "";
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

  #moveOrder(button) {
    if (!button || button.disabled || this.#mode !== "live") return;
    const stationId = button.dataset.stationId;
    const direction = button.dataset.direction === "up" ? -1 : 1;
    const order = [...this.element.querySelectorAll("[data-m12-order-station]")].map((entry) => entry.dataset.stationId);
    const index = order.indexOf(stationId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= order.length) return;
    const proposed = reorderVoyagePlanningOrder(order, stationId, order[targetIndex], direction < 0);
    if (!proposed || proposed.every((entry, position) => entry === order[position])) return;
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

  async #resolveStation() {
    const viewState = this.#captureViewState();
    const resolve = game.arcflight?.resolveVoyageEventSessionStation;
    if (typeof resolve !== "function") return ui.notifications?.error?.("Resolution transport is unavailable.");
    const result = await resolve({ kind: "voyage.m12-resolve-station", requestId: randomId("m12-resolve"), sessionId: this.#sessionId, expectedRevision: this.#expectedRevision, authorityEpoch: this.#authorityEpoch });
    if (!result?.ok) {
      ui.notifications?.error?.(result?.errors?.[0]?.message ?? "The station check was rejected.");
      this.#pendingViewState = viewState;
      this.render();
      return result;
    }
    const reread = reloadVoyageEventSession(this.#sessionId, eventContext());
    if (!reread.ok) return reread;
    this.#expectedRevision = reread.revision;
    this.#authorityEpoch = reread.authorityEpoch;
    this.#pendingViewState = viewState;
    this.render();
    return result;
  }

  async #focusReaction(commandKind, reactionId = null) {
    reactionId ??= this.element.querySelector("[data-m12-focus-use], [data-m12-focus-pass]")?.dataset?.reactionId;
    if (!reactionId) return null;
    const result = await game.arcflight?.dispatchVoyageEventSessionCommand?.({ kind: "voyage.m11-command", requestId: randomId("m12-focus"), sessionId: this.#sessionId, expectedRevision: this.#expectedRevision, authorityEpoch: this.#authorityEpoch, commandKind, payload: { reactionId } });
    if (!result?.ok) ui.notifications?.error?.(result?.errors?.[0]?.message ?? "Focus reaction was rejected.");
    const reread = reloadVoyageEventSession(this.#sessionId, eventContext());
    if (reread.ok) { this.#expectedRevision = reread.revision; this.#authorityEpoch = reread.authorityEpoch; this.render(); }
    return result;
  }

  async #beginResolution() {
    const viewState = this.#captureViewState();
    const begin = game.arcflight?.beginVoyageEventSessionResolution;
    if (typeof begin !== "function") return ui.notifications?.error?.("Resolution transport is unavailable.");
    const result = await begin({ kind: "voyage.m12-begin-resolution", requestId: randomId("m12-resolution-start"), sessionId: this.#sessionId, expectedRevision: this.#expectedRevision, authorityEpoch: this.#authorityEpoch });
    if (!result?.ok) {
      ui.notifications?.error?.(result?.errors?.[0]?.message ?? "Resolution start was rejected.");
      this.#pendingViewState = viewState;
      this.render();
      return result;
    }
    const reread = reloadVoyageEventSession(this.#sessionId, eventContext());
    const resolution = reread.ok ? readVoyageEventSessionResolution(this.#sessionId, eventContext()) : null;
    if (!reread.ok || !resolution?.ok || resolution.projection?.phase !== "resolution") {
      ui.notifications?.error?.("Resolution start did not reach the canonical Resolution phase.");
      this.#pendingViewState = viewState;
      this.render();
      return reread.ok ? resolution : reread;
    }
    this.#expectedRevision = reread.revision;
    this.#authorityEpoch = reread.authorityEpoch;
    this.#pendingViewState = viewState;
    this.render();
    return result;
  }

  async #abandonEvent() {
    if (!globalThis.confirm?.("Abandon this Event Session? It will remain in history and allow a new event to be launched.")) return null;
    const result = await game.arcflight?.abortVoyageEventSession?.({ kind: "voyage.m11-abort-session", requestId: randomId("m12-abandon"), sessionId: this.#sessionId, expectedRevision: this.#expectedRevision, authorityEpoch: this.#authorityEpoch, reason: "GM abandoned Event Session", confirmation: true });
    if (!result?.ok) {
      ui.notifications?.error?.(result?.errors?.[0]?.message ?? "The Event Session could not be abandoned.");
      return result;
    }
    const reread = reloadVoyageEventSession(this.#sessionId, eventContext());
    if (!reread.ok) {
      ui.notifications?.error?.("The Event Session was abandoned but could not be reread.");
      return reread;
    }
    this.#expectedRevision = reread.revision;
    this.#authorityEpoch = reread.authorityEpoch;
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
