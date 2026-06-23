# T-24A - Privacy-Preserving LLM Shadow Data Strategy Audit

## Purpose

This audit explores a future FiltraQueri Privacy-Preserving LLM Shadow Data Layer: a way to let an LLM reason over metadata, masked values, tokenized values, aggregates, or synthetic rows without exposing raw user data by default.

This is strategic architecture only. It does not authorize implementation, provider calls, backend changes, storage, SQL generation, SQL insertion, query execution, UI changes, or relationship state changes.

Core question:

Can FiltraQueri safely support a future LLM Privacy Sandbox where the LLM receives privacy-preserved shadow data instead of raw data, while deterministic verification remains the final authority before anything is shown, inserted, executed, or trusted?

## Files Inspected

Primary LLM and provider boundary files:

- `frontend/src/features/analyst/llm/llmMetadataPayloadBuilder.ts`
- `frontend/src/features/analyst/llm/llmSensitiveColumnClassifier.ts`
- `frontend/src/features/analyst/llm/llmRedactionPolicy.ts`
- `frontend/src/features/analyst/llm/llmConsentPolicy.ts`
- `frontend/src/features/analyst/llm/llmProviderBoundary.ts`
- `frontend/src/features/analyst/llm/llmProviderBoundaryTypes.ts`
- `frontend/src/features/analyst/llm/llmSuggestionValidator.ts`
- `frontend/src/features/analyst/llm/llmSqlSafetyValidator.ts`
- `frontend/src/features/analyst/llm/llmGovernanceTypes.ts`

Adaptive proposal LLM precedent:

- `frontend/src/features/analyst/sql/adaptiveProposalLlmPayloadBuilder.ts`
- `frontend/src/features/analyst/sql/adaptiveProposalLlmProviderGate.ts`
- `frontend/src/features/analyst/sql/adaptiveProposalLlmConsent.ts`
- `frontend/src/features/analyst/sql/adaptiveProposalLlmAuditSnapshot.ts`
- `frontend/src/features/analyst/sql/adaptiveProposalLlmValidator.ts`
- `frontend/src/features/analyst/sql/adaptiveProposalLlmContract.ts`

SQL Ask, planning, rendering, validation, and provenance:

- `frontend/src/features/analyst/sql/sqlAskFiltraQueriAdapter.ts`
- `frontend/src/features/analyst/sql/businessSqlQueryPlanner.ts`
- `frontend/src/features/analyst/sql/businessSqlRenderer.ts`
- `frontend/src/features/analyst/sql/businessSqlRenderReadiness.ts`
- `frontend/src/features/analyst/sql/businessSqlJoinPathResolver.ts`
- `frontend/src/features/analyst/sql/sqlReadinessGuard.ts`
- `frontend/src/features/analyst/sql/sqlStaticSyntaxDiagnostics.ts`
- `frontend/src/features/analyst/sql/sqlResultProvenance.ts`
- `frontend/src/features/analyst/sql/sqlRelationshipReview.ts`
- `frontend/src/features/analyst/sql/sqlRelationshipConfirmation.ts`

Dataset, workbook, relationship, upload, and backend boundaries:

- `frontend/src/features/dataset/datasetTypes.ts`
- `frontend/src/features/workbook/workbookTypes.ts`
- `frontend/src/features/workbook/workbookMetadata.ts`
- `frontend/src/features/workbookRelationships/workbookRelationshipTypes.ts`
- `frontend/src/features/workbookRelationships/workbookRelationshipCandidates.ts`
- `backend/app/main.py`
- `backend/app/workbook_ingestion.py`
- `backend/app/workbook_relationships.py`
- `backend/app/workbook_models.py`

Governance and prior architecture:

- `docs/architecture/K11_LLM_Governance_and_Data_Safety_Contract.md`
- `frontend/scripts/governance-boundary-rules.mjs`
- `frontend/scripts/audit-governance-boundaries.mjs`

## Current Boundary Status

FiltraQueri already has a strong foundation for privacy-preserving AI:

