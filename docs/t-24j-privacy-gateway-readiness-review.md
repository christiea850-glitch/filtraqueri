# T-24J - Privacy Gateway Readiness Review and Closure Audit

## 1. Summary of T-24 Goal

T-24 explored whether FiltraQueri can safely evolve toward a future **Privacy-Preserving LLM Shadow Data Layer** without weakening the product's current deterministic, local-first SQL and workbook behavior.

The phase goal was to establish safety strategy, vocabulary, contracts, and closure criteria for a future Privacy Gateway that may eventually allow LLM-assisted reasoning over metadata-only or privacy-preserved shadow context while keeping deterministic FiltraQueri systems as the final authority.

This review closes the phase as an audit/documentation checkpoint. It does not implement runtime behavior, provider integration, backend/API behavior, UI, persistence, shadow payload construction, synthetic generation, token vaults, SQL generation, SQL insertion, query execution, Ask ranking changes, or Business SQL planner/renderer changes.

## 2. Completed T-24 Slices

| Slice | Status | Outcome |
| --- | --- | --- |
| T-24A | Complete | Privacy-preserving LLM shadow data strategy audit. |
| T-24B | Complete | Privacy mode foundation types and no-execution invariants. |
| T-24C | Complete | Shadow-data sensitivity policy types and helpers. |
| T-24D | Complete | Metadata-only LLM payload hardening. |
| T-24D-Fix-1 | Complete | Unsafe metadata payload field stripping fix. |
| T-24D-Fix-2 | Complete | Draft SQL field compatibility fix. |
| T-24E | Complete | Synthetic/masked sample strategy audit. |
| T-24F | Complete | Tokenization vault ship/defer/reject audit. |
| T-24G | Complete | Deterministic Shadow Plan Validator audit. |
| T-24G-1 | Complete | Shadow Plan Validator contract types and fixtures. |
| T-24H | Complete | Consent/disclosure UI audit. |
| T-24H-1 | Complete | Consent/disclosure contract types and fixtures. |
| T-24I | Complete | Enterprise/private deployment strategy audit. |
| T-24I-1 | Complete | Deployment policy contract types and fixtures. |
| T-24J | Complete in this document | Privacy Gateway readiness review and closure audit. |

## 3. Current Capability Status

| Level | Name | Current status | Readiness conclusion |
| --- | --- | --- | --- |
| 0 | Deterministic / no LLM | Implemented as the safe baseline and default fallback. | Ready and should remain universal fallback. |
| 1 | Metadata-only foundation | Foundation exists: metadata-only payload hardening, privacy mode contracts, blocked category stripping, sensitivity metadata, and fixtures. | Foundation-ready, but provider enablement remains gated by existing boundary/consent policy. |
| 2 | Masked/synthetic strategy only | Designed and audited only. Policy vocabulary exists, but no generator, validator, payload builder, UI, provider path, or storage exists. | Not implementation-ready beyond additional readiness/types work. |
| 3 | Tokenization rejected/deferred | Rejected for default/public cloud; deferred for private/self-hosted/enterprise research after legal, vault lifecycle, and rehydration controls exist. | Not ready to implement. |
| 4 | Raw data prohibited | Explicitly prohibited in policy and audit posture. | Must remain prohibited. |

## 4. What Is Actually Implemented Today

The implemented T-24 foundation is intentionally narrow and safe:

- Privacy mode vocabulary, payload category vocabulary, audit summaries, and no-execution invariants exist in source.
- Metadata-only allowed categories and raw-data-prohibited categories are encoded.
- Metadata-only payload construction summarizes datasets, worksheets, columns, relationship candidates, data profiles, deterministic report opportunities, dialects, and sensitivity metadata without raw/sample/top values.
- Unsafe metadata payload fields are stripped by allow-list/deny-list style helper behavior.
- Shadow-data sensitivity policy helpers produce policy decisions such as metadata-only, bucket, mask, suppress, tokenize-private, or prohibit, while keeping `rawValueAllowed: false`.
- Shadow Plan Validator contract types and helper results are present as advisory-only/no-execution contracts.
- Consent/disclosure contract helpers and copy are present, but no consent UI or persistence is implemented by T-24.
- Deployment policy contract helpers and policy matrix are present, but no admin settings, backend enforcement, provider plumbing, or persistence is implemented by T-24.
- Fixture registration includes LLM privacy, shadow policy, metadata payload, shadow plan, consent disclosure, and deployment policy modules.

