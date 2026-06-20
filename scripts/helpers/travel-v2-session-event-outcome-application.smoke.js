import { applyTravelV2EventOutcomePackageToRunnerSession } from "./travel-v2-session-event-outcome-application.js";
function assertSmoke(c,m){if(!c)throw new Error(`Travel v2 session event outcome application smoke check failed: ${m}`)}
function assertEqual(a,e,m){if(a!==e)throw new Error(`Travel v2 session event outcome application smoke check failed: ${m}. Expected ${e}, got ${a}.`)}
function snap(v){return JSON.stringify(v)}
function session(){return {key:"outcome", status:"completed", completed:true, completedAt:"2026-06-20T00:00:00.000Z", event:{rounds:[{roundNumber:1}]}, travelV2EventCompletion:{completed:true}, travelV2RoundResolutions:{records:[{roundIndex:0, roundNumber:1, effectiveOutcomeKey:"success"}]}, travelV2PressureApplications:{records:[{roundIndex:0, totalsByPressureType:{strain:1}}]}}}
export function runTravelV2SessionEventOutcomeApplicationSmokeChecks(){
  assertSmoke(!applyTravelV2EventOutcomePackageToRunnerSession({status:"active"}).ok,"application blocks before package readiness");
  const s=session(); const before=snap(s); const applied=applyTravelV2EventOutcomePackageToRunnerSession(s,{now:"2026-06-20T00:01:00.000Z"});
  assertSmoke(applied.ok && applied.applied,"application succeeds");
  assertSmoke(applied.session!==s,"application clones session");
  assertEqual(applied.session.travelV2EventOutcomeApplication.applied,true,"session-local application record written");
  assertEqual(applied.session.travelV2EventOutcomeApplication.eventOutcomeKey,"success","outcome copied");
  assertEqual(snap(s),before,"source session not mutated");
  const duplicate=applyTravelV2EventOutcomePackageToRunnerSession(applied.session);
  assertSmoke(!duplicate.ok,"duplicate application blocks");
  return {ok:true, checked:["blocks","clones","writes-record","duplicate-block"]};
}
export default runTravelV2SessionEventOutcomeApplicationSmokeChecks;
