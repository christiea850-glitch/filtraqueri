# S1 Stabilization Checkpoint Audit

## Purpose

This checkpoint reviews `frontend/src/App.tsx` after the S1 composition-root stabilization work:

- S1-A intelligence report composition extraction
- S1-B Results investigation surface and selector extraction
- S1-C workspace runtime coordinator extraction
- S1-D1 result execution coordinator extraction

This is an audit-only document. No frontend or backend behavior changes are included.

## Executive Recommendation

Pause S1 and move to S2 Advisory vs Executable Boundary Enforcement.

S1 has already removed the highest-risk concentration from `App.tsx`: deterministic intelligence reports, read-only Results context rendering, runtime context coordination, and the executable result path now live in typed feature boundaries. The remaining work in `App.tsx` is still large, but it is now mostly composition, mode/view assembly, Human guidance, and shell wiring.

S1-D2 is not necessary now. Moving export wrappers or Human insight navigation immediately would add routing and persistence risk without meaningfully improving the composition-root posture. S2 should establish stronger advisory/executable boundaries before more code is moved.

## Current App.tsx Responsibility Map After S1-D1

`App.tsx` now acts more like a composition root than an orchestration module, though it still owns several cross-feature seams.

### App Shell And Render Composition

Still in `App.tsx`:

- creates `analystNavItems`
- renders `WorkspaceShell`
- passes shell callbacks for file open, view change, mode change, recent datasets, runtime panel toggle, and runtime trail selection
- builds `humanViewRegistry`
- builds `analystViewRegistry`
- merges `workspaceViewRegistry`
- renders the active view through `renderWorkspaceView`

Assessment: appropriate for a composition root, but still bulky because the view registry includes rich JSX and callback wiring.

### Dataset, Session, And Workbook Coordination

Still in `App.tsx`:

- invokes `useWorkspaceDatasetController`
- passes result, query, filter, history, restore, and execution callbacks into the dataset controller
- derives active workbook worksheet metadata for Query Builder display
- keeps dataset/session/workbook restore owned by the existing dataset controller

Assessment: preserved. This remains a sensitive boundary and should not be moved during a minor cleanup.

### Result State And Active Result Composition

Still in `App.tsx`:

- invokes `useResults`
- invokes `useActiveResultModel`
- derives `activeFilters`, `activeFilterLabels`, and `hasQueryResults`
- passes active result model and handlers into `ResultsGrid`

Moved out:

- executable result handlers
- loading flags
- result tab activation
- pagination/sorting/query/filter execution
- active execution coordination for result tabs

Assessment: healthier. `App.tsx` still composes result state, but the execution path is now isolated in `useResultExecutionCoordinator`.

### Filtering And Query Builder Coordination

Still in `App.tsx`:

- invokes `useFilterController`
- invokes `useQueryBuilderController`
- passes draft query/filter state into panels and coordinators
- handles presentational Query Builder prop wiring

Moved out:

- filter application
- filter reset
- query execution
- query pagination
- query sorting
- queried rows-per-page execution

Assessment: the executable behavior is no longer embedded in the view registry. Remaining logic is largely state ownership and prop wiring.

### Export Coordination

Still in `App.tsx`:

- invokes `useExportController`
- owns the small `exportCurrentResults` wrapper that clears/sets app-level errors
- wires export buttons in Results and Export views

Assessment: acceptable to leave in `App.tsx`. Export is already isolated through `useExportController`, and moving the wrapper now would provide low value.

### SQL And Analyst Coordination

Still in `App.tsx`:

- creates Analyst Mode renderers through `createAnalystWorkspaceRenderers`
- passes SQL workspace metadata
- records SQL placeholder execution results through the execution registry
- attaches SQL execution references to the active dataset

Assessment: preserved. This is still cross-feature coordination, but it is compact and should remain untouched until an Analyst-specific coordination phase.

### Runtime Context Coordination

Moved out:

- runtime persistence state and save effect
- Query Builder runtime snapshot
- `useWorkspaceOrchestrationSnapshot`
- `workspaceRuntimeContext` construction
- runtime panel toggle
- runtime trail selection

Still in `App.tsx`:

- consumes `runtimePersistence`, `setRuntimePersistence`, and `workspaceRuntimeContext`
- uses runtime persistence for Human task selection
- uses runtime navigation helpers for Human insight back/forward behavior

Assessment: improved. The canonical runtime context is now centralized, while Human insight navigation still intentionally remains in `App.tsx`.

### Intelligence And Report Composition

Moved out:

- data intelligence
- dialect recommendation
- workflow recommendations
- business semantics
- investigation report
- narrative report
- analysis package plan
- investigation workspace plan

Still in `App.tsx`:

- consumes investigation, narrative, package, and workspace plans
- passes reports into Results, Filters, and Query Builder surfaces

Assessment: healthy. This is now a read-only composition dependency instead of inline report orchestration.

### Human Mode Insight And Navigation

Still in `App.tsx`:

