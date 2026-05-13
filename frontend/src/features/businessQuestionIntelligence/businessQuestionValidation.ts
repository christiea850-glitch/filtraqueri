import type {
  BusinessQuestionIntelligenceReport,
  BusinessQuestionValidationMessage,
  BusinessQuestionValidationResult,
} from "./businessQuestionTypes";

const addMessage = (
  messages: BusinessQuestionValidationMessage[],
  severity: BusinessQuestionValidationMessage["severity"],
  message: string,
) => {
  messages.push({ severity, message });
};

export const validateBusinessQuestionReport = (
  report: BusinessQuestionIntelligenceReport,
): BusinessQuestionValidationResult => {
  const messages: BusinessQuestionValidationMessage[] = [];
  const ids = new Set<string>();

  report.interpretedQuestions.forEach((interpretation) => {
    if (ids.has(interpretation.id)) {
      addMessage(messages, "error", `Duplicate business question interpretation id: ${interpretation.id}.`);
    }
    ids.add(interpretation.id);

    if (!interpretation.questionText.trim()) {
      addMessage(messages, "error", "Business question interpretation is missing question text.");
    }
    if (interpretation.supportingSignals.length === 0) {
      addMessage(messages, "warning", `${interpretation.questionText} has no supporting metadata signals.`);
    }
  });

  if (report.interpretedQuestions.length === 0) {
    addMessage(messages, "warning", "No business questions are available for metadata interpretation.");
  }

  return {
    valid: messages.every((message) => message.severity !== "error"),
    messages,
  };
};
