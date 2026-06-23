# T-24G - Deterministic Shadow Plan Validator Audit

## Purpose

This audit designs a future deterministic **Shadow Plan Validator** for FiltraQueri. It is design-only and documents how a future LLM-produced shadow plan could be reviewed before it can influence planning, SQL rendering, insertion, execution, ranking, or user-visible recommendations.

No validator code is implemented in this slice. No payloads are built, no providers are called, no backend/API/UI/storage is added, and no SQL generation, Insert SQL, Run Query, Ask ranking, or Business SQL planner/renderer behavior is changed.

Core question:

> If a future LLM receives metadata-only or privacy-preserved shadow data and returns a plan, how does FiltraQueri deterministically verify that the plan is safe, schema-valid, privacy-safe, relationship-valid, and not executable authority?

## Files Inspected

Prior privacy and shadow-data audits:

- `docs/t-24a-privacy-preserving-llm-shadow-data-strategy-audit.md`
- `docs/t-24e-synthetic-sample-strategy-audit.md`
- `docs/t-24f-tokenization-vault-ship-defer-reject-audit.md`

LLM privacy, payload, sensitivity, suggestion, and SQL safety foundations:

- `frontend/src/features/analyst/llm/llmPrivacyModes.ts`
- `frontend/src/features/analyst/llm/llmShadowDataPolicy.ts`
- `frontend/src/features/analyst/llm/llmMetadataPayloadBuilder.ts`
- `frontend/src/features/analyst/llm/llmSensitiveColumnClassifier.ts`
- `frontend/src/features/analyst/llm/llmSuggestionValidator.ts`
- `frontend/src/features/analyst/llm/llmSqlSafetyValidator.ts`

Business SQL planning, readiness, rendering, joins, and relationship review foundations:

- `frontend/src/features/analyst/sql/businessSqlQueryPlan.ts`
- `frontend/src/features/analyst/sql/businessSqlQueryPlanner.ts`
- `frontend/src/features/analyst/sql/businessSqlRenderReadiness.ts`
- `frontend/src/features/analyst/sql/businessSqlRenderer.ts`
- `frontend/src/features/analyst/sql/businessSqlJoinPathResolver.ts`
- `frontend/src/features/analyst/sql/sqlRelationshipConfirmation.ts`
- `frontend/src/features/analyst/sql/sqlRelationshipReview.ts`

## Current Deterministic Validators Already Available

FiltraQueri already has several deterministic controls that a future Shadow Plan Validator should compose rather than bypass:

1. **Privacy mode and no-execution invariants.** `llmPrivacyModes.ts` defines privacy modes, raw-data-prohibited payload categories, categories allowed for metadata-only mode, categories requiring consent for shadow data, and no-execution invariants requiring deterministic validation plus manual Insert SQL and Run Query.
2. **Shadow-data sensitivity policy.** `llmShadowDataPolicy.ts` maps column sensitivity, privacy mode, uniqueness risk, and rare-value risk to deterministic policies such as `metadata_only`, `bucket`, `mask`, `suppress`, `prohibit`, or private-only tokenization.
3. **Metadata-only payload builder hardening.** `llmMetadataPayloadBuilder.ts` summarizes datasets, worksheets, columns, relationships, profiles, dialect information, and deterministic report opportunities without including raw/sample/top values or SQL drafts.
4. **Sensitive-column classifier.** `llmSensitiveColumnClassifier.ts` classifies restricted access/security fields, health/sensitive fields, contact information, personal identifiers, locations, financial fields, free text, identifiers, unknown columns, and safe business metrics.
5. **Suggestion validator.** `llmSuggestionValidator.ts` treats LLM-like suggestions as untrusted, strips/rejects unsupported fields, prevents raw/sample/value/SQL authority from becoming trusted output, and recomputes readiness deterministically.
6. **SQL safety validator.** `llmSqlSafetyValidator.ts` inspects SQL-like content for read-only shape, blocked keywords, multi-statement risk, untrusted tables/columns, restricted or sensitive columns, wildcard exposure, file/network patterns, and destructive/exfiltration patterns.
7. **Business SQL plan contracts.** `businessSqlQueryPlan.ts` defines deterministic query-plan structures and warning/support concepts that the renderer expects.
8. **Business SQL planner.** `businessSqlQueryPlanner.ts` maps supported business intents to deterministic plan shapes instead of accepting arbitrary LLM SQL.
9. **Render readiness evaluator.** `businessSqlRenderReadiness.ts` blocks rendering when required relationships, fields, entities, or plan support are missing.
10. **Business SQL renderer.** `businessSqlRenderer.ts` emits SQL only for supported deterministic plan shapes and should remain the final SQL authority.
11. **Join path resolver.** `businessSqlJoinPathResolver.ts` resolves join requirements only through active, ready relationship contracts and emits blocking warnings for missing or review-needed joins.
12. **Relationship confirmation state.** `sqlRelationshipConfirmation.ts` requires schema-backed, user-confirmed relationships and explicitly records no-SQL/no-run/no-backend safety flags.
13. **Relationship review model.** `sqlRelationshipReview.ts` creates a review-only model that does not persist, accept, generate SQL, call the backend, or run queries.

