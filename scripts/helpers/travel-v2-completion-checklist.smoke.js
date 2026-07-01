import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareTravelEventRunnerState, prepareTravelV2CompletionChecklistState } from "./travel-event-runner.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "../apps/travel-event-runner-v2-preview-consumer.js";

function session(extra = {}) {
  return {
    key: "s1",
    status: "active",
    startedAt: "2026-06-20T00:00:00.000Z",
    currentRoundIndex: 0,
    event: {
      key: "event-1",
      name: "Lantern Crossing",
      category: "test",
      baseDC: 15,
      rounds: [{ title: "Round One", activeStations: [] }],
      finalOutcomes: { success: { key: "success", label: "Clean Arrival", text: "Arrived.", proposedEffects: [{ type: "resource", resource: "strain", mode: "add", value: -1 }] } }
    },
    roundResults: [{ stationResults: {}, stationActions: {} }],
    ship: { actorId: "ship-1", actorName: "Aster" },
    travelV2EventCompletion: { completed: false },
    travelV2RoundResolutions: { records: [{ roundIndex: 0, roundNumber: 1, effectiveOutcomeKey: "success", finalizedAt: "2026-06-20T00:05:00.000Z" }] },
    summary: null,
    ...extra
  };
}

function completed(extra = {}) {
  return session({
    status: "completed",
    completedAt: "2026-06-20T00:10:00.000Z",
    travelV2EventCompletion: { completed: true },
    travelV2CompletionSummary: {
      eventTitle: "Lantern Crossing",
      actorName: "Aster",
      completedAt: "2026-06-20T00:10:00.000Z",
      finalOutcomeLabel: "Clean Arrival",
      publicSummary: { title: "Arrived", paragraphs: ["The ship arrived."], chips: [] },
      rounds: [],
      totals: { consequencesApplied: 0, consequencesDismissed: 0, consequencesPending: 0, resourceDeltas: {} },
      followups: []
    },
    summary: {
      totalScore: 1,
      suggestedFinalOutcome: "success",
      suggestedFinalOutcomeLabel: "Clean Arrival",
      finalOutcomeText: "Arrived.",
      stagedProposedEffects: [{ type: "resource", resource: "strain", mode: "add", value: -1 }],
      stagedProposedEffectRows: []
    },
    ...extra
  });
}

export default async function runTravelV2CompletionChecklistSmokeChecks() {
  assert.doesNotThrow(() => prepareTravelV2CompletionChecklistState(null, { user: { isGM: true } }), "null checklist state is safe");
  const emptyRunner = prepareTravelEventRunnerState(null, { user: { isGM: true }, library: { events: {} }, runnerSessionLibrary: { sessions: {} } });
  assert.equal(emptyRunner.hasSession, false, "empty runner remains empty");
  assert.equal(emptyRunner.completionChecklist.hasSession, false, "empty runner includes safe no-session checklist");

  const active = session();
  const before = JSON.stringify(active);
  const activeChecklist = prepareTravelV2CompletionChecklistState(active, { user: { isGM: true } });
  assert.equal(activeChecklist.isCompleted, false, "active session is not completed");
  assert.equal(JSON.stringify(active), before, "active checklist preparation does not mutate session");

  const completeChecklist = prepareTravelV2CompletionChecklistState(completed(), { user: { isGM: true } });
  assert.equal(completeChecklist.isCompleted, true, "completed session is marked completed");
  assert.ok(completeChecklist.rows.length >= 8, "completed checklist has completion rows");

  const packageApplied = prepareTravelV2CompletionChecklistState(completed({ travelV2EventOutcomeApplication: { applied: true } }), { user: { isGM: true } });
  assert.equal(packageApplied.rows.find((row) => row.key === "package-level-application")?.done, true, "package application is done");
  assert.notEqual(packageApplied.rows.find((row) => row.key === "final-outcome-ship-apply")?.done, true, "package application does not imply ship application");

  const shipApplied = prepareTravelV2CompletionChecklistState(completed({ travelV2FinalOutcomeShipApplication: { applied: true } }), { user: { isGM: true } });
  assert.equal(shipApplied.rows.find((row) => row.key === "final-outcome-ship-apply")?.done, true, "ship application is done from ship application record");

  const previousGame = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  try {
    const explicitNonGmChecklist = prepareTravelV2CompletionChecklistState(completed(), { user: { isGM: false } });
    assert.equal(explicitNonGmChecklist.visible, false, "explicit non-GM user overrides GM global fallback");
    const fallbackGmChecklist = prepareTravelV2CompletionChecklistState(completed());
    assert.equal(fallbackGmChecklist.visible, true, "missing user falls back to global GM user");
  } finally {
    globalThis.game = previousGame;
  }

  const nonGmState = prepareTravelEventRunnerState(completed({ travelV2EventOutcomeApplication: { applied: true, before: { hull: 1 }, marker: "GM-only management details" }, travelV2FinalOutcomeShipApplication: { applied: true, before: { strain: 2 }, after: { strain: 1 } } }), { user: { isGM: false }, library: { events: {} }, runnerSessionLibrary: { sessions: {} } });
  const nonGmChecklistBlob = JSON.stringify(nonGmState.completionChecklist);
  for (const secret of ["GM-only management details", "before", "after", "travelV2EventOutcomeApplication", "travelV2FinalOutcomeShipApplication"]) assert.equal(nonGmChecklistBlob.includes(secret), false, `non-GM checklist excludes ${secret}`);

  const appState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: completed(), user: { isGM: true }, library: { events: {} }, runnerSessionLibrary: { sessions: {} } });
  assert.equal(appState.completionChecklist.visible, true, "real app preview consumer path passes GM user into runner state");

  const template = readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
  for (const token of ["arcflight-travel-runner-mvp__completion-checklist", "data-arcflight-runner-copy-markdown", "data-arcflight-runner-copy-html", "data-arcflight-runner-post-chat", "data-arcflight-runner-create-journal", "data-arcflight-travel-v2-final-outcome-apply", "arcflight-travel-runner-mvp__final-outcome-package-review", "arcflight-travel-runner-mvp__final-outcome-apply"]) assert.ok(template.includes(token), `template contains ${token}`);

  return { checked: ["travel-v2-completion-checklist"] };
}
