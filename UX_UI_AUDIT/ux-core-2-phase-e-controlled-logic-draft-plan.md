# UX-CORE-2 - Phase E Controlled Logic-Draft Generation Plan

## Document Status

Planning, audit, and implementation preparation only.

No application code, backend logic, SQL execution behavior, Query Builder behavior, SQL Workspace behavior, ResultsGrid behavior, ActiveResultModel behavior, pagination, export, upload/session restore, runtime persistence, routing, command channels, or governance contracts are changed by this document.

## Authoritative Sources Reviewed

- `UX_UI_AUDIT/ux-core-2-workspace-question-to-answer-core-loop-plan.md`
- `UX_UI_AUDIT/ux-core-2-phase-a-execution-path-audit.md`
- `UX_UI_AUDIT/ux-core-2-phase-c-schema-aware-question-translator-plan.md`
- `UX_UI_AUDIT/filtraqueri-operational-ux-charter.md`
- `frontend/src/features/questionWorkspace/questionTranslatorTypes.ts`
- `frontend/src/features/questionWorkspace/schemaQuestionTranslator.ts`
- `frontend/src/components/workspace/QuestionWorkspacePanel.tsx`

## Executive Summary

Phase E should create the next safe planning bridge in the Workspace question-to-answer loop:

```text
User question
-> schema-aware draft plan
-> selected clarification fields
-> investigation blueprint
-> controlled non-executed logic draft
-> future Query Builder request
```

The logic draft is not an executable payload. It is a structured explanation of what FiltraQueri would later ask Query Builder to do after user review. It may describe selected fields, grouping, aggregation, sorting, limits, filters, output shape, and validation warnings. It must not generate SQL, generate a `QueryBuilderRequest`, call backend APIs, call `executeWorkspaceQuery`, mutate Query Builder state, mutate result state, or create results.

Phase E should make the planning layer feel more concrete without crossing the execution boundary.

## Product Goal

The user should be able to see a controlled draft of the analytical logic implied by their question and field choices.

Example:

User asks:

> Which realtor manages the most properties?

After schema matching and clarification, Workspace may show a draft logic summary like:

- Group records by `realtor`
- Count records or count selected property identifier
- Sort highest to lowest
- Limit to top results
- Expected output: ranking list

This is still not a query. It is a human-readable logic draft that can later become a governed Query Builder request only after another approved implementation phase.

## 1. Logic Draft Responsibility

The controlled logic draft may represent:

- selected dimension
- selected measure
- selected date field
- aggregation idea
- grouping idea
- sorting idea
- limit idea
- filter idea
- expected result shape
- validation warnings
- missing requirements
- whether the draft is eligible for future Query Builder request creation

The logic draft should answer:

- What would FiltraQueri calculate later?
- Which reviewed fields would it use?
- How would it group or compare the data?
- What output shape should the user expect?
- What still blocks logic generation or execution?

The logic draft should be business-readable. It should not look like SQL, internal metadata, execution planning machinery, or backend contract preparation.

## 2. Logic Draft Must Not Do

The logic draft must not:

- execute
- call backend APIs
- call `executeWorkspaceQuery`
- call `queryDataset`
- call `runQueryBuilder`
- import `src/services/api`
- generate final SQL
- generate a `QueryBuilderRequest`
- mutate Query Builder state
- mutate SQL Workspace drafts
- mutate `ActiveResultModel`
- mutate ResultState
- activate result tabs
- create results
- export
- change pagination
- write runtime persistence
- write upload/session state
- change routes
- dispatch command launcher events
- call an LLM
- claim that an answer exists

It remains advisory and local until a later executable boundary is explicitly approved.

## 3. Draft Logic Type Shape

Recommended future type:

```ts
type ControlledLogicDraftKind = "query_builder_plan";

type ControlledLogicDraftStatus =
  | "draft_only"
  | "blocked_by_missing_requirements"
  | "blocked_by_ambiguity";

type ControlledAggregationIdea =
  | "count_records"
  | "count_distinct"
  | "sum"
  | "average"
  | "min"
  | "max"
  | "none";

type ControlledSortIdea = {
  field: string | null;
  direction: "asc" | "desc" | null;
  reason: string;
};

type ControlledLogicDraft = {
  draftKind: ControlledLogicDraftKind;
  rawQuestion: string;
  detectedIntent: SchemaAwareQuestionIntent;
  selectedFields: {
    dimension: string | null;
    measure: string | null;
    dateField: string | null;
  };
  grouping: {
    fields: string[];
    dateBucket: "day" | "week" | "month" | "year" | null;
    summary: string;
  };
  aggregation: {
    idea: ControlledAggregationIdea;
    field: string | null;
    summary: string;
  };
  sorting: ControlledSortIdea | null;
  limit: {
    value: number | null;
    reason: string;
  };
  filters: Array<{
    field: string;
    operator: "equals" | "contains" | "greater_than" | "less_than" | "between" | "unknown";
    value: string | number | null;
    summary: string;
  }>;
  plannedOutputType: PlannedOutputType;
  validationWarnings: string[];
  blockingRequirements: MissingRequirement[];
  executionStatus: "draft_only";
  generatedQueryBuilderRequest: null;
  generatedSql: null;
};
```

Important:

- `draftKind: "query_builder_plan"` means the draft is shaped like a future Query Builder-compatible plan.
- It does not mean a `QueryBuilderRequest` exists.
- `generatedQueryBuilderRequest` must remain `null`.
- `generatedSql` must remain `null`.
- `executionStatus` must remain `"draft_only"`.

## 4. Deterministic Mapping Rules

Phase E should use deterministic mapping from the existing `SchemaAwareQuestionDraftPlan` plus local selected clarification fields.

### Ranking Intent

Input signals:

- `detectedIntent === "ranking"`
- selected dimension exists
- selected measure may or may not exist

Draft logic:

- group by selected dimension
- if selected measure is numeric, aggregate by `sum` unless question implies `count`
- if no numeric measure is selected, use `count_records`
- sort descending for "most", "top", "highest", "best"
- sort ascending for "least", "bottom", "lowest", "worst", or underperformance wording
- suggest a default limit, such as 10, as an idea only
- planned output: `ranking_list`

Example summary:

> Group by realtor, count matching records, and rank from highest to lowest.

### Aggregation Intent

Input signals:

- `detectedIntent === "aggregation"`
- selected measure exists or count-style question is detected

Draft logic:

- aggregate selected measure if numeric
- use `count_records` for "how many" or no measure
- no grouping unless selected dimension exists
- no default sort unless grouping is present
- planned output: `kpi_card` or `table`

Example summary:

> Summarize the selected measure into one business value.

### Trend Intent

Input signals:

- `detectedIntent === "trend"` or `"timeline_review"`
- selected date field exists
- selected measure may exist

Draft logic:

- require date field
- group by date/time bucket, initially month unless question implies day/week/year
- aggregate selected measure if numeric
- use record count if no measure is selected
- sort by date ascending for trend review
- planned output: `trend_chart`

Example summary:

> Group records by month using transaction_date and summarize revenue over time.

### Comparison Intent

Input signals:

- `detectedIntent === "comparison"`
- selected dimension exists
- selected measure optional

Draft logic:

- group by selected dimension
- compare selected numeric measure or record count
- sort by aggregate value if the question implies best/worst
- planned output: `comparison_table`

Example summary:

> Compare groups by the selected business measure.

### Distribution Intent

Input signals:

- `detectedIntent === "distribution"`
- selected dimension exists

Draft logic:

- group by selected categorical/text dimension
- count records per category
- optionally calculate share later, but do not define that as executable in Phase E
- planned output: `distribution_view`

Example summary:

> Count records by category to understand the mix.

### Segmentation Intent

Input signals:

- `detectedIntent === "segmentation"`
- selected dimension exists

