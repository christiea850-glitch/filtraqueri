# UX-CORE-2 Phase F Checkpoint D - Apply Governed Query Builder Draft Audit

## Document Status

Audit and implementation planning only.

No application code, backend logic, API calls, execution behavior, SQL generation, LLM behavior, ResultsGrid behavior, ActiveResultModel behavior, export/pagination behavior, upload/session restore behavior, routing/back behavior, runtime persistence behavior, or governance contracts are changed by this document.

## Goal

Define the safest future implementation path for:

```text
reviewed GovernedQueryBuilderRequestDraft
-> user clicks Apply to Query Builder for Review
-> existing Query Builder UI is populated
-> user reviews
-> user must separately click existing Run query control before execution
```

This checkpoint must not execute a query, call the backend directly from question workspace code, generate SQL, create results, or mutate result systems.

## Authoritative Sources Reviewed

- `UX_UI_AUDIT/ux-core-2-phase-f-governed-query-builder-request-plan.md`
- `UX_UI_AUDIT/ux-core-2-phase-a-execution-path-audit.md`
- `UX_UI_AUDIT/ux-core-2-workspace-question-to-answer-core-loop-plan.md`
- `UX_UI_AUDIT/filtraqueri-operational-ux-charter.md`
- `frontend/src/components/workspace/QuestionWorkspacePanel.tsx`
- `frontend/src/features/questionWorkspace/questionQueryBuilderRequestTypes.ts`
- `frontend/src/features/questionWorkspace/questionQueryBuilderRequestBuilder.ts`
- `frontend/src/features/query-builder/queryBuilderTypes.ts`
- `frontend/src/features/query-builder/useQueryBuilderController.ts`
- `frontend/src/components/query-builder/VisualQueryBuilderPanel.tsx`
- `frontend/src/features/results/useResultExecutionCoordinator.ts`
- `frontend/src/features/execution/executeWorkspaceQuery.ts`
- `frontend/src/features/dataset/useWorkspaceDatasetController.ts`
- `frontend/src/App.tsx`

## Findings

### 1. Query Builder State Owner

Query Builder state currently lives in `frontend/src/features/query-builder/useQueryBuilderController.ts`.

Owned state:

- `querySelectedColumns`
- `queryGroupBy`
- `queryAggregations`
- `querySortColumn`
- `querySortDirection`
- `queryLimit`
- `hasRunQuery`

The controller exposes setter functions and `restoreQueryBuilder(...)`. It does not import backend services, does not call `executeWorkspaceQuery`, and does not execute when state changes.

### 2. Current Restore / Handoff Function

The existing restore function is:

```ts
restoreQueryBuilder({
  querySelectedColumns,
  queryGroupBy,
  queryAggregations,
  querySortColumn,
  querySortDirection,
  queryLimit,
  hasRunQuery,
});
```

This is the safest existing handoff point for populating the Query Builder UI because it mutates only Query Builder controller state.

Important mapping from `QueryBuilderRequest`:

| QueryBuilderRequest field | Query Builder controller state                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `selected_columns`        | `querySelectedColumns`                                                                    |
| `group_by`                | `queryGroupBy`                                                                            |
| `aggregations`            | `queryAggregations` with generated local `id` values and `null` columns converted to `""` |
| `order_by?.column`        | `querySortColumn`                                                                         |
| `order_by?.direction`     | `querySortDirection`                                                                      |
| `limit`                   | `queryLimit` as string                                                                    |
| `page`                    | not represented in setup state; review starts at future page 1                            |
| `filters`                 | not owned by Query Builder UI state                                                       |

### 3. Existing Query Builder Entry Path

`frontend/src/App.tsx` owns view composition. The `queryBuilder` view renders:

1. `QuestionWorkspacePanel`
2. `VisualQueryBuilderPanel`

The existing Human Mode entry path is `updateDatasetSessionView("queryBuilder")`. This changes the active workspace view but does not execute anything.

Because `QuestionWorkspacePanel` already lives inside the `queryBuilder` view, applying from the current shell usually does not need a visible route change. Still, the future callback should call `updateDatasetSessionView("queryBuilder")` defensively so the same action remains safe if the question review shell later moves.

