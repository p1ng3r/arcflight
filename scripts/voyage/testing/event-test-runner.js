import { createSuiteRegistry, QUICK_CHECK_SUITE_ID } from "./event-test-suite-registry.js";
import { createTestReportModel } from "./event-test-report.js";
import { buildStructuralDiff } from "./event-test-diff.js";

function makeRunId() {
  return `arcflight-test-run-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

function statusFromSummary(summary) {
  if (summary.failed > 0) return summary.passed > 0 ? "PARTIAL" : "FAILED";
  if (summary.skipped > 0) return "PARTIAL";
  if (summary.passed > 0) return "PASSED";
  return "IDLE";
}

function snapshotClone(value) {
  try { return value === null || value === undefined ? value : structuredClone(value); } catch { return value; }
}

export function createTestRunner({ registry = createSuiteRegistry(), context = {} } = {}) {
  async function run({ suiteId = QUICK_CHECK_SUITE_ID, lane = "ENGINE", selectedTestId = null, stopCondition = "fatal", eventId = null, shipId = null, forcePostLaunchFailure = false, fixtureSessionId = null, fixture = null, degreeProfile = "all-success", customDegrees = null, reactionMode = "pass", onProgress = null } = {}) {
    const suite = registry.find((entry) => entry.id === suiteId) ?? registry[0];
    const runId = makeRunId();
    const startedTime = Date.now();
    const startedAt = new Date(startedTime).toISOString();
    const profile = {
      runId,
      suiteId: suite?.id ?? suiteId,
      testId: selectedTestId ?? suite?.tests?.[0]?.id ?? null,
      lane: suite?.lane ?? lane,
      eventId: eventId ?? context?.eventDefinitions?.[0]?.eventId ?? null,
      shipId: shipId ?? context?.ships?.[0]?.id ?? null,
      operatorMapping: null,
      requestedOutcomes: null,
      pressureSetup: null,
      degreeProfile,
      customDegrees: customDegrees ? structuredClone(customDegrees) : null,
      reactionMode,
      stopCondition,
      forcePostLaunchFailure: forcePostLaunchFailure === true,
      sessionId: fixtureSessionId ?? null,
      fixture: fixture ? structuredClone(fixture) : null
    };

    const steps = [];
    const runRecord = {
      runId,
      startedAt,
      completedAt: null,
      durationMs: 0,
      environment: {
        system: globalThis.game?.system?.id ?? "unknown",
        foundryVersion: globalThis.game?.version ?? null,
        moduleVersion: globalThis.game?.modules?.get?.("arcflight")?.version ?? null,
        activeGm: globalThis.game?.users?.activeGM?.name ?? null
      },
      profile,
      summary: { total: 0, passed: 0, failed: 0, skipped: 0, warnings: 0, status: "IDLE" },
      steps,
      coverage: {
        eventsDiscovered: 0,
        roundsTouched: 0,
        pressureSystemsInspected: 0,
        lanesExercised: [profile.lane]
      },
      retainedSessionId: null
    };
    runRecord.retainedSessionId = profile.sessionId ?? null;

    const emitProgress = async () => {
      if (typeof onProgress !== "function") return;
      await Promise.resolve(onProgress({ ok: false, runId, suiteId: profile.suiteId, lane: profile.lane, summary: { ...runRecord.summary, status: runRecord.summary.status === "IDLE" ? "RUNNING" : runRecord.summary.status }, steps: structuredClone(steps), profile: { ...profile }, fixture: profile.fixture ?? null, retainedSessionId: profile.sessionId ?? null }));
    };

    const authorityCheck = context?.game?.user?.isGM === true || context?.authenticatedUserId === context?.activeGmUserId;
    if (!authorityCheck) {
      const step = {
        stepId: "authority",
        label: "Test authority",
        status: "FAIL",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        expected: "active GM",
        actual: context?.game?.user?.isGM === true ? "GM user not active" : "non-GM user",
        errorCode: "m11-active-gm-required",
        errorPath: "game.user",
        errorMessage: "An active GM is required to run the Test Lab.",
        revisionBefore: null,
        revisionAfter: null,
        writes: 0,
        invariantResults: [],
        commandSummary: "Authority check blocked execution.",
        provenance: { userId: context?.authenticatedUserId ?? null },
        notes: "Quick Check is GM-only."
      };
      steps.push(step);
      runRecord.summary = { total: 1, passed: 0, failed: 1, skipped: 0, warnings: 0, status: "FAILED" };
      runRecord.completedAt = new Date().toISOString();
      runRecord.durationMs = 0;
      return { ok: false, runId, suiteId: suite?.id ?? suiteId, lane: profile.lane, summary: runRecord.summary, steps, retainedSessionId: null, profile: structuredClone(profile), fixture: null, report: createTestReportModel(runRecord) };
    }

    const tests = (suite?.tests ?? []).filter((test) => test.id !== "forced-post-launch-failure" || profile.forcePostLaunchFailure === true);
    for (const test of tests) {
      if (selectedTestId && test.id !== selectedTestId) continue;
      const stepStart = Date.now();
      const step = {
        stepId: test.id,
        label: test.label,
        status: "SKIPPED",
        startedAt: new Date().toISOString(),
        completedAt: null,
        durationMs: 0,
        expected: null,
        actual: null,
        errorCode: null,
        errorPath: null,
        errorMessage: null,
        revisionBefore: null,
        revisionAfter: null,
        writes: 0,
        beforeSnapshot: null,
        afterSnapshot: null,
        diff: [],
        invariantResults: [],
        commandSummary: null,
        provenance: { suiteId: suite?.id ?? suiteId, testId: test.id },
        notes: test.description ?? ""
      };
      try {
        const outcome = await Promise.resolve(test.run(context, profile));
        step.expected = outcome?.expected ?? null;
        step.actual = outcome?.actual ?? null;
        step.errorCode = outcome?.code ?? null;
        step.errorPath = outcome?.path ?? null;
        step.errorMessage = outcome?.message ?? null;
        step.revisionBefore = outcome?.revisionBefore ?? outcome?.beforeSnapshot?.session?.revision ?? null;
        step.revisionAfter = outcome?.revisionAfter ?? outcome?.afterSnapshot?.session?.revision ?? null;
        step.writes = Number.isSafeInteger(outcome?.writes) ? outcome.writes : 0;
        step.status = ["PASS", "FAIL", "SKIPPED", "WARNING"].includes(outcome?.status) ? outcome.status : (outcome && outcome.ok === true ? "PASS" : "FAIL");
        step.commandSummary = outcome?.message ?? null;
        step.beforeSnapshot = snapshotClone(outcome?.beforeSnapshot ?? null);
        step.afterSnapshot = snapshotClone(outcome?.afterSnapshot ?? null);
        const hasSnapshots = outcome?.beforeSnapshot !== null && outcome?.beforeSnapshot !== undefined
          && outcome?.afterSnapshot !== null && outcome?.afterSnapshot !== undefined;
        step.diff = Array.isArray(outcome?.diff)
          ? outcome.diff
          : hasSnapshots
            ? buildStructuralDiff(outcome.beforeSnapshot, outcome.afterSnapshot)
            : [];
         step.invariantResults = Array.isArray(outcome?.invariantResults) ? outcome.invariantResults : [];
        step.runtimeTrace = Array.isArray(outcome?.trace) ? structuredClone(outcome.trace) : [];
        step.runtimeResult = outcome?.runtimeResult ?? outcome?.snapshot ?? null;
        if (outcome?.retainedSessionId) profile.sessionId = outcome.retainedSessionId;
        if (step.status === "PASS") {
          runRecord.summary.passed += 1;
        } else if (step.status === "SKIPPED") {
          runRecord.summary.skipped += 1;
        } else if (step.status === "WARNING") {
          runRecord.summary.warnings += 1;
        } else {
          runRecord.summary.failed += 1;
          if (stopCondition === "fatal" || test.id === "forced-post-launch-failure") {
            step.completedAt = new Date().toISOString();
            step.durationMs = Date.now() - stepStart;
            runRecord.summary.total = steps.length + 1;
            runRecord.summary.status = "FAILED";
            runRecord.retainedSessionId = profile.sessionId ?? null;
            runRecord.completedAt = new Date().toISOString();
            runRecord.durationMs = Date.now() - startedTime;
            return { ok: false, runId, suiteId: profile.suiteId, lane: profile.lane, summary: runRecord.summary, steps, retainedSessionId: runRecord.retainedSessionId, profile: structuredClone(profile), fixture: profile.fixture ?? null, report: createTestReportModel({ ...runRecord, summary: runRecord.summary }) };
          }
        }
      } catch (error) {
        step.status = "FAIL";
        step.errorCode = error?.code ?? "m12-test-step-threw";
        step.errorPath = error?.path ?? "test.run";
        step.errorMessage = error?.message ?? String(error);
        step.actual = error?.message ?? String(error);
        runRecord.summary.failed += 1;
        runRecord.retainedSessionId = profile.sessionId ?? null;
        break;
      } finally {
        step.completedAt = new Date().toISOString();
        step.durationMs = Date.now() - stepStart;
        steps.push(step);
        runRecord.summary.total = steps.length;
        if (runRecord.summary.status !== "FAILED") runRecord.summary.status = "RUNNING";
        await emitProgress();
      }
    }

    runRecord.summary.total = steps.length;
    runRecord.summary.skipped = steps.filter((entry) => entry.status === "SKIPPED").length;
    runRecord.summary.warnings = steps.filter((entry) => entry.status === "WARNING").length;
    runRecord.retainedSessionId = profile.sessionId ?? null;
    runRecord.summary.status = statusFromSummary(runRecord.summary);
    runRecord.completedAt = new Date().toISOString();
    runRecord.durationMs = Date.now() - startedTime;
    runRecord.steps = steps;
    runRecord.coverage.lanesExercised = Array.from(new Set([profile.lane, ...runRecord.coverage.lanesExercised]));
    const ok = runRecord.summary.failed === 0;
    return {
      ok,
      runId,
      suiteId: profile.suiteId,
      lane: profile.lane,
      summary: runRecord.summary,
      steps,
      retainedSessionId: runRecord.retainedSessionId,
      profile: structuredClone(profile),
      fixture: profile.fixture ?? null,
      report: createTestReportModel({ ...runRecord, summary: runRecord.summary })
    };
  }

  return Object.freeze({ run });
}
