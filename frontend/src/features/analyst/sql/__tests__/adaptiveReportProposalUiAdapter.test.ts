/**
 * T-13M-2 - Adaptive Report Proposal UI adapter fixtures.
 *
 * Pure fixture runner only. No SQL generation, SQL rendering, Monaco insertion,
 * Run Query calls, backend/API calls, provider calls, LLM calls, or ranking changes.
 */

import type { DatasetMetadata, SchemaColumn } from "../../../dataset/datasetTypes";
import type { WorkbookMetadata, WorksheetMetadata } from "../../../workbook";
import {
  createAdaptiveReportProposalFallback,
  createBusinessSqlPreviewAdaptiveReportProposalFallback,
  createTaskAssistAdaptiveReportProposalFallback,
  type AdaptiveReportProposalFallbackState,
} from "../adaptiveReportProposalUiAdapter";
import type { BusinessSqlRenderPreview } from "../businessSqlRenderPreview";
import type { SqlTemplateRecommendation } from "../sqlTemplateRecommender";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type AdaptiveReportProposalUiAdapterFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type Fixture = {
  name: string;
  state: AdaptiveReportProposalFallbackState;
  assert: (state: AdaptiveReportProposalFallbackState) => string[];
};

const column = (name: string, inferred_type: SchemaColumn["inferred_type"] = "text"): SchemaColumn => ({
  name,
  type: inferred_type,
  inferred_type,
  null_count: 0,
  unique_count: 1,
  sample_values: [],
});

const worksheet = (tableName: string, columns: SchemaColumn[]): WorksheetMetadata => ({
  worksheetId: `worksheet:${tableName}`,
  workbookId: "workbook:adaptive",
  sheetName: tableName,
  displayName: tableName,
  tableName,
  originalIndex: 0,
  status: "ready",
  schema: columns,
  rowCount: 10,
  columnCount: columns.length,
  visibleColumns: columns.map((item) => item.name),
  hiddenColumns: [],
  normalization: {
    version: 1,
    normalizedAt: "2026-01-01T00:00:00.000Z",
    headerRowIndex: 0,
    skippedLeadingRows: 0,
    headerDetectionStrategy: "fixture",
    headerDetectionConfidence: "high",
    headerDetectionWarning: null,
    originalFirstRowPreview: null,
    selectedHeaderRowPreview: null,
    structuralColumnCandidates: [],
    structuralColumnDetectionWarning: null,
    structuralColumnDetectionConfidence: null,
    structuralColumnSampleSize: null,
    recommendedHiddenColumns: [],
    duplicateColumnCount: 0,
    emptyColumnCount: 0,
    warnings: [],
    templateStructureCandidate: false,
    templateStructureConfidence: "low",
    templateStructureEvidence: [],
  },
});

const worksheets = [
  worksheet("orders", [column("order_id"), column("customer_id"), column("order_total", "numeric")]),
  worksheet("customers", [column("customer_id"), column("customer_name")]),
];

