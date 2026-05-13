import type { AnalysisPlan } from "./analysisPlanTypes";

export const getAnalysisPlanReadinessLabel = (plan: AnalysisPlan | null) => {
  if (!plan) return "No analysis plan";
  if (plan.validationState === "ready_for_future_execution") {
    return "Plan ready for future execution wiring";
  }
  if (plan.validationState === "unsupported") return "Plan unsupported";
  if (plan.validationState === "invalid") return "Plan invalid";
  return "Draft analysis plan";
};

export const listAnalysisPlanStepLabels = (plan: AnalysisPlan | null) =>
  plan?.executionSteps.map((step) => step.label) || [];

export const getPreferredAnalysisEngine = (plan: AnalysisPlan | null) =>
  plan?.preferredEngine || null;
