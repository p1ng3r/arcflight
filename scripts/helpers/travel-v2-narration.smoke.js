import { prepareTravelV2StationResultVignettes, prepareTravelV2RoundNarration, sanitizeTravelV2PublicNarration } from "./travel-v2-narration.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel v2 narration smoke check failed: ${message}`); }
function snap(value) { return JSON.stringify(value); }
function session() { return { status: "active", currentRoundIndex: 0, pressure: { strain: 2 }, event: { rounds: [{ round: 1, title: "Static Crossing", activeStations: ["navigator", "engineer", "watchmaster", "captain"] }] }, stationAssignments: { navigator: { actorName: "Nara" }, engineer: { actorName: "Edo" }, watchmaster: { actorName: "Wren" }, captain: { actorName: "Mira" } }, roundResults: [{ roundNumber: 1, stationResults: { navigator: "criticalSuccess", engineer: "success", watchmaster: "failure", captain: "criticalFailure" }, selectedStationOptionLabels: { navigator: "Cut the Route", engineer: "Patch Strain", watchmaster: "Spot the Shear", captain: "Rally the Crew" }, stationActions: { navigator: { type: "eventApproach" }, engineer: { type: "stabilize", stabilizePressureKey: "strain" }, watchmaster: { type: "hazardResponse", hazardRecordId: "hz1", hazardName: "Void Shear" }, captain: { type: "eventApproach" } } }], travelV2Hazards: { records: [{ id: "hz1", hazardId: "void", name: "Void Shear", status: "active", revealed: true, playerText: "The route shivers sideways.", publicModifierText: "Navigator DC +2.", gmText: "GM SECRET", gmMechanicalNotes: "GM MECH", unresolvedConsequence: { gmOnly: "SECRET" } }, { id: "hz2", hazardId: "hidden", name: "Hidden Teeth", status: "active", revealed: false, playerText: "Should not leak", gmText: "hidden gm" }] } }; }

export async function runTravelV2NarrationSmokeChecks() {
  const sideEffects = [];
  const prior = { ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game, Actor: globalThis.Actor, Item: globalThis.Item };
  globalThis.ChatMessage = { create: () => sideEffects.push("chat") };
  globalThis.JournalEntry = { create: () => sideEffects.push("journal") };
  globalThis.game = { socket: { emit: () => sideEffects.push("socket") }, combat: { update: () => sideEffects.push("combat") } };
  globalThis.Actor = { updateDocuments: () => sideEffects.push("actors") };
  globalThis.Item = { updateDocuments: () => sideEffects.push("items") };
  try {
    const start = session();
    const before = snap(start);
    const vignettes = prepareTravelV2StationResultVignettes(start, { now: "2026-06-23T00:00:00.000Z" });
    assertSmoke(snap(start) === before, "vignette generation does not mutate input session");
    assertSmoke(vignettes.length === 4, "station result vignettes are created for active stations");
    assertSmoke(vignettes.some((v) => v.actionLabel === "Push Forward"), "push forward label is distinct");
    assertSmoke(vignettes.some((v) => v.actionLabel === "Stabilize / Repair"), "stabilize label is distinct");
    assertSmoke(vignettes.some((v) => v.actionLabel === "Respond to Hazard"), "hazard response label is distinct");
    assertSmoke(new Set(vignettes.map((v) => v.tone)).size === 4, "degree categories produce different narration tones");
    const round = prepareTravelV2RoundNarration(start, 0, { now: "2026-06-23T00:00:00.000Z" });
    assertSmoke(round.complete && round.completionState === "complete", "complete round narration is marked complete");
    assertSmoke(round.stationOutcomeBullets.length === 4 && round.whatHappened.includes("Navigator"), "combined round narration includes station outcomes");
    assertSmoke(round.hazardNotes.active.some((hazard) => hazard.name === "Void Shear"), "GM narration includes active hazard notes");
    const partial = prepareTravelV2RoundNarration({ ...start, roundResults: [{ ...start.roundResults[0], stationResults: { ...start.roundResults[0].stationResults, captain: null } }] }, 0);
    assertSmoke(!partial.complete && partial.completionState === "partial" && /Draft narration/.test(partial.whatHappened), "partial round narration is marked incomplete");
    const publicNarration = sanitizeTravelV2PublicNarration(round);
    const publicSnap = snap(publicNarration);
    assertSmoke(publicSnap.includes("Void Shear"), "revealed hazards may appear in public narration");
    assertSmoke(!publicSnap.includes("Hidden Teeth") && !publicSnap.includes("Should not leak"), "unrevealed hazards do not appear in public narration");
    assertSmoke(!publicSnap.includes("GM SECRET") && !publicSnap.includes("GM MECH") && !publicSnap.includes("gmOnly"), "GM-only fields do not leak into public narration");
    assertSmoke(sideEffects.length === 0, "narration generation does not call chat, journal, combat, actor, item, or socket APIs");
  } finally {
    globalThis.ChatMessage = prior.ChatMessage; globalThis.JournalEntry = prior.JournalEntry; globalThis.game = prior.game; globalThis.Actor = prior.Actor; globalThis.Item = prior.Item;
  }
  return { ok: true, checked: ["station-vignettes", "action-labels", "degree-tones", "combined-summary", "partial-round", "public-revealed-hazard", "public-unrevealed-boundary", "public-no-gm-leak", "no-side-effects"] };
}

export default runTravelV2NarrationSmokeChecks;
