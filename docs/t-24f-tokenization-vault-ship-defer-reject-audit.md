# T-24F - Tokenization Vault Ship/Defer/Reject Audit

## Purpose

This audit evaluates whether FiltraQueri should ever support **Level 3 reversible tokenized private mode**, where sensitive local values are replaced with stable local tokens and a local vault maps those tokens back to original values.

This is **audit/design only**. It does not implement a tokenization vault, storage, encryption, provider calls, backend/API behavior, UI, payload building, synthetic generation, SQL generation, Insert SQL, Run Query, Ask ranking, or Business SQL planner/renderer behavior.

## Files Inspected

Primary prior privacy strategy and Level 2 design:

- `docs/t-24a-privacy-preserving-llm-shadow-data-strategy-audit.md`
- `docs/t-24e-synthetic-sample-strategy-audit.md`

Privacy foundation and provider-boundary source files:

- `frontend/src/features/analyst/llm/llmPrivacyModes.ts`
- `frontend/src/features/analyst/llm/llmShadowDataPolicy.ts`
- `frontend/src/features/analyst/llm/llmMetadataPayloadBuilder.ts`
- `frontend/src/features/analyst/llm/llmSensitiveColumnClassifier.ts`
- `frontend/src/features/analyst/llm/llmConsentPolicy.ts`
- `frontend/src/features/analyst/llm/llmProviderBoundary.ts`

## Executive Summary

**Final recommendation: Reject for default/public FiltraQueri cloud; defer for private, self-hosted, and enterprise governed deployments until Levels 0-2 are proven and a full privacy validator, consent UI, deployment policy, vault lifecycle contract, and rehydration guard exist.**

Level 3 reversible tokenization can be useful in narrow, governed deployments because it may let an LLM reason about stable entity references without exposing raw values to the provider. However, it creates a new high-value secret: the **tokenization vault**. If that vault leaks, the protection collapses. Even if the vault does not leak, stable tokens can reveal frequency, grouping, linkage, and graph relationships. Tokenization does not make sensitive data automatically safe.

For the default/public product, FiltraQueri should not ship Level 3. Level 2 masked/synthetic samples offer a safer path to value because they avoid reversible mappings and intentionally break record identity. Level 3 should remain a private-deployment research/design candidate only, not a public-cloud feature.

## Current Privacy Posture Relevant to Level 3

T-24A established that current LLM behavior should remain metadata-first and that any future Privacy Gateway must sit before provider payloads. It also identified `TokenizationVault` as a possible future private-deployment component that must be session-scoped, in-memory first, never sent to providers, never persisted in the default/public product, and destroyed on consent revoke, dataset change, or session end.

T-24E designed Level 2 as masked/synthetic shadow data, emphasizing that future row-shaped examples must be non-factual, not copied from real rows, generated from coarse metadata/distributions, threshold-safe, and deterministically validated before provider use.

The current source foundation already recognizes Level 3 conceptually:

- `llmPrivacyModes.ts` defines `reversible_tokenized_private`, `tokenized_values`, and `tokenization_vault` as distinct payload concepts.
- `llmPrivacyModes.ts` keeps `tokenization_vault` in raw-data-prohibited categories, meaning mappings are not payload content.
- `llmPrivacyModes.ts` flags reversible tokenized mode as private-model oriented and cautions that it should remain deferred until Levels 0-2 are proven safe.
- `llmShadowDataPolicy.ts` allows tokenization only for `reversible_tokenized_private`, treats tokenization as caution/defer, and keeps raw values prohibited.
- `llmMetadataPayloadBuilder.ts` continues to build metadata-only payloads with no raw/sample/top values.
- `llmConsentPolicy.ts` and `llmProviderBoundary.ts` maintain a metadata-only provider boundary and block raw rows, sample/top values, prompt text, SQL drafts, API keys, and provider responses.

## What Level 3 Reversible Tokenization Means

Level 3 reversible tokenization means FiltraQueri would locally transform a sensitive value into an opaque token before any LLM-facing payload is built.

