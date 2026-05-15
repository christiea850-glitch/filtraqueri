# UX-F20 True Wide Canvas Shell Reflow

## Summary

UX-F20 moves the workspace from a centered/narrow application frame to a canvas-first shell:

- Removed the global `#root` width cap so the application can use the full viewport.
- Slimmed the left navigation rail resize range and default width.
- Made the runtime investigation rail compact by default for new sessions.
- Kept Data, Build, Results, and Analyst canvases free of page-level max-width constraints.
- Docked Results supporting context behind a collapsed side rail by default.
- Docked Analyst schema and SQL side panels by default so Monaco owns the primary landscape workspace.

## Results Workspace

Results now prioritizes `ResultsGrid` width:

- The Results split pane gives the table the full central canvas when context is collapsed.
- Supporting result insight, dataset context, and history remain available from the context dock.
- Pagination, export, sorting, tab switching, column visibility, and `ActiveResultModel` wiring were not changed.

## Analyst Workspace

Analyst now behaves more like a wide editor workspace:

- The schema rail remains collapsed by default.
- Preview/context/runtime panels are docked by default.
- The Monaco editor receives the dominant width and taller landscape viewport.
- SQL draft restore, save, explain, run query, and Monaco behavior were not changed.

## Preservation

No backend APIs, request shapes, query execution contracts, workbook/session restore flows, routing/back behavior, Human/Analyst switching, continuation wrappers, or runtime persistence schema were changed. The work is limited to shell layout defaults, page docking behavior, and CSS reflow.
