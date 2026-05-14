# UX-F14: Design System Enforcement

## Purpose

UX-F14 enforces the FiltraQueri type and colour foundation across the existing workspace after UX-F13. This phase creates a permanent last-loaded design-system layer for typography, neutral surfaces, action blue, semantic states, border treatment, and spacing rhythm.

This is not a workflow redesign. The implementation keeps all execution, routing, runtime, query, result, Monaco, upload, workbook, and continuation behavior unchanged.

## Implementation Summary

- Added `frontend/src/styles/design-system.css` as the final imported stylesheet.
- Centralized reusable tokens for:
  - typography weights
  - spacing rhythm
  - neutral background layering
  - border and radius scale
  - muted text hierarchy
  - action/focus blue
  - semantic success/warning/danger colors
- Enforced the type hierarchy:
  - body: 400
  - labels and metadata: 500
  - headings and titles: 600
  - brand/logotype: 800
- Standardized shared surface primitives:
  - cards
  - inset surfaces
  - KPI blocks
  - metadata panels
  - approval strips
  - runtime rail panels
  - disclosure sections
  - SQL inspection surfaces
- Reduced remaining passive blue metadata and old heavy-weight styling.
- Preserved blue for active states, focus rings, selected workflow steps, and primary action moments.
- Reduced visible orchestration language by mapping generic runtime disclosure labels to calmer wording.
- Renamed visible Analyst SQL copy from `Runtime adapter` to `SQL dialect` / `SQL context`.
- Renamed visible Human-facing `Execution contract` copy to `Run boundary`.

## Consistency And Noise Removed

- Removed remaining visual drift caused by old per-feature CSS rules.
- Reduced inconsistent shadows, hover lifts, and nested-card emphasis.
- Normalized passive chips and metadata blocks to neutral surface treatment.
- Reduced oversized page/hero typography through final heading scale enforcement.
- Made Human Mode runtime presentation softer and less technical.
- Kept Analyst Mode structured and inspectable without making it visually noisy.

## Primitive Extraction Summary

UX-F14 introduces design primitives through CSS tokens and final-layer selectors rather than new React components. This keeps the phase safe and avoids workflow or markup rewrites.

Shared primitive categories:

- `--fq-font-*` for weight hierarchy
- `--fq-space-*` for spacing rhythm
- `--fq-surface*` and `--fq-bg-app` for layering
- `--fq-border*` for neutral border contrast
- `--fq-radius-*` for surface radius consistency
- `--fq-action` and `--fq-action-soft` for focused blue usage
- semantic color tokens for success, warning, and danger states

## Preservation Verification

UX-F14 does not change:

- routing or back behavior
- Query Builder execution logic
- Query Builder request shape
- `executeWorkspaceQuery`
- `ActiveResultModel`
- `ResultsGrid`
- Monaco behavior
- SQL draft restore
- upload/session restore
- workbook switching
- Human/Analyst switching logic
- continuation wrappers
- runtime persistence
- backend behavior

## Regression Checklist

Recommended manual checks:

- Load and restore a dataset.
- Switch worksheets/workbooks.
- Switch Human and Analyst modes.
- Navigate Home, Data, Explore, Build, Results, Analyst, and Settings.
- Build and run a Query Builder request.
- Confirm SQL draft restore and Monaco/editor behavior.
- Review Results sorting, pagination, column visibility, and export.
- Open runtime disclosures and verify persisted disclosure state.
- Use continuation and investigation trail navigation wrappers.
- Confirm empty-state and loaded-state pages do not visually collide.

## Deferred Future UX Opportunities

- Extract true React surface primitives once the CSS foundation has stabilized.
- Add visual regression screenshots for canonical routes.
- Create a compact density mode for very large workbooks.
- Refine technical disclosure copy further when runtime metadata contracts are componentized.
- Add responsive visual QA for tablet and mobile layouts.
