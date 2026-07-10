import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareTravelEventRunnerState, prepareTravelV2VisibleStakesState } from "./travel-event-runner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODULE_ROOT = path.resolve(__dirname, "../..");
const TEMPLATE_PATH = path.join(MODULE_ROOT, "templates/apps/travel-event-runner.hbs");

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

function fixtureSession() {
  return {
    key: "visible-stakes-runtime-closeout-session",
    status: "active",
    startedAt: "2026-07-09T00:00:00.000Z",
    currentRoundIndex: 0,
    event: {
      key: "storm-front",
      name: "Storm Front",
      category: "weather",
      visibleStakes: {
        crisisSummary: "Lightning cages the route.",
        threatenedResources: ["Hull", { label: "Morale", secret: "Do not show" }],
        knownDangers: ["Crosswinds", { label: "Visible reef", gmText: "GM-only note" }],
        knownTells: [{ label: "Copper air", auditRecord: { id: "audit" } }],
        broadReward: { text: "A clean arrival window.", applyPayload: { mutate: true } },
        broadConsequence: { text: "A costly delay.", targetActorUuid: "Actor.secret" },
        pendingConsequenceQueue: [{ secret: "queue" }]
      },
      rounds: [
        { title: "Approach", activeStations: ["navigator", "engineer"] },
        { title: "Breakthrough", activeStations: ["captain"] }
      ]
    },
    roundResults: [{ stationResults: {}, stationActions: {} }]
  };
}

function readVisibleStakesTemplateBlock() {
  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const start = template.indexOf("{{#if state.visibleStakes.hasStakes}}");
  const end = template.indexOf("{{#if state.travelV2GmFlowStatus}}", start);
  assert.notEqual(start, -1, "template gates visible stakes with state.visibleStakes.hasStakes");
  assert.notEqual(end, -1, "template keeps visible stakes block before the GM flow status block");
  return template.slice(start, end);
}

export default async function runTravelV2VisibleStakesRuntimeCloseoutSmokeChecks() {
  const session = fixtureSession();
  const helperState = prepareTravelV2VisibleStakesState(session, { now: "2026-07-09T00:00:00.000Z" });

  assert.equal(helperState.hasStakes, true, "helper returns hasStakes for a session with visible stakes");
  for (const field of [
    "eventName",
    "categoryLabel",
    "roundCount",
    "currentRoundNumber",
    "crisisSummary",
    "threatenedResources",
    "knownDangers",
    "knownTells",
    "broadReward",
    "broadConsequence",
    "availableStations",
    "safetyNote"
  ]) {
    assert.ok(Object.hasOwn(helperState, field), `helper exposes player-safe field ${field}`);
  }
  assert.equal(helperState.eventName, "Storm Front", "helper keeps event name");
  assert.equal(helperState.categoryLabel, "Weather", "helper keeps category label");
  assert.equal(helperState.roundCount, 2, "helper keeps round count");
  assert.equal(helperState.currentRoundNumber, 1, "helper keeps current round number");
  assert.equal(helperState.crisisSummary, "Lightning cages the route.", "helper keeps crisis summary");
  assert.deepEqual(helperState.availableStations.map((station) => station.stationKey), ["navigator", "engineer"], "helper keeps current available stations");

  const runnerState = prepareTravelEventRunnerState(session, { user: { isGM: true }, library: { events: {} }, runnerSessionLibrary: { sessions: {} }, now: "2026-07-09T00:00:00.000Z" });
  assert.ok(Object.hasOwn(runnerState, "travelV2VisibleStakes"), "runner exposes travelV2VisibleStakes");
  assert.ok(Object.hasOwn(runnerState, "visibleStakes"), "runner exposes visibleStakes alias");
  const directRunnerHelperState = prepareTravelV2VisibleStakesState(runnerState.session, { now: "2026-07-09T00:00:00.000Z" });
  assert.deepEqual(runnerState.visibleStakes, runnerState.travelV2VisibleStakes, "runner visibleStakes alias matches travelV2VisibleStakes");
  assert.deepEqual(runnerState.travelV2VisibleStakes, directRunnerHelperState, "runner state uses the canonical helper output");

  const visibleStakesBlock = readVisibleStakesTemplateBlock();
  assert.match(visibleStakesBlock, /state\.visibleStakes\.hasStakes/, "template gates the panel with state.visibleStakes.hasStakes");
  assert.match(visibleStakesBlock, /Visible Stakes/, "template renders the Visible Stakes heading");
  assert.doesNotMatch(visibleStakesBlock, /state\.travelV2VisibleStakes/, "template uses state.visibleStakes instead of state.travelV2VisibleStakes");
  assert.doesNotMatch(visibleStakesBlock, /\{\{this\}\}/, "template does not render raw {{this}} in visible stakes lists");
  assert.match(visibleStakesBlock, /stationName/, "template includes station name rendering");
  assert.match(visibleStakesBlock, /stationKey/, "template includes station key fallback rendering");

  for (const forbidden of FORBIDDEN_PLAYER_SAFE_TERMS) {
    assert.equal(visibleStakesBlock.includes(forbidden), false, `visible stakes template block excludes ${forbidden}`);
  }

  return { checked: ["visible-stakes-helper-fields", "visible-stakes-runner-aliases", "visible-stakes-template-wiring", "visible-stakes-template-no-leaks"] };
}
