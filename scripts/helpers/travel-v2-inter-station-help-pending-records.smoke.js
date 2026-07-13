import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareTravelV2InterStationHelpActions } from "./travel-v2-inter-station-help-actions.js";
import { prepareTravelV2InterStationHelpPendingRecord, TRAVEL_V2_INTER_STATION_HELP_PENDING_RECORDS_VERSION } from "./travel-v2-inter-station-help-pending-records.js";

const FORBIDDEN = ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions", "gmNote", "actorId", "actorUuid", "hiddenHazardData", "resolverUserId", "rawTarget"];
const MUTATION_CALLS = [".update(", "setFlag", "unsetFlag", "ChatMessage.create", "JournalEntry.create", "game.settings.set", "socket.emit", "createEmbeddedDocuments", "updateEmbeddedDocuments", "deleteEmbeddedDocuments", "new Roll("];
function snap(value) { return JSON.stringify(value); }
function hasTerm(value, term) { return snap(value).includes(term); }
function assertPlayerSafe(value, label) { for (const term of FORBIDDEN) assert.equal(hasTerm(value, term), false, `${label} leaked ${term}`); }
function fixtureSession({ unlocked = false, currentRoundIndex = 0 } = {}) {
  const commitments = unlocked ? {} : { navigator: { committed: true }, engineer: { committed: true }, captain: { committed: true } };
  return {
    currentRoundIndex,
    event: { key: "slice-02", rounds: [0, 1].map((index) => ({ roundNumber: index + 1, activeStations: ["navigator", "engineer", "captain"], stationOrder: ["navigator", "engineer", "captain"], stationPrompts: { navigator: { stationName: `Navigator ${index + 1}` }, engineer: { stationName: `Engineer ${index + 1}` }, captain: { stationName: `Captain ${index + 1}` } }, stationCards: [{ stationKey: "navigator", interStationHelp: [{ id: "nav-to-engineer", targetStationKey: "engineer", title: `Chart an Engine Line R${index + 1}`, publicText: `Show the Engineer a stable current in round ${index + 1}.`, tags: ["route", `round-${index + 1}`], criticalSuccessMetadata: { strengthening: "stronger-opening", publicText: "Engineer gets a cleaner opening.", tags: ["critical"], gmText: "SECRET", applyPayload: { bad: true } } }] }, { stationKey: "captain", interStationHelp: [{ id: "captain-to-nav", targetStationKey: "navigator", title: "Too Late", publicText: "Earlier target." }] }] })) },
    roundResults: [0, 1].map(() => ({ stationResults: { navigator: null, engineer: null, captain: null }, stationOrderCommitments: commitments }))
  };
}
function selectedAction(session, roundIndex = 0, actionId = "nav-to-engineer") {
  return prepareTravelV2InterStationHelpActions(session, { includeUnavailable: true, roundIndex }).helpActions.find((row) => row.actionId === actionId);
}

