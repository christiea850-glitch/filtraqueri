# UX-F5: Query Builder Guided Workflow Architecture

## Purpose

UX-F5 reframes Query Builder as a guided investigation workflow instead of a dense utility panel. The phase is presentation, sequencing, and workflow hierarchy only.

## Implementation Summary

- Added a Query Builder workflow hero.
- The hero summarizes:
  - active dataset
  - active worksheet
  - active filter count
  - grouping state
  - expected result type
  - Human/Analyst framing
- Expanded the visible workflow into six stages:
  - Select data
  - Define question
  - Apply filters
  - Group & compare
  - Review output
  - Execute review
- Added deterministic workflow progress:
  - data selected
  - filters added
  - grouping active
  - preview ready
  - execution ready
- Added Human Mode copy focused on business questions, filtering, comparing categories, and previewing before running.
- Added Analyst Mode copy focused on execution context, grouping logic, query structure, and result projection.
- Moved optional selection shortcuts behind progressive disclosure.
- Added technical query metadata behind disclosure in the execute review stage.

## Boundary Guarantees

UX-F5 does not:

- change Query Builder execution logic
- change Query Builder request shapes
- change `executeWorkspaceQuery`
- change backend APIs
- change `ActiveResultModel`
- change Monaco behavior
- change SQL execution behavior
- change routing or back behavior
- change Human/Analyst switching
- change upload/session restore
- change workbook switching
- change exports
- change pagination
- change SQL draft restore
- change runtime persistence
- change continuation wrappers
- generate SQL automatically
- add AI execution
- mutate filters or queries automatically

## UX Reasoning

The Query Builder now separates intent, scope, grouping, output review, and execution review. Users can understand the shape of the result before running anything, while all existing controls and handlers remain in place.

## Regression Checks

Recommended checks:

- Build the frontend.
- Open Query Builder with a dataset.
- Select and clear columns.
- Use optional selection shortcuts.
- Review active filter metadata.
- Configure grouping.
- Add, update, and remove aggregations.
- Configure sort and row limit.
- Run Query Builder through the existing run button.
- Verify resulting query result tab.
- Verify exports and pagination remain unchanged.
- Switch Human/Analyst modes.
- Restore uploaded/session datasets and SQL drafts.

## Deferred UX Work

- Extract a dedicated `QueryBuilderWorkflowHero` component.
- Extract stage components.
- Add navigation-backed links to Filters and Results once continuation buttons are componentized.
- Further reduce density in field selection for very wide schemas.
- Add richer workbook relationship context once multi-sheet query workflows exist.
