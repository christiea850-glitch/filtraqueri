# UX-CORE-2 - Phase A Execution Path Audit

## Document Status

Governance and execution-path audit only.

No application code, backend logic, SQL execution behavior, Query Builder behavior, ResultsGrid behavior, ActiveResultModel behavior, pagination, export, upload/session restore, runtime persistence, routing, or governance contracts are changed by this document.

## Authoritative Sources Reviewed

- `UX_UI_AUDIT/ux-core-2-workspace-question-to-answer-core-loop-plan.md`
- `UX_UI_AUDIT/filtraqueri-operational-ux-charter.md`
- `UX_UI_AUDIT/ux-core-1-slice-1-data-tab-charter-enforcement-plan.md`
- `docs/governance-review-checklist.md`
- `docs/governance-hard-fail-rules.md`
- `docs/s2-advisory-vs-executable-boundary-audit.md`
- `docs/s3-h10-runtime-bridge-architecture-checkpoint-audit.md`
- `frontend/src/features/execution/executeWorkspaceQuery.ts`
- `frontend/src/features/results/useResultExecutionCoordinator.ts`
- `frontend/src/features/results/activeResultModel.ts`
- `frontend/src/features/query-builder/useQueryBuilderController.ts`
- `frontend/src/components/query-builder/VisualQueryBuilderPanel.tsx`
- `frontend/src/features/analyst/sql/useSqlWorkspace.ts`
- `frontend/src/features/analyst/sql/SqlWorkspace.tsx`
- `frontend/src/components/results/ResultsGrid.tsx`
- `frontend/src/features/export/useExportController.ts`
- `frontend/src/features/workspace/workspaceOrchestration.ts`
- `frontend/src/services/api.ts`
- `frontend/src/App.tsx`
- `backend/app/main.py`

## 1. Executive Summary

FiltraQueri already has a usable execution spine for Slice 2:

```text
Workspace UI
-> Query Builder state or SQL draft
-> useResultExecutionCoordinator or SQL workspace execution callback
-> executeWorkspaceQuery
-> frontend API client
-> backend validation
-> DuckDB
-> WorkspaceExecutionResult
-> coordinateExecutionResult
-> ResultState / result tab activation
-> ActiveResultModel
-> ResultsGrid
-> export and pagination owners
```

The safest Slice 2 architecture is to add a Workspace-owned question layer before the existing execution spine. That layer should translate a typed question into a draft plan, not an answer. The plan may become a `QueryBuilderRequest` first, or safe SELECT SQL only when Query Builder cannot represent the question cleanly. Execution must remain behind explicit user review and must pass through `executeWorkspaceQuery`, backend validation, and DuckDB.

The strongest governance rule is:

> A natural-language question interpreter may prepare a draft, but only executable/composition owners may run it and mutate result state.

The future question system must not attach to Data, advisory intelligence modules, Runtime Bridge metadata, ResultsGrid, ActiveResultModel, or backend validation internals. It should attach at Workspace composition level, then hand approved plans to existing execution owners.

## 2. Current Execution Lifecycle Diagram

### Current Query Builder Path

```text
User configures Query Builder UI
-> VisualQueryBuilderPanel receives selections and onRunQuery callback
-> App passes onRunQuery = runVisualQuery
-> useResultExecutionCoordinator.runVisualQuery builds QueryBuilderRequest
-> executeWorkspaceQuery({ source: "query-builder", queryBuilder })
-> services/api.runQueryBuilder
-> POST /datasets/{dataset_id}/query-builder
-> backend build_query_builder_sql validates columns, aggregations, sorting, filters
-> DuckDB executes generated SQL and count SQL
-> backend returns columns, rows, total_count, page, limit
-> executeWorkspaceQuery creates WorkspaceExecutionResult
-> useResultExecutionCoordinator.coordinateActiveExecution
-> workspaceOrchestration.coordinateExecutionResult
-> recordExecutionResult and update queried ResultState
-> queried tab becomes active and view moves to results
-> useActiveResultModel normalizes current result
-> ResultsGrid renders rows, columns, sorting, pagination controls
-> export/pagination use existing owners
```

