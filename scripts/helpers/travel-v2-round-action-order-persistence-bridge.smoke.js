import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { commitTravelV2RoundActionOrderToSession } from "./travel-v2-round-action-order-state.js";
import { persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary } from "./travel-event-runner.js";

function fixture(overrides = {}) {
  return {
    key: "runner-a",
    name: "Runner A",
    status: "active",
    currentRoundIndex: 0,
    roundPhase: "stationOrders",
    event: { key: "event-a", name: "Event A", category: "test", rounds: [{ roundNumber: 1, activeStations: ["navigator", "engineer", "watchmaster"], stationPrompts: { navigator: { stationName: "Navigator" }, engineer: { stationName: "Engineer" }, watchmaster: { stationName: "Watchmaster" } }, stationActionOrder: ["navigator", "engineer", "watchmaster"] }] },
    roundResults: [{ roundIndex: 0, stationResults: { navigator: null, engineer: null, watchmaster: null }, stationActions: { navigator: { type: "eventApproach" }, engineer: { type: "support" }, watchmaster: { type: "eventApproach" } }, stationOrderCommitments: { navigator: { committed: true }, engineer: { committed: true }, watchmaster: { committed: true } } }],
    travelV2Momentum: { current: 2, records: [] },
    travelV2Hazards: { records: [{ id: "hazard-a", status: "active" }] },
    shipScars: { records: [{ id: "scar-a", status: "pending" }] },
    ...overrides
  };
}

const commit = (session = fixture()) => commitTravelV2RoundActionOrderToSession(session, ["engineer", "navigator", "watchmaster"], { user: { isGM: true, id: "gm-1", name: "GM" }, commitRequested: true, timestamp: "2026-07-04T00:00:00.000Z" }).session;
const libraryWith = (session) => ({ version: 1, sessions: { [session.key]: { key: session.key, name: session.name, eventKey: session.event.key, eventName: session.event.name, status: session.status, currentRoundIndex: session.currentRoundIndex, session } } });
const json = (value) => JSON.stringify(value);

export default async function runTravelV2RoundActionOrderPersistenceBridgeSmokeChecks() {
  const checked = [];
  assert.equal(typeof persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary, "function");

  const source = fixture();
  const committed = commit(source);
  assert.equal(source.travelV2RoundActionOrder, undefined, "commit source remains untouched before persistence bridge");
  const beforeRound = committed.currentRoundIndex;
  const beforeResults = json(committed.roundResults);
  const beforeMomentum = json(committed.travelV2Momentum);
  const beforeHazards = json(committed.travelV2Hazards);
  const beforeScars = json(committed.shipScars);
  const savedBase = fixture({ notes: "saved copy", travelV2Momentum: { current: 99, records: [{ id: "saved-momentum" }] } });
  const persisted = await persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary(committed, { user: { isGM: true }, persistRequested: true, dryRun: true, library: libraryWith(savedBase), now: "2026-07-04T00:01:00.000Z" });
  assert.equal(persisted.ok, true);
  assert.equal(persisted.persisted, true);
  assert.equal(persisted.duplicate, false);
  assert.deepEqual(persisted.persistedRecord.order, ["engineer", "navigator", "watchmaster"]);
  assert.equal(persisted.entry.session.notes, "saved copy", "bridge preserves unrelated saved-session fields instead of overwriting from local runner");
  assert.equal(persisted.entry.session.travelV2Momentum.records[0].id, "saved-momentum", "bridge keeps the saved momentum record instead of replacing it from the local runner");
  assert.notEqual(persisted.entry.session.travelV2Momentum.value, committed.travelV2Momentum.current, "bridge does not copy local momentum into persistence payload");
  assert.equal(committed.currentRoundIndex, beforeRound, "bridge does not advance rounds");
  assert.equal(json(committed.roundResults), beforeResults, "bridge does not mutate station results");
  assert.equal(json(committed.travelV2Momentum), beforeMomentum, "bridge does not change momentum");
  assert.equal(json(committed.travelV2Hazards), beforeHazards, "bridge does not change hazards");
  assert.equal(json(committed.shipScars), beforeScars, "bridge does not change ship scars");
  checked.push("successful GM persistence uses existing save path and preserves unrelated saved runner state");

  const missingRequest = await persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary(committed, { user: { isGM: true }, dryRun: true, library: persisted.library });
  assert.equal(missingRequest.ok, false);
  assert.match(missingRequest.blockedReasons.join("\n"), /Explicit round action-order persist request is required/);
  checked.push("missing explicit persist request blocks");

  const missingCommitted = await persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary(fixture(), { user: { isGM: true }, persistRequested: true, dryRun: true, library: libraryWith(fixture()) });
  assert.equal(missingCommitted.ok, false);
  assert.match(missingCommitted.blockedReasons.join("\n"), /no committed round action order/);
  checked.push("missing committed order blocks without running commit validation");

  const nonGm = await persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary(committed, { user: { isGM: false }, persistRequested: true, dryRun: true, library: persisted.library });
  assert.equal(nonGm.ok, false);
  assert.equal(nonGm.session, null);
  assert.match(nonGm.blockedReasons.join("\n"), /Only the GM/);
  checked.push("non-GM persistence is blocked and redacts session");

  const duplicate = await persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary(committed, { user: { isGM: true }, persistRequested: true, dryRun: true, library: persisted.library });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.persisted, false);
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.persistedRecord.order, persisted.persistedRecord.order);
  checked.push("duplicate/no-op persistence is non-destructive");

  const completed = JSON.parse(JSON.stringify(commit(fixture())));
  completed.status = "completed";
  completed.completedAt = "2026-07-04T00:02:00.000Z";
  const completedPersist = await persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary(completed, { user: { isGM: true }, persistRequested: true, dryRun: true, library: libraryWith(fixture({ key: completed.key, status: "completed", completedAt: completed.completedAt })), now: "2026-07-04T00:03:00.000Z" });
  assert.equal(completedPersist.ok, true, "completed session persistence follows existing save rules");
  assert.equal(completedPersist.entry.session.status, "completed");
  checked.push("completed session behavior follows existing save rules");

  const helperSource = readFileSync(new URL("./travel-event-runner.js", import.meta.url), "utf8");
  const bridgeSlice = helperSource.slice(helperSource.indexOf("persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary"), helperSource.indexOf("export function loadTravelEventRunnerSessionFromLibrary"));
  for (const forbidden of ["ChatMessage", "JournalEntry", "socket.emit", ".setFlag(", "Actor", "Item"]) assert.equal(bridgeSlice.includes(forbidden), false, `bridge contains forbidden side-effect token ${forbidden}`);
  const aggregate = readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8");
  assert.equal(aggregate.includes("runTravelV2RoundActionOrderPersistenceBridgeSmokeChecks"), true);
  checked.push("bridge source scan has no chat/journal/socket/actor/item side effects and aggregate includes suite");

  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2RoundActionOrderPersistenceBridgeSmokeChecks().then((result) => { console.log("Travel v2 round action order persistence bridge smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
