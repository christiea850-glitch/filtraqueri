# Phase F-91: Runtime Context Panel Ergonomics and Investigation UX Polish

## Purpose

Phase F-91 improves the readability and calmness of the runtime context panel built in F-89 and stabilized in F-90. It is a presentation and copy pass only: the investigation trail, continuations, selected context, and metadata slots are easier to scan without changing execution behavior.

## UX Changes

- Renamed trail steps to clarify user intent: data context, build query, review results, and Analyst SQL.
- Clarified continuation labels so users understand they are returning to existing workspace areas.
- Added section headings for trail, continue, and status groups in the right runtime panel.
- Added helper text explaining that continuations navigate without executing anything.
- Added an empty selected-context state so the panel does not feel broken before a trail item is selected.
- Made Human Mode and Analyst Mode visually distinct through CSS only.
- Reduced visual density with smaller gaps, softer grouping, and calmer helper copy.

## Preservation Notes

F-91 does not:

- change `executeWorkspaceQuery`
- change backend API calls
- change Query Builder request shape
- mutate `ActiveResultModel`
- execute SQL from Monaco
- alter routing or back behavior
- alter upload/session restore
- alter workbook switching
- alter pagination or export mappings
- alter SQL draft restore

All intelligence and continuation details remain metadata-only.

## Files

- `frontend/src/components/layout/WorkspaceShell.tsx`
- `frontend/src/features/workspaceRuntime/runtimeContext.ts`
- `frontend/src/styles/shell.css`

## Manual Smoke Test Checklist

- Open the app with no dataset and confirm the runtime panel shows a calm empty selected-context state.
- Upload or restore a dataset and confirm the trail labels are understandable.
- Click Data context, Build query, Review results, and Analyst SQL from the trail.
- Click continuation actions and confirm they only navigate existing views.
- Switch Human Mode and Analyst Mode and confirm the right panel changes visually without losing context.
- Confirm results pagination and export still work.
- Confirm Query Builder requests still run through the existing builder controls.
- Confirm SQL draft restore remains isolated in Analyst SQL.
