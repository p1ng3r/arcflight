import fs from "node:fs";
import {
  runFoundryChecks,
  runPlayerSafetyCheck
} from "./foundry-check-runner.js";
import {
  ADVANCED_DECK_CONTROL_TERMS,
  FORBIDDEN_WORLD_MUTATION_STRINGS,
  buildArcflightFoundryCheckResult,
  scanForbiddenTermsInRoot,
  scanForbiddenTermsInText,
  __test
} from "./foundry-checks/travel-v2-foundry-checks.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Foundry check runner smoke failed: ${message}`);
}

function assertResultShape(result) {
  for (const key of ["suite", "ok", "passed", "failed", "warned", "checks", "markdown"]) {
    assertSmoke(Object.hasOwn(result, key), `result includes ${key}`);
  }

  assertSmoke(Array.isArray(result.checks), "checks is an array");
  assertSmoke(typeof result.markdown === "string", "markdown is a string");

  for (const check of result.checks) {
    for (const key of ["id", "label", "severity", "message", "details"]) {
      assertSmoke(Object.hasOwn(check, key), `check includes ${key}`);
    }
    assertSmoke(["pass", "fail", "warn", "skip"].includes(check.severity), `check severity is allowed: ${check.severity}`);
  }
}

function getCheck(result, id) {
  return result.checks.find((check) => check.id === id);
}

class FakeElement {
  constructor({ id = "", className = "", text = "", children = [] } = {}) {
    this.id = id;
    this.className = className;
    this.localText = text;
    this.children = [];
    this.parentNode = null;
    for (const child of children) this.appendChild(child);
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
  }

  get innerText() {
    return [this.localText, ...this.children.map((child) => child.innerText)].filter(Boolean).join(" ");
  }

  get textContent() {
    return this.innerText;
  }

  get innerHTML() {
    return this.innerText;
  }

  get outerHTML() {
    return this.innerText;
  }

  cloneNode(deep = false) {
    return new FakeElement({
      id: this.id,
      className: this.className,
      text: this.localText,
      children: deep ? this.children.map((child) => child.cloneNode(true)) : []
    });
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.removeChild(this);
  }

  removeChild(child) {
    this.children = this.children.filter((candidate) => candidate !== child);
    child.parentNode = null;
  }

  matches(selector) {
    if (selector.startsWith("#")) return this.id === selector.slice(1);
    if (selector.startsWith(".")) return this.className.split(/\s+/).includes(selector.slice(1));
    return false;
  }

  querySelectorAll(selectorList) {
    const selectors = selectorList.split(",").map((selector) => selector.trim()).filter(Boolean);
    const matches = [];
    const visit = (node) => {
      if (selectors.some((selector) => node.matches(selector))) matches.push(node);
      for (const child of node.children) visit(child);
    };
    for (const child of this.children) visit(child);
    return matches;
  }
}

function fakeRoot(children) {
  return new FakeElement({ children });
}

function readRunnerSourceWithoutBoundaryLists() {
  const runnerSource = fs.readFileSync(new URL("./foundry-check-runner.js", import.meta.url), "utf8");
  const travelChecksSource = fs.readFileSync(new URL("./foundry-checks/travel-v2-foundry-checks.js", import.meta.url), "utf8");
  const strippedTravelChecksSource = travelChecksSource.replace(
    /export const FORBIDDEN_WORLD_MUTATION_STRINGS = Object\.freeze\(\[[\s\S]*?\]\);/,
    "export const FORBIDDEN_WORLD_MUTATION_STRINGS = Object.freeze([]);"
  );
  return `${runnerSource}\n${strippedTravelChecksSource}`;
}

const shaped = buildArcflightFoundryCheckResult("travel-v2", [
  {
    id: "shape",
    label: "Shape",
    severity: "pass",
    message: "ok",
    details: {}
  }
]);
assertResultShape(shaped);
assertSmoke(shaped.ok === true && shaped.passed === 1 && shaped.failed === 0, "result counters are calculated");
assertSmoke(shaped.markdown.includes("PASS — Shape: ok"), "markdown report is generated in readable format");

assertSmoke(
  scanForbiddenTermsInText("Safe text Pending Consequences").includes("Pending Consequences"),
  "text forbidden term scanner finds forbidden labels"
);
assertSmoke(
  scanForbiddenTermsInRoot({ innerText: "Draw Hazard", innerHTML: "" }, ADVANCED_DECK_CONTROL_TERMS).includes("Draw Hazard"),
  "root forbidden term scanner accepts explicit roots"
);

