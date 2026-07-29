import assert from "node:assert/strict";
import test from "node:test";
import { createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";
import { analyzeVoyageEncounterActionOutcomeDefinitions, validateVoyageEncounterActionOutcomeDefinitions } from "../../../scripts/voyage/domain/consequence-rules.js";
import { VOYAGE_CONTROLLED_EFFECT_INTENT_TYPES as CONTROLLED, VOYAGE_EFFECT_INTENT_TYPES as INTENTS, VOYAGE_ENCOUNTER_LIFECYCLE_STATES as LIFE, VOYAGE_ROUND_PHASES as PHASES } from "../../../scripts/voyage/domain/constants.js";
import { VOYAGE_CONTROLLED_EFFECT_INTENT_CONTRACTS as CONTROLLED_CONTRACTS } from "../../../scripts/voyage/domain/controlled-intent-contracts.js";
function state(action = { actionId: "wait" }) { return { ...createDraftVoyageEncounterDefaults(), encounterId:"e", definitionId:"d", lifecycleState:LIFE.ACTIVE, revision:0, primaryShip:{actorId:"s"}, currentStage:{stageId:"s"}, roundNumber:1, phase:PHASES.CONSEQUENCES, availableStations:[{stationId:"captain",actions:[action]}], successConditions:[{conditionId:"x"}], failureConditions:[{conditionId:"y"}] }; }
function check() { return { source:{kind:"character",uuid:"Actor.captain"},statisticOptions:["diplomacy"],dcSource:{kind:"fixed",value:20},secrecy:"public" }; }
function checkBranches(overrides={}) { return {"critical-failure":[],failure:[],success:[],"critical-success":[],...overrides}; }
function bid(riskBidId="bid",dcAdjustment=2,outcomeOverrides={}) { return {riskBidId,dcAdjustment,outcomes:{criticalSuccess:[],success:[],failure:[],criticalFailure:[],...outcomeOverrides}}; }
test("omitted definitions normalize no-roll actions", () => { const r=analyzeVoyageEncounterActionOutcomeDefinitions(state()); assert.deepEqual(r.actions[0].branches,{"no-roll":[]}); assert.equal(r.readyForInterpretation,true); });
test("validates local rule references and warns on unreferenced rules", () => { const a={actionId:"wait",outcomeDefinition:{effectRules:[{effectId:"x",intentType:"discovery",timing:"consequences",visibility:"public",target:{kind:"encounter"},payload:{delta:1}}],branches:{"no-roll":[]}}}; const r=validateVoyageEncounterActionOutcomeDefinitions(state(a)); assert.equal(r.valid,true); assert.equal(r.warnings[0].code,"unreferenced-effect-rule"); });
test("rejects unsafe payload values", () => { const a={actionId:"wait",outcomeDefinition:{effectRules:[{effectId:"x",intentType:"discovery",timing:"consequences",visibility:"public",target:{kind:"encounter"},payload:{bad:undefined}}],branches:{"no-roll":[]}}}; assert.equal(validateVoyageEncounterActionOutcomeDefinitions(state(a)).valid,false); });
test("counts actual sparse action paths and preserves validity invariant", () => { const a={actionId:"a"}; const b={actionId:"b",outcomeDefinition:{effectRules:"bad",branches:{"no-roll":[]}}}; const actions=[a,,b]; const s=state(a); s.availableStations=[{stationId:"one",actions},{stationId:"two",actions:[{actionId:"c"}]}]; const r=analyzeVoyageEncounterActionOutcomeDefinitions(s); assert.equal(r.actionCount,3); assert.equal(r.validActionCount,2); assert.equal(r.invalidActionCount,1); assert.equal(r.validActionCount+r.invalidActionCount,r.actionCount); });
test("isolates targets payloads normal branches and canonical Risk Bid branches", () => { const action={actionId:"x",check:check(),outcomeDefinition:{effectRules:[{effectId:"e",intentType:"track-change",timing:"consequences",visibility:"public",target:{kind:"track",targetId:"p"},payload:{n:1}}],branches:checkBranches({success:["e"]})},riskBidOptions:[bid("r",2,{criticalSuccess:["e"]})]}; const s=state(action); const r=analyzeVoyageEncounterActionOutcomeDefinitions(s); assert.equal(r.definitionsValid,true); r.actions[0].effectRules[0].target.targetId="x"; r.actions[0].effectRules[0].payload.n=9; r.actions[0].branches.success[0]="x"; r.actions[0].riskBidOptions[0].outcomes.criticalSuccess[0]="x"; assert.equal(action.outcomeDefinition.effectRules[0].target.targetId,"p"); assert.equal(action.outcomeDefinition.effectRules[0].payload.n,1); assert.equal(action.outcomeDefinition.branches.success[0],"e"); assert.equal(action.riskBidOptions[0].outcomes.criticalSuccess[0],"e"); });
test("reports exact missing reference and warning paths", () => { const action={actionId:"x",outcomeDefinition:{effectRules:[{effectId:"unused",intentType:"discovery",timing:"consequences",visibility:"public",target:{kind:"encounter"},payload:{}}],branches:{"no-roll":["missing"]}}}; const r=analyzeVoyageEncounterActionOutcomeDefinitions(state(action)); assert.ok(r.errors.some(x=>x.path.endsWith('branches.no-roll[0]'))); assert.ok(r.warnings.some(x=>x.path.endsWith('effectRules[0].effectId'))); });
test("rejects nonenumerable and accessor exact fields without reading getters", () => { const action={actionId:"x",outcomeDefinition:{effectRules:[],branches:{"no-roll":[]}}}; Object.defineProperty(action.outcomeDefinition,"extra",{value:true}); const r=validateVoyageEncounterActionOutcomeDefinitions(state(action)); assert.equal(r.valid,false); let reads=0; const target={kind:"encounter"}; Object.defineProperty(target,"bad",{get(){reads++;throw Error();}}); action.outcomeDefinition.effectRules=[{effectId:"e",intentType:"discovery",timing:"consequences",visibility:"public",target,payload:{}}]; const q=validateVoyageEncounterActionOutcomeDefinitions(state(action)); assert.equal(reads,0); assert.ok(q.errors.some(x=>x.code==="outcome-data-read-failed"||x.code==="unexpected-effect-target-field")); });
test("validates all target shapes and rejects non-ID target IDs", () => { for (const kind of ["encounter","current-stage","primary-ship","source-station","selected-target"]) { const a={actionId:"x",outcomeDefinition:{effectRules:[{effectId:"e",intentType:"discovery",timing:"consequences",visibility:"public",target:{kind},payload:{}}],branches:{"no-roll":["e"]}}}; assert.equal(validateVoyageEncounterActionOutcomeDefinitions(state(a)).valid,true,kind); a.outcomeDefinition.effectRules[0].target.targetId="bad"; assert.ok(validateVoyageEncounterActionOutcomeDefinitions(state(a)).errors.some(x=>x.code==="unexpected-effect-target-id")); } for (const [kind,targetId] of [["track","id"],["participant","id"],["station","captain"]]) { const a={actionId:"x",outcomeDefinition:{effectRules:[{effectId:"e",intentType:"discovery",timing:"consequences",visibility:"public",target:{kind,targetId},payload:{}}],branches:{"no-roll":["e"]}}}; assert.equal(validateVoyageEncounterActionOutcomeDefinitions(state(a)).valid,true,kind); } });
test("rejects unsafe and duplicate local effect references", () => { const a={actionId:"x",outcomeDefinition:{effectRules:[{effectId:"e",intentType:"discovery",timing:"consequences",visibility:"public",target:{kind:"encounter"},payload:{}}],branches:{"no-roll":["e","e","__proto__"]}}}; const codes=validateVoyageEncounterActionOutcomeDefinitions(state(a)).errors.map(x=>x.code); assert.ok(codes.includes("duplicate-effect-reference")); assert.ok(codes.includes("unsafe-effect-reference")); });
test("rejects symbol-keyed payload fields without mutation", () => { const payload={}; const symbol=Symbol("hidden"); payload[symbol]=1; const action={actionId:"x",outcomeDefinition:{effectRules:[{effectId:"e",intentType:"discovery",timing:"consequences",visibility:"public",target:{kind:"encounter"},payload}],branches:{"no-roll":["e"]}}}; const report=validateVoyageEncounterActionOutcomeDefinitions(state(action)); assert.ok(report.errors.some(x=>x.code==="invalid-effect-payload")); assert.equal(payload[symbol],1); });
test("Risk Bid accessors are rejected without invocation", () => { const option=bid(); let reads=0; Object.defineProperty(option,"outcomes",{get(){reads++;throw Error("unsafe");}}); const action={actionId:"x",check:check(),riskBidOptions:[option]}; const report=validateVoyageEncounterActionOutcomeDefinitions(state(action)); assert.equal(reads,0); assert.ok(report.errors.some(x=>x.code==="outcome-data-read-failed"&&x.path.endsWith("riskBidOptions[0].outcomes"))); });
test("no-roll actions reject any Risk Bid without activating a branch", () => { const a={actionId:"x",riskBidOptions:[bid("a",2)]}; const r=analyzeVoyageEncounterActionOutcomeDefinitions(state(a)); assert.ok(r.errors.some(x=>x.code==="no-roll-risk-bid-options"&&x.path.endsWith("riskBidOptions"))); assert.deepEqual(r.actions[0].riskBidOptions,[]); });

test("all canonical Risk Bid references validate action-locally and suppress false unreferenced warnings", () => {
  const effectRules=["critical","success","failure","fumble"].map((effectId)=>({effectId,intentType:"discovery",timing:"consequences",visibility:"public",target:{kind:"encounter"},payload:{}}));
  const action={actionId:"x",check:check(),outcomeDefinition:{effectRules,branches:checkBranches()},riskBidOptions:[bid("all",8,{criticalSuccess:["critical"],success:["success"],failure:["failure"],criticalFailure:["fumble"]})]};
  const report=analyzeVoyageEncounterActionOutcomeDefinitions(state(action));
  assert.equal(report.definitionsValid,true);
  assert.deepEqual(report.errors,[]);
  assert.deepEqual(report.warnings,[]);
  assert.deepEqual(report.actions[0].riskBidOptions,[bid("all",8,{criticalSuccess:["critical"],success:["success"],failure:["failure"],criticalFailure:["fumble"]})]);
});

test("missing Risk Bid references retain their exact outcome branch paths", () => {
  const action={actionId:"x",check:check(),outcomeDefinition:{effectRules:[],branches:checkBranches()},riskBidOptions:[bid("missing",5,{criticalFailure:["not-local"]})]};
  const report=analyzeVoyageEncounterActionOutcomeDefinitions(state(action));
  assert.ok(report.errors.some((entry)=>entry.code==="missing-effect-reference"&&entry.path==="availableStations[0].actions[0].riskBidOptions[0].outcomes.criticalFailure[0]"));
});

test("legacy reward and danger fields are rejected by consequence analysis", () => {
  const action={actionId:"x",check:check(),riskBidOptions:[{...bid(),rewardEffectIds:[],dangerEffectIds:[]}]};
  const report=validateVoyageEncounterActionOutcomeDefinitions(state(action));
  assert.ok(report.errors.some((entry)=>entry.code==="unexpected-risk-bid-option-field"&&entry.path.endsWith(".rewardEffectIds")));
  assert.ok(report.errors.some((entry)=>entry.code==="unexpected-risk-bid-option-field"&&entry.path.endsWith(".dangerEffectIds")));
});

function targetAction(target) {
  return {
    actionId: "targeted",
    outcomeDefinition: {
      effectRules: [{
        effectId: "target-effect",
        intentType: "discovery",
        timing: "consequences",
        visibility: "public",
        target,
        payload: {}
      }],
      branches: { "no-roll": ["target-effect"] }
    }
  };
}

test("canonical station and pressure-system target IDs are exact", () => {
  for (const stationId of ["captain", "engineer", "navigator", "watchmaster", "veilwarden"]) {
    assert.equal(
      validateVoyageEncounterActionOutcomeDefinitions(
        state(targetAction({ kind: "station", targetId: stationId }))
      ).valid,
      true,
      stationId
    );
  }
  for (const pressureSystemId of ["crew-morale", "arkengine", "levstone-array", "solar-sail-rig", "lifeveil"]) {
    assert.equal(
      validateVoyageEncounterActionOutcomeDefinitions(
        state(targetAction({ kind: "pressure-system", targetId: pressureSystemId }))
      ).valid,
      true,
      pressureSystemId
    );
  }
  for (const target of [
    { kind: "station", targetId: "Navigator" },
    { kind: "station", targetId: " navigator" },
    { kind: "pressure-system", targetId: "Levstone-array" },
    { kind: "pressure-system", targetId: " levstone-array" }
  ]) {
    const report = validateVoyageEncounterActionOutcomeDefinitions(state(targetAction(target)));
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((entry) => entry.code.endsWith("target-id")));
  }
});

