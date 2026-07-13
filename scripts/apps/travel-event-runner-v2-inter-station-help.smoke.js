import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  mergeTravelV2InterStationHelpIntoPreviewPanel,
  prepareTravelEventRunnerAppStateWithTravelV2Preview
} from "./travel-event-runner-v2-preview-consumer.js";

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
      stationResults: { navigator: null, engineer: null, captain: null },
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
    assert.equal(display.subtitle, "Help options only — no assist has been created yet.", "runner panel includes the required safety copy");
    assert.equal(display.helpOptionCount, 2, "runner panel reports authored help option count");
    assert.equal(display.pendingBenefitCount, 1, "runner panel preserves existing pending station benefits");
    assert.equal(display.rows.length, 3, "runner panel combines help options with existing benefit visibility without dropping either");
    assert.equal(display.rows.filter((row) => row.helpOptionOnly === true).length, 2, "authored options are marked as option-only rows");
    assert.equal(display.rows.filter((row) => row.helpOptionOnly === true).every((row) => row.canReview === false && row.applied === false), true, "help option rows expose no create/use/apply action");
    assert.equal(display.rows.some((row) => row.title === "Existing Pending Benefit"), true, "existing pending benefit row remains visible");
    checked.push("Inter-Station Help panel preserves pending benefit display while remaining option-only");

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
    assert.equal(template.includes("{{#if canReview}}<button"), true, "runner template only renders a review button when a row explicitly allows review");
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
