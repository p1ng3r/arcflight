import assert from "node:assert/strict";
import { prepareTravelEventRunnerState } from "./travel-event-runner.js";
import { prepareTravelV2FinalOutcomePackage } from "./travel-v2-final-outcome.js";

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

function snap(value) { return JSON.stringify(value); }

function runnerOptions(isGM) {
  return { user: { isGM }, library: { events: {} }, runnerSessionLibrary: { sessions: {} }, now: "2026-07-11T00:00:00.000Z" };
}

function fixtureSession() {
  return {
    key: "final-outcome-state-session",
    name: "Stormglass Approach Session",
    status: "completed",
    completed: true,
    completedAt: "2026-07-11T00:00:00.000Z",
    currentRoundIndex: 1,
    event: {
      key: "stormglass-approach",
      name: "Stormglass Approach",
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
      summary: "The crew reaches Stormglass Shoal with useful bearings.",
      locationChange: { from: "Aster Dock", to: "Stormglass Shoal" },
      consequences: [
        { name: "Bruised timetable", text: "The delay needs GM review.", targetActorUuid: "Actor.hidden" },
        { name: "Hidden consequence", text: "HIDDEN_ENTRY_BAIT", gmOnly: true }
      ],
      rewards: ["A clean approach vector", { name: "Hidden reward", text: "HIDDEN_ENTRY_BAIT", hidden: true }],
      clues: [{ name: "Lantern echo", publicText: "A signal points deeper into the shoal.", gmText: "HIDDEN_BAIT_VALUE" }],
      routeAdvantages: [{ name: "Known crosswind", text: "Future piloting can use the landmark." }],
      followUps: [{ name: "Check the beacon", text: "The GM may frame a later scene.", userId: "User.hidden" }],
      pressureChanges: [{ resource: "hull", value: -1 }, { resource: "morale", value: 1 }, { resource: "secret", value: 99 }]
    },
    travelV2Hazards: { records: [
      { id: "public-active", name: "Static Front", status: "active", revealed: true, playerText: "Static lashes the rigging.", gmText: "HIDDEN_BAIT_VALUE" },
      { id: "hidden-active", name: "HIDDEN_BAIT_VALUE", status: "active", revealed: false, playerText: "HIDDEN_ENTRY_BAIT", unrevealedHazard: true }
    ] },
    shipScars: { records: [
      { id: "scar-1", name: "Singing Hull", status: "pending", severity: "minor", playerText: "The hull hums under moonlight.", gmText: "HIDDEN_BAIT_VALUE" }
    ] },
    travelV2RoundResolutions: { records: [{ roundNumber: 1 }, { roundNumber: 2 }] },
    auditRecord: "HIDDEN_BAIT_VALUE",
    applyPayload: { value: "HIDDEN_BAIT_VALUE" },
    pendingConsequenceQueue: [{ secret: "HIDDEN_ENTRY_BAIT" }],
    hiddenHazards: [{ name: "HIDDEN_BAIT_VALUE" }],
    debugReport: "HIDDEN_BAIT_VALUE",
    futureTriggers: ["HIDDEN_ENTRY_BAIT"],
    targetActorUuid: "Actor.hidden",
    catalogSuggestions: ["Compendium.hidden"]
  };
}

function assertNoForbiddenTerms(value, label) {
  const serialized = snap(value);
  for (const forbidden of FORBIDDEN_PLAYER_SAFE_TERMS) {
    assert.equal(serialized.includes(forbidden), false, `${label} excludes ${forbidden}`);
  }
}

export async function runTravelV2FinalOutcomeStateSmokeChecks() {
  const emptyState = prepareTravelEventRunnerState(null, runnerOptions(true));
  assert.equal(Object.hasOwn(emptyState, "travelV2FinalOutcome"), true, "empty runner state exposes canonical final outcome");
  assert.equal(Object.hasOwn(emptyState, "finalOutcome"), true, "empty runner state exposes final outcome alias");
  assert.deepEqual(emptyState.finalOutcome, emptyState.travelV2FinalOutcome, "empty runner final outcome alias matches canonical state");
  assert.equal(emptyState.travelV2FinalOutcome.hasFinalOutcome, false, "empty runner final outcome state has no outcome");

  const session = fixtureSession();
  const before = snap(session);
  const gmOptions = runnerOptions(true);
  const gmState = prepareTravelEventRunnerState(session, gmOptions);
  const directState = prepareTravelV2FinalOutcomePackage(gmState.session, gmOptions);
  assert.equal(Object.hasOwn(gmState, "travelV2FinalOutcome"), true, "fixture runner state exposes canonical final outcome");
  assert.equal(Object.hasOwn(gmState, "finalOutcome"), true, "fixture runner state exposes final outcome alias");
  assert.deepEqual(gmState.finalOutcome, gmState.travelV2FinalOutcome, "fixture runner final outcome alias matches canonical state");
  assert.deepEqual(gmState.travelV2FinalOutcome, directState, "fixture runner final outcome matches direct helper output");
  assert.equal(gmState.travelV2FinalOutcome.hasFinalOutcome, true, "fixture runner final outcome has outcome");
  assert.equal(gmState.travelV2FinalOutcome.locationChange.summary, "Aster Dock → Stormglass Shoal", "fixture location change summary is present");
  for (const key of ["consequences", "rewards", "clues", "routeAdvantages", "followUps", "scars", "pressureChanges"]) {
    assert.equal(Array.isArray(gmState.travelV2FinalOutcome[key]), true, `${key} is an array`);
  }

  const nonGmState = prepareTravelEventRunnerState(session, runnerOptions(false));
  assert.deepEqual(gmState.travelV2FinalOutcome, nonGmState.travelV2FinalOutcome, "GM and non-GM runner states expose the same player-safe final outcome");
  assert.deepEqual(nonGmState.finalOutcome, nonGmState.travelV2FinalOutcome, "non-GM runner final outcome alias matches canonical state");
  assertNoForbiddenTerms(gmState.travelV2FinalOutcome, "GM final outcome");
  assertNoForbiddenTerms(gmState.finalOutcome, "GM final outcome alias");
  assertNoForbiddenTerms(nonGmState.travelV2FinalOutcome, "non-GM final outcome");
  assertNoForbiddenTerms(nonGmState.finalOutcome, "non-GM final outcome alias");
  assert.equal(snap(session), before, "runner-state final outcome preparation does not mutate input session");

  return { checked: ["runner-state-empty-final-outcome", "runner-state-direct-helper-output", "runner-state-final-outcome-fields", "runner-state-final-outcome-player-safety", "runner-state-final-outcome-immutability"] };
}

export default runTravelV2FinalOutcomeStateSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await runTravelV2FinalOutcomeStateSmokeChecks();
    console.log("Travel v2 final outcome state smoke checks passed.");
    console.log(`Checked ${result.checked.length} groups:`);
    for (const checkName of result.checked) console.log(`- ${checkName}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
