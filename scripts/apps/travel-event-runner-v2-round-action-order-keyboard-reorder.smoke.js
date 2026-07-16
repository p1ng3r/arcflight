import assert from "node:assert/strict";
import fs from "node:fs";
import { prepareTravelV2RoundActionOrderState } from "../helpers/travel-v2-round-action-order-state.js";

const GM = { isGM: true, id: "gm", name: "GM" };
const PLAYER = { isGM: false, id: "player", name: "Player" };
const ORDER = ["navigator", "engineer", "watchmaster"];

function sessionFixture(key = "keyboard-a") {
  return {
    key,
    status: "active",
    currentRoundIndex: 0,
    event: {
      rounds: [
        {
          roundNumber: 1,
          activeStations: [...ORDER],
          stationPrompts: {
            navigator: { stationName: "Navigator" },
            engineer: { stationName: "Engineer" },
            watchmaster: { stationName: "Watchmaster" }
          },
          stationActionOrder: [...ORDER]
        },
        {
          roundNumber: 2,
          activeStations: [...ORDER],
          stationPrompts: {
            navigator: { stationName: "Navigator" },
            engineer: { stationName: "Engineer" },
            watchmaster: { stationName: "Watchmaster" }
          },
          stationActionOrder: ["watchmaster", "engineer", "navigator"]
        }
      ]
    },
    roundResults: [
      { roundIndex: 0, stationResults: { navigator: null, engineer: null, watchmaster: null }, stationActions: {} },
      { roundIndex: 1, stationResults: { navigator: null, engineer: null, watchmaster: null }, stationActions: {} }
    ]
  };
}

function snapshot(value) {
  return JSON.stringify(value);
}

async function importRunnerModules() {
  const previousFoundry = globalThis.foundry;
  let renders = 0;
  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: class {
          async _prepareContext() { return {}; }
          render() { renders += 1; return { rendered: true, renders }; }
          _onRender() {}
        },
        HandlebarsApplicationMixin: (Base) => Base
      }
    }
  };
  try {
    const module = await import(`./travel-event-runner.js?keyboardReorderSmoke=${Date.now()}`);
    const guard = await import(`./travel-event-runner-candidate-guard.js?keyboardReorderSmoke=${Date.now()}`);
    guard.installTravelV2RoundActionOrderCandidateGuard(module.ArcflightTravelEventRunner);
    const preview = await import("./travel-event-runner-v2-preview-consumer.js");
    return { module, guard, preview, renders: () => renders };
  } finally {
    if (previousFoundry === undefined) delete globalThis.foundry;
    else globalThis.foundry = previousFoundry;
  }
}

