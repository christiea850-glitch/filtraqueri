import { buildAnalysisPackageManifest } from "./analysisPackageManifest";
import { buildAnalysisPackageRecommendations } from "./analysisPackageRecommendations";
import type {
  AnalysisPackageBuildInput,
  AnalysisPackagePlan,
} from "./analysisPackageTypes";

export const buildAnalysisPackagePlan = (
  input: AnalysisPackageBuildInput,
): AnalysisPackagePlan => {
  const packageManifest = buildAnalysisPackageManifest(input);
  const recommendations = buildAnalysisPackageRecommendations(packageManifest);
  const readyArtifactCount = packageManifest.artifactManifest.filter(
    (artifact) => artifact.readiness === "ready_now",
  ).length;
  const futureArtifactCount = packageManifest.artifactManifest.filter(
    (artifact) => artifact.readiness === "future_generation",
  ).length;
  const recommendedArtifactCount = recommendations.length;
  const label =
    readyArtifactCount > 0
      ? "Package planning ready"
      : input.activeResultModel
        ? "Package outline ready"
        : "Needs result review";

  return {
    packageManifest,
    recommendations,
    readinessSummary: {
      label,
      readyArtifactCount,
      recommendedArtifactCount,
      futureArtifactCount,
    },
    humanSummary:
      readyArtifactCount > 0
        ? `This investigation can be organized into a business package with ${recommendedArtifactCount.toLocaleString()} recommended artifact${recommendedArtifactCount === 1 ? "" : "s"}.`
        : "Review results to prepare a future business package.",
  };
};
