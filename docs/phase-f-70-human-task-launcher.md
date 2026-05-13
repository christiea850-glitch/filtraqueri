# Phase F-70 Human Mode Task Launcher Prototype

## What Was Introduced

Phase F-70 adds the first visible Human Mode task launcher prototype under:

```text
frontend/src/features/tasksLauncher/
```

The launcher reads from the metadata-only task registry created in F-69 and
displays guided analytics tasks grouped by category.

## Launcher Behavior

The launcher shows:

- task category
- task label
- beginner-friendly status
- description
- supported result types

Clicking a task opens a metadata-only detail panel with:

- required inputs
- optional inputs
- expected outputs
- supported engines
- future explanation template key

No task is executed.

## SAS Studio-Inspired Direction

This phase starts moving Human Mode toward a Tasks & Utilities workflow. The
user begins with a business task instead of SQL syntax, formulas, or manual
query construction.

The experience is intentionally lightweight and additive. Existing filters,
Query Builder, results, export, SQL Workspace, workbook switching, and recovery
systems remain unchanged.

## Why Execution Is Disabled

The task launcher is not connected to execution yet because FiltraQueri still
needs an analysis-plan contract. Future phases should connect task selection
through:

```text
Task selection
-> task configuration
-> business intent
-> analysis plan
-> engine adapter
-> active result model
```

The launcher should not call `executeWorkspaceQuery` directly.

## Guardrails

F-70 does not:

- generate SQL, Python, or R
- call `executeWorkspaceQuery`
- mutate Query Builder state
- mutate active results
- modify workbook state
- add AI orchestration
- change routing
- redesign the app

## Future Phases

- F-71: task configuration and validation state
- F-72: task-to-analysis-plan contract
- F-73: business result explanation layer
- F-74: workbook relationship-aware task planning
