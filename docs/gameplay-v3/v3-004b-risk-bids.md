# Gameplay V3-004B: Crew Planning Risk Bids

Risk Bids are optional, action-specific Crew Planning choices. Authoring places optional `riskBidOptions` on an action; each option is plain data with an exact, case-sensitive `riskBidId`. Options are not global bid levels and this slice neither interprets arbitrary option data nor assigns numeric difficulty, cost, consequence, or benefit formulas.

Authoritative state stores identifiers only: `riskBids[stationId] = { stationId, actionId, riskBidId }`. A bid must couple to an existing selected action for the same available station and to exactly one authored option. Missing bids remain legal even where options exist.

`validateVoyageEncounterRiskBids` validates this contract. Selection, change, and clear commands are Active/Crew Planning-only atomic mutations and emit one `voyage.risk-bid-selected`, `voyage.risk-bid-changed`, or `voyage.risk-bid-cleared` event. Action selection change or clear atomically removes its coupled bid and reports `clearedRiskBidId` on its existing primary event. Future target-change and target-clear commands must likewise clear a coupled bid atomically; target APIs are intentionally deferred.

Crew Planning readiness invokes bid validation and invalid persisted bids block locking. Valid bid references remain in the Lock Readiness phase-start snapshot. Since phase is the sole lock authority, bid editing rejects after locking without another lock flag.

The validator and mutation helpers are exposed through `game.arcflight`, `CONFIG.arcflight`, and `game.arcflight.devTools`, alongside the existing planning helpers. This is planning-state management only: execution, rolls, DC effects, resource spending, consequences, persistence, multiplayer, and UI remain deferred.
