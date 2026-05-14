# Phase F-93: Investigation Recommendation Prioritization and Context Ranking

## Purpose

Phase F-93 adds deterministic, metadata-only ranking for investigation guidance introduced in F-92. FiltraQueri can now surface the most relevant next analytical actions without executing queries, generating SQL, calling backend APIs, or navigating autonomously.

## Contracts

The runtime layer now includes:

- `GuidancePriority`
- `GuidanceScore`
- `GuidanceContextWeight`
- `GuidanceRecommendationGroup`

Guidance items are ranked by deterministic metadata scoring and grouped into calm recommendation sections.

## Ranking Adapter

`runtimeGuidanceRankingAdapter.ts` ranks guidance using:

- fixed base scores by guidance reason
- additive context weights from existing runtime metadata
- stable tie-breakers by reason order and id
- score clamping from 0 to 100
- priority buckets: high, medium, low

There is no machine learning, randomness, backend lookup, AI planner, or execution state.

## Recommendation Groups

Ranked recommendations are grouped as:

- Start investigation
- Continue analysis
- Inspect relationships
- Review SQL context
- Review results

The right runtime panel renders these groups as advisory navigation wrappers only.

## Boundary Guarantees

F-93 does not:

- change `executeWorkspaceQuery`
- change backend APIs
- change Query Builder request shapes
- mutate `ActiveResultModel`
- execute SQL from Monaco
- alter routing, back behavior, upload/session restore, workbook switching, pagination, exports, or SQL draft restore
- add AI execution, generated SQL, optimization, replay, governance, ledger, or MIR systems

## Regression Notes

Protected flows to verify:

- continuation navigation
- runtime persistence
- upload/session restore
- workbook switching
- pagination
- export
- SQL draft restore
- Human/Analyst switching
