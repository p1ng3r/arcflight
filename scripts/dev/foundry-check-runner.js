import {
  buildArcflightFoundryCheckResult,
  buildNonGmBlockedResult,
  runTravelV2FoundryChecks,
  runTravelV2PlayerSafetyCheck
} from "./foundry-checks/travel-v2-foundry-checks.js";

const DEFAULT_OPTIONS = Object.freeze({
  suite: "travel-v2",
  includeDomChecks: true,
  includePlayerSafetyChecks: true,
  includePermissionChecks: true,
  renderReport: true,
  includeChatHistory: false
});

function normalizeOptions(options = {}) {
  return {
    ...DEFAULT_OPTIONS,
    ...(options && typeof options === "object" ? options : {})
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;"
  }[character]));
}

function renderReportToGm(result) {
  console.log(result.markdown);

  if (globalThis.game?.user?.isGM !== true) return;

  const ChatMessage = globalThis.ChatMessage;
  if (!ChatMessage?.create) return;

  const gmId = globalThis.game.user.id;
  ChatMessage.create({
    whisper: [gmId],
    content: `<pre>${escapeHtml(result.markdown)}</pre>`
  }).catch?.((error) => {
    console.warn("Arcflight | Foundry check report whisper failed.", error);
  });
}

export function runFoundryChecks(options = {}) {
  const opts = normalizeOptions(options);
  let result;

  if (opts.suite !== "travel-v2") {
    result = buildArcflightFoundryCheckResult(opts.suite, [
      {
        id: "unsupported-suite",
        label: "Unsupported suite",
        severity: "fail",
        message: `Unsupported Arcflight Foundry check suite: ${opts.suite}`,
        details: {}
      }
    ]);
  } else if (globalThis.game?.user?.isGM !== true) {
    result = buildNonGmBlockedResult("travel-v2");
  } else {
    result = runTravelV2FoundryChecks(opts);
  }

  if (opts.renderReport) renderReportToGm(result);
  return result;
}

export function runPlayerSafetyCheck(options = {}) {
  const opts = normalizeOptions({ ...options, suite: "travel-v2" });
  const result = runTravelV2PlayerSafetyCheck(opts);

  if (opts.renderReport) console.log(result.markdown);
  return result;
}

export function registerArcflightFoundryCheckRunner() {
  const foundryGame = globalThis.game;
  if (!foundryGame) return null;

  const existing = foundryGame.arcflight && typeof foundryGame.arcflight === "object"
    ? foundryGame.arcflight
    : {};
  const existingDev = existing.dev && typeof existing.dev === "object" ? existing.dev : {};
  const dev = {
    ...existingDev,
    runFoundryChecks,
    runPlayerSafetyCheck
  };

  foundryGame.arcflight = Object.isFrozen(existing) ? { ...existing, dev } : existing;
  foundryGame.arcflight.dev = dev;
  return foundryGame.arcflight.dev;
}

export default {
  runFoundryChecks,
  runPlayerSafetyCheck,
  registerArcflightFoundryCheckRunner
};
