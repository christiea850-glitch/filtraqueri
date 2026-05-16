# S2-B Governance Annotation Adoption Plan

## Purpose

This planning audit reviews the S2-A governance foundation in `frontend/src/features/governance/` and proposes a safe adoption path for governance annotations across FiltraQueri.

This is an audit-only document. No implementation changes are included.

## S2-A Foundation Reviewed

S2-A introduced:

- `boundaryTypes.ts`
  - `CapabilityMode`
  - advisory, executable, metadata-only, presentational, composition, persistence, and hybrid boundary contracts
  - protected surface ids
  - side-effect kinds
- `sideEffectOwnership.ts`
  - protected executable surface list
  - side-effect ownership contracts
  - advisory-only, metadata-only, and hybrid feature path lists
- `governanceREADME.md`
  - governance vocabulary
  - side-effect ownership rules
  - preservation rules

The foundation is additive and currently unreferenced by runtime code, which is the right posture before adoption.

## Adoption Principles

Governance annotations should begin where the risk of behavioral change is lowest:

- annotate exported constants, reports, and metadata contracts before hooks
- annotate advisory modules before executable modules
- annotate feature-level ownership before function-level behavior
- prefer `satisfies` on static contracts over wrapping runtime values
- avoid importing governance contracts into protected execution surfaces early
- keep annotations descriptive, not controlling

S2-B must not add runtime enforcement, lint enforcement, route changes, execution guards, persistence writes, or UI changes.

## Safest Modules To Annotate First

### First-Tier Advisory Modules

These modules are deterministic, metadata/report oriented, and safer to annotate early:

- `frontend/src/features/narrativeIntelligence`
- `frontend/src/features/workflowRecommendations`
- `frontend/src/features/businessSemantics`
- `frontend/src/features/dataIntelligence`
- `frontend/src/features/investigationIntelligence`
- `frontend/src/features/analysisPackages`
- `frontend/src/features/analysisPlan`
- `frontend/src/features/planningReadiness`
- `frontend/src/features/taskPlanPreview`
- `frontend/src/features/explanations`

Recommended annotation style:

- add a feature-level `*Governance.ts` file or exported `governanceBoundary` constant
- use `AdvisoryBoundaryContract`
- declare `canExecute: false`, `canMutateResults: false`, `canCallBackend: false`, and `canPersistRuntimeState: false`
- list allowed outputs such as `summary`, `recommendation`, `diagnostic`, `readiness`, `continuation`, or `lineage_reference`

### First-Tier Metadata-Only Modules

These are ideal early candidates because they were designed as metadata-only:

- `frontend/src/features/runtimeIntelligence`
- `frontend/src/features/runtimeIntelligence/contracts`
- `frontend/src/features/runtimeIntelligence/graph`
- `frontend/src/features/runtimeIntelligence/continuations`
- `frontend/src/features/runtimeIntelligence/confidence`
- `frontend/src/features/runtimeIntelligence/events`
- `frontend/src/features/runtimeIntelligence/artifacts`

Recommended annotation style:

- use `MetadataOnlyBoundaryContract`
- explicitly set `canExecute: false`, `canMutateWorkspace: false`, and `canCallBackend: false`
- document lineage and continuation references as metadata only
- avoid any dependency on React hooks, persistence helpers, or executable coordinators

### Low-Risk Presentational Modules

These can be annotated after advisory and metadata-only modules:

- `frontend/src/components/results/ResultsInvestigationSurface.tsx`
- `frontend/src/components/results/ResultTabs.tsx`
- simple panels under `frontend/src/components/history`, `frontend/src/components/upload`, and static layout surfaces
- `frontend/src/features/workspaceRuntime/RuntimeDisclosureSlot.tsx`

Recommended annotation style:

- use `PresentationalBoundaryContract`
- set `canExecute: false`, `canOwnSideEffects: false`, `mayReceiveCallbacks: true`
- avoid annotating `ResultsGrid` early because it is protected, complex, and behavior-critical

## Modules That Should Not Be Annotated Yet

Do not annotate these in early S2-B slices:

- `frontend/src/features/execution/executeWorkspaceQuery.ts`
- `frontend/src/components/results/ResultsGrid.tsx`
- `frontend/src/features/results/activeResultModel.ts`
- `frontend/src/features/results/useResultExecutionCoordinator.ts`
- `frontend/src/features/export/useExportController.ts`
- `frontend/src/features/analyst/sql`
- `frontend/src/features/dataset/useWorkspaceDatasetController.ts`
- `frontend/src/features/dataset/useDatasetSessions.ts`
- `frontend/src/features/workspaceRuntime/runtimePersistence.ts`
- `frontend/src/features/workspaceRuntime/useWorkspaceRuntimeCoordinator.ts`
- backend query/upload/session/workbook routes