### Current SQL Workspace Path

```text
User edits SQL in Analyst SQL workspace
-> useSqlWorkspace.runDraft
-> executeWorkspaceQuery({ source: "sql", sql })
-> services/api.queryDataset
-> POST /datasets/{dataset_id}/query
-> backend validate_select_query
-> backend blocks multiple statements and blocked keywords
-> backend wraps SQL as SELECT * FROM (...) LIMIT ?
-> DuckDB executes limited SELECT
-> backend returns columns, rows, row_count, limit
-> executeWorkspaceQuery creates WorkspaceExecutionResult
-> SQL workspace stores local preview result
-> optional onExecutionResult callback returns result to App
-> App records SQL execution through coordinateExecutionResult with resultTab = "sql"
-> SQL execution record is attached to active dataset
```

### Future Workspace Question Path

```text
User types business question in Workspace
-> deterministic question translator attempts fast-path mapping
-> LLM fallback may translate only if deterministic confidence is too low
-> draft plan is produced, not executed
-> user reviews fields, logic, expected result, warnings
-> approved QueryBuilderRequest or safe SELECT SQL enters existing execution spine
-> existing backend validation and DuckDB produce the result
-> existing result coordination activates the result
-> ActiveResultModel and ResultsGrid remain the result owners
```

## 3. Ownership Classification Table

| Module / Surface | Classification | Current Owner | Execution Role | Slice 2 Guidance |
| --- | --- | --- | --- | --- |
| Future `QuestionWorkspacePanel` | Presentational | Workspace | No execution; captures question and displays draft/review | Safe as UI only; receives callbacks from composition owner |
| Future question interpreter | Advisory | Workspace | No execution; maps question to intent and candidates | Deterministic first; LLM fallback translation only |
| Future LLM translator adapter | Advisory | Workspace | No execution; produces draft translation only | Must not call execution, mutate results, or fabricate answers |
| Future question plan builder | Advisory | Workspace | Builds `QueryBuilderRequest` or SQL draft | Must not dispatch backend requests |
| Future question execution coordinator | Composition/Hybrid | Workspace | Converts approved draft into existing execution call | Must live outside advisory folders |
| `VisualQueryBuilderPanel` | Presentational | Workspace | Calls supplied `onRunQuery` only | Do not add backend imports |
| `useQueryBuilderController` | Composition state owner | Workspace | Owns Query Builder state; does not call backend | Future question plan may populate state before approval |
| `useResultExecutionCoordinator` | Composition/Hybrid executable | Workspace | Owns filtering, query execution, pagination, sorting, result activation | Best attachment point for approved Query Builder execution |
| `executeWorkspaceQuery` | Executable | Workspace execution | Central frontend execution adapter | Protected; use but do not rewrite for Slice 2 |
| `services/api.ts` | Executable service boundary | Frontend API | Calls backend query, filter, export, upload/session endpoints | Advisory modules must not import directly |
| `/datasets/{dataset_id}/query-builder` | Executable backend | Backend | Runs validated Query Builder SQL through DuckDB | Preserve validation and contract |
| `/datasets/{dataset_id}/query` | Executable backend | Backend | Runs validated SELECT SQL through DuckDB | Preserve SELECT-only validation |
| `build_query_builder_sql` | Executable backend validation | Backend | Validates columns, aggregations, filters, sort, limit/page | Do not bypass |
| `validate_select_query` | Executable backend validation | Backend | Enforces single SELECT and blocked keyword checks | Do not weaken |
| DuckDB connection execution | Execution engine | Backend | Executes approved SQL | No direct LLM or advisory access |
| `coordinateExecutionResult` | Composition/result coordination | Workspace | Records execution and updates ResultState when appropriate | Preserve one result coordination path |
| `ActiveResultModel` | Normalized read model | Workspace results | No execution; normalizes active result for UI/export/readiness | Do not mutate from advisory code |
| `ResultsGrid` | Presentational | Workspace results | Renders active result and calls sort/page callbacks | Do not create second AI result table |
| `useExportController` | Executable export owner | Workspace results | Builds export request and downloads CSV | Question interpreter must not export |
| `SqlWorkspace` / `useSqlWorkspace` | Hybrid | Analyst SQL / Workspace technical depth | Executes SQL through `executeWorkspaceQuery`; persists SQL drafts | Preserve as analyst-depth path; do not auto-mutate drafts |
| `DatasetSummaryPanel` | Presentational/advisory | Data | No execution | Data may hint; must not answer typed questions |
| Business question intelligence | Advisory | Data/Workspace transition debt | Classifies questions; no execution | Do not treat as answer system |
| KPI/business semantics/workflow recommendations | Advisory | Data/Intelligence transition debt | Metadata suggestions only | Do not attach execution |
| Runtime Bridge / Runtime Intelligence | Metadata-only | Background infrastructure | No execution, persistence, routing, or callbacks | Never use as execution launcher |
| App view registry and command launcher | Composition/Hybrid | Application shell | Routes views and passes callbacks | May navigate to Workspace input; should not hide execution |
| Upload/session/workbook restore controllers | Executable/persistence | Data/Home infrastructure | Own dataset activation and restore | Do not modify for Slice 2 Phase A/B |

