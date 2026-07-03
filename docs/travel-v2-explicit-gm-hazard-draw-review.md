# Travel v2 Explicit GM Hazard Draw / Review Flow

## Purpose

This flow lets a GM explicitly create an inert draw candidate from the currently selected built-in Travel v2 hazard deck. It is a review step only: the candidate gives the GM enough player-safe and optional GM-only card information to inspect the draw before a later active-hazard handoff exists.

## What This Adds

- Explicit GM-only draw request state.
- Deterministic `top`, `index`, and `id` draw modes.
- Inert draw candidate review state.
- Player-safe candidate summary.
- Optional GM-only review data gated to GM callers.
- App render-state integration through `travelV2HazardDrawReview`.
- Smoke coverage for helper behavior, app state integration, redaction, inert flags, and persistence-call scanning.

## What This Does Not Add

- No automatic draw.
- No hazard activation.
- No active hazard creation.
- No consequence application.
- No arbitrary card-pack runtime consumption.
- No import UI.
- No settings persistence.
- No actor/item/world mutation.
- No socket/chat/journal/scene/token/combat writes.

## Draw Candidate Semantics

A draw candidate is not an active hazard. It reports `isCandidate: true`, `isActive: false`, and `activationStatus: "inactive"` when a GM explicitly draws a valid card. It also keeps `canActivate`, `canApply`, and `canPersist` false, with active-hazard mutation and consequence application marked unavailable.

The helper clones the selected built-in deck card data before returning review state and does not modify the source deck, session, actors, items, settings, compendia, scenes, tokens, chat, journals, combat, or sockets. The candidate is intended to be handed to a future active-hazard review/handoff PR, not activated by this flow.

## Player Safety

Non-GM callers cannot draw candidates and cannot receive GM review text. Player-safe state recursively removes GM-only or internal fields, including `gmText`, `gmSummary`, `gmMechanicalNotes`, `explicitGmApplyEffect`, `sessionLocalEffect`, `internalMutation`, actor target ids, apply payloads, before/after snapshots, and queue internals.

GM review data is included only when the caller is a GM and `includeGmReview` is explicitly true. Non-GM app state remains sanitized and does not expose `gmReview` or nested GM text.

## Future PRs

- Active hazard handoff review.
- GM activate/hold/dismiss candidate controls.
- Card pack import/export.
- Expanded hazard packs.

## Active Hazard Handoff Review Follow-up

Draw candidates can now feed the GM-only active hazard handoff review layer. That follow-up remains inert and review-only: it prepares a proposed active hazard candidate for GM review without activation, persistence, session mutation, or consequence application.