test("Hazard targets require safe exact IDs but do not resolve Hazard existence", () => {
  const target = { kind: "hazard", targetId: "solar-sail-fire" };
  const report = analyzeVoyageEncounterActionOutcomeDefinitions(state(targetAction(target)));
  assert.equal(report.definitionsValid, true);
  assert.deepEqual(report.actions[0].effectRules[0].target, target);

  for (const targetId of ["", "   ", "__proto__"]) {
    const invalid = validateVoyageEncounterActionOutcomeDefinitions(
      state(targetAction({ kind: "hazard", targetId }))
    );
    assert.equal(invalid.valid, false, targetId);
    assert.ok(invalid.errors.some((entry) => entry.path.endsWith(".targetId")), targetId);
  }
});

test("target contracts reject missing IDs, unexpected fields, and unknown kinds", () => {
  const fixtures = [
    [{ kind: "station" }, "missing-effect-target-id"],
    [{ kind: "pressure-system" }, "missing-effect-target-id"],
    [{ kind: "hazard" }, "missing-effect-target-id"],
    [{ kind: "encounter", targetId: "unexpected" }, "unexpected-effect-target-id"],
    [{ kind: "selected-target", extra: true }, "unexpected-effect-target-field"],
    [{ kind: "unknown", targetId: "id" }, "invalid-effect-target-kind"]
  ];
  for (const [target, code] of fixtures) {
    const report = validateVoyageEncounterActionOutcomeDefinitions(state(targetAction(target)));
    assert.equal(report.valid, false, code);
    assert.ok(report.errors.some((entry) => entry.code === code), code);
  }
});

