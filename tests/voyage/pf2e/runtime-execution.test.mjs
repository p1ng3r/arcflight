import assert from "node:assert/strict"; import test from "node:test";
import {
  createVoyagePf2eRuntimeExecutionDependencies,
  executeVoyagePf2ePendingCheckInFoundry
} from "../../../scripts/voyage/pf2e/runtime-execution.js";
const pending={pendingCheckId:"live-1",sequence:0,status:"pending",mode:"check",source:{kind:"character",uuid:"Actor.live"},approachId:"athletics-approach",statisticSlugOrAbilityId:"athletics",finalDc:15,momentumRollBonus:0,secrecy:"secret"};
test("runtime captures and calls Statistic.roll once",async()=>{let calls=0, receiver;const statistic={roll(p){calls++;receiver=this;assert.equal(p.messageMode,"blind");return {total:16,degreeOfSuccess:2};}};const actor={documentName:"Actor",getStatistic:()=>statistic};const runtime={game:{system:{id:"pf2e"}},fromUuid:async uuid=>{assert.equal(uuid,"Actor.live");return actor;}};const result=await executeVoyagePf2ePendingCheckInFoundry(pending,runtime);assert.equal(result.status,"rolled");assert.equal(calls,1);assert.equal(receiver,statistic);});
test("zero Momentum passes no modifier to Statistic.roll", async () => {
  let rolls = 0;
  let constructors = 0;
  let parameters;
  class Modifier {
    constructor() {
      constructors += 1;
    }
  }
  const statistic = {
    roll(value) {
      rolls += 1;
      parameters = value;
      return { total: 15, degreeOfSuccess: 2 };
    }
  };
  const runtime = {
    game: { system: { id: "pf2e" }, pf2e: { Modifier } },
    fromUuid: async () => ({ documentName: "Actor", getStatistic: () => statistic })
  };
  const result = await executeVoyagePf2ePendingCheckInFoundry(pending, runtime);
  assert.equal(result.ok, true);
  assert.equal(rolls, 1);
  assert.equal(constructors, 0);
  assert.equal(Object.hasOwn(parameters, "modifiers"), false);
  assert.equal(Object.hasOwn(parameters, "momentumRollBonus"), false);
});
test("positive Momentum constructs exactly one PF2e Modifier and preserves finalDc", async () => {
  let rolls = 0;
  let constructors = 0;
  let constructorArguments;
  let parameters;
  class Modifier {
    constructor(value) {
      constructors += 1;
      constructorArguments = value;
    }
  }
  const statistic = {
    roll(value) {
      rolls += 1;
      parameters = value;
      return { total: 17, degreeOfSuccess: 2 };
    }
  };
  const runtime = {
    game: { system: { id: "pf2e" }, pf2e: { Modifier } },
    fromUuid: async () => ({ documentName: "Actor", getStatistic: () => statistic })
  };
  const result = await executeVoyagePf2ePendingCheckInFoundry(
    { ...pending, finalDc: 28, momentumRollBonus: 3 },
    runtime
  );
  assert.equal(result.ok, true);
  assert.equal(rolls, 1);
  assert.equal(constructors, 1);
  assert.deepEqual(constructorArguments, {
    slug: "arcflight-momentum",
    label: "Arcflight Momentum",
    modifier: 3,
    type: "untyped"
  });
  assert.equal(parameters.dc, 28);
  assert.equal(parameters.momentumRollBonus, undefined);
  assert.equal(parameters.modifiers.length, 1);
});
test("positive Momentum appends to existing modifiers without mutating caller data", () => {
  let rolls = 0;
  let constructors = 0;
  let received;
  let momentumModifier;
  class Modifier {
    constructor(value) {
      constructors += 1;
      momentumModifier = this;
      assert.deepEqual(value, {
        slug: "arcflight-momentum",
        label: "Arcflight Momentum",
        modifier: 2,
        type: "untyped"
      });
    }
  }
  const first = { slug: "existing-first" };
  const second = { slug: "existing-second" };
  const existingModifiers = [first, second];
  const parameters = {
    dc: 31,
    momentumRollBonus: 2,
    modifiers: existingModifiers
  };
  const statistic = {
    roll(value) {
      rolls += 1;
      received = value;
      return { total: 31, degreeOfSuccess: 2 };
    }
  };
  const dependencies = createVoyagePf2eRuntimeExecutionDependencies({
    game: { pf2e: { Modifier } }
  });

  dependencies.rollStatistic(statistic, parameters);

  assert.equal(rolls, 1);
  assert.equal(constructors, 1);
  assert.notEqual(received, parameters);
  assert.equal(received.dc, 31);
  assert.equal(Object.hasOwn(received, "momentumRollBonus"), false);
  assert.deepEqual(received.modifiers, [first, second, momentumModifier]);
  assert.equal(received.modifiers[0], first);
  assert.equal(received.modifiers[1], second);
  assert.equal(received.modifiers[2], momentumModifier);
  assert.equal(parameters.dc, 31);
  assert.equal(parameters.momentumRollBonus, 2);
  assert.equal(parameters.modifiers, existingModifiers);
  assert.deepEqual(existingModifiers, [first, second]);
});
test("aggregated Focus modifier accepts +5 and rolls exactly once", async () => {
  let rolls = 0; let focusModifier;
  class Modifier { constructor(value) { if (value.slug === "arcflight-focus") focusModifier = value.modifier; } }
  const statistic = { roll(value) { rolls += 1; return { total: 20, degreeOfSuccess: 2 }; } };
  const runtime = { game: { system: { id: "pf2e" }, pf2e: { Modifier } }, fromUuid: async () => ({ documentName: "Actor", getStatistic: () => statistic }) };
  const result = await executeVoyagePf2ePendingCheckInFoundry({ ...pending, focusModifier: 5 }, runtime);
  assert.equal(result.ok, true); assert.equal(focusModifier, 5); assert.equal(rolls, 1);
});
test("Momentum plus aggregated Focus preserves Momentum and caps total at +5", async () => {
  let rolls = 0; const modifiers = [];
  class Modifier { constructor(value) { modifiers.push(value); } }
  const statistic = { roll(value) { rolls += 1; return { total: 20, degreeOfSuccess: 2 }; } };
  const runtime = { game: { system: { id: "pf2e" }, pf2e: { Modifier } }, fromUuid: async () => ({ documentName: "Actor", getStatistic: () => statistic }) };
  const result = await executeVoyagePf2ePendingCheckInFoundry({ ...pending, momentumRollBonus: 3, focusModifier: 2 }, runtime);
  assert.equal(result.ok, true); assert.deepEqual(modifiers.map((entry) => [entry.slug, entry.modifier]), [["arcflight-momentum", 3], ["arcflight-focus", 2]]); assert.equal(rolls, 1);
});
test("non-array supplied modifiers block before Statistic.roll", () => {
  let rolls = 0;
  class Modifier {}
  const statistic = {
    roll() {
      rolls += 1;
    }
  };
  const dependencies = createVoyagePf2eRuntimeExecutionDependencies({
    game: { pf2e: { Modifier } }
  });

  assert.throws(
    () => dependencies.rollStatistic(statistic, {
      dc: 20,
      momentumRollBonus: 1,
      modifiers: { invalid: true }
    }),
    (error) => {
      assert.equal(error.code, "voyage-pf2e-invalid-momentum-roll-bonus");
      return true;
    }
  );
  assert.equal(rolls, 0);
});
test("positive Momentum blocks cleanly when the Modifier constructor is missing", async () => {
  let rolls = 0;
  const statistic = {
    roll() {
      rolls += 1;
      return { total: 17, degreeOfSuccess: 2 };
    }
  };
  const runtime = {
    game: { system: { id: "pf2e" } },
    fromUuid: async () => ({ documentName: "Actor", getStatistic: () => statistic })
  };
  const result = await executeVoyagePf2ePendingCheckInFoundry(
    { ...pending, momentumRollBonus: 1 },
    runtime
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "voyage-pf2e-momentum-modifier-unavailable");
  assert.equal(rolls, 0);
});
test("Risk Bid Momentum still performs exactly one Statistic.roll", async () => {
  let rolls = 0;
  let constructors = 0;
  class Modifier {
    constructor(value) {
      constructors += 1;
      assert.equal(value.modifier, 2);
    }
  }
  const statistic = {
    roll(value) {
      rolls += 1;
      assert.equal(value.dc, 23);
      return { total: 23, degreeOfSuccess: 2 };
    }
  };
  const runtime = {
    game: { system: { id: "pf2e" }, pf2e: { Modifier } },
    fromUuid: async () => ({ documentName: "Actor", getStatistic: () => statistic })
  };
  const result = await executeVoyagePf2ePendingCheckInFoundry(
    {
      ...pending,
      finalDc: 23,
      momentumRollBonus: 2,
      riskBidId: "bid-8",
      dcAdjustment: 8
    },
    runtime
  );
  assert.equal(result.ok, true);
  assert.equal(rolls, 1);
  assert.equal(constructors, 1);
});
test("no-roll actions perform neither lookup nor roll nor Momentum construction", async () => {
  let lookups = 0;
  let rolls = 0;
  let constructors = 0;
  class Modifier {
    constructor() {
      constructors += 1;
    }
  }
  const result = await executeVoyagePf2ePendingCheckInFoundry(
    { ...pending, mode: "no-roll", momentumRollBonus: 3 },
    {
      game: { system: { id: "pf2e" }, pf2e: { Modifier } },
      fromUuid: async () => {
        lookups += 1;
        return {
          documentName: "Actor",
          getStatistic: () => {
            lookups += 1;
            return {
              roll() {
                rolls += 1;
              }
            };
          }
        };
      }
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "voyage-pf2e-invalid-check-mode");
  assert.equal(lookups, 0);
  assert.equal(rolls, 0);
  assert.equal(constructors, 0);
});
test("wrong runtime never rolls",async()=>{const r=await executeVoyagePf2ePendingCheckInFoundry(pending,{game:{system:{id:"other"}},fromUuid(){throw Error();}});assert.equal(r.errors[0].code,"voyage-pf2e-system-mismatch");});
test("resolver keeps original runtime receiver and reads getter once", async()=>{let reads=0,receiver,calls=0;const stat={roll(){return {total:1,degreeOfSuccess:2};}};const rt={game:{system:{id:"pf2e"}},get fromUuid(){reads++;return function(){receiver=this;calls++;return {documentName:"Actor",getStatistic:()=>stat};};}};await executeVoyagePf2ePendingCheckInFoundry(pending,rt);assert.equal(reads,1);assert.equal(receiver,rt);assert.equal(calls,1);});
test("runtime blocked identity rejects unsafe IDs and negative sequences",async()=>{for(const id of ["__proto__","constructor","prototype","   "]){const r=await executeVoyagePf2ePendingCheckInFoundry({...pending,pendingCheckId:id,sequence:-1},{});assert.equal(Object.hasOwn(r,"pendingCheckId"),false);assert.equal(Object.hasOwn(r,"sequence"),false);}});
test("runtime blocked identity retains valid values",async()=>{const r=await executeVoyagePf2ePendingCheckInFoundry({...pending,pendingCheckId:"valid",sequence:1},{});assert.equal(r.pendingCheckId,"valid");assert.equal(r.sequence,1);});
test("missing resolver blocks before a roll",async()=>{const r=await executeVoyagePf2ePendingCheckInFoundry(pending,{game:{system:{id:"pf2e"}}});assert.equal(r.errors[0].code,"voyage-pf2e-uuid-resolver-unavailable");});
test("public mode reaches PF2e unchanged",async()=>{let mode;const stat={roll(p){mode=p.messageMode;return{total:1,degreeOfSuccess:2};}};await executeVoyagePf2ePendingCheckInFoundry({...pending,secrecy:"public"},{game:{system:{id:"pf2e"}},fromUuid:async()=>({documentName:"Actor",getStatistic:()=>stat})});assert.equal(mode,"public");});
const rt=(actor)=>({game:{system:{id:"pf2e"}},fromUuid:async()=>actor}); const actorFor=(stat)=>({documentName:"Actor",getStatistic:()=>stat});
test("throwing resolver getter is controlled",async()=>{const r=await executeVoyagePf2ePendingCheckInFoundry(pending,{game:{system:{id:"pf2e"}},get fromUuid(){throw Error();}});assert.equal(r.errors[0].code,"voyage-pf2e-uuid-resolver-unavailable");});
test("second-read-throwing resolver getter succeeds",async()=>{let n=0;const stat={roll:()=>({total:1,degreeOfSuccess:2})};const r={game:{system:{id:"pf2e"}},get fromUuid(){if(++n>1)throw Error();return async()=>actorFor(stat);}};assert.equal((await executeVoyagePf2ePendingCheckInFoundry(pending,r)).ok,true);assert.equal(n,1);});
test("authored UUID and one resolver call are preserved",async()=>{let uuid,calls=0;const stat={roll:()=>({total:1,degreeOfSuccess:2})};await executeVoyagePf2ePendingCheckInFoundry(pending,{game:{system:{id:"pf2e"}},fromUuid:async x=>{uuid=x;calls++;return actorFor(stat);}});assert.equal(uuid,"Actor.live");assert.equal(calls,1);});
test("throwing statistic roll getter is unavailable",async()=>{const stat={};Object.defineProperty(stat,"roll",{get(){throw Error();}});const r=await executeVoyagePf2ePendingCheckInFoundry(pending,rt(actorFor(stat)));assert.equal(r.errors[0].code,"voyage-pf2e-statistic-roll-unavailable");});
test("second-read-throwing roll getter succeeds with exact receiver",async()=>{let n=0,receiver;const stat={get roll(){if(++n>1)throw Error();return function(){receiver=this;return{total:1,degreeOfSuccess:2};};}};assert.equal((await executeVoyagePf2ePendingCheckInFoundry(pending,rt(actorFor(stat)))).ok,true);assert.equal(n,1);assert.equal(receiver,stat);});
test("roll parameters include dialog message and identifier values",async()=>{let p;const stat={roll(x){p=x;return{total:1,degreeOfSuccess:2};}};await executeVoyagePf2ePendingCheckInFoundry({...pending,secrecy:"public"},rt(actorFor(stat)));assert.equal(p.messageMode,"public");assert.equal(p.skipDialog,true);assert.equal(p.createMessage,true);assert.equal(p.identifier,"live-1");});
test("wrong system performs no UUID resolution",async()=>{let calls=0;await executeVoyagePf2ePendingCheckInFoundry(pending,{game:{system:{id:"wrong"}},fromUuid(){calls++;}});assert.equal(calls,0);});
test("unknown statistic performs no roll",async()=>{let calls=0;const r=await executeVoyagePf2ePendingCheckInFoundry(pending,rt({documentName:"Actor",getStatistic:()=>null,roll(){calls++;}}));assert.equal(r.ok,false);assert.equal(calls,0);});
test("TokenDocument-like resolution succeeds",async()=>{const stat={roll:()=>({total:1,degreeOfSuccess:2})};assert.equal((await executeVoyagePf2ePendingCheckInFoundry(pending,rt({actor:{getStatistic:()=>stat}}))).ok,true);});
test("pending input remains unchanged after runtime execution",async()=>{const value={...pending,source:{...pending.source}};const before=JSON.stringify(value);await executeVoyagePf2ePendingCheckInFoundry(value,rt(actorFor({roll:()=>({total:1,degreeOfSuccess:2})})));assert.equal(JSON.stringify(value),before);});
test("hostile runtime identity getters and Proxy ownness are controlled without getter invocation",async()=>{let reads=0;const value={};Object.defineProperty(value,"pendingCheckId",{get(){reads++;throw Error();}});assert.doesNotThrow(()=>executeVoyagePf2ePendingCheckInFoundry(value,{}));assert.equal(reads,0);const p=new Proxy({}, {getOwnPropertyDescriptor(){throw Error();}});assert.doesNotThrow(()=>executeVoyagePf2ePendingCheckInFoundry(p,{}));});
test("runtime accepts only current PF2e message modes for public and secret checks",async()=>{for(const [secrecy,mode] of [["public","public"],["secret","blind"]]){const stat={roll(p){if(!new Set(["public","gm","blind","self"]).has(p.messageMode))throw Error("invalid mode");assert.equal(p.messageMode,mode);return {total:1,degreeOfSuccess:2};}};const result=await executeVoyagePf2ePendingCheckInFoundry({...pending,secrecy},rt(actorFor(stat)));assert.equal(result.ok,true);assert.equal(result.rollMode,mode);}});
