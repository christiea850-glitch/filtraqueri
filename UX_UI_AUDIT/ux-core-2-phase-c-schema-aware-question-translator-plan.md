# UX-CORE-2 - Phase C Schema-Aware Question Translator Plan

## Document Status

Planning, audit, and implementation preparation only.

No application code, backend logic, SQL execution behavior, Query Builder behavior, SQL Workspace behavior, ResultsGrid behavior, ActiveResultModel behavior, pagination, export, upload/session restore, runtime persistence, routing, command channels, or governance contracts are changed by this document.

## Authoritative Sources Reviewed

- `UX_UI_AUDIT/ux-core-2-workspace-question-to-answer-core-loop-plan.md`
- `UX_UI_AUDIT/ux-core-2-phase-a-execution-path-audit.md`
- `UX_UI_AUDIT/ux-core-2-phase-b-workspace-question-surface-plan.md`
- `UX_UI_AUDIT/filtraqueri-operational-ux-charter.md`
- `docs/governance-hard-fail-rules.md`
- `docs/s2-advisory-vs-executable-boundary-audit.md`
- `frontend/src/components/workspace/QuestionWorkspacePanel.tsx`
- `frontend/src/features/dataset/datasetTypes.ts`

## Executive Summary

Phase C should move the Workspace question surface from general text hints to schema-aware draft planning.

The future translator should read the user's question and the active dataset schema, then produce a non-executable draft analysis plan that explains which actual columns may be relevant, what the likely intent is, what requirements are missing, and what clarification may be needed.

Phase C must remain advisory. It must not generate SQL, generate a `QueryBuilderRequest`, call backend APIs, call LLMs, mutate result state, persist runtime state, change routing, or claim that an answer exists.

The correct Phase C product behavior is:

```text
User question
+ dataset schema
+ active source context
+ safe Data-owned hints
-> schema-aware draft plan
-> review UI with candidate fields and missing requirements
-> no query generated
-> no backend query executed
```

## 1. Current State Review

`QuestionWorkspacePanel.tsx` currently implements a Workspace-owned, local-only question preparation surface.

Current capabilities:

- Captures typed question in local component state.
- Stores a local draft with question, dataset id, source name, and timestamp.
- Shows active dataset/source context.
- Provides starter prompts that only fill the input.
- Uses deterministic frontend-only keyword matching.
- Detects broad local intent hints:
  - ranking
  - comparison
  - trend
  - distribution
  - aggregation
  - anomaly review
  - segmentation
  - timeline review
- Shows confidence labels: high, medium, low.
- Shows detected business entities from static word lists.
- Shows possible dimensions/measures from static word lists.
- Shows potential investigation strategy cards.
- Shows planned outputs such as table, KPI card, trend chart, ranking list, and distribution view.
- Shows protected execution boundary language:
  - no query generated
  - no SQL generated
  - no backend query executed
  - planning-only review layer

Current limitations:

- It does not inspect `dataset.schema`.
- It cannot match user terms to actual column names.
- It cannot distinguish real available fields from generic business terms.
- It cannot detect when a requested measure, grouping, or date field is missing.
- It cannot identify ambiguity when multiple columns match one user phrase.
- It cannot explain why a column is a likely measure/dimension/date candidate.
- It cannot use active worksheet/source context beyond display.
- It cannot produce a structured draft plan for later execution checkpoints.

These limitations are appropriate for Phase B, but Phase C should address them without crossing into execution.

## 2. Schema Inputs Available

The existing Human `queryBuilder` view already has access to the necessary schema context through `App.tsx`.

Available directly:

- `dataset`
- `dataset.dataset_id`
- `dataset.original_filename`
- `dataset.filename`
- `dataset.table_name`
- `dataset.row_count`
- `dataset.column_count`
- `dataset.schema`
- `dataset.workbook_metadata`
- `activeWorkbookWorksheet`
- source display name:
  - `activeWorkbookWorksheet?.displayName`
  - `activeWorkbookWorksheet?.sheetName`
  - fallback `dataset.table_name`

`dataset.schema` columns include:

- `name`
- `type`
- `inferred_type`
  - `text`
  - `numeric`
  - `date`
  - `boolean`
  - `categorical`
- `null_count`
- `unique_count`
- `sample_values`
- optional `min`
- optional `max`

Safe Data-owned hints that may be consumed later:

- metric/date/dimension candidates from Data intelligence
- entity hints
- source/worksheet context
- relationship cues
- quality/missingness hints

Phase C should start with `dataset.schema` and active source context only. Consuming Data-owned intelligence hints can be a later sub-checkpoint if the ownership boundary remains clear: Data discovers hints; Workspace uses them for question planning.

## 3. Translator Responsibility

The schema-aware translator may:

- parse the typed question using deterministic frontend logic
- match question words to actual column names
- normalize user terms and column names
- identify possible dimensions
- identify possible measures
- identify possible date/time fields
- detect grouping intent
- detect ranking intent
- detect trend/timeline intent
- detect comparison intent
- detect aggregation intent
- detect anomaly review intent
- detect segmentation intent
- detect ambiguous terms
- detect missing requirements
- produce suggested clarifying questions
- produce a non-executable planned output type
- explain why candidate fields were selected
- assign confidence to the draft plan

The translator should produce a reviewable plan, not an executable payload.

The translator may say:

- "Possible dimension: realtor_name"
- "Possible measure: property_count"
- "Possible date field: created_at"
- "Trend requested, but no date field was detected"
- "Multiple customer-like fields match this question"
- "Choose which field represents customer"

The translator must not say:

- "This realtor manages the most properties"
- "The result is..."
- "SQL is ready"
- "Run this generated query"

## 4. Translator Must Not Do

The translator must not:

- generate SQL
- generate `QueryBuilderRequest`
- call `executeWorkspaceQuery`
- call `queryDataset`
- call `runQueryBuilder`
- import `src/services/api`
- call backend APIs
- call LLMs in Phase C
- mutate `ActiveResultModel`
- mutate ResultState
- set active result tabs
- trigger export
- change pagination
- write runtime persistence
- write dataset/session persistence
- change routes
- dispatch command launcher events
- mutate SQL Workspace drafts
- claim an answer from metadata
- fabricate results

It is advisory until a later executable boundary is explicitly implemented.

## 5. Draft Plan Shape

Recommended type shape:

```ts
type SchemaAwareQuestionIntent =
  | "ranking"
  | "comparison"
  | "trend"
  | "distribution"
  | "aggregation"
  | "anomaly_review"
  | "segmentation"
  | "timeline_review"
  | "unknown";

type SchemaAwareConfidence = "high" | "medium" | "low";

type CandidateFieldRole = "dimension" | "measure" | "date" | "filter" | "unknown";

type CandidateFieldMatch = {
  columnName: string;
  displayName: string;
  role: CandidateFieldRole;
  inferredType: string;
  matchReason:
    | "exact_column_match"
    | "normalized_column_match"
    | "singular_plural_match"
    | "business_synonym_match"
    | "type_based_candidate"
    | "sample_value_hint";
  confidence: SchemaAwareConfidence;
};

type MissingRequirement =
  | "measure"
  | "dimension"
  | "date_field"
  | "filter_value"
  | "clear_intent";

type SchemaAwareQuestionDraftPlan = {
  rawQuestion: string;
  activeDatasetId: string;
  activeDatasetName: string;
  activeSourceName: string | null;
  detectedIntent: SchemaAwareQuestionIntent;
  confidence: SchemaAwareConfidence;
  candidateDimensions: CandidateFieldMatch[];
  candidateMeasures: CandidateFieldMatch[];
  candidateDateFields: CandidateFieldMatch[];
  candidateFilters: CandidateFieldMatch[];
  ambiguousTerms: Array<{
    term: string;
    candidates: CandidateFieldMatch[];
  }>;
  missingRequirements: MissingRequirement[];
  suggestedClarifyingQuestions: string[];
  plannedOutputType:
    | "table"
    | "ranking_list"
    | "kpi_card"
    | "trend_chart"
    | "distribution_view"
    | "comparison_table"
    | "unknown";
  executionStatus: "not_generated";
  generatedSql: null;
  generatedQueryBuilderRequest: null;
};
```

Important contract:

- `executionStatus` must be `"not_generated"` in Phase C.
- `generatedSql` must be `null`.
- `generatedQueryBuilderRequest` must be `null`.
- No callback or executable function fields are allowed.

## 6. Field Matching Rules

### Normalization

Normalize both question text and column names by:

- lowercasing
- trimming
- replacing underscores, hyphens, slashes, and dots with spaces
- splitting camelCase into words
- removing extra whitespace
- removing simple punctuation
- preserving original column name for display

Examples:

- `customer_id` -> `customer id`
- `CustomerID` -> `customer id`
- `paymentAmount` -> `payment amount`
- `lease-start-date` -> `lease start date`

### Exact Column-Name Match

If the normalized question contains the exact normalized column name, mark as a strong match.

Example:

- question: "Which realtor manages the most properties?"
- column: `realtor`
- match: exact column match

### Normalized Token Match

If significant tokens from a column name appear in the question, mark as medium match.

Example:

- column: `total_sales`
- question contains `sales`
- likely measure candidate

### Singular / Plural Match

Use simple deterministic singular/plural matching:

- remove trailing `s` for words longer than 3 characters
- compare both singular and plural forms

