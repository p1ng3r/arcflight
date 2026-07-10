import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareTravelEventRunnerState } from "./travel-event-runner.js";
import { prepareTravelV2NarrationHookState } from "./travel-v2-narration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODULE_ROOT = path.resolve(__dirname, "../..");
const TEMPLATE_PATH = path.join(MODULE_ROOT, "templates/apps/travel-event-runner.hbs");
const CSS_PATH = path.join(MODULE_ROOT, "styles/arcflight.css");

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

function fixtureSession() {
  return {
    key: "narration-hooks-runtime-closeout-session",
    status: "active",
    startedAt: "2026-07-10T00:00:00.000Z",
    currentRoundIndex: 0,
    event: {
      key: "storm-front",
      name: "Storm Front",
      category: "weather",
      visibleStakes: {
        crisisSummary: "Lightning cages the route.",
        threatenedResources: ["Hull", { label: "Morale", gmText: "hidden morale detail" }],
        knownDangers: [{ label: "Visible reef", secret: "hidden current" }, { label: "GM ambush", gmOnly: true }],
        knownTells: ["Copper air", { label: "Future trigger", unrevealedHazard: true }],
        broadReward: "A clean arrival window.",
        broadConsequence: "A costly delay."
      },
      hiddenHazards: [{ name: "Never show" }],
      rounds: [{ title: "Approach", phase: "crisis", activeStations: ["navigator", "engineer"] }]
    },
    stationAssignments: { navigator: { actorName: "Lira", userId: "hidden-user" } },
    pressure: { hull: 2, lifeVeil: 1, weather: 3, gmSecretPressure: 9 },
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
    debugReport: { futureTriggers: ["never show"] }
  };
}

function runnerOptions(isGM) {
  return { user: { isGM }, library: { events: {} }, runnerSessionLibrary: { sessions: {} }, now: "2026-07-10T00:00:00.000Z" };
}

function assertNoForbiddenTerms(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  for (const forbidden of FORBIDDEN_PLAYER_SAFE_TERMS) {
    assert.equal(serialized.includes(forbidden), false, `${label} excludes ${forbidden}`);
  }
}

function readNarrationHooksTemplateBlock() {
  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const start = template.indexOf("{{#if state.narrationHooks.hasNarrationHooks}}");
  const end = template.indexOf("{{#if state.travelV2GmFlowStatus}}", start);
  assert.notEqual(start, -1, "template gates narration hooks with state.narrationHooks.hasNarrationHooks");
  assert.notEqual(end, -1, "template keeps narration hooks block before the GM flow status block");
  return template.slice(start, end);
}

function assertTemplateContract() {
  const block = readNarrationHooksTemplateBlock();
  assert.match(block, /Narration Hooks/, "template block includes Narration Hooks heading");
  assert.match(block, /state\.narrationHooks/, "template block uses state.narrationHooks");
  assert.doesNotMatch(block, /state\.travelV2NarrationHooks/, "template block does not use canonical runner key directly");
  for (const field of ["visibleStakesSummary", "promptSeeds", "stationHooks", "pressureHooks", "hazardHooks", "outcomeHooks", "safetyNote"]) {
    assert.match(block, new RegExp(field), `template block includes ${field}`);
  }
  assert.doesNotMatch(block, /\{\{this\}\}/, "template block does not render raw {{this}}");
  assertNoForbiddenTerms(block, "narration hooks template block");
}

function assertCssContract() {
  const css = fs.readFileSync(CSS_PATH, "utf8");
  for (const className of [
    ".arcflight-travel-runner-mvp__narration-hooks",
    ".arcflight-travel-runner-mvp__narration-hooks-grid",
    ".arcflight-travel-runner-mvp__narration-hooks-list",
    ".arcflight-travel-runner-mvp__narration-hook",
    ".arcflight-travel-runner-mvp__narration-hook-tone"
  ]) {
    assert.equal(css.includes(className), true, `CSS includes ${className}`);
  }
}

