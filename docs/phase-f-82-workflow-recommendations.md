# Phase F-82: Workflow Recommendations

## Purpose

Phase F-82 adds a metadata-only workflow recommendation layer. FiltraQueri can now suggest likely analysis workflows from dataset profile metadata, workbook structure, guided inputs, planning readiness, execution preview stages, dataset shape, business-entity signals, time-series readiness, and statistical readiness.

The feature lives in `frontend/src/features/workflowRecommendations/`.

## Supported Workflow Categories

- summarization
- product_analysis
- customer_segmentation
- churn_analysis
- dashboard_reporting
- executive_summary
- ab_testing
- location_analysis
- time_series_forecasting
- recommendation_analysis
- correlation_analysis
- statistical_testing
- trend_analysis
- operational_monitoring

## Recommendation Contract

Each `WorkflowRecommendation` includes:

- category and label
- rank
- confidence: `low`, `moderate`, or `high`
- beginner-friendly Human Mode summary
- analyst-facing recommendation reasons
- supporting metadata signals
- missing metadata blockers
- recommended future engine path
- possible future result shapes

Recommendations are deterministic and ranked by metadata score. They do not inspect result rows or execute any backend operation.

## Metadata Sources

Recommendations may derive from:

- detected numeric, date/time, categorical, text, boolean, and ID-like fields
- possible metrics and dimensions
- workbook relationship context
- guided input selections
- unified planning readiness
- execution preview stages and result shape
- dataset size and shape
- detected business entities such as product, customer, location, experiment, and operational fields
- time-series readiness
- statistical readiness

## Human And Analyst Visibility

Human Mode panels show concise summaries such as:

- `This dataset may support forecasting workflows.`
- `FiltraQueri detected business metrics suitable for dashboard reporting.`
- `Workbook relationships may support product analysis.`

Analyst-facing metadata exposes why a workflow was recommended, which signals supported it, what blockers remain, which future engine path may fit, and which future result shapes are possible.

## UI Integration

Read-only recommendation panels were added to:

- `DatasetSummaryPanel.tsx`
- `TaskLauncherPanel.tsx`

The task panel can enrich recommendations with guided inputs, planning readiness, and execution preview metadata. The dataset panel uses the data profile and dialect recommendation metadata.

## Metadata-Only Guarantees

Phase F-82 does not:

- execute SQL
- execute joins
- generate SQL
- generate Python
- generate R
- call `executeWorkspaceQuery`
- mutate Query Builder state
- mutate active results
- add AI orchestration

Protected systems remain untouched, including routing, workbook switching, Human/Analyst mode switching, upload/session restore, Monaco workspace, export behavior, active result integrity, pagination, relationship-aware planning, and the execution preview layer.
