import {
  prepareTravelSceneOverlayState
} from "./travel-event-runner.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel approach statistic debug smoke check failed: ${message}`); }

function sampleEvent() {
  return {
    id: "debug-statistic-gate",
    name: "Debug Statistic Gate",
    baseDC: 15,
    rounds: [{
      round: 1,
      title: "Quiet diagnostics",
      activeStations: ["navigator"],
      stationPrompts: { navigator: { stationKey: "navigator", suggestedSkills: ["piloting-lore"], playerAction: "Plot the route." } },
      stationCards: [{
        stationKey: "navigator",
        skillApproaches: [{ optionKey: "plot", label: "Plot a route", skill: "piloting-lore" }]
      }]
    }]
  };
}

function sampleActor() {
  return {
    id: "actor-nav",
    uuid: "Actor.actor-nav",
    name: "Test Navigator",
    type: "character",
    getStatistic(key) {
      if (key === "piloting-lore" || key === "piloting") return { slug: key, label: "Piloting Lore", mod: 7 };
      return null;
    }
  };
}

function buildSession(actor) {
  return {
    status: "active",
    currentRoundIndex: 0,
    event: sampleEvent(),
    roundResults: [{
      stationResults: { navigator: null },
      selectedStationSkills: { navigator: "piloting-lore" },
      selectedStationOptionLabels: { navigator: "Plot a route" }
    }],
    stationAssignments: { navigator: { actorId: actor.id, actorUuid: actor.uuid, actorName: actor.name, actorType: actor.type, source: "override", overridden: true } }
  };
}


function captureDebug(callback) {
  const original = console.debug;
  const entries = [];
  console.debug = (...args) => entries.push(args);
  try {
    callback();
  } finally {
    console.debug = original;
  }
  return entries;
}

export async function runTravelApproachStatisticDebugSmokeChecks() {
  const actor = sampleActor();
  const session = buildSession(actor);
  const options = { actors: [actor] };

  const quietEntries = captureDebug(() => prepareTravelSceneOverlayState(session, options));
  assertSmoke(!quietEntries.some((entry) => entry[0] === "Arcflight | Travel approach statistic resolution"), "default overlay preparation does not log approach statistic diagnostics");

  const enabledEntries = captureDebug(() => prepareTravelSceneOverlayState(session, { ...options, debugTravelApproachStatistics: true }));
  const diagnostic = enabledEntries.find((entry) => entry[0] === "Arcflight | Travel approach statistic resolution");
  assertSmoke(Boolean(diagnostic), "explicit debug option logs approach statistic diagnostics");
  assertSmoke(diagnostic?.[1]?.stationKey === "navigator" && diagnostic?.[1]?.resolvedStatisticKey && diagnostic?.[1]?.modifier === 7, "diagnostic includes statistic resolution details");

  return { ok: true, checked: ["default-quiet", "explicit-debug-option"] };
}

export default runTravelApproachStatisticDebugSmokeChecks;
