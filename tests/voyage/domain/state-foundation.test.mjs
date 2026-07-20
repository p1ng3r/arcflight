import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState, normalizeVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { validateVoyageEncounterState } from "../../../scripts/voyage/domain/validation.js";
import { VOYAGE_ENCOUNTER_SCHEMA_VERSION } from "../../../scripts/voyage/domain/constants.js";

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

test("Draft creation uses the supported schema version", () => {
  const state = createVoyageEncounterState({ schemaVersion: 999, encounterId: "voyage-test" });

  assert.equal(state.schemaVersion, VOYAGE_ENCOUNTER_SCHEMA_VERSION);
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

test("normalization recursively isolates nested plain data and unknown extensions", () => {
  const source = {
    participants: [{ participantId: "crew-1", assignments: [{ stationId: "captain" }] }],
    tracks: [{ trackId: "progress", thresholds: [{ timing: "immediate", details: { label: "First mark" } }] }],
    metadata: { audit: { tags: ["alpha"] } },
    extension: { nested: [{ value: "preserve me" }] }
  };
  const normalized = normalizeVoyageEncounterState(source);

  assert.notStrictEqual(normalized.participants[0], source.participants[0]);
  assert.notStrictEqual(normalized.tracks[0].thresholds[0], source.tracks[0].thresholds[0]);
  assert.notStrictEqual(normalized.metadata.audit, source.metadata.audit);
  assert.notStrictEqual(normalized.extension.nested, source.extension.nested);
  normalized.participants[0].assignments[0].stationId = "engineer";
  normalized.tracks[0].thresholds[0].details.label = "Changed";
  normalized.metadata.audit.tags.push("changed");
  normalized.extension.nested[0].value = "changed";
  assert.equal(source.participants[0].assignments[0].stationId, "captain");
  assert.equal(source.tracks[0].thresholds[0].details.label, "First mark");
  assert.deepEqual(source.metadata.audit.tags, ["alpha"]);
  assert.equal(source.extension.nested[0].value, "preserve me");
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

test("Paused encounter validation requires retained round context", () => {
  const paused = createVoyageEncounterState({ encounterId: "voyage-paused" });
  paused.lifecycleState = "paused";
  paused.definitionId = "test-definition";
  paused.primaryShip = { shipId: "ship-1" };
  const missingContext = validateVoyageEncounterState(paused);

  assert.ok(missingContext.errors.some((entry) => entry.code === "missing-current-stage"));
  assert.ok(missingContext.errors.some((entry) => entry.code === "invalid-active-round"));
  assert.ok(missingContext.errors.some((entry) => entry.code === "invalid-active-phase"));

  paused.currentStage = { stageId: "stage-1" };
  paused.roundNumber = 1;
  paused.phase = "situation";
  const retainedContext = validateVoyageEncounterState(paused);

  assert.equal(retainedContext.errors.some((entry) => entry.code === "missing-current-stage"), false);
  assert.equal(retainedContext.errors.some((entry) => entry.code === "invalid-active-round"), false);
  assert.equal(retainedContext.errors.some((entry) => entry.code === "invalid-active-phase"), false);
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
