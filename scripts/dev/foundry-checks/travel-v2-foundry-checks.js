import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "../../apps/travel-event-runner-v2-preview-consumer.js";

export const FORBIDDEN_PLAYER_STATE_TERMS = Object.freeze([
  "Pending Consequences",
  "Queue Summary",
  "Apply Status",
  "Ready to Apply",
  "Needs Selection",
  "Unsupported / Preview Only",
  "Apply All Executable Selected",
  "Clear All Selected",
  "Select All Single Suggestions",
  "Use This Card",
  "Apply Selected Consequence",
  "Follow-up Notes",
  "GM summary",
  "Apply Preview",
  "sourceRecord",
  "gmItemGroups",
  "catalogSuggestions",
  "selectedConsequenceApplyPreview",
  "applyEffectSummary",
  "applyStatusSummary",
  "clearSelectionSummary",
  "singleSuggestionSelectionSummary",
  "consequenceFollowupReview"
]);

export const FORBIDDEN_PLAYER_HUD_TERMS = Object.freeze([
  "Pending Consequence",
  "Queue Summary",
  "Apply Status",
  "sourceRecord",
  "gmItemGroups",
  "catalogSuggestions",
  "selectedConsequenceApplyPreview",
  "Apply All Executable Selected",
  "Clear All Selected",
  "Select All Single Suggestions",
  "Apply Selected Consequence",
  "Follow-up Notes",
  "GM summary",
  "Apply Preview"
]);

export const ADVANCED_DECK_CONTROL_TERMS = Object.freeze([
  "Draw Hazard",
  "Reveal Hazard",
  "Activate Hazard",
  "Clear Hazard",
  "Draw Ship Scar",
  "Apply Ship Scar",
  "Repair Ship Scar",
  "Mark Scar Repaired"
]);

export const FORBIDDEN_WORLD_MUTATION_STRINGS = Object.freeze([
  "Actor.create",
  "Item.create",
  "JournalEntry.create",
  "Combat.create",
  "Scene.create",
  "TokenDocument.create",
  "socket.emit",
  "game.settings.set",
  "setFlag",
  ".update("
]);

export const TRAVEL_V2_FORBIDDEN_PLAYER_TERMS = FORBIDDEN_PLAYER_STATE_TERMS;
export const TRAVEL_V2_PLAYER_HUD_FORBIDDEN_TERMS = FORBIDDEN_PLAYER_HUD_TERMS;
export const TRAVEL_V2_ADVANCED_DECK_CONTROL_TERMS = ADVANCED_DECK_CONTROL_TERMS;

const CHECK_SEVERITIES = new Set(["pass", "fail", "warn", "skip"]);
const KNOWN_GM_ONLY_HANDLER_NAMES = Object.freeze([
  "#updatePendingConsequenceQueueItem",
  "#applyAllSelectedPendingConsequences",
  "#selectAllSingleSuggestionPendingConsequences",
  "#clearAllSelectedPendingConsequences",
  "#clearSelectedPendingConsequence",
  "#applySelectedPendingConsequence",
  "#selectPendingConsequenceCatalogCard",
  "#updateTravelV2ConsequenceFollowupStatus"
]);
const OBVIOUS_GM_GUARD_PATTERNS = Object.freeze([
  "game?.user?.isGM !== true",
  "game.user?.isGM !== true",
  "game?.user?.isGM === true",
  "game.user?.isGM === true",
  "isGM !== true",
  "isGM === true"
]);

function addCheck(checks, id, label, severity, message, details = {}) {
  checks.push({
    id,
    label,
    severity: CHECK_SEVERITIES.has(severity) ? severity : "fail",
    message,
    details
  });
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object ?? {}, key);
}

function safeSerialize(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch (error) {
    return String(value ?? "");
  }
}

export function scanForbiddenTermsInText(text = "", terms = FORBIDDEN_PLAYER_STATE_TERMS) {
  const haystack = String(text ?? "");
  return terms.filter((term) => haystack.includes(term));
}

