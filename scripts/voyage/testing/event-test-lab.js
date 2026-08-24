import { arcflightTemplatePath } from "../../sheets/sheet-helpers.js";
import { createSuiteRegistry } from "./event-test-suite-registry.js";
import { createTestRunner } from "./event-test-runner.js";
import { isActiveTestLabGm } from "./event-test-lab-entry.js";

const applicationApi = globalThis.foundry?.applications?.api ?? {};
const HandlebarsApplicationMixin = applicationApi.HandlebarsApplicationMixin ?? ((base) => base);
const ApplicationV2 = applicationApi.ApplicationV2 ?? class ApplicationV2Fallback {};

function activeGmDisplayName(gameValue = globalThis.game) {
  try {
    const users = valuesFromCollection(gameValue?.users);
    const user = gameValue?.users?.activeGM ?? users.find((entry) => entry?.isGM && entry?.active);
    return user?.name ?? user?.id ?? "Unavailable";
  } catch {
    return "Unavailable";
  }
}

function valuesFromCollection(source) {
  try {
    if (Array.isArray(source)) return [...source];
    if (Array.isArray(source?.contents)) return [...source.contents];
    if (typeof source?.values === "function") return [...source.values()];
  } catch {}
  return [];
}

const isActiveGm = isActiveTestLabGm;

function safeText(value, empty = "Unavailable") {
  if (value === null || value === undefined || value === "") return empty;
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function copyValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return safeText(value, null);
}

function addCopyField(lines, label, value) {
  const text = copyValue(value);
  if (text !== null && text !== "null" && text !== "[]" && text !== "{}") lines.push(`${label}: ${text}`);
}

function assignmentLines(assignments) {
  if (!Array.isArray(assignments)) return [];
  return assignments.map((assignment) => {
    const station = assignment?.stationLabel ?? assignment?.stationId ?? "station";
    const operator = assignment?.operatorName ?? assignment?.operator?.name ?? assignment?.operatorId ?? assignment?.operator?.id ?? "operator";
    return `- ${station} — ${operator}`;
  });
}

function selectionLines(selections) {
  if (!selections || typeof selections !== "object" || Array.isArray(selections)) return [];
  return Object.entries(selections).map(([stationId, selection]) => {
    const action = selection?.actionName ?? selection?.actionId ?? "action unavailable";
    const approach = selection?.approachName ?? selection?.approachId;
    return `- ${stationId} — ${action}${approach ? ` / ${approach}` : ""}`;
  });
}

function invariantLines(results) {
  if (!Array.isArray(results)) return [];
  return results.map((result) => `- ${result?.status ?? "UNKNOWN"} — ${result?.label ?? result?.id ?? "Invariant"}`);
}

function diffLines(diff) {
  if (!Array.isArray(diff)) return [];
  return diff.map((entry) => `- ${entry?.kind ?? "changed"} — ${entry?.path ?? "unknown path"}`);
}

export function testLabTimeline(steps) {
  return (Array.isArray(steps) ? steps : []).flatMap((step) => [step, ...(Array.isArray(step?.runtimeTrace) ? step.runtimeTrace : [])]);
}

function latestTestLabSnapshot(run) {
  const steps = Array.isArray(run?.steps) ? [...run.steps].reverse() : [];
  return steps.find((step) => step?.afterSnapshot)?.afterSnapshot ?? null;
}

function resolutionCurrentStationId(snapshot) {
  const resolution = snapshot?.resolution ?? {};
  if (resolution.currentStationId) return resolution.currentStationId;
  const order = Array.isArray(snapshot?.planning?.committedStationOrder) ? snapshot.planning.committedStationOrder : [];
  const pending = Array.isArray(resolution.pendingChecks) ? resolution.pendingChecks : [];
  return order.find((stationId) => pending.some((entry) => entry?.stationId === stationId && entry?.status === "pending")) ?? null;
}

function resolutionReactionOpen(snapshot) {
  const resolution = snapshot?.resolution ?? {};
  return resolution.reactionWindowOpen === true
    || resolution.reactionWindow?.status === "open"
    || (Array.isArray(resolution.currentReaction) && resolution.currentReaction.length > 0)
    || (Array.isArray(resolution.reactionWindowPending) && resolution.reactionWindowPending.length > 0);
}