The new validator should be an orchestration and contract layer over these existing controls, not a substitute for them.

## Proposed Future Architecture

The future validator should be introduced as a deterministic validation boundary with these design-level components:

### `LlmShadowPlan`

Structured, advisory-only LLM output. It contains intent, schema references, metric references, grouping/filter requests, relationship needs, assumptions, confidence, privacy metadata, and payload provenance. It must not contain SQL as authority or execution instructions.

### `LlmShadowPlanValidationResult`

Deterministic result with:

- `status`: `accepted_for_deterministic_planning`, `needs_user_review`, or `rejected`.
- `acceptedReferences`: normalized schema/metric/relationship references safe to pass to deterministic planning.
- `violations`: privacy, schema, relationship, SQL, support, consent, and authority violations.
- `unsupportedReasons`: plan-shape or renderer limitations.
- `auditSummary`: non-sensitive validation summary.
- `llmAdvisoryOnly: true`.
- `manualInsertRequired: true`.
- `manualRunRequired: true`.

### `LlmShadowPlanValidator`

Pure deterministic validator. It accepts a proposed `LlmShadowPlan`, the payload manifest/fingerprint used to produce it, the active privacy mode, sensitivity decisions, dataset/workbook schema, accepted relationship contracts, renderer support metadata, consent state, and optional SQL safety context. It returns `LlmShadowPlanValidationResult` and performs no rendering, insertion, execution, persistence, provider calls, or UI mutation.

### `ShadowPlanSchemaReference`

Normalized reference object for tables, worksheets, columns, metrics, groupings, filters, and relationships. It should support explicit source aliases only when the payload manifest proves aliasing and the `DeterministicRehydrationGuard` can map the alias back to one schema object.

### `ShadowPlanPrivacyViolation`

Violation type for raw rows, raw values, literal sensitive values, suppressed/prohibited column use, token vault/mapping references, provider response text, prompt text, SQL drafts, query results, privacy-mode mismatch, consent mismatch, and unsafe payload category use.

### `ShadowPlanRelationshipViolation`

Violation type for unsupported joins, missing join path, unconfirmed worksheet relationship, broken/inactive relationship contract, relationship candidate treated as accepted, relationship involving suppressed join keys, or relationship unsupported by Business SQL readiness.

### `ShadowPlanUnsupportedReason`

Unsupported plan-shape reason, such as unsupported metric aggregation, unsupported filter operator, unsupported group-by shape, unsupported multi-hop join, unsupported chart/report recommendation, or renderer cannot emit a deterministic query for this shape.

### `DeterministicRehydrationGuard`

Local-only guard that maps LLM plan references back to real schema references. It never maps raw values. It never rehydrates token vault entries in default/public mode. It validates privacy mode, payload fingerprint, alias namespace, schema version, consent scope, sensitivity policy, and relationship readiness before any reference is accepted.

### `ShadowPlanAuditSummary`

