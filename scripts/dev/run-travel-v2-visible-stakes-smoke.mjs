import runTravelV2VisibleStakesSmokeChecks from "../helpers/travel-v2-visible-stakes.smoke.js";

function printSmokeResult(result) {
  console.log("Travel v2 visible stakes smoke checks passed.");
  console.log(`Checked ${result.checked.length} groups:`);
  for (const checkName of result.checked) {
    console.log(`- ${checkName}`);
  }
}

try {
  const result = await runTravelV2VisibleStakesSmokeChecks();
  printSmokeResult(result);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
