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
  "catalogSuggestions",
  "hiddenHazards",
  "debugReport",
  "futureTriggers"
]);
const PUBLIC_PRESSURE_RESOURCES = Object.freeze(["Hull", "Strain", "Lifeveil", "Morale", "Supplies"]);

function fixtureSession(extra = {}) {
  return {
    key: "narration-hooks-session",
    currentRoundIndex: 0,
    event: {
      key: "storm-front",
      name: "Storm Front",
      visibleStakes: {
        crisisSummary: "Lightning cages the route.",
        threatenedResources: ["Hull", { label: "Morale", gmText: "hidden" }, { label: "Hidden rigging", hidden: true }, { label: "Unrevealed reserve", revealed: false }],
        knownDangers: [{ label: "Visible reef", secret: "hidden current" }, { label: "GM ambush", gmOnly: true }, { label: "Private squall", playerVisible: false }],
        knownTells: ["Copper air", { label: "Future trigger", unrevealedHazard: true }],
        broadReward: "A clean arrival window.",
        broadConsequence: "A costly delay.",
        gmOnly: "Do not show",
        debugReport: "Do not show",
        futureTriggers: ["Do not show"]
      },
      hiddenHazards: [{ name: "Never show" }],
      rounds: [{ title: "Approach", activeStations: ["navigator", "engineer"] }]
    },
    stationAssignments: { navigator: { actorName: "Lira", userId: "hidden-user" } },
    pressure: { hull: 2, weather: 5, lifeVeil: 1, gmSecretPressure: 9, supplies: 0 },
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
  const secondHookState = prepareTravelV2NarrationHookState(session, { now: "2026-07-10T00:00:00.000Z" });
  const serialized = JSON.stringify(hookState);

  assert.deepEqual(hookState, secondHookState, "narration hook output remains deterministic for the same input");
  assert.equal(hookState.hasNarrationHooks, true, "hook state reports narration hooks when public cues exist");
  assert.equal(hookState.eventKey, "storm-front", "hook state keeps player-safe event key");
  assert.equal(hookState.eventName, "Storm Front", "hook state keeps player-safe event identity");
  assert.equal(hookState.roundCount, 1, "hook state includes round count");
  assert.equal(hookState.currentRoundIndex, 0, "hook state includes current round index");
  assert.equal(hookState.currentRoundNumber, 1, "hook state includes current round number");
  assert.equal(hookState.phase, "Approach", "hook state keeps current phase");
  assert.equal(hookState.crisisSummary, "Lightning cages the route.", "hook state keeps visible crisis summary");
  assert.deepEqual(hookState.threatenedResources, ["Hull", "Morale"], "hidden visible-stakes resources are excluded before label extraction");
  assert.deepEqual(hookState.knownDangers, ["Visible reef"], "hidden visible-stakes dangers are excluded before label extraction");
  assert.deepEqual(hookState.knownTells, ["Copper air"], "hidden visible-stakes tells are excluded before label extraction");

  assert.deepEqual(hookState.availableStations.map((station) => station.stationKey), ["navigator", "engineer"], "hook state includes available stations");
  assert.equal(Object.hasOwn(hookState.availableStations[0], "stationName"), true, "available station exposes stationName");
  assert.equal(Object.hasOwn(hookState.availableStations[0], "stationLabel"), false, "available station does not use stationLabel");
  for (const stationHook of hookState.stationHooks) {
    assert.equal(typeof stationHook.stationName, "string", "station hook includes stationName");
    assert.equal(typeof stationHook.prompt, "string", "station hook includes prompt");
    assert.equal(typeof stationHook.tone, "string", "station hook includes tone");
    assert.ok(stationHook.prompt.includes(stationHook.stationName), "station hook prompt references the station name");
  }

  assert.deepEqual(hookState.pressureHooks.map((hook) => hook.resource), ["Hull", "Lifeveil"], "pressure hooks include only public Travel v2 resources with positive pressure");
  for (const pressureHook of hookState.pressureHooks) {
    assert.ok(PUBLIC_PRESSURE_RESOURCES.includes(pressureHook.resource), "pressure hook resource is public");
    assert.equal(typeof pressureHook.prompt, "string", "pressure hook includes prompt");
    assert.equal(pressureHook.tone, "pressure", "pressure hook tone is pressure");
    assert.equal(Object.hasOwn(pressureHook, "value"), false, "pressure hook does not expose exact pressure value");
  }
  assert.equal(serialized.includes("weather"), false, "arbitrary pressure keys do not leak");
  assert.equal(serialized.includes("gmSecretPressure"), false, "GM-only pressure keys do not leak");

  assert.equal(hookState.hazardHooks.length, 1, "hook state includes only revealed hazards");
  assert.equal(hookState.hazardHooks[0].name, "Visible Reef", "hook state keeps revealed hazard name");
  assert.ok(hookState.outcomeHooks.some((hook) => hook.type === "roundSummary"), "hook state includes public outcome hooks");
  assert.ok(hookState.promptSeeds.some((prompt) => prompt.includes("Lightning cages the route.")), "prompt seeds include visible crisis framing");
  assert.ok(hookState.promptSeeds.some((prompt) => prompt.includes("Navigator")), "prompt seeds include public station beats");
  assert.equal(JSON.stringify(session), before, "narration hook preparation does not mutate input session");

  for (const forbidden of FORBIDDEN_PLAYER_SAFE_TERMS) {
    assert.equal(serialized.includes(forbidden), false, `narration hook state excludes ${forbidden}`);
  }
  for (const hiddenText of ["Hidden Crosswind", "hidden-user", "Hidden rigging", "Unrevealed reserve", "GM ambush", "Private squall", "Future trigger", "Never show"]) {
    assert.equal(serialized.includes(hiddenText), false, `hidden text is excluded: ${hiddenText}`);
  }

  const empty = prepareTravelV2NarrationHookState(null, { now: "2026-07-10T00:00:00.000Z" });
  assert.equal(empty.hasNarrationHooks, false, "empty hook state reports no narration hooks");
  assert.equal(empty.currentRoundIndex, 0, "empty hook state has a stable round index");
  assert.deepEqual(empty.stationHooks, [], "empty hook state has no station hooks");
  assert.deepEqual(empty.promptSeeds, [], "empty hook state has no generated prompt seeds");

  return { checked: ["narration-hook-current-round-state", "narration-hook-player-safe-fields", "narration-hook-input-immutability", "narration-hook-empty-state"] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await runTravelV2NarrationHooksSmokeChecks();
    console.log("Travel v2 narration hooks smoke checks passed.");
    console.log(`Checked ${result.checked.length} groups:`);
    for (const checkName of result.checked) console.log(`- ${checkName}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
