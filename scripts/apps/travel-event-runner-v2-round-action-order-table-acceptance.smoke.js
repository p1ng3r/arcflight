import assert from "node:assert/strict";
import fs from "node:fs";
import { loadTravelEventRunnerSessionFromLibrary } from "../helpers/travel-event-runner.js";
import { prepareTravelV2RoundActionOrderState } from "../helpers/travel-v2-round-action-order-state.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";
import {
  TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_HANDLE_SELECTOR,
  TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_LIST_SELECTOR,
  TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME,
  TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_ROW_SELECTOR,
  createTravelV2RoundActionOrderDragRuntime
} from "./travel-event-runner-v2-round-action-order-drag-runtime.js";

const ORDER = Object.freeze(["navigator", "engineer", "watchmaster"]);
const MOVED = Object.freeze(["engineer", "navigator", "watchmaster"]);
const DOWN = Object.freeze(["engineer", "watchmaster", "navigator"]);
const UP = Object.freeze(["watchmaster", "navigator", "engineer"]);
const ROUND_TWO_ORDER = Object.freeze(["watchmaster", "engineer", "navigator"]);
const GM = Object.freeze({ isGM: true, id: "gm-acceptance", name: "GM Acceptance" });
const PLAYER = Object.freeze({ isGM: false, id: "player-acceptance", name: "Player Acceptance" });
const FORBIDDEN = Object.freeze([
  "gmText",
  "applyPayload",
  "targetActorUuid",
  "mutationScope",
  "internalMutation",
  "secret",
  "pendingConsequenceQueue",
  "gmOnly",
  "unrevealedHazard",
  "catalogSuggestions",
  "commitRecords",
  "unlockRecords",
  "auditRecord",
  "travelV2ProposedRoundActionOrder",
  TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME
]);

function snapshot(value) {
  return JSON.stringify(value);
}

function stationPrompts() {
  return {
    navigator: { stationName: "Navigator" },
    engineer: { stationName: "Engineer" },
    watchmaster: { stationName: "Watchmaster" }
  };
}

function roundResult(roundIndex = 0, overrides = {}) {
  return {
    roundIndex,
    stationResults: { navigator: null, engineer: null, watchmaster: null },
    selectedStationOptionLabels: {
      navigator: "Plot a safe route",
      engineer: "Tune the drives",
      watchmaster: "Watch the horizon"
    },
    stationActions: {
      navigator: {
        type: "eventApproach",
        label: "Plot a safe route",
        gmText: "secret route",
        applyPayload: { targetActorUuid: "Actor.secret" },
        gmOnly: true
      },
      engineer: {
        type: "support",
        label: "Tune the drives",
        internalMutation: true
      },
      watchmaster: {
        type: "eventApproach",
        label: "Watch the horizon",
        secret: "hidden hazard"
      }
    },
    stationOrderCommitments: {
      navigator: { committed: true },
      engineer: { committed: true },
      watchmaster: { committed: true }
    },
    ...overrides
  };
}

function sessionFixture({
  key = "tv2-003-table-acceptance",
  authoredOrder = ORDER,
  secondOrder = ROUND_TWO_ORDER,
  includeOrder = true,
  resultStarted = false,
  committed = false,
  currentRoundIndex = 0
} = {}) {
  const orders = [[...authoredOrder], [...secondOrder]];
  const session = {
    key,
    name: "TV2-003 Table Acceptance",
    status: "active",
    currentRoundIndex,
    roundPhase: "stationOrders",
    event: {
      key: `${key}-event`,
      name: "Acceptance Event",
      category: "travel",
      rounds: orders.map((order, roundIndex) => ({
        roundNumber: roundIndex + 1,
        title: `Acceptance Round ${roundIndex + 1}`,
        activeStations: [...ORDER],
        stationPrompts: stationPrompts(),
        ...(includeOrder ? { stationActionOrder: order } : {})
      }))
    },
    roundResults: [roundResult(0), roundResult(1)]
  };

  if (resultStarted) {
    session.roundResults[currentRoundIndex].stationResults.navigator = "success";
  }

  if (committed) {
    const committedOrder = orders[currentRoundIndex];
    const roundNumber = currentRoundIndex + 1;
    session.travelV2RoundActionOrder = {
      version: 3,
      rounds: {
        [String(currentRoundIndex)]: {
          roundIndex: currentRoundIndex,
          roundNumber,
          order: [...committedOrder],
          stationOrder: [...committedOrder],
          committedAt: "2026-07-17T00:00:00.000Z",
          auditRecord: {
            id: "acceptance-commit-1",
            timestamp: "2026-07-17T00:00:00.000Z"
          }
        }
      },
      commitRecords: [{
        id: "acceptance-commit-1",
        type: "roundActionOrderCommit",
        roundIndex: currentRoundIndex,
        roundNumber,
        timestamp: "2026-07-17T00:00:00.000Z",
        committedOrder: [...committedOrder]
      }]
    };
  }

  return session;
}

function libraryWith(session) {
  return {
    version: 1,
    sessions: {
      [session.key]: {
        key: session.key,
        name: session.name,
        eventKey: session.event.key,
        eventName: session.event.name,
        eventCategory: session.event.category,
        status: session.status,
        currentRoundIndex: session.currentRoundIndex,
        session
      }
    }
  };
}

