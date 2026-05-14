# FiltraQueri Canonical Workspace UX Blueprint

## Purpose

This document defines the official FiltraQueri workspace UX architecture. It is the canonical reference for future UX-F implementation phases and translates the Claude-style architecture review into stable product rules.

The workspace should feel calm, investigation-first, enterprise-grade, and progressively guided. FiltraQueri should behave like an analytical operating system: the user always understands where they are, what data is active, what task they are doing, and what the safest next action is.

This blueprint is documentation only. It does not change execution behavior.

## Preservation Contract

Future implementation phases must not change:

- execution logic
- backend APIs
- Query Builder behavior or request shapes
- `executeWorkspaceQuery`
- `ActiveResultModel`
- `ResultsGrid`
- exports
- pagination
- Monaco behavior
- SQL draft restore
- routing and back behavior
- upload/session restore
- workbook switching
- Human/Analyst switching
- runtime persistence
- investigation trail metadata
- continuation wrappers

FiltraQueri intelligence surfaces remain metadata-only unless a later execution phase explicitly changes that contract.

## Global Architecture

FiltraQueri uses a stable three-zone workspace:

- Top bar: identity, global switching, and settings access.
- Left sidebar: navigation only.
- Main canvas: the active analytical task.
- Right investigation rail: trail, current step, next action, and optional metadata.

The main canvas is always dominant. The sidebar and rail support the work; they do not compete with it.

## 1. Top Bar

The top bar owns global workspace controls only.

It should contain:

- workspace identity
- dataset/workbook switcher
- Human/Analyst toggle
- settings access

It should not contain:

- repeated dataset summaries
- investigation narration
- active result summaries
- duplicated open-data prompts
- page-specific metadata

The top bar should stay compact and stable across the app.

## 2. Left Sidebar

The left sidebar is navigation only.

It should contain:

- primary navigation groups
- active section indication
- compact navigation affordances

It should not contain:

- dataset metadata
- worksheet metadata
- row or column counts
- duplicated open-data blocks
- repeated workspace cards
- investigation summaries
- result summaries

The sidebar answers one question: "Where can I go?"

## 3. Main Canvas

The main canvas owns the active page and the active analytical task.

Each page should contain:

- one page title
- one global context strip
- page-specific content only
- the main workflow or review surface

The main canvas should not repeat facts already owned by the context strip, top bar, sidebar, or right rail.

The main canvas answers one question: "What am I doing now?"

## 4. Context Strip

The context strip is the single visible source of truth for core workspace facts.

It owns:

- dataset name
- worksheet
- row and column count
- current mode
- current focus

Rules:

- One fact has one visible home.
- If the context strip owns a fact, page surfaces should not restate it.
- Page surfaces may show task-specific derivatives only when needed.
- The strip should stay compact and readable.
- The strip should appear consistently in the main canvas.

Examples:

- Dataset name belongs in the context strip, not the sidebar, Results header, and Query Builder hero.
- Mode belongs in the toggle and context strip, not as a giant page headline.
- Result-specific row counts may appear in Results because they describe the active result, not the dataset.

## 5. Right Investigation Rail

The right rail is guidance, not a second dashboard.

It owns:

- investigation trail
- current step
- suggested next action
- optional collapsed technical metadata

It should not contain:

- repeated dataset/workbook metadata
- repeated page summaries
- repeated narrative from the main canvas
- large panels of always-visible technical metadata
- execution controls
- SQL generation
- assistant/chat behavior

The rail answers one question: "What is the safest next move?"

## Screen Contracts

### Home

Home should help the user continue calmly.

It owns:

- continue where the user left off
- recent investigations
- open data entry point when no dataset exists

It should not become a marketing page, metadata dashboard, or duplicate of Data.

### Data

Data should profile the active dataset.

It owns:

- dataset profile
- detected columns
- worksheet selection
- relationship review entry points
- recent dataset management where appropriate

It should not duplicate the global context strip.

### Explore

Explore should guide business questions.

It owns:

- approachable question framing
- filter and exploration setup
- business-oriented next steps

It should reduce SQL anxiety and avoid technical-first language in Human Mode.

### Build

