# S2 Advisory vs Executable Boundary Enforcement Audit

## Purpose

This audit defines the governance boundary between advisory intelligence and executable workspace behavior in FiltraQueri after S1 stabilization.

This is documentation only. It does not change frontend behavior, backend behavior, runtime persistence, query execution, exports, routing, Monaco, workbook/session restore, narrative rendering, or runtime graph contracts.

## Governance Philosophy

FiltraQueri should treat intelligence as advice until a clearly executable workspace module performs an explicit user-driven action.

Advisory systems may inspect metadata, summarize deterministic patterns, rank options, explain readiness, and prepare future-safe contracts. They must not execute queries, mutate result state, persist runtime execution state, trigger exports, switch workbooks, change routes, or perform backend orchestration.

Executable systems may run queries, mutate result state, persist workspace/session state, export data, paginate, sort, restore workbooks, and coordinate SQL execution. They must not invent unsupported business claims or turn advisory suggestions into actions without a user-visible execution boundary.

## Classified Module Inventory

### Executable

These modules can trigger backend calls, mutate result state, persist execution-affecting state, or perform concrete workspace actions:

- `frontend/src/features/execution`
  - `executeWorkspaceQuery`
  - execution registry metadata attached to real executions
- `frontend/src/features/results/useResultExecutionCoordinator.ts`
  - filtering, query execution, pagination, sorting, result activation, history updates
- `frontend/src/features/results/useResults.ts`
  - active result state containers
- `frontend/src/features/export/useExportController.ts`
  - export payload generation and download
- `frontend/src/features/dataset/useWorkspaceDatasetController.ts`
  - upload/session/workbook restore coordination and dataset switching
- `frontend/src/features/dataset/useDatasetSessions.ts`
  - session persistence and restore
- `frontend/src/features/filters/useFilterController.ts`
  - filter state used by execution
- `frontend/src/features/query-builder/useQueryBuilderController.ts`
  - query-builder state used by execution
- `frontend/src/features/analyst/sql`
  - SQL workspace, Monaco/editor behavior, SQL execution path, SQL metadata behavior
- `frontend/src/features/workspaceRuntime/runtimePersistence.ts`
  - runtime UI persistence
- `backend/app/main.py`
  - backend routes and query/upload/session behavior
- `backend/app/workbook_ingestion.py`
  - workbook ingestion
- `backend/app/workbook_relationships.py`
  - backend relationship analysis support

### Advisory

These modules should remain deterministic, metadata-driven, and non-executing:

- `frontend/src/features/narrativeIntelligence`
- `frontend/src/features/workflowRecommendations`
- `frontend/src/features/businessSemantics`
- `frontend/src/features/dataIntelligence`
- `frontend/src/features/investigationIntelligence`
- `frontend/src/features/analysisPackages`
- `frontend/src/features/analysisPlan`
- `frontend/src/features/analyticsPlanning`
- `frontend/src/features/analyticsIntentGraph`
- `frontend/src/features/businessQuestionIntelligence`
- `frontend/src/features/kpiIntelligence`
- `frontend/src/features/planningReadiness`
- `frontend/src/features/relationshipAwarePlanning`
- `frontend/src/features/taskPlanPreview`
- `frontend/src/features/explanations`
- `frontend/src/features/engineAdapters`
- `frontend/src/features/sqlIntelligence`
- `frontend/src/features/workbookIntelligence`
- `frontend/src/features/workbookRelationships`

Advisory modules may produce labels, readiness summaries, candidate plans, diagnostics, suggested questions, relationship candidates, explanation text, or future execution previews. They must not call `executeWorkspaceQuery`, export data, mutate active results, or drive routing.

### Metadata-Only

These modules define lineage, future orchestration contracts, continuation metadata, confidence, or immutable artifacts without execution:

- `frontend/src/features/runtimeIntelligence`
- `frontend/src/features/runtimeIntelligence/contracts`
- `frontend/src/features/runtimeIntelligence/graph`
- `frontend/src/features/runtimeIntelligence/continuations`
- `frontend/src/features/runtimeIntelligence/confidence`
- `frontend/src/features/runtimeIntelligence/events`
- `frontend/src/features/runtimeIntelligence/artifacts`
- continuation metadata produced by narrative and investigation systems
- advisory runtime checkpoints in investigation workspace metadata

Metadata-only modules may create ids, references, summaries, confidence metadata, and lineage contracts. They must not persist executable runtime state or trigger any backend work.

### Persistence

These modules own storage and restore behavior:

- `frontend/src/features/workspace/workspacePersistence.ts`
- `frontend/src/features/sqlWorkspacePersistence`
- `frontend/src/features/workspaceRuntime/runtimePersistence.ts`
- `frontend/src/features/dataset/useDatasetSessions.ts`
- `frontend/src/features/investigationWorkspace/workspaceSessionStorage.ts`
- backend storage manifests and session/upload storage

Persistence modules are allowed to save state only within their existing ownership. Advisory modules should pass metadata to persistence owners rather than write directly.

### Composition

These modules assemble feature outputs and should not independently execute:

- `frontend/src/App.tsx`
- `frontend/src/features/workspace/useWorkspaceIntelligenceReports.ts`
- `frontend/src/features/workspaceRuntime/useWorkspaceRuntimeCoordinator.ts`
- `frontend/src/features/workspace/useWorkspaceOrchestrationSnapshot.ts`
- `frontend/src/features/workspace/workspaceOrchestration.ts`
- `frontend/src/features/analyst/analystWorkspaceHelpers.ts`
- `frontend/src/features/analyst/analystWorkspaceRegistry.ts`

Composition modules may pass callbacks and coordinate existing owners. They should avoid inventing new business rules or executing advisory suggestions.

### Presentational

These modules render state and call supplied callbacks:

- `frontend/src/components/results/ResultsGrid.tsx`
- `frontend/src/components/results/ResultsInvestigationSurface.tsx`
- `frontend/src/components/results/ResultTabs.tsx`
- `frontend/src/components/dataset`
- `frontend/src/components/filters`
- `frontend/src/components/history`
- `frontend/src/components/layout`
- `frontend/src/components/query-builder`
- `frontend/src/components/upload`
- `frontend/src/features/tasksLauncher` UI components
- `frontend/src/features/workspaceRuntime/RuntimeDisclosureSlot.tsx`

Presentational modules may display advisory outputs and expose user controls. They should not decide whether advisory recommendations become executable actions.

### Hybrid

These areas are unavoidable hybrids and need stricter review:

- `frontend/src/App.tsx`
  - composition root, view registry, mode switching, Human guidance, shell callback wiring
- `frontend/src/features/workspaceRuntime/useWorkspaceRuntimeCoordinator.ts`
  - runtime context composition plus runtime UI persistence and trail navigation
- `frontend/src/features/results/useResultExecutionCoordinator.ts`
  - result execution plus history and execution registry attachment
- `frontend/src/features/dataset/useWorkspaceDatasetController.ts`
  - upload/session/workbook restore plus result/query/filter reset coordination
- `frontend/src/features/analyst/sql`
  - presentational SQL workspace plus executable SQL behavior
- `frontend/src/features/investigationWorkspace`
  - advisory investigation plans plus session metadata and timeline persistence

Hybrid modules should have explicit comments or contracts identifying which exports are advisory and which can mutate or execute.

## Current Advisory Systems

Advisory systems currently include:

- narrative intelligence
- workflow recommendations
- business semantics
- data intelligence
- investigation reports
- analysis package planning
- investigation workspace recommendations
- continuation metadata
- runtime intelligence graph contracts
- runtime confidence contracts
- runtime artifact and event metadata
- Human Mode guidance cards and intent summaries
- SQL diagnostics and explanations
- relationship-aware planning
- workbook intelligence
- business question intelligence
- KPI intelligence
- planning readiness
- task plan previews
- future optimization metadata
- future forecasting metadata

