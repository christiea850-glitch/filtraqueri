# UX-CORE-2 Phase G - User-Approved Query Execution Audit

## Document Status

Audit and implementation planning only.

No application code, backend logic, API behavior, execution behavior, SQL generation behavior, ResultsGrid behavior, ActiveResultModel behavior, export/pagination behavior, upload/session restore behavior, routing/back behavior, runtime persistence behavior, or governance contracts are changed by this document.

## Goal

Confirm that the final user-approved step for a prepared business question can safely use the existing Query Builder execution path:

```text
typed question
-> controlled logic draft
-> governed Query Builder request draft
-> Apply to Query Builder for Review
-> existing Query Builder UI is populated
-> user reviews
-> user clicks existing Run query
-> existing Query Builder backend path executes
-> existing ResultsGrid displays the answer
```

The key rule for Phase G is:

```text
Do not create a new execution path.
Use the existing Query Builder -> backend -> ResultsGrid path.
```

## Authoritative Sources Reviewed

- `UX_UI_AUDIT/ux-core-2-phase-f-checkpoint-d-apply-to-query-builder-audit.md`
- `UX_UI_AUDIT/ux-core-2-phase-a-execution-path-audit.md`
- `UX_UI_AUDIT/ux-core-2-workspace-question-to-answer-core-loop-plan.md`
- `UX_UI_AUDIT/filtraqueri-operational-ux-charter.md`
- `frontend/src/App.tsx`
- `frontend/src/components/query-builder/VisualQueryBuilderPanel.tsx`
- `frontend/src/features/query-builder/useQueryBuilderController.ts`
- `frontend/src/features/questionWorkspace/questionQueryBuilderReviewMapper.ts`
- `frontend/src/features/query-builder/queryBuilderTypes.ts`
- `frontend/src/features/results/useResultExecutionCoordinator.ts`
- `frontend/src/features/execution/executeWorkspaceQuery.ts`
- `frontend/src/features/workspace/workspaceOrchestration.ts`
- `frontend/src/features/results/activeResultModel.ts`
- `frontend/src/features/export/useExportController.ts`
- `frontend/src/services/api.ts`
- `backend/app/main.py`

## Exact Execution Path

When the user clicks the existing Query Builder `Run query` button, the current path is:

```text
VisualQueryBuilderPanel
-> onRunQuery prop
-> App.tsx passes onRunQuery={runVisualQuery}
-> useResultExecutionCoordinator.runVisualQuery
-> builds QueryBuilderRequest from current Query Builder state
-> executeWorkspaceQuery({ source: "query-builder", queryBuilder })
-> services/api.runQueryBuilder
-> POST /datasets/{dataset_id}/query-builder
-> backend query_builder_dataset
-> build_query_builder_sql validates request and composes DuckDB SQL internally
-> DuckDB executes data SQL and count SQL
-> backend returns columns, rows, total_count, page, limit
-> executeWorkspaceQuery creates WorkspaceExecutionResult
-> coordinateActiveExecution(..., "queried", ...)
-> coordinateExecutionResult
-> queried ResultState is updated
-> active execution/result references attach to the active dataset
-> active result tab becomes queried
-> active view becomes results
-> ActiveResultModel normalizes the queried result
-> ResultsGrid renders the result
```

This is the same execution path used by manually configured Query Builder work. A prepared question does not need a separate runner if it has already populated Query Builder state for review.

## What Happens On Run Query

`frontend/src/components/query-builder/VisualQueryBuilderPanel.tsx` renders the existing `Run query` controls. Both run affordances call only the supplied `onRunQuery` prop.

`frontend/src/App.tsx` passes `runVisualQuery` into `VisualQueryBuilderPanel`.

`frontend/src/features/results/useResultExecutionCoordinator.ts` owns `runVisualQuery`. It:

- requires an active dataset
- sets query running state
- clears the current error message
- sets `hasRunQuery(true)`
- builds backend filters from the active filter controller
- builds `order_by` from Query Builder sort state
- constructs a `QueryBuilderRequest`
- calls `executeWorkspaceQuery` with `source: "query-builder"`
- coordinates the returned result into the `queried` result tab
- activates the `results` view
- records query history

No question-workspace module executes anything directly.

## QueryBuilderRequest Validity From Applied Draft State

Checkpoint D applies a governed request draft through `mapQueryBuilderRequestToReviewState(...)` and `restoreQueryBuilder(...)`.

The mapper aligns the governed draft with Query Builder controller state:

| Governed request field | Query Builder review state |
| --- | --- |
| `selected_columns` | `querySelectedColumns` |
| `group_by` | `queryGroupBy` |
| `aggregations` | `queryAggregations` with local ids |
| aggregation `column: null` | aggregation `column: ""` for UI state |
| `order_by?.column` | `querySortColumn` |
| `order_by?.direction` | `querySortDirection` |
| `limit` | `queryLimit` string |
| execution marker | `hasRunQuery: false` |

