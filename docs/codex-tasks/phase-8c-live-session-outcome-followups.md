# Phase 8C Patch Notes — Live Session Outcome Follow-ups

This branch fixes the real Foundry runner shape discovered during PR #262 testing.

Live completed runner sessions may have:

- `status`
- `completedAt`
- `summary`
- `roundResults`

without having:

- `travelV2EventCompletion`
- `travelV2RoundResolutions`
- `travelV2PressureApplications`

The outcome package and follow-up system must treat that live completed session as valid, use `summary.suggestedFinalOutcome`, avoid counting unrun all-null rounds as Mixed, and surface follow-up candidates for Critical Success.
