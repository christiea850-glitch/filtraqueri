# T-18A Analyst Workspace Detail Navigation Audit

## Scope

This audit covers the current Inspect SQL workspace layout and proposes a safer detail-navigation model for planning and review surfaces. It is design-only. It does not change SQL execution, insertion, Ask ranking, relationship review logic, worksheet scope, renderer contracts, backend/API behavior, or UI runtime behavior.

## Files Inspected

- `frontend/src/features/analyst/sql/SqlWorkspace.tsx`
- `frontend/src/features/analyst/sql/SqlEditorPanel.tsx`
- `frontend/src/features/analyst/sql/sqlAskFiltraQueriAdapter.ts`
- `frontend/src/features/analyst/sql/sqlRelationshipReview.ts`
- `frontend/src/features/analyst/sql/businessSqlRenderPreview.ts`
- `frontend/src/features/analyst/sql/businessSqlQueryPlanner.ts`
- `frontend/src/features/analyst/sql/businessSqlRenderer.ts`
- `frontend/src/styles/sql.css`
- `frontend/src/App.tsx`
- `frontend/src/features/analyst/analystWorkspaceRegistry.ts`
- `frontend/src/features/analyst/analystWorkspaceHelpers.ts`

Note: the requested `frontend/src/features/analyst/sql/sql.css` path is not present in this checkout. The active SQL workspace stylesheet is `frontend/src/styles/sql.css`.

## Current Layout Problems

Inspect SQL currently mixes the primary SQL workflow with advanced review surfaces in one vertical flow. The same page can contain the Ask FiltraQueri input, recommended analysis, relevant worksheets, task scope controls, source controls, dialect controls, readiness checks, Business SQL preview, adaptive planning outline, plan candidate details, relationship review, the editor, and the schema rail.

`SqlWorkspace.tsx` already has full-page focused modes for result preview and saved drafts through `focusedView`. Relationship review, however, is currently opened in the bottom dock through `bottomTab`, which means detailed worksheet connection information competes with the editor instead of becoming a focused review surface.

`SqlEditorPanel.tsx` owns several dense sections:

- Ask FiltraQueri suggestions and recommended analysis cards.
- Adapted-template evidence.
- Task scope and worksheet source controls.
- SQL readiness checks.
- Business SQL preview and preview actions.
- Advanced planning details.
- Adaptive planning outline and plan candidate details.
- The editor and execution controls.

The stylesheet gives many of these sections full card treatments: `.sql-template-recommender`, `.sql-recommended-analysis-card`, `.business-sql-preview-panel`, `.business-sql-adaptive-proposal`, `.business-sql-plan-candidate-panel`, `.sql-relationship-review-panel`, and `.sql-readiness-guard`. Individually these are clear, but together they make the page feel like a stack of nested workspaces.

The normal user flow also risks exposing internal planning concepts too early. Business SQL renderer status, unsupported plan details, adaptive proposal rows, provider/payload disclosure, relationship pairs, and bridge issues are useful for review, but they should not dominate the main page.

## What Should Stay On The Main Inspect SQL Page

The main page should stay focused on the actions users came to Inspect SQL to perform:

- Ask FiltraQueri input and button.
- Relevant worksheets in compact form.
- Recommended analysis, with one primary card and at most one or two compact alternatives.
- A single relationship-needed summary and `Review worksheet connections` action when worksheet connections block SQL.
- Selected worksheet/source summary for the active SQL tab.
- SQL editor.
- Run Query controls.
- Compact SQL readiness status.
- Saved Drafts and Result Preview entry points.
- Schema rail as a reference companion, with its current collapse behavior.

The main page should show enough context to explain whether SQL is ready, insertable, or blocked, but it should not list detailed relationship pairs, renderer reasons, provider payload details, or full planning outlines by default.

## What Should Move To A Detail View

The following sections should move out of the main scroll and into a dedicated detail view:

- Relationship review details, including worksheet pairs, relevant worksheets, status, and suggested matching columns.
- Business SQL preview details, including rendered preview SQL, preview reasons, warnings, and copy/insert preview controls if those remain supported by existing safety gates.
- Advanced planning details for blocked or needs-review Business SQL preview states.
- Adaptive planning outline.
- Business SQL plan candidate details.
- Provider, metadata, and payload disclosure details.
- Detailed assumptions, warnings, bridge issues, and renderer readiness reasons.
- Any technical diagnostics that are not needed to write, inspect, or manually run SQL.

