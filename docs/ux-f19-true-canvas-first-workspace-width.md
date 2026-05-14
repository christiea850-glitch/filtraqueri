# UX-F19: True Canvas-First Workspace Width Pass

## Purpose

UX-F19 gives the middle workspace real breathing room. The shell now prioritizes the center canvas over the left navigation and right investigation rail, especially on Results and Analyst workspaces.

This is layout and presentation only. No backend, execution, request-shape, result-model, Monaco, routing, persistence, export, pagination, upload/session restore, workbook switching, continuation, or Human/Analyst switching behavior changed.

## Implementation Summary

- Reduced shell sidebar sizing:
  - default: `152px`
  - minimum: `124px`
  - maximum: `160px`
- Added final canvas-first CSS rules that override earlier shell defaults.
- Reduced default right rail width to `180-220px`.
- Results and Analyst views now visually dock the right rail to a compact `44px` support rail by default.
- Results table receives more width and a wider spreadsheet baseline.
- Analyst SQL workspace receives wider editor-first proportions.
- Explore, Data, and Build panels now stretch across available canvas width instead of behaving like narrow centered cards.

## Files Changed

- `frontend/src/components/layout/WorkspaceShell.tsx`
- `frontend/src/styles/design-system.css`
- `docs/ux-f19-true-canvas-first-workspace-width.md`

## Preservation Guarantees

UX-F19 does not change:

- backend APIs
- execution logic
- Query Builder request shapes
- `executeWorkspaceQuery`
- `ActiveResultModel`
- `ResultsGrid` behavior
- Monaco behavior
- SQL restore
- upload/session restore
- workbook switching
- exports
- pagination
- Human/Analyst switching
- routing/back behavior
- continuation wrappers
- runtime persistence

## Manual Smoke Checklist

- Results: verify Preview/Filtered/Query tabs still switch.
- Results: verify pagination and rows-per-page still work.
- Results: verify export still uses the active result.
- Results: verify table is wider and no chips/panels overlap.
- Analyst: verify Monaco/editor loads and draft restore works.
- Analyst: verify schema/context/runtime supporting panels remain accessible.
- Explore: verify filter controls still apply/reset normally.
- Data: verify workspace tabs and drill-in Back behavior still work.
- Resize desktop/tablet/mobile widths and confirm the canvas stays dominant until safe stacking begins.

## Deferred Enhancements

- Persist user preference for expanded/docked rail width.
- Add visual regression screenshots for desktop Results and Analyst layouts.
- Extract shell sizing into named CSS variables once the width model stabilizes.
