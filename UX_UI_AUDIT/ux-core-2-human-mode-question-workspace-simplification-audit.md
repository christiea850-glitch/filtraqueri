# UX-CORE-2 Human Mode Question Workspace Simplification Audit

## Document Status

Audit and planning only.

No application code, backend logic, Query Builder logic, ResultsGrid behavior, ActiveResultModel behavior, execution behavior, upload/session restore behavior, routing/back behavior, persistence behavior, or API contracts are changed by this document.

## Current Problem

Human Mode now exposes too much of the infrastructure that was created to keep UX-CORE-2 safe.

The controlled draft, governed request draft, execution boundary, and future preview layers were useful while building checkpoints, but they are now visible as separate product surfaces. The user sees many overlapping sections:

- Investigation Review
- Planning-only understanding
- Schema-aware draft plan
- Planning choices only
- Investigation blueprint
- Draft logic only
- Future execution preview
- Protected governance state
- Query Builder request draft
- Potential investigation strategy
- Execution boundary
- Explore question
- Query Builder setup
- Results review

This violates the Operational UX Charter principle that internal architecture must not become the user journey. Human Mode should help a business user answer a question, not inspect every advisory layer.

The current experience has three main issues:

- It repeats the same facts: question, fields, grouping, measure, status, no execution.
- It shows implementation terms: `generatedSql`, `generatedQueryBuilderRequest`, `executionStatus`, "draft_only", "local review candidate".
- It turns one workflow into many stacked panels, making it unclear what the user should do next.

## Current Section Inventory

### QuestionWorkspacePanel

Visible today after a question is prepared:

| Current section / label | User value | Problem |
| --- | --- | --- |
| Ask a business question | High | Keep as primary entry point. |
| Active dataset context | High | Keep, but compact. |
| Starter questions | Medium | Keep only if compact and not a card wall. |
| Investigation Review | Medium | Duplicates later review sections. Should become the main review card. |
| Protected status: "No query has been generated yet" | Low | Governance language; should become one short safety line. |
| Question/Dataset/Source/Possible focus/type/fields/status review card | Medium | Useful facts, too many at once. Keep only question, recommended fields, interpretation, clarification. |
| Planning-only understanding | Medium | User needs interpretation, not planning internals. Fold into "Suggested interpretation". |
| Schema-aware draft plan | Medium | User needs recommended fields. Rename and merge into review. |
| Planning choices only | High | User needs to choose dimension/measure/date when ambiguous. Keep as "Choose fields". |
| Clarification needs | High | Keep visible when blocking. |
| Suggested clarifying questions | Medium | Keep visible only when needed. |
| Investigation blueprint | Low to medium | Too long for main flow. Collapse under "Review details". |
| Future execution path | Low | Internal staging. Hide from Human Mode or move to details. |
| Draft logic only | Low | Internal controlled draft. Hide by default. |
| Protection chips: no query/no SQL/no backend/future request | Low | Repetitive. Replace with one business-facing sentence. |
| Logic grid: selected fields/grouping/aggregation/sorting/limit/output | Medium | Useful, but should be summarized in one "Suggested setup" view. |
| Execution status / generatedSql / generatedQueryBuilderRequest | Very low | Governance/debug-only. Hide from normal Human Mode. |
| Validation warnings / blocking requirements | High when actionable | Keep only human-readable blockers visible; detailed validation goes under details. |
| Future execution preview | Low | Text previews are internal planning. Collapse or remove from Human Mode. |
| Protected governance state | Very low | Developer/governance-only. Hide. |
| Query Builder request draft | Medium | The apply action matters; raw request details do not. Keep status/action, collapse technical summary. |
| Request preview: selected columns/group/aggregations/filters/order/limit | Medium | Useful under "Review details"; main flow should show business labels. |
| Protected request state | Very low | Developer/governance-only. Hide. |
| Potential investigation strategy | Low | Generic and redundant. Remove from main Human Mode. |
| Planned investigation steps | Low | Redundant with actual workflow. Hide or collapse. |
| Execution boundary | Low | Keep only one safety sentence near action. |
| Final "No query has run yet" copy | Low | Redundant once safety line exists. |

### VisualQueryBuilderPanel

Visible today in Human Mode:

| Current section / label | User value | Problem |
| --- | --- | --- |
| Explore question / Shape the next business question | Medium | Redundant after QuestionWorkspacePanel. Collapse or remove when a prepared draft is applied. |
| Orient / Start with the question | Low after question input exists | Duplicates the top question prompt. |
| Primary direction | Medium | Can be useful before a draft; less useful after draft apply. |
| Action rail: Review fields / Compare groups / Review run | Medium | Keep if it acts as navigation. |
| Build heading | Medium | Keep but rename in Human Mode to "Review setup". |
| Review before run approval strip | High | Keep. This is the real execution boundary. |
| Request draft applied notice | High | Keep, concise. |
| Workflow tabs: Fields, Measure, Filter, Group by, Sort/limit, Review & run | High | Keep, but Human Mode should default to a compact review when populated by question. |
| Select data | High | Keep as editable Query Builder review. |
| Define question | Low | Duplicates question workspace. Collapse or remove. |
| Filter your business question | Medium | Keep as scope review; filter handoff is not part of current governed draft. |
| Group by | High | Keep. |
| Sort / limit | High | Keep. |
| Review output | High | Keep with Run query. |
| Query details disclosure | Medium | Keep collapsed. |

### ResultsInvestigationSurface

Visible today after execution:

| Current section / label | User value | Problem |
| --- | --- | --- |
| What the data shows | High | Keep. |
| Answered question traceability | High | Keep. |
| Finding / takeaway | High | Keep if backed by actual result state. |
| Evidence rows | Medium | Keep concise. |
| Next move action rail | Medium | Keep but avoid generic actions that do not yet perform meaningful follow-up. |
| Follow-up and result details disclosure | Medium | Keep collapsed. |
| Lightweight result insights | Medium | Potentially redundant with Evidence rows. Consider consolidating. |
| Supporting result context | Medium | Keep compact. |
| Result details disclosure | Medium | Keep collapsed. |
| ResultsGrid below | High | Keep as canonical table. |

## Classification

### Must Show In Human Mode

These are essential for a business user to understand and act:

- Ask a business question
- Active dataset/source context
- Prepare answer button
- Suggested interpretation: intent and plain-language summary
- Recommended fields:
  - dimension/group
  - measure
  - date field when relevant
- Clarification needed, only when blocking
- Field choice controls when there are ambiguous candidates
- Apply to Query Builder for Review button when ready
- Query Builder review notice: "Nothing runs until you click Run query."
- Query Builder setup summary:
  - selected fields
  - grouping
  - measure/aggregation
  - filters/scope
  - sort/limit
- Existing Run query button
- Answered question traceability after execution
- Key result / result summary
- ResultsGrid
- Export and pagination controls where they already exist
- Next suggested actions after a real result exists

### Should Be Collapsed Under "Review Details"

These can help users who want to inspect the setup, but they should not dominate:

- full candidate field lists
- confidence labels
- ambiguous term matches
- validation warnings written in business language
- blocking requirements detail
- request preview:
  - selected columns
  - group by
  - aggregations
  - filters
  - order by
  - limit
- why this approach was chosen
- planned output type
- Query Builder request status
- result source facts:
  - source tab
  - page
  - rows per page
  - export columns

Recommended collapsed label:

```text
Review details
```

Optional helper:

```text
See field matches, request preview, and validation notes.
```

### Should Move To Analyst Mode / Advanced Details

These are useful for analyst-depth inspection, but not for the main Human Mode path:

- schema-aware draft plan label
- controlled logic draft summary
- future Query Builder mapping preview
- technical Query Builder request preview
- advanced validation warnings
- full logic blueprint
- field scoring or confidence internals
- future execution stages
- technical result details
- per-result request payload inspection

Recommended Analyst/Advanced naming:

```text
View logic
Technical details
Request preview
Validation details
```

### Developer / Governance Only, Hidden From Normal Users

These should not appear in Human Mode and usually should not appear in Analyst Mode unless a debug flag or governance audit view exists:

- Protected governance state
- Protected request state
- `generatedSql: null`
- `generatedQueryBuilderRequest: null`
- `executionStatus: "draft_only"`
- `executionStatus: "not_executed"`
- `draftKind: "query_builder_plan"`
- "local eligibility state only"
- "request locality"
- repeated "No SQL has been generated" chips
- repeated "No backend query has executed" chips
- "Future Query Builder request has not been created yet"
- internal status values such as `blocked_by_missing_requirements`
- raw governance protection panels

Governance guarantees still matter, but they should be enforced in code and tested in audits, not shown as primary UX.

## Recommended Simplified Human Mode Flow

### A. Ask

Visible content:

- title: `Ask a business question`
- active dataset/source context
- text area
- compact starter prompts
- button: `Prepare answer`

Copy:

```text
Start with what you want to learn. Nothing runs until you review the setup and click Run query.
```

### B. Review Suggested Setup

Replace the current stack of review, intent, schema plan, blueprint, logic draft, future preview, and request draft with one main review section.

