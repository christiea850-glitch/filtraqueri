# FiltraQueri Workspace Layout Specification

## Status

This document is the canonical workspace layout specification for FiltraQueri after UX-F13 and UX-F14. It is the single source of truth for future UX implementation phases that affect shell layout, panel behavior, typography, spacing, chips, tables, and runtime surfaces.

This is not a redesign proposal. It is a stabilization and enforcement specification for the existing enterprise analytics workspace direction.

## Product Intent

FiltraQueri is an enterprise analytics workspace. It should feel calm, guided, inspectable, and investigation-oriented. The interface should help users understand what data is active, what task is in progress, what result is being reviewed, and what the safest next action is.

The workspace must not feel like a crowded admin dashboard, a metadata catalog, or a stack of unrelated panels.

## Non-Negotiable Preservation

Layout work must not change:

- routing or back behavior
- Query Builder execution
- `executeWorkspaceQuery`
- Query Builder request shapes
- `ActiveResultModel`
- `ResultsGrid`
- Monaco behavior
- SQL draft restore
- upload/session restore
- workbook switching
- Human/Analyst switching logic
- continuation wrappers
- runtime persistence
- backend behavior

All intelligence, guidance, narrative, recommendation, and runtime surfaces remain metadata-only unless a future execution phase explicitly changes that contract.

## Canonical Workspace Structure

The workspace has four stable zones:

1. Top bar
2. Left sidebar
3. Main canvas
4. Right investigation rail

The main canvas owns the work. The sidebar navigates. The rail guides. The top bar provides global identity and controls.

### Desktop Layout

Canonical desktop shell:

```text
+---------------------------------------------------------------------+
| Top bar: workspace switcher | Human/Analyst toggle | settings       |
+--------------+--------------------------------------+---------------+
| Left sidebar | Main canvas                          | Investigation |
| navigation   | page title                           | rail          |
| only         | context strip                        | trail         |
|              | active workflow/content              | next step     |
|              | supporting details                   | metadata      |
+--------------+--------------------------------------+---------------+
```

### Width Rules

- Left sidebar expanded width: `200-224px`.
- Left sidebar collapsed width: `56-72px`.
- Right rail expanded width: `260-300px`.
- Right rail collapsed width: `40-48px`.
- Main canvas minimum usable width on desktop: `720px`.
- Main canvas should receive all remaining horizontal space.
- Main canvas should not be centered in a narrow column on large screens.
- Any layout below `1080px` must prioritize the main canvas over the right rail.
- Any layout below `900px` should collapse or stack the right rail before compressing the main workflow.

### Responsive Collapse Order

1. Collapse right investigation rail.
2. Collapse left sidebar labels.
3. Convert context strip to two columns.
4. Convert context strip to one column.
5. Stack page-specific grids.
6. Only then reduce table/control density.

The main task should remain readable longer than supporting navigation or metadata.

## Top Bar Specification

The top bar owns global workspace identity and controls.

Allowed:

- workspace switcher
- dataset/workbook switcher entry
- Human/Analyst toggle
- settings access
- compact global status if essential

Forbidden:

- page summaries
- investigation narration
- result summaries
- dataset row/column stats
- duplicate open-data prompts
- floating active-workspace cards

### Workspace Switcher Behavior

- The workspace switcher is the primary identity control.
- It should be compact and stable across routes.
- It may show a short dataset/workbook label.
- It must not expand into a second context strip.
- It must not repeat row counts, column counts, current focus, or investigation trail state.

## Left Sidebar Specification

The sidebar answers: "Where can I go?"

Allowed:

- navigation groups
- active nav state
- compact section labels
- collapsed icon state
- Advanced/System navigation

Forbidden:

- dataset metadata
- row/column counts
- worksheet summaries
- open-data cards when a dataset is loaded
- repeated lower-sidebar workspace cards
- duplicate "Guided Workspace" or "Active workspace" boxes
- investigation trail summaries
- runtime status summaries

### Sidebar Composition

Canonical groups:

- Workspace
- Analytics
- Advanced
- System

Each item should have:

- one icon or compact indicator
- one label
- one active state

Do not add descriptive paragraphs under nav items. Sidebar labels navigate; they do not explain the product.

## Main Canvas Specification

The main canvas answers: "What am I doing now?"

Required order:

1. Page title
2. Context strip
3. Active page workflow/content
4. Supporting page-specific details
5. Collapsed technical metadata if needed

Forbidden:

- giant hero typography
- marketing-style hero sections
- repeated mode headlines such as "Result review in Human Mode"
- duplicate dataset summaries already present in the context strip
- stacked metadata cards before the active workflow
- floating "Guided Workspace / Active workspace" boxes

