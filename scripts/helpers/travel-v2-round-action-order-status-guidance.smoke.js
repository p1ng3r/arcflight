import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareTravelEventRunnerV2PreviewPanelState } from "../apps/travel-event-runner-v2-preview-panel.js";
import { commitTravelV2RoundActionOrderToSession, prepareTravelV2RoundActionOrderState } from "./travel-v2-round-action-order-state.js";
import { persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary } from "./travel-event-runner.js";

const ORDER = ["navigator", "engineer", "watchmaster"];
const REORDERED = ["engineer", "navigator", "watchmaster"];
const AUTHORED = ["watchmaster", "navigator", "engineer"];
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

function withoutAuthoredProposal(overrides = {}) {
  return fixture({
    event: { key: "event-status", name: "Event Status", rounds: [{ roundNumber: 1, activeStations: ORDER, stationPrompts: { navigator: { stationName: "Navigator" }, engineer: { stationName: "Engineer" }, watchmaster: { stationName: "Watchmaster" } } }] },
    ...overrides
  });
}

function withAuthoredOrder(order = AUTHORED, overrides = {}) {
  return fixture({
    event: { key: "event-status", name: "Event Status", rounds: [{ roundNumber: 1, activeStations: ORDER, stationPrompts: { navigator: { stationName: "Navigator" }, engineer: { stationName: "Engineer" }, watchmaster: { stationName: "Watchmaster" } }, stationActionOrder: order }] },
    ...overrides
  });
}

function libraryWith(session) {
  return { version: 1, sessions: { [session.key]: { key: session.key, name: session.name, eventKey: session.event.key, eventName: session.event.name, status: session.status, currentRoundIndex: session.currentRoundIndex, session } } };
}

function decision(session, options = {}) {
  return prepareTravelV2RoundActionOrderState(session, options).orderDecision;
}

function display(session, options = {}) {
  return prepareTravelEventRunnerV2PreviewPanelState({ session, isGM: options.isGM === true, user: options.user ?? { isGM: options.isGM === true } }).roundActionOrderDisplay;
}

function assertNoForbidden(value) {
  const text = json(value);
  for (const key of ["userId", "userName", "auditRecord", "commitRecords", "raw session", "gmOnly"]) {
    assert.equal(text.includes(key), false, `non-GM state leaked ${key}`);
  }
}

