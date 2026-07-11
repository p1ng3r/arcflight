import { prepareTravelV2FinalOutcomePreservationActorPreview } from "./travel-v2-final-outcome-preservation-actor-preview.js";

const FORBIDDEN_OUTPUT_NEEDLES = Object.freeze([
  "auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions", "hiddenHazards", "debugReport", "futureTriggers", "HIDDEN_BAIT_VALUE", "HIDDEN_ENTRY_BAIT", "Actor.", "User.", "Compendium.", "updateData", "actor.update"
]);
const SAFE_ROW_KEYS = Object.freeze(["previewType", "actionType", "label", "summary", "source", "reviewOnly", "requiresExplicitGmApply", "eligible"]);

function assert(condition, message) { if (!condition) throw new Error(`Travel v2 final outcome preservation actor preview smoke check failed: ${message}`); }
function snapshot(value) { return JSON.stringify(value); }
function assertNoForbiddenOutput(value) {
  const serialized = snapshot(value);
  for (const needle of FORBIDDEN_OUTPUT_NEEDLES) assert(!serialized.includes(needle), `forbidden output leaked: ${needle}`);
}
function assertSafeRows(rows) {
  for (const row of rows) {
    for (const key of Object.keys(row)) assert(SAFE_ROW_KEYS.includes(key), `unsafe preview row key: ${key}`);
    assert(!Object.hasOwn(row, "updateData"), "preview row should not include updateData");
  }
}
function actor() {
  return {
    id: "ship-1",
    uuid: "Actor.hidden-ship-uuid",
    name: "Asterwake",
    type: "vehicle",
    update: () => { throw new Error("actor.update must not be called"); },
    flags: {
      arcflight: {
        enabled: true,
        actorType: "ship",
        system: {
          current: { hull: 20, strain: 2, lifeveil: 5, morale: 4 },
          resources: { supplies: 6 },
          cargo: { used: 2 }
        }
      }
    }
  };
}
function fixtureSession() {
  return {
    id: "session-1",
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
    userName: "HIDDEN_ENTRY_BAIT",
    actorReference: "Actor.HIDDEN_BAIT_VALUE",
    compendiumReference: "Compendium.arcflight.hidden.HIDDEN_BAIT_VALUE"
  };
}

export function runTravelV2FinalOutcomePreservationActorPreviewSmokeChecks() {
  const checked = [];
  for (const missing of [null, undefined]) {
    const preview = prepareTravelV2FinalOutcomePreservationActorPreview(missing, actor(), { appliedAt: "2026-07-11T13:00:00.000Z" });
    assert(preview.canPreview === false, "missing session should not preview");
    assert(preview.previewDisabled === true, "missing session should disable preview");
    assert(preview.blockedReasons.length > 0, "missing session should include blocked reason");
    assertNoForbiddenOutput(preview);
  }
  checked.push("missing session safe blocked output");

  const noActor = prepareTravelV2FinalOutcomePreservationActorPreview(fixtureSession(), null, { appliedAt: "2026-07-11T13:00:00.000Z" });
  assert(noActor.canPreview === false, "missing actor should not preview");
  assert(noActor.previewDisabled === true, "missing actor should disable preview");
  assert(noActor.blockedReason === "A PF2E vehicle / Arcflight ship actor is required.", "missing actor reason should require ship actor");
  assertNoForbiddenOutput(noActor);
  checked.push("missing actor blocked output");

  const unsupported = prepareTravelV2FinalOutcomePreservationActorPreview(fixtureSession(), { id: "npc-1", name: "Not a Ship", type: "npc" }, { appliedAt: "2026-07-11T13:00:00.000Z" });
  assert(unsupported.canPreview === false, "unsupported actor should not preview");
  assert(unsupported.previewDisabled === true, "unsupported actor should disable preview");
  assert(unsupported.blockedReasons.includes("A PF2E vehicle / Arcflight ship actor is required."), "unsupported reason should require ship actor");
  assertNoForbiddenOutput(unsupported);
  checked.push("unsupported actor blocked output");

  const session = fixtureSession();
  const ship = actor();
  const beforeSession = snapshot(session);
  const beforeActor = snapshot(ship);
  const preview = prepareTravelV2FinalOutcomePreservationActorPreview(session, ship, { appliedAt: "2026-07-11T13:00:00.000Z" });
  assert(preview.canPreview === true, "supported ship should preview");
  assert(preview.previewDisabled === false, "supported ship should not disable preview");
  assert(preview.targetActor.id === "ship-1", "target actor id should be included");
  assert(preview.targetActor.name === "Asterwake", "target actor name should be included");
  assert(preview.targetActor.type === "vehicle", "target actor type should be included");
  assert(!snapshot(preview).includes("hidden-ship-uuid"), "actor uuid should not be exposed");
  assert(preview.completedEventRecordPreview, "completed event record preview should exist");
  assert(Array.isArray(preview.shipAttachmentPreviews), "ship attachment previews should be an array");
  assert(Array.isArray(preview.pressureChangePreviews), "pressure change previews should be an array");
  assert(Array.isArray(preview.manualReviewItems), "manual review items should be an array");
  assertSafeRows([preview.completedEventRecordPreview, ...preview.shipAttachmentPreviews, ...preview.pressureChangePreviews]);
  assert(!snapshot(preview).includes("updateData"), "preview should not include updateData");
  assert(!snapshot(preview).includes("actor.update"), "preview should not include actor update calls");
  assertNoForbiddenOutput(preview);
  assert(snapshot(session) === beforeSession, "session should not mutate");
  assert(snapshot(ship) === beforeActor, "actor should not mutate");
  checked.push("supported Arcflight ship safe preview and immutability");

  const first = prepareTravelV2FinalOutcomePreservationActorPreview(fixtureSession(), actor(), { now: "2026-07-11T13:00:00.000Z" });
  const second = prepareTravelV2FinalOutcomePreservationActorPreview(fixtureSession(), actor(), { now: "2026-07-11T13:00:00.000Z" });
  assert(snapshot(first) === snapshot(second), "fixed timestamp previews should be deterministic");
  assertNoForbiddenOutput(first);
  checked.push("determinism");

  return { checked };
}

export default runTravelV2FinalOutcomePreservationActorPreviewSmokeChecks;
