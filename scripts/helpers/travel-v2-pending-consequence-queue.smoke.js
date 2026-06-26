import { prepareTravelV2PendingConsequenceQueue, updateTravelV2PendingConsequenceQueueItem } from "./travel-v2-pending-consequence-queue.js";
function assertSmoke(c,m){if(!c)throw new Error(`Travel v2 pending consequence queue smoke check failed: ${m}`)}
function session(){return {key:"queue",status:"completed",completed:true,completedAt:"2026-06-26T00:00:00.000Z",event:{rounds:[{roundNumber:1}],finalOutcomes:{failure:{losses:["The route leaves a hostile trace."]}}},travelV2EventCompletion:{completed:true},travelV2RoundResolutions:{records:[{roundIndex:0,roundNumber:1,effectiveOutcomeKey:"failure"}]},travelV2FocusBacklashRecords:{records:[{id:"f1",roundIndex:0,stationName:"Engineer",status:"pending",publicRiskText:"The arkengine shudders.",publicBacklashPreviewText:"Review Strain pressure."}]},travelV2SupportBacklashRecords:{records:[{id:"s1",roundIndex:0,supportingStationName:"Captain",status:"pending",severity:"minor",publicRiskText:"Crew hesitates."}]},hazards:{records:[{id:"h1",roundIndex:0,status:"active",name:"Void Shear",playerText:"The lane is still unstable."}]},shipScars:{pending:[{id:"scar1",roundIndex:0,name:"Scorched Conduits",status:"pending"}]}}}
export function runTravelV2PendingConsequenceQueueSmokeChecks(){
  const s=session(); const queue=prepareTravelV2PendingConsequenceQueue(s);
  assertSmoke(queue.hasSession && queue.items.length===5,"queue gathers focus, support, hazard, ship scar, and final fallout candidates");
  assertSmoke(queue.pendingCount===5,"all gathered candidates begin pending");
  assertSmoke(queue.playerSafeItems.every((item)=>!JSON.stringify(item).includes("Review Strain pressure")),"player-safe items omit GM summaries");
  assertSmoke(queue.items.some((item)=>item.catalogSuggestions.length>0),"queue includes catalog suggestions");
  const updated=updateTravelV2PendingConsequenceQueueItem(s,"support-backlash:s1","deferred",{now:"2026-06-26T00:01:00.000Z",note:"Handle after next scene."});
  assertSmoke(updated.ok && updated.session!==s,"status update clones session");
  assertSmoke(updated.queue.deferredCount===1 && updated.queue.pendingCount===4,"defer lifecycle is reflected in queue counts");
  const applied=updateTravelV2PendingConsequenceQueueItem(updated.session,"support-backlash:s1","applied",{now:"2026-06-26T00:02:00.000Z"});
  assertSmoke(applied.ok && applied.queue.appliedCount===1,"apply lifecycle is session-local and reflected in queue counts");
  return {ok:true,checked:["gather","sanitize","catalog","defer","apply"]};
}
export default runTravelV2PendingConsequenceQueueSmokeChecks;
