import { readFileSync } from "node:fs";
import { loadTravelEventRunnerSessionFromLibrary, prepareTravelEventRunnerSessionLibraryState, prepareTravelV2RoundActionOrderLibraryStatus } from "../helpers/travel-event-runner.js";
import { prepareTravelV2RoundActionOrderState } from "../helpers/travel-v2-round-action-order-state.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel event runner v2 library order status closeout smoke check failed: ${message}`); }
function assertEqual(actual, expected, message) { if (actual !== expected) throw new Error(`Travel event runner v2 library order status closeout smoke check failed: ${message}. Expected ${expected}, got ${actual}.`); }
function assertDeepEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) throw new Error(`Travel event runner v2 library order status closeout smoke check failed: ${message}. Expected ${expectedJson}, got ${actualJson}.`);
}
function snapshot(value) { return JSON.stringify(value); }
function ownKeys(value) { return Object.keys(value ?? {}).sort(); }

const COMMITTED_ORDER = Object.freeze(["engineer", "navigator", "watchmaster"]);
const GM_USER = Object.freeze({ isGM: true, id: "gm-closeout-secret", name: "Closeout Secret GM" });
const PLAYER_USER = Object.freeze({ isGM: false, id: "player-closeout", name: "Player" });
const FORBIDDEN_TEMPLATE_FIELDS = Object.freeze(["commitRecords", "auditRecord", "userId", "userName", "gmText", "applyPayload", "internalMutation", "targetActorUuid", "mutationScope", "secret", "Secret"]);

function savedSessionFixture(overrides = {}) {
  return {
    key: "library-order-status-closeout-fixture",
    name: "Library Order Status Closeout Fixture",
    status: "active",
    currentRoundIndex: 0,
    roundPhase: "stationOrders",
    event: {
      key: "library-order-status-closeout-event",
      name: "Library Order Status Closeout Event",
      category: "travel",
      rounds: [{
        roundNumber: 1,
        title: "Closeout Status Round",
        activeStations: ["navigator", "engineer", "watchmaster"],
        stationPrompts: {
          navigator: { stationName: "Routefinder" },
          engineer: { stationName: "Arkengineer" },
          watchmaster: { stationName: "Lookout" }
        },
        stationActionOrder: ["navigator", "engineer", "watchmaster"]
      }]
    },
    roundResults: [{
      roundIndex: 0,
      stationResults: { navigator: null, engineer: null, watchmaster: null },
      selectedStationOptionLabels: { navigator: "Plot the route", engineer: "Tune the engine", watchmaster: "Watch the void" },
      stationActions: {
        navigator: { type: "eventApproach", gmText: "secret route", applyPayload: { targetActorUuid: "Actor.secret" } },
        engineer: { type: "eventApproach", internalMutation: true },
        watchmaster: { type: "support", targetStationKey: "navigator" }
      }
    }],
    travelV2RoundActionOrder: {
      version: 3,
      rounds: {
        "0": {
          roundIndex: 0,
          roundNumber: 1,
          order: [...COMMITTED_ORDER],
          stationOrder: [...COMMITTED_ORDER],
          committedAt: "2026-07-04T00:30:00.000Z",
          source: "gm-order-commit",
          userId: "gm-closeout-secret",
          userName: "Closeout Secret GM",
          auditRecord: { userId: "gm-closeout-secret", userName: "Closeout Secret GM", gmText: "secret audit", applyPayload: { targetActorUuid: "Actor.secret" }, internalMutation: true, mutationScope: "session-local" }
        }
      },
      commitRecords: [{ userId: "gm-closeout-secret", userName: "Closeout Secret GM", gmText: "secret commit", applyPayload: { targetActorUuid: "Actor.secret" }, internalMutation: true, mutationScope: "session-local" }]
    },
    ...overrides
  };
}

function libraryWith(session) {
  return { version: 1, sessions: { [session.key]: { key: session.key, name: session.name, eventKey: session.event?.key, eventName: session.event?.name, eventCategory: session.event?.category, status: session.status, currentRoundIndex: session.currentRoundIndex, session } } };
}

function assertNoForbiddenFields(value, label) {
  const text = snapshot(value);
  for (const forbidden of FORBIDDEN_TEMPLATE_FIELDS) assertSmoke(!text.includes(forbidden), `${label} exposes ${forbidden}`);
}