Non-sensitive audit summary containing privacy mode, payload fingerprint, plan fingerprint, validation status, violation counts by category, accepted reference counts, suppressed/prohibited reference counts, relationship validation status, consent status, renderer support status, and no-execution flags. It must not include raw plan text, prompt text, provider response text, raw values, SQL drafts, query results, or token mappings.

## Allowed Shadow Plan Shape

A future LLM may return only a constrained, typed, advisory plan. The safest allowed shape is:

```text
LlmShadowPlan
- planVersion
- intent
  - kind: compare | trend | summarize | rank | distribution | anomaly_hint | relationship_exploration
  - naturalLanguageSummary: short advisory text, no provider transcript
- entities
  - worksheet/table references by schema id, trusted table name, or validated shadow alias
- metrics
  - metric id/name
  - source column reference
  - aggregation: count | sum | average | min | max only if supported and privacy-safe
- groupings
  - column reference
  - optional date bucket or safe category bucket
- filters
  - column reference
  - operator from allow-list
  - value kind: none | bucket_label | relative_time_window | boolean_literal only when privacy-safe
  - no raw sensitive literals
- relationshipsNeeded
  - entity pairs
  - optional relationship ids or join hints, advisory only
- assumptions
  - short strings about ambiguity, not provider transcript or hidden prompt
- confidence
  - numeric 0-1 plus reason codes
- privacy
  - privacyModeUsed
  - payloadFingerprint
  - includedPayloadCategories
  - llmAdvisoryOnly: true
  - noSqlTextRequired: true
```

The plan is a request for deterministic validation and possible deterministic planning. It is not SQL, not a renderer input by itself, not a UI recommendation by itself, and not authority to insert or run anything.

## Prohibited Plan Content

The validator should reject the plan if any prohibited content appears anywhere in known fields, unknown fields, nested objects, free-form text, arrays, serialized JSON strings, or attachment-like content:

- Raw rows, copied rows, preview rows, sampled rows, row indexes, or row-shaped facts represented as real data.
- Raw values, sample values, top values, rare values, exact min/max endpoints, exact timestamps, exact addresses, account-like values, emails, phones, names, notes, or free-text source snippets.
- Literal sensitive values, including masked values that preserve meaningful prefixes, suffixes, last-four digits, domains, formats, or unique structure.
- SQL strings as final authority, including `SELECT`, DML/DDL, CTEs, table-qualified SQL drafts, or SQL comments instructing execution.
- Provider response text copied into UI without validation, hidden prompts, system prompts, chain-of-thought-like text, or prompt templates.
- Token vault references, token-to-value mappings, token namespace hints, reversible token explanations, or instructions to rehydrate tokens.
- Unsupported backend/API actions, storage/persistence instructions, mutation instructions, or instructions to call providers/tools.
- Execution instructions such as insert this SQL, run this query, create a table, export results, upload data, persist relationship, or auto-accept relationship.
- Query results or result-derived recommendations represented as if already executed.
- Any unknown top-level field unless the structure validator explicitly allows extension metadata and recursively validates it as non-sensitive.

## Recommended Validation Pipeline

The validator should fail closed and produce all safe-to-report violations it can identify without preserving raw prohibited content.

### 1. Structure validator

- Require a known `planVersion`.
- Reject unknown required fields and unsafe unknown fields.
- Enforce maximum string lengths and array sizes.
- Enforce enum allow-lists for intent kinds, aggregation functions, filter operators, date buckets, confidence shape, privacy modes, and payload categories.
- Require `llmAdvisoryOnly: true` and `noSqlTextRequired: true`.
- Reject any embedded object that looks like rows, SQL, prompt/provider transcript, query results, or token mappings.

### 2. Payload fingerprint validator

- Require the plan payload fingerprint to match the manifest fingerprint for the exact provider payload that produced the plan.
- Reject null, missing, stale, malformed, or mismatched fingerprints.
- Reject if dataset, workbook, worksheet, schema, privacy policy, sensitivity classifier version, relationship state, or consent scope changed after the fingerprint was issued.

### 3. Privacy mode validator

