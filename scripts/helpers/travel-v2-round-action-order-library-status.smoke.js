import { commitTravelV2RoundActionOrderToSession } from "./travel-v2-round-action-order-state.js";
import { prepareTravelEventRunnerSessionLibraryState, prepareTravelV2RoundActionOrderLibraryStatus } from "./travel-event-runner.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel v2 round action order library status smoke check failed: ${message}`); }
function assertEqual(actual, expected, message) { if (actual !== expected) throw new Error(`Travel v2 round action order library status smoke check failed: ${message}. Expected ${expected}, got ${actual}.`); }
function snapshot(value) { return JSON.stringify(value); }

function sessionFixture(overrides = {}) {
  return {
    key: "library-order-status-fixture",
    name: "Library Order Status Fixture",
    status: "active",
    currentRoundIndex: 0,
    event: { key: "event", name: "Event", category: "travel", rounds: [{ roundNumber: 1, title: "Status Round", activeStations: ["navigator", "engineer", "watchmaster"], stationPrompts: { navigator: { stationName: "Routefinder" }, engineer: { stationName: "Arkengineer" }, watchmaster: { stationName: "Lookout" } }, stationActionOrder: ["navigator", "engineer", "watchmaster"] }] },
    roundResults: [{ roundIndex: 0, stationResults: { navigator: null, engineer: null, watchmaster: null }, stationActions: { navigator: { type: "eventApproach" }, engineer: { type: "support" }, watchmaster: { type: "eventApproach" } } }],
    ...overrides
  };
}

function committedSession() {
  return commitTravelV2RoundActionOrderToSession(sessionFixture(), ["engineer", "navigator", "watchmaster"], { user: { isGM: true, id: "gm-secret", name: "GM Secret" }, commitRequested: true, timestamp: "2026-07-04T00:00:00.000Z" }).session;
}

function libraryWith(sessions) {
  return { version: 1, sessions: Object.fromEntries(sessions.map((session) => [session.key, { key: session.key, name: session.name ?? session.key, eventKey: session.event?.key ?? "event", eventName: session.event?.name ?? "Event", eventCategory: session.event?.category ?? "travel", status: session.status, currentRoundIndex: session.currentRoundIndex, updatedAt: session.updatedAt ?? "2026-07-04T00:00:00.000Z", session }])) };
}

export default async function runTravelV2RoundActionOrderLibraryStatusSmokeChecks() {
  const plain = sessionFixture({ key: "no-order" });
  const committed = committedSession();
  const library = libraryWith([plain, committed]);
  const beforeLibrary = snapshot(library);
  const beforePlain = snapshot(plain);
  const beforeCommitted = snapshot(committed);

  const gmState = prepareTravelEventRunnerSessionLibraryState({ library, user: { isGM: true } });
  const noOrderRow = gmState.entries.find((entry) => entry.key === "no-order");
  const committedRow = gmState.entries.find((entry) => entry.key === committed.key);
  assertEqual(noOrderRow.roundActionOrderLibraryStatus.statusLabel, "No committed order saved", "library entry without current-round order shows no committed order saved");
  assertEqual(committedRow.roundActionOrderLibraryStatus.statusLabel, "Committed order saved", "library entry with current-round order shows committed order saved");
  assertEqual(committedRow.roundActionOrderLibraryStatus.roundNumber, 1, "GM display includes current round number");
  assertEqual(committedRow.roundActionOrderLibraryStatus.stationLabelText, "Arkengineer → Routefinder → Lookout", "GM display includes player-safe station labels");

  const playerState = prepareTravelEventRunnerSessionLibraryState({ library, user: { isGM: false } });
  const playerCommittedRow = playerState.entries.find((entry) => entry.key === committed.key);
  assertEqual(playerCommittedRow.roundActionOrderLibraryStatus.statusLabel, "Committed order saved", "non-GM still sees committed status");
  assertEqual(playerCommittedRow.roundActionOrderLibraryStatus.roundNumber, null, "non-GM display redacts round metadata");
  assertEqual(playerCommittedRow.roundActionOrderLibraryStatus.stationLabelText, "", "non-GM display redacts station label list");
  for (const forbidden of ["userId", "auditRecord", "commitRecords", "gmText", "applyPayload", "internalMutation", "gm-secret", "GM Secret"]) assertSmoke(!snapshot(playerCommittedRow.roundActionOrderLibraryStatus).includes(forbidden), `non-GM status should not expose ${forbidden}`);

  prepareTravelV2RoundActionOrderLibraryStatus(committed, { user: { isGM: true } });
  assertEqual(snapshot(library), beforeLibrary, "indicator computation does not mutate library");
  assertEqual(snapshot(plain), beforePlain, "indicator computation does not mutate sessions without committed order");
  assertEqual(snapshot(committed), beforeCommitted, "indicator computation does not mutate sessions with committed order");
  for (const forbidden of ["travelV2ProposedRoundActionOrder", "travelV2RoundActionOrderCommitResult", "travelV2RoundActionOrderPersistResult", "newRecords", "createdRecords"]) assertSmoke(!snapshot(gmState).includes(forbidden), `indicator should not create ${forbidden}`);

  const fs = await import("node:fs");
  const template = fs.readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
  assertEqual((template.match(/data-arcflight-travel-v2-order-commit-request/g) ?? []).length, 1, "indicator adds exactly zero new commit controls");
  assertEqual((template.match(/data-arcflight-travel-v2-order-persist-request/g) ?? []).length, 1, "indicator adds exactly zero new persist controls");
  const aggregate = fs.readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8");
  assertSmoke(aggregate.includes("runTravelV2RoundActionOrderLibraryStatusSmokeChecks"), "aggregate Travel v2 smoke includes the new suite");

  return { ok: true, checked: ["no-order-row", "committed-order-row", "gm-safe-metadata", "non-gm-redaction", "non-mutating", "no-proposed-commit-persist-records", "zero-new-commit-persist-controls", "aggregate-wiring"] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2RoundActionOrderLibraryStatusSmokeChecks().then(() => console.log("Travel v2 round action order library status smoke checks passed.")).catch((error) => { console.error(error); process.exitCode = 1; });
}