- The default LLM provider boundary is closed unless explicitly enabled.
- The primary LLM payload builder is metadata-only and records `rawRowsIncluded: false`, `sampleRowsIncluded: false`, `promptTextIncluded: false`, and `sqlDraftIncluded: false`.
- The adaptive proposal LLM payload builder excludes restricted columns, redacts sensitive columns, and marks provider calls as closed.
- Consent state exists for metadata-only adaptive refinement, with copy that clearly says no raw rows, sample values, prompt text, SQL drafts, or query results.
- Audit snapshots store payload fingerprints and summaries, not raw prompts, raw payloads, or raw provider responses.
- SQL safety validation checks read-only shape, blocked SQL keywords, blocked file/network access patterns, trusted table references, trusted column references, restricted columns, sensitive columns, wildcard exposure, and multi-statement risk.
- Suggestion validation strips or rejects raw/sample/value/SQL fields and recomputes governed readiness.
- Business SQL planning and rendering are deterministic. The renderer only emits SQL for known shapes after readiness checks pass.
- SQL execution remains manual and backend-side. LLM-like planning surfaces do not execute queries.

This is a good posture for Level 1 metadata-only AI. It is not yet sufficient for a shadow-data sandbox because local metadata can still contain `sample_values`, `top_values`, preview rows, relationship sampled overlap evidence, original workbook layout previews, and backend raw row access. A future Privacy Gateway must sit before any provider payload and treat those local fields as unsafe unless deliberately transformed.

## Existing Privacy Protections

Current protections include:

- Metadata-only LLM payload provenance.
- Sensitive-column classification from column names, worksheet context, inferred types, and known risk terms.
- Redaction policy that marks raw values as never-send.
- Provider boundary policy that blocks raw rows, sample values, top values, prompt text, SQL drafts, API keys, and provider responses.
- Restricted-column blocking.
- Adaptive LLM payload redaction and restricted-column exclusion.
- Consent state tied to a payload fingerprint.
- Audit snapshots with no raw prompt/payload/provider response storage.
- Deterministic SQL validators and render readiness checks.
- Result provenance that separates displayed result state from current draft state.

These are mostly frontend governance foundations. They are not a complete privacy sandbox because they do not yet provide shadow sample generation, rare-value suppression, token vaults, deterministic rehydration, or a formal privacy validator.

## Existing LLM And Provider Boundaries

The current boundary is conservative:

- `llmConsentPolicy.ts` allows metadata categories and blocks raw/sample/top values.
- `llmProviderBoundary.ts` closes the boundary for disabled/local mock modes, missing consent, non-metadata payload scope, restricted columns, and unsupported payload scope.
- `adaptiveProposalLlmProviderGate.ts` reports `providerCallAllowed: false` and `providerCallMade: false`, even when metadata-only refinement becomes eligible.
- `adaptiveProposalLlmPayloadBuilder.ts` constructs a sanitized metadata-only payload and explicitly excludes raw rows, sample values, top values, SQL, prompt text, and provider calls.

This should remain the default. Any shadow-data layer should extend this boundary rather than bypass it.

## Existing Deterministic Reviewers And Validators

Relevant deterministic reviewers already exist:

- Sensitive column classifier and redaction policy.
- LLM metadata payload category summary.
- Provider boundary checker.
- Governed suggestion validator.
- AI SQL safety validator.
- SQL static syntax diagnostics.
- SQL readiness guard.
- Business SQL query planner.
- Business SQL render readiness evaluator.
- Business SQL renderer.
- Workbook relationship candidate and accepted contract models.
- Relationship confirmation helper types from T-23B/T-23C.
- Result provenance view model.

Future shadow-data support should reuse these patterns and add a new privacy validator specifically for transformed row/value payloads.

## Metadata-Only Payload Patterns

The safest existing pattern is:

- Include dataset and worksheet identity.
- Include trusted table names.
- Include column names, types, inferred types, null counts, unique counts, and profile-capability flags.
- Include relationship candidate metadata and sampled evidence summaries without values.
- Include deterministic report opportunities.
- Include SQL dialect guidance as metadata.
- Include sensitivity classifications and redaction labels.
- Exclude raw rows, sample values, top values, prompt text, SQL drafts, query results, provider responses, and secrets.

This is FiltraQueri's current best default and should become Level 1.

## Sensitive-Column And Consent Patterns

Current classification covers restricted security/account/token fields, health/patient fields, contact information, personal names, address/location fields, financial fields, free text, identifiers, and safe business metrics.

