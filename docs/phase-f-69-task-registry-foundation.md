# Phase F-69 Task Registry Foundation

## What Task Registry Means

The task registry is a metadata-only catalog of guided analytics workflows.
Tasks are future launchable experiences such as "Best-Performing Products" or
"Forecast Revenue." They describe what a user wants to do, what inputs the
workflow will need, which business intents it supports, and which engines may
eventually support the work.

In this phase, tasks do not execute anything.

## Difference Between Tasks and Business Intents

Business intents describe the user's goal:

```text
"Show me my best-performing products"
```

Tasks describe a guided workflow that can satisfy one or more intents:

```text
Task: Best-Performing Products
Inputs: product/entity field, metric, optional date field
Future output: ranked table, summary, chart preview, explanation
```

Intents are semantic goals. Tasks are guided workflow definitions.

## SAS Studio-Inspired Guided Analytics

The task registry supports a future SAS Studio-inspired Task & Utilities model:

```text
Choose task
-> Configure guided inputs
-> Validate inputs
-> Create analysis plan
-> Route to an engine adapter
-> Feed active result model
-> Explain result in business language
```

This direction helps FiltraQueri become a guided analytics operating system
rather than a syntax-first query tool.

## Metadata-Only Guardrails

F-69 does not:

- execute queries
- generate SQL, Python, or R
- mutate Query Builder state
- mutate active results
- call `executeWorkspaceQuery`
- modify workbook state
- change routing
- redesign UI
- add AI orchestration

## Future Human Mode Task Launcher

A later Human Mode task launcher can read this registry to display business
tasks by category. The launcher should create a structured task configuration
and then pass it to a future analysis-plan layer. It should not directly call
execution APIs.

## Future Phases

- F-70: Human Mode task launcher prototype
- F-71: task configuration and validation contracts
- F-72: intent/task to analysis-plan adapter
- F-73: business result explanation layer
- F-74+: workbook relationship-aware task planning

The next phase should keep task selection separate from execution until an
analysis-plan contract exists.