### Page Title Rules

- One page title per page.
- Page title size: `20-24px` desktop.
- Page title weight: `600`.
- Page title should describe the task, not the mode.
- Mode is a compact state, not a headline.

Examples:

- Good: `Results`
- Good: `Build query`
- Good: `Data profile`
- Bad: `Result review in Human Mode`
- Bad: `Guided Workspace Active Investigation Runtime`

## Context Strip Specification

The context strip is the single visible home for workspace facts.

It owns:

- dataset name
- worksheet/workbook
- row/column count
- current focus

It should generally not include:

- a separate `Mode` field when the global Human/Analyst toggle is already visible
- runtime slot IDs
- adapter names
- execution contract status
- long text summaries
- repeated result metadata

### Context Strip Width Rules

- Use responsive grid columns with `minmax(0, 1fr)`.
- Each item must have `min-width: 0`.
- Long values must truncate with tooltip/title support or wrap to two lines.
- Chips inside the strip must not exceed their grid cell.
- The strip should wrap to two rows before overflowing horizontally.
- The strip must never clip stat chips.

### Context Strip Field Rules

Canonical fields:

```text
Dataset | Worksheet | Size | Focus
```

Optional fields:

- Result when the page is Results and the result identity is not otherwise clear.
- SQL dialect in Analyst only when inspecting SQL.

Avoid a persistent `Mode` field. Mode already lives in the top bar toggle and may appear as a small page-state accent only when contextually useful.

## Right Investigation Rail Specification

The rail answers: "What is the safest next move?"

Allowed:

- current step
- investigation trail
- suggested next action
- continuation action
- collapsed metadata disclosure

Forbidden:

- dataset summaries
- workbook summaries
- result summaries already shown in Results
- full narrative blocks repeated from the main canvas
- all runtime metadata expanded by default
- execution controls
- Query Builder controls
- SQL editor controls
- engine registry details
- implementation terms in Human Mode

### Rail Governance

The rail must not become a junk drawer. Every rail item must pass one of these tests:

- Does it help the user return to a prior step?
- Does it identify the current investigation step?
- Does it suggest one safe next action?
- Is it optional metadata hidden behind disclosure?

If the answer is no, the item belongs elsewhere or should be removed.

### Rail Density

- Maximum always-visible sections: 3.
- Recommended visible sections:
  - Current step
  - Suggested next action
  - Trail
- Technical metadata must be collapsed by default.
- Section padding: `8-12px`.
- Rail labels: `11-12px`, weight `500`.
- Rail titles: `13-15px`, weight `600`.

## Human vs Analyst Density Rules

### Human Mode

Human Mode should feel:

- business-oriented
- guided
- calm
- low-density
- low-SQL-anxiety

Human Mode should show:

- business question framing
- plain-language next steps
- result takeaway
- continuation options
- simple data/profile concepts

Human Mode should hide or collapse:

- adapter names
- runtime slots
- execution contracts
- engine registry language
- orchestration metadata
- SQL dialect details unless explicitly relevant
- IDs and internal references

### Analyst Mode

Analyst Mode should feel:

- technical
- inspectable
- controlled
- operational
- slightly denser than Human Mode

Analyst Mode may show:

- SQL dialect
- query structure
- draft state
- validation warnings
- execution readiness
- result model inspection
- collapsed runtime metadata

Analyst Mode must not:

- imply autonomous execution
- generate SQL automatically
- execute SQL from Monaco without explicit existing controls
- expose raw implementation scaffolding as primary content

## Engine Language Rules

Engine language means internal or implementation-facing concepts that should not dominate the UI.

Examples:

- runtime slot
- metadata pending
- execution contract
- adapter
- orchestration
- registry
- MIR
- planner
- governance ledger
- replay
- optimization engine
- execution intelligence

Human Mode replacement language:

- `Details`
- `Run boundary`
- `SQL context`
- `Suggested next step`
- `Planning context`
- `Review before running`
- `Metadata only`

Analyst Mode may use some technical terms, but only inside technical panels or collapsed disclosures.

## Typography Specification

Canonical type hierarchy:

| Role | Size | Weight | Notes |
| --- | ---: | ---: | --- |
| Page title | `20-24px` | `600` | One per page |
| Section title | `16-18px` | `600` | No oversized cards |
| Card title | `13-15px` | `600` | Short and scannable |
| Body | `13-14px` | `400` | Default reading text |
| Caption | `12-13px` | `400-500` | Supporting copy |
| Metadata label | `11-12px` | `500` | Muted gray |
| Brand/logo | variable | `800` max | Only approved heavy weight |

