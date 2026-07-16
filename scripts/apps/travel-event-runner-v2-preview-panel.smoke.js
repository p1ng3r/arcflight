import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";
import { prepareTravelEventRunnerV2PreviewPanelState } from "./travel-event-runner-v2-preview-panel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_SMOKE_PATH = path.join(__dirname, "travel-event-runner-v2-preview-panel-base.smoke.js");
const STALE_ACTION_LABEL_ASSERTION = 'assertEqual(panel.roundActionOrderDisplay.rows[0].selectedActionLabel, "Event Approach", "round action order display should expose selected action label fallback");';
const CURRENT_ACTION_LABEL_ASSERTION = 'assertEqual(panel.roundActionOrderDisplay.rows[0].selectedActionLabel, "Station Order", "round action order display should expose selected action label fallback");';

function absoluteImportSource(source) {
  return source.replace(/from\s+"(\.{1,2}\/[^\"]+)"/g, (_match, specifier) => {
    const absoluteUrl = pathToFileURL(path.resolve(__dirname, specifier)).href;
    return `from "${absoluteUrl}"`;
  });
}

async function loadCorrectedBaseSmoke() {
  const source = fs.readFileSync(BASE_SMOKE_PATH, "utf8");
  assert.equal(source.includes(STALE_ACTION_LABEL_ASSERTION), true, "preserved base smoke should contain the known stale action-label assertion");
  const correctedSource = absoluteImportSource(source.replace(STALE_ACTION_LABEL_ASSERTION, CURRENT_ACTION_LABEL_ASSERTION))
    .replace(
      'const __filename = fileURLToPath(import.meta.url);',
      `const __filename = ${JSON.stringify(BASE_SMOKE_PATH)};`
    );
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(correctedSource, "utf8").toString("base64")}`;
  const imported = await import(moduleUrl);
  return imported.default;
}

const runBaseTravelEventRunnerV2PreviewPanelSmokeChecks = await loadCorrectedBaseSmoke();

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
      gmPanel.roundActionOrderDisplay.rows[0].selectedActionLabel,
      "Station Order",
      "unselected station action should use the Station Order fallback"
    );
    assert.equal(
      gmPanel.roundActionOrderDisplay.canRequestReorderReview,
      true,
      "GM panel should expose reorder review readiness"
    );

    return {
      ok: true,
      checked: [
        ...(Array.isArray(baseResult?.checked) ? baseResult.checked : []),
        "station-order-action-label-fallback",
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
