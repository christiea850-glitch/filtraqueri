# Phase F-81: Data Profile and Engine/Dialect Recommendation Contracts

## Purpose

Phase F-81 adds metadata-only data intelligence contracts. The feature profiles uploaded dataset metadata and recommends future engine or dialect paths without executing anything.

The feature lives in `frontend/src/features/dataIntelligence/` and reads existing dataset and workbook metadata.

## Data Profile Contract

`DataProfileReport` describes:

- dataset shape
- detected column type counts
- numeric fields
- categorical fields
- date/time fields
- possible ID fields
- possible metrics
- possible dimensions
- workbook relationship context
- time-series readiness
- statistical-readiness signals

Human-facing summaries stay simple, for example:

`FiltraQueri detected this as a workbook with possible related sheets.`

Analyst-facing summaries expose structural metadata, such as candidate metric, dimension, and date/time field counts.

## Engine and Dialect Recommendations

`DialectRecommendationReport` recommends future paths from metadata signals:

- DuckDB SQL
- Excel workbook logic
- Python analysis
- R statistical analysis
- future MariaDB dialect inspection
- future Oracle dialect inspection
- future PostgreSQL/general SQL inspection

Recommendation examples:

- Mostly tabular filtering and grouping -> DuckDB SQL
- Multi-sheet workbook -> Excel workbook logic and relationship planning
- Date-based trend or forecasting readiness -> Python or R future path
- Correlation or statistical testing readiness -> R or Python future path
- ID-heavy, wide, or large enterprise-style tables -> future MariaDB, Oracle, or PostgreSQL/general SQL inspection

These recommendations are descriptive compatibility hints. They do not imply current execution support.

## Selector and Hook Surface

`useDataIntelligence(dataset)` exposes:

- `dataProfile`
- `dialectRecommendation`
- `recommendedFutureEngine`
- `humanSummary`
- `analystSummary`

Selectors expose common profile and recommendation fields for future Human Mode and Analyst Mode panels.

## Metadata-Only Guarantees

Phase F-81 does not:

- execute SQL
- generate SQL
- generate Python
- generate R
- call `executeWorkspaceQuery`
- mutate Query Builder state
- mutate active results
- add AI orchestration

The contracts only inspect already-available dataset and workbook metadata.

## Future Direction

Future phases can use these contracts to decide which execution path is most appropriate before any execution pipeline is connected. That pipeline should keep recommendation, preview, and execution as separate boundaries so analysts can inspect intent before any query or runtime is invoked.
