import runTravelV2EventOutcomePackageSmokeChecks from "../helpers/travel-v2-event-outcome-package.smoke.js";
const result = runTravelV2EventOutcomePackageSmokeChecks();
if (!result?.ok) throw new Error("Travel v2 event outcome package smoke checks failed.");
console.log("Travel v2 event outcome package smoke checks passed.");
