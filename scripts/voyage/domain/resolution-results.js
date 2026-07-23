import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as LIFE, VOYAGE_ROUND_PHASES as PHASES, VOYAGE_PENDING_CHECK_STATUSES as STATUSES } from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyageEncounterState } from "./validation.js";
import { validateVoyageEncounterPendingChecks } from "./pending-checks.js";
import { deduplicateVoyageResolutionIssues } from "./resolution-order.js";
const error=(code,path,message)=>({code,path,message,severity:"error"});
const fail=(errors,warnings=[])=>({ok:false,nextState:null,events:[],errors:deduplicateVoyageResolutionIssues(errors),warnings:deduplicateVoyageResolutionIssues(warnings)});
const ownKeys=(o, keys)=>isPlainObject(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
function validInput(value) {
  const keys=["ok","status","pendingCheckId","sequence","sourceKind","sourceUuid","statisticSlug","dc","rollMode","result","errors","warnings"];
  if(!ownKeys(value,keys)||value.ok!==true||value.status!=="rolled"||value.sourceKind!=="character"||typeof value.pendingCheckId!=="string"||typeof value.sourceUuid!=="string"||typeof value.statisticSlug!=="string"||!Number.isSafeInteger(value.sequence)||value.sequence<0||!Number.isSafeInteger(value.dc)||value.dc<0||!["public","blind"].includes(value.rollMode)||!Array.isArray(value.errors)||value.errors.length||!Array.isArray(value.warnings)||value.warnings.length) return false;
  if(!ownKeys(value.result,["total","degreeOfSuccess","degreeOfSuccessSlug"])) return false;
  const r=value.result, slugs=["critical-failure","failure","success","critical-success"];
  return Number.isFinite(r.total)&&Number.isSafeInteger(r.degreeOfSuccess)&&r.degreeOfSuccess>=0&&r.degreeOfSuccess<=3&&r.degreeOfSuccessSlug===slugs[r.degreeOfSuccess];
}
export function applyVoyageEncounterPendingCheckResult(state, executionResult) {
 try {
  const structural=validateVoyageEncounterState(state); if(!structural.valid)return fail(structural.errors,structural.warnings);
  if(state.lifecycleState!==LIFE.ACTIVE||state.phase!==PHASES.RESOLUTION||!validInput(executionResult)) return fail([error("invalid-pending-check-result-application","executionResult","Result application requirements were not met.")],structural.warnings);
  const record=state.pendingChecks.find(x=>x?.pendingCheckId===executionResult.pendingCheckId);
  if(!record||record.status!==STATUSES.PENDING||record.result!==null||record.sequence!==executionResult.sequence||record.source?.kind!==executionResult.sourceKind||record.source?.uuid!==executionResult.sourceUuid||!record.statisticOptions?.includes(executionResult.statisticSlug)||record.dcSource?.value!==executionResult.dc||((record.secrecy==="secret"?"blind":"public")!==executionResult.rollMode)) return fail([error("pending-check-result-mismatch","executionResult","Result does not match one pending check.")],structural.warnings);
  const candidate=clonePlainData(state); const target=candidate.pendingChecks.find(x=>x.pendingCheckId===executionResult.pendingCheckId);
  target.status=STATUSES.RESOLVED; target.result={total:executionResult.result.total,degreeOfSuccess:executionResult.result.degreeOfSuccess,degreeOfSuccessSlug:executionResult.result.degreeOfSuccessSlug,statisticSlug:executionResult.statisticSlug,dc:executionResult.dc,rollMode:executionResult.rollMode}; candidate.revision=state.revision+1;
  const final=validateVoyageEncounterState(candidate), pending=validateVoyageEncounterPendingChecks(candidate); const warnings=[...structural.warnings,...final.warnings,...pending.warnings]; if(!final.valid||!pending.valid)return fail([...final.errors,...pending.errors],warnings);
  const resolved=candidate.pendingChecks.filter(x=>x.status===STATUSES.RESOLVED).length, remaining=candidate.pendingChecks.length-resolved;
  return {ok:true,nextState:candidate,events:[{type:"voyage.pending-check-resolved",encounterId:candidate.encounterId,lifecycleState:candidate.lifecycleState,roundNumber:candidate.roundNumber,phase:candidate.phase,pendingCheckId:target.pendingCheckId,sequence:target.sequence,stationId:target.stationId,actionId:target.actionId,resolvedCheckCount:resolved,remainingCheckCount:remaining,allChecksResolved:remaining===0,previousRevision:state.revision,revision:candidate.revision}],errors:[],warnings:deduplicateVoyageResolutionIssues(warnings)};
 } catch { return fail([error("pending-check-result-application-failed","executionResult","Result application could not be completed safely.")]); }
}
