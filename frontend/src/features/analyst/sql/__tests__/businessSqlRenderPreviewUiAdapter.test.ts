/**
 * T-13H - read-only Business SQL preview UI adapter fixtures.
 *
 * Pure fixture runner only. No Monaco insertion, Run Query calls, clipboard,
 * backend/API calls, provider calls, or query execution.
 */

import type { AcceptedRelationshipContract } from "../../../workbook";
import {
  addSqlConfirmedRelationship,
  createEmptySqlRelationshipConfirmationState,
  createTemporaryReadyRelationshipContractsFromConfirmationState,
  type SqlConfirmedWorksheetRelationship,
} from "../sqlRelationshipConfirmation";
import {
  applyBusinessSqlRenderPreviewManualInsert,
  createBusinessSqlRenderPreviewFromWorkspaceContext,
  getBusinessSqlRenderPreviewEmptyState,
  getBusinessSqlRenderPreviewCopyState,
  getBusinessSqlRenderPreviewManualInsertState,
  type BusinessSqlRenderPreviewWorkspaceResult,
} from "../businessSqlRenderPreviewUiAdapter";

type PreviewUiAdapterFixture = {
  name: string;
  result: BusinessSqlRenderPreviewWorkspaceResult;
  assert: (result: BusinessSqlRenderPreviewWorkspaceResult) => string[];
};

type PreviewUiAdapterFixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type PreviewUiAdapterFixtureReport = {
  results: PreviewUiAdapterFixtureResult[];
  passed: PreviewUiAdapterFixtureResult[];
  failed: PreviewUiAdapterFixtureResult[];
};

const acceptedContract = (
  sourceTableName: string,
  sourceColumnName: string,
  targetTableName: string,
  targetColumnName: string,
): AcceptedRelationshipContract => ({
  contractId: `contract:${sourceTableName}-${targetTableName}`,
  sourceWorksheetId: `worksheet:${sourceTableName}`,
  sourceTableName,
  sourceColumnName,
  targetWorksheetId: `worksheet:${targetTableName}`,
  targetTableName,
  targetColumnName,
  relationshipType: "many_to_one_candidate",
  confidence: 0.95,
  acceptedFromCandidateId: `candidate:${sourceTableName}-${targetTableName}`,
  acceptedAt: "2026-01-01T00:00:00.000Z",
  acceptedBy: null,
  status: "active",
  validationState: "valid",
  validationSummary: [],
  overlapRatio: 1,
  sourceUniqueRatio: 0.5,
  targetUniqueRatio: 1,
  inferredTypeCompatible: true,
  lastValidatedAt: "2026-01-01T00:00:00.000Z",
});

const confirmedRelationship = ({
  fromTableName,
  fromColumn,
  toTableName,
  toColumn,
}: {
  fromTableName: string;
  fromColumn: string;
  toTableName: string;
  toColumn: string;
}): SqlConfirmedWorksheetRelationship => ({
  relationshipId: `sql-relationship:${[fromTableName, toTableName].sort().join("::")}`,
  fromWorksheetId: `worksheet:${fromTableName}`,
  fromWorksheetLabel: fromTableName,
  fromTableName,
  fromColumn,
  toWorksheetId: `worksheet:${toTableName}`,
  toWorksheetLabel: toTableName,
  toTableName,
  toColumn,
  cardinality: "many_to_one",
  confidence: 0.95,
  status: "confirmed",
  confirmedAt: "2026-01-01T00:00:00.000Z",
  confirmedByUser: true,
  scope: "workbook",
  source: "inferred_then_confirmed",
  acceptedFromCandidateId: `candidate:${fromTableName}-${toTableName}`,
  workbookId: "workbook:property",
  datasetId: "dataset:property",
  schemaBackedColumns: true,
  noSqlGeneratedOnConfirm: true,
  noRunQueryOnConfirm: true,
  noBackendCallOnConfirm: true,
  userCanRemove: true,
  invalidatedWhenWorksheetMissing: true,
});

const temporaryContractsFromConfirmedRelationships = (
  relationships: readonly SqlConfirmedWorksheetRelationship[],
): AcceptedRelationshipContract[] => {
  const state = relationships.reduce(
    (currentState, relationship) => addSqlConfirmedRelationship(currentState, relationship),
    createEmptySqlRelationshipConfirmationState(),
  );
  return createTemporaryReadyRelationshipContractsFromConfirmationState(state);
};

