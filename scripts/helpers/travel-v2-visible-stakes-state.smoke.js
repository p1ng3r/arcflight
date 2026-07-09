import assert from "node:assert/strict";
import { prepareTravelEventRunnerState, prepareTravelV2VisibleStakesState } from "./travel-event-runner.js";

function fixtureSession(extra = {}) {
  return {
    key: "visible-stakes-session",
    status: "active",
    startedAt: "2026-07-09T00:00:00.000Z",
    currentRoundIndex: 0,
    event: {
      key: "storm-front",
      name: "Storm Front",
      category: "weather",
      baseDC: 18,
      visibleStakes: {
        crisisSummary: "Lightning cages the route.",
        threatenedResources: ["Hull", "Morale"],
        knownDangers: ["Crosswinds"],
        knownTells: ["Copper air"],
        broadReward: "A clean arrival window.",
        broadConsequence: "A costly delay."
      },
      rounds: [
        { title: "Approach", activeStations: ["navigator", "engineer"] },
        { title: "Breakthrough", activeStations: ["captain"] }
      ]
    },
    roundResults: [{ stationResults: {}, stationActions: {} }],
    ...extra
  };
}

export default async function runTravelV2VisibleStakesStateSmokeChecks() {
  const emptyState = prepareTravelEventRunnerState(null, { user: { isGM: true }, library: { events: {} }, runnerSessionLibrary: { sessions: {} } });
  assert.equal(emptyState.hasSession, false, "empty runner state remains empty");
  assert.equal(emptyState.travelV2VisibleStakes.hasStakes, false, "empty runner state includes safe empty visible stakes state");
  assert.deepEqual(emptyState.visibleStakes, emptyState.travelV2VisibleStakes, "empty runner state includes visible stakes alias");

  const session = fixtureSession();
  const before = JSON.stringify(session);
  const runnerState = prepareTravelEventRunnerState(session, { user: { isGM: true }, library: { events: {} }, runnerSessionLibrary: { sessions: {} }, now: "2026-07-09T00:00:00.000Z" });
  const directState = prepareTravelV2VisibleStakesState(runnerState.session, { now: "2026-07-09T00:00:00.000Z" });
  assert.deepEqual(runnerState.travelV2VisibleStakes, directState, "runner state exposes the canonical visible-stakes helper output");
  assert.deepEqual(runnerState.visibleStakes, runnerState.travelV2VisibleStakes, "runner state exposes the visible stakes alias");
  assert.equal(runnerState.travelV2VisibleStakes.eventName, "Storm Front", "runner visible stakes keeps event identity");
  assert.deepEqual(runnerState.travelV2VisibleStakes.availableStations.map((station) => station.stationKey), ["navigator", "engineer"], "runner visible stakes keeps active station list");
  assert.equal(JSON.stringify(session), before, "runner visible-stakes preparation does not mutate input session");

  const nonGmState = prepareTravelEventRunnerState(fixtureSession({ event: { ...fixtureSession().event, visibleStakes: { crisisSummary: "Visible summary", knownDangers: [{ label: "Visible reef", gmText: "Do not show" }] } } }), { user: { isGM: false }, library: { events: {} }, runnerSessionLibrary: { sessions: {} } });
  const serialized = JSON.stringify(nonGmState.visibleStakes);
  assert.equal(nonGmState.visibleStakes.hasStakes, true, "non-GM runner state retains player-safe visible stakes alias");
  assert.deepEqual(nonGmState.visibleStakes, nonGmState.travelV2VisibleStakes, "non-GM runner state keeps alias player-safe");
  for (const forbidden of ["gmText", "auditRecord", "commitRecords", "userId", "userName", "applyPayload", "targetActorUuid", "pendingConsequenceQueue", "gmOnly", "secret"]) {
    assert.equal(serialized.includes(forbidden), false, `non-GM runner visible stakes excludes ${forbidden}`);
  }

  return { checked: ["runner-state-visible-stakes", "visible-stakes-alias", "canonical-helper-output", "runner-state-input-immutability", "non-gm-player-safe-visible-stakes"] };
}