Current consent is payload-fingerprint aware and scoped to metadata-only adaptive refinement. Future shadow-data consent must be stronger:

- It must disclose the exact privacy level.
- It must disclose whether any row-shaped data is included.
- It must disclose whether values are masked, synthetic, tokenized, aggregated, bucketed, or suppressed.
- It must distinguish irreversible anonymization from reversible tokenization.
- It must disclose provider category and retention/logging implications.
- It must expire or invalidate when the payload fingerprint, source, scope, worksheet, schema, or privacy mode changes.

## Proposed Privacy Gateway Architecture

Introduce a future architecture layer between local data/workbook metadata and any LLM payload:

- `PrivacyGateway`: Orchestrates mode selection, sensitivity classification, consent, payload construction, audit summary, and deterministic privacy validation.
- `SensitiveColumnClassifier`: Extends the current classifier with row/value risk policies, uniqueness risk, rare-value risk, and domain-specific high-risk patterns.
- `ShadowDatasetBuilder`: Builds safe shadow context from metadata, aggregates, masked samples, synthetic samples, tokenized values, and schema aliases.
- `SyntheticSampleBuilder`: Creates synthetic shadow rows that preserve broad analytical shape without preserving raw values or rare outliers.
- `TokenizationVault`: Stores local reversible mappings only for trusted/private deployments. It should be session-scoped, in-memory first, never sent to providers, never persisted in the default/public product, and destroyed on consent revoke, dataset change, or session end.
- `LlmPrivacySandboxPayload`: Typed payload envelope with privacy mode, provenance, sensitivity summary, allowed categories, excluded categories, and no-execution invariants.
- `LlmShadowPlanValidator`: Validates LLM output as a plan only, not executable authority.
- `DeterministicRehydrationGuard`: Maps plan references back to real schema only when aliases, tokens, relationships, and sensitivity constraints validate.
- `PrivacyAuditSnapshot`: Stores payload category summary, privacy mode, consent state, provider category, hashes/fingerprints, exclusion counts, and validation decisions without raw payload storage.

Recommended placement:

1. Backend continues to ingest, profile, and execute real data locally.
2. Frontend or backend metadata consumers request a privacy-safe intelligence payload.
3. `PrivacyGateway` reads dataset/workbook/profile metadata and local policy.
4. `ShadowDatasetBuilder` emits an approved payload shape.
5. LLM receives only the approved sandbox payload.
6. LLM returns a structured plan/explanation.
7. Deterministic validators decide whether the plan can influence UI, planning, SQL rendering, insertion, or execution.

## Future Flow

1. User asks a business question.
2. FiltraQueri classifies schema, columns, source/scope, worksheet relationships, and value-risk profile.
3. FiltraQueri selects the safest intelligence mode available for the dataset and deployment.
4. FiltraQueri builds metadata-only or shadow-data payload.
5. User consent gate appears for any mode above metadata-only.
6. Provider boundary validates payload categories and consent.
7. LLM receives only the allowed sandbox payload.
8. LLM returns a structured plan, assumptions, and explanation, not executable authority.
9. Deterministic layer validates plan shape, schema references, aliases/tokens, relationships, sensitivity, privacy, and SQL readiness.
10. Deterministic SQL planner/renderer generates SQL only when safe.
11. Insert SQL remains explicit and guarded.
12. Run Query remains manual.
13. Result provenance records privacy mode and validation path.

Preservation rule: the LLM never executes, never inserts SQL, never mutates the editor, and never becomes final authority. The deterministic Business SQL planner/renderer remains the final SQL authority.

## Shadow Data Strategy Options

### Metadata-Only Summaries

Recommended default. Include schema, inferred types, row counts, column counts, null counts, unique counts, profile flags, relationship summaries, and deterministic report opportunities. Do not include values.

Good for:

- General business question understanding.
- Column/worksheet selection.
- Join planning candidates.
- Explaining available analysis options.

Not enough for:

- Understanding ambiguous categorical meanings.
- Detecting value-level semantics.
- Example-driven transformations.

### Masked Sample Rows

Replace values with masks such as `[EMAIL]`, `[NAME]`, `[CURRENCY_BUCKET]`, `[DATE_MONTH]`, or `[CATEGORY_A]`. Preserve row shape but not raw values.

Risks:

- Rare combinations can still identify people or business events.
- Masks may reveal protected-attribute structure.
- Free text is difficult to mask safely.

Use only with explicit consent and rare-value suppression.

### Reversible Tokenization

Replace values with stable local tokens, such as `tenant_token_001`, while preserving equality relationships. Keep mappings in a local/private vault.

Risks:

- Mapping vault compromise can re-identify data.
- Stable tokens can leak frequency and graph relationships.
- Rehydration can accidentally expose real values.

Use only for trusted/private deployments with strict vault isolation and deterministic rehydration guards. The default/public product should not persist a tokenization vault. If Level 3 is ever explored, the vault should be session-scoped, in-memory first, destroyed on consent revoke, dataset change, or session end, and considered only for private/self-hosted deployments.

### Irreversible Anonymization

Hash, bucket, or generalize values so they cannot be mapped back. Prefer salted local non-exported hashes only when equality preservation is necessary.

Risks:

- Small domains can be brute-forced.
- Hashes of emails, zip codes, IDs, or common categories can be reversible by dictionary.

Use only with domain-specific risk checks and avoid presenting hashes to the LLM when category labels are enough.

### Synthetic Sample Generation

Generate synthetic shadow rows that resemble broad schema patterns but do not derive from individual rows.

Risks:

- Naive synthetic generation can preserve outliers or rare patterns.
- It can create false business facts that the LLM over-trusts.
- It can break mapping back to real schema if values are too invented.

Best used for format examples and broad reasoning, not factual analysis.

### Aggregate-Only Summaries

Send counts, ranges, histograms, missingness, and coarse distributions.

Risks:

- Small bucket counts can leak individuals.
- Extremes can reveal outliers.

Use k-thresholds, bucket suppression, rounding, and noising. As a default conceptual threshold, suppress or generalize any value, bucket, row group, or joint pattern with `k < 5`. Regulated contexts may require higher thresholds.

### Safe Category Bucketing

Convert raw values into approved categories such as `high`, `medium`, `low`, `current_month`, `older_than_90_days`, or `amount_bucket_100_500`.

Risks:

- Buckets can still reveal sensitive status.
- Domain-specific categories may encode protected attributes.

Use only after sensitive category review.

### Row-Level And Rare-Value Suppression

Suppress rows, categories, buckets, or combinations below a minimum k threshold.

This should be mandatory for any row-shaped or aggregate payload above metadata-only. Use `k >= 5` as the default conceptual minimum before any shadow payload is eligible. Suppress or generalize rare values and rare joint patterns, not only rare single-column values. Healthcare, finance, education, HR, government, and other regulated contexts may need higher thresholds or a Level 0/Level 1-only policy.

### Schema Aliasing

Rename tables and columns to safe aliases while preserving deterministic mapping locally.

Risks:

- Over-aliasing reduces LLM usefulness.
- Under-aliasing can reveal sensitive business context.

Recommendation: alias restricted/sensitive column names, but allow safe business metrics and generic table names when policy permits.

## Recommended Privacy Levels

### Level 0: No LLM

Deterministic only. No provider payload. Best for highly sensitive, restricted, regulated, or user-disabled contexts.

### Level 1: Metadata-Only LLM

Default safest AI mode. Payload includes schema/profile summaries, sensitivity metadata, deterministic report summaries, relationship metadata, and SQL dialect guidance. No row values, sample values, top values, prompt text, query results, or SQL drafts.

### Level 2: Masked/Synthetic Sample LLM

Payload may include synthetic shadow rows, masked samples, aggregates, buckets, and category aliases after explicit user consent. Requires rare-value suppression, uniqueness risk checks, and privacy audit snapshot.

### Level 3: Reversible Tokenized Private Mode

Stable tokens preserve equality and joins while mappings remain in a local/backend vault. This is only appropriate for trusted/private/self-hosted deployments. Requires vault isolation, strict rehydration guards, and strongest deterministic verification.

Level 3 should not be assumed desirable. The privacy benefit over a strong Level 2 may be modest, while the mapping-vault risk and implementation complexity are substantial. Recommend deferring Level 3 until Levels 0-2 are proven safe and useful. T-24F should explicitly end with a ship/defer/reject decision rather than treating reversible tokenization as inevitable.

