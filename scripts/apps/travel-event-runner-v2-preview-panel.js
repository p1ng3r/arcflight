import { prepareTravelEventRunnerV2PreviewPanelState as prepareBaseTravelEventRunnerV2PreviewPanelState } from "./travel-event-runner-v2-preview-panel-base.js";

export * from "./travel-event-runner-v2-preview-panel-base.js";

const RECONSIDERATION_CLOSED_TEXT = "Station resolution has begun, so the round action order can no longer be changed.";

function closeRoundActionOrderReconsideration(display = null) {
  if (!display || display.unlockStatus?.statusKey !== "closedByStationResults") return display;

  const closedText = display.unlockStatus?.guidanceText || RECONSIDERATION_CLOSED_TEXT;
  const closedLabel = display.unlockStatus?.statusLabel || "Order Reconsideration Closed";
  const orderDecision = {
    ...(display.orderDecision ?? {}),
    statusLabel: closedLabel,
    statusTone: "danger",
    guidanceText: closedText,
    showCaptainGuidance: false
  };
  const reorderRequest = display.reorderRequest
    ? {
        ...display.reorderRequest,
        ready: false,
        blocked: true,
        status: "blocked",
        feedbackText: closedText,
        blockedReason: closedText,
        blockedReasons: Array.from(new Set([closedText, ...(Array.isArray(display.reorderRequest.blockedReasons) ? display.reorderRequest.blockedReasons : [])]))
      }
    : display.reorderRequest;

  return {
    ...display,
    orderDecision,
    orderStatusLabel: orderDecision.statusLabel,
    orderStatusTone: orderDecision.statusTone,
    showCaptainGuidance: false,
    canRequestReorderReview: false,
    canPersistUnlockedOrderState: false,
    reorderRequest
  };
}

export function prepareTravelEventRunnerV2PreviewPanelState(appState = {}) {
  const panel = prepareBaseTravelEventRunnerV2PreviewPanelState(appState);
  return {
    ...panel,
    roundActionOrderDisplay: closeRoundActionOrderReconsideration(panel?.roundActionOrderDisplay)
  };
}

export default prepareTravelEventRunnerV2PreviewPanelState;
