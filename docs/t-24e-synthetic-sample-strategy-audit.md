# T-24E - Synthetic and Masked Sample Strategy Audit

## Purpose

This document designs FiltraQueri's future Level 2 masked/synthetic shadow-data strategy before any implementation. It is audit/design only: no synthetic rows are generated, no payloads are built, no provider is called, no UI/backend/API/storage is added, and SQL generation, Insert SQL, Run Query, Ask ranking, and Business SQL planner/renderer behavior remain unchanged.

Core question:

How can FiltraQueri safely create privacy-preserved shadow data that helps an LLM reason about data shape and broad patterns without exposing raw values, rare patterns, sensitive columns, or real rows?

## Files Inspected

Primary prior audit and privacy foundations:

- `docs/t-24a-privacy-preserving-llm-shadow-data-strategy-audit.md`
- `frontend/src/features/analyst/llm/llmPrivacyModes.ts`
- `frontend/src/features/analyst/llm/llmShadowDataPolicy.ts`
- `frontend/src/features/analyst/llm/llmMetadataPayloadBuilder.ts`
- `frontend/src/features/analyst/llm/llmSensitiveColumnClassifier.ts`
- `frontend/src/features/analyst/llm/llmRedactionPolicy.ts`
- `frontend/src/features/analyst/llm/llmConsentPolicy.ts`
- `frontend/src/features/analyst/llm/llmProviderBoundary.ts`

Dataset, workbook, and fixture context:

- `frontend/src/features/dataset/datasetTypes.ts`
- `frontend/src/features/workbook/workbookTypes.ts`
- `frontend/src/features/analyst/llm/__tests__/llmPrivacyModes.test.ts`
- `frontend/src/features/analyst/llm/__tests__/llmShadowDataPolicy.test.ts`
- `frontend/src/features/analyst/llm/__tests__/llmMetadataPayloadBuilder.test.ts`
- `frontend/scripts/run-sql-fixtures.mjs`

## Current Level 1 Metadata-Only Safety Status

Current T-24B through T-24D foundations establish a conservative Level 1 posture:

- Privacy mode types separate `metadata_only_llm`, `masked_synthetic_sample_llm`, `reversible_tokenized_private`, and raw-data-prohibited states.
- Payload categories explicitly distinguish metadata, aggregate summaries, masked samples, synthetic samples, bucketed values, tokenized values, raw rows, sample values, top values, prompt text, SQL drafts, query results, provider responses, and tokenization vaults.
- Raw-data categories are prohibited by default, including raw rows, sample values, top values, prompt text, SQL drafts, query results, provider responses, and tokenization vaults.
- Metadata-only payloads include dataset, worksheet, column, relationship, profile, deterministic report, dialect, and sensitivity metadata without row values.
- Metadata-only safety summaries report `rawRowsIncluded`, `sampleValuesIncluded`, `topValuesIncluded`, `promptTextIncluded`, `sqlDraftsIncluded`, `queryResultsIncluded`, `providerResponsesIncluded`, `tokenizationVaultIncluded`, `rawFreeTextValuesIncluded`, and `rawSensitiveValuesIncluded` as false.
- Unsafe metadata field names such as rows, preview rows, sample values, top values, prompts, SQL drafts, query results, provider responses, secrets, token vaults, raw values, and free-text values are stripped by metadata-only helpers.
- Sensitive-column classification covers restricted access/security fields, health/patient fields, contact information, personal names, addresses/locations, financial/payment fields, free text, identifiers, unknown columns, and safe business metrics.
- Shadow-data policy already records `rawValueAllowed: false`, defaults the rare-value threshold to 5, treats Level 2 as consent-required, and requires suppression for sensitive, rare, unique, possibly unique, restricted, or prohibited cases.
- Existing fixtures cover privacy mode boundaries, shadow-data sensitivity policy, and metadata-only payload hardening.

Conclusion: Level 1 is appropriately value-free. Level 2 must not weaken this posture; it should be an additive, independently validated, consent-gated shadow layer.

## Proposed Level 2 Strategy

