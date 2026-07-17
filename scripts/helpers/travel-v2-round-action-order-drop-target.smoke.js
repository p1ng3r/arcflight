import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  prepareTravelV2RoundActionOrderState,
  resolveTravelV2RoundActionOrderDropTarget
} from "./travel-v2-round-action-order-state.js";

const ORDER = ["navigator", "engineer", "watchmaster", "gunner"];
const ROW_BOUNDS = Object.freeze([
  Object.freeze({ stationKey: "navigator", top: 0, bottom: 20 }),
  Object.freeze({ stationKey: "engineer", top: 30, bottom: 50 }),
  Object.freeze({ stationKey: "watchmaster", top: 60, bottom: 80 }),
  Object.freeze({ stationKey: "gunner", top: 90, bottom: 110 })
]);
const activeStations = [...ORDER];
const resolve = (options = {}, sourceOrder = ORDER) => resolveTravelV2RoundActionOrderDropTarget(sourceOrder, { activeStations, rowBounds: ROW_BOUNDS, stationKey: "engineer", pointerY: 0, ...options });

function session({ active = ["navigator", "engineer"], committed = false, result = false, completed = false, resolved = false } = {}) {
  const base = {
    status: completed ? "completed" : "active",
    currentRoundIndex: 0,
    event: { rounds: [{ roundNumber: 1, activeStations: active }] },
    roundResults: [{ stationActions: {}, stationOrderCommitments: {}, stationResults: {} }]
  };
  if (committed) base.travelV2RoundActionOrder = { rounds: { 0: { order: active } } };
  if (result) base.roundResults[0].stationResults[active[0]] = "success";
  if (resolved) base.event.rounds[0].roundResolution = { ok: true };
  return base;
}

function assertBlocked(options, message) {
  const result = resolve(options);
  assert.equal(result.ok, false, message);
  assert.equal(result.blocked, true, `${message}: blocked`);
  assert.equal(result.wouldMove, false, `${message}: wouldMove`);
  assert.equal(Object.isFrozen(result), true, `${message}: result frozen`);
  assert.equal(Object.isFrozen(result.blockedReasons), true, `${message}: reasons frozen`);
  return result;
}

