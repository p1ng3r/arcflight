import assert from "node:assert/strict";
import test from "node:test";

import {
  VOYAGE_PRESSURE_DEFAULT_CAPACITY,
  VOYAGE_PRESSURE_DEFAULT_VALUE,
  VOYAGE_PRESSURE_MAX_CAPACITY,
  VOYAGE_PRESSURE_SYSTEM_BY_STATION_ID,
  VOYAGE_PRESSURE_SYSTEM_IDS
} from "../../../scripts/voyage/domain/constants.js";
import { createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { validateVoyageEncounterState } from "../../../scripts/voyage/domain/validation.js";

function canonicalPressureSystems(overrides = {}) {
  return Object.fromEntries(VOYAGE_PRESSURE_SYSTEM_IDS.map((pressureSystemId) => {
    const override = overrides[pressureSystemId] ?? {};
    return [pressureSystemId, {
      pressureSystemId,
      value: VOYAGE_PRESSURE_DEFAULT_VALUE,
      capacity: VOYAGE_PRESSURE_DEFAULT_CAPACITY,
      ...override
    }];
  }));
}

function canonicalPressureRecord(pressureSystemId, overrides = {}) {
  return {
    pressureSystemId,
    value: VOYAGE_PRESSURE_DEFAULT_VALUE,
    capacity: VOYAGE_PRESSURE_DEFAULT_CAPACITY,
    ...overrides
  };
}

function createPressureEncounter(overrides = {}) {
  return createVoyageEncounterState({
    encounterId: "pressure-encounter",
    ...overrides
  });
}

function errorCodes(report) {
  return report.errors.map((entry) => entry.code);
}

function validateTwice(state) {
  const first = validateVoyageEncounterState(state);
  const second = validateVoyageEncounterState(state);
  assert.deepEqual(first, second);
  return first;
}

test("Draft state creates the exact five-system Pressure foundation with isolated records", () => {
  const first = createPressureEncounter({ encounterId: "pressure-first" });
  const second = createPressureEncounter({ encounterId: "pressure-second" });
  const defaults = createDraftVoyageEncounterDefaults();
  const expected = {
    captain: "crew-morale",
    engineer: "arkengine",
    navigator: "levstone-array",
    watchmaster: "solar-sail-rig",
    veilwarden: "lifeveil"
  };

  assert.deepEqual(VOYAGE_PRESSURE_SYSTEM_BY_STATION_ID, expected);
  assert.deepEqual(Object.keys(VOYAGE_PRESSURE_SYSTEM_BY_STATION_ID), Object.keys(expected));
  assert.deepEqual(VOYAGE_PRESSURE_SYSTEM_IDS, Object.values(expected));
  assert.equal(VOYAGE_PRESSURE_DEFAULT_VALUE, 0);
  assert.equal(VOYAGE_PRESSURE_DEFAULT_CAPACITY, 2);
  assert.equal(VOYAGE_PRESSURE_MAX_CAPACITY, 5);
  assert.deepEqual(Object.keys(first.pressureSystems), VOYAGE_PRESSURE_SYSTEM_IDS);
  assert.deepEqual(Object.keys(defaults.pressureSystems), VOYAGE_PRESSURE_SYSTEM_IDS);
  assert.notStrictEqual(first.pressureSystems, second.pressureSystems);
  assert.notStrictEqual(first.pressureSystems, defaults.pressureSystems);

  for (const pressureSystemId of VOYAGE_PRESSURE_SYSTEM_IDS) {
    assert.deepEqual(first.pressureSystems[pressureSystemId], {
      pressureSystemId,
      value: VOYAGE_PRESSURE_DEFAULT_VALUE,
      capacity: VOYAGE_PRESSURE_DEFAULT_CAPACITY
    });
    assert.notStrictEqual(first.pressureSystems[pressureSystemId], second.pressureSystems[pressureSystemId]);
    assert.notStrictEqual(first.pressureSystems[pressureSystemId], defaults.pressureSystems[pressureSystemId]);
  }

  assert.notStrictEqual(first.pressureSystems["crew-morale"], first.pressureSystems["arkengine"]);
  first.pressureSystems["crew-morale"].value = 1;
  first.pressureSystems["arkengine"].capacity = 4;
  assert.equal(second.pressureSystems["crew-morale"].value, VOYAGE_PRESSURE_DEFAULT_VALUE);
  assert.equal(defaults.pressureSystems["arkengine"].capacity, VOYAGE_PRESSURE_DEFAULT_CAPACITY);
});

test("Validation accepts exact custom Pressure records without mutating source data", () => {
  const source = {
    encounterId: "pressure-custom",
    pressureSystems: canonicalPressureSystems({
      "crew-morale": { value: 1, capacity: 4 },
      arkengine: { value: 0, capacity: 5 },
      "levstone-array": { value: 3, capacity: 3 },
      "solar-sail-rig": { value: 2, capacity: 2 },
      lifeveil: { value: 5, capacity: 5 }
    })
  };
  const before = structuredClone(source);
  const state = createVoyageEncounterState(source);
  const report = validateVoyageEncounterState(state);

  assert.equal(report.valid, true);
  assert.deepEqual(source, before);
  assert.deepEqual(state.pressureSystems, source.pressureSystems);
  assert.notStrictEqual(state.pressureSystems["crew-morale"], source.pressureSystems["crew-morale"]);
  state.pressureSystems["crew-morale"].value = 2;
  assert.equal(source.pressureSystems["crew-morale"].value, 1);
});

test("Validation rejects missing, inherited, unknown, symbol, accessor, proxy, and sparse Pressure boundaries", () => {
  const missing = createPressureEncounter();
  delete missing.pressureSystems;
  assert.ok(errorCodes(validateVoyageEncounterState(missing)).includes("missing-pressure-systems"));

  const inheritedDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, "lifeveil");
  try {
    Object.defineProperty(Object.prototype, "lifeveil", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: {
        pressureSystemId: "lifeveil",
        value: 0,
        capacity: 2
      }
    });

    const inherited = createPressureEncounter();
    delete inherited.pressureSystems.lifeveil;
    const report = validateVoyageEncounterState(inherited);
    assert.ok(errorCodes(report).includes("missing-pressure-system"));
    assert.ok(report.errors.some((entry) => entry.path === "pressureSystems.lifeveil"));
  } finally {
    if (inheritedDescriptor) Object.defineProperty(Object.prototype, "lifeveil", inheritedDescriptor);
    else delete Object.prototype.lifeveil;
  }

  const unknown = createPressureEncounter();
  unknown.pressureSystems.extra = {
    pressureSystemId: "extra",
    value: 0,
    capacity: 2
  };
  assert.ok(errorCodes(validateVoyageEncounterState(unknown)).includes("unexpected-pressure-system-key"));

  const unsafeMapKey = createPressureEncounter();
  Object.defineProperty(unsafeMapKey.pressureSystems, "__proto__", {
    configurable: true,
    enumerable: true,
    value: {
      pressureSystemId: "__proto__",
      value: 0,
      capacity: 2
    }
  });
  const unsafeMapKeyReport = validateVoyageEncounterState(unsafeMapKey);
  assert.equal(unsafeMapKeyReport.valid, false);
  assert.ok(errorCodes(unsafeMapKeyReport).includes("unsafe-pressure-system-key"));
  assert.ok(unsafeMapKeyReport.errors.some((entry) => entry.path === "pressureSystems.__proto__"));

  const symbolKeyed = createPressureEncounter();
  symbolKeyed.pressureSystems[Symbol("hidden")] = {
    pressureSystemId: "hidden",
    value: 0,
    capacity: 2
  };
  assert.ok(errorCodes(validateVoyageEncounterState(symbolKeyed)).includes("unexpected-pressure-system-key"));

  const accessor = createPressureEncounter();
  let reads = 0;
  Object.defineProperty(accessor, "pressureSystems", {
    enumerable: true,
    get() {
      reads += 1;
      return canonicalPressureSystems();
    }
  });
  const accessorReport = validateVoyageEncounterState(accessor);
  assert.equal(reads, 0);
  assert.ok(errorCodes(accessorReport).includes("invalid-pressure-systems-data-property"));

  const recordAccessor = createPressureEncounter();
  let nestedReads = 0;
  Object.defineProperty(recordAccessor.pressureSystems["crew-morale"], "value", {
    enumerable: true,
    get() {
      nestedReads += 1;
      return 1;
    }
  });
  const recordAccessorReport = validateVoyageEncounterState(recordAccessor);
  assert.equal(nestedReads, 0);
  assert.ok(errorCodes(recordAccessorReport).includes("invalid-pressure-system-data-property"));

  const proxy = createPressureEncounter();
  proxy.pressureSystems = new Proxy(canonicalPressureSystems(), {
    ownKeys() {
      throw new Error("hostile ownKeys");
    }
  });
  assert.ok(errorCodes(validateVoyageEncounterState(proxy)).includes("pressure-systems-data-read-failed"));

  const sparse = createPressureEncounter();
  sparse.pressureSystems = [];
  sparse.pressureSystems[2] = canonicalPressureRecord("crew-morale");
  assert.ok(errorCodes(validateVoyageEncounterState(sparse)).includes("invalid-pressure-systems"));
});

