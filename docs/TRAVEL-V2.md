# Travel v2

This is the canonical Travel v2 reference. It describes the current intended design and safety boundaries. Detailed historical phase plans may remain in other docs, but they do not override this file.

## Purpose

Travel v2 is Arcflight's GM-directed travel procedure for running dangerous voidfaring events at the table. It is not an autopilot simulator. It should help the GM frame events, collect station actions, preview consequences, apply pressure through explicit review, handle hazards, finalize rounds, complete events, and prepare follow-ups.

## Core lifecycle

1. Prepare or select a Travel v2 event.
2. Start a runner session.
3. Run one or more rounds.
4. Collect station actions and results.
5. Preview pressure and consequences.
6. GM explicitly applies or corrects pressure.
7. GM finalizes the round.
8. Hazards, benefits, momentum, and follow-up records are handled through explicit flows.
9. GM completes the event.
10. Outcome packages and real ship changes require GM review/application paths.

## Session-local first

Travel v2 should prefer session-local state until the GM explicitly confirms a real application. Session-local helpers may update cloned runner session data and write audit/application records. They should not silently mutate Foundry actor/item/world data.

## Player-safe boundary

Player-facing state must be sanitized. It should not leak GM-only fields, secret hazard data, internal mutation payloads, target actor UUIDs, user IDs, audit details, or unrevealed hazard internals.

## GM-only review boundary

GM-facing controls may expose richer context, but actual application still requires explicit GM intent. Review-only state should stay review-only until an apply helper is invoked.

## Pressure

Pressure represents escalating travel danger and consequence load. The pressure loop supports preview, application, correction, duplicate protection, and recordkeeping.

## Hazards

Hazards may be drawn, held, revealed, activated, dismissed, progressed, or cleared through explicit GM-facing flows. Unrevealed hazard data must remain private.

## Event approach tally

Event approach tally records how the party's chosen approach contributes toward the travel event outcome. Canonical helpers and session containers should be kept stable and documented in code-facing notes as needed.

## Round finalization

A round should only finalize when required inputs are complete and blocking state is resolved. Finalization should append clear records and avoid mutating unrelated session data.

## Event completion

Event completion summarizes the completed session and prepares the GM for follow-up/outcome review. It should not jump directly into uncontrolled actor or item mutation.

## Builder/importer relationship

The Travel Event Builder and importer/exporter paths must remain compatible with current runner expectations. Builder/importer schema gaps should be tracked in `docs/TODO.md` until they become a focused roadmap slice.

## Testing

Travel v2 smoke tests protect pressure, hazards, round finalization, event completion, player-safe state, and application-review boundaries. Official testing commands belong in `docs/TESTING.md`.

## Related docs

- `docs/ARCFLIGHT-BIBLE.md`
- `docs/ROADMAP.md`
- `docs/TODO.md`
- `docs/DATA-MODEL.md`
- `docs/TESTING.md`
