import assert from "node:assert/strict";
import test from "node:test";
import { executeVoyagePf2ePendingCheck, validateVoyagePf2eExecutionDependencies } from "../../../scripts/voyage/pf2e/resolution-check-executor.js";
const check = (extra={}) => ({ pendingCheckId:"roll-1",sequence:0,status:"pending",mode:"check",source:{kind:"character",uuid:"Actor.a"},approachId:"athletics-approach",statisticSlugOrAbilityId:"athletics",finalDc:20,momentumRollBonus:0,secrecy:"public",...extra });
test("executes once with fixed PF2e parameters and isolated result", async () => { let uuids=0, actors=0, calls=0, args; const actor={}; const stat={}; const result=await executeVoyagePf2ePendingCheck(check(), { async resolveUuid(){uuids++;return{};},getActorFromResolvedDocument(){actors++;return actor;},getStatistic(a,s){return s === "athletics" ? stat : null;},rollStatistic(s,p){calls++;args=[s,p];return {total:25,degreeOfSuccess:3, options:{leak:true}};} }); assert.equal(uuids,1);assert.equal(actors,1);assert.equal(calls,1);assert.equal(args[0],stat);assert.deepEqual(args[1],{dc:20,messageMode:"public",skipDialog:true,createMessage:true,identifier:"roll-1",momentumRollBonus:0});assert.deepEqual(result.result,{total:25,degreeOfSuccess:3,degreeOfSuccessSlug:"critical-success"});assert.equal(JSON.stringify(result).includes("leak"),false); });
test("validates four own functions and blocks bad rolls", async () => { assert.equal(validateVoyagePf2eExecutionDependencies({}).valid,false); const deps={resolveUuid:async()=>({}),getActorFromResolvedDocument:()=>({}),getStatistic:()=>({}),rollStatistic:()=>null}; assert.equal((await executeVoyagePf2ePendingCheck(check(),deps)).errors[0].code,"voyage-pf2e-roll-cancelled"); });
test("maps all valid degrees and controls invalid roll data", async () => { for (const [degree,slug] of [[0,"critical-failure"],[1,"failure"],[2,"success"],[3,"critical-success"]]) { const r=await executeVoyagePf2ePendingCheck(check(),{resolveUuid:async()=>({}),getActorFromResolvedDocument:()=>({}),getStatistic:()=>({}),rollStatistic:()=>({total:1,degreeOfSuccess:degree})});assert.equal(r.result.degreeOfSuccessSlug,slug); } const r=await executeVoyagePf2ePendingCheck(check(),{resolveUuid:async()=>({}),getActorFromResolvedDocument:()=>({}),getStatistic:()=>({}),rollStatistic:()=>({total:Infinity,degreeOfSuccess:2})});assert.equal(r.errors[0].code,"voyage-pf2e-invalid-roll-result"); });
test("captures every untrusted dependency getter exactly once", async () => { const reads={}; const source={}; for(const key of ["resolveUuid","getActorFromResolvedDocument","getStatistic","rollStatistic"]){Object.defineProperty(source,key,{enumerable:true,get(){reads[key]=(reads[key]??0)+1; return key==="resolveUuid"?async()=>({}):key==="getActorFromResolvedDocument"?()=>({}):key==="getStatistic"?()=>({}):()=>({total:1,degreeOfSuccess:2});}});} await executeVoyagePf2ePendingCheck(check(),source); assert.deepEqual(reads,{resolveUuid:1,getActorFromResolvedDocument:1,getStatistic:1,rollStatistic:1}); });
test("hostile thrown code getter is controlled", async () => { const r=await executeVoyagePf2ePendingCheck(check(),{resolveUuid:async()=>({}),getActorFromResolvedDocument:()=>({}),getStatistic:()=>({}),rollStatistic(){throw Object.defineProperty({},"code",{get(){throw Error();}});}});assert.equal(r.errors[0].code,"voyage-pf2e-roll-failed"); });
test("unsafe identity is omitted from execution dependency failures", async () => {const r=await executeVoyagePf2ePendingCheck(check({pendingCheckId:"prototype",sequence:-1}),{});assert.equal("pendingCheckId" in r,false);assert.equal("sequence" in r,false);});
test("inherited rollStatistic is rejected",async()=>{const base={rollStatistic:()=>({})};const deps=Object.create(base);Object.assign(deps,{resolveUuid:async()=>({}),getActorFromResolvedDocument:()=>({}),getStatistic:()=>({})});assert.equal(validateVoyagePf2eExecutionDependencies(deps).valid,false);});
test("non-function rollStatistic is rejected",()=>assert.equal(validateVoyagePf2eExecutionDependencies({resolveUuid(){},getActorFromResolvedDocument(){},getStatistic(){},rollStatistic:true}).valid,false));
test("null and primitive roll results are blocked",async()=>{for(const rollStatistic of [()=>null,()=>undefined,()=>1]){const r=await executeVoyagePf2ePendingCheck(check(),{resolveUuid:async()=>({}),getActorFromResolvedDocument:()=>({}),getStatistic:()=>({}),rollStatistic});assert.equal(r.ok,false);}});
test("roll fields are read once",async()=>{let total=0,degree=0;const roll={get total(){total++;return 1;},get degreeOfSuccess(){degree++;return 2;}};await executeVoyagePf2ePendingCheck(check(),{resolveUuid:async()=>({}),getActorFromResolvedDocument:()=>({}),getStatistic:()=>({}),rollStatistic:()=>roll});assert.equal(total,1);assert.equal(degree,1);});
test("preflight failure prevents rolling",async()=>{let calls=0;const r=await executeVoyagePf2ePendingCheck(check({status:"resolved"}),{resolveUuid:async()=>({}),getActorFromResolvedDocument:()=>({}),getStatistic:()=>({}),rollStatistic(){calls++;}});assert.equal(r.ok,false);assert.equal(calls,0);});
const good=(over={})=>({resolveUuid:async()=>({doc:true}),getActorFromResolvedDocument:()=>({actor:true}),getStatistic:()=>({stat:true}),rollStatistic:()=>({total:1,degreeOfSuccess:2}),...over});
test("throwing rollStatistic getter is controlled",()=>{const d=good();Object.defineProperty(d,"rollStatistic",{get(){throw Error();}});assert.equal(validateVoyagePf2eExecutionDependencies(d).valid,false);});
test("second-read-throwing rollStatistic getter is read once",async()=>{let n=0;const d=good();Object.defineProperty(d,"rollStatistic",{get(){if(++n>1)throw Error();return()=>({total:1,degreeOfSuccess:2});}});assert.equal((await executeVoyagePf2ePendingCheck(check(),d)).ok,true);assert.equal(n,1);});
test("changing rollStatistic getter uses first function",async()=>{let n=0;const d=good();Object.defineProperty(d,"rollStatistic",{get(){n++;return n===1?()=>({total:1,degreeOfSuccess:2}):()=>{throw Error();};}});assert.equal((await executeVoyagePf2ePendingCheck(check(),d)).ok,true);});
test("execution dependency Proxy ownness failure is controlled",()=>assert.equal(validateVoyagePf2eExecutionDependencies(new Proxy({}, {getOwnPropertyDescriptor(){throw Error();}})).valid,false));
test("execution dependency validation never throws",()=>assert.doesNotThrow(()=>validateVoyagePf2eExecutionDependencies(new Proxy({}, {getOwnPropertyDescriptor(){throw Error();}}))));
test("rejected roll becomes roll failed",async()=>assert.equal((await executeVoyagePf2ePendingCheck(check(),good({rollStatistic:()=>Promise.reject(Error())}))).errors[0].code,"voyage-pf2e-roll-failed"));
test("synchronous roll exception becomes roll failed",async()=>assert.equal((await executeVoyagePf2ePendingCheck(check(),good({rollStatistic(){throw Error();}}))).errors[0].code,"voyage-pf2e-roll-failed"));
test("exact unavailable roll code is retained",async()=>assert.equal((await executeVoyagePf2ePendingCheck(check(),good({rollStatistic(){const e=Error();e.code="voyage-pf2e-statistic-roll-unavailable";throw e;}}))).errors[0].code,"voyage-pf2e-statistic-roll-unavailable"));
for(const [name,roll] of [["missing roll total",{degreeOfSuccess:2}],["NaN total",{total:NaN,degreeOfSuccess:2}],["infinite total",{total:Infinity,degreeOfSuccess:2}],["missing degree",{total:1}],["fractional degree",{total:1,degreeOfSuccess:1.5}],["negative degree",{total:1,degreeOfSuccess:-1}],["degree above three",{total:1,degreeOfSuccess:4}]])test(`${name} is invalid`,async()=>assert.equal((await executeVoyagePf2ePendingCheck(check(),good({rollStatistic:()=>roll}))).errors[0].code,"voyage-pf2e-invalid-roll-result"));
test("throwing total getter is controlled",async()=>{const r={degreeOfSuccess:2};Object.defineProperty(r,"total",{get(){throw Error();}});assert.equal((await executeVoyagePf2ePendingCheck(check(),good({rollStatistic:()=>r}))).ok,false);});
test("throwing degree getter is controlled",async()=>{const r={total:1};Object.defineProperty(r,"degreeOfSuccess",{get(){throw Error();}});assert.equal((await executeVoyagePf2ePendingCheck(check(),good({rollStatistic:()=>r}))).ok,false);});
test("the exact selected statistic is attempted once without fallback",async()=>{const got=[];const result=await executeVoyagePf2ePendingCheck(check(),good({getStatistic(_,s){got.push(s);return s==="perception"?{}:null;}}));assert.equal(result.ok,false);assert.deepEqual(got,["athletics"]);});
test("pending input remains unchanged after success and failure",async()=>{const a=check(),b=check();const before=JSON.stringify(a);await executeVoyagePf2ePendingCheck(a,good());await executeVoyagePf2ePendingCheck(b,good({rollStatistic:()=>null}));assert.equal(JSON.stringify(a),before);assert.equal(b.status,"pending");});
test("valid blocked identity is retained and hostile identity is controlled",async()=>{const goodId=await executeVoyagePf2ePendingCheck(check({pendingCheckId:"id",sequence:2}),{});assert.equal(goodId.pendingCheckId,"id");const hostile=check();Object.defineProperty(hostile,"pendingCheckId",{get(){throw Error();}});assert.doesNotThrow(()=>executeVoyagePf2ePendingCheck(hostile,{}));});
test("executor preserves PF2e public and blind message modes without legacy modes", async()=>{for(const [secrecy,mode] of [["public","public"],["secret","blind"]]){let parameters;const r=await executeVoyagePf2ePendingCheck(check({secrecy}),good({rollStatistic(_,p){parameters=p;if(!new Set(["public","gm","blind","self"]).has(p.messageMode))throw Error("invalid mode");return {total:1,degreeOfSuccess:2};}}));assert.equal(r.rollMode,mode);assert.equal(parameters.messageMode,mode);assert.notEqual(parameters.messageMode,"publicroll");assert.notEqual(parameters.messageMode,"blindroll");}});

