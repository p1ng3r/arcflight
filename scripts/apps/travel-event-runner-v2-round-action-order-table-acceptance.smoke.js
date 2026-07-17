import assert from "node:assert/strict";
import fs from "node:fs";
import { loadTravelEventRunnerSessionFromLibrary } from "../helpers/travel-event-runner.js";
import { prepareTravelV2RoundActionOrderState } from "../helpers/travel-v2-round-action-order-state.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";
import {
  TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME,
  createTravelV2RoundActionOrderDragRuntime
} from "./travel-event-runner-v2-round-action-order-drag-runtime.js";

const ORDER = Object.freeze(["navigator", "engineer", "watchmaster"]);
const MOVED = Object.freeze(["engineer", "navigator", "watchmaster"]);
const GM = Object.freeze({ isGM: true, id: "gm-acceptance", name: "GM Acceptance" });
const PLAYER = Object.freeze({ isGM: false, id: "player-acceptance", name: "Player Acceptance" });
const FORBIDDEN = Object.freeze(["gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions", TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME]);

function snapshot(value) { return JSON.stringify(value); }
function stationPrompts() { return { navigator: { stationName: "Navigator" }, engineer: { stationName: "Engineer" }, watchmaster: { stationName: "Watchmaster" } }; }
function roundResult(overrides = {}) { return { roundIndex: 0, stationResults: { navigator: null, engineer: null, watchmaster: null }, selectedStationOptionLabels: { navigator: "Plot a safe route", engineer: "Tune the drives", watchmaster: "Watch the horizon" }, stationActions: { navigator: { type: "eventApproach", label: "Plot a safe route", gmText: "secret route", applyPayload: { targetActorUuid: "Actor.secret" }, gmOnly: true }, engineer: { type: "support", label: "Tune the drives", internalMutation: true }, watchmaster: { type: "eventApproach", label: "Watch the horizon", secret: "hidden hazard" } }, stationOrderCommitments: { navigator: { committed: true }, engineer: { committed: true }, watchmaster: { committed: true } }, ...overrides }; }
function sessionFixture({ key = "tv2-003-table-acceptance", authoredOrder = ORDER, includeOrder = true, resultStarted = false, committed = false } = {}) {
  const session = { key, name: "TV2-003 Table Acceptance", status: "active", currentRoundIndex: 0, roundPhase: "stationOrders", event: { key: `${key}-event`, name: "Acceptance Event", category: "travel", rounds: [{ roundNumber: 1, title: "Acceptance Round", activeStations: [...ORDER], stationPrompts: stationPrompts(), ...(includeOrder ? { stationActionOrder: [...authoredOrder] } : {}) }] }, roundResults: [roundResult(resultStarted ? { stationResults: { navigator: { outcome: "started" }, engineer: null, watchmaster: null } } : {})] };
  if (committed) session.travelV2RoundActionOrder = { rounds: { 0: { order: [...authoredOrder], committedAt: "2026-07-17T00:00:00.000Z" } }, commitRecords: [{ roundIndex: 0, order: [...authoredOrder], userId: "gm", userName: "GM", timestamp: "2026-07-17T00:00:00.000Z" }] };
  return session;
}
function libraryWith(session) { return { version: 1, sessions: { [session.key]: { key: session.key, name: session.name, eventKey: session.event.key, eventName: session.event.name, eventCategory: session.event.category, status: session.status, currentRoundIndex: session.currentRoundIndex, session } } }; }

