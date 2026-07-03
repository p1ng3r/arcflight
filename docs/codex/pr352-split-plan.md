# PR #352 Split Plan

This plan keeps the roadmap numbering stable.

Roadmap #353 remains Round Action Order State.
Roadmap #354 remains Station Combo Runtime v1.

PR #352 is split into smaller lettered Codex passes:

1. **#352A — Station Benefit Display State Foundation**
   - Helper logic.
   - Player-safe display rows.
   - Review-only selected candidate state.
   - Render-state integration.
   - Docs and smoke.
   - No visible template rewrite.

2. **#352B — Visible Pending Benefit Display Surface**
   - Use the #352A state.
   - Add the smallest existing UI/template surface for display only.
   - No request/action transport.
   - No real use/apply behavior.

3. **#352C — Review Request UI Shell**
   - Add narrow request/review controls if #352B found a safe UI surface.
   - Controls create only ephemeral review intent in app/ui state.
   - No persistent use record.
   - No roll/check/DC changes.

After #352C, continue to roadmap #353 as planned.

If a pass cannot find a safe small UI surface, it should mark UI / Player Flow Agent as WATCH and stop instead of broadening scope.

All #352 lettered prompts must require:

- Roadmap / Scope Agent
- Helper / Runtime Agent
- UI / Player Flow Agent when display/UI is touched
- Foundry / PF2E System Compatibility Agent
- Safety / Leak Audit Agent
- Smoke Test Agent
