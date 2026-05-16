# S2-B3 Hybrid & Protected Surface Governance Audit

## Purpose

This audit identifies the remaining hybrid-risk modules and protected surfaces after S2-B1 and S2-B2 governance annotation adoption.

This is documentation only. It does not add runtime governance, lint enforcement, assertions, imports, wrappers, or behavior changes.

## Executive Finding

FiltraQueri now has a useful governance vocabulary for advisory and metadata-only systems. The next risk is not missing labels on advisory modules; it is accidentally treating hybrid composition modules as advisory or allowing advisory metadata to cross into executable owners without a user-driven boundary.

S2-C should therefore focus on lint-only and review-only enforcement first. Runtime governance should not be introduced yet.

## Classification Summary

### Advisory

- `frontend/src/features/narrativeIntelligence`
- `frontend/src/features/workflowRecommendations`
- `frontend/src/features/businessSemantics`
- `frontend/src/features/investigationIntelligence`
- `frontend/src/features/analysisPackages`
- `frontend/src/features/analysisPlan`
- `frontend/src/features/planningReadiness`
- `frontend/src/features/taskPlanPreview`
- `frontend/src/features/explanations`
- `frontend/src/features/businessQuestionIntelligence`
- `frontend/src/features/kpiIntelligence`
- `frontend/src/features/analyticsPlanning`
- `frontend/src/features/analyticsIntentGraph`

These modules should remain deterministic and non-executing.

### Metadata Only

- `frontend/src/features/runtimeIntelligence`
- runtime graph contracts
- runtime continuations
- runtime confidence
- runtime artifacts
- runtime events

These modules should never execute, persist, schedule, replay, or mutate workspace state.

### Executable

- `frontend/src/features/execution/executeWorkspaceQuery.ts`
- `frontend/src/features/results/useResultExecutionCoordinator.ts`
- `frontend/src/features/export/useExportController.ts`
- SQL workspace execution behavior
- backend upload/query/session/workbook routes

These modules own user-driven side effects.

### Persistence

- `frontend/src/features/workspace/workspacePersistence.ts`
- `frontend/src/features/workspaceRuntime/runtimePersistence.ts`
- `frontend/src/features/sqlWorkspacePersistence`
- `frontend/src/features/dataset/useDatasetSessions.ts`
- workspace manifests and backend storage

These modules save and restore state within defined ownership boundaries.

### Composition

- `frontend/src/features/workspace/useWorkspaceIntelligenceReports.ts`
- `frontend/src/features/workspace/workspaceOrchestration.ts` for snapshot builders and coordination helpers
- `frontend/src/features/workspace/useWorkspaceOrchestrationSnapshot.ts`
- `frontend/src/features/analyst/analystWorkspaceHelpers.ts`
- analyst workspace registry assembly

These modules assemble state or callbacks. Some are pure composition; some are hybrid because they coordinate execution records.

### Hybrid

- `frontend/src/App.tsx`
- `frontend/src/features/workspaceRuntime/useWorkspaceRuntimeCoordinator.ts`
- `frontend/src/features/dataset/useWorkspaceDatasetController.ts`
- `frontend/src/features/workspace/workspaceOrchestration.ts`
- `frontend/src/features/analyst/sql/useSqlWorkspace.ts`
- `frontend/src/features/analyst/analystWorkspaceHelpers.ts` when rendering SQL workspaces with execution callbacks
- `frontend/src/features/investigationWorkspace`

Hybrid modules need careful review because they sit between advisory metadata, persistence, routing, and executable behavior.

### Protected

- `executeWorkspaceQuery`
- `ResultsGrid`
- `ActiveResultModel`
- `useResultExecutionCoordinator`
- `useExportController`
- SQL/Monaco files
- dataset/session/workbook restore paths
- runtime persistence
- `App.tsx` mode/view switching
- runtime intelligence graph metadata contracts
- narrative deterministic scanners

These should not receive runtime governance or enforcement wrappers.

## Hybrid-Risk Inventory

### `frontend/src/App.tsx`