const activeSqlDraft = 'SELECT * FROM "leases";';
const reportSqlDraft = 'SELECT status, COUNT(*) AS lease_count FROM "leases" GROUP BY status;';
const emptySqlDraft = "";
const separateDraftCopy =
  "This preview is for deterministic Business SQL planning. The editor currently contains a separate SQL draft.";
const noPreviewCopy = "Business SQL Preview has no generated preview for this task.";
const fallbackDraftCopy =
  "Business SQL Preview has no generated preview for this task. You can still review the SQL currently in the editor and run it manually.";
const propertyUnitRelationship = confirmedRelationship({
  fromTableName: "properties",
  fromColumn: "property_id",
  toTableName: "units",
  toColumn: "property_id",
});
const customerOrderRelationship = confirmedRelationship({
  fromTableName: "customers",
  fromColumn: "customer_id",
  toTableName: "orders",
  toColumn: "customer_id",
});
const oneTemporaryReadyContract = temporaryContractsFromConfirmedRelationships([
  propertyUnitRelationship,
]);
const allTemporaryReadyContracts = temporaryContractsFromConfirmedRelationships([
  customerOrderRelationship,
]);
const persistedAcceptedContracts: AcceptedRelationshipContract[] = [];

const expectInsertRunDisabled = (
  result: BusinessSqlRenderPreviewWorkspaceResult,
): string[] => [
  ...(result.preview.actions.canInsertSql ? ["Insert must be disabled."] : []),
  ...(result.preview.actions.canRunSql ? ["Run must be disabled."] : []),
  ...(result.preview.rendererPreviewUiModel?.actions.canInsertSql
    ? ["Renderer preview insert must be disabled."]
    : []),
  ...(result.preview.rendererPreviewUiModel?.actions.canRunSql
    ? ["Renderer preview Run Query must be disabled."]
    : []),
];

const expectRendererPreviewSafety = (
  result: BusinessSqlRenderPreviewWorkspaceResult,
): string[] => {
  const model = result.preview.rendererPreviewUiModel;
  if (!model) return ["Expected renderer preview UI model."];

  return [
    ...(model.safetyLabels.previewOnly === "Preview only"
      ? []
      : ["Expected Preview only safety label."]),
    ...(model.safetyLabels.notExecuted === "Not executed"
      ? []
      : ["Expected Not executed safety label."]),
    ...(model.safetyLabels.notInsertedAutomatically === "Not inserted automatically"
      ? []
      : ["Expected Not inserted automatically safety label."]),
    ...(model.safetyLabels.runQueryManual === "Run Query remains manual"
      ? []
      : ["Expected Run Query remains manual safety label."]),
    ...(model.insertEligibility.eligible
      ? ["Renderer preview insert eligibility must remain disabled."]
      : []),
    ...(model.actions.canRunSql ? ["Renderer preview Run Query must remain disabled."] : []),
    ...(model.noSqlExecution &&
      model.noDuckDbExecution &&
      model.noEditorMutation &&
      model.noBackendCall &&
      model.noProviderCall &&
      model.noNetworkCall &&
      model.noPersistence
      ? []
      : ["Expected all renderer preview safety flags."]),
  ];
};

const expectRendererPreviewSql = (
  result: BusinessSqlRenderPreviewWorkspaceResult,
): string[] => {
  const model = result.preview.rendererPreviewUiModel;
  if (!model) return ["Expected renderer preview UI model."];

  return [
    ...(model.displayStatus === "rendered"
      ? []
      : [`Expected rendered renderer preview, got ${model.displayStatus}.`]),
    ...(model.sqlText === result.preview.sql
      ? []
      : ["Renderer preview SQL text must match Business SQL preview SQL."]),
    ...(model.actions.canPreviewSql ? [] : ["Renderer preview SQL should be previewable."]),
    ...expectRendererPreviewSafety(result),
  ];
};

const expectRendererPreviewNoSql = (
  result: BusinessSqlRenderPreviewWorkspaceResult,
  expectedStatus: NonNullable<
    BusinessSqlRenderPreviewWorkspaceResult["preview"]["rendererPreviewUiModel"]
  >["displayStatus"],
): string[] => {
  const model = result.preview.rendererPreviewUiModel;
  if (!model) return ["Expected renderer preview UI model."];

  return [
    ...(model.displayStatus === expectedStatus
      ? []
      : [`Expected ${expectedStatus} renderer preview, got ${model.displayStatus}.`]),
    ...(model.sqlText === null ? [] : ["Refused renderer preview must not expose SQL text."]),
    ...(model.actions.canPreviewSql
      ? ["Refused renderer preview must not be previewable."]
      : []),
    ...(model.actions.canCopySql ? ["Refused renderer preview copy must be disabled."] : []),
    ...expectRendererPreviewSafety(result),
  ];
};

