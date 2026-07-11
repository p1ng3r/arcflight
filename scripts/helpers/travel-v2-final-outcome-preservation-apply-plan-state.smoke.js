import assert from "node:assert/strict";
import { prepareTravelEventRunnerState } from "./travel-event-runner.js";
import { prepareTravelV2FinalOutcomePreservationApplyPlan } from "./travel-v2-final-outcome-preservation-apply-plan.js";

const FORBIDDEN_PLAYER_SAFE_TERMS = Object.freeze([
  "auditRecord",
  "commitRecords",
  "userId",
  "userName",
  "gmText",
  "applyPayload",
  "targetActorUuid",
  "mutationScope",
  "internalMutation",
  "secret",
  "pendingConsequenceQueue",
  "gmOnly",
  "unrevealedHazard",
  "catalogSuggestions",
  "hiddenHazards",
  "debugReport",
  "futureTriggers",
  "HIDDEN_BAIT_VALUE",
  "HIDDEN_ENTRY_BAIT",
  "Actor.",
  "User.",
  "Compendium."
]);
const ALLOWED_ACTION_TYPES = Object.freeze(["preserveCompletedEventRecord", "attachRewardToShip", "attachRouteAdvantageToShip", "attachFollowUpToShip", "attachScarToShip", "recordPressureChange"]);

function snap(value) { return JSON.stringify(value); }
function runnerOptions(isGM) { return { user: { isGM }, library: { events: {} }, runnerSessionLibrary: { sessions: {} }, now: "2026-07-11T00:00:00.000Z" }; }

function assertNoForbiddenTerms(value, label) {
  const serialized = snap(value);
  for (const forbidden of FORBIDDEN_PLAYER_SAFE_TERMS) assert.equal(serialized.includes(forbidden), false, `${label} excludes ${forbidden}`);
}

function fixtureSession() {
  return {
    key: "final-outcome-preservation-apply-plan-state-session",
    name: "Stormglass Apply Plan Session",
    status: "completed",
    completed: true,
    completedAt: "2026-07-11T00:00:00.000Z",
    currentRoundIndex: 1,
    event: {
      key: "stormglass-apply-plan",
      name: "Stormglass Apply Plan",
      category: "route-hazard",
      rounds: [
        { title: "Find the Bearing", activeStations: ["navigator", "watchmaster"] },
        { title: "Break Through", activeStations: ["captain", "engineer"] }
      ]
    },
    route: { from: "Aster Dock", to: "Stormglass Shoal" },
    startLocation: "Aster Dock",
    destination: "Stormglass Shoal",
    finalOutcome: {
      summary: "The crew reaches Stormglass Shoal with salvage, leverage, and lingering strain.",
      locationChange: { from: "Aster Dock", to: "Stormglass Shoal" },
      consequences: [
        { name: "Bruised timetable", text: "The delay needs public GM review.", targetActorUuid: "Actor.hidden" },
        { name: "Hidden consequence", text: "HIDDEN_ENTRY_BAIT", gmOnly: true }
      ],
      rewards: [{ name: "Hull patch cache", summary: "Ship-relevant repair supplies recovered." }, { name: "Hidden reward", text: "HIDDEN_ENTRY_BAIT", hidden: true }],
      clues: [{ name: "Lantern echo", publicText: "A signal points deeper into the shoal.", gmText: "HIDDEN_BAIT_VALUE" }],
      routeAdvantages: [{ name: "Tailwind lane", text: "Future piloting can use the landmark." }],
      followUps: [{ name: "Meet the reefwarden", text: "A public lead awaits at dockside.", userId: "User.hidden" }],
      pressureChanges: [{ resource: "hull", value: -1 }, { resource: "morale", value: 1 }, { resource: "secret", value: 99 }],
      hiddenOutcome: { summary: "HIDDEN_BAIT_VALUE", gmText: "HIDDEN_ENTRY_BAIT" }
    },
    travelV2Hazards: { records: [
      { id: "public-active", name: "Static Front", status: "active", revealed: true, playerText: "Static lashes the rigging.", gmText: "HIDDEN_BAIT_VALUE" },
      { id: "hidden-active", name: "HIDDEN_BAIT_VALUE", status: "active", revealed: false, playerText: "HIDDEN_ENTRY_BAIT", unrevealedHazard: true }
    ] },
    travelV2ShipScars: { records: [
      { id: "scar-1", name: "Singing Hull", status: "open", severity: "minor", playerText: "The hull hums under moonlight.", gmText: "HIDDEN_BAIT_VALUE" },
      { id: "hidden-scar", name: "HIDDEN_ENTRY_BAIT", hidden: true, playerText: "HIDDEN_BAIT_VALUE" }
    ] },
    auditRecord: "HIDDEN_BAIT_VALUE",
    applyPayload: { value: "HIDDEN_BAIT_VALUE" },
    pendingConsequenceQueue: [{ secret: "HIDDEN_ENTRY_BAIT" }],
    hiddenHazards: [{ name: "HIDDEN_BAIT_VALUE" }],
    debugReport: "HIDDEN_BAIT_VALUE",
    futureTriggers: ["HIDDEN_ENTRY_BAIT"],
    targetActorUuid: "Actor.hidden",
    actorReference: "Actor.HIDDEN_BAIT_VALUE",
    userReference: "User.HIDDEN_BAIT_VALUE",
    catalogSuggestions: ["Compendium.hidden"]
  };
}

