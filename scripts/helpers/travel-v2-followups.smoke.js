import { prepareTravelV2FollowUpRecordsFromActorApplication, prepareTravelV2FollowUpState, updateTravelV2FollowUpStatus, ensureTravelV2FollowUpsOnActor } from "./travel-v2-followups.js";
function assertSmoke(c,m){if(!c)throw new Error(`Travel v2 follow-ups smoke failed: ${m}`)}
function assertEqual(a,b,m){if(a!==b)throw new Error(`Travel v2 follow-ups smoke failed: ${m}: expected ${b}, got ${a}`)}
function actor(records=[]){return {type:"vehicle", flags:{arcflight:{system:{travelV2:{followUps:{version:1,records}}}}}}}
function preview(){return {packageKey:"pkg", eventKey:"e", eventName:"The Lantern", sessionKey:"s", eventOutcomeKey:"mixed", eventOutcomeLabel:"Mixed", manualFollowUps:[{label:"Ship Scar Candidate", value:{name:"Echoes in the Rigging"}, text:"Ship Scar Candidate: Echoes"},{label:"Fortune Candidate", value:{name:"True Bearing Remembered"}},{label:"Reward Candidate", value:{name:"Rescued Lantern Flame", value:5}},{label:"Consequence Candidate", value:{name:"Static Fingerprints"}},{label:"Hull", value:{delta:3}, text:"Hull: +3 manual"}]}}
export default async function runTravelV2FollowUpsSmokeChecks(){
  const checked=[]; const p=preview(); const records=prepareTravelV2FollowUpRecordsFromActorApplication(p,{now:"now"});
  assertEqual(records.length,5,"extracts follow-up candidates from actor application preview"); checked.push("extract candidates");
  const state=prepareTravelV2FollowUpState(actor(),p,{now:"now"}); assertSmoke(state.groups.find(g=>g.type==="reward").records.length===1,"groups by type"); checked.push("groups by type");
  assertEqual(records[0].id, prepareTravelV2FollowUpRecordsFromActorApplication(p,{now:"later"})[0].id,"creates stable IDs"); checked.push("stable IDs");
  const dedup=prepareTravelV2FollowUpState(actor([records[0]]),p,{now:"now"}); assertEqual(dedup.records.length,5,"does not duplicate existing follow-ups"); checked.push("dedupe existing");
  const nonGm=await updateTravelV2FollowUpStatus(actor(records),records[0].id,"kept",{user:{isGM:false}}); assertSmoke(!nonGm.ok && nonGm.error.includes("Only a GM"),"status update requires GM when user exists"); checked.push("GM required");
  let updateData=null; const gmActor=actor(records); const kept=await updateTravelV2FollowUpStatus(gmActor,records[0].id,"kept",{user:{isGM:true},note:"later",now:"then",updateActor:async(a,d)=>{updateData=d;}}); assertSmoke(kept.ok,"keep works"); assertEqual(Object.keys(updateData).length,1,"status update changes only expected flag data"); checked.push("keep and scoped update");
  const afterKept=updateData["flags.arcflight.system.travelV2.followUps"].records; for (const status of ["dismissed","resolved"]) { let data=null; const r=await updateTravelV2FollowUpStatus(actor(afterKept),records[0].id,status,{user:{isGM:true},updateActor:async(a,d)=>{data=d;}}); assertSmoke(r.ok && data,"dismiss/resolve work"); } checked.push("dismiss resolve");
  const noActor=await updateTravelV2FollowUpStatus(null,records[0].id,"kept",{}); assertSmoke(!noActor.ok && noActor.error.includes("actor"),"missing actor blocks clearly"); checked.push("missing actor");
  const noId=await updateTravelV2FollowUpStatus(actor(records),"","kept",{}); assertSmoke(!noId.ok && noId.error.includes("id"),"missing follow-up id blocks clearly"); checked.push("missing id");
  assertEqual(records.find(r=>r.type==="reward").originalValue.name,"Rescued Lantern Flame","unsupported reward value preserved"); checked.push("original value preserved");
  let sideEffects=[]; await ensureTravelV2FollowUpsOnActor(actor(),p,{updateActor:async(a,d)=>{sideEffects.push(Object.keys(d));}}); assertEqual(sideEffects.length,1,"no actor/item/journal/chat/socket side effects beyond injected actor update"); checked.push("no side effects");
  return {checked};
}
