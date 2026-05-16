# S3-B1 Runtime Graph Adapter Foundation

## Purpose

S3-B1 adds metadata-only runtime graph adapter foundations for translating runtime intelligence metadata into runtime bridge references.

The adapters do not execute or orchestrate anything. They only reshape existing runtime metadata into `RuntimeBridgeSnapshot`-compatible references.

## Created

- `frontend/src/features/runtimeBridge/runtimeGraphAdapters.ts`

## Exported Adapter Helpers

- `adaptRuntimeNodeToBridgeNode`
- `adaptRuntimeEdgeToBridgeEdge`
- `adaptRuntimeContinuationToBridgeContinuation`
- `adaptRuntimeEventToBridgeEvent`
- `adaptRuntimeConfidenceToBridgeConfidence`
- `runtimeGraphAdapterGovernance`
- `runtimeGraphAdapterSourceModule`

## Metadata-Only Boundary

The runtime graph adapters:

- accept plain metadata values
- use deterministic bridge ID helpers
- return serializable bridge references
- use type-only imports for runtime intelligence contracts
- do not import runtime persistence
- do not import execution owners
- do not call backend APIs
- do not use React hooks
- do not create callbacks
- do not create executable payloads

## Runtime Graph Is Not An Execution Graph

Runtime graph metadata can describe lineage, continuations, confidence, artifacts, and events. It must not become a workflow engine.

The adapter layer does not:

- replay work
- schedule work
- dispatch actions
- run queries
- export files
- execute SQL
- mutate workspace state
- persist graph state
- monitor datasets

The bridge graph is an evidence/reference graph only.

## Safe Adapter Boundaries

Safe inputs:

- `RuntimeNode`
- `RuntimeEdge`
- `RuntimeContinuationReference`
- `RuntimeEvent`
- `RuntimeEventReference`
- `RuntimeConfidenceSummary`

Safe outputs:

- `RuntimeBridgeNode`
- `RuntimeBridgeEdge`
- `RuntimeBridgeContinuationReference`
- `RuntimeBridgeEvent`
- `RuntimeBridgeConfidence`

## Forbidden Imports

Runtime graph adapters must not import:

- `executeWorkspaceQuery`
- `useResultExecutionCoordinator`
- `useExportController`
- `useWorkspaceDatasetController`
- `useDatasetSessions`
- `useWorkspaceRuntimeCoordinator`
- `runtimePersistence`
- `workspacePersistence`
- `sqlWorkspacePersistence`
- `services/api`
- SQL workspace hooks
- React hooks
- `App.tsx`

## Future S3-B Expansion Path

Recommended next steps:

1. Add type-only adapters for `AnalysisPackagePlan`.
2. Add type-only adapters for `InvestigationWorkspacePlan`.
3. Add composition helpers that merge runtime graph adapter output into bridge snapshots.
4. Keep all adapters metadata-only until a separate integration audit approves wiring.

Do not add UI rendering, persistence, replay, orchestration, or execution behavior during S3-B.

## Protected Surfaces

S3-B1 does not modify:

- `App.tsx`
- `executeWorkspaceQuery`
- `ResultsGrid`
- `ActiveResultModel`
- `useResultExecutionCoordinator`
- exports
- SQL/Monaco
- runtime persistence
- workbook/session restore
- backend APIs

