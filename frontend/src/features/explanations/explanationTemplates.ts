import type { ExplanationTemplate } from "./explanationTypes";

export const explanationTemplates: ExplanationTemplate[] = [
  {
    templateKey: "explain_ranked_business_performance",
    title: "Rank business performance",
    summary: "This workflow ranks business entities by a selected performance metric.",
    businessMeaning:
      "This helps identify which products, services, or entities contribute most strongly to business performance.",
    expectedOutputs: ["ranked table", "performance summary", "top and weak performer comparison"],
    potentialInsights: ["top revenue drivers", "weak-performing products", "concentration risk"],
  },
  {
    templateKey: "explain_time_series_trend",
    title: "Understand change over time",
    summary: "This workflow organizes a metric over time to show direction and movement.",
    businessMeaning:
      "This helps users understand whether business activity is rising, falling, or changing unexpectedly.",
    expectedOutputs: ["time-based table", "trend summary", "future chart preview"],
    potentialInsights: ["growth periods", "drops or spikes", "seasonal movement"],
  },
  {
    templateKey: "explain_segment_comparison",
    title: "Compare business groups",
    summary: "This workflow compares departments, teams, regions, or other groups by a metric.",
    businessMeaning:
      "This helps reveal which groups are performing better, worse, or differently from others.",
    expectedOutputs: ["comparison table", "group summary", "difference explanation"],
    potentialInsights: ["strongest group", "underperforming group", "performance gap"],
  },
  {
    templateKey: "explain_forecast_preview",
    title: "Prepare a forecast",
    summary: "This workflow prepares historical activity for a future forecasting process.",
    businessMeaning:
      "This helps estimate where a business metric may be heading based on past activity.",
    expectedOutputs: ["forecast-ready timeline", "forecast summary", "future chart preview"],
    potentialInsights: ["expected direction", "possible future range", "planning risk"],
  },
  {
    templateKey: "explain_inactive_entities",
    title: "Find inactivity",
    summary: "This workflow identifies customers, accounts, or entities with recent inactivity.",
    businessMeaning:
      "This helps prioritize follow-up, retention, or operational outreach.",
    expectedOutputs: ["inactive entity table", "inactivity summary", "follow-up candidates"],
    potentialInsights: ["at-risk customers", "longest inactive accounts", "retention opportunities"],
  },
  {
    templateKey: "explain_correlation_check",
    title: "Check metric relationships",
    summary: "This workflow checks whether two business measures tend to move together.",
    businessMeaning:
      "This helps users explore whether one measure may be associated with another business outcome.",
    expectedOutputs: ["relationship summary", "diagnostic table", "future chart preview"],
    potentialInsights: ["positive association", "negative association", "weak or unclear relationship"],
  },
  {
    templateKey: "explain_anomaly_candidates",
    title: "Identify unusual behavior",
    summary: "This workflow looks for unusually high, low, or inconsistent business activity.",
    businessMeaning:
      "This helps users spot records or segments that may deserve review before they become business problems.",
    expectedOutputs: ["candidate anomaly table", "diagnostic summary", "review list"],
    potentialInsights: ["unexpected spikes", "unusual drops", "outlier segments"],
  },
  {
    templateKey: "explain_profit_drop_investigation",
    title: "Investigate profit drops",
    summary: "This workflow prepares a structured investigation into decreasing profit.",
    businessMeaning:
      "This helps users narrow down where profit may be declining and which segments may be contributing.",
    expectedOutputs: ["profit change table", "contributor summary", "diagnostic explanation"],
    potentialInsights: ["declining segments", "profit pressure points", "possible root contributors"],
  },
];

export const getExplanationTemplate = (templateKey: string) =>
  explanationTemplates.find((template) => template.templateKey === templateKey) || null;
