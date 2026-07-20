# V3-007D — Add Strict Normal Voyage Event Phase Advancement

**Codex mode:** Code  
**Repository:** `p1ng3r/arcflight`  
**Starting branch:** latest `rebuild/arcflight-voyage-events-alpha` after V3-007C is merged

Tell Codex:

`Read AGENTS.md and perform the task in docs/codex/V3-007D-phase-advancement.md.`

---

TASK ID: V3-007D  
TITLE: Add strict GM-authoritative normal phase advancement

## DEPENDENCY

V3-007A through V3-007C must already be reviewed and merged. Consume the established pure transition policy and extend the one existing lifecycle manager.

## READ FIRST

- `AGENTS.md`
- `docs/codex/V3-007-voyage-event-lifecycle-manager.md`
- `docs/codex/V3-007A-lifecycle-policy.md`
- `docs/codex/V3-007B-start-active-event.md`
- `docs/codex/V3-007C-pause-resume.md`
- `docs/voyage-event-v3-decisions.md`
- `docs/voyage-event-persistence.md`
- `docs/voyage-event-lifecycle-policy.md`
- `docs/voyage-event-lifecycle-manager.md`
- `scripts/voyage-events/constants.js`
- `scripts/voyage-events/persistence.js`
- `scripts/voyage-events/lifecycle-policy.js`
- `scripts/voyage-events/lifecycle-manager.js`

## GOAL

Add one strict operation for ordinary forward movement through the accepted phase sequence. This operation changes only `phase`; it does not evaluate station completion, score rounds, execute effects, or perform the special new-round reset.

## REQUIRED PUBLIC API

Add a stable equivalent of:

```js
advanceVoyageEventPhase(shipActor, nextPhase, options)
```

Reuse the lifecycle policy, error class, error codes, and persistence layer.

## OPTIONS

Require `options.expectedRevision`. Pass through supported persistence values:

- `user`;
- `userId`;
- `timestamp`.

Do not add force, skipValidation, allowBackward, allowSkip, allowRoundBoundary, or skipRevision options.

## REQUIRED BEHAVIOR

Before any write:

1. Defensively read the active runtime.
2. Reject missing active state with `ACTIVE_REQUIRED`.
3. Reject a paused runtime with `PAUSED`.
4. Reject an unknown `nextPhase` with `PHASE_INVALID`.
5. Classify `currentPhase -> nextPhase` through `getVoyageEventTransitionKind`.
6. Reject the special `nextRoundPreparation -> roundOpening` edge with `ROUND_BOUNDARY_REQUIRED`; V3-007E owns that mutation.
7. Reject every other non-normal edge with `TRANSITION_INVALID`.
8. For a normal edge, create an independent candidate that differs only by `phase` before persistence revision/update stamping.
9. Persist through `persistActiveVoyageEvent` with the exact expected revision.
10. Return the fresh persisted active runtime.

Error details for invalid transitions must be serializable and include only safe values such as current phase, requested phase, transition kind, and allowed normal next phases.

## NORMAL EDGES

The operation accepts only the normal edges established by V3-007A:

- `setup -> opening`
- `opening -> roundOpening`
- `roundOpening -> crewPlanning`
- `crewPlanning -> orderLock`
- `orderLock -> stationResolution`
- `stationResolution -> roundResolution`
- `roundResolution -> endRoundVignette`
- `endRoundVignette -> nextRoundPreparation`
- `nextRoundPreparation -> eventResolution`
- `eventResolution -> aftermathReview`

It must reject self transitions, backward movement, skipped phases, unknown phases, the new-round edge, and any move into `archive`.

## INVARIANTS

- Preserve every runtime field except phase/update metadata/revision.
- Do not append audit entries for ordinary legal advancement.
- Do not infer whether another round remains; callers choose either later round advancement or event resolution.
- Do not enforce station order, action completion, result completeness, narrative posting, or scoring prerequisites in this slice.
- Perform exactly one persistence-layer Actor update on success and none on precondition failures.

## DOCUMENTATION

Update lifecycle-manager documentation with:

- exact API and options;
- accepted normal edge table;
- paused behavior;
- special round-boundary rejection;
- error codes/details;
- revision and one-write behavior;
- exact manual Foundry console inspection steps.

## MANUAL FOUNDRY INSPECTION TO DOCUMENT — DO NOT RUN IN CODEX

Document checks that:

1. Missing active runtime rejects without a write.
2. `setup -> opening` succeeds and increments revision once.
3. Every runtime field except phase/update metadata/revision is preserved.
4. A self transition rejects without a write.
5. A skipped transition rejects without a write.
6. A backward transition rejects without a write.
7. An unknown phase rejects without a write.
8. `nextRoundPreparation -> roundOpening` rejects with `ROUND_BOUNDARY_REQUIRED` without a write.
9. Advancement while paused rejects without a write.
10. A stale expected revision rejects without a write.
11. A non-GM call is rejected by persistence without a write.
12. Sibling Arcflight flags remain unchanged.

## OUT OF SCOPE

- no new-round index increment or reset;
- no phase-readiness/gameplay prerequisite enforcement;
- no GM override or audit entry;
- no archive, clear, or abort operation;
- no station choices, order, rolls, scoring, bids, rewards, dangers, effects, Pressure, Hazards, narrative, sockets, player requests, UI, hooks, registration, catalogs, or content;
- no automated tests, Foundry run, branch operation, or pull request.

## ACCEPTANCE CRITERIA

1. Only policy-classified normal edges succeed.
2. Paused runtimes cannot advance normally.
3. New-round edge is rejected with its dedicated code.
4. Invalid, skipped, backward, self, unknown, and archive edges do not write.
5. Success changes only phase/update metadata/revision.
6. Persistence enforces GM authority and exact revision.
7. Success performs one Actor update and increments once.
8. Existing start/pause/resume behavior remains unchanged.
9. No gameplay readiness logic is invented.
10. `git diff --check` passes.

## FINAL RESPONSE

Return:

- concise summary;
- complete changed-file list;
- exact export and options;
- accepted/rejected transition behavior;
- preservation, authority, and revision behavior;
- errors;
- assumptions;
- exact manual Foundry inspection steps;
- known limitations;
- `git diff --check` result;
- confirmation that no round reset, override, archive, gameplay mechanics, UI, sockets, tests, branch operations, or pull request were added.
