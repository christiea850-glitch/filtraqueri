# S4-C3 Runtime Bridge Dependency Governance

## Purpose

S4-C3 adds Runtime Bridge dependency-direction enforcement and architectural layer classification rules. This is governance architecture hardening only.

This phase does not add metadata layers, redesign folders, merge Runtime Bridge modules, change runtime behavior, change UI, change backend behavior, or modify protected surfaces.

## What S4-C3 Adds

The governance audit now classifies Runtime Bridge modules and validates local Runtime Bridge imports for:

- circular Runtime Bridge imports
- forbidden layer-direction imports
- kernel reverse dependencies
- cross-layer violations
- unclassified Runtime Bridge modules
- unclassified Runtime Bridge import targets

The audit emits deterministic hard-fail messages when a Runtime Bridge module violates these rules.

## Runtime Bridge Layer Classifications

S4-C3 defines these Runtime Bridge architecture layers:

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

Current classification intent:

- `kernel`: `_kernel` metadata-only helper modules.
- `foundation`: bridge schemas, IDs, adapters, snapshot building, normalization, integrity, composition, lineage, and the base bridge governance summary.
- `intelligence`: explainability, narrative intelligence, insight interpretation, recommendations, decision support, executive delivery intelligence, and strategic narrative packaging.
- `visualization`: visualization planning, dashboard narrative intelligence, executive visualization storytelling, and dashboard composition metadata.
- `orchestration`: planning-only orchestration and presentation sequencing descriptors.
- `governance`: G-series review and governance consolidation metadata.
- `federation`: delivery ecosystem and enterprise intelligence federation metadata.
- `lifecycle`: enterprise lifecycle continuity metadata.
- `resilience`: enterprise resilience governance metadata.
- `observability`: enterprise observability and traceability metadata.

## Dependency Direction Rules

Runtime Bridge dependencies must move downward through the architecture:

- `observability` may depend on `resilience`.
- `resilience` may depend on `lifecycle`.
- `lifecycle` may depend on `federation`.
- `federation` may depend on `orchestration` and lower layers.
- `governance` may depend on orchestration planning and lower layers.
- `orchestration` may depend on composition, storytelling, visualization, and lower layers.
- `visualization` may depend on intelligence and foundation layers.
- `intelligence` may depend on foundation layers.
- `foundation` may depend on foundation and kernel utilities.
- Enterprise modules may depend on the kernel.

The kernel has a special rule:

- `kernel` may depend only on `kernel` and `foundation` types.
- `kernel` must not import intelligence, governance, visualization, orchestration, federation, lifecycle, resilience, or observability modules.

## Forbidden Examples

The audit is designed to reject future drift such as:

- kernel importing enterprise modules
- lower layers importing higher orchestration layers
- visualization importing lifecycle continuity
- governance importing presentation orchestration
- circular imports between H-series modules
- circular imports between enterprise layers
- bidirectional dependency chains

## Audit Categories

S4-C3 adds hard-fail categories:

- `runtime-bridge-circular-import`
- `runtime-bridge-forbidden-layer-direction`
- `runtime-bridge-kernel-reverse-dependency`
- `runtime-bridge-cross-layer-violation`
- `runtime-bridge-unclassified-module`
- `runtime-bridge-unclassified-import-target`

These checks run alongside the S4-C1 metadata-only Runtime Bridge protections for execution imports, backend imports, persistence imports, React/hooks, rendering/chart APIs, storage APIs, network APIs, timer APIs, and nondeterministic ID APIs.

## Why This Matters

Runtime Bridge has grown into a broad metadata-only architecture. Without dependency-direction enforcement, future modules could accidentally create circular imports, pull enterprise layers back into foundation utilities, or make visualization/governance modules depend on lifecycle, resilience, or observability layers.

S4-C3 prevents that drift before UI or runtime integration begins.

## What Was Not Changed

S4-C3 does not:

- add metadata layers
- refactor Runtime Bridge modules
- merge H/G modules
- redesign folders
- add UI
- add rendering
- add runtime execution
- add backend behavior
- add persistence
- add exports
- change protected surfaces

## Protected Surfaces

S4-C3 does not modify:

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
