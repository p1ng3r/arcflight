import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareTravelV2InterStationHelpActions, TRAVEL_V2_INTER_STATION_HELP_ACTIONS_VERSION } from "./travel-v2-inter-station-help-actions.js";

const snapshot = (value) => JSON.stringify(value);
const forbidden = ["gmText", "gmSummary", "gmMechanicalNotes", "applyPayload", "internalMutation", "targetActorUuid", "socketPayload", "sessionPatch", "clonedSession"];

function fixture(overrides = {}) {
  return {
    status: "active",
    currentRoundIndex: 0,
    event: {
      key: "inter-station-help-smoke",
      interStationHelp: [{ id: "captain-to-watch", sourceStationKey: "captain", targetStationKey: "watchmaster", title: "Call the Target", description: "Give the Watchmaster a clear priority.", tags: ["command"], gmText: "SECRET" }],
      rounds: [{
        roundNumber: 1,
        title: "Chain Storm",
        activeStations: ["navigator", "engineer", "captain", "watchmaster"],
        stationOrder: ["navigator", "engineer", "captain", "watchmaster"],
        stationCards: [
          { stationKey: "navigator", interStationHelp: [{ id: "plot-bypass", targetStationKey: "engineer", label: "Plot a Bypass", publicText: "Mark a stable line through the debris.", tags: ["route", "opening"], criticalSuccessMetadata: { strengthening: "stronger-opening", publicText: "Engineer gets a cleaner opening.", tags: ["critical"], gmText: "SECRET", applyPayload: { forbidden: true } }, applyPayload: { forbidden: true } }] },
          { stationKey: "engineer", helpActions: [{ id: "bleed-charge", targets: ["captain", "watchmaster"], title: "Bleed the Charge", text: "Reduce the noise so later stations can act.", tags: "systems, opening" }] },
          { stationKey: "watchmaster", supportActions: [{ id: "warn-navigator", targetStationKey: "navigator", title: "Late Warning", description: "This points backward in order." }] }
        ],
        stationPrompts: {
          navigator: { stationName: "Navigator" },
          engineer: { stationName: "Engineer", interStationHelp: [{ id: "brace-captain", targetStation: "captain", name: "Brace Command", helpText: "Give command a stable deck." }] },
          captain: { stationName: "Captain" },
          watchmaster: { stationName: "Watchmaster" }
        },
        helpActions: [{ id: "self-invalid", sourceStationKey: "captain", targetStationKey: "captain", title: "Self Help" }]
      }]
    },
    roundResults: [{
      roundIndex: 0,
      stationResults: { navigator: null, engineer: null, captain: null, watchmaster: null },
      stationOrderCommitments: {
        navigator: { committed: true }, engineer: { committed: true }, captain: { committed: true }, watchmaster: { committed: true }
      }
    }],
    ...overrides
  };
}

function assertSafe(value) {
  const serialized = snapshot(value);
  for (const key of forbidden) assert.equal(serialized.includes(key), false, `player-safe output leaked ${key}`);
}

