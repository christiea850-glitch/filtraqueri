> Revision status
> This document remains useful within its stated scope but contains terminology, authority, or sequencing that requires alignment with `docs/strategy/FILTRAQUERI_PRODUCT_DIRECTION.md`. Where conflicts exist, the product-direction document controls. Explore is the user-facing workspace; Investigation is contextual inside Explore and no top-level Investigation tab is restored.

# Investigation Workspace Boundary

S7-A/B/C/D establish the current stable baseline for this proof. It is local-state-only, non-routed, and presentation-only.

- Local React state may only support tabs, panels, expanded sections, and presentation mode.
- Props and callbacks come from the existing Results owner; this feature does not own Results state.
- Read-only investigation metadata and read-only consumer view models are allowed.
- There is no persistence, no execution, no orchestration, and no backend ownership here.
- There is no workspace routing, route activation, controlled hash helper usage, and no App.tsx ownership migration.
- Runtime Bridge, SQL/Monaco, Query Builder, export/download, upload/session restore, and ActiveResultModel behavior remain protected outside this proof.

## Results Ownership

Results ownership remains external. `ResultsInvestigationSurface` owns the active result lifecycle and supplies the Investigation Workspace with read-only labels, metadata, and existing owner-derived view models.

The Investigation Workspace is a consumer/presentation surface only. It does not own result execution, filtering, sorting, pagination, exports, upload/session/workbook restore, SQL/Monaco state, or ActiveResultModel behavior.

There is no result lifecycle ownership in `features/investigationWorkspace/`; local state is limited to tab, panel, expanded-section, and presentation-mode display state.

## S7-D Stability Checkpoint

future changes must preserve local-state-only, non-routed, presentation-only behavior unless a new explicit phase approves otherwise.

The proof mounts only from `ResultsInvestigationSurface`. It must not add route activation, workspace routes, controlled hash helper usage, persistence, orchestration, backend/API calls, SQL/Monaco ownership, export/download ownership, upload/session/workbook restore ownership, ActiveResultModel ownership, or Runtime Bridge behavior imports.
