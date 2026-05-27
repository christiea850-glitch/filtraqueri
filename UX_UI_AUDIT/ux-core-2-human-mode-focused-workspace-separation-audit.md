# UX-CORE-2 Human Mode Focused Workspace Separation Audit

## Document Status

Audit and planning only.

No application code, backend logic, Query Builder logic, ResultsGrid behavior, ActiveResultModel behavior, execution behavior, upload/session restore behavior, generated manifests, or backend contracts are changed by this document.

## Goal

Human Mode currently asks the user to move through too many stacked workflows inside one long `queryBuilder` page:

- ask a business question
- review suggested setup
- choose fields
- inspect Query Builder steps
- run the query
- review result context
- inspect advanced details

The correct next step is focused workspace separation, not a full redesign. The existing logic should stay intact while the UI route/page ownership becomes clearer:

```text
Investigate
-> Query Builder Review
-> Results
-> Advanced details
```

## Current Structure Audit

### App Composition

`frontend/src/App.tsx` is the current composition root for Human Mode. The Human `queryBuilder` view renders three layers in sequence:

- `renderHumanInsightBackButton()`
- `renderHumanIntentGuidance()`
- `QuestionWorkspacePanel`
- `VisualQueryBuilderPanel`

This makes `activeView === "queryBuilder"` serve as both:

- the Investigate/question preparation page
- the Query Builder review/execution page

`applyGovernedQueryBuilderRequestForReview` currently:

- rejects non-review drafts
- rejects drafts with filters
- restores the existing Query Builder state with `mapQueryBuilderRequestToReviewState`
- sets `preparedQuestionContext`
- clears any executed prepared-question context
- forces Human Mode
- navigates to `queryBuilder`
- shows the Query Builder review notice

This logic should remain the handoff boundary. The separation should change page ownership around it, not how it behaves.

### Question Workspace

`frontend/src/components/workspace/QuestionWorkspacePanel.tsx` currently owns:

- question input
- starter prompts
- dataset/source context
- schema-aware draft planning
- clarification choice state
- controlled logic draft creation
- governed Query Builder request draft creation
- suggested setup review
- candidate field details
- ambiguity details
- validation/blocking details
- request preview
- Apply to Query Builder for Review action

The component has the right logic but too much visible surface for one page. It should become the Investigate page body plus an advanced details disclosure/drawer.

### Query Builder Workspace

`frontend/src/components/query-builder/VisualQueryBuilderPanel.tsx` currently owns the actual editable review surface:

- selected fields
- measure/aggregation
- filters/scope review
- grouping
- sort/limit
- final review
- Run query

It also renders Human Mode orientation content such as "Explore question", "Start with the question", primary direction, and action rail. That content duplicates `QuestionWorkspacePanel` once a prepared draft exists.

The Query Builder should stay as the execution review page. Its logic, tabs, controls, and `onRunQuery` contract should not change.

### Results / Insights View

`frontend/src/components/results/ResultsInvestigationSurface.tsx` currently owns:

- answered-question traceability from `executedPreparedQuestionContext`
- key takeaway
- evidence rows
- next-move action rail
- follow-up/details disclosure
- hash-addressable result insight detail
- technical result details disclosure

`frontend/src/App.tsx` renders `ResultsInvestigationSurface` above `ResultsGrid`. This is a good boundary: the result page should own result meaning and the grid should remain canonical for the table.

### Right Guidance Rail

`frontend/src/components/layout/WorkspaceShell.tsx` shows the right guidance rail for the `analyze` and `insights` destinations. It is not shown for `home`, `data`, `analyst`, or `settings`.

Today the rail is destination-based:

- `queryBuilder` and `filters` map to `analyze`
- `results`, `history`, and `export` map to `insights`

This is useful and should remain. The page split should update labels and trail targeting so the rail reflects the focused page:

- Investigate: question shaping
- Query Builder Review: setup review and run boundary
- Results: finding review and next steps

### Hash / Detail Navigation

The existing controlled hash detail route pattern is already in place:

- `detail:results-insight`
- `detail:dataset-intelligence`

`ResultsInvestigationSurface` uses `openControlledHashDetailRoute`, `closeControlledHashDetailRoute`, and `subscribeControlledHashDetailRoute` for the result insight detail page.

