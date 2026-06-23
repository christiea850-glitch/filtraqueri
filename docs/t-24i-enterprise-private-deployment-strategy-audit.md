# T-24I - Enterprise and Private Deployment Strategy Audit

## Purpose

This document decides which FiltraQueri AI privacy levels should be allowed, allowed only with policy, deferred, prohibited, or escalated for legal/compliance review across public cloud, private cloud, self-hosted/on-prem, enterprise governed, and offline/local-only deployments.

This is audit/design only. It does not implement deployment policy, admin settings, provider calls, backend/API behavior, UI, storage, persistence, payload building, synthetic generation, token vaults, SQL generation, Insert SQL, Run Query, Ask ranking, or Business SQL planner/renderer behavior.

## Files Inspected

Prior T-24 strategy and audit documents:

- `docs/t-24a-privacy-preserving-llm-shadow-data-strategy-audit.md`
- `docs/t-24e-synthetic-sample-strategy-audit.md`
- `docs/t-24f-tokenization-vault-ship-defer-reject-audit.md`
- `docs/t-24g-deterministic-shadow-plan-validator-audit.md`
- `docs/t-24h-consent-disclosure-ui-audit.md`

LLM privacy, consent, provider-boundary, and validator contracts:

- `frontend/src/features/analyst/llm/llmPrivacyModes.ts`
- `frontend/src/features/analyst/llm/llmShadowDataPolicy.ts`
- `frontend/src/features/analyst/llm/llmShadowPlanValidator.ts`
- `frontend/src/features/analyst/llm/llmConsentDisclosure.ts`
- `frontend/src/features/analyst/llm/llmProviderBoundary.ts`
- `frontend/src/features/analyst/llm/llmConsentPolicy.ts`

Governance context:

- `docs/architecture/K11_LLM_Governance_and_Data_Safety_Contract.md`

## Decision Vocabulary

| Decision | Meaning |
| --- | --- |
| `allowed` | Product/deployment may expose the level once existing prerequisites for that level are satisfied. |
| `allowed with admin policy` | Deployment may expose the level only when an administrator or enterprise policy explicitly permits it and required controls are configured. |
| `deferred` | Do not ship yet; revisit only after named implementation, validation, lifecycle, and review prerequisites exist. |
| `prohibited` | Do not offer as a FiltraQueri AI mode under the described conditions. Consent cannot override this state. |
| `requires separate legal/compliance review` | Technical policy alone is insufficient; legal, contractual, regulatory, data-processing, and customer-governance review is required before enablement. |

## Non-Negotiable Policy Principles

1. **Level 0 must always be available.** Users and administrators must be able to run FiltraQueri with no LLM provider payload.
2. **Level 1 may be default-allowed only when provider boundary, consent/disclosure, metadata-only payload hardening, and restricted-column rules are satisfied.** Metadata can still reveal sensitive business context.
3. **Level 2 requires explicit user consent, audit summary, rare-value suppression, deterministic validation, and admin/enterprise policy where applicable.** It must be described as privacy-preserved shadow data, not anonymous data.
4. **Level 3 remains rejected for public/default cloud and deferred elsewhere until vault lifecycle, key management, token namespace, consent invalidation, audit, and deterministic rehydration guards exist.** Tokenized values remain sensitive.
5. **Level 4 raw-data mode remains prohibited for external LLMs by default.** Raw rows, sample values, top values, prompt text, SQL drafts, query results, provider responses, and token vaults must not become external provider payload categories.
6. **Insert SQL remains manual.** AI privacy mode does not authorize editor mutation.
7. **Run Query remains manual.** AI privacy mode does not authorize execution.
8. **The LLM never executes.** It cannot call backend APIs, run queries, mutate datasets, persist settings, or accept relationships.
9. **Deterministic validation remains final authority.** AI output is advisory-only and must pass deterministic privacy, schema, relationship, SQL-readiness, and no-execution checks before it can influence user-visible planning.

## Deployment Matrix

