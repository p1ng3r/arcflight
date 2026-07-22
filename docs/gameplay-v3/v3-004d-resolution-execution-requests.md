# Gameplay V3-004D: Resolution execution requests and pending checks

This slice keeps Voyage rules as Foundry-free, serializable domain data.  The future PF2e adapter receives normalized execution requests; it alone locates documents, resolves DC references and statistics, and performs rolls.

An action with no own `check` property (including an inherited property) is an automatic `no-roll` action. An authored own `check` is a plain object with own `source`, `statisticOptions`, `dcSource`, and `secrecy`; optional own `metadata` is plain data. Sources are `character`, `ship`, `station`, `crew`, or `custom`. Options are non-empty exact strings in own numeric array entries. DC sources have a recognized kind; `fixed` additionally has a non-negative safe-integer `value`. Secrecy is exactly `public` or `secret`.

`prepareVoyageEncounterActionExecutionRequests` creates deterministic Resolution-order records with `sequence`, station/action IDs, priority, Risk Bid, target, mode, source, statistic options, DC source, secrecy, and metadata. It copies mutable data and considers only own numeric collection entries. No-roll records use `{ kind: "no-roll" }`, no options, null DC source, public secrecy, and empty metadata.

Callers map each check sequence to a safe, caller-supplied pending-check ID. Atomic preparation increments revision once and persists check-only records containing the normalized request plus stage, round, prepared revision, `status: "pending"`, and `result: null`. It emits an intentionally non-secret summary event. Empty pending checks are the valid pre-preparation state; a populated collection must completely match deterministic requests, enabling recovery after reload. All-no-roll plans are valid but reject preparation without revision change.

Deferred to Milestone 2E and later: PF2e lookup, modifier/DC resolution, rolls, result normalization, action outcomes, Risk Bid effects, consequences, persistence/socket/UI work, and advancement beyond Resolution.