Reason: these are protected executable, persistence, or hybrid surfaces. Adding imports to governance types is low-risk in theory, but not worth touching until advisory and metadata-only adoption proves stable.

## Annotation Patterns

### Advisory Modules

Pattern:

```ts
import type { AdvisoryBoundaryContract } from "../governance/boundaryTypes";

export const featureGovernance = {
  mode: "advisory",
  contractId: "narrative-intelligence",
  label: "Narrative intelligence",
  canExecute: false,
  canMutateResults: false,
  canCallBackend: false,
  canPersistRuntimeState: false,
  allowedOutputs: ["summary", "recommendation", "readiness", "continuation"],
} satisfies AdvisoryBoundaryContract;
```

Use this pattern for report builders, deterministic scanners, recommendation builders, readiness builders, and explanation builders.

Avoid:

- wrapping existing function outputs
- passing governance contracts into UI components
- adding runtime conditionals based on governance fields

### Metadata-Only Modules

Pattern:

```ts
import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";

export const runtimeGraphGovernance = {
  mode: "metadata_only",
  contractId: "runtime-intelligence-graph",
  label: "Runtime intelligence graph",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: ["runtime-node", "runtime-edge", "runtime-artifact"],
} satisfies MetadataOnlyBoundaryContract;
```

Use this for runtime graph, runtime confidence, runtime events, artifacts, and continuations.

Avoid:

- references to persistence owners
- executable callbacks
- backend request payloads
- scheduler, replay, or orchestration semantics

### Executable Modules

Pattern, later only:

```ts
import type { ExecutableBoundaryContract } from "../governance/boundaryTypes";

export const resultExecutionGovernance = {
  mode: "executable",
  contractId: "result-execution-coordinator",
  label: "Result execution coordinator",
  canExecute: true,
  canMutateResults: true,
  canCallBackend: true,
  requiresUserAction: true,
  sideEffectOwner: {
    ownerId: "result-execution-coordinator",
    ownerName: "useResultExecutionCoordinator",
  },
  sideEffects: ["backend_query", "result_mutation", "result_activation", "history_mutation"],
} satisfies ExecutableBoundaryContract;
```

Do not apply this pattern during S2-B1 or S2-B2. Executable annotation should happen only after advisory and metadata-only modules are annotated and validated.

### Presentational Modules

Pattern:

```ts
import type { PresentationalBoundaryContract } from "../../features/governance/boundaryTypes";

export const resultsInvestigationSurfaceGovernance = {
  mode: "presentational",
  contractId: "results-investigation-surface",
  label: "Results investigation surface",
  canExecute: false,
  canOwnSideEffects: false,
  mayReceiveCallbacks: true,
} satisfies PresentationalBoundaryContract;
```

Use this for simple display components, not protected grid internals.

### Composition Modules

Pattern:

```ts
import type { CompositionBoundaryContract } from "../governance/boundaryTypes";

export const workspaceIntelligenceReportsGovernance = {
  mode: "composition",
  contractId: "workspace-intelligence-reports",
  label: "Workspace intelligence reports",
  canExecuteDirectly: false,
  mayWireCallbacks: true,
  composedModes: ["advisory"],
} satisfies CompositionBoundaryContract;
```

Good candidates:

- `useWorkspaceIntelligenceReports`
- `analystWorkspaceRegistry`
- registry/helper modules that assemble metadata but do not execute

Avoid early annotation of `App.tsx`.

### Hybrid Modules

Pattern, later only:

```ts
import type { HybridBoundaryContract } from "../governance/boundaryTypes";

export const appCompositionGovernance = {
  mode: "hybrid",
  contractId: "app-composition-root",
  label: "App composition root",
  requiresBoundaryNotes: true,
  advisoryResponsibilities: ["wire advisory reports into presentational surfaces"],
  executableResponsibilities: ["wire user-triggered callbacks to executable owners"],
} satisfies HybridBoundaryContract;
```

Hybrid annotations should come late because they touch the most sensitive ownership boundaries.

## S2-B1: Annotate Advisory And Metadata-Only Feature Boundaries

Files to create/change:

- add governance constants in selected advisory feature folders
- add governance constants in runtime intelligence metadata-only folders
- optionally add `index.ts` exports only if they do not affect existing imports

Recommended first targets:

- `frontend/src/features/narrativeIntelligence`
- `frontend/src/features/workflowRecommendations`
- `frontend/src/features/businessSemantics`
- `frontend/src/features/investigationIntelligence`
- `frontend/src/features/analysisPackages`
- `frontend/src/features/runtimeIntelligence`

