import { getCoreTravelEvent } from "../../data/travel-events/core-travel-events.js";
import { ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import {
  createTravelEventRunnerSession,
  prepareTravelEventRunnerStartupDiagnostics
} from "../helpers/travel-event-runner.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel Event Runner startup diagnostics smoke check failed: ${message}`);
}

function createPublishedLibrary() {
  const event = JSON.parse(JSON.stringify(getCoreTravelEvent("black-tide-crossing")));
  event.key = "startup-diagnostics-smoke";
  event.name = "Startup Diagnostics Smoke";
  for (const round of event.rounds ?? []) {
    const activeNavigator = (round.activeStations ?? []).find((station) => station?.stationKey === "navigator") ?? {
      stationKey: "navigator",
      playerAction: "Choose a careful course and make the Navigator check for the smoke test.",
      rollFeedback: { criticalSuccess: "Excellent route.", success: "Safe route.", failure: "Costly route.", criticalFailure: "Dangerous route." }
    };
    round.activeStations = [activeNavigator];
    round.stationCards = (round.stationCards ?? []).filter((card) => card.stationKey === "navigator");
    for (const card of round.stationCards ?? []) {
      for (const approach of card.skillApproaches ?? []) {
        approach.boardResultFeedback = { criticalSuccess: "Excellent plan.", success: "Good plan.", failure: "Risky plan.", criticalFailure: "Bad plan." };
        approach.gmNarrationFeedback = { criticalSuccess: "Excellent narration.", success: "Good narration.", failure: "Risky narration.", criticalFailure: "Bad narration." };
      }
    }
  }
  event.finalOutcomes = {
    criticalSuccess: { label: "Critical Success", text: "Smoke critical success." },
    success: { label: "Success", text: "Smoke success." },
    mixed: { label: "Mixed", text: "Smoke mixed result." },
    failure: { label: "Failure", text: "Smoke failure." },
    criticalFailure: { label: "Critical Failure", text: "Smoke critical failure." }
  };
  return {
    version: 1,
    events: {
      [event.key]: {
        id: event.key,
        key: event.key,
        name: event.name,
        category: event.category,
        publishedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        sourceDraftId: "startup-diagnostics-smoke",
        version: 1,
        event
      }
    }
  };
}

export function runTravelEventRunnerStartupDiagnosticsSmokeChecks() {
  const library = createPublishedLibrary();
  const actor = { id: "ship-a", uuid: "Actor.ship-a", name: "Smoke Ship", type: "vehicle", getFlag: (scope, key) => scope === ARCFLIGHT_MODULE_ID && key === "actorType" ? "ship" : null };

  const ready = prepareTravelEventRunnerStartupDiagnostics({ library, selectedEventId: "startup-diagnostics-smoke", actors: [actor], dialogV2Available: true });
  assertSmoke(ready.canStart === true, "valid published event, ship actor, and DialogV2 should be ready");
  assertSmoke(ready.hasPublishedFinalizedEvent === true && ready.hasShipOptions === true, "ready state should report available event and ship");

  const empty = prepareTravelEventRunnerStartupDiagnostics({ library: { version: 1, events: {} }, actors: [actor], dialogV2Available: true });
  assertSmoke(empty.canStart === false && empty.issues.some((issue) => /No published finalized travel event exists/.test(issue)), "empty library should explain missing published finalized event");

  const malformed = prepareTravelEventRunnerStartupDiagnostics({ library: { version: 1, events: { bad: { id: "bad", key: "bad", name: "Bad Event", event: { key: "bad" } } } }, selectedEventId: "bad", actors: [actor], dialogV2Available: true });
  assertSmoke(malformed.canStart === false && malformed.issues.some((issue) => /malformed|not-finalized|loadable finalized/i.test(issue)), "malformed published entry should be diagnostic");

  const noShip = prepareTravelEventRunnerStartupDiagnostics({ library, selectedEventId: "startup-diagnostics-smoke", actors: [], dialogV2Available: true });
  assertSmoke(noShip.canStart === false && noShip.issues.some((issue) => /No PF2E vehicle \/ Arcflight ship actor exists/.test(issue)), "missing ship actor should be diagnostic");

  const noDialog = prepareTravelEventRunnerStartupDiagnostics({ library, selectedEventId: "startup-diagnostics-smoke", actors: [actor], dialogV2Available: false });
  assertSmoke(noDialog.canStart === false && noDialog.issues.some((issue) => /DialogV2 is unavailable/.test(issue)), "missing DialogV2 should be diagnostic");

  const session = createTravelEventRunnerSession(library.events["startup-diagnostics-smoke"].event, { ship: actor }).session;
  const existingSession = prepareTravelEventRunnerStartupDiagnostics({ session, library, selectedEventId: "startup-diagnostics-smoke", actors: [actor], dialogV2Available: true });
  assertSmoke(existingSession.canStart === false && existingSession.issues.some((issue) => /local runner session already exists/i.test(issue)), "existing session should block a second startup");

  return {
    ok: true,
    checked: [
      "startup-ready-state",
      "startup-empty-library-diagnostic",
      "startup-malformed-event-diagnostic",
      "startup-no-ship-diagnostic",
      "startup-no-dialog-diagnostic",
      "startup-existing-session-diagnostic"
    ]
  };
}

export default runTravelEventRunnerStartupDiagnosticsSmokeChecks;
