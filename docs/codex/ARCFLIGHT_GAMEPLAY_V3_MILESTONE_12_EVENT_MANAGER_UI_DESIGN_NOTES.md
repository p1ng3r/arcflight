# Arcflight Gameplay V3 - M12 Event Manager UI Design Notes

This is a non-normative UX and component-design companion for the M12 Event
Manager. Canonical gameplay and runtime contracts always win if these notes
conflict with them. This document does not define command schemas, authority,
persistence, or gameplay semantics.

## Current Event Manager UI Design Notes

1. **Rerender continuity - high priority**

   Successful commands rerender the Application. Future UI work should preserve
   the active tab, scroll position, focused station, and focused control where
   practical, using targeted rendering or capture/restore around an authoritative
   rerender. Persisted Event Session state remains authoritative.

2. **Tabbed Event Manager - high priority**

   Planned conceptual tabs are Overview, Crew Plan, Resolution Order, Plan
   Review, Resolution (future Task 3+), and History / Audit (future).
   Tab state is UI navigation state, never gameplay authority.

3. **Modals / popups**

   Focused dialogs may later hold action details, longer rules, Plan Lock review,
   and reaction/focus decisions. Trivial selections should remain inline.

4. **Drag-and-drop order**

   Draggable station/action cards are the primary order interaction. DOM order is
   never authoritative: drop dispatches `station-order`, persists, verifies by
   reread, and rerenders from the persisted session.

5. **Incomplete / ready visual states**

   Station cards expose canonical planning state through stable semantic hooks:
   `incomplete`, `approach-required`, `ready`, and `locked` where applicable.
   Risk Bid is optional because No Bid is canonical.

6. **Action / approach / Risk Bid language**

   Action asks, “What are we doing?” Approach asks, “How are we doing it?” Risk
   Bid asks, “How hard are we pushing?” The UI communicates these distinctions
   with concise helper text and tooltips.

7. **Art-ready semantic components**

   Significant regions use stable classes, `data-component` hooks, and stable
   station/action identity attributes so future presentation artwork can attach
   without restructuring command logic.

8. **Post-Plan-Lock presentation**

   A future UI pass should hide, lock, or replace planning controls after Plan
   Lock. Runtime rejection remains authoritative meanwhile.

9. **Station clear / order consistency**

   Clearing a selection removes action, approach, and Risk Bid state but preserves
   the occupied station in the persisted order. Station-order participation is
   defined by canonical occupied station assignments, so the cleared station
   remains a required incomplete position rather than creating an invalid order.

10. **Alpha UI principle**

   Prioritize readability, obvious state, few clicks, minimal scrolling, durable
   persistence, clear failures, and art-ready modular structure before decorative
   complexity.

## Design Notes Status

### IMPLEMENTED

- M12 Task 1 live dashboard
- persisted crew planning
- three actions per station
- Approach
- Risk Bid
- drag/drop resolution order
- tabbed Event Manager shell
- active-tab preservation across in-app rerender
- scroll/station continuity
- Plan Review
- clearer Resolution Order presentation

### IN CURRENT FIX

- Clear-selection correctness
- explicit incomplete station state
- Action / Approach helper language
- stable semantic UI hooks

### PLANNED UI PASS

- richer post-lock presentation and optional tab-specific artwork

### FUTURE M12

- Task 3 resolution UI
- reaction / Focus UI
- round closeout
- history / audit UX

## Scope and Deferred Validation

The current Event Manager is GM-facing. Player-facing controls will later
reuse the canonical domain commands; they are not built here. The deferred
New Event launch regression (real Foundry launch reports that the Event
Session write did not complete or verify while the existing session remains
intact) is recorded for resolution before the Task 2 commit or merge. It is
outside this navigation-only pass. Canonical gameplay contracts override
these non-normative notes.
