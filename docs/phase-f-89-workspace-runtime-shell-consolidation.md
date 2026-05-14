# Phase F-89: Workspace Runtime Shell Consolidation

## Purpose

Phase F-89 adds a metadata-only runtime shell foundation for investigation-first workspace behavior. It consolidates derived context, continuation metadata, trail metadata, and read-only panel slots without changing execution behavior.

The feature lives in `frontend/src/features/workspaceRuntime/`.

## Runtime Contracts

The layer introduces:

- `WorkspaceRuntimeContext`
- `RuntimeContextSnapshot`
- `InvestigationContinuation`
- `WorkspaceTrailItem`
- `RuntimePanelSlot`

## Derived Sources Only

Runtime context derives only from existing frontend state:

- active dataset and workbook metadata
- active worksheet metadata
- workspace mode and active view
- active result model
- selected Human Mode intent label
- Query Builder snapshot
- SQL workspace metadata
- execution registry metadata
- safe selected task id metadata

## UI Integration

Phase F-89 adds:

- a read-only shell-level runtime context panel
- continuation buttons that call existing navigation callbacks
- workspace trail objects that wrap existing routes
- collapsible progressive-disclosure wrappers for Dataset Hub intelligence summaries
- local persistence for selected trail id, panel collapse state, and selected task id

## Metadata-Only Guarantees

Phase F-89 does not:

- call `executeWorkspaceQuery`
- add execution drivers
- execute SQL from Monaco
- execute joins
- generate SQL, Python, R, or optimization plans
- mutate active results
- alter Query Builder request shapes
- alter export mappings
- add governance, replay, MIR, ledger, or optimization systems

Protected systems remain untouched, including routing, back behavior, Human/Analyst switching, upload/session restore, SQL workspace isolation, Monaco, Query Builder execution, Results pagination, export behavior, workbook switching, active result integrity, and F-68 through F-88 metadata-only layers.
