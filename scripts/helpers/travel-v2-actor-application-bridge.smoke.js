import { prepareTravelV2ActorApplicationPreviewFromSession, applyTravelV2ActorApplicationPreview } from "./travel-v2-actor-application-bridge.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel v2 actor application bridge smoke failed: ${message}`); }
function assertEqual(actual, expected, message) { assertSmoke(actual === expected, `${message} (expected ${expected}, got ${actual})`); }
function session(extra = {}) { return { key:"s1", status:"completed", completed:true, completedAt:"2026-06-20T00:00:00.000Z", event:{key:"e1", name:"Event", rounds:[{roundNumber:1}]}, travelV2EventCompletion:{completed:true}, shipScars:{pending:[{name:"Echoes"}]}, fortuneCandidates:[{name:"True Bearing"}], rewardCandidates:[{name:"Lantern"}], consequenceCandidates:[{name:"Static"}], travelV2RoundResolutions:{records:[{roundIndex:0, roundNumber:1, effectiveOutcomeKey:"success"}]}, travelV2PressureApplications:{records:[{roundIndex:0, totalsByPressureType:{strain:1, lifeveil:-1, morale:2, supplies:-1, hull:3, cargo:1, mystery:5}}]}, ...extra }; }
function actor(system = {}, extra = {}) { return { id:"a1", name:"Ship", type:"vehicle", flags:{arcflight:{enabled:true, actorType:"ship", system}}, getFlag(module,key){ return this.flags?.[module]?.[key]; }, ...extra }; }
function setPath(root,path,value){ const parts=path.split("."); let target=root; for(let i=0;i<parts.length-1;i++){ target[parts[i]] ??= {}; target=target[parts[i]]; } target[parts.at(-1)] = value; }

export async function runTravelV2ActorApplicationBridgeSmokeChecks(){
  assertSmoke(!prepareTravelV2ActorApplicationPreviewFromSession(null, actor()).canApply,"missing package blocks");
  assertSmoke(!prepareTravelV2ActorApplicationPreviewFromSession(session(), null).canApply,"missing actor blocks");
  assertSmoke(!prepareTravelV2ActorApplicationPreviewFromSession(session(), actor({}, {type:"character"})).canApply,"non vehicle actor blocks");
  const ship = actor({current:{strain:2, lifeveil:5, morale:1, hull:10}, resources:{supplies:4}, cargo:{used:0}});
  const preview = prepareTravelV2ActorApplicationPreviewFromSession(session(), ship);
  assertSmoke(preview.canApply,"preview can apply supported actor");
  assertEqual(preview.proposedChanges.length,6,"supported deltas listed");
  assertSmoke(preview.manualFollowUps.some((entry)=>entry.text.includes("Ship Scar Candidate")),"manual ship scar listed");
  assertSmoke(preview.manualFollowUps.some((entry)=>entry.text.includes("mystery")),"unsupported pressure listed");
  const notGm = await applyTravelV2ActorApplicationPreview(ship, preview, {isGM:false});
  assertSmoke(!notGm.ok,"non GM application blocks");
  const updates = {};
  const applied = await applyTravelV2ActorApplicationPreview(ship, preview, {isGM:true, user:{id:"u1", name:"GM"}, now:"2026-06-20T00:01:00.000Z", updateActor: async (_actor,data)=>{ Object.assign(updates,data); for (const [key,value] of Object.entries(data)) setPath(ship,key,value); }});
  assertSmoke(applied.ok,"GM application succeeds");
  assertEqual(updates["flags.arcflight.system.current.strain"],3,"strain updated");
  assertEqual(updates["flags.arcflight.system.current.lifeveil"],4,"lifeveil updated");
  assertEqual(updates["flags.arcflight.system.resources.supplies"],3,"supplies updated");
  assertSmoke(Array.isArray(updates["flags.arcflight.system.travelV2.actorApplications"].records),"audit marker recorded");
  const duplicate = prepareTravelV2ActorApplicationPreviewFromSession(session(), ship);
  assertSmoke(!duplicate.canApply && duplicate.blockedReason.includes("already been applied"),"duplicate blocks");
  return { checked:["actor-application-bridge"] };
}
export default runTravelV2ActorApplicationBridgeSmokeChecks;