export async function runTravelEventRunnerV2LibraryOrderStatusCloseoutSmokeChecks() {
  const checked = [];
  const savedSession = savedSessionFixture();
  const library = libraryWith(savedSession);
  const beforeLibrary = snapshot(library);
  const beforeEntry = snapshot(library.sessions[savedSession.key]);
  const beforeSession = snapshot(savedSession);
  const beforeCommitRecordCount = savedSession.travelV2RoundActionOrder.commitRecords.length;

  const loaded = loadTravelEventRunnerSessionFromLibrary(savedSession.key, { library });
  assertSmoke(loaded.ok, "saved session with valid committed travelV2RoundActionOrder loads");
  assertEqual(loaded.session.travelV2RoundActionOrder.rounds["0"].order.join(","), COMMITTED_ORDER.join(","), "loaded saved session retains valid committed order");
  checked.push("saved session with valid committed order loads");

  const gmLibraryState = prepareTravelEventRunnerSessionLibraryState({ library, user: GM_USER });
  const gmRow = gmLibraryState.entries.find((entry) => entry.key === savedSession.key);
  assertEqual(gmRow.roundActionOrderLibraryStatus.statusLabel, "Committed order saved", "valid committed saved session shows committed order saved in library row");
  assertDeepEqual(ownKeys(gmRow.roundActionOrderLibraryStatus), ["roundNumber", "stationLabelText", "statusLabel"], "GM row exposes exactly statusLabel, roundNumber, and stationLabelText");
  assertEqual(gmRow.roundActionOrderLibraryStatus.roundNumber, 1, "GM row exposes current round number");
  assertEqual(gmRow.roundActionOrderLibraryStatus.stationLabelText, "Arkengineer → Routefinder → Lookout", "GM row exposes safe committed station labels");
  assertEqual(gmRow.session, undefined, "library row session remains undefined/unavailable");
  assertSmoke(!snapshot(gmRow).includes("travelV2RoundActionOrder"), "template-facing GM row state never exposes full session data");
  checked.push("GM library row exposes only the read-only status summary");

  const playerLibraryState = prepareTravelEventRunnerSessionLibraryState({ library, user: PLAYER_USER });
  const playerRow = playerLibraryState.entries.find((entry) => entry.key === savedSession.key);
  assertDeepEqual(ownKeys(playerRow.roundActionOrderLibraryStatus), ["statusLabel"], "non-GM row exposes exactly statusLabel");
  assertEqual(playerRow.roundActionOrderLibraryStatus.statusLabel, "Committed order saved", "non-GM row reports committed order saved");
  assertEqual(playerRow.session, undefined, "non-GM library row session remains undefined/unavailable");
  assertNoForbiddenFields(playerRow, "non-GM row/template-facing state");
  checked.push("non-GM library row exposes status only and redacts unsafe fields");

  const malformedCases = [
    { label: "missing order state", patch: { travelV2RoundActionOrder: undefined } },
    { label: "string order state", patch: { travelV2RoundActionOrder: "bad" } },
    { label: "array rounds map", patch: { travelV2RoundActionOrder: { rounds: [] } } },
    { label: "empty order", patch: { travelV2RoundActionOrder: { rounds: { "0": { order: [] } } } } },
    { label: "non-array order", patch: { travelV2RoundActionOrder: { rounds: { "0": { order: "navigator" } } } } },
    { label: "invalid keys only", patch: { travelV2RoundActionOrder: { rounds: { "0": { order: ["", null, "not-a-station"] } } } } }
  ];
  for (const { label, patch } of malformedCases) {
    const malformed = savedSessionFixture({ key: `malformed-${label.replaceAll(" ", "-")}`, ...patch });
    const beforeMalformed = snapshot(malformed);
    let gmStatus, playerStatus;
    assertSmoke((() => { try { gmStatus = prepareTravelV2RoundActionOrderLibraryStatus(malformed, { user: GM_USER }); playerStatus = prepareTravelV2RoundActionOrderLibraryStatus(malformed, { user: PLAYER_USER }); return true; } catch (_error) { return false; } })(), `${label} fails safe without throwing`);
    assertEqual(gmStatus.statusLabel, "No committed order saved", `${label} GM status fails safe as no committed order saved`);
    assertEqual(playerStatus.statusLabel, "No committed order saved", `${label} non-GM status fails safe as no committed order saved`);
    assertEqual(snapshot(malformed), beforeMalformed, `${label} indicator computation does not mutate malformed session`);
  }
  checked.push("malformed saved order data fails safe without throwing or mutating");

  const startupOrderState = prepareTravelV2RoundActionOrderState(loaded.session, { user: GM_USER, isGM: true });
  const startupPreview = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: loaded.session, selectedSessionKey: savedSession.key, user: GM_USER, isGM: true });
  assertEqual(startupOrderState.orderedStationKeys.join(","), COMMITTED_ORDER.join(","), "startup state still orders stations by persisted committed order");
  assertEqual(startupPreview.travelV2PreviewPanel.roundActionOrderDisplay.rows.map((row) => row.stationKey).join(","), COMMITTED_ORDER.join(","), "preview state still displays persisted committed order");
  checked.push("startup/preview display the persisted committed order");

  assertDeepEqual(startupPreview.travelV2ProposedRoundActionOrder, [], "closeout smoke does not create proposed order");
  assertEqual(startupPreview.travelV2RoundActionOrderCommitResult, null, "closeout smoke does not create commit result");
  assertEqual(startupPreview.travelV2RoundActionOrderPersistResult, null, "closeout smoke does not create persistence result");
  const closeoutStateText = snapshot({ gmLibraryState, playerLibraryState, startupOrderState, startupPreview });
  for (const forbidden of ["newRecords", "createdRecords", "persistenceRecords"]) {
    assertSmoke(!closeoutStateText.includes(forbidden), `closeout smoke does not create ${forbidden}`);
  }
  assertEqual(snapshot(library), beforeLibrary, "closeout smoke does not mutate library");
  assertEqual(snapshot(library.sessions[savedSession.key]), beforeEntry, "closeout smoke does not mutate library entry");
  assertEqual(savedSession.travelV2RoundActionOrder.commitRecords.length, beforeCommitRecordCount, "closeout smoke does not create commit records");
  assertEqual(snapshot(savedSession), beforeSession, "closeout smoke does not mutate session");
  checked.push("closeout indicator path is read-only and creates no proposed/commit/persistence records");

  const aggregate = readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8");
  assertSmoke(aggregate.includes("runTravelEventRunnerV2LibraryOrderStatusCloseoutSmokeChecks"), "aggregate Travel v2 smoke includes the closeout suite");
  checked.push("aggregate Travel v2 smoke includes library order status closeout suite");

  return { ok: true, checked };
}

export default runTravelEventRunnerV2LibraryOrderStatusCloseoutSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelEventRunnerV2LibraryOrderStatusCloseoutSmokeChecks().then((result) => { console.log("Travel event runner v2 library order status closeout smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
