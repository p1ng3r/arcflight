import runTravelEventRunnerV2PreviewPanelSmokeChecks from "../apps/travel-event-runner-v2-preview-panel.smoke.js";

function printSmokeResult(result) {
  console.log("Travel v2 GM preview panel smoke checks passed.");
  console.log(`Checked ${result.checked.length} groups:`);
  for (const checkName of result.checked) {
    console.log(`- ${checkName}`);
  }
}

try {
  const result = runTravelEventRunnerV2PreviewPanelSmokeChecks();
  printSmokeResult(result);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