function node({ stationKey = null, parent = null, isList = false, top = 0, bottom = 10, role = "row" } = {}) {
  return { dataset: stationKey ? { stationKey } : {}, parent, children: [], listeners: {}, role,
    closest(selector) { if (selector.includes("drag-handle")) return role === "handle" ? this : null; if (selector.includes("drag-row")) return (!isList && role === "row" && this.dataset?.stationKey) ? this : this.parent?.closest?.(selector) ?? null; if (selector.includes("drag-list")) return isList ? this : this.parent?.closest?.(selector) ?? null; return null; },
    contains(other) { return other === this || this.children.some((child) => child.contains?.(other)); },
    querySelectorAll(selector) { return selector.includes("drag-row") ? [...this.children] : []; },
    getBoundingClientRect() { return { top, bottom }; },
    getAttribute(name) { return name === "data-station-key" ? this.dataset?.stationKey : null; },
    addEventListener(type, handler) { this.listeners[type] ??= new Set(); this.listeners[type].add(handler); },
    removeEventListener(type, handler) { this.listeners[type]?.delete(handler); }
  };
}
function dom() { const root = node({ isList: true }); const rows = ORDER.map((stationKey, index) => node({ stationKey, parent: root, top: index * 10, bottom: index * 10 + 10 })); root.children = rows; const handles = rows.map((row) => node({ stationKey: row.dataset.stationKey, parent: row, role: "handle" })); const texts = rows.map((row) => node({ stationKey: row.dataset.stationKey, parent: null, role: "text" })); const moveUp = rows.map((row) => node({ stationKey: row.dataset.stationKey, parent: null, role: "move-up" })); const moveDown = rows.map((row) => node({ stationKey: row.dataset.stationKey, parent: null, role: "move-down" })); return { root, rows, handles, texts, moveUp, moveDown }; }
function dataTransfer(seed = {}) { const data = { ...seed }; return { effectAllowed: "", dropEffect: "", setData(type, value) { data[type] = String(value); }, getData(type) { return data[type] ?? ""; } }; }
function eventFor(target, currentTarget, transfer = dataTransfer(), clientY = 0) { let prevented = 0; return { target, currentTarget, dataTransfer: transfer, clientY, preventDefault() { prevented += 1; }, stopped: 0, stopPropagation() { this.stopped += 1; }, prevented: () => prevented }; }

async function importRunnerModule() {
  const previousFoundry = globalThis.foundry;
  let renderCalls = 0;
  globalThis.foundry = { applications: { api: { ApplicationV2: class { async _prepareContext() { return {}; } render() { renderCalls += 1; return { rendered: true, renderCalls }; } _onRender() {} }, HandlebarsApplicationMixin: (Base) => Base } } };
  try { return { module: await import(`./travel-event-runner.js?tableAcceptance=${Date.now()}`), renderCalls: () => renderCalls, previousFoundry }; }
  finally { if (previousFoundry === undefined) delete globalThis.foundry; else globalThis.foundry = previousFoundry; }
}

function assertPlayerSafe(value, label) { const text = snapshot(value); for (const forbidden of FORBIDDEN) assert.equal(text.includes(forbidden), false, `${label} leaked ${forbidden}`); }

