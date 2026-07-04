function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel event runner v2 round action order commit smoke check failed: ${message}`); }
function assertEqual(actual, expected, message) { if (actual !== expected) throw new Error(`Travel event runner v2 round action order commit smoke check failed: ${message}. Expected ${expected}, got ${actual}.`); }
function snapshot(value) { return JSON.stringify(value); }

function sessionFixture(overrides = {}) {
  return {
    key: "runner-order-commit-fixture",
    status: "active",
    currentRoundIndex: 0,
    event: { rounds: [{ roundNumber: 1, title: "Order Commit", activeStations: ["navigator", "engineer", "watchmaster"], stationPrompts: { navigator: { stationName: "Navigator" }, engineer: { stationName: "Engineer" }, watchmaster: { stationName: "Watchmaster" } }, stationActionOrder: ["navigator", "engineer", "watchmaster"] }] },
    roundResults: [{ roundIndex: 0, stationResults: { navigator: null, engineer: null, watchmaster: null }, stationActions: { navigator: { type: "eventApproach" }, engineer: { type: "support" }, watchmaster: { type: "eventApproach" } } }],
    ...overrides
  };
}

async function importRunnerModule() {
  const previousFoundry = globalThis.foundry;
  let renderCalls = 0;
  globalThis.foundry = { applications: { api: { ApplicationV2: class { async _prepareContext() { return {}; } render() { renderCalls += 1; return { rendered: true, renderCalls }; } _onRender() {} }, HandlebarsApplicationMixin: (Base) => Base } } };
  try { return { module: await import(`./travel-event-runner.js?roundActionOrderCommitSmoke=${Date.now()}`), getRenderCalls: () => renderCalls }; }
  finally { if (previousFoundry === undefined) delete globalThis.foundry; else globalThis.foundry = previousFoundry; }
}

export async function runTravelEventRunnerV2RoundActionOrderCommitSmokeChecks() {
  const { module, getRenderCalls } = await importRunnerModule();
  const { ArcflightTravelEventRunner, prepareTravelV2RoundActionOrderCommitRunnerUpdate } = module;
  assertEqual(typeof prepareTravelV2RoundActionOrderCommitRunnerUpdate, "function", "runner order commit update helper should be exported");

  let chatCalls = 0, journalCalls = 0, socketCalls = 0, actorUpdateCalls = 0, itemUpdateCalls = 0;
  const previousGame = globalThis.game;
  const previousUi = globalThis.ui;
  const previousChatMessage = globalThis.ChatMessage;
  const previousJournalEntry = globalThis.JournalEntry;
  globalThis.game = { user: { isGM: true, id: "gm-1", name: "GM" }, socket: { emit: () => { socketCalls += 1; } }, actors: { get: () => ({ update: () => { actorUpdateCalls += 1; } }), values: () => [] }, items: { get: () => ({ update: () => { itemUpdateCalls += 1; } }), values: () => [] }, users: { filter: () => [] } };
  globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };
  globalThis.ChatMessage = { create: () => { chatCalls += 1; } };
  globalThis.JournalEntry = { create: () => { journalCalls += 1; } };

  try {
    const source = sessionFixture();
    const sourceBefore = snapshot(source);
    const update = prepareTravelV2RoundActionOrderCommitRunnerUpdate(source, { proposedOrder: ["engineer", "navigator", "watchmaster"], user: globalThis.game.user, commitRequested: true, timestamp: "2026-07-04T00:00:00.000Z" });
    assertSmoke(update.shouldUpdateSession && update.shouldRerender, "successful GM commit requests session replacement and rerender");
    assertSmoke(update.nextSession !== source, "successful GM commit returns a cloned session");
    assertEqual(update.nextSession.travelV2RoundActionOrder.rounds["0"].order.join(","), "engineer,navigator,watchmaster", "successful GM commit stores committed order");
    assertEqual(snapshot(source), sourceBefore, "successful GM commit does not mutate source session");

    const app = new ArcflightTravelEventRunner({ session: source, travelV2RoundActionOrderReorderRequested: true, travelV2ProposedRoundActionOrder: ["engineer", "navigator", "watchmaster"] });
    const rendered = await app.commitTravelV2RoundActionOrder({ timestamp: "2026-07-04T00:01:00.000Z" });
    assertSmoke(rendered.rendered, "app commit rerenders on success");
    assertEqual(app.session.travelV2RoundActionOrder.rounds["0"].order.join(","), "engineer,navigator,watchmaster", "app commit replaces local runner session with committed clone");
    assertEqual(app.uiState.travelV2RoundActionOrderReorderRequested, false, "app commit consumes local reorder request");
    assertEqual(app.uiState.travelV2ProposedRoundActionOrder.length, 0, "app commit clears proposed local order");
    assertSmoke(app.statusMessage.includes("Round action order committed"), "app commit sets a clear success status message");

    const duplicateBefore = snapshot(app.session);
    app.uiState.travelV2RoundActionOrderReorderRequested = true;
    app.uiState.travelV2ProposedRoundActionOrder = ["engineer", "navigator", "watchmaster"];
    const duplicate = await app.commitTravelV2RoundActionOrder({ timestamp: "2026-07-04T00:02:00.000Z" });
    assertSmoke(duplicate && !duplicate.shouldUpdateSession, "duplicate app commit returns blocked/non-update details");
    assertEqual(snapshot(app.session), duplicateBefore, "duplicate app commit is non-destructive");
    assertSmoke(app.uiState.travelV2RoundActionOrderCommitResult.duplicate, "duplicate app commit stores duplicate result");
    assertSmoke(app.statusMessage.includes("already committed"), "duplicate app commit sets clear status message");

    const invalidApp = new ArcflightTravelEventRunner({ session: sessionFixture(), travelV2RoundActionOrderReorderRequested: true, travelV2ProposedRoundActionOrder: ["engineer", "engineer", "bogus"] });
    const invalidBefore = snapshot(invalidApp.session);
    const invalid = await invalidApp.commitTravelV2RoundActionOrder({ timestamp: "2026-07-04T00:03:00.000Z" });
    assertSmoke(!invalid.shouldUpdateSession, "invalid proposed order blocks");
    assertEqual(snapshot(invalidApp.session), invalidBefore, "invalid proposed order does not mutate app session");
    assertSmoke(invalidApp.statusMessage.includes("repeats") || invalidApp.statusMessage.includes("missing") || invalidApp.statusMessage.includes("inactive"), "invalid proposed order sets clear status message");

    const nonGmApp = new ArcflightTravelEventRunner({ session: sessionFixture(), travelV2RoundActionOrderReorderRequested: true, travelV2ProposedRoundActionOrder: ["engineer", "navigator", "watchmaster"] });
    const nonGm = await nonGmApp.commitTravelV2RoundActionOrder({ user: { isGM: false }, isGM: false, timestamp: "2026-07-04T00:04:00.000Z" });
    assertSmoke(!nonGm.shouldUpdateSession, "non-GM app commit blocks");
    assertEqual(nonGmApp.uiState.travelV2RoundActionOrderCommitResult.session, null, "non-GM blocked commit redacts session result");
    assertSmoke(nonGmApp.statusMessage.includes("Only the GM"), "non-GM blocked commit sets clear status message");

    const completed = await new ArcflightTravelEventRunner({ session: sessionFixture({ status: "completed", completedAt: "2026-07-04T00:05:00.000Z" }), travelV2RoundActionOrderReorderRequested: true, travelV2ProposedRoundActionOrder: ["engineer", "navigator", "watchmaster"] }).commitTravelV2RoundActionOrder({ timestamp: "2026-07-04T00:05:00.000Z" });
    assertSmoke(!completed.shouldUpdateSession, "completed session blocks through helper");
    assertSmoke(completed.result.reason.includes("Completed Travel v2 runner sessions"), "completed session exposes helper blocked reason");
    const completedRound = await new ArcflightTravelEventRunner({ session: sessionFixture({ travelV2RoundResolutions: { records: [{ roundIndex: 0, roundNumber: 1 }] } }), travelV2RoundActionOrderReorderRequested: true, travelV2ProposedRoundActionOrder: ["engineer", "navigator", "watchmaster"] }).commitTravelV2RoundActionOrder({ timestamp: "2026-07-04T00:06:00.000Z" });
    assertSmoke(!completedRound.shouldUpdateSession, "completed round blocks through helper");
    assertSmoke(completedRound.result.blockedReasons.join("\n").includes("already completed"), "completed round exposes helper blocked reason");

    assertEqual(chatCalls, 0, "commit path should not create chat messages");
    assertEqual(journalCalls, 0, "commit path should not create journals");
    assertEqual(socketCalls, 0, "commit path should not emit sockets");
    assertEqual(actorUpdateCalls, 0, "commit path should not update actors");
    assertEqual(itemUpdateCalls, 0, "commit path should not update items");

    const fs = await import("node:fs");
    const appSource = fs.readFileSync(new URL("./travel-event-runner.js", import.meta.url), "utf8");
    const localSlice = appSource.slice(appSource.indexOf("prepareTravelV2RoundActionOrderCommitRunnerUpdate"), appSource.indexOf("#requestTravelV2StationBenefitReview"));
    for (const forbiddenCall of ["advanceTravelEventRunnerRound", "setTravelEventRunnerStationResult", "clearTravelEventRunnerStationResult", "commitTravelEventRunnerStationOrder", "finalizeTravelV2RoundOnRunnerSession", "completeTravelV2EventOnRunnerSession", "applyTravelV2PressureToRunnerSession", "correctTravelV2PressureApplicationOnRunnerSession", "applyTravelV2EventOutcomePackageToRunnerSession", "spendTravelV2RunnerMomentumDowngrade", "applyTravelV2ShipScarToActor", "repairTravelV2ShipScarOnActor", "applyTravelV2ActorApplicationPreview", ".roll(", "Check", "DC", "socket.emit", "ChatMessage", "JournalEntry"]) {
      assertSmoke(!localSlice.includes(forbiddenCall), `commit slice should not call forbidden helper or runtime mutation ${forbiddenCall}`);
    }
    const template = fs.readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
    assertSmoke(template.includes("data-arcflight-travel-v2-order-commit-request"), "template exposes explicit GM commit request path");
    const aggregate = fs.readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8");
    assertSmoke(aggregate.includes("runTravelEventRunnerV2RoundActionOrderCommitSmokeChecks"), "aggregate smoke runner includes app commit suite");
    assertSmoke(getRenderCalls() >= 1, "successful app commit requested render");
  } finally {
    if (previousGame === undefined) delete globalThis.game; else globalThis.game = previousGame;
    if (previousUi === undefined) delete globalThis.ui; else globalThis.ui = previousUi;
    if (previousChatMessage === undefined) delete globalThis.ChatMessage; else globalThis.ChatMessage = previousChatMessage;
    if (previousJournalEntry === undefined) delete globalThis.JournalEntry; else globalThis.JournalEntry = previousJournalEntry;
  }

  return { ok: true, checked: ["runner-helper-exported", "successful-gm-commit-replaces-local-session", "duplicate-non-destructive", "invalid-proposed-order-blocks", "non-gm-blocked-redacted", "completed-session-and-round-blocked", "no-side-effects", "source-scan-hard-limits", "explicit-template-commit-path", "aggregate-smoke-includes-suite"] };
}

export default runTravelEventRunnerV2RoundActionOrderCommitSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelEventRunnerV2RoundActionOrderCommitSmokeChecks().then((result) => { console.log("Travel event runner v2 round action order commit smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
