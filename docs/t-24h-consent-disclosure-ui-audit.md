# T-24H - AI Consent and Disclosure UI Audit

## Purpose

This document designs FiltraQueri's future user-facing consent and disclosure experience for any LLM/privacy mode. It is audit/design only: no UI is implemented, no React components are added, no providers are called, no backend/API/storage is added, no payloads are built, no synthetic data is generated, no token vault is added, and SQL generation, Insert SQL, Run Query, Ask ranking, and Business SQL planner/renderer behavior remain unchanged.

Core question:

> How should FiltraQueri clearly tell users what AI mode is active, what data categories may be sent, what is never sent, what privacy risks remain, and what actions still require manual user control?

## Files Inspected

Prior T-24 privacy strategy and validator audits:

- `docs/t-24a-privacy-preserving-llm-shadow-data-strategy-audit.md`
- `docs/t-24e-synthetic-sample-strategy-audit.md`
- `docs/t-24f-tokenization-vault-ship-defer-reject-audit.md`
- `docs/t-24g-deterministic-shadow-plan-validator-audit.md`

LLM/privacy/provider foundations:

- `frontend/src/features/analyst/llm/llmPrivacyModes.ts`
- `frontend/src/features/analyst/llm/llmShadowDataPolicy.ts`
- `frontend/src/features/analyst/llm/llmMetadataPayloadBuilder.ts`
- `frontend/src/features/analyst/llm/llmShadowPlanValidator.ts`
- `frontend/src/features/analyst/llm/llmConsentPolicy.ts`
- `frontend/src/features/analyst/llm/llmProviderBoundary.ts`
- `frontend/src/features/analyst/llm/llmProviderBoundaryTypes.ts`

Current SQL/AI consent and provider-boundary surfaces:

- `frontend/src/features/analyst/sql/SqlAssistantPanel.tsx`
- `frontend/src/features/analyst/sql/SqlWorkspace.tsx`
- `frontend/src/features/analyst/sql/AdaptiveProposalLlmConsentShell.tsx`
- `frontend/src/features/analyst/sql/AdaptiveProposalLlmConsentDisclosure.tsx`
- `frontend/src/features/analyst/sql/adaptiveProposalLlmConsentShellAdapter.ts`
- `frontend/src/features/analyst/sql/adaptiveProposalLlmAuditSnapshot.ts`

## Current Consent and Provider Boundary Status

FiltraQueri already has a conservative AI boundary posture:

1. **Default mode is closed.** The default privacy mode is `no_llm`, and a default privacy decision refuses LLM use.
2. **Privacy levels and categories exist.** Current types distinguish no LLM, metadata-only, masked/synthetic samples, private reversible tokenization, and raw-data-prohibited modes.
3. **Raw-data categories are blocked by default.** Raw rows, sample values, top values, prompt text, SQL drafts, query results, provider responses, and tokenization vaults are default prohibited categories.
4. **Level 1 metadata-only categories are defined.** Dataset metadata, worksheet metadata, column metadata, relationship metadata, data-profile summaries, and sensitivity metadata are the intended metadata-only categories.
5. **Level 2 categories are identified but not implemented.** Aggregate summaries, masked sample rows, synthetic sample rows, and bucketed values are marked as shadow-data categories requiring consent.
6. **Consent is currently provider-boundary scaffolding, not a complete mode lifecycle.** Consent records can represent not requested, granted, denied, or revoked status, but there is no full UI lifecycle for mode-specific expiration, revocation, dataset changes, provider changes, or payload-fingerprint invalidation.
7. **Provider boundary is closed unless explicitly enabled.** Current boundary checks block disabled provider mode, local mock mode, missing consent, unsupported payload scopes, non-metadata scopes, sample policies, and restricted columns.
8. **Current visible UI is intentionally calm and limited.** SQL Assistant currently shows a local-preview safety line, a provider-boundary chip, and collapsed provider-boundary details for why no real provider call is made.
9. **Adaptive proposal consent shell is disabled preview-only.** It reports metadata-only counts, blocked reasons, exclusions, provider mode, consent status, and no-SQL/no-insert/no-run guarantees; the CTA remains disabled.
10. **Audit snapshots are non-sensitive.** Existing adaptive proposal snapshots store fingerprints, payload summaries, governance counts, validation status, and no-execution flags, not raw prompts, raw payloads, or raw provider responses.
11. **Manual control is already part of the SQL workspace language.** Current SQL workspace and assistant copy repeatedly says Insert SQL and Run Query remain manual.

