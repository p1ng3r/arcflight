import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRAVEL_V2_ROUND_ACTION_ORDER_STATE_VERSION, prepareTravelV2RoundActionOrderState } from "./travel-v2-round-action-order-state.js";

const json = (value) => JSON.stringify(value);
const forbidden = ["gmText", "gmSummary", "gmMechanicalNotes", "applyPayload", "internalMutation", "socketPayload", "targetActorUuid"];

function assertPlayerSafe(value) {
  const text = json(value);
  for (const key of forbidden) assert.equal(text.includes(key), false, `player-safe output leaked ${key}`);
}

function fixture(overrides = {}) {
  return {
    status: "active",
    currentRoundIndex: 0,
    roundPhase: "stationOrders",
    event: {
      rounds: [{
        roundNumber: 1,
        title: "Broken Span",
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
      selectedStationOptionLabels: { navigator: "Plot the route", engineer: "Support Navigator", watchmaster: "Watch the void" },
      stationActions: {
        navigator: { type: "eventApproach", skill: "survival", gmText: "secret", applyPayload: { bad: true } },
        engineer: { type: "support", targetStationKey: "navigator" },
        watchmaster: { type: "eventApproach", skill: "perception", internalMutation: true }
      },
      stationOrderCommitments: {
        navigator: { committed: true, source: "player", selectedFocusAbility: "read-the-route" },
        engineer: { committed: false },
        watchmaster: { committed: false }
      }
    }],
    ...overrides
  };
}

export default async function runTravelV2RoundActionOrderStateSmokeChecks() {
  const checked = [];
  assert.equal(TRAVEL_V2_ROUND_ACTION_ORDER_STATE_VERSION, 1);
  assert.equal(typeof prepareTravelV2RoundActionOrderState, "function");
  checked.push("exports and version");

  const missing = prepareTravelV2RoundActionOrderState(null);
  assert.equal(missing.blocked, true);
  assert.match(missing.blockedReasons[0], /session is required/);
  assert.equal(missing.rows.length, 0);
  checked.push("missing session blocks safely");

  const state = prepareTravelV2RoundActionOrderState(fixture());
  assert.equal(state.ready, true);
  assert.equal(state.hasRows, true);
  assert.deepEqual(state.orderedStationKeys, ["navigator", "engineer", "watchmaster"]);
  assert.equal(state.rows[0].stationName, "Navigator");
  assert.equal(state.rows[0].selectedActionLabel, "Plot the route");
  assert.equal(state.rows[0].committed, true);
  assert.equal(state.rows[0].selectedFocusAbility, "read-the-route");
  assert.equal(state.rows[1].pendingOrder, true);
  assert.equal(state.currentStationKey, "engineer");
  assert.equal(state.currentMode, "order");
  assert.equal(state.pendingOrderCount, 2);
  assertPlayerSafe(state);
  checked.push("current round action order rows are player-safe and ordered");

  const rollState = prepareTravelV2RoundActionOrderState(fixture({
    roundPhase: "stationRolls",
    roundResults: [{
      roundIndex: 0,
      stationResults: { navigator: "success", engineer: null, watchmaster: null },
      selectedStationOptionLabels: { navigator: "Plot the route", engineer: "Support Navigator", watchmaster: "Watch the void" },
      stationActions: { navigator: { type: "eventApproach" }, engineer: { type: "support" }, watchmaster: { type: "eventApproach" } },
      stationOrderCommitments: { navigator: { committed: true }, engineer: { committed: true }, watchmaster: { committed: true } }
    }]
  }));
  assert.equal(rollState.currentStationKey, "engineer");
  assert.equal(rollState.currentMode, "roll");
  assert.equal(rollState.resolvedCount, 1);
  assert.equal(rollState.pendingRollCount, 2);
  checked.push("station-roll phase points at first unresolved committed station");

  const customOrder = prepareTravelV2RoundActionOrderState(fixture(), { order: ["watchmaster", "navigator"] });
  assert.deepEqual(customOrder.orderedStationKeys, ["watchmaster", "navigator", "engineer"]);
  assert.equal(customOrder.rows[0].stationKey, "watchmaster");
  checked.push("explicit order projection preserves active stations and appends omitted stations");

  const completedRound = prepareTravelV2RoundActionOrderState(fixture({ travelV2RoundResolutions: { records: [{ roundIndex: 0, outcomeKey: "success" }] } }));
  assert.equal(completedRound.blocked, true);
  assert.match(completedRound.blockedReasons.join("\n"), /already completed/);
  assert.equal(completedRound.hasCurrent, false);
  checked.push("completed round blocks current pointer");

  const completedSession = prepareTravelV2RoundActionOrderState(fixture({ status: "completed", completedAt: "2026-07-03T00:00:00.000Z" }));
  assert.equal(completedSession.blocked, true);
  assert.match(completedSession.blockedReasons.join("\n"), /session is completed/);
  checked.push("completed session blocks safely");

  const emptyStations = prepareTravelV2RoundActionOrderState(fixture({ event: { rounds: [{ roundNumber: 1, activeStations: [], stationPrompts: {} }] }, roundResults: [{ roundIndex: 0, stationResults: {} }] }));
  assert.equal(emptyStations.blocked, true);
  assert.match(emptyStations.blockedReasons.join("\n"), /no active stations/);
  checked.push("empty station list blocks with readable reason");

  const source = readFileSync(new URL("./travel-v2-round-action-order-state.js", import.meta.url), "utf8");
  for (const forbiddenCall of [".setFlag(", ".update(", ".create(", ".delete(", "ChatMessage", "JournalEntry", "Scene", "TokenDocument", "Combat", "game.settings.set", "socket.emit"]) assert.equal(source.includes(forbiddenCall), false, `helper contains forbidden runtime write call ${forbiddenCall}`);
  const aggregate = readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8");
  assert.equal(aggregate.includes("runTravelV2RoundActionOrderStateSmokeChecks"), true);
  checked.push("source scan finds no obvious runtime writes and aggregate runner includes this suite");

  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2RoundActionOrderStateSmokeChecks().then((result) => { console.log("Travel v2 round action order state smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
