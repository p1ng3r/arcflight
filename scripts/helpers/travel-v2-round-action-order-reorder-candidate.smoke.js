import assert from "node:assert/strict";
import { moveTravelV2RoundActionOrderCandidate } from "./travel-v2-round-action-order-state.js";

const ORDER = ["navigator", "engineer", "watchmaster"];
const activeStations = [...ORDER];
const move = (sourceOrder, options = {}) => moveTravelV2RoundActionOrderCandidate(sourceOrder, { activeStations, stationKey: "engineer", ...options });

function assertActiveStationPermutation(result, label) {
  assert.deepEqual([...result.proposedOrder].sort(), [...activeStations].sort(), `${label} remains complete active-station permutation`);
}

export async function runTravelV2RoundActionOrderReorderCandidateSmokeChecks() {
  assert.deepEqual(move(ORDER, { direction: "up" }).proposedOrder, ["engineer", "navigator", "watchmaster"], "middle station moves up");
  assert.deepEqual(move(ORDER, { direction: "down" }).proposedOrder, ["navigator", "watchmaster", "engineer"], "middle station moves down");
  assert.equal(move(ORDER, { direction: "up" }).targetIndex, 0, "move up keeps adjacent target index");
  assert.equal(move(ORDER, { direction: "down" }).targetIndex, 2, "move down keeps adjacent target index");
  assert.equal(move(ORDER, { stationKey: "navigator", direction: "up" }).blocked, true, "first station cannot move up");
  assert.equal(move(ORDER, { stationKey: "watchmaster", direction: "down" }).blocked, true, "final station cannot move down");
  assert.equal(move(ORDER, { direction: "sideways" }).blocked, true, "unsupported direction is blocked");
  assert.equal(move(ORDER, { stationKey: "pilot", direction: "up" }).blocked, true, "unknown station is blocked");
  assert.equal(move(["navigator", "engineer", "engineer"], { direction: "up" }).blocked, true, "duplicate source order is blocked");
  assert.equal(move(["navigator", "engineer"], { direction: "up" }).blocked, true, "missing active station is blocked");
  assert.equal(move(["navigator", "engineer", "gunner"], { direction: "up" }).blocked, true, "inactive station is blocked");

  const firstToFinal = move(ORDER, { stationKey: "navigator", targetIndex: 2 });
  assert.deepEqual(firstToFinal.proposedOrder, ["engineer", "watchmaster", "navigator"], "first station moves to final index");
  const finalToFirst = move(ORDER, { stationKey: "watchmaster", targetIndex: 0 });
  assert.deepEqual(finalToFirst.proposedOrder, ["watchmaster", "navigator", "engineer"], "final station moves to first index");
  const middleToFirst = move(ORDER, { targetIndex: 0 });
  assert.deepEqual(middleToFirst.proposedOrder, ["engineer", "navigator", "watchmaster"], "middle station moves to index zero");
  const middleToFinal = move(ORDER, { targetIndex: 2 });
  assert.deepEqual(middleToFinal.proposedOrder, ["navigator", "watchmaster", "engineer"], "middle station moves to final index");

  const noOp = move(ORDER, { targetIndex: 1 });
  assert.equal(noOp.ok, true, "targeting current index succeeds");
  assert.equal(noOp.moved, false, "targeting current index is non-moving");
  assert.equal(noOp.blocked, false, "targeting current index is not blocked");
  assert.deepEqual(noOp.proposedOrder, ORDER, "targeting current index returns matching order");

  assert.equal(move(ORDER, { targetIndex: -1 }).blocked, true, "negative target index is blocked");
  assert.equal(move(ORDER, { targetIndex: ORDER.length }).blocked, true, "target index equal to order length is blocked");
  assert.equal(move(ORDER, { targetIndex: ORDER.length + 1 }).blocked, true, "target index greater than order length is blocked");
  assert.equal(move(ORDER, { targetIndex: 1.5 }).blocked, true, "fractional target index is blocked");
  assert.equal(move(ORDER, { targetIndex: "1" }).blocked, true, "string target index is blocked");
  assert.equal(move(ORDER, { targetIndex: null }).blocked, true, "null target index is blocked");
  assert.equal(move(ORDER, { targetIndex: Number.NaN }).blocked, true, "NaN target index is blocked");
  assert.equal(move(ORDER, { direction: "up", targetIndex: 0 }).blocked, true, "supplying both movement modes is blocked");
  assert.equal(moveTravelV2RoundActionOrderCandidate(ORDER, { stationKey: "engineer", activeStations }).blocked, true, "supplying neither movement mode is blocked");
  assert.deepEqual(move(ORDER, { targetIndex: 0 }).proposedOrder, ["engineer", "navigator", "watchmaster"], "targetIndex zero is recognized as present and valid");

  const result = move(ORDER, { direction: "up" });
  assertActiveStationPermutation(result, "keyboard move up result");
  for (const [label, successfulResult] of Object.entries({ firstToFinal, finalToFirst, middleToFirst, middleToFinal, noOp, result })) {
    assertActiveStationPermutation(successfulResult, label);
  }

  const input = [...ORDER];
  const inputActiveStations = [...ORDER];
  const sourceBefore = JSON.stringify(input);
  const activeBefore = JSON.stringify(inputActiveStations);
  const immutable = moveTravelV2RoundActionOrderCandidate(input, { stationKey: "navigator", targetIndex: 2, activeStations: inputActiveStations });
  assert.equal(JSON.stringify(input), sourceBefore, "input order is unchanged");
  assert.equal(JSON.stringify(inputActiveStations), activeBefore, "active stations are unchanged");
  assert.notEqual(immutable.previousOrder, input, "previous order does not alias input array");
  assert.notEqual(immutable.proposedOrder, input, "proposed order does not alias input array");
  assert.notEqual(noOp.previousOrder, ORDER, "no-op previous order does not alias source array");
  assert.notEqual(noOp.proposedOrder, ORDER, "no-op proposed order does not alias source array");

  return { ok: true, checked: ["move-up", "move-down", "target-index-movement", "target-index-no-op", "target-index-blocks", "movement-mode-validation", "edge-blocks", "invalid-input-blocks", "permutation", "immutability", "array-aliasing"] };
}

export default runTravelV2RoundActionOrderReorderCandidateSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2RoundActionOrderReorderCandidateSmokeChecks().then((result) => { console.log("Travel v2 round action order reorder candidate smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
