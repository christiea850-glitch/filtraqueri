import type { AnalysisPlan } from "../analysisPlan";
import type { EngineCompatibilitySummary } from "../engineAdapters";
import type { BusinessExplanation } from "../explanations";
import type { GuidedInputSelection, GuidedInputState } from "../guidedInputs";
import type { PlanningReadinessReport } from "../planningReadiness";
import type { RelationshipAwareTaskPlan } from "../relationshipAwarePlanning";
import type { AnalyticsTask } from "../tasks";
import type {
  ExecutionPreviewConfidence,
  ExecutionPreviewReport,
  ExecutionPreviewResultShape,
  ExecutionPreviewStage,
} from "./executionPreviewTypes";
import { validateExecutionPreviewReport } from "./executionPreviewValidation";

const getSelectionLabel = (selections: GuidedInputSelection[], inputId: string) =>
  selections.find((selection) => selection.inputId === inputId)?.label ||
  selections.find((selection) => selection.inputId === inputId)?.value ||
  null;

const confidenceFromReadiness = (
  planningReadiness: PlanningReadinessReport,
): ExecutionPreviewConfidence => {
  if (planningReadiness.confidenceLevel === "high") return "high";
  if (planningReadiness.confidenceLevel === "medium") return "moderate";
  return "low";
};

const shapeForTask = (task: AnalyticsTask): ExecutionPreviewResultShape => {
  if (task.id.includes("forecast")) return "forecast_output";
  if (task.id.includes("correlation")) return "statistical_output";
  if (task.id.includes("trend")) return "trend_output";
  if (task.id.includes("compare")) return "comparison_output";
  if (task.id.includes("best_performing")) return "ranked_output";
  if (task.id.includes("unusual") || task.id.includes("inactive") || task.id.includes("profit_drop")) {
    return "summary_table";
  }
  return task.requiredInputs.some((input) => input.type === "dimension") ? "grouped_table" : "summary_table";
};

const buildWorkflowSummary = (
  task: AnalyticsTask,
  selections: GuidedInputSelection[],
  resultShape: ExecutionPreviewResultShape,
) => {
  const metric = getSelectionLabel(selections, "metric") || "the selected metric";
  const entity = getSelectionLabel(selections, "entity-field") || "the selected entity";
  const grouping =
    getSelectionLabel(selections, "grouping-field") ||
    getSelectionLabel(selections, "dimension") ||
    entity;
  const dateField = getSelectionLabel(selections, "date-field") || "a valid date field";

  if (resultShape === "forecast_output") {
    return `${dateField} may be validated, ${metric} forecasted, and a future forecast output prepared.`;
  }
  if (resultShape === "statistical_output") {
    return "Numeric measures may be validated and prepared for a future statistical output.";
  }
  if (resultShape === "trend_output") {
    return `${metric} may be aggregated over ${dateField} for a future trend output.`;
  }
  if (resultShape === "ranked_output") {
    return `${metric} may be grouped by ${grouping} for a ranked output.`;
  }
  if (task.id.includes("inactive")) {
    return `Activity dates for ${entity} may be validated for a future summary table.`;
  }
  return `${metric} may be organized by ${grouping} for a future ${resultShape.replace(/_/g, " ")}.`;
};

const createStage = (
  task: AnalyticsTask,
  index: number,
  stage: Omit<ExecutionPreviewStage, "stageId">,
): ExecutionPreviewStage => ({
  ...stage,
  stageId: `${task.id}:execution-preview:${stage.stageType}:${index + 1}`,
});

const hasSelectedGuidedInputs = (guidedInputState: GuidedInputState) =>
  guidedInputState.selections.some((selection) => Boolean(selection.value));

