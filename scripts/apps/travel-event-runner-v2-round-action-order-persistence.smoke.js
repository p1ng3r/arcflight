import { commitTravelV2RoundActionOrderToSession } from "../helpers/travel-v2-round-action-order-state.js";
import { persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary } from "../helpers/travel-event-runner.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel event runner v2 round action order persistence smoke check failed: ${message}`); }
function assertEqual(actual, expected, message) { if (actual !== expected) throw new Error(`Travel event runner v2 round action order persistence smoke check failed: ${message}. Expected ${expected}, got ${actual}.`); }
function snapshot(value) { return JSON.stringify(value); }

function sessionFixture(overrides = {}) {
  return {
    key: "runner-order-persist-fixture",
    status: "active",
    currentRoundIndex: 0,
    event: { key: "event", name: "Event", category: "travel", rounds: [{ roundNumber: 1, title: "Order Persist", activeStations: ["navigator", "engineer", "watchmaster"], stationPrompts: { navigator: { stationName: "Navigator" }, engineer: { stationName: "Engineer" }, watchmaster: { stationName: "Watchmaster" } }, stationActionOrder: ["navigator", "engineer", "watchmaster"] }] },
    roundResults: [{ roundIndex: 0, stationResults: { navigator: null, engineer: null, watchmaster: null }, stationActions: { navigator: { type: "eventApproach" }, engineer: { type: "support" }, watchmaster: { type: "eventApproach" } } }],
    ...overrides
  };
}

function committedSession() {
  return commitTravelV2RoundActionOrderToSession(sessionFixture(), ["engineer", "navigator", "watchmaster"], { user: { isGM: true, id: "gm-1", name: "GM" }, commitRequested: true, timestamp: "2026-07-04T00:00:00.000Z" }).session;
}

function libraryWith(session) {
  return { version: 1, sessions: { [session.key]: { key: session.key, name: session.name ?? "Session", eventKey: session.event?.key ?? "event", eventName: session.event?.name ?? "Event", eventCategory: session.event?.category ?? "travel", status: session.status, currentRoundIndex: session.currentRoundIndex, session } } };
}

async function importRunnerModule() {
  const previousFoundry = globalThis.foundry;
  let renderCalls = 0;
  globalThis.foundry = { applications: { api: { ApplicationV2: class { async _prepareContext() { return {}; } render() { renderCalls += 1; return { rendered: true, renderCalls }; } _onRender() {} }, HandlebarsApplicationMixin: (Base) => Base } } };
  try { return { module: await import(`./travel-event-runner.js?roundActionOrderPersistSmoke=${Date.now()}`), getRenderCalls: () => renderCalls }; }
  finally { if (previousFoundry === undefined) delete globalThis.foundry; else globalThis.foundry = previousFoundry; }
}