export default async function runTravelV2RoundActionOrderStatusGuidanceSmokeChecks() {
  const checked = [];

  const proposedInput = fixture();
  const proposedBefore = json(proposedInput);
  const proposed = prepareTravelV2RoundActionOrderState(proposedInput);
  assert.equal(json(proposedInput), proposedBefore, "proposed fixture input is not mutated");
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

  const noProposal = withoutAuthoredProposal();
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
    const malformedBefore = json(malformed);
    assert.notEqual(decision(malformed).statusLabel, "Committed Order");
    assert.equal(json(malformed), malformedBefore, "malformed committed fixture input is not mutated");
    const malformedDisplay = display(malformed, { isGM: true });
    assert.equal(malformedDisplay.orderDecision.hasCommittedOrder, false);
    assert.equal(malformedDisplay.canPersistCommittedOrder, false);
  }
  checked.push("malformed committed records are not committed status and cannot enable persistence");

  const otherRound = fixture({ travelV2RoundActionOrder: { rounds: { 1: { order: REORDERED } } } });
  assert.notEqual(decision(otherRound).statusLabel, "Committed Order");
  checked.push("committed records are isolated by current round");

  const review = prepareTravelV2RoundActionOrderState(noProposal, { user: { isGM: true }, isGM: true, travelV2RoundActionOrderReorderRequested: true, proposedOrder: REORDERED });
  assert.equal(review.reorderRequest.requested, true);
  assert.equal(review.reorderRequest.ready, true);
  assert.equal(review.orderDecision.statusKey, "needsDecision");
  assert.equal(review.orderDecision.statusLabel, "Needs Decision");
  assert.equal(review.orderDecision.hasCommittedOrder, false);
  assert.equal(review.orderDecision.hasProposedOrder, false);
  assert.equal(review.orderDecision.needsDecision, true);
  assert.equal(review.orderDecision.showCaptainGuidance, true);
  assert.deepEqual(review.reorderRequest.proposedStationKeys, REORDERED);
  assert.notDeepEqual(review.orderedStationKeys, review.reorderRequest.proposedStationKeys);
  checked.push("GM reorder candidate remains review-only and does not become canonical until commit");

  const validCommittedDisplay = display(commitResult.session, { isGM: true, user: { isGM: true } });
  assert.equal(validCommittedDisplay.orderDecision.hasCommittedOrder, true);
  assert.equal(validCommittedDisplay.canPersistCommittedOrder, true);
  const nonGmCommittedDisplay = display(commitResult.session, { isGM: false, user: { isGM: false } });
  assert.equal(nonGmCommittedDisplay.orderDecision.hasCommittedOrder, true);
  assert.equal(nonGmCommittedDisplay.canPersistCommittedOrder, false);
  checked.push("persistence readiness uses canonical committed status and GM capability");

  const authoredPlusReview = prepareTravelV2RoundActionOrderState(withAuthoredOrder(AUTHORED), { user: { isGM: true }, isGM: true, travelV2RoundActionOrderReorderRequested: true, proposedOrder: REORDERED });
  assert.equal(authoredPlusReview.orderDecision.statusKey, "proposed");
  assert.equal(authoredPlusReview.orderDecision.orderSourceKey, "authoredProposal");
  assert.deepEqual(authoredPlusReview.orderedStationKeys, AUTHORED);
  assert.deepEqual(authoredPlusReview.reorderRequest.proposedStationKeys, REORDERED);
  checked.push("authored proposal remains canonical when a different GM review candidate exists");

  const needsReview = prepareTravelV2RoundActionOrderState(noProposal, { user: { isGM: true }, isGM: true, travelV2RoundActionOrderReorderRequested: true, proposedOrder: REORDERED });
  assert.equal(needsReview.orderDecision.statusKey, "needsDecision");
  const needsCommitResult = commitTravelV2RoundActionOrderToSession(noProposal, needsReview.reorderRequest.proposedStationKeys, { user: { isGM: true, id: "gm-1", name: "GM" }, commitRequested: true, timestamp: "2026-07-15T00:02:00.000Z" });
  const needsCommittedState = prepareTravelV2RoundActionOrderState(needsCommitResult.session);
  const needsCommittedDisplay = display(needsCommitResult.session, { isGM: true, user: { isGM: true } });
  assert.equal(needsCommittedState.orderDecision.statusKey, "committed");
  assert.equal(needsCommittedState.orderDecision.statusLabel, "Committed Order");
  assert.deepEqual(needsCommittedState.orderedStationKeys, REORDERED);
  assert.equal(needsCommittedState.orderDecision.showCaptainGuidance, false);
  assert.equal(needsCommittedDisplay.canPersistCommittedOrder, true);
  checked.push("needs-decision review candidate becomes canonical only after GM commit");

  assert.equal(proposed.orderDecision.statusLabel, "Proposed Order");
  assert.equal(committed.orderDecision.statusLabel, "Committed Order");
  checked.push("commit transition hides captain guidance");

  const persisted = await persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary(commitResult.session, { user: { isGM: true }, persistRequested: true, dryRun: true, library: libraryWith(fixture()), now: "2026-07-15T00:01:00.000Z" });
  const reloaded = prepareTravelV2RoundActionOrderState(persisted.entry.session);
  assert.equal(reloaded.orderDecision.statusLabel, "Committed Order");
  assert.deepEqual(reloaded.orderedStationKeys, REORDERED);
  checked.push("saved-session reload preserves committed order status");

  const playerPreview = display(fixture(), { isGM: false, user: { isGM: false } });
  assert.equal(playerPreview.orderDecision.statusLabel, "Proposed Order");
  assert.match(playerPreview.orderDecision.captainGuidanceText, /Captain makes the final call/);
  assertNoForbidden(playerPreview);
  checked.push("non-GM preview keeps status and guidance while redacting GM review internals");

  const template = readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
  for (const text of ["roundActionOrderDisplay.orderDecision.statusLabel", "roundActionOrderDisplay.orderDecision.guidanceText", "roundActionOrderDisplay.orderDecision.captainGuidanceText", "roundActionOrderDisplay.orderDecision.showCaptainGuidance", "roundActionOrderDisplay.reorderRequest.ready", "Current Station Sequence", "Ready to Commit", "Reorder Review Candidate"]) assert.match(template, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  checked.push("template binds dynamic decision fields and visible review headings without copy-only comments");

  const input = fixture();
  const before = json(input);
  const sideEffectState = prepareTravelV2RoundActionOrderState(input);
  assert.equal(json(input), before, "state preparation does not mutate the actual input session");
  for (const forbidden of ["ChatMessage", "JournalEntry", "socket", ".update(", "Roll(", "currentRoundIndex: 1"]) assert.equal(json(sideEffectState).includes(forbidden), false);
  checked.push("state preparation remains immutable and presentation-only");

  return { name: "Travel v2 round action order status guidance", checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runTravelV2RoundActionOrderStatusGuidanceSmokeChecks();
  console.log(`${result.name}: ${result.checked.length} checks passed`);
}
