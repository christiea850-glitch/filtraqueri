# S1-D Result Execution Coordinator Plan

## Purpose

This audit reviews the remaining result execution logic in `frontend/src/App.tsx` after S1-A, S1-B, and S1-C. It proposes the safest boundary for a future extraction into:

`frontend/src/features/results/useResultExecutionCoordinator.ts`

This is an audit-only document. No implementation changes are included.

## Current Remaining Execution Responsibilities In App.tsx

`App.tsx` still owns the executable result path and the state transitions that feed `ResultsGrid`, filters, Query Builder, history, and the execution registry.

Current execution-related responsibilities:

- loading flags:
  - `isFiltering`
  - `setIsFiltering`
  - `isRunningQuery`
  - `setIsRunningQuery`
- result tab activation:
  - `handleResultTabChange`
  - `activateResultTab`
- result state updates:
  - `updatePreviewResult`
  - `updateFilteredResult`
  - `updateQueriedResult`
- execution registry coordination:
  - `coordinateActiveExecution`
  - `coordinateExecutionResult`
  - `recordExecutionResult`
  - `attachExecutionToActiveDataset`
  - `attachActiveResultToActiveDataset`
- backend execution calls:
  - `executeWorkspaceQuery` for filtered results
  - `executeWorkspaceQuery` for preview/filtered pagination
  - `executeWorkspaceQuery` for visual query execution
  - `executeWorkspaceQuery` for query result pagination
- filter actions:
  - `applyFilters`
  - `resetFilters`
- result pagination and sorting:
  - `loadPreviewPage`
  - `loadQueryPage`
  - `sortWorkspaceColumn`
  - `changeWorkspacePage`
  - `changeWorkspaceRowsPerPage`
- query-builder execution:
  - `runVisualQuery`
  - query-builder request construction
  - `setHasRunQuery(true)`
  - query sort state updates
  - query limit update on rows-per-page change
- history updates:
  - filter history
  - reset history
  - query-builder history
- error handling:
  - clear `errorMessage` before execution
  - set contextual failure messages

## Exact Extraction Boundary

Future hook:

`frontend/src/features/results/useResultExecutionCoordinator.ts`

The hook should own only result execution coordination. It should not own rendering, view registry creation, runtime persistence, Human insight navigation, SQL/Analyst rendering, exports, upload/session restore, or workbook switching.

### Move Into Hook

Move:

- `isFiltering` / `setIsFiltering`
- `isRunningQuery` / `setIsRunningQuery`
- `createOrderBy`
- `buildActiveBackendFilters`
- `updatePreviewResult`
- `updateFilteredResult`
- `updateQueriedResult`
- `coordinateActiveExecution`
- `applyFilters`
- `resetFilters`
- `loadPreviewPage`
- `runVisualQuery`
- `loadQueryPage`
- `sortWorkspaceColumn`
- `changeWorkspacePage`
- `changeWorkspaceRowsPerPage`

Potentially move later, but not required in first implementation:

- `handleResultTabChange`
- `activateResultTab`

Recommendation: move `handleResultTabChange` and `activateResultTab` with the hook only if the first implementation can preserve the exact public function names and behavior. They are tightly tied to result activation and `updateDatasetSessionResultTab`, but they are also used by Human insight navigation. If moved, return both handlers from the hook.

### Keep In App.tsx

Keep:

- `exportCurrentResults`
- Human intent selection and navigation:
  - `selectHumanIntent`
  - `navigateHumanInsightAction`
  - `returnToHumanInsight`
  - `createHumanInsight`
- runtime persistence and runtime navigation use from S1-C
- shell mode switch callback
- analyst renderer creation and SQL placeholder execution callback
- `useWorkspaceDatasetController` invocation
- `useActiveResultModel` invocation
- `ResultsGrid` rendering and props
- `WorkspaceShell` rendering

## Required Hook Inputs

Suggested hook signature:

```ts
type UseResultExecutionCoordinatorOptions = {
  dataset: DatasetMetadata | null;
  activeResultTab: ResultTabKey;
  setActiveResultTab: (tab: ResultTabKey) => void;
  activeResult: ResultState;
  activeResultModel: ActiveResultModel | null;
  previewResult: ResultState;
  setPreviewResult: (result: ResultState) => void;
  filteredResult: ResultState;
  setFilteredResult: (result: ResultState) => void;
  queriedResult: ResultState;
  setQueriedResult: (result: ResultState) => void;
  resultHiddenColumns: string[];
  updateDatasetSessionView: (view: ActiveView) => void;
  updateDatasetSessionResultTab: (tab: ResultTabKey) => void;
  buildBackendFilters: (dataset: DatasetMetadata | null) => FilterDefinition[];
  createFilterLabels: (filters: FilterDefinition[]) => string[];
  setFilterValues: (values: Record<string, FilterState>) => void;
  querySelectedColumns: string[];
  queryGroupBy: string[];
  activeAggregations: AggregationState[];
  querySortColumn: string;
  setQuerySortColumn: (column: string) => void;
  querySortDirection: SortDirection;
  setQuerySortDirection: (direction: SortDirection) => void;
  queryLimit: string;
  setQueryLimit: (limit: string) => void;
  setHasRunQuery: (hasRunQuery: boolean) => void;
  recordExecutionResult: ExecutionRegistryRecordFactory;
  attachExecutionToActiveDataset: (executionId: string, datasetId?: string) => void;
  attachActiveResultToActiveDataset: (activeResultId: ResultTabKey, datasetId?: string) => void;
  addHistory: (action: string, detail: string, resultCount: number) => void;
  setErrorMessage: (message: string) => void;
};
```

The exact types should be imported from existing modules rather than redefined.

## Required Hook Outputs

The hook should return:

```ts
{
  isFiltering: boolean;
  isRunningQuery: boolean;
  handleResultTabChange: (tab: ResultTabKey) => void;
  activateResultTab: (tab: ResultTabKey) => void;
  applyFilters: () => Promise<void>;
  resetFilters: () => Promise<void>;
  loadPreviewPage: (...) => Promise<void>;
  runVisualQuery: () => Promise<void>;
  loadQueryPage: (...) => Promise<void>;
  sortWorkspaceColumn: (column: string) => void;
  changeWorkspacePage: (page: number) => void;
  changeWorkspaceRowsPerPage: (rowsPerPage: number) => void;
}
```

If `handleResultTabChange` and `activateResultTab` are not moved in the first S1-D implementation, the hook must instead accept them as inputs. That is lower-risk for implementation but leaves more result orchestration in `App.tsx`.

## Risky Dependencies

### Active Result Closure Dependencies

`loadPreviewPage`, `sortWorkspaceColumn`, and pagination handlers read `activeResult`, `activeResultTab`, and `activeResultModel`. Moving them changes closure boundaries. The hook must receive all current values explicitly and preserve default argument behavior.

### Filter Source Selection

`loadPreviewPage` uses:

```ts
activeResultTab === "filtered"
  ? activeResult.source?.filters || buildActiveBackendFilters()
  : []
```

This must stay identical. It preserves filtered pagination and preview pagination behavior.

### Query Source Reuse

`loadQueryPage` reuses `queriedResult.source?.queryBuilder` when available. This preserves the original selected columns/grouping/aggregations during query pagination and sorting.

Do not rebuild query requests from current draft state when `sourceQuery` exists.

### Has-Run Query Timing

`runVisualQuery` and `loadQueryPage` both call `setHasRunQuery(true)` before backend work. Preserve this timing.

### Query Sort State

`sortWorkspaceColumn` updates query sort state before calling `loadQueryPage` for queried results:

- `setQuerySortColumn(column)`
- `setQuerySortDirection(nextDirection)`
- `loadQueryPage(1, queriedResult.rowsPerPage, column, nextDirection)`

Preserve this exact sequence.

### Rows Per Page For Query Results

`changeWorkspaceRowsPerPage` updates `queryLimit` for queried results before loading:

- `setQueryLimit(String(rowsPerPage))`
- `loadQueryPage(1, rowsPerPage)`

Preserve this exact sequence.

### Execution Registry Attachment

`coordinateActiveExecution` records the execution, updates active result state for non-SQL tabs, attaches execution id to dataset, and attaches active result tab to dataset.

This must remain exactly coupled to result execution. Do not split registry attachment into another hook during first implementation.

### Error Message Text

Failure messages are user-facing and should remain identical:

- "We could not apply those filters. Please try again."
- "We could not reset the filters. Please try again."
- "We could not load that page. Please try again."
- "We could not run that query. Please adjust the builder and try again."
- "We could not load that query page. Please try again."

### Loading Flag Ownership

`isFiltering` feeds:

- `DynamicFiltersPanel.applying`
- `ResultsGrid.loading`

`isRunningQuery` feeds:

- `VisualQueryBuilderPanel.running`
- `ResultsGrid.loading`

The hook must return both flags and preserve when they toggle.

