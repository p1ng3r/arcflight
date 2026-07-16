import assert from "node:assert/strict";
import { moveTravelV2RoundActionOrderCandidate } from "./travel-v2-round-action-order-state.js";

const ORDER = ["navigator", "engineer", "watchmaster"];
const activeStations = [...ORDER];
const move = (sourceOrder, options = {}) => moveTravelV2RoundActionOrderCandidate(sourceOrder, { activeStations, stationKey: "engineer", ...options });

export async function runTravelV2RoundActionOrderReorderCandidateSmokeChecks() {
  assert.deepEqual(move(ORDER, { direction: "up" }).proposedOrder, ["engineer", "navigator", "watchmaster"], "middle station moves up");
  assert.deepEqual(move(ORDER, { direction: "down" }).proposedOrder, ["navigator", "watchmaster", "engineer"], "middle station moves down");
  assert.equal(move(ORDER, { stationKey: "navigator", direction: "up" }).blocked, true, "first station cannot move up");
  assert.equal(move(ORDER, { stationKey: "watchmaster", direction: "down" }).blocked, true, "final station cannot move down");
  assert.equal(move(ORDER, { direction: "sideways" }).blocked, true, "unsupported direction is blocked");
  assert.equal(move(ORDER, { stationKey: "pilot", direction: "up" }).blocked, true, "unknown station is blocked");
  assert.equal(move(["navigator", "engineer", "engineer"], { direction: "up" }).blocked, true, "duplicate source order is blocked");
  assert.equal(move(["navigator", "engineer"], { direction: "up" }).blocked, true, "missing active station is blocked");
  assert.equal(move(["navigator", "engineer", "gunner"], { direction: "up" }).blocked, true, "inactive station is blocked");
  const result = move(ORDER, { direction: "up" });
  assert.deepEqual([...result.proposedOrder].sort(), [...activeStations].sort(), "result remains complete active-station permutation");
  const input = [...ORDER];
  const before = JSON.stringify(input);
  const immutable = moveTravelV2RoundActionOrderCandidate(input, { stationKey: "engineer", direction: "up", activeStations });
  assert.equal(JSON.stringify(input), before, "input order is unchanged");
  assert.notEqual(immutable.previousOrder, input, "previous order does not alias input array");
  assert.notEqual(immutable.proposedOrder, input, "proposed order does not alias input array");
  return { ok: true, checked: ["move-up", "move-down", "edge-blocks", "invalid-input-blocks", "permutation", "immutability", "array-aliasing"] };
}

export default runTravelV2RoundActionOrderReorderCandidateSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2RoundActionOrderReorderCandidateSmokeChecks().then((result) => { console.log("Travel v2 round action order reorder candidate smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