Important constraints:

- controlled hash routes are detail routes only
- they are not a global routing migration
- restoration capability is `hash_addressable_only`
- route activation metadata is governed by navigation registry/integrity files

Advanced Human Mode details can follow this pattern later, but only if the route registry and activation metadata are updated intentionally. For the safest first implementation, advanced details should start as a drawer/disclosure owned by the page component rather than a new global route.

### Back Behavior

Existing back behavior support preserves:

- previous route
- scroll position
- selected item
- filters
- pagination
- expanded panels
- dataset/session/workbook context

The result insight detail page already models origin/back context without changing ResultsGrid or result state.

The focused page split should preserve browser/app back expectations:

- Investigate to Query Builder Review should feel like forward progress.
- Query Builder Review back should return to the prepared Investigate state.
- Results back should return to Query Builder Review when a prepared question was just executed.
- Closing advanced detail should return to the same page and preserve selections.

### Active View State

`frontend/src/features/dataset/datasetTypes.ts` currently defines `ActiveView` without a distinct Investigate or Query Builder Review route. `queryBuilder` is the only Human analyze route for both question prep and query review.

`useWorkspaceDatasetController` persists and restores `lastActiveView`, Query Builder state, filters, results, and session data. Any new focused page route that becomes an `ActiveView` will affect session restore and workspace manifest updates.

This is the main reason to avoid a large route split in the first code checkpoint.

## Recommended Focused Separation

### 1. Investigate Page

Purpose:

- ask the business question
- prepare the answer setup
- review suggested setup
- resolve clarification choices
- apply the governed draft to Query Builder Review

Should contain:

- Ask business question
- active dataset/source context
- starter prompts
- Prepare answer
- Review suggested setup
- Suggested interpretation
- Recommended fields
- Clarification choices
- filter-handoff blocked message, when applicable
- Apply to Query Builder for Review
- one safety line: "Nothing runs until you review and click Run query."

Should not contain:

- full Query Builder controls
- Run query
- ResultsGrid
- result review
- raw governance/debug state

### 2. Query Builder Review Page

Purpose:

- inspect and edit the exact Query Builder setup before execution
- run through the existing Query Builder path

Should contain:

- selected fields
- measure/aggregation
- grouping
- filters/scope review
- sort/limit
- review notice when a prepared draft was applied
- Run query
- collapsed Query details

Should not contain:

- question input
- starter prompts
- full suggested setup review from the Investigate page
- result review
- advanced candidate-field ambiguity details

Important: keep `VisualQueryBuilderPanel` as the owner of this logic. The first implementation should reorganize where it renders, not rewrite the Query Builder.

### 3. Results Page

Purpose:

- review what was answered after execution
- inspect the table through the existing ResultsGrid
- decide the next action

Should contain:

- Answered question
- logic source: Query Builder review
- key result summary
- compact result context
- ResultsGrid
- export/pagination controls where they already exist
- next suggested actions
- collapsed result details

Should not contain:

- editable Query Builder controls
- question preparation form
- raw request payloads in the main view
- a second table outside ResultsGrid

### 4. Advanced Details Drawer/Page

Purpose:

- inspect details that are useful for auditability but not required for the main business flow

Should contain:

- candidate fields
- ambiguity
- validation warnings
- blocking requirements
- request preview
- governance/debug details, if a debug/governance surface exists
- protected state, only outside normal Human Mode

Recommended first implementation:

- use a drawer or collapsed panel owned by Investigate/Results rather than adding a new route immediately
- preserve the existing controlled hash detail route pattern only for true detail pages
- add a hash route later only after route registry and activation metadata are intentionally extended

## Section Movement Inventory

### Stay On Investigate

- `Ask a business question`
- active dataset/source context
- starter prompts
- `Prepare answer`
- `Review suggested setup`
- question text
- suggested interpretation
- recommended selected dimension
- recommended selected measure
- recommended date field when relevant
- calculation summary
- sort/limit summary as suggested setup
- readiness status
- clarification choices
- suggested clarifying questions when blocking
- filter handoff warning
- `Apply to Query Builder for Review`

### Move To Query Builder Review

- Query Builder selected fields
- selected column search and selection controls
- selection shortcuts
- measure/aggregation controls
- group-by controls
- filter scope review
- sort controls
- row limit controls
- review-before-run strip
- request draft applied notice
- final review grid
- Query details disclosure
- Run query