- Ensure `privacyModeUsed` is compatible with the manifest and active policy.
- Metadata-only plans may reference metadata categories only.
- Level 2 masked/synthetic plans may reference only approved aggregate, masked, synthetic, or bucketed categories and only when consent is valid.
- Level 3 reversible tokenized plans remain rejected for default/public FiltraQueri and deferred for private deployments until a separately approved vault lifecycle and rehydration guard exist.
- Raw-data modes remain prohibited for external LLMs.

### 4. Sensitive/reference validator

- Reclassify every referenced column using the deterministic sensitive-column classifier and shadow-data policy.
- Reject references to restricted columns, prohibited columns, suppressed columns, unsafe identifiers, raw free text, token vault fields, or private-only tokenized values in public/default mode.
- Reject filters/groupings that require raw sensitive literals or raw value comparisons.
- Allow safe business metrics only when the source column is present, not suppressed, and the aggregation is supported.

### 5. Schema validator

- Resolve every entity, table, worksheet, column, metric, grouping, and filter against current schema.
- Reject hallucinated tables and columns.
- Reject ambiguous aliases unless the payload manifest includes a deterministic alias map and the alias maps to exactly one current schema object.
- Reject unknown metrics unless they correspond to deterministic report opportunities, existing profile-derived possible metrics, or supported Business SQL metric definitions.
- Reject references that can no longer map back to current schema after workbook/dataset changes.

### 6. Relationship validator

- Validate every relationship need against active, ready, schema-backed accepted relationship contracts.
- Treat relationship candidates as review suggestions only, never accepted join authority.
- Reject unconfirmed worksheet relationships and broken/inactive contracts.
- Reject unsupported joins, missing join paths, ambiguous multi-hop paths, or joins requiring suppressed/prohibited join columns.
- Reuse existing join path readiness rules before any plan can influence Business SQL planning.

### 7. Business SQL support validator

- Translate accepted references into a deterministic planning request only if the plan shape matches supported Business SQL intent, metric, grouping, filter, relationship, and aggregation contracts.
- Run render readiness checks before the plan can become a SQL preparation candidate.
- Reject or mark `needs_user_review` when the renderer does not support the requested shape.
- Never pass raw LLM SQL to the renderer as final authority.

### 8. SQL safety validator if SQL text appears

- SQL text is not required and should normally be prohibited.
- If SQL-like text appears anywhere, run the SQL safety validator for diagnostics and reject the plan as an authority violation even if the SQL happens to be read-only.
- The only permissible outcome for SQL-like LLM output is a rejected or quarantined audit summary, not insertion or execution.

### 9. Human/manual action guard

- Preserve manual Insert SQL and manual Run Query.
- Do not auto-insert SQL, auto-run queries, auto-accept relationships, auto-persist consent, auto-save provider output, or auto-change ranking.
- If the result is safe but needs review, surface only deterministic, sanitized review copy and require explicit user action through existing guarded flows.

### 10. Audit summary builder

- Build a non-sensitive `ShadowPlanAuditSummary` with validation outcome, fingerprints, privacy mode, consent state, accepted reference counts, violation counts, relationship status, support status, and no-execution flags.
- Store or display only summaries if storage/display is later approved; never store raw plan text, raw values, prompts, provider responses, SQL drafts, query results, or token mappings.

## Rehydration and Mapping Rules

`DeterministicRehydrationGuard` should follow these rules:

1. **Schema references only by default.** Map table/worksheet/column aliases back to current schema references; never map values.
2. **One alias, one object.** Reject ambiguous aliases, case-only collisions, stale aliases, missing aliases, or aliases from another payload fingerprint.
3. **Fingerprint binding.** Alias maps and plan references are valid only for the payload fingerprint that produced them.
4. **Scope binding.** References are valid only for the same dataset, workbook, worksheet set, schema version, privacy mode, provider category, and consent scope.
5. **Sensitivity recheck.** Re-run sensitivity and shadow policy checks at validation time; do not trust LLM labels.
6. **No token rehydration in public/default mode.** Token values and vault references are rejected. Private Level 3 would require a separate design with explicit vault lifecycle, consent, and deployment controls.
7. **No value rehydration.** Filter values may map only to safe bucket labels, relative time windows, or supported boolean literals. Raw literals are rejected.
8. **No relationship persistence.** Relationship references can request review or use active accepted contracts only; they cannot confirm or persist relationships.
9. **No SQL authority.** Even a fully rehydrated plan becomes only a deterministic planner input candidate.