Draft logic:

- group by selected dimension
- use count or selected measure
- highlight this as grouping preparation, not segmentation analysis execution
- planned output: `comparison_table`

### Anomaly Review Intent

Input signals:

- `detectedIntent === "anomaly_review"`

Draft logic:

- mark as future unsupported or needs more logic unless simple sorting/counting can support the question
- require a measure, date, or dimension depending on the wording
- do not invent anomaly thresholds
- do not claim unusual values
- planned output: `table`

Example summary:

> Anomaly review needs explicit metric and threshold logic before FiltraQueri can safely prepare executable logic.

### Unknown Intent

Input signals:

- `detectedIntent === "unknown"`

Draft logic:

- set status to `blocked_by_missing_requirements`
- require clearer intent
- show clarifying question prompts
- do not map to grouping, aggregation, sorting, or limit

## 5. Safety Validation Rules

Before any future executable draft can be created, the controlled logic draft must validate:

### Schema Existence

- selected dimension must exist in `dataset.schema`
- selected measure must exist in `dataset.schema`
- selected date field must exist in `dataset.schema`
- filter fields must exist in `dataset.schema`

### Type Compatibility

- numeric aggregation requires a numeric measure unless using `count_records`
- trend logic requires a date-like field
- grouping requires categorical, text, boolean, or accepted ID/entity-like fields
- distribution requires a categorical/text/boolean dimension
- date bucket requires a date/time field

### Ambiguity Resolution

- ambiguous terms must be resolved before future request generation
- multiple high-confidence candidates should require a selected field
- low-confidence candidates should remain suggestions, not defaults

### Missing Requirements

Missing requirements must remain blocking:

- `clear_intent` blocks all logic draft completion
- `dimension` blocks ranking/comparison/segmentation/distribution logic
- `measure` blocks numeric aggregation unless count is acceptable
- `date_field` blocks trend/timeline logic
- `filter_value` blocks filter preparation

### Safety Boundary

Even when all validations pass:

- no query has run
- no SQL exists
- no `QueryBuilderRequest` exists
- no backend validation has run
- no result exists

The draft is only eligible for a later governed request-generation checkpoint.

## 6. UI Evolution

The Workspace review shell should evolve from "Investigation Blueprint" into a more concrete but still non-executable "Draft Logic" layer.

Recommended section label:

> Draft logic only

Required protection copy:

- No query generated yet.
- No SQL generated.
- No backend query executed.
- Future Query Builder request not created yet.

Recommended content:

- plain-language logic summary
- selected fields
- grouping idea
- aggregation idea
- sorting idea
- limit idea
- planned output type
- validation warnings
- blocking requirements

Suggested UI structure:

```text
Draft Logic Only
No query generated yet.

Logic summary
Group by realtor and count matching property records, then rank highest to lowest.

Planning choices
- Dimension: realtor
- Measure: count records
- Date field: not needed

Draft operations
- Grouping: realtor
- Aggregation: count records
- Sorting: highest first
- Limit: top 10 idea only

Validation warnings
- Confirm realtor is the correct grouping field.
- Future Query Builder request has not been created.
```

The UI should stay calm and compact. It should not add a Run button in Phase E. It should not show generated code. It should not imply that backend validation has happened.

## 7. Current Implementation Inputs

`QuestionWorkspacePanel.tsx` currently has the correct local-only inputs for Phase E:

- `rawQuestion`
- local `draft`
- `schemaDraftPlan`
- `selectedDimension`
- `selectedMeasure`
- `selectedDateField`
- `planningClarityStatus`
- `investigationBlueprint`

`schemaQuestionTranslator.ts` currently produces:

- `detectedIntent`
- `confidence`
- `candidateDimensions`
- `candidateMeasures`
- `candidateDateFields`
- `candidateFilters`
- `ambiguousTerms`
- `missingRequirements`
- `suggestedClarifyingQuestions`
- `plannedOutputType`
- `executionStatus: "not_generated"`
- `generatedSql: null`
- `generatedQueryBuilderRequest: null`

