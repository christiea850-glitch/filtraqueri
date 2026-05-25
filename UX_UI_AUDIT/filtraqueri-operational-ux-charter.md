# FiltraQueri Operational UX Charter

## Purpose

This charter locks FiltraQueri's product concept so future development does not drift back into metadata-heavy dashboards, duplicated panels, global Human/Analyst mode, or preview-only advisory UI.

FiltraQueri exists to answer business questions through guided, AI-native workflows. It should not expose internal system architecture as the main UI.

## Core Product Principle

FiltraQueri is an operational investigation workspace for business users and analysts.

The product should help users move from an uploaded dataset to a useful answer through understandable steps:

1. Understand the data.
2. Shape a business question.
3. Generate or inspect analytical work.
4. Review findings.
5. Decide what to do next.
6. Package outputs for consumption.

Internal architecture may support this journey, but it must not become the journey. Metadata, advisory contracts, execution planning, governance traces, readiness states, generated code, and diagnostic details are background infrastructure unless they change a user decision.

## Tab Charters

### Home / Library

**Purpose**

Help users find, resume, and manage analytical work.

**Owns**

- Dataset and workspace entry points.
- Recent files, saved investigations, and reusable work.
- Resume context for active or historical work.
- Lightweight orientation before a dataset is opened.

**Never Shows / Does**

- Does not inspect schema deeply.
- Does not build queries.
- Does not interpret analytical results.
- Does not duplicate Data, Workspace, Intelligence, Optimization, or Dashboard content.
- Does not expose runtime metadata, planning contracts, or execution internals.

**The One Question It Answers**

What work can I open, resume, or start?

### Data

**Purpose**

Help users understand what the dataset appears to contain and whether it is suitable for investigation.

**Owns**

- Dataset structure and quality context.
- Row count, column count, column types, missing values, and source shape.
- Worksheet/source understanding.
- Connected source cues and relationship understanding.
- Entity, metric, date, and operational signal detection.
- Dataset-level opportunities.

**Never Shows / Does**

- Does not build or execute queries.
- Does not interpret analysis results.
- Does not present dashboards.
- Does not generate SQL, Python, or R as the primary experience.
- Does not duplicate final recommendations or executive summaries.
- Does not become a workflow launcher or task configuration surface.

**The One Question It Answers**

What is this data about, and what might be worth investigating?

### Workspace

**Purpose**

Serve as the operational core where business questions are shaped, analysis is generated or inspected, and results are reviewed.

**Owns**

- Business question framing.
- Field selection, filtering, grouping, and comparison setup.
- Generated SQL, Python, or R when relevant.
- Execution approval and result creation.
- Active analysis result.
- Per-result explainability and analyst-depth expansion.
- Result-specific next actions.

**Never Shows / Does**

- Does not repeat broad dataset onboarding from Data.
- Does not present executive rollups as the main surface.
- Does not become a generic metadata explorer.
- Does not show global Analyst Mode as a separate product identity.
- Does not expose internal planning contracts unless opened as per-result technical detail.
- Does not create preview-only advisory panels that cannot lead to an output.

**The One Question It Answers**

What question am I answering, and what result did the workspace produce?

### Optimization

**Purpose**

Help users define and evaluate operational improvements, constraints, objectives, tradeoffs, and scenarios.

**Owns**

- Optimization objectives.
- Constraints and business rules.
- Scenario inputs.
- Tradeoff framing.
- Feasibility and decision support.
- Operational recommendations tied to objective/constraint logic.

**Never Shows / Does**

- Does not duplicate raw dataset profiling.
- Does not own general analysis results.
- Does not become a dashboard gallery.
- Does not expose solver or runtime internals as the primary UI.
- Does not show recommendations unless they are tied to an explicit optimization objective or constraint.

**The One Question It Answers**

What operational choice should I improve, and under what constraints?

### Intelligence

**Purpose**

Translate workspace outputs into business meaning, recommendations, executive summaries, and decision context.

**Owns**

- Executive summaries.
- Recommendations.
- Narrative interpretation.
- Cross-result meaning.
- Strategic implications.
- Decision support explanations.

**Never Shows / Does**

- Does not build queries.
- Does not own raw result tables.
- Does not duplicate Data profiling.
- Does not expose schema, execution plans, or governance metadata as primary content.
- Does not create new analysis results directly.
- Does not become a second Workspace.

**The One Question It Answers**

What does the work mean, and what should I consider next?

### Dashboards

**Purpose**

Package validated outputs into consumable visuals, KPI views, exports, and storytelling layouts.

**Owns**

- KPI visuals.
- Dashboard layouts.
- Export and presentation-ready storytelling layouts.
- Read-only visual summaries.
- Stakeholder-facing views.

**Never Shows / Does**

- Does not own query setup.
- Does not own raw dataset understanding.
- Does not own optimization objectives.
- Does not expose internal metadata or planning contracts.
- Does not become the place where analysis is created.
- Does not duplicate Intelligence recommendations unless they are part of a packaged narrative.

**The One Question It Answers**

How do I present or monitor the answer?

## One-Fact-One-Owner Map

