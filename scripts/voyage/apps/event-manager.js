import { readVoyageEventSessionProjection, readVoyageEventSessionResolution, reloadVoyageEventSession } from "../foundry/event-session-runtime.js";
import { executeVoyagePf2ePendingCheckInFoundry, executeVoyagePf2eBreachSaveInFoundry } from "../pf2e/runtime-execution.js";
import { buildVoyageEventManagerDashboardModel, isVoyageEventSessionTerminal, listVoyageEventLaunchShips, normalizeVoyageEventOperatorSelections } from "../foundry/event-launcher.js";
import { M12_EVENT_PRESENTATION, M12_FOCUS_ABILITIES, M12_STATION_IDS, getM12EventDefinition } from "../m12/event-definition.js";
import { arcflightTemplatePath } from "../../sheets/sheet-helpers.js";
import { stationPresentation } from "./station-icons.js";
import { resourcePresentation } from "./resource-icons.js";
import { VOYAGE_PRESSURE_DEFAULT_CAPACITY, VOYAGE_PRESSURE_MAX_CAPACITY, VOYAGE_PRESSURE_SYSTEM_BY_STATION_ID } from "../domain/constants.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;

const EVENT_MANAGER_UI_ICON_PATHS = Object.freeze({
  momentum: "modules/arcflight/assets/ui/icons/momentum_icon.webp",
  hazard: "modules/arcflight/assets/ui/icons/hazard_icon.webp",
  order: "modules/arcflight/assets/ui/icons/order_icon.webp",
  orderLink: "modules/arcflight/assets/ui/icons/order_link_icon.webp"
});

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
    executeVoyagePf2eBreachSave: (pendingSave) => executeVoyagePf2eBreachSaveInFoundry(pendingSave, globalThis),
    focusAbilities: M12_FOCUS_ABILITIES,
    applyVoyageEncounterAbortTransition: game.arcflight?.applyVoyageEncounterAbortTransition
  };
}
function randomId(prefix) { return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`; }
function activeGmDisplayName() {
  const id = activeGmId();
  if (!id) return "Unavailable";
  try {
    const users = game.users;
    const user = users?.get?.(id) ?? (Array.isArray(users) ? users.find((entry) => entry?.id === id) : users?.contents?.find?.((entry) => entry?.id === id));
    return user?.name ?? id;
  } catch {
    return id;
  }
}

export function captureEventManagerViewState(root, activeTab = "event", previousScrollPositions = {}) {
  const normalizedTab = normalizeEventManagerTab(activeTab);
  const scrollPositions = { ...(previousScrollPositions ?? {}) };
  const scrollRegions = {};
  const regions = root?.querySelectorAll?.("[data-m12-scroll-region]") ?? [];
  for (const region of regions) {
    const key = region?.dataset?.m12ScrollRegion;
    if (typeof key !== "string" || key.length === 0) continue;
    const top = Number(region.scrollTop);
    const left = Number(region.scrollLeft);
    if (Number.isFinite(top) || Number.isFinite(left)) scrollRegions[key] = { top: Number.isFinite(top) ? top : 0, left: Number.isFinite(left) ? left : 0 };
    const tabId = region?.dataset?.tabId;
    if (typeof tabId === "string" && Number.isFinite(top)) scrollPositions[normalizeEventManagerTab(tabId)] = top;
  }
  const activeElement = root?.ownerDocument?.activeElement;
  const focusInsideRoot = Boolean(activeElement && (activeElement === root || root?.contains?.(activeElement) === true));
  const station = focusInsideRoot ? activeElement?.closest?.("[data-station-id]") : null;
  const controlId = focusInsideRoot ? (activeElement?.dataset?.controlId ?? activeElement?.dataset?.m12ControlId ?? null) : null;
  const actionId = focusInsideRoot ? (activeElement?.dataset?.actionId ?? null) : null;
  return {
    activeTab: normalizedTab,
    stationId: station?.dataset?.stationId ?? null,
    controlId,
    actionId,
    focusedControlKey: station?.dataset?.stationId ? `${station.dataset.stationId}:${controlId ?? actionId ?? "station"}` : null,
    scrollPositions,
    scrollRegions
  };
}

export function restoreEventManagerViewState(root, state, fallbackTab = "event") {
  if (!root) return normalizeEventManagerTab(state?.activeTab ?? fallbackTab);
  const activeTab = normalizeEventManagerTab(state?.activeTab ?? fallbackTab);
  const scrollRegions = state?.scrollRegions ?? {};
  const scrollPositions = state?.scrollPositions ?? {};
  for (const region of root.querySelectorAll?.("[data-m12-scroll-region]") ?? []) {
    const key = region?.dataset?.m12ScrollRegion;
    const saved = typeof key === "string" ? scrollRegions[key] : null;
    const tabId = region?.dataset?.tabId;
    const tabTop = typeof tabId === "string" ? scrollPositions[normalizeEventManagerTab(tabId)] : null;
    if (saved && Number.isFinite(saved.top)) region.scrollTop = saved.top;
    else if (Number.isFinite(tabTop)) region.scrollTop = tabTop;
    if (saved && Number.isFinite(saved.left)) region.scrollLeft = saved.left;
  }
  const stationId = state?.stationId;
  if (stationId) {
    const escape = (value) => globalThis.CSS?.escape?.(value) ?? String(value).replace(/(["\\])/g, "\\$1");
    const station = root.querySelector?.(`[data-station-id="${escape(stationId)}"]`);
    const selector = state?.controlId ? `[data-control-id="${escape(state.controlId)}"]` : state?.actionId ? `[data-action-id="${escape(state.actionId)}"]` : null;
    const target = selector ? station?.querySelector?.(selector) : null;
    const activeElement = root.ownerDocument?.activeElement;
    const body = root.ownerDocument?.body;
    const focusMayRestore = !activeElement || activeElement === body || activeElement === root;
    if (target && focusMayRestore) target.focus?.({ preventScroll: true });
  }
  return activeTab;
}
async function confirmPlanUnlock() {
  const content = "<p>Unlock this plan for correction?</p><p>Existing crew selections and station order will be preserved.</p>";
  const dialogV2 = foundry.applications.api.DialogV2;
  if (typeof dialogV2?.confirm === "function") return dialogV2.confirm({ window: { title: "Unlock Plan" }, content, rejectClose: false });
  if (typeof globalThis.Dialog?.confirm === "function") return globalThis.Dialog.confirm({ title: "Unlock Plan", content, defaultYes: false });
  return globalThis.confirm?.("Unlock this plan for correction? Existing crew selections and station order will be preserved.") === true;
}

function riskBidEffectText(effect) {
  if (effect?.effectKind === "roll-bonus") return `+${effect.value} to the next unresolved station roll this round`;
  if (effect?.effectKind === "degree-shift") return `Improve the next result by ${effect.value} degree`;
  return "Authored Risk Bid effect";
}

export function readVoyageActorStatisticModifier(actor, statisticSlugOrAbilityId) {
  if (!actor || typeof statisticSlugOrAbilityId !== "string" || statisticSlugOrAbilityId.length === 0) return null;
  try {
    const candidates = statisticSlugOrAbilityId === "perception"
      ? [actor.perception?.mod, actor.perception?.modifier, actor.perception?.value, actor.skills?.perception?.mod, actor.system?.skills?.perception?.mod, actor.system?.attributes?.perception?.mod, actor.system?.attributes?.perception?.modifier, actor.system?.attributes?.perception?.value, actor.system?.attributes?.perception?.totalModifier, actor.system?.perception?.mod, actor.system?.perception?.modifier, actor.system?.perception?.value]
      : [actor.skills?.[statisticSlugOrAbilityId]?.mod, actor.system?.skills?.[statisticSlugOrAbilityId]?.mod, actor.system?.skills?.[statisticSlugOrAbilityId]?.modifier];
    const value = candidates.find((candidate) => Number.isSafeInteger(candidate));
    return Number.isSafeInteger(value) ? value : null;
  } catch {
    return null;
  }
}

export function formatVoyageStatisticLabel(statisticSlugOrAbilityId) {
  if (typeof statisticSlugOrAbilityId !== "string" || statisticSlugOrAbilityId.length === 0) return "Statistic";
  return statisticSlugOrAbilityId.replace(/[-_]+/g, " ").replace(/(^|\s)(\w)/g, (_match, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

export function buildEventManagerProgressSegments({ sessionState = null, lifecycleState = null, phase = null, completed = false, allStationsLocked = false, planningWorkspace = "crew" } = {}) {
  const segments = [
    ["situation", "SITUATION"],
    ["crew-plan", "CREW PLAN"],
    ["order", "ORDER"],
    ["plan-review", "PLAN REVIEW"],
    ["resolution", "RESOLUTION"],
    ["round-outcome", "ROUND OUTCOME"]
  ];
  let currentId = "situation";
  if (sessionState === "crew-planning" || phase === "crew-planning") currentId = allStationsLocked ? (planningWorkspace === "review" ? "plan-review" : planningWorkspace === "order" ? "order" : "crew-plan") : "crew-plan";
  else if (sessionState === "plan-locked" || phase === "lock-readiness") currentId = "plan-review";
  else if (sessionState === "station-resolution" || phase === "resolution") currentId = completed ? "round-outcome" : "resolution";
  else if (completed || lifecycleState === "completed-success" || lifecycleState === "completed-failure") currentId = "round-outcome";
  const currentIndex = segments.findIndex(([id]) => id === currentId);
  return segments.map(([id, label], index) => ({ id, label, active: index === currentIndex, complete: index < currentIndex, upcoming: index > currentIndex }));
}

function formatStatusLabel(value) {
  return typeof value === "string" && value.length > 0
    ? value.replace(/[-_]+/g, " ").replace(/(^|\s)(\w)/g, (_match, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
    : "Unknown";
}

export function buildEventManagerStatusRail(dashboard = null) {
  const pressureSource = Array.isArray(dashboard?.pressureSystems) ? dashboard.pressureSystems : Object.values(dashboard?.pressureSystems ?? {});
  const pressureById = new Map(pressureSource.map((entry) => [entry?.pressureSystemId, entry]));
  const pressureRows = M12_STATION_IDS.map((stationId) => {
    const pressureSystemId = VOYAGE_PRESSURE_SYSTEM_BY_STATION_ID[stationId] ?? null;
    const system = pressureById.get(pressureSystemId) ?? {};
    const presentation = stationPresentation(stationId);
    const capacity = Number.isSafeInteger(system.capacity) && system.capacity >= 0 && system.capacity <= VOYAGE_PRESSURE_MAX_CAPACITY ? system.capacity : VOYAGE_PRESSURE_DEFAULT_CAPACITY;
    const value = Number.isSafeInteger(system.value) ? Math.max(0, Math.min(system.value, capacity)) : 0;
    const atCapacity = capacity > 0 && value >= capacity;
    const gaugeSegments = Array.from({ length: capacity }, (_unused, index) => ({ filled: index < value }));
    const pressureState = value === 0 ? "SAFE" : atCapacity ? "AT CAPACITY" : "STRAINED";
    return { stationId, ...presentation, pressureSystemId, pressureLabel: formatStatusLabel(pressureSystemId), value, capacity, gaugeSegments, pressureState, atCapacity, danger: false, pressureDetail: value === 0 ? "No immediate breach risk." : atCapacity ? "The next Pressure gain may trigger a Pressure Breach." : "Pressure accumulated." };
  });
  const hazards = Array.isArray(dashboard?.activeHazards) ? dashboard.activeHazards.map((hazard) => ({
    hazardId: hazard?.hazardId ?? '',
    name: hazard?.name ?? hazard?.label ?? hazard?.hazardId ?? 'Active Hazard',
    timing: hazard?.timing ?? hazard?.activationTiming ?? 'Active',
    status: hazard?.status ?? hazard?.disposition ?? 'ACTIVE',
    affectedArea: hazard?.pressureSystemName ?? hazard?.pressureSystemId ?? hazard?.eventArea ?? 'Event area unavailable',
    effect: hazard?.description ?? hazard?.effect ?? 'Effect unavailable',
    removalMethod: hazard?.removalMethod ?? hazard?.resolution ?? 'GM review',
    ignoredConsequence: hazard?.ignoredConsequence ?? hazard?.consequence ?? 'Not specified',
    createdRound: Number.isSafeInteger(hazard?.createdRound) ? hazard.createdRound : (Number.isSafeInteger(hazard?.roundNumber) ? hazard.roundNumber : "\u2014"),
    provenance: hazard?.sourceLabel ?? hazard?.provenanceLabel ?? '',
    iconPath: EVENT_MANAGER_UI_ICON_PATHS.hazard,
    iconTitle: 'Hazard'
  })) : [];
  const momentumValue = Number.isSafeInteger(dashboard?.momentum) ? dashboard.momentum : 0;
  return { momentum: { value: momentumValue, overlayText: `+${momentumValue}`, capacity: 3, iconPath: EVENT_MANAGER_UI_ICON_PATHS.momentum, iconTitle: "Momentum", iconSize: 64 }, hazards: hazards.map((hazard) => ({ ...hazard, overlayText: String(hazards.length), iconSize: 64 })), hazardCount: hazards.length, hazardOverlayText: String(hazards.length), hazardIconPath: EVENT_MANAGER_UI_ICON_PATHS.hazard, hazardIconTitle: "Hazard", hazardIconSize: 64, pressureRows, hasHazards: hazards.length > 0 };
}
function focusPoolForStation(planning, stationId, operator) {
  const operatorId = operator?.uuid ?? operator?.id ?? null;
  const pool = (planning?.focusPools ?? []).find((entry) => entry?.stationId === stationId && [entry?.operatorId, entry?.operatorUuid].includes(operatorId));
  if (pool) return pool;
  const stationPools = (planning?.focusPools ?? []).filter((entry) => entry?.stationId === stationId);
  return stationPools.length === 1 ? stationPools[0] : null;
}

export function buildPlanningStations(planning, locked = false, expandedStationId = null, actorList = []) {
  const assignments = new Map((planning?.stationAssignments ?? []).map((entry) => [entry.stationId, entry]));
  const actorsByIdentity = new Map((Array.isArray(actorList) ? actorList : []).flatMap((actor) => [[actor?.id, actor], [actor?.uuid, actor]].filter(([key]) => typeof key === "string" && key.length > 0)));
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
      approaches: (action.approaches ?? []).map((approach) => {
        const modifier = readVoyageActorStatisticModifier(actorsByIdentity.get(assignments.get(station.stationId)?.operator?.uuid ?? assignments.get(station.stationId)?.operator?.id), approach.statisticSlugOrAbilityId);
        return { ...approach, selected: selection?.approachId === approach.approachId, modifier, modifierLabel: modifier === null ? "Modifier unavailable" : `${modifier >= 0 ? "+" : ""}${modifier}` };
      }),
      riskBidOptions: (action.riskBidOptions ?? []).map((option) => ({
        ...option,
        selected: planning.riskBids?.[station.stationId]?.riskBidId === option.riskBidId,
        displayName: action.riskBidPresentation?.[String(option.dcAdjustment)]?.label ?? `+${option.dcAdjustment} Risk Bid`,
        heroicRiskLabel: `Risk +${option.dcAdjustment}`,
        heroicBenefitLabel: "Heroic Benefit",
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
    const assignment = assignments.get(station.stationId);
    const operator = assignment?.operator ?? null;
    const selectedApproach = selectedAction?.approaches?.find((approach) => approach.selected) ?? null;
    const focusPool = focusPoolForStation(planning, station.stationId, operator);
    const focusAbilities = (planning?.focusAbilities ?? []).filter((ability) => ability?.stationId === station.stationId).map((ability) => ({ ...ability, resource: resourcePresentation("focus") }));
    const selectedRiskBid = selectedAction?.riskBidOptions.find((option) => option.selected) ?? null;
    const hasAction = Boolean(selection?.actionId);
    const hasApproach = Boolean(selection?.approachId);
    const stationLocked = locked || (Array.isArray(planning?.stationLocks) && planning.stationLocks.includes(station.stationId));
    const planState = stationLocked ? "locked" : !hasAction ? "incomplete" : !hasApproach ? "approach-required" : "ready";
    return {
      stationId: station.stationId,
      ...stationPresentation(station.stationId),
      label: stationPresentation(station.stationId).stationDisplayName,
      operator,
      actions: actionOptions,
      selectedActionId: selection?.actionId ?? "",
      selectedApproachId: selection?.approachId ?? "",
      selectedRiskBidId: planning.riskBids?.[station.stationId]?.riskBidId ?? "",
      approaches: (selectedAction?.approaches ?? []).map((approach) => ({ ...approach, selected: selection?.approachId === approach.approachId })),
      riskBidOptions: (selectedAction?.riskBidOptions ?? []).map((option) => ({ ...option, selected: planning.riskBids?.[station.stationId]?.riskBidId === option.riskBidId })),
      selectedActionName: selectedAction?.displayName ?? selectedAction?.actionId ?? "No action",
      selectedActionDescription: selectedAction?.displayDescription ?? "",
      selectedActionBaseDc: selectedAction?.baseDc ?? null,
      selectedApproachModifier: selectedApproach?.modifier ?? null,
      selectedApproachModifierLabel: selectedApproach?.modifier === null || selectedApproach?.modifier === undefined ? "Modifier unavailable" : `${selectedApproach.modifier >= 0 ? "+" : ""}${selectedApproach.modifier}`,
      focusCurrent: Number.isSafeInteger(focusPool?.current) ? focusPool.current : null,
      focusCapacity: Number.isSafeInteger(focusPool?.capacity) ? focusPool.capacity : null,
      focusLabel: Number.isSafeInteger(focusPool?.current) && Number.isSafeInteger(focusPool?.capacity) ? `Focus ${focusPool.current} / ${focusPool.capacity}` : "Focus unavailable",
      focusAbilities,
      focusResource: resourcePresentation("focus"),
      stationLocked,
      canLockStation: !stationLocked && hasAction && hasApproach,
      canUnlockStation: stationLocked && !locked,
      selectedActionHasRiskBids: Boolean(selectedAction?.riskBidOptions?.length),
      selectedRiskBidAvailableResource: selectedAction?.riskBidOptions?.length ? resourcePresentation("riskBid") : null,
      selectedRiskBidResource: selectedRiskBid?.resource ?? null,
      selectedRiskBidFinalDc: selectedRiskBid?.finalDc ?? null,
      selectedHeroicActionLabel: selectedRiskBid ? "HEROIC ACTION" : "BASE ACTION",
      selectedRiskLabel: selectedRiskBid ? `Risk +${selectedRiskBid.dcAdjustment}` : null,
      selectedHeroicBenefitLabel: selectedRiskBid ? "Heroic Benefit" : null,
      expanded: !stationLocked && (!hasAction || !hasApproach || expandedStationId === station.stationId),
      compactSummary: {
        actionName: selectedAction?.displayName ?? "No action",
        approachName: selectedAction?.approaches?.find((approach) => approach.selected)?.name ?? selection?.approachId ?? "No approach",
        riskBidName: selectedRiskBid?.displayName ?? "NO BID"
      },
      ready: stationLocked || (hasAction && hasApproach),
      planState,
      selectionState: hasAction ? (hasApproach ? "complete" : "action-selected") : "none",
      statusLabel: planState === "locked" ? "LOCKED" : planState === "ready" ? "READY" : planState === "approach-required" ? "APPROACH REQUIRED" : "ACTION REQUIRED",
      statusMessage: planState === "locked" ? (locked ? "Planning is locked." : "Station is locked and ready for order.") : planState === "ready" ? "Ready to lock this station." : planState === "approach-required" ? "Choose how this action is being attempted." : "Choose one of the three authored actions."
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
      heroicActionLabel: "HEROIC ACTION",
      heroicRiskLabel: bid.heroicRiskLabel ?? `Risk +${bid.dcAdjustment}`,
      heroicBenefitLabel: "Heroic Benefit",
      targetStationIds: [...new Set(targets)],
      targetStations: [...new Set(targets)].map((targetStationId) => ({ stationId: targetStationId, ...stationPresentation(targetStationId) })),
      sourceBeforeTarget: [...new Set(targets)].every((targetStationId) => orderIndex.has(station.stationId) && orderIndex.has(targetStationId) && orderIndex.get(station.stationId) < orderIndex.get(targetStationId)),
      targetSummary: [...new Set(targets)].map((targetStationId) => stationPresentation(targetStationId).stationDisplayName).join(", "),
      status: [...new Set(targets)].every((targetStationId) => orderIndex.has(station.stationId) && orderIndex.has(targetStationId) && orderIndex.get(station.stationId) < orderIndex.get(targetStationId)) ? "ORDER VALID \u2014 Heroic Benefit can activate" : "SOURCE MUST RESOLVE BEFORE TARGET \u2014 Heroic Benefit blocked"
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
  const locksRequired = Array.isArray(planning?.stationLocks);
  return Boolean(planning && Array.isArray(planningStations) && planningStations.every((station) => station.ready && (!locksRequired || station.stationLocked))
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

export function buildVoyageStationSelectionPayload(root, element) {
  const stationId = element?.dataset?.stationId;
  if (typeof stationId !== "string" || stationId.length === 0) return null;
  const options = [...(root?.querySelectorAll?.(`[data-m12-action-option="${stationId}"]`) ?? [])];
  const selectedAction = options.find((entry) => entry?.getAttribute?.("aria-selected") === "true" || entry?.classList?.contains?.("is-selected"));
  const actionId = selectedAction?.dataset?.actionId ?? "";
  const defaultApproachId = selectedAction?.dataset?.approachId ?? "";
  const actionChanged = Boolean(element?.dataset?.m12Action);
  const approachControl = root?.querySelector?.(`[data-m12-approach="${stationId}"]`);
  const riskBidControl = root?.querySelector?.(`[data-m12-risk-bid="${stationId}"]`);
  const approachId = actionChanged ? defaultApproachId : (approachControl?.value || defaultApproachId);
  const riskBidId = actionChanged ? null : (riskBidControl?.value || null);
  return { stationId, actionId, approachId, riskBidId };
}
export const EVENT_MANAGER_TAB_IDS = Object.freeze(["event", "plan", "resolve"]);

export function normalizeEventManagerTab(tab) {
  return typeof tab === "string" && EVENT_MANAGER_TAB_IDS.includes(tab) ? tab : "event";
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

export function buildEventManagerRoundCloseoutPresentation({ resolution = null, isGM = false, activeGmUserId = null, userId = null } = {}) {
  const authorized = isGM === true && typeof userId === "string" && userId.length > 0 && userId === activeGmUserId;
  const ready = resolution?.roundCloseoutReady === true && resolution?.completed === true && typeof resolution?.roundId === "string" && resolution.roundId.length > 0;
  return { roundCloseoutReady: authorized && ready };
}

export function buildEventManagerRoundCloseoutCommand({ requestId = null, sessionId = null, expectedRevision = null, authorityEpoch = null, roundId = null } = {}) {
  if (![requestId, sessionId, roundId].every((value) => typeof value === "string" && value.length > 0) || !Number.isSafeInteger(expectedRevision) || !Number.isSafeInteger(authorityEpoch)) return null;
  return { kind: "voyage.m11-command", requestId, sessionId, expectedRevision, authorityEpoch, commandKind: "round-closeout", payload: { roundId } };
}
export function buildVoyagePlanReview(planning, planningStations, order, dependencies = []) {
  const dependencyByStation = new Map((Array.isArray(dependencies) ? dependencies : []).map((entry) => [entry.sourceStationId, entry]));
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
          approachModifierLabel: station?.selectedApproachModifierLabel ?? "Modifier unavailable",
          focusLabel: station?.focusLabel ?? "Focus unavailable",
      riskBidName: riskBid ? (riskBid.displayName ?? `+${riskBid.dcAdjustment}`) : "No Bid",
      heroicActionLabel: riskBid ? "HEROIC ACTION" : "BASE ACTION",
      heroicRiskLabel: riskBid ? `Risk +${riskBid.dcAdjustment}` : null,
      heroicBenefitLabel: riskBid ? "Heroic Benefit" : null,
      riskBidFinalDc: riskBid?.finalDc ?? null,
      selectedRiskBidResource: riskBid?.resource ?? null,
      riskBidTargetStations: riskBid?.targetStations ?? [],
      riskBidPayoffEffects: riskBid?.payoffEffects ?? [],
      riskBidPresentation: riskBid?.presentation ?? null,
      riskBidDependencyStatus: dependencyByStation.get(stationId)?.status ?? null,
      dependencyValid: dependencyByStation.get(stationId)?.sourceBeforeTarget ?? null,
      dependencyTargetSummary: dependencyByStation.get(stationId)?.targetSummary ?? null,
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

export function buildVoyagePlanSummary(planning, planningStations = [], proposedOrder = [], riskBidDependencies = [], planReady = false, planningWorkspace = "crew", allStationsLocked = false, orderReady = false) {
  const stations = Array.isArray(planningStations) ? planningStations : [];
  const order = Array.isArray(proposedOrder) ? proposedOrder : [];
  const readyStations = stations.filter((station) => station?.ready === true).length;
  const blockers = stations.filter((station) => station?.ready !== true).map((station) => `${station?.label ?? station?.stationDisplayName ?? station?.stationId ?? "Station"} \u2014 ${station?.statusMessage ?? "Action required."}`);
  const dependencies = Array.isArray(riskBidDependencies) ? riskBidDependencies : [];
  const heroicActionValidCount = dependencies.filter((dependency) => dependency?.sourceBeforeTarget === true).length;
  if (stations.length > 0 && order.length !== stations.length) blockers.push("Station order incomplete");
  const orderBlockers = [...blockers, ...dependencies.filter((dependency) => dependency?.sourceBeforeTarget !== true).map((dependency) => dependency?.status ?? "Heroic Action order dependency is invalid.")];
  const stationById = new Map(stations.map((station) => [station?.stationId, station]));
  const orderPreview = order.map((stationId, index) => {
    const station = stationById.get(stationId);
    return {
      orderNumber: index + 1,
      stationDisplayName: station?.stationDisplayName ?? station?.label ?? stationPresentation(stationId).stationDisplayName,
      actionName: station?.selectedActionName ?? station?.compactSummary?.actionName ?? "No action"
    };
  });
  const readinessLabel = planReady === true
    ? "READY FOR PLAN LOCK"
    : planningWorkspace === "crew" && allStationsLocked === true
      ? "CREW PLAN COMPLETE \u2014 Ready to set station order"
      : planningWorkspace === "order" && orderReady === true
        ? "ORDER COMPLETE \u2014 Ready for Plan Review"
        : "PLAN INCOMPLETE";
  return {
    readinessLabel,
    planReady: planReady === true,
    stationsReady: readyStations,
    stationTotal: stations.length,
    selectedRiskBids: stations.filter((station) => typeof station?.selectedRiskBidId === "string" && station.selectedRiskBidId.length > 0).length,
    riskBidDependencies: dependencies.length,
    heroicActionCount: dependencies.length,
    heroicActionValidCount,
    orderReady: orderReady === true,
    orderBlockers,
    blockers,
    orderPreview,
    hasBlockers: blockers.length > 0,
    hasOrderPreview: orderPreview.length > 0
  };
}
export class ArcflightHazardInspection extends HandlebarsApplicationMixin(ApplicationV2) {
  #hazards = [];

  static DEFAULT_OPTIONS = {
    id: "arcflight-hazard-inspection",
    classes: ["arcflight", "hazard-inspection"],
    tag: "section",
    position: { width: 560, height: 460 },
    window: { title: "Active Hazards", resizable: true }
  };

  static PARTS = { body: { template: arcflightTemplatePath("voyage/hazard-inspection.hbs") } };

  constructor(hazards = [], options = {}) {
    super(options);
    this.#hazards = Array.isArray(hazards) ? hazards.map((hazard) => ({ ...hazard })) : [];
  }

  async _prepareContext() {
    return { hazards: this.#hazards.map((hazard) => ({ ...hazard })), hasHazards: this.#hazards.length > 0 };
  }
}
export class ArcflightEventManager extends HandlebarsApplicationMixin(ApplicationV2) {
  #expectedRevision = 0;
  #authorityEpoch = 0;
  #mode = "setup";
  #sessionId = null;
  #operatorSelections = Object.fromEntries(M12_STATION_IDS.map((stationId) => [stationId, null]));
  #shipId = "";
  #dragStationId = null;
  #activeTab = "event";
  #tabScrollPositions = Object.create(null);
  #pendingViewState = null;
  #expandedStationId = null;
  #roundCloseoutPending = false;
  #statusRail = null;
  #breachSavePending = null;
  #planningWorkspace = "crew";

  static DEFAULT_OPTIONS = {
    id: "arcflight-event-manager",
    classes: ["arcflight", "event-manager"],
    tag: "section",
    position: { width: 1280, height: 720 },
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
        dashboard = { ...dashboardModel, stationAssignments: (dashboardModel.stationAssignments ?? []).map((assignment) => ({ ...assignment, ...stationPresentation(assignment.stationId), statusLabel: dashboardModel.sessionState === "plan-locked" ? "LOCKED" : dashboardModel.sessionState === "station-resolution" ? "RESOLVING" : "ASSIGNED" })), shipName: allActors.find((actor) => actor.id === this.#shipId)?.name ?? this.#shipId ?? "" };
        planning = game.arcflight?.readVoyageEventSessionPlanning?.(this.#sessionId) ?? null;
        resolution = game.arcflight?.readVoyageEventSessionResolution?.(this.#sessionId) ?? readVoyageEventSessionResolution(this.#sessionId, eventContext());
        if (planning?.ok) this.#authorityEpoch = planning.projection.authorityEpoch;
      }
    }
    const operatorActors = allActors.filter((actor) => actor?.type !== "vehicle").map((actor) => ({ id: actor.id, name: actor.name ?? actor.id }));
    const normalized = normalizeVoyageEventOperatorSelections(this.#operatorSelections, allActors);
    const planningProjection = planning?.ok ? planning.projection : null;
    if (dashboard && planningProjection) {
      const locks = Array.isArray(planningProjection.stationLocks) ? new Set(planningProjection.stationLocks) : null;
      dashboard.stationAssignments = (dashboard.stationAssignments ?? []).map((assignment) => ({ ...assignment, statusLabel: planningProjection.sessionState === "station-resolution" ? "RESOLVING" : planningProjection.sessionState === "plan-locked" ? "LOCKED" : locks?.has(assignment.stationId) ? "LOCKED" : planningProjection.selections?.[assignment.stationId]?.actionId ? "EDITING" : "ASSIGNED" }));
    }
    const planLocked = planningProjection?.sessionState === "plan-locked" || planningProjection?.sessionState === "station-resolution";
    const planUnlockAvailable = Boolean(this.#mode === "live" && planLocked && planningProjection?.sessionState === "plan-locked" && game.user?.isGM === true && activeGmId() === game.user?.id);
    const currentRoundNumber = resolution?.projection?.roundNumber ?? planningProjection?.roundNumber ?? dashboard?.roundNumber;
    const currentRound = dashboard ? { roundId: dashboard.roundId, roundNumber: dashboard.roundNumber, title: dashboard.roundTitle, vignette: dashboard.vignette, situation: dashboard.situation, objective: dashboard.objective, knownStakes: dashboard.knownStakes } : null;
    const currentRoundDefinition = (() => { try { return getM12EventDefinition(dashboard?.eventId, dashboard?.definitionSnapshotId)?.rounds?.find((round) => round.roundNumber === currentRoundNumber) ?? null; } catch { return null; } })();
    const roundIntroduction = dashboard?.sessionState === "round-introduction";
    if (roundIntroduction) this.#activeTab = "event";
    const planningStationsRaw = planningProjection && !roundIntroduction ? buildPlanningStations(planningProjection, planLocked, this.#expandedStationId, allActors) : [];
    const selectedPlanStationId = this.#expandedStationId && planningStationsRaw.some((station) => station.stationId === this.#expandedStationId) ? this.#expandedStationId : planningStationsRaw.find((station) => station.ready)?.stationId ?? planningStationsRaw[0]?.stationId ?? null;
    let planningStations = planningStationsRaw.map((station) => ({ ...station, active: station.stationId === selectedPlanStationId }));
    const allStationsLocked = Array.isArray(planningProjection?.stationLocks) && planningProjection.stationLocks.length === planningStations.length && planningStations.length > 0;
    const planningWorkspace = allStationsLocked ? this.#planningWorkspace : "crew";
    const proposedOrder = planningProjection ? buildVoyagePlanningOrder(planningProjection) : [];
    const occupiedStationCount = Array.isArray(planningProjection?.stationAssignments) ? planningProjection.stationAssignments.length : 0;
    const orderShapeReady = allStationsLocked && ["order", "review"].includes(planningWorkspace) && proposedOrder.length === occupiedStationCount && proposedOrder.every((stationId) => planningStations.some((station) => station.stationId === stationId));
    const completeOrderReady = orderShapeReady && isVoyagePlanReady(planningProjection, planningStations, proposedOrder);
    const riskBidDependencies = buildVoyageRiskBidDependencies(planningStations, proposedOrder);
    const orderReady = completeOrderReady && riskBidDependencies.every((dependency) => dependency?.sourceBeforeTarget === true);
    const planReady = planningWorkspace === "review" && orderReady;
    const dependencyBySource = new Map(riskBidDependencies.map((dependency) => [dependency.sourceStationId, dependency]));
    planningStations = planningStations.map((station) => {
      const dependency = dependencyBySource.get(station.stationId);
      return { ...station, heroicActionLabel: station.selectedRiskBidId ? "HEROIC ACTION" : "BASE ACTION", heroicRiskLabel: station.selectedRiskLabel, heroicBenefitLabel: station.selectedHeroicBenefitLabel, dependencyStatus: dependency?.status ?? null, dependencyValid: dependency?.sourceBeforeTarget ?? null, dependencyTargetSummary: dependency?.targetSummary ?? null };
    });
    const planReview = buildVoyagePlanReview(planningProjection, planningStations, proposedOrder, riskBidDependencies);
    const planSummary = buildVoyagePlanSummary(planningProjection, planningStations, proposedOrder, riskBidDependencies, planReady, planningWorkspace, allStationsLocked, orderReady);
    const authoredStations = new Map((currentRoundDefinition?.availableStations ?? []).map((entry) => [entry.stationId, entry]));
    let resolutionProjection = resolution?.ok ? {
      ...resolution.projection,
      stations: (resolution.projection.stations ?? []).map((station) => {
        const authoredStation = authoredStations.get(station.stationId);
        const authoredAction = authoredStation?.actions?.find((action) => action.actionId === station.actionId);
        const authoredApproach = authoredAction?.approaches?.find((approach) => approach.approachId === station.approachId);
        const operator = station.operator ? { ...station.operator } : null;
        const actor = allActors.find((candidate) => [candidate?.id, candidate?.uuid].includes(operator?.uuid ?? operator?.id));
        const focusPool = (resolution.projection.focusPools ?? planningProjection?.focusPools ?? []).find((pool) => pool?.stationId === station.stationId && [pool?.operatorId, pool?.operatorUuid].includes(operator?.uuid ?? operator?.id)) ?? null;
        return {
          ...station,
          ...stationPresentation(station.stationId),
          operator,
          actionName: authoredAction?.name ?? station.actionId ?? "Selected action",
          actionDescription: authoredAction?.description ?? "",
          approachName: authoredApproach?.name ?? station.approachId ?? "Selected approach",
          statisticLabel: formatVoyageStatisticLabel(station.statisticSlugOrAbilityId ?? authoredApproach?.statisticSlugOrAbilityId),
          skillModifier: readVoyageActorStatisticModifier(actor, station.statisticSlugOrAbilityId ?? authoredApproach?.statisticSlugOrAbilityId),
          skillModifierLabel: (() => { const modifier = readVoyageActorStatisticModifier(actor, station.statisticSlugOrAbilityId ?? authoredApproach?.statisticSlugOrAbilityId); return modifier === null ? "Modifier unavailable" : `${modifier >= 0 ? "+" : ""}${modifier}`; })(),
          focusLabel: Number.isSafeInteger(focusPool?.current) && Number.isSafeInteger(focusPool?.capacity) ? `Focus ${focusPool.current} / ${focusPool.capacity}` : "Focus unavailable",
          riskBidEffects: (station.riskBidEffects ?? []).map((effect) => ({
            ...effect,
            sourceStation: stationPresentation(effect.sourceStationId),
            targetStation: stationPresentation(effect.targetStationId),
            effectText: riskBidEffectText({ effectKind: effect.effectKind, value: effect.effectValue }),
            consumptionLabel: effect.consumptionTiming === "on-target-resolution" ? "Consumed when target resolves" : "Consumed at this station's resolution"
          }))
        };
      }),
      reactionWindowPending: (resolution.projection.reactionWindowPending ?? []).map((entry) => ({ ...entry, focusResource: resourcePresentation("focus"), focusAbility: entry.focusAbility ? { ...entry.focusAbility, sourceStation: stationPresentation(entry.focusAbility.sourceStationId), targetStation: stationPresentation(entry.focusAbility.targetStationId) } : null }))
    } : null;
    const resolutionPresentation = buildEventManagerResolutionPresentation({ planLocked, resolutionPhase: resolutionProjection?.phase ?? null });
    const roundCloseoutPresentation = buildEventManagerRoundCloseoutPresentation({ resolution: resolutionProjection, isGM: game.user?.isGM === true, activeGmUserId: activeGmId(), userId: game.user?.id ?? null });
    const pendingBreachSave = resolutionProjection?.pendingBreachSave ?? null;
    this.#breachSavePending = pendingBreachSave;
    const progressSegments = buildEventManagerProgressSegments({ sessionState: dashboard?.sessionState ?? planningProjection?.sessionState, lifecycleState: dashboard?.lifecycleState, phase: resolutionProjection?.phase ?? planningProjection?.phase ?? dashboard?.phase, completed: resolutionProjection?.completed === true, allStationsLocked, planningWorkspace });
    const statusRail = buildEventManagerStatusRail(dashboard);
    this.#statusRail = statusRail;
    const resolutionStations = resolutionProjection?.stations ?? [];
    const currentResolutionIndex = resolutionStations.findIndex((station) => station.current === true);
    if (resolutionProjection) resolutionProjection = { ...resolutionProjection, stations: resolutionStations.map((station, index) => ({ ...station, resolutionBucket: station.result ? "previous" : station.current ? "current" : (currentResolutionIndex >= 0 && index > currentResolutionIndex ? "upcoming" : "previous") })) };
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
      planningWorkspace,
      allStationsLocked,
      orderReady,
      planningCrewWorkspace: planningWorkspace === "crew",
      planningOrderWorkspace: planningWorkspace === "order",
      planningReviewWorkspace: planningWorkspace === "review",
      resolution: resolutionProjection,
      pendingBreachSave,
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
          stationThemeClass: station?.stationThemeClass ?? stationPresentation(stationId).stationThemeClass,
          stationIconPath: station?.stationIconPath ?? stationPresentation(stationId).stationIconPath,
          stationOrderIconSize: 56,
          focusLabel: station?.focusLabel ?? "Focus unavailable",
          approachModifierLabel: station?.selectedApproachModifierLabel ?? "Modifier unavailable",
          stationOrderIconTitle: station?.stationIconTitle ?? stationPresentation(stationId).stationIconTitle,
          operatorName: station?.operator?.name ?? "Unassigned",
          actionName: action?.displayName ?? action?.name ?? action?.label ?? action?.actionId ?? "No action",
          approachName: station?.approaches?.find((entry) => entry.selected)?.name ?? (station?.selectedApproachId || "No approach"),
          approachModifierLabel: station?.selectedApproachModifierLabel ?? "Modifier unavailable",
          focusLabel: station?.focusLabel ?? "Focus unavailable",
          riskBidName: riskBid ? (riskBid.displayName ?? `+${riskBid.dcAdjustment}`) : "No Bid",
          heroicActionLabel: riskBid ? "HEROIC ACTION" : "BASE ACTION",
          heroicRiskLabel: riskBid ? `Risk +${riskBid.dcAdjustment}` : null,
          heroicBenefitLabel: riskBid ? "Heroic Benefit" : null,
          riskBidAdjustment: riskBid?.dcAdjustment ?? null,
          riskBidFinalDc: riskBid?.finalDc ?? null,
          selectedRiskBidResource: riskBid ? resourcePresentation("riskBid", riskBid.dcAdjustment) : null,
          riskBidAvailableResource: !riskBid && station?.actions?.find((entry) => entry.actionId === station.selectedActionId)?.riskBidCapable ? resourcePresentation("riskBid") : null,
          dependencyStatus: station?.dependencyStatus ?? null,
          dependencyValid: station?.dependencyValid ?? null,
          dependencyTargetSummary: station?.dependencyTargetSummary ?? null,
           orderIconPath: EVENT_MANAGER_UI_ICON_PATHS.order,
           orderLinkIconPath: EVENT_MANAGER_UI_ICON_PATHS.orderLink,
          canMoveUp: index > 0,
          canMoveDown: index < proposedOrder.length - 1
        };
      }) : [],
      planReviewRows: planReview.rows,
      planSummary,
      incompleteStations: planReview.incompleteStations,
      activeTab: this.#activeTab,
      activeGmUserId: activeGmId(),
      isGm: game.user?.isGM === true && activeGmId() === game.user?.id,
      activeGmDisplayName: activeGmDisplayName(),
      progressSegments,
      currentRoundLabel: currentRound ? `Round ${currentRound.roundNumber} \u2014 ${currentRound.title}` : (currentRoundNumber ? `Round ${currentRoundNumber}` : ""),
      tabIds: EVENT_MANAGER_TAB_IDS,
      selectedPlanStationId,
      statusRail,
      planReady,
      planLocked,
      planUnlockAvailable,
      abandoned: planningProjection?.sessionState === "aborted",
      abandonEnabled: Boolean(dashboard && !["completed", "aborted"].includes(dashboard.sessionState)),
      ...resolutionPresentation,
      ...roundCloseoutPresentation,
      resolutionReadyToStart: resolutionPresentation.readyToStart,
      resolutionRollAvailable: resolutionPresentation.rollAvailable,
      roundIntroduction,
      roundNarrative: currentRound,
      beginCrewPlanningAvailable: roundIntroduction && this.#mode === "live" && game.user?.isGM === true && activeGmId() === game.user?.id
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
    this.element.querySelectorAll("[data-m12-ship]").forEach((input) => input.addEventListener("change", (event) => { this.#captureViewState(); this.#shipId = event.currentTarget.value; this.render(); }));
    this.element.querySelectorAll("[data-m12-operator]").forEach((input) => input.addEventListener("change", (event) => { this.#captureViewState(); this.#operatorSelections[event.currentTarget.dataset.m12Operator] = event.currentTarget.value || null; this.render(); }));
    this.element.querySelector("[data-m12-launch]")?.addEventListener("click", () => this.#launch());
    this.element.querySelector("[data-m12-refresh]")?.addEventListener("click", () => { this.#pendingViewState = this.#captureViewState(); this.render(); });
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
    this.element.querySelectorAll("[data-m12-station-lock]").forEach((button) => button.addEventListener("click", (event) => this.#dispatchPlanning("station-lock", { stationId: event.currentTarget.dataset.stationId })));
    this.element.querySelectorAll("[data-m12-station-unlock]").forEach((button) => button.addEventListener("click", (event) => this.#dispatchPlanning("station-unlock", { stationId: event.currentTarget.dataset.stationId })));
    this.element.querySelectorAll("[data-m12-planning-workspace]").forEach((button) => button.addEventListener("click", (event) => { this.#planningWorkspace = event.currentTarget.dataset.m12PlanningWorkspace; this.#captureViewState(); this.render(); }));
    this.element.querySelectorAll("[data-m12-clear-selection]").forEach((element) => element.addEventListener("click", (event) => {
      const command = buildVoyageStationSelectionClearCommand(event.currentTarget.dataset.stationId);
      if (command) this.#dispatchPlanning(command.commandKind, command.payload);
    }));
    this.element.querySelectorAll("[data-m12-plan-station]").forEach((button) => button.addEventListener("click", (event) => { this.#expandedStationId = event.currentTarget.dataset.stationId; this.#navigateToTab("plan"); this.render(); }));
    this.element.querySelectorAll("[data-m12-edit-station]").forEach((button) => button.addEventListener("click", (event) => {
      this.#pendingViewState = this.#captureViewState();
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
    this.element.querySelector("[data-m12-begin-crew-planning]")?.addEventListener("click", () => this.#dispatchPlanning("begin-crew-planning", { phaseStartSnapshotId: randomId("m12-crew-planning") }));
    this.element.querySelector("[data-m12-plan-lock]")?.addEventListener("click", () => this.#dispatchPlanning("plan-lock", { phaseStartSnapshotId: randomId("m12-plan-lock") }));
    this.element.querySelector("[data-m12-plan-unlock]")?.addEventListener("click", () => this.#unlockPlan());
    this.element.querySelector("[data-m12-go-resolution]")?.addEventListener("click", () => this.#navigateToTab("resolve"));
    this.element.querySelector("[data-m12-resolution-start]")?.addEventListener("click", () => this.#beginResolution());
    this.element.querySelector("[data-m12-round-closeout]")?.addEventListener("click", () => this.#closeRound());
    this.element.querySelector("[data-m12-breach-save-roll]")?.addEventListener("click", () => this.#rollBreachSave());
    this.element.querySelector("[data-m12-breach-save-roll]")?.addEventListener("click", () => this.#rollBreachSave());
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
    this.#pendingViewState = { ...viewState, activeTab: this.#activeTab };
    this.#applyTabState();
  }

  #captureViewState() {
    const state = captureEventManagerViewState(this.element, this.#activeTab, this.#tabScrollPositions);
    this.#tabScrollPositions = state.scrollPositions;
    this.#pendingViewState = state;
    return state;
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
    this.#activeTab = restoreEventManagerViewState(this.element, state, this.#activeTab);
    if (state?.scrollPositions) this.#tabScrollPositions = { ...state.scrollPositions };
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
    const payload = buildVoyageStationSelectionPayload(this.element, element);
    if (payload) this.#dispatchPlanning("station-selection", payload);
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

  async #unlockPlan() {
    if (this.#mode !== "live" || !this.#sessionId) return;
    const confirmed = await confirmPlanUnlock();
    if (!confirmed) return;
    const viewState = this.#captureViewState();
    const result = await game.arcflight?.correctVoyageEventSession?.({ kind: "voyage.m11-correct-session", requestId: randomId("m12-plan-unlock"), sessionId: this.#sessionId, expectedRevision: this.#expectedRevision, authorityEpoch: this.#authorityEpoch, correctionKind: "plan-unlock", targetRequestId: null, targetCheckpointId: null, replacementPayload: {}, reason: "GM unlocked plan for correction", confirmation: true });
    if (!result?.ok) {
      ui.notifications?.error?.(result?.errors?.[0]?.message ?? "The plan unlock was rejected.");
      this.#pendingViewState = viewState;
      this.render();
      return result;
    }
    const reread = reloadVoyageEventSession(this.#sessionId, eventContext());
    if (!reread.ok) {
      ui.notifications?.error?.("The plan unlock was persisted but could not be verified.");
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

  async #focusReaction(commandKind, reactionId = null) {
    const viewState = this.#captureViewState();
    reactionId ??= this.element.querySelector("[data-m12-focus-use], [data-m12-focus-pass]")?.dataset?.reactionId;
    if (!reactionId) return null;
    const result = await game.arcflight?.dispatchVoyageEventSessionCommand?.({ kind: "voyage.m11-command", requestId: randomId("m12-focus"), sessionId: this.#sessionId, expectedRevision: this.#expectedRevision, authorityEpoch: this.#authorityEpoch, commandKind, payload: { reactionId } });
    if (!result?.ok) ui.notifications?.error?.(result?.errors?.[0]?.message ?? "Focus reaction was rejected.");
    const reread = reloadVoyageEventSession(this.#sessionId, eventContext());
    if (reread.ok) { this.#expectedRevision = reread.revision; this.#authorityEpoch = reread.authorityEpoch; this.#pendingViewState = viewState; this.render(); }
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

  async #rollBreachSave() {
    if (!this.#sessionId || game.user?.isGM !== true || activeGmId() !== game.user.id || !this.#breachSavePending?.saveId) return null;
    const command = { kind: "voyage.m11-command", requestId: randomId("m12-breach-save"), sessionId: this.#sessionId, expectedRevision: this.#expectedRevision, authorityEpoch: this.#authorityEpoch, commandKind: "breach-save-roll", payload: { saveId: this.#breachSavePending.saveId } };
    const dispatch = game.arcflight?.dispatchVoyageEventSessionCommand;
    if (typeof dispatch !== "function") return ui.notifications?.error?.("Breach Save transport is unavailable.");
    const viewState = this.#captureViewState();
    const result = await dispatch(command);
    if (!result?.ok) ui.notifications?.error?.(result?.errors?.[0]?.message ?? "Breach Save was rejected.");
    const reread = reloadVoyageEventSession(this.#sessionId, eventContext());
    if (reread?.ok) { this.#expectedRevision = reread.revision; this.#authorityEpoch = reread.authorityEpoch; }
    this.#pendingViewState = viewState;
    this.render();
    return result;
  }

  async #closeRound() {
    if (this.#roundCloseoutPending || this.#mode !== "live" || !this.#sessionId || game.user?.isGM !== true || activeGmId() !== game.user.id) return null;
    const button = this.element.querySelector("[data-m12-round-closeout]");
    const roundId = button?.dataset?.roundId ?? null;
    const command = buildEventManagerRoundCloseoutCommand({ requestId: randomId("m12-round-closeout"), sessionId: this.#sessionId, expectedRevision: this.#expectedRevision, authorityEpoch: this.#authorityEpoch, roundId });
    if (!command) return ui.notifications?.error?.("Round closeout is not ready.");
    const dispatch = game.arcflight?.dispatchVoyageEventSessionCommand;
    if (typeof dispatch !== "function") return ui.notifications?.error?.("Round closeout transport is unavailable.");
    const viewState = this.#captureViewState();
    this.#roundCloseoutPending = true;
    try {
      const result = await dispatch(command);
      const reread = this.#sessionId ? reloadVoyageEventSession(this.#sessionId, eventContext()) : null;
      if (reread?.ok) {
        this.#expectedRevision = reread.revision;
        this.#authorityEpoch = reread.authorityEpoch;
      }
      if (!result?.ok) {
        ui.notifications?.error?.(result?.errors?.[0]?.message ?? "Round closeout was rejected.");
        this.#pendingViewState = viewState;
        this.render();
        return result;
      }
      if (!reread?.ok) {
        ui.notifications?.error?.("Round closeout was persisted but could not be verified.");
        this.#pendingViewState = viewState;
        this.render();
        return reread;
      }
      this.#pendingViewState = viewState;
      this.render();
      return result;
    } finally {
      this.#roundCloseoutPending = false;
    }
  }
  async #abandonEvent() {
    if (!globalThis.confirm?.("Abandon this Event Session? It will remain in history and allow a new event to be launched.")) return null;
    const viewState = this.#captureViewState();
    const result = await game.arcflight?.abortVoyageEventSession?.({ kind: "voyage.m11-abort-session", requestId: randomId("m12-abandon"), sessionId: this.#sessionId, expectedRevision: this.#expectedRevision, authorityEpoch: this.#authorityEpoch, reason: "GM abandoned Event Session", confirmation: true });
    if (!result?.ok) {
      ui.notifications?.error?.(result?.errors?.[0]?.message ?? "The Event Session could not be abandoned.");
      this.#pendingViewState = viewState;
      this.render();
      return result;
    }
    const reread = reloadVoyageEventSession(this.#sessionId, eventContext());
    if (!reread.ok) {
      ui.notifications?.error?.("The Event Session was abandoned but could not be reread.");
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