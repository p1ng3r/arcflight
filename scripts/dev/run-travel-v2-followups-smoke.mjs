import runTravelV2FollowUpsSmokeChecks from "../helpers/travel-v2-followups.smoke.js";
const result = await runTravelV2FollowUpsSmokeChecks();
console.log("Travel v2 follow-ups smoke checks passed.");
console.log(`Checked ${result.checked.length} groups:`);
for (const checkName of result.checked) console.log(`- ${checkName}`);