export function scanForbiddenTermsInRoot(root = globalThis.document?.body, terms = FORBIDDEN_PLAYER_STATE_TERMS) {
  const text = root?.innerText ?? root?.textContent ?? "";
  const html = root?.outerHTML ?? root?.innerHTML ?? "";
  return [...new Set([
    ...scanForbiddenTermsInText(text, terms),
    ...scanForbiddenTermsInText(html, terms)
  ])];
}

export function buildArcflightFoundryCheckResult(suite, checks) {
  const passed = checks.filter((check) => check.severity === "pass").length;
  const failed = checks.filter((check) => check.severity === "fail").length;
  const warned = checks.filter((check) => check.severity === "warn").length;
  const title = suite === "travel-v2" ? "Travel v2" : suite;
  const markdown = [
    `# Arcflight Foundry Check Report — ${title}`,
    "",
    ...checks.map((check) => `${check.severity.toUpperCase()} — ${check.label}: ${check.message}`)
  ].join("\n");

  return {
    suite,
    ok: failed === 0,
    passed,
    failed,
    warned,
    checks,
    markdown
  };
}

export function buildNonGmBlockedResult(suite = "travel-v2") {
  const checks = [];
  addCheck(
    checks,
    "travel-v2-gm-permission-gate",
    "GM permission gate",
    "fail",
    "Only a GM can run the full Arcflight Foundry check suite."
  );
  return buildArcflightFoundryCheckResult(suite, checks);
}

function createCheckSession() {
  return {
    key: "foundry-check-runner-session",
    status: "completed",
    completed: true,
    pressure: {
      strain: { value: 1 },
      lifeveil: { value: 0 },
      morale: { value: 1 },
      hull: { value: 0 },
      supplies: { value: 1 }
    },
    event: {
      key: "foundry-check",
      name: "Foundry Check",
      category: "dev",
      rounds: [{ roundNumber: 1 }]
    },
    currentRoundIndex: 0,
    travelV2FocusBacklashRecords: {
      records: [
        {
          id: "check-focus",
          roundIndex: 0,
          stationName: "Engineer",
          status: "pending",
          publicRiskText: "The arkengine shudders."
        }
      ]
    },
    flags: {}
  };
}

function addStateExposureCheck(checks, id, label, state, terms = FORBIDDEN_PLAYER_STATE_TERMS) {
  const exposed = scanForbiddenTermsInText(safeSerialize(state), terms);
  addCheck(
    checks,
    id,
    label,
    exposed.length === 0 ? "pass" : "fail",
    exposed.length === 0
      ? "Serialized state excludes known GM-only fields and labels."
      : `${exposed.join(", ")} found.`,
    { exposed }
  );
  return exposed;
}

function getPendingQueueItemCount(queue) {
  return Number(queue?.totalItems ?? queue?.items?.length ?? queue?.playerSafeItems?.length ?? 0);
}

function runStateChecks(checks) {
  const session = createCheckSession();
  const gmState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
    session,
    user: { id: "gm-check", isGM: true }
  });
  const nonGmState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
    session,
    user: { id: "player-check", isGM: false }
  });

  addStateExposureCheck(
    checks,
    "travel-v2-non-gm-forbidden-state",
    "Non-GM state exposes forbidden terms",
    nonGmState
  );

  const gmManagementOk = gmState.isGM === true && gmState.canManageTravelV2Consequences === true;
  addCheck(
    checks,
    "travel-v2-gm-management-state",
    "GM state still has management access",
    gmManagementOk ? "pass" : "fail",
    gmManagementOk
      ? "GM app state exposes isGM and canManageTravelV2Consequences."
      : "GM app state is missing isGM or canManageTravelV2Consequences.",
    {
      isGM: gmState.isGM,
      canManageTravelV2Consequences: gmState.canManageTravelV2Consequences
    }
  );

  const pendingItemCount = getPendingQueueItemCount(gmState.pendingConsequenceQueue);
  if (pendingItemCount <= 0) {
    addCheck(
      checks,
      "travel-v2-gm-only-queue-fields",
      "GM-only queue grouping fields are GM-only",
      "fail",
      "The check fixture did not produce a pending consequence queue item, so queue separation could not be verified.",
      { pendingItemCount }
    );
    return;
  }

  const gmHasGroups = Array.isArray(gmState.pendingConsequenceQueue?.gmItemGroups);
  const nonGmHasGroups = hasOwn(nonGmState.pendingConsequenceQueue, "gmItemGroups");
  addCheck(
    checks,
    "travel-v2-gm-only-queue-fields",
    "GM-only queue grouping fields are GM-only",
    gmHasGroups && !nonGmHasGroups ? "pass" : "fail",
    gmHasGroups && !nonGmHasGroups
      ? "Pending queue grouping fields are present for GM state only."
      : "Pending queue grouping fields are missing for GM state or visible to non-GM state.",
    { pendingItemCount, gmHasGroups, nonGmHasGroups }
  );
}

