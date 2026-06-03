# K11 LLM Governance and Data Safety Contract

## Purpose

K11 may introduce LLM-assisted report suggestions after the deterministic K10 report intelligence planner. The LLM layer must remain advisory, metadata-first, privacy-preserving, auditable, and execution-safe. It must help non-technical users understand useful report opportunities without weakening FiltraQueri's existing boundaries around data mutation, SQL execution, result state, routing, upload/session restore, or Human/Analyst mode behavior.

This contract is a pre-implementation governance document. It does not authorize LLM calls by itself.

## Non-Negotiable Boundaries

- No LLM suggestion may mutate uploaded data, workbook metadata, cleaned working copies, manifests, or result state.
- No LLM-generated SQL may auto-run.
- SQL execution remains a manual user action through the existing Run query control.
- Query Builder execution, Results, export, pagination, ActiveResultModel, routing/back behavior, upload/session restore, Human/Analyst switching, SQL Context worksheet activation, and the right rail schema panel remain protected surfaces.
- Worksheet table activation remains in SQL Context. The right rail must not regain a worksheet table picker.
- Backend/storage manifest files must not be committed as part of K11 work.

## Data Use Policy

### Default: Metadata-Only AI

The default AI mode may send only minimized metadata:

- dataset id or local reference token, if needed for audit correlation
- workbook and worksheet names
- trusted SQL table names exposed by workbook metadata
- column names
- inferred column types
- row counts and column counts
- missing-value summaries and profile summaries
- relationship candidates and accepted relationship metadata
- deterministic K10 report summaries and support/missing-requirement metadata
- SQL dialect context

The default mode must not send raw row records.

### Not Allowed By Default

The default AI mode must not send:

- full raw rows
- full customer, tenant, employee, patient, vendor, or user records
- emails, phone numbers, access codes, payment details, addresses, account identifiers, or security credentials
- sensitive free-text fields such as notes, comments, descriptions, messages, incident details, medical descriptions, HR notes, or support narratives
- full prompt payloads containing sensitive values

### Optional: Approved Sample Rows

Small sample rows may be allowed only after clear user approval. The UI must state:

- what kind of sample will be sent
- why it may improve suggestions
- whether sensitive-looking values will be redacted first
- that generated SQL still inserts only and never auto-runs

Sample-row mode must be scoped to the current dataset/session and must be reversible. It must not become the default.

### Future Enterprise Mode

Enterprise policy may require:

- AI disabled entirely
- private-model only
- metadata-only AI with stricter redaction
- tenant-controlled retention and audit export
- administrator-managed consent defaults

K11 implementation should leave room for these policies without hardcoding public-model assumptions.

## Sensitive Column Classification

Before any AI context is prepared, columns must be classified for sensitivity. Classification should use deterministic rules first:

- direct identifiers: id-like fields tied to people, tenants, employees, customers, vendors, accounts, leases, units, access devices, or payments
- contact data: email, phone, mobile, address, zip, postal, location if person-linked
- financial data: amount, payment, balance, rent, card, bank, invoice, account, payroll, salary, wage
- security data: access code, key code, fob, token, credential, password, entry log
- sensitive text: notes, comment, description, message, issue detail, incident detail, medical, diagnosis, HR, disciplinary

Metadata payloads may include the existence and type of sensitive columns, but not sensitive values by default.

## LLM Suggestion Contract

Every LLM suggestion must be structured. Free-form suggestions are not enough.

Required fields:

- id
- title
- business question
- why it matters
- required tables
- required columns
- optional tables
- optional columns
- missing requirements
- confidence level: Low, Medium, or High
- assumptions
- support status: can generate now or needs user review
- method: SQL, Excel, Python, or future optimization
- whether joins, aggregation, date logic, or anomaly checks are involved
- whether metadata-only context or approved sample rows were used
- SQL draft, if and only if it passes validation gates before insertion

LLM suggestions must be visibly distinct from deterministic K10 suggestions.

## SQL Safety Contract

LLM-generated SQL must pass validation before insertion into Monaco.

Allowed:

- read-only SELECT-style SQL
- CTEs that ultimately produce a SELECT
- quoted references to trusted known tables and columns
- selected dialect guidance for syntax review

Blocked:

- DROP
- DELETE
- UPDATE
- INSERT
- ALTER
- CREATE TABLE
- COPY
- EXPORT
- ATTACH
- PRAGMA
- file access
- external URL access
- destructive operations
- untrusted table names
- unknown columns
- multi-statement payloads unless each statement is explicitly validated as read-only and necessary

Validation must occur before insertion. Insertion does not imply execution. The user must still click Run query manually.

## Explainability Requirements

The UI must show, at minimum:

- AI-generated label
- whether AI used metadata only or approved sample rows
- business question
- why it matters
- required tables and columns
- missing requirements
- confidence level
- assumptions
- warnings when assumptions are material
- support status

Deterministic and AI-assisted reports must not be blended without labels.

