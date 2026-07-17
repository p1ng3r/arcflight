import assert from "node:assert/strict";
import fs from "node:fs";

const ORDER = ["navigator", "engineer", "watchmaster"];
const GM = { isGM: true, id: "gm", name: "GM" };
const PLAYER = { isGM: false, id: "player", name: "Player" };

function sessionFixture(overrides = {}) {
  return {
    key: "drag-session",
    status: "active",
    currentRoundIndex: 0,
    event: { rounds: [{ roundNumber: 1, activeStations: [...ORDER], stationPrompts: {}, stationActionOrder: [...ORDER] }] },
    roundResults: [{ roundIndex: 0, stationResults: { navigator: null, engineer: null, watchmaster: null }, stationActions: {} }],
    ...overrides
  };
}

function dataTransfer(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    effectAllowed: "",
    dropEffect: "",
    setData(type, value) { store.set(type, value); },
    getData(type) { return store.get(type) ?? ""; },
    dump() { return Object.fromEntries(store); }
  };
}

function node({ stationKey = "", top = 0, bottom = 10, isList = false, parent = null, root = null } = {}) {
  const element = {
    dataset: stationKey ? { stationKey } : {},
    parent,
    root: root ?? null,
    children: [],
    closest(selector) {
      if (selector.includes("drag-row") && !isList && this.dataset?.stationKey) return this;
      if (selector.includes("drag-list")) return isList ? this : this.parent;
      return null;
    },
    contains(other) {
      if (other === this) return true;
      return this.children.includes(other) || this.children.some((child) => child.contains?.(other));
    },
    querySelectorAll(selector) {
      return selector.includes("drag-row") ? [...this.children] : [];
    },
    getBoundingClientRect() { return { top, bottom }; },
    addEventListener(type, handler) { this.listeners ??= {}; this.listeners[type] ??= new Set(); this.listeners[type].add(handler); },
    removeEventListener(type, handler) { this.listeners?.[type]?.delete(handler); }
  };
  if (parent) parent.children.push(element);
  return element;
}

function dom(bounds = [[0, 10], [10, 20], [20, 30]]) {
  const root = node({ isList: true });
  const list = node({ isList: true, parent: root });
  const rows = ORDER.map((stationKey, index) => node({ stationKey, top: bounds[index][0], bottom: bounds[index][1], parent: list }));
  return { root, list, rows };
}

function eventFor(target, root, transfer = dataTransfer(), clientY = 0) {
  let prevented = 0;
  return { target, currentTarget: root, dataTransfer: transfer, clientY, preventDefault() { prevented += 1; }, prevented: () => prevented };
}

async function importRuntime() {
  return import(`./travel-event-runner-v2-round-action-order-drag-runtime.js?dragRuntimeSmoke=${Date.now()}`);
}

async function importRunner() {
  globalThis.foundry = { applications: { api: { ApplicationV2: class { render() { return {}; } async _prepareContext() { return {}; } _onRender() {} }, HandlebarsApplicationMixin: (Base) => Base } } };
  return import(`./travel-event-runner.js?dragRuntimeSmoke=${Date.now()}`);
}

function appFixture(session = sessionFixture()) {
  return {
    session,
    selectedSessionKey: session?.key ?? "drag-session",
    uiState: { travelV2ProposedRoundActionOrder: [], travelV2RoundActionOrderReorderRequested: false },
    statusMessage: "",
    moves: [],
    moveTravelV2RoundActionOrderCandidate(stationKey, options) { this.moves.push({ stationKey, options }); return { ok: true, moved: true }; }
  };
}

function snapshot(value) { return JSON.stringify(value); }

