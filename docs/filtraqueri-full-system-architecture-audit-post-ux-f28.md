# FiltraQueri Full System Architecture Audit Post UX-F28

## Audit Scope

This audit reviews FiltraQueri after UX-F28 across frontend, backend, runtime intelligence, narrative intelligence, workbook/session architecture, Human Mode, Analyst Mode, ResultsGrid, ActiveResultModel, SQL/Monaco, filtering, grouping, exports, pagination, routing/back behavior, optimization readiness, and continuation/investigation lineage readiness.

No implementation changes are included in this audit package. The audit is documentation-only.

## Current System Position

FiltraQueri is currently a metadata-rich, frontend-led analytics workspace with a DuckDB-backed upload/query backend. Its executable core is intentionally narrow:

- Upload CSV/XLSX files.
- Persist workspace manifests and DuckDB session files.
- Preview, filter, query-builder aggregate, sort, paginate, switch workbook worksheets, review workbook relationships, and export capped CSV results.
- Maintain Human Mode and Analyst Mode as separate workspace experiences.
- Provide SQL/Monaco inspection and draft persistence without backend SQL execution.

Most recent intelligence layers are deterministic, advisory, metadata-first systems. They do not execute backend jobs, mutate query behavior, or automate workflows.

## Frontend Architecture Map

The frontend is a Vite/React application centered on `frontend/src/App.tsx`. `App.tsx` is the orchestration hub for:

- result state and tabs through `features/results/useResults.ts`
- active result normalization through `features/results/activeResultModel.ts`
- dataset upload/session/workbook restore through `features/dataset/useWorkspaceDatasetController.ts`
- filter state through `features/filters/useFilterController.ts`
- visual query builder state through `features/query-builder/useQueryBuilderController.ts`
- query history through `features/history/useQueryHistory.ts`
- export through `features/export/useExportController.ts`
- execution coordination through `features/execution/executeWorkspaceQuery.ts` and `features/workspace/workspaceOrchestration.ts`
- runtime shell context through `features/workspaceRuntime`
- narrative, investigation, analysis package, and runtime intelligence metadata

The main visible UI is organized by:

- `components/layout`: shell, split panes, workspace tabs, metadata rows, detail panels
- `components/dataset`: dataset summary and session panels
- `components/filters`: dynamic filters
- `components/query-builder`: visual query builder
- `components/results`: result tabs and `ResultsGrid`
- `features/analyst/sql`: Analyst Mode SQL workspace and Monaco host
- `components/upload`: upload panel

The strongest architectural pattern is feature-sliced deterministic metadata builders. Most feature layers expose types, builders, selectors/validation where relevant, and hooks when UI consumption is needed.

## Backend Architecture Map

The backend is a FastAPI application in `backend/app/main.py` with supporting workbook modules:

- `workbook_ingestion.py`: parses and ingests XLSX workbook sheets.
- `workbook_models.py`: workbook model helpers/contracts.
- `workbook_relationships.py`: relationship candidate inference.
- `workbook_contracts.py`: accepted relationship contract handling.
- `workbook_contract_diagnostics.py`: relationship contract diagnostics.

Backend storage is file-based:

- `backend/storage/uploads`: uploaded source files.
- `backend/storage/sessions`: per-dataset DuckDB files.
- `backend/storage/manifests`: workspace manifests.

Primary backend endpoints:

- `POST /datasets/upload`
- `GET /datasets/{dataset_id}`
- `GET /datasets/{dataset_id}/preview`
- `POST /datasets/{dataset_id}/filter`
- `POST /datasets/{dataset_id}/query-builder`
- `POST /datasets/{dataset_id}/export`
- `POST /datasets/{dataset_id}/workbook/active-worksheet`
- `POST /datasets/{dataset_id}/workbook/relationship-review`
- `GET /datasets/{dataset_id}/workbook/contract-diagnostics`
- `GET/PUT/DELETE /workspaces...`

Backend execution remains synchronous and bounded. There is no worker queue, replay engine, graph persistence, autonomous orchestration, optimization engine, forecasting engine, or backend SQL execution for Analyst Mode.

## Major Feature Layers

