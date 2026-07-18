import { readFileSync } from "node:fs";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";
import { prepareTravelEventRunnerV2PreviewPanelState } from "./travel-event-runner-v2-preview-panel.js";
import { loadTravelEventRunnerSessionFromLibrary, persistUnlockedTravelV2RoundActionOrderToRunnerSessionLibrary } from "../helpers/travel-event-runner.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel event runner v2 round action order unlock/recommit smoke check failed: ${message}`); }
function assertEqual(actual, expected, message) { if (actual !== expected) throw new Error(`Travel event runner v2 round action order unlock/recommit smoke check failed: ${message}. Expected ${expected}, got ${actual}.`); }
const snapshot = (value) => JSON.stringify(value);
const snapshotRoundResultsWithoutActionOrder = (roundResults = []) => snapshot(roundResults.map(({ actionOrder, ...roundResult }) => roundResult));
const GM = { isGM: true, id: "gm-1", name: "GM" };
const PLAYER = { isGM: false, id: "p1", name: "Player" };
const ORDER = ["engineer", "navigator", "watchmaster"];
const RECONSIDERATION_CLOSED_TEXT = "Station resolution has begun, so the round action order can no longer be changed.";

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
    const beforeRoundResults = snapshotRoundResultsWithoutActionOrder(app.session.roundResults);
    const rendered = await app.unlockTravelV2RoundActionOrder({ user: GM, isGM: true, timestamp: "2026-07-04T00:01:00.000Z" });
    assertSmoke(rendered.rendered, "successful unlock rerenders");
    assertSmoke(getRenderCalls() > 0, "app render was called");
    assertEqual(app.session.travelV2RoundActionOrder.rounds["0"], undefined, "successful app unlock removes only local canonical current-round record");
    assertEqual(snapshotRoundResultsWithoutActionOrder(app.session.roundResults), beforeRoundResults, "unlock leaves station results unchanged");
    assertEqual(app.uiState.travelV2RoundActionOrderReorderRequested, false, "unlock clears stale reorder request");
    assertEqual(app.uiState.travelV2ProposedRoundActionOrder.length, 0, "unlock clears stale proposed reorder UI state");
    assertSmoke(info > 0 && warn === 0, "successful unlock notifies without warnings");

    const playerState = prepareTravelEventRunnerV2PreviewPanelState({ session: app.session, user: PLAYER, isGM: false });
    assertEqual(playerState.roundActionOrderDisplay.unlockStatus.statusLabel, "Order Open for Reconsideration", "player preview shows open status");
    assertEqual(playerState.roundActionOrderDisplay.unlockControl, null, "player preview redacts unlock controls");
    assertPlayerSafe(playerState.roundActionOrderDisplay);

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

    const staleApp = new ArcflightTravelEventRunner({ session });
    await staleApp.unlockTravelV2RoundActionOrder({ user: GM, isGM: true, confirmed: true, timestamp: "2026-07-04T00:07:00.000Z" });
    staleApp.session = JSON.parse(JSON.stringify(staleApp.session));
    staleApp.session.roundResults[0].stationResults.navigator = "success";
    const staleBeforeCommit = snapshot(staleApp.session);
    staleApp.uiState.travelV2RoundActionOrderReorderRequested = true;
    staleApp.uiState.travelV2ProposedRoundActionOrder = ["watchmaster", "navigator", "engineer"];
    const blockedRendered = await staleApp.commitTravelV2RoundActionOrder({ user: GM, isGM: true, timestamp: "2026-07-04T00:08:00.000Z" });
    assertSmoke(!blockedRendered.shouldUpdateSession, "recommit after station result is blocked through runner helper");
    assertEqual(snapshot(staleApp.session), staleBeforeCommit, "blocked recommit does not replace or mutate local session");
    assertEqual(staleApp.session.travelV2RoundActionOrder.commitRecords.length, 1, "blocked recommit appends no commit record");
    assertEqual(staleApp.session.roundResults[0].stationResults.navigator, "success", "blocked recommit preserves station result");
    assertSmoke(staleApp.uiState.travelV2RoundActionOrderCommitResult.blocked, "blocked recommit stores warning feedback");

    const stalePreview = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: staleApp.session, user: GM, isGM: true, uiState: staleApp.uiState }).travelV2PreviewPanel.roundActionOrderDisplay;
    assertEqual(stalePreview.unlockStatus.openForReconsideration, false, "preview closes open-for-reconsideration after result");
    assertEqual(stalePreview.orderDecision.statusLabel, "Order Reconsideration Closed", "closed preview replaces contradictory proposed status label");
    assertEqual(stalePreview.orderDecision.guidanceText, RECONSIDERATION_CLOSED_TEXT, "closed preview replaces changeable guidance");
    assertEqual(stalePreview.orderDecision.showCaptainGuidance, false, "closed preview suppresses Captain guidance in canonical decision");
    assertEqual(stalePreview.showCaptainGuidance, false, "closed preview suppresses top-level Captain guidance");
    assertEqual(stalePreview.canRequestReorderReview, false, "closed preview disables reorder review request");
    assertEqual(stalePreview.reorderRequest.ready, false, "closed preview clears ready-to-commit state");
    assertEqual(stalePreview.reorderRequest.blocked, true, "closed preview blocks reorder review");
    assertEqual(stalePreview.reorderRequest.blockedReason, RECONSIDERATION_CLOSED_TEXT, "closed preview explains why reorder review is blocked");
    assertSmoke(!stalePreview.orderDecision.guidanceText.includes("remains changeable"), "closed preview exposes no contradictory changeable copy");
    assertEqual(stalePreview.canPersistUnlockedOrderState, false, "preview disables unlocked persistence after result");
    assertEqual(stalePreview.canPersistCommittedOrder, false, "preview keeps committed persistence disabled without canonical committed order");
    const stalePlayerPreview = prepareTravelEventRunnerV2PreviewPanelState({ session: staleApp.session, user: PLAYER, isGM: false }).roundActionOrderDisplay;
    assertEqual(stalePlayerPreview.unlockStatus.statusLabel, "Order Reconsideration Closed", "player preview exposes closed reconsideration status");
    assertEqual(stalePlayerPreview.orderDecision.statusLabel, "Order Reconsideration Closed", "player preview receives non-contradictory closed order status");
    assertEqual(stalePlayerPreview.orderDecision.guidanceText, RECONSIDERATION_CLOSED_TEXT, "player preview receives closed guidance");
    assertEqual(stalePlayerPreview.showCaptainGuidance, false, "player preview suppresses Captain guidance after results");
    assertEqual(stalePlayerPreview.canRequestReorderReview, false, "player preview exposes no reorder availability");
    assertPlayerSafe(stalePlayerPreview);

    const blockedLibrary = libraryWith(session);
    const blockedLocalBefore = snapshot(staleApp.session);
    await staleApp.persistUnlockedTravelV2RoundActionOrder({ user: GM, isGM: true, dryRun: true, library: blockedLibrary, now: "2026-07-04T00:09:00.000Z" });
    const blockedPersist = staleApp.uiState.travelV2RoundActionOrderUnlockPersistResult;
    assertEqual(blockedPersist.ok, false, "stale unlocked persistence blocks through app");
    assertEqual(blockedPersist.persisted, false, "stale unlocked persistence does not persist");
    assertEqual(blockedPersist.blocked, true, "stale unlocked persistence reports blocked");
    assertEqual(snapshot(blockedPersist.library ?? blockedLibrary), snapshot(blockedLibrary), "blocked persistence leaves saved library unchanged");
    assertEqual(Object.keys((blockedPersist.library ?? blockedLibrary).sessions).length, 1, "blocked persistence creates no library entries");
    assertEqual(snapshot(staleApp.session), blockedLocalBefore, "blocked persistence leaves local session unchanged");

    const openDirect = await persistUnlockedTravelV2RoundActionOrderToRunnerSessionLibrary(unlockedApp.session, { user: GM, isGM: true, persistRequested: true, dryRun: true, library: libraryWith(session), now: "2026-07-04T00:10:00.000Z" });
    assertSmoke(openDirect.persisted || openDirect.duplicate, "direct bridge accepts valid open lifecycle");
    const directDuplicate = await persistUnlockedTravelV2RoundActionOrderToRunnerSessionLibrary(unlockedApp.session, { user: GM, isGM: true, persistRequested: true, dryRun: true, library: openDirect.library, now: "2026-07-04T00:11:00.000Z" });
    assertSmoke(directDuplicate.duplicate, "direct bridge duplicate open persistence is idempotent");
    const otherSession = { ...sessionFixture({ key: "other-runner", name: "Other Runner" }) };
    const libraryWithOther = { version: 1, sessions: { [session.key]: { key: session.key, name: session.name, session }, [otherSession.key]: { key: otherSession.key, name: otherSession.name, session: otherSession } }, order: [session.key, otherSession.key] };
    const blockedCases = [
      ["station-result", (() => { const s = JSON.parse(JSON.stringify(unlockedApp.session)); s.roundResults[0].stationResults.navigator = "success"; return s; })()],
      ["finalized", { ...unlockedApp.session, travelV2RoundResolutions: { records: [{ roundIndex: 0, roundNumber: 1 }] } }],
      ["completed", { ...unlockedApp.session, status: "completed", completedAt: "2026-07-04T00:12:00.000Z" }],
      ["fabricated", sessionFixture({ travelV2RoundActionOrder: { version: 4, rounds: {}, commitRecords: [], unlockRecords: [{ id: "fake-unlock", type: "roundActionOrderUnlock", roundIndex: 0, roundNumber: 1, previousOrder: ORDER, timestamp: "2026-07-04T00:01:00.000Z" }] } })],
      ["later-recommit", app.session]
    ];
    for (const [label, blockedSession] of blockedCases) {
      const beforeLibrary = snapshot(libraryWithOther);
      const blocked = await persistUnlockedTravelV2RoundActionOrderToRunnerSessionLibrary(blockedSession, { user: GM, isGM: true, persistRequested: true, dryRun: true, library: libraryWithOther, now: `2026-07-04T00:13:00.000Z` });
      assertEqual(blocked.ok, false, `${label} direct bridge blocks`);
      assertEqual(blocked.persisted, false, `${label} direct bridge does not persist`);
      assertEqual(snapshot(blocked.library ?? libraryWithOther), beforeLibrary, `${label} direct bridge preserves all library entries`);
      assertEqual(snapshot(libraryWithOther.sessions[otherSession.key]), snapshot(JSON.parse(beforeLibrary).sessions[otherSession.key]), `${label} direct bridge leaves other entry unchanged`);
    }

    const template = readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
    for (const text of ["roundActionOrderDisplay.unlockStatus.openForReconsideration", "roundActionOrderDisplay.unlockStatus.statusLabel", "roundActionOrderDisplay.unlockStatus.guidanceText", "roundActionOrderDisplay.unlockControl.canUnlock", "roundActionOrderDisplay.unlockControl.blockedReason", "Unlock Order", "Order Open for Reconsideration"]) assertSmoke(template.includes(text), `template references ${text}`);
    checked.push("runner unlock, preview safety, recommit, persistence/reload, closed presentation, and template bindings");
  } finally {
    if (previousGame === undefined) delete globalThis.game; else globalThis.game = previousGame;
    if (previousUi === undefined) delete globalThis.ui; else globalThis.ui = previousUi;
    if (previousDialog === undefined && globalThis.foundry?.applications?.api) delete globalThis.foundry.applications.api.DialogV2; else if (globalThis.foundry?.applications?.api) globalThis.foundry.applications.api.DialogV2 = previousDialog;
  }
  return { checked };
}

export default runTravelEventRunnerV2RoundActionOrderUnlockRecommitSmokeChecks;
if (import.meta.url === `file://${process.argv[1]}`) runTravelEventRunnerV2RoundActionOrderUnlockRecommitSmokeChecks().then((result) => { console.log("Travel event runner v2 round action order unlock/recommit smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