test("Validation contains hostile pressureSystems container reads safely", () => {
  const prototypeTarget = canonicalPressureSystems();
  const prototypeState = createPressureEncounter();
  prototypeState.pressureSystems = new Proxy(prototypeTarget, {
    getPrototypeOf() {
      throw new Error("hostile prototype");
    }
  });
  const prototypeBefore = structuredClone(prototypeTarget);
  const prototypeReport = validateTwice(prototypeState);
  assert.equal(prototypeReport.valid, false);
  assert.deepEqual(errorCodes(prototypeReport), ["pressure-systems-data-read-failed"]);
  assert.ok(prototypeReport.errors.some((entry) => entry.path === "pressureSystems"));
  assert.deepEqual(prototypeTarget, prototypeBefore);

  const ownKeysTarget = canonicalPressureSystems();
  const ownKeysState = createPressureEncounter();
  ownKeysState.pressureSystems = new Proxy(ownKeysTarget, {
    getPrototypeOf() {
      return Object.prototype;
    },
    ownKeys() {
      throw new Error("hostile ownKeys");
    }
  });
  const ownKeysBefore = structuredClone(ownKeysTarget);
  const ownKeysReport = validateTwice(ownKeysState);
  assert.equal(ownKeysReport.valid, false);
  assert.ok(errorCodes(ownKeysReport).includes("pressure-systems-data-read-failed"));
  assert.deepEqual(ownKeysTarget, ownKeysBefore);

  const descriptorTarget = canonicalPressureSystems();
  const descriptorState = createPressureEncounter();
  descriptorState.pressureSystems = new Proxy(descriptorTarget, {
    getPrototypeOf() {
      return Object.prototype;
    },
    ownKeys() {
      return VOYAGE_PRESSURE_SYSTEM_IDS;
    },
    getOwnPropertyDescriptor(target, key) {
      if (key === "crew-morale") throw new Error("hostile descriptor");
      return Reflect.getOwnPropertyDescriptor(target, key);
    }
  });
  const descriptorBefore = structuredClone(descriptorTarget);
  const descriptorReport = validateTwice(descriptorState);
  assert.equal(descriptorReport.valid, false);
  assert.ok(errorCodes(descriptorReport).includes("pressure-systems-data-read-failed"));
  assert.ok(descriptorReport.errors.some((entry) => entry.path === "pressureSystems.crew-morale"));
  assert.deepEqual(descriptorTarget, descriptorBefore);
});