Forbidden:

- `700/800/900` weights outside brand/logo unless explicitly approved.
- giant page heroes.
- uppercase labels on every card.
- negative letter spacing.
- viewport-scaled body type.

## Color Specification

Canonical colors:

- App canvas: neutral gray
- Panels: white
- Inset surfaces: very light neutral
- Borders: neutral gray
- Primary text: dark neutral
- Metadata: muted gray
- Blue: active nav, focused step, primary CTA, focus ring
- Green/yellow/red: semantic states only

Blue must not be used for:

- passive metadata
- decorative labels
- runtime narration
- section headers
- non-action chips

## Surface And Border Rules

Allowed surfaces:

- flat white panel
- light neutral inset
- single-border disclosure
- table container
- active state with restrained blue border

Forbidden:

- panel inside card inside panel structures
- heavy shadow stacking
- gradient wash
- decorative colored panels
- hover lifts on static metadata
- multiple borders competing in one section

### Border Rules

- Default border: `1px solid neutral`.
- Active state border may use blue.
- Error/warning/success borders use semantic colors.
- Avoid left accent borders except focused insight or semantic warning.

## Chip And Tag Specification

Chips are compact status or filter elements. They are not general layout containers.

Allowed chip use:

- active filters
- selected fields
- result tabs
- semantic status
- compact count badges
- selected workflow step

Forbidden chip use:

- long dataset names
- long worksheet names
- paragraph text
- stat blocks with multiple values
- passive metadata everywhere
- clipped row/column stats

### Chip Behavior

- Chips must have `max-width: 100%`.
- Long chip text must truncate or wrap intentionally.
- Chips in grids must use `min-width: 0`.
- Chips should not overlap adjacent content.
- Passive chips use neutral gray.
- Blue chips are reserved for selected/actionable state.

## Data Profile Rules

The Data page answers: "What data do I have?"

Use flat structures:

- dataset profile summary
- worksheet table/list
- detected columns table/list
- relationship review disclosure

Avoid:

- profile cards competing with each other
- repeated dataset name and counts
- chip walls for columns when a table is clearer
- oversized KPI cards for basic profile facts

### Data Profile Table Structure

Detected columns should prefer table/list presentation:

```text
Column name | Type | Completeness | Role | Notes
```

Column lists must support overflow and scanning. They must not become clipped chip clouds.

## Results Table Specification

Results owns review and inspection of active result output.

Hierarchy:

1. Business takeaway
2. Active table/chart
3. Secondary insights
4. Continuation/export controls
5. Collapsed technical metadata

### Results Table Rules

- The grid/table is the dominant element on Results.
- Header cells must preserve column identity.
- Column names must not be parsed into unreadable fragments.
- Column headers may show a small column letter/index only if it does not compete with the name.
- Header text should truncate with tooltip/title support or wrap cleanly to two lines.
- Sorting affordances must not obscure column names.
- Row number column should remain compact.
- Horizontal scrolling is acceptable for wide data.
- Do not shrink columns so far that headers become meaningless.

### Results Metadata Rules

Allowed above the table:

- active result type
- source type
- export readiness
- result-specific row/column count
- one takeaway

Forbidden above the table:

- repeated dataset/workbook facts
- repeated context strip facts
- full runtime trail
- engine/adaptor details
- multiple stacked insight cards before the grid

## Query Builder Rules

Build answers: "How do I safely construct this query?"

Canonical sequence:

1. Measure / aggregation
2. Group by
3. Filter
4. Sort / limit
5. Review before run

Rules:

- Nothing runs until the user approves.
- Run Query must be visually intentional.
- The approval summary should be compact.
- Query Builder should not repeat dataset identity if the context strip owns it.
- Advanced controls should be disclosed progressively.
- Blue should mark primary Run Query and active step only.

## Spacing Rhythm

Use a consistent spacing scale:

- `4px`: micro gaps
- `8px`: compact internal spacing
- `12px`: rail/cards/controls
- `16px`: standard section gaps
- `20px`: page subsection gap
- `24px`: major page gap

Rules:

- Related controls stay close.
- Sections need enough whitespace to scan.
- Rail spacing is tighter than main canvas spacing.
- Main canvas spacing should breathe without becoming a marketing page.
- Do not use large hero padding for operational screens.

## Responsive Behavior

### Large Desktop

- Main canvas should be wide and dominant.
- Right rail should not exceed `300px`.
- Use horizontal layouts for workflow summaries when space exists.
- Avoid narrow centered content columns.

### Medium Desktop / Tablet

- Collapse rail first.
- Sidebar may collapse labels.
- Context strip becomes two columns.
- Query and Results support horizontal scroll where needed.