## 4. Query Builder Execution Trace

### Frontend Preparation

`VisualQueryBuilderPanel` is a presentational Workspace surface. It renders fields, grouping, aggregations, sorting, limits, and the review/run affordance. It receives state and callbacks from `App.tsx`; it does not import backend services or `executeWorkspaceQuery`.

`useQueryBuilderController` owns Query Builder state:

- selected columns
- group by fields
- aggregations
- sort column and direction
- row limit
- whether a query has run
- helper state for Human-intent preconfiguration

The controller does not execute. It can be a safe target for future question-plan preparation if the user must review the state before running.

### Execution Coordination

`useResultExecutionCoordinator.runVisualQuery` is the current Query Builder executable boundary. It:

1. Checks that a dataset exists.
2. Builds backend filters.
3. Builds `order_by`.
4. Constructs a `QueryBuilderRequest` from current Query Builder state.
5. Calls `executeWorkspaceQuery` with `source: "query-builder"`.
6. Coordinates the returned `WorkspaceExecutionResult` into the queried result tab.
7. Activates the `results` view.
8. Adds query history.

This is the safest existing place for future approved question plans to enter execution, either by:

- populating Query Builder state and reusing `runVisualQuery`, or
- adding a narrowly scoped approved-plan runner inside this coordinator in a later implementation checkpoint.

### Backend Validation

The backend `/datasets/{dataset_id}/query-builder` endpoint:

- loads dataset metadata
- builds a valid column set from schema
- calls `build_query_builder_sql`
- validates selected/grouped columns
- validates aggregation functions
- requires aggregation columns except for `COUNT(*)`
- rejects non-grouped selected columns when aggregations are present
- validates filters and sort columns
- applies limit/page offset
- executes data SQL and count SQL in DuckDB

This endpoint is the preferred execution target for deterministic question translations because it provides structured validation and avoids raw SQL when possible.

## 5. SQL Workspace Execution Trace

`SqlWorkspace` and `useSqlWorkspace` are hybrid because they combine editor UI, SQL draft persistence, diagnostics, and executable SQL behavior.

`useSqlWorkspace.runDraft`:

1. Requires an open dataset.
2. Requires a non-empty SQL draft.
3. Sets local SQL execution status to running.
4. Calls `executeWorkspaceQuery` with `source: "sql"`.
5. Stores a local SQL preview result.
6. Calls optional `onExecutionResult` so App can record the execution.

`executeWorkspaceQuery` sends SQL to `services/api.queryDataset`, which calls `/datasets/{dataset_id}/query`.

Backend SQL validation:

- `normalize_query` strips one trailing semicolon and rejects multiple statements.
- `validate_select_query` requires the query to start with `select`.
- blocked SQL keywords are rejected.
- `run_limited_query` wraps the safe query as `SELECT * FROM ({safe_sql}) AS filtered_result LIMIT ?`.

Slice 2 SQL fallback may use this path only after review/approval and only for safe SELECT SQL. The question interpreter must not run SQL directly and must not write into SQL workspace drafts unless the user explicitly chooses an analyst-depth action in a later phase.

## 6. Result Coordination Trace

`executeWorkspaceQuery` returns a `WorkspaceExecutionResult` for preview, filtered, query-builder, and SQL sources. The result includes:

- source
- dataset identity
- filters
- queryBuilder payload or SQL metadata
- sorting
- grouping
- pagination metadata
- status and error
- execution timestamp
- output rows
- output visible columns
- `activeResult` adapter payload

`useResultExecutionCoordinator.coordinateActiveExecution` calls `coordinateExecutionResult`, then attaches the execution and active result to the active dataset.

`coordinateExecutionResult`:

- records the execution through `recordExecutionResult`
- updates the active result state for non-SQL result tabs
- returns an execution-recorded event

Important current distinction:

- Query Builder, filtered, and preview results update ResultState directly.
- SQL workspace execution records an execution with `resultTab = "sql"` through App, but `coordinateExecutionResult` does not update a standard result tab for SQL.

Slice 2 should decide carefully whether SQL fallback should create a Workspace "queried" result through a composition owner or remain an Analyst SQL result. For a user-facing typed-question answer, the result should become an ActiveResultModel-backed Workspace result, not only a SQL preview.

## 7. ActiveResultModel Trace

`ActiveResultModel` is a normalized read model for the current result. It does not execute and should not be treated as mutable storage by advisory systems.

It derives:

- dataset identity
- active source type: preview, filtered, or query
- active result tab
- rows and visible rows
- columns, visible columns, hidden columns
- total count, page, total pages, rows per page
- filter labels and backend filters
- grouping metadata
- sorting metadata
- Query Builder state summary
- export payload
- chart readiness hints
- insight readiness hints

`useActiveResultModel` owns hidden column state and memoizes `createActiveResultModel`.

Future result-based follow-up suggestions may read from ActiveResultModel, but they must remain advisory and may only prepare a new draft. They must not mutate ActiveResultModel or result tabs directly.

## 8. ResultsGrid Trace

`ResultsGrid` is presentational. It receives an `ActiveResultModel` and renders:

- title and result label
- row count summary
- visible column controls
- active filter labels
- loading status
- empty state
- result table
- sorting controls
- pagination controls
- rows-per-page control

It calls supplied callbacks:

- `onHiddenColumnsChange`
- `onSortColumn`
- `onPageChange`
- `onRowsPerPageChange`

`ResultsGrid` should not become an AI answer renderer, execution launcher, or question interpreter. Typed-question answers must flow into the existing result model first, then ResultsGrid can render them as normal results.

## 9. Export / Pagination Trace

### Pagination

Pagination is owned by `useResultExecutionCoordinator`, `ActiveResultModel`, and `ResultsGrid`.

For queried results:

- `ResultsGrid.onPageChange` calls `changeWorkspacePage`.
- `changeWorkspacePage` detects the active tab.
- queried results call `loadQueryPage`.
- `loadQueryPage` reconstructs a `QueryBuilderRequest` from the previous queried result source.
- execution flows through `executeWorkspaceQuery({ source: "query-builder" })`.
- result state is updated without changing the active view.

For preview/filtered results:

- pagination calls `loadPreviewPage`.
- execution flows through preview or filtered source.

Slice 2 must preserve this. A question-generated Query Builder result should store the Query Builder request in `activeResult.source.queryBuilder` so pagination can reuse it.

### Export

Export is owned by `useExportController` and backend `/datasets/{dataset_id}/export`.

