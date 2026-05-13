# Phase F-80: Analyst-Visible Execution Preview Contracts

## Architecture Purpose

Phase F-80 adds a metadata-only execution preview layer for Analyst Mode inspection. The preview explains what FiltraQueri may do during a future execution pipeline without executing SQL, generating code, mutating Query Builder state, or touching active results.

The feature lives in `frontend/src/features/executionPreview/` and consumes existing planning metadata:

- guided input selections
- analysis plan readiness
- workbook relationship planning
- engine compatibility metadata
- explanation readiness
- unified planning readiness

## Stage System

Execution previews are made from deterministic `ExecutionPreviewStage` records:

- `guided_input`
- `validation`
- `aggregation`
- `grouping`
- `relationship_resolution`
- `engine_routing`
- `forecasting`
- `statistical_analysis`
- `result_projection`
- `explanation`

Each stage has a stable `stageId`, label, description, and `stageType`. Builders derive stages from task metadata and existing readiness reports. Validation checks stage ordering, duplicate stage ids, unsupported combinations, and missing readiness metadata.

Example stage patterns:

- Best-Performing Products: guided input, aggregation, grouping, result projection, engine routing, explanation
- Forecasting: guided input, validation, forecasting, result projection, engine routing, explanation
- Correlation: guided input, validation, statistical analysis, result projection, engine routing, explanation

## Preview Result Shapes

The preview exposes a deterministic `expectedFutureResultShape`:

- `summary_table`
- `grouped_table`
- `ranked_output`
- `comparison_output`
- `trend_output`
- `statistical_output`
- `forecast_output`

These are expectations only. They do not create result tabs, active results, exports, queries, Python scripts, R scripts, or SQL text.

## Confidence Behavior

`ExecutionPreviewConfidence` maps from unified planning readiness confidence:

- readiness `high` -> preview `high`
- readiness `medium` -> preview `moderate`
- readiness `low` -> preview `low`

Confidence describes metadata completeness and workflow shape confidence. It is not an execution success probability.

## Analyst Visibility

The task launcher can show a read-only "Future Execution Preview".

Human Mode sees the simplified workflow summary and safety notes.

Analyst Mode can inspect the full stage list, stage types, readiness status, result shape, confidence, analyst notes, and safety notes.

## Metadata-Only Guarantees

Phase F-80 is intentionally non-executing:

- no SQL execution
- no joins executed
- no SQL generation
- no Python generation
- no R generation
- no `executeWorkspaceQuery` calls
- no Query Builder mutation
- no active result mutation
- no AI orchestration

The preview layer only reads existing metadata passed into its builder and hook.

## Safety Notes

The preview includes safety notes for future execution requirements, including:

- Workbook relationships still require confirmation.
- Forecasting requires a valid date field.
- Statistical workflows may require numeric metrics.
- Execution preview is metadata only; it does not run queries or generate code.

Validation warnings are also surfaced as safety notes so analysts can see structural issues before any future execution pipeline is connected.

## Future Pipeline Direction

This contract creates an inspection boundary for future execution work. Later phases can attach real execution planning behind this boundary only after preserving these guarantees:

- preview metadata remains deterministic
- stage inspection remains read-only
- execution remains opt-in and separate from preview generation
- result mutation happens only through explicit execution flows
- relationship confirmation remains visible before relationship-dependent execution