test("Validation contains hostile Pressure record reads safely", () => {
  const prototypeTarget = canonicalPressureRecord("crew-morale");
  const prototypeState = createPressureEncounter();
  prototypeState.pressureSystems["crew-morale"] = new Proxy(prototypeTarget, {
    getPrototypeOf() {
      throw new Error("hostile prototype");
    }
  });
  const prototypeBefore = structuredClone(prototypeTarget);
  const prototypeReport = validateTwice(prototypeState);
  assert.equal(prototypeReport.valid, false);
  assert.ok(errorCodes(prototypeReport).includes("pressure-system-record-data-read-failed"));
  assert.ok(prototypeReport.errors.some((entry) => entry.path === "pressureSystems.crew-morale"));
  assert.deepEqual(prototypeTarget, prototypeBefore);

  const ownKeysTarget = canonicalPressureRecord("crew-morale");
  const ownKeysState = createPressureEncounter();
  ownKeysState.pressureSystems["crew-morale"] = new Proxy(ownKeysTarget, {
    getPrototypeOf() {
      return Object.prototype;
    },
    ownKeys() {
      throw new Error("hostile ownKeys");
    }
  });
  const ownKeysBefore = structuredClone(ownKeysTarget);
  const ownKeysReport = validateTwice(ownKeysState);
  assert.equal(ownKeysReport.valid, false);
  assert.ok(errorCodes(ownKeysReport).includes("pressure-system-record-data-read-failed"));
  assert.deepEqual(ownKeysTarget, ownKeysBefore);

  const descriptorTarget = canonicalPressureRecord("crew-morale");
  const descriptorState = createPressureEncounter();
  descriptorState.pressureSystems["crew-morale"] = new Proxy(descriptorTarget, {
    getPrototypeOf() {
      return Object.prototype;
    },
    ownKeys() {
      return ["pressureSystemId", "value", "capacity"];
    },
    getOwnPropertyDescriptor(target, key) {
      if (key === "capacity") throw new Error("hostile descriptor");
      return Reflect.getOwnPropertyDescriptor(target, key);
    }
  });
  const descriptorBefore = structuredClone(descriptorTarget);
  const descriptorReport = validateTwice(descriptorState);
  assert.equal(descriptorReport.valid, false);
  assert.ok(errorCodes(descriptorReport).includes("pressure-system-record-data-read-failed"));
  assert.ok(descriptorReport.errors.some((entry) => entry.path === "pressureSystems.crew-morale.capacity"));
  assert.deepEqual(descriptorTarget, descriptorBefore);
});

