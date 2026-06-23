# T-20A Inspect SQL Main Page Final Polish Audit

## Scope

This is an audit and design recommendation only. No UI, runtime, SQL, Insert, Run Query, backend/API, ranking, relationship, or planner behavior was changed.

## Files Inspected

- `frontend/src/features/analyst/sql/SqlWorkspace.tsx`
- `frontend/src/features/analyst/sql/SqlEditorPanel.tsx`
- `frontend/src/features/analyst/sql/sqlAskFiltraQueriAdapter.ts`
- `frontend/src/features/analyst/sql/sqlRelationshipReview.ts`
- `frontend/src/features/analyst/sql/sqlSingleTableTemplateAdapter.ts`
- `frontend/src/styles/sql.css`
- Related workspace/navigation files discovered under `frontend/src/features/analyst`

## Current Main Page Shape

After T-18, the Inspect SQL page is much cleaner. Relationship review and planning details now use focused views, and the main Ask result area avoids showing the full internal reasoning list for relationship-blocked questions.

The main editor view still renders these layers above or around the SQL editor:

1. Analyst page banner and page heading.
2. SQL tab row.
3. Ask FiltraQueri bar.
4. Ask result section, including guidance, relevant worksheets, compact relationship blocker, recommended analysis, adapted template evidence, or template fallback.
5. This tab's task scope card.
6. Source line and command bar with dialect, Run Query, Result Preview, Save Query, Saved Drafts, and Clear.
7. Source mismatch and dialect advisory messages when present.
8. SQL readiness check card.
9. Business SQL idle/planning status card.
10. SQL editor.
11. Editor footer.
12. Schema rail.

The remaining density is mostly vertical stacking. The page is not exposing the old full relationship/planning detail payloads inline, but it still asks users to process several separate "context/status/control" blocks before reaching the editor.

## Remaining Density Issues

### Ask Result Area

The relationship-blocked case is appropriately compact: one main blocker with `Review worksheet connections`. The non-blocked case can still become dense because adapted template evidence, primary recommended analysis, fallback recommendations, and worksheet cards can all appear as distinct card-like surfaces.

Recommendation: keep Ask as an action surface. It should show the user's prompt, one answer/blocker summary, one primary action, and only the minimum context needed to understand why.

### Relevant Worksheets

Relevant worksheets currently render as cards with worksheet name, table name, confidence, rows, columns, and matched columns. This is useful, but on the main page it competes with the source/scope strip and schema rail.

Recommendation: render relevant worksheets as compact pills by default. Show the worksheet name and maybe a count, confidence, or matched-column hint only when it materially changes the action. Keep full worksheet metadata in scope/source popovers or detail views.

### Task Scope

`This tab's task scope` is currently a full card with a title, active tab title, manage button, summary paragraph, chips, and helper copy. It is important for safety because tab-local scope prevents users from confusing one tab's worksheet context with another's.

Recommendation: preserve scope visibility but compress it into a source/scope strip. Keep the applied scope, pending selection warning, selected template chip, and `Manage worksheet scope` action. Move explanatory helper text into the scope popover or an info tooltip/disclosure.

### Source Line and Command Bar

The source line and command bar are already colocated, but the dialect selector has helper text and draft-conversion messaging that can increase height. The action set is appropriate: Run Query, Result Preview, Save Query, Saved Drafts, Clear.

Recommendation: make this the single command bar for execution context and actions. It should include source, scope summary, dialect, readiness state, Run Query, Result Preview, Save Query, Saved Drafts, and Clear. Secondary helper copy should appear only when needed.

### SQL Readiness Check

The readiness card is safety-relevant, but a full card can push the editor down, especially when status is ready or only informational.

Recommendation: render readiness as an inline status chip beside Run Query for ready/informational states. Expand to a warning card only when there are actionable issues. Keep warning summaries and issue counts visible before running.

### Planning Status

Planning details now live in the focused `planning-details` view. The main page still shows a full planning status card with a badge, paragraph, and `View planning details`.

Recommendation: reduce this to a small planning link/chip when planning details exist. Suggested shape: `Planning details available` plus `View planning details`. Keep the full planning copy inside the focused view.

### Page Header

The Inspect SQL page currently has both an analyst page banner and a page heading before the main workspace. These are useful for orientation, but together they add height above the working surface.

Recommendation: consider reducing to one compact heading in the SQL workspace, especially once users are already inside the Analyst workspace.

### Schema Rail

The schema rail remains a valuable reference surface. It should stay visible, collapsible, and aligned with the editor. Avoid moving schema into the main vertical scroll.

## What Should Remain Visible Above The SQL Editor

These should remain visible because they are action-relevant or safety-relevant:

- SQL tabs and active tab identity.
- Ask FiltraQueri input and submit button.
- One compact Ask answer/blocker summary after Ask is submitted.
- Relationship review action when worksheet connections block insertion.
- Safe adapted-template Insert action when all T-17K guards pass.
- Applied worksheet/source context.
- Pending scope/source mismatch warning when present.
- Dialect selector or current dialect.
- Manual Run Query button.
- Result Preview, Save Query, Saved Drafts, and Clear actions.
- Readiness status, with warnings prominent when present.

## What Can Be Condensed

These can become smaller without losing user understanding:

- Relevant worksheet cards can become compact worksheet pills.
- `This tab's task scope` can become a source/scope strip.
- Source line and scope summary can share one execution context row.
- SQL readiness can become a command-bar status chip except for warnings.
- Planning status can become a small link/chip.
- Ask fallback recommendation cards can remain hidden unless there is a safe insertable action or the user opens details.
- Repeated explanatory helper copy can move into popovers, focused views, or tooltips.

## Proposed Main Page Structure

Recommended final structure:

1. Compact SQL workspace header and tabs.
2. Ask FiltraQueri bar.
3. Compact Ask response:
   - Relationship-blocked: one blocker and `Review worksheet connections`.
   - Safe adapted SQL: one primary recommendation, short helper, `Insert SQL`.
   - No clear match: one concise guidance line.
4. Worksheet/source/scope strip:
   - Applied worksheets.
   - Executable source.
   - Pending scope/source warnings.
   - `Manage worksheet scope` and `Change source`.
5. Command bar:
   - Dialect.
   - Readiness chip.
   - Run Query.
   - Result Preview.
   - Save Query.
   - Saved Drafts.
   - Clear.
6. SQL editor.
7. Editor footer.
8. Schema rail.

This keeps the main page as an action surface and leaves review/audit material in focused detail views.

## Proposed User-Facing Copy

Relationship blocker:

- Title: `Review worksheet connections before inserting SQL`
- Body: `FiltraQueri understands the analysis, but worksheet connections need review before SQL can be inserted.`
- Action: `Review worksheet connections`

Planning status chip:

- `Planning details available`
- Action: `View planning details`

Readiness chip:

- Ready: `Ready to run`
- Warning: `Review before running`
- Info: `Readiness note`

Scope strip:

- `Scope: Tenants, Units`
- `Source: Cleaned Tenants`
- `2 worksheets selected`
- `Manage scope`
- `Change source`

Safe adapted SQL:

- Badge: `Adapted template`
- Status: `Ready to insert`
- Helper: `FiltraQueri matched this template to the selected worksheet. Review before inserting.`
- Action: `Insert SQL`

## Safety Boundaries

The final polish must preserve these rules:

- Run Query remains manual.
- Insert SQL remains explicit and guarded.
- Relationship-blocked questions cannot insert SQL.
- Relationship review remains read-only.
- Planning detail views remain read-only.
- Detail views remain available for relationship review and planning details.
- No backend/API/provider calls are added.
- No source/scope mutation happens outside existing explicit controls.
- No SQL generation, adaptation, or renderer contract changes.
- No Ask ranking/order changes.
- No Browse Templates/Browse Reports behavior changes.
- No Result Preview behavior changes.

## Proposed Implementation Slices

### T-20B: Compact Worksheet/Source/Scope Strip

Replace the full `This tab's task scope` card with a compact strip that combines applied scope, executable source, selected template chip, pending scope warning, `Manage worksheet scope`, and `Change source`. Keep existing popovers and state ownership unchanged.

### T-20C: Command Bar And Readiness Condensation

Fold readiness into the command bar as a status chip for ready/info states. Preserve a larger warning surface only when the readiness report includes actionable issues. Keep Run Query manual and unchanged.

### T-20D: Compact Relevant Worksheets And Ask Blocker Polish

Render relevant worksheets as pills in the Ask response. Keep the single relationship blocker for blocked cases. Avoid showing row/column/matched-column cards inline unless the user opens a detail surface.

### T-20E: Editor-First Layout Polish

Reduce duplicate page heading height and tighten vertical spacing so the editor appears closer to the top after Ask and safety context. Keep the schema rail aligned with the editor.

### T-20F: Fixture/Build Verification And Final UI Audit

Run `npm.cmd run fixtures:sql`, `npm.cmd run build`, and a final targeted UI audit. Add fixture coverage where practical for compact main-page states, relationship blocker visibility, readiness warnings, and unchanged insert/run behavior.

## Recommendation

Proceed with T-20B first. The source/scope area is the largest remaining standalone card and is directly adjacent to the command bar. Condensing it into a strip will improve density without changing Ask logic, relationship review, planning details, SQL insertion, or Run Query.
