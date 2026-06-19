import runTravelV2StateSmokeChecks from "../helpers/travel-v2-state.smoke.js";
import runTravelV2PressureEngineSmokeChecks from "../helpers/travel-v2-pressure-engine.smoke.js";
import runTravelV2RoundPressureAdapterSmokeChecks from "../helpers/travel-v2-round-pressure-adapter.smoke.js";

const SMOKE_SUITES = Object.freeze([
  ["Travel v2 state", runTravelV2StateSmokeChecks],
  ["Travel v2 pressure engine", runTravelV2PressureEngineSmokeChecks],
  ["Travel v2 round pressure adapter", runTravelV2RoundPressureAdapterSmokeChecks]
]);

function printSuiteResult(label, result) {
  console.log(`${label} smoke checks passed.`);
  console.log(`Checked ${result.checked.length} groups:`);
  for (const checkName of result.checked) {
    console.log(`- ${checkName}`);
  }
  console.log("");
}

try {
  const results = [];
  for (const [label, runSuite] of SMOKE_SUITES) {
    const result = runSuite();
    results.push({ label, result });
    printSuiteResult(label, result);
  }
  const groupCount = results.reduce((total, entry) => total + entry.result.checked.length, 0);
  console.log(`All Travel v2 smoke checks passed. ${results.length} suites, ${groupCount} groups.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
