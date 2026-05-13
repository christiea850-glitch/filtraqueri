import type { BusinessExplanation } from "./explanationTypes";

export const getBusinessMeaning = (explanation: BusinessExplanation | null) =>
  explanation?.businessMeaning || "";

export const listExpectedOutputs = (explanation: BusinessExplanation | null) =>
  explanation?.expectedOutputs || [];

export const listPotentialInsights = (explanation: BusinessExplanation | null) =>
  explanation?.potentialInsights || [];
