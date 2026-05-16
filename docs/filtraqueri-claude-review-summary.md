# FiltraQueri Claude Review Companion Summary

## Review Request

Please review FiltraQueri after UX-F28 for architectural alignment, preservation risk, metadata/execution boundaries, and readiness for runtime lineage, replay, continuation orchestration, optimization, forecasting, executive memory, and future agentic planning.

## Current Architecture In One Paragraph

FiltraQueri is a React/Vite frontend with a FastAPI/DuckDB backend. The backend handles upload, workbook ingestion, preview, filtering, query-builder aggregation, worksheet switching, relationship review, workspace manifests, and capped CSV exports. The frontend orchestrates Human Mode and Analyst Mode, maintains result state through ActiveResultModel, renders ResultsGrid, provides a Monaco SQL inspection workspace, and layers deterministic metadata intelligence for planning, semantics, KPI, investigation, package readiness, narrative insights, workspace runtime, and UX-F28 runtime graph contracts.

## Important Boundary

Recent intelligence layers are not autonomous. They are deterministic and advisory unless explicitly listed as executable. UX-F28 is a contract foundation only.

## Implemented And Wired

- Upload/session restore.
- Workbook switching and relationship review.
- Filtering/grouping/query-builder execution.
- ResultsGrid rendering, sort triggers, pagination, column visibility.
- CSV export with cap.
- Human Mode surfaces.
- Analyst SQL workspace with Monaco and draft restore.
- Workspace runtime panel/trail/guidance.
- Investigation and package readiness surfaces.
- Executive narrative insight cards.

## Implemented But Metadata-Only

- Analysis package generation contracts.
- Investigation deliverable hub.
- Narrative recommendations.
- Runtime graph nodes/edges/events/artifacts/confidence.
- Runtime continuation contracts.
- Optimization, forecast, scenario, replay, executive memory, governance audit, and agentic planning foundations.

## Not Implemented

- Backend graph persistence.
- Replay engine.
- Async export jobs.
- Package file generation.
- SQL backend execution from Monaco.
- Optimization or forecast engines.
- Autonomous orchestration.
- Durable immutable runtime event log.

## Most Important Files To Review

- `frontend/src/App.tsx`
- `frontend/src/features/results/activeResultModel.ts`
- `frontend/src/components/results/ResultsGrid.tsx`
- `frontend/src/features/execution/executeWorkspaceQuery.ts`
- `frontend/src/features/dataset/useWorkspaceDatasetController.ts`
- `frontend/src/features/workspaceRuntime/runtimeTypes.ts`
- `frontend/src/features/narrativeIntelligence/*`
- `frontend/src/features/runtimeIntelligence/*`
- `frontend/src/features/investigationWorkspace/*`
- `frontend/src/features/analyst/sql/*`
- `backend/app/main.py`
- `backend/app/workbook_ingestion.py`
- `backend/app/workbook_relationships.py`

## Questions For Architecture Review

1. Should `App.tsx` be decomposed before more runtime graph wiring?
2. Should `runtimeIntelligence` remain separate from `workspaceRuntime`, or should a bridge layer be added immediately?
3. What is the safest persistence location for immutable runtime graph snapshots?
4. Should SQL execution be introduced before or after graph persistence?
5. How should export/package generation be separated from current capped synchronous export?
6. What governance gate is required before optimization, forecasting, or agentic planning?

## Recommended Review Outcome

Approve UX-F28 as a metadata foundation, but require a read-only runtime graph snapshot bridge and validation layer before adding persistence, replay, package generation, optimization, forecasting, or autonomous workflow behavior.
