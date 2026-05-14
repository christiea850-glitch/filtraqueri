# UX-F12: Results + Analyst Workspace Consolidation

## Purpose

UX-F12 aligns Results and Analyst workspaces with the canonical FiltraQueri workspace architecture and Claude review direction. This is a UX architecture cleanup phase only.

## Implementation Summary

- Made Results takeaway-first with a compact Business Takeaway surface.
- Added deterministic, metadata-only result insight surfaces:
  - top contributor prompt
  - highlight/anomaly prompt
  - supporting chart/table readiness
  - continuation suggestion
- Kept `ResultsGrid` unchanged underneath the review surface.
- Reduced Results metadata repetition by avoiding dataset/workbook identity outside the context strip.
- Kept result-specific metadata limited to source, result rows, filters/sort, export readiness, and collapsed technical metadata.
- Added an Analyst SQL inspection overview above the existing SQL workspace.
- Analyst overview now summarizes:
  - query draft presence
  - execution-plan/guidance note count
  - runtime adapter
  - readiness
  - warnings
- Removed repeated dataset filename/table/row/column summary from the Analyst schema panel.
- Flattened SQL workspace surfaces for a calmer operational/technical feel.

## Duplication Removed

- Results no longer leads with generic runtime narration.
- Results does not repeat dataset name or worksheet.
- Analyst schema panel no longer repeats dataset filename, table name, row count, or column count.
- Analyst overview uses runtime/query-specific inspection facts only.

## Boundary Guarantees

UX-F12 does not:

- change backend APIs
- change `executeWorkspaceQuery`
- change Query Builder execution logic
- change Query Builder request shapes
- mutate `ActiveResultModel`
- change `ResultsGrid` logic
- change pagination
- change exports
- change Monaco execution behavior
- change SQL restore behavior
- change upload/session restore
- change workbook switching
- change Human/Analyst switching logic
- change runtime persistence
- change routing or back behavior
- change continuation wrappers
- introduce AI execution, generated SQL, autonomous planning, or optimization execution

## Regression Checklist

Recommended checks:

- Build the frontend.
- Open Results with preview, filtered, and query result tabs.
- Confirm Business Takeaway changes deterministically by result source/grouping/filter metadata.
- Sort results.
- Paginate results.
- Change rows per page.
- Hide/show columns.
- Export active results.
- Expand/collapse Results supporting context.
- Open Analyst SQL workspace.
- Confirm Monaco loads and edits normally.
- Restore SQL drafts.
- Save draft.
- Explain query.
- Run query through the existing SQL control.
- Collapse/expand schema and preview side panels.
- Switch Human/Analyst modes and confirm routing behavior remains unchanged.

## Deferred To UX-F13

- Settings screen cleanup.
- Collapsed rail behavior for Settings.
- Quieter non-investigation surfaces.
- Final pass on empty/support states outside Results and Analyst.
