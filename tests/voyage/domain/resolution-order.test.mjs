import assert from "node:assert/strict"; import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { prepareVoyageEncounterResolutionOrder } from "../../../scripts/voyage/domain/resolution-order.js";
function state(){const s=createVoyageEncounterState({encounterId:"e",definitionId:"d",primaryShip:{id:"s"},lifecycleState:"active",currentStage:{stageId:"x"},roundNumber:1,phase:"lock-readiness"});s.lifecycleState="active";s.currentStage={stageId:"x"};s.roundNumber=1;s.phase="lock-readiness";s.availableStations=[{stationId:"b",actions:[{actionId:"two",resolutionPriority:3}]},{stationId:"a",actions:[{actionId:"one",resolutionPriority:-1}]}];s.selections={b:{stationId:"b",actionId:"two"},a:{stationId:"a",actionId:"one"}};return s;}
test("orders selected locked actions by authored priority",()=>{const r=prepareVoyageEncounterResolutionOrder(state());assert.equal(r.readyForResolution,true);assert.deepEqual(r.orderedActions.map(x=>x.actionId),["one","two"]);assert.equal(r.orderedActions[0].riskBidId,null);});
test("rejects invalid supplied priority even when unselected",()=>{const s=state();s.availableStations[0].actions.push({actionId:"bad",resolutionPriority:null});assert.equal(prepareVoyageEncounterResolutionOrder(s).readyForResolution,false);});

test("station optionality requires an own false marker", () => {
  for (const [value, own, expected] of [[undefined, false, false], [true, true, false], [false, true, true], [false, false, false], [true, false, false]]) {
    const s = state(); s.availableStations = [{ stationId: "optional", actions: [], ...(own ? { selectionRequired: value } : {}) }]; s.selections = {};
    if (!own) Object.setPrototypeOf(s.availableStations[0], { selectionRequired: value });
    const report = prepareVoyageEncounterResolutionOrder(s);
    assert.equal(report.readyForResolution, expected);
  }
});

test("ignores inherited numeric station and action entries", () => {
  const s = state(); s.availableStations = []; Object.setPrototypeOf(s.availableStations, Object.assign(Object.create(Array.prototype), { 0: { stationId: "ghost", actions: [{ actionId: "ghost-action" }] } }));
  s.selections = {}; assert.equal(prepareVoyageEncounterResolutionOrder(s).readyForResolution, true);
  const actions = []; Object.setPrototypeOf(actions, Object.assign(Object.create(Array.prototype), { 0: { actionId: "ghost" } }));
  s.availableStations = [{ stationId: "a", selectionRequired: false, actions }]; assert.equal(prepareVoyageEncounterResolutionOrder(s).readyForResolution, true);
});

test("keeps structural validity separate and reports context alongside plan errors", () => {
  const s = state(); s.lifecycleState = "paused"; s.phase = "situation"; s.availableStations[0].actions[0].resolutionPriority = null;
  const report = prepareVoyageEncounterResolutionOrder(s); assert.equal(report.structurallyValid, true); assert.equal(report.readyForResolution, false);
  assert.deepEqual(report.errors.map((entry) => entry.code), ["invalid-resolution-priority", "resolution-order-requires-active", "resolution-order-requires-lock-readiness"]);
});