export async function runTravelV2NarrationHooksRuntimeCloseoutSmokeChecks() {
  const session = fixtureSession();
  const helperState = prepareTravelV2NarrationHookState(session, runnerOptions(true));
  assert.equal(helperState.hasNarrationHooks, true, "helper returns narration hooks for public runtime cues");
  for (const field of REQUIRED_NARRATION_HOOK_FIELDS) {
    assert.equal(Object.hasOwn(helperState, field), true, `helper exposes ${field}`);
  }
  assert.equal(helperState.eventKey, "storm-front", "helper keeps event key");
  assert.equal(helperState.eventName, "Storm Front", "helper keeps event name");
  assert.equal(helperState.category, "weather", "helper keeps category");
  assert.equal(helperState.categoryLabel, "Weather", "helper labels category");
  assert.equal(helperState.roundCount, 1, "helper keeps round count");
  assert.equal(helperState.currentRoundIndex, 0, "helper keeps current round index");
  assert.equal(helperState.currentRoundNumber, 1, "helper keeps current round number");
  assert.equal(helperState.phase, "crisis", "helper keeps phase");
  assert.equal(helperState.phaseLabel, "Crisis", "helper labels phase");
  assert.equal(helperState.crisisSummary, "Lightning cages the route.", "helper keeps crisis summary");
  assert.ok(helperState.visibleStakesSummary.includes("Lightning cages the route."), "helper summarizes visible stakes");
  assert.deepEqual(helperState.threatenedResources, ["Hull", "Morale"], "helper keeps public threatened resources");
  assert.deepEqual(helperState.knownDangers, ["Visible reef"], "helper excludes hidden dangers");
  assert.deepEqual(helperState.knownTells, ["Copper air"], "helper excludes hidden tells");
  assert.deepEqual(helperState.availableStations.map((station) => station.stationKey), ["navigator", "engineer"], "helper keeps active round stations");
  assert.ok(helperState.stationHooks.length > 0, "helper includes station hooks");
  assert.deepEqual(helperState.pressureHooks.map((hook) => hook.resource), ["Hull", "Lifeveil"], "helper includes public pressure resources only");
  assert.deepEqual(helperState.hazardHooks.map((hook) => hook.name), ["Visible Reef"], "helper includes revealed hazards only");
  assert.ok(helperState.outcomeHooks.length > 0, "helper includes outcome hooks");
  assert.ok(helperState.promptSeeds.length > 0, "helper includes prompt seeds");
  assert.match(helperState.safetyNote, /Player-safe/, "helper includes player-safe safety note");
  assertNoForbiddenTerms(helperState, "helper narration hooks");

  const gmState = prepareTravelEventRunnerState(session, runnerOptions(true));
  const nonGmState = prepareTravelEventRunnerState(session, runnerOptions(false));
  assert.ok(Object.hasOwn(gmState, "travelV2NarrationHooks"), "runner state exposes travelV2NarrationHooks");
  assert.ok(Object.hasOwn(gmState, "narrationHooks"), "runner state exposes narrationHooks");
  assert.deepEqual(gmState.narrationHooks, gmState.travelV2NarrationHooks, "runner narrationHooks alias matches canonical state");
  assert.deepEqual(gmState.travelV2NarrationHooks, prepareTravelV2NarrationHookState(gmState.session, runnerOptions(true)), "runner narration hooks match direct helper output from player-safe session");
  assert.deepEqual(gmState.travelV2NarrationHooks, nonGmState.travelV2NarrationHooks, "GM and non-GM states expose the same player-safe narration hooks");
  assertNoForbiddenTerms(gmState.travelV2NarrationHooks, "GM runner narration hooks");
  assertNoForbiddenTerms(nonGmState.narrationHooks, "non-GM runner narration hooks");

  assertTemplateContract();
  assertCssContract();

  return { checked: ["narration-hooks-helper-runtime-contract", "narration-hooks-runner-state-contract", "narration-hooks-template-contract", "narration-hooks-css-contract", "narration-hooks-player-safety"] };
}

export default runTravelV2NarrationHooksRuntimeCloseoutSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await runTravelV2NarrationHooksRuntimeCloseoutSmokeChecks();
    console.log("Travel v2 narration hooks runtime closeout smoke checks passed.");
    console.log(`Checked ${result.checked.length} groups:`);
    for (const checkName of result.checked) console.log(`- ${checkName}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
