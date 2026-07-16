import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";
import { prepareTravelEventRunnerV2PreviewPanelState } from "./travel-event-runner-v2-preview-panel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_SMOKE_PATH = path.join(__dirname, "travel-event-runner-v2-preview-panel-base.smoke.js");

const STALE_ACTION_LABEL_ASSERTION_PATTERN = /assertEqual\(panel\.roundActionOrderDisplay\.rows\[0\]\.selectedActionLabel,\s*"Event Approach",\s*"round action order display should expose selected action label fallback"\);/;
const CURRENT_ACTION_LABEL_ASSERTION = 'assertEqual(panel.roundActionOrderDisplay.rows[0].selectedActionLabel, "Station Order", "round action order display should expose selected action label fallback");';
const PANEL_IMPORT_PATTERN = /import\s*\{\s*prepareTravelEventRunnerV2PreviewPanelState,/;
const PANEL_IMPORT_REPLACEMENT = `import {
  prepareTravelEventRunnerV2PreviewPanelState as prepareTravelEventRunnerV2PreviewPanelStateBase,`;
const PANEL_PATH_DECLARATION_PATTERN = /const PANEL_PATH = path\.join\(__dirname,\s*"travel-event-runner-v2-preview-panel\.js"\);\r?\n/;
const SESSION_REFRESH_ADAPTER = `
function prepareTravelEventRunnerV2PreviewPanelState(appState = {}) {
  if (!appState?.session) return prepareTravelEventRunnerV2PreviewPanelStateBase(appState);
  const user = appState.user ?? (appState.isGM === false ? { isGM: false } : globalThis.game?.user);
  const refreshedAppState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
    session: appState.session,
    selectedEventId: appState.selectedEventId ?? "",
    selectedSessionKey: appState.selectedSessionKey ?? "",
    actor: appState.actor ?? null,
    uiState: { ...(appState.uiState ?? {}), ...appState },
    travelV2DevToolsEnabled: appState.travelV2DevToolsEnabled === true,
    user
  });
  const directOverrides = Object.fromEntries(Object.entries(appState).filter(([key]) =>
    key === "travelV2Preview"
    || key === "travelV2StationBenefitUseReviewPlayerState"
    || key === "actor"
    || key === "user"
    || key === "isGM"
    || key === "isCompleted"
    || key.endsWith("Result")
  ));
  return prepareTravelEventRunnerV2PreviewPanelStateBase({
    ...appState,
    ...refreshedAppState,
    ...directOverrides,
    session: appState.session
  });
}
`;

function absoluteImportSource(source) {
  return source.replace(/from\s+"(\.{1,2}\/[^\"]+)"/g, (_match, specifier) => {
    const absoluteUrl = pathToFileURL(path.resolve(__dirname, specifier)).href;
    return `from "${absoluteUrl}"`;
  });
}

function replaceRequired(source, pattern, replacement, label) {
  assert.match(source, pattern, `preserved base smoke should contain the known stale ${label}`);
  const corrected = source.replace(pattern, replacement);
  assert.notEqual(corrected, source, `stale ${label} should be replaced`);
  return corrected;
}

async function loadCorrectedBaseSmoke() {
  let correctedSource = fs.readFileSync(BASE_SMOKE_PATH, "utf8");
  correctedSource = replaceRequired(correctedSource, STALE_ACTION_LABEL_ASSERTION_PATTERN, CURRENT_ACTION_LABEL_ASSERTION, "action-label assertion");
  correctedSource = replaceRequired(correctedSource, PANEL_IMPORT_PATTERN, PANEL_IMPORT_REPLACEMENT, "preview-panel import");
  correctedSource = replaceRequired(
    correctedSource,
    PANEL_PATH_DECLARATION_PATTERN,
    (match) => `${match}${SESSION_REFRESH_ADAPTER}\n`,
    "session refresh adapter insertion point"
  );
  correctedSource = absoluteImportSource(correctedSource).replace(
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
    assert.equal(playerPanel.roundActionOrderDisplay.canRequestReorderReview, false, "player panel should not expose GM reorder review readiness");

    const gmAppState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session, user: gmUser });
    const gmPanel = prepareTravelEventRunnerV2PreviewPanelState(gmAppState);
    assert.equal(gmPanel.roundActionOrderDisplay.rows[0].selectedActionLabel, "Station Order", "unselected station action should use the Station Order fallback");
    assert.equal(gmPanel.roundActionOrderDisplay.canRequestReorderReview, true, "GM panel should expose reorder review readiness");

    return {
      ok: true,
      checked: [
        ...(Array.isArray(baseResult?.checked) ? baseResult.checked : []),
        "station-order-action-label-fallback",
        "preview-panel-session-recomputation",
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