| Deployment type | Level 0: No LLM | Level 1: Metadata-only LLM | Level 2: Masked/synthetic sample LLM | Level 3: Reversible tokenized private mode | Level 4: Raw-data mode |
| --- | --- | --- | --- | --- | --- |
| Public/default FiltraQueri cloud | allowed | allowed when metadata-only provider boundary, consent/disclosure, and restricted-column checks pass | deferred until Level 2 builder, privacy validator, consent UI, audit summaries, and rare-value suppression exist; then allowed with admin/product policy only | prohibited | prohibited |
| Private cloud | allowed | allowed with admin policy and provider eligibility controls | allowed with admin policy plus explicit user consent, audit summary, rare-value suppression, and regulated-data restrictions after Level 2 implementation exists | deferred; requires separate legal/compliance review before any future enablement | prohibited for external LLMs; requires separate legal/compliance review even for customer-owned private models |
| Self-hosted/on-prem | allowed | allowed with admin policy; may be allowed against a customer-owned model when local policy permits | allowed with admin policy, explicit consent, audit summary, rare-value suppression, and local model/provider review after Level 2 implementation exists | deferred; requires vault lifecycle, rehydration guard, key management, incident response, and separate legal/compliance review | prohibited for external LLMs; should remain prohibited by default even for local models unless a separate non-default customer policy accepts raw-data risk |
| Enterprise governed deployment | allowed | allowed with enterprise policy, provider contract, retention posture, audit export, consent lifecycle, and sensitive-dataset controls | allowed with enterprise policy, explicit user consent, audit summary, rare-value suppression, higher k thresholds where needed, and regulated-data restrictions after Level 2 implementation exists | deferred; requires separate legal/compliance review, vault lifecycle, rehydration guard, key management, DLP/monitoring, and formal exception process | prohibited for external LLMs; requires separate legal/compliance review and explicit exception if ever considered for isolated internal models |
| Offline/local-only deployment | allowed | allowed only if no external provider is contacted; otherwise not applicable | allowed with local-only admin policy after Level 2 implementation exists, with consent/audit still required because local model prompts may be logged or retained locally | deferred; possible future private research mode only after vault lifecycle and rehydration guards exist | prohibited as a FiltraQueri default mode; local raw-data prompting should be outside governed AI mode unless separately reviewed |

## Privacy-Level Allowance Decisions

### Level 0: No LLM

**Decision:** allowed for every deployment type.

Level 0 is the universal fallback and should remain available even when administrators disable all provider features. It preserves deterministic local behavior and avoids LLM-provider data sharing. It does not change normal risks from local files, browser state, exports, manually written SQL, or manually executed queries.

### Level 1: Metadata-Only LLM

**Decision:** allowed in public/default cloud only when metadata-only safety and provider boundary conditions are met; allowed with admin/enterprise policy in private, self-hosted, enterprise, and offline/local-only deployments.

Level 1 may include dataset, worksheet, column, relationship, profile, deterministic report, dialect, and sensitivity metadata. It must not include raw rows, sample values, top values, prompt text, SQL drafts, query results, provider responses, token vaults, raw free-text values, or raw sensitive values.

Level 1 should close automatically when:

- Provider mode is disabled or local mock only.
- Consent/disclosure requirements are not satisfied where required by deployment policy.
- Payload scope is not metadata-only.
- Restricted columns are present in a way the provider boundary treats as never-send.
- Provider retention, subprocessors, or contractual posture is not eligible for the tenant or dataset.
- Sensitive/regulatory dataset policy requires Level 0 or private/local-only handling.

### Level 2: Masked/Synthetic Sample LLM

**Decision:** deferred for public/default cloud until implementation prerequisites exist; allowed with admin/enterprise policy in private, self-hosted/on-prem, enterprise governed, and offline/local-only deployments only after Level 2 prerequisites exist.

Level 2 should be treated as privacy-preserved shadow data. It may include only approved aggregate summaries, masked placeholders, synthetic sample rows, or bucketed values after deterministic validation. It must not copy real rows, mutate sampled rows, preserve raw values, use realistic fake identifiers, expose rare values, or include exact sensitive literals.

Level 2 requires:

- Explicit mode-specific user consent.
- Audit summary showing payload fingerprint, included/excluded category counts, suppression counts, rare-value threshold, provider category, and no-execution flags.
- Rare-value and rare-joint-pattern suppression, with default floor `k >= 5` and higher thresholds for regulated or small-population contexts.
- Admin or enterprise policy where the deployment is private, self-hosted, enterprise governed, or where public cloud product policy has not enabled the mode.
- Deterministic privacy validator before provider payload.
- Deterministic shadow-plan validator after provider output.
- Consent expiry and revocation behavior tied to dataset, workbook, schema, policy, provider, privacy mode, and payload fingerprint.

### Level 3: Reversible Tokenized Private Mode

