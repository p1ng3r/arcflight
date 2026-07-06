# Travel v2 Future AI Bridge Notes

These notes are intentionally future-scoped. They should not block the current Travel v2 runtime, content-pack, combat, or ship-upgrade work.

## Priority placement

The optional AI bridge comes **after** the core pillars are working:

1. Travel v2 can run preauthored, validated events without live AI.
2. The Combat pillar is implemented and table-testable.
3. The Ship Upgrade pillar is implemented and table-testable.
4. Only after those pillars are stable should the AI bridge be considered.

## Core rule

Arcflight must be fully playable with preauthored content. A live ChatGPT/OpenAI bridge must be optional and must never be required for normal play.

## Intended future bridge

A future v1.1+ bridge may help the GM with:

- pre-session event authoring;
- event revision and cleanup;
- converting story text into validated Travel v2 JSON;
- optional live narration drafts;
- optional emergency event skeleton drafts.

## Runtime boundaries

The bridge should remain GM-controlled and review-only by default.

It must not directly:

- mutate actors;
- mutate items;
- create active effects;
- write journals;
- send chat messages;
- emit sockets;
- reveal GM-only secrets;
- apply pressure, scars, rewards, or consequences without explicit GM approval.

## Recommended version split

### V1.0 / Full working core

- Preauthored Travel events.
- Validated content packs.
- GM-triggered event selection.
- Player-driven station play.
- Foundry-resolved mechanics.
- No live AI dependency.

### After Combat and Upgrade pillars

- Revisit optional AI authoring bridge.
- Revisit optional live narration bridge.
- Revisit optional emergency event draft bridge.

## Design principle

ChatGPT/OpenAI may become a GM assistant later, but Arcflight itself should remain the rules engine, validator, and state tracker. The GM remains the voyage director. Players remain the drivers of ship actions.
