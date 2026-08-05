# FiltraQueri Product Direction and Architectural Doctrine

- Status: Authoritative
- Scope: Product strategy and architectural direction
- Effective date: 2026-08-03
- Supersedes: no specific document yet; repository documentation inventory pending
- Applies to: product design, architecture, roadmap planning, implementation briefs, audits, and future feature work

> When another planning or strategy document conflicts with this document, this document controls unless a later approved authoritative direction explicitly supersedes it.

## 1. Executive Product Thesis

> FiltraQueri turns business questions into defensible, reproducible, and portable analytical answers. It builds an analysis the user can inspect, renders the correct SQL for the connected database, executes it under governed controls, visualizes the verified result, explains validated findings, and preserves the complete analytical lineage so the answer can be rerun and compared over time.

Customer-facing statement:

> Ask a business question. FiltraQueri builds and verifies the analysis, runs it safely on your data, shows and explains the result, and preserves exactly how the answer was produced.

Executive-value message:

> Know which numbers are trusted, how they were calculated, and why they changed.

"Without syntax or query tension" remains an important experience promise. It is not the sole product positioning. FiltraQueri is not merely a natural-language-to-SQL assistant. FiltraQueri is an analytical-answer system.

## 2. Product Category

FiltraQueri is:

- an AI-native analytical-answer system;
- a guided analytics workspace;
- a canonical-plan-driven analysis platform;
- a system for producing defensible, reproducible, portable analytical work.

FiltraQueri is distinct from:

- thin LLM SQL wrappers;
- chatbot-only BI assistants;
- independent chart recommenders;
- ungrounded narrative generators;
- dialect-specific query editors;
- disposable one-off analyses.

FiltraQueri owns the complete analytical chain:

Business question -> grounded interpretation -> approved canonical analysis plan -> dialect-specific SQL artifact -> governed execution -> executed result -> result profiling -> safe visualization -> validated insight facts -> grounded explanation -> durable analysis artifact -> reproducible rerun and comparison.

## 3. Primary Users

The first primary users are:

- data analysts;
- business analysts;
- operations analysts;
- healthcare analysts;
- finance analysts;
- analytics-capable operations managers.

Analysts are the correct first users because they can verify outputs, identify unsafe assumptions, establish metric definitions, validate relationships, evaluate dialect accuracy, protect the product from unverified self-service misuse, and publish governed workflows for business users later.

FiltraQueri is designed to strengthen analysts, not initially replace them.

## 4. Buyers and Stakeholders

Likely buyers include:

- analytics leaders;
- data-team managers;
- operations leaders;
- organizations struggling with ad-hoc reporting;
- organizations losing analytical knowledge when employees leave;
- organizations experiencing conflicting numbers across teams.

Analyst-facing value message:

> Move from a stakeholder question to a complete analysis you can inspect, run, explain, defend, and reuse - without syntax tension.

Analytics-leader-facing value message:

> Preserve your team's analytical knowledge, govern definitions, reduce inconsistent reporting, and ensure important analyses remain reproducible when tools, databases, or employees change.

Executive-facing value message:

> Know which numbers are trusted, how they were calculated, and why they changed.

## 5. Core Company Problems FiltraQueri Addresses

FiltraQueri addresses:

- fuzzy business questions that are not immediately answerable;
- inconsistent metric definitions;
- missing or ambiguous fields;
- unclear relationships;
- syntax and query tension;
- incorrect but plausible SQL;
- results that stakeholders do not understand or trust;
- analyses that cannot be reproduced later;
- definition drift;
- schema drift;
- analyses lost when employees leave;
- dashboard overload;
- disconnected SQL, charts, and explanations;
- analytical workflows that depend on one tool or one database;
- bad data producing confident-looking outputs;
- unreviewed assumptions entering published results.

## 6. Strategic Differentiators

Core differentiators:

- defensible answers;
- reproducible analyses;
- portable SQL across databases;
- governed metric definitions;
- inspectable analytical reasoning;
- deterministic readiness and capability gates;
- complete-query refusal instead of partial answers;
- safe execution;
- plan-and-result-driven visualization;
- deterministic fact computation before narrative generation;
- rerun and change classification;
- reusable tool-independent analytical workflows;
- honest disclosure of unavailable data and unsupported capability.

"No SQL required" is a usability benefit, not the main category claim.

## 7. Canonical Analytical Chain

Canonical flow:

Business question -> grounded interpretation -> clarification or guided decomposition -> approved canonical analysis plan -> renderer request -> dialect-specific SQL artifact -> execution-policy evaluation -> governed execution -> executed result -> deterministic result profiling -> visualization plan -> deterministic insight facts -> constrained narrative explanation -> durable analysis artifact -> rerun comparison.

Every downstream artifact derives from the canonical plan and executed result.

