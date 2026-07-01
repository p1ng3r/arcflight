import assert from "node:assert/strict";
import {
  buildTravelV2CompletedSummaryExportState,
  buildTravelV2CompletedSummaryMarkdown,
  buildTravelV2CompletedSummaryHtml,
  copyTravelV2CompletedSummaryMarkdown,
  prepareTravelV2CompletedSummaryChatData,
  postTravelV2CompletedSummaryToChat,
  prepareTravelV2CompletedSummaryJournalData,
  createTravelV2CompletedSummaryJournalEntry
} from "./travel-v2-completed-summary-export.js";

export default async function runTravelV2CompletedSummaryExportSmokeChecks() {
const session = {
  status: "completed",
  completedAt: "2026-01-02T00:00:00.000Z",
  completedByUserName: "GM Ada",
  travelV2CompletionSummary: {
    eventTitle: "Secret Lantern",
    actorName: "Aster",
    completedAt: "2026-01-02T00:00:00.000Z",
    finalOutcomeLabel: "Costly passage",
    publicSummary: { title: "Public Win", paragraphs: ["Crew endured the route."], chips: ["Travel complete"] },
    gmSummary: { paragraphs: ["GM_SUMMARY_SECRET"], nextSteps: ["GM_NEXT_SECRET"], warnings: [] },
    gmNotes: "GM_NOTES_SECRET",
    rounds: [{
      roundIndex: 0,
      roundNumber: 1,
      title: "Static",
      status: "finalized",
      stationResults: [{ stationKey: "navigator", stationName: "Navigator", resultLabel: "Failure", publicSummary: "Navigator: Failure." }],
      pressureApplication: { secret: "GM_PRESSURE_SECRET" },
      roundOutcome: { secret: "GM_ROUND_SECRET" },
      consequencesGenerated: [{ id: "c1" }],
      consequencesHandled: []
    }],
    totals: { consequencesApplied: 1, consequencesDismissed: 2, consequencesPending: 3, resourceDeltas: { fuel: -1, strain: 2 } },
    followups: [{ id: "f1", title: "Repair beacon", status: "pending", publicSummary: "Fix it.", text: "GM_FOLLOWUP_TEXT_SECRET", gmSummary: "GM_FOLLOWUP_SECRET" }]
  }
};

const before = JSON.stringify(session);
  const markdown = buildTravelV2CompletedSummaryMarkdown(session);
assert.equal(markdown.available, true, "Markdown export exists for completed session");
assert.match(markdown.markdown, /Secret Lantern/);
  const html = buildTravelV2CompletedSummaryHtml(session);
assert.equal(html.available, true, "HTML export exists for completed session");
assert.match(html.html, /<section/);
  const publicState = buildTravelV2CompletedSummaryExportState(session);
  const publicBlob = JSON.stringify(publicState) + markdown.markdown + html.html;
  for (const secret of ["GM_SUMMARY_SECRET", "GM_PRESSURE_SECRET", "GM_ROUND_SECRET", "GM_FOLLOWUP_TEXT_SECRET", "GM_FOLLOWUP_SECRET", "GM_NOTES_SECRET"]) assert.equal(publicBlob.includes(secret), false, `public export excludes ${secret}`);
  const gm = buildTravelV2CompletedSummaryMarkdown(session, { includeGmSummary: true });
assert.match(gm.markdown, /GM Summary/);
assert.match(gm.markdown, /GM_SUMMARY_SECRET/);
assert.equal(JSON.stringify(session), before, "export builders do not mutate input session");
  const copied = await copyTravelV2CompletedSummaryMarkdown(session, { clipboard: null });
assert.equal(copied.copied, false, "clipboard helper returns fallback when unavailable");
assert.equal(copied.fallbackText, copied.markdown);
  const chatPrepared = prepareTravelV2CompletedSummaryChatData(session);
assert.equal(chatPrepared.available, true, "public chat data can be prepared");
assert.ok(chatPrepared.chatData?.content, "chat content exists");
  const journalPrepared = prepareTravelV2CompletedSummaryJournalData(session);
assert.equal(journalPrepared.available, true, "public journal data can be prepared");
assert.ok(journalPrepared.journalData?.pages?.[0]?.text?.content, "journal content exists");
  const sideEffectBlob = chatPrepared.chatData.content + journalPrepared.journalData.pages[0].text.content + JSON.stringify(journalPrepared.journalData);
  for (const secret of ["GM_SUMMARY_SECRET", "GM_PRESSURE_SECRET", "GM_ROUND_SECRET", "GM_FOLLOWUP_TEXT_SECRET", "GM_FOLLOWUP_SECRET", "GM_NOTES_SECRET"]) assert.equal(sideEffectBlob.includes(secret), false, `public side effect data excludes ${secret}`);
  let chatCreateCalled = false;
  globalThis.ChatMessage = { create: () => { chatCreateCalled = true; throw new Error("dry run should not create chat"); } };
  const chatDryRun = await postTravelV2CompletedSummaryToChat(session, { dryRun: true });
assert.equal(chatDryRun.created, false, "dry run chat is not created");
assert.equal(chatCreateCalled, false, "dry run chat does not call ChatMessage.create");
  let journalCreateCalled = false;
  globalThis.JournalEntry = { create: () => { journalCreateCalled = true; throw new Error("dry run should not create journal"); } };
  const journalDryRun = await createTravelV2CompletedSummaryJournalEntry(session, { dryRun: true });
assert.equal(journalDryRun.created, false, "dry run journal is not created");
assert.equal(journalCreateCalled, false, "dry run journal does not call JournalEntry.create");
  globalThis.ChatMessage = {};
  const chatFailure = await postTravelV2CompletedSummaryToChat(session);
assert.equal(chatFailure.ok, false, "real chat helper cleanly fails without ChatMessage.create");
assert.match(chatFailure.errors[0], /ChatMessage\.create/);
  globalThis.JournalEntry = {};
  const journalFailure = await createTravelV2CompletedSummaryJournalEntry(session);
assert.equal(journalFailure.ok, false, "real journal helper cleanly fails without JournalEntry.create");
assert.match(journalFailure.errors[0], /JournalEntry\.create/);
  delete globalThis.ChatMessage;
  delete globalThis.JournalEntry;
  return { checked: ["completed summary markdown/html export", "public player safety", "gm summary export", "input immutability", "clipboard fallback", "chat/journal preparation", "dry run side effects", "missing create failures"] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2CompletedSummaryExportSmokeChecks().then((result) => {
    console.log("Travel v2 completed summary export smoke passed.");
    console.log(JSON.stringify(result));
  });
}
