import type {
  KpiIntelligenceReport,
  KpiIntelligenceValidationMessage,
  KpiIntelligenceValidationResult,
} from "./kpiIntelligenceTypes";

const addMessage = (
  messages: KpiIntelligenceValidationMessage[],
  severity: KpiIntelligenceValidationMessage["severity"],
  message: string,
) => {
  messages.push({ severity, message });
};

export const validateKpiIntelligenceReport = (
  report: KpiIntelligenceReport,
): KpiIntelligenceValidationResult => {
  const messages: KpiIntelligenceValidationMessage[] = [];
  const ids = new Set<string>();

  report.opportunities.forEach((opportunity, index) => {
    const previous = report.opportunities[index - 1];

    if (ids.has(opportunity.id)) {
      addMessage(messages, "error", `Duplicate KPI opportunity id: ${opportunity.id}.`);
    }
    ids.add(opportunity.id);

    if (previous && opportunity.rank < previous.rank) {
      addMessage(messages, "error", "KPI opportunities must be sorted by ascending rank.");
    }
    if (opportunity.supportingSignals.length === 0) {
      addMessage(messages, "warning", `${opportunity.label} has no supporting metadata signals.`);
    }
    if (opportunity.possibleKpiFormulas.length === 0) {
      addMessage(messages, "warning", `${opportunity.label} has no possible KPI formula metadata.`);
    }
    if (opportunity.possibleChartTypes.length === 0) {
      addMessage(messages, "warning", `${opportunity.label} has no chart recommendation metadata.`);
    }
  });

  if (report.opportunities.length === 0) {
    addMessage(messages, "warning", "No KPI opportunities are available from current metadata.");
  }

  return {
    valid: messages.every((message) => message.severity !== "error"),
    messages,
  };
};
