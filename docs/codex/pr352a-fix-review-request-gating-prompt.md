# PR #352A Precision Fix Prompt

## Target

Fix only PR #352A on branch:

`codex/implement-#352a-benefit-display-state`

PR:

`https://github.com/p1ng3r/arcflight/pull/352`

Do not broaden scope. Do not start #352B or #352C.

## Problem To Fix

The current helper incorrectly treats `includeGmReview` as if it means a station benefit review was requested.

That is wrong.

`includeGmReview` means only:

> a GM-like user is allowed to receive GM review details if a review was actually requested.

It must not itself create a requested review state.

Also, a selected queue key alone must not create a ready review candidate. A ready candidate requires both:

1. an explicit selected queue key, and
2. an explicit review request flag.

## Files To Change

Change only these unless absolutely necessary:

- `scripts/helpers/travel-v2-station-benefit-use-review.js`
- `scripts/helpers/travel-v2-station-benefit-use-review.smoke.js`
- PR body / description on GitHub if available from Codex

Do not change docs, roadmap, prompts, templates, or unrelated files for this fix unless a test requires it.

## Required Code Fix

In `scripts/helpers/travel-v2-station-benefit-use-review.js`, split the concepts into separate helpers.

Use logic equivalent to:

```js
function useReviewRequested(input = {}, options = {}) {
  return REVIEW_FLAGS.some((key) => input?.[key] === true || options?.[key] === true);
}

function canIncludeGmReview(user, input = {}, options = {}) {
  return isGmLike(user) && (input.includeGmReview === true || options.includeGmReview === true);
}
```

Then:

- `includeGmReview` should never count as a review request.
- GM review state should require both `canIncludeGmReview(...)` and `useReviewRequested(...)`.
- A ready player selected candidate should require both a selected key and `useReviewRequested(...)`.
- Without the request flag, selected candidate should stay blocked / not ready with a clear reason such as `No station benefit use review was requested.`

## App Integration Rule

Keep the current app integration shape:

- `selectedQueueKey` comes from `uiState.travelV2StationBenefitUseReviewSelectedQueueKey`.
- `travelV2StationBenefitUseReviewRequested` comes from `uiState.travelV2StationBenefitUseReviewRequested === true`.
- `includeGmReview` may still be passed for GM-like users, but it must only gate GM visibility.

## Required Smoke Additions

Add or update smoke coverage for these exact cases:

1. selected queue key without request flag stays blocked / not ready.
2. GM user with `includeGmReview: true` but no request flag does not get GM review state.
3. GM user with `includeGmReview: true` plus explicit request flag may get GM review state.
4. player state with selected key plus explicit request flag still gets a ready review-only candidate.
5. app render-state integration does not add GM review state when only `includeGmReview` is true.

Keep the existing smoke coverage.

## PR Body Fix

Update the PR body to include a real heading:

```md
### Agent Checks

- Roadmap / Scope Agent: PASS
- Helper / Runtime Agent: PASS
- UI / Player Flow Agent: WATCH — no visible UI added in #352A; visible display is deferred to #352B.
- Foundry / PF2E System Compatibility Agent: PASS
- Safety / Leak Audit Agent: PASS
- Smoke Test Agent: PASS
```

Do not leave the agent checks only inside a paragraph.

## Tests To Run

Run and report:

```bash
git diff --check
node --check scripts/helpers/travel-v2-station-benefit-use-review.js
node --check scripts/helpers/travel-v2-station-benefit-use-review.smoke.js
node --check scripts/apps/travel-event-runner-v2-preview-consumer.js
node scripts/helpers/travel-v2-station-benefit-use-review.smoke.js
node scripts/dev/run-travel-v2-smoke.mjs
node scripts/dev/run-foundry-check-runner-smoke.mjs
```

## Acceptance Criteria

This fix is complete only when:

- `includeGmReview` no longer creates a request.
- selected key alone no longer creates a ready candidate.
- request flag plus selected pending key creates a ready review-only candidate.
- GM review requires GM-like user, visibility permission, and explicit request.
- no visible UI/template changes are added.
- no real use/apply/check/roll/DC behavior is added.
- smoke tests cover the bug and pass.
- PR body has a dedicated `### Agent Checks` section.