export async function runTravelEventRunnerV2RoundActionOrderPersistenceSmokeChecks() {
  const { module, getRenderCalls } = await importRunnerModule();
  const { ArcflightTravelEventRunner } = module;
  assertEqual(typeof persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary, "function", "persistence bridge should be available for direct wrapper checks");

  let chatCalls = 0, journalCalls = 0, socketCalls = 0, actorUpdateCalls = 0, itemUpdateCalls = 0;
  const previousGame = globalThis.game, previousUi = globalThis.ui, previousChatMessage = globalThis.ChatMessage, previousJournalEntry = globalThis.JournalEntry;
  globalThis.game = { user: { isGM: true, id: "gm-1", name: "GM" }, socket: { emit: () => { socketCalls += 1; } }, actors: { get: () => ({ update: () => { actorUpdateCalls += 1; } }), values: () => [] }, items: { get: () => ({ update: () => { itemUpdateCalls += 1; } }), values: () => [] } };
  globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };
  globalThis.ChatMessage = { create: () => { chatCalls += 1; } };
  globalThis.JournalEntry = { create: () => { journalCalls += 1; } };

  try {
    const committed = committedSession();
    const savedBase = sessionFixture({ key: committed.key });
    const app = new ArcflightTravelEventRunner({ session: committed });
    const before = snapshot(app.session);
    const result = await app.persistCommittedTravelV2RoundActionOrder({ dryRun: true, library: libraryWith(savedBase), now: "2026-07-04T00:01:00.000Z" });
    assertSmoke(result?.rendered, "successful GM persistence action rerenders");
    assertEqual(snapshot(app.session), before, "successful persistence does not mutate local runner session");
    assertSmoke(app.uiState.travelV2RoundActionOrderPersistResult.persisted, "successful persistence stores result in uiState");
    assertSmoke(app.statusMessage.includes("persisted"), "successful persistence sets a clear status message");

    const duplicateBefore = snapshot(app.session);
    const duplicate = await app.persistCommittedTravelV2RoundActionOrder({ dryRun: true, library: app.uiState.travelV2RoundActionOrderPersistResult.library, now: "2026-07-04T00:02:00.000Z" });
    assertSmoke(duplicate.duplicate, "duplicate persistence returns no-op result");
    assertEqual(snapshot(app.session), duplicateBefore, "duplicate persistence is non-destructive");

    const missingApp = new ArcflightTravelEventRunner({ session: sessionFixture() });
    const missing = await missingApp.persistCommittedTravelV2RoundActionOrder({ dryRun: true, library: libraryWith(sessionFixture()) });
    assertSmoke(missing.blocked && missing.blockedReasons.join("\n").includes("no committed"), "missing committed order blocks");
    assertEqual(snapshot(missingApp.session), snapshot(sessionFixture()), "missing committed order does not mutate local session");

    const nonGmApp = new ArcflightTravelEventRunner({ session: committed });
    const nonGm = await nonGmApp.persistCommittedTravelV2RoundActionOrder({ user: { isGM: false }, isGM: false, dryRun: true, library: libraryWith(savedBase) });
    assertSmoke(nonGm.blocked && nonGm.session === null, "non-GM persistence blocks and redacts session");

    const directMissingRequest = await persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary(committed, { user: { isGM: true }, dryRun: true, library: libraryWith(savedBase) });
    assertSmoke(directMissingRequest.blockedReasons.join("\n").includes("Explicit"), "direct wrapper blocks without explicit persist request");

    assertEqual(app.session.currentRoundIndex, committed.currentRoundIndex, "persistence does not advance rounds");
    assertEqual(snapshot(app.session.roundResults), snapshot(committed.roundResults), "persistence does not mutate station results");
    assertEqual(snapshot(app.uiState.travelV2ProposedRoundActionOrder), "[]", "persistence does not alter proposed order");
    assertEqual(chatCalls, 0, "persistence path should not create chat messages");
    assertEqual(journalCalls, 0, "persistence path should not create journals");
    assertEqual(socketCalls, 0, "app persistence smoke dry-run should not emit sockets");
    assertEqual(actorUpdateCalls, 0, "persistence path should not update actors");
    assertEqual(itemUpdateCalls, 0, "persistence path should not update items");

    const fs = await import("node:fs");
    const appSource = fs.readFileSync(new URL("./travel-event-runner.js", import.meta.url), "utf8");
    const persistSlice = appSource.slice(appSource.indexOf("persistCommittedTravelV2RoundActionOrder(options"), appSource.indexOf("#requestTravelV2StationBenefitReview"));
    for (const forbiddenCall of ["commitTravelV2RoundActionOrderToSession", "advanceTravelEventRunnerRound", "setTravelEventRunnerStationResult", "clearTravelEventRunnerStationResult", "finalizeTravelV2RoundOnRunnerSession", "completeTravelV2EventOnRunnerSession", "applyTravelV2PressureToRunnerSession", "correctTravelV2PressureApplicationOnRunnerSession", "applyTravelV2EventOutcomePackageToRunnerSession", "spendTravelV2RunnerMomentumDowngrade", "applyTravelV2ShipScarToActor", "repairTravelV2ShipScarOnActor", "applyTravelV2ActorApplicationPreview", ".roll(", "Check", "DC", "ChatMessage", "JournalEntry", "socket.emit"]) assertSmoke(!persistSlice.includes(forbiddenCall), `persistence slice should not call forbidden helper or runtime mutation ${forbiddenCall}`);
    const template = fs.readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
    assertEqual((template.match(/data-arcflight-travel-v2-order-persist-request/g) ?? []).length, 1, "template exposes exactly one persist action");
    assertSmoke(template.includes("canPersistCommittedOrder"), "template gates persist action on committed order display state");
    const aggregate = fs.readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8");
    assertSmoke(aggregate.includes("runTravelEventRunnerV2RoundActionOrderPersistenceSmokeChecks"), "aggregate smoke runner includes app persistence suite");
    assertSmoke(getRenderCalls() >= 1, "successful app persistence requested render");
  } finally {
    if (previousGame === undefined) delete globalThis.game; else globalThis.game = previousGame;
    if (previousUi === undefined) delete globalThis.ui; else globalThis.ui = previousUi;
    if (previousChatMessage === undefined) delete globalThis.ChatMessage; else globalThis.ChatMessage = previousChatMessage;
    if (previousJournalEntry === undefined) delete globalThis.JournalEntry; else globalThis.JournalEntry = previousJournalEntry;
  }

  return { ok: true, checked: ["successful-gm-persistence", "duplicate-non-destructive", "missing-committed-blocks", "non-gm-redacted", "direct-missing-request-blocks", "no-commit-helper", "single-template-action", "no-round-or-station-side-effects", "no-roll-check-dc-or-mutation-side-effects"] };
}

export default runTravelEventRunnerV2RoundActionOrderPersistenceSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelEventRunnerV2RoundActionOrderPersistenceSmokeChecks().then((result) => { console.log("Travel event runner v2 round action order persistence smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
