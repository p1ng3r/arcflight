import assert from "node:assert/strict";
import fs from "node:fs";
import {
  TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_HANDLE_SELECTOR,
  TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_LIST_SELECTOR,
  TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME,
  TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_ROW_SELECTOR,
  createTravelV2RoundActionOrderDragRuntime
} from "./travel-event-runner-v2-round-action-order-drag-runtime.js";

const ORDER = ["navigator", "engineer", "watchmaster"];
const GM = { isGM: true, id: "gm", name: "GM" };

function sessionFixture() {
  return {
    key: "drag-session",
    status: "active",
    currentRoundIndex: 0,
    event: { rounds: [{ roundNumber: 1, activeStations: [...ORDER], stationPrompts: {}, stationActionOrder: [...ORDER] }] },
    roundResults: [{ roundIndex: 0, stationResults: { navigator: null, engineer: null, watchmaster: null }, stationActions: {} }]
  };
}

function dataTransfer(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    effectAllowed: "",
    dropEffect: "",
    setData(type, value) { store.set(type, value); },
    getData(type) { return store.get(type) ?? ""; }
  };
}

function node({ kind = "content", stationKey = "", top = 0, bottom = 10, parent = null, draggable = false } = {}) {
  const element = {
    kind,
    draggable,
    dataset: stationKey ? { stationKey } : {},
    parent,
    children: [],
    getAttribute(name) { return name === "draggable" && this.draggable === true ? "true" : null; },
    closest(selector) {
      if (selector === TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_HANDLE_SELECTOR) return this.kind === "handle" ? this : this.parent?.closest?.(selector) ?? null;
      if (selector === TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_ROW_SELECTOR) return this.kind === "row" ? this : this.parent?.closest?.(selector) ?? null;
      if (selector === TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_LIST_SELECTOR) return this.kind === "list" ? this : this.parent?.closest?.(selector) ?? null;
      if (selector.includes("button")) return this.kind === "button" ? this : this.parent?.closest?.(selector) ?? null;
      return null;
    },
    contains(other) {
      if (other === this) return true;
      return this.children.includes(other) || this.children.some((child) => child.contains?.(other));
    },
    querySelectorAll(selector) {
      if (selector !== TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_ROW_SELECTOR) return [];
      return this.children.filter((child) => child.kind === "row");
    },
    getBoundingClientRect() { return { top, bottom }; }
  };
  if (parent) parent.children.push(element);
  return element;
}

function dom() {
  const root = node({ kind: "root" });
  const list = node({ kind: "list", parent: root });
  const rows = ORDER.map((stationKey, index) => {
    const row = node({ kind: "row", stationKey, top: index * 10, bottom: index * 10 + 10, parent: list });
    row.handle = node({ kind: "handle", parent: row, draggable: true });
    row.stationText = node({ kind: "text", parent: row });
    row.moveUp = node({ kind: "button", parent: row });
    row.moveDown = node({ kind: "button", parent: row });
    return row;
  });
  return { root, list, rows };
}

function eventFor(target, root, transfer = dataTransfer(), clientY = 0) {
  let prevented = 0;
  return { target, currentTarget: root, dataTransfer: transfer, clientY, preventDefault() { prevented += 1; }, prevented: () => prevented };
}

function appFixture() {
  return {
    session: sessionFixture(),
    selectedSessionKey: "drag-session",
    uiState: { travelV2ProposedRoundActionOrder: [], travelV2RoundActionOrderReorderRequested: false },
    moves: [],
    moveTravelV2RoundActionOrderCandidate(stationKey, options) {
      this.moves.push({ stationKey, options });
      this.uiState.travelV2ProposedRoundActionOrder = ["engineer", "watchmaster", "navigator"];
      this.uiState.travelV2RoundActionOrderReorderRequested = true;
      return { ok: true, moved: true };
    }
  };
}

function payload(overrides = {}) {
  return JSON.stringify({ version: 1, type: "travel-v2-round-action-order", stationKey: "navigator", sessionKey: "drag-session", roundIndex: 0, ...overrides });
}

