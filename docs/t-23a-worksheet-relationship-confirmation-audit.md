# T-23A Worksheet Relationship Confirmation Audit

## Files Inspected

- `frontend/src/features/analyst/sql/sqlRelationshipReview.ts`
- `frontend/src/features/analyst/sql/SqlWorkspace.tsx`
- `frontend/src/features/analyst/sql/SqlEditorPanel.tsx`
- `frontend/src/features/analyst/sql/businessSqlJoinPathResolver.ts`
- `frontend/src/features/analyst/sql/businessSqlQueryPlanner.ts`
- `frontend/src/features/analyst/sql/businessSqlRenderer.ts`
- `frontend/src/features/analyst/sql/businessSqlRenderReadiness.ts`
- `frontend/src/features/analyst/sql/businessSqlRenderPreviewUiAdapter.ts`
- `frontend/src/features/analyst/sql/sqlAskFiltraQueriAdapter.ts`
- `frontend/src/features/analyst/sql/sqlSingleTableTemplateAdapter.ts`
- `frontend/src/features/analyst/sql/adaptiveReportProposal.ts`
- `frontend/src/features/workbook/workbookTypes.ts`
- `frontend/src/features/workbook/workbookMetadata.ts`
- `frontend/src/services/api.ts`

## Current Relationship Model Status

Workbook metadata already has two relationship layers:

- `WorksheetRelationshipCandidate`: an inferred/suggested worksheet-column relationship. It carries worksheet/table/column endpoints, confidence, relationship type, direction, evidence, `status`, `reviewStatus`, and review metadata.
- `AcceptedRelationshipContract`: a relationship contract that downstream intelligence treats as stronger evidence. It carries source/target worksheet IDs, table names, column names, relationship type, confidence, accepted candidate ID, accepted timestamp/user, status, validation state, validation summary, overlap/uniqueness evidence, and last validation timestamp.

`workbookMetadata.ts` normalizes both candidates and accepted contracts from incoming workbook metadata and filters out records missing required endpoint IDs/columns.

## Current Accepted Relationship Contract Status

Today, an accepted contract effectively means:

- `status === "active"`
- `validationState !== "broken"`
- source/target worksheet, table, and column endpoints are present
- downstream planning can use it as relationship evidence

Current consumers:

- `sqlRelationshipReview.ts` displays accepted contracts as `Confirmed` in the read-only review model.
- `businessSqlJoinPathResolver.ts` merges `acceptedRelationshipContracts` and `readyRelationshipContracts`, then marks join requirements verified only when an active, non-broken contract matches the required tables and optional hinted columns.
- `businessSqlRenderReadiness.ts` blocks rendering unless required join paths are resolved and every required join/edge is verified.
- `businessSqlRenderer.ts` renders only after readiness passes and only for known deterministic shapes.
- `adaptiveReportProposal.ts` treats active, non-broken contracts as proof for proposed join needs.
- LLM payload builders sanitize accepted contracts as metadata, and validators reject overclaimed join verification without accepted metadata.

## Current Gaps

- The relationship review view is read-only: its model explicitly says `noPersistence`, `noAcceptance`, `noSqlGeneration`, `noBackendCall`, and `noRunQuery`.
- Users cannot confirm a suggested relationship from the focused review view.
- Users cannot reject an incorrect suggestion from the focused review view.
- Users cannot choose a different column pair.
- Confirmed relationships are not held in local UI state.
- Confirmed relationships are not passed as `readyRelationshipContracts`.
- Confirmed relationships cannot yet unblock Business SQL planning/rendering.
- The existing `reviewWorkbookRelationship` API can save relationship review, but using it now would introduce persistence/backend behavior that should be deferred.
- There is no clear invalidation model for source workbook changes, worksheet removal, schema changes, or dataset clearing.

## Proposed Confirmed Relationship Model

Add a UI-owned confirmation model before changing workbook persistence:

```ts
type SqlConfirmedWorksheetRelationship = {
  relationshipId: string;
  fromWorksheetId: string;
  fromWorksheetLabel: string;
  fromTableName: string;
  fromColumn: string;
  toWorksheetId: string;
  toWorksheetLabel: string;
  toTableName: string;
  toColumn: string;
  cardinality?: "one_to_one" | "one_to_many" | "many_to_one" | "unknown";
  confidence?: number;
  status: "confirmed" | "rejected";
  confirmedAt?: string;
  rejectedAt?: string;
  confirmedByUser: true;
  scope: "tab" | "workbook" | "dataset";
  source: "user_confirmed" | "imported" | "inferred_then_confirmed";
  acceptedFromCandidateId?: string | null;
  schemaBackedColumns: true;
  noSqlGeneratedOnConfirm: true;
  noRunQueryOnConfirm: true;
  userCanRemove: true;
  invalidatedWhenWorksheetMissing: true;
};
```

Use a separate adapter to convert confirmed records into existing `AcceptedRelationshipContract` shape only when feeding planning/readiness. Keep that adapter strict: require both worksheets, both tables, both columns, matching schema columns, active dataset/workbook identity, and no broken invalidation flags.

## Recommended Scope Strategy

Start with workbook-level in-memory confirmation scoped to the loaded workbook instance.

Rationale:

- Relationship meaning belongs to worksheets in a workbook more than to a single SQL tab.
- Tab-local confirmation would force users to reconfirm the same worksheet relationship across tabs.
- Dataset-level or persisted workbook-level confirmation is valuable later, but it crosses storage/API boundaries.
- In-memory workbook-level state can be cleared safely when the dataset/workbook changes.

Recommended first scope values:

- `scope: "workbook"` for confirmed relationships while the workbook remains loaded.
- Include active `workbookId` and dataset ID in the state container, even if not part of the individual relationship type.
- Treat tab scope as a later override if users need per-tab exceptions.

## In-Memory-First Recommendation

Implement confirmation in UI state first, not persistence.

Initial state owner should be `SqlWorkspace.tsx` because it already owns:

- focused view navigation
- relationship review requirements
- Business SQL preview inputs
- dataset/workbook context
- tab/source/scope state

The state should reset when:

- dataset ID changes
- workbook ID changes
- dataset is cleared
- required worksheets or columns no longer exist

Persistence should wait for T-23G/T-23H because `frontend/src/services/api.ts` already exposes `reviewWorkbookRelationship`, but using it changes backend/API and storage behavior.

## Safety Rules

- Confirming a relationship must not generate SQL.
- Confirming a relationship must not insert SQL.
- Confirming a relationship must not run SQL.
- Confirming a relationship must not call backend/API in the in-memory phase.
- Confirming a relationship must not mutate raw dataset/workbook metadata.
- Suggested relationships must never be treated as confirmed without explicit user action.
- Confirmed relationships must be schema-backed: both endpoint columns must exist in their current worksheet schemas.
- Confirmed relationships must be invalidated or ignored when worksheets, table names, columns, dataset ID, or workbook ID no longer match.
- Rejected relationships must block the same suggestion from being promoted automatically during the active session.
- Remove/undo must be available and must return the relationship to review-needed behavior.
- Business SQL rendering must still require readiness checks and verified join edges.

## Suggested UX Copy

- `Suggested connection`
- `Confirm connection`
- `Not a match`
- `Choose columns`
- `Confirmed connection`
- `Remove connection`
- `Confirming a connection does not run SQL. It only helps FiltraQueri plan safely.`
- `This suggestion was marked not a match.`
- `Choose the columns that connect these worksheets.`

## How Confirmation Should Affect Ask FiltraQueri

In the first intelligence step, confirmation should affect evidence only:

- Relationship review view can show confirmed/rejected status.
- Ask blocked summaries can stop repeating the same missing relationship when an in-memory confirmed relationship satisfies it.
- Ask can label a relationship as confirmed evidence.
- Ask should not automatically insert or generate SQL because confirmation happened.

Do not change ranking/order in T-23B through T-23D. When confirmed relationships are passed into planning in T-23E, they should be additive evidence, not a new recommender ranking system.

## How Confirmation Later Unblocks Multi-Table Business SQL

The existing Business SQL pipeline already has the right safety gates:

1. Convert schema-backed confirmed relationships to `AcceptedRelationshipContract`-compatible ready contracts.
2. Pass them as `readyRelationshipContracts` to `createBusinessSqlRenderPreviewFromWorkspaceContext`.
3. `businessSqlJoinPathResolver.ts` can mark matching join requirements verified.
4. `businessSqlRenderReadiness.ts` can move from blocked/needs-review to renderable only when all required joins/edges are verified.
5. `businessSqlRenderer.ts` can render only known deterministic shapes and only after readiness passes.

This means future unblocking should reuse `readyRelationshipContracts` rather than bypassing readiness.

## Interaction With Worksheet Scope And Source Labels

- Confirmation should be workbook-level, but planning should only use confirmed relationships relevant to the active/applied worksheet scope.
- If a tab scope excludes one side of a relationship, that relationship should not silently add an out-of-scope table to SQL generation.
- Source labels should keep table identity separate from display labels. Confirmed records need both worksheet labels for UI and stable table names for planning.
- Cleaned working copies need explicit handling later: initial confirmation should reference original worksheet IDs and current planning table names, then mark records stale if source/table mapping changes.

## Undo And Removal

Remove confirmed connection should:

- delete or deactivate the in-memory confirmed relationship
- not call backend/API
- not mutate workbook metadata
- return affected Ask/planning surfaces to needs-review/blocked behavior
- preserve rejected suggestions separately if the user explicitly chose Not a match

Rejected suggestions should be reversible through a future `Review again` or `Undo` action, but they should not become accepted evidence.

## Fixture Coverage Needed Before SQL Generation Is Unblocked

Add fixtures before rendering multi-table SQL from confirmations:

- Confirm suggested candidate creates a schema-backed confirmed relationship record.
- Reject suggested candidate prevents it from being used as evidence.
- Choose columns validates both columns exist in current worksheet schemas.
- Remove confirmed connection returns plan to needs-review/blocked.
- Dataset/workbook change clears or invalidates in-memory confirmations.
- Confirmed relationship is converted to ready contract only when active, schema-backed, and workbook-matched.
- `businessSqlJoinPathResolver` resolves joins from ready contracts.
- `businessSqlRenderReadiness` remains blocked if any required join is unverified.
- Renderer still refuses unknown shapes even with confirmed relationships.
- Confirming a relationship does not insert SQL, run SQL, call backend/API, or mutate the editor.

## Proposed Implementation Slices

- T-23B: add relationship confirmation types only.
- T-23C: add in-memory confirmed relationship state only.
- T-23D: wire Confirm/Reject controls in relationship detail view.
- T-23E: use confirmed relationships as Ask/planning evidence only.
- T-23F: unblock safe multi-table Business SQL planning.
- T-23G: persistence/storage audit.
- T-23H: persisted workbook relationship storage if approved.

## Recommended Next Slice

Proceed with T-23B: add relationship confirmation types only.

Keep it type-only and fixture-backed where practical. Do not wire UI controls, state, backend calls, SQL rendering, or Insert SQL behavior yet. The clean first step is to define the UI confirmation type, status vocabulary, safety flags, invalidation shape, and a narrow adapter interface for future conversion to ready relationship contracts.
