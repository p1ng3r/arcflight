import runTravelEventRunnerV2PressureCorrectionSmokeChecks from "../apps/travel-event-runner-v2-pressure-correction.smoke.js";

try {
  const result = await runTravelEventRunnerV2PressureCorrectionSmokeChecks();
  console.log("Travel event runner v2 pressure correction smoke checks passed.");
  console.log(`Checked ${result.checked.length} groups:`);
  for (const checkName of result.checked) console.log(`- ${checkName}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
