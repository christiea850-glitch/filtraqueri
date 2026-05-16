# S3-A2 Runtime Bridge Snapshot Builder Plan

## Purpose

This planning audit defines how to safely create deterministic runtime bridge snapshot builders that map existing metadata into the S3-A1 `RuntimeBridgeSnapshot` contracts.

This is audit-only documentation. No implementation changes are included.

## Current Foundation

S3-A1 created:

- `frontend/src/features/runtimeBridge/runtimeBridgeTypes.ts`
- `frontend/src/features/runtimeBridge/runtimeBridgeGovernance.ts`
- `frontend/src/features/runtimeBridge/index.ts`
- `docs/s3-runtime-bridge-schema-foundation.md`

The runtime bridge is classified as `metadata_only`. It has no hooks, persistence, backend calls, callbacks, replay, orchestration, or UI integration.

## Safe Metadata Sources

S3-A2 builders may consume already-materialized metadata objects passed in as plain inputs.

### Active Result References

Safe source:

- `ActiveResultModel | null`

Safe fields:

- `datasetId`
- `datasetName`
- `sourceType`
- `sourceTab`
- `totalCount`
- `columns.length`
- `grouping.columns`
- `filters.activeLabels`
- `sorting`
- `query.hasRun`

Use:

- build `RuntimeBridgeResultReference`
- build result bridge node
- build result artifact reference

Do not use:

- `useActiveResultModel`
- result setters
- hidden column setters
- pagination callbacks
- query execution callbacks

### Narrative Report References

Safe source:

- `NarrativeReport | null`

Safe fields:

- `reportId`
- `datasetId`
- `sourceResultId`
- `summary`
- `readiness`
- `insights`
- `visibleInsights`
- `timelineCheckpoints`
- `safetyNotes`

Use:

- build advisory references for insights
- build explanation references from report summary
- build continuation references from insight recommendations
- build bridge events for timeline checkpoints
- build confidence metadata from readiness/severity summaries

Do not use:

- narrative scanner execution inside the bridge builder
- generated prose beyond existing deterministic report text
- AI generation

### Investigation Report References

Safe source:

- `InvestigationReport | null`

Safe fields:

- `flow`
- `intents`
- `suggestions`
- `nextSteps`
- `humanSummary`
- confidence fields on intents and suggestions

Use:

- build investigation reference
- build advisory references for suggestions
- build explanation references from human summary
- build continuation references from next steps
- build confidence references

Do not use:

- query-builder callbacks
- view navigation callbacks
- Human Mode action handlers

### Analysis Package References

Safe source:

- `AnalysisPackagePlan | null`

Safe fields:

- `packageManifest.packageId`
- `packageManifest.title`
- `packageManifest.status`
- `packageManifest.generatedAt`
- `packageManifest.artifactManifest`
- `packageManifest.auditTrail`
- `recommendations`
- `readinessSummary`
- `humanSummary`

Use:

- build artifact references
- build advisory references for recommendations
- build bridge events for audit metadata
- build explanation reference from human summary

Do not use:

- export execution
- package generation engines as executable capabilities
- file creation

### Investigation Workspace References

Safe source:

- `InvestigationWorkspacePlan | null`

Safe fields:

- `session.sessionId`
- `session.sessionTitle`
- `session.timeline`
- `session.narrativeReferences`
- `session.runtimeNodeReferences`
- `session.runtimeContinuationReferences`
- `session.runtimeLineageReferences`
- `session.advisoryRuntimeCheckpoints`
- `session.analysisPackageReferences`
- `recommendations`
- `readinessSummary`
- `humanSummary`

Use:

- build investigation reference
- map runtime node references to related runtime node ids
- map runtime continuation references into bridge continuation references
- map advisory runtime checkpoints into bridge events

Do not use:

- investigation workspace storage utilities
- persistence writes
- session restore logic

### Runtime Intelligence References

Safe sources:

- `RuntimeNode[]`
- `RuntimeEdge[]`
- `RuntimeContinuationReference[]`
- `RuntimeLineageReference[]`
- `RuntimeEventReference[]`
- runtime confidence/artifact metadata if passed in as plain values

Use:

- build runtime bridge nodes and edges
- preserve metadata-only lineage
- bridge runtime graph references to advisory/result/investigation references

Do not use:

- runtime persistence
- workspace runtime coordinator
- runtime trail navigation
- replay/orchestration concepts

### Continuation References

Safe sources:

- `RuntimeContinuationReference[]`
- narrative recommendations
- investigation suggestions and next steps
- analysis package recommendations
- investigation workspace recommendations

Use:

- build `RuntimeBridgeContinuationReference`
- include category, label, reason, target reference, evidence ids

Strictly forbidden:

- callbacks
- handlers
- executable payloads
- backend request payloads
- dispatch functions
- route-change functions

### Confidence References

Safe sources:

- narrative severity/readiness
- investigation confidence and confidence score
- package readiness
- runtime confidence metadata if provided

Use:

- build `RuntimeBridgeConfidence`
- map available scores into `score`
- use `unknown` when no score exists
- include evidence references

Do not use confidence as:

- execution gate
- route gate
- export gate
- query gate

## Sources Not To Use Yet

S3-A2 builders must not import or consume:

- `executeWorkspaceQuery`
- `useResultExecutionCoordinator`
- `useExportController`
- `useWorkspaceDatasetController`
- `useDatasetSessions`
- `useWorkspaceRuntimeCoordinator`
- `runtimePersistence`
- `workspacePersistence`
- `sqlWorkspacePersistence`
- backend API services
- React hooks
- `App.tsx`
- SQL workspace hooks
- export payload builders if they imply execution ownership
- route or mode setters
- result setters
- workbook/session restore controllers

S3-A2 must not call builders that perform backend or persistence side effects.

## Safe Builder Boundary

Recommended feature files:

- `frontend/src/features/runtimeBridge/runtimeBridgeBuilderTypes.ts`
- `frontend/src/features/runtimeBridge/runtimeBridgeIds.ts`
- `frontend/src/features/runtimeBridge/runtimeBridgeSnapshotBuilder.ts`
- optional `frontend/src/features/runtimeBridge/runtimeBridgeAdapters.ts`

The builder should be a pure function:

```ts
export function buildRuntimeBridgeSnapshot(
  input: RuntimeBridgeSnapshotBuildInput,
): RuntimeBridgeSnapshot
```

It should:

- accept plain metadata inputs
- return a complete `RuntimeBridgeSnapshot`
- be deterministic for the same input
- use stable ids derived from source ids
- not read clocks internally unless `createdAt` is provided
- not read global state
- not import hooks
- not import persistence
- not call backend APIs

## Required Input Type

Recommended input:

```ts
export type RuntimeBridgeSnapshotBuildInput = {
  bridgeId?: string;
  createdAt: string;
  activeResultModel?: ActiveResultModel | null;
  narrativeReport?: NarrativeReport | null;
  investigationReport?: InvestigationReport | null;
  analysisPackagePlan?: AnalysisPackagePlan | null;
  investigationWorkspacePlan?: InvestigationWorkspacePlan | null;
  runtimeNodes?: ReadonlyArray<RuntimeNode>;
  runtimeEdges?: ReadonlyArray<RuntimeEdge>;
  runtimeContinuations?: ReadonlyArray<RuntimeContinuationReference>;
  runtimeLineageReferences?: ReadonlyArray<RuntimeLineageReference>;
  runtimeEventReferences?: ReadonlyArray<RuntimeEventReference>;
};
```

Notes:

- `createdAt` should be supplied by the caller to keep the builder deterministic.
- Runtime references should be optional and treated as metadata only.
- Inputs should be `ReadonlyArray` where possible.

## Required Output Type

Output:

```ts
RuntimeBridgeSnapshot
```

Output should include:

- bridge id
- source module reference
- nodes
- edges
- artifacts
- continuations
- advisories
- investigations
- explanations
- results
- confidence
- events
- `metadataOnly: true`

Empty arrays are valid when inputs are missing.

## Stable ID Strategy

Use deterministic ids based on source ids and categories.

Recommended helpers:

- `createRuntimeBridgeId(...parts: Array<string | number | null | undefined>): string`
- `createBridgeNodeId(kind, sourceId)`
- `createBridgeEdgeId(kind, fromId, toId)`
- `createBridgeReferenceId(kind, sourceId)`

Rules:

- lowercase ids
- trim whitespace
- replace unsafe characters with `-`
- never use `Math.random`
- never use `Date.now`
- do not depend on array order except for explicitly indexed repeated items
- use source ids when available
- fallback to stable labels only when source ids are unavailable

Examples:

- `bridge:dataset-123:result:preview`
- `bridge-node:advisory:narrative-report-123`
- `bridge-edge:supports:narrative-insight-1:result-preview`
- `bridge-continuation:investigation-next-step-2`

## Metadata-Only Restrictions

The builder must not:

- execute queries
- run exports
- call backend services
- save to localStorage
- save workspace/session metadata
- change routes
- change mode
- call React hooks
- mutate input objects
- add callbacks to continuations
- create executable payloads
- trigger replay or orchestration

The builder may:

- map metadata
- normalize labels
- create stable ids
- create lineage references
- create advisory references
- create bridge events
- create confidence summaries
- create empty arrays for missing inputs

## Governance Annotation Needs

S3-A2 should keep `runtimeBridgeGovernance` as `metadata_only`.

If builder files add governance constants, they should also be `metadata_only`.

The governance audit should continue to pass:

```sh
npm run governance:audit
```

Expected status after S3-A2:

- no hard-fail errors
- existing workbook presentational warning may remain

## S3-A2 Implementation Slices

### S3-A2.1: Builder Types And ID Helpers

Files to create/change:

- `runtimeBridgeBuilderTypes.ts`
- `runtimeBridgeIds.ts`
- update `index.ts`

Responsibilities:

- define build input type
- define source module constants
- define stable id helpers

Validation:

- `npm.cmd run governance:audit`
- `npm.cmd run build`

Risk: low.

### S3-A2.2: Result And Advisory Adapters

Files to create/change:

- `runtimeBridgeAdapters.ts`
- `runtimeBridgeSnapshotBuilder.ts`

Responsibilities:

- map `ActiveResultModel`
- map `NarrativeReport`
- map `InvestigationReport`
- map advisory confidence references

Validation:

- governance audit
- build
- protected diff check

Risk: low-medium because it imports advisory/result types. Use type-only imports.

### S3-A2.3: Package, Workspace, And Runtime Metadata Adapters

Files to create/change:

- extend adapters and snapshot builder

Responsibilities:

- map `AnalysisPackagePlan`
- map `InvestigationWorkspacePlan`
- map runtime nodes/edges/continuations/events
- connect bridge edges

Validation:

- governance audit
- build
- protected diff check

Risk: medium because investigation workspace includes persistence-adjacent types. Keep imports type-only and avoid storage utilities.

## First Implementation Recommendation

Implement S3-A2.1 first.

Start with:

- input/output builder types
- deterministic id helpers
- no mapping logic yet
- no imports from advisory modules except type-only if necessary
- no runtime wiring

This gives S3 a safe builder foundation before mapping larger advisory and investigation structures.

## Protected Surfaces

Do not modify:

- `App.tsx`
- `executeWorkspaceQuery`
- `ResultsGrid`
- `ActiveResultModel`
- `useResultExecutionCoordinator`
- exports
- SQL/Monaco
- dataset/session/workbook restore
- runtime persistence
- backend APIs

## Final Recommendation

Proceed with S3-A2 cautiously, beginning with type-only builder inputs and stable id helpers. Defer full metadata mapping until the pure builder boundary is established and governance audit remains clean.
