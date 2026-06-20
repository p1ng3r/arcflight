import runTravelV2ActorApplicationBridgeSmokeChecks from "../helpers/travel-v2-actor-application-bridge.smoke.js";
const result = await runTravelV2ActorApplicationBridgeSmokeChecks();
console.log("Travel v2 actor application bridge smoke checks passed.");
console.log(`Checked ${result.checked.length} groups: ${result.checked.join(", ")}`);
