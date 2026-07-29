import assert from "node:assert/strict";
import test from "node:test";
import {
  createVoyagePf2eRuntimeDependencies,
  preflightVoyagePf2ePendingCheckInFoundry
} from "../../../scripts/voyage/pf2e/runtime-preflight.js";

const check = (overrides = {}) => ({
  pendingCheckId: "runtime-check-1", sequence: 4, status: "pending", mode: "check",
  source: { kind: "character", uuid: "Actor.runtime" }, approachId: "athletics-approach",
  statisticSlugOrAbilityId: "athletics", finalDc: 20, secrecy: "public", ...overrides
});

function runtime({ document = { documentName: "Actor", getStatistic: () => ({}) }, fromUuid } = {}) {
  return { game: { system: { id: "pf2e" } }, fromUuid: fromUuid ?? (async () => document) };
}

const errorCode = (result) => result.errors[0]?.code;

test("valid PF2e runtime preflights a public fixed-DC check without mutation", async () => {
  const value = check(); const before = JSON.stringify(value);
  const result = await preflightVoyagePf2ePendingCheckInFoundry(value, runtime());
  assert.deepEqual(result, { ok: true, status: "ready", pendingCheckId: "runtime-check-1", sequence: 4, sourceKind: "character", sourceUuid: "Actor.runtime", statisticSlug: "athletics", dc: 20, rollMode: "public", errors: [], warnings: [] });
  assert.equal(JSON.stringify(value), before);
});

test("runtime validation blocks missing runtime, game, game system, and wrong system ID", async () => {
  assert.equal(errorCode(await preflightVoyagePf2ePendingCheckInFoundry(check(), undefined)), "voyage-pf2e-runtime-unavailable");
  assert.equal(errorCode(await preflightVoyagePf2ePendingCheckInFoundry(check(), {})), "voyage-pf2e-runtime-unavailable");
  assert.equal(errorCode(await preflightVoyagePf2ePendingCheckInFoundry(check(), { game: {} })), "voyage-pf2e-runtime-unavailable");
  assert.equal(errorCode(await preflightVoyagePf2ePendingCheckInFoundry(check(), { game: { system: { id: "dnd5e" } } })), "voyage-pf2e-system-mismatch");
});

test("exact pf2e ID is accepted while missing or non-function UUID resolvers block", async () => {
  assert.equal((await preflightVoyagePf2ePendingCheckInFoundry(check(), runtime())).ok, true);
  assert.equal(errorCode(await preflightVoyagePf2ePendingCheckInFoundry(check(), { game: { system: { id: "pf2e" } } })), "voyage-pf2e-uuid-resolver-unavailable");
  assert.equal(errorCode(await preflightVoyagePf2ePendingCheckInFoundry(check(), { game: { system: { id: "pf2e" } }, fromUuid: true })), "voyage-pf2e-uuid-resolver-unavailable");
});

test("hostile runtime getters become controlled runtime failures", async () => {
  for (const value of [
    Object.defineProperty({}, "game", { get() { throw new Error("game"); } }),
    { game: Object.defineProperty({}, "system", { get() { throw new Error("system"); } }) },
    { game: { system: Object.defineProperty({}, "id", { get() { throw new Error("id"); } }) } },
    { game: { system: { id: "pf2e" } }, get fromUuid() { throw new Error("uuid"); } }
  ]) assert.equal((await preflightVoyagePf2ePendingCheckInFoundry(check(), value)).ok, false);
  assert.equal(errorCode(await preflightVoyagePf2ePendingCheckInFoundry(check(), { game: { system: { id: "pf2e" } }, get fromUuid() { throw new Error("uuid"); } })), "voyage-pf2e-uuid-resolver-unavailable");
});

test("runtime validation failure does not resolve UUIDs or look up statistics", async () => {
  let uuidCalls = 0; let statisticCalls = 0;
  const actor = { getStatistic() { statisticCalls += 1; return {}; } };
  const result = await preflightVoyagePf2ePendingCheckInFoundry(check(), { game: { system: { id: "other" } }, fromUuid() { uuidCalls += 1; return actor; } });
  assert.equal(errorCode(result), "voyage-pf2e-system-mismatch"); assert.equal(uuidCalls, 0); assert.equal(statisticCalls, 0);
});

