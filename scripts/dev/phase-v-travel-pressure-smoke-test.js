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
  advanceTravelEventRunnerRound,
  advanceTravelEventRunnerRoundPhase,
  commitTravelEventRunnerStationOrder,
  createTravelEventRunnerSession,
  exportTravelEventRunnerSessionToJson,
  importTravelEventRunnerSessionFromJson,
  normalizeTravelEventRunnerSession,
  prepareTravelPlayerMissionBoardState,
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
assert(initialPlayerStation.focusCapacity === 0 && initialPlayerStation.focusRemaining === 0, "Station Focus capacity defaults safely to zero");
assert(Array.isArray(initialPlayerStation.focusOptions) && initialPlayerStation.focusOptions.length === 0, "Station Focus options default safely to an empty list");
assert(initialPlayerStation.selectedFocusAbility === "" && initialPlayerStation.canSpendFocus === false, "Station Focus selection and spending default safely when no abilities exist");

const committedAdvance = commitTravelEventRunnerStationOrder(runner.session, 0, "navigator", "eventApproach:survival", { source: "player", now: "2026-06-17T00:00:20.000Z" });
assert(committedAdvance.ok, "player can commit Advance the Mission");
assert(committedAdvance.session.roundResults[0].stationActions.navigator.type === "eventApproach", "Advance the Mission preserves Event Approach behavior");
assert(committedAdvance.session.roundResults[0].selectedStationSkills.navigator === "survival", "Advance the Mission commit preserves selected roll approach");
const advanceRunnerState = prepareTravelEventRunnerState(committedAdvance.session, { library: { events: {} }, runnerSessionLibrary: { sessions: {} } });
assert(advanceRunnerState.stations[0].stationOrderCommitted && advanceRunnerState.stations[0].selectedActionLabel === "Push Forward", "GM runner sees the player-committed Push Forward option");

const stabilizeChoice = setTravelEventRunnerStationAction(runner.session, 0, "navigator", "stabilize", { now: "2026-06-17T00:00:30.000Z" });
assert(stabilizeChoice.ok, "Stabilize choice can be selected");
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

const committedStabilize = commitTravelEventRunnerStationOrder(runner.session, 0, "navigator", "stabilize:strain:survival", { source: "player", now: "2026-06-17T00:00:40.000Z" });
assert(committedStabilize.ok, "player can commit Stabilize the Ship");
assert(committedStabilize.session.roundResults[0].stationActions.navigator.type === "stabilize", "Stabilize commit preserves action type");
assert(committedStabilize.session.roundResults[0].selectedStationSkills.navigator === "survival", "Commit Station Order preserves Stabilize and selected roll approach together");
assert(committedStabilize.session.roundResults[0].selectedStationOptionLabels.navigator === "Stabilize Strain — Survival", "selected Stabilize option label is stored");
const stabilizePlayerBoard = prepareTravelPlayerMissionBoardState(committedStabilize.session);
const stabilizePlayerStation = stabilizePlayerBoard.stations[0];
assert(stabilizePlayerStation.isStabilize && stabilizePlayerStation.stabilizePressureLabel === "Strain", "Stabilize exposes its pressure label on the player mission board");
assert(stabilizePlayerStation.approachOptions.some((option) => option.skill === "survival"), "Stabilize still exposes roll approach and skill information");
assert(stabilizePlayerStation.focusOptions.length === 0 && !stabilizePlayerStation.hasFocusOptions, "mission board prepares safely when no Station Focus abilities exist");
const committedRunnerState = prepareTravelEventRunnerState(committedStabilize.session, { library: { events: {} }, runnerSessionLibrary: { sessions: {} } });
assert(committedRunnerState.stations[0].stationOrderCommitted && committedRunnerState.stations[0].selectedStationOptionLabel === "Stabilize Strain — Survival", "GM runner sees the selected combined Stabilize option");

const stabilizeExport = exportTravelEventRunnerSessionToJson(stabilizeSuccess.session, { now: "2026-06-17T00:00:45.000Z" });
const stabilizeImport = importTravelEventRunnerSessionFromJson(stabilizeExport.json);
assert(stabilizeImport.session.roundResults[0].stationActions.navigator.type === "stabilize", "session export/import preserves Stabilize action choice");
assert(stabilizeImport.session.roundResults[0].stationActions.navigator.stabilizePressureKey === "strain", "session export/import preserves Stabilize pressure target");
const committedExport = exportTravelEventRunnerSessionToJson(committedStabilize.session, { now: "2026-06-17T00:00:50.000Z" });
const committedImport = importTravelEventRunnerSessionFromJson(committedExport.json);
assert(committedImport.session.roundResults[0].stationActions.navigator.type === "stabilize", "export/import preserves player-selected Station Order");
assert(committedImport.session.roundResults[0].stationOrderCommitments.navigator.source === "player", "export/import preserves player Station Order commitment metadata");

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

console.log("Phase V travel pressure smoke test passed.");
