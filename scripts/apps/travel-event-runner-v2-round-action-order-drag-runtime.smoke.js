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

function node({ stationKey = "", top = 0, bottom = 10, kind = "content", parent = null, draggable = false } = {}) {
  const element = {
    kind,
    draggable,
    dataset: stationKey ? { stationKey } : {},
    parent,
    children: [],
    getAttribute(name) { return name === "draggable" && this.draggable === true ? "true" : null; },
    closest(selector) {
      if (selector.includes("drag-handle")) return this.kind === "handle" ? this : this.parent?.closest?.(selector) ?? null;
      if (selector.includes("drag-row")) return this.kind === "row" ? this : this.parent?.closest?.(selector) ?? null;
      if (selector.includes("drag-list")) return this.kind === "list" ? this : this.parent?.closest?.(selector) ?? null;
      if (selector.includes("button")) return this.kind === "button" ? this : this.parent?.closest?.(selector) ?? null;
      return null;
    },
    contains(other) {
      if (other === this) return true;
      return this.children.includes(other) || this.children.some((child) => child.contains?.(other));
    },
    querySelectorAll(selector) {
      if (!selector.includes("drag-row")) return [];
      const rows = [];
      const walk = (child) => {
        if (child.kind === "row") rows.push(child);
        for (const grandchild of child.children) walk(grandchild);
      };
      for (const child of this.children) walk(child);
      return rows;
    },
    getBoundingClientRect() { return { top, bottom }; },
    addEventListener(type, handler) { this.listeners ??= {}; this.listeners[type] ??= new Set(); this.listeners[type].add(handler); },
    removeEventListener(type, handler) { this.listeners?.[type]?.delete(handler); }
  };
  if (parent) parent.children.push(element);
  return element;
}

function dom(bounds = [[0, 10], [10, 20], [20, 30]], handleDraggable = true) {
  const root = node({ kind: "root" });
  const list = node({ kind: "list", parent: root });
  const rows = ORDER.map((stationKey, index) => {
    const row = node({ kind: "row", stationKey, top: bounds[index][0], bottom: bounds[index][1], parent: list });
    row.label = node({ kind: "label", parent: row });
    row.handle = node({ kind: "handle", parent: row, draggable: handleDraggable });
    row.moveUp = node({ kind: "button", parent: row });
    row.moveDown = node({ kind: "button", parent: row });
    return row;
  });
  return { root, list, rows, handles: rows.map((row) => row.handle) };
}

function eventFor(target, root, transfer = dataTransfer(), clientY = 0) {
  let prevented = 0;
  return { target, currentTarget: root, dataTransfer: transfer, clientY, preventDefault() { prevented += 1; }, prevented: () => prevented };
}

async function importRuntime() {
  return import(`./travel-event-runner-v2-round-action-order-drag-runtime.js?dragRuntimeSmoke=${Date.now()}`);
}

async function importRunner() {
  const previousFoundry = globalThis.foundry;

  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: class {
          render() { return {}; }
          async _prepareContext() { return {}; }
          _onRender() {}
        },
        HandlebarsApplicationMixin: (Base) => Base
      }
    }
  };

  try {
    return await import(
      `./travel-event-runner.js?dragRuntimeSmoke=${Date.now()}`
    );
  } finally {
    if (previousFoundry === undefined) {
      delete globalThis.foundry;
    } else {
      globalThis.foundry = previousFoundry;
    }
  }
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

function payloadJson(overrides = {}) {
  return JSON.stringify({
    version: 1,
    type: "travel-v2-round-action-order",
    stationKey: "navigator",
    sessionKey: "drag-session",
    roundIndex: 0,
    ...overrides
  });
}

