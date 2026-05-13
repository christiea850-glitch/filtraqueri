import type {
  ExecutionPreviewReport,
  ExecutionPreviewStage,
  ExecutionPreviewStageType,
  ExecutionPreviewValidationMessage,
  ExecutionPreviewValidationResult,
} from "./executionPreviewTypes";

const stageOrder: Record<ExecutionPreviewStageType, number> = {
  guided_input: 10,
  validation: 20,
  aggregation: 30,
  grouping: 40,
  relationship_resolution: 50,
  engine_routing: 60,
  forecasting: 70,
  statistical_analysis: 70,
  result_projection: 80,
  explanation: 90,
};

const addMessage = (
  messages: ExecutionPreviewValidationMessage[],
  severity: ExecutionPreviewValidationMessage["severity"],
  message: string,
) => {
  messages.push({ severity, message });
};

const validateStageOrdering = (
  stages: ExecutionPreviewStage[],
  messages: ExecutionPreviewValidationMessage[],
) => {
  stages.forEach((stage, index) => {
    const previousStage = stages[index - 1];
    if (!previousStage) return;

    if (stageOrder[stage.stageType] < stageOrder[previousStage.stageType]) {
      addMessage(
        messages,
        "error",
        `${stage.label} appears before ${previousStage.label}, which breaks preview stage ordering.`,
      );
    }
  });
};

const validateDuplicateStages = (
  stages: ExecutionPreviewStage[],
  messages: ExecutionPreviewValidationMessage[],
) => {
  const stageIds = new Set<string>();

  stages.forEach((stage) => {
    if (stageIds.has(stage.stageId)) {
      addMessage(messages, "error", `Duplicate execution preview stage id: ${stage.stageId}.`);
    }
    stageIds.add(stage.stageId);
  });
};

const validateUnsupportedCombinations = (
  report: ExecutionPreviewReport,
  messages: ExecutionPreviewValidationMessage[],
) => {
  const stageTypes = new Set(report.plannedStages.map((stage) => stage.stageType));

  if (stageTypes.has("forecasting") && report.expectedFutureResultShape !== "forecast_output") {
    addMessage(messages, "error", "Forecasting previews must project a forecast output shape.");
  }
  if (stageTypes.has("statistical_analysis") && report.expectedFutureResultShape !== "statistical_output") {
    addMessage(messages, "error", "Statistical analysis previews must project a statistical output shape.");
  }
  if (
    report.expectedFutureResultShape === "ranked_output" &&
    (!stageTypes.has("aggregation") || !stageTypes.has("grouping"))
  ) {
    addMessage(
      messages,
      "error",
      "Ranked output previews require both aggregation and grouping metadata stages.",
    );
  }
  if (stageTypes.has("relationship_resolution") && report.supportedFutureEngines.length === 0) {
    addMessage(
      messages,
      "warning",
      "Relationship-aware previews should expose at least one supported future engine.",
    );
  }
};

const validateReadinessMetadata = (
  report: ExecutionPreviewReport,
  messages: ExecutionPreviewValidationMessage[],
) => {
  if (!report.readinessStatus) {
    addMessage(messages, "error", "Execution preview is missing planning readiness metadata.");
  }
  if (report.supportedFutureEngines.length === 0) {
    addMessage(messages, "warning", "No supported future engines are available for this preview yet.");
  }
  if (report.plannedStages.length === 0) {
    addMessage(messages, "error", "Execution preview must include at least one planned stage.");
  }
};

export const validateExecutionPreviewReport = (
  report: ExecutionPreviewReport,
): ExecutionPreviewValidationResult => {
  const messages: ExecutionPreviewValidationMessage[] = [];

  validateStageOrdering(report.plannedStages, messages);
  validateDuplicateStages(report.plannedStages, messages);
  validateUnsupportedCombinations(report, messages);
  validateReadinessMetadata(report, messages);

  return {
    valid: messages.every((message) => message.severity !== "error"),
    messages,
  };
};
