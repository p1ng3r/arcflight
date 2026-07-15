import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  mergeTravelV2InterStationHelpIntoPreviewPanel,
  prepareTravelEventRunnerAppStateWithTravelV2Preview,
  prepareTravelV2InterStationHelpCreateReviewState
} from "./travel-event-runner-v2-preview-consumer.js";
import { queueTravelV2InterStationHelpPendingRecord } from "../helpers/travel-v2-inter-station-help-pending-queue.js";

const snapshot = (value) => JSON.stringify(value);
const FORBIDDEN_PLAYER_TERMS = Object.freeze([
  "gmText",
  "gmSummary",
  "gmMechanicalNotes",
  "secret",
  "hiddenData",
  "applyPayload",
  "mutationPayload",
  "internalMutation",
  "targetActorId",
  "targetActorUuid",
  "actorUuid",
  "userId",
  "socketPayload",
  "auditRecord",
  "sessionPatch",
  "clonedSession"
]);

function fixtureSession() {
  return {
    status: "active",
    currentRoundIndex: 0,
    event: {
      key: "inter-station-help-runner-smoke",
      name: "Inter-Station Help Runner Smoke",
      category: "navigation",
      baseDC: 20,
      roundCount: 1,
      rounds: [{
        roundNumber: 1,
        title: "Thread the Wreckage",
        activeStations: ["navigator", "engineer", "captain"],
        stationOrder: ["navigator", "engineer", "captain"],
        stationCards: [
          {
            stationKey: "navigator",
            interStationHelp: [{
              id: "plot-engineer-opening",
              targetStationKey: "engineer",
              title: "Plot an Engine Opening",
              publicText: "Mark a stable line that the Engineer can exploit.",
              tags: ["route", "opening"],
              gmText: "SECRET",
              applyPayload: { forbidden: true }
            }]
          },
          {
            stationKey: "engineer",
            helpActions: [{
              id: "steady-command-deck",
              targetStationKey: "captain",
              title: "Steady the Command Deck",
              publicText: "Bleed off vibration before the Captain acts.",
              tags: ["systems"]
            }]
          },
          {
            stationKey: "captain",
            supportActions: [{
              id: "backward-order-help",
              targetStationKey: "navigator",
              title: "Too-Late Course Order",
              publicText: "This target is earlier in the locked order."
            }]
          }
        ],
        stationPrompts: {
          navigator: { stationKey: "navigator", stationName: "Navigator", playerAction: "Plot the route.", suggestedSkills: ["piloting-lore"] },
          engineer: { stationKey: "engineer", stationName: "Engineer", playerAction: "Stabilize the drive.", suggestedSkills: ["crafting"] },
          captain: { stationKey: "captain", stationName: "Captain", playerAction: "Commit the crew.", suggestedSkills: ["diplomacy"] }
        }
      }]
    },
    roundResults: [{
      roundIndex: 0,
      stationResults: { navigator: "success", engineer: "criticalSuccess", captain: null },
      stationOrderCommitments: {
        navigator: { committed: true },
        engineer: { committed: true },
        captain: { committed: true }
      }
    }],
    travelV2PendingStationBenefits: [{
      queueKey: "existing-benefit",
      title: "Existing Pending Benefit",
      sourceStation: "navigator",
      targetStation: "engineer",
      status: "pending",
      publicText: "An existing reviewed benefit remains visible.",
      playerSafeSummary: "Existing pending benefit summary.",
      gmText: "SECRET BENEFIT",
      applyPayload: { forbidden: true }
    }]
  };
}

function assertPlayerSafe(value, label) {
  const serialized = snapshot(value);
  for (const term of FORBIDDEN_PLAYER_TERMS) {
    assert.equal(serialized.includes(term), false, `${label} leaked ${term}`);
  }
}