### 4. Execution Boundary

Query Builder execution currently happens only through `runVisualQuery` in `frontend/src/features/results/useResultExecutionCoordinator.ts`.

`runVisualQuery`:

- sets `isRunningQuery`
- sets `hasRunQuery(true)`
- builds a `QueryBuilderRequest` from current Query Builder state
- calls `executeWorkspaceQuery`
- coordinates the returned result into queried result state
- activates the results view
- adds query history

`restoreQueryBuilder(...)` does none of these things.

`VisualQueryBuilderPanel` runs only when the user clicks its existing `Run query` buttons, which call the `onRunQuery` prop from `App.tsx`. State population alone does not auto-run.

### 5. Existing Guard Against Execution

The key guard is separation of callbacks:

- Populating state: `restoreQueryBuilder(...)`
- Executing state: `runVisualQuery`

Future Phase F Checkpoint D must call only the population path. It must not import or call:

- `executeWorkspaceQuery`
- `runVisualQuery`
- `runQueryBuilder`
- `services/api`

The applied state must set `hasRunQuery: false`.

### 6. Request Shape Compatibility

`GovernedQueryBuilderRequestDraft.request` already uses the existing `QueryBuilderRequest` contract from `frontend/src/features/query-builder/queryBuilderTypes.ts`.

The request candidate shape is compatible with the backend Query Builder execution contract, but the UI state handoff is not one-to-one for filters.

### 7. Filter Ownership Caveat

`QueryBuilderRequest.filters` exists in the backend request contract, but filters are not owned by the Query Builder controller or rendered as editable Query Builder state.

Current Query Builder execution uses `buildActiveBackendFilters()` from the filter controller, not a Query Builder-local filter list.

Therefore, applying a request draft with non-empty `request.filters` to Query Builder state would be incomplete unless the filter controller is also updated. Updating filter state would touch filter workspace behavior and existing workspace metadata persistence, so it should not be included in the first apply-to-review checkpoint.

Safest Checkpoint D rule:

- Allow apply only when `request.filters.length === 0`.
- If filters are present, block apply and show a clear advisory message: "This draft includes filters. Filter handoff needs a later governed checkpoint before applying it to Query Builder."

### 8. Runtime Persistence Caveat

`frontend/src/features/dataset/useWorkspaceDatasetController.ts` already persists active Query Builder state to the workspace manifest through `updateWorkspaceManifest(...)` whenever Query Builder state changes.

That means using `restoreQueryBuilder(...)` may indirectly trigger the existing workspace manifest update effect.

This is not a new persistence system, but it is still a backend/API side effect caused by changing Query Builder state. The implementation checkpoint must explicitly choose one of these approaches:

1. Accept this existing manifest update as already-established session continuity and document it.
2. Add a narrow suppression mechanism so an apply-for-review action remains local-only until a later persistence checkpoint.

The cleanest product behavior is likely option 1, because Query Builder manual edits already persist through the same path. The strictest governance behavior is option 2, because the Phase F request candidate itself has been local-only so far.

Checkpoint D persistence rule:

- Apply to Query Builder for Review may save the Query Builder setup as normal workspace/session continuity.
- This save is allowed.
- This is not analytics execution.
- Apply must not run a query.
- Apply must not call `runVisualQuery`, `executeWorkspaceQuery`, or `runQueryBuilder`.
- Apply must not create ResultsGrid data.
- Apply must not change ActiveResultModel.
- The existing Run query button remains the only execution action.

This audit therefore accepts option 1 for Checkpoint D: existing Query Builder session persistence may occur as a consequence of populating reviewed Query Builder state. The allowed persistence is limited to normal workspace/session continuity and must not be treated as execution, result creation, backend query validation, or answer generation.

## Safest Handoff Function

The safest handoff function is a new App-owned adapter, not a function inside `QuestionWorkspacePanel`.

Recommended shape:

```ts
const applyGovernedQueryBuilderRequestForReview = (
  draft: GovernedQueryBuilderRequestDraft,
) => {
  if (draft.status !== "created_for_review" || !draft.request) return;
  if (draft.request.filters.length > 0) return;

  restoreQueryBuilder({
    querySelectedColumns: draft.request.selected_columns,
    queryGroupBy: draft.request.group_by,
    queryAggregations: draft.request.aggregations.map((aggregation, index) => ({
      id: index + 1,
      function: aggregation.function,
      column: aggregation.column || "",
    })),
    querySortColumn: draft.request.order_by?.column || "",
    querySortDirection: draft.request.order_by?.direction || "ASC",
    queryLimit: String(draft.request.limit || 100),
    hasRunQuery: false,
  });

  setWorkspaceMode("human");
  updateDatasetSessionView("queryBuilder");
};
```

This callback should live in `App.tsx` because App already owns:

- `restoreQueryBuilder`
- `setWorkspaceMode`
- `updateDatasetSessionView`
- Query Builder state passed into `VisualQueryBuilderPanel`
- the composition boundary between Question Workspace and Query Builder UI

`QuestionWorkspacePanel` should receive this callback as a prop and call it only from a user-initiated button.

## Recommended UI Behavior

When draft status is `created_for_review` and `request.filters.length === 0`:

- Show button: `Apply to Query Builder for Review`
- On click, populate Query Builder UI state.
- Keep or move to Query Builder view.
- Show a local review banner near `VisualQueryBuilderPanel`:
  - "Request draft applied for review."
  - "Nothing has run yet."
  - "Review the fields, grouping, sorting, and limit before running."
- The existing `Run query` button remains the only execution action.

When draft is blocked:

- Do not show enabled apply action.
- Show blocking requirements and validation warnings.
- Message: "Resolve the draft requirements before applying it to Query Builder."

When request contains filters:

- Do not apply in Checkpoint D.
- Show: "This draft includes filters. Filter handoff needs a later governed checkpoint before applying it to Query Builder."

## Implementation Plan

### Step 1. Add Request-to-State Mapper

Preferred location:

- `frontend/src/features/questionWorkspace/questionQueryBuilderRequestBuilder.ts`, if kept pure and frontend-only, or
- a new pure helper such as `frontend/src/features/questionWorkspace/questionQueryBuilderReviewMapper.ts`

Function:

```ts
mapQueryBuilderRequestToReviewState(request: QueryBuilderRequest)
```

Output should match `restoreQueryBuilder(...)` input:

- selected columns
- group by
- aggregations with local ids
- sort column/direction
- limit string
- `hasRunQuery: false`

No React, no backend, no execution.

### Step 2. Add App-Owned Apply Callback

Modify `App.tsx` to:

- import the mapper/type as needed
- define `applyGovernedQueryBuilderRequestForReview`
- validate `status === "created_for_review"`
- require `request !== null`
- block non-empty filters in this checkpoint
- call `restoreQueryBuilder(...)`
- set local review banner state if needed
- call `updateDatasetSessionView("queryBuilder")`
- keep `hasRunQuery: false`

Do not call `runVisualQuery`.

### Step 3. Pass Callback To QuestionWorkspacePanel

Extend `QuestionWorkspacePanel` props with an optional callback:

```ts
onApplyQueryBuilderRequestDraft?: (draft: GovernedQueryBuilderRequestDraft) => void;
```

`QuestionWorkspacePanel` should:

- show the apply button only for `created_for_review`
- disable or hide it when `request` is null
- disable or block it when request filters are present
- keep protection copy visible
- not import Query Builder controller, execution, API, or result modules

### Step 4. Add Review Banner

Prefer App-owned or Query Builder-panel prop-based local state:

- `queryBuilderReviewNotice`
- passed to `VisualQueryBuilderPanel`

Possible banner copy:

- "Request draft applied for review."
- "No backend query has executed."
- "Review before running."

The banner must not imply a result exists.

### Step 5. Preserve Existing Run Approval

No new Run button should be added in `QuestionWorkspacePanel`.

Execution remains only in `VisualQueryBuilderPanel` through existing `onRunQuery={runVisualQuery}`.

