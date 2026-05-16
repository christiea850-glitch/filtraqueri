# UX-F25 Analysis Package Foundation

## Goal

UX-F25 creates the metadata-first foundation for future Analysis Packages. The package system is designed to organize investigations into professional deliverable bundles without overcrowding the UI.

This phase does not generate PDFs, DOCX files, ZIPs, charts, scripts, exports, or backend file artifacts. It only creates contracts, manifests, advisory recommendations, audit metadata, and compact planning surfaces.

## Architecture

New feature area:

- `frontend/src/features/analysisPackages/analysisPackageTypes.ts`
- `frontend/src/features/analysisPackages/analysisPackageArtifacts.ts`
- `frontend/src/features/analysisPackages/analysisPackageContext.ts`
- `frontend/src/features/analysisPackages/analysisPackageRecommendations.ts`
- `frontend/src/features/analysisPackages/analysisPackageManifest.ts`
- `frontend/src/features/analysisPackages/analysisPackageAudit.ts`
- `frontend/src/features/analysisPackages/analysisPackageBuilder.ts`
- `frontend/src/features/analysisPackages/index.ts`

The package builder accepts existing workspace metadata:

- dataset metadata
- workbook metadata
- active result metadata
- investigation intelligence report
- query history
- Human/Analyst source mode

It returns an `AnalysisPackagePlan` containing:

- package manifest
- artifact manifest
- package recommendations
- readiness summary
- human-facing package summary

## Package Contract

`AnalysisPackageManifest` supports:

- package id
- package title
- dataset references
- workbook and worksheet references
- investigation intent references
- generated query references
- active result references
- artifact manifests
- generated timestamp
- package status
- investigation trail references
- source mode
- future export targets
- audit trail

The manifest is future-generation-ready, but it does not write files.

## Artifact Model

Supported advisory artifact types:

- `report_summary`
- `result_export`
- `sql_script`
- `python_script`
- `r_script`
- `chart_image`
- `dashboard_snapshot`
- `workbook_snapshot`
- `optimization_model`
- `audit_log`
- `explanation_note`
- `investigation_timeline`

Each artifact includes:

- label
- description
- type
- status
- readiness
- related investigation step
- related dataset
- future file path placeholder
- future generation engine metadata

Generation engines are named as future placeholders only. They are marked unconfigured in this phase.

## Recommendation Model

The package recommendation layer deterministically suggests useful future deliverables, such as:

- Include investigation summary.
- Include grouped summary export.
- Include investigation explanation.
- Include workbook relationship notes.
- Include result snapshot.
- Include SQL or query draft.
- Include audit notes.
- Include investigation timeline.

Recommendations are advisory and do not trigger exports or file generation.

## Human Mode Surface

UX-F25 adds compact package planning surfaces in Human Mode:

- Build shows package readiness and suggested package contents.
- Results shows package readiness, ready artifact count, and recommended future contents.

There is no download button and no generation action yet.

The language is business-oriented: the feature reads as a professional deliverable planner, not a developer export system.

## Traceability And Audit Readiness

The package audit structures capture future reproducibility metadata:

- dataset references
- active result source
- query history entries
- workbook references
- investigation trail stages
- filters and grouping references through the active result model

This is governance metadata only. It does not alter runtime persistence or session restore.

## Preservation Guarantees

UX-F25 does not alter:

- `executeWorkspaceQuery`
- filtering/grouping execution
- `ActiveResultModel`
- `ResultsGrid` contracts
- exports
- workbook/session restore
- workbook switching
- routing/back behavior
- Monaco/editor behavior
- SQL generation behavior
- pagination
- upload/session persistence
- investigation intelligence logic
- workbook intelligence logic
- runtime persistence

All package systems remain advisory, metadata-first, execution-independent, and future-generation-ready.

## Future Generation Roadmap

Future phases can extend this foundation with:

- PDF report generation
- Word summary generation
- Excel/CSV package exports
- chart/image rendering
- SQL/Python/R script generation
- optimization deliverables
- ZIP package generation
- scheduled reporting
- cloud storage integration
- local filesystem packaging
- enterprise governance and audit trails

Future generation should use explicit user approval and should not run automatically from advisory recommendations.

## Validation Checklist

- Run targeted lint for changed frontend files.
- Run `npm run build`.
- Verify workbook uploads and worksheet switching still work.
- Verify ResultsGrid behavior remains unchanged.
- Verify filtering/grouping execution remains unchanged.
- Verify Analyst Mode and Monaco remain unchanged.
- Verify routing/back behavior remains unchanged.
- Verify no overflow regressions on Build and Results.
