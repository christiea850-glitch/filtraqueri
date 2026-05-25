# UX-CORE-1 - Slice 1

# Data Tab Charter Enforcement (Safe Incremental)

## Document Status

Planning, audit, and implementation preparation only.

No application code, routing, backend logic, SQL execution, result/export behavior, upload/session restore, runtime persistence, or governance contracts are changed by this document.

## Governing Sources Reviewed

- `UX_UI_AUDIT/filtraqueri-operational-ux-charter.md`
- `docs/ux-canonical-workspace-blueprint.md`
- `docs/ux-canonical-workspace-layout-specification.md`
- `docs/governance-review-checklist.md`
- `docs/governance-hard-fail-rules.md`
- `docs/s2-advisory-vs-executable-boundary-audit.md`
- `docs/s3-h10-runtime-bridge-architecture-checkpoint-audit.md`
- `docs/filtraqueri-claude-review-summary.md`
- `docs/ux-f6-claude-blueprint-visual-layout-alignment.md`
- `frontend/src/components/dataset/DatasetSummaryPanel.tsx`
- `frontend/src/features/tasksLauncher/TaskLauncherPanel.tsx`
- Related wiring in `frontend/src/App.tsx`

## Authoritative Rule

The FiltraQueri Operational UX Charter is authoritative when older UX concepts conflict.

For Slice 1, the Data tab must answer only:

> What is this data about, and what might be worth investigating?

The Data tab must not behave like a workflow launcher, investigation center, query builder, dashboard, Human Mode operational hub, task configuration surface, or metadata exhibition layer.

## Preservation Contract

Slice 1 must preserve:

- routing and back behavior
- upload/session restore
- worksheet switching
- ActiveResultModel integrity
- ResultsGrid behavior
- result pagination
- result export behavior
- SQL workspace integrity
- existing task functionality
- existing command launcher behavior
- runtime governance boundaries
- advisory-only metadata behavior
- existing backend APIs and backend behavior

Slice 1 must not add:

- backend changes
- execution changes
- persistence changes
- SQL engine changes
- runtime bridge execution
- advisory modules gaining execution power
- new global navigation architecture
- Workspace redesign
- dashboards or chart generation

## Current State Audit

### High-Level Assessment

`DatasetSummaryPanel.tsx` currently combines several product roles inside the Data tab:

- dataset understanding
- operational investigation guidance
- focused operational workspaces
- workflow/task launch
- business question interpretation
- KPI opportunity review
- semantic intelligence review
- dataset preview
- worksheet/source switching
- detail route activation

Some of this is Data-owned. Much of it now belongs to Workspace, Intelligence, Dashboards, or background infrastructure under the Operational UX Charter.

The current implementation is structurally safe because most surfaces are deterministic, presentational, and user-triggered. The UX issue is ownership drift: Data is carrying too many next-step, workflow, and intelligence surfaces, which weakens its identity as the dataset-understanding checkpoint.

### Data-Owned Surfaces

These are aligned with the Data charter:

- dataset title and active worksheet/source context
- dataset purpose label
- row count, column count, source count, field mix
- detected columns drill-in
- worksheet/source selector
- dataset preview page
- workbook relationship/connected source understanding
- entity, metric, date, dimension signals when framed as dataset understanding
- dataset intelligence detail when framed as profile detail, not decision/recommendation machinery

### Workspace-Owned Leakage

These surfaces currently make Data behave like an operational investigation center:

- `ActionRail` labeled "Investigate"
- primary focus block that recommends an operational next move
- `openOperationalWorkspace(...)` pathways from Data evidence
- local focused workspaces: connections, entities, KPIs, trends
- `guidedAnalyticsTasks` focused workflow
- `TaskLauncherPanel` mounted inside Data
- `humanGuidance` focused workflow using `onHumanIntentSelect`
- "Choose the next operational move" language
- "Continue investigation" from focused operational workspaces

These should become temporary navigation bridges or move to Workspace later.

### Intelligence-Owned Leakage

These surfaces currently make Data behave like an Intelligence tab:

- `suggestedAnalysisPaths`
- `businessSemantics`
- `kpiIntelligence`
- `businessQuestions`
- `opportunityLabels` from recommendations, KPIs, and interpreted questions
- `Related opportunities` context rail section
- recommendation cards with confidence and possible future result shapes
- KPI opportunity cards
- business question intent mapping cards