### Level 4: Prohibited Raw-Data Mode

External LLMs should not receive raw rows by default. Treat Level 4 as an out-of-scope marker, not a product goal. Any future raw-data reasoning would require a separate enterprise/private deployment strategy plus legal, compliance, infrastructure, logging, retention, and administrator-policy review. It should not be part of default FiltraQueri behavior.

## What Must Never Be Sent To External LLMs By Default

- Raw rows.
- Raw preview rows.
- Raw sample values.
- Raw top values.
- Full free-text notes, comments, descriptions, messages, complaints, incident details, medical text, HR notes, support narratives, or user-entered sensitive text.
- Access codes, passwords, API keys, secrets, tokens, credentials, private keys, or account numbers.
- Contact information, direct personal identifiers, precise addresses, health data, protected attributes, and financial account details.
- Uploaded file paths, local DuckDB paths, storage paths, API credentials, provider keys, or internal backend paths.
- SQL drafts unless a later SQL-specific governance layer explicitly permits sanitized validated drafts.
- Query results.
- Full prompt payloads containing user data or sensitive intent.
- Tokenization vault contents or reversible mapping tables.
- Raw provider responses that may contain echoed data.

## Key Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Shadow data can leak real meaning through rare patterns. | Add rare-value suppression, `k >= 5` thresholding by default, row-combination risk checks, and aggregate bucket suppression. Use higher thresholds in regulated contexts. |
| Reversible tokenization creates mapping-vault risk. | Keep vault session-scoped, in-memory first, local/private, never sent to providers, never persisted in the default/public product, and destroyed on consent revoke, dataset change, or session end. |
| Synthetic samples can preserve sensitive outliers. | Generate from coarse profiles, not row copies; suppress extremes; test for similarity to real records. |
| LLM hallucinates columns or joins. | Validate every table, column, relationship, alias, and join path against deterministic metadata. |
| LLM infers protected attributes. | Block protected/sensitive attributes from payload and outputs; require privacy validator on plan text. |
| LLM suggests unsafe SQL. | Treat SQL from LLM as untrusted; prefer plan-only response and deterministic SQL rendering. |
| LLM output does not map back to real schema. | Require alias/token map validation and reject unmapped references. |
| Rehydration exposes sensitive values. | Rehydrate schema references only, not raw values, unless a private deployment policy explicitly allows it. |
| Provider logging/retention risk. | Require provider disclosure, consent, enterprise policy, and audit snapshot with payload category summary. |
| Users may misunderstand shadow data as fully safe. | Avoid "fake data" in user-facing copy. Prefer "shadow data" or "privacy-preserved data"; explicitly say privacy-preserved does not mean risk-free. |

## Deterministic Verification Requirements

Any shadow-data LLM response must pass:

- Structured response validator.
- Payload fingerprint match.
- Privacy mode compatibility check.
- Consent validity check.
- Provider boundary check.
- Sensitive-column policy check.
- Rare-value and uniqueness risk check.
- Alias/token mapping validation.
- Schema validator.
- Relationship validator.
- Shadow plan validator.
- SQL readiness evaluator.
- Deterministic SQL renderer contract check.
- SQL static syntax validator.
- AI SQL safety validator if any SQL text is ever accepted as draft input.
- Insert SQL guard.
- Manual Run Query guard.
- Result provenance recorder.

The LLM can suggest reasoning. Deterministic systems must decide what is trusted. Insert SQL remains manual, Run Query remains manual, and any SQL authority remains with deterministic FiltraQueri planners, renderers, and validators.

## Consent And Disclosure Recommendations

Future UI copy should disclose:

- Which privacy level is active.
- Whether an external provider will receive a payload.
- Whether row-shaped data is included.
- Whether values are metadata-only, masked, synthetic, tokenized, bucketed, or aggregated.
- Whether reversible mappings exist locally.
- Whether raw values are excluded.
- Whether the LLM can generate SQL or only suggest a plan.
- That Insert SQL and Run Query remain manual.
- That privacy-preserved data reduces risk but does not make all disclosure risk impossible.

Consent should be bound to:

- Dataset/workbook id.
- Active source/scope.
- Payload fingerprint.
- Privacy mode.
- Provider category.
- Expiration timestamp.
- Schema/worksheet relationship version.

