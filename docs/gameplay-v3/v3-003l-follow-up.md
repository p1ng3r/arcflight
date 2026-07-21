# V3-003L Follow-up Boundary

The domain helpers in this slice are intentionally not yet registered on
`game.arcflight` or `game.arcflight.devTools`. The next integration pass should
expose both helpers together after the repository's normal Node test suite has
confirmed the mutation contract:

- `applyVoyageEncounterStationActionSelectionChange`
- `applyVoyageEncounterStationActionSelectionClear`

Keeping registration separate prevents an unverified mutation surface from
being published through the Foundry API.
