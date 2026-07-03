# Travel v2 Station Benefit Display Use Review

PR #352A adds the state foundation for player-safe pending station benefit display and selected-benefit review. It intentionally does not add visible template changes, real use actions, roll/check/DC changes, or Foundry document writes.

## Helper

`scripts/helpers/travel-v2-station-benefit-use-review.js` consumes the pending station benefit queue state from PR #351 and exports:

- `TRAVEL_V2_STATION_BENEFIT_USE_REVIEW_VERSION`
- `normalizeTravelV2StationBenefitUseReviewInput`
- `prepareTravelV2StationBenefitDisplayRows`
- `prepareTravelV2StationBenefitUseReviewPlayerState`
- `prepareTravelV2StationBenefitUseReviewGmState`
- `applyTravelV2StationBenefitUseReviewToRenderState`

## Render State

The preview consumer now adds:

- `travelV2StationBenefitUseReviewPlayerState` for all users.
- `travelV2StationBenefitUseReview` only for GM-like users when review is requested.

A selected row is read from `travelV2StationBenefitUseReviewSelectedQueueKey` / `selectedQueueKey`, and review gating uses `travelV2StationBenefitUseReviewRequested`.

## Safety

Player-facing state contains display rows and a selected review-only candidate. Missing, unknown, malformed, used, dismissed, expired, blocked, or otherwise non-pending selections return a blocked candidate instead of an action result.

All output is clone-safe and inert. The helper does not create real use results, apply modifiers, change DCs, roll checks, write flags, emit sockets, or mutate Foundry documents.