test("target inspection contains accessors, symbols, inherited fields, and proxy failures", () => {
  {
    const target = { kind: "station", targetId: "captain" };
    let reads = 0;
    Object.defineProperty(target, "targetId", {
      enumerable: true,
      get() {
        reads += 1;
        return "captain";
      }
    });
    const report = validateVoyageEncounterActionOutcomeDefinitions(state(targetAction(target)));
    assert.equal(reads, 0);
    assert.ok(report.errors.some((entry) => entry.code === "outcome-data-read-failed"));
  }

  {
    const target = { kind: "station", targetId: "captain" };
    let reads = 0;
    Object.defineProperty(target, "kind", {
      enumerable: true,
      get() {
        reads += 1;
        return "station";
      }
    });
    const report = validateVoyageEncounterActionOutcomeDefinitions(state(targetAction(target)));
    assert.equal(reads, 0);
    assert.ok(report.errors.some((entry) => entry.code === "outcome-data-read-failed"));
  }

  {
    const target = Object.create({ targetId: "captain" });
    target.kind = "station";
    const report = validateVoyageEncounterActionOutcomeDefinitions(state(targetAction(target)));
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((entry) => entry.code === "invalid-effect-target" || entry.code === "missing-effect-target-id"));
  }

  {
    const target = { kind: "station", targetId: "captain" };
    target[Symbol("hidden")] = true;
    const report = validateVoyageEncounterActionOutcomeDefinitions(state(targetAction(target)));
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((entry) => entry.code === "unexpected-effect-target-field"));
  }

  {
    const target = new Proxy({ kind: "station", targetId: "captain" }, {
      ownKeys() {
        throw new Error("hostile ownKeys");
      }
    });
    const report = validateVoyageEncounterActionOutcomeDefinitions(state(targetAction(target)));
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((entry) => entry.code === "outcome-data-read-failed"));
  }

  {
    const target = new Proxy({ kind: "station", targetId: "captain" }, {
      getOwnPropertyDescriptor(_object, key) {
        if (key === "targetId") throw new Error("hostile descriptor");
        return Object.getOwnPropertyDescriptor({ kind: "station" }, key);
      }
    });
    const report = validateVoyageEncounterActionOutcomeDefinitions(state(targetAction(target)));
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((entry) => entry.code === "outcome-data-read-failed"));
  }
});

