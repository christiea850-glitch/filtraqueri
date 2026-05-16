import type {
  AnalysisPackageBuildInput,
  AnalysisPackageDatasetReference,
  AnalysisPackageResultReference,
  AnalysisPackageTrailReference,
  AnalysisPackageWorkbookReference,
} from "./analysisPackageTypes";

export const buildDatasetReference = ({
  dataset,
}: AnalysisPackageBuildInput): AnalysisPackageDatasetReference | null =>
  dataset
    ? {
        datasetId: dataset.dataset_id,
        datasetName: dataset.original_filename,
        rowCount: dataset.row_count,
        columnCount: dataset.column_count,
      }
    : null;

export const buildWorkbookReference = ({
  dataset,
}: AnalysisPackageBuildInput): AnalysisPackageWorkbookReference | null => {
  const workbook = dataset?.workbook_metadata;
  if (!workbook) return null;

  return {
    workbookId: workbook.workbookId,
    workbookName: workbook.name,
    activeWorksheetId: workbook.activeWorksheetId,
    worksheetReferences: workbook.worksheets.map((worksheet) => ({
      worksheetId: worksheet.worksheetId,
      worksheetName: worksheet.displayName || worksheet.sheetName,
      rowCount: worksheet.rowCount,
    })),
  };
};

export const buildResultReference = ({
  activeResultModel,
}: AnalysisPackageBuildInput): AnalysisPackageResultReference | null =>
  activeResultModel
    ? {
        sourceType: activeResultModel.sourceType,
        sourceTab: activeResultModel.sourceTab,
        rowCount: activeResultModel.totalCount,
        columnCount: activeResultModel.columns.length,
        grouping: activeResultModel.grouping.columns,
        filters: activeResultModel.filters.activeLabels,
      }
    : null;

export const buildTrailReferences = ({
  investigationReport,
}: AnalysisPackageBuildInput): AnalysisPackageTrailReference[] =>
  investigationReport?.flow.steps.map((step) => ({
    stage: step.stage,
    label: step.label,
    guidance: step.guidance,
  })) || [];
