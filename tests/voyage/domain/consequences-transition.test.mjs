import assert from "node:assert/strict";
import test from "node:test";
import { applyVoyageEncounterConsequencesTransition } from "../../../scripts/voyage/domain/consequences-transition.js";
import { applyVoyageEncounterPendingCheckResult } from "../../../scripts/voyage/domain/resolution-results.js";
import { applyVoyageEncounterPendingCheckPreparation } from "../../../scripts/voyage/domain/pending-checks.js";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
test("incomplete Resolution transition is atomic",()=>{const x=createVoyageEncounterState({encounterId:"e",definitionId:"d",primaryShip:{id:"s"}});Object.assign(x,{lifecycleState:"active",currentStage:{stageId:"s"},roundNumber:1,phase:"resolution",availableStations:[],selections:{}});const out=applyVoyageEncounterConsequencesTransition(x,{phaseStartSnapshotId:"c"});assert.equal(out.ok,true);assert.equal(out.nextState.phase,"consequences");assert.equal(out.nextState.snapshots.at(-1).boundaryType,"phase-start");});