No downstream layer may independently reinterpret the original question.

Clarification is part of governed analytical planning. FiltraQueri analyzes with the user when business meaning is consequential, and accepted clarification updates one canonical analytical plan rather than creating a separate conversational source of truth.

## 8. Standing Product and Architectural Rules

Doctrine-status legend:

- Enforced: represented in current production contracts and gates.
- Principle: governs current and future design.
- Planned: requires a named future roadmap arc.

### Rule 1 - Reusable engineering

Status: Enforced.

Production behavior must be domain-neutral and derived from canonical contracts, field identities, types, measures, groupings, filters, relationships, readiness, and capability. No static industry branches unless explicitly approved.

### Rule 2 - Canonical plan

Status: Enforced.

The canonical analysis plan is the sole source of analytical meaning. SQL, visualization, explanation, export, execution, and rerun behavior derive from it.

Conversational clarification must update the canonical plan through governed plan revisions. A user response does not change active analytical state merely because it was typed; it must be grounded, validated, presented as a proposed plan revision, and explicitly applied before it becomes active.

### Rule 3 - Dialect neutrality

Status: Principle, transitioning through PS-9a-i and PS-9a-ii.

No SQL dialect syntax belongs in the canonical plan. Dialect-specific syntax belongs only to renderer implementations and SQL artifacts.

### Rule 4 - Rendering as a separate operation

Status: Planned: PS-9a-i and PS-9a-ii.

A render operation conceptually follows:

RenderRequest(plan, dialect) -> SqlArtifact

A SQL artifact should include:

- dialect;
- SQL text;
- renderer version;
- rendering metadata;
- capability status;
- warnings or blockers.

Current BusinessSqlQueryPlan renderer hygiene note:

The current BusinessSqlQueryPlan contains renderer-related metadata from the DuckDB-first implementation. During PS-9a, dialect targeting must move out of canonical plan semantics, rendered SQL must move into SqlArtifact, and renderer status and warnings must belong to rendering results. Compatibility wrappers may preserve existing callers temporarily. The migration must not change analytical meaning or DuckDB SQL output. This document does not prescribe a final TypeScript field layout.

### Rule 5 - Execution and preview separation

Status: Principle and Planned: PS-9a-ii and PS-Exec.

Preview/export dialect is user-selectable.

Execution dialect is bound to the active connection.

Run executes the artifact generated for the active connection's dialect, regardless of which dialect is currently previewed.

The UI must make both explicit, for example:

Previewing: Oracle SQL

Run target: DuckDB

### Rule 6 - Honest readiness and capability

Status: Enforced.

The system must distinguish:

- ready;
- ready with warnings;
- blocked.

Unsupported, ambiguous, or incomplete analyses must fail closed.

No partial query, partial result, valid-subset fallback, or filter-free fallback may silently replace the requested analysis.

Material unresolved clarification must block preview, insert, run, execution, and authoritative answer generation where applicable. Unsupported but understood intent must be preserved and marked blocked rather than silently simplified.

### Rule 7 - Visualization grounding

Status: Planned: VisualizationPlan.

Visualization decisions require:

- canonical plan meaning;
- executed-result schema;
- result cardinality;
- result values and distribution;
- ordering or ranking intent;
- safe display constraints.

Chart choice must not be derived from column names or plan structure alone.

### Rule 8 - Explanation grounding

Status: Planned: InsightFact and narrative arc.

Narratives may verbalize only deterministic validated InsightFacts.

Required pipeline:

Executed result -> deterministic fact computation -> validated InsightFacts -> constrained narrative generation -> factual validation -> display

The language model must not independently compute numerical claims.

Reject narratives that:

- introduce unsupported numbers;
- name missing categories;
- claim causation without causal evidence;
- describe uncomputed comparisons;
- contradict the canonical plan;
- ignore material warnings.

### Rule 9 - Reproducibility

Status: Planned: AnalysisArtifact.

Every durable analysis preserves sufficient information to identify why a rerun changed.

Include:

- original question;
- canonical plan;
- plan semantic fingerprint;
- metric-definition fingerprint;
- schema fingerprint;
- relationship fingerprint;
- renderer version;
- SQL artifact;
- execution dialect;
- connection identity;
- execution timestamp;
- data snapshot information when available;
- result schema;
- result fingerprint;
- visualization plan;
- validated InsightFacts;
- narrative version.

### Rule 10 - Honest rerun classification

Status: Planned: RerunComparison.

FiltraQueri should distinguish:

- analytical definition changed;
- source structure or relationship changed;
- returned data or source state changed;
- comparison not safely classifiable.

Do not overclaim that a business reality changed when only result values changed.

Use language such as:

> The analytical definition remained unchanged, while the returned data and result changed.