export default async function runTravelV2InterStationHelpActionsSmokeChecks() {
  const checked = [];
  assert.equal(TRAVEL_V2_INTER_STATION_HELP_ACTIONS_VERSION, 1);
  assert.equal(typeof prepareTravelV2InterStationHelpActions, "function");
  checked.push("exports and version");

  const missing = prepareTravelV2InterStationHelpActions();
  assert.equal(missing.ok, false);
  assert.equal(missing.applied, false);
  assert.equal(missing.helpActions.length, 0);
  assert.equal(missing.blockedReasons.includes("travel-v2-session-required"), true);
  checked.push("missing session blocks safely");

  const session = fixture();
  const before = snapshot(session);
  const state = prepareTravelV2InterStationHelpActions(session);
  assert.equal(state.ok, true);
  assert.equal(state.available, true);
  assert.equal(state.canReview, true);
  assert.equal(state.helpReady, true);
  assert.equal(state.applied, false);
  assert.equal(state.roundIndex, 0);
  assert.equal(state.roundNumber, 1);
  assert.equal(state.stationKey, "navigator");
  assert.equal(state.stationName, "Navigator");
  assert.deepEqual(state.stationOrder, ["navigator", "engineer", "captain", "watchmaster"]);
  assert.equal(state.stationOrderLocked, true);
  assert.equal(state.helpActionCount, 5);
  assert.equal(state.availableHelpActionCount, 5);
  assert.equal(state.helpActions.every((row) => row.targetLaterInOrder && row.available && row.applied === false), true);
  const plotBypass = state.helpActions.find((row) => row.actionId === "plot-bypass" && row.sourceStationKey === "navigator" && row.targetStationKey === "engineer");
  assert.ok(plotBypass);
  assert.equal(plotBypass.roundIndex, 0);
  assert.equal(plotBypass.roundNumber, 1);
  assert.equal(plotBypass.stationOrderLocked, true);
  assert.equal(plotBypass.criticalSuccessMetadata.strengthening, "stronger-opening");
  assert.equal(plotBypass.criticalSuccessMetadata.publicText, "Engineer gets a cleaner opening.");
  assert.equal(state.helpActions.filter((row) => row.actionId === "bleed-charge").length, 2);
  assert.equal(state.helpActions.some((row) => row.actionId === "brace-captain"), true);
  assert.equal(state.helpActions.some((row) => row.actionId === "captain-to-watch"), true);
  assert.equal(Boolean(state.byTargetStation.watchmaster?.length), true);
  assert.equal(Boolean(state.bySourceStation.engineer?.length), true);
  assert.equal(state.byTag.opening.length, 3);
  assert.equal(snapshot(session), before);
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.helpActions), true);
  assert.equal(Object.isFrozen(state.helpActions[0]), true);
  assertSafe(state);
  checked.push("authored sources normalize into immutable player-safe later-station options with round context and critical metadata");

  const unavailable = prepareTravelV2InterStationHelpActions(session, { includeUnavailable: true });
  const backward = unavailable.helpActions.find((row) => row.actionId === "warn-navigator");
  assert.equal(backward.available, false);
  assert.equal(backward.unavailableReason, "target-station-not-later-in-order");
  assert.equal(unavailable.helpActionCount, 6);
  assert.equal(unavailable.availableHelpActionCount, 5);
  assert.equal(unavailable.helpActions.some((row) => row.actionId === "self-invalid"), false);
  checked.push("includeUnavailable exposes earlier targets without exposing self targets");

  const fallbackSession = fixture();
  delete fallbackSession.event.rounds[0].stationOrder;
  const fallback = prepareTravelV2InterStationHelpActions(fallbackSession);
  assert.deepEqual(fallback.stationOrder, fallbackSession.event.rounds[0].activeStations);
  assert.equal(fallback.warnings.includes("station-order-fallback-active-stations"), true);
  assert.equal(fallback.stationOrderLocked, true);
  checked.push("active-station fallback is explicit and warned");

  const inactive = fixture();
  inactive.event.rounds[0].stationCards.push({ stationKey: "navigator", helpActions: [{ id: "inactive-target", targetStationKey: "veilwarden", title: "Invalid Target" }] });
  const inactiveState = prepareTravelV2InterStationHelpActions(inactive, { includeUnavailable: true });
  assert.equal(inactiveState.helpActions.some((row) => row.actionId === "inactive-target"), false);
  assert.equal(inactiveState.warnings.includes("invalid-help-action-target"), true);
  checked.push("inactive and invalid targets are dropped");

  const noActions = fixture({ event: { rounds: [{ roundNumber: 1, activeStations: ["navigator", "engineer"], stationPrompts: { navigator: { stationName: "Navigator" }, engineer: { stationName: "Engineer" } } }] }, roundResults: [{ stationResults: { navigator: null, engineer: null } }] });
  const empty = prepareTravelV2InterStationHelpActions(noActions);
  assert.equal(empty.ok, false);
  assert.equal(empty.available, false);
  assert.equal(empty.blockedReasons.includes("no-valid-inter-station-help-actions"), true);
  checked.push("rounds without valid authored help report a stable blocked reason");

  const source = readFileSync(new URL("./travel-v2-inter-station-help-actions.js", import.meta.url), "utf8");
  for (const forbiddenCall of [".setFlag(", ".update(", ".create(", ".delete(", "ChatMessage", "JournalEntry", "game.settings.set", "socket.emit", "new Roll("]) {
    assert.equal(source.includes(forbiddenCall), false, `helper contains forbidden runtime call ${forbiddenCall}`);
  }
  checked.push("source scan finds no persistence, roll, or Foundry side effects");

  return { ok: true, checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2InterStationHelpActionsSmokeChecks()
    .then((result) => {
      console.log("Travel v2 inter-station help actions smoke checks passed.");
      for (const check of result.checked) console.log(`- ${check}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
