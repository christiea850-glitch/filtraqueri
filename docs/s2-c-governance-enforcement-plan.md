# S2-C Governance Enforcement Plan

## Purpose

This planning audit defines a safe, non-runtime governance enforcement strategy for FiltraQueri based on:

- `docs/s2-advisory-vs-executable-boundary-audit.md`
- `docs/s2-b-governance-annotation-adoption-plan.md`
- `docs/s2-b3-hybrid-protected-surface-governance-audit.md`

This is audit-only documentation. It does not add scripts, lint rules, runtime wrappers, assertions, imports, or behavior changes.

## Executive Recommendation

Start with a standalone warning-only governance audit script.

Do not begin with custom ESLint rules or hard failures. A script can inspect imports and contract files without changing the app, without touching protected runtime code, and without forcing immediate workflow friction. Once the report is stable, selected rules can graduate into lint enforcement.

Recommended first mechanism:

- `frontend/scripts/audit-governance-boundaries.mjs`
- optional npm command later: `npm run governance:audit`
- warning-only output in S2-C1
- no runtime imports
- no runtime assertions
- no protected executable changes

## Why Warning-Only First

Governance enforcement is new and the codebase has legitimate hybrid modules. Hard-failing too early risks blocking normal development around allowed composition surfaces.

Warning-only enforcement lets the team:

- tune allowlists safely
- identify false positives
- preserve developer workflow
- validate advisory/executable boundaries without runtime behavior changes
- keep protected surfaces untouched

Hard-fail enforcement should come only after warnings are clean and reviewers agree on the allowlists.

## Enforcement Mechanism Options

### Standalone Script

Recommended for S2-C1.

Pros:

- no runtime behavior impact
- can be warning-only
- can inspect imports, paths, and simple source patterns
- can be run locally or in CI later
- does not require custom ESLint plugin setup

Cons:

- separate from normal lint until wired into npm scripts
- pattern-based checks need careful allowlists

### ESLint Rule Or Config

Recommended later, not first.

Pros:

- integrates with existing `npm run lint`
- can become a consistent gate

Cons:

- higher setup cost
- easier to over-enforce
- may need custom plugin/rule structure
- hard to tune without disrupting workflow

### Documentation Checklist

Recommended immediately as supporting process.

Pros:

- zero tooling risk
- useful for architecture review
- clarifies hybrid exceptions

Cons:

- cannot catch regressions automatically

### NPM Command

Recommended after the standalone script exists.

Pros:

- creates a repeatable command
- CI-ready later

Cons:

- should not be added until the script output is stable

## Protected Import Rules

### Rule 1: Advisory Modules Must Not Import Executable Owners

Advisory folders should not import:

- `frontend/src/features/execution/executeWorkspaceQuery`
- `frontend/src/features/export/useExportController`
- `frontend/src/features/results/useResultExecutionCoordinator`
- `frontend/src/features/dataset/useWorkspaceDatasetController`
- `frontend/src/features/dataset/useDatasetSessions`
- `frontend/src/features/workspaceRuntime/runtimePersistence`
- `frontend/src/features/analyst/sql/useSqlWorkspace`
- `frontend/src/services/api`

Advisory folders include:

- `narrativeIntelligence`
- `workflowRecommendations`
- `businessSemantics`
- `dataIntelligence`
- `investigationIntelligence`
- `analysisPackages`
- `analysisPlan`
- `analyticsPlanning`
- `analyticsIntentGraph`
- `businessQuestionIntelligence`
- `kpiIntelligence`
- `planningReadiness`
- `relationshipAwarePlanning`
- `taskPlanPreview`
- `explanations`
- `engineAdapters`
- `sqlIntelligence`
- `workbookIntelligence`
- `workbookRelationships`

Initial severity: warning.

### Rule 2: Runtime Intelligence Must Stay Metadata-Only

`frontend/src/features/runtimeIntelligence` must not import:

- React runtime hooks such as `useState`, `useEffect`, or `useMemo`
- executable owners
- persistence modules
- backend API services
- workspace runtime persistence
- dataset/session restore controllers
- result execution coordinators
- export controllers

Allowed imports:

- local runtime intelligence files
- TypeScript types from governance or domain contracts
- deterministic helper functions that do not execute or persist

Initial severity: warning, then hard-fail candidate.

### Rule 3: Continuation Metadata Must Not Contain Callback Or Function Fields

Continuation contracts should not include field names such as:

- `callback`
- `handler`
- `onClick`
- `onRun`
- `onExecute`
- `execute`
- `run`
- `dispatch`
- `mutation`
- `effect`

The rule should inspect:

- `frontend/src/features/runtimeIntelligence/continuations`
- narrative continuation metadata
- investigation workspace recommendations and timeline metadata
- analysis package recommendations

Initial severity: warning.

### Rule 4: Presentational Components Must Not Import Backend Services

Presentational folders should not import:

- `frontend/src/services/api`
- executable feature owners
- persistence owners

Presentational folders include:

- `frontend/src/components`
- presentational feature components such as `tasksLauncher` display components
- `RuntimeDisclosureSlot`

Initial severity: warning.

### Rule 5: Composition Modules Must Not Import Backend Services Without Allowlist

Composition modules should avoid direct backend service imports unless explicitly allowlisted.

Likely allowed composition/hybrid modules:

- `useWorkspaceDatasetController`
- SQL workspace owner if still using metadata callbacks
- future explicitly approved execution coordinators

Initial severity: warning.

## Allowlist Strategy

Allowlist entries should be narrow and path-specific. Avoid broad patterns that would hide real boundary drift.

### Approved Hybrid Allowlist

Initial allowlist:

- `frontend/src/App.tsx`
  - may import executable owners for composition
  - should not be linted as advisory
