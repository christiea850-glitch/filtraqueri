import type { AnalysisPackageArtifactType } from "../analysisPackages";
import type {
  DeliverableHub,
  DeliverableHubItem,
  DeliverableHubItemType,
  InvestigationWorkspaceBuildInput,
  WorkspaceStorageReference,
} from "./workspaceSessionTypes";

const deliverableTypeFromArtifact = (
  artifactType: AnalysisPackageArtifactType,
): DeliverableHubItemType => {
  const map: Record<AnalysisPackageArtifactType, DeliverableHubItemType> = {
    report_summary: "report",
    result_export: "export",
    sql_script: "sql_draft",
    python_script: "python_script",
    r_script: "r_script",
    chart_image: "chart_snapshot",
    dashboard_snapshot: "chart_snapshot",
    workbook_snapshot: "workbook_snapshot",
    optimization_model: "optimization_output",
    audit_log: "audit_note",
    explanation_note: "investigation_explanation",
    investigation_timeline: "timeline",
  };
  return map[artifactType];
};

export const buildDeliverableHub = (
  input: InvestigationWorkspaceBuildInput,
  futureFolderReferences: WorkspaceStorageReference[],
): DeliverableHub => {
  const packageId = input.analysisPackagePlan?.packageManifest.packageId || null;
  const packageArtifacts = input.analysisPackagePlan?.packageManifest.artifactManifest || [];
  const items: DeliverableHubItem[] = packageArtifacts.map((artifact) => ({
    itemId: `deliverable:${artifact.artifactId}`,
    label: artifact.label,
    description: artifact.description,
    type: deliverableTypeFromArtifact(artifact.type),
    readiness:
      artifact.readiness === "ready_now"
        ? "available_metadata"
        : artifact.readiness === "needs_result"
          ? "needs_result"
          : "future_generation",
    relatedPackageId: packageId,
    futureLocationRef: null,
  }));

  if (input.activeResultModel?.sourceType === "query") {
    items.push({
      itemId: "deliverable:query-result-checkpoint",
      label: "Result checkpoint",
      description: "A future checkpoint for the current query result and review state.",
      type: "future_generated_file",
      readiness: "available_metadata",
      relatedPackageId: packageId,
      futureLocationRef: null,
    });
  }

  return {
    hubId: `deliverable-hub:${input.dataset?.dataset_id || "no-dataset"}`,
    title: "Workspace hub",
    itemCount: items.length,
    readyItemCount: items.filter((item) => item.readiness === "available_metadata").length,
    futureItemCount: items.filter((item) => item.readiness === "future_generation").length,
    items,
    futureFolderReferences,
  };
};
