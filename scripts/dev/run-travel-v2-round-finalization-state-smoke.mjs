import runTravelV2RoundFinalizationStateSmokeChecks from "../helpers/travel-v2-round-finalization-state.smoke.js";

try {
  const result = await runTravelV2RoundFinalizationStateSmokeChecks();
  console.log("Travel v2 round finalization state smoke checks passed.");
  console.log(`Checked ${result.checked.length} groups:`);
  for (const checkName of result.checked) console.log(`- ${checkName}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
