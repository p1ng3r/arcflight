import { commitTravelV2RoundActionOrderToSession } from "./travel-v2-round-action-order-state.js";
import { prepareTravelEventRunnerSessionLibraryState, prepareTravelV2RoundActionOrderLibraryStatus } from "./travel-event-runner.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel v2 round action order library status smoke check failed: ${message}`); }
function assertEqual(actual, expected, message) { if (actual !== expected) throw new Error(`Travel v2 round action order library status smoke check failed: ${message}. Expected ${expected}, got ${actual}.`); }
function assertDeepEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) throw new Error(`Travel v2 round action order library status smoke check failed: ${message}. Expected ${expectedJson}, got ${actualJson}.`);
}
function snapshot(value) { return JSON.stringify(value); }
function ownKeys(value) { return Object.keys(value ?? {}).sort(); }

const FORBIDDEN_NON_GM_FIELDS = Object.freeze(["commitRecords", "auditRecord", "userId", "userName", "gmText", "applyPayload", "internalMutation", "targetActorUuid", "mutationScope"]);

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
  const committed = JSON.parse(JSON.stringify(commitTravelV2RoundActionOrderToSession(sessionFixture(), ["engineer", "navigator", "watchmaster"], { user: { isGM: true, id: "gm-secret", name: "GM Secret" }, commitRequested: true, timestamp: "2026-07-04T00:00:00.000Z" }).session));
  committed.travelV2RoundActionOrder.commitRecords = [{ userId: "gm-secret", userName: "GM Secret", gmText: "GM-only audit text", applyPayload: { targetActorUuid: "Actor.secret", mutationScope: "world" }, internalMutation: true }];
  committed.travelV2RoundActionOrder.auditRecord = { userId: "gm-secret", userName: "GM Secret", gmText: "GM-only audit text", targetActorUuid: "Actor.secret", mutationScope: "world" };
  return committed;
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
  assertEqual(noOrderRow.session, undefined, "GM library row render state does not expose the full saved session object");
  assertEqual(committedRow.session, undefined, "GM committed library row render state does not expose the full saved session object");
  assertDeepEqual(ownKeys(committedRow.roundActionOrderLibraryStatus), ["roundNumber", "stationLabelText", "statusLabel"], "GM row status exposes only the template-facing status label, round number, and station label text");
  assertEqual(noOrderRow.roundActionOrderLibraryStatus.statusLabel, "No committed order saved", "library entry without current-round order shows no committed order saved");
  assertEqual(committedRow.roundActionOrderLibraryStatus.statusLabel, "Committed order saved", "library entry with current-round order shows committed order saved");
  assertEqual(committedRow.roundActionOrderLibraryStatus.roundNumber, 1, "GM display includes current round number");
  assertEqual(committedRow.roundActionOrderLibraryStatus.stationLabelText, "Arkengineer → Routefinder → Lookout", "GM display includes player-safe station labels");

  const playerState = prepareTravelEventRunnerSessionLibraryState({ library, user: { isGM: false } });
  const playerCommittedRow = playerState.entries.find((entry) => entry.key === committed.key);
  assertEqual(playerCommittedRow.session, undefined, "non-GM library row render state does not expose the full saved session object");
  assertDeepEqual(ownKeys(playerCommittedRow.roundActionOrderLibraryStatus), ["statusLabel"], "non-GM row status exposes only the committed/no-committed label");
  assertEqual(playerCommittedRow.roundActionOrderLibraryStatus.statusLabel, "Committed order saved", "non-GM still sees committed status");
  assertSmoke(!Object.hasOwn(playerCommittedRow.roundActionOrderLibraryStatus, "roundNumber"), "non-GM status object does not expose roundNumber");
  assertSmoke(!Object.hasOwn(playerCommittedRow.roundActionOrderLibraryStatus, "stationLabelText"), "non-GM status object does not expose stationLabelText");
  for (const forbidden of FORBIDDEN_NON_GM_FIELDS) assertSmoke(!snapshot(playerCommittedRow).includes(forbidden), `non-GM library row/template-facing state should not expose ${forbidden}`);
  for (const forbidden of ["gm-secret", "GM Secret", "Actor.secret", "GM-only audit text"]) assertSmoke(!snapshot(playerCommittedRow).includes(forbidden), `non-GM library row/template-facing state should not expose ${forbidden}`);

  prepareTravelV2RoundActionOrderLibraryStatus(committed, { user: { isGM: true } });
  assertEqual(snapshot(library), beforeLibrary, "indicator computation does not mutate library");
  assertEqual(snapshot(plain), beforePlain, "indicator computation does not mutate sessions without committed order");
  assertEqual(snapshot(committed), beforeCommitted, "indicator computation does not mutate sessions with committed order");
  for (const forbidden of ["travelV2ProposedRoundActionOrder", "travelV2RoundActionOrderCommitResult", "travelV2RoundActionOrderPersistResult", "newRecords", "createdRecords"]) assertSmoke(!snapshot(gmState).includes(forbidden), `indicator should not create ${forbidden}`);

  const fs = await import("node:fs");
  const template = fs.readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
  const statusSelectorMatches = template.match(/data-arcflight-travel-v2-library-order-status/g) ?? [];
  assertEqual(statusSelectorMatches.length, 1, "template contains exactly one library order-status line selector");
  const statusLine = template.split("\n").find((line) => line.includes("data-arcflight-travel-v2-library-order-status")) ?? "";
  assertSmoke(statusLine.includes("roundActionOrderLibraryStatus.statusLabel"), "template status line renders status label from the safe status object");
  assertSmoke(statusLine.includes("roundActionOrderLibraryStatus.roundNumber"), "template status line renders round number from the safe status object");
  assertSmoke(statusLine.includes("roundActionOrderLibraryStatus.stationLabelText"), "template status line renders station labels from the safe status object");
  assertSmoke(!statusLine.includes("session."), "template status line does not render from the full saved session object");
  assertEqual((template.match(/data-arcflight-travel-v2-order-commit-request/g) ?? []).length, 1, "template contains zero new commit controls beyond the existing commit button");
  assertEqual((template.match(/data-arcflight-travel-v2-order-persist-request/g) ?? []).length, 1, "template contains zero new persist controls beyond the existing persist button");
  const aggregate = fs.readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8");
  assertSmoke(aggregate.includes("runTravelV2RoundActionOrderLibraryStatusSmokeChecks"), "aggregate Travel v2 smoke includes the new suite");

  return { ok: true, checked: ["no-order-row", "committed-order-row", "no-row-session", "gm-template-facing-keys", "non-gm-label-only", "non-gm-redaction", "non-mutating", "no-proposed-commit-persist-records", "single-status-selector", "safe-status-template-line", "zero-new-commit-persist-controls", "aggregate-wiring"] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2RoundActionOrderLibraryStatusSmokeChecks().then(() => console.log("Travel v2 round action order library status smoke checks passed.")).catch((error) => { console.error(error); process.exitCode = 1; });
}
