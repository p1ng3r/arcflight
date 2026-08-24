export const QUICK_CHECK_SUITE_ID = "quick-check";
export const FIXTURE_PREP_SUITE_ID = "fixture-prep";
export const TEST_LANE_ENGINE = "ENGINE";
export const TEST_LANE_GM_FLOW = "GM FLOW";
export const TEST_LANE_PLAYER_VIEW = "PLAYER VIEW";
export const RESOLUTION_SUITE_IDS = Object.freeze([
  "resolution-one-station-success",
  "resolution-one-station-failure",
  "resolution-all-success",
  "resolution-mixed-degrees",
  "resolution-reaction-handling",
  "resolution-replay-guard"
]);

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

function resolutionError(result, fallbackCode, fallbackPath, fallbackMessage) {
  const error = firstError(result, fallbackCode, fallbackPath, fallbackMessage);
  return { ok: false, ...error, actual: result ?? null, writes: 0 };
}

function resolutionFixtureStep() {
  return makeTest("prepared-fixture", "Use prepared fixture", "Use the retained marked Pass 2 fixture without creating or mutating an ordinary session.", "error", async (context, profile) => {
    if (!profile.sessionId) return resolutionError(null, "m12-test-fixture-required", "profile.sessionId", "A retained marked Fixture Prep session is required before resolution.");
    const result = await context?.eventTest?.inspect?.({ sessionId: profile.sessionId });
    if (!result?.ok) return resolutionError(result, "m12-test-fixture-inspect-failed", "eventTest.inspect", "The retained Fixture Prep session could not be inspected.");
    const session = result.snapshot?.session;
    if (session?.eventId !== profile.eventId || session?.shipId !== profile.shipId) return resolutionError(result, "m12-test-fixture-identity-mismatch", "session", "The retained fixture does not match the selected event and ship.");
    if (session?.testOrigin?.kind !== "arcflight-event-test") return resolutionError(result, "m12-test-fixture-origin-required", "session.testOrigin", "Resolution suites require a marked Event Test session.");
    if (session.sessionState !== "plan-locked" || session.phase !== "lock-readiness") return resolutionError(result, "m12-test-fixture-not-plan-locked", "sessionState", "Resolution suites require the exact retained plan-locked fixture.");
    profile.fixture = profile.fixture ?? { sessionId: profile.sessionId, eventId: profile.eventId, shipId: profile.shipId, sessionState: session.sessionState, phase: session.phase, revision: session.revision };
    const checkpoint = structuredClone(result.snapshot);
    profile.fixtureCheckpoint = checkpoint;
    profile.fixtureValidated = { sessionId: profile.sessionId, revision: session.revision, sessionState: session.sessionState, phase: session.phase };
    return { ok: true, expected: "retained marked plan-locked fixture", actual: { sessionId: profile.sessionId, sessionState: session.sessionState, phase: session.phase, revision: session.revision }, message: "Prepared fixture selected without a new session write.", beforeSnapshot: structuredClone(checkpoint), afterSnapshot: structuredClone(checkpoint), writes: 0 };
  });
}

function startResolutionStep() {
  return makeTest("start-resolution", "Start resolution", "Enter station resolution through the canonical runtime command.", "error", async (context, profile) => {
    if (profile.fixtureValidated?.sessionId !== profile.sessionId || !Number.isSafeInteger(profile.fixtureValidated?.revision)) return resolutionError(null, "m12-test-fixture-validation-required", "profile.fixtureValidated", "Resolution cannot start before the retained fixture has passed validation.");
    const result = await context?.eventTest?.startResolution?.({ sessionId: profile.sessionId, expectedRevision: profile.fixtureValidated.revision });
    if (!result?.ok) return resolutionError(result, "m12-test-resolution-start-failed", "eventTest.startResolution", "Canonical station resolution could not be started.");
    profile.resolutionStart = result;
    return { ok: true, expected: "station-resolution / resolution", actual: { sessionState: result.snapshot?.session?.sessionState, phase: result.snapshot?.session?.phase }, message: "Canonical station resolution started.", beforeSnapshot: result.beforeSnapshot, afterSnapshot: result.afterSnapshot ?? result.snapshot, writes: traceWrites(result.trace), trace: result.trace, invariantResults: result.trace?.flatMap((entry) => entry.invariantResults ?? []) ?? [] };
  });
}

function runCurrentResolutionStep(id, label, description, degreeProfile, customDegrees = null) {
  return makeTest(id, label, description, "error", async (context, profile) => {
    const result = await context?.eventTest?.runCurrentStation?.({ sessionId: profile.sessionId, degreeProfile, customDegrees });
    if (!result?.ok) return { ...resolutionError(result, "m12-test-resolution-station-failed", "eventTest.runCurrentStation", "The current station could not be resolved canonically."), beforeSnapshot: result?.beforeSnapshot ?? null, afterSnapshot: result?.afterSnapshot ?? null, trace: result?.trace ?? [] };
    profile.lastResolution = result;
    return { ok: true, expected: "one canonical station resolved", actual: result.resolvedStationId ?? result.snapshot?.resolution?.currentStationId, message: `Canonical ${result.resolvedStationId ?? "current"} station resolution completed.`, beforeSnapshot: result.beforeSnapshot, afterSnapshot: result.afterSnapshot ?? result.snapshot, writes: traceWrites(result.trace), trace: result.trace, invariantResults: result.trace?.flatMap((entry) => entry.invariantResults ?? []) ?? [] };
  });
}

