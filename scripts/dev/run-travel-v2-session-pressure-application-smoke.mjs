import runTravelV2SessionPressureApplicationSmokeChecks from "../helpers/travel-v2-session-pressure-application.smoke.js";

try {
  const result = runTravelV2SessionPressureApplicationSmokeChecks();
  console.log("Travel v2 session pressure application smoke checks passed.");
  console.log(`Checked ${result.checked.length} groups:`);
  for (const checkName of result.checked) console.log(`- ${checkName}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