Example conceptual transformation:

| Original local value | Provider-visible token |
| --- | --- |
| `alice@example.com` | `tok_customer_email_7F3A...` |
| `Tenant A` | `tok_tenant_91BC...` |
| `INV-10422` | `tok_invoice_C02D...` |

A local vault would hold mappings such as:

```text
tok_customer_email_7F3A... -> alice@example.com
tok_tenant_91BC... -> Tenant A
tok_invoice_C02D... -> INV-10422
```

The LLM may see tokenized values, but it must never see the mappings. Deterministic local systems may later use the vault to interpret or rehydrate token references if, and only if, a strict guard validates scope, consent, lifecycle, sensitivity, and plan shape.

## How Tokenization Differs from Masking, Bucketing, Suppression, and Synthetic Generation

| Technique | Reversible? | Provider sees stable entity reference? | Main value | Main risk |
| --- | --- | --- | --- | --- |
| Suppression | No | No | Removes high-risk values entirely | Lower analytical context |
| Masking | No, if implemented as placeholders | Usually no | Shows that a sensitive field exists | Can still reveal column semantics |
| Bucketing | No, if coarse and k-safe | Sometimes coarse group only | Preserves broad numeric/date shape | Rare buckets can identify people/events |
| Synthetic generation | No, if not copied from rows | No real entity identity | Gives row-shaped examples without factual truth | Bad generation may reproduce rare patterns |
| Reversible tokenization | Yes, through local vault | Yes | Preserves stable equality/linkage while hiding raw value text | Vault leak, frequency leakage, relationship leakage, re-identification |

The decisive difference is reversibility. Level 2 should intentionally break exact identity. Level 3 preserves exact identity behind a local indirection layer.

## What the Token Vault Would Contain

A token vault would contain enough information to reverse tokens back to original local values. Depending on design, it could include:

- Token string.
- Original raw value.
- Column and table/workbook scope.
- Dataset/workbook/session identifiers.
- Sensitivity category and policy decision.
- Creation timestamp and lifecycle expiration.
- Consent fingerprint and payload fingerprint.
- Token namespace/version.
- Optional non-reversible audit fingerprints or counts.

The vault must **not** be confused with an audit manifest. A manifest may record counts, categories, policy decisions, and fingerprints. The vault contains actual reversible secrets.

## Why the Token Vault Is Sensitive

The vault is sensitive because it is effectively a concentrated copy of the most important private values in the dataset. It may contain names, emails, account numbers, tenant IDs, invoice IDs, health identifiers, customer identifiers, employee identifiers, payment identifiers, or other regulated data.

A vault can be more dangerous than the original dataset slice because it is curated around values selected for LLM reasoning. An attacker who obtains it can map every token in LLM-visible prompts, model logs, browser memory snapshots, debugging traces, audits, or copied outputs back to raw values.

## What Happens If the Vault Leaks

If the vault leaks:

1. Every captured tokenized prompt or provider-visible token becomes re-identifiable.
2. Any provider-side retention/logging of tokenized payloads becomes linkable to raw values.
3. Stable tokens copied into screenshots, audit logs, error reports, browser traces, or support tickets become sensitive.
4. Relationship graphs can be reconstructed across tables, worksheets, and sessions if token namespaces are reused.
5. Breach scope may be hard to determine because old tokens can remain meaningful if the same vault or deterministic token scheme is reused.

This is why default/public FiltraQueri should not persist vaults and should reject Level 3 as a public-cloud feature.

## Stable Token Leakage Even Without Vault Leak

Even if the vault never leaves the local trust boundary, stable tokens reveal structure:

- **Frequency:** repeated tokens reveal common customers, tenants, patients, employees, products, vendors, accounts, incidents, or transactions.
- **Grouping:** shared tokens reveal which records belong together.
- **Joins:** the same token across worksheets reveals relationships that may be sensitive.
- **Graph patterns:** high-degree nodes can identify VIP customers, high-risk patients, problem tenants, fraud targets, or major vendors.
- **Outliers:** rare tokens are often identifying even without raw text.
- **Temporal behavior:** repeated tokens across time buckets can expose activity histories.

