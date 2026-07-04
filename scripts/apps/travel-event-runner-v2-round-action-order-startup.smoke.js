import { readFileSync } from "node:fs";
import { loadTravelEventRunnerSessionFromLibrary } from "../helpers/travel-event-runner.js";
import { prepareTravelV2RoundActionOrderState } from "../helpers/travel-v2-round-action-order-state.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel event runner v2 round action order startup smoke check failed: ${message}`); }
function assertEqual(actual, expected, message) { if (actual !== expected) throw new Error(`Travel event runner v2 round action order startup smoke check failed: ${message}. Expected ${expected}, got ${actual}.`); }
function snapshot(value) { return JSON.stringify(value); }

const COMMITTED_ORDER = Object.freeze(["engineer", "navigator", "watchmaster"]);
const GM_USER = Object.freeze({ isGM: true, id: "gm-startup", name: "Startup GM" });
const PLAYER_USER = Object.freeze({ isGM: false, id: "player-startup", name: "Startup Player" });

function savedSessionFixture() {
  return {
    key: "runner-order-startup-fixture",
    name: "Round Action Order Startup Fixture",
    status: "active",
    currentRoundIndex: 0,
    roundPhase: "stationOrders",
    event: {
      key: "round-action-order-startup-event",
      name: "Round Action Order Startup Event",
      category: "travel",
      rounds: [{
        roundNumber: 1,
        title: "Startup Round",
        activeStations: ["navigator", "engineer", "watchmaster"],
        stationPrompts: {
          navigator: { stationName: "Navigator" },
          engineer: { stationName: "Engineer" },
          watchmaster: { stationName: "Watchmaster" }
        },
        stationActionOrder: ["navigator", "engineer", "watchmaster"]
      }]
    },
    roundResults: [{
      roundIndex: 0,
      stationResults: { navigator: null, engineer: null, watchmaster: null },
      selectedStationOptionLabels: { navigator: "Plot the route", engineer: "Tune the engine", watchmaster: "Watch the void" },
      stationActions: {
        navigator: { type: "eventApproach", gmText: "secret route", applyPayload: { targetActorUuid: "Actor.secret" } },
        engineer: { type: "eventApproach", internalMutation: true },
        watchmaster: { type: "support", targetStationKey: "navigator" }
      },
      stationOrderCommitments: {
        navigator: { committed: true, source: "player" },
        engineer: { committed: true, source: "player" },
        watchmaster: { committed: true, source: "player" }
      }
    }],
    travelV2RoundActionOrder: {
      version: 3,
      rounds: {
        "0": {
          roundIndex: 0,
          roundNumber: 1,
          order: [...COMMITTED_ORDER],
          stationOrder: [...COMMITTED_ORDER],
          committedAt: "2026-07-04T00:20:00.000Z",
          source: "gm-order-commit",
          userId: "gm-secret-id",
          userName: "Secret GM Name",
          auditRecord: {
            id: "round-action-order:0:2026-07-04T00:20:00.000Z",
            type: "roundActionOrderCommit",
            roundIndex: 0,
            roundNumber: 1,
            previousOrder: ["navigator", "engineer", "watchmaster"],
            committedOrder: [...COMMITTED_ORDER],
            timestamp: "2026-07-04T00:20:00.000Z",
            source: "gm-order-commit",
            userId: "gm-secret-id",
            userName: "Secret GM Name",
            isGM: true,
            mutationScope: "session-local-station-action-order-only"
          }
        }
      },
      commitRecords: [{
        id: "round-action-order:0:2026-07-04T00:20:00.000Z",
        type: "roundActionOrderCommit",
        roundIndex: 0,
        roundNumber: 1,
        previousOrder: ["navigator", "engineer", "watchmaster"],
        committedOrder: [...COMMITTED_ORDER],
        timestamp: "2026-07-04T00:20:00.000Z",
        source: "gm-order-commit",
        userId: "gm-secret-id",
        userName: "Secret GM Name",
        isGM: true,
        mutationScope: "session-local-station-action-order-only"
      }]
    }
  };
}

function libraryWith(session) {
  return { version: 1, sessions: { [session.key]: { key: session.key, name: session.name, eventKey: session.event.key, eventName: session.event.name, eventCategory: session.event.category, status: session.status, currentRoundIndex: session.currentRoundIndex, session } } };
}

function assertPlayerSafe(value, label) {
  const text = snapshot(value);
  for (const forbidden of ["commitRecords", "auditRecord", "gmText", "gmSummary", "gmMechanicalNotes", "applyPayload", "internalMutation", "targetActorUuid", "userId", "Secret GM Name", "gm-secret-id", "mutationScope", "GM-only", "gmOnly"]) {
    assertSmoke(!text.includes(forbidden), `${label} leaked ${forbidden}`);
  }
}

