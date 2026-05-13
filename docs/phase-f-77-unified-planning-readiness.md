# Phase F-77 Unified Planning Readiness

## What Was Added

Phase F-77 adds a metadata-only planning readiness feature area:

```text
frontend/src/features/planningReadiness/
```

It defines:

- `PlanningReadinessStatus`
- `PlanningReadinessReport`
- planning confidence metadata
- supported workflow scope metadata
- readiness validation helpers
- selectors and a lightweight hook

## Why Human Mode Needs Workflow Intelligence

Human Mode is moving toward guided business analytics. A user should not need
SQL, joins, Python, R, or formula knowledge to understand whether an analysis
workflow makes sense.

Unified planning readiness gives FiltraQueri a single advisory answer:

```text
Is this workflow structurally ready for future execution?
```

## Metadata Combined

The readiness report combines:

- task validation
- analysis-plan readiness
- engine compatibility
- workbook relationship-aware planning
- explanation readiness

This remains planning metadata only.

## Readiness Statuses

- `not_ready`: required guided inputs or plan metadata are missing
- `partially_ready`: workflow is understood but not fully prepared
- `relationship_dependent`: workbook relationships need review or stronger confidence
- `engine_limited`: future engine metadata is insufficient
- `ready_for_future_execution`: workflow structure is ready for future execution wiring
- `unsupported`: current metadata marks the workflow as invalid or unsupported

## Example Readiness Message

```text
FiltraQueri understands the workflow structure, but workbook relationships may
need confirmation before future execution.
```

## No Execution

This phase does not:

- execute SQL
- execute joins
- generate SQL, Python, or R
- call `executeWorkspaceQuery`
- mutate Query Builder state
- mutate active results
- mutate workbook metadata
- add AI orchestration

## Future Execution Preparation

The readiness report prepares later phases to route validated workflows through:

```text
Task Selection
-> Task Configuration
-> Analysis Plan
-> Planning Readiness
-> Engine Adapter
-> Future Execution Pipeline
-> Active Result Model
```

Future phases can add guided input collection, deterministic plan validation,
engine-specific adapters, and eventually AI-assisted planning after validation.
