# S1 App.tsx Composition Root Refactor Plan

## Purpose

This document audits `frontend/src/App.tsx` after UX-F28 and proposes a safe, phased plan to reduce composition-root risk without changing behavior.

This is a planning audit only. No implementation changes are included.

## Non-Goals

Do not change:

- visible UI or layout
- routing/view behavior
- Human/Analyst switching
- upload, session restore, or workbook switching
- `executeWorkspaceQuery`
- `ActiveResultModel`
- `ResultsGrid`
- filtering, grouping, sorting, pagination, or exports
- Monaco/editor behavior
- SQL draft restore
- narrative rendering
- runtime persistence
- continuation wrappers
- runtime graph execution behavior

## Current App.tsx Responsibility Map

`App.tsx` is currently both a composition root and an orchestration module. It assembles hooks/components, but it also owns cross-feature state transitions, execution handlers, view registries, and derived intelligence reports.

### App Shell And Render Composition

Current responsibilities:

- imports shell, panels, workspace renderers, results grid, upload panel, query builder, filters, history, and dataset/session components
- creates `analystNavItems`
- renders `WorkspaceShell`
- passes shell callbacks for open file, view change, mode change, recent datasets, runtime panel toggle, and runtime trail select
- creates `humanViewRegistry`
- creates `analystViewRegistry`
- merges `workspaceViewRegistry`
- renders active view through `renderWorkspaceView`

Risk profile: medium. This belongs in `App.tsx`, but registry construction is now large enough to extract later.

### Dataset, Session, And Workbook Coordination

Current responsibilities:

- delegates most dataset/session/workbook behavior to `useWorkspaceDatasetController`
- passes result/query/filter/history setters into dataset controller
- receives dataset, recent datasets, active view, workspace mode, SQL metadata, upload state, workbook switching state, and dataset registry
- wires upload/result execution callback into execution registry
- computes active workbook worksheet from workbook metadata

Risk profile: high. The hook is already doing important reset/restore work. App should not absorb more dataset logic. Future extraction should keep this hook as the owner of upload/session/workbook side effects.

### Result Coordination

Current responsibilities:

- owns `useResults`
- builds `activeResultModel`
- handles tab changes
- updates preview/filtered/queried result states
- coordinates execution records through `coordinateActiveExecution`
- attaches execution and active result references to dataset registry
- computes `hasQueryResults`
- passes grid state into `ResultsGrid`

Risk profile: very high. This area touches `ActiveResultModel`, execution registry, query history, pagination, exports, and grid rendering.

### View, Routing, And Mode Coordination

Current responsibilities:

- delegates active view to dataset session controller
- handles Human insight navigation and back target
- updates runtime navigation persistence
- handles shell mode switching and target view selection
- handles runtime trail selection

Risk profile: high. Current routing is state-based, not URL-based. Any extraction must preserve exact ordering of `setWorkspaceMode`, runtime persistence updates, and `updateDatasetSessionView`.

### Filter And Query Builder Coordination

Current responsibilities:

- owns `useFilterController`
- owns `useQueryBuilderController`
- builds active filters and labels
- applies filters through `executeWorkspaceQuery`
- resets filters through preview execution
- runs visual query
- loads query pages
- sorts queried results
- changes rows per page for query and non-query results
- configures query builder for Human intent

Risk profile: very high. This is one of the primary executable paths. It should be extracted only after snapshot/report extraction proves safe.

### Export Coordination

Current responsibilities:

- delegates export payload creation/download to `useExportController`
- wraps export errors into app-level error message
- passes export action to Results and Export views

Risk profile: medium. This is already mostly isolated. A small wrapper extraction is possible, but not the safest first slice because it touches visible buttons and history.

### SQL And Analyst Coordination

Current responsibilities:

- creates Analyst Mode renderers from `analystWorkspaceRegistry`
- passes dataset and SQL workspace metadata
- coordinates SQL placeholder execution records into execution registry
- attaches execution record to active dataset

