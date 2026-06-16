import { applyTravelEventBuilderFormDataToDraft, applyTravelEventBuilderRoundFormDataToDraft, finalizeTravelEventDraft, normalizeTravelEventDraft } from "../helpers/travel-event-builder.js";
import { exportTravelEventDraftToJson, importTravelEventDraftFromJson } from "../helpers/travel-event-builder-io.js";
import {
  createTravelEventRunnerSession,
  exportTravelEventRunnerSessionToJson,
  importTravelEventRunnerSessionFromJson,
  prepareTravelEventRunnerState,
  prepareTravelSceneOverlayState,
  setTravelEventRunnerStationResult,
  setTravelEventRunnerStationSkillApproach
} from "../helpers/travel-event-runner.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const feedback = {
  criticalSuccess: "Cleanly solved.",
  success: "Solved.",
  failure: "Complicated.",
  criticalFailure: "Worsened."
};

const legacyEvent = {
  key: "phase-v-legacy-card-smoke",
  name: "Phase V Legacy Card Smoke",
  category: "discovery",
  tags: [],
  roundCount: 1,
  baseDC: 18,
  activeResources: ["hull"],
  travelStations: ["navigator"],
  description: "A legacy event without explicit station cards.",
  gmSummary: "Smoke-test event only.",
  rounds: [
    {
      round: 1,
      title: "Legacy Round",
      openingVignette: "A legacy prompt needs card migration.",
      activeStations: ["navigator"],
      stationPrompts: {
        navigator: {
          stationKey: "navigator",
          stationName: "Navigator",
          playerAction: "Plot a safe course using only legacy player action text.",
          suggestedSkills: ["survival", "society"],
          rollFeedback: feedback
        }
      },
      outcomeBranches: {
        dominantSuccess: { vignette: "Better.", proposedEffects: [] },
        mixed: { vignette: "Mixed.", proposedEffects: [] },
        dominantFailure: { vignette: "Worse.", proposedEffects: [] },
        catastrophicFailure: { vignette: "Worst.", proposedEffects: [] }
      }
    }
  ],
  finalOutcomes: {
    criticalSuccess: { label: "Critical Success", vignette: "Best.", proposedEffects: [], rewards: [], losses: [] },
    success: { label: "Success", vignette: "Good.", proposedEffects: [], rewards: [], losses: [] },
    mixed: { label: "Mixed", vignette: "Costly.", proposedEffects: [], rewards: [], losses: [] },
    failure: { label: "Failure", vignette: "Bad.", proposedEffects: [], rewards: [], losses: [] },
    criticalFailure: { label: "Critical Failure", vignette: "Terrible.", proposedEffects: [], rewards: [], losses: [] }
  }
};

const normalized = normalizeTravelEventDraft(legacyEvent, { now: "2026-06-15T00:00:00.000Z" });
const builderCard = normalized.rounds[0].stationCards[0];
assert(builderCard.stationKey === "navigator", "builder fallback card keeps stationKey");
assert(builderCard.stationName === "Navigator", "builder fallback card keeps stationName");
assert(builderCard.problem === "Plot a safe course using only legacy player action text.", "builder fallback card derives problem from playerAction");
assert(builderCard.skillApproaches.length === 2, "builder fallback card derives skill approaches from suggestedSkills");
assert(builderCard.skillApproaches[0].label !== "survival" && builderCard.skillApproaches[0].label !== "Survival", "builder fallback approach label is method-style, not the raw skill name");
assert(builderCard.skillApproaches[0].helpText && builderCard.skillApproaches[0].helpText !== builderCard.problem, "builder fallback approach helpText explains a method distinct from the problem");
assert(builderCard.rollFeedback.success === feedback.success, "builder fallback card preserves roll feedback");
assert(Array.isArray(builderCard.hooks.rooms), "builder fallback card has hook arrays");