Phase E should consume these values only. It should not import execution services, Query Builder types, SQL Workspace modules, Results modules, or API clients.

## 8. Implementation Checkpoints

### A. Add Logic Draft Types Only

Goal:

- Add type definitions for controlled draft logic.

Likely file:

- `frontend/src/features/questionWorkspace/questionLogicDraftTypes.ts`

Allowed:

- type-only references to existing question translator types
- no imports from execution, services, Query Builder, Results, SQL Workspace, or backend systems

Forbidden:

- `QueryBuilderRequest` type import
- executable callback fields
- generated SQL field with a non-null value

Build required after implementation.

### B. Add Pure Logic Draft Builder

Goal:

- Add deterministic pure functions that convert a `SchemaAwareQuestionDraftPlan` and selected fields into a `ControlledLogicDraft`.

Likely file:

- `frontend/src/features/questionWorkspace/questionLogicDraftBuilder.ts`

Allowed functions:

- `buildControlledLogicDraft()`
- `deriveAggregationIdea()`
- `deriveGroupingIdea()`
- `deriveSortingIdea()`
- `deriveLimitIdea()`
- `validateControlledLogicDraft()`

Rules:

- pure functions only
- no React hooks
- no backend imports
- no execution imports
- no Query Builder imports
- no SQL imports
- no result imports
- no persistence imports

Output must include:

- `executionStatus: "draft_only"`
- `generatedQueryBuilderRequest: null`
- `generatedSql: null`

### C. Wire Logic Draft Into Review Shell As Local Display Only

Goal:

- Use the pure builder inside `QuestionWorkspacePanel` after the user prepares a schema-aware draft.
- Display draft logic only.

Allowed:

- local `useMemo`
- local UI display
- existing selected clarification fields

Forbidden:

- Run button
- execution callback
- Query Builder state mutation
- API calls
- result mutation
- route changes
- persistence writes

### D. Add Validation Warnings

Goal:

- Show validation warnings and blocking requirements in business language.

Examples:

- "Choose a timeline field before trend logic can be prepared."
- "The selected measure must be numeric unless the answer uses record count."
- "Ambiguous field matches should be resolved before request generation."

Warnings should help the user make field choices. They should not look like backend errors.

### E. Prepare Future Query Builder Request Generation

Goal:

- Make the draft shape intentionally compatible with a future Query Builder request generation phase.

Important:

- Do not generate the request in Phase E.
- Do not import `QueryBuilderRequest`.
- Do not mutate `useQueryBuilderController`.
- Do not call `runVisualQuery`.
- Do not call `executeWorkspaceQuery`.

This checkpoint is design alignment only.

## 9. Files Likely To Change

Expected future Phase E implementation files:

- `frontend/src/features/questionWorkspace/questionLogicDraftTypes.ts`
- `frontend/src/features/questionWorkspace/questionLogicDraftBuilder.ts`
- `frontend/src/components/workspace/QuestionWorkspacePanel.tsx`
- `frontend/src/styles/query-builder.css`

Files that may be read but should not change in Phase E:

- `frontend/src/features/questionWorkspace/questionTranslatorTypes.ts`
- `frontend/src/features/questionWorkspace/schemaQuestionTranslator.ts`
- `frontend/src/App.tsx`

Files that must not change in Phase E:

- `backend/app/main.py`
- `frontend/src/features/execution/executeWorkspaceQuery.ts`
- `frontend/src/services/api.ts`
- `frontend/src/features/results/useResultExecutionCoordinator.ts`
- `frontend/src/features/results/activeResultModel.ts`
- `frontend/src/components/results/ResultsGrid.tsx`
- `frontend/src/features/query-builder/useQueryBuilderController.ts`
- `frontend/src/components/query-builder/VisualQueryBuilderPanel.tsx`
- `frontend/src/features/analyst/sql/useSqlWorkspace.ts`
- `frontend/src/features/analyst/sql/SqlWorkspace.tsx`
- export controllers
- pagination handlers
- upload/session restore controllers
- runtime persistence modules
- route/view registry code
- command launcher behavior
- TaskLauncherPanel

