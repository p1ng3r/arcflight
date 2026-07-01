# Travel v2 GM How-To

Travel v2 is the Arcflight structured travel event runner. It supports GM-led travel events, station actions, pressure and consequences, round finalization, completed session summaries, final outcome review, and optional ship updates.

Travel v2 is intentionally review-first: it does not automatically mutate actor, item, chat, journal, combat, active-effect, socket, scene, token, compendium, or world state unless the GM clicks specific action buttons. Players see player-safe HUD, station, and mission information; GM workflow internals are GM-only.

## Core concepts

- **Travel event**: The data-driven Travel v2 event content the GM runs. It defines the situation, rounds, stations, approaches, possible pressure, consequences, and final outcomes.
- **Runner session**: The live or completed runtime state for one execution of a Travel v2 event.
- **Round**: A unit of travel play in the runner. Stations are resolved during a round, then the GM finalizes and advances when ready.
- **Station**: A player-facing area of responsibility or activity during the travel event.
- **Approach**: The selected station action or method used to resolve a station for the current round.
- **Roll / result**: The GM-recorded or system-assisted resolution for a station approach.
- **Pressure**: Event tension or progress that can be suggested, reviewed, and applied by the GM when appropriate.
- **Consequence queue**: Pending consequences that are reviewed and then applied or dismissed by the GM.
- **Final outcome**: The event-end outcome derived from the completed Travel v2 session.
- **Completed summary**: The stored final summary for a completed runner session, including copy/export output.
- **Final Outcome Package Review**: A GM review panel that summarizes the final outcome package, proposed effects, and deferred parts without updating ship resources by itself.
- **Apply Final Outcome to Ship**: A separate GM-only action that applies supported final-outcome ship-resource updates to the target ship when clicked.
- **GM Completion Checklist**: A GM-only checklist that reports which completion tasks are ready, blocked, already done, deferred, or review-only.
- **Player2 safety check**: A non-GM validation pass that scans player-visible UI, chat history, and player state for forbidden GM-only Travel v2 workflow or internal details.

## Normal GM workflow

1. Open the **Travel Event Runner** in Foundry.
2. Pick or load a Travel v2 event or an existing runner session.
3. Start the session.
4. Send or show the player-facing HUD, station cards, or mission board as applicable.
5. Players choose station approaches, or the GM records actions for the stations.
6. Resolve station rolls and results.
7. Review pressure and pending consequences.
8. Apply suggested pressure only when it is appropriate for the session.
9. Finalize the round.
10. Advance to the next round.
11. Repeat station choice, resolution, pressure, consequence, finalization, and advancement until the event is ready to complete.
12. Complete the event.
13. Review the **Final Summary**.
14. Copy Markdown or HTML if needed.
15. Optional: **Post Summary to Chat**.
16. Optional: **Create Journal Entry**.
17. Review the **Final Outcome Package**.
18. Optional: **Apply Final Outcome to Ship**.
19. Use the **GM Completion Checklist** to confirm what is complete, ready, blocked, already done, or deferred.

## Safety model

- Viewing previews, review panels, summaries, and checklists does not mutate the world.
- No actor, item, chat, journal, combat, active-effect, socket, scene, token, compendium, or world changes happen automatically.
- Mutations require specific GM action buttons.
- Applying the outcome package is distinct from applying ship-resource updates.
- Package-level application records do not mean ship resources were updated.
- Ship-resource application uses the separate final outcome ship application record.
- Non-GM and player state is redacted.
- Player2 validation should be run when testing player exposure.

## GM-only controls

These controls are GM-only. Review panels and copy actions are safe to inspect; mutating actions only run when the GM clicks the relevant action button.

