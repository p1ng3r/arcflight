function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel player mission board broadcast debug smoke check failed: ${message}`); }

async function waitForDebounce() {
  await new Promise((resolve) => setTimeout(resolve, 5));
}

function installFoundryStub(settingsGet = () => false, socketEmit = () => {}) {
  globalThis.foundry ??= { applications: { api: {} } };
  globalThis.foundry.applications ??= { api: {} };
  globalThis.foundry.applications.api.ApplicationV2 ??= class ApplicationV2 {};
  globalThis.foundry.applications.api.HandlebarsApplicationMixin ??= (Base) => Base;
  globalThis.game = {
    users: [],
    settings: { get: settingsGet },
    socket: { emit: socketEmit }
  };
  globalThis.CONST ??= { DOCUMENT_OWNERSHIP_LEVELS: { OBSERVER: 2 } };
}

function sampleSession() {
  return {
    key: "mission-board-debug-smoke",
    status: "active",
    currentRoundIndex: 0,
    event: { id: "debug-smoke-event", name: "Debug Smoke Event", rounds: [] },
    roundResults: []
  };
}

export async function runTravelPlayerMissionBoardBroadcastDebugSmokeChecks() {
  installFoundryStub(() => false);
  const {
    TRAVEL_MISSION_BOARD_BROADCAST_DEBUG_SETTING,
    queueTravelPlayerMissionBoardRefreshToPlayers
  } = await import("./travel-player-station-card.js");

  const quietDebugEntries = [];
  const quietWarnEntries = [];
  const originalDebug = console.debug;
  const originalWarn = console.warn;
  console.debug = (...args) => quietDebugEntries.push(args);
  console.warn = (...args) => quietWarnEntries.push(args);
  try {
    queueTravelPlayerMissionBoardRefreshToPlayers(sampleSession(), { delayMs: 0 });
    await waitForDebounce();
  } finally {
    console.debug = originalDebug;
    console.warn = originalWarn;
  }
  assertSmoke(!quietDebugEntries.some((entry) => entry[0] === "Arcflight | Debounced mission board refresh broadcast result."), "default no-recipient debounced refresh does not print debug diagnostics");
  assertSmoke(quietWarnEntries.length === 0, "default no-recipient debounced refresh does not warn");

  installFoundryStub((moduleId, settingKey) => moduleId === "arcflight" && settingKey === TRAVEL_MISSION_BOARD_BROADCAST_DEBUG_SETTING);
  const enabledEntries = [];
  console.debug = (...args) => enabledEntries.push(args);
  try {
    queueTravelPlayerMissionBoardRefreshToPlayers({ ...sampleSession(), key: "mission-board-debug-enabled-smoke" }, { delayMs: 0 });
    await waitForDebounce();
  } finally {
    console.debug = originalDebug;
  }
  const diagnostic = enabledEntries.find((entry) => entry[0] === "Arcflight | Debounced mission board refresh broadcast result.");
  assertSmoke(Boolean(diagnostic), "mission board broadcast diagnostic can be enabled with the debug setting");
  assertSmoke(diagnostic?.[1]?.errors?.includes("No active non-GM users found."), "enabled diagnostic includes the no-recipient result details");

  const explicitEntries = [];
  console.debug = (...args) => explicitEntries.push(args);
  try {
    queueTravelPlayerMissionBoardRefreshToPlayers({ ...sampleSession(), key: "mission-board-debug-option-smoke" }, { delayMs: 0, debugMissionBoardBroadcasts: true });
    await waitForDebounce();
  } finally {
    console.debug = originalDebug;
  }
  assertSmoke(explicitEntries.some((entry) => entry[0] === "Arcflight | Debounced mission board refresh broadcast result."), "mission board broadcast diagnostic can be enabled with an explicit option");


  const emittedPayloads = [];
  installFoundryStub(() => false, (_channel, payload) => emittedPayloads.push(payload));
  globalThis.game.user = { id: "player2", isGM: false };
  globalThis.game.users = [{ id: "player2", name: "Player2", active: true, isGM: false }];
  globalThis.game.actors = [{ id: "actor2", uuid: "Actor.actor2", name: "Player Two", ownership: { player2: 3 } }];
  const { ArcflightTravelPlayerMissionBoard, sendTravelPlayerMissionBoardToPlayers } = await import("./travel-player-station-card.js");
  const publicSession = {
    key: "mission-board-player-safe-smoke",
    status: "active",
    currentRoundIndex: 0,
    travelV2Momentum: { value: 1, max: 3, earnedTotal: 2, spentTotal: 1, helpText: "Use Momentum together." },
    stationAssignments: { navigator: { actorId: "actor2", actorUuid: "Actor.actor2", actorName: "Player Two" } },
    event: { name: "Safe Crossing", rounds: [{ roundNumber: 1, title: "Open Lane", activeStations: ["navigator"], vignette: "A clear player-facing route." }] },
    roundResults: [],
    travelV2Hazards: { records: [
      { id: "hidden", name: "Hidden Teeth", revealed: false, status: "active", playerText: "DO NOT LEAK HIDDEN", gmText: "GM SECRET HAZARD", gmMechanicalNotes: "SECRET MECH" },
      { id: "revealed", name: "Revealed Wake", revealed: true, status: "active", playerText: "The wake shivers in view.", gmText: "GM SECRET REVEALED", unresolvedConsequence: { label: "Pending Queue Label" } }
    ] },
    shipScars: { records: [
      { id: "pending-scar", name: "Pending Scar Internal", status: "pending", playerText: "DO NOT LEAK SCAR", gmText: "GM SECRET SCAR" },
      { id: "applied-scar", name: "Singing Hull", status: "applied", playerVisible: true, playerText: "The hull hums under strain.", gmText: "GM ONLY SCAR INTERNAL", internalMutation: "secret" }
    ] },
    travelV2PendingConsequenceQueue: { records: [{ queueKey: "secret", statusLabel: "Needs Selection", selectedConsequence: { title: "Arkengine Whine" } }] }
  };
  const sent = sendTravelPlayerMissionBoardToPlayers(publicSession);
  assertSmoke(sent.ok === true && emittedPayloads.length === 1, "mission board emits to active Player2");
  const playerSafeSnapshot = JSON.stringify(emittedPayloads[0].state);
  assertSmoke(playerSafeSnapshot.includes("Player Two") && playerSafeSnapshot.includes("Revealed Wake") && playerSafeSnapshot.includes("Ship Scar") && playerSafeSnapshot.includes('"momentum":{"value":1'), "Player2 payload keeps player-safe station, revealed hazard, revealed scar, and Momentum text");
  for (const forbidden of ["GM SECRET", "SECRET MECH", "unresolvedConsequence", "Pending Queue Label", "travelV2PendingConsequenceQueue", "Needs Selection", "Arkengine Whine", "Hidden Teeth", "DO NOT LEAK HIDDEN", "Pending Scar Internal", "DO NOT LEAK SCAR", "GM ONLY SCAR INTERNAL", "internalMutation"]) {
    assertSmoke(!playerSafeSnapshot.includes(forbidden), `Player2 payload omits GM-only/internal field ${forbidden}`);
  }


  const helperModule = await import("../helpers/travel-event-runner.js");
  const feedback = { criticalSuccess: "Clean route.", success: "Route holds.", failure: "Route slips.", criticalFailure: "Route collapses." };
  const started = helperModule.createTravelEventRunnerSession({
    key: "socket-flow-event",
    name: "Socket Flow Event",
    category: "navigation",
    baseDC: 15,
    roundCount: 1,
    tags: ["smoke"],
    activeResources: ["strain"],
    travelStations: ["navigator"],
    rounds: [{ roundNumber: 1, title: "Socket Round", activeStations: ["navigator"], primaryPressure: "strain", outcomeBranches: { dominantSuccess: "Win.", mixed: "Mixed.", dominantFailure: "Fail.", catastrophicFailure: "Crash." }, stationPrompts: { navigator: { stationKey: "navigator", playerAction: "Plot the route.", suggestedSkills: ["perception"], rollFeedback: feedback } }, stationCards: [{ stationKey: "navigator", rollFeedback: feedback, skillApproaches: [{ label: "Plot", skill: "perception", helpText: "Plot safely.", boardResultFeedback: feedback, gmNarrationFeedback: feedback }] }] }],
    finalOutcomes: { majorVictory: { text: "Great." }, victory: { text: "Good." }, costlySuccess: { text: "Costly." }, failure: { text: "Bad." }, catastrophicFailure: { text: "Worst." } }
  }, { now: "2026-06-29T00:00:00.000Z", ship: { actorId: "ship1", actorUuid: "Actor.ship1", name: "Arc Runner" } });
  assertSmoke(started.ok === true && typeof started.session.key === "string" && started.session.key.length > 0, "new local runner sessions receive a non-empty session key");
  const missionState = helperModule.prepareTravelPlayerMissionBoardState(started.session);
  assertSmoke(missionState.sessionKey === started.session.key, "player mission board carries the runner session key");
  const normalizedLegacyA = helperModule.normalizeTravelEventRunnerSession({ ...started.session, key: "" }, { now: "2026-06-29T00:00:00.000Z" }).session;
  const normalizedLegacyB = helperModule.normalizeTravelEventRunnerSession({ ...started.session, key: "" }, { now: "2026-06-30T00:00:00.000Z" }).session;
  assertSmoke(normalizedLegacyA.key && normalizedLegacyA.key === normalizedLegacyB.key, "legacy keyless runner sessions normalize to a stable non-empty key");
  const failed = helperModule.setTravelEventRunnerStationResult(started.session, 0, "navigator", "failure", { now: "2026-06-29T00:01:00.000Z" });
  assertSmoke(failed.ok === true && failed.session.key === started.session.key, "station result updates preserve the runner session key");
  const prompt = failed.session.reactionPrompts.records.find((record) => record.stationKey === "navigator" && record.status === "pending");
  assertSmoke(Boolean(prompt), "eligible station failure creates a reaction prompt");
  const playerSafeResultState = helperModule.prepareTravelPlayerMissionBoardState(failed.session).stations.find((station) => station.stationKey === "navigator");
  assertSmoke(playerSafeResultState?.hasResult === true && playerSafeResultState?.canRollStation === false && playerSafeResultState?.rollDetailText === "", "player-safe station result state marks completed station rolls as not rollable without leaking roll detail internals");
  assertSmoke(playerSafeResultState?.focusReactionAvailable === true || playerSafeResultState?.statusKey === "reaction", "player-safe station result state exposes Focus reaction availability");
  const promptState = helperModule.prepareTravelPlayerReactionPromptState(failed.session, prompt.reactionPromptId, { userId: "player2", permittedUserIds: ["player2"] });
  assertSmoke(promptState.sessionKey === started.session.key, "reaction prompt delivery carries the same runner session key");
  const accepted = helperModule.acceptTravelReactionPrompt(failed.session, prompt.reactionPromptId, { userId: "player2", userName: "Player2", now: "2026-06-29T00:02:00.000Z" });
  assertSmoke(accepted.ok === true && accepted.session.key === started.session.key, "Focus reaction responses preserve the same runner session key");
  const acceptedState = helperModule.prepareTravelPlayerMissionBoardState(accepted.session).stations.find((station) => station.stationKey === "navigator");
  assertSmoke(acceptedState?.hasResult === false && acceptedState?.focusReactionAccepted === true && acceptedState?.focusRerollNeeded === true, "Focus acceptance clears the result and exposes the reroll-needed path");
  const acceptedBoard = new ArcflightTravelPlayerMissionBoard({ state: { hasSession: true, sessionKey: started.session.key, currentRoundIndex: 0, stations: [acceptedState] } });
  const acceptedBoardStation = acceptedBoard.boardState.stations.find((station) => station.stationKey === "navigator");
  assertSmoke(acceptedBoardStation?.focusReactionAccepted === true && acceptedBoardStation?.focusRerollNeeded === true && acceptedBoardStation?.reactionStatusLabel === "Focus accepted; reroll needed.", "mission board sanitizer preserves Focus accepted and reroll-needed fields for station-card opening");
  const rerolled = helperModule.setTravelEventRunnerStationResult(accepted.session, 0, "navigator", "success", { now: "2026-06-29T00:03:00.000Z" });
  assertSmoke(rerolled.ok === true && rerolled.session.key === started.session.key, "reaction reroll resolution through station-result logic preserves the same runner session key");
  const rerollRecord = rerolled.session.reactionPrompts.records.find((record) => record.reactionPromptId === prompt.reactionPromptId);
  assertSmoke(rerollRecord?.rerollResult === "success" && rerollRecord?.status === "resolved", "station-result reroll records the reroll result and resolves the prompt");
  assertSmoke(!rerolled.session.reactionPrompts.records.some((record) => record.stationKey === "navigator" && record.status === "pending"), "resolved reroll leaves no pending reaction for Navigator");
  const resolvedMissionState = helperModule.prepareTravelPlayerMissionBoardState(rerolled.session).stations.find((station) => station.stationKey === "navigator");
  assertSmoke(resolvedMissionState?.focusRerollResolved === true && resolvedMissionState?.focusRerollResultLabel === "Success", "player mission board exposes resolved reroll result labels");
  const rerolledState = { ...resolvedMissionState, reactionStatusLabel: "Reroll resolved: Success." };
  const rerolledBoard = new ArcflightTravelPlayerMissionBoard({ state: { hasSession: true, sessionKey: started.session.key, currentRoundIndex: 0, stations: [rerolledState] } });
  const rerolledBoardStation = rerolledBoard.boardState.stations.find((station) => station.stationKey === "navigator");
  assertSmoke(rerolledBoardStation?.focusRerollResolved === true && rerolledBoardStation?.focusRerollResultLabel === "Success", "mission board sanitizer preserves Focus reroll-resolved fields for station-card opening");

  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./travel-player-station-card.js", import.meta.url), "utf8"));
  assertSmoke(source.includes("if (globalThis.game?.user?.isGM !== true) return true;") && source.includes("TRAVEL_PLAYER_STATION_ROLL_ACTION"), "GM-only socket action handlers still require GM users");
  assertSmoke(source.includes("optionKey, selectedFocusAbility: station.selectedFocusAbility"), "mission board roll routing includes the selected option key and Focus selection");
  assertSmoke(source.includes('console.debug("Arcflight | Player station card socket payload received."') && source.includes('console.debug("Arcflight | Opening player station card from socket."'), "benign player station card socket success diagnostics use debug logging");
  assertSmoke(!source.includes('console.warn("Arcflight | Opening player station card from socket."') && !source.includes('console.warn("Arcflight | Socket diagnostic received."'), "benign socket diagnostic success logs are not warning-level");

  const arcflightSource = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../arcflight.js", import.meta.url), "utf8"));
  assertSmoke(arcflightSource.includes("const { activeOverlay, session, requestedSessionKey, matched } = getActiveTravelRunnerSessionForPayload(payload);"), "player approach submit resolves sessions through the stable session-key helper");
  assertSmoke(arcflightSource.includes("Player station approach submission did not match an active Travel v2 runner session") && arcflightSource.includes("!matched"), "mismatched player approach-submit session keys are rejected instead of silently applied");
  assertSmoke(arcflightSource.includes("Duplicate player station roll request rejected") && arcflightSource.includes("This station already has a result. A new roll is only available after an accepted Focus reroll clears the result."), "GM-side duplicate player roll requests are rejected before repeated permission validation");
  const devBlockMatch = arcflightSource.match(/dev:\s*\{[\s\S]*?\r?\n\s*\},\r?\n\s*get ArcflightItemSheet/);
  const devBlockSource = devBlockMatch?.[0] ?? "";
  const requiredDevHelpers = [
    "runFoundryChecks",
    "runPlayerSafetyCheck",
    "forceTravelStationResult",
    "inspectTravelPlayerFlow",
    "validateTravelPlayerFlow",
    "inspectTravelRoundResolution",
    "inspectTravelConsequenceFlow",
    "inspectTravelConsequenceApplicationFlow",
    "inspectTravelGmUiFlow",
    "inspectTravelAdvanceRoundFlow",
    "inspectTravelEventCompletionFlow",
    "forceTravelRoundResolved",
    "forceTravelRoundFinalized",
    "forceTravelConsequenceApplied",
    "forceTravelRoundAdvanced",
    "forceTravelEventCompleted"
  ];
  assertSmoke(Boolean(devBlockMatch) && requiredDevHelpers.every((helper) => devBlockSource.includes(helper)), "Travel player-flow dev helpers are exposed through CONFIG.arcflight.dev");
  assertSmoke(arcflightSource.includes('game.settings.register(ARCFLIGHT.MODULE_ID, TRAVEL_REACTION_DEBUG_SETTING') && arcflightSource.includes('const TRAVEL_REACTION_DEBUG_SETTING = "debugTravelReactions"'), "debugTravelReactions is registered as the Travel Reaction debug setting");
  assertSmoke(arcflightSource.includes('if (globalThis.game?.settings?.get?.(ARCFLIGHT.MODULE_ID, TRAVEL_REACTION_DEBUG_SETTING) !== true) return;') && arcflightSource.includes('debugTravelReaction("GM received player reaction response."'), "verbose GM Travel Reaction success logs are gated behind debugTravelReaction");
  assertSmoke(arcflightSource.includes('console.warn("Arcflight | Duplicate player station roll request rejected."') && !arcflightSource.includes('debugTravelReaction("Player station roll request rejected.'), "bad-path player station roll warnings remain visible without the debug setting");
  assertSmoke(arcflightSource.includes('globalThis.game?.user?.isGM !== true') && arcflightSource.includes("isTravelV2DevToolsEnabled() !== true"), "Travel player-flow dev helpers are GM/dev gated");
  assertSmoke(arcflightSource.includes("canRoll: station.canRollStationCheck === true && station.hasResult !== true") && !arcflightSource.includes("canRoll: station.canRollStation === true"), "Travel player-flow inspection uses the overlay station rollability field");
  assertSmoke(arcflightSource.includes("function getTravelPlayerFlowStationReport") && arcflightSource.includes("rollUnavailableReason") && arcflightSource.includes("permittedUserNames") && arcflightSource.includes("rerollResult"), "Travel player-flow inspection reports compact station permission and reroll state");
  assertSmoke(arcflightSource.includes("async function validateTravelPlayerFlow()") && arcflightSource.includes("accepted Focus without reroll-needed") && arcflightSource.includes("playerSafetyNotes"), "Travel player-flow validation helper detects obvious invalid states without exposing GM internals");
  assertSmoke(arcflightSource.includes("setTravelEventRunnerStationResult(session, roundIndex, stationKey, result)") && arcflightSource.includes("sendTravelPlayerReactionPromptToPlayers(updated.session, prompt.reactionPromptId"), "forced station result helper reuses station-result logic and existing reaction prompt delivery");

  return { ok: true, checked: ["default-no-recipient-quiet", "debug-setting-enabled", "explicit-debug-option", "player2-safe-mission-board", "stable-session-key-flow", "player-safe-roll-result-state", "duplicate-roll-request-guard", "focus-reroll-allowed", "mission-board-focus-fields-preserved", "approach-submit-session-key-guard", "gm-only-handler-gates", "mission-board-roll-routing", "benign-socket-debug-logging", "travel-player-flow-dev-helper-source", "travel-player-flow-inspect-rollability-source"] };
}

export default runTravelPlayerMissionBoardBroadcastDebugSmokeChecks;
