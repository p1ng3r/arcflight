import { prepareTravelV2FinalOutcomePreservationPlan } from "./travel-v2-final-outcome-preservation.js";

const FORBIDDEN_OUTPUT_NEEDLES = Object.freeze([
  "auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions", "hiddenHazards", "debugReport", "futureTriggers", "HIDDEN_BAIT_VALUE", "HIDDEN_ENTRY_BAIT", "Actor.", "User.", "Compendium."
]);
const PUBLIC_CANDIDATE_TYPES = Object.freeze(["reward", "routeAdvantage", "followUp", "scar", "pressureChange"]);

function assert(condition, message) { if (!condition) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function assertEmptyArrays(plan) {
  for (const key of ["shipAttachmentCandidates", "rewardCandidates", "clueCandidates", "routeAdvantageCandidates", "followUpCandidates", "scarCandidates", "pressureChangeCandidates", "gmReviewPrompts"]) {
    assert(Array.isArray(plan[key]), `${key} should be an array.`);
    assert(plan[key].length === 0, `${key} should be empty.`);
  }
}
function assertNoForbiddenOutput(value) {
  const serialized = JSON.stringify(value);
  for (const needle of FORBIDDEN_OUTPUT_NEEDLES) assert(!serialized.includes(needle), `Preservation output leaked forbidden value: ${needle}`);
}

function fixtureSession() {
  return {
    status: "completed",
    completed: true,
    completedAt: "2026-07-11T12:34:56.000Z",
    eventKey: "sky-reef-arrival",
    eventName: "Sky Reef Arrival",
    route: { from: "Gullspire", to: "Aster Reef" },
    travelV2EventCompletion: { state: "resolved", completedAt: "2026-07-11T12:34:56.000Z" },
    finalOutcome: {
      summary: "The ship reaches Aster Reef with useful salvage and tense skies.",
      consequences: [{ name: "Storm debt", summary: "A local squall follows the route." }],
      rewards: [{ name: "Hull patch cache", summary: "Ship-relevant repair supplies recovered.", sourceType: "reward" }],
      clues: [{ name: "Old beacon code", summary: "A public signal pattern points onward." }],
      routeAdvantages: [{ name: "Tailwind lane", summary: "Future checks along this lane gain a public edge." }],
      followUps: [{ name: "Meet the reefwarden", summary: "A public lead awaits at dockside." }],
      pressureChanges: [{ key: "morale", value: 1 }],
      hiddenOutcome: { summary: "HIDDEN_BAIT_VALUE", gmText: "HIDDEN_ENTRY_BAIT" }
    },
    travelV2Hazards: {
      records: [
        { id: "reef-lightning", name: "Reef Lightning", status: "active", revealed: true, playerVisible: true, summary: "Arcs still crown the reef." },
        { id: "concealed-reef", name: "HIDDEN_ENTRY_BAIT", status: "active", revealed: false, hidden: true, summary: "HIDDEN_BAIT_VALUE" }
      ],
      hiddenHazards: [{ name: "HIDDEN_BAIT_VALUE" }]
    },
    travelV2ShipScars: {
      records: [
        { id: "singed-rigging", name: "Singed Rigging", category: "rigging", severity: "minor", status: "open", playerText: "Rigging bears visible storm marks." },
        { id: "hidden-scar", name: "HIDDEN_ENTRY_BAIT", hidden: true, playerText: "HIDDEN_BAIT_VALUE" }
      ]
    },
    auditRecord: "HIDDEN_BAIT_VALUE",
    userId: "User.HIDDEN_BAIT_VALUE",
    actorReference: "Actor.HIDDEN_BAIT_VALUE",
    compendiumReference: "Compendium.arcflight.hidden.HIDDEN_BAIT_VALUE"
  };
}

export function runTravelV2FinalOutcomePreservationSmokeChecks() {
  const checked = [];

  for (const missing of [null, undefined]) {
    const plan = prepareTravelV2FinalOutcomePreservationPlan(missing);
    assert(plan.hasPlan === false, "Missing session should not create a preservation plan.");
    assert(plan.reviewOnly === true, "Missing session plan should remain review-only.");
    assert(plan.completedEventRecord === null, "Missing session should not include a completed record.");
    assertEmptyArrays(plan);
    assertNoForbiddenOutput(plan);
  }
  checked.push("missing session safe shape");

  const session = fixtureSession();
  const before = JSON.stringify(session);
  const plan = prepareTravelV2FinalOutcomePreservationPlan(session);
  assert(plan.hasPlan === true, "Completed fixture should create a preservation plan.");
  assert(plan.reviewOnly === true, "Completed fixture plan should be review-only.");
  assert(plan.completedEventRecord, "Completed fixture should include a completed event record.");
  assert(plan.completedEventRecord.locationChange.summary === "Gullspire → Aster Reef", "Completed record should include location change.");
  for (const key of ["consequences", "rewards", "clues", "routeAdvantages", "followUps", "scars", "pressureChanges"]) {
    assert(Array.isArray(plan.completedEventRecord[key]) && plan.completedEventRecord[key].length > 0, `Completed record should include ${key}.`);
  }
  for (const key of ["shipAttachmentCandidates", "rewardCandidates", "clueCandidates", "routeAdvantageCandidates", "followUpCandidates", "scarCandidates", "pressureChangeCandidates"]) assert(Array.isArray(plan[key]), `${key} should be an array.`);
  for (const candidate of plan.shipAttachmentCandidates) {
    assert(candidate.reviewOnly === true, "Ship attachment candidates should be review-only.");
    assert(PUBLIC_CANDIDATE_TYPES.includes(candidate.type), `Unexpected candidate type: ${candidate.type}`);
  }
  assertNoForbiddenOutput(plan);
  checked.push("completed fixture player-safe preservation plan");

  const again = prepareTravelV2FinalOutcomePreservationPlan(session);
  assert(JSON.stringify(plan) === JSON.stringify(again), "Preservation plan should be deterministic.");
  assert(JSON.stringify(session) === before, "Preservation helper should not mutate its input.");
  checked.push("determinism and immutability");

  return { checked };
}

export default runTravelV2FinalOutcomePreservationSmokeChecks;
