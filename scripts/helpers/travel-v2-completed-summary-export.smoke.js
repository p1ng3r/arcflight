import assert from "node:assert/strict";
import {
  buildTravelV2CompletedSummaryExportState,
  buildTravelV2CompletedSummaryMarkdown,
  buildTravelV2CompletedSummaryHtml,
  copyTravelV2CompletedSummaryMarkdown
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
  for (const secret of ["GM_SUMMARY_SECRET", "GM_PRESSURE_SECRET", "GM_ROUND_SECRET", "GM_FOLLOWUP_TEXT_SECRET", "GM_FOLLOWUP_SECRET"]) assert.equal(publicBlob.includes(secret), false, `public export excludes ${secret}`);
  const gm = buildTravelV2CompletedSummaryMarkdown(session, { includeGmSummary: true });
assert.match(gm.markdown, /GM Summary/);
assert.match(gm.markdown, /GM_SUMMARY_SECRET/);
assert.equal(JSON.stringify(session), before, "export builders do not mutate input session");
  const copied = await copyTravelV2CompletedSummaryMarkdown(session, { clipboard: null });
assert.equal(copied.copied, false, "clipboard helper returns fallback when unavailable");
assert.equal(copied.fallbackText, copied.markdown);
assert.equal(globalThis.ChatMessage?.create, undefined, "chat export is not performed by helper smoke");
assert.equal(globalThis.JournalEntry?.create, undefined, "journal export is not performed by helper smoke");
  return { checked: ["completed summary markdown/html export", "public player safety", "gm summary export", "input immutability", "clipboard fallback", "chat/journal not performed"] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2CompletedSummaryExportSmokeChecks().then((result) => {
    console.log("Travel v2 completed summary export smoke passed.");
    console.log(JSON.stringify(result));
  });
}
