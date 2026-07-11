import { prepareTravelV2FinalOutcomePreservationApplyPlan } from "./travel-v2-final-outcome-preservation-apply-plan.js";

const FORBIDDEN_OUTPUT_NEEDLES = Object.freeze([
  "auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions", "hiddenHazards", "debugReport", "futureTriggers", "HIDDEN_BAIT_VALUE", "HIDDEN_ENTRY_BAIT", "Actor.", "User.", "Compendium."
]);
const ALLOWED_ACTION_TYPES = Object.freeze(["preserveCompletedEventRecord", "attachRewardToShip", "attachRouteAdvantageToShip", "attachFollowUpToShip", "attachScarToShip", "recordPressureChange"]);

function assert(condition, message) { if (!condition) throw new Error(`Travel v2 final outcome preservation apply plan smoke check failed: ${message}`); }
function snapshot(value) { return JSON.stringify(value); }
function assertNoForbiddenOutput(value) {
  const serialized = snapshot(value);
  for (const needle of FORBIDDEN_OUTPUT_NEEDLES) assert(!serialized.includes(needle), `forbidden output leaked: ${needle}`);
}

function fixtureSession() {
  return {
    status: "completed",
    completed: true,
    completedAt: "2026-07-11T12:34:56.000Z",
    eventKey: "ember-sky-arrival",
    eventName: "Ember Sky Arrival",
    route: { from: "Gullspire", to: "Aster Reef" },
    travelV2EventCompletion: { state: "resolved", completedAt: "2026-07-11T12:34:56.000Z" },
    finalOutcome: {
      summary: "The ship reaches Aster Reef with salvage, leverage, and lingering strain.",
      consequences: [{ name: "Storm debt", summary: "A local squall follows the route." }],
      rewards: [{ name: "Hull patch cache", summary: "Ship-relevant repair supplies recovered.", sourceType: "reward" }],
      clues: [{ name: "Old beacon code", summary: "A public signal pattern points onward." }],
      routeAdvantages: [{ name: "Tailwind lane", summary: "Future checks along this lane gain a public edge." }],
      followUps: [{ name: "Meet the reefwarden", summary: "A public lead awaits at dockside." }],
      pressureChanges: [{ key: "morale", value: 1 }, { resource: "hull", value: -1 }],
      hiddenOutcome: { summary: "HIDDEN_BAIT_VALUE", gmText: "HIDDEN_ENTRY_BAIT", targetActorUuid: "Actor.hidden" }
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
    applyPayload: { value: "HIDDEN_BAIT_VALUE" },
    userId: "User.HIDDEN_BAIT_VALUE",
    actorReference: "Actor.HIDDEN_BAIT_VALUE",
    compendiumReference: "Compendium.arcflight.hidden.HIDDEN_BAIT_VALUE"
  };
}

export function runTravelV2FinalOutcomePreservationApplyPlanSmokeChecks() {
  const checked = [];

  for (const missing of [null, undefined]) {
    const plan = prepareTravelV2FinalOutcomePreservationApplyPlan(missing);
    assert(plan.hasApplyPlan === false, "missing session should not create an apply plan");
    assert(plan.reviewOnly === true, "missing session plan should remain review-only");
    assert(plan.requiresExplicitGmApply === true, "missing session plan should require explicit GM apply");
    assert(plan.completedEventRecordAction === null, "missing session should not include a completed event action");
    assert(Array.isArray(plan.shipAttachmentActions) && plan.shipAttachmentActions.length === 0, "missing session should include empty ship attachment actions");
    assert(Array.isArray(plan.skippedCandidates) && plan.skippedCandidates.length === 0, "missing session should include empty skipped candidates");
    assertNoForbiddenOutput(plan);
  }
  checked.push("missing session safe shape");

  const session = fixtureSession();
  const before = snapshot(session);
  const plan = prepareTravelV2FinalOutcomePreservationApplyPlan(session);
  assert(plan.hasApplyPlan === true, "completed fixture should create an apply plan");
  assert(plan.reviewOnly === true, "completed fixture plan should be review-only");
  assert(plan.requiresExplicitGmApply === true, "completed fixture plan should require explicit GM apply");
  assert(plan.completedEventRecordAction, "completed fixture should include completed event record action");
  assert(plan.completedEventRecordAction.actionType === "preserveCompletedEventRecord", "completed event action should use the preserve action type");
  assert(Array.isArray(plan.shipAttachmentActions), "ship attachment actions should be an array");
  assert(plan.shipAttachmentActions.length >= 5, "completed fixture should create useful ship attachment actions");
  for (const action of [plan.completedEventRecordAction, ...plan.shipAttachmentActions]) {
    assert(action.reviewOnly === true, "actions should be review-only");
    assert(action.requiresExplicitGmApply === true, "actions should require explicit GM apply");
    assert(action.eligible === true, "actions should be marked eligible");
    assert(ALLOWED_ACTION_TYPES.includes(action.actionType), `unexpected action type: ${action.actionType}`);
  }
  assert(plan.actionCount === 1 + plan.shipAttachmentActions.length, "action count should match produced actions");
  assert(plan.skippedCandidates.some((candidate) => candidate.type === "clue"), "clues should be review-only skipped candidates rather than ship attachment actions");
  assertNoForbiddenOutput(plan);
  checked.push("completed fixture review-only apply plan");

  const again = prepareTravelV2FinalOutcomePreservationApplyPlan(session);
  assert(snapshot(plan) === snapshot(again), "apply plan should be deterministic");
  assert(snapshot(session) === before, "apply plan helper should not mutate its input");
  checked.push("determinism and immutability");

  return { checked };
}

export default runTravelV2FinalOutcomePreservationApplyPlanSmokeChecks;
