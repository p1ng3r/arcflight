import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel event runner v2 event completion smoke check failed: ${message}`); }
function assertEqual(actual, expected, message) { if (actual !== expected) throw new Error(`Travel event runner v2 event completion smoke check failed: ${message}. Expected ${expected}, got ${actual}.`); }
function snapshot(value) { return JSON.stringify(value); }
function sessionFixture(overrides = {}) { return { key: "runner-completion-fixture", status: "active", currentRoundIndex: 0, event: { rounds: [{ roundNumber: 1, title: "One" }] }, travelV2RoundResolutions: { records: [{ roundIndex: 0, roundNumber: 1, effectiveOutcomeKey: "success" }] }, ...overrides }; }

async function importRunnerModule() {
  const previousFoundry = globalThis.foundry;
  let renderCalls = 0;
  globalThis.foundry = { applications: { api: { ApplicationV2: class { async _prepareContext() { return {}; } render() { renderCalls += 1; return { rendered: true, renderCalls }; } _onRender() {} }, HandlebarsApplicationMixin: (Base) => Base } } };
  try { return { module: await import(`./travel-event-runner.js?eventCompletionSmoke=${Date.now()}`), getRenderCalls: () => renderCalls }; }
  finally { if (previousFoundry === undefined) delete globalThis.foundry; else globalThis.foundry = previousFoundry; }
}

export async function runTravelEventRunnerV2EventCompletionSmokeChecks() {
  const { module, getRenderCalls } = await importRunnerModule();
  const { ArcflightTravelEventRunner, prepareTravelV2EventCompletionRunnerUpdate } = module;
  assertEqual(typeof prepareTravelV2EventCompletionRunnerUpdate, "function", "runner completion update helper should be exported");

  let chatCalls = 0, socketCalls = 0, actorUpdateCalls = 0, itemUpdateCalls = 0;
  const previousGame = globalThis.game;
  const previousChatMessage = globalThis.ChatMessage;
  globalThis.game = { socket: { emit: () => { socketCalls += 1; } }, actors: { get: () => ({ update: () => { actorUpdateCalls += 1; } }), values: () => [] }, items: { get: () => ({ update: () => { itemUpdateCalls += 1; } }), values: () => [] }, users: { filter: () => [] } };
  globalThis.ChatMessage = { create: () => { chatCalls += 1; } };
  try {
    const blockedSession = sessionFixture({ travelV2RoundResolutions: { records: [] } });
    const blockedBefore = snapshot(blockedSession);
    const blocked = prepareTravelV2EventCompletionRunnerUpdate(blockedSession, { now: "2026-06-20T00:00:00.000Z" });
    assertSmoke(!blocked.shouldUpdateSession, "blocked completion does not update session");
    assertEqual(snapshot(blockedSession), blockedBefore, "blocked completion does not mutate input");

    const ready = sessionFixture();
    const readyBefore = snapshot(ready);
    const update = prepareTravelV2EventCompletionRunnerUpdate(ready, { now: "2026-06-20T00:01:00.000Z" });
    assertSmoke(update.shouldUpdateSession && update.shouldRerender, "successful completion updates session and rerenders");
    assertEqual(update.nextSession.status, "completed", "successful update marks session completed");
    assertEqual(snapshot(ready), readyBefore, "successful update does not mutate source");

    const stateBefore = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: ready });
    assertSmoke(stateBefore.travelV2PreviewPanel.travelV2EventCompletionReadiness.canCompleteEvent, "state preparation can report readiness");
    assertEqual(ready.status, "active", "state preparation does not complete automatically");

    const app = new ArcflightTravelEventRunner({ session: ready });
    const rendered = await app.completeTravelV2Event({ now: "2026-06-20T00:02:00.000Z" });
    assertSmoke(rendered.rendered, "app completion rerenders on success");
    assertEqual(app.uiState.travelV2EventCompletionResult.completed, true, "app stores success result");
    assertEqual(app.session.status, "completed", "app replaces session with completed clone");
    assertEqual(app.selectedSessionKey, "runner-completion-fixture", "app preserves selected session key");

    const blockedApp = new ArcflightTravelEventRunner({ session: blockedSession });
    const blockedAppResult = await blockedApp.completeTravelV2Event({ now: "2026-06-20T00:03:00.000Z" });
    assertSmoke(blockedAppResult && !blockedAppResult.shouldUpdateSession, "blocked app completion returns update details without rerender");
    assertEqual(blockedApp.uiState.travelV2EventCompletionResult.ok, false, "app stores blocked result");
    assertEqual(snapshot(blockedApp.session), blockedBefore, "blocked app completion does not mutate session");

    assertEqual(chatCalls, 0, "completion should not create chat messages");
    assertEqual(socketCalls, 0, "completion should not emit sockets");
    assertEqual(actorUpdateCalls, 0, "completion should not update actors");
    assertEqual(itemUpdateCalls, 0, "completion should not update items");
    assertSmoke(getRenderCalls() >= 1, "successful completion requested render");
  } finally {
    if (previousGame === undefined) delete globalThis.game; else globalThis.game = previousGame;
    if (previousChatMessage === undefined) delete globalThis.ChatMessage; else globalThis.ChatMessage = previousChatMessage;
  }
  return { ok: true, checked: ["runner-helper-exported", "blocked-no-update", "success-update", "app-success-state", "app-blocked-state", "no-side-effects", "state-prep-inert"] };
}

export default runTravelEventRunnerV2EventCompletionSmokeChecks;
