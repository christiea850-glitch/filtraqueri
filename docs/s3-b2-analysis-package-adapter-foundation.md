# S3-B2 Analysis Package Adapter Foundation

## Purpose

S3-B2 adds metadata-only adapter foundations for translating analysis package and planning metadata into RuntimeBridge-compatible references.

The adapters support future bridge snapshots by reshaping planning evidence into artifacts, advisories, nodes, explanations, and confidence references. They do not execute analysis, create exports, call services, or wire anything into the UI.

## Created

- `frontend/src/features/runtimeBridge/runtimeAnalysisPackageAdapters.ts`

## Exported Adapter Helpers

- `adaptAnalysisPackageToBridgeArtifacts`
- `adaptWorkflowRecommendationToBridgeAdvisory`
- `adaptBusinessIntentToBridgeNode`
- `adaptEngineRecommendationToBridgeExplanation`
- `adaptReadinessToBridgeConfidence`
- `runtimeAnalysisPackageAdapterGovernance`
- `runtimeAnalysisPackageAdapterSourceModule`

## Metadata-Only Boundary

The analysis package adapters:

- accept plain metadata objects
- use deterministic bridge ID helpers
- return serializable RuntimeBridge references
- use type-only imports for planning and advisory contracts
- avoid callbacks, handlers, and executable payloads
- avoid React hooks
- avoid persistence and browser storage
- avoid backend API imports
- avoid routing, replay, orchestration, SQL execution, query execution, and export execution

## Planning Is Not Execution

Analysis package metadata can describe what should be included in a future package, what artifacts are recommended, what engines are compatible, and how ready a plan appears.

That planning metadata must not become executable behavior. These adapters only preserve evidence and references for future governance, review, and bridge expansion.

The adapter layer does not:

- generate files
- download exports
- run queries
- execute SQL
- invoke engines
- replay workflows
- dispatch actions
- mutate results
- persist package state
- route users between views

## Safe Adapter Boundaries

Safe inputs:

- `AnalysisPackagePlan`
- `WorkflowRecommendation`
- `BusinessQuestionInterpretation`
- `EngineCompatibilityResult`
- `EngineAdapter`
- `PlanningReadinessReport`
- `AnalysisPackagePlan["readinessSummary"]`

Safe outputs:

- `RuntimeBridgeArtifactReference`
- `RuntimeBridgeAdvisoryReference`
- `RuntimeBridgeNode`
- `RuntimeBridgeExplanationReference`
- `RuntimeBridgeConfidence`

## Forbidden Imports

Analysis package adapters must not import:

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

Future S3-B adapter work should remain metadata-only until a separate integration audit approves wiring.

Safe future additions:

1. Add type-only adapters for investigation workspace package metadata.
2. Add type-only adapters for runtime package timeline references.
3. Add bridge composition helpers that merge analysis package references into snapshots.
4. Add documentation examples for package lineage without introducing execution.

Forbidden future additions in this layer:

- UI rendering
- persistence
- localStorage
- backend APIs
- export execution
- SQL execution
- query execution
- orchestration or replay
- React hooks
- executable callbacks

## Protected Surfaces

S3-B2 does not modify:

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
