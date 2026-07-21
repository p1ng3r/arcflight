# V3-003L Test Plan

Run the focused domain tests:

```bash
node --test tests/voyage/domain/station-selection.test.mjs tests/voyage/domain/station-selection-editing.test.mjs
```

Then run the repository's complete Node test suite before exposing the new
helpers through the public Foundry API.