const workbook: WorkbookMetadata = {
  workbookId: "workbook:adaptive",
  workspaceId: null,
  name: "Adaptive workbook",
  status: "ready",
  sourceFile: {
    originalFilename: "adaptive.xlsx",
    storedPath: null,
    mimeType: null,
    byteSize: null,
    uploadedAt: "2026-01-01T00:00:00.000Z",
  },
  worksheetIds: worksheets.map((item) => item.worksheetId),
  activeWorksheetId: worksheets[0].worksheetId,
  activeAnalysisSource: null,
  cleanedWorkingCopies: [],
  worksheets,
  tableMappings: worksheets.map((item) => ({
    sheetName: item.sheetName,
    tableName: item.tableName,
    originalIndex: item.originalIndex,
  })),
  relationshipCandidates: [],
  acceptedRelationshipContracts: [],
  ingestionProfile: {
    maxWorksheets: 10,
    maxRowsPerWorksheetProfile: 1000,
    maxColumnsPerWorksheet: 100,
    maxRelationshipSampleRows: 100,
    maxPreviewRows: 100,
    profilingStrategy: "metadata-only",
  },
  normalization: {
    version: 1,
    normalizedAt: "2026-01-01T00:00:00.000Z",
    status: "normalized",
    warnings: [],
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const dataset: DatasetMetadata = {
  dataset_id: "dataset:adaptive",
  filename: "adaptive.xlsx",
  original_filename: "adaptive.xlsx",
  table_name: "orders",
  uploaded_at: "2026-01-01T00:00:00.000Z",
  row_count: 10,
  column_count: worksheets[0].columnCount,
  schema: worksheets[0].schema,
  workbook_metadata: workbook,
};

const staticRecommendation: SqlTemplateRecommendation = {
  id: "static:orders",
  kind: "report",
  title: "Orders by customer",
  description: "Static grounded match.",
  sql: 'SELECT "customer_id", COUNT(*) FROM "orders" GROUP BY "customer_id";',
  score: 10,
  reasons: ["Existing match."],
  support: "supported",
};

const businessSqlPreview = (
  status: BusinessSqlRenderPreview["status"],
): BusinessSqlRenderPreview => ({
  status,
  title: status === "ready" ? "SQL preview ready" : "SQL preview not ready",
  body: status === "ready" ? "Rendered SQL is available." : "SQL cannot be previewed yet.",
  sql: status === "ready" ? 'SELECT COUNT(*) AS row_count FROM "orders";' : null,
  planId: `plan:${status}`,
  rendererTarget: "duckdb",
  guidanceDialect: "duckdb",
  reasons: status === "ready" ? [] : ["Planner needs more metadata."],
  warnings: [],
  actions: {
    canCopySql: status === "ready",
    canInsertSql: false,
    canRunSql: false,
  },
});

const createState = (overrides: Partial<Parameters<typeof createAdaptiveReportProposalFallback>[0]> = {}) =>
  createAdaptiveReportProposalFallback({
    taskPrompt: "Count orders by customer",
    dataset,
    selectedDialect: "duckdb",
    appliedScopeLabels: ["orders", "customers"],
    recommendations: [],
    ...overrides,
  });

const businessScopeSelections = worksheets.map((item) => ({
  worksheetId: item.worksheetId,
  sourceType: "original" as const,
  tableName: item.tableName,
  originalTableName: item.tableName,
}));

const createTaskAssistState = (
  overrides: Partial<Parameters<typeof createTaskAssistAdaptiveReportProposalFallback>[0]> = {},
) =>
  createTaskAssistAdaptiveReportProposalFallback({
    taskPrompt: "Count orders by customer",
    dataset,
    selectedDialect: "duckdb",
    appliedScopeLabels: ["orders", "customers"],
    recommendations: [],
    generatedDraftCount: 0,
    ...overrides,
  });

const createBusinessSqlPreviewState = (
  overrides: Partial<Parameters<typeof createBusinessSqlPreviewAdaptiveReportProposalFallback>[0]> = {},
) =>
  createBusinessSqlPreviewAdaptiveReportProposalFallback({
    taskPrompt: "Count orders by customer",
    dataset,
    selectedDialect: "duckdb",
    appliedScopeSelections: businessScopeSelections,
    preview: businessSqlPreview("needs_review"),
    ...overrides,
  });

const expectDisabled = (state: AdaptiveReportProposalFallbackState): string[] => [
  ...(state.insertDisabled ? [] : ["Insert must remain disabled."]),
  ...(state.runDisabled ? [] : ["Run must remain disabled."]),
  ...(state.proposal?.sql === null || state.proposal === null
    ? []
    : ["Adaptive fallback must not expose SQL."]),
  ...(state.proposal?.canInsertSql === false || state.proposal === null
    ? []
    : ["Adaptive proposal insert capability must stay disabled."]),
  ...(state.proposal?.canRunSql === false || state.proposal === null
    ? []
    : ["Adaptive proposal run capability must stay disabled."]),
  ...(state.proposal?.renderer.canRender === false || state.proposal === null
    ? []
    : ["Adaptive proposal render capability must stay disabled."]),
];

const fixtures: Fixture[] = [
  {
    name: "no static match with prompt and scope shows adaptive proposal fallback",
    state: createState(),
    assert: (state) => [
      ...(state.shouldShow ? [] : ["Expected adaptive fallback to show."]),
      ...(state.reason === "available" ? [] : ["Expected available fallback reason."]),
      ...(state.proposal ? [] : ["Expected proposal."]),
      ...expectDisabled(state),
    ],
  },
  {
    name: "existing static grounded matches remain unchanged and suppress fallback",
    state: createState({ recommendations: [staticRecommendation] }),
    assert: (state) => [
      ...(state.shouldShow ? ["Fallback must not show when static matches exist."] : []),
      ...(state.reason === "has_static_matches" ? [] : ["Expected static-match suppression reason."]),
      ...(state.proposal === null ? [] : ["Static matches must not be wrapped as adaptive proposals."]),
      ...expectDisabled(state),
    ],
  },
  {
    name: "adaptive proposal exposes no SQL",
    state: createState(),
    assert: (state) => [
      ...(state.proposal?.sql === null ? [] : ["Expected null SQL."]),
      ...(state.proposal?.renderer.status === "not_rendered" ? [] : ["Expected not_rendered status."]),
      ...expectDisabled(state),
    ],
  },
  {
    name: "insert remains disabled",
    state: createState(),
    assert: expectDisabled,
  },
  {
    name: "run remains disabled",
    state: createState(),
    assert: expectDisabled,
  },
  {
    name: "missing scope does not show misleading proposal",
    state: createState({ appliedScopeLabels: [] }),
    assert: (state) => [
      ...(state.shouldShow ? ["Fallback must not show without scope."] : []),
      ...(state.reason === "missing_scope" ? [] : ["Expected missing_scope reason."]),
      ...(state.proposal === null ? [] : ["Missing scope must not expose proposal."]),
      ...expectDisabled(state),
    ],
  },
  {
    name: "missing prompt does not show misleading proposal",
    state: createState({ taskPrompt: "" }),
    assert: (state) => [
      ...(state.shouldShow ? ["Fallback must not show without prompt."] : []),
      ...(state.reason === "missing_prompt" ? [] : ["Expected missing_prompt reason."]),
      ...(state.proposal === null ? [] : ["Missing prompt must not expose proposal."]),
      ...expectDisabled(state),
    ],
  },
  {
    name: "report/template insertion behavior remains out of adapter scope",
    state: createState({ recommendations: [staticRecommendation] }),
    assert: (state) => [
      ...(state.reason === "has_static_matches" ? [] : ["Expected static recommendation to stay primary."]),
      ...(staticRecommendation.sql ? [] : ["Fixture static recommendation should still own SQL."]),
      ...(state.proposal === null ? [] : ["Adapter must not convert static SQL into proposal SQL."]),
      ...expectDisabled(state),
    ],
  },
  {
    name: "active editor draft is not represented or mutated",
    state: createState(),
    assert: (state) => [
      ...(JSON.stringify(state).includes("activeSqlDraft")
        ? ["Fallback state must not represent active editor draft."]
        : []),
      ...expectDisabled(state),
    ],
  },
  {
    name: "Task Assist no grounded match with prompt and scope shows adaptive proposal",
    state: createTaskAssistState(),
    assert: (state) => [
      ...(state.shouldShow ? [] : ["Expected Task Assist adaptive fallback to show."]),
      ...(state.reason === "available" ? [] : ["Expected Task Assist available reason."]),
      ...(state.proposal ? [] : ["Expected Task Assist proposal."]),
      ...expectDisabled(state),
    ],
  },
  {
    name: "existing grounded Task Assist recommendations suppress fallback",
    state: createTaskAssistState({ recommendations: [staticRecommendation] }),
    assert: (state) => [
      ...(state.shouldShow ? ["Task Assist fallback must not show when grounded matches exist."] : []),
      ...(state.reason === "has_static_matches" ? [] : ["Expected Task Assist static-match suppression reason."]),
      ...(state.proposal === null ? [] : ["Task Assist matches must not become adaptive proposals."]),
      ...expectDisabled(state),
    ],
  },
  {
    name: "existing generated Task Assist drafts suppress fallback",
    state: createTaskAssistState({ generatedDraftCount: 1 }),
    assert: (state) => [
      ...(state.shouldShow ? ["Task Assist fallback must not show when generated drafts exist."] : []),
      ...(state.reason === "has_static_matches" ? [] : ["Expected generated draft suppression reason."]),
      ...(state.proposal === null ? [] : ["Generated drafts must not become adaptive proposals."]),
      ...expectDisabled(state),
    ],
  },
  {
    name: "Task Assist adaptive proposal exposes no SQL",
    state: createTaskAssistState(),
    assert: (state) => [
      ...(state.proposal?.sql === null ? [] : ["Expected null SQL for Task Assist fallback."]),
      ...(state.proposal?.renderer.status === "not_rendered" ? [] : ["Expected Task Assist not_rendered status."]),
      ...expectDisabled(state),
    ],
  },
  {
    name: "Task Assist missing scope does not show misleading proposal",
    state: createTaskAssistState({ appliedScopeLabels: [] }),
    assert: (state) => [
      ...(state.shouldShow ? ["Task Assist fallback must not show without scope."] : []),
      ...(state.reason === "missing_scope" ? [] : ["Expected Task Assist missing_scope reason."]),
      ...(state.proposal === null ? [] : ["Missing Task Assist scope must not expose proposal."]),
      ...expectDisabled(state),
    ],
  },
  {
    name: "Task Assist missing prompt does not show misleading proposal",
    state: createTaskAssistState({ taskPrompt: "" }),
    assert: (state) => [
      ...(state.shouldShow ? ["Task Assist fallback must not show without prompt."] : []),
      ...(state.reason === "missing_prompt" ? [] : ["Expected Task Assist missing_prompt reason."]),
      ...(state.proposal === null ? [] : ["Missing Task Assist prompt must not expose proposal."]),
      ...expectDisabled(state),
    ],
  },
  {
    name: "Task Assist active editor draft is not represented or mutated",
    state: createTaskAssistState(),
    assert: (state) => [
      ...(JSON.stringify(state).includes("activeSqlDraft")
        ? ["Task Assist fallback state must not represent active editor draft."]
        : []),
      ...expectDisabled(state),
    ],
  },
  {
    name: "Business SQL ready preview suppresses adaptive fallback",
    state: createBusinessSqlPreviewState({ preview: businessSqlPreview("ready") }),
    assert: (state) => [
      ...(state.shouldShow ? ["Business SQL ready preview must suppress adaptive fallback."] : []),
      ...(state.reason === "has_ready_preview" ? [] : ["Expected ready-preview suppression reason."]),
      ...(state.proposal === null ? [] : ["Ready Business SQL must not become an adaptive proposal."]),
      ...expectDisabled(state),
    ],
  },
  {
    name: "Business SQL needs_review with prompt and scope shows adaptive proposal",
    state: createBusinessSqlPreviewState({ preview: businessSqlPreview("needs_review") }),
    assert: (state) => [
      ...(state.shouldShow ? [] : ["Expected needs_review Business SQL fallback to show."]),
      ...(state.reason === "available" ? [] : ["Expected Business SQL available reason."]),
      ...(state.proposal ? [] : ["Expected Business SQL adaptive proposal."]),
      ...expectDisabled(state),
    ],
  },
  {
    name: "Business SQL blocked with prompt and scope shows adaptive proposal",
    state: createBusinessSqlPreviewState({ preview: businessSqlPreview("blocked") }),
    assert: (state) => [
      ...(state.shouldShow ? [] : ["Expected blocked Business SQL fallback to show."]),
      ...(state.reason === "available" ? [] : ["Expected blocked Business SQL available reason."]),
      ...(state.proposal ? [] : ["Expected blocked Business SQL adaptive proposal."]),
      ...expectDisabled(state),
    ],
  },
  {
    name: "Business SQL missing prompt does not show misleading proposal",
    state: createBusinessSqlPreviewState({ taskPrompt: "" }),
    assert: (state) => [
      ...(state.shouldShow ? ["Business SQL fallback must not show without prompt."] : []),
      ...(state.reason === "missing_prompt" ? [] : ["Expected Business SQL missing_prompt reason."]),
      ...(state.proposal === null ? [] : ["Missing Business SQL prompt must not expose proposal."]),
      ...expectDisabled(state),
    ],
  },
  {
    name: "Business SQL missing scope does not show misleading proposal",
    state: createBusinessSqlPreviewState({ appliedScopeSelections: [] }),
    assert: (state) => [
      ...(state.shouldShow ? ["Business SQL fallback must not show without scope."] : []),
      ...(state.reason === "missing_scope" ? [] : ["Expected Business SQL missing_scope reason."]),
      ...(state.proposal === null ? [] : ["Missing Business SQL scope must not expose proposal."]),
      ...expectDisabled(state),
    ],
  },
  {
    name: "Business SQL adaptive proposal exposes no SQL",
    state: createBusinessSqlPreviewState(),
    assert: (state) => [
      ...(state.proposal?.sql === null ? [] : ["Expected null SQL for Business SQL adaptive fallback."]),
      ...(state.proposal?.renderer.status === "not_rendered"
        ? []
        : ["Expected Business SQL adaptive fallback not_rendered status."]),
      ...expectDisabled(state),
    ],
  },
  {
    name: "Business SQL active editor draft is not represented or mutated",
    state: createBusinessSqlPreviewState(),
    assert: (state) => [
      ...(JSON.stringify(state).includes("activeSqlDraft")
        ? ["Business SQL fallback state must not represent active editor draft."]
        : []),
      ...expectDisabled(state),
    ],
  },
];

export function runAdaptiveReportProposalUiAdapterFixtures(): AdaptiveReportProposalUiAdapterFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.assert(fixture.state);
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

export const allAdaptiveReportProposalUiAdapterFixturesPass = (): boolean =>
  runAdaptiveReportProposalUiAdapterFixtures().failed.length === 0;