function runDomChecks(checks, { root = null, currentUserIsGm = false, includePlayerSafetyChecks = true } = {}) {
  if (!includePlayerSafetyChecks) return;

  const scanRoot = root ?? globalThis.document?.body ?? null;
  if (!scanRoot) {
    addCheck(
      checks,
      "travel-v2-player-dom-forbidden-terms",
      "Player DOM forbidden text scan",
      "skip",
      "No DOM root is available in this environment."
    );
    addCheck(
      checks,
      "travel-v2-player-hud-safety",
      "Player HUD safety",
      "skip",
      "No DOM root is available in this environment."
    );
    addCheck(
      checks,
      "travel-v2-advanced-deck-visibility",
      "Advanced Hazard Deck / Ship Scar control visibility",
      "skip",
      "No DOM root is available in this environment."
    );
    return;
  }

  const exposed = scanForbiddenTermsInRoot(scanRoot, FORBIDDEN_PLAYER_STATE_TERMS);
  addCheck(
    checks,
    "travel-v2-player-dom-forbidden-terms",
    "Player DOM forbidden text scan",
    currentUserIsGm || exposed.length === 0 ? "pass" : "fail",
    currentUserIsGm
      ? "GM DOM was scanned; GM-only terms visible to the GM do not prove player exposure."
      : (exposed.length === 0
        ? "Current DOM does not contain known player-forbidden terms."
        : `${exposed.join(", ")} found.`),
    { exposed, currentUserIsGm }
  );

  const hudExposed = scanForbiddenTermsInRoot(scanRoot, FORBIDDEN_PLAYER_HUD_TERMS);
  addCheck(
    checks,
    "travel-v2-player-hud-safety",
    "Player HUD safety",
    currentUserIsGm || hudExposed.length === 0 ? "pass" : "fail",
    currentUserIsGm
      ? "GM DOM was scanned; GM queue/control terms visible to the GM do not prove player HUD exposure."
      : (hudExposed.length === 0
        ? "Player-facing DOM does not show known GM queue/control terms."
        : `${hudExposed.join(", ")} found.`),
    { exposed: hudExposed, currentUserIsGm }
  );

  const advancedControls = scanForbiddenTermsInRoot(scanRoot, ADVANCED_DECK_CONTROL_TERMS);
  if (currentUserIsGm) {
    addCheck(
      checks,
      "travel-v2-advanced-deck-visibility",
      "Advanced Hazard Deck / Ship Scar control visibility",
      "skip",
      "GM DOM was scanned; advanced deck controls visible to the GM do not prove player exposure. Run runPlayerSafetyCheck from Player2 to verify player DOM.",
      { exposed: advancedControls, currentUserIsGm }
    );
    return;
  }

  addCheck(
    checks,
    "travel-v2-advanced-deck-visibility",
    "Advanced Hazard Deck / Ship Scar control visibility",
    advancedControls.length === 0 ? "pass" : "warn",
    advancedControls.length === 0
      ? "No advanced Hazard Deck or Ship Scar controls were found in the scanned player DOM."
      : `${advancedControls.join(", ")} found.`,
    { exposed: advancedControls, currentUserIsGm }
  );
}