### Mobile

- Single-column layout.
- Sidebar becomes top/compact navigation or collapsed affordance.
- Rail is collapsed by default.
- Context strip is one column.
- Tables scroll horizontally.
- No content should overlap or clip.

## Current Anti-Patterns To Remove

These patterns are currently known risks in FiltraQueri and should be prioritized for cleanup:

1. Overlapping or clipped stat chips.
2. Giant Home hero typography.
3. Duplicate lower-sidebar workspace blocks.
4. Floating `Guided Workspace / Active workspace` box.
5. Investigation rail used as a catch-all metadata drawer.
6. Context strip overflow and unnecessary persistent `Mode` field.
7. Data profile cards where a flat table/list would scan better.
8. Results table headers split or parsed in ways that reduce readability.
9. Center workspace squeezed by right rail on medium widths.
10. Passive metadata styled as blue action UI.
11. Engine language exposed as primary Human Mode copy.
12. Nested card structures that make all information look equally important.

## Forbidden UI Patterns

Do not introduce:

- giant operational heroes
- gradient backgrounds or gradient-wash panels
- decorative orbs/blobs
- stacked metadata panels
- card-in-card-in-card layouts
- repeated dataset summaries across shell zones
- blue passive metadata chips
- long text inside chips
- runtime jargon as Human Mode headings
- hidden execution behavior
- autonomous navigation
- automatic SQL generation
- rail panels that duplicate page content

## Migration Priorities

### Priority 1: Stop Clipping And Duplication

- Fix stat chip overlap.
- Remove duplicate sidebar workspace blocks.
- Remove floating active workspace boxes.
- Remove persistent context strip `Mode` if the toggle is visible.
- Ensure context strip wraps safely.

### Priority 2: Restore Main Canvas Dominance

- Collapse rail earlier on medium widths.
- Keep main canvas minimum usable width.
- Reduce Home hero typography.
- Move repeated metadata out of page bodies.

### Priority 3: Make Data And Results More Scannable

- Convert noisy data profile cards into flat table/list structures.
- Fix Results table header readability.
- Keep the Results grid dominant.
- Keep metadata supportive and collapsed where technical.

### Priority 4: Govern Runtime Surfaces

- Audit every rail section against the rail governance test.
- Collapse optional metadata by default.
- Replace Human Mode engine language with operational language.
- Keep Analyst technical language inspectable but controlled.

### Priority 5: Extract Durable Primitives

- Promote CSS primitives into shared React surface components only after layout rules are stable.
- Add visual regression screenshots for shell, Data, Build, Results, and Analyst.
- Add responsive QA breakpoints to implementation checklists.

## Implementation Order

Recommended order for future phases:

1. Shell cleanup: sidebar, context strip, rail collapse rules.
2. Home cleanup: remove giant hero and floating active workspace surfaces.
3. Data cleanup: replace chip/card profile density with flat table/list structures.
4. Results cleanup: table header readability and grid dominance.
5. Rail governance: remove duplicate rail content and collapse technical metadata.
6. Responsive pass: medium-width canvas/rail behavior.
7. Primitive extraction: shared `Surface`, `ContextStrip`, `RailSection`, `MetadataTable`, and `StatusChip`.
8. Visual regression pass.

## Example Canonical Page Layouts

### Home

```text
Page title: Home
Context strip
Continue where you left off
Recent investigations
Open data only if no dataset is loaded
```

### Data

```text
Page title: Data profile
Context strip
Dataset profile summary
Detected columns table
Worksheet list/table
Relationship review disclosure
```

### Build

```text
Page title: Build query
Context strip
Measure / aggregation
Group by
Filter
Sort / limit
Review before run
Run Query primary action
```

### Results

```text
Page title: Results
Context strip
Business takeaway
Results grid/table
Export and continuation actions
Collapsed technical result metadata
```

### Analyst

```text
Page title: Analyst
Context strip
SQL inspection overview
Schema/context panel
Monaco/editor surface
Preview/draft side panel
Collapsed technical metadata
```

## Governance Checklist

Before merging any UX phase, verify:

- Does every important fact have one visible home?
- Is the main canvas dominant?
- Is the sidebar navigation-only?
- Does the rail guide rather than summarize everything?
- Does the context strip wrap without clipping?
- Are chips short, neutral, and non-overlapping?
- Are headings within the canonical scale?
- Is blue limited to action, focus, active, or selected states?
- Are Human Mode surfaces free of engine jargon?
- Are Analyst Mode surfaces technical but controlled?
- Does the Results table remain readable at common widths?
- Does the layout degrade predictably at medium and mobile widths?
