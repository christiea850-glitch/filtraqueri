> Status
> Historical phase plan with current-direction mapping. This document preserves implementation rationale from its original phase terminology; `docs/strategy/FILTRAQUERI_PRODUCT_DIRECTION.md` controls current navigation, roadmap, and execution-governance direction.

# UX-CORE-2 - Phase B Workspace Question Surface Plan

## Document Status

Planning, audit, and implementation preparation only.

No application code, backend logic, SQL execution behavior, Query Builder behavior, SQL Workspace behavior, ResultsGrid behavior, ActiveResultModel behavior, pagination, export, upload/session restore, runtime persistence, routing, command channels, or governance contracts are changed by this document.

## Current-Direction Mapping

Original phase terminology remains in this document for historical context. Current product interpretation is:

| Original phase concept | Current product interpretation |
| --- | --- |
| Investigation surface | Contextual Investigation workflow within Explore. |
| Open Investigations navigation | Historical navigation wording; Explore is the user-facing workspace and no top-level Investigation tab is restored. |
| Query Builder | Current SQL and analysis workflow surfaced through Analyst and Ask FiltraQueri where applicable. |
| Prepare answer | Manual, readiness-gated progression; no automatic Insert, no automatic Run, and no execution permission from preview alone. |
| Workspace-owned typed question | Explore-owned user-facing question shaping after grounding, with analytical meaning carried by the canonical BusinessSqlQueryPlan in later SQL planning. |

The canonical BusinessSqlQueryPlan is the sole source of analytical meaning after grounding for SQL work. No downstream layer may independently reinterpret the original question. Production database execution requires future PS-Exec policy gates.

Reference: `docs/DOCUMENT_INDEX.md`.

## Authoritative Sources Reviewed

- `UX_UI_AUDIT/ux-core-2-workspace-question-to-answer-core-loop-plan.md`
- `UX_UI_AUDIT/ux-core-2-phase-a-execution-path-audit.md`
- `UX_UI_AUDIT/filtraqueri-operational-ux-charter.md`
- `UX_UI_AUDIT/ux-core-1-slice-1-data-tab-charter-enforcement-plan.md`
- `docs/governance-hard-fail-rules.md`
- `docs/governance-review-checklist.md`
- `docs/s2-advisory-vs-executable-boundary-audit.md`
- `frontend/src/App.tsx`
- `frontend/src/features/dataset/datasetTypes.ts`
- `frontend/src/features/dataset/useDatasetSessions.ts`
- `frontend/src/features/workspaceRuntime/runtimePersistence.ts`
- `frontend/src/components/query-builder/VisualQueryBuilderPanel.tsx`
- `frontend/src/features/query-builder/useQueryBuilderController.ts`

## Executive Summary

Phase B should establish Explore/Workspace ownership for typed business questions without introducing translation or execution.

The safest first implementation was a non-executable question surface mounted in the existing Human `queryBuilder` view. In the app state reviewed for this historical phase, `queryBuilder` was the Workspace-like surface users reached through "Open Investigations" and Human guidance actions. Under current product terminology, read that navigation wording as legacy implementation language rather than a restored top-level Investigation product area. Adding a new `ActiveView` such as `"workspace"` in Phase B would create avoidable risk because `ActiveView` is referenced by session restore, runtime persistence validation, command navigation, Runtime Context, and App view registries.

Therefore, Phase B should:

- create a Workspace-owned typed-question panel
- host it above the existing `VisualQueryBuilderPanel` inside the Human `queryBuilder` view
- store draft state locally only
- show active dataset and worksheet/source context
- provide starter prompts as input-fill buttons only
- show a non-executable review shell after "Prepare answer"
- explicitly state that no query has run yet
- avoid SQL generation, Query Builder request generation, LLM calls, backend calls, result mutation, persistence writes, and route changes

This phase is a product ownership correction: business questions begin in the Explore/Workspace flow, not Data. It is not yet the ask-and-answer engine.

## Current Workspace Audit

### Current Workspace Surface

There is no separate `ActiveView` named `workspace` today. The closest current Workspace-owned Human surface is:

- `ActiveView` value: `"queryBuilder"`
- App registry owner: `humanViewRegistry.queryBuilder` in `frontend/src/App.tsx`
- Rendered component: `VisualQueryBuilderPanel`
- Navigation command: `nav:analyze`, titled "Open Investigations", calls `openHumanView("queryBuilder")`
- Human guidance actions often route to `"queryBuilder"` for "Build summary", "Choose columns", "Build trend", and similar flows

Under the Operational UX Charter's original phase terminology, this surface is doing Workspace work: shaping fields, filters, grouping, comparisons, review, and eventual query execution. Under current product terminology, read that as Explore-owned question shaping with Analyst depth available where appropriate.

