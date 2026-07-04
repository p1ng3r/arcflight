import { readFileSync } from "node:fs";
import { prepareTravelEventRunnerSessionLibraryState, loadTravelEventRunnerSessionFromLibrary } from "../helpers/travel-event-runner.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel event runner v2 session switch context isolation smoke check failed: ${message}`); }
function assertEqual(actual, expected, message) { if (actual !== expected) throw new Error(`Travel event runner v2 session switch context isolation smoke check failed: ${message}. Expected ${expected}, got ${actual}.`); }
function snapshot(value) { return JSON.stringify(value); }

const ORDER_A = Object.freeze(["engineer", "navigator", "watchmaster"]);
const BASE_ORDER = Object.freeze(["navigator", "engineer", "watchmaster"]);
const GM_USER = Object.freeze({ isGM: true, id: "gm-context", name: "Context GM" });
const PLAYER_USER = Object.freeze({ isGM: false, id: "player-context", name: "Context Player" });
const FORBIDDEN_NON_GM = Object.freeze(["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "Secret"]);

function orderStateFor(roundIndex, order, timestamp) {
  const auditRecord = {
    id: `round-action-order:${roundIndex}:${timestamp}`,
    type: "roundActionOrderCommit",
    roundIndex,
    roundNumber: roundIndex + 1,
    previousOrder: [...BASE_ORDER],
    committedOrder: [...order],
    order: [...order],
    timestamp,
    source: "gm-order-commit",
    userId: "secret-gm-id",
    userName: "Secret GM",
    isGM: true,
    mutationScope: "session-local-station-action-order-only",
    gmText: "secret GM text",
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
        userId: "secret-gm-id",
        userName: "Secret GM",
        auditRecord
      }
    },
    commitRecords: [auditRecord]
  };
}

function roundFixture(eventKey, roundIndex) {
  return {
    roundNumber: roundIndex + 1,
    title: `${eventKey} Round ${roundIndex + 1}`,
    activeStations: [...BASE_ORDER],
    stationPrompts: {
      navigator: { stationName: "Navigator" },
      engineer: { stationName: "Engineer" },
      watchmaster: { stationName: "Watchmaster" }
    },
    stationActionOrder: [...BASE_ORDER]
  };
}

function sessionFixture({ key, name, eventKey, eventName, eventTitle, category, status = "active", currentRoundIndex = 0, roundCount = 3, orderState = undefined } = {}) {
  return {
    key,
    name,
    status,
    currentRoundIndex,
    roundPhase: "stationOrders",
    event: {
      key: eventKey,
      id: eventKey,
      name: eventName,
      title: eventTitle,
      category,
      rounds: Array.from({ length: roundCount }, (_value, index) => roundFixture(eventKey, index))
    },
    roundResults: Array.from({ length: roundCount }, (_value, index) => ({
      roundIndex: index,
      stationResults: { navigator: null, engineer: null, watchmaster: null },
      selectedStationOptionLabels: { navigator: `${eventName} plot`, engineer: `${eventName} tune`, watchmaster: `${eventName} watch` },
      stationActions: {
        navigator: { type: "eventApproach", gmText: `${eventName} secret navigator`, applyPayload: { targetActorUuid: `Actor.secret.${key}` } },
        engineer: { type: "eventApproach", internalMutation: true },
        watchmaster: { type: "support", targetStationKey: "navigator" }
      },
      stationOrderCommitments: orderState?.rounds?.[String(index)] ? {
        navigator: { committed: true, source: "player" },
        engineer: { committed: true, source: "player" },
        watchmaster: { committed: true, source: "player" }
      } : {}
    })),
    ...(orderState ? { travelV2RoundActionOrder: orderState } : {})
  };
}

function libraryFixture() {
  const sessions = [
    sessionFixture({ key: "context-a", name: "Session A", eventKey: "event-a", eventName: "Event Alpha", eventTitle: "Event Alpha", category: "nebula", currentRoundIndex: 0, orderState: orderStateFor(0, ORDER_A, "2026-07-04T02:00:00.000Z") }),
    sessionFixture({ key: "context-b", name: "Session B", eventKey: "event-b", eventName: "Event Beta", eventTitle: "Event Beta", category: "storm", currentRoundIndex: 1 }),
    sessionFixture({ key: "context-c", name: "Session C", eventKey: "event-c", eventName: "Event Gamma", eventTitle: "Event Gamma", category: "ruins", status: "completed", currentRoundIndex: 2, orderState: orderStateFor(1, ["watchmaster", "engineer", "navigator"], "2026-07-04T02:05:00.000Z") })
  ];
  return { version: 1, sessions: Object.fromEntries(sessions.map((session) => [session.key, { key: session.key, name: session.name, eventKey: session.event.key, eventName: session.event.name, eventCategory: session.event.category, status: session.status, currentRoundIndex: session.currentRoundIndex, session }])) };
}