test("Validation rejects non-enumerable Pressure boundaries without mutating source data", () => {
  const runCase = (mutate, code, path) => {
    const source = {
      encounterId: "pressure-non-enumerable",
      pressureSystems: canonicalPressureSystems()
    };
    const before = structuredClone(source);
    const state = createVoyageEncounterState(source);
    mutate(state);
    let report;
    assert.doesNotThrow(() => {
      report = validateVoyageEncounterState(state);
    });
    assert.equal(report.valid, false);
    assert.ok(errorCodes(report).includes(code));
    assert.ok(report.errors.some((entry) => entry.path === path));
    assert.deepEqual(source, before);
  };

  runCase((state) => {
    Object.defineProperty(state, "pressureSystems", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: state.pressureSystems
    });
  }, "invalid-pressure-systems-data-property", "pressureSystems");

  runCase((state) => {
    Object.defineProperty(state.pressureSystems, "crew-morale", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: state.pressureSystems["crew-morale"]
    });
  }, "invalid-pressure-systems-data-property", "pressureSystems.crew-morale");

  runCase((state) => {
    Object.defineProperty(state.pressureSystems["crew-morale"], "pressureSystemId", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: "crew-morale"
    });
  }, "invalid-pressure-system-data-property", "pressureSystems.crew-morale.pressureSystemId");

  runCase((state) => {
    Object.defineProperty(state.pressureSystems["crew-morale"], "value", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: 0
    });
  }, "invalid-pressure-system-data-property", "pressureSystems.crew-morale.value");

  runCase((state) => {
    Object.defineProperty(state.pressureSystems["crew-morale"], "capacity", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: 2
    });
  }, "invalid-pressure-system-data-property", "pressureSystems.crew-morale.capacity");
});

