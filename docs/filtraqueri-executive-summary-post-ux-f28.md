> Superseded notice
> This document is retained for historical and audit context. Current product direction and roadmap authority are defined by `docs/strategy/FILTRAQUERI_PRODUCT_DIRECTION.md`. Do not use this document to override the current direction.

# FiltraQueri Executive Summary Post UX-F28

## Overall State

FiltraQueri is a working analytics workspace with a stable, bounded execution core and a rapidly maturing deterministic intelligence layer. Users can upload CSV/XLSX files, preview/filter/group/query results, paginate, export capped CSVs, switch workbook worksheets, review relationship candidates, and work in separate Human and Analyst modes.

UX-F27 and UX-F28 moved the product toward executive-grade intelligence and governance without adding autonomous behavior. Narrative intelligence is visible in Human Mode Results as compact deterministic insight cards. Runtime intelligence graph contracts are foundational and metadata-only.

## What Is Implemented

- File upload and DuckDB-backed session creation.
- Workspace manifests and basic restore.
- Workbook ingestion, worksheet switching, and relationship review.
- Human Mode data review, filters, query builder, results, history, export, and investigation surfaces.
- Analyst Mode SQL workspace with Monaco, draft restore, SQL diagnostics, templates, and placeholder execution status.
- Active result modeling, result tabs, pagination, sorting, hiding columns, and export payload generation.
- Deterministic metadata layers for semantics, planning, KPI opportunities, workflow recommendations, investigation flows, analysis packages, workspace sessions, narratives, and runtime graph contracts.

## What Is Metadata-Only

- Analysis package generation.
- Investigation deliverable hub files.
- Runtime graph nodes/edges/events/artifacts.
- Runtime confidence and continuation orchestration.
- Optimization, forecasting, scenarios, executive memory, and agentic planning.
- Analyst SQL backend execution.
- Replay and durable immutable lineage.

## What Is Wired Into The UI

- Human Mode dataset/workbook summary.
- Query Builder and filters.
- ResultsGrid.
- Results context side panel.
- Investigation follow-ups.
- Workspace hub and package readiness.
- Executive narrative insights.
- Runtime shell panel/trail/guidance.
- Analyst SQL/Monaco workspace and diagnostics.

## What Is Not Wired Yet

- UX-F28 graph visualization or persistence.
- Runtime artifact storage.
- Replay UI.
- Optimization or forecast workflows.
- Package generation/download.
- Backend event logs.
- Background jobs.
- Agentic orchestration.

## Highest Preservation Priorities

Protect these areas before future phases:

- `executeWorkspaceQuery`
- `ActiveResultModel`
- `ResultsGrid`
- worksheet switching reset behavior
- upload/session/workspace restore
- Human/Analyst switching
- SQL/Monaco draft behavior
- filtering/grouping semantics
- pagination and export limits
- runtime persistence size and normalization
- narrative rendering scope

## Recommended Next Move

The safest next phase is a read-only runtime graph snapshot builder that unifies existing runtime, narrative, investigation, result, and workbook metadata into canonical UX-F28 graph structures without persisting or rendering it yet. That would validate the graph foundation while preserving current behavior.
