import type {
  BusinessQuestionIntelligenceReport,
  BusinessQuestionIntentCategory,
} from "./businessQuestionTypes";

export const selectTopBusinessQuestionInterpretation = (
  report: BusinessQuestionIntelligenceReport | null,
) => report?.topInterpretation || null;

export const listBusinessQuestionInterpretations = (
  report: BusinessQuestionIntelligenceReport | null,
) => report?.interpretedQuestions || [];

export const selectBusinessQuestionHumanSummary = (
  report: BusinessQuestionIntelligenceReport | null,
) => report?.humanSummary || "No business question summary is available yet.";

export const selectBusinessQuestionAnalystSummary = (
  report: BusinessQuestionIntelligenceReport | null,
) => report?.analystSummary || "No business question metadata is available yet.";

export const listBusinessQuestionsByIntent = (
  report: BusinessQuestionIntelligenceReport | null,
  category: BusinessQuestionIntentCategory,
) => listBusinessQuestionInterpretations(report).filter(
  (interpretation) => interpretation.detectedIntentCategory === category,
);
