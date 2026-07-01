# Travel v2 Player-Side Validation Pass

Use these checks to distinguish GM DOM inspection from a true player/non-GM exposure check.

## GM account check

1. Start or reopen a completed Travel v2 session.
2. Confirm the GM can see the GM Completion Checklist, Final Outcome Package Review, Apply Final Outcome to Ship, and Completed Summary Output.
3. Run in the GM browser console:

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

GM DOM checks are labeled as GM-only scans. GM-only terms visible to a GM do not prove player exposure.

## Player2 / non-GM account check

1. Log in as Player2/non-GM in a second browser or private window.
2. Open the same world.
3. Make sure the player HUD, station card, and mission board are visible when applicable.
4. Run in the Player2 browser console:

```js
const playerSafety = await CONFIG.arcflight.dev.runPlayerSafetyCheck({
  includeDomChecks: true,
  includeChatHistory: true,
  includePlayerStateChecks: true,
  renderReport: true
});
playerSafety;
```

Expected result:

- `ok === true`
- `failed === 0`
- `userIsGM === false`
- `scannedAsPlayer === true`
- no forbidden GM-only Travel v2 workflow/internal terms in player DOM
- no raw application records or final-outcome ship-apply controls visible as player actions

When `includeChatHistory` is true, historical chat/sidebar matches are warnings so they are distinguishable from active player UI exposure.
