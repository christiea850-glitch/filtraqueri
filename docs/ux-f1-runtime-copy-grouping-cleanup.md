# UX-F1: Runtime Copy and Grouping Cleanup

## Purpose

UX-F1 begins the FiltraQueri UX Architecture Refactor Era with a presentation-only cleanup of the runtime workspace. The phase makes the right runtime panel feel like one calm investigation surface instead of a stack of metadata panels.

## UX Changes

- Renamed the collapsed runtime panel control from `Context` to `Investigation`.
- Renamed the open panel action from `Hide context` to `Hide investigation`.
- Renamed the panel heading from `Context trail` to `Investigation`.
- Reframed the panel label as `Workspace guide`.
- Reframed mode copy:
  - Human Mode emphasizes connected data, questions, and results.
  - Analyst Mode emphasizes controlled technical context without automatic execution.
- Renamed `Selected context` to `Current focus`.
- Renamed `Recommendations` to `Suggested next steps`.
- Renamed `Trail` to `Path`.
- Renamed `Continue` to `Go to`.
- Renamed `Status` to `Technical metadata`.

## Grouping Model

The runtime panel now uses three visible UX groups:

1. `Investigation`
   - current focus
   - deterministic story disclosure
   - metadata-ranked suggested next steps

2. `Workspace path`
   - trail/path items
   - go-to continuation actions
   - return-to-investigation action

3. `Technical metadata`
   - read-only runtime panel slots
   - dataset/workbook/result/mode metadata

This grouping is presentational only. The F-89 through F-94 adapters remain separate.

## Boundary Guarantees

UX-F1 does not:

- change `executeWorkspaceQuery`
- change backend APIs
- change Query Builder request shapes
- mutate `ActiveResultModel`
- execute SQL from Monaco
- change routing or back behavior
- change upload/session restore
- change workbook switching
- change pagination
- change exports
- change runtime persistence
- change SQL draft restore
- introduce AI execution, SQL generation, planners, optimization, replay, governance, ledgers, or MIR systems

## Regression Checks

Recommended checks:

- Build the frontend.
- Switch between Human Mode and Analyst Mode.
- Collapse and expand the Investigation panel.
- Select workspace path items.
- Use go-to continuation actions.
- Open and close the Technical metadata disclosure.
- Restore an uploaded/session dataset.
- Switch workbook context.
- Run Query Builder through the existing path.
- Verify results pagination and export.
- Verify SQL draft restore remains unchanged.

## Deferred UX Work

- Deeper right-panel component extraction.
- Sidebar information architecture cleanup.
- Results workspace context drawer.
- Query Builder step sequencing.
- Responsive drawer behavior for the runtime panel.
- Future AI orchestration or natural language analytics.