const buildTaskSpecificStages = (
  selections: GuidedInputSelection[],
  resultShape: ExecutionPreviewResultShape,
): Array<Omit<ExecutionPreviewStage, "stageId">> => {
  const metric = getSelectionLabel(selections, "metric") || "Selected metric";
  const entity = getSelectionLabel(selections, "entity-field") || "Selected entity";
  const grouping =
    getSelectionLabel(selections, "grouping-field") ||
    getSelectionLabel(selections, "dimension") ||
    entity;
  const dateField = getSelectionLabel(selections, "date-field") || "Date field";

  if (resultShape === "forecast_output") {
    return [
      {
        stageType: "validation",
        label: "Validation",
        description: `${dateField} and ${metric} must be structurally valid before any future forecast can run.`,
      },
      {
        stageType: "forecasting",
        label: "Forecasting intent",
        description: `Future execution may model ${metric} across time once date readiness is confirmed.`,
      },
      {
        stageType: "result_projection",
        label: "Forecast output projection",
        description: "The future result is expected to include time-aware forecast rows or periods.",
      },
    ];
  }

  if (resultShape === "statistical_output") {
    return [
      {
        stageType: "validation",
        label: "Validation",
        description: "Selected measures must be numeric and compatible with statistical analysis.",
      },
      {
        stageType: "statistical_analysis",
        label: "Statistical analysis intent",
        description: "Future execution may compare numeric measures for statistical relationship signals.",
      },
      {
        stageType: "result_projection",
        label: "Statistical output projection",
        description: "The future result is expected to include statistical indicators and summary context.",
      },
    ];
  }

  if (resultShape === "trend_output") {
    return [
      {
        stageType: "validation",
        label: "Validation",
        description: `${dateField} must be available before future trend analysis can run.`,
      },
      {
        stageType: "aggregation",
        label: "Metric aggregation",
        description: `Future execution may aggregate ${metric} over time.`,
      },
      {
        stageType: "result_projection",
        label: "Trend output projection",
        description: "The future result is expected to show metric movement across date periods.",
      },
    ];
  }

  return [
    {
      stageType: "aggregation",
      label: "Metric aggregation",
      description: `Future execution may summarize ${metric}.`,
    },
    {
      stageType: "grouping",
      label: "Grouping intent",
      description: `Future execution may group results by ${grouping}.`,
    },
    {
      stageType: "result_projection",
      label:
        resultShape === "ranked_output"
          ? "Ranked output projection"
          : `${resultShape.replace(/_/g, " ")} projection`,
      description: `The future result is expected to produce a ${resultShape.replace(/_/g, " ")}.`,
    },
  ];
};

const buildRelationshipStage = (
  relationshipPlan: RelationshipAwareTaskPlan,
): Omit<ExecutionPreviewStage, "stageId"> | null => {
  if (!relationshipPlan.hasWorkbookContext || relationshipPlan.futureJoinRequirementStatus === "not_required") {
    return null;
  }

  return {
    stageType: "relationship_resolution",
    label: "Workbook relationship resolution",
    description:
      relationshipPlan.matchingJoinPreviews.length > 0
        ? `Future execution may depend on ${relationshipPlan.relatedWorksheets.slice(0, 3).join(", ")} relationship metadata.`
        : "Workbook relationships may need confirmation before future execution.",
  };
};

const buildEngineStage = (
  engineCompatibility: EngineCompatibilitySummary,
): Omit<ExecutionPreviewStage, "stageId"> => ({
  stageType: "engine_routing",
  label: "Future engine routing",
  description: engineCompatibility.recommendedEngine
    ? `${engineCompatibility.recommendedEngine.label} is the current metadata-recommended future engine.`
    : "No future engine is currently recommended by metadata compatibility.",
});

const buildExplanationStage = (
  explanation: BusinessExplanation | null,
): Omit<ExecutionPreviewStage, "stageId"> => ({
  stageType: "explanation",
  label: "Explanation generation",
  description: explanation
    ? `Future explanations may use ${explanation.explanationMode.replace(/_/g, " ")} metadata.`
    : "Future explanation metadata is not available yet.",
});

const buildSafetyNotes = (
  task: AnalyticsTask,
  guidedInputState: GuidedInputState,
  planningReadiness: PlanningReadinessReport,
  relationshipPlan: RelationshipAwareTaskPlan,
  resultShape: ExecutionPreviewResultShape,
) => {
  const notes = [
    "Execution preview is metadata only; it does not run queries or generate code.",
    ...planningReadiness.futureExecutionBlockers,
  ];

  if (guidedInputState.missingRequiredInputIds.length > 0) {
    notes.push("Some guided inputs are still missing.");
  }
  if (relationshipPlan.hasWorkbookContext && relationshipPlan.futureJoinRequirementStatus !== "not_required") {
    notes.push("Workbook relationships still require confirmation.");
  }
  if (resultShape === "forecast_output" || task.id.includes("forecast")) {
    notes.push("Forecasting requires a valid date field.");
  }
  if (resultShape === "statistical_output" || task.id.includes("correlation")) {
    notes.push("Statistical workflows may require numeric metrics.");
  }

  return Array.from(new Set(notes));
};

