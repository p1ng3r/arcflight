import { prepareTravelEventRunnerStateWithTravelV2Preview } from "../helpers/travel-event-runner-v2-preview.js";
import { prepareTravelEventEffectApplicationState } from "../helpers/travel-event-runner.js";
import { prepareTravelEventRunnerV2PreviewPanelState } from "./travel-event-runner-v2-preview-panel.js";
import { prepareTravelV2CompletedSessionHistoryState, prepareTravelV2DevToolsPanelState } from "../helpers/travel-v2-dev-tools.js";
import { prepareTravelV2ConsequenceFollowupReview, prepareTravelV2PendingConsequenceQueue } from "../helpers/travel-v2-pending-consequence-queue.js";
import { prepareTravelV2HazardDeckPickerUiState } from "../helpers/travel-v2-hazard-deck-picker-ui.js";
import { prepareTravelV2RuntimeHazardDeckSelectionGmState } from "../helpers/travel-v2-runtime-hazard-deck-selection.js";
import { prepareTravelV2HazardDrawReviewState } from "../helpers/travel-v2-hazard-draw-review.js";
import { prepareTravelV2ActiveHazardHandoffReviewState } from "../helpers/travel-v2-active-hazard-handoff-review.js";
import { prepareTravelV2HazardCandidateControlGmState } from "../helpers/travel-v2-hazard-candidate-controls.js";
import { applyTravelV2ActiveHazardLifecycleDisplayToRenderState } from "../helpers/travel-v2-active-hazard-lifecycle-display.js";
import { applyTravelV2ResponseActionWiringToRenderState } from "../helpers/travel-v2-response-action-wiring.js";
import { applyTravelV2StationImpactBehaviorToRenderState } from "../helpers/travel-v2-station-impact-behavior.js";
import { applyTravelV2ResponseActionResolutionReviewToRenderState } from "../helpers/travel-v2-response-action-resolution-review.js";
import { applyTravelV2StationImpactModifierReviewToRenderState } from "../helpers/travel-v2-station-impact-modifier-review.js";
import { applyTravelV2PendingStationBenefitQueueToRenderState } from "../helpers/travel-v2-pending-station-benefit-queue.js";
import { applyTravelV2StationBenefitUseReviewToRenderState } from "../helpers/travel-v2-station-benefit-use-review.js";

export const TRAVEL_EVENT_RUNNER_V2_PREVIEW_CONSUMER_VERSION = 4;