const expectRunDisabledMessagePresent = (
  result: BusinessSqlRenderPreviewWorkspaceResult,
): string[] =>
  result.preview.actions.canRunSql
    ? ["Run preview action must stay disabled; manual Run Query remains separate."]
    : [];

const expectCopyEnabled = (
  result: BusinessSqlRenderPreviewWorkspaceResult,
): string[] => {
  const copyState = getBusinessSqlRenderPreviewCopyState(result.preview);
  return [
    ...(copyState.canCopySql ? [] : ["Copy should be enabled for ready SQL preview."]),
    ...(copyState.sql === result.preview.sql ? [] : ["Copy SQL should match preview SQL."]),
  ];
};

const expectCopyDisabled = (
  result: BusinessSqlRenderPreviewWorkspaceResult,
): string[] => {
  const copyState = getBusinessSqlRenderPreviewCopyState(result.preview);
  return [
    ...(copyState.canCopySql ? ["Copy should be disabled."] : []),
    ...(copyState.sql === null ? [] : ["Disabled copy state must not expose SQL."]),
  ];
};

const expectManualInsertEnabled = (
  result: BusinessSqlRenderPreviewWorkspaceResult,
): string[] => {
  const insertState = getBusinessSqlRenderPreviewManualInsertState(
    result.preview,
    result.activeSqlDraft,
  );
  const insertResult = applyBusinessSqlRenderPreviewManualInsert(
    result.preview,
    result.activeSqlDraft,
  );

  return [
    ...(insertState.canManuallyInsertSqlPreview
      ? []
      : ["Manual insert should be enabled for ready SQL preview and empty draft."]),
    ...(insertState.sql === result.preview.sql ? [] : ["Insert SQL should match preview SQL."]),
    ...(insertResult.inserted ? [] : ["Expected manual insert result to be inserted."]),
    ...(insertResult.activeSqlDraft === result.preview.sql
      ? []
      : ["Expected allowed manual insert to update the active draft to preview SQL."]),
    ...(result.preview.actions.canInsertSql
      ? ["Core preview canInsertSql must remain false."]
      : []),
    ...expectRunDisabledMessagePresent(result),
  ];
};

const expectManualInsertDisabled = (
  result: BusinessSqlRenderPreviewWorkspaceResult,
): string[] => {
  const insertState = getBusinessSqlRenderPreviewManualInsertState(
    result.preview,
    result.activeSqlDraft,
  );
  const insertResult = applyBusinessSqlRenderPreviewManualInsert(
    result.preview,
    result.activeSqlDraft,
  );

  return [
    ...(insertState.canManuallyInsertSqlPreview ? ["Manual insert should be disabled."] : []),
    ...(insertState.sql === null ? [] : ["Disabled manual insert must not expose SQL."]),
    ...(insertResult.inserted ? ["Disabled manual insert must not insert."] : []),
    ...(insertResult.activeSqlDraft === result.activeSqlDraft
      ? []
      : ["Disabled manual insert must preserve the active draft."]),
  ];
};

