# Phase F-90: Investigation Continuation and Runtime Trail Stabilization

## Purpose

Phase F-90 strengthens the metadata-only runtime shell added in F-89. It stabilizes investigation trail identity, continuation metadata, safe runtime persistence, and contextual return behavior without changing routing or execution.

## Additions

The runtime layer now includes:

- stable trail ids derived from mode plus semantic trail identity
- continuation origin metadata
- related runtime context references
- originating dataset, worksheet, result-tab, mode, view, and execution references
- selected contextual investigation object metadata
- read-only return-to-investigation behavior through existing navigation callbacks
- Human/Analyst runtime context normalization
- persisted disclosure ergonomics for runtime summary slots

## Extension Points

The phase stays adapter-first:

- `runtimeContext.ts` derives trail, continuation, contextual object, and panel metadata from existing frontend state.
- `runtimeNavigationAdapter.ts` converts trail and continuation selections into safe persistence updates plus existing navigation targets.
- `runtimePersistence.ts` normalizes stored shell state and rejects unsafe or malformed continuation metadata.
- `runtimeAdapters.ts` keeps Human and Analyst runtime context surfaces separated without collapsing the modes.

## Safe Persistence

F-90 persists only:

- selected trail item id
- runtime panel collapse state
- selected contextual investigation object id
- selected task id
- return continuation id
- safe continuation origin/reference metadata
- disclosure open/closed state

It does not persist result rows, execution outputs, backend request payloads, generated SQL, query execution state, or workbook mutation state.

## Boundary Guarantees

Phase F-90 does not:

- change `executeWorkspaceQuery`
- change backend API routes
- change Query Builder request shapes
- execute SQL from Monaco
- mutate `ActiveResultModel`
- add AI execution, optimization, replay, governance, ledger, or MIR systems

Continuations and return actions call existing navigation callbacks only.

## Regression Notes

Protected flows were intentionally left untouched:

- upload/session restore stays in `useWorkspaceDatasetController`
- workbook switching stays in the workbook controller path
- pagination still calls the existing preview/query page loaders
- export still uses `useExportController` and `ActiveResultModel`
- Human/Analyst switching still uses the existing mode and view callbacks
- SQL draft restore stays inside SQL workspace metadata persistence
- Query Builder request construction is unchanged
