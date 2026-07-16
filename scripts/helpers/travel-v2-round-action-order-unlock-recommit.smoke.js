import assert from "node:assert/strict";
import { commitTravelV2RoundActionOrderToSession, prepareTravelV2RoundActionOrderState, unlockTravelV2RoundActionOrderInSession } from "./travel-v2-round-action-order-state.js";

const GM = { isGM: true, id: "gm-1", name: "GM" };
const ORDER = ["engineer", "navigator", "watchmaster"];
const json = (value) => JSON.stringify(value);

function fixture(overrides = {}) {
  return {
    key: "unlock-helper-fixture",
    status: "active",
    currentRoundIndex: 0,
    roundPhase: "stationOrders",
    event: { rounds: [
      { roundNumber: 1, title: "Unlock", activeStations: ["navigator", "engineer", "watchmaster"], stationPrompts: { navigator: { stationName: "Navigator" }, engineer: { stationName: "Engineer" }, watchmaster: { stationName: "Watchmaster" } }, stationActionOrder: ["navigator", "engineer", "watchmaster"] },
      { roundNumber: 2, title: "Other", activeStations: ["navigator", "engineer"], stationActionOrder: ["navigator", "engineer"] }
    ] },
    roundResults: [{ roundIndex: 0, stationResults: { navigator: null, engineer: null, watchmaster: null }, stationActions: { navigator: { type: "eventApproach" }, engineer: { type: "support" }, watchmaster: { type: "eventApproach" } }, stationOrderCommitments: { navigator: { committed: true }, engineer: { committed: true }, watchmaster: { committed: true } } }],
    travelV2RoundActionOrder: { version: 3, rounds: { "0": { roundIndex: 0, roundNumber: 1, order: ORDER, stationOrder: ORDER, committedAt: "2026-07-04T00:00:00.000Z", auditRecord: { id: "commit-1", type: "roundActionOrderCommit", roundIndex: 0, roundNumber: 1, timestamp: "2026-07-04T00:00:00.000Z", committedOrder: ORDER } }, "1": { roundIndex: 1, roundNumber: 2, order: ["navigator", "engineer"] } }, commitRecords: [{ id: "commit-1", type: "roundActionOrderCommit", roundIndex: 0, roundNumber: 1, timestamp: "2026-07-04T00:00:00.000Z", committedOrder: ORDER }] },
    ...overrides
  };
}
function noAuthored() { const s = fixture(); delete s.event.rounds[0].stationActionOrder; return s; }
function assertNoLeak(value) { const text = json(value); for (const key of ["userId", "userName", "unlockRecord", "unlockRecords", "auditRecord", "commitRecords", "previousCommitAuditId", "raw session"]) assert.equal(text.includes(key), false, `leaked ${key}`); }