function controlledAction({
  intentType,
  timing = "consequences",
  target = { kind: "station", targetId: "captain" },
  payload
}) {
  return {
    actionId: "controlled",
    outcomeDefinition: {
      effectRules: [{
        effectId: "controlled-effect",
        intentType,
        timing,
        visibility: "public",
        target,
        payload
      }],
      branches: { "no-roll": ["controlled-effect"] }
    }
  };
}

test("exports the exact unique controlled intent vocabulary and preserves legacy intent IDs", () => {
  const expected = [
    "dc-change", "roll-modifier", "result-degree-shift", "reroll", "roll-twice",
    "focus-restoration", "pressure-change", "hazard-create", "hazard-remove",
    "hazard-prevent", "hazard-suppress", "station-order-change", "system-repair",
    "system-protection"
  ];
  assert.deepEqual(Object.values(CONTROLLED), expected);
  assert.equal(new Set(Object.values(CONTROLLED)).size, expected.length);
  assert.deepEqual(Object.keys(CONTROLLED_CONTRACTS), expected);
  assert.equal(INTENTS.TEMPORARY_MODIFIER, "temporary-modifier");
  assert.equal(INTENTS.DISCOVERY, "discovery");
  for (const intentType of expected) assert.equal(INTENTS[Object.keys(CONTROLLED).find((key) => CONTROLLED[key] === intentType)], intentType);
  assert.ok(Object.isFrozen(CONTROLLED));
  assert.ok(Object.isFrozen(CONTROLLED_CONTRACTS));
});

