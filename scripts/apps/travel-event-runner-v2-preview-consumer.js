import { prepareTravelEventRunnerStateWithTravelV2Preview } from "../helpers/travel-event-runner-v2-preview.js";
import { prepareTravelEventEffectApplicationState } from "../helpers/travel-event-runner.js";
import { prepareTravelEventRunnerV2PreviewPanelState } from "./travel-event-runner-v2-preview-panel.js";
import { prepareTravelV2CompletedSessionHistoryState } from "../helpers/travel-v2-dev-tools.js";

export const TRAVEL_EVENT_RUNNER_V2_PREVIEW_CONSUMER_VERSION = 2;

function buildTravelV2GuidedState(state = {}) {
  const stations = Array.isArray(state.stations) ? state.stations : [];
  const hazards = state.travelV2Hazards ?? { records: [] };
  const scars = state.travelV2ShipScars ?? { records: [] };
  const reactions = state.reactionPromptReview ?? { records: [] };
  const pressure = state.travelV2PreviewPanel?.pressureApplication ?? {};
  const actorPreview = state.travelV2PreviewPanel?.travelV2ActorApplicationPreview ?? {};
  const followUps = state.travelV2PreviewPanel?.travelV2FollowUps ?? {};
  const pendingHazards = (hazards.records ?? []).filter((record) => record.status === "pending");
  const pendingScars = (scars.records ?? []).filter((record) => record.status === "pending");
  const pendingReactions = (reactions.records ?? []).filter((record) => record.isPending || record.status === "pending");
  const waitingStations = stations.filter((station) => !station.result);
  const criticalStations = stations.filter((station) => station.result === "criticalFailure");
  const resolvedStations = stations.filter((station) => station.result);
  const queue = [];
  if (!state.hasSession) queue.push({ tone: "needs-attention", icon: "🧭", title: "Start Travel Session", detail: "Choose a published event and a PF2E vehicle ship.", actionLabel: "Open Details", action: "start" });
  for (const station of waitingStations) queue.push({ tone: "player-waiting", icon: "⚠️", title: `${station.stationName} roll missing`, detail: station.assignedActorName ? `${station.assignedActorName} has not resolved this station.` : "Assign a station actor before rolling.", actionLabel: "Review", action: "stations" });
  for (const station of criticalStations) queue.push({ tone: "danger-attention", icon: "🚨", title: `${station.stationName} critical failure`, detail: "Review reactions, backlash, pressure, and Ship Scar overflow before continuing.", actionLabel: "Review", action: "reactions" });
  for (const reaction of pendingReactions) queue.push({ tone: "needs-attention", icon: "🧭", title: reaction.promptTitle || "Reaction pending", detail: reaction.stationName ? `${reaction.stationName} reaction requires GM attention.` : "A reaction prompt is waiting.", actionLabel: "Review", action: "reactions" });
  if (state.hasSession && waitingStations.length === 0 && resolvedStations.length > 0 && !pressure.alreadyApplied) queue.push({ tone: "needs-attention", icon: "📜", title: "Round pressure ready", detail: "All station rolls are in. Review suggested pressure before applying.", actionLabel: "Open Details", action: "round-review" });
  for (const hazard of pendingHazards) queue.push({ tone: "pending-card", icon: "⚠️", title: `Hazard card pending: ${hazard.name}`, detail: hazard.playerText || hazard.gmText || "Review this hazard card.", actionLabel: "Review", action: "hazards" });
  for (const scar of pendingScars) queue.push({ tone: "danger-attention", icon: "🚨", title: `Ship Scar candidate: ${scar.name}`, detail: "Explicit GM Apply is required before actor flags are written.", actionLabel: "Review", action: "ship-scars" });
  if (actorPreview.hasProposedChanges && !actorPreview.applyDisabled) queue.push({ tone: "needs-attention", icon: "⚓", title: "Actor application ready", detail: actorPreview.summaryText || "Approved actor changes can be applied explicitly by the GM.", actionLabel: "Apply", action: "actor-apply" });
  if (followUps.hasRecords) queue.push({ tone: "resolved", icon: "📜", title: "Outcome follow-ups prepared", detail: followUps.persistedText || followUps.stagedText || "Review follow-up records.", actionLabel: "Review", action: "followups" });
  if (state.travelV2DevToolResult) queue.push({ tone: "resolved", icon: "🧪", title: "Dev tool result ready", detail: state.travelV2DevToolResult.ok === false ? "Dev tool reported a warning or error." : "Dev tool completed.", actionLabel: "Open Details", action: "devtools" });
  const next = queue[0] ?? (state.isCompleted ? { title: "Completed session saved", detail: "Review Completed Sessions or reopen a saved run.", tone: "resolved", icon: "💾" } : { title: state.hasSession ? "Send Station Roll Cards" : "Start Travel Session", detail: state.hasSession ? "Send or refresh player mission board cards for the current assignment." : "Select a published event and ship.", tone: "needs-attention", icon: "🧭" });
  return {
    nextRequiredAction: next,
    actionQueue: queue,
    hasActionQueue: queue.length > 0,
    stationSummary: { total: stations.length, waiting: waitingStations.length, resolved: resolvedStations.length, critical: criticalStations.length },
    pressurePips: ["strain", "lifeveil", "morale", "supplies", "hull"].map((key) => ({ key, label: key.charAt(0).toUpperCase() + key.slice(1), value: Number(state.session?.pressure?.[key]?.value ?? state.session?.pressure?.[key] ?? 0) || 0 })),
    tags: { category: state.event?.categoryLabel || state.event?.category || "Uncategorized", level: state.event?.level ?? "—", severity: state.event?.severity ?? "—" },
    drawers: { hazards: pendingHazards.length, shipScars: pendingScars.length, reactions: pendingReactions.length, followUps: followUps.records?.length ?? 0 }
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
