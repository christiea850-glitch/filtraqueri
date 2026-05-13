import { getBusinessIntentById } from "../businessIntent";
import type { AnalysisPlan } from "../analysisPlan";
import type { RelationshipAwareTaskPlan } from "../relationshipAwarePlanning";
import type { AnalyticsTask } from "../tasks";
import { getExplanationTemplate } from "./explanationTemplates";
import type { BusinessExplanation } from "./explanationTypes";

const fallbackTemplate = {
  templateKey: "generic_business_workflow",
  title: "Guided business workflow",
  summary: "This workflow prepares a business analysis from guided task inputs.",
  businessMeaning:
    "This helps translate a business question into a structured analysis plan without requiring syntax knowledge.",
  expectedOutputs: ["guided table", "summary", "explanation"],
  potentialInsights: ["business pattern", "comparison", "next-step guidance"],
};

export function buildBusinessExplanation({
  task,
  analysisPlan,
  relationshipPlan,
}: {
  task: AnalyticsTask;
  analysisPlan: AnalysisPlan | null;
  relationshipPlan?: RelationshipAwareTaskPlan | null;
}): BusinessExplanation {
  const template =
    getExplanationTemplate(task.explanationTemplateKey) || fallbackTemplate;
  const relatedIntentLabels = task.supportedIntents
    .map((intentId) => getBusinessIntentById(intentId)?.label)
    .filter(Boolean);

  return {
    id: `business-explanation:${task.id}`,
    taskId: task.id,
    explanationType: "workflow_summary",
    title: template.title,
    summary:
      relatedIntentLabels.length > 0
        ? `${template.summary} Related goal: ${relatedIntentLabels.join(", ")}.`
        : template.summary,
    businessMeaning: template.businessMeaning,
    expectedOutputs: template.expectedOutputs,
    potentialInsights: template.potentialInsights,
    supportedResultTypes: task.supportedResultTypes,
    relatedExecutionSteps: analysisPlan?.executionSteps.map((step) => step.type) || [],
    explanationTemplateKey: template.templateKey,
    explanationMode: relationshipPlan?.metadataAwareExplanation
      ? "metadata_aware"
      : "static_template",
    dynamicReadiness: relationshipPlan?.metadataAwareExplanation
      ? "metadata_ready"
      : "static_only",
    dataDependencyLevel: relationshipPlan?.metadataAwareExplanation ? "metadata" : "none",
    futureResultDependencies: [
      "active result summary",
      "row count metadata",
      "metric distribution metadata",
      "future deterministic insight outputs",
    ],
    interpretationInputs: [
      "selected task",
      "configured inputs",
      "analysis plan steps",
      "engine compatibility",
      ...(relationshipPlan?.relatedWorksheets.length
        ? ["workbook relationship previews"]
        : []),
    ],
    metadataAwareSummary: relationshipPlan?.metadataAwareExplanation || null,
  };
}
