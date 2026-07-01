import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "../../apps/travel-event-runner-v2-preview-consumer.js";
import { prepareTravelEventRunnerState } from "../../helpers/travel-event-runner.js";

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
  "consequenceFollowupReview",
  "GM-only",
  "GM only",
  "management details",
  "rawApplicationRecord",
  "packageRecord",
  "travelV2EventOutcomeApplication",
  "travelV2FinalOutcomeShipApplication",
  "Final Outcome Package Review",
  "Apply Final Outcome to Ship",
  "Apply Outcome Package",
  "Apply Suggested Pressure",
  "Finalize Round",
  "Apply Pending Consequences",
  "Dismiss Pending Consequences",
  "Ship Scar candidate",
  "Hazard Card Pending",
  "deferredRows",
  "unsupportedRows",
  "supportedRows",
  "before",
  "after",
  "packageAlreadyApplied",
  "shipAlreadyApplied",
  "canManageTravelV2Consequences",
  "consequenceFlow",
  "pendingConsequenceQueue",
  "completionChecklist",
  "actor internals",
  "targetActorId",
  "targetActorUuid",
  "resourceOptions",
  "debugReport"
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
  "Apply Preview",
  "consequenceFlow",
  "pendingConsequenceQueue",
  "completionChecklist",
  "debugReport"
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


const CHAT_HISTORY_IGNORE_SELECTORS = Object.freeze([
  "#chat",
  "#chat-log",
  "#sidebar",
  ".chat-sidebar",
  ".chat-log",
  ".chat-message",
  ".message-content"
]);
const CHAT_HISTORY_IGNORE_SELECTOR = CHAT_HISTORY_IGNORE_SELECTORS.join(", ");

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


function readRootText(root) {
  return root?.innerText ?? root?.textContent ?? "";
}

function readRootHtml(root) {
  return root?.outerHTML ?? root?.innerHTML ?? "";
}

function queryIgnoredChatNodes(root) {
  if (!root || typeof root.querySelectorAll !== "function") return [];
  try {
    return Array.from(root.querySelectorAll(CHAT_HISTORY_IGNORE_SELECTOR));
  } catch (_error) {
    return [];
  }
}

function removeIgnoredChatDescendants(root) {
  const ignoredNodes = queryIgnoredChatNodes(root);
  for (const node of ignoredNodes) {
    if (typeof node.remove === "function") node.remove();
    else if (node.parentNode && typeof node.parentNode.removeChild === "function") node.parentNode.removeChild(node);
  }
  return root;
}

function cloneRootWithoutIgnoredChat(root) {
  if (!root) return null;
  if (typeof root.cloneNode === "function") return removeIgnoredChatDescendants(root.cloneNode(true));
  return root;
}

function getActiveRootText(root, { ignoreChatHistory = true } = {}) {
  if (!ignoreChatHistory) return `${readRootText(root)} ${readRootHtml(root)}`;
  const activeRoot = cloneRootWithoutIgnoredChat(root);
  return `${readRootText(activeRoot)} ${readRootHtml(activeRoot)}`;
}

function getChatHistoryText(root) {
  const ignoredNodes = queryIgnoredChatNodes(root);
  return ignoredNodes.map((node) => `${readRootText(node)} ${readRootHtml(node)}`).join(" ");
}


function getNodeSelector(node) {
  if (!node) return "document.body";
  if (node.id) return `#${node.id}`;
  if (typeof node.className === "string" && node.className.trim()) {
    return `.${node.className.trim().split(/\s+/).slice(0, 3).join(".")}`;
  }
  return String(node.tagName || node.nodeName || "node").toLowerCase();
}

function snippetAround(text, term) {
  const haystack = String(text ?? "");
  const index = haystack.indexOf(term);
  if (index < 0) return haystack.slice(0, 160);
  return haystack.slice(Math.max(0, index - 60), Math.min(haystack.length, index + term.length + 60)).replace(/\s+/g, " ").trim();
}

