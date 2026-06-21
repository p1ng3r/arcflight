import { prepareTravelV2EventOutcomePackage } from "./travel-v2-event-outcome-package.js";
function assertSmoke(c,m){if(!c)throw new Error(`Travel v2 event outcome package smoke check failed: ${m}`)}
function assertEqual(a,e,m){if(a!==e)throw new Error(`Travel v2 event outcome package smoke check failed: ${m}. Expected ${e}, got ${a}.`)}
function snap(v){return JSON.stringify(v)}
function completed(outcomes=["success"]){return { status:"completed", completed:true, completedAt:"2026-06-20T00:00:00.000Z", event:{rounds:outcomes.map((_,i)=>({roundNumber:i+1}))}, travelV2EventCompletion:{completed:true, summaryText:"done"}, pressure:{strain:2}, hazards:{pendingDraws:[{id:"hazard"}]}, shipScars:{pending:[{id:"scar"}]}, rewardCandidates:[{id:"reward"}], consequenceCandidates:[{id:"consequence"}], travelV2PressureApplications:{records:[{roundIndex:0, roundNumber:1, outcomeKey:outcomes[0], totalsByPressureType:{strain:2}}]}, travelV2RoundResolutions:{records:outcomes.map((o,i)=>({roundIndex:i, roundNumber:i+1, effectiveOutcomeKey:o, stationSummary:{ok:true}}))}}}
function liveCompleted(){return { status:"completed", completedAt:"2026-06-21T00:00:00.000Z", event:{key:"lantern-in-the-static", name:"The Lantern in the Static", rounds:[{roundNumber:1}], finalOutcomes:{criticalSuccess:{label:"Lantern Rescued Cleanly", rewards:["The true lantern flame as a narrative boon"]}}}, summary:{suggestedFinalOutcome:"criticalSuccess", suggestedFinalOutcomeLabel:"Lantern Rescued Cleanly", finalOutcomeText:"The lantern is rescued cleanly."}, roundResults:[{roundNumber:1, stationResults:{navigator:"criticalSuccess", engineer:"success"}}] }}
function liveSummaryOnly(){return { status:"completed", completedAt:"2026-06-21T00:00:00.000Z", event:{key:"lantern-in-the-static", name:"The Lantern in the Static", rounds:[{roundNumber:1}]}, summary:{suggestedFinalOutcome:"criticalSuccess", suggestedFinalOutcomeLabel:"Lantern Rescued Cleanly", finalOutcomeText:"The lantern is rescued cleanly.", rounds:[{roundNumber:1, stationResults:{navigator:"criticalSuccess"}}]} }}
function liveEndedEarly(){return { status:"completed", completedAt:"2026-06-21T00:00:00.000Z", event:{rounds:[{roundNumber:1}]}, summary:{finalOutcomeText:"The event ended before stations ran."}, roundResults:[{roundNumber:1, stationResults:{navigator:null, engineer:null}}] }}
export function runTravelV2EventOutcomePackageSmokeChecks(){
  assertSmoke(!prepareTravelV2EventOutcomePackage(null).canPreparePackage,"missing session blocks");
  assertSmoke(!prepareTravelV2EventOutcomePackage({status:"active", event:{rounds:[]}}).canPreparePackage,"active session blocks");
  assertSmoke(!prepareTravelV2EventOutcomePackage({status:"completed", event:{rounds:[]}}).canPreparePackage,"missing completion summary blocks");
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
  return {ok:true, checked:["blocks","prepares","summarizes","clones","final-outcome-candidates","live-session-shape","inert"]};
}
export default runTravelV2EventOutcomePackageSmokeChecks;