On execution, `runVisualQuery` rebuilds the actual backend `QueryBuilderRequest` from the reviewed UI state:

- if aggregations are active, `selected_columns` becomes `queryGroupBy`
- `group_by` comes from `queryGroupBy`
- aggregations map empty UI columns back to `null`
- filters come from active workspace filters
- `order_by` comes from Query Builder sorting
- `limit` comes from `queryLimit`
- `page` starts at `1`

This is safe for Phase G because Checkpoint D blocks governed draft apply when `request.filters.length > 0`. Filter handoff is intentionally deferred. If the user has independently configured active workspace filters, the normal Query Builder execution path includes them as existing product behavior.

## Backend And DuckDB Path

`executeWorkspaceQuery` delegates Query Builder execution to `services/api.runQueryBuilder(...)`.

`runQueryBuilder` sends:

```text
POST /datasets/{dataset_id}/query-builder
Content-Type: application/json
body: QueryBuilderRequest
```

`backend/app/main.py` handles this through `query_builder_dataset(...)`, which:

- loads dataset metadata
- derives valid schema columns
- calls `build_query_builder_sql(...)`
- executes the validated DuckDB query
- executes a count query for pagination metadata
- returns columns, rows, total count, page, and limit

`build_query_builder_sql(...)` validates:

- selected columns
- grouped columns
- aggregation functions
- required aggregation columns except `COUNT(*)`
- selected-column/grouping compatibility when aggregations exist
- filters
- sort direction
- sort column
- limit and page through the Pydantic request model

This confirms that Phase G can use the existing backend/DuckDB path. The backend does compose SQL internally, but that is the existing Query Builder execution implementation, not new frontend SQL generation.

## Result Routing

`executeWorkspaceQuery(...)` creates a `WorkspaceExecutionResult` with:

- `source: "query-builder"`
- dataset identity
- filters
- `queryBuilder` request snapshot
- sorting
- grouping
- pagination metadata
- output rows
- output visible columns
- `activeResult` payload for result state

`useResultExecutionCoordinator.coordinateActiveExecution(...)` calls `coordinateExecutionResult(...)`.

For Query Builder results, the result tab is `queried`, so `coordinateExecutionResult(...)` updates the queried `ResultState`. The coordinator then attaches the execution and active result to the active dataset.

The user is moved to the existing `results` view, and the queried result tab becomes active.

## ActiveResultModel Update

`frontend/src/features/results/activeResultModel.ts` derives the active result model from the queried `ResultState`.

For a Query Builder result, the model exposes:

- `sourceType: "query"`
- active rows and columns
- visible and hidden columns
- total count, current page, total pages, and rows per page
- filters
- grouping
- sorting
- query summary state
- export payload containing the stored Query Builder request
- chart and insight readiness hints

No advisory question module should mutate ActiveResultModel. The model is updated indirectly through the existing result coordination path after the user clicks Run query.

## ResultsGrid Behavior

`ResultsGrid` remains the result renderer. It receives the `ActiveResultModel` and displays:

- result label and row count
- visible columns
- active filters
- table rows
- sorting controls
- pagination controls
- rows-per-page control

Phase G should not create a second answer table or an AI-only result surface. A business-question answer becomes a normal queried result.

## Query History

`runVisualQuery` currently records history with:

- action: `Query builder`
- detail: either aggregation count or visible column count
- result count: backend total count

This works for generic Query Builder execution, but it does not preserve the original typed business question. Phase G can execute safely without changing history, but the product traceability goal is only partially met.

Recommended future addition:

- carry a lightweight prepared-question context from the apply/review shell into the eventual query history entry or result logic disclosure
- avoid changing the execution path
- avoid using LLM-generated prose as proof of answer

## Pagination And Sorting

Pagination remains intact for Query Builder results.

`ResultsGrid.onPageChange` calls `changeWorkspacePage(...)`. When the active tab is `queried`, the coordinator calls `loadQueryPage(...)`.

`loadQueryPage(...)` reconstructs a Query Builder request from the stored queried result source:

- previous `selected_columns`
- previous `group_by`
- previous `aggregations`
- previous filters
- current sort
- requested page
- requested rows per page

It then calls `executeWorkspaceQuery({ source: "query-builder" })` again through the same backend endpoint.

Sorting queried results also uses `loadQueryPage(...)` and the existing Query Builder request snapshot. Phase G must preserve this source snapshot behavior.

## Export Behavior

Export remains intact for Query Builder results.

`useExportController.exportCurrentResults(...)` reads the ActiveResultModel export payload. If the active source type is `query` and a Query Builder request exists, export calls:

```text
POST /datasets/{dataset_id}/export
source: "query_builder"
query_builder: stored QueryBuilderRequest
```

The backend export endpoint reuses `build_query_builder_sql(...)`, so export receives the same validation protections as execution.

Phase G should not add export logic to Question Workspace. Export remains owned by the active result/export controller.

## Generated SQL Visibility

Generated SQL is hidden in the current Query Builder path.

The backend composes SQL internally inside `build_query_builder_sql(...)`, but `/datasets/{dataset_id}/query-builder` returns only:

- dataset id
- columns
- rows
- row count
- total count
- limit
- page

The frontend `QueryBuilderResponse` does not include SQL, and `executeWorkspaceQuery(...)` does not attach generated SQL for Query Builder results.

This is acceptable for Phase G. A future "View Logic" layer should show the reviewed Query Builder request, selected fields, grouping, aggregations, sorting, filters, and validation notes. It should not claim SQL exists in the frontend unless a later governed SQL-explain feature is explicitly added.

## Traceability To Original Question

Current traceability is incomplete.

What exists:

- Question Workspace shows the governed draft before apply.
- Query Builder review notice confirms the request draft was applied.
- Query Builder state shows the fields, grouping, aggregation, sort, and limit.
- The executed result stores the Query Builder request snapshot.

What is missing:

- The queried result does not retain the original natural-language question.
- Query history does not name the original question.
- ActiveResultModel does not expose prepared-question provenance.
- ResultsGrid does not show "Answered question: ..."

Phase G execution can proceed safely without this, but a small follow-up implementation should add traceability. The safest version is a Workspace-owned provenance note attached around execution coordination or query history, not an advisory module mutating result state directly.

Recommended copy:

```text
Answered question: "Which realtor manages the most properties?"
Logic source: Query Builder request reviewed by user
```

## Answer Summary Layer

No additional answer summary layer is required for the execution path to be safe.

However, the product experience would benefit from a small post-result explanation layer after the queried result appears. It should be based on executed result metadata and rows, not on the pre-execution draft alone.

Recommended future scope:

- show the original question when available
- show plain-language logic summary
- show result count and top visible outcome when safe
- show "View logic" disclosure with Query Builder request details
- keep ResultsGrid as the canonical result table
- avoid LLM-generated claims unless clearly grounded in the executed result

This should be treated as result interpretation or View Logic, not as a new execution mechanism.

## Safety Assessment

The existing Run query path is safe for Phase G if these boundaries are preserved:

- user must click the existing Query Builder `Run query` button
- question-workspace code must not call execution
- no new backend endpoint is introduced
- no SQL is generated in the frontend
- backend Query Builder validation remains the final execution gate
- result creation flows only through `executeWorkspaceQuery` and result coordination
- ResultsGrid and ActiveResultModel remain the result owners
- export and pagination continue to use the stored Query Builder request snapshot

The applied draft from Phase F is a setup/review action. The Phase G run action is explicit user-approved execution.

## What Must Be Preserved

- `VisualQueryBuilderPanel` remains presentational and calls `onRunQuery` only.
- `useQueryBuilderController` remains the owner of Query Builder setup state.
- `runVisualQuery` remains the Query Builder execution owner.
- `executeWorkspaceQuery` remains the frontend execution adapter.
- `services/api.runQueryBuilder` remains the Query Builder API boundary.
- Backend `/datasets/{dataset_id}/query-builder` remains the executable endpoint.
- `build_query_builder_sql` remains the validation/composition gate.
- `coordinateExecutionResult` remains the result coordination path.
- ActiveResultModel remains derived from result state.
- ResultsGrid remains the canonical result table.
- Export and pagination remain owned by existing result/export controllers.
- SQL Workspace remains separate.
- Upload/session restore behavior remains unchanged.

## Risks And Safeguards

### Risk: Creating A Parallel Question Execution Path

Safeguard:

- Do not add a `runPreparedQuestion` path in Question Workspace for Phase G.
- Use the existing `Run query` button and `runVisualQuery`.

### Risk: Advisory Code Executes

Safeguard:

- Question translator, logic draft builder, request draft builder, and review mapper must not import `executeWorkspaceQuery`, `services/api`, or result mutation modules.

### Risk: Filter Mismatch

Safeguard:

- Continue blocking apply for governed request drafts with non-empty request filters until filter handoff has a separate governed checkpoint.
- If users manually configure filters in the existing filter workspace, those filters may execute through normal Query Builder behavior.

### Risk: Original Question Is Lost

Safeguard:

- Add a later lightweight provenance handoff from the reviewed question draft into query history or a result logic disclosure.
- Do not block Phase G execution on this, but document it as a product gap.

### Risk: Generated SQL Expectations

Safeguard:

- Be explicit that Query Builder execution uses backend-generated SQL internally, but no frontend SQL is generated or shown.
- Use "Query Builder logic" or "request logic" for View Logic until a governed SQL-explain feature exists.

### Risk: Export Or Pagination Loses Query Context

Safeguard:

- Preserve `activeResult.source.queryBuilder` in executed Query Builder results.
- Do not strip the Query Builder request from `WorkspaceExecutionResult`.

### Risk: Result Systems Are Mutated From The Wrong Layer

Safeguard:

- All result mutation must continue through `coordinateActiveExecution(...)` and `coordinateExecutionResult(...)`.
- Do not mutate ResultsGrid, ActiveResultModel, or result tabs from question advisory modules.

## Small UI / UX Additions That May Be Needed

These are optional follow-up improvements and should not create a new execution path:

- show a small "Prepared question" note near the Query Builder review banner before execution
- after execution, show "Answered question" near the queried result header or View Logic disclosure
- add a "View logic" disclosure for the executed result that displays the Query Builder request summary
- improve query history detail to include the original question when the result came from a prepared question
- show that SQL is not displayed for Query Builder execution unless a later explain feature is approved

These additions should be Workspace/result presentation changes only. They should not change backend execution, ResultsGrid ownership, ActiveResultModel ownership, pagination, export, upload/session restore, or SQL Workspace behavior.

## Implementation Recommendation

Proceed with Phase G by reusing the existing Query Builder run path exactly:

```text
Apply to Query Builder for Review
-> restoreQueryBuilder(...)
-> user reviews existing Query Builder UI
-> user clicks existing Run query
-> runVisualQuery
-> executeWorkspaceQuery({ source: "query-builder" })
-> services/api.runQueryBuilder
-> backend /datasets/{dataset_id}/query-builder
-> DuckDB
-> WorkspaceExecutionResult
-> queried ResultState
-> ActiveResultModel
-> ResultsGrid
```

Do not implement a separate "Run prepared question" button in Question Workspace for this phase.

Recommended first Phase G implementation should be limited to verification and small traceability UI if desired. The execution itself already exists.

## Files Likely To Change In A Future Implementation

Only if adding traceability or explanatory UI:

- `frontend/src/App.tsx`
- `frontend/src/components/workspace/QuestionWorkspacePanel.tsx`
- `frontend/src/components/query-builder/VisualQueryBuilderPanel.tsx`
- a small Workspace/result provenance type or helper, if needed
- result header or View Logic surface, if one is introduced in a later governed checkpoint

Potentially, if query history is enhanced:

- the local history owner where `addHistory(...)` is defined
- `frontend/src/features/results/useResultExecutionCoordinator.ts` only if the history detail needs to receive prepared-question context

## Files That Must Not Change For Phase G Execution Reuse

- `backend/app/main.py`, unless a separate backend audit finds a bug
- `frontend/src/services/api.ts`
- `frontend/src/features/execution/executeWorkspaceQuery.ts`
- `frontend/src/features/results/activeResultModel.ts`
- `frontend/src/components/results/ResultsGrid.tsx`
- `frontend/src/features/export/useExportController.ts`
- upload/session restore controllers
- SQL Workspace files
- TaskLauncherPanel
- Query Builder backend contract

## Definition Of Done

Phase G is complete only when:

- A governed draft can be applied to Query Builder for review.
- The user must click the existing Query Builder `Run query` button to execute.
- Clicking `Run query` builds a valid `QueryBuilderRequest` from reviewed Query Builder state.
- Execution uses `executeWorkspaceQuery({ source: "query-builder" })`.
- The frontend API call is `POST /datasets/{dataset_id}/query-builder`.
- Backend validation through `build_query_builder_sql(...)` remains intact.
- DuckDB execution happens only through the existing backend endpoint.
- The result is coordinated into the `queried` result tab.
- ActiveResultModel reflects the queried result.
- ResultsGrid renders the answer.
- Pagination works from the stored Query Builder request.
- Export works through the existing query-builder export path.
- No separate execution path is added.
- No frontend SQL generation is added.
- No automatic execution occurs on apply.
- No ResultsGrid or ActiveResultModel mutation occurs from advisory question modules.
- SQL Workspace, upload/session restore, routing, export, and pagination ownership remain intact.
- If traceability is implemented, the original question is shown as provenance without changing execution ownership.

## Final Audit Position

The existing Query Builder run path is the correct and safe Phase G execution path for prepared business questions.

Checkpoint D already established the safe review boundary: applying a governed draft populates Query Builder state without running. Phase G should let the user use the existing Run query button, allowing the established Query Builder/backend/ResultsGrid pipeline to produce the real data-backed answer.

The only notable product gap is traceability from the executed result back to the original natural-language question. That gap should be addressed with lightweight Workspace/result provenance, not with a new execution path.
