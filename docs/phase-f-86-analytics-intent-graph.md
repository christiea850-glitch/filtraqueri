# Phase F-86: Analytics Intent Graph

## Purpose

Phase F-86 adds a metadata-only analytics intent graph. The graph connects business questions, workflow recommendations, KPI opportunities, semantic business entities, execution preview stages, planning readiness, engine recommendations, chart recommendations, relationship signals, and future result shapes.

The feature lives in `frontend/src/features/analyticsIntentGraph/`.

## Node Categories

- business_question
- workflow
- kpi
- semantic_entity
- execution_stage
- engine
- result_shape
- planning_signal
- relationship_signal
- chart_recommendation

## Edge Types

- suggests
- supports
- requires
- connects_to
- depends_on
- visualizes
- grouped_by
- forecasted_by
- analyzed_by

## Metadata Sources

The graph derives only from metadata:

- planning readiness
- execution preview metadata
- workflow recommendations
- KPI intelligence
- business semantics
- business question intelligence
- engine recommendations
- workbook relationship metadata

## Graph Metadata

The report exposes:

- graph confidence: `low`, `moderate`, or `high`
- connected workflows
- connected KPIs
- connected semantic entities
- execution stage dependencies
- recommended future engines
- recommended chart paths
- unresolved blockers
- missing metadata dependencies
- graph health metadata

## Relationship Awareness

The graph includes deterministic relationship-aware signals such as:

- workbook relationship metadata connecting workflow and semantic nodes
- revenue metrics connecting to product or regional workflows
- forecasting workflows connecting to date-aware result shapes and future engines

No workbook joins are executed.

## Graph Health

Graph health includes:

- disconnected nodes
- unresolved dependencies
- missing dimensions
- missing metrics
- missing date fields
- missing relationship confirmations

## UI Integration

Read-only graph summary panels were added to:

- `DatasetSummaryPanel.tsx`
- `TaskLauncherPanel.tsx`

Human Mode sees a compact summary. Analyst Mode can inspect health notes in the task panel.

## Metadata-Only Guarantees

Phase F-86 does not:

- execute SQL
- execute joins
- generate SQL
- generate Python
- generate R
- call `executeWorkspaceQuery`
- mutate Query Builder state
- mutate active results
- add AI orchestration

Protected systems remain untouched, including routing, workbook switching, Human/Analyst mode switching, upload/session restore, Monaco workspace, export behavior, active result integrity, pagination, workflow recommendations, semantic intelligence, KPI intelligence, execution preview, relationship-aware planning, and business question intelligence.