test("Validation rejects non-finite numeric Pressure values and capacities", () => {
  const runCase = (mutate, code, path) => {
    const state = createPressureEncounter({
      pressureSystems: canonicalPressureSystems()
    });
    mutate(state);
    const report = validateVoyageEncounterState(state);
    assert.equal(report.valid, false);
    assert.ok(errorCodes(report).includes(code));
    assert.ok(report.errors.some((entry) => entry.path === path));
  };

  runCase((state) => {
    state.pressureSystems["crew-morale"].value = NaN;
  }, "invalid-pressure-system-value", "pressureSystems.crew-morale.value");
  runCase((state) => {
    state.pressureSystems["crew-morale"].value = Infinity;
  }, "invalid-pressure-system-value", "pressureSystems.crew-morale.value");
  runCase((state) => {
    state.pressureSystems["crew-morale"].value = -Infinity;
  }, "invalid-pressure-system-value", "pressureSystems.crew-morale.value");

  runCase((state) => {
    state.pressureSystems["crew-morale"].capacity = NaN;
  }, "invalid-pressure-system-capacity", "pressureSystems.crew-morale.capacity");
  runCase((state) => {
    state.pressureSystems["crew-morale"].capacity = Infinity;
  }, "invalid-pressure-system-capacity", "pressureSystems.crew-morale.capacity");
  runCase((state) => {
    state.pressureSystems["crew-morale"].capacity = -Infinity;
  }, "invalid-pressure-system-capacity", "pressureSystems.crew-morale.capacity");
});

test("Validation classifies Pressure record fields precisely and does not execute accessors", () => {
  const unknown = createPressureEncounter();
  unknown.pressureSystems["crew-morale"].extra = true;
  const unknownReport = validateVoyageEncounterState(unknown);
  assert.equal(unknownReport.valid, false);
  assert.ok(errorCodes(unknownReport).includes("unexpected-pressure-system-field"));
  assert.ok(unknownReport.errors.some((entry) => entry.path === "pressureSystems.crew-morale.extra"));

  const unsafe = createPressureEncounter();
  Object.defineProperty(unsafe.pressureSystems["crew-morale"], "__proto__", {
    enumerable: true,
    configurable: true,
    value: { hidden: true }
  });
  const unsafeReport = validateVoyageEncounterState(unsafe);
  assert.equal(unsafeReport.valid, false);
  assert.ok(errorCodes(unsafeReport).includes("unsafe-pressure-system-field"));
  assert.ok(unsafeReport.errors.some((entry) => entry.path === "pressureSystems.crew-morale.__proto__"));

  const symbol = createPressureEncounter();
  const hidden = Symbol("hidden");
  Object.defineProperty(symbol.pressureSystems["crew-morale"], hidden, {
    enumerable: true,
    configurable: true,
    value: true
  });
  const symbolReport = validateVoyageEncounterState(symbol);
  assert.equal(symbolReport.valid, false);
  assert.ok(errorCodes(symbolReport).includes("unexpected-pressure-system-field"));
  assert.ok(symbolReport.errors.some((entry) => entry.path === "pressureSystems.crew-morale.[symbol]"));

  const missing = createPressureEncounter();
  delete missing.pressureSystems["crew-morale"].capacity;
  const missingReport = validateVoyageEncounterState(missing);
  assert.equal(missingReport.valid, false);
  assert.ok(errorCodes(missingReport).includes("missing-pressure-system-field"));
  assert.equal(errorCodes(missingReport).includes("invalid-pressure-system-data-property"), false);
  assert.ok(missingReport.errors.some((entry) => entry.path === "pressureSystems.crew-morale.capacity"));

  const accessor = createPressureEncounter();
  let reads = 0;
  Object.defineProperty(accessor.pressureSystems["crew-morale"], "capacity", {
    enumerable: true,
    configurable: true,
    get() {
      reads += 1;
      return 2;
    }
  });
  const accessorReport = validateVoyageEncounterState(accessor);
  assert.equal(reads, 0);
  assert.equal(accessorReport.valid, false);
  assert.ok(errorCodes(accessorReport).includes("invalid-pressure-system-data-property"));
  assert.ok(accessorReport.errors.some((entry) => entry.path === "pressureSystems.crew-morale.capacity"));
});

