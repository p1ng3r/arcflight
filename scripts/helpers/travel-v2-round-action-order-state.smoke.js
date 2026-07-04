import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRAVEL_V2_ROUND_ACTION_ORDER_STATE_VERSION, commitTravelV2RoundActionOrderToSession, normalizeTravelV2ProposedRoundActionOrder, prepareTravelV2RoundActionOrderState } from "./travel-v2-round-action-order-state.js";

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
  assert.equal(TRAVEL_V2_ROUND_ACTION_ORDER_STATE_VERSION, 3);
  assert.equal(typeof normalizeTravelV2ProposedRoundActionOrder, "function");
  assert.equal(typeof prepareTravelV2RoundActionOrderState, "function");
  assert.equal(typeof commitTravelV2RoundActionOrderToSession, "function");
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

  const validation = normalizeTravelV2ProposedRoundActionOrder(["engineer", "navigator", "watchmaster"], ["navigator", "engineer", "watchmaster"]);
  assert.equal(validation.ready, true);
  const invalidValidation = normalizeTravelV2ProposedRoundActionOrder(["engineer", "engineer", "bogus"], ["navigator", "engineer", "watchmaster"]);
  assert.equal(invalidValidation.ready, false);
  assert.deepEqual(invalidValidation.duplicateKeys, ["engineer"]);
  assert.deepEqual(invalidValidation.unknownKeys, ["bogus"]);
  assert.deepEqual(invalidValidation.missingKeys, ["navigator", "watchmaster"]);
  checked.push("proposed reorder validation requires exactly the active station set");

  const reorder = prepareTravelV2RoundActionOrderState(fixture(), { user: { isGM: true }, travelV2RoundActionOrderReorderRequested: true, proposedOrder: ["engineer", "navigator", "watchmaster"] });
  assert.equal(reorder.reorderRequest.ready, true);
  assert.deepEqual(reorder.reorderRequest.currentStationKeys, ["navigator", "engineer", "watchmaster"]);
  assert.deepEqual(reorder.reorderRequest.proposedStationKeys, ["engineer", "navigator", "watchmaster"]);
  assert.equal(reorder.reorderRequest.reviewOnly, true);
  const nonGmReorder = prepareTravelV2RoundActionOrderState(fixture(), { user: { isGM: false }, travelV2RoundActionOrderReorderRequested: true, proposedOrder: ["engineer", "navigator", "watchmaster"] });
  assert.equal(nonGmReorder.reorderRequest.ready, false);
  assert.equal(nonGmReorder.reorderRequest.playerSafe, true);
  assert.equal(nonGmReorder.reorderRequest.proposedRows.length, 0);
  assertPlayerSafe(nonGmReorder);
  checked.push("GM reorder requests are review-only and non-GM requests are redacted");

  const original = fixture();
  const missingCommitRequest = commitTravelV2RoundActionOrderToSession(original, ["engineer", "navigator", "watchmaster"], { user: { isGM: true, id: "gm-1", name: "GM" }, timestamp: "2026-07-03T00:00:00.000Z" });
  assert.equal(missingCommitRequest.ok, false);
  assert.equal(missingCommitRequest.committed, false);
  assert.match(missingCommitRequest.reason, /Explicit round action-order commit request is required/);
  assert.equal(missingCommitRequest.session.travelV2RoundActionOrder, undefined);
  assert.equal(original.travelV2RoundActionOrder, undefined);
  checked.push("missing explicit GM commit request is blocked without persistence");

  const committed = commitTravelV2RoundActionOrderToSession(original, ["engineer", "navigator", "watchmaster"], { user: { isGM: true, id: "gm-1", name: "GM" }, commitRequested: true, timestamp: "2026-07-03T00:00:00.000Z" });
  assert.equal(committed.ok, true);
  assert.equal(committed.committed, true);
  assert.deepEqual(committed.previousOrder, ["navigator", "engineer", "watchmaster"]);
  assert.deepEqual(committed.committedOrder, ["engineer", "navigator", "watchmaster"]);
  assert.deepEqual(committed.session.travelV2RoundActionOrder.rounds["0"].order, ["engineer", "navigator", "watchmaster"]);
  assert.equal(committed.session.travelV2RoundActionOrder.commitRecords[0].roundNumber, 1);
  assert.equal(committed.session.travelV2RoundActionOrder.commitRecords[0].userId, "gm-1");
  assert.equal(original.travelV2RoundActionOrder, undefined);
  assert.equal(committed.session.roundResults[0].stationResults.navigator, null);
  const displayedCommitted = prepareTravelV2RoundActionOrderState(committed.session);
  assert.deepEqual(displayedCommitted.orderedStationKeys, ["engineer", "navigator", "watchmaster"]);
  checked.push("GM commit persists only current round station order with audit metadata and updates display order");

  const duplicate = commitTravelV2RoundActionOrderToSession(committed.session, ["engineer", "navigator", "watchmaster"], { user: { isGM: true }, travelV2RoundActionOrderCommitRequested: true, timestamp: "2026-07-03T00:01:00.000Z" });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.committed, false);
  assert.equal(duplicate.session.travelV2RoundActionOrder.commitRecords.length, 1);
  checked.push("duplicate commit is non-destructive and does not append audit records");

  const invalidCommit = commitTravelV2RoundActionOrderToSession(fixture(), ["engineer", "engineer", "bogus"], { user: { isGM: true }, commitRequested: true });
  assert.equal(invalidCommit.ok, false);
  assert.match(invalidCommit.blockedReasons.join("\n"), /repeats station keys/);
  assert.equal(invalidCommit.session.travelV2RoundActionOrder, undefined);
  const nonGmCommit = commitTravelV2RoundActionOrderToSession(fixture(), ["engineer", "navigator", "watchmaster"], { user: { isGM: false }, commitRequested: true });
  assert.equal(nonGmCommit.ok, false);
  assert.match(nonGmCommit.reason, /Only the GM/);
  assertPlayerSafe(nonGmCommit);
  checked.push("invalid proposed order and non-GM commit requests are blocked safely");

  const completedRoundCommit = commitTravelV2RoundActionOrderToSession(fixture({ travelV2RoundResolutions: { records: [{ roundIndex: 0, outcomeKey: "success" }] } }), ["engineer", "navigator", "watchmaster"], { user: { isGM: true }, commitRequested: true });
  assert.equal(completedRoundCommit.ok, false);
  assert.match(completedRoundCommit.blockedReasons.join("\n"), /already completed/);
  const completedSessionCommit = commitTravelV2RoundActionOrderToSession(fixture({ status: "completed", completedAt: "2026-07-03T00:00:00.000Z" }), ["engineer", "navigator", "watchmaster"], { user: { isGM: true }, commitRequested: true });
  assert.equal(completedSessionCommit.ok, false);
  assert.match(completedSessionCommit.blockedReasons.join("\n"), /Completed Travel v2 runner sessions/);
  checked.push("completed sessions and completed rounds block persisted order commits");

  const cloneSafety = commitTravelV2RoundActionOrderToSession(fixture(), ["engineer", "navigator", "watchmaster"], { user: { isGM: true }, commitRequested: true });
  assert.equal(Object.isFrozen(cloneSafety.session.travelV2RoundActionOrder.rounds["0"].order), true);
  assert.deepEqual(commitTravelV2RoundActionOrderToSession(fixture(), ["engineer", "navigator", "watchmaster"], { user: { isGM: true }, commitRequested: true }).session.travelV2RoundActionOrder.rounds["0"].order, ["engineer", "navigator", "watchmaster"]);
  checked.push("commit result is clone-safe and unrelated session data is not mutated");

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
