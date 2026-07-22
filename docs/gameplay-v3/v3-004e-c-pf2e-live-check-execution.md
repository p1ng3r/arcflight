# V3-004E-C — Live PF2e Check Execution

Execution shares the internal `resolveVoyagePf2ePendingCheckContext` path with preflight, so UUID, Actor, and authored fallback Statistic resolution occur once per execution. Live context never leaves the boundary. Dependencies are four own functions: `resolveUuid`, `getActorFromResolvedDocument`, `getStatistic`, and `rollStatistic`.

The Foundry wrapper invokes public `Statistic.roll` once with `{ dc, messageMode, skipDialog: true, createMessage: true, identifier }`, where modes are `publicroll` or `blindroll`. PF2e creates its standard chat message. The isolated rolled result contains only finite `total`, degree `0..3`, and its mapped slug (`critical-failure`, `failure`, `success`, `critical-success`). Failures include invalid execution dependencies, unavailable statistic roll, roll failed, roll cancelled, and invalid roll result.

One successful call is one live chat roll. Chat creation is the only intended mutation: this slice does not update Actors, Tokens, encounters, or pending checks; it neither prevents duplicates nor persists results. V3-004F owns result application and the Consequences transition.

## Manual Foundry validation (not performed in cloud)

In a PF2e v14 browser console, confirm all four helpers exist on `game.arcflight`. Create a pending check using an Actor UUID and then a TokenDocument UUID; execute once each with Athletics or Perception. Use public then secret secrecy and compare `game.messages.size` before/after: each successful call creates exactly one respectively public or blind PF2e message. Inspect returned values for finite `result.total`, degree 0–3, correct slug, and no Actor, Statistic, Roll, dice, terms, or ChatMessage. Repeat with an unknown statistic and invalid runtime and confirm no message. Snapshot Actor, TokenDocument, encounter, and pending-check input before/after; the input remains `status: "pending"` and `result: null`. **Each successful call is a real roll: run it once per test case.**