## Fit With FiltraQueri's AI-Native Vision

The strategic opportunity is not "send more data to an LLM." The opportunity is controlled intelligence:

- The LLM sees safe structure, patterns, and vocabulary when policy allows it.
- Deterministic systems verify privacy, schema, relationships, SQL readiness, and execution boundaries.
- The user stays in control of Insert SQL and Run Query.
- FiltraQueri remains useful because it can give the LLM enough safe structure to reason.
- FiltraQueri remains trustworthy because deterministic systems keep authority over privacy, schema, SQL, insert, execution, and provenance.
- Enterprises get a path toward stronger private deployments without weakening the default public/provider boundary.

This positions FiltraQueri as privacy-first advisor LLM plus deterministic execution analytics. It is neither "send the workbook to a model and hope" nor "avoid AI entirely." It is an AI-native architecture where the assistant can reason, but FiltraQueri verifies and the user remains in control.

## Preservation Contract

T-24 must preserve these existing product contracts:

- Insert SQL remains manual and guarded.
- Run Query remains manual and user-initiated.
- The LLM never executes queries.
- The LLM never mutates the SQL editor directly.
- The LLM never becomes final authority for privacy, schema, SQL, insertion, or execution.
- The deterministic Business SQL planner/renderer remains the final SQL authority.
- Relationship review remains read-only unless a later slice explicitly changes it: no persistence, no acceptance, no SQL generation, no backend call, and no Run Query.
- Adaptive proposal LLM fallback remains disabled by default.
- Business SQL preview manual insert/manual run boundaries remain unchanged.
- Existing source/scope, Ask ranking/order, relationship review, planner/renderer, backend/API, storage, and provider-call behavior remain unchanged until separately scoped.

## Architecture Recommendation

Start with types and validators before any UI or provider call:

1. Define privacy mode and payload category types.
2. Extend sensitive-column policy with row/value risk concepts.
3. Harden existing metadata-only payloads so local `sample_values` and `top_values` are never accidentally forwarded.
4. Design synthetic/masked sample strategy as an audit before implementation.
5. Defer reversible tokenization until deployment policy and vault requirements are clear.
6. Build a deterministic shadow-plan validator before connecting any LLM response to planning or SQL rendering.
7. Add consent/disclosure UI only after payload and validation contracts are stable.

## Proposed Implementation Roadmap

### T-24B: Privacy Mode Types Only

Add pure TypeScript types for privacy modes, payload categories, audit summaries, and no-execution invariants. No UI, state, provider calls, backend calls, or payload building.

### T-24C: Sensitive Column Policy Audit/Types

Extend the current classifier contract with row/value risk categories, rare-value risk, uniqueness risk, and protected/sensitive policy labels. Keep it pure.

### T-24D: Metadata-Only LLM Payload Hardening

Audit and harden metadata-only builders so `sample_values`, `top_values`, preview rows, prompt text, SQL drafts, and provider responses cannot leak into provider payloads.

### T-24E: Synthetic Sample Strategy Audit

Design synthetic and masked sample rules, suppression thresholds, category bucketing, and test fixtures. No provider calls.

### T-24F: Tokenization Vault Audit

Define vault threat model, deployment boundaries, local/private storage expectations, invalidation rules, and rehydration constraints. Do not implement vault storage yet. T-24F must explicitly conclude with a ship/defer/reject decision, and the default recommendation is to defer Level 3 until Levels 0-2 are proven safe.

### T-24G: Deterministic Shadow-Plan Validator

Create pure validators for LLM plan outputs: schema references, alias/token references, relationship references, sensitivity constraints, and no-SQL/no-execution invariants.

### T-24H: Consent/Disclosure UI Audit

Design user-facing privacy mode disclosures, consent copy, payload summary display, and audit snapshot visibility.

### T-24I: Enterprise/Private Deployment Strategy

Document private-model, self-hosted, administrator policy, retention, logging, audit export, and vault governance options.

## Recommended Next Slice

Proceed with T-24B: privacy mode types only.

Keep it small and pure. The next slice should define the vocabulary for privacy levels, payload categories, safety flags, consent scope, audit snapshot summaries, and no-execution invariants. It should not build payloads, call providers, add UI, persist anything, generate SQL, insert SQL, run SQL, or touch backend/API code.
