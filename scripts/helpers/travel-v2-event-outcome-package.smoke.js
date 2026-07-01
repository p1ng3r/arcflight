import { applyTravelV2FinalOutcomeToShip, prepareTravelV2EventOutcomePackage, prepareTravelV2FinalOutcomeApplyState, prepareTravelV2FinalOutcomePackageReviewState, prepareTravelV2FinalOutcomePackagePublicState, prepareTravelV2FinalOutcomePackageGmState } from "./travel-v2-event-outcome-package.js";
import { prepareTravelEventRunnerState } from "./travel-event-runner.js";
function assertSmoke(c,m){if(!c)throw new Error(`Travel v2 event outcome package smoke check failed: ${m}`)}
function assertEqual(a,e,m){if(a!==e)throw new Error(`Travel v2 event outcome package smoke check failed: ${m}. Expected ${e}, got ${a}.`)}
function snap(v){return JSON.stringify(v)}
function completed(outcomes=["success"]){return { status:"completed", completed:true, completedAt:"2026-06-20T00:00:00.000Z", event:{rounds:outcomes.map((_,i)=>({roundNumber:i+1}))}, travelV2EventCompletion:{completed:true, summaryText:"done"}, pressure:{strain:2}, hazards:{pendingDraws:[{id:"hazard"}]}, shipScars:{pending:[{id:"scar"}]}, rewardCandidates:[{id:"reward"}], consequenceCandidates:[{id:"consequence"}], travelV2PressureApplications:{records:[{roundIndex:0, roundNumber:1, outcomeKey:outcomes[0], totalsByPressureType:{strain:2}}]}, travelV2RoundResolutions:{records:outcomes.map((o,i)=>({roundIndex:i, roundNumber:i+1, effectiveOutcomeKey:o, stationSummary:{ok:true}}))}}}
function liveCompleted(){return { status:"completed", completedAt:"2026-06-21T00:00:00.000Z", event:{key:"lantern-in-the-static", name:"The Lantern in the Static", rounds:[{roundNumber:1}], finalOutcomes:{criticalSuccess:{label:"Lantern Rescued Cleanly", rewards:["The true lantern flame as a narrative boon"]}}}, summary:{suggestedFinalOutcome:"criticalSuccess", suggestedFinalOutcomeLabel:"Lantern Rescued Cleanly", finalOutcomeText:"The lantern is rescued cleanly."}, roundResults:[{roundNumber:1, stationResults:{navigator:"criticalSuccess", engineer:"success"}}] }}
function liveSummaryOnly(){return { status:"completed", completedAt:"2026-06-21T00:00:00.000Z", event:{key:"lantern-in-the-static", name:"The Lantern in the Static", rounds:[{roundNumber:1}]}, summary:{suggestedFinalOutcome:"criticalSuccess", suggestedFinalOutcomeLabel:"Lantern Rescued Cleanly", finalOutcomeText:"The lantern is rescued cleanly.", rounds:[{roundNumber:1, stationResults:{navigator:"criticalSuccess"}}]} }}
function liveEndedEarly(){return { status:"completed", completedAt:"2026-06-21T00:00:00.000Z", event:{rounds:[{roundNumber:1}]}, summary:{finalOutcomeText:"The event ended before stations ran."}, roundResults:[{roundNumber:1, stationResults:{navigator:null, engineer:null}}] }}
export async function runTravelV2EventOutcomePackageSmokeChecks(){
  assertSmoke(!prepareTravelV2EventOutcomePackage(null).canPreparePackage,"missing session blocks");
  assertSmoke(!prepareTravelV2EventOutcomePackage({status:"active", event:{rounds:[]}}).canPreparePackage,"active session blocks");
  assertSmoke(!prepareTravelV2EventOutcomePackage({status:"completed", event:{rounds:[]}}).canPreparePackage,"missing completion summary blocks");
  const nullApplyState = prepareTravelV2FinalOutcomeApplyState(null, { user: { isGM: true } });
  assertSmoke(!nullApplyState.canApply && nullApplyState.disabled && nullApplyState.rows.length === 0, "null session returns blocked GM apply state without throwing");
  const nullReviewState = prepareTravelV2FinalOutcomePackageReviewState(null, { user: { isGM: true } });
  assertSmoke(!nullReviewState.canPreparePackage && nullReviewState.applyState?.canApply === false, "null session review state returns blocked apply state without throwing");
  const nullRunnerState = prepareTravelEventRunnerState(null, { user: { isGM: true }, library: { events: {} }, runnerSessionLibrary: { sessions: {} } });
  assertSmoke(!nullRunnerState.hasSession && nullRunnerState.finalOutcomeApply?.canApply === false, "null runner state prepares blocked apply state without throwing");
  const activeApplyState = prepareTravelV2FinalOutcomeApplyState({ status: "active", event: { rounds: [] } }, { user: { isGM: true } });
  assertSmoke(!activeApplyState.canApply && activeApplyState.rows.length === 0, "active session returns blocked apply state without throwing");
  const session=completed(["success","criticalSuccess"]); const before=snap(session); const pkg=prepareTravelV2EventOutcomePackage(session);
  assertSmoke(pkg.canPreparePackage,"completed session prepares package");
  assertEqual(pkg.eventOutcomeKey,"critical-success","critical success majority summarizes");
  assertEqual(pkg.pressureSummary.totalsByPressureType.strain,2,"pressure summary cloned");
  assertEqual(pkg.hazardSummary.length,1,"hazards cloned");
  assertEqual(pkg.shipScarCandidates.length,1,"ship scars cloned");
  assertEqual(pkg.rewardCandidates.length,1,"rewards cloned only when present");
  assertEqual(pkg.consequenceCandidates.length,1,"consequences cloned only when present");
  const withFinalOutcome = completed(["mixed"]);
  withFinalOutcome.event.finalOutcomes = { mixed: { rewardCandidates: [{ name: "Rescued Lantern Flame" }], consequenceCandidates: [{ name: "Static Fingerprints" }], rewards: ["Passage secured"], losses: ["Lingering occult unease"] } };
  const finalPkg = prepareTravelV2EventOutcomePackage(withFinalOutcome);
  const criticalSuccessSession = completed(["criticalSuccess"]);
  criticalSuccessSession.event.finalOutcomes = { criticalSuccess: { label: "Lantern Rescued Cleanly", rewards: ["The true lantern flame as a narrative boon"] } };
  assertEqual(prepareTravelV2EventOutcomePackage(criticalSuccessSession).rewardCandidates.length,2,"critical success legacy rewards become visible follow-ups alongside session rewards");
  const livePkg = prepareTravelV2EventOutcomePackage(liveCompleted());
  assertSmoke(livePkg.canPreparePackage,"live completed runner session shape prepares package");
  assertEqual(livePkg.eventOutcomeKey,"critical-success","live summary suggested outcome drives package outcome");
  assertEqual(livePkg.rewardCandidates.length,1,"live final outcome rewards become visible follow-up candidates");
  const liveSummaryPkg = prepareTravelV2EventOutcomePackage(liveSummaryOnly());
  assertEqual(liveSummaryPkg.eventOutcomeKey,"critical-success","live summary rounds can support completed sessions without roundResults");
  assertEqual(liveSummaryPkg.rewardCandidates.length,1,"live summary final outcome text becomes a reward candidate when event finalOutcomes are absent");
  const endedEarlyPkg = prepareTravelV2EventOutcomePackage(liveEndedEarly());
  assertEqual(endedEarlyPkg.eventOutcomeKey,"not-run","all-null live rounds are not reported as mixed");
  assertEqual(finalPkg.rewardCandidates.length,3,"final outcome reward candidates and legacy rewards become visible follow-ups");
  assertEqual(finalPkg.consequenceCandidates.length,3,"final outcome consequence candidates and losses become visible follow-ups");
  assertEqual(snap(session),before,"helper does not mutate input");
  assertEqual(prepareTravelV2EventOutcomePackage(completed(["success","failure"])).eventOutcomeKey,"mixed","mixed summarizes conservatively");
  assertEqual(prepareTravelV2EventOutcomePackage(completed(["failure","failure","success"])).eventOutcomeKey,"failure","failure majority summarizes");
  const gmMarker = "GM_ONLY_MARKER_STRING";
  const reviewSession = completed(["success"]);
  reviewSession.rewardCandidates = [{ id: "reward", name: "Public Reward", gmNotes: gmMarker, internalSeverity: gmMarker, mutationPreview: { marker: gmMarker } }];
  const reviewBefore = snap(reviewSession);
  const review = prepareTravelV2FinalOutcomePackageReviewState(reviewSession, { user: { isGM: true } });
  assertSmoke(review.canPreparePackage, "completed session prepares final outcome package review state");
  assertEqual(review.title, "Final Outcome Package Review", "review state has panel title");
  assertEqual(review.sections.rewards.entries[0].gmNotes, gmMarker, "GM review state includes GM-only details for GMs");
  const blockedReview = prepareTravelV2FinalOutcomePackageReviewState({ status: "active", event: { rounds: [] } }, { user: { isGM: true } });
  assertSmoke(!blockedReview.canPreparePackage && blockedReview.hasBlockedReasons, "non-completed review state is blocked");
  const reopenedReview = prepareTravelV2FinalOutcomePackageReviewState(liveCompleted(), { user: { isGM: true } });
  assertSmoke(reopenedReview.canPreparePackage && reopenedReview.sections.rounds.hasEntries, "reopened completed-session shape renders review state");
  const publicReview = prepareTravelV2FinalOutcomePackagePublicState(reviewSession, { user: { isGM: false } });
  assertSmoke(!snap(publicReview).includes(gmMarker), "public review state excludes GM-only marker strings");
  assertSmoke(!snap(prepareTravelV2FinalOutcomePackageGmState(reviewSession, { user: { isGM: false } })).includes(gmMarker), "GM state falls back to public state when user is not GM");
  assertSmoke(snap(prepareTravelV2FinalOutcomePackageGmState(reviewSession, { user: { isGM: true } })).includes(gmMarker), "GM state includes management details only when user is GM");
  const previousGame = globalThis.game;
  try {
    globalThis.game = { user: { isGM: true } };
    assertSmoke(!snap(prepareTravelV2FinalOutcomePackageGmState(reviewSession, { user: { isGM: false } })).includes(gmMarker), "explicit non-GM user blocks GM state even when global game user is GM");
    assertSmoke(!snap(prepareTravelV2FinalOutcomePackageReviewState(reviewSession, { user: { isGM: false } })).includes(gmMarker), "explicit non-GM user blocks review GM state even when global game user is GM");
  } finally {
    if (previousGame === undefined) delete globalThis.game;
    else globalThis.game = previousGame;
  }
  assertEqual(snap(reviewSession), reviewBefore, "review helper does not mutate input");

  const previousFoundryForApply = globalThis.foundry;
  globalThis.foundry = globalThis.foundry ?? { utils: { deepClone: (value) => structuredClone(value), mergeObject: (base, update) => ({ ...structuredClone(base ?? {}), ...structuredClone(update ?? {}), current: { ...(base?.current ?? {}), ...(update?.current ?? {}) }, resources: { ...(base?.resources ?? {}), ...(update?.resources ?? {}) }, derived: { ...(base?.derived ?? {}), ...(update?.derived ?? {}) } }) } };
  function mockShip(name="Mock Ship") {
    const system = { current: { hull: 5, strain: 1, lifeveil: 4, morale: 3, supplies: 2 }, resources: { hull: { value: 5, max: 10 }, strain: { value: 1, max: 5 }, lifeveil: { value: 4, max: 8 }, morale: 3, supplies: 2 }, derived: { hullIntegrity: 10, strainCapacity: 5, lifeveilCapacity: 8 } };
    return { id: "ship-1", name, type: "vehicle", updates: [], getFlag: (_module, key) => key === "enabled" ? true : (key === "actorType" ? "arcflightShip" : (key === "system" ? system : undefined)), async update(data) { this.updates.push(data); for (const [path, value] of Object.entries(data)) { const parts = path.replace(/^flags\.arcflight\./, "").split("."); let cursor = { system }; for (const part of parts.slice(0, -1)) cursor = cursor[part] ??= {}; cursor[parts.at(-1)] = value; } } };
  }
  const applySession = completed(["success"]);
  applySession.event.finalOutcomes = { success: { proposedEffects: [{ type: "resource", resource: "hull", mode: "add", value: -2, label: "Hull Cost" }, { type: "resource", resource: "morale", mode: "set", value: 5, label: "Morale Lift" }, { type: "resource", resource: "storedSpellRanks", mode: "add", value: 1, label: "Unsupported" }] } };
  const ship = mockShip();
  const applyBefore = snap(applySession);
  const applyPreview = prepareTravelV2FinalOutcomeApplyState(applySession, { actor: ship, user: { isGM: true } });
  assertSmoke(applyPreview.canApply, "completed session with supported changes produces apply preview");
  assertEqual(applyPreview.supportedRows.length, 2, "supported resource rows are listed");
  assertSmoke(applyPreview.unsupportedRows.length === 1 && applyPreview.deferredRows.length >= 1, "unsupported and deferred rows are listed");
  assertEqual(snap(applySession), applyBefore, "apply preview helper does not mutate input session");
  assertSmoke(!prepareTravelV2FinalOutcomeApplyState({ status: "active", event: { rounds: [] } }, { actor: ship, user: { isGM: true } }).canApply, "incomplete session blocks apply state");
  const nonGmState = prepareTravelV2FinalOutcomeApplyState(applySession, { actor: ship, user: { isGM: false } });
  assertSmoke(!nonGmState.canApply && nonGmState.rows.length === 0 && !snap(nonGmState).includes("Hull Cost"), "non-GM apply state is disabled and player-safe");
  assertSmoke(!prepareTravelV2FinalOutcomeApplyState(applySession, { user: { isGM: true } }).canApply, "missing target actor blocks apply state");
  const previousGameForApply = globalThis.game;
  try { globalThis.game = { user: { isGM: true } }; assertSmoke(!prepareTravelV2FinalOutcomeApplyState(applySession, { actor: ship, user: { isGM: false } }).canApply, "explicit non-GM blocks apply state even when global GM"); }
  finally { if (previousGameForApply === undefined) delete globalThis.game; else globalThis.game = previousGameForApply; }
  const dryRun = await applyTravelV2FinalOutcomeToShip(applySession, { actor: ship, user: { isGM: true }, dryRun: true, now: "2026-06-20T01:00:00.000Z" });
  assertSmoke(dryRun.ok && dryRun.dryRun && ship.updates.length === 0 && !dryRun.session.travelV2FinalOutcomeShipApplication, "dry run returns plan without mutating actor/session");
  const applied = await applyTravelV2FinalOutcomeToShip(applySession, { actor: ship, user: { isGM: true }, now: "2026-06-20T01:00:00.000Z" });
  assertSmoke(applied.ok && applied.session.travelV2FinalOutcomeShipApplication?.applied === true, "actual apply creates a session-local ship application record");
  assertSmoke(!applied.session.travelV2EventOutcomeApplication?.applied, "ship apply does not write the package-level application record");
  assertEqual(ship.getFlag("arcflight", "system").current.hull, 3, "actual apply mutates supported hull resource only");
  assertEqual(ship.getFlag("arcflight", "system").current.morale, 5, "actual apply mutates supported morale resource only");
  assertSmoke(!Object.keys(ship.updates[0]).some((key) => key.includes("storedSpellRanks")), "unsupported rows are not applied");
  const second = await applyTravelV2FinalOutcomeToShip(applied.session, { actor: ship, user: { isGM: true } });
  assertSmoke(!second.ok && second.blocked && ship.updates.length === 1, "applying twice is blocked without second mutation");

  const packageAppliedFirstSession = completed(["success"]);
  packageAppliedFirstSession.event.finalOutcomes = applySession.event.finalOutcomes;
  packageAppliedFirstSession.travelV2EventOutcomeApplication = { applied: true, appliedAt: "2026-06-20T00:30:00.000Z" };
  const packageAppliedFirstShip = mockShip("Package Applied First Ship");
  const packageAppliedFirstPreview = prepareTravelV2FinalOutcomeApplyState(packageAppliedFirstSession, { actor: packageAppliedFirstShip, user: { isGM: true } });
  assertSmoke(packageAppliedFirstPreview.canApply && packageAppliedFirstPreview.packageAlreadyApplied === true && packageAppliedFirstPreview.shipAlreadyApplied === false, "package-level apply does not block first ship-resource apply");
  const packageAppliedFirstResult = await applyTravelV2FinalOutcomeToShip(packageAppliedFirstSession, { actor: packageAppliedFirstShip, user: { isGM: true } });
  assertSmoke(packageAppliedFirstResult.ok && packageAppliedFirstResult.session.travelV2FinalOutcomeShipApplication?.applied === true, "ship apply writes separate ship-application record after package-level apply");
  const packageAppliedFirstSecond = await applyTravelV2FinalOutcomeToShip(packageAppliedFirstResult.session, { actor: packageAppliedFirstShip, user: { isGM: true } });
  assertSmoke(!packageAppliedFirstSecond.ok && packageAppliedFirstSecond.blocked && packageAppliedFirstShip.updates.length === 1, "separate ship application record blocks second ship apply");


  if (previousFoundryForApply === undefined) delete globalThis.foundry; else globalThis.foundry = previousFoundryForApply;
  const runnerState = prepareTravelEventRunnerState(reviewSession, { user: { isGM: true }, library: { events: {} }, runnerSessionLibrary: { sessions: {} } });
  assertSmoke(runnerState.finalOutcomePackageReview?.title === "Final Outcome Package Review", "runner app state includes final outcome package review state");
  return {ok:true, checked:["blocks","prepares","summarizes","clones","final-outcome-candidates","live-session-shape","inert","review-state","public-safe-review","gm-gated-review","runner-state","final-outcome-apply"]};
}
export default runTravelV2EventOutcomePackageSmokeChecks;
