import { prepareTravelV2PendingConsequenceQueue, updateTravelV2PendingConsequenceQueueItem } from "./travel-v2-pending-consequence-queue.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "../apps/travel-event-runner-v2-preview-consumer.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
function assertSmoke(c,m){if(!c)throw new Error(`Travel v2 pending consequence queue smoke check failed: ${m}`)}
function session(){return {key:"queue",status:"completed",completed:true,completedAt:"2026-06-26T00:00:00.000Z",event:{rounds:[{roundNumber:1}],finalOutcomes:{failure:{losses:["The route leaves a hostile trace."]}}},travelV2EventCompletion:{completed:true},travelV2RoundResolutions:{records:[{roundIndex:0,roundNumber:1,effectiveOutcomeKey:"failure"}]},travelV2FocusBacklashRecords:{records:[{id:"f1",roundIndex:0,stationName:"Engineer",status:"pending",publicRiskText:"The arkengine shudders.",publicBacklashPreviewText:"Review Strain pressure."}]},travelV2SupportBacklashRecords:{records:[{id:"s1",roundIndex:0,supportingStationName:"Captain",status:"pending",severity:"minor",publicRiskText:"Crew hesitates."}]},hazards:{records:[{id:"h1",roundIndex:0,status:"active",name:"Void Shear",playerText:"The lane is still unstable."}]},shipScars:{pending:[{id:"scar1",roundIndex:0,name:"Scorched Conduits",status:"pending"}]}}}
export function runTravelV2PendingConsequenceQueueSmokeChecks(){
  const s=session(); const queue=prepareTravelV2PendingConsequenceQueue(s);
  assertSmoke(queue.hasSession && queue.items.length===5,"queue gathers focus, support, hazard, ship scar, and final fallout candidates");
  assertSmoke(queue.pendingCount===5,"all gathered candidates begin pending");
  assertSmoke(queue.items.some((item)=>item.gmSummary==="Review Strain pressure." && item.sourceRecord?.id==="f1"),"GM queue contains full item summaries and source records");
  const playerSafeSnapshot=JSON.stringify(queue.playerSafeItems);
  assertSmoke(!playerSafeSnapshot.includes("Review Strain pressure")&&!playerSafeSnapshot.includes("sourceRecord")&&!playerSafeSnapshot.includes("applyEffectSummary")&&!playerSafeSnapshot.includes("catalogSuggestions"),"player-safe items omit GM summaries, source records, apply summaries, and catalog suggestions");
  assertSmoke(queue.items.some((item)=>item.catalogSuggestions.length>0),"queue includes catalog suggestions");
  const runnerState=prepareTravelEventRunnerAppStateWithTravelV2Preview({session:s});
  assertSmoke(runnerState.pendingConsequenceQueue.items.length===5 && runnerState.pendingConsequenceQueue.items[0].requiresGmApply===true,"runner state prepares a GM pending consequence queue from sample session records");
  const updated=updateTravelV2PendingConsequenceQueueItem(s,"support-backlash:s1","deferred",{now:"2026-06-26T00:01:00.000Z",note:"Handle after next scene."});
  assertSmoke(updated.ok && updated.session!==s,"status update clones session");
  assertSmoke(updated.queue.deferredCount===1 && updated.queue.pendingCount===4,"defer lifecycle is reflected in queue counts");
  const applied=updateTravelV2PendingConsequenceQueueItem(updated.session,"support-backlash:s1","applied",{now:"2026-06-26T00:02:00.000Z"});
  assertSmoke(applied.ok && applied.queue.appliedCount===1,"apply lifecycle is session-local and reflected in queue counts");
  assertSmoke(applied.record.mutation==="none" && applied.queue.items.find((item)=>item.queueKey==="support-backlash:s1")?.mutation==="none","apply lifecycle keeps mutation none");
  const dismissed=updateTravelV2PendingConsequenceQueueItem(applied.session,"focus-backlash:f1","dismissed",{now:"2026-06-26T00:03:00.000Z"});
  assertSmoke(dismissed.ok && dismissed.queue.dismissedCount===1,"dismiss lifecycle is reflected in queue counts");
  const helperSource=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),"travel-v2-pending-consequence-queue.js"),"utf8");
  assertSmoke(!/(\bgame|Actor|ChatMessage|JournalEntry|Combat|Scene|Token|socket|compendium|updateEmbeddedDocuments|createEmbeddedDocuments|deleteEmbeddedDocuments)\s*[.([]/.test(helperSource),"pending consequence queue helper does not call Foundry mutation APIs");
  return {ok:true,checked:["gather","gm-full-items","sanitize","catalog","defer","apply","dismiss","mutation-none","no-foundry-mutation-api"]};
}
export default runTravelV2PendingConsequenceQueueSmokeChecks;