### Route / View Ownership

Current route/view ownership is state-based rather than URL route-based:

- `ActiveView` is defined in `frontend/src/features/dataset/datasetTypes.ts`.
- `useDatasetSessions` owns `activeView`, `setActiveView`, and `updateDatasetSessionView`.
- `runtimePersistence.ts` validates known active views.
- `App.tsx` owns command launcher navigation and view rendering.

Phase B should not add a new `ActiveView` because that would require coordinated updates to:

- `datasetTypes.ts`
- runtime persistence view allowlists
- runtime context/navigation adapters
- dataset/session restore behavior
- App navigation commands
- possibly sidebar/nav labeling

That is outside the safe Phase B boundary.

### Available Active Dataset Context

Inside `App.tsx`, `humanViewRegistry.queryBuilder` already has access to:

- `dataset`
- `dataset.schema`
- `dataset.original_filename`
- `dataset.table_name`
- `dataset.dataset_id`
- `dataset.workbook_metadata`
- `activeWorkbookWorksheet`
- `activeFilterLabels`
- Query Builder state and callbacks
- `workspaceMode`
- `investigationReport`
- `analysisPackagePlan`
- `investigationWorkspacePlan`
- `isRunningQuery`
- `errorMessage`

The Phase B question surface needs only a small subset:

- `dataset`
- `activeWorkbookWorksheet` display name/sheet name
- optional active filter count for context only

It should not receive:

- `executeWorkspaceQuery`
- `runVisualQuery`
- result setters
- `activeResultModel` mutation callbacks
- export callbacks
- runtime persistence setters
- SQL workspace metadata setters

## Safe UI Insertion Point

Recommended insertion point:

```text
App.tsx
-> humanViewRegistry.queryBuilder
   -> QuestionWorkspacePanel
   -> VisualQueryBuilderPanel
```

The first implementation should render `QuestionWorkspacePanel` immediately above `VisualQueryBuilderPanel` for Human Mode only.

Why this is safe:

- It uses the existing Workspace-like view.
- It avoids adding/changing routes.
- It avoids runtime persistence allowlist changes.
- It avoids changing Query Builder behavior.
- It lets Workspace own the typed-question moment before execution features exist.
- It keeps Data out of question ownership.

The panel must be non-executable. Its button may update local review-shell state only.

## Proposed Non-Executable UX

### Purpose

The question surface should answer:

> What business question should FiltraQueri prepare to answer?

It should not yet answer the question.

### Suggested UI Copy

Title:

- `Ask a business question`

Subtitle:

- `Start with what you want to learn. FiltraQueri will prepare a reviewable plan before anything runs.`

Input label:

- `Business question`

Input placeholder:

- `Ask about this dataset...`

Examples as input-fill prompts:

- `Which customers generate the most revenue?`
- `Which properties are underperforming?`
- `What changed most recently?`
- `Which realtor manages the most properties?`

Primary button:

- `Prepare answer`

Disabled / no dataset state:

- `Open a dataset before preparing a question.`

Review shell title after submit:

- `Review shell`

Review shell body:

- `FiltraQueri will prepare an analysis plan here in a later checkpoint.`
- `No query has run yet.`
- `Generated logic, field mapping, and execution approval are intentionally not active in this phase.`

### Visual Behavior

The panel should feel like an entry point, not a chatbot and not a dashboard card wall.

Recommended behavior:

- one compact surface
- a single text area or input
- one primary action
- 3-4 starter prompt buttons that fill the input only
- a quiet dataset context row
- a non-executable review placeholder after submit
- no generated code block
- no result table
- no confidence badges
- no metadata-heavy cards

## Draft State Model

Phase B state should be local and non-persistent.

Recommended state shape:

```ts
type QuestionDraftStatus = "idle" | "drafted";

type WorkspaceQuestionDraft = {
  rawQuestion: string;
  draftStatus: QuestionDraftStatus;
  activeDatasetId: string | null;
  activeWorksheetName: string | null;
  createdAt: string | null;
};
```

### Field Rules

`rawQuestion`

- user-entered text
- starter prompts may populate it
- trimmed before entering drafted state
- no interpretation
- no SQL
- no Query Builder request

`draftStatus`

- `"idle"` before user prepares a question
- `"drafted"` after clicking `Prepare answer` with non-empty question and active dataset
- no `"running"`, `"ready"`, `"translated"`, or `"executed"` states yet

`activeDatasetId`

- copied from `dataset.dataset_id`
- used only for display/audit clarity
- not persisted
- not used for backend calls

