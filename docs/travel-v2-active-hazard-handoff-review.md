# Travel v2 Active Hazard Handoff Review

## Purpose

Travel v2 active hazard handoff review prepares a GM-only review package for turning an inert drawn hazard candidate into a proposed active hazard record. It does not activate the hazard, persist the record, mutate session state, or apply any effects or consequences.

## What This Adds

- explicit GM-only handoff review request state
- review-only proposed active hazard record shape
- player-safe handoff summary
- optional GM-only review data
- app render-state integration
- smoke coverage

## What This Does Not Add

- no automatic activation
- no active hazard persistence
- no session active hazard mutation
- no consequence application
- no arbitrary card-pack runtime consumption
- no import UI
- no settings persistence
- no actor/item/world mutation
- no socket/chat/journal/scene/token/combat writes

## Handoff Candidate Semantics

A handoff candidate is an activation candidate only. Its `proposedActiveHazard` is always marked `reviewOnly: true`, `persisted: false`, `active: false`, and `lifecycleStatus: "candidate"`. The candidate may carry player-safe card data such as title, public text, station impacts, response actions, clear condition, unresolved consequence refs, escalation refs, and tags so the GM can review what a later active-hazard lifecycle would receive.

The helper also reports that `canActivate`, `canHold`, `canDismiss`, `canApply`, and `canPersist` are false. `activeHazardMutation.available` is false because GM activate/hold/dismiss controls are not implemented here, and `consequenceApplication.available` is false because this review layer does not apply consequences.

## Player Safety

Handoff review is GM-only and requires an explicit handoff review request. Player-safe output recursively removes GM-only and internal mutation fields including `gmText`, `gmSummary`, `gmMechanicalNotes`, `explicitGmApplyEffect`, `sessionLocalEffect`, `internalMutation`, actor targets, apply payloads, before/after snapshots, and queue internals. Optional `gmReview` data is included only when `includeGmReview` is true and the user is a GM.

## Future PRs

- GM activate/hold/dismiss candidate controls
- active hazard lifecycle and player HUD display polish
- card pack import/export
- expanded hazard packs

## Follow-up: GM Candidate Controls

Handoff candidates can now feed explicit GM activate/hold/dismiss candidate controls. Those controls still keep lifecycle results session-local/render-state only and do not mutate Foundry documents, apply consequences, or apply station effects automatically.
