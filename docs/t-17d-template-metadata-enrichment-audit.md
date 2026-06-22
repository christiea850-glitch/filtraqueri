# T-17D Template Metadata Enrichment Audit

## Scope

This is an audit and design document for structured metadata enrichment across Ask FiltraQueri templates, report recipes, report opportunities, and generated recommendations.

No runtime behavior changes are included. This slice does not change UI, ranking, recommendation generation, SQL generation, SQL insertion, execution, backend/API calls, Monaco/editor behavior, relationship persistence, source resolution, worksheet scope, Browse Templates, Browse Reports, T-15 result presentation, T-16 relationship review, or T-17B classifier behavior.

## Files Inspected

- `frontend/src/features/analyst/sql/sqlTemplateLibrary.ts`
- `frontend/src/features/analyst/sql/sqlTemplateRecommender.ts`
- `frontend/src/features/analyst/sql/sqlReportRecipes.ts`
- `frontend/src/features/analyst/sql/reportIntelligencePlanner.ts`
- `frontend/src/features/analyst/sql/sqlAskFiltraQueriAdapter.ts`
- `frontend/src/features/analyst/sql/sqlAnalyticalStrategies.ts`
- `frontend/src/features/analyst/sql/sqlAdaptiveFitClassifier.ts`
- `frontend/src/features/analyst/sql/sqlCandidateGrounding.ts`
- `frontend/src/features/analyst/sql/businessSqlQueryPlanner.ts`
- `frontend/src/features/analyst/sql/businessSqlRenderReadiness.ts`
- `frontend/src/features/analyst/sql/businessSqlRenderer.ts`

## Current Metadata Findings

### Static SQL Templates

`SqlAssistantTemplate` currently has:

```ts
type SqlAssistantTemplate = {
  id: string;
  title: string;
  category: SqlTemplateCategory;
  explanation: string;
  dialectLabel: string;
  sql: string;
  dialects?: Array<SqlDialectId | SqlAssistantFutureDialectId>;
};
```

This is useful for browsing and insertion, but most metadata is human-readable. `category`, `dialectLabel`, and `dialects` are structured. `title`, `explanation`, and `sql` carry most of the semantic meaning.

Static templates include several different kinds of things:

- syntax helpers: `filter-equals`, `filter-contains`, `filter-in-list`, `inner-join`, `left-join`, `cte`, `subquery`, `dialect-conversion-note`
- safe single-table business patterns: `count-rows`, `count-by-category`, `sum-by-category`, `average-by-category`, `min-max-summary`, `missing-values`, `duplicates`, `distinct-values`, `top-n`, `bottom-n`
- date patterns: `date-range`, `group-by-year`, `group-by-month`
- advanced helpers: `case-when`, `row-number`, `rank-window`, `moving-average`
- dialect examples: `duckdb-date-trunc`, `mariadb-limit`, `oracle-fetch`, `postgresql-filtered-aggregate`
- join placeholders: `inner-join`, `left-join`, `right-join`, `full-outer-join`

The join placeholders are intentionally not safe adaptive business answers because they include placeholder table and column tokens. `sqlCandidateGrounding.ts` already blocks placeholder tokens such as `other_table` and `column_name`.

### Report Recipes

`SqlReportRecipe` currently has richer metadata:

```ts
type SqlReportRecipe = {
  id: SqlReportRecipeId;
  title: string;
  businessPurpose: string;
  requiredFieldRoles: string[];
  sqlPatterns: string[];
  dialectSupportNote: string;
  supportSummary: string;
  sql: string | null;
  warnings: string[];
  missingRequirements: string[];
  dialects?: Array<SqlDialectId | SqlAssistantFutureDialectId>;
  domains?: SqlReportRecipeDomain[];
  worksheetsUsed?: string[];
};
```

Structured fields include `id`, `sqlPatterns`, `sql`, `warnings`, `missingRequirements`, `dialects`, `domains`, and `worksheetsUsed`. Semi-structured fields include `requiredFieldRoles`, which are role-like but still strings such as "Category or segment" or "Numeric measure".

Recipes can already express support state through `sql: null`, `missingRequirements`, `warnings`, and `supportSummary`. However, they do not explicitly declare output shape, relationship mode, adaptation support, semantic role bindings, or whether they are syntax helpers versus business answers.

### Report Opportunities

`ReportOpportunity` has the richest current metadata:

```ts
type ReportOpportunity = {
  id: string;
  title: string;
  businessQuestion: string;
  whyItMatters: string;
  domains: ReportOpportunityDomain[];
  confidence: number;
  support: "can_generate_now" | "needs_missing_fields";
  method: "sql" | "excel" | "python" | "future_optimization";
  complexity: "simple" | "intermediate" | "complex";
  needsJoins: boolean;
  needsAggregation: boolean;
  needsDateLogic: boolean;
  needsAnomalyDetection: boolean;
  requiredTables: string[];
  optionalTables: string[];
  requiredColumns: string[];
  optionalColumns: string[];
  missingRequirements: string[];
  sql: string | null;
  dialects?: Array<SqlDialectId | SqlAssistantFutureDialectId>;
  compiledRecipeId?: string;
};
```