function guidedQueueButtons(action, { canApply = false, canSend = false, noDismiss = false } = {}) {
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
  if (!noDismiss) buttons.push({ label: "Dismiss", action: "dismiss" });
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

function firstText(values = [], fallback = "") {
  const found = values.find((value) => typeof value === "string" && value.trim());
  return found ? found.trim() : fallback;
}

function buildTravelV2GmFlowStatus(state = {}) {
  const hasSession = state.hasSession === true;
  const stations = Array.isArray(state.stations) ? state.stations : [];
  const totalRounds = Number(state.event?.roundCount ?? state.session?.event?.rounds?.length ?? state.event?.rounds?.length ?? 0) || 0;
  const currentRoundNumber = Number(state.currentRoundNumber ?? (Number(state.session?.currentRoundIndex ?? -1) + 1)) || 0;
  const resolvedStations = stations.filter((station) => Boolean(station.result)).length;
  const totalStations = stations.length;
  const pendingReactions = (state.reactionPromptReview?.records ?? []).filter((record) => record?.isPending || record?.status === "pending").length;
  const focusRerollNeeded = stations.filter((station) => station.focusRerollNeeded === true || station.needsFocusReroll === true).length;
  const pressure = state.travelV2PreviewPanel?.pressureApplication ?? {};
  const finalization = state.travelV2PreviewPanel?.travelV2RoundFinalizationState ?? state.roundFinalization ?? {};
  const queue = state.pendingConsequenceQueue ?? {};
  const pendingConsequences = Number(queue.pendingCount ?? 0) || 0;
  const appliedConsequences = Number(queue.appliedCount ?? 0) || 0;
  const dismissedConsequences = Number(queue.dismissedCount ?? 0) || 0;
  const deferredConsequences = Number(queue.deferredCount ?? 0) || 0;
  const isFinalized = finalization.isFinalized === true || finalization.lifecycleState === "finalized" || finalization.lifecycleState === "event-complete-ready";
  const pressureApplied = pressure.alreadyApplied === true || finalization.isPressureApplied === true || Boolean(finalization.pressureApplicationRecord);
  const hasNextRound = hasSession && currentRoundNumber > 0 && totalRounds > 0 && currentRoundNumber < totalRounds;
  const isCompleted = state.isCompleted === true || state.session?.status === "completed" || state.session?.completed === true;
  const isFinalRound = hasSession && totalRounds > 0 && currentRoundNumber >= totalRounds;
  if (isCompleted) {
    return {
      currentRoundLabel: hasSession ? "Completed" : "No active round",
      stationResolutionLabel: hasSession ? `Stations: ${resolvedStations} / ${totalStations} resolved` : "Stations: none",
      focusReadinessLabel: "Focus: clear",
      finalizationLabel: "Finalization: completed",
      pressureLabel: "Pressure: applied",
      consequenceLabel: "Consequences: clear",
      advanceLabel: "Advance: event completed",
      playerSyncLabel: hasSession ? "Player sync: current" : "Player sync: unavailable",
      nextActionLabel: "Travel event completed.",
      nextActionHelpText: "The Travel v2 event is completed.",
      stateTone: "ready",
      blockers: [],
      disabledActions: {
        finalizeRound: "Travel event already completed.",
        applyPressure: "Travel event already completed.",
        applyConsequence: "Travel event already completed.",
        advanceRound: "Travel event already completed.",
        completeEvent: "Travel event already completed.",
        syncPlayers: hasSession ? "" : "No active Travel v2 runner."
      }
    };
  }
  const blockers = [];
  if (!hasSession) blockers.push("Open or start a Travel Event Runner first.");
  if (hasSession && resolvedStations < totalStations) blockers.push("Resolve all active stations first.");
  if (pendingReactions > 0) blockers.push("A Focus reaction is still pending.");
  if (focusRerollNeeded > 0) blockers.push("A Focus reroll is accepted but unresolved.");
  if (hasSession && !pressureApplied) blockers.push("Apply pressure/finalization before advancing.");
  if (hasSession && !isFinalized) blockers.push("Finalize this round before advancing.");
  if (pendingConsequences > 0 || deferredConsequences > 0) blockers.push("Apply or dismiss pending consequences before advancing.");
  if (hasSession && !hasNextRound && !isFinalRound) blockers.push("No next round exists.");
  const canFinalize = finalization.canFinalize === true;
  const completionBlockers = blockers.filter((reason) => reason !== "No next round exists.");
  const canCompleteEvent = hasSession && isFinalRound && !isCompleted && completionBlockers.length === 0;
  const canAdvance = hasSession && !isFinalRound && blockers.length === 0;
  const uniqueBlockers = [...new Set(isFinalRound ? completionBlockers : blockers)];
  let nextActionLabel = "No active Travel v2 runner.";
  if (isCompleted) nextActionLabel = "Travel event completed.";
  else if (hasSession) {
    if (resolvedStations < totalStations) nextActionLabel = totalStations === 0 ? "Choose station approaches." : "Resolve active station rolls.";
    else if (pendingReactions > 0) nextActionLabel = "Resolve pending Focus reaction.";
    else if (focusRerollNeeded > 0) nextActionLabel = "Resolve accepted Focus reroll.";
    else if (!pressureApplied) nextActionLabel = "Apply pressure/finalization.";
    else if (!isFinalized) nextActionLabel = "Finalize this round.";
    else if (pendingConsequences > 0) nextActionLabel = "Apply or dismiss pending consequence.";
    else if (deferredConsequences > 0) nextActionLabel = "Review pending consequences.";
    else if (hasNextRound) nextActionLabel = `Advance to Round ${currentRoundNumber + 1}.`;
    else nextActionLabel = "Complete Travel Event.";
  }
  const blockedOnlyByFinalization = uniqueBlockers.length === 1 && uniqueBlockers[0] === "Finalize this round before advancing.";
  const showFinalizeRoundAction = hasSession && !isCompleted && !isFinalized && canFinalize && (blockedOnlyByFinalization || nextActionLabel === "Finalize this round.");
  const disabledActions = {
    finalizeRound: canFinalize ? "" : firstText([finalization.blockedReason, ...(finalization.blockedReasons ?? [])], isFinalized ? "Round already finalized." : "Resolve all active stations and apply pressure first."),
    applyPressure: pressure.alreadyApplied ? "Pressure already applied." : firstText([pressure.blockedReason, ...(pressure.blockedReasons ?? [])], resolvedStations < totalStations ? "Resolve all active stations first." : "Review round pressure before applying."),
    applyConsequence: pendingConsequences > 0 ? "" : "No pending consequence exists.",
    advanceRound: canAdvance ? "" : (blockers[0] ?? "Round cannot advance yet."),
    completeEvent: canCompleteEvent ? "" : (isCompleted ? "Travel event already completed." : (completionBlockers[0] ?? "Event cannot be completed yet.")),
    syncPlayers: hasSession ? "" : "No active Travel v2 runner."
  };
  const consequenceLabel = pendingConsequences > 0 ? `pending (${pendingConsequences})` : (deferredConsequences > 0 ? `deferred (${deferredConsequences})` : (appliedConsequences > 0 ? `applied (${appliedConsequences})` : (dismissedConsequences > 0 ? `dismissed (${dismissedConsequences})` : "clear")));
  return {
    currentRoundLabel: hasSession ? `Round ${currentRoundNumber}${totalRounds ? ` of ${totalRounds}` : ""}` : "No active round",
    stationResolutionLabel: hasSession ? `Stations: ${resolvedStations} / ${totalStations} resolved` : "Stations: none",
    focusReadinessLabel: focusRerollNeeded > 0 ? "Focus: reroll needed" : (pendingReactions > 0 ? "Focus: pending reaction" : "Focus: clear"),
    finalizationLabel: isFinalized ? "Finalization: finalized" : (canFinalize ? "Finalization: ready" : "Finalization: not ready"),
    pressureLabel: pressureApplied ? "Pressure: applied" : "Pressure: not applied",
    consequenceLabel: `Consequences: ${consequenceLabel}`,
    advanceLabel: isCompleted ? "Advance: event completed" : (isFinalRound ? (canCompleteEvent ? "Advance: complete" : "Advance: event ready to complete") : (canAdvance ? "Advance: ready" : "Advance: blocked")),
    playerSyncLabel: hasSession ? (state.statusMessage?.includes?.("Sent") || state.statusMessage?.includes?.("refresh") || state.statusMessage?.includes?.("Advanced") ? "Player sync: refresh sent" : "Player sync: current") : "Player sync: unavailable",
    nextActionLabel,
    nextActionHelpText: isCompleted ? "The Travel v2 event is completed." : (completionBlockers[0] ?? blockers[0] ?? ((canAdvance || canCompleteEvent) ? "All displayed blockers are clear for the next GM action." : "Open or start a Travel Event Runner.")),
    stateTone: (canAdvance || canCompleteEvent || isCompleted) ? "ready" : (isFinalized || pressureApplied ? "warning" : (hasSession ? "blocked" : "neutral")),
    blockers: uniqueBlockers,
    showFinalizeRoundAction,
    finalizeRoundActionLabel: showFinalizeRoundAction ? "Finalize Round" : "",
    finalizeRoundActionTitle: showFinalizeRoundAction ? "Open the Travel v2 round finalization dialog." : disabledActions.finalizeRound,
    disabledActions
  };
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
  const heldHazards = (hazards.records ?? []).filter((record) => record.status === "held");
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
  for (const hazard of pendingHazards) allQueue.push(buildQueueItem({ key: `hazard:${hazard.id}`, tone: "pending-card", icon: "⚠️", title: `Hazard Card Pending: ${hazard.name}`, detail: hazard.playerText ? "Reveal, activate, hold, or dismiss this staged hazard." : "Add player-safe text before revealing, or activate/hold/dismiss GM-only.", actionLabel: "Review", action: "hazards", noDismiss: true }));
  for (const hazard of heldHazards) allQueue.push(buildQueueItem({ key: `hazard-held:${hazard.id}`, tone: "pending-card", icon: "⏸️", title: `Hazard Held: ${hazard.name}`, detail: "Held hazard needs later reveal, activation, or dismissal.", actionLabel: "Review", action: "hazards", noDismiss: true }));
  for (const hazard of activeHazards) allQueue.push(buildQueueItem({ key: `hazard-active:${hazard.id}`, tone: "needs-attention", icon: "⚠️", title: `Active Hazard: ${hazard.name}`, detail: "Resolve Hazard when it no longer applies. Actor changes still require explicit GM Apply elsewhere.", actionLabel: "Review", action: "hazards", noDismiss: true }));
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
    drawers: { hazards: pendingHazards.length + heldHazards.length + activeHazards.length, shipScars: pendingScars.length, reactions: pendingReactions.length, followUps: followUps.records?.length ?? 0 },
    hazards: { pending: pendingHazards, held: heldHazards, revealed: (hazards.records ?? []).filter((record) => record.revealed === true && record.status !== "cleared"), active: activeHazards, cleared: clearedHazards, hasAny: (hazards.records ?? []).length > 0 },
    shipScars: { pending: pendingScars, applied: appliedScars, resolved: resolvedScars, hasAny: (scars.records ?? []).length > 0 }
  };
}


