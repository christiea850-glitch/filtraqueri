# UX-CORE-2 - Phase F Governed Query Builder Request Generation Plan

## Document Status

Planning, audit, and implementation preparation only.

No application code, backend logic, SQL generation, SQL execution behavior, Query Builder behavior, ResultsGrid behavior, ActiveResultModel behavior, pagination, export, upload/session restore, runtime persistence, routing, command channels, API calls, LLM calls, or governance contracts are changed by this document.

## Authoritative Sources Reviewed

- `UX_UI_AUDIT/ux-core-2-workspace-question-to-answer-core-loop-plan.md`
- `UX_UI_AUDIT/ux-core-2-phase-a-execution-path-audit.md`
- `UX_UI_AUDIT/ux-core-2-phase-e-controlled-logic-draft-plan.md`
- `UX_UI_AUDIT/filtraqueri-operational-ux-charter.md`
- `frontend/src/features/questionWorkspace/questionLogicDraftTypes.ts`
- `frontend/src/features/questionWorkspace/questionLogicDraftBuilder.ts`
- `frontend/src/components/workspace/QuestionWorkspacePanel.tsx`
- `frontend/src/features/query-builder/queryBuilderTypes.ts`
- `frontend/src/features/query-builder/useQueryBuilderController.ts`
- `frontend/src/features/execution/executeWorkspaceQuery.ts`

## Executive Summary

Phase F should define a governed bridge from a reviewed `ControlledLogicDraft` to a reviewable `QueryBuilderRequest` candidate.

This future request must remain non-executed until the user explicitly approves execution through existing Workspace execution owners. Phase F must not generate SQL, call backend APIs, call `executeWorkspaceQuery`, mutate Query Builder state automatically, mutate result state, activate result tabs, write persistence, or create results.

The intended future path is:

```text
User question
-> schema-aware draft plan
-> selected clarification fields
-> controlled logic draft
-> eligibility validation
-> reviewable Query Builder request candidate
-> user approval
-> existing execution owner runs approved request in a later phase
```

The request candidate is a frontend planning artifact. It is not an answer, not SQL, not backend validation, and not an execution result.

## 1. Phase F Responsibility

Phase F may eventually create a structured Query Builder request candidate from a controlled logic draft when the draft is eligible.

It may define:

- eligibility rules
- selected field requirements
- schema/type compatibility checks
- mapping from controlled draft ideas to Query Builder request fields
- local review state for a generated request candidate
- user-facing review copy
- approval handoff rules for a later execution phase

It must not execute the request.

The request candidate should answer:

- Which columns would be selected?
- Which fields would be grouped?
- Which aggregation would be requested?
- Which sort would be requested?
- What limit/page would be proposed?
- Which requirements still block execution?
- What must the user approve before anything runs?

## 2. Phase F Must Not Do

Phase F must not:

- generate SQL
- call backend APIs
- call `executeWorkspaceQuery`
- call `runQueryBuilder`
- import `services/api`
- mutate Query Builder controller state automatically
- mutate ResultsGrid
- mutate ActiveResultModel
- mutate ResultState
- activate result tabs
- write runtime persistence
- write upload/session state
- change routing or browser history
- add export or pagination behavior
- call an LLM
- claim that an answer exists

Even when a request candidate is valid, execution remains a later user-approved action handled by existing execution owners.

## 3. Eligibility Rules

A `ControlledLogicDraft` is eligible for Query Builder request candidate creation only when all of the following are true:

1. `draftKind === "query_builder_plan"`.
2. `executionStatus === "draft_only"`.
3. `generatedSql === null`.
4. `generatedQueryBuilderRequest === null` before candidate generation.
5. `draftStatus === "draft_only"`.
6. `blockingRequirements.length === 0`.
7. The draft has no unresolved ambiguity warning that affects selected fields.
8. Every selected field exists in the active dataset schema.
9. Every field used for grouping, aggregation, sorting, or filters exists in the active dataset schema.
10. Aggregation and grouping choices can be represented by the existing Query Builder contract.
11. The planned output type maps to a table-like Query Builder result.

Drafts should remain ineligible when:

- intent is `unknown`
- `clear_intent` is required
- a required dimension is missing
- a required measure is missing for a numeric aggregate
- a trend/timeline draft lacks a valid date field
- filter values are incomplete
- anomaly review requires unsupported threshold logic
- the draft requires logic outside Query Builder's supported contract

Ineligible drafts may still be shown as advisory planning. They must not create a request candidate.

## 4. Required Field Selections

Required fields depend on the detected intent and controlled draft operations.

### Ranking

Required:

- selected dimension when grouping is needed
- selected numeric measure for `sum`, `average`, `min`, or `max`

Allowed without measure:

- `count_records`

Request preparation:

- group by selected dimension
- aggregate selected measure or count records
- sort by aggregate output when ranking direction is known
- limit to drafted top-N idea, usually 10

### Aggregation

Required:

- selected numeric measure for numeric aggregate

Allowed without measure:

- `count_records`

Optional:

- selected dimension if grouped summary is intended

Request preparation:

- no grouping for single KPI-style aggregate
- group by selected dimension only when the draft selected one
- no default sort unless grouping exists

### Trend / Timeline Review

Required:

- selected date field

Required when numeric aggregation is used:

- selected numeric measure

Allowed without measure:

- `count_records`

Request preparation:

- group by the selected date field in the current Query Builder contract
- aggregate selected numeric measure or count records
- sort by date ascending

Note: date bucketing such as month/week/year may require future Query Builder/backend support. Until that support exists, the candidate should either group by the raw date field or remain blocked with a clear warning.

### Comparison

Required:

- selected dimension

Required when numeric aggregation is used:

- selected numeric measure

Allowed without measure:

- `count_records`

Request preparation:

- group by selected dimension
- aggregate selected measure or count records
- sort only when wording implies best/worst/top/bottom

### Distribution

Required:

- selected categorical/text/boolean dimension

Request preparation:

- group by selected dimension
- count records
- no share/percent calculation in Phase F unless Query Builder explicitly supports it later

### Segmentation

Required:

- selected dimension

Optional:

- selected numeric measure

Request preparation:

- group by selected dimension
- count records or aggregate selected numeric measure

### Anomaly Review

Default:

- not eligible for Query Builder request generation unless the draft has been reduced to simple sorting/counting with explicit selected fields

Blocked when:

- threshold logic is implied
- unusual-value logic is implied
- metric/date/dimension requirements are unresolved

## 5. Validation Rules Before Request Creation

Future request generation must run validation immediately before creating a candidate.

### Schema Existence

Validate:

- selected dimension exists in `dataset.schema`
- selected measure exists in `dataset.schema`
- selected date field exists in `dataset.schema`
- all grouping fields exist in `dataset.schema`
- aggregation field exists unless the aggregation is `COUNT` with `column: null`
- sorting field exists or matches a locally derived aggregation alias
- filter fields exist

### Type Compatibility

Validate:

- `SUM`, `AVG`, `MIN`, and `MAX` require numeric fields unless backend support changes
- `COUNT` may use `column: null` for count records
- `COUNT DISTINCT` is not currently represented by the frontend Query Builder request type and should remain blocked or downgraded only with explicit user review
- distribution grouping requires categorical/text/boolean field
- trend/timeline requires date field
- grouping should use categorical/text/boolean/date fields only when they are accepted by current Query Builder behavior

### Query Builder Contract Compatibility

Validate:

- selected columns are compatible with grouping and aggregation
- grouped aggregate requests do not include non-grouped selected columns unless backend contract allows it
- sort field is either a grouped field or aggregate output alias
- limit is a positive integer
- page is initialized to `1`
- filters are complete before included

### Ambiguity And Missing Requirements

Validate:

- `blockingRequirements.length === 0`
- high-confidence ambiguity is resolved by local selected clarification fields
- low-confidence candidates remain suggestions unless selected by the user
- warnings that affect request correctness are resolved or shown as blockers

### Safety Guarantees

Before candidate creation:

- no SQL exists
- no backend validation has run
- no query has run
- no result exists
- request candidate has no executable callback fields

After candidate creation:

- candidate remains local review state only
- execution still requires explicit user approval

## 6. Query Builder Request Shape Alignment

The existing frontend Query Builder request contract is:

```ts
type QueryBuilderRequest = {
  selected_columns: string[];
  group_by: string[];
  aggregations: Array<{
    function: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
    column: string | null;
  }>;
  filters: FilterDefinition[];
  order_by?: SortDefinition | null;
  limit: number;
  page: number;
};
```

Phase F mapping should align as follows:

| Controlled draft field | Query Builder request field | Notes |
| --- | --- | --- |
| `selectedFields.dimension` | `selected_columns`, `group_by` | Include when grouping is required. |
| `grouping.fields` | `group_by` | Must be schema-valid. |
| `aggregation.idea: "count_records"` | `aggregations: [{ function: "COUNT", column: null }]` | Maps to count rows. |
| `aggregation.idea: "sum"` | `function: "SUM"` | Requires numeric field. |
| `aggregation.idea: "average"` | `function: "AVG"` | Requires numeric field. |
| `aggregation.idea: "min"` | `function: "MIN"` | Requires numeric field under current rule. |
| `aggregation.idea: "max"` | `function: "MAX"` | Requires numeric field under current rule. |
| `aggregation.idea: "count_distinct"` | blocked initially | Existing type has no distinct flag. |
| `sorting` | `order_by` | Field must be grouped field or aggregate alias. |
| `limit.value` | `limit` | Use safe default if null, such as existing Query Builder default `100`. |
| planned first page | `page` | Always initialize as `1`. |
| controlled filters | `filters` | Include only complete reviewed filters. |