test("Validation rejects mismatched IDs and invalid numeric Pressure records", () => {
  const cases = [
    {
      mutate(state) {
        state.pressureSystems["crew-morale"].pressureSystemId = "arkengine";
      },
      code: "pressure-system-id-mismatch"
    },
    {
      mutate(state) {
        state.pressureSystems["crew-morale"].pressureSystemId = 12;
      },
      code: "invalid-pressure-system-id"
    },
    {
      mutate(state) {
        state.pressureSystems["crew-morale"].value = "1";
      },
      code: "invalid-pressure-system-value"
    },
    {
      mutate(state) {
        state.pressureSystems["crew-morale"].value = -1;
      },
      code: "invalid-pressure-system-value"
    },
    {
      mutate(state) {
        state.pressureSystems["crew-morale"].value = 1.5;
      },
      code: "invalid-pressure-system-value"
    },
    {
      mutate(state) {
        state.pressureSystems["crew-morale"].value = Number.MAX_SAFE_INTEGER + 1;
      },
      code: "invalid-pressure-system-value"
    },
    {
      mutate(state) {
        state.pressureSystems["crew-morale"].capacity = "2";
      },
      code: "invalid-pressure-system-capacity"
    },
    {
      mutate(state) {
        state.pressureSystems["crew-morale"].capacity = -1;
      },
      code: "invalid-pressure-system-capacity"
    },
    {
      mutate(state) {
        state.pressureSystems["crew-morale"].capacity = 1.5;
      },
      code: "invalid-pressure-system-capacity"
    },
    {
      mutate(state) {
        state.pressureSystems["crew-morale"].capacity = Number.MAX_SAFE_INTEGER + 1;
      },
      code: "invalid-pressure-system-capacity"
    },
    {
      mutate(state) {
        state.pressureSystems["crew-morale"].capacity = 6;
      },
      code: "pressure-system-capacity-too-high"
    },
    {
      mutate(state) {
        state.pressureSystems["crew-morale"].capacity = 1;
        state.pressureSystems["crew-morale"].value = 2;
      },
      code: "pressure-system-value-exceeds-capacity"
    },
    {
      mutate(state) {
        delete state.pressureSystems["crew-morale"].capacity;
      },
      code: "missing-pressure-system-field"
    }
  ];

  for (const { mutate, code } of cases) {
    const state = createPressureEncounter({
      pressureSystems: canonicalPressureSystems()
    });
    mutate(state);
    const report = validateVoyageEncounterState(state);

    assert.equal(report.valid, false);
    assert.ok(errorCodes(report).includes(code), code);
  }
});

test("Validation diagnostics remain deterministic for repeated Pressure evaluation", () => {
  const state = createPressureEncounter({
    pressureSystems: canonicalPressureSystems()
  });
  state.pressureSystems.extra = {
    pressureSystemId: "extra",
    value: 0,
    capacity: 2
  };
  state.pressureSystems["crew-morale"].capacity = 1;
  state.pressureSystems["crew-morale"].value = 2;

  const first = validateVoyageEncounterState(state);
  const second = validateVoyageEncounterState(state);

  assert.deepEqual(first, second);
  assert.deepEqual(state.pressureSystems["crew-morale"], {
    pressureSystemId: "crew-morale",
    value: 2,
    capacity: 1
  });
});
