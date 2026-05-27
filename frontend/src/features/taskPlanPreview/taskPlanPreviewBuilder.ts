import type { AnalysisPlan } from "../analysisPlan";
import type { EngineCompatibilitySummary } from "../engineAdapters";
import type { BusinessExplanation } from "../explanations";
import type { GuidedInputSelection, GuidedInputState } from "../guidedInputs";
import type { PlanningReadinessReport } from "../planningReadiness";
import type { RelationshipAwareTaskPlan } from "../relationshipAwarePlanning";
import type { AnalyticsTask } from "../tasks";
import type { TaskPlanPreview, TaskPlanPreviewConfidence } from "./taskPlanPreviewTypes";
import { buildTaskPlanPreviewSafetyNotes } from "./taskPlanPreviewValidation";

const getSelectionValue = (selections: GuidedInputSelection[], inputId: string) =>
  selections.find((selection) => selection.inputId === inputId)?.label ||
  selections.find((selection) => selection.inputId === inputId)?.value ||
  null;

const confidenceFromReadiness = (
  planningReadiness: PlanningReadinessReport,
): TaskPlanPreviewConfidence => {
  if (planningReadiness.confidenceLevel === "high") return "high";
  if (planningReadiness.confidenceLevel === "medium") return "moderate";
  return "low";
};

const buildWorkflowSummary = (task: AnalyticsTask, selections: GuidedInputSelection[]) => {
  const metric = getSelectionValue(selections, "metric") || "the selected metric";
  const entity = getSelectionValue(selections, "entity-field") || getSelectionValue(selections, "dimension");
  const grouping =
    getSelectionValue(selections, "grouping-field") ||
    getSelectionValue(selections, "dimension") ||
    entity;
  const dateField = getSelectionValue(selections, "date-field");

  if (task.id.includes("forecast")) {
    return `${metric} may be prepared over time for a future forecasting workflow.`;
  }
  if (task.id.includes("trend")) {
    return `${metric} may be compared over ${dateField || "a selected date field"}.`;
  }
  if (task.id.includes("correlation")) {
    return "The selected measures may be compared to check whether they tend to move together.";
  }
  if (task.id.includes("inactive")) {
    return `Inactive ${entity || "business entities"} may be identified using a selected date field.`;
  }
  if (task.id.includes("compare")) {
    return `${metric} may be compared across ${grouping || "selected groups"}.`;
  }
  return `${metric} may be grouped by ${grouping || "the selected business category"}.`;
};

const buildSelectedInputsSummary = (guidedInputState: GuidedInputState) => {
  const selected = guidedInputState.selections.filter((selection) => selection.value);
  if (selected.length === 0) return ["No guided inputs selected yet."];
  return selected.map((selection) => `${selection.inputId.replace(/-/g, " ")}: ${selection.label || selection.value}`);
};

const buildExpectedBehavior = (analysisPlan: AnalysisPlan | null) => {
  if (!analysisPlan) return ["An analysis plan is needed before future behavior can be described."];
  return analysisPlan.executionSteps.map((step) => step.description);
};

const buildRelationshipUsage = (relationshipPlan: RelationshipAwareTaskPlan) => {
  if (!relationshipPlan.hasWorkbookContext) return ["This workflow currently uses single-dataset planning context."];
  if (relationshipPlan.matchingJoinPreviews.length === 0) {
    return ["No workbook relationship preview currently matches this task."];
  }
  return relationshipPlan.matchingJoinPreviews.slice(0, 3).map((preview) =>
    `This workflow may use ${preview.relatedSheets.join(" and ")} worksheets together.`,
  );
};

const buildFutureEnginePath = (engineCompatibility: EngineCompatibilitySummary) => {
  const recommended = engineCompatibility.recommendedEngine;
  if (!recommended) return ["No future engine path is recommended yet."];
  return [
    `${recommended.label} is the current recommended future engine path.`,
    ...engineCompatibility.compatibleEngines
      .filter((result) => result.engine.id !== recommended.id)
      .slice(0, 2)
      .map((result) => `${result.engine.label} may also support this workflow later.`),
  ];
};

const buildExplanationReadiness = (explanation: BusinessExplanation | null) => {
  if (!explanation) return ["Business explanation metadata is not available yet."];
  return [
    `Explanation mode: ${explanation.explanationMode.replace(/_/g, " ")}.`,
    `Dynamic readiness: ${explanation.dynamicReadiness.replace(/_/g, " ")}.`,
    ...explanation.interpretationInputs.slice(0, 3).map((input) => `Uses ${input}.`),
  ];
};

export const buildTaskPlanPreview = ({
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
}): TaskPlanPreview => {
  const workflowSummary = buildWorkflowSummary(task, guidedInputState.selections);
  const selectedInputsSummary = buildSelectedInputsSummary(guidedInputState);
  const expectedFutureWorkflowBehavior = buildExpectedBehavior(analysisPlan);
  const workbookRelationshipUsage = buildRelationshipUsage(relationshipPlan);
  const futureEnginePath = buildFutureEnginePath(engineCompatibility);
  const futureExplanationReadiness = buildExplanationReadiness(explanation);
  const safetyNotes = buildTaskPlanPreviewSafetyNotes(guidedInputState, planningReadiness);

  return {
    id: `task-plan-preview:${task.id}`,
    taskId: task.id,
    workflowSummary,
    selectedInputsSummary,
    expectedFutureWorkflowBehavior,
    workbookRelationshipUsage,
    futureEnginePath,
    futureExplanationReadiness,
    safetyNotes,
    confidence: confidenceFromReadiness(planningReadiness),
    sections: [
      { id: "workflow", title: "Workflow summary", lines: [workflowSummary] },
      { id: "inputs", title: "Selected inputs", lines: selectedInputsSummary },
      { id: "behavior", title: "Expected future workflow", lines: expectedFutureWorkflowBehavior },
      { id: "relationships", title: "Workbook relationship usage", lines: workbookRelationshipUsage },
      { id: "engine", title: "Future engine path", lines: futureEnginePath },
      { id: "explanation", title: "Explanation readiness", lines: futureExplanationReadiness },
      { id: "safety", title: "Safety notes", lines: safetyNotes },
    ],
    sourceMetadata: {
      selectedInputs: guidedInputState.selections,
      recommendedEngine: engineCompatibility.recommendedEngine,
      relationshipPreviews: relationshipPlan.matchingJoinPreviews,
      planningStatus: planningReadiness.status,
    },
  };
};
