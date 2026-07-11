import { applyTravelV2FinalOutcomePreservationToRunnerSession } from "./travel-v2-final-outcome-preservation-session-application.js";

const FORBIDDEN_OUTPUT_NEEDLES = Object.freeze([
  "auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions", "hiddenHazards", "debugReport", "futureTriggers", "HIDDEN_BAIT_VALUE", "HIDDEN_ENTRY_BAIT", "Actor.", "User.", "Compendium."
]);

function assert(condition, message) { if (!condition) throw new Error(`Travel v2 final outcome preservation session application smoke check failed: ${message}`); }
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
    eventCategory: "arrival",
    route: { from: "Gullspire", to: "Aster Reef" },
    travelV2EventCompletion: { state: "resolved", completedAt: "2026-07-11T12:34:56.000Z" },
    finalOutcome: {
      summary: "The ship reaches Aster Reef with salvage, leverage, and lingering strain.",
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

export function runTravelV2FinalOutcomePreservationSessionApplicationSmokeChecks() {
  const checked = [];
  for (const missing of [null, undefined]) {
    const result = applyTravelV2FinalOutcomePreservationToRunnerSession(missing, { appliedAt: "2026-07-11T00:00:00.000Z" });
    assert(result.ok === false, "missing session should be blocked");
    assert(result.applied === false, "missing session should not be applied");
    assert(result.blockedReasons.length > 0, "missing session should include a blocked reason");
    assertNoForbiddenOutput(result);
  }
  checked.push("missing session safe blocked output");

  const session = fixtureSession();
  const before = snapshot(session);
  const result = applyTravelV2FinalOutcomePreservationToRunnerSession(session, { appliedAt: "2026-07-11T13:00:00.000Z" });
  assert(result.ok === true, "completed fixture should apply session-local preservation");
  assert(result.applied === true, "completed fixture should report applied");
  assert(result.session !== session, "returned session should be a cloned object");
  assert(result.originalSession !== session, "original session output should be a safe preserved clone");
  assert(snapshot(session) === before, "helper should not mutate the input fixture");
  assert(result.session.travelV2FinalOutcomePreservationApplication?.applied === true, "returned session should include applied application record");
  assert(result.applicationRecord.completedEventRecordAction, "application record should include completed event record action");
  assert(Array.isArray(result.applicationRecord.shipAttachmentActions), "application record should include ship attachment actions");
  assert(Array.isArray(result.applicationRecord.skippedCandidates), "application record should include skipped candidates");
  assert(result.applicationRecord.actionCount === result.applyPlan.actionCount, "application action count should match the apply plan");
  assert(result.applicationRecord.safetyNote, "application record should include a safety note");
  assert(Array.isArray(result.applicationRecord.gmReviewPrompts), "application record should include GM review prompts");
  assertNoForbiddenOutput(result);
  checked.push("completed fixture session-local application");

  const duplicate = applyTravelV2FinalOutcomePreservationToRunnerSession(result.session, { appliedAt: "2026-07-11T13:00:00.000Z" });
  assert(duplicate.ok === false, "duplicate application should be blocked");
  assert(duplicate.applied === false, "duplicate application should not be applied");
  assert(duplicate.blockedReasons.includes("Travel v2 final outcome preservation has already been applied to this runner session."), "duplicate blocked reason should explain preservation was already applied");
  assertNoForbiddenOutput(duplicate);
  checked.push("duplicate protection");

  const first = applyTravelV2FinalOutcomePreservationToRunnerSession(fixtureSession(), { now: "2026-07-11T13:00:00.000Z" });
  const second = applyTravelV2FinalOutcomePreservationToRunnerSession(fixtureSession(), { now: "2026-07-11T13:00:00.000Z" });
  assert(snapshot(first) === snapshot(second), "fixed timestamp applications should be deterministic");
  assert(snapshot(session) === before, "fixture should remain unchanged after all helper calls");
  checked.push("determinism and immutability");

  return { checked };
}

export default runTravelV2FinalOutcomePreservationSessionApplicationSmokeChecks;