async function importRunnerModule() {
  const previousFoundry = globalThis.foundry;
  globalThis.foundry = { applications: { api: { ApplicationV2: class { async _prepareContext() { return {}; } render() { return { rendered: true }; } _onRender() {} }, HandlebarsApplicationMixin: (Base) => Base } } };
  try { return await import(`./travel-event-runner.js?roundActionOrderStartupSmoke=${Date.now()}`); }
  finally { if (previousFoundry === undefined) delete globalThis.foundry; else globalThis.foundry = previousFoundry; }
}

export async function runTravelEventRunnerV2RoundActionOrderStartupSmokeChecks() {
  const checked = [];
  const savedSession = savedSessionFixture();
  const library = libraryWith(savedSession);
  const loaded = loadTravelEventRunnerSessionFromLibrary(savedSession.key, { library });
  assertSmoke(loaded.ok, "saved session with committed action order loads through existing runner session loader");
  assertEqual(loaded.session.travelV2RoundActionOrder.rounds["0"].order.join(","), COMMITTED_ORDER.join(","), "loaded session retains committed order record");
  assertEqual(loaded.session.travelV2RoundActionOrder.commitRecords.length, 1, "loaded session retains one commit record");
  checked.push("saved session loads through existing library/session loader with committed order intact");

  const beforeStartup = snapshot(loaded.session);
  const beforeCommitRecords = snapshot(loaded.session.travelV2RoundActionOrder.commitRecords);
  const orderState = prepareTravelV2RoundActionOrderState(loaded.session, { user: GM_USER, isGM: true });
  assertEqual(orderState.orderedStationKeys.join(","), COMMITTED_ORDER.join(","), "startup/session-selection helper state uses persisted committed order");
  const preview = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: loaded.session, selectedSessionKey: savedSession.key, user: GM_USER, isGM: true });
  assertEqual(preview.travelV2PreviewPanel.roundActionOrderDisplay.rows.map((row) => row.stationKey).join(","), COMMITTED_ORDER.join(","), "preview render state orders stations by persisted committed order");
  assertEqual(snapshot(loaded.session), beforeStartup, "render prep does not mutate loaded session");
  assertEqual(snapshot(loaded.session.travelV2RoundActionOrder.commitRecords), beforeCommitRecords, "render prep does not duplicate commit records");
  checked.push("startup render prep and preview display persisted committed order without session mutation");

  const previousGame = globalThis.game;
  globalThis.game = { user: GM_USER, actors: { values: () => [] }, users: { filter: () => [] } };
  try {
    const { ArcflightTravelEventRunner } = await importRunnerModule();
    const app = new ArcflightTravelEventRunner({ session: loaded.session, selectedSessionKey: savedSession.key, selectedEventId: loaded.session.event.key });
    const beforeAppSession = snapshot(app.session);
    const context = await app._prepareContext({});
    assertEqual(context.state.travelV2PreviewPanel.roundActionOrderDisplay.rows.map((row) => row.stationKey).join(","), COMMITTED_ORDER.join(","), "app _prepareContext display uses persisted committed order after restore/open");
    assertEqual(snapshot(app.session), beforeAppSession, "app _prepareContext does not mutate loaded session");
    assertEqual(app.uiState.travelV2RoundActionOrderCommitResult, null, "startup does not create commit result");
    assertEqual(app.uiState.travelV2RoundActionOrderPersistResult, null, "startup does not create persistence result");
    assertEqual(snapshot(app.uiState.travelV2ProposedRoundActionOrder), "[]", "startup does not create proposed order");
    assertSmoke(!snapshot(context.state).includes("travelV2RoundActionOrderCommitResult\":{\"ok\""), "startup context does not rerun commit");
    checked.push("restored app startup context does not propose, commit, persist, or mutate");
  } finally {
    if (previousGame === undefined) delete globalThis.game; else globalThis.game = previousGame;
  }

  const nonGmPreview = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: loaded.session, selectedSessionKey: savedSession.key, user: PLAYER_USER, isGM: false });
  assertEqual(nonGmPreview.travelV2PreviewPanel.roundActionOrderDisplay.rows.map((row) => row.stationKey).join(","), COMMITTED_ORDER.join(","), "non-GM display still sees persisted order");
  assertPlayerSafe(nonGmPreview.travelV2PreviewPanel.roundActionOrderDisplay, "non-GM startup round action order display");
  checked.push("non-GM startup display is player-safe and redacts GM-only audit metadata");

  const aggregate = readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8");
  assertSmoke(aggregate.includes("runTravelEventRunnerV2RoundActionOrderStartupSmokeChecks"), "aggregate Travel v2 smoke includes startup hardening suite");
  checked.push("aggregate Travel v2 smoke includes startup hardening suite");

  return { ok: true, checked };
}

export default runTravelEventRunnerV2RoundActionOrderStartupSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelEventRunnerV2RoundActionOrderStartupSmokeChecks().then((result) => { console.log("Travel event runner v2 round action order startup smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
