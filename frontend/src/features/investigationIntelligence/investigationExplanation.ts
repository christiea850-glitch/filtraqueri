import type { InvestigationContext, InvestigationSuggestion } from "./investigationTypes";

export const explainInvestigationContext = (
  context: InvestigationContext,
  suggestions: InvestigationSuggestion[],
) => {
  if (!context.dataset) return "Open data to see guided investigation ideas.";

  const themes = [
    context.contexts.customer ? "customer activity" : null,
    context.contexts.financial ? "financial review" : null,
    context.contexts.operational ? "operations" : null,
    context.contexts.workforce ? "workload" : null,
    context.contexts.temporal ? "changes over time" : null,
    context.contexts.workbook ? "related sheets" : null,
  ].filter((theme): theme is string => Boolean(theme));

  if (suggestions.length === 0) {
    return "Start with a simple review of rows and columns, then narrow the question.";
  }

  if (themes.length === 0) {
    return "General comparison and summary paths are available for this dataset.";
  }

  return `Suggested paths focus on ${themes.slice(0, 3).join(", ")}.`;
};

export const buildResultFollowUpSuggestions = (
  context: InvestigationContext,
  suggestions: InvestigationSuggestion[],
) => {
  const activeResult = context.activeResultModel;
  const followUps: InvestigationSuggestion[] = [];

  if (!activeResult) return suggestions.slice(0, 3);

  const groupingSuggestion = suggestions.find((suggestion) =>
    ["compare_entities", "explore_distribution", "review_customer_activity"].includes(suggestion.intentId),
  );
  const trendSuggestion = suggestions.find((suggestion) => suggestion.intentId === "investigate_trend");
  const anomalySuggestion = suggestions.find((suggestion) => suggestion.intentId === "investigate_anomaly");
  const relationshipSuggestion = suggestions.find((suggestion) => suggestion.intentId === "understand_relationships");

  if (activeResult.grouping.hasGrouping && anomalySuggestion) {
    followUps.push({
      ...anomalySuggestion,
      title: "Review unusual groups",
      question: "Which grouped result looks unusually high, low, or incomplete?",
    });
  } else if (groupingSuggestion) {
    followUps.push({
      ...groupingSuggestion,
      title: `Compare by ${groupingSuggestion.compareBy[0] || "category"}`,
      question: `Compare this result by ${groupingSuggestion.compareBy[0] || "a business category"}.`,
    });
  }

  if (trendSuggestion) followUps.push(trendSuggestion);
  if (relationshipSuggestion) followUps.push(relationshipSuggestion);
  if (anomalySuggestion && !followUps.some((suggestion) => suggestion.id === anomalySuggestion.id)) {
    followUps.push(anomalySuggestion);
  }

  return followUps.slice(0, 4);
};