export function resolutionControlAvailability(run = null, fixture = null) {
  const snapshot = latestTestLabSnapshot(run) ?? fixture;
  const session = snapshot?.session ?? snapshot ?? {};
  const resolution = snapshot?.resolution ?? {};
  const hasFixture = Boolean(fixture?.sessionId ?? run?.retainedSessionId);
  const planLocked = session.sessionState === "plan-locked" && session.phase === "lock-readiness";
  const active = session.sessionState === "station-resolution" && session.phase === "resolution";
  const currentStationId = resolutionCurrentStationId(snapshot);
  return {
    startResolution: hasFixture && planLocked,
    runCurrentStation: active && !resolutionReactionOpen(snapshot) && Boolean(currentStationId),
    passCurrentReaction: active && resolutionReactionOpen(snapshot),
    runNextStation: active && !resolutionReactionOpen(snapshot) && Boolean(currentStationId),
    runAllStations: active && Boolean(currentStationId),
    fixtureAvailable: hasFixture
  };
}

export function formatTestLabStepEvidence(step) {
  const value = step ?? {};
  const lines = ["ARCFLIGHT TEST LAB — STEP EVIDENCE"];
  const status = String(value.status ?? "").toUpperCase();
  const isFailure = status === "FAIL" || status === "ERROR";
  addCopyField(lines, "STEP", value.label ?? value.stepId);
  addCopyField(lines, "STATUS", value.status);
  addCopyField(lines, "EXPECTED", value.expected);
  addCopyField(lines, "ACTUAL", value.actual);
  if (isFailure) {
    addCopyField(lines, "ERROR CODE", value.errorCode);
    addCopyField(lines, "ERROR PATH", value.errorPath);
    addCopyField(lines, "ERROR MESSAGE", value.errorMessage ?? value.message ?? value.commandSummary);
  } else {
    addCopyField(lines, "MESSAGE", value.message ?? value.commandSummary ?? value.errorMessage);
  }
  addCopyField(lines, "REVISION BEFORE", value.revisionBefore);
  addCopyField(lines, "REVISION AFTER", value.revisionAfter);
  addCopyField(lines, "DURATION", value.durationMs === undefined ? null : `${value.durationMs}ms`);
  addCopyField(lines, "COMMAND", value.commandSummary);
  addCopyField(lines, "WRITES", value.writes);
  addCopyField(lines, "RETAINED SESSION", value.retainedSessionId);
  addCopyField(lines, "STATION", value.stationId);
  addCopyField(lines, "ACTION", value.actionId);
  addCopyField(lines, "APPROACH", value.approachId);
  addCopyField(lines, "DETERMINISTIC DEGREE", value.degreeInput);
  addCopyField(lines, "RUNTIME RESULT", value.runtimeResult);
  addCopyField(lines, "BEFORE RESOLUTION EVIDENCE", value.beforeEvidence);
  addCopyField(lines, "AFTER RESOLUTION EVIDENCE", value.afterEvidence);
  const snapshot = value.afterSnapshot ?? {};
  const assignments = value.assignments ?? snapshot?.planning?.assignments ?? snapshot?.session?.encounterState?.stationAssignments;
  const selections = value.selectedActions ?? snapshot?.planning?.selections;
  const stages = [value.stageBefore ?? value.beforeSnapshot?.session?.sessionState, value.stageAfter ?? snapshot?.session?.sessionState];
  const assignmentsText = assignmentLines(assignments);
  const selectionsText = selectionLines(selections);
  const invariantsText = invariantLines(value.invariantResults);
  const diffText = diffLines(value.diff);
  if (assignmentsText.length) lines.push("", "ASSIGNMENTS:", ...assignmentsText);
  if (selectionsText.length) lines.push("", "SELECTED ACTIONS:", ...selectionsText);
  addCopyField(lines, "STAGE BEFORE", stages[0]);
  addCopyField(lines, "STAGE AFTER", stages[1]);
  if (invariantsText.length) lines.push("", "INVARIANTS:", ...invariantsText);
  if (diffText.length) lines.push("", "NORMALIZED DIFF:", ...diffText);
  return lines.join("\n");
}

function fixtureInvariantResults(fixture, run) {
  if (Array.isArray(fixture?.invariantResults)) return fixture.invariantResults;
  return (run?.steps ?? []).find((step) => step.stepId === "fixture-invariants")?.invariantResults ?? [];
}

