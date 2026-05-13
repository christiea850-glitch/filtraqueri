# Phase F-72 Task-to-Analysis-Plan Contract

## What Was Added

Phase F-72 adds a metadata-only analysis plan feature area:

```text
frontend/src/features/analysisPlan/
```

It defines:

- `AnalysisPlan`
- `AnalysisExecutionStep`
- `AnalysisPlanValidationState`
- `AnalysisPlanValidationResult`
- metadata-only plan builder
- metadata-only plan validation
- plan selector helpers
- a lightweight `useAnalysisPlan` hook

## Why Analysis Plans Exist

Analysis plans are the future-safe layer between configured Human Mode tasks
and execution engines. They describe what FiltraQueri intends to do without
generating SQL, Python, R, or results.

```text
Task Selection
-> Task Configuration
-> Validation
-> Analysis Plan
-> Engine Adapter
-> Execution Pipeline
-> Active Result Model
-> Explanation Layer
```

## Plan Builder Behavior

The builder reads:

- task metadata
- task configuration metadata
- supported future engines
- expected result types

It creates future execution-step placeholders such as:

- prepare metric
- prepare dimension
- prepare date field
- aggregate
- compare
- forecast
- correlate
- detect anomaly
- summarize

These steps are planning metadata only.

## Human Mode Integration

The task detail panel now shows:

- future analysis-plan readiness
- future execution-step preview
- supported engines
- expected outputs

No task can run from this panel.

## Guardrails

F-72 does not:

- execute queries
- generate SQL, Python, or R
- call `executeWorkspaceQuery`
- mutate Query Builder state
- mutate active results
- modify workbook state
- add AI orchestration
- change routing or mode switching

## Future Phases

- F-73: business result explanation layer
- F-74: engine adapter metadata contracts
- F-75: workbook relationship-aware join plan preview
- Later: controlled execution through validated engine adapters