**Decision:** prohibited for public/default cloud; deferred for private cloud, self-hosted/on-prem, enterprise governed, and offline/local-only deployments; requires separate legal/compliance review before any future enablement.

Level 3 preserves stable entity references through reversible tokens while keeping token-to-value mappings in a local vault. That vault is a concentrated sensitive asset. Even without a vault leak, stable tokens reveal frequency, grouping, relationships, graph structure, outliers, and temporal patterns. Level 3 is not anonymization.

Level 3 must not be enabled until all of these exist:

- Vault lifecycle contract with creation, scope, expiration, revocation, destruction, no-export, and no-provider-transmission rules.
- Token namespace controls preventing cross-session, cross-dataset, cross-workbook, or cross-tenant linkage unless explicitly approved.
- Key management, access controls, monitoring, incident response, backup policy, and retention policy for any non-memory vault.
- Deterministic rehydration guard that blocks stale tokens, mismatched payload fingerprints, revoked consent, schema changes, provider changes, privacy-mode changes, and unsupported plan shapes.
- Audit summaries that record counts and decisions but never mappings or raw values.
- Explicit disclosure that tokenized data is still sensitive and reversible.
- Enterprise/private deployment policy plus legal/compliance review.

### Level 4: Raw-Data Mode Prohibited

**Decision:** prohibited for external LLMs in every deployment type; prohibited by default as a FiltraQueri product mode even for private/local deployments.

Raw-data mode would send raw rows, raw sample values, top values, query results, prompt text containing source values, SQL drafts, provider responses, or token vaults as AI context. This conflicts with the T-24 privacy posture. Consent must not override raw-data prohibition for external providers.

If a customer wants raw data sent to a customer-owned internal model, that should be treated as a separate non-default legal/compliance exception outside the default FiltraQueri AI privacy modes, with customer-owned risk acceptance, contractual review, retention review, access controls, monitoring, and incident response.

## Provider Policy Requirements

Provider eligibility should be evaluated before any Level 1 or higher provider use:

1. **Provider category:** `none`, external provider, private model, or self-hosted/local model must be explicit.
2. **Provider boundary:** Boundary must fail closed unless mode, payload scope, consent status, restricted-column handling, and allowed categories pass.
3. **Zero-retention or bounded retention:** External providers should require zero-retention or a contractual no-training/no-human-review posture where available. If retention exists, the deployment needs legal/compliance review and user/admin disclosure.
4. **Subprocessor and region posture:** Enterprise/private deployments should require region, subprocessor, data-transfer, and support-access disclosures.
5. **No raw payload logging:** FiltraQueri should not promise provider non-retention unless contractually true, and should not store raw prompts, provider responses, SQL drafts, raw values, or token mappings in its own audit logs.
6. **Customer-owned model distinction:** A customer-owned private or self-hosted model may reduce external disclosure risk, but it does not remove prompt logging, model telemetry, admin access, endpoint compromise, insider, or re-identification risk.
7. **Provider switch invalidation:** Consent and payload fingerprints should expire when provider category, model endpoint, retention posture, or deployment policy changes.

## Admin Policy Requirements

Future deployment policy types should support at least:

- Global AI enabled/disabled.
- Maximum allowed privacy level by tenant, workspace, deployment, and dataset classification.
- Provider category allow-list: external, private model, self-hosted, local-only, or none.
- External provider contract/retention eligibility.
- Dataset sensitivity classification and regulatory flags.
- Minimum k threshold and stricter domain thresholds.
- Level 2 enablement flag requiring explicit consent and audit summary.
- Level 3 hard-disable by default, with deferred/private-only exception state.
- Raw-data mode hard prohibition.
- Consent scope and expiry defaults.
- Audit summary retention/export settings that exclude raw data.
- Admin override boundaries that cannot override raw-data prohibition for external LLMs.

## Consent and Audit Requirements

### Consent

Consent should be specific to:

- Privacy level and mode.
- Dataset, workbook, worksheet/scope, schema version, and payload fingerprint.
- Provider category and retention posture.
- Included and excluded payload categories.
- Session/dataset/workbook scope.
- Expiration time or triggering events.

Consent must expire or be revoked when:

- Dataset, workbook, worksheet, schema, relationship state, or sensitivity policy changes.
- Provider, endpoint, retention posture, or privacy mode changes.
- Payload fingerprint changes.
- Admin policy changes.
- User revokes consent.
- Session ends for session-scoped modes.
- A validator detects unsafe categories or mismatched provenance.