Some semantic detection is Data-owned when it explains dataset meaning. Recommendations, executive-style meaning, and cross-result interpretation should move to Intelligence later.

### Dashboard-Owned Leakage

These surfaces currently drift toward dashboard or visual packaging ownership:

- `kpiIntelligence` when it presents possible KPIs as insight opportunities
- KPI opportunity cards that mention possible chart types
- any "Possible KPIs" surface that implies presentation rather than dataset signal
- "Visualize data" Human guidance card

Data may show KPI candidates as dataset signals. It should not own KPI visuals, chart options, dashboard readiness, or presentation packaging.

### Background Infrastructure Leakage

These surfaces reveal internal machinery or metadata patterns too visibly:

- `datasetIntelligencePreview` generated from runtime bridge consumer metadata
- `DatasetIntelligenceDetailPage` facts such as source descriptor/version-style detail if exposed too prominently
- `dialectRecommendation?.recommendedFutureEngine?.label`
- "Advanced context" text referencing profile metadata
- operational workspace route labels such as `/workspace/connections`
- TaskLauncher advanced metadata inside `TaskLauncherPanel`
- planning, execution preview, analysis plan, readiness, relationship planning, engine compatibility inside task detail

These should be background-only or advanced disclosure. In Data, they should never lead the experience.

## Specific Surface Audit

### TaskLauncherPanel Usage

Current use:

- Mounted in `DatasetSummaryPanel.tsx` when `activeFocusedWorkflow === "guidedAnalyticsTasks"`.
- Receives `dataset`, `selectedTaskId`, and `onSelectedTaskIdChange`.
- Internally owns task categories, task selection, task configuration, guided inputs, analysis plan preview, readiness, relationship-aware planning, execution preview, workflow recommendations, business semantics, KPI intelligence, question intelligence, analytics intent graph, analytics planning, execution contracts, advanced metadata, and analyst/human modes.

Charter classification:

- Primary owner: Workspace.
- Background infrastructure: planning, execution contracts, engine compatibility, relationship planning.
- Intelligence: recommendations, semantic meaning, KPI opportunities, business questions.

Current problem:

- Data becomes a task configuration and workflow preparation surface.
- Data exposes preview-only and metadata-heavy advisory systems.
- It violates "Data is dataset understanding only."

Recommended Slice 1 action:

- TEMPORARY BRIDGE for entry path only.
- Do not mount `TaskLauncherPanel` inside Data as an inline focused panel after Slice 1.
- Keep selected task state and task functionality preserved for Workspace/Slice 2.
- Replace Data entry with a lightweight "Explore opportunities in Workspace" bridge if routing exists, or keep the current handler behind a minimized bridge only until Workspace absorbs it.

### Human Mode Guidance / Actions

Current use:

- `humanGuidanceCards` define intents like summarize, missing values, top categories, compare fields, trends, unusual values, visualize data.
- `humanGuidance` focused workflow renders these as buttons calling `onHumanIntentSelect`.
- `App.tsx` wires `onHumanIntentSelect` to `selectHumanIntent`, which can route/shape downstream behavior.

Charter classification:

- Workspace-owned when it shapes analysis.
- Data-owned only for dataset quality hints such as missing values, if presented as understanding.
- Dashboard-owned for "Visualize data."

Current problem:

- Data behaves like a Human Mode operational hub.
- Buttons imply analysis actions rather than dataset understanding.

Recommended Slice 1 action:

- TEMPORARY BRIDGE or MOVE TO WORKSPACE LATER.
- Preserve `onHumanIntentSelect` prop and handler.
- Remove/avoid primary Data rendering of `humanGuidance`.
- If retained temporarily, collapse behind one bridge labeled "Continue in Workspace" rather than showing individual action buttons.

### Operational Investigation Strips

Current use:

- `investigation-stage-strip`: Understand, Prioritize, Investigate, Next action.
- `ActionRail` labeled "Investigate".
- `PrimaryFocusBlock` recommends first operational move.
- `ContextRail` explains why an evidence signal matters and opens operational workspaces.

Charter classification:

- Workspace-owned for investigation flow.
- Data-owned only for understanding signals.

Current problem:

- Data becomes a journey manager rather than an understanding checkpoint.
- It duplicates Workspace's future operational core.

Recommended Slice 1 action:

- COLLAPSE / REMOVE from primary Data.
- Keep "Understand" as the only stage language.
- Convert "Prioritize/Investigate/Next action" into one quiet bridge: "Possible next step."
- Remove "Choose the next operational move" as a primary visible rail.

### Business Question Mapping

Current use:

- `useBusinessQuestions` generates interpreted questions.
- `smartBusinessQuestions` renders in an inline disclosure.
- `businessQuestions` focused workflow renders question intent mapping cards.

Charter classification:

- Workspace owns business question framing.
- Intelligence may summarize answered questions later.
- Data may suggest "might be worth investigating" in lightweight language.

Current problem:

- Data currently maps and presents business questions as if it owns question shaping.

Recommended Slice 1 action:

- TEMPORARY BRIDGE.
- Keep at most 2-3 suggested question labels as navigation guidance.
- Remove or move intent mapping cards from Data primary/focused detail.
- Preserve `useBusinessQuestions` only if needed for lightweight opportunity labels; do not expose intent categories/confidence in Data.

### Semantic / Investigation Workflows

Current use:

- `dataIntelligence`: shows dataset shape, metrics, segments, timeline fields, trend/comparison potential.
- `suggestedAnalysisPaths`: shows recommendations and possible future result shapes.
- `businessSemantics`: shows detected business context and possible KPIs.
- `kpiIntelligence`: shows KPI opportunities and possible chart types.
- `businessQuestions`: shows question intent mapping.

Charter classification:

- `dataIntelligence`: Data-owned if reframed as dataset understanding.
- `businessSemantics`: Data-owned only when it explains field/entity meaning.
- `suggestedAnalysisPaths`: Workspace or Intelligence, depending on whether it starts work or recommends meaning.
- `kpiIntelligence`: Dashboard/Intelligence if it presents KPI opportunities; Data only if it lists metric candidates.
- `businessQuestions`: Workspace.

Current problem:

- Data has too many focused workflows. Users can end up inside a mini Intelligence/Workspace system without leaving Data.

Recommended Slice 1 action:

- KEEP `dataIntelligence` but simplify toward profile understanding.
- MOVE TO DISCLOSURE or TEMPORARY BRIDGE for `businessSemantics`.
- MOVE TO WORKSPACE LATER for `suggestedAnalysisPaths` and `businessQuestions`.
- MOVE TO DASHBOARDS/INTELLIGENCE LATER for `kpiIntelligence`; Data may keep metric candidates only.

### Operational Workspaces

Current use:

- Local `activeOperationalWorkspace` supports:
  - Connected Sources Workspace
  - Entity Workspace
  - KPI Workspace
  - Trend Workspace
- Rendered through `FocusedWorkspaceShell`, `InvestigationThread`, `ContextRail`.
- Routes are labels like `/workspace/connections`, not global route changes.

Charter classification:

- Connected Sources: Data-owned if used for source understanding.
- Entity: Data-owned if used for entity detection; Workspace-owned if used for segmentation/comparison investigation.
- KPI: Data-owned only as metric candidate review; Dashboard/Intelligence if KPI opportunity/presentation.
- Trend: Data-owned only as timeline readiness; Workspace-owned if trend investigation.

Current problem:

- These feel like deep operational investigation workspaces inside Data.
- They use route-like labels and "Continue investigation," which implies Data owns the investigation journey.

Recommended Slice 1 action:

- KEEP connected sources as a Data detail/disclosure.
- MOVE Entity/KPI/Trend operational workspaces to TEMPORARY BRIDGE or disclosure; do not present as full workspaces.
- Remove route-like labels from Data-owned detail surfaces.
- Preserve click handlers in place if needed, but redirect language toward "Review detail" rather than "Open workspace."

### Metadata-Heavy Panels

Current use:

- `MetadataFooter` shows rows, columns, sources, field mix.
- `data-intelligence-grid` shows shape, possible metrics, possible segments, timeline fields, trend potential, comparison potential.
- `WorkbookRelationshipSummaryPanel` shows operational links, business areas, suggested start, roles, confidence.
- `DatasetIntelligenceDetailPage` presents dataset intelligence facts.
- TaskLauncher advanced metadata exposes planning and execution preview.

Charter classification:

- Data-owned: rows, columns, field types, missing/quality, worksheet/source facts.
- Background only: engine, planning, readiness, execution preview, runtime governance, advisory metadata.

Current problem:

- Some metadata is legitimate but visually over-prominent or repeated.
- Background metadata appears as product content.

