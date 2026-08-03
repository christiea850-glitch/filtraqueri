> Status
> Historical phase plan aligned with current execution-governance direction. This document preserves core-loop rationale; `docs/strategy/FILTRAQUERI_PRODUCT_DIRECTION.md` controls current product strategy, roadmap, SQL architecture direction, and Investigation positioning.

# UX-CORE-2 - Workspace Question-to-Answer Core Loop

## Document Status

Planning, audit, and implementation preparation only.

No application code, backend logic, SQL execution behavior, result/export behavior, upload/session restore, runtime persistence, routing, or governance contracts are changed by this document.

## Authoritative Direction

Current repository-wide product direction is authoritative: `docs/strategy/FILTRAQUERI_PRODUCT_DIRECTION.md`. This historical phase plan remains useful for UX sequencing and implementation rationale. Reference: `docs/DOCUMENT_INDEX.md`.

Business questions belong to Explore/Workspace flow, not Data. Data may suggest lightweight dataset hints only. Explore owns user-facing question shaping, while Analyst surfaces provide technical depth such as Inspect SQL. Future execution remains governed and manual.

## Current Authority Alignment

Current SQL and analytical-answer work follows this chain:

```text
question capture
-> grounding or proposal
-> canonical plan
-> readiness
-> capability
-> preview
-> manual Insert
-> manual Run
-> provenance
```

The canonical BusinessSqlQueryPlan is the source of analytical meaning after grounding for SQL work. No downstream layer may independently reinterpret the raw question. Preview and execution are separate concerns: previewing a dialect does not grant permission to execute against that dialect. There is no automatic Insert and no automatic Run. Real production-database execution later requires PS-Exec policy gates.

Future concepts such as `InvestigationPlan`, PS-Exec, ExecutedResult, AnalysisArtifact, VisualizationPlan, InsightFact, a metric registry, PostgreSQL execution, Oracle rendering, and rerun comparison are not claimed as implemented by this historical plan unless separately proven by current implementation documents.

## Product Goal

Slice 2 described the original phase goal for a real Workspace loop:

> The user types a business question in their own words, and FiltraQueri answers using the actual uploaded dataset.

Example user questions:

- "Which realtor manages the most properties?"
- "Which customers generate the most revenue?"
- "What changed most recently?"
- "Which properties are underperforming?"

The answer must be produced from the current uploaded dataset through an inspectable, user-approved execution path. It must not come from generic templates, static advisory cards, or fabricated narrative.

## Current Problem

FiltraQueri currently has several question-like surfaces, but they are not a true question-to-answer loop.

### Data Tab Question Surfaces

`DatasetSummaryPanel.tsx` currently derives and displays:

- hardcoded seed questions passed into `useBusinessQuestions`:
  - "Which products sell the most?"
  - "Are sales increasing?"
  - "Which regions perform best?"
  - "Can this data support forecasting?"
  - "Which customers generate the most revenue?"
- `smartBusinessQuestions`, which are generated from dataset profile signals but still remain suggestion text.
- `businessQuestions` focused workflow, which renders question interpretation cards.
- `suggestedAnalysisPaths`, which renders possible question/recommendation cards.
- `kpiIntelligence`, now framed as possible measures, but still contains KPI opportunity cards and chart metadata underneath.

These are advisory and metadata-driven. They may help the user think, but they do not answer a typed question.

### Possible Measures Surface

Current `kpiIntelligence` behavior:

- Builds opportunities from metadata and profile signals.
- Shows labels, summaries, confidence, and possible chart types.
- Does not execute.
- Does not produce a result table.
- Does not prove an answer from uploaded rows.

Problem:

- It can look like insight generation while remaining advisory-only.
- It belongs in Data only as lightweight measure hints.
- Actual measure calculation belongs to Workspace execution, and KPI presentation belongs to Dashboards after validation.

### Suggested Investigations / Possible Questions Surface

Current `suggestedAnalysisPaths` behavior:

- Uses workflow recommendations and metadata confidence.
- Shows possible result shapes and human summaries.
- Does not generate executable logic.
- Does not run existing Query Builder or SQL execution.
- Does not produce an ActiveResultModel-backed result.

Problem:

- It is a preview of possible work, not work.
- It should become a lightweight Data hint or a Workspace entry prompt, not the main experience.

### Business Questions Surface

Current `businessQuestions` behavior:

- Uses `useBusinessQuestions` and `businessQuestionClassifier`.
- Classifies known question strings into intent metadata.
- Can include default/hardcoded questions from Data and KPI intelligence.
- Renders confidence and detected intent category.
- Does not execute against the dataset.

Problem:

- It maps intent but does not answer.
- Data is pretending to help with business questions when Workspace should own typed question, generated logic, execution, and result review.

### TaskLauncherPanel Relationship

`TaskLauncherPanel` already has a sophisticated preparation system:

- task category and task selection
- guided inputs
- field suggestions
- planning readiness
- analysis plan preview
- execution preview
- workflow recommendations
- semantic/KPI/question metadata
- advanced workflow metadata

Problem:

- It remains a task-configuration system, not a typed-question answer loop.
- It should not be removed until Workspace has a safe replacement path.
- It may provide useful field recommendation logic later, but must not become the primary typed-question UX.

## Required Workspace Core Loop

Slice 2 must define and eventually implement this flow:

```text
Natural-language question
-> dataset/schema context
-> intent detection
-> generated SQL/Python/R or query plan
-> user review/approval if needed
-> execution through existing engine path
-> result table/chart/summary
-> optional "View logic"
-> follow-up question suggestions based on the actual result
```

### 1. Natural-Language Question

Workspace owns a primary question input.

Requirements:

- User can type a custom question.
- Placeholder examples may exist, but must not dominate the screen as a hardcoded card wall.
- Submitting a question must not immediately execute without a visible review boundary unless a later phase explicitly approves auto-execution.
- The question becomes the active Workspace objective.

Recommended first UI language:

- Page title: "Workspace"
- Primary prompt: "What business question should FiltraQueri answer?"
- Input placeholder: "Ask about this dataset..."
- Button: "Prepare answer" or "Review logic"

### 2. Dataset / Schema Context

Workspace uses existing dataset metadata:

- `dataset.schema`
- inferred types
- active worksheet metadata
- workbook source context
- Data-owned entity/metric/date/dimension hints as context

Rules:

- Data may provide hints; Workspace consumes them.
- Workspace should not re-render the full Data profile.
- Workspace should show only the fields relevant to the typed question.

### 3. Intent Detection

Workspace detects intent from the typed question and current schema. Under current authority, any SQL-facing implementation must convert grounded meaning into a canonical BusinessSqlQueryPlan; downstream layers must not reinterpret the raw prompt.

Initial intent categories may include:

- ranking / top-N
- aggregation / total / count
- trend / time change
- comparison by group
- underperformance / low ranking
- recent change
- missing/quality review

Intent detection must produce a structured, inspectable draft:

- selected measure
- selected entity/grouping field
- selected time field when relevant
- filters if detected
- sort direction
- row limit
- confidence and ambiguity notes

Rules:

- Ambiguous questions should ask for clarification or present field choices.
- Do not fabricate field mappings.
- Do not silently choose low-confidence fields when a user decision is needed.

### 4. Generated SQL / Python / R Or Query Plan

The first safe implementation should prefer one of two routes:

1. Query Builder request generation when the question maps cleanly to selected columns, grouping, aggregation, filtering, sorting, and limit.
2. Safe SELECT SQL generation when the question requires logic beyond current Query Builder state.

Python/R should remain future-facing unless an explicit execution engine exists. Generated Python/R may be shown as non-executable analyst-depth explanation only until execution support exists.

Generated logic must be inspectable before execution. Current authority separates the canonical analytical plan from renderer output and execution permission:

- human-readable plan
- selected fields
- generated Query Builder request or SQL
- warnings/ambiguities
- expected result shape

### 5. User Review / Approval

Execution must remain user-mediated. Current authority requires manual Insert and manual Run boundaries where SQL preview enters an executable surface.

The review state should answer:

- What will FiltraQueri calculate?
- Which fields will it use?
- What logic will run?
- What result should the user expect?

Allowed future actions, when implemented under the relevant execution phase:

- "Run answer" only after readiness, capability, and policy gates are satisfied
- "Edit fields"
- "View logic"
- "Cancel"