export default async function runTravelV2InterStationHelpPendingRecordsSmokeChecks() {
  const checked = [];
  assert.equal(TRAVEL_V2_INTER_STATION_HELP_PENDING_RECORDS_VERSION, 1);
  const session = fixtureSession();
  const before = snap(session);
  const action = selectedAction(session, 0);
  assert.ok(action, "fixture should expose authored action");
  assert.equal(action.roundIndex, 0);
  assert.equal(action.roundNumber, 1);
  assert.equal(action.criticalSuccessMetadata.strengthening, "stronger-opening");
  assertPlayerSafe(action, "canonical prepared action");

  const normal = prepareTravelV2InterStationHelpPendingRecord(session, action, { result: "success", roundIndex: 0, sourceStationKey: "navigator", targetStationKey: "engineer", actionId: "nav-to-engineer" });
  assert.equal(normal.ok, true);
  assert.equal(normal.record.pendingHelpKey, "inter-station-help:0:nav-to-engineer:navigator:engineer");
  assert.equal(normal.record.title, "Chart an Engine Line R1");
  assert.equal(normal.record.publicText, "Show the Engineer a stable current in round 1.");
  assert.equal(normal.record.sourceStationName, "Navigator 1");
  assert.equal(normal.record.targetStationName, "Engineer 1");
  assert.deepEqual(normal.record.tags, ["route", "round-1"]);
  assert.equal(normal.record.authoredActionId, "nav-to-engineer");
  assert.equal(normal.record.applied, false);
  assert.equal(Object.hasOwn(normal.record, "criticalSuccessMetadata"), false);
  checked.push("normal success prepares deterministic pending record from canonical fields without activating critical metadata");

  const critical = prepareTravelV2InterStationHelpPendingRecord(session, action, { result: "criticalSuccess", roundIndex: 0 });
  assert.equal(critical.ok, true);
  assert.equal(critical.record.criticalSuccess, true);
  assert.equal(critical.record.criticalSuccessMetadata.strengthening, "stronger-opening");
  assert.equal(critical.record.criticalSuccessMetadata.publicText, "Engineer gets a cleaner opening.");
  assert.equal(critical.record.applied, false);
  assertPlayerSafe(critical.record, "critical metadata record");
  checked.push("canonical critical-success metadata is preserved safely and remains inert");

  const malformed = prepareTravelV2InterStationHelpPendingRecord(session, {}, { result: "success", roundIndex: 0 });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.blockedReasons.includes("inter-station-help-action-required"), true);
  checked.push("malformed input is blocked deterministically");

  const earlier = selectedAction(session, 0, "captain-to-nav");
  const earlierResult = prepareTravelV2InterStationHelpPendingRecord(session, earlier, { result: "success", roundIndex: 0 });
  assert.equal(earlierResult.ok, false);
  assert.equal(earlierResult.blockedReasons.includes("target-station-not-later-in-order"), true);
  checked.push("earlier target is blocked");

  const inactive = prepareTravelV2InterStationHelpPendingRecord(session, { ...action, targetStationKey: "watchmaster" }, { result: "success", roundIndex: 0 });
  assert.equal(inactive.ok, false);
  assert.equal(inactive.blockedReasons.includes("inter-station-help-action-not-prepared-for-round"), true);
  checked.push("inactive target is blocked");

  const duplicatePrivate = { ...normal.record, gmNote: "PRIVATE NOTE", actorId: "PRIVATE ACTOR", actorUuid: "Actor.private", hiddenHazardData: "SECRET HAZARD", resolverUserId: "PRIVATE USER", nested: { rawTarget: { secret: true } } };
  const duplicate = prepareTravelV2InterStationHelpPendingRecord(session, action, { result: "success", roundIndex: 0, existingRecords: [duplicatePrivate] });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.blockedReasons.includes("duplicate-pending-inter-station-help-record"), true);
  assert.equal(duplicate.existingRecord.pendingHelpKey, normal.record.pendingHelpKey);
  assert.equal(Object.hasOwn(duplicate.existingRecord, "gmNote"), false);
  assertPlayerSafe(duplicate, "duplicate result");
  checked.push("duplicate preparation returns stable reason and strict safe duplicate summary");

  const targetMismatch = prepareTravelV2InterStationHelpPendingRecord(session, action, { result: "success", roundIndex: 0, targetStationKey: "captain" });
  assert.equal(targetMismatch.ok, false);
  assert.equal(targetMismatch.blockedReasons.includes("inter-station-help-target-context-mismatch"), true);
  const sourceMismatch = prepareTravelV2InterStationHelpPendingRecord(session, action, { result: "success", roundIndex: 0, sourceStationKey: "captain" });
  assert.equal(sourceMismatch.ok, false);
  assert.equal(sourceMismatch.blockedReasons.includes("inter-station-help-source-context-mismatch"), true);
  const actionMismatch = prepareTravelV2InterStationHelpPendingRecord(session, action, { result: "success", roundIndex: 0, actionId: "different-action" });
  assert.equal(actionMismatch.ok, false);
  assert.equal(actionMismatch.blockedReasons.includes("inter-station-help-action-context-mismatch"), true);
  checked.push("target, source, and action context mismatches are blocked");

  const roundOneSession = fixtureSession({ currentRoundIndex: 1 });
  const stale = prepareTravelV2InterStationHelpPendingRecord(roundOneSession, action, { result: "success", roundIndex: 1 });
  assert.equal(stale.ok, false);
  assert.equal(stale.blockedReasons.includes("round-context-mismatch"), true);
  checked.push("cross-round stale selected actions are rejected even with repeated IDs and stations");

  const unlockedSession = fixtureSession({ unlocked: true });
  const unlockedAction = selectedAction(unlockedSession, 0);
  const unlocked = prepareTravelV2InterStationHelpPendingRecord(unlockedSession, unlockedAction, { result: "success", roundIndex: 0 });
  assert.equal(unlocked.ok, false);
  assert.equal(unlocked.blockedReasons.includes("station-order-not-locked"), true);
  checked.push("unlocked station order blocks pending record preparation");

  const spoofed = prepareTravelV2InterStationHelpPendingRecord(session, { ...action, title: "SECRET SPOOF", publicText: "SECRET TEXT", sourceStationName: "Fake Source", targetStationName: "Fake Target", tags: ["secret-tag"] }, { result: "success", roundIndex: 0 });
  assert.equal(spoofed.ok, true);
  assert.equal(spoofed.record.title, "Chart an Engine Line R1");
  assert.equal(spoofed.record.publicText, "Show the Engineer a stable current in round 1.");
  assert.equal(spoofed.record.sourceStationName, "Navigator 1");
  assert.equal(spoofed.record.targetStationName, "Engineer 1");
  assert.deepEqual(spoofed.record.tags, ["route", "round-1"]);
  assert.equal(hasTerm(spoofed, "SECRET SPOOF"), false);
  assert.equal(hasTerm(spoofed, "secret-tag"), false);
  checked.push("spoofed caller display fields are ignored in favor of canonical matched action values");

  assertPlayerSafe(normal, "normal result");
  assert.equal(Object.isFrozen(normal), true);
  assert.equal(Object.isFrozen(normal.record), true);
  assert.throws(() => { normal.record.title = "mutated"; }, TypeError);
  assert.equal(snap(session), before);
  checked.push("result is player-safe, deeply immutable, and input session is unchanged");

  const sideEffects = [];
  const prior = { Actor: globalThis.Actor, Item: globalThis.Item, ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game, socket: globalThis.socket };
  globalThis.Actor = { updateDocuments: () => sideEffects.push("actors") };
  globalThis.Item = { updateDocuments: () => sideEffects.push("items") };
  globalThis.ChatMessage = { create: () => sideEffects.push("chat") };
  globalThis.JournalEntry = { create: () => sideEffects.push("journal") };
  globalThis.game = { settings: { set: () => sideEffects.push("settings") }, socket: { emit: () => sideEffects.push("socket") } };
  globalThis.socket = { emit: () => sideEffects.push("socket") };
  prepareTravelV2InterStationHelpPendingRecord(session, action, { result: "success", roundIndex: 0 });
  Object.assign(globalThis, prior);
  assert.deepEqual(sideEffects, []);
  const source = readFileSync(new URL("./travel-v2-inter-station-help-pending-records.js", import.meta.url), "utf8");
  for (const token of MUTATION_CALLS) assert.equal(source.includes(token), false, `source must not include ${token}`);
  checked.push("no Foundry side effects or mutation API calls");
  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2InterStationHelpPendingRecordsSmokeChecks().then((result) => { console.log("Travel v2 inter-station help pending records smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
