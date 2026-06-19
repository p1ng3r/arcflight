import runTravelEventRunnerV2PreviewConsumerSmokeChecks from "../apps/travel-event-runner-v2-preview-consumer.smoke.js";

function printSmokeResult(result) {
  console.log("Travel v2 runner app preview consumer smoke checks passed.");
  console.log(`Checked ${result.checked.length} groups:`);
  for (const checkName of result.checked) {
    console.log(`- ${checkName}`);
  }
}

try {
  const result = runTravelEventRunnerV2PreviewConsumerSmokeChecks();
  printSmokeResult(result);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
