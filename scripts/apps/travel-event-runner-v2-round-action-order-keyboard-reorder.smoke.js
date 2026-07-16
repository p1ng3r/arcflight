import assert from "node:assert/strict";
import fs from "node:fs";
import { prepareTravelV2RoundActionOrderState } from "../helpers/travel-v2-round-action-order-state.js";

function sessionFixture(key = "keyboard-a") { return { key, status: "active", currentRoundIndex: 0, event: { rounds: [{ roundNumber: 1, activeStations: ["navigator", "engineer", "watchmaster"], stationPrompts: { navigator: { stationName: "Navigator" }, engineer: { stationName: "Engineer" }, watchmaster: { stationName: "Watchmaster" } }, stationActionOrder: ["navigator", "engineer", "watchmaster"] }, { roundNumber: 2, activeStations: ["navigator", "engineer", "watchmaster"], stationActionOrder: ["watchmaster", "engineer", "navigator"] }] }, roundResults: [{ roundIndex: 0, stationResults: { navigator: null, engineer: null, watchmaster: null }, stationActions: {} }, { roundIndex: 1, stationResults: { navigator: null, engineer: null, watchmaster: null }, stationActions: {} }] }; }
function snapshot(value) { return JSON.stringify(value); }
async function importRunnerModule() { const previousFoundry = globalThis.foundry; let renders = 0; globalThis.foundry = { applications: { api: { ApplicationV2: class { async _prepareContext() { return {}; } render() { renders += 1; return { rendered: true, renders }; } _onRender() {} }, HandlebarsApplicationMixin: (Base) => Base } } }; try { return { module: await import(`./travel-event-runner.js?keyboardReorderSmoke=${Date.now()}`), renders: () => renders }; } finally { if (previousFoundry === undefined) delete globalThis.foundry; else globalThis.foundry = previousFoundry; } }

