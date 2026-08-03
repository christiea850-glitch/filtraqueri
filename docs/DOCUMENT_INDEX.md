# FiltraQueri Documentation Index

- Status: Active documentation index
- Effective date: 2026-08-03
- Repository-wide product-strategy authority: `docs/strategy/FILTRAQUERI_PRODUCT_DIRECTION.md`
- Working documentation classification: `docs/strategy/DOCUMENTATION_INVENTORY.md`

This index identifies the current authority hierarchy, active documentation, supporting references, historical evidence, and documents awaiting revision. It does not replace the underlying documents.

## Authority Hierarchy

1. Repository-wide product strategy
2. Approved architectural decisions
3. Narrow architectural, governance, security, and UX authorities
4. Active supporting documents
5. Implementation-slice briefs and acceptance criteria
6. Audit evidence
7. Historical reference
8. Superseded or temporary material

Narrow authority cannot override repository-wide product strategy. A title such as "master," "final," "canonical," or "source of truth" does not independently establish repository-wide authority. Completed phase plans preserve evidence but do not control future roadmap sequencing. A later approved architectural decision may supersede a narrower earlier rule, but the supersession must be explicit. When in doubt, consult `docs/strategy/DOCUMENTATION_INVENTORY.md`.

## Repository-Wide Product Direction

- `docs/strategy/FILTRAQUERI_PRODUCT_DIRECTION.md`

This file controls product thesis, users and buyers, canonical-plan doctrine, dialect-neutral direction, metric governance, ExecutedResult, AnalysisArtifact, visualization, explanation, reproducibility, Explore and Investigation positioning, execution governance, data quality, human review, roadmap phases, and release milestones.

Conflicting product-strategy or roadmap language in older documents is subordinate to this file.

## Documentation Governance

- `docs/strategy/DOCUMENTATION_INVENTORY.md`

This file is the approved working classification, current inventory of 162 documents, authority and consistency reference, preservation and cleanup guide, and remains marked Draft inventory. Individual cleanup actions require explicit approval.

## Approved Architectural Decisions

- `docs/adr-1-s6-no-new-governance-layers.md`
- `docs/adr-2-s6-single-controlled-hash-navigation-helper.md`

These are narrow accepted architectural decisions. ADR scope is limited to the decision each ADR records and cannot override repository-wide product strategy outside that scope.

## Narrow Architectural, Governance, and Security Authorities

- `docs/architecture/K11_LLM_Governance_and_Data_Safety_Contract.md`
- `docs/governance-hard-fail-rules.md`

These documents carry narrow architectural, governance, or security authority within their stated scope.

Supporting governance material:

- `docs/governance-review-checklist.md`

Supporting governance documents are not promoted to repository-wide authority.

## UX Authority

- `docs/ux-canonical-workspace-layout-specification.md`

This document is authoritative only for workspace shell layout, layout geometry, stable surface placement, and narrow workspace layout conventions. It is subordinate to `docs/strategy/FILTRAQUERI_PRODUCT_DIRECTION.md` for product naming, top-level navigation, roadmap, and Investigation positioning. Explore is the user-facing workspace. Investigation is contextual inside Explore. This document does not independently restore Investigation as a top-level tab.

Supporting UX references:

- `docs/ux-canonical-workspace-blueprint.md`

Historical UX-F phase files are not implied to be active authority merely because they contain UX material.

## Active Product Surfaces

Current product areas include:

- Data
- Explore
- Analyst
- Compose
- Refine
- Answer
- Ask FiltraQueri
- Inspect SQL
- Browse Templates
- Browse Reports
- worksheet relationships
- data preparation
- SQL preview
- manual Insert
- manual Run

Absence of a dedicated authority document does not mean a surface is retired. Implementation and UX details may currently be distributed across feature READMEs, phase records, audits, and current code. Future documentation may consolidate these areas.

## SQL Architecture

SQL architecture is currently distributed across:

- `docs/strategy/FILTRAQUERI_PRODUCT_DIRECTION.md`
- ADRs
- frontend feature READMEs
- historical phase records
- implementation audits
- current contracts and fixtures

Canonical chain:

```text
business question
-> grounding or proposal
-> adaptive proposal bridge
-> canonical BusinessSqlQueryPlan
-> structural readiness
-> renderer capability
-> deterministic rendering
-> preview
-> manual Insert
-> manual Run
-> provenance
```

