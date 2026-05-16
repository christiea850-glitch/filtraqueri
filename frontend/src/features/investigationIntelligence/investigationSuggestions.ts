import { createSchemaDisplayProfiles, getDisplayColumnName } from "../dataIntelligence/structuralPresentation";
import type {
  InvestigationConfidence,
  InvestigationContext,
  InvestigationIntent,
  InvestigationIntentId,
  InvestigationSuggestion,
} from "./investigationTypes";

type IntentTemplate = {
  id: InvestigationIntentId;
  label: string;
  explanation: string;
  chartFamilies: InvestigationIntent["recommendedChartFamilies"];
  groupingStyles: string[];
  actions: string[];
};

const intentTemplates: IntentTemplate[] = [
  {
    id: "compare_entities",
    label: "Compare groups",
    explanation: "Compare business entities, teams, regions, customers, or categories side by side.",
    chartFamilies: ["bar", "comparison", "table"],
    groupingStyles: ["category comparison", "segment comparison"],
    actions: ["Choose a comparison field", "Add a measure", "Review the largest differences"],
  },
  {
    id: "identify_top_performers",
    label: "Find top performers",
    explanation: "Rank the strongest contributors by activity, amount, volume, or count.",
    chartFamilies: ["bar", "scorecard", "table"],
    groupingStyles: ["ranked summary", "top contributors"],
    actions: ["Group by a business entity", "Sort from highest to lowest", "Review the top records"],
  },
  {
    id: "identify_underperformers",
    label: "Find underperformers",
    explanation: "Look for lower activity, lower value, or weak operational performance.",
    chartFamilies: ["bar", "table"],
    groupingStyles: ["bottom-ranked summary", "exception review"],
    actions: ["Group by a business entity", "Sort from lowest to highest", "Review outliers"],
  },
  {
    id: "detect_change",
    label: "Review what changed",
    explanation: "Compare activity across dates, periods, statuses, or segments.",
    chartFamilies: ["line", "bar", "comparison"],
    groupingStyles: ["period comparison", "before/after comparison"],
    actions: ["Choose a date field", "Compare by period", "Review differences"],
  },
  {
    id: "explore_distribution",
    label: "Explore distribution",
    explanation: "Understand how records spread across categories, statuses, ranges, or groups.",
    chartFamilies: ["distribution", "bar", "table"],
    groupingStyles: ["category count", "range review"],
    actions: ["Group by a category", "Count records", "Look for concentration"],
  },
  {
    id: "summarize_activity",
    label: "Summarize activity",
    explanation: "Create a simple summary of rows, amounts, dates, and business categories.",
    chartFamilies: ["scorecard", "table"],
    groupingStyles: ["overall summary", "basic totals"],
    actions: ["Select key fields", "Add a count", "Review totals"],
  },
  {
    id: "investigate_trend",
    label: "Investigate trend",
    explanation: "Review movement over time using dates, periods, and measures.",
    chartFamilies: ["line", "bar"],
    groupingStyles: ["monthly trend", "time-series summary"],
    actions: ["Choose a date field", "Add a value or count", "Compare periods"],
  },
  {
    id: "investigate_anomaly",
    label: "Review unusual records",
    explanation: "Look for unusually high, low, missing, or inconsistent activity.",
    chartFamilies: ["table", "distribution"],
    groupingStyles: ["exception review", "outlier scan"],
    actions: ["Sort key measures", "Review empty values", "Focus on extreme records"],
  },
  {
    id: "understand_relationships",
    label: "Understand related sheets",
    explanation: "Use workbook structure to see which sheets may describe connected business activity.",
    chartFamilies: ["table", "comparison"],
    groupingStyles: ["sheet relationship review", "entity connection"],
    actions: ["Review related sheets", "Start from the recommended sheet", "Compare connected entities"],
  },
  {
    id: "evaluate_workload",
    label: "Evaluate workload",
    explanation: "Compare work volume across teams, owners, statuses, or locations.",
    chartFamilies: ["bar", "table", "comparison"],
    groupingStyles: ["workload by owner", "status distribution"],
    actions: ["Group by owner or status", "Count records", "Review workload concentration"],
  },
  {
    id: "review_operations",
    label: "Review operations",
    explanation: "Inspect operational volume, status, queues, delays, or process health.",
    chartFamilies: ["bar", "table", "scorecard"],
    groupingStyles: ["status summary", "operational breakdown"],
    actions: ["Group by status", "Review volume", "Look for bottlenecks"],
  },
  {
    id: "review_financials",
    label: "Review financials",
    explanation: "Summarize amounts, payments, invoices, balances, or revenue activity.",
    chartFamilies: ["bar", "line", "scorecard"],
    groupingStyles: ["financial total", "period total", "customer value"],
    actions: ["Choose an amount field", "Group by customer or period", "Review high values"],
  },
  {
    id: "review_customer_activity",
    label: "Review customer activity",
    explanation: "Understand customer volume, value, changes, and activity patterns.",
    chartFamilies: ["bar", "line", "table"],
    groupingStyles: ["customer ranking", "customer trend"],
    actions: ["Group by customer", "Add amount or count", "Review top customers"],
  },
];

