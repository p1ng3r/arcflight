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
  const list = Array.isArray(steps) ? steps : [];
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
    app._isRunning = true;
    app._lastRun = { ok: false, summary: { total: 0, passed: 0, failed: 0, skipped: 0, warnings: 0, status: "RUNNING" }, steps: [], profile: { suiteId, eventId: selectedEventId, shipId: selectedShipId, forcePostLaunchFailure }, retainedSessionId: null };
    app._selectedStepId = null;
    await app.render();
    const registry = createSuiteRegistry();
    const gameValue = globalThis.game;
    const context = { game: gameValue, eventTest: gameValue?.arcflight?.eventTest, authenticatedUserId: gameValue?.user?.id ?? null, authenticatedConnectionId: gameValue?.socket?.id ?? null, activeGmUserId: gameValue?.users?.activeGM?.id ?? null, users: valuesFromCollection(gameValue?.users), eventDefinitions: app._eventOptions, ships: app._shipOptions };
    const runner = createTestRunner({ registry, context });
    try {
      const result = await runner.run({ suiteId, lane: "ENGINE", eventId: selectedEventId, shipId: selectedShipId, forcePostLaunchFailure, onProgress: (progress) => { app._lastRun = progress; app._selectedStepId = progress.steps.at(-1)?.stepId ?? app._selectedStepId; void app.render(); } });
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
    if (result?.ok === true) app._lastRun = { ...app._lastRun, retainedSessionId: null, cleanup: result, cleanupError: null };
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
    const steps = run?.steps ?? [];
    const evidence = selectTestLabEvidence(steps, this._selectedStepId);
    const gameValue = globalThis.game;
    const environment = { moduleVersion: gameValue?.modules?.get?.("arcflight")?.version ?? "0.0.0", foundryVersion: gameValue?.version ?? "unknown", pf2eVersion: gameValue?.system?.version ?? "unknown", buildIdentifier: globalThis.__arcflightBuildId ?? "local", activeGm: activeGmDisplayName(gameValue), activeGmId: gameValue?.users?.activeGM?.id ?? null };
    return {
      environment,
      selectedSuiteId: selectedSuite.id,
      suiteRegistry: registry,
      lanes: ["ENGINE", "GM FLOW", "PLAYER VIEW"],
      summary: run?.summary ?? { total: 0, passed: 0, failed: 0, skipped: 0, warnings: 0, status: "IDLE" },
      run,
      selectedSuite,
      timeline: steps,
      selectedStepId: evidence?.stepId ?? null,
      evidence: evidence ? { ...evidence, retainedSessionId: run?.retainedSessionId ?? null, expectedText: safeText(evidence.expected), actualText: safeText(evidence.actual), beforeSnapshotText: safeText(evidence.beforeSnapshot), afterSnapshotText: safeText(evidence.afterSnapshot) } : null,
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
    root.querySelector("[data-action='cleanupRetainedFixture']")?.addEventListener("click", (event) => this.constructor.cleanupRetainedFixture(event, event.currentTarget));
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
