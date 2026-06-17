import { applyTravelEventBuilderFormDataToDraft, applyTravelEventBuilderRoundFormDataToDraft, finalizeTravelEventDraft, normalizeTravelEventDraft } from "../helpers/travel-event-builder.js";
import { exportTravelEventDraftToJson, importTravelEventDraftFromJson } from "../helpers/travel-event-builder-io.js";
import {
  createTravelEventRunnerSession,
  exportTravelEventRunnerSessionToJson,
  importTravelEventRunnerSessionFromJson,
  prepareTravelEventRunnerState,
  prepareTravelPlayerMissionBoardState,
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

const schemaEvent = JSON.parse(JSON.stringify(legacyEvent));
schemaEvent.key = "phase-v-approaches-visible-feedback-smoke";
schemaEvent.name = "Phase V Approaches Visible Feedback Smoke";
schemaEvent.rounds[0].stationCards = [{
  stationKey: "navigator",
  stationName: "Navigator",
  problem: "The void-current pulls the ship away from its charted line.",
  visibleResultFeedback: {
    criticalSuccess: "Visible station critical success.",
    success: "Visible station success.",
    failure: "Visible station failure.",
    criticalFailure: "Visible station critical failure."
  },
  approaches: [
    { skill: "arcana", label: "Tune the Harmonic Wake", helpText: "You tune the Arkengine harmonic wake until the false current becomes visible in the aether.", dc: 20, boardResultFeedback: { criticalSuccess: "Arcana board critical success.", success: "Arcana board success.", failure: "Arcana board failure.", criticalFailure: "Arcana board critical failure." }, gmNarrationFeedback: { criticalSuccess: "Arcana GM critical success.", success: "Arcana GM success.", failure: "Arcana GM failure.", criticalFailure: "Arcana GM critical failure." }, gmOnlyConsequence: "Hidden arcana complication." },
    { skill: "survival", label: "Hold the Course", helpText: "You read pressure, drift, and deck vibration until the route becomes survivable instead of safe.", boardResultFeedback: { criticalSuccess: "Survival board critical success.", success: "Survival board success.", failure: "Survival board failure.", criticalFailure: "Survival board critical failure." }, gmNarrationFeedback: { criticalSuccess: "Survival GM critical success.", success: "Survival GM success.", failure: "Survival GM failure.", criticalFailure: "Survival GM critical failure." }, gmOnlyConsequence: "Hidden survival complication." },
    { skill: "society", label: "Chart the Old Tide", helpText: "You compare old route songs and port warnings to find the forgotten line through the current.", boardResultFeedback: { criticalSuccess: "Society board critical success.", success: "Society board success.", failure: "Society board failure.", criticalFailure: "Society board critical failure." }, gmNarrationFeedback: { criticalSuccess: "Society GM critical success.", success: "Society GM success.", failure: "Society GM failure.", criticalFailure: "Society GM critical failure." }, gmOnlyConsequence: "Hidden society complication." }
  ]
}];
const schemaDraft = normalizeTravelEventDraft(schemaEvent, { now: "2026-06-15T00:00:00.000Z" });
const schemaCard = schemaDraft.rounds[0].stationCards[0];
assert(schemaCard.skillApproaches.length === 3, "builder normalizes approaches into skillApproaches");
assert(schemaCard.skillApproaches[0].label === "Tune the Harmonic Wake" && schemaCard.skillApproaches[0].dc === 20, "builder preserves approach label, helpText, and dc from approaches");
assert(schemaCard.rollFeedback.success === "Visible station success.", "builder normalizes visibleResultFeedback into rollFeedback fallback");
const schemaRunner = createTravelEventRunnerSession(schemaEvent, {
  ship: { id: "ship", uuid: "Actor.ship", name: "Smoke Ship", type: "vehicle" },
  stationAssignments: { navigator: { stationKey: "navigator", actorId: "naria", actorUuid: "Actor.naria", actorName: "Naria", source: "manual" } },
  now: "2026-06-15T00:00:00.000Z"
});
assert(schemaRunner.ok, `runner starts from approaches/visibleResultFeedback schema: ${(schemaRunner.errors ?? []).join(", ")}`);
assert(schemaRunner.session.event.rounds[0].stationCards[0].skillApproaches.length === 3, "runner normalizes approaches into skillApproaches");
const selectedFallbackApproach = setTravelEventRunnerStationSkillApproach(schemaRunner.session, 0, "navigator", "survival", { now: "2026-06-15T00:00:00.000Z" });
const fallbackFailure = setTravelEventRunnerStationResult(selectedFallbackApproach.session, 0, "navigator", "failure", { now: "2026-06-15T00:00:00.000Z" });
const fallbackState = prepareTravelEventRunnerState(fallbackFailure.session);
const fallbackRow = fallbackState.stations.find((row) => row.stationKey === "navigator");
assert(fallbackRow.resultFeedback === "Survival board failure.", "approach boardResultFeedback takes precedence over visibleResultFeedback");
const noApproachFeedbackEvent = JSON.parse(JSON.stringify(schemaEvent));
delete noApproachFeedbackEvent.rounds[0].stationCards[0].approaches[1].boardResultFeedback;
const noApproachRunner = createTravelEventRunnerSession(noApproachFeedbackEvent, { ship: { id: "ship", uuid: "Actor.ship", name: "Smoke Ship", type: "vehicle" }, now: "2026-06-15T00:00:00.000Z" });
const noApproachSelected = setTravelEventRunnerStationSkillApproach(noApproachRunner.session, 0, "navigator", "survival", { now: "2026-06-15T00:00:00.000Z" });
const noApproachFailure = setTravelEventRunnerStationResult(noApproachSelected.session, 0, "navigator", "failure", { now: "2026-06-15T00:00:00.000Z" });
const noApproachRow = prepareTravelEventRunnerState(noApproachFailure.session).stations.find((row) => row.stationKey === "navigator");
assert(noApproachRow.resultFeedback === "Visible station failure.", "visibleResultFeedback works as station-level fallback before rollFeedback");

const shortSkillActor = {
  id: "shorty",
  uuid: "Actor.shorty",
  name: "Nariah Starwin",
  type: "character",
  system: {
    skills: {
      sur: { label: "Survival", mod: 9 },
      arc: { label: "Arcana", mod: 10 },
      occ: { label: "Occultism", mod: 8 },
      soc: { label: "Society", mod: 7 }
    }
  },
  getStatistic(key) { return this.system.skills[key] ?? null; }
};
const aliasEvent = JSON.parse(JSON.stringify(schemaEvent));
aliasEvent.key = "phase-v-short-skill-alias-smoke";
aliasEvent.rounds[0].stationCards[0].approaches[0].skill = "survival";
aliasEvent.rounds[0].stationCards[0].approaches[0].label = "Hold the original course";
aliasEvent.rounds[0].stationCards[0].approaches[0].dc = 20;
aliasEvent.rounds[0].stationCards[0].approaches[1].skill = "arcana";
aliasEvent.rounds[0].stationCards[0].approaches[1].dc = 20;
const aliasRunner = createTravelEventRunnerSession(aliasEvent, {
  ship: { id: "ship", uuid: "Actor.ship", name: "Smoke Ship", type: "vehicle" },
  actors: [shortSkillActor],
  stationAssignments: { navigator: { stationKey: "navigator", actorId: "shorty", actorUuid: "Actor.shorty", actorName: "Nariah Starwin", actorType: "character", source: "manual" } },
  now: "2026-06-15T00:00:00.000Z"
});
assert(aliasRunner.ok, `alias runner starts: ${(aliasRunner.errors ?? []).join(", ")}`);
const aliasSelected = setTravelEventRunnerStationSkillApproach(aliasRunner.session, 0, "navigator", "survival", { now: "2026-06-15T00:00:00.000Z" });
const aliasBoard = prepareTravelPlayerMissionBoardState(aliasSelected.session, { actors: [shortSkillActor] });
const aliasStation = aliasBoard.stations.find((row) => row.stationKey === "navigator");
assert(aliasStation.selectedApproachModifier === 9 && aliasStation.selectedApproachStatisticLabel === "Survival +9", "approach skill survival resolves to short PF2E sur skill");
assert(aliasStation.canRollStation === true, "mission board enables roll when selected approach modifier and DC resolve");
assert(aliasStation.selectedApproachLabel === "Hold the original course", "selected approach label contains the approach label");
assert(aliasStation.selectedApproachRollLabel === "Survival +9 vs DC 20", "selected approach roll label contains only statistic modifier and DC");
assert(aliasStation.approachOptions.some((approach) => approach.skill === "arcana" && approach.modifier === 10 && approach.resolvedStatisticKey === "arc"), "approach skill arcana resolves to short PF2E arc skill");
assert(aliasStation.approachOptions.some((approach) => approach.displayLabel.includes("Hold the original course") && approach.displayLabel.includes("Survival +9") && approach.displayLabel.includes("DC 20")), "mission board dropdown display includes approach label, skill modifier, and DC");

const missingSkillActor = { id: "missing", uuid: "Actor.missing", name: "No Skill Actor", type: "character", system: { skills: {} }, getStatistic() { return null; } };
const missingRunner = createTravelEventRunnerSession(aliasEvent, {
  ship: { id: "ship", uuid: "Actor.ship", name: "Smoke Ship", type: "vehicle" },
  actors: [missingSkillActor],
  stationAssignments: { navigator: { stationKey: "navigator", actorId: "missing", actorUuid: "Actor.missing", actorName: "No Skill Actor", actorType: "character", source: "manual" } },
  now: "2026-06-15T00:00:00.000Z"
});
const missingSelected = setTravelEventRunnerStationSkillApproach(missingRunner.session, 0, "navigator", "survival", { now: "2026-06-15T00:00:00.000Z" });
const missingBoard = prepareTravelPlayerMissionBoardState(missingSelected.session, { actors: [missingSkillActor] });
const missingStation = missingBoard.stations.find((row) => row.stationKey === "navigator");
assert(missingStation.canRollStation === false, "mission board keeps roll disabled when selected statistic modifier cannot resolve");
assert(missingStation.rollUnavailableReason.includes("Survival") && missingStation.rollUnavailableReason.includes("No Skill Actor"), "missing modifier reason names the statistic and actor checked");
assert(missingStation.selectedApproachRollLabel.includes("unavailable") || missingStation.selectedApproachRollLabel.includes("not found"), "missing modifier selected approach roll line explains the unresolved statistic");

const editedDraft = applyTravelEventBuilderRoundFormDataToDraft(legacyEvent, {
  rounds: [{
    round: 1,
    activeStations: ["navigator"],
    stationCards: {
      navigator: {
        problem: "Edited station card problem survives the full authoring pipeline.",
        skillApproaches: [
          { skill: "survival", label: "Hold the Original Course", helpText: "Use terrain signs, vessel motion, and pressure changes to find a safer lane through the hazard.", boardResultFeedback: { criticalSuccess: "Board survival crit.", success: "Board survival success.", failure: "Board survival failure.", criticalFailure: "Board survival crit fail." }, gmNarrationFeedback: { criticalSuccess: "GM survival crit.", success: "GM survival success.", failure: "GM survival failure.", criticalFailure: "GM survival crit fail." }, gmOnlyConsequence: "Hidden survival consequence." },
          { skill: "society", label: "Recall Past Crossings", helpText: "Use old routes, port records, and crew reports to identify a proven way around the problem.", boardResultFeedback: { criticalSuccess: "Board society crit.", success: "Board society success.", failure: "Board society failure.", criticalFailure: "Board society crit fail." }, gmNarrationFeedback: { criticalSuccess: "GM society crit.", success: "GM society success.", failure: "GM society failure.", criticalFailure: "GM society crit fail." }, gmOnlyConsequence: "Hidden society consequence." },
          { skill: "arcana", label: "Tune the Harmonic Wake", helpText: "You tune the Arkengine harmonic wake until the false current becomes visible in the aether.", boardResultFeedback: { criticalSuccess: "Board arcana crit.", success: "Board arcana success.", failure: "Board arcana failure.", criticalFailure: "Board arcana crit fail." }, gmNarrationFeedback: { criticalSuccess: "GM arcana crit.", success: "GM arcana success.", failure: "GM arcana failure.", criticalFailure: "GM arcana crit fail." }, gmOnlyConsequence: "Hidden arcana consequence." }
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
assert(editedCard.skillApproaches.length === 3, "station card supports three structured approaches");
assert(editedCard.skillApproaches[1].label === "Recall Past Crossings", "station card skill approaches survive round form application");
assert(editedCard.skillApproaches[1].label !== "Society" && editedCard.skillApproaches[1].label.toLowerCase() !== editedCard.skillApproaches[1].skill, "station card approach label is a plan instead of a raw skill name");
assert(editedCard.rollFeedback.failure === "Edited failure.", "station card roll feedback survives round form application");
const exported = exportTravelEventDraftToJson(editedDraft, { now: "2026-06-15T00:00:00.000Z" });
assert(exported.ok, `edited draft exports: ${(exported.errors ?? []).join(", ")}`);
const imported = importTravelEventDraftFromJson(exported.json, { now: "2026-06-15T00:00:00.000Z" });
assert(imported.ok, `edited draft imports: ${(imported.errors ?? []).join(", ")}`);
const importedCard = imported.draft.rounds[0].stationCards[0];
assert(importedCard.problem === editedCard.problem, "edited problem survives export/import");
assert(importedCard.skillApproaches[0].helpText === "Use terrain signs, vessel motion, and pressure changes to find a safer lane through the hazard.", "edited skill approach helpText survives export/import");
assert(importedCard.skillApproaches[1].label === "Recall Past Crossings" && importedCard.skillApproaches[1].gmOnlyConsequence === "Hidden society consequence.", "edited skill approach label and hidden consequence survive export/import");
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
assert(stationRow.skillApproaches.length === 3, "runner station row exposes all three station-card approaches");
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
const playerBoardState = prepareTravelPlayerMissionBoardState(selectedSociety.session);
const playerNavigator = playerBoardState.stations.find((row) => row.stationKey === "navigator");
assert(playerNavigator.selectedApproachLabel === "Recall Past Crossings", "player mission board state includes selected approach label");
assert(playerNavigator.selectedApproachHelpText === selectedRow.selectedApproach.helpText, "player mission board state includes selected approach How This Helps text");
assert(playerNavigator.approachOptions.every((approach) => approach.skill && approach.skillLabel && approach.dcLabel), "player mission board approach options include skill labels and DC labels");
assert(playerNavigator.selectedApproachLabel === "Recall Past Crossings", "player mission board selected approach label remains visible separately from the roll formula");
assert(!playerNavigator.selectedApproachRollLabel.includes("Recall Past Crossings") && playerNavigator.selectedApproachRollLabel.includes("Society") && playerNavigator.selectedApproachRollLabel.includes("DC"), "player mission board selected approach roll label contains only statistic/modifier/DC formula");
assert(JSON.stringify(playerNavigator).includes("Hidden society consequence.") === false, "player mission board state does not expose hidden consequence text");
const stationUpdatePayload = { ...playerNavigator, rollDetailText: "Society 17 vs DC 18: Failure" };
assert(stationUpdatePayload.selectedApproachLabel === playerNavigator.selectedApproachLabel && stationUpdatePayload.selectedApproachRollLabel === playerNavigator.selectedApproachRollLabel && stationUpdatePayload.approachOptions.length === playerNavigator.approachOptions.length, "station-level update payload preserves selected approach and option state for coherent board refreshes");

const distinctRoundEvent = JSON.parse(JSON.stringify(legacyEvent));
distinctRoundEvent.key = "phase-v-distinct-round-card-smoke";
distinctRoundEvent.name = "Phase V Distinct Round Card Smoke";
distinctRoundEvent.roundCount = 2;
distinctRoundEvent.rounds = [
  {
    ...JSON.parse(JSON.stringify(legacyEvent.rounds[0])),
    round: 1,
    title: "First Current",
    openingVignette: "Round one opens under the black bell's first toll.",
    stationCards: [{ stationKey: "navigator", stationName: "Navigator", problem: "Round one current drags against the port bow.", skillApproaches: [{ skill: "survival", label: "Hold the First Line", helpText: "Read the first current by pressure and spray.", gmNarrationFeedback: { criticalSuccess: "Round one critical GM text.", success: "Round one success GM text.", failure: "Round one failure GM text.", criticalFailure: "Round one critical failure GM text." }, boardResultFeedback: feedback }] }]
  },
  {
    ...JSON.parse(JSON.stringify(legacyEvent.rounds[0])),
    round: 2,
    title: "Second Current",
    openingVignette: "Round two opens under a different black bell echo.",
    stationCards: [{ stationKey: "navigator", stationName: "Navigator", problem: "Round two current coils beneath the keel instead.", skillApproaches: [{ skill: "survival", label: "Hold the First Line", helpText: "Read the second current by undertow and bell echo.", gmNarrationFeedback: { criticalSuccess: "Round two critical GM text.", success: "Round two success GM text.", failure: "Round two failure GM text.", criticalFailure: "Round two critical failure GM text." }, boardResultFeedback: feedback }] }]
  }
];
const distinctExport = exportTravelEventDraftToJson(normalizeTravelEventDraft(distinctRoundEvent, { now: "2026-06-15T00:00:00.000Z" }), { now: "2026-06-15T00:00:00.000Z" });
const distinctImport = importTravelEventDraftFromJson(distinctExport.json, { now: "2026-06-15T00:00:00.000Z" });
const distinctFinalized = finalizeTravelEventDraft(distinctImport.draft, { now: "2026-06-15T00:00:00.000Z" });
assert(distinctFinalized.ok, `distinct round draft finalizes: ${(distinctFinalized.errors ?? []).join(", ")}`);
const distinctRunner = createTravelEventRunnerSession(distinctFinalized.event, { ship: { id: "ship", uuid: "Actor.ship", name: "Smoke Ship", type: "vehicle" }, now: "2026-06-15T00:00:00.000Z" });
assert(distinctRunner.ok, `distinct round runner starts: ${(distinctRunner.errors ?? []).join(", ")}`);
assert(distinctRunner.session.event.rounds[0].stationCards[0].problem !== distinctRunner.session.event.rounds[1].stationCards[0].problem, "runner keeps round-specific station card problems distinct");
assert(distinctRunner.session.event.rounds[0].stationCards[0].skillApproaches[0].gmNarrationFeedback.success !== distinctRunner.session.event.rounds[1].stationCards[0].skillApproaches[0].gmNarrationFeedback.success, "runner keeps round-specific GM feedback distinct");
const distinctBoardRoundOne = prepareTravelPlayerMissionBoardState(distinctRunner.session);
const distinctRoundTwoSession = { ...distinctRunner.session, currentRoundIndex: 1 };
const distinctBoardRoundTwo = prepareTravelPlayerMissionBoardState(distinctRoundTwoSession);
assert(distinctBoardRoundOne.stations[0].promptText !== distinctBoardRoundTwo.stations[0].promptText, "player mission board uses round-specific station card text");


const twoStationEvent = JSON.parse(JSON.stringify(legacyEvent));
twoStationEvent.key = "phase-v-two-station-feedback-smoke";
twoStationEvent.name = "Phase V Two Station Feedback Smoke";
twoStationEvent.travelStations = ["navigator", "engineer", "watchmaster"];
twoStationEvent.rounds[0].activeStations = ["navigator", "engineer", "watchmaster"];
twoStationEvent.rounds[0].roundEndNarration = { narrowRoundSuccess: "Scripted narrow success frame." };
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
const rolledDetailSession = { ...engineerSuccess.session, playerMissionBoardRollDetails: { navigator: "d20 14 + Survival 9 = 23 vs DC 20: Success" } };
const feedbackState = prepareTravelEventRunnerState(rolledDetailSession);
const navigatorFeedbackRow = feedbackState.stations.find((row) => row.stationKey === "navigator");
const engineerFeedbackRow = feedbackState.stations.find((row) => row.stationKey === "engineer");
assert(navigatorFeedbackRow.rollDetailText === "d20 14 + Survival 9 = 23 vs DC 20: Success", "GM runner station row exposes player roll detail text");
const rollDetailBoard = prepareTravelPlayerMissionBoardState(rolledDetailSession);
assert(rollDetailBoard.stations.find((row) => row.stationKey === "navigator").rollDetailText === "d20 14 + Survival 9 = 23 vs DC 20: Success", "roll detail survives in player mission board prepared state");
assert(navigatorFeedbackRow.resultFeedback === "Naria remembers the warning, but not the safe bearing.", "station row exposes failure resultFeedback from rollFeedback.failure");
assert(navigatorFeedbackRow.hasResultFeedback, "station row marks resultFeedback as available");
assert(engineerFeedbackRow.resultFeedback === "Bramble syncs the arkengine cleanly against the song's vibration.", "station row exposes success resultFeedback from rollFeedback.success");
assert(feedbackState.roundSummaryCard.hasResolvedStations, "round summary card appears when stations have results");
assert(feedbackState.roundSummaryCard.resolvedStationCount === 2, "round summary includes both resolved stations");
assert(feedbackState.roundSummaryCard.unresolvedStationCount === 1, "round summary counts unresolved stations");
assert(feedbackState.roundSummaryCard.successCount === 1 && feedbackState.roundSummaryCard.failureCount === 1, "round summary counts success-side and failure-side results");
assert(feedbackState.roundSummaryCard.roundScore === 0 && feedbackState.roundSummaryCard.roundOutcomeKey === "narrowRoundSuccess", "weighted round scoring treats 0 as narrow success");
assert(feedbackState.roundSummaryCard.summaryLines.some((line) => line.includes("Naria at Navigator used Recall Past Crossings and scored Failure")), "round summary lines include actor, station, result, and selected navigator approach");
assert(feedbackState.roundSummaryCard.summaryLines.some((line) => line.includes("Bramble at Engineer used Tune the Harmonic and scored Success")), "round summary lines include actor, station, result, and selected engineer approach");
assert(feedbackState.roundSummaryCard.cinematicSummaryText.includes("Scripted narrow success frame."), "round summary prose includes scripted weighted narration frame");
assert(feedbackState.roundSummaryCard.cinematicSummaryText.includes("Naria") && feedbackState.roundSummaryCard.cinematicSummaryText.includes("Bramble"), "round summary prose keeps actual station outcomes after scripted narration");
assert(feedbackState.roundSummaryCard.cinematicSummaryText.includes("remembers the warning, but not the safe bearing."), "round summary prose includes navigator failure feedback without duplicating actor names");
assert(feedbackState.roundSummaryCard.cinematicSummaryText.includes("syncs the arkengine cleanly against the song's vibration."), "round summary prose includes engineer success feedback without duplicating actor names");
assert(feedbackState.roundSummaryCard.unresolvedStationText.includes("Watchmaster"), "round summary lists unresolved active stations separately");
assert(!feedbackState.roundSummaryCard.cinematicSummaryText.includes("unresolved pressure"), "round read-aloud avoids unresolved pressure wording");
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