`activeWorksheetName`

- derived from active workbook worksheet display/sheet name when present
- otherwise `dataset.table_name`
- display only

`createdAt`

- timestamp when draft is created
- local UI metadata only
- no runtime persistence

### State Location

Safest first implementation:

- keep local `useState` inside `QuestionWorkspacePanel`

Do not add:

- runtime persistence
- dataset session persistence
- backend storage
- URL/hash routing
- command launcher state
- ActiveResultModel state

## Review-Shell Behavior

The review shell is a placeholder for later phases. It should not imply execution readiness.

It may show:

- entered question
- active dataset name
- active source/worksheet
- created timestamp
- "No query has run yet"
- "Generated logic will appear in a later checkpoint"

It must not show:

- generated SQL
- generated Query Builder request
- field mappings
- detected intent
- confidence
- result preview
- "Run answer"
- "View logic"
- "Ready" state
- LLM output

Reason:

- Phase B establishes ownership and interaction rhythm only.
- Phase C/D will introduce interpretation and planning.
- Phase E will introduce approved execution through existing execution owners.

## Starter Prompt Rules

Starter prompts are allowed only as input-fill helpers.

Allowed:

- small inline buttons
- fill `rawQuestion` when clicked
- no execution
- no route change
- no classification
- no confidence score
- no generated preview

Forbidden:

- card wall
- hardcoded questions as main UX
- advisory result claims
- "recommended" confidence badges
- task launcher behavior
- direct Query Builder state mutation
- backend calls

Recommended prompt source for Phase B:

- local static array inside `QuestionWorkspacePanel`

Do not reuse Data-tab `useBusinessQuestions` output in Phase B, because that would blur Data/Workspace ownership and reintroduce the generic advisory-card pattern.

## Data / Workspace Boundary Rules

Data may continue to show lightweight hints such as:

- possible measures
- timeline fields
- entity candidates
- questions this data may support
- one bridge toward Workspace

Data must not:

- render the typed-question input
- prepare question drafts
- classify business-question intent
- generate logic
- show execution readiness
- call Workspace execution

Workspace owns:

- typed question
- active question draft
- later interpretation
- later generated logic
- later approval
- later execution through existing owners
- later result review

For Phase B, Workspace owns only the question draft and review shell.

## Files Likely To Change In Implementation

### Expected Additions

`frontend/src/components/workspace/QuestionWorkspacePanel.tsx`

- new presentational/local-state component
- imports React state only
- imports dataset types only as needed
- no backend imports
- no execution imports
- no result imports

Possible style file:

- existing workspace/layout CSS file if one already owns Workspace surfaces, or
- a narrow addition to the current app stylesheet used by Workspace components

Style additions should be minimal and scoped to the new panel.

### Expected Edits

`frontend/src/App.tsx`

- import `QuestionWorkspacePanel`
- render it above `VisualQueryBuilderPanel` in `humanViewRegistry.queryBuilder`
- pass dataset and active worksheet/source context only

Optional barrel export if workspace components use one:

- `frontend/src/components/workspace/index.ts`

Only add export if this is the established local pattern.

## Files That Must Not Change

Phase B must not change:

- `backend/app/main.py`
- backend storage/session/upload logic
- `frontend/src/features/execution/executeWorkspaceQuery.ts`
- `frontend/src/features/results/useResultExecutionCoordinator.ts`
- `frontend/src/features/results/activeResultModel.ts`
- `frontend/src/components/results/ResultsGrid.tsx`
- `frontend/src/features/export/useExportController.ts`
- `frontend/src/services/api.ts`
- `frontend/src/features/analyst/sql/useSqlWorkspace.ts`
- `frontend/src/features/analyst/sql/SqlWorkspace.tsx`
- SQL editor/Monaco files
- `frontend/src/features/query-builder/useQueryBuilderController.ts`
- `frontend/src/components/query-builder/VisualQueryBuilderPanel.tsx` behavior
- `frontend/src/features/dataset/useWorkspaceDatasetController.ts`
- `frontend/src/features/dataset/useDatasetSessions.ts`
- `frontend/src/features/workspaceRuntime/runtimePersistence.ts`
- Runtime Bridge / Runtime Intelligence metadata modules
- `TaskLauncherPanel`
- Data-tab task launcher wiring, except already approved copy/bridge language in separate slices

## Forbidden Changes

Phase B must not:

- generate SQL
- generate `QueryBuilderRequest`
- call `executeWorkspaceQuery`
- call backend APIs
- call LLMs
- mutate `ActiveResultModel`
- mutate ResultState
- set active result tabs
- call export
- change pagination
- change upload/session restore
- write runtime persistence
- add a new backend endpoint
- add a new route/view enum
- alter command launcher behavior
- remove Query Builder
- remove TaskLauncherPanel
- remove Human Mode wiring
- remove SQL Workspace behavior
- fabricate an answer
- show LLM-generated answer text

