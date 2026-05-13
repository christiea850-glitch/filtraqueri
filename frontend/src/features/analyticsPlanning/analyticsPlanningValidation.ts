import type {
  AnalyticsPlan,
  AnalyticsPlanValidationMessage,
  AnalyticsPlanValidationResult,
} from "./analyticsPlanningTypes";

const addMessage = (
  messages: AnalyticsPlanValidationMessage[],
  severity: AnalyticsPlanValidationMessage["severity"],
  message: string,
) => {
  messages.push({ severity, message });
};

export const validateAnalyticsPlan = (plan: AnalyticsPlan): AnalyticsPlanValidationResult => {
  const messages: AnalyticsPlanValidationMessage[] = [];
  const stepIds = new Set(plan.steps.map((step) => step.stepId));

  plan.steps.forEach((step) => {
    step.dependsOnStepIds.forEach((dependencyId) => {
      if (!stepIds.has(dependencyId)) {
        addMessage(messages, "error", `${step.label} depends on missing step ${dependencyId}.`);
      }
    });
  });

  plan.dependencies.forEach((dependency) => {
    if (!stepIds.has(dependency.requiredByStepId)) {
      addMessage(messages, "error", `${dependency.label} points to a missing required step.`);
    }
  });

  if (plan.steps.length === 0) addMessage(messages, "warning", "Analytics plan has no future steps.");
  if (plan.projectedOutputs.length === 0) addMessage(messages, "warning", "Analytics plan has no projected outputs.");

  return {
    valid: messages.every((message) => message.severity !== "error"),
    messages,
  };
};
