# TV2-002 — Inter-Station Help Closeout

## Status

**Complete for Travel Alpha runtime. Enhancements deferred.**

TV2-002 was implemented through the planned eight-slice sequence. The alpha runtime now supports a coherent Inter-Station Help lifecycle:

```text
Authored Help option
→ GM review and queue
→ explicit use
→ explicit effect review and application
→ base or authored critical-success strengthening
→ target station check
→ target-resolution or round-end expiration
```

## Completed alpha behavior

- Event-, round-, station-card-, and station-prompt-authored Help options are prepared and shown safely.
- Station order limits Help to later active stations.
- Successful source results can create deterministic pending Help records with stable identity and dedupe.
- The GM explicitly reviews, queues, uses, and applies Help.
- Supported `dcReduction` Help modifies the canonical target-station DC without rolling or resolving the check.
- Authored critical-success `replaceMagnitude` strengthening is supported for `dcReduction` while malformed or unsupported metadata falls back safely.
- Help remains active through the target check and expires only after the target result is recorded.
- Successful round finalization expires remaining same-round `afterUse` and `endOfRound` Help.
- Expired Help remains visible as applied/expired lifecycle history and contributes zero mechanically.
- Non-GM users remain read-only.
- No automatic persistence or Foundry actor, item, Active Effect, chat, journal, socket, scene, token, combat, compendium, settings, or world mutation is introduced by TV2-002.

## Deferred enhancements

The following are separate follow-up tickets and do not block the alpha fold-in:

- [#492 — TV2-002A: Optional critical-success Help automation](https://github.com/p1ng3r/arcflight/issues/492)
- [#493 — TV2-002B: Deferred Help downside handling](https://github.com/p1ng3r/arcflight/issues/493)
- [#494 — TV2-002C: Additional Inter-Station Help benefit kinds](https://github.com/p1ng3r/arcflight/issues/494)
- [#495 — TV2-002D: Inter-Station Help UX and lifecycle test polish](https://github.com/p1ng3r/arcflight/issues/495)

These tickets should not be numbered as Slice 09 or later. Slices 01–08 are the complete historical implementation sequence for the alpha feature.

## Validation history

The slice pull requests report focused helper, runner, preview-consumer, round-finalization, aggregate Travel v2, Foundry-check-runner, syntax, and `git diff --check` validation through Slice 08. The final Slice 08 lifecycle-label patch was intentionally narrow and should receive one final local aggregate run before or immediately after the feature fold-in.

Recommended closeout commands:

```bash
node scripts/helpers/travel-v2-inter-station-help-expiration.smoke.js
node scripts/apps/travel-event-runner-v2-inter-station-help.smoke.js
node scripts/apps/travel-event-runner-v2-preview-consumer.smoke.js
node scripts/dev/run-travel-v2-smoke.mjs
node scripts/dev/run-foundry-check-runner-smoke.mjs
git diff --check
```

## Integration target

Fold `feature/tv2-002-inter-station-help` into `dev` using the established Travel v2 feature-branch integration pattern.
