import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRAVEL_V2_PENDING_STATION_BENEFIT_QUEUE_VERSION, normalizeTravelV2PendingStationBenefitQueueInput, prepareTravelV2PendingStationBenefitQueueItems, prepareTravelV2PendingStationBenefitPlayerState, prepareTravelV2PendingStationBenefitGmState, applyTravelV2PendingStationBenefitQueueToRenderState } from "./travel-v2-pending-station-benefit-queue.js";

const FORBIDDEN = ["gm" + "Text", "gm" + "Summary", "gm" + "MechanicalNotes", "gm" + "Review", "explicit" + "GmApplyEffect", "session" + "LocalEffect", "internal" + "Mutation", "target" + "ActorId", "target" + "ActorUuid", "apply" + "Payload", "before", "after", "queue" + "Internals"];
const MUTATION_CALLS = [".update(", "set" + "Flag", "unset" + "Flag", "Chat" + "Message.create", "Journal" + "Entry.create", "game.settings.set", "socket.emit", "canvas.scene", "createEmbeddedDocuments", "updateEmbeddedDocuments", "deleteEmbeddedDocuments", ".combat", ".token"];
function hasKey(value, key) { if (!value || typeof value !== "object") return false; if (Object.hasOwn(value, key)) return true; return Object.values(value).some((entry) => Array.isArray(entry) ? entry.some((item) => hasKey(item, key)) : hasKey(entry, key)); }
function assertNoForbidden(value, label) { for (const key of FORBIDDEN) assert.equal(hasKey(value, key), false, `${label} must not include ${key}`); }
function snap(value) { return JSON.stringify(value); }
function assertInert(row) { assert.equal(row.reviewOnly, true); assert.equal(row.applyAvailable, false); assert.equal(row.useAvailable, false); assert.equal(row.applied, false); assert.equal(row.used, false); assert.equal(row.dismissed, false); assert.equal(row.stationCheckMutated, false); assert.equal(row.rollMutated, false); assert.equal(row.checkPreviewMutated, false); assert.equal(row.persistentMutation.available, false); }

export default async function runTravelV2PendingStationBenefitQueueSmokeChecks() {
  const checked = [];
  assert.equal(TRAVEL_V2_PENDING_STATION_BENEFIT_QUEUE_VERSION, 1);
  for (const fn of [normalizeTravelV2PendingStationBenefitQueueInput, prepareTravelV2PendingStationBenefitQueueItems, prepareTravelV2PendingStationBenefitPlayerState, prepareTravelV2PendingStationBenefitGmState, applyTravelV2PendingStationBenefitQueueToRenderState]) assert.equal(typeof fn, "function");
  checked.push("helper imports");

  const circularUser = { isGM: true, id: "gm-secret-user-id" };
  circularUser.self = circularUser;
  const normalizedWithCircularUser = normalizeTravelV2PendingStationBenefitQueueInput(
    { pendingStationBenefits: [] },
    { user: circularUser, includeGmReview: true }
  );
  assert.deepEqual(normalizedWithCircularUser.user, { isGM: true });
  assert.equal(normalizedWithCircularUser.includeGmReview, true);
  checked.push("normalization snapshots user safely without cloning full Foundry user object");

  const empty = prepareTravelV2PendingStationBenefitPlayerState({}, { user: { isGM: false } });
  assert.equal(empty.status, "empty");
  assert.equal(empty.totalCount, 0);
  assert.equal(empty.pendingCount, 0);
  checked.push("empty input returns ready empty counts of zero");

  const input = { stations: [{ stationKey: "navigator", stationName: "Navigator" }, { stationKey: "engineer", label: "Engineer" }], pendingStationBenefits: [{ id: "benefit-1", sourceId: "combo-1", sourceCardId: "nav-open", benefitCardId: "eng-boost", title: "Clear Shot", sourceStation: "navigator", targetStation: "engineer", benefitKind: "dcReduction", magnitude: 2, expires: "afterUse", publicText: "Engineer gets an opening.", playerSafeSummary: "Reduce one Engineer DC.", gmText: "GM secret", gmSummary: "hidden", gmMechanicalNotes: { ["apply" + "Payload"]: { bad: true } }, ["apply" + "Payload"]: { bad: true }, queueInternals: { bad: true } }] };
  const player = prepareTravelV2PendingStationBenefitPlayerState(input, { user: { isGM: false } });
  assert.equal(player.status, "ready");
  assert.equal(player.totalCount, 1);
  assert.equal(player.rows[0].queueKey, "benefit-1");
  assert.equal(player.rows[0].sourceStationLabel, "Navigator");
  assert.equal(player.rows[0].targetStationLabel, "Engineer");
  assert.equal(player.rows[0].benefitKind, "dcReduction");
  assertNoForbidden(player, "player-safe benefit state");
  assertInert(player.rows[0]);
  checked.push("valid benefit normalizes into player-safe row with station labels and inert flags");

  const gmNoReview = prepareTravelV2PendingStationBenefitGmState(input, { user: { isGM: true }, includeGmReview: false });
  assert.equal(hasKey(gmNoReview, "gmReview"), false);
  const gmReview = prepareTravelV2PendingStationBenefitGmState(input, { user: { isGM: true }, includeGmReview: true });
  assert.equal(hasKey(gmReview, "gmReview"), true);
  const nonGmReview = prepareTravelV2PendingStationBenefitGmState(input, { user: { isGM: false }, includeGmReview: true });
  assert.equal(hasKey(nonGmReview, "gmReview"), false);
  assertNoForbidden(nonGmReview, "non-GM queue state");
  checked.push("GM review is gated by GM-like user and includeGmReview");

  const malformed = prepareTravelV2PendingStationBenefitPlayerState({ pendingStationBenefits: [{}] });
  assert.equal(malformed.rows[0].status, "blocked");
  assert.equal(malformed.blockedCount, 1);
  checked.push("malformed empty record becomes blocked without throwing");

  const before = snap(input);
  const applied = applyTravelV2PendingStationBenefitQueueToRenderState({ marker: true, travelV2PendingStationBenefits: input.pendingStationBenefits, stations: input.stations }, {}, { user: { isGM: true }, includeGmReview: true });
  assert.equal(snap(input), before);
  applied.travelV2PendingStationBenefitPlayerState.rows[0].title = "Mutated";
  assert.equal(input.pendingStationBenefits[0].title, "Clear Shot");
  checked.push("clone safety preserves source input when returned state is mutated");

  const dupes = prepareTravelV2PendingStationBenefitPlayerState({ pendingStationBenefits: [{ queueKey: "same", title: "One", publicText: "A" }, { queueKey: "same", title: "Two", publicText: "B" }] });
  assert.equal(dupes.totalCount, 1);
  checked.push("duplicate queue keys are deduped");

  const source = readFileSync(new URL("./travel-v2-pending-station-benefit-queue.js", import.meta.url), "utf8");
  for (const token of MUTATION_CALLS) assert.equal(source.includes(token), false, `source must not include ${token}`);
  checked.push("source scan has no forbidden mutation calls");
  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2PendingStationBenefitQueueSmokeChecks().then((result) => { console.log("Travel v2 pending station benefit queue smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
