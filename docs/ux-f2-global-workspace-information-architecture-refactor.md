# UX-F2: Global Workspace Information Architecture Refactor

## Purpose

UX-F2 introduces the foundational enterprise information architecture transition for FiltraQueri. It keeps all execution and runtime systems intact while clarifying the workspace as three architectural zones:

1. left sidebar navigation
2. main analytical workspace
3. right investigation drawer

This is a presentation and information architecture phase only.

## Implementation Summary

### Left Sidebar

- Grouped navigation into:
  - `Workspace`
  - `Analytics`
  - `Advanced`
  - `System`
- Kept the sidebar focused on navigation and open-data access.
- Reframed the dataset sidebar block as an active `Workspace` card.
- Preserved recent dataset restore behavior under the Data section.

### Main Canvas

- Added a workspace context header above the active view.
- The header shows:
  - current navigation area
  - active workflow label
  - active mode
  - current dataset
  - selected investigation focus
- This gives the main canvas clearer ownership of the active analytical task.

### Right Investigation Drawer

- Preserved the UX-F1 Investigation grouping.
- Made the drawer visually more distinct from the main canvas.
- Kept `Technical metadata` collapsed by default.
- Preserved current focus, story, suggestions, workspace path, and metadata disclosures.

## Boundary Guarantees

UX-F2 does not:

- change `executeWorkspaceQuery`
- change backend APIs
- change Query Builder request shapes
- mutate `ActiveResultModel`
- execute SQL from Monaco
- alter engine routing behavior
- alter runtime adapters from F-89 through F-94
- remove existing features
- change upload/session restore
- change workbook switching
- change exports
- change pagination
- change SQL draft restore
- change continuation navigation wrappers
- change runtime persistence

## UX Reasoning

The phase makes FiltraQueri feel more like an enterprise analytics workspace by assigning each region a clearer job:

- The left sidebar navigates.
- The main canvas owns the active workflow.
- The right drawer explains the investigation context.

The result reduces stacked metadata pressure without hiding important functionality or changing behavior.

## Regression Checks

Recommended checks:

- Build the frontend.
- Switch Human Mode and Analyst Mode.
- Navigate each grouped sidebar section.
- Open a dataset and restore a recent dataset.
- Switch workbook context.
- Use Query Builder through the existing execution path.
- Confirm results pagination.
- Confirm exports.
- Confirm SQL draft restore.
- Collapse and expand the Investigation drawer.
- Select workspace path items.
- Use continuation go-to actions.

## Deferred UX Work

- Dedicated sidebar component extraction.
- Dedicated workspace header component extraction.
- Results context drawer refinement.
- Query Builder step sequencing.
- Full responsive runtime drawer behavior.
- Broader visual redesign pass.
- Future AI orchestration, generated SQL, or natural language analytics.
