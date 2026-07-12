import {
  normalizeTravelV2RiskBidTier,
  prepareTravelV2RiskBidOptionsForStationAction,
  selectTravelV2RiskBidForRunnerSession,
  clearTravelV2RiskBidSelectionForRunnerSession
} from "./travel-v2-risk-bids.js";

const FORBIDDEN_OUTPUT_TERMS = Object.freeze([
  "gmOnly",
  "secret",
  "hiddenHazards",
  "unrevealedHazard",
  "futureTriggers",
  "internalScoring",
  "debugReport",
  "auditRecord",
  "applyPayload",
  "actor",
  "actorUuid",
  "targetActorUuid",
  "userId",
  "userName",
  "updateData",
  "actor.update",
  "ChatMessage",
  "JournalEntry",
  "socket",
  "Compendium.",
  "Actor.",
  "Item."
]);

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 risk bids smoke check failed: ${message}`);
}
function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`Travel v2 risk bids smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
}
function snap(value) { return JSON.stringify(value); }
function assertNoForbiddenOutput(value, message) {
  const serialized = snap(value);
  for (const term of FORBIDDEN_OUTPUT_TERMS) {
    assertSmoke(!serialized.includes(term), `${message}: leaked ${term}`);
  }
}
function assertOnlyKeys(object, allowedKeys, message) {
  const keys = Object.keys(object).sort();
  const allowed = [...allowedKeys].sort();
  assertEqual(keys.join(","), allowed.join(","), message);
}