globalThis.game = { user: { id: "player-smoke", isGM: false } };
const blocked = runFoundryChecks({ renderReport: false });
assertResultShape(blocked);
assertSmoke(blocked.ok === false && blocked.failed === 1, "non-GM full suite is blocked");
assertSmoke(blocked.markdown.includes("Only a GM can run"), "blocked result explains GM requirement");

const playerSafe = runPlayerSafetyCheck({
  renderReport: false,
  root: { innerText: "Event Overview Momentum", innerHTML: "" },
  state: { eventOverview: "safe" }
});
assertResultShape(playerSafe);
assertSmoke(playerSafe.failed === 0, "player safety check can run as non-GM with safe state");
assertSmoke(getCheck(playerSafe, "travel-v2-player-provided-state-scan")?.severity === "pass", "player safety check scans provided state");

const playerUnsafeState = runPlayerSafetyCheck({
  renderReport: false,
  root: { innerText: "Event Overview", innerHTML: "" },
  state: { catalogSuggestions: ["hidden"] }
});
assertSmoke(getCheck(playerUnsafeState, "travel-v2-player-provided-state-scan")?.severity === "fail", "provided state scan fails on forbidden terms");

const playerNoState = runPlayerSafetyCheck({
  renderReport: false,
  root: { innerText: "Event Overview", innerHTML: "" }
});
assertSmoke(getCheck(playerNoState, "travel-v2-player-state-scan")?.severity === "skip", "player safety check skips state scan when no state/session is provided");


const playerChatOnlyRoot = fakeRoot([
  new FakeElement({ id: "chat", text: "Pending Consequences / Rewards (Read-only Proposed Effects)" }),
  new FakeElement({ className: "arcflight-travel-player-hud", text: "Event Overview Momentum" })
]);
const playerChatOnly = runPlayerSafetyCheck({
  renderReport: false,
  includeChatHistory: true,
  root: playerChatOnlyRoot,
  state: { eventOverview: "safe" }
});
assertSmoke(getCheck(playerChatOnly, "travel-v2-player-dom-forbidden-terms")?.severity === "pass", "chat/sidebar forbidden terms do not fail active UI scan");
assertSmoke(getCheck(playerChatOnly, "travel-v2-player-chat-history-forbidden-terms")?.severity === "warn", "chat/sidebar forbidden terms produce warning chat-history check");

const playerActiveLeak = runPlayerSafetyCheck({
  renderReport: false,
  includeChatHistory: true,
  root: fakeRoot([new FakeElement({ className: "arcflight-travel-player-hud", text: "Pending Consequences" })]),
  state: { eventOverview: "safe" }
});
assertSmoke(getCheck(playerActiveLeak, "travel-v2-player-dom-forbidden-terms")?.severity === "fail", "forbidden terms outside chat/sidebar still fail active UI scan");

globalThis.game = { user: { id: "gm-smoke", isGM: true } };
const gmAdvancedDom = runPlayerSafetyCheck({
  renderReport: false,
  root: { innerText: "Draw Hazard Apply Ship Scar", innerHTML: "" }
});
assertSmoke(getCheck(gmAdvancedDom, "travel-v2-advanced-deck-visibility")?.severity === "skip", "GM DOM advanced deck controls do not produce misleading player-visible warnings");

globalThis.game = { user: { id: "player-smoke", isGM: false } };
const playerAdvancedDom = runPlayerSafetyCheck({
  renderReport: false,
  root: { innerText: "Draw Hazard Apply Ship Scar", innerHTML: "" }
});
assertSmoke(getCheck(playerAdvancedDom, "travel-v2-advanced-deck-visibility")?.severity === "warn", "non-GM/player DOM advanced deck controls produce warn");


const permissionSkipChecks = [];
__test.runPermissionAudit(permissionSkipChecks, { runnerSourceText: "" });
assertSmoke(permissionSkipChecks[0]?.severity === "skip", "permission audit skips cleanly when source is unavailable");

const permissionFailChecks = [];
__test.runPermissionAudit(permissionFailChecks, {
  runnerSourceText: "class Runner { async #updatePendingConsequenceQueueItem(target) { return target; } }"
});
assertSmoke(permissionFailChecks[0]?.severity === "fail", "permission audit fails when an existing known handler lacks a GM guard");

const runnerSource = readRunnerSourceWithoutBoundaryLists();
for (const forbidden of FORBIDDEN_WORLD_MUTATION_STRINGS) {
  assertSmoke(
    !runnerSource.includes(forbidden),
    `check runner implementation source does not add forbidden world mutation string ${forbidden}`
  );
}

globalThis.game = undefined;
console.log("Foundry check runner smoke checks passed.");
