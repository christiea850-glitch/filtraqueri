import type {
  NarrativeInsightCategory,
  NarrativeRecommendation,
  NarrativeRecommendationAction,
} from "./narrativeTypes";

const labels: Record<NarrativeRecommendationAction, string> = {
  investigate_further: "Investigate further",
  group_by_category: "Group by category",
  filter_missing_values: "Filter missing values",
  compare_periods: "Compare periods",
  segment_locations: "Segment locations",
  inspect_duplicates: "Inspect duplicates",
  create_executive_summary_later: "Create executive summary later",
  preserve_workbook_snapshot: "Preserve workbook snapshot",
};

const rationale: Record<NarrativeRecommendationAction, string> = {
  investigate_further: "The pattern is large enough to deserve focused review.",
  group_by_category: "A grouped view can show whether one segment is driving the result.",
  filter_missing_values: "Filtering empty values can isolate quality issues before analysis.",
  compare_periods: "A period comparison can separate seasonality from a one-time shift.",
  segment_locations: "Location segments can show whether activity is centralized.",
  inspect_duplicates: "Duplicate review can prevent overstated counts or repeated records.",
  create_executive_summary_later: "The insight is structured for future executive reporting.",
  preserve_workbook_snapshot: "A workbook snapshot can preserve context for later review.",
};

const categoryActions: Record<NarrativeInsightCategory, NarrativeRecommendationAction[]> = {
  trend: ["compare_periods", "investigate_further"],
  concentration: ["group_by_category", "investigate_further"],
  anomaly: ["investigate_further", "preserve_workbook_snapshot"],
  quality: ["filter_missing_values", "inspect_duplicates"],
  comparison: ["group_by_category", "investigate_further"],
  distribution: ["group_by_category", "investigate_further"],
  operational: ["investigate_further", "group_by_category"],
  financial: ["investigate_further", "create_executive_summary_later"],
  categorical: ["group_by_category", "segment_locations"],
  temporal: ["compare_periods", "investigate_further"],
  investigation: ["preserve_workbook_snapshot", "create_executive_summary_later"],
  recommendation: ["create_executive_summary_later", "investigate_further"],
};

export const buildNarrativeRecommendations = (
  insightId: string,
  category: NarrativeInsightCategory,
  extras: NarrativeRecommendationAction[] = [],
): NarrativeRecommendation[] => {
  const actions = Array.from(new Set([...categoryActions[category], ...extras])).slice(0, 3);

  return actions.map((action) => ({
    id: `${insightId}:recommendation:${action}`,
    action,
    label: labels[action],
    rationale: rationale[action],
  }));
};
