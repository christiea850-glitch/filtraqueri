/**
 * T-14A-1/T-14A-2 - Inspect SQL source line and workbook-default scope fixtures.
 *
 * Pure fixture runner only. No SQL Context toggle, Monaco/editor mutation,
 * Run Query, backend/API, execution, Business SQL, adaptive proposal, or
 * provider behavior.
 */

import type { DatasetMetadata, SchemaColumn } from "../../../dataset/datasetTypes";
import type { WorkbookMetadata, WorksheetMetadata } from "../../../workbook";
import {
  createSqlSourceLineModel,
  type SqlSourceLineModel,
} from "../sqlSourceLineAdapter";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type SqlSourceLineAdapterFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type Fixture = {
  name: string;
  model: SqlSourceLineModel;
  assert: (model: SqlSourceLineModel) => string[];
};

const column = (name: string): SchemaColumn => ({
  name,
  type: "string",
  inferred_type: "text",
  null_count: 0,
  unique_count: 1,
  sample_values: [],
});

const worksheet = (
  worksheetId: string,
  displayName: string,
  tableName: string,
): WorksheetMetadata => ({
  worksheetId,
  workbookId: "workbook:source-fixture",
  sheetName: displayName,
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

const leasesWorksheet = worksheet("worksheet:leases", "Leases", "leases");
const tenantsWorksheet = worksheet("worksheet:tenants", "Tenants", "tenants");

const workbook = (cleaned = true): WorkbookMetadata => ({
  workbookId: "workbook:source-fixture",
  workspaceId: null,
  name: "Property Management Company.xlsx",
  status: "ready",
  sourceFile: {
    originalFilename: "Property Management Company.xlsx",
    storedPath: null,
    mimeType: null,
    byteSize: null,
    uploadedAt: "2026-01-01T00:00:00.000Z",
  },
  worksheetIds: [leasesWorksheet.worksheetId, tenantsWorksheet.worksheetId],
  activeWorksheetId: leasesWorksheet.worksheetId,
  activeAnalysisSource: {
    type: cleaned ? "cleaned_working_copy" : "original",
    worksheetId: leasesWorksheet.worksheetId,
    tableName: cleaned ? "leases_clean" : "leases",
    originalTableName: "leases",
    activatedAt: "2026-01-01T00:00:00.000Z",
  },
  cleanedWorkingCopies: cleaned
    ? [
        {
          cleanedCopyId: "cleaned:leases",
          sourceWorksheetId: leasesWorksheet.worksheetId,
          sourceTableName: "leases",
          cleanedTableName: "leases_clean",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]
    : [],
  worksheets: [leasesWorksheet, tenantsWorksheet],
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

const dataset = (cleaned = true): DatasetMetadata => ({
  dataset_id: "dataset:source-fixture",
  filename: "Property Management Company.xlsx",
  original_filename: "Property Management Company.xlsx",
  table_name: cleaned ? "leases_clean" : "leases",
  uploaded_at: "2026-01-01T00:00:00.000Z",
  row_count: 10,
  column_count: 1,
  schema: [column("id")],
  workbook_metadata: workbook(cleaned),
});

const createModel = ({
  cleaned = true,
  appliedScopeSummary = null,
  appliedScopeCount = 0,
}: {
  cleaned?: boolean;
  appliedScopeSummary?: string | null;
  appliedScopeCount?: number;
} = {}) =>
  createSqlSourceLineModel({
    dataset: dataset(cleaned),
    workbookLabel: "Property Management Company.xlsx",
    activeSourceLabel: "Leases",
    activeSourceTableLabel: cleaned ? "leases_clean" : "leases",
    activeSourceKindLabel: cleaned ? "Cleaned" : "Original",
    appliedScopeSummary,
    appliedScopeCount,
  });

const expectNoBehaviorChange = (model: SqlSourceLineModel): string[] => [
  ...(model.noToggleContext === true ? [] : ["Source line must not toggle SQL Context."]),
  ...(model.noEditorMutation === true ? [] : ["Source line must not mutate editor draft."]),
  ...(model.noRunQuery === true ? [] : ["Source line must not call Run Query."]),
  ...(model.noBackendCall === true ? [] : ["Source line must not call backend/API."]),
];

const fixtures: Fixture[] = [
  {
    name: "source line renders workbook worksheet and original source",
    model: createModel({ cleaned: false }),
    assert: (model) => [
      ...(model.text === "Source for this tab: Property Management Company.xlsx › Leases · Original"
        ? []
        : ["Expected workbook + worksheet + original source line."]),
      ...expectNoBehaviorChange(model),
    ],
  },
  {
    name: "source line renders cleaned working copy",
    model: createModel(),
    assert: (model) => [
      ...(model.text === "Source for this tab: Property Management Company.xlsx › Leases · Cleaned"
        ? []
        : ["Expected cleaned source line."]),
      ...(model.options.some((option) => option.sourceKindLabel === "Cleaned" && option.tableName === "leases_clean")
        ? []
        : ["Expected cleaned working copy option."]),
      ...expectNoBehaviorChange(model),
    ],
  },
  {
    name: "no cleaned copy hides cleaned option and exposes helper",
    model: createModel({ cleaned: false }),
    assert: (model) => [
      ...(model.options.every((option) => option.sourceKindLabel !== "Cleaned")
        ? []
        : ["Expected unavailable cleaned option to be hidden."]),
      ...(model.noCleanedCopyHelper === "No cleaned working copy available for this worksheet."
        ? []
        : ["Expected no-cleaned-copy helper."]),
      ...expectNoBehaviorChange(model),
    ],
  },
  {
    name: "source option maps to existing source tab callback shape",
    model: createModel(),
    assert: (model) => {
      const cleanedOption = model.options.find((option) => option.sourceKindLabel === "Cleaned");
      return [
        ...(cleanedOption?.source.sourceType === "cleaned_working_copy"
          ? []
          : ["Expected cleaned source type."]),
        ...(cleanedOption?.source.tableName === "leases_clean"
          ? []
          : ["Expected cleaned table name."]),
        ...(cleanedOption?.source.originalTableName === "leases"
          ? []
          : ["Expected original table name."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "empty scope state says workbook default",
    model: createModel({ cleaned: false }),
    assert: (model) => [
      ...(model.emptyScopeCopy ===
      "Using workbook default: Leases. Choose worksheets only when this tab should use a narrower or different planning scope."
        ? []
        : ["Expected workbook default empty scope copy."]),
      ...(model.scopeChipLabel === "Using workbook default · Leases"
        ? []
        : ["Expected workbook default chip."]),
      ...(model.scopeChipLabel.includes("0 applied") ? ["Workbook default chip must not say 0 applied."] : []),
      ...expectNoBehaviorChange(model),
    ],
  },
  {
    name: "applied scope summary remains when applied scope exists",
    model: createModel({
      appliedScopeSummary: "Leases, Tenants",
      appliedScopeCount: 2,
    }),
    assert: (model) => [
      ...(model.scopeChipLabel === "Applied scope · Leases, Tenants"
        ? []
        : ["Expected applied scope chip."]),
      ...expectNoBehaviorChange(model),
    ],
  },
  {
    name: "fallback source line works without workbook label",
    model: createSqlSourceLineModel({
      dataset: null,
      workbookLabel: null,
      activeSourceLabel: null,
      activeSourceTableLabel: "uploaded_dataset",
      activeSourceKindLabel: null,
      appliedScopeSummary: null,
      appliedScopeCount: 0,
    }),
    assert: (model) => [
      ...(model.text === "Source for this tab: uploaded_dataset · Original"
        ? []
        : ["Expected source-table fallback line."]),
      ...expectNoBehaviorChange(model),
    ],
  },
];

export function runSqlSourceLineAdapterFixtures(): SqlSourceLineAdapterFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.assert(fixture.model);
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

export const allSqlSourceLineAdapterFixturesPass = (): boolean =>
  runSqlSourceLineAdapterFixtures().failed.length === 0;