## Data Minimization Rules

K11 should send the smallest useful context:

1. Prefer K10 deterministic summaries.
2. Prefer schema/profile summaries over row values.
3. Send only active or relevant worksheet metadata when possible.
4. Include relationship candidates only when joins are relevant.
5. Redact or omit sensitive columns before any sample-row context.
6. Avoid prompt payload retention when values may be sensitive.

## Auditability Requirements

K11 should keep a local audit record with:

- timestamp
- dataset/session reference
- AI mode: metadata-only, approved sample rows, disabled, or private-model
- metadata categories sent
- whether sample rows were allowed
- redaction/classification summary
- model/provider category, without exposing secrets
- suggestion ids returned
- whether SQL was generated
- whether SQL was inserted into Monaco
- whether the user edited the SQL after insertion, if detectable without storing sensitive SQL
- whether the user manually ran a query

Do not store full prompt payloads if they contain sensitive data. Prefer payload category summaries and hashes over raw content.

## User Consent Model

Default:

- metadata-only AI
- clear UI label: "AI used metadata only"

Optional:

- sample rows require explicit approval
- clear UI label: "AI used approved sample rows"
- sensitive values should be redacted first

Enterprise:

- AI disabled or private-model only
- admin policy may override per-user choice

## Recommended K11 Implementation Plan

### K11A: Metadata Payload Builder

Create a typed builder that consumes deterministic K10/K9 outputs, workbook metadata, schema/profile summaries, relationship candidates, and SQL dialect context. It should produce a minimized, serializable payload with no raw rows by default.

### K11B: Sensitive Column Classifier and Redactor

Add deterministic column classification before any AI payload is prepared. Classify identifiers, contact fields, financial fields, security fields, and sensitive text fields. Redact sample values when sample-row mode is explicitly approved.

### K11C: LLM Structured Suggestion Contract

Define TypeScript contracts for request payloads, model response shape, suggestion support status, confidence levels, assumptions, and provenance labels. Reject unstructured model output.

### K11D: SQL Validator

Add a validator for AI-generated SQL before insertion. Enforce read-only SELECT-style SQL, trusted table/column references, blocked keyword checks, and multi-statement constraints.

### K11E: AI Suggestion UI

Add AI-assisted suggestions as a clearly labeled section beside or below deterministic suggestions. Show metadata/sample-row provenance, assumptions, confidence, missing requirements, and insertion-only behavior.

### K11F: Audit Log and User Consent Controls

Add local audit records for AI payload category summaries, consent state, suggestion ids, SQL insertion, SQL edits where feasible, and manual query run status. Add controls for metadata-only mode, sample-row approval, disabled AI, and future enterprise private-model policy.

## Files That May Be Touched Later

Likely frontend files:

- `frontend/src/features/analyst/sql/reportIntelligencePlanner.ts`
- `frontend/src/features/analyst/sql/SqlAssistantPanel.tsx`
- `frontend/src/features/analyst/sql/useSqlWorkspace.ts`
- `frontend/src/features/analyst/sql/sqlTypes.ts`
- `frontend/src/features/analyst/sql/sqlSchemaHelpers.ts`
- `frontend/src/features/analyst/sql/sqlTaskGenerator.ts`
- `frontend/src/features/workbook/workbookTypes.ts`
- `frontend/src/features/workbook/workbookMetadata.ts`
- `frontend/src/features/dataIntelligence/dataProfileTypes.ts`
- `frontend/src/features/dataIntelligence/dataProfileBuilder.ts`
- `frontend/src/features/sqlIntelligence`
- `frontend/src/styles/sql.css`

Likely new frontend files:

- `frontend/src/features/analyst/llm/llmGovernanceTypes.ts`
- `frontend/src/features/analyst/llm/llmMetadataPayloadBuilder.ts`
- `frontend/src/features/analyst/llm/sensitiveColumnClassifier.ts`
- `frontend/src/features/analyst/llm/aiSuggestionContracts.ts`
- `frontend/src/features/analyst/llm/aiSqlValidator.ts`
- `frontend/src/features/analyst/llm/aiAuditLog.ts`
- `frontend/src/features/analyst/llm/aiConsentState.ts`

Backend files should not be touched for K11 unless a later approved phase explicitly adds server-side private-model routing or enterprise policy enforcement.

## TypeScript Contract Recommendation

K11-GOV should remain document-only for now.

Tiny TypeScript scaffolding is not necessary until K11A/K11B, because premature contracts may lock in payload details before the classifier and consent model are implemented. The first code-bearing phase should add types and builders together so the contract can be verified by build-time checks and local unit-style fixtures.

## Acceptance Criteria Before K11 Starts

- This governance contract is accepted.
- K10 deterministic suggestions remain the primary baseline.
- No LLM call is added before K11A-K11F governance layers are planned.
- Any later LLM implementation can prove metadata-only payload construction, sensitive-column redaction, SQL validation, insertion-only behavior, and local auditability.
