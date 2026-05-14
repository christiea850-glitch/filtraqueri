# UX-F16: Drill-In Detail Panels

## Purpose

UX-F16 introduces a safe in-page drill-in pattern to reduce long vertical pages without changing routing, execution, backend APIs, request shapes, result modeling, Monaco behavior, pagination, exports, upload restore, workbook switching, runtime persistence, or continuation wrappers.

The pattern lets the main page show compact summaries first. Selecting a summary opens a focused detail panel inside the main canvas with a visible Back action.

## Implementation Summary

- Added a reusable `DrillInDetailPanel` component.
- Added design-system styles for:
  - compact drill-in summary grids
  - focused detail panels
  - visible Back action
  - scroll-safe long detail lists
- Applied the pattern to the Data page:
  - main Data page now shows compact summaries for Detected columns, Worksheets, Data intelligence, and Business semantics
  - detected column list moved behind a drill-in detail
  - worksheet switching moved behind a drill-in detail
  - runtime intelligence and business semantic panels now render only after choosing their summary area
- Applied the pattern safely to Analyst by making the SQL schema/context panel collapsed by default, keeping Monaco/editor visible as the primary surface.
- Build keeps the Query Builder flow and Run Query approval visible; optional/technical details remain behind existing disclosures.

## Files Changed

- `frontend/src/components/layout/DrillInDetailPanel.tsx`
- `frontend/src/components/dataset/DatasetSummaryPanel.tsx`
- `frontend/src/features/analyst/sql/SqlWorkspace.tsx`
- `frontend/src/styles/design-system.css`
- `docs/ux-f16-drill-in-detail-panels.md`

## Preservation Verification

UX-F16 does not change:

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
- routing or browser back behavior
- Human/Analyst switching
- runtime persistence
- continuation wrappers

## Manual Checks

Recommended smoke checks:

- Data page: click Detected columns, confirm detail opens, then Back returns to the compact Data summaries.
- Data page: click Worksheets, switch worksheet if available, then Back returns correctly.
- Data page: click Data intelligence and Business semantics; confirm metadata remains read-only and disclosure state persists.
- Build page: confirm Query Builder flow remains visible and Run Query approval remains available.
- Analyst page: confirm SQL editor loads with schema/context collapsed by default and expandable on demand.
- Results page: confirm pagination/export remain unchanged.

## Deferred Items

- Move the remaining lower-priority metadata groups into named drill-in sections once shared page primitives are extracted.
- Add route-local visual regression screenshots for Data drill-in states.
- Consider using the drill-in pattern for Results technical metadata in a future presentation-only phase.
