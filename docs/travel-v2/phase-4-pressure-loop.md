# Travel v2 Phase 4 pressure loop

Phase 4 supports a GM-only, session-local pressure loop for the active Travel v2 runner round:

```text
Preview → Apply → Correct
```

## Preview rows

The runner prepares read-only preview rows for each supported outcome: critical success, success, mixed, failure, and critical failure. Each row summarizes the pressure requests and per-track totals that would be applied for that outcome. Preview preparation is informational only; it does not apply pressure, correct pressure, mutate actors or items, emit sockets, or send chat.

## Apply action

The GM may apply one valid preview outcome to the local runner session while the session is active and the current round has not already received a pressure application. Apply controls are disabled when the session is completed, the preview is unavailable, the selected outcome is invalid or blocked, or an application record already exists for the round.

A successful apply updates only the returned runner session clone and appends an application record containing the round, outcome key, request count, pressure totals, timestamp, helper version, and pressure change count.

## Correction action

After pressure has been applied, the GM may correct the effective applied outcome to another valid outcome for the same active runner session. The effective applied outcome is marked in the preview panel and cannot be selected as its own correction target. Correction controls are shown only for other valid outcomes and are disabled for completed sessions.

A successful correction reverses the original application totals, applies the corrected outcome to a cloned session, preserves the original application record history, appends a corrected application record, and appends a correction record describing the previous outcome, corrected outcome, reason, timestamp, original application record, reversal summary, and corrected application record.

## Duplicate guards and blocked corrections

Duplicate apply attempts are blocked once the current round has an effective application record. Corrections are blocked when there is no application record, the corrected outcome is missing, the corrected outcome is invalid, the corrected outcome matches the effective applied outcome, reversal would push a pressure track below zero, or the runner session is completed. Correction feedback takes priority over older application feedback so the latest GM action is clear.

## Boundary

Phase 4 pressure application and correction are GM-only and session-local. They do not mutate actors or items, emit sockets, send chat, update player station cards, complete events, finalize rounds, or hand off fortune/scar rewards.

## Out of scope until Phase 5

Phase 5 still owns round finalization, event completion, player-facing completion state, fortune/scar reward flow, and any broader persistence or automation beyond the local runner session pressure loop.
