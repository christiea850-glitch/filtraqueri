# UX-F9: Shell Alignment

## Purpose

UX-F9 applies the canonical workspace blueprint to the shared FiltraQueri shell. This phase stabilizes the top bar, navigation sidebar, context strip, right investigation rail, and shared spacing rhythm without changing page-specific workflows or runtime behavior.

## Implementation Summary

- Aligned the top bar around workspace identity, Human/Analyst toggle, and global Settings access.
- Removed non-canonical top-bar narration and extra shell controls.
- Kept the workspace identity compact and free of duplicated dataset summaries.
- Simplified the left sidebar into navigation only.
- Removed recent-file metadata and open-data action blocks from the sidebar.
- Preserved the canonical context strip as the only visible owner of dataset, worksheet, row/column count, mode, and focus.
- Refocused the right rail around current step, suggested next action, investigation trail, continuation paths, and collapsed technical metadata.
- Reduced gradient wash and muted shell surfaces for a flatter enterprise workspace feel.

## Duplication Removed

- Dataset metadata no longer appears in the sidebar.
- Recent file row/column counts no longer compete with the context strip.
- Top bar no longer repeats dataset identity.
- Right rail no longer starts with broad narrative framing.
- Investigation trail is visible as the rail-owned path, while continuation actions stay grouped below it.

## Boundary Guarantees

UX-F9 does not:

- change backend APIs
- change `executeWorkspaceQuery`
- change Query Builder logic or request shapes
- mutate `ActiveResultModel`
- change `ResultsGrid`
- change exports
- change pagination
- change Monaco behavior
- change SQL draft restore
- change upload/session restore
- change workbook switching
- change Human/Analyst switching logic
- change runtime persistence
- change routing or back behavior
- change continuation wrappers
- introduce AI execution, generated SQL, autonomous planning, or optimization execution

## Regression Checks

Recommended checks:

- Build the frontend.
- Open the app with no dataset and confirm the shell stays stable.
- Upload or restore a dataset and confirm the context strip owns dataset facts.
- Switch Human/Analyst modes from the top bar.
- Navigate between Home, Data, Explore, Build, Results, Analyst, and Settings from the sidebar.
- Use the top-bar Settings button.
- Collapse and expand the sidebar.
- Collapse and expand the investigation rail.
- Use a trail item and continuation action from the right rail.
- Confirm Results pagination, sorting, column visibility, and export remain unchanged.
- Confirm Query Builder run behavior remains unchanged.
- Confirm Monaco SQL draft restore remains unchanged.

## Deferred To UX-F10

- Home continuation and recent investigation cleanup.
- Data page dataset profile simplification.
- Loaded versus empty state cleanup.
- Dataset/workbook presentation cleanup inside page-specific Data surfaces.
- Further removal of duplicated dataset details inside non-shell components.
