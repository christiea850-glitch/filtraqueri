import type { BusinessIntent, BusinessIntentCategory } from "./businessIntentTypes";

const metricInput = {
  id: "metric",
  type: "metric" as const,
  label: "Metric",
  description: "Business value to measure, such as revenue, profit, quantity, or cost.",
  required: true,
  exampleValues: ["revenue", "profit", "quantity"],
};

const dateFieldInput = {
  id: "date-field",
  type: "dateField" as const,
  label: "Date field",
  description: "Date column used for time-based analysis.",
  required: true,
  exampleValues: ["order_date", "invoice_date", "month"],
};

export const businessIntentRegistry: BusinessIntent[] = [
  {
    id: "best_performing_products",
    label: "Best-performing products",
    description: "Find which products, services, or items are producing the strongest business results.",
    category: "sales_analysis",
    userQuestionExamples: [
      "Show me my best-performing products.",
      "Which products generated the most revenue?",
      "What items are selling the most?",
    ],
    requiredInputs: [
      {
        id: "product-field",
        type: "entityField",
        label: "Product field",
        description: "Column that identifies the product, service, or item.",
        required: true,
        exampleValues: ["product", "sku", "item_name"],
      },
      metricInput,
    ],
    optionalInputs: [dateFieldInput],
    supportedResultTypes: ["table", "summary", "chart_preview", "explanation"],
    supportedEngines: ["duckdb_sql", "excel_workbook", "python_preview"],
    safetyLevel: "metadata_only",
  },
  {
    id: "compare_departments",
    label: "Compare departments",
    description: "Compare performance, cost, volume, or activity across departments or teams.",
    category: "workforce_analytics",
    userQuestionExamples: [
      "Compare departments.",
      "Which department has the highest costs?",
      "How do teams compare by output?",
    ],
    requiredInputs: [
      {
        id: "department-field",
        type: "comparisonField",
        label: "Department field",
        description: "Column that identifies a department, team, or business unit.",
        required: true,
        exampleValues: ["department", "team", "business_unit"],
      },
      metricInput,
    ],
    optionalInputs: [dateFieldInput],
    supportedResultTypes: ["table", "summary", "chart_preview", "explanation"],
    supportedEngines: ["duckdb_sql", "excel_workbook", "python_preview", "r_preview"],
    safetyLevel: "metadata_only",
  },
  {
    id: "revenue_trend_analysis",
    label: "Revenue trend analysis",
    description: "Analyze how revenue changes over time and identify direction, spikes, or drops.",
    category: "trend_analysis",
    userQuestionExamples: [
      "Show my revenue trend.",
      "Is revenue going up or down?",
      "How did sales change over time?",
    ],
    requiredInputs: [metricInput, dateFieldInput],
    optionalInputs: [
      {
        id: "grouping-field",
        type: "groupingField",
        label: "Group by",
        description: "Optional business segment to compare over time.",
        required: false,
        exampleValues: ["region", "product", "department"],
      },
    ],
    supportedResultTypes: ["table", "summary", "chart_preview", "explanation"],
    supportedEngines: ["duckdb_sql", "excel_workbook", "python_preview", "r_preview"],
    safetyLevel: "metadata_only",
  },
  {
    id: "customer_inactivity_check",
    label: "Customer inactivity check",
    description: "Identify customers who have not purchased, ordered, or interacted recently.",
    category: "customer_analytics",
    userQuestionExamples: [
      "Which customers have gone inactive?",
      "Find customers who have not ordered recently.",
      "Who should we follow up with?",
    ],
    requiredInputs: [
      {
        id: "customer-field",
        type: "entityField",
        label: "Customer field",
        description: "Column that identifies customers or accounts.",
        required: true,
        exampleValues: ["customer_id", "customer_name", "account"],
      },
      dateFieldInput,
    ],
    optionalInputs: [
      {
        id: "inactivity-threshold",
        type: "threshold",
        label: "Inactivity threshold",
        description: "How long a customer can be inactive before being flagged.",
        required: false,
        exampleValues: ["30 days", "90 days", "6 months"],
      },
    ],
    supportedResultTypes: ["table", "summary", "diagnostic", "explanation"],
    supportedEngines: ["duckdb_sql", "excel_workbook", "python_preview"],
    safetyLevel: "metadata_only",
  },
  {
    id: "unusual_sales_behavior",
    label: "Unusual sales behavior",
    description: "Find sales records, products, customers, or regions that look unusually high, low, or inconsistent.",
    category: "anomaly_detection",
    userQuestionExamples: [
      "Find unusual sales behavior.",
      "Which sales look abnormal?",
      "Are there suspicious spikes or drops?",
    ],
    requiredInputs: [metricInput],
    optionalInputs: [
      dateFieldInput,
      {
        id: "dimension-field",
        type: "dimension",
        label: "Dimension",
        description: "Optional segment to inspect for unusual behavior.",
        required: false,
        exampleValues: ["region", "product", "sales_rep"],
      },
    ],
    supportedResultTypes: ["table", "diagnostic", "summary", "explanation"],
    supportedEngines: ["duckdb_sql", "excel_workbook", "python_preview", "r_preview"],
    safetyLevel: "metadata_only",
  },
  {
    id: "profit_drop_investigation",
    label: "Profit drop investigation",
    description: "Investigate where profit is decreasing and which segments may be contributing.",
    category: "financial_insights",
    userQuestionExamples: [
      "Why are profits dropping?",
      "Where did profit decrease?",
      "What products or regions hurt profit?",
    ],
    requiredInputs: [metricInput, dateFieldInput],
    optionalInputs: [
      {
        id: "comparison-field",
        type: "comparisonField",
        label: "Compare by",
        description: "Business segment used to locate possible contributors.",
        required: false,
        exampleValues: ["region", "product", "department"],
      },
    ],
    supportedResultTypes: ["table", "summary", "diagnostic", "explanation"],
    supportedEngines: ["duckdb_sql", "excel_workbook", "python_preview", "r_preview"],
    safetyLevel: "metadata_only",
  },
  {
    id: "forecast_revenue",
    label: "Forecast revenue",
    description: "Prepare a future revenue forecast from historical revenue and date fields.",
    category: "forecasting",
    userQuestionExamples: [
      "Forecast next month revenue.",
      "What might revenue look like next quarter?",
      "Predict future sales.",
    ],
    requiredInputs: [metricInput, dateFieldInput],
    optionalInputs: [
      {
        id: "forecast-horizon",
        type: "timeRange",
        label: "Forecast horizon",
        description: "Future period to forecast.",
        required: false,
        exampleValues: ["next month", "next quarter", "next 12 weeks"],
      },
    ],
    supportedResultTypes: ["table", "summary", "chart_preview", "explanation"],
    supportedEngines: ["python_preview", "r_preview", "duckdb_sql"],
    safetyLevel: "metadata_only",
  },
  {
    id: "correlation_check",
    label: "Correlation check",
    description: "Check whether two business measures appear to move together.",
    category: "correlation_analysis",
    userQuestionExamples: [
      "Check correlation between discount and revenue.",
      "Do cost and sales move together?",
      "Which measures are related?",
    ],
    requiredInputs: [
      {
        id: "first-metric",
        type: "metric",
        label: "First metric",
        description: "First numeric business measure.",
        required: true,
        exampleValues: ["discount", "cost", "quantity"],
      },
      {
        id: "second-metric",
        type: "metric",
        label: "Second metric",
        description: "Second numeric business measure.",
        required: true,
        exampleValues: ["revenue", "profit", "sales"],
      },
    ],
    optionalInputs: [
      {
        id: "filter-condition",
        type: "filterCondition",
        label: "Filter condition",
        description: "Optional subset of records to inspect.",
        required: false,
        exampleValues: ["region is East", "date is this year"],
      },
    ],
    supportedResultTypes: ["table", "summary", "diagnostic", "explanation"],
    supportedEngines: ["python_preview", "r_preview", "duckdb_sql"],
    safetyLevel: "metadata_only",
  },
];

export const listBusinessIntents = () => businessIntentRegistry;

export const getBusinessIntentById = (intentId: string) =>
  businessIntentRegistry.find((intent) => intent.id === intentId) || null;

export const listBusinessIntentsByCategory = (category: BusinessIntentCategory) =>
  businessIntentRegistry.filter((intent) => intent.category === category);