The key governance rule: these systems may advise what a user might inspect, compare, filter, group, export, optimize, or forecast, but they must not perform those actions.

## Current Executable Systems

Executable systems currently include:

- query execution through `executeWorkspaceQuery`
- filter application and reset
- preview, filtered, and queried pagination
- preview, filtered, and queried sorting
- result mutation and result activation
- query history mutation
- export execution
- SQL workspace execution behavior
- upload and dataset activation
- workbook worksheet switching
- session restore
- runtime UI persistence
- backend upload/query/session/workbook routes
- execution registry attachment to active dataset

The key governance rule: these systems may change state and call the backend, but they should not infer unsupported intelligence or convert advisory metadata into execution without explicit user intent.

## Protected Surfaces

The following surfaces should remain protected in future S2 implementation:

- `executeWorkspaceQuery`
- `ResultsGrid`
- `ActiveResultModel`
- `useResultExecutionCoordinator`
- `useExportController`
- `useWorkspaceDatasetController`
- `useWorkspaceRuntimeCoordinator`
- SQL/Monaco files under `frontend/src/features/analyst/sql`
- `frontend/src/features/sqlWorkspacePersistence`
- `frontend/src/features/workspaceRuntime/runtimePersistence.ts`
- workbook/session restore paths
- backend query/upload/session/workbook routes
- runtime intelligence graph contracts
- narrative intelligence deterministic scanner and detectors

Any future phase touching these should include explicit preservation checks and a manual regression matrix.

## Hybrid And Risky Coupling Areas

### Human Guidance To Execution Boundary

Human Mode guidance can set view, configure query-builder inputs, change tabs, and update runtime navigation metadata.

Risk: advisory guidance can feel close to execution. It must remain user-mediated. Selecting a Human intent may configure the workspace, but it must not run a query, export data, or trigger backend work automatically.

### Continuation Metadata

Continuation suggestions appear in narrative, runtime, investigation, and package planning layers.

Risk: future phases may turn continuations into executable actions. Until a dedicated execution boundary exists, continuations must remain metadata and display text only.

### Runtime Graph Contracts

Runtime graph contracts model lineage and future replay/orchestration.

Risk: graph language can imply execution. Current runtime intelligence must remain metadata-only. Runtime nodes and edges should never trigger execution in S2.

### Investigation Workspace Persistence

Investigation workspace metadata can include recommendations, timelines, package readiness, and narrative references.

Risk: persisted advisory metadata may be mistaken for approved executable history. Store advisory status explicitly and keep executable records separate from advisory checkpoints.

### SQL Intelligence

SQL diagnostics and explanations are advisory, while SQL workspace behavior is executable.

Risk: SQL suggestions or diagnostics could be wired to execution too directly. SQL intelligence may validate and explain, but the SQL execution owner must remain separate.

### Analysis Packages And Future Optimization

Analysis packages can define artifacts and readiness.

Risk: package readiness could be mistaken for execution readiness. Package plans should remain advisory until an explicit export or execution action is user-triggered.

## Boundary Rules

### Advisory Restrictions

Advisory modules must not:

- import or call `executeWorkspaceQuery`
- call export/download helpers
- mutate `ResultState`
- mutate `ActiveResultModel`
- set active result tabs
- call backend routes
- save runtime persistence directly
- switch workbooks
- switch datasets
- change application routes/views
- mutate SQL workspace drafts
- create executable history entries
- mark advisory continuation metadata as completed execution

Advisory modules may:

- inspect dataset metadata
- inspect active result models
- inspect sampled rows already available in memory
- inspect query history
- build deterministic summaries
- build recommendations
- create confidence metadata
- create lineage references
- create advisory timeline checkpoints
- expose future-safe continuation suggestions

### Executable Restrictions

