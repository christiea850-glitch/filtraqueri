# Governance Feature Foundation

This folder contains FiltraQueri's lightweight advisory vs executable governance taxonomy.

S2-A is intentionally additive and type-level. It does not change runtime behavior, routing, persistence, query execution, exports, SQL/Monaco behavior, workbook/session restore, narrative scanning, or runtime graph metadata behavior.

## Boundary Modes

- `advisory`: deterministic recommendations, summaries, diagnostics, readiness, lineage references, and continuation suggestions. Advisory code cannot execute, mutate results, call the backend, export data, or persist runtime state.
- `executable`: user-driven behavior that can call the backend, mutate results, activate result tabs, export data, or record executable history.
- `metadata_only`: serializable lineage, confidence, artifact, continuation, and event contracts. Metadata-only code cannot schedule, replay, or execute work.
- `presentational`: UI surfaces that render state and call callbacks supplied by owners.
- `composition`: code that assembles hooks, components, and callbacks without directly owning execution.
- `persistence`: code that saves and restores owned state.
- `hybrid`: unavoidable cross-boundary code that must document advisory and executable responsibilities separately.

## Side-Effect Ownership

Each side effect should have one owner:

- backend query execution: `executeWorkspaceQuery`
- result mutation and activation: `useResultExecutionCoordinator`
- export execution: `useExportController`
- upload/session/workbook restore: `useWorkspaceDatasetController`
- SQL workspace execution: SQL workspace owner
- runtime UI persistence: `useWorkspaceRuntimeCoordinator` and `runtimePersistence`
- deterministic narrative generation: `narrativeIntelligence`, advisory only
- runtime graph lineage contracts: `runtimeIntelligence`, metadata-only

## S2-A Preservation Rules

S2-A must not modify:

- `executeWorkspaceQuery`
- `ResultsGrid`
- `ActiveResultModel`
- query execution
- filtering, pagination, or sorting
- exports
- SQL/Monaco behavior
- workbook/session restore
- runtime persistence
- Human/Analyst switching
- runtime graph metadata-only behavior
- deterministic narrative behavior

## Future Use

Future phases may import these types to annotate advisory, executable, metadata-only, presentational, persistence, composition, or hybrid contracts. S2-A does not enforce those rules yet. Linting, runtime assertions, and protected import checks belong to later S2 phases.

## S6 Consolidated Read Surface

S6-X adds `s6GovernanceReadSurface` as a composition over the existing route and workspace governance snapshots. It does not create a new registry, posture report, readiness registry, route controller, workspace controller, persistence engine, or orchestration layer.

The read surface exists so the next Investigation workspace planning phase can inspect route and workspace governance together without expanding governance sprawl.

## Warning-Only Audit

S2-C adds a warning-only governance audit command:

```sh
npm run governance:audit
```

This command reports advisory/executable boundary warnings without failing builds or changing runtime behavior. Review guidance lives in `docs/governance-review-checklist.md`.