Classification: hybrid, composition, protected.

Why hybrid:

- assembles shell, views, mode switching, dataset/session controllers, result controllers, runtime context, export controller, and SQL renderers
- still owns Human insight guidance, Human insight navigation, and back-target behavior
- wires user actions to executable owners
- passes advisory reports into presentational surfaces

Risk:

- Human guidance can configure Query Builder, change tabs, switch views, and update runtime persistence
- Analyst renderer callback records SQL execution metadata
- view registry callbacks mix advisory context display with executable actions

Future extraction path:

1. Keep `App.tsx` protected during S2-C.
2. Add review-only governance notes outside `App.tsx`, not imports inside it.
3. Later audit Human insight coordination separately.
4. Extract Human guidance only after route/mode/runtime behavior has regression coverage.

Safe extraction order:

1. documentation-only governance note
2. Human insight planning audit
3. Human insight coordinator extraction
4. optional view registry componentization

### `frontend/src/features/workspace/workspaceOrchestration.ts`

Classification: composition, hybrid, protected helper.

Why hybrid:

- creates pure snapshots and ids
- coordinates execution result recording through `coordinateExecutionResult`
- can update active result state through supplied callback

Risk:

- pure snapshot builders and execution coordination live in the same module
- future advisory modules may be tempted to import execution coordination helpers

Future extraction path:

1. Keep current behavior unchanged.
2. In a future planning phase, split pure snapshot builders from execution coordination helpers.
3. Add lint-only import rules after split, not before.

Safe extraction order:

1. document pure versus executable exports
2. create a pure `workspaceSnapshotBuilders.ts`
3. leave `coordinateExecutionResult` in a protected execution coordination module

### `frontend/src/features/workspace/useWorkspaceOrchestrationSnapshot.ts`

Classification: composition.

Why hybrid risk exists:

- consumes execution registry and active result state
- builds snapshots used by runtime context coordination

Risk:

- low immediate risk because it does not execute, persist, or mutate
- future replay/orchestration work may misread snapshots as execution triggers

Future extraction path:

- keep as composition-only
- annotate as composition only after S2-C lint guidance exists
- never add execution callbacks here

Safe extraction order:

1. metadata annotation only
2. lint rule allowing imports from result/execution types but forbidding executable function imports

### `frontend/src/features/workspaceRuntime/useWorkspaceRuntimeCoordinator.ts`

Classification: hybrid, persistence, composition, protected.

Why hybrid:

- loads and saves runtime persistence
- builds runtime context
- calls workspace orchestration snapshot hook
- routes runtime trail selection through mode and view setters

Risk:

- runtime intelligence metadata could be mistaken for executable runtime behavior
- trail selection changes view/mode and persists UI runtime state
- runtime context composition is close to future replay/orchestration language

Future extraction path:

1. Keep runtime persistence ownership here.
2. Keep runtime intelligence graph contracts metadata-only and separate.
3. Later split runtime context build from runtime persistence update if the hook grows.

Safe extraction order:

1. preserve as protected in S2-C
2. add lint rule forbidding `runtimeIntelligence` from importing `workspaceRuntime`
3. optionally annotate adjacent governance metadata only, not runtime assertions

### `frontend/src/features/dataset/useWorkspaceDatasetController.ts`

Classification: hybrid, executable, persistence, protected.

Why hybrid:

- coordinates upload, dataset activation, workbook worksheet switching, restore, manifest save, SQL metadata restore, query/filter reset, and preview result construction
- wraps preview outputs into execution records
- writes workspace manifests

Risk:

- high blast radius for session restore, workbook switching, upload persistence, result reset, and mode restore
- advisory systems could accidentally become restore inputs if future metadata is persisted without boundaries

Future extraction path:

1. Do not annotate or enforce during S2-C.
2. Add tests/manual matrix around upload, restore, workbook switching first.
3. Later split manifest persistence from upload/workbook action coordination.

Safe extraction order:

1. restoration behavior audit
2. manifest persistence coordinator extraction
3. upload/workbook action coordinator extraction
4. governance annotation after behavior coverage exists

### `frontend/src/features/results/useResultExecutionCoordinator.ts`

Classification: executable, protected.

Why protected:

- owns filtering, reset, query execution, pagination, sorting, result activation, loading flags, history, and execution registry attachment

Risk:

- any governance wrapper could change closure timing, loading behavior, query reuse, or tab activation

Future extraction path:

- do not add runtime governance
- optional future executable annotation only after lint-only governance is stable

Safe extraction order:

1. no changes during S2-C
2. optional adjacent governance file later
3. no runtime guards unless a separate execution-policy phase is approved

### `frontend/src/features/export/useExportController.ts`

Classification: executable, protected.

Why protected:

- builds export payloads, calls backend export API, creates browser object URLs, downloads CSV, records history

Risk:

- advisory package readiness could be confused with export execution readiness
- runtime enforcement around exports could break browser download behavior

Future extraction path:

- keep export action user-driven
- lint advisory modules away from export imports
- annotate only through adjacent metadata later

Safe extraction order:

1. protected import rule
2. adjacent governance note
3. no runtime wrapper

### `frontend/src/features/analyst/sql/useSqlWorkspace.ts`

Classification: hybrid, executable, advisory, persistence-adjacent, protected.

Why hybrid:

- stores SQL draft state
- persists SQL metadata through callbacks
- runs local SQL draft status transitions
- uses SQL intelligence diagnostics
- wraps placeholder SQL output into execution records
- supports Monaco/editor behavior through editor interface

Risk:

- SQL intelligence is advisory, while SQL workspace behavior is executable/persistent
- draft save/restore and execution-pending status are sensitive
- Monaco/editor behavior must remain untouched

Future extraction path:

1. Keep SQL intelligence advisory and separate.
2. Keep SQL workspace protected.
3. Audit SQL execution ownership before any governance annotations.

Safe extraction order:

1. lint advisory SQL intelligence away from execution helpers
2. document SQL workspace as hybrid protected
3. annotate only adjacent metadata after Monaco/draft regression checks exist

### `frontend/src/features/investigationWorkspace`

Classification: advisory, persistence-adjacent, metadata, hybrid.

Why hybrid:

- builds advisory investigation plans, recommendations, timelines, artifacts, and session metadata
- includes session storage utilities
- references narrative and runtime checkpoint metadata

Risk:

- persisted advisory checkpoints could be mistaken for execution history
- future continuation automation may target this layer

Future extraction path:

1. Separate advisory builders from storage utilities if growth continues.
2. Keep advisory checkpoints clearly distinct from execution events.
3. Add metadata-only annotations before persistence enforcement.

Safe extraction order:

1. annotate builders as advisory
2. annotate session storage as persistence later
3. forbid executable callback fields in continuation/session metadata

## Protected-Surface Inventory

### `executeWorkspaceQuery`

Protected because it is the canonical backend query execution boundary. Governance should never wrap this in S2. Future enforcement should restrict who may import it.

### `ResultsGrid`

Protected because it owns visible grid behavior, sorting callbacks, pagination callbacks, hidden columns, empty states, and result rendering. It should not receive governance imports or runtime checks.

### `ActiveResultModel`

Protected because it normalizes result state for grid rendering, export payloads, grouping, filters, sorting, and pagination. Governance should not alter its shape.

### `useResultExecutionCoordinator`

Protected because it owns executable result behavior. Any timing change can affect filtering, query execution, history, pagination, sorting, and result activation.

### `useExportController`

Protected because it owns export payload creation, backend export calls, CSV download, object URL lifecycle, and export history.

### SQL/Monaco Files

Protected because editor behavior, draft restore, SQL metadata, diagnostics, and execution-pending behavior are tightly coupled.

### Dataset/Session/Workbook Restore

Protected because upload, recent datasets, workbook worksheet switching, manifest restore, SQL metadata restore, and result reset all converge here.

### Runtime Persistence