const confidenceFromScore = (score: number): InvestigationConfidence => {
  if (score >= 76) return "high";
  if (score >= 52) return "medium";
  return "low";
};

const displayNames = (context: InvestigationContext, columns: string[]) => {
  const profiles = createSchemaDisplayProfiles(context.columns);
  return columns.map((column) => getDisplayColumnName(profiles, column));
};

const names = (columns: { name: string }[], limit = 3) => columns.slice(0, limit).map((column) => column.name);

const scoreIntent = (template: IntentTemplate, context: InvestigationContext) => {
  let score = 36;

  if (["compare_entities", "explore_distribution", "identify_top_performers", "identify_underperformers"].includes(template.id)) {
    score += Math.min(22, context.dimensions.length * 5);
  }
  if (["identify_top_performers", "identify_underperformers", "review_financials"].includes(template.id)) {
    score += Math.min(24, context.measures.length * 6);
  }
  if (["detect_change", "investigate_trend"].includes(template.id)) {
    score += context.contexts.temporal ? 28 : 0;
  }
  if (template.id === "understand_relationships") {
    score += context.contexts.workbook ? 34 : 0;
  }
  if (template.id === "review_customer_activity") {
    score += context.contexts.customer ? 30 : 0;
  }
  if (template.id === "review_financials") {
    score += context.contexts.financial ? 30 : 0;
  }
  if (["review_operations", "evaluate_workload"].includes(template.id)) {
    score += context.contexts.operational || context.contexts.workforce ? 28 : 0;
  }
  if (template.id === "investigate_anomaly") {
    score += context.columns.some((column) => column.null_count > 0) ? 12 : 0;
    score += context.measures.length > 0 ? 10 : 0;
  }
  if (template.id === "summarize_activity") {
    score += context.columns.length > 0 ? 20 : 0;
  }

  return Math.min(98, score);
};

export const buildInvestigationIntents = (context: InvestigationContext): InvestigationIntent[] =>
  intentTemplates
    .map((template) => {
      const score = scoreIntent(template, context);
      const dimensionNames = displayNames(context, names(context.dimensions));
      const measureNames = displayNames(context, names(context.measures));

      return {
        id: template.id,
        businessLabel: template.label,
        explanation: template.explanation,
        suggestedDimensions: dimensionNames,
        suggestedMeasures: measureNames,
        suggestedGroupingStyles: template.groupingStyles,
        suggestedNextActions: template.actions,
        recommendedChartFamilies: template.chartFamilies,
        confidence: confidenceFromScore(score),
        confidenceScore: score,
      };
    })
    .sort((left, right) => right.confidenceScore - left.confidenceScore);

const fallbackDimension = (context: InvestigationContext) =>
  displayNames(context, names(context.dimensions, 1))[0] || "a business category";

const fallbackMeasure = (context: InvestigationContext) =>
  displayNames(context, names(context.measures, 1))[0] || "record count";