## Risks

### Risk 1: Accidentally Creating A Chatbot

If the surface looks like a conversation engine, users may expect answers immediately.

Mitigation:

- keep it as a single question preparation surface
- use "Prepare answer", not "Ask AI" or "Send"
- show "No query has run yet"

### Risk 2: Routing Ripple

Adding a new `ActiveView` would require updates across session restore, runtime persistence, command navigation, and runtime context.

Mitigation:

- mount inside existing `queryBuilder` view for Phase B
- defer route renaming/restructuring to a dedicated navigation phase

### Risk 3: Query Builder Behavior Coupling

The new surface could accidentally mutate Query Builder selections.

Mitigation:

- do not pass Query Builder setter callbacks into `QuestionWorkspacePanel`
- do not generate a plan yet

### Risk 4: Runtime Persistence Drift

Draft question state may be tempting to persist.

Mitigation:

- keep local component state only
- no runtime persistence changes in Phase B

### Risk 5: Data/Workspace Boundary Regression

Data still has question-like hints, and the new Workspace surface could duplicate them.

Mitigation:

- starter prompts fill input only
- Data hints remain lightweight
- Workspace owns the typed question

### Risk 6: Misleading Review Shell

If review shell language sounds ready, users may think a plan exists.

Mitigation:

- explicitly state generated logic appears later
- avoid readiness/confidence wording

## Preservation Checks

Implementation must preserve:

- routing/back behavior
- existing `ActiveView` union
- command launcher behavior
- upload/session restore
- worksheet switching
- runtime persistence schema
- SQL Workspace behavior
- Query Builder behavior
- `executeWorkspaceQuery`
- `useResultExecutionCoordinator`
- ActiveResultModel
- ResultsGrid
- result tabs
- result pagination
- export behavior
- TaskLauncherPanel
- Human/Analyst switching
- backend query validation

## Build And Manual Verification Steps

After implementation, run:

```sh
npm.cmd run build
```

Recommended optional governance check:

```sh
npm.cmd run governance:audit
```

Manual verification:

1. Open a dataset.
2. Navigate to the current Explore/Analyst entry that opens the legacy Investigations / Query Builder surface.
3. Confirm the question surface appears above the existing Query Builder.
4. Type a question.
5. Click a starter prompt and confirm it fills the input only.
6. Click `Prepare answer`.
7. Confirm the review shell appears.
8. Confirm no result tab changes.
9. Confirm no query runs.
10. Confirm ResultsGrid remains unchanged.
11. Confirm export remains unchanged.
12. Confirm SQL Workspace still opens and runs as before.
13. Refresh/restore session and confirm no new persistence behavior is required.

## Recommended First Implementation Checkpoint

Implement only:

1. Add `QuestionWorkspacePanel.tsx`.
2. Add local `rawQuestion` and `draftStatus` state.
3. Add active dataset/source context display.
4. Add starter prompts as input-fill buttons.
5. Add `Prepare answer` button that only changes local draft state.
6. Add review-shell placeholder.
7. Mount the panel above `VisualQueryBuilderPanel` in Human `queryBuilder` view.
8. Add minimal scoped styles.
9. Run build.

Do not:

- add a new route
- add a new view enum
- touch execution files
- touch result files
- touch backend files
- add interpretation
- add SQL/Query Builder draft generation
- persist draft state

## Definition Of Done

Phase B is complete only when:

- Workspace has a visible typed-question surface.
- The surface is mounted in the existing Workspace-like Human `queryBuilder` view.
- Users can type their own question.
- Starter prompts only fill the input.
- `Prepare answer` creates a local non-executable draft state.
- The review shell clearly says no query has run yet.
- No SQL is generated.
- No Query Builder request is generated.
- No LLM is called.
- No backend API is called.
- No ActiveResultModel or ResultState is mutated.
- ResultsGrid is unchanged.
- pagination/export are unchanged.
- upload/session restore are unchanged.
- runtime persistence is unchanged.
- SQL Workspace behavior is unchanged.
- TaskLauncherPanel is untouched.
- Data does not gain any new business-question behavior.

## Final Planning Position

Phase B should make the product direction visible without increasing execution risk.

The correct first move is not intelligence, SQL, or automation. It is ownership: the user should see that business questions now begin in Workspace. The surface should feel calm, answer-focused, and preparatory, while the system remains technically inert until later checkpoints add interpretation and governed execution.