## Files Likely To Change

Likely:

- `frontend/src/components/workspace/QuestionWorkspacePanel.tsx`
- `frontend/src/App.tsx`
- `frontend/src/features/questionWorkspace/questionQueryBuilderRequestBuilder.ts` or a new pure mapper file
- `frontend/src/components/query-builder/VisualQueryBuilderPanel.tsx` only if a review banner prop is added
- `frontend/src/styles/query-builder.css` only for minimal banner/button styling

Possible only if type reuse is cleaned up:

- `frontend/src/features/query-builder/queryBuilderTypes.ts`

## Files That Must Not Change

Must not change for Checkpoint D:

- `backend/app/main.py`
- backend query, upload, session, and export logic
- `frontend/src/services/api.ts`
- `frontend/src/features/execution/executeWorkspaceQuery.ts`
- `frontend/src/features/results/useResultExecutionCoordinator.ts`
- `frontend/src/features/results/activeResultModel.ts`
- `frontend/src/components/results/ResultsGrid.tsx`
- `frontend/src/features/export/useExportController.ts`
- pagination handlers
- upload/session restore controllers
- SQL Workspace files
- TaskLauncherPanel
- governance documents other than the Checkpoint D audit/plan

## Risks And Safeguards

### Risk: Applying Looks Like Running

Safeguards:

- Button text must say "Apply to Query Builder for Review", not "Run".
- Show "Nothing has run yet."
- Keep existing `Run query` as the separate execution approval.
- Set `hasRunQuery: false`.

### Risk: Hidden Execution

Safeguards:

- Do not call `runVisualQuery`.
- Do not call `executeWorkspaceQuery`.
- Do not import `services/api`.
- Do not update result state.

### Risk: Filter Mismatch

Safeguards:

- Block apply when `request.filters.length > 0` in Checkpoint D.
- Plan filter handoff separately.

### Risk: Manifest Persistence Side Effect

Safeguards:

- Explicitly decide whether existing Query Builder session persistence is allowed.
- If not allowed, defer implementation or add a narrowly scoped suppression mechanism before applying state.

### Risk: Query Builder State Differs From Request Candidate

Safeguards:

- Use a pure mapper from `QueryBuilderRequest` to `restoreQueryBuilder` state.
- Preserve aggregate alias-compatible sorting.
- Convert `COUNT` null columns to `""` because UI state uses empty string for all rows.

### Risk: User Applies Blocked Draft

Safeguards:

- Apply button only appears or enables for `created_for_review`.
- Blocked drafts show requirements and warnings only.

### Risk: ResultsGrid Or ActiveResultModel Mutation

Safeguards:

- Do not call result coordinator.
- Do not set result tabs.
- Do not pass a `WorkspaceExecutionResult`.
- Do not create an execution registry entry.

## Definition Of Done

Checkpoint D implementation will be complete only when:

- A user can apply an eligible `GovernedQueryBuilderRequestDraft` to the existing Query Builder UI.
- Query Builder fields, grouping, aggregations, sort, and limit populate correctly.
- `hasRunQuery` remains `false`.
- No query runs during apply.
- No SQL is generated.
- No backend query executes.
- No result is created.
- ResultsGrid and ActiveResultModel are untouched.
- Blocked drafts cannot be applied.
- Drafts with filters are blocked or explicitly deferred unless a separate filter handoff checkpoint is approved.
- The existing Query Builder `Run query` action remains the only execution action.
- Build passes.
- Governance report confirms no backend/API execution, no SQL generation, no result mutation, no export/pagination changes, no upload/session restore changes, and no SQL Workspace changes.

## Final Recommendation

Proceed with Checkpoint D only as a user-approved UI-state handoff:

```text
QuestionWorkspacePanel apply button
-> App-owned apply callback
-> pure QueryBuilderRequest-to-restore-state mapper
-> restoreQueryBuilder(...)
-> existing Query Builder UI review
-> user separately clicks existing Run query later
```

Do not implement filter handoff in the same checkpoint. Do not execute. Do not create results. Do not generate SQL.
