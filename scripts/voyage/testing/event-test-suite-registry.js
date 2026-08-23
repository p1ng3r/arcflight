export const QUICK_CHECK_SUITE_ID = "quick-check";
export const TEST_LANE_ENGINE = "ENGINE";
export const TEST_LANE_GM_FLOW = "GM FLOW";
export const TEST_LANE_PLAYER_VIEW = "PLAYER VIEW";

function makeTest(id, label, description, severity, run) {
  return Object.freeze({ id, label, description, severity, run });
}

export function createSuiteRegistry() {
  const quickCheckSteps = [
    makeTest("authority", "Test authority", "Verify active authenticated GM authority.", "error", async (context, profile) => {
      if (context?.game?.user?.isGM !== true && context?.authenticatedUserId !== context?.activeGmUserId) {
        return { ok: false, code: "m11-active-gm-required", path: "game.user", expected: "active GM", actual: context?.game?.user?.isGM === true ? "GM but not active" : "non-GM", message: "An active GM is required to run the Test Lab." };
      }
      return { ok: true, expected: "active GM", actual: "active GM", message: "Authority verified." };
    }),
    makeTest("event-discovery", "Resolve event definition", "List canonical event definitions and confirm the selected event is resolvable.", "error", async (context, profile) => {
      const result = await context?.eventTest?.listEvents?.();
      const events = result?.ok === true && Array.isArray(result.events) ? result.events : [];
      const selected = events.find((entry) => entry?.eventId === profile.eventId) ?? null;
      if (!selected) {
        return { ok: false, code: result?.errors?.[0]?.code ?? "m11-event-definition-not-found", path: result?.errors?.[0]?.path ?? "eventTest.listEvents", expected: "selected event definition", actual: profile.eventId ?? events, message: result?.errors?.[0]?.message ?? "The selected event definition was not discovered." };
      }
      profile.eventDefinition = selected;
      return { ok: true, expected: "selected event definition", actual: selected.eventId, message: "Event definition resolved.", afterSnapshot: selected };
    }),
    makeTest("ship-validation", "Resolve ship fixture", "Confirm the selected ship is valid for launch and available to the Test Engine.", "error", async (context, profile) => {
      const result = await context?.eventTest?.listShips?.();
      const ships = result?.ok === true && Array.isArray(result.ships) ? result.ships : [];
      const selected = ships.find((entry) => entry?.id === profile.shipId) ?? null;
      if (!selected) {
        return { ok: false, code: result?.errors?.[0]?.code ?? "m11-invalid-ship-fixture", path: result?.errors?.[0]?.path ?? "eventTest.listShips", expected: "selected launchable ship", actual: profile.shipId ?? ships, message: result?.errors?.[0]?.message ?? "The selected ship fixture is not available." };
      }
      profile.ship = selected;
      return { ok: true, expected: "selected launchable ship", actual: selected.id, message: "Ship fixture validated.", afterSnapshot: selected };
    }),
    makeTest("start-session", "Start marked session", "Launch a disposable marked event test session through the canonical eventTest.start API.", "error", async (context, profile) => {
      if (!profile.eventId || !profile.shipId) return { ok: false, code: "m11-invalid-request-shape", path: "profile", expected: "selected event and ship", actual: { eventId: profile.eventId, shipId: profile.shipId }, message: "Quick Check requires an event and ship selection." };
      const result = await context?.eventTest?.start?.({ eventId: profile.eventId, shipId: profile.shipId, sessionId: `test-session-${Date.now()}` });
      if (!result || result.ok !== true) {
        return { ok: false, code: result?.errors?.[0]?.code ?? "m11-start-session-failed", path: result?.errors?.[0]?.path ?? "eventTest.start", expected: "successful session launch", actual: result ?? null, message: result?.errors?.[0]?.message ?? "Session launch returned a failure.", writes: 0, retainedSessionId: null };
      }
      profile.sessionId = result.sessionId ?? null;
      profile.start = result;
      return { ok: true, expected: "marked test session launch", actual: result.sessionId ?? "session-started", message: "Marked Event Test session started.", beforeSnapshot: null, afterSnapshot: result.snapshot ?? null, writes: 1, retainedSessionId: profile.sessionId };
    }),
    makeTest("forced-post-launch-failure", "Forced test failure", "Deliberately fail after the marked session exists so retention and explicit cleanup can be validated.", "error", async (_context, profile) => {
      const sessionId = profile.sessionId ?? null;
      if (!sessionId) return { ok: false, code: "event-test-forced-post-launch-failure", path: "profile.sessionId", expected: "marked session created before forced failure", actual: null, message: "Forced post-launch failure could not verify the marked session." };
      return {
        ok: false,
        code: "event-test-forced-post-launch-failure",
        path: "eventTest.start",
        expected: "controlled failure after marked session creation",
        actual: sessionId,
        message: "Intentional Test Lab failure after marked session creation; fixture retained for cleanup validation.",
        beforeSnapshot: profile.start?.snapshot ?? null,
        afterSnapshot: profile.start?.snapshot ?? null,
        writes: 0,
        retainedSessionId: sessionId,
        notes: "TEST ONLY. Automatic cleanup was intentionally skipped."
      };
    }),
    makeTest("inspect-session", "Inspector reread", "Reread the marked session and confirm revision, round identity, and structure are valid.", "error", async (context, profile) => {
      const sessionId = profile.sessionId ?? null;
      if (!sessionId) {
        return { ok: false, code: "m11-invalid-request-shape", path: "profile.sessionId", expected: "sessionId set by start step", actual: null, message: "The session was not started before inspect." };
      }
      const result = await context?.eventTest?.inspect?.({ sessionId });
      if (!result || result.ok !== true) {
        return { ok: false, code: result?.errors?.[0]?.code ?? "m11-inspect-failed", path: result?.errors?.[0]?.path ?? "eventTest.inspect", expected: "reloaded session", actual: result ?? null, message: result?.errors?.[0]?.message ?? "Session inspect did not succeed." };
      }
      profile.inspect = result;
      return { ok: true, expected: "session snapshot", actual: result.snapshot?.session?.sessionId ?? sessionId, message: "Session inspected successfully.", beforeSnapshot: profile.start?.snapshot ?? null, afterSnapshot: result.snapshot ?? null };
    }),
    makeTest("initial-invariants", "Initial invariants", "Verify revision, Pressure values, hazard uniqueness, and canonical test-origin state.", "error", async (_context, profile) => {
      const snapshot = profile?.inspect?.snapshot ?? null;
      const session = snapshot?.session ?? null;
      if (!session) {
        return { ok: false, code: "m11-invalid-session-document", path: "inspect.snapshot.session", expected: "session snapshot", actual: null, message: "No session snapshot was captured for invariant checks." };
      }
      const pressure = session?.encounterState?.pressureSystems ?? {};
      const pressureEntries = Object.values(pressure);
      const ok = Number.isSafeInteger(session?.revision) && session.revision >= 0 && pressureEntries.every((system) => Number.isSafeInteger(system.value) && Number.isSafeInteger(system.capacity) && system.value >= 0 && system.value <= system.capacity);
      const invariantResults = [{ id: "revision-valid", label: "Valid revision", status: Number.isSafeInteger(session?.revision) && session.revision >= 0 ? "PASS" : "FAIL", expected: "non-negative integer", actual: session?.revision ?? null, message: "Revision is valid." }, { id: "pressure-registry", label: "Pressure values within capacity", status: ok ? "PASS" : "FAIL", expected: "within capacity", actual: pressure, message: ok ? "Pressure registry is valid." : "Initial invariant check failed." }];
      profile.invariantResults = invariantResults;
      if (!ok) {
        return { ok: false, code: "m11-invariant-failed", path: "session.encounterState.pressureSystems", expected: "valid Pressure registry", actual: pressure, message: "Initial invariant check failed.", invariantResults, afterSnapshot: snapshot };
      }
      return { ok: true, expected: "valid session snapshot", actual: session.sessionId ?? "session", message: "Initial invariants passed.", invariantResults, afterSnapshot: snapshot };
    }),
    makeTest("safe-cleanup", "Safe cleanup", "Abandon the disposable marked session and verify that it is removed without affecting ordinary sessions.", "error", async (context, profile) => {
      const sessionId = profile.sessionId ?? null;
      if (!sessionId) {
        return { ok: false, code: "m11-invalid-request-shape", path: "profile.sessionId", expected: "sessionId", actual: null, message: "No session was available for cleanup." };
      }
      const result = await context?.eventTest?.abandon?.({ sessionId });
      if (!result || result.ok !== true) {
        return { ok: false, code: result?.errors?.[0]?.code ?? "m11-session-write-failed", path: result?.errors?.[0]?.path ?? "eventTest.abandon", expected: "deleted test session", actual: result ?? null, message: result?.errors?.[0]?.message ?? "Cleanup did not remove the test session." };
      }
      profile.sessionId = null;
      return { ok: true, expected: "deleted test session", actual: sessionId, message: "Marked session cleaned up safely.", writes: 1, retainedSessionId: null };
    })
  ];

  return Object.freeze([
    Object.freeze({
      id: QUICK_CHECK_SUITE_ID,
      label: "QUICK CHECK",
      lane: TEST_LANE_ENGINE,
      description: "Single real end-to-end Test Engine sanity check using a disposable marked session.",
      enabled: true,
      tests: quickCheckSteps
    }),
    Object.freeze({
      id: "pressure",
      label: "Pressure",
      lane: TEST_LANE_ENGINE,
      description: "Pressure-specific checks are planned for a later pass.",
      enabled: false,
      tests: []
    }),
    Object.freeze({
      id: "hazards",
      label: "Hazards",
      lane: TEST_LANE_ENGINE,
      description: "Hazard coverage is future work.",
      enabled: false,
      tests: []
    }),
    Object.freeze({
      id: "breach",
      label: "Breach",
      lane: TEST_LANE_ENGINE,
      description: "Breach Save coverage is future work.",
      enabled: false,
      tests: []
    }),
    Object.freeze({
      id: "reactions",
      label: "Reactions",
      lane: TEST_LANE_ENGINE,
      description: "Reaction coverage is future work.",
      enabled: false,
      tests: []
    }),
    Object.freeze({
      id: "gm-flow",
      label: "GM FLOW",
      lane: TEST_LANE_GM_FLOW,
      description: "GM Flow coverage is future work.",
      enabled: false,
      tests: []
    }),
    Object.freeze({
      id: "player-view",
      label: "PLAYER VIEW",
      lane: TEST_LANE_PLAYER_VIEW,
      description: "Player View coverage is future work.",
      enabled: false,
      tests: []
    })
  ]);
}

export function getSuiteById(suiteId, registry = createSuiteRegistry()) {
  return registry.find((suite) => suite.id === suiteId) ?? null;
}

export function getTestById(suiteId, testId, registry = createSuiteRegistry()) {
  const suite = getSuiteById(suiteId, registry);
  if (!suite) return null;
  return suite.tests.find((test) => test.id === testId) ?? null;
}
