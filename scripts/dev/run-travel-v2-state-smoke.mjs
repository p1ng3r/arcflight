import runTravelV2StateSmokeChecks from "../helpers/travel-v2-state.smoke.js";

function printSmokeResult(result) {
  console.log("Travel v2 state smoke checks passed.");
  console.log(`Checked ${result.checked.length} groups:`);
  for (const checkName of result.checked) {
    console.log(`- ${checkName}`);
  }
}

try {
  const result = runTravelV2StateSmokeChecks();
  printSmokeResult(result);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