test("representative controlled contracts validate and isolate numeric enum and ID payloads", () => {
  const cases = [
    [CONTROLLED.DC_CHANGE, { kind: "station", targetId: "navigator" }, "consequences", { delta: -2 }],
    [CONTROLLED.ROLL_TWICE, { kind: "source-station" }, "consequences", { keep: "better" }],
    [CONTROLLED.HAZARD_CREATE, { kind: "pressure-system", targetId: "arkengine" }, "end-of-round", { hazardId: "arkengine-surge" }]
  ];
  for (const [intentType, target, timing, payload] of cases) {
    const source = state(controlledAction({ intentType, target, timing, payload }));
    const report = analyzeVoyageEncounterActionOutcomeDefinitions(source);
    assert.equal(report.definitionsValid, true, intentType);
    assert.deepEqual(report.actions[0].effectRules[0].payload, payload);
    report.actions[0].effectRules[0].payload[Object.keys(payload)[0]] = "changed";
    assert.notEqual(payload[Object.keys(payload)[0]], "changed");
  }
});

test("controlled contracts reject malformed payloads and incompatible target or timing exactly", () => {
  const cases = [
    [CONTROLLED.DC_CHANGE, { delta: undefined }, "controlled-intent-payload-invalid-type"],
    [CONTROLLED.DC_CHANGE, {}, "controlled-intent-payload-missing-field"],
    [CONTROLLED.DC_CHANGE, { delta: 1, extra: true }, "controlled-intent-payload-unexpected-field"],
    [CONTROLLED.DC_CHANGE, { delta: Number.POSITIVE_INFINITY }, "controlled-intent-payload-invalid-type"],
    [CONTROLLED.ROLL_TWICE, { keep: "worst" }, "controlled-intent-payload-invalid-enum"],
    [CONTROLLED.HAZARD_CREATE, { hazardId: "__proto__" }, "controlled-intent-payload-unsafe-id"]
  ];
  for (const [intentType, payload, code] of cases) {
    const report = validateVoyageEncounterActionOutcomeDefinitions(state(controlledAction({
      intentType,
      target: intentType === CONTROLLED.HAZARD_CREATE ? { kind: "pressure-system", targetId: "arkengine" } : { kind: "station", targetId: "captain" },
      payload
    })));
    assert.equal(report.valid, false, code);
    assert.ok(report.errors.some((entry) => entry.code === code), code);
  }

  const target = validateVoyageEncounterActionOutcomeDefinitions(state(controlledAction({
    intentType: CONTROLLED.HAZARD_CREATE,
    target: { kind: "hazard", targetId: "already-there" },
    payload: { hazardId: "new-hazard" }
  })));
  assert.ok(target.errors.some((entry) => entry.code === "controlled-intent-target-incompatible"));

  const timing = validateVoyageEncounterActionOutcomeDefinitions(state(controlledAction({
    intentType: CONTROLLED.ROLL_TWICE,
    timing: "end-of-round",
    payload: { keep: "better" }
  })));
  assert.ok(timing.errors.some((entry) => entry.code === "controlled-intent-timing-incompatible"));
});

