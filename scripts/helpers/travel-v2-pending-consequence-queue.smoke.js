import { applyTravelV2SelectedConsequenceToSession, catalogSummariesForPendingConsequence, prepareTravelV2PendingConsequenceQueue, selectTravelV2PendingConsequenceCatalogCard, testTravelV2SelectedConsequencePressureApplySupport, updateTravelV2PendingConsequenceQueueItem } from "./travel-v2-pending-consequence-queue.js";
import { getTravelV2ConsequenceById, getTravelV2ConsequenceCatalog, getTravelV2ConsequencesBySource } from "../../data/travel-events/travel-v2-consequence-catalog.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "../apps/travel-event-runner-v2-preview-consumer.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
function assertSmoke(c,m){if(!c)throw new Error(`Travel v2 pending consequence queue smoke check failed: ${m}`)}
function session(){return {key:"queue",status:"completed",completed:true,completedAt:"2026-06-26T00:00:00.000Z",event:{rounds:[{roundNumber:1}],finalOutcomes:{failure:{losses:["The route leaves a hostile trace."]}}},travelV2EventCompletion:{completed:true},travelV2RoundResolutions:{records:[{roundIndex:0,roundNumber:1,effectiveOutcomeKey:"failure"}]},travelV2FocusBacklashRecords:{records:[{id:"f1",roundIndex:0,stationName:"Engineer",status:"pending",publicRiskText:"The arkengine shudders.",publicBacklashPreviewText:"Review Strain pressure."}]},travelV2SupportBacklashRecords:{records:[{id:"s1",roundIndex:0,supportingStationName:"Captain",status:"pending",severity:"minor",publicRiskText:"Crew hesitates."}]},hazards:{records:[{id:"h1",roundIndex:0,status:"active",name:"Void Shear",playerText:"The lane is still unstable."}]},shipScars:{pending:[{id:"scar1",roundIndex:0,name:"Scorched Conduits",status:"pending"}]}}}
export function runTravelV2PendingConsequenceQueueSmokeChecks(){
  const s={...session(),pressure:{morale:{value:1},strain:{value:0}}}; const queue=prepareTravelV2PendingConsequenceQueue(s);
  const newMinorConsequenceIds=["consequence-arkengine-whine","consequence-veil-draft","consequence-watch-fatigue","consequence-course-slip","consequence-stores-tangle","consequence-signal-echo"];
  const catalog=getTravelV2ConsequenceCatalog();
  assertSmoke(new Set(catalog.map((entry)=>entry.id)).size===catalog.length,"catalog ids remain unique");
  for (const id of newMinorConsequenceIds) {
    const entry=getTravelV2ConsequenceById(id);
    assertSmoke(entry?.id===id,`${id} resolves from the authored catalog`);
    assertSmoke(entry.severity==="minor",`${id} has minor severity`);
    assertSmoke(entry.explicitGmApplyEffect?.requiresGmApply===true,`${id} requires explicit GM Apply`);
    assertSmoke(entry.explicitGmApplyEffect?.mutation==="none",`${id} keeps explicit GM Apply mutation none`);
    assertSmoke(entry.sessionLocalEffect?.kind==="candidateOnly",`${id} keeps session-local effect candidate only`);
    assertSmoke(entry.sessionLocalEffect?.suggestedDelta===1,`${id} suggests delta 1`);
    assertSmoke(Boolean(entry.narration?.onConsequenceCreated)&&Boolean(entry.narration?.onFailure),`${id} has table narration hooks`);
    assertSmoke(testTravelV2SelectedConsequencePressureApplySupport(entry).supported===false,`${id} is not session-pressure Apply supported`);
  }
  assertSmoke(getTravelV2ConsequencesBySource("focus-backlash").some((entry)=>entry.id==="consequence-arkengine-whine"),"focus-backlash includes Arkengine Whine");
  const failedSupportIds=getTravelV2ConsequencesBySource("failed-support").map((entry)=>entry.id);
  assertSmoke(failedSupportIds.includes("consequence-watch-fatigue")&&failedSupportIds.includes("consequence-stores-tangle"),"failed-support includes Watch Fatigue and Stores Tangle");
  const unresolvedHazardIds=getTravelV2ConsequencesBySource("unresolved-hazard").map((entry)=>entry.id);
  assertSmoke(unresolvedHazardIds.includes("consequence-veil-draft")&&unresolvedHazardIds.includes("consequence-signal-echo"),"unresolved-hazard includes Veil Draft and Signal Echo");
  assertSmoke(getTravelV2ConsequencesBySource("final-bad-outcome").some((entry)=>entry.id==="consequence-course-slip"),"final-bad-outcome includes Course Slip");

  assertSmoke(queue.hasSession && queue.items.length===5,"queue gathers focus, support, hazard, ship scar, and final fallout candidates");
  assertSmoke(queue.pendingCount===5,"all gathered candidates begin pending");
  assertSmoke(queue.items.some((item)=>item.gmSummary==="Review Strain pressure." && item.sourceRecord?.id==="f1"),"GM queue contains full item summaries and source records");
  const playerSafeSnapshot=JSON.stringify(queue.playerSafeItems);
  assertSmoke(!playerSafeSnapshot.includes("Review Strain pressure")&&!playerSafeSnapshot.includes("sourceRecord")&&!playerSafeSnapshot.includes("applyEffectSummary")&&!playerSafeSnapshot.includes("catalogSuggestions"),"player-safe items omit GM summaries, source records, apply summaries, and catalog suggestions");
  assertSmoke(queue.applyStatusSummary && queue.applyStatusSummary.totalItems===queue.items.length,"queue exposes GM apply status summary with total item count");
  assertSmoke(!playerSafeSnapshot.includes("applyStatusSummary"),"player-safe items omit the GM apply status summary");
  const summarySession={...session(),travelV2PendingConsequenceQueue:{version:1,records:[
    {queueKey:"focus-backlash:f1",status:"pending",mutation:"none",selectedConsequence:{id:"consequence-hull-stress"}},
    {queueKey:"support-backlash:s1",status:"pending",mutation:"none",selectedConsequence:{id:"consequence-arkengine-surge"}},
    {queueKey:"ship-scar:scar1",status:"pending",mutation:"none",selectedConsequence:{id:"deleted-card",title:"Deleted Card"}},
    {queueKey:"final-outcome:failure:0",status:"pending",mutation:"none",selectedConsequence:{id:"consequence-course-slip"}}
  ]}};
  const statusSummaryQueue=prepareTravelV2PendingConsequenceQueue(summarySession);
  const applyStatusSummary=statusSummaryQueue.applyStatusSummary;
  assertSmoke(applyStatusSummary && Object.keys(applyStatusSummary).sort().join(",")===["alreadyAppliedCount","executableCount","missingCatalogCount","missingSelectionCount","selectedCount","sessionPressureOnlyCount","totalItems","unsupportedCount"].sort().join(","),"apply status summary contains exactly the required count fields");
  assertSmoke(applyStatusSummary.totalItems===statusSummaryQueue.items.length,"apply status summary totalItems equals ordered item count");
  assertSmoke(applyStatusSummary.selectedCount===4,"apply status summary counts selected consequence items");
  assertSmoke(applyStatusSummary.executableCount===2,"apply status summary counts canApplySelectedConsequence true items including Course Slip");
  assertSmoke(applyStatusSummary.alreadyAppliedCount===0,"apply status summary has no already applied item before Course Slip apply");
  assertSmoke(applyStatusSummary.unsupportedCount===1,"apply status summary counts selected unsupported preview-only items");
  assertSmoke(applyStatusSummary.missingSelectionCount===1,"apply status summary counts items without selected consequence ids");
  assertSmoke(applyStatusSummary.missingCatalogCount===1,"apply status summary counts selected missing catalog ids");
  assertSmoke(applyStatusSummary.sessionPressureOnlyCount===1,"apply status summary does not count Course Slip as session-pressure-only");
  assertSmoke(!JSON.stringify(statusSummaryQueue.playerSafeItems).includes("applyStatusSummary"),"player-safe items do not include applyStatusSummary");
  assertSmoke(queue.items.some((item)=>item.catalogSuggestions.length>0),"queue includes catalog suggestions");
  assertSmoke(queue.items.find((item)=>item.queueKey==="focus-backlash:f1")?.catalogSuggestions.some((suggestion)=>suggestion.id==="consequence-arkengine-surge"),"focus backlash still suggests focus-backlash catalog cards");
  assertSmoke(queue.items.find((item)=>item.queueKey==="focus-backlash:f1")?.catalogSuggestions.some((suggestion)=>suggestion.id==="consequence-arkengine-whine"),"focus backlash suggests Arkengine Whine through existing source categories");
  assertSmoke(queue.items.find((item)=>item.queueKey==="support-backlash:s1")?.catalogSuggestions.some((suggestion)=>suggestion.id==="consequence-crew-panic"),"failed support still suggests Crew Panic");
  assertSmoke(["consequence-watch-fatigue","consequence-stores-tangle"].every((id)=>queue.items.find((item)=>item.queueKey==="support-backlash:s1")?.catalogSuggestions.some((suggestion)=>suggestion.id===id)),"failed support suggests new minor support cards through existing source categories");
  assertSmoke(queue.items.find((item)=>item.queueKey==="hazard:h1")?.catalogSuggestions.some((suggestion)=>suggestion.id==="consequence-hazard-escalation"),"unresolved hazards still suggest unresolved-hazard catalog cards");
  assertSmoke(["consequence-veil-draft","consequence-signal-echo"].every((id)=>queue.items.find((item)=>item.queueKey==="hazard:h1")?.catalogSuggestions.some((suggestion)=>suggestion.id===id)),"unresolved hazards suggest new minor hazard cards through existing source categories");
  assertSmoke(queue.items.find((item)=>item.queueKey==="ship-scar:scar1")?.catalogSuggestions.some((suggestion)=>suggestion.id==="consequence-ship-scar-candidate"),"ship scar candidates still suggest ship scar candidate cards");
  assertSmoke(queue.items.find((item)=>item.sourceType==="finalOutcomeFallout")?.catalogSuggestions.some((suggestion)=>suggestion.id==="consequence-ship-scar-candidate"),"final fallout still suggests final bad outcome cards");
  assertSmoke(queue.items.find((item)=>item.sourceType==="finalOutcomeFallout")?.catalogSuggestions.some((suggestion)=>suggestion.id==="consequence-course-slip"),"final fallout suggests Course Slip through existing source categories");
  const hullQueue=prepareTravelV2PendingConsequenceQueue({...session(),hazards:{records:[{id:"hull1",roundIndex:0,status:"active",name:"Rib Collision",category:"physical",tags:["impact","bulkhead"],playerText:"The hull plates take damage."}]}});
  assertSmoke(hullQueue.items.find((item)=>item.queueKey==="hazard:hull1")?.catalogSuggestions.some((suggestion)=>suggestion.id==="consequence-hull-stress"),"hull or physical unresolved hazards suggest Hull Stress");
  const suppliesSuggestions=catalogSummariesForPendingConsequence({sourceType:"unresolvedHazard",sourceStatus:"active",severity:"minor",publicSummary:"Blocked access to low stores delays water rations.",gmSummary:"Logistics trouble.",sourceRecord:{id:"sup1",category:"supplies",tags:["delay","stores"]},catalogSuggestions:[{id:"consequence-supplies-delay",title:"Duplicate Supplies Delay"}]});
  assertSmoke(suppliesSuggestions.some((suggestion)=>suggestion.id==="consequence-supplies-delay"),"supplies, delay, or low-stores source records suggest Supplies Delay");
  assertSmoke(suppliesSuggestions.filter((suggestion)=>suggestion.id==="consequence-supplies-delay").length===1,"catalog suggestions are de-duplicated by id");
  const moraleSuggestions=catalogSummariesForPendingConsequence({sourceType:"failedSupport",sourceStatus:"pending",severity:"minor",publicSummary:"Morale falters as crew hesitation spreads fear.",sourceRecord:{category:"captain"}});
  assertSmoke(moraleSuggestions.some((suggestion)=>suggestion.id==="consequence-crew-panic"),"failed support, morale, or crew hesitation suggests Crew Panic");
  const runnerState=prepareTravelEventRunnerAppStateWithTravelV2Preview({session:s});
  assertSmoke(runnerState.pendingConsequenceQueue.items.length===5 && runnerState.pendingConsequenceQueue.items[0].requiresGmApply===true,"runner state prepares a GM pending consequence queue from sample session records");
  const selected=selectTravelV2PendingConsequenceCatalogCard(s,"focus-backlash:f1","consequence-arkengine-surge");
  assertSmoke(selected.ok && selected.session!==s,"selecting a valid suggested catalog card clones the session");
  const selectedItem=selected.queue.items.find((item)=>item.queueKey==="focus-backlash:f1");
  assertSmoke(selectedItem?.selectedConsequence?.id==="consequence-arkengine-surge" && selectedItem.selectedConsequence.title==="Arkengine Surge","selected consequence appears on GM queue item");
  const preview=selectedItem?.selectedConsequenceApplyPreview;
  assertSmoke(preview?.hasPreview===true && preview.consequenceId==="consequence-arkengine-surge" && preview.title==="Arkengine Surge" && preview.affectedTrack==="Strain" && preview.source==="pressureCandidate","selected consequence preview appears and uses catalog-resolved data");
  assertSmoke(preview.mutation==="none" && preview.executable===false && preview.previewOnly===true,"unsupported selected consequence preview is non-executable and keeps mutation none");
  assertSmoke(["pressure","ship scars","actor/item changes","chat","journals","combat","scenes","tokens","sockets","compendia","world data"].every((term)=>preview.warningText.includes(term)),"selected consequence preview warning lists forbidden mutation categories");
  assertSmoke(selected.record.mutation==="none" && selectedItem.mutation==="none","selection keeps mutation none");
  assertSmoke(!JSON.stringify(selected.queue.playerSafeItems).includes("selectedConsequence")&&!JSON.stringify(selected.queue.playerSafeItems).includes("selectedConsequenceApplyPreview")&&!JSON.stringify(selected.queue.playerSafeItems).includes("applyEffectSummary")&&!JSON.stringify(selected.queue.playerSafeItems).includes("Arkengine Surge"),"selected consequence and GM apply preview are not exposed through player-safe items");
  const selectedNew=selectTravelV2PendingConsequenceCatalogCard(s,"focus-backlash:f1","consequence-arkengine-whine");
  const selectedNewItem=selectedNew.queue.items.find((item)=>item.queueKey==="focus-backlash:f1");
  const selectedNewPreview=selectedNewItem?.selectedConsequenceApplyPreview;
  assertSmoke(selectedNew.ok && selectedNewPreview?.executable===false && selectedNewPreview.previewOnly===true && selectedNewPreview.mutation==="none","selecting a new minor consequence produces a preview-only non-executable preview");
  const selectedNewPlayerSafe=JSON.stringify(selectedNew.queue.playerSafeItems);
  assertSmoke(!selectedNewPlayerSafe.includes("gmText")&&!selectedNewPlayerSafe.includes("applyEffectSummary")&&!selectedNewPlayerSafe.includes("sourceRecord")&&!selectedNewPlayerSafe.includes("selectedConsequenceApplyPreview")&&!selectedNewPlayerSafe.includes("selectedConsequence")&&!selectedNewPlayerSafe.includes("catalogSuggestions")&&!selectedNewPlayerSafe.includes("Arkengine Whine"),"playerSafeItems do not expose GM text, apply summaries, source records, selected previews, or raw catalog internals for new cards");
  const unknownCard=selectTravelV2PendingConsequenceCatalogCard(s,"focus-backlash:f1","missing-card");
  assertSmoke(!unknownCard.ok,"selecting an unknown consequence id fails safely");
  const unknownQueue=selectTravelV2PendingConsequenceCatalogCard(s,"missing:key","consequence-arkengine-surge");
  assertSmoke(!unknownQueue.ok,"selecting for an unknown queue key fails safely");
  const predeferred=updateTravelV2PendingConsequenceQueueItem(s,"support-backlash:s1","deferred",{now:"2026-06-26T00:00:30.000Z",note:"Handle after next scene."});
  const selectedDeferred=selectTravelV2PendingConsequenceCatalogCard(predeferred.session,"support-backlash:s1","consequence-crew-panic");
  assertSmoke(selectedDeferred.ok && selectedDeferred.record.status==="deferred" && selectedDeferred.record.decisionNote==="Handle after next scene.","selection preserves existing status override and note");
  const updated=updateTravelV2PendingConsequenceQueueItem(selectedDeferred.session,"support-backlash:s1","deferred",{now:"2026-06-26T00:01:00.000Z",note:"Handle after next scene."});
  assertSmoke(updated.ok && updated.session!==selectedDeferred.session,"status update clones session");
  assertSmoke(updated.record.selectedConsequence?.id==="consequence-crew-panic" && updated.queue.items.find((item)=>item.queueKey==="support-backlash:s1")?.selectedConsequence?.id==="consequence-crew-panic","status update preserves selected consequence");
  assertSmoke(updated.queue.deferredCount===1 && updated.queue.pendingCount===4,"defer lifecycle is reflected in queue counts");
  const applied=updateTravelV2PendingConsequenceQueueItem(updated.session,"support-backlash:s1","applied",{now:"2026-06-26T00:02:00.000Z"});
  assertSmoke(applied.ok && applied.queue.appliedCount===1,"apply lifecycle is session-local and reflected in queue counts");
  const appliedItem=applied.queue.items.find((item)=>item.queueKey==="support-backlash:s1");
  assertSmoke(applied.record.mutation==="none" && appliedItem?.mutation==="none" && appliedItem?.selectedConsequence?.id==="consequence-crew-panic" && appliedItem?.selectedConsequenceApplyPreview?.executable===true && appliedItem?.canApplySelectedConsequence===false,"Mark Applied lifecycle keeps mutation none, preserves selection/preview, does not execute selected consequence, and keeps manual Apply unavailable while status-applied");
  const executablePreview=updated.queue.items.find((item)=>item.queueKey==="support-backlash:s1")?.selectedConsequenceApplyPreview;
  assertSmoke(executablePreview?.executable===true && executablePreview.previewOnly===false && executablePreview.mutation==="session-pressure-only" && executablePreview.pressureDelta===1,"supported selected consequence has executable session-pressure-only preview");

  const selectedCourseSlip=selectTravelV2PendingConsequenceCatalogCard(s,"final-outcome:failure:0","consequence-course-slip");
  assertSmoke(selectedCourseSlip.ok && selectedCourseSlip.session!==s,"selecting Course Slip succeeds and clones the session");
  const selectedCourseSlipPreview=selectedCourseSlip.queue.items.find((item)=>item.queueKey==="final-outcome:failure:0")?.selectedConsequenceApplyPreview;
  assertSmoke(selectedCourseSlipPreview?.executable===true && selectedCourseSlipPreview.previewOnly===false && selectedCourseSlipPreview.mutation==="session-followup-note-only" && selectedCourseSlipPreview.affectedTrack==="Route","selected Course Slip preview is executable follow-up-note only for Route");
  const courseSlipBase={...session(),pressure:{hull:{value:1},strain:{value:2},lifeveil:{value:3},morale:{value:4},supplies:{value:5}},travelV2PendingConsequenceQueue:{version:1,records:[{queueKey:"final-outcome:failure:0",status:"pending",mutation:"none",selectedConsequence:{id:"consequence-course-slip"}}]}};
  const courseSlipQueue=prepareTravelV2PendingConsequenceQueue(courseSlipBase);
  const courseSlipItem=courseSlipQueue.items.find((item)=>item.queueKey==="final-outcome:failure:0");
  const courseSlipPreview=courseSlipItem?.selectedConsequenceApplyPreview;
  assertSmoke(courseSlipPreview?.executable===true && courseSlipPreview.previewOnly===false && courseSlipPreview.mutation==="session-followup-note-only" && courseSlipPreview.affectedTrack==="Route","Course Slip preview is executable session-followup-note-only for Route");
  assertSmoke(courseSlipQueue.applyStatusSummary.executableCount===1 && courseSlipQueue.applyStatusSummary.sessionPressureOnlyCount===0,"Course Slip counts as executable without increasing sessionPressureOnlyCount");
  const courseSlipApplied=applyTravelV2SelectedConsequenceToSession(courseSlipBase,"final-outcome:failure:0",{now:"2026-06-26T00:06:00.000Z"});
  assertSmoke(courseSlipApplied.ok && courseSlipApplied.session!==courseSlipBase,"Course Slip apply succeeds and clones the session");
  assertSmoke(courseSlipApplied.session.travelV2ConsequenceFollowups?.version===1 && courseSlipApplied.session.travelV2ConsequenceFollowups.records.length===1,"Course Slip creates exactly one follow-up container record");
  const courseSlipRecord=courseSlipApplied.session.travelV2ConsequenceFollowups.records[0];
  assertSmoke(courseSlipRecord.mutation==="session-followup-note-only" && courseSlipRecord.consequenceId==="consequence-course-slip" && courseSlipRecord.kind==="finalOutcomeCandidate" && courseSlipRecord.affectedTrack==="Route","Course Slip follow-up record has the required mutation, id, kind, and affected track");
  const courseSlipAppliedItem=courseSlipApplied.queue.items.find((item)=>item.queueKey==="final-outcome:failure:0");
  assertSmoke(courseSlipAppliedItem?.status==="applied" && courseSlipAppliedItem.selectedConsequence?.id==="consequence-course-slip","Course Slip apply marks queue item applied and preserves selected consequence");
  assertSmoke(courseSlipApplied.record.appliedEffect?.mutation==="session-followup-note-only" && courseSlipApplied.record.appliedEffect.kind==="finalOutcomeCandidate" && courseSlipApplied.record.appliedEffect.affectedTrack==="Route" && courseSlipApplied.record.appliedEffect.consequenceId==="consequence-course-slip","Course Slip appliedEffect stores follow-up apply details");
  assertSmoke(courseSlipApplied.record.appliedEffect.followupRecord!==courseSlipRecord && JSON.stringify(courseSlipApplied.record.appliedEffect.followupRecord)===JSON.stringify(courseSlipRecord),"Course Slip appliedEffect followupRecord is a cloned copy of the appended record");
  assertSmoke(JSON.stringify(courseSlipApplied.session.pressure)===JSON.stringify(courseSlipBase.pressure),"Course Slip apply leaves all pressure values unchanged");
  assertSmoke(JSON.stringify(courseSlipApplied.session.hazards??null)===JSON.stringify(courseSlipBase.hazards??null) && JSON.stringify(courseSlipApplied.session.shipScars??null)===JSON.stringify(courseSlipBase.shipScars??null),"Course Slip apply leaves hazards and ship scars unchanged");
  assertSmoke(!("actors" in courseSlipApplied.session)&&!("items" in courseSlipApplied.session)&&!("world" in courseSlipApplied.session),"Course Slip apply adds no actor, item, or world data containers");
  const courseSlipAfterSummary=prepareTravelV2PendingConsequenceQueue(courseSlipApplied.session).applyStatusSummary;
  assertSmoke(courseSlipAfterSummary.alreadyAppliedCount===1,"Course Slip increases alreadyAppliedCount after apply");
  courseSlipApplied.record.appliedEffect.followupRecord.title="Mutated clone";
  assertSmoke(courseSlipApplied.session.travelV2ConsequenceFollowups.records[0].title==="Course Slip","mutating appliedEffect followupRecord does not mutate the appended follow-up record");
  const duplicateCourseSlip=applyTravelV2SelectedConsequenceToSession(courseSlipApplied.session,"final-outcome:failure:0",{now:"2026-06-26T00:07:00.000Z"});
  assertSmoke(!duplicateCourseSlip.ok && duplicateCourseSlip.alreadyApplied===true && duplicateCourseSlip.session===courseSlipApplied.session && duplicateCourseSlip.session.travelV2ConsequenceFollowups.records.length===1,"Course Slip second apply fails closed without appending a duplicate follow-up");
  const courseSlipPlayerSafe=JSON.stringify(prepareTravelV2PendingConsequenceQueue(courseSlipApplied.session).playerSafeItems);
  assertSmoke(!courseSlipPlayerSafe.includes("travelV2ConsequenceFollowups")&&!courseSlipPlayerSafe.includes("followupRecord")&&!courseSlipPlayerSafe.includes("appliedEffect")&&!courseSlipPlayerSafe.includes("selectedConsequenceApplyPreview")&&!courseSlipPlayerSafe.includes("applyEffectSummary")&&!courseSlipPlayerSafe.includes("sourceRecord")&&!courseSlipPlayerSafe.includes("Course Slip"),"playerSafeItems omit Course Slip follow-ups and GM-only apply details");

  for (const supported of [
    {id:"consequence-hull-stress",affectedTrack:"Hull",track:"hull"},
    {id:"consequence-crew-panic",affectedTrack:"Morale",track:"morale"},
    {id:"consequence-supplies-delay",affectedTrack:"Supplies",track:"supplies"}
  ]) {
    const base={...session(),pressure:{hull:{value:10},strain:{value:20},lifeveil:{value:30},morale:{value:40},supplies:{value:50}},travelV2PendingConsequenceQueue:{version:1,records:[{queueKey:"focus-backlash:f1",status:"pending",mutation:"none",selectedConsequence:{id:supported.id}}]}};
    const previewItem=prepareTravelV2PendingConsequenceQueue(base).items.find((item)=>item.queueKey==="focus-backlash:f1");
    const supportedPreview=previewItem?.selectedConsequenceApplyPreview;
    assertSmoke(supportedPreview?.executable===true && supportedPreview.previewOnly===false && supportedPreview.mutation==="session-pressure-only" && supportedPreview.pressureDelta===1,`${supported.id} selected consequence has executable session-pressure-only preview`);
    const appliedSupported=applyTravelV2SelectedConsequenceToSession(base,"focus-backlash:f1",{now:"2026-06-26T00:04:30.000Z"});
    assertSmoke(appliedSupported.ok && appliedSupported.session.pressure[supported.track].value===base.pressure[supported.track].value+1,`${supported.id} apply increments only ${supported.track} pressure`);
    for (const track of ["hull","strain","lifeveil","morale","supplies"].filter((track)=>track!==supported.track)) assertSmoke(appliedSupported.session.pressure[track].value===base.pressure[track].value,`${supported.id} apply leaves ${track} pressure unchanged`);
    const effect=appliedSupported.record.appliedEffect;
    assertSmoke(effect?.mutation==="session-pressure-only" && effect.affectedTrack===supported.affectedTrack && effect.pressureTrack===supported.track && effect.pressureDelta===1 && effect.beforeValue===base.pressure[supported.track].value && effect.afterValue===base.pressure[supported.track].value+1,`${supported.id} records session pressure apply details`);
    assertSmoke(appliedSupported.queue.items.find((item)=>item.queueKey==="focus-backlash:f1")?.status==="applied",`${supported.id} apply marks status applied`);
    const duplicate=applyTravelV2SelectedConsequenceToSession(appliedSupported.session,"focus-backlash:f1");
    assertSmoke(!duplicate.ok && duplicate.alreadyApplied===true && duplicate.session===appliedSupported.session,`${supported.id} prevents re-apply`);
  }
  for (const unsupportedId of ["consequence-arkengine-surge","consequence-lifeveil-flicker","consequence-route-drift","consequence-cargo-shift","consequence-threat-attracted","consequence-hazard-escalation","consequence-ship-scar-candidate","consequence-signal-echo","consequence-stores-tangle",...newMinorConsequenceIds.filter((id)=>id!=="consequence-course-slip"&&id!=="consequence-signal-echo"&&id!=="consequence-stores-tangle")]) {
    const unsupportedSession={...session(),pressure:{hull:{value:1},strain:{value:2},lifeveil:{value:3},morale:{value:4},supplies:{value:5}},travelV2PendingConsequenceQueue:{version:1,records:[{queueKey:"focus-backlash:f1",status:"pending",mutation:"none",selectedConsequence:{id:unsupportedId}}]}};
    const unsupportedPreview=prepareTravelV2PendingConsequenceQueue(unsupportedSession).items.find((item)=>item.queueKey==="focus-backlash:f1")?.selectedConsequenceApplyPreview;
    assertSmoke(unsupportedPreview?.executable===false && unsupportedPreview.previewOnly===true && unsupportedPreview.mutation==="none" && unsupportedPreview.warningText.includes("Manual Apply is not implemented for this consequence type yet"),`${unsupportedId} preview remains non-executable`);
    const failedUnsupported=applyTravelV2SelectedConsequenceToSession(unsupportedSession,"focus-backlash:f1");
    assertSmoke(!failedUnsupported.ok && JSON.stringify(failedUnsupported.session.pressure)===JSON.stringify(unsupportedSession.pressure) && !JSON.stringify(failedUnsupported.session).includes("appliedEffect"),`${unsupportedId} apply fails closed without pressure or appliedEffect mutation`);
  }
  const validCatalog={id:"consequence-hull-stress",severity:"minor",affectedTrack:"Hull",sessionLocalEffect:{kind:"candidateOnly",suggestedTrack:"Hull",suggestedDelta:1},explicitGmApplyEffect:{kind:"pressureCandidate",mutation:"none"}};
  for (const malformed of [
    {...validCatalog,severity:"major"},
    {...validCatalog,explicitGmApplyEffect:{kind:"finalOutcomeCandidate",mutation:"none"}},
    {...validCatalog,explicitGmApplyEffect:{kind:"pressureCandidate",mutation:"session-pressure-only"}},
    {...validCatalog,affectedTrack:"Strain"},
    {...validCatalog,sessionLocalEffect:{kind:"candidateOnly",suggestedTrack:"Strain",suggestedDelta:1}},
    {...validCatalog,sessionLocalEffect:{kind:"candidateOnly",suggestedTrack:"Hull",suggestedDelta:2}},
    {...validCatalog,sessionLocalEffect:{kind:"pressureNow",suggestedTrack:"Hull",suggestedDelta:1}}
  ]) assertSmoke(testTravelV2SelectedConsequencePressureApplySupport(malformed).supported===false,"whitelisted catalog card with mismatched apply shape fails closed");
  const beforeApplySession=updated.session;
  const manualApplied=applyTravelV2SelectedConsequenceToSession(beforeApplySession,"support-backlash:s1",{now:"2026-06-26T00:04:00.000Z"});
  assertSmoke(manualApplied.ok && manualApplied.session!==beforeApplySession,"applying supported selected consequence clones the session");
  assertSmoke(beforeApplySession.pressure.morale.value===1 && manualApplied.session.pressure.morale.value===2 && manualApplied.session.pressure.strain.value===0,"applying supported selected consequence changes only session-local pressure values expected by this smoke");
  const manualAppliedItem=manualApplied.queue.items.find((item)=>item.queueKey==="support-backlash:s1");
  assertSmoke(manualAppliedItem?.status==="applied" && manualAppliedItem.selectedConsequence?.id==="consequence-crew-panic","manual apply marks queue item applied and preserves selected consequence");
  assertSmoke(manualApplied.record.appliedEffect?.mutation==="session-pressure-only" && manualApplied.record.appliedEffect.beforeValue===1 && manualApplied.record.appliedEffect.afterValue===2,"manual apply record includes session-pressure-only mutation and correct before/after values");
  assertSmoke(manualAppliedItem?.appliedEffect?.mutation==="session-pressure-only" && manualAppliedItem.appliedEffect.beforeValue===1 && manualAppliedItem.appliedEffect.afterValue===2,"GM queue item exposes the cloned session-pressure-only applied effect after manual apply");
  assertSmoke(manualAppliedItem?.hasAppliedEffect===true && manualAppliedItem?.canApplySelectedConsequence===false,"GM queue item marks applied-result state and prevents executable manual Apply after appliedEffect exists");
  manualAppliedItem.appliedEffect.afterValue=999;
  assertSmoke(manualApplied.record.appliedEffect.afterValue===2,"GM queue item appliedEffect is safely cloned from the queue override");
  const playerSafeAfterApply=JSON.stringify(prepareTravelV2PendingConsequenceQueue(manualApplied.session).playerSafeItems);
  assertSmoke(!playerSafeAfterApply.includes("appliedEffect")&&!playerSafeAfterApply.includes("hasAppliedEffect")&&!playerSafeAfterApply.includes("selectedConsequenceApplyPreview")&&!playerSafeAfterApply.includes("applyEffectSummary")&&!playerSafeAfterApply.includes("sourceRecord")&&!playerSafeAfterApply.includes("Crew Panic"),"player-safe items omit GM manual apply records, state flags, previews, summaries, notes, source records, and raw catalog fields after apply");
  const reapplied=applyTravelV2SelectedConsequenceToSession(manualApplied.session,"support-backlash:s1",{now:"2026-06-26T00:05:00.000Z"});
  assertSmoke(!reapplied.ok && reapplied.alreadyApplied===true && reapplied.session===manualApplied.session && manualApplied.session.pressure.morale.value===2,"applying again fails closed and does not double-apply pressure");
  const missingSelection=applyTravelV2SelectedConsequenceToSession(s,"focus-backlash:f1");
  assertSmoke(!missingSelection.ok && missingSelection.session===s,"manual apply without a selected consequence fails closed");
  const unsupportedApply=applyTravelV2SelectedConsequenceToSession(selected.session,"focus-backlash:f1");
  assertSmoke(!unsupportedApply.ok && unsupportedApply.session===selected.session,"manual apply for unsupported selected consequence fails closed");
  const missingCatalogApply=applyTravelV2SelectedConsequenceToSession({ ...selected.session, travelV2PendingConsequenceQueue:{version:1,records:[{queueKey:"focus-backlash:f1",status:"pending",selectedConsequence:{id:"deleted-card"}}]} },"focus-backlash:f1");
  assertSmoke(!missingCatalogApply.ok,"manual apply for missing catalog id fails closed");
  const missingCatalogSession={...selected.session,travelV2PendingConsequenceQueue:{version:1,records:[{queueKey:"focus-backlash:f1",status:"pending",mutation:"none",selectedConsequence:{id:"deleted-card",title:"Deleted Card",severity:"major",playerSafeSummary:"Stored display survives."}}]}};
  const missingPreview=prepareTravelV2PendingConsequenceQueue(missingCatalogSession).items.find((item)=>item.queueKey==="focus-backlash:f1")?.selectedConsequenceApplyPreview;
  assertSmoke(missingPreview?.hasPreview===true && missingPreview.executable===false && missingPreview.warningText.includes("Catalog card could not be resolved"),"missing selected catalog id fails safely with non-executable warning");
  const dismissed=updateTravelV2PendingConsequenceQueueItem(applied.session,"focus-backlash:f1","dismissed",{now:"2026-06-26T00:03:00.000Z"});
  assertSmoke(dismissed.ok && dismissed.queue.dismissedCount===1,"dismiss lifecycle is reflected in queue counts");
  const helperSource=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),"travel-v2-pending-consequence-queue.js"),"utf8");
  assertSmoke(!/(\bgame|Actor|ChatMessage|JournalEntry|Combat|Scene|Token|socket|compendium|updateEmbeddedDocuments|createEmbeddedDocuments|deleteEmbeddedDocuments)\s*[.([]/.test(helperSource),"pending consequence queue helper does not call Foundry mutation APIs");
  return {ok:true,checked:["course-slip-followup","gather","gm-full-items","sanitize","catalog","select","select-preserves-status","selected-preview","preview-warning","status-preserves-select","unknown-select-failures","defer","mark-applied","dismiss","mutation-none","manual-apply","idempotency","fail-closed","suggestion-categories","minor-pressure-suggestions","dedupe","no-foundry-mutation-api"]};
}
export default runTravelV2PendingConsequenceQueueSmokeChecks;
