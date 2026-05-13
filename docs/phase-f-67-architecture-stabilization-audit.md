# Phase F-67 Architecture Stabilization Audit

## Scope

Phase F-67 is a stabilization and documentation pass before business intent,
task registry, task launcher, AI planning, or engine abstraction work begins.
It does not redesign UI, execute joins, add AI orchestration, or alter current
result behavior.

## Protected Invariants

- Routing and back behavior must continue to use the existing `activeView`
  and Human insight back-target flow.
- Human/Analyst mode switching must not clear active datasets, active results,
  or SQL workspace metadata.
- Upload/session restore must rehydrate the dataset, preview result, workspace
  mode, SQL workspace metadata, and workbook metadata safely.
- SQL Workspace and Monaco remain isolated from Human Mode workflows.
- Query Builder remains single-active-dataset and schema-driven until a future
  multi-table phase.
- Results pagination, visible columns, row counts, copy-row behavior, and
  export must read through the active result model.
- Workbook worksheet switching preserves the `dataset_id` and `table_name:
  data` active-dataset contract.
- Workbook relationships, accepted contracts, and diagnostics remain
  metadata-only until an explicit join execution phase.

## Current Execution Lifecycle

### Upload / Restore

1. User uploads a CSV/workbook or restores a workspace manifest.
2. Backend returns or rehydrates `DatasetMetadata`, preview rows, workspace
   manifest metadata, and optional workbook metadata.
3. `useWorkspaceDatasetController` stores the dataset through
   `useDatasetSessions`.
4. Preview rows are wrapped with `wrapWorkspaceExecutionOutput`.
5. Preview result state feeds `useActiveResultModel`.
6. Results, pagination, visible columns, copy behavior, and export read from
   the active result model.

### Filter / Query Builder

1. UI controllers build filter/query-builder state.
2. `executeWorkspaceQuery` normalizes execution into a
   `WorkspaceExecutionResult`.
3. Result state updates the active tab.
4. Active result model adapts rows, counts, source metadata, filters, sorting,
   export payload, and insight-ready metadata.

### Worksheet Switching

1. Frontend calls the workbook active worksheet endpoint.
2. Backend repoints DuckDB view `data` to the selected worksheet table.
3. Backend refreshes schema, preview rows, row count, column count, and
   workbook active worksheet metadata.
4. Frontend updates the dataset and preview result.
5. Filtered/query results and Query Builder state reset because the active
   source schema changed.
6. Relationship review/contract metadata remains untouched.

### Relationship Review / Contracts / Diagnostics

1. Relationship candidates are generated during workbook ingestion.
2. Review actions update workbook metadata only.
3. Accepted candidates create accepted relationship contracts.
4. Contract validation and diagnostics inspect metadata/schema/table
   references only.
5. No relationship layer mutates active results, execution requests, SQL
   workspace state, or exports.

### Export

1. Export reads `getExportPayload(activeResultModel)`.
2. Query exports use the active Query Builder snapshot.
3. Filter exports use active filters and sorting.
4. Preview exports use the active source table/view.
5. Export does not read stale preview/filter/query state directly.

## Stabilized Boundaries

- `activeResultModel`: UI read layer for results, row counts, pagination,
  visible columns, export payload, and future insight-readiness.
- `executeWorkspaceQuery`: normalized execution adapter for preview, filters,
  Query Builder, and wrapped SQL placeholder results.
- `useWorkspaceDatasetController`: current coordination layer for upload,
  restore, worksheet switching, recent sessions, and workspace persistence.
- `features/workbook`: frontend workbook metadata normalization and selectors.
- Backend workbook modules: ingestion, relationship profiling, contract
  validation, and diagnostics remain isolated from SQL/query execution.
- `features/analyst/sql`: SQL Workspace, Monaco, dialect context, validation,
  diagnostics, drafts, and snippets remain analyst-scoped.

## Coupling Risks Discovered

- `useWorkspaceDatasetController` coordinates many responsibilities:
  upload, restore, worksheet switching, SQL metadata, recent sessions, and
  result resets. This is acceptable for F-67 but should not absorb future
  task or AI orchestration.
- `App.tsx` still assembles mode-specific views and passes many controller
  callbacks. Future task registry and business intent systems should plug in
  through dedicated feature modules, not through more `App.tsx` branching.
- Preview wrapping is duplicated in upload, restore, and worksheet switching.
  A future helper could safely centralize preview-result application.
- The backend `data` view is a deliberate compatibility contract. Future join
  or multi-table execution must not silently break existing single-active-table
  flows.
- Relationship diagnostics are fetched from the workbook context UI. They are
  read-only, but future polling or caching should stay outside active result
  state.
- Human Mode intent helpers currently configure Query Builder state directly.
  Future business tasks should create structured intent/plan objects first,
  then adapt into existing execution requests.

## Safe Refactors Recommended Later

- Extract `applyPreviewDatasetResult` into a shared dataset/result adapter.
- Move future business-task orchestration into `features/tasks`,
  `features/businessIntent`, and `features/analysisPlanner`.
- Add a formal `analysisPlan -> WorkspaceExecutionRequest` adapter instead of
  teaching UI components how to execute business tasks.
- Add a backend route namespace for future analysis plans instead of expanding
  upload/workbook endpoints.
- Add lightweight lifecycle tests for upload, restore, worksheet switching,
  export payload selection, and relationship metadata-only updates.

## Future Task-System Integration Notes

Future task systems should follow this path:

```text
Business Task
-> Business Intent
-> Analysis Plan
-> Existing execution pipeline or future engine adapter
-> Active Result Model
-> Result explanation / insight layer
```

They should not:

- mutate result state directly,
- bypass `executeWorkspaceQuery`,
- write SQL directly into Monaco,
- execute joins from relationship metadata without a validated join plan,
- persist unvalidated AI-generated plans,
- or add orchestration branches directly inside `App.tsx`.

## Files Reviewed

- `frontend/src/App.tsx`
- `frontend/src/components/layout/WorkspaceShell.tsx`
- `frontend/src/features/dataset/useWorkspaceDatasetController.ts`
- `frontend/src/features/execution/executeWorkspaceQuery.ts`
- `frontend/src/features/results/activeResultModel.ts`
- `frontend/src/features/export/useExportController.ts`
- `frontend/src/features/query-builder/useQueryBuilderController.ts`
- `frontend/src/features/analyst/sql/useSqlWorkspace.ts`
- `frontend/src/features/workbook/workbookMetadata.ts`
- `backend/app/main.py`
- `backend/app/workbook_ingestion.py`
- `backend/app/workbook_relationships.py`
- `backend/app/workbook_contracts.py`
- `backend/app/workbook_contract_diagnostics.py`

## F-68 Readiness

F-68 can safely introduce metadata-only business intent types if it preserves
the boundaries above. The first implementation should be type/registry-first,
with no execution changes and no UI redesign.
