# UX-F7: Information Architecture Consolidation

## Purpose

UX-F7 removes duplicated workspace cognition introduced across the F-89 through F-94 runtime foundation and UX-F1 through UX-F6 visual architecture passes. This is a subtraction phase: one primary workspace context strip now owns the core facts, while page surfaces become supportive instead of competing summaries.

## Implementation Summary

- Replaced the oversized workspace hero with a compact page heading and one workspace context strip.
- Removed duplicated dataset and row/column context from the left sidebar.
- Simplified the right investigation drawer so it focuses on next steps, path navigation, continuation actions, and optional technical metadata.
- Reduced the Results page investigation surface into a smaller review strip above the grid.
- Collapsed Results supporting context by default so the grid remains dominant.
- Replaced the Query Builder hero and summary chips with a compact workflow status strip.
- Preserved all runtime adapters, navigation wrappers, execution paths, result models, and request shapes.

## Duplication Reduction Summary

- Dataset name now has one primary visible home in the workspace context strip.
- Worksheet context now has one primary visible home in the workspace context strip.
- Dataset row and column counts now live in the context strip instead of repeating in the hero and sidebar.
- Active mode now lives in the context strip and top-level controls, with the right drawer only marking the guidance as read-only.
- Investigation focus now lives in the context strip; the right drawer no longer repeats the selected object narrative.
- Result context is supportive and result-specific: source, result size, filters/sort, export readiness, and next action.
- Query Builder no longer restates dataset and worksheet context before the workflow controls.

## Source-of-Truth Consolidation

The workspace context strip is the primary source of truth for:

- dataset name
- worksheet
- dataset rows and columns
- active mode
- current focus

The right drawer is now scoped to:

- contextual next steps
- workspace path
- continuation navigation
- collapsed technical metadata

The main canvas owns the active analytical task, while page-level panels describe only the task-specific details needed to continue.

## Claude Review Alignment

UX-F7 aligns the workspace with the calm enterprise analytics direction by reducing repeated labels, lowering H1 scale, flattening nested cards, and making the center canvas feel more dominant. The sidebar navigates instead of explaining, the right drawer summarizes actions instead of enumerating state, and Results and Query Builder stop competing with the global workspace context.

## Boundary Guarantees

UX-F7 does not:

- change backend APIs
- change `executeWorkspaceQuery`
- change Query Builder logic or request shapes
- mutate `ActiveResultModel`
- change `ResultsGrid` logic
- change pagination
- change exports or export payloads
- change Monaco behavior
- change SQL draft restore
- change upload/session restore
- change workbook switching
- change Human/Analyst switching
- change runtime persistence
- change routing or back behavior
- change continuation wrappers
- introduce AI execution, SQL generation, planners, or optimization execution

## Regression Checks

Recommended checks:

- Build the frontend.
- Upload a CSV and confirm loaded-state pages do not show onboarding messaging.
- Switch workbook worksheets and confirm the context strip updates.
- Switch Human/Analyst modes and confirm mode-specific views remain available.
- Open Query Builder and run the existing query flow.
- Restore a SQL draft and confirm Monaco loads without executing automatically.
- Open Results, switch result tabs, sort, paginate, hide columns, and export.
- Use continuation and trail navigation in the right drawer.
- Collapse and expand the runtime panel.
- Expand Results supporting context and confirm dataset/session/history panels still work.

## Deferred Items

- Componentize the workspace context strip for reuse in future responsive shells.
- Extract the compact Results review strip into a dedicated component.
- Remove unused legacy CSS selectors after a broader stylesheet cleanup.
- Continue reducing dense Dataset Summary internals in a later UX phase.
- Add visual regression snapshots once the layout settles.
