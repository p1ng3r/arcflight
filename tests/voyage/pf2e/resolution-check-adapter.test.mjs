import assert from "node:assert/strict";
import test from "node:test";
import {
  preflightVoyagePf2ePendingCheck,
  validateVoyagePf2eAdapterDependencies
} from "../../../scripts/voyage/pf2e/resolution-check-adapter.js";
import {
  resolveVoyagePf2ePendingCheckContext
} from "../../../scripts/voyage/pf2e/resolution-check-context.js";

function check(overrides = {}) {
  return {
    pendingCheckId: "check-1",
    sequence: 0,
    status: "pending",
    mode: "check",
    source: { kind: "character", uuid: "Actor.abc123" },
    approachId: "athletics-approach",
    statisticSlugOrAbilityId: "athletics",
    finalDc: 20,
    momentumRollBonus: 0,
    secrecy: "public",
    ...overrides
  };
}

function dependencies(overrides = {}) {
  const actor = { mutable: true };
  return {
    resolveUuid: async () => ({ actor }),
    getActorFromResolvedDocument: (document) => document.actor,
    getStatistic: (_actor, slug) => slug === "athletics"
      ? { slug, mutable: true }
      : null,
    ...overrides
  };
}

const preflight = (overrides, dependencyOverrides) => (
  preflightVoyagePf2ePendingCheck(
    check(overrides),
    dependencies(dependencyOverrides)
  )
);
const code = (result) => result.errors[0]?.code;

test("successful exact character statistic and final-DC preflight", async () => {
  assert.deepEqual(await preflight(), {
    ok: true,
    status: "ready",
    pendingCheckId: "check-1",
    sequence: 0,
    sourceKind: "character",
    sourceUuid: "Actor.abc123",
    statisticSlug: "athletics",
    dc: 20,
    rollMode: "public",
    errors: [],
    warnings: []
  });
});

test("internal context propagates exactly one actor statistic, locked Momentum, and final DC", async () => {
  const actor = {};
  const statistic = { slug: "athletics" };
  const resolved = await resolveVoyagePf2ePendingCheckContext(check(), dependencies({
    resolveUuid: async () => ({ actor }),
    getActorFromResolvedDocument: (document) => document.actor,
    getStatistic: () => statistic
  }));
  assert.deepEqual(Object.keys(resolved.context), ["actor", "statistic", "dc", "momentumRollBonus"]);
  assert.equal(resolved.context.actor, actor);
  assert.equal(resolved.context.statistic, statistic);
  assert.equal(resolved.context.dc, 20);
  assert.equal(resolved.context.momentumRollBonus, 0);
  assert.notEqual(resolved.context, check());
});

test("Actor and TokenDocument-like authoritative sources resolve", async () => {
  const actor = {};
  assert.equal((await preflight({}, {
    resolveUuid: async () => actor,
    getActorFromResolvedDocument: (document) => document,
    getStatistic: () => ({ slug: "athletics" })
  })).ok, true);
  assert.equal((await preflight({}, {
    resolveUuid: async () => ({ actor }),
    getActorFromResolvedDocument: (document) => document.actor,
    getStatistic: () => ({ slug: "athletics" })
  })).ok, true);
});

test("missing and inherited source UUIDs are rejected", async () => {
  assert.equal(code(await preflight({ source: { kind: "character" } })), "voyage-pf2e-missing-source-uuid");
  const source = Object.create({ uuid: "Actor.inherited" });
  source.kind = "character";
  assert.equal(code(await preflight({ source })), "voyage-pf2e-invalid-request");
});

test("source accessors are rejected without invocation", async () => {
  for (const field of ["kind", "uuid"]) {
    let reads = 0;
    const source = {
      kind: "character",
      uuid: "Actor.hostile"
    };
    Object.defineProperty(source, field, {
      enumerable: true,
      get() {
        reads += 1;
        return field === "kind" ? "character" : "Actor.hostile";
      }
    });
    assert.equal(code(await preflight({ source })), "voyage-pf2e-invalid-request");
    assert.equal(reads, 0);
  }
});

test("source resolver and actor extraction each run once", async () => {
  let resolverCalls = 0;
  let actorCalls = 0;
  await preflight({}, {
    resolveUuid: async () => {
      resolverCalls += 1;
      return { actor: {} };
    },
    getActorFromResolvedDocument(document) {
      actorCalls += 1;
      return document.actor;
    }
  });
  assert.equal(resolverCalls, 1);
  assert.equal(actorCalls, 1);
});

