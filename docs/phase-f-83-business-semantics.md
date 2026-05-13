# Phase F-83: Business Semantics

## Purpose

Phase F-83 adds a metadata-only semantic business entity intelligence layer. FiltraQueri can now detect likely business entities, operational concepts, and KPI opportunities from uploaded dataset metadata, workbook structure, data profile metadata, workflow recommendations, and planning context.

The feature lives in `frontend/src/features/businessSemantics/`.

## Supported Semantic Entity Categories

- customer
- product
- sales
- revenue
- expense
- invoice
- transaction
- employee
- supplier
- booking
- inventory
- payment
- region
- department
- operational_event
- date_dimension
- metric_field
- dimension_field

## Metadata Sources

Semantic detection derives only from metadata:

- column names
- worksheet names
- workbook structure
- field naming patterns
- detected numeric, date/time, categorical, boolean, and text fields
- detected ID-like fields
- workflow recommendations
- planning metadata exposed through workflow recommendation reports

No row values are queried or executed.

## Semantic Contract

Each `BusinessSemanticEntity` includes:

- semantic category
- label
- confidence: `low`, `moderate`, or `high`
- supporting metadata signals
- related worksheet names

The report also exposes:

- Human Mode summary
- analyst summary
- possible business KPIs
- possible workflow connections
- recommended future analytics paths
- safety notes

## KPI Suggestion Metadata

Phase F-83 adds deterministic KPI suggestions such as:

- total revenue
- average transaction value
- top products
- customer growth
- regional performance
- operational throughput
- inventory movement

KPI suggestions are based on detected semantic entities. They are not calculated and do not create active results.

## Human And Analyst Visibility

Human Mode summaries stay simple, for example:

- `FiltraQueri detected customer-related business data.`
- `This workbook may contain sales and revenue information.`
- `Operational transaction patterns were detected.`

Analyst-facing metadata exposes detected entities, supporting signals, related worksheets, KPI suggestions, workflow connections, and future analytics paths.

## UI Integration

Read-only semantic intelligence panels were added to:

- `DatasetSummaryPanel.tsx`
- `TaskLauncherPanel.tsx`

The dataset panel shows semantic entities and KPI suggestions from dataset-level metadata. The task panel reuses the same report while allowing Analyst Mode to inspect supporting metadata signals.

## Metadata-Only Guarantees

Phase F-83 does not:

- execute SQL
- execute joins
- generate SQL
- generate Python
- generate R
- call `executeWorkspaceQuery`
- mutate Query Builder state
- mutate active results
- add AI orchestration

Protected systems remain untouched, including routing, workbook switching, Human/Analyst mode switching, upload/session restore, Monaco workspace, export behavior, active result integrity, pagination, workflow recommendations, execution preview, and relationship-aware planning.
