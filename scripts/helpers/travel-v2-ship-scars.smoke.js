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

  const secondPressure = applyTravelV2PressureChanges({ key: "scar-smoke-2", pressure: { hull: { value: 4, crossed: [2, 3, 4] } }, shipScars: { records: [] } }, [{ pressureType: "hull", amount: 1, source: "manual", roundNumber: 3 }]);
  const secondDrawn = drawTravelV2ShipScarsForPressureResult({ key: "scar-smoke-2", shipScars: { records: [] } }, secondPressure, { now: "2026-06-22T00:02:30.000Z" });
  let secondUpdateData = null;
  const secondApplied = await applyTravelV2ShipScarToActor(secondDrawn.session, dupActor, secondDrawn.session.shipScars.records[0].id, { user: { isGM: true, id: "gm2", name: "Second GM" }, now: "2026-06-22T00:02:45.000Z", updateActor: async (_actor, data) => { secondUpdateData = data; } });
  assertSmoke(secondApplied.ok && secondApplied.applied, "second scar applies to actor with existing scars");
  const preservedFirst = secondUpdateData["flags.arcflight.system.travelV2.shipScars"].records.find((record) => record.id === scarId);
  assertEqual(preservedFirst.playerSafe.text, updateData["flags.arcflight.system.travelV2.shipScars"].records[0].playerSafe.text, "applying second scar preserves first playerSafe text");
  assertEqual(preservedFirst.playerSafe.repairRequirement, updateData["flags.arcflight.system.travelV2.shipScars"].records[0].playerSafe.repairRequirement, "applying second scar preserves first playerSafe repair requirement");
  assertEqual(preservedFirst.appliedByUserName, updateData["flags.arcflight.system.travelV2.shipScars"].records[0].appliedByUserName, "applying second scar preserves first apply metadata");

  const repairActor = actor({ travelV2: { shipScars: secondUpdateData["flags.arcflight.system.travelV2.shipScars"], followUps: { records: [{ id: "f" }] }, actorApplications: { records: [{ id: "a" }] } } });
  let repairUpdate = null;
  const repaired = await repairTravelV2ShipScarOnActor(applied.session, repairActor, scarId, { user: { isGM: true }, now: "2026-06-22T00:03:00.000Z", updateActor: async (_actor, data) => { repairUpdate = data; } });
  assertSmoke(repaired.ok && repaired.repaired, "repair updates actor scar status");
  const repairedFirst = repairUpdate["flags.arcflight.system.travelV2.shipScars"].records.find((record) => record.id === scarId);
  assertEqual(repairedFirst.status, "repaired", "actor scar is repaired");
  assertEqual(repairedFirst.playerSafe.status, "repaired", "repair updates playerSafe status");
  assertEqual(repairedFirst.playerSafe.text, preservedFirst.playerSafe.text, "repair preserves playerSafe text");
  assertEqual(repairedFirst.playerSafe.name, preservedFirst.playerSafe.name, "repair preserves playerSafe name");
  assertEqual(repairedFirst.playerSafe.repairRequirement, preservedFirst.playerSafe.repairRequirement, "repair preserves playerSafe repair requirement");
  assertEqual(repairedFirst.appliedByUserName, preservedFirst.appliedByUserName, "repair preserves apply metadata");
  assertEqual(normalizeTravelV2ShipScarsState(repaired.session.shipScars).records[0].status, "repaired", "session scar is repaired");
  return { checked: ["overflow-draw", "no-actor-mutation-on-draw", "apply-persists", "duplicate-apply-blocked", "second-apply-preserves-existing", "repair-updates", "repair-preserves-player-safe", "existing-records-preserved", "safe-player-payload"] };
}