### Selected Columns Rule

For grouped aggregate requests, `selected_columns` should include grouped fields only. Aggregate output columns are produced by the backend response and should not be added as selected raw columns unless the current backend contract requires otherwise.

For ungrouped aggregate requests, `selected_columns` may be empty when an aggregation is present.

For non-aggregate table drafts, `selected_columns` should include reviewed fields only and `aggregations` should be empty.

### Sort Alias Rule

Existing Query Builder UI derives aggregate aliases in this pattern:

```text
COUNT with no column -> count_rows
SUM sale_price -> sum_sale_price
AVG sale_price -> avg_sale_price
MIN sale_price -> min_sale_price
MAX sale_price -> max_sale_price
```

Future request generation should use the same alias pattern for aggregate sorting, or centralize alias creation in a shared pure helper before implementation.

## 7. Where The Request Should Live Before Execution

The request candidate should live in Workspace question review state, not in executable owners.

Recommended future state shape:

```ts
type GovernedQueryBuilderRequestDraft = {
  status: "not_created" | "eligible" | "created_for_review" | "blocked";
  sourceDraft: ControlledLogicDraft;
  request: QueryBuilderRequest | null;
  validationWarnings: string[];
  blockingRequirements: MissingRequirement[];
  generatedSql: null;
  executionStatus: "not_executed";
};
```

Important:

- This state should be local to `QuestionWorkspacePanel` or a future Workspace-owned question planning hook.
- It should not be written to runtime persistence in Phase F.
- It should not mutate `useQueryBuilderController` automatically.
- It should not be stored in `ActiveResultModel`.
- It should not be attached to ResultsGrid.
- It should not be sent to the backend until user approval in a later execution phase.

## 8. User Approval Before Execution

Request creation and execution approval are separate steps.

Recommended review sequence:

1. User types a business question.
2. Workspace creates schema-aware draft plan.
3. User reviews/chooses clarification fields.
4. Workspace creates controlled logic draft.
5. Phase F creates a Query Builder request candidate only if eligible.
6. Workspace displays the candidate in business language and technical disclosure.
7. User explicitly approves execution with a future action such as `Run answer`.
8. A later execution phase passes the approved request to an existing execution owner.

Phase F should not add execution behavior. If a button appears in Phase F, it should be clearly non-executable, such as `Review request`, `Edit fields`, or `Cancel`. A `Run answer` button belongs only in a later approved execution checkpoint.

Required approval copy:

- "Review this request before running."
- "No backend query has executed."
- "No result exists yet."
- "SQL has not been generated."

## 9. Why SQL Generation Remains Forbidden

SQL generation remains forbidden in Phase F because:

- the controlled draft and Query Builder request candidate can represent common business questions without raw SQL
- Query Builder requests preserve a structured, schema-validated path
- SQL fallback has different export, pagination, result-tab, and review risks
- SQL text can appear executable even when it has not run
- the current objective is governed request generation, not query language generation
- backend SQL validation should remain an execution-time safety gate, not a planning shortcut

If SQL fallback is needed later, it should be planned as a separate phase with:

- explicit SELECT-only constraints
- visible review
- no auto-run
- clear result coordination design
- export and pagination impact analysis

## 10. Safe Connection To Existing Execution Owners

When a later phase approves execution, the safest path is:

```text
reviewed Query Builder request candidate
-> explicit user approval
-> Workspace composition/execution owner
-> executeWorkspaceQuery({ source: "query-builder", queryBuilder })
-> services/api.runQueryBuilder
-> backend /datasets/{dataset_id}/query-builder
-> backend validation and DuckDB
-> WorkspaceExecutionResult
-> coordinateExecutionResult
-> ActiveResultModel
-> ResultsGrid
```

Phase F should not perform this handoff. It should only prepare the request candidate and document that a later phase must use existing execution owners.

Recommended future execution attachment points:

1. Add a narrowly scoped approved-request runner inside `useResultExecutionCoordinator`, or
2. Populate Query Builder UI state for user review and let the existing `runVisualQuery` path run it.

Option 1 is more direct but touches executable infrastructure and must be implemented only after Phase F planning. Option 2 keeps Query Builder review visible but mutates Query Builder state and must also be separately governed.

## 11. Files Likely To Change In Future Phase F Implementation

Likely files:

- `frontend/src/features/questionWorkspace/questionLogicDraftTypes.ts`
- `frontend/src/features/questionWorkspace/questionLogicDraftBuilder.ts`
- `frontend/src/features/questionWorkspace/questionQueryBuilderRequestTypes.ts`
- `frontend/src/features/questionWorkspace/questionQueryBuilderRequestBuilder.ts`
- `frontend/src/components/workspace/QuestionWorkspacePanel.tsx`
- `frontend/src/styles/query-builder.css`