Executable modules must not:

- invent unsupported narratives
- create business explanations that are not derived from state or backend results
- silently execute advisory recommendations
- treat confidence metadata as a gate unless an explicit future policy says so
- mutate runtime graph metadata as though it were execution history
- bypass user intent for exports, query execution, forecast execution, or optimization execution

Executable modules may:

- execute backend requests
- mutate owned state
- persist state within their domain
- attach execution records
- record query/export history
- activate result tabs
- paginate and sort results
- restore sessions/workbooks according to existing behavior

### Metadata-Only Runtime Graph Restrictions

Runtime graph modules must remain:

- deterministic
- serializable
- immutable-by-contract
- lineage-oriented
- advisory until future orchestration is explicitly implemented

Runtime graph modules must not:

- schedule work
- replay work
- execute work
- mark user approval
- mutate active workspace state
- persist autonomous monitoring records

### Continuation Restrictions

Continuation contracts should include advisory intent and possible targets, but no runnable function references.

Continuation metadata should answer:

- what might the user do next?
- why might it be useful?
- what evidence supports it?
- what view or feature would the user inspect?

Continuation metadata should not include:

- executable callbacks
- backend payloads ready for automatic dispatch
- hidden route changes
- automatic query/export/optimization triggers

### Future AI Restrictions

Future AI-assisted systems must be explicitly advisory unless a separate user-confirmed executable boundary is implemented.

Future AI may:

- explain deterministic findings
- draft summaries from available evidence
- propose continuations
- rank possible analyses
- prepare user-reviewable plans

Future AI must not:

- run queries automatically
- export data automatically
- alter workbook/session state
- create hidden execution records
- approve recommendations
- convert low-confidence metadata into facts
- override deterministic scanners
- bypass governance audit trails

## Contract Conventions

S2 should introduce explicit contract vocabulary before future execution systems arrive.

Recommended conventions:

```ts
type CapabilityMode = "advisory" | "executable" | "metadata_only" | "presentational";
```

Recommended advisory contract fields:

```ts
type AdvisoryContract = {
  mode: "advisory";
  canExecute: false;
  canMutateResults: false;
  canCallBackend: false;
  evidenceRefs: string[];
  confidenceRef?: string;
};
```

Recommended executable contract fields:

```ts
type ExecutableContract = {
  mode: "executable";
  canExecute: true;
  sideEffectOwner: string;
  requiresUserAction: true;
  protectedSurface?: string;
};
```

Recommended metadata-only contract fields:

```ts
type MetadataOnlyContract = {
  mode: "metadata_only";
  canExecute: false;
  canMutateWorkspace: false;
  lineageRefs: string[];
};
```

These should start as type-level conventions, not runtime behavior changes.

## Side-Effect Ownership

Each side effect should have one clear owner:

- backend query execution: `executeWorkspaceQuery`
- result mutation and activation: `useResultExecutionCoordinator`
- export execution: `useExportController`
- upload/session/workbook restore: `useWorkspaceDatasetController`
- SQL workspace execution: SQL workspace owner
- runtime UI persistence: `useWorkspaceRuntimeCoordinator` and `runtimePersistence`
- deterministic narrative generation: `narrativeIntelligence`, advisory only
- runtime graph lineage contracts: `runtimeIntelligence`, metadata-only

Advisory modules should pass recommendations into these owners only as displayable metadata.

## Lightweight Enforcement Strategies

### Typing Conventions

- Add `mode` and capability flags to future advisory/executable contracts.
- Prefer `Readonly<T>` inputs for advisory scanners.
- Use result/evidence references rather than mutable result objects where possible.
- Keep continuation contracts free of function fields.

### Folder Boundaries

- Advisory folders should not import from `features/execution`, `features/export`, or backend API clients.
- Metadata-only runtime graph folders should not import React hooks, persistence helpers, or executable coordinators.
- Presentational components should receive callbacks from composition/executable owners, not from advisory modules.