async function importRunnerModule() {
  const previousFoundry = globalThis.foundry;
  globalThis.foundry = { applications: { api: { ApplicationV2: class { async _prepareContext() { return {}; } render() { return { rendered: true }; } _onRender() {} }, HandlebarsApplicationMixin: (Base) => Base } } };
  try { return await import(`./travel-event-runner.js?sessionSwitchContextIsolationSmoke=${Date.now()}`); }
  finally { if (previousFoundry === undefined) delete globalThis.foundry; else globalThis.foundry = previousFoundry; }
}

function assertPlayerSafe(value, label) {
  const text = snapshot(value);
  for (const forbidden of FORBIDDEN_NON_GM) assertSmoke(!text.includes(forbidden), `${label} leaked ${forbidden}`);
}

function loadButton(key) {
  return { disabled: false, hasAttribute: (name) => name === "data-arcflight-runner-load-session", dataset: { arcflightRunnerLoadSession: key } };
}

async function clickLoad(clickHandler, key) {
  const button = loadButton(key);
  await clickHandler({ preventDefault: () => {}, target: { closest: () => button } });
}

function assertSelectedLibraryRow(state, key) {
  const selected = state.sessionLibrary.entries.filter((entry) => entry.selected).map((entry) => entry.key);
  assertEqual(selected.join(","), key, `library entries mark exactly one selected row for ${key}`);
  assertEqual(state.sessionLibrary.selectedSessionKey, key, `session library selectedSessionKey reflects ${key}`);
}

function assertContext(context, expected) {
  const { state } = context;
  assertEqual(context.selectedEventId, expected.eventKey, `${expected.key} context selectedEventId matches active event`);
  assertEqual(state.session.key, expected.key, `${expected.key} context session key matches active session`);
  assertEqual(state.session.event.key, expected.eventKey, `${expected.key} state selected event key matches active session`);
  assertEqual(state.event.key, expected.eventKey, `${expected.key} event key matches active session`);
  assertEqual(state.event.name, expected.eventName, `${expected.key} event name matches active session`);
  assertEqual(state.event.title ?? state.event.name, expected.eventTitle ?? expected.eventName, `${expected.key} event title/name matches active session`);
  assertEqual(state.event.category, expected.category, `${expected.key} event category matches active session`);
  assertEqual(state.session.currentRoundIndex, expected.roundIndex, `${expected.key} current round index matches active session`);
  assertEqual(state.currentRoundNumber, expected.roundIndex + 1, `${expected.key} current round number matches active session`);
  assertEqual(state.currentRound.title, `${expected.eventKey} Round ${expected.roundIndex + 1}`, `${expected.key} round title matches active session`);
  assertSelectedLibraryRow(state, expected.key);
  const display = state.travelV2PreviewPanel.roundActionOrderDisplay;
  assertEqual(display.roundIndex, expected.roundIndex, `${expected.key} preview round index matches active session`);
  assertEqual(display.rows.map((row) => row.stationKey).join(","), expected.order.join(","), `${expected.key} preview rows match active session only`);
  assertEqual(display.canPersistCommittedOrder, expected.hasCurrentCommit, `${expected.key} committed-order status matches active session only`);
  assertSmoke(context.statusMessage.includes(expected.sessionName), `${expected.key} statusMessage references newly loaded session`);
  for (const previousName of expected.notNames) assertSmoke(!context.statusMessage.includes(previousName), `${expected.key} statusMessage does not retain ${previousName}`);
}

