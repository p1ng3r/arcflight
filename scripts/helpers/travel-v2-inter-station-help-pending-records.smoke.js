import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareTravelV2InterStationHelpActions } from "./travel-v2-inter-station-help-actions.js";
import { prepareTravelV2InterStationHelpPendingRecord, TRAVEL_V2_INTER_STATION_HELP_PENDING_RECORDS_VERSION } from "./travel-v2-inter-station-help-pending-records.js";

const FORBIDDEN = ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions"];
const MUTATION_CALLS = [".update(", "setFlag", "unsetFlag", "ChatMessage.create", "JournalEntry.create", "game.settings.set", "socket.emit", "createEmbeddedDocuments", "updateEmbeddedDocuments", "deleteEmbeddedDocuments"];
function snap(value) { return JSON.stringify(value); }
function hasTerm(value, term) { return snap(value).includes(term); }
function assertPlayerSafe(value, label) { for (const term of FORBIDDEN) assert.equal(hasTerm(value, term), false, `${label} leaked ${term}`); }
function fixtureSession() {
  return {
    currentRoundIndex: 0,
    event: { key: "slice-02", rounds: [{ roundNumber: 1, activeStations: ["navigator", "engineer", "captain"], stationOrder: ["navigator", "engineer", "captain"], stationPrompts: { navigator: { stationName: "Navigator" }, engineer: { stationName: "Engineer" }, captain: { stationName: "Captain" } }, stationCards: [{ stationKey: "navigator", interStationHelp: [{ id: "nav-to-engineer", targetStationKey: "engineer", title: "Chart an Engine Line", publicText: "Show the Engineer a stable current.", tags: ["route"], criticalSuccessMetadata: { strengthening: "stronger-opening", gmText: "SECRET", applyPayload: { bad: true } } }, { id: "nav-back", targetStationKey: "navigator", title: "Self", publicText: "Bad." }] }, { stationKey: "captain", interStationHelp: [{ id: "captain-to-nav", targetStationKey: "navigator", title: "Too Late", publicText: "Earlier target." }] }] }] },
    roundResults: [{ stationResults: { navigator: null, engineer: null, captain: null }, stationOrderCommitments: { navigator: { committed: true }, engineer: { committed: true }, captain: { committed: true } } }]
  };
}

export default async function runTravelV2InterStationHelpPendingRecordsSmokeChecks() {
  const checked = [];
  assert.equal(TRAVEL_V2_INTER_STATION_HELP_PENDING_RECORDS_VERSION, 1);
  const session = fixtureSession();
  const before = snap(session);
  const actions = prepareTravelV2InterStationHelpActions(session, { includeUnavailable: true });
  const action = actions.helpActions.find((row) => row.actionId === "nav-to-engineer");
  assert.ok(action, "fixture should expose authored action");

  const normal = prepareTravelV2InterStationHelpPendingRecord(session, action, { result: "success", roundIndex: 0 });
  assert.equal(normal.ok, true);
  assert.equal(normal.record.pendingHelpKey, "inter-station-help:0:nav-to-engineer:navigator:engineer");
  assert.equal(normal.record.title, "Chart an Engine Line");
  assert.equal(normal.record.publicText, "Show the Engineer a stable current.");
  assert.equal(normal.record.sourceStationKey, "navigator");
  assert.equal(normal.record.targetStationKey, "engineer");
  assert.equal(normal.record.roundNumber, 1);
  assert.deepEqual(normal.record.tags, ["route"]);
  assert.equal(normal.record.authoredActionId, "nav-to-engineer");
  assert.equal(normal.record.applied, false);
  checked.push("normal success prepares deterministic pending record");

  const critical = prepareTravelV2InterStationHelpPendingRecord(session, { ...action, criticalSuccessMetadata: { strengthening: "stronger-opening", gmText: "SECRET", applyPayload: { bad: true } } }, { result: "criticalSuccess", roundIndex: 0 });
  assert.equal(critical.ok, true);
  assert.equal(critical.record.criticalSuccess, true);
  assert.equal(critical.record.criticalSuccessMetadata.strengthening, "stronger-opening");
  assertPlayerSafe(critical.record, "critical metadata record");
  checked.push("critical-success metadata is preserved safely without applying it");

  const malformed = prepareTravelV2InterStationHelpPendingRecord(session, {}, { result: "success", roundIndex: 0 });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.blockedReasons.includes("inter-station-help-action-required"), true);
  checked.push("malformed input is blocked deterministically");

  const earlier = actions.helpActions.find((row) => row.actionId === "captain-to-nav");
  const earlierResult = prepareTravelV2InterStationHelpPendingRecord(session, earlier, { result: "success", roundIndex: 0 });
  assert.equal(earlierResult.ok, false);
  assert.equal(earlierResult.blockedReasons.includes("target-station-not-later-in-order"), true);
  checked.push("earlier target is blocked");

  const inactive = prepareTravelV2InterStationHelpPendingRecord(session, { ...action, targetStationKey: "watchmaster" }, { result: "success", roundIndex: 0 });
  assert.equal(inactive.ok, false);
  assert.equal(inactive.blockedReasons.includes("inter-station-help-action-not-prepared-for-round"), true);
  checked.push("inactive target is blocked");

  const duplicate = prepareTravelV2InterStationHelpPendingRecord(session, action, { result: "success", roundIndex: 0, existingRecords: [normal.record] });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.blockedReasons.includes("duplicate-pending-inter-station-help-record"), true);
  checked.push("duplicate preparation returns stable duplicate reason");

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