Recommended Slice 1 action:

- KEEP compact Data-owned facts.
- MOVE TO DISCLOSURE detailed metadata.
- BACKGROUND ONLY for planning/readiness/engine/execution preview in Data.
- Remove or collapse repeated confidence/status labels unless they change a user decision.

### Repeated Guidance Systems

Current use:

- Data page header guidance.
- Investigation stage strip.
- Primary focus block.
- Evidence rows.
- Action rail.
- Context rail.
- Related opportunities.
- Follow-up questions.
- Workflow menus.
- Focused workflows.
- Command launcher data commands.

Charter classification:

- Data owns one understanding narrative and lightweight next-step bridge.
- Workspace owns question/action progression.
- Intelligence owns recommendations and meaning.

Current problem:

- Too many surfaces tell the user what to do next.
- Repetition makes the page feel like an operational hub rather than a checkpoint.

Recommended Slice 1 action:

- KEEP one primary understanding narrative.
- KEEP one compact "possible next step" bridge.
- REMOVE/COLLAPSE the rest from primary view.
- Preserve command launcher commands by mapping them to the remaining detail/disclosure surfaces.

## Ownership Classification Table

| Component / Panel | Current Purpose | Charter Owner | Current Problem | Recommended Action |
| --- | --- | --- | --- | --- |
| `data-page-head` | Page title, last updated, refresh | Data | Mostly aligned; "choose what to investigate next" overreaches | KEEP with copy adjustment |
| `OperationalWorkspaceLayout` on Data overview | Two-column operational workspace | Data + Workspace | Makes Data feel like investigation center | COLLAPSE / simplify primary layout |
| `WorkspaceHeader` "Active case" | Dataset identity and worksheet | Data | Aligned, but can duplicate shell/context facts | KEEP if not duplicated elsewhere |
| `investigation-stage-strip` | Understand/Prioritize/Investigate/Next action | Workspace | Data should not own full investigation journey | REMOVE |
| `InvestigationThreadStage` Understand | Dataset purpose and signal chips | Data | Aligned if only understanding | KEEP |
| `PrimaryFocusBlock` primary next step | Recommends investigation action | Workspace | Data becomes action hub | TEMPORARY BRIDGE |
| `EvidenceRows` business signals | Metric/date/entity/source clues | Data | Aligned if framed as dataset signals | KEEP |
| `ActionRail` "Investigate" | Operational next moves | Workspace | Too much workflow behavior in Data | COLLAPSE to single bridge or REMOVE |
| `InlineDisclosure` follow-up questions | Business questions | Workspace | Question shaping belongs in Workspace | TEMPORARY BRIDGE |
| `MetadataFooter` rows/columns/sources/field mix | Dataset facts | Data | Legitimate but should be quiet | KEEP compact |
| `ContextRail` evidence explanation | Signal context and workspace opening | Data + Workspace | Duplicates guidance; opens operational workspaces | COLLAPSE / MOVE TO DISCLOSURE |
| `Related opportunities` rail section | Recommendations/questions/KPIs | Intelligence/Workspace | Data repeats Intelligence/Workspace | REMOVE from primary Data |
| `Connected source detail` disclosure | Workbook relationships | Data | Aligned if about source understanding | KEEP / MOVE TO DISCLOSURE |
| `WorkspaceTabs` Overview/Fields/Sources | Data drill-ins | Data | Aligned | KEEP |
| `Explore` menu | Opens data intelligence, suggested paths, tasks | Workspace/Intelligence | Workflow launcher behavior | TEMPORARY BRIDGE |
| `Questions` menu | Opens semantics, KPIs, questions, guidance | Workspace/Intelligence/Dashboard | Data becomes intelligence hub | TEMPORARY BRIDGE |
| Preview dataset button | Opens sample data preview | Data | Aligned | KEEP |
| Delete dataset button | Dataset management | Home/Data boundary | Existing management behavior | KEEP |
| `DatasetPreviewPage` | Focused preview table | Data | Aligned | KEEP |
| `Detected columns` drill-in | Column profile | Data | Aligned | KEEP |
| `WorksheetSelector` | Source switching | Data | Aligned; preserve switching | KEEP |
| `dataIntelligence` focused workflow | Dataset understanding grid | Data | Mostly aligned, but engine/dialect label leaks | KEEP with disclosure cleanup |
| `suggestedAnalysisPaths` focused workflow | Investigation recommendations | Workspace/Intelligence | Data owns recommendations | MOVE TO WORKSPACE LATER |
| `businessSemantics` focused workflow | Business context/entities | Data/Intelligence | Fine for entity meaning, too broad for Intelligence | MOVE TO DISCLOSURE |
| `kpiIntelligence` focused workflow | KPI opportunities/chart types | Dashboards/Intelligence | Data owns KPI presentation ideas | MOVE TO DISCLOSURE / MOVE LATER |
| `businessQuestions` focused workflow | Question intent mapping | Workspace | Data owns question shaping | MOVE TO WORKSPACE LATER |
| `guidedAnalyticsTasks` focused workflow | Task launcher/configuration | Workspace | Data becomes workflow/task config surface | MOVE TO WORKSPACE LATER |
| `TaskLauncherPanel` | Full guided task prep | Workspace | Too much planning/readiness/metadata inside Data | TEMPORARY BRIDGE, then remove from Data |
| `humanGuidance` focused workflow | Human intent actions | Workspace | Data becomes Human Mode operational hub | TEMPORARY BRIDGE |
| `DatasetIntelligenceDetailPage` | Dataset profile detail route | Data + Background | Safe if profile detail; avoid runtime jargon | KEEP with advanced metadata discipline |
| `DatasetSessionPanel` export | Context panel with filters/grouping | Workspace/Results + Data | If used near Results, okay; not Data primary | BACKGROUND ONLY for Slice 1 |
| `WorkbookRelationshipSummaryPanel` | Relationships and confidence | Data | Aligned, but too visually large if always visible | MOVE TO DISCLOSURE |
| `filtraqueri:data-workspace-command` listener | Command launcher bridge | Composition | Needed for existing commands | KEEP handlers, map to safe surfaces |