Level 2 should be named and treated as **masked/synthetic sample shadow data**, not anonymous real samples. It should include only policy-approved row-shaped examples or coarse aggregate/bucket summaries that are:

1. Not copied from any real row.
2. Not derived from any single individual, account, transaction, patient, employee, customer, tenant, child, legal matter, credential, or rare event.
3. Generated from coarse, threshold-safe metadata and distributions.
4. Cleared by deterministic validators before any provider payload.
5. Labeled as synthetic/shadow data in the payload, manifest, audit summary, and downstream LLM instructions.
6. Used only for advisory reasoning; deterministic FiltraQueri systems remain final authority.

Level 2 may help an LLM understand broad data shape, such as "there is a date-like column bucketed by month," "amounts are represented as low/medium/high bands," or "status-like categories exist after k-safe grouping." It must not help the LLM infer actual people, events, unusual transactions, exact identifiers, exact dates, exact addresses, access codes, free-text narratives, or rare combinations.

## What Counts as Safe Synthetic Data

Safe synthetic data is **non-factual shadow data** that preserves analytical shape while intentionally breaking record identity and exact value truth.

A future synthetic row is safe only if all of these are true:

- It is generated from approved metadata, coarse histograms, threshold-safe buckets, and sensitivity policy decisions, not from row copying.
- Every value is policy-derived: masked, bucketed, generalized, or synthetic placeholder text.
- It excludes raw restricted values, raw sensitive values, raw free text, raw sample values, and raw top values.
- It suppresses categories, buckets, and row combinations with support below the configured k threshold.
- It avoids exact minima, maxima, timestamps, addresses, names, identifiers, account numbers, credentials, and unusual amounts.
- It cannot be joined back to a real row by equality, uniqueness, row order, or combination of fields.
- It includes a manifest declaring `synthetic: true`, `realRowsIncluded: false`, `rawValuesIncluded: false`, `rareThresholdApplied: true`, and `llmAdvisoryOnly: true`.

Example safe value forms:

- `amount_bucket: "1000_to_2500"`
- `event_month_bucket: "2026_Q1"` only if the bucket is k-safe
- `status_group: "common_status_group_a"` rather than a raw status value when status labels are rare or business-sensitive
- `customer_name: "[PERSON_MASKED]"`
- `notes: "[FREE_TEXT_SUPPRESSED]"`
- `diagnosis: "[HEALTH_FIELD_SUPPRESSED]"`

## What Counts as Unsafe Synthetic Data

Synthetic data is unsafe if it can reproduce, approximate, single out, or imply real values or rare real combinations.

Unsafe examples include:

- Any copied row, shuffled row, sampled row, preview row, or row with only a few values changed.
- Any raw value from `sample_values`, `top_values`, preview rows, query results, source rows, free-text cells, relationship overlap samples, or provider responses.
- Exact names, emails, phone numbers, addresses, postal codes at high precision, account numbers, access codes, secrets, patient identifiers, employee identifiers, customer identifiers, ticket IDs, invoice IDs, or UUIDs.
- Exact dates of birth, admission dates, incident dates, termination dates, legal dates, precise timestamps, or sparse event dates.
- Exact financial amounts when they could reflect salaries, rent, invoices, balances, payments, payroll, deposits, medical bills, or unusual transactions.
- Synthetic rows that preserve a rare joint pattern, such as one department + location + date bucket + amount bucket with fewer than k supporting records.
- Synthetic rows that preserve outliers, exact min/max values, unique values, or unusual text lengths that identify a record.
- Free-text paraphrases. Rewriting a note, complaint, medical narrative, HR comment, legal note, or incident description is still disclosure risk.
- Stable tokens in Level 2 external-provider mode. Reversible tokenization is a Level 3 private/self-hosted design question and should remain outside Level 2.

## Masking, Bucketing, Suppression, Synthetic Generation, and Tokenization