Forbidden:

- automatic backend execution on question typing
- hidden route changes
- hidden mutation of results
- autonomous export
- automatic dashboard creation

### 6. Execute Through Existing Engine Path

Execution must reuse existing owners. Production database execution is future PS-Exec scope and must not be inferred from preview capability.

Preferred paths:

- Query Builder path:
  - generate `QueryBuilderRequest`
  - call `executeWorkspaceQuery` with `source: "query-builder"`
  - reuse `runQueryBuilder` API
  - update queried result through `useResultExecutionCoordinator`

- SQL path:
  - generate safe SELECT SQL
  - call `executeWorkspaceQuery` with `source: "sql"`
  - reuse `queryDataset` API
  - preserve backend `validate_select_query`
  - coordinate result into existing result infrastructure

Do not introduce new backend execution endpoints in the first implementation unless a later technical audit proves existing endpoints cannot support the loop.

### 7. Result Table / Chart / Summary

The result must use existing result infrastructure:

- `WorkspaceExecutionResult`
- `coordinateExecutionResult`
- `ActiveResultModel`
- `ResultsGrid`
- result tabs
- pagination
- sorting
- export where already supported

Initial Slice 2 should prioritize result table and plain-language summary. Chart generation can remain deferred unless it is already available through existing result infrastructure.

### 8. Optional "View Logic"

Workspace owns analyst-depth expansion per result.

"View logic" should show:

- generated SQL or Query Builder request
- field mapping
- aggregation/grouping/sorting choices
- safety validation result
- source dataset/worksheet
- ambiguity notes

This replaces global Analyst Mode as the only way to inspect logic for a business answer. Analyst SQL workspace remains intact and separate.

### 9. Result-Based Follow-Up Suggestions

Follow-ups must be based on the actual result and active question, not only metadata templates.

Possible inputs:

- active result columns
- row count
- top values from result rows
- grouping columns
- numeric columns
- filters/sort
- question intent

Examples:

- "Compare the top result by region."
- "Show the same answer over time."
- "Filter to the lowest-performing group."
- "Export this result."

Rules:

- Follow-ups are suggestions only.
- No hidden execution.
- Follow-ups should prepare a new draft question or plan, not run automatically.

## Existing Systems To Reuse

### DuckDB / Backend Query Execution Path

This section describes the execution path available to the historical phase. It does not make DuckDB the permanent dialect strategy; current direction remains dialect-neutral, and production database execution requires future PS-Exec gates.

Existing backend owners:

- `backend/app/main.py`
- `/datasets/{dataset_id}/query-builder`
- `/datasets/{dataset_id}/query`
- `/datasets/{dataset_id}/filter`
- `/datasets/{dataset_id}/export`

Important existing safety:

- Query Builder validates selected/grouped columns against dataset schema.
- Query Builder supports selected columns, group by, aggregations, filters, sort, limit, page.
- SQL execution validates SELECT-only queries through `validate_select_query`.
- SQL execution blocks multiple statements and blocked keywords.
- SQL execution wraps the query in a limited subquery.

Reuse plan:

- Generate query-builder requests for common business questions.
- Generate safe SELECT SQL only when needed.
- Do not bypass backend validation.

### Query Builder

Existing frontend owners:

- `useQueryBuilderController`
- `VisualQueryBuilderPanel`
- `runVisualQuery` in `useResultExecutionCoordinator`
- backend `build_query_builder_sql`

Capabilities:

- selected fields
- grouping
- aggregations
- sorting
- row limit
- run approval
- queried result tab

Reuse plan:

- A typed question can compile into the same query-builder state/request.
- Existing `runVisualQuery` can remain the approval/execution path.
- For first implementation, prefer preparing the Query Builder state, then requiring user approval.

### SQL Workspace

Existing frontend owners:

- `SqlWorkspace`
- `useSqlWorkspace`
- `SqlEditorPanel`
- SQL draft metadata and draft restore
- SQL diagnostics/intelligence

Capabilities:

- SQL draft editing
- SELECT query execution through `executeWorkspaceQuery({ source: "sql" })`
- result preview
- optional `onExecutionResult` callback
- saved drafts

Reuse plan:

- Generated SQL can be shown in a Workspace "View logic" disclosure.
- Analyst SQL workspace must remain intact.
- Future integration may allow "Open in Analyst SQL" as an explicit action.

### Results View

Existing owners:

- `ResultsGrid`
- `ResultsInvestigationSurface`
- `ResultTabs`
- `useResultExecutionCoordinator`
- `useActiveResultModel`

Capabilities:

- result table display
- active result model
- active tab switching
- sorting
- pagination
- export controls
- result interpretation surfaces

Reuse plan:

- Question execution should produce a normal queried result.
- Do not create a separate one-off answer table.
- Use existing ResultsGrid and ActiveResultModel to prevent duplicate result systems.

### ActiveResultModel

Existing owner:

- `frontend/src/features/results/activeResultModel.ts`

Capabilities:

- normalizes active preview/filter/query result
- tracks rows, visible columns, hidden columns, total count, page, filters, grouping, sorting, export payload, chart readiness, insight readiness

Reuse plan:

- Typed question answers must become ActiveResultModel-backed results.
- Any summary/follow-up should consume the ActiveResultModel, not a separate result store.

### Runtime Persistence

Existing runtime persistence stores selected task and SQL metadata.

Reuse plan:

- Persist typed question draft only in a later persistence-safe checkpoint.
- Do not mutate runtime persistence during early UI-only or draft planning steps unless explicitly scoped.
- If persistence is needed, add it through existing runtime persistence owners, not advisory modules.

### Export / Pagination Behavior

Existing export owner:

- `useExportController`
- backend `/datasets/{dataset_id}/export`

Existing pagination owner:

- `useResultExecutionCoordinator`
- `ActiveResultModel`
- `ResultsGrid`

Reuse plan:

- Typed question result export should use existing active result export path.
- Pagination should use existing queried result page loading.
- Do not add export logic to question interpreter.

### Command / Navigation Protections

Existing protections:

- controlled hash routes for detail pages
- command launcher dispatches explicit commands
- App owns view changes
- `useResultExecutionCoordinator` owns result activation

Reuse plan:

- Add any question-related command as a UI command that navigates to Workspace input only.
- Do not put executable callbacks in advisory continuation metadata.
- Do not mutate routes from metadata-only modules.

## What Must Not Happen

Slice 2 must not:

- fabricate answers
- answer from templates
- show hardcoded question cards as the main experience
- let Data execute questions
- bypass existing execution safety
- mutate ActiveResultModel from advisory code
- create a second result table system
- break ResultsGrid
- break export
- break pagination
- break upload/session restore
- break SQL workspace
- break runtime governance
- remove existing task launcher code before a safe replacement path exists
- treat confidence metadata as proof of an answer
- auto-run generated SQL without user approval
- generate non-SELECT SQL
- add Python/R execution without a governed engine

## Data Tab Cleanup Implication

Once Workspace owns the real typed-question loop:

### Data Keeps

- dataset purpose summary
- row/column/source facts
- field types
- missing values and quality hints
- connected source cues
- entity/metric/date/dimension hints
- a small "Questions this data may support" hint list
- one bridge to Workspace

### Data Reduces

- `businessQuestions` focused workflow
- `suggestedAnalysisPaths` focused workflow
- `kpiIntelligence` cards
- possible chart type language
- confidence-heavy advisory cards
- any template question wall

### Workspace Owns

- typed question input
- active question/objective
- field mapping decisions
- generated logic
- review/approval
- execution
- result creation
- View Logic
- result-based follow-ups

### Intelligence Owns

- interpretation after execution
- recommendation after there is evidence
- executive summary
- decision narrative

### Dashboards Own

- KPI visual packaging
- storytelling layouts
- presentation/export composition after validated results exist

## Approved Open Decisions

### Open Decision #1 - Question Translation Architecture

Approved approach: hybrid translator.

Workspace question translation should use deterministic fast-path parsing first for recognized question shapes. If deterministic parsing cannot confidently translate the question, an LLM may be used as fallback translation assistance only.

Architectural requirements:

- Deterministic fast-path comes first for known question patterns.
- LLM fallback is allowed only when deterministic parsing cannot confidently translate the question.
- Structured Query Builder specs are preferred over raw SQL.
- Safe SELECT SQL is allowed only as fallback when the question cannot be represented cleanly as a Query Builder request.
- Historical local execution must still pass through existing `executeWorkspaceQuery`, backend validation, and the then-current DuckDB-backed path; this does not override current dialect-neutral direction.
- No LLM-generated answer text may be treated as a result unless backed by executed data.
- No direct LLM execution is allowed.
- Provider choice remains implementation-configurable.
- The LLM is translation assistance only, not the analytics engine.

Preservation requirements:

- Do not change the existing execution engine.
- Do not change backend query validation.
- Do not change `ActiveResultModel`.
- Do not change `ResultsGrid`.
- Do not change pagination.
- Do not change export.
- Do not change upload/session restore.
- Do not change SQL workspace behavior.

## Implementation Phases

### A. Audit Existing Execution / Query Flow

Goal:

- Confirm exact request/response contracts for Query Builder, SQL, filters, export, and ActiveResultModel.

Tasks:

- Review `executeWorkspaceQuery`.
- Review `useResultExecutionCoordinator`.
- Review `useQueryBuilderController`.
- Review backend `build_query_builder_sql`, `query_builder_dataset`, `query_dataset`, and `export_dataset`.
- Review `ResultsGrid` and `ActiveResultModel`.

Output:

- A short technical integration map before coding.

Preservation:

- No code changes unless documenting findings.

### B. Add Workspace Question Input UI

Goal:

- Add a Workspace-owned input for natural-language questions.

Scope:

- Presentation-only input and draft state.
- No execution yet.
- No Data changes except route/bridge language if needed.

UI:

- single input
- clear active dataset context
- "Prepare answer" button
- no card wall

Preserve:

- existing Query Builder and Results behavior.

### C. Wire Question Input To Schema / Context Interpretation

Goal:

- Interpret question against actual dataset schema.

Implementation direction:

- create a Workspace-owned question interpretation module or hook
- input: typed question, dataset schema, workbook active worksheet, Data profile hints
- output: structured draft intent and field candidates
- use deterministic translation first for recognized patterns
- call an implementation-configurable LLM provider only as translation fallback when deterministic confidence is too low
- prefer a Query Builder draft spec before considering safe SELECT SQL

Rules:

- deterministic first is required
- LLM output is only a draft translation, never an answer
- ambiguity must be explicit
- no execution
- no backend calls

### D. Generate Draft Logic / Plan

Goal:

- Convert interpretation into an executable draft plan.

Preferred output:

- Query Builder request for common cases:
  - top-N counts
  - sum by group
  - average by group
  - recent records
  - trend by date
- Safe SELECT SQL for cases that cannot be represented by Query Builder.
- LLM fallback may help translate the user question into one of these draft forms, but it must not execute, summarize results, or bypass review.

Review UI:

- plain-language explanation
- field mapping
- generated Query Builder plan or SQL
- warnings
- "Run answer"
- "Edit fields"
- "View logic"

No execution yet until user approves.

### E. Execute Through Existing Safe Path

Goal:

- Run approved plan through existing execution owners.

Preferred sequence:

1. Query Builder draft:
   - set/query Query Builder state or create request
   - call existing execution path
   - activate queried result

2. SQL draft:
   - call `executeWorkspaceQuery({ source: "sql" })`
   - rely on backend SELECT safety
   - coordinate into result infrastructure

Important:

- This phase must be done through composition/executable owners, not advisory modules.

### F. Show Result In Existing Results / ActiveResultModel Structure

Goal:

- A typed question answer becomes a normal result.

Requirements:

- ActiveResultModel is populated.
- ResultsGrid displays the result.
- Sorting/pagination use existing handlers.
- Export uses existing export controller where supported.

No separate "AI answer table."

### G. Add "View Logic"

Goal:

- Provide analyst depth per result.

Content:

- user question
- interpreted intent
- selected fields
- generated SQL or Query Builder request
- safety notes
- execution source

Rules:

- collapsed by default
- per-result, not global mode
- does not mutate SQL workspace unless user explicitly opens/copies into Analyst SQL in a later phase

### H. Add Result-Based Follow-Up Suggestions

Goal:

- Suggest follow-ups from actual result shape and values.

Inputs:

- ActiveResultModel
- result columns
- result row count
- grouping/sorting/filter metadata
- typed question
- generated logic

Examples:

- compare by another group
- review over time
- filter to the lowest performers
- export result
- inspect source rows

Rules:

- suggestions prepare drafts only
- no auto-execution
- no hardcoded answer claims

### I. Remove Or Demote Template Question Cards

Goal:

- Stop treating generic question cards as the main UX.

Actions:

- Demote Data `businessQuestions` and `suggestedAnalysisPaths`.
- Keep lightweight hints only.
- Move typed-question ownership into Workspace.
- Keep TaskLauncherPanel until Workspace replacement is stable.

## Suggested Architecture

### New Workspace-Owned Concepts

Potential future files:

- `frontend/src/features/questionWorkspace/questionIntentTypes.ts`
- `frontend/src/features/questionWorkspace/questionInterpreter.ts`
- `frontend/src/features/questionWorkspace/questionPlanBuilder.ts`
- `frontend/src/features/questionWorkspace/questionPlanValidation.ts`
- `frontend/src/features/questionWorkspace/useQuestionWorkspace.ts`
- `frontend/src/components/workspace/QuestionWorkspacePanel.tsx`

These should be presentational/composition safe:

- interpreter is advisory/draft only
- execution happens through existing executable owners
- generated plan does not mutate results until user approval

### Draft Question Plan Shape

Suggested type:

```ts
type QuestionAnswerDraft = {
  question: string;
  intent:
    | "ranking"
    | "aggregation"
    | "trend"
    | "comparison"
    | "recent_change"
    | "underperformance"
    | "quality_review"
    | "unknown";
  fieldMappings: {
    measure?: string;
    entity?: string;
    date?: string;
    groupBy?: string[];
    filters?: Array<{ column: string; operator: string; value: unknown }>;
  };
  executionDraft:
    | { kind: "query_builder"; request: QueryBuilderRequest }
    | { kind: "sql"; sql: string }
    | { kind: "needs_clarification"; questions: string[] };
  summary: string;
  warnings: string[];
};
```

Rules:

- No callbacks inside draft metadata.
- No executable function fields.
- No backend payload dispatch from advisory code.

## Governance Notes

Question interpretation is advisory until the user approves execution.

Execution belongs to:

- `useResultExecutionCoordinator`
- `executeWorkspaceQuery`
- backend query endpoints
- result coordination owners

Question interpretation must not:

- import backend services directly if classified advisory
- call `executeWorkspaceQuery`
- mutate ActiveResultModel
- persist runtime state directly
- dispatch route changes
- include callback fields in continuation metadata

If a hook coordinates execution, classify it as composition/hybrid and keep it outside metadata-only folders.

## Definition Of Done

Slice 2 is complete only when:

- User can type their own business question.
- The answer is based on the actual uploaded dataset.
- Generated logic can be inspected.
- Execution goes through existing safe execution paths.
- Results use existing ActiveResultModel and ResultsGrid infrastructure.
- Result pagination remains intact.
- Export remains intact.
- SQL workspace remains intact.
- Upload/session restore remains intact.
- Runtime governance boundaries remain intact.
- No generic card wall is treated as the main UX.
- Data no longer owns business-question workflow.
- Intelligence interprets after execution rather than pretending to answer before execution.
- Dashboards package validated outputs rather than owning raw question answering.
- TaskLauncherPanel is preserved until a safe replacement path exists.

## Non-Goals

- Do not build autonomous AI orchestration.
- Do not add chart generation as the first answer path.
- Do not add Python/R execution without an explicit governed engine.
- Do not rewrite backend execution.
- Do not remove Query Builder.
- Do not remove Analyst SQL.
- Do not remove TaskLauncherPanel during early Slice 2.
- Do not redesign global navigation.
- Do not create a second results model.

## Recommended First Implementation Checkpoint

Start with Phase A and B only:

1. Audit execution contracts in a small technical note.
2. Add a Workspace-owned typed question input with draft state.
3. Do not execute yet.
4. Do not generate SQL yet.
5. Do not remove task launcher yet.
6. Do not change Data beyond bridge copy if required.

This gives FiltraQueri the correct product center of gravity before adding execution risk.
