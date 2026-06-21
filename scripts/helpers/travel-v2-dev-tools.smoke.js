import {
  TRAVEL_V2_DEV_TOOLS_SETTING,
  buildTravelV2DebugReport,
  copyTravelV2DebugReport,
  createLanternTravelV2SampleSession,
  forceTravelV2CurrentRoundResults,
  forceTravelV2EarlyEndRound,
  forceTravelV2Outcome,
  prepareTravelV2CompletedSessionHistoryState,
  prepareTravelV2EndOfEventResolutionDialogState,
  prepareTravelV2RoundResolutionDialogState
} from "./travel-v2-dev-tools.js";

function assert(condition, message) { if (!condition) throw new Error(`Travel v2 dev tools smoke failed: ${message}`); }

export default async function runTravelV2DevToolsSmokeChecks() {
  const checked = [];
  assert(TRAVEL_V2_DEV_TOOLS_SETTING === "travelV2DevToolsEnabled", "setting key is stable");
  checked.push("setting key");

  const sample = createLanternTravelV2SampleSession({ now: "2026-01-01T00:00:00.000Z" });
  assert(sample.ok && sample.session?.event?.key === "lantern-in-the-static", "Lantern sample session can be created");
  checked.push("Lantern sample setup");

  const roundOnly = forceTravelV2CurrentRoundResults(sample.session, "criticalSuccess", { now: "2026-01-01T00:01:00.000Z" });
  assert(roundOnly.ok && Object.values(roundOnly.stationResults).every((value) => value === "criticalSuccess"), "current-round result buttons force station results");
  checked.push("force current-round result");

  const forced = forceTravelV2Outcome(sample.session, "failure", { now: "2026-01-01T00:02:00.000Z" });
  assert(forced.ok && forced.session.travelV2PressureApplications.records[0].outcomeKey === "failure", "force outcome applies pressure record");
  checked.push("force outcome");

  const early = forceTravelV2EarlyEndRound(sample.session, { now: "2026-01-01T00:03:00.000Z" });
  assert(early.ok && early.outcomeKey === "skipped" && Object.values(early.session.roundResults[0].stationResults).every((value) => value === null), "early-end keeps all-null rounds not run");
  checked.push("early end");

  const roundDialog = prepareTravelV2RoundResolutionDialogState(early.session);
  assert(roundDialog.notRun === true && roundDialog.outcomeLabel.includes("Not run"), "round dialog labels all-null rounds as not run");
  checked.push("round resolution dialog state");

  const debug = buildTravelV2DebugReport(early.session, { now: "2026-01-01T00:04:00.000Z" });
  assert(debug.roundResults[0].outcomeKey === "not-run" && debug.roundResults[0].statusLabel.includes("Not run"), "debug report labels not-run rounds");
  checked.push("debug report");

  const copied = await copyTravelV2DebugReport(early.session, { now: "2026-01-01T00:05:00.000Z" });
  assert(copied.ok && copied.copied === false && copied.text.includes('"roundResults"'), "copy debug report returns JSON text and reports clipboard status");
  checked.push("copy debug report status");

  const emptyRound = { ...early.session, roundResults: [{ ...early.session.roundResults[0], stationResults: {} }] };
  const emptyRoundDialog = prepareTravelV2RoundResolutionDialogState(emptyRound);
  assert(emptyRoundDialog.notRun === true && emptyRoundDialog.outcomeLabel.includes("Not run"), "empty station-result maps are treated as not run");
  checked.push("empty station not-run handling");

  const completed = { ...forced.session, status: "completed", completed: true, completedAt: "2026-01-02T00:00:00.000Z", summary: { eventOutcomeKey: "failure" } };
  const endDialog = prepareTravelV2EndOfEventResolutionDialogState(completed);
  assert(endDialog.tabs.includes("debug") && endDialog.tabs.includes("followUps"), "end-of-event dialog exposes required tabs");
  checked.push("end-of-event dialog state");

  const older = { ...completed, key: "older", completedAt: "2026-01-01T00:00:00.000Z" };
  const newer = { ...completed, key: "newer", completedAt: "2026-01-03T00:00:00.000Z" };
  const history = prepareTravelV2CompletedSessionHistoryState([{ session: older, key: "older" }, { session: newer, key: "newer" }]);
  assert(history.rows.length === 2 && history.rows[0].key === "newer" && history.rows[0].canReopen === true && history.rows[0].completedAtLabel && history.rows[0].appliedAtLabel, "completed history sorts newest first with date/time labels and supports reopen");
  checked.push("completed history state");

  return { ok: true, checked };
}
