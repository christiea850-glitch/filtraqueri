# S3-B3 Investigation Workspace Adapter Foundation

## Purpose

S3-B3 adds metadata-only adapter foundations for translating investigation workspace metadata into RuntimeBridge-compatible references.

The adapters preserve investigation evidence, session context, timeline references, advisory checkpoints, continuations, and readiness confidence as bridge metadata. They do not execute, replay, persist, route, render, export, or orchestrate anything.

## Created

- `frontend/src/features/runtimeBridge/runtimeInvestigationWorkspaceAdapters.ts`

## Exported Adapter Helpers

- `adaptInvestigationWorkspaceToBridgeInvestigation`
- `adaptInvestigationTimelineToBridgeEvents`
- `adaptInvestigationCheckpointToBridgeAdvisory`
- `adaptInvestigationSessionToBridgeArtifacts`
- `adaptInvestigationContinuationToBridgeContinuation`
- `adaptInvestigationConfidenceToBridgeConfidence`
- `runtimeInvestigationWorkspaceAdapterGovernance`
- `runtimeInvestigationWorkspaceAdapterSourceModule`

## Metadata-Only Boundary

The investigation workspace adapters:

- accept plain investigation workspace metadata
- use deterministic bridge ID helpers
- return serializable RuntimeBridge references
- use type-only imports for investigation workspace and continuation contracts
- avoid callbacks, handlers, and executable payloads
- avoid React hooks
- avoid persistence and localStorage
- avoid backend API imports
- avoid App.tsx wiring
- avoid routing, replay, orchestration, SQL execution, query execution, and export execution

## Investigation Metadata Is Evidence Metadata

Investigation workspace metadata describes what happened in the investigation context:

- session identity and readiness
- timeline checkpoints
- narrative references
- advisory runtime checkpoints
- deliverable hub references
- audit metadata
- continuation references

This data is evidence/reference metadata only. It must not become an execution plan, workflow dispatcher, replay engine, or automated investigation runner.

## Timelines Are Not Replay Engines

Investigation timelines can be adapted into bridge events so future systems can understand sequence and context. A timeline event does not imply that FiltraQueri should replay the action.

The adapter layer does not:

- replay timeline steps
- rerun queries
- reapply filters
- switch workbooks
- change routes
- activate tabs
- dispatch actions
- restore sessions
- call backend APIs

## Advisory Checkpoints Are Not Dispatchers

Advisory checkpoints are converted into advisory references only. They may describe a recommendation, narrative signal, or runtime checkpoint, but they do not trigger workflow execution.

Continuation references remain metadata-only. They describe possible future directions without callbacks, handlers, request payloads, dispatch functions, or executable actions.

## Safe Adapter Boundaries

Safe inputs:

- `InvestigationWorkspacePlan`
- `InvestigationWorkspaceSession`
- `InvestigationTimelineEvent`
- `InvestigationWorkspaceRecommendation`
- investigation narrative references
- advisory runtime checkpoint references
- `RuntimeContinuationReference`

Safe outputs:

- `RuntimeBridgeInvestigationReference`
- `RuntimeBridgeEvent`
- `RuntimeBridgeAdvisoryReference`
- `RuntimeBridgeArtifactReference`
- `RuntimeBridgeContinuationReference`
- `RuntimeBridgeConfidence`

## Timestamp Ownership

Investigation timeline events, session metadata, and audit entries already include timestamps. Adapters use those source timestamps directly.

Future adapters must require caller-supplied timestamps when source metadata lacks a timestamp. They must not use `Date.now`, random values, UUID generators, hidden counters, or local storage.

## Forbidden Imports

Investigation workspace adapters must not import:

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

## Future Expansion Rules

Future S3-B investigation adapter work should remain metadata-only until a separate integration audit approves wiring.

Safe future additions:

1. Add type-only helpers that compose investigation workspace references into bridge snapshot inputs.
2. Add documentation examples for investigation lineage.
3. Add normalization and integrity usage examples for investigation workspace references.

Forbidden future additions in this layer:

- UI rendering
- persistence
- localStorage
- backend APIs
- export execution
- SQL execution
- query execution
- route changes
- orchestration or replay
- React hooks
- executable callbacks

## Protected Surfaces

S3-B3 does not modify:

- `App.tsx`
- `executeWorkspaceQuery`
- `ResultsGrid`
- `ActiveResultModel`
- `useResultExecutionCoordinator`
- exports
- SQL/Monaco
- runtime persistence
- dataset/session/workbook restore
- backend APIs