## Proposed AI Mode Disclosure Model

Future AI disclosure should be organized around five user-visible questions:

1. **What mode is active?** Show the exact privacy level and plain-language label.
2. **What may be sent?** Summarize allowed payload categories before consent and show included categories after consent.
3. **What is never sent?** Always show blocked categories, especially raw rows, sample values, top values, query results, SQL drafts, prompt text, token vaults, provider responses, raw free-text values, and raw sensitive values.
4. **What risk remains?** State that privacy-preserved shadow data reduces exposure but does not remove all privacy, linkage, provider, or policy risk.
5. **What remains manual?** State that the LLM cannot insert SQL, cannot run queries, cannot execute actions, and cannot override deterministic validation.

The model should be consistent across an AI mode chip, consent focused view, payload summary panel, disclosure panel, audit summary, revoke action, disabled-mode explanation, sensitive-data warning, and manual Insert/Run reminder.

## Consent Model by Privacy Level

| Level | Mode | Consent posture | Provider posture | Default/public posture |
| --- | --- | --- | --- | --- |
| 0 | No LLM | No consent needed because no provider payload exists. | None. | Default safe baseline. |
| 1 | Metadata-only LLM | Explicit consent recommended before first external provider call, even though no values are sent. | External provider may receive metadata categories only. | Candidate first shippable provider mode after types, UI, audit, policy, and validation exist. |
| 2 | Masked/synthetic sample LLM | Strong explicit consent required per dataset/workbook/session and payload fingerprint. | External provider may receive approved metadata plus privacy-preserved shadow categories only after validation. | Deferred until Level 2 builder, validator, audit, and UI are complete. |
| 3 | Tokenized private mode | Strong explicit consent plus private/self-hosted deployment controls required. | Private/self-hosted model only; token vault never sent. | Rejected/deferred for default cloud. |
| 4 | Raw-data mode | Consent must not override prohibition. | Prohibited for external LLMs. | Never allowed as a product mode. |

## Required User-Facing Copy by Level

### Level 0: No LLM

**Mode name:** No AI provider

**Primary copy:**

> AI provider use is off. FiltraQueri is using local deterministic logic only. No dataset metadata, row values, SQL drafts, query results, prompts, provider responses, or token vaults are sent to an AI provider.

**Risk copy:**

> This avoids AI-provider data sharing. It does not change the normal risks of working with local files, browser state, exports, or manually run SQL.

**Manual-control copy:**

> FiltraQueri can still suggest local templates or deterministic report options. Insert SQL and Run Query remain manual.

### Level 1: Metadata-Only LLM

**Mode name:** Metadata-only AI

**Primary copy:**

> FiltraQueri may send dataset structure to an AI provider: table names, worksheet names, column names, inferred types, counts, relationship summaries, data-profile summaries, and sensitivity labels. Raw rows and value samples are not sent.

**Never-sent copy:**

> Not sent: raw rows, sample values, top values, query results, SQL drafts, prompt text, provider responses, token vaults, API keys, clipboard content, raw free-text values, or raw sensitive values.

**Risk copy:**

> Metadata-only AI reduces privacy risk, but metadata can still reveal business context, field names, schema design, and sensitive dataset themes. Do not use it for regulated or confidential datasets unless your organization allows this provider boundary.

**Manual-control copy:**

> AI output is advisory only. FiltraQueri's deterministic checks decide whether anything can be shown as a planning suggestion. The AI cannot insert SQL and cannot run queries.

### Level 2: Masked/Synthetic Sample LLM

**Mode name:** Privacy-preserved shadow data AI

**Primary copy:**

