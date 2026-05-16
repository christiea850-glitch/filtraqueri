# S3 Runtime Bridge Usage Examples

## Purpose

`RuntimeBridgeSnapshot` is a metadata-only structure for connecting runtime lineage, active result references, advisory intelligence, investigations, explanations, continuations, artifacts, confidence, and events.

It is a reference graph, not an execution graph.

The bridge helps future systems understand how evidence, findings, and investigation metadata relate to each other without running queries, changing UI state, writing persistence, replaying work, or dispatching actions.

## Simple Metadata-Only Build Example

```ts
import {
  buildRuntimeBridgeIntegrityReadySnapshot,
} from "../features/runtimeBridge";

const createdAt = "2026-05-16T22:00:00.000Z";

const { snapshot, integrityReport } = buildRuntimeBridgeIntegrityReadySnapshot({
  createdAt,
  activeResultModel,
  narrativeReport,
  investigationReport,
});
```

Important details:

- `createdAt` is supplied by the caller.
- The bridge builder does not call `Date.now`.
- The bridge builder does not call backend APIs.
- The bridge builder does not read localStorage.
- The bridge builder does not trigger execution, routing, or UI state.

## Deterministic IDs

Runtime bridge IDs are deterministic. They are derived from supplied values and normalized.

```ts
import {
  createRuntimeBridgeId,
  createBridgeNodeId,
  createBridgeEdgeId,
  createBridgeReferenceId,
} from "../features/runtimeBridge";

const bridgeId = createRuntimeBridgeId("runtime-bridge", "dataset-123", "preview");
const nodeId = createBridgeNodeId("result", "dataset-123:preview");
const edgeId = createBridgeEdgeId("supports", "narrative-1", "result-preview");
const referenceId = createBridgeReferenceId("narrative", "insight-1");
```

Rules:

- lowercase output
- trimmed parts
- unsafe characters replaced with `-`
- no `Math.random`
- no `Date.now`
- no UUIDs
- no hidden counters

## Result References

A result reference summarizes the active result metadata.

Example shape:

```ts
{
  resultReferenceId: "bridge-reference:result:dataset-123-preview",
  datasetId: "dataset-123",
  resultTab: "preview",
  sourceType: "preview",
  rowCount: 2500,
  columnCount: 12,
  activeResultModelId: "bridge-reference:active-result-model:dataset-123-preview",
  executionReferenceId: null,
  metadataOnly: true,
}
```

This is safe because it references existing metadata. It does not mutate `ActiveResultModel`, paginate, sort, filter, export, or run a query.

## Narrative References

Narrative reports become advisory references, explanation references, continuation references, and confidence references.

Example advisory reference:

```ts
{
  advisoryId: "bridge-reference:narrative:insight-1",
  advisoryType: "narrative",
  label: "Most transactions appear concentrated in one region.",
  sourceModule: {
    moduleId: "narrative-intelligence",
    modulePath: "frontend/src/features/narrativeIntelligence",
    capabilityMode: "advisory",
    label: "Narrative intelligence",
  },
  evidenceReferenceIds: ["bridge-reference:narrative-evidence:insight-1-region"],
  confidenceReferenceId: "bridge-reference:confidence:insight-1",
  metadataOnly: true,
}
```

Narrative references remain deterministic and advisory-only.

## Investigation References

Investigation reports become investigation references, advisory references, explanation references, continuations, and confidence metadata.

Example investigation reference:

```ts
{
  investigationId: "bridge-reference:investigation:review-operations",
  sessionId: null,
  label: "Review operational activity",
  stage: "review_result",
  timelineReferenceIds: [
    "bridge-reference:investigation-stage:review-operations-review-result"
  ],
  advisoryReferenceIds: [
    "bridge-reference:investigation-suggestion:suggestion-1"
  ],
  resultReferenceIds: [
    "bridge-reference:result:dataset-123-preview"
  ],
  metadataOnly: true,
}
```

This does not navigate the user, configure Query Builder, or run follow-up analysis.

## Artifact References

Artifacts describe metadata outputs such as result snapshots, narrative reports, investigation summaries, and bridge snapshots.

Example:

```ts
{
  artifactId: "bridge-reference:artifact:narrative-report-narrative-report-reference",
  artifactType: "narrative_report",
  category: "narrative_report",
  label: "Narrative report reference",
  createdAt: "2026-05-16T22:00:00.000Z",
  hash: null,
  summary: "Most transactions appear concentrated in one region.",
  relatedNodeIds: ["bridge-node:advisory:bridge-reference:narrative:insight-1"],
  metadataTags: [
    { key: "readiness", value: "executive_ready" }
  ],
  evidenceReferenceIds: ["bridge-reference:narrative:insight-1"],
  lineageReferenceIds: [
    "bridge-node:advisory:bridge-reference:narrative:insight-1",
    "bridge-reference:narrative:insight-1"
  ],
  metadataOnly: true,
}
```

Artifacts are references only. They do not create files, export CSV, write reports, or save snapshots.

## Event References

Events describe bridge metadata activity, not application events.

Example:

```ts
{
  eventId: "bridge-reference:event:bridge-created-2026-05-16t22-00-00-000z",
  eventType: "bridge_created",
  createdAt: "2026-05-16T22:00:00.000Z",
  sourceModule: {
    moduleId: "runtime-bridge",
    modulePath: "frontend/src/features/runtimeBridge",
    capabilityMode: "metadata_only",
    label: "Runtime bridge",
  },
  relatedNodeIds: ["bridge-node:result:bridge-reference:result:dataset-123-preview"],
  relatedReferenceIds: ["bridge-node:result:bridge-reference:result:dataset-123-preview"],
  confidenceReferenceIds: [],
  explanationReferenceIds: [],
  continuationReferenceIds: [],
  summary: "Runtime bridge snapshot metadata created.",
  metadataOnly: true,
}
```

These are metadata records. They do not dispatch browser events or trigger app behavior.

## Metadata-Only Continuations

Valid continuation metadata describes a possible next step.

```ts
{
  continuationId: "bridge-reference:continuation:next-step-1",
  category: "investigate",
  label: "Inspect regional concentration",
  reason: "One region accounts for most visible activity.",
  targetReferenceId: "bridge-reference:result:dataset-123-preview",
  evidenceReferenceIds: ["bridge-reference:narrative:insight-1"],
  metadataOnly: true,
}
```

This is safe because it has no executable function, callback, backend payload, route change, or hidden action.

Invalid continuation metadata:

```ts
{
  continuationId: "bad-continuation",
  label: "Run query",
  onExecute: () => runQuery(),
  payload: {
    endpoint: "/query",
    sql: "SELECT * FROM uploaded_dataset",
  },
}
```

Why invalid:

- `onExecute` is a callback.
- `payload` is an executable/backend request shape.
- it implies hidden execution.
- it violates metadata-only governance.

## Normalization Behavior

The snapshot builder normalizes bridge snapshots before returning them.

Normalization:

- deduplicates nodes by `bridgeNodeId`
- deduplicates edges by `bridgeEdgeId`
- deduplicates artifacts by `artifactId`
- deduplicates advisories by `advisoryId`
- deduplicates investigations by `investigationId`
- deduplicates explanations by `explanationId`
- deduplicates continuations by `continuationId`
- deduplicates confidence references by `confidenceId`
- deduplicates events by `eventId`

Normalization preserves first-seen input order. It does not sort randomly, mutate inputs, or generate new runtime state.

## Integrity Report Usage

Use integrity reports as metadata review signals.

```ts
const { snapshot, integrityReport } = buildRuntimeBridgeIntegrityReadySnapshot({
  createdAt,
  activeResultModel,
  narrativeReport,
  investigationReport,
});

if (integrityReport.errors.length > 0) {
  console.warn("Bridge metadata needs review", integrityReport.errors);
}
```

Do not use integrity reports as execution gates yet.

Integrity reports are useful for:

- orphan counts
- missing node references
- invalid advisory evidence references
- forbidden continuation field detection
- relationship tracing

They should not block queries, exports, routing, SQL execution, or workbook restore unless a future policy phase explicitly defines that behavior.

## What Counts As Metadata-Only

Metadata-only bridge code may:

- accept plain metadata inputs
- create stable ids
- create references
- create bridge nodes and edges
- create artifact references
- create event references
- create integrity reports
- normalize arrays
- validate relationships

Metadata-only bridge code must not:

- execute queries
- export files
- call backend APIs
- save to localStorage
- write session/workbook state
- use React hooks
- dispatch events
- change routes
- activate tabs
- mutate `ActiveResultModel`
- run replay/orchestration
- contain executable callbacks

## Why Callbacks And Execution Payloads Are Dangerous

Callbacks and executable payloads turn a metadata graph into an action graph.

That would blur important boundaries:

- advisory findings could start actions
- continuation suggestions could dispatch hidden work
- replay/orchestration could appear before governance is ready
- protected execution surfaces could be bypassed
- auditability would degrade

The bridge should describe relationships. It should not perform work.

## Future S3-B Adapter Safety Rules

S3-B adapters should follow these rules:

- use type-only imports where possible
- do not import persistence modules
- do not import React hooks
- do not import execution owners
- do not import backend services
- do not import `App.tsx`
- do not wire into UI
- do not use localStorage
- do not create callbacks
- do not create executable payloads
- do not trigger route changes
- do not mutate input objects

Good S3-B adapter inputs:

- `AnalysisPackagePlan`
- `InvestigationWorkspacePlan`
- runtime intelligence node and edge metadata
- runtime continuation metadata
- runtime event metadata

Bad S3-B adapter inputs:

- dataset/session restore controllers
- runtime persistence state writers
- export controllers
- SQL workspace execution hooks
- query execution functions
- UI callbacks

## Protected Surfaces

Runtime bridge work must preserve:

- `executeWorkspaceQuery`
- `ResultsGrid`
- `ActiveResultModel`
- `useResultExecutionCoordinator`
- exports
- SQL/Monaco behavior
- runtime persistence
- dataset/session/workbook restore
- `App.tsx`
- backend APIs

Bridge work may reference metadata from protected surfaces only through plain values supplied by callers. It must not modify or wrap those surfaces.