export async function runTravelEventRunnerV2RoundActionOrderDragRuntimeSmokeChecks() {
  const checked = [];
  const runtimeModule = await importRuntime();
  const {
    TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_RUNTIME_VERSION,
    TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME,
    TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_HANDLE_SELECTOR,
    createTravelV2RoundActionOrderDragRuntime
  } = runtimeModule;
  assert.equal(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_RUNTIME_VERSION, 1);
  assert.equal(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_HANDLE_SELECTOR, "[data-arcflight-travel-v2-order-drag-handle]");
  assert.equal(typeof createTravelV2RoundActionOrderDragRuntime, "function");
  checked.push("runtime exports, handle selector, and version");

  const oldGame = globalThis.game;
  const oldUi = globalThis.ui;
  const oldActor = globalThis.Actor;
  const oldItem = globalThis.Item;
  const oldChat = globalThis.ChatMessage;
  const oldJournal = globalThis.JournalEntry;
  const oldRoll = globalThis.Roll;
  const oldFoundry = globalThis.foundry;
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
    const start = runtime.onDragStart(eventFor(rows[1].handle, root, transfer));
    assert.equal(start.ok, true);
    assert.equal(start.started, true);
    assert.equal(transfer.effectAllowed, "move");
    const payload = JSON.parse(transfer.getData(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME));
    assert.deepEqual(payload, { version: 1, type: "travel-v2-round-action-order", stationKey: "engineer", sessionKey: "drag-session", roundIndex: 0 });
    assert.equal(snapshot(app.session), beforeSession);
    assert.equal(snapshot(app.uiState), beforeCandidate);
    checked.push("valid GM dragstart, custom payload, move effect, and no mutation");
    assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture()).onDragStart(eventFor(rows[1].label, root, dataTransfer())).blocked, true);
    assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture()).onDragStart(eventFor(rows[1], root, dataTransfer())).blocked, true);
    assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture()).onDragStart(eventFor(rows[1].moveUp, root, dataTransfer())).blocked, true);
    assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture()).onDragStart(eventFor(rows[1].moveDown, root, dataTransfer())).blocked, true);
    const buttonHandle = node({ kind: "handle", parent: rows[1].moveUp, draggable: true });
    assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture()).onDragStart(eventFor(buttonHandle, root, dataTransfer())).blocked, true);
    const nondraggableDom = dom([[0, 10], [10, 20], [20, 30]], false);
    assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture()).onDragStart(eventFor(nondraggableDom.rows[1].handle, nondraggableDom.root, dataTransfer())).blocked, true);
    checked.push("only draggable handles can start while labels, rows, buttons, nested handles, and non-draggable handles block");

    const overEvent = eventFor(rows[2], root, transfer, 25);
    assert.equal(runtime.onDragOver(overEvent).ok, true);
    assert.equal(overEvent.prevented(), 1);
    assert.equal(transfer.dropEffect, "move");
    checked.push("valid internal dragover calls preventDefault");

    const drop = runtime.onDrop(eventFor(rows[2], root, transfer, 25));
    assert.equal(drop.wouldMove, true);
    assert.equal(app.moves.length, 1);
    assert.deepEqual(app.moves[0], { stationKey: "engineer", options: { targetIndex: 2 } });
    assert.equal(runtime.inspect().active, false);
    checked.push("valid downward drop resolves targetIndex and calls movement once");

    app.uiState.travelV2ProposedRoundActionOrder = ["navigator", "watchmaster", "engineer"];
    app.uiState.travelV2RoundActionOrderReorderRequested = true;
    const candidateDom = dom();
    candidateDom.rows[1].dataset.stationKey = "watchmaster";
    candidateDom.rows[2].dataset.stationKey = "engineer";
    const transferUp = dataTransfer();
    assert.equal(runtime.onDragStart(eventFor(candidateDom.rows[1].handle, candidateDom.root, transferUp)).ok, true);
    const up = runtime.onDrop(eventFor(candidateDom.rows[0], candidateDom.root, transferUp, 0));
    assert.equal(up.wouldMove, true);
    assert.deepEqual(app.moves.at(-1), { stationKey: "watchmaster", options: { targetIndex: 0 } });
    checked.push("valid upward drop and current chained candidate order");

    app.moves = [];
    app.uiState.travelV2ProposedRoundActionOrder = [];
    app.uiState.travelV2RoundActionOrderReorderRequested = false;
    const transferSame = dataTransfer();
    assert.equal(runtime.onDragStart(eventFor(rows[1].handle, root, transferSame)).ok, true);
    const same = runtime.onDrop(eventFor(rows[1], root, transferSame, 15));
    assert.equal(same.sameIndex, true);
    assert.equal(app.moves.length, 0);
    assert.equal(runtime.inspect().active, false);
    checked.push("same-index drop is successful no-op");

    assert.equal(runtime.onDragStart(eventFor(rows[1], root, { setData: null })).blocked, true);
    const throwingSetDataRuntime = createTravelV2RoundActionOrderDragRuntime(appFixture());
    const throwingSetData = throwingSetDataRuntime.onDragStart(eventFor(rows[1], root, { setData() { throw new Error("setData failed"); } }));
    assert.equal(throwingSetData.blocked, true);
    assert.equal(throwingSetData.started, false);
    assert.equal(throwingSetDataRuntime.inspect().active, false);
    assert.equal(runtime.onDragStart(eventFor(null, root, dataTransfer())).blocked, true);
    const noStation = node({ parent: rows[0].parent });
    assert.equal(runtime.onDragStart(eventFor(noStation, root, dataTransfer())).blocked, true);
    checked.push("missing row/list/stationKey and malformed or throwing dataTransfer blocked safely");

    globalThis.game = { user: PLAYER };
    assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture()).onDragStart(eventFor(rows[1], root, dataTransfer())).blocked, true);
    globalThis.game = { user: GM };
    const committedRoundResult = {
      roundIndex: 0,
      stationResults: { navigator: null, engineer: null, watchmaster: null },
      stationActions: {},
      stationOrderCommitments: Object.fromEntries(ORDER.map((stationKey) => [stationKey, { committed: true }]))
    };
    for (const session of [
      sessionFixture({ status: "completed" }),
      sessionFixture({ currentRoundIndex: 0, roundResults: [{ roundIndex: 0, stationResults: { navigator: "success", engineer: null, watchmaster: null }, stationActions: {} }] }),
      sessionFixture({ event: { rounds: [{ activeStations: ["navigator"], stationActionOrder: ["navigator"] }] } }),
      sessionFixture({ roundResults: [committedRoundResult], travelV2RoundActionOrder: { rounds: { 0: { order: [...ORDER] } } } }),
      sessionFixture({ travelV2RoundResolutions: [{ roundIndex: 0, roundNumber: 1 }] })
    ]) {
      assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture(session)).onDragStart(eventFor(rows[0].handle, root, dataTransfer())).blocked, true);
    }
    checked.push("non-GM and completed/result/committed/resolved/single-row dragstart states blocked");

    const unrelated = eventFor(rows[0], root, dataTransfer(), 0);
    assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture()).onDragOver(unrelated).blocked, true);
    assert.equal(unrelated.prevented(), 0);
    checked.push("unrelated dragover does not call preventDefault");

    const fallbackDom = dom();
    const fallbackRoot = fallbackDom.root;
    const fallbackRows = fallbackDom.rows;

    const throwingGetDataApp = appFixture();
    const throwingGetDataRuntime = createTravelV2RoundActionOrderDragRuntime(throwingGetDataApp);
    assert.equal(throwingGetDataRuntime.onDragStart(eventFor(fallbackRows[0].handle, fallbackRoot, dataTransfer())).ok, true);
    assert.equal(throwingGetDataRuntime.onDrop(eventFor(fallbackRows[0], fallbackRoot, { getData() { throw new Error("getData failed"); } }, 0)).blocked, true);
    assert.equal(throwingGetDataRuntime.inspect().active, false);
    assert.equal(throwingGetDataApp.moves.length, 0);

    const emptyGetDataApp = appFixture();
    const emptyGetDataRuntime = createTravelV2RoundActionOrderDragRuntime(emptyGetDataApp);
    assert.equal(emptyGetDataRuntime.onDragStart(eventFor(fallbackRows[0].handle, fallbackRoot, dataTransfer())).ok, true);
    assert.equal(emptyGetDataRuntime.onDrop(eventFor(fallbackRows[2], fallbackRoot, { getData() { return ""; } }, 25)).wouldMove, true);
    assert.equal(emptyGetDataRuntime.inspect().active, false);
    assert.deepEqual(emptyGetDataApp.moves, [{ stationKey: "navigator", options: { targetIndex: 2 } }]);

    const unavailableGetDataApp = appFixture();
    const unavailableGetDataRuntime = createTravelV2RoundActionOrderDragRuntime(unavailableGetDataApp);
    assert.equal(unavailableGetDataRuntime.onDragStart(eventFor(fallbackRows[0].handle, fallbackRoot, dataTransfer())).ok, true);
    assert.equal(unavailableGetDataRuntime.onDrop(eventFor(fallbackRows[2], fallbackRoot, {}, 25)).wouldMove, true);
    assert.equal(unavailableGetDataRuntime.inspect().active, false);
    assert.deepEqual(unavailableGetDataApp.moves, [{ stationKey: "navigator", options: { targetIndex: 2 } }]);
    checked.push("getData throws blocks while empty or unavailable getData may use active payload");

    const externalPayloadApp = appFixture();
    const externalPayloadRuntime = createTravelV2RoundActionOrderDragRuntime(externalPayloadApp);
    assert.equal(externalPayloadRuntime.onDrop(eventFor(fallbackRows[2], fallbackRoot, dataTransfer({ [TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME]: payloadJson() }), 25)).blocked, true);
    assert.equal(externalPayloadApp.moves.length, 0);

    const mismatchApp = appFixture();
    const mismatchRuntime = createTravelV2RoundActionOrderDragRuntime(mismatchApp);
    assert.equal(mismatchRuntime.onDragStart(eventFor(fallbackRows[0].handle, fallbackRoot, dataTransfer())).ok, true);
    assert.equal(mismatchRuntime.onDrop(eventFor(fallbackRows[2], fallbackRoot, dataTransfer({ [TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME]: payloadJson({ stationKey: "engineer" }) }), 25)).blocked, true);
    assert.equal(mismatchApp.moves.length, 0);
    checked.push("external valid payload and active mismatched payloads block without movement");

    const malformedApp = appFixture();
    const malformedRuntime = createTravelV2RoundActionOrderDragRuntime(malformedApp);
    assert.equal(malformedRuntime.onDragStart(eventFor(fallbackRows[0].handle, fallbackRoot, dataTransfer())).ok, true);
    const malformedTransfer = dataTransfer({ [TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME]: "{" });
    assert.equal(malformedRuntime.onDrop(eventFor(fallbackRows[0], fallbackRoot, malformedTransfer, 0)).blocked, true);
    assert.equal(malformedRuntime.inspect().active, false);
    assert.equal(malformedApp.moves.length, 0);

    const wrongPayloadApp = appFixture();
    const wrongPayloadRuntime = createTravelV2RoundActionOrderDragRuntime(wrongPayloadApp);
    assert.equal(wrongPayloadRuntime.onDragStart(eventFor(fallbackRows[0].handle, fallbackRoot, dataTransfer())).ok, true);
    const wrongTransfer = dataTransfer({ [TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME]: payloadJson({ version: 2, type: "bad" }) });
    assert.equal(wrongPayloadRuntime.onDrop(eventFor(fallbackRows[0], fallbackRoot, wrongTransfer, 0)).blocked, true);
    assert.equal(wrongPayloadRuntime.inspect().active, false);
    assert.equal(wrongPayloadApp.moves.length, 0);
    checked.push("malformed and wrong nonempty payloads block without active fallback or movement");

    for (const stale of [{ sessionKey: "old", roundIndex: 0 }, { sessionKey: "drag-session", roundIndex: 9 }]) {
      const staleRuntime = createTravelV2RoundActionOrderDragRuntime(appFixture());
      assert.equal(staleRuntime.onDragStart(eventFor(fallbackRows[0].handle, fallbackRoot, dataTransfer())).ok, true);
      const staleTransfer = dataTransfer({ [TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME]: payloadJson(stale) });
      assert.equal(staleRuntime.onDrop(eventFor(fallbackRows[0], fallbackRoot, staleTransfer, 0)).blocked, true);
      assert.equal(staleRuntime.inspect().active, false);
    }
    const staleOverApp = appFixture();
    const staleOverRuntime = createTravelV2RoundActionOrderDragRuntime(staleOverApp);
    assert.equal(staleOverRuntime.onDragStart(eventFor(fallbackRows[0].handle, fallbackRoot, dataTransfer())).ok, true);
    staleOverApp.session.currentRoundIndex = 1;
    const staleOverEvent = eventFor(fallbackRows[1], fallbackRoot, dataTransfer(), 15);
    assert.equal(staleOverRuntime.onDragOver(staleOverEvent).blocked, true);
    assert.equal(staleOverEvent.prevented(), 0);
    assert.equal(staleOverRuntime.inspect().active, false);

    checked.push("stale session and round payloads blocked and clear active state");

    const disabledApp = appFixture();
    const disabledRuntime = createTravelV2RoundActionOrderDragRuntime(disabledApp);
    assert.equal(disabledRuntime.onDragStart(eventFor(fallbackRows[0].handle, fallbackRoot, dataTransfer())).ok, true);
    disabledApp.session.status = "completed";
    assert.equal(disabledRuntime.onDrop(eventFor(fallbackRows[0], fallbackRoot, { getData() { return ""; } }, 0)).blocked, true);
    assert.equal(disabledRuntime.inspect().active, false);

    const badPointerRuntime = createTravelV2RoundActionOrderDragRuntime(appFixture());
    assert.equal(badPointerRuntime.onDragStart(eventFor(fallbackRows[0].handle, fallbackRoot, dataTransfer())).ok, true);
    assert.equal(badPointerRuntime.onDrop(eventFor(fallbackRows[0], fallbackRoot, dataTransfer({ [TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME]: payloadJson() }), Number.NaN)).blocked, true);
    assert.equal(badPointerRuntime.inspect().active, false);
    const badDom = dom([[0, 10], [10, 10], [20, 30]]);
    const badGeomRuntime = createTravelV2RoundActionOrderDragRuntime(appFixture());
    assert.equal(badGeomRuntime.onDragStart(eventFor(badDom.rows[0].handle, badDom.root, dataTransfer())).ok, true);
    assert.equal(badGeomRuntime.onDrop(eventFor(badDom.rows[0], badDom.root, dataTransfer({ [TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME]: payloadJson() }), 5)).blocked, true);
    assert.equal(badGeomRuntime.inspect().active, false);
    checked.push("disabled, invalid pointer, and row geometry drops clear through blocked paths");

    const outsideApp = appFixture();
    const outsideRuntime = createTravelV2RoundActionOrderDragRuntime(outsideApp);
    assert.equal(outsideRuntime.onDragStart(eventFor(fallbackRows[0].handle, fallbackRoot, dataTransfer())).ok, true);
    const outsideTarget = node({ kind: "label" });
    assert.equal(outsideRuntime.onDrop(eventFor(outsideTarget, fallbackRoot, dataTransfer(), 25)).blocked, true);
    assert.equal(outsideRuntime.inspect().active, true);
    assert.equal(outsideRuntime.onDrop(eventFor(fallbackRows[2], fallbackRoot, { getData() { return ""; } }, 25)).wouldMove, true);
    assert.equal(outsideApp.moves.length, 1);
    checked.push("outside-list drop preserves active drag and subsequent valid internal drop completes");

    const endRuntime = createTravelV2RoundActionOrderDragRuntime(app);
    const endTransfer = dataTransfer();
    assert.equal(endRuntime.onDragStart(eventFor(rows[0].handle, root, endTransfer)).ok, true);
    assert.equal(endRuntime.inspect().active, true);
    assert.equal(endRuntime.onDragEnd({}).ended, true);
    assert.equal(endRuntime.inspect().active, false);
    const snap = endRuntime.inspect();
    assert.throws(() => { snap.active = true; }, TypeError);
    checked.push("dragend clears transient state and inspect has no mutable alias");

    const foundryBeforeRunnerImport = globalThis.foundry;
    const runnerModule = await importRunner();
    assert.equal(globalThis.foundry, foundryBeforeRunnerImport);
    const runner = new runnerModule.ArcflightTravelEventRunner({ session: sessionFixture() });
    const rootElement = node({ isList: true });
    runner.element = rootElement;
    runner._onRender({}, {});
    runner._onRender({}, {});
    for (const type of ["dragstart", "dragover", "drop", "dragend"]) assert.equal(rootElement.listeners[type].size, 1, `${type} bound once`);
    runner.moveTravelV2RoundActionOrderCandidate("engineer", "up");
    assert.deepEqual(runner.uiState.travelV2ProposedRoundActionOrder, ["engineer", "navigator", "watchmaster"]);
    checked.push("runner import restores foundry and binds drag listeners once while keyboard behavior remains intact");

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
    if (oldFoundry === undefined) delete globalThis.foundry; else globalThis.foundry = oldFoundry;
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
