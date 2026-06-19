import runTravelV2PressureEngineSmokeChecks from "../helpers/travel-v2-pressure-engine.smoke.js";

function printSmokeResult(result) {
  console.log("Travel v2 pressure engine smoke checks passed.");
  console.log(`Checked ${result.checked.length} groups:`);
  for (const checkName of result.checked) {
    console.log(`- ${checkName}`);
  }
}

try {
  const result = runTravelV2PressureEngineSmokeChecks();
  printSmokeResult(result);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