function resolveRunnerSourceText(options = {}) {
  if (typeof options.runnerSourceText === "string") return options.runnerSourceText;
  return String(
    globalThis.CONFIG?.arcflight?.ArcflightTravelEventRunner
      ?? globalThis.game?.arcflight?.ArcflightTravelEventRunner
      ?? ""
  );
}

function runPermissionAudit(checks, options = {}) {
  const sourceText = resolveRunnerSourceText(options);
  if (!sourceText) {
    addCheck(
      checks,
      "travel-v2-permission-action-handler-audit",
      "Permission/action handler audit",
      "skip",
      "Runner source text is unavailable; static GM guard audit was not run."
    );
    return;
  }

  const missingGuard = [];
  const missingHandler = [];
  for (const handlerName of KNOWN_GM_ONLY_HANDLER_NAMES) {
    const handlerIndex = sourceText.indexOf(`async ${handlerName}`);
    if (handlerIndex < 0) {
      missingHandler.push(handlerName);
      continue;
    }

    const handlerEnd = sourceText.indexOf("\n  async #", handlerIndex + 1);
    const snippet = sourceText.slice(handlerIndex, handlerEnd > handlerIndex ? handlerEnd : handlerIndex + 1200);
    if (!OBVIOUS_GM_GUARD_PATTERNS.some((pattern) => snippet.includes(pattern))) {
      missingGuard.push(handlerName);
    }
  }

  addCheck(
    checks,
    "travel-v2-permission-action-handler-audit",
    "Permission/action handler audit",
    missingGuard.length === 0 ? "pass" : "fail",
    missingGuard.length === 0
      ? "Known GM-only action handlers that exist include obvious GM guards."
      : `Known GM-only handlers lack obvious GM guards: ${missingGuard.join(", ")}.`,
    {
      audited: KNOWN_GM_ONLY_HANDLER_NAMES,
      missingGuard,
      missingHandler
    }
  );
}

function runPlayerStateChecks(checks, options = {}) {
  if (hasOwn(options, "state")) {
    addStateExposureCheck(
      checks,
      "travel-v2-player-provided-state-scan",
      "Player state scan",
      options.state
    );
    return;
  }

  if (hasOwn(options, "session")) {
    const preparedState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: options.session,
      user: globalThis.game?.user
    });
    addStateExposureCheck(
      checks,
      "travel-v2-player-prepared-session-state-scan",
      "Player session state scan",
      preparedState
    );
    return;
  }

  addCheck(
    checks,
    "travel-v2-player-state-scan",
    "Player state scan",
    "skip",
    "No state or session was provided."
  );
}

export function runTravelV2FoundryChecks(options = {}) {
  const opts = {
    includeDomChecks: true,
    includePlayerSafetyChecks: true,
    includePermissionChecks: true,
    ...options
  };
  const checks = [];

  if (globalThis.game?.user?.isGM !== true) return buildNonGmBlockedResult("travel-v2");

  addCheck(
    checks,
    "travel-v2-gm-permission-gate",
    "GM permission gate",
    "pass",
    "Current user is a GM; full check suite can run."
  );

  if (opts.includePlayerSafetyChecks) runStateChecks(checks);
  if (opts.includeDomChecks) {
    runDomChecks(checks, {
      root: opts.root,
      currentUserIsGm: true,
      includePlayerSafetyChecks: opts.includePlayerSafetyChecks
    });
  }
  if (opts.includePermissionChecks) runPermissionAudit(checks, opts);

  return buildArcflightFoundryCheckResult("travel-v2", checks);
}

export function runTravelV2PlayerSafetyCheck(options = {}) {
  const checks = [];
  runDomChecks(checks, {
    root: options.root,
    currentUserIsGm: globalThis.game?.user?.isGM === true,
    includePlayerSafetyChecks: true
  });
  runPlayerStateChecks(checks, options);
  return buildArcflightFoundryCheckResult("travel-v2", checks);
}

export const __test = {
  addCheck,
  createCheckSession,
  runDomChecks,
  runPermissionAudit,
  runPlayerStateChecks,
  runStateChecks
};
