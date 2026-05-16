# UX-F26 Investigation Workspace Sessions

## Goal

UX-F26 establishes the metadata-first foundation for Investigation Workspace Sessions and Deliverable Hubs. It organizes future reports, exports, charts, scripts, notes, snapshots, package references, and audit metadata without adding file generation or overcrowding the UI.

This phase is advisory only. It does not generate PDFs, DOCX files, ZIPs, charts, scripts, or backend artifacts.

## Architecture

New feature area:

- `frontend/src/features/investigationWorkspace/workspaceSessionTypes.ts`
- `frontend/src/features/investigationWorkspace/workspaceSessionBuilder.ts`
- `frontend/src/features/investigationWorkspace/workspaceSessionTimeline.ts`
- `frontend/src/features/investigationWorkspace/workspaceSessionArtifacts.ts`
- `frontend/src/features/investigationWorkspace/workspaceSessionRecommendations.ts`
- `frontend/src/features/investigationWorkspace/workspaceSessionStorage.ts`
- `frontend/src/features/investigationWorkspace/workspaceSessionAudit.ts`
- `frontend/src/features/investigationWorkspace/index.ts`

The builder consumes existing metadata:

- dataset metadata
- workbook metadata
- active result metadata
- investigation intelligence report
- analysis package plan
- query history
- Human/Analyst source mode

It returns an `InvestigationWorkspacePlan` with a session, deliverable hub, timeline, recommendations, readiness summary, and human-facing summary.

## Session Contract

`InvestigationWorkspaceSession` supports:

- session id
- session title
- created/updated timestamps
- dataset references
- workbook and worksheet references
- active result references
- analysis package references
- investigation trail references
- Human/Analyst source mode
- investigation status
- readiness state
- future artifact folder references
- deliverable hub
- timeline
- audit metadata

All references are metadata only.

## Deliverable Hub Vision

The Deliverable Hub organizes future advisory deliverables:

- reports
- exports
- chart snapshots
- workbook snapshots
- SQL drafts
- Python scripts
- R scripts
- optimization outputs
- audit notes
- investigation explanations
- timelines
- future generated files

No files are generated in UX-F26. The hub creates placeholders and readiness signals so future phases can add explicit generation actions without adding clutter to Results or Build.

## Timeline Metadata

The session timeline can track:

- investigation stages
- query stages
- filter milestones
- grouping milestones
- result checkpoints
- workbook transitions
- Human/Analyst mode context

This gives FiltraQueri future reproducibility and governance hooks while keeping the current UI calm.

## Recommendations

The recommendation engine deterministically suggests:

- Continue investigation.
- Create grouped report.
- Preserve workbook snapshot.
- Save analyst draft later.
- Export result package later.
- Build executive summary later.

Recommendations do not execute anything and do not mutate filters, grouping, query state, exports, or persistence.

## Human Mode Surfaces

UX-F26 adds compact Human Mode surfaces:

- Build: an Investigation Workspace summary with readiness, package count, stage count, deliverable count, and continuation prompts.
- Results: a Workspace Hub side summary with latest checkpoint, package count, stage count, future deliverables, and continuation guidance.

These surfaces are intentionally small. The hub prevents UI overcrowding by collecting future deliverable concepts into one calm planning area instead of scattering more panels across the workspace.

## Claude-Style Workspace Inspiration

The workspace session model follows the idea of a focused working context: the user investigates, reviews results, and collects future deliverables without losing the thread. Instead of turning the app into a dashboard, FiltraQueri keeps the main canvas centered on the current task and uses the hub as a quiet organizing layer.

## Storage Readiness

Storage contracts include placeholders for:

- local package folders
- cloud storage targets
- generated artifact locations
- workspace export bundles

They are not connected to the filesystem, browser storage, or backend storage in this phase.

## Preservation Guarantees

UX-F26 does not alter:

- `executeWorkspaceQuery`
- `ActiveResultModel`
- `ResultsGrid`
- filtering/grouping logic
- exports
- Monaco/editor behavior
- SQL draft restore
- workbook/session restore
- workbook switching
- Human/Analyst switching
- routing/back behavior
- upload/session persistence
- workbook intelligence
- investigation intelligence
- analysis package logic
- runtime persistence
- pagination
- continuation wrappers

## Future Roadmap

Future phases can use this foundation for:

- real deliverable folder creation
- report generation
- export bundle generation
- ZIP packages
- chart snapshot generation
- analyst script bundles
- optimization outputs
- cloud publishing
- scheduled reporting
- enterprise governance and audit trails

Every future generation step should require explicit user approval.

## Validation Checklist

- Run targeted lint for changed files.
- Run `npm run build`.
- Verify ResultsGrid behavior remains unchanged.
- Verify ActiveResultModel remains unchanged.
- Verify workbook switching remains unchanged.
- Verify filtering/grouping remains unchanged.
- Verify exports remain unchanged.
- Verify Monaco and SQL draft restore remain unchanged.
- Verify routing/back behavior remains unchanged.
- Verify no horizontal overflow regressions.
