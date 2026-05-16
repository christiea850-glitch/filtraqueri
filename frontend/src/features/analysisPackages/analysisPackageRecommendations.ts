import type {
  AnalysisPackageManifest,
  AnalysisPackageRecommendation,
} from "./analysisPackageTypes";

export const buildAnalysisPackageRecommendations = (
  manifest: AnalysisPackageManifest,
): AnalysisPackageRecommendation[] => {
  const recommendations: AnalysisPackageRecommendation[] = [];

  manifest.artifactManifest.forEach((artifact) => {
    if (artifact.readiness === "not_applicable") return;

    recommendations.push({
      recommendationId: `recommendation:${artifact.artifactId}`,
      label: `Include ${artifact.label.toLowerCase()}`,
      description: artifact.description,
      artifactType: artifact.type,
      priority:
        artifact.type === "report_summary" || artifact.type === "result_export"
          ? "primary"
          : artifact.readiness === "future_generation"
            ? "future"
            : "supporting",
      readiness: artifact.readiness,
    });
  });

  if (manifest.workbookReference) {
    recommendations.push({
      recommendationId: "recommendation:workbook-relationship-notes",
      label: "Include workbook relationship notes",
      description: "Package the workbook sheet context so future reports can explain related business tables.",
      artifactType: "workbook_snapshot",
      priority: "supporting",
      readiness: "ready_now",
    });
  }

  if (manifest.resultReference?.grouping.length) {
    recommendations.push({
      recommendationId: "recommendation:grouped-summary-export",
      label: "Include grouped summary export",
      description: "Grouped results are useful as a supporting table in a future business package.",
      artifactType: "result_export",
      priority: "primary",
      readiness: "ready_now",
    });
  }

  return recommendations.slice(0, 8);
};
