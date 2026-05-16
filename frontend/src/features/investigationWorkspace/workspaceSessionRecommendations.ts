import type {
  InvestigationWorkspaceRecommendation,
  InvestigationWorkspaceSession,
} from "./workspaceSessionTypes";

export const buildWorkspaceSessionRecommendations = (
  session: InvestigationWorkspaceSession,
): InvestigationWorkspaceRecommendation[] => {
  const recommendations: InvestigationWorkspaceRecommendation[] = [
    {
      recommendationId: "workspace-rec:continue",
      label: "Continue investigation",
      description: "Use the latest checkpoint to choose the next comparison or review step.",
      priority: "primary",
      readiness: session.readiness,
    },
    {
      recommendationId: "workspace-rec:executive-summary",
      label: "Build executive summary later",
      description: "The session metadata can support a future business summary deliverable.",
      priority: "future",
      readiness: session.readiness,
    },
    {
      recommendationId: "workspace-rec:package",
      label: "Export result package later",
      description: "The deliverable hub can organize future reports, exports, notes, and snapshots.",
      priority: "future",
      readiness: session.readiness,
    },
  ];

  if (session.activeResultReference?.grouping.length) {
    recommendations.unshift({
      recommendationId: "workspace-rec:grouped-report",
      label: "Create grouped report",
      description: "Grouped results are ready to become a future summary artifact.",
      priority: "primary",
      readiness: "deliverable_ready",
    });
  }

  if (session.workbookReference) {
    recommendations.push({
      recommendationId: "workspace-rec:workbook-snapshot",
      label: "Preserve workbook snapshot",
      description: "Workbook sheets and active worksheet references are ready for package lineage.",
      priority: "supporting",
      readiness: session.readiness,
    });
  }

  if (session.sourceMode === "analyst") {
    recommendations.push({
      recommendationId: "workspace-rec:analyst-draft",
      label: "Save analyst draft later",
      description: "Analyst workspace metadata can later be included as a technical appendix.",
      priority: "future",
      readiness: session.readiness,
    });
  }

  return recommendations.slice(0, 6);
};
