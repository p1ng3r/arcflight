import runTravelV2SessionEventOutcomeApplicationSmokeChecks from "../helpers/travel-v2-session-event-outcome-application.smoke.js";
const result = runTravelV2SessionEventOutcomeApplicationSmokeChecks();
if (!result?.ok) throw new Error("Travel v2 session event outcome application smoke checks failed.");
console.log("Travel v2 session event outcome application smoke checks passed.");