export function formatTestLabRunSummary(run) {
  const value = run ?? {};
  const profile = value.profile ?? {};
  const lines = ["ARCFLIGHT TEST LAB — RUN SUMMARY"];
  addCopyField(lines, "Suite", value.suiteId ?? profile.suiteId);
  const fixturePolicy = value.fixture?.profileId ?? profile.fixture?.profileId ?? profile.profileId;
  addCopyField(lines, "Fixture Policy", fixturePolicy);
  addCopyField(lines, "Run ID", value.runId ?? profile.runId);
  addCopyField(lines, "Event", profile.eventId);
  addCopyField(lines, "Ship", profile.shipId);
  addCopyField(lines, "Status", value.summary?.status);
  addCopyField(lines, "Pass", value.summary?.passed);
  addCopyField(lines, "Fail", value.summary?.failed);
  addCopyField(lines, "Skip", value.summary?.skipped);
  addCopyField(lines, "Warning", value.summary?.warnings);
  addCopyField(lines, "Total", value.summary?.total);
  addCopyField(lines, "Retained Session", value.retainedSessionId);
  const timeline = (value.steps ?? []).map((step, index) => `${index + 1}. ${step?.label ?? step?.stepId ?? "Step"} — ${step?.status ?? "UNKNOWN"}`);
  if (timeline.length) lines.push("", "Timeline:", ...timeline);
  return lines.join("\n");
}

export function formatTestLabPreparedFixture(fixture, run = null) {
  const value = fixture ?? {};
  const lines = ["ARCFLIGHT TEST LAB — PREPARED FIXTURE"];
  addCopyField(lines, "Event", value.eventId);
  addCopyField(lines, "Ship", value.shipName ?? value.shipId);
  addCopyField(lines, "Session", value.sessionId);
  addCopyField(lines, "Round", value.roundId);
  addCopyField(lines, "Session State", value.sessionState);
  addCopyField(lines, "Phase", value.phase);
  addCopyField(lines, "Revision", value.revision);
  addCopyField(lines, "Fixture Policy", value.profileId ?? run?.fixture?.profileId ?? run?.profile?.fixture?.profileId ?? run?.profile?.profileId);
  addCopyField(lines, "Run ID", value.runId ?? run?.runId ?? run?.profile?.runId);
  const origin = value.testOrigin;
  addCopyField(lines, "Test Origin", origin?.kind ?? origin);
  const assignmentsText = assignmentLines(value.assignments);
  const selectionsText = selectionLines(value.selections);
  const invariantResults = fixtureInvariantResults(value, run);
  const invariantText = invariantLines(invariantResults);
  if (assignmentsText.length) lines.push("", "Assignments:", ...assignmentsText);
  if (selectionsText.length) lines.push("", "Selected Actions:", ...selectionsText);
  if (invariantText.length) lines.push("", "Invariant Summary:", ...invariantText);
  return lines.join("\n");
}

export function formatTestLabAllResults(run, fixture = null, selectedStep = null) {
  const sections = [formatTestLabRunSummary(run)];
  if (selectedStep) sections.push(formatTestLabStepEvidence(selectedStep));
  if (fixture) sections.push(formatTestLabPreparedFixture(fixture, run));
  return sections.join("\n\n");
}

export function formatTestLabFailureBundle(run, fixture = null, selectedStep = null) {
  const value = run ?? {};
  const step = selectedStep ?? [...(value.steps ?? [])].reverse().find((entry) => entry.status === "FAIL") ?? null;
  const lines = ["ARCFLIGHT TEST LAB — FAILURE BUNDLE"];
  addCopyField(lines, "Session", value.retainedSessionId ?? value.profile?.sessionId ?? fixture?.sessionId);
  addCopyField(lines, "Last Valid Checkpoint", step?.afterSnapshot?.session ?? step?.afterSnapshot ?? fixture);
  addCopyField(lines, "Expected", step?.expected);
  addCopyField(lines, "Actual", step?.actual);
  addCopyField(lines, "Error Code", step?.errorCode);
  addCopyField(lines, "Error Path", step?.errorPath);
  addCopyField(lines, "Error Message", step?.errorMessage ?? step?.message);
  if (step) lines.push("", formatTestLabStepEvidence(step));
  return lines.join("\n");
}

