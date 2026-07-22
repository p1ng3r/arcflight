# V3-004E-A — PF2e Resolution Check Preflight Adapter

## Purpose

`scripts/voyage/pf2e/resolution-check-adapter.js` is the Foundry-facing boundary
between a persisted normalized pending check and a future PF2e execution slice.
It is deliberately outside `scripts/voyage/domain/`: the domain remains free of
Foundry globals and live PF2e document objects.

The public entry point is:

```js
await preflightVoyagePf2ePendingCheck(pendingCheck, dependencies)
```

It accepts untrusted plain data, reads relevant own properties once, and returns
only isolated serializable data. It never returns an Actor, TokenDocument,
Statistic, Roll, ChatMessage, function, or runtime dependency.

## Supported contract

Only persisted records whose `status` is `"pending"` are accepted. The currently
supported check shape is:

```js
{
  source: { kind: "character", uuid: "Actor.abc123" },
  statisticOptions: ["athletics", "acrobatics"],
  dcSource: { kind: "fixed", value: 20 },
  secrecy: "public" // or "secret"
}
```

`source.uuid` must be an own non-blank string. `character` may resolve to an
Actor, TokenDocument, or another document form when the injected actor extractor
can derive an actor from it. Other source kinds are deliberately unsupported.

Only `dcSource.kind === "fixed"` is supported. Its `value` must be an own
non-negative safe integer. No PF2e level tables or other dynamic DC mechanisms
are inspected; all other DC source kinds are deliberately unsupported.

## Dependencies and statistic fallback

The caller supplies the runtime-only operations:

```js
{
  resolveUuid: async (uuid) => documentOrNull,
  getActorFromResolvedDocument: (document) => actorOrNull,
  getStatistic: (actor, slug) => statisticOrNull
}
```

`validateVoyagePf2eAdapterDependencies` checks that these are own functions.
Dependency exceptions become structured failures rather than escaping.

`statisticOptions` is an ordered fallback list. The adapter visits only own,
numeric array entries in ascending index order. Each option must be an exact
non-blank authored string; it is passed unchanged to `getStatistic`. The first
truthy statistic selects that same authored `statisticSlug`. No slug trimming,
case conversion, Lore inference, or PF2e-specific lookup behavior is added here.

Secrecy is converted to an abstract visibility value only: `public` maps to
`publicroll`, and `secret` maps to `blindroll`.

## Results and boundary

A ready result includes `pendingCheckId`, `sequence`, `sourceKind`, `sourceUuid`,
`statisticSlug`, `dc`, `rollMode`, `errors`, and `warnings`. A blocked result has
`ok: false`, `status: "blocked"`, and distinguishable `voyage-pf2e-*` error
codes, including invalid request/dependency, unsupported source/DC, source or
actor resolution, statistic resolution, fixed DC, secrecy, and non-pending
record failures.

This preflight performs **no live PF2e check**, creates **no chat message**, and
does **not mutate** a pending check, encounter, or any document. It is exposed
through the existing Arcflight API only as an explicit helper; registration does
not invoke it.

## Deferred work

Later slices own live PF2e check invocation, chat-message creation, roll
cancellation, total/die and degree-of-success extraction, pending-check mutation,
duplicate-execution locks, result persistence, consequences, and Resolution
advancement. They also own all source kinds other than `character` and DC kinds
other than `fixed`.
