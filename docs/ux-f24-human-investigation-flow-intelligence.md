# UX-F24 Human Investigation Flow Intelligence

## Goal

UX-F24 adds a deterministic Human Mode investigation intelligence layer. It helps users think in business questions, comparisons, changes, trends, anomalies, and follow-up investigations without changing execution behavior.

This phase is advisory and presentation-only. It does not run queries, mutate filters, change grouping logic, call AI APIs, or alter backend contracts.

## Architecture

New feature area:

- `frontend/src/features/investigationIntelligence/investigationTypes.ts`
- `frontend/src/features/investigationIntelligence/investigationContext.ts`
- `frontend/src/features/investigationIntelligence/investigationSuggestions.ts`
- `frontend/src/features/investigationIntelligence/investigationFlow.ts`
- `frontend/src/features/investigationIntelligence/investigationExplanation.ts`
- `frontend/src/features/investigationIntelligence/investigationReport.ts`
- `frontend/src/features/investigationIntelligence/index.ts`

The app builds an `InvestigationReport` from existing metadata:

- dataset schema
- structural/business field inference
- workbook relationship intelligence
- active result metadata when results exist

The report is then rendered in Human Mode surfaces:

- Explore shows good starting questions and possible next steps.
- Build shows the primary investigation goal, recommended comparisons, and question cards.
- Results shows follow-up investigation prompts after rows are available.

Analyst Mode remains technically oriented and does not receive the Human Mode business prompt surfaces.

## Intent Model

Supported investigation intents:

- `compare_entities`
- `identify_top_performers`
- `identify_underperformers`
- `detect_change`
- `explore_distribution`
- `summarize_activity`
- `investigate_trend`
- `investigate_anomaly`
- `understand_relationships`
- `evaluate_workload`
- `review_operations`
- `review_financials`
- `review_customer_activity`

Each intent includes:

- business label
- plain-English explanation
- suggested dimensions
- suggested measures
- suggested grouping styles
- suggested next actions
- advisory chart family metadata
- confidence score and confidence label

No charts are implemented in this phase.

## Investigation Flow Model

UX-F24 defines a reusable metadata-only flow contract with these stages:

- question
- scope
- compare
- summarize
- validate
- review_result
- next_investigation

The flow is not a workflow engine. It provides guidance text and stage metadata for future orchestration and AI augmentation.

## Suggestion Generation

Suggestions are deterministic and metadata-driven. They inspect:

- likely customer fields
- likely financial fields
- likely operational/workforce fields
- date/time fields
- numeric measures
- categorical/text dimensions
- workbook relationship hints

Examples generated from metadata:

- Compare by region.
- Review customer activity.
- Review financial patterns.
- Review changes over time.
- Explore workload distribution.
- Review related sheets.
- Review unusual records.

All suggestions are advisory. They do not change selected columns, filters, grouping, sorting, query generation, or execution.

## Preservation Guarantees

UX-F24 does not alter:

- `executeWorkspaceQuery`
- filtering/grouping execution
- `ActiveResultModel`
- `ResultsGrid` data contracts
- exports
- workbook storage
- runtime persistence
- SQL generation behavior
- Monaco/editor behavior
- pagination behavior
- workbook switching
- routing/back behavior
- upload/session restore
- Human/Analyst switching
- workbook intelligence
- structural intelligence

Existing buttons that run queries or apply filters still use the existing paths. New investigation content is informational or fills local prompt text only.

## UX Notes

The UI follows the canonical workspace rules:

- flat panels
- calm business language
- no noisy metadata stacks
- no nested card overload
- no duplicated context
- wide workspace preservation
- compact follow-up prompts in Results

Human Mode wording avoids engine and execution vocabulary. Analyst Mode remains unchanged for technical inspection.

## Future AI Readiness

The investigation layer is intentionally contract-first. Future AI support can use the same report shape to:

- rewrite suggestions in user-specific language
- rank follow-ups from result patterns
- explain why an investigation path is promising
- prepare draft query-builder configurations

Future AI augmentation should remain advisory unless the user explicitly approves an action.

## Validation Checklist

- Run targeted lint for changed frontend files.
- Run `npm run build`.
- Verify workbook uploads and worksheet switching still work.
- Verify filtering/grouping still use existing controls and execution paths.
- Verify ResultsGrid pagination, sorting, exports, column visibility, and active result behavior remain intact.
- Verify Analyst Mode and Monaco are unchanged.
- Verify routing/back behavior and session restore are unchanged.
- Verify no horizontal overflow on Explore, Build, Results, and Analyst surfaces.
