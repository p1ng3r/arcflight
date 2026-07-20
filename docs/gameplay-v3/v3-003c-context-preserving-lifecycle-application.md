# Gameplay V3-003C: Context-Preserving Voyage Lifecycle Application

## Purpose

`applyContextPreservingVoyageLifecycleTransition(encounterState, toLifecycleState)` is a pure domain operation for the limited lifecycle edges whose complete effect is preserving the existing Voyage Encounter context, changing its lifecycle state, and advancing its revision. It is not a lifecycle command, persistence mechanism, or gameplay resolver.

## Supported transitions

The helper first validates the requested edge with the accepted lifecycle policy, then supports only:

- Draft to Configuration;
- Configuration to Draft;
- Ready to Configuration;
- Active to Paused; and
- Paused to Active.

All other policy-legal lifecycle edges return `specialized-lifecycle-operation-required` at `toLifecycleState`. Invalid source or target states, same-state requests, and policy-illegal edges retain the existing lifecycle validation errors.

## Contracts and atomicity

Success returns `{ ok: true, nextState, events: [event], errors: [], warnings: [] }`. The event is plain data with `type: "voyage.lifecycle-transitioned"`, encounter ID, source and target lifecycle states, and previous and resulting revisions.

Failure returns `{ ok: false, nextState: null, events: [], errors, warnings }`. Input state, transition validity, supported-edge eligibility, and the complete candidate state are validated before success is returned. Any failure leaves the supplied state unchanged and produces no events.

## Exact mutation boundary and revision behavior

The helper recursively clones the complete supplied plain-data state. On that clone, it changes only `lifecycleState` and `revision`; revision becomes the supplied revision plus exactly one. All other known and forward-compatible plain-data fields are preserved, including active-round stage, round number, phase, selections, reservations, tracks, checks, consequences, snapshots, recovery data, and metadata. The recursive clone prevents mutable nested arrays and plain objects from being shared with the input state.

## Deferred specialized work

Activation, recovery, terminal success or failure, abandonment, and discard remain deferred because they require rules beyond this preservation-only operation: readiness and authority checks, round or stage setup, recovery reconciliation, snapshot handling, terminal summaries, staged permanent consequences, and tombstone/discard behavior. This helper does not implement those effects, expected-revision commands, request processing, persistence, sockets, projections, or UI behavior.

## Foundry-free boundary

The domain module only uses Voyage plain-data clone and validation helpers plus lifecycle constants. It does not access Foundry globals, documents, PF2e classes, sockets, hooks, chat, persistence, or UI services. Foundry-facing registration merely exposes the pure helper as `game.arcflight.applyContextPreservingVoyageLifecycleTransition` and `game.arcflight.devTools.applyContextPreservingVoyageLifecycleTransition`.