test("source resolver and actor extraction failures are contained", async () => {
  assert.equal(code(await preflight({}, {
    resolveUuid: async () => {
      throw new Error("resolver");
    }
  })), "voyage-pf2e-source-resolution-failed");
  assert.equal(code(await preflight({}, {
    getActorFromResolvedDocument: () => {
      throw new Error("actor");
    }
  })), "voyage-pf2e-source-resolution-failed");
  assert.equal(code(await preflight({}, {
    resolveUuid: async () => ({})
  })), "voyage-pf2e-actor-unresolved");
});

test("unsupported source kind is rejected before dependencies run", async () => {
  let calls = 0;
  const result = await preflightVoyagePf2ePendingCheck(
    check({ source: { kind: "ship", uuid: "Actor.ship" } }),
    {
      resolveUuid: async () => { calls += 1; },
      getActorFromResolvedDocument: () => { calls += 1; },
      getStatistic: () => { calls += 1; }
    }
  );
  assert.equal(code(result), "voyage-pf2e-unsupported-source-kind");
  assert.equal(calls, 0);
});

test("exact selected statistic is looked up exactly once", async () => {
  const calls = [];
  const result = await preflight({}, {
    getStatistic: (_actor, slug) => {
      calls.push(slug);
      return { slug };
    }
  });
  assert.equal(result.statisticSlug, "athletics");
  assert.deepEqual(calls, ["athletics"]);
});

test("unresolved selected statistic has no fallback lookup", async () => {
  const calls = [];
  const result = await preflight(
    { statisticSlugOrAbilityId: "missing-statistic" },
    {
      getStatistic: (_actor, slug) => {
        calls.push(slug);
        return slug === "perception" ? { slug } : null;
      }
    }
  );
  assert.equal(code(result), "voyage-pf2e-statistic-unresolved");
  assert.deepEqual(calls, ["missing-statistic"]);
});

for (const [name, selected, available] of [
  ["whitespace variants", " athletics ", "athletics"],
  ["case variants", "Athletics", "athletics"],
  ["aliases", "acro", "acrobatics"],
  ["Perception fallback", "missing", "perception"]
]) {
  test(`${name} are not substituted`, async () => {
    const calls = [];
    const result = await preflight(
      { statisticSlugOrAbilityId: selected },
      {
        getStatistic: (_actor, slug) => {
          calls.push(slug);
          return slug === available ? { slug } : null;
        }
      }
    );
    assert.equal(code(result), "voyage-pf2e-statistic-unresolved");
    assert.deepEqual(calls, [selected]);
  });
}

test("statistic lookup exceptions are contained after one attempt", async () => {
  let calls = 0;
  const result = await preflight({}, {
    getStatistic() {
      calls += 1;
      throw new Error("lookup");
    }
  });
  assert.equal(code(result), "voyage-pf2e-statistic-resolution-failed");
  assert.equal(calls, 1);
});

test("contradictory resolved statistic identity is rejected", async () => {
  const result = await preflight({}, {
    getStatistic: () => ({ slug: "perception" })
  });
  assert.equal(code(result), "voyage-pf2e-statistic-identity-mismatch");
});

test("hostile resolved statistic identity is contained", async () => {
  const statistic = {};
  Object.defineProperty(statistic, "slug", {
    get() {
      throw new Error("slug");
    }
  });
  assert.equal(code(await preflight({}, {
    getStatistic: () => statistic
  })), "voyage-pf2e-statistic-resolution-failed");
});

test("non-object statistic results are rejected as unresolved", async () => {
  for (const statistic of [true, 1, "athletics", Symbol("athletics")]) {
    assert.equal(code(await preflight({}, {
      getStatistic: () => statistic
    })), "voyage-pf2e-statistic-unresolved");
  }
});

test("finalDc is the sole numeric DC authority", async () => {
  assert.equal((await preflight({ finalDc: 0 })).dc, 0);
  assert.equal((await preflight({ finalDc: 28 })).dc, 28);
});

test("PF2e context carries the locked Momentum value without changing finalDc", async () => {
  const resolved = await resolveVoyagePf2ePendingCheckContext(
    check({ finalDc: 28, momentumRollBonus: 3 }),
    dependencies()
  );
  assert.equal(resolved.result.dc, 28);
  assert.equal(resolved.context.dc, 28);
  assert.equal(resolved.context.momentumRollBonus, 3);
});

for (const value of [null, -1, 1.5, 4, Number.NaN, Number.POSITIVE_INFINITY, "2", true, {}, []]) {
  test(`malformed PF2e Momentum value ${String(value)} is rejected`, async () => {
    const result = await preflight({ momentumRollBonus: value });
    assert.equal(code(result), "voyage-pf2e-invalid-momentum-roll-bonus");
  });
}