`useExportController.exportCurrentResults`:

- reads the ActiveResultModel export payload
- detects source type
- exports query results through `source: "query_builder"` when a queryBuilder payload exists
- exports filtered results through `source: "filter"`
- exports preview results through `source: "preview"`
- calls `services/api.exportDataset`
- downloads the returned CSV blob
- records export history

The backend export endpoint:

- validates query-builder exports through `build_query_builder_sql`
- validates filter/preview exports through filter/order builders
- executes in DuckDB
- returns CSV

Important limitation:

- Current export supports Query Builder, filtered, and preview exports. It does not appear to export arbitrary SQL fallback results through a SQL source. Slice 2 should prefer Query Builder requests for export-compatible typed-question answers. If SQL fallback becomes user-facing, export behavior must be explicitly planned instead of assumed.

## 10. Runtime Persistence Trace

Runtime persistence currently participates in UI/session continuity, not query execution.

Observed runtime persistence involvement:

- `App.tsx` receives `runtimePersistence` and `setRuntimePersistence` from `useWorkspaceRuntimeCoordinator`.
- runtime persistence stores UI/runtime context such as selected task id and navigation selection.
- selected task id is passed into Data/TaskLauncher surfaces.
- SQL workspace metadata is persisted through SQL workspace persistence functions.
- dataset session updates store active view and active result tab through dataset/session owners.

Governance boundary:

- advisory and metadata-only systems must not write runtime persistence directly.
- future typed-question draft persistence should not be added in Phase A or B.
- if typed-question persistence is later needed, it must be added through existing persistence owners with explicit scope and review.

Upload/session dependencies remain owned by dataset controllers and backend upload/session storage. Slice 2 question execution must depend on the currently active dataset but must not alter upload/session restore behavior.

## 11. Safe Workspace Insertion Points

### Safe Insertion Point A: Workspace Question Input

Add a Workspace-owned input panel that captures the user's question and stores local draft state.

Classification:

- Presentational or composition-local.

Allowed:

- question text
- active dataset label
- "Prepare answer" action
- no execution
- no backend calls

### Safe Insertion Point B: Question Interpreter

Add a Workspace-owned interpreter that consumes:

- question text
- dataset schema
- active worksheet/source context
- Data-owned lightweight hints

Classification:

- Advisory.

Allowed:

- deterministic fast-path translation
- LLM fallback translation only when deterministic confidence is too low
- intent, field candidates, ambiguity notes
- draft Query Builder spec or SQL string

Forbidden:

- backend calls
- `executeWorkspaceQuery`
- result mutation
- routing mutation
- persistence writes
- answer text claimed as a result

### Safe Insertion Point C: Review / Approval Surface

Add a Workspace-owned review surface before execution.

Classification:

- Presentational plus composition callback.

Allowed:

- show field mappings
- show plan summary
- show generated Query Builder request or SQL
- show warnings
- actions: run answer, edit fields, cancel, view logic

Forbidden:

- automatic execution on input
- hidden route changes
- hidden result activation

### Safe Insertion Point D: Approved Query Builder Execution

Best first executable path:

- Convert approved question plan to `QueryBuilderRequest`.
- Execute through an approved composition/hybrid owner.
- Reuse `executeWorkspaceQuery({ source: "query-builder" })`.
- Coordinate into queried result state.

Implementation options for a later checkpoint:

1. Populate Query Builder controller state and ask the user to run through existing `runVisualQuery`.
2. Add a narrowly scoped `runPreparedQueryBuilderRequest` to `useResultExecutionCoordinator`.

Option 2 is more direct but touches a protected executable owner and should be implemented only after Phase A/B.

### Safe Insertion Point E: Safe SELECT SQL Fallback

Allowed only when:

- deterministic Query Builder mapping is not sufficient
- LLM, if used, only translates to draft SQL
- SQL is visible before execution
- user approves
- execution still calls `executeWorkspaceQuery({ source: "sql" })`
- backend `validate_select_query` remains the final gate

