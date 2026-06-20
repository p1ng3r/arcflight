import runTravelV2SessionEventCompletionSmokeChecks from "../helpers/travel-v2-session-event-completion.smoke.js";
try {
  const result = await runTravelV2SessionEventCompletionSmokeChecks();
  console.log("Travel v2 session event completion smoke checks passed.");
  console.log(`Checked ${result.checked.length} groups:`);
  for (const checkName of result.checked) console.log(`- ${checkName}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