function sanitizeNonGmAppStateValue(value) {
  if (typeof value === "string") {
    return value
      .replaceAll("GM-only", "restricted")
      .replaceAll("GM only", "restricted")
      .replaceAll("Apply Outcome Package", "Review Outcome");
  }
  if (Array.isArray(value)) return value.map((entry) => sanitizeNonGmAppStateValue(entry));
  if (!value || typeof value !== "object") return value;
  const next = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === "canManageTravelV2Consequences" || key.startsWith("consequenceFlow")) continue;
    next[key] = sanitizeNonGmAppStateValue(entry);
  }
  return next;
}

export function prepareTravelEventRunnerAppStateWithTravelV2Preview({ session = null, selectedEventId = "", selectedSessionKey = "", actor = null, uiState = {}, travelV2DevToolsEnabled = false, user = globalThis.game?.user } = {}) {
  const state = prepareTravelEventRunnerStateWithTravelV2Preview(session, { selectedEventId, selectedSessionKey, actor, user });
  const canManageTravelV2Consequences = user?.isGM === true;
  const preparedPendingConsequenceQueue = prepareTravelV2PendingConsequenceQueue(session);
  const preparedConsequenceFollowupReview = prepareTravelV2ConsequenceFollowupReview(session);
  const travelV2RuntimeHazardDeckSelection = canManageTravelV2Consequences ? prepareTravelV2RuntimeHazardDeckSelectionGmState({ selectedDeckId: uiState.travelV2HazardDeckPickerSelectedDeckId ?? null }, { defaultToGoldStandard: true, includeGmReview: canManageTravelV2Consequences, user }) : null;
  const travelV2HazardDeckPicker = prepareTravelV2HazardDeckPickerUiState({ selectedDeckId: travelV2RuntimeHazardDeckSelection?.selectedDeckId ?? null, includeGmReview: canManageTravelV2Consequences, user });
  const travelV2HazardDrawReview = canManageTravelV2Consequences ? prepareTravelV2HazardDrawReviewState({
    selectedDeckId: travelV2RuntimeHazardDeckSelection?.selectedDeckId ?? null,
    requestedDeckId: travelV2RuntimeHazardDeckSelection?.requestedDeckId ?? null,
    travelV2HazardDrawRequested: uiState.travelV2HazardDrawRequested === true,
    travelV2HazardDrawRequest: uiState.travelV2HazardDrawRequest ?? null,
    travelV2HazardDrawMode: uiState.travelV2HazardDrawMode ?? null,
    travelV2HazardDrawCardId: uiState.travelV2HazardDrawCardId ?? null,
    travelV2HazardDrawIndex: uiState.travelV2HazardDrawIndex ?? null,
    travelV2HazardDrawSeed: uiState.travelV2HazardDrawSeed ?? null
  }, { user, includeGmReview: true }) : null;
  const travelV2ActiveHazardHandoffReview = canManageTravelV2Consequences ? prepareTravelV2ActiveHazardHandoffReviewState({
    travelV2HazardDrawReview,
    selectedDeckId: travelV2RuntimeHazardDeckSelection?.selectedDeckId ?? null,
    travelV2ActiveHazardHandoffReviewRequested: uiState.travelV2ActiveHazardHandoffReviewRequested === true,
    travelV2ActiveHazardHandoffReviewRequest: uiState.travelV2ActiveHazardHandoffReviewRequest ?? null
  }, { user, includeGmReview: true }) : null;
  const travelV2HazardCandidateControlResult = canManageTravelV2Consequences ? prepareTravelV2HazardCandidateControlGmState({
    travelV2ActiveHazardHandoffReview,
    travelV2HazardCandidateControlRequested: uiState.travelV2HazardCandidateControlRequested === true,
    travelV2HazardCandidateControlAction: uiState.travelV2HazardCandidateControlAction ?? null,
    travelV2HazardCandidateControlNote: uiState.travelV2HazardCandidateControlNote ?? null
  }, { user, includeGmReview: true }) : (uiState.travelV2HazardCandidateControlResult ?? null);
  const travelV2DevToolsPanel = prepareTravelV2DevToolsPanelState({ isGM: canManageTravelV2Consequences, session, hasSession: state.hasSession });
  const templateTravelV2DevToolsPanel = canManageTravelV2Consequences
    ? travelV2DevToolsPanel
    : Object.freeze({
      version: travelV2DevToolsPanel.version,
      isGm: false,
      enabled: false,
      visible: false,
      hasSession: state.hasSession
    });
  const pendingConsequenceCount = Number(preparedPendingConsequenceQueue.pendingCount) || 0;
  const consequenceFlowReady = state.roundFinalization?.isFinalized === true && pendingConsequenceCount === 0;
  const consequenceFlowBlocked = state.roundFinalization?.isFinalized === true && pendingConsequenceCount > 0;
  const consequenceFlowBlockers = consequenceFlowBlocked ? ["Pending consequences require GM review."] : [];
  const consequenceFlowWarningLabel = consequenceFlowBlocked ? "Round finalized. Review pending consequences before advancing." : (consequenceFlowReady ? "No pending consequences. Ready to advance." : (state.roundFinalization?.canFinalize === true ? "Ready to finalize this round." : "Resolve active stations before finalizing this round."));
  const appState = {
    ...state,
    actor,
    effectApplication: canManageTravelV2Consequences ? prepareTravelEventEffectApplicationState(session, actor) : { available: false, rows: [], records: [], canApply: false },
    currentSessionCollapsed: uiState.currentSessionCollapsed !== false,
    sessionActionsExpanded: uiState.sessionActionsExpanded === true,
    compactRunner: uiState.compactRunner === true,
    travelV2PressureApplicationResult: uiState.travelV2PressureApplicationResult ?? null,
    travelV2PressureCorrectionResult: uiState.travelV2PressureCorrectionResult ?? null,
    travelV2RoundFinalizationResult: uiState.travelV2RoundFinalizationResult ?? null,
    travelV2EventCompletionResult: uiState.travelV2EventCompletionResult ?? null,
    ...(canManageTravelV2Consequences ? {
      travelV2EventOutcomeApplicationResult: uiState.travelV2EventOutcomeApplicationResult ?? null,
      travelV2ActorApplicationResult: uiState.travelV2ActorApplicationResult ?? null
    } : {}),
    travelV2PressureRunnerSession: canManageTravelV2Consequences ? session : null,
    isGM: canManageTravelV2Consequences,
    ...(canManageTravelV2Consequences ? { canManageTravelV2Consequences, consequenceFlowReady, consequenceFlowBlocked, consequenceFlowBlockers, consequenceFlowWarningLabel, canReviewConsequences: pendingConsequenceCount > 0, canApplyPendingConsequences: pendingConsequenceCount > 0, canDismissPendingConsequences: pendingConsequenceCount > 0, canAdvanceAfterConsequences: consequenceFlowReady, pendingConsequenceQueue: preparedPendingConsequenceQueue } : {}),
    ...(canManageTravelV2Consequences ? { consequenceFollowupReview: preparedConsequenceFollowupReview, travelV2RuntimeHazardDeckSelection, travelV2HazardDeckPicker, travelV2HazardDrawReview, travelV2ActiveHazardHandoffReview, travelV2HazardCandidateControlResult } : {}),
    travelV2DevToolsPanel: templateTravelV2DevToolsPanel,
    travelV2DevToolsEnabled: templateTravelV2DevToolsPanel.visible === true,
    travelV2DevToolResult: uiState.travelV2DevToolResult ?? null,
    travelV2RoundActionOrderCommitResult: uiState.travelV2RoundActionOrderCommitResult ?? null,
    travelV2RoundActionOrderPersistResult: uiState.travelV2RoundActionOrderPersistResult ?? null,
    travelV2RoundActionOrderReorderRequested: uiState.travelV2RoundActionOrderReorderRequested === true,
    travelV2ProposedRoundActionOrder: Array.isArray(uiState.travelV2ProposedRoundActionOrder) ? uiState.travelV2ProposedRoundActionOrder : [],
    dismissedGuidedQueueKeys: Array.isArray(uiState.dismissedGuidedQueueKeys) ? uiState.dismissedGuidedQueueKeys : [],
    travelV2CompletedSessionHistory: prepareTravelV2CompletedSessionHistoryState(state.sessionLibrary, { actor, includeGmSummary: canManageTravelV2Consequences }),
    compactRoundLabel: state.hasSession ? (state.isCompleted ? "Completed" : `Round ${state.currentRoundNumber}`) : "No active round"
  };
  const appStateWithLifecycleDisplay = applyTravelV2ActiveHazardLifecycleDisplayToRenderState(appState, { travelV2HazardCandidateControlResult, user }, { user, includeGmReview: canManageTravelV2Consequences });
  const appStateWithResponseActionWiring = applyTravelV2ResponseActionWiringToRenderState(appStateWithLifecycleDisplay, { user }, { user, includeGmReview: canManageTravelV2Consequences });
  const appStateWithStationImpactBehavior = applyTravelV2StationImpactBehaviorToRenderState(appStateWithResponseActionWiring, { user, stations: appStateWithResponseActionWiring.stations }, { user, includeGmReview: canManageTravelV2Consequences });
  const appStateWithResponseActionResolutionReview = applyTravelV2ResponseActionResolutionReviewToRenderState(appStateWithStationImpactBehavior, {
    user,
    travelV2ResponseActionResolutionRequested: uiState.travelV2ResponseActionResolutionRequested === true,
    travelV2ResponseActionSelectedActionId: uiState.travelV2ResponseActionSelectedActionId ?? null,
    travelV2ResponseActionSelectedHazardCardId: uiState.travelV2ResponseActionSelectedHazardCardId ?? null,
    travelV2ResponseActionResolutionNote: uiState.travelV2ResponseActionResolutionNote ?? null
  }, { user, includeGmReview: canManageTravelV2Consequences });
  const appStateWithStationImpactModifierReview = applyTravelV2StationImpactModifierReviewToRenderState(appStateWithResponseActionResolutionReview, { user, stations: appStateWithResponseActionResolutionReview.stations }, { user, includeGmReview: canManageTravelV2Consequences });
  const appStateWithPendingStationBenefitQueue = applyTravelV2PendingStationBenefitQueueToRenderState(appStateWithStationImpactModifierReview, { user, session, stations: appStateWithStationImpactModifierReview.stations }, { user, includeGmReview: canManageTravelV2Consequences });
  const appStateWithStationBenefitUseReview = applyTravelV2StationBenefitUseReviewToRenderState(appStateWithPendingStationBenefitQueue, {
    user,
    session,
    stations: appStateWithPendingStationBenefitQueue.stations,
    selectedQueueKey: uiState.travelV2StationBenefitUseReviewSelectedQueueKey ?? null,
    travelV2StationBenefitUseReviewRequested: uiState.travelV2StationBenefitUseReviewRequested === true
  }, { user, includeGmReview: canManageTravelV2Consequences });
  const previewPanel = prepareTravelEventRunnerV2PreviewPanelState(appStateWithStationBenefitUseReview);
  const appStateWithPreview = { ...appStateWithStationBenefitUseReview, travelV2PreviewPanel: previewPanel };
  const travelV2GmFlowStatus = canManageTravelV2Consequences ? buildTravelV2GmFlowStatus(appStateWithPreview) : null;
  const appStateWithGmFlowStatus = { ...appStateWithPreview, ...(canManageTravelV2Consequences ? { travelV2GmFlowStatus } : {}) };
  const result = {
    ...appStateWithGmFlowStatus,
    guidedBridge: buildTravelV2GuidedState(appStateWithGmFlowStatus)
  };
  return canManageTravelV2Consequences ? result : sanitizeNonGmAppStateValue(result);
}

export default prepareTravelEventRunnerAppStateWithTravelV2Preview;
