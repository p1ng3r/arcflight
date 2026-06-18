import {
  ARCFLIGHT_TRAVEL_PRESSURE_FALLOUT_RESET,
  ARCFLIGHT_TRAVEL_PRESSURE_MAX,
  applyTravelPressureChange,
  applyTravelPressureChanges,
  applyTravelRoundOutcomePressure,
  createEmptyTravelPressureState,
  eventApproach,
  getPendingTravelStabilizeEffect,
  getTravelStationStabilizePressureKey,
  getTravelPressureState,
  normalizeTravelPressureState,
  normalizeTravelRoundPressureProfile,
  resolveTravelPressureFallout,
  stabilize
} from "../helpers/travel-pressure.js";
import {
  acceptTravelReactionPrompt,
  applyTravelReactionPromptBacklash,
  dismissTravelReactionPrompt,
  dismissTravelReactionPromptBacklash,
  markTravelReactionPromptRerollResult,
  prepareTravelReactionPromptReviewState,
  advanceTravelEventRunnerRound,
  advanceTravelEventRunnerRoundPhase,
  buildTravelPlayerStationOrderCommitData,
  commitTravelEventRunnerStationOrder,
  createTravelEventRunnerSession,
  exportTravelEventRunnerSessionToJson,
  importTravelEventRunnerSessionFromJson,
  markTravelFocusEffectApplied,
  markTravelStabilizeResolutionApplied,
  dismissTravelFocusEffect,
  dismissTravelStabilizeResolution,
  updateTravelFocusEffectNote,
  updateTravelStabilizeResolutionNote,
  normalizeTravelEventRunnerSession,
  prepareTravelPlayerMissionBoardState,
  prepareTravelPlayerStationCardState,
  prepareTravelEventRunnerState,
  retreatTravelEventRunnerRound,
  retreatTravelEventRunnerRoundPhase,
  setTravelEventRunnerRoundPhase,
  setTravelEventRunnerStationAction,
  setTravelEventRunnerStationResult,
  summarizeTravelEventRunnerSession
} from "../helpers/travel-event-runner.js";
import { ARCFLIGHT_TRAVEL_ROUND_SEGMENTS } from "../helpers/travel-round-segments.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const empty = createEmptyTravelPressureState();
assert(empty.strain === 0 && empty.lifeveil === 0 && empty.morale === 0, "empty pressure starts all tracks at zero");

const normalized = normalizeTravelPressureState({ strain: 99, lifeveil: -3, morale: 2.8, hull: 4 });
assert(normalized.strain === 5, "pressure normalization clamps high values at 5");
assert(normalized.lifeveil === 0, "pressure normalization clamps low values at 0");
assert(normalized.morale === 2, "pressure normalization truncates fractional pressure values");
assert(!Object.hasOwn(normalized, "hull"), "pressure normalization drops non-pressure resources");

assert(getTravelPressureState(0).state === "stable", "pressure 0 is stable");
assert(getTravelPressureState(1).state === "warning", "pressure 1 is warning");
assert(getTravelPressureState(2).state === "pressured", "pressure 2 is pressured");
assert(getTravelPressureState(3).state === "stressed", "pressure 3 is stressed");
assert(getTravelPressureState(4).state === "severe", "pressure 4 is severe");
assert(getTravelPressureState(5).state === "crisis", "pressure 5 is crisis");

const singleChange = applyTravelPressureChange({ strain: 4, lifeveil: 0, morale: 0 }, "strain", 1);
assert(singleChange.pressure.strain === ARCFLIGHT_TRAVEL_PRESSURE_MAX, "single pressure change can reach crisis cap");
assert(singleChange.falloutTriggers.length === 1 && singleChange.falloutTriggers[0].pressureKey === "strain", "single pressure change reports fallout trigger when reaching 5");

const invalidChange = applyTravelPressureChange({ strain: 1 }, "hull", 1);
assert(invalidChange.warnings.some((warning) => warning.includes("Invalid pressure key")), "invalid pressure key is reported as warning");

const multiChange = applyTravelPressureChanges({ strain: 1, lifeveil: 2, morale: 3 }, [
  { pressureKey: "strain", amount: 2 },
  { resource: "lifeveil", value: -1 },
  "morale"
]);
assert(multiChange.pressure.strain === 3, "multi pressure changes add explicit pressure");
assert(multiChange.pressure.lifeveil === 1, "multi pressure changes allow pressure reduction");
assert(multiChange.pressure.morale === 4, "string changes add one pressure by default");

const profile = normalizeTravelRoundPressureProfile({ primaryPressure: "lifeveil", secondaryPressure: "morale", progressTarget: 3 });
assert(profile.primaryPressure === "lifeveil", "round pressure profile preserves primary pressure");
assert(profile.secondaryPressure === "morale", "round pressure profile preserves secondary pressure");
assert(profile.progressTarget === 3, "round pressure profile preserves progress target");

const mixed = applyTravelRoundOutcomePressure({ strain: 0, lifeveil: 1, morale: 2 }, { primaryPressure: "lifeveil", secondaryPressure: "morale" }, "mixed");
assert(mixed.pressure.lifeveil === 2 && mixed.pressure.morale === 2, "mixed round adds only primary pressure");

