import { readFileSync } from "node:fs";
import { loadTravelEventRunnerSessionFromLibrary } from "../helpers/travel-event-runner.js";
import { prepareTravelV2RoundActionOrderState } from "../helpers/travel-v2-round-action-order-state.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel event runner v2 round action order closeout smoke check failed: ${message}`); }
function assertEqual(actual, expected, message) { if (actual !== expected) throw new Error(`Travel event runner v2 round action order closeout smoke check failed: ${message}. Expected ${expected}, got ${actual}.`); }
function snapshot(value) { return JSON.stringify(value); }

const COMMITTED_ORDER = Object.freeze(["engineer", "navigator", "watchmaster"]);
const GM_USER = Object.freeze({ isGM: true, id: "gm-1", name: "GM" });

function sessionFixture(overrides = {}) {
  return {
    key: "runner-order-closeout-fixture",
    name: "Round Action Order Closeout Fixture",
    status: "active",
    currentRoundIndex: 0,
    roundPhase: "stationOrders",
    event: {
      key: "round-action-order-closeout-event",
      name: "Round Action Order Closeout Event",
      category: "travel",
      rounds: [{
        roundNumber: 1,
        title: "Closeout Round",
        activeStations: ["navigator", "engineer", "watchmaster"],
        stationPrompts: {
          navigator: { stationName: "Navigator" },
          engineer: { stationName: "Engineer" },
          watchmaster: { stationName: "Watchmaster" }
        },
        stationActionOrder: ["navigator", "engineer", "watchmaster"]
      }]
    },
    roundResults: [{
      roundIndex: 0,
      stationResults: { navigator: null, engineer: null, watchmaster: null },
      selectedStationOptionLabels: { navigator: "Plot the route", engineer: "Support Navigator", watchmaster: "Watch the void" },
      stationActions: {
        navigator: { type: "eventApproach", gmText: "secret route", applyPayload: { targetActorUuid: "Actor.secret" } },
        engineer: { type: "support", targetStationKey: "navigator" },
        watchmaster: { type: "eventApproach", internalMutation: true }
      },
      stationOrderCommitments: {
        navigator: { committed: true, source: "player" },
        engineer: { committed: true, source: "player" },
        watchmaster: { committed: true, source: "player" }
      }
    }],
    ...overrides
  };
}

function libraryWith(session) {
  return {
    version: 1,
    sessions: {
      [session.key]: {
        key: session.key,
        name: session.name ?? "Session",
        eventKey: session.event?.key ?? "event",
        eventName: session.event?.name ?? "Event",
        eventCategory: session.event?.category ?? "travel",
        status: session.status,
        currentRoundIndex: session.currentRoundIndex,
        session
      }
    }
  };
}

function assertPlayerSafe(value, label) {
  const text = snapshot(value);
  for (const forbidden of ["gmText", "gmSummary", "gmMechanicalNotes", "applyPayload", "internalMutation", "targetActorUuid", "queueInternals", "GM-only", "gmOnly"]) {
    assertSmoke(!text.includes(forbidden), `${label} leaked ${forbidden}`);
  }
}

async function importRunnerModule() {
  const previousFoundry = globalThis.foundry;
  let renderCalls = 0;
  globalThis.foundry = { applications: { api: { ApplicationV2: class { async _prepareContext() { return {}; } render() { renderCalls += 1; return { rendered: true, renderCalls }; } _onRender() {} }, HandlebarsApplicationMixin: (Base) => Base } } };
  try { return { module: await import(`./travel-event-runner.js?roundActionOrderCloseoutSmoke=${Date.now()}`), getRenderCalls: () => renderCalls }; }
  finally { if (previousFoundry === undefined) delete globalThis.foundry; else globalThis.foundry = previousFoundry; }
}