| Technique | Definition | Level 2 role | Key risk | Required control |
| --- | --- | --- | --- | --- |
| Masking | Replace a value with a label such as `[EMAIL_MASKED]` or `[NAME_MASKED]`. | Allowed for indicating column role without value content. | Masks still reveal that a sensitive attribute exists. | Use generic labels, no lengths/prefixes/suffixes, no format-preserving secrets. |
| Bucketing | Convert numeric/date/category values into coarse ranges or groups. | Allowed for safe business metrics and threshold-safe dates/categories. | Small buckets and edge buckets can reveal rare records. | Apply k-anonymity, suppress small buckets, round ranges, avoid exact min/max. |
| Suppression | Exclude a value, bucket, column, row, or row combination. | Mandatory for restricted, high-risk, rare, unique, free-text, and unsafe fields. | Over-suppression can reduce usefulness. | Prefer safety; report suppression counts in audit summary. |
| Synthetic generation | Create non-factual placeholder rows from approved policies and coarse distributions. | Allowed only after validators prove rows are not real and are k-safe. | Naive generation can reproduce outliers or false facts. | Generate from safe buckets, never source rows; compare against uniqueness and similarity checks. |
| Tokenization | Replace values with stable reversible tokens backed by a local vault. | Not Level 2 for external providers. | Vault compromise and frequency graph leakage. | Defer to Level 3 private/self-hosted audit; never send vaults. |

## Allowed vs Prohibited Data Categories

### Categories that may appear in Level 2 shadow samples

Allowed only after policy approval, consent, and deterministic validation:

- Metadata-only categories already allowed in Level 1.
- Coarse aggregate summaries when each bucket/group has support `k >= 5` by default.
- Bucketed safe business metrics, such as rounded quantities, rates, counts, scores, and non-sensitive operational amounts.
- Bucketed dates for non-sensitive operational fields, such as month/quarter/year bands, when not sparse or regulated.
- Mask labels for direct identifiers, contact columns, addresses, financial columns, and other sensitive columns when the label itself is generic and not value-derived.
- Synthetic placeholder rows composed only of approved mask labels, safe buckets, suppressed markers, and synthetic category aliases.

### Categories that must be suppressed or metadata-only

These should not appear as Level 2 values:

- Access/security/credential columns: suppress or prohibit.
- Health/patient columns: metadata-only or suppress by default.
- Free-text columns: metadata-only or suppress; do not paraphrase or summarize cell content into synthetic rows.
- Direct personal identifiers: mask only with generic labels, never synthetic names that look real.
- Contact information: mask only, never fake-but-realistic emails/phones.
- Precise addresses/locations: suppress or coarse region only when k-safe and not regulated.
- Identifiers: suppress in Level 2; tokenization belongs to Level 3 private mode only.
- Financial/payment fields: bucket only if safe business metric policy passes; otherwise suppress.
- Unknown-needs-review columns: metadata-only until classification improves.
- Any column or combination with unique, possibly unique, rare, prohibited, or regulated risk.

## Masking Rules

Level 2 masks should be semantic and intentionally low fidelity:

- Use `[PERSON_MASKED]`, `[EMAIL_MASKED]`, `[PHONE_MASKED]`, `[ADDRESS_MASKED]`, `[IDENTIFIER_SUPPRESSED]`, `[ACCESS_FIELD_PROHIBITED]`, `[FREE_TEXT_SUPPRESSED]`, `[HEALTH_FIELD_SUPPRESSED]`, and `[FINANCIAL_FIELD_BUCKETED_OR_SUPPRESSED]`.
- Do not preserve prefixes, suffixes, length, capitalization, punctuation, last four digits, email domains, street numbers, zip codes, account formats, or credential format.
- Do not create realistic fake names, fake emails, fake phone numbers, fake addresses, fake account numbers, or fake access codes; realistic fakes can be mistaken for facts and can still encode source structure.
- Use a single mask label per sensitivity category unless a more generic label is safer.
- For sensitive columns, prefer column-level mask markers rather than row-varying masks.

## Bucketing Rules

Bucketing should favor coarse analytical shape over precision:

- Numeric buckets should use rounded ranges and avoid exact source min/max boundaries.
- Date buckets should default to month/quarter/year, not day or timestamp.
- Category buckets should use policy-safe aliases such as `common_category_a`; raw labels are prohibited unless separately proven public, non-sensitive, non-rare, non-identifying, and not business-confidential.
- Bucket labels must not include raw values, top values, or sample values.
- Buckets with `count < k` must be merged into a broader bucket or suppressed.
- Edge buckets that isolate outliers must be merged or suppressed even when they appear analytically interesting.
- Histograms should be rounded and thresholded before use; exact counts may be generalized when regulated or small.

## Suppression Rules

Suppression is the default for uncertainty. A future Level 2 builder should suppress:

- Restricted columns and all access/security fields.
- Raw sensitive values, raw free-text values, sample values, top values, preview rows, and query results.
- Any value, bucket, category, row-shaped example, or joint pattern with support below k.
- Unique or possibly unique columns.
- High-cardinality identifiers.
- Unclassified text-heavy columns.
- Outlier values and exact min/max endpoints.
- Any synthetic row that is too similar to a real row.
- Any payload where the validator cannot prove the above conditions deterministically.

Suppression should be auditable: the payload manifest should include counts by reason, but not suppressed values.

## Rare-Value and K-Anonymity Strategy

Default rare-value threshold: `k >= 5`.

The threshold applies to more than single values:

- Single column values and buckets.
- Category frequencies.
- Numeric/date histogram buckets.
- Cross-column combinations used in a synthetic row.
- Relationship evidence groups.
- Any row template selected for synthetic generation.

Required strategy:

1. Compute support for candidate single-column buckets.
2. Suppress or merge buckets where `support < k`.
3. Compute support for candidate joint row patterns across all included columns.
4. Suppress or generalize any row pattern where joint support is unknown or `< k`.
5. Reject Level 2 entirely when support cannot be measured safely.
6. Record the configured threshold and suppression summary in `SyntheticRowSafetyManifest` and `SyntheticSampleAuditSummary`.

## Higher Thresholds for Regulated Contexts

Use higher thresholds or Level 1-only behavior for regulated contexts. Examples:

- Healthcare/patient/PHI: default to Level 1 metadata-only; if ever allowed privately, require substantially higher k and domain review.
- Finance/payment/payroll/banking: raise k and suppress exact amounts, account fields, and outlier transactions.
- HR/employee/payroll/performance: raise k because department + role + location + date can identify employees.
- Legal/compliance/investigation: suppress narratives, matter identifiers, dates, parties, and rare events.
- Children/education/minors: prefer Level 0/Level 1 only unless enterprise policy explicitly permits a higher threshold.
- Security/access/incident response: prohibit access codes, secrets, tokens, device identifiers, credential artifacts, and incident details.

A future policy should allow an enterprise/admin configured `minimumK`, with `5` as the floor and stricter domain defaults above it.

## Avoiding Real Row Reproduction

A future synthetic builder must never start from source rows. It should generate from safe profiles and then validate against source-shape risk.

Required controls:

- No row sampling, row shuffling, row perturbation, or row-level mutation.
- No use of preview rows, query results, sample values, or top values as generation seeds.
- Generate column values independently from approved bucket policies, then verify joint support.
- Reject synthetic rows that match a real row on all included non-suppressed columns.
- Reject synthetic rows that match a real row on a high-risk subset, such as date bucket + location bucket + amount bucket + identifier mask.
- Reject rows that include unique or possibly unique columns except as suppression markers.
- Randomness is not sufficient; safety must be deterministic and auditable.

## Avoiding Outliers

Outliers are often the exact examples users want, but they are unsafe in shadow data.

Rules:

- Never emit exact min, max, rare extreme buckets, or singleton tails.
- Replace tails with coarse labels only if the tail bucket is k-safe; otherwise suppress.
- Do not preserve unusual date intervals, unusual amount bands, unusual text-length bands, or rare categorical combinations.
- Round numeric ranges, collapse sparse tails, and disclose `outliersSuppressed: true` in the manifest.
- If outlier preservation is necessary for an analysis, that analysis must remain deterministic/local and not become a provider payload.

## Free-Text Handling

Free-text columns are high risk because they can contain names, contact details, medical facts, HR notes, complaints, legal facts, secrets, and unique narratives.

