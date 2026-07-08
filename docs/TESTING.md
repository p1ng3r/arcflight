# Arcflight Testing

This is the canonical testing reference for Arcflight.

## Testing rules

- Documentation-only PRs should not invent fake smoke commands.
- Runtime code changes should include focused smoke coverage where practical.
- Aggregate smoke coverage should protect existing behavior but should not be refactored casually.
- If a test command is required for a PR, list the exact command in the PR body.

## Common Travel v2 smoke command

The existing aggregate Travel v2 smoke runner is:

```bash
node scripts/dev/run-travel-v2-smoke.mjs
```

Use this when a runtime Travel v2 change needs broad regression coverage.

## Focused smoke scripts

Focused smoke scripts may exist under:

```text
scripts/dev/
scripts/helpers/*.smoke.js
scripts/apps/*.smoke.js
```

Use the narrowest meaningful command for small helper or UI changes, then run aggregate coverage when the risk justifies it.

## Docs-only testing

For docs-only PRs, use:

```text
Docs-only change; no smoke tests run.
```

Optionally verify Markdown manually, but do not require runtime smoke tests for documentation-only cleanup.

## Safety coverage themes

Travel v2 tests should continue protecting:

- clone-safe helper behavior
- player-safe projections
- GM-only data redaction
- no unintended actor/item/chat/journal/socket/world mutations
- duplicate application guards
- session-local application records
- hazard reveal boundaries
- round finalization guards
- event completion guards

## Related docs

- `docs/ARCFLIGHT-BIBLE.md`
- `docs/TRAVEL-V2.md`
- `docs/ARCHITECTURE.md`
