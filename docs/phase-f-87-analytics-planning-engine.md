# Phase F-87: Analytics Planning Engine

## Purpose

Phase F-87 adds a metadata-only analytics planning engine. It converts business questions, workflow recommendations, KPI opportunities, semantic entities, execution preview stages, engine recommendations, analytics intent graph metadata, and planning readiness into structured future analytics plans.

The feature lives in `frontend/src/features/analyticsPlanning/`.

## Planning Contracts

The planning layer introduces:

- `AnalyticsPlan`
- `AnalyticsPlanStep`
- `AnalyticsPlanDependency`
- `AnalyticsPlanRequirement`
- `AnalyticsPlanOutput`
- `AnalyticsPlanWarning`

## Step Categories

- data_preparation
- relationship_validation
- metric_selection
- dimension_selection
- grouping
- aggregation
- filtering
- trend_analysis
- forecasting
- statistical_analysis
- segmentation
- dashboard_projection
- explanation_generation
- export_projection

## Plan Statuses

- blocked
- incomplete
- ready
- relationship_pending
- metadata_pending

## Dependency Planning

The planner deterministically models requirements such as:

- Forecasting requires date field metadata.
- KPI tracking requires metric field metadata.
- Grouped analysis requires dimension field metadata.
- Workbook relationship workflows require relationship confirmation.

## Future Output Projections

Plans may project:

- grouped tables
- summary tables
- dashboard widgets
- forecasting charts
- trend charts
- executive summaries
- statistical outputs

These are output projections only. They do not create result tabs, charts, exports, or active results.

## Analyst Metadata

Plans expose:

- ordered future steps
- blocked or pending steps
- missing metadata
- dependency chains
- future engines
- projected outputs
- planning confidence
- execution readiness
- workflow complexity
- deterministic workflow sizing

Complexity levels are `simple`, `moderate`, `advanced`, and `enterprise`.

Sizing includes estimated future step count, relationship complexity, chart count, and KPI count.

## UI Integration

Read-only analytics planning panels were added to:

- `DatasetSummaryPanel.tsx`
- `TaskLauncherPanel.tsx`

Human Mode sees a concise future-plan summary. Analyst Mode can inspect ordered future steps and step statuses in the task panel.

## Metadata-Only Guarantees

Phase F-87 does not:

- execute SQL
- execute joins
- generate SQL
- generate Python
- generate R
- call `executeWorkspaceQuery`
- mutate Query Builder state
- mutate active results
- add AI orchestration

Protected systems remain untouched, including routing, workbook switching, Human/Analyst mode switching, upload/session restore, Monaco workspace, export behavior, active result integrity, pagination, workflow recommendations, KPI intelligence, semantic intelligence, execution preview, analytics intent graph, and relationship-aware planning.