function runAllResolutionStep(id, label, description, degreeProfile, customDegrees = null, reactionMode = "pass") {
  return makeTest(id, label, description, "error", async (context, profile) => {
    const result = await context?.eventTest?.runAllStations?.({ sessionId: profile.sessionId, degreeProfile, customDegrees, reactionMode });
    if (!result?.ok) return { ...resolutionError(result, "m12-test-resolution-run-failed", "eventTest.runAllStations", "Deterministic station resolution did not complete."), beforeSnapshot: profile.resolutionStart?.afterSnapshot ?? null, afterSnapshot: result?.snapshot ?? null, trace: result?.trace ?? [], invariantResults: result?.trace?.flatMap((entry) => entry.invariantResults ?? []) ?? [] };
    profile.lastResolution = result;
    return { ok: true, expected: "all stations resolved through canonical runtime", actual: result.checkpoint, message: "All stations resolved through the canonical runtime.", beforeSnapshot: profile.resolutionStart?.afterSnapshot ?? null, afterSnapshot: result.snapshot, writes: traceWrites(result.trace), trace: result.trace, invariantResults: result.trace?.flatMap((entry) => entry.invariantResults ?? []) ?? [] };
  });
}

function resolutionReplayGuardStep() {
  return makeTest("replay-guard", "Replay guard", "Verify an already-resolved station cannot be resolved again or create another write.", "error", async (context, profile) => {
    const first = profile.lastResolution;
    const firstStationId = first?.resolvedStationId ?? first?.trace?.find((entry) => entry.command === "action-segment")?.stationId ?? null;
    if (!firstStationId) return resolutionError(null, "m12-test-resolution-replay-fixture-missing", "profile.lastResolution", "No resolved station was available for replay validation.");
    const before = await context?.eventTest?.inspect?.({ sessionId: profile.sessionId });
    const result = await context?.eventTest?.runCurrentStation?.({ sessionId: profile.sessionId, stationId: firstStationId, degree: "success" });
    const after = await context?.eventTest?.inspect?.({ sessionId: profile.sessionId });
    const writes = before?.snapshot?.session?.revision !== after?.snapshot?.session?.revision ? 1 : 0;
    const ok = result?.ok === false && writes === 0;
    return { ok, code: ok ? null : "m12-test-resolution-replay-guard-failed", path: "eventTest.runCurrentStation", expected: "replay rejected with zero writes", actual: { result, writes }, message: ok ? "Resolved station replay was rejected without another runtime write." : "Resolved station replay guard failed.", beforeSnapshot: before?.snapshot ?? null, afterSnapshot: after?.snapshot ?? null, writes, trace: result?.trace ?? [] };
  });
}

function resolutionSuite(id, label, description, steps) {
  return Object.freeze({ id, label, lane: TEST_LANE_ENGINE, description, enabled: true, tests: steps });
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
    resolutionSuite("resolution-one-station-success", "ONE STATION · SUCCESS", "Resolve exactly the current station with a deterministic Success input.", [resolutionFixtureStep(), startResolutionStep(), runCurrentResolutionStep("run-current-station", "Run current station", "Resolve the current station through the canonical runtime.", "all-success")]),
    resolutionSuite("resolution-one-station-failure", "ONE STATION · FAILURE", "Resolve exactly the current station with a deterministic Failure input.", [resolutionFixtureStep(), startResolutionStep(), runCurrentResolutionStep("run-current-station", "Run current station", "Resolve the current station through the canonical runtime.", "all-failure")]),
    resolutionSuite("resolution-all-success", "ALL STATIONS · SUCCESS", "Resolve every station with deterministic Success inputs and retain the canonical completed checkpoint.", [resolutionFixtureStep(), startResolutionStep(), runAllResolutionStep("run-all-stations", "Run all stations", "Resolve every station through the canonical runtime.", "all-success")]),
    resolutionSuite("resolution-mixed-degrees", "MIXED DEGREES", "Resolve every station with one deterministic degree per station.", [resolutionFixtureStep(), startResolutionStep(), runAllResolutionStep("run-all-stations", "Run all stations", "Resolve every station through the canonical runtime using a custom degree profile.", "custom", { captain: "success", engineer: "failure", navigator: "critical-success", watchmaster: "critical-failure", veilwarden: "success" })]),
    resolutionSuite("resolution-reaction-handling", "REACTION HANDLING", "Pass canonical reaction windows through the existing runtime before continuing station resolution.", [resolutionFixtureStep(), startResolutionStep(), runAllResolutionStep("run-all-stations", "Run all stations", "Resolve every station while passing each required reaction through the canonical reaction command.", "all-success", null, "pass")]),
    resolutionSuite("resolution-replay-guard", "REPLAY GUARD", "Resolve one station, then verify a replay attempt is rejected without another write.", [resolutionFixtureStep(), startResolutionStep(), runCurrentResolutionStep("run-current-station", "Run current station", "Resolve the first station through the canonical runtime.", "all-success"), resolutionReplayGuardStep()]),
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
