# T-22A Inspect SQL Visual QA Audit

## Review Method

This was a manual, code-informed visual QA review of the polished Inspect SQL workspace after T-20 and T-21. No screenshots were captured in this slice because the repo does not currently expose a Playwright, screenshot, Storybook, Chromatic, or visual regression script in `frontend/package.json`.

The review focused on the implemented component structure and responsive CSS for the main Inspect SQL surface and focused detail views.

## Viewports And States Reviewed

- Main Inspect SQL desktop/laptop view.
- Main Inspect SQL tablet/narrow view.
- Main Inspect SQL mobile/narrow behavior based on responsive rules.
- Relationship-blocked Ask result.
- Review worksheet connections focused view.
- Planning details focused view.
- Schema rail open.
- Schema rail collapsed.
- Command bar ready state.
- Command bar warning/no-draft state based on readiness warning layout.

## What Looks Good

- The main action surface is much calmer after T-20/T-21: Ask, worksheet context, source/scope, commands, planning status, and editor now read as a compact workflow.
- Ask row is compact on desktop and stacks intentionally on narrow screens.
- Worksheet pills avoid the old full-card vertical weight, and long names/hints now truncate or wrap safely.
- Relationship-blocked Ask output is visually focused: worksheet context plus one blocker/action.
- Source/scope remains visible and keeps Manage scope / Change source accessible when wrapping.
- Command bar keeps Run query visible and manual, with lower-priority actions wrapping after it.
- Readiness warnings remain visible without owning the whole command row.
- Planning status is appropriately slim for the main action surface.
- Schema rail remains useful on desktop and is bounded on tablet/mobile so it does not become a large full-height section.
- Focused detail views now have safer mobile stacking for headers, badges, relationship cards, planning cards, tables, and code blocks.
- Back actions remain near the top in focused detail views.

## Visual Issues Found

- The top gradient banner is still the largest remaining vertical element before the editor. On mobile, it likely delays editor visibility more than the polished Ask/source/command rows do.
- There is still duplicate framing above the editor: the gradient banner says `Inspect SQL`, then the compact page head says `Write and run SQL`. This may feel redundant after the workspace polish.
- Planning status wording can read repetitive: `Planning details available` plus a status such as `Planning details`. This is not broken, but it could be simplified.
- The schema rail is compact and accessible, but it is still open by default on narrow screens. A later state-aware auto-collapse may make the first mobile view feel lighter.
- Extremely narrow command layouts may still benefit from a deliberate overflow/priority pattern, but Run query should remain visible and not be hidden in a menu.
- Some technical labels remain by design, such as `Deterministic`, dialect names, and relationship metadata phrasing. They are controlled, but a business-user copy pass could decide whether to soften them further.

## State Notes

### Main Desktop/Laptop

The editor is visually closer to the top than before T-20. The schema rail beside it is aligned and useful. The remaining top-banner/header stack is the clearest opportunity if the goal is to make the editor feel even more central.

### Tablet/Narrow

The one-column workspace avoids horizontal squeeze. Ask/source/command/planning rows wrap cleanly, and the schema rail is bounded. The page should remain usable, but vertical rhythm still depends heavily on whether the top banner stays visible.

### Mobile/Narrow

The mobile rules stack Ask, source/scope, command actions, planning status, and detail views cleanly. The main remaining concern is vertical distance to the editor when the top banner, page head, Ask results, and schema section are all present.

### Relationship-Blocked Ask

The compact blocker structure is appropriate. It keeps the review action visible without reintroducing full worksheet cards or planning internals.

### Focused Detail Views

Planning details, relationship review, result preview, saved drafts, and draft detail now have better narrow-screen behavior. Cards/grids stack, action rows become tappable, and table/code areas keep scrollable bounds.

## Remaining Polish Recommendations

- T-22B: Top banner/header height polish. Reduce or conditionally compact the gradient banner and duplicate header copy on the Inspect SQL page, especially for mobile.
- T-22C: Mobile visual polish if needed. Use actual screenshots or browser viewport testing to tune spacing after banner/header decisions.
- T-22D: Schema rail visual refinement if needed. Consider state-aware auto-collapse on small screens only after confirming it will not surprise users or reset manual rail state.
- Stop if visual QA with real screenshots shows the current layout is acceptable; the remaining issues are polish, not blocking behavior.

## Safety Boundaries Confirmed

- Run Query remains visible and manual.
- Insert SQL remains explicit and guarded.
- Relationship blockers remain visible and route to Review worksheet connections.
- Source/scope context remains visible.
- Schema access remains available.
- Planning and relationship detail views remain accessible.
- No backend/API/provider calls were added.
- No SQL generation, execution, ranking, source/scope state, relationship persistence, or Business SQL planner/renderer behavior changed.

## Recommended Next Slice

Proceed with T-22B if further polish is desired. The strongest visual opportunity is reducing the Inspect SQL top banner/header height and duplicate framing so the editor becomes visible even sooner, especially on mobile and laptop-height screens.
