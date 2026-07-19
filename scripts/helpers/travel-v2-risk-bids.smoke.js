import {
  normalizeTravelV2RiskBidTier,
  prepareTravelV2RiskBidOptionsForStationAction,
  selectTravelV2RiskBidForRunnerSession,
  clearTravelV2RiskBidSelectionForRunnerSession
} from "./travel-v2-risk-bids.js";
import { prepareTravelV2RiskBidClearRunnerUpdate, prepareTravelV2RiskBidSelectRunnerUpdate } from "./travel-v2-risk-bid-runner-updates.js";

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
    assertEqual(JSON.stringify([2, 5, 8].map((tier) => normalizeTravelV2RiskBidTier(tier))), JSON.stringify([2, 5, 8]), "fixed numeric tiers normalize exactly to 2/5/8");
    for (const [input, expected] of [["2", 2], ["+2", 2], ["5", 5], ["+5", 5], ["8", 8], ["+8", 8]]) assertEqual(normalizeTravelV2RiskBidTier(input), expected, `string ${input} normalizes`);
    for (const tier of [0, 1, 3, 4, 6, 7, 9, 10, "high", "", null, undefined]) assertEqual(normalizeTravelV2RiskBidTier(tier), null, `invalid tier ${tier} is rejected`);

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
    for (const option of prepared.options) assertOnlyKeys(option, ["tier", "dcModifier", "label", "text", "isAllowed"], "prepared risk bid option exposes only player-safe fields");
    assertEqual(prepared.options.map((option) => option.label).join("|"), "Cut|Thread|Blind", "prepared options preserve safe authored labels in deterministic authored order");
    assertEqual(prepared.options.map((option) => option.text).join("|"), "Small risk.|Valid|Large risk.", "prepared options preserve safe authored text in deterministic authored order");
    assertSmoke(!snap(prepared).includes(snap(rawBid)) && !Object.hasOwn(prepared.options[1], "gmOnly"), "prepared output contains no raw input object dumps");
    assertNoForbiddenOutput(prepared, "prepared risk bid output");

    const containerKeys = ["version", "records"];
    const recordKeys = ["version", "selected", "roundIndex", "roundNumber", "stationKey", "actionId", "tier", "dcModifier", "selectedAt"];
    const original = {
      id: "session-1",
      currentRoundIndex: 0,
      roundPhase: "stationOrders",
      event: { rounds: [{ roundNumber: 1, activeStations: ["navigator"], stationPrompts: {} }] },
      roundResults: [{
        actionOrder: { roundIndex: 0, roundNumber: 1, status: "committed", committedStationKeys: ["navigator"] },
        stationActions: { navigator: { type: "eventApproach" } },
        travelV2RiskBidActions: { navigator: { actionId: "plot-course", riskBids: [{ tier: 2 }, { tier: 5 }, { tier: 8 }] } },
        stationOrderCommitments: { navigator: { committed: false } }
      }],
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
    const canonical = {
      currentRoundIndex: 0, roundPhase: "stationOrders",
      event: { rounds: [{ roundNumber: 1, activeStations: ["navigator"] }] },
      roundResults: [{ actionOrder: { roundIndex: 0, roundNumber: 1, status: "committed", committedStationKeys: ["navigator"] }, stationActions: { navigator: { type: "eventApproach" } }, travelV2RiskBidActions: { navigator: { actionId: "plot-course", riskBids: [{ tier: 5 }] } }, stationOrderCommitments: { navigator: { committed: false } } }]
    };
    const canonicalBefore = snap(canonical);
    const validCoupledSelection = selectTravelV2RiskBidForRunnerSession(canonical, { roundIndex: 0, stationKey: "navigator", actionId: "plot-course", tier: 5 }, { selectedAt: "fixed" });
    assertSmoke(validCoupledSelection.ok && validCoupledSelection.session !== canonical, "canonical pre-lock selection succeeds");
    const unauthoredTier = selectTravelV2RiskBidForRunnerSession(canonical, { roundIndex: 0, stationKey: "navigator", actionId: "plot-course", tier: 8 });
    assertSmoke(unauthoredTier.blocked && unauthoredTier.reasonCode === "risk-bid-tier-not-authored", "globally valid but unauthored tier is blocked");
    const lockedSession = JSON.parse(snap(validCoupledSelection.session));
    lockedSession.roundResults[0].stationOrderCommitments.navigator.committed = true;
    const lockedBefore = snap(lockedSession);
    const lockedRiskBids = { roundIndex: 0, roundNumber: 1, stationKey: "navigator", actionId: "plot-course" };
    for (const update of [prepareTravelV2RiskBidSelectRunnerUpdate(lockedSession, lockedRiskBids, 5), prepareTravelV2RiskBidClearRunnerUpdate(lockedSession, lockedRiskBids)]) {
      assertSmoke(update.nextSession === lockedSession && !update.shouldUpdateSession && !update.shouldRerender, "blocked risk-bid wrappers preserve the original session and skip rerender");
    }
    for (const operation of [
      () => selectTravelV2RiskBidForRunnerSession(lockedSession, { roundIndex: 0, stationKey: "navigator", actionId: "plot-course", tier: 8 }),
      () => clearTravelV2RiskBidSelectionForRunnerSession(lockedSession, { roundIndex: 0, stationKey: "navigator", actionId: "plot-course" })
    ]) {
      const blocked = operation();
      assertSmoke(blocked.blocked && blocked.reasonCode === "station-action-locked" && blocked.session === undefined && Object.isFrozen(blocked) && Object.isFrozen(blocked.planningGate), "locked risk-bid mutation is player-safe, frozen, and has no replacement session");
      assertEqual(snap(lockedSession), lockedBefore, "blocked lock mutation preserves session");
    }
    for (const badSession of [null, { ...canonical, roundPhase: "crewPlanning" }, { ...canonical, currentRoundIndex: 1 }, { ...canonical, roundResults: [{ ...canonical.roundResults[0], actionOrder: { ...canonical.roundResults[0].actionOrder, committedStationKeys: ["captain"] } }] }]) {
      const blocked = selectTravelV2RiskBidForRunnerSession(badSession, { roundIndex: 0, stationKey: "navigator", actionId: "plot-course", tier: 2 });
      assertSmoke(blocked.blocked && blocked.session === undefined, "authoritative planning gate blocks direct helper bypasses");
    }
    assertEqual(snap(canonical), canonicalBefore, "risk-bid gate failures do not mutate or create containers");
    assertEqual(sideEffects.length, 0, "risk bid helpers do not call actor, item, chat, journal, socket, or world mutation APIs");
  } finally {
    globalThis.Actor = prior.Actor;
    globalThis.Item = prior.Item;
    globalThis.ChatMessage = prior.ChatMessage;
    globalThis.JournalEntry = prior.JournalEntry;
    globalThis.game = prior.game;
  }

  return { ok: true, checked: ["risk-bid-alpha-closeout-tier-normalization", "risk-bid-alpha-closeout-invalid-tier-rejection", "risk-bid-alpha-closeout-prepared-option-sanitization", "risk-bid-alpha-closeout-prepared-deduplication", "risk-bid-alpha-closeout-session-selection-cloning", "risk-bid-alpha-closeout-selection-replacement", "risk-bid-alpha-closeout-selection-clearing", "risk-bid-alpha-closeout-blocked-selection-validation", "risk-bid-alpha-closeout-forbidden-output-guard", "risk-bid-alpha-closeout-no-side-effects", "risk-bid-authoritative-tier-rejection", "risk-bid-locked-wrapper-no-update-no-rerender", "risk-bid-planning-gate-direct-helper-blocks"] };
}

export default runTravelV2RiskBidsSmokeChecks;