## Safe Incremental Slice 1 Plan

### Exact Low-Risk Removals

1. Remove `investigation-stage-strip` from the Data overview.
   - Reason: Data should not own the full investigation journey.
   - Preserve: all state and handlers.

2. Remove "Related opportunities" from the Data context rail primary view.
   - Reason: recommendations/questions/KPI labels belong to Workspace or Intelligence.
   - Preserve: `recommendations`, `kpiOpportunities`, and `interpretedQuestions` data generation if still needed for temporary bridge labels.

3. Remove primary "Explore" and "Questions" dropdown menu prominence.
   - Reason: these make Data feel like a feature launcher.
   - Safe approach: convert to one quiet "Continue in Workspace" / "Explore opportunities" bridge until Workspace absorbs these entries.

4. Remove route-like labels such as `/workspace/connections` from Data-owned local details.
   - Reason: Data detail surfaces should not imply global workspace routing.
   - Preserve: focused shell/back behavior.

### Exact Collapses

1. Collapse `ContextRail` on the Data overview into a single inline disclosure or remove it from the main overview.
   - Keep selected signal detail only if it helps understand the dataset.
   - Do not show repeated "Open workspace" actions as primary.

2. Collapse `businessSemantics`, `kpiIntelligence`, and `businessQuestions` from independent focused workflows into either:
   - a single "Dataset meaning details" disclosure, or
   - temporary bridge links for Slice 2.

3. Collapse `WorkbookRelationshipSummaryPanel` behind "Connected source detail."
   - Keep workbook relationship understanding available.
   - Avoid a large relationship dashboard in the primary Data overview.

4. Collapse `DatasetIntelligenceDetailPage` triggers behind profile/detail language.
   - Keep the route/back mechanism.
   - Avoid surfacing runtime bridge or engine language.

### Exact Disclosure Conversions

1. Convert detailed semantic entities into "Detected business meaning" disclosure.
   - Show entity labels and short descriptions only.
   - Hide confidence metadata unless it changes trust or user choice.

2. Convert possible KPI fields into "Possible measures" disclosure.
   - Data can own metric candidates.
   - Remove chart type and dashboard wording from Data.

3. Convert suggested business questions into "Possible questions to take to Workspace" disclosure or bridge.
   - Keep questions as lightweight examples.
   - Remove intent mapping, confidence, and detected category in Data.

4. Convert relationship confidence details into disclosure.
   - Keep business-language relationship statements.
   - Hide join/lineage/confidence depth unless the user opens details.

### Exact Temporary Bridges