Responsibilities:

- label advisory and metadata-only modules
- avoid executable imports
- avoid behavior changes
- avoid protected execution surfaces

Validation:

- `npm.cmd run build`
- targeted lint for changed governance annotation files
- protected-file diff check

Rollback risk: low.

## S2-B2: Annotate Additional Advisory Planning Layers And Safe Composition

Files to create/change:

- advisory planning feature governance constants
- safe composition governance constants

Recommended targets:

- `frontend/src/features/analysisPlan`
- `frontend/src/features/analyticsPlanning`
- `frontend/src/features/analyticsIntentGraph`
- `frontend/src/features/businessQuestionIntelligence`
- `frontend/src/features/kpiIntelligence`
- `frontend/src/features/planningReadiness`
- `frontend/src/features/taskPlanPreview`
- `frontend/src/features/explanations`
- `frontend/src/features/workspace/useWorkspaceIntelligenceReports.ts` or adjacent governance file

Responsibilities:

- broaden advisory coverage
- annotate composition that only assembles advisory reports
- still avoid executable, persistence, routing, and restore surfaces

Validation:

- `npm.cmd run build`
- targeted lint
- protected-file diff check

Rollback risk: low to medium-low.

## S2-B3: Annotate Presentational And Carefully Selected Hybrid Boundaries

Files to create/change:

- safe presentational governance constants
- optional hybrid governance constants in separate adjacent files

Recommended targets:

- `frontend/src/components/results/ResultsInvestigationSurface.tsx` or adjacent governance file
- simple `ResultTabs` or history/upload display surfaces
- `frontend/src/features/workspaceRuntime/RuntimeDisclosureSlot.tsx`
- optional adjacent governance notes for `App.tsx`, not imports inside `App.tsx`

Avoid in S2-B3 unless separately approved:

- `ResultsGrid`
- `ActiveResultModel`
- `useResultExecutionCoordinator`
- `executeWorkspaceQuery`
- exports
- SQL/Monaco
- dataset/session/workbook restore
- runtime persistence

Responsibilities:

- make presentational and hybrid boundaries easier to review
- keep annotations out of protected implementation files where possible
- prefer adjacent `*.governance.ts` files over modifying large components

Validation:

- `npm.cmd run build`
- targeted lint
- protected-file diff check
- no browser behavior changes expected

Rollback risk: medium-low if adjacent files are used.

## Protected Surfaces To Avoid During Early Adoption

Do not touch early:

- `executeWorkspaceQuery`
- `ResultsGrid`
- `ActiveResultModel`
- `useResultExecutionCoordinator`
- `useExportController`
- SQL/Monaco files
- `useWorkspaceDatasetController`
- `useDatasetSessions`
- workbook/session restore paths
- `runtimePersistence`
- backend route handlers

These should be annotated only after S2-B1 and S2-B2 validate the pattern and after reviewers agree that type-only imports are worth the churn.

## Review Checklist For S2-B Implementation

For each annotation:

- Does it add only static type-level metadata?
- Does it avoid changing runtime values consumed by the UI?
- Does it avoid protected execution surfaces?
- Does it avoid imports from executable modules into advisory modules?
- Does it avoid callbacks, function references, and backend request payloads in advisory contracts?
- Does it preserve deterministic narrative behavior?
- Does it preserve runtime graph metadata-only behavior?
- Does it pass build and targeted lint?

## First Implementation Recommendation

Proceed with S2-B1 only.

Implement feature-level governance constants for the safest advisory and metadata-only modules:

- narrative intelligence
- workflow recommendations
- business semantics
- investigation intelligence
- analysis packages
- runtime intelligence

Use adjacent `*.governance.ts` files or existing `index.ts` exports only where that does not disturb existing imports. Prefer adjacent files if there is any doubt.

Do not annotate executable, persistence, routing, SQL/Monaco, export, ResultsGrid, ActiveResultModel, or dataset restore surfaces in S2-B1.

## Non-Goals

S2-B should not:

- add lint enforcement
- add runtime assertions
- change UI behavior
- change query execution behavior
- change export behavior
- change routing
- change Human/Analyst switching
- change workbook/session restore
- persist governance metadata
- alter runtime graph behavior
- alter narrative scanner behavior

## Final Recommendation

Governance adoption should be boring on purpose. Start with static advisory and metadata-only annotations, validate that no behavior changes occur, then expand toward composition and presentational surfaces. Protected executable owners should remain untouched until the project has confidence in the annotation pattern.
