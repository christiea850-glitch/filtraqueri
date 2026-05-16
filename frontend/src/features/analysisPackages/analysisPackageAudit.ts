import type {
  AnalysisPackageAuditEntry,
  AnalysisPackageBuildInput,
} from "./analysisPackageTypes";

export const buildAnalysisPackageAuditTrail = ({
  dataset,
  activeResultModel,
  queryHistory,
}: AnalysisPackageBuildInput): AnalysisPackageAuditEntry[] => {
  const createdAt = new Date().toISOString();
  const entries: AnalysisPackageAuditEntry[] = [];

  if (dataset) {
    entries.push({
      auditId: `audit:${dataset.dataset_id}:dataset`,
      label: "Dataset reference",
      description: `${dataset.original_filename} with ${dataset.row_count.toLocaleString()} rows and ${dataset.column_count.toLocaleString()} columns.`,
      relatedDatasetId: dataset.dataset_id,
      relatedResultSource: null,
      createdAt,
    });
  }

  if (activeResultModel) {
    entries.push({
      auditId: `audit:${activeResultModel.datasetId}:result:${activeResultModel.sourceTab}`,
      label: "Result reference",
      description: `${activeResultModel.sourceType} result with ${activeResultModel.totalCount.toLocaleString()} rows.`,
      relatedDatasetId: activeResultModel.datasetId,
      relatedResultSource: activeResultModel.sourceTab,
      createdAt,
    });
  }

  queryHistory.slice(0, 6).forEach((item) => {
    entries.push({
      auditId: `audit:history:${item.id}`,
      label: item.action,
      description: item.detail,
      relatedDatasetId: dataset?.dataset_id || null,
      relatedResultSource: item.action,
      createdAt: item.timestamp || createdAt,
    });
  });

  return entries;
};
