/**
 * T-14B-Fix-1 - SQL tab source display label fixtures.
 *
 * Pure fixture runner only. No source switching, worksheet-scope mutation,
 * Monaco/editor mutation, Run Query, backend/API, execution, Business SQL,
 * adaptive proposal, provider, or preview behavior.
 */

import type { DatasetMetadata, SchemaColumn } from "../../../dataset/datasetTypes";
import type { WorkbookMetadata, WorksheetMetadata } from "../../../workbook";
import { createSqlSourceLineModel } from "../sqlSourceLineAdapter";
import { resolveSqlTabSourceContext } from "../resolveSqlTabSourceContext";
import type { SqlWorkspaceTab } from "../sqlTabsTypes";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type ResolveSqlTabSourceContextFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type Fixture = {
  name: string;
  assert: () => string[];
};

const column = (name: string): SchemaColumn => ({
  name,
  type: "string",
  inferred_type: "text",
  null_count: 0,
  unique_count: 1,
  sample_values: [],
});

const worksheet = ({
  worksheetId,
  displayName,
  sheetName,
  tableName,
}: {
  worksheetId: string;
  displayName: string;
  sheetName: string;
  tableName: string;
}): WorksheetMetadata => ({
  worksheetId,
  workbookId: "workbook:source-context-fixture",
  sheetName,
  displayName,
  tableName,
  originalIndex: 0,
  status: "ready",
  schema: [column("id")],
  rowCount: 10,
  columnCount: 1,
  visibleColumns: ["id"],
  hiddenColumns: [],
  normalization: {
    version: 1,
    normalizedAt: "2026-01-01T00:00:00.000Z",
    headerRowIndex: null,
    skippedLeadingRows: null,
    headerDetectionStrategy: null,
    headerDetectionConfidence: null,
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

const managersWorksheet = worksheet({
  worksheetId: "worksheet:managers",
  displayName: "managers",
  sheetName: "Managers",
  tableName: "ws_1_managers",
});

const leasesWorksheet = worksheet({
  worksheetId: "worksheet:leases",
  displayName: "leases",
  sheetName: "Leases",
  tableName: "leases",
});

const workbook = (worksheets: WorksheetMetadata[] = [managersWorksheet]): WorkbookMetadata => ({
  workbookId: "workbook:source-context-fixture",
  workspaceId: null,
  name: "Property Management Company (1).xlsx",
  status: "ready",
  sourceFile: {
    originalFilename: "Property Management Company (1).xlsx",
    storedPath: null,
    mimeType: null,
    byteSize: null,
    uploadedAt: "2026-01-01T00:00:00.000Z",
  },
  worksheetIds: worksheets.map((item) => item.worksheetId),
  activeWorksheetId: managersWorksheet.worksheetId,
  activeAnalysisSource: {
    type: "original",
    worksheetId: managersWorksheet.worksheetId,
    tableName: managersWorksheet.tableName,
    originalTableName: managersWorksheet.tableName,
    activatedAt: "2026-01-01T00:00:00.000Z",
  },
  cleanedWorkingCopies: [],
  worksheets,
  tableMappings: [],
  relationshipCandidates: [],
  acceptedRelationshipContracts: [],
  ingestionProfile: {
    maxWorksheets: 50,
    maxRowsPerWorksheetProfile: 1000,
    maxColumnsPerWorksheet: 200,
    maxRelationshipSampleRows: 1000,
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
});

const dataset = (input?: {
  worksheets?: WorksheetMetadata[];
  tableName?: string;
  workbookMetadata?: WorkbookMetadata | null;
}): DatasetMetadata => {
  const tableName = input?.tableName ?? managersWorksheet.tableName;
  const metadata: DatasetMetadata = {
    dataset_id: "dataset:source-context-fixture",
    filename: "Property Management Company (1).xlsx",
    original_filename: "Property Management Company (1).xlsx",
    table_name: tableName,
    uploaded_at: "2026-01-01T00:00:00.000Z",
    row_count: 10,
    column_count: 1,
    schema: [column("id")],
  };

  if (input?.workbookMetadata !== null) {
    metadata.workbook_metadata = input?.workbookMetadata ?? workbook(input?.worksheets);
  }

  return metadata;
};

const tab = (input?: Partial<SqlWorkspaceTab>): SqlWorkspaceTab => ({
  id: "active-draft",
  title: "Query draft",
  worksheetId: managersWorksheet.worksheetId,
  sourceType: "original",
  tableName: managersWorksheet.tableName,
  originalTableName: managersWorksheet.tableName,
  cleanedTableName: undefined,
  selectedScopeSelections: [],
  appliedScopeSelections: [],
  sqlDraft: "SELECT * FROM ws_1_managers LIMIT 100;",
  dialect: "duckdb",
  previewResult: {
    columns: [],
    rows: [],
    message: "No results yet.",
    errorInsight: null,
  },
  editorStatus: "idle",
  isDirty: false,
  createdFrom: "manual",
  ...input,
});

const expectNoQueryDraftLabel = (value: string | null): string[] =>
  value?.includes("Query draft") ? [`Expected Query draft to be excluded, received: ${value}`] : [];

const fixtures: Fixture[] = [
  {
    name: "worksheet display name wins over SQL tab title",
    assert: () => {
      const context = resolveSqlTabSourceContext(dataset(), tab());
      return [
        ...(context.sourceLabel === "managers"
          ? []
          : [`Expected managers source label, received ${context.sourceLabel}.`]),
        ...expectNoQueryDraftLabel(context.sourceLabel),
      ];
    },
  },
  {
    name: "worksheet sheet name wins when display name is missing",
    assert: () => {
      const sheetOnlyWorksheet = worksheet({
        worksheetId: managersWorksheet.worksheetId,
        displayName: "",
        sheetName: "Managers",
        tableName: managersWorksheet.tableName,
      });
      const context = resolveSqlTabSourceContext(
        dataset({ worksheets: [sheetOnlyWorksheet] }),
        tab(),
      );

      return [
        ...(context.sourceLabel === "Managers"
          ? []
          : [`Expected Managers sheet-name label, received ${context.sourceLabel}.`]),
        ...expectNoQueryDraftLabel(context.sourceLabel),
      ];
    },
  },
  {
    name: "source table name wins when worksheet label metadata is missing",
    assert: () => {
      const tableOnlyWorksheet = worksheet({
        worksheetId: managersWorksheet.worksheetId,
        displayName: "",
        sheetName: "",
        tableName: managersWorksheet.tableName,
      });
      const context = resolveSqlTabSourceContext(
        dataset({ worksheets: [tableOnlyWorksheet] }),
        tab(),
      );

      return [
        ...(context.sourceLabel === "ws_1_managers"
          ? []
          : [`Expected ws_1_managers table label, received ${context.sourceLabel}.`]),
        ...expectNoQueryDraftLabel(context.sourceLabel),
      ];
    },
  },
  {
    name: "SQL tab title is final fallback when source metadata is missing",
    assert: () => {
      const context = resolveSqlTabSourceContext(
        dataset({ tableName: "", workbookMetadata: null }),
        tab({
          worksheetId: undefined,
          tableName: "",
          originalTableName: "",
          title: "Query draft",
        }),
      );

      return context.sourceLabel === "Query draft"
        ? []
        : [`Expected Query draft only as final fallback, received ${context.sourceLabel}.`];
    },
  },
  {
    name: "source line and workbook-default copy receive corrected label",
    assert: () => {
      const context = resolveSqlTabSourceContext(dataset(), tab());
      const model = createSqlSourceLineModel({
        dataset: dataset(),
        workbookLabel: "Property Management Company (1).xlsx",
        activeSourceLabel: context.sourceLabel,
        activeSourceTableLabel: context.tableName,
        activeSourceKindLabel: "Original",
        appliedScopeSummary: null,
        appliedScopeCount: 0,
      });

      return [
        ...(model.text ===
        "Source for this tab: Property Management Company (1).xlsx › managers · Original"
          ? []
          : [`Expected source line to use managers, received ${model.text}.`]),
        ...(model.emptyScopeCopy ===
        "Using workbook default: managers. Choose worksheets only when this tab should use a narrower or different planning scope."
          ? []
          : [`Expected workbook-default copy to use managers, received ${model.emptyScopeCopy}.`]),
        ...(model.scopeChipLabel === "Using workbook default · managers"
          ? []
          : [`Expected workbook-default chip to use managers, received ${model.scopeChipLabel}.`]),
        ...expectNoQueryDraftLabel(model.text),
        ...expectNoQueryDraftLabel(model.emptyScopeCopy),
        ...expectNoQueryDraftLabel(model.scopeChipLabel),
      ];
    },
  },
  {
    name: "mismatch warning still uses resolved source label",
    assert: () => {
      const context = resolveSqlTabSourceContext(
        dataset({ worksheets: [managersWorksheet, leasesWorksheet] }),
        tab({
          worksheetId: leasesWorksheet.worksheetId,
          tableName: leasesWorksheet.tableName,
          originalTableName: leasesWorksheet.tableName,
          title: "Query draft",
        }),
      );

      return [
        ...(context.isExecutableWithCurrentDataset === false
          ? []
          : ["Expected mismatch fixture to remain non-executable with current dataset."]),
        ...(context.mismatchWarning?.includes("leases (leases)")
          ? []
          : [`Expected mismatch warning to use leases label, received ${context.mismatchWarning}.`]),
        ...(context.mismatchWarning?.includes("managers (ws_1_managers)")
          ? []
          : [`Expected mismatch warning to keep global active source copy, received ${context.mismatchWarning}.`]),
        ...expectNoQueryDraftLabel(context.mismatchWarning),
      ];
    },
  },
];

export function runResolveSqlTabSourceContextFixtures(): ResolveSqlTabSourceContextFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.assert();
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

export const allResolveSqlTabSourceContextFixturesPass = (): boolean =>
  runResolveSqlTabSourceContextFixtures().failed.length === 0;