## 10. Governance Classification

| Module / Layer | Classification | Phase E Role | Execution Permission |
| --- | --- | --- | --- |
| `QuestionWorkspacePanel` | Presentational | Displays local draft logic | None |
| `schemaQuestionTranslator.ts` | Advisory | Produces schema-aware draft plan | None |
| Future `questionLogicDraftTypes.ts` | Type-only/advisory | Defines non-executable draft shape | None |
| Future `questionLogicDraftBuilder.ts` | Advisory pure utility | Maps draft plan to controlled logic draft | None |
| Query Builder controller | Composition state owner | Future target only | No Phase E mutation |
| `useResultExecutionCoordinator` | Composition/executable | Future approved execution owner | No Phase E touch |
| `executeWorkspaceQuery` | Executable | Protected execution adapter | No Phase E touch |
| Backend query endpoints | Executable | Future validation/execution owner | No Phase E touch |
| `ActiveResultModel` | Read model | Future result consumer | No Phase E touch |
| `ResultsGrid` | Presentational result renderer | Future result renderer | No Phase E touch |

## 11. Unsafe Attachment Points

Do not attach Phase E logic draft generation to:

- Data tab surfaces
- TaskLauncherPanel
- runtime bridge metadata
- workflow recommendation metadata
- business question classifier cards
- KPI intelligence cards
- ResultsGrid
- ActiveResultModel
- backend query endpoints
- `services/api.ts`
- `executeWorkspaceQuery`
- SQL Workspace draft persistence
- command launcher actions

The draft must live in Workspace question preparation only.

## 12. Recommended First Implementation Boundary

The safest first implementation should include only:

1. Type definitions for `ControlledLogicDraft`.
2. Pure deterministic builder functions.
3. Local display inside `QuestionWorkspacePanel`.
4. Validation warnings as plain text.
5. Protection copy that confirms:
   - no query generated
   - no SQL generated
   - no backend query executed
   - future Query Builder request not created yet

It should not include:

- Run button
- generated SQL
- generated `QueryBuilderRequest`
- Query Builder state updates
- result activation
- backend calls
- LLM calls
- persistence

## 13. Definition Of Done

Phase E planning is complete when:

- the controlled logic-draft responsibility is clearly defined
- the draft type shape is non-executable
- deterministic intent-to-logic mapping rules are documented
- safety validation rules are documented
- UI evolution is defined without execution affordances
- implementation checkpoints are sequenced safely
- files likely to change and files that must not change are identified
- the architecture is ready for future governed Query Builder request creation

Future Phase E implementation is complete only when:

- a local-only draft logic display exists
- selected fields from the clarification workflow are reflected
- validation warnings are shown
- no SQL is generated
- no `QueryBuilderRequest` is generated
- no backend call occurs
- no Query Builder state mutates
- no ActiveResultModel or ResultsGrid state changes
- build passes

## Non-Goals

- Do not execute.
- Do not generate SQL.
- Do not generate `QueryBuilderRequest`.
- Do not add LLM translation.
- Do not create results.
- Do not alter ResultsGrid.
- Do not alter ActiveResultModel.
- Do not alter Query Builder behavior.
- Do not alter SQL Workspace behavior.
- Do not alter backend validation.
- Do not alter upload/session restore.
- Do not alter runtime persistence.
- Do not alter routing.
- Do not remove TaskLauncherPanel.
- Do not redesign Workspace.

## Final Recommendation

Proceed with Phase E as a controlled draft-logic layer, not an execution layer.

The implementation should make FiltraQueri feel more capable and answer-focused by showing how the question would be translated into reviewed analytical logic, while preserving the most important governance line: no executable payload exists until a later approved checkpoint creates one and routes it through existing execution owners.
