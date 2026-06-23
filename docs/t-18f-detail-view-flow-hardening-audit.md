# T-18F Detail View Flow Hardening Audit

## Scope

This audit covers the Inspect SQL detail-view flow added in T-18B through T-18E. It records the hardening checks performed for relationship review, planning details, compact Ask output, and safety boundaries. No routing, backend/API, SQL execution, SQL generation, ranking, relationship persistence, or planner/renderer contracts were changed.

## Verified Flow

- The main Inspect SQL page keeps the Ask input, relevant worksheets, compact relationship blocker, compact planning status, task scope/source controls, SQL editor, and manual Run Query controls in the main action surface.
- Relationship-blocked Ask output renders a single compact blocker on the main page through `compactRelationshipBlock`.
- The compact relationship blocker calls `onReviewRelationships`, which in `SqlWorkspace.tsx` stores the required relationship list and opens `focusedView: "relationship-review"`.
- The relationship detail view renders the existing `SqlRelationshipReviewPanel` from the existing `createSqlRelationshipReviewModel` output.
- Relationship detail remains read-only: there are no accept, persist, Insert SQL, Run Query, backend/API, or relationship mutation controls.
- Planning status on the main page renders as a compact `Planning status` card with `View planning details`.
- `View planning details` opens `focusedView: "planning-details"`.
- Planning detail renders the existing Business SQL preview/adaptive planning content in `planningDetailMode`.
- Planning detail hides preview Insert actions and does not expose Run Query.
- Back actions use the existing focused-view pattern and return with `setFocusedView("editor")`.
- Planning state that previously lived in `SqlEditorPanel` is now owned by `SqlWorkspace`, preserving Ask preview state, candidate preview state, feedback state, and inserted recommendation guard state across detail navigation.

## Fixture Coverage

The repository has many pure exported fixture functions under `frontend/src/features/analyst/sql/__tests__`, including Ask adapter, relationship review model usage, adaptive metadata/classifier, single-table adapter, result labeling/narration/provenance, and Business SQL planner/renderer fixtures.

There is no configured runnable test script in `frontend/package.json`; available scripts are `dev`, `build`, `governance:audit`, `lint`, and `preview`. There is also no installed Vitest/Jest/tsx runner in `frontend/node_modules/.bin`.

Because of that, T-18F relies on `npm.cmd run build` for TypeScript coverage of files included by `tsconfig.app.json`. The build includes `src`, so existing fixture modules are type-checked, but their exported fixture functions are not executed by a test runner.

## Remaining Gaps

- Component-level assertions for clicking `Review worksheet connections`, `View planning details`, and Back are not currently runnable without adding a test runner.
- DOM-level assertions that the main page renders exactly one relationship blocker are not currently practical in the existing fixture setup.
- State-preservation checks for SQL draft, tab source, worksheet scope, dialect, and Ask prompt need a component or integration harness.
- Visual regression coverage for the compact main page and focused detail views is not present.

## Next Phase Recommendation

Add a lightweight frontend test runner in a separate slice before further UI navigation work. The highest-value tests would mount `SqlWorkspace` with a workbook fixture and assert:

- Relationship-blocked Ask shows one compact blocker.
- Relationship detail opens and lists full worksheet pairs.
- Planning detail opens and shows preview/adaptive detail content.
- Back preserves Ask prompt, SQL draft, selected dialect, tab/source context, and worksheet scope.
- Detail navigation does not call Run Query, Insert SQL, backend/API, or relationship persistence handlers.