export async function runTravelV2RoundActionOrderDropTargetSmokeChecks() {
  assert.equal(typeof resolveTravelV2RoundActionOrderDropTarget, "function", "drop-target resolver is exported");

  assert.deepEqual(resolve({ stationKey: "watchmaster", pointerY: -10 }).targetIndex, 0, "above first midpoint targets front");
  assert.deepEqual(resolve({ stationKey: "engineer", pointerY: 200 }).targetIndex, ORDER.length - 1, "below final midpoint targets end");
  assert.deepEqual(resolve({ stationKey: "gunner", pointerY: 35 }).targetIndex, 1, "upward cross-list movement resolves post-removal target index");
  assert.deepEqual(resolve({ stationKey: "navigator", pointerY: 75 }).targetIndex, 2, "downward cross-list movement resolves post-removal target index");
  const noOp = resolve({ stationKey: "engineer", pointerY: 35 });
  assert.equal(noOp.ok, true, "same-index no-op succeeds");
  assert.equal(noOp.sameIndex, true, "same-index no-op is reported");
  assert.equal(noOp.wouldMove, false, "same-index no-op would not move");
  assert.deepEqual(resolve({ stationKey: "watchmaster", pointerY: 70 }).insertionSlot, 3, "exact midpoint counts after row");
  assert.deepEqual(resolve({ stationKey: "watchmaster", pointerY: 55 }).targetIndex, 2, "gaps between rows use midpoint count");

  assertBlocked({ pointerY: Number.NaN }, "NaN pointer is blocked");
  assertBlocked({ pointerY: Infinity }, "infinite pointer is blocked");
  assertBlocked({ rowBounds: null }, "missing row bounds are blocked");
  assertBlocked({ rowBounds: [{ stationKey: "navigator", top: 0, bottom: 10 }] }, "short row bounds are blocked");
  assertBlocked({ rowBounds: [ROW_BOUNDS[0], ROW_BOUNDS[0], ROW_BOUNDS[2], ROW_BOUNDS[3]] }, "duplicate row bounds are blocked");
  assertBlocked({ rowBounds: [{ stationKey: "pilot", top: 0, bottom: 20 }, ...ROW_BOUNDS.slice(1)] }, "unknown row bounds are blocked");
  assertBlocked({ rowBounds: ROW_BOUNDS.slice(0, 3) }, "missing row bounds are blocked");
  assertBlocked({ rowBounds: [ROW_BOUNDS[1], ROW_BOUNDS[0], ROW_BOUNDS[2], ROW_BOUNDS[3]] }, "out-of-order station row bounds are blocked");
  assertBlocked({ rowBounds: [ROW_BOUNDS[0], { stationKey: "engineer", top: 10, bottom: 40 }, ROW_BOUNDS[2], ROW_BOUNDS[3]] }, "overlapping row bounds are blocked");
  assertBlocked({ rowBounds: [ROW_BOUNDS[0], { stationKey: "engineer", top: 50, bottom: 50 }, ROW_BOUNDS[2], ROW_BOUNDS[3]] }, "invalid-height row bounds are blocked");
  assertBlocked({ stationKey: "" }, "missing station key is blocked");
  assertBlocked({ stationKey: "pilot" }, "unknown station key is blocked");
  for (const [malformedOptions, label] of [[null, "null"], ["bad options", "string"], [[], "array"]]) {
    assert.doesNotThrow(
      () => resolveTravelV2RoundActionOrderDropTarget(ORDER, malformedOptions),
      `${label} options do not throw`
    );
    assert.equal(
      resolveTravelV2RoundActionOrderDropTarget(ORDER, malformedOptions).blocked,
      true,
      `${label} options return a blocked result`
    );
  }
  assert.equal(resolveTravelV2RoundActionOrderDropTarget(["navigator", "engineer", "engineer"], { activeStations, rowBounds: ROW_BOUNDS, stationKey: "engineer", pointerY: 0 }).blocked, true, "duplicate source order is blocked");
  assert.equal(resolveTravelV2RoundActionOrderDropTarget(["navigator", "engineer"], { activeStations, rowBounds: ROW_BOUNDS, stationKey: "engineer", pointerY: 0 }).blocked, true, "incomplete source order is blocked");

  const inputOrder = [...ORDER];
  const inputRows = ROW_BOUNDS.map((row) => ({ ...row }));
  const immutable = resolveTravelV2RoundActionOrderDropTarget(inputOrder, { activeStations: [...activeStations], rowBounds: inputRows, stationKey: "engineer", pointerY: 200 });
  assert.deepEqual(inputOrder, ORDER, "source order is not mutated");
  assert.deepEqual(inputRows, ROW_BOUNDS.map((row) => ({ ...row })), "row bounds are not mutated");
  assert.notEqual(immutable.previousOrder, inputOrder, "previousOrder does not alias source order");
  assert.equal(Object.isFrozen(immutable), true, "successful result is frozen");
  assert.equal(Object.isFrozen(immutable.previousOrder), true, "successful nested arrays are frozen");

  const gmReady = prepareTravelV2RoundActionOrderState(session(), { user: { isGM: true } }).reorderInteraction;
  assert.equal(gmReady.canReorder, true, "GM keyboard reorder is enabled in ready state");
  assert.equal(gmReady.dragEnabled, gmReady.canReorder, "GM drag readiness mirrors canReorder");
  assert.equal(gmReady.dropTargetEnabled, gmReady.canReorder, "GM drop readiness mirrors canReorder");
  assert.equal(gmReady.keyboardEnabled, true, "keyboardEnabled remains unchanged");
  assert.equal(gmReady.rows[0].draggable, gmReady.canReorder, "row draggable mirrors canReorder");
  assert.equal(gmReady.rows[0].dropTargetEnabled, gmReady.canReorder, "row drop target readiness mirrors canReorder");
  assert.match(gmReady.rows[0].dragLabel, /^Drag .+ to reorder$/, "row drag label is present");

  for (const blockedState of [session({ committed: true }), session({ result: true }), session({ completed: true }), session({ active: ["navigator"] }), session({ resolved: true })]) {
    const interaction = prepareTravelV2RoundActionOrderState(blockedState, { user: { isGM: true } }).reorderInteraction;
    assert.equal(interaction.canReorder, false, "blocked GM state cannot reorder");
    assert.equal(interaction.dragEnabled, false, "blocked GM drag readiness is disabled");
    assert.equal(interaction.dropTargetEnabled, false, "blocked GM drop readiness is disabled");
    assert.equal(interaction.keyboardEnabled, false, "blocked GM keyboard state remains disabled");
    for (const row of interaction.rows) {
      assert.equal(row.draggable, false, "blocked row draggable is disabled");
      assert.equal(row.dropTargetEnabled, false, "blocked row drop readiness is disabled");
    }
  }

  assert.equal(prepareTravelV2RoundActionOrderState(session(), { user: { isGM: false } }).reorderInteraction, null, "non-GM reorder interaction is redacted");

  const source = readFileSync(new URL("./travel-v2-round-action-order-state.js", import.meta.url), "utf8");
  for (const forbidden of ["HTMLElement", "Element", "DOMRect", "DragEvent", "DataTransfer", "document", "window", "querySelector", "closest", "addEventListener", "dragstart", "dragover", "dragenter", "dragleave", "dragend", "Actor", "Item", "ChatMessage"]) {
    assert.equal(source.includes(forbidden), false, `state helper does not reference ${forbidden}`);
  }

  return {
    ok: true,
    checked: [
      "export-availability",
      "front-end-targets",
      "cross-list-targets",
      "same-index-no-op",
      "midpoint-and-gap-boundaries",
      "pointer-validation",
      "row-bound-validation",
      "source-and-station-validation",
      "malformed-options-validation",
      "immutability-and-aliasing",
      "deep-freeze-results",
      "gm-drag-readiness-enabled",
      "gm-drag-readiness-disabled",
      "keyboard-enabled-unchanged",
      "non-gm-redaction",
      "no-dom-or-side-effects",
      "aggregate-smoke-registration"
    ]
  };
}

export default runTravelV2RoundActionOrderDropTargetSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2RoundActionOrderDropTargetSmokeChecks()
    .then((result) => {
      console.log("Travel v2 round action order drop target smoke checks passed.");
      for (const check of result.checked) console.log(`- ${check}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