Possible files only if a future approved UI composition boundary is introduced:

- `frontend/src/features/questionWorkspace/useQuestionWorkspace.ts`
- `frontend/src/features/query-builder/queryBuilderTypes.ts` only for type reuse or exported helpers

## 12. Files That Must Not Change In Phase F Planning

Must not change:

- `backend/app/main.py`
- backend query, upload, session, and export code
- `frontend/src/services/api.ts`
- `frontend/src/features/execution/executeWorkspaceQuery.ts`
- `frontend/src/features/results/useResultExecutionCoordinator.ts`
- `frontend/src/features/results/activeResultModel.ts`
- `frontend/src/components/results/ResultsGrid.tsx`
- `frontend/src/features/export/useExportController.ts`
- pagination handlers
- upload/session restore controllers
- runtime persistence modules
- route/view registry code
- command launcher behavior
- `frontend/src/features/analyst/sql/useSqlWorkspace.ts`
- `frontend/src/features/analyst/sql/SqlWorkspace.tsx`
- `frontend/src/components/query-builder/VisualQueryBuilderPanel.tsx`
- `frontend/src/features/query-builder/useQueryBuilderController.ts`
- TaskLauncherPanel

These files may be reviewed for contract understanding, but not modified during this planning phase.

## 13. Risks And Safeguards

### Risk: Request Candidate Looks Executed

Safeguard:

- label it as "Request draft only"
- show `executionStatus: "not_executed"`
- show no rows, no results, and no backend validation claim

### Risk: Query Builder State Mutates Too Early

Safeguard:

- keep candidate in Workspace question review state
- do not call `setQuerySelectedColumns`, `setQueryGroupBy`, or similar setters in Phase F

### Risk: SQL Sneaks In Through Explanation

Safeguard:

- do not generate SQL strings
- do not show SQL-like clauses
- show only structured request fields and business-readable summaries

### Risk: Unsupported Logic Is Forced Into Query Builder

Safeguard:

- block unsupported operations such as count distinct, date bucketing, anomaly thresholds, calculated shares, and custom expressions until the Query Builder contract supports them

### Risk: Ambiguous Fields Become Silent Defaults

Safeguard:

- require selected clarification fields for high-confidence ambiguity
- keep low-confidence matches as suggestions, not defaults

### Risk: Backend Validation Is Implied

Safeguard:

- copy must say backend validation has not run
- request candidate validation is frontend advisory only

### Risk: Execution Owner Boundary Is Bypassed

Safeguard:

- request builder must not import `executeWorkspaceQuery` or `services/api`
- later execution must route through `useResultExecutionCoordinator` or another approved Workspace execution owner

### Risk: Export/Pagination Assumptions Are Added Prematurely

Safeguard:

- Phase F does not alter export or pagination
- export and pagination behavior begins only after an actual result exists

## 14. Recommended Implementation Checkpoints

### A. Add Request Candidate Types

Scope:

- type definitions only
- may type-reference `QueryBuilderRequest`
- no execution imports
- no callbacks

### B. Add Pure Request Builder

Scope:

- pure deterministic conversion from `ControlledLogicDraft` and schema to request candidate
- no React
- no backend
- no execution
- no persistence

### C. Add Local Review Display

Scope:

- display request candidate in `QuestionWorkspacePanel`
- show selected columns, grouping, aggregations, filters, sorting, limit, page
- show warnings and blocking requirements
- no Run button

### D. Add Approval Planning

Scope:

- document user approval UI and future execution handoff
- no execution until a later approved checkpoint

## 15. Definition Of Done

Phase F planning is complete when:

- eligibility rules are documented
- required field selections are documented by intent
- validation rules are documented
- Query Builder request shape alignment is documented
- request candidate storage boundary is documented
- user approval boundary is documented
- SQL prohibition is documented
- safe future execution handoff is documented
- likely changed files and protected files are listed
- risks and safeguards are documented
- no code changes are made

Future Phase F implementation is complete only when:

- request candidate generation is pure and deterministic
- request candidate generation does not execute
- no SQL is generated
- no backend API is called
- no Query Builder state is mutated automatically
- no ActiveResultModel or ResultsGrid state changes
- no export, pagination, routing, upload/session restore, or persistence behavior changes
- request candidate remains reviewable before any later execution phase
- build and governance scans pass

## Final Recommendation

Proceed with Phase F as governed Query Builder request candidate generation only.

The safe product move is to let users see the exact structured request FiltraQueri may later run, while preserving the execution boundary: no backend call, no SQL, no result, and no mutation of executable or result systems until a later user-approved execution checkpoint.