function node({
  kind = "content",
  stationKey = "",
  parent = null,
  top = 0,
  bottom = 10,
  draggable = false
} = {}) {
  const element = {
    kind,
    draggable,
    dataset: stationKey ? { stationKey } : {},
    parent,
    children: [],
    listeners: {},
    closest(selector) {
      if (selector === TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_HANDLE_SELECTOR) {
        return this.kind === "handle"
          ? this
          : this.parent?.closest?.(selector) ?? null;
      }
      if (selector === TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_ROW_SELECTOR) {
        return this.kind === "row"
          ? this
          : this.parent?.closest?.(selector) ?? null;
      }
      if (selector === TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_LIST_SELECTOR) {
        return this.kind === "list"
          ? this
          : this.parent?.closest?.(selector) ?? null;
      }
      if (selector.includes("button")) {
        return this.kind === "button"
          ? this
          : this.parent?.closest?.(selector) ?? null;
      }
      return null;
    },
    contains(other) {
      if (other === this) return true;
      return this.children.some((child) => child.contains?.(other));
    },
    querySelectorAll(selector) {
      if (selector !== TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_ROW_SELECTOR) return [];
      return this.children.filter((child) => child.kind === "row");
    },
    querySelector(_selector) {
      return null;
    },
    getBoundingClientRect() {
      return { top, bottom };
    },
    getAttribute(name) {
      if (name === "draggable") return this.draggable === true ? "true" : null;
      if (name === "data-station-key") return this.dataset?.stationKey ?? null;
      return null;
    },
    addEventListener(type, handler) {
      this.listeners[type] ??= new Set();
      this.listeners[type].add(handler);
    },
    removeEventListener(type, handler) {
      this.listeners[type]?.delete(handler);
    }
  };

  if (parent) parent.children.push(element);
  return element;
}

function dom(order = ORDER) {
  const root = node({ kind: "root" });
  const list = node({ kind: "list", parent: root });
  const rows = order.map((stationKey, index) => {
    const row = node({
      kind: "row",
      stationKey,
      top: index * 10,
      bottom: index * 10 + 10,
      parent: list
    });
    row.handle = node({ kind: "handle", parent: row, draggable: true });
    row.stationText = node({ kind: "text", parent: row });
    row.moveUp = node({ kind: "button", parent: row });
    row.moveDown = node({ kind: "button", parent: row });
    return row;
  });
  return { root, list, rows };
}

function dataTransfer(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    effectAllowed: "",
    dropEffect: "",
    setData(type, value) {
      data.set(type, String(value));
    },
    getData(type) {
      return data.get(type) ?? "";
    }
  };
}

function eventFor(target, currentTarget, transfer = dataTransfer(), clientY = 0) {
  let prevented = 0;
  let stopped = 0;
  return {
    target,
    currentTarget,
    dataTransfer: transfer,
    clientY,
    preventDefault() {
      prevented += 1;
    },
    stopPropagation() {
      stopped += 1;
    },
    prevented: () => prevented,
    stopped: () => stopped
  };
}

function trackCandidateMoves(app) {
  const original = app.moveTravelV2RoundActionOrderCandidate.bind(app);
  const calls = [];
  app.moveTravelV2RoundActionOrderCandidate = (stationKey, options = {}) => {
    calls.push({ stationKey, options: { ...options } });
    return original(stationKey, options);
  };
  return calls;
}

async function importRunnerModule() {
  const previousFoundry = globalThis.foundry;
  let renderCalls = 0;
  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: class {
          async _prepareContext() {
            return {};
          }

          render() {
            renderCalls += 1;
            return { rendered: true, renderCalls };
          }

          _onRender() {}
        },
        HandlebarsApplicationMixin: (Base) => Base
      }
    }
  };

  try {
    return {
      module: await import(`./travel-event-runner.js?tableAcceptance=${Date.now()}`),
      renderCalls: () => renderCalls
    };
  } finally {
    if (previousFoundry === undefined) delete globalThis.foundry;
    else globalThis.foundry = previousFoundry;
  }
}

function assertPlayerSafe(value, label) {
  const text = snapshot(value);
  for (const forbidden of FORBIDDEN) {
    assert.equal(text.includes(forbidden), false, `${label} leaked ${forbidden}`);
  }
}

function assertNoNonEmptyUserMetadata(value, label) {
  const visit = (entry, path = label) => {
    if (Array.isArray(entry)) {
      entry.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!entry || typeof entry !== "object") return;
    for (const [key, nested] of Object.entries(entry)) {
      const nestedPath = `${path}.${key}`;
      if (key === "userId" || key === "userName") {
        const empty = nested === null
          || nested === undefined
          || (typeof nested === "string" && nested.trim() === "");
        assert.equal(empty, true, `${nestedPath} exposed non-empty user metadata`);
      } else {
        visit(nested, nestedPath);
      }
    }
  };
  visit(value);
}

function assertBlocked(result, label) {
  assert.equal(result?.blocked, true, `${label} should report blocked`);
  assert.notEqual(result?.ok, true, `${label} must not report success`);
}

