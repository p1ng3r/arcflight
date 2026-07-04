# PR #355E Session Switch Closeout

## Summary of #355A-#355D

#355A-#355D hardened the Travel Event Runner saved-session switch path by isolating session-local round action order state, selected session/event/round context, preview rows, transient Travel v2 result feedback, and review-only candidate/selection state. The existing session-switch smoke coverage now exercises an A -> B -> C -> A path through the runner load-session handler and validates the render context after each switch.

## Guaranteed by this closeout

- Committed round action order and committed-order status are read from the newly loaded saved session only.
- Selected session, event, round, preview panel, and selected library row context update to the newly loaded session without carrying stale context from the previous session.
- Transient Travel v2 result feedback is cleared on switch and is not restored when switching back.
- Review-only candidate and selection state is cleared on switch and is not restored when switching back.
- Status messages reference only the newly loaded session name.
- Switching back to a previous session restores saved session data only, not stale UI feedback.
- Persisted saved-session records are preserved.
- Library source data, entry projections, and saved session records are not mutated by switching.
- Switching creates no proposed order, commit result, persistence result, persistence record, pressure/correction/finalization/completion/outcome/application/hazard/follow-up/station-benefit result record, or other apply-style session record.
- Non-GM render/template-facing state remains player-safe after each switch.
- Non-GM state redacts the forbidden GM/internal fields covered by the smoke: `auditRecord`, `commitRecords`, `userId`, `userName`, `gmText`, `applyPayload`, `targetActorUuid`, `mutationScope`, `internalMutation`, and `secret`.
- The aggregate Travel v2 smoke runner includes the session-switch order-state and context-isolation suites.

## Intentionally not changed

- No user-facing controls or visual redesign were added.
- No runtime behavior was changed beyond smoke assertions for the closeout.
- No commit, persistence, storage, loading, saving, proposed-order, reorder, round-advancement, station-result, roll, check/DC, chat, journal, socket, actor application, hazard, consequence, pressure, Momentum, station benefit, ship scar, event completion, finalization, or outcome logic was added or changed.
- No saved session records are deleted.

## Validation commands

```bash
node scripts/apps/travel-event-runner-v2-session-switch-context-isolation.smoke.js
node scripts/apps/travel-event-runner-v2-session-switch-order-state.smoke.js
node scripts/dev/run-travel-v2-smoke.mjs
node scripts/dev/run-foundry-check-runner-smoke.mjs
```