Therefore, tokenized values remain sensitive shadow data. They are not anonymous data.

## Does Level 3 Provide More Value Than Level 2?

Level 3 provides additional value only when stable equality matters:

- Entity continuity across rows.
- Join reasoning across worksheets without raw join keys.
- Detecting repeated references or hub entities.
- Explaining relationship patterns in a private deployment.
- Allowing deterministic local systems to rehydrate advisory plan references after validation.

However, much of FiltraQueri's near-term LLM value can be achieved without Level 3:

- Metadata-only payloads support worksheet/column understanding and deterministic report recommendations.
- Level 2 masked/synthetic samples can explain broad shape, metric bands, date buckets, and common category groups.
- Deterministic relationship metadata can describe sampled overlap ratios without exposing values.
- Deterministic SQL planners/renderers already remain the final authority.

Because Level 3 mostly improves entity-link reasoning while adding a vault threat surface, it is not worth shipping until Levels 0-2 are proven and governed deployments have explicit need.

## Threat Model

### Assets

- Original raw values.
- Token-to-value mappings.
- Tokenized provider payloads.
- Tokenized LLM outputs.
- Payload manifests and audit summaries.
- Consent and policy decisions.
- Dataset/workbook/session scope identifiers.

### Adversaries and Failure Modes

- External provider retains tokenized payloads and later receives leaked vault mappings.
- Browser extension, local malware, memory dump, support tooling, or crash logging captures vault contents.
- Application bug includes vault mappings in provider payload, logs, analytics, audit snapshots, or error reports.
- Stable tokens are reused across datasets/workbooks/sessions, enabling cross-context linkage.
- Sequential or meaningful tokens reveal row order, cardinality, entity type, or source identity.
- LLM output returns token references that users paste elsewhere, accidentally distributing sensitive linkable identifiers.
- Rehydration incorrectly maps a token to raw value after consent revoke or dataset/schema change.
- Rare-token combinations identify individuals without requiring vault access.

### Non-Goals

Level 3 must not authorize:

- Raw rows in provider payloads.
- Token vault transmission to providers.
- Automatic SQL insertion.
- Automatic query execution.
- LLM authority over final analysis, ranking, SQL, or governance decisions.

## Risk and Mitigation Analysis

| Risk | Severity | Mitigation | Residual concern |
| --- | --- | --- | --- |
| Vault leak exposes raw values | Critical | No vault in public/default product; private only; in-memory session scope; destroy aggressively | Memory and endpoint compromise remain possible |
| Tokens leak frequency/relationships | High | k-thresholds, rare suppression, graph-degree limits, no stable cross-session tokens | Utility decreases as safeguards increase |
| Token reuse links datasets | High | Dataset/workbook/session-scoped namespaces; no public persistence | Reuse bugs are severe |
| Provider sees token explanations | High | Payload validator blocks mappings, raw values, token hints, and explanatory labels | Requires deterministic validator before use |
| Rehydration after invalidation | High | `TokenRehydrationGuard` blocks stale scope/fingerprint/consent/schema | Requires exact lifecycle tracking |
| Audit logs capture mappings | Critical | Audit only counts/fingerprints, never mappings | Debug tooling must obey same rule |
| User misunderstands tokenization as anonymization | High | Explicit consent/disclosure that tokenized data remains sensitive | UX and policy maturity required |

## Vault Lifecycle Recommendation

If Level 3 is ever allowed outside this audit, the safest conceptual lifecycle is:

1. Create only after explicit, mode-specific consent.
2. Scope to a single dataset, workbook, and session.
3. Store mappings in memory only by default.
4. Never export.
5. Never send to a provider.
6. Never include in payloads, prompt text, logs, audit snapshots, provider traces, or analytics.
7. Audit only counts, categories, policy decisions, and non-reversible fingerprints.
8. Destroy on consent revoke, dataset change, workbook change, schema change, session end, user clear, source re-ingestion, policy change, provider change, privacy-mode change, payload-fingerprint change, or validation failure.