export const buildInvestigationSuggestions = (context: InvestigationContext): InvestigationSuggestion[] => {
  const intents = buildInvestigationIntents(context);
  const customerField = displayNames(context, names(context.customerFields, 1))[0];
  const financialField = displayNames(context, names(context.financialFields, 1))[0];
  const dateField = displayNames(context, names(context.dateFields, 1))[0];
  const operationalField = displayNames(context, names(context.operationalFields, 1))[0];
  const dimension = fallbackDimension(context);
  const measure = financialField || fallbackMeasure(context);

  const suggestions: InvestigationSuggestion[] = [
    {
      id: "investigation:compare-primary",
      intentId: "compare_entities",
      title: `Compare by ${dimension}`,
      question: `How does ${measure} vary by ${dimension}?`,
      explanation: "Start with a comparison that separates the business into meaningful groups.",
      compareBy: [dimension],
      measures: [measure],
      nextSteps: ["Group records by this field", "Review the largest differences", "Narrow the scope if needed"],
      chartFamilies: ["bar", "comparison", "table"],
      confidence: intents.find((intent) => intent.id === "compare_entities")?.confidence || "medium",
      confidenceScore: intents.find((intent) => intent.id === "compare_entities")?.confidenceScore || 60,
    },
    {
      id: "investigation:top-performers",
      intentId: "identify_top_performers",
      title: "Identify highest contributors",
      question: `Which ${dimension} values contribute the most ${measure}?`,
      explanation: "Rank business groups to find where most activity or value is concentrated.",
      compareBy: [dimension],
      measures: [measure],
      nextSteps: ["Sort from highest to lowest", "Review top records", "Compare against the full result"],
      chartFamilies: ["bar", "scorecard", "table"],
      confidence: intents.find((intent) => intent.id === "identify_top_performers")?.confidence || "medium",
      confidenceScore: intents.find((intent) => intent.id === "identify_top_performers")?.confidenceScore || 58,
    },
  ];

  if (context.contexts.customer && customerField) {
    suggestions.push({
      id: "investigation:customer-activity",
      intentId: "review_customer_activity",
      title: "Review customer activity",
      question: `Which ${customerField} records show the most activity or value?`,
      explanation: "Customer fields can support activity, value, and account-level comparisons.",
      compareBy: [customerField],
      measures: [measure],
      nextSteps: ["Group by customer", "Review high-value customers", "Check changes over time"],
      chartFamilies: ["bar", "line", "table"],
      confidence: "high",
      confidenceScore: 86,
    });
  }

  if (context.contexts.financial && financialField) {
    suggestions.push({
      id: "investigation:financial-patterns",
      intentId: "review_financials",
      title: "Review financial patterns",
      question: `Where are the largest ${financialField} values?`,
      explanation: "Financial fields can support invoice, payment, amount, and revenue review.",
      compareBy: [dimension],
      measures: [financialField],
      nextSteps: ["Sort by amount", "Group by customer or period", "Review unusual high values"],
      chartFamilies: ["bar", "line", "scorecard"],
      confidence: "high",
      confidenceScore: 88,
    });
  }

  if (context.contexts.temporal && dateField) {
    suggestions.push({
      id: "investigation:change-over-time",
      intentId: "investigate_trend",
      title: "Review changes over time",
      question: `How does activity change by ${dateField}?`,
      explanation: "Date fields can help reveal trends, seasonality, and sudden changes.",
      compareBy: [dateField],
      measures: [measure],
      nextSteps: ["Group by date or month", "Compare periods", "Look for spikes or drops"],
      chartFamilies: ["line", "bar"],
      confidence: "high",
      confidenceScore: 84,
    });
  }

  if ((context.contexts.operational || context.contexts.workforce) && operationalField) {
    suggestions.push({
      id: "investigation:operations-workload",
      intentId: context.contexts.workforce ? "evaluate_workload" : "review_operations",
      title: "Explore workload distribution",
      question: `How is work distributed by ${operationalField}?`,
      explanation: "Operational fields can show workload, status, bottlenecks, and uneven activity.",
      compareBy: [operationalField],
      measures: ["record count"],
      nextSteps: ["Group by status or owner", "Count records", "Review overloaded groups"],
      chartFamilies: ["bar", "table", "comparison"],
      confidence: "high",
      confidenceScore: 82,
    });
  }

  if (context.contexts.workbook && context.relationshipHints.length > 0) {
    suggestions.push({
      id: "investigation:related-sheets",
      intentId: "understand_relationships",
      title: "Review related sheets",
      question: context.relationshipHints[0],
      explanation: "Workbook structure suggests related business sheets that may guide the next review.",
      compareBy: context.workbookIntelligence?.entityRoles.slice(0, 3).map((role) => role.worksheetName) || [],
      measures: [],
      nextSteps: ["Review connected sheets", "Start from the recommended sheet", "Compare related entities"],
      chartFamilies: ["table", "comparison"],
      confidence: "high",
      confidenceScore: 90,
    });
  }

  suggestions.push({
    id: "investigation:unusual-records",
    intentId: "investigate_anomaly",
    title: "Review unusual records",
    question: "Which records look unusually high, low, empty, or inconsistent?",
    explanation: "A review pass can reveal records that deserve follow-up before summarizing.",
    compareBy: [dimension],
    measures: [measure],
    nextSteps: ["Sort key fields", "Review empty values", "Compare unusual rows to the rest"],
    chartFamilies: ["table", "distribution"],
    confidence: context.measures.length > 0 ? "medium" : "low",
    confidenceScore: context.measures.length > 0 ? 66 : 46,
  });

  const seen = new Set<string>();
  return suggestions
    .sort((left, right) => right.confidenceScore - left.confidenceScore)
    .filter((suggestion) => {
      if (seen.has(suggestion.id)) return false;
      seen.add(suggestion.id);
      return true;
    })
    .slice(0, 7);
};