export default async function runTravelEventRunnerV2InterStationHelpSmokeChecks() {
  const checked = [];
  const sideEffects = [];
  const prior = {
    Actor: globalThis.Actor,
    Item: globalThis.Item,
    ChatMessage: globalThis.ChatMessage,
    JournalEntry: globalThis.JournalEntry,
    game: globalThis.game,
    socket: globalThis.socket
  };
  globalThis.Actor = { updateDocuments: () => sideEffects.push("actors") };
  globalThis.Item = { updateDocuments: () => sideEffects.push("items") };
  globalThis.ChatMessage = { create: () => sideEffects.push("chat") };
  globalThis.JournalEntry = { create: () => sideEffects.push("journal") };
  globalThis.game = { user: { isGM: false }, settings: { set: () => sideEffects.push("settings") }, socket: { emit: () => sideEffects.push("socket") } };
  globalThis.socket = { emit: () => sideEffects.push("socket") };

  try {
    const session = fixtureSession();
    const before = snapshot(session);
    const state = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session, user: { isGM: false } });

    assert.ok(state.travelV2InterStationHelpActions, "runner exposes the long Inter-Station Help alias");
    assert.ok(state.interStationHelpActions, "runner exposes the short Inter-Station Help alias");
    assert.equal(snapshot(state.travelV2InterStationHelpActions), snapshot(state.interStationHelpActions), "runner aliases expose equivalent player-safe state");
    assert.equal(state.interStationHelpActions.applied, false, "runner help action state remains unapplied");
    assert.equal(state.interStationHelpActions.helpActionCount, 2, "only valid later-station help actions are surfaced");
    assert.equal(state.interStationHelpActions.availableHelpActionCount, 2, "both surfaced help actions are currently available");
    assert.equal(state.interStationHelpActions.helpActions.some((row) => row.actionId === "backward-order-help"), false, "earlier-target help is not surfaced by default");
    checked.push("runner aliases expose current player-safe help options");

    const display = state.travelV2PreviewPanel.stationBenefitDisplay;
    assert.equal(display.title, "Inter-Station Help", "runner panel presents Inter-Station Help as its own player-facing system");
    assert.equal(display.subtitle, "Help options only — no assist has been created yet.", "non-GM runner panel includes the read-only safety copy");
    assert.equal(display.helpOptionCount, 2, "runner panel reports authored help option count");
    assert.equal(display.pendingBenefitCount, 1, "runner panel preserves existing pending station benefits");
    assert.equal(display.rows.length, 3, "runner panel combines help options with existing benefit visibility without dropping either");
    assert.equal(display.rows.filter((row) => row.helpOptionOnly === true).length, 2, "authored options are marked as option-only rows");
    assert.equal(display.rows.filter((row) => row.helpOptionOnly === true).every((row) => row.canReview === false && row.canQueue !== true && row.applied === false), true, "non-GM help option rows expose no create/use/apply/queue action");
    assert.equal(display.rows.some((row) => row.title === "Existing Pending Benefit"), true, "existing pending benefit row remains visible");
    checked.push("Inter-Station Help panel preserves pending benefit display while non-GM remains option-only");

    const gmState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session, user: { isGM: true } });
    const gmDisplay = gmState.travelV2PreviewPanel.stationBenefitDisplay;
    assert.equal(gmDisplay.subtitle, "Review an available help option, then explicitly queue it for a later station.", "GM runner panel describes review then explicit queue");
    const gmHelpRows = gmDisplay.rows.filter((row) => row.helpOptionOnly === true);
    assert.equal(gmHelpRows.length, 2, "GM sees the canonical authored help rows");
    assert.equal(gmHelpRows.every((row) => row.canReview === true), true, "GM rows expose Review Help for canonical available options");
    assert.equal(gmHelpRows.every((row) => row.canQueue !== true && row.canCreate !== true), true, "GM option rows do not expose direct queue/create controls");
    checked.push("GM option rows expose review only, not direct creation");

    const selected = { actionId: "plot-engineer-opening", sourceStationKey: "navigator", targetStationKey: "engineer", roundIndex: 0, resultBand: "criticalSuccess", title: "Spoofed" };
    const review = prepareTravelV2InterStationHelpCreateReviewState(session, gmState.interStationHelpActions, selected, { canReview: true });
    assert.equal(review.hasSelection, true, "selected review identity resolves action/source/target/round specifically");
    assert.equal(review.title, "Plot an Engine Opening", "review ignores spoofed title text");
    assert.equal(review.resultBand, "success", "review derives result from canonical session rather than spoofed UI state");
    assert.equal(review.queueable, true, "canonical success is queue-ready");
    assert.equal(session.travelV2PendingStationBenefits.length, 1, "review selection does not queue help");

    const unresolvedSession = fixtureSession();
    unresolvedSession.roundResults[0].stationResults.navigator = null;
    const unresolvedReview = prepareTravelV2InterStationHelpCreateReviewState(unresolvedSession, gmState.interStationHelpActions, selected, { canReview: true });
    assert.equal(unresolvedReview.queueable, false, "unresolved source result blocks queueing");
    assert.equal(unresolvedReview.blockedReasons.includes("inter-station-help-source-result-unresolved"), true, "unresolved block reason is safe and deterministic");
    const failureSession = fixtureSession();
    failureSession.roundResults[0].stationResults.navigator = "failure";
    assert.equal(prepareTravelV2InterStationHelpCreateReviewState(failureSession, gmState.interStationHelpActions, selected, { canReview: true }).queueable, false, "failure source result blocks queueing");
    const criticalFailureSession = fixtureSession();
    criticalFailureSession.roundResults[0].stationResults.navigator = "criticalFailure";
    assert.equal(prepareTravelV2InterStationHelpCreateReviewState(criticalFailureSession, gmState.interStationHelpActions, selected, { canReview: true }).queueable, false, "critical failure source result blocks queueing");

    const criticalSelected = { actionId: "steady-command-deck", sourceStationKey: "engineer", targetStationKey: "captain", roundIndex: 0 };
    const criticalReview = prepareTravelV2InterStationHelpCreateReviewState(session, gmState.interStationHelpActions, criticalSelected, { canReview: true });
    assert.equal(criticalReview.resultBand, "criticalSuccess", "critical-success review also derives from canonical session state");
    assert.equal(criticalReview.criticalSuccess, true, "critical-success review is marked without applying it");

    const action = gmState.interStationHelpActions.helpActions.find((row) => row.actionId === selected.actionId && row.sourceStationKey === selected.sourceStationKey && row.targetStationKey === selected.targetStationKey && row.roundIndex === selected.roundIndex);
    const queued = queueTravelV2InterStationHelpPendingRecord(session, action, { actionId: action.actionId, sourceStationKey: action.sourceStationKey, targetStationKey: action.targetStationKey, roundIndex: action.roundIndex, roundNumber: action.roundNumber, resultBand: review.resultBand }, { enqueueRequested: true });
    assert.equal(queued.queued, true, "explicit enqueue intent queues canonical help through Slice 03 helper");
    assert.equal(queued.session.travelV2PendingStationBenefits.length, 2, "queued session includes the new pending help and preserves unrelated pending rows");
    const rerendered = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: queued.session, user: { isGM: true } });
    assert.equal(rerendered.travelV2PreviewPanel.stationBenefitDisplay.pendingBenefitCount, 2, "queued help appears through existing pending station benefit projection after state rebuild");
    const duplicate = queueTravelV2InterStationHelpPendingRecord(queued.session, action, { actionId: action.actionId, sourceStationKey: action.sourceStationKey, targetStationKey: action.targetStationKey, roundIndex: action.roundIndex, roundNumber: action.roundNumber, resultBand: review.resultBand }, { enqueueRequested: true });
    assert.equal(duplicate.duplicate, true, "duplicate queue attempt reports duplicate safely");
    assert.equal(duplicate.queued, false, "duplicate queue attempt does not append another row");
    assert.equal(duplicate.session.travelV2PendingStationBenefits.length, 2, "duplicate safe session does not add a second pending benefit");
    checked.push("GM review and explicit queue flow honors canonical result and duplicate boundaries");

    assert.equal(snapshot(session), before, "runner help projection does not mutate the input session");
    assert.equal(sideEffects.length, 0, "runner help projection invokes no Foundry persistence or messaging APIs");
    assertPlayerSafe(state.interStationHelpActions, "Inter-Station Help aliases");
    assertPlayerSafe(display, "Inter-Station Help panel");
    checked.push("player projection is mutation-free and redacted");

    const panelInput = {
      stationBenefitDisplay: {
        title: "Station Benefits",
        subtitle: "Existing benefit review rows.",
        rows: [{ queueKey: "benefit", title: "Benefit", displaySummary: "Existing.", sourceStationLabel: "Navigator", targetStationLabel: "Engineer" }],
        hasRows: true
      }
    };
    const helpInput = state.interStationHelpActions;
    const panelBefore = snapshot(panelInput);
    const helpBefore = snapshot(helpInput);
    const merged = mergeTravelV2InterStationHelpIntoPreviewPanel(panelInput, helpInput);
    assert.notEqual(merged, panelInput, "panel merge returns a new panel object");
    assert.equal(snapshot(panelInput), panelBefore, "panel merge does not mutate the incoming panel");
    assert.equal(snapshot(helpInput), helpBefore, "panel merge does not mutate the prepared help state");
    assert.equal(merged.stationBenefitDisplay.helpOptionCount, 2, "direct panel merge carries help option count");
    checked.push("panel merge is clone-safe");

    const template = readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
    assert.equal(template.includes("state.travelV2PreviewPanel.stationBenefitDisplay.title"), true, "runner template renders the dynamic Inter-Station Help title");
    assert.equal(template.includes("state.travelV2PreviewPanel.stationBenefitDisplay.subtitle"), true, "runner template renders the required safety copy");
    assert.equal(template.includes("state.travelV2PreviewPanel.stationBenefitDisplay.rows"), true, "runner template renders the prepared help rows");
    assert.equal(template.includes("data-arcflight-travel-v2-inter-station-help-review"), true, "runner template renders the GM Review Help selector");
    assert.equal(template.includes("data-arcflight-travel-v2-inter-station-help-queue"), true, "runner template renders the explicit Queue Help selector only in review state");
    checked.push("runner template consumes the read-only Inter-Station Help display contract");

    return { ok: true, checked };
  } finally {
    globalThis.Actor = prior.Actor;
    globalThis.Item = prior.Item;
    globalThis.ChatMessage = prior.ChatMessage;
    globalThis.JournalEntry = prior.JournalEntry;
    globalThis.game = prior.game;
    globalThis.socket = prior.socket;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelEventRunnerV2InterStationHelpSmokeChecks()
    .then((result) => {
      console.log("Travel Event Runner v2 Inter-Station Help smoke checks passed.");
      for (const check of result.checked) console.log(`- ${check}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
