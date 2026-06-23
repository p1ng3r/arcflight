import { normalizeTravelEventRunnerSession, prepareTravelPlayerMissionBoardState, activateTravelV2RunnerHazard, clearTravelV2RunnerHazard, drawTravelV2RunnerHazard, holdTravelV2RunnerHazard, revealTravelV2RunnerHazard } from "./travel-event-runner.js";
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
    assertEqual(result.session.travelV2Hazards.records[0].revealed, false, "drawn hazard starts GM-only and unrevealed");

    result = drawTravelV2HazardsForPressureResult(result.session, { hazardDraws: [hazardDraw(3)] }, { now: "2026-06-22T00:00:01.000Z" });
    assertEqual(result.session.travelV2Hazards.records.length, 2, "pressure reaching 3 draws another hazard");
    result = drawTravelV2HazardsForPressureResult(result.session, { hazardDraws: [hazardDraw(4)] }, { now: "2026-06-22T00:00:02.000Z" });
    assertEqual(result.session.travelV2Hazards.records.length, 3, "pressure reaching 4 draws another hazard");
    const rerun = drawTravelV2HazardsForPressureResult(result.session, { hazardDraws: [hazardDraw(2), hazardDraw(3), hazardDraw(4)] });
    assertEqual(rerun.session.travelV2Hazards.records.length, 3, "rerunning pressure handling does not duplicate threshold hazards");

    const staged = drawTravelV2RunnerHazard(rerun.session, { now: "2026-06-22T00:00:02.500Z" });
    assertSmoke(staged.ok, "manual draw stages a hazard");
    const stagedId = staged.drawn.id;
    assertEqual(staged.session.travelV2Hazards.records.find((record) => record.id === stagedId).status, "pending", "manual draw stages pending hazard");
    const held = holdTravelV2RunnerHazard(staged.session, stagedId, { now: "2026-06-22T00:00:02.750Z" });
    assertSmoke(held.ok, "manual hold succeeds");
    assertEqual(held.session.travelV2Hazards.records.find((record) => record.id === stagedId).status, "held", "held hazard remains unresolved");
    const revealed = revealTravelV2RunnerHazard(held.session, stagedId, { now: "2026-06-22T00:00:02.900Z" });
    assertSmoke(revealed.ok, "manual reveal succeeds with player-safe text");
    assertEqual(revealed.session.travelV2Hazards.records.find((record) => record.id === stagedId).revealed, true, "reveal marks player visibility without activating");

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

    const revealedPublic = prepareTravelPlayerMissionBoardState(revealed.session);
    assertSmoke(revealedPublic.publicHazards.some((record) => record.id === stagedId && record.playerText && !record.gmText), "revealed hazard appears in player-safe payload without GM text");
    const activatedRevealed = activateTravelV2RunnerHazard(revealed.session, stagedId, { now: "2026-06-22T00:00:03.100Z" });
    const activatedPublic = prepareTravelPlayerMissionBoardState(activatedRevealed.session);
    assertSmoke(activatedPublic.publicHazards.some((record) => record.id === stagedId && record.status === "active" && !record.gmText), "activating revealed hazard updates player-safe status without GM text");
    const clearedRevealed = clearTravelV2RunnerHazard(activatedRevealed.session, stagedId, { now: "2026-06-22T00:00:03.200Z" });
    const clearedPublic = prepareTravelPlayerMissionBoardState(clearedRevealed.session);
    assertSmoke(!clearedPublic.publicHazards.some((record) => record.id === stagedId), "clearing revealed hazard removes it from player-safe payload");
    const unrevealedPublic = prepareTravelPlayerMissionBoardState(activated.session);
    assertSmoke(!unrevealedPublic.publicHazards.some((record) => record.id === firstId), "activating unrevealed hazard does not leak into player-safe payload");

    const panel = prepareTravelV2HazardPanelState(revealed.session);
    assertSmoke(panel.records.every((record) => typeof record.playerText === "string" && typeof record.gmText === "string"), "player-safe and GM text are separated");
    assertSmoke(panel.revealed.every((record) => record.revealed === true && record.playerText && record.gmText), "panel tracks revealed player-safe hazards while retaining GM text for GM panel only");
    assertEqual(sideEffects.length, 0, "hazard helpers do not call chat, journal, combat, or socket APIs");
  } finally {
    globalThis.ChatMessage = prior.ChatMessage;
    globalThis.JournalEntry = prior.JournalEntry;
    globalThis.game = prior.game;
  }
  return { ok: true, checked: ["threshold-2-draw", "threshold-3-draw", "threshold-4-draw", "duplicate-threshold-guard", "manual-draw", "manual-hold", "manual-reveal", "manual-activate", "manual-clear", "normalization-save-reopen", "safe-text-separation", "visibility-boundary", "player-safe-reveal-payload", "player-safe-status-update", "player-safe-clear-removal", "unrevealed-no-leak", "no-side-effects"] };
}

export default runTravelV2HazardsSmokeChecks;