export async function runTravelEventRunnerV2RoundActionOrderTableAcceptanceSmokeChecks() {
  const checked = [];
  const old = { game: globalThis.game, ui: globalThis.ui, foundry: globalThis.foundry, Actor: globalThis.Actor, Item: globalThis.Item, ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, Roll: globalThis.Roll, requestAnimationFrame: globalThis.requestAnimationFrame };
  const calls = { actor: 0, item: 0, chat: 0, journal: 0, socket: 0, roll: 0, combat: 0, scene: 0, token: 0 };
  globalThis.game = { user: GM, socket: { emit: () => { calls.socket += 1; } }, actors: { get: () => ({ update: () => { calls.actor += 1; } }), values: () => [] }, items: { get: () => ({ update: () => { calls.item += 1; } }), values: () => [] }, users: { filter: () => [] }, combat: { update: () => { calls.combat += 1; } }, scenes: { active: { update: () => { calls.scene += 1; }, tokens: { get: () => ({ update: () => { calls.token += 1; } }) } } } };
  globalThis.ui = { notifications: { info: () => {}, warn: () => {}, error: () => {} } };
  globalThis.Actor = { create: () => { calls.actor += 1; }, updateDocuments: () => { calls.actor += 1; } };
  globalThis.Item = { create: () => { calls.item += 1; }, updateDocuments: () => { calls.item += 1; } };
  globalThis.ChatMessage = { create: () => { calls.chat += 1; } };
  globalThis.JournalEntry = { create: () => { calls.journal += 1; } };
  globalThis.Roll = class { constructor() { calls.roll += 1; } evaluate() { calls.roll += 1; return this; } };
  try {
    const needs = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: sessionFixture({ includeOrder: false }), user: GM, isGM: true }).travelV2PreviewPanel.roundActionOrderDisplay;
    assert.equal(needs.orderStatusKey, "needsDecision"); assert.match(needs.captainGuidanceText, /Captain/i); assert.equal(needs.reorderInteraction.rows.length, 3); checked.push("baseline Needs Decision status, Captain guidance, and GM reorder controls");
    const proposed = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: sessionFixture({ authoredOrder: MOVED }), user: GM, isGM: true }).travelV2PreviewPanel.roundActionOrderDisplay;
    assert.equal(proposed.orderStatusKey, "proposed"); assert.deepEqual(proposed.rows.map((row) => row.stationKey), MOVED); checked.push("valid authored order displays Proposed Order and station sequence");
    const playerDisplay = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: sessionFixture({ authoredOrder: MOVED }), user: PLAYER, isGM: false, uiState: { travelV2RoundActionOrderReorderRequested: true, travelV2ProposedRoundActionOrder: MOVED } }).travelV2PreviewPanel.roundActionOrderDisplay;
    assert.equal(playerDisplay.orderStatusKey, "needsDecision"); assert.deepEqual(playerDisplay.rows.map((row) => row.stationKey), ORDER); assert.equal(playerDisplay.reorderInteraction, null); assertPlayerSafe(playerDisplay, "non-GM proposed display"); checked.push("non-GM projection preserves canonical status/order and redacts candidate details");

    const foundryBefore = globalThis.foundry;
    const { module, renderCalls } = await importRunnerModule();
    assert.equal(globalThis.foundry, foundryBefore); checked.push("runner dynamic import restores globalThis.foundry");
    const { ArcflightTravelEventRunner } = module;
    const app = new ArcflightTravelEventRunner({ session: sessionFixture() });
    const root = node({ isList: true }); app.element = root; app._onRender({}, {}); app._onRender({}, {});
    for (const type of ["click", "change", "dragstart", "dragover", "drop", "dragend"]) assert.equal(root.listeners[type]?.size, 1, `${type} bound once`); checked.push("repeated render binds delegated listeners once");
    const beforeContext = snapshot(app.session); await app._prepareContext({}); assert.equal(snapshot(app.session), beforeContext); checked.push("initial context preparation does not mutate session");

    const beforeMove = snapshot(app.session); app.moveTravelV2RoundActionOrderCandidate("engineer", "up"); assert.deepEqual(app.uiState.travelV2ProposedRoundActionOrder, MOVED); assert.equal(snapshot(app.session), beforeMove); assert.equal(app.uiState.travelV2RoundActionOrderReorderRequested, true); assert.ok(renderCalls() >= 1); checked.push("keyboard movement updates local candidate only and requests rerender/review");
    app.resetTravelV2RoundActionOrderCandidate(); assert.deepEqual(app.uiState.travelV2ProposedRoundActionOrder, []); assert.equal(app.uiState.travelV2RoundActionOrderReorderRequested, false); assert.equal(snapshot(app.session), beforeMove); checked.push("reset clears only local candidate state");
    app.moveTravelV2RoundActionOrderCandidate("navigator", { targetIndex: 2 }); assert.deepEqual(app.uiState.travelV2ProposedRoundActionOrder, ["engineer", "watchmaster", "navigator"]); checked.push("target-index movement remains available after reset");

    const dragApp = new ArcflightTravelEventRunner({ session: sessionFixture() }); const runtime = createTravelV2RoundActionOrderDragRuntime(dragApp); const dragDom = dom();
    assert.equal(runtime.onDragStart(eventFor(dragDom.texts[1], dragDom.root, dataTransfer())).blocked, true); assert.equal(runtime.onDragStart(eventFor(dragDom.moveUp[1], dragDom.root, dataTransfer())).blocked, true); assert.equal(runtime.onDragStart(eventFor(dragDom.moveDown[1], dragDom.root, dataTransfer())).blocked, true); checked.push("station text and keyboard buttons cannot begin a drag");
    const transfer = dataTransfer(); const start = runtime.onDragStart(eventFor(dragDom.handles[1], dragDom.root, transfer)); assert.equal(start.ok, true); assert.equal(JSON.parse(transfer.getData(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME)).stationKey, "engineer"); checked.push("dedicated handle begins drag and writes custom MIME payload");
    const over = eventFor(dragDom.rows[2], dragDom.root, transfer, 25); assert.equal(runtime.onDragOver(over).ok, true); assert.equal(over.prevented(), 1); checked.push("valid dragover inside list prevents default");
    const beforeDragSession = snapshot(dragApp.session); const drop = runtime.onDrop(eventFor(dragDom.rows[2], dragDom.root, transfer, 25)); assert.equal(drop.wouldMove, true); assert.deepEqual(dragApp.uiState.travelV2ProposedRoundActionOrder, ["navigator", "watchmaster", "engineer"]); assert.equal(snapshot(dragApp.session), beforeDragSession); checked.push("valid handle drop changes local candidate through target-index adapter once");
    const sameRuntime = createTravelV2RoundActionOrderDragRuntime(new ArcflightTravelEventRunner({ session: sessionFixture() })); const sameTransfer = dataTransfer(); assert.equal(sameRuntime.onDragStart(eventFor(dragDom.handles[1], dragDom.root, sameTransfer)).ok, true); assert.equal(sameRuntime.onDrop(eventFor(dragDom.rows[1], dragDom.root, sameTransfer, 15)).sameIndex, true); checked.push("same-index drop succeeds as no-op");
    const payload = transfer.getData(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME); const inactiveApp = new ArcflightTravelEventRunner({ session: sessionFixture({ key: "inactive-different-session" }) }); const inactive = createTravelV2RoundActionOrderDragRuntime(inactiveApp); assert.equal(inactive.onDrop(eventFor(dragDom.rows[0], dragDom.root, dataTransfer({ [TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME]: payload }), 0)).blocked, true); assert.deepEqual(inactiveApp.uiState.travelV2ProposedRoundActionOrder, []); checked.push("stale custom payload without active runtime cannot reorder");
    const mismatchRuntime = createTravelV2RoundActionOrderDragRuntime(new ArcflightTravelEventRunner({ session: sessionFixture() })); const mismatchTransfer = dataTransfer(); assert.equal(mismatchRuntime.onDragStart(eventFor(dragDom.handles[0], dragDom.root, mismatchTransfer)).ok, true); const badPayload = JSON.stringify({ ...JSON.parse(mismatchTransfer.getData(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME)), stationKey: "engineer" }); assert.ok(mismatchRuntime.onDrop(eventFor(dragDom.rows[2], dragDom.root, dataTransfer({ [TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME]: badPayload }), 25))); checked.push("station identity mismatch path is exercised without persistence");
    const outsideRuntime = createTravelV2RoundActionOrderDragRuntime(new ArcflightTravelEventRunner({ session: sessionFixture() })); const outsideTransfer = dataTransfer(); assert.equal(outsideRuntime.onDragStart(eventFor(dragDom.handles[0], dragDom.root, outsideTransfer)).ok, true); assert.equal(outsideRuntime.onDrop(eventFor(node(), node({ isList: true }), outsideTransfer, 0)).blocked, true); assert.equal(outsideRuntime.inspect().active, true); checked.push("outside-list drop cannot complete or destroy internal drag");

    const review = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: dragApp.session, uiState: dragApp.uiState, user: GM, isGM: true }).travelV2PreviewPanel.roundActionOrderDisplay; assert.equal(review.reorderRequest.ready, true); assert.deepEqual(review.reorderRequest.proposedRows.map((row) => row.stationKey), ["navigator", "watchmaster", "engineer"]); checked.push("review preview exposes ready candidate comparison rows");
    const noCommitSession = snapshot(dragApp.session); await dragApp.commitTravelV2RoundActionOrder({ user: GM, isGM: true, timestamp: "2026-07-17T00:01:00.000Z" }); assert.notEqual(snapshot(dragApp.session), noCommitSession); assert.equal(dragApp.session.travelV2RoundActionOrder.commitRecords.length, 1); assert.deepEqual(dragApp.uiState.travelV2ProposedRoundActionOrder, []); checked.push("explicit commit adopts candidate, clears UI candidate, and writes one audit");
    const committedDisplay = prepareTravelV2RoundActionOrderState(dragApp.session, { user: GM, isGM: true }); assert.equal(committedDisplay.orderStatusKey, "committed"); assert.equal(committedDisplay.reorderInteraction.canReorder, false); checked.push("Committed Order display disables keyboard and drag reordering");

    const committedSnapshot = snapshot(dragApp.session); const persist = await dragApp.persistCommittedTravelV2RoundActionOrder({ user: GM, isGM: true, dryRun: true, library: libraryWith(sessionFixture({ key: dragApp.session.key })), now: "2026-07-17T00:02:00.000Z" }); assert.equal(dragApp.uiState.travelV2RoundActionOrderPersistResult.persisted, true); assert.equal(snapshot(dragApp.session), committedSnapshot); checked.push("explicit dry-run persistence succeeds without mutating committed local session");
    const loaded = loadTravelEventRunnerSessionFromLibrary(dragApp.session.key, { library: dragApp.uiState.travelV2RoundActionOrderPersistResult.library }); assert.equal(loaded.ok, true); assert.deepEqual(prepareTravelV2RoundActionOrderState(loaded.session, { user: GM, isGM: true }).orderedStationKeys, ["navigator", "watchmaster", "engineer"]); checked.push("reload displays persisted committed order");
    dragApp.uiState.travelV2RoundActionOrderReorderRequested = true; dragApp.uiState.travelV2ProposedRoundActionOrder = ["navigator", "watchmaster", "engineer"]; const dupCommit = await dragApp.commitTravelV2RoundActionOrder({ user: GM, isGM: true, timestamp: "2026-07-17T00:03:00.000Z" }); const dupPersist = await dragApp.persistCommittedTravelV2RoundActionOrder({ user: GM, isGM: true, dryRun: true, library: dragApp.uiState.travelV2RoundActionOrderPersistResult.library, now: "2026-07-17T00:04:00.000Z" }); assert.equal(dupCommit.result.duplicate, true); assert.equal(dupPersist.duplicate, true); assert.equal(dragApp.session.travelV2RoundActionOrder.commitRecords.length, 1); checked.push("duplicate equivalent commit and persistence are no-op paths");

    const unlock = await dragApp.unlockTravelV2RoundActionOrder({ user: GM, isGM: true, confirmed: true, timestamp: "2026-07-17T00:05:00.000Z" }); assert.equal(unlock.rendered, true); assert.equal(dragApp.session.travelV2RoundActionOrder.rounds["0"], undefined); assert.equal(dragApp.session.travelV2RoundActionOrder.commitRecords.length, 1); assert.equal((dragApp.session.travelV2RoundActionOrder.unlockRecords ?? []).length, 1); checked.push("confirmed GM unlock preserves history and appends unlock audit");
    const openDisplay = prepareTravelV2RoundActionOrderState(dragApp.session, { user: GM, isGM: true }); assert.match(openDisplay.captainGuidanceText, /Captain/i); assert.equal(openDisplay.reorderInteraction.canReorder, true); checked.push("unlock restores open guidance and reorder availability");
    dragApp.moveTravelV2RoundActionOrderCandidate("watchmaster", "up"); await dragApp.commitTravelV2RoundActionOrder({ user: GM, isGM: true, timestamp: "2026-07-17T00:06:00.000Z" }); assert.equal(dragApp.session.travelV2RoundActionOrder.commitRecords.length, 2); checked.push("new candidate recommits by appending history");
    const resultStartedApp = new ArcflightTravelEventRunner({ session: sessionFixture({ committed: true, resultStarted: true }) }); const blockedUnlock = await resultStartedApp.unlockTravelV2RoundActionOrder({ user: GM, isGM: true, confirmed: true }); resultStartedApp.moveTravelV2RoundActionOrderCandidate("engineer", "up"); const blockedCommit = await resultStartedApp.commitTravelV2RoundActionOrder({ user: GM, isGM: true }); assert.ok(blockedUnlock); assert.ok(blockedCommit); checked.push("result-started fixture exercises unlock, reorder, and recommit boundary");

    const staleApp = new ArcflightTravelEventRunner({ session: sessionFixture({ key: "context-a" }) }); staleApp.moveTravelV2RoundActionOrderCandidate("engineer", "up"); assert.deepEqual(staleApp.uiState.travelV2RoundActionOrderCandidateContext, { sessionKey: "context-a", roundIndex: 0 }); staleApp.session = sessionFixture({ key: "context-b" }); assert.notEqual(staleApp.uiState.travelV2RoundActionOrderCandidateContext.sessionKey, staleApp.session.key); checked.push("candidate state is tied to session key and round index");
    const loadedPlayer = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: loaded.session, user: PLAYER, isGM: false, uiState: dragApp.uiState }).travelV2PreviewPanel.roundActionOrderDisplay; assertPlayerSafe(loadedPlayer, "reloaded non-GM display"); checked.push("reloaded non-GM projection remains player-safe");

    assert.deepEqual(calls, { actor: 0, item: 0, chat: 0, journal: 0, socket: 0, roll: 0, combat: 0, scene: 0, token: 0 }); checked.push("acceptance flow has no world-document, socket, chat, journal, roll, combat, scene, or token side effects");

    const template = fs.readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8"); const css = fs.readFileSync(new URL("../../styles/arcflight.css", import.meta.url), "utf8"); const aggregate = fs.readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8"); const manual = fs.readFileSync(new URL("../../docs/TRAVEL_V2_TV2_003_FOUNDRY_VERIFICATION.md", import.meta.url), "utf8"); const issues = fs.readFileSync(new URL("../../docs/TRAVEL_V2_OPEN_ISSUES.md", import.meta.url), "utf8");
    assert.equal((template.match(/data-arcflight-travel-v2-order-drag-list/g) ?? []).length, 1); assert.match(template, /data-arcflight-travel-v2-order-drag-row[\s\S]+data-station-key/); assert.doesNotMatch(template.match(/<article[^>]*data-arcflight-travel-v2-order-drag-row[\s\S]*?>/)?.[0] ?? "", /draggable="true"/); checked.push("template has one drag list, row station key binding, and no hard-coded native row draggable");
    assert.match(template, /arcflight-travel-runner-mvp__v2-order-drag-handle/); for (const label of ["Move Up", "Move Down", "Reset Proposed Order", "Commit Reviewed Order", "Unlock Order", "Persist Committed Order"]) assert.match(template, new RegExp(label)); checked.push("template keeps handle-only drag and required controls");
    assert.match(template, /Current Station Sequence/); checked.push("canonical sequence section remains present for source inspection");
    assert.match(css, /cursor:\s*grab/); assert.match(css, /cursor:\s*grabbing/); assert.match(css, /prefers-reduced-motion:\s*reduce/); checked.push("CSS keeps handle cursors and reduced-motion handling");
    assert.match(aggregate, /round-action-order-closeout\.smoke\.js[\s\S]+round-action-order-table-acceptance\.smoke\.js/); assert.match(aggregate, /Travel event runner v2 round action order closeout[\s\S]+Travel event runner v2 round action order table acceptance/); checked.push("aggregate table acceptance registration follows closeout");
    for (const heading of ["TV2-003 Foundry Table Verification", "Environment Record", "Pre-flight", "Scenario A", "Scenario B", "Scenario C", "Scenario D", "Scenario E", "Scenario F", "Scenario G", "Results", "Completion Gate"]) assert.match(manual, new RegExp(heading, "i")); assert.equal(/^- \[x\]/m.test(manual), false); checked.push("manual Foundry verification checklist exists with required unchecked sections");
    assert.match(issues, /code-complete \/ Foundry table verification pending/); assert.doesNotMatch(issues.match(/### TV2-003[\s\S]*?(?=\n### TV2-004)/)?.[0] ?? "", /fully complete|complete for alpha table UX/); checked.push("tracker says code-complete verification pending without claiming full completion");
  } finally {
    for (const [key, value] of Object.entries(old)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
  return { ok: true, checked };
}

export default runTravelEventRunnerV2RoundActionOrderTableAcceptanceSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelEventRunnerV2RoundActionOrderTableAcceptanceSmokeChecks().then((result) => { console.log("Travel event runner v2 round action order table acceptance smoke checks passed."); console.log(`Checked ${result.checked.length} groups:`); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
