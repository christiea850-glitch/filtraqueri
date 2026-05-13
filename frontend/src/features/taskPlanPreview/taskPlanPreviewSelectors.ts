import type { TaskPlanPreview, TaskPlanPreviewConfidence } from "./taskPlanPreviewTypes";

export const getTaskPlanPreviewConfidenceLabel = (confidence: TaskPlanPreviewConfidence) => {
  if (confidence === "high") return "High workflow confidence";
  if (confidence === "moderate") return "Moderate workflow confidence";
  return "Low workflow confidence";
};

export const getTaskPlanPreviewSection = (preview: TaskPlanPreview, sectionId: string) =>
  preview.sections.find((section) => section.id === sectionId) || null;

export const listTaskPlanPreviewSafetyNotes = (preview: TaskPlanPreview) => preview.safetyNotes;
