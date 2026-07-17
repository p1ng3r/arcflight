# TV2-003 Foundry Table Verification

## Status

Automated acceptance is available for the TV2-003 table UX path, but real Foundry/browser verification remains required. TV2-003 must not be marked complete until the required checks below pass in Foundry v14 or any blockers are recorded and tracked separately.

## Environment Record

- Verifier:
- Date:
- Arcflight commit SHA:
- Foundry version: v14 target
- PF2e system version:
- Browser and version:
- Operating system:
- Module list relevant to the test:
- World name or disposable test-world identifier:

## Pre-flight

- [ ] Clean module reload completed.
- [ ] No console errors appear when opening the Travel Event Runner.
- [ ] GM account and separate non-GM player account are available.
- [ ] Travel v2 session has navigator, engineer, and watchmaster active.
- [ ] Browser devtools console is open for side-effect and error watch.
- [ ] Runner is approximately at its normal 820 × 720 size.
- [ ] A narrower resized runner test is prepared.
- [ ] Focused table acceptance smoke passed locally: `node scripts/apps/travel-event-runner-v2-round-action-order-table-acceptance.smoke.js`.
- [ ] Aggregate Travel v2 smoke passed locally: `node scripts/dev/run-travel-v2-smoke.mjs`.
- [ ] Foundry check runner smoke passed locally: `node scripts/dev/run-foundry-check-runner-smoke.mjs`.

## Scenario A — Initial Guidance

- [ ] Needs Decision label appears when there is no valid authored station order.
- [ ] Proposed Order label appears when the authored order is valid but not committed.
- [ ] Captain final-say guidance is visible before commitment.
- [ ] Canonical station sequence is readable.
- [ ] Controls do not overlap or clip at the normal runner size.
- [ ] Controls do not overlap or clip at the narrower runner size.
- [ ] GM sees reorder controls when three candidate rows are available.
- [ ] Non-GM player sees canonical player-safe information.
- [ ] Non-GM player does not see candidate reorder controls.

## Scenario B — Keyboard Reorder

- [ ] Move Up moves an eligible candidate row upward.
- [ ] Move Down moves an eligible candidate row downward.
- [ ] First-row Move Up is disabled.
- [ ] Final-row Move Down is disabled.
- [ ] Candidate order updates locally after keyboard movement.
- [ ] Comparison/review display reflects the local candidate order.
- [ ] Reset Proposed Order clears the local candidate review.
- [ ] Canonical order remains unchanged until explicit commit.
- [ ] Keyboard focus remains usable after movement.
- [ ] Scroll position does not jump to an unusable location after rerender.

## Scenario C — Handle Drag

- [ ] Grab cursor appears on the handle only.
- [ ] Station text does not start drag.
- [ ] Move Up buttons do not start drag.
- [ ] Move Down buttons do not start drag.
- [ ] Drag handle can move a row upward.
- [ ] Drag handle can move a row downward.
- [ ] Same-position drop does nothing harmful.
- [ ] Drop over content nested in another row still resolves correctly.
- [ ] Drop outside the list does not reorder.
- [ ] Candidate review updates after a valid handle drop.
- [ ] Drag does not automatically commit.
- [ ] Drag does not automatically persist.
- [ ] Keyboard fallback remains usable after drag.
- [ ] No browser console errors appear during drag testing.

## Scenario D — Commit, Persist, and Reload

- [ ] Commit Reviewed Order explicitly commits the reviewed candidate.
- [ ] Committed status appears after explicit commit.
- [ ] Committed sequence matches the reviewed order.
- [ ] Candidate controls close after commit.
- [ ] Explicit persistence control is available to the GM.
- [ ] Save/reload keeps the committed order.
- [ ] Duplicate commit does not create duplicate state.
- [ ] Duplicate persistence does not create duplicate state.
- [ ] No actor changes occur.
- [ ] No item changes occur.
- [ ] No chat messages are created.
- [ ] No journals are created.

## Scenario E — Unlock and Recommit

- [ ] Unlock uses a confirmation dialog.
- [ ] Unlock succeeds before station results begin.
- [ ] Status returns to open/proposed as designed.
- [ ] Captain guidance returns after unlock.
- [ ] Keyboard reorder works after unlock.
- [ ] Handle drag works after unlock.
- [ ] Recommit works after a new candidate is reviewed.
- [ ] Prior audit/history remains after recommit.
- [ ] Unlock is blocked after a station result begins.
- [ ] Stale candidate controls do not remain visible after blocked reconsideration.

## Scenario F — Player View and Accessibility

- [ ] Player never sees GM candidate rows.
- [ ] Player never sees unlock controls.
- [ ] Player never sees reset controls.
- [ ] Player never sees commit controls.
- [ ] Player never sees persistence controls.
- [ ] Canonical committed order is visible to the player.
- [ ] Tab navigation reaches keyboard controls in logical order for the GM.
- [ ] Visible focus treatment is present.
- [ ] Control labels are understandable.
- [ ] Reduced-motion operating-system setting produces no row movement animation.
- [ ] Layout remains readable at normal runner size.
- [ ] Layout remains readable at narrow runner size.

## Scenario G — Side-effect Watch

- [ ] No unexpected socket messages occur.
- [ ] No unexpected chat messages occur.
- [ ] No unexpected journals are created.
- [ ] No unexpected actor updates occur.
- [ ] No unexpected item updates occur.
- [ ] No rolls occur.
- [ ] No result changes occur.
- [ ] No pressure changes occur.
- [ ] No round advancement occurs.
- [ ] No console errors occur.

## Results

| Scenario | Pass / Fail | Blocker or Notes | Evidence / Screenshot |
| --- | --- | --- | --- |
| A — Initial Guidance |  |  |  |
| B — Keyboard Reorder |  |  |  |
| C — Handle Drag |  |  |  |
| D — Commit, Persist, and Reload |  |  |  |
| E — Unlock and Recommit |  |  |  |
| F — Player View and Accessibility |  |  |  |
| G — Side-effect Watch |  |  |  |

## Completion Gate

TV2-003 can move from:

`code-complete / Foundry verification pending`

to:

`complete for alpha table UX`

only after:

- [ ] All required scenarios pass.
- [ ] Failures are fixed or separately tracked.
- [ ] The verification record includes environment details and commit SHA.
- [ ] Aggregate and Foundry smoke suites pass on the verified commit.

Do not add invented verification results or screenshots to this checklist.
