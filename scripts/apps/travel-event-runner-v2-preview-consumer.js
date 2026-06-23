import { prepareTravelEventRunnerStateWithTravelV2Preview } from "../helpers/travel-event-runner-v2-preview.js";
import { prepareTravelEventEffectApplicationState } from "../helpers/travel-event-runner.js";
import { prepareTravelEventRunnerV2PreviewPanelState } from "./travel-event-runner-v2-preview-panel.js";
import { prepareTravelV2CompletedSessionHistoryState } from "../helpers/travel-v2-dev-tools.js";

export const TRAVEL_EVENT_RUNNER_V2_PREVIEW_CONSUMER_VERSION = 2;

function guidedQueueButtons(action, { canApply = false, canSend = false } = {}) {
  const buttons = [];
  const reviewActions = new Set(["stations", "reactions", "hazards", "ship-scars", "followups", "devtools", "completed"]);
  if (action === "start") buttons.push({ label: "Open Details", action: "start" });
  else if (action === "round-review") buttons.push({ label: "Review Round Pressure", action: "round-review" }, { label: "Apply Suggested Pressure", action: "round-apply" }, { label: "Open Details", action: "round-details" });
  else if (action === "advance-round") buttons.push({ label: "Advance to Next Round", action: "advance-round" });
  else if (action === "complete-event") buttons.push({ label: "Complete Travel Event", action: "complete-event" });
  else if (action === "actor-apply" || canApply) buttons.push({ label: "Apply", action }, { label: "Open Details", action });
  else if (reviewActions.has(action)) buttons.push({ label: "Review", action }, { label: "Open Details", action });
  else buttons.push({ label: "Open Details", action });
  if (canSend) buttons.push({ label: "Send to Players", action: "send-players" });
  buttons.push({ label: "Dismiss", action: "dismiss" });
  return buttons;
}

function buildQueueItem(input = {}) {
  const key = input.key || `${input.action || "queue"}:${input.title || "item"}`.replace(/\s+/g, "-").toLowerCase();
  return { ...input, key, buttons: guidedQueueButtons(input.action, input) };
}


function buildPressureGauges(state = {}, pendingScars = []) {
  const configs = [
    { key: "strain", icon: "🔥", label: "Strain", description: "Arkengine stress and magical system pressure" },
    { key: "lifeveil", icon: "🌬️", label: "Lifeveil", description: "Breathable air / protective veil stability" },
    { key: "morale", icon: "🎭", label: "Morale", description: "Crew confidence and cohesion" },
    { key: "hull", icon: "⚓", label: "Hull", description: "Physical ship integrity pressure" },
    { key: "supplies", icon: "📦", label: "Supplies", description: "Food, parts, and voyage stores pressure" }
  ];
  return configs.map((config) => {
    const rawValue = Number(state.session?.pressure?.[config.key]?.value ?? state.session?.pressure?.[config.key] ?? 0) || 0;
    const value = Math.max(0, Math.min(4, rawValue));
    const overflow = rawValue > 4 || pendingScars.some((scar) => scar.pressureType === config.key);
    const stateClass = overflow ? "overflow" : (value >= 4 ? "danger" : (value >= 3 ? "strong-warning" : (value >= 2 ? "warning" : (value >= 1 ? "active" : "calm"))));
    return {
      ...config,
      value,
      rawValue,
      valueLabel: `${value} / 4`,
      stateClass,
      isWarning: value >= 2,
      isDanger: value >= 4,
      isOverflow: overflow,
      needleAngle: -60 + (value * 30),
      fillPercent: value * 25,
      tooltip: `${config.label}: ${config.description}. Pressure ranges from 0–4; thresholds at 2, 3, and 4.`
    };
  });
}

