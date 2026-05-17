# S4-C2 Runtime Bridge Kernel Extraction

## Purpose

S4-C2 extracts a small Runtime Bridge metadata kernel to reduce duplicate helper code without adding new metadata layers, changing runtime behavior, changing UI, changing backend behavior, or modifying protected surfaces.

This is consolidation only. It does not merge H/G modules, change exported public helper names, change output shapes, introduce rendering, introduce persistence, or wire metadata into runtime behavior.

## Created Kernel Files

S4-C2 adds:

- `frontend/src/features/runtimeBridge/_kernel/runtimeBridgeKernelTypes.ts`
- `frontend/src/features/runtimeBridge/_kernel/runtimeBridgeKernelUtils.ts`
- `frontend/src/features/runtimeBridge/_kernel/runtimeBridgeKernelGovernance.ts`
- `frontend/src/features/runtimeBridge/_kernel/index.ts`

## Duplication Centralized

The kernel centralizes repeated metadata-only patterns that appeared across late Runtime Bridge enterprise layers:

- stable string de-duplication through `uniqueStable`
- deterministic priority scoring
- deterministic priority sorting
- strongest priority selection with an explicit fallback
- deterministic bundle sorting by priority and stable bundle ID
- metadata-only capability flags
- source module descriptor construction
- metadata-only governance descriptor construction
- a base bundle descriptor type for future consolidation

These utilities are deterministic and serializable. They do not call runtime APIs, backend services, storage APIs, timers, random ID APIs, React, hooks, chart libraries, or rendering APIs.

## Lightly Refactored Modules

S4-C2 lightly refactors three obvious candidates:

- `frontend/src/features/runtimeBridge/runtimeBridgeEnterpriseLifecycleContinuity.ts`
- `frontend/src/features/runtimeBridge/runtimeBridgeEnterpriseResilienceGovernance.ts`
- `frontend/src/features/runtimeBridge/runtimeBridgeEnterpriseObservabilityTraceability.ts`

The refactor replaces local duplicate helper blocks and descriptor boilerplate with kernel utilities. Public exported type names, helper names, governance constant names, source module constant names, object shapes, summaries, deterministic IDs, and deterministic ordering behavior are intentionally preserved.

## Intentionally Not Refactored Yet

S4-C2 intentionally does not refactor:

- older Runtime Bridge core modules
- snapshot builders
- adapters
- composition, lineage, governance, explainability, or narrative intelligence modules
- executive recommendation or decision-support modules
- G-series governance/planning modules
- H-series visualization, dashboard, presentation, delivery ecosystem, or federation modules outside the three selected enterprise continuity files
- TypeScript barrel structure outside the new `_kernel/index.ts`

This keeps the change small and reviewable. Broader folder organization or H/G module consolidation should wait for a later phase.

## Metadata-Only Boundary

The kernel remains metadata-only:

- no React
- no hooks
- no backend imports
- no persistence imports
- no storage APIs
- no network APIs
- no timers
- no random IDs
- no `Date.now`
- no chart/rendering imports
- no runtime execution

The S4-C1 hardened governance audit now scans Runtime Bridge modules, including the new `_kernel` folder, for these forbidden behaviors.

## Why This Is Not Feature Expansion

S4-C2 adds no new intelligence concepts and no new metadata layer. It extracts shared implementation mechanics that already existed in multiple modules. The selected modules still consume the same inputs and return the same metadata-only outputs.

The purpose is maintainability: future Runtime Bridge work can reuse a small, audited kernel instead of copying local helper blocks into every new metadata-only module.

## Protected Surfaces

S4-C2 does not modify:

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
