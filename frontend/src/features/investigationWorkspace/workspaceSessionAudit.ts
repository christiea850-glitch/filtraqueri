import type {
  InvestigationSessionAuditEntry,
  InvestigationWorkspaceBuildInput,
} from "./workspaceSessionTypes";

export const buildWorkspaceSessionAudit = ({
  dataset,
  activeResultModel,
  analysisPackagePlan,
  queryHistory,
}: InvestigationWorkspaceBuildInput): InvestigationSessionAuditEntry[] => {
  const createdAt = new Date().toISOString();
  const entries: InvestigationSessionAuditEntry[] = [];

  if (dataset) {
    entries.push({
      auditId: `workspace-audit:${dataset.dataset_id}:dataset`,
      label: "Dataset lineage",
      description: `${dataset.original_filename} is the active dataset reference.`,
      relatedDatasetId: dataset.dataset_id,
      relatedPackageId: analysisPackagePlan?.packageManifest.packageId || null,
      createdAt,
    });
  }

  if (activeResultModel) {
    entries.push({
      auditId: `workspace-audit:${activeResultModel.datasetId}:result`,
      label: "Result lineage",
      description: `${activeResultModel.sourceType} result reference captured for future reproducibility.`,
      relatedDatasetId: activeResultModel.datasetId,
      relatedPackageId: analysisPackagePlan?.packageManifest.packageId || null,
      createdAt,
    });
  }

  queryHistory.slice(0, 5).forEach((item) => {
    entries.push({
      auditId: `workspace-audit:history:${item.id}`,
      label: item.action,
      description: item.detail,
      relatedDatasetId: dataset?.dataset_id || null,
      relatedPackageId: analysisPackagePlan?.packageManifest.packageId || null,
      createdAt: item.timestamp || createdAt,
    });
  });

  return entries;
};
