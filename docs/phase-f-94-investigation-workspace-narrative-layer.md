# Phase F-94: Investigation Workspace Narrative Layer

## Purpose

Phase F-94 adds a deterministic, metadata-only narrative layer to the runtime shell. It explains where the user is in the investigation, what has happened so far, and what analytical journey is forming.

## Contracts

The runtime layer now includes:

- `InvestigationNarrative`
- `NarrativeStage`
- `NarrativeEvent`
- `NarrativeSummary`
- `NarrativeConfidence`

## Derivation

Narrative is derived only from existing runtime metadata:

- dataset loaded state
- active worksheet metadata
- selected trail metadata
- guidance and recommendation groups
- active result metadata
- Human/Analyst mode
- SQL draft metadata

No backend call, LLM call, SQL generation, or autonomous planner is involved.

## UX Surface

The right runtime panel includes a read-only “Investigation story” disclosure. The collapsed summary shows the current narrative headline and confidence. Expanding it reveals:

- short plain-English summary
- safe next-step explanation
- compact event list

Human Mode narrative stays business-friendly. Analyst Mode narrative stays technical and context-oriented.

## Boundary Guarantees

F-94 does not:

- change `executeWorkspaceQuery`
- change backend APIs
- change Query Builder request shapes
- mutate `ActiveResultModel`
- execute SQL from Monaco
- alter routing, back behavior, upload/session restore, workbook switching, pagination, exports, or SQL draft restore
- add AI execution, generated SQL, optimization, replay, governance, ledger, or MIR systems

## Regression Notes

Protected flows to verify:

- upload/session restore
- workbook switching
- Human/Analyst switching
- continuation navigation
- pagination
- export
- SQL draft restore
- Query Builder behavior
