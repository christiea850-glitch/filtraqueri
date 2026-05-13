import type { AnalyticsIntentGraphReport } from "./analyticsIntentGraphTypes";

export const selectAnalyticsIntentGraphHumanSummary = (
  graph: AnalyticsIntentGraphReport | null,
) => graph?.humanSummary || "No analytics intent graph summary is available yet.";

export const selectAnalyticsIntentGraphAnalystSummary = (
  graph: AnalyticsIntentGraphReport | null,
) => graph?.analystSummary || "No analytics intent graph metadata is available yet.";

export const listAnalyticsIntentGraphNodes = (graph: AnalyticsIntentGraphReport | null) =>
  graph?.nodes || [];

export const listAnalyticsIntentGraphEdges = (graph: AnalyticsIntentGraphReport | null) =>
  graph?.edges || [];

export const selectAnalyticsIntentGraphHealth = (graph: AnalyticsIntentGraphReport | null) =>
  graph?.health || null;

export const listRecommendedGraphEngines = (graph: AnalyticsIntentGraphReport | null) =>
  graph?.recommendedFutureEngines || [];
