import type {
  InvestigationContext,
  InvestigationFlow,
  InvestigationFlowStep,
  InvestigationSuggestion,
} from "./investigationTypes";

const baseSteps: InvestigationFlowStep[] = [
  {
    stage: "question",
    label: "Question",
    guidance: "Frame the business question before choosing controls.",
    recommendedAction: "Pick a starting question.",
  },
  {
    stage: "scope",
    label: "Scope",
    guidance: "Narrow the records only when the question needs focus.",
    recommendedAction: "Review useful filters.",
  },
  {
    stage: "compare",
    label: "Compare",
    guidance: "Choose a group, category, customer, owner, date, or segment to compare.",
    recommendedAction: "Choose a comparison field.",
  },
  {
    stage: "summarize",
    label: "Summarize",
    guidance: "Use counts, totals, averages, or selected fields to shape the answer.",
    recommendedAction: "Choose a measure or count records.",
  },
  {
    stage: "validate",
    label: "Validate",
    guidance: "Check missing values, sort order, and row limits before running.",
    recommendedAction: "Review the output shape.",
  },
  {
    stage: "review_result",
    label: "Review result",
    guidance: "Look for differences, changes, top contributors, or unusual records.",
    recommendedAction: "Review the results table.",
  },
  {
    stage: "next_investigation",
    label: "Next investigation",
    guidance: "Use the result to choose the next comparison or follow-up question.",
    recommendedAction: "Pick a follow-up.",
  },
];

export const buildInvestigationFlow = (
  context: InvestigationContext,
  suggestions: InvestigationSuggestion[],
): InvestigationFlow => {
  const activeStage = context.activeResultModel?.rows.length ? "review_result" : "question";
  const primarySuggestion = suggestions[0];

  return {
    id: `investigation-flow:${context.dataset?.dataset_id || "no-dataset"}`,
    title: primarySuggestion?.title || "Guided investigation",
    activeStage,
    steps: baseSteps.map((step) =>
      step.stage === "question" && primarySuggestion
        ? {
            ...step,
            guidance: primarySuggestion.question,
            recommendedAction: primarySuggestion.nextSteps[0] || step.recommendedAction,
          }
        : step,
    ),
  };
};