### Move To Results

- answered question traceability
- logic source label
- key result/takeaway
- top contributor/highlight/supporting view facts
- result source facts
- next suggested actions
- follow-up details disclosure
- ResultsGrid
- ResultTabs
- export action
- pagination and sorting through existing ResultsGrid behavior

### Move To Advanced Details

- candidate dimensions
- candidate measures
- candidate date fields
- confidence labels
- ambiguous terms
- validation warnings
- blocking requirements
- full request preview:
  - selected columns
  - group by
  - aggregations
  - filters
  - order by
  - limit/page
- technical result details:
  - source tab
  - page
  - rows per page
  - export columns
- protected state
- governance/debug state

## Safest Implementation Plan

### Checkpoint 1: Presentation Split Without New ActiveView

Keep `activeView === "queryBuilder"` for now, but add a local Human analyze subpage state in `App.tsx`, for example:

```text
humanAnalyzeStage = "investigate" | "review"
```

Recommended behavior:

- destination `Investigate` opens the Investigate stage by default
- `Apply to Query Builder for Review` sets stage to `review`
- stage `investigate` renders `QuestionWorkspacePanel` only
- stage `review` renders `VisualQueryBuilderPanel` only
- no Query Builder logic changes
- no `ActiveView` union changes yet
- no session restore changes yet

This gives the user focused pages while minimizing persistence and route risk.

### Checkpoint 2: Results Handoff Polish

When `runReviewedQueryBuilder` succeeds with a prepared question:

- keep existing execution behavior
- keep existing `executedPreparedQuestionContext`
- consider navigating to `results` after a successful prepared-question run only if product wants an automatic answer flow
- otherwise keep the current behavior and show the review notice

The safer default is to preserve current execution/navigation behavior unless a follow-up implementation explicitly requests auto-navigation.

### Checkpoint 3: Advanced Details As Drawer/Disclosure

Extract the existing `details` content from `QuestionWorkspacePanel` into a focused presentational component or drawer:

```text
QuestionAdvancedDetails
```

Keep it collapsed by default. Do not create a new route in the first pass.

### Checkpoint 4: Optional Route Metadata Phase

Only after the presentation split is stable, consider adding real page route metadata:

- `page:investigate`
- `page:query-builder-review`
- optional `detail:question-advanced-details`

This would require coordinated updates to:

- `ActiveView`
- route registry
- destination mapping
- runtime navigation adapter context mapping
- session restore defaults
- workspace manifest current view persistence
- command launcher destinations

This is useful later, but not required to make the workspace feel focused.

## Route / Hash / Back Behavior Recommendation

### Short-Term Recommendation

Use local subpage state under the existing `queryBuilder` ActiveView.

Why:

- avoids changing upload/session restore
- avoids changing workspace manifest semantics
- avoids expanding the ActiveView union before behavior is proven
- keeps destination rail behavior stable
- keeps Query Builder execution path untouched

Back behavior:

- provide an in-app Back to Investigate button from Query Builder Review when a draft was applied
- preserve question draft state while the user reviews Query Builder setup
- do not use browser hash for this first split

### Medium-Term Recommendation

Promote focused stages to real views only after the UI split is validated:

```text
investigate
queryBuilder
results
```

or, if names should be explicit:

```text
investigate
queryBuilderReview
results
```

If `queryBuilderReview` is added, update `getContextualObjectIdForView` so both `investigate` and `queryBuilderReview` map to query-builder/analyze context.

### Hash Detail Recommendation

Do not use hash routes for the primary Investigate -> Review -> Results flow.

Use hash only for deep details, matching the existing controlled pattern:

- details are addressable
- details close back to the owning page
- details preserve context
- details are registered in navigation metadata before use

## Files Likely To Change

Likely in the first implementation:

- `frontend/src/App.tsx`
- `frontend/src/components/workspace/QuestionWorkspacePanel.tsx`
- `frontend/src/components/query-builder/VisualQueryBuilderPanel.tsx`
- `frontend/src/components/results/ResultsInvestigationSurface.tsx`
- `frontend/src/styles/query-builder.css`
- `frontend/src/styles/results.css`
- `frontend/src/App.css`

