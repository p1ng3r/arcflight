import fs from "node:fs";
import { runFoundryChecks } from "./foundry-check-runner.js";
import { buildArcflightFoundryCheckResult, scanForbiddenTermsInRoot, scanForbiddenTermsInText } from "./foundry-checks/travel-v2-foundry-checks.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Foundry check runner smoke failed: ${message}`);
}

function assertResultShape(result) {
  for (const key of ["suite", "ok", "passed", "failed", "warned", "checks", "markdown"]) assertSmoke(Object.hasOwn(result, key), `result includes ${key}`);
  assertSmoke(Array.isArray(result.checks), "checks is an array");
  assertSmoke(typeof result.markdown === "string" && result.markdown.includes("# Arcflight Foundry Check Report"), "markdown report is generated");
}

const shaped = buildArcflightFoundryCheckResult("travel-v2", [{ id: "shape", label: "Shape", severity: "pass", message: "ok", details: {} }]);
assertResultShape(shaped);
assertSmoke(shaped.ok === true && shaped.passed === 1 && shaped.failed === 0, "result counters are calculated");
assertSmoke(scanForbiddenTermsInText("Safe text Pending Consequences").includes("Pending Consequences"), "text forbidden term scanner finds forbidden labels");
assertSmoke(scanForbiddenTermsInRoot({ innerText: "Draw Hazard", innerHTML: "" }, ["Draw Hazard"]).includes("Draw Hazard"), "root forbidden term scanner accepts explicit roots");

globalThis.game = { user: { id: "player-smoke", isGM: false } };
const blocked = runFoundryChecks({ renderReport: false });
assertResultShape(blocked);
assertSmoke(blocked.ok === false && blocked.failed === 1, "non-GM full suite is blocked");
assertSmoke(blocked.markdown.includes("Only a GM can run"), "blocked result explains GM requirement");

globalThis.game = undefined;
const runnerSource = fs.readFileSync(new URL("./foundry-check-runner.js", import.meta.url), "utf8") + fs.readFileSync(new URL("./foundry-checks/travel-v2-foundry-checks.js", import.meta.url), "utf8");
for (const forbidden of ["Actor.create", "Item.create", "JournalEntry.create", "Combat.create", "Scene.create", "TokenDocument.create", "socket.emit", "game.settings.set", "setFlag", "update("]) {
  assertSmoke(!runnerSource.includes(forbidden), `check runner source does not add forbidden world mutation string ${forbidden}`);
}
console.log("Foundry check runner smoke checks passed.");