const runner = createTravelEventRunnerSession(legacyEvent, {
  ship: { id: "ship", uuid: "Actor.ship", name: "Smoke Ship", type: "vehicle" },
  now: "2026-06-15T00:00:00.000Z"
});
assert(runner.ok, `runner session starts from legacy event: ${(runner.errors ?? []).join(", ")}`);
const runnerCard = runner.session.event.rounds[0].stationCards[0];
assert(runnerCard.stationKey === "navigator", "runner fallback card has stationKey");
assert(runnerCard.stationName === "Navigator", "runner fallback card has stationName");
assert(runnerCard.problem === "Plot a safe course using only legacy player action text.", "runner fallback card derives problem from playerAction");
assert(runnerCard.skillApproaches.length === 2, "runner fallback card derives skill approaches");
assert(runnerCard.skillApproaches[1].label !== "society" && runnerCard.skillApproaches[1].label !== "Society", "runner fallback approach label is not just the raw skill name");
assert(runnerCard.skillApproaches[1].helpText && runnerCard.skillApproaches[1].helpText !== runnerCard.problem, "runner fallback approach helpText exists and differs from problem");
assert(runnerCard.rollFeedback.criticalFailure === feedback.criticalFailure, "runner fallback card preserves roll feedback");
assert(Array.isArray(runnerCard.hooks.rooms) && Array.isArray(runnerCard.hooks.factions), "runner fallback card has full hook shape");
assert(!Object.hasOwn(runnerCard, "playerAction"), "runner stationCards are not raw legacy prompt objects");

