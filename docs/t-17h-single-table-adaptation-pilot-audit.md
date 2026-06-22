# T-17H Single-Table Template Adaptation Pilot Audit

## Scope

T-17H is an audit and design slice only. It does not implement SQL adaptation, UI wiring, insertion, execution, backend calls, ranking changes, or source/scope changes.

The proposed pilot is a pure deterministic adapter for a narrow set of single-table SQL templates. It should be implemented separately from the Business SQL planner/renderer contracts and should return blocked statuses whenever required evidence is missing or ambiguous.

## Files Inspected

- `frontend/src/features/analyst/sql/sqlTemplateLibrary.ts`
- `frontend/src/features/analyst/sql/sqlTemplateRecommender.ts`
- `frontend/src/features/analyst/sql/sqlAskFiltraQueriAdapter.ts`
- `frontend/src/features/analyst/sql/sqlAnalyticalStrategies.ts`
- `frontend/src/features/analyst/sql/sqlAdaptiveFitClassifier.ts`
- `frontend/src/features/analyst/sql/sqlTemplateAdaptiveMetadata.ts`
- `frontend/src/features/analyst/sql/businessSqlQueryPlanner.ts`
- `frontend/src/features/analyst/sql/businessSqlRenderer.ts`
- `frontend/src/features/analyst/sql/sqlSourceLineAdapter.ts`
- `frontend/src/features/analyst/sql/resolveSqlTabSourceContext.ts`
- `frontend/src/features/analyst/sql/sqlWorksheetScopeAdapter.ts`
- `frontend/src/features/analyst/sql/sqlTypes.ts`

## Current Relevant Architecture

`sqlTemplateLibrary.ts` already creates deterministic templates from the active dataset schema. T-17F metadata marks the pilot candidates as single-table patterns, with `manualInsertOnly: true`, `requiresAcceptedRelationships: false`, and `canAdaptSql: false` in the current slice.

`sqlTemplateRecommender.ts` now passes optional `adaptiveMetadata` through recommendations without changing score/order. It is useful as evidence, but it does not bind fields.

`sqlAdaptiveFitClassifier.ts` reads adaptive metadata as read-only evidence. It can classify a template as exact, adapted, partial, blocked, or poor, but it does not produce adapted SQL.

`sqlAskFiltraQueriAdapter.ts` builds the Ask model and insertion model. It is the future integration point for showing an adapted recommendation, but T-17H should not change it.

`businessSqlQueryPlanner.ts` and `businessSqlRenderer.ts` are plan-contract-driven. They are intentionally conservative and support known business plan shapes. The single-table template pilot should not reuse or widen those contracts, because the pilot is a template-binding path rather than a Business SQL plan rendering path.

`resolveSqlTabSourceContext.ts`, `sqlSourceLineAdapter.ts`, and `sqlWorksheetScopeAdapter.ts` show that worksheet/source context is already explicit and read-only. The adapter should consume a resolved single worksheet/table context supplied by the caller instead of changing active source or worksheet scope.

## Safe Pilot Template Candidates

The first pilot should consider only these templates:

- `count-by-category`
- `sum-by-category`
- `average-by-category`
- `filter-equals`
- `top-n`
- `bottom-n`

### Candidate Notes

`count-by-category` is the safest first candidate. It requires exactly one table and one grouping column. It can produce `SELECT grouping, COUNT(*) AS row_count FROM table GROUP BY grouping ORDER BY row_count DESC LIMIT 100`.

`sum-by-category` and `average-by-category` require one grouping column and one numeric metric column. They should block if no deterministic numeric metric is found.

`filter-equals` requires one filter column and one deterministic sample or literal source. It is less safe than aggregation because prompt value extraction can be ambiguous. The pilot can support it only if a clear literal appears in the prompt or if the adapter returns a placeholder-free blocked status.

`top-n` and `bottom-n` require one sortable column and a safe selected output list from the same table. They can use a default limit only when the template already uses one. They should block if the sort column is unclear.

## Blocked Or Non-Pilot Candidates

Do not include these in the pilot:

- Join templates: `inner-join`, `left-join`, `right-join`, `full-outer-join`
- Multi-table or relationship-dependent questions
- Coverage percentage strategies
- Gap detection strategies
- Report recipes requiring multiple concepts
- LLM-generated or provider-generated SQL
- Business SQL planner/renderer outputs
- Advanced SQL helpers such as CTE, subquery, window functions, moving average, dialect examples
- Data quality templates unless a later slice explicitly designs them

## Metadata Sufficiency

Existing `adaptiveMetadata` is enough to identify candidate class and broad safety posture:

- `templateKind`
- `outputShape`
- `semanticRoles`
- `relationshipMode`
- `adaptationSupport`
- `safety.manualInsertOnly`
- `safety.requiresAcceptedRelationships`
- `safety.canAdaptSql`

It is not enough by itself to bind a concrete table, grouping column, metric column, sort column, filter column, or literal filter value.

## Additional Metadata Needed

Before implementing adaptation, add template-specific binding metadata outside the shared broad metadata, or extend it carefully with optional role constraints. Suggested fields:

```ts
type SqlTemplateBindingRole = {
  role: "table" | "grouping_column" | "metric_column" | "filter_column" | "sort_column" | "filter_value";
  required: boolean;
  allowedInferredTypes?: Array<"text" | "categorical" | "numeric" | "date" | "boolean">;
  promptEntitySource?: "counted_entity" | "grouping_entity" | "filter_terms" | "metric_intent";
  fallbackPolicy: "block" | "schema_first_confident";
};
```

For T-17I, this can be local to the adapter rather than added to the global metadata model.

## Table And Worksheet Selection

Table selection should come from an explicit resolved single source context, not from global workbook mutation:

- Prefer the active SQL tab source context from `resolveSqlTabSourceContext`.
- If Ask has exactly one applied worksheet scope selection, the caller may pass that table/schema.
- If multiple worksheets are selected, return `blocked_multi_table`.
- If no worksheet/table metadata is available, return `blocked_missing_table`.

The adapter should never change active source, worksheet scope, or executable dataset.

## Field Selection

Grouping, metric, filter, and sort fields should come only from deterministic schema metadata and question-shape evidence:

- Candidate columns must exist in the selected table schema.
- Grouping columns should prefer explicit prompt matches against column names, then `questionShape.groupingEntity.matchedColumns`, then safe categorical columns only if exactly one confident candidate exists.
- Metric columns for sum/average should require numeric inferred type and prompt or shape evidence. If multiple numeric candidates exist without a clear prompt match, return `blocked_missing_metric`.
- Sort columns for top/bottom should require sortable inferred type and prompt evidence, or exactly one sortable column.
- Filter columns should require prompt evidence or exactly one categorical/status-like candidate. Filter values should come from explicit prompt literals only in the pilot; otherwise block.

If the adapter has to guess, it should block.

## Proposed Adapter

Suggested file:

`frontend/src/features/analyst/sql/sqlSingleTableTemplateAdapter.ts`

### Types

```ts
export type SqlTemplateAdaptationStatus =
  | "ready"
  | "blocked_missing_table"
  | "blocked_missing_grouping"
  | "blocked_missing_metric"
  | "blocked_missing_filter"
  | "blocked_missing_sort"
  | "blocked_multi_table"
  | "blocked_relationship_required"
  | "unsupported_template";

export type SqlSingleTableAdaptationRequest = {
  prompt: string;
  questionShape: SqlBusinessQuestionShape;
  selectedTable: {
    worksheetId: string | null;
    worksheetLabel: string;
    tableName: string;
    schema: SchemaColumn[];
  } | null;
  template: Pick<SqlTemplateRecommendation, "id" | "title" | "adaptiveMetadata">;
  dialect: "duckdb";
};

export type SqlSingleTableAdaptationResult = {
  status: SqlTemplateAdaptationStatus;
  adaptedTitle: string;
  adaptedDescription: string;
  sql: string | null;
  expectedOutputColumns: string[];
  reasons: string[];
  bindings: {
    tableName?: string;
    groupingColumn?: string;
    metricColumn?: string;
    filterColumn?: string;
    sortColumn?: string;
  };
  safety: {
    noBackendCall: true;
    noRunQuery: true;
    manualInsertOnly: true;
    singleTableOnly: true;
    noJoins: true;
    noEditorMutationUntilManualInsert: true;
  };
};
```

### Adapter Entry Point

```ts
export function adaptSingleTableTemplate(
  request: SqlSingleTableAdaptationRequest,
): SqlSingleTableAdaptationResult;
```

## Safety Gates

The adapter should return a non-ready status unless all relevant gates pass:

1. Template id is in the pilot allowlist.
2. `adaptiveMetadata.relationshipMode === "single_table"`.
3. `adaptiveMetadata.safety.requiresAcceptedRelationships === false`.
4. Question shape is not `blocked_relationship_plan`.
5. `questionShape.relationshipDependent === false`.
6. `questionShape.relationshipGaps.length === 0`.
7. Exactly one selected table/schema is supplied.
8. All emitted identifiers exist in that table schema.
9. Identifiers are quoted through the existing `formatSqlTable` and `formatSqlColumn` helpers.
10. Generated SQL contains no `JOIN`, no second table, no subquery, and no relationship predicate.
11. No SQL is run.
12. No editor mutation occurs until a later explicit Insert action.
13. Adapter output is separate from Business SQL renderer contracts.

