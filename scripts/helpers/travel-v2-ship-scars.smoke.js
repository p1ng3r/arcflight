import { applyTravelV2PressureChanges } from "./travel-v2-pressure-engine.js";
import { drawTravelV2ShipScarsForPressureResult, applyTravelV2ShipScarToActor, repairTravelV2ShipScarOnActor, normalizeTravelV2ShipScarsState } from "./travel-v2-ship-scars.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel v2 ship scars smoke check failed: ${message}`); }
function assertEqual(actual, expected, message) { if (actual !== expected) throw new Error(`Travel v2 ship scars smoke check failed: ${message}. Expected ${expected}, got ${actual}.`); }
function actor(system = {}, extra = {}) { return { id: "ship1", name: "Ship", type: "vehicle", flags: { arcflight: { enabled: true, actorType: "ship", system } }, getFlag(module, key) { return this.flags?.[module]?.[key]; }, ...extra }; }

export default async function runTravelV2ShipScarsSmokeChecks() {
  let updateCalls = 0;
  const session = { key: "scar-smoke", pressure: { strain: { value: 4, crossed: [2, 3, 4] } }, shipScars: { records: [] } };
  const pressureResult = applyTravelV2PressureChanges(session, [{ pressureType: "strain", amount: 1, source: "manual", roundNumber: 2 }]);
  assertEqual(pressureResult.session.pressure.strain.value, 4, "overflow pressure remains capped at 4");
  assertSmoke(pressureResult.shipScarTriggers.length === 1, "overflow creates a ship scar trigger");
  assertEqual(updateCalls, 0, "pressure overflow draw path does not mutate actors");

  const drawn = drawTravelV2ShipScarsForPressureResult(session, pressureResult, { now: "2026-06-22T00:00:00.000Z" });
  assertSmoke(drawn.drawn.length === 1, "overflow creates one pending ship scar");
  assertEqual(drawn.session.shipScars.records[0].status, "pending", "drawn scar is pending");
  const duplicate = drawTravelV2ShipScarsForPressureResult(drawn.session, pressureResult, { now: "2026-06-22T00:01:00.000Z" });
  assertEqual(duplicate.drawn.length, 0, "duplicate overflow trigger is ignored");

  const beforeActor = actor({ travelV2: { followUps: { records: [{ id: "f" }] }, actorApplications: { records: [{ id: "a" }] } } });
  const scarId = drawn.session.shipScars.records[0].id;
  let updateData = null;
  const applied = await applyTravelV2ShipScarToActor(drawn.session, beforeActor, scarId, { user: { isGM: true }, now: "2026-06-22T00:02:00.000Z", updateActor: async (_actor, data) => { updateCalls += 1; updateData = data; } });
  assertSmoke(applied.ok && applied.applied, "GM apply persists scar");
  assertSmoke(Array.isArray(updateData["flags.arcflight.system.travelV2.shipScars"].records), "actor flag update contains ship scars records");
  assertEqual(beforeActor.flags.arcflight.system.travelV2.followUps.records[0].id, "f", "followUps preserved by scar apply helper");
  assertEqual(beforeActor.flags.arcflight.system.travelV2.actorApplications.records[0].id, "a", "actorApplications preserved by scar apply helper");
  assertSmoke(updateData["flags.arcflight.system.travelV2.shipScars"].records[0].playerSafe.text && !updateData["flags.arcflight.system.travelV2.shipScars"].records[0].playerSafe.gmText, "player-safe payload omits gm text");

  const dupActor = actor({ travelV2: { shipScars: updateData["flags.arcflight.system.travelV2.shipScars"], followUps: { records: [{ id: "f" }] }, actorApplications: { records: [{ id: "a" }] } } });
  const duplicateApply = await applyTravelV2ShipScarToActor(drawn.session, dupActor, scarId, { user: { isGM: true }, updateActor: async () => { throw new Error("duplicate should not update actor"); } });
  assertSmoke(!duplicateApply.ok, "duplicate apply is blocked");

  let repairUpdate = null;
  const repaired = await repairTravelV2ShipScarOnActor(applied.session, dupActor, scarId, { user: { isGM: true }, now: "2026-06-22T00:03:00.000Z", updateActor: async (_actor, data) => { repairUpdate = data; } });
  assertSmoke(repaired.ok && repaired.repaired, "repair updates actor scar status");
  assertEqual(repairUpdate["flags.arcflight.system.travelV2.shipScars"].records[0].status, "repaired", "actor scar is repaired");
  assertEqual(normalizeTravelV2ShipScarsState(repaired.session.shipScars).records[0].status, "repaired", "session scar is repaired");
  return { checked: ["overflow-draw", "no-actor-mutation-on-draw", "apply-persists", "duplicate-apply-blocked", "repair-updates", "existing-records-preserved", "safe-player-payload"] };
}
