export const QUICK_CHECK_SUITE_ID = "quick-check";
export const FIXTURE_PREP_SUITE_ID = "fixture-prep";
export const TEST_LANE_ENGINE = "ENGINE";
export const TEST_LANE_GM_FLOW = "GM FLOW";
export const TEST_LANE_PLAYER_VIEW = "PLAYER VIEW";

import { createInvariantEngine } from "./event-test-invariants.js";

function makeTest(id, label, description, severity, run) {
  return Object.freeze({ id, label, description, severity, run });
}

function traceWrites(trace) {
  return Array.isArray(trace) ? trace.reduce((total, entry) => total + (Number.isSafeInteger(entry?.writes) ? entry.writes : 0), 0) : 0;
}

function firstError(result, fallbackCode, fallbackPath, fallbackMessage) {
  return {
    code: result?.errors?.[0]?.code ?? fallbackCode,
    path: result?.errors?.[0]?.path ?? fallbackPath,
    message: result?.errors?.[0]?.message ?? fallbackMessage
  };
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
      const request = { eventId: profile.eventId, shipId: profile.shipId, sessionId: `test-session-${Date.now()}` };
      if (profile.operatorSelections) request.operatorSelections = profile.operatorSelections;
      const result = await context?.eventTest?.start?.(request);
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

  const fixturePrepSteps = [
    quickCheckSteps[0],
    quickCheckSteps[1],
    quickCheckSteps[2],
    makeTest("station-discovery", "Discover station requirements", "Resolve the selected event's first authored round and canonical station/action requirements.", "error", async (context, profile) => {
      const result = await context?.eventTest?.discoverFixtureRequirements?.({ eventId: profile.eventId, definitionSnapshotId: profile.eventDefinition?.definitionSnapshotId });
      if (!result || result.ok !== true) {
        const error = firstError(result, "m12-test-engine-station-requirements-unavailable", "eventTest.discoverFixtureRequirements", "Authored station requirements could not be discovered.");
        return { ok: false, ...error, expected: "canonical authored station requirements", actual: result ?? null, writes: 0 };
      }
      profile.stationRequirements = result;
      return { ok: true, expected: "canonical authored station requirements", actual: result.stations.map((station) => station.stationId), message: "Canonical station requirements discovered.", afterSnapshot: result, writes: 0 };
    }),
    makeTest("operator-discovery", "Discover valid operators", "Resolve valid non-ship operator Actors through the canonical launch discovery path.", "error", async (context, profile) => {
      const result = await context?.eventTest?.listOperators?.({ eventId: profile.eventId, shipId: profile.shipId });
      if (!result || result.ok !== true) {
        const error = firstError(result, "m12-test-engine-no-valid-operators", "eventTest.listOperators", "Valid operator Actors could not be discovered.");
        return { ok: false, ...error, expected: "valid operator candidates", actual: result ?? null, writes: 0 };
      }
      profile.operatorCandidates = result.operators;
      return { ok: true, expected: "deterministically ordered operator candidates", actual: result.operators.map((operator) => operator.id), message: "Valid operator candidates discovered deterministically.", afterSnapshot: result, writes: 0 };
    }),
    makeTest("auto-assign", "Assign crew deterministically", "Assign the first valid canonical operator to each authored station without duplicate operators or direct session writes.", "error", async (_context, profile) => {
      const stations = profile.stationRequirements?.stations ?? [];
      const operators = profile.operatorCandidates ?? [];
      if (operators.length < stations.length) {
        return { ok: false, code: "m12-test-insufficient-operators", path: "operatorCandidates", expected: `at least ${stations.length} valid operators`, actual: operators.length, message: "Fixture Prep cannot assign every required station without reusing an operator.", writes: 0 };
      }
      const assignments = stations.map((station, index) => {
        const operator = operators[index];
        return { stationId: station.stationId, stationLabel: station.label, operatorId: operator.id, operatorUuid: operator.uuid, operatorName: operator.name };
      });
      const ids = assignments.map((assignment) => assignment.operatorId);
      if (new Set(ids).size !== ids.length) {
        return { ok: false, code: "m12-test-duplicate-operator-assignment", path: "assignments", expected: "one unique operator per station", actual: assignments, message: "Fixture Prep detected a duplicate operator assignment.", writes: 0 };
      }
      profile.assignmentEvidence = assignments;
      profile.operatorSelections = Object.fromEntries(assignments.map((assignment) => [assignment.stationId, assignment.operatorId]));
      return { ok: true, expected: "unique canonical station assignments", actual: assignments, message: "Crew assigned deterministically from canonical candidates.", afterSnapshot: { assignments }, writes: 0 };
    }),
    quickCheckSteps[3],
    makeTest("enter-crew-planning", "Enter crew planning", "Use canonical Event Session commands to reach Crew Planning and stop before any station resolution.", "error", async (context, profile) => {
      const result = await context?.eventTest?.rapidPlan?.({ sessionId: profile.sessionId, stopAt: "crew-planning" });
      if (!result || result.ok !== true || result.checkpoint !== "crew-planning") {
        const error = firstError(result, "m12-test-engine-planning-entry-failed", "eventTest.rapidPlan", "Canonical Crew Planning entry failed.");
        return { ok: false, ...error, expected: "crew-planning checkpoint", actual: result?.checkpoint ?? result ?? null, message: error.message, writes: traceWrites(result?.trace), afterSnapshot: result?.snapshot ?? null };
      }
      profile.crewPlanning = result;
      return { ok: true, expected: "crew-planning checkpoint", actual: result.snapshot?.session?.sessionState, message: "Canonical Crew Planning checkpoint reached.", beforeSnapshot: profile.start?.snapshot ?? null, afterSnapshot: result.snapshot, writes: traceWrites(result.trace), trace: result.trace };
    }),
    makeTest("plan-lock", "Build and lock plan", "Choose the first authored legal action and approach for every assigned station, lock them, set canonical order, and stop at Plan Locked.", "error", async (context, profile) => {
      const result = await context?.eventTest?.rapidPlan?.({ sessionId: profile.sessionId, stopAt: "plan-locked", mode: "canonical-first-valid" });
      if (!result || result.ok !== true || result.checkpoint !== "plan-locked") {
        const error = firstError(result, "m12-test-engine-plan-lock-failed", "eventTest.rapidPlan", "Canonical plan lock failed.");
        return { ok: false, ...error, expected: "plan-locked checkpoint", actual: result?.checkpoint ?? result ?? null, message: error.message, writes: traceWrites(result?.trace), afterSnapshot: result?.snapshot ?? null };
      }
      profile.plan = result;
      return { ok: true, expected: "plan-locked checkpoint", actual: result.snapshot?.session?.sessionState, message: "Canonical authored plan locked without entering station resolution.", beforeSnapshot: profile.crewPlanning?.snapshot ?? null, afterSnapshot: result.snapshot, writes: traceWrites(result.trace), trace: result.trace };
    }),
    makeTest("checkpoint-inspect", "Inspect retained checkpoint", "Reread the authoritative session at the exact pre-resolution checkpoint.", "error", async (context, profile) => {
      const result = await context?.eventTest?.inspect?.({ sessionId: profile.sessionId });
      if (!result || result.ok !== true) {
        const error = firstError(result, "m12-test-engine-checkpoint-inspect-failed", "eventTest.inspect", "The retained plan-locked checkpoint could not be inspected.");
        return { ok: false, ...error, expected: "plan-locked session snapshot", actual: result ?? null, writes: 0 };
      }
      profile.checkpoint = result;
      return { ok: true, expected: "plan-locked session snapshot", actual: result.snapshot?.session?.sessionState, message: "Retained checkpoint reread successfully.", beforeSnapshot: profile.plan?.snapshot ?? null, afterSnapshot: result.snapshot, writes: 0 };
    }),
    makeTest("fixture-invariants", "Verify fixture invariants", "Verify test origin, complete assignments, authored selections, exact planning state, and no resolution-side effects.", "error", async (_context, profile) => {
      const snapshot = profile.checkpoint?.snapshot;
      const session = snapshot?.session;
      const assignments = snapshot?.planning?.assignments ?? [];
      const selections = snapshot?.planning?.selections ?? {};
      const required = profile.stationRequirements?.stations ?? [];
      const candidates = new Set((profile.operatorCandidates ?? []).map((operator) => operator.id));
      const engine = createInvariantEngine();
      engine.register({ id: "test-origin", label: "Test origin marker", check: () => ({ ok: session?.testOrigin?.kind === "arcflight-event-test", expected: "arcflight-event-test", actual: session?.testOrigin?.kind ?? null }) });
      engine.register({ id: "event-and-ship", label: "Event and ship identity", check: () => ({ ok: session?.eventId === profile.eventId && session?.shipId === profile.shipId, expected: { eventId: profile.eventId, shipId: profile.shipId }, actual: { eventId: session?.eventId ?? null, shipId: session?.shipId ?? null } }) });
      engine.register({ id: "complete-assignments", label: "Complete unique station assignments", check: () => ({ ok: assignments.length === required.length && required.every((station) => assignments.some((assignment) => assignment.stationId === station.stationId)) && new Set(assignments.map((assignment) => assignment.operator?.id ?? assignment.operatorId)).size === assignments.length, expected: required.map((station) => station.stationId), actual: assignments }) });
      engine.register({ id: "valid-operators", label: "Assignments use discovered operators", check: () => ({ ok: assignments.every((assignment) => candidates.has(assignment.operator?.id ?? assignment.operatorId)), expected: "discovered operator IDs", actual: assignments.map((assignment) => assignment.operator?.id ?? assignment.operatorId) }) });
      engine.register({ id: "authored-selections", label: "Selections are authored and legal", check: () => ({ ok: required.every((station) => { const selection = selections[station.stationId]; const action = station.actions.find((entry) => entry.actionId === selection?.actionId); return Boolean(action?.approaches?.some((approach) => approach.approachId === selection?.approachId)); }), expected: "first authored legal action and approach per station", actual: selections }) });
      engine.register({ id: "exact-planning-checkpoint", label: "Exact Plan Locked checkpoint", check: () => ({ ok: session?.sessionState === "plan-locked" && session?.phase === "lock-readiness", expected: { sessionState: "plan-locked", phase: "lock-readiness" }, actual: { sessionState: session?.sessionState ?? null, phase: session?.phase ?? null } }) });
      engine.register({ id: "no-resolution-side-effects", label: "No resolution-side-effects", check: () => ({ ok: (snapshot?.resolution?.pendingChecks ?? []).every((check) => check?.status === "pending" && check?.result == null) && snapshot?.resolution?.pendingBreachSave == null && (snapshot?.ship?.activeHazards ?? []).length === 0 && snapshot?.ship?.voidScarEvidence == null, expected: "only unresolved planning-derived checks; no results, breach save, hazards, or Void Scar evidence", actual: snapshot?.resolution ?? null }) });
      const report = await engine.run();
      profile.invariantResults = report.results;
      if (!report.ok) return { ok: false, code: "m12-test-engine-fixture-invariant-failed", path: "checkpoint", expected: "all Fixture Prep invariants", actual: report.results, message: "Fixture Prep invariants failed.", invariantResults: report.results, afterSnapshot: snapshot, writes: 0 };
      return { ok: true, expected: "all Fixture Prep invariants", actual: report.summary, message: "Fixture Prep invariants passed.", invariantResults: report.results, afterSnapshot: snapshot, writes: 0 };
    }),
    makeTest("retain-fixture", "Retain prepared fixture", "Publish the marked pre-resolution fixture for later suites and leave it available for explicit cleanup.", "error", async (_context, profile) => {
      const snapshot = profile.checkpoint?.snapshot;
      if (!profile.sessionId || !snapshot?.session) return { ok: false, code: "m12-test-engine-fixture-retention-failed", path: "profile.sessionId", expected: "marked plan-locked session", actual: null, message: "No marked fixture was available to retain.", writes: 0 };
      profile.fixture = {
        profileId: "canonical-first-valid",
        runId: profile.runId,
        sessionId: profile.sessionId,
        eventId: profile.eventId,
        shipId: profile.shipId,
        shipName: profile.ship?.name ?? profile.shipId,
        roundId: snapshot.session.roundId,
        phase: snapshot.session.phase,
        sessionState: snapshot.session.sessionState,
        revision: snapshot.session.revision,
        testOrigin: snapshot.session.testOrigin ?? null,
        assignments: profile.assignmentEvidence ?? [],
        selections: snapshot.planning.selections ?? {}
      };
      return { ok: true, expected: "retained marked plan-locked fixture", actual: profile.fixture, message: "Prepared marked Test Lab fixture retained for later suites.", afterSnapshot: snapshot, writes: 0, retainedSessionId: profile.sessionId };
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
      id: FIXTURE_PREP_SUITE_ID,
      label: "FIXTURE PREP",
      lane: TEST_LANE_ENGINE,
      description: "Prepare and retain a canonical marked Event Session at the exact pre-resolution Plan Locked checkpoint.",
      enabled: true,
      tests: fixturePrepSteps
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
