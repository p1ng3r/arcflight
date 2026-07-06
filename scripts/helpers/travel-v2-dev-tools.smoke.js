import {
  TRAVEL_V2_DEV_TOOLS_LEGACY_SETTING,
  TRAVEL_V2_DEV_TOOLS_SETTING,
  TRAVEL_V2_DEV_TOOLS_SETTING_PATH,
  buildTravelV2DebugReport,
  copyTravelV2DebugReport,
  createLanternTravelV2SampleSession,
  deleteTravelV2CompletedSessionFromLibrary,
  forceTravelV2CurrentRoundResults,
  forceTravelV2EarlyEndRound,
  forceTravelV2Outcome,
  filterTravelV2CompletedSessionEntries,
  getTravelV2DevToolsSettingKeys,
  isTravelV2DevToolsEnabled,
  prepareTravelV2CompletedSessionHistoryState,
  prepareTravelV2CompletedSessionSummaryViewState,
  prepareTravelV2DevToolsPanelState,
  prepareTravelV2EndOfEventResolutionDialogState,
  prepareTravelV2RoundResolutionDialogState
} from "./travel-v2-dev-tools.js";

function assert(condition, message) { if (!condition) throw new Error(`Travel v2 dev tools smoke failed: ${message}`); }

export default async function runTravelV2DevToolsSmokeChecks() {
  const checked = [];
  assert(TRAVEL_V2_DEV_TOOLS_SETTING === "enableTravelV2DevTools", "canonical setting key is stable");
  assert(TRAVEL_V2_DEV_TOOLS_SETTING_PATH === "arcflight.enableTravelV2DevTools", "canonical setting path is stable");
  assert(TRAVEL_V2_DEV_TOOLS_LEGACY_SETTING === "travelV2DevToolsEnabled", "legacy setting key is retained for read fallback only");
  const settingKeys = getTravelV2DevToolsSettingKeys();
  assert(settingKeys.settingKey === TRAVEL_V2_DEV_TOOLS_SETTING && settingKeys.legacySettingKey === TRAVEL_V2_DEV_TOOLS_LEGACY_SETTING, "setting key helper exposes canonical and legacy keys");
  checked.push("setting keys");

  assert(isTravelV2DevToolsEnabled({ isGM: true, settingValue: true }) === true, "GM can enable dev tools through canonical setting value");
  assert(isTravelV2DevToolsEnabled({ isGM: true, settingValue: false }) === false, "canonical setting value hides dev tools by default");
  assert(isTravelV2DevToolsEnabled({ isGM: false, settingValue: true }) === false, "non-GM cannot reveal dev tools even when setting is true");
  checked.push("GM-only dev tools enablement");

  const gmPanel = prepareTravelV2DevToolsPanelState({ isGM: true, settingValue: true, hasSession: true });
  const disabledPanel = prepareTravelV2DevToolsPanelState({ isGM: true, settingValue: false, hasSession: true });
  const playerPanel = prepareTravelV2DevToolsPanelState({ isGM: false, settingValue: true, hasSession: true });
  assert(gmPanel.visible === true && gmPanel.settingPath === "arcflight.enableTravelV2DevTools" && gmPanel.actions.length >= 3, "GM panel is visible only when enabled and exposes inert shell action metadata");
  assert(gmPanel.mutationBoundary.includes("No actor") && gmPanel.actions.every((action) => action.sessionLocalOnly === true), "dev panel documents no actor/world mutation boundary");
  assert(disabledPanel.visible === false && disabledPanel.hiddenReason.includes("enableTravelV2DevTools"), "disabled GM panel stays hidden with canonical setting hint");
  assert(playerPanel.visible === false && playerPanel.hiddenReason.includes("GM-only"), "non-GM panel stays hidden");
  const panelBefore = JSON.stringify({ isGM: true, settingValue: true, hasSession: true });
  prepareTravelV2DevToolsPanelState({ isGM: true, settingValue: true, hasSession: true });
  assert(panelBefore === JSON.stringify({ isGM: true, settingValue: true, hasSession: true }), "dev panel state preparation does not mutate input data");
  checked.push("GM-only dev panel shell state");

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
  assert(roundDialog.notRun === true && roundDialog.outcomeLabel.includes("Not run") && roundDialog.pressureChangeText === "No pressure changes", "round dialog labels all-null rounds as not run and exposes pressure changes");
  checked.push("round resolution dialog state");

  const debug = buildTravelV2DebugReport(early.session, { now: "2026-01-01T00:04:00.000Z" });
  assert(debug.roundResults[0].outcomeKey === "not-run" && debug.roundResults[0].statusLabel.includes("Not run"), "debug report labels not-run rounds");
  checked.push("debug report");

  const copied = await copyTravelV2DebugReport(early.session, { now: "2026-01-01T00:05:00.000Z" });
  assert(copied.ok === false && copied.copied === false && copied.error && copied.text.includes('"roundResults"'), "copy debug report returns JSON text and reports clipboard failure status");
  checked.push("copy debug report failure status");

  const emptyRound = { ...early.session, roundResults: [{ ...early.session.roundResults[0], stationResults: {} }] };
  const emptyRoundDialog = prepareTravelV2RoundResolutionDialogState(emptyRound);
  assert(emptyRoundDialog.notRun === true && emptyRoundDialog.outcomeLabel.includes("Not run"), "empty station-result maps are treated as not run");
  checked.push("empty station not-run handling");

  const completed = { ...forced.session, status: "completed", completed: true, completedAt: "2026-01-02T00:00:00.000Z", completedByUserName: "GM Ada", summary: { eventOutcomeKey: "failure" }, travelV2CompletionSummary: { eventTitle: "Lantern", actorName: "Aster", completedAt: "2026-01-02T00:00:00.000Z", finalOutcomeLabel: "Costly passage", publicSummary: { title: "Public Win", paragraphs: ["Crew endured the route."], chips: ["Travel complete"] }, gmSummary: { paragraphs: ["GM only clue."], nextSteps: ["Review privately."], warnings: ["Do not show players."] }, rounds: [{ roundIndex: 0, roundNumber: 1, title: "Static", status: "finalized", stationResults: [{ stationKey: "navigator", stationName: "Navigator", resultLabel: "Failure", degreeOfSuccess: "failure", publicSummary: "Navigator: Failure." }], pressureApplication: { secret: "GM_PRESSURE_SECRET" }, roundOutcome: { secret: "GM_ROUND_SECRET" }, consequencesGenerated: [{ id: "c1" }], consequencesHandled: [] }], totals: { consequencesApplied: 1, consequencesDismissed: 2, consequencesPending: 3, resourceDeltas: { fuel: -1, strain: 2, supplies: 0 } }, followups: [{ id: "f1", title: "Repair beacon", status: "pending", publicSummary: "Fix it.", text: "GM_FOLLOWUP_TEXT_SECRET", gmSummary: "GM_FOLLOWUP_SECRET" }] } };
  const endDialog = prepareTravelV2EndOfEventResolutionDialogState(completed);
  assert(endDialog.tabs.includes("debug") && endDialog.tabs.includes("followUps"), "end-of-event dialog exposes required tabs");
  checked.push("end-of-event dialog state");


  const summaryView = prepareTravelV2CompletedSessionSummaryViewState(completed, { includeGmSummary: true });
  assert(summaryView.readOnly === true && summaryView.publicSummary.paragraphs[0] === "Crew endured the route." && summaryView.gmSummary.paragraphs[0] === "GM only clue." && summaryView.rounds.length === 1 && summaryView.rounds[0].pressureApplication?.secret === "GM_PRESSURE_SECRET" && summaryView.rounds[0].roundOutcome?.secret === "GM_ROUND_SECRET" && summaryView.followups[0].gmSummary === "GM_FOLLOWUP_SECRET" && summaryView.stationResults.length === 1 && summaryView.resourceDeltas.length === 2 && summaryView.consequenceCounts.pending === 3 && summaryView.followupCount === 1, "completed summary view exposes public, GM, rounds, raw GM records, station results, resource deltas, consequence counts, and followups read-only");
  const playerSafeSummaryView = prepareTravelV2CompletedSessionSummaryViewState(completed, { includeGmSummary: false });
  const playerSafeJson = JSON.stringify(playerSafeSummaryView);
  assert(playerSafeSummaryView.publicSummary.title === "Public Win" && playerSafeSummaryView.stationResults.length === 1 && playerSafeSummaryView.resourceDeltas.length === 2 && playerSafeSummaryView.consequenceCounts.pending === 3 && !("gmSummary" in playerSafeSummaryView) && !("pressureApplication" in playerSafeSummaryView.rounds[0]) && !("roundOutcome" in playerSafeSummaryView.rounds[0]) && playerSafeJson.includes("GM only clue") === false && playerSafeJson.includes("GM_PRESSURE_SECRET") === false && playerSafeJson.includes("GM_ROUND_SECRET") === false && playerSafeJson.includes("GM_FOLLOWUP_TEXT_SECRET") === false && playerSafeJson.includes("GM_FOLLOWUP_SECRET") === false, "public summary view is readable, keeps safe fields, and strips GM-only raw/followup fields");
  const beforeCompleted = JSON.stringify(completed);
  prepareTravelV2CompletedSessionSummaryViewState(completed, { includeGmSummary: true });
  assert(JSON.stringify(completed) === beforeCompleted, "completed summary view preparation does not mutate session data");
  checked.push("completed summary view state");

  const older = { ...completed, key: "older", completedAt: "2026-01-01T00:00:00.000Z" };
  const newer = { ...completed, key: "newer", completedAt: "2026-01-03T00:00:00.000Z", travelV2EventOutcomeApplication: { appliedAt: "2026-01-03T00:15:00.000Z" } };
  const history = prepareTravelV2CompletedSessionHistoryState([{ session: older, key: "older" }, { session: newer, key: "newer" }]);
  assert(history.rows.length === 2 && history.rows[0].key === "newer" && history.rows[0].applicationStatusKey === "outcomeApplied" && history.rows[1].applicationStatusKey === "completedNotApplied" && history.rows[0].canReopen === true && history.rows[0].canDelete === true && history.rows[0].completedAtLabel && history.rows[0].appliedAtLabel && history.rows[0].summaryView.publicSummary.title === "Public Win" && history.rows[0].session.travelV2CompletionSummary, "completed history sorts newest first with stored summary, date/time labels, application states, reopen, and delete");
  checked.push("completed history state");

  const libraryStateRows = prepareTravelV2CompletedSessionHistoryState({ entries: [{ ...newer, session: undefined, status: "completed", completedAt: newer.completedAt, eventName: "Old Saved", key: "old-entry" }, { key: "bad", status: "completed", completedAt: "", isMalformed: true }] });
  assert(libraryStateRows.rows.length === 2 && libraryStateRows.rows[0].canDelete === true && libraryStateRows.rows[1].completedAtLabel === "Missing timestamp", "completed history handles old saved entries, malformed entries, and missing timestamps");
  checked.push("completed history malformed and missing timestamp state");

  const emptyHistory = prepareTravelV2CompletedSessionHistoryState({ entries: [] });
  assert(emptyHistory.hasRows === false && emptyHistory.count === 0, "completed history handles empty library");
  checked.push("completed history empty state");

  const filtered = filterTravelV2CompletedSessionEntries([{ session: older, key: "older" }, { session: sample.session, key: "active" }, { key: "entry-completed", status: "completed", completedAt: "2026-01-04T00:00:00.000Z" }]);
  assert(filtered.length === 2, "completed session filter returns only completed entries");
  checked.push("completed session filter helper");

  const actorRecordSentinel = { actorApplicationRecords: [{ id: "actor-apply" }], followUps: [{ id: "follow-up" }] };
  const library = { version: 1, sessions: { older: { key: "older", name: "Older", status: "completed", completedAt: older.completedAt, session: { ...older, travelV2ActorApplication: { appliedAt: "2026-01-02T00:30:00.000Z", sentinel: actorRecordSentinel.actorApplicationRecords }, travelV2FollowUps: { records: actorRecordSentinel.followUps } } }, active: { key: "active", name: "Active", status: "active", session: sample.session } } };
  const deleted = await deleteTravelV2CompletedSessionFromLibrary("older", { library, dryRun: true });
  assert(deleted.ok && !deleted.library.sessions.older && deleted.library.sessions.active && actorRecordSentinel.actorApplicationRecords.length === 1 && actorRecordSentinel.followUps.length === 1, "delete completed helper removes only runner session library entry and leaves actor record sentinels untouched");
  checked.push("completed session delete helper safety");

  return { ok: true, checked };
}