Protected because it controls runtime panel state, selected trail item, selected contextual object, task selection, and return continuation metadata.

### Runtime Intelligence Graph Contracts

Protected as metadata-only. They should never gain execution ownership or persistence side effects.

### Narrative Deterministic Scanners

Protected as advisory. They should remain deterministic and should not be connected to AI generation or executable actions.

## Modules That Should Never Receive Runtime Governance

These modules may have documentation, lint rules, or adjacent metadata, but should not receive runtime guards/wrappers:

- `executeWorkspaceQuery`
- `ResultsGrid`
- `ActiveResultModel`
- `useResultExecutionCoordinator`
- `useExportController`
- SQL/Monaco editor components
- `runtimePersistence`
- backend route handlers
- runtime intelligence graph contract files
- narrative detector/scanner files

Reason: runtime governance could change timing, identity, object shapes, editor behavior, or execution behavior.

## Safe For Future Lint-Only Governance

These are good candidates for import-boundary checks:

- advisory modules importing `executeWorkspaceQuery`
- advisory modules importing export helpers
- runtime intelligence importing persistence or React hooks
- continuation metadata containing callback/function fields
- SQL intelligence importing SQL workspace execution hooks
- presentational components importing backend API services
- composition modules importing backend API services directly

Lint should begin as warnings or a separate audit script before becoming a hard gate.

## Safe For Future Metadata Annotations Only

These can receive adjacent static governance constants later:

- `useWorkspaceOrchestrationSnapshot`
- `workspaceIntelligenceReportsGovernance` style companion files
- `ResultsInvestigationSurface`
- `RuntimeDisclosureSlot`
- simple history/upload/display panels
- investigation workspace builders
- relationship-aware planning builders
- workbook intelligence builders

Avoid modifying protected files directly when an adjacent `*.governance.ts` file would work.

## Future Enforcement Strategy

### Phase 1: Import Boundary Audit

Add an audit script or lint concept that reports:

- advisory-to-executable imports
- metadata-only-to-persistence imports
- metadata-only-to-React-hook imports
- presentational-to-backend-service imports
- continuation metadata with function fields

No runtime behavior changes.

### Phase 2: Warning-Only Protected Dependency Rules

Define allowlists for:

- `executeWorkspaceQuery`
- export controller
- runtime persistence
- SQL execution hooks
- dataset restore controllers

Report violations as warnings first.

### Phase 3: Hard Lint Gates For Advisory And Metadata-Only Folders

Only after warning-only checks are stable:

- block advisory imports of executable owners
- block runtime intelligence imports of persistence/execution owners
- block callback fields in continuation contracts

Still no runtime assertions.

### Phase 4: Optional Metadata Completeness Checks

Check that new advisory feature folders include static governance annotations.

This should be a repository hygiene check, not runtime behavior.

## Recommended Governance Enforcement Order

1. Protect runtime intelligence metadata-only boundaries.
2. Protect advisory folders from executable imports.
3. Protect continuation contracts from executable callbacks.
4. Protect presentational components from backend service imports.
5. Protect composition modules from direct backend service imports unless explicitly allowed.
6. Add metadata completeness checks for new advisory features.
7. Consider adjacent executable annotations only after lint-only rules are stable.

Do not start with executable runtime wrappers.

## S2-C Direction

Recommended S2-C: protected import and review enforcement, lint-only.

S2-C should create a non-invasive governance check that answers:

- Can advisory modules import executable owners?
- Can metadata-only runtime graph modules import persistence or hooks?
- Are continuation contracts callback-free?
- Are protected executable surfaces untouched?

S2-C should not:

- modify runtime behavior
- add runtime assertions
- wrap `executeWorkspaceQuery`
- wrap export execution
- wrap SQL execution
- modify `ResultsGrid`
- modify `ActiveResultModel`
- modify restore/persistence logic

## Validation Position

This audit is documentation-only. No runtime code, executable paths, persistence, routing, SQL/Monaco behavior, result coordination, exports, or protected surfaces are changed by this S2-B3 pass.
