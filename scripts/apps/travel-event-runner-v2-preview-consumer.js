import { prepareTravelEventRunnerStateWithTravelV2Preview } from "../helpers/travel-event-runner-v2-preview.js";
import { prepareTravelEventEffectApplicationState } from "../helpers/travel-event-runner.js";

export const TRAVEL_EVENT_RUNNER_V2_PREVIEW_CONSUMER_VERSION = 1;

export function prepareTravelEventRunnerAppStateWithTravelV2Preview({ session = null, selectedEventId = "", selectedSessionKey = "", actor = null, uiState = {} } = {}) {
  const state = prepareTravelEventRunnerStateWithTravelV2Preview(session, { selectedEventId, selectedSessionKey, actor });
  return {
    ...state,
    effectApplication: prepareTravelEventEffectApplicationState(session, actor),
    currentSessionCollapsed: uiState.currentSessionCollapsed !== false,
    sessionActionsExpanded: uiState.sessionActionsExpanded === true,
    compactRunner: uiState.compactRunner === true,
    compactRoundLabel: state.hasSession ? (state.isCompleted ? "Completed" : `Round ${state.currentRoundNumber}`) : "No active round"
  };
}

export default prepareTravelEventRunnerAppStateWithTravelV2Preview;