1. Explore Opportunities Bridge
   - Purpose: Give users a safe continuation path without keeping the full workflow launcher in Data.
   - Text direction: "This data may support a few investigations. Continue in Workspace to shape the question."
   - Allowed actions:
     - navigate to existing Workspace/Investigate tab if available through current view routing
     - temporarily open `guidedAnalyticsTasks` only if no Workspace route exists yet
   - Forbidden:
     - inline task configuration
     - readiness metadata
     - execution preview
     - multiple dropdown menus

2. Task-Launch Entry Path Bridge
   - Purpose: Preserve task functionality while removing TaskLauncherPanel from Data primary flow.
   - Keep:
     - `selectedTaskId`
     - `onSelectedTaskIdChange`
     - task definitions
     - task launcher module untouched
   - Change later:
     - mount TaskLauncherPanel from Workspace, not Data.
   - Slice 1 fallback:
     - one bridge button can still open current guided task detail if removing it would orphan functionality.
     - The button must be visually secondary and explicitly transitional.

3. Investigation Redirect Bridge
   - Purpose: Existing Data opportunities can point toward Workspace later.
   - Keep:
     - `openFocusedWorkflow` only where needed to avoid broken commands.
     - command launcher targets.
   - Target:
     - "Continue in Workspace" instead of "Open workspace" inside Data.

### Exact Preserved Click Handlers / Routes

Preserve these without changing side effects:

- `onOpenDataset`
- `onDeleteDataset`
- `onWorksheetSelect`
- `onHumanIntentSelect`
- `onSelectedTaskIdChange`
- `setIsDatasetPreviewOpen`
- `closeDatasetIntelligenceDetail`
- controlled hash route `detail:dataset-intelligence`
- `filtraqueri:data-workspace-command` listener
- command targets:
  - `preview`
  - `worksheetPreview`
  - `connections`
  - `intelligence`
  - `intelligenceDetail`
  - `semantics`

Safe mapping notes:

- `preview` and `worksheetPreview` should continue opening `DatasetPreviewPage`.
- `connections` should continue opening connected source detail, but with Data-detail language.
- `intelligenceDetail` should continue opening dataset profile detail.
- `intelligence` and `semantics` should map to Data-owned understanding details, not workflow recommendations or Intelligence-like surfaces.

## Transitional UX Rules

### Primary In Data After Slice 1

The Data tab primary surface should show:

- one short dataset-understanding headline
- one calm business-language summary of what the dataset appears to be about
- compact dataset facts: rows, columns, sources, field mix
- 2-4 key dataset signals: metric, timeline, entity, connected source, quality signal
- access to fields/columns
- access to sources/worksheets
- access to preview dataset
- one lightweight continuation bridge

### Secondary / Disclosed In Data After Slice 1

The following should be available, but not primary:

- detailed column profile
- worksheet/source list
- connected source details
- detected business meaning
- possible measures
- possible questions to take to Workspace
- dataset intelligence detail
- quality or missingness details if present

### Should Disappear Entirely From Data Primary View

- full investigation stage progression
- task launcher details
- task configuration forms
- execution preview
- analysis plan preview
- planning readiness
- engine compatibility
- workflow recommendation cards
- KPI chart/presentation suggestions
- question intent mapping
- repeated confidence labels
- route-like workspace labels
- "Human Mode" action grids
- multiple next-step guidance rails

### Behavioral Feel

Slice 1 Data should feel:

- calm
- checkpoint-like
- business-language-first
- easy to scan
- progressively disclosed
- supportive rather than directive
- focused on understanding, not action orchestration

Slice 1 Data should not feel:

- dashboard-heavy
- feature-grid oriented
- task-launcher-like
- admin-panel-like
- metadata-complete
- overconfident or execution-ready

## Temporary Transitional Bridges

### Explore Opportunities Bridge

Recommended behavior:

- one small bridge below the dataset signals
- title: "Ready to shape a question?"
- copy: "Use Workspace to turn these dataset signals into a business question."
- actions:
  - "Continue in Workspace" if routing exists
  - "View possible questions" as a temporary disclosed list

This bridge must not render `TaskLauncherPanel` inline.

### Task Launch Entry Paths

Until Workspace absorbs task launching:

- preserve `selectedTaskId` and runtime persistence wiring
- keep `TaskLauncherPanel` unmodified
- do not delete task definitions
- do not delete task launcher selectors/hooks
- avoid exposing task details directly inside Data
- if needed, keep a hidden or secondary fallback path through existing `guidedAnalyticsTasks` state