The canonical plan is the source of analytical meaning. No downstream layer may reinterpret the raw question independently. Preview does not grant execution permission. There is no automatic Insert or Run. PS-9a introduces renderer separation. PS-Exec gates real production-database execution.

A future narrow-authority SQL architecture document may consolidate this material. No such new doctrine document is created in this task.

## Active Roadmap

The active capability roadmap is contained in:

- `docs/strategy/FILTRAQUERI_PRODUCT_DIRECTION.md`

Phase names:

- Phase 0 - Direction and documentation hygiene
- Phase 1 - Dialect-neutral rendering foundation
- Phase 2 - Executed-answer foundation
- Phase 3 - Governed metrics
- Phase 4 - Durable analytical artifacts
- Phase 5 - Guided intelligence and enterprise workflows
- Phase 6+ - SQL depth driven by observed need

Older next-phase or master roadmaps are historical or superseded unless explicitly reapproved.

## Documents Needing Revision

- `docs/FiltraQueri_UX_Overhaul_Master_Plan.docx`: older strategic UX map; preserve rationale but remove implied product-strategy authority in a later controlled revision or companion notice.
- `frontend/README.md`: Vite template README is not repository-wide authority and should be revised or replaced after a replacement project README exists.
- `frontend/src/features/investigationWorkspace/README.md`: clarify Investigation as contextual inside Explore.
- `frontend/src/features/workspaces/README.md`: remove implication of future top-level Investigation activation.
- `UX_UI_AUDIT/filtraqueri-operational-ux-charter.md`: useful UX guidance, but it does not control repository-wide product strategy.
- `UX_UI_AUDIT/ux-core-2-phase-b-workspace-question-surface-plan.md`: old Investigations and Query Builder navigation terms need current Explore framing.
- `UX_UI_AUDIT/ux-core-2-workspace-question-to-answer-core-loop-plan.md`: historical implementation rationale needs current execution-governance cross-reference.

## Superseded Documents

- `docs/filtraqueri-next-phase-roadmap.md`: controlled by `docs/strategy/FILTRAQUERI_PRODUCT_DIRECTION.md`; retain for historical context and do not delete until preservation and reference review are complete.
- `docs/filtraqueri-claude-review-summary.md`: controlled by `docs/strategy/FILTRAQUERI_PRODUCT_DIRECTION.md`; retain for historical context and do not delete until preservation and reference review are complete.
- `docs/filtraqueri-executive-summary-post-ux-f28.md`: controlled by `docs/strategy/FILTRAQUERI_PRODUCT_DIRECTION.md`; retain for historical context and do not delete until preservation and reference review are complete.
- `docs/phase-f-67-architecture-stabilization-audit.md`: superseded for current architectural status by later direction and decisions; retain as historical audit evidence and do not delete until preservation and reference review are complete.

## Historical and Audit Evidence

Completed phase plans remain useful evidence. Audit reports preserve acceptance criteria, safety rules, implementation boundaries, and rationale. Historical classification does not mean disposable. Audit evidence must remain traceable. No broad archival movement occurs in Phase A. See `docs/strategy/DOCUMENTATION_INVENTORY.md` rather than listing all 109 historical files here.

## Manual Review Required

- `docs/FiltraQueri_UX_UI_Design_Guide.pdf`

Status: `UNREVIEWABLE`. This file is `[manual-review-required]`. Its filename suggests possible UX guidance, but no authority is inferred from the filename. No move, archive, merge, replacement, or deletion may occur before manual visual review.

## Proposed Future Documentation Structure

```text
docs/
|-- DOCUMENT_INDEX.md
|-- strategy/
|-- architecture/
|-- roadmap/
|-- ux/
|-- decisions/
|-- governance/
|-- security/
|-- sql/
|-- audits/
|-- history/
|   `-- architecture/
`-- archive/
```

This is proposed organization only. No moves occur in Phase A.

## Change-Control Rule

Every future PS, UX, metric, execution, visualization, explanation, artifact, workflow, or governance audit must ask:

Does this change conflict with `docs/strategy/FILTRAQUERI_PRODUCT_DIRECTION.md`?

If yes:

- resolve the conflict;
- record an explicit architectural or product decision;
- update the strategy only when the product direction itself has been deliberately approved to change.
