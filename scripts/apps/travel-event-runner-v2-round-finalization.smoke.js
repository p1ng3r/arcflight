import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel event runner v2 round finalization smoke check failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Travel event runner v2 round finalization smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
  }
}

function snapshot(value) {
  return JSON.stringify(value);
}

function recordsFrom(container) {
  if (Array.isArray(container)) return container;
  if (Array.isArray(container?.records)) return container.records;
  return [];
}

function lockedStationActionsFixture({ unlockedStation = "", missingStation = "", invalidStation = "" } = {}) {
  const stations = ["captain", "navigator", "engineer", "veilwarden", "watchmaster"];
  const stationActions = {};
  const stationOrderCommitments = {};
  for (const stationKey of stations) {
    if (stationKey === missingStation) continue;
    stationActions[stationKey] = stationKey === "engineer"
      ? { actionKey: "support", type: "support", label: "Support", targetStationKey: "navigator", gmText: "GM-only action text", auditRecord: { secret: true } }
      : { actionKey: "eventApproach", label: "Event Approach", gmOnly: "hidden" };
    stationOrderCommitments[stationKey] = { committed: stationKey !== unlockedStation };
  }
  if (invalidStation) {
    stationActions[invalidStation] = { actionKey: "eventApproach", label: "Hidden Action" };
    stationOrderCommitments[invalidStation] = { committed: true };
  }
  return { stationActions, stationOrderCommitments };
}

function createRunnerSessionFixture(overrides = {}) {
  const lockIn = lockedStationActionsFixture(overrides.lockInOptions);
  const cleanOverrides = { ...overrides };
  delete cleanOverrides.lockInOptions;
  return {
    key: "runner-finalization-fixture",
    status: "active",
    currentRoundIndex: 0,
    pressure: {
      [ARCFLIGHT_TRAVEL_RESOURCES.HULL]: { value: 0, crossed: [] },
      [ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES]: { value: 0, crossed: [] }
    },
    event: {
      rounds: [
        {
          number: 1,
          title: "Runner Round Finalization Test",
          primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.HULL,
          secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES,
          pressureStation: "engineer",
          activeStations: ["captain", "navigator", "engineer", "veilwarden", "watchmaster"],
          stationPrompts: {
            captain: { stationName: "Captain" },
            navigator: { stationName: "Navigator" },
            engineer: { stationName: "Engineer" },
            veilwarden: { stationName: "Veilwarden" },
            watchmaster: { stationName: "Watchmaster" }
          },
          stationSummary: { engineer: { degree: "failure" } }
        }
      ]
    },
    roundResults: [
      {
        stationResults: { captain: "success", navigator: "success", engineer: "failure", veilwarden: "success", watchmaster: "success" },
        ...lockIn
      }
    ],
    ...cleanOverrides
  };
}

async function importRunnerModule() {
  const previousFoundry = globalThis.foundry;
  let renderCalls = 0;
  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: class {
          async _prepareContext() { return {}; }
          render() { renderCalls += 1; return { rendered: true, renderCalls }; }
          _onRender() {}
        },
        HandlebarsApplicationMixin: (Base) => Base
      }
    }
  };
  try {
    const module = await import(`./travel-event-runner.js?roundFinalizationSmoke=${Date.now()}`);
    return { module, getRenderCalls: () => renderCalls };
  } finally {
    if (previousFoundry === undefined) delete globalThis.foundry;
    else globalThis.foundry = previousFoundry;
  }
}