### Rule 11 - Guided decomposition

Status: Principle and Planned: InvestigationPlan.

Broad questions produce grounded investigation proposals based only on available:

- fields;
- measures;
- metric definitions;
- relationships;
- date coverage;
- supported analysis patterns.

The system must be able to say:

- no cancellation-reason field is available;
- no customer-segment relationship is established;
- the current data cannot support this path.

Do not invent useful-sounding analytical paths unsupported by the data.

### Rule 12 - Human review

Status: Principle and Planned: ReviewCheckpoint and ReviewRecord.

Human review checkpoints should be risk-based.

Require review when:

- metric definitions are ambiguous;
- relationships can materially change row counts;
- many-to-many joins are involved;
- data quality may materially affect results;
- derived metrics require assumptions;
- a chart suppresses categories;
- causal language is proposed;
- rerun comparability is uncertain;
- publication risk is high.

### Rule 13 - Data-quality impact

Status: Principle and Planned: PS-Q1 through PS-Q4.

Data-quality findings must affect analytical readiness.

Examples:

- missing values;
- duplicate business keys;
- invalid dates;
- impossible date order;
- inconsistent units;
- currency conflicts;
- broken relationships;
- unmatched foreign keys;
- sparse categories;
- extreme outliers;
- insufficient sample size;
- insufficient time coverage;
- schema drift.

Issues may result in:

- ready;
- ready with warnings;
- blocked.

### Rule 14 - Execution governance

Status: Principle and Planned: PS-Exec.

Preview capability never implies permission to execute.

Every execution must pass connection-bound policy checks covering:

- authentication and authorization;
- allowed schemas and tables;
- row-level security;
- read-only enforcement;
- PII restrictions;
- timeout;
- row limit;
- resource or cost limits;
- cancellation;
- audit metadata.

### Rule 15 - Tool-independent workflows

Status: Principle and Planned: ReusableAnalysisWorkflow.

Reusable analytical work must not be stored only as:

- SQL strings;
- dashboard files;
- chart configurations;
- one vendor's workbook.

Reusable workflows should preserve:

- business objective;
- metric definitions;
- filters;
- groupings;
- relationships;
- data-quality checks;
- review checkpoints;
- expected result shape;
- visualization intent;
- explanation requirements;
- execution and artifact history.

### Rule 16 - Conversational clarification and metric governance

Status: Principle and Planned: ConversationalClarification, PlanRevision, PlanElementDependencyGraph, and metric registry work in Phase 3.

FiltraQueri analyzes with the user rather than silently guessing consequential business meaning. Clarification is governed analytical planning, not an unstructured chatbot state.

Ask only when multiple reasonable interpretations could materially change the answer, meaning, safety, reproducibility, metric definition, population, time scope, grouping, comparison, filter, relationship, formula, or interpretation.

Low-risk assumptions may be proposed visibly and remain editable without blocking unnecessarily. The experience should avoid becoming interrogative or excessively chatty.

Definition authority levels:

- governed;
- user_defined;
- provisional_proxy.

FiltraQueri must never silently invent or promote a business-term definition as authoritative.

Governed definitions come from approved organizational sources.

User-defined definitions are explicitly supplied or selected by the user and remain scoped according to recorded governance.

A provisional proxy may be proposed only when no governed definition is available and must require explicit acceptance. Accepting a provisional proxy for one investigation does not make it a governed organizational metric or authorize unrestricted reuse.

If the required business meaning cannot be supported honestly, the analysis remains blocked.

Definition authority must be intrinsic to the canonical MeasureDefinition or equivalent governed semantic definition, not UI-only metadata. Preserve authority, source, scope, limitations, acceptance provenance, revision identity, and reuse eligibility through canonical plans, SQL/query artifacts, execution provenance, results, charts and visualizations, explanations, saved analyses, exports, refresh/reopen flows, and persistence. Authority status must never be reconstructed from display labels.

Every accepted clarification creates a new immutable canonical-plan revision. Preserve the previous value, proposed value, accepted value, actor/source, reason, triggering clarification, timestamp or version identity, affected elements, and active revision. Do not silently mutate or erase clarification history. Conversation history must not become a second hidden source of analytical truth.

Every clarification-sensitive plan element must have a stable addressable identity. Dependencies between metrics, rankings, filters, comparisons, relationships, visualizations, explanations, and other downstream analytical elements must be explicitly represented.

Dependency-aware invalidation must use a canonical plan-element dependency graph rather than UI state or hard-coded domain-specific conditions. The future contract must account for direct and transitive dependencies, edge types, invalidation reasons, stale, invalidated, and valid states, revalidation, revision lineage, and cycle prevention or detection. This graph is foundational from the first revision-capable implementation rather than something to retrofit later.