### Audit

Audit summaries should include:

- Privacy mode and deployment type.
- Provider category and boundary status.
- Payload fingerprint and plan fingerprint when applicable.
- Included/excluded category counts.
- Suppression counts by reason, not suppressed values.
- Rare-value threshold and regulated-data flags.
- Consent status, scope, expiry, and revocation status.
- Deterministic validation status and violation counts.
- No-execution flags: LLM cannot execute, cannot insert SQL, cannot run queries, deterministic validation required, manual Insert SQL required, manual Run Query required.

Audit summaries must not include raw prompts, raw payloads, raw values, sample values, top values, query results, SQL drafts, provider responses, token vaults, or token mappings.

## Regulated Data Handling

Regulated or high-sensitivity datasets should default to Level 0 or Level 1 only unless enterprise policy explicitly permits more. Warnings should be surfaced for:

- **Healthcare/patient/PHI:** Prefer Level 0/Level 1; Level 2 requires higher k, domain review, and explicit enterprise policy; Level 3 remains deferred.
- **HR/employee/payroll/performance:** Small groups are highly identifying; Level 2 requires high k thresholds, department/location/role/date suppression, and enterprise policy.
- **Finance/payment/banking/payroll:** Account/payment identifiers remain suppressed; amounts should be coarse-bucketed only when k-safe; outliers require suppression.
- **Legal/compliance/investigations:** Matter IDs, parties, narratives, dates, and unusual events should be suppressed; Level 2 requires legal review.
- **Children/minors/education:** Prefer Level 0/Level 1; Level 2 should require explicit enterprise policy and legal/compliance review.
- **Security/access/incident response:** Credentials, tokens, access codes, device identifiers, incident details, and security narratives should remain prohibited or suppressed.

Sensitive/regulatory flags should be policy inputs, not mere UI warnings. When classification is unknown, ambiguous, small-population, or mixed-regulatory, the system should fail closed to Level 0 or Level 1 metadata-only.

## Self-Hosted and Private Model Considerations

Self-hosted or private models change custody, not the core privacy rules. They can reduce external provider exposure but introduce deployment-specific risks:

- Prompt and response logs may exist in model servers, proxies, observability systems, or support bundles.
- Customer administrators may have broad access to prompts, model traces, or local vaults.
- Model endpoints may be misconfigured, shared across tenants, or backed by third-party managed infrastructure.
- Local models may still memorize, leak, or reproduce sensitive prompts in logs or outputs.
- Offline deployments still need consent/audit because local prompt material can appear in debug logs, crash reports, screenshots, exports, or support artifacts.

Therefore, private/self-hosted eligibility should require explicit deployment policy, logging controls, retention configuration, access controls, and audit posture before Level 2 or any future Level 3 use.

## What FiltraQueri Should Not Promise

FiltraQueri should not promise:

- That metadata-only AI is risk-free.
- That synthetic data is automatically anonymous.
- That masked or bucketed values cannot reveal sensitive context.
- That tokenized data is anonymized.
- That a private/self-hosted model eliminates all privacy risk.
- That zero-retention applies unless contractually true for the selected provider and deployment.
- That LLM output is correct, authoritative, executable, or safe without deterministic validation.
- That consent can authorize raw-data sharing to external providers.
- That audit logs contain full reproducibility; safe audits should intentionally omit raw prompts, raw payloads, raw values, SQL drafts, provider responses, and token mappings.

## What Requires Enterprise Policy

Enterprise/admin policy should be required for:

- Enabling any external provider in private cloud, self-hosted, enterprise governed, or regulated contexts.
- Level 2 masked/synthetic sample AI.
- Any dataset with healthcare, HR, finance, legal, children/minor, security, government, confidential, or small-population indicators.
- Minimum k thresholds above the product floor.
- Provider allow-list, region, retention, and subprocessor requirements.
- Audit summary retention/export behavior.
- Consent defaults and expiry.
- Private/self-hosted model eligibility.
- Any future exception workflow for Level 3.

## What Requires Legal/Compliance Review

Separate legal/compliance review should be required for:

- Any use of regulated datasets above Level 1.
- Any external provider without zero-retention/no-training posture.
- Any cross-border transfer, third-party subprocessor, or support-access pathway for provider payloads.
- Level 3 reversible tokenization in any deployment.
- Any persistent token vault or managed vault service.
- Any raw-data use with a customer-owned model, even if isolated from external providers.
- Contractual claims about retention, training exclusion, deletion, auditability, or breach responsibilities.
- Children/minor, patient, HR, legal matter, financial account, security incident, government, or tenant-confidential datasets.

## What Remains Prohibited

The following should remain prohibited by product policy:

- Raw rows to external LLMs.
- Raw sample values or top values to external LLMs.
- Query results to external LLMs.
- SQL drafts as provider payload or provider output authority.
- Prompt text containing source values.
- Provider response text stored or shown as authority without deterministic validation.
- Token vaults or token mappings in any provider payload, log, audit summary, support bundle, or export.
- Level 3 in public/default FiltraQueri cloud.
- Level 4 raw-data mode for external LLMs.
- Automatic Insert SQL, automatic Run Query, automatic relationship acceptance, backend mutation, storage mutation, or provider-driven execution.

## Risks and Mitigations

| Risk | Applies to | Mitigation | Residual concern |
| --- | --- | --- | --- |
| Metadata reveals business or regulated context | Level 1+ | Consent/disclosure, restricted-column fail-closed, provider eligibility, admin policy | Column names and schema can still be sensitive |
| Synthetic samples reproduce rare patterns | Level 2 | Generate only from approved coarse profiles, k suppression, joint-pattern checks, deterministic validator | Bad implementation could leak outliers |
| Mask labels imply sensitive dataset themes | Level 2 | Clear disclosure, suppress high-risk columns, regulated-data policy | Even category names may reveal context |
| Provider retains payloads | Level 1+ external | Zero-retention/no-training contract, retention disclosure, legal review | Provider-side controls may vary |
| Consent goes stale | Level 1+ | Fingerprint, schema, provider, policy, and mode invalidation | Requires exact lifecycle implementation |
| Token vault leak | Level 3 | Defer; require in-memory lifecycle, no export, key management, rehydration guard | Endpoint compromise remains severe |
| Stable tokens leak relationships | Level 3 | Defer; token namespace, k thresholds, graph limits | Utility decreases as safety improves |
| Users over-trust AI | All LLM levels | Advisory-only copy, deterministic validation, manual Insert SQL and Run Query | UX must keep warnings visible |
| Admin overrides overreach | Enterprise/private | Non-overridable raw-data prohibition for external LLMs | Customers may request exceptions |

## Implementation Prerequisites

Before deployment policy is implemented, FiltraQueri should define contract-only types for:

1. Deployment type and provider category.
2. Maximum allowed privacy level by deployment and dataset classification.
3. Decision states: allowed, allowed with admin policy, deferred, prohibited, and requires legal/compliance review.
4. Admin policy inputs for provider allow-list, retention posture, Level 2 enablement, minimum k, regulated-data flags, and audit requirements.
5. Consent scope, expiry, revocation, and invalidation triggers.
6. Audit summary vocabulary that excludes raw payloads and values.
7. Regulated dataset restriction codes.
8. Level 3 deferred/vault-prerequisite states without implementing a vault.
9. Raw-data prohibition invariants.
10. No-execution invariants shared with the shadow-plan validator.

Implementation should still avoid provider calls, backend/API changes, admin settings UI, persistence, payload construction, synthetic generation, token vaults, SQL generation changes, Insert SQL changes, Run Query changes, Ask ranking changes, and Business SQL planner/renderer behavior changes until explicitly scoped.

## Recommended Next Slice

Proceed with **T-24I-1: Deployment Policy Types Only** before T-24J.

Rationale:

- T-24I makes policy decisions, but the codebase does not yet have a typed deployment-policy vocabulary for deployment type, allowance state, legal/compliance review state, provider eligibility, regulated-data restriction, consent expiry, and Level 3 deferred prerequisites.
- Contract-only types would let future consent, provider-boundary, privacy-gateway, and audit work refer to one deterministic policy vocabulary without implementing behavior.
- T-24J closure/readiness review should happen after the deployment policy contract exists, so the closure audit can verify that Levels 0-4, deployment types, admin policy, consent/audit, and raw-data prohibition are consistently represented.

T-24I-1 should remain types/constants/helpers only. It should not add admin settings, UI, backend/API, storage, provider calls, payload builders, synthetic generation, token vaults, SQL generation, Insert SQL changes, Run Query changes, Ask ranking changes, or Business SQL planner/renderer changes.
