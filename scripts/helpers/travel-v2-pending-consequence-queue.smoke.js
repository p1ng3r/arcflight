import { applyAllExecutableTravelV2SelectedConsequencesToSession, applyTravelV2SelectedConsequenceToSession, catalogSummariesForPendingConsequence, prepareTravelV2ConsequenceFollowupReview, prepareTravelV2PendingConsequenceQueue, selectTravelV2PendingConsequenceCatalogCard, testTravelV2SelectedConsequencePressureApplySupport, updateTravelV2ConsequenceFollowupStatus, updateTravelV2PendingConsequenceQueueItem } from "./travel-v2-pending-consequence-queue.js";
import { getTravelV2ConsequenceById, getTravelV2ConsequenceCatalog, getTravelV2ConsequencesBySource } from "../../data/travel-events/travel-v2-consequence-catalog.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "../apps/travel-event-runner-v2-preview-consumer.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
function assertSmoke(c,m){if(!c)throw new Error(`Travel v2 pending consequence queue smoke check failed: ${m}`)}
function session(){return {key:"queue",status:"completed",completed:true,completedAt:"2026-06-26T00:00:00.000Z",event:{rounds:[{roundNumber:1}],finalOutcomes:{failure:{losses:["The route leaves a hostile trace."]}}},travelV2EventCompletion:{completed:true},travelV2RoundResolutions:{records:[{roundIndex:0,roundNumber:1,effectiveOutcomeKey:"failure"}]},travelV2FocusBacklashRecords:{records:[{id:"f1",roundIndex:0,stationName:"Engineer",status:"pending",publicRiskText:"The arkengine shudders.",publicBacklashPreviewText:"Review Strain pressure."}]},travelV2SupportBacklashRecords:{records:[{id:"s1",roundIndex:0,supportingStationName:"Captain",status:"pending",severity:"minor",publicRiskText:"Crew hesitates."}]},hazards:{records:[{id:"h1",roundIndex:0,status:"active",name:"Void Shear",playerText:"The lane is still unstable."}]},shipScars:{pending:[{id:"scar1",roundIndex:0,name:"Scorched Conduits",status:"pending"}]}}}
export function runTravelV2PendingConsequenceQueueSmokeChecks(){
  const s={...session(),pressure:{morale:{value:1},strain:{value:0}}}; const queue=prepareTravelV2PendingConsequenceQueue(s);
  const newPressureConsequenceApplies=[
    {id:"consequence-arkengine-surge",queueKey:"focus-backlash:f1",affectedTrack:"Strain",track:"strain",title:"Arkengine Surge",severity:"major"},
    {id:"consequence-lifeveil-flicker",queueKey:"hazard:h1",affectedTrack:"Lifeveil",track:"lifeveil",title:"Lifeveil Flicker",severity:"major"}
  ];
  const existingPressureConsequenceApplies=[
    {id:"consequence-hull-stress",queueKey:"hazard:h1",affectedTrack:"Hull",track:"hull",title:"Hull Stress",severity:"minor"},
    {id:"consequence-crew-panic",queueKey:"support-backlash:s1",affectedTrack:"Morale",track:"morale",title:"Crew Panic",severity:"minor"},
    {id:"consequence-supplies-delay",queueKey:"support-backlash:s1",affectedTrack:"Supplies",track:"supplies",title:"Supplies Delay",severity:"minor"},
    {id:"consequence-arkengine-whine",queueKey:"focus-backlash:f1",affectedTrack:"Strain",track:"strain",title:"Arkengine Whine",severity:"minor"},
    {id:"consequence-veil-draft",queueKey:"hazard:h1",affectedTrack:"Lifeveil",track:"lifeveil",title:"Veil Draft",severity:"minor"},
    {id:"consequence-watch-fatigue",queueKey:"support-backlash:s1",affectedTrack:"Morale",track:"morale",title:"Watch Fatigue",severity:"minor"}
  ];
  const newFollowupConsequenceApplies=[
    {id:"consequence-route-drift",queueKey:"final-outcome:failure:0",affectedTrack:"Route",kind:"finalOutcomeCandidate",title:"Route Drift",severity:"major"},
    {id:"consequence-cargo-shift",queueKey:"support-backlash:s1",affectedTrack:"Cargo",kind:"complicationCandidate",title:"Cargo Shift",severity:"minor"},
    {id:"consequence-threat-attracted",queueKey:"hazard:h1",affectedTrack:"Threat",kind:"encounterSeedCandidate",title:"Threat Attracted",severity:"major"},
    {id:"consequence-hazard-escalation",queueKey:"hazard:h2",affectedTrack:"Hazard",kind:"hazardEscalationCandidate",title:"Hazard Escalation",severity:"major"},
    {id:"consequence-ship-scar-candidate",queueKey:"ship-scar:scar1",affectedTrack:"Ship Scar",kind:"shipScarHandoffCandidate",title:"Ship Scar Candidate",severity:"severe"}
  ];
  const newMinorConsequenceIds=[...existingPressureConsequenceApplies.map((entry)=>entry.id),"consequence-course-slip","consequence-stores-tangle","consequence-signal-echo"];
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
    const pressureMapping=existingPressureConsequenceApplies.find((mapping)=>mapping.id===id);
    const pressureSupport=testTravelV2SelectedConsequencePressureApplySupport(entry);
    if (pressureMapping) assertSmoke(pressureSupport.supported===true && pressureSupport.affectedTrack===pressureMapping.affectedTrack && pressureSupport.pressureTrack===pressureMapping.track && pressureSupport.pressureDelta===1,`${id} is session-pressure Apply supported only through its explicit whitelist mapping`);
    else assertSmoke(pressureSupport.supported===false,`${id} is not session-pressure Apply supported`);
  }
  assertSmoke(getTravelV2ConsequencesBySource("focus-backlash").some((entry)=>entry.id==="consequence-arkengine-whine"),"focus-backlash includes Arkengine Whine");
  const failedSupportIds=getTravelV2ConsequencesBySource("failed-support").map((entry)=>entry.id);
  assertSmoke(failedSupportIds.includes("consequence-watch-fatigue")&&failedSupportIds.includes("consequence-stores-tangle"),"failed-support includes Watch Fatigue and Stores Tangle");
  const unresolvedHazardIds=getTravelV2ConsequencesBySource("unresolved-hazard").map((entry)=>entry.id);
  assertSmoke(unresolvedHazardIds.includes("consequence-veil-draft")&&unresolvedHazardIds.includes("consequence-signal-echo"),"unresolved-hazard includes Veil Draft and Signal Echo");
  const signalEcho=getTravelV2ConsequenceById("consequence-signal-echo");
  assertSmoke(signalEcho.affectedTrack==="Threat"&&signalEcho.explicitGmApplyEffect?.kind==="encounterSeedCandidate"&&signalEcho.explicitGmApplyEffect?.mutation==="none"&&signalEcho.sessionLocalEffect?.kind==="candidateOnly"&&signalEcho.sessionLocalEffect?.suggestedTrack==="Threat"&&signalEcho.sessionLocalEffect?.suggestedDelta===1,"Signal Echo keeps the expected catalog apply shape");
  const storesTangle=getTravelV2ConsequenceById("consequence-stores-tangle");
  assertSmoke(storesTangle.affectedTrack==="Supplies"&&storesTangle.explicitGmApplyEffect?.kind==="complicationCandidate"&&storesTangle.explicitGmApplyEffect?.mutation==="none"&&storesTangle.sessionLocalEffect?.kind==="candidateOnly"&&storesTangle.sessionLocalEffect?.suggestedTrack==="Supplies"&&storesTangle.sessionLocalEffect?.suggestedDelta===1,"Stores Tangle keeps the expected catalog apply shape");
  assertSmoke(getTravelV2ConsequencesBySource("final-bad-outcome").some((entry)=>entry.id==="consequence-course-slip"),"final-bad-outcome includes Course Slip");
  for (const followup of newFollowupConsequenceApplies) {
    const entry=getTravelV2ConsequenceById(followup.id);
    assertSmoke(entry?.id===followup.id,`${followup.id} resolves from the authored catalog`);
    assertSmoke(entry.severity===followup.severity,`${followup.id} keeps its authored severity`);
    assertSmoke(entry.affectedTrack===followup.affectedTrack&&entry.explicitGmApplyEffect?.kind===followup.kind&&entry.explicitGmApplyEffect?.mutation==="none"&&entry.sessionLocalEffect?.kind==="candidateOnly"&&entry.sessionLocalEffect?.suggestedTrack===followup.affectedTrack&&entry.sessionLocalEffect?.suggestedDelta===1,`${followup.id} keeps the expected follow-up catalog apply shape`);
    assertSmoke(testTravelV2SelectedConsequencePressureApplySupport(entry).supported===false,`${followup.id} is not session-pressure Apply supported`);
  }

  assertSmoke(queue.hasSession && queue.items.length===5,"queue gathers focus, support, hazard, ship scar, and final fallout candidates");
  assertSmoke(queue.pendingCount===5,"all gathered candidates begin pending");
  assertSmoke(queue.items.some((item)=>item.gmSummary==="Review Strain pressure." && item.sourceRecord?.id==="f1"),"GM queue contains full item summaries and source records");
  const playerSafeSnapshot=JSON.stringify(queue.playerSafeItems);
  assertSmoke(!playerSafeSnapshot.includes("Review Strain pressure")&&!playerSafeSnapshot.includes("sourceRecord")&&!playerSafeSnapshot.includes("applyEffectSummary")&&!playerSafeSnapshot.includes("catalogSuggestions"),"player-safe items omit GM summaries, source records, apply summaries, and catalog suggestions");
  assertSmoke(queue.applyStatusSummary && queue.applyStatusSummary.totalItems===queue.items.length,"queue exposes GM apply status summary with total item count");
  assertSmoke(!playerSafeSnapshot.includes("applyStatusSummary"),"player-safe items omit the GM apply status summary");
  const summarySession={...session(),travelV2PendingConsequenceQueue:{version:1,records:[
    {queueKey:"focus-backlash:f1",status:"pending",mutation:"none",selectedConsequence:{id:"consequence-hull-stress"}},
    {queueKey:"ship-scar:scar1",status:"pending",mutation:"none",selectedConsequence:{id:"consequence-arkengine-surge"}},
    {queueKey:"final-outcome:failure:0",status:"pending",mutation:"none",selectedConsequence:{id:"consequence-course-slip"}},
    {queueKey:"hazard:h1",status:"pending",mutation:"none",selectedConsequence:{id:"consequence-signal-echo"}},
    {queueKey:"support-backlash:s1",status:"pending",mutation:"none",selectedConsequence:{id:"consequence-stores-tangle"}}
  ]}};
  const statusSummaryQueue=prepareTravelV2PendingConsequenceQueue(summarySession);
  const applyStatusSummary=statusSummaryQueue.applyStatusSummary;
  assertSmoke(applyStatusSummary && Object.keys(applyStatusSummary).sort().join(",")===["alreadyAppliedCount","executableCount","missingCatalogCount","missingSelectionCount","selectedCount","sessionPressureOnlyCount","totalItems","unsupportedCount"].sort().join(","),"apply status summary contains exactly the required count fields");
  assertSmoke(applyStatusSummary.totalItems===statusSummaryQueue.items.length,"apply status summary totalItems equals ordered item count");
  assertSmoke(applyStatusSummary.selectedCount===5,"apply status summary counts selected consequence items");
  assertSmoke(applyStatusSummary.executableCount===5,"apply status summary counts canApplySelectedConsequence true items including Arkengine Surge, Course Slip, Signal Echo, and Stores Tangle");
  assertSmoke(applyStatusSummary.alreadyAppliedCount===0,"apply status summary has no already applied item before Course Slip apply");
  assertSmoke(applyStatusSummary.unsupportedCount===0,"apply status summary has no unsupported selected preview-only items");
  assertSmoke(applyStatusSummary.missingSelectionCount===0,"apply status summary counts items without selected consequence ids");
  assertSmoke(applyStatusSummary.missingCatalogCount===0,"apply status summary counts selected missing catalog ids");
  assertSmoke(applyStatusSummary.sessionPressureOnlyCount===2,"apply status summary counts Hull Stress and Arkengine Surge as session-pressure-only");
  assertSmoke(!JSON.stringify(statusSummaryQueue.playerSafeItems).includes("applyStatusSummary"),"player-safe items do not include applyStatusSummary");
  const expectedGmGroupKeys=["readyToApply","needsSelection","unsupported","otherPending","applied","deferred","dismissed"];
  assertSmoke(Array.isArray(statusSummaryQueue.gmItemGroups),"prepareTravelV2PendingConsequenceQueue returns gmItemGroups");
  assertSmoke(statusSummaryQueue.gmItemGroups.map((group)=>group.key).join(",")===expectedGmGroupKeys.join(","),"gmItemGroups keys are in the exact required order");
  const mixedSession={...session(),travelV2PendingConsequenceQueue:{version:1,records:[
    {queueKey:"focus-backlash:f1",status:"pending",mutation:"none",selectedConsequence:{id:"consequence-arkengine-whine"}},
    {queueKey:"support-backlash:s1",status:"pending",mutation:"none"},
    {queueKey:"hazard:h1",status:"pending",mutation:"none",selectedConsequence:{id:"missing-card-preview-only"}},
    {queueKey:"ship-scar:scar1",status:"applied",mutation:"none",selectedConsequence:{id:"consequence-ship-scar-candidate"},appliedEffect:{mutation:"session-followup-note-only",consequenceId:"consequence-ship-scar-candidate"}},
    {queueKey:"final-outcome:failure:0",status:"deferred",mutation:"none",selectedConsequence:{id:"consequence-course-slip"}}
  ]}};
  const mixedQueue=prepareTravelV2PendingConsequenceQueue(mixedSession);
  const mixedByKey=Object.fromEntries(mixedQueue.gmItemGroups.map((group)=>[group.key,group]));
  assertSmoke(mixedByKey.readyToApply.items.some((item)=>item.queueKey==="focus-backlash:f1"),"executable selected pending item is grouped into readyToApply");
  assertSmoke(mixedByKey.needsSelection.items.some((item)=>item.queueKey==="support-backlash:s1"),"pending item with no selected consequence is grouped into needsSelection");
  assertSmoke(mixedByKey.unsupported.items.some((item)=>item.queueKey==="hazard:h1"),"selected unsupported or preview-only item is grouped into unsupported");
  assertSmoke(mixedByKey.applied.items.some((item)=>item.queueKey==="ship-scar:scar1"&&item.hasAppliedEffect===true),"applied/appliedEffect item is grouped into applied");
  assertSmoke(mixedByKey.deferred.items.some((item)=>item.queueKey==="final-outcome:failure:0"),"deferred item is grouped into deferred");
  const dismissedSession={...session(),travelV2PendingConsequenceQueue:{version:1,records:[{queueKey:"support-backlash:s1",status:"dismissed",mutation:"none"}]}};
  const dismissedQueue=prepareTravelV2PendingConsequenceQueue(dismissedSession);
  assertSmoke(dismissedQueue.gmItemGroups.find((group)=>group.key==="dismissed")?.items.some((item)=>item.queueKey==="support-backlash:s1"),"dismissed item is grouped into dismissed");
  const groupedKeys=mixedQueue.gmItemGroups.flatMap((group)=>group.items.map((item)=>item.queueKey));
  assertSmoke(groupedKeys.length===mixedQueue.items.length&&new Set(groupedKeys).size===mixedQueue.items.length&&mixedQueue.items.every((item)=>groupedKeys.includes(item.queueKey)),"every queue item appears in exactly one gmItemGroups group");
  assertSmoke(JSON.stringify(mixedQueue.items)===JSON.stringify(mixedQueue.gmItemGroups.flatMap((group)=>group.items).sort((a,b)=>mixedQueue.items.findIndex((item)=>item.queueKey===a.queueKey)-mixedQueue.items.findIndex((item)=>item.queueKey===b.queueKey))),"gmItemGroups preserve queue item objects exactly as prepared");
  const mixedPlayerSafeSnapshot=JSON.stringify(mixedQueue.playerSafeItems);
  assertSmoke(!mixedPlayerSafeSnapshot.includes("gmItemGroups")&&!mixedPlayerSafeSnapshot.includes("appliedEffect")&&!mixedPlayerSafeSnapshot.includes("selectedConsequenceApplyPreview")&&!mixedPlayerSafeSnapshot.includes("Arkengine Whine")&&!mixedPlayerSafeSnapshot.includes("Ship Scar Candidate"),"playerSafeItems omit gmItemGroups, appliedEffect, selectedConsequenceApplyPreview, and GM-only selected consequence titles");
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
  const emptyReview=prepareTravelV2ConsequenceFollowupReview({key:"empty"});
  assertSmoke(emptyReview.hasRecords===false && emptyReview.totalCount===0 && emptyReview.openCount===0 && emptyReview.reviewedCount===0 && emptyReview.deferredCount===0 && emptyReview.resolvedCount===0,"empty follow-up review returns no records and zero counts");
  assertSmoke(emptyReview.groups.map((group)=>group.key).join(",")==="open,reviewed,deferred,resolved","empty follow-up review groups use exact status order");
  const reviewSession={key:"review",pressure:{hull:{value:2}},travelV2PendingConsequenceQueue:{version:1,records:[{queueKey:"q1",status:"pending"}]},hazards:{records:[{id:"h1",status:"active"}]},shipScars:{records:[{id:"s1",status:"pending"}]},travelV2ConsequenceFollowups:{version:1,records:[{queueKey:"q-open",title:"Legacy Open"},{queueKey:"q-reviewed",title:"Reviewed",status:"reviewed"},{queueKey:"q-deferred",title:"Deferred",status:"deferred"},{queueKey:"q-resolved",title:"Resolved",status:"resolved"}]}};
  const review=prepareTravelV2ConsequenceFollowupReview(reviewSession);
  assertSmoke(review.hasRecords===true && review.totalCount===4 && review.openCount===1 && review.reviewedCount===1 && review.deferredCount===1 && review.resolvedCount===1,"follow-up review counts all normalized statuses correctly");
  assertSmoke(review.groups.map((group)=>group.key).join(",")==="open,reviewed,deferred,resolved","follow-up review groups are in exact status order");
  assertSmoke(review.records[0]!==reviewSession.travelV2ConsequenceFollowups.records[0] && review.records[0].status==="open" && review.records[0].statusLabel==="Open","follow-up review clones records and normalizes missing status to open with label");
  const statusUpdate=updateTravelV2ConsequenceFollowupStatus(reviewSession,"q-reviewed","resolved",{now:"2026-06-26T00:09:00.000Z",note:"Done"});
  assertSmoke(statusUpdate.ok && statusUpdate.session!==reviewSession,"follow-up status update by queueKey succeeds and clones session");
  assertSmoke(statusUpdate.record.status==="resolved" && statusUpdate.record.statusUpdatedAt==="2026-06-26T00:09:00.000Z" && statusUpdate.record.statusUpdatedBy==="gm" && statusUpdate.record.statusNote==="Done","follow-up status update sets status timestamp, by, and optional note");
  assertSmoke(statusUpdate.records.find((record)=>record.queueKey==="q-open").status===undefined && statusUpdate.records.find((record)=>record.queueKey==="q-reviewed").status==="resolved","follow-up status update changes only the matching record");
  assertSmoke(JSON.stringify(statusUpdate.session.pressure)===JSON.stringify(reviewSession.pressure) && JSON.stringify(statusUpdate.session.travelV2PendingConsequenceQueue)===JSON.stringify(reviewSession.travelV2PendingConsequenceQueue) && JSON.stringify(statusUpdate.session.hazards)===JSON.stringify(reviewSession.hazards) && JSON.stringify(statusUpdate.session.shipScars)===JSON.stringify(reviewSession.shipScars),"follow-up status update leaves pressure, pending queue, hazards, and ship scars unchanged");
  assertSmoke(!updateTravelV2ConsequenceFollowupStatus(reviewSession,"q-reviewed","invalid").ok && !updateTravelV2ConsequenceFollowupStatus(reviewSession,"missing","open").ok && !updateTravelV2ConsequenceFollowupStatus(null,"q-reviewed","open").ok,"follow-up status update fails closed for invalid status, missing record, and invalid session");
  const forbiddenContainers=["actors","items","inventory","world","scenes","combat","tokens","chat","journals","sockets","compendia"];
  assertSmoke(forbiddenContainers.every((key)=>!(key in statusUpdate.session)),"follow-up status update adds no actor/item/inventory/world/scene/combat/token/chat/journal/socket/compendium containers");

  const runnerState=prepareTravelEventRunnerAppStateWithTravelV2Preview({session:s});
  assertSmoke(runnerState.pendingConsequenceQueue.items.length===5 && runnerState.pendingConsequenceQueue.items[0].requiresGmApply===true,"runner state prepares a GM pending consequence queue from sample session records");
  const selected=selectTravelV2PendingConsequenceCatalogCard(s,"focus-backlash:f1","consequence-arkengine-surge");
  assertSmoke(selected.ok && selected.session!==s,"selecting a valid suggested catalog card clones the session");
  const selectedItem=selected.queue.items.find((item)=>item.queueKey==="focus-backlash:f1");
  assertSmoke(selectedItem?.selectedConsequence?.id==="consequence-arkengine-surge" && selectedItem.selectedConsequence.title==="Arkengine Surge","selected consequence appears on GM queue item");
  const preview=selectedItem?.selectedConsequenceApplyPreview;
  assertSmoke(preview?.hasPreview===true && preview.consequenceId==="consequence-arkengine-surge" && preview.title==="Arkengine Surge" && preview.affectedTrack==="Strain" && preview.source==="pressureCandidate","selected consequence preview appears and uses catalog-resolved data");
  assertSmoke(preview.mutation==="session-pressure-only" && preview.executable===true && preview.previewOnly===false && preview.severity==="major" && preview.pressureDelta===1,"selected Arkengine Surge preview is executable session-pressure-only");
  assertSmoke(preview.warningText.includes("runner session only") && preview.warningText.includes("Does not mutate actors") && preview.warningText.includes("world data"),"selected consequence preview warning uses session-pressure-only wording");
  assertSmoke(selected.record.mutation==="none" && selectedItem.mutation==="none","selection keeps mutation none");
  assertSmoke(!JSON.stringify(selected.queue.playerSafeItems).includes("selectedConsequence")&&!JSON.stringify(selected.queue.playerSafeItems).includes("selectedConsequenceApplyPreview")&&!JSON.stringify(selected.queue.playerSafeItems).includes("applyEffectSummary")&&!JSON.stringify(selected.queue.playerSafeItems).includes("Arkengine Surge"),"selected consequence and GM apply preview are not exposed through player-safe items");
  const selectedNew=selectTravelV2PendingConsequenceCatalogCard(s,"focus-backlash:f1","consequence-arkengine-whine");
  const selectedNewItem=selectedNew.queue.items.find((item)=>item.queueKey==="focus-backlash:f1");
  const selectedNewPreview=selectedNewItem?.selectedConsequenceApplyPreview;
  assertSmoke(selectedNew.ok && selectedNewPreview?.executable===true && selectedNewPreview.previewOnly===false && selectedNewPreview.mutation==="session-pressure-only" && selectedNewPreview.affectedTrack==="Strain" && selectedNewPreview.pressureDelta===1,"selecting Arkengine Whine produces an executable session-pressure-only preview");
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
  assertSmoke(courseSlipRecord.status==="open" && courseSlipRecord.mutation==="session-followup-note-only" && courseSlipRecord.consequenceId==="consequence-course-slip" && courseSlipRecord.kind==="finalOutcomeCandidate" && courseSlipRecord.affectedTrack==="Route","Course Slip follow-up record has the required mutation, id, kind, and affected track");
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
  assertSmoke(!courseSlipPlayerSafe.includes("travelV2ConsequenceFollowups")&&!courseSlipPlayerSafe.includes("followupRecord")&&!courseSlipPlayerSafe.includes("appliedEffect")&&!courseSlipPlayerSafe.includes("selectedConsequenceApplyPreview")&&!courseSlipPlayerSafe.includes("applyEffectSummary")&&!courseSlipPlayerSafe.includes("sourceRecord")&&!courseSlipPlayerSafe.includes("Course Slip")&&!courseSlipPlayerSafe.includes("Signal Echo")&&!courseSlipPlayerSafe.includes("Stores Tangle"),"playerSafeItems omit Course Slip follow-ups and GM-only apply details");


  for (const followup of [
    {id:"consequence-signal-echo",queueKey:"hazard:h1",kind:"encounterSeedCandidate",affectedTrack:"Threat",source:"encounterSeedCandidate",containerCheck:"actors"},
    {id:"consequence-stores-tangle",queueKey:"support-backlash:s1",kind:"complicationCandidate",affectedTrack:"Supplies",source:"complicationCandidate",containerCheck:"inventory"}
  ]) {
    const selectedFollowup=selectTravelV2PendingConsequenceCatalogCard(s,followup.queueKey,followup.id);
    assertSmoke(selectedFollowup.ok && selectedFollowup.session!==s,`${followup.id} selection succeeds and clones the session`);
    const selectedFollowupPreview=selectedFollowup.queue.items.find((item)=>item.queueKey===followup.queueKey)?.selectedConsequenceApplyPreview;
    assertSmoke(selectedFollowupPreview?.executable===true && selectedFollowupPreview.previewOnly===false && selectedFollowupPreview.mutation==="session-followup-note-only" && selectedFollowupPreview.affectedTrack===followup.affectedTrack && selectedFollowupPreview.source===followup.source && selectedFollowupPreview.pressureDelta===null,`${followup.id} preview is executable session-followup-note-only for ${followup.affectedTrack}`);
    assertSmoke(selectedFollowupPreview.warningText.includes("session-local follow-up note only") && selectedFollowupPreview.warningText.includes("actors") && selectedFollowupPreview.warningText.includes("items") && selectedFollowupPreview.warningText.includes("chat") && selectedFollowupPreview.warningText.includes("journals") && selectedFollowupPreview.warningText.includes("combat") && selectedFollowupPreview.warningText.includes("scenes") && selectedFollowupPreview.warningText.includes("tokens") && selectedFollowupPreview.warningText.includes("sockets") && selectedFollowupPreview.warningText.includes("compendia") && selectedFollowupPreview.warningText.includes("world data"),`${followup.id} preview warning describes session-local-only forbidden mutations`);
    const base={...session(),pressure:{hull:{value:1},strain:{value:2},lifeveil:{value:3},morale:{value:4},supplies:{value:5}},travelV2PendingConsequenceQueue:{version:1,records:[{queueKey:followup.queueKey,status:"pending",mutation:"none",selectedConsequence:{id:followup.id}}]}};
    const beforeHazards=JSON.stringify(base.hazards??null);
    const beforeScars=JSON.stringify(base.shipScars??null);
    const appliedFollowup=applyTravelV2SelectedConsequenceToSession(base,followup.queueKey,{now:"2026-06-26T00:08:00.000Z"});
    assertSmoke(appliedFollowup.ok && appliedFollowup.session!==base,`${followup.id} apply succeeds and clones the session`);
    assertSmoke(appliedFollowup.session.travelV2ConsequenceFollowups?.version===1 && appliedFollowup.session.travelV2ConsequenceFollowups.records.length===1,`${followup.id} creates exactly one follow-up container record`);
    const record=appliedFollowup.session.travelV2ConsequenceFollowups.records[0];
    assertSmoke(record.mutation==="session-followup-note-only" && record.consequenceId===followup.id && record.kind===followup.kind && record.affectedTrack===followup.affectedTrack,`${followup.id} follow-up record has required mutation, id, kind, and affected track`);
    const item=appliedFollowup.queue.items.find((candidate)=>candidate.queueKey===followup.queueKey);
    assertSmoke(item?.status==="applied" && item.selectedConsequence?.id===followup.id,`${followup.id} apply marks queue item applied and preserves selected consequence`);
    assertSmoke(appliedFollowup.record.appliedEffect?.mutation==="session-followup-note-only" && appliedFollowup.record.appliedEffect.kind===followup.kind && appliedFollowup.record.appliedEffect.affectedTrack===followup.affectedTrack && appliedFollowup.record.appliedEffect.consequenceId===followup.id,`${followup.id} appliedEffect stores follow-up apply details`);
    assertSmoke(appliedFollowup.record.appliedEffect.followupRecord!==record && JSON.stringify(appliedFollowup.record.appliedEffect.followupRecord)===JSON.stringify(record),`${followup.id} appliedEffect followupRecord is a cloned copy of the appended record`);
    assertSmoke(JSON.stringify(appliedFollowup.session.pressure)===JSON.stringify(base.pressure),`${followup.id} apply leaves all pressure values unchanged`);
    assertSmoke(JSON.stringify(appliedFollowup.session.hazards??null)===beforeHazards && JSON.stringify(appliedFollowup.session.shipScars??null)===beforeScars,`${followup.id} apply leaves hazards and ship scars unchanged`);
    assertSmoke(!(["actors","items","world","scene","scenes","combat","combats","token","tokens","chat","journal","journals",followup.containerCheck].some((key)=>key in appliedFollowup.session)),`${followup.id} apply adds no forbidden data containers`);
    assertSmoke(prepareTravelV2PendingConsequenceQueue(appliedFollowup.session).applyStatusSummary.alreadyAppliedCount===1,`${followup.id} increases alreadyAppliedCount after apply`);
    const playerSafe=JSON.stringify(prepareTravelV2PendingConsequenceQueue(appliedFollowup.session).playerSafeItems);
    assertSmoke(!playerSafe.includes("travelV2ConsequenceFollowups")&&!playerSafe.includes("followupRecord")&&!playerSafe.includes("appliedEffect")&&!playerSafe.includes("selectedConsequence")&&!playerSafe.includes("selectedConsequenceApplyPreview")&&!playerSafe.includes("applyEffectSummary")&&!playerSafe.includes("sourceRecord")&&!playerSafe.includes("Signal Echo")&&!playerSafe.includes("Stores Tangle"),`${followup.id} playerSafeItems omit follow-up records and GM-only apply details`);
    const duplicate=applyTravelV2SelectedConsequenceToSession(appliedFollowup.session,followup.queueKey,{now:"2026-06-26T00:09:00.000Z"});
    assertSmoke(!duplicate.ok && duplicate.alreadyApplied===true && duplicate.session===appliedFollowup.session && duplicate.session.travelV2ConsequenceFollowups.records.length===1,`${followup.id} second apply fails closed without appending a duplicate follow-up`);
  }

  for (const newPressure of newPressureConsequenceApplies) {
    const base={...session(),pressure:{hull:{value:10},strain:{value:20},lifeveil:{value:30},morale:{value:40},supplies:{value:50}},travelV2PendingConsequenceQueue:{version:1,records:[{queueKey:newPressure.queueKey,status:"pending",mutation:"none",selectedConsequence:{id:newPressure.id}}]}};
    const beforeFollowups=JSON.stringify(base.travelV2ConsequenceFollowups??null);
    const beforeHazards=JSON.stringify(base.hazards??null);
    const beforeScars=JSON.stringify(base.shipScars??null);
    const previewItem=prepareTravelV2PendingConsequenceQueue(base).items.find((item)=>item.queueKey===newPressure.queueKey);
    const preview=previewItem?.selectedConsequenceApplyPreview;
    assertSmoke(preview?.hasPreview===true && preview.consequenceId===newPressure.id && preview.title===newPressure.title && preview.severity===newPressure.severity && preview.source==="pressureCandidate" && preview.affectedTrack===newPressure.affectedTrack && preview.mutation==="session-pressure-only" && preview.executable===true && preview.previewOnly===false && preview.pressureDelta===1,`${newPressure.id} preview is executable session-pressure-only with the mapped pressure delta`);
    assertSmoke(preview.warningText.includes("runner session only") && preview.warningText.includes("Does not mutate actors") && preview.warningText.includes("world data"),`${newPressure.id} preview uses existing session-pressure-only warning wording`);
    const applied=applyTravelV2SelectedConsequenceToSession(base,newPressure.queueKey,{now:"2026-06-26T00:10:00.000Z"});
    assertSmoke(applied.ok && applied.session!==base,`${newPressure.id} apply succeeds and clones the session`);
    assertSmoke(applied.session.pressure[newPressure.track].value===base.pressure[newPressure.track].value+1,`${newPressure.id} increments exactly mapped ${newPressure.track} pressure by 1`);
    for (const track of ["hull","strain","lifeveil","morale","supplies"].filter((track)=>track!==newPressure.track)) assertSmoke(applied.session.pressure[track].value===base.pressure[track].value,`${newPressure.id} leaves ${track} pressure unchanged`);
    const item=applied.queue.items.find((candidate)=>candidate.queueKey===newPressure.queueKey);
    const effect=applied.record.appliedEffect;
    assertSmoke(item?.status==="applied" && item.selectedConsequence?.id===newPressure.id,`${newPressure.id} apply marks queue item applied and preserves selected consequence`);
    assertSmoke(effect?.mutation==="session-pressure-only" && effect.consequenceId===newPressure.id && effect.affectedTrack===newPressure.affectedTrack && effect.pressureTrack===newPressure.track && effect.pressureDelta===1 && effect.beforeValue===base.pressure[newPressure.track].value && effect.afterValue===base.pressure[newPressure.track].value+1,`${newPressure.id} records correct session pressure appliedEffect`);
    assertSmoke(JSON.stringify(applied.session.travelV2ConsequenceFollowups??null)===beforeFollowups,`${newPressure.id} does not write follow-up records`);
    assertSmoke(JSON.stringify(applied.session.hazards??null)===beforeHazards && JSON.stringify(applied.session.shipScars??null)===beforeScars,`${newPressure.id} leaves hazards and ship scars unchanged`);
    assertSmoke(!(["actors","items","inventory","inventories","world","scene","scenes","combat","combats","token","tokens","chat","chats","journal","journals"].some((key)=>key in applied.session)),`${newPressure.id} apply adds no forbidden Foundry/world data containers`);
    assertSmoke(prepareTravelV2PendingConsequenceQueue(applied.session).applyStatusSummary.alreadyAppliedCount===1,`${newPressure.id} increases alreadyAppliedCount after apply`);
    const duplicate=applyTravelV2SelectedConsequenceToSession(applied.session,newPressure.queueKey,{now:"2026-06-26T00:11:00.000Z"});
    assertSmoke(!duplicate.ok && duplicate.alreadyApplied===true && duplicate.session===applied.session && applied.session.pressure[newPressure.track].value===base.pressure[newPressure.track].value+1,`${newPressure.id} second apply fails closed without incrementing pressure again`);
  }
  const newPressureSummarySession={...session(),travelV2PendingConsequenceQueue:{version:1,records:newPressureConsequenceApplies.map((entry)=>({queueKey:entry.queueKey,status:"pending",mutation:"none",selectedConsequence:{id:entry.id}}))}};
  const newPressureSummary=prepareTravelV2PendingConsequenceQueue(newPressureSummarySession).applyStatusSummary;
  assertSmoke(newPressureSummary.executableCount===2 && newPressureSummary.sessionPressureOnlyCount===2, "selected Arkengine Surge and Lifeveil Flicker count as executable session-pressure-only applies");
  const newPressurePlayerSafe=JSON.stringify(prepareTravelV2PendingConsequenceQueue(newPressureSummarySession).playerSafeItems);
  assertSmoke(!newPressurePlayerSafe.includes("appliedEffect")&&!newPressurePlayerSafe.includes("selectedConsequence")&&!newPressurePlayerSafe.includes("selectedConsequenceApplyPreview")&&!newPressurePlayerSafe.includes("applyEffectSummary")&&!newPressurePlayerSafe.includes("sourceRecord")&&!newPressurePlayerSafe.includes("Arkengine Surge")&&!newPressurePlayerSafe.includes("Lifeveil Flicker"),"playerSafeItems omit new pressure card GM-only apply details and titles");

  for (const supported of existingPressureConsequenceApplies) {
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
  for (const followup of newFollowupConsequenceApplies) {
    const base={...session(),hazards:{records:[{id:"h1",roundIndex:0,status:"active",name:"Void Shear",playerText:"The lane is still unstable."},{id:"h2",roundIndex:0,status:"active",name:"Ash Wake",playerText:"The wake is still unstable."}]},pressure:{hull:{value:1},strain:{value:2},lifeveil:{value:3},morale:{value:4},supplies:{value:5}},outcomePackage:{locked:true},finalRoute:{id:"route-a"},cargo:{records:[{id:"cargo-a"}]},inventory:{slots:["rations"]},travelV2PendingConsequenceQueue:{version:1,records:[{queueKey:followup.queueKey,status:"pending",mutation:"none",selectedConsequence:{id:followup.id}}]}};
    const beforePressure=JSON.stringify(base.pressure);
    const beforeOutcome=JSON.stringify(base.outcomePackage??null);
    const beforeRoute=JSON.stringify(base.finalRoute??null);
    const beforeCargo=JSON.stringify(base.cargo??null);
    const beforeInventory=JSON.stringify(base.inventory??null);
    const beforeHazards=JSON.stringify(base.hazards??null);
    const beforeScars=JSON.stringify(base.shipScars??null);
    const previewItem=prepareTravelV2PendingConsequenceQueue(base).items.find((item)=>item.queueKey===followup.queueKey);
    const preview=previewItem?.selectedConsequenceApplyPreview;
    assertSmoke(preview?.hasPreview===true&&preview.consequenceId===followup.id&&preview.title===followup.title&&preview.severity===followup.severity&&preview.affectedTrack===followup.affectedTrack&&preview.source===followup.kind&&preview.mutation==="session-followup-note-only"&&preview.executable===true&&preview.previewOnly===false&&preview.pressureDelta===null,`${followup.id} preview is executable session-followup-note-only with authored severity and mapped track/kind`);
    assertSmoke(["session-local follow-up note only","route","cargo","hazards","ship scars","actors","items","inventories","chat","journals","combat","scenes","tokens","sockets","compendia","world data"].every((term)=>preview.warningText.includes(term)),`${followup.id} preview warning lists session-local-only and forbidden mutation categories`);
    const appliedFollowup=applyTravelV2SelectedConsequenceToSession(base,followup.queueKey,{now:"2026-06-26T00:12:00.000Z"});
    assertSmoke(appliedFollowup.ok&&appliedFollowup.session!==base,`${followup.id} apply succeeds and clones the session`);
    assertSmoke(appliedFollowup.session.travelV2ConsequenceFollowups?.version===1&&appliedFollowup.session.travelV2ConsequenceFollowups.records.length===1,`${followup.id} creates exactly one follow-up container record`);
    const record=appliedFollowup.session.travelV2ConsequenceFollowups.records[0];
    assertSmoke(record.version===1&&record.queueKey===followup.queueKey&&record.mutation==="session-followup-note-only"&&record.consequenceId===followup.id&&record.title===followup.title&&record.kind===followup.kind&&record.affectedTrack===followup.affectedTrack&&record.source===followup.kind&&record.createdAt&&record.createdBy==="gm",`${followup.id} follow-up record has the required shape`);
    const item=appliedFollowup.queue.items.find((candidate)=>candidate.queueKey===followup.queueKey);
    assertSmoke(item?.status==="applied"&&item.selectedConsequence?.id===followup.id,`${followup.id} apply marks queue item applied and preserves selected consequence`);
    assertSmoke(appliedFollowup.record.appliedEffect?.mutation==="session-followup-note-only"&&appliedFollowup.record.appliedEffect.kind===followup.kind&&appliedFollowup.record.appliedEffect.affectedTrack===followup.affectedTrack&&appliedFollowup.record.appliedEffect.consequenceId===followup.id,`${followup.id} appliedEffect stores follow-up apply details`);
    assertSmoke(appliedFollowup.record.appliedEffect.followupRecord!==record&&JSON.stringify(appliedFollowup.record.appliedEffect.followupRecord)===JSON.stringify(record),`${followup.id} appliedEffect followupRecord is a cloned copy of the appended record`);
    assertSmoke(JSON.stringify(appliedFollowup.session.pressure)===beforePressure,`${followup.id} apply leaves all pressure values unchanged`);
    assertSmoke(JSON.stringify(appliedFollowup.session.outcomePackage??null)===beforeOutcome&&JSON.stringify(appliedFollowup.session.finalRoute??null)===beforeRoute,`${followup.id} apply leaves outcome and final route data unchanged`);
    assertSmoke(JSON.stringify(appliedFollowup.session.cargo??null)===beforeCargo&&JSON.stringify(appliedFollowup.session.inventory??null)===beforeInventory,`${followup.id} apply leaves cargo and inventory data unchanged`);
    assertSmoke(JSON.stringify(appliedFollowup.session.hazards??null)===beforeHazards&&JSON.stringify(appliedFollowup.session.shipScars??null)===beforeScars,`${followup.id} apply leaves hazards and ship scars unchanged`);
    assertSmoke(!(["actors","items","world","scene","scenes","combat","combats","token","tokens","chat","chats","journal","journals","encounters"].some((key)=>key in appliedFollowup.session)),`${followup.id} apply adds no forbidden data containers`);
    assertSmoke(prepareTravelV2PendingConsequenceQueue(appliedFollowup.session).applyStatusSummary.alreadyAppliedCount===1,`${followup.id} increases alreadyAppliedCount after apply`);
    const duplicate=applyTravelV2SelectedConsequenceToSession(appliedFollowup.session,followup.queueKey,{now:"2026-06-26T00:13:00.000Z"});
    assertSmoke(!duplicate.ok&&duplicate.alreadyApplied===true&&duplicate.session===appliedFollowup.session&&duplicate.session.travelV2ConsequenceFollowups.records.length===1,`${followup.id} second apply fails closed without appending a duplicate follow-up`);
  }
  const newFollowupSummarySession={...session(),hazards:{records:[{id:"h1",roundIndex:0,status:"active",name:"Void Shear",playerText:"The lane is still unstable."},{id:"h2",roundIndex:0,status:"active",name:"Ash Wake",playerText:"The wake is still unstable."}]},travelV2PendingConsequenceQueue:{version:1,records:newFollowupConsequenceApplies.map((entry)=>({queueKey:entry.queueKey,status:"pending",mutation:"none",selectedConsequence:{id:entry.id}}))}};
  const newFollowupSummary=prepareTravelV2PendingConsequenceQueue(newFollowupSummarySession).applyStatusSummary;
  assertSmoke(newFollowupSummary.executableCount===5&&newFollowupSummary.sessionPressureOnlyCount===0,"selected new follow-up cards count as executable without increasing sessionPressureOnlyCount");
  const newFollowupPlayerSafe=JSON.stringify(prepareTravelV2PendingConsequenceQueue(newFollowupSummarySession).playerSafeItems);
  assertSmoke(!["travelV2ConsequenceFollowups","followupRecord","appliedEffect","selectedConsequenceApplyPreview","applyEffectSummary","sourceRecord","Route Drift","Cargo Shift","Threat Attracted","Hazard Escalation","Ship Scar Candidate"].some((term)=>newFollowupPlayerSafe.includes(term)),"playerSafeItems omit new follow-up records, GM-only apply details, and titles");

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
  const majorPressureCatalog={id:"consequence-arkengine-surge",severity:"major",affectedTrack:"Strain",sessionLocalEffect:{kind:"candidateOnly",suggestedTrack:"Strain",suggestedDelta:1},explicitGmApplyEffect:{kind:"pressureCandidate",mutation:"none"}};
  assertSmoke(testTravelV2SelectedConsequencePressureApplySupport({...majorPressureCatalog,severity:"minor"}).supported===false,"Arkengine Surge fails closed when severity changes away from major");
  assertSmoke(testTravelV2SelectedConsequencePressureApplySupport({...majorPressureCatalog,id:"consequence-lifeveil-flicker",affectedTrack:"Lifeveil",sessionLocalEffect:{kind:"candidateOnly",suggestedTrack:"Lifeveil",suggestedDelta:1},severity:"minor"}).supported===false,"Lifeveil Flicker fails closed when severity changes away from major");
  assertSmoke(testTravelV2SelectedConsequencePressureApplySupport({...majorPressureCatalog,id:"consequence-not-whitelisted",title:"Not Whitelisted"}).supported===false,"non-whitelisted major pressureCandidate fails closed");
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
  const selectedMajorApply=applyTravelV2SelectedConsequenceToSession(selected.session,"focus-backlash:f1");
  assertSmoke(selectedMajorApply.ok && selectedMajorApply.session.pressure.strain.value===(s.pressure.strain.value+1),"manual apply for selected Arkengine Surge succeeds through session-pressure-only path");
  const missingCatalogApply=applyTravelV2SelectedConsequenceToSession({ ...selected.session, travelV2PendingConsequenceQueue:{version:1,records:[{queueKey:"focus-backlash:f1",status:"pending",selectedConsequence:{id:"deleted-card"}}]} },"focus-backlash:f1");
  assertSmoke(!missingCatalogApply.ok,"manual apply for missing catalog id fails closed");
  const missingCatalogSession={...selected.session,travelV2PendingConsequenceQueue:{version:1,records:[{queueKey:"focus-backlash:f1",status:"pending",mutation:"none",selectedConsequence:{id:"deleted-card",title:"Deleted Card",severity:"major",playerSafeSummary:"Stored display survives."}}]}};
  const missingPreview=prepareTravelV2PendingConsequenceQueue(missingCatalogSession).items.find((item)=>item.queueKey==="focus-backlash:f1")?.selectedConsequenceApplyPreview;
  assertSmoke(missingPreview?.hasPreview===true && missingPreview.executable===false && missingPreview.warningText.includes("Catalog card could not be resolved"),"missing selected catalog id fails safely with non-executable warning");
  const dismissed=updateTravelV2PendingConsequenceQueueItem(applied.session,"focus-backlash:f1","dismissed",{now:"2026-06-26T00:03:00.000Z"});
  assertSmoke(dismissed.ok && dismissed.queue.dismissedCount===1,"dismiss lifecycle is reflected in queue counts");

  const batchBase={...session(),hazards:{records:[{id:"h1",roundIndex:0,status:"active",name:"Void Shear",playerText:"The lane is still unstable."},{id:"h2",roundIndex:0,status:"active",name:"Unsupported Wake",playerText:"The wake is strange."}]},pressure:{hull:{value:1},strain:{value:2},lifeveil:{value:3},morale:{value:4},supplies:{value:5}},travelV2PendingConsequenceQueue:{version:1,records:[
    {queueKey:"focus-backlash:f1",status:"pending",mutation:"none",selectedConsequence:{id:"consequence-arkengine-whine"}},
    {queueKey:"final-outcome:failure:0",status:"pending",mutation:"none",selectedConsequence:{id:"consequence-course-slip"}},
    {queueKey:"support-backlash:s1",status:"pending",mutation:"none",selectedConsequence:{id:"consequence-not-supported",title:"Unsupported Card"}},
    {queueKey:"hazard:h1",status:"pending",mutation:"none"},
    {queueKey:"hazard:h2",status:"pending",mutation:"none",selectedConsequence:{id:"consequence-not-supported",title:"Unsupported Card"}},
    {queueKey:"ship-scar:scar1",status:"applied",mutation:"session-pressure-only",selectedConsequence:{id:"consequence-hull-stress"},appliedEffect:{mutation:"session-pressure-only",consequenceId:"consequence-hull-stress"}}
  ]}};
  const batchDeferred=updateTravelV2PendingConsequenceQueueItem(batchBase,"support-backlash:s1","deferred",{now:"2026-06-26T00:14:00.000Z"});
  const batchResult=applyAllExecutableTravelV2SelectedConsequencesToSession(batchDeferred.session,{now:"2026-06-26T00:15:00.000Z"});
  assertSmoke(batchResult.ok&&batchResult.appliedCount===2&&batchResult.attemptedCount===2,"batch Apply applies only eligible executable pending selected pressure and follow-up cards");
  assertSmoke(batchResult.applied.some((entry)=>entry.queueKey==="focus-backlash:f1"&&entry.mutation==="session-pressure-only")&&batchResult.applied.some((entry)=>entry.queueKey==="final-outcome:failure:0"&&entry.mutation==="session-followup-note-only"),"batch Apply summaries include pressure and follow-up mutations");
  assertSmoke(batchResult.appliedEffectMutations["session-pressure-only"]===1&&batchResult.appliedEffectMutations["session-followup-note-only"]===1,"batch Apply mutation summary counts pressure and follow-up effects");
  assertSmoke(batchResult.session.pressure.strain.value===3&&batchResult.session.pressure.hull.value===1&&batchResult.session.pressure.morale.value===4,"batch Apply increments only the eligible mapped pressure track");
  assertSmoke(batchResult.session.travelV2ConsequenceFollowups.records.length===1&&batchResult.session.travelV2ConsequenceFollowups.records[0].consequenceId==="consequence-course-slip","batch Apply appends the eligible follow-up exactly once");
  assertSmoke(batchResult.skipped.some((entry)=>entry.queueKey==="support-backlash:s1"&&entry.reason.includes("status is deferred"))&&batchResult.skipped.some((entry)=>entry.queueKey==="hazard:h1"&&entry.reason.includes("No selected"))&&batchResult.skipped.some((entry)=>entry.queueKey==="ship-scar:scar1"&&entry.reason.includes("status is applied"))&&batchResult.skipped.some((entry)=>entry.queueKey==="hazard:h2"&&entry.reason.includes("preview-only")),"batch Apply records skipped deferred, missing-selection, and already-applied items");
  const batchRepeat=applyAllExecutableTravelV2SelectedConsequencesToSession(batchResult.session,{now:"2026-06-26T00:16:00.000Z"});
  assertSmoke(!batchRepeat.ok&&batchRepeat.appliedCount===0&&batchRepeat.session===batchResult.session&&batchResult.session.travelV2ConsequenceFollowups.records.length===1&&batchResult.session.pressure.strain.value===3,"repeated batch Apply is a no-op and does not duplicate effects");
  assertSmoke(!(["actors","items","inventory","world","scene","scenes","combat","combats","token","tokens","chat","chats","journal","journals"].some((key)=>key in batchResult.session)),"batch Apply adds no actor/item/inventory/world/scene/combat/token/chat/journal containers");
  const batchPlayerSafe=JSON.stringify(batchResult.queue.playerSafeItems);
  assertSmoke(!["appliedEffect","selectedConsequenceApplyPreview","followupRecord","travelV2ConsequenceFollowups","Arkengine Whine","Course Slip"].some((term)=>batchPlayerSafe.includes(term)),"batch Apply playerSafeItems omit applied effects, previews, follow-ups, and selected consequence titles");
  const noEligible=applyAllExecutableTravelV2SelectedConsequencesToSession(s,{now:"2026-06-26T00:17:00.000Z"});
  assertSmoke(!noEligible.ok&&noEligible.attemptedCount===0&&noEligible.appliedCount===0&&noEligible.session===s,"batch Apply returns ok false and original session identity when no eligible items exist");

  const helperSource=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),"travel-v2-pending-consequence-queue.js"),"utf8");
  assertSmoke(!/(\bgame|Actor|ChatMessage|JournalEntry|Combat|Scene|Token|socket|compendium|updateEmbeddedDocuments|createEmbeddedDocuments|deleteEmbeddedDocuments)\s*[.([]/.test(helperSource),"pending consequence queue helper does not call Foundry mutation APIs");
  return {ok:true,checked:["course-slip-followup","gather","gm-full-items","sanitize","catalog","select","select-preserves-status","selected-preview","preview-warning","status-preserves-select","unknown-select-failures","defer","mark-applied","dismiss","mutation-none","manual-apply","idempotency","fail-closed","suggestion-categories","minor-pressure-suggestions","dedupe","no-foundry-mutation-api"]};
}
export default runTravelV2PendingConsequenceQueueSmokeChecks;