Level 2 rules:

- Do not expose raw free-text cell content.
- Do not expose paraphrases, summaries, embeddings, keyword extracts, n-grams, example snippets, or rewritten text.
- Do not generate synthetic text that resembles user narratives.
- Allow only metadata such as `hasTextLengthStats: true`, null count, unique count, broad length bucket availability, and sensitivity classification.
- In synthetic rows, use `[FREE_TEXT_SUPPRESSED]` or omit the column.
- If free-text reasoning is needed later, design a separate privacy review with local-only deterministic extraction and no provider payload by default.

## Domain-Specific Handling

### Dates

- Operational dates may be bucketed to month/quarter/year if k-safe.
- Dates of birth, admission, termination, incident, legal, security, and sparse event dates should be suppressed or metadata-only.
- Never send precise timestamps, exact date ranges, or exact min/max dates in Level 2 rows.

### Names

- Use `[PERSON_MASKED]`; do not create fake realistic names.
- Avoid preserving role-specific name categories that imply identity.

### Addresses and locations

- Street addresses, units, apartments, latitude/longitude, and precise geolocation are suppressed.
- City/state/region may be bucketed only if k-safe and not sensitive in context.
- Zip/postal codes should be generalized or suppressed; small geographies require higher k.

### Access codes and identifiers

- Access codes, passwords, API keys, private keys, tokens, SSNs, account numbers, routing numbers, card numbers, MFA fields, and credentials are prohibited.
- Identifiers, UUIDs, customer IDs, employee IDs, invoice IDs, ticket IDs, and patient IDs are suppressed in Level 2.
- Reversible/stable tokens are deferred to Level 3 private/self-hosted strategy.

### Financial amounts

- Safe business metrics may be bucketed and rounded when not personal, payroll, banking, medical, rare, or outlier-sensitive.
- Salary, payroll, rent, invoices, balances, deposits, payments, account details, and unusual transactions require suppression or stricter buckets/higher k.
- Exact amounts, exact min/max, and singleton buckets are prohibited.

### Health fields

- Health/patient/diagnosis/treatment/medication/insurance/date-of-birth fields should default to metadata-only or suppression.
- Level 2 external-provider shadow rows should not include health values, health category labels, or synthetic diagnosis-like examples.

### HR fields

- Employee, payroll, performance, disciplinary, demographic, leave, disability, and complaint fields require higher k and likely Level 1-only behavior.
- Department/location/job-level combinations can identify people and require joint-pattern suppression.

### Security/access fields

- Credentials, secrets, access codes, tokens, keys, device fingerprints, incident narratives, and internal paths are prohibited.
- Use only metadata flags and prohibited markers.

### Safe business metrics

- Counts, quantities, common statuses, scores, rates, non-sensitive operational categories, and broad date groups may be useful in Level 2 after k-safe bucketing.
- Even safe metrics must not expose raw samples or exact top values.

## Keeping Synthetic Rows Useful Without Making Them Factual

Synthetic rows should teach the LLM shape, not facts. Future payload instructions should state:

- Rows are fabricated privacy-preserved examples.
- Values are buckets, masks, aliases, or suppression markers.
- Rows are not query results.
- Rows are not evidence for factual claims.
- Counts and distributions are coarse and thresholded.
- The model may use them only to suggest analytical plans, possible groupings, filters, joins, or chart shapes.
- The model must not cite synthetic rows as real records or business facts.

Useful Level 2 rows may show, for example, that a table has a date bucket, a status-like safe category alias, and an amount bucket. They should not show exact customer events, exact amounts, exact status labels, or exact row histories.

## Preventing the LLM From Treating Synthetic Rows as Real Facts

Every future Level 2 payload should contain redundant disclosure:

- Envelope field: `privacyMode: "masked_synthetic_sample_llm"`.
- Manifest field: `rowsAreSynthetic: true`.
- Manifest field: `realRowsIncluded: false`.
- Manifest field: `rawValuesIncluded: false`.
- Manifest field: `advisoryOnly: true`.
- Per-row field: `rowKind: "synthetic_shadow_row"`.
- Per-value field or naming convention indicating `bucket`, `mask`, `suppressed`, or `synthetic_alias`.
- Prompt instruction: "Do not treat these rows as real facts, query output, or evidence."
- Validator rule rejecting provider responses that claim synthetic row values are real source facts.

