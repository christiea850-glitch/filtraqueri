# Phase F-84: KPI Intelligence

## Purpose

Phase F-84 adds a metadata-only KPI intelligence and insight opportunity detection layer. FiltraQueri can now identify possible KPIs, business insight opportunities, operational monitoring targets, and analytical focus areas from metadata and semantic intelligence.

The feature lives in `frontend/src/features/kpiIntelligence/`.

## Supported KPI Opportunity Categories

- revenue_tracking
- growth_monitoring
- customer_behavior
- operational_efficiency
- inventory_monitoring
- sales_performance
- regional_performance
- workforce_monitoring
- forecasting_opportunity
- anomaly_detection
- profitability_analysis
- churn_risk
- product_performance
- transaction_monitoring
- executive_reporting

## Metadata Sources

KPI intelligence derives only from metadata signals:

- business semantic entities
- workflow recommendations
- detected metrics and dimensions
- time-series readiness
- workbook relationships
- execution preview metadata
- guided inputs
- data profile metadata
- planning readiness

No KPI values are calculated.

## KPI Opportunity Contract

Each `KpiOpportunity` includes:

- category and label
- rank
- confidence: `low`, `moderate`, or `high`
- Human Mode summary
- supporting metadata signals
- missing metadata blockers
- possible KPI formulas
- possible chart types
- possible dashboard widgets
- likely business questions
- recommended workflow paths
- recommended future engines

Opportunities are deterministic and ranked by metadata score.

## Business Questions

Phase F-84 adds deterministic business-question suggestions, including:

- Which products generate the most revenue?
- Which regions are underperforming?
- Are sales increasing over time?
- Which customers contribute the most value?
- Are operational delays increasing?

These are suggestions only. They do not generate SQL, Python, R, or active results.

## Chart Recommendation Metadata

Supported chart recommendation types:

- KPI cards
- bar charts
- line charts
- trend charts
- grouped comparisons
- heatmaps
- scatter plots
- forecasting charts

Chart recommendations describe likely future visualization shapes. They do not create charts or mutate result state.

## Human And Analyst Visibility

Human Mode summaries stay simple, for example:

- `This dataset may support revenue monitoring.`
- `FiltraQueri detected forecasting opportunities.`
- `Regional performance tracking may be possible.`

Analyst-facing metadata exposes supporting signals, possible formulas, chart types, dashboard widgets, likely questions, workflow paths, and future engines.

## UI Integration

Read-only KPI intelligence panels were added to:

- `DatasetSummaryPanel.tsx`
- `TaskLauncherPanel.tsx`

The task panel can enrich KPI opportunities with guided inputs, planning readiness, and execution preview metadata. The dataset panel uses data profile, workflow recommendation, and business semantic metadata.

## Metadata-Only Guarantees

Phase F-84 does not:

- execute SQL
- execute joins
- generate SQL
- generate Python
- generate R
- call `executeWorkspaceQuery`
- mutate Query Builder state
- mutate active results
- add AI orchestration

Protected systems remain untouched, including routing, workbook switching, Human/Analyst mode switching, upload/session restore, Monaco workspace, export behavior, active result integrity, pagination, workflow recommendations, execution preview, semantic intelligence, and relationship-aware planning.