## SQL Generation Rules For The Pilot

The adapter should use fixed renderers per template id, not free-form string assembly from natural language.

Examples:

- `count-by-category`: fixed count/group/order/limit query.
- `sum-by-category`: fixed sum/group/order/limit query.
- `average-by-category`: fixed average/group/order/limit query.
- `filter-equals`: fixed select/from/where/limit query only with deterministic literal value.
- `top-n`: fixed select/from/order-desc/limit query.
- `bottom-n`: fixed select/from/order-asc/limit query.

All selected columns must be schema-backed. Aliases should be stable constants such as `row_count`, `total_value`, and `average_value`.

## Relationship And Join Guarantees

No joins are allowed in this pilot. A ready result requires:

- one table only
- no `relationshipDependent` question shape
- no relationship gaps
- no metadata requiring accepted relationships
- no relationship review items
- no SQL text containing `JOIN`

Questions like "How many orders by customer?" are safe only when `customer` is a column on the `orders` table, such as `customer_id` or `customer_name`. If `customer` refers to a separate `customers` worksheet, the adapter must return `blocked_relationship_required`.

## Preserving Manual Insert Only

The adapter result can include SQL only as a prepared candidate. It must not call `onChange`, mutate Monaco, mark a recommendation inserted, call Run Query, or call backend APIs.

Future insertion should continue through an explicit Insert action and should reuse the existing "active draft blocks insertion" behavior.

## Keeping Separate From Business SQL

The adapter should not create or modify `BusinessSqlQueryPlan`.

Business SQL planner/renderer remains responsible for known business plan shapes and relationship-aware rendering. The pilot adapter is a separate template-binding path for narrow single-table templates. This avoids expanding Business SQL readiness contracts to cover generic template adaptation.

## Future UI Wording

For T-17J/T-17K, use light copy:

- Badge: `Adapted template`
- Status: `Ready to insert`
- Helper: `FiltraQueri matched this template to the selected worksheet. Review before inserting.`
- Blocked helper: `FiltraQueri needs a clearer worksheet or column before adapting this template.`

Avoid technical copy like "field binding", "deterministic adapter", or "metadata".

## Proposed Tests

Pure adapter fixtures should prove:

1. `count-by-category` adapts when one table and one grouping column are clear.
2. `sum-by-category` blocks without a clear numeric metric.
3. `average-by-category` uses only numeric metric columns.
4. `filter-equals` blocks without a deterministic filter value.
5. `top-n` and `bottom-n` use one schema-backed sortable column.
6. Multi-table scope returns `blocked_multi_table`.
7. Relationship-dependent shape returns `blocked_relationship_required`.
8. Join templates return `unsupported_template`.
9. Unknown template ids return `unsupported_template`.
10. Missing selected table returns `blocked_missing_table`.
11. Missing grouping returns `blocked_missing_grouping`.
12. SQL uses quoted DuckDB identifiers.
13. SQL contains no joins.
14. SQL only references columns from selected table schema.
15. Safety flags are always true.
16. No editor/backend/run-query behavior exists in the adapter.

Future Ask wiring fixtures should prove:

1. Adapter result appears as read-only recommended analysis before insert is enabled.
2. Candidate ordering from recommender is unchanged.
3. Existing exact insertable recommendations still win over adapted templates.
4. Relationship blocked cards still show relationship review instead of adapted SQL.
5. Manual Insert remains required.

## Recommended Next Slices

### T-17I: Pure Adapter Only

Add `sqlSingleTableTemplateAdapter.ts` and fixtures. Do not wire it into Ask UI or insertion yet.

### T-17J: Read-Only Ask Model Wiring

Call the adapter from Ask model creation, surface ready/blocked adaptation evidence in the model, but keep it read-only with no insert.

### T-17K: Manual Insert For Safe Adapted SQL

Enable explicit Insert only for `status: "ready"` adapter results. Preserve existing active-draft and inserted-recommendation guards.

### T-17L: UI Polish And Fixture Hardening

Add concise "Adapted template" UI copy, collapse technical reasons, and broaden fixtures across worksheet scope, source mismatch, and relationship-blocked cases.

## Recommendation

Proceed with T-17I as a pure adapter with no runtime integration. Start with `count-by-category`; include the rest of the pilot allowlist as blocked or ready only when deterministic binding evidence is clear. Keep every uncertain case blocked.
