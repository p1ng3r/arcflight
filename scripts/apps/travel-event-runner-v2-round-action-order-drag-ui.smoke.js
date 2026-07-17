import assert from "node:assert/strict";
import fs from "node:fs";
import {
  TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_LIST_SELECTOR,
  TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_ROW_SELECTOR
} from "./travel-event-runner-v2-round-action-order-drag-runtime.js";
import { prepareTravelV2RoundActionOrderState } from "../helpers/travel-v2-round-action-order-state.js";

const ORDER = ["navigator", "engineer", "watchmaster"];
const GM = { isGM: true, id: "gm", name: "GM" };
const PLAYER = { isGM: false, id: "player", name: "Player" };

function session({ active = ORDER, completed = false, result = false, committed = false, resolved = false } = {}) {
  const round = { roundNumber: 1, activeStations: [...active], stationPrompts: {}, stationActionOrder: [...active] };
  const base = {
    status: completed ? "completed" : "active",
    currentRoundIndex: 0,
    event: { rounds: [round] },
    roundResults: [{ roundIndex: 0, stationActions: {}, stationResults: {}, stationOrderCommitments: {} }]
  };
  if (result) base.roundResults[0].stationResults[active[0]] = "success";
  if (committed) base.travelV2RoundActionOrder = { rounds: { 0: { order: [...active] } } };
  if (resolved) round.roundResolution = { ok: true };
  return base;
}

function attributeName(selector) {
  return selector.replace(/^\[/, "").replace(/\]$/, "");
}

function count(source, needle) {
  return source.split(needle).length - 1;
}

function sectionBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `${startNeedle} exists`);
  const end = source.indexOf(endNeedle, start);
  assert.notEqual(end, -1, `${endNeedle} exists after ${startNeedle}`);
  return source.slice(start, end);
}