test("finalDc reaches the one PF2e roll without repeated arithmetic", async () => {
  let lookupCount = 0;
  let rollCount = 0;
  let parameters;
  const result = await executeVoyagePf2ePendingCheck(
    check({
      finalDc: 28,
      baseDc: 20,
      actionDcAdjustment: -3,
      upgradeDcReduction: 4,
      riskBidDcAdjustment: 8,
      dcAdjustment: 8
    }),
    good({
      getStatistic(_actor, slug) {
        lookupCount += 1;
        assert.equal(slug, "athletics");
        return {};
      },
      rollStatistic(_statistic, supplied) {
        rollCount += 1;
        parameters = supplied;
        return { total: 28, degreeOfSuccess: 2 };
      }
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.dc, 28);
  assert.equal(result.statisticSlug, "athletics");
  assert.equal(parameters.dc, 28);
  assert.equal(lookupCount, 1);
  assert.equal(rollCount, 1);
});

test("cancellation returns no result and never retries", async () => {
  let lookupCount = 0;
  let rollCount = 0;
  const result = await executeVoyagePf2ePendingCheck(
    check(),
    good({
      getStatistic() {
        lookupCount += 1;
        return {};
      },
      rollStatistic() {
        rollCount += 1;
        return null;
      }
    })
  );
  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.errors[0].code, "voyage-pf2e-roll-cancelled");
  assert.equal(Object.hasOwn(result, "result"), false);
  assert.equal(lookupCount, 1);
  assert.equal(rollCount, 1);
});

test("no-roll input performs neither statistic lookup nor PF2e roll", async () => {
  let lookupCount = 0;
  let rollCount = 0;
  const result = await executeVoyagePf2ePendingCheck(
    check({ mode: "no-roll" }),
    good({
      getStatistic() {
        lookupCount += 1;
        return {};
      },
      rollStatistic() {
        rollCount += 1;
        return { total: 1, degreeOfSuccess: 2 };
      }
    })
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "voyage-pf2e-invalid-check-mode");
  assert.equal(lookupCount, 0);
  assert.equal(rollCount, 0);
});
