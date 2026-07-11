import assert from "node:assert/strict";
import { prepareTravelEventRunnerState } from "./travel-event-runner.js";
import { prepareTravelV2FinalOutcomePreservationPlan } from "./travel-v2-final-outcome-preservation.js";

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
const PUBLIC_CANDIDATE_TYPES = Object.freeze(["reward", "routeAdvantage", "followUp", "scar", "pressureChange"]);

function snap(value) { return JSON.stringify(value); }
function runnerOptions(isGM) { return { user: { isGM }, library: { events: {} }, runnerSessionLibrary: { sessions: {} }, now: "2026-07-11T00:00:00.000Z" }; }

function fixtureSession() {
  return {
    key: "final-outcome-preservation-state-session",
    name: "Stormglass Preservation Session",
    status: "completed",
    completed: true,
    completedAt: "2026-07-11T00:00:00.000Z",
    currentRoundIndex: 1,
    event: {
      key: "stormglass-preservation",
      name: "Stormglass Preservation",
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
      rewards: [{ name: "Clean approach vector", summary: "A reliable route marker is logged." }, { name: "Hidden reward", text: "HIDDEN_ENTRY_BAIT", hidden: true }],
      clues: [{ name: "Lantern echo", publicText: "A signal points deeper into the shoal.", gmText: "HIDDEN_BAIT_VALUE" }],
      routeAdvantages: [{ name: "Known crosswind", text: "Future piloting can use the landmark." }],
      followUps: [{ name: "Check the beacon", text: "The GM may frame a later scene.", userId: "User.hidden" }],
      pressureChanges: [{ resource: "hull", value: -1 }, { resource: "morale", value: 1 }, { resource: "secret", value: 99 }],
      hiddenOutcome: { summary: "HIDDEN_BAIT_VALUE", gmText: "HIDDEN_ENTRY_BAIT" }
    },
    travelV2Hazards: { records: [
      { id: "public-active", name: "Static Front", status: "active", revealed: true, playerText: "Static lashes the rigging.", gmText: "HIDDEN_BAIT_VALUE" },
      { id: "hidden-active", name: "HIDDEN_BAIT_VALUE", status: "active", revealed: false, playerText: "HIDDEN_ENTRY_BAIT", unrevealedHazard: true }
    ] },
    travelV2ShipScars: { records: [
      { id: "scar-1", name: "Singing Hull", status: "open", severity: "minor", playerText: "The hull hums under moonlight.", gmText: "HIDDEN_BAIT_VALUE" }
    ] },
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
  for (const forbidden of FORBIDDEN_PLAYER_SAFE_TERMS) assert.equal(serialized.includes(forbidden), false, `${label} excludes ${forbidden}`);
}

export async function runTravelV2FinalOutcomePreservationStateSmokeChecks() {
  const emptyState = prepareTravelEventRunnerState(null, runnerOptions(true));
  assert.equal(Object.hasOwn(emptyState, "travelV2FinalOutcomePreservation"), true, "empty runner state exposes canonical preservation plan");
  assert.equal(Object.hasOwn(emptyState, "finalOutcomePreservation"), true, "empty runner state exposes preservation alias");
  assert.deepEqual(emptyState.finalOutcomePreservation, emptyState.travelV2FinalOutcomePreservation, "empty preservation alias matches canonical state");
  assert.equal(emptyState.travelV2FinalOutcomePreservation.hasPlan, false, "empty preservation plan has no plan");
  assert.equal(emptyState.travelV2FinalOutcomePreservation.reviewOnly, true, "empty preservation plan is review-only");

  const session = fixtureSession();
  const before = snap(session);
  const gmOptions = runnerOptions(true);
  const gmState = prepareTravelEventRunnerState(session, gmOptions);
  const directState = prepareTravelV2FinalOutcomePreservationPlan(gmState.session, gmOptions);
  assert.equal(Object.hasOwn(gmState, "travelV2FinalOutcomePreservation"), true, "fixture runner state exposes canonical preservation plan");
  assert.equal(Object.hasOwn(gmState, "finalOutcomePreservation"), true, "fixture runner state exposes preservation alias");
  assert.deepEqual(gmState.finalOutcomePreservation, gmState.travelV2FinalOutcomePreservation, "fixture preservation alias matches canonical state");
  assert.deepEqual(gmState.travelV2FinalOutcomePreservation, directState, "fixture runner preservation matches direct helper output from player-safe session");
  assert.equal(gmState.travelV2FinalOutcomePreservation.hasPlan, true, "fixture preservation plan has a plan");
  assert.equal(gmState.travelV2FinalOutcomePreservation.reviewOnly, true, "fixture preservation plan is review-only");
  assert.ok(gmState.travelV2FinalOutcomePreservation.completedEventRecord, "fixture preservation plan includes completed event record");
  for (const key of ["shipAttachmentCandidates", "rewardCandidates", "clueCandidates", "routeAdvantageCandidates", "followUpCandidates", "scarCandidates", "pressureChangeCandidates"]) assert.equal(Array.isArray(gmState.travelV2FinalOutcomePreservation[key]), true, `${key} is an array`);
  for (const candidate of gmState.travelV2FinalOutcomePreservation.shipAttachmentCandidates) {
    assert.equal(candidate.reviewOnly, true, "ship attachment candidates are review-only");
    assert.equal(PUBLIC_CANDIDATE_TYPES.includes(candidate.type), true, `candidate type is public: ${candidate.type}`);
  }

  const nonGmState = prepareTravelEventRunnerState(session, runnerOptions(false));
  assert.deepEqual(gmState.travelV2FinalOutcomePreservation, nonGmState.travelV2FinalOutcomePreservation, "GM and non-GM preservation plans match");
  assert.deepEqual(nonGmState.finalOutcomePreservation, nonGmState.travelV2FinalOutcomePreservation, "non-GM preservation alias matches canonical state");
  assertNoForbiddenTerms(gmState.travelV2FinalOutcomePreservation, "GM preservation plan");
  assertNoForbiddenTerms(gmState.finalOutcomePreservation, "GM preservation alias");
  assertNoForbiddenTerms(nonGmState.travelV2FinalOutcomePreservation, "non-GM preservation plan");
  assertNoForbiddenTerms(nonGmState.finalOutcomePreservation, "non-GM preservation alias");
  assert.equal(snap(session), before, "runner-state preservation preparation does not mutate input session");

  return { checked: ["runner-state-empty-final-outcome-preservation", "runner-state-direct-preservation-helper-output", "runner-state-final-outcome-preservation-fields", "runner-state-final-outcome-preservation-player-safety", "runner-state-final-outcome-preservation-immutability"] };
}

export default runTravelV2FinalOutcomePreservationStateSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await runTravelV2FinalOutcomePreservationStateSmokeChecks();
    console.log("Travel v2 final outcome preservation state smoke checks passed.");
    console.log(`Checked ${result.checked.length} groups:`);
    for (const checkName of result.checked) console.log(`- ${checkName}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
