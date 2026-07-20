import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState, normalizeVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { validateVoyageEncounterState } from "../../../scripts/voyage/domain/validation.js";

test("creates independent Draft Voyage Encounter state at revision zero", () => {
  const first = createVoyageEncounterState({}, { idGenerator: () => "voyage-first" });
  const second = createVoyageEncounterState({}, { idGenerator: () => "voyage-second" });
  first.participants.push({ participantId: "crew-1" });
  first.selections.station = { actionId: "test" };

  assert.equal(first.encounterId, "voyage-first");
  assert.equal(second.encounterId, "voyage-second");
  assert.equal(first.lifecycleState, "draft");
  assert.equal(first.revision, 0);
  assert.equal(first.currentStage, null);
  assert.equal(first.roundNumber, null);
  assert.equal(first.phase, null);
  assert.deepEqual(second.participants, []);
  assert.deepEqual(second.selections, {});
});

test("normalization is non-mutating, restores collections, and retains valid values", () => {
  const source = { encounterId: "voyage-1", lifecycleState: "configuration", revision: 2, participants: [{ participantId: "crew-1" }] };
  const normalized = normalizeVoyageEncounterState(source);

  assert.deepEqual(source, { encounterId: "voyage-1", lifecycleState: "configuration", revision: 2, participants: [{ participantId: "crew-1" }] });
  assert.deepEqual(normalized.participants, [{ participantId: "crew-1" }]);
  assert.deepEqual(normalized.tracks, []);
  assert.deepEqual(normalized.selections, {});
  assert.equal(normalizeVoyageEncounterState({ primaryShip: [] }).primaryShip, null);
});

test("validation reports structural state errors", () => {
  const state = createVoyageEncounterState({ encounterId: "voyage-1" });
  state.lifecycleState = "not-a-lifecycle";
  state.revision = -1;
  state.participants = {};
  state.processedRequestIds = ["request-1", "request-1"];
  const report = validateVoyageEncounterState(state);

  assert.equal(report.valid, false);
  assert.ok(report.errors.some((entry) => entry.code === "invalid-lifecycle-state"));
  assert.ok(report.errors.some((entry) => entry.code === "invalid-revision"));
  assert.ok(report.errors.some((entry) => entry.code === "invalid-collection-type"));
  assert.ok(report.errors.some((entry) => entry.code === "duplicate-request-id"));
});

test("Active encounter validation requires definition, ship, stage, round, and phase", () => {
  const state = createVoyageEncounterState({ encounterId: "voyage-1" });
  state.lifecycleState = "active";
  const report = validateVoyageEncounterState(state);

  assert.ok(report.errors.some((entry) => entry.code === "missing-definition"));
  assert.ok(report.errors.some((entry) => entry.code === "missing-primary-ship"));
  assert.ok(report.errors.some((entry) => entry.code === "missing-current-stage"));
  assert.ok(report.errors.some((entry) => entry.code === "invalid-active-round"));
  assert.ok(report.errors.some((entry) => entry.code === "invalid-active-phase"));
});

test("validation reports duplicate domain IDs and malformed snapshots or recovery state", () => {
  const state = createVoyageEncounterState({ encounterId: "voyage-1" });
  state.participants = [{ participantId: "crew-1" }, { participantId: "crew-1" }];
  state.tracks = [{ trackId: "progress" }, { trackId: "progress" }];
  state.permanentConsequences = [{ consequenceId: "scar" }, { consequenceId: "scar" }];
  state.snapshots = [{}];
  state.recovery = [];
  const report = validateVoyageEncounterState(state);

  assert.ok(report.errors.filter((entry) => entry.code === "duplicate-id").length === 3);
  assert.ok(report.errors.some((entry) => entry.code === "malformed-snapshot"));
  assert.ok(report.errors.some((entry) => entry.code === "malformed-recovery"));
});

test("domain modules import without Foundry globals and registration exposes helpers", async () => {
  const previousHooks = globalThis.Hooks;
  const previousConfig = globalThis.CONFIG;
  const previousGame = globalThis.game;
  let initCallback;
  globalThis.Hooks = { once: (_event, callback) => { initCallback = callback; } };
  globalThis.CONFIG = {};
  globalThis.game = {};

  await import("../../../scripts/arcflight.js");
  initCallback();
  assert.equal(typeof globalThis.game.arcflight.createVoyageEncounterState, "function");
  assert.equal(typeof globalThis.game.arcflight.normalizeVoyageEncounterState, "function");
  assert.equal(typeof globalThis.game.arcflight.validateVoyageEncounterState, "function");
  assert.equal(typeof globalThis.game.arcflight.devTools.createVoyageEncounterState, "function");
  assert.equal(typeof globalThis.game.arcflight.devTools.normalizeVoyageEncounterState, "function");
  assert.equal(typeof globalThis.game.arcflight.devTools.validateVoyageEncounterState, "function");

  globalThis.Hooks = previousHooks;
  globalThis.CONFIG = previousConfig;
  globalThis.game = previousGame;
});