## Relationship Confirmation Interaction

The validator should preserve the existing distinction between relationship suggestions, review, confirmation, and rendering:

- An LLM plan may say that two entities probably need a relationship, but that statement is not a confirmed relationship.
- Existing relationship candidates may be used to explain why a review panel is relevant, but not to render SQL until accepted through schema-backed confirmation.
- Active accepted relationship contracts can satisfy join requirements only if their tables/columns still exist and are not broken.
- If a relationship is missing or only suggested, the validation result should be `needs_user_review` or `rejected`, not `accepted_for_deterministic_planning`.
- Review UI should remain no-persistence/no-SQL/no-backend/no-run until the user explicitly confirms through existing guarded flows.

## Privacy-Mode Interaction

The validator must treat privacy mode as a hard contract:

| Privacy mode | Plan references allowed | Validator posture |
| --- | --- | --- |
| `no_llm` | None | Reject any LLM shadow plan. |
| `metadata_only_llm` | Schema, profile, relationship metadata, deterministic opportunity ids | Accept only metadata-backed references; reject values, samples, buckets, rows, SQL drafts, provider text. |
| `masked_synthetic_sample_llm` | Metadata plus approved aggregate, masked, synthetic, or bucket labels | Require consent, payload fingerprint match, suppression policy, k-safety manifest, and no raw/sensitive literals. |
| `reversible_tokenized_private` | Deferred private-only token references | Reject in default/public mode; require separate private deployment controls before any future support. |
| `raw_data_prohibited` | None for external LLMs | Reject raw-data plan influence. |

## Consent and Audit Interaction

Future consent must be checked at validation time, not only payload-build time:

- Consent must name the privacy mode and payload categories.
- Consent must bind to provider category, dataset/workbook scope, payload fingerprint, schema version, sensitivity policy, and expiration/lifecycle.
- Consent must invalidate when payload fingerprint, source data, schema, worksheet relationships, privacy mode, provider category, or policy changes.
- Audit summaries should record consent status and validation decisions without storing raw provider payloads, prompts, raw plans, SQL drafts, raw values, query results, or token mappings.
- If consent is missing, expired, or scope-mismatched, the result is rejected even when the plan is otherwise schema-valid.

## Business SQL Planner/Renderer Connection

The Shadow Plan Validator should connect to Business SQL only through a narrow deterministic bridge:

1. Convert validated plan references into a deterministic internal planning request.
2. Let the existing Business SQL planner decide whether the business question has a supported plan shape.
3. Let join path resolution validate active accepted relationships.
4. Let render readiness decide whether SQL can be prepared.
5. Let the renderer emit SQL only for supported deterministic plans.
6. Keep Insert SQL manual.
7. Keep Run Query manual.

This preserves the current authority chain:

```text
LLM shadow plan -> deterministic validation -> deterministic planning request -> Business SQL planner -> join readiness -> render readiness -> Business SQL renderer -> manual Insert SQL -> manual Run Query
```

The LLM never becomes the final ranking, planning, SQL, insertion, execution, or relationship authority.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| LLM hallucinates tables/columns | Invalid or misleading plans | Strict schema validator rejects unknown and ambiguous references. |
| LLM uses suppressed/prohibited columns | Privacy breach | Re-run classifier and shadow policy; fail closed on restricted/suppressed references. |
| LLM leaks raw values or provider text | Privacy and governance breach | Recursive prohibited-content scan; reject and summarize only counts/reasons. |
| LLM emits SQL that looks safe | Authority confusion | Reject SQL-as-authority; run SQL safety only as diagnostic quarantine. |
| Relationship candidates treated as joins | Incorrect SQL | Require active accepted schema-backed contracts and render readiness. |
| Payload/plan mismatch | Stale or cross-dataset plan influence | Fingerprint and scope binding across dataset/workbook/schema/privacy/consent. |
| Token references escape Level 3 | Re-identification risk | Reject token vault/mapping references and tokenized mode in default/public product. |
| Validator silently broadens Business SQL support | Unsafe renderer coupling | Business SQL support validator must reject unsupported shape rather than infer new behavior. |
| Audit logs capture sensitive plan text | Secondary leakage | Store only non-sensitive summaries and fingerprints. |

