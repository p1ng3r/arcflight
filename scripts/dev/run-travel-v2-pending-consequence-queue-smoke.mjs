import runTravelV2PendingConsequenceQueueSmokeChecks from "../helpers/travel-v2-pending-consequence-queue.smoke.js";
const result = runTravelV2PendingConsequenceQueueSmokeChecks();
if (!result?.ok) throw new Error("Travel v2 pending consequence queue smoke checks failed.");
console.log("Travel v2 pending consequence queue smoke checks passed.");
