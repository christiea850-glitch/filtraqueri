import type {
  BusinessSemanticEntityCategory,
  BusinessSemanticReport,
} from "./businessSemanticTypes";

export const selectBusinessSemanticHumanSummary = (
  report: BusinessSemanticReport | null,
) => report?.humanSummary || "No business semantic summary is available yet.";

export const selectBusinessSemanticAnalystSummary = (
  report: BusinessSemanticReport | null,
) => report?.analystSummary || "No business semantic metadata is available yet.";

export const listDetectedSemanticEntities = (
  report: BusinessSemanticReport | null,
) => report?.detectedSemanticEntities || [];

export const listBusinessKpiSuggestions = (
  report: BusinessSemanticReport | null,
) => report?.possibleBusinessKpis || [];

export const listSemanticEntitiesByCategory = (
  report: BusinessSemanticReport | null,
  category: BusinessSemanticEntityCategory,
) => listDetectedSemanticEntities(report).filter((entity) => entity.category === category);

export const listRecommendedFutureAnalyticsPaths = (
  report: BusinessSemanticReport | null,
) => report?.recommendedFutureAnalyticsPaths || [];