test("missing PF2e Momentum lock is rejected", async () => {
  const value = check();
  delete value.momentumRollBonus;
  assert.equal(code(await preflightVoyagePf2ePendingCheck(value, dependencies())), "voyage-pf2e-invalid-request");
});

for (const [name, finalDc] of [
  ["negative", -1],
  ["fractional", 1.5],
  ["unsafe", Number.MAX_SAFE_INTEGER + 1],
  ["non-numeric", "20"],
  ["NaN", Number.NaN],
  ["positive infinity", Number.POSITIVE_INFINITY],
  ["negative infinity", Number.NEGATIVE_INFINITY],
  ["boxed number", new Number(20)]
]) {
  test(`${name} finalDc is rejected`, async () => {
    assert.equal(code(await preflight({ finalDc })), "voyage-pf2e-invalid-final-dc");
  });
}

test("public and secret secrecy map to current PF2e modes", async () => {
  assert.equal((await preflight({ secrecy: "public" })).rollMode, "public");
  assert.equal((await preflight({ secrecy: "secret" })).rollMode, "blind");
  assert.equal(code(await preflight({ secrecy: "gm" })), "voyage-pf2e-invalid-secrecy");
});

test("non-pending and no-roll records are blocked before lookup", async () => {
  let calls = 0;
  const deps = dependencies({
    getStatistic() {
      calls += 1;
      return {};
    }
  });
  assert.equal(code(await preflightVoyagePf2ePendingCheck(check({ status: "resolved" }), deps)), "voyage-pf2e-check-not-pending");
  assert.equal(code(await preflightVoyagePf2ePendingCheck(check({ mode: "no-roll" }), deps)), "voyage-pf2e-invalid-check-mode");
  assert.equal(calls, 0);
});

test("missing dependency functions are rejected", async () => {
  assert.equal(code(await preflightVoyagePf2ePendingCheck(check(), {})), "voyage-pf2e-invalid-dependencies");
  assert.equal(validateVoyagePf2eAdapterDependencies({}).valid, false);
});

test("inherited and non-function dependencies are rejected", () => {
  assert.equal(validateVoyagePf2eAdapterDependencies(Object.create(dependencies())).valid, false);
  assert.equal(validateVoyagePf2eAdapterDependencies({
    resolveUuid: true,
    getActorFromResolvedDocument: {},
    getStatistic: "athletics"
  }).valid, false);
});

test("dependency accessors are each read exactly once", async () => {
  const values = dependencies();
  const reads = {
    resolveUuid: 0,
    getActorFromResolvedDocument: 0,
    getStatistic: 0
  };
  const hostile = {};
  for (const key of Object.keys(reads)) {
    Object.defineProperty(hostile, key, {
      enumerable: true,
      get() {
        reads[key] += 1;
        if (reads[key] > 1) throw new Error("second read");
        return values[key];
      }
    });
  }
  assert.equal((await preflightVoyagePf2ePendingCheck(check(), hostile)).ok, true);
  assert.deepEqual(reads, {
    resolveUuid: 1,
    getActorFromResolvedDocument: 1,
    getStatistic: 1
  });
});

test("throwing dependency accessors are contained", () => {
  const hostile = dependencies();
  Object.defineProperty(hostile, "getStatistic", {
    get() {
      throw new Error("dependency");
    }
  });
  assert.doesNotThrow(() => validateVoyagePf2eAdapterDependencies(hostile));
  assert.equal(validateVoyagePf2eAdapterDependencies(hostile).valid, false);
});

test("dependency functions and live runtime objects do not leak", async () => {
  const actor = { privateActor: true };
  const statistic = { privateStatistic: true };
  const result = await preflight({}, {
    resolveUuid: async () => ({ actor }),
    getActorFromResolvedDocument: (document) => document.actor,
    getStatistic: () => statistic
  });
  assert.equal(JSON.stringify(result).includes("resolveUuid"), false);
  assert.equal(JSON.stringify(result).includes("privateActor"), false);
  assert.equal(JSON.stringify(result).includes("privateStatistic"), false);
});

test("result mutation and dependency objects cannot mutate pending input", async () => {
  const value = check();
  const before = structuredClone(value);
  const result = await preflightVoyagePf2ePendingCheck(value, dependencies());
  result.pendingCheckId = "changed";
  assert.deepEqual(value, before);
});