Risk:

- current SQL path records SQL execution but does not naturally update the standard queried result tab. A user-facing natural-language answer may require additional coordination design to become an ActiveResultModel-backed result.

### Safe Insertion Point F: Result-Based Follow-Ups

After execution, a follow-up generator may read:

- ActiveResultModel
- result columns
- row count
- grouping/sorting/filter metadata
- original question
- generated plan metadata

Classification:

- Advisory.

Allowed:

- suggested next questions
- "prepare draft" actions through Workspace composition

Forbidden:

- auto-run follow-ups
- claim new findings without execution
- mutate results or export

## 12. Unsafe Insertion Points

Do not attach question translation or execution to:

- `DatasetSummaryPanel`
- Data-tab business question cards
- `businessQuestionIntelligence`
- `kpiIntelligence`
- `workflowRecommendations`
- `businessSemantics`
- `runtimeBridge`
- `runtimeIntelligence`
- continuation metadata
- TaskLauncher advanced metadata
- `ResultsGrid`
- `ActiveResultModel`
- backend validation functions
- `services/api` directly from advisory modules
- SQL diagnostics/explanation cards
- command launcher metadata
- export controller
- upload/session restore controllers

Reason:

- these surfaces are advisory, presentational, metadata-only, or protected executable infrastructure. Using them as execution launchers would violate governance boundaries and create duplicate ownership.

## 13. Governance Risks

1. Advisory translator importing execution.
   - Risk: a question interpreter calls `executeWorkspaceQuery` or `services/api`.
   - Guardrail: keep interpreter in advisory folder with no executable imports.

2. LLM answer text treated as a result.
   - Risk: generated prose appears as the analytical answer without data execution.
   - Guardrail: no answer unless backed by executed rows and ActiveResultModel.

3. Data tab regains business-question ownership.
   - Risk: Data question hints become the main question UX again.
   - Guardrail: Data may suggest; Workspace owns typed question and result.

4. SQL fallback bypasses result infrastructure.
   - Risk: SQL preview becomes a parallel answer system.
   - Guardrail: plan explicit coordination before SQL fallback becomes primary.

5. Runtime Bridge metadata gains executable meaning.
   - Risk: continuation or orchestration metadata becomes a hidden dispatcher.
   - Guardrail: Runtime Bridge remains metadata-only.

6. Export incompatibility for SQL fallback.
   - Risk: question answer exports work for Query Builder but not SQL fallback.
   - Guardrail: prefer Query Builder; plan SQL export separately if needed.

7. Hidden route/persistence mutation.
   - Risk: question translation changes views, result tabs, or runtime persistence before approval.
   - Guardrail: translation stays local and advisory until user approval.

## 14. Duplicate Ownership Risks

| Risk | Why It Matters | Recommended Boundary |
| --- | --- | --- |
| Data questions vs Workspace typed questions | Data currently has advisory question surfaces | Data keeps hints only; Workspace owns typed question |
| Query Builder UI vs question plan builder | Both can choose fields/grouping/aggregations | Question plan prepares; Query Builder/coordinator execute |
| SQL Workspace vs generated SQL fallback | SQL Workspace owns analyst SQL editing | Generated SQL is View Logic unless user approves execution |
| ResultsGrid vs AI answer panel | A separate answer panel would duplicate result rendering | ResultsGrid renders all executed tabular answers |
| Intelligence recommendations vs result-based follow-ups | Recommendations may appear before evidence | Follow-ups should be based on actual results |
| Runtime Bridge orchestration language vs real execution | Metadata can sound executable | Execution stays in protected executable owners |
| Export controller vs question workspace | Question UI may want an export action | Export remains active result export only |

## 15. Recommended Slice 2 Attachment Strategy

Recommended architecture:

```text
QuestionWorkspacePanel
-> useQuestionWorkspace
   -> questionInterpreter
   -> questionPlanBuilder
   -> review state
-> approved plan passed to existing execution owner
-> useResultExecutionCoordinator / executeWorkspaceQuery
-> backend validation / DuckDB
-> coordinateExecutionResult
-> ActiveResultModel
-> ResultsGrid
```

