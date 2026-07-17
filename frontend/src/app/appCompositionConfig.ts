import type { HumanIntent } from "../components/dataset/DatasetSummaryPanel";
import type { ActiveView } from "../features/dataset/datasetTypes";

export type HumanIntentGuidance = {
  readonly label: string;
  readonly route: ActiveView;
  readonly nextStep: string;
  readonly detail: string;
};

export const humanIntentGuidance: Record<HumanIntent, HumanIntentGuidance> = {
  summary: {
    label: "Summarize",
    route: "results",
    nextStep: "Review rows, columns, and preview.",
    detail: "Start with rows, columns, and preview.",
  },
  missing_values: {
    label: "Missing values",
    route: "results",
    nextStep: "Choose columns.",
    detail: "Check columns with empty values.",
  },
  top_categories: {
    label: "Top categories",
    route: "results",
    nextStep: "Group a category.",
    detail: "Count the biggest groups.",
  },
  compare_columns: {
    label: "Compare fields",
    route: "queryBuilder",
    nextStep: "Choose two columns.",
    detail: "View fields side by side.",
  },
  trends: {
    label: "Trend analysis",
    route: "results",
    nextStep: "Choose time and value.",
    detail: "Summarize change over time.",
  },
  unusual_values: {
    label: "Unusual values",
    route: "results",
    nextStep: "Sort rows.",
    detail: "Look for highs, lows, and surprises.",
  },
  simple_chart: {
    label: "Visualize data",
    route: "queryBuilder",
    nextStep: "Build a small summary.",
    detail: "Prepare grouped chart data.",
  },
};