function buildTravelV2GuidedState(state = {}) {
  const stations = Array.isArray(state.stations) ? state.stations : [];
  const hazards = state.travelV2Hazards ?? { records: [] };
  const scars = state.travelV2ShipScars ?? { records: [] };
  const reactions = state.reactionPromptReview ?? { records: [] };
  const pressure = state.travelV2PreviewPanel?.pressureApplication ?? {};
  const actorPreview = state.travelV2PreviewPanel?.travelV2ActorApplicationPreview ?? {};
  const followUps = state.travelV2PreviewPanel?.travelV2FollowUps ?? {};
  const dismissed = new Set(Array.isArray(state.dismissedGuidedQueueKeys) ? state.dismissedGuidedQueueKeys : []);
  const pendingHazards = (hazards.records ?? []).filter((record) => record.status === "pending");
  const activeHazards = (hazards.records ?? []).filter((record) => record.status === "active");
  const clearedHazards = (hazards.records ?? []).filter((record) => record.status === "cleared");
  const pendingScars = (scars.records ?? []).filter((record) => record.status === "pending");
  const appliedScars = (scars.records ?? []).filter((record) => record.status === "applied");
  const resolvedScars = (scars.records ?? []).filter((record) => ["repaired", "dismissed"].includes(record.status));
  const pendingReactions = (reactions.records ?? []).filter((record) => record.isPending || record.status === "pending");
  const waitingStations = stations.filter((station) => !station.result);
  const choosingStations = waitingStations.filter((station) => station.assigned && station.selectedApproach?.isSelected !== true);
  const readyStations = waitingStations.filter((station) => station.assigned && station.selectedApproach?.isSelected === true);
  const criticalStations = stations.filter((station) => station.result === "criticalFailure");
  const resolvedStations = stations.filter((station) => station.result);
  const allQueue = [];
  if (!state.hasSession) allQueue.push(buildQueueItem({ key: "start", tone: "needs-attention", icon: "🧭", title: "Start Travel Session", detail: "Choose a published event and a PF2E vehicle ship.", actionLabel: "Open Details", action: "start" }));
  for (const station of choosingStations) allQueue.push(buildQueueItem({ key: `station-choosing:${station.stationKey}`, tone: "player-waiting", icon: "🃏", title: `${station.stationName} choosing`, detail: station.assignedActorName ? `${station.assignedActorName} is choosing an action card.` : "Assign a station actor before players choose.", actionLabel: "Review", action: "stations", canSend: true }));
  for (const station of readyStations) allQueue.push(buildQueueItem({ key: `station-ready:${station.stationKey}`, tone: "needs-attention", icon: "🎲", title: `${station.stationName} ready to roll`, detail: `${station.assignedActorName || "Assigned player"} selected ${station.selectedApproach?.label || station.selectedSkillLabel || "an action"}.`, actionLabel: "Review", action: "stations", canSend: true }));
  for (const station of criticalStations) allQueue.push(buildQueueItem({ key: `critical:${station.stationKey}`, tone: "danger-attention", icon: "🚨", title: `${station.stationName} critical failure`, detail: "Review reactions, backlash, pressure, and Ship Scar overflow before continuing.", actionLabel: "Review", action: "reactions" }));
  for (const reaction of pendingReactions) allQueue.push(buildQueueItem({ key: `reaction:${reaction.reactionPromptId ?? reaction.id ?? reaction.stationKey}`, tone: "needs-attention", icon: "🧭", title: reaction.promptTitle || "Reaction pending", detail: reaction.stationName ? `${reaction.stationName} reaction requires GM attention.` : "A reaction prompt is waiting.", actionLabel: "Review", action: "reactions" }));
  if (state.hasSession && waitingStations.length === 0 && resolvedStations.length > 0 && !pressure.alreadyApplied) allQueue.push(buildQueueItem({ key: `round-review:${state.currentRoundNumber}`, tone: "needs-attention", icon: "📜", title: "Round Pressure Ready", detail: "All required stations are rolled, skipped, or marked not participating. Review suggested pressure before applying.", actionLabel: "Review", action: "round-review", canApply: true }));
  const isFinalRound = state.hasSession && Number(state.currentRoundNumber) >= Number(state.event?.roundCount ?? state.session?.event?.rounds?.length ?? 0);
  if (state.hasSession && pressure.alreadyApplied && !state.isCompleted) {
    allQueue.push(buildQueueItem(isFinalRound
      ? { key: `complete-event:${state.currentRoundNumber}`, tone: "needs-attention", icon: "🏁", title: "Complete Travel Event", detail: "Final round pressure is applied. Review the outcome package and complete the event without auto-posting or actor effects.", action: "complete-event" }
      : { key: `advance-round:${state.currentRoundNumber}`, tone: "needs-attention", icon: "➡️", title: "Advance to Next Round", detail: "Pressure is applied. Advance to reset station cards and refresh players for the next round.", action: "advance-round" }));
  }
  for (const hazard of pendingHazards) allQueue.push(buildQueueItem({ key: `hazard:${hazard.id}`, tone: "pending-card", icon: "⚠️", title: `Hazard card pending: ${hazard.name}`, detail: hazard.playerText || hazard.gmText || "Review this hazard card.", actionLabel: "Review", action: "hazards" }));
  for (const scar of pendingScars) allQueue.push(buildQueueItem({ key: `ship-scar:${scar.id}`, tone: "danger-attention", icon: "🚨", title: `Ship Scar candidate: ${scar.name}`, detail: "Explicit GM Apply is required before actor flags are written.", actionLabel: "Review", action: "ship-scars" }));
  if (actorPreview.hasProposedChanges && !actorPreview.applyDisabled) allQueue.push(buildQueueItem({ key: "actor-apply", tone: "needs-attention", icon: "⚓", title: "Actor application ready", detail: actorPreview.summaryText || "Approved actor changes can be applied explicitly by the GM.", actionLabel: "Apply", action: "actor-apply", canApply: true }));
  if (followUps.hasRecords) allQueue.push(buildQueueItem({ key: "followups", tone: "resolved", icon: "📜", title: "Outcome follow-ups prepared", detail: followUps.persistedText || followUps.stagedText || "Review follow-up records.", actionLabel: "Review", action: "followups" }));
  if (state.travelV2DevToolResult) allQueue.push(buildQueueItem({ key: "devtools", tone: "resolved", icon: "🧪", title: "Dev tool result ready", detail: state.travelV2DevToolResult.ok === false ? "Dev tool reported a warning or error." : "Dev tool completed.", actionLabel: "Open Details", action: "devtools" }));
  if (state.isCompleted) allQueue.push(buildQueueItem({ key: "completed", tone: "resolved", icon: "💾", title: "Completed session saved", detail: "Review Completed Sessions or reopen a saved run.", actionLabel: "Review", action: "completed" }));
  const queue = allQueue.filter((item) => !dismissed.has(item.key));
  const next = queue[0] ?? (state.isCompleted ? { title: "Completed session saved", detail: "Review Completed Sessions or reopen a saved run.", tone: "resolved", icon: "💾" } : { title: state.hasSession ? (pressure.alreadyApplied ? "Pressure Applied" : "Send / Refresh Player HUD") : "Start Travel Session", detail: state.hasSession ? (pressure.alreadyApplied ? "Round pressure is already applied; continue when ready." : "Send or refresh player-safe Party HUD and Station Cards for the current round.") : "Select a published event and ship.", tone: state.hasSession && pressure.alreadyApplied ? "resolved" : "needs-attention", icon: state.hasSession && pressure.alreadyApplied ? "✅" : "🧭" });
  return {
    nextRequiredAction: next,
    actionQueue: queue,
    hasActionQueue: queue.length > 0,
    stationSummary: { total: stations.length, waiting: waitingStations.length, resolved: resolvedStations.length, critical: criticalStations.length },
    pressureGauges: buildPressureGauges(state, pendingScars),
    tags: { category: state.event?.categoryLabel || state.event?.category || "Uncategorized", level: state.event?.level ?? "—", severity: state.event?.severity ?? "—" },
    drawers: { hazards: pendingHazards.length, shipScars: pendingScars.length, reactions: pendingReactions.length, followUps: followUps.records?.length ?? 0 },
    hazards: { pending: pendingHazards, active: activeHazards, cleared: clearedHazards, hasAny: (hazards.records ?? []).length > 0 },
    shipScars: { pending: pendingScars, applied: appliedScars, resolved: resolvedScars, hasAny: (scars.records ?? []).length > 0 }
  };
}

