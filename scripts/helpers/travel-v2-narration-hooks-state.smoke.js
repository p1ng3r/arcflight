import assert from "node:assert/strict";
import { prepareTravelEventRunnerState } from "./travel-event-runner.js";
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
  "catalogSuggestions",
  "hiddenHazards",
  "debugReport",
  "futureTriggers"
]);

const REQUIRED_NARRATION_HOOK_FIELDS = Object.freeze([
  "hasNarrationHooks",
  "eventKey",
  "eventName",
  "category",
  "categoryLabel",
  "roundCount",
  "currentRoundIndex",
  "currentRoundNumber",
  "phase",
  "phaseLabel",
  "crisisSummary",
  "visibleStakesSummary",
  "threatenedResources",
  "knownDangers",
  "knownTells",
  "availableStations",
  "stationHooks",
  "pressureHooks",
  "hazardHooks",
  "outcomeHooks",
  "promptSeeds",
  "safetyNote"
]);

function fixtureSession(extra = {}) {
  return {
    key: "narration-hooks-state-session",
    status: "active",
    startedAt: "2026-07-10T00:00:00.000Z",
    currentRoundIndex: 0,
    event: {
      key: "storm-front",
      name: "Storm Front",
      category: "weather",
      visibleStakes: {
        crisisSummary: "Lightning cages the route.",
        threatenedResources: ["Hull", { label: "Morale", gmText: "hidden" }],
        knownDangers: [{ label: "Visible reef", secret: "hidden current" }, { label: "GM ambush", gmOnly: true }],
        knownTells: ["Copper air", { label: "Future trigger", unrevealedHazard: true }]
      },
      hiddenHazards: [{ name: "Never show" }],
      rounds: [{ title: "Approach", phase: "crisis", activeStations: ["navigator", "engineer"] }]
    },
    stationAssignments: { navigator: { actorName: "Lira", userId: "hidden-user" } },
    pressure: { hull: 2, lifeVeil: 1, gmSecretPressure: 9 },
    roundResults: [{
      stationActions: { navigator: { type: "eventApproach" }, engineer: { type: "support" } },
      stationResults: { navigator: "success", engineer: "failure" },
      selectedStationOptionLabels: { navigator: "thread the squall" }
    }],
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

function runnerOptions(isGM) {
  return { user: { isGM }, library: { events: {} }, runnerSessionLibrary: { sessions: {} }, now: "2026-07-10T00:00:00.000Z" };
}

function assertNoForbiddenTerms(value, label) {
  const serialized = JSON.stringify(value);
  for (const forbidden of FORBIDDEN_PLAYER_SAFE_TERMS) {
    assert.equal(serialized.includes(forbidden), false, `${label} excludes ${forbidden}`);
  }
}

export async function runTravelV2NarrationHooksStateSmokeChecks() {
  const emptyState = prepareTravelEventRunnerState(null, runnerOptions(true));
  assert.equal(Object.hasOwn(emptyState, "travelV2NarrationHooks"), true, "empty runner state exposes canonical narration hooks");
  assert.equal(Object.hasOwn(emptyState, "narrationHooks"), true, "empty runner state exposes narration hooks alias");
  assert.deepEqual(emptyState.narrationHooks, emptyState.travelV2NarrationHooks, "empty runner narration hook alias matches canonical state");
  assert.equal(emptyState.travelV2NarrationHooks.hasNarrationHooks, false, "empty runner narration hook state has no hooks");

  const session = fixtureSession();
  const gmState = prepareTravelEventRunnerState(session, runnerOptions(true));
  const directState = prepareTravelV2NarrationHookState(gmState.session, runnerOptions(true));
  assert.equal(Object.hasOwn(gmState, "travelV2NarrationHooks"), true, "fixture runner state exposes canonical narration hooks");
  assert.equal(Object.hasOwn(gmState, "narrationHooks"), true, "fixture runner state exposes narration hooks alias");
  assert.deepEqual(gmState.narrationHooks, gmState.travelV2NarrationHooks, "fixture runner narration hook alias matches canonical state");
  assert.deepEqual(gmState.travelV2NarrationHooks, directState, "fixture runner narration hooks match direct helper output");
  for (const field of REQUIRED_NARRATION_HOOK_FIELDS) {
    assert.equal(Object.hasOwn(gmState.travelV2NarrationHooks, field), true, `runner narration hooks preserve ${field}`);
  }

  const nonGmState = prepareTravelEventRunnerState(session, runnerOptions(false));
  assert.deepEqual(gmState.travelV2NarrationHooks, nonGmState.travelV2NarrationHooks, "GM and non-GM runner states expose the same narration hook output");
  assert.deepEqual(nonGmState.narrationHooks, nonGmState.travelV2NarrationHooks, "non-GM runner narration hook alias matches canonical state");
  assertNoForbiddenTerms(gmState.travelV2NarrationHooks, "GM narration hooks");
  assertNoForbiddenTerms(nonGmState.travelV2NarrationHooks, "non-GM narration hooks");

  return { checked: ["runner-state-empty-narration-hooks", "runner-state-direct-helper-output", "runner-state-narration-hook-fields", "runner-state-narration-hook-player-safety"] };
}

export default runTravelV2NarrationHooksStateSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await runTravelV2NarrationHooksStateSmokeChecks();
    console.log("Travel v2 narration hooks state smoke checks passed.");
    console.log(`Checked ${result.checked.length} groups:`);
    for (const checkName of result.checked) console.log(`- ${checkName}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