const buildAnalystNotes = ({
  analysisPlan,
  engineCompatibility,
  explanation,
  guidedInputState,
  planningReadiness,
  relationshipPlan,
}: {
  analysisPlan: AnalysisPlan | null;
  engineCompatibility: EngineCompatibilitySummary;
  explanation: BusinessExplanation | null;
  guidedInputState: GuidedInputState;
  planningReadiness: PlanningReadinessReport;
  relationshipPlan: RelationshipAwareTaskPlan;
}) => {
  const notes = [
    `Planning readiness is ${planningReadiness.status.replace(/_/g, " ")}.`,
    `Guided input readiness is ${guidedInputState.readyForPlanning ? "ready" : "incomplete"}.`,
    `Future engine candidates: ${engineCompatibility.compatibleEngines.length}.`,
  ];

  if (analysisPlan) {
    notes.push(`Analysis plan contributes ${analysisPlan.executionSteps.length} metadata step placeholders.`);
  } else {
    notes.push("Analysis plan metadata is not available yet.");
  }
  if (relationshipPlan.futureJoinRequirementStatus !== "not_required") {
    notes.push(`Relationship dependency is ${relationshipPlan.futureJoinRequirementStatus.replace(/_/g, " ")}.`);
  }
  if (explanation) {
    notes.push(`Explanation readiness is ${explanation.dynamicReadiness.replace(/_/g, " ")}.`);
  }

  return notes;
};

export const buildExecutionPreview = ({
  task,
  guidedInputState,
  analysisPlan,
  relationshipPlan,
  engineCompatibility,
  planningReadiness,
  explanation,
}: {
  task: AnalyticsTask;
  guidedInputState: GuidedInputState;
  analysisPlan: AnalysisPlan | null;
  relationshipPlan: RelationshipAwareTaskPlan;
  engineCompatibility: EngineCompatibilitySummary;
  planningReadiness: PlanningReadinessReport;
  explanation: BusinessExplanation | null;
}): ExecutionPreviewReport => {
  const resultShape = shapeForTask(task);
  const taskStages = buildTaskSpecificStages(guidedInputState.selections, resultShape);
  const preEngineStages = taskStages.filter(
    (stage) =>
      stage.stageType !== "forecasting" &&
      stage.stageType !== "statistical_analysis" &&
      stage.stageType !== "result_projection",
  );
  const engineRoutedStages = taskStages.filter(
    (stage) => stage.stageType === "forecasting" || stage.stageType === "statistical_analysis",
  );
  const resultProjectionStages = taskStages.filter((stage) => stage.stageType === "result_projection");
  const baseStages: Array<Omit<ExecutionPreviewStage, "stageId">> = [
    {
      stageType: "guided_input",
      label: "Guided input selection",
      description: hasSelectedGuidedInputs(guidedInputState)
        ? "Selected guided inputs provide metadata for future execution planning."
        : "Guided inputs define the metadata a future workflow would need.",
    },
    ...preEngineStages,
  ];
  const relationshipStage = buildRelationshipStage(relationshipPlan);
  const orderedStages = [
    ...baseStages,
    ...(relationshipStage ? [relationshipStage] : []),
    buildEngineStage(engineCompatibility),
    ...engineRoutedStages,
    ...resultProjectionStages,
    buildExplanationStage(explanation),
  ];
  const initialReport: ExecutionPreviewReport = {
    taskId: task.id,
    workflowSummary: buildWorkflowSummary(task, guidedInputState.selections, resultShape),
    plannedStages: orderedStages.map((stage, index) => createStage(task, index, stage)),
    confidence: confidenceFromReadiness(planningReadiness),
    readinessStatus: planningReadiness.status,
    expectedFutureResultShape: resultShape,
    supportedFutureEngines: engineCompatibility.compatibleEngines.map((result) => result.engine.id),
    safetyNotes: buildSafetyNotes(task, guidedInputState, planningReadiness, relationshipPlan, resultShape),
    analystNotes: buildAnalystNotes({
      analysisPlan,
      engineCompatibility,
      explanation,
      guidedInputState,
      planningReadiness,
      relationshipPlan,
    }),
  };
  const validation = validateExecutionPreviewReport(initialReport);

  if (validation.messages.length === 0) return initialReport;

  return {
    ...initialReport,
    safetyNotes: Array.from(
      new Set([
        ...initialReport.safetyNotes,
        ...validation.messages.map((message) => message.message),
      ]),
    ),
  };
};