- `humanIntentGuidance`
- `humanIntent`
- `humanInsightBackTarget`
- `selectHumanIntent`
- `navigateHumanInsightAction`
- `returnToHumanInsight`
- `createHumanInsight`
- `renderHumanInsightBackButton`
- `renderHumanIntentGuidance`

Assessment: this is the largest remaining behavior-rich block. It crosses mode switching, result tabs, query-builder configuration, view selection, and runtime persistence. It should not be moved as part of S1-D2 without a separate audit.

## Confirmation: Behavior-Critical Logic Was Not Accidentally Fragmented

The S1 extractions appear coherent:

- Result execution behavior is contained in `useResultExecutionCoordinator`, including loading flags, exact error messages, query/filter execution, pagination, sorting, result activation, history updates, and execution registry attachment.
- Export behavior remains separate through `useExportController` and the small app-level wrapper.
- Runtime persistence and runtime trail selection are together in `useWorkspaceRuntimeCoordinator`.
- Narrative and investigation rendering is presentational in `ResultsInvestigationSurface`.
- Deterministic report composition is consolidated in `useWorkspaceIntelligenceReports`.
- Dataset/session/workbook restore continues to be owned by `useWorkspaceDatasetController`.
- `ResultsGrid`, `ActiveResultModel`, and `executeWorkspaceQuery` remain protected dependencies rather than refactor targets.

No behavior-critical path appears split across multiple new hooks in a way that would obscure ordering. The main caveat is that Human insight navigation still calls the result tab handler returned by `useResultExecutionCoordinator`, which is expected and intentional after S1-D1.

## Remaining Risky Coupling

### Human Insight Navigation

Human guidance still coordinates:

- mode selection
- active view updates
- query-builder configuration
- result tab changes
- runtime persistence selections
- back-target restoration

Risk: high. This is the strongest candidate for a future dedicated audit, but it should not be moved casually.

### View Registry Size

The Human view registry still contains a lot of JSX and callback wiring.

Risk: medium. It is noisy rather than currently unsafe. Extracting it too early could make callback ownership harder to inspect.

### Analyst Renderer Execution Callback

The SQL execution callback still records and attaches execution references in `App.tsx`.

Risk: medium. It is compact, but it crosses Analyst rendering and execution lineage.

### Dataset Controller Input Surface

`useWorkspaceDatasetController` receives many state setters and restore callbacks.

Risk: medium-high. This predates S1 and remains a sensitive restore boundary. Avoid changing this until restore behavior has explicit regression coverage.

### Result Coordinator Input Surface

`useResultExecutionCoordinator` has a broad input contract.

Risk: medium. This is the tradeoff of preserving exact behavior during S1-D1. The benefit is that execution ordering is isolated and visible in one hook.

## S1-D2 Assessment

S1-D2 should not proceed immediately.

Possible S1-D2 work would likely include:

- moving the small export wrapper
- extracting more Human insight/navigation logic
- reducing view registry size

Those changes are not urgent after S1-D1. Export is already mostly isolated, while Human navigation and view registry extraction would touch routing, runtime persistence, and Human Mode behavior. That risk belongs in a separately planned phase, not a continuation of result execution extraction.

## Tiny S1-E Cleanup Assessment

No S1-E cleanup is required now.

A tiny S1-E could be considered later only if reviewers want documentation or naming polish. Recommended candidates would be limited to:

- documenting coordinator ownership in comments or architecture docs
- adding a no-behavior barrel export for newly created S1 hooks

Do not use S1-E to move Human navigation, routing, export behavior, or view registries.

## Recommended Next Phase: S2 Advisory vs Executable Boundary Enforcement

Proceed to S2.

S2 should define and enforce the boundary between advisory intelligence and executable workspace behavior before adding more intelligence layers or moving more composition code.

Recommended S2 goals:

- classify feature modules as executable, advisory, presentational, persistence, or composition
- confirm narrative intelligence remains deterministic and advisory-only
- confirm runtime intelligence graph contracts remain metadata-only
- protect `executeWorkspaceQuery`, `ResultsGrid`, `ActiveResultModel`, SQL/Monaco, exports, workbook restore, and session restore as executable/protected surfaces
- document which hooks may trigger backend execution and which must not
- add governance checks or lightweight tests around advisory modules avoiding execution side effects
- define review rules for future continuation, optimization, forecasting, and agentic planning phases

## Preservation Checklist For The Next Phase

Before future refactors, preserve:

- routing/back behavior
- Human/Analyst switching
- upload/session restore
- workbook switching
- SQL workspace and Monaco behavior
- Query Builder execution behavior
- filter application and reset behavior
- preview, filtered, and queried pagination
- sorting behavior
- export behavior
- runtime persistence
- narrative rendering
- investigation workspace metadata
- continuation metadata
- runtime graph metadata-only contracts

## Final Checkpoint Position

S1 achieved its stabilization goal. `App.tsx` is not yet small, but it is healthier:

- deterministic intelligence composition is out
- read-only Results context rendering is out
- runtime context coordination is out
- result execution coordination is out
- protected executable surfaces were kept intact

The safest next move is not more extraction. The safest next move is S2 boundary governance so future advisory intelligence cannot accidentally become executable behavior.
