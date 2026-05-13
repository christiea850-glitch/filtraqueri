# Phase F-88: Execution Contract Layer

## Purpose

Phase F-88 adds a metadata-only execution contract architecture. It defines how future analytics execution pipelines may operate without executing queries, executing joins, generating code, or mutating results.

The feature lives in `frontend/src/features/executionContracts/`.

## Contract Models

The layer introduces:

- `ExecutionContract`
- `ExecutionStageContract`
- `ExecutionInputContract`
- `ExecutionOutputContract`
- `ExecutionDependencyContract`
- `ExecutionSafetyContract`
- `ExecutionEngineContract`

## Lifecycle States

- planned
- blocked
- pending_validation
- ready_for_execution
- execution_locked
- relationship_pending
- metadata_pending

## Stage Categories

- dataset_resolution
- relationship_resolution
- metric_resolution
- dimension_resolution
- filter_resolution
- aggregation_resolution
- forecasting_resolution
- statistical_resolution
- visualization_resolution
- explanation_resolution
- export_resolution

## Metadata Sources

Contracts derive only from:

- analytics planning engine
- analytics intent graph
- workflow recommendations
- KPI intelligence
- semantic intelligence
- execution preview metadata
- business question intelligence
- workbook relationship metadata
- planning readiness

## Dependency Chains

The contract models deterministic dependency chains such as:

- forecasting requires date resolution
- grouped analysis requires dimension resolution
- dashboard outputs require KPI readiness
- workbook execution requires relationship confirmation

## Engine Compatibility Metadata

Projected compatible engines include:

- DuckDB
- Excel workbook logic
- Python analytics
- R statistical engine
- MariaDB future path
- Oracle future path
- PostgreSQL/general SQL future path

## Projected Outputs

Execution contracts may project:

- summary tables
- grouped tables
- ranked outputs
- trend outputs
- forecast outputs
- dashboard widgets
- executive summaries
- statistical reports

These are projections only. No outputs are produced.

## Analyst Metadata

Contracts expose:

- execution stages
- stage dependencies
- blocked execution reasons
- missing metadata
- compatible engines
- projected outputs
- execution complexity
- execution readiness score
- relationship dependency chains
- deterministic execution sizing

Sizing includes estimated execution stages, relationship count, projected outputs, and KPI projections.

## UI Integration

Read-only execution contract panels were added to:

- `DatasetSummaryPanel.tsx`
- `TaskLauncherPanel.tsx`

Human Mode sees a concise contract summary. Analyst Mode can inspect blocked reasons and relationship dependency chains in the task panel.

## Metadata-Only Guarantees

Phase F-88 does not:

- execute SQL
- execute joins
- generate SQL
- generate Python
- generate R
- call `executeWorkspaceQuery`
- mutate Query Builder state
- mutate active results
- add AI orchestration

Protected systems remain untouched, including routing, workbook switching, Human/Analyst mode switching, upload/session restore, Monaco workspace, export behavior, active result integrity, pagination, workflow recommendations, KPI intelligence, semantic intelligence, execution preview, analytics intent graph, analytics planning engine, and relationship-aware planning.
