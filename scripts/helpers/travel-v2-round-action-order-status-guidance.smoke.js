import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareTravelEventRunnerV2PreviewPanelState } from "../apps/travel-event-runner-v2-preview-panel.js";
import { commitTravelV2RoundActionOrderToSession, prepareTravelV2RoundActionOrderState } from "./travel-v2-round-action-order-state.js";
import { persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary } from "./travel-event-runner.js";

const ORDER = ["navigator", "engineer", "watchmaster"];
const REORDERED = ["engineer", "navigator", "watchmaster"];
const json = (value) => JSON.stringify(value);

function fixture(overrides = {}) {
  return {
    key: "runner-status-guidance",
    name: "Runner Status Guidance",
    status: "active",
    currentRoundIndex: 0,
    roundPhase: "stationOrders",
    event: { key: "event-status", name: "Event Status", rounds: [{ roundNumber: 1, activeStations: ORDER, stationPrompts: { navigator: { stationName: "Navigator" }, engineer: { stationName: "Engineer" }, watchmaster: { stationName: "Watchmaster" } }, stationActionOrder: ORDER }] },
    roundResults: [{ roundIndex: 0, stationResults: { navigator: null, engineer: null, watchmaster: null }, selectedStationOptionLabels: { navigator: "Plot", engineer: "Engineer", watchmaster: "Watch" }, stationActions: { navigator: { type: "eventApproach" }, engineer: { type: "support" }, watchmaster: { type: "eventApproach" } }, stationOrderCommitments: { navigator: { committed: true }, engineer: { committed: true }, watchmaster: { committed: true } } }],
    ...overrides
  };
}

function libraryWith(session) {
  return { version: 1, sessions: { [session.key]: { key: session.key, name: session.name, eventKey: session.event.key, eventName: session.event.name, status: session.status, currentRoundIndex: session.currentRoundIndex, session } } };
}

function decision(session, options = {}) {
  return prepareTravelV2RoundActionOrderState(session, options).orderDecision;
}

function assertNoForbidden(value) {
  const text = json(value);
  for (const key of ["userId", "userName", "auditRecord", "commitRecords", "raw session", "gmOnly"]) {
    assert.equal(text.includes(key), false, `non-GM state leaked ${key}`);
  }
}

