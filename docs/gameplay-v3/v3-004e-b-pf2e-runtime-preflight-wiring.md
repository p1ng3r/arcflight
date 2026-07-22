# V3-004E-B — Foundry/PF2e Runtime Preflight Wiring

## Purpose

`scripts/voyage/pf2e/runtime-preflight.js` wires the runtime-independent
V3-004E-A pending-check adapter to public Foundry and PF2e APIs. It supplies
`createVoyagePf2eRuntimeDependencies(runtime)` and
`preflightVoyagePf2ePendingCheckInFoundry(pendingCheck, runtime)`. Both are
available through `game.arcflight` and its `devTools` surface after Voyage API
registration.

## Runtime assumptions and dependency factory

The wrapper requires safely readable `runtime.game.system.id === "pf2e"` and a
callable `runtime.fromUuid`. It does not use `fromUuidSync`, private Foundry
internals, caches, or network access. The factory creates exactly these lazy
dependencies for V3-004E-A: `resolveUuid`, `getActorFromResolvedDocument`, and
`getStatistic`.

The wrapper and public factory each safely capture `runtime.fromUuid` exactly
once per construction, validate that captured value, and reuse that exact
function during resolution. `resolveUuid(uuid)` calls the captured resolver
once with `runtime` as its receiver, preserves the authored UUID unchanged, and
supports its asynchronous result. The runtime property is never reread after
capture. Lazy means the resolver function is captured but not invoked until
preflight resolution; factory creation resolves nothing.

An Actor is accepted when its safely-read `documentName` is exactly `"Actor"`.
Otherwise a TokenDocument-like resolved document may provide a non-null object
through its public `.actor` property. No nested document properties are used,
and neither the resolved document nor Actor is returned in a preflight result.

Statistics use only `actor.getStatistic(slug)`: the callable method is invoked
with the Actor receiver and the exact authored slug. Missing methods and absent
statistics return `null`; getter and method failures are normalized by the
adapter as statistic-resolution failures.

## Structured failures and safety boundary

Before invoking V3-004E-A, unavailable `game` or `game.system` values (and
hostile reads) produce `voyage-pf2e-runtime-unavailable`; a non-exact system ID
produces `voyage-pf2e-system-mismatch`; and a missing, non-callable, or hostile
`fromUuid` produces `voyage-pf2e-uuid-resolver-unavailable`. Valid safe
pending-check IDs and sequences are included when available. Hostile resolved
document and statistic access failures retain the adapter's source- or
statistic-resolution error codes.

This is preflight only: it performs **no roll**, `Statistic.roll`, `Check.roll`,
chat creation, dialog, document update, encounter mutation, socket call, or
Voyage-state advancement. Live PF2e execution, modifiers, degree reading,
duplicate prevention, and persistence remain deferred work.

## Manual Foundry validation (not performed in cloud)

In a PF2e v14 world, open the browser console and run the following after
selecting a character Actor and, separately, a placed TokenDocument:

```js
const api = game.arcflight;
typeof api.createVoyagePf2eRuntimeDependencies;
typeof api.preflightVoyagePf2ePendingCheckInFoundry;
api.validateVoyagePf2eAdapterDependencies(api.createVoyagePf2eRuntimeDependencies());

const actor = game.actors.contents[0];
const token = canvas.tokens.placeables[0]?.document;
await fromUuid(actor.uuid);                 // resolves the Actor
await fromUuid(token.uuid);                 // resolves the TokenDocument
const base = { pendingCheckId: "manual-preflight-1", sequence: 0, status: "pending", mode: "check", source: { kind: "character", uuid: actor.uuid }, statisticOptions: ["perception", "athletics"], dcSource: { kind: "fixed", value: 20 }, secrecy: "public" };
await api.preflightVoyagePf2ePendingCheckInFoundry(base); // ready, public
await api.preflightVoyagePf2ePendingCheckInFoundry({ ...base, secrecy: "secret" }); // ready, blind
await api.preflightVoyagePf2ePendingCheckInFoundry({ ...base, statisticOptions: ["not-a-pf2e-statistic"] }); // blocked
```

Before and after each call, record `game.messages.size`, the selected Actor and
TokenDocument serialized flags/data, the current encounter, and the pending
check object. Confirm no chat message or Actor, Token, encounter, or
pending-check document change occurs.