test("dependency factory has exactly three lazy own functions and resolver preserves receiver, UUID, and async result", async () => {
  let calls = 0; let receiver; let value;
  const runtimeDouble = runtime({ fromUuid: async function (uuid) { calls += 1; receiver = this; value = uuid; return { resolved: true }; } });
  const dependencies = createVoyagePf2eRuntimeDependencies(runtimeDouble);
  assert.deepEqual(Object.keys(dependencies), ["resolveUuid", "getActorFromResolvedDocument", "getStatistic"]);
  assert.equal(calls, 0); assert.deepEqual(await dependencies.resolveUuid("Actor.Exact"), { resolved: true });
  assert.equal(calls, 1); assert.equal(receiver, runtimeDouble); assert.equal(value, "Actor.Exact");
});

test("actor extraction supports Actor and TokenDocument-like documents and controls hostile getters", () => {
  const dependencies = createVoyagePf2eRuntimeDependencies(runtime()); const actor = { marker: "actor" };
  const actorDocument = { documentName: "Actor" };
  assert.equal(dependencies.getActorFromResolvedDocument(actorDocument), actorDocument);
  assert.equal(dependencies.getActorFromResolvedDocument({ actor }), actor);
  assert.equal(dependencies.getActorFromResolvedDocument({}), null); assert.equal(dependencies.getActorFromResolvedDocument(1), null);
  assert.throws(() => dependencies.getActorFromResolvedDocument(Object.defineProperty({}, "documentName", { get() { throw new Error("name"); } })));
  assert.throws(() => dependencies.getActorFromResolvedDocument(Object.defineProperty({}, "actor", { get() { throw new Error("actor"); } })));
});

test("hostile document actor getter becomes adapter source-resolution failure and runtime values do not leak", async () => {
  const document = Object.defineProperty({}, "actor", { get() { throw new Error("actor"); } });
  const result = await preflightVoyagePf2ePendingCheckInFoundry(check(), runtime({ document }));
  assert.equal(errorCode(result), "voyage-pf2e-source-resolution-failed"); assert.equal(JSON.stringify(result).includes("document"), false);
});

test("statistic lookup uses actor receiver and exact authored slug, with missing and hostile methods controlled", async () => {
  let receiver; let slug; const statistic = { private: "stat" };
  const actor = { documentName: "Actor", getStatistic(value) { receiver = this; slug = value; return statistic; } };
  const result = await preflightVoyagePf2ePendingCheckInFoundry(check({ statisticSlugOrAbilityId: "Custom Lore" }), runtime({ document: actor }));
  assert.equal(result.ok, true); assert.equal(receiver, actor); assert.equal(slug, "Custom Lore"); assert.equal(JSON.stringify(result).includes("private"), false);
  assert.equal(errorCode(await preflightVoyagePf2ePendingCheckInFoundry(check(), runtime({ document: { documentName: "Actor" } }))), "voyage-pf2e-statistic-unresolved");
  const hostile = Object.defineProperty({ documentName: "Actor" }, "getStatistic", { get() { throw new Error("stat"); } });
  assert.equal(errorCode(await preflightVoyagePf2ePendingCheckInFoundry(check(), runtime({ document: hostile }))), "voyage-pf2e-statistic-resolution-failed");
});

test("secret mapping and existing adapter blocked results pass through without roll, chat, or update calls", async () => {
  let forbidden = 0;
  const actor = { documentName: "Actor", getStatistic: () => ({}) };
  const result = await preflightVoyagePf2ePendingCheckInFoundry(check({ secrecy: "secret" }), { ...runtime({ document: actor }), roll() { forbidden += 1; }, ChatMessage() { forbidden += 1; }, update() { forbidden += 1; } });
  assert.equal(result.rollMode, "blind"); assert.equal(forbidden, 0);
  assert.equal(errorCode(await preflightVoyagePf2ePendingCheckInFoundry(check({ status: "resolved" }), runtime({ document: actor }))), "voyage-pf2e-check-not-pending");
});

test("Actor document result is not retained by a ready result", async () => {
  const document = { documentName: "Actor", getStatistic: () => ({}) };
  const result = await preflightVoyagePf2ePendingCheckInFoundry(check(), runtime({ document }));
  assert.equal(Object.values(result).includes(document), false);
});

test("TokenDocument-like document preflights through its actor", async () => {
  const actor = { getStatistic: () => ({}) };
  assert.equal((await preflightVoyagePf2ePendingCheckInFoundry(check(), runtime({ document: { actor } }))).ok, true);
});

