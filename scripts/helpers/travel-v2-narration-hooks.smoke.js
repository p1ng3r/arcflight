import assert from "node:assert/strict";
import { prepareTravelV2NarrationHookState } from "./travel-v2-narration.js";

const FORBIDDEN_PLAYER_SAFE_TERMS = Object.freeze([
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
  "catalogSuggestions"
]);

function fixtureSession(extra = {}) {
  return {
    key: "narration-hooks-session",
    currentRoundIndex: 0,
    event: {
      key: "storm-front",
      name: "Storm Front",
      visibleStakes: {
        crisisSummary: "Lightning cages the route.",
        threatenedResources: ["Hull", { label: "Morale", gmText: "hidden" }],
        knownDangers: [{ label: "Visible reef", secret: "hidden current" }],
        knownTells: ["Copper air"],
        broadReward: "A clean arrival window.",
        broadConsequence: "A costly delay.",
        gmOnly: "Do not show"
      },
      rounds: [{ title: "Approach", activeStations: ["navigator", "engineer"] }]
    },
    stationAssignments: { navigator: { actorName: "Lira", userId: "hidden-user" } },
    pressure: { weather: 2 },
    roundResults: [{
      stationActions: { navigator: { type: "eventApproach" }, engineer: { type: "support" } },
      stationResults: { navigator: "success", engineer: "failure" },
      selectedStationOptionLabels: { navigator: "thread the squall" }
    }],
    travelV2Momentum: {
      value: 1,
      records: [{ id: "momentum-1", roundIndex: 0, stationKey: "navigator", amount: 1, status: "earned", publicSummary: "The crew gains Momentum.", gmOnly: "hidden" }]
    },
    travelV2Hazards: {
      records: [
        { id: "hazard-visible", name: "Visible Reef", status: "active", revealed: true, publicSummary: "A reef breaks the cloudline.", gmText: "hidden" },
        { id: "hazard-hidden", name: "Hidden Crosswind", status: "active", revealed: false, publicSummary: "Do not include", unrevealedHazard: true }
      ]
    },
    pendingConsequenceQueue: [{ secret: "hidden" }],
    ...extra
  };
}

export default async function runTravelV2NarrationHooksSmokeChecks() {
  const session = fixtureSession();
  const before = JSON.stringify(session);
  const hookState = prepareTravelV2NarrationHookState(session, { now: "2026-07-10T00:00:00.000Z" });
  const serialized = JSON.stringify(hookState);

  assert.equal(hookState.eventName, "Storm Front", "hook state keeps player-safe event identity");
  assert.equal(hookState.roundTitle, "Approach", "hook state keeps current round title");
  assert.deepEqual(hookState.stationHooks.map((hook) => hook.stationKey), ["navigator", "engineer"], "hook state includes current round station hooks");
  assert.equal(hookState.hazardHooks.length, 1, "hook state includes only revealed hazards");
  assert.equal(hookState.hazardHooks[0].name, "Visible Reef", "hook state keeps revealed hazard name");
  assert.ok(hookState.prompts.some((prompt) => prompt.includes("Lightning cages the route.")), "hook prompts include visible crisis framing");
  assert.ok(hookState.prompts.some((prompt) => prompt.includes("Navigator")), "hook prompts include public station beats");
  assert.equal(JSON.stringify(session), before, "narration hook preparation does not mutate input session");

  for (const forbidden of FORBIDDEN_PLAYER_SAFE_TERMS) {
    assert.equal(serialized.includes(forbidden), false, `narration hook state excludes ${forbidden}`);
  }
  assert.equal(serialized.includes("Hidden Crosswind"), false, "hook state excludes unrevealed hazard names");
  assert.equal(serialized.includes("hidden-user"), false, "hook state excludes user identity values");

  const empty = prepareTravelV2NarrationHookState(null, { now: "2026-07-10T00:00:00.000Z" });
  assert.equal(empty.roundIndex, 0, "empty hook state has a stable round index");
  assert.deepEqual(empty.stationHooks, [], "empty hook state has no station hooks");
  assert.deepEqual(empty.prompts, [], "empty hook state has no generated prompts");

  return { checked: ["narration-hook-current-round-state", "narration-hook-player-safe-fields", "narration-hook-input-immutability", "narration-hook-empty-state"] };
}