export function prepareTravelEventRunnerAppStateWithTravelV2Preview({ session = null, selectedEventId = "", selectedSessionKey = "", actor = null, uiState = {}, travelV2DevToolsEnabled = false } = {}) {
  const state = prepareTravelEventRunnerStateWithTravelV2Preview(session, { selectedEventId, selectedSessionKey, actor });
  const appState = {
    ...state,
    actor,
    effectApplication: prepareTravelEventEffectApplicationState(session, actor),
    currentSessionCollapsed: uiState.currentSessionCollapsed !== false,
    sessionActionsExpanded: uiState.sessionActionsExpanded === true,
    compactRunner: uiState.compactRunner === true,
    travelV2PressureApplicationResult: uiState.travelV2PressureApplicationResult ?? null,
    travelV2PressureCorrectionResult: uiState.travelV2PressureCorrectionResult ?? null,
    travelV2RoundFinalizationResult: uiState.travelV2RoundFinalizationResult ?? null,
    travelV2EventCompletionResult: uiState.travelV2EventCompletionResult ?? null,
    travelV2EventOutcomeApplicationResult: uiState.travelV2EventOutcomeApplicationResult ?? null,
    travelV2ActorApplicationResult: uiState.travelV2ActorApplicationResult ?? null,
    travelV2PressureRunnerSession: session,
    travelV2DevToolsEnabled: travelV2DevToolsEnabled === true,
    travelV2DevToolResult: uiState.travelV2DevToolResult ?? null,
    dismissedGuidedQueueKeys: Array.isArray(uiState.dismissedGuidedQueueKeys) ? uiState.dismissedGuidedQueueKeys : [],
    travelV2CompletedSessionHistory: prepareTravelV2CompletedSessionHistoryState(state.sessionLibrary, { actor }),
    compactRoundLabel: state.hasSession ? (state.isCompleted ? "Completed" : `Round ${state.currentRoundNumber}`) : "No active round"
  };
  const previewPanel = prepareTravelEventRunnerV2PreviewPanelState(appState);
  const appStateWithPreview = { ...appState, travelV2PreviewPanel: previewPanel };
  return {
    ...appStateWithPreview,
    guidedBridge: buildTravelV2GuidedState(appStateWithPreview)
  };
}

export default prepareTravelEventRunnerAppStateWithTravelV2Preview;
