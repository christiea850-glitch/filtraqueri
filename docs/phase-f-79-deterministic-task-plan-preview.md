# Phase F-79 Deterministic Task Plan Preview

## What Was Added

Phase F-79 adds a metadata-only task plan preview feature area:

```text
frontend/src/features/taskPlanPreview/
```

It defines:

- deterministic task plan preview contracts
- workflow confidence metadata
- preview section builders
- preview safety-note helpers
- selectors and a lightweight hook

## What The Preview Explains

The preview answers:

```text
What does FiltraQueri plan to do later?
```

It combines:

- selected guided inputs
- analysis-plan metadata
- workbook relationship-aware planning
- engine compatibility
- planning readiness
- explanation readiness

## Example Deterministic Preview

```text
FiltraQueri may group revenue by product.
```

Other possible deterministic summaries:

- Workbook relationships may help compare sales across regions.
- This workflow may use Sales and Products worksheets together.
- Python analysis may support forecasting later.
- A time-based comparison may require a date field.

## Workflow Confidence

The preview reports:

- low
- moderate
- high

Confidence is derived from planning-readiness metadata only.

## Example Safety Note

```text
Workbook relationships still need confirmation.
```

## Guardrails

This phase does not:

- execute SQL
- execute joins
- generate SQL, Python, or R
- call `executeWorkspaceQuery`
- mutate Query Builder state
- mutate active results
- add AI orchestration
- expose SQL syntax
- expose join syntax

## Future Extension Points

Future phases can add:

- result-aware summaries
- analyst-visible execution previews
- deterministic result explanations
- AI-assisted narrative explanations after validation