export async function runTravelEventRunnerV2SessionSwitchContextIsolationSmokeChecks() {
  const checked = [];
  const library = libraryFixture();
  const beforeLibrary = snapshot(library);
  const beforeSessions = snapshot(library.sessions);
  for (const key of ["context-a", "context-b", "context-c"]) assertSmoke(loadTravelEventRunnerSessionFromLibrary(key, { runnerSessionLibrary: library }).ok, `${key} loads from fixture library`);

  const previousGame = globalThis.game;
  const previousUi = globalThis.ui;
  globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };
  globalThis.game = { user: GM_USER, actors: { values: () => [] }, users: { filter: () => [] }, settings: { get: () => library } };
  try {
    const { ArcflightTravelEventRunner } = await importRunnerModule();
    const app = new ArcflightTravelEventRunner({ session: library.sessions["context-a"].session, selectedSessionKey: "context-a", selectedEventId: "event-a", travelV2RoundActionOrderReorderRequested: true, travelV2ProposedRoundActionOrder: ["watchmaster", "navigator"] });
    app.uiState.travelV2RoundActionOrderCommitResult = { ok: true, committed: true, committedOrder: [...ORDER_A], roundIndex: 0, roundNumber: 1 };
    app.uiState.travelV2RoundActionOrderPersistResult = { ok: true, persisted: true, persistedRecord: { order: [...ORDER_A] } };
    let clickHandler = null;
    app.render = async () => ({ rendered: true });
    app.element = { contains: () => true, removeEventListener: () => {}, addEventListener: (type, handler) => { if (type === "click") clickHandler = handler; }, closest: () => null, querySelector: () => null };
    app._onRender({}, {});
    assertSmoke(typeof clickHandler === "function", "runner click handler is registered for session switching");

    await clickLoad(clickHandler, "context-a");
    assertContext(await app._prepareContext({}), { key: "context-a", sessionName: "Session A", eventKey: "event-a", eventName: "Event Alpha", eventTitle: "Event Alpha", category: "nebula", roundIndex: 0, order: ORDER_A, hasCurrentCommit: true, notNames: ["Session B", "Session C"] });

    await clickLoad(clickHandler, "context-b");
    assertContext(await app._prepareContext({}), { key: "context-b", sessionName: "Session B", eventKey: "event-b", eventName: "Event Beta", eventTitle: "Event Beta", category: "storm", roundIndex: 1, order: BASE_ORDER, hasCurrentCommit: false, notNames: ["Session A", "Session C"] });
    assertEqual(app.uiState.travelV2RoundActionOrderCommitResult, null, "switching to B clears A commit result");
    assertEqual(app.uiState.travelV2RoundActionOrderPersistResult, null, "switching to B clears A persistence result");
    assertEqual(snapshot(app.uiState.travelV2ProposedRoundActionOrder), "[]", "switching to B does not create a proposed order");

    await clickLoad(clickHandler, "context-c");
    const contextC = await app._prepareContext({});
    assertContext(contextC, { key: "context-c", sessionName: "Session C", eventKey: "event-c", eventName: "Event Gamma", eventTitle: "Event Gamma", category: "ruins", roundIndex: 2, order: BASE_ORDER, hasCurrentCommit: false, notNames: ["Session A", "Session B"] });
    assertSmoke(contextC.state.isCompleted, "switching to C shows completed state");

    await clickLoad(clickHandler, "context-a");
    assertContext(await app._prepareContext({}), { key: "context-a", sessionName: "Session A", eventKey: "event-a", eventName: "Event Alpha", eventTitle: "Event Alpha", category: "nebula", roundIndex: 0, order: ORDER_A, hasCurrentCommit: true, notNames: ["Session B", "Session C"] });
    checked.push("A → B → C → A updates selected session, event, round, preview rows, status text, selected library row, and committed-order status without ghosts");
  } finally {
    if (previousGame === undefined) delete globalThis.game; else globalThis.game = previousGame;
    if (previousUi === undefined) delete globalThis.ui; else globalThis.ui = previousUi;
  }

  const previousGameForPlayer = globalThis.game;
  globalThis.game = { user: PLAYER_USER, actors: { values: () => [] }, users: { filter: () => [] }, settings: { get: () => library } };
  try {
    const { ArcflightTravelEventRunner } = await importRunnerModule();
    for (const key of ["context-a", "context-b", "context-c", "context-a"]) {
      const app = new ArcflightTravelEventRunner({ session: library.sessions[key].session, selectedSessionKey: key, selectedEventId: library.sessions[key].eventKey });
      const context = await app._prepareContext({});
      assertPlayerSafe(context.state, `non-GM context for ${key}`);
    }
    checked.push("non-GM render/template-facing state remains player-safe after every session switch context");
  } finally {
    if (previousGameForPlayer === undefined) delete globalThis.game; else globalThis.game = previousGameForPlayer;
  }

  assertEqual(snapshot(library), beforeLibrary, "session switching does not mutate the library");
  assertEqual(snapshot(library.sessions), beforeSessions, "session switching does not mutate saved sessions");
  assertEqual(prepareTravelEventRunnerSessionLibraryState({ runnerSessionLibrary: library, selectedSessionKey: "context-a", user: GM_USER, isGM: true }).entries.length, 3, "session switching keeps all library entry projections available");
  assertEqual(library.sessions["context-a"].session.travelV2RoundActionOrder.commitRecords.length, 1, "commitRecords are not duplicated");
  const afterText = snapshot(library);
  assertSmoke(!afterText.includes("travelV2ProposedRoundActionOrder"), "no proposed order is created");
  assertSmoke(!afterText.includes("travelV2RoundActionOrderCommitResult"), "no commit result is created");
  assertSmoke(!afterText.includes("travelV2RoundActionOrderPersistResult"), "no persistence result is created");
  assertSmoke(!afterText.includes("persistenceRecords") && !afterText.includes("persistRecords"), "no persistence records are created");
  checked.push("switching sessions creates no proposed order, commit result, persistence result, new records, duplicated commit records, or persistence records and mutates no library, entry, or session source data");

  const aggregate = readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8");
  assertSmoke(aggregate.includes("runTravelEventRunnerV2SessionSwitchContextIsolationSmokeChecks"), "aggregate Travel v2 smoke includes session switch context isolation suite");
  checked.push("aggregate Travel v2 smoke includes session switch context isolation suite");

  return { ok: true, checked };
}

export default runTravelEventRunnerV2SessionSwitchContextIsolationSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelEventRunnerV2SessionSwitchContextIsolationSmokeChecks().then((result) => { console.log("Travel event runner v2 session switch context isolation smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
