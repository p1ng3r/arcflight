import runTravelEventRunnerV2PressureApplicationSmokeChecks from "../apps/travel-event-runner-v2-pressure-application.smoke.js";

try {
  const result = await runTravelEventRunnerV2PressureApplicationSmokeChecks();
  console.log("Travel event runner v2 pressure application smoke checks passed.");
  console.log(`Checked ${result.checked.length} groups:`);
  for (const checkName of result.checked) console.log(`- ${checkName}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