| Layer | Responsibility | Current execution status |
|---|---|---|
| `dataset` | dataset registry, recent sessions, active view, upload restore coordination | wired |
| `workbook` | workbook metadata normalization and contracts | wired |
| `workbookRelationships` / `workbookIntelligence` | relationship candidates, review metadata, join planning | partially wired, advisory |
| `results` | result tabs, active result model, pagination state | wired |
| `execution` | frontend execution wrapper around preview/filter/query-builder | wired |
| `filters` | filter state and backend filter payloads | wired |
| `query-builder` | Human Mode visual query state and query-builder requests | wired |
| `export` | capped CSV export through backend | wired |
| `analyst/sql` | SQL drafts, Monaco, diagnostics, templates, preview placeholder | UI wired; execution placeholder |
| `sqlIntelligence` | deterministic SQL diagnostics/validation/explanations | metadata wired to Analyst Mode |
| `workspace` | orchestration snapshots, manifest restore safety, execution coordination | wired |
| `workspaceRuntime` | runtime shell context, trail, continuation metadata, panel guidance | UI wired, metadata only |
| `analysisPackages` | package/deliverable planning contracts | compact UI wired, metadata only |
| `investigationWorkspace` | session, timeline, deliverable hub, audit metadata | compact UI wired, metadata only |
| `narrativeIntelligence` | deterministic narrative scanning over metadata/sample rows | compact Results UI wired, metadata only |
| `runtimeIntelligence` | canonical runtime graph contracts and narrative runtime references | not visible; metadata contracts only |
| planning/KPI/semantics/question/intent graph | deterministic intelligence layers for future analysis | mostly metadata/advisory |

## UX-F20 Through UX-F28 Status

| UX phase | Implemented as | Current status |
|---|---|---|
| UX-F20 true wide canvas shell reflow | shell/layout CSS and workspace hierarchy | visible UI wired |
| UX-F21 canonical chrome cleanup | navigation/chrome simplification | visible UI wired |
| UX-F22 structural data intelligence cleanup | structural row/column presentation helpers | wired into ResultsGrid display logic |
| UX-F23 workbook relationship intelligence | workbook relationship metadata and review | backend + frontend partially wired |
| UX-F24 Human investigation flow intelligence | investigation report, suggestions, flow | wired into Human surfaces |
| UX-F25 analysis package foundation | package manifest/deliverable planning | compact UI wired, metadata only |
| UX-F26 investigation workspace sessions | session, timeline, deliverable hub | compact UI wired, metadata only |
| UX-F27 executive narrative intelligence | deterministic narrative scanner and cards | compact Results UI wired, metadata only |
| UX-F28 runtime intelligence graph foundation | canonical graph contracts and runtime references | not visible; metadata contracts only |

Note: the repository also contains earlier phase documents `phase-f-81` through `phase-f-94`, which correspond to data profile, workflow recommendation, business semantics, KPI, business question, analytics intent graph, analytics planning, execution contracts, and workspace runtime layers. Those are mostly deterministic metadata layers, with selective UI consumption in dataset, task launcher, build, results, and runtime panels.

## Metadata-Only Versus Executable/Wired Layers

Executable or behavior-wired:

- Backend upload, preview, filter, query-builder, export, workbook worksheet switching, relationship review, workspace manifests.
- Frontend result tabs, sorting, pagination, filtering, query-builder execution, export button, upload/session restore.
- SQL draft save/load, Monaco editor, deterministic diagnostics, but not SQL execution.

UI-wired metadata:

- Runtime shell trail/guidance panel.
- Investigation intelligence suggestions.
- Analysis package readiness.
- Investigation workspace hub.
- Executive narrative insights.
- Workbook relationship metadata.

Metadata-only/not visible:

- UX-F28 canonical runtime intelligence graph contracts.
- Runtime artifact snapshot contracts.
- Runtime confidence contracts.
- Runtime event contracts.
- Runtime continuation contracts outside existing workspace runtime UI.
- Optimization, forecast, scenario, governance audit, and replay readiness contracts.

## Duplication, Fragmentation, And Coupling

Key architectural tensions:

