# FiltraQueri Architecture Inventory Post UX-F28

## Frontend Inventory

### Application Shell

- `frontend/src/App.tsx`: top-level state orchestration, routing/view registry, mode switching, query/filter/export actions, active result creation, runtime context composition.
- `frontend/src/components/layout`: workspace shell, split panes, tabs, drill-in details, stat grids.
- `frontend/src/styles`: global design system, layout, responsive, results, filters, query builder, SQL, shell styles.

### Data And Sessions

- `features/dataset/datasetTypes.ts`: dataset, schema, active view, workspace mode, session types.
- `features/dataset/useDatasetSessions.ts`: active dataset registry and recent sessions.
- `features/dataset/useWorkspaceDatasetController.ts`: upload, restore, workbook switching, relationship review, workspace manifest sync.
- `features/dataset/datasetRegistry.ts`: dataset registry mutation helpers.
- `features/workspace`: orchestration snapshots, safe restore, manifest state.
- `features/workspaceRuntime`: current UI-facing runtime context, trail, guidance, persistence, navigation adapters.

### Results And Execution

- `features/results/useResults.ts`: preview/filtered/queried result state.
- `features/results/activeResultModel.ts`: canonical active result model for UI and intelligence consumers.
- `components/results/ResultsGrid.tsx`: table rendering, column visibility, copy behavior, sorting triggers, pagination controls.
- `features/execution/executeWorkspaceQuery.ts`: frontend wrapper for preview/filter/query-builder execution results.
- `features/execution/executionRegistry.ts`: execution record tracking.
- `features/export/useExportController.ts`: export payload mapping and CSV download.

### Human Mode

- Dataset summary and task launcher.
- Dynamic filters.
- Visual Query Builder.
- Results workspace with context strip.
- Investigation report and follow-up prompts.
- Analysis package readiness.
- Investigation workspace hub.
- Executive narrative insights.

### Analyst Mode

- `features/analyst/sql/SqlWorkspace.tsx`: Analyst workspace composition.
- `SqlEditorHost.tsx`: Monaco host, fallback textarea, completions, hover, diagnostics markers.
- `useSqlWorkspace.ts`: draft state, save/load, diagnostics, placeholder run/explain statuses.
- `sqlIntelligence`: dialect metadata, validation, diagnostics, explanations, function/concept matching.
- `sqlWorkspacePersistence`: SQL draft and dialect metadata snapshots.

### Intelligence Layers

- `dataIntelligence`: data profile, dialect recommendation, structural presentation.
- `businessSemantics`: deterministic semantic entity detection.
- `workflowRecommendations`: advisory workflow paths.
- `businessQuestionIntelligence`: question classification and suggestions.
- `analyticsIntentGraph`: metadata intent graph.
- `analyticsPlanning`: future analytics planning report.
- `kpiIntelligence`: KPI opportunity metadata.
- `investigationIntelligence`: investigation context, suggestions, flow, explanations.
- `analysisPackages`: future package manifest and artifact planning.
- `investigationWorkspace`: workspace session, deliverable hub, timeline, audit metadata.
- `narrativeIntelligence`: deterministic narrative scanning, severity, recommendations, timeline.
- `runtimeIntelligence`: UX-F28 canonical graph contracts, events, continuations, artifacts, confidence, narrative runtime integration.

## Backend Inventory

### Core Backend

- `backend/app/main.py`: FastAPI application, DuckDB connections, upload, preview, filtering, query-builder SQL, exports, workspace manifests, workbook operations.
- `backend/requirements.txt`: backend dependencies.

### Workbook Backend

- `workbook_ingestion.py`: XLSX parsing, worksheet normalization, DuckDB insertion.
- `workbook_models.py`: workbook model helpers.
- `workbook_relationships.py`: relationship candidate inference.
- `workbook_contracts.py`: accepted relationship contract handling.
- `workbook_contract_diagnostics.py`: diagnostics for workbook relationships/contracts.

### Backend Storage

- `backend/storage/uploads`: uploaded files.
- `backend/storage/sessions`: DuckDB session databases.
- `backend/storage/manifests`: workspace manifest JSON.

## Executable Boundaries

Executable:

- upload ingestion
- preview/filter/query-builder SQL
- workbook worksheet switching
- relationship review persistence
- contract diagnostics
- capped CSV export
- workspace manifest save/restore

Not executable:

- Analyst SQL backend execution
- narrative generation beyond deterministic frontend templates
- runtime graph execution
- package generation
- optimization/forecast/scenario engines
- replay
- autonomous monitoring

## Documentation Inventory

Relevant post-F20 docs:

- `ux-f20-true-wide-canvas-shell-reflow.md`
- `ux-f21-canonical-chrome-cleanup.md`
- `ux-f22-structural-data-intelligence-cleanup.md`
- `ux-f23-workbook-relationship-intelligence.md`
- `ux-f24-human-investigation-flow-intelligence.md`
- `ux-f25-analysis-package-foundation.md`
- `ux-f26-investigation-workspace-sessions.md`
- `ux-f27-executive-narrative-intelligence.md`
- `ux-f28-runtime-intelligence-graph-foundation.md`

Related phase docs:

- `phase-f-81` through `phase-f-94` cover data profile, workflow recommendations, business semantics, KPI intelligence, business questions, analytics intent graph, planning, execution contracts, and runtime continuation shell layers.
