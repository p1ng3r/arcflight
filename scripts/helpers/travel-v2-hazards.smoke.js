import { normalizeTravelEventRunnerSession, activateTravelV2RunnerHazard, clearTravelV2RunnerHazard } from "./travel-event-runner.js";
import { drawTravelV2HazardsForPressureResult, prepareTravelV2HazardPanelState } from "./travel-v2-hazards.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel v2 hazards smoke check failed: ${message}`); }
function assertEqual(actual, expected, message) { if (actual !== expected) throw new Error(`Travel v2 hazards smoke check failed: ${message}. Expected ${expected}, got ${actual}.`); }
function snap(value) { return JSON.stringify(value); }

function hazardDraw(threshold) { return { pressureType: "strain", threshold, count: 1, reason: "threshold-crossing", roundNumber: 1 }; }
function session() { return { status: "active", currentRoundIndex: 0, event: { rounds: [{ round: 1, title: "Hazards", activeStations: [] }] } }; }

export function runTravelV2HazardsSmokeChecks() {
  const sideEffects = [];
  const prior = { ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game };
  globalThis.ChatMessage = { create: () => sideEffects.push("chat") };
  globalThis.JournalEntry = { create: () => sideEffects.push("journal") };
  globalThis.game = { socket: { emit: () => sideEffects.push("socket") }, combat: { update: () => sideEffects.push("combat") } };
  try {
    const start = session();
    const before = snap(start);
    let result = drawTravelV2HazardsForPressureResult(start, { hazardDraws: [hazardDraw(2)] }, { now: "2026-06-22T00:00:00.000Z" });
    assertEqual(snap(start), before, "drawing does not mutate input session");
    assertEqual(result.session.travelV2Hazards.records.length, 1, "pressure reaching 2 draws one hazard");
    assertEqual(result.session.travelV2Hazards.records[0].status, "pending", "drawn hazard starts pending");

    result = drawTravelV2HazardsForPressureResult(result.session, { hazardDraws: [hazardDraw(3)] }, { now: "2026-06-22T00:00:01.000Z" });
    assertEqual(result.session.travelV2Hazards.records.length, 2, "pressure reaching 3 draws another hazard");
    result = drawTravelV2HazardsForPressureResult(result.session, { hazardDraws: [hazardDraw(4)] }, { now: "2026-06-22T00:00:02.000Z" });
    assertEqual(result.session.travelV2Hazards.records.length, 3, "pressure reaching 4 draws another hazard");
    const rerun = drawTravelV2HazardsForPressureResult(result.session, { hazardDraws: [hazardDraw(2), hazardDraw(3), hazardDraw(4)] });
    assertEqual(rerun.session.travelV2Hazards.records.length, 3, "rerunning pressure handling does not duplicate threshold hazards");

    const firstId = rerun.session.travelV2Hazards.records[0].id;
    const activated = activateTravelV2RunnerHazard(rerun.session, firstId, { now: "2026-06-22T00:00:03.000Z" });
    assertSmoke(activated.ok, "manual activate succeeds");
    assertEqual(activated.session.travelV2Hazards.records[0].status, "active", "manual activate changes pending to active");
    const cleared = clearTravelV2RunnerHazard(activated.session, firstId, { now: "2026-06-22T00:00:04.000Z" });
    assertSmoke(cleared.ok, "manual clear succeeds");
    assertEqual(cleared.session.travelV2Hazards.records[0].status, "cleared", "manual clear changes active to cleared");

    const normalized = normalizeTravelEventRunnerSession(cleared.session);
    assertSmoke(normalized.ok, "session with hazards normalizes");
    assertEqual(normalized.session.travelV2Hazards.records.length, 3, "hazard state survives normalization");
    const reopened = normalizeTravelEventRunnerSession(JSON.parse(JSON.stringify(normalized.session)));
    assertEqual(reopened.session.travelV2Hazards.records[0].status, "cleared", "hazard state survives save/reopen JSON path");

    const panel = prepareTravelV2HazardPanelState(reopened.session);
    assertSmoke(panel.records.every((record) => typeof record.playerText === "string" && typeof record.gmText === "string"), "player-safe and GM text are separated");
    assertEqual(sideEffects.length, 0, "hazard helpers do not call chat, journal, combat, or socket APIs");
  } finally {
    globalThis.ChatMessage = prior.ChatMessage;
    globalThis.JournalEntry = prior.JournalEntry;
    globalThis.game = prior.game;
  }
  return { ok: true, checked: ["threshold-2-draw", "threshold-3-draw", "threshold-4-draw", "duplicate-threshold-guard", "manual-activate", "manual-clear", "normalization-save-reopen", "safe-text-separation", "no-side-effects"] };
}

export default runTravelV2HazardsSmokeChecks;