## Behavior Preservation Checklist

Before and after S1-D implementation, verify:

- applying filters activates the filtered tab
- filter labels/history are unchanged
- resetting filters clears filter values, loads preview, clears filtered result, and records reset history
- preview pagination uses preview source with empty filters
- filtered pagination reuses active filtered filters
- query builder execution activates queried tab
- query builder execution records the same history label
- queried pagination reuses the source query payload
- queried sort toggles direction and updates query sort state
- non-query sort uses preview/filter page loading
- changing rows per page in queried results updates `queryLimit`
- changing rows per page in preview/filtered does not update `queryLimit`
- execution registry active records are still attached to active dataset
- active result references remain attached to active dataset
- error messages are identical
- loading states turn off in `finally`

## Manual Test Matrix

### Upload And Preview

1. Upload a CSV.
2. Confirm preview rows load.
3. Sort a preview column.
4. Change preview page.
5. Change rows per page.

Expected:

- preview remains active
- row counts and page metadata remain correct
- `ResultsGrid` rendering unchanged

### Filtering

1. Apply one filter.
2. Confirm filtered tab activates.
3. Sort filtered result.
4. Paginate filtered result.
5. Reset filters.

Expected:

- filtered source uses backend filters
- reset returns to preview and clears filtered result state
- history records Filters and Reset entries as before

### Query Builder

1. Select columns or grouping.
2. Run visual query.
3. Confirm queried tab activates.
4. Sort queried result.
5. Paginate queried result.
6. Change rows per page.

Expected:

- query source payload is preserved across sort/page changes
- query limit changes only for queried rows-per-page
- history records Query builder entry as before

### ResultsGrid Protection

1. Hide/show columns.
2. Copy a cell/row.
3. Search columns.
4. Confirm structural rows still render the same.

Expected:

- no grid behavior changes

### Export Protection

1. Export preview result.
2. Export filtered result.
3. Export queried result.

Expected:

- export payload/source behavior unchanged
- export history unchanged

### Session And Mode Protection

1. Switch Human/Analyst modes.
2. Restore a recent dataset.
3. Switch workbook worksheet.
4. Return to Results.

Expected:

- mode switching unchanged
- restore still rebuilds preview state
- worksheet switching still resets filters/query/results as before

## First Implementation Recommendation

Implement S1-D in two sub-slices, not one broad move.

### S1-D1: Move Result Execution Without Human/Export Changes

Move into `useResultExecutionCoordinator`:

- loading flags
- `createOrderBy`
- `buildActiveBackendFilters`
- result update helpers
- `coordinateActiveExecution`
- filter/query/page/sort/rows-per-page handlers
- `handleResultTabChange`
- `activateResultTab`

Keep in `App.tsx`:

- `exportCurrentResults`
- Human intent and insight navigation
- runtime persistence usage
- analyst renderer callback
- view registry

Reason:

- This removes the main execution block while preserving App-level Human/routing/runtime logic.

### S1-D2: Optional Follow-Up Cleanup

Only after S1-D1 is validated:

- consider a tiny export wrapper hook or keep export in App
- consider moving Human insight coordinator in a separate S1-E phase

Do not combine S1-D with Human insight or runtime changes.

## Validation Requirements For Implementation

Automated:

- `npm.cmd run build`
- targeted lint for:
  - `frontend/src/App.tsx`
  - `frontend/src/features/results/useResultExecutionCoordinator.ts`

Protected-file diff check:

- `frontend/src/components/results/ResultsGrid.tsx`
- `frontend/src/features/results/activeResultModel.ts`
- `frontend/src/features/execution/executeWorkspaceQuery.ts`
- `frontend/src/features/export`
- `frontend/src/features/analyst/sql`
- `frontend/src/features/dataset`
- `frontend/src/features/workbook`
- `frontend/src/features/workbookRelationships`
- `frontend/src/features/workbookIntelligence`
- `frontend/src/features/workspaceRuntime/runtimePersistence.ts`

Manual:

- run the full manual test matrix above

## Rollback Plan

S1-D should be implemented as a single new hook plus `App.tsx` import/use changes. Rollback should require:

- deleting `useResultExecutionCoordinator.ts`
- restoring the moved block in `App.tsx`

Avoid editing the protected files so rollback remains localized.

## Final Recommendation

Proceed with S1-D only after confirming S1-A/B/C behavior in the browser. The implementation should prioritize exact code movement over stylistic cleanup. Do not refactor query request construction, error messages, registry attachment, or loading timing during the first extraction.