export async function runTravelEventRunnerV2RoundFinalizationSmokeChecks() {
  const { module, getRenderCalls } = await importRunnerModule();
  const {
    ArcflightTravelEventRunner,
    prepareTravelV2PressureApplicationRunnerUpdate,
    prepareTravelV2PressureCorrectionRunnerUpdate,
    prepareTravelV2RoundFinalizationRunnerUpdate
  } = module;

  assertSmoke(typeof prepareTravelV2RoundFinalizationRunnerUpdate === "function", "runner finalization update helper should be exported");

  let chatCalls = 0;
  let socketCalls = 0;
  let actorUpdateCalls = 0;
  let itemUpdateCalls = 0;
  const previousGame = globalThis.game;
  globalThis.game = {
    socket: { emit: () => { socketCalls += 1; } },
    actors: { values: () => [], get: () => ({ update: () => { actorUpdateCalls += 1; } }) },
    items: { values: () => [], get: () => ({ update: () => { itemUpdateCalls += 1; } }) },
    users: { filter: () => [] }
  };
  const previousChatMessage = globalThis.ChatMessage;
  globalThis.ChatMessage = { create: () => { chatCalls += 1; } };

  try {
    const missing = prepareTravelV2RoundFinalizationRunnerUpdate(null, { now: "2026-01-01T00:00:00.000Z" });
    assertSmoke(!missing.result.ok && !missing.result.finalized, "missing session should block without throwing");
    assertSmoke(!missing.shouldUpdateSession, "missing session should not request session replacement");

    const noPressure = createRunnerSessionFixture();
    const noPressureBefore = snapshot(noPressure);
    const blocked = prepareTravelV2RoundFinalizationRunnerUpdate(noPressure, { now: "2026-01-01T00:00:01.000Z" });
    assertSmoke(!blocked.result.ok && !blocked.result.finalized, "round without pressure application should block");
    assertSmoke(!blocked.shouldUpdateSession, "blocked round should not request session replacement");
    assertEqual(snapshot(noPressure), noPressureBefore, "blocked round should not mutate input session");

    const missingActionSession = createRunnerSessionFixture({ lockInOptions: { missingStation: "captain" } });
    const missingActionApplied = prepareTravelV2PressureApplicationRunnerUpdate(missingActionSession, { selectedOutcomeKey: "failure", now: "2026-01-01T00:00:01.100Z" });
    const missingActionBefore = snapshot(missingActionApplied.nextSession);
    const missingActionBlocked = prepareTravelV2RoundFinalizationRunnerUpdate(missingActionApplied.nextSession, { now: "2026-01-01T00:00:01.200Z" });
    assertSmoke(!missingActionBlocked.result.ok && !missingActionBlocked.result.finalized, "missing station action should block finalization");
    assertSmoke(!missingActionBlocked.result.stationActionSummary, "missing station action should block before station action summary generation");
    assertSmoke(missingActionBlocked.result.playerMessage.includes("selected and locked"), "blocked result should include safe player-facing lock-in message");
    assertSmoke(missingActionBlocked.result.gmMessage.includes("captain"), "blocked result should include readable GM-facing station reason");
    assertEqual(snapshot(missingActionApplied.nextSession), missingActionBefore, "missing action guard should not mutate input session");

    const unlockedSession = createRunnerSessionFixture({ lockInOptions: { unlockedStation: "navigator" } });
    const unlockedApplied = prepareTravelV2PressureApplicationRunnerUpdate(unlockedSession, { selectedOutcomeKey: "failure", now: "2026-01-01T00:00:01.300Z" });
    const unlockedBlocked = prepareTravelV2RoundFinalizationRunnerUpdate(unlockedApplied.nextSession, { now: "2026-01-01T00:00:01.400Z" });
    assertSmoke(!unlockedBlocked.result.ok && !unlockedBlocked.result.finalized, "unlocked station action should block finalization");
    assertSmoke(unlockedBlocked.result.gmMessage.includes("navigator"), "unlocked station block should identify station for GM");

    const invalidStationSession = createRunnerSessionFixture({ lockInOptions: { invalidStation: "secret" } });
    const invalidStationApplied = prepareTravelV2PressureApplicationRunnerUpdate(invalidStationSession, { selectedOutcomeKey: "failure", now: "2026-01-01T00:00:01.500Z" });
    const invalidStationBlocked = prepareTravelV2RoundFinalizationRunnerUpdate(invalidStationApplied.nextSession, { now: "2026-01-01T00:00:01.600Z" });
    assertSmoke(!invalidStationBlocked.result.ok && !invalidStationBlocked.result.finalized, "invalid station key should block finalization safely");
    const playerBlockJson = JSON.stringify({ message: invalidStationBlocked.result.playerMessage, reasons: invalidStationBlocked.result.playerBlockedReasons });
    assertSmoke(!playerBlockJson.includes("gmOnly") && !playerBlockJson.includes("auditRecord") && !playerBlockJson.includes("secret"), "player-facing lock-in block should not leak GM-only validation details or invalid raw station keys");

    const source = createRunnerSessionFixture();
    const sourceBefore = snapshot(source);
    const applied = prepareTravelV2PressureApplicationRunnerUpdate(source, { selectedOutcomeKey: "failure", now: "2026-01-01T00:00:02.000Z" });
    assertSmoke(applied.shouldUpdateSession, "fixture should support pressure application before finalization");
    const successful = prepareTravelV2RoundFinalizationRunnerUpdate(applied.nextSession, { now: "2026-01-01T00:00:03.000Z" });
    assertSmoke(successful.result.ok && successful.result.finalized, "effective pressure application should finalize");
    assertSmoke(successful.shouldUpdateSession, "successful finalization should request session replacement");
    assertSmoke(successful.shouldRerender, "successful finalization should request rerender");
    assertSmoke(successful.nextSession !== applied.nextSession, "successful finalization should return a cloned updated session");
    assertEqual(snapshot(source), sourceBefore, "finalization path should not mutate original input session");
    assertEqual(recordsFrom(successful.nextSession.travelV2RoundResolutions).length, 1, "successful finalization should append exactly one resolution record");
    const resolutionRecord = recordsFrom(successful.nextSession.travelV2RoundResolutions)[0];
    const stationActionSummary = successful.result.stationActionSummary;
    assertSmoke(stationActionSummary && resolutionRecord.stationActionSummary, "successful finalization should record station action summary on result and resolution record");
    assertEqual(stationActionSummary.stations.length, 5, "station action summary should include all Travel Five stations");
    assertSmoke(stationActionSummary.stations.every((row) => row.roundIndex === 0 && row.roundNumber === 1 && row.committed === true && row.locked === true), "station action summary rows should include round metadata and locked/committed state");
    const supportSummary = stationActionSummary.stations.find((row) => row.stationKey === "engineer");
    assertSmoke(supportSummary?.selectedActionKey === "support" && supportSummary?.selectedActionType === "support", "support station action summary should include safe action key and type");
    assertSmoke(supportSummary?.targetStationKey === "navigator" && supportSummary?.targetStationLabel === "Navigator", "support station action summary should include safe target station display");
    const summaryJson = JSON.stringify(stationActionSummary);
    for (const forbidden of ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions"]) {
      assertSmoke(!summaryJson.includes(forbidden), `station action summary should not include forbidden player-safe term ${forbidden}`);
    }

    const duplicateBefore = snapshot(successful.nextSession);
    const duplicate = prepareTravelV2RoundFinalizationRunnerUpdate(successful.nextSession, { now: "2026-01-01T00:00:04.000Z" });
    assertSmoke(!duplicate.result.ok && !duplicate.result.finalized, "duplicate finalization should block");
    assertSmoke(!duplicate.shouldUpdateSession, "duplicate finalization should not replace session");
    assertEqual(recordsFrom(duplicate.nextSession.travelV2RoundResolutions).length, 1, "duplicate finalization should not append another record");
    assertEqual(snapshot(successful.nextSession), duplicateBefore, "duplicate finalization should not mutate finalized session");

    const completed = prepareTravelV2RoundFinalizationRunnerUpdate({ ...applied.nextSession, status: "completed" }, { now: "2026-01-01T00:00:05.000Z" });
    assertSmoke(!completed.result.ok && !completed.result.finalized, "completed session should block finalization");

    const corrected = prepareTravelV2PressureCorrectionRunnerUpdate(applied.nextSession, { correctedOutcomeKey: "mixed", now: "2026-01-01T00:00:06.000Z" });
    assertSmoke(corrected.shouldUpdateSession, "fixture should support pressure correction before finalization");
    const correctedFinalized = prepareTravelV2RoundFinalizationRunnerUpdate(corrected.nextSession, { now: "2026-01-01T00:00:07.000Z" });
    assertSmoke(correctedFinalized.shouldUpdateSession, "corrected pressure outcome should finalize");
    assertEqual(correctedFinalized.result.effectiveOutcomeKey, "mixed", "finalization should preserve corrected effective outcome");
    assertEqual(correctedFinalized.result.roundResolutionRecord.effectiveOutcomeKey, "mixed", "resolution record should preserve corrected effective outcome");

    const stateBefore = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: applied.nextSession });
    const renderApp = new ArcflightTravelEventRunner({ session: applied.nextSession });
    const renderSessionBefore = snapshot(renderApp.session);
    const context = await renderApp._prepareContext({});
    assertEqual(snapshot(renderApp.session), renderSessionBefore, "runner state preparation should not automatically finalize");
    assertEqual(recordsFrom(renderApp.session.travelV2RoundResolutions).length, 0, "render state should not append finalization records");
    assertSmoke(context.state, "runner state preparation should still return app state");
    assertSmoke(stateBefore, "preview consumer preparation should remain explicit and inert");

    const app = new ArcflightTravelEventRunner({ session: applied.nextSession });
    const appResult = await app.finalizeTravelV2Round({ now: "2026-01-01T00:00:08.000Z" });
    assertSmoke(appResult.rendered, "internal app finalization method should rerender on success");
    assertEqual(app.uiState.travelV2RoundFinalizationResult.finalized, true, "app should store successful finalization result in UI state");
    assertEqual(recordsFrom(app.session.travelV2RoundResolutions).length, 1, "app should replace session with finalized clone");
    const appStateAfterFinalize = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: app.session, travelV2RoundFinalizationResult: app.uiState.travelV2RoundFinalizationResult });
    assertSmoke(appStateAfterFinalize.travelV2PreviewPanel.travelV2StationActionResolutionSummary.hasStations, "runner render state should expose finalized station action summary");
    assertSmoke(appStateAfterFinalize.travelV2PreviewPanel.travelV2StationActionResolutionSummary.stations.some((row) => row.stationKey === "engineer" && row.targetStationLabel === "Navigator"), "runner render state should expose safe Support target display");
    assertEqual(app.selectedSessionKey, "runner-finalization-fixture", "app should preserve selected session key from session");

    const blockedApp = new ArcflightTravelEventRunner({ session: noPressure });
    const blockedAppResult = await blockedApp.finalizeTravelV2Round({ now: "2026-01-01T00:00:09.000Z" });
    assertSmoke(blockedAppResult && !blockedAppResult.shouldUpdateSession, "blocked app finalization should return update details without rerender");
    assertSmoke(blockedApp.uiState.travelV2RoundFinalizationResult.ok === false, "app should store blocked finalization result in UI state");
    assertEqual(snapshot(blockedApp.session), noPressureBefore, "blocked app finalization should not mutate session");

    assertEqual(chatCalls, 0, "runner finalization path should not create chat messages");
    assertEqual(socketCalls, 0, "runner finalization path should not emit sockets");
    assertEqual(actorUpdateCalls, 0, "runner finalization path should not update actors");
    assertEqual(itemUpdateCalls, 0, "runner finalization path should not update items");

    const fs = await import("node:fs");
    const template = fs.readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
    assertSmoke(template.includes("data-arcflight-travel-v2-round-finalize"), "template should include visible round finalization control");
    assertSmoke(template.includes("travelV2StationActionResolutionSummary"), "template should render finalized station action summary when available");
    assertSmoke(template.includes("state.travelV2PreviewPanel.travelV2RoundFinalizationState"), "template should use prepared finalization state");
    assertSmoke(template.includes("finalizeDisabled"), "template should use prepared disabled state");
    assertSmoke(!template.includes("data-arcflight-runner-complete") || template.includes("data-arcflight-travel-v2-round-finalize"), "finalization control should not replace or add event completion behavior");
    const aggregate = fs.readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8");
    assertSmoke(aggregate.includes("runTravelEventRunnerV2RoundFinalizationSmokeChecks"), "aggregate Travel v2 smoke runner should include finalization suite");
    assertSmoke(getRenderCalls() >= 1, "successful app finalization should have requested at least one render");

    return {
      ok: true,
      checked: [
        "runner-helper-exported",
        "missing-session-blocked",
        "no-pressure-application-blocked",
        "missing-station-action-lock-in-blocked",
        "unlocked-station-action-lock-in-blocked",
        "invalid-station-key-lock-in-blocked",
        "player-safe-lock-in-block-redacted",
        "ready-locked-finalization-records-station-action-summary",
        "summary-includes-travel-five",
        "support-target-safe-summary",
        "station-action-summary-player-safe-redacted",
        "successful-finalization-replaces-session",
        "duplicate-finalization-non-destructive",
        "completed-session-blocked",
        "corrected-outcome-finalizes",
        "single-resolution-record-appended",
        "input-session-not-mutated",
        "no-chat-socket-actor-item-side-effects",
        "render-state-does-not-finalize",
        "visible-template-controls",
        "aggregate-smoke-includes-suite",
        "app-internal-action-wiring"
      ]
    };
  } finally {
    if (previousGame === undefined) delete globalThis.game;
    else globalThis.game = previousGame;
    if (previousChatMessage === undefined) delete globalThis.ChatMessage;
    else globalThis.ChatMessage = previousChatMessage;
  }
}

export default runTravelEventRunnerV2RoundFinalizationSmokeChecks;