Possible component extraction:

- `frontend/src/components/workspace/QuestionAdvancedDetails.tsx`
- `frontend/src/components/workspace/QuestionSuggestedSetup.tsx`
- `frontend/src/components/workspace/HumanAnalyzeStageSwitcher.tsx`

Likely only in a later real-route phase:

- `frontend/src/features/dataset/datasetTypes.ts`
- `frontend/src/components/layout/WorkspaceShell.tsx`
- `frontend/src/features/navigation/routeRegistry.ts`
- `frontend/src/features/navigation/routedDetailActivation.ts`
- `frontend/src/features/workspaceRuntime/runtimeNavigationAdapter.ts`
- `frontend/src/features/workspaceRuntime/runtimeContext.ts`
- `frontend/src/features/dataset/useWorkspaceDatasetController.ts`

## Files That Must Not Change

Must not change for this focused separation:

- `backend/app/main.py`
- `backend/storage/manifests/*`
- `frontend/src/services/api.ts`
- `frontend/src/features/execution/executeWorkspaceQuery.ts`
- `frontend/src/features/results/activeResultModel.ts`
- `frontend/src/components/results/ResultsGrid.tsx`
- `frontend/src/features/results/useResultExecutionCoordinator.ts`
- `frontend/src/features/query-builder/useQueryBuilderController.ts`
- `frontend/src/features/questionWorkspace/schemaQuestionTranslator.ts`
- `frontend/src/features/questionWorkspace/questionLogicDraftBuilder.ts`
- `frontend/src/features/questionWorkspace/questionQueryBuilderRequestBuilder.ts`
- `frontend/src/features/questionWorkspace/questionQueryBuilderReviewMapper.ts`
- upload/session restore behavior
- SQL Workspace behavior
- backend contracts

## Risks And Safeguards

### Risk: Losing Prepared Question State

Safeguard:

- keep `QuestionWorkspacePanel` mounted or lift its draft state before switching to Query Builder Review
- do not clear `preparedQuestionContext` until execution succeeds, as current App logic does

### Risk: Breaking Query Builder Handoff

Safeguard:

- preserve `applyGovernedQueryBuilderRequestForReview`
- preserve `mapQueryBuilderRequestToReviewState`
- preserve the no-filters handoff guard
- keep `Run query` owned by `VisualQueryBuilderPanel`

### Risk: Session Restore Changes

Safeguard:

- do not add new `ActiveView` values in the first checkpoint
- do not change workspace manifest view persistence
- keep the first split local to the Human analyze surface

### Risk: Browser Back Becomes Confusing

Safeguard:

- avoid hash routes for primary flow in the first checkpoint
- provide explicit Back to Investigate / Review setup actions
- use existing controlled hash route only for advanced details later

### Risk: Advanced Details Re-enter The Main Flow

Safeguard:

- keep advanced details collapsed or drawer-based
- keep business-facing summary primary
- do not show protected governance/debug state in normal Human Mode

### Risk: Results Become A Second Query Builder

Safeguard:

- Results page should only review executed output
- keep all table behavior in ResultsGrid
- do not add editable query controls to Results

## Definition Of Done

The focused workspace separation is done when:

- Investigate shows question entry, suggested setup, clarification choices, and Apply to Query Builder for Review only.
- Query Builder Review shows selected fields, measure, grouping, filters, sort/limit, and Run query only.
- Results shows answered question, key result summary, ResultsGrid, and next actions only.
- Advanced details are collapsed or drawer-based and do not dominate the main flow.
- Applying a governed request still uses the existing Query Builder handoff.
- Running a query still uses the existing Query Builder execution path.
- Results still use ActiveResultModel and ResultsGrid.
- Upload, worksheet switching, recent dataset restore, workspace manifest restore, filters, export, and pagination behavior are unchanged.
- Generated manifest files are untouched.
- No backend code changes are required.
- Build and relevant frontend checks pass after implementation.

## Final Recommendation

Proceed in two layers:

1. First, split the Human analyze experience into local focused panels under the existing `queryBuilder` view.
2. Later, promote those panels to real route metadata only if session restore, runtime trail, and back behavior need addressable page-level navigation.

This gives the user fresh focused pages quickly while protecting the current Query Builder, execution, results, and restore logic.