These details are still valuable. The recommendation is to make them explicitly navigated review surfaces instead of inline expansions in the primary editor flow.

## Recommended Navigation Model

Use an internal workspace detail mode in `SqlWorkspace.tsx` for the next implementation slice. This is safer than adding a real route first and more appropriate than a drawer for long planning content.

Suggested state shape:

```ts
type FocusedSqlView =
  | "editor"
  | "result"
  | "drafts"
  | "draft-detail"
  | "relationship-detail"
  | "planning-detail"
  | "sql-preview-detail";
```

Alternatively, keep `FocusedSqlView` for page-level screens and add a separate detail payload:

```ts
type SqlWorkspaceDetailView =
  | { kind: "relationship_review"; requiredRelationships: string[] }
  | { kind: "planning_details"; source: "business_sql" | "adaptive_proposal" }
  | { kind: "sql_preview_details"; planId: string | null }
  | null;
```

The second option is preferable because it can carry the minimum payload needed for each detail page without overloading every focused view.

The detail view should render inside the SQL workspace shell, not through `App.tsx` routing. `App.tsx` and the analyst registry already route at the workspace level (`sqlWorkspace`, `sqlTemplates`, `sqlReports`). A nested real route would create additional state-preservation work for drafts, Ask state, active tab source, and workbook scope. The current `focusedView` precedent for Result Preview and Saved Drafts is the right first step.

A drawer is not recommended for T-18B through T-18D. Relationship pairs, planning outlines, preview SQL, and provider disclosure need readable width and clear Back navigation. A drawer would reduce the editor width while still leaving a crowded page behind it.

## Back Navigation

Every detail view should have a primary Back action:

- `Back to SQL workspace`

Back should return to the editor view without resetting:

- SQL draft/editor value.
- Active SQL tab.
- Active tab source.
- Selected and applied worksheet scope.
- Ask FiltraQueri prompt.
- Ask recommendation state.
- Inserted recommendation state.
- Selected dialect.
- Business SQL preview attempt state.
- Relationship review requirements.
- Source mismatch warning state.
- Schema rail collapsed state.

The Back action should not run SQL, insert SQL, accept worksheet connections, persist relationships, or call backend/API endpoints.

## State Preservation Requirements

State should continue to be owned by the existing workspace and model layers:

- `useSqlWorkspace` should remain the source of truth for editor state, SQL tabs, scope selections, dialect, drafts, and execution status.
- `SqlWorkspace.tsx` should own only navigation state and detail-view payloads.
- `SqlEditorPanel.tsx` should continue to receive insert/run callbacks as props and should not create a second route-level state owner.
- Relationship review detail should derive from `createSqlRelationshipReviewModel` using the current dataset and required relationship list.
- Business SQL preview detail should derive from the existing `businessSqlRenderPreview` value.
- Planning detail should derive from existing Ask/preview models, not copy or persist separate planning state.

Detail-view payloads should prefer stable identifiers and small inputs, such as `requiredRelationships`, `planId`, or a detail kind. They should avoid storing copies of SQL draft text, worksheet metadata, result rows, or generated preview objects unless there is no existing owner.

## Safety Rules

The detail-navigation work should preserve current safety boundaries:

- Run Query stays manual and remains tied to the existing editor controls.
- Detail views must not run SQL.
- Detail views must not call backend/API endpoints.
- Detail views must not auto-insert SQL.
- Insert actions, where retained, must use the same existing insert guards and active-draft checks.
- Relationship review remains read-only.
- No relationship is accepted, persisted, dismissed, or marked confirmed from the detail view in these slices.
- Missing worksheet connections must continue blocking cross-worksheet SQL insertion.
- Business SQL renderer/readiness contracts must remain unchanged.
- Template adaptation and Ask recommendation ordering must remain unchanged.
- Raw internal planning details should be hidden from the normal main-page flow and shown only after an explicit detail action.

## Proposed User-Facing Copy

Main page actions:

- `Review worksheet connections`
- `View planning details`
- `View SQL preview details`
- `View analysis assumptions`

Detail page titles:

- `Worksheet connections`
- `SQL preview details`
- `Planning details`
- `Analysis assumptions`

Back action:

- `Back to SQL workspace`

Main page relationship summary:

- `Review worksheet connections before inserting SQL.`
- `FiltraQueri understands the analysis, but worksheet connections need review before SQL can be inserted.`

