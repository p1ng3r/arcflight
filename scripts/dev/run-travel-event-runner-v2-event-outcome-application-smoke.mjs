import runTravelEventRunnerV2EventOutcomeApplicationSmokeChecks from "../apps/travel-event-runner-v2-event-outcome-application.smoke.js";
const result = await runTravelEventRunnerV2EventOutcomeApplicationSmokeChecks();
if (!result?.ok) throw new Error("Travel event runner v2 event outcome application smoke checks failed.");
console.log("Travel event runner v2 event outcome application smoke checks passed.");