| Fact / Feature | Canonical Owner | Notes |
| --- | --- | --- |
| Dataset file identity | Home / Library | Home owns discovery and resumption; Data owns understanding after open. |
| Recent datasets and saved work | Home / Library | Do not duplicate as persistent panels inside every tab. |
| Row count | Data | May appear elsewhere only as quiet context when necessary. |
| Column count | Data | Secondary context outside Data only. |
| Column types | Data | Do not repeat in Workspace unless selecting fields requires it. |
| Missing values | Data | Show only when quality affects a user decision. |
| Worksheet/source list | Data | Workspace may reference active source only. |
| Workbook relationships | Data | Dedicated focused source workspace may inspect details. |
| Entity detection | Data | Workspace can consume selected entity context, not re-explain detection. |
| Metric/date/dimension candidates | Data | Workspace uses them during setup; Data owns discovery. |
| Business question | Workspace | Intelligence may summarize questions already answered. |
| Field selection | Workspace | Data may suggest fields, but Workspace owns selection. |
| Filters/grouping/comparisons | Workspace | Do not surface as dashboard metadata elsewhere. |
| Generated SQL/Python/R | Workspace | Technical depth is expandable per result, not global mode chrome. |
| Execution approval | Workspace | No other tab should trigger execution. |
| Analysis result | Workspace | Intelligence and Dashboards consume validated outputs. |
| Result table and pagination | Workspace | Preserve result/export ownership here. |
| Per-result technical explanation | Workspace | Expandable detail only; not a global Analyst surface. |
| Executive summary | Intelligence | Dashboards may package it, but Intelligence owns meaning. |
| Recommendations | Intelligence | Optimization owns recommendations only when tied to constraints/objectives. |
| Decision support narrative | Intelligence | Must be based on produced work or explicit context. |
| KPI visuals | Dashboards | Data owns KPI candidates; Dashboards owns KPI presentation. |
| Export/storytelling layouts | Dashboards | Workspace may export raw result data; Dashboards owns packaged presentation. |
| Optimization constraints/objectives | Optimization | Not Data, Workspace, Intelligence, or Dashboards. |
| Scenario tradeoffs | Optimization | Must connect to explicit objective logic. |
| Runtime governance metadata | Background Infrastructure | Only appears when it changes trust, safety, or analyst inspection decisions. |
| Planning contracts | Background Infrastructure | Never a primary Human-facing surface. |
| Engine compatibility | Background Infrastructure | Show only inside advanced technical detail when needed. |
| Advisory metadata | Background Infrastructure | Must be converted into user-facing guidance or hidden. |

## Standing Rules

### One Fact, One Owner

Every visible fact must have one canonical owner. Other tabs may reference the fact only when it directly supports the current decision.

### Creation Surfaces vs Consumption Surfaces

Workspace and Optimization are creation surfaces. They shape questions, approve work, produce results, or define decision logic.

Intelligence and Dashboards are consumption surfaces. They explain, summarize, recommend, package, and present outputs.

Data is an understanding surface. It helps users see what the dataset is and what may be possible, but it does not create analysis outputs.

### No Metadata Panel Unless It Changes a User Decision

Metadata should be visible only when it affects what the user should do next. If it merely proves the internal system exists, it belongs in advanced disclosure, technical detail, or background infrastructure.

### No Preview-Only Surfaces

Advisory UI must lead to a real user path: shape a question, inspect data, approve execution, review a result, define an objective, create a recommendation, or package an output. Preview-only panels that do not change the workspace are product debt.

### Workspace Is the Operational Core After Upload

After a dataset is opened and understood, the product should naturally move users toward Workspace. Workspace owns the active business question, generated work, execution approval, result review, and per-result analyst depth.

### Data Is Dataset Understanding Only

Data should not become a query builder, result interpretation page, dashboard, or workflow configuration hub. It answers what the dataset is about and what might be worth investigating.

### Intelligence and Dashboards Are Read-Only Projections

Intelligence explains meaning and recommendations. Dashboards package visuals and storytelling. Neither should create core analysis results directly or expose internal metadata as the primary experience.

### Analyst Depth Is Per-Result Expandable Logic

Analyst depth should live inside expandable per-result or per-workspace technical detail. FiltraQueri should avoid a global app mode that makes Human and Analyst feel like separate products.

## Definition of Done for Future UX and Code Slices

Every future UX or code change must pass these checks before implementation is considered complete:

1. Which charter owns this?
2. Does it violate the tab's never-list?
3. Is this fact already owned elsewhere?
4. Would a business user act differently from seeing this?
5. Is this creating an output or only previewing internal metadata?

If a change cannot answer these questions clearly, it should remain planning-only until ownership, user decision value, and output path are clarified.

## Enforcement Notes

- Prefer moving repeated facts to their canonical owner instead of styling duplicates better.
- Prefer disclosure or focused workspaces for deep detail instead of stacked panels.
- Prefer user-action language over system-architecture language.
- Prefer "answer the question" over "show the machinery."
- Treat visible metadata as a cost that must earn its place.
- Treat every new panel as suspicious until it has a clear owner, decision value, and continuation path.
