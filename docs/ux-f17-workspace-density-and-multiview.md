# UX-F17: Workspace Density & Multi-View Navigation

## Purpose

UX-F17 moves FiltraQueri toward a denser analytics operating workspace by introducing lightweight in-page tabs, split panes, compact stat grids, and metadata rows. This is a presentation/layout phase only and preserves all existing execution behavior.

## Implementation Summary

- Added shared presentation primitives:
  - `WorkspaceTabs`
  - `WorkspaceSplitPane`
  - `CompactStatGrid`
  - `MetadataRow`
- Data page now uses in-page tabs:
  - Overview
  - Columns
  - Worksheets
  - Intelligence
  - Semantics
- Data overview remains compact while the existing drill-in detail panels continue to open focused detail views with Back.
- Results page now uses a split-pane layout:
  - primary pane: existing `ResultsGrid`
  - secondary pane: business takeaway, metadata, session context, and history
- Analyst workspace now uses in-page side tabs:
  - SQL
  - Schema
  - Context
  - Runtime
- The SQL editor remains mounted and dominant; schema/context/runtime are secondary views.
- Added responsive rules so split panes collapse to stacked layouts on narrower screens.

## Preservation Verification

UX-F17 does not change:

- backend APIs
- execution logic
- Query Builder request shapes
- `executeWorkspaceQuery`
- `ActiveResultModel`
- `ResultsGrid`
- Monaco/editor behavior
- SQL draft restore
- upload/session restore
- workbook switching
- exports
- pagination
- routing/back behavior
- Human/Analyst switching
- continuation wrappers
- runtime persistence

## Responsive Behavior

- Desktop prioritizes horizontal productivity layouts.
- Results can show grid and metadata side by side.
- Analyst keeps SQL editor primary while side tabs switch supporting context.
- Tablet and smaller widths collapse split panes into safe stacked sections.
- Existing drill-in/back interactions remain in-page and do not touch browser routing.

## Manual Smoke Checklist

- Data: switch Overview, Columns, Worksheets, Intelligence, and Semantics tabs.
- Data: open a detail panel and use Back to return to Overview.
- Build: confirm Run Query approval remains visible and query execution path is unchanged.
- Results: switch Preview/Filtered/Query tabs, paginate, change rows per page, and export.
- Analyst: confirm SQL editor loads; switch SQL/Schema/Context/Runtime side tabs.
- Analyst: confirm saved drafts still load and Monaco/editor content persists.
- Resize to tablet/mobile widths and confirm split panes stack without overlap.

## Deferred Items

- Use `MetadataRow` more broadly as legacy metadata panels are simplified.
- Consider a dedicated Results view tab for Export once export content is componentized.
- Add visual regression screenshots for split-pane desktop and stacked responsive states.
