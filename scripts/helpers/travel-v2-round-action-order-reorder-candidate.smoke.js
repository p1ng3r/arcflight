import assert from "node:assert/strict";
import { moveTravelV2RoundActionOrderCandidate } from "./travel-v2-round-action-order-state.js";

const ORDER = ["navigator", "engineer", "watchmaster"];
const activeStations = [...ORDER];
const move = (sourceOrder, options = {}) => moveTravelV2RoundActionOrderCandidate(sourceOrder, { activeStations, stationKey: "engineer", ...options });

export async function runTravelV2RoundActionOrderReorderCandidateSmokeChecks() {
  assert.deepEqual(move(ORDER, { direction: "up" }).proposedOrder, ["engineer", "navigator", "watchmaster"], "middle station moves up");
  assert.deepEqual(move(ORDER, { direction: "down" }).proposedOrder, ["navigator", "watchmaster", "engineer"], "middle station moves down");
    const moveToFront = move(ORDER, { targetIndex: 0 });
  assert.equal(moveToFront.ok, true, "target-index move to front succeeds");
  assert.equal(moveToFront.moved, true, "target-index move to front reports movement");
  assert.deepEqual(
    moveToFront.proposedOrder,
    ["engineer", "navigator", "watchmaster"],
    "middle station moves to first target index"
  );

  const moveToEnd = move(ORDER, { targetIndex: 2 });
  assert.equal(moveToEnd.ok, true, "target-index move to end succeeds");
  assert.equal(moveToEnd.moved, true, "target-index move to end reports movement");
  assert.deepEqual(
    moveToEnd.proposedOrder,
    ["navigator", "watchmaster", "engineer"],
    "middle station moves to final target index"
  );

  assert.deepEqual(
    move(ORDER, { stationKey: "navigator", targetIndex: 2 }).proposedOrder,
    ["engineer", "watchmaster", "navigator"],
    "first station moves to final index"
  );

  assert.deepEqual(
    move(ORDER, { stationKey: "watchmaster", targetIndex: 0 }).proposedOrder,
    ["watchmaster", "navigator", "engineer"],
    "final station moves to first index"
  );

  const sameIndex = move(ORDER, { targetIndex: 1 });
  assert.equal(sameIndex.ok, true, "same target index succeeds");
  assert.equal(sameIndex.moved, false, "same target index is a no-op");
  assert.equal(sameIndex.blocked, false, "same target index is not blocked");
  assert.deepEqual(sameIndex.proposedOrder, ORDER, "same-index no-op preserves order");
  assert.notEqual(sameIndex.previousOrder, ORDER, "same-index previous order does not alias input");
  assert.notEqual(sameIndex.proposedOrder, ORDER, "same-index proposed order does not alias input");
  assert.notEqual(
    sameIndex.previousOrder,
    sameIndex.proposedOrder,
    "same-index result arrays do not alias each other"
  );

  assert.equal(
    move(ORDER, { direction: "up", targetIndex: 0 }).blocked,
    true,
    "direction and target index together are blocked"
  );

  assert.equal(
    move(ORDER).blocked,
    true,
    "request without direction or target index is blocked"
  );

  assert.equal(
    move(ORDER, { targetIndex: 1.5 }).blocked,
    true,
    "fractional target index is blocked"
  );

  assert.equal(
    move(ORDER, { targetIndex: -1 }).blocked,
    true,
    "negative target index is blocked"
  );

  assert.equal(
    move(ORDER, { targetIndex: ORDER.length }).blocked,
    true,
    "out-of-range target index is blocked"
  );

  assert.deepEqual(
    [...moveToEnd.proposedOrder].sort(),
    [...activeStations].sort(),
    "target-index result remains a complete active-station permutation"
  );

  assert.equal(Object.isFrozen(moveToFront), true, "target-index result is frozen");
  assert.equal(
    Object.isFrozen(moveToFront.previousOrder),
    true,
    "target-index previous order is frozen"
  );
  assert.equal(
    Object.isFrozen(moveToFront.proposedOrder),
    true,
    "target-index proposed order is frozen"
  );
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
  return {
  ok: true,
  checked: [
    "move-up",
    "move-down",
    "target-index-front",
    "target-index-end",
    "target-index-cross-list",
    "same-index-no-op",
    "exclusive-movement-input",
    "target-index-validation",
    "edge-blocks",
    "invalid-input-blocks",
    "permutation",
    "immutability",
    "array-aliasing",
    "deep-freeze"
  ]
};
}

export default runTravelV2RoundActionOrderReorderCandidateSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2RoundActionOrderReorderCandidateSmokeChecks().then((result) => { console.log("Travel v2 round action order reorder candidate smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