test("canonical pending accessors are rejected without invocation", async () => {
  for (const field of [
    "pendingCheckId",
    "sequence",
    "status",
    "mode",
    "source",
    "approachId",
    "statisticSlugOrAbilityId",
    "finalDc",
    "momentumRollBonus",
    "secrecy"
  ]) {
    let reads = 0;
    const value = check();
    Object.defineProperty(value, field, {
      enumerable: true,
      get() {
        reads += 1;
        return check()[field];
      }
    });
    assert.equal(code(await preflightVoyagePf2ePendingCheck(value, dependencies())), "voyage-pf2e-invalid-request");
    assert.equal(reads, 0);
  }
});

test("inherited canonical fields do not satisfy the request", async () => {
  const value = check();
  delete value.mode;
  Object.setPrototypeOf(value, { mode: "check" });
  assert.equal(code(await preflightVoyagePf2ePendingCheck(value, dependencies())), "voyage-pf2e-invalid-request");
});

test("exact identity fields reject blank unsafe and boxed values before runtime calls", async () => {
  let calls = 0;
  const deps = dependencies({
    resolveUuid: async () => {
      calls += 1;
      return {};
    }
  });
  for (const [field, invalid, expected] of [
    ["pendingCheckId", " ", "voyage-pf2e-invalid-pending-check-id"],
    ["pendingCheckId", new String("check-1"), "voyage-pf2e-invalid-pending-check-id"],
    ["approachId", "__proto__", "voyage-pf2e-invalid-approach-id"],
    ["approachId", new String("athletics-approach"), "voyage-pf2e-invalid-approach-id"],
    ["statisticSlugOrAbilityId", " ", "voyage-pf2e-invalid-statistic-id"],
    ["statisticSlugOrAbilityId", "constructor", "voyage-pf2e-invalid-statistic-id"]
  ]) {
    assert.equal(code(await preflightVoyagePf2ePendingCheck(check({ [field]: invalid }), deps)), expected);
  }
  assert.equal(calls, 0);
});

test("non-plain pending and source objects are rejected", async () => {
  assert.equal(code(await preflightVoyagePf2ePendingCheck(new Date(), dependencies())), "voyage-pf2e-invalid-request");
  assert.equal(code(await preflight({ source: new String("Actor.hostile") })), "voyage-pf2e-invalid-request");
});

test("source prototype-like data keys do not pollute prototypes", async () => {
  const source = {
    kind: "character",
    uuid: "Actor.abc123"
  };
  Object.defineProperty(source, "__proto__", {
    enumerable: true,
    value: { polluted: true }
  });
  assert.equal((await preflight({ source })).ok, true);
  assert.equal(Object.prototype.polluted, undefined);
});

test("symbol-bearing and unsafe-key requests fail safely", async () => {
  const symbol = check();
  symbol[Symbol("hostile")] = true;
  assert.equal(code(await preflightVoyagePf2ePendingCheck(symbol, dependencies())), "voyage-pf2e-invalid-request");

  const unsafe = check();
  Object.defineProperty(unsafe, "constructor", {
    enumerable: true,
    value: "hostile"
  });
  assert.equal(code(await preflightVoyagePf2ePendingCheck(unsafe, dependencies())), "voyage-pf2e-invalid-request");
});

for (const unsafeId of ["__proto__", "constructor", "prototype"]) {
  test(`pending-check ID ${unsafeId} is rejected`, async () => {
    const result = await preflight({ pendingCheckId: unsafeId });
    assert.equal(code(result), "voyage-pf2e-invalid-pending-check-id");
    assert.equal(Object.hasOwn(result, "pendingCheckId"), false);
  });
}

test("hostile pending and source Proxies do not escape", async () => {
  const pendingProxy = new Proxy(check(), {
    getOwnPropertyDescriptor() {
      throw new Error("descriptor");
    }
  });
  assert.equal(code(await preflightVoyagePf2ePendingCheck(pendingProxy, dependencies())), "voyage-pf2e-invalid-request");

  const source = new Proxy({}, {
    getPrototypeOf() {
      throw new Error("prototype");
    }
  });
  assert.equal(code(await preflight({ source })), "voyage-pf2e-invalid-request");
});

test("hostile dependency objects remain controlled", () => {
  const proxy = new Proxy({}, {
    getOwnPropertyDescriptor() {
      throw new Error("ownness");
    }
  });
  assert.doesNotThrow(() => validateVoyagePf2eAdapterDependencies(proxy));
  assert.equal(validateVoyagePf2eAdapterDependencies(proxy).valid, false);
});

test("preflight never requests roll or chat dependencies", async () => {
  let forbidden = 0;
  const result = await preflight({}, {
    roll: () => { forbidden += 1; },
    createChatMessage: () => { forbidden += 1; }
  });
  assert.equal(result.ok, true);
  assert.equal(forbidden, 0);
});
