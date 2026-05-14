# UX-F18: Canvas Dominance & Adaptive Rails

## Purpose

UX-F18 makes the center workspace the dominant FiltraQueri surface. The shell now behaves more like a productivity workspace: slim navigation, wide main canvas, and supporting rails that adapt around the active work.

This phase is presentation/layout only. It does not alter backend APIs, execution logic, Query Builder request shapes, `executeWorkspaceQuery`, `ActiveResultModel`, `ResultsGrid`, Monaco/editor persistence, SQL restore, upload/session restore, workbook switching, exports, pagination, Human/Analyst switching, routing/back behavior, continuation wrappers, or runtime persistence.

## Shell Philosophy

Canonical workspace balance:

```text
[ Slim Navigation ] [ Main Workspace Canvas ] [ Optional Supporting Rail ]
```

The main canvas owns the active analytical work. Sidebars and rails provide navigation or context only.

## Adaptive Rail Rules

- The left sidebar is narrower by default and keeps existing collapse behavior.
- The right investigation rail is visually lighter and narrower.
- Results and Analyst pages prioritize canvas width before rail width.
- At medium widths, the right rail collapses into a compact rail before squeezing the center canvas.
- Rail content remains supporting context, not primary content.

## Immersive Results Workspace

Results is now treated as a spreadsheet-like analytical workspace:

- `ResultsGrid` remains the primary surface.
- Supporting takeaway/context stays in a secondary split pane.
- Table chrome is reduced.
- Row and cell spacing is denser.
- Horizontal viewing comfort is improved with a wider table baseline.
- Pagination, export, filtered/query/preview switching, and `ActiveResultModel` behavior remain unchanged.

## Analyst IDE Workspace

Analyst Mode is optimized for landscape editing:

- Monaco/editor remains the hero surface.
- Schema/context/runtime remain secondary and docked.
- SQL editor height is increased on desktop.
- Schema rail remains collapsible and does not squeeze the editor by default.
- SQL execution, save, explain, draft restore, and editor persistence remain unchanged.

## Explore Density Rules

Explore uses a more compact productivity layout:

- question surface uses horizontal space more effectively
- filters are denser
- filter cards use tighter spacing
- filter grid has a taller workspace viewport
- filter logic remains unchanged

## Responsive Behavior

- Desktop prioritizes horizontal productivity.
- Results and Analyst preserve the center canvas first.
- Medium widths collapse side rails before compressing work areas.
- Tablet and mobile stack split panes safely.
- No layout rule should introduce clipped chips, overlapping panels, or hidden primary controls.

## Preservation Verification

UX-F18 does not change:

- backend APIs
- execution logic
- Query Builder request shapes
- `executeWorkspaceQuery`
- `ActiveResultModel`
- `ResultsGrid` logic
- Monaco/editor persistence
- SQL restore
- upload/session restore
- workbook switching
- exports
- pagination
- Human/Analyst switching
- routing/back behavior
- continuation wrappers
- runtime persistence

## Deferred Future Enhancements

- Add a user-controlled right rail dock/undock preference.
- Add persisted workspace density settings.
- Add visual regression screenshots for Results immersive table and Analyst IDE layouts.
- Extract shell sizing into named CSS custom properties once final breakpoints stabilize.