export default async function runTravelV2RoundActionOrderStatusGuidanceSmokeChecks() {
  const checked = [];

  const proposed = prepareTravelV2RoundActionOrderState(fixture());
  assert.equal(proposed.orderDecision.statusKey, "proposed");
  assert.equal(proposed.orderDecision.statusLabel, "Proposed Order");
  assert.equal(proposed.orderDecision.hasCommittedOrder, false);
  assert.equal(proposed.orderDecision.hasProposedOrder, true);
  assert.equal(proposed.orderDecision.needsDecision, false);
  assert.equal(proposed.orderDecision.showCaptainGuidance, true);
  assert.match(proposed.orderDecision.captainGuidanceText, /If the crew cannot agree, the Captain makes the final call\./);
  checked.push("proposed order status and captain guidance");

  const commitResult = commitTravelV2RoundActionOrderToSession(fixture(), REORDERED, { user: { isGM: true, id: "gm-1", name: "GM" }, commitRequested: true, timestamp: "2026-07-15T00:00:00.000Z" });
  const committed = prepareTravelV2RoundActionOrderState(commitResult.session);
  assert.equal(committed.orderDecision.statusKey, "committed");
  assert.equal(committed.orderDecision.statusLabel, "Committed Order");
  assert.equal(committed.orderDecision.hasCommittedOrder, true);
  assert.equal(committed.orderDecision.hasProposedOrder, false);
  assert.equal(committed.orderDecision.needsDecision, false);
  assert.equal(committed.orderDecision.showCaptainGuidance, false);
  assert.deepEqual(committed.orderedStationKeys, REORDERED);
  checked.push("committed order status uses current-round committed sequence");

  const noProposal = fixture({ event: { key: "event-status", name: "Event Status", rounds: [{ roundNumber: 1, activeStations: ORDER, stationPrompts: { navigator: { stationName: "Navigator" }, engineer: { stationName: "Engineer" }, watchmaster: { stationName: "Watchmaster" } } }] } });
  const needs = prepareTravelV2RoundActionOrderState(noProposal);
  assert.equal(needs.orderDecision.statusKey, "needsDecision");
  assert.equal(needs.orderDecision.statusLabel, "Needs Decision");
  assert.equal(needs.orderDecision.hasCommittedOrder, false);
  assert.equal(needs.orderDecision.hasProposedOrder, false);
  assert.equal(needs.orderDecision.needsDecision, true);
  assert.equal(needs.orderDecision.showCaptainGuidance, true);
  assert.deepEqual(needs.orderedStationKeys, ORDER);
  checked.push("needs decision status keeps fallback display non-proposed");

  for (const badOrder of [["navigator", "navigator", "engineer"], ["navigator", "engineer"], ["navigator", "engineer", "pilot"]]) {
    const malformed = fixture({ travelV2RoundActionOrder: { rounds: { 0: { order: badOrder } } } });
    assert.notEqual(decision(malformed).statusLabel, "Committed Order");
  }
  checked.push("malformed committed records are not committed status");

  const otherRound = fixture({ travelV2RoundActionOrder: { rounds: { 1: { order: REORDERED } } } });
  assert.notEqual(decision(otherRound).statusLabel, "Committed Order");
  checked.push("committed records are isolated by current round");

  const review = prepareTravelV2RoundActionOrderState(noProposal, { user: { isGM: true }, isGM: true, travelV2RoundActionOrderReorderRequested: true, proposedOrder: REORDERED });
  assert.equal(review.reorderRequest.ready, true);
  assert.equal(review.orderDecision.statusKey, "proposed");
  assert.notDeepEqual(review.orderedStationKeys, review.reorderRequest.proposedStationKeys);
  checked.push("GM reorder review stays review-only until commit");

  assert.equal(proposed.orderDecision.statusLabel, "Proposed Order");
  assert.equal(committed.orderDecision.statusLabel, "Committed Order");
  checked.push("commit transition hides captain guidance");

  const persisted = await persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary(commitResult.session, { user: { isGM: true }, persistRequested: true, dryRun: true, library: libraryWith(fixture()), now: "2026-07-15T00:01:00.000Z" });
  const reloaded = prepareTravelV2RoundActionOrderState(persisted.entry.session);
  assert.equal(reloaded.orderDecision.statusLabel, "Committed Order");
  assert.deepEqual(reloaded.orderedStationKeys, REORDERED);
  checked.push("saved-session reload preserves committed order status");

  const playerPreview = prepareTravelEventRunnerV2PreviewPanelState({ session: fixture(), isGM: false, user: { isGM: false } }).roundActionOrderDisplay;
  assert.equal(playerPreview.orderDecision.statusLabel, "Proposed Order");
  assert.match(playerPreview.orderDecision.captainGuidanceText, /Captain makes the final call/);
  assertNoForbidden(playerPreview);
  checked.push("non-GM preview keeps status and guidance while redacting GM review internals");

  const template = readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
  for (const text of ["Proposed Order", "Committed Order", "Needs Decision", "Current Station Sequence", "The crew should agree on station order before Round 1 begins.", "If the crew cannot agree, the Captain makes the final call."]) assert.match(template, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(template, /showCaptainGuidance/);
  checked.push("template renders status labels, current sequence heading, and conditional guidance");

  const before = json(fixture());
  const sideEffectState = prepareTravelV2RoundActionOrderState(fixture());
  assert.equal(before, json(fixture()));
  for (const forbidden of ["ChatMessage", "JournalEntry", "socket", ".update(", "Roll(", "currentRoundIndex: 1"]) assert.equal(json(sideEffectState).includes(forbidden), false);
  checked.push("state preparation remains immutable and presentation-only");

  return { name: "Travel v2 round action order status guidance", checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runTravelV2RoundActionOrderStatusGuidanceSmokeChecks();
  console.log(`${result.name}: ${result.checked.length} checks passed`);
}
