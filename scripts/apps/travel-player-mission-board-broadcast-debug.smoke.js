function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel player mission board broadcast debug smoke check failed: ${message}`); }

async function waitForDebounce() {
  await new Promise((resolve) => setTimeout(resolve, 5));
}

function installFoundryStub(settingsGet = () => false) {
  globalThis.foundry ??= { applications: { api: {} } };
  globalThis.foundry.applications ??= { api: {} };
  globalThis.foundry.applications.api.ApplicationV2 ??= class ApplicationV2 {};
  globalThis.foundry.applications.api.HandlebarsApplicationMixin ??= (Base) => Base;
  globalThis.game = {
    users: [],
    settings: { get: settingsGet },
    socket: { emit() {} }
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

  return { ok: true, checked: ["default-no-recipient-quiet", "debug-setting-enabled", "explicit-debug-option"] };
}

export default runTravelPlayerMissionBoardBroadcastDebugSmokeChecks;
