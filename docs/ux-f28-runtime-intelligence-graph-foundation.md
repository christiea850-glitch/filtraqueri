# UX-F28 Runtime Intelligence Graph Foundation

## Runtime Graph Philosophy

UX-F28 establishes a metadata-first runtime intelligence graph for FiltraQueri. The graph describes relationships between datasets, workbooks, queries, results, narratives, recommendations, exports, investigations, and future optimization artifacts without executing work.

The foundation is intentionally non-invasive. Runtime graph contracts live under `frontend/src/features/runtimeIntelligence/` and are designed to be consumed by future replay, orchestration, executive memory, governance, and agentic workflow layers.

## Deterministic Lineage

Runtime nodes and edges use stable ids, immutable metadata snapshots, source references, lineage references, derived-from references, advisory events, and continuation references. Edge types such as `derived_from`, `generated_from`, `recommended_by`, `validated_by`, `continued_from`, `replayed_from`, and `supersedes` describe provenance only.

There is no graph execution engine in this phase.

## Immutable Artifact Governance

Artifact snapshot contracts support result snapshots, narrative snapshots, optimization summaries, recommendation snapshots, scenario snapshots, and investigation summaries. Each artifact includes a stable id, timestamp, hash, lightweight summary, and lineage references.

These structures prepare future binary persistence and audit trails, but UX-F28 does not add a binary storage system.

## Continuation Contracts

Continuation contracts describe UI-safe, execution-neutral suggestions for future work. Supported categories include optimize, forecast, investigate, monitor, compare, rerun, explain, and export.

Continuations are metadata only. They do not trigger routing, queries, automations, exports, or backend execution.

## Runtime Confidence Philosophy

Runtime confidence is advisory and unified across source quality, semantic interpretation, narrative evidence, execution context, feasibility, and recommendation strength. The weakest-link field records the least confident dimension so future governance systems can explain risk without blocking current workflows.

No confidence score gates behavior in UX-F28.

## Narrative Integration

UX-F27 `NarrativeReport` metadata can be represented as runtime narrative nodes and immutable narrative artifact snapshots. Narrative runtime metadata preserves evidence lineage, related result references, advisory timeline checkpoints, continuation references, and confidence summaries.

This does not change current narrative rendering behavior.

## Investigation Runtime References

Investigation workspace sessions now have room for runtime node references, continuation references, advisory runtime checkpoints, and lineage references. These references are metadata snapshots only and preserve immutable investigation history.

## Preservation Guarantees

UX-F28 does not modify:

- ResultsGrid behavior
- ActiveResultModel structure
- executeWorkspaceQuery behavior
- Monaco/editor logic
- filtering/grouping behavior
- exports
- workbook switching or restore
- session restore
- Human/Analyst switching
- routing/back behavior
- pagination
- upload persistence
- SQL workspace logic
- runtime query execution
- analysis package execution
- optimization execution behavior

## Future Orchestration Direction

The runtime graph foundation prepares FiltraQueri for replay systems, investigation lineage graphs, optimization lineage, executive investigation memory, continuation orchestration, AI planning systems, runtime governance, autonomous monitoring, and agentic workflow boundaries.

Future systems should treat these contracts as audit-first metadata. Any execution layer must remain explicit, permissioned, replay-safe, and traceable back to immutable runtime lineage.
