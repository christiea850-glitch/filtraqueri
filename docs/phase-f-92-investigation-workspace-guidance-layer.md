# Phase F-92: Investigation Workspace Guidance Layer

## Purpose

Phase F-92 adds metadata-only investigation guidance to the runtime shell. The guidance helps users understand logical next analytical steps while preserving all execution boundaries.

## Contracts

The runtime layer now includes:

- `InvestigationGuidanceItem`
- `GuidanceCategory`
- `GuidanceReason`
- `GuidanceContinuationLink`

Guidance items are advisory, read-only, and connected only to existing continuation/navigation wrappers.

## Derivation Sources

Guidance is derived from existing runtime metadata:

- dataset presence
- Query Builder snapshot shape
- active result row metadata
- workbook worksheet and relationship counts
- selected Human Mode intent label
- SQL draft metadata
- current Human or Analyst mode

No result rows, backend request payloads, SQL execution state, or generated artifacts are persisted or created.

## UX Surface

The right runtime panel now includes a progressive “Suggested next step” section when guidance is available. Items explain why a next step may be useful and navigate through existing continuation links only.

Human Mode guidance remains business-oriented, such as reviewing results, continuing query refinement, or inspecting workbook relationships.

Analyst Mode guidance remains technical-oriented, such as checking relationship metadata, revisiting result context, or reviewing builder context.

## Boundary Guarantees

F-92 does not:

- change `executeWorkspaceQuery`
- change backend APIs
- change Query Builder request shapes
- mutate `ActiveResultModel`
- execute SQL from Monaco
- alter routing, back behavior, upload/session restore, workbook switching, pagination, exports, or SQL draft restore
- add AI execution, SQL generation, optimization, replay, governance, ledger, or MIR systems

## Regression Notes

Protected flows to verify manually:

- continuation navigation
- runtime persistence
- upload/session restore
- workbook switching
- pagination
- export
- SQL draft restore
- Human/Analyst switching
