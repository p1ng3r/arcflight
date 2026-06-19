import runTravelV2SessionRoundFinalizationSmokeChecks from "../helpers/travel-v2-session-round-finalization.smoke.js";

try {
  const result = await runTravelV2SessionRoundFinalizationSmokeChecks();
  console.log("Travel v2 session round finalization smoke checks passed.");
  console.log(`Checked ${result.checked.length} groups:`);
  for (const checkName of result.checked) console.log(`- ${checkName}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