## 5. What Is Only Designed or Audited

The following remain design/audit only:

- Future Privacy Gateway architecture and sequencing.
- Future Level 2 masked/synthetic sample strategy.
- Future rare-value, k-safety, row-copy, near-copy, and joint-pattern suppression strategy.
- Future deterministic Shadow Plan Validator behavior beyond inert contracts.
- Future consent/disclosure UI flow.
- Future enterprise/private deployment governance.
- Future audit export, admin policy, provider eligibility, and legal/compliance review workflows.
- Future cross-phase architecture for connecting Privacy Gateway outputs to deterministic planners without giving LLMs executable authority.

## 6. What Is Only Types/Contracts

The following are contract-level foundations, not runtime feature implementations:

- Privacy levels, privacy modes, payload categories, audit summaries, and no-execution invariant types.
- Shadow-data policy decisions and helper contracts.
- Shadow Plan Validator vocabulary, advisory-only validation result types, violation types, and no-execution helpers.
- Consent disclosure copy, mode chip view models, payload disclosure summaries, and consent status helpers.
- Deployment type, privacy-level allowance, provider eligibility, admin policy requirement, and deployment policy decision helpers.

## 7. What Remains Prohibited

The following remain prohibited for the T-24 closure posture:

- Sending raw rows to any LLM provider.
- Sending sample values, top values, preview rows, prompt text, SQL drafts, query results, provider responses, API keys, secrets, raw free-text values, raw sensitive values, or tokenization vault mappings as provider payload content.
- Letting an LLM insert SQL, run queries, bypass deterministic validation, modify Ask ranking/order, or become authoritative for Business SQL planning/rendering.
- Treating synthetic or masked data as safe without a deterministic generator, validator, manifest, audit summary, consent flow, and suppression model.
- Shipping Level 3 reversible tokenization in default/public cloud.
- Treating Level 4 raw-data LLM mode as acceptable for governed AI behavior.

## 8. What Remains Unsafe to Implement

It remains unsafe to implement any of the following before additional architecture and prerequisite work:

- A provider path that accepts Level 2 or Level 3 payloads.
- A synthetic row generator without deterministic copy/near-copy/rare-pattern rejection.
- Token vault storage, persistence, encryption, rehydration, or lifecycle behavior.
- Any backend/API endpoint for shadow payload creation or LLM provider dispatch.
- Any UI that implies LLM output is executable or trusted.
- Any path where LLM-returned plans can directly influence SQL generation, Insert SQL, Run Query, Ask ranking/order, or Business SQL planner/renderer behavior.
- Any raw-data exception path without separate legal/compliance review and explicit non-default architecture.

## 9. Current Validation Posture

- Fixture module count in `frontend/scripts/run-sql-fixtures.mjs`: **35 modules**.
- T-24-related fixture modules registered in the fixture runner: **6 modules**.
  - LLM privacy modes.
  - LLM shadow data policy.
  - LLM metadata payload builder.
  - LLM shadow plan validator.
  - LLM consent disclosure.
  - LLM deployment policy.
- Current fixture pass count from this T-24J environment: **not available** because `npm run fixtures:sql` could not start; the local frontend dependency tree is missing `vite`.
- Build status from this T-24J environment: **not rerun** for this markdown-only change. The known build posture from recent T-24 closure remains that Vite may emit a large chunk warning, which is a warning rather than a Privacy Gateway behavior failure.
- Markdown-only validation for this slice is limited to `git diff --check` and `git status --porcelain=v1 -uall`.

## 10. Safety Boundaries Preserved

T-24J preserves the following boundaries:

- No provider calls.
- No backend/API changes.
- No storage or persistence.
- No UI implementation.
- No synthetic data generation.
- No token vault.
- No SQL generation changes.
- No Insert SQL changes.
- No Run Query changes.
- No Ask ranking/order changes.
- No Business SQL planner/renderer behavior changes.
- No payload builder expansion beyond existing metadata-only foundations.
- No new source types or runtime contracts.

## 11. Risks Still Open

Open risks after T-24 closure:

1. **Provider boundary integration risk.** Future LLM provider plumbing could accidentally bypass metadata-only and raw-data-prohibited categories unless the Privacy Gateway becomes a single mandatory chokepoint.
2. **Level 2 re-identification risk.** Masked/synthetic samples can still leak identity through rare buckets, unique combinations, copied rows, near-copies, exact dates, exact amounts, or business-specific labels if not deterministically rejected.
3. **Token vault risk.** Level 3 introduces a high-value local secret and stable linkage/frequency leakage even when raw values are not sent.
4. **Consent semantics risk.** Consent copy and contracts exist, but UI, lifecycle, revocation, payload fingerprinting, and audit persistence are not implemented.
5. **Deployment policy enforcement risk.** Deployment policy helpers exist, but admin policy, provider eligibility, legal/compliance review, and runtime enforcement are not implemented.
6. **LLM authority risk.** Any future LLM shadow plan must remain advisory-only; deterministic validators, relationship confirmation, and SQL readiness must remain final authority.
7. **Multi-table intelligence blocker.** Practical business-question intelligence remains limited by confirmed worksheet relationships and join-path confidence, not by lack of LLM shadow data.

## 12. Recommended Next Phase

### Options to Evaluate

| Option | Description | Assessment |
| --- | --- | --- |
| A | Return to T-23 relationship confirmation implementation so FiltraQueri can continue intelligence/multi-table business question work. | Best next move. It addresses the practical intelligence blocker without expanding LLM/privacy runtime risk. |
| B | Continue T-24 with implementation prerequisites, starting with Privacy Gateway types/readiness only. | Reasonable later, but less urgent because T-24 already established safety strategy and contracts. |
| C | Do a cross-phase architecture review before more implementation. | Useful if scope is uncertain, but it may delay the concrete T-23 relationship work now needed for multi-table intelligence. |

### Recommendation

The recommended next phase is **Option A: return to T-23 relationship confirmation implementation**.

Rationale:

- T-24 successfully established the privacy/LLM safety strategy, safe boundaries, and inert contracts needed for future Privacy Gateway planning.
- The highest-value practical intelligence blocker remains confirmed worksheet relationships for multi-table business questions.
- Returning to T-23 lets FiltraQueri improve deterministic relationship confidence, join readiness, and multi-table business SQL workflows without introducing provider calls, shadow payloads, synthetic generation, token vaults, or new LLM authority.
- Future T-24 implementation work should wait until relationship confirmation and deterministic multi-table intelligence are stronger, or until a cross-phase architecture review defines a mandatory Privacy Gateway chokepoint.

## Files Inspected

Documentation inspected:

- `docs/t-24a-privacy-preserving-llm-shadow-data-strategy-audit.md`
- `docs/t-24e-synthetic-sample-strategy-audit.md`
- `docs/t-24f-tokenization-vault-ship-defer-reject-audit.md`
- `docs/t-24g-deterministic-shadow-plan-validator-audit.md`
- `docs/t-24h-consent-disclosure-ui-audit.md`
- `docs/t-24i-enterprise-private-deployment-strategy-audit.md`

Source and fixture files inspected:

- `frontend/src/features/analyst/llm/llmPrivacyModes.ts`
- `frontend/src/features/analyst/llm/llmShadowDataPolicy.ts`
- `frontend/src/features/analyst/llm/llmMetadataPayloadBuilder.ts`
- `frontend/src/features/analyst/llm/llmShadowPlanValidator.ts`
- `frontend/src/features/analyst/llm/llmConsentDisclosure.ts`
- `frontend/src/features/analyst/llm/llmDeploymentPolicy.ts`
- `frontend/src/features/analyst/llm/index.ts`
- `frontend/scripts/run-sql-fixtures.mjs`
- `frontend/src/features/analyst/llm/__tests__/llmPrivacyModes.test.ts`
- `frontend/src/features/analyst/llm/__tests__/llmShadowDataPolicy.test.ts`
- `frontend/src/features/analyst/llm/__tests__/llmMetadataPayloadBuilder.test.ts`
- `frontend/src/features/analyst/llm/__tests__/llmShadowPlanValidator.test.ts`
- `frontend/src/features/analyst/llm/__tests__/llmConsentDisclosure.test.ts`
- `frontend/src/features/analyst/llm/__tests__/llmDeploymentPolicy.test.ts`

## Closure Conclusion

T-24 is ready to close as a privacy and LLM safety strategy/foundation phase. Level 0 remains safe and deterministic, Level 1 has a metadata-only foundation, Level 2 remains strategy-only, Level 3 remains rejected/deferred, and Level 4 remains prohibited. No runtime/source behavior changes are introduced by T-24J.
