# UX-F13: Visual Language Stabilization

## Purpose

UX-F13 stabilizes FiltraQueri's enterprise visual language after the UX-F9 through UX-F12 workspace alignment phases. This phase is presentation-only: it reduces visual noise, normalizes typography, flattens surfaces, and keeps runtime intelligence calm without changing workflow or execution behavior.

## Implementation Summary

- Added shared visual language tokens for font weight, neutral canvas, panel, border, muted text, and action blue in `shell.css`.
- Normalized typography toward the canonical hierarchy:
  - body text: 400
  - labels and metadata: 500
  - titles and section headings: 600
  - brand/logotype: 800
- Flattened repeated panel surfaces across shell, results, query builder, filters, SQL, and dataset/runtime sections.
- Reduced heavy shadows, hover lifts, blue metadata chips, and gradient-wash styling.
- Preserved blue primarily for active states, focus states, and primary actions.
- Reduced exposed runtime terminology by presenting generic runtime disclosure labels as `Details`.
- Kept Human Mode calmer and more business-friendly by making metadata supportive rather than dominant.
- Kept Analyst Mode inspectable and controlled while reducing over-dense technical emphasis.

## Noise Removed

- Reduced font weights from 750-900 visual emphasis in shared controls, runtime slots, results metadata, query workflow metadata, filters, and SQL inspection surfaces.
- De-emphasized blue labels used for passive metadata.
- Removed or neutralized several hover shadows and translate effects that made surfaces feel noisy.
- Flattened nested card appearance through consistent white panels, neutral borders, and lower visual contrast.
- Reduced the prominence of `RUNTIME SLOT` by showing the calmer disclosure label `Details`.

## Preservation Verification

UX-F13 does not change:

- backend APIs
- `executeWorkspaceQuery`
- Query Builder execution logic or request shapes
- `ActiveResultModel`
- `ResultsGrid` logic
- pagination
- exports
- Monaco behavior
- SQL draft restore
- upload/session restore
- workbook switching
- Human/Analyst switching logic
- runtime persistence
- routing or back behavior
- continuation actions or wrappers

## Regression Checklist

Recommended manual checks:

- Load a dataset and verify the canonical context strip remains intact.
- Switch Human/Analyst modes and verify mode state persists visually and functionally.
- Use Home, Data, Explore, Build, Results, Analyst, and Settings navigation.
- Build and run a Query Builder query without payload changes.
- Verify SQL draft restore and Monaco/editor load behavior.
- Switch workbook/worksheet context.
- Review Results pagination, sorting, column visibility, and export.
- Use continuation actions and trail navigation wrappers.
- Restore an uploaded/session dataset.

## Deferred Items

- UX-F14 can perform a responsive visual polish pass after this baseline is stable.
- Future phases can extract shared surface/typography classes into reusable component primitives.
- Further grid toolbar density cleanup should wait for a Results-specific interaction pass.
- Advanced technical metadata language can be refined when runtime disclosure contracts are componentized further.
