import { readFileSync } from "node:fs";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";
import { loadTravelEventRunnerSessionFromLibrary } from "../helpers/travel-event-runner.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel event runner v2 round action order unlock/recommit smoke check failed: ${message}`); }
function assertEqual(actual, expected, message) { if (actual !== expected) throw new Error(`Travel event runner v2 round action order unlock/recommit smoke check failed: ${message}. Expected ${expected}, got ${actual}.`); }
const snapshot = (value) => JSON.stringify(value);
const GM = { isGM: true, id: "gm-1", name: "GM" };
const PLAYER = { isGM: false, id: "p1", name: "Player" };
const ORDER = ["engineer", "navigator", "watchmaster"];

function sessionFixture(overrides = {}) { return { key: "runner-unlock", name: "Runner Unlock", status: "active", currentRoundIndex: 0, roundPhase: "stationOrders", event: { key: "event-unlock", name: "Unlock Event", category: "travel", rounds: [{ roundNumber: 1, title: "Unlock", activeStations: ["navigator", "engineer", "watchmaster"], stationPrompts: { navigator: { stationName: "Navigator" }, engineer: { stationName: "Engineer" }, watchmaster: { stationName: "Watchmaster" } }, stationActionOrder: ["navigator", "engineer", "watchmaster"] }] }, roundResults: [{ roundIndex: 0, stationResults: { navigator: null, engineer: null, watchmaster: null }, stationActions: { navigator: { type: "eventApproach" }, engineer: { type: "support" }, watchmaster: { type: "eventApproach" } }, stationOrderCommitments: { navigator: { committed: true }, engineer: { committed: true }, watchmaster: { committed: true } } }], travelV2RoundActionOrder: { version: 3, rounds: { "0": { roundIndex: 0, roundNumber: 1, order: ORDER, stationOrder: ORDER, committedAt: "2026-07-04T00:00:00.000Z", auditRecord: { id: "commit-1", timestamp: "2026-07-04T00:00:00.000Z" } } }, commitRecords: [{ id: "commit-1", type: "roundActionOrderCommit", roundIndex: 0, roundNumber: 1, timestamp: "2026-07-04T00:00:00.000Z", committedOrder: ORDER }] }, ...overrides }; }
async function importRunnerModule() { const previousFoundry = globalThis.foundry; let renderCalls = 0; globalThis.foundry = { applications: { api: { ApplicationV2: class { async _prepareContext() { return {}; } render() { renderCalls += 1; return { rendered: true, renderCalls }; } _onRender() {} }, HandlebarsApplicationMixin: (Base) => Base } } }; try { return { module: await import(`./travel-event-runner.js?roundActionOrderUnlockSmoke=${Date.now()}`), getRenderCalls: () => renderCalls }; } finally { if (previousFoundry === undefined) delete globalThis.foundry; else globalThis.foundry = previousFoundry; } }
function libraryWith(session) { return { version: 1, sessions: { [session.key]: { key: session.key, name: session.name, session } }, order: [session.key] }; }
function assertPlayerSafe(value) { const text = snapshot(value); for (const key of ["userId", "userName", "unlockRecord", "unlockRecords", "auditRecord", "commitRecords", "previousCommitAuditId", "raw session", "GM-only control payload"]) assertSmoke(!text.includes(key), `player state leaked ${key}`); }

