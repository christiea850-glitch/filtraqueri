# Phase F-78 Guided Input Selection

## What Was Added

Phase F-78 adds a metadata-only guided input feature area:

```text
frontend/src/features/guidedInputs/
```

It defines:

- guided input option contracts
- selected input state
- missing-required-input validation
- schema-aware option builders
- selector helpers
- a lightweight hook for Human Mode task details

## Supported Input Types

The guided input system supports:

- metric
- dimension
- date field
- grouping field
- comparison field
- entity field
- threshold
- time range
- filter condition

## Human Mode Language

Guided inputs use beginner-friendly prompts such as:

- Choose the number you want to measure.
- Choose what you want to group by.
- Choose a date field if time matters.
- Choose what you want to compare.

## Metadata-Only Behavior

Selections update local task configuration state only. They do not execute
queries, generate SQL, mutate Query Builder state, or mutate active results.

## Example Guided Input State

```text
taskId: task_best_performing_products
metric: revenue
entity-field: product
readyForPlanning: true
```

## Example Validation Message

```text
Metric is needed before this workflow can be planned.
```

## Future Connections

Future phases can connect guided input selections to:

- stronger analysis-plan validation
- deterministic plan previews
- engine-specific planning adapters
- result-aware explanations
- guarded execution after validation
