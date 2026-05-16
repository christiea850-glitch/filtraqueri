# S3 Runtime Bridge Schema Foundation

## Purpose

S3-A1 introduces metadata-only runtime bridge schema contracts for connecting runtime lineage, advisory intelligence, investigations, explanations, continuations, artifacts, confidence, events, and active result references.

The bridge does not execute work. It describes how future systems may reference evidence and lineage safely.

## Feature Area

Created:

- `frontend/src/features/runtimeBridge/runtimeBridgeTypes.ts`
- `frontend/src/features/runtimeBridge/runtimeBridgeGovernance.ts`
- `frontend/src/features/runtimeBridge/index.ts`

## Metadata-Only Restrictions

Runtime bridge schemas must not include:

- React hooks
- backend calls
- localStorage or persistence writes
- route changes
- execution callbacks
- dispatch functions
- executable query payloads
- replay behavior
- orchestration behavior
- autonomous monitoring behavior

Continuation references are intentionally metadata-only. They may describe category, label, reason, target references, and evidence references. They must not carry callbacks, handlers, executable payloads, backend request payloads, or dispatch functions.

## Relationship To Governance

`runtimeBridgeGovernance` classifies the feature as `metadata_only`.

This aligns with S2 governance rules:

- advisory systems can produce references, not actions
- runtime graph systems remain metadata-only
- continuations remain descriptive and callback-free
- executable owners remain separate
- protected surfaces remain untouched

The bridge is designed to pass `npm run governance:audit` without requiring runtime allowlists.

## Schema Overview

Core contracts:

- `RuntimeBridgeNode`
- `RuntimeBridgeEdge`
- `RuntimeBridgeArtifactReference`
- `RuntimeBridgeContinuationReference`
- `RuntimeBridgeAdvisoryReference`
- `RuntimeBridgeInvestigationReference`
- `RuntimeBridgeExplanationReference`
- `RuntimeBridgeResultReference`
- `RuntimeBridgeConfidence`
- `RuntimeBridgeEvent`

Supporting contracts:

- `RuntimeBridgeSourceModuleReference`
- `RuntimeBridgeLineageReference`
- `RuntimeBridgeSnapshot`

These contracts support stable ids, timestamps, lineage references, advisory references, confidence references, source module references, related runtime node references, and metadata-only continuation references.

## Future S3 Roadmap

Recommended next phases:

1. Add deterministic bridge builders that accept existing metadata and produce `RuntimeBridgeSnapshot` values.
2. Add type-only adapters for narrative, investigation, runtime graph, and result references.
3. Add governance annotations for any bridge adapters.
4. Keep all bridge work metadata-only until a separate execution-boundary phase is approved.

## Intentionally Excluded

S3-A1 does not include:

- UI rendering
- `App.tsx` integration
- runtime persistence
- localStorage
- backend APIs
- query execution
- export execution
- SQL execution
- workbook/session restore changes
- replay
- orchestration
- optimization execution
- forecasting execution
- AI planning
- autonomous workflows

## Preservation Guarantees

S3-A1 does not modify:

- `executeWorkspaceQuery`
- `ResultsGrid`
- `ActiveResultModel`
- `useResultExecutionCoordinator`
- runtime persistence
- exports
- SQL/Monaco behavior
- dataset/session/workbook restore
- routing or mode switching
