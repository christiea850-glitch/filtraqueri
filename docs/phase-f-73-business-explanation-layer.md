# Phase F-73 Business Explanation Layer Foundation

## What Was Added

Phase F-73 adds a metadata-only explanation feature area:

```text
frontend/src/features/explanations/
```

It defines:

- `BusinessExplanation`
- `ExplanationType`
- `ExplanationTemplate`
- explanation templates
- metadata-only explanation builder
- explanation selectors
- `useExplanationLayer`

## Purpose

The business explanation layer translates task and analysis-plan metadata into
plain business language. It helps Human Mode explain what a workflow means
without exposing SQL, Python, R, formulas, joins, grouping syntax, or model
details.

## What It Explains

The layer can describe:

- what a task means
- what business value it provides
- what future outputs may represent
- what insights may eventually be available
- which analysis-plan steps are related

## Human Mode Integration

The task detail panel now shows:

- workflow summary
- business meaning
- expected outputs
- potential future insights

These explanations are template-based and metadata-only.

## Guardrails

F-73 does not:

- inspect real dataset rows
- generate live insights
- execute analysis
- generate SQL, Python, or R
- call `executeWorkspaceQuery`
- mutate Query Builder state
- mutate active results
- add AI orchestration
- modify workbook state

## Future Direction

Future phases may connect explanations to:

- validated analysis plans
- deterministic result summaries
- active result model read-only metadata
- analyst-visible generated logic
- AI-assisted explanation drafting after validation
