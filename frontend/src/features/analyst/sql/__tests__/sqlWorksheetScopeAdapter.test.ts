/**
 * T-14B - Inspect SQL Ask bar and worksheet-scope popover fixtures.
 *
 * Pure fixture runner only. No SQL Context toggle, active source change,
 * Monaco/editor mutation, Run Query, backend/API, execution, Business SQL,
 * adaptive proposal, or provider behavior.
 */

import type { DatasetMetadata, SchemaColumn } from "../../../dataset/datasetTypes";
import type {
  AnalysisScopeSelection,
  WorkbookMetadata,
  WorksheetMetadata,
} from "../../../workbook";
import {
  createSqlWorksheetScopeModel,
  hasSameSqlWorksheetScopeSelections,
  setSqlWorksheetScopeSourceType,
  toggleSqlWorksheetScopeSelection,
  type SqlWorksheetScopeModel,
} from "../sqlWorksheetScopeAdapter";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type SqlWorksheetScopeAdapterFixtureReport = {
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

const worksheet = (
  worksheetId: string,
  displayName: string,
  tableName: string,
): WorksheetMetadata => ({
  worksheetId,
  workbookId: "workbook:scope-fixture",
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

const managersWorksheet = worksheet("worksheet:managers", "Managers", "managers");
const leasesWorksheet = worksheet("worksheet:leases", "Leases", "leases");
const tenantsWorksheet = worksheet("worksheet:tenants", "Tenants", "tenants");

const workbook = (withCleaned = true): WorkbookMetadata => ({
  workbookId: "workbook:scope-fixture",
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
  worksheetIds: [
    managersWorksheet.worksheetId,
    leasesWorksheet.worksheetId,
    tenantsWorksheet.worksheetId,
  ],
  activeWorksheetId: managersWorksheet.worksheetId,
  activeAnalysisSource: {
    type: "original",
    worksheetId: managersWorksheet.worksheetId,
    tableName: "managers",
    originalTableName: "managers",
    activatedAt: "2026-01-01T00:00:00.000Z",
  },
  cleanedWorkingCopies: withCleaned
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
  worksheets: [managersWorksheet, leasesWorksheet, tenantsWorksheet],
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

const dataset = (withCleaned = true): DatasetMetadata => ({
  dataset_id: "dataset:scope-fixture",
  filename: "Property Management Company.xlsx",
  original_filename: "Property Management Company.xlsx",
  table_name: "managers",
  uploaded_at: "2026-01-01T00:00:00.000Z",
  row_count: 10,
  column_count: 1,
  schema: [column("id")],
  workbook_metadata: workbook(withCleaned),
});

const managersSelection: AnalysisScopeSelection = {
  worksheetId: managersWorksheet.worksheetId,
  sourceType: "original",
  tableName: "managers",
  originalTableName: "managers",
};

const leasesCleanSelection: AnalysisScopeSelection = {
  worksheetId: leasesWorksheet.worksheetId,
  sourceType: "cleaned_working_copy",
  tableName: "leases_clean",
  originalTableName: "leases",
  cleanedTableName: "leases_clean",
};

const createModel = (
  selectedScopeSelections: AnalysisScopeSelection[] = [],
  appliedScopeSummary: string | null = null,
  appliedScopeCount = 0,
): SqlWorksheetScopeModel =>
  createSqlWorksheetScopeModel({
    dataset: dataset(),
    selectedScopeSelections,
    appliedScopeSummary,
    appliedScopeCount,
    activeSourceLabel: "Managers",
  });

const expectNoBehaviorChange = (model: SqlWorksheetScopeModel): string[] => [
  ...(model.noToggleContext === true ? [] : ["Manage scope must not toggle SQL Context."]),
  ...(model.noActiveSourceChange === true ? [] : ["Manage scope must not change active source."]),
  ...(model.noEditorMutation === true ? [] : ["Manage scope must not mutate editor draft."]),
  ...(model.noRunQuery === true ? [] : ["Manage scope must not call Run Query."]),
  ...(model.noBackendCall === true ? [] : ["Manage scope must not call backend/API."]),
];

const fixtures: Fixture[] = [
  {
    name: "ask bar copy contract is explicit",
    assert: () => [
      ...("Ask FiltraQueri" === "Ask FiltraQueri" ? [] : ["Expected Ask label."]),
      ...("Describe the analysis you want, like “Count leases by status”".includes("Count leases by status")
        ? []
        : ["Expected business-question placeholder."]),
    ],
  },
  {
    name: "scope model exposes manage copy and workbook default copy",
    assert: () => {
      const model = createModel();
      return [
        ...(model.title === "Manage worksheet scope" ? [] : ["Expected manage title."]),
        ...(model.helperCopy.includes("planning context") &&
        model.helperCopy.includes("does not change the executable source")
          ? []
          : ["Expected planning-context helper copy."]),
        ...(model.emptyCopy ===
        "Using workbook default: Managers. Choose worksheets only when this tab should use a narrower or different planning scope."
          ? []
          : ["Expected workbook-default empty copy."]),
        ...(model.appliedLabel === "Using workbook default · Managers"
          ? []
          : ["Expected workbook-default chip label."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "original worksheet options appear",
    assert: () => {
      const model = createModel();
      return [
        ...(model.options.some(
          (option) =>
            option.worksheetId === managersWorksheet.worksheetId &&
            option.sourceLabel === "Original worksheet" &&
            option.tableName === "managers",
        )
          ? []
          : ["Expected original worksheet option."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "cleaned working copy options appear only when available",
    assert: () => {
      const model = createModel([leasesCleanSelection]);
      const noCleanedModel = createSqlWorksheetScopeModel({
        dataset: dataset(false),
        selectedScopeSelections: [],
        appliedScopeSummary: null,
        appliedScopeCount: 0,
        activeSourceLabel: "Managers",
      });
      return [
        ...(model.options.some(
          (option) =>
            option.worksheetId === leasesWorksheet.worksheetId &&
            option.cleanedCopyAvailable &&
            option.sourceLabel === "Cleaned working copy" &&
            option.tableName === "leases_clean",
        )
          ? []
          : ["Expected cleaned working copy option when selected and available."]),
        ...(noCleanedModel.options.every((option) => !option.cleanedCopyAvailable)
          ? []
          : ["Expected unavailable cleaned copies to be hidden from source choices."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "multiple worksheet selections map to existing scope shape",
    assert: () => {
      const first = toggleSqlWorksheetScopeSelection({
        dataset: dataset(),
        selectedScopeSelections: [],
        worksheetId: managersWorksheet.worksheetId,
      });
      const second = toggleSqlWorksheetScopeSelection({
        dataset: dataset(),
        selectedScopeSelections: first,
        worksheetId: leasesWorksheet.worksheetId,
      });
      return [
        ...(second.length === 2 ? [] : ["Expected two selected worksheets."]),
        ...(second.every((selection) => selection.worksheetId && selection.tableName)
          ? []
          : ["Expected AnalysisScopeSelection shape."]),
      ];
    },
  },
  {
    name: "source type switching preserves one selection per worksheet",
    assert: () => {
      const next = setSqlWorksheetScopeSourceType({
        dataset: dataset(),
        selectedScopeSelections: [managersSelection],
        worksheetId: leasesWorksheet.worksheetId,
        sourceType: "cleaned_working_copy",
      });
      const switched = setSqlWorksheetScopeSourceType({
        dataset: dataset(),
        selectedScopeSelections: next,
        worksheetId: leasesWorksheet.worksheetId,
        sourceType: "original",
      });
      return [
        ...(next.find((selection) => selection.worksheetId === leasesWorksheet.worksheetId)?.tableName ===
        "leases_clean"
          ? []
          : ["Expected cleaned table selection."]),
        ...(switched.filter((selection) => selection.worksheetId === leasesWorksheet.worksheetId).length === 1
          ? []
          : ["Expected one selection per worksheet."]),
        ...(switched.find((selection) => selection.worksheetId === leasesWorksheet.worksheetId)?.tableName ===
        "leases"
          ? []
          : ["Expected original table after switching back."]),
      ];
    },
  },
  {
    name: "applied and selected-not-applied states stay explicit",
    assert: () => {
      const selectedModel = createModel([managersSelection]);
      const appliedModel = createModel([managersSelection], "Managers, Leases", 2);
      return [
        ...(selectedModel.pendingLabel === "1 selected, not applied"
          ? []
          : ["Expected selected-not-applied label."]),
        ...(appliedModel.appliedLabel === "Applied scope · Managers, Leases"
          ? []
          : ["Expected applied scope label."]),
        ...expectNoBehaviorChange(appliedModel),
      ];
    },
  },
  {
    name: "selection comparison is deterministic",
    assert: () => [
      ...(hasSameSqlWorksheetScopeSelections(
        [managersSelection, leasesCleanSelection],
        [leasesCleanSelection, managersSelection],
      )
        ? []
        : ["Expected order-insensitive selection comparison."]),
      ...(!hasSameSqlWorksheetScopeSelections([managersSelection], [leasesCleanSelection])
        ? []
        : ["Expected different selections not to match."]),
    ],
  },
];

export function runSqlWorksheetScopeAdapterFixtures(): SqlWorksheetScopeAdapterFixtureReport {
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

export const allSqlWorksheetScopeAdapterFixturesPass = (): boolean =>
  runSqlWorksheetScopeAdapterFixtures().failed.length === 0;
