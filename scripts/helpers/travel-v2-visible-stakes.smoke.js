import { normalizeTravelEventRunnerSession, prepareTravelEventRunnerState, prepareTravelPlayerMissionBoardState, prepareTravelPlayerStationCardState, prepareTravelV2VisibleStakesState } from "./travel-event-runner.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel v2 visible stakes smoke check failed: ${message}`); }
function snap(value) { return JSON.stringify(value); }

function fixtureSession() {
  return {
    event: {
      key: "storm-front",
      name: "Storm Front",
      category: "weather",
      roundCount: 2,
      visibleStakes: {
        crisisSummary: "Lightning cages the route.",
        threatenedResources: ["hull", { key: "morale", secret: "do not show" }],
        knownDangers: ["Crosswind", { label: "Visible reef", gmText: "GM note" }, { label: "Hidden ambush", hidden: true }],
        knownTells: [{ label: "Copper air", auditRecord: { id: "audit" } }],
        broadReward: { text: "A clean arrival", applyPayload: { mutate: true } },
        broadConsequence: { text: "A costly delay", targetActorUuid: "Actor.secret" },
        internalScoring: { fail: 2 },
        pendingConsequenceQueue: [{ secret: "queue" }]
      },
      hiddenHazards: [{ name: "Never show" }],
      knownDangers: [{ label: "Fallback hidden", unrevealedHazard: true }],
      rounds: [
        { title: "Approach", activeStations: ["navigator", "engineer"] },
        { title: "Breakthrough", activeStations: ["captain"] }
      ]
    },
    currentRoundIndex: 0
  };
}

export async function runTravelV2VisibleStakesSmokeChecks() {
  const minimal = prepareTravelV2VisibleStakesState({ event: { key: "quiet-skies", name: "Quiet Skies", rounds: [{ activeStations: ["navigator"] }] } }, { now: "2026-07-09T00:00:00.000Z" });
  assertSmoke(minimal.hasStakes === true, "minimal runner session produces visible stakes state");
  assertSmoke(minimal.eventName === "Quiet Skies" && minimal.roundCount === 1, "minimal state includes event name and round count");
  assertSmoke(minimal.availableStations.some((station) => station.stationKey === "navigator"), "minimal state includes active stations");

  const derived = prepareTravelV2VisibleStakesState({ event: { key: "rough-passage", description: "A rough passage.", rounds: [{ activeStations: ["engineer", "watchmaster"] }, { activeStations: ["captain"] }] } }, { now: "2026-07-09T00:00:00.000Z" });
  assertSmoke(derived.eventName === "Rough Passage" && derived.roundCount === 2, "missing explicit stakes derives event name and round count");
  assertSmoke(derived.availableStations.map((station) => station.stationKey).join(",") === "engineer,watchmaster", "missing explicit stakes derives stations from current or first round");

  const session = fixtureSession();
  const before = snap(session);
  const state = prepareTravelV2VisibleStakesState(session, { now: "2026-07-09T00:00:00.000Z" });
  const runnerState = prepareTravelEventRunnerState(session, { now: "2026-07-09T00:00:00.000Z", user: { isGM: true } });
  const playerRunnerState = prepareTravelEventRunnerState(session, { now: "2026-07-09T00:00:00.000Z", user: { isGM: false } });
  const serialized = snap(state);
  for (const forbidden of ["secret", "gmText", "gmOnly", "applyPayload", "internalMutation", "targetActorUuid", "auditRecord", "commitRecords", "userId", "userName", "pendingConsequenceQueue", "internalScoring", "Never show", "Hidden ambush"]) {
    assertSmoke(!serialized.includes(forbidden), `forbidden value stripped: ${forbidden}`);
  }
  assertSmoke(state.knownDangers.length === 2 && state.knownDangers.some((danger) => danger.label === "Visible reef"), "visible known dangers remain while hidden hazards do not leak");
  assertSmoke(runnerState.travelV2VisibleStakes?.eventKey === "storm-front", "runner state exposes visible stakes under travelV2VisibleStakes");
  assertSmoke(playerRunnerState.travelV2VisibleStakes?.knownDangers?.some((danger) => danger.label === "Visible reef"), "non-GM runner state keeps player-safe visible stakes details");
  for (const forbidden of ["secret", "gmText", "gmOnly", "applyPayload", "targetActorUuid", "auditRecord", "pendingConsequenceQueue", "Hidden ambush"]) {
    assertSmoke(!snap(playerRunnerState.travelV2VisibleStakes).includes(forbidden), `runner visible stakes omits forbidden value: ${forbidden}`);
  }

  const normalizedSession = normalizeTravelEventRunnerSession(session, { now: "2026-07-09T00:00:00.000Z" }).session;
  assertSmoke(normalizedSession.event.visibleStakes?.knownDangers?.some((danger) => danger.label === "Visible reef"), "normalized runner session preserves sanitized visible stakes for runtime state");
  assertSmoke(!snap(normalizedSession.event.visibleStakes).includes("Hidden ambush") && !snap(normalizedSession.event.visibleStakes).includes("gmText"), "normalized event visible stakes are player-safe before runner exposure");
  const missionBoardState = prepareTravelPlayerMissionBoardState(normalizedSession, { user: { isGM: false } });
  const stationCardState = prepareTravelPlayerStationCardState(normalizedSession, "navigator", { user: { isGM: false } });
  assertSmoke(missionBoardState.visibleStakes?.knownDangers?.some((danger) => danger.label === "Visible reef"), "mission board state exposes visible stakes details");
  assertSmoke(stationCardState.visibleStakes?.knownDangers?.some((danger) => danger.label === "Visible reef"), "station card state exposes visible stakes details");
  for (const publicState of [missionBoardState.visibleStakes, stationCardState.visibleStakes]) {
    const publicJson = snap(publicState);
    for (const forbidden of ["secret", "gmText", "gmOnly", "applyPayload", "targetActorUuid", "auditRecord", "pendingConsequenceQueue", "Hidden ambush"]) {
      assertSmoke(!publicJson.includes(forbidden), `player visible stakes omits forbidden value: ${forbidden}`);
    }
  }
  assertSmoke(snap(session) === before, "input session is not mutated");

  return { ok: true, checked: ["minimal-state", "derived-fallbacks", "player-safe-sanitization", "hidden-hazard-filtering", "runner-state-wiring", "runtime-session-normalization", "player-state-wiring", "input-immutability"] };
}

export default runTravelV2VisibleStakesSmokeChecks;
