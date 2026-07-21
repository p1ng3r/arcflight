import { createVoyageEncounterBoundarySnapshot } from "./boundary-snapshots.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES, VOYAGE_ROUND_PHASES } from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyagePhaseTransition } from "./phase.js";
import { validateVoyageEncounterState } from "./validation.js";
import { analyzeVoyageEncounterResolutionOrder, prepareVoyageEncounterResolutionOrder } from "./resolution-order.js";
const error=(code,path,message)=>({code,path,message,severity:"error"}); const failure=(errors,warnings)=>({ok:false,nextState:null,events:[],errors,warnings});
export function applyVoyageEncounterResolutionTransition(state, request) {
 const structural=validateVoyageEncounterState(state); if(!structural.valid)return failure(structural.errors,[...structural.warnings]);
 if(state.lifecycleState!==VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE)return failure([error("resolution-transition-requires-active","lifecycleState","Entering Resolution requires an Active Voyage encounter.")],[...structural.warnings]);
 const phase=validateVoyagePhaseTransition(state.phase,VOYAGE_ROUND_PHASES.RESOLUTION); if(!phase.valid)return failure(phase.errors,[...structural.warnings,...phase.warnings]);
 const report=prepareVoyageEncounterResolutionOrder(state); if(!report.readyForResolution)return failure(report.errors,[...structural.warnings,...report.warnings]);
 if(state.pendingChecks.length)return failure([error("resolution-transition-pending-checks-not-empty","pendingChecks","Entering Resolution requires empty pendingChecks.")],[...structural.warnings,...report.warnings]);
 if(!isPlainObject(request))return failure([error("invalid-resolution-transition-request","transitionRequest","Resolution transition request must be a plain object.")],[...structural.warnings]);
 if(typeof request.phaseStartSnapshotId!=="string"||!request.phaseStartSnapshotId.trim())return failure([error("invalid-phase-start-snapshot-id","transitionRequest.phaseStartSnapshotId","Entering Resolution requires a non-empty phase-start snapshot ID.")],[...structural.warnings]);
 if(state.snapshots.some((s)=>s?.snapshotId===request.phaseStartSnapshotId))return failure([error("phase-start-snapshot-id-already-exists","transitionRequest.phaseStartSnapshotId","Resolution phase-start snapshot ID already exists in encounter snapshots.")],[...structural.warnings]);
 let candidate; try {candidate=clonePlainData(state);} catch {return failure([error("resolution-candidate-construction-failed","encounterState","Resolution transition could not clone encounter state.")],[...structural.warnings]);}
 candidate.phase=VOYAGE_ROUND_PHASES.RESOLUTION; let snap; try {snap=createVoyageEncounterBoundarySnapshot(candidate,{snapshotId:request.phaseStartSnapshotId,boundaryType:"phase-start"});} catch{return failure([error("resolution-phase-start-snapshot-construction-failed","phaseStartSnapshot","Resolution transition could not construct the phase-start snapshot.")],[...structural.warnings]);}
 if(!snap.ok)return failure(snap.errors,[...structural.warnings,...snap.warnings]); candidate.snapshots.push(snap.snapshot);candidate.revision=state.revision+1;
 const final=validateVoyageEncounterState(candidate); const order=analyzeVoyageEncounterResolutionOrder(candidate); if(!final.valid||!order.valid)return failure([...final.errors,...order.errors],[...structural.warnings,...snap.warnings,...final.warnings,...order.warnings]);
 const orderedActions=order.orderedActions.map((action)=>({...action})); return {ok:true,nextState:candidate,events:[{type:"voyage.resolution-started",encounterId:candidate.encounterId,lifecycleState:candidate.lifecycleState,roundNumber:candidate.roundNumber,previousPhase:state.phase,phase:candidate.phase,orderedActions:orderedActions.map((action)=>({...action})),actionCount:orderedActions.length,previousRevision:state.revision,revision:candidate.revision,phaseStartSnapshotId:request.phaseStartSnapshotId}],errors:[],warnings:[...structural.warnings,...snap.warnings,...final.warnings,...order.warnings]};
}
