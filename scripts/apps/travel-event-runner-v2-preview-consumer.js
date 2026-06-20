import { prepareTravelEventRunnerStateWithTravelV2Preview } from "../helpers/travel-event-runner-v2-preview.js";
import { prepareTravelEventEffectApplicationState } from "../helpers/travel-event-runner.js";
import { prepareTravelEventRunnerV2PreviewPanelState } from "./travel-event-runner-v2-preview-panel.js";

export const TRAVEL_EVENT_RUNNER_V2_PREVIEW_CONSUMER_VERSION = 2;

export function prepareTravelEventRunnerAppStateWithTravelV2Preview({ session = null, selectedEventId = "", selectedSessionKey = "", actor = null, uiState = {} } = {}) {
  const state = prepareTravelEventRunnerStateWithTravelV2Preview(session, { selectedEventId, selectedSessionKey, actor });
  const appState = {
    ...state,
    effectApplication: prepareTravelEventEffectApplicationState(session, actor),
    currentSessionCollapsed: uiState.currentSessionCollapsed !== false,
    sessionActionsExpanded: uiState.sessionActionsExpanded === true,
    compactRunner: uiState.compactRunner === true,
    travelV2PressureApplicationResult: uiState.travelV2PressureApplicationResult ?? null,
    travelV2PressureCorrectionResult: uiState.travelV2PressureCorrectionResult ?? null,
    travelV2RoundFinalizationResult: uiState.travelV2RoundFinalizationResult ?? null,
    travelV2EventCompletionResult: uiState.travelV2EventCompletionResult ?? null,
    travelV2PressureRunnerSession: session,
    compactRoundLabel: state.hasSession ? (state.isCompleted ? "Completed" : `Round ${state.currentRoundNumber}`) : "No active round"
  };
  return {
    ...appState,
    travelV2PreviewPanel: prepareTravelEventRunnerV2PreviewPanelState(appState)
  };
}

export default prepareTravelEventRunnerAppStateWithTravelV2Preview;