test("controlled payloads reject accessors symbols inherited fields and proxy failures without mutation", () => {
  const accessor = { delta: -1 };
  let reads = 0;
  Object.defineProperty(accessor, "delta", { get() { reads += 1; return -1; } });
  const symbol = { delta: -1 };
  symbol[Symbol("hidden")] = true;
  const inherited = Object.create({ delta: -1 });
  const proxy = new Proxy({ delta: -1 }, { ownKeys() { throw new Error("hostile"); } });
  for (const payload of [accessor, symbol, inherited, proxy]) {
    const before = payload === proxy ? null : payload;
    const report = validateVoyageEncounterActionOutcomeDefinitions(state(controlledAction({ intentType: CONTROLLED.DC_CHANGE, payload })));
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((entry) => entry.code.startsWith("controlled-intent-payload-")));
    assert.equal(before === null || payload === before, true);
  }
  assert.equal(reads, 0);
});

test("all canonical controlled contracts are implemented without changing legacy payload behavior", () => {
  assert.equal(Object.values(CONTROLLED_CONTRACTS).some(({ implemented }) => !implemented), false);
  for (const [intentType, contract] of Object.entries(CONTROLLED_CONTRACTS)) {
    if (contract.implemented) continue;
    const report = analyzeVoyageEncounterActionOutcomeDefinitions(state(controlledAction({
      intentType,
      payload: { arbitrary: "not-yet-accepted" }
    })));
    assert.equal(report.definitionsValid, false, intentType);
    assert.ok(report.errors.some((entry) => entry.code === "controlled-intent-contract-not-implemented"), intentType);
    assert.equal(report.actions[0].effectRules.length, 0, intentType);
  }

  const legacy = { nested: { arbitrary: true } };
  const report = analyzeVoyageEncounterActionOutcomeDefinitions(state(controlledAction({
    intentType: INTENTS.TEMPORARY_MODIFIER,
    payload: legacy
  })));
  assert.equal(report.definitionsValid, true);
  assert.deepEqual(report.actions[0].effectRules[0].payload, legacy);
});

test("controlled-intent diagnostics and normalized output are deterministic", () => {
  const source = state(controlledAction({
    intentType: CONTROLLED.HAZARD_CREATE,
    target: { kind: "station", targetId: "captain" },
    timing: "gm-confirmed",
    payload: { unexpected: true }
  }));
  const before = structuredClone(source);
  const first = analyzeVoyageEncounterActionOutcomeDefinitions(source);
  const second = analyzeVoyageEncounterActionOutcomeDefinitions(source);
  assert.deepEqual(first, second);
  assert.deepEqual(source, before);
  assert.deepEqual(first.errors.map((entry) => entry.code), [
    "controlled-intent-target-incompatible",
    "controlled-intent-timing-incompatible",
    "controlled-intent-payload-unexpected-field",
    "controlled-intent-payload-missing-field"
  ]);
});