Planning detail helper:

- `Review how FiltraQueri interpreted the question before preparing SQL.`

SQL preview detail helper:

- `Preview SQL is for review only. Run Query stays manual from the SQL workspace.`

## Recommended Main Page Structure

1. Inspect SQL header, reduced to a compact workspace title.
2. SQL tab bar.
3. Ask FiltraQueri bar.
4. Compact Ask results:
   - Relevant worksheets.
   - Recommended analysis.
   - One relationship-needed action when relevant.
5. Task scope/source line in compact form.
6. Command bar with dialect, Run Query, Result Preview, Save Query, Saved Drafts, Clear.
7. Compact readiness check.
8. SQL editor.
9. Editor footer.
10. Schema rail.

The bottom dock can remain for SQL guidance in the short term, but relationship review should move to the detail view first.

## Recommended Detail View Structure

Each detail view should use a consistent frame:

1. Top row with `Back to SQL workspace`.
2. Detail title and short plain-language description.
3. Compact source context: active worksheet, active SQL tab, and task prompt if relevant.
4. Detail content.
5. Safety note when applicable.

For relationship review:

- Show relevant worksheets.
- Show all required worksheet connection pairs.
- Show status and suggested matching columns.
- Show read-only safety copy.
- Do not show confirmation controls yet.

For planning details:

- Show interpreted task shape.
- Show assumptions and warnings.
- Show plan candidate details.
- Show bridge/provider disclosure only in this detail context.
- Avoid making these details appear required for everyday SQL editing.

For SQL preview details:

- Show preview status.
- Show rendered preview SQL only when already available from existing safe preview logic.
- Show reasons and warnings.
- Keep Run disabled.
- Keep insertion governed by the same existing preview insert state if the action remains available.

## Proposed Implementation Slices

### T-18B: Add Internal Detail-View State Only

- Add a `SqlWorkspaceDetailView` state model in `SqlWorkspace.tsx`.
- Add placeholder detail page shell with `Back to SQL workspace`.
- Wire no-op or non-disruptive entry points only if needed for fixtures.
- Do not move relationship review or planning content yet.
- Add tests that Back preserves draft, Ask prompt, selected scope, active source, and SQL tabs.

### T-18C: Move Relationship Review Into Detail View

- Change `openRelationshipReview` to open the relationship detail view instead of the bottom relationship dock.
- Render `SqlRelationshipReviewPanel` inside the detail page.
- Keep the relationship model read-only.
- Keep detailed pairs and suggested columns out of the main Ask page.
- Verify no acceptance, persistence, backend/API call, SQL generation, or Run Query behavior is added.

### T-18D: Move Advanced Planning Details Into Detail View

- Replace inline `business-sql-advanced-details` expansion with `View planning details`.
- Move adaptive planning outline, Business SQL plan candidate, provider/payload disclosures, assumptions, warnings, and bridge issues into planning detail.
- Keep only compact status and action copy on the main page.
- Preserve existing renderer/readiness contracts.

### T-18E: Polish Main Inspect SQL Page Density

- Reduce duplicate header/banner copy.
- Keep Recommended analysis compact.
- Keep readiness compact.
- Make task scope/source controls less visually dominant when unchanged.
- Confirm the editor remains the visual center of the page.

### T-18F: Fixture And Visual Regression Hardening

- Add fixtures for detail navigation and Back state preservation.
- Add relationship review detail fixtures.
- Add planning detail fixtures.
- Add visual regression coverage for the main page in common expanded states.
- Assert no SQL is run, inserted, or generated through detail navigation.

## Test Recommendations

Future implementation tests should prove:

- Opening relationship detail preserves the active SQL draft.
- Back preserves Ask prompt, recommendation state, active tab source, selected/applied worksheet scope, and dialect.
- Relationship detail lists the same pairs currently produced by `createSqlRelationshipReviewModel`.
- Relationship detail is read-only and does not accept or persist relationships.
- Planning detail does not generate SQL.
- SQL preview detail does not run SQL.
- Existing Insert SQL guards still control every insert path.
- Existing exact template and adapted-template insert behavior is unchanged.
- Existing Run Query behavior is unchanged.
- No backend/API calls are introduced.

## Recommendation

Proceed with an internal detail-view mode first. It matches the existing `focusedView` architecture, avoids route-level state churn, gives long review content enough room, and keeps the main Inspect SQL page focused on asking, editing, and manually running SQL.