export function testLabCopyAvailability({ run = null, evidence = null, fixture = null } = {}) {
  return { stepEvidence: Boolean(evidence), runSummary: Boolean(run), preparedFixture: Boolean(fixture), allResults: Boolean(run), failureBundle: Boolean(run && (run.ok === false || run.summary?.failed > 0)) };
}

async function fallbackCopy(text, documentValue) {
  if (!documentValue?.createElement || !documentValue?.body || typeof documentValue.execCommand !== "function") return false;
  const textarea = documentValue.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  documentValue.body.appendChild(textarea);
  try {
    textarea.select();
    return documentValue.execCommand("copy") === true;
  } finally {
    textarea.remove?.();
  }
}

export async function copyTestLabText(text, { navigatorValue = globalThis.navigator, documentValue = globalThis.document, gameValue = globalThis.game } = {}) {
  try {
    const value = String(text ?? "");
    let copied = false;
    if (navigatorValue?.clipboard?.writeText) {
      try {
        await navigatorValue.clipboard.writeText(value);
        copied = true;
      } catch {}
    }
    if (!copied) copied = await fallbackCopy(value, documentValue);
    if (!copied) throw new Error("clipboard unavailable");
    gameValue?.ui?.notifications?.info?.("Arcflight Test Lab evidence copied to clipboard.");
    return true;
  } catch {
    gameValue?.ui?.notifications?.warn?.("Arcflight Test Lab could not copy to clipboard.");
    return false;
  }
}

export function normalizeTestLabEvents(result) {
  if (result?.ok !== true || !Array.isArray(result.events)) return [];
  const seen = new Set();
  return result.events
    .filter((entry) => typeof entry?.eventId === "string" && entry.eventId.trim().length > 0)
    .filter((entry) => {
      if (seen.has(entry.eventId)) return false;
      seen.add(entry.eventId);
      return true;
    })
    .map((entry) => ({ ...entry, label: entry.title ?? entry.name ?? entry.eventId }));
}

export function normalizeTestLabShips(result) {
  if (result?.ok !== true || !Array.isArray(result.ships)) return [];
  const seen = new Set();
  return result.ships
    .filter((entry) => typeof entry?.id === "string" && entry.id.trim().length > 0)
    .filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    })
    .map((entry) => ({ ...entry, label: entry.name ?? entry.id }));
}

export function selectTestLabEvidence(steps, selectedStepId = null) {
  const list = testLabTimeline(steps);
  return list.find((step) => step.stepId === selectedStepId) ?? list[0] ?? null;
}

function appFromTarget(target) {
  const shell = target?.closest?.("[data-component='event-test-lab-shell']");
  if (shell?._arcflightTestLabApp) return shell._arcflightTestLabApp;
  const wrapper = target?.closest?.(".arcflight-test-lab");
  return wrapper?._arcflightTestLabApp ?? wrapper?._app ?? null;
}

function hasOption(options, value, key) {
  return Array.isArray(options) && options.some((option) => option?.[key] === value);
}

