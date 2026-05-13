# Phase F-85: Business Question Intelligence

## Purpose

Phase F-85 adds a metadata-only natural-language business question intelligence layer. FiltraQueri can classify human business questions into deterministic analytics intent metadata without executing queries or generating code.

The feature lives in `frontend/src/features/businessQuestionIntelligence/`.

## Supported Question Intent Categories

- revenue_question
- growth_question
- forecasting_question
- customer_question
- product_question
- operational_question
- comparison_question
- trend_question
- anomaly_question
- segmentation_question
- profitability_question
- inventory_question
- regional_question
- workforce_question
- executive_summary_question

## Metadata-Only Interpretation

The classifier supports business questions such as:

- `Which products sell the most?`
- `Are sales increasing?`
- `Which regions perform best?`
- `Can this data support forecasting?`
- `Which customers generate the most revenue?`

Classification derives only from:

- semantic entities
- KPI intelligence
- workflow recommendations
- guided inputs
- planning readiness
- execution preview metadata
- metadata keyword matching
- deterministic intent rules

## Interpretation Contract

Each `BusinessQuestionInterpretation` includes:

- detected intent category
- confidence: `low`, `moderate`, or `high`
- Human Mode summary
- supporting signals
- supporting semantic entities
- likely workflow path
- likely KPI connections
- recommended chart types
- recommended future engines
- required missing metadata
- follow-up suggestions

## Follow-Up Suggestions

Phase F-85 adds deterministic follow-up suggestion metadata, including:

- Choose a date field for forecasting.
- Select a revenue metric.
- Choose a grouping dimension.
- Confirm workbook relationships.

These suggestions are metadata only. They do not mutate guided inputs or task configuration.

## Human And Analyst Visibility

Human Mode summaries stay simple, for example:

- `This question may relate to revenue analysis.`
- `FiltraQueri detected a forecasting-related business question.`
- `This appears to be a regional performance question.`

Analyst-facing metadata exposes detected intent, supporting semantic entities, likely workflow path, KPI connections, chart types, future engines, and missing metadata.

## UI Integration

Read-only business question panels were added to:

- `DatasetSummaryPanel.tsx`
- `TaskLauncherPanel.tsx`

The dataset panel classifies deterministic example questions and KPI-derived suggested questions. The task panel also includes the selected task label as metadata text for classification.

## Metadata-Only Guarantees

Phase F-85 does not:

- execute SQL
- execute joins
- generate SQL
- generate Python
- generate R
- call `executeWorkspaceQuery`
- mutate Query Builder state
- mutate active results
- add AI orchestration

Protected systems remain untouched, including routing, workbook switching, Human/Analyst mode switching, upload/session restore, Monaco workspace, export behavior, active result integrity, pagination, workflow recommendations, semantic intelligence, KPI intelligence, execution preview, and relationship-aware planning.