export function runTravelV2RiskBidsSmokeChecks() {
  const sideEffects = [];
  const prior = { Actor: globalThis.Actor, Item: globalThis.Item, ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game };
  globalThis.Actor = { update: () => sideEffects.push("actor.update") };
  globalThis.Item = { create: () => sideEffects.push("Item.create") };
  globalThis.ChatMessage = { create: () => sideEffects.push("ChatMessage.create") };
  globalThis.JournalEntry = { create: () => sideEffects.push("JournalEntry.create") };
  globalThis.game = { socket: { emit: () => sideEffects.push("socket.emit") } };

  try {
    for (const tier of [2, 5, 8]) assertEqual(normalizeTravelV2RiskBidTier(tier), tier, `numeric ${tier} normalizes`);
    for (const tier of ["+2", "+5", "+8"]) assertEqual(normalizeTravelV2RiskBidTier(tier), Number(tier.slice(1)), `string ${tier} normalizes`);
    for (const tier of [0, 1, 3, 4, 6, 7, 9, 10, -2, "hard", "custom", ""]) assertEqual(normalizeTravelV2RiskBidTier(tier), null, `invalid tier ${tier} is rejected`);

    const rawBid = { tier: 5, label: "Thread", text: "Valid", gmOnly: true, secret: "do not expose" };
    const prepared = prepareTravelV2RiskBidOptionsForStationAction({
      stationKey: "navigator",
      stationName: "Navigator",
      actionId: "plot-course",
      actionName: "Plot Course",
      riskBids: [
        { tier: "+2", label: "Cut", text: "Small risk.", actorUuid: "bad" },
        rawBid,
        { tier: 3, label: "Invalid", text: "Drop me." },
        { tier: 5, label: "Duplicate", text: "Drop duplicate." },
        { tier: "+8", label: "Blind", text: "Large risk." }
      ]
    });
    assertSmoke(Object.isFrozen(prepared) && Object.isFrozen(prepared.options), "prepared output is frozen");
    assertEqual(prepared.hasRiskBids, true, "valid authored risk bids are available");
    assertEqual(prepared.options.length, 3, "invalid and duplicate risk bids are dropped");
    assertEqual(prepared.options.map((option) => option.tier).join(","), "2,5,8", "valid risk bid order is preserved");
    assertSmoke(prepared.options.every((option) => [2, 5, 8].includes(option.tier) && option.dcModifier === option.tier && option.isAllowed === true), "prepared options contain only fixed tiers");
    assertSmoke(!snap(prepared).includes(snap(rawBid)) && !Object.hasOwn(prepared.options[1], "gmOnly"), "prepared output contains no raw input object dumps");
    assertNoForbiddenOutput(prepared, "prepared risk bid output");

    const containerKeys = ["version", "records"];
    const recordKeys = ["version", "selected", "roundIndex", "roundNumber", "stationKey", "actionId", "tier", "dcModifier", "selectedAt"];
    const original = {
      id: "session-1",
      travelV2RiskBidSelections: {
        version: 99,
        gmOnly: true,
        secret: "container bait",
        actorUuid: "Actor.bad-container",
        userId: "user-bait",
        updateData: { bad: true },
        applyPayload: { bad: true },
        records: [
          {
            version: 1,
            selected: true,
            roundIndex: 1,
            roundNumber: null,
            stationKey: "pilot",
            actionId: "evade",
            tier: 2,
            dcModifier: 2,
            selectedAt: "t0",
            gmOnly: true,
            secret: "record bait",
            actorUuid: "Actor.bad-record",
            targetActorUuid: "Actor.target-bait",
            userId: "user-bait",
            userName: "gm-bait",
            updateData: { bad: true },
            applyPayload: { bad: true }
          },
          {
            roundIndex: 2,
            stationKey: "watchmaster",
            actionId: "bad-tier",
            tier: 9,
            secret: "drop me"
          }
        ]
      }
    };
    const before = snap(original);
    const selected = selectTravelV2RiskBidForRunnerSession(original, { roundIndex: 0, stationKey: "navigator", actionId: "plot-course", tier: "+5" }, { selectedAt: "2026-07-12T00:00:00.000Z" });
    assertSmoke(selected.ok && selected.selected, "valid selection succeeds");
    assertSmoke(selected.session !== original, "selecting clones the session");
    assertEqual(snap(original), before, "selecting does not mutate original session");
    assertEqual(selected.selectionRecord.tier, 5, "selection stores normalized tier");
    assertEqual(selected.selectionRecord.dcModifier, 5, "selection stores DC modifier");
    assertSmoke(!Object.hasOwn(selected.selectionRecord, "userId") && !Object.hasOwn(selected.selectionRecord, "actorUuid"), "selection record is safe and minimal");
    assertOnlyKeys(selected.session.travelV2RiskBidSelections, containerKeys, "returned risk bid container has only safe keys");
    assertEqual(selected.session.travelV2RiskBidSelections.records.length, 2, "malformed existing record is dropped while valid preserved record and new record remain");
    const preservedRecord = selected.session.travelV2RiskBidSelections.records.find((record) => record.stationKey === "pilot");
    assertSmoke(preservedRecord && preservedRecord.actionId === "evade" && preservedRecord.tier === 2, "existing preserved record remains functionally valid");
    assertOnlyKeys(preservedRecord, recordKeys, "preserved existing record has only safe keys");
    assertSmoke(!Object.hasOwn(preservedRecord, "gmOnly") && !Object.hasOwn(preservedRecord, "secret") && !Object.hasOwn(preservedRecord, "actorUuid"), "preserved existing record drops bait fields");
    assertNoForbiddenOutput(selected, "selection result");

    const replaced = selectTravelV2RiskBidForRunnerSession(selected.session, { roundIndex: 0, stationKey: "navigator", actionId: "plot-course", tier: 8 }, { selectedAt: "2026-07-12T00:00:01.000Z" });
    assertEqual(replaced.session.travelV2RiskBidSelections.records.filter((record) => record.stationKey === "navigator" && record.actionId === "plot-course").length, 1, "same round/station/action selection replaces previous record");
    assertEqual(replaced.session.travelV2RiskBidSelections.records.find((record) => record.stationKey === "navigator").tier, 8, "replacement stores new tier");

    const cleared = clearTravelV2RiskBidSelectionForRunnerSession(replaced.session, { roundIndex: 0, stationKey: "navigator", actionId: "plot-course" });
    assertSmoke(cleared.ok && cleared.cleared, "matching selected bid clears");
    assertEqual(cleared.session.travelV2RiskBidSelections.records.length, 1, "clearing removes only matching record");
    assertEqual(cleared.session.travelV2RiskBidSelections.records[0].stationKey, "pilot", "non-matching record remains");
    assertOnlyKeys(cleared.session.travelV2RiskBidSelections, containerKeys, "clear result risk bid container has only safe keys");
    assertOnlyKeys(cleared.session.travelV2RiskBidSelections.records[0], recordKeys, "clear result preserved record has only safe keys");
    assertNoForbiddenOutput(cleared, "clear result");

    for (const badSelection of [
      { roundIndex: 0, actionId: "plot-course", tier: 2 },
      { roundIndex: 0, stationKey: "navigator", tier: 2 },
      { stationKey: "navigator", actionId: "plot-course", tier: 2 },
      { roundIndex: 0, stationKey: "navigator", actionId: "plot-course", tier: 3 }
    ]) {
      const blocked = selectTravelV2RiskBidForRunnerSession({}, badSelection, { selectedAt: "fixed" });
      assertSmoke(!blocked.ok && blocked.blockedReasons.length > 0, "missing station/action/round/tier blocks safely");
      assertNoForbiddenOutput(blocked, "blocked selection result");
    }
    assertEqual(sideEffects.length, 0, "risk bid helpers do not call actor, item, chat, journal, socket, or world mutation APIs");
  } finally {
    globalThis.Actor = prior.Actor;
    globalThis.Item = prior.Item;
    globalThis.ChatMessage = prior.ChatMessage;
    globalThis.JournalEntry = prior.JournalEntry;
    globalThis.game = prior.game;
  }

  return { ok: true, checked: ["tier-normalization", "invalid-tier-rejection", "prepared-option-sanitization", "prepared-deduplication", "session-selection-cloning", "selection-replacement", "selection-clearing", "blocked-selection-validation", "forbidden-output-guard", "no-side-effects"] };
}

export default runTravelV2RiskBidsSmokeChecks;