export async function runTravelEventRunnerV2RoundActionOrderKeyboardReorderSmokeChecks() {
  const { module, guard, preview } = await importRunnerModules();
  const { ArcflightTravelEventRunner } = module;
  const { sanitizeTravelV2RoundActionOrderCandidateContext } = guard;
  const { prepareTravelEventRunnerAppStateWithTravelV2Preview } = preview;
  const previousGame = globalThis.game;
  const previousUi = globalThis.ui;
  const previousChat = globalThis.ChatMessage;
  const previousJournal = globalThis.JournalEntry;
  const previousRoll = globalThis.Roll;
  let socket = 0;
  let chat = 0;
  let journal = 0;
  let actor = 0;
  let item = 0;
  let roll = 0;
  globalThis.game = {
    user: GM,
    socket: { emit: () => { socket += 1; } },
    actors: { get: () => ({ update: () => { actor += 1; } }) },
    items: { get: () => ({ update: () => { item += 1; } }) },
    users: { filter: () => [] }
  };
  globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };
  globalThis.ChatMessage = { create: () => { chat += 1; } };
  globalThis.JournalEntry = { create: () => { journal += 1; } };
  globalThis.Roll = class { evaluate() { roll += 1; return this; } };

  try {
    const app = new ArcflightTravelEventRunner({ session: sessionFixture() });
    const before = snapshot(app.session);
    let state = prepareTravelV2RoundActionOrderState(app.session, { user: GM, isGM: true });
    assert.equal(state.reorderInteraction.canReorder, true, "GM receives keyboard reorder readiness");
    assert.equal(state.reorderInteraction.rows[0].canMoveUp, false, "first row Move Up is disabled");
    assert.equal(state.reorderInteraction.rows[2].canMoveDown, false, "final row Move Down is disabled");

    app.moveTravelV2RoundActionOrderCandidate("engineer", "up");
    assert.equal(snapshot(app.session), before, "move up does not mutate session");
    assert.deepEqual(app.uiState.travelV2ProposedRoundActionOrder, ["engineer", "navigator", "watchmaster"], "move up changes only local UI candidate");
    state = prepareTravelV2RoundActionOrderState(app.session, { user: GM, isGM: true, travelV2RoundActionOrderReorderRequested: app.uiState.travelV2RoundActionOrderReorderRequested, proposedOrder: app.uiState.travelV2ProposedRoundActionOrder });
    assert.equal(state.reorderRequest.ready, true, "changed candidate is ready to commit");

    app.moveTravelV2RoundActionOrderCandidate("engineer", "down");
    assert.equal(app.uiState.travelV2RoundActionOrderReorderRequested, false, "returning to canonical clears request flag");
    state = prepareTravelV2RoundActionOrderState(app.session, { user: GM, isGM: true, travelV2RoundActionOrderReorderRequested: true, proposedOrder: [...ORDER] });
    assert.equal(state.reorderRequest.ready, false, "unchanged candidate is not ready");

    app.moveTravelV2RoundActionOrderCandidate("engineer", "down");
    app.resetTravelV2RoundActionOrderCandidate();
    assert.equal(app.uiState.travelV2RoundActionOrderReorderRequested, false, "reset clears reorder request flag");
    assert.deepEqual(app.uiState.travelV2ProposedRoundActionOrder, [], "reset clears candidate");
    assert.equal(snapshot(app.session), before, "reset does not mutate session");

    app.moveTravelV2RoundActionOrderCandidate("engineer", "up");
    await app.commitTravelV2RoundActionOrder({ user: GM, isGM: true, timestamp: "2026-07-16T00:00:00.000Z" });
    assert.equal(app.session.travelV2RoundActionOrder.rounds["0"].order.join(","), "engineer,navigator,watchmaster", "explicit commit adopts candidate");
    assert.equal(app.session.travelV2RoundActionOrder.commitRecords.length, 1, "existing commit audit is appended");
    assert.equal(app.uiState.travelV2ProposedRoundActionOrder.length, 0, "commit clears candidate");
    state = prepareTravelV2RoundActionOrderState(app.session, { user: GM, isGM: true });
    assert.equal(state.reorderInteraction.canReorder, false, "keyboard reordering unavailable while committed");

    app.uiState.travelV2RoundActionOrderReorderRequested = true;
    app.uiState.travelV2ProposedRoundActionOrder = ["navigator", "engineer", "watchmaster"];
    app.uiState.travelV2RoundActionOrderCandidateContext = { sessionKey: app.session.key, roundIndex: 0 };
    const committedBefore = snapshot(app.session);
    const committedBlocked = await app.commitTravelV2RoundActionOrder({ user: GM, isGM: true, timestamp: "2026-07-16T00:00:30.000Z" });
    assert.equal(committedBlocked.shouldUpdateSession, false, "committed order cannot be replaced without unlock");
    assert.equal(snapshot(app.session), committedBefore, "blocked committed-order replacement leaves session unchanged");
    assert.equal(app.session.travelV2RoundActionOrder.commitRecords.length, 1, "blocked replacement appends no audit record");

    await app.unlockTravelV2RoundActionOrder({ user: GM, isGM: true, confirmed: true, timestamp: "2026-07-16T00:01:00.000Z" });
    state = prepareTravelV2RoundActionOrderState(app.session, { user: GM, isGM: true });
    assert.equal(state.reorderInteraction.canReorder, true, "explicit unlock restores reorder readiness");
    app.moveTravelV2RoundActionOrderCandidate("navigator", "down");
    await app.commitTravelV2RoundActionOrder({ user: GM, isGM: true, timestamp: "2026-07-16T00:02:00.000Z" });
    assert.equal(app.session.travelV2RoundActionOrder.commitRecords.length, 2, "existing commit action recommits after unlock");

    for (const result of ["criticalFailure", "failure", "success", "criticalSuccess", "skipped"]) {
      const resultSession = sessionFixture(`result-${result}`);
      resultSession.roundResults[0].stationResults.navigator = result;
      const resultState = prepareTravelV2RoundActionOrderState(resultSession, { user: GM, isGM: true, travelV2RoundActionOrderReorderRequested: true, proposedOrder: ["engineer", "navigator", "watchmaster"] });
      assert.equal(resultState.reorderInteraction.canReorder, false, `${result} blocks reorder`);
      assert.equal(resultState.reorderInteraction.keyboardEnabled, false, `${result} disables keyboard`);
      assert.equal(resultState.reorderRequest.ready, false, `${result} disables ready commit`);
    }

    const playerState = prepareTravelV2RoundActionOrderState(sessionFixture("player"), { user: PLAYER, isGM: false, travelV2RoundActionOrderReorderRequested: true, proposedOrder: ["engineer", "navigator", "watchmaster"] });
    assert.equal(playerState.reorderInteraction, null, "players receive no GM-only interaction projection");
    assert.equal(JSON.stringify(playerState).includes("moveUpLabel"), false, "players receive no movement controls");
    const playerPreview = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: sessionFixture("player-preview"), user: PLAYER, uiState: { travelV2RoundActionOrderReorderRequested: true, travelV2ProposedRoundActionOrder: ["engineer", "navigator", "watchmaster"] } });
    assert.equal(playerPreview.travelV2PreviewPanel.roundActionOrderDisplay.canRequestReorderReview, false, "player preview exposes no reorder-review availability");

    const staleRoundApp = new ArcflightTravelEventRunner({ session: sessionFixture("stale-round") });
    staleRoundApp.moveTravelV2RoundActionOrderCandidate("engineer", "up");
    staleRoundApp.session.currentRoundIndex = 1;
    const staleRoundInspection = sanitizeTravelV2RoundActionOrderCandidateContext(staleRoundApp);
    assert.equal(staleRoundInspection.stale, true, "round change identifies stale candidate context");
    assert.equal(staleRoundApp.uiState.travelV2RoundActionOrderReorderRequested, false, "round change clears stale request before render");
    assert.deepEqual(staleRoundApp.uiState.travelV2ProposedRoundActionOrder, [], "round change clears stale candidate before render");
    const staleRoundPreview = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: staleRoundApp.session, user: GM, uiState: staleRoundApp.uiState });
    assert.equal(staleRoundPreview.travelV2PreviewPanel.roundActionOrderDisplay.reorderRequest.ready, false, "Round 2 render has no stale Ready to Commit state");
    const staleRoundBeforeCommit = snapshot(staleRoundApp.session);
    const staleRoundCommit = await staleRoundApp.commitTravelV2RoundActionOrder({ user: GM, isGM: true, timestamp: "2026-07-16T00:03:00.000Z" });
    assert.equal(staleRoundCommit.shouldUpdateSession, false, "explicit commit after stale-round cleanup is blocked");
    assert.equal(snapshot(staleRoundApp.session), staleRoundBeforeCommit, "stale-round commit leaves current round session unchanged");
    assert.equal(staleRoundApp.session.travelV2RoundActionOrder?.rounds?.["1"], undefined, "stale round candidate creates no Round 2 commit record");

    const staleSessionApp = new ArcflightTravelEventRunner({ session: sessionFixture("session-a") });
    staleSessionApp.moveTravelV2RoundActionOrderCandidate("engineer", "up");
    staleSessionApp.session = sessionFixture("session-b");
    staleSessionApp.selectedSessionKey = "session-b";
    const staleSessionInspection = sanitizeTravelV2RoundActionOrderCandidateContext(staleSessionApp);
    assert.equal(staleSessionInspection.stale, true, "session switch identifies stale candidate context");
    assert.equal(staleSessionApp.uiState.travelV2RoundActionOrderReorderRequested, false, "session switch clears stale request");
    assert.deepEqual(staleSessionApp.uiState.travelV2ProposedRoundActionOrder, [], "session switch clears stale candidate");
    const staleSessionBeforeCommit = snapshot(staleSessionApp.session);
    const staleSessionCommit = await staleSessionApp.commitTravelV2RoundActionOrder({ user: GM, isGM: true, timestamp: "2026-07-16T00:04:00.000Z" });
    assert.equal(staleSessionCommit.shouldUpdateSession, false, "session-switched stale candidate cannot commit");
    assert.equal(snapshot(staleSessionApp.session), staleSessionBeforeCommit, "session-switched commit leaves new session unchanged");

    const appA = new ArcflightTravelEventRunner({ session: sessionFixture("a") });
    appA.moveTravelV2RoundActionOrderCandidate("engineer", "up");
    const appB = new ArcflightTravelEventRunner({ session: sessionFixture("b") });
    assert.equal(appB.uiState.travelV2ProposedRoundActionOrder.length, 0, "session A candidate does not appear in session B instance");

    assert.equal(chat + journal + socket + actor + item + roll, 0, "keyboard movement and context guards create no world side effects");
    const template = fs.readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
    for (const text of ["reorderInteraction.canReorder", "reorderInteraction.keyboardEnabled", "reorderInteraction.canResetCandidate", "data-station-key", "data-direction", "Move Up", "Move Down", "Reset Proposed Order", "reorderRequest.ready"]) {
      assert.equal(template.includes(text), true, `template includes ${text}`);
    }
  } finally {
    if (previousGame === undefined) delete globalThis.game; else globalThis.game = previousGame;
    if (previousUi === undefined) delete globalThis.ui; else globalThis.ui = previousUi;
    if (previousChat === undefined) delete globalThis.ChatMessage; else globalThis.ChatMessage = previousChat;
    if (previousJournal === undefined) delete globalThis.JournalEntry; else globalThis.JournalEntry = previousJournal;
    if (previousRoll === undefined) delete globalThis.Roll; else globalThis.Roll = previousRoll;
  }

  return { ok: true, checked: ["gm-candidate", "edge-state", "reset", "explicit-commit", "committed-order-gate", "unlock-recommit", "results-block", "player-redaction", "round-isolation", "session-isolation", "no-side-effects", "template-bindings"] };
}

export default runTravelEventRunnerV2RoundActionOrderKeyboardReorderSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelEventRunnerV2RoundActionOrderKeyboardReorderSmokeChecks()
    .then((result) => {
      console.log("Travel event runner v2 round action order keyboard reorder smoke checks passed.");
      for (const check of result.checked) console.log(`- ${check}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
