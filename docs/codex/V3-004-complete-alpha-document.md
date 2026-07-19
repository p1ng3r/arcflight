# V3-004 — Complete the Voyage Event Alpha Design Document

**Codex mode:** Code  
**Repository:** `p1ng3r/arcflight`  
**Working branch:** Use the branch recommended and approved after V3-003.

Do not run this task until the V3-003 audit has been reviewed.

Copy everything below this line into Codex.

---

TASK ID: V3-004
TITLE: Complete the Arcflight Voyage Event alpha design document

Read first:
- AGENTS.md
- docs/voyage-event-alpha-scope.md
- the accepted V3-003 audit result

Goal:
Repair and complete docs/voyage-event-alpha-scope.md. The current repository document ends partway through the Station Card UI section and is missing the remainder of the accepted alpha scope.

This task is documentation-only. Do not change runtime code, data registries, templates, CSS, localization, module.json, or scripts.

Preserve all existing accepted decisions and complete the missing material for:
- remaining Station Card fields;
- Station Action Panel;
- Active Station Resolution panel;
- Ship Status panel;
- Round Resolution panel;
- Aftermath panel;
- artwork-role rules;
- UI component naming and editing requirements;
- GM controls;
- multiplayer authority;
- persistence and recovery;
- import and export;
- two bundled alpha events;
- alpha acceptance criteria;
- alpha definition of done.

Required rules:
- Target Foundry VTT v14 and PF2e.
- Keep exactly three long-term gameplay pillars: Voyage Events, Arcflight Combat, and Vessel Development.
- Alpha implements Voyage Events only, with defined interface hooks to the other two pillars.
- Alpha includes five active Voyage Event stations: Captain, Engineer, Navigator, Watchmaster, and Veilwarden.
- Do not delete Pilot, Gunnery, or Quartermaster from the broader station framework.
- Alpha includes two fully playable bundled events.
- Every important UI region must have a stable component ID, CSS class convention, localization key convention, data path, and optional labeled artwork role.
- UI remains playable without art.
- No live AI connection is required for alpha.
- Alpha narrative uses imported branching components and deterministic vignette composition.
- Momentum is excluded from alpha.
- Permanent consequences are staged for GM review before application.
- Do not add executable event-specific code.

Document-quality checks:
- headings are complete and consistently numbered;
- no section ends mid-list or mid-sentence;
- no duplicate contradictory rules remain;
- every required UI screen is named;
- every major UI region supports an optional artwork role;
- the final section contains an explicit acceptance checklist and definition of done.

Out of scope:
- no runtime implementation;
- no schema implementation;
- no event content implementation;
- no tests;
- no branch operations;
- no pull request.

Return:
- concise summary;
- changed-file list;
- list of restored sections;
- unresolved contradictions, if any;
- confirmation that only documentation changed.
