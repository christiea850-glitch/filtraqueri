# UX-F10: Home + Data Cleanup

## Purpose

UX-F10 aligns the Home and Data screens with the canonical workspace blueprint after UX-F9 shell alignment. This phase is page-specific UX cleanup only and preserves execution/runtime behavior.

## Implementation Summary

- Made Home continuation-first when a dataset is already loaded.
- Home now shows a single "Continue where you left off" surface instead of loaded context plus onboarding.
- Home shows recent investigations only when there are useful non-current recent datasets.
- Kept the empty Home state focused on one open-data action.
- Simplified Data into a "What data do I have?" profile surface.
- Removed dataset filename, table name, row count, and column count from the Data page because the context strip owns those facts.
- Replaced the current dataset card with flatter profile sections:
  - detected structure
  - column type metrics
  - detected column list
  - workbook worksheet selector
- Removed the Recent files stack from the Data page.
- Collapsed deeper intelligence/guidance slots by default so Data starts with profile review rather than metadata density.

## Duplication Removed

- Home no longer shows open-data onboarding while a dataset is loaded.
- Data no longer repeats dataset name, worksheet, row count, or column count.
- Recent dataset metadata no longer appears on Data.
- Home recent investigations omit the currently loaded dataset.
- Open-data actions are no longer duplicated across loaded Home and Data states.

## Boundary Guarantees

UX-F10 does not:

- change backend APIs
- change `executeWorkspaceQuery`
- change Query Builder logic
- change request shapes
- mutate `ActiveResultModel`
- change `ResultsGrid`
- change pagination
- change exports
- change Monaco behavior
- change SQL draft restore
- change upload/session restore
- change workbook switching logic
- change Human/Analyst switching logic
- change runtime persistence
- change routing or back behavior
- change continuation wrappers

## Regression Checks

Recommended checks:

- Build the frontend.
- Open Home with no dataset and confirm only clean open-data onboarding appears.
- Upload a dataset and return to Home; confirm continuation appears instead of onboarding.
- Click Home continuation and verify it opens Data or Results based on workspace state.
- Open a recent investigation from Home.
- Open Data and confirm dataset facts are not repeated outside the context strip.
- Review detected columns and worksheet selector.
- Switch worksheets and confirm workbook switching still works.
- Clear the current session from Data.
- Delete a dataset from Data.
- Review Results pagination/export and Query Builder run behavior after Data changes.

## Deferred To UX-F11

- Explore screen business-question cleanup.
- Build/Query Builder further density reduction.
- Better approve-before-run hierarchy.
- More explicit guided question sequencing.
- Further removal of duplicate metadata inside Explore/Build components.
