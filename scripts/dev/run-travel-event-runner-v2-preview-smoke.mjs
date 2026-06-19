import runTravelEventRunnerV2PreviewSmokeChecks from "../helpers/travel-event-runner-v2-preview.smoke.js";

function printSmokeResult(result) {
  console.log("Travel event runner v2 preview smoke checks passed.");
  console.log(`Checked ${result.checked.length} groups:`);
  for (const checkName of result.checked) {
    console.log(`- ${checkName}`);
  }
}

try {
  const result = runTravelEventRunnerV2PreviewSmokeChecks();
  printSmokeResult(result);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
