# UX-F4: Results Workspace Hierarchy & Investigation Surface

## Purpose

UX-F4 refactors the Results workspace presentation so it reads as an investigation review surface rather than only a data grid. The phase preserves all result behavior and adds deterministic, metadata-only context above the existing grid.

## Implementation Summary

- Added a `results-investigation-surface` above `ResultsGrid`.
- Summarizes:
  - active result type
  - active source tab
  - rows and visible columns
  - result source
  - active filters and sorting
  - export readiness
  - current investigation focus
- Added a deterministic `Top takeaway` area.
- Added Human/Analyst copy differences:
  - Human Mode emphasizes review, comparison, refinement, and export.
  - Analyst Mode emphasizes source tab, result model, query context, and payload review.
- Added a collapsed `Technical result metadata` disclosure.
- Softened the surrounding grid container styling without changing grid logic.

## Boundary Guarantees

UX-F4 does not:

- change `ActiveResultModel`
- change `ResultsGrid` logic
- change pagination behavior
- change export behavior or export payloads
- change backend APIs
- change Query Builder request shapes
- change `executeWorkspaceQuery`
- change routing or back behavior
- change Human/Analyst switching
- change upload/session restore
- change workbook switching
- change SQL draft restore
- change Monaco behavior
- change runtime persistence
- change continuation wrappers
- introduce AI execution or SQL generation
- mutate result rows or result source mapping

## UX Reasoning

The Results workspace now leads with why the result matters and what the user can safely do next. The grid remains the functional core, but its surrounding hierarchy supports investigation review before detailed row inspection.

## Regression Checks

Recommended checks:

- Build the frontend.
- Open preview results.
- Apply filters and review filtered results.
- Run Query Builder and review query results.
- Switch result tabs.
- Sort columns.
- Change pagination and rows per page.
- Hide/show columns.
- Export active results.
- Switch Human/Analyst modes.
- Restore uploaded/session datasets.
- Switch workbook context.
- Verify SQL draft restore and Monaco load.

## Deferred UX Work

- Extract a dedicated `ResultsInvestigationSurface` component.
- Add direct continuation buttons once navigation wrappers are componentized.
- Further reduce density inside the grid toolbar.
- Add a results context drawer for dataset/session and query history.
- Improve result comparison workflows.