This is already mostly machine-readable. It knows domains, supportability, method, complexity, join needs, aggregation needs, date logic, anomaly detection, required tables, required columns, optional fields, missing requirements, and SQL availability.

The main gap is that output shape and semantic field roles are inferred indirectly from names, booleans, and SQL text rather than declared directly.

### Ask Recommendations And Strategies

`SqlTemplateRecommendation` preserves grounded candidate data after recommendation:

- `kind`
- `title`
- `description`
- `sql`
- `score`
- `reasons`
- `support`
- `detectedIntent`
- `candidateIntent`
- `unsupportedReasons`
- `warnings`
- `verifiedJoinKeys`

`SqlAnalyticalStrategy` adds more shape-like metadata:

- `strategyKind`
- `outputShape`
- `requiredEntities`
- `requiredRelationships`
- `isInsertable`
- `disabledReason`
- `confidence`
- `sql`
- `sourceRecommendationId`

Strategies are the closest current representation of "recommended analysis path", but `outputShape` is a string array rather than a structured role map. Insertability is found by text matching an existing recommendation, not by a shared metadata contract.

### Grounding And Safety Metadata

`sqlCandidateGrounding.ts` normalizes templates, recipes, and opportunities into `GroundedSqlCandidate`.

Important current safety metadata:

- `requiredTables`
- `usedTables`
- `requiredColumns`
- `usedColumns`
- `requiredJoins`
- `verifiedJoinKeys`
- `support`
- `unsupportedReasons`
- `warnings`

Grounding also blocks placeholder SQL tokens and validates tables, columns, intent alignment, and joins. This is the correct safety gate for future metadata-driven adaptation.

### Business SQL Contracts

The Business SQL planner, readiness evaluator, and renderer are deliberately narrow and strongly gated.

`businessSqlQueryPlanner.ts` only recognizes specific patterns such as:

- `leased_units_per_property`
- `leases_by_status`
- `orders_per_customer`
- `tickets_per_account`

`businessSqlRenderReadiness.ts` blocks rendering unless the plan is supported, resolved, has valid metric/grouping/entity metadata, uses DuckDB target, contains no pre-rendered SQL, and has verified join paths.

`businessSqlRenderer.ts` renders only known shapes after readiness. This contract should remain separate from template metadata enrichment. Future metadata can inform Ask explanation and candidate classification first, but should not bypass Business SQL readiness.

## Metadata Gaps

Current gaps for safe adaptive matching:

- Static templates do not declare `templateKind`.
- Static templates do not declare `outputShape`.
- Static templates do not declare semantic roles such as metric, grouping, status, date, or identifier.
- Static templates do not declare `relationshipMode`.
- Static templates do not declare whether adaptation is supported.
- Recipes express roles as human-readable strings, not structured role objects.
- Opportunities express join/date/aggregation needs well, but not output shape or role bindings.
- Generated Ask recommendations expose why they are safe, but not a shared metadata shape.
- Strategies have output columns and relationships, but no shared template metadata.
- The recommender still builds searchable text from metadata rather than using structured fit metadata.
- The adaptive classifier must infer syntax helpers from text patterns.

## Proposed Metadata Model

```ts
export type SqlTemplateKind =
  | "syntax_helper"
  | "business_answer"
  | "diagnostic"
  | "report_recipe"
  | "generated_strategy";

export type SqlTemplateOutputShape =
  | "grouped_count"
  | "status_breakdown"
  | "metric_by_dimension"
  | "detail_list"
  | "filtered_count"
  | "coverage_percent"
  | "gap_detection"
  | "ranked_summary"
  | "single_metric"
  | "data_quality_summary"
  | "trend"
  | "join_template"
  | "unknown";

export type SqlTemplateSemanticRoleName =
  | "entity"
  | "metric"
  | "grouping"
  | "filter"
  | "status"
  | "date"
  | "identifier";

export type SqlTemplateSemanticRole = {
  role: SqlTemplateSemanticRoleName;
  fieldHint?: string;
  required: boolean;
  source?: "schema_detection" | "recipe_role" | "opportunity_metadata" | "generated";
};

export type SqlTemplateRelationshipMode =
  | "single_table"
  | "requires_relationships"
  | "optional_relationships"
  | "unknown";

export type SqlTemplateAdaptationSupport =
  | "none"
  | "label_only"
  | "field_binding"
  | "single_table_sql"
  | "relationship_blocked";

export type SqlTemplateAdaptiveMetadata = {
  templateKind: SqlTemplateKind;
  outputShape: SqlTemplateOutputShape;
  semanticRoles: SqlTemplateSemanticRole[];
  relationshipMode: SqlTemplateRelationshipMode;
  adaptationSupport: SqlTemplateAdaptationSupport;
  safety: {
    canInsertExistingSql: boolean;
    canAdaptSql: boolean;
    requiresGrounding: boolean;
    requiresAcceptedRelationships: boolean;
    manualInsertOnly: true;
  };
};
```