Build should be a compact Query Builder workflow.

It owns:

- field selection
- filters review
- grouping and comparison
- output review
- approve-before-run execution controls

It should not repeat dataset/workbook identity or generate SQL automatically.

### Results

Results should feel like an investigation review surface.

It owns:

- business takeaway first
- chart/table support
- active result review
- export readiness
- result-specific technical disclosure

The grid/table remains central. Metadata supports review; it does not dominate the page.

### Analyst

Analyst should be technical, inspectable, and controlled.

It owns:

- SQL workspace
- plan/confidence inspection
- runtime context inspection
- draft restore
- technical metadata disclosures

Analyst Mode must not automatically execute SQL from Monaco or generate SQL without explicit future contracts.

### Settings

Settings should be simple and quiet.

It owns:

- simple settings rows
- preferences
- non-workflow configuration

The investigation rail should be collapsed by default on Settings.

## UX Laws

These laws are binding for future UX implementation phases.

1. One fact, one visible home.
2. No repeated narration.
3. Mode is a toggle, not a headline.
4. Sidebar navigates only.
5. Right rail guides only.
6. Main canvas does the work.
7. No stacked metadata panels.
8. No giant hero headings.
9. No gradient wash.
10. Blue is reserved for active nav, current step, and primary action.
11. Technical metadata is collapsed unless the page is explicitly technical.
12. Human Mode copy is business-friendly and calming.
13. Analyst Mode copy is technical but controlled.
14. Runtime intelligence is assistive, not noisy.
15. Every page should make the next safe action obvious without executing anything automatically.

## Mode Contract

Human Mode:

- approachable
- business-oriented
- guided
- low SQL anxiety
- focused on questions, outcomes, and review

Analyst Mode:

- technical
- inspectable
- controlled
- explicit about SQL/runtime context
- never autonomous

The mode changes framing and visibility. It must not fork routing, mutate execution behavior, or create separate hidden state systems.

## Visual Direction

FiltraQueri should avoid:

- oversized hero blocks
- nested cards inside cards
- stacked metadata panels
- repeated uppercase labels
- dense admin-dashboard composition
- broad gradient backgrounds
- decorative visual noise

FiltraQueri should prefer:

- calm enterprise spacing
- clear page ownership
- compact context strips
- flat section grouping
- progressive disclosure
- readable tables and workflow controls
- restrained color usage

## Implementation Roadmap

### UX-F9: Shell Alignment

Align the top bar, sidebar, context strip, and right rail to this canonical blueprint.

Focus:

- remove remaining shell duplication
- tighten top bar responsibilities
- make sidebar navigation-only
- make the context strip canonical
- collapse rail where appropriate

### UX-F10: Home/Data Cleanup

Align Home and Data with their screen contracts.

Focus:

- continue/recent investigations on Home
- dataset profile and detected columns on Data
- remove repeated dataset facts
- fix loaded versus empty state collisions

### UX-F11: Explore/Build Cleanup

Align Explore and Build workflows.

Focus:

- business-first Explore flow
- compact Query Builder workflow
- approve-before-run clarity
- reduced narration and metadata density

### UX-F12: Results/Analyst Cleanup

Align Results and Analyst with their screen contracts.

Focus:

- business takeaway plus chart/table support
- result-specific metadata only
- technical Analyst inspection
- controlled SQL workspace hierarchy

### UX-F13: Settings/Collapsed Rail Cleanup

Align Settings and rail behavior.

Focus:

- simple settings rows
- collapsed rail on Settings
- quieter non-investigation surfaces
- consistent empty/support states

### UX-F14: Visual Polish And Responsive Pass

Refine the visual system after architecture settles.

Focus:

- responsive layout
- spacing rhythm
- typography scale
- color discipline
- hover/focus states
- visual regression checks

## Deferred Concepts

These ideas must wait for explicit future phases:

- AI orchestration
- autonomous planners
- generated SQL
- optimization execution
- replay systems
- governance ledgers
- MIR systems
- natural-language analytics
- automatic chart generation
- execution intelligence

Until then, all intelligence and guidance surfaces remain deterministic, metadata-only, and user-controlled.
