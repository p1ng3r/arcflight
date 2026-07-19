# V3-003 — Audit Arcflight V3 Branch Readiness

**Codex mode:** Ask  
**Repository:** `p1ng3r/arcflight`  
**Working branch:** `rebuild/arcflight-gameplay-v3`

Copy everything below this line into Codex.

---

TASK ID: V3-003
TITLE: Audit Arcflight V3 branch readiness

Repository: p1ng3r/arcflight
Working branch: rebuild/arcflight-gameplay-v3

Read first:
- AGENTS.md
- docs/voyage-event-alpha-scope.md

This is a read-only architecture and branch audit.

Do not modify, create, delete, commit, merge, rebase, reset, push, or open a pull request. Do not run tests or launch Foundry.

Inspect:
- main
- rebuild/arcflight-gameplay-v3
- docs/voyage-event-alpha-scope.md
- module.json
- scripts/arcflight.js
- scripts/sheets/registration.js
- data/stations/core-stations.js
- data/station-actions/core-station-actions.js
- existing ship flag, station-assignment, install-state, and persistence helpers

Goals:
1. Determine how rebuild/arcflight-gameplay-v3 differs from main.
2. Identify whether main contains foundation work that the rebuild branch needs.
3. Confirm whether docs/voyage-event-alpha-scope.md is incomplete or truncated.
4. Map current files and helpers Voyage Events should reuse.
5. Identify conflicts between the existing framework and the accepted Voyage Event design.
6. Recommend the safest implementation-base strategy, but do not execute it.
7. Recommend the initial file and folder structure for Voyage Events.
8. Identify helpers that should be extended instead of duplicated.
9. Identify any Foundry v13 assumptions that remain and must be corrected for v14.
10. Confirm that Captain, Engineer, Navigator, Watchmaster, and Veilwarden can be treated as the Voyage Event active subset without deleting Pilot, Gunnery, or Quartermaster.

Constraints:
- Target Foundry VTT v14 and PF2e.
- Preserve PF2e vehicle and equipment document architecture.
- Do not recommend custom Actor or Item document types.
- Arcflight-owned runtime data remains under flags.arcflight.
- Do not introduce a bundler, framework, package manager, or build pipeline.
- Do not recommend event-specific executable code.
- Do not run tests.

Return:
A. Branch comparison summary.
B. Design-document integrity report.
C. Reusable architecture map.
D. Conflict and risk list.
E. Recommended base-branch strategy.
F. Proposed Voyage Event folder structure.
G. Exact recommendation for V3-004.
H. Confirmation that no files were changed.