- `frontend/src/features/results/useResultExecutionCoordinator.ts`
  - may import `executeWorkspaceQuery`
  - may coordinate result mutation and history
- `frontend/src/features/export/useExportController.ts`
  - may import backend export service
- `frontend/src/features/dataset/useWorkspaceDatasetController.ts`
  - may import backend dataset/workspace services
  - may import workspace persistence
  - may wrap preview execution output
- `frontend/src/features/analyst/sql/useSqlWorkspace.ts`
  - may use SQL intelligence and SQL persistence metadata callbacks
  - may wrap SQL placeholder execution output
- `frontend/src/features/workspaceRuntime/useWorkspaceRuntimeCoordinator.ts`
  - may import runtime persistence
  - may change view/mode through supplied callbacks
- `frontend/src/features/workspace/workspaceOrchestration.ts`
  - may coordinate execution records until pure snapshot helpers are split

### Approved Type-Only Allowlist

Some advisory and metadata-only modules may import type-only contracts from protected domains when needed:

- dataset metadata types
- active result model types
- result type definitions
- query-builder type definitions
- governance boundary types

The audit script should distinguish `import type` from runtime imports where possible.

### Disallowed Broad Allowlists

Avoid:

- allowing all imports from `features/execution`
- allowing all imports from `features/dataset`
- allowing all imports from `services/api`
- allowing all imports from `workspaceRuntime`
- allowing all React imports in metadata-only folders

## Recommended File Locations

### Script

Preferred:

- `frontend/scripts/audit-governance-boundaries.mjs`

Rationale:

- keeps tooling close to frontend imports
- can use Node file-system APIs without build changes
- avoids touching runtime source

### Configuration

Preferred:

- `frontend/scripts/governance-boundary-rules.mjs`

Rationale:

- keeps rule lists and allowlists separate from scan logic
- easier to review changes to protected boundaries

### Documentation

Preferred:

- `docs/s2-c-governance-enforcement-plan.md`
- possible future `docs/governance-review-checklist.md`

### NPM Command

Later only:

```json
{
  "scripts": {
    "governance:audit": "node scripts/audit-governance-boundaries.mjs"
  }
}
```

Do not add the npm command until the script exists and warning-only output is accepted.

## S2-C1: Warning-Only Boundary Audit Script

Files to create/change:

- `frontend/scripts/audit-governance-boundaries.mjs`
- `frontend/scripts/governance-boundary-rules.mjs`
- optional documentation update

Responsibilities:

- scan imports in advisory folders
- scan imports in `runtimeIntelligence`
- scan presentational component imports
- report continuation callback/function field patterns
- apply path-specific allowlists
- output warnings only

Do not change:

- `package.json`
- runtime source files
- executable owners
- persistence files

Validation:

- run script manually with `node scripts/audit-governance-boundaries.mjs`
- confirm warnings are understandable
- confirm no runtime code diffs

Risk: low.

## S2-C2: NPM Command And Review Checklist

Files to create/change:

- `frontend/package.json`
- `docs/governance-review-checklist.md`
- possibly update `governanceREADME.md`

Responsibilities:

- add `npm run governance:audit`
- keep command warning-only
- document reviewer checklist:
  - advisory modules cannot execute
  - metadata-only modules cannot persist or import hooks
  - continuations cannot carry callbacks
  - protected executable surfaces remain untouched

Validation:

- `npm.cmd run governance:audit`
- `npm.cmd run build`
- targeted lint if docs/config changed

Risk: medium-low because `package.json` changes affect workflow.

## S2-C3: Optional Hard-Fail For Metadata-Only And Advisory Boundaries

Files to create/change:

- governance audit script/config
- possibly CI config if present later

Responsibilities:

- hard-fail only high-confidence rules:
  - `runtimeIntelligence` importing execution/persistence/React hooks
  - advisory modules importing `executeWorkspaceQuery`
  - continuation contracts containing function/callback fields

Keep warning-only:

- composition module backend imports
- presentational callback imports
- hybrid module exceptions

Validation:

- `npm.cmd run governance:audit`
- `npm.cmd run build`
- review allowlist diff

Risk: medium. Do not implement until S2-C1 and S2-C2 have settled.

## Rules To Avoid In S2-C

Do not enforce:

- runtime assertions
- wrapper-based execution gates
- automatic route/action blocking
- governance checks inside React render paths
- governance checks inside `executeWorkspaceQuery`
- governance checks inside `ResultsGrid`
- governance checks inside SQL/Monaco components
- governance persistence in localStorage or backend manifests

## Protected Surfaces

Do not modify:

- `executeWorkspaceQuery`
- `ResultsGrid`
- `ActiveResultModel`
- `useResultExecutionCoordinator`
- export execution
- SQL/Monaco behavior
- dataset/session/workbook restore
- runtime persistence
- `App.tsx`
- backend route handlers

S2-C should observe these surfaces through static import checks only.

## Reporting Format Recommendation

The warning-only script should produce concise output:

```text
Governance boundary audit

Warnings:
- advisory-import-executable: narrativeIntelligence/foo.ts imports features/execution/...
- metadata-only-import-persistence: runtimeIntelligence/bar.ts imports workspaceRuntime/runtimePersistence
- continuation-callback-field: runtimeContinuations.ts contains field "onExecute"

Summary:
3 warnings, 0 errors
```

It should exit with code `0` during S2-C1 and S2-C2.

Only S2-C3 should consider non-zero exit codes.

## Final Recommendation

Implement S2-C1 first: a standalone, warning-only governance audit script with narrow allowlists and no npm command. Let it report boundary drift without affecting builds, routing, execution, persistence, Monaco, exports, or UI behavior.

After the warning output is stable, add an npm command and review checklist in S2-C2. Hard-fail only the most certain metadata-only and advisory boundary violations in S2-C3.
