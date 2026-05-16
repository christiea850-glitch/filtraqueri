import { buildDeliverableHub } from "./workspaceSessionArtifacts";
import { buildWorkspaceSessionAudit } from "./workspaceSessionAudit";
import { buildWorkspaceSessionRecommendations } from "./workspaceSessionRecommendations";
import { createWorkspaceStorageReferences } from "./workspaceSessionStorage";
import { buildInvestigationTimeline } from "./workspaceSessionTimeline";
import type {
  InvestigationSessionReadiness,
  InvestigationSessionStatus,
  InvestigationWorkspaceBuildInput,
  InvestigationWorkspacePlan,
  InvestigationWorkspaceSession,
} from "./workspaceSessionTypes";

const statusFromInput = ({
  dataset,
  activeResultModel,
  analysisPackagePlan,
}: InvestigationWorkspaceBuildInput): InvestigationSessionStatus => {
  if (!dataset) return "new";
  if (analysisPackagePlan?.readinessSummary.readyArtifactCount) return "packaging_ready";
  if (activeResultModel?.rows.length) return "review_ready";
  return "in_progress";
};

const readinessFromStatus = (
  status: InvestigationSessionStatus,
): InvestigationSessionReadiness => {
  if (status === "new") return "needs_data";
  if (status === "packaging_ready") return "deliverable_ready";
  if (status === "review_ready") return "result_ready";
  return "ready_to_investigate";
};

export const buildInvestigationWorkspacePlan = (
  input: InvestigationWorkspaceBuildInput,
): InvestigationWorkspacePlan => {
  const now = new Date().toISOString();
  const sessionId = `investigation-session:${input.dataset?.dataset_id || "no-dataset"}`;
  const status = statusFromInput(input);
  const readiness = readinessFromStatus(status);
  const futureFolderReferences = createWorkspaceStorageReferences(sessionId);
  const deliverableHub = buildDeliverableHub(input, futureFolderReferences);
  const timeline = buildInvestigationTimeline(input);
  const packageManifest = input.analysisPackagePlan?.packageManifest || null;
  const activeResult = input.activeResultModel;
  const workbook = input.dataset?.workbook_metadata;
  const session: InvestigationWorkspaceSession = {
    sessionId,
    sessionTitle: `${input.dataset?.original_filename || "Untitled"} workspace session`,
    createdAt: input.dataset?.uploaded_at || now,
    updatedAt: now,
    sourceMode: input.sourceMode,
    status,
    readiness,
    datasetReference: input.dataset
      ? {
          datasetId: input.dataset.dataset_id,
          datasetName: input.dataset.original_filename,
          rowCount: input.dataset.row_count,
          columnCount: input.dataset.column_count,
        }
      : null,
    workbookReference: workbook
      ? {
          workbookId: workbook.workbookId,
          workbookName: workbook.name,
          activeWorksheetId: workbook.activeWorksheetId,
          worksheetReferences: workbook.worksheets.map((worksheet) => ({
            worksheetId: worksheet.worksheetId,
            worksheetName: worksheet.displayName || worksheet.sheetName,
            rowCount: worksheet.rowCount,
          })),
        }
      : null,
    activeResultReference: activeResult
      ? {
          sourceType: activeResult.sourceType,
          sourceTab: activeResult.sourceTab,
          rowCount: activeResult.totalCount,
          grouping: activeResult.grouping.columns,
          filters: activeResult.filters.activeLabels,
        }
      : null,
    narrativeReferences:
      input.narrativeReport?.visibleInsights.map((insight) => ({
        insightId: insight.id,
        category: insight.category,
        severity: insight.severity,
        label: insight.title,
        relatedColumns: insight.relatedColumns,
      })) || [],
    analysisPackageReferences: packageManifest
      ? [
          {
            packageId: packageManifest.packageId,
            title: packageManifest.title,
            status: packageManifest.status,
          },
        ]
      : [],
    investigationTrailReferences:
      input.investigationReport?.flow.steps.map((step) => ({
        stage: step.stage,
        label: step.label,
        guidance: step.guidance,
      })) || [],
    futureArtifactFolderReferences: futureFolderReferences,
    deliverableHub,
    timeline,
    auditMetadata: buildWorkspaceSessionAudit(input),
  };
  const recommendations = buildWorkspaceSessionRecommendations(session);

  return {
    session,
    recommendations,
    readinessSummary: {
      label:
        readiness === "deliverable_ready"
          ? "Workspace hub ready"
          : readiness === "result_ready"
            ? "Result checkpoint ready"
            : readiness === "ready_to_investigate"
              ? "Investigation ready"
              : "Open data to begin",
      packageCount: session.analysisPackageReferences.length,
      stageCount: session.timeline.length,
      deliverableCount: deliverableHub.itemCount,
      readyDeliverableCount: deliverableHub.readyItemCount,
    },
    humanSummary:
      deliverableHub.itemCount > 0
        ? `Workspace session is organized with ${deliverableHub.itemCount.toLocaleString()} future deliverable reference${deliverableHub.itemCount === 1 ? "" : "s"}.`
        : "Open or review data to begin organizing the workspace session.",
  };
};