## Recommended Architecture

### `SyntheticSampleStrategy`

Defines which privacy mode, dataset/workbook scope, sensitivity classes, bucket policies, k thresholds, regulated-context overrides, and maximum synthetic row counts are allowed. It should be pure configuration, not a generator.

### `MaskedValuePolicy`

Maps sensitivity categories to mask labels and prohibited markers. It must guarantee no raw substrings, format-preserving secrets, stable identifiers, or realistic fake values.

### `BucketedValuePolicy`

Defines coarse numeric, date, boolean, and category buckets. It owns rounding, range labeling, small-bucket merging, edge-bucket suppression, and category alias rules.

### `RareValueSuppressionPolicy`

Defines default `minimumK: 5`, regulated overrides, single-column suppression, bucket suppression, and joint-pattern suppression.

### `OutlierSuppressionPolicy`

Defines tail merging, min/max exclusion, exact boundary removal, sparse date/amount suppression, and regulated outlier handling.

### `SyntheticRowSafetyManifest`

Attached to every future Level 2 payload. Should include privacy mode, payload fingerprint, generated-at timestamp, strategy version, included/excluded categories, k threshold, regulated-context flags, rows requested/generated/suppressed, real-row-copy checks, rare-pattern checks, outlier checks, free-text suppression status, raw-value flags, and no-execution invariants.

### `SyntheticSampleAuditSummary`

Stored/logged as value-free audit metadata. Should include counts and decisions, not rows or suppressed values. It should be safe to persist and inspect.

### `SyntheticSampleValidator`

Deterministic pre-provider validator that rejects any future Level 2 payload unless it proves:

- No raw rows, preview rows, sample values, top values, query results, prompt text, SQL drafts, provider responses, token vaults, or secrets.
- No raw restricted/sensitive/free-text values.
- Every included column has an approved policy.
- Every bucket and joint row pattern meets k.
- Regulated contexts use higher thresholds or are refused.
- Outliers and exact min/max values are suppressed.
- Synthetic rows are labeled and non-factual.
- No row is copied or too similar to a real row.
- No execution, insert, SQL mutation, or Run Query authority is introduced.

## Deterministic Validation Requirements Before Any Future Provider Payload

Before any Level 2 provider payload exists, FiltraQueri needs deterministic validators for:

- Privacy mode compatibility.
- Explicit consent and disclosure status.
- Provider category and deployment policy.
- Payload category allow/block lists.
- Sensitive-column policy decisions.
- Raw-value absence and blocked field-name scans.
- k-anonymity for single buckets and joint row patterns.
- Rare-value suppression and unknown-support refusal.
- Outlier suppression.
- Free-text suppression.
- Regulated-context threshold escalation.
- Synthetic row non-copy/similarity checks.
- Manifest completeness.
- Advisory-only/no-execution invariants.
- LLM response checks that prevent treating synthetic values as facts.

Validation should fail closed. If a validator cannot prove safety, Level 2 should not be built or sent.

## Fixture Coverage Needed Before Implementation

Before implementing synthetic sample types or builders, add fixtures that prove:

- Level 2 requires explicit consent and remains closed without it.
- `minimumK` defaults to at least 5.
- Regulated contexts raise thresholds or refuse Level 2.
- Raw rows, preview rows, sample values, top values, prompts, SQL drafts, query results, provider responses, secrets, and token vaults cannot appear.
- Restricted columns are prohibited.
- Health and free-text columns are suppressed.
- Direct identifiers/contact/address fields use only generic masks.
- Identifiers are suppressed in Level 2 and not tokenized.
- Safe numeric metrics are bucketed and rounded.
- Exact min/max/outliers are suppressed.
- Rare single buckets are suppressed or merged.
- Rare joint row combinations are suppressed.
- Synthetic rows carry row/value labels and manifest disclosures.
- A copied real row fixture is rejected.
- A near-copy/high-similarity row fixture is rejected.
- Unknown support counts fail closed.
- Validators are pure and do not call providers, backend APIs, storage, SQL generation, Insert SQL, or Run Query.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Synthetic rows reproduce real records. | Generate only from approved buckets; reject copied/near-copy rows; never seed from source rows. |
| Rare combinations identify people or events. | Apply k-anonymity to joint patterns, not just single values. |
| Sensitive values leak through masks or fake examples. | Use generic masks; prohibit realistic fake names/emails/phones/addresses/codes. |
| Free text leaks through paraphrases or keywords. | Suppress free-text values entirely; allow metadata only. |
| Outliers leak unusual facts. | Suppress exact min/max, sparse tails, rare amount/date buckets, and unusual combinations. |
| LLM treats synthetic rows as facts. | Add manifest, per-row labels, prompt disclosure, advisory-only response validation. |
| Regulated data needs stronger controls. | Raise k, refuse Level 2 by default for high-risk domains, and require enterprise policy. |
| Tokenization is mistaken for anonymization. | Keep tokenization out of Level 2 and defer Level 3 to a vault audit. |
| Payload validators become too permissive. | Fail closed, use allow lists, and require fixtures for every safety invariant. |
| SQL or execution boundaries shift indirectly. | Preserve deterministic planner/renderer authority; Insert SQL and Run Query remain manual. |

## Implementation Roadmap

### T-24F: Tokenization vault ship/defer/reject audit

Define reversible tokenization threat model, vault isolation, local/private deployment requirements, invalidation rules, frequency leakage, rehydration constraints, and provider boundary implications. The recommended default is **defer** Level 3 until Levels 0-2 are proven safe and useful.

### T-24G: Deterministic shadow-plan validator

Create pure validators for LLM plan outputs before any plan can influence UI, planning, SQL, insert, or execution. Validate schema references, aliases, sensitivity constraints, privacy mode, payload fingerprint, advisory-only language, and no-execution invariants.

### T-24H: Consent/disclosure UI audit

Design consent copy and disclosure surfaces for metadata-only and Level 2 modes. Explain that shadow rows are synthetic, not facts; raw values are excluded; provider category matters; Insert SQL and Run Query remain manual.

### T-24I: Enterprise/private deployment strategy

Document private model, self-hosted, retention, logging, administrator policy, regulated deployment controls, audit export, and whether Level 3 tokenization should ever ship.

### Optional later slice: synthetic sample types only

After T-24F through T-24I audits, add pure TypeScript types for `SyntheticSampleStrategy`, `MaskedValuePolicy`, `BucketedValuePolicy`, `RareValueSuppressionPolicy`, `OutlierSuppressionPolicy`, `SyntheticRowSafetyManifest`, `SyntheticSampleAuditSummary`, and `SyntheticSampleValidator` result shapes. Do not implement generation in that slice.

## Recommendation for Next Slice

Proceed with **T-24F: Tokenization vault ship/defer/reject audit**.

Reason: Level 2 and Level 3 must remain clearly separated before implementation. T-24F should decide whether reversible tokenization is worth carrying forward, deferred to private enterprise deployments, or rejected for the default product. That decision will simplify Level 2 by preventing token vault assumptions from leaking into masked/synthetic sample design.

## Preservation Contract

T-24E makes no runtime/source behavior changes. Future Level 2 work must preserve:

- No raw rows to external providers by default.
- No raw restricted values.
- No raw sensitive values.
- No free-text cell content.
- No direct sample values or top values.
- Suppression of rare values and rare combinations.
- Default `k >= 5`, with higher thresholds for regulated contexts.
- Synthetic/shadow row labeling and disclosure.
- LLM output based on synthetic rows is advisory only.
- Deterministic systems remain final authority.
- Insert SQL remains manual.
- Run Query remains manual.
- Business SQL planner/renderer behavior remains unchanged.
- Ask ranking/order remains unchanged.
- No provider calls, UI, backend/API, storage/persistence, SQL generation, or execution changes in this slice.
