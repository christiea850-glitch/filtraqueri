import type {
  WorkflowRecommendation,
  WorkflowRecommendationReport,
  WorkflowRecommendationValidationMessage,
  WorkflowRecommendationValidationResult,
} from "./workflowRecommendationTypes";

const addMessage = (
  messages: WorkflowRecommendationValidationMessage[],
  severity: WorkflowRecommendationValidationMessage["severity"],
  message: string,
) => {
  messages.push({ severity, message });
};

const validateDuplicateCategories = (
  recommendations: WorkflowRecommendation[],
  messages: WorkflowRecommendationValidationMessage[],
) => {
  const categories = new Set<string>();

  recommendations.forEach((recommendation) => {
    if (categories.has(recommendation.category)) {
      addMessage(messages, "error", `Duplicate workflow recommendation category: ${recommendation.category}.`);
    }
    categories.add(recommendation.category);
  });
};

const validateRanking = (
  recommendations: WorkflowRecommendation[],
  messages: WorkflowRecommendationValidationMessage[],
) => {
  recommendations.forEach((recommendation, index) => {
    const previous = recommendations[index - 1];
    if (previous && recommendation.rank < previous.rank) {
      addMessage(messages, "error", "Workflow recommendations must be sorted by ascending rank.");
    }
    if (recommendation.supportingMetadataSignals.length === 0) {
      addMessage(
        messages,
        "warning",
        `${recommendation.label} has no supporting metadata signals.`,
      );
    }
  });
};

const validateFuturePaths = (
  recommendations: WorkflowRecommendation[],
  messages: WorkflowRecommendationValidationMessage[],
) => {
  recommendations.forEach((recommendation) => {
    if (recommendation.recommendedFutureEnginePath.length === 0) {
      addMessage(
        messages,
        "warning",
        `${recommendation.label} does not expose a recommended future engine path.`,
      );
    }
    if (recommendation.possibleFutureResultShapes.length === 0) {
      addMessage(
        messages,
        "warning",
        `${recommendation.label} does not expose a possible future result shape.`,
      );
    }
  });
};

export const validateWorkflowRecommendationReport = (
  report: WorkflowRecommendationReport,
): WorkflowRecommendationValidationResult => {
  const messages: WorkflowRecommendationValidationMessage[] = [];

  if (report.recommendations.length === 0) {
    addMessage(messages, "warning", "No workflow recommendations are available from current metadata.");
  }

  validateDuplicateCategories(report.recommendations, messages);
  validateRanking(report.recommendations, messages);
  validateFuturePaths(report.recommendations, messages);

  return {
    valid: messages.every((message) => message.severity !== "error"),
    messages,
  };
};