export async function runTravelEventRunnerV2RoundActionOrderUnlockRecommitSmokeChecks() {
  const { module, getRenderCalls } = await importRunnerModule();
  const { ArcflightTravelEventRunner, prepareTravelV2RoundActionOrderUnlockRunnerUpdate } = module;
  const checked = [];
  assertEqual(typeof prepareTravelV2RoundActionOrderUnlockRunnerUpdate, "function", "unlock runner update helper exported");

  const previousGame = globalThis.game, previousUi = globalThis.ui, previousDialog = globalThis.foundry?.applications?.api?.DialogV2;
  let info = 0, warn = 0;
  globalThis.game = { user: GM, socket: { emit: () => { throw new Error("socket emitted"); } }, actors: { values: () => [] }, items: { values: () => [] }, users: { filter: () => [] } };
  globalThis.ui = { notifications: { info: () => { info += 1; }, warn: () => { warn += 1; } } };
  globalThis.foundry = globalThis.foundry ?? { applications: { api: {} } };
  globalThis.foundry.applications.api.DialogV2 = { confirm: async () => true };
  try {
    const session = sessionFixture();
    const gmState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session, user: GM, isGM: true });
    assertSmoke(gmState.travelV2PreviewPanel.roundActionOrderDisplay.unlockControl.canUnlock, "GM unlock control is ready");
    assertSmoke(gmState.travelV2PreviewPanel.roundActionOrderDisplay.canPersistCommittedOrder, "committed persistence is ready before unlock");

    const app = new ArcflightTravelEventRunner({ session, travelV2RoundActionOrderReorderRequested: true, travelV2ProposedRoundActionOrder: ["navigator", "engineer", "watchmaster"] });
    const beforeRoundResults = snapshot(app.session.roundResults);
    const rendered = await app.unlockTravelV2RoundActionOrder({ user: GM, isGM: true, timestamp: "2026-07-04T00:01:00.000Z" });
    assertSmoke(rendered.rendered, "successful unlock rerenders");
    assertSmoke(getRenderCalls() > 0, "app render was called");
    assertEqual(app.session.travelV2RoundActionOrder.rounds["0"], undefined, "successful app unlock removes only local canonical current-round record");
    assertEqual(snapshot(app.session.roundResults), beforeRoundResults, "unlock leaves station results unchanged");
    assertEqual(app.uiState.travelV2RoundActionOrderReorderRequested, false, "unlock clears stale reorder request");
    assertEqual(app.uiState.travelV2ProposedRoundActionOrder.length, 0, "unlock clears stale proposed reorder UI state");
    assertSmoke(info > 0 && warn === 0, "successful unlock notifies without warnings");

    const playerState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: app.session, user: PLAYER, isGM: false });
    assertEqual(playerState.travelV2PreviewPanel.roundActionOrderDisplay.unlockStatus.statusLabel, "Order Open for Reconsideration", "player preview shows open status");
    assertEqual(playerState.travelV2PreviewPanel.roundActionOrderDisplay.unlockControl, null, "player preview redacts unlock controls");
    assertPlayerSafe(playerState.travelV2PreviewPanel.roundActionOrderDisplay);

    app.uiState.travelV2RoundActionOrderReorderRequested = true;
    app.uiState.travelV2ProposedRoundActionOrder = ["watchmaster", "navigator", "engineer"];
    const review = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: app.session, user: GM, isGM: true, uiState: app.uiState });
    assertSmoke(review.travelV2PreviewPanel.roundActionOrderDisplay.reorderRequest.ready, "GM can prepare a new candidate after unlock");
    await app.commitTravelV2RoundActionOrder({ user: GM, isGM: true, timestamp: "2026-07-04T00:02:00.000Z" });
    assertEqual(app.session.travelV2RoundActionOrder.rounds["0"].order.join(","), "watchmaster,navigator,engineer", "existing commit method recommits new order");
    assertEqual(app.session.travelV2RoundActionOrder.commitRecords.length, 2, "new commit record exists");
    assertEqual(app.session.travelV2RoundActionOrder.unlockRecords.length, 1, "unlock record remains");

    const unlockedApp = new ArcflightTravelEventRunner({ session });
    await unlockedApp.unlockTravelV2RoundActionOrder({ user: GM, isGM: true, confirmed: true, timestamp: "2026-07-04T00:03:00.000Z" });
    await unlockedApp.persistUnlockedTravelV2RoundActionOrder({ user: GM, isGM: true, dryRun: true, library: libraryWith(session), now: "2026-07-04T00:04:00.000Z" });
    const persistedUnlock = unlockedApp.uiState.travelV2RoundActionOrderUnlockPersistResult;
    assertSmoke(persistedUnlock.persisted, "explicit persistence saves unlocked state");
    const loaded = loadTravelEventRunnerSessionFromLibrary("runner-unlock", { library: persistedUnlock.library, user: GM });
    assertSmoke(loaded.session.travelV2RoundActionOrder.unlockRecords.length === 1 && !loaded.session.travelV2RoundActionOrder.rounds["0"], "reload preserves explicitly saved unlocked lifecycle");
    const persistedAgain = await unlockedApp.persistUnlockedTravelV2RoundActionOrder({ user: GM, isGM: true, dryRun: true, library: persistedUnlock.library, now: "2026-07-04T00:05:00.000Z" });
    assertSmoke(persistedAgain.duplicate, "unlocked persistence is idempotent");
    assertEqual(Object.keys(persistedAgain.library.sessions).length, 1, "no duplicate library entries are created");
    await app.persistCommittedTravelV2RoundActionOrder({ user: GM, isGM: true, dryRun: true, library: persistedUnlock.library, now: "2026-07-04T00:06:00.000Z" });
    const persistedCommit = app.uiState.travelV2RoundActionOrderPersistResult;
    assertSmoke(persistedCommit.persisted, "explicit persistence after recommit preserves committed order");

    const template = readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
    for (const text of ["roundActionOrderDisplay.unlockStatus.openForReconsideration", "roundActionOrderDisplay.unlockStatus.statusLabel", "roundActionOrderDisplay.unlockStatus.guidanceText", "roundActionOrderDisplay.unlockControl.canUnlock", "roundActionOrderDisplay.unlockControl.blockedReason", "Unlock Order", "Order Open for Reconsideration"]) assertSmoke(template.includes(text), `template references ${text}`);
    checked.push("runner unlock, preview safety, recommit, persistence/reload, and template bindings");
  } finally {
    if (previousGame === undefined) delete globalThis.game; else globalThis.game = previousGame;
    if (previousUi === undefined) delete globalThis.ui; else globalThis.ui = previousUi;
    if (previousDialog === undefined && globalThis.foundry?.applications?.api) delete globalThis.foundry.applications.api.DialogV2; else if (globalThis.foundry?.applications?.api) globalThis.foundry.applications.api.DialogV2 = previousDialog;
  }
  return { checked };
}

export default runTravelEventRunnerV2RoundActionOrderUnlockRecommitSmokeChecks;
if (import.meta.url === `file://${process.argv[1]}`) runTravelEventRunnerV2RoundActionOrderUnlockRecommitSmokeChecks().then((result) => { console.log("Travel event runner v2 round action order unlock/recommit smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
