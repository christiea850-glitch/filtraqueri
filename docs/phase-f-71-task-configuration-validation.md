# Phase F-71 Task Configuration & Validation State

## What Was Added

Phase F-71 adds a metadata-only task configuration feature area:

```text
frontend/src/features/taskConfiguration/
```

It defines:

- `TaskConfiguration`
- `TaskConfiguredInput`
- `TaskValidationState`
- `TaskInputValidationResult`
- configuration creation helpers
- metadata-only validation helpers
- a lightweight hook for task detail readiness state

## Validation Scope

Validation is intentionally limited to task metadata readiness:

- required inputs missing
- task metadata unavailable
- supported engines missing
- expected result types missing

Validation does not inspect dataset rows, execute SQL, mutate Query Builder,
mutate active results, or call the execution pipeline.

## Human Mode Integration

The existing task launcher detail panel now shows:

- validation readiness state
- required input placeholders
- missing required input count
- future planning status

The placeholders are read-only in this phase. They exist to show the future
guided workflow shape without creating executable task configuration yet.

## Future Architecture Path

```text
Task Selection
-> Task Configuration
-> Validation
-> Business Intent
-> Analysis Plan
-> Engine Adapter
-> Active Result Model
```

F-71 stops at validation state. Analysis plans and execution remain future
work.

## Guardrails

F-71 does not:

- execute queries
- generate SQL, Python, or R
- call `executeWorkspaceQuery`
- mutate Query Builder state
- mutate active results
- add AI orchestration
- modify workbook state
- alter routing or mode switching
