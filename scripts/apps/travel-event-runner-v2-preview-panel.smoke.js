import assert from "node:assert/strict";
import runBaseTravelEventRunnerV2PreviewPanelSmokeChecks from "./travel-event-runner-v2-preview-panel-base.smoke.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";
import { prepareTravelEventRunnerV2PreviewPanelState } from "./travel-event-runner-v2-preview-panel.js";

function createRunnerEventFixture() {
  return {
    key: "v2-preview-panel-context-test",
    name: "V2 Preview Panel Context Test",
    category: "navigation",
    baseDC: 20,
    rounds: [
      {
        roundNumber: 1,
        title: "Preview Panel Context Round",
        activeStations: ["navigator", "engineer"],
        stationPrompts: {
          navigator: { stationKey: "navigator", stationName: "Navigator", playerAction: "Plot the route." },
          engineer: { stationKey: "engineer", stationName: "Engineer", playerAction: "Hold the engine." }
        }
      }
    ]
  };
}

export function runTravelEventRunnerV2PreviewPanelSmokeChecks() {
  const previousGame = globalThis.game;
  const gmUser = { isGM: true, id: "gm", name: "GM" };

  try {
    globalThis.game = { ...(previousGame ?? {}), user: gmUser };
    const baseResult = runBaseTravelEventRunnerV2PreviewPanelSmokeChecks();
    const session = { event: createRunnerEventFixture() };

    const playerAppState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session,
      user: { isGM: false, id: "player", name: "Player" }
    });
    const playerPanel = prepareTravelEventRunnerV2PreviewPanelState(playerAppState);
    assert.equal(
      playerPanel.roundActionOrderDisplay.canRequestReorderReview,
      false,
      "player panel should not expose GM reorder review readiness"
    );

    const gmAppState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session, user: gmUser });
    const gmPanel = prepareTravelEventRunnerV2PreviewPanelState(gmAppState);
    assert.equal(
      gmPanel.roundActionOrderDisplay.canRequestReorderReview,
      true,
      "GM panel should expose reorder review readiness"
    );

    return {
      ok: true,
      checked: [
        ...(Array.isArray(baseResult?.checked) ? baseResult.checked : []),
        "player-reorder-review-redaction",
        "gm-reorder-review-readiness"
      ]
    };
  } finally {
    if (previousGame === undefined) delete globalThis.game;
    else globalThis.game = previousGame;
  }
}

export default runTravelEventRunnerV2PreviewPanelSmokeChecks;