Risk profile: high. Monaco/editor behavior is intentionally isolated in `features/analyst/sql`; App should not modify it. Analyst renderer creation can be wrapped later, but execution callback ordering must stay unchanged.

### Runtime And Workspace Context Coordination

Current responsibilities:

- owns `runtimePersistence`
- saves runtime persistence in `useEffect`
- builds query builder runtime snapshot
- calls `useWorkspaceOrchestrationSnapshot`
- builds `workspaceRuntimeContext`
- handles runtime panel toggle
- handles runtime trail selection

Risk profile: high. This has state persistence and mode/view selection. Safe extraction is possible if it is a pure coordinator hook with identical inputs/outputs.

### Intelligence And Report Composition

Current responsibilities:

- builds data profile and dialect recommendation
- builds workflow recommendations
- builds business semantic report
- builds investigation report
- scans narrative intelligence
- builds analysis package plan
- builds investigation workspace plan
- passes reports into Build/Results surfaces

Risk profile: medium-low if extraction is pure. This is the safest first extraction candidate because it is mostly `useMemo` and deterministic hook composition with no direct state mutation.

### Event Handlers And Callbacks

Current responsibilities:

- filter apply/reset
- preview page load
- visual query run
- query page load
- export current result
- column sort
- page change
- rows-per-page change
- Human intent select
- Human insight navigation/back
- shell mode change
- runtime trail select

Risk profile: high. These handlers encode behavior ordering and should be extracted only after pure report/render extraction.

## Proposed Coordinator Hook Boundaries

### `useWorkspaceIntelligenceReports`

Suggested location: `frontend/src/features/workspace/useWorkspaceIntelligenceReports.ts`

Inputs:

- `dataset`
- `activeResultModel`
- `queryHistory`
- `workspaceMode`

Possible outputs:

- `dataProfile`
- `dialectRecommendation`
- `workflowRecommendationReport`
- `businessSemanticReport`
- `investigationReport`
- `narrativeReport`
- `analysisPackagePlan`
- `investigationWorkspacePlan`

Why this boundary is safe:

- mostly deterministic hooks and memo builders
- no query execution
- no routing changes
- no grid changes
- no backend calls

### `useWorkspaceRuntimeCoordinator`

Suggested location: `frontend/src/features/workspaceRuntime/useWorkspaceRuntimeCoordinator.ts`

Inputs:

- dataset/runtime/report state used by current `workspaceRuntimeContext`
- `runtimePersistence`
- setter for runtime persistence
- active view/mode setters

Outputs:

- `workspaceRuntimeContext`
- `onRuntimePanelToggle`
- `onRuntimeTrailSelect`
- persistence effect

Risk:

- touches localStorage persistence and mode/view navigation
- should not be the first implementation slice

### `useResultExecutionCoordinator`

Suggested location: `frontend/src/features/results/useResultExecutionCoordinator.ts`

Inputs:

- dataset
- active result state
- result setters
- query/filter controllers
- execution registry callbacks
- history
- error/loading setters

Outputs:

- `applyFilters`
- `resetFilters`
- `loadPreviewPage`
- `runVisualQuery`
- `loadQueryPage`
- `sortWorkspaceColumn`
- `changeWorkspacePage`
- `changeWorkspaceRowsPerPage`
- loading flags

Risk:

- high because it owns the executable result path
- should wait until S1-C or later

### `useHumanInsightCoordinator`

Suggested location: `frontend/src/features/workspace/useHumanInsightCoordinator.ts`

Inputs:

- dataset
- active result data
- query builder state
- runtime context/persistence
- view/mode setters
- result tab setter

Outputs:

- `humanIntent`
- `selectHumanIntent`
- `renderHumanIntentGuidance` replacement data model
- `navigateHumanInsightAction`
- `returnToHumanInsight`
- `humanInsightBackTarget`

Risk:

- medium-high because it crosses routing, runtime persistence, and query builder configuration
- should not move until runtime coordinator is stable

### `WorkspaceViewRegistry` Component Or Factory

