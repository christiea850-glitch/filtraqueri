import type {
  BusinessSemanticReport,
  BusinessSemanticValidationMessage,
  BusinessSemanticValidationResult,
} from "./businessSemanticTypes";

const addMessage = (
  messages: BusinessSemanticValidationMessage[],
  severity: BusinessSemanticValidationMessage["severity"],
  message: string,
) => {
  messages.push({ severity, message });
};

export const validateBusinessSemanticReport = (
  report: BusinessSemanticReport,
): BusinessSemanticValidationResult => {
  const messages: BusinessSemanticValidationMessage[] = [];
  const entityIds = new Set<string>();

  report.detectedSemanticEntities.forEach((entity) => {
    if (entityIds.has(entity.id)) {
      addMessage(messages, "error", `Duplicate semantic entity id: ${entity.id}.`);
    }
    entityIds.add(entity.id);

    if (entity.supportingMetadataSignals.length === 0) {
      addMessage(messages, "warning", `${entity.label} has no supporting metadata signals.`);
    }
  });

  report.possibleBusinessKpis.forEach((kpi) => {
    if (kpi.supportingMetadataSignals.length === 0) {
      addMessage(messages, "warning", `${kpi.label} has no supporting metadata signals.`);
    }
  });

  if (report.detectedSemanticEntities.length === 0) {
    addMessage(messages, "warning", "No business semantic entities were detected from current metadata.");
  }

  return {
    valid: messages.every((message) => message.severity !== "error"),
    messages,
  };
};
