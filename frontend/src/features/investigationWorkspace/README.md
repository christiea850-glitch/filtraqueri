# Investigation Workspace Boundary

S7-A/S7-B keeps this proof local-state-only, non-routed, and presentation-only.

- Local React state may only support tabs, panels, expanded sections, and presentation mode.
- Props and callbacks come from the existing Results owner; this feature does not own Results state.
- Read-only investigation metadata and read-only consumer view models are allowed.
- There is no persistence, no execution, no orchestration, and no backend ownership here.
- There is no workspace routing, route activation, controlled hash helper usage, and no App.tsx ownership migration.
- Runtime Bridge, SQL/Monaco, Query Builder, export/download, upload/session restore, and ActiveResultModel behavior remain protected outside this proof.
