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
  const { sendTravelPlayerMissionBoardToPlayers } = await import("./travel-player-station-card.js");
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

  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./travel-player-station-card.js", import.meta.url), "utf8"));
  assertSmoke(source.includes("if (globalThis.game?.user?.isGM !== true) return true;") && source.includes("TRAVEL_PLAYER_STATION_ROLL_ACTION"), "GM-only socket action handlers still require GM users");
  assertSmoke(source.includes("optionKey, selectedFocusAbility: station.selectedFocusAbility"), "mission board roll routing includes the selected option key and Focus selection");

  return { ok: true, checked: ["default-no-recipient-quiet", "debug-setting-enabled", "explicit-debug-option", "player2-safe-mission-board", "gm-only-handler-gates", "mission-board-roll-routing"] };
}

export default runTravelPlayerMissionBoardBroadcastDebugSmokeChecks;
