import { applyTravelEventBuilderFormDataToDraft, applyTravelEventBuilderRoundFormDataToDraft, finalizeTravelEventDraft, normalizeTravelEventDraft } from "../helpers/travel-event-builder.js";
import { exportTravelEventDraftToJson, importTravelEventDraftFromJson } from "../helpers/travel-event-builder-io.js";
import { createTravelEventRunnerSession } from "../helpers/travel-event-runner.js";

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
          { skill: "survival", label: "Read the Drift", helpText: "Use terrain signs to find a safer lane." },
          { skill: "society", label: "Recall Charting Lore", helpText: "Lean on old routes and port records." }
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
assert(editedCard.skillApproaches[1].label === "Recall Charting Lore", "station card skill approaches survive round form application");
assert(editedCard.rollFeedback.failure === "Edited failure.", "station card roll feedback survives round form application");
const exported = exportTravelEventDraftToJson(editedDraft, { now: "2026-06-15T00:00:00.000Z" });
assert(exported.ok, `edited draft exports: ${(exported.errors ?? []).join(", ")}`);
const imported = importTravelEventDraftFromJson(exported.json, { now: "2026-06-15T00:00:00.000Z" });
assert(imported.ok, `edited draft imports: ${(imported.errors ?? []).join(", ")}`);
const importedCard = imported.draft.rounds[0].stationCards[0];
assert(importedCard.problem === editedCard.problem, "edited problem survives export/import");
assert(importedCard.skillApproaches[0].helpText === "Use terrain signs to find a safer lane.", "edited skill approach survives export/import");
assert(importedCard.rollFeedback.criticalFailure === "Edited critical failure.", "edited roll feedback survives export/import");
const finalized = finalizeTravelEventDraft(imported.draft, { now: "2026-06-15T00:00:00.000Z" });
assert(finalized.ok, `edited draft finalizes: ${(finalized.errors ?? []).join(", ")}`);
const editedRunner = createTravelEventRunnerSession(finalized.event, {
  ship: { id: "ship", uuid: "Actor.ship", name: "Smoke Ship", type: "vehicle" },
  now: "2026-06-15T00:00:00.000Z"
});
assert(editedRunner.ok, `runner session starts from edited event: ${(editedRunner.errors ?? []).join(", ")}`);
assert(editedRunner.session.event.rounds[0].stationCards[0].problem === editedCard.problem, "runner session exposes edited station cards");

const formApplied = applyTravelEventBuilderFormDataToDraft(legacyEvent, {
  openingVignette: "A form-provided opening survives normalization."
}, { now: "2026-06-15T00:00:00.000Z" });
assert(formApplied.openingVignette === "A form-provided opening survives normalization.", "openingVignette survives form application");

console.log("Phase V travel card schema smoke checks passed.");
