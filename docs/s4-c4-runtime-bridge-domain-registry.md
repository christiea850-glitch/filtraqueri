# S4-C4 Runtime Bridge Domain Registry

## Purpose

S4-C4 adds deterministic Runtime Bridge registry metadata so the architecture becomes more self-describing, auditable, discoverable, and future-runtime-ready.

This is architecture-governance infrastructure only. It does not add metadata layers, redesign folders, merge Runtime Bridge modules, change runtime behavior, change UI, change backend behavior, or modify protected surfaces.

## Created

S4-C4 adds:

- `frontend/src/features/runtimeBridge/_registry/runtimeBridgeDomainRegistry.ts`
- `frontend/src/features/runtimeBridge/_registry/runtimeBridgeModuleManifest.ts`
- `frontend/src/features/runtimeBridge/_registry/runtimeBridgeLayerRegistry.ts`
- `frontend/src/features/runtimeBridge/_registry/runtimeBridgeGovernanceRegistry.ts`
- `frontend/src/features/runtimeBridge/_registry/index.ts`

## Registry Scope

The registry is intentionally a representative subset, not a complete Runtime Bridge ecosystem catalog.

Registered subset:

- kernel types
- kernel utilities
- kernel governance descriptors
- enterprise lifecycle continuity
- enterprise resilience governance
- enterprise observability traceability
- intelligence review governance
- visualization planning

This proves the registry pattern before scaling it across the full Runtime Bridge architecture.

## Manifest Metadata

Runtime Bridge module manifests support deterministic metadata such as:

- `moduleId`
- `moduleName`
- `layer`
- `governanceClassification`
- `deterministicCapabilities`
- `metadataOnly`
- `allowedDependencyLayers`
- `prohibitedCapabilities`
- `sourceFile`
- `stabilityLevel`
- `architecturalRole`
- `futureRuntimeEligibility`
- `reviewStatus`

The manifests are static TypeScript metadata. They do not scan the filesystem, call backend APIs, persist data, render UI, run timers, generate random IDs, or execute workflows.

## Layer Registry

The layer registry declares the approved Runtime Bridge layers:

- `kernel`
- `foundation`
- `intelligence`
- `visualization`
- `orchestration`
- `governance`
- `federation`
- `lifecycle`
- `resilience`
- `observability`

Each layer entry includes deterministic metadata for rank, label, description, allowed dependency layers, and `metadataOnly: true`.

## Governance Registry Helpers

S4-C4 adds deterministic helpers to:

- collect registered module manifests
- validate layer registrations
- summarize governance registry posture
- summarize runtime eligibility posture
- summarize metadata-only compliance posture

These helpers operate only on static in-memory metadata arrays. They do not perform dynamic scanning, filesystem access, backend calls, storage writes, rendering, timers, random ID generation, or runtime execution.

## Governance Audit Integration

The governance audit now checks registry source files for:

- deterministic manifest IDs
- approved layer names
- approved dependency layer names
- metadata-only governance classification
- `metadataOnly` compliance
- forbidden capabilities declared as deterministic capabilities

The registry remains under the Runtime Bridge metadata-only audit coverage added in S4-C1 and the dependency-direction audit coverage added in S4-C3.

## Why This Is Not Feature Expansion

S4-C4 adds no new Runtime Bridge intelligence layer and does not wire metadata into app behavior. It only describes selected existing modules and layers in a deterministic registry.

The registry is a governance surface for future review, discoverability, and audit tooling. It is not a runtime dispatcher, dependency loader, plugin system, persistence system, route registry, UI registry, or execution engine.

## Protected Surfaces

S4-C4 does not modify:

- `App.tsx`
- `executeWorkspaceQuery`
- `ResultsGrid`
- `ActiveResultModel`
- `useResultExecutionCoordinator`
- export/download behavior
- SQL/Monaco
- runtime persistence
- dataset/session/workbook restore
- backend APIs

## Validation

Expected validation result:

- `npm.cmd run governance:audit` passes with 0 errors.
- The existing `WorkbookContextPanel.tsx` warning may still appear.
- `npm.cmd run build` passes.