> FiltraQueri may send metadata plus privacy-preserved shadow data, such as coarse aggregates, bucketed values, masked placeholders, or synthetic example rows. These are designed to show broad data shape without sending real rows or raw values.

**Required caution copy:**

> Privacy-preserved shadow data reduces risk, but it is not risk-free. Patterns, rare combinations, column names, buckets, or business context may still reveal sensitive information. Synthetic examples are not automatically safe and must pass deterministic privacy checks before anything is sent.

**Avoided phrase:** Do not say "fake data is safe."

**Preferred phrase:**

> These examples are privacy-preserved shadow data, not copied records and not a guarantee of anonymity.

**Never-sent copy:**

> Not sent: real rows, raw sample values, raw top values, exact rare values, query results, SQL drafts, prompt text, provider responses, token vaults, token mappings, API keys, raw free text, raw sensitive values, or values suppressed by policy.

**Manual-control copy:**

> The AI can only suggest an advisory plan. Deterministic validators remain in control. Insert SQL and Run Query remain separate manual actions.

### Level 3: Tokenized Private Mode

**Mode name:** Private tokenized AI (not available in default cloud)

**Primary copy:**

> This mode would replace selected values with reversible tokens for a private/self-hosted model. The token vault maps tokens back to real values and must never leave the controlled deployment.

**Availability copy:**

> Not available in default/public FiltraQueri. This mode requires separate enterprise/private deployment review, key management, vault lifecycle controls, retention policy, monitoring, and incident response.

**Risk copy:**

> Tokenized data is still sensitive because tokens can preserve relationships, frequencies, and linkable patterns. If the vault is exposed, the original values may be exposed.

**Never-sent copy:**

> The token vault, token mappings, raw values, raw rows, query results, SQL drafts, provider responses, and prompt text must never be sent to an external provider.

**Manual-control copy:**

> Tokenization does not give the AI authority to insert SQL, run queries, rehydrate values, or bypass deterministic validation.

### Level 4: Raw-Data Mode Prohibited

**Mode name:** Raw data to AI prohibited

**Primary copy:**

> FiltraQueri does not allow raw rows, sample values, top values, query results, SQL drafts, raw prompts, provider responses, or token vaults to be sent to an external AI provider.

**Consent copy:**

> Consent cannot enable this mode. Raw-data AI sharing is blocked by product policy.

**Manual-control copy:**

> Use local deterministic analysis, manual SQL review, and manual Run Query instead.

## Consent Focused View Design

A future focused consent view should appear before any Level 1 or Level 2 external provider call and before any private Level 3 use. It should not appear for Level 0 beyond an optional informational state. It should include:

1. **Mode header:** level number, mode name, provider category, and current availability.
2. **Plain-language summary:** one or two sentences about what the mode does.
3. **What may be sent:** category checklist with counts and examples limited to category names, not raw values.
4. **What is never sent:** always-visible blocked list.
5. **Provider boundary:** provider disabled/open/closed status, provider category, retention/logging policy link placeholder, and enterprise policy status.
6. **Privacy risk statement:** short "reduced risk, not risk-free" explanation.
7. **Manual-control reminders:** AI cannot insert SQL, cannot run queries, cannot execute backend actions, and cannot override deterministic validation.
8. **Audit snapshot preview:** payload fingerprint, privacy mode, included/excluded category counts, sensitive/restricted column counts, consent scope, expiration, and provider-call status.
9. **Actions:** grant consent, deny, revoke if already granted, continue without AI, and view full audit details.

The primary consent CTA should use explicit mode language, for example:

- Level 1: `Allow metadata-only AI for this dataset`
- Level 2: `Allow privacy-preserved shadow data AI for this session`
- Level 3 private deployment only: `Allow private tokenized AI for this session`

Avoid vague CTAs such as `Enable AI`, `Make this safer`, or `Use anonymized data`.

## AI Mode Chip Copy

The AI mode chip should be visible anywhere AI suggestions, provider-boundary state, adaptive planning, or future shadow plans appear.

Recommended chip states:

