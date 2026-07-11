import { prepareTravelV2FinalOutcomePackage } from "./travel-v2-final-outcome.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel v2 final outcome smoke check failed: ${message}`); }
function assertEqual(actual, expected, message) { if (actual !== expected) throw new Error(`Travel v2 final outcome smoke check failed: ${message}. Expected ${expected}, got ${actual}.`); }
function snap(value) { return JSON.stringify(value); }
const FORBIDDEN = ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions", "hiddenHazards", "debugReport", "futureTriggers"];
const BAIT = ["HIDDEN_BAIT_VALUE", "Actor.abc123", "User.badgm", "APPLY_PAYLOAD_BAIT", "AUDIT_RECORD_BAIT"];

function fixtureSession() {
  return {
    status: "completed",
    completed: true,
    completedAt: "2026-07-11T00:00:00.000Z",
    currentRoundIndex: 1,
    event: { key: "stormglass-approach", name: "Stormglass Approach", category: "route-hazard", rounds: [{}, {}] },
    route: { from: "Aster Dock", to: "Stormglass Shoal" },
    finalOutcome: {
      summary: "The crew reaches Stormglass Shoal with useful bearings.",
      consequences: [{ name: "Bruised timetable", text: "The delay needs GM review.", targetActorUuid: "Actor.abc123", auditRecord: "AUDIT_RECORD_BAIT" }],
      rewards: ["A clean approach vector"],
      clues: [{ name: "Lantern echo", publicText: "A signal points deeper into the shoal.", gmText: "HIDDEN_BAIT_VALUE" }],
      routeAdvantages: [{ name: "Known crosswind", text: "Future piloting can use the landmark." }],
      followUps: [{ name: "Check the beacon", text: "The GM may frame a later scene.", userId: "User.badgm" }],
      pressureChanges: [{ resource: "hull", value: -1 }, { resource: "secret", value: 99 }, { resource: "morale", value: 1 }]
    },
    travelV2Hazards: { records: [
      { id: "public-active", hazardId: "public-active", name: "Static Front", status: "active", revealed: true, playerText: "Static lashes the rigging.", gmText: "HIDDEN_BAIT_VALUE", effects: [], responseActions: [] },
      { id: "hidden-active", hazardId: "hidden-active", name: "HIDDEN_BAIT_VALUE", status: "active", revealed: false, playerText: "Should not appear", gmText: "HIDDEN_BAIT_VALUE", effects: [], responseActions: [] },
      { id: "public-cleared", hazardId: "public-cleared", name: "Cleared Squall", status: "cleared", revealed: true, playerText: "The squall breaks.", effects: [], responseActions: [] }
    ] },
    shipScars: { records: [{ id: "scar-1", name: "Singing Hull", status: "pending", severity: "minor", playerText: "The hull hums under moonlight.", gmText: "HIDDEN_BAIT_VALUE" }] },
    travelV2RoundResolutions: { records: [{ roundNumber: 1 }, { roundNumber: 2 }] },
    auditRecord: "AUDIT_RECORD_BAIT",
    applyPayload: { value: "APPLY_PAYLOAD_BAIT" },
    userId: "User.badgm",
    hiddenHazards: [{ name: "HIDDEN_BAIT_VALUE" }]
  };
}

export async function runTravelV2FinalOutcomeSmokeChecks() {
  const missing = prepareTravelV2FinalOutcomePackage(null);
  assertEqual(missing.hasFinalOutcome, false, "missing session has no final outcome");
  assertSmoke(["eventKey", "eventName", "category", "categoryLabel", "completionState", "outcomeSummary", "playerSafeSummary", "safetyNote"].every((key) => typeof missing[key] === "string"), "missing session returns safe strings");
  assertSmoke(["unresolvedHazards", "resolvedHazards", "consequences", "rewards", "clues", "routeAdvantages", "followUps", "scars", "pressureChanges", "gmReviewPrompts"].every((key) => Array.isArray(missing[key])), "missing session returns safe arrays");

  const session = fixtureSession();
  const before = snap(session);
  const pkg = prepareTravelV2FinalOutcomePackage(session);
  assertEqual(pkg.hasFinalOutcome, true, "fixture has final outcome");
  for (const key of ["hasFinalOutcome", "eventKey", "eventName", "category", "categoryLabel", "roundCount", "completedRoundCount", "currentRoundIndex", "currentRoundNumber", "completionState", "locationChange", "unresolvedHazards", "resolvedHazards", "consequences", "rewards", "clues", "routeAdvantages", "followUps", "scars", "pressureChanges", "outcomeSummary", "gmReviewPrompts", "playerSafeSummary", "safetyNote"]) assertSmoke(Object.hasOwn(pkg, key), `required field ${key} exists`);
  assertEqual(pkg.locationChange.summary, "Aster Dock → Stormglass Shoal", "location change is summarized");
  assertEqual(pkg.unresolvedHazards.length, 1, "only revealed unresolved hazards included");
  assertEqual(pkg.unresolvedHazards[0].name, "Static Front", "revealed hazard name included");
  assertEqual(pkg.resolvedHazards.length, 1, "revealed resolved hazards included");
  assertSmoke(pkg.consequences.length === 1 && pkg.rewards.length === 1 && pkg.clues.length === 1 && pkg.routeAdvantages.length === 1 && pkg.followUps.length === 1, "reviewable aftermath arrays included");
  assertSmoke(pkg.scars.length === 1 && pkg.pressureChanges.length === 2, "scars and pressure changes are summarized safely");
  assertSmoke(pkg.pressureChanges.every((entry) => ["Hull", "Strain", "Lifeveil", "Morale", "Supplies"].includes(entry.resource)), "pressure changes use public resource names only");
  assertSmoke(pkg.outcomeSummary && pkg.gmReviewPrompts.length && pkg.playerSafeSummary, "deterministic summary fields are present");
  const json = snap(pkg);
  for (const forbidden of FORBIDDEN) assertSmoke(!json.includes(forbidden), `forbidden string ${forbidden} is absent`);
  for (const bait of BAIT) assertSmoke(!json.includes(bait), `hidden bait ${bait} is absent`);
  assertEqual(snap(prepareTravelV2FinalOutcomePackage(session)), snap(pkg), "helper is deterministic");
  assertEqual(snap(session), before, "helper does not mutate input");
  return { ok: true, checked: ["missing-session", "fixture-shape", "location-change", "public-hazards", "reviewable-aftermath", "safe-scars-pressure", "player-safety", "determinism", "immutability"] };
}

export default runTravelV2FinalOutcomeSmokeChecks;