function scanForbiddenTermEvidenceInRoot(root = globalThis.document?.body, terms = FORBIDDEN_PLAYER_STATE_TERMS, options = {}) {
  const nodes = [];
  if (root) nodes.push(root);
  if (root && typeof root.querySelectorAll === "function") {
    try {
      nodes.push(...Array.from(root.querySelectorAll("*")));
    } catch (_error) {
      // Fake DOMs used by smoke tests may not implement wildcard selection.
    }
  }

  const evidence = [];
  const ignored = options.ignoreChatHistory !== false ? new Set(queryIgnoredChatNodes(root)) : new Set();
  for (const node of nodes) {
    if (ignored.has(node)) continue;
    const text = `${readRootText(node)} ${readRootHtml(node)}`;
    for (const term of scanForbiddenTermsInText(text, terms)) {
      evidence.push({ term, selector: getNodeSelector(node), snippet: snippetAround(text, term) });
    }
  }
  return evidence.filter((entry, index, list) => list.findIndex((candidate) => candidate.term === entry.term && candidate.selector === entry.selector) === index);
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

export function scanForbiddenTermsInRoot(root = globalThis.document?.body, terms = FORBIDDEN_PLAYER_STATE_TERMS, options = {}) {
  const text = getActiveRootText(root, { ignoreChatHistory: options.ignoreChatHistory !== false });
  return [...new Set(scanForbiddenTermsInText(text, terms))];
}

export function scanForbiddenTermsInChatHistory(root = globalThis.document?.body, terms = FORBIDDEN_PLAYER_STATE_TERMS) {
  return [...new Set(scanForbiddenTermsInText(getChatHistoryText(root), terms))];
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

  const errors = checks.filter((check) => check.severity === "fail");
  const warnings = checks.filter((check) => check.severity === "warn");
  const userIsGM = globalThis.game?.user?.isGM === true;
  const scannedSelectors = [...new Set(checks.flatMap((check) => Array.isArray(check.details?.scannedSelectors) ? check.details.scannedSelectors : []))];
  return {
    suite,
    ok: failed === 0,
    passed,
    failed,
    warned,
    warnings,
    errors,
    checks: checks.map((check) => ({ ...check, status: check.severity, detail: check.message, matches: check.details?.matches ?? check.details?.exposed ?? [] })),
    userIsGM,
    scannedAsPlayer: userIsGM !== true,
    scannedSelectors,
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
    completedAt: "2026-07-01T00:00:00.000Z",
    travelV2EventOutcomeApplication: { applied: true, before: { hull: 1 }, after: { hull: 2 }, rawApplicationRecord: true },
    travelV2FinalOutcomeShipApplication: { applied: true, targetActorId: "ship-secret", targetActorUuid: "Actor.ship-secret", before: { supplies: 1 }, after: { supplies: 2 }, supportedRows: [{ key: "supplies" }], unsupportedRows: [], deferredRows: [] },
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
  const nonGmRunnerState = prepareTravelEventRunnerState(session, { user: { id: "player-check", isGM: false } });
  const nonGmState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
    session,
    user: { id: "player-check", isGM: false }
  });

  addStateExposureCheck(
    checks,
    "travel-v2-non-gm-runner-state-forbidden-state",
    "Non-GM runner state exposes forbidden terms",
    nonGmRunnerState
  );

  addStateExposureCheck(
    checks,
    "travel-v2-non-gm-app-state-forbidden-state",
    "Non-GM app/preview state exposes forbidden terms",
    nonGmState
  );

  const checklistSafe = nonGmRunnerState.completionChecklist?.visible !== true;
  addCheck(
    checks,
    "travel-v2-non-gm-completion-checklist-hidden",
    "Non-GM completion checklist hidden/player-safe",
    checklistSafe ? "pass" : "fail",
    checklistSafe ? "Non-GM completion checklist is hidden." : "Non-GM completion checklist is visible.",
    { visible: nonGmRunnerState.completionChecklist?.visible === true }
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

function runDomChecks(checks, { root = null, currentUserIsGm = false, includePlayerSafetyChecks = true, includeChatHistory = false } = {}) {
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
  const domEvidence = scanForbiddenTermEvidenceInRoot(scanRoot, FORBIDDEN_PLAYER_STATE_TERMS).filter((entry) => exposed.includes(entry.term));
  addCheck(
    checks,
    "travel-v2-player-dom-forbidden-terms",
    "Player DOM forbidden text scan",
    currentUserIsGm ? "skip" : (exposed.length === 0 ? "pass" : "fail"),
    currentUserIsGm
      ? "GM DOM was scanned; GM-only terms visible to the GM do not prove player exposure. Run runPlayerSafetyCheck from Player2 to verify player DOM."
      : (exposed.length === 0
        ? "Current player DOM does not contain known player-forbidden Travel v2 workflow/internal terms."
        : `${exposed.join(", ")} found in current player DOM.`),
    { exposed, matches: domEvidence, currentUserIsGm, scannedSelectors: [getNodeSelector(scanRoot)] }
  );

  const hudExposed = scanForbiddenTermsInRoot(scanRoot, FORBIDDEN_PLAYER_HUD_TERMS);
  const hudEvidence = scanForbiddenTermEvidenceInRoot(scanRoot, FORBIDDEN_PLAYER_HUD_TERMS).filter((entry) => hudExposed.includes(entry.term));
  addCheck(
    checks,
    "travel-v2-player-hud-safety",
    "Player HUD safety",
    currentUserIsGm ? "skip" : (hudExposed.length === 0 ? "pass" : "fail"),
    currentUserIsGm
      ? "GM DOM was scanned; GM queue/control terms visible to the GM do not prove player HUD exposure. Run as Player2/non-GM for proof."
      : (hudExposed.length === 0
        ? "Player-facing DOM does not show known GM queue/control terms."
        : `${hudExposed.join(", ")} found.`),
    { exposed: hudExposed, matches: hudEvidence, currentUserIsGm, scannedSelectors: [getNodeSelector(scanRoot)] }
  );


  const chatHistoryExposed = scanForbiddenTermsInChatHistory(scanRoot, FORBIDDEN_PLAYER_STATE_TERMS);
  if (includeChatHistory) {
    addCheck(
      checks,
      "travel-v2-player-chat-history-forbidden-terms",
      "Chat/sidebar history forbidden text scan",
      chatHistoryExposed.length === 0 ? "pass" : "warn",
      chatHistoryExposed.length === 0
        ? "Chat/sidebar history does not contain known Travel v2 forbidden terms."
        : "Historical chat/sidebar content contains forbidden Travel v2 terms. This may be old public chat history, not active player UI. Clear or delete the old chat message if players should not see it.",
      { exposed: chatHistoryExposed, includeChatHistory }
    );
  } else {
    addCheck(
      checks,
      "travel-v2-player-chat-history-forbidden-terms",
      "Chat/sidebar history forbidden text scan",
      "skip",
      "Chat/sidebar history scan was not requested. Pass includeChatHistory: true to report historical chat/sidebar matches as warnings.",
      { includeChatHistory }
    );
  }

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
      user: options.user ?? { id: globalThis.game?.user?.id ?? "player-check", isGM: false }
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
      includePlayerSafetyChecks: opts.includePlayerSafetyChecks,
      includeChatHistory: opts.includeChatHistory === true
    });
  }
  if (opts.includePermissionChecks) runPermissionAudit(checks, opts);

  return buildArcflightFoundryCheckResult("travel-v2", checks);
}

export function runPlayerTravelV2DomSafetyCheck(options = {}) {
  const checks = [];
  runDomChecks(checks, {
    root: options.root,
    currentUserIsGm: globalThis.game?.user?.isGM === true,
    includePlayerSafetyChecks: true,
    includeChatHistory: options.includeChatHistory === true
  });
  runPlayerStateChecks(checks, options);
  return buildArcflightFoundryCheckResult("travel-v2", checks);
}

export const runTravelV2PlayerSafetyCheck = runPlayerTravelV2DomSafetyCheck;

export const __test = {
  addCheck,
  createCheckSession,
  runDomChecks,
  runPermissionAudit,
  runPlayerStateChecks,
  runStateChecks
};