const editedDraft = applyTravelEventBuilderRoundFormDataToDraft(legacyEvent, {
  rounds: [{
    round: 1,
    activeStations: ["navigator"],
    stationCards: {
      navigator: {
        problem: "Edited station card problem survives the full authoring pipeline.",
        skillApproaches: [
          { skill: "survival", label: "Hold the Original Course", helpText: "Use terrain signs, vessel motion, and pressure changes to find a safer lane through the hazard." },
          { skill: "society", label: "Recall Past Crossings", helpText: "Use old routes, port records, and crew reports to identify a proven way around the problem." }
        ],
        rollFeedback: {
          criticalSuccess: "Edited critical success.",
          success: "Edited success.",
          failure: "Edited failure.",
          criticalFailure: "Edited critical failure."
        }
      }
    }
  }]
}, { now: "2026-06-15T00:00:00.000Z" });
const editedCard = editedDraft.rounds[0].stationCards[0];
assert(editedCard.problem === "Edited station card problem survives the full authoring pipeline.", "station card problem survives round form application");
assert(editedCard.skillApproaches[1].label === "Recall Past Crossings", "station card skill approaches survive round form application");
assert(editedCard.skillApproaches[1].label !== "Society" && editedCard.skillApproaches[1].label.toLowerCase() !== editedCard.skillApproaches[1].skill, "station card approach label is a plan instead of a raw skill name");
assert(editedCard.rollFeedback.failure === "Edited failure.", "station card roll feedback survives round form application");
const exported = exportTravelEventDraftToJson(editedDraft, { now: "2026-06-15T00:00:00.000Z" });
assert(exported.ok, `edited draft exports: ${(exported.errors ?? []).join(", ")}`);
const imported = importTravelEventDraftFromJson(exported.json, { now: "2026-06-15T00:00:00.000Z" });
assert(imported.ok, `edited draft imports: ${(imported.errors ?? []).join(", ")}`);
const importedCard = imported.draft.rounds[0].stationCards[0];
assert(importedCard.problem === editedCard.problem, "edited problem survives export/import");
assert(importedCard.skillApproaches[0].helpText === "Use terrain signs, vessel motion, and pressure changes to find a safer lane through the hazard.", "edited skill approach survives export/import");
assert(importedCard.rollFeedback.criticalFailure === "Edited critical failure.", "edited roll feedback survives export/import");
const finalized = finalizeTravelEventDraft(imported.draft, { now: "2026-06-15T00:00:00.000Z" });
assert(finalized.ok, `edited draft finalizes: ${(finalized.errors ?? []).join(", ")}`);
const editedRunner = createTravelEventRunnerSession(finalized.event, {
  ship: { id: "ship", uuid: "Actor.ship", name: "Smoke Ship", type: "vehicle" },
  now: "2026-06-15T00:00:00.000Z"
});
assert(editedRunner.ok, `runner session starts from edited event: ${(editedRunner.errors ?? []).join(", ")}`);
assert(editedRunner.session.event.rounds[0].stationCards[0].problem === editedCard.problem, "runner session exposes edited station cards");
const runnerState = prepareTravelEventRunnerState(editedRunner.session);
const stationRow = runnerState.stations.find((row) => row.stationKey === "navigator");
assert(stationRow.skillApproaches.length === 2, "runner station row exposes both station-card approaches");
assert(stationRow.skillApproaches.some((approach) => approach.skill === "survival"), "runner station row exposes survival approach");
assert(stationRow.skillApproaches.some((approach) => approach.skill === "society"), "runner station row exposes society approach");
const selectedSociety = setTravelEventRunnerStationSkillApproach(editedRunner.session, 0, "navigator", "society", { now: "2026-06-15T00:00:00.000Z" });
assert(selectedSociety.ok, `station approach updates to society: ${(selectedSociety.errors ?? []).join(", ")}`);
const selectedState = prepareTravelEventRunnerState(selectedSociety.session);
const selectedRow = selectedState.stations.find((row) => row.stationKey === "navigator");
assert(selectedRow.selectedSkill === "society", "prepared station row uses society as selected skill");
assert(selectedRow.selectedApproach.label === "Recall Past Crossings", "selected approach exposes the narrative plan label");
assert(selectedRow.selectedApproach.label !== "Society" && selectedRow.selectedApproach.label.toLowerCase() !== selectedRow.selectedApproach.skill, "selected approach label is not just Society or the raw skill name");
assert(selectedRow.selectedApproach.helpText && selectedRow.selectedApproach.helpText !== selectedRow.problem, "selected approach exposes How This Helps text distinct from the station problem");
assert(selectedRow.statisticLabel.includes("Society") || selectedRow.selectedSkillLabel === "Society", "prepared station row uses society as selected statistic label");
const sessionExport = exportTravelEventRunnerSessionToJson(selectedSociety.session, { now: "2026-06-15T00:00:00.000Z" });
assert(sessionExport.ok, `runner session exports selected approach: ${(sessionExport.errors ?? []).join(", ")}`);
const sessionImport = importTravelEventRunnerSessionFromJson(sessionExport.json, { now: "2026-06-15T00:00:00.000Z" });
assert(sessionImport.ok, `runner session imports selected approach: ${(sessionImport.errors ?? []).join(", ")}`);
assert(sessionImport.session.roundResults[0].selectedStationSkills.navigator === "society", "selected station skill survives runner session export/import");
const importedRunnerCard = sessionImport.session.event.rounds[0].stationCards[0];
assert(importedRunnerCard.skillApproaches[1].label === "Recall Past Crossings", "selected approach label survives runner session export/import");
assert(importedRunnerCard.skillApproaches[1].helpText === selectedRow.selectedApproach.helpText, "selected approach How This Helps text survives runner session export/import");