Default/public FiltraQueri should not persist the vault. Persistence should be considered only for private/self-hosted/enterprise deployments with separately reviewed key management, access control, retention, monitoring, legal basis, and incident-response controls.

## Frontend-Only, Backend-Only, or Private-Deployment-Only?

### Default/public cloud

Neither frontend nor backend should host a Level 3 vault. Public-cloud Level 3 should be rejected because the product would be responsible for a concentrated reversible secret whose value exceeds the incremental LLM utility.

### Private cloud and enterprise governed deployments

A vault could be private-deployment-only after prerequisites exist. Backend-only may be preferable for managed enterprise controls, centralized policy, observability, and lifecycle enforcement. Frontend-only may reduce server-side custody but increases exposure to browser memory, extensions, crash reports, and local debugging. Neither approach is safe without mature deployment policy and validators.

### Self-hosted/on-prem

Self-hosted deployments may choose a vault if data never leaves the customer's controlled environment and a private/self-hosted model is used. Even then, the safest default is session-scoped in-memory storage with no persistence.

## Provider Payload Rules

A provider payload may include tokenized values only if Level 3 is explicitly allowed by deployment policy and deterministic validation passes. It must never include:

- Raw values.
- Token-to-value mappings.
- Tokenization vault contents.
- Token explanations that reveal originals.
- Sequential or meaningful token labels that leak order, identity, or source.
- Rare or unique token combinations that fail k-safety.
- Prompt text, SQL drafts, query results, provider responses, credentials, or restricted fields.

Provider-visible tokens must be opaque, non-meaningful, non-sequential, scoped, and unguessable. They must not be reversible by inspection.

## Consent and Disclosure Requirements

Before Level 3 could be used, FiltraQueri would need explicit consent that states:

- Reversible tokenization is not anonymization.
- Tokenized values can still reveal frequency, grouping, linkage, and relationship patterns.
- A local vault maps tokens back to original values.
- The vault is never sent to providers and never included in payloads.
- The provider receives tokens only, not mappings.
- The LLM output is advisory only.
- Deterministic validators remain final authority.
- Insert SQL remains manual.
- Run Query remains manual.
- Consent is scoped to dataset/workbook/session and invalidates on source/schema/privacy-mode/policy/provider changes.

Consent must be revocable, fingerprint-aware, and mode-specific. Consent for metadata-only or Level 2 must not imply consent for Level 3.

## Deterministic Validation Requirements

No tokenized payload should be used unless deterministic validators prove all of the following:

1. Deployment policy allows Level 3 for the current tenant/environment.
2. Explicit Level 3 consent is granted and current.
3. Dataset, workbook, schema, privacy mode, provider category, and payload fingerprint match the vault manifest.
4. No raw rows, raw values, sample values, top values, prompt text, SQL drafts, query results, provider responses, credentials, or tokenization vault mappings are present.
5. All tokenized categories are allowed by sensitivity policy.
6. Restricted columns are suppressed or prohibited, never tokenized for provider use.
7. Rare values and rare joint patterns are suppressed.
8. Tokens are opaque, non-sequential, unguessable, and namespace-scoped.
9. Token counts, row counts, graph-degree patterns, and joins pass leakage thresholds.
10. Audit summaries contain only counts/fingerprints and no mappings.
11. Rehydration is blocked unless `TokenRehydrationGuard` verifies scope, freshness, consent, sensitivity, and deterministic plan validity.
12. LLM output is advisory and cannot directly insert SQL, run SQL, mutate editor state, or override deterministic planners/renderers.

## Possible Architecture If Ever Allowed

These are design concepts only, not implementation authorization:

- `TokenizationVault`: In-memory mapping store from opaque token to original value, scoped by dataset/workbook/session and destroyed on invalidation.
- `TokenizedValueRef`: Provider-safe reference containing token, table/column scope alias, sensitivity category, and policy status, but no raw value.
- `TokenizationVaultManifest`: Non-secret manifest with scope, policy version, token counts, sensitivity counts, fingerprint, creation time, and expiry.
- `TokenizationVaultLifecyclePolicy`: Rules for creation, consent, invalidation, destruction, persistence prohibition, and audit limits.
- `TokenizedPayloadAuditSummary`: Counts and fingerprints of tokenized categories, excluded categories, validator decisions, and no-execution invariants.
- `TokenRehydrationGuard`: Deterministic guard that resolves tokens only after scope, consent, fingerprint, schema, sensitivity, and plan validation pass.
- `TokenVaultRiskAssessment`: Preflight assessment covering sensitivity, uniqueness, rare values, graph leakage, provider category, deployment policy, and residual risk.

## Deployment Matrix

| Deployment type | Recommendation | Rationale | Minimum posture if revisited |
| --- | --- | --- | --- |
| Public/default FiltraQueri cloud | **Reject for default/public product** | Vault creates concentrated reversible secret; public users may misunderstand tokenization; Level 2 provides safer value | Do not expose Level 3; keep metadata-only/Level 2 path |
| Private cloud | **Defer** | Could be viable with private model and enterprise controls, but prerequisites are missing | Tenant policy, private model boundary, validators, consent UI, in-memory default |
| Self-hosted/on-prem | **Defer / ship later only by explicit admin opt-in** | Customer controls infrastructure and may accept risk | Local-only model or approved private endpoint, no default persistence, admin policy, audit without mappings |
| Enterprise governed deployment | **Defer** | Best candidate due to governance, legal review, and security controls | DPA/legal approval, retention policy, access control, monitoring, validator suite, incident response |

## Implementation Prerequisites If Ever Allowed

Before Level 3 can move from audit to implementation, FiltraQueri would need:

- Mature Levels 0-2 with fixture coverage and production validation evidence.
- A deterministic privacy payload validator that rejects raw values and vault mappings.
- A consent UI that distinguishes metadata-only, Level 2, and Level 3.
- Deployment policy controls that can prohibit Level 3 by default.
- A vault lifecycle policy with aggressive invalidation and destruction.
- Rehydration guard tests.
- Token opacity tests.
- Rare-value and joint-pattern suppression tests.
- Graph leakage thresholds.
- Audit logging rules that exclude mappings.
- Provider-boundary tests proving vaults never appear in payloads.
- Security/legal review for private, self-hosted, and enterprise deployments.

## Final Recommendation

**Reject Level 3 reversible tokenized private mode for default/public FiltraQueri cloud.**

**Defer Level 3 for private cloud, self-hosted/on-prem, and enterprise governed deployments until Levels 0-2 are proven, a deterministic privacy validator exists, consent UI exists, deployment policy exists, and vault lifecycle/rehydration guards are reviewed.**

Level 3 should not be a default/public feature. It may become a ship-later option only for deployments where the customer or enterprise administrator explicitly accepts vault custody risk and where provider payloads, audit logs, lifecycle invalidation, and deterministic rehydration are all enforceable.

## Recommended Next Slice

Proceed with a non-runtime design/validation slice before any vault implementation:

1. Define a `TokenVaultRiskAssessment` design contract in documentation only.
2. Extend privacy validator requirements for tokenized payload rejection/allowance cases.
3. Add a deployment-policy audit describing how public/default cloud hard-disables Level 3.
4. Design consent copy that clearly says reversible tokenization is not anonymization.
5. Keep runtime behavior unchanged until Levels 0-2 are implemented, validated, and reviewed.

## Runtime Behavior Confirmation

This audit does not change runtime/source behavior. No token vault, storage, encryption, provider calls, backend/API, UI, payload builder, synthetic generator, SQL generation, Insert SQL, Run Query, Ask ranking, or Business SQL planner/renderer behavior is added or modified.
