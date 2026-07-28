# Gameplay V3 Milestone 2B — Pass 3 of 4
## Authored approaches and third-approach exception

**Codex mode:** Code
**Repository:** `p1ng3r/arcflight`
**Working branch:** `codex/gameplay-v3-2b-round-action-authoring`

Read the M2B master specification, Passes 1–2 reports/diffs, canonical approach rules, analyzer/tests, and legacy execution definitions only as compatibility reference.

Do not commit, push, merge, rebase, reset, delete branches, open a PR, launch Foundry, or use browser automation.

## Dependency

Passes 1–2 complete and accepted.

## Scope

Require every action to own a dense `approaches` array with one, two, or three plain records.

Valid statistic/ability approach:

```js
{ approachId: "crafting", statisticSlugOrAbilityId: "crafting" }
```

Valid no-roll approach:

```js
{ approachId: "automatic", noRoll: true }
```

Implement exact safe unique approach IDs and exactly one execution identity. Reject missing identities, both identities, blank identities, and `noRoll: false`. Do not resolve runtime objects.

For exactly three approaches require:

```js
{
  thirdApproachException: {
    approachId: "risky-lore",
    distinctions: ["failure-risk"]
  }
}
```

Allowed distinctions:

```text
result-narration
critical-success-benefit
failure-risk
upgrade-interaction
risk-bid-availability
target
affected-system
```

Require exact approach match and non-empty dense unique canonical distinctions. Reject exception metadata on one/two approaches. Add no behavior to distinctions.

Do not alter `action.check.statisticOptions`, execution requests, pending checks, PF2e adapters, Event Session selections, readiness, or APIs.

Normalized approach:

```js
{
  approachIndex,
  approachId,
  executionKind: "statistic-or-ability",
  statisticSlugOrAbilityId: "crafting"
}
```

No-roll uses `executionKind: "no-roll"` and `statisticSlugOrAbilityId: null`.

Any error keeps top-level normalized `rounds` empty.

## Required tests

Cover one/two approaches; no-roll; exact identity; blank/missing/dual identities; `noRoll: false`; zero/over-three; sparse/inherited/malformed approaches; blank/unsafe/duplicate IDs; missing exception; every distinction; mismatched reference; empty/sparse/inherited/duplicate/unsupported distinctions; exception on fewer approaches; hostile objects; isolation; prior regressions.

## Files and verification

Expected analyzer/tests, possible shared constants. No planning, Resolution, PF2e, public API, lifecycle, or state changes.

Run syntax checks, focused tests, `git diff --check`, and inspect status/diffs/untracked files.

Return summary, files, commands, totals, assumptions, limitations, and incomplete work. Stop after Pass 3.