export async function runTravelEventRunnerV2RoundActionOrderDragCloseoutSmokeChecks() {
  const checked = [];
  const oldGame = globalThis.game;
  globalThis.game = { user: GM, socket: { emit() { throw new Error("unexpected socket"); } } };
  try {
    const template = fs.readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
    assert.equal(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_HANDLE_SELECTOR, "[data-arcflight-travel-v2-order-drag-handle]");
    assert.equal(template.includes("data-arcflight-travel-v2-order-drag-handle"), true);
    checked.push("selector constants align with the template");

    const { root, list, rows } = dom();
    assert.equal(list.children.length, 3);
    for (const row of rows) {
      assert.equal(row.children.filter((child) => child.kind === "handle").length, 1);
      assert.equal(row.draggable, false);
      assert.equal(row.handle.draggable, true);
    }
    checked.push("list rows have exactly one native draggable handle and non-draggable rows");

    assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture()).onDragStart(eventFor(rows[0].stationText, root)).blocked, true);
    assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture()).onDragStart(eventFor(rows[0].moveUp, root)).blocked, true);
    assert.equal(createTravelV2RoundActionOrderDragRuntime(appFixture()).onDragStart(eventFor(rows[0].moveDown, root)).blocked, true);
    checked.push("station text and keyboard buttons cannot start drag");

    const app = appFixture();
    const runtime = createTravelV2RoundActionOrderDragRuntime(app);
    const transfer = dataTransfer();
    assert.equal(runtime.onDragStart(eventFor(rows[0].handle, root, transfer)).ok, true);
    assert.deepEqual(JSON.parse(transfer.getData(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME)), JSON.parse(payload()));
    const over = eventFor(rows[2], root, transfer, 25);
    assert.equal(runtime.onDragOver(over).ok, true);
    assert.equal(over.prevented(), 1);
    assert.equal(runtime.onDrop(eventFor(rows[2], root, transfer, 25)).wouldMove, true);
    assert.deepEqual(app.moves, [{ stationKey: "navigator", options: { targetIndex: 2 } }]);
    checked.push("handle dragstart writes payload, dragover prevents default, and downward drop moves once");

    const upApp = appFixture();
    upApp.uiState.travelV2ProposedRoundActionOrder = ["navigator", "watchmaster", "engineer"];
    upApp.uiState.travelV2RoundActionOrderReorderRequested = true;
    const upRuntime = createTravelV2RoundActionOrderDragRuntime(upApp);
    const upDom = dom();
    upDom.rows[1].dataset.stationKey = "watchmaster";
    upDom.rows[2].dataset.stationKey = "engineer";
    const upTransfer = dataTransfer();
    assert.equal(upRuntime.onDragStart(eventFor(upDom.rows[1].handle, upDom.root, upTransfer)).ok, true);
    assert.equal(upRuntime.onDrop(eventFor(upDom.rows[0], upDom.root, upTransfer, 0)).wouldMove, true);
    assert.deepEqual(upApp.moves, [{ stationKey: "watchmaster", options: { targetIndex: 0 } }]);
    checked.push("valid handle upward drop moves once");

    const nestedRuntime = createTravelV2RoundActionOrderDragRuntime(appFixture());
    const nestedTransfer = dataTransfer();
    assert.equal(nestedRuntime.onDragStart(eventFor(rows[1].handle, root, nestedTransfer)).ok, true);
    assert.equal(nestedRuntime.onDrop(eventFor(rows[2].moveUp, root, nestedTransfer, 25)).wouldMove, true);
    checked.push("drop over a nested button remains a valid target after handle dragstart");

    const externalApp = appFixture();
    assert.equal(createTravelV2RoundActionOrderDragRuntime(externalApp).onDrop(eventFor(rows[2], root, dataTransfer({ [TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME]: payload() }), 25)).blocked, true);
    assert.equal(externalApp.moves.length, 0);
    const tamperApp = appFixture();
    const tamperRuntime = createTravelV2RoundActionOrderDragRuntime(tamperApp);
    assert.equal(tamperRuntime.onDragStart(eventFor(rows[0].handle, root, dataTransfer())).ok, true);
    assert.equal(tamperRuntime.onDrop(eventFor(rows[2], root, dataTransfer({ [TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME]: payload({ stationKey: "engineer" }) }), 25)).blocked, true);
    assert.equal(tamperApp.moves.length, 0);
    checked.push("external or tampered payloads cannot reorder");

    const outsideApp = appFixture();
    const outsideRuntime = createTravelV2RoundActionOrderDragRuntime(outsideApp);
    assert.equal(outsideRuntime.onDragStart(eventFor(rows[0].handle, root, dataTransfer())).ok, true);
    assert.equal(outsideRuntime.onDrop(eventFor(node(), root, dataTransfer(), 25)).blocked, true);
    assert.equal(outsideRuntime.inspect().active, true);
    assert.equal(outsideRuntime.onDrop(eventFor(rows[0], root, { getData() { return ""; } }, 5)).sameIndex, true);
    assert.equal(outsideApp.moves.length, 0);
    checked.push("outside-list drop cannot reorder, preserves active drag, and same-index drop is no-op");

    const endRuntime = createTravelV2RoundActionOrderDragRuntime(appFixture());
    assert.equal(endRuntime.onDragStart(eventFor(rows[0].handle, root, dataTransfer())).ok, true);
    assert.equal(endRuntime.onDragEnd({}).ended, true);
    assert.equal(endRuntime.inspect().active, false);
    checked.push("dragend clears only transient state");

    assert.equal(template.includes("data-arcflight-travel-v2-order-commit"), true);
    assert.equal(template.includes("data-arcflight-travel-v2-order-move"), true);
    assert.equal(template.includes("Move Up"), true);
    assert.equal(template.includes("Move Down"), true);
    checked.push("candidate order remains local with explicit commit and keyboard fallback present");

    const runtimeSource = fs.readFileSync(new URL("./travel-event-runner-v2-round-action-order-drag-runtime.js", import.meta.url), "utf8");
    const fullCssSource = fs.readFileSync(new URL("../../styles/arcflight.css", import.meta.url), "utf8");
    const cssStart = fullCssSource.indexOf(".arcflight-travel-runner-mvp__v2-order-drag-list");
    const cssEnd = fullCssSource.indexOf(".arcflight-travel-runner-mvp__v2-benefit-row--disabled", cssStart);
    const cssSource = fullCssSource.slice(cssStart, cssEnd);
    const aggregateSource = fs.readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8");
    for (const source of [runtimeSource, cssSource]) {
      for (const forbidden of ["commitTravelV2RoundActionOrder", "unlockTravelV2RoundActionOrder", "persistCommittedTravelV2RoundActionOrder", "saveTravelEventRunnerSessionToLibrary", "game.socket.emit", "Actor", "Item", "ChatMessage", "JournalEntry", "Roll", "document", "window", "appendChild", "insertBefore", "replaceChildren", "classList"]) {
        assert.equal(source.includes(forbidden), false, `source excludes ${forbidden}`);
      }
    }
    assert.match(aggregateSource, /travel-event-runner-v2-round-action-order-drag-closeout\.smoke\.js/);
    assert.match(aggregateSource, /Travel event runner v2 round action order drag UI[\s\S]+Travel event runner v2 round action order drag closeout/);
    checked.push("no forbidden integration added and aggregate registration present");
  } finally {
    if (oldGame === undefined) delete globalThis.game; else globalThis.game = oldGame;
  }
  return { ok: true, checked };
}

export default runTravelEventRunnerV2RoundActionOrderDragCloseoutSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelEventRunnerV2RoundActionOrderDragCloseoutSmokeChecks()
    .then((result) => {
      console.log("Travel event runner v2 round action-order drag closeout smoke checks passed.");
      console.log(`Checked ${result.checked.length} groups:`);
      for (const check of result.checked) console.log(`- ${check}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
