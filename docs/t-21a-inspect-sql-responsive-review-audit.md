# T-21A Inspect SQL Responsive Review Audit

## Files Inspected

- `frontend/src/features/analyst/sql/SqlWorkspace.tsx`
- `frontend/src/features/analyst/sql/SqlEditorPanel.tsx`
- `frontend/src/features/analyst/sql/SqlSchemaPanel.tsx`
- `frontend/src/styles/sql.css`

## Current Responsive Behavior

The polished Inspect SQL main page is now much more action-focused on desktop. The main workspace uses a two-column grid with editor-first content and a schema rail, then collapses to a one-column layout under `1080px`. The Ask row stacks under `760px`, command controls wrap, source/scope pills wrap, and focused detail views already use a single-column shell in preview mode.

The remaining responsive risk is not that controls disappear, but that several compact rows can become tall at the same time on tablet and mobile widths. When Ask results, source/scope, readiness warnings, planning status, and schema rail are all present, the editor can still be pushed down on smaller screens.

## What Works Well

- Wide desktop: the editor is the center of the workspace, with the schema rail aligned on the side.
- Laptop width: the compact Ask row, worksheet pills, source/scope strip, command bar, and slim planning status all reduce vertical weight compared with the pre-T-20 layout.
- Tablet width: the workspace already falls back to a one-column grid under `1080px`, preventing side-by-side compression.
- Mobile/narrow width: the Ask row stacks under `760px`, so the Ask button remains usable instead of being squeezed.
- Safety-critical controls are still present in markup: Run Query, readiness, relationship blockers, source/scope context, Insert SQL guards, and detail-view actions.

## Current Responsive Risks

- The schema rail does not auto-collapse under `1080px`; it becomes a full-width block after the editor. This preserves access but can add a large vertical section on tablet/mobile.
- The source/scope strip uses `justify-content: space-between` with actions kept as a separate group. On narrow widths, long scope/source/template pills plus Manage scope and Change source can wrap into a bulky block.
- The command bar wraps safely, but readiness warnings with summary text can occupy a lot of width before Run Query. Run Query remains visible, but may be pushed to a later row.
- Worksheet pills are capped and wrap, which is safe, but the optional `Includes:` hint can create a second line with long column names.
- Planning status is slim, but the status label plus badge plus action can still stack on mobile.
- Detail views use a full-width shell, but some internal cards and `dl` grids should be checked at mobile widths, especially relationship review cards and draft/result headers.
- The top gradient banner and the secondary page head still consume vertical space before the workspace; this is outside T-21A implementation scope but remains a mobile visibility concern.

## Breakpoint Strategy Recommendation

- Keep wide desktop above `1080px` as the two-column editor plus schema rail layout.
- Treat `860px` to `1080px` as tablet/laptop: one-column workspace, compact top rows, schema rail collapsed or moved below only on demand.
- Treat `760px` and below as narrow/mobile: stack Ask, command, planning, and detail headers explicitly; avoid depending on incidental flex wrapping.
- Consider an additional `600px` breakpoint for source/scope and command actions where labels can shorten and controls become full-width rows.

## Schema Rail Recommendation

Auto-collapse the schema rail under a tablet breakpoint, likely `1080px` or `860px`, while keeping the existing manual Schema/Hide schema toggle. The safest first implementation is CSS-only visual collapse for narrow screens, but the better user experience may require state initialization or a resize-aware effect so the rail starts collapsed without removing access.

The rail should remain accessible because schema chips insert column names into the editor. Do not hide it entirely; expose a clear `Schema` control and keep column insertion explicit.

## Ask Row Recommendation

Keep the desktop three-column Ask row. Under `760px`, the existing one-column stack is the right direction. In T-21B, verify button width and tap target size, and consider making the Ask button full width only on narrow screens if it improves reachability.

Also consider capping or wrapping the guidance copy in Ask results so a long deterministic summary does not push worksheet pills and blockers too far down.

## Command Bar Recommendation

Keep all current commands visible: dialect, readiness, Run Query, Result Preview, Save Query, Saved Drafts, and Clear. For narrow widths, prefer an ordered wrap where Run Query stays early and visible. Readiness warnings should remain visible but can use a compact expandable summary if warning text dominates the row.

Run Query must stay manual and should not move into a hidden overflow menu.

## Source/Scope Strip Recommendation

The strip should keep Scope and Source visible on every viewport. On small screens, stack the pill group above Manage scope and Change source, and let the action group align left. Long source, scope, and template labels should continue truncating inside pills, with full context available through existing manage/change controls.

Do not remove source/scope context to recover vertical space.

## Planning Status Recommendation

Keep the slim row. At narrow widths, stack the title/status line, badge, and `View planning details` action. Consider simplifying wording from `Planning details available` plus `Planning details` status to a single label such as `Planning ready` or `Planning needs review`, but only as copy polish after visual review.

## Detail-View Recommendation

Focused result preview, saved drafts, draft detail, planning details, and relationship review already use preview-mode full-width shells. T-21D should audit their internal card/header grids at mobile widths and ensure back actions, review actions, and safety copy remain above detailed tables/cards.

Relationship and planning detail content should stay in focused views rather than returning inline to the main editor page.

## Safety Boundaries

- Run Query must remain visible and manual.
- Insert SQL must remain explicit and guarded.
- Relationship blockers must remain visible and must keep opening Review worksheet connections.
- Source/scope context must remain visible.
- Planning and relationship detail views must remain accessible.
- No backend/API/provider calls should be added.
- No SQL generation, execution, ranking, source/scope state, relationship persistence, or Business SQL planner/renderer contract changes should be made for responsive polish.

## Proposed Implementation Slices

- T-21B: compact Ask/source/command wrapping polish. Focus on narrow Ask stacking, source/scope action wrapping, command order, readiness warning width, and worksheet pill/hint behavior.
- T-21C: schema rail responsive collapse audit or implementation. Decide CSS-only collapse versus state-aware auto-collapse, preserving the manual Schema toggle and chip insertion.
- T-21D: detail-view responsive polish. Review focused result preview, saved drafts, draft detail, planning details, and relationship review on tablet/mobile.
- T-21E: final responsive verification. Run fixtures/build, inspect desktop/laptop/tablet/mobile screenshots or manual viewport checks, and document remaining risks.

## Recommendation For Next Phase

Start with T-21B because it improves the main action surface without changing workspace state. Then handle schema rail behavior separately in T-21C, since auto-collapse may require more careful state and accessibility decisions.
