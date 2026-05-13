# Phase F-74 Engine Adapter Metadata Contracts

## What Was Added

Phase F-74 adds a metadata-only engine adapter feature area:

```text
frontend/src/features/engineAdapters/
```

It defines:

- `EngineAdapter`
- `EngineType`
- `EngineReadinessLevel`
- `EngineCompatibilityResult`
- starter engine registry metadata
- compatibility selectors and a lightweight hook

The starter registry includes:

- DuckDB SQL Engine
- Excel Workbook Engine
- Python Analysis Engine
- R Statistical Analysis Engine

## Why Engine Adapters Exist

Engine adapters describe which future analytics engines may support a validated
analysis plan. They are a routing-preparation contract only. They do not run
queries, generate SQL, generate Python, generate R, or mutate result state.

```text
Task Selection
-> Task Configuration
-> Validation
-> Analysis Plan
-> Business Explanation Layer
-> Engine Compatibility
-> Engine Adapter
-> Future Execution Pipeline
-> Active Result Model
```

## Compatibility Behavior

The compatibility helpers compare:

- task-supported future engines
- task category
- analysis-plan execution-step placeholders
- expected result metadata
- engine capability metadata

Examples:

- Forecasting tasks prefer Python or R metadata.
- Workbook relationship-aware tasks may prefer the Excel Workbook metadata path.
- Aggregation and comparison tasks may prefer DuckDB metadata.
- Correlation and statistical tasks may prefer Python or R metadata.

## Metadata-Only Guardrails

This phase does not:

- call `executeWorkspaceQuery`
- generate SQL, Python, or R
- inspect dataset rows
- mutate Query Builder state
- mutate active results
- modify workbook state
- add AI orchestration
- change routing or mode switching

## Human Mode Integration

The task detail panel now shows read-only future engine compatibility:

- recommended future engine
- compatible engine summaries
- capability chips
- readiness labels

This remains informational only.

## Future Connections

Future phases can build:

- engine-specific analysis plan adapters
- guarded SQL plan generation
- Python/R preview planning
- workbook relationship-aware join plan previews
- AI-assisted engine selection after deterministic validation exists
