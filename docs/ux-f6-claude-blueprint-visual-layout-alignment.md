# UX-F6: Claude Blueprint Visual Layout Alignment

## Purpose

UX-F6 is the first visual alignment pass toward the Claude Enterprise UX Architecture diagrams. It focuses on large-screen layout, spacing, hierarchy, and the three-zone workspace model.

## Implementation Summary

- Widened the main canvas by reducing right drawer width and sidebar visual density.
- Tuned the shell grid into a clearer three-zone layout:
  - left navigation rail/sidebar
  - dominant main canvas
  - right investigation drawer
- Added large-screen breakpoint behavior for wider desktop workspaces.
- Made workspace, results, and query builder hero regions use horizontal space more effectively.
- Reduced narrow text wrapping by using responsive heading sizes and wider content columns.
- Made the right investigation drawer calmer:
  - narrower default width
  - lighter spacing
  - workspace path collapsed by default
  - technical metadata remains lower and collapsed
- Kept the left sidebar compact and navigation-oriented.
- Preserved mobile/tablet fallbacks while improving desktop width usage.

## Claude Blueprint Alignment

### Diagram 1: Global Information Architecture

The layout now more closely follows the blueprint:

- persistent left navigation
- broad central workflow surface
- narrow contextual investigation drawer
- horizontal hero/context areas instead of stacked narrow panels

### Diagram 2: Human vs Analyst Mode Separation

Human and Analyst modes keep the same workspace structure but retain distinct visual language:

- Human Mode remains business-friendly and guided.
- Analyst Mode remains technical, inspectable, and controlled.

### Diagram 3: Investigation Chaining & Trail Architecture

The right drawer remains investigation-focused while becoming less dominant. Trail and path metadata are available through disclosure instead of competing with the main workflow.

### Diagram 4: Optimization Intelligence Workflow

No optimization intelligence, AI execution, generated SQL, or future planner behavior was introduced. Diagram 4 remains future direction only.

## Boundary Guarantees

UX-F6 does not change:

- backend APIs
- `executeWorkspaceQuery`
- Query Builder request shapes
- `ActiveResultModel`
- `ResultsGrid` logic
- pagination
- exports
- Monaco behavior
- SQL draft restore
- upload/session restore
- workbook switching
- Human/Analyst switching
- runtime persistence
- continuation wrappers
- routing or back behavior

UX-F6 does not add AI execution or SQL generation.

## Regression Checks

Recommended checks:

- Build the frontend.
- Open the app on a large desktop viewport.
- Verify the main canvas expands across available width.
- Collapse and expand the Investigation drawer.
- Collapse and expand the left sidebar.
- Open Results, Query Builder, Dataset, and Analyst workspaces.
- Switch Human/Analyst modes.
- Verify Query Builder run behavior.
- Verify Results pagination and export.
- Verify upload/session restore and workbook switching.
- Verify SQL draft restore and Monaco load.

## Deferred UX Work

- Component extraction for the shell, hero, and drawer surfaces.
- True drawer overlay behavior for tablet screens.
- Deeper Results toolbar density cleanup.
- Dataset/workbook panel hierarchy redesign.
- Future optimization, planner, and AI orchestration workflows.