Visible content:

- `Suggested interpretation`
- `Recommended fields`
- `Choose fields`, only when needed
- `Clarification needed`, only when blocking
- `Ready to review in Query Builder`, when eligible
- button: `Apply to Query Builder for Review`

Suggested layout:

```text
Review suggested setup

Question
"Which contract has the highest average tenure months?"

Suggested interpretation
Rank contracts by average tenure.

Recommended fields
Group: Contract
Measure: Tenure Months
Calculation: Average
Sort: Highest first
Limit: Top 10

[Apply to Query Builder for Review]

Nothing runs until you click Run query in Query Builder.

[Review details]
```

When blocked:

```text
More clarification is needed
Choose the measure to calculate.
[field choices]
```

When filters are present but handoff is not supported:

```text
This question includes filters. Filter handoff needs a later review step before applying to Query Builder.
```

### C. Query Builder Review

Keep the existing Query Builder as the explicit execution review surface, but reduce duplicate orientation content in Human Mode.

Visible content:

- `Review Query Builder setup`
- applied draft notice:
  - `Request draft applied for review. Nothing has run yet.`
- selected fields
- grouping
- measure/aggregation
- filters/scope
- sort/limit
- existing `Run query` button

The existing workflow tabs can remain, but the first viewport should emphasize the review summary and Run boundary.

Potential Human Mode copy:

```text
Review Query Builder setup
Nothing runs until you click Run query.
```

### D. Result

Visible content:

- `Answered question`
- key result / takeaway
- ResultsGrid
- result context
- next suggested actions

Keep:

- `Answered question: ...`
- `Logic source: Query Builder review`
- ResultsGrid as the canonical table
- export/pagination controls

Avoid:

- second answer table
- unsupported generic follow-up actions
- raw request payloads in the main view

## Proposed Human Mode Information Architecture

```text
QuestionWorkspacePanel
  Ask a business question
  Dataset context
  Review suggested setup
    Suggested interpretation
    Recommended fields
    Clarification choices
    Apply to Query Builder for Review
    Review details (collapsed)

VisualQueryBuilderPanel
  Review Query Builder setup
  Applied draft notice
  Fields / Grouping / Measure / Sort / Limit
  Run query
  Query details (collapsed)

ResultsInvestigationSurface + ResultsGrid
  Answered question
  Key result
  Result context
  Results table
  Follow-up and result details (collapsed)
```

## Implementation Checkpoints

### Checkpoint 1: Human Mode Review Consolidation

Goal:

- Reduce `QuestionWorkspacePanel` to one visible review section after `Prepare answer`.

Scope:

- Keep existing data derivation and builders.
- Change rendering only.
- Preserve `onApplyQueryBuilderRequestDraft`.
- Keep blockers and field selection controls.
- Move internal sections into one collapsed `Review details` disclosure or hide them.

Likely edits:

- `frontend/src/components/workspace/QuestionWorkspacePanel.tsx`
- `frontend/src/styles/question-workspace.css` or equivalent workspace styles, only if spacing needs adjustment.

Must not change:

- question translator/builders
- Query Builder request builder
- execution systems
- backend

### Checkpoint 2: Query Builder Human Mode Cleanup

Goal:

- Reduce duplicate orientation in `VisualQueryBuilderPanel` when a question draft has been applied.

Scope:

- Keep Query Builder state and controls.
- Keep Run query.
- Keep editability.
- Preserve review notice.
- Consider hiding or collapsing the `Explore question` stage-only shell when `reviewNotice` exists.

Likely edits:

- `frontend/src/components/query-builder/VisualQueryBuilderPanel.tsx`
- query-builder styles only for minor spacing.

Must not change:

- `useQueryBuilderController`
- `runVisualQuery`
- backend Query Builder contract

### Checkpoint 3: Results Review Cleanup

Goal:

- Keep result traceability and ResultsGrid, reduce duplicate insight/result context rows.

Scope:

- Keep `Answered question`.
- Keep key result.
- Keep result details collapsed.
- Keep ResultsGrid ownership.

Likely edits:

- `frontend/src/components/results/ResultsInvestigationSurface.tsx`
- results styles only for minor spacing.

Must not change:

- `ResultsGrid`
- `ActiveResultModel`
- pagination/export handlers

### Checkpoint 4: Analyst / Advanced Logic Disclosure

Goal:

- Provide an appropriate home for technical request details without making them primary Human Mode UX.

Scope:

- Add or reuse a collapsed `View logic` / `Technical details` disclosure.
- Show Query Builder request preview and validation details there.
- Keep generated SQL hidden unless a future governed SQL explain feature exists.

