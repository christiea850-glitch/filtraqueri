# Phase F-75 Workbook Relationship-Aware Join Plan Preview

## What Was Added

Phase F-75 adds a metadata-only workbook relationship planning feature area:

```text
frontend/src/features/workbookRelationships/
```

It defines:

- `WorkbookRelationship`
- `WorkbookRelationshipType`
- `WorkbookRelationshipStatus`
- `WorkbookRelationshipConfidence`
- `WorkbookJoinPlanPreview`
- relationship registry helpers
- join-plan preview builders
- selectors and a lightweight hook

## Why This Layer Exists

Excel workbooks can contain multiple worksheets that behave like related
business tables. This layer prepares FiltraQueri to reason about those
relationships before any join engine exists.

```text
Workbook Metadata
-> Relationship Candidates
-> Relationship Registry
-> Join Plan Preview
-> Analysis Plan
-> Engine Compatibility
-> Future Execution
```

## Metadata Sources

The registry reads existing workbook metadata:

- profiled relationship candidates
- accepted relationship contracts
- worksheet names
- worksheet table mappings
- confidence and evidence summaries

It does not inspect row data, run joins, generate SQL, or mutate workbook state.

## Human Mode Visibility

Workbook context now includes read-only future join plan previews:

- related worksheets
- suggested relationship path
- expected future join behavior
- supported task categories
- safety notes

These previews are informational only.

## Guardrails

This phase does not:

- execute joins
- generate SQL
- generate Python or R
- call `executeWorkspaceQuery`
- mutate Query Builder state
- mutate active results
- mutate workbook metadata
- add AI orchestration
- change routing, mode switching, export, pagination, or worksheet switching

## Future Connections

Future phases can safely add:

- join plan validation
- relationship-aware task planning
- workbook join execution guards
- Query Builder multi-table planning
- AI-assisted relationship explanations after deterministic contracts exist
