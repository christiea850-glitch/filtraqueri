# UX-F27 Executive Insight & Narrative Intelligence

## Architecture

UX-F27 adds `frontend/src/features/narrativeIntelligence/` as a deterministic frontend feature layer. The scanner accepts the active result model, visible/sample rows, dataset schema, workbook metadata, business semantic metadata, and investigation context. It produces a `NarrativeReport` with ranked insight cards, readiness metadata, recommendations, and advisory timeline checkpoints.

The layer is intentionally pure TypeScript. It does not execute backend queries, mutate result state, call AI services, or change grid behavior.

## Deterministic Narrative Philosophy

Narratives are built from observed metadata and row samples:

- missing-value ratios
- category dominance
- repeated row structures
- numeric spread
- date clustering
- grouping opportunities
- workbook normalization warnings
- operational, financial, and location field signals

Each insight carries evidence and related columns so the UI can explain why the narrative exists.

## Data-Driven Requirement

Insights must vary with actual workbook and result patterns. Static language such as “interesting pattern detected” is not acceptable. A concentration insight only appears when one sampled category exceeds the configured dominance threshold. A quality warning only appears when metadata or samples show missing, duplicate, or structural-row patterns.

## Hallucination Prevention

UX-F27 does not generate freeform AI explanations. It uses detector templates with explicit evidence values. The report includes safety notes stating that no generative AI decisions or automatic business actions are performed.

## Preservation Guarantees

This phase preserves:

- `executeWorkspaceQuery`
- `ActiveResultModel`
- `ResultsGrid`
- filtering and grouping logic
- exports
- Monaco/editor behavior
- SQL draft restore
- workbook and session restore
- workbook switching
- Human/Analyst switching
- routing/back behavior
- upload/session persistence
- workbook and investigation intelligence
- analysis package logic
- runtime persistence
- pagination
- continuation wrappers

The UI addition is limited to a compact Executive Insights section inside the existing Results context hierarchy.

## Timeline Metadata

Narrative reports can create advisory timeline checkpoints for anomalies, concentration signals, grouping opportunities, and workbook quality warnings. These are metadata references only and do not trigger workflow automation.

## Future AI Extension Path

The report contract exposes future-ready flags for AI-assisted explanations, executive reporting, narrative exports, scheduled summaries, governance audit trails, and multilingual summaries. Future AI features should consume deterministic insight evidence rather than inventing unsupported claims.

## Enterprise BI Positioning

UX-F27 positions FiltraQueri as an executive-friendly BI workspace without adding noisy dashboards. It gives leaders compact, evidence-backed explanations while preserving analyst-grade lineage and deterministic auditability.