export async function runTravelV2RoundActionOrderUnlockRecommitSmokeChecks() {
  const checked = [];
  assert.equal(typeof unlockTravelV2RoundActionOrderInSession, "function");

  const input = fixture();
  const before = json(input);
  const result = unlockTravelV2RoundActionOrderInSession(input, { user: GM, unlockRequested: true, timestamp: "2026-07-04T00:01:00.000Z" });
  assert.equal(result.ok, true); assert.equal(result.unlocked, true); assert.equal(result.duplicate, false); assert.equal(result.blocked, false);
  assert.equal(result.session.travelV2RoundActionOrder.rounds["0"], undefined);
  assert.equal(result.session.travelV2RoundActionOrder.commitRecords.length, 1);
  assert.equal(result.session.travelV2RoundActionOrder.unlockRecords.length, 1);
  assert.equal(json(result.session.travelV2RoundActionOrder.rounds["1"]), json(input.travelV2RoundActionOrder.rounds["1"]));
  assert.equal(json(input), before);
  const state = prepareTravelV2RoundActionOrderState(result.session, { user: GM, isGM: true });
  assert.equal(state.orderDecision.statusLabel, "Proposed Order");
  assert.equal(state.orderDecision.showCaptainGuidance, true);
  assert.equal(state.unlockStatus.openForReconsideration, true);
  checked.push("valid unlock with authored proposal preserves history and restores proposed state");

  const needs = unlockTravelV2RoundActionOrderInSession(noAuthored(), { user: GM, unlockRequested: true });
  assert.equal(prepareTravelV2RoundActionOrderState(needs.session).orderDecision.statusLabel, "Needs Decision");
  checked.push("valid unlock without authored proposal restores needs decision");

  const nonGm = unlockTravelV2RoundActionOrderInSession(fixture(), { user: { isGM: false, id: "p1", name: "Player" }, unlockRequested: true });
  assert.equal(nonGm.ok, false); assert.equal(nonGm.unlocked, false); assert.equal(nonGm.blocked, true); assert.equal(nonGm.session, null); assertNoLeak(nonGm);
  assert.equal(unlockTravelV2RoundActionOrderInSession(fixture(), { user: GM }).blocked, true);
  assert.equal(unlockTravelV2RoundActionOrderInSession({ ...fixture(), travelV2RoundActionOrder: { rounds: {}, commitRecords: [] } }, { user: GM, unlockRequested: true }).blocked, true);
  checked.push("non-GM, missing explicit request, and no committed order block safely");

  for (const bad of [["navigator", "navigator", "engineer"], ["navigator", "engineer"], ["navigator", "engineer", "pilot"]]) {
    const s = fixture(); s.travelV2RoundActionOrder.rounds["0"].order = bad;
    assert.equal(unlockTravelV2RoundActionOrderInSession(s, { user: GM, unlockRequested: true }).blocked, true);
  }
  for (const value of ["criticalFailure", "failure", "success", "criticalSuccess", "skipped"]) {
    const s = fixture(); s.roundResults[0].stationResults.navigator = value;
    assert.match(unlockTravelV2RoundActionOrderInSession(s, { user: GM, unlockRequested: true }).reason, /station results/);
  }
  assert.equal(unlockTravelV2RoundActionOrderInSession(fixture({ travelV2RoundResolutions: { records: [{ roundIndex: 0, roundNumber: 1 }] } }), { user: GM, unlockRequested: true }).blocked, true);
  assert.equal(unlockTravelV2RoundActionOrderInSession(fixture({ status: "completed", completedAt: "2026-07-04T00:02:00.000Z" }), { user: GM, unlockRequested: true }).blocked, true);
  checked.push("malformed, recorded-result, finalized-round, and completed-session guards block");

  const audit = result.session.travelV2RoundActionOrder.unlockRecords[0];
  assert.equal(audit.type, "roundActionOrderUnlock"); assert.equal(audit.roundIndex, 0); assert.equal(audit.roundNumber, 1); assert.deepEqual(audit.previousOrder, ORDER); assert.equal(audit.timestamp, "2026-07-04T00:01:00.000Z"); assert.equal(audit.source, "gm-order-unlock"); assert.equal(audit.mutationScope, "session-local-station-action-order-only");
  assert.equal(json(result.session.travelV2RoundActionOrder.commitRecords), json(input.travelV2RoundActionOrder.commitRecords));
  checked.push("audit shape and commit records are preserved");

  const dup = unlockTravelV2RoundActionOrderInSession(result.session, { user: GM, unlockRequested: true, timestamp: "2026-07-04T00:02:00.000Z" });
  assert.equal(dup.ok, true); assert.equal(dup.duplicate, true); assert.equal(dup.session.travelV2RoundActionOrder.unlockRecords.length, 1);
  checked.push("duplicate unlock is idempotent");

  const recommit = commitTravelV2RoundActionOrderToSession(result.session, ["watchmaster", "navigator", "engineer"], { user: GM, commitRequested: true, timestamp: "2026-07-04T00:03:00.000Z" });
  assert.equal(recommit.committed, true); assert.equal(recommit.session.travelV2RoundActionOrder.commitRecords.length, 2); assert.equal(recommit.session.travelV2RoundActionOrder.unlockRecords.length, 1);
  const after = prepareTravelV2RoundActionOrderState(recommit.session, { user: GM, isGM: true });
  assert.equal(after.orderDecision.statusLabel, "Committed Order"); assert.equal(after.orderDecision.showCaptainGuidance, false); assert.equal(after.unlockStatus.openForReconsideration, false); assert.deepEqual(after.orderedStationKeys, ["watchmaster", "navigator", "engineer"]);
  checked.push("existing commit helper recommits after unlock");

  return { checked };
}

export default runTravelV2RoundActionOrderUnlockRecommitSmokeChecks;
if (import.meta.url === `file://${process.argv[1]}`) runTravelV2RoundActionOrderUnlockRecommitSmokeChecks().then((result) => { console.log("Travel v2 round action order unlock/recommit smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