Likely edits:

- `QuestionWorkspacePanel` or a new small `QuestionReviewDetails` component.
- Possibly `ResultsInvestigationSurface` for per-result View Logic later.

Must not change:

- SQL Workspace behavior
- execution behavior
- backend

## Files Likely To Change

Likely:

- `frontend/src/components/workspace/QuestionWorkspacePanel.tsx`
- `frontend/src/components/query-builder/VisualQueryBuilderPanel.tsx`
- `frontend/src/components/results/ResultsInvestigationSurface.tsx`
- `frontend/src/styles/question-workspace.css` or current workspace stylesheet if the component uses shared styles
- `frontend/src/styles/query-builder.css`
- `frontend/src/styles/results.css`

Possible if component extraction improves clarity:

- `frontend/src/components/workspace/QuestionReviewDetails.tsx`
- `frontend/src/components/workspace/QuestionSuggestedSetup.tsx`

These extracted components should remain presentational.

## Files That Must Not Change

Must not change for the simplification checkpoint:

- `backend/app/main.py`
- `frontend/src/services/api.ts`
- `frontend/src/features/execution/executeWorkspaceQuery.ts`
- `frontend/src/features/results/useResultExecutionCoordinator.ts`, unless a later checkpoint explicitly needs display-only provenance plumbing
- `frontend/src/features/results/activeResultModel.ts`
- `frontend/src/components/results/ResultsGrid.tsx`
- `frontend/src/features/query-builder/useQueryBuilderController.ts`
- `frontend/src/features/questionWorkspace/questionLogicDraftBuilder.ts`
- `frontend/src/features/questionWorkspace/questionQueryBuilderRequestBuilder.ts`
- `frontend/src/features/questionWorkspace/schemaQuestionTranslator.ts`, unless copy labels need non-behavioral updates
- SQL Workspace files
- upload/session restore controllers
- export/pagination controllers
- routing/back behavior
- backend storage/manifests

## Risks And Safeguards

### Risk: Hiding Safety Too Much

Safeguard:

- Keep one visible safety sentence near each action:
  - `Nothing runs until you click Run query.`
  - `This setup is for review only.`

The UI does not need to show raw null fields to be safe.

### Risk: Removing Useful Clarification

Safeguard:

- Keep blocking clarification visible.
- Keep field choice controls visible when ambiguity affects the result.
- Collapse details only when they do not change the next user decision.

### Risk: Breaking Apply-To-Query-Builder

Safeguard:

- Do not change the governed draft builder.
- Do not change `onApplyQueryBuilderRequestDraft`.
- Keep apply button conditions tied to `created_for_review`, non-null request, and no filters.

### Risk: Blurring Review And Execution

Safeguard:

- Do not add a Run button to `QuestionWorkspacePanel`.
- Keep existing Query Builder `Run query` as the only execution action.
- Preserve the Query Builder review notice.

### Risk: Creating A Second Result System

Safeguard:

- Result section must continue to use ResultsGrid and ActiveResultModel.
- Do not add a separate answer table.
- Keep result summary lightweight and clearly backed by executed results.

### Risk: Analyst Mode Becomes A Dumping Ground

Safeguard:

- Move only genuinely technical details to Analyst/Advanced.
- Keep advanced details collapsed and purposeful.
- Do not expose governance fields that only prove implementation state.

## Definition Of Done

The simplification is complete when:

- Human Mode question workspace has one clear top question entry.
- Preparing an answer shows one clear review section, not a stack of internal planning panels.
- The user can see the suggested interpretation and recommended fields.
- Clarification needs remain visible when they block readiness.
- The apply action remains available only for eligible governed request drafts.
- Internal governance fields are hidden from normal Human Mode:
  - `generatedSql: null`
  - `generatedQueryBuilderRequest: null`
  - `executionStatus: draft_only`
  - protected governance panels
- Query Builder review remains the place where the user can inspect/edit setup and click Run query.
- Existing Run query remains the only execution action.
- Results continue through ActiveResultModel and ResultsGrid.
- Answered-question traceability remains visible after execution.
- Pagination/export/upload/session restore/routing/back behavior remain unchanged.
- Build passes.

## Final Recommendation

Proceed with simplification as a presentation-layer consolidation, not an architecture change.

The underlying controlled logic draft, governed request draft, and execution protections should remain in code. Human Mode should show only the business decision layer:

```text
Ask question
-> Review suggested setup
-> Apply to Query Builder for Review
-> Review Query Builder setup
-> Run query
-> Review result
```

Everything else should either collapse under `Review details`, move to analyst-depth `View logic`, or remain developer/governance-only.
