import { prepareTravelEventRunnerState } from "./travel-event-runner.js";
import { prepareTravelV2RunnerCurrentRoundPreviewState } from "./travel-v2-preview-state.js";

export const TRAVEL_EVENT_RUNNER_V2_PREVIEW_VERSION = 1;

export function prepareTravelEventRunnerStateWithTravelV2Preview(session = null, options = {}) {
  const state = prepareTravelEventRunnerState(session, options);
  const previewSource = session && typeof session === "object" ? session : (state.hasSession ? state.session : null);
  return {
    ...state,
    travelV2Preview: prepareTravelV2RunnerCurrentRoundPreviewState(previewSource, options)
  };
}

export default prepareTravelEventRunnerStateWithTravelV2Preview;