const failure = applyTravelRoundOutcomePressure({ strain: 0, lifeveil: 1, morale: 2 }, { primaryPressure: "lifeveil", secondaryPressure: "morale" }, "failure");
assert(failure.pressure.lifeveil === 2 && failure.pressure.morale === 3, "failed round adds primary and secondary pressure");

const disaster = applyTravelRoundOutcomePressure({ strain: 0, lifeveil: 3, morale: 4 }, { primaryPressure: "lifeveil", secondaryPressure: "morale" }, "disaster");
assert(disaster.pressure.lifeveil === 5 && disaster.pressure.morale === 5, "disaster round adds +2 primary and +1 secondary pressure");
assert(disaster.complication === true, "disaster round marks complication");
assert(disaster.falloutTriggers.length === 2, "disaster round reports fallout triggers for tracks that reach 5");

const criticalRoundFailureAlias = applyTravelRoundOutcomePressure({ strain: 0, lifeveil: 3, morale: 4 }, { primaryPressure: "lifeveil", secondaryPressure: "morale" }, "criticalRoundFailure");
assert(criticalRoundFailureAlias.roundPressureKey === "disaster", "runner criticalRoundFailure aliases to disaster pressure");

const fallout = resolveTravelPressureFallout({ strain: 5, lifeveil: 0, morale: 0 }, "strain");
assert(fallout.fallout?.deck === "strain", "fallout resolution identifies the matching deck");
assert(fallout.pressure.strain === ARCFLIGHT_TRAVEL_PRESSURE_FALLOUT_RESET, "fallout resolution drops pressure to fallback reset value");

const noFallout = resolveTravelPressureFallout({ strain: 4, lifeveil: 0, morale: 0 }, "strain");
assert(noFallout.fallout === null, "fallout resolution does nothing below crisis threshold");

assert(eventApproach().type === "eventApproach", "eventApproach helper creates an event approach station choice");
assert(stabilize("morale").type === "stabilize" && stabilize("morale").stabilizePressureKey === "morale", "stabilize helper creates a pressure-targeted station choice");
assert(getTravelStationStabilizePressureKey("captain", { primaryPressure: "strain" }) === "morale", "captain Stabilize targets morale");
assert(getTravelStationStabilizePressureKey("navigator", { primaryPressure: "morale" }) === "strain", "navigator Stabilize targets strain");
assert(getTravelStationStabilizePressureKey("engineer", { primaryPressure: "morale" }) === "strain", "engineer Stabilize targets strain");
assert(getTravelStationStabilizePressureKey("veilwarden", { primaryPressure: "strain" }) === "lifeveil", "veilwarden Stabilize targets lifeveil");
assert(getTravelStationStabilizePressureKey("watchmaster", { primaryPressure: "strain" }) === "morale", "watchmaster Stabilize targets morale");
assert(getTravelStationStabilizePressureKey("future-station", { primaryPressure: "lifeveil" }) === "lifeveil", "unmapped stations Stabilize against round primary pressure");
assert(getPendingTravelStabilizeEffect("criticalSuccess", "strain").reduction === 2, "critical success creates pending Stabilize reduction 2");
assert(getPendingTravelStabilizeEffect("success", "strain").reduction === 1, "success creates pending Stabilize reduction 1");
assert(getPendingTravelStabilizeEffect("failure", "strain").reduction === 0, "failure creates pending Stabilize reduction 0");
const criticalFailureStabilize = getPendingTravelStabilizeEffect("criticalFailure", "strain");
assert(criticalFailureStabilize.reduction === 0 && criticalFailureStabilize.complication && criticalFailureStabilize.pressureIncrease === 1, "critical failure creates no Stabilize reduction and marks a +1 pressure complication");

