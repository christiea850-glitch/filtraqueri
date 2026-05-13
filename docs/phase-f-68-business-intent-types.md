# Phase F-68 Business Intent Types Foundation

## What Was Added

Phase F-68 adds a metadata-only business intent foundation under:

```text
frontend/src/features/businessIntent/
```

The new feature area defines:

- `BusinessIntent`
- `BusinessIntentCategory`
- `BusinessIntentInput`
- `BusinessIntentSupportedEngine`
- `BusinessIntentResultType`
- starter registry helpers

The starter registry includes metadata examples for:

- Best-performing products
- Compare departments
- Revenue trend analysis
- Customer inactivity check
- Unusual sales behavior
- Profit drop investigation
- Forecast revenue
- Correlation check

## Why Business Intents Exist

Business intents are the future bridge between plain business questions and
FiltraQueri's execution systems. They let the product model user goals such as
"Show me my best-performing products" without requiring the user to think in
SQL, formulas, Python, R, joins, grouping, or filters.

In this phase, intents are only definitions. They do not execute anything.

## SAS Studio-Inspired Guided Analytics Direction

The intent layer supports a future Task & Utilities model where users choose a
business task, provide guided inputs, and let FiltraQueri prepare the analysis.
This aligns with the strategic direction of a guided analytics operating
system:

```text
Business question
-> Business intent
-> Task configuration
-> Analysis plan
-> Engine adapter
-> Active result model
-> Explanation / insight
```

## Metadata-Only Guardrails

This phase does not:

- call `executeWorkspaceQuery`
- mutate Query Builder state
- update active results
- modify routing
- change Human/Analyst mode switching
- change SQL Workspace behavior
- change workbook switching
- persist new runtime state
- add AI orchestration

## Future Connections

Future phases can safely build on this foundation:

- F-69: task registry foundation
- F-70: Human Mode task launcher prototype
- F-71: intent-to-analysis-plan adapter
- F-72: business result explanation layer
- F-73: workbook relationship-aware join plan preview
- F-76+: AI-assisted intent drafting with validation

The next implementation should keep business intent metadata separate from
execution until a validated analysis-plan contract exists.