Target for Slice 2:

- Workspace mounts the task launcher or its successor.
- Data sends users there with context only.

### Investigation Redirects

Existing Data signals may recommend where to go next, but should not open deep operational workspaces as the main behavior.

Recommended transitional language:

- "Review source detail" for connected sources.
- "Use in Workspace" for question/action shaping.
- "Preview data" for sample inspection.
- "View field detail" for column profile.

Avoid:

- "Open workspace" inside Data except as a temporary bridge.
- "Continue investigation" inside Data detail surfaces.
- "Choose the next operational move" on Data overview.

## Risks And Dependency Notes

### Components Tightly Coupled To Workspace Concepts

- `TaskLauncherPanel`
  - Deeply coupled to guided inputs, planning readiness, task configuration, execution preview, workflow recommendations, semantic intelligence, KPI intelligence, business questions, analytics intent graph, analytics planning, and execution contracts.
  - Do not partially edit during Slice 1 unless necessary.
  - Best action is to remove/move its Data mounting, not rewrite it.

- `humanGuidance` focused workflow
  - Uses `onHumanIntentSelect`, which is wired in `App.tsx`.
  - Could affect routing/view updates.
  - Preserve handler; remove primary Data exposure first.

- `activeFocusedWorkflow`
  - Currently multiplexes Data-owned details and Workspace/Intelligence-owned details.
  - Removing all values at once risks command launcher and back behavior regressions.
  - Slice 1 should narrow visible entries before deleting state types.

- `activeOperationalWorkspace`
  - Local focused workspace system currently covers both Data-owned and Workspace-owned concepts.
  - Preserve `connections` first.
  - De-emphasize or hide `entities`, `kpis`, `trends` as full workspaces.

### Props / State Dependencies

- `selectedTaskId` and `onSelectedTaskIdChange` are passed from runtime persistence through `App.tsx`.
- `onHumanIntentSelect` is passed from `App.tsx` and may change view state.
- `onWorksheetSelect` must remain intact for workbook switching.
- `isSwitchingWorksheet` must continue to disable worksheet switching correctly.
- `isDatasetPreviewOpen` and `isDatasetIntelligenceDetailOpen` preserve focused detail behavior.
- `selectedEvidenceTitle` only matters if the evidence/context rail remains interactive.

### Routing Dependencies

- `DatasetIntelligenceDetailPage` uses controlled hash route `detail:dataset-intelligence`.
- Command launcher dispatches `filtraqueri:data-workspace-command`.
- App commands target `preview`, `worksheetPreview`, `intelligenceDetail`, `semantics`, and `connections`.
- Do not remove event listener targets until command launcher is updated in a later slice.

### Risks Of Premature Removal

- Removing `TaskLauncherPanel` mounting without a Workspace replacement may orphan guided task access.
- Removing `onHumanIntentSelect` exposure without checking command paths may hide existing Human Mode actions.
- Removing `activeFocusedWorkflow` values too early may break menu/back state assumptions.
- Removing `DatasetIntelligenceDetailPage` route may break command launcher "Data Intelligence" command.
- Removing workbook connection detail may regress multi-sheet workbook understanding.

### Safest Sequencing Order

1. Copy and language cleanup first.
2. Hide/remove primary visual prominence second.
3. Convert heavy surfaces to disclosure third.
4. Preserve handlers and state values during the first implementation.
5. Only delete unused state/types/imports after build confirms they are not referenced.
6. Move true Workspace surfaces in Slice 2, not Slice 1.

## Recommended Exact Execution Order

### Step 1: Establish Data Primary Ownership

Edit `DatasetSummaryPanel.tsx` overview copy:

- Page description becomes dataset-understanding-only.
- Replace "choose what to investigate next" with "understand what this data contains and where it may be useful."
- Rename operational labels from investigation/action language to understanding/detail language.

Expected risk: low.

### Step 2: Remove Full Journey Language From Data

Remove or hide:

- `investigation-stage-strip`
- "Prioritize"
- "Investigate"
- "Next action"
- "Choose the next operational move"

Expected risk: low.

### Step 3: Reduce Primary Action Rail

Replace the multi-button `ActionRail` with one quiet bridge or move it below disclosure:

- keep at most one "Continue in Workspace" bridge
- keep "Preview dataset" and field/source details separate

