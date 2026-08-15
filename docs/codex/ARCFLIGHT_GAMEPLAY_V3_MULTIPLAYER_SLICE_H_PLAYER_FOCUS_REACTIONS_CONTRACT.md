# Arcflight Gameplay V3 — M12 Multiplayer Slice H

## Player Focus and reactions

SLICE H MULTIPLAYER SUPPORT IS PRE-ROLL ONLY.

It supports existing pre-roll Focus opportunities and the canonical
`focus-reaction-use`, `focus-reaction-pass`, and `focus-reaction-commit`
evidence. Player result-modification or post-roll reaction UI, degree/result
rewriting, rerolls, retry rolls, and replacement PF2e checks are not
implemented in this slice.

Slice H extends the existing Task 4 `focus-reaction-use` and
`focus-reaction-pass` commands to the authenticated player who controls the
canonical participant recorded on the current reaction opportunity. It does
not create another reaction queue, Focus ledger, roll engine, or persistence
store.

The player command is the existing exact M11 command envelope with a payload
containing only `{ reactionId }`. Session, opportunity, participant, Focus
pool, authored ability, target, statistic, DC, modifier, degree, and result
are derived and validated by the trusted runtime. GM authority remains
unchanged.

Player mutations require trusted connected authentication, the canonical
M11 fingerprint/replay path, current caller `expectedRevision` and
`authorityEpoch`, the current open window, and a durable assignment matching
the opportunity's operator identity. Exact replay is isolated and write-free;
changed fingerprints conflict; disconnected, stale, transferred, foreign,
forged, or already-resolved requests fail closed.

USE and PASS retain Task 4 semantics. USE spends one event-local Focus point
before the trusted Focus check and persists the pending receipt; a retry uses
the durable receipt and never rolls twice. `focus-reaction-pass` resolves the
existing canonical PASS-able pre-roll opportunity, spends zero Focus, performs
zero Focus checks and zero station action-segment PF2e rolls, creates no
station result, performs no reroll, and applies no independent Focus effect.
It performs only the canonical PASS transition for that opportunity.
Focus is not refunded by reload or a later failed request. A reaction closes
exactly once and its event, audit, processed request, result, and effect remain
reloadable evidence. No reroll is introduced.

The multiplayer projection exposes a bounded decision only to the eligible
participant (and the GM): authored title, description, narration, source and
target station labels, cost, statistic, visibility, safe DC/outcome text when
public, and canonical USE/PASS identifiers. Other operators, crew, and
observers receive only a generic waiting state. Raw Focus definitions,
receipts, actors, audits, processed requests, authority metadata, hidden DCs,
and hidden outcomes are omitted.

Player Event presents the decision in Resolution, keeps Roll Station Check
blocked while a required window is open, and rerenders from authoritative
state after each command. Player mutations use the shared socketlib
GM-authoritative transport foundation; no custom raw socket protocol is added.
The transport carries only the existing bounded command envelope and returns
the isolated canonical result. Risk Bids remain locked and authoritative. Slice H
ends at the existing Task 4 Resolution Complete / Awaiting Round Closeout
boundary and does not implement Slice I recovery or Task 5 closeout.