test("unresolved documents without an Actor block as actor unresolved", async () => {
  assert.equal(errorCode(await preflightVoyagePf2ePendingCheckInFoundry(check(), runtime({ document: {} }))), "voyage-pf2e-actor-unresolved");
});

test("throwing documentName getter becomes source-resolution failure", async () => {
  const document = Object.defineProperty({}, "documentName", { get() { throw new Error("name"); } });
  assert.equal(errorCode(await preflightVoyagePf2ePendingCheckInFoundry(check(), runtime({ document }))), "voyage-pf2e-source-resolution-failed");
});

test("non-function getStatistic blocks as unresolved statistic", async () => {
  const document = { documentName: "Actor", getStatistic: true };
  assert.equal(errorCode(await preflightVoyagePf2ePendingCheckInFoundry(check(), runtime({ document }))), "voyage-pf2e-statistic-unresolved");
});

test("throwing statistic method retains adapter statistic-resolution error", async () => {
  const document = { documentName: "Actor", getStatistic() { throw new Error("lookup"); } };
  assert.equal(errorCode(await preflightVoyagePf2ePendingCheckInFoundry(check(), runtime({ document }))), "voyage-pf2e-statistic-resolution-failed");
});

test("unsafe pending-check IDs are omitted from runtime validation blocks", async () => {
  const result = await preflightVoyagePf2ePendingCheckInFoundry(check({ pendingCheckId: "prototype" }), {});
  assert.equal(Object.hasOwn(result, "pendingCheckId"), false);
});

test("valid identity is included in runtime validation blocks", async () => {
  const result = await preflightVoyagePf2ePendingCheckInFoundry(check(), {});
  assert.equal(result.pendingCheckId, "runtime-check-1"); assert.equal(result.sequence, 4);
});

test("wrapper reads the fromUuid getter exactly once", async () => {
  let reads = 0;
  const value = { game: { system: { id: "pf2e" } }, get fromUuid() { reads += 1; return async () => ({ documentName: "Actor", getStatistic: () => ({}) }); } };
  assert.equal((await preflightVoyagePf2ePendingCheckInFoundry(check(), value)).ok, true); assert.equal(reads, 1);
});

test("public dependency factory reads the fromUuid getter exactly once", () => {
  let reads = 0;
  createVoyagePf2eRuntimeDependencies({ get fromUuid() { reads += 1; return () => null; } });
  assert.equal(reads, 1);
});

test("a second-read-throwing fromUuid getter succeeds because no second read occurs", async () => {
  let reads = 0;
  const value = { game: { system: { id: "pf2e" } }, get fromUuid() { if (++reads > 1) throw new Error("second read"); return async () => ({ documentName: "Actor", getStatistic: () => ({}) }); } };
  assert.equal((await preflightVoyagePf2ePendingCheckInFoundry(check(), value)).ok, true); assert.equal(reads, 1);
});

test("only the first captured fromUuid function is used", async () => {
  let reads = 0; let firstCalls = 0; let secondCalls = 0;
  const value = { game: { system: { id: "pf2e" } }, get fromUuid() { reads += 1; return reads === 1 ? async () => { firstCalls += 1; return { documentName: "Actor", getStatistic: () => ({}) }; } : async () => { secondCalls += 1; return null; }; } };
  assert.equal((await preflightVoyagePf2ePendingCheckInFoundry(check(), value)).ok, true); assert.equal(firstCalls, 1); assert.equal(secondCalls, 0); assert.equal(reads, 1);
});

test("captured resolver invocation exception retains source-resolution failure", async () => {
  const value = runtime({ fromUuid: async () => { throw new Error("resolver"); } });
  assert.equal(errorCode(await preflightVoyagePf2ePendingCheckInFoundry(check(), value)), "voyage-pf2e-source-resolution-failed");
});

test("missing hostile and non-function first fromUuid reads retain UUID-resolver-unavailable", async () => {
  for (const value of [
    { game: { system: { id: "pf2e" } } },
    { game: { system: { id: "pf2e" } }, fromUuid: null },
    { game: { system: { id: "pf2e" } }, get fromUuid() { throw new Error("hostile"); } }
  ]) assert.equal(errorCode(await preflightVoyagePf2ePendingCheckInFoundry(check(), value)), "voyage-pf2e-uuid-resolver-unavailable");
});

test("creating dependencies does not invoke the captured resolver", () => {
  let calls = 0;
  createVoyagePf2eRuntimeDependencies({ fromUuid() { calls += 1; } });
  assert.equal(calls, 0);
});
