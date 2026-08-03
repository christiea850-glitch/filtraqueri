> Status
> Aligned workspace-governance reference. `docs/strategy/FILTRAQUERI_PRODUCT_DIRECTION.md` controls product taxonomy, navigation, roadmap, and Investigation positioning.

# Workspace Governance

## Current Product Taxonomy

The current product taxonomy is:

- Data: active product surface for dataset understanding, worksheet relationships, source shape, readiness signals, and data-quality context.
- Explore: user-facing workspace for asking and shaping analytical work; Investigation is contextual inside Explore and does not return as a top-level navigation tab.
- Analyst: technical and analyst-depth surfaces, including Inspect SQL, Browse Templates, and Browse Reports.

Compose, Refine, and Answer remain interaction rooms or workflow states where applicable. Ask FiltraQueri remains active as an answer-oriented product surface. Inspect SQL, Browse Templates, and Browse Reports remain Analyst routes or surfaces, not separate product strategies.

This folder may continue to use implementation names from earlier workspace-governance phases. Those names do not define top-level navigation. Reference: `docs/DOCUMENT_INDEX.md`.

`features/workspaces` defines S5 workspace shell governance foundations for future analytical workspace systems.

This folder is metadata-only. Workspaces are not active yet.

## Current Status

- Workspace routing is not active.
- Workspace orchestration is not active.
- Workspace persistence is not active.
- No workspace UI shell is rendered from this folder.
- `App.tsx` routing and composition ownership remain unchanged.
- S6-X prunes speculative workspace shells from the active governance inventory. The current registry keeps only near-term Investigation and Explainability shells plus a permanently inert orchestration placeholder.

## Scope

This folder may define:

- workspace shell contracts
- workspace lifecycle metadata
- workspace ownership boundaries
- workspace readiness metadata
- workspace preservation expectations
- future workspace routing readiness descriptors

## Governance Rules

- Runtime Bridge must remain isolated from workspace governance.
- Workspace governance must not own execution.
- Workspace governance must not render UI.
- Workspace governance must not mutate navigation or activate routes.
- Workspace governance must not activate orchestration.
- Workspace governance must not persist state or call backend APIs.

## Future Use

Future S5 phases may use this registry to evaluate whether contextual investigation, explainability, executive, analyst, orchestration, or future consumer workspace support is ready for activation. That future activation must remain staged and governed by navigation, preservation, and integrity layers.

S6-X used original phase terminology for a future Investigation workspace activation. Under current product direction, that means contextual investigation support inside Explore, not a peer top-level workspace. Executive, Analyst, and generic future-consumer workspace shells should not be reintroduced until paired with a real activation phase and matching governance evidence.

## Governance Reporting

S5-4B adds metadata-only readiness summaries, a governance report, and a deterministic governance snapshot. These reporting files summarize:

- governance-ready workspace shells
- inactive workspace shells
- partially defined workspace shells
- future workspace candidates
- preservation-ready and integrity-ready workspaces
- ownership and preservation linkage counts
- unsupported ownership, readiness, and activation-candidate states

The reporting layer does not activate workspaces, does not activate orchestration, does not activate routing, does not render UI, and does not mutate governance state. It exists only for governance observability before any future workspace shell is activated.

## Investigation Pre-Activation Contract

Phase 0 documents the original Investigation workspace activation contract before any local proof begins. Current product terminology interprets this as contextual investigation support inside Explore.

The Investigation workspace may read:

- `InvestigationWorkspacePlan`
- `InvestigationReport`
- `NarrativeReport`
- explainability consumer view models
- current Results context through supplied props and callbacks

The Investigation workspace may own only:

- local panel or tab state
- local expand or collapse state
- local view selection state

The Investigation workspace must never own:

- query execution
- result mutation
- pagination, sorting, or filtering
- export or download behavior
- upload, session, or workbook restore
- SQL or Monaco behavior
- Runtime Bridge behavior
- orchestration
- persistence
- global routing
- workspace routing
- `controlledHashDetailHelper` behavior
- `App.tsx` ownership

## Investigation Workspace Hygiene Findings

Phase 0 inspected `frontend/src/features/investigationWorkspace/*` for storage, session, persistence, browser storage, write APIs, backend calls, mutation, and execution behavior.

Findings:

- `workspaceSessionStorage.ts` creates metadata-only `WorkspaceStorageReference` placeholders. It does not call filesystem APIs, browser storage APIs, backend APIs, or persistence engines.
- `workspaceSessionTypes.ts` defines storage and session reference types only.
- `workspaceSessionBuilder.ts`, `workspaceSessionTimeline.ts`, and `workspaceSessionAudit.ts` create session metadata and timeline/audit metadata. They currently use `new Date().toISOString()`, which is nondeterministic metadata and should be reviewed before any deterministic workspace proof.
- `workspaceSessionArtifacts.ts` builds deliverable metadata only. It does not export files or write state.
- `workspaceSessionRecommendations.ts` returns advisory recommendation metadata only.

No `localStorage`, `sessionStorage`, `indexedDB`, backend calls, filesystem writes, export/download execution, query execution, or result mutation behavior was found in `features/investigationWorkspace`.

Before a local Investigation workspace proof, the nondeterministic timestamp generation should either remain outside deterministic governance claims or be replaced with caller-supplied deterministic timestamps.