export class ArcflightTestLabApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "arcflight-test-lab",
    tag: "section",
    classes: ["arcflight", "arcflight-test-lab"],
    width: 1480,
    height: 920,
    resizable: true,
    title: "ARCFLIGHT TEST LAB",
    actions: {
      runTest: ArcflightTestLabApp.runTest,
      clearResults: ArcflightTestLabApp.clearResults
    }
  };

  static PARTS = {
    body: { template: arcflightTemplatePath("voyage/event-test-lab.hbs") }
  };

  static async runTest(event, target) {
    const app = appFromTarget(target);
    if (!app || app._isRunning || !isActiveGm()) return;
    const suiteId = app._selectedSuiteId ?? "quick-check";
    const selectedEventId = hasOption(app._eventOptions, app._selectedEventId, "eventId") ? app._selectedEventId : app._eventOptions?.[0]?.eventId ?? null;
    const selectedShipId = hasOption(app._shipOptions, app._selectedShipId, "id") ? app._selectedShipId : app._shipOptions?.[0]?.id ?? null;
    app._selectedEventId = selectedEventId;
    app._selectedShipId = selectedShipId;
    const forcePostLaunchFailure = app._forcePostLaunchFailure === true && suiteId === "quick-check";
    const resolutionSuite = suiteId.startsWith("resolution-");
    const fixture = resolutionSuite ? (app._lastRun?.fixture ?? app._lastRun?.profile?.fixture ?? null) : null;
    const fixtureSessionId = fixture?.sessionId ?? null;
    app._isRunning = true;
    app._lastRun = { ok: false, summary: { total: 0, passed: 0, failed: 0, skipped: 0, warnings: 0, status: "RUNNING" }, steps: [], profile: { suiteId, eventId: selectedEventId, shipId: selectedShipId, forcePostLaunchFailure, sessionId: fixtureSessionId }, retainedSessionId: fixtureSessionId, fixture };
    app._selectedStepId = null;
    await app.render();
    const registry = createSuiteRegistry();
    const gameValue = globalThis.game;
    const context = { game: gameValue, eventTest: gameValue?.arcflight?.eventTest, authenticatedUserId: gameValue?.user?.id ?? null, authenticatedConnectionId: gameValue?.socket?.id ?? null, activeGmUserId: gameValue?.users?.activeGM?.id ?? null, users: valuesFromCollection(gameValue?.users), eventDefinitions: app._eventOptions, ships: app._shipOptions };
    const runner = createTestRunner({ registry, context });
    try {
      const result = await runner.run({ suiteId, lane: "ENGINE", eventId: selectedEventId, shipId: selectedShipId, forcePostLaunchFailure, fixtureSessionId, fixture, degreeProfile: app._degreeProfile ?? "all-success", customDegrees: app._customDegrees ?? null, reactionMode: app._reactionMode ?? "pass", onProgress: (progress) => { app._lastRun = progress; app._selectedStepId = progress.steps.at(-1)?.stepId ?? app._selectedStepId; void app.render(); } });
      app._lastRun = result;
      app._selectedStepId = result.steps.at(-1)?.stepId ?? null;
    } catch (error) {
      app._lastRun = { ok: false, summary: { total: 1, passed: 0, failed: 1, skipped: 0, warnings: 0, status: "FAILED" }, steps: [{ stepId: "runner", label: "Test runner", status: "FAIL", errorCode: error?.code ?? "m12-test-runner-threw", errorPath: error?.path ?? "runner", errorMessage: error?.message ?? String(error), actual: error?.message ?? String(error) }], profile: { suiteId, eventId: selectedEventId, shipId: selectedShipId }, retainedSessionId: null };
      app._selectedStepId = "runner";
    } finally {
      app._isRunning = false;
      await app.render();
    }
  }

  static clearResults(event, target) {
    const app = appFromTarget(target);
    if (!app) return;
    app._lastRun = null;
    app._selectedStepId = null;
    app.render();
  }

  static async runResolutionControl(event, target) {
    const app = appFromTarget(target);
    if (!app || app._isRunning || !isActiveGm()) return;
    const action = target?.dataset?.resolutionAction;
    const fixture = app._lastRun?.fixture ?? app._lastRun?.profile?.fixture ?? null;
    const sessionId = fixture?.sessionId ?? app._lastRun?.retainedSessionId ?? null;
    if (!sessionId) return;
    app._isRunning = true;
    const api = globalThis.game?.arcflight?.eventTest;
    const input = { sessionId, degreeProfile: app._degreeProfile ?? "all-success", customDegrees: app._customDegrees ?? null, reactionMode: app._reactionMode ?? "pass" };
    const result = action === "start-resolution" ? await api?.startResolution?.({ sessionId })
      : action === "run-current-station" ? await api?.runCurrentStation?.(input)
        : action === "pass-current-reaction" ? await api?.passCurrentReaction?.({ sessionId })
          : action === "run-next-station" ? await api?.runNextStation?.(input)
            : await api?.runAllStations?.(input);
    const previous = app._lastRun ?? { runId: null, profile: { suiteId: "resolution-controls", eventId: app._selectedEventId, shipId: app._selectedShipId }, steps: [], summary: { total: 0, passed: 0, failed: 0, skipped: 0, warnings: 0, status: "IDLE" } };
    const step = { stepId: `resolution-control-${action}-${Date.now()}`, label: action.replaceAll("-", " ").toUpperCase(), status: result?.ok === true ? "PASS" : "FAIL", expected: action, actual: result?.checkpoint ?? result?.snapshot?.resolution?.currentStationId ?? null, errorCode: result?.errors?.[0]?.code ?? null, errorPath: result?.errors?.[0]?.path ?? null, errorMessage: result?.errors?.[0]?.message ?? null, message: result?.ok === true ? "Canonical resolution control completed." : null, beforeSnapshot: result?.beforeSnapshot ?? null, afterSnapshot: result?.afterSnapshot ?? result?.snapshot ?? null, writes: Array.isArray(result?.trace) ? result.trace.reduce((total, entry) => total + (Number.isSafeInteger(entry?.writes) ? entry.writes : 0), 0) : 0, diff: [], invariantResults: result?.trace?.flatMap((entry) => entry.invariantResults ?? []) ?? [], runtimeTrace: result?.trace ?? [], commandSummary: result?.ok === true ? "Canonical runtime mutation completed." : "Canonical runtime mutation failed." };
    const steps = [...(previous.steps ?? []), step];
    const summary = { total: steps.length, passed: steps.filter((entry) => entry.status === "PASS").length, failed: steps.filter((entry) => entry.status === "FAIL").length, skipped: steps.filter((entry) => entry.status === "SKIPPED").length, warnings: steps.filter((entry) => entry.status === "WARNING").length, status: result?.ok === true ? "PASSED" : "FAILED" };
    app._lastRun = { ...previous, ok: result?.ok === true, suiteId: "resolution-controls", summary, steps, retainedSessionId: sessionId, fixture, profile: { ...(previous.profile ?? {}), suiteId: "resolution-controls", sessionId, degreeProfile: app._degreeProfile ?? "all-success", customDegrees: app._customDegrees ?? null, reactionMode: app._reactionMode ?? "pass" } };
    app._selectedStepId = step.stepId;
    app._isRunning = false;
    await app.render();
  }

  static async copyStepEvidence(event, target) {
    const app = appFromTarget(target);
    const run = app?._lastRun;
    const step = selectTestLabEvidence(run?.steps, app?._selectedStepId);
    if (!step) return;
    await copyTestLabText(formatTestLabStepEvidence(step));
  }

  static async copyRunSummary(event, target) {
    const app = appFromTarget(target);
    const run = app?._lastRun;
    if (!run) return;
    await copyTestLabText(formatTestLabRunSummary(run));
  }

  static async copyPreparedFixture(event, target) {
    const app = appFromTarget(target);
    const run = app?._lastRun;
    const fixture = run?.fixture ?? run?.profile?.fixture;
    if (!fixture) return;
    await copyTestLabText(formatTestLabPreparedFixture(fixture, run));
  }

  static async copyAllResults(event, target) {
    const app = appFromTarget(target);
    const run = app?._lastRun;
    if (!run) return;
    const step = selectTestLabEvidence(run.steps, app?._selectedStepId);
    const fixture = run.fixture ?? run.profile?.fixture;
    await copyTestLabText(formatTestLabAllResults(run, fixture, step));
  }

  static async copyFailureBundle(event, target) {
    const app = appFromTarget(target);
    const run = app?._lastRun;
    if (!run) return;
    const step = selectTestLabEvidence(run.steps, app?._selectedStepId);
    await copyTestLabText(formatTestLabFailureBundle(run, run.fixture ?? run.profile?.fixture, step));
  }

  static selectStep(event, target) {
    const app = appFromTarget(target);
    if (!app) return;
    app._selectedStepId = target?.dataset?.stepId ?? null;
    app.render();
  }

  static async cleanupRetainedFixture(event, target) {
    const app = appFromTarget(target);
    const sessionId = app?._lastRun?.retainedSessionId;
    if (!app || !sessionId || !isActiveGm()) return;
    const result = await globalThis.game?.arcflight?.eventTest?.abandon?.({ sessionId });
    if (result?.ok === true) app._lastRun = { ...app._lastRun, retainedSessionId: null, fixture: null, cleanup: result, cleanupError: null };
    else app._lastRun = { ...app._lastRun, cleanupError: result?.errors?.[0] ?? { code: "m12-test-session-cleanup-unavailable", message: "Retained fixture cleanup failed." } };
    app.render();
  }

  async _prepareContext() {
    if (!isActiveGm()) return { isGm: false, summary: { total: 0, passed: 0, failed: 0, skipped: 0, warnings: 0, status: "IDLE" }, suiteRegistry: [], lanes: [], eventOptions: [], shipOptions: [], timeline: [], evidence: null };
    if (!this._selectorPromise) {
      const eventPromise = game.arcflight?.eventTest?.listEvents?.() ?? Promise.resolve({ ok: false, errors: [{ code: "m11-event-definition-not-found", message: "Event Test event discovery is unavailable." }] });
      const shipPromise = game.arcflight?.eventTest?.listShips?.() ?? Promise.resolve({ ok: false, errors: [{ code: "m11-invalid-ship-fixture", message: "Event Test ship discovery is unavailable." }] });
      this._selectorPromise = Promise.all([Promise.resolve(eventPromise), Promise.resolve(shipPromise)]).then(([events, ships]) => {
        this._eventOptions = normalizeTestLabEvents(events);
        this._shipOptions = normalizeTestLabShips(ships);
        this._eventDiscoveryError = events?.errors?.[0] ?? null;
        this._shipDiscoveryError = ships?.errors?.[0] ?? null;
        if (!hasOption(this._eventOptions, this._selectedEventId, "eventId")) this._selectedEventId = this._eventOptions[0]?.eventId ?? null;
        if (!hasOption(this._shipOptions, this._selectedShipId, "id")) this._selectedShipId = this._shipOptions[0]?.id ?? null;
      }).catch((error) => {
        this._eventOptions = [];
        this._shipOptions = [];
        this._eventDiscoveryError = { code: "m11-event-definition-not-found", message: error?.message ?? "Event discovery failed." };
        this._shipDiscoveryError = { code: "m11-invalid-ship-fixture", message: error?.message ?? "Ship discovery failed." };
      });
    }
    await this._selectorPromise;
    const registry = createSuiteRegistry();
    const selectedSuite = registry.find((suite) => suite.id === (this._selectedSuiteId ?? "quick-check")) ?? registry[0];
    const run = this._lastRun ?? null;
    const fixture = run?.fixture ?? run?.profile?.fixture ?? null;
    const steps = run?.steps ?? [];
    const evidence = selectTestLabEvidence(steps, this._selectedStepId);
    const copyAvailability = testLabCopyAvailability({ run, evidence, fixture });
    const resolutionAvailability = resolutionControlAvailability(run, fixture);
    const gameValue = globalThis.game;
    const environment = { moduleVersion: gameValue?.modules?.get?.("arcflight")?.version ?? "0.0.0", foundryVersion: gameValue?.version ?? "unknown", pf2eVersion: gameValue?.system?.version ?? "unknown", buildIdentifier: globalThis.__arcflightBuildId ?? "local", activeGm: activeGmDisplayName(gameValue), activeGmId: gameValue?.users?.activeGM?.id ?? null };
    return {
      environment,
      selectedSuiteId: selectedSuite.id,
      suiteRegistry: registry,
      lanes: ["ENGINE", "GM FLOW", "PLAYER VIEW"],
      summary: run?.summary ?? { total: 0, passed: 0, failed: 0, skipped: 0, warnings: 0, status: "IDLE" },
      run,
      fixture,
      isFixturePrep: selectedSuite.id === "fixture-prep",
      selectedSuite,
      timeline: testLabTimeline(steps),
      selectedStepId: evidence?.stepId ?? null,
      copyAvailability,
      resolutionAvailability,
      degreeProfiles: ["all-success", "all-failure", "all-critical-success", "all-critical-failure", "custom"],
      selectedDegreeProfile: this._degreeProfile ?? "all-success",
      customDegrees: this._customDegrees ?? { captain: "success", engineer: "success", navigator: "success", watchmaster: "success", veilwarden: "success" },
      degreeStations: ["captain", "engineer", "navigator", "watchmaster", "veilwarden"].map((stationId) => ({ stationId, degree: (this._customDegrees ?? { captain: "success", engineer: "success", navigator: "success", watchmaster: "success", veilwarden: "success" })[stationId] ?? "success" })),
      evidence: evidence ? { ...evidence, retainedSessionId: run?.retainedSessionId ?? null, expectedText: safeText(evidence.expected), actualText: safeText(evidence.actual), beforeSnapshotText: safeText(evidence.beforeSnapshot), afterSnapshotText: safeText(evidence.afterSnapshot), beforeResolutionEvidenceText: safeText(evidence.beforeEvidence), afterResolutionEvidenceText: safeText(evidence.afterEvidence) } : null,
      eventOptions: this._eventOptions ?? [],
      shipOptions: this._shipOptions ?? [],
      selectedEventId: this._selectedEventId,
      selectedShipId: this._selectedShipId,
      eventDiscoveryError: this._eventDiscoveryError,
      shipDiscoveryError: this._shipDiscoveryError,
      selectorReady: Boolean(this._eventOptions?.length && this._shipOptions?.length),
      forcePostLaunchFailureAvailable: selectedSuite.id === "quick-check" && selectedSuite.lane === "ENGINE",
      forcePostLaunchFailure: this._forcePostLaunchFailure === true,
      isRunning: this._isRunning === true,
      isGm: true
    };
  }

  async _onRender(context, options) {
    const root = this.element;
    if (!root) return;
    this.element._app = this;
    const shell = root.querySelector("[data-component='event-test-lab-shell']");
    if (shell) shell._arcflightTestLabApp = this;
    root.querySelectorAll("[data-suite-id]").forEach((button) => button.addEventListener("click", () => { if (!button.disabled) { this._selectedSuiteId = button.dataset.suiteId; this._selectedStepId = null; this.render(); } }));
    root.querySelectorAll("[data-step-id]").forEach((button) => button.addEventListener("click", () => this.constructor.selectStep({ target: button }, button)));
    const eventSelector = root.querySelector("[data-selector='event']");
    if (eventSelector) eventSelector.addEventListener("change", (event) => { this._selectedEventId = event.target.value || null; this.render(); });
    const shipSelector = root.querySelector("[data-selector='ship']");
    if (shipSelector) shipSelector.addEventListener("change", (event) => { this._selectedShipId = event.target.value || null; this.render(); });
    root.querySelector("[data-action='runTest']")?.addEventListener("click", (event) => this.constructor.runTest(event, event.currentTarget));
    root.querySelector("[data-action='clearResults']")?.addEventListener("click", (event) => this.constructor.clearResults(event, event.currentTarget));
    root.querySelector("[data-action='copyRunSummary']")?.addEventListener("click", (event) => this.constructor.copyRunSummary(event, event.currentTarget));
    root.querySelector("[data-action='copyAllResults']")?.addEventListener("click", (event) => this.constructor.copyAllResults(event, event.currentTarget));
    root.querySelector("[data-action='copyStepEvidence']")?.addEventListener("click", (event) => this.constructor.copyStepEvidence(event, event.currentTarget));
    root.querySelector("[data-action='copyPreparedFixture']")?.addEventListener("click", (event) => this.constructor.copyPreparedFixture(event, event.currentTarget));
    root.querySelector("[data-action='copyFailureBundle']")?.addEventListener("click", (event) => this.constructor.copyFailureBundle(event, event.currentTarget));
    root.querySelector("[data-action='cleanupRetainedFixture']")?.addEventListener("click", (event) => this.constructor.cleanupRetainedFixture(event, event.currentTarget));
    root.querySelectorAll("[data-resolution-action]").forEach((button) => button.addEventListener("click", (event) => this.constructor.runResolutionControl(event, event.currentTarget)));
    root.querySelector("[data-selector='degree-profile']")?.addEventListener("change", (event) => { this._degreeProfile = event.target.value; this.render(); });
    root.querySelector("[data-selector='reaction-mode']")?.addEventListener("change", (event) => { this._reactionMode = event.target.value; this.render(); });
    root.querySelectorAll("[data-degree-station]").forEach((select) => select.addEventListener("change", (event) => { this._customDegrees = { ...(this._customDegrees ?? {}), [event.currentTarget.dataset.degreeStation]: event.currentTarget.value }; this.render(); }));
    root.querySelector("[data-action='toggleForcedFailure']")?.addEventListener("change", (event) => { this._forcePostLaunchFailure = event.currentTarget.checked === true; this.render(); });
  }
}

export function openArcflightTestLab(gameValue = globalThis.game) {
  if (!isActiveGm(gameValue)) {
    gameValue?.ui?.notifications?.warn?.("Arcflight Test Lab is available to the active GM only.");
    return null;
  }
  return new ArcflightTestLabApp().render(true);
}
