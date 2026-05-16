# FiltraQueri Risk And Preservation Analysis

## Critical Preservation Surfaces

### Routing And Back Behavior

Current routing is in-app view state, not URL route state. `activeView` is managed through dataset/session controllers and workspace shell callbacks. Back-like behavior is represented by runtime continuation metadata and Human insight return targets.

Risk: adding graph or continuation orchestration could mutate `activeView` unexpectedly.

Guardrail: future continuation systems must remain explicit click-driven navigation until a route governance layer exists.

### Human/Analyst Switching

Human/Analyst mode is controlled by `workspaceMode` in `App.tsx` and `useWorkspaceDatasetController.ts`. Analyst mode routes to `sqlWorkspace`; Human mode returns to `results` or `welcome`.

Risk: future runtime graph nodes may blur Human and Analyst state.

Guardrail: runtime node references should include mode context but must not switch modes automatically.

### Upload And Session Restore

Uploads reset filters, query builder, SQL metadata, human intent, history, and result tabs. Workspace restore fetches manifest + dataset + preview, then restores metadata safely.

Risk: adding graph snapshots to session restore can make restore heavy or stale.

Guardrail: persist only normalized graph references until a versioned graph store exists.

### Workbook Switching

Workbook worksheet switching resets filtered/queried results, filters, active result tab, and query builder defaults. This is a critical safety behavior.

Risk: lineage systems may try to preserve stale filtered/query state across worksheets.

Guardrail: record worksheet transitions as lineage events; do not prevent reset.

### SQL Workspace And Monaco

Monaco behavior includes fallback, completion providers, hover providers, markers, diagnostics, and draft persistence. SQL run currently records a placeholder execution result only when status is `execution-pending`.

Risk: future SQL execution can accidentally couple editor state to backend execution.

Guardrail: add SQL execution only through a separate explicit execution contract and keep editor/draft state independent.

### Query Builder Logic

Query Builder state controls selected columns, grouping, aggregations, sorting, limits, and query run state. Backend query-builder SQL generation is the executable path.

Risk: intelligence recommendations could mutate builder state automatically.

Guardrail: recommendations may propose but must not mutate builder state without explicit user action.

### ResultsGrid

ResultsGrid renders active page rows and columns, handles column visibility, sorting triggers, copy behavior, structural row styling, active filters, and pagination controls.

Risk: additional intelligence UI inside the grid could affect rendering, performance, or table semantics.

Guardrail: keep intelligence surfaces adjacent to ResultsGrid, not inside its row/cell loop.

### ActiveResultModel

ActiveResultModel is the central stable contract consumed by exports, runtime snapshots, narrative scanner, chart readiness, investigation reports, and UI metadata.

Risk: shape changes ripple across many layers.

Guardrail: use additive adapter functions outside ActiveResultModel instead of changing its structure.

### Pagination

Pagination is coordinated by active result state, backend preview/filter/query-builder requests, and ResultsGrid controls.

Risk: replay or graph snapshots could mistakenly treat a page as a full result.

Guardrail: runtime artifacts must explicitly distinguish page snapshots from full result datasets.

### Exports

Exports are synchronous, capped, and source-aware. Export payloads come from ActiveResultModel and backend `/export`.

Risk: package generation could bypass export caps or duplicate export logic.

Guardrail: future package exports should call a dedicated export job layer, not reuse current synchronous export blindly.

### Filtering And Grouping

Filtering is backend-executed. Grouping is query-builder driven. Active filter labels are UI metadata derived from backend filters.

Risk: narrative or recommendation layers could imply filters/groupings that are not active.

Guardrail: narratives must label suggestions as advisory and maintain evidence references.

### Runtime Persistence

Runtime persistence is lightweight localStorage state for selected trail item, selected task, contextual object, continuation metadata, and panel collapse state.

Risk: storing graph snapshots or artifacts in localStorage can create performance and stale-state issues.

Guardrail: keep localStorage to UI preferences and selected ids only.

### Narrative Rendering

Narrative cards are deterministic and compact. They read active result metadata and sampled rows.

Risk: future AI explanations could make unsupported claims.

Guardrail: require every narrative statement to trace to deterministic evidence or clearly mark AI assistance as future/advisory.

## Cross-Cutting Risks

| Risk | Severity | Why it matters |
|---|---:|---|
| `App.tsx` orchestration growth | High | Many state transitions are centralized; accidental coupling is easy. |
| metadata/execution boundary confusion | High | New intelligence layers may appear actionable but are advisory. |
| frontend/backend contract drift | High | Frontend contracts are ahead of backend persistence. |
| synchronous export/query scaling | Medium-high | Current architecture is safe but capped. |
| duplicate runtime concepts | Medium | `workspaceRuntime` and `runtimeIntelligence` need a bridge. |
| ID/timestamp instability | Medium | Runtime lineage needs stable deterministic ids. |
| localStorage overuse | Medium | Heavy graph metadata should not live in UI persistence. |
| workbook large-file limits | Medium | Current XLSX parsing is not a large-workbook engine. |

## Required Protection Before Future Execution Phases

- Add explicit execution boundary documentation for every executable frontend action.
- Add graph snapshot tests before persisting runtime graph metadata.
- Add versioned metadata schemas for runtime graph, narrative artifacts, and investigation sessions.
- Add replay safety rules before replay UI or replay APIs.
- Add permission/approval language before agentic planning.
- Add export job design before package download features.
- Add SQL execution design before connecting Analyst SQL to backend execution.