export async function runTravelEventRunnerV2RoundActionOrderDragRuntimeSmokeChecks() {
  const checked = [];
  const runtimeModule = await importRuntime();
  const {
    TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_RUNTIME_VERSION,
    TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME,
    createTravelV2RoundActionOrderDragRuntime
  } = runtimeModule;
  assert.equal(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_RUNTIME_VERSION, 1);
  assert.equal(typeof createTravelV2RoundActionOrderDragRuntime, "function");
  checked.push("runtime exports and version");

  const oldGame = globalThis.game;
  const oldUi = globalThis.ui;
  const oldActor = globalThis.Actor;
  const oldItem = globalThis.Item;
  const oldChat = globalThis.ChatMessage;
  const oldJournal = globalThis.JournalEntry;
  const oldRoll = globalThis.Roll;
  let sideEffects = 0;
  globalThis.ui = { notifications: { warn: () => {}, info: () => {} } };
  globalThis.Actor = function Actor() { sideEffects += 1; };
  globalThis.Item = function Item() { sideEffects += 1; };
  globalThis.ChatMessage = { create: () => { sideEffects += 1; } };
  globalThis.JournalEntry = { create: () => { sideEffects += 1; } };
  globalThis.Roll = function Roll() { sideEffects += 1; };
  try {
    globalThis.game = { user: GM, socket: { emit: () => { sideEffects += 1; } } };
    const app = appFixture();
    const runtime = createTravelV2RoundActionOrderDragRuntime(app);
    assert.equal(runtime.onDragStart, runtime.onDragStart);
    assert.equal(runtime.onDrop, runtime.onDrop);
    checked.push("stable handler references");

    const { root, rows } = dom();
    const beforeSession = snapshot(app.session);
    const beforeCandidate = snapshot(app.uiState);
    const transfer = dataTransfer();
    const start = runtime.onDragStart(eventFor(rows[1], root, transfer));
    assert.equal(start.ok, true);
    assert.equal(start.started, true);
    assert.equal(transfer.effectAllowed, "move");
    const payload = JSON.parse(transfer.getData(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME));
    assert.deepEqual(payload, { version: 1, type: "travel-v2-round-action-order", stationKey: "engineer", sessionKey: "drag-session", roundIndex: 0 });
    assert.equal(snapshot(app.session), beforeSession);
    assert.equal(snapshot(app.uiState), beforeCandidate);
    checked.push("valid GM dragstart, custom payload, move effect, and no mutation");

    const overEvent = eventFor(rows[2], root, transfer, 25);
    assert.equal(runtime.onDragOver(overEvent).ok, true);
    assert.equal(overEvent.prevented(), 1);
    assert.equal(transfer.dropEffect, "move");
    checked.push("valid internal dragover calls preventDefault");

    const drop = runtime.onDrop(eventFor(rows[2], root, transfer, 25));
    assert.equal(drop.wouldMove, true);
    assert.equal(app.moves.length, 1);
    assert.deepEqual(app.moves[0], { stationKey: "engineer", options: { targetIndex: 2 } });
    checked.push("valid downward drop resolves targetIndex and calls movement once");

    app.uiState.travelV2ProposedRoundActionOrder = ["navigator", "watchmaster", "engineer"];
    app.uiState.travelV2RoundActionOrderReorderRequested = true;
    const candidateDom = dom();
    candidateDom.rows[1].dataset.stationKey = "watchmaster";
    candidateDom.rows[2].dataset.stationKey = "engineer";
    const transferUp = dataTransfer();
    assert.equal(runtime.onDragStart(eventFor(candidateDom.rows[1], candidateDom.root, transferUp)).ok, true);
    const up = runtime.onDrop(eventFor(candidateDom.rows[0], candidateDom.root, transferUp, 0));
    assert.equal(up.wouldMove, true);
    assert.deepEqual(app.moves.at(-1), { stationKey: "watchmaster", options: { targetIndex: 0 } });
    checked.push("valid upward drop and current chained candidate order");

    app.moves = [];
    app.uiState.travelV2ProposedRoundActionOrder = [];
    app.uiState.travelV2RoundActionOrderReorderRequested = false;
    const transferSame = dataTransfer();
    assert.equal(runtime.onDragStart(eventFor(rows[1], root, transferSame)).ok, true);
    const same = runtime.onDrop(eventFor(rows[1], root, transferSame, 15));
    assert.equal(same.sameIndex, true);
    assert.equal(app.moves.length, 0);
    checked.push("same-index drop is successful no-op");

    assert.equal(runtime.onDragStart(eventFor(rows[1], root, { setData: null })).blocked, true);
    assert.equal(runtime.onDragStart(eventFor(null, root, dataTransfer())).blocked, true);
    const noStation = node({ parent: rows[0].parent });
    assert.equal(runtime.onDragStart(eventFor(noStation, root, dataTransfer())).blocked, true);
    checked.push("missing row/list/stationKey and malformed dataTransfer blocked safely");

    globalThis.game = { user: PLAYER };
    assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture()).onDragStart(eventFor(rows[1], root, dataTransfer())).blocked, true);
    globalThis.game = { user: GM };
    for (const session of [sessionFixture({ status: "completed" }), sessionFixture({ currentRoundIndex: 0, roundResults: [{ roundIndex: 0, stationResults: { navigator: "success", engineer: null, watchmaster: null }, stationActions: {} }] }), sessionFixture({ event: { rounds: [{ activeStations: ["navigator"], stationActionOrder: ["navigator"] }] } })]) {
      assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture(session)).onDragStart(eventFor(rows[0], root, dataTransfer())).blocked, true);
    }
    checked.push("non-GM and unavailable dragstart states blocked");

    const unrelated = eventFor(rows[0], root, dataTransfer(), 0);
    assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture()).onDragOver(unrelated).blocked, true);
    assert.equal(unrelated.prevented(), 0);
    checked.push("unrelated dragover does not call preventDefault");

    const malformedTransfer = dataTransfer({ [TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME]: "{" });
    assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture()).onDrop(eventFor(rows[0], root, malformedTransfer, 0)).blocked, true);
    const wrongTransfer = dataTransfer({ [TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME]: JSON.stringify({ version: 2, type: "bad", stationKey: "navigator", sessionKey: "drag-session", roundIndex: 0 }) });
    assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture()).onDrop(eventFor(rows[0], root, wrongTransfer, 0)).blocked, true);
    checked.push("malformed and wrong payloads blocked");

    for (const stale of [{ sessionKey: "old", roundIndex: 0 }, { sessionKey: "drag-session", roundIndex: 9 }]) {
      const staleTransfer = dataTransfer({ [TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME]: JSON.stringify({ version: 1, type: "travel-v2-round-action-order", stationKey: "navigator", ...stale }) });
      assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture()).onDrop(eventFor(rows[0], root, staleTransfer, 0)).blocked, true);
    }
    checked.push("stale session and round payloads blocked");

    const badPointer = dataTransfer({ [TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME]: JSON.stringify({ version: 1, type: "travel-v2-round-action-order", stationKey: "navigator", sessionKey: "drag-session", roundIndex: 0 }) });
    assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture()).onDrop(eventFor(rows[0], root, badPointer, Number.NaN)).blocked, true);
    const badDom = dom([[0, 10], [10, 10], [20, 30]]);
    const badGeom = dataTransfer({ [TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME]: JSON.stringify({ version: 1, type: "travel-v2-round-action-order", stationKey: "navigator", sessionKey: "drag-session", roundIndex: 0 }) });
    assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture()).onDrop(eventFor(badDom.rows[0], badDom.root, badGeom, 5)).blocked, true);
    checked.push("invalid pointer and row geometry blocked through resolver");

    const endRuntime = createTravelV2RoundActionOrderDragRuntime(app);
    const endTransfer = dataTransfer();
    assert.equal(endRuntime.onDragStart(eventFor(rows[0], root, endTransfer)).ok, true);
    assert.equal(endRuntime.inspect().active, true);
    assert.equal(endRuntime.onDragEnd({}).ended, true);
    assert.equal(endRuntime.inspect().active, false);
    const snap = endRuntime.inspect();
    assert.throws(() => { snap.active = true; }, TypeError);
    checked.push("dragend clears transient state and inspect has no mutable alias");

    const runnerModule = await importRunner();
    const runner = new runnerModule.ArcflightTravelEventRunner({ session: sessionFixture() });
    const rootElement = node({ isList: true });
    runner.element = rootElement;
    runner._onRender({}, {});
    runner._onRender({}, {});
    for (const type of ["dragstart", "dragover", "drop", "dragend"]) assert.equal(rootElement.listeners[type].size, 1, `${type} bound once`);
    runner.moveTravelV2RoundActionOrderCandidate("engineer", "up");
    assert.deepEqual(runner.uiState.travelV2ProposedRoundActionOrder, ["engineer", "navigator", "watchmaster"]);
    checked.push("runner binds drag listeners once and keyboard behavior remains intact");

    assert.equal(snapshot(app.session), beforeSession);
    assert.equal(sideEffects, 0);
    checked.push("no session mutation and no actor/item/chat/journal/socket/roll/world side effects");

    const runtimeSource = fs.readFileSync(new URL("./travel-event-runner-v2-round-action-order-drag-runtime.js", import.meta.url), "utf8");
    for (const forbidden of ["commitTravelV2RoundActionOrder", "unlockTravelV2RoundActionOrder", "persistCommittedTravelV2RoundActionOrder", "persistUnlockedTravelV2RoundActionOrder", "saveTravelEventRunnerSessionToLibrary", "Actor", "Item", "ChatMessage", "JournalEntry", "Roll", "game.socket.emit", "document", "window", "appendChild", "insertBefore", "replaceChildren", "innerHTML", "classList", "setAttribute", "removeAttribute"]) {
      assert.equal(runtimeSource.includes(forbidden), false, `runtime source excludes ${forbidden}`);
    }
    assert.equal(fs.existsSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url)), true);
    checked.push("no template, CSS, persistence, commit, DOM insertion, or roll integration in runtime");

    const aggregateSource = fs.readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8");
    assert.match(aggregateSource, /travel-event-runner-v2-round-action-order-drag-runtime\.smoke\.js/);
    checked.push("aggregate smoke registration");
  } finally {
    if (oldGame === undefined) delete globalThis.game; else globalThis.game = oldGame;
    if (oldUi === undefined) delete globalThis.ui; else globalThis.ui = oldUi;
    if (oldActor === undefined) delete globalThis.Actor; else globalThis.Actor = oldActor;
    if (oldItem === undefined) delete globalThis.Item; else globalThis.Item = oldItem;
    if (oldChat === undefined) delete globalThis.ChatMessage; else globalThis.ChatMessage = oldChat;
    if (oldJournal === undefined) delete globalThis.JournalEntry; else globalThis.JournalEntry = oldJournal;
    if (oldRoll === undefined) delete globalThis.Roll; else globalThis.Roll = oldRoll;
  }
  return { ok: true, checked };
}

export default runTravelEventRunnerV2RoundActionOrderDragRuntimeSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelEventRunnerV2RoundActionOrderDragRuntimeSmokeChecks()
    .then((result) => {
      console.log("Travel event runner v2 round action-order drag runtime smoke checks passed.");
      console.log(`Checked ${result.checked.length} groups:`);
      for (const check of result.checked) console.log(`- ${check}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