Changing a resolved definition or plan element invalidates only dependent decisions. Preserve unrelated confirmed decisions when they remain valid. Revalidation is required before blocked downstream actions become available again. The user should be told what changed, what became stale or invalid, and what remained valid.

Quick-choice clarification options are accelerators, not a closed form. Natural-language clarification responses may fill, revise, add, remove, or restructure plan elements. For example, a free-text answer may change a simple prior-period comparison into year-over-year analysis.

Free-text answers must be grounded against metadata, governed definitions, supported analytical primitives, renderer capabilities, and execution readiness. If understood intent is unsupported, preserve it and block honestly.

Clarification UX must support behaviors equivalent to:

- explain this question;
- show me an example;
- why do you need this?;
- I do not know;
- recommend the safest supported option;
- use our approved definition;
- provide another definition;
- stop or defer this part of the analysis.

FiltraQueri should rephrase questions in plain language and, when useful, show examples grounded in the user's actual fields without implying that field presence establishes business meaning.

## 9. Explore and Investigation

FiltraQueri previously had an Investigation tab. It was renamed to Explore to reduce interface heaviness and broaden the experience. Investigative capability was not abandoned. Explore remains the user-facing workspace. InvestigationPlan is the internal tool-independent contract for multi-step analysis.

> Explore is the user-facing workspace for discovery, quick answers, guided analysis, and investigation. InvestigationPlan is the internal contract used when a question requires multiple coordinated analytical steps. The previous Investigation tab was renamed to Explore to reduce interface complexity; investigative capability remains a core product behavior rather than a separate top-level mode.

Investigation remains available as a contextual workflow label within Explore. It does not return as a top-level navigation tab. Quick answers should not be forced through investigation language.

Three depths inside Explore:

### A. Quick answer

One narrow question -> one canonical plan -> one result.

### B. Guided analysis

A broader but bounded question -> several related proposals -> analyst approval -> coordinated results.

### C. Investigation

A diagnostic question such as "Why are cancellations increasing?" -> InvestigationPlan -> grounded analytical paths -> dependencies -> data-quality checks -> unavailable-data gaps -> review checkpoints -> related plans -> combined findings.

## 10. InvestigationPlan Direction

A future InvestigationPlan contract conceptually contains:

- investigation objective;
- grounded analytical steps;
- shared filters;
- required metrics;
- required relationships;
- dependencies;
- data requirements;
- unavailable paths;
- review checkpoints;
- readiness;
- completion status;
- related analysis plan IDs;
- combined findings.

Question -> InvestigationPlan -> analyst approval -> AdaptiveReportProposals -> BusinessSqlQueryPlans -> results -> combined findings.

No one-shot ungrounded LLM decomposition.

## 11. Data-Quality and Review Workflows

Future reusable contracts:

InvestigationPlan breaks broad work into grounded analytical tasks.

DataQualityAssessment captures:

- issue;
- evidence;
- severity;
- affected field or relationship;
- analytical impact;
- remediation recommendation;
- readiness impact.

DataQualityAssessment should be divided conceptually into:

- PS-Q1 - Structural quality: required fields, types, schema presence, key structure, and relationship availability.
- PS-Q2 - Semantic quality: metric compatibility, units, currency, grain, target conflicts, and relationship meaning.
- PS-Q3 - Statistical quality: null rates, uniqueness, cardinality, sparse categories, outliers, and insufficient sample size.
- PS-Q4 - Execution-result quality: zero-row results, truncation, distribution shift, incomplete periods, and unexpected result shape.

Structural quality may begin before ExecutedResult. Execution-result quality depends on ExecutedResult. Visualization consumes quality findings. InvestigationPlan consumes quality findings. Quality issues map to ready, ready with warnings, or blocked. Not every quality check must ship before initial visualization.

ReviewCheckpoint captures:

- checkpoint kind;
- reason;
- risk level;
- evidence;
- available decisions;
- blocking status;
- reviewer;
- decision;
- timestamp.

Reviewer roles are workspace-configurable. Review risk should use a conceptual scale of low, medium, high, and blocking. Exact triggers belong in later contracts and policies. Review decisions attach through ReviewRecord rather than becoming canonical plan semantics.

ReusableAnalysisWorkflow captures:

- objective;
- plans;
- checks;
- reviews;
- dependencies;
- outputs;
- rerun history;
- tool-independent semantics.

Relationship:

```text
ReusableAnalysisWorkflow
|-- InvestigationPlan
|-- DataQualityAssessment[]
|-- ReviewCheckpoint[]
|-- BusinessSqlQueryPlan[]
|-- VisualizationPlan[]
`-- AnalysisArtifact[]
```

## 12. Metric Governance

FiltraQueri needs a lightweight in-product metric registry.

Relying only on per-analysis metric definitions breaks reproducibility.

A future metric definition should include:

- metric identity;
- canonical name;
- business description;
- definition authority: governed, user_defined, or provisional_proxy;
- authority source;
- authority scope;
- limitations;
- acceptance provenance;
- revision identity;
- reuse eligibility;
- source entity;
- source field or expression;
- aggregation;
- required filters and exclusions;
- expected grain;
- additivity: additive, semi-additive, or non-additive;
- unit or currency;
- default time dimension;
- compatible groupings;
- owner;
- lifecycle state: draft, approved, deprecated, or archived;
- version;
- created and modified timestamps;
- dependency lineage for derived metrics;
- migration or replacement metadata;
- external semantic-layer source when imported;
- semantic fingerprint.

Definition authority is canonical semantic data. It must travel with the MeasureDefinition or equivalent governed definition through the canonical plan, rendered query artifacts, execution provenance, results, visualization, explanation, saved analysis, export, refresh, reopen, and persistence flows. It must not be inferred later from labels such as "approved" shown in the UI.

Example:

```text
Metric: Total revenue
Version: 3
Authority: governed
Definition: SUM(orders.net_revenue)
Required filter: orders.status = completed
Default time field: orders.completed_date
Owner: Finance Analytics
Status: approved
```

Metric changes create new versions.

Metric versions are immutable once used by a durable analysis.

Old analyses retain the metric version originally used.

New analyses resolve to the current approved version unless explicitly configured otherwise.

Clarification must consult governed metric definitions before proposing user-defined or provisional alternatives. The future metric registry is the authoritative source for approved reusable definitions.

Intended sequence:

Metric registry lookup -> materiality-gated clarification -> definition acceptance -> immutable plan revision -> dependency-aware readiness validation -> rendering -> execution-policy evaluation -> governed execution -> visualization -> explanation -> persistence.

If no governed definition exists, FiltraQueri may ask the user to select or supply a scoped user-defined definition. A provisional proxy may be proposed only when no governed definition is available and the proxy can be represented honestly in the supported analytical contract. Explicit acceptance of a provisional proxy applies only to the recorded scope and does not promote it to an organizational metric.

FiltraQueri should not initially replicate the full dbt Semantic Layer. It should support organizations with no semantic layer. Future imports may support dbt, Cube, LookML, Power BI semantic models, and other catalogs.

This section defines planned governance direction. It does not claim that the metric registry, definition persistence, clarification state, or authority propagation is currently implemented.

## 13. Multi-Dialect Direction

Canonical plan -> RenderRequest -> renderer registry -> dialect-specific SqlArtifact.

Initial sequence:

- DuckDB as current baseline;
- PostgreSQL as the second dialect proving the abstraction;
- Oracle after the abstraction and executed-result foundation;
- additional dialects later.

The same canonical plan may render to multiple dialect artifacts without changing analytical meaning.

No renderer may modify the canonical plan.

Execution always uses the artifact generated for the connected engine.

Preview may display another dialect.

PostgreSQL is the second dialect because it is a lower-risk proof of the renderer abstraction, has meaningful syntax differences without Oracle's full complexity, and allows the interface to be tested before the more distinctive Oracle adapter. Oracle remains an explicit architecture stress test later.

Risk: DuckDB and PostgreSQL are relatively similar, so PS-9c Oracle must include an abstraction-sufficiency audit and may require interface refinement.

PostgreSQL rendering may ship before real PostgreSQL execution. Real production-database execution requires PS-Exec.

## 14. Executed Result and Analysis Artifact

A future ExecutedResult conceptually contains:

- execution ID;
- plan ID;
- SQL artifact ID;
- execution dialect;
- connection identity;
- execution timestamp;
- result schema;
- typed rows or result reference;
- row count;
- truncation state;
- warnings;
- execution statistics;
- result fingerprint.

Stable or reproducibility-relevant ExecutedResult references may include:

- plan identity;
- SQL artifact identity;
- result schema;
- result fingerprint;
- engine or FiltraQueri version;
- renderer configuration identity.

Runtime metadata may include:

- execution ID;
- timestamps;
- runtime statistics;
- transient warnings;
- authenticated principal;
- connection instance.

Two executions may represent the same analysis while having different runtime metadata.

VisualizationPlan requires ExecutedResult or an equivalent dialect-neutral result contract.

AnalysisArtifact is the durable envelope that references versionable sub-artifacts. It should be introduced incrementally rather than requiring every component to exist immediately.

Conceptual decomposition:

AnalysisDefinition:

- original question;
- canonical plan;
- active canonical-plan revision;
- clarification revision lineage;
- metric versions;
- definition authority records;
- semantic fingerprint.

SqlArtifact:

- dialect;
- SQL;
- renderer version;
- rendering warnings.

ExecutionRecord:

- execution context;
- timestamps;
- policy outcome;
- runtime statistics.

ResultArtifact:

- result schema;
- typed rows or governed external reference;
- truncation;
- result fingerprint.

VisualizationArtifact:

- VisualizationPlan;
- selected visualization;
- override history.

InsightArtifact:

- validated InsightFacts;
- deterministic or constrained narrative.

ReviewRecord:

- checkpoints;
- decisions;
- reviewer;
- timestamps.

RerunComparison:

- semantic;
- plan revision lineage;
- definition;
- structure;
- result;
- classification.

This, not the SQL string, is the durable unit of analytical work.

## 15. Visualization Direction

VisualizationPlan = canonical plan semantics + executed-result schema + cardinality + values and distribution + analytical intent + safety constraints.

Examples:

- categorical grouping + one measure + few rows -> bar chart;
- date grouping + continuous ordered periods -> line chart;
- one scalar result -> stat card;
- too many categories -> top-N, "Other," table, or clarification;
- irregular time gaps -> gap warning or alternative chart.

Require:

- readiness;
- capability;
- deterministic recommendation;
- explainable recommendation reason;
- safe user override;
- no unsupported chart guessing.

Minimum first VisualizationPlan slice after ExecutedResult:

- stat card: no grouping plus one scalar result;
- bar chart: one categorical grouping plus one measure plus safe category count;
- line chart: one ordered date grouping plus one measure plus acceptable period continuity;
- table: deterministic fallback when no safe visual recommendation exists.

Example safety gates:

- excessive category count;
- irregular time gaps;
- truncated result;
- insufficient rows;
- incompatible result shape.

Visualization can proceed in parallel with incremental AnalysisArtifact work once ExecutedResult exists. This direction does not promise every chart type.

## 16. Explanation Direction

Future InsightFact categories include:

- top category;
- bottom category;
- share of total;
- period change;
- rank;
- contribution;
- threshold crossing;
- missing-data warning;
- insufficient-data warning.

Example:

```text
kind: top_category
category: North
measure: total_revenue
value: 2300000
shareOfTotal: 31.4
```

The narrative layer may verbalize validated facts only.

The first explanation sequence is:

InsightFact computation -> deterministic narrative templates -> validation -> optional constrained LLM narrative later.

The first explanation version must not require an LLM.

Initial deterministic InsightFact families:

- top category;
- bottom category;
- share of total;
- rank;
- missing-data warning;
- insufficient-data warning.

Future LLM safeguards:

- every numerical claim must map to a validated fact;
- causal wording must be rejected unless supported by an explicitly validated causal-analysis fact type;
- unsupported categories and comparisons reject the narrative;
- deterministic template output remains the safe fallback.

This direction does not prescribe a brittle implementation such as a simple word blocklist as the final architecture.

No raw result-row hallucination.

No causal claims from descriptive analyses.

## 17. Reproducibility and Rerun Comparison

### A. Same definition, changed returned data

Plan unchanged. Metric version unchanged. Schema unchanged. Relationships unchanged. Result changed.

Safe conclusion:

> The analytical definition remained unchanged, while the returned data and result changed.

### B. Definition changed

Plan, metric, grouping, filter, or semantic fingerprint changed.

Conclusion:

> The analysis is not directly comparable because the analytical definition changed.

### C. Structure changed

Intended semantics unchanged. Schema or relationship fingerprint changed.

Conclusion:

> The intended analysis remained the same, but the source structure or relationship model changed.

### D. Unclassifiable

Insufficient source lineage or snapshot information.

Conclusion:

> FiltraQueri cannot safely determine why the result changed.

Reproducibility safeguards:

- fingerprints must be versioned;
- the FiltraQueri engine version should be recorded;
- metric dependency changes must propagate into derived metric fingerprints;
- timestamps and reviewer identities must not enter semantic fingerprints;
- full result rows should not be stored by default;
- governed row persistence must follow execution and privacy policy;
- result fingerprints must not become a covert channel for sensitive data;
- where exact source snapshots are unavailable, comparison may be unclassifiable.

Fingerprint design must balance determinism, comparison usefulness, privacy, storage, and cross-environment safety. This document does not prescribe one final result-fingerprint algorithm.

## 18. User Experience Principles

Principles:

- progressive disclosure;
- plain-language explanations;
- analyst control;
- explicit assumptions;
- materiality-gated clarification;
- visible proposed plan revisions before acceptance;
- explainable clarification questions;
- visible blockers;
- no silent fallback;
- no automatic Insert;
- no automatic Run;
- preview before execution;
- review checkpoints proportionate to risk;
- support for quick answers and deeper investigations in the same Explore workspace;
- preserve technical inspectability without forcing syntax on the user.

## 19. Roadmap

The roadmap is capability-driven rather than date-driven.

Current completion:

PS-8c -> explicit natural-language multi-filter AND grounding -> committed and pushed as `fe8c321`.

### Phase 0 - Direction and documentation hygiene

- authoritative strategy;
- documentation inventory;
- classification;
- contradiction resolution;
- document index.

### Phase 1 - Dialect-neutral rendering foundation

PS-9a-i - Renderer abstraction:

- SqlDialectId;
- SqlDialectRenderer interface or registry;
- SqlArtifact contract;
- renderer-version identity;
- DuckDB adapter;
- compatibility wrapper for existing calls;
- zero byte-level DuckDB regression.

PS-9a-ii - Rendering context and preview/execution separation:

- RenderRequest;
- dialect capability reporting;
- preview/export dialect selection;
- connection-bound execution dialect;
- execution-artifact selection;
- explicit Previewing versus Run target UX contract;
- no second dialect yet.

PS-9b - PostgreSQL renderer:

- prove rendering portability;
- preserve PostgreSQL as the second dialect;
- do not imply real PostgreSQL execution before PS-Exec.

PS-Exec - Execution policy and governed connection contract:

- ExecutionConnection identity;
- authentication context;
- authorization and allowed schemas/tables;
- read-only enforcement;
- row-level security context;
- PII restrictions;
- timeout;
- row and resource limits;
- cancellation;
- query audit record;
- execution-policy readiness and blockers.

PS-Exec must precede execution against real PostgreSQL, Oracle, or other production connections. Preview capability does not grant execution permission. No real connected-database execution should bypass PS-Exec.

Parallel date-foundation slices:

- PS-8d - relative-date policy and canonical contract: anchor-date policy, timezone policy, resolved date-window identity, deterministic boundaries, and reproducibility metadata before grounding/rendering slices. This does not immediately promise full natural-language execution.
- PS-8e - inclusive single-date operators such as `on_or_before` and `on_or_after`; exact naming and compatibility are subject to contract audit.

OR/NOT expression trees do not belong in PS-8d or PS-8e.

Completion gate:

- DuckDB byte-exact regression;
- PostgreSQL byte-exact renderer coverage;
- execution remains governed and cannot bypass PS-Exec.

### Phase 2 - Executed-answer foundation

- ExecutedResult;
- result profiling;
- PS-Q1 structural quality;
- PS-Q4 initial execution-result quality;
- minimum VisualizationPlan;
- initial user-visible chart path.

Completion gate:

- question;
- plan;
- SQL;
- governed DuckDB execution;
- dialect-neutral result;
- safe visual or table;
- visible warnings.

### Phase 3 - Conversational clarification and metric governance foundation

- PS-CMG1 - definition authority contract: governed, user_defined, provisional_proxy; source, scope, limitations, acceptance provenance, revision identity, and reuse eligibility;
- PS-CMG2 - stable plan-element identities for clarification-sensitive metrics, filters, groupings, comparisons, rankings, relationships, visualizations, explanations, and downstream analytical elements;
- PS-CMG3 - immutable canonical-plan revisions for accepted clarifications, including previous value, proposed value, accepted value, actor/source, reason, triggering clarification, timestamp or version identity, affected elements, and active revision;
- PS-CMG4 - canonical plan-element dependency graph with direct and transitive dependencies, edge types, invalidation reasons, stale/invalidated/valid states, revalidation, revision lineage, and cycle prevention or detection;
- PS-CMG5 - materiality-gated clarification state that blocks preview, insert, run, execution, and authoritative answer generation only when unresolved ambiguity materially affects meaning, safety, reproducibility, or supported output;
- PS-CMG6 - provenance propagation through canonical plans, SQL/query artifacts, execution provenance, results, charts and visualizations, explanations, saved analyses, exports, refresh/reopen flows, and persistence;
- PS-CMG7 - structural free-text clarification grounding against metadata, governed definitions, supported analytical primitives, renderer capabilities, and execution readiness;
- PS-M1 - metric-definition contract;
- PS-M2 - validation and compatibility;
- PS-M3 - deterministic identity and versioning;
- PS-M4 - registry resolution and approval state;
- PS-M5 - canonical plan integration and metric fingerprints;
- PS-Q2 semantic quality.

Completion gate:

- definition authority is canonical data, not UI metadata;
- metric registry lookup precedes user-defined or provisional definition proposals;
- accepted clarifications create immutable canonical-plan revisions;
- dependency-aware invalidation preserves unrelated confirmed decisions;
- material unresolved clarification blocks downstream actions honestly;
- approved versioned metric definitions;
- deterministic metric fingerprints;
- plan integration;
- portability across DuckDB and PostgreSQL rendering.

Foundational contracts and governance work in this phase must precede rich conversational UI. Later prompts must not build clarification chat surfaces, static question scripts, or UX-only authority labels before canonical state, registry lookup, plan revision, dependency graph, invalidation/revalidation, and provenance foundations exist.

### Phase 4 - Durable analytical artifacts

- incremental AnalysisArtifact;
- AnalysisDefinition;
- ExecutionRecord;
- ResultArtifact;
- VisualizationArtifact;
- InsightFact;
- deterministic narrative;
- rerun comparison.

Completion gate:

- saved analysis roundtrip;
- rerun comparison produces one honest classification;
- narrative contains only validated facts.

### Phase 5 - Guided intelligence and enterprise workflows

- InvestigationPlan;
- rich conversational clarification UX built on Phase 3 canonical contracts, not before them;
- PS-Q3 statistical quality;
- ReviewCheckpoint and ReviewRecord;
- ReusableAnalysisWorkflow;
- PS-9c Oracle;
- optional constrained LLM narrative;
- governed publication through Reports;
- reusable patterns through Templates.

Completion gate:

- analyst can approve grounded investigation paths;
- unavailable-data gaps are explicit;
- execution is policy-governed;
- results can be reviewed and published;
- Oracle validates dialect abstraction.

### Phase 6+ - SQL depth driven by observed need

- relative dates;
- inclusive date operators;
- OR/NOT expression trees;
- subqueries;
- CTEs;
- window functions;
- filtered aggregates;
- datetime/timezone semantics;
- additional dialects.

### Templates and Reports Direction

Browse Templates should evolve toward canonical reusable analytical patterns, optional metric requirements with recorded definition authority, relationship requirements, readiness checks, and later ReusableAnalysisWorkflow backing. Permanent templates remain immutable. User adaptation creates a session or saved instance.

Browse Reports should evolve toward published governed AnalysisArtifacts with stored plan revisions, metric versions, definition authority, execution lineage, visualization, validated findings, rerun state, and publication and review metadata.

This document does not implement or redesign these surfaces.

### Release Milestones

M1 - Dialect-neutral SQL foundation: same canonical plan, byte-identical DuckDB, architecture ready for more dialects.

M2 - Two-dialect proof: same plan renders to DuckDB and PostgreSQL.

M3 - Executed-answer foundation: users can ask, execute safely, inspect results, and receive a safe chart or table.

M4 - Conversational clarification and governed metrics: material clarifications produce immutable canonical-plan revisions, definition authority is preserved as canonical data, and approved definitions are stable, versioned, and reusable.

M5 - Durable analysis artifact: analyses can be saved, shared, and reopened with lineage.

M6 - Rerun comparison: FiltraQueri can explain whether definition, structure, result, or comparability changed.

M7 - Guided investigation: broad questions become grounded analyst-approved investigation paths.

M8 - Enterprise governed workflow: execution, review, publication, templates, and reusable workflows operate under policy.

No release dates are implied.

## 20. Explicit Non-Goals for the Direction Document

This document does not:

- define implementation details for every future contract;
- replace individual architecture decision records;
- replace per-slice implementation briefs;
- authorize unsupported SQL behavior;
- authorize ungrounded AI generation;
- commit to a public release date;
- guarantee every future dialect or visualization type;
- authorize deleting older documents before inventory;
- change production behavior by itself.

The customer-facing statements in this document describe the intended end-state product. They must not be used as claims of currently shipped functionality until the supporting arcs exist, including governed execution, ExecutedResult, visualization, validated explanation, durable artifacts, conversational clarification and metric governance foundations, and rerun comparison. The statements remain product direction.

## 21. Document Governance

Changes to this document require explicit product-direction approval.

Implementation briefs must cite relevant standing rules.

Architecture changes that conflict with this doctrine require a recorded decision.

Older documents may remain for historical context but must not silently override this document.

Documentation inventory will determine which files are authoritative, supporting, historical, superseded, duplicate, temporary, or need revision.

Every future PS, UX, metric, execution, visualization, explanation, artifact, or workflow audit must include this question:

Does this change conflict with `FILTRAQUERI_PRODUCT_DIRECTION.md`?

If yes:

- the conflict must be resolved;
- an explicit architectural decision must be recorded;
- this strategy document must be updated only with approved product-direction changes.

## 22. Final Summary

FiltraQueri is not being built as a chatbot that happens to produce SQL.

It is being built as a trustworthy analytical-answer system in which:

- the canonical plan preserves meaning;
- material clarifications revise the canonical plan under governance;
- metric definitions are governed;
- SQL is portable;
- execution is controlled;
- results are profiled;
- charts are appropriate;
- explanations are validated;
- workflows are reviewable;
- analyses are durable;
- reruns are comparable;
- unsupported questions are refused honestly.