export async function runTravelV2FinalOutcomePreservationApplyPlanStateSmokeChecks() {
  const emptyState = prepareTravelEventRunnerState(null, runnerOptions(true));
  assert.equal(Object.hasOwn(emptyState, "travelV2FinalOutcomePreservationApplyPlan"), true, "empty runner state exposes canonical apply plan");
  assert.equal(Object.hasOwn(emptyState, "finalOutcomePreservationApplyPlan"), true, "empty runner state exposes apply plan alias");
  assert.deepEqual(emptyState.finalOutcomePreservationApplyPlan, emptyState.travelV2FinalOutcomePreservationApplyPlan, "empty apply plan alias matches canonical state");
  assert.equal(emptyState.travelV2FinalOutcomePreservationApplyPlan.hasApplyPlan, false, "empty apply plan has no plan");
  assert.equal(emptyState.travelV2FinalOutcomePreservationApplyPlan.reviewOnly, true, "empty apply plan is review-only");
  assert.equal(emptyState.travelV2FinalOutcomePreservationApplyPlan.requiresExplicitGmApply, true, "empty apply plan requires explicit GM apply");

  const session = fixtureSession();
  const before = snap(session);
  const gmOptions = runnerOptions(true);
  const gmState = prepareTravelEventRunnerState(session, gmOptions);
  const directState = prepareTravelV2FinalOutcomePreservationApplyPlan(gmState.session, gmOptions);
  const plan = gmState.travelV2FinalOutcomePreservationApplyPlan;
  assert.equal(Object.hasOwn(gmState, "travelV2FinalOutcomePreservationApplyPlan"), true, "fixture runner state exposes canonical apply plan");
  assert.equal(Object.hasOwn(gmState, "finalOutcomePreservationApplyPlan"), true, "fixture runner state exposes apply plan alias");
  assert.deepEqual(gmState.finalOutcomePreservationApplyPlan, plan, "fixture apply plan alias matches canonical state");
  assert.deepEqual(plan, directState, "fixture runner apply plan matches direct helper output from player-safe session");
  assert.equal(plan.hasApplyPlan, true, "fixture apply plan has a plan");
  assert.equal(plan.reviewOnly, true, "fixture apply plan is review-only");
  assert.equal(plan.requiresExplicitGmApply, true, "fixture apply plan requires explicit GM apply");
  assert.ok(plan.completedEventRecordAction, "fixture apply plan includes completed event record action");
  assert.equal(Array.isArray(plan.shipAttachmentActions), true, "ship attachment actions is an array");
  assert.equal(Array.isArray(plan.skippedCandidates), true, "skipped candidates is an array");
  for (const action of [plan.completedEventRecordAction, ...plan.shipAttachmentActions]) {
    assert.equal(action.reviewOnly, true, "actions are review-only");
    assert.equal(action.requiresExplicitGmApply, true, "actions require explicit GM apply");
    assert.equal(action.eligible, true, "actions are eligible");
    assert.equal(ALLOWED_ACTION_TYPES.includes(action.actionType), true, `action type is allowed: ${action.actionType}`);
  }

  const nonGmState = prepareTravelEventRunnerState(session, runnerOptions(false));
  assert.deepEqual(gmState.travelV2FinalOutcomePreservationApplyPlan, nonGmState.travelV2FinalOutcomePreservationApplyPlan, "GM and non-GM apply plans match");
  assert.deepEqual(nonGmState.finalOutcomePreservationApplyPlan, nonGmState.travelV2FinalOutcomePreservationApplyPlan, "non-GM apply plan alias matches canonical state");
  assertNoForbiddenTerms(gmState.travelV2FinalOutcomePreservationApplyPlan, "GM apply plan");
  assertNoForbiddenTerms(gmState.finalOutcomePreservationApplyPlan, "GM apply plan alias");
  assertNoForbiddenTerms(nonGmState.travelV2FinalOutcomePreservationApplyPlan, "non-GM apply plan");
  assertNoForbiddenTerms(nonGmState.finalOutcomePreservationApplyPlan, "non-GM apply plan alias");
  assert.equal(snap(session), before, "runner-state apply-plan preparation does not mutate input session");

  return { checked: ["runner-state-empty-final-outcome-preservation-apply-plan", "runner-state-direct-apply-plan-helper-output", "runner-state-final-outcome-preservation-apply-plan-fields", "runner-state-final-outcome-preservation-apply-plan-parity", "runner-state-final-outcome-preservation-apply-plan-player-safety", "runner-state-final-outcome-preservation-apply-plan-immutability"] };
}

export default runTravelV2FinalOutcomePreservationApplyPlanStateSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await runTravelV2FinalOutcomePreservationApplyPlanStateSmokeChecks();
    console.log("Travel v2 final outcome preservation apply plan state smoke checks passed.");
    console.log(`Checked ${result.checked.length} groups:`);
    for (const checkName of result.checked) console.log(`- ${checkName}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