Examples:

- `customers` matches `customer`
- `properties` should normalize through a small irregular/plural synonym map to `property`

### Snake Case / Camel Case / Space-Separated Match

All common field name styles should normalize into comparable tokens:

- `customer_name`
- `customerName`
- `Customer Name`
- `customer-name`

### Known Business Synonyms

Use a small deterministic synonym map.

Examples:

| User Term | Candidate Column Terms |
| --- | --- |
| revenue | sales, amount, payment, total, income |
| customer | client, buyer, tenant, account |
| property | unit, listing, asset, building |
| realtor | agent, broker, manager |
| date | time, month, year, created, updated, transaction |
| location | region, city, state, market, branch |
| product | sku, item, category |

Synonyms only suggest candidates. They do not prove meaning.

### Type-Based Measure Detection

Columns with `inferred_type === "numeric"` may be measure candidates.

Scoring should increase when:

- column name matches measure terms
- column has low null count
- column has useful numeric range metadata
- column is not an id-like field

Scoring should decrease when:

- column name includes `id`, `zip`, `phone`, `year` and does not otherwise look like a measure
- `unique_count` is near row count and the name suggests identifier

### Date / Time Detection

Columns with `inferred_type === "date"` should be date candidates.

Also consider date-like names:

- date
- time
- month
- year
- created
- updated
- transaction
- start
- end

If a trend/timeline question is detected but no date candidate exists, add `date_field` to missing requirements.

### Categorical Dimension Detection

Columns with `inferred_type === "categorical"` or `inferred_type === "text"` may be dimension candidates.

Good dimensions often have:

- moderate `unique_count`
- business-like names
- categorical/text inferred type
- sample values that look like groups, names, locations, or statuses

Avoid treating long free-text fields as strong grouping candidates unless the question mentions them directly.

## 7. Ambiguity Handling

The translator must surface ambiguity instead of guessing silently.

### Multiple Possible Fields Match

Example:

- question term: `customer`
- matching fields: `customer_id`, `customer_name`, `customer_segment`

Behavior:

- list all candidates
- ask: "Which customer field should this use?"
- do not choose one as executable
- confidence should be medium or low depending on specificity

### No Measure Found

Example:

- question: "Which customers perform best?"
- no numeric or countable measure detected

Behavior:

- suggest count-based review only as a future possibility, not an execution plan
- add `measure` to missing requirements
- ask: "What should define performance?"

### No Grouping Field Found

Example:

- question: "Which area is highest?"
- no matching categorical field

Behavior:

- add `dimension` to missing requirements
- show possible dimensions from schema
- ask: "Which field should FiltraQueri group by?"

### Trend Requested But No Date Field Exists

Example:

- question: "How did revenue change over time?"
- no date/time column

Behavior:

- add `date_field` to missing requirements
- clearly state that no timeline field was found
- do not show trend chart as ready

### Question Too Broad

Example:

- "What is happening?"

Behavior:

- detected intent: `unknown`
- confidence: `low`
- show clarifying prompts:
  - "Which metric should FiltraQueri review?"
  - "Which entity or group should be compared?"
  - "Should this look over time?"

### Dataset Too Small To Support The Question

If `dataset.row_count` is very small, the plan may show a warning:

- "This dataset may be small for trend or anomaly review."

This is advisory only. Do not block later execution.

## 8. LLM Fallback Boundary For Later

LLM fallback is not part of Phase C implementation.

Future LLM fallback may be considered only when:

- deterministic schema-aware translation cannot confidently map the question
- the user has typed a question that cannot be clarified through simple field choices
- provider is implementation-configurable
- output is structured JSON only
- output is validated against dataset schema
- output does not include result claims
- output does not execute
- output does not call backend APIs
- output does not generate final SQL as an answer
- output does not bypass user review

Future LLM output must be treated as translation assistance only.

Allowed future LLM output shape:

- detected intent
- candidate field names from the provided schema only
- ambiguity notes
- clarifying questions
- proposed non-executable plan summary

Forbidden future LLM output:

- "The answer is..."
- fabricated calculations
- direct SQL execution
- direct backend calls
- hidden route or result mutations

All LLM-assisted draft plans must pass deterministic validation before any later execution phase can use them.

## 9. Safe UI Changes For Future Implementation

The review shell should evolve from generic hints into schema-aware review.

Allowed UI additions:

- matched columns
- candidate dimensions
- candidate measures
- candidate date fields
- ambiguity groups
- missing requirements
- suggested clarifying questions
- planned output type
- confidence explanation
- "No query has been generated yet"
- "No backend query has executed"
- "Execution status: not generated"

Suggested UI grouping:

1. User Question
2. Matched Fields
3. Investigation Intent
4. Missing Requirements
5. Clarifying Questions
6. Execution Boundary

