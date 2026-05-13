import type { DataProfileReport } from "./dataProfileTypes";
import type { DialectRecommendationReport } from "./dialectRecommendationTypes";

export const selectDataProfileHumanSummary = (profile: DataProfileReport | null) =>
  profile?.humanSummary || "No data profile is available yet.";

export const selectDataProfileAnalystSummary = (profile: DataProfileReport | null) =>
  profile?.analystSummary || "No analyst data profile is available yet.";

export const selectPossibleMetricFields = (profile: DataProfileReport | null) =>
  profile?.possibleMetrics || [];

export const selectPossibleDimensionFields = (profile: DataProfileReport | null) =>
  profile?.possibleDimensions || [];

export const selectPossibleDateTimeFields = (profile: DataProfileReport | null) =>
  profile?.dateTimeFields || [];

export const selectWorkbookRelationshipContext = (profile: DataProfileReport | null) =>
  profile?.workbookRelationshipContext || null;

export const selectTimeSeriesReadiness = (profile: DataProfileReport | null) =>
  profile?.timeSeriesReadiness || null;

export const selectStatisticalReadiness = (profile: DataProfileReport | null) =>
  profile?.statisticalReadiness || null;

export const selectRecommendedFutureEngine = (report: DialectRecommendationReport | null) =>
  report?.recommendedFutureEngine || null;

export const listFutureDialectRecommendations = (report: DialectRecommendationReport | null) =>
  report?.recommendations || [];
