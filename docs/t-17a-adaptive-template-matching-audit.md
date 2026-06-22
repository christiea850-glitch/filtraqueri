# T-17A Adaptive Template Matching Audit

## Scope

This audit designs a deterministic, frontend-only adaptive template matching and solution-composer layer for Ask FiltraQueri.

No runtime behavior was changed in this slice. The design preserves the current guarantees:

- no SQL execution changes
- no backend or API calls
- no provider or LLM dependency
- no Run Query changes
- no editor or Monaco draft behavior changes
- no worksheet scope behavior changes
- no relationship persistence or acceptance
- no SQL generation from unconfirmed relationships

## Files Inspected

- `frontend/src/features/analyst/sql/sqlAskFiltraQueriAdapter.ts`
- `frontend/src/features/analyst/sql/sqlBusinessQuestionShape.ts`
- `frontend/src/features/analyst/sql/sqlAnalyticalStrategies.ts`
- `frontend/src/features/analyst/sql/sqlTemplateRecommender.ts`
- `frontend/src/features/analyst/sql/sqlCandidateGrounding.ts`
- `frontend/src/features/analyst/sql/sqlTemplateLibrary.ts`
- `frontend/src/features/analyst/sql/sqlReportRecipes.ts`
- `frontend/src/features/analyst/sql/reportIntelligencePlanner.ts`
- `frontend/src/features/analyst/sql/businessSqlQueryPlanner.ts`
- `frontend/src/features/analyst/sql/businessSqlRenderReadiness.ts`
- `frontend/src/features/analyst/sql/businessSqlRenderer.ts`
- `frontend/src/features/analyst/sql/businessSqlJoinPathResolver.ts`
- `frontend/src/features/analyst/sql/adaptiveReportProposalUiAdapter.ts`
- `frontend/src/features/analyst/sql/sqlRelationshipReview.ts`
- `frontend/src/features/analyst/sql/SqlEditorPanel.tsx`
- `frontend/src/features/analyst/sql/SqlAssistantPanel.tsx`

## Current Architecture Findings

Ask FiltraQueri currently combines deterministic question-shape intelligence, static template recommendations, report opportunities, blocked relationship plans, and analytical strategy cards.

The main flow is in `sqlAskFiltraQueriAdapter.ts`:

1. Build static assistant templates, report recipes, report opportunities, scope recommendations, and business-question shape.
2. Recommend grounded templates through `recommendSqlTemplates`.
3. Add safe generated recommendations for supported single-table grouped counts or status breakdowns.
4. Add blocked relationship plans when the question requires missing worksheet relationships.
5. Rank candidates with `rankSqlAskRecommendationsForQuestionShape`.
6. Build analytical strategy cards with `recommendAnalyticalStrategies`.
7. Preserve manual insertion through the existing insert model.

This is a strong safety baseline, but it does not yet model adaptive fit. Recommendations are still primarily "candidate matched prompt/scope/schema" rather than "this is the best solution shape for the user's question."

## Matching And Ranking Today

`sqlTemplateRecommender.ts` scores candidates by:

- prompt token overlap
- active scope labels
- worksheet/table labels
- matched column names
- report-like question boosts
- grounded support status

`sqlBusinessQuestionShape.ts` then applies shape bonuses and penalties for deterministic intents such as:

- grouped count
- status breakdown
- filtered count
- metric by dimension
- detail list
- blocked relationship plan

This helps avoid some irrelevant recommendations, but it does not distinguish:

- an exact business fit
- a generic SQL syntax helper
- a partial business fit
- a safely adapted answer
- a composed multi-step analysis
- a blocked but otherwise promising answer

The existing `adaptiveReportProposalUiAdapter.ts` already contains a useful seed for this distinction. It classifies recommendations as:

- no match
- generic syntax helper match
- meaningful business match

T-17B should reuse or extract that idea rather than duplicating it.

## Metadata Assessment

Static templates in `sqlTemplateLibrary.ts` are intentionally lightweight. They provide title, category, explanation, dialect label, SQL, and dialect coverage. That is enough for browsing and generic insertion, but too thin for adaptive matching because templates do not declare:

- output shape
- required semantic roles
- whether they are syntax helpers or business answers
- safe transformation hints
- whether the SQL is meant to be adapted
- whether a candidate is single-table only or relationship-dependent