### Linting Concepts

Future lint rules can forbid:

- `executeWorkspaceQuery` imports outside approved executable owners
- export controller imports outside export/composition surfaces
- runtime persistence imports from advisory modules
- `setActiveResultTab` and result setters inside advisory folders
- backend API imports inside advisory folders

### Runtime Assertions

Runtime assertions can be added later at boundary crossings:

- advisory continuation selected without execution
- executable action requires user-triggered event
- runtime graph node creation does not mutate workspace state
- AI-assisted output includes evidence references before display

### Review Checklist

Every future intelligence PR should answer:

- Is this advisory, executable, metadata-only, presentational, or hybrid?
- Can this code call the backend?
- Can this code mutate results?
- Can this code persist workspace/runtime/session state?
- Does it depend on user action before execution?
- Are confidence and evidence references explicit?
- Are protected surfaces untouched?

### Protected Dependency Rules

Protected dependencies should require explicit review:

- imports of `executeWorkspaceQuery`
- imports of `useExportController`
- imports of result setters from advisory modules
- imports of runtime persistence from advisory modules
- imports of SQL execution hooks outside SQL workspace
- imports of dataset restore controllers outside composition roots

## S2 Implementation Roadmap

### S2-A: Boundary Taxonomy And Documentation

Files to create/change:

- documentation only, or a small type-only contract file if implementation is approved later

Responsibilities:

- formalize advisory, executable, metadata-only, persistence, presentational, orchestration, and hybrid labels
- document protected surfaces
- document side-effect owners

Validation:

- no behavior changes
- no executable code changes

Risk: low.

### S2-B: Type-Level Boundary Contracts

Files to create/change:

- possible `frontend/src/features/governance/boundaryTypes.ts`
- advisory contract additions only where safe

Responsibilities:

- introduce `CapabilityMode`
- introduce advisory/executable/metadata-only capability flags
- annotate future-facing contracts without changing behavior

Validation:

- `npm.cmd run build`
- targeted lint
- protected-file diff review

Risk: medium-low if type-only and additive.

### S2-C: Protected Import And Review Enforcement

Files to create/change:

- lint configuration or lightweight repository scripts, if the project tooling supports it
- governance checklist docs

Responsibilities:

- detect forbidden advisory imports
- document approved executable owners
- protect runtime graph metadata-only boundaries
- protect continuation contracts from executable callback fields

Validation:

- `npm.cmd run build`
- lint or script dry run
- no UI behavior changes

Risk: medium. Tooling changes can create workflow friction, so begin with advisory warnings before hard failures.

## Recommended First Implementation Slice

Implement S2-A first.

Recommended prompt:

> Implement S2-A only. Add a lightweight governance taxonomy and side-effect ownership document or type-only boundary taxonomy without changing runtime behavior. Do not modify executable paths, UI rendering, routing, ResultsGrid, ActiveResultModel, executeWorkspaceQuery, exports, SQL/Monaco, workbook/session restore, runtime persistence, narrative scanners, or runtime graph persistence.

Do not start with lint enforcement. The architecture needs shared vocabulary before automated rules.

## Preservation Guarantees

Future S2 implementation must preserve:

- `executeWorkspaceQuery`
- `ResultsGrid`
- `ActiveResultModel`
- SQL/Monaco behavior
- exports
- filtering and query execution
- pagination and sorting
- workbook/session restore
- upload persistence
- runtime persistence
- Human/Analyst switching
- routing/back behavior
- runtime graph metadata-only behavior
- deterministic narrative behavior
- continuation metadata advisory-only behavior

## Final Position

S1 made `App.tsx` healthier. S2 should now prevent a more subtle risk: advisory intelligence slowly gaining executable power without an explicit governance boundary.

The safest architecture is one where advisory systems can make FiltraQueri smarter, but only executable owners can change the workspace, call the backend, export data, or persist execution-affecting state.
