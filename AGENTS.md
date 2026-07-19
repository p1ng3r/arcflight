# Arcflight Agent Guardrails

## Repository and Target

- Repository: `p1ng3r/arcflight`.
- Current planning branch: `rebuild/arcflight-gameplay-v3`.
- Target Foundry VTT version: v14.
- Target game system: Pathfinder Second Edition (PF2e).
- Read `docs/voyage-event-alpha-scope.md` before any Voyage Event work.

## Working Method

- Work in small, reviewable tasks with one clear goal.
- Do not merge, rebase, reset, delete branches, push, or open pull requests unless the user explicitly requests that exact action.
- Do not modify unrelated files.
- Do not run Foundry, launch a browser, or claim runtime verification.
- Do not tell the user that automated tests passed unless they were actually run by the user.
- End every coding task with:
  - a concise summary;
  - every changed file;
  - assumptions made;
  - exact manual Foundry validation steps;
  - known limitations or unfinished work.

## Architecture Boundaries

- Preserve normal PF2e documents.
- PF2e vehicle Actors remain Arcflight ships.
- PF2e equipment Items remain Arcflight components.
- Arcflight-owned data belongs under `flags.arcflight`.
- Do not register custom Actor or Item document subtypes.
- Do not mutate PF2e-owned `system` data.
- Do not mutate source or compendium Items when installing or using Arcflight content.
- Prefer plain serializable data, stable identifiers, and registry-driven mechanics.
- Do not add executable JavaScript, macros, or HTML event handlers inside imported Voyage Event packages.
- Do not introduce a bundler, frontend framework, package manager, or build pipeline unless a later approved task explicitly requires one.
- Do not bump the module version unless explicitly requested.

## Approved Gameplay Pillars

The long-term Arcflight architecture has only these three gameplay pillars:

1. Voyage Events
2. Arcflight Combat
3. Vessel Development

Do not create an additional pillar without explicit approval.

The current alpha implementation focuses on **Voyage Events**. Arcflight Combat and Vessel Development receive only clearly defined interface hooks needed by Voyage Events.

## Voyage Event Alpha Rules

- Alpha must be a complete table-playable system demonstrated by two bundled events.
- Standard Voyage Events use these five active stations:
  - Captain
  - Engineer
  - Navigator
  - Watchmaster
  - Veilwarden
- Do not delete or repurpose existing Pilot, Gunnery, or Quartermaster station definitions.
- Players arrange station order every round.
- Station order is authoritative after the Captain or GM locks it.
- Unresolved stations may revise tentative choices when activated.
- Each station action offers exactly three authored PF2e skills.
- Available Difficulty Bids are No Bid, `+2`, `+5`, and `+8`.
- No Bid grants no additional mechanical reward.
- Bid rewards and dangers come from centralized validated catalogs.
- Rewards may create downstream benefits for later stations.
- Ordinary station Success contributes to the ship result but does not automatically award cards, Momentum, or unrelated bonuses.
- Station degree values are:
  - Critical Failure: `-2`
  - Failure: `-1`
  - Success: `+1`
  - Critical Success: `+2`
- Round and event result matrices must follow the accepted design document.
- Momentum is not part of alpha unless a later approved decision gives it a distinct role.
- Focus, Pressure, Hazards, downstream effects, narrative flags, and event history are event-local state unless explicitly staged for aftermath.
- Permanent consequences are staged for GM review before application.

## Narrative and AI Boundary

- Alpha uses imported, pre-authored branching narrative components.
- Arcflight mechanics determine what happened.
- Narrative components describe authoritative results; they do not alter mechanics.
- The narrative composer must be deterministic and preserve the exact posted vignette.
- Live AI integration is future work and must not be required to run alpha events.
- Event-specific narrative may reference stable reward, danger, Hazard, flag, and artwork identifiers but may not contain executable mechanics.

## UI Requirements

- Voyage Event UI should use Foundry v14-compatible ApplicationV2 patterns where appropriate.
- Do not replace normal PF2e sheets.
- Every major UI region must have:
  - a stable developer-facing component name;
  - a stable ID;
  - a stable CSS class;
  - a localization key;
  - an associated data path;
  - a labeled optional artwork role;
  - a visible empty state.
- Do not identify important regions only as left, right, top, or bottom.
- Do not hardcode important player-facing text in JavaScript.
- UI must remain playable when no artwork is supplied.

## Multiplayer and Persistence

- The GM client owns authoritative Voyage Event state.
- Player clients submit requests that are validated against phase, permissions, and revision.
- Prevent duplicate station resolution from stale requests or double clicks.
- Persist after meaningful state transitions.
- Events must recover after refresh, reconnect, Foundry restart, and session interruption.
- Every GM override must be recorded with user and timestamp.

## Existing Foundation

- Reuse existing ship flags, station assignments, PF2e vehicle architecture, sheet-registration patterns, and helper conventions where compatible.
- Extend existing helpers rather than creating duplicate competing systems.
- Keep current framework behavior functional while adding Voyage Events.

## Task Scope Discipline

For every task:

- Read the task-specific file under `docs/codex/` when one is named.
- Implement only the requested task.
- Treat all explicitly listed out-of-scope items as prohibited.
- Avoid speculative future abstractions unless they are required by the current acceptance criteria.
- Prefer a clear incomplete result over silently inventing rules that are not in the design document.
