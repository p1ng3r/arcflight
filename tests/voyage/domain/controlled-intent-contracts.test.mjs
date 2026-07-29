import assert from "node:assert/strict";
import test from "node:test";
import { createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";
import { analyzeVoyageEncounterActionOutcomeDefinitions } from "../../../scripts/voyage/domain/consequence-rules.js";
import {
  VOYAGE_CONTROLLED_EFFECT_INTENT_TYPES as CONTROLLED,
  VOYAGE_EFFECT_INTENT_TYPES as INTENTS,
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES as LIFE,
  VOYAGE_ROUND_PHASES as PHASES,
  VOYAGE_EFFECT_TARGET_KINDS as TARGETS
} from "../../../scripts/voyage/domain/constants.js";
import {
  VOYAGE_CONTROLLED_EFFECT_INTENT_CONTRACTS as CONTRACTS,
  isVoyageControlledEffectIntentType,
  validateVoyageControlledEffectIntent
} from "../../../scripts/voyage/domain/controlled-intent-contracts.js";

const TASK_02 = [
  CONTROLLED.DC_CHANGE,
  CONTROLLED.ROLL_MODIFIER,
  CONTROLLED.RESULT_DEGREE_SHIFT,
  CONTROLLED.REROLL,
  CONTROLLED.ROLL_TWICE
];
const TASK_03 = [
  CONTROLLED.FOCUS_RESTORATION,
  CONTROLLED.PRESSURE_CHANGE,
  CONTROLLED.HAZARD_CREATE,
  CONTROLLED.HAZARD_REMOVE,
  CONTROLLED.HAZARD_PREVENT,
  CONTROLLED.HAZARD_SUPPRESS,
  CONTROLLED.STATION_ORDER_CHANGE,
  CONTROLLED.SYSTEM_REPAIR,
  CONTROLLED.SYSTEM_PROTECTION
];

function state(effectRule) {
  return {
    ...createDraftVoyageEncounterDefaults(),
    encounterId: "encounter",
    definitionId: "definition",
    lifecycleState: LIFE.ACTIVE,
    revision: 0,
    primaryShip: { actorId: "ship" },
    currentStage: { stageId: "stage" },
    roundNumber: 1,
    phase: PHASES.CONSEQUENCES,
    availableStations: [{
      stationId: "captain",
      actions: [{
        actionId: "controlled",
        outcomeDefinition: {
          effectRules: [effectRule],
          branches: { "no-roll": ["effect"] }
        }
      }]
    }],
    stationAssignments: [{ stationId: "captain", operator: { kind: "actor", uuid: "Actor.captain" } }],
    selections: {},
    proposedStationOrder: [],
    committedStationOrder: [],
    successConditions: [{ conditionId: "success" }],
    failureConditions: [{ conditionId: "failure" }]
  };
}

function rule(intentType, payload, target = { kind: TARGETS.SOURCE_STATION }, timing = "consequences") {
  return {
    effectId: "effect",
    intentType,
    timing,
    visibility: "public",
    target,
    payload
  };
}

function reportFor(intentType, payload, target, timing) {
  return analyzeVoyageEncounterActionOutcomeDefinitions(state(rule(intentType, payload, target, timing)));
}

test("all fourteen controlled contracts are implemented with declarative metadata", () => {
  for (const intentType of TASK_02) assert.equal(CONTRACTS[intentType].implemented, true, intentType);
  for (const intentType of TASK_03) assert.equal(CONTRACTS[intentType].implemented, true, intentType);
  assert.equal(Object.keys(CONTRACTS).length, 14);
  assert.equal(Object.values(CONTRACTS).some(({ implemented }) => !implemented), false);
  assert.equal(INTENTS.TEMPORARY_MODIFIER, "temporary-modifier");
  assert.deepEqual(CONTRACTS[CONTROLLED.DC_CHANGE].applicationConstraints, { maximumTotalDcReduction: -5 });
  assert.deepEqual(CONTRACTS[CONTROLLED.ROLL_MODIFIER].applicationConstraints, { minimumTotal: -5, maximumTotal: 5 });
  assert.deepEqual(CONTRACTS[CONTROLLED.ROLL_TWICE].applicationConstraints, { maximumPerCheck: 1 });
  assert.deepEqual(CONTRACTS[CONTROLLED.FOCUS_RESTORATION].applicationConstraints, { maximumAtCurrentCapacity: true });
  assert.deepEqual(CONTRACTS[CONTROLLED.PRESSURE_CHANGE].applicationConstraints, { minimumAppliedPressure: 0 });
});

test("controlled lookup is exact and prototype-safe", () => {
  assert.equal(isVoyageControlledEffectIntentType("__proto__"), false);
  assert.equal(isVoyageControlledEffectIntentType("constructor"), false);
  const errors = [];
  const result = validateVoyageControlledEffectIntent({
    intentType: "__proto__",
    timing: "consequences",
    target: { kind: TARGETS.SOURCE_STATION },
    payload: {},
    path: "$.effect",
    errors
  });
  assert.deepEqual(result, { controlled: false, valid: true, payload: null });
  assert.deepEqual(errors, []);
});

test("resource, pressure, hazard, station-order, and system contracts enforce exact payloads", () => {
  for (const amount of [1, Number.MAX_SAFE_INTEGER]) {
    assert.equal(reportFor(CONTROLLED.FOCUS_RESTORATION, { amount }).definitionsValid, true);
  }
  for (const amount of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1"]) {
    assert.equal(reportFor(CONTROLLED.FOCUS_RESTORATION, { amount }).definitionsValid, false);
  }
  for (const delta of [-2, 2]) assert.equal(reportFor(CONTROLLED.PRESSURE_CHANGE, { delta }).definitionsValid, true);
  for (const delta of [0, 1.5, Number.MAX_SAFE_INTEGER + 1, "1"]) {
    assert.equal(reportFor(CONTROLLED.PRESSURE_CHANGE, { delta }).definitionsValid, false);
  }
  for (const pressureId of ["crew-morale", "arkengine", "levstone-array", "solar-sail-rig", "lifeveil"]) {
    assert.equal(reportFor(CONTROLLED.PRESSURE_CHANGE, { delta: 1 }, { kind: TARGETS.PRESSURE_SYSTEM, targetId: pressureId }).definitionsValid, true, pressureId);
  }
  assert.equal(reportFor(CONTROLLED.PRESSURE_CHANGE, { delta: 1 }, { kind: TARGETS.PRESSURE_SYSTEM, targetId: "Arkengine" }).definitionsValid, false);

  for (const target of [
    { kind: TARGETS.PRESSURE_SYSTEM, targetId: "arkengine" },
    { kind: TARGETS.ENCOUNTER },
    { kind: TARGETS.CURRENT_STAGE },
    { kind: TARGETS.SELECTED_TARGET }
  ]) {
    assert.equal(reportFor(CONTROLLED.HAZARD_CREATE, { hazardId: "storm" }, target).definitionsValid, true, target.kind);
  }
  assert.equal(reportFor(CONTROLLED.HAZARD_CREATE, { hazardId: "storm" }, { kind: TARGETS.HAZARD, targetId: "storm" }).definitionsValid, false);
  assert.equal(reportFor(CONTROLLED.HAZARD_CREATE, { hazardId: " storm " }, { kind: TARGETS.ENCOUNTER }).definitionsValid, false);
  assert.equal(reportFor(CONTROLLED.HAZARD_CREATE, { hazardId: "" }).definitionsValid, false);

  for (const intentType of [CONTROLLED.HAZARD_REMOVE, CONTROLLED.HAZARD_PREVENT, CONTROLLED.HAZARD_SUPPRESS]) {
    for (const target of [{ kind: TARGETS.HAZARD, targetId: "storm" }, { kind: TARGETS.SELECTED_TARGET }]) {
      assert.equal(reportFor(intentType, {}, target).definitionsValid, true, `${intentType}:${target.kind}`);
      assert.equal(reportFor(intentType, { extra: true }, target).definitionsValid, false);
    }
    assert.equal(reportFor(intentType, {}, { kind: TARGETS.ENCOUNTER }).definitionsValid, false);
  }

  for (const payload of [{ position: "first" }, { position: "last" }, { position: "before", anchorStationId: "navigator" }, { position: "after", anchorStationId: "engineer" }]) {
    assert.equal(reportFor(CONTROLLED.STATION_ORDER_CHANGE, payload, { kind: TARGETS.SOURCE_STATION }).definitionsValid, true, JSON.stringify(payload));
  }
  for (const payload of [{ position: "before" }, { position: "first", anchorStationId: "navigator" }, { position: "before", anchorStationId: "Captain" }, { position: "middle" }, {}]) {
    assert.equal(reportFor(CONTROLLED.STATION_ORDER_CHANGE, payload, { kind: TARGETS.SOURCE_STATION }).definitionsValid, false, JSON.stringify(payload));
  }
  const conflict = reportFor(CONTROLLED.STATION_ORDER_CHANGE, { position: "before", anchorStationId: "captain" }, { kind: TARGETS.STATION, targetId: "captain" });
  assert.equal(conflict.definitionsValid, false);
  assert.ok(conflict.errors.some(({ code }) => code === "controlled-intent-payload-anchor-target-conflict"));
  assert.equal(reportFor(CONTROLLED.STATION_ORDER_CHANGE, { position: "before", anchorStationId: "captain" }, { kind: TARGETS.SELECTED_TARGET }).definitionsValid, true);

  for (const [intentType, payload] of [
    [CONTROLLED.SYSTEM_REPAIR, { scope: "temporary" }],
    [CONTROLLED.SYSTEM_PROTECTION, { scope: "next-consequence" }]
  ]) {
    for (const target of [
      { kind: TARGETS.SOURCE_STATION },
      { kind: TARGETS.STATION, targetId: "captain" },
      { kind: TARGETS.PRESSURE_SYSTEM, targetId: "arkengine" },
      { kind: TARGETS.SELECTED_TARGET }
    ]) assert.equal(reportFor(intentType, payload, target).definitionsValid, true, `${intentType}:${target.kind}`);
    assert.equal(reportFor(intentType, { scope: "wrong" }).definitionsValid, false);
  }
});

test("Task 03 target and timing matrices remain exact", () => {
  const cases = [
    [CONTROLLED.FOCUS_RESTORATION, { amount: 1 }, [TARGETS.SOURCE_STATION, TARGETS.STATION, TARGETS.SELECTED_TARGET]],
    [CONTROLLED.PRESSURE_CHANGE, { delta: 1 }, [TARGETS.SOURCE_STATION, TARGETS.STATION, TARGETS.PRESSURE_SYSTEM, TARGETS.SELECTED_TARGET]],
    [CONTROLLED.HAZARD_CREATE, { hazardId: "storm" }, [TARGETS.PRESSURE_SYSTEM, TARGETS.ENCOUNTER, TARGETS.CURRENT_STAGE, TARGETS.SELECTED_TARGET]],
    [CONTROLLED.HAZARD_REMOVE, {}, [TARGETS.HAZARD, TARGETS.SELECTED_TARGET]],
    [CONTROLLED.HAZARD_PREVENT, {}, [TARGETS.HAZARD, TARGETS.SELECTED_TARGET]],
    [CONTROLLED.HAZARD_SUPPRESS, {}, [TARGETS.HAZARD, TARGETS.SELECTED_TARGET]],
    [CONTROLLED.STATION_ORDER_CHANGE, { position: "first" }, [TARGETS.SOURCE_STATION, TARGETS.STATION, TARGETS.SELECTED_TARGET]],
    [CONTROLLED.SYSTEM_REPAIR, { scope: "temporary" }, [TARGETS.SOURCE_STATION, TARGETS.STATION, TARGETS.PRESSURE_SYSTEM, TARGETS.SELECTED_TARGET]],
    [CONTROLLED.SYSTEM_PROTECTION, { scope: "next-consequence" }, [TARGETS.SOURCE_STATION, TARGETS.STATION, TARGETS.PRESSURE_SYSTEM, TARGETS.SELECTED_TARGET]]
  ];
  for (const [intentType, payload, targetKinds] of cases) {
    const targetForKind = (kind) => kind === TARGETS.STATION ? { kind, targetId: "captain" }
      : kind === TARGETS.PRESSURE_SYSTEM ? { kind, targetId: "arkengine" }
        : kind === TARGETS.HAZARD ? { kind, targetId: "storm" } : { kind };
    for (const kind of targetKinds) {
      const target = targetForKind(kind);
      assert.equal(reportFor(intentType, payload, target).definitionsValid, true, `${intentType}:${kind}`);
    }
    for (const timing of ["consequences", "end-of-round"]) assert.equal(reportFor(intentType, payload, targetForKind(targetKinds[0]), timing).definitionsValid, true);
    const invalidTiming = reportFor(intentType, payload, targetForKind(targetKinds[0]), "gm-confirmed");
    assert.equal(invalidTiming.definitionsValid, false);
    assert.ok(invalidTiming.errors.some(({ code }) => code === "controlled-intent-timing-incompatible"));
  }
});

test("dc-change and roll-modifier accept exact nonzero signed safe integers", () => {
  for (const intentType of [CONTROLLED.DC_CHANGE, CONTROLLED.ROLL_MODIFIER]) {
    for (const delta of [-5, 5]) {
      const report = reportFor(intentType, { delta });
      assert.equal(report.definitionsValid, true, `${intentType}:${delta}`);
      assert.deepEqual(report.actions[0].effectRules[0].payload, { delta });
    }
    for (const delta of [0, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, -Infinity, "1", new Number(1)]) {
      const report = reportFor(intentType, { delta });
      assert.equal(report.definitionsValid, false, `${intentType}:${String(delta)}`);
      assert.ok(report.errors.some((entry) => entry.path.endsWith(".payload.delta")));
    }
  }
});

test("result-degree-shift, reroll, and roll-twice accept only their exact payloads", () => {
  for (const steps of [1, -1]) {
    assert.equal(reportFor(CONTROLLED.RESULT_DEGREE_SHIFT, { steps }).definitionsValid, true);
  }
  for (const steps of [0, 2, -2, 1.5, "1", Number.POSITIVE_INFINITY]) {
    assert.equal(reportFor(CONTROLLED.RESULT_DEGREE_SHIFT, { steps }).definitionsValid, false);
  }
  assert.equal(reportFor(CONTROLLED.REROLL, { keep: "second" }).definitionsValid, true);
  assert.equal(reportFor(CONTROLLED.ROLL_TWICE, { keep: "better" }).definitionsValid, true);
  for (const [intentType, values] of [[CONTROLLED.REROLL, ["first", "SECOND", " second", true]], [CONTROLLED.ROLL_TWICE, ["best", "BETTER", " better", false]]]) {
    for (const keep of values) assert.equal(reportFor(intentType, { keep }).definitionsValid, false, `${intentType}:${String(keep)}`);
  }
});

test("all five contracts require exact target vocabulary and compatible timing", () => {
  const targets = [
    { kind: TARGETS.SOURCE_STATION },
    { kind: TARGETS.STATION, targetId: "captain" },
    { kind: TARGETS.SELECTED_TARGET }
  ];
  const payloads = {
    [CONTROLLED.DC_CHANGE]: { delta: 1 },
    [CONTROLLED.ROLL_MODIFIER]: { delta: 1 },
    [CONTROLLED.RESULT_DEGREE_SHIFT]: { steps: 1 },
    [CONTROLLED.REROLL]: { keep: "second" },
    [CONTROLLED.ROLL_TWICE]: { keep: "better" }
  };
  for (const intentType of TASK_02) {
    for (const target of targets) assert.equal(reportFor(intentType, payloads[intentType], target).definitionsValid, true, `${intentType}:${target.kind}`);
    for (const kind of [TARGETS.ENCOUNTER, TARGETS.CURRENT_STAGE, TARGETS.PRIMARY_SHIP, TARGETS.TRACK, TARGETS.PARTICIPANT, TARGETS.PRESSURE_SYSTEM, TARGETS.HAZARD]) {
      const target = kind === TARGETS.PRESSURE_SYSTEM || kind === TARGETS.HAZARD || kind === TARGETS.TRACK || kind === TARGETS.PARTICIPANT
        ? { kind, targetId: "captain" }
        : { kind };
      const report = reportFor(intentType, payloads[intentType], target);
      assert.equal(report.definitionsValid, false, `${intentType}:${kind}`);
      assert.ok(report.errors.some((entry) => entry.code === "controlled-intent-target-incompatible"));
    }
    const station = reportFor(intentType, payloads[intentType], { kind: TARGETS.STATION, targetId: "Captain" });
    assert.equal(station.definitionsValid, false);
    const timing = reportFor(intentType, payloads[intentType], { kind: TARGETS.SOURCE_STATION }, "gm-confirmed");
    assert.equal(timing.definitionsValid, false, `${intentType}:timing`);
    assert.ok(timing.errors.some((entry) => entry.code === "controlled-intent-timing-incompatible"));
  }
  assert.equal(reportFor(CONTROLLED.DC_CHANGE, { delta: 1 }, { kind: TARGETS.SOURCE_STATION }, "end-of-round").definitionsValid, true);
});

test("exact payload validation is hostile-data safe, isolated, and deterministic", () => {
  const accessor = {};
  let reads = 0;
  Object.defineProperty(accessor, "delta", { get() { reads += 1; return 1; }, enumerable: true });
  const setterOnly = {};
  Object.defineProperty(setterOnly, "delta", { set() {}, enumerable: true });
  const symbols = { delta: 1 };
  symbols[Symbol("hidden")] = true;
  const proxy = new Proxy({ delta: 1 }, { ownKeys() { throw new Error("hostile"); } });
  const inherited = Object.create({ delta: 1 });
  for (const payload of [accessor, setterOnly, symbols, proxy, inherited, null, [], "payload"]) {
    const before = payload && typeof payload === "object" && payload !== proxy ? Object.getPrototypeOf(payload) : null;
    const first = reportFor(CONTROLLED.DC_CHANGE, payload);
    const second = reportFor(CONTROLLED.DC_CHANGE, payload);
    assert.equal(first.definitionsValid, false);
    assert.deepEqual(first, second);
    if (before) assert.equal(Object.getPrototypeOf(payload), before);
  }
  assert.equal(reads, 0);

  const sourcePayload = { delta: -2 };
  const report = reportFor(CONTROLLED.DC_CHANGE, sourcePayload);
  assert.equal(report.definitionsValid, true);
  report.actions[0].effectRules[0].payload.delta = 9;
  assert.equal(sourcePayload.delta, -2);
});

test("unexpected and unsafe payload fields fail atomically", () => {
  for (const payload of [
    { delta: 1, extra: true },
    { delta: 1, ["__proto__"]: 2 },
    { delta: 1, ["constructor"]: 2 },
    { delta: 1, ["prototype"]: 2 },
    { keep: "second", extra: true }
  ]) {
    const intentType = Object.hasOwn(payload, "keep") ? CONTROLLED.REROLL : CONTROLLED.DC_CHANGE;
    const report = reportFor(intentType, payload);
    assert.equal(report.definitionsValid, false);
    assert.equal(report.actions[0].effectRules.length, 0);
  }
});