export async function runTravelEventRunnerV2RoundActionOrderKeyboardReorderSmokeChecks() {
  const { module } = await importRunnerModule();
  const { ArcflightTravelEventRunner } = module;
  const previousGame = globalThis.game, previousUi = globalThis.ui, previousChat = globalThis.ChatMessage, previousJournal = globalThis.JournalEntry;
  let socket = 0, chat = 0, journal = 0, actor = 0, item = 0, roll = 0;
  globalThis.game = { user: { isGM: true, id: "gm", name: "GM" }, socket: { emit: () => { socket += 1; } }, actors: { get: () => ({ update: () => { actor += 1; } }) }, items: { get: () => ({ update: () => { item += 1; } }) } };
  globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };
  globalThis.ChatMessage = { create: () => { chat += 1; } };
  globalThis.JournalEntry = { create: () => { journal += 1; } };
  globalThis.Roll = class { evaluate() { roll += 1; return this; } };
  try {
    const app = new ArcflightTravelEventRunner({ session: sessionFixture() });
    const before = snapshot(app.session);
    let state = prepareTravelV2RoundActionOrderState(app.session, { user: globalThis.game.user, isGM: true });
    assert.equal(state.reorderInteraction.canReorder, true, "GM receives keyboard reorder readiness");
    assert.equal(state.reorderInteraction.rows[0].canMoveUp, false, "first row Move Up is disabled");
    assert.equal(state.reorderInteraction.rows[2].canMoveDown, false, "final row Move Down is disabled");
    app.moveTravelV2RoundActionOrderCandidate("engineer", "up");
    assert.equal(snapshot(app.session), before, "move up does not mutate session");
    assert.deepEqual(app.uiState.travelV2ProposedRoundActionOrder, ["engineer", "navigator", "watchmaster"], "move up changes only local UI candidate");
    state = prepareTravelV2RoundActionOrderState(app.session, { user: globalThis.game.user, isGM: true, travelV2RoundActionOrderReorderRequested: app.uiState.travelV2RoundActionOrderReorderRequested, proposedOrder: app.uiState.travelV2ProposedRoundActionOrder });
    assert.equal(state.reorderRequest.ready, true, "changed candidate is ready to commit");
    app.moveTravelV2RoundActionOrderCandidate("engineer", "down");
    assert.equal(app.uiState.travelV2RoundActionOrderReorderRequested, false, "returning to canonical clears request flag");
    state = prepareTravelV2RoundActionOrderState(app.session, { user: globalThis.game.user, isGM: true, travelV2RoundActionOrderReorderRequested: true, proposedOrder: ["navigator", "engineer", "watchmaster"] });
    assert.equal(state.reorderRequest.ready, false, "unchanged candidate is not ready");
    app.moveTravelV2RoundActionOrderCandidate("engineer", "down");
    app.resetTravelV2RoundActionOrderCandidate();
    assert.equal(app.uiState.travelV2RoundActionOrderReorderRequested, false, "reset clears reorder request flag");
    assert.deepEqual(app.uiState.travelV2ProposedRoundActionOrder, [], "reset clears candidate");
    assert.equal(snapshot(app.session), before, "reset does not mutate session");
    app.moveTravelV2RoundActionOrderCandidate("engineer", "up");
    await app.commitTravelV2RoundActionOrder({ timestamp: "2026-07-16T00:00:00.000Z" });
    assert.equal(app.session.travelV2RoundActionOrder.rounds["0"].order.join(","), "engineer,navigator,watchmaster", "explicit commit adopts candidate");
    assert.equal(app.session.travelV2RoundActionOrder.commitRecords.length, 1, "existing commit audit is appended");
    assert.equal(app.uiState.travelV2ProposedRoundActionOrder.length, 0, "commit clears candidate");
    state = prepareTravelV2RoundActionOrderState(app.session, { user: globalThis.game.user, isGM: true });
    assert.equal(state.reorderInteraction.canReorder, false, "keyboard reordering unavailable while committed");
    await app.unlockTravelV2RoundActionOrder({ confirmed: true, timestamp: "2026-07-16T00:01:00.000Z" });
    state = prepareTravelV2RoundActionOrderState(app.session, { user: globalThis.game.user, isGM: true });
    assert.equal(state.reorderInteraction.canReorder, true, "explicit unlock restores reorder readiness");
    app.moveTravelV2RoundActionOrderCandidate("navigator", "down");
    await app.commitTravelV2RoundActionOrder({ timestamp: "2026-07-16T00:02:00.000Z" });
    assert.equal(app.session.travelV2RoundActionOrder.commitRecords.length, 2, "existing commit action recommits after unlock");
    for (const result of ["criticalFailure", "failure", "success", "criticalSuccess", "skipped"]) { const s = sessionFixture(`result-${result}`); s.roundResults[0].stationResults.navigator = result; const rs = prepareTravelV2RoundActionOrderState(s, { user: globalThis.game.user, isGM: true, travelV2RoundActionOrderReorderRequested: true, proposedOrder: ["engineer", "navigator", "watchmaster"] }); assert.equal(rs.reorderInteraction.canReorder, false, `${result} blocks reorder`); assert.equal(rs.reorderInteraction.keyboardEnabled, false, `${result} disables keyboard`); assert.equal(rs.reorderRequest.ready, false, `${result} disables ready commit`); }
    const player = prepareTravelV2RoundActionOrderState(sessionFixture("player"), { user: { isGM: false }, isGM: false, travelV2RoundActionOrderReorderRequested: true, proposedOrder: ["engineer", "navigator", "watchmaster"] });
    assert.equal(player.reorderInteraction, null, "players receive no GM-only interaction projection");
    assert.equal(JSON.stringify(player).includes("moveUpLabel"), false, "players receive no movement controls");
    const appA = new ArcflightTravelEventRunner({ session: sessionFixture("a") }); appA.moveTravelV2RoundActionOrderCandidate("engineer", "up"); const appB = new ArcflightTravelEventRunner({ session: sessionFixture("b") }); assert.equal(appB.uiState.travelV2ProposedRoundActionOrder.length, 0, "session A candidate does not appear in session B"); appA.session.currentRoundIndex = 1; appA.moveTravelV2RoundActionOrderCandidate("engineer", "up"); assert.notDeepEqual(appA.uiState.travelV2ProposedRoundActionOrder, ["engineer", "navigator", "watchmaster"], "round 1 candidate does not appear in round 2");
    assert.equal(chat + journal + socket + actor + item + roll, 0, "keyboard movement creates no world side effects");
    const template = fs.readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
    for (const text of ["reorderInteraction.canReorder", "reorderInteraction.keyboardEnabled", "reorderInteraction.canResetCandidate", "data-station-key", "data-direction", "Move Up", "Move Down", "Reset Proposed Order", "reorderRequest.ready"]) assert.equal(template.includes(text), true, `template includes ${text}`);
  } finally { if (previousGame === undefined) delete globalThis.game; else globalThis.game = previousGame; if (previousUi === undefined) delete globalThis.ui; else globalThis.ui = previousUi; if (previousChat === undefined) delete globalThis.ChatMessage; else globalThis.ChatMessage = previousChat; if (previousJournal === undefined) delete globalThis.JournalEntry; else globalThis.JournalEntry = previousJournal; }
  return { ok: true, checked: ["gm-candidate", "edge-state", "reset", "explicit-commit", "unlock-recommit", "results-block", "player-redaction", "isolation", "no-side-effects", "template-bindings"] };
}

export default runTravelEventRunnerV2RoundActionOrderKeyboardReorderSmokeChecks;
if (import.meta.url === `file://${process.argv[1]}`) runTravelEventRunnerV2RoundActionOrderKeyboardReorderSmokeChecks().then((result) => { console.log("Travel event runner v2 round action order keyboard reorder smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
