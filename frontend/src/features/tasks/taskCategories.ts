export type AnalyticsTaskCategory =
  | "sales_analysis"
  | "forecasting"
  | "customer_analytics"
  | "financial_analysis"
  | "anomaly_detection"
  | "operational_intelligence"
  | "workforce_analytics"
  | "correlation_analysis";

export type AnalyticsTaskCategoryMetadata = {
  id: AnalyticsTaskCategory;
  label: string;
  description: string;
};

export const analyticsTaskCategories: AnalyticsTaskCategoryMetadata[] = [
  {
    id: "sales_analysis",
    label: "Sales Analysis",
    description: "Guided workflows for products, revenue, sales behavior, and commercial performance.",
  },
  {
    id: "forecasting",
    label: "Forecasting",
    description: "Future-facing workflows for projected revenue, demand, and operational planning.",
  },
  {
    id: "customer_analytics",
    label: "Customer Analytics",
    description: "Workflows for customer activity, inactivity, value, and retention signals.",
  },
  {
    id: "financial_analysis",
    label: "Financial Analysis",
    description: "Workflows for profit, cost, margin, and financial performance investigation.",
  },
  {
    id: "anomaly_detection",
    label: "Anomaly Detection",
    description: "Workflows that help identify unusual, risky, or unexpected behavior.",
  },
  {
    id: "operational_intelligence",
    label: "Operational Intelligence",
    description: "Workflows for business operations, process health, and workflow efficiency.",
  },
  {
    id: "workforce_analytics",
    label: "Workforce Analytics",
    description: "Workflows for departments, teams, staffing, productivity, and workforce comparisons.",
  },
  {
    id: "correlation_analysis",
    label: "Correlation Analysis",
    description: "Workflows that compare measures and inspect possible business relationships.",
  },
];

export const getAnalyticsTaskCategory = (category: AnalyticsTaskCategory) =>
  analyticsTaskCategories.find((currentCategory) => currentCategory.id === category) || null;