- `App.tsx` is a large orchestrator and now composes many feature reports. This is workable but increasingly coupled.
- There are two runtime concepts: `workspaceRuntime` for current visible runtime panel behavior and `runtimeIntelligence` for canonical future graph contracts. This is intentional after UX-F28 but should be bridged deliberately later.
- Narrative appears in `narrativeIntelligence`, investigation session timeline, and runtime graph references. That is useful lineage coverage, but future changes should avoid divergent narrative IDs and timestamps.
- Workbook relationship logic exists in backend relationship modules and frontend workbook relationship/intelligence modules. Keep backend as source of persisted review state; frontend should remain presentation/planning unless explicitly elevated.
- Export is wired through `ActiveResultModel.export`, frontend `useExportController`, and backend `/export`. Any future export package system must not bypass this lineage.
- SQL workspace has robust frontend intelligence but no real backend SQL execution. That separation is safe, but future SQL execution must not overload the current placeholder `source: "sql"` wrapper.

## Preservation Risks

Highest risk areas before future phases:

- `App.tsx` orchestration coupling: future features can accidentally change routing, mode switching, or result coordination.
- `ActiveResultModel` contract: many intelligence layers read it; changing it would ripple widely.
- `ResultsGrid` rendering: structural intelligence is already wired inside the grid. Avoid adding more intelligence behavior directly into the grid.
- Session restore: recent sessions store result pages and query state; new runtime graph references should not be stored there until normalized and size-bounded.
- Workbook switching: switching worksheets resets filters/query/result state. Future lineage should record that reset, not suppress it.
- SQL/Monaco: Monaco provider lifecycle is sensitive; future SQL execution must not disturb editor diagnostics, fallback, or draft restore.
- Export: currently capped and synchronous; package/export automation would be risky without an explicit job/export architecture.
- Runtime persistence: `localStorage` stores lightweight runtime state only. Do not add heavy graph snapshots there.

## Backend/Frontend Alignment Gaps

Current gaps:

- Frontend has rich metadata contracts for planning, narrative, runtime graph, packages, and sessions; backend does not persist those intelligence artifacts yet.
- Backend manifests persist workspace/query/filter/SQL metadata, but not runtime graph nodes or immutable artifact snapshots.
- SQL workspace does not execute SQL against DuckDB despite having frontend SQL diagnostics.
- Export is synchronous and capped; package/export roadmap expects richer artifact generation later.
- No backend replay, lineage, event log, or immutable audit store exists.
- Workbook ingestion is synchronous and file-local; large workbook/job readiness is not implemented.
- Optimization and forecasting are metadata-ready in names/contracts, but no engines or backend APIs exist.

## Readiness Review

| Future capability | Readiness | Notes |
|---|---|---|
| Replay | medium-low | runtime contracts exist; no persisted graph/event log |
| Lineage graph | medium | canonical node/edge contracts exist; graph not persisted or rendered |
| Continuation orchestration | medium | workspace continuations and UX-F28 contracts exist; execution-neutral only |
| Optimization intelligence | low-medium | future artifact/node families exist; no optimization model/contracts beyond placeholders |
| Forecasting intelligence | low | forecast node family exists; no forecast detectors or backend engine |
| Executive memory | medium | narrative/session/package metadata exist; no long-term memory store |
| Agentic planning | low-medium | governance boundaries are good; no permissioned orchestration layer |
| Runtime governance | medium | confidence/events/artifacts contracts exist; no durable audit backend |

## Safest Next Phases

1. Runtime graph normalization bridge: map `workspaceRuntime`, `investigationWorkspace`, `narrativeIntelligence`, and `runtimeIntelligence` into one read-only snapshot builder.
2. Immutable metadata persistence design: define where graph nodes, artifact snapshots, and event records live before writing any persistence code.
3. Execution boundary hardening: document and type-check every executable path before adding replay or orchestration.
4. Export/job architecture planning: design streaming/export jobs before package generation.
5. SQL execution architecture audit: decide if Analyst SQL execution should be added and how it will preserve Monaco/draft behavior.
6. Optimization readiness contract: add optimization problem/input/output metadata before any solver execution.
7. Runtime governance review: define approval gates for future autonomous or agentic workflows.

## Audit Conclusion

FiltraQueri after UX-F28 is structurally strong for metadata governance and deterministic intelligence. The product has a clear executable core and a growing set of advisory layers that support investigation, narrative, packaging, runtime continuity, and future lineage.

The main architectural risk is not missing capability; it is premature wiring. Future phases should resist turning metadata contracts into execution paths until persistence, lineage, permissioning, and replay safety are designed.