Suggested location:

- `frontend/src/features/workspace/WorkspaceViewRegistry.tsx`
- or `frontend/src/features/workspace/createWorkspaceViewRegistry.tsx`

Responsibility:

- accept a typed context object and return the current active view
- keep `App.tsx` focused on assembling providers/hooks

Risk:

- medium because it moves JSX and callback wiring
- should happen after data/report extraction

## Safe Extraction Candidates

Recommended safe candidates:

1. Intelligence report composition into `useWorkspaceIntelligenceReports`.
2. Small pure selectors used by Results investigation surface:
   - source label
   - chart support label
   - top contributor label
   - highlight label
   - active sort label
3. Results investigation surface JSX into a component after selectors exist.
4. Analyst renderer callback wrapper after result execution callback is stabilized.

## Risky Extraction Candidates To Avoid Initially

Do not touch early:

- `applyFilters`
- `resetFilters`
- `runVisualQuery`
- `loadPreviewPage`
- `loadQueryPage`
- `sortWorkspaceColumn`
- `changeWorkspacePage`
- `changeWorkspaceRowsPerPage`
- `coordinateActiveExecution`
- `useWorkspaceDatasetController` call shape
- `handleResultTabChange`
- Human/Analyst shell mode switch callback
- runtime trail selection callback
- SQL/Analyst execution callback
- `ResultsGrid` props

These encode behavior that users feel immediately: execution, pagination, restore, routing, and mode switching.

## Phased Refactor Plan

### S1-A: Extract Intelligence Report Composition

Files to create/change:

- Create `frontend/src/features/workspace/useWorkspaceIntelligenceReports.ts`
- Change `frontend/src/App.tsx`

Responsibilities moved:

- `useDataIntelligence`
- `useWorkflowRecommendations`
- `useBusinessSemantics`
- `buildInvestigationReport`
- `scanNarrativeIntelligence`
- `buildAnalysisPackagePlan`
- `buildInvestigationWorkspacePlan`

Behavior preservation checks:

- Results executive insights unchanged.
- Investigation follow-ups unchanged.
- Analysis package readiness unchanged.
- Workspace hub readiness unchanged.
- Query Builder package/investigation props unchanged.
- No result/query/export behavior changes.

Rollback risk: low.

Validation:

- `npm.cmd run build`
- targeted lint for `App.tsx` and new hook
- verify no diff in `ResultsGrid`, `ActiveResultModel`, `executeWorkspaceQuery`, SQL files, export files

### S1-B: Extract Read-Only View Support Selectors And Result Context Surface

Files to create/change:

- Create `frontend/src/features/results/resultInvestigationSurfaceSelectors.ts`
- Optional: create `frontend/src/components/results/ResultsInvestigationSurface.tsx`
- Change `frontend/src/App.tsx`

Responsibilities moved:

- source label derivation
- takeaway/supporting label derivation
- top contributor/highlight label derivation
- compact Results investigation surface JSX

Behavior preservation checks:

- No change to `ResultsGrid`.
- Results side context collapsed/expanded behavior unchanged.
- Narrative cards unchanged.
- Workspace hub and package panels unchanged.
- No horizontal overflow regressions.

Rollback risk: medium-low.

Validation:

- `npm.cmd run build`
- targeted lint for changed files
- browser/manual check: open Results, show/hide context, switch result tabs

### S1-C: Extract Runtime Context Coordinator

Files to create/change:

- Create `frontend/src/features/workspaceRuntime/useWorkspaceRuntimeCoordinator.ts`
- Change `frontend/src/App.tsx`

Responsibilities moved:

- runtime persistence state/effect
- `queryBuilderRuntimeSnapshot`
- `useWorkspaceOrchestrationSnapshot` call
- `workspaceRuntimeContext` build
- runtime panel toggle
- runtime trail select handler

Behavior preservation checks:

- runtime panel collapsed state persists
- runtime trail click still changes view/mode identically
- Human/Analyst switching unchanged
- SQL workspace routing unchanged
- no changes to query execution