export const BUSINESS_SQL_RENDER_PREVIEW_UI_ADAPTER_FIXTURES: PreviewUiAdapterFixture[] = [
  {
    name: "empty editor and no rendered business preview says no preview available",
    result: createBusinessSqlRenderPreviewFromWorkspaceContext({
      taskPrompt: "",
      selectedGuidanceDialect: "duckdb",
      activeSqlDraft: emptySqlDraft,
    }),
    assert: (result) => {
      const emptyState = getBusinessSqlRenderPreviewEmptyState({
        preview: result.preview,
        activeSqlDraft: result.activeSqlDraft,
        activeSqlDraftSource: result.activeSqlDraftSource,
      });

      return [
        ...(result.preview.sql === null ? [] : ["Expected no generated business preview SQL."]),
        ...expectRendererPreviewNoSql(result, "needs_review"),
        ...(emptyState.message === noPreviewCopy ? [] : ["Expected no-preview empty copy."]),
        ...(emptyState.hasSeparateEditorDraft
          ? ["Empty editor must not be described as a separate SQL draft."]
          : []),
        ...expectCopyDisabled(result),
        ...expectManualInsertDisabled(result),
        ...expectRunDisabledMessagePresent(result),
        ...expectInsertRunDisabled(result),
      ];
    },
  },
  {
    name: "ready preview with empty draft exposes insert helper copy",
    result: createBusinessSqlRenderPreviewFromWorkspaceContext({
      taskPrompt: "Count leases by status",
      selectedGuidanceDialect: "duckdb",
      activeSqlDraft: emptySqlDraft,
    }),
    assert: (result) => [
      ...(result.preview.status === "ready" ? [] : ["Expected ready preview."]),
      ...(result.preview.sql ? [] : ["Expected display SQL."]),
      ...expectRendererPreviewSql(result),
      ...(result.preview.actions.canCopySql ? [] : ["Expected copy eligibility for ready SQL."]),
      ...expectCopyEnabled(result),
      ...expectManualInsertEnabled(result),
      ...expectRunDisabledMessagePresent(result),
      ...expectInsertRunDisabled(result),
    ],
  },
  {
    name: "ready preview with non-empty draft shows clear disabled insert reason",
    result: createBusinessSqlRenderPreviewFromWorkspaceContext({
      taskPrompt: "Count leases by status",
      selectedGuidanceDialect: "duckdb",
      activeSqlDraft,
    }),
    assert: (result) => {
      const insertState = getBusinessSqlRenderPreviewManualInsertState(
        result.preview,
        result.activeSqlDraft,
      );

      return [
        ...(result.preview.status === "ready" ? [] : ["Expected ready preview."]),
        ...(result.preview.sql ? [] : ["Expected display SQL."]),
        ...expectRendererPreviewSql(result),
        ...expectCopyEnabled(result),
        ...expectManualInsertDisabled(result),
        ...(insertState.disabledReason ===
        "Editor already has SQL. Clear it before inserting preview SQL."
          ? []
          : ["Expected clear non-empty draft disabled reason."]),
        ...expectRunDisabledMessagePresent(result),
        ...expectInsertRunDisabled(result),
      ];
    },
  },
  {
    name: "editor SQL with needs-review preview explains separate editor draft",
    result: createBusinessSqlRenderPreviewFromWorkspaceContext({
      taskPrompt: "tickets per account",
      selectedGuidanceDialect: "duckdb",
      activeSqlDraft,
      activeSqlDraftSource: "manual",
    }),
    assert: (result) => {
      const emptyState = getBusinessSqlRenderPreviewEmptyState({
        preview: result.preview,
        activeSqlDraft: result.activeSqlDraft,
        activeSqlDraftSource: result.activeSqlDraftSource,
      });

      return [
        ...(result.preview.status === "needs_review" ? [] : ["Expected needs_review preview."]),
        ...(result.preview.sql === null ? [] : ["Expected no SQL for needs_review preview."]),
        ...expectRendererPreviewNoSql(result, "needs_review"),
        ...(result.preview.reasons.length > 0 ? [] : ["Expected needs_review reasons."]),
        ...(emptyState.message === separateDraftCopy
          ? []
          : ["Expected separate editor draft clarification copy."]),
        ...(emptyState.hasSeparateEditorDraft ? [] : ["Expected separate editor draft flag."]),
        ...expectCopyDisabled(result),
        ...expectManualInsertDisabled(result),
        ...expectRunDisabledMessagePresent(result),
        ...expectInsertRunDisabled(result),
      ];
    },
  },
  {
    name: "report/template draft does not become Business SQL Preview SQL",
    result: createBusinessSqlRenderPreviewFromWorkspaceContext({
      taskPrompt: "tickets per account",
      selectedGuidanceDialect: "duckdb",
      activeSqlDraft: reportSqlDraft,
      activeSqlDraftSource: "report",
    }),
    assert: (result) => {
      const emptyState = getBusinessSqlRenderPreviewEmptyState({
        preview: result.preview,
        activeSqlDraft: result.activeSqlDraft,
        activeSqlDraftSource: result.activeSqlDraftSource,
      });

      return [
        ...(result.activeSqlDraft === reportSqlDraft
          ? []
          : ["Expected report SQL draft to remain active editor draft only."]),
        ...(result.preview.sql === null
          ? []
          : ["Report/template draft must not be exposed as Business SQL Preview SQL."]),
        ...expectRendererPreviewNoSql(result, "needs_review"),
        ...(emptyState.message === separateDraftCopy
          ? []
          : ["Expected separate editor draft clarification for report/template draft."]),
        ...expectCopyDisabled(result),
        ...expectManualInsertDisabled(result),
        ...expectRunDisabledMessagePresent(result),
        ...expectInsertRunDisabled(result),
      ];
    },
  },
  {
    name: "unknown draft source uses generic editor-review copy",
    result: createBusinessSqlRenderPreviewFromWorkspaceContext({
      taskPrompt: "tickets per account",
      selectedGuidanceDialect: "duckdb",
      activeSqlDraft,
    }),
    assert: (result) => {
      const emptyState = getBusinessSqlRenderPreviewEmptyState({
        preview: result.preview,
        activeSqlDraft: result.activeSqlDraft,
        activeSqlDraftSource: result.activeSqlDraftSource,
      });

      return [
        ...(result.preview.status === "needs_review" ? [] : ["Expected needs_review preview."]),
        ...expectRendererPreviewNoSql(result, "needs_review"),
        ...(emptyState.message === fallbackDraftCopy ? [] : ["Expected generic fallback copy."]),
        ...expectCopyDisabled(result),
        ...expectManualInsertDisabled(result),
        ...expectRunDisabledMessagePresent(result),
        ...expectInsertRunDisabled(result),
      ];
    },
  },
  {
    name: "blocked preview displays blocking reason and no SQL",
    result: createBusinessSqlRenderPreviewFromWorkspaceContext({
      taskPrompt: "orders per customer",
      selectedGuidanceDialect: "duckdb",
      missingRelationships: [{ fromEntity: "customers", toEntity: "orders" }],
      activeSqlDraft,
    }),
    assert: (result) => [
      ...(result.preview.status === "blocked" ? [] : ["Expected blocked preview."]),
      ...(result.preview.sql === null ? [] : ["Expected no SQL for blocked preview."]),
      ...expectRendererPreviewNoSql(result, "blocked"),
      ...(result.preview.reasons.length > 0 ? [] : ["Expected blocking reason."]),
      ...expectCopyDisabled(result),
      ...expectManualInsertDisabled(result),
      ...expectRunDisabledMessagePresent(result),
      ...expectInsertRunDisabled(result),
    ],
  },
  {
    name: "one confirmed local relationship keeps multi-hop preview in review",
    result: createBusinessSqlRenderPreviewFromWorkspaceContext({
      taskPrompt: "How many units in each property are leased to current tenants?",
      selectedGuidanceDialect: "duckdb",
      readyRelationshipContracts: oneTemporaryReadyContract,
      activeSqlDraft,
    }),
    assert: (result) => [
      ...(result.preview.status === "needs_review" ? [] : ["Expected needs_review preview."]),
      ...(result.preview.sql === null ? [] : ["Expected no SQL until all relationships are resolved."]),
      ...expectRendererPreviewNoSql(result, "needs_review"),
      ...expectCopyDisabled(result),
      ...expectManualInsertDisabled(result),
      ...expectInsertRunDisabled(result),
    ],
  },
  {
    name: "all confirmed local relationships resolve through temporary ready contracts",
    result: createBusinessSqlRenderPreviewFromWorkspaceContext({
      taskPrompt: "How many orders per customer?",
      selectedGuidanceDialect: "duckdb",
      acceptedRelationshipContracts: persistedAcceptedContracts,
      readyRelationshipContracts: allTemporaryReadyContracts,
      activeSqlDraft: emptySqlDraft,
    }),
    assert: (result) => [
      ...(persistedAcceptedContracts.length === 0
        ? []
        : ["Temporary contracts must not mutate persisted accepted relationships."]),
      ...(allTemporaryReadyContracts.every((contract) =>
        contract.contractId.startsWith("temporary-review:"),
      )
        ? []
        : ["Expected session-scoped temporary contract ids."]),
      ...(result.preview.status === "ready" ? [] : ["Expected ready preview."]),
      ...(result.preview.sql ? [] : ["Expected existing guarded preview SQL only after all relationships resolve."]),
      ...expectRendererPreviewSql(result),
      ...expectManualInsertEnabled(result),
      ...expectInsertRunDisabled(result),
    ],
  },
  {
    name: "preview creation does not mutate active SQL draft",
    result: createBusinessSqlRenderPreviewFromWorkspaceContext({
      taskPrompt: "Count leases by status",
      selectedGuidanceDialect: "duckdb",
      activeSqlDraft,
    }),
    assert: (result) =>
      result.activeSqlDraft === activeSqlDraft
        ? []
        : ["Expected active SQL draft to be preserved unchanged."],
  },
  {
    name: "manual insert action does not mutate preview or core plan contract",
    result: createBusinessSqlRenderPreviewFromWorkspaceContext({
      taskPrompt: "Count leases by status",
      selectedGuidanceDialect: "duckdb",
      activeSqlDraft: emptySqlDraft,
    }),
    assert: (result) => {
      const beforeSummary = [
        result.preview.status,
        result.preview.sql,
        result.preview.actions.canCopySql,
        result.preview.actions.canInsertSql,
        result.preview.actions.canRunSql,
      ].join("|");
      applyBusinessSqlRenderPreviewManualInsert(result.preview, result.activeSqlDraft);
      const afterSummary = [
        result.preview.status,
        result.preview.sql,
        result.preview.actions.canCopySql,
        result.preview.actions.canInsertSql,
        result.preview.actions.canRunSql,
      ].join("|");

      return [
        ...(beforeSummary === afterSummary
          ? []
          : ["Manual insert helper must not mutate the preview."]),
        ...(result.preview.actions.canInsertSql
          ? ["Core preview canInsertSql must remain false."]
          : []),
        ...(result.preview.actions.canRunSql ? ["Run must remain disabled."] : []),
        ...expectRendererPreviewSafety(result),
        ...expectRunDisabledMessagePresent(result),
      ];
    },
  },
  {
    name: "unsupported renderer preview metadata exposes no SQL and insert disabled",
    result: createBusinessSqlRenderPreviewFromWorkspaceContext({
      taskPrompt: "Show me something interesting about the workbook",
      selectedGuidanceDialect: "duckdb",
      activeSqlDraft: emptySqlDraft,
    }),
    assert: (result) => [
      ...(result.preview.status === "needs_review" ? [] : ["Expected needs_review preview."]),
      ...(result.preview.sql === null ? [] : ["Unsupported preview must not expose SQL."]),
      ...expectRendererPreviewNoSql(result, "needs_review"),
      ...expectCopyDisabled(result),
      ...expectManualInsertDisabled(result),
      ...expectInsertRunDisabled(result),
    ],
  },
  {
    name: "same input produces the same renderer preview metadata",
    result: createBusinessSqlRenderPreviewFromWorkspaceContext({
      taskPrompt: "Count leases by status",
      selectedGuidanceDialect: "duckdb",
      activeSqlDraft: emptySqlDraft,
    }),
    assert: (result) => {
      const second = createBusinessSqlRenderPreviewFromWorkspaceContext({
        taskPrompt: "Count leases by status",
        selectedGuidanceDialect: "duckdb",
        activeSqlDraft: emptySqlDraft,
      });

      return JSON.stringify(result.preview.rendererPreviewUiModel) ===
        JSON.stringify(second.preview.rendererPreviewUiModel)
        ? []
        : ["Expected deterministic renderer preview metadata."];
    },
  },
  {
    name: "selected guidance dialect remains metadata only",
    result: createBusinessSqlRenderPreviewFromWorkspaceContext({
      taskPrompt: "orders per customer",
      selectedGuidanceDialect: "oracle",
      acceptedRelationshipContracts: [
        acceptedContract("customers", "customer_id", "orders", "customer_id"),
      ],
      activeSqlDraft,
    }),
    assert: (result) => [
      ...(result.preview.status === "ready" ? [] : ["Expected ready preview."]),
      ...(result.preview.rendererTarget === "duckdb" ? [] : ["Expected DuckDB target."]),
      ...(result.preview.guidanceDialect === "oracle" ? [] : ["Expected Oracle guidance metadata."]),
      ...(result.preview.sql?.includes('"orders"') ? [] : ["Expected DuckDB SQL display."]),
      ...expectRendererPreviewSql(result),
      ...expectCopyEnabled(result),
      ...expectManualInsertDisabled(result),
      ...expectRunDisabledMessagePresent(result),
      ...expectInsertRunDisabled(result),
    ],
  },
];

export function runBusinessSqlRenderPreviewUiAdapterFixtures(): PreviewUiAdapterFixtureReport {
  const results = BUSINESS_SQL_RENDER_PREVIEW_UI_ADAPTER_FIXTURES.map((fixture) => {
    const failureReasons = fixture.assert(fixture.result);
    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      failureReasons,
    };
  });

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export function allBusinessSqlRenderPreviewUiAdapterFixturesPass(): boolean {
  return runBusinessSqlRenderPreviewUiAdapterFixtures().failed.length === 0;
}
