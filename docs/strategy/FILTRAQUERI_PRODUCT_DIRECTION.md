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

## 8. Standing Product and Architectural Rules

### Rule 1 - Reusable engineering

Production behavior must be domain-neutral and derived from canonical contracts, field identities, types, measures, groupings, filters, relationships, readiness, and capability. No static industry branches unless explicitly approved.

### Rule 2 - Canonical plan

The canonical analysis plan is the sole source of analytical meaning. SQL, visualization, explanation, export, execution, and rerun behavior derive from it.

### Rule 3 - Dialect neutrality

No SQL dialect syntax belongs in the canonical plan. Dialect-specific syntax belongs only to renderer implementations and SQL artifacts.

### Rule 4 - Rendering as a separate operation

A render operation conceptually follows:

RenderRequest(plan, dialect) -> SqlArtifact

A SQL artifact should include:

- dialect;
- SQL text;
- renderer version;
- rendering metadata;
- capability status;
- warnings or blockers.

### Rule 5 - Execution and preview separation

Preview/export dialect is user-selectable.

Execution dialect is bound to the active connection.

Run executes the artifact generated for the active connection's dialect, regardless of which dialect is currently previewed.

The UI must make both explicit, for example:

Previewing: Oracle SQL

Run target: DuckDB

### Rule 6 - Honest readiness and capability

The system must distinguish:

- ready;
- ready with warnings;
- blocked.

Unsupported, ambiguous, or incomplete analyses must fail closed.

No partial query, partial result, valid-subset fallback, or filter-free fallback may silently replace the requested analysis.

### Rule 7 - Visualization grounding

Visualization decisions require:

- canonical plan meaning;
- executed-result schema;
- result cardinality;
- result values and distribution;
- ordering or ranking intent;
- safe display constraints.

Chart choice must not be derived from column names or plan structure alone.

### Rule 8 - Explanation grounding

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

FiltraQueri should distinguish:

- analytical definition changed;
- source structure or relationship changed;
- returned data or source state changed;
- comparison not safely classifiable.

Do not overclaim that a business reality changed when only result values changed.

Use language such as:

> The analytical definition remained unchanged, while the returned data and result changed.

### Rule 11 - Guided decomposition

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

## 9. Explore and Investigation

FiltraQueri previously had an Investigation tab. It was renamed to Explore to reduce interface heaviness and broaden the experience. Investigative capability was not abandoned. Explore remains the user-facing workspace. InvestigationPlan is the internal tool-independent contract for multi-step analysis.

> Explore is the user-facing workspace for discovery, quick answers, guided analysis, and investigation. InvestigationPlan is the internal contract used when a question requires multiple coordinated analytical steps. The previous Investigation tab was renamed to Explore to reduce interface complexity; investigative capability remains a core product behavior rather than a separate top-level mode.

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
- source entity;
- source field or expression;
- aggregation;
- required filters and exclusions;
- expected grain;
- default time field;
- compatible groupings;
- owner;
- approval status;
- version;
- created and modified timestamps;
- semantic fingerprint.

Example:

```text
Metric: Total revenue
Version: 3
Definition: SUM(orders.net_revenue)
Required filter: orders.status = completed
Default time field: orders.completed_date
Owner: Finance Analytics
Status: approved
```

Metric changes create new versions.

Old analyses retain the metric version originally used.

New analyses resolve to the current approved version unless explicitly configured otherwise.

FiltraQueri should not initially replicate the full dbt Semantic Layer. It should support organizations with no semantic layer. Future imports may support dbt, Cube, LookML, Power BI semantic models, and other catalogs.

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

A future AnalysisArtifact conceptually contains:

- original question;
- canonical plan;
- plan fingerprint;
- metric versions;
- schema fingerprint;
- relationship fingerprint;
- SQL artifacts;
- execution metadata;
- ExecutedResult;
- VisualizationPlan;
- InsightFacts;
- narrative;
- review decisions;
- lineage;
- rerun history.

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

## 18. User Experience Principles

Principles:

- progressive disclosure;
- plain-language explanations;
- analyst control;
- explicit assumptions;
- visible blockers;
- no silent fallback;
- no automatic Insert;
- no automatic Run;
- preview before execution;
- review checkpoints proportionate to risk;
- support for quick answers and deeper investigations in the same Explore workspace;
- preserve technical inspectability without forcing syntax on the user.

## 19. Roadmap

Current completion:

PS-8c -> explicit natural-language multi-filter AND grounding -> committed and pushed as `fe8c321`.

Next:

Documentation -> authoritative product direction -> read-only documentation inventory -> document classification and cleanup.

Dialect foundation:

PS-9a -> dialect-neutral renderer registry -> RenderRequest -> SqlArtifact -> DuckDB implementation -> preview/execution separation -> zero DuckDB regression.

PS-9b -> PostgreSQL renderer -> prove dialect abstraction.

Semantic governance:

PS-M1 -> metric-definition contract.

PS-M2 -> validation and compatibility.

PS-M3 -> deterministic identity and versioning.

PS-M4 -> registry resolution and approval state.

PS-M5 -> canonical plan integration and metric fingerprints.

Result and reproducibility foundation:

ExecutedResult contract -> result schema -> typed rows -> result profiling -> execution metadata -> result fingerprints.

AnalysisArtifact -> semantic fingerprints -> schema fingerprints -> relationship fingerprints -> metric fingerprints -> execution lineage -> rerun history.

User-visible answer path:

VisualizationPlan -> readiness -> capability -> safe chart recommendation -> user override.

PS-9c -> Oracle renderer.

Rerun comparison -> semantic diff -> metric-definition diff -> schema/relationship diff -> result diff -> honest classified explanation.

InsightFact -> deterministic fact computation -> constrained narrative generation -> factual validation.

Guided intelligence:

InvestigationPlan -> supported paths -> unavailable-data gaps -> analyst approval -> coordinated execution -> combined findings.

Data-quality and review:

DataQualityAssessment -> analytical impact.

ReviewCheckpoint -> risk-based human confirmation.

ReusableAnalysisWorkflow -> portable, governed, repeatable analytical processes.

Continued SQL depth:

- relative dates;
- inclusive date operators;
- OR/NOT expression trees;
- subqueries;
- CTEs;
- window functions;
- filtered aggregates;
- datetime/timezone semantics;
- additional dialects.

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

## 21. Document Governance

Changes to this document require explicit product-direction approval.

Implementation briefs must cite relevant standing rules.

Architecture changes that conflict with this doctrine require a recorded decision.

Older documents may remain for historical context but must not silently override this document.

Documentation inventory will determine which files are authoritative, supporting, historical, superseded, duplicate, temporary, or need revision.

## 22. Final Summary

FiltraQueri is not being built as a chatbot that happens to produce SQL.

It is being built as a trustworthy analytical-answer system in which:

- the canonical plan preserves meaning;
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