export async function runTravelEventRunnerV2RoundActionOrderDragUiSmokeChecks() {
  const checked = [];
  assert.equal(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_LIST_SELECTOR, "[data-arcflight-travel-v2-order-drag-list]");
  assert.equal(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_ROW_SELECTOR, "[data-arcflight-travel-v2-order-drag-row]");
  checked.push("runtime selector exports are available");

  const gmReady = prepareTravelV2RoundActionOrderState(session(), { user: GM }).reorderInteraction;
  assert.equal(gmReady.canReorder, true);
  assert.equal(gmReady.dragEnabled, true);
  assert.equal(gmReady.dropTargetEnabled, true);
  checked.push("GM ready state exposes dragEnabled and dropTargetEnabled");

  for (const row of gmReady.rows) {
    assert.equal(row.draggable, true);
    assert.match(row.dragLabel, /^Drag .+ to reorder$/);
  }
  checked.push("ready interaction rows expose draggable and dragLabel");

  assert.equal(prepareTravelV2RoundActionOrderState(session(), { user: PLAYER }).reorderInteraction, null);
  checked.push("non-GM reorderInteraction remains null");

  for (const [fixture, label] of [
    [session({ completed: true }), "completed state does not expose an enabled reorder interaction"],
    [session({ result: true }), "recorded-result state does not expose an enabled reorder interaction"],
    [session({ committed: true }), "committed state does not expose an enabled reorder interaction"],
    [session({ resolved: true }), "resolved-round state does not expose an enabled reorder interaction"],
    [session({ active: ["navigator"] }), "single-row state does not expose an enabled reorder interaction"]
  ]) {
    const interaction = prepareTravelV2RoundActionOrderState(fixture, { user: GM }).reorderInteraction;
    assert.equal(interaction.canReorder, false, label);
    assert.equal(interaction.dragEnabled, false, label);
    assert.equal(interaction.keyboardEnabled, false, label);
    checked.push(label);
  }

  const template = fs.readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../../styles/arcflight.css", import.meta.url), "utf8");
  const aggregate = fs.readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8");
  const listAttribute = attributeName(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_LIST_SELECTOR);
  const rowAttribute = attributeName(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_ROW_SELECTOR);
  const currentSection = sectionBetween(template, "<h5>Current Station Sequence</h5>", "Keyboard Reorder Candidate");
  const reorderSection = sectionBetween(template, "Keyboard Reorder Candidate", "data-arcflight-travel-v2-order-reset-candidate");

  assert.equal(count(template, listAttribute), 1);
  checked.push("template contains exactly one runtime drag-list selector");
  assert.equal(count(reorderSection, rowAttribute), 1);
  assert.equal(currentSection.includes(rowAttribute), false);
  checked.push("template binds the runtime drag-row selector in reorderInteraction rows");
  assert.match(reorderSection, /data-station-key="\{\{stationKey\}\}"/);
  checked.push("template binds data-station-key to stationKey");
  assert.match(reorderSection, /draggable="\{\{draggable\}\}"/);
  checked.push("template binds draggable to the existing draggable field");
  assert.match(reorderSection, /title="\{\{dragLabel\}\}"/);
  assert.match(reorderSection, /aria-label="\{\{dragLabel\}\}"/);
  checked.push("template binds title and aria-label to dragLabel");
  assert.match(reorderSection, /arcflight-travel-runner-mvp__v2-order-drag-handle[^>]*aria-hidden="true"[^>]*>⋮⋮<\/span>/);
  checked.push("template includes the drag handle");
  assert.match(reorderSection, /Drag a station row to a new position, or use Move Up and Move Down\./);
  checked.push("template includes visible drag-or-keyboard instructions");
  assert.equal(currentSection.includes(listAttribute), false);
  assert.equal(currentSection.includes(rowAttribute), false);
  checked.push("canonical Current Station Sequence rows do not receive drag selectors");
  assert.match(reorderSection, /data-arcflight-travel-v2-order-move[^>]+data-direction="up"/);
  assert.match(reorderSection, /data-arcflight-travel-v2-order-move[^>]+data-direction="down"/);
  checked.push("Move Up and Move Down button selectors and directions remain intact");
  assert.match(template, /data-arcflight-travel-v2-order-reset-candidate/);
  checked.push("Reset Proposed Order remains intact");
  assert.match(template, /reorderInteraction\.canReorder[\s\S]+reorderInteraction\.keyboardEnabled[\s\S]+Keyboard Reorder Candidate/);
  checked.push("existing canReorder and keyboardEnabled guards remain intact");
  assert.match(css, /\.arcflight-travel-runner-mvp__v2-order-drag-list/);
  assert.match(css, /\.arcflight-travel-runner-mvp__v2-order-drag-row/);
  assert.match(css, /\.arcflight-travel-runner-mvp__v2-order-drag-handle/);
  checked.push("CSS includes drag-list, drag-row, and drag-handle selectors");
  assert.match(css, /cursor:\s*grab;/);
  assert.match(css, /cursor:\s*grabbing;/);
  checked.push("CSS includes grab and grabbing cursors");
  assert.match(css, /:(hover|focus-within)/);
  checked.push("CSS includes hover or focus-within affordance");
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  checked.push("CSS includes prefers-reduced-motion handling");
  assert.equal(/data-arcflight-travel-v2-order-move[\s\S]{0,200}pointer-events\s*:\s*none/.test(css), false);
  checked.push("CSS does not disable keyboard buttons with pointer-events");

  const dragCss = sectionBetween(css, ".arcflight-travel-runner-mvp__v2-order-drag-list", ".arcflight-travel-runner-mvp__v2-benefit-row--disabled");
  for (const source of [reorderSection, dragCss]) {
    for (const forbidden of ["addEventListener", "document", "window", "appendChild", "insertBefore", "replaceChildren", "classList", "commitTravelV2RoundActionOrder", "persistCommittedTravelV2RoundActionOrder", "saveTravelEventRunnerSessionToLibrary", "game.socket.emit", "ChatMessage", "JournalEntry", "Roll", "Actor", "Item"]) {
      assert.equal(source.includes(forbidden), false, `drag UI source excludes ${forbidden}`);
    }
  }
  checked.push("no runtime, persistence, commit, roll, world mutation, or DOM-listener integration appears in this slice");
  assert.match(aggregate, /travel-event-runner-v2-round-action-order-drag-ui\.smoke\.js/);
  assert.match(aggregate, /Travel event runner v2 round action order drag runtime[\s\S]+Travel event runner v2 round action order drag UI/);
  checked.push("aggregate smoke registration");

  return { ok: true, checked };
}

export default runTravelEventRunnerV2RoundActionOrderDragUiSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelEventRunnerV2RoundActionOrderDragUiSmokeChecks()
    .then((result) => {
      console.log("Travel event runner v2 round action-order drag UI smoke checks passed.");
      console.log(`Checked ${result.checked.length} groups:`);
      for (const check of result.checked) console.log(`- ${check}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