Rollback risk: medium-high.

Validation:

- `npm.cmd run build`
- targeted lint
- manual check: collapse runtime panel, reload, select runtime trail items, switch Human/Analyst

### S1-D: Extract Result Execution Coordinator

Files to create/change:

- Create `frontend/src/features/results/useResultExecutionCoordinator.ts`
- Change `frontend/src/App.tsx`

Responsibilities moved:

- loading flags for filtering/query execution
- filter apply/reset
- preview/filter page loading
- query run/page loading
- sort and rows-per-page orchestration
- export wrapper may stay separate or move later

Behavior preservation checks:

- preview pagination unchanged
- filtered pagination unchanged
- query pagination unchanged
- sort direction toggling unchanged
- filter reset restores preview and clears filtered result
- visual query history unchanged
- execution registry/dataset registry attachment unchanged
- export unchanged

Rollback risk: high.

Validation:

- `npm.cmd run build`
- targeted lint
- manual execution matrix: upload, filter, reset, run grouped query, sort, paginate, change rows/page, export

## First Safest Implementation Slice

Recommended first implementation: S1-A only.

Why:

- It reduces `App.tsx` size and coupling without touching executable handlers.
- It moves deterministic report composition into a typed hook.
- It does not affect `ResultsGrid`, `ActiveResultModel`, routing, runtime persistence, SQL/Monaco, exports, or query execution.
- It creates a pattern for later coordinator hooks.

Suggested first implementation prompt:

> Implement S1-A only. Create `frontend/src/features/workspace/useWorkspaceIntelligenceReports.ts` that composes the existing deterministic intelligence reports currently built in `App.tsx`: data intelligence, workflow recommendations, business semantics, investigation report, narrative report, analysis package plan, and investigation workspace plan. Update `App.tsx` to consume the hook outputs. Do not change behavior, UI, execution handlers, routing, ResultsGrid, ActiveResultModel, exports, SQL/Monaco, runtime persistence, or session/workbook restore. Run `npm.cmd run build`, targeted lint, and protected-file diff checks.

## Preservation Rules For All S1 Work

- Preserve state update ordering.
- Avoid changing dependency arrays unless required by extracted hook boundaries.
- Do not merge Human and Analyst routing logic.
- Do not move execution handlers until S1-D.
- Do not change `ActiveResultModel` shape.
- Do not alter `ResultsGrid` props or internals.
- Do not store additional runtime graph data in localStorage.
- Keep runtime graph and narrative intelligence metadata-only.
- Prefer additive typed hooks over broad rewrites.
- Each phase must be independently reversible.

## Risks And Watchpoints

### Dependency Array Drift

Moving `useMemo` and hook composition can change dependency behavior. Use the same dependencies as current `App.tsx` and let lint guide only necessary additions.

### Hidden State Ordering

Handlers like `selectHumanIntent`, `navigateHumanInsightAction`, and result execution functions rely on ordering between state updates. Do not extract them first.

### Over-Broad Context Objects

Avoid passing one giant `appContext` object into new hooks. Prefer explicit typed inputs and outputs so dependency and ownership boundaries remain visible.

### Naming Collision With Workspace Runtime

`workspaceRuntime` and `runtimeIntelligence` are separate. S1 should not merge them. S1-C may bridge runtime context coordination, but runtime graph contracts should remain metadata-only.

### View Registry JSX Coupling

Moving the entire view registry too soon can obscure callback wiring. Extract report composition first, then selectors/components, then runtime, then execution.

## Completion Criteria For S1 Cycle

The S1 cycle is complete when:

- `App.tsx` mostly assembles hooks/components.
- deterministic report composition lives in a typed coordinator hook.
- runtime context coordination lives in a typed coordinator hook.
- result execution coordination lives in a typed coordinator hook only after behavior-preservation validation.
- view registry/rendering can be read without scrolling through execution logic.
- protected surfaces remain unchanged across each phase.
