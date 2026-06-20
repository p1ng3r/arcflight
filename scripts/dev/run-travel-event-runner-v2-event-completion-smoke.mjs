import runTravelEventRunnerV2EventCompletionSmokeChecks from "../apps/travel-event-runner-v2-event-completion.smoke.js";
try {
  const result = await runTravelEventRunnerV2EventCompletionSmokeChecks();
  console.log("Travel event runner v2 event completion smoke checks passed.");
  console.log(`Checked ${result.checked.length} groups:`);
  for (const checkName of result.checked) console.log(`- ${checkName}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
