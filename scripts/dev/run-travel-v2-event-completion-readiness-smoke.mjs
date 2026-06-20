import runTravelV2EventCompletionReadinessSmokeChecks from "../helpers/travel-v2-event-completion-readiness.smoke.js";

try {
  const result = await runTravelV2EventCompletionReadinessSmokeChecks();
  console.log("Travel v2 event completion readiness smoke checks passed.");
  console.log(`Checked ${result.checked.length} groups: ${result.checked.join(", ")}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
