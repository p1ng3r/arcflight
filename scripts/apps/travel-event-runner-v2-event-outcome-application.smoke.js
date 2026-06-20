import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";
function assertSmoke(c,m){if(!c)throw new Error(`Travel event runner v2 event outcome application smoke check failed: ${m}`)}
function assertEqual(a,e,m){if(a!==e)throw new Error(`Travel event runner v2 event outcome application smoke check failed: ${m}. Expected ${e}, got ${a}.`)}
function snap(v){return JSON.stringify(v)}
function session(){return {key:"runner-outcome", status:"completed", completed:true, completedAt:"2026-06-20T00:00:00.000Z", event:{rounds:[{roundNumber:1}]}, travelV2EventCompletion:{completed:true}, hazards:{pendingDraws:[{id:"h"}]}, shipScars:{pending:[{id:"s"}]}, travelV2RoundResolutions:{records:[{roundIndex:0, roundNumber:1, effectiveOutcomeKey:"success"}]}, travelV2PressureApplications:{records:[{roundIndex:0, totalsByPressureType:{strain:1}}]}}}
async function importRunnerModule(){const prev=globalThis.foundry;let renderCalls=0;globalThis.foundry={applications:{api:{ApplicationV2:class{async _prepareContext(){return{}} render(){renderCalls++;return{rendered:true,renderCalls}} _onRender(){}},HandlebarsApplicationMixin:(B)=>B}}};try{return{module:await import(`./travel-event-runner.js?outcomeApplicationSmoke=${Date.now()}`),getRenderCalls:()=>renderCalls}}finally{if(prev===undefined)delete globalThis.foundry;else globalThis.foundry=prev}}
export async function runTravelEventRunnerV2EventOutcomeApplicationSmokeChecks(){
 const {module,getRenderCalls}=await importRunnerModule(); const {ArcflightTravelEventRunner,prepareTravelV2EventOutcomeApplicationRunnerUpdate}=module;
 assertEqual(typeof prepareTravelV2EventOutcomeApplicationRunnerUpdate,"function","runner outcome update helper exported");
 let chat=0,socket=0,actor=0,item=0; const pg=globalThis.game, pc=globalThis.ChatMessage; globalThis.game={socket:{emit:()=>socket++},actors:{get:()=>({update:()=>actor++}),values:()=>[]},items:{get:()=>({update:()=>item++}),values:()=>[]},users:{filter:()=>[]}}; globalThis.ChatMessage={create:()=>chat++};
 try{
  const blocked={status:"active"}; const b=prepareTravelV2EventOutcomeApplicationRunnerUpdate(blocked); assertSmoke(!b.shouldUpdateSession,"blocked update does not update session");
  const s=session(); const before=snap(s); const u=prepareTravelV2EventOutcomeApplicationRunnerUpdate(s,{now:"2026-06-20T00:01:00.000Z"}); assertSmoke(u.shouldUpdateSession&&u.shouldRerender,"successful update updates session only"); assertEqual(u.nextSession.travelV2EventOutcomeApplication.applied,true,"application record written"); assertEqual(snap(s),before,"runner helper does not mutate input");
  const state=prepareTravelEventRunnerAppStateWithTravelV2Preview({session:s}); assertSmoke(state.travelV2PreviewPanel.travelV2EventOutcomePackage.canApply,"state reports can apply"); assertSmoke(!s.travelV2EventOutcomeApplication,"state prep does not apply automatically");
  const app=new ArcflightTravelEventRunner({session:s}); const rendered=await app.applyTravelV2EventOutcomePackage({now:"2026-06-20T00:02:00.000Z"}); assertSmoke(rendered.rendered,"app rerenders on success"); assertEqual(app.uiState.travelV2EventOutcomeApplicationResult.applied,true,"app stores success result"); assertEqual(app.session.travelV2EventOutcomeApplication.applied,true,"app replaces session clone");
  const dup=await app.applyTravelV2EventOutcomePackage(); assertSmoke(dup&&!dup.shouldUpdateSession,"duplicate app application blocks"); assertEqual(app.uiState.travelV2EventOutcomeApplicationResult.ok,false,"app stores blocked duplicate");
  assertEqual(chat,0,"no chat side effects"); assertEqual(socket,0,"no socket side effects"); assertEqual(actor,0,"no actor side effects"); assertEqual(item,0,"no item side effects"); assertSmoke(getRenderCalls()>=1,"successful app render called");
 } finally { if(pg===undefined)delete globalThis.game;else globalThis.game=pg; if(pc===undefined)delete globalThis.ChatMessage;else globalThis.ChatMessage=pc; }
 return {ok:true, checked:["helper","state","app","duplicate","no-side-effects"]};
}
export default runTravelEventRunnerV2EventOutcomeApplicationSmokeChecks;