export async function runTravelEventRunnerV2RoundActionOrderCloseoutSmokeChecks() {
  const { module, getRenderCalls } = await importRunnerModule();
  const { ArcflightTravelEventRunner } = module;
  const checked = [];

  let chatCalls = 0, journalCalls = 0, socketCalls = 0, actorUpdateCalls = 0, itemUpdateCalls = 0;
  const previousGame = globalThis.game, previousUi = globalThis.ui, previousChatMessage = globalThis.ChatMessage, previousJournalEntry = globalThis.JournalEntry;
  globalThis.game = { user: GM_USER, socket: { emit: () => { socketCalls += 1; } }, actors: { get: () => ({ update: () => { actorUpdateCalls += 1; } }), values: () => [] }, items: { get: () => ({ update: () => { itemUpdateCalls += 1; } }), values: () => [] }, users: { filter: () => [] } };
  globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };
  globalThis.ChatMessage = { create: () => { chatCalls += 1; } };
  globalThis.JournalEntry = { create: () => { journalCalls += 1; } };

  try {
    const app = new ArcflightTravelEventRunner({ session: sessionFixture() });
    const initial = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: app.session, user: GM_USER, isGM: true });
    assertEqual(initial.travelV2PreviewPanel.roundActionOrderDisplay.rows.map((row) => row.stationKey).join(","), "navigator,engineer,watchmaster", "initial display uses current authored order");
    checked.push("compute/display current order");

    app.uiState.travelV2RoundActionOrderReorderRequested = true;
    app.uiState.travelV2ProposedRoundActionOrder = [...COMMITTED_ORDER];
    const review = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: app.session, uiState: app.uiState, user: GM_USER, isGM: true });
    assertSmoke(review.travelV2PreviewPanel.roundActionOrderDisplay.reorderRequest.ready, "explicit GM reorder review is ready");
    assertEqual(review.travelV2PreviewPanel.roundActionOrderDisplay.reorderRequest.proposedRows.map((row) => row.stationKey).join(","), COMMITTED_ORDER.join(","), "review displays proposed order");
    checked.push("request GM reorder review");

    const commitRender = await app.commitTravelV2RoundActionOrder({ user: GM_USER, isGM: true, timestamp: "2026-07-04T00:10:00.000Z" });
    assertSmoke(commitRender?.rendered, "app commit rerenders");
    assertEqual(app.session.travelV2RoundActionOrder.commitRecords.length, 1, "local commit creates one audit record");
    const commitDisplay = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: app.session, uiState: app.uiState, user: GM_USER, isGM: true });
    assertEqual(commitDisplay.travelV2PreviewPanel.roundActionOrderDisplay.rows.map((row) => row.stationKey).join(","), COMMITTED_ORDER.join(","), "commit result display uses committed order");
    assertSmoke(commitDisplay.travelV2PreviewPanel.roundActionOrderDisplay.commitResult.hasFeedback, "commit feedback remains visible in local UI state");
    checked.push("commit reviewed order locally and display result");

    const afterCommitSession = snapshot(app.session);
    const persistRender = await app.persistCommittedTravelV2RoundActionOrder({ user: GM_USER, isGM: true, dryRun: true, library: libraryWith(sessionFixture({ key: app.session.key, name: app.session.name })), now: "2026-07-04T00:11:00.000Z" });
    const persistResult = app.uiState.travelV2RoundActionOrderPersistResult;
    assertSmoke(persistRender?.rendered, "app persistence rerenders on successful save");
    assertSmoke(persistResult.persisted, "committed order persists through runner session library bridge");
    assertEqual(snapshot(app.session), afterCommitSession, "app persistence result remains local UI feedback and does not mutate local session");
    assertSmoke(app.uiState.travelV2RoundActionOrderPersistResult.persisted, "app stores persistence result in local UI feedback");
    checked.push("persist committed order through existing bridge without mutating local session");

    app.uiState.travelV2RoundActionOrderReorderRequested = true;
    app.uiState.travelV2ProposedRoundActionOrder = [...COMMITTED_ORDER];
    const duplicateCommit = await app.commitTravelV2RoundActionOrder({ user: GM_USER, isGM: true, timestamp: "2026-07-04T00:12:00.000Z" });
    assertSmoke(duplicateCommit.result.duplicate, "duplicate commit is a no-op");
    assertEqual(app.session.travelV2RoundActionOrder.commitRecords.length, 1, "duplicate commit does not create duplicate commit records");
    const duplicatePersist = await app.persistCommittedTravelV2RoundActionOrder({ user: GM_USER, isGM: true, dryRun: true, library: persistResult.library, now: "2026-07-04T00:13:00.000Z" });
    assertSmoke(duplicatePersist.duplicate, "duplicate persistence is a no-op");
    assertEqual(Object.keys(duplicatePersist.library.sessions).length, 1, "duplicate persistence does not create duplicate saved records");
    checked.push("duplicate/no-op commit and persist paths do not duplicate records");

    const loaded = loadTravelEventRunnerSessionFromLibrary(app.session.key, { library: persistResult.library });
    assertSmoke(loaded.ok, "saved runner session reload succeeds");
    assertEqual(loaded.session.travelV2RoundActionOrder.rounds["0"].order.join(","), COMMITTED_ORDER.join(","), "committed order survives save/load through existing runner session library path");
    const loadedOrderState = prepareTravelV2RoundActionOrderState(loaded.session, { user: GM_USER, isGM: true });
    assertEqual(loadedOrderState.orderedStationKeys.join(","), COMMITTED_ORDER.join(","), "helper display after reload sees persisted committed order");
    const loadedPreview = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: loaded.session, user: GM_USER, isGM: true });
    assertEqual(loadedPreview.travelV2PreviewPanel.roundActionOrderDisplay.rows.map((row) => row.stationKey).join(","), COMMITTED_ORDER.join(","), "preview display after reload sees persisted committed order");
    checked.push("reload/load saved session and display persisted committed order");

    const nonGmLoadedPreview = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: loaded.session, user: { isGM: false, id: "p1", name: "Player" }, isGM: false, uiState: { travelV2RoundActionOrderReorderRequested: true, travelV2ProposedRoundActionOrder: COMMITTED_ORDER } });
    assertPlayerSafe(nonGmLoadedPreview.travelV2PreviewPanel.roundActionOrderDisplay, "non-GM round action order display");
    assertSmoke(!nonGmLoadedPreview.travelV2PreviewPanel.roundActionOrderDisplay.reorderRequest.ready, "non-GM reorder review remains redacted after reload");
    assertEqual(nonGmLoadedPreview.travelV2PreviewPanel.roundActionOrderDisplay.reorderRequest.proposedRows.length, 0, "non-GM proposed rows are redacted after reload");
    checked.push("non-GM display remains player-safe/redacted");

    assertEqual(chatCalls, 0, "closeout lifecycle should not create chat messages");
    assertEqual(journalCalls, 0, "closeout lifecycle should not create journals");
    assertEqual(socketCalls, 0, "closeout lifecycle dry-run should not emit sockets");
    assertEqual(actorUpdateCalls, 0, "closeout lifecycle should not update actors");
    assertEqual(itemUpdateCalls, 0, "closeout lifecycle should not update items");
    assertSmoke(getRenderCalls() >= 2, "commit and persist actions requested local rerenders");

    const aggregate = readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8");
    assertSmoke(aggregate.includes("runTravelEventRunnerV2RoundActionOrderCloseoutSmokeChecks"), "aggregate Travel v2 smoke includes the closeout suite");
    checked.push("aggregate Travel v2 smoke includes closeout suite and lifecycle has no side effects");
  } finally {
    if (previousGame === undefined) delete globalThis.game; else globalThis.game = previousGame;
    if (previousUi === undefined) delete globalThis.ui; else globalThis.ui = previousUi;
    if (previousChatMessage === undefined) delete globalThis.ChatMessage; else globalThis.ChatMessage = previousChatMessage;
    if (previousJournalEntry === undefined) delete globalThis.JournalEntry; else globalThis.JournalEntry = previousJournalEntry;
  }

  return { ok: true, checked };
}

export default runTravelEventRunnerV2RoundActionOrderCloseoutSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelEventRunnerV2RoundActionOrderCloseoutSmokeChecks().then((result) => { console.log("Travel event runner v2 round action order closeout smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