Report recipes in `sqlReportRecipes.ts` are richer. They include business purpose, required field roles, support summary, warnings, missing requirements, domains, worksheets used, and SQL patterns. However, field roles are mostly human-readable strings, not structured machine-readable bindings.

Report opportunities in `reportIntelligencePlanner.ts` provide the best adaptive metadata today. They include confidence, support, domains, required tables, required columns, optional fields, complexity, and whether joins, aggregation, date logic, or anomaly detection are needed. These are good inputs for a future fit classifier.

`sqlCandidateGrounding.ts` is the most important safety gate. It validates placeholder SQL, required tables, required columns, intent mismatch, and joins through accepted relationship contracts or verified recipe joins. The future adaptive layer should depend on this gate, not bypass it.

## Adaptation Gaps

The system does not yet have a central model for these cases:

- The user asks for a business answer, but only a generic syntax template matches.
- A template has the right aggregation pattern but the wrong entity or dimension.
- A report opportunity has the right business intent but lacks confirmed relationships.
- Multiple strategies together explain the best analysis, but no single insertable SQL exists.
- A candidate is safe as a read-only suggestion but unsafe to insert.
- The UI should explain progress toward a solution without implying SQL is ready.

`sqlAnalyticalStrategies.ts` partially addresses this by creating strategy cards such as grouped counts, coverage percentages, ranked summaries, gap detection, metric breakdowns, status breakdowns, detail lists, and filtered counts. But strategies currently attach insertable SQL only by searching existing recommendation text. That is useful but too weak to be the long-term composer.

## Proposed Adaptive Fit Categories

Add a frontend-only fit classifier before adding any new SQL composition behavior.

Recommended categories:

- `exact_fit`: Existing grounded candidate directly answers the question. SQL can be insertable only if already supported by existing grounding.
- `adapted_fit`: Existing candidate can be deterministically adapted to the question using declared metadata and safe bindings. SQL insertion should remain disabled until a later slice adds a renderer and fixtures.
- `partial_fit`: Candidate matches part of the question, such as the right metric but not the requested grouping. Display as progress, not as ready SQL.
- `composed_solution`: Multiple strategies or candidates together form the recommended analytical path. Initially read-only unless every component is deterministically supported.
- `blocked_fit`: The system understands the question, but missing relationships, fields, or unsupported scope prevent safe SQL.
- `poor_fit`: Candidate is a generic helper or weak match and should not be promoted as the primary answer.

Suggested interface shape:

```ts
type SqlAdaptiveFitCategory =
  | "exact_fit"
  | "adapted_fit"
  | "partial_fit"
  | "composed_solution"
  | "blocked_fit"
  | "poor_fit";

type SqlAdaptiveInsertState =
  | "insertable_existing_sql"
  | "read_only"
  | "blocked_relationships"
  | "blocked_missing_fields"
  | "needs_confirmation";

type SqlAdaptiveCandidateFit = {
  candidateId: string;
  source: "template" | "recipe" | "opportunity" | "generated" | "strategy";
  category: SqlAdaptiveFitCategory;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  requiredEntities: string[];
  requiredRelationships: string[];
  missingFields: string[];
  insertState: SqlAdaptiveInsertState;
};

type SqlComposedAnalysisSolution = {
  id: string;
  title: string;
  description: string;
  category: SqlAdaptiveFitCategory;
  candidateFits: SqlAdaptiveCandidateFit[];
  requiredRelationships: string[];
  canInsertSql: boolean;
  sql?: string;
  safety: {
    noBackendCall: true;
    noRunQuery: true;
    noEditorMutationUntilManualInsert: true;
    noUnconfirmedRelationshipSql: true;
  };
};
```

The first implementation should produce read-only classification metadata only. It should not generate new SQL.

## Proposed Ask UI Flow

The best UI entry point is inside the existing Ask suggestions area in `SqlEditorPanel.tsx`, above or near "Analysis options" and "Recommended templates."

Recommended display:

- A compact "Best analysis pattern" or "Analysis fit" card.
- A fit label such as "Exact match", "Partial match", "Needs worksheet relationships", or "Composed analysis".
- A short deterministic explanation of why the fit was chosen.
- Progress details such as matched worksheets, matched columns, missing relationships, and missing fields.
- Manual insert action only when the fit wraps an already-supported existing recommendation.
- "Review relationships" action when the fit is relationship-blocked, using the T-16A read-only relationship review panel.

Suggested copy:

- Exact: "This recommendation directly matches the question and available worksheet fields."
- Partial: "This matches part of the question, but additional fields or relationships are needed for the full answer."
- Composed: "FiltraQueri can describe the analysis path, but no single safe SQL query is ready yet."
- Blocked: "FiltraQueri understands the question, but cross-table SQL is blocked until worksheet relationships are confirmed."

Browse Templates and Browse Reports should remain unchanged. The adaptive layer should be Ask-only at first.

## Relationship Readiness Fit

Relationship readiness should remain an explicit safety gate.

Useful existing inputs:

- `relationshipDependent` and `relationshipGaps` from `SqlBusinessQuestionShape`
- join validation in `groundCandidate`
- accepted relationship resolution in `businessSqlJoinPathResolver`
- render readiness checks in `businessSqlRenderReadiness`
- T-16A read-only relationship review records from `sqlRelationshipReview`

Future adaptive matching should classify missing relationships as `blocked_fit`, not as `partial_fit`, when the question requires cross-table SQL and the relationships are not accepted. The UI can still show likely worksheet pairs and deterministic column suggestions, but it must not mark relationships accepted or produce unconfirmed join SQL.

## Safety Gates For Future Slices

Adaptive matching should be allowed to improve explanation before it is allowed to produce SQL.

Required gates:

- All candidate SQL must pass `groundCandidate`.
- Relationship-dependent SQL must use accepted relationship contracts.
- Business SQL rendering must continue to pass readiness checks before SQL exists.
- Manual insertion must keep using the existing Ask insertion path.
- No adaptive layer should call backend APIs, providers, or SQL execution.
- Partial, composed, blocked, and poor-fit categories should be read-only by default.
- Adapted SQL should not be introduced until deterministic metadata and fixtures prove the transformation.

## Recommended Implementation Slices

### T-17B: Fit Classifier Only

Create a pure deterministic classifier that accepts question shape, grounded recommendations, strategies, and relationship review state. Return fit categories and explanations. No UI changes and no SQL generation.

### T-17C: Ask UI Fit Summary

Render the read-only fit summary in the Ask panel. Show exact, partial, composed, blocked, or poor-fit labels. Preserve all insert and execution behavior.

### T-17D: Metadata Enrichment

Add structured metadata to templates, recipes, and opportunities:

- output shape
- semantic field roles
- required entity roles
- relationship dependency
- syntax-helper vs business-answer classification
- safe adaptation hints

Do not change ranking behavior in this slice.

### T-17E: Deterministic Single-Table Adaptation

Allow adapted fit only for single-table, relationship-free patterns with deterministic field bindings. SQL remains manual insert only and must pass grounding.

### T-17F: Read-Only Solution Composer

Compose strategy cards and candidate fits into a recommended analysis path. Keep composed solutions read-only unless every part is already supported by existing deterministic SQL.

### T-17G: Relationship-Aware Composition

Integrate blocked relationship fits with the T-16A relationship review panel. Show required pairs and possible column matches without persistence or acceptance.

### T-17H: Fixture Hardening

Add domain fixtures across sales, healthcare, inventory, HR, finance, school, operations, property, marketing, and support datasets. Include exact, partial, generic-helper, blocked, and composed cases.

## Fixture Targets

Future tests should prove:

- generic syntax helpers are not promoted as exact business matches
- exact status and grouped-count matches remain insertable when already supported
- relationship-dependent questions become blocked fits without accepted relationships
- accepted relationships are required before any join SQL is insertable
- composed solutions are read-only until deterministic SQL exists
- raw recommendation ranking remains stable unless a slice explicitly changes it
- no backend/API calls are introduced
- Run Query remains manual
- editor mutation happens only through existing manual insert actions

## Recommendation

Proceed with T-17B as a pure classifier. It should live beside the Ask adapter and consume existing deterministic outputs instead of replacing the recommender. The classifier should first improve explanation and prioritization only; SQL adaptation and composition should come later after structured metadata and fixtures are in place.