Recommended classification:

- `QuestionWorkspacePanel`: presentational.
- `questionInterpreter`: advisory.
- `questionPlanBuilder`: advisory.
- LLM translator adapter: advisory translation only.
- `useQuestionWorkspace`: composition if it only manages draft/review state; hybrid only if it calls approved execution owner.
- `useResultExecutionCoordinator`: executable owner for result creation and activation.

Recommended first execution route:

1. Deterministic fast-path maps recognized questions to Query Builder plans.
2. User reviews the plan.
3. Approved plan runs through existing Query Builder execution path.
4. Result appears as a normal queried result.
5. "View logic" displays the plan and generated request.

Recommended fallback:

- safe SELECT SQL only when Query Builder cannot represent the request.
- keep SQL fallback behind extra review because export/pagination/result-tab behavior needs more care than Query Builder.

## 16. Recommended First Implementation Boundary

The next implementation checkpoint should stop before execution.

Recommended UX-CORE-2 Phase B boundary:

- add Workspace-owned typed question input
- store local draft question
- show active dataset context
- allow "Prepare answer"
- no backend calls
- no SQL generation
- no Query Builder request dispatch
- no ActiveResultModel mutation
- no ResultsGrid changes
- no runtime persistence
- no Data-tab removal beyond bridge copy if already approved

Recommended Phase C/D boundary:

- deterministic interpreter produces draft plan
- LLM fallback remains optional/configurable and translation-only
- no execution
- review surface appears

Recommended Phase E boundary:

- approved Query Builder plan enters existing execution coordinator
- build and governance audit required
- explicit regression checks for ResultsGrid, export, pagination, upload/session restore, SQL workspace, and runtime persistence

## 17. Non-Goals / Forbidden Changes

Phase A and early Slice 2 must not:

- implement NL-to-SQL execution
- add AI execution
- add backend endpoints
- change backend validation
- change DuckDB execution behavior
- change `executeWorkspaceQuery`
- change `useResultExecutionCoordinator`
- change Query Builder behavior
- change SQL Workspace behavior
- change `ActiveResultModel`
- change `ResultsGrid`
- change export logic
- change pagination logic
- change upload/session restore
- change runtime persistence
- route from advisory metadata
- allow Data to execute questions
- fabricate answers
- treat LLM output as a result
- auto-run generated SQL
- create a second result model
- remove TaskLauncherPanel before a safe replacement path exists

## 18. Definition Of Safe Integration

Slice 2 integration is safe only when all of the following are true:

- The business question is owned by Workspace.
- Data only supplies lightweight dataset hints.
- The question interpreter is advisory and cannot call execution, backend, export, routing, result mutation, or persistence.
- Deterministic translation is attempted before LLM fallback.
- LLM fallback is translation assistance only.
- Draft logic is visible before execution.
- The user explicitly approves execution.
- Query Builder specs are preferred over raw SQL.
- safe SELECT SQL fallback remains backend-validated.
- All execution uses `executeWorkspaceQuery`.
- Backend validation and DuckDB remain the only analytics execution path.
- Results are normalized through existing result coordination.
- Active answers are represented through ActiveResultModel.
- ResultsGrid renders the answer.
- Pagination uses existing coordinator behavior.
- Export uses existing export owner.
- Runtime persistence is unchanged unless explicitly scoped later.
- Upload/session restore is unchanged.
- SQL Workspace remains intact.
- No advisory or metadata-only module gains executable power.

## Final Audit Position

FiltraQueri is ready for a careful Workspace-owned typed-question UI, but not for direct AI execution.

The correct next move is to add the question surface and draft planning layer in front of the existing execution spine. The system should feel AI-native to the user, but architecturally it must remain conservative: AI may translate, Workspace may review, existing executable owners may run, backend validation must guard, and ResultsGrid must render only executed data-backed results.
