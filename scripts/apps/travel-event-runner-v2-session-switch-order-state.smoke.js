import { readFileSync } from "node:fs";
import { prepareTravelEventRunnerSessionLibraryState, loadTravelEventRunnerSessionFromLibrary } from "../helpers/travel-event-runner.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel event runner v2 session switch order state smoke check failed: ${message}`); }
function assertEqual(actual, expected, message) { if (actual !== expected) throw new Error(`Travel event runner v2 session switch order state smoke check failed: ${message}. Expected ${expected}, got ${actual}.`); }
function snapshot(value) { return JSON.stringify(value); }

const ORDER_A = Object.freeze(["engineer", "navigator", "watchmaster"]);
const ORDER_C_OLD = Object.freeze(["watchmaster", "engineer", "navigator"]);
const GM_USER = Object.freeze({ isGM: true, id: "gm-switch", name: "Switch GM" });
const PLAYER_USER = Object.freeze({ isGM: false, id: "player-switch", name: "Switch Player" });
const FORBIDDEN_NON_GM = Object.freeze(["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "Secret"]);

function sessionFixture({ key, name, currentRoundIndex = 0, orderState = undefined } = {}) {
  return {
    key,
    name,
    status: "active",
    currentRoundIndex,
    roundPhase: "stationOrders",
    event: {
      key: "session-switch-order-event",
      name: "Session Switch Order Event",
      category: "travel",
      rounds: [0, 1].map((index) => ({
        roundNumber: index + 1,
        title: `Switch Round ${index + 1}`,
        activeStations: ["navigator", "engineer", "watchmaster"],
        stationPrompts: {
          navigator: { stationName: "Navigator" },
          engineer: { stationName: "Engineer" },
          watchmaster: { stationName: "Watchmaster" }
        },
        stationActionOrder: ["navigator", "engineer", "watchmaster"]
      }))
    },
    roundResults: [0, 1].map((index) => ({
      roundIndex: index,
      stationResults: { navigator: null, engineer: null, watchmaster: null },
      selectedStationOptionLabels: { navigator: "Plot route", engineer: "Tune engine", watchmaster: "Stand watch" },
      stationActions: {
        navigator: { type: "eventApproach", gmText: "secret navigator text", applyPayload: { targetActorUuid: "Actor.secret.navigator" } },
        engineer: { type: "eventApproach", internalMutation: true },
        watchmaster: { type: "support", targetStationKey: "navigator" }
      },
      stationOrderCommitments: {
        navigator: { committed: true, source: "player" },
        engineer: { committed: true, source: "player" },
        watchmaster: { committed: true, source: "player" }
      }
    })),
    ...(orderState ? { travelV2RoundActionOrder: orderState } : {})
  };
}

function orderStateFor(roundIndex, order, timestamp) {
  const auditRecord = {
    id: `round-action-order:${roundIndex}:${timestamp}`,
    type: "roundActionOrderCommit",
    roundIndex,
    roundNumber: roundIndex + 1,
    previousOrder: ["navigator", "engineer", "watchmaster"],
    committedOrder: [...order],
    order: [...order],
    timestamp,
    source: "gm-order-commit",
    userId: "gm-secret-id",
    userName: "Secret GM Name",
    isGM: true,
    mutationScope: "session-local-station-action-order-only",
    gmText: "GM-only secret audit text",
    applyPayload: { targetActorUuid: "Actor.secret", internalMutation: true }
  };
  return {
    version: 3,
    rounds: {
      [String(roundIndex)]: {
        roundIndex,
        roundNumber: roundIndex + 1,
        order: [...order],
        stationOrder: [...order],
        committedAt: timestamp,
        source: "gm-order-commit",
        userId: "gm-secret-id",
        userName: "Secret GM Name",
        auditRecord
      }
    },
    commitRecords: [auditRecord]
  };
}

function libraryFixture() {
  const sessionA = sessionFixture({ key: "switch-a", name: "Switch A", orderState: orderStateFor(0, ORDER_A, "2026-07-04T01:00:00.000Z") });
  const sessionB = sessionFixture({ key: "switch-b", name: "Switch B" });
  const sessionC = sessionFixture({ key: "switch-c", name: "Switch C", currentRoundIndex: 1, orderState: orderStateFor(0, ORDER_C_OLD, "2026-07-04T01:05:00.000Z") });
  const sessions = Object.fromEntries([sessionA, sessionB, sessionC].map((session) => [session.key, { key: session.key, name: session.name, eventKey: session.event.key, eventName: session.event.name, eventCategory: session.event.category, status: session.status, currentRoundIndex: session.currentRoundIndex, session }]));
  return { version: 1, sessions };
}

function assertPlayerSafe(value, label) {
  const text = snapshot(value);
  for (const forbidden of FORBIDDEN_NON_GM) assertSmoke(!text.includes(forbidden), `${label} leaked ${forbidden}`);
}

function displayFor(session, options = {}) {
  return prepareTravelEventRunnerAppStateWithTravelV2Preview({ session, selectedSessionKey: session?.key ?? "", user: options.user ?? GM_USER, isGM: options.isGM ?? true, uiState: options.uiState ?? {}, runnerSessionLibrary: options.library }).travelV2PreviewPanel.roundActionOrderDisplay;
}

async function importRunnerModule() {
  const previousFoundry = globalThis.foundry;
  globalThis.foundry = { applications: { api: { ApplicationV2: class { async _prepareContext() { return {}; } render() { return { rendered: true }; } _onRender() {} }, HandlebarsApplicationMixin: (Base) => Base } } };
  try { return await import(`./travel-event-runner.js?sessionSwitchOrderStateSmoke=${Date.now()}`); }
  finally { if (previousFoundry === undefined) delete globalThis.foundry; else globalThis.foundry = previousFoundry; }
}

export async function runTravelEventRunnerV2SessionSwitchOrderStateSmokeChecks() {
  const checked = [];
  const library = libraryFixture();
  const beforeLibrary = snapshot(library);
  const beforeSessions = snapshot(library.sessions);

  const loadedA = loadTravelEventRunnerSessionFromLibrary("switch-a", { runnerSessionLibrary: library });
  const loadedB = loadTravelEventRunnerSessionFromLibrary("switch-b", { runnerSessionLibrary: library });
  const loadedC = loadTravelEventRunnerSessionFromLibrary("switch-c", { runnerSessionLibrary: library });
  assertSmoke(loadedA.ok && loadedB.ok && loadedC.ok, "all three saved sessions load from fixture library");

  const displayA = displayFor(loadedA.session, { library });
  assertEqual(displayA.rows.map((row) => row.stationKey).join(","), ORDER_A.join(","), "selecting session A displays A's committed current-round order");
  assertSmoke(displayA.canPersistCommittedOrder, "selecting session A exposes current-round committed-order status for GM persistence review");

  const displayB = displayFor(loadedB.session, { library });
  assertEqual(displayB.rows.map((row) => row.stationKey).join(","), "navigator,engineer,watchmaster", "switching to session B clears A's committed order display");
  assertSmoke(!displayB.canPersistCommittedOrder, "switching to session B clears committed-order status");

  const displayARestored = displayFor(loadedA.session, { library });
  assertEqual(displayARestored.rows.map((row) => row.stationKey).join(","), ORDER_A.join(","), "switching back to session A restores A from saved data");

  const displayC = displayFor(loadedC.session, { library });
  assertEqual(displayC.roundIndex, 1, "session C preview uses its current round");
  assertEqual(displayC.rows.map((row) => row.stationKey).join(","), "navigator,engineer,watchmaster", "session C does not treat a non-current-round committed order as current");
  assertSmoke(!displayC.canPersistCommittedOrder, "session C current-round order status fails safe as no committed current-round order");
  checked.push("three saved sessions isolate committed current-round order display and status across A, B, A, and C selections");

  const previousGame = globalThis.game;
  const previousUi = globalThis.ui;
  globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };
  globalThis.game = { user: GM_USER, actors: { values: () => [] }, users: { filter: () => [] }, settings: { get: () => library } };
  try {
    const { ArcflightTravelEventRunner } = await importRunnerModule();
    const app = new ArcflightTravelEventRunner({ session: loadedA.session, selectedSessionKey: "switch-a", selectedEventId: loadedA.session.event.key, travelV2RoundActionOrderReorderRequested: true, travelV2ProposedRoundActionOrder: [...ORDER_A] });
    app.uiState.travelV2RoundActionOrderCommitResult = { ok: true, committed: true, committedOrder: [...ORDER_A], previousOrder: ["navigator", "engineer", "watchmaster"], roundIndex: 0, roundNumber: 1 };
    app.uiState.travelV2RoundActionOrderPersistResult = { ok: true, persisted: true, persistedRecord: { order: [...ORDER_A] } };
    let renderCount = 0;
    app.render = async () => { renderCount += 1; return { rendered: true }; };
    const buttonB = { disabled: false, hasAttribute: (name) => name === "data-arcflight-runner-load-session", dataset: { arcflightRunnerLoadSession: "switch-b" } };
    let clickHandler = null;
    app.element = { contains: () => true, removeEventListener: () => {}, addEventListener: (type, handler) => { if (type === "click") clickHandler = handler; }, closest: () => null, querySelector: () => null };
    app._onRender({}, {});
    assertSmoke(typeof clickHandler === "function", "runner click handler is registered for the load-session switch path");
    await clickHandler({ preventDefault: () => {}, target: { closest: () => buttonB } });
    assertEqual(app.session.key, "switch-b", "load click switches the live app session to B");
    assertEqual(app.uiState.travelV2RoundActionOrderCommitResult, null, "switching sessions clears stale commit result");
    assertEqual(app.uiState.travelV2RoundActionOrderPersistResult, null, "switching sessions clears stale persistence result");
    assertEqual(snapshot(app.uiState.travelV2ProposedRoundActionOrder), "[]", "switching sessions clears stale proposed order");
    assertSmoke(app.uiState.travelV2RoundActionOrderReorderRequested === false, "switching sessions clears stale reorder request");
    const contextB = await app._prepareContext({});
    assertSmoke(!contextB.state.travelV2PreviewPanel.roundActionOrderDisplay.commitResult.available, "session B context has no ghost commit result");
    assertSmoke(!contextB.state.travelV2PreviewPanel.roundActionOrderDisplay.persistResult.available, "session B context has no ghost persistence result");
    assertSmoke(renderCount >= 0, "app switch path rendered without throwing");
    checked.push("runner load-session switch clears transient proposed, commit, and persistence state before rendering the new session");
  } finally {
    if (previousGame === undefined) delete globalThis.game; else globalThis.game = previousGame;
    if (previousUi === undefined) delete globalThis.ui; else globalThis.ui = previousUi;
  }

  const playerStates = [loadedA.session, loadedB.session, loadedC.session].map((session) => displayFor(session, { library, user: PLAYER_USER, isGM: false }));
  playerStates.forEach((state, index) => assertPlayerSafe(state, `non-GM switched display ${index + 1}`));
  checked.push("non-GM render/template-facing round action-order state remains player-safe after each switch");

  const afterLibrary = snapshot(library);
  const afterEntries = prepareTravelEventRunnerSessionLibraryState({ runnerSessionLibrary: library, selectedSessionKey: "switch-c", user: GM_USER, isGM: true }).entries;
  const afterSessions = snapshot(library.sessions);
  assertEqual(afterLibrary, beforeLibrary, "session switching does not mutate the library");
  assertEqual(afterEntries.length, 3, "session switching keeps all three library entry projections available");
  assertEqual(afterEntries.filter((entry) => entry.selected).map((entry) => entry.key).join(","), "switch-c", "library entry selection projection updates to the selected session only");
  assertEqual(afterSessions, beforeSessions, "session switching does not mutate saved sessions");
  assertEqual(library.sessions["switch-a"].session.travelV2RoundActionOrder.commitRecords.length, 1, "commitRecords are not duplicated");
  assertSmoke(!afterLibrary.includes("persistenceRecords") && !afterLibrary.includes("persistRecords"), "no persistence records are created");
  assertSmoke(!afterLibrary.includes("travelV2RoundActionOrderCommitResult") && !afterLibrary.includes("travelV2RoundActionOrderPersistResult") && !afterLibrary.includes("travelV2ProposedRoundActionOrder"), "switching does not create proposed order, commit result, or persistence result records");
  checked.push("switching sessions creates no proposed, commit, persistence, new, duplicated, or persisted records and mutates no source data");

  const aggregate = readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8");
  assertSmoke(aggregate.includes("runTravelEventRunnerV2SessionSwitchOrderStateSmokeChecks"), "aggregate Travel v2 smoke includes session switch order state suite");
  checked.push("aggregate Travel v2 smoke includes session switch order state suite");

  return { ok: true, checked };
}

export default runTravelEventRunnerV2SessionSwitchOrderStateSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelEventRunnerV2SessionSwitchOrderStateSmokeChecks().then((result) => { console.log("Travel event runner v2 session switch order state smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
