# Phase F-76 Relationship-Aware Task Planning

## What Was Added

Phase F-76 adds a metadata-only relationship-aware planning feature area:

```text
frontend/src/features/relationshipAwarePlanning/
```

It defines:

- `RelationshipAwareTaskPlan`
- relationship join requirement status metadata
- task planning helpers
- planning selectors
- a lightweight planning hook

## Relationship-Aware Task Planning

Relationship-aware task planning connects selected Human Mode tasks to existing
workbook relationship previews. It answers questions such as:

- Could this task benefit from multiple worksheets later?
- Which worksheets may be involved?
- Which relationship paths look relevant?
- Is a future join optional, helpful, or not supported yet?

This layer reads workbook metadata and join-plan preview metadata only.

## No Join Execution

This phase does not:

- execute joins
- generate SQL
- generate Python or R
- inspect full dataset rows
- mutate workbook metadata
- mutate active results
- mutate Query Builder state
- call `executeWorkspaceQuery`

Relationship-aware planning is advisory metadata.

## Dynamic Explanation Direction

F-76 extends explanation contracts so explanations can evolve beyond static
templates. Explanations now carry readiness metadata for:

1. static template explanation
2. metadata-aware explanation
3. result-aware deterministic explanation
4. AI-assisted explanation after validation

The current implementation supports static and metadata-aware explanation
readiness only.

## Future Explanation Levels

### 1. Static Template Explanation

Explains what a task generally means without dataset context.

### 2. Metadata-Aware Explanation

Explains how workbook structure, worksheet relationships, configured inputs, or
engine compatibility may affect a future workflow.

### 3. Result-Aware Deterministic Explanation

Future deterministic explanations may summarize actual active-result metadata,
such as row counts, ranked outputs, distributions, or validation summaries.

### 4. AI-Assisted Explanation After Validation

Future AI explanations should be grounded in validated plans, deterministic
result summaries, safety labels, and analyst-visible explanation sources.

## Human Mode Integration

Task details now show:

- relationship-aware planning status
- related worksheets
- future relationship paths
- confidence metadata
- readiness notes
- metadata-aware explanation text when workbook relationships match the task

This remains informational only.

## Why This Matters

FiltraQueri is moving toward flexible business interpretation. Static templates
are useful foundations, but future analytics workflows need explanations that
adapt to task choice, workbook structure, analysis plans, engine compatibility,
and eventually validated result summaries.
