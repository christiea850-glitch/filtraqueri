# UX-F3: Main Canvas Workflow Hierarchy Refactor

## Purpose

UX-F3 establishes a clearer main-canvas workflow hierarchy for FiltraQueri. The phase keeps all existing behavior intact while making the canvas feel more like an investigation-first enterprise analytics workspace.

This is presentation and workflow hierarchy only.

## Implementation Summary

### Workspace Hero

- Replaced the smaller workspace context header with a dominant `workspace-hero` section.
- The hero summarizes:
  - active navigation area
  - deterministic investigation narrative
  - current workflow
  - current dataset
  - workbook context
  - active result focus
  - selected investigation focus
- Human Mode uses business-investigation language.
- Analyst Mode uses technical-review language while keeping the same structure.

### Active Workflow Frame

- Wrapped the existing active view in a `workspace-active-flow` section.
- Added a workflow heading that separates:
  - primary active workflow
  - supporting workflow description
  - mode-specific guidance copy
- The rendered view content is unchanged and still comes from the same routing/session registry.

### Visual Hierarchy

- The main canvas now follows:
  1. workspace hero
  2. active workflow section
  3. existing supporting controls and panels
  4. quieter metadata
- This reduces equal-weight stacked-card pressure without removing any existing feature.

## Boundary Guarantees

UX-F3 does not:

- change `executeWorkspaceQuery`
- change backend APIs
- change Query Builder request shapes
- mutate `ActiveResultModel`
- execute SQL from Monaco
- change Monaco integration
- change routing or back behavior
- change Human/Analyst switching
- change upload/session restore
- change workbook switching
- change pagination
- change exports
- change SQL draft restore
- change runtime persistence
- mutate F-89 through F-94 runtime adapters
- change investigation trail metadata
- change continuation wrappers
- introduce AI execution or generated SQL

## UX Reasoning

The main canvas now carries the primary analytical story instead of relying on many equal-weight cards. Business users get a calmer investigation summary first; analysts get the same hierarchy with more technical framing. Metadata remains visible but is visually subordinate to the active workflow.

## Regression Checks

Recommended checks:

- Build the frontend.
- Switch Human Mode and Analyst Mode.
- Navigate each sidebar section.
- Restore uploaded/session datasets.
- Switch workbook context.
- Use Query Builder through the existing execution path.
- Verify results pagination.
- Verify exports.
- Verify SQL draft restore.
- Verify Monaco still loads in the SQL workspace.
- Collapse and expand the Investigation drawer.
- Select workspace path items and continuation actions.

## Deferred UX Work

- Dedicated `WorkspaceHero` component extraction.
- Results workflow hierarchy cleanup inside the results view.
- Query Builder step sequencing.
- Dataset/workbook context drawer refinement.
- Deeper card-density cleanup in individual feature panels.
- Full responsive workspace drawer behavior.