Suggested source integration:

```ts
type SqlAssistantTemplate = {
  id: string;
  title: string;
  category: SqlTemplateCategory;
  explanation: string;
  dialectLabel: string;
  sql: string;
  dialects?: Array<SqlDialectId | SqlAssistantFutureDialectId>;
  adaptiveMetadata?: SqlTemplateAdaptiveMetadata;
};

type SqlReportRecipe = {
  // existing fields...
  adaptiveMetadata?: SqlTemplateAdaptiveMetadata;
};

type ReportOpportunity = {
  // existing fields...
  adaptiveMetadata?: SqlTemplateAdaptiveMetadata;
};

type SqlAnalyticalStrategy = {
  // existing fields...
  adaptiveMetadata?: SqlTemplateAdaptiveMetadata;
};
```

## Classification Examples

### Static Templates

`filter-equals`

```ts
{
  templateKind: "syntax_helper",
  outputShape: "filtered_count", // or "detail_list" if SELECT rows remain the intent
  semanticRoles: [
    { role: "filter", fieldHint: "categorical column", required: true },
    { role: "entity", fieldHint: "active table", required: true }
  ],
  relationshipMode: "single_table",
  adaptationSupport: "field_binding",
  safety: {
    canInsertExistingSql: true,
    canAdaptSql: false,
    requiresGrounding: true,
    requiresAcceptedRelationships: false,
    manualInsertOnly: true
  }
}
```

`count-by-category`

```ts
{
  templateKind: "business_answer",
  outputShape: "grouped_count",
  semanticRoles: [
    { role: "entity", fieldHint: "active table", required: true },
    { role: "grouping", fieldHint: "categorical column", required: true }
  ],
  relationshipMode: "single_table",
  adaptationSupport: "single_table_sql",
  safety: {
    canInsertExistingSql: true,
    canAdaptSql: false,
    requiresGrounding: true,
    requiresAcceptedRelationships: false,
    manualInsertOnly: true
  }
}
```

`sum-by-category`

```ts
{
  templateKind: "business_answer",
  outputShape: "metric_by_dimension",
  semanticRoles: [
    { role: "metric", fieldHint: "numeric column", required: true },
    { role: "grouping", fieldHint: "categorical column", required: true }
  ],
  relationshipMode: "single_table",
  adaptationSupport: "single_table_sql",
  safety: {
    canInsertExistingSql: true,
    canAdaptSql: false,
    requiresGrounding: true,
    requiresAcceptedRelationships: false,
    manualInsertOnly: true
  }
}
```

`inner-join`

```ts
{
  templateKind: "syntax_helper",
  outputShape: "join_template",
  semanticRoles: [
    { role: "identifier", fieldHint: "join key", required: true }
  ],
  relationshipMode: "requires_relationships",
  adaptationSupport: "relationship_blocked",
  safety: {
    canInsertExistingSql: false,
    canAdaptSql: false,
    requiresGrounding: true,
    requiresAcceptedRelationships: true,
    manualInsertOnly: true
  }
}
```

`dialect-conversion-note`

```ts
{
  templateKind: "diagnostic",
  outputShape: "unknown",
  semanticRoles: [],
  relationshipMode: "unknown",
  adaptationSupport: "none",
  safety: {
    canInsertExistingSql: true,
    canAdaptSql: false,
    requiresGrounding: false,
    requiresAcceptedRelationships: false,
    manualInsertOnly: true
  }
}
```

### Report Recipes

`top-performers`

```ts
{
  templateKind: "report_recipe",
  outputShape: "metric_by_dimension",
  semanticRoles: [
    { role: "grouping", fieldHint: "category or segment", required: true, source: "recipe_role" },
    { role: "metric", fieldHint: "numeric measure", required: true, source: "recipe_role" }
  ],
  relationshipMode: "single_table",
  adaptationSupport: "field_binding",
  safety: {
    canInsertExistingSql: true,
    canAdaptSql: false,
    requiresGrounding: true,
    requiresAcceptedRelationships: false,
    manualInsertOnly: true
  }
}
```

`multi-table-join`