Do not add:

- Run button
- generated SQL
- generated Query Builder request
- result preview
- answer summary
- export action
- dashboard action
- backend loading state

## 10. Recommended Implementation Checkpoints

### A. Create Translator Types Only

Files:

- `frontend/src/features/questionWorkspace/questionTranslatorTypes.ts`

Scope:

- type definitions only
- no runtime behavior
- no imports from execution/backend/result systems

Validation:

- build passes

Risk:

- low

### B. Create Deterministic Schema Matcher

Files:

- `frontend/src/features/questionWorkspace/schemaQuestionTranslator.ts`

Scope:

- pure functions
- input: raw question, dataset schema, active source name
- output: `SchemaAwareQuestionDraftPlan`
- no React hooks
- no backend imports
- no execution imports

Validation:

- build passes
- optional unit-style local tests later if project has test harness

Risk:

- low to medium because matching heuristics can overstate confidence

### C. Wire Matcher Into QuestionWorkspacePanel As Local Draft Plan

Files:

- `frontend/src/components/workspace/QuestionWorkspacePanel.tsx`

Scope:

- call translator after `Prepare answer`
- store draft plan in local state only
- display candidate fields and missing requirements

Forbidden:

- no query builder state mutation
- no execution callback
- no persistence

Risk:

- medium-low

### D. Add Ambiguity UI

Scope:

- show ambiguous term groups
- allow local UI selection of preferred candidate for display only
- no Query Builder mutation
- no executable payload

Risk:

- medium because selections can look like configuration. Copy must say "planning only."

### E. Add Clarifying Question Selection

Scope:

- show clarifying prompts
- clicking a prompt may append/fill the typed question or set a local answer field
- no execution

Risk:

- medium if prompts feel like generated answers

### F. Prepare For Future Executable Draft Generation

Scope:

- document what is needed to later convert draft plan into Query Builder request
- do not implement conversion
- keep `generatedQueryBuilderRequest: null`
- keep `generatedSql: null`

Risk:

- low if kept documentation/type-only

## 11. Files Likely To Change

Expected Phase C files:

- `frontend/src/features/questionWorkspace/questionTranslatorTypes.ts`
- `frontend/src/features/questionWorkspace/schemaQuestionTranslator.ts`
- optional `frontend/src/features/questionWorkspace/index.ts`
- `frontend/src/components/workspace/QuestionWorkspacePanel.tsx`
- `frontend/src/styles/query-builder.css` for display refinements

Files that must not change in Phase C:

- `backend/app/main.py`
- backend storage/session/upload files
- `frontend/src/services/api.ts`
- `frontend/src/features/execution/executeWorkspaceQuery.ts`
- `frontend/src/features/results/useResultExecutionCoordinator.ts`
- `frontend/src/features/results/activeResultModel.ts`
- `frontend/src/components/results/ResultsGrid.tsx`
- `frontend/src/features/export/useExportController.ts`
- `frontend/src/features/query-builder/useQueryBuilderController.ts`
- `frontend/src/components/query-builder/VisualQueryBuilderPanel.tsx`
- `frontend/src/features/analyst/sql/useSqlWorkspace.ts`
- `frontend/src/features/analyst/sql/SqlWorkspace.tsx`
- runtime persistence files
- dataset/session restore files
- Runtime Bridge / Runtime Intelligence metadata modules
- TaskLauncherPanel

`App.tsx` should not need changes if `QuestionWorkspacePanel` already receives `dataset` and `sourceName`. If Phase C needs additional props, keep them read-only and schema/context-only.

## 12. Definition Of Done

Phase C planning is complete when:

- The translator is defined as schema-aware and non-executable.
- Inputs are limited to user question, active dataset schema, active source context, and safe hints.
- The draft plan shape includes candidate dimensions, measures, date fields, ambiguity, missing requirements, clarifying questions, and planned output type.
- `executionStatus` is explicitly `"not_generated"`.
- generated SQL is explicitly absent.
- generated Query Builder request is explicitly absent.
- deterministic field matching rules are documented.
- ambiguity handling is documented.
- LLM fallback is documented as future translation-only behavior.
- safe UI evolution is documented.
- implementation checkpoints avoid execution and persistence.
- protected systems remain untouched.

## Final Planning Position

Phase C should make the question surface feel smarter by grounding it in the actual uploaded dataset schema, but it must remain planning-only.

The user's emotional experience should improve from "FiltraQueri noticed words in my question" to "FiltraQueri understands which fields in my dataset might answer this." The technical boundary stays unchanged: no SQL, no Query Builder request, no backend call, no result, no persistence, and no execution until a later checkpoint explicitly introduces a governed review-and-run path.
