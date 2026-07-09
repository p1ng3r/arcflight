import {
  prepareTravelEventRunnerState,
  prepareTravelV2VisibleStakesState
} from "./travel-event-runner.js";

function assertSmoke(condition, message, details = null) {
  if (!condition) {
    const suffix = details ? `\n${JSON.stringify(details, null, 2)}` : "";
    throw new Error(`Travel v2 visible stakes state smoke failed: ${message}${suffix}`);
  }
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeSession(overrides = {}) {
  return {
    key: "visible-stakes-smoke",
    status: "active",
    currentRoundIndex: 0,
    event: {
      key: "visible-stakes-event",
      name: "Visible Stakes Crossing",
      roundCount: 2,
      visibleStakes: {
        eventGoal: "Cross the bright seam before pressure peaks.",
        currentPressure: "Strain 1, Morale 0.",
        dangerThresholds: "At Strain 3, the GM may stage a public complication.",
        knownHazards: ["Static shear"],
        successResult: "The ship exits on course.",
        failureResult: "The ship loses the safe bearing.",
        escalationRisk: "Unresolved pressure can create a visible ship-scar candidate.",
        currentPendingDecisions: ["Choose who leads the first station exchange."],
        gmText: "Do not expose this GM note.",
        auditRecord: { secret: true },
        unrevealedHazard: "Hidden parasite"
      },
      hiddenHazards: [{ name: "Hidden parasite", gmOnly: true }],
      rounds: [
        {
          round: 1,
          title: "Bright Seam",
          openingVignette: "The seam brightens while the deck waits for orders.",
          activeStations: ["captain", "navigator"],
          stationPrompts: {
            captain: { playerAction: "Hold the crew together." },
            navigator: { playerAction: "Find the safest bearing." }
          }
        },
        {
          round: 2,
          title: "Static Wake",
          activeStations: ["engineer"],
          stationPrompts: { engineer: { playerAction: "Keep the engine steady." } }
        }
      ]
    },
    roundResults: [
      { stationResults: { captain: null, navigator: null }, selectedStationSkills: {}, selectedStationOptionLabels: {}, stationActions: {}, stationOrderCommitments: {} },
      { stationResults: { engineer: null }, selectedStationSkills: {}, selectedStationOptionLabels: {}, stationActions: {}, stationOrderCommitments: {} }
    ],
    ...overrides
  };
}

const FORBIDDEN_PLAYER_SAFE_TERMS = [
  "auditRecord",
  "commitRecords",
  "userId",
  "userName",
  "gmText",
  "applyPayload",
  "targetActorUuid",
  "mutationScope",
  "internalMutation",
  "secret",
  "pendingConsequenceQueue",
  "gmOnly",
  "unrevealedHazard",
  "catalogSuggestions",
  "Hidden parasite"
];

export default async function runTravelV2VisibleStakesStateSmokeChecks() {
  const checked = [];
  const session = makeSession();
  const before = JSON.stringify(session);

  const direct = prepareTravelV2VisibleStakesState(session);
  assertSmoke(direct.eventName === "Visible Stakes Crossing", "direct helper derives event name", direct);
  assertSmoke(direct.roundCount === 2 && direct.currentRoundNumber === 1, "direct helper exposes round count and current round", direct);
  assertSmoke(direct.knownHazards.includes("Static shear") && !JSON.stringify(direct).includes("Hidden parasite"), "direct helper includes visible hazards only", direct);

  const runnerState = prepareTravelEventRunnerState(session, { user: { id: "gm", isGM: true } });
  assertSmoke(runnerState.travelV2VisibleStakes?.eventGoal === "Cross the bright seam before pressure peaks.", "runner state exposes visible stakes", runnerState.travelV2VisibleStakes);
  assertSmoke(JSON.stringify(runnerState.visibleStakes) === JSON.stringify(runnerState.travelV2VisibleStakes), "runner state exposes the same visible stakes data under the legacy-friendly alias");

  const playerState = prepareTravelEventRunnerState(session, { user: { id: "player", isGM: false } });
  assertSmoke(playerState.travelV2VisibleStakes?.eventGoal === runnerState.travelV2VisibleStakes.eventGoal, "player-safe state exposes the same safe visible stakes data", playerState.travelV2VisibleStakes);
  const playerJson = JSON.stringify(playerState.travelV2VisibleStakes);
  assertSmoke(FORBIDDEN_PLAYER_SAFE_TERMS.every((term) => !playerJson.includes(term)), "player-safe visible stakes omit GM-only/internal fields", playerState.travelV2VisibleStakes);

  const missingExplicitSession = cloneData(session);
  delete missingExplicitSession.event.visibleStakes;
  const fallback = prepareTravelEventRunnerState(missingExplicitSession, { user: { id: "player", isGM: false } }).travelV2VisibleStakes;
  assertSmoke(fallback.eventName === "Visible Stakes Crossing" && fallback.roundCount === 2, "missing explicit stakes derive event name and round count", fallback);
  assertSmoke(["captain", "navigator", "engineer"].every((stationKey) => fallback.stations.some((station) => station.stationKey === stationKey)), "missing explicit stakes derive stations", fallback);

  assertSmoke(JSON.stringify(session) === before, "visible stakes state preparation does not mutate the input session");
  const emptyState = prepareTravelEventRunnerState(null, { user: { id: "player", isGM: false } });
  assertSmoke(emptyState.hasSession === false && emptyState.travelV2VisibleStakes?.hasSession === false, "no-session runner state includes empty visible stakes without throwing", emptyState.travelV2VisibleStakes);

  checked.push("Runner and player-safe visible stakes state wiring is deterministic and safe");
  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await runTravelV2VisibleStakesStateSmokeChecks();
    console.log("Travel v2 visible stakes state smoke checks passed.");
    console.log(`Checked ${result.checked.length} groups:`);
    for (const checkName of result.checked) console.log(`- ${checkName}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
