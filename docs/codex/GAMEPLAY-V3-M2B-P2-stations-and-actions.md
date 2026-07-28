# Gameplay V3 Milestone 2B — Pass 2 of 4
## Round stations and exact three-action collections

**Codex mode:** Code
**Repository:** `p1ng3r/arcflight`
**Working branch:** `codex/gameplay-v3-2b-round-action-authoring`

Read the M2B master specification, Pass 1 report/diff, canonical rules, M2A station exports, current analyzer, and tests.

Do not commit, push, merge, rebase, reset, delete branches, open a PR, launch Foundry, or use browser automation.

## Dependency

Pass 1 complete and accepted.

## Scope

Extend the analyzer with:

- own non-empty dense `availableStations`;
- plain station records;
- reuse of M2A canonical station IDs;
- safe, unique station IDs within each round;
- partial station subsets and differing subsets by round;
- own dense `actions`;
- exactly three actions per available station;
- plain action records;
- exact safe action IDs;
- unique action IDs within the station/round;
- action IDs may repeat elsewhere;
- normalized station/action records;
- deterministic issues and isolation.

For this pass, actions may temporarily use `approaches: []`. Do not enforce approach rules.

Occupancy and assignments are not inputs. Do not require all five stations. Do not attempt semantic text-quality checks.

Normalized actions may temporarily contain:

```js
{
  actionIndex,
  actionId,
  approachCount: 0,
  approaches: [],
  thirdApproachException: null
}
```

Any error anywhere keeps top-level normalized `rounds` empty.

## Required tests

Cover empty/sparse/inherited/malformed stations; canonical/unsupported/unsafe/duplicate stations; partial subsets; changing subsets; required actions; sparse actions; exact count three; malformed/blank/unsafe/duplicate actions; repeat IDs in other rounds; source indexes; isolation; Pass 1 regressions.

## Files

Expected analyzer and focused test only. Constants only if genuinely needed. No session, planning, Resolution, PF2e, lifecycle, snapshot, or API changes.

## Verify

Run syntax checks, focused tests, `git diff --check`, and inspect status/diffs/untracked files.

Return summary, files, commands, totals, assumptions, limitations, and incomplete work. Stop after Pass 2.
