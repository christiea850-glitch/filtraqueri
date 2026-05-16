# UX-F22 Structural Data Intelligence Cleanup

## Summary

UX-F22 adds a presentation-only structural intelligence layer for uploaded workbooks and tables. It improves Human Mode readability without changing backend ingestion, source schemas, execution requests, filtering keys, exports, pagination, or result models.

## What Changed

- Added display-only column profiling in `structuralPresentation.ts`.
- Generic imported names such as `column_2` can now show inferred business labels such as `Invoice Number`, `Customer`, `Location`, `Date`, or `Amount`.
- Results, Filters, Query Builder, and Data column lists show business-readable labels while preserving original source names in tooltips or secondary text.
- Results rows are classified for likely report structure such as title rows, repeated headers, separators, blank rows, and report labels.
- Structural spreadsheet rows remain present and exportable, but are visually softened in the grid.
- Data page now exposes lightweight Human Mode semantic hints for likely business fields.
- Data, Explore, Build, and Results receive flatter, calmer chrome consistent with the canonical layout hierarchy.

## Preservation

The cleanup is presentation-only. It does not change:

- `executeWorkspaceQuery`
- Query Builder request logic
- `ActiveResultModel`
- `ResultsGrid` data behavior
- Monaco/editor behavior
- SQL restore
- workbook/session restore
- exports
- pagination
- routing/back behavior
- Human/Analyst switching
- upload/session persistence
- workbook switching
- investigation trail behavior

Original column names remain the keys used for filtering, sorting, grouping, query requests, column visibility, copying, and export payloads.

## Validation Notes

Required validation:

- `npm run build`
- inspect workbook uploads with report/title/header rows
- confirm active result export still uses original active result rows/columns
- confirm filters and grouping still send original column keys
- confirm Analyst Mode remains technically unchanged
- confirm no horizontal overflow or routing regressions