Expected risk: low to medium because existing `openOperationalWorkspace` calls may become unused.

### Step 4: Collapse Context Rail

Move selected evidence explanation and related opportunities out of the always-visible rail:

- keep connected source details in disclosure
- remove related opportunity buttons from primary rail
- avoid "Open workspace" as primary Data action

Expected risk: medium because `selectedEvidenceTitle` and `selectedEvidenceWorkspace` may become unused.

### Step 5: Normalize Focused Data Details

Keep:

- `DatasetPreviewPage`
- `Detected columns`
- `Available sources`
- `dataIntelligence` as dataset understanding
- connected source detail

De-emphasize:

- `businessSemantics` as a disclosure under dataset meaning
- KPI as possible measures only

Expected risk: medium because `activeFocusedWorkflow` has mixed ownership.

### Step 6: Convert Workspace/Intelligence-Owned Data Menus Into Bridges

Replace `Explore` and `Questions` dropdowns with one low-prominence bridge.

Temporary bridge must preserve:

- `guidedAnalyticsTasks` access if no Workspace replacement exists yet
- `businessQuestions` access if no Workspace replacement exists yet
- existing `selectedTaskId` persistence

Expected risk: medium.

### Step 7: Keep Command Launcher Compatibility

Ensure `filtraqueri:data-workspace-command` still handles:

- `preview`
- `worksheetPreview`
- `connections`
- `intelligence`
- `intelligenceDetail`
- `semantics`

Map these to surviving Data-owned or transitional surfaces.

Expected risk: medium if command labels imply removed surfaces.

### Step 8: Build And Governance Check

Run:

```sh
npm.cmd run build
```

Recommended if touched surfaces include advisory/metadata imports:

```sh
npm.cmd run governance:audit
```

Expected risk: low. Existing governance warning may remain unrelated.

## Safest First Edits

The safest first code edits for Slice 1 are:

1. Copy changes in `data-page-head`, stage labels, action labels, and focused workspace summaries.
2. Remove `investigation-stage-strip`.
3. Remove `Related opportunities` from the main Data context rail.
4. Change `ActionRail` from multiple operational moves to one transitional bridge.
5. Keep all state, handlers, imports, and focused workflow branches until after build.

These edits reduce Data's investigation-center feeling without risking task, route, command, or execution behavior.

## Minimal-Risk Slice 1 Transition Strategy

Slice 1 should not delete systems. It should change exposure.

Recommended strategy:

1. Keep the underlying intelligence hooks because they are deterministic and already wired.
2. Stop presenting their outputs as Data-owned workflows.
3. Keep Data-owned understanding primary.
4. Move Workspace-owned behavior behind one temporary bridge.
5. Collapse Intelligence/Dashboard-like detail behind disclosure.
6. Preserve every existing callback and route during the first pass.
7. Remove unused code only after the UI boundary is stable and build output proves it is unused.

## Final Slice 1 Definition Of Done

Slice 1 is complete only if:

- Data is dataset-understanding-first.
- The primary Data tab answers only what the data is about and what may be worth investigating.
- Operational workflow behavior is reduced.
- Metadata exhibition is reduced.
- Business investigation shifts away from Data toward Workspace.
- Task launch functionality is not orphaned.
- Command launcher Data commands still work.
- Dataset preview still works.
- Worksheet switching still works.
- Dataset intelligence detail/back behavior still works.
- No backend logic changes.
- No SQL execution changes.
- No ActiveResultModel changes.
- No ResultsGrid, pagination, or export behavior changes.
- No runtime persistence changes.
- No advisory module gains execution power.
- No new global navigation or Workspace redesign is introduced.

## Slice 1 Non-Goals

- Do not redesign the entire app.
- Do not implement Workspace redesign.
- Do not create new visual systems.
- Do not add charts.
- Do not add generated SQL/Python/R behavior.
- Do not remove task definitions.
- Do not rewrite TaskLauncherPanel.
- Do not rewrite App routing.
- Do not change Human/Analyst switching logic.
- Do not change runtime bridge architecture.
- Do not turn advisory metadata into execution.

## Final Recommendation

Proceed with Slice 1 as an exposure and ownership correction pass, not a feature removal pass.

The first implementation should make Data calmer by narrowing the visible surface to dataset understanding, moving operational workflow concepts into a temporary bridge, and keeping all existing logic intact underneath until Workspace can absorb the appropriate responsibilities in Slice 2.