| Control | What it does | Mutates world or session state? |
| --- | --- | --- |
| **Apply Suggested Pressure** | Applies reviewed pressure to the runner session when appropriate. | Yes, session state when clicked by GM. |
| **Finalize Round** | Marks the current round finalized after station resolution is ready. | Yes, session state when clicked by GM. |
| **Advance Round** | Advances the finalized session to the next round. | Yes, session state when clicked by GM. |
| **Apply Pending Consequence** | Applies a queued consequence selected by the GM. | Yes, session and/or target state when clicked by GM, depending on the consequence. |
| **Dismiss Pending Consequence** | Dismisses a queued consequence selected by the GM. | Yes, session queue state when clicked by GM. |
| **Complete Travel Event** | Completes the runner session and prepares completion review state. | Yes, session state when clicked by GM. |
| **Copy Markdown / Copy HTML** | Copies completed-summary output for handoff. | No world mutation. Clipboard only. |
| **Post Summary to Chat** | Creates chat output from the completed summary. | Yes, creates chat output only when clicked by GM. |
| **Create Journal Entry** | Creates a journal entry from the completed summary. | Yes, creates journal output only when clicked by GM. |
| **Apply Outcome Package** | Records package-level outcome application. | Yes, records package application state when clicked by GM; this does not mean ship resources were updated. |
| **Apply Final Outcome to Ship** | Applies supported final-outcome ship-resource updates to the resolved target ship. | Yes, target actor ship resources and final outcome ship application record when clicked by GM. |
| **GM Completion Checklist** | Shows completion readiness, blocked, already-done, deferred, and review-only statuses. | No world mutation from viewing the checklist. |

## Player-facing workflow

Players should see player-safe Travel v2 information such as station cards, HUD state, and mission board details when the GM exposes them. The player-facing workflow should help players understand the current travel situation, station choices, mission context, and safe public results.

Players should not see GM workflow internals, including GM queues, application records, final outcome ship-apply controls, raw records, before/after values, target actor internals, disabled-reason internals, or the GM Completion Checklist. Non-GM state is redacted so player views do not expose raw application records, final-outcome ship application controls, or other GM-only Travel v2 workflow terms.

## Completed session workflow

Completed sessions can be loaded or reopened for review. The completed runner state keeps the final summary available for inspection, copy, and output.

After completion:

1. Open or reload the completed Travel v2 session.
2. Review the **Final Summary**.
3. Use **Completed Summary Output** to copy Markdown or HTML.
4. Optional: post the summary to chat.
5. Optional: create a journal entry.
6. Review **Final Outcome Package Review** for proposed effects and deferred package parts.
7. Optional: click **Apply Outcome Package** if the package-level outcome application should be recorded.
8. Optional: click **Apply Final Outcome to Ship** to update supported ship resources.
9. Review the **GM Completion Checklist** to verify which items are ready, blocked, already done, or deferred.

The Final Outcome Package Review is not the same as ship-resource application. Package-level application can record that the outcome package was applied, while ship-resource application uses the separate final outcome ship application record and updates supported ship resources only when the GM clicks **Apply Final Outcome to Ship**.

## Validation commands

Run these terminal checks from the repository root:

```bash
node scripts/dev/run-travel-v2-smoke.mjs
node scripts/dev/run-foundry-check-runner-smoke.mjs
```

Run this in the GM Foundry browser console:

```js
const gmResult = await CONFIG.arcflight.dev.runFoundryChecks({
  suite: "travel-v2",
  includeDomChecks: true,
  includeChatHistory: true,
  includePlayerSafetyChecks: true,
  includePermissionChecks: true,
  renderReport: true
});
gmResult;
```

Run this in the Player2 or non-GM Foundry browser console:

```js
const playerSafety = await CONFIG.arcflight.dev.runPlayerSafetyCheck({
  includeDomChecks: true,
  includeChatHistory: true,
  includePlayerStateChecks: true,
  renderReport: true
});
playerSafety;
```

Expected Player2 result:

- `ok === true`
- `failed === 0`
- `userIsGM === false`
- `scannedAsPlayer === true`
- no forbidden GM-only Travel v2 workflow or internal terms in the player DOM
- no GM-only controls visible
- no raw application records visible
- no final outcome ship apply controls visible

## Troubleshooting

- GM DOM warnings do not prove player exposure; run the Player2 check to inspect a non-GM view.
- Chat or sidebar history warnings may come from old chat messages; clear or delete old chat if needed, then rerun validation.
- If **Apply Final Outcome to Ship** is disabled, check the target ship, completed status, supported rows, duplicate application record, and GM permission.
- If **Final Outcome Package Review** is unavailable, verify the session is completed and a final outcome exists.
- If summary output is missing, verify the completed session summary exists.
- If Player2 sees GM-only terms, treat it as a blocker and do not merge or release.

## Release checklist

- Terminal smoke passed.
- Foundry check runner smoke passed.
- GM check passed.
- Player2 check passed.
- Completed session loaded successfully.
- Opening previews, reviews, summaries, or checklists caused no mutation.
- Package apply and ship apply are understood as separate actions.
