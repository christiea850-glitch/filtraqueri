# UX-F11: Explore + Build Cleanup

## Purpose

UX-F11 aligns Explore and Build with the canonical workspace blueprint after UX-F9 shell alignment and UX-F10 Home/Data cleanup. This phase is page-specific UX cleanup only.

## Implementation Summary

- Reframed Explore as the guided business-question entry point.
- Added a calm question surface with:
  - "What would you like to understand?"
  - suggested question prompts
  - optional custom question input
- Kept existing filter controls, filter state, reset behavior, and apply behavior unchanged.
- Added Analyst Mode copy for inspectable filter/query context without execution.
- Reframed Build as controlled query construction.
- Renamed visible Query Builder stages around:
  - fields
  - measure
  - filter
  - group by
  - sort / limit
  - review & run
- Added a compact approve-before-run strip near Run Query.
- The approval strip summarizes:
  - data source
  - fields selected
  - filters active
  - grouping active
  - row limit
- Kept Run Query intentional and explicit with "Nothing runs until you approve."
- Removed dataset and worksheet names from Build technical metadata because the context strip owns those facts.

## Duplication Removed

- Explore no longer repeats dataset, worksheet, row count, or column count.
- Build no longer repeats dataset or worksheet identity.
- Build relies on query-specific summary facts only.
- Technical metadata remains collapsed and read-only.

## Boundary Guarantees

UX-F11 does not:

- change backend APIs
- change `executeWorkspaceQuery`
- change Query Builder execution logic
- change Query Builder request shapes
- mutate `ActiveResultModel`
- change `ResultsGrid`
- change pagination
- change exports
- change Monaco behavior
- change SQL draft restore
- change upload/session restore
- change workbook switching
- change Human/Analyst switching logic
- change runtime persistence
- change routing or back behavior
- change continuation wrappers
- introduce AI execution, generated SQL, autonomous planning, or optimization execution

## Regression Checks

Recommended checks:

- Build the frontend.
- Open Explore in Human Mode and confirm suggested questions appear.
- Type a custom Explore question and confirm it does not apply filters automatically.
- Select a suggested question and confirm it only fills the local prompt.
- Search filter columns.
- Set numeric, date, boolean, text, and categorical filters.
- Reset filters.
- Apply filters and confirm existing behavior/results remain unchanged.
- Open Build and move through every stage.
- Select fields, grouping, aggregations, sort, and row limit.
- Confirm the approval summary updates.
- Run Query and confirm existing Query Builder execution behavior.
- Switch Human/Analyst modes and confirm copy changes without changing execution.

## Deferred To UX-F12

- Results workspace cleanup.
- Analyst workspace cleanup.
- Business takeaway plus chart/table support.
- Result-specific metadata reduction.
- Controlled SQL workspace hierarchy refinement.