export async function runTravelEventRunnerV2RoundActionOrderTableAcceptanceSmokeChecks() {
  const checked = [];
  const old = {
    game: globalThis.game,
    ui: globalThis.ui,
    foundry: globalThis.foundry,
    Actor: globalThis.Actor,
    Item: globalThis.Item,
    ChatMessage: globalThis.ChatMessage,
    JournalEntry: globalThis.JournalEntry,
    Roll: globalThis.Roll,
    requestAnimationFrame: globalThis.requestAnimationFrame
  };
  const calls = {
    actor: 0,
    item: 0,
    chat: 0,
    journal: 0,
    socket: 0,
    roll: 0,
    combat: 0,
    scene: 0,
    token: 0
  };

  globalThis.game = {
    user: GM,
    socket: { emit: () => { calls.socket += 1; } },
    actors: {
      get: () => ({ update: () => { calls.actor += 1; } }),
      values: () => []
    },
    items: {
      get: () => ({ update: () => { calls.item += 1; } }),
      values: () => []
    },
    users: { filter: () => [] },
    combat: { update: () => { calls.combat += 1; } },
    scenes: {
      active: {
        update: () => { calls.scene += 1; },
        tokens: {
          get: () => ({ update: () => { calls.token += 1; } })
        }
      }
    }
  };
  globalThis.ui = {
    notifications: {
      info: () => {},
      warn: () => {},
      error: () => {}
    }
  };
  globalThis.Actor = {
    create: () => { calls.actor += 1; },
    updateDocuments: () => { calls.actor += 1; }
  };
  globalThis.Item = {
    create: () => { calls.item += 1; },
    updateDocuments: () => { calls.item += 1; }
  };
  globalThis.ChatMessage = {
    create: () => { calls.chat += 1; }
  };
  globalThis.JournalEntry = {
    create: () => { calls.journal += 1; }
  };
  globalThis.Roll = class {
    constructor() {
      calls.roll += 1;
    }

    evaluate() {
      calls.roll += 1;
      return this;
    }
  };

  try {
    const needs = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: sessionFixture({ includeOrder: false }),
      user: GM,
      isGM: true
    }).travelV2PreviewPanel.roundActionOrderDisplay;
    assert.equal(needs.orderStatusKey, "needsDecision");
    assert.match(needs.captainGuidanceText, /Captain/i);
    assert.equal(needs.reorderInteraction.canReorder, true);
    assert.equal(needs.reorderInteraction.rows.length, 3);
    checked.push("Needs Decision status, Captain guidance, and GM reorder controls");

    const proposed = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: sessionFixture({ authoredOrder: MOVED }),
      user: GM,
      isGM: true
    }).travelV2PreviewPanel.roundActionOrderDisplay;
    assert.equal(proposed.orderStatusKey, "proposed");
    assert.deepEqual(proposed.rows.map((row) => row.stationKey), MOVED);
    checked.push("valid authored order displays Proposed Order and station sequence");

    const playerDisplay = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: sessionFixture({ authoredOrder: MOVED }),
      user: PLAYER,
      isGM: false,
      uiState: {
        travelV2RoundActionOrderReorderRequested: true,
        travelV2ProposedRoundActionOrder: MOVED
      }
    }).travelV2PreviewPanel.roundActionOrderDisplay;
    assert.equal(playerDisplay.orderStatusKey, "needsDecision");
    assert.deepEqual(playerDisplay.rows.map((row) => row.stationKey), ORDER);
    assert.equal(playerDisplay.reorderInteraction, null);
    assertPlayerSafe(playerDisplay, "non-GM proposed display");
    assertNoNonEmptyUserMetadata(playerDisplay, "non-GM proposed display");
    checked.push("non-GM projection preserves canonical status/order and redacts candidate details");

    const foundryBefore = globalThis.foundry;
    const { module, renderCalls } = await importRunnerModule();
    assert.equal(globalThis.foundry, foundryBefore);
    checked.push("runner dynamic import restores globalThis.foundry");

    const { ArcflightTravelEventRunner } = module;
    const listenerApp = new ArcflightTravelEventRunner({ session: sessionFixture() });
    const listenerDom = dom();
    listenerApp.element = listenerDom.root;
    listenerApp._onRender({}, {});
    listenerApp._onRender({}, {});
    for (const type of ["click", "change", "dragstart", "dragover", "drop", "dragend"]) {
      assert.equal(listenerDom.root.listeners[type]?.size, 1, `${type} bound once`);
    }
    checked.push("repeated render binds delegated listeners once");

    const beforeContext = snapshot(listenerApp.session);
    await listenerApp._prepareContext({});
    assert.equal(snapshot(listenerApp.session), beforeContext);
    checked.push("initial context preparation does not mutate session");

    const keyboardApp = new ArcflightTravelEventRunner({ session: sessionFixture() });
    const beforeMove = snapshot(keyboardApp.session);
    const keyboardMove = keyboardApp.moveTravelV2RoundActionOrderCandidate("engineer", "up");
    assert.equal(keyboardMove.ok, true);
    assert.deepEqual(keyboardApp.uiState.travelV2ProposedRoundActionOrder, MOVED);
    assert.equal(snapshot(keyboardApp.session), beforeMove);
    assert.equal(keyboardApp.uiState.travelV2RoundActionOrderReorderRequested, true);
    assert.ok(renderCalls() >= 1);
    checked.push("keyboard movement updates local candidate only and requests rerender/review");

    keyboardApp.resetTravelV2RoundActionOrderCandidate();
    assert.deepEqual(keyboardApp.uiState.travelV2ProposedRoundActionOrder, []);
    assert.equal(keyboardApp.uiState.travelV2RoundActionOrderReorderRequested, false);
    assert.equal(keyboardApp.uiState.travelV2RoundActionOrderCandidateContext, null);
    assert.equal(snapshot(keyboardApp.session), beforeMove);
    checked.push("reset clears only local candidate state");

    const targetMove = keyboardApp.moveTravelV2RoundActionOrderCandidate("navigator", { targetIndex: 2 });
    assert.equal(targetMove.ok, true);
    assert.deepEqual(keyboardApp.uiState.travelV2ProposedRoundActionOrder, DOWN);
    checked.push("target-index movement remains available after reset");

    const blockedDom = dom();
    for (const target of [
      blockedDom.rows[1].stationText,
      blockedDom.rows[1].moveUp,
      blockedDom.rows[1].moveDown
    ]) {
      const blockedApp = new ArcflightTravelEventRunner({ session: sessionFixture() });
      const blockedRuntime = createTravelV2RoundActionOrderDragRuntime(blockedApp);
      const blockedStart = blockedRuntime.onDragStart(
        eventFor(target, blockedDom.root, dataTransfer())
      );
      assertBlocked(blockedStart, "non-handle dragstart");
      assert.equal(blockedRuntime.inspect().active, false);
    }
    checked.push("station text and Move Up/Move Down controls cannot begin a drag");

    const dragApp = new ArcflightTravelEventRunner({ session: sessionFixture() });
    const dragMoves = trackCandidateMoves(dragApp);
    const runtime = createTravelV2RoundActionOrderDragRuntime(dragApp);
    const dragDom = dom();
    const transfer = dataTransfer();
    const start = runtime.onDragStart(
      eventFor(dragDom.rows[0].handle, dragDom.root, transfer)
    );
    assert.equal(start.ok, true);
    const writtenPayload = JSON.parse(
      transfer.getData(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME)
    );
    assert.equal(writtenPayload.stationKey, "navigator");
    assert.equal(writtenPayload.sessionKey, dragApp.session.key);
    assert.equal(writtenPayload.roundIndex, 0);
    checked.push("dedicated native draggable handle begins drag and writes internal MIME payload");

    const over = eventFor(dragDom.rows[2], dragDom.root, transfer, 25);
    assert.equal(runtime.onDragOver(over).ok, true);
    assert.equal(over.prevented(), 1);
    checked.push("valid dragover inside the list prevents default");

    const beforeDragSession = snapshot(dragApp.session);
    const dropEvent = eventFor(dragDom.rows[2], dragDom.root, transfer, 25);
    const drop = runtime.onDrop(dropEvent);
    assert.equal(drop.wouldMove, true);
    assert.equal(dropEvent.prevented(), 1);
    assert.deepEqual(dragMoves, [{
      stationKey: "navigator",
      options: { targetIndex: 2 }
    }]);
    assert.deepEqual(dragApp.uiState.travelV2ProposedRoundActionOrder, DOWN);
    assert.equal(snapshot(dragApp.session), beforeDragSession);
    assert.equal(dragApp.session.travelV2RoundActionOrder, undefined);
    assert.equal(dragApp.uiState.travelV2RoundActionOrderPersistResult, null);
    checked.push("downward handle drop calls the target-index adapter once without commit or persistence");

    const upwardApp = new ArcflightTravelEventRunner({ session: sessionFixture() });
    const upwardMoves = trackCandidateMoves(upwardApp);
    const upwardRuntime = createTravelV2RoundActionOrderDragRuntime(upwardApp);
    const upwardDom = dom();
    const upwardTransfer = dataTransfer();
    assert.equal(
      upwardRuntime.onDragStart(
        eventFor(upwardDom.rows[2].handle, upwardDom.root, upwardTransfer)
      ).ok,
      true
    );
    const upwardDrop = upwardRuntime.onDrop(
      eventFor(upwardDom.rows[0], upwardDom.root, upwardTransfer, 0)
    );
    assert.equal(upwardDrop.wouldMove, true);
    assert.deepEqual(upwardMoves, [{
      stationKey: "watchmaster",
      options: { targetIndex: 0 }
    }]);
    assert.deepEqual(upwardApp.uiState.travelV2ProposedRoundActionOrder, UP);
    checked.push("upward handle drop calls the target-index adapter once");

    const sameApp = new ArcflightTravelEventRunner({ session: sessionFixture() });
    const sameMoves = trackCandidateMoves(sameApp);
    const sameRuntime = createTravelV2RoundActionOrderDragRuntime(sameApp);
    const sameDom = dom();
    const sameTransfer = dataTransfer();
    assert.equal(
      sameRuntime.onDragStart(
        eventFor(sameDom.rows[0].handle, sameDom.root, sameTransfer)
      ).ok,
      true
    );
    const sameDrop = sameRuntime.onDrop(
      eventFor(sameDom.rows[0], sameDom.root, sameTransfer, 5)
    );
    assert.equal(sameDrop.ok, true);
    assert.equal(sameDrop.sameIndex, true);
    assert.equal(sameDrop.moved, false);
    assert.equal(sameMoves.length, 0);
    checked.push("same-index handle drop succeeds as a no-op with zero movement calls");

    const nestedApp = new ArcflightTravelEventRunner({ session: sessionFixture() });
    const nestedMoves = trackCandidateMoves(nestedApp);
    const nestedRuntime = createTravelV2RoundActionOrderDragRuntime(nestedApp);
    const nestedDom = dom();
    const nestedTransfer = dataTransfer();
    assert.equal(
      nestedRuntime.onDragStart(
        eventFor(nestedDom.rows[0].handle, nestedDom.root, nestedTransfer)
      ).ok,
      true
    );
    assert.equal(
      nestedRuntime.onDrop(
        eventFor(nestedDom.rows[2].stationText, nestedDom.root, nestedTransfer, 25)
      ).wouldMove,
      true
    );
    assert.equal(nestedMoves.length, 1);
    checked.push("drop over content nested in another row resolves through the row/list hierarchy");

    const payloadSourceApp = new ArcflightTravelEventRunner({ session: sessionFixture() });
    const payloadSourceRuntime = createTravelV2RoundActionOrderDragRuntime(payloadSourceApp);
    const payloadSourceDom = dom();
    const payloadSourceTransfer = dataTransfer();
    assert.equal(
      payloadSourceRuntime.onDragStart(
        eventFor(
          payloadSourceDom.rows[0].handle,
          payloadSourceDom.root,
          payloadSourceTransfer
        )
      ).ok,
      true
    );
    const externalPayload = payloadSourceTransfer.getData(
      TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME
    );

    const externalApp = new ArcflightTravelEventRunner({ session: sessionFixture() });
    const externalMoves = trackCandidateMoves(externalApp);
    const externalRuntime = createTravelV2RoundActionOrderDragRuntime(externalApp);
    const externalDom = dom();
    const externalDropEvent = eventFor(
      externalDom.rows[2],
      externalDom.root,
      dataTransfer({
        [TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME]: externalPayload
      }),
      25
    );
    const externalDrop = externalRuntime.onDrop(externalDropEvent);
    assertBlocked(externalDrop, "external MIME drop");
    assert.equal(externalMoves.length, 0);
    assert.deepEqual(externalApp.uiState.travelV2ProposedRoundActionOrder, []);
    assert.equal(externalRuntime.inspect().active, false);
    assert.equal(externalDropEvent.prevented(), 0);
    checked.push("valid MIME payload without an active same-runtime drag cannot reorder");

    const tamperApp = new ArcflightTravelEventRunner({ session: sessionFixture() });
    const tamperMoves = trackCandidateMoves(tamperApp);
    const tamperRuntime = createTravelV2RoundActionOrderDragRuntime(tamperApp);
    const tamperDom = dom();
    const tamperTransfer = dataTransfer();
    assert.equal(
      tamperRuntime.onDragStart(
        eventFor(tamperDom.rows[0].handle, tamperDom.root, tamperTransfer)
      ).ok,
      true
    );
    const badPayload = JSON.stringify({
      ...JSON.parse(tamperTransfer.getData(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME)),
      stationKey: "engineer"
    });
    const tamperDropEvent = eventFor(
      tamperDom.rows[2],
      tamperDom.root,
      dataTransfer({
        [TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME]: badPayload
      }),
      25
    );
    const tamperDrop = tamperRuntime.onDrop(tamperDropEvent);
    assertBlocked(tamperDrop, "mismatched payload drop");
    assert.equal(tamperMoves.length, 0);
    assert.deepEqual(tamperApp.uiState.travelV2ProposedRoundActionOrder, []);
    assert.equal(tamperRuntime.inspect().active, false);
    assert.equal(tamperDropEvent.prevented(), 0);
    checked.push("mismatched station payload is blocked, clears transient state, and cannot move");

    const outsideApp = new ArcflightTravelEventRunner({ session: sessionFixture() });
    const outsideMoves = trackCandidateMoves(outsideApp);
    const outsideRuntime = createTravelV2RoundActionOrderDragRuntime(outsideApp);
    const outsideDom = dom();
    const outsideTransfer = dataTransfer();
    assert.equal(
      outsideRuntime.onDragStart(
        eventFor(outsideDom.rows[0].handle, outsideDom.root, outsideTransfer)
      ).ok,
      true
    );
    const outsideDrop = outsideRuntime.onDrop(
      eventFor(node({ kind: "outside" }), outsideDom.root, outsideTransfer, 25)
    );
    assertBlocked(outsideDrop, "outside-list drop");
    assert.equal(outsideMoves.length, 0);
    assert.equal(outsideRuntime.inspect().active, true);
    const recoveredDrop = outsideRuntime.onDrop(
      eventFor(outsideDom.rows[2], outsideDom.root, outsideTransfer, 25)
    );
    assert.equal(recoveredDrop.wouldMove, true);
    assert.equal(outsideMoves.length, 1);
    assert.equal(outsideRuntime.inspect().active, false);
    checked.push("outside-list drop preserves the active drag and a later internal drop completes once");

    const review = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: dragApp.session,
      uiState: dragApp.uiState,
      user: GM,
      isGM: true
    }).travelV2PreviewPanel.roundActionOrderDisplay;
    assert.equal(review.reorderRequest.ready, true);
    assert.deepEqual(
      review.reorderRequest.proposedRows.map((row) => row.stationKey),
      DOWN
    );
    checked.push("review preview exposes ready candidate comparison rows");

    const preCommit = snapshot(dragApp.session);
    assert.equal(dragApp.session.travelV2RoundActionOrder, undefined);
    const commitRendered = await dragApp.commitTravelV2RoundActionOrder({
      user: GM,
      isGM: true,
      timestamp: "2026-07-17T00:01:00.000Z"
    });
    assert.equal(commitRendered.rendered, true);
    assert.notEqual(snapshot(dragApp.session), preCommit);
    assert.equal(dragApp.session.travelV2RoundActionOrder.commitRecords.length, 1);
    assert.deepEqual(dragApp.uiState.travelV2ProposedRoundActionOrder, []);
    assert.equal(dragApp.uiState.travelV2RoundActionOrderReorderRequested, false);
    assert.equal(dragApp.uiState.travelV2RoundActionOrderCandidateContext, null);
    checked.push("explicit commit adopts candidate, clears candidate state, and writes one audit");

    const committedDisplay = prepareTravelV2RoundActionOrderState(dragApp.session, {
      user: GM,
      isGM: true
    });
    assert.equal(committedDisplay.orderStatusKey, "committed");
    assert.equal(committedDisplay.reorderInteraction.canReorder, false);
    assert.equal(committedDisplay.reorderInteraction.keyboardEnabled, false);
    assert.equal(committedDisplay.reorderInteraction.dragEnabled, false);
    checked.push("Committed Order display disables keyboard and drag reordering");

    const committedSnapshot = snapshot(dragApp.session);
    await dragApp.persistCommittedTravelV2RoundActionOrder({
      user: GM,
      isGM: true,
      dryRun: true,
      library: libraryWith(sessionFixture({ key: dragApp.session.key })),
      now: "2026-07-17T00:02:00.000Z"
    });
    const persistResult = dragApp.uiState.travelV2RoundActionOrderPersistResult;
    assert.equal(persistResult.persisted, true);
    assert.equal(snapshot(dragApp.session), committedSnapshot);
    checked.push("explicit dry-run persistence succeeds without mutating committed local session");

    const loaded = loadTravelEventRunnerSessionFromLibrary(dragApp.session.key, {
      library: persistResult.library
    });
    assert.equal(loaded.ok, true);
    assert.deepEqual(
      prepareTravelV2RoundActionOrderState(loaded.session, {
        user: GM,
        isGM: true
      }).orderedStationKeys,
      DOWN
    );
    checked.push("reload displays persisted committed order");

    dragApp.uiState.travelV2RoundActionOrderReorderRequested = true;
    dragApp.uiState.travelV2ProposedRoundActionOrder = [...DOWN];
    const duplicateCommit = await dragApp.commitTravelV2RoundActionOrder({
      user: GM,
      isGM: true,
      timestamp: "2026-07-17T00:03:00.000Z"
    });
    const duplicatePersist = await dragApp.persistCommittedTravelV2RoundActionOrder({
      user: GM,
      isGM: true,
      dryRun: true,
      library: persistResult.library,
      now: "2026-07-17T00:04:00.000Z"
    });
    assert.equal(duplicateCommit.result.duplicate, true);
    assert.equal(duplicatePersist.duplicate, true);
    assert.equal(dragApp.session.travelV2RoundActionOrder.commitRecords.length, 1);
    checked.push("equivalent repeated commit and persistence are duplicate no-op paths");

    const unlockRendered = await dragApp.unlockTravelV2RoundActionOrder({
      user: GM,
      isGM: true,
      confirmed: true,
      timestamp: "2026-07-17T00:05:00.000Z"
    });
    assert.equal(unlockRendered.rendered, true);
    assert.equal(dragApp.session.travelV2RoundActionOrder.rounds["0"], undefined);
    assert.equal(dragApp.session.travelV2RoundActionOrder.commitRecords.length, 1);
    assert.equal(dragApp.session.travelV2RoundActionOrder.unlockRecords.length, 1);
    checked.push("confirmed GM unlock preserves commit history and appends unlock audit");

    const openDisplay = prepareTravelV2RoundActionOrderState(dragApp.session, {
      user: GM,
      isGM: true
    });
    assert.match(openDisplay.captainGuidanceText, /Captain/i);
    assert.equal(openDisplay.reorderInteraction.canReorder, true);
    assert.equal(openDisplay.reorderInteraction.keyboardEnabled, true);
    assert.equal(openDisplay.reorderInteraction.dragEnabled, true);
    checked.push("unlock restores Captain guidance plus keyboard and handle-drag availability");

    const postUnlockKeyboard = dragApp.moveTravelV2RoundActionOrderCandidate(
      "engineer",
      "up"
    );
    assert.equal(postUnlockKeyboard.ok, true);
    dragApp.resetTravelV2RoundActionOrderCandidate();

    const unlockMoves = trackCandidateMoves(dragApp);
    const unlockRuntime = createTravelV2RoundActionOrderDragRuntime(dragApp);
    const unlockDom = dom();
    const unlockTransfer = dataTransfer();
    assert.equal(
      unlockRuntime.onDragStart(
        eventFor(unlockDom.rows[2].handle, unlockDom.root, unlockTransfer)
      ).ok,
      true
    );
    assert.equal(
      unlockRuntime.onDrop(
        eventFor(unlockDom.rows[0], unlockDom.root, unlockTransfer, 0)
      ).wouldMove,
      true
    );
    assert.equal(unlockMoves.length, 1);
    assert.deepEqual(dragApp.uiState.travelV2ProposedRoundActionOrder, UP);

    await dragApp.commitTravelV2RoundActionOrder({
      user: GM,
      isGM: true,
      timestamp: "2026-07-17T00:06:00.000Z"
    });
    assert.equal(dragApp.session.travelV2RoundActionOrder.commitRecords.length, 2);
    assert.equal(dragApp.session.travelV2RoundActionOrder.unlockRecords.length, 1);
    assert.deepEqual(
      dragApp.session.travelV2RoundActionOrder.rounds["0"].order,
      UP
    );
    checked.push("unlocked order supports keyboard fallback, handle drag, and append-only recommit");

    const resultStartedApp = new ArcflightTravelEventRunner({
      session: sessionFixture({ committed: true, resultStarted: true })
    });
    const resultStartedBefore = snapshot(resultStartedApp.session);
    const commitCountBefore =
      resultStartedApp.session.travelV2RoundActionOrder.commitRecords.length;
    const unlockCountBefore =
      resultStartedApp.session.travelV2RoundActionOrder.unlockRecords?.length ?? 0;
    const committedOrderBefore = [
      ...resultStartedApp.session.travelV2RoundActionOrder.rounds["0"].order
    ];

    const blockedUnlock = await resultStartedApp.unlockTravelV2RoundActionOrder({
      user: GM,
      isGM: true,
      confirmed: true,
      timestamp: "2026-07-17T00:07:00.000Z"
    });
    assert.equal(blockedUnlock.shouldUpdateSession, false);
    assert.equal(
      resultStartedApp.uiState.travelV2RoundActionOrderUnlockResult.blocked,
      true
    );
    assert.equal(snapshot(resultStartedApp.session), resultStartedBefore);
    assert.equal(
      resultStartedApp.session.travelV2RoundActionOrder.unlockRecords?.length ?? 0,
      unlockCountBefore
    );

    const blockedMove = resultStartedApp.moveTravelV2RoundActionOrderCandidate(
      "engineer",
      "up"
    );
    assertBlocked(blockedMove, "result-started candidate movement");
    assert.equal(
      resultStartedApp.uiState.travelV2RoundActionOrderReorderRequested,
      false
    );
    assert.deepEqual(
      resultStartedApp.uiState.travelV2ProposedRoundActionOrder,
      []
    );

    resultStartedApp.uiState.travelV2RoundActionOrderReorderRequested = true;
    resultStartedApp.uiState.travelV2ProposedRoundActionOrder = [...MOVED];
    const blockedCommit = await resultStartedApp.commitTravelV2RoundActionOrder({
      user: GM,
      isGM: true,
      timestamp: "2026-07-17T00:08:00.000Z"
    });
    assert.equal(blockedCommit.shouldUpdateSession, false);
    assert.equal(
      resultStartedApp.uiState.travelV2RoundActionOrderCommitResult.blocked,
      true
    );
    assert.equal(
      resultStartedApp.session.travelV2RoundActionOrder.commitRecords.length,
      commitCountBefore
    );
    assert.deepEqual(
      resultStartedApp.session.travelV2RoundActionOrder.rounds["0"].order,
      committedOrderBefore
    );
    checked.push("station-result boundary explicitly blocks unlock, movement, and recommit without new audits");

    const sessionSwitchApp = new ArcflightTravelEventRunner({
      session: sessionFixture({ key: "context-a" })
    });
    sessionSwitchApp.moveTravelV2RoundActionOrderCandidate("engineer", "up");
    const sessionACandidate = [
      ...sessionSwitchApp.uiState.travelV2ProposedRoundActionOrder
    ];
    assert.deepEqual(sessionACandidate, MOVED);
    assert.deepEqual(
      sessionSwitchApp.uiState.travelV2RoundActionOrderCandidateContext,
      { sessionKey: "context-a", roundIndex: 0 }
    );

    sessionSwitchApp.session = sessionFixture({
      key: "context-b",
      authoredOrder: ROUND_TWO_ORDER
    });
    const sessionBMove = sessionSwitchApp.moveTravelV2RoundActionOrderCandidate(
      "engineer",
      "up"
    );
    assert.equal(sessionBMove.ok, true);
    assert.deepEqual(
      sessionSwitchApp.uiState.travelV2ProposedRoundActionOrder,
      ["engineer", "watchmaster", "navigator"]
    );
    assert.notDeepEqual(
      sessionSwitchApp.uiState.travelV2ProposedRoundActionOrder,
      sessionACandidate
    );
    assert.deepEqual(
      sessionSwitchApp.uiState.travelV2RoundActionOrderCandidateContext,
      { sessionKey: "context-b", roundIndex: 0 }
    );
    checked.push("session switch derives a new candidate from session B and does not reuse session A");

    const roundSwitchApp = new ArcflightTravelEventRunner({
      session: sessionFixture({ key: "round-context" })
    });
    roundSwitchApp.moveTravelV2RoundActionOrderCandidate("engineer", "up");
    const roundZeroCandidate = [
      ...roundSwitchApp.uiState.travelV2ProposedRoundActionOrder
    ];
    assert.deepEqual(roundZeroCandidate, MOVED);
    roundSwitchApp.session.currentRoundIndex = 1;
    const roundOneMove = roundSwitchApp.moveTravelV2RoundActionOrderCandidate(
      "engineer",
      "up"
    );
    assert.equal(roundOneMove.ok, true);
    assert.deepEqual(
      roundSwitchApp.uiState.travelV2ProposedRoundActionOrder,
      ["engineer", "watchmaster", "navigator"]
    );
    assert.notDeepEqual(
      roundSwitchApp.uiState.travelV2ProposedRoundActionOrder,
      roundZeroCandidate
    );
    assert.deepEqual(
      roundSwitchApp.uiState.travelV2RoundActionOrderCandidateContext,
      { sessionKey: "round-context", roundIndex: 1 }
    );
    checked.push("round-index switch derives a new candidate and does not reuse the prior round");

    const loadedPlayer = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: loaded.session,
      user: PLAYER,
      isGM: false,
      uiState: {
        ...dragApp.uiState,
        travelV2RoundActionOrderReorderRequested: true,
        travelV2ProposedRoundActionOrder: MOVED
      }
    }).travelV2PreviewPanel.roundActionOrderDisplay;
    assertPlayerSafe(loadedPlayer, "reloaded non-GM display");
    assertNoNonEmptyUserMetadata(loadedPlayer, "reloaded non-GM display");
    assert.equal(loadedPlayer.reorderInteraction, null);
    checked.push("reloaded non-GM projection remains player-safe and hides candidate/audit internals");

    assert.deepEqual(calls, {
      actor: 0,
      item: 0,
      chat: 0,
      journal: 0,
      socket: 0,
      roll: 0,
      combat: 0,
      scene: 0,
      token: 0
    });
    checked.push("acceptance flow has no world-document, socket, chat, journal, roll, combat, scene, or token side effects");

    const template = fs.readFileSync(
      new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url),
      "utf8"
    );
    const css = fs.readFileSync(
      new URL("../../styles/arcflight.css", import.meta.url),
      "utf8"
    );
    const aggregate = fs.readFileSync(
      new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url),
      "utf8"
    );
    const manual = fs.readFileSync(
      new URL("../../docs/TRAVEL_V2_TV2_003_FOUNDRY_VERIFICATION.md", import.meta.url),
      "utf8"
    );
    const issues = fs.readFileSync(
      new URL("../../docs/TRAVEL_V2_OPEN_ISSUES.md", import.meta.url),
      "utf8"
    );

    assert.equal(
      (template.match(/data-arcflight-travel-v2-order-drag-list/g) ?? []).length,
      1
    );
    const reorderRowTag = template.match(
      /<article(?=[^>]*data-arcflight-travel-v2-order-drag-row)[^>]*>/
    )?.[0] ?? "";
    assert.notEqual(reorderRowTag, "");
    assert.match(reorderRowTag, /data-station-key="\{\{stationKey\}\}"/);
    assert.doesNotMatch(reorderRowTag, /\bdraggable\b/i);

    const handleTag = template.match(
      /<span(?=[^>]*data-arcflight-travel-v2-order-drag-handle)[^>]*>/
    )?.[0] ?? "";
    assert.notEqual(handleTag, "");
    assert.match(handleTag, /data-arcflight-travel-v2-order-drag-handle/);
    assert.match(handleTag, /draggable="\{\{draggable\}\}"/);
    checked.push("template binds native draggable only to the dedicated handle");

    const canonicalStart = template.indexOf("<h5>Current Station Sequence</h5>");
    const reorderStart = template.indexOf(
      "{{#if state.travelV2PreviewPanel.roundActionOrderDisplay.reorderInteraction.canReorder}}",
      canonicalStart
    );
    assert.ok(canonicalStart >= 0 && reorderStart > canonicalStart);
    const canonicalSection = template.slice(canonicalStart, reorderStart);
    for (const selector of [
      "data-arcflight-travel-v2-order-drag-list",
      "data-arcflight-travel-v2-order-drag-row",
      "data-arcflight-travel-v2-order-drag-handle"
    ]) {
      assert.equal(canonicalSection.includes(selector), false);
    }
    checked.push("canonical Current Station Sequence contains no drag selectors");

    for (const label of [
      "Move Up",
      "Move Down",
      "Reset Proposed Order",
      "Commit Reviewed Order",
      "Unlock Order",
      "Persist Committed Order"
    ]) {
      assert.match(template, new RegExp(label));
    }
    checked.push("template retains keyboard, reset, commit, unlock, and persistence controls");

    assert.match(
      css,
      /\.arcflight-travel-runner-mvp__v2-order-drag-handle\[draggable="true"\]\s*\{[^}]*cursor:\s*grab\s*;/s
    );
    assert.match(
      css,
      /\.arcflight-travel-runner-mvp__v2-order-drag-handle\[draggable="true"\]:active\s*\{[^}]*cursor:\s*grabbing\s*;/s
    );
    const rowRules = [
      ...css.matchAll(
        /([^{}]*\.arcflight-travel-runner-mvp__v2-order-drag-row[^{}]*)\{([^}]*)\}/g
      )
    ];
    assert.ok(rowRules.length > 0);
    for (const [, selector, body] of rowRules) {
      assert.doesNotMatch(
        body,
        /cursor\s*:\s*(?:grab|grabbing)\b/i,
        `row selector must not own drag cursor: ${selector.trim()}`
      );
    }
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    checked.push("CSS assigns grab/grabbing cursors only to the handle and keeps reduced motion");

    const closeoutImport = aggregate.indexOf(
      "travel-event-runner-v2-round-action-order-closeout.smoke.js"
    );
    const acceptanceImport = aggregate.indexOf(
      "travel-event-runner-v2-round-action-order-table-acceptance.smoke.js"
    );
    const closeoutSuite = aggregate.indexOf(
      "Travel event runner v2 round action order closeout"
    );
    const acceptanceSuite = aggregate.indexOf(
      "Travel event runner v2 round action order table acceptance"
    );
    assert.ok(closeoutImport >= 0 && acceptanceImport > closeoutImport);
    assert.ok(closeoutSuite >= 0 && acceptanceSuite > closeoutSuite);
    checked.push("aggregate table-acceptance registration follows round-action-order closeout");

    for (const heading of [
      "TV2-003 Foundry Table Verification",
      "Environment Record",
      "Pre-flight",
      "Scenario A",
      "Scenario B",
      "Scenario C",
      "Scenario D",
      "Scenario E",
      "Scenario F",
      "Scenario G",
      "Results",
      "Completion Gate"
    ]) {
      assert.match(manual, new RegExp(heading, "i"));
    }
    assert.equal(/^- \[x\]/mi.test(manual), false);
    checked.push("manual Foundry verification checklist retains required unchecked sections");

    const issueSection =
      issues.match(/### TV2-003[\s\S]*?(?=\n### TV2-004)/)?.[0] ?? "";
    assert.match(
      issueSection,
      /code-complete \/ Foundry table verification pending/
    );
    assert.doesNotMatch(
      issueSection,
      /fully complete|complete for alpha table UX/
    );
    checked.push("tracker remains code-complete with Foundry verification pending");
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }

  return { ok: true, checked };
}

export default runTravelEventRunnerV2RoundActionOrderTableAcceptanceSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelEventRunnerV2RoundActionOrderTableAcceptanceSmokeChecks()
    .then((result) => {
      console.log(
        "Travel event runner v2 round action order table acceptance smoke checks passed."
      );
      console.log(`Checked ${result.checked.length} groups:`);
      for (const check of result.checked) console.log(`- ${check}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
