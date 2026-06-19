import { prepareTravelEventRunnerState } from "./travel-event-runner.js";
import { prepareTravelV2RunnerCurrentRoundPreviewState } from "./travel-v2-preview-state.js";

export const TRAVEL_EVENT_RUNNER_V2_PREVIEW_VERSION = 1;

export function prepareTravelEventRunnerStateWithTravelV2Preview(session = null, options = {}) {
  const state = prepareTravelEventRunnerState(session, options);
  return {
    ...state,
    travelV2Preview: state.hasSession
      ? prepareTravelV2RunnerCurrentRoundPreviewState(state.session, options)
      : prepareTravelV2RunnerCurrentRoundPreviewState(null, options)
  };
}

export default prepareTravelEventRunnerStateWithTravelV2Preview;