| State | Chip copy | Secondary line |
| --- | --- | --- |
| Level 0 | `AI off · local deterministic only` | `No provider payload` |
| Level 1 closed | `Metadata-only AI · consent needed` | `No rows or values sent` |
| Level 1 open | `Metadata-only AI · provider open` | `Rows, values, SQL, and results blocked` |
| Level 2 closed | `Shadow-data AI · consent needed` | `Privacy-preserved, not risk-free` |
| Level 2 open | `Shadow-data AI · validated payload` | `Only approved shadow categories sent` |
| Level 3 unavailable | `Private tokenized AI · unavailable` | `Default cloud does not support token vaults` |
| Level 4 blocked | `Raw-data AI · prohibited` | `Consent cannot enable raw data sharing` |
| Admin disabled | `AI disabled by policy` | `No provider payload` |
| High sensitivity | `AI blocked · sensitive data` | `Restricted or regulated fields detected` |

## Payload Summary Panel Design

The payload summary panel should answer "what was included and excluded" without showing the raw payload. It should display:

- Privacy level and mode.
- Provider category and provider-boundary status.
- Consent status, scope, grant time, expiration time, and revoke availability.
- Payload fingerprint and schema/workbook fingerprint.
- Included category counts.
- Excluded category counts.
- Sensitive, restricted, suppressed, redacted, and allowed column counts.
- Rare-value threshold and suppression-policy summary when Level 2 is available.
- `Provider call made: yes/no`.
- `Raw payload stored: no`.
- `Raw provider response stored: no`.
- `SQL generated by AI: no` unless a future separately validated plan path changes the display wording; even then, SQL must not be provider authority.
- `Insert SQL performed: no`.
- `Run Query performed: no`.

Suggested summary copy:

> This panel shows categories and counts only. It does not show raw rows, sample values, query results, prompt text, provider responses, token mappings, or token vault contents.

## What Is Sent / What Is Not Sent Disclosure

Use two adjacent lists.

**May be sent in this mode** should be generated from the active mode and payload manifest. Examples:

- Dataset metadata.
- Worksheet metadata.
- Column metadata.
- Relationship metadata.
- Data-profile summary.
- Sensitivity metadata.
- Aggregate summaries, only for Level 2 after validation.
- Bucketed values, only for Level 2 after validation.
- Masked/synthetic sample rows, only for Level 2 after validation.

**Never sent by default** should be invariant and visible:

- Raw rows.
- Real sample values.
- Real top values.
- Exact rare values.
- Query results.
- SQL drafts.
- Raw user prompt text.
- Provider responses.
- API keys or credentials.
- Clipboard content.
- Raw free-text values.
- Raw sensitive values.
- Token vaults or token mappings.

## Revoke and Expiration Behavior

Consent should be easy to revoke and should expire automatically.

Recommended rules:

1. **Level 1 consent scope:** dataset or workbook scope with session fallback; expire on dataset/workbook/schema/provider/policy/fingerprint change.
2. **Level 2 consent scope:** session-first, dataset/workbook-bound; expire on any payload fingerprint change, schema change, sensitivity policy change, rare-threshold change, provider change, source re-ingestion, mode change, or browser session end.
3. **Level 3 consent scope:** session-only by default in private deployments; revoke destroys any in-memory vault and invalidates rehydration.
4. **Revocation action:** visible near every AI mode chip, consent view, and payload summary.
5. **After revoke:** provider boundary closes, pending provider calls are blocked, cached advisory plans are marked stale, token vaults are destroyed if applicable, and UI returns to Level 0/local deterministic behavior.
6. **Audit after revoke:** retain only non-sensitive counts, fingerprints, timestamps, and revocation status; never retain raw payloads, prompts, provider responses, token mappings, or values.

Suggested revoke copy:

> Revoke AI consent. Future provider calls will be blocked for this scope. Existing non-sensitive audit summaries may remain, but raw payloads, provider responses, and token vaults are not stored by default.

## Privacy Audit Summary Display

The audit summary should be user-readable and non-sensitive. It should show:

- Mode used.
- Consent status and scope.
- Provider boundary status.
- Provider call made or blocked.
- Payload fingerprint.
- Included categories and excluded categories.
- Counts of tables, columns, sensitive columns, restricted columns, redacted columns, suppressed columns, and excluded columns.
- Validation status and blocking reasons.
- Deterministic checks applied.
- No-execution guarantees: AI could not insert SQL, could not run queries, and could not mutate storage.
- Audit storage guarantees: raw prompt not stored, raw payload not stored, raw provider response not stored, token vault not stored.

Suggested audit summary copy:

> This audit snapshot records mode, consent, category counts, fingerprints, validation results, and no-execution flags. It does not store raw rows, raw values, prompt text, provider responses, SQL drafts, query results, or token mappings.

## Sensitive and Regulated Dataset Warning Behavior

High-sensitivity warning should appear when restricted, regulated, or unusually sensitive columns are detected; when rare-value or uniqueness risk is high; when free-text sensitive fields exist; or when enterprise policy requires manual review.

Recommended warning copy:

> Sensitive or regulated fields were detected. AI provider use is blocked or requires organization approval. FiltraQueri can continue with local deterministic analysis. Do not send this dataset to an AI provider unless your policy explicitly allows it.

Specific behavior:

1. **Restricted columns present:** block provider boundary by default.
2. **Health, financial, contact, personal identifiers, address/location, credentials, free text:** require stronger warning and default suppression.
3. **High uniqueness or rare combinations:** block Level 2 shadow samples unless deterministic validation proves k-safe grouping.
4. **Unknown sensitivity:** require review or metadata-only fallback.
5. **Regulated label from enterprise policy:** show policy owner/contact and do not offer consent if disabled.

## Enterprise/Admin Policy Behavior

Enterprise/admin policy should be represented as a first-class disclosure state, not as a generic failure.

Recommended disabled copy:

> AI is disabled by your organization for this dataset or workspace. No provider payload will be sent. You can continue using local deterministic templates, SQL review, and manual Run Query.

Recommended mode-specific disabled copy:

- Level 1 disabled: `Metadata-only AI is disabled by policy.`
- Level 2 disabled: `Shadow-data AI is disabled by policy or not approved for this dataset.`
- Level 3 disabled: `Private tokenized AI is not configured for this deployment.`
- Level 4 disabled: `Raw-data AI is prohibited and cannot be enabled.`

The UI should show whether the block came from global policy, workspace policy, dataset sensitivity, provider configuration, missing consent, expired consent, or validation failure.

## Explaining "Privacy-Preserved but Not Risk-Free"

Use this standard copy everywhere Level 2 or Level 3 is discussed:

> Privacy-preserved data reduces what is exposed to the AI provider, but it does not remove all risk. Field names, metadata, buckets, rare patterns, business context, synthetic examples, or tokens may still reveal sensitive information. FiltraQueri uses deterministic checks to reduce this risk, and some datasets remain blocked.

Do not use:

- `anonymous` unless a separate irreversible anonymization review proves it.
- `safe fake data`.
- `no privacy risk`.
- `fully private` for external providers.
- `AI verified` as a substitute for deterministic validation.

Prefer:

- `privacy-preserved shadow data`.
- `masked placeholders`.
- `bucketed values`.
- `synthetic examples, not copied records`.
- `reduced exposure, not zero risk`.

## Explaining LLM Advisory-Only Behavior

Use a persistent reminder near AI output:

> AI suggestions are advisory only. FiltraQueri validates references, privacy rules, relationships, and SQL readiness deterministically before anything can influence planning.

When a future plan is accepted for deterministic planning:

> This plan passed deterministic checks for planning use only. It is not SQL and cannot run anything.

When rejected:

> AI output was rejected by deterministic checks. The original planning state remains unchanged.

## Manual Insert SQL and Run Query Reminders

Recommended copy near SQL-related AI surfaces:

> The AI cannot insert SQL. If FiltraQueri prepares a SQL draft through deterministic logic, you must choose Insert SQL yourself.

> The AI cannot run queries. Run Query is always a separate manual action.

> Provider output is never executable authority. The deterministic SQL planner and renderer remain the final SQL authority.

## Provider Boundary Status

Provider boundary should have three clear values:

1. **Closed:** no provider call can be made.
2. **Consent needed:** payload appears eligible, but user consent is missing or expired.
3. **Open for this mode:** provider call may be made only with the displayed categories and active consent.

Suggested provider detail copy:

> Provider boundary: closed. Reason: provider disabled / consent not granted / restricted fields detected / policy disabled / validation failed.

> Provider boundary: open for metadata-only AI. Only displayed metadata categories may be sent. Raw rows, values, SQL drafts, query results, provider responses, and token vaults remain blocked.

## Included/Excluded Audit Snapshot

The audit snapshot should display included and excluded categories as counts and labels, not payload content.

Recommended fields:

- `Included categories`: list.
- `Excluded categories`: list.
- `Suppressed categories`: list for Level 2.
- `Blocked by policy`: list.
- `Blocked by sensitivity`: count and categories.
- `Blocked by validator`: reason codes.
- `Payload fingerprint`: value or unavailable.
- `Consent fingerprint match`: yes/no.
- `Schema fingerprint match`: yes/no.
- `Provider response stored`: no.

## Risks and Mitigations

| Risk | Mitigation | Residual concern |
| --- | --- | --- |
| User assumes metadata-only means no disclosure | Plain copy that metadata can reveal business context | Users may still underestimate schema sensitivity |
| User assumes synthetic means safe | Avoid "fake data is safe"; require "privacy-preserved, not risk-free" copy | Shadow data may still leak patterns |
| Consent becomes stale after schema or policy changes | Fingerprint-scoped consent with automatic invalidation | Requires exact lifecycle wiring |
| Provider state is hidden or confusing | Always-visible mode chip plus details panel | More UI density |
| Sensitive datasets slip into Level 2 | Restricted/sensitive/rare-value blockers and high-sensitivity warnings | Classifier false negatives remain possible |
| Tokenization perceived as anonymization | Explicit Level 3 warning and default-cloud unavailability | Private deployments still need mature controls |
| AI output perceived as executable | Persistent advisory-only and manual Insert/Run copy | User may copy advice manually elsewhere |
| Audit logs become sensitive | Store counts/fingerprints only; never raw payloads/responses | Debug tooling must follow same rule |

## Implementation Prerequisites

Before implementing any runtime UI beyond documentation, FiltraQueri should add:

1. Consent/disclosure contract types for mode labels, copy blocks, payload category summaries, provider boundary display, expiration, revoke state, and audit display.
2. A mode-to-copy mapping that is test-covered and avoids prohibited language.
3. A payload-category summary contract shared by consent view, chip, audit summary, and provider-boundary details.
4. Consent invalidation rules tied to payload fingerprint, schema fingerprint, provider category, mode, policy version, sensitivity classifier version, source re-ingestion, dataset/workbook/session scope, and revoke status.
5. Sensitive/regulatory warning contract types.
6. Enterprise/admin disabled-mode reason types.
7. Non-sensitive audit snapshot display types.
8. Fixture tests proving raw rows, sample values, top values, query results, SQL drafts, prompt text, provider responses, token vaults, and token mappings remain blocked by default.

## Recommended Next Slice

Proceed with **T-24H-1: Consent/Disclosure Types Only** before T-24I.

Rationale:

- The UI language and disclosure model now needs stable contracts before any React implementation.
- Types-only work can encode mode copy, category summaries, expiration/revoke reasons, provider-boundary display states, enterprise policy disablement, high-sensitivity warnings, and no-execution invariants without changing runtime behavior.
- T-24I enterprise/private deployment strategy will be stronger once the consent/disclosure vocabulary is explicit and testable.

T-24H-1 should remain contract-only: no UI components, no provider calls, no backend/API/storage, no payload generation, no SQL behavior changes, and no synthetic/token vault implementation.

## Confirmation of No Runtime Changes

This slice adds only this Markdown audit/design document. It does not change source code, runtime behavior, SQL generation, Insert SQL, Run Query, Ask ranking, Business SQL planner/renderer behavior, provider calls, payload construction, synthetic generation, token vault behavior, backend/API behavior, or storage behavior.