const runnerEvent = {
  key: "phase-v-travel-pressure-runner-smoke",
  name: "Phase V Travel Pressure Runner Smoke",
  category: "discovery",
  tags: [],
  roundCount: 2,
  baseDC: 18,
  activeResources: ["hull"],
  travelStations: ["navigator"],
  description: "Smoke-test event only.",
  gmSummary: "Smoke-test event only.",
  rounds: [
    {
      round: 1,
      title: "Pressure Opening",
      openingVignette: "Pressure gathers at the edge of the route.",
      primaryPressure: "strain",
      secondaryPressure: "morale",
      progressTarget: 2,
      activeStations: ["navigator"],
      stationPrompts: {
        navigator: {
          stationKey: "navigator",
          stationName: "Navigator",
          playerAction: "Plot a safe course.",
          suggestedSkills: ["survival"],
          rollFeedback: {
            criticalSuccess: "Cleanly solved.",
            success: "Solved.",
            failure: "Complicated.",
            criticalFailure: "Worsened."
          }
        }
      },
      outcomeBranches: {
        dominantSuccess: { vignette: "Better.", proposedEffects: [] },
        mixed: { vignette: "Mixed.", proposedEffects: [] },
        dominantFailure: { vignette: "Worse.", proposedEffects: [] },
        catastrophicFailure: { vignette: "Worst.", proposedEffects: [] }
      }
    },
    {
      round: 2,
      title: "Pressure Follow-up",
      openingVignette: "The route tightens.",
      primaryPressure: "lifeveil",
      secondaryPressure: "strain",
      progressTarget: 2,
      activeStations: ["navigator"],
      stationPrompts: {
        navigator: {
          stationKey: "navigator",
          stationName: "Navigator",
          playerAction: "Adjust the course.",
          suggestedSkills: ["survival"],
          rollFeedback: {
            criticalSuccess: "Cleanly solved.",
            success: "Solved.",
            failure: "Complicated.",
            criticalFailure: "Worsened."
          }
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

const runner = createTravelEventRunnerSession(runnerEvent, {
  ship: { id: "ship", uuid: "Actor.ship", name: "Smoke Ship", type: "vehicle" },
  now: "2026-06-17T00:00:00.000Z"
});
assert(runner.ok, `runner session starts from pressure smoke event: ${(runner.errors ?? []).join(", ")}`);
assert(runner.session.pressure.strain === 0 && runner.session.pressure.lifeveil === 0 && runner.session.pressure.morale === 0, "new runner sessions start with pressure 0/0/0");
assert(runner.session.roundPhase === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL, "new runner sessions start at roundReveal");

const initialPlayerBoard = prepareTravelPlayerMissionBoardState(runner.session);
const initialPlayerStation = initialPlayerBoard.stations[0];
assert(!Object.hasOwn(initialPlayerStation, "stationOrderOptions"), "player mission board does not expose a separate Station Order option list");
assert(initialPlayerStation.approachOptions.some((option) => option.actionType === "eventApproach" && option.skill === "survival"), "player mission board combined list exposes normal event approaches");
const playerStabilizeOption = initialPlayerStation.approachOptions.find((option) => option.actionType === "stabilize");
assert(playerStabilizeOption?.label === "Stabilize Strain — Survival", "player mission board combined list exposes the synthetic Stabilize option");
assert(playerStabilizeOption?.stabilizePressureKey === "strain", "synthetic Stabilize option stores its pressure target");
assert(playerStabilizeOption?.skill === "survival", "navigator Stabilize falls back to Survival when Piloting Lore is unavailable");
assert(runner.session.stationFocus.navigator.focusCapacity === 1 && runner.session.stationFocus.navigator.focusRemaining === 1, "new runner session initializes active stations with one Focus");
assert(initialPlayerStation.focusCapacity === 1 && initialPlayerStation.focusRemaining === 1, "player mission board exposes Focus remaining and capacity");
assert(Array.isArray(initialPlayerStation.focusOptions) && initialPlayerStation.focusOptions.length === 3, "player mission board exposes three signature Focus abilities");
assert(initialPlayerStation.selectedFocusAbility === "" && initialPlayerStation.canSpendFocus === true, "Station Focus starts available with no selection");
const initialIndividualCard = prepareTravelPlayerStationCardState(runner.session, "navigator");
assert(initialIndividualCard.approachOptions.some((option) => option.value === "eventApproach:survival"), "individual station card exposes Push Forward by combined option value");
assert(initialIndividualCard.approachOptions.some((option) => option.value === "stabilize:strain:survival"), "individual station card exposes Stabilize by combined option value rather than raw skill");
const individualStabilizePayload = buildTravelPlayerStationOrderCommitData({ ...initialIndividualCard, selectedFocusAbility: "hard-correction" }, "stabilize:strain:survival");
assert(individualStabilizePayload.optionKey === "stabilize:strain:survival" && !Object.hasOwn(individualStabilizePayload, "skill"), "individual station card commit data submits a Stabilize option key instead of only a raw skill");
assert(individualStabilizePayload.selectedFocusAbility === "hard-correction", "individual station card commit data preserves selected Focus ability");
assert(initialIndividualCard.focusOptions.length === 3 && initialIndividualCard.hasFocusOptions && initialIndividualCard.focusRemaining === 1, "individual station card exposes Focus remaining and three signature abilities");

const committedAdvance = commitTravelEventRunnerStationOrder(runner.session, 0, "navigator", "eventApproach:survival", { source: "player", now: "2026-06-17T00:00:20.000Z" });
assert(committedAdvance.ok, "player can commit Advance the Mission");
assert(committedAdvance.session.roundResults[0].stationActions.navigator.type === "eventApproach", "Advance the Mission preserves Event Approach behavior");
assert(committedAdvance.session.roundResults[0].selectedStationSkills.navigator === "survival", "Advance the Mission commit preserves selected roll approach");
assert(committedAdvance.session.stationFocus.navigator.focusRemaining === 1, "committing a station order without Focus does not spend Focus");
assert(committedAdvance.session.focusEffectRecords.records.length === 0, "committing a station order without Focus creates no Focus effect record");
const advanceRunnerState = prepareTravelEventRunnerState(committedAdvance.session, { library: { events: {} }, runnerSessionLibrary: { sessions: {} } });
assert(advanceRunnerState.stations[0].stationOrderCommitted && advanceRunnerState.stations[0].selectedActionLabel === "Push Forward", "GM runner sees the player-committed Push Forward option");
const advanceIndividualCard = prepareTravelPlayerStationCardState(committedAdvance.session, "navigator");
assert(advanceIndividualCard.selectedStationOrder === "eventApproach" && advanceIndividualCard.selectedApproachValue === "eventApproach:survival", "individual station card can preserve a committed Push Forward option");
const pushForwardResult = setTravelEventRunnerStationResult(committedAdvance.session, 0, "navigator", "success");
assert(pushForwardResult.session.stabilizeResolutionRecords.records.length === 0, "Push Forward station result creates no Stabilize resolution record");

const stabilizeChoice = setTravelEventRunnerStationAction(runner.session, 0, "navigator", "stabilize", { now: "2026-06-17T00:00:30.000Z" });
assert(stabilizeChoice.ok, "Stabilize choice can be selected");
assert(stabilizeChoice.session.stabilizeResolutionRecords.records.length === 0, "Stabilize without a result creates no resolution record");
assert(stabilizeChoice.session.roundResults[0].stationActions.navigator.type === "stabilize", "selected Stabilize action is stored per station");
assert(stabilizeChoice.session.roundResults[0].stationActions.navigator.stabilizePressureKey === "strain", "selected Stabilize action stores its station-flavored pressure key");
const stabilizeSuccess = setTravelEventRunnerStationResult(stabilizeChoice.session, 0, "navigator", "criticalSuccess");
assert(stabilizeSuccess.session.roundResults[0].stationResults.navigator === "criticalSuccess", "a Stabilize station is resolved normally after its roll");
const stabilizeSummary = summarizeTravelEventRunnerSession(stabilizeSuccess.session);
assert(stabilizeSummary.summary.totalScore === 0, "Stabilize does not count as event progress or session scoring");
const stabilizeState = prepareTravelEventRunnerState(stabilizeSuccess.session, { library: { events: {} }, runnerSessionLibrary: { sessions: {} } });
assert(stabilizeState.stations[0].isStabilize, "runner state exposes selected Stabilize choice");
assert(stabilizeState.stations[0].stabilizePressureKey === "strain", "runner state exposes selected Stabilize pressure target");
assert(stabilizeState.pendingStabilize.totalReduction === 2, "runner state summarizes pending critical-success Stabilize reduction");
const stabilizeRecord = stabilizeSuccess.session.stabilizeResolutionRecords.records[0];
assert(stabilizeRecord.status === "pending" && stabilizeRecord.reduction === 2, "Stabilize critical success creates one pending reduction-2 record");
const repeatedStabilize = setTravelEventRunnerStationResult(stabilizeSuccess.session, 0, "navigator", "criticalSuccess");
assert(repeatedStabilize.session.stabilizeResolutionRecords.records.length === 1, "re-recording a Stabilize result does not duplicate its record");
const stabilizeSuccessResult = setTravelEventRunnerStationResult(stabilizeChoice.session, 0, "navigator", "success");
assert(stabilizeSuccessResult.session.stabilizeResolutionRecords.records[0].reduction === 1, "Stabilize success records reduction 1");
const stabilizeFailureResult = setTravelEventRunnerStationResult(stabilizeChoice.session, 0, "navigator", "failure");
assert(stabilizeFailureResult.session.stabilizeResolutionRecords.records[0].reduction === 0, "Stabilize failure records no reduction");
const stabilizeCriticalFailure = setTravelEventRunnerStationResult(stabilizeChoice.session, 0, "navigator", "criticalFailure");
assert(stabilizeCriticalFailure.session.stabilizeResolutionRecords.records[0].pressureIncrease === 1 && stabilizeCriticalFailure.session.stabilizeResolutionRecords.records[0].complication, "Stabilize critical failure records a +1 pressure complication");
const notedStabilize = updateTravelStabilizeResolutionNote(stabilizeSuccess.session, stabilizeRecord.stabilizeResolutionId, "Pressure valve opened.");
assert(notedStabilize.session.stabilizeResolutionRecords.records[0].resolutionNote === "Pressure valve opened.", "Stabilize resolution note persists");
const appliedReduction = markTravelStabilizeResolutionApplied({
  ...notedStabilize.session,
  pressure: { ...notedStabilize.session.pressure, strain: 1 }
}, stabilizeRecord.stabilizeResolutionId, { userId: "gm-1", userName: "GM" });
assert(appliedReduction.session.pressure.strain === 0, "applying Stabilize reduction lowers pressure without going below 0");
assert(appliedReduction.session.stabilizeResolutionRecords.records[0].status === "applied" && appliedReduction.session.stabilizeResolutionRecords.records[0].pressureBefore === 1, "applied Stabilize records remain in history with pressure history");
const criticalFailureRecord = stabilizeCriticalFailure.session.stabilizeResolutionRecords.records[0];
const appliedIncrease = markTravelStabilizeResolutionApplied(stabilizeCriticalFailure.session, criticalFailureRecord.stabilizeResolutionId);
assert(appliedIncrease.session.pressure.strain === stabilizeCriticalFailure.session.pressure.strain + 1, "applying critical-failure Stabilize raises pressure by 1");
const dismissedStabilize = dismissTravelStabilizeResolution({ ...stabilizeFailureResult.session, pressure: { ...stabilizeFailureResult.session.pressure, strain: 3 } }, stabilizeFailureResult.session.stabilizeResolutionRecords.records[0].stabilizeResolutionId);
assert(dismissedStabilize.session.pressure.strain === 3 && dismissedStabilize.session.stabilizeResolutionRecords.records[0].status === "dismissed", "dismissing Stabilize preserves pressure and keeps history");
const advancedStabilize = advanceTravelEventRunnerRound(appliedReduction.session);
assert(advancedStabilize.session.stabilizeResolutionRecords.records[0].status === "applied", "advancing rounds preserves Stabilize resolution history");

const committedStabilize = commitTravelEventRunnerStationOrder(runner.session, 0, "navigator", "stabilize:strain:survival", { source: "player", now: "2026-06-17T00:00:40.000Z" });
assert(committedStabilize.ok, "player can commit Stabilize the Ship");
assert(committedStabilize.session.roundResults[0].stationActions.navigator.type === "stabilize", "Stabilize commit preserves action type");
assert(committedStabilize.session.roundResults[0].selectedStationSkills.navigator === "survival", "Commit Station Order preserves Stabilize and selected roll approach together");
assert(committedStabilize.session.roundResults[0].selectedStationOptionLabels.navigator === "Stabilize Strain — Survival", "selected Stabilize option label is stored");
const stabilizePlayerBoard = prepareTravelPlayerMissionBoardState(committedStabilize.session);
const stabilizePlayerStation = stabilizePlayerBoard.stations[0];
assert(stabilizePlayerStation.isStabilize && stabilizePlayerStation.stabilizePressureLabel === "Strain", "Stabilize exposes its pressure label on the player mission board");
assert(stabilizePlayerStation.approachOptions.some((option) => option.skill === "survival"), "Stabilize still exposes roll approach and skill information");
assert(stabilizePlayerStation.focusOptions.length === 3 && stabilizePlayerStation.hasFocusOptions, "mission board retains Station Focus alongside Stabilize");
const stabilizeIndividualCard = prepareTravelPlayerStationCardState(committedStabilize.session, "navigator");
assert(stabilizeIndividualCard.selectedStationOrder === "stabilize", "individual station card can preserve a committed Stabilize option");
assert(stabilizeIndividualCard.selectedApproachValue === "stabilize:strain:survival", "individual Stabilize card stores the option key instead of submitting only raw skill");
assert(stabilizeIndividualCard.stabilizePressureLabel === "Strain", "Stabilize target appears in individual station-card state");
assert(committedStabilize.session.roundResults[0].stationActions.navigator.type === "stabilize" && committedStabilize.session.roundResults[0].selectedStationSkills.navigator === "survival", "individual-card option commit preserves action type and selected skill");
const committedRunnerState = prepareTravelEventRunnerState(committedStabilize.session, { library: { events: {} }, runnerSessionLibrary: { sessions: {} } });
assert(committedRunnerState.stations[0].stationOrderCommitted && committedRunnerState.stations[0].selectedStationOptionLabel === "Stabilize Strain — Survival", "GM runner sees the selected combined Stabilize option");

const focusedCommit = commitTravelEventRunnerStationOrder(runner.session, 0, "navigator", "eventApproach:survival", { source: "player", selectedFocusAbility: "hard-correction", now: "2026-06-17T00:00:42.000Z" });
assert(focusedCommit.ok, "player can commit a Station Order with a valid Focus ability");
assert(focusedCommit.session.stationFocus.navigator.focusRemaining === 0, "valid Focus spend reduces Focus remaining by one");
assert(focusedCommit.session.stationFocus.navigator.usedAbilityKeys.includes("hard-correction"), "valid Focus spend marks the ability used for the event");
assert(focusedCommit.session.stationFocus.navigator.roundSpent["0"] === "hard-correction", "valid Focus spend records the station's round spend");
assert(focusedCommit.session.focusEffectRecords.records.length === 1 && focusedCommit.session.focusEffectRecords.records[0].status === "pending", "committing with Focus creates exactly one pending Focus effect record");
const focusRecord = focusedCommit.session.focusEffectRecords.records[0];
assert(focusRecord.roundIndex === 0 && focusRecord.stationKey === "navigator" && focusRecord.abilityLabel === "Hard Correction" && focusRecord.timing && focusRecord.effectText && focusRecord.stationName, "Focus effect record includes round, station, ability, timing, effect text, and station info");
const recommittedFocus = commitTravelEventRunnerStationOrder(focusedCommit.session, 0, "navigator", "eventApproach:survival", { source: "player", selectedFocusAbility: "hard-correction" });
assert(recommittedFocus.ok && recommittedFocus.session.focusEffectRecords.records.length === 1, "re-committing the same Focus order does not duplicate its effect record");
const notedFocus = updateTravelFocusEffectNote(recommittedFocus.session, focusRecord.focusEffectId, "Reroll confirmed.", { now: "2026-06-17T00:00:43.000Z" });
assert(notedFocus.session.focusEffectRecords.records[0].resolutionNote === "Reroll confirmed.", "updating a Focus effect note stores resolutionNote");
const appliedFocus = markTravelFocusEffectApplied(notedFocus.session, focusRecord.focusEffectId, { now: "2026-06-17T00:00:44.000Z", userId: "gm-1", userName: "GM" });
assert(appliedFocus.session.focusEffectRecords.records[0].status === "applied" && appliedFocus.session.focusEffectRecords.records[0].resolvedAt && appliedFocus.session.focusEffectRecords.records[0].resolvedByUserId === "gm-1", "mark applied records status and resolver metadata");
const dismissedFocus = dismissTravelFocusEffect(recommittedFocus.session, focusRecord.focusEffectId, { now: "2026-06-17T00:00:44.000Z", userId: "gm-1", userName: "GM" });
assert(dismissedFocus.session.focusEffectRecords.records[0].status === "dismissed" && dismissedFocus.session.focusEffectRecords.records[0].resolvedByUserName === "GM", "dismiss records status and resolver metadata");
const focusedRunnerState = prepareTravelEventRunnerState(focusedCommit.session, { library: { events: {} }, runnerSessionLibrary: { sessions: {} } });
assert(focusedRunnerState.stations[0].selectedFocusAbility === "Hard Correction" && focusedRunnerState.stations[0].focusRemaining === 0, "GM runner exposes committed Focus ability and remaining Focus");
const focusedAdvance = advanceTravelEventRunnerRound(focusedCommit.session);
assert(focusedAdvance.session.stationFocus.navigator.focusRemaining === 0, "Focus does not refresh when advancing rounds");
assert(focusedAdvance.session.focusEffectRecords.records.length === 1, "advancing rounds preserves Focus effect records");
const reusedAbility = commitTravelEventRunnerStationOrder({ ...focusedAdvance.session, stationFocus: { navigator: { ...focusedAdvance.session.stationFocus.navigator, focusRemaining: 1, focusCapacity: 2 } } }, 1, "navigator", "eventApproach:survival", { selectedFocusAbility: "hard-correction" });
assert(!reusedAbility.ok && reusedAbility.errors.some((error) => error.includes("already used")), "a Focus ability cannot be spent again in the same event");

const expandedFocusRunner = createTravelEventRunnerSession(runnerEvent, { stationFocus: { navigator: { focusCapacity: 2, focusRemaining: 2 } } });
const firstExpandedSpend = commitTravelEventRunnerStationOrder(expandedFocusRunner.session, 0, "navigator", "eventApproach:survival", { selectedFocusAbility: "read-the-route" });
const secondSameRoundSpend = commitTravelEventRunnerStationOrder(firstExpandedSpend.session, 0, "navigator", "eventApproach:survival", { selectedFocusAbility: "plot-the-impossible-angle" });
assert(!secondSameRoundSpend.ok && secondSameRoundSpend.errors.some((error) => error.includes("already spent Focus")), "a station cannot spend Focus twice in the same round even with extra capacity");

const stabilizeExport = exportTravelEventRunnerSessionToJson(stabilizeSuccess.session, { now: "2026-06-17T00:00:45.000Z" });
const stabilizeImport = importTravelEventRunnerSessionFromJson(stabilizeExport.json);
assert(stabilizeImport.session.roundResults[0].stationActions.navigator.type === "stabilize", "session export/import preserves Stabilize action choice");
assert(stabilizeImport.session.roundResults[0].stationActions.navigator.stabilizePressureKey === "strain", "session export/import preserves Stabilize pressure target");
assert(stabilizeImport.session.stabilizeResolutionRecords.records.length === 1 && stabilizeImport.session.stabilizeResolutionRecords.records[0].reduction === 2, "session export/import preserves Stabilize resolution records");
const committedExport = exportTravelEventRunnerSessionToJson(committedStabilize.session, { now: "2026-06-17T00:00:50.000Z" });
const committedImport = importTravelEventRunnerSessionFromJson(committedExport.json);
assert(committedImport.session.roundResults[0].stationActions.navigator.type === "stabilize", "export/import preserves player-selected Station Order");
assert(committedImport.session.roundResults[0].stationOrderCommitments.navigator.source === "player", "export/import preserves player Station Order commitment metadata");
const focusedExport = exportTravelEventRunnerSessionToJson(focusedCommit.session);
const focusedImport = importTravelEventRunnerSessionFromJson(focusedExport.json);
assert(focusedImport.session.stationFocus.navigator.focusRemaining === 0 && focusedImport.session.stationFocus.navigator.usedAbilityKeys.includes("hard-correction"), "Focus data survives session export/import");
assert(focusedImport.session.focusEffectRecords.records.length === 1 && focusedImport.session.focusEffectRecords.records[0].abilityKey === "hard-correction", "Focus effect records survive session export/import");

const advancedPhase = advanceTravelEventRunnerRoundPhase(runner.session, { now: "2026-06-17T00:01:00.000Z" });
assert(advancedPhase.session.roundPhase === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CREW_STRATEGY, "advance phase moves roundReveal to crewStrategy");
const retreatedPhase = retreatTravelEventRunnerRoundPhase(advancedPhase.session, { now: "2026-06-17T00:02:00.000Z" });
assert(retreatedPhase.session.roundPhase === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL, "retreat phase moves crewStrategy to roundReveal");
const setPhase = setTravelEventRunnerRoundPhase(retreatedPhase.session, ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE, { now: "2026-06-17T00:03:00.000Z" });
assert(setPhase.session.roundPhase === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE, "set phase can set outcomePressure");
const legacyPhase = setTravelEventRunnerRoundPhase(setPhase.session, ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.PRESSURE_APPLICATION, { now: "2026-06-17T00:03:30.000Z" });
assert(legacyPhase.session.roundPhase === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE, "legacy pressureApplication normalizes to outcomePressure");
const invalidPhase = setTravelEventRunnerRoundPhase(setPhase.session, "not-a-round-phase", { now: "2026-06-17T00:04:00.000Z" });
assert(invalidPhase.session.roundPhase === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL, "invalid set phase falls back to roundReveal");

const roundChangeSource = {
  ...setPhase.session,
  pressure: { strain: 4, lifeveil: 2, morale: 1 }
};
const advancedRound = advanceTravelEventRunnerRound(roundChangeSource, { now: "2026-06-17T00:05:00.000Z" });
assert(advancedRound.session.currentRoundIndex === 1, "advance round moves to the next round");
assert(advancedRound.session.roundPhase === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL, "advancing a travel round resets phase to roundReveal");
assert(advancedRound.session.pressure.strain === 4 && advancedRound.session.pressure.lifeveil === 2 && advancedRound.session.pressure.morale === 1, "pressure survives advancing a travel round");
const retreatSource = setTravelEventRunnerRoundPhase(advancedRound.session, ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_TRANSITION).session;
const retreatedRound = retreatTravelEventRunnerRound(retreatSource, { now: "2026-06-17T00:06:00.000Z" });
assert(retreatedRound.session.currentRoundIndex === 0, "retreat round moves to the previous round");
assert(retreatedRound.session.roundPhase === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL, "retreating a travel round resets phase to roundReveal");
assert(retreatedRound.session.pressure.strain === 4 && retreatedRound.session.pressure.lifeveil === 2 && retreatedRound.session.pressure.morale === 1, "pressure survives retreating a travel round");

const normalizedRunner = normalizeTravelEventRunnerSession({
  ...runner.session,
  pressure: { strain: 4, lifeveil: 2, morale: 1 },
  roundPhase: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE
});
assert(normalizedRunner.session.pressure.strain === 4 && normalizedRunner.session.pressure.lifeveil === 2 && normalizedRunner.session.pressure.morale === 1, "normalized runner sessions preserve pressure");
assert(normalizedRunner.session.roundPhase === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE, "normalized runner sessions preserve roundPhase");
assert(normalizedRunner.session.event.rounds[0].primaryPressure === "strain", "normalized runner round preserves primaryPressure");
assert(normalizedRunner.session.event.rounds[0].secondaryPressure === "morale", "normalized runner round preserves secondaryPressure");
assert(normalizedRunner.session.event.rounds[0].progressTarget === 2, "normalized runner round preserves progressTarget");

const exportedRunner = exportTravelEventRunnerSessionToJson(normalizedRunner.session, { now: "2026-06-17T00:00:00.000Z" });
assert(exportedRunner.ok && exportedRunner.json.includes("\"pressure\"") && exportedRunner.json.includes("\"roundPhase\""), "exported runner sessions retain pressure and roundPhase");
const importedRunner = importTravelEventRunnerSessionFromJson(exportedRunner.json);
assert(importedRunner.session.pressure.strain === 4 && importedRunner.session.pressure.lifeveil === 2 && importedRunner.session.pressure.morale === 1, "imported runner sessions preserve pressure through normalization");
assert(importedRunner.session.roundPhase === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE, "imported runner sessions preserve roundPhase through normalization");

const runnerState = prepareTravelEventRunnerState(importedRunner.session, { library: { events: {} }, runnerSessionLibrary: { sessions: {} } });
assert(runnerState.roundSegmentState?.phase === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE, "runner state exposes roundSegmentState");
assert(runnerState.roundSegmentState.pressure.strain === 4, "runner roundSegmentState uses active session pressure");
assert(runnerState.roundSegmentState.primaryPressure === "strain", "runner state exposes primary pressure");
assert(runnerState.roundSegmentState.secondaryPressure === "morale", "runner state exposes secondary pressure");
assert(runnerState.roundSegmentState.progressTarget === 2, "runner state exposes progress target");

// Hard Correction reaction lifecycle.
const reactionBase = createTravelEventRunnerSession(runnerEvent, { stationFocus: { navigator: { focusCapacity: 1, focusRemaining: 1 } } });
const navigatorSuccess = setTravelEventRunnerStationResult(reactionBase.session, 0, "navigator", "success");
assert(prepareTravelReactionPromptReviewState(navigatorSuccess.session).records.length === 0, "Navigator success creates no Hard Correction prompt");
const navigatorFailure = setTravelEventRunnerStationResult(reactionBase.session, 0, "navigator", "failure");
let reaction = prepareTravelReactionPromptReviewState(navigatorFailure.session);
assert(reaction.records.length === 1 && reaction.records[0].isPending, "Navigator failure creates one pending Hard Correction prompt");
const duplicateFailure = setTravelEventRunnerStationResult(navigatorFailure.session, 0, "navigator", "failure");
assert(prepareTravelReactionPromptReviewState(duplicateFailure.session).records.length === 1, "re-recording failure does not duplicate Hard Correction");
const criticalReaction = setTravelEventRunnerStationResult(reactionBase.session, 0, "navigator", "criticalFailure");
assert(prepareTravelReactionPromptReviewState(criticalReaction.session).records.length === 1, "Navigator critical failure creates Hard Correction prompt");
const noFocusBase = createTravelEventRunnerSession(runnerEvent, { stationFocus: { navigator: { focusCapacity: 1, focusRemaining: 0 } } });
assert(prepareTravelReactionPromptReviewState(setTravelEventRunnerStationResult(noFocusBase.session, 0, "navigator", "failure").session).records.length === 0, "no prompt without Navigator Focus");
const usedBase = createTravelEventRunnerSession(runnerEvent, { stationFocus: { navigator: { focusCapacity: 1, focusRemaining: 1, usedAbilityKeys: ["hard-correction"] } } });
assert(prepareTravelReactionPromptReviewState(setTravelEventRunnerStationResult(usedBase.session, 0, "navigator", "failure").session).records.length === 0, "no prompt when Hard Correction was already used");
const spentBase = createTravelEventRunnerSession(runnerEvent, { stationFocus: { navigator: { focusCapacity: 1, focusRemaining: 1, roundSpent: { "0": "read-the-route" } } } });
assert(prepareTravelReactionPromptReviewState(setTravelEventRunnerStationResult(spentBase.session, 0, "navigator", "failure").session).records.length === 0, "no prompt when Navigator spent Focus this round");
const reactionId = reaction.records[0].reactionPromptId;
const acceptedReaction = acceptTravelReactionPrompt(navigatorFailure.session, reactionId);
assert(acceptedReaction.ok && acceptedReaction.session.stationFocus.navigator.focusRemaining === 0 && acceptedReaction.session.stationFocus.navigator.usedAbilityKeys.includes("hard-correction"), "accepting Hard Correction spends Focus and marks it used");
assert(acceptedReaction.session.focusEffectRecords.records.some((record) => record.abilityKey === "hard-correction"), "accepting Hard Correction creates a Focus effect record");
assert(acceptedReaction.session.roundResults[0].stationResults.navigator === null, "accepting Hard Correction requests a reroll by clearing the station result");
const successfulReroll = markTravelReactionPromptRerollResult(acceptedReaction.session, reactionId, "success");
assert(successfulReroll.session.reactionPrompts.records[0].status === "resolved" && successfulReroll.session.reactionPrompts.records[0].backlashStatus === "none", "successful reroll resolves without backlash");
const failedReroll = markTravelReactionPromptRerollResult(acceptedReaction.session, reactionId, "failure");
assert(failedReroll.session.reactionPrompts.records[0].backlashStatus === "pending", "failed reroll creates pending Strain backlash");
const appliedBacklash = applyTravelReactionPromptBacklash(failedReroll.session, reactionId);
assert(appliedBacklash.session.pressure.strain === 1 && appliedBacklash.session.reactionPrompts.records[0].backlashStatus === "applied", "applying backlash increases Strain by 1");
const dismissedBacklash = dismissTravelReactionPromptBacklash(failedReroll.session, reactionId);
assert(dismissedBacklash.session.pressure.strain === 0 && dismissedBacklash.session.reactionPrompts.records[0].backlashStatus === "dismissed", "dismissing backlash does not increase Strain");
const dismissedPrompt = dismissTravelReactionPrompt(navigatorFailure.session, reactionId);
assert(dismissedPrompt.session.stationFocus.navigator.focusRemaining === 1 && dismissedPrompt.session.reactionPrompts.records[0].status === "dismissed", "dismissing prompt does not spend Focus");
const reactionExport = exportTravelEventRunnerSessionToJson(failedReroll.session);
const reactionImport = importTravelEventRunnerSessionFromJson(reactionExport.json);
assert(reactionImport.session.reactionPrompts.records[0].backlashStatus === "pending", "reaction prompts survive export/import");
const advancedReaction = advanceTravelEventRunnerRound(failedReroll.session);
assert(advancedReaction.session.reactionPrompts.records[0].reactionPromptId === reactionId, "reaction prompts survive round advancement");
const reactionState = prepareTravelEventRunnerState(failedReroll.session, { library: { events: {} }, runnerSessionLibrary: { sessions: {} } });
assert(reactionState.roundSegmentState.reactionPromptsPending === 1, "round segment state exposes pending reaction count");

console.log("Phase V travel pressure smoke test passed.");
