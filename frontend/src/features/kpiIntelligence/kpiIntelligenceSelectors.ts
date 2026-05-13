import type {
  KpiIntelligenceReport,
  KpiOpportunity,
  KpiOpportunityCategory,
} from "./kpiIntelligenceTypes";

export const selectTopKpiOpportunity = (
  report: KpiIntelligenceReport | null,
) => report?.topOpportunity || null;

export const listKpiOpportunities = (
  report: KpiIntelligenceReport | null,
) => report?.opportunities || [];

export const selectKpiIntelligenceHumanSummary = (
  report: KpiIntelligenceReport | null,
) => report?.humanSummary || "No KPI intelligence summary is available yet.";

export const selectKpiIntelligenceAnalystSummary = (
  report: KpiIntelligenceReport | null,
) => report?.analystSummary || "No KPI intelligence metadata is available yet.";

export const listKpiOpportunitiesByCategory = (
  report: KpiIntelligenceReport | null,
  category: KpiOpportunityCategory,
) => listKpiOpportunities(report).filter((opportunity) => opportunity.category === category);

export const listKpiOpportunitiesByConfidence = (
  report: KpiIntelligenceReport | null,
  confidence: KpiOpportunity["confidence"],
) => listKpiOpportunities(report).filter((opportunity) => opportunity.confidence === confidence);