```ts
{
  templateKind: "report_recipe",
  outputShape: "join_template",
  semanticRoles: [
    { role: "entity", fieldHint: "related tables or workbook sheets", required: true, source: "recipe_role" },
    { role: "identifier", fieldHint: "known join keys", required: true, source: "recipe_role" }
  ],
  relationshipMode: "requires_relationships",
  adaptationSupport: "relationship_blocked",
  safety: {
    canInsertExistingSql: false,
    canAdaptSql: false,
    requiresGrounding: true,
    requiresAcceptedRelationships: true,
    manualInsertOnly: true
  }
}
```

`data-quality`

```ts
{
  templateKind: "diagnostic",
  outputShape: "data_quality_summary",
  semanticRoles: [
    { role: "entity", fieldHint: "active table schema", required: true, source: "recipe_role" }
  ],
  relationshipMode: "single_table",
  adaptationSupport: "field_binding",
  safety: {
    canInsertExistingSql: true,
    canAdaptSql: false,
    requiresGrounding: true,
    requiresAcceptedRelationships: false,
    manualInsertOnly: true
  }
}
```

### Report Opportunities

`status-summary:*`

```ts
{
  templateKind: "business_answer",
  outputShape: "status_breakdown",
  semanticRoles: [
    { role: "status", fieldHint: "status column", required: true, source: "opportunity_metadata" },
    { role: "entity", fieldHint: "worksheet table", required: true, source: "opportunity_metadata" }
  ],
  relationshipMode: "single_table",
  adaptationSupport: "single_table_sql",
  safety: {
    canInsertExistingSql: true,
    canAdaptSql: false,
    requiresGrounding: true,
    requiresAcceptedRelationships: false,
    manualInsertOnly: true
  }
}
```

`sales-top-products`

```ts
{
  templateKind: "business_answer",
  outputShape: "metric_by_dimension",
  semanticRoles: [
    { role: "entity", fieldHint: "orders table", required: true, source: "opportunity_metadata" },
    { role: "entity", fieldHint: "products table", required: true, source: "opportunity_metadata" },
    { role: "identifier", fieldHint: "product join key", required: true, source: "opportunity_metadata" },
    { role: "metric", fieldHint: "amount/revenue column", required: true, source: "opportunity_metadata" },
    { role: "grouping", fieldHint: "product name", required: true, source: "opportunity_metadata" }
  ],
  relationshipMode: "requires_relationships",
  adaptationSupport: "relationship_blocked",
  safety: {
    canInsertExistingSql: false,
    canAdaptSql: false,
    requiresGrounding: true,
    requiresAcceptedRelationships: true,
    manualInsertOnly: true
  }
}
```

## Proposed Migration Approach

1. Add shared metadata types only.
2. Add optional `adaptiveMetadata` fields to template, recipe, opportunity, and strategy types without changing runtime behavior.
3. Enrich a small, safe subset of static templates:
   - `count-rows`
   - `count-by-category`
   - `sum-by-category`
   - `average-by-category`
   - `missing-values`
   - `filter-equals`
4. Enrich a small subset of report recipes:
   - `category-summary`
   - `top-performers`
   - `data-quality`
   - `multi-table-join`
5. Enrich generated Ask recommendations created by deterministic helpers.
6. Teach the adaptive classifier to prefer explicit metadata when present, with text heuristics as fallback.
7. Only after fixtures prove metadata quality, pilot deterministic single-table adaptation.

## Safety Gates

Metadata must not be treated as permission to generate or insert SQL.

Required gates:

- Existing SQL must still pass candidate grounding.
- Adapted SQL must not exist until a later explicit adaptation slice.
- Relationship-dependent metadata must require accepted relationships.
- Join templates must stay non-insertable as adaptive business answers unless real join contracts exist.
- `manualInsertOnly` must remain true.
- No backend/API or provider calls.
- No Run Query invocation.
- No editor mutation until the existing manual insert path is used.
- Business SQL renderer readiness must remain separate and authoritative for Business SQL rendering.

## Recommended Next Slices

### T-17E: Add Metadata Types Only

Add shared TypeScript types and optional fields. Do not populate metadata broadly and do not change behavior.

### T-17F: Enrich A Fixture-Safe Template Subset

Add metadata to a small set of single-table templates and recipes. Add fixtures proving no ranking or insertion changes.

### T-17G: Use Metadata In Classifier Read-Only

Update the adaptive fit classifier to prefer explicit metadata for fit labels and generic-helper detection. Keep UI and insertion unchanged.

### T-17H: Single-Table Deterministic Adaptation Pilot

Pilot one or two single-table, relationship-free adaptations after grounding and metadata fixtures are strong enough.

### T-17I: Fixture Hardening Across Domains

Add cross-domain fixtures for sales, healthcare, inventory, HR, finance, school, operations, property, marketing, support, and generic CSV uploads.

## Recommendation

Proceed with metadata types before enrichment. The safest path is to make metadata optional, read-only, and ignored by ranking at first. Once types are stable, enrich a narrow single-table subset and let the classifier consume metadata only as explanation and fit evidence before any adaptation behavior is considered.