const twoStationEvent = JSON.parse(JSON.stringify(legacyEvent));
twoStationEvent.key = "phase-v-two-station-feedback-smoke";
twoStationEvent.name = "Phase V Two Station Feedback Smoke";
twoStationEvent.travelStations = ["navigator", "engineer", "watchmaster"];
twoStationEvent.rounds[0].activeStations = ["navigator", "engineer", "watchmaster"];
twoStationEvent.rounds[0].stationPrompts.engineer = {
  stationKey: "engineer",
  stationName: "Engineer",
  playerAction: "Keep the engine rhythm steady against the false current.",
  suggestedSkills: ["crafting", "arcana"],
  rollFeedback: feedback
};
twoStationEvent.rounds[0].stationPrompts.watchmaster = {
  stationKey: "watchmaster",
  stationName: "Watchmaster",
  playerAction: "Watch for false silhouettes along the current.",
  suggestedSkills: ["perception"],
  rollFeedback: feedback
};
twoStationEvent.rounds[0].stationCards = [
  {
    stationKey: "navigator",
    stationName: "Navigator",
    problem: "The void-current is pulling the ship off its charted path.",
    skillApproaches: [
      { skill: "society", label: "Recall Past Crossings", helpText: "Remember route marks, port records, warning songs, and reports from crews who survived this passage." }
    ],
    rollFeedback: { ...feedback, failure: "Naria remembers the warning, but not the safe bearing." }
  },
  {
    stationKey: "engineer",
    stationName: "Engineer",
    problem: "The arkengine is humming in sympathy with the false current.",
    skillApproaches: [
      { skill: "arcana", label: "Tune the Harmonic", helpText: "Adjust the arkengine resonance to reveal and counter the current dragging the ship off course." }
    ],
    rollFeedback: { ...feedback, success: "Bramble syncs the arkengine cleanly against the song's vibration." }
  },
  {
    stationKey: "watchmaster",
    stationName: "Watchmaster",
    problem: "False silhouettes pace the ship without choosing a side.",
    skillApproaches: [
      { skill: "perception", label: "Track the True Shadow", helpText: "Compare reflections and movement to separate real threats from tricks of the crossing." }
    ],
    rollFeedback: feedback
  }
];
const twoStationRunner = createTravelEventRunnerSession(twoStationEvent, {
  ship: { id: "ship", uuid: "Actor.ship", name: "Smoke Ship", type: "vehicle" },
  stationAssignments: {
    navigator: { stationKey: "navigator", actorId: "naria", actorUuid: "Actor.naria", actorName: "Naria", source: "manual" },
    engineer: { stationKey: "engineer", actorId: "bramble", actorUuid: "Actor.bramble", actorName: "Bramble", source: "manual" }
  },
  now: "2026-06-15T00:00:00.000Z"
});
assert(twoStationRunner.ok, `two-station runner starts: ${(twoStationRunner.errors ?? []).join(", ")}`);
const selectedTwoStationApproach = setTravelEventRunnerStationSkillApproach(twoStationRunner.session, 0, "navigator", "society", { now: "2026-06-15T00:00:00.000Z" });
assert(selectedTwoStationApproach.ok, `two-station navigator approach selects: ${(selectedTwoStationApproach.errors ?? []).join(", ")}`);
const navigatorFailure = setTravelEventRunnerStationResult(selectedTwoStationApproach.session, 0, "navigator", "failure", { now: "2026-06-15T00:00:00.000Z" });
assert(navigatorFailure.ok, `navigator failure result records: ${(navigatorFailure.errors ?? []).join(", ")}`);
const engineerSuccess = setTravelEventRunnerStationResult(navigatorFailure.session, 0, "engineer", "success", { now: "2026-06-15T00:00:00.000Z" });
assert(engineerSuccess.ok, `engineer success result records: ${(engineerSuccess.errors ?? []).join(", ")}`);
const feedbackState = prepareTravelEventRunnerState(engineerSuccess.session);
const navigatorFeedbackRow = feedbackState.stations.find((row) => row.stationKey === "navigator");
const engineerFeedbackRow = feedbackState.stations.find((row) => row.stationKey === "engineer");
assert(navigatorFeedbackRow.resultFeedback === "Naria remembers the warning, but not the safe bearing.", "station row exposes failure resultFeedback from rollFeedback.failure");
assert(navigatorFeedbackRow.hasResultFeedback, "station row marks resultFeedback as available");
assert(engineerFeedbackRow.resultFeedback === "Bramble syncs the arkengine cleanly against the song's vibration.", "station row exposes success resultFeedback from rollFeedback.success");
assert(feedbackState.roundSummaryCard.hasResolvedStations, "round summary card appears when stations have results");
assert(feedbackState.roundSummaryCard.resolvedStationCount === 2, "round summary includes both resolved stations");
assert(feedbackState.roundSummaryCard.unresolvedStationCount === 1, "round summary counts unresolved stations");
assert(feedbackState.roundSummaryCard.successCount === 1 && feedbackState.roundSummaryCard.failureCount === 1, "round summary counts success-side and failure-side results");
assert(feedbackState.roundSummaryCard.summaryLines.some((line) => line.includes("Naria at Navigator used Recall Past Crossings and scored Failure")), "round summary lines include actor, station, result, and selected navigator approach");
assert(feedbackState.roundSummaryCard.summaryLines.some((line) => line.includes("Bramble at Engineer used Tune the Harmonic and scored Success")), "round summary lines include actor, station, result, and selected engineer approach");
assert(feedbackState.roundSummaryCard.summaryText.includes("Naria") && feedbackState.roundSummaryCard.summaryText.includes("Bramble"), "round summary prose includes both actor names");
assert(feedbackState.roundSummaryCard.summaryText.includes("Naria remembers the warning, but not the safe bearing."), "round summary prose includes navigator failure feedback");
assert(feedbackState.roundSummaryCard.summaryText.includes("Bramble syncs the arkengine cleanly against the song's vibration."), "round summary prose includes engineer success feedback");
assert(feedbackState.roundSummaryCard.summaryText !== feedbackState.roundSummaryCard.summaryLines.join("\n"), "round summary prose is not just raw summary lines joined together");
assert(!feedbackState.roundSummaryCard.summaryText.includes("used Recall Past Crossings and scored Failure"), "round summary prose avoids report-style used/scored phrasing");
const overlayState = prepareTravelSceneOverlayState(engineerSuccess.session);
assert(overlayState.hasSession, "travel scene overlay state detects active runner session");
assert(overlayState.eventName === "Phase V Two Station Feedback Smoke", "travel scene overlay state exposes event name");
assert(overlayState.roundLabel === "Round 1" && overlayState.roundTitle === "Legacy Round", "travel scene overlay state exposes round number and title");
assert(overlayState.vignette === "A legacy prompt needs card migration.", "travel scene overlay state exposes current round vignette");
assert(overlayState.stations.length === 3, "travel scene overlay state exposes active stations");
assert(overlayState.stations.some((row) => row.stationName === "Navigator" && row.assignedActorName === "Naria" && row.approachLabel === "Recall Past Crossings" && row.resultLabel === "Failure"), "travel scene overlay state exposes station actor, approach, and result labels");
assert(overlayState.stations.some((row) => row.stationName === "Watchmaster" && row.assignedActorName === "Unassigned" && row.resultLabel === "Unrecorded"), "travel scene overlay state keeps unassigned/unresolved station labels readable");
assert(overlayState.gmRoundSummaryText === feedbackState.roundSummaryCard.summaryText, "travel scene overlay state reuses GM round summary text");
const emptyOverlayState = prepareTravelSceneOverlayState(null);
assert(!emptyOverlayState.hasSession && emptyOverlayState.emptyMessage.includes("No Travel Event Runner session"), "travel scene overlay state has clear empty state");

const formApplied = applyTravelEventBuilderFormDataToDraft(legacyEvent, {
  openingVignette: "A form-provided opening survives normalization."
}, { now: "2026-06-15T00:00:00.000Z" });
assert(formApplied.openingVignette === "A form-provided opening survives normalization.", "openingVignette survives form application");

console.log("Phase V travel card schema smoke checks passed.");
