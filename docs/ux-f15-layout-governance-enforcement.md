# UX-F15: Layout Governance Enforcement Pass

## Purpose

UX-F15 implements the canonical workspace layout governance rules from `docs/ux-canonical-workspace-layout-specification.md`. This phase is an enforcement pass, not a redesign. It removes remaining shell/layout violations while preserving all execution, routing, result, Monaco, runtime, upload, workbook, and continuation behavior.

## Implementation Summary

- Removed the persistent `Mode` field from the canonical context strip.
- Simplified the workspace switcher to a single compact identity pill.
- Removed the lower duplicated sidebar workspace/subnav stack from the shell.
- Reduced right investigation rail density:
  - current step remains visible
  - suggested next action shows only the primary recommendation group
  - trail is compacted to the latest items
  - technical metadata remains collapsed
- Reduced Human Mode query progress clutter by hiding technical chips such as `Grouping active` and `Execution ready` outside Analyst Mode.
- Added layout enforcement CSS for wrapping chip/stat rows across Build, Results, and Analyst.
- Protected main canvas width by collapsing the right rail earlier on medium-width screens.
- Reduced Home hero typography to the canonical operational scale.
- Flattened detected column presentation into a scan-friendly list/table pattern.
- Improved Results table header readability by allowing column names to wrap cleanly.

## Files Changed

- `frontend/src/components/layout/WorkspaceShell.tsx`
- `frontend/src/components/query-builder/VisualQueryBuilderPanel.tsx`
- `frontend/src/styles/design-system.css`
- `docs/ux-f15-layout-governance-enforcement.md`

## Preservation Verification

UX-F15 does not change:

- routing or back behavior
- Query Builder execution
- `executeWorkspaceQuery`
- Query Builder request shapes
- `ActiveResultModel`
- `ResultsGrid` logic
- Monaco/editor behavior
- SQL draft restore
- upload/session restore
- workbook switching
- Human/Analyst switching logic
- continuation wrappers
- runtime persistence
- backend behavior

## Responsive And Layout Fixes

- Chip/stat rows now use wrapping layouts and `min-width: 0` safeguards.
- Context strip wraps with `auto-fit` columns and no longer carries the persistent Mode field.
- Right rail collapses to a compact rail at medium widths before squeezing the main canvas.
- Main canvas keeps priority at desktop/tablet widths.
- Detected columns use a single flat list with column/type alignment instead of a card cloud.

## Remaining Deferred Items

- Extract shared `ContextStrip`, `RailSection`, `StatusChip`, and `MetadataList` primitives after the enforcement rules settle.
- Add visual regression screenshots for Home, Data, Build, Results, and Analyst.
- Continue reducing legacy engine language inside lower-priority metadata-only panels.
- Consider a user-controlled rail auto-collapse preference in a later non-execution phase.
