import assert from "node:assert/strict";
import test from "node:test";
import { preflightVoyagePf2ePendingCheck, validateVoyagePf2eAdapterDependencies } from "../../../scripts/voyage/pf2e/resolution-check-adapter.js";

function check(overrides = {}) {
  return { pendingCheckId: "check-1", sequence: 0, status: "pending", source: { kind: "character", uuid: "Actor.abc123" }, statisticOptions: ["athletics", "acrobatics"], dcSource: { kind: "fixed", value: 20 }, secrecy: "public", ...overrides };
}
function dependencies(overrides = {}) {
  const actor = { mutable: true };
  return { resolveUuid: async () => ({ actor }), getActorFromResolvedDocument: (document) => document.actor, getStatistic: (_actor, slug) => slug === "athletics" ? { slug, mutable: true } : null, ...overrides };
}
async function preflight(overrides, dependencyOverrides) { return preflightVoyagePf2ePendingCheck(check(overrides), dependencies(dependencyOverrides)); }
function code(result) { return result.errors[0]?.code; }

test("successful character UUID resolution", async () => { const result = await preflight(); assert.deepEqual(result, { ok: true, status: "ready", pendingCheckId: "check-1", sequence: 0, sourceKind: "character", sourceUuid: "Actor.abc123", statisticSlug: "athletics", dc: 20, rollMode: "publicroll", errors: [], warnings: [] }); });
test("Actor document source", async () => { const actor = {}; const result = await preflight({}, { resolveUuid: async () => actor, getActorFromResolvedDocument: (document) => document }); assert.equal(result.ok, true); });
test("Token-like document actor extraction", async () => { const actor = {}; const result = await preflight({}, { resolveUuid: async () => ({ actor }), getActorFromResolvedDocument: (document) => document.actor }); assert.equal(result.ok, true); });
test("missing UUID", async () => { const source = { kind: "character" }; assert.equal(code(await preflight({ source })), "voyage-pf2e-missing-source-uuid"); });
test("inherited UUID ignored", async () => { const previous = Object.getOwnPropertyDescriptor(Object.prototype, "uuid"); Object.defineProperty(Object.prototype, "uuid", { configurable: true, value: "Actor.inherited" }); try { const source = { kind: "character" }; assert.equal(code(await preflight({ source })), "voyage-pf2e-missing-source-uuid"); } finally { if (previous) Object.defineProperty(Object.prototype, "uuid", previous); else delete Object.prototype.uuid; } });
test("UUID getter read at most once", async () => { let reads = 0; const source = { kind: "character" }; Object.defineProperty(source, "uuid", { enumerable: true, get() { reads += 1; return "Actor.abc"; } }); await preflight({ source }); assert.equal(reads, 1); });
test("resolver called once", async () => { let calls = 0; await preflight({}, { resolveUuid: async () => { calls += 1; return { actor: {} }; } }); assert.equal(calls, 1); });
test("resolver exception converted to error", async () => { assert.equal(code(await preflight({}, { resolveUuid: async () => { throw new Error("no"); } })), "voyage-pf2e-source-resolution-failed"); });
test("resolved document missing Actor", async () => { assert.equal(code(await preflight({}, { resolveUuid: async () => ({}) })), "voyage-pf2e-actor-unresolved"); });
test("statistic fallback order", async () => { const calls = []; const result = await preflight({}, { getStatistic: (_actor, slug) => { calls.push(slug); return slug === "acrobatics" ? {} : null; } }); assert.deepEqual(calls, ["athletics", "acrobatics"]); assert.equal(result.statisticSlug, "acrobatics"); });
test("first statistic succeeds", async () => { const calls = []; const result = await preflight({}, { getStatistic: (_actor, slug) => { calls.push(slug); return {}; } }); assert.deepEqual(calls, ["athletics"]); assert.equal(result.statisticSlug, "athletics"); });
test("first fails and second succeeds", async () => { const result = await preflight({}, { getStatistic: (_actor, slug) => slug === "acrobatics" ? {} : null }); assert.equal(result.statisticSlug, "acrobatics"); });
test("every statistic missing", async () => { assert.equal(code(await preflight({}, { getStatistic: () => null })), "voyage-pf2e-statistic-unresolved"); });
test("statistic resolver exception converted to error", async () => { assert.equal(code(await preflight({}, { getStatistic: () => { throw new Error("no"); } })), "voyage-pf2e-statistic-resolution-failed"); });
test("statistic getter called once per attempted slug", async () => { let reads = 0; const options = ["athletics", "acrobatics"]; Object.defineProperty(options, 0, { enumerable: true, get() { reads += 1; return "athletics"; } }); await preflight({ statisticOptions: options }, { getStatistic: () => null }); assert.equal(reads, 1); });
test("sparse statistic option arrays", async () => { const options = []; options[2] = "acrobatics"; const result = await preflight({ statisticOptions: options }, { getStatistic: (_a, slug) => slug === "acrobatics" ? {} : null }); assert.equal(result.statisticSlug, "acrobatics"); });
test("inherited statistic options ignored", async () => { const options = ["athletics"]; const prototype = ["inherited"]; Object.setPrototypeOf(options, prototype); try { const result = await preflight({ statisticOptions: options }); assert.equal(result.ok, true); } finally { Object.setPrototypeOf(options, Array.prototype); } });
test("throwing inherited numeric getter never executed", async () => { const options = ["athletics"]; const prototype = Object.create(Array.prototype); Object.defineProperty(prototype, 1, { get() { throw new Error("bad"); } }); Object.setPrototypeOf(options, prototype); try { assert.equal((await preflight({ statisticOptions: options })).ok, true); } finally { Object.setPrototypeOf(options, Array.prototype); } });
test("fixed DC success", async () => { assert.equal((await preflight({ dcSource: { kind: "fixed", value: 0 } })).dc, 0); });
test("negative fixed DC rejected", async () => { assert.equal(code(await preflight({ dcSource: { kind: "fixed", value: -1 } })), "voyage-pf2e-invalid-fixed-dc"); });
test("fractional fixed DC rejected", async () => { assert.equal(code(await preflight({ dcSource: { kind: "fixed", value: 1.5 } })), "voyage-pf2e-invalid-fixed-dc"); });
test("unsafe integer fixed DC rejected", async () => { assert.equal(code(await preflight({ dcSource: { kind: "fixed", value: Number.MAX_SAFE_INTEGER + 1 } })), "voyage-pf2e-invalid-fixed-dc"); });
test("unsupported DC kinds", async () => { assert.equal(code(await preflight({ dcSource: { kind: "stage" } })), "voyage-pf2e-unsupported-dc-source"); });
test("unsupported source kinds", async () => { assert.equal(code(await preflight({ source: { kind: "ship", uuid: "Actor.x" } })), "voyage-pf2e-unsupported-source-kind"); });
test("public secrecy mapping", async () => { assert.equal((await preflight({ secrecy: "public" })).rollMode, "publicroll"); });
test("secret secrecy mapping", async () => { assert.equal((await preflight({ secrecy: "secret" })).rollMode, "blindroll"); });
test("invalid secrecy", async () => { assert.equal(code(await preflight({ secrecy: "gm" })), "voyage-pf2e-invalid-secrecy"); });
test("non-pending record blocked", async () => { assert.equal(code(await preflight({ status: "resolved" })), "voyage-pf2e-check-not-pending"); });
test("missing dependency functions", async () => { const result = await preflightVoyagePf2ePendingCheck(check(), {}); assert.equal(code(result), "voyage-pf2e-invalid-dependencies"); assert.equal(validateVoyagePf2eAdapterDependencies({}).valid, false); });
test("dependency functions are not included in result", async () => { const result = await preflight(); assert.equal(JSON.stringify(result).includes("resolveUuid"), false); });
test("live Actor and Statistic doubles are not included in result", async () => { const actor = { secret: "actor" }, statistic = { secret: "stat" }; const result = await preflight({}, { resolveUuid: async () => ({ actor }), getActorFromResolvedDocument: (d) => d.actor, getStatistic: () => statistic }); assert.equal(JSON.stringify(result).includes("secret"), false); });
test("result mutation cannot mutate input", async () => { const value = check(); const result = await preflightVoyagePf2ePendingCheck(value, dependencies()); result.pendingCheckId = "changed"; assert.equal(value.pendingCheckId, "check-1"); });
test("input remains byte-for-byte equivalent in plain-data shape", async () => { const value = check(); const before = JSON.stringify(value); await preflightVoyagePf2ePendingCheck(value, dependencies()); assert.equal(JSON.stringify(value), before); });
test("dependency-returned mutable objects do not leak into result", async () => { const actor = { nested: {} }, statistic = { nested: {} }; const result = await preflight({}, { resolveUuid: async () => ({ actor }), getActorFromResolvedDocument: (d) => d.actor, getStatistic: () => statistic }); assert.equal(Object.values(result).includes(actor), false); assert.equal(Object.values(result).includes(statistic), false); });
test("first-read getter failures become structured errors", async () => { const value = check(); Object.defineProperty(value, "status", { enumerable: true, get() { throw new Error("bad"); } }); assert.equal(code(await preflightVoyagePf2ePendingCheck(value, dependencies())), "voyage-pf2e-invalid-request"); });
test("second-read-throwing getters succeed because fields are captured once", async () => { let reads = 0; const value = check(); Object.defineProperty(value, "status", { enumerable: true, get() { reads += 1; if (reads > 1) throw new Error("again"); return "pending"; } }); assert.equal((await preflightVoyagePf2ePendingCheck(value, dependencies())).ok, true); assert.equal(reads, 1); });
test("prototype-sensitive keys do not pollute Object.prototype", async () => { const value = check({ source: { kind: "character", uuid: "Actor.x", __proto__: { polluted: true } } }); await preflightVoyagePf2ePendingCheck(value, dependencies()); assert.equal({}.polluted, undefined); });
test("no chat creation dependency is requested or called", async () => { let calls = 0; const result = await preflight({}, { createChatMessage: () => { calls += 1; } }); assert.equal(result.ok, true); assert.equal(calls, 0); });
test("no roll dependency is requested or called", async () => { let calls = 0; const result = await preflight({}, { roll: () => { calls += 1; } }); assert.equal(result.ok, true); assert.equal(calls, 0); });