## Implementation Prerequisites

Before implementation, FiltraQueri should have:

- Stable typed `LlmShadowPlan` and result contracts with exhaustive violation enums.
- A plan JSON schema or equivalent runtime parser that rejects unknown/unsafe structure.
- Payload manifest and fingerprint lifecycle contracts.
- Privacy mode and consent lifecycle contracts for Level 2 or higher.
- Deterministic alias map format, if schema aliasing is allowed.
- A rehydration guard contract that maps only schema references and never raw values.
- A relationship validation adapter over accepted relationship contracts and join path readiness.
- A Business SQL support adapter that can answer whether a validated plan shape is renderable without rendering SQL.
- A quarantined SQL-text detector path for plans that include SQL-like content.
- Non-sensitive audit summary types.
- Fixture-first coverage for rejection and safe-acceptance scenarios.

## Fixture Coverage Needed Before Implementation

Minimum fixture coverage should include:

### Structure and authority

- Accept minimal metadata-only valid plan.
- Reject unknown top-level raw rows field.
- Reject provider transcript field.
- Reject execution instruction.
- Reject SQL text as final authority.
- Reject oversized assumptions or nested unrecognized content.

### Fingerprint, privacy, and consent

- Accept matching payload fingerprint.
- Reject missing/stale/mismatched fingerprint.
- Reject metadata-only plan containing bucket/sample references.
- Reject Level 2 plan without consent.
- Reject Level 2 plan with wrong consent scope.
- Reject Level 3 tokenized plan in default/public mode.

### Schema and sensitivity

- Reject hallucinated table.
- Reject hallucinated column.
- Reject ambiguous alias.
- Reject unknown metric.
- Reject restricted/suppressed column.
- Reject raw sensitive filter literal.
- Accept safe business metric and grouping when supported.

### Relationships and rendering

- Accept active accepted relationship contract.
- Reject relationship candidate not confirmed by user.
- Reject broken/inactive relationship contract.
- Reject unsupported join path.
- Reject plan shape unsupported by Business SQL renderer.
- Ensure accepted validated plan still requires manual Insert SQL and Run Query.

### Audit summary

- Audit summary contains fingerprints, status, counts, and no-execution flags.
- Audit summary excludes raw plan text, raw values, SQL drafts, provider response text, query results, and token mappings.

## Recommendation for Next Slice

Recommended next slice: **T-24G-1: Shadow Plan Validator Types Only** before **T-24H: Consent/Disclosure UI Audit**.

Rationale:

- Consent copy and UI should disclose concrete capabilities and prohibitions. Types-only validator contracts would define the exact plan shape, violation taxonomy, privacy-mode fields, audit summary fields, and no-execution invariants that the consent UI must explain.
- A types-only slice can remain non-runtime and low risk while locking down the deterministic boundary before implementation.
- T-24H should follow once the contracts clarify what consent must cover for metadata-only, Level 2 masked/synthetic, and any explicitly rejected/deferred Level 3 paths.

T-24G-1 should still avoid provider calls, backend/API/UI/storage, payload construction, SQL behavior changes, insertion, execution, and renderer changes. It should add only inert TypeScript contracts and fixtures if approved.

## Final Design Position

FiltraQueri should treat future LLM shadow plans as **untrusted advisory input**. A plan may help identify what deterministic FiltraQueri components should consider, but it must pass a strict deterministic validator before it can influence planning or user-visible recommendations. Even after acceptance, it should become only a sanitized deterministic planning request; Business SQL readiness, renderer support, manual Insert SQL, and manual Run Query remain intact.
